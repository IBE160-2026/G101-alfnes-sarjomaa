import "server-only";
import { sql } from "drizzle-orm";
import { sqlstateOf } from "@/server/boundary";
import { type Db, getDb } from "@/server/db/client";
import { log } from "@/server/log";

// The file each table lives in. VACUUM FULL writes a new one, so an unchanged filenode
// means the table was skipped: SKIP_LOCKED found it held, or the role does not own it.
// Postgres reports either only as a notice, which never reaches a driver error.
async function filenodes(db: Db): Promise<string[]> {
  const rows = await db
    .select({ node: sql<string>`relfilenode::text` })
    .from(sql`pg_class`)
    .where(sql`oid in ('submission'::regclass, 'invite_link'::regclass)`)
    .orderBy(sql`oid`);
  return rows.map((r) => r.node);
}

// Best-effort, after commit and outside any transaction (AD-9), so the dead rows of deleted
// links and Answer sets do not linger in the table files. SKIP_LOCKED skips a table someone
// holds instead of waiting or queueing ahead of live submits; the hourly purge retries.
// Never throws.
// shortcut: rewrites both tables for every Game under ACCESS EXCLUSIVE, so submits to other Games wait for it; fine at pilot scale, switch to per-Game cleanup or partitioning if submits start queueing behind it.
export async function vacuumCollectionTables(module: string): Promise<void> {
  try {
    const db = await getDb();
    const before = await filenodes(db);
    await db.execute(sql`VACUUM (FULL, SKIP_LOCKED) submission, invite_link`);
    const after = await filenodes(db);
    if (before.some((node, i) => node === after[i]))
      log({ module, op: "vacuum", code: "VACUUM_SKIPPED" });
  } catch (error) {
    log({
      module,
      op: "vacuum",
      code: "INTERNAL",
      sqlstate: sqlstateOf(error),
    });
  }
}
