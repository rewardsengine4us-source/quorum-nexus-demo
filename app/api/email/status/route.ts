import { NextResponse } from "next/server";
import { DEMO, sel, one, KEY_OK } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const diag: { keyPresent: boolean; error: string | null } = {
    keyPresent: KEY_OK,
    error: null,
  };

  let connection = null;
  let logs: any[] = [];
  let programs: Record<string, string> = {};

  try {
    connection = await one(
      "email_connections",
      `user_id=eq.${DEMO}&select=id,email,oauth_provider,last_sync_at,created_at`
    );
  } catch (e) {
    diag.error = "connection_fetch_failed: " + (e as Error).message;
  }

  try {
    logs = await sel(
      "email_parsing_logs",
      `user_id=eq.${DEMO}&select=id,email_id,email_subject,sender,extracted_points,extracted_balance,program_id,parse_status,detected_via,event_type,source,card_hint,raw_email_snippet,created_at&order=id`
    );
  } catch (e) {
    diag.error = (diag.error ? diag.error + "; " : "") + "logs_fetch_failed: " + (e as Error).message;
  }

  try {
    const rows = await sel("loyalty_programs", "select=id,program_name");
    for (const r of rows) programs[String(r.id)] = r.program_name;
  } catch (e) {
    diag.error = (diag.error ? diag.error + "; " : "") + "programs_fetch_failed: " + (e as Error).message;
  }

  return NextResponse.json({ connection, logs, programs, diag });
}
