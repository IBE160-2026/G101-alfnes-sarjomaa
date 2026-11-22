import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { asc, eq, sql } from "drizzle-orm";
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
import { mergeGroups } from "@/app/spill/[id]/actions";
import ReviewPage from "@/app/spill/[id]/gjennomgang/page";
import GamePage from "@/app/spill/[id]/page";
import { DomainError } from "@/lib/errors";
import type { GameState } from "@/lib/game-state";
import { normalize } from "@/lib/normalize";
import * as auth from "@/server/auth";
import { getDb } from "@/server/db/client";
import { answer, answerGroup, game, question } from "@/server/db/schema";
import { env } from "@/server/env";
import * as games from "@/server/games";
import * as grouping from "@/server/grouping";
import type { Judge } from "@/server/judge";
import {
  createMockJudge,
  type MockRuling,
} from "@/server/judge/providers/mock";
import { createReplayJudge } from "@/server/judge/providers/replay";
import * as review from "@/server/review";
import { cookieJar, nextCache, RedirectError } from "./next-mocks";

vi.mock("next/headers", () =>
  import("./next-mocks").then((m) => m.nextHeaders),
);
vi.mock("next/navigation", () =>
  import("./next-mocks").then((m) => m.nextNavigation()),
);
vi.mock("next/cache", () => import("./next-mocks").then((m) => m.nextCache));

const current = vi.hoisted(() => ({ judge: undefined as Judge | undefined }));
vi.mock("@/server/judge", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/server/judge")>();
  return { ...real, getJudge: () => current.judge ?? real.getJudge() };
});

// The real counter writer, watched, so a test can make it fail after the merge's writes.
vi.mock("@/server/games", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/server/games")>();
  return { ...real, bumpCounters: vi.fn(real.bumpCounters) };
});

vi.setConfig({ testTimeout: 30_000 });

const COOKIE = "toppsvar_session";
const Q1 = "Hvem kommer for sent?";
const Q2 = "Hva sier verten?";
const Q3 = "Nevn en by";
const NO_KEY =
  "Ingen KI-nøkkel er satt opp, så alle spørsmålene starter med én gruppe per ulikt svar.";
const tempDirs: string[] = [];
let session: string;
let hostId: string;

beforeAll(async () => {
  await auth.register({
    email: "gjennomgang@example.test",
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

type Spec = [text: string, sets: string[][]][];

// A grouping Game with one Contributor key per Answer set, then grouped by `judge`.
async function reviewGame(spec: Spec, judge: Judge = createMockJudge()) {
  const db = await getDb();
  const [{ id: gameId }] = await db
    .insert(game)
    .values({
      hostId,
      title: "Hyttetur",
      state: "grouping",
      groupingLeaseUntil: sql`now() + interval '180 seconds'`,
    })
    .returning({ id: game.id });
  const ids = spec.map(() => randomUUID());
  await db
    .insert(question)
    .values(
      spec.map(([text], i) => ({ id: ids[i], gameId, position: i + 1, text })),
    );
  await db.insert(answer).values(
    spec.flatMap(([, sets], i) =>
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
    ),
  );
  current.judge = judge;
  await grouping.run(gameId);
  return { gameId, ids };
}

const mock = (map: Record<string, MockRuling>) => createMockJudge(map);

function emptyDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "rulings-"));
  tempDirs.push(dir);
  return dir;
}

async function render(id: string, q?: string) {
  return renderToStaticMarkup(
    await ReviewPage({
      params: Promise.resolve({ id }),
      searchParams: Promise.resolve(q === undefined ? {} : { q }),
    }),
  );
}

// The visible text, tags dropped, so assertions read like the screen.
const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ");

async function groupIdOf(questionId: string, normalizedText: string) {
  const [row] = await (
    await getDb()
  )
    .select({ id: answer.groupId })
    .from(answer)
    .where(
      sql`${answer.questionId} = ${questionId} and ${answer.normalizedText} = ${normalizedText}`,
    );
  return row.id!;
}

// Kari/Ola merged by the mock; Per alone. Q2 ties on Count, so rank-1 count decides.
const TWO: Spec = [
  [Q1, [["Kari", "Ola"], ["kari", "Per"], ["Ola", "Kari"], ["Per"]]],
  [Q2, [["zzz", "aaa"], ["zzz", "aaa"], ["mmm"]]],
];

describe("review.load", () => {
  it("FR-19, FR-12, FR-16 (AC2): returns the Questions and the current Question's Groups with SQL Counts and alphabetical chips, and nothing that holds a Contributor key or rank", async () => {
    const { gameId, ids } = await reviewGame(TWO, mock({ [Q1]: [0, 0, 1] }));
    const data = await review.load(hostId, gameId);
    const kari = await groupIdOf(ids[0], "kari");
    const per = await groupIdOf(ids[0], "per");
    expect(data).toEqual({
      title: "Hyttetur",
      questions: [
        {
          id: ids[0],
          position: 1,
          text: Q1,
          reviewed: false,
          fallbackReason: null,
        },
        {
          id: ids[1],
          position: 2,
          text: Q2,
          reviewed: false,
          fallbackReason: null,
        },
      ],
      current: {
        position: 1,
        board: [
          // Three sets wrote kari or ola: Count 3, though five Answers.
          {
            id: kari,
            label: "kari",
            count: 3,
            chips: [
              { text: "Kari", n: 3 },
              { text: "Ola", n: 2 },
            ],
          },
          { id: per, label: "per", count: 2, chips: [{ text: "Per", n: 2 }] },
        ],
        below: [],
        discarded: [],
      },
    });
    // Every Answer of the Question sits under exactly one Group.
    const answers = await (
      await getDb()
    )
      .select()
      .from(answer)
      .where(eq(answer.questionId, ids[0]));
    const perGroup = (rows: [string, string, number][]) => {
      const out: Record<string, Record<string, number>> = {};
      for (const [g, t, n] of rows) {
        out[g] ??= {};
        out[g][t] = (out[g][t] ?? 0) + n;
      }
      return out;
    };
    const { board, below, discarded } = data.current;
    expect(
      perGroup(
        [...board, ...below, ...discarded].flatMap((g) =>
          g.chips.map((c): [string, string, number] => [
            g.id,
            normalize(c.text),
            c.n,
          ]),
        ),
      ),
    ).toEqual(perGroup(answers.map((a) => [a.groupId!, a.normalizedText, 1])));
    // Keys, not values: an Answer such as "Frank" must not trip the check.
    const keys: string[] = [];
    const json = JSON.stringify(data, (key, value: unknown) => {
      keys.push(key);
      return value;
    });
    expect(keys.filter((k) => /contributor|rank/i.test(k))).toEqual([]);
    for (const a of answers) expect(json).not.toContain(a.contributorKey!);
  });

  it("FR-16, FR-19 (AC2): with equal Counts the Group with more rank-1 Answers ranks first, before label order", async () => {
    const { gameId } = await reviewGame(TWO);
    const { current } = await review.load(hostId, gameId, 2);
    expect(current.position).toBe(2);
    expect(current.board.map((g) => [g.label, g.count])).toEqual([
      ["zzz", 2],
      ["aaa", 2],
      ["mmm", 1],
    ]);
  });

  it("FR-19: a bad position falls back to the first unreviewed Question, else the first", async () => {
    const spec: Spec = [Q1, Q2, Q3].map((t) => [t, [["a"], ["b"], ["c"]]]);
    const { gameId, ids } = await reviewGame(spec);
    const db = await getDb();
    await db
      .update(question)
      .set({ reviewed: true })
      .where(eq(question.id, ids[0]));
    for (const position of [undefined, NaN, 99, 0])
      expect(
        (await review.load(hostId, gameId, position)).current.position,
      ).toBe(2);
    expect((await review.load(hostId, gameId, 1)).current.position).toBe(1);
    await db
      .update(question)
      .set({ reviewed: true })
      .where(eq(question.gameId, gameId));
    expect((await review.load(hostId, gameId, 99)).current.position).toBe(1);
  });

  it.each(["draft", "collecting", "grouping", "ready", "playing", "played"])(
    "FR-19, UX-DR17 (AC5): a Game in %s is WRONG_STATE, and the page redirects to the Game page",
    async (state) => {
      const { gameId } = await reviewGame([[Q1, [["a"], ["b"], ["c"]]]]);
      const db = await getDb();
      await db
        .update(game)
        .set({ state: state as GameState })
        .where(eq(game.id, gameId));
      const error = await review.load(hostId, gameId).catch((e: unknown) => e);
      expect((error as DomainError).code).toBe("WRONG_STATE");
      const redirect = await render(gameId).catch((e: unknown) => e);
      expect(redirect).toBeInstanceOf(RedirectError);
      expect((redirect as RedirectError).url).toBe(`/spill/${gameId}`);
    },
  );
});

describe("Review page", () => {
  const NINE: Spec = [
    [
      Q1,
      [
        ["Kari", "Ola", "Per"],
        ["Anne", "Bjørn", "Cato"],
        ["Dina", "Erik", "Frida"],
      ],
    ],
  ];

  it("FR-19, UX-DR10, UX-DR11 (AC3): nine Groups give eight on the Board, the divider and one dashed Ikke på brettet card, all as compact rows", async () => {
    const { gameId, ids } = await reviewGame(NINE);
    const html = await render(gameId);
    const screen = text(html);
    // FR-12: no Contributor key reaches the rendered page.
    const keys = await (
      await getDb()
    )
      .select({ key: answer.contributorKey })
      .from(answer)
      .where(eq(answer.questionId, ids[0]));
    expect(keys).toHaveLength(9);
    for (const { key } of keys) expect(html).not.toContain(key!);
    expect(screen).toContain("Mine spill › Hyttetur › Gjennomgang");
    expect(html.match(/<h1[ >]/g)).toHaveLength(1);
    expect(html).toMatch(/<h1 class="sr-only">Gjennomgang<\/h1>/);
    expect(screen).toContain("0 av 1 gjennomgått");
    expect(screen).toContain("Spørsmål 1 av 1");
    expect(html).toMatch(/<h3[^>]*>På brettet \(8 grupper\)<\/h3>/);
    expect(html).toMatch(/<h3[^>]*>Ikke på brettet \(1 gruppe\)<\/h3>/);
    expect(screen).toContain("Alt under streken vises ikke i spillet");
    expect(screen).toContain(
      "Vises ikke i spillet. Slå dem sammen med en gruppe over for at de skal telle.",
    );
    expect(html).not.toContain("Forkastet");
    // The rank-1 Answers (Anne, Dina, Kari) lead, then the nb collator; Per is ninth.
    const labels = [...html.matchAll(/<h4[^>]*>([^<]*)<\/h4>/g)].map(
      (m) => m[1],
    );
    expect(labels).toEqual([
      "anne",
      "dina",
      "kari",
      "bjørn",
      "cato",
      "erik",
      "frida",
      "ola",
      "per",
    ]);
    // One chip each: compact 52 px rows with no chip list; the ninth is dashed.
    expect(html.match(/min-h-13/g)).toHaveLength(9);
    expect(html.match(/border-dashed/g)).toHaveLength(1);
    // The raw written form follows the normalised label (FR-19).
    expect(screen).toMatch(/9\. per Per 1 person/);
    expect(screen).toContain("1 person");
    expect(html).not.toMatch(/sikker|terskel|prosent|%|confidence/i);
  });

  it("FR-19, UX-DR11 (AC3): three Groups show På brettet (3 grupper) with no divider or Ikke på brettet", async () => {
    const { gameId } = await reviewGame([[Q1, [["a"], ["b"], ["c"]]]]);
    const html = await render(gameId);
    expect(html).toMatch(/<h3[^>]*>På brettet \(3 grupper\)<\/h3>/);
    expect(html).not.toContain("Alt under streken");
    expect(html).not.toContain("Ikke på brettet");
  });

  it("FR-19, FR-13 (AC3): a multi-chip card collapses Kari, kari, Kari into one chip with 3 svar, chips alphabetical, and Count in personer", async () => {
    const { gameId } = await reviewGame(
      [[Q1, [["Ola", "Kari"], ["kari"], ["Kari", "Bo"]]]],
      mock({ [Q1]: [0, 0, 0] }),
    );
    const html = await render(gameId);
    const screen = text(html);
    expect(screen).toContain("1. kari 3 personer");
    expect(screen).toMatch(/Bo Kari · 3 svar Ola/);
    expect(html).not.toContain("min-h-13");
  });

  it("FR-19, FR-20 (AC3): a discarded Group sits under Forkastet with a struck label and plain Answers, never on the Board; a custom label ranks and shows as itself", async () => {
    const { gameId, ids } = await reviewGame([
      [Q1, [["Kari", "Ola"], ["Per"], ["Anne"]]],
    ]);
    const db = await getDb();
    await db
      .update(answerGroup)
      .set({ discarded: true })
      .where(eq(answerGroup.id, await groupIdOf(ids[0], "kari")));
    await db
      .update(answerGroup)
      .set({ customLabel: "Alle per" })
      .where(eq(answerGroup.id, await groupIdOf(ids[0], "per")));
    const html = await render(gameId);
    const screen = text(html);
    expect(html).toMatch(/<h3[^>]*>Forkastet \(1 gruppe\)<\/h3>/);
    expect(html).toMatch(/<h4 [^>]*class="[^"]*line-through[^"]*">kari<\/h4>/);
    expect(html).toMatch(/<h3[^>]*>På brettet \(3 grupper\)<\/h3>/);
    // Per's rename sorts before anne ("aa" would be å in nb); its raw Answer follows the label.
    expect(screen).toMatch(/1\. Alle per Per 1 person 2\. anne/);
    expect(screen).toMatch(/3\. ola Ola 1 person/);
    expect(html.indexOf(">kari</h4>")).toBeGreaterThan(
      html.indexOf("Forkastet"),
    );
    // The Forkastet card lists its raw Answer as plain text, never as a compact row.
    const forkastet = html.slice(html.indexOf(">Forkastet"));
    expect(forkastet).toContain('<li class="break-words">Kari</li>');
    expect(forkastet).not.toContain("min-h-13");
  });

  it("FR-19, FR-13 (AC3): a one-chip Group of Kari, kari, Kari is a compact row showing the label kari, then Kari · 3 svar", async () => {
    const { gameId } = await reviewGame(
      [[Q1, [["Kari"], ["kari"], ["Kari"]]]],
      createReplayJudge({ dir: emptyDir(), hasKey: false }),
    );
    const html = await render(gameId);
    expect(text(html)).toContain("1. kari Kari · 3 svar 3 personer");
    expect(html.match(/min-h-13/g)).toHaveLength(1);
  });

  it("FR-19, FR-20 (AC3): a singleton renamed to its own raw Answer shows it once", async () => {
    const { gameId, ids } = await reviewGame([[Q1, [["Per"], ["a"], ["b"]]]]);
    await (
      await getDb()
    )
      .update(answerGroup)
      .set({ customLabel: "Per" })
      .where(eq(answerGroup.id, await groupIdOf(ids[0], "per")));
    const screen = text(await render(gameId));
    expect(screen).toMatch(/\d\. Per 1 person/);
    expect(screen).not.toContain("Per Per");
  });

  it("FR-21, UX-DR17 (AC5): Lås brettet and Marker som gjennomgått are aria-disabled, the reason tied to the button by aria-describedby", async () => {
    const { gameId } = await reviewGame(
      [Q1, Q2, Q3].map((t) => [t, [["a"], ["b"], ["c"]]]),
    );
    const html = await render(gameId);
    for (const id of ["las-grunn-rail", "las-grunn-fot"]) {
      expect(html).toMatch(
        new RegExp(
          `<button[^>]*aria-disabled="true"[^>]*aria-describedby="${id}"[^>]*>.*?Lås brettet`,
        ),
      );
      expect(html).toContain(
        `<p id="${id}" class="mt-2 text-body-sm">Gjennomgå alle spørsmålene først (3 igjen).</p>`,
      );
    }
    expect(html).toMatch(
      /<button[^>]*aria-disabled="true"[^>]*>.*?Marker som gjennomgått/,
    );
    // The narrow-screen select names each Question's review state; the form only GETs.
    expect(html).toMatch(
      /<form [^>]*action="\/spill\/[^"]+\/gjennomgang" method="get"/,
    );
    expect(text(html)).toContain("Spørsmål 2 av 3 – Ikke gjennomgått");
    expect(html).not.toMatch(/onchange/i);
    // The rail's lock sits after its nav landmark, not inside it.
    const navStart = html.indexOf('<nav aria-label="Spørsmål"');
    const rail = html.slice(navStart, html.indexOf("</nav>", navStart));
    expect(rail).toContain("gjennomgått");
    expect(rail).not.toContain("Lås brettet");
    expect(html.indexOf("las-grunn-rail")).toBeGreaterThan(navStart);
  });

  it("FR-19, UX-DR10 (AC3): the rail marks the current Question, shows ✓ Gjennomgått and Manuell, and keeps Ikke gjennomgått for screen readers only", async () => {
    const { gameId, ids } = await reviewGame(
      [Q1, Q2, Q3].map((t) => [t, [["a"], ["b"], ["c"]]]),
      mock({ [Q3]: "ERROR" }),
    );
    await (
      await getDb()
    )
      .update(question)
      .set({ reviewed: true })
      .where(eq(question.id, ids[0]));
    const html = await render(gameId, "2");
    expect(html).toMatch(
      /aria-current="page"[^>]*>.*?2<\/span> Hva sier verten\?/,
    );
    expect(html.match(/aria-current="page"/g)).toHaveLength(2); // breadcrumb + rail
    expect(text(html)).toContain("1 av 3 gjennomgått");
    expect(html).toContain('<span aria-hidden="true">✓</span> Gjennomgått');
    expect(
      html.match(/<span class="sr-only"> Ikke gjennomgått<\/span>/g),
    ).toHaveLength(2);
    expect(html.match(/> Manuell</g)).toHaveLength(1);
    expect(html).toContain(`title="${Q1}"`);
    // The narrow-screen select starts on the current Question.
    expect(html).toContain('<option value="2" selected="">');
    // A reviewed Question's header shows the mark and "Neste spørsmål" instead of the button.
    const first = await render(gameId, "1");
    expect(first).not.toContain("Marker som gjennomgått");
    expect(first).toMatch(
      new RegExp(
        `<a class="[^"]*" href="/spill/${gameId}/gjennomgang\\?q=2">Neste spørsmål</a>`,
      ),
    );
  });
});

describe("fallback Notice on the page", () => {
  const spec = (n: number): Spec =>
    [Q1, Q2, Q3].slice(0, n).map((t) => [t, [["a"], ["b"], ["c"]]]);

  it("FR-17 (AC4): replay with no key and no rulings shows the key sentence", async () => {
    const { gameId } = await reviewGame(
      spec(3),
      createReplayJudge({ dir: emptyDir(), hasKey: false }),
    );
    expect(text(await render(gameId))).toContain(NO_KEY);
  });

  it("FR-17 (AC4): replay with a key but no stored ruling names the Questions", async () => {
    const { gameId } = await reviewGame(
      spec(2),
      createReplayJudge({ dir: emptyDir(), hasKey: true }),
    );
    const screen = text(await render(gameId));
    expect(screen).toContain(
      "Det finnes ingen lagret avgjørelse for spørsmål 1 og 2, så de starter med én gruppe per ulikt svar.",
    );
    expect(screen).not.toContain("KI-nøkkel");
  });

  it("FR-17 (AC4): a Judge failure on one Question names it", async () => {
    const { gameId } = await reviewGame(spec(3), mock({ [Q2]: "REFUSAL" }));
    expect(text(await render(gameId))).toContain(
      "Dommeren fikk ikke gruppert spørsmål 2. Det starter med én gruppe per ulikt svar.",
    );
  });

  it("FR-17, FR-31 (AC4): in Demo mode NO_KEY uses the no-stored-ruling wording, never the key sentence", async () => {
    const { gameId } = await reviewGame(
      spec(2),
      createReplayJudge({ dir: emptyDir(), hasKey: false }),
    );
    const saved = env.DEMO_MODE;
    env.DEMO_MODE = true;
    try {
      const screen = text(await render(gameId));
      expect(screen).toContain(
        "Det finnes ingen lagret avgjørelse for spørsmål 1 og 2, så de starter med én gruppe per ulikt svar.",
      );
      expect(screen).not.toContain("KI-nøkkel");
    } finally {
      env.DEMO_MODE = saved;
    }
  });

  it("FR-17 (AC4): with every Question grouped by the Judge there is no warning Notice", async () => {
    const { gameId } = await reviewGame(spec(2));
    const html = await render(gameId);
    expect(html).not.toContain("bg-warning-soft");
    expect(html).not.toContain("starter med én gruppe per ulikt svar");
  });
});

describe("Game page in review", () => {
  it("FR-19, UX-DR17 (AC5): shows the primary link Gå til gjennomgangen to the Review page", async () => {
    const { gameId } = await reviewGame([[Q1, [["a"], ["b"], ["c"]]]]);
    const html = renderToStaticMarkup(
      await GamePage({
        params: Promise.resolve({ id: gameId }),
        searchParams: Promise.resolve({}),
      }),
    );
    expect(html).toMatch(
      new RegExp(
        `<a class="[^"]*bg-primary[^"]*" href="/spill/${gameId}/gjennomgang">Gå til gjennomgangen</a>`,
      ),
    );
  });
});

describe("review.merge", () => {
  // Kari: three keys (1, 2, 3). Ola: two keys (1, 4), one shared with Kari.
  const SHARED: Spec = [
    [Q1, [["Kari", "Ola"], ["Kari"], ["kari"], ["Ola"]]],
    [Q2, [["a"], ["b"], ["c"], ["d"]]],
  ];

  // Everything a merge may write: Answers, Groups, the reviewed marks and the counters.
  async function snapshot(gameId: string, questionIds: string[]) {
    const db = await getDb();
    const rows = [];
    for (const id of questionIds)
      rows.push({
        answers: await db
          .select({ id: answer.id, groupId: answer.groupId })
          .from(answer)
          .where(eq(answer.questionId, id))
          .orderBy(asc(answer.id)),
        groups: await db
          .select()
          .from(answerGroup)
          .where(eq(answerGroup.questionId, id))
          .orderBy(asc(answerGroup.id)),
        reviewed: (
          await db
            .select({ reviewed: question.reviewed })
            .from(question)
            .where(eq(question.id, id))
        )[0].reviewed,
      });
    return { rows, counters: await games.counters(gameId) };
  }

  const groupRow = async (id: string) =>
    (
      await (
        await getDb()
      )
        .select()
        .from(answerGroup)
        .where(eq(answerGroup.id, id))
    )[0];

  it("FR-20, AD-11, AD-15 (AC1): a shared Contributor key gives a Count below the sum; the highest-ranked source keeps its ID and frozen label, every Answer moves to it, the other is deleted, reviewed is cleared, edit_count and groups_merged go up by one", async () => {
    const { gameId, ids } = await reviewGame(SHARED);
    const kari = await groupIdOf(ids[0], "kari");
    const ola = await groupIdOf(ids[0], "ola");
    const db = await getDb();
    await db
      .update(question)
      .set({ reviewed: true })
      .where(eq(question.id, ids[0]));
    const answersBefore = (await snapshot(gameId, [ids[0]])).rows[0].answers;

    // Lowest-ranked first: the order of the IDs does not pick the target.
    const result = await review.merge(hostId, {
      gameId,
      groupIds: [ola, kari],
    });

    expect(result).toEqual({
      groupId: kari,
      label: "kari",
      count: 4,
      position: 1,
    });
    expect(result.count).toBeLessThan(3 + 2);
    const { rows, counters } = await snapshot(gameId, [ids[0]]);
    expect(rows[0].groups).toEqual([
      expect.objectContaining({ id: kari, customLabel: "kari", editCount: 1 }),
    ]);
    expect(await groupRow(ola)).toBeUndefined();
    expect(rows[0].answers).toEqual(
      answersBefore.map((a) => ({ ...a, groupId: kari })),
    );
    expect(rows[0].reviewed).toBe(false);
    expect(counters.groupsMerged).toBe(1);
    const { current } = await review.load(hostId, gameId, 1);
    expect(current.board).toEqual([
      {
        id: kari,
        label: "kari",
        count: 4,
        chips: [
          { text: "Kari", n: 3 },
          { text: "Ola", n: 2 },
        ],
      },
    ]);
  });

  it("FR-20, FR-18 (AC1): merging three Groups through the action leaves one, counts two in groups_merged, bumps edit_count once and refreshes the Game and Review pages", async () => {
    const { gameId, ids } = await reviewGame(SHARED);
    const groupIds = await Promise.all(
      ["a", "b", "c"].map((t) => groupIdOf(ids[1], t)),
    );
    nextCache.revalidatePath.mockClear();
    const result = await mergeGroups({ gameId, groupIds });
    expect(result).toEqual({
      ok: true,
      data: { groupId: groupIds[0], label: "a", count: 3, position: 1 },
    });
    const { rows, counters } = await snapshot(gameId, [ids[1]]);
    const d = await groupIdOf(ids[1], "d");
    expect(
      Object.fromEntries(rows[0].groups.map((g) => [g.id, g.editCount])),
    ).toEqual({ [groupIds[0]]: 1, [d]: 0 });
    expect(counters.groupsMerged).toBe(2);
    expect(nextCache.revalidatePath.mock.calls).toEqual([
      [`/spill/${gameId}`],
      [`/spill/${gameId}/gjennomgang`],
    ]);
  });

  it("FR-20, AD-11 (AC1): a source below the line merged with a Board Group takes the Board Group's ID and rank", async () => {
    const { gameId, ids } = await reviewGame([
      [
        Q1,
        [
          ["Kari", "Ola", "Per"],
          ["Anne", "Bjørn", "Cato"],
          ["Dina", "Erik", "Frida"],
        ],
      ],
    ]);
    const per = await groupIdOf(ids[0], "per");
    const anne = await groupIdOf(ids[0], "anne");
    expect(
      (await review.load(hostId, gameId)).current.below.map((g) => g.id),
    ).toEqual([per]);
    expect(
      await review.merge(hostId, { gameId, groupIds: [per, anne] }),
    ).toEqual({ groupId: anne, label: "anne", count: 2, position: 1 });
    const { current } = await review.load(hostId, gameId);
    expect(current.board).toHaveLength(8);
    expect(current.below).toEqual([]);
    expect(await groupRow(per)).toBeUndefined();
  });

  it("FR-20, AD-11 (AC1): a renamed highest-ranked source keeps its custom label", async () => {
    const { gameId, ids } = await reviewGame(SHARED);
    const kari = await groupIdOf(ids[0], "kari");
    await (
      await getDb()
    )
      .update(answerGroup)
      .set({ customLabel: "X" })
      .where(eq(answerGroup.id, kari));
    const result = await review.merge(hostId, {
      gameId,
      groupIds: [kari, await groupIdOf(ids[0], "ola")],
    });
    expect(result.label).toBe("X");
    expect((await groupRow(kari)).customLabel).toBe("X");
  });

  it("FR-20, AD-5 (AC2): Groups of two Questions, a discarded Group, a random UUID or a malformed ID are NOT_FOUND, and nothing changes", async () => {
    const { gameId, ids } = await reviewGame(SHARED);
    const kari = await groupIdOf(ids[0], "kari");
    const ola = await groupIdOf(ids[0], "ola");
    const a = await groupIdOf(ids[1], "a");
    const b = await groupIdOf(ids[1], "b");
    const db = await getDb();
    await db
      .update(answerGroup)
      .set({ discarded: true })
      .where(eq(answerGroup.id, b));
    await db
      .update(question)
      .set({ reviewed: true })
      .where(eq(question.gameId, gameId));
    const before = await snapshot(gameId, ids);
    for (const groupIds of [
      [kari, a],
      [a, b],
      [kari, ola, randomUUID()],
      [kari, "abc"],
    ]) {
      const error = await review
        .merge(hostId, { gameId, groupIds })
        .catch((e: unknown) => e);
      expect((error as DomainError).code, String(groupIds)).toBe("NOT_FOUND");
    }
    expect(await snapshot(gameId, ids)).toEqual(before);
  });

  it("FR-20 (AC2): one ID, a duplicate ID or no list is INVALID_INPUT, and nothing changes", async () => {
    const { gameId, ids } = await reviewGame(SHARED);
    const kari = await groupIdOf(ids[0], "kari");
    const before = await snapshot(gameId, ids);
    for (const groupIds of [[kari], [kari, kari], undefined]) {
      const error = await review
        .merge(hostId, { gameId, groupIds })
        .catch((e: unknown) => e);
      expect((error as DomainError).code, String(groupIds)).toBe(
        "INVALID_INPUT",
      );
    }
    expect(await snapshot(gameId, ids)).toEqual(before);
  });

  it.each(["ready", "draft"])(
    "FR-20, AD-4 (AC2): a Game in %s is WRONG_STATE, and nothing changes",
    async (state) => {
      const { gameId, ids } = await reviewGame(SHARED);
      const groupIds = [
        await groupIdOf(ids[0], "kari"),
        await groupIdOf(ids[0], "ola"),
      ];
      await (
        await getDb()
      )
        .update(game)
        .set({ state: state as GameState })
        .where(eq(game.id, gameId));
      const before = await snapshot(gameId, ids);
      const error = await review
        .merge(hostId, { gameId, groupIds })
        .catch((e: unknown) => e);
      expect((error as DomainError).code).toBe("WRONG_STATE");
      expect(await snapshot(gameId, ids)).toEqual(before);
    },
  );

  it("FR-20, AD-15 (AC1): a write failing after the Answers moved rolls the whole merge back", async () => {
    const { gameId, ids } = await reviewGame(SHARED);
    const groupIds = [
      await groupIdOf(ids[0], "kari"),
      await groupIdOf(ids[0], "ola"),
    ];
    await (
      await getDb()
    )
      .update(question)
      .set({ reviewed: true })
      .where(eq(question.id, ids[0]));
    const before = await snapshot(gameId, ids);
    vi.mocked(games.bumpCounters).mockRejectedValueOnce(new Error("disk full"));
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const error = await review
      .merge(hostId, { gameId, groupIds })
      .catch((e: unknown) => e);
    expect((error as DomainError).code).toBe("INTERNAL");
    expect(games.bumpCounters).toHaveBeenCalled();
    expect(await snapshot(gameId, ids)).toEqual(before);
  });

  it("FR-20, UX-DR12 (AC3): the page renders a checkbox named Velg «label» on every Board and Ikke på brettet card and none under Forkastet", async () => {
    const { gameId, ids } = await reviewGame([
      [
        Q1,
        [
          ["Kari", "Ola", "Per"],
          ["Anne", "Bjørn", "Cato"],
          ["Dina", "Erik", "Frida", "Geir"],
        ],
      ],
    ]);
    await (
      await getDb()
    )
      .update(answerGroup)
      .set({ discarded: true })
      .where(eq(answerGroup.id, await groupIdOf(ids[0], "geir")));
    const html = await render(gameId);
    expect(html.match(/type="checkbox"/g)).toHaveLength(9);
    expect(html).toContain('aria-label="Velg «per»"');
    const forkastet = html.slice(html.indexOf(">Forkastet"));
    expect(forkastet).toContain(">geir</h4>");
    expect(forkastet).not.toContain('type="checkbox"');
    // No selection yet, so no SelectionBar.
    expect(html).not.toContain("valgt");
  });

  it("FR-19, FR-13: two written forms once each (Kari, kari) give the chip in SQL order, Kari", async () => {
    const { gameId } = await reviewGame([[Q1, [["Kari"], ["kari"], ["Ola"]]]]);
    const { current } = await review.load(hostId, gameId);
    expect(current.board[0].chips).toEqual([{ text: "Kari", n: 2 }]);
  });
});
