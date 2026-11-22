import { z } from "zod";
import { DomainError, MESSAGES, type FieldErrors } from "@/lib/errors";
import {
  ANSWER_FIELDS_DEFAULT,
  ANSWER_TEXT_MAX,
  ANSWERS_PER_QUESTION_MAX,
} from "@/lib/limits";

export const ANSWER_MISSING = "Skriv minst ett svar.";
export const ANSWER_TOO_LONG = `Svaret kan ha maks ${ANSWER_TEXT_MAX} tegn.`;

const INVALID = MESSAGES.INVALID_INPUT;

// One Question's raw fields in field order. An issue on field i keys as `${qid}.${i}`.
const fieldsSchema = z
  .array(
    z.string({ error: INVALID }).trim().max(ANSWER_TEXT_MAX, ANSWER_TOO_LONG),
    { error: INVALID },
  )
  .max(ANSWERS_PER_QUESTION_MAX, INVALID);

// The AD-8 Answer set, checked the same way in the browser and in collection.submit.
// Returns every Question's trimmed non-empty Answers in field order, so rank = index + 1.
export function parseAnswerSet(
  input: unknown,
  questionIds: readonly string[],
): Record<string, string[]> {
  if (typeof input !== "object" || input === null || Array.isArray(input))
    throw new DomainError("INVALID_INPUT", { answers: INVALID });
  const raw = input as Record<string, unknown>;
  const errors: FieldErrors = {};
  const answers: Record<string, string[]> = {};

  for (const key of Object.keys(raw))
    if (!questionIds.includes(key)) errors[key] = INVALID;

  for (const qid of questionIds) {
    if (!Object.hasOwn(raw, qid)) {
      errors[qid] = ANSWER_MISSING;
      continue;
    }
    const result = fieldsSchema.safeParse(raw[qid]);
    if (!result.success) {
      for (const issue of result.error.issues)
        errors[[qid, ...issue.path].join(".")] ??= issue.message;
      continue;
    }
    const given = result.data.filter((answer) => answer !== "");
    if (given.length === 0) errors[qid] = ANSWER_MISSING;
    else answers[qid] = given;
  }

  if (Object.keys(errors).length > 0)
    throw new DomainError("INVALID_INPUT", errors);
  return answers;
}

// Form state from a saved set or an untrusted stored draft: per known Question, at most
// five string fields of at most 80 characters, padded to the default two. Never throws.
export function toFields(
  set: unknown,
  questionIds: readonly string[],
): Record<string, string[]> {
  const raw =
    typeof set === "object" && set !== null
      ? (set as Record<string, unknown>)
      : {};
  return Object.fromEntries(
    questionIds.map((qid) => {
      const value = Object.hasOwn(raw, qid) ? raw[qid] : undefined;
      const given: string[] = Array.isArray(value)
        ? value
            .filter((v): v is string => typeof v === "string")
            .slice(0, ANSWERS_PER_QUESTION_MAX)
            .map((v) => v.slice(0, ANSWER_TEXT_MAX))
        : [];
      while (given.length < ANSWER_FIELDS_DEFAULT) given.push("");
      return [qid, given];
    }),
  );
}
