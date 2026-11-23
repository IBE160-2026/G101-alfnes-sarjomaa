// Review's pure helpers and input schemas: Answer chips, the fallback Notice, merge,
// move, rename, discard, restore, marking and locking (FR-16, FR-17, FR-19 to FR-21).
import { z } from "zod";
import {
  ANSWERS_PER_QUESTION_MAX,
  INVITE_LINKS_MAX,
  LABEL_MAX,
} from "@/lib/limits";

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

const MOVE_IDS = "Velg minst ett svar.";

// No groupId means a new Group. The cap is every Answer a Question can have.
export const moveAnswersSchema = z.object({
  gameId: z.string(),
  answerIds: z
    .array(z.string())
    .min(1, MOVE_IDS)
    .max(INVITE_LINKS_MAX * ANSWERS_PER_QUESTION_MAX, MOVE_IDS)
    .refine((ids) => new Set(ids).size === ids.length, MOVE_IDS),
  groupId: z.string().optional(),
});

export const renameGroupSchema = z.object({
  gameId: z.string(),
  groupId: z.string(),
  label: z
    .string()
    .trim()
    .min(1, "Skriv et navn.")
    .max(LABEL_MAX, `Navnet kan ha maks ${LABEL_MAX} tegn.`),
});

// Discard and restore name one Group; malformed IDs are NOT_FOUND in the module (AD-5).
export const groupRefSchema = z.object({
  gameId: z.string(),
  groupId: z.string(),
});

// FR-21: marks or unmarks one Question; a malformed questionId is NOT_FOUND in the module.
export const markReviewedSchema = z.object({
  gameId: z.string(),
  questionId: z.string(),
  reviewed: z.boolean(),
});

export const confirmBoardSchema = z.object({ gameId: z.string() });

// Answers come in SQL order (normalized_text, then text). Equal normalised texts become
// one chip in its most common written form (ties: the first), keeping that order.
// A chip carries its Answers' IDs, so ticking it selects all of them (UX-DR11).
export function collapseChips(
  answers: { id: string; text: string; normalizedText: string }[],
): { text: string; n: number; ids: string[] }[] {
  type Chip = { forms: Map<string, number>; ids: string[] };
  const byText = new Map<string, Chip>();
  for (const { id, text, normalizedText } of answers) {
    const chip: Chip = byText.get(normalizedText) ?? {
      forms: new Map(),
      ids: [],
    };
    chip.forms.set(text, (chip.forms.get(text) ?? 0) + 1);
    chip.ids.push(id);
    byText.set(normalizedText, chip);
  }
  return [...byText.values()].map(({ forms, ids }) => {
    let text = "";
    let best = 0;
    // Map keeps insertion order, so a strict > keeps the first form on a tie.
    for (const [form, count] of forms)
      if (count > best) [text, best] = [form, count];
    return { text, n: ids.length, ids };
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
