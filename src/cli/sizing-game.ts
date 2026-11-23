import { rm } from "node:fs/promises";
import path from "node:path";

// Set before any server module loads, since env.ts parses on import.
process.env.DATABASE_URL = "pglite://.data/sizing";

const { migrateFromEnv } = await import("@/server/db/migrate");
const { SIZING_HOST, seedSizingAndClose } = await import("@/server/sizing");

// A fixed path: no environment value can widen the delete.
await rm(path.join(process.cwd(), ".data", "sizing"), {
  recursive: true,
  force: true,
});
await migrateFromEnv();
await seedSizingAndClose();

console.log(`
Toppsvar sizing Game in .data/sizing
  E-post:  ${SIZING_HOST.email}
  Passord: ${SIZING_HOST.password}
`);
