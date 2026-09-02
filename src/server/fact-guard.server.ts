/**
 * Fact guard — blocks hallucinated details (invented numbers, amounts,
 * percentages, promo codes) that do not appear in the user's source text.
 */

// Numbers/amounts that are safe in any copy (time-of-day, "24/7", ordinals, etc.)
const ALWAYS_ALLOWED = new Set(["1", "2", "3", "24", "7", "100"]);

function normalizeNumber(raw: string): string {
  const cleaned = raw.replace(/,/g, "");
  const num = Number(cleaned);
  if (!Number.isFinite(num)) return cleaned;
  // 10.00 and 10 are the same fact
  return String(num);
}

/** Numeric facts (amounts, percentages, counts) found in a text. */
function numericFacts(text: string): Set<string> {
  const out = new Set<string>();
  for (const m of text.matchAll(/\d[\d,]*(?:\.\d+)?/g)) {
    out.add(normalizeNumber(m[0]));
  }
  return out;
}

/** Code-like tokens: MEGAGEM40, BONUS2X, etc. */
function codeFacts(text: string): Set<string> {
  const out = new Set<string>();
  for (const m of text.matchAll(/\b[A-Z][A-Z0-9]{3,}\b/g)) {
    out.add(m[0].toUpperCase());
  }
  return out;
}

export type InventedFacts = {
  numbers: string[];
  codes: string[];
};

/**
 * Compare generated copy against every piece of source text the user supplied.
 * Returns any numeric or code fact present in the output but absent from the source.
 */
export function findInventedFacts(
  output: string,
  sourceParts: Array<string | undefined | null>,
): InventedFacts {
  const source = sourceParts.filter(Boolean).join(" \n ");
  const allowedNumbers = numericFacts(source);
  const allowedCodes = codeFacts(source);

  // Strip links — URLs carry their own digits and are supplied by the user.
  const body = output.replace(/https?:\/\/\S+/gi, " ").replace(/\b\S+\.(?:com|net|org|io|co|link)\S*/gi, " ");

  const numbers = [...numericFacts(body)].filter(
    (n) => !allowedNumbers.has(n) && !ALWAYS_ALLOWED.has(n),
  );
  const codes = [...codeFacts(body)].filter((c) => !allowedCodes.has(c));

  return { numbers, codes };
}

export function hasInventedFacts(f: InventedFacts): boolean {
  return f.numbers.length > 0 || f.codes.length > 0;
}

/** Human-readable corrective instruction appended to a retry prompt. */
export function inventedFactsNote(f: InventedFacts): string {
  const bits: string[] = [];
  if (f.numbers.length) bits.push(`numbers/amounts: ${f.numbers.join(", ")}`);
  if (f.codes.length) bits.push(`codes: ${f.codes.join(", ")}`);
  return [
    "",
    "## REJECTED — FABRICATED DETAILS DETECTED",
    `Your previous attempt invented details that do NOT exist in the offer text (${bits.join("; ")}).`,
    "Rewrite everything from scratch. Use ONLY numbers, amounts, percentages, dates, deadlines and codes that appear literally in the offer text above.",
    "If a number is not in the offer text, do not mention any number at all. Write the copy without it.",
    "",
  ].join("\n");
}

/** Shared prompt block that states the no-invention rule. */
export const NO_INVENTION_BLOCK = `
### FACT LOCK (HIGHEST PRIORITY)
- You may ONLY use numbers, amounts, percentages, multipliers, dates, deadlines, expiry times, counts and promo codes that appear LITERALLY in the offer text provided.
- Never invent, estimate, round, convert or "improve" a figure. Never add a deadline, expiry, minimum, limit, tier, level or reward that is not written in the offer text.
- If a detail is missing from the offer text, omit it entirely — write shorter copy instead of filling the gap.
- Copy codes and amounts character-for-character exactly as written.
`.trim();
