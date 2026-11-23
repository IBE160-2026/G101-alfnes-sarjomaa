import { z } from "zod";
import { bcubed } from "@/lib/bcubed";
import { JUDGE_TIMEOUT_MS } from "@/lib/limits";
import { normalize } from "@/lib/normalize";
import { JudgeError, type Judge } from "@/server/judge/core";
import { itemsOf } from "@/server/judge/record";

// AD-20: one ProtoQA row. Other keys (metadata, cluster counts) are ignored.
const rowSchema = z.object({
  question: z.object({ original: z.string().trim().min(1) }),
  answers: z.object({
    raw: z.record(z.string(), z.number().int().positive()),
    clusters: z.record(z.string(), z.object({ answers: z.array(z.string()) })),
  }),
});

export type LabelledQuestion = {
  question: string;
  items: string[];
  weights: number[];
  gold: string[];
};

// Items are built as judge:record builds them, so a recording covers every item. A raw answer
// in no cluster has no gold label and is dropped. An item's weight is its respondents, and its
// gold cluster the one holding most of that weight (on a tie, the cluster met first in the row's raw answers).
export function parseLabelled(jsonl: string): LabelledQuestion[] {
  const questions: LabelledQuestion[] = [];
  jsonl.split("\n").forEach((line, i) => {
    if (!line.trim()) return;
    // Names the line only: the content may be someone's private Answers (SM-4).
    const invalid = new Error(
      `Line ${i + 1} is not a ProtoQA row with a clustered answer.`,
    );
    let row: z.infer<typeof rowSchema>;
    try {
      row = rowSchema.parse(JSON.parse(line));
    } catch {
      throw invalid;
    }
    const clusterOf = new Map<string, string>();
    for (const [id, cluster] of Object.entries(row.answers.clusters))
      for (const answer of cluster.answers)
        if (!clusterOf.has(answer)) clusterOf.set(answer, id);
    const raw = Object.entries(row.answers.raw).filter(([answer]) =>
      clusterOf.has(answer),
    );
    const items = itemsOf(raw.map(([answer]) => answer));
    if (items.length === 0) throw invalid;
    const byItem = new Map(
      items.map((item) => [item, new Map<string, number>()]),
    );
    for (const [answer, count] of raw) {
      const clusters = byItem.get(normalize(answer));
      const id = clusterOf.get(answer)!;
      clusters?.set(id, (clusters.get(id) ?? 0) + count);
    }
    const weights: number[] = [];
    const gold: string[] = [];
    for (const clusters of byItem.values()) {
      const entries = [...clusters];
      weights.push(entries.reduce((sum, [, weight]) => sum + weight, 0));
      gold.push(
        entries.reduce((best, entry) => (entry[1] > best[1] ? entry : best))[0],
      );
    }
    questions.push({ question: row.question.original, items, weights, gold });
  });
  return questions;
}

// One partition per Question, scored as one micro-average over every respondent answer.
export async function evaluate(questions: LabelledQuestion[], judge: Judge) {
  const scored: { weight: number; gold: string; group: string }[] = [];
  const models = new Set<string>();
  const promptVersions = new Set<string>();
  let calls = 0;
  let uncovered = 0;
  let missed = 0;
  for (const [q, { question, items, weights, gold }] of questions.entries()) {
    let result;
    try {
      result = await judge.partition(
        { question, items },
        AbortSignal.timeout(JUDGE_TIMEOUT_MS),
      );
    } catch (error) {
      // A replay miss; the CLI refuses a live run without a key before any call.
      if (
        error instanceof JudgeError &&
        (error.reason === "NO_KEY" || error.reason === "NO_STORED_RULING")
      ) {
        missed++;
        continue;
      }
      throw error;
    }
    calls += result.calls;
    uncovered += result.uncovered;
    models.add(result.model);
    promptVersions.add(result.promptVersion);
    items.forEach((_, i) =>
      scored.push({
        weight: weights[i],
        gold: `${q}:${gold[i]}`,
        group: `${q}:${result.assignments[i]}`,
      }),
    );
  }
  if (missed > 0)
    throw new Error(
      `No stored ruling for ${missed} of ${questions.length} Questions; re-record with npm run judge:eval -- --live.`,
    );
  return {
    ...bcubed(scored),
    questions: questions.length,
    answers: scored.reduce((sum, item) => sum + item.weight, 0),
    calls,
    uncovered,
    models: [...models].sort(),
    promptVersions: [...promptVersions].sort(),
  };
}
