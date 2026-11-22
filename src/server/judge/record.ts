import { relative, resolve, sep } from "node:path";
import { z } from "zod";
import { JUDGE_TIMEOUT_MS } from "@/lib/limits";
import { normalize, NORMALIZE_VERSION } from "@/lib/normalize";
import type { Judge } from "@/server/judge/core";
import type { Ruling } from "@/server/judge/providers/replay";

const itemsOf = (answers: string[]) =>
  [...new Set(answers.map(normalize).filter(Boolean))].sort();

export const recordInputSchema = z
  .array(
    z
      .strictObject({
        question: z.string().trim().min(1),
        answers: z.array(z.string()),
      })
      .refine(
        (entry) => itemsOf(entry.answers).length > 0,
        "answers must hold a non-empty answer",
      ),
  )
  .min(1);

// One live call per entry; a JudgeError stops the whole run, so a partial file is never written.
export async function record(
  entries: z.infer<typeof recordInputSchema>,
  judge: Judge,
): Promise<Ruling[]> {
  const rulings: Ruling[] = [];
  for (const { question, answers } of entries) {
    const items = itemsOf(answers);
    const result = await judge.partition(
      { question, items },
      AbortSignal.timeout(JUDGE_TIMEOUT_MS),
    );
    rulings.push({
      kind: "partition",
      promptVersion: result.promptVersion,
      normalizeVersion: NORMALIZE_VERSION,
      model: result.model,
      question,
      items,
      assignments: result.assignments,
    });
  }
  return rulings;
}

const FIXTURES = ["data/rulings/demo.json", "data/rulings/protoqa-dev.json"];

// AD-14: rulings go under .data/, or to one of the two committed fixtures.
export function assertRecordTarget(path: string): void {
  const parts = relative(process.cwd(), resolve(path)).split(sep);
  if (FIXTURES.includes(parts.join("/"))) return;
  if (parts[0] === ".data" && parts.length > 1) return;
  throw new Error(
    `Refusing to write ${path}: output must be under .data/ or one of ${FIXTURES.join(", ")}`,
  );
}
