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

// Remembers the last non-2xx status and the start of its body, so a wrong key, a wrong
// JUDGE_MODEL or an unsupported parameter can be told apart. Never the request or its headers.
let httpError: string | undefined;
const realFetch = globalThis.fetch;
globalThis.fetch = async (...args) => {
  const response = await realFetch(...args);
  if (!response.ok)
    httpError = `HTTP ${response.status}: ${(await response.clone().text()).slice(0, 300)}`;
  return response;
};

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
  if (httpError) console.error(httpError);
  fail(
    error instanceof JudgeError
      ? `The Judge failed with ${error.reason} after ${error.calls} calls.`
      : `judge:smoke failed: ${(error as Error).message}`,
  );
}
