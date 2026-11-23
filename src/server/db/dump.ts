import "server-only";
import { existsSync } from "node:fs";
import { sql } from "drizzle-orm";
import { openDb, parseDatabaseUrl, type Db } from "@/server/db/client";
import { env } from "@/server/env";

type Row = Record<string, unknown>;

// SM-3 (tests/manual/anonymity-audit.md): every table in public, rows in physical order
// with ctid and xmin, since PGlite has no pg_dump.
export async function dump(db: Db): Promise<Record<string, Row[]>> {
  const rows = async (query: ReturnType<typeof sql>) => {
    const result: unknown = await db.execute(query);
    // PGlite returns { rows }, postgres.js the row array itself.
    return Array.isArray(result)
      ? (result as Row[])
      : (result as { rows: Row[] }).rows;
  };
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

// Used by `npm run db:dump`.
export async function dumpFromEnv(): Promise<Record<string, Row[]>> {
  // Opening a missing PGlite directory would create an empty database, and an empty
  // dump reads as a clean audit.
  const target = parseDatabaseUrl(env.DATABASE_URL);
  if (
    target.driver === "pglite" &&
    target.dataDir &&
    !existsSync(target.dataDir)
  )
    throw new Error("The PGlite directory in DATABASE_URL does not exist.");
  const handle = await openDb(env.DATABASE_URL);
  try {
    return await dump(handle.db as Db);
  } finally {
    await handle.close();
  }
}
