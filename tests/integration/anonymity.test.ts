import { randomUUID } from "node:crypto";
import { eq, type SQL, sql } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  closeCollection,
  createInviteLinks,
  revokeInviteLink,
} from "@/app/spill/[id]/actions";
import { submitAnswerSet } from "@/app/svar/[gameId]/actions";
import * as grouping from "@/server/grouping";
import * as review from "@/server/review";
import { newToken, sha256 } from "@/lib/token";
import * as auth from "@/server/auth";
import { getDb } from "@/server/db/client";
import { game, question } from "@/server/db/schema";

vi.mock("next/headers", () =>
  import("./next-mocks").then((m) => m.nextHeaders),
);
vi.mock("next/navigation", () =>
  import("./next-mocks").then((m) => m.nextNavigation()),
);
vi.mock("next/cache", () => import("./next-mocks").then((m) => m.nextCache));

vi.setConfig({ testTimeout: 30_000, hookTimeout: 60_000 });

const V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const HOST_SIDE = ["host", "session"];
// Every app schema: the system ones and drizzle's migration log are left out.
const appSchema = (column: string) =>
  sql.raw(
    `${column} not in ('pg_catalog', 'information_schema', 'drizzle') and ${column} not like 'pg\\_%'`,
  );

async function rows<T>(query: SQL): Promise<T[]> {
  const result = await (await getDb()).execute(query);
  return (result as unknown as { rows: T[] }).rows;
}

type Column = {
  table: string;
  column: string;
  type: string;
  udt: string;
  nullable: string;
  default: string | null;
  identity: string;
};

const appColumns = () =>
  rows<Column>(
    sql`select table_name::text as table, column_name::text as column, data_type::text as type,
      udt_name::text as udt, is_nullable::text as nullable, column_default::text as default,
      is_identity::text as identity
      from information_schema.columns where ${appSchema("table_schema")}`,
  );

const tokenOf = (link: string) => link.slice(link.indexOf("#") + 1);

// The file behind invite_link and submission, their TOAST tables and every index of
// either. VACUUM FULL writes each one anew; a plain VACUUM keeps them, and with them the
// deleted rows' bytes.
const filenodes = () =>
  rows<{ name: string; node: string }>(
    sql`with t(oid) as (select unnest(array['invite_link'::regclass, 'submission'::regclass]::oid[])),
      rel(oid) as (select oid from t union select reltoastrelid from pg_class where oid in (select oid from t))
      select relname::text as name, relfilenode::text as node from pg_class
      where oid in (select oid from rel) or oid in (select indexrelid from pg_index where indrelid in (select oid from rel))
      order by relname`,
  );

let gameId: string;
let questionIds: string[];
const secrets: string[] = [];
let filesBefore: { name: string; node: string }[];

// One Game closed through the real entry points: 5 links, 3 submitted sets, 1 unused
// link, and 1 link that submitted and was then revoked (its replacement stays unused).
beforeAll(async () => {
  await auth.register({
    email: "anonymitet@example.test",
    password: "riktig-passord-123",
    registrationCode: "",
  });
  const { hostId } = await auth.requireHost();
  const db = await getDb();
  [{ id: gameId }] = await db
    .insert(game)
    .values({ hostId, title: "Anonymitet" })
    .returning({ id: game.id });
  questionIds = [0, 1, 2].map(() => randomUUID());
  await db.insert(question).values(
    questionIds.map((id, i) => ({
      id,
      gameId,
      position: i + 1,
      text: `Spørsmål ${i + 1}`,
    })),
  );
  const created = await createInviteLinks({ gameId, count: 5 });
  if (!created.ok) throw new Error(created.code);
  const links = created.data.links;
  const tokens = links.map(tokenOf);

  // Set k answers Question j with five texts that name k, so the order check can read k.
  for (const k of [0, 1, 2, 4]) {
    const editSecret = newToken();
    const answers = Object.fromEntries(
      questionIds.map((id, j) => [
        id,
        [1, 2, 3, 4, 5].map((f) => `S${k} Q${j} F${f}`),
      ]),
    );
    const result = await submitAnswerSet(gameId, tokens[k], {
      answers,
      editSecret,
    });
    if (!result.ok) throw new Error(result.code);
    secrets.push(editSecret);
  }
  const revoked = await revokeInviteLink({ gameId, link: links[4] });
  if (!revoked.ok) throw new Error(revoked.code);
  tokens.push(tokenOf(revoked.data.link));

  secrets.push(...tokens);
  secrets.push(...secrets.map(sha256));
  expect(secrets).toHaveLength(20); // 6 Tokens + 4 edit secrets, and their hashes

  filesBefore = await filenodes();
  const closed = await closeCollection({ gameId });
  if (!closed.ok) throw new Error(closed.code);
});

describe("after close", () => {
  it("FR-13 (AC1): answer has exactly today's seven AD-10 columns, with these types, nullability and defaults", async () => {
    const answer = (await appColumns())
      .filter((c) => c.table === "answer")
      .map((c) => [c.column, c.type, c.nullable, c.default])
      .sort();
    // Each new column is added here on purpose, never by loosening the check.
    expect(answer).toEqual(
      [
        ["contributor_key", "uuid", "YES", null],
        ["group_id", "uuid", "YES", null],
        ["id", "uuid", "NO", "gen_random_uuid()"],
        ["normalized_text", "text", "NO", null],
        ["question_id", "uuid", "NO", null],
        ["rank", "integer", "YES", null],
        ["text", "text", "NO", null],
      ].sort(),
    );
  });

  it("FR-13 (AC1): no timestamp column and no *_at column exists outside host, session and game", async () => {
    const timed = (await appColumns()).filter(
      (c) =>
        /^_?(timestamp|timestamptz|date|time|timetz|interval|(ts|tstz|date)(range|multirange))$/.test(
          c.udt,
        ) || c.column.endsWith("_at"),
    );
    // The query must see game.created_at, so it cannot pass by matching nothing.
    expect(timed.map((c) => `${c.table}.${c.column}`)).toContain(
      "game.created_at",
    );
    const outside = timed.filter(
      (c) => ![...HOST_SIDE, "game"].includes(c.table),
    );
    expect(outside).toEqual([]);
  });

  it("FR-13 (AC1): answer and answer_group have no identity column or nextval default, and no app schema owns a sequence", async () => {
    for (const table of ["answer", "answer_group"]) {
      const columns = (await appColumns()).filter((c) => c.table === table);
      expect(columns.length, table).toBeGreaterThan(0);
      for (const c of columns) {
        expect(c.identity, `${table}.${c.column}`).toBe("NO");
        expect(c.default ?? "", `${table}.${c.column}`).not.toMatch(/nextval/i);
      }
    }
    expect(
      await rows(
        sql`select c.relname::text as name from pg_class c join pg_namespace n on n.oid = c.relnamespace
          where c.relkind = 'S' and ${appSchema("n.nspname")}`,
      ),
    ).toEqual([]);
  });

  it("FR-13 (AC1): with invite_link and submission empty, no other table has a Token, hash, secret, link or set column, or a key into them", async () => {
    expect(
      await rows(
        sql`select (select count(*) from invite_link)::int as links, (select count(*) from submission)::int as sets`,
      ),
    ).toEqual([{ links: 0, sets: 0 }]);
    const linkSide = [...HOST_SIDE, "invite_link", "submission"];
    const named = (await appColumns()).filter(
      (c) =>
        !linkSide.includes(c.table) &&
        /token|hash|secret|link|submission/i.test(c.column) &&
        // A per-Game counter of issued links (FR-8), not a reference to any link.
        !(c.table === "game" && c.column === "invite_links_issued"),
    );
    expect(named.map((c) => `${c.table}.${c.column}`)).toEqual([]);
    const keys = await rows<{ source: string; target: string }>(
      sql`select conrelid::regclass::text as source, confrelid::regclass::text as target
        from pg_constraint where contype = 'f'`,
    );
    expect(keys.map((k) => k.target)).toContain("invite_link");
    expect(
      keys.filter(
        (k) =>
          ["invite_link", "submission"].includes(k.target) &&
          !["invite_link", "submission"].includes(k.source),
      ),
    ).toEqual([]);
  });

  it("FR-13 (AC2): invite_link and submission are empty and vacuumed with FULL (table, TOAST and indexes rewritten), and no row of any table holds a captured secret's prefix or the revoked set", async () => {
    expect(
      await rows(
        sql`select (select count(*) from invite_link)::int as links, (select count(*) from submission)::int as sets`,
      ),
    ).toEqual([{ links: 0, sets: 0 }]);
    // Two tables, at least submission's TOAST table, and their primary keys.
    expect(filesBefore.length).toBeGreaterThanOrEqual(5);
    const filesAfter = await filenodes();
    expect(filesAfter.map((f) => f.name)).toEqual(
      filesBefore.map((f) => f.name),
    );
    for (const [i, { name, node }] of filesAfter.entries())
      expect(node, name).not.toBe(filesBefore[i].node);
    const tables = await rows<{ schema: string; name: string }>(
      sql`select table_schema::text as schema, table_name::text as name from information_schema.tables
        where table_type = 'BASE TABLE' and table_schema not in ('pg_catalog', 'information_schema')`,
    );
    expect(tables.map((t) => t.name)).toEqual(
      expect.arrayContaining(["answer", "invite_link", "submission"]),
    );
    let scanned = 0;
    for (const { schema, name } of tables) {
      const all = await rows<{ json: string }>(
        sql`select row_to_json(t)::text as json from ${sql.identifier(schema)}.${sql.identifier(name)} t`,
      );
      scanned += all.length;
      for (const { json } of all) {
        for (const s of secrets)
          expect(json, name).not.toContain(s.slice(0, 16));
        expect(json, name).not.toContain("S4 Q");
      }
    }
    expect(scanned).toBeGreaterThanOrEqual(45);
  });

  it("FR-13 (AC3): no Contributor key appears under two Questions, and every answer.id and key is a v4 UUID", async () => {
    const answers = await rows<{ id: string; key: string; question: string }>(
      sql`select id::text as id, contributor_key::text as key, question_id::text as question from answer`,
    );
    expect(answers).toHaveLength(45);
    const questionsOf = new Map<string, Set<string>>();
    for (const a of answers) {
      expect(a.id).toMatch(V4);
      expect(a.key).toMatch(V4);
      questionsOf.set(
        a.key,
        (questionsOf.get(a.key) ?? new Set()).add(a.question),
      );
    }
    for (const qs of questionsOf.values()) expect(qs.size).toBe(1);
    expect(questionsOf.size).toBe(9);
  });

  it("FR-11 (AC4): outside host and session no column names a Participant's identity, and none has a network address type", async () => {
    const identity =
      /email|(^|_)ip(_|$)|ip_?addr|addr|forwarded|(^|_)ua$|cookie|user_id|user_?agent|device|fingerprint|account|participant|phone|(first|last|full|user|display|nick|real|given|family|sur)_?name/i;
    const found = (await appColumns()).filter(
      (c) =>
        !HOST_SIDE.includes(c.table) &&
        (identity.test(c.column) ||
          ["inet", "cidr", "macaddr", "macaddr8"].includes(
            c.udt.replace(/^_/, ""),
          )),
    );
    expect(found.map((c) => `${c.table}.${c.column}`)).toEqual([]);
  });

  it("FR-13: in physical order the Game's 45 rows are shuffled across keys and sets, and share one xmin and cmin", async () => {
    const answers = await rows<{
      key: string;
      text: string;
      xmin: string;
      cmin: string;
    }>(
      sql`select contributor_key::text as key, text, xmin::text as xmin, cmin::text as cmin from answer
        where question_id in (${sql.join(
          questionIds.map((id) => sql`${id}::uuid`),
          sql`, `,
        )}) order by ctid`,
    );
    expect(answers).toHaveLength(45);
    const keys = answers.map((a) => a.key);
    // An unshuffled build gives exactly 9 runs; a random permutation does with p ≈ 1e-33.
    expect(keys.filter((k, i) => k !== keys[i - 1]).length).toBeGreaterThan(9);
    const sets = answers.map((a) =>
      Number(a.text.slice(1, a.text.indexOf(" "))),
    );
    expect(new Set(sets)).toEqual(new Set([0, 1, 2]));
    // Whole sets written as blocks, in any order, give exactly 3 runs.
    expect(sets.filter((k, i) => k !== sets[i - 1]).length).toBeGreaterThan(3);
    // One transaction (xmin) and one statement in it (cmin): no per-row arrival sequence.
    expect(new Set(answers.map((a) => a.xmin)).size).toBe(1);
    expect(new Set(answers.map((a) => a.cmin)).size).toBe(1);
  });
});

// The same Game, grouped (no key: the fallback), every Question marked and the Board locked.
describe("after confirm", () => {
  beforeAll(async () => {
    const { hostId } = await auth.requireHost();
    await grouping.run(gameId);
    for (const questionId of questionIds)
      await review.setReviewed(hostId, { gameId, questionId, reviewed: true });
    await review.confirmBoard(hostId, { gameId });
  });

  it("FR-13, FR-21 (AC4): the Game is ready and every contributor_key and rank of its 45 Answers is NULL", async () => {
    const [{ state }] = await (
      await getDb()
    )
      .select({ state: game.state })
      .from(game)
      .where(eq(game.id, gameId));
    expect(state).toBe("ready");
    expect(
      await rows(
        sql`select count(*)::int as answers, count(contributor_key)::int as keys, count(rank)::int as ranks
          from answer where question_id in (${sql.join(
            questionIds.map((id) => sql`${id}::uuid`),
            sql`, `,
          )})`,
      ),
    ).toEqual([{ answers: 45, keys: 0, ranks: 0 }]);
  });

  it("FR-13, FR-21 (AC4): board_slot holds labels and Counts only: no key, rank, timestamp or text column, and eight slots per Question with their frozen Count 1", async () => {
    const columns = (await appColumns())
      .filter((c) => c.table === "board_slot")
      .map((c) => [c.column, c.type, c.nullable])
      .sort();
    expect(columns).toEqual(
      [
        ["count", "integer", "NO"],
        ["group_id", "uuid", "YES"],
        ["id", "uuid", "NO"],
        ["label", "text", "NO"],
        ["position", "integer", "NO"],
        ["question_id", "uuid", "NO"],
      ].sort(),
    );
    const slots = await rows<{ question: string; n: number; max: number }>(
      sql`select question_id::text as question, count(*)::int as n, max(count)::int as max
        from board_slot group by question_id`,
    );
    expect(slots).toHaveLength(3);
    for (const slot of slots) {
      expect(questionIds).toContain(slot.question);
      // 15 distinct texts per Question: 15 one-key Groups, of which the top 8 are slots.
      expect(slot.n).toBe(8);
      expect(slot.max).toBe(1);
    }
  });
});
