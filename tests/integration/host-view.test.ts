import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  closeCollection,
  createInviteLinks,
  deleteGame,
  moveQuestion,
  removeQuestion,
  revokeInviteLink,
  saveQuestion,
} from "@/app/spill/[id]/actions";
import GamePage, { generateMetadata } from "@/app/spill/[id]/page";
import GamesPage from "@/app/spill/page";
import { openInviteLink, submitAnswerSet } from "@/app/svar/[gameId]/actions";
import InviteLinkPage from "@/app/svar/[gameId]/page";
import { FEWER_THAN_3 } from "@/lib/limits";
import { newToken, sha256 } from "@/lib/token";
import * as auth from "@/server/auth";
import * as collection from "@/server/collection";
import { getDb } from "@/server/db/client";
import { game, question } from "@/server/db/schema";
import { envSchema } from "@/server/env";
import * as games from "@/server/games";
import * as questions from "@/server/questions";
import { run } from "./next-mocks";
import { sqlRows } from "./driver";

vi.mock("next/headers", () =>
  import("./next-mocks").then((m) => m.nextHeaders),
);
vi.mock("next/navigation", () =>
  import("./next-mocks").then((m) => m.nextNavigation()),
);
vi.mock("next/cache", () => import("./next-mocks").then((m) => m.nextCache));

// Above the global 30 s: one test renders every Host read and action at five Answer-set stages.
vi.setConfig({ testTimeout: 60_000 });

const TEXTS = [
  "Hva gjør Jonas?",
  "Hvem kommer for sent?",
  "Hvem synger høyest?",
];
let hostId: string;

beforeAll(async () => {
  await auth.register({
    email: "vertens-blikk@example.test",
    password: "riktig-passord-123",
    registrationCode: "",
  });
  hostId = (await auth.requireHost()).hostId;
});

const tokenOf = (link: string) => link.slice(link.indexOf("#") + 1);
const placeholder = (link: string) => link.replace(/#.*$/, "#TOKEN");

// From three the close control changes (FR-10), as in the Story 2.6 snapshot test.
const withoutClose = (html: string) =>
  html.replace(/(aldri hvem som har svart\.<\/p>)[\s\S]*?<\/section>/, "$1");

describe("the Host's view during Collection", () => {
  it("FR-12, FR-11: every Host read and refused action is identical after 0, 1, a changed and 2 sets, only the count and close control change at 3, used and unused links revoke alike, and no output holds a Token, hash, edit secret or Answer", async () => {
    const db = await getDb();
    const [{ id: gameId }] = await db
      .insert(game)
      .values({ hostId, title: "Vertens blikk" })
      .returning({ id: game.id });
    const ids = TEXTS.map(() => randomUUID());
    await db
      .insert(question)
      .values(
        TEXTS.map((text, i) => ({ id: ids[i], gameId, position: i + 1, text })),
      );

    // Every output and the fresh links it may itself return, scanned at the end.
    const outputs: { output: unknown; own: string[] }[] = [];
    const keep = <T>(output: T, own: string[] = []): T => {
      outputs.push({ output, own });
      return output;
    };

    const created = await createInviteLinks({ gameId, count: 4 });
    if (!created.ok) throw new Error(created.code);
    keep(created, created.data.links.map(tokenOf));
    const extra = await createInviteLinks({ gameId, count: 1 });
    if (!extra.ok) throw new Error(extra.code);
    keep(extra, extra.data.links.map(tokenOf));
    const links = [...created.data.links, ...extra.data.links];
    const tokens = links.map(tokenOf);

    const props = {
      params: Promise.resolve({ id: gameId }),
      searchParams: Promise.resolve({}),
    };
    async function reads(withClose: boolean) {
      const out = {
        gamesPage: renderToStaticMarkup(await GamesPage()),
        gamePage: renderToStaticMarkup(await GamePage(props)),
        metadata: await generateMetadata(props),
        listOwned: await games.listOwned(hostId),
        getOwned: await games.getOwned(hostId, gameId),
        questions: await questions.list(hostId, gameId),
        progress: await collection.progress(hostId, gameId),
        linkStatus: await collection.linkStatus(gameId),
        shell: renderToStaticMarkup(
          await InviteLinkPage({
            params: Promise.resolve({ gameId }),
            searchParams: Promise.resolve({}),
          }),
        ),
        opened: await Promise.all(tokens.map((t) => openInviteLink(gameId, t))),
        save: await saveQuestion({ gameId, questionId: ids[0], text: "Ny" }),
        move: await moveQuestion({
          gameId,
          questionId: ids[1],
          direction: "up",
        }),
        remove: await removeQuestion({ gameId, questionId: ids[2] }),
        ...(withClose && { close: await closeCollection({ gameId }) }),
      };
      return keep(out);
    }

    const answerTexts: string[] = [];
    const secrets: string[] = [];
    async function send(k: number, label: string, editSecret = newToken()) {
      const answers = Object.fromEntries(
        ids.map((id, q) => [id, [`${label}-${k}-${q}-pannekake`]]),
      );
      answerTexts.push(...Object.values(answers).flat());
      secrets.push(editSecret);
      const result = keep(
        await submitAnswerSet(gameId, tokens[k], { answers, editSecret }),
      );
      expect(result).toEqual({ ok: true, data: null });
      return editSecret;
    }

    const before = await reads(true);
    for (const r of before.opened) expect(r.ok).toBe(true);
    for (const refused of [before.save, before.move, before.remove])
      expect(refused).toMatchObject({ ok: false, code: "WRONG_STATE" });
    expect(before.close).toMatchObject({
      ok: false,
      code: "TOO_FEW_ANSWER_SETS",
    });
    expect(before.progress).toEqual({
      active: 5,
      issued: 5,
      submissions: FEWER_THAN_3,
    });

    const first = await send(0, "forste");
    expect(await reads(true)).toEqual(before);
    await send(0, "endret", first);
    expect(await reads(true)).toEqual(before);
    await send(1, "andre");
    expect(await reads(true)).toEqual(before);

    await send(2, "tredje");
    const at3 = await reads(false);
    const { close, ...rest } = before;
    void close;
    expect({ ...at3, gamePage: withoutClose(at3.gamePage) }).toEqual({
      ...rest,
      gamePage: withoutClose(before.gamePage).replace("færre enn 3", "3"),
      progress: { ...before.progress, submissions: 3 },
    });
    expect(withoutClose(at3.gamePage)).not.toBe(at3.gamePage);

    const later = await createInviteLinks({ gameId, count: 1 });
    if (!later.ok) throw new Error(later.code);
    keep(later, later.data.links.map(tokenOf));
    const normalised = (r: typeof extra) =>
      r.ok ? { ...r, data: { links: r.data.links.map(placeholder) } } : r;
    expect(normalised(later)).toEqual(normalised(extra));

    // tokens[0] has a set; tokens[3] never had one.
    const revoked = [];
    for (const link of [links[0], links[3]]) {
      const result = await revokeInviteLink({ gameId, link });
      if (!result.ok) throw new Error(result.code);
      keep(result, [tokenOf(result.data.link)]);
      revoked.push({
        ...result,
        data: { link: placeholder(result.data.link) },
      });
    }
    expect(revoked[0]).toEqual(revoked[1]);

    expect(keep(await run(deleteGame, { gameId }))).toEqual({
      redirect: "/spill",
    });

    const allTokens = outputs.flatMap((o) => o.own);
    expect(allTokens).toHaveLength(8);
    for (const { output, own } of outputs) {
      const json = JSON.stringify(output);
      const banned = [
        ...allTokens.filter((t) => !own.includes(t)),
        ...allTokens.map(sha256),
        ...secrets,
        ...secrets.map(sha256),
        ...answerTexts,
      ];
      for (const secret of banned) expect(json).not.toContain(secret);
    }
  });
});

describe("fixed lists (FR-12)", () => {
  // Adding an entry to any list below needs an anonymity review first (FR-11 to FR-13):
  // a new setting, option or column could weaken what the Host or a log can see.
  const columns = async (table: string) => {
    const result = await (
      await getDb()
    ).execute(
      sql`select column_name::text as name from information_schema.columns
        where table_schema = 'public' and table_name = ${table} order by column_name`,
    );
    return sqlRows<{ name: string }>(result).map((r) => r.name);
  };

  it("FR-12: env.ts reads exactly these 9 keys", () => {
    expect(Object.keys(envSchema.shape).sort()).toEqual([
      "APP_BASE_URL",
      "CRON_SECRET",
      "DATABASE_URL",
      "DEMO_MODE",
      "JUDGE_MODEL",
      "JUDGE_PROVIDER",
      "OPENROUTER_API_KEY",
      "PORT",
      "REGISTRATION_CODE",
    ]);
  });

  it("FR-12: game has exactly these 9 columns and host these 6, so no Host option exists", async () => {
    expect(await columns("game")).toEqual([
      "created_at",
      "grouping_lease_until",
      "host_id",
      "id",
      "invite_links_issued",
      "played_at",
      "state",
      "title",
      "updated_at",
    ]);
    expect(await columns("host")).toEqual([
      "created_at",
      "email",
      "failed_logins",
      "id",
      "locked_until",
      "password_hash",
    ]);
  });
});
