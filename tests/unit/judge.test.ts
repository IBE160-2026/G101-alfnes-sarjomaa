import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { canonicalise, JudgeError } from "@/server/judge/core";
import { createMockJudge } from "@/server/judge/providers/mock";
import { createReplayJudge } from "@/server/judge/providers/replay";

const FIXTURES = join(process.cwd(), "tests/fixtures/rulings");
const signal = new AbortController().signal;

const reasonOf = (promise: Promise<unknown>) =>
  promise.then(
    () => "resolved",
    (e: unknown) => (e instanceof JudgeError ? e.reason : e),
  );

const ruling = (overrides: Record<string, unknown> = {}) => ({
  kind: "partition",
  promptVersion: "1",
  normalizeVersion: 1,
  model: "fixture/model",
  question: "Nevn et dyr",
  items: ["hund", "katt"],
  assignments: [0, 1],
  ...overrides,
});

const tempDirs: string[] = [];

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "rulings-"));
  tempDirs.push(dir);
  return dir;
}

function dirWith(content: string): string {
  const dir = tempDir();
  writeFileSync(join(dir, "bad.json"), content);
  return dir;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

afterAll(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
});

describe("getJudge", () => {
  it.each([
    ["mock", "mock"],
    ["replay", "replay"],
    ["", "replay"],
  ])(
    "AD-13: JUDGE_PROVIDER=%j with no key selects %s",
    async (value, provider) => {
      vi.stubEnv("JUDGE_PROVIDER", value);
      vi.resetModules();
      const { getJudge } = await import("@/server/judge");
      expect(getJudge().info.provider).toBe(provider);
    },
  );

  it("AD-13: with a key and JUDGE_PROVIDER unset, replay runs until Story 4.4 and a miss is NO_STORED_RULING", async () => {
    vi.stubEnv("JUDGE_PROVIDER", "");
    vi.stubEnv("OPENROUTER_API_KEY", "k");
    vi.resetModules();
    const { getJudge } = await import("@/server/judge");
    const judge = getJudge();
    expect(judge.info.provider).toBe("replay");
    // resetModules loaded a second JudgeError class, so match on the reason.
    await expect(
      judge.partition({ question: "Nevn en by", items: ["oslo"] }, signal),
    ).rejects.toMatchObject({ reason: "NO_STORED_RULING" });
  });
});

describe("canonicalise", () => {
  it("AD-13: valid output is renumbered in first-occurrence order", () => {
    expect(canonicalise([5, 5, 2, 7, 2], 5)).toEqual([0, 0, 1, 2, 1]);
  });

  it.each([
    ["wrong length", [0, 1], 3],
    ["a fraction", [0, 1.5, 0], 3],
    ["a string", [0, "1", 0], 3],
    ["NaN", [NaN, 0, 0], 3],
    ["a sparse array", [0, , 1], 3],
    ["not an array", { assignments: [0] }, 1],
  ])("AD-13: %s is INVALID_OUTPUT", (_, raw, length) => {
    expect(() => canonicalise(raw, length)).toThrow(
      expect.objectContaining({ reason: "INVALID_OUTPUT" }),
    );
  });
});

describe("mock provider", () => {
  it("NFR-3: a supplied map is canonicalised and reported as one live call", async () => {
    const judge = createMockJudge({ "Nevn en farge": [3, 3, 1] });
    expect(judge.info).toMatchObject({ provider: "mock", model: "mock" });
    await expect(
      judge.partition(
        { question: "Nevn en farge", items: ["blå", "blått", "rød"] },
        signal,
      ),
    ).resolves.toEqual({
      assignments: [0, 0, 1],
      calls: 1,
      uncovered: 0,
      source: "live",
    });
  });

  it("NFR-3: a Question not in the map gets one cluster per item", async () => {
    const result = await createMockJudge().partition(
      { question: "Nevn en farge", items: ["blå", "grønn", "rød"] },
      signal,
    );
    expect(result.assignments).toEqual([0, 1, 2]);
  });

  it.each([[[0, 1]], [[0, 1.5, 0]]])(
    "AD-13: mapped output %j is INVALID_OUTPUT",
    async (raw) => {
      const judge = createMockJudge({ "Nevn en farge": raw });
      expect(
        await reasonOf(
          judge.partition(
            { question: "Nevn en farge", items: ["blå", "grønn", "rød"] },
            signal,
          ),
        ),
      ).toBe("INVALID_OUTPUT");
    },
  );

  it.each([
    "NO_KEY",
    "NO_STORED_RULING",
    "ERROR",
    "REFUSAL",
    "INVALID_OUTPUT",
  ] as const)(
    "AD-13: a mapped %s throws a JudgeError with that reason",
    async (reason) => {
      const judge = createMockJudge({ "Nevn en farge": reason });
      expect(
        await reasonOf(
          judge.partition(
            { question: "Nevn en farge", items: ["blå"] },
            signal,
          ),
        ),
      ).toBe(reason);
    },
  );

  it("AD-13: a mapped TIMEOUT throws only once the signal aborts, and a mapped Error is thrown as is", async () => {
    const controller = new AbortController();
    const boom = new Error("boom");
    const judge = createMockJudge({
      "Nevn en farge": "TIMEOUT",
      "Nevn en by": boom,
    });
    let settled = false;
    const pending = reasonOf(
      judge.partition(
        { question: "Nevn en farge", items: ["blå"] },
        controller.signal,
      ),
    ).finally(() => (settled = true));
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(settled).toBe(false);
    controller.abort();
    expect(await pending).toBe("TIMEOUT");
    expect(
      await reasonOf(
        judge.partition({ question: "Nevn en by", items: ["oslo"] }, signal),
      ),
    ).toBe(boom);
  });
});

describe("replay provider", () => {
  const replay = (hasKey = false) =>
    createReplayJudge({ dir: FIXTURES, hasKey });

  it("FR-15: a full hit returns the stored clusters with no call, despite case, spacing and trailing punctuation", async () => {
    const judge = replay();
    expect(judge.info).toMatchObject({ provider: "replay", model: "replay" });
    await expect(
      judge.partition(
        {
          question: "  NEVN noe   du tar med på stranda!",
          items: ["håndkle", "solkrem", "solkrem faktor 30"],
        },
        signal,
      ),
    ).resolves.toEqual({
      assignments: [0, 1, 1],
      calls: 0,
      uncovered: 0,
      source: "stored",
    });
  });

  it("FR-17: uncovered items become singletons numbered after the covered clusters", async () => {
    await expect(
      replay().partition(
        {
          question: "Nevn en frukt",
          items: ["banan", "bananer", "drue", "eple", "melon"],
        },
        signal,
      ),
    ).resolves.toEqual({
      assignments: [0, 0, 2, 1, 3],
      calls: 0,
      uncovered: 2,
      source: "stored",
    });
  });

  it("AD-14: clusters from two rulings for one Question never merge", async () => {
    // banan and pære both have stored cluster 1, in different files.
    const result = await replay().partition(
      { question: "Nevn en frukt", items: ["banan", "pære", "pærer"] },
      signal,
    );
    expect(result.assignments).toEqual([0, 1, 1]);
  });

  it("AD-14: when two rulings cover one item, the first file in name order wins", async () => {
    const dir = tempDir();
    writeFileSync(
      join(dir, "a.json"),
      JSON.stringify([
        ruling({ items: ["hund", "katt"], assignments: [0, 0] }),
      ]),
    );
    writeFileSync(
      join(dir, "b.json"),
      JSON.stringify([ruling({ items: ["katt", "mus"], assignments: [0, 1] })]),
    );
    const result = await createReplayJudge({ dir }).partition(
      { question: "Nevn et dyr", items: ["hund", "katt", "mus"] },
      signal,
    );
    expect(result.assignments).toEqual([0, 0, 1]);
  });

  it.each([
    [false, "NO_KEY"],
    [true, "NO_STORED_RULING"],
  ])("FR-17: a miss with hasKey=%s is %s", async (hasKey, reason) => {
    const judge = replay(hasKey);
    expect(
      await reasonOf(
        judge.partition({ question: "Nevn en by", items: ["oslo"] }, signal),
      ),
    ).toBe(reason);
    expect(
      await reasonOf(
        judge.partition({ question: "Nevn en frukt", items: ["drue"] }, signal),
      ),
    ).toBe(reason);
  });

  it("FR-17: a missing rulings directory is a miss", async () => {
    const judge = createReplayJudge({
      dir: join(tempDir(), "absent"),
    });
    expect(
      await reasonOf(
        judge.partition({ question: "Nevn et dyr", items: ["hund"] }, signal),
      ),
    ).toBe("NO_KEY");
  });

  it("AD-14: a ruling from another normalize version does not match", async () => {
    const dir = dirWith(JSON.stringify([ruling({ normalizeVersion: 2 })]));
    expect(
      await reasonOf(
        createReplayJudge({ dir }).partition(
          { question: "Nevn et dyr", items: ["hund", "katt"] },
          signal,
        ),
      ),
    ).toBe("NO_KEY");
  });

  it.each([
    ["bad JSON", "["],
    ["not an array", JSON.stringify(ruling())],
    ["wrong kind", JSON.stringify([ruling({ kind: "match" })])],
    ["unsorted items", JSON.stringify([ruling({ items: ["katt", "hund"] })])],
    ["duplicate items", JSON.stringify([ruling({ items: ["hund", "hund"] })])],
    ["length mismatch", JSON.stringify([ruling({ assignments: [0] })])],
    [
      "non-integer assignment",
      JSON.stringify([ruling({ assignments: [0, 0.5] })]),
    ],
    ["extra key", JSON.stringify([ruling({ extra: true })])],
    [
      "non-normalised item",
      JSON.stringify([ruling({ items: ["Hund", "katt"] })]),
    ],
  ])(
    "AD-14: a file with %s fails with an Error naming it",
    async (_, content) => {
      const error = await reasonOf(
        createReplayJudge({ dir: dirWith(content) }).partition(
          { question: "Nevn et dyr", items: ["hund"] },
          signal,
        ),
      );
      expect(error).toBeInstanceOf(Error);
      expect(error).not.toBeInstanceOf(JudgeError);
      expect((error as Error).message).toMatch(/bad\.json/);
    },
  );
});
