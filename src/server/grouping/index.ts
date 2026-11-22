import "server-only";
import type { Tx } from "@/server/db/client";
import { answer } from "@/server/db/schema";

export type AnswerRow = Omit<typeof answer.$inferInsert, "id">;

// The only writer of `answer` (AD-1, AD-9). Rows go in exactly as given, so the caller's
// shuffle is the physical order; ids come from gen_random_uuid().
export async function insertAnswers(tx: Tx, rows: AnswerRow[]): Promise<void> {
  if (rows.length === 0) return;
  await tx.insert(answer).values(rows);
}
