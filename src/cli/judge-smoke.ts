import { JUDGE_TIMEOUT_MS } from "@/lib/limits";
import { env } from "@/server/env";
import { getLiveJudge, JudgeError } from "@/server/judge";

// Synthetic: no real person and nothing from .idea/.
const QUESTION = "Nevn noe du spiser til frokost";
const ITEMS = [
  "brød",
  "brødskive",
  "egg",
  "grøt",
  "havregryn",
  "speilegg",
  "yoghurt",
].sort();

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

if (!env.OPENROUTER_API_KEY) {
  console.log("skipped: no OPENROUTER_API_KEY");
  process.exit(0);
}

const usage: unknown[] = [];
const judge = getLiveJudge((u) => usage.push(u));
const started = performance.now();
try {
  const result = await judge.partition(
    { question: QUESTION, items: ITEMS },
    AbortSignal.timeout(JUDGE_TIMEOUT_MS),
  );
  const latency = Math.round(performance.now() - started);
  if (result.source !== "live" || result.assignments.length !== ITEMS.length)
    fail(
      `Unexpected result: source ${result.source}, ${result.assignments.length} assignments for ${ITEMS.length} items.`,
    );
  const groups: string[][] = [];
  ITEMS.forEach((item, i) => (groups[result.assignments[i]] ??= []).push(item));
  console.log(`model: ${result.model}`);
  console.log(`latency: ${latency} ms`);
  console.log(`calls: ${result.calls}`);
  usage.forEach((u, i) => console.log(`usage ${i + 1}: ${JSON.stringify(u)}`));
  console.log(`groups for "${QUESTION}":`);
  for (const group of groups) console.log(`  ${group.join(", ")}`);
} catch (error) {
  fail(
    error instanceof JudgeError
      ? `The Judge failed with ${error.reason} after ${error.calls} calls${error.status ? ` (last HTTP status ${error.status})` : ""}.`
      : `judge:smoke failed: ${(error as Error).message}`,
  );
}
