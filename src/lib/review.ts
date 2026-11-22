// Review's pure helpers and input schemas: Answer chips, the fallback Notice and merge (FR-17, FR-19, FR-20).
import { z } from "zod";
import { ANSWERS_PER_QUESTION_MAX, INVITE_LINKS_MAX } from "@/lib/limits";

const MERGE_IDS = "Velg minst to ulike grupper.";

// Malformed IDs are left to review.merge, which makes them NOT_FOUND (AD-5). The cap is
// the most Groups a Question can have: one per Answer.
export const mergeGroupsSchema = z.object({
  gameId: z.string(),
  groupIds: z
    .array(z.string())
    .min(2, MERGE_IDS)
    .max(INVITE_LINKS_MAX * ANSWERS_PER_QUESTION_MAX, MERGE_IDS)
    .refine((ids) => new Set(ids).size === ids.length, MERGE_IDS),
});

// Answers come in SQL order (normalized_text, then text). Equal normalised texts become
// one chip in its most common written form (ties: the first), keeping that order.
export function collapseChips(
  answers: { text: string; normalizedText: string }[],
): { text: string; n: number }[] {
  const byText = new Map<string, Map<string, number>>();
  for (const { text, normalizedText } of answers) {
    const forms = byText.get(normalizedText) ?? new Map<string, number>();
    forms.set(text, (forms.get(text) ?? 0) + 1);
    byText.set(normalizedText, forms);
  }
  return [...byText.values()].map((forms) => {
    let text = "";
    let best = 0;
    let n = 0;
    // Map keeps insertion order, so a strict > keeps the first form on a tie.
    for (const [form, count] of forms) {
      n += count;
      if (count > best) [text, best] = [form, count];
    }
    return { text, n };
  });
}

type NoticeQuestion = {
  position: number;
  reviewed: boolean;
  fallbackReason: string | null;
};

const NO_RULING = new Set(["NO_KEY", "NO_STORED_RULING"]);
const list = new Intl.ListFormat("nb", { type: "conjunction" });

// The warning Notice's text, or null when no fallback Question is left unreviewed.
export function fallbackNotice(
  questions: NoticeQuestion[],
  demo: boolean,
): string | null {
  const fell = questions.filter((q) => q.fallbackReason);
  if (!fell.some((q) => !q.reviewed)) return null;
  if (!demo && questions.every((q) => q.fallbackReason === "NO_KEY"))
    return "Ingen KI-nøkkel er satt opp, så alle spørsmålene starter med én gruppe per ulikt svar.";
  const names = (qs: NoticeQuestion[]) =>
    list.format(qs.map((q) => String(q.position)));
  const sentences: string[] = [];
  const noRuling = fell.filter((q) => NO_RULING.has(q.fallbackReason!));
  const failed = fell.filter((q) => !NO_RULING.has(q.fallbackReason!));
  if (noRuling.length)
    sentences.push(
      `Det finnes ingen lagret avgjørelse for spørsmål ${names(noRuling)}, så ${noRuling.length > 1 ? "de" : "det"} starter med én gruppe per ulikt svar.`,
    );
  if (failed.length)
    sentences.push(
      `Dommeren fikk ikke gruppert spørsmål ${names(failed)}. ${failed.length > 1 ? "De" : "Det"} starter med én gruppe per ulikt svar.`,
    );
  return sentences.join(" ");
}
