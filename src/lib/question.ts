import { z } from "zod";
import { QUESTION_TEXT_MAX } from "@/lib/limits";

const TEXT_LENGTH = `Spørsmålet må ha 1–${QUESTION_TEXT_MAX} tegn.`;

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

// A version-4 UUID for a new draft row. getRandomValues, because crypto.randomUUID is
// missing outside a secure context, such as the Host's page on plain http://<LAN-IP>.
export function newQuestionId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
    "",
  );
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
