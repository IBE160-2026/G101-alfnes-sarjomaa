import "server-only";
import { sql } from "drizzle-orm";
import { sqlstateOf } from "@/server/boundary";
import { getDb } from "@/server/db/client";
import { log } from "@/server/log";

// Best-effort, after commit and outside any transaction (AD-9), so the dead rows of deleted
// links and Answer sets do not linger in the table files. SKIP_LOCKED skips a table someone
// holds instead of waiting or queueing ahead of live submits. Never throws.
export async function vacuumCollectionTables(module: string): Promise<void> {
  try {
    await (
      await getDb()
    ).execute(sql`VACUUM (FULL, SKIP_LOCKED) submission, invite_link`);
  } catch (error) {
    log({
      module,
      op: "vacuum",
      code: "INTERNAL",
      sqlstate: sqlstateOf(error),
    });
  }
}
