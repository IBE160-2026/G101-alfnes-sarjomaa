import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { renderToStaticMarkup } from "react-dom/server";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { GET } from "@/app/api/spill/[gameId]/rapport/route";
import { deleteGame } from "@/app/spill/[id]/actions";
import GamePage from "@/app/spill/[id]/page";
import { DomainError } from "@/lib/errors";
import { GAME_STATES, REPORT_STATES, type GameState } from "@/lib/game-state";
import { NORMALIZE_VERSION, normalize } from "@/lib/normalize";
import * as auth from "@/server/auth";
import { getDb } from "@/server/db/client";
import {
  answer,
  answerGroup,
  game,
  gameCounter,
  groupingResult,
  question,
} from "@/server/db/schema";
import * as games from "@/server/games";
import * as grouping from "@/server/grouping";
import type { Judge } from "@/server/judge";
import {
  createMockJudge,
  type MockRuling,
} from "@/server/judge/providers/mock";
import { createReplayJudge } from "@/server/judge/providers/replay";
import { cookieJar, RedirectError, run } from "./next-mocks";

vi.mock("next/headers", () =>
  import("./next-mocks").then((m) => m.nextHeaders),
);
vi.mock("next/navigation", () =>
  import("./next-mocks").then((m) => m.nextNavigation()),
);
vi.mock("next/cache", () => import("./next-mocks").then((m) => m.nextCache));

// run(gameId) keeps its signature: each test installs its Judge here.
const current = vi.hoisted(() => ({ judge: undefined as Judge | undefined }));
vi.mock("@/server/judge", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/server/judge")>();
  return { ...real, getJudge: () => current.judge ?? real.getJudge() };
});

vi.setConfig({ testTimeout: 30_000 });

const COOKIE = "toppsvar_session";
const TITLE = "Hyttetur";
const Q1 = "Nevn et dyr";
const Q2 = "Nevn en farge";
const Q3 = "Nevn en by";
const THREE: [string, string[][]][] = [
  [Q1, [["Hund"], ["katt", "hund!"], ["Ørn"]]],
  [Q2, [["Rød"], ["blå"], ["rød."]]],
  [Q3, [["Oslo"], ["Bergen"], ["Molde"]]],
];
const ZERO = {
  judgeGroupsProposed: 0,
  groupsMerged: 0,
  answersMoved: 0,
  groupsCreated: 0,
  groupsRenamed: 0,
  groupsDiscarded: 0,
  groupsRestored: 0,
  judgeCalls: 0,
  questionsFellBack: 0,
};

const tempDirs: string[] = [];
let session: string;
let hostId: string;

beforeAll(async () => {
  await auth.register({
    email: "rapport@example.test",
    password: "riktig-passord-123",
    registrationCode: "",
  });
  session = cookieJar.store.get(COOKIE)!;
  hostId = (await auth.requireHost()).hostId;
});
beforeEach(() => {
  cookieJar.store.clear();
  cookieJar.store.set(COOKIE, session);
  current.judge = undefined;
});
afterEach(() => vi.restoreAllMocks());
afterAll(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
});

const mock = (map: Record<string, MockRuling> = {}) => {
  current.judge = createMockJudge(map);
};

function emptyDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "rulings-"));
  tempDirs.push(dir);
  return dir;
}

// A Game in `state`: each Question's Answer sets, one Contributor key per set.
async function seed(
  spec: [text: string, sets: string[][]][],
  state: GameState = "grouping",
) {
  const db = await getDb();
  const [{ id: gameId }] = await db
    .insert(game)
    .values({
      hostId,
      title: TITLE,
      state,
      groupingLeaseUntil: sql`now() + interval '180 seconds'`,
    })
    .returning({ id: game.id });
  const ids = spec.map(() => randomUUID());
  if (spec.length)
    await db.insert(question).values(
      spec.map(([text], i) => ({
        id: ids[i],
        gameId,
        position: i + 1,
        text,
      })),
    );
  const rows = spec.flatMap(([, sets], i) =>
    sets.flatMap((texts) => {
      const contributorKey = randomUUID();
      return texts.map((text, r) => ({
        questionId: ids[i],
        contributorKey,
        rank: r + 1,
        text,
        normalizedText: normalize(text),
      }));
    }),
  );
  if (rows.length) await db.insert(answer).values(rows);
  return { gameId, ids };
}

// An in review Game grouped by the mock.
async function reviewed(spec = THREE, map: Record<string, MockRuling> = {}) {
  const seeded = await seed(spec);
  mock(map);
  await grouping.run(seeded.gameId);
  return seeded;
}

async function setState(gameId: string, state: GameState) {
  await (await getDb()).update(game).set({ state }).where(eq(game.id, gameId));
}

async function counterRow(gameId: string) {
  const [row] = await (
    await getDb()
  )
    .select()
    .from(gameCounter)
    .where(eq(gameCounter.gameId, gameId));
  return row;
}

const get = (gameId: string) =>
  GET(new Request(`http://localhost/api/spill/${gameId}/rapport`), {
    params: Promise.resolve({ gameId }),
  });

async function quietly<T>(fn: () => Promise<T>) {
  const write = vi
    .spyOn(process.stderr, "write")
    .mockImplementation(() => true);
  try {
    return { result: await fn(), out: write.mock.calls.map(String).join("") };
  } finally {
    write.mockRestore();
  }
}

describe("bumpCounters from Grouping", () => {
  it("FR-18 (AC1): a mock merging a and b of Q1's three items adds judge_groups_proposed 2 and judge_calls 1; a fallen-back Q2 adds questions_fell_back 1 only; the six Review counters stay 0", async () => {
    const { gameId } = await seed([
      [Q1, [["a"], ["b"], ["c"]]],
      [Q2, [["Rød"], ["blå"], ["grønn"]]],
    ]);
    mock({ [Q1]: [0, 0, 1], [Q2]: "ERROR" });
    await grouping.run(gameId);
    expect(await games.counters(gameId)).toEqual({
      ...ZERO,
      judgeGroupsProposed: 2,
      judgeCalls: 1,
      questionsFellBack: 1,
    });
  });

  it("FR-18 (AC1): a partial replay hit counts only the covered (origin = judge) Groups and the result's calls", async () => {
    const { gameId } = await seed([
      ["Nevn en frukt", [["Ananas", "eple"], ["Banan"], ["bananer", "Mango"]]],
    ]);
    const dir = emptyDir();
    writeFileSync(
      join(dir, "frukt.json"),
      JSON.stringify([
        {
          kind: "partition",
          promptVersion: "1",
          normalizeVersion: NORMALIZE_VERSION,
          model: "fixture/model",
          question: "Nevn en frukt",
          items: ["banan", "bananer", "eple"],
          assignments: [0, 0, 1],
        },
      ]),
    );
    current.judge = createReplayJudge({ dir, hasKey: false });
    await grouping.run(gameId);
    expect(await games.counters(gameId)).toEqual({
      ...ZERO,
      judgeGroupsProposed: 2,
      judgeCalls: 0,
    });
  });

  it("FR-18, AD-12, AD-17 (AC1): with game_counter gone the bump fails inside the Question's transaction, run rejects with INTERNAL, logs one content-free line, and no Group, group_id or result is written", async () => {
    const { gameId, ids } = await seed(THREE);
    mock();
    const db = await getDb();
    await db.execute(
      sql.raw("alter table game_counter rename to game_counter_x"),
    );
    let error: unknown, out: string;
    try {
      ({ result: error, out } = await quietly(() =>
        grouping.run(gameId).catch((e: unknown) => e),
      ));
    } finally {
      await db.execute(
        sql.raw("alter table game_counter_x rename to game_counter"),
      );
    }
    expect(error).toBeInstanceOf(DomainError);
    expect((error as DomainError).code).toBe("INTERNAL");
    expect(out).toBe(
      `${JSON.stringify({ module: "grouping", op: "run", code: "INTERNAL", sqlstate: "42P01" })}\n`,
    );
    for (const text of [
      Q1,
      Q2,
      Q3,
      ...THREE.flatMap(([, sets]) => sets.flat()),
    ])
      expect(out).not.toContain(text);
    expect(
      await db
        .select()
        .from(answerGroup)
        .where(inArray(answerGroup.questionId, ids)),
    ).toEqual([]);
    expect(
      await db
        .select()
        .from(groupingResult)
        .where(inArray(groupingResult.questionId, ids)),
    ).toEqual([]);
    expect(
      await db
        .select({ id: answer.id })
        .from(answer)
        .where(and(inArray(answer.questionId, ids), isNotNull(answer.groupId))),
    ).toEqual([]);
  });

  it("FR-18, AD-12 (AC1): a Question whose result is stored while its partition runs is skipped in the transaction and adds nothing; the other Question still counts", async () => {
    const { gameId, ids } = await seed([
      [Q1, [["a"], ["b"], ["c"]]],
      [Q2, [["Rød"], ["blå"], ["grønn"]]],
    ]);
    const inner = createMockJudge({ [Q1]: [0, 0, 1] });
    current.judge = {
      info: inner.info,
      async partition(input, signal) {
        // Another run finishes Q1 first, so this one finds it done after the lock.
        if (input.question === Q1)
          await (await getDb()).insert(groupingResult).values({
            questionId: ids[0],
            source: "fallback",
            promptVersion: inner.info.promptVersion,
            normalizeVersion: NORMALIZE_VERSION,
            modelId: "mock",
            judgeCalls: 0,
            uncoveredItems: 0,
            fellBack: true,
            fallbackReason: "NO_KEY",
          });
        return inner.partition(input, signal);
      },
    };
    await grouping.run(gameId);
    expect(await games.counters(gameId)).toEqual({
      ...ZERO,
      judgeGroupsProposed: 3,
      judgeCalls: 1,
    });
  });
});

describe("bumpCounters", () => {
  it("FR-18, AD-18 (AC1): two bumps in one transaction add through the existing row, and a Review counter bumps like the rest", async () => {
    const { gameId } = await seed([], "in_review");
    await (
      await getDb()
    ).transaction(async (tx) => {
      await games.bumpCounters(tx, gameId, {
        groupsMerged: 2,
        answersMoved: 1,
      });
      await games.bumpCounters(tx, gameId, {
        groupsMerged: 2,
        answersMoved: 1,
      });
      await games.bumpCounters(tx, gameId, { groupsRestored: 1 });
    });
    expect(await games.counters(gameId)).toEqual({
      ...ZERO,
      groupsMerged: 4,
      answersMoved: 2,
      groupsRestored: 1,
    });
  });
});

describe("GET /api/spill/[gameId]/rapport", () => {
  it("FR-18, FR-12 (AC2): in review the owner gets 200 as an attachment, exactly the counters and per-Question source, fell_back, origin and edit_count, and no Answer, label, key, id, title or Question text", async () => {
    const { gameId, ids } = await reviewed(THREE, {
      [Q1]: [0, 0, 1],
      [Q2]: "ERROR",
    });
    const response = await get(gameId);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="toppsvar-bruksrapport.json"',
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
    const text = await response.text();
    const body = JSON.parse(text);
    expect(body).toEqual({
      counters: {
        ...ZERO,
        judgeGroupsProposed: 5,
        judgeCalls: 2,
        questionsFellBack: 1,
      },
      questions: [
        {
          position: 1,
          source: "judge",
          fellBack: false,
          groups: [
            { origin: "judge", editCount: 0 },
            { origin: "judge", editCount: 0 },
          ],
        },
        {
          position: 2,
          source: "fallback",
          fellBack: true,
          groups: [
            { origin: "fallback", editCount: 0 },
            { origin: "fallback", editCount: 0 },
          ],
        },
        {
          position: 3,
          source: "judge",
          fellBack: false,
          groups: Array(3).fill({ origin: "judge", editCount: 0 }),
        },
      ],
    });
    const db = await getDb();
    const answers = await db
      .select()
      .from(answer)
      .where(inArray(answer.questionId, ids));
    const groups = await db
      .select({ id: answerGroup.id })
      .from(answerGroup)
      .where(inArray(answerGroup.questionId, ids));
    const forbidden = [
      TITLE,
      Q1,
      Q2,
      Q3,
      gameId,
      ...ids,
      ...answers.flatMap((a) => [a.text, a.normalizedText, a.contributorKey!]),
      ...groups.map((g) => g.id),
      "ERROR",
    ];
    for (const value of forbidden) expect(text).not.toContain(value);
  });

  it("FR-18 (AC2): the Groups of a Question come in their random id order", async () => {
    const { gameId, ids } = await reviewed([[Q1, [["a"], ["b"], ["c"]]]]);
    const db = await getDb();
    await db
      .update(answerGroup)
      .set({ editCount: sql`(random() * 100)::int` })
      .where(eq(answerGroup.questionId, ids[0]));
    const expected = await db
      .select({ origin: answerGroup.origin, editCount: answerGroup.editCount })
      .from(answerGroup)
      .where(eq(answerGroup.questionId, ids[0]))
      .orderBy(answerGroup.id);
    const body = await (await get(gameId)).json();
    expect(body.questions[0].groups).toEqual(expected);
  });

  it.each(["ready", "playing", "played"] as const)(
    "FR-18 (AC2): in %s the owner gets 200",
    async (state) => {
      const { gameId } = await reviewed([[Q1, [["a"], ["b"], ["c"]]]]);
      await setState(gameId, state);
      const response = await get(gameId);
      expect(response.status).toBe(200);
      expect((await response.json()).questions).toHaveLength(1);
    },
  );

  it.each(["draft", "collecting", "grouping"] as const)(
    "FR-18, AD-4 (AC2): in %s it is 409 WRONG_STATE",
    async (state) => {
      const { gameId } = await seed([], state);
      const response = await get(gameId);
      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({
        code: "WRONG_STATE",
        message: "Spillet er i en annen fase nå. Last inn siden på nytt.",
      });
    },
  );

  it("FR-18 (AC2): an in review Game that never bumped reports all nine counters 0", async () => {
    const { gameId } = await seed([], "in_review");
    expect(await counterRow(gameId)).toBeUndefined();
    const response = await get(gameId);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ counters: ZERO, questions: [] });
  });

  it("FR-1, AD-5: logged out it redirects to /logg-inn", async () => {
    const { gameId } = await seed([], "in_review");
    cookieJar.store.clear();
    const error = await get(gameId).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RedirectError);
    expect((error as RedirectError).url).toBe("/logg-inn");
  });

  it("FR-18, AD-17: with game_counter gone it is 500 INTERNAL and one log line with only module, op, code and sqlstate", async () => {
    const { gameId } = await seed([], "in_review");
    const db = await getDb();
    await db.execute(
      sql.raw("alter table game_counter rename to game_counter_x"),
    );
    let response, out;
    try {
      ({ result: response, out } = await quietly(() => get(gameId)));
    } finally {
      await db.execute(
        sql.raw("alter table game_counter_x rename to game_counter"),
      );
    }
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      code: "INTERNAL",
      message: "Noe gikk galt hos oss. Prøv igjen om litt.",
    });
    expect(out).toBe(
      `${JSON.stringify({ module: "games", op: "counters", code: "INTERNAL", sqlstate: "42P01" })}\n`,
    );
  });
});

describe("delete", () => {
  it("FR-18, FR-3 (AC3): deleting a Game with a counter row removes the row", async () => {
    const { gameId } = await reviewed([[Q1, [["a"], ["b"], ["c"]]]]);
    expect(await counterRow(gameId)).toBeDefined();
    expect(await run(deleteGame, { gameId })).toEqual({ redirect: "/spill" });
    expect(await counterRow(gameId)).toBeUndefined();
  });

  it("FR-18, FR-3 (AC3): the retention purge removes an expired Game's counter row", async () => {
    const { gameId } = await reviewed([[Q1, [["a"], ["b"], ["c"]]]]);
    expect(await counterRow(gameId)).toBeDefined();
    await (
      await getDb()
    )
      .update(game)
      .set({ updatedAt: new Date("2020-01-01T00:00:00Z") })
      .where(eq(game.id, gameId));
    await games.purgeExpired();
    expect(await counterRow(gameId)).toBeUndefined();
  });
});

describe("Game page", () => {
  it.each(GAME_STATES)(
    'FR-18, UX-DR16 (AC4): in %s "Last ned bruksrapport" is a link to the report only from in review onward',
    async (state) => {
      const { gameId } = await seed([], state);
      const html = renderToStaticMarkup(
        await GamePage({
          params: Promise.resolve({ id: gameId }),
          searchParams: Promise.resolve({}),
        }),
      );
      const link = new RegExp(
        `<a href="/api/spill/${gameId}/rapport"[^>]*>Last ned bruksrapport</a>`,
      );
      if (REPORT_STATES.includes(state)) {
        expect(html).toMatch(link);
        expect(html).not.toMatch(/<a[^>]*download/);
      } else expect(html).not.toContain("Last ned bruksrapport");
    },
  );
});
