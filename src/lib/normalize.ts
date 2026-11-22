// The FR-17 rule, stored at close as answer.normalized_text (AD-12). Bump the version
// whenever the rule changes. Stored rulings and grouping_result record it (AD-12, AD-14).
export const NORMALIZE_VERSION = 1;

// toLowerCase(), not toLocaleLowerCase(), so the result never depends on the server locale.
export function normalize(text: string): string {
  const lower = text.normalize("NFC").toLowerCase().trim();
  const result = lower.replace(/\s+/g, " ").replace(/[\s.,!?;:…]+$/u, "");
  return result || lower;
}
