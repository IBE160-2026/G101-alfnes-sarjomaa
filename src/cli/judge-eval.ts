import { readFile, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { env } from "@/server/env";
import {
  getLiveJudge,
  getReplayJudge,
  JudgeError,
  type Judge,
} from "@/server/judge";
import { evaluate, parseLabelled } from "@/server/judge/eval";
import { PROMPT_VERSION } from "@/server/judge/prompt";
import { record } from "@/server/judge/record";

// AD-20. Prints aggregates only: never a Question or an Answer.
const DATASET = "data/protoqa/dev.crowdsourced.jsonl";
const RULINGS = "data/rulings/protoqa-dev.json";
const USAGE = "Usage: npm run judge:eval [-- --live | -- --file <path>]";

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

let options: { live?: boolean; file?: string };
try {
  options = parseArgs({
    options: { live: { type: "boolean" }, file: { type: "string" } },
  }).values;
} catch {
  fail(USAGE);
}
const { live, file } = options;
if (file === "" || (live && file !== undefined)) fail(USAGE);
if ((live || file !== undefined) && !env.OPENROUTER_API_KEY)
  fail(
    `judge:eval ${live ? "--live" : "--file"} needs OPENROUTER_API_KEY, set it in .env or .env.local.`,
  );

const input = file ?? DATASET;
let questions: ReturnType<typeof parseLabelled>;
try {
  questions = parseLabelled(await readFile(input, "utf8"));
} catch (error) {
  fail(`Invalid labelled set ${input}: ${(error as Error).message}`);
}

try {
  let liveCalls: number | undefined;
  if (live) {
    // Stored rulings carry no call count (AD-14), so the live run counts them here.
    const judge = getLiveJudge();
    let calls = 0;
    const counting: Judge = {
      info: judge.info,
      async partition(question, signal) {
        const result = await judge.partition(question, signal);
        calls += result.calls;
        return result;
      },
    };
    const rulings = await record(
      questions.map(({ question, items }) => ({ question, answers: items })),
      counting,
    );
    await writeFile(RULINGS, `${JSON.stringify(rulings, null, 2)}\n`);
    console.log(
      `Wrote ${rulings.length} rulings to ${RULINGS}; run npx prettier --write ${RULINGS} before committing.`,
    );
    liveCalls = calls;
  }

  const result = await evaluate(
    questions,
    file === undefined ? getReplayJudge() : getLiveJudge(),
  );
  if (result.uncovered > 0)
    console.error(
      `Warning: items with no stored ruling, each counted as its own Group: ${result.uncovered}; re-record with npm run judge:eval -- --live.`,
    );
  if (
    result.promptVersions.some((version) => version !== PROMPT_VERSION) ||
    result.models.some((model) => model !== env.JUDGE_MODEL)
  )
    console.error(
      `Warning: the rulings come from prompt version ${result.promptVersions.join(", ")} and model ${result.models.join(", ")}, but the current ones are prompt version ${PROMPT_VERSION} and model ${env.JUDGE_MODEL}.`,
    );

  const f1 = result.f1.toFixed(4);
  console.log(
    [
      `Data: ${file === undefined ? "ProtoQA crowdsourced dev" : "local labelled set"}`,
      `Questions: ${result.questions}`,
      `Answers scored: ${result.answers}`,
      `B-cubed precision: ${result.precision.toFixed(4)}`,
      `B-cubed recall: ${result.recall.toFixed(4)}`,
      `B-cubed F1: ${f1}`,
      `Judge calls per Question: ${((liveCalls ?? result.calls) / result.questions).toFixed(2)}`,
      `Prompt version: ${result.promptVersions.join(", ")}`,
      `Model: ${result.models.join(", ")}`,
      result.f1 >= 0.7
        ? `F1 ${f1} reaches the SM-2 bar of 0.70.`
        : `F1 ${f1} is below the SM-2 bar of 0.70.`,
      ...(file === undefined
        ? [
            "ProtoQA is English, so the figure says nothing direct about Norwegian Answers.",
          ]
        : []),
    ].join("\n"),
  );
} catch (error) {
  fail(
    error instanceof JudgeError
      ? `The Judge failed with ${error.reason} after ${error.calls} calls${live ? "; nothing was written" : ""}.`
      : (error as Error).message,
  );
}
