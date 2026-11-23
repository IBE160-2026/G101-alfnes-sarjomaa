import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { env } from "@/server/env";
import { evaluate, parseLabelled } from "@/server/judge/eval";
import { NORMALIZE_VERSION } from "@/lib/normalize";
import { PROMPT_VERSION } from "@/server/judge/prompt";
import { createMockJudge } from "@/server/judge/providers/mock";

const ROOT = resolve(".");
const temp = mkdtempSync(join(tmpdir(), "judge-eval-"));
afterAll(() => rmSync(temp, { recursive: true, force: true }));

// Preloaded into the CLI: any socket fails the run, and so does any fetch unless FAKE_OPENROUTER
// names a stand-in for the OpenRouter endpoint, so a green run made no network call. Every reply
// groups answers by first letter. "retry": the first request gets a 500, so that Question costs
// two calls. "half": the first Question is answered and every other one gets invalid output.
// "down": every request gets a 500.
const preload = join(temp, "fake-openrouter.mjs");
writeFileSync(
  preload,
  `import net from "node:net";
net.Socket.prototype.connect = () => { throw new Error("network blocked"); };
const mode = process.env.FAKE_OPENROUTER;
let requests = 0;
let first;
globalThis.fetch = (url, init) => {
  if (!mode || !String(url).startsWith("https://openrouter.ai/")) throw new Error("network blocked");
  return reply(init);
};
async function reply(init) {
  if (mode === "down" || (mode === "retry" && requests++ === 0)) return new Response("busy", { status: 500 });
  const { question, answers } = JSON.parse(JSON.parse(init.body).messages[1].content);
  first ??= question;
  const content = mode === "half" && question !== first ? "not json" : JSON.stringify({ assignments: answers.map((a) => a.charCodeAt(0)) });
  return Response.json({ choices: [{ finish_reason: "stop", message: { content } }] });
}
`,
);

type Fake = "retry" | "half" | "down";

// No --env-file flag, so a developer's .env or .env.local is never read here. The script and
// tsconfig are absolute, so the CLI can run in a temporary working directory with its own data.
function cli(cwd: string, key: string, ...args: string[]) {
  return run(undefined, cwd, key, ...args);
}

function run(
  fake: Fake | undefined,
  cwd: string,
  key: string,
  ...args: string[]
) {
  return spawnSync(
    join(ROOT, "node_modules/.bin/tsx"),
    [
      "--tsconfig",
      join(ROOT, "tsconfig.json"),
      "--conditions=react-server",
      join(ROOT, "src/cli/judge-eval.ts"),
      ...args,
    ],
    {
      cwd,
      encoding: "utf8",
      env: {
        ...process.env,
        OPENROUTER_API_KEY: key,
        FAKE_OPENROUTER: fake ?? "",
        NODE_OPTIONS: `--import=${pathToFileURL(preload).href}`,
      },
      timeout: 30_000,
    },
  );
}

// Invented rows in ProtoQA's format. "na" is in no cluster; "pear" (1) and "Pear." (2) share an
// item but sit in different clusters, so the item's gold cluster is f.3.
const FRUIT = "Name a fruit you eat in winter.";
const BEACH = "Name something you take to the beach.";
const row = (
  question: string,
  raw: Record<string, number>,
  clusters: Record<string, string[]>,
) =>
  JSON.stringify({
    metadata: { id: "x" },
    question: { original: question, normalized: question.toLowerCase() },
    answers: {
      raw,
      clusters: Object.fromEntries(
        Object.entries(clusters).map(([id, answers]) => [
          id,
          {
            count: answers.reduce((sum, answer) => sum + raw[answer], 0),
            answers,
          },
        ]),
      ),
    },
  });
const FRUIT_ROW = row(
  FRUIT,
  { Apple: 2, "apple ": 1, banana: 3, Bananas: 1, pear: 1, "Pear.": 2, na: 4 },
  {
    "f.0": ["Apple", "apple "],
    "f.1": ["banana", "Bananas"],
    "f.2": ["pear"],
    "f.3": ["Pear."],
  },
);
const BEACH_ROW = row(
  BEACH,
  { towel: 4, sunscreen: 2, "sun cream": 1 },
  { "b.0": ["towel"], "b.1": ["sunscreen", "sun cream"] },
);
const TINY = `${FRUIT_ROW}\n${BEACH_ROW}\n`;

const ruling = (question: string, items: string[], assignments: number[]) => ({
  kind: "partition",
  promptVersion: PROMPT_VERSION,
  normalizeVersion: NORMALIZE_VERSION,
  model: env.JUDGE_MODEL,
  question,
  items,
  assignments,
});

function workdir(name: string, rulings?: unknown[]) {
  const dir = join(temp, name);
  mkdirSync(join(dir, "data/protoqa"), { recursive: true });
  writeFileSync(join(dir, "data/protoqa/dev.crowdsourced.jsonl"), TINY);
  if (rulings) {
    mkdirSync(join(dir, "data/rulings"));
    if (rulings.length === 0) return dir;
    writeFileSync(
      join(dir, "data/rulings/protoqa-dev.json"),
      JSON.stringify(rulings),
    );
  }
  return dir;
}

describe("parseLabelled", () => {
  it("FR-32: builds sorted normalised items, sums each item's respondents, takes the majority gold cluster and drops unclustered answers", () => {
    expect(parseLabelled(TINY)).toEqual([
      {
        question: FRUIT,
        items: ["apple", "banana", "bananas", "pear"],
        weights: [3, 3, 1, 3],
        gold: ["f.0", "f.1", "f.1", "f.3"],
      },
      {
        question: BEACH,
        items: ["sun cream", "sunscreen", "towel"],
        weights: [1, 2, 4],
        gold: ["b.1", "b.1", "b.0"],
      },
    ]);
  });

  it("FR-32: a bad line is named by its number, never by its content", () => {
    for (const [input, line] of [
      [`${FRUIT_ROW}\n\nSecret answer {`, 3],
      [`${JSON.stringify({ question: { original: "Secret question" } })}`, 1],
      [row("Secret question", { secret: 1 }, {}), 1],
    ] as const) {
      expect(() => parseLabelled(input)).toThrow(
        `Line ${line} is not a ProtoQA row with a clustered answer.`,
      );
      try {
        parseLabelled(input);
      } catch (error) {
        expect((error as Error).message).not.toMatch(/secret/i);
      }
    }
  });
});

describe("evaluate", () => {
  it("FR-32: scores a labelled set with the Judge as one micro-average over every answer, with calls and versions (the --file path)", async () => {
    const result = await evaluate(
      parseLabelled(TINY),
      // apple with pear; the beach Question is unknown to the mock, so every item is alone.
      createMockJudge({ [FRUIT]: [0, 1, 1, 0] }),
    );
    expect(result.precision).toBeCloseTo(14 / 17, 12);
    expect(result.recall).toBeCloseTo(47 / 51, 12);
    expect(result.f1).toBeCloseTo(1316 / 1513, 12);
    expect(result).toMatchObject({
      questions: 2,
      answers: 17,
      calls: 2,
      uncovered: 0,
      models: ["mock"],
      promptVersions: [PROMPT_VERSION],
    });
  });
});

describe("npm run judge:eval", () => {
  it("FR-32 (AC2): with no key, replays the committed rulings offline, prints the pinned aggregates, the fallback and the 0.70 line, and exits 0", () => {
    const { status, stdout, stderr } = cli(ROOT, "");
    expect(stdout).toBe(
      [
        "Data: ProtoQA crowdsourced dev",
        "Questions: 52",
        "Answers scored: 4887",
        "B-cubed precision: 0.9809",
        "B-cubed recall: 0.5261",
        "B-cubed F1: 0.6849",
        "Judge calls per Question: 0.00",
        `Prompt version: ${PROMPT_VERSION}`,
        `Model: ${env.JUDGE_MODEL}, fallback: INVALID_OUTPUT`,
        "F1 0.6849 is below the SM-2 bar of 0.70.",
        "ProtoQA is English, so the figure says nothing direct about Norwegian Answers.",
        "",
      ].join("\n"),
    );
    expect(stderr).toBe("");
    expect(status).toBe(0);
  });

  it.each(["--live", "--file"])(
    "FR-32 (AC3): without a key %s refuses with exit 1 and names OPENROUTER_API_KEY, reading and writing nothing",
    (flag) => {
      const dir = join(temp, `refuse${flag}`);
      mkdirSync(dir);
      const args = flag === "--file" ? [flag, "absent.jsonl"] : [flag];
      const { status, stdout, stderr } = cli(dir, "", ...args);
      expect(stderr).toMatch(/OPENROUTER_API_KEY/);
      expect(stderr).not.toMatch(/absent|ENOENT/);
      expect(stdout).toBe("");
      expect(status).toBe(1);
      expect(readdirSync(dir)).toEqual([]);
    },
  );

  it.each([["--foo"], ["extra"], ["--live", "--file", "x.jsonl"], ["--file"]])(
    "FR-32: the arguments %s give the usage line and exit 1",
    (...args) => {
      const { status, stdout, stderr } = cli(temp, "x", ...args);
      expect(stderr.trim()).toBe(
        "Usage: npm run judge:eval [-- --live | -- --file <path>]",
      );
      expect(stdout).toBe("");
      expect(status).toBe(1);
    },
  );

  it("FR-32: with no stored ruling for some Questions it exits 1 naming the count, never a Question or an item", () => {
    const absent = cli(workdir("absent"), "");
    expect(absent.stderr.trim()).toBe(
      "No stored ruling for 2 of 2 Questions; re-record with npm run judge:eval -- --live.",
    );
    expect(absent.stdout).toBe("");
    expect(absent.status).toBe(1);

    // With a key, replay reports a miss as NO_STORED_RULING rather than NO_KEY; same message.
    const absentWithKey = cli(workdir("absent-with-key"), "x");
    expect(absentWithKey.stderr.trim()).toBe(absent.stderr.trim());
    expect(absentWithKey.status).toBe(1);

    const oneMissing = cli(
      workdir("one-missing", [
        ruling(BEACH, ["sun cream", "sunscreen", "towel"], [0, 0, 1]),
      ]),
      "",
    );
    expect(oneMissing.stderr.trim()).toBe(
      "No stored ruling for 1 of 2 Questions; re-record with npm run judge:eval -- --live.",
    );
    expect(oneMissing.stdout).toBe("");
    expect(oneMissing.status).toBe(1);
  });

  it("FR-32: rulings that cover part of a Question score the uncovered items alone and warn with their count", () => {
    const { status, stdout, stderr } = cli(
      workdir("partial", [
        // "pear" is not covered, so it is its own Group.
        ruling(FRUIT, ["apple", "banana", "bananas"], [0, 1, 1]),
        ruling(BEACH, ["sun cream", "sunscreen", "towel"], [0, 0, 0]),
      ]),
      "",
    );
    expect(stderr).toBe(
      "Warning: items with no stored ruling, each counted as its own Group: 1; re-record with npm run judge:eval -- --live.\n",
    );
    // Precision (10 + 25/7) / 17 = 95/119, recall 1, F1 95/107.
    expect(stdout).toContain(
      [
        "Questions: 2",
        "Answers scored: 17",
        "B-cubed precision: 0.7983",
        "B-cubed recall: 1.0000",
        "B-cubed F1: 0.8879",
        "Judge calls per Question: 0.00",
        `Prompt version: ${PROMPT_VERSION}`,
        `Model: ${env.JUDGE_MODEL}`,
        "F1 0.8879 reaches the SM-2 bar of 0.70.",
      ].join("\n"),
    );
    expect(stdout).not.toMatch(/fruit|beach|apple|banana|pear|towel|sun/i);
    expect(status).toBe(0);
  });
  it("FR-32 (AC3): --live with a key records one ruling per Question, writes the rulings file, replays it and reports the live calls", () => {
    const dir = workdir("live", []);
    const { status, stdout, stderr } = run("retry", dir, "x", "--live");
    expect(stderr).toBe("");
    expect(stdout).toBe(
      [
        "Wrote 2 rulings to data/rulings/protoqa-dev.json; run npx prettier --write data/rulings/protoqa-dev.json before committing.",
        "Data: ProtoQA crowdsourced dev",
        "Questions: 2",
        "Answers scored: 17",
        "B-cubed precision: 1.0000",
        "B-cubed recall: 1.0000",
        "B-cubed F1: 1.0000",
        "Judge calls per Question: 1.50",
        `Prompt version: ${PROMPT_VERSION}`,
        `Model: ${env.JUDGE_MODEL}`,
        "F1 1.0000 reaches the SM-2 bar of 0.70.",
        "ProtoQA is English, so the figure says nothing direct about Norwegian Answers.",
        "",
      ].join("\n"),
    );
    expect(status).toBe(0);
    expect(
      JSON.parse(
        readFileSync(join(dir, "data/rulings/protoqa-dev.json"), "utf8"),
      ),
    ).toEqual([
      ruling(FRUIT, ["apple", "banana", "bananas", "pear"], [0, 1, 1, 2]),
      ruling(BEACH, ["sun cream", "sunscreen", "towel"], [0, 0, 1]),
    ]);
  });

  it("FR-32 (AC3): --file with a key scores the local set with the live Judge, prints aggregates only and writes nothing", () => {
    const dir = join(temp, "file");
    mkdirSync(dir);
    writeFileSync(join(dir, "local.jsonl"), TINY);
    const { status, stdout, stderr } = run(
      "retry",
      dir,
      "x",
      "--file",
      "local.jsonl",
    );
    expect(stderr).toBe("");
    expect(stdout).toBe(
      [
        "Data: local labelled set",
        "Questions: 2",
        "Answers scored: 17",
        "B-cubed precision: 1.0000",
        "B-cubed recall: 1.0000",
        "B-cubed F1: 1.0000",
        "Judge calls per Question: 1.50",
        `Prompt version: ${PROMPT_VERSION}`,
        `Model: ${env.JUDGE_MODEL}`,
        "F1 1.0000 reaches the SM-2 bar of 0.70.",
        "",
      ].join("\n"),
    );
    expect(status).toBe(0);
    expect(readdirSync(dir)).toEqual(["local.jsonl"]);
  });
  it("FR-32: rulings whose model differs from JUDGE_MODEL, with the same prompt version, still warn", () => {
    const { status, stderr } = cli(
      workdir("model-drift", [
        {
          ...ruling(
            FRUIT,
            ["apple", "banana", "bananas", "pear"],
            [0, 1, 1, 2],
          ),
          model: "other/model",
        },
        {
          ...ruling(BEACH, ["sun cream", "sunscreen", "towel"], [0, 0, 1]),
          model: "other/model",
        },
      ]),
      "",
    );
    expect(stderr).toBe(
      `Warning: the rulings come from prompt version ${PROMPT_VERSION} and model other/model, but the current ones are prompt version ${PROMPT_VERSION} and model ${env.JUDGE_MODEL}.\n`,
    );
    expect(status).toBe(0);
  });

  it("FR-32 (AC2): rulings from another prompt version, with the current model, warn", () => {
    const { status, stderr } = cli(
      workdir("prompt-drift", [
        {
          ...ruling(
            FRUIT,
            ["apple", "banana", "bananas", "pear"],
            [0, 1, 1, 2],
          ),
          promptVersion: "0",
        },
        {
          ...ruling(BEACH, ["sun cream", "sunscreen", "towel"], [0, 0, 1]),
          promptVersion: "0",
        },
      ]),
      "",
    );
    expect(stderr).toBe(
      `Warning: the rulings come from prompt version 0 and model ${env.JUDGE_MODEL}, but the current ones are prompt version ${PROMPT_VERSION} and model ${env.JUDGE_MODEL}.\n`,
    );
    expect(status).toBe(0);
  });

  it("FR-32 (AC3), FR-17: --file where the Judge fails on one Question scores it as one Group per item, counts its calls and reports the fallback as --live does", () => {
    const dir = join(temp, "file-half");
    mkdirSync(dir);
    writeFileSync(join(dir, "local.jsonl"), TINY);
    const { status, stdout, stderr } = run(
      "half",
      dir,
      "x",
      "--file",
      "local.jsonl",
    );
    expect(stderr).toBe("");
    // The beach items stand alone: recall (10 + 1/3 + 4/3 + 4) / 17 = 47/51, F1 47/49.
    expect(stdout).toBe(
      [
        "Questions that fell back to one Group per item: 1 (INVALID_OUTPUT).",
        "Data: local labelled set",
        "Questions: 2",
        "Answers scored: 17",
        "B-cubed precision: 1.0000",
        "B-cubed recall: 0.9216",
        "B-cubed F1: 0.9592",
        "Judge calls per Question: 1.50",
        `Prompt version: ${PROMPT_VERSION}`,
        `Model: ${env.JUDGE_MODEL}, fallback: INVALID_OUTPUT`,
        "F1 0.9592 reaches the SM-2 bar of 0.70.",
        "",
      ].join("\n"),
    );
    expect(status).toBe(0);
    expect(readdirSync(dir)).toEqual(["local.jsonl"]);
  });

  it("FR-32 (AC3): --file where the Judge fails on every Question exits 1 with the reason and gives no figure", () => {
    const dir = join(temp, "file-down");
    mkdirSync(dir);
    writeFileSync(join(dir, "local.jsonl"), TINY);
    const { status, stdout, stderr } = run(
      "down",
      dir,
      "x",
      "--file",
      "local.jsonl",
    );
    expect(stderr.trim()).toBe("The Judge failed with ERROR after 2 calls.");
    expect(stdout).toBe("");
    expect(status).toBe(1);
  });

  it("FR-32 (AC3), FR-17: a --live run where the Judge fails on one Question stores it as one Group per item with the reason as its model, records the others and reports the fallback", () => {
    const dir = workdir("live-half", []);
    const { status, stdout, stderr } = run("half", dir, "x", "--live");
    expect(stderr).toBe("");
    expect(status).toBe(0);
    expect(stdout).toContain(
      "Wrote 2 rulings to data/rulings/protoqa-dev.json; run npx prettier --write data/rulings/protoqa-dev.json before committing.\nQuestions that fell back to one Group per item: 1 (INVALID_OUTPUT).\n",
    );
    expect(stdout).toContain(
      `Model: ${env.JUDGE_MODEL}, fallback: INVALID_OUTPUT\n`,
    );
    // One call for the first Question and two (a retry) for the one that fell back.
    expect(stdout).toContain("Judge calls per Question: 1.50\n");
    const rulings = JSON.parse(
      readFileSync(join(dir, "data/rulings/protoqa-dev.json"), "utf8"),
    );
    expect(rulings).toHaveLength(2);
    expect(rulings[1].model).toBe("fallback: INVALID_OUTPUT");
    expect(rulings[1].assignments).toEqual(
      rulings[1].items.map((_: string, i: number) => i),
    );
  });

  it("FR-32 (AC3): a --live run whose Judge fails exits 1 and leaves the existing rulings file unchanged", () => {
    const dir = workdir("live-down", [
      ruling(BEACH, ["sun cream", "sunscreen", "towel"], [0, 0, 1]),
    ]);
    const file = join(dir, "data/rulings/protoqa-dev.json");
    const before = readFileSync(file, "utf8");
    const { status, stdout, stderr } = run("down", dir, "x", "--live");
    expect(stderr.trim()).toBe(
      "The Judge failed with ERROR after 2 calls; nothing was written.",
    );
    expect(stdout).toBe("");
    expect(status).toBe(1);
    expect(readFileSync(file, "utf8")).toBe(before);
  });
});
