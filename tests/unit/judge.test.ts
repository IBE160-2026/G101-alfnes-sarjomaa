import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { canonicalise, JudgeError } from "@/server/judge/core";
import {
  ASSIGNMENTS_SCHEMA,
  maxTokens,
  messages,
  PROMPT_VERSION,
} from "@/server/judge/prompt";
import { createMockJudge } from "@/server/judge/providers/mock";
import { createOpenRouterJudge } from "@/server/judge/providers/openrouter";
import { createReplayJudge } from "@/server/judge/providers/replay";
import {
  assertRecordTarget,
  record,
  recordInputSchema,
} from "@/server/judge/record";

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
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
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

  it("AD-13 (AC3): with a key and JUDGE_PROVIDER unset, getJudge selects openrouter with JUDGE_MODEL and PROMPT_VERSION", async () => {
    vi.stubEnv("JUDGE_PROVIDER", "");
    vi.stubEnv("OPENROUTER_API_KEY", "k");
    vi.resetModules();
    const { getJudge } = await import("@/server/judge");
    expect(getJudge().info).toEqual({
      provider: "openrouter",
      model: "deepseek/deepseek-v4.1-flash",
      promptVersion: PROMPT_VERSION,
    });
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
      model: "mock",
      promptVersion: PROMPT_VERSION,
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
      model: "fixture/model",
      promptVersion: "1",
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
      model: "fixture/model",
      promptVersion: "1",
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

  it("AD-14: when two rulings cover one item, the first file in name order wins, and the first covered item's ruling names the model and prompt version", async () => {
    const dir = tempDir();
    writeFileSync(
      join(dir, "a.json"),
      JSON.stringify([
        ruling({ items: ["hund", "katt"], assignments: [0, 0] }),
      ]),
    );
    writeFileSync(
      join(dir, "b.json"),
      JSON.stringify([
        ruling({
          items: ["ape", "katt", "mus"],
          assignments: [0, 0, 1],
          model: "other/model",
          promptVersion: "0",
        }),
      ]),
    );
    const judge = createReplayJudge({ dir });
    const result = await judge.partition(
      { question: "Nevn et dyr", items: ["hund", "katt", "mus"] },
      signal,
    );
    expect(result.assignments).toEqual([0, 0, 1]);
    expect(result).toMatchObject({
      model: "fixture/model",
      promptVersion: "1",
    });
    expect(
      await judge.partition(
        { question: "Nevn et dyr", items: ["ape", "hund"] },
        signal,
      ),
    ).toMatchObject({ model: "other/model", promptVersion: "0" });
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

describe("openrouter provider", () => {
  const INPUT = { question: "Nevn en farge", items: ["blå", "blått", "rød"] };
  const ok = (content: string, finish_reason = "stop") =>
    new Response(
      JSON.stringify({
        choices: [{ finish_reason, message: { content } }],
        usage: { prompt_tokens: 90, completion_tokens: 9 },
      }),
    );
  const status = (code: number) => new Response("{}", { status: code });
  const VALID = '{"assignments":[4,4,1]}';

  // Each response is used once, in order; "hang" waits for the signal and rejects like fetch.
  function stubFetch(...responses: (Response | Error | "hang")[]) {
    const fetch = vi.fn(async (_url: string, init: RequestInit) => {
      const next = responses.shift();
      if (next === "hang")
        return new Promise<never>((_, reject) =>
          init.signal!.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          ),
        );
      if (next instanceof Error) throw next;
      return next!;
    });
    vi.stubGlobal("fetch", fetch);
    return fetch;
  }

  const live = (options: Parameters<typeof createOpenRouterJudge>[0] = {}) =>
    createOpenRouterJudge({
      apiKey: "test-key",
      model: "test/model",
      dir: null,
      ...options,
    });

  const failure = (promise: Promise<unknown>) =>
    promise.then(
      () => "resolved",
      (e: JudgeError) => ({ reason: e.reason, calls: e.calls }),
    );

  it("AD-13 (AC1): a valid reply is canonicalised as one live call, and the request is exactly the specified POST with only the Question and its items", async () => {
    const fetch = stubFetch(ok(VALID));
    const usage: unknown[] = [];
    const judge = live({ onUsage: (u) => usage.push(u) });
    expect(judge.info).toEqual({
      provider: "openrouter",
      model: "test/model",
      promptVersion: PROMPT_VERSION,
    });
    await expect(judge.partition(INPUT, signal)).resolves.toEqual({
      assignments: [0, 0, 1],
      calls: 1,
      uncovered: 0,
      source: "live",
      model: "test/model",
      promptVersion: PROMPT_VERSION,
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({
      Authorization: "Bearer test-key",
      "Content-Type": "application/json",
    });
    expect(init.signal).toBe(signal);
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({
      model: "test/model",
      messages: messages(INPUT),
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "partition",
          strict: true,
          schema: {
            type: "object",
            properties: {
              assignments: { type: "array", items: { type: "integer" } },
            },
            required: ["assignments"],
            additionalProperties: false,
          },
        },
      },
      temperature: 0,
      max_tokens: maxTokens(3),
      provider: { require_parameters: true, data_collection: "deny" },
    });
    expect(ASSIGNMENTS_SCHEMA).toEqual(body.response_format.json_schema.schema);
    expect(body.messages.map((m: { role: string }) => m.role)).toEqual([
      "system",
      "user",
    ]);
    expect(JSON.parse(body.messages[1].content)).toEqual({
      question: INPUT.question,
      answers: INPUT.items,
    });
    expect(usage).toEqual([{ prompt_tokens: 90, completion_tokens: 9 }]);
  });

  it("AD-13 (AC1): invalid output, then valid, is retried once and counts 2 calls", async () => {
    const fetch = stubFetch(ok('{"assignments":[0]}'), ok(VALID));
    expect(await live().partition(INPUT, signal)).toMatchObject({
      assignments: [0, 0, 1],
      calls: 2,
    });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it.each([
    [
      "wrong length, then non-JSON content",
      ok('{"assignments":[0]}'),
      ok("nei"),
    ],
    ["a non-JSON body, then no content", new Response("<html>"), ok("")],
  ])(
    "AD-13 (AC1): %s is INVALID_OUTPUT after 2 calls",
    async (_, first, second) => {
      stubFetch(first, second);
      expect(await failure(live().partition(INPUT, signal))).toEqual({
        reason: "INVALID_OUTPUT",
        calls: 2,
      });
    },
  );

  it.each([429, 503])(
    "AD-13 (AC1): HTTP %i, then valid, is retried once and counts 2 calls",
    async (code) => {
      stubFetch(status(code), ok(VALID));
      expect(await live().partition(INPUT, signal)).toMatchObject({
        assignments: [0, 0, 1],
        calls: 2,
      });
    },
  );

  it("AD-13 (AC1): HTTP 500 twice is ERROR after 2 calls", async () => {
    stubFetch(status(500), status(500));
    expect(await failure(live().partition(INPUT, signal))).toEqual({
      reason: "ERROR",
      calls: 2,
    });
  });

  it.each([400, 401])(
    "AD-13 (AC1): HTTP %i is ERROR after 1 call, with no retry",
    async (code) => {
      const fetch = stubFetch(status(code), ok(VALID));
      expect(await failure(live().partition(INPUT, signal))).toEqual({
        reason: "ERROR",
        calls: 1,
      });
      expect(fetch).toHaveBeenCalledTimes(1);
    },
  );

  it("AD-13 (AC1): a network error is ERROR after 1 call, with no retry", async () => {
    const fetch = stubFetch(new TypeError("fetch failed"), ok(VALID));
    expect(await failure(live().partition(INPUT, signal))).toEqual({
      reason: "ERROR",
      calls: 1,
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("AD-13 (AC1): finish_reason content_filter is REFUSAL after 1 call, with no retry", async () => {
    const fetch = stubFetch(ok("", "content_filter"), ok(VALID));
    expect(await failure(live().partition(INPUT, signal))).toEqual({
      reason: "REFUSAL",
      calls: 1,
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("AD-13 (AC1): an abort during a call is TIMEOUT after 1 call", async () => {
    stubFetch("hang");
    const controller = new AbortController();
    const pending = failure(live().partition(INPUT, controller.signal));
    await new Promise((resolve) => setTimeout(resolve, 10));
    controller.abort();
    expect(await pending).toEqual({ reason: "TIMEOUT", calls: 1 });
  });

  it("AD-13 (AC1): an abort during the retry is TIMEOUT after 2 calls", async () => {
    stubFetch(status(503), "hang");
    const controller = new AbortController();
    const pending = failure(live().partition(INPUT, controller.signal));
    await new Promise((resolve) => setTimeout(resolve, 10));
    controller.abort();
    expect(await pending).toEqual({ reason: "TIMEOUT", calls: 2 });
  });

  it("AD-13 (AC1): an already aborted signal is TIMEOUT with 0 calls and no fetch", async () => {
    const fetch = stubFetch(ok(VALID));
    expect(await failure(live().partition(INPUT, AbortSignal.abort()))).toEqual(
      { reason: "TIMEOUT", calls: 0 },
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("AD-13, AD-14 (AC2): an exact stored ruling, even without a key, is source stored with its own model and prompt version and no fetch", async () => {
    const fetch = stubFetch(ok(VALID));
    const dir = dirWith(
      JSON.stringify([
        ruling({
          question: "Nevn en farge",
          items: INPUT.items,
          assignments: [2, 2, 0],
          promptVersion: "0",
        }),
      ]),
    );
    await expect(
      live({ dir, apiKey: "" }).partition(
        { ...INPUT, question: "nevn en FARGE!" },
        signal,
      ),
    ).resolves.toEqual({
      assignments: [0, 0, 1],
      calls: 0,
      uncovered: 0,
      source: "stored",
      model: "fixture/model",
      promptVersion: "0",
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("AD-13 (AC2): a stored ruling covering only some items gives a live call", async () => {
    const fetch = stubFetch(ok(VALID));
    const dir = dirWith(
      JSON.stringify([
        ruling({
          question: "Nevn en farge",
          items: ["blå", "blått"],
          assignments: [0, 0],
        }),
      ]),
    );
    expect(await live({ dir }).partition(INPUT, signal)).toMatchObject({
      source: "live",
      model: "test/model",
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("AD-13: no key and no exact ruling is NO_KEY with no fetch", async () => {
    const fetch = stubFetch(ok(VALID));
    expect(
      await failure(
        live({ dir: join(tempDir(), "absent"), apiKey: "" }).partition(
          INPUT,
          signal,
        ),
      ),
    ).toEqual({ reason: "NO_KEY", calls: 0 });
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("getLiveJudge", () => {
  it("AD-13 (AC5): ignores an exact stored ruling under data/rulings, calls fetch once and passes each reply's usage to onUsage", async () => {
    const cwd = tempDir();
    mkdirSync(join(cwd, "data/rulings"), { recursive: true });
    writeFileSync(join(cwd, "data/rulings/x.json"), JSON.stringify([ruling()]));
    vi.spyOn(process, "cwd").mockReturnValue(cwd);
    vi.stubEnv("OPENROUTER_API_KEY", "k");
    vi.resetModules();
    const { getLiveJudge } = await import("@/server/judge");
    const fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                finish_reason: "stop",
                message: { content: '{"assignments":[0,1]}' },
              },
            ],
            usage: { total_tokens: 12 },
          }),
        ),
    );
    vi.stubGlobal("fetch", fetch);
    const usage: unknown[] = [];
    const result = await getLiveJudge((u) => usage.push(u)).partition(
      { question: "Nevn et dyr", items: ["hund", "katt"] },
      signal,
    );
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ source: "live", assignments: [0, 1] });
    expect(usage).toEqual([{ total_tokens: 12 }]);
  });
});

describe("judge:record helpers", () => {
  it.each([
    ["an empty list", []],
    ["a missing answers list", [{ question: "Nevn et dyr" }]],
    ["an extra key", [{ question: "Nevn et dyr", answers: ["hund"], x: 1 }]],
    ["only blank answers", [{ question: "Nevn et dyr", answers: [" ", ""] }]],
    ["an empty Question", [{ question: "", answers: ["hund"] }]],
    ["a whitespace-only Question", [{ question: "   ", answers: ["hund"] }]],
  ])("AD-14 (AC5): the input schema rejects %s", (_, input) => {
    expect(recordInputSchema.safeParse(input).success).toBe(false);
  });

  it.each([
    [".data/rulings/new.json", true],
    ["./.data/x.json", true],
    ["data/rulings/demo.json", true],
    ["data/rulings/protoqa-dev.json", true],
    ["src/x.json", false],
    ["data/rulings/other.json", false],
    [".data/../x.json", false],
    [".data", false],
    [join(tmpdir(), "x.json"), false],
  ])("AD-14 (AC5): output %s is allowed: %s", (path, allowed) => {
    if (allowed) expect(() => assertRecordTarget(path)).not.toThrow();
    else expect(() => assertRecordTarget(path)).toThrow(/\.data\//);
  });

  it("AD-14 (AC5): record makes one live call per entry over its sorted distinct normalised items, and writes rulings that replay loads and replays", async () => {
    const replies = ['{"assignments":[5,5]}', '{"assignments":[1,0]}'];
    const fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            choices: [
              { finish_reason: "stop", message: { content: replies.shift() } },
            ],
          }),
        ),
    );
    vi.stubGlobal("fetch", fetch);
    const rulings = await record(
      recordInputSchema.parse([
        { question: "Nevn et dyr", answers: ["Katt", "hund!", " ", "katt"] },
        { question: "Nevn en farge", answers: ["Rød", "blå"] },
      ]),
      createOpenRouterJudge({ apiKey: "k", model: "test/model", dir: null }),
    );
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(rulings).toEqual([
      ruling({
        model: "test/model",
        promptVersion: PROMPT_VERSION,
        items: ["hund", "katt"],
        assignments: [0, 0],
      }),
      ruling({
        model: "test/model",
        promptVersion: PROMPT_VERSION,
        question: "Nevn en farge",
        items: ["blå", "rød"],
        assignments: [0, 1],
      }),
    ]);
    const dir = tempDir();
    writeFileSync(join(dir, "recorded.json"), JSON.stringify(rulings));
    await expect(
      createReplayJudge({ dir }).partition(
        { question: "Nevn et dyr", items: ["hund", "katt"] },
        signal,
      ),
    ).resolves.toMatchObject({
      assignments: [0, 0],
      source: "stored",
      model: "test/model",
    });
  });

  it("AD-14 (AC5): a JudgeError stops record with its reason", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 401 })),
    );
    await expect(
      record(
        [{ question: "Nevn et dyr", answers: ["hund"] }],
        createOpenRouterJudge({ apiKey: "k", dir: null }),
      ),
    ).rejects.toMatchObject({ reason: "ERROR", calls: 1 });
  });
});
