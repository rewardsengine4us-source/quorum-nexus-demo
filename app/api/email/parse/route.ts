import { NextResponse } from "next/server";
import { google } from "googleapis";
import { DEMO, sel, one, up, patch } from "@/lib/db";
import { parseEmail, findCard, last4, txt, type DetectionRule, type CardRow, type BankRow } from "@/lib/parser";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const QS = [
  "newer_than:3y (\"points balance\" OR \"reward points balance\" OR \"available points\" OR \"total points\" OR \"points summary\" OR \"miles balance\" OR \"account summary\" OR \"your points\")",
  "newer_than:2y (\"credit card\" statement OR \"card ending\" OR \"card statement\")",
  "newer_than:1y (points OR miles OR rewards OR loyalty OR neucoins OR supercoins OR avios OR skywards OR bonvoy OR \"membership rewards\" OR \"reward points\")",
];
const PER = 34;
const CC = 8;

function hv(headers: any[], name: string): string {
  if (!headers) return "";
  const h = headers.find((x) => x.name && x.name.toLowerCase() === name.toLowerCase());
  return h ? h.value || "" : "";
}

function decodeB64(data: string): string {
  try {
    return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
  } catch {
    return "";
  }
}

function body(payload: any): string {
  if (!payload) return "";
  let plain = "";
  let html = "";

  function walk(part: any) {
    if (!part) return;
    const mime = part.mimeType || "";
    if (mime === "text/plain" && part.body && part.body.data) {
      plain += decodeB64(part.body.data) + "\n";
    } else if (mime === "text/html" && part.body && part.body.data) {
      html += decodeB64(part.body.data) + "\n";
    }
    if (part.parts && part.parts.length) {
      for (const p of part.parts) walk(p);
    }
  }

  walk(payload);
  if (plain.trim()) return plain;
  if (html.trim()) return txt(html);
  return "";
}

interface PdfPart {
  filename: string;
  attachmentId: string;
}

function pdfs(payload: any): PdfPart[] {
  const out: PdfPart[] = [];
  function walk(part: any) {
    if (!part) return;
    if (
      part.filename &&
      part.filename.toLowerCase().endsWith(".pdf") &&
      part.body &&
      part.body.attachmentId
    ) {
      out.push({ filename: part.filename, attachmentId: part.body.attachmentId });
    }
    if (part.parts && part.parts.length) {
      for (const p of part.parts) walk(p);
    }
  }
  walk(payload);
  return out;
}

async function runSync() {
  const diag: { keyPresent: boolean; error: string | null } = {
    keyPresent: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    error: null,
  };

  const conn = await one("email_connections", `user_id=eq.${DEMO}&oauth_provider=eq.gmail`);
  if (!conn) {
    return NextResponse.json(
      { scanned: 0, processed: 0, matched: 0, unmatched: 0, pdfs: 0, cardsLinked: 0, programsTouched: 0, error: "no_connection" },
      { status: 200 }
    );
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    (process.env.NEXT_PUBLIC_APP_URL || "") + "/api/auth/gmail/callback"
  );
  oauth2Client.setCredentials({
    access_token: conn.access_token,
    refresh_token: conn.refresh_token,
  });

  oauth2Client.on("tokens", async (tokens) => {
    try {
      const upd: any = {};
      if (tokens.access_token) upd.access_token = tokens.access_token;
      if (tokens.refresh_token) upd.refresh_token = tokens.refresh_token;
      if (Object.keys(upd).length) {
        await patch("email_connections", `id=eq.${conn.id}`, upd);
      }
    } catch (e) {
      // swallow token-refresh persistence errors, sync continues with in-memory tokens
    }
  });

  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  // gather message ids across all queries, deduped
  const idSet = new Set<string>();
  for (const q of QS) {
    try {
      const res = await gmail.users.messages.list({ userId: "me", q, maxResults: PER });
      const msgs = res.data.messages || [];
      for (const m of msgs) if (m.id) idSet.add(m.id);
    } catch (e) {
      diag.error = "gmail_list_failed: " + (e as Error).message;
    }
  }
  const ids = Array.from(idSet);

  // skip already-logged emails
  const existingLogs = await sel("email_parsing_logs", `user_id=eq.${DEMO}&select=email_id`);
  const seen = new Set(existingLogs.map((l: any) => l.email_id));
  const todo = ids.filter((id) => !seen.has(id));

  // reference data
  const rules = (await sel("detection_rules", "is_active=eq.true")) as DetectionRule[];
  const programs = await sel("loyalty_programs", "select=id,program_name");
  const programMap: Record<string, string> = {};
  for (const p of programs) programMap[String(p.id)] = p.program_name;

  const cards = (await sel("credit_cards", "select=id,card_name,bank_id")) as CardRow[];
  const banksRaw = await sel("banks", "select=id,bank_name");
  const banks = banksRaw as BankRow[];

  let processed = 0;
  let matched = 0;
  let unmatched = 0;
  let pdfCount = 0;

  const bal: Record<string, { v: number; when: number }> = {};
  const linked: Record<string, { credit_card_id: any; notes: string }> = {};
  const logRows: any[] = [];

  async function processOne(id: string) {
    let msg;
    try {
      msg = await gmail.users.messages.get({ userId: "me", id, format: "full" });
    } catch (e) {
      return;
    }
    const payload = msg.data.payload;
    const headers = (payload && payload.headers) || [];
    const subject = hv(headers, "Subject");
    const from = hv(headers, "From");
    const when = msg.data.internalDate ? parseInt(msg.data.internalDate, 10) : Date.now();

    let text = body(payload);
    let source: "body" | "pdf" = "body";
    let result = parseEmail(from, subject, text, rules);

    if ((!result.extract || !result.extract.amount) && pdfCount < 8) {
      const attachments = pdfs(payload);
      for (const att of attachments) {
        if (pdfCount >= 8) break;
        try {
          const attRes = await gmail.users.messages.attachments.get({
            userId: "me",
            messageId: id,
            id: att.attachmentId,
          });
          const data = attRes.data.data;
          if (!data) continue;
          const buf = Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64");
          if (buf.length > 6 * 1024 * 1024) continue;
          pdfCount++;
          const pdfParse = require("pdf-parse/lib/pdf-parse.js");
          const pdfData = await pdfParse(buf);
          const pdfText = pdfData.text || "";
          const pdfResult = parseEmail(from, subject, pdfText, rules);
          if (pdfResult.extract && pdfResult.extract.amount) {
            result = pdfResult;
            text = pdfText;
            source = "pdf";
            break;
          }
        } catch (e) {
          // skip unreadable attachment
        }
      }
    }

    const fullText = `${subject}\n${text}`;
    const usable =
      !!result.program && !!result.extract && result.extract.event === "balance" && !!result.extract.amount;

    if (usable && result.program) {
      const pid = result.program.programId;
      const existing = bal[pid];
      if (!existing || when > existing.when) {
        bal[pid] = { v: result.extract!.amount, when };
      }
      matched++;
    } else {
      unmatched++;
    }

    const foundCard = findCard(fullText, cards, banks);
    if (foundCard) {
      const l4 = last4(fullText);
      const key = `${result.program ? result.program.programId : "none"}:${foundCard.cardId}`;
      if (!linked[key]) {
        linked[key] = {
          credit_card_id: foundCard.cardId,
          notes: l4 ? `Detected in your inbox - ending ${l4}` : "Detected in your inbox",
        };
      }
    }

    logRows.push({
      user_id: DEMO,
      email_id: id,
      email_subject: subject,
      sender: from,
      extracted_points: null,
      extracted_balance: result.extract ? result.extract.amount : null,
      program_id: result.program ? result.program.programId : null,
      parse_status: usable ? "success" : "no_match",
      detected_via: result.program ? result.program.via : null,
      event_type: result.extract ? result.extract.event : null,
      source,
      created_at: new Date().toISOString(),
    });

    processed++;
  }

  for (let i = 0; i < todo.length; i += CC) {
    const batch = todo.slice(i, i + CC);
    await Promise.all(batch.map((id) => processOne(id)));
  }

  if (logRows.length) {
    try {
      await up("email_parsing_logs", logRows, "user_id,email_id", true);
    } catch (e) {
      diag.error = "log_upsert_failed: " + (e as Error).message;
    }
  }

  const programsTouched = Object.keys(bal).length;
  for (const pid of Object.keys(bal)) {
    try {
      await up(
        "user_points",
        [{ user_id: DEMO, program_id: pid, points: bal[pid].v, as_of: new Date(bal[pid].when).toISOString() }],
        "user_id,program_id"
      );
    } catch (e) {
      diag.error = "points_upsert_failed: " + (e as Error).message;
    }
  }

  let cardsLinked = 0;
  for (const key of Object.keys(linked)) {
    try {
      await up(
        "user_cards",
        [{ user_id: DEMO, credit_card_id: linked[key].credit_card_id, notes: linked[key].notes }],
        "user_id,credit_card_id",
        true
      );
      cardsLinked++;
    } catch (e) {
      diag.error = "card_upsert_failed: " + (e as Error).message;
    }
  }

  try {
    await patch("email_connections", `id=eq.${conn.id}`, { last_sync_at: new Date().toISOString() });
  } catch (e) {
    diag.error = "conn_patch_failed: " + (e as Error).message;
  }

  return NextResponse.json({
    scanned: ids.length,
    processed,
    matched,
    unmatched,
    pdfs: pdfCount,
    cardsLinked,
    programsTouched,
  });
}

export async function POST() {
  try {
    return await runSync();
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function GET() {
  try {
    return await runSync();
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
