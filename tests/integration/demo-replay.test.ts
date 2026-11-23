import { readFileSync } from "node:fs";
import { count, eq, inArray } from "drizzle-orm";
import { afterEach, expect, it, vi } from "vitest";
import { DEMO_HOST } from "@/lib/demo";
import { normalize } from "@/lib/normalize";
import * as collection from "@/server/collection";
import { getDb } from "@/server/db/client";
import {
  answer,
  answerGroup,
  game,
  groupingResult,
  host,
  inviteLink,
  submission,
} from "@/server/db/schema";
import { DEMO_QUESTIONS, DEMO_SETS, seed } from "@/server/demo";
import { env } from "@/server/env";
import * as grouping from "@/server/grouping";

const provider = env.JUDGE_PROVIDER;
afterEach(() => {
  env.JUDGE_PROVIDER = provider;
  vi.restoreAllMocks();
});

it("FR-31: the demo seed is one collecting Game with six of eight links answered, and closing it groups every Question from data/rulings/demo.json with no fallback and no network call", async () => {
  const { hostId, gameId, questionIds } = await seed();
  const db = await getDb();

  const [owner] = await db
    .select({ email: host.email })
    .from(host)
    .where(eq(host.id, hostId));
  expect(owner.email).toBe(DEMO_HOST.email);
  const [seeded] = await db
    .select({ state: game.state })
    .from(game)
    .where(eq(game.id, gameId));
  expect(seeded.state).toBe("collecting");
  const [links] = await db
    .select({ n: count() })
    .from(inviteLink)
    .where(eq(inviteLink.gameId, gameId));
  const [sets] = await db
    .select({ n: count() })
    .from(submission)
    .innerJoin(inviteLink, eq(inviteLink.tokenHash, submission.tokenHash))
    .where(eq(inviteLink.gameId, gameId));
  expect([links.n, sets.n]).toEqual([8, 6]);

  env.JUDGE_PROVIDER = "replay";
  const fetchSpy = vi.spyOn(globalThis, "fetch");
  await collection.close(hostId, { gameId });
  await grouping.run(gameId);

  const results = await db
    .select()
    .from(groupingResult)
    .where(inArray(groupingResult.questionId, questionIds));
  expect(results).toHaveLength(3);
  for (const result of results)
    expect(result).toMatchObject({
      source: "replay",
      uncoveredItems: 0,
      fellBack: false,
      fallbackReason: null,
      judgeCalls: 0,
      modelId: "deepseek/deepseek-v4.1-flash",
    });
  // The recorded ruling, pinned: a regrouping with the same number of Groups must fail.
  const rows = await db
    .select({ groupId: answer.groupId, text: answer.normalizedText })
    .from(answer)
    .where(inArray(answer.questionId, questionIds));
  const byGroup = new Map<string | null, Set<string>>();
  for (const r of rows)
    byGroup.set(r.groupId, (byGroup.get(r.groupId) ?? new Set()).add(r.text));
  const partition = [...byGroup.values()]
    .map((g) => [...g].sort().join(" | "))
    .sort();
  expect(partition).toEqual(
    [
      "kaffe",
      "kortspill | kortstokk",
      "sjokolade",
      "sovepose",
      "ullsokker | varme sokker",
      "brunost",
      "egg",
      "egg og bacon",
      "geitost",
      "grøt | havregrøt",
      "kaffe",
      "vafler",
      "baker kake",
      "brettspill | kortspill | spiller kort",
      "filmkveld | ser film",
      "leser bok",
      "sover",
    ].sort(),
  );
  const origins = await db
    .selectDistinct({ origin: answerGroup.origin })
    .from(answerGroup)
    .where(inArray(answerGroup.questionId, questionIds));
  expect(origins).toEqual([{ origin: "judge" }]);
  const [closed] = await db
    .select({ state: game.state })
    .from(game)
    .where(eq(game.id, gameId));
  expect(closed.state).toBe("in_review");
  expect(fetchSpy).not.toHaveBeenCalled();

  // The ruling partitions exactly the seeded Answers, and its partition is what Grouping wrote.
  const rulings: {
    question: string;
    items: string[];
    assignments: number[];
  }[] = JSON.parse(readFileSync("data/rulings/demo.json", "utf8"));
  for (const [q, text] of DEMO_QUESTIONS.entries()) {
    const ruling = rulings.find((r) => r.question === text);
    const answers = DEMO_SETS.flatMap((set) => set[q]).map(normalize);
    expect(ruling?.items).toEqual([...new Set(answers)].sort());
    const [groups] = await db
      .select({ n: count() })
      .from(answerGroup)
      .where(eq(answerGroup.questionId, questionIds[q]));
    expect(groups.n).toBe(new Set(ruling!.assignments).size);
  }
});
