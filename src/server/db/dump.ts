import "server-only";
import { existsSync } from "node:fs";
import { sql } from "drizzle-orm";
import { openDb, parseDatabaseUrl, type Db } from "@/server/db/client";
import { env } from "@/server/env";

type Row = Record<string, unknown>;

// db.execute returns { rows } on PGlite and the row array itself on postgres.js.
export const sqlRows = <T>(result: unknown): T[] =>
  Array.isArray(result) ? (result as T[]) : (result as { rows: T[] }).rows;

// SM-3 (tests/manual/anonymity-audit.md): every table in public, rows in physical order
// with ctid and xmin, since PGlite has no pg_dump.
export async function dump(db: Db): Promise<Record<string, Row[]>> {
  const rows = async (query: ReturnType<typeof sql>) =>
    sqlRows<Row>(await db.execute(query));
  const tables = await rows(
    sql`select tablename::text as name from pg_tables where schemaname = 'public' order by tablename`,
  );
  const out: Record<string, Row[]> = {};
  for (const { name } of tables as { name: string }[])
    out[name] = await rows(
      sql`select ctid::text as ctid, xmin::text as xmin, t.* from ${sql.identifier("public")}.${sql.identifier(name)} t order by t.ctid`,
    );
  return out;
}

// The CLI prints only `code`, never the message.
const refuse = (code: string) => Object.assign(new Error(code), { code });

// Used by `npm run db:dump`.
export async function dumpFromEnv({ postgres = false } = {}): Promise<
  Record<string, Row[]>
> {
  const target = parseDatabaseUrl(env.DATABASE_URL);
  // A hosted URL exported in the shell for something else is never dumped by accident.
  if (target.driver === "postgres" && !postgres)
    throw refuse("POSTGRES_NEEDS_FLAG");
  // Opening a missing PGlite directory would create an empty database, and an empty
  // dump reads as a clean audit.
  if (
    target.driver === "pglite" &&
    target.dataDir &&
    !existsSync(target.dataDir)
  )
    throw refuse("PGLITE_DIR_MISSING");
  const handle = await openDb(env.DATABASE_URL);
  try {
    return await dump(handle.db as Db);
  } finally {
    await handle.close();
  }
}
