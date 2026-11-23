import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { asc, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ANSWERS_PER_QUESTION_MAX, QUESTION_TEXT_MAX } from "@/lib/limits";
import { getDb, openDb } from "@/server/db/client";
import { dump } from "@/server/db/dump";
import { game, inviteLink, question, submission } from "@/server/db/schema";
import { LONG_QUESTION, seedSizing, WIDE_ANSWER } from "@/server/sizing";

let gameId: string;
beforeAll(async () => {
  ({ gameId } = await seedSizing());
});

describe("the manual checklist's tools", () => {
  it("NFR-5: seed:sizing gives one collecting Game with 15 Questions, 30 links and 30 Answer sets of 1–5 Answers, a 200-character Question 1 and a 40-character Answer", async () => {
    const db = await getDb();
    const [g] = await db.select().from(game).where(eq(game.id, gameId));
    expect(g).toMatchObject({ state: "collecting", inviteLinksIssued: 30 });
    const qs = await db
      .select()
      .from(question)
      .where(eq(question.gameId, gameId))
      .orderBy(asc(question.position));
    expect(qs).toHaveLength(15);
    expect(qs[0].text).toBe(LONG_QUESTION);
    expect(LONG_QUESTION).toHaveLength(QUESTION_TEXT_MAX);
    expect(WIDE_ANSWER).toHaveLength(40);
    const sets = await db
      .select({ answers: submission.answers })
      .from(submission)
      .innerJoin(inviteLink, eq(inviteLink.tokenHash, submission.tokenHash))
      .where(eq(inviteLink.gameId, gameId));
    expect(sets).toHaveLength(30);
    for (const { answers } of sets) {
      expect(Object.keys(answers).sort()).toEqual(qs.map((q) => q.id).sort());
      for (const list of Object.values(answers)) {
        expect(list.length).toBeGreaterThanOrEqual(1);
        expect(list.length).toBeLessThanOrEqual(ANSWERS_PER_QUESTION_MAX);
      }
    }
    expect(
      sets.filter(({ answers }) => answers[qs[0].id][0] === WIDE_ANSWER),
    ).toHaveLength(15);
  });

  it("SM-3: db:dump gives every public table, each row with ctid and xmin, in physical order", async () => {
    const db = await getDb();
    const out = await dump(db);
    expect(Object.keys(out)).toEqual(
      expect.arrayContaining(["answer", "game", "invite_link", "submission"]),
    );
    expect(out.game.length).toBeGreaterThan(0);
    expect(out.submission).toHaveLength(30);
    for (const rows of Object.values(out))
      for (const [i, row] of rows.entries()) {
        expect(row.ctid).toMatch(/^\(\d+,\d+\)$/);
        expect(row.xmin).toMatch(/^\d+$/);
        if (i > 0) {
          const at = (r: typeof row) =>
            String(r.ctid).slice(1, -1).split(",").map(Number);
          const [[pa, ta], [pb, tb]] = [at(rows[i - 1]), at(row)];
          expect(pa < pb || (pa === pb && ta < tb)).toBe(true);
        }
      }
    expect(JSON.parse(JSON.stringify(out)).question).toHaveLength(15);
  });
});

const temp = mkdtempSync(join(tmpdir(), "db-dump-"));
afterAll(() => rmSync(temp, { recursive: true, force: true }));

// No --env-file flag, as in npm run db:dump, so no .env file is read here.
function dumpCli(url: string, ...args: string[]) {
  return spawnSync(
    "node_modules/.bin/tsx",
    ["--conditions=react-server", "src/cli/db-dump.ts", ...args],
    {
      encoding: "utf8",
      env: { ...process.env, DATABASE_URL: url },
      timeout: 30_000,
    },
  );
}
const FAILED = /^db:dump failed( \([A-Z_]+\))?\. Check DATABASE_URL\.$/;

describe("npm run db:dump", () => {
  it("SM-3: on an existing PGlite directory it exits 0 and prints only the JSON dump on stdout", async () => {
    const dir = join(temp, "audit");
    const handle = await openDb(`pglite://${dir}`);
    await handle.close();
    const { status, stdout, stderr } = dumpCli(`pglite://${dir}`);
    expect(stderr).toBe("");
    expect(status).toBe(0);
    expect(JSON.parse(stdout)).toHaveProperty("game", []);
  });

  it("SM-3: a postgres URL without --postgres is refused before any connection, naming the flag and not the URL", () => {
    const { status, stdout, stderr } = dumpCli(
      "postgres://u:hunter2@127.0.0.1:1/x",
    );
    expect(stderr.trim()).toBe(
      "db:dump refuses a postgres:// DATABASE_URL without --postgres (npm run db:dump -- --postgres).",
    );
    expect(stdout).toBe("");
    expect(status).toBe(1);
  });

  it("NFR-8: an unreachable postgres URL exits 1 with the code only, never the URL or its password, and prints no dump", () => {
    const { status, stdout, stderr } = dumpCli(
      "postgres://u:hunter2@127.0.0.1:1/x",
      "--postgres",
    );
    expect(stderr.trim()).toMatch(FAILED);
    expect(stderr).not.toContain("hunter2");
    expect(stdout).toBe("");
    expect(status).toBe(1);
  });

  it("SM-3: a PGlite directory that does not exist exits 1 with no dump and is not created", () => {
    const dir = join(temp, "absent");
    const { status, stdout, stderr } = dumpCli(`pglite://${dir}`);
    expect(stderr.trim()).toBe(
      "db:dump failed (PGLITE_DIR_MISSING). Check DATABASE_URL.",
    );
    expect(stdout).toBe("");
    expect(status).toBe(1);
    expect(existsSync(dir)).toBe(false);
  });
});
