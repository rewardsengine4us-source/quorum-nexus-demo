// Regex-based email parsing engine for Quorum Nexus.
// Three-tier program detection (sender domain > strong/brand-unique phrase > weak/generic brand name),
// four event types (balance / earned / redeemed / expiring), with anti-false-positive guards.

export type EventType = "balance" | "earned" | "redeemed" | "expiring";

export interface DetectionRule {
  id: number | string;
  program_code: string;
  domains: string[];
  strong: string[];
  weak: string[];
  is_active: boolean;
  updated_at?: string;
}

export interface ExtractResult {
  event: EventType;
  amount: number;
  evidence: string;
}

export interface DetectResult {
  programId: string;
  via: string;
}

export interface ParseEmailResult {
  program: DetectResult | null;
  extract: ExtractResult | null;
}

// ---- core patterns (verbatim, do not alter) ----
const Q = "(?:[A-Za-z][A-Za-z&+'-]*\\s+){0,3}";
const C = Q + "(?:reward\\s+)?(?:bonus\\s+)?(?:points?|miles|neucoins?|supercoins?|coins?|sparks|jewels|avios|qmiles|credits?|cashback(?:\\s+bonus)?)";
const N = "([\\d][\\d,]{0,14}(?:\\.\\d{1,2})?)";

const EARN = [
  new RegExp(`(?:you(?:'ve|\\s+have)?\\s+)?earned\\s+(?:a\\s+total\\s+of\\s+)?${N}\\s*${C}`, "i"),
  new RegExp(`${N}\\s*${C}\\s+(?:have\\s+been\\s+|has\\s+been\\s+|were\\s+|are\\s+)?(?:earned|credited|added|awarded|accrued)`, "i"),
  new RegExp(`(?:credited|added|awarded)\\s+(?:you\\s+|with\\s+|your\\s+account\\s+with\\s+)?${N}\\s*${C}`, "i"),
];

const BAL = [
  new RegExp(`${C}\\s+balance\\s*(?:is|of|:|-)?\\s*${N}`, "i"),
  new RegExp(`balance\\s+of\\s+${N}\\s*${C}`, "i"),
  new RegExp(`(?:total|current|available|closing|outstanding|unredeemed|accumulated)\\s+${C}\\s*(?:balance)?[^\\d]{0,15}${N}`, "i"),
  new RegExp(`you\\s+(?:now\\s+)?have\\s+${N}\\s*${C}`, "i"),
  new RegExp(`${N}\\s*${C}\\s+(?:are\\s+)?available`, "i"),
  new RegExp(`${C}\\s*[:-]\\s*${N}`, "i"),
];

const EXP = [
  new RegExp(`${N}\\s*${C}[^.\\n]{0,40}expir`, "i"),
  new RegExp(`expir[^.\\n]{0,40}${N}\\s*${C}`, "i"),
];

const RED = [
  new RegExp(`(?:redeemed|debited|deducted)\\s+${N}\\s*${C}`, "i"),
  new RegExp(`${N}\\s*${C}\\s+(?:have\\s+been\\s+|were\\s+)?(?:redeemed|debited|deducted)`, "i"),
];

// ---- helpers ----

/** Strip HTML tags to plain text (for parsing HTML email bodies). */
export function txt(html: string): string {
  if (!html) return "";
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|td|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

/** True if text immediately before index i looks like a currency symbol/code (not a point balance). */
export function money(t: string, i: number): boolean {
  const start = Math.max(0, i - 14);
  const before = t.slice(start, i);
  return /(?:rs\.?|inr|usd|\$)\s*$/i.test(before);
}

/** True if there's a "digit x" multiplier pattern near index i (e.g. "5X points"). */
export function mult(t: string, i: number, m: string): boolean {
  const start = Math.max(0, i - 3);
  const chunk = t.slice(start, i + m.length + 3);
  return /\d\s*[xX]\s/.test(chunk);
}

/** True if the character immediately after the matched number is a letter (e.g. "1.93L"). */
export function abbr(t: string, i: number, raw: string): boolean {
  return /[a-zA-Z]/.test(t.charAt(i + raw.length));
}

/** Try each regex in order; for each match, check the anti-false-positive guards. */
export function run(patterns: RegExp[], text: string): ExtractResult | null {
  for (const re of patterns) {
    const m = text.match(re);
    if (!m || m.index === undefined) continue;
    // find the numeric capture group (last non-undefined group is the number)
    let raw: string | undefined;
    for (let g = m.length - 1; g >= 1; g--) {
      if (m[g] !== undefined) {
        raw = m[g];
        break;
      }
    }
    if (!raw) continue;
    const idx = text.indexOf(raw, m.index);
    if (idx === -1) continue;
    if (money(text, idx)) continue;
    if (mult(text, idx, raw)) continue;
    if (abbr(text, idx, raw)) continue;
    const amount = parseFloat(raw.replace(/,/g, ""));
    if (!isFinite(amount)) continue;
    return { event: "balance", amount, evidence: m[0].trim() };
  }
  return null;
}

/** Run redeemed > balance > earned > expiring in priority order; first clean match wins. */
export function extract(text: string): ExtractResult | null {
  if (!text) return null;
  const red = run(RED, text);
  if (red) return { ...red, event: "redeemed" };
  const bal = run(BAL, text);
  if (bal) return { ...bal, event: "balance" };
  const earn = run(EARN, text);
  if (earn) return { ...earn, event: "earned" };
  const exp = run(EXP, text);
  if (exp) return { ...exp, event: "expiring" };
  return null;
}

/** Extract lowercased domain from an email "From" header. */
export function dom(from: string): string {
  const m = from.match(/@([A-Za-z0-9.-]+)/);
  return m ? m[1].toLowerCase() : "";
}

/** Word-boundary-safe substring match. */
export function has(haystack: string, phrase: string): boolean {
  if (!haystack || !phrase) return false;
  const esc = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`\\b${esc}\\b`, "i");
  return re.test(haystack);
}

/** Three-tier program detection: sender domain > strong (brand-unique) phrase > weak (generic) phrase. */
export function detect(from: string, text: string, rules: DetectionRule[]): DetectResult | null {
  const fromDomain = dom(from);
  const active = rules.filter((r) => r.is_active);

  // Tier 1: sender domain
  if (fromDomain) {
    for (const r of active) {
      if (r.domains && r.domains.some((d) => d && fromDomain === d.toLowerCase())) {
        return { programId: r.program_code, via: "sender:" + fromDomain };
      }
      if (r.domains && r.domains.some((d) => d && fromDomain.endsWith("." + d.toLowerCase()))) {
        return { programId: r.program_code, via: "sender:" + fromDomain };
      }
    }
  }

  // Tier 2: strong (brand-unique) phrase
  for (const r of active) {
    if (r.strong && r.strong.some((p) => p && has(text, p))) {
      const matched = r.strong.find((p) => p && has(text, p))!;
      return { programId: r.program_code, via: "currency:" + matched.toLowerCase() };
    }
  }

  // Tier 3: weak (generic brand name) phrase
  for (const r of active) {
    if (r.weak && r.weak.some((p) => p && has(text, p))) {
      const matched = r.weak.find((p) => p && has(text, p))!;
      return { programId: r.program_code, via: "brand:" + matched.toLowerCase() };
    }
  }

  return null;
}

/** Combines detect() + extract() into a full parse result. */
export function parseEmail(
  from: string,
  subject: string,
  body: string,
  rules: DetectionRule[]
): ParseEmailResult {
  const fullText = `${subject || ""}\n${body || ""}`;
  const program = detect(from, fullText, rules);
  const ex = extract(fullText);
  return { program, extract: ex };
}

// ---- credit card auto-detection ----

const STOP = [
  "bank", "card", "cards", "credit", "the", "club", "plus", "metal", "gold",
  "black", "charge", "private", "premier", "signature", "amex", "hdfc", "axis",
  "icici", "hsbc", "kotak", "yes", "idfc", "rbl", "sbi", "bob", "indusind", "federal",
];

export interface CardRow {
  id: number | string;
  card_name: string;
  bank_id: number | string;
}

export interface BankRow {
  id: number | string;
  bank_name: string;
}

export interface FoundCard {
  cardId: number | string;
  cardName: string;
  bankId: number | string;
  product: string;
}

/** Faithful reproduction of the (known-flawed) card auto-detection heuristic. */
export function findCard(text: string, cards: CardRow[], banks: BankRow[]): FoundCard | null {
  if (!text) return null;
  const bankMap: Record<string, string> = {};
  for (const b of banks) bankMap[String(b.id)] = (b.bank_name || "").toLowerCase();

  let best: FoundCard | null = null;
  let bestLen = 0;

  for (const card of cards) {
    const name = (card.card_name || "").toLowerCase();
    const tokens = name.split(/\s+/).filter((t) => t.length > 3 && !STOP.includes(t));
    if (!tokens.length) continue;
    const product = tokens[tokens.length - 1];
    if (!(product.length >= 4 && /^[a-z0-9]+$/.test(product))) continue;

    const productRe = new RegExp(`\\b${product}\\b`, "i");
    if (!productRe.test(text)) continue;

    const bankName = bankMap[String(card.bank_id)] || "";
    const bankFirstWord = bankName.split(/\s+/)[0];
    if (!bankFirstWord) continue;
    const bankRe = new RegExp(`\\b${bankFirstWord}\\b`, "i");
    if (!bankRe.test(text)) continue;

    if (product.length > bestLen) {
      bestLen = product.length;
      best = { cardId: card.id, cardName: card.card_name, bankId: card.bank_id, product };
    }
  }

  return best;
}

/** Extract last 2-4 digits of a card number from text like "card ending 1234". */
export function last4(text: string): string | null {
  if (!text) return null;
  const m = text.match(/ending\s*(?:in\s*|with\s*)?(?:[xX*]{2,})?\s*(\d{2,4})\b/i);
  return m ? m[1] : null;
}
