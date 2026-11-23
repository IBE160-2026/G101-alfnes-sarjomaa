import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { z } from "zod";
import { env } from "@/server/env";
import { getLiveJudge, JudgeError } from "@/server/judge";
import {
  assertRecordTarget,
  record,
  recordInputSchema,
} from "@/server/judge/record";

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const [input, output] = process.argv.slice(2);
if (!env.OPENROUTER_API_KEY)
  fail("judge:record needs OPENROUTER_API_KEY, set it in .env or .env.local.");
if (!input || !output)
  fail("Usage: npm run judge:record -- <input.json> <output.json>");
try {
  assertRecordTarget(output);
} catch (error) {
  fail((error as Error).message);
}

let entries: z.infer<typeof recordInputSchema>;
try {
  entries = recordInputSchema.parse(JSON.parse(await readFile(input, "utf8")));
} catch (error) {
  fail(
    `Invalid input ${input}: ${error instanceof z.ZodError ? z.prettifyError(error) : (error as Error).message}`,
  );
}

const started = performance.now();
try {
  const rulings = await record(
    entries,
    getLiveJudge((usage) => console.log(JSON.stringify(usage))),
  );
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(rulings, null, 2)}\n`);
  console.log(
    `Wrote ${rulings.length} rulings to ${output} in ${Math.round(performance.now() - started)} ms.`,
  );
} catch (error) {
  fail(
    error instanceof JudgeError
      ? `The Judge failed with ${error.reason} after ${error.calls} calls; nothing was written.`
      : `judge:record failed: ${(error as Error).message}`,
  );
}
