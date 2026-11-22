import { z } from "zod";
import { QUESTION_TEXT_MAX } from "@/lib/limits";

const TEXT_LENGTH = "Spørsmålet må ha 1–200 tegn.";

// Malformed gameIds are left to lockForMutation, which makes them NOT_FOUND (AD-5).
export const saveQuestionSchema = z.object({
  gameId: z.string(),
  questionId: z.uuid(),
  text: z
    .string()
    .trim()
    .min(1, TEXT_LENGTH)
    .max(QUESTION_TEXT_MAX, TEXT_LENGTH),
});

export const moveQuestionSchema = z.object({
  gameId: z.string(),
  questionId: z.string(),
  direction: z.enum(["up", "down"]),
});

export const removeQuestionSchema = z.object({
  gameId: z.string(),
  questionId: z.string(),
});
