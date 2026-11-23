import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { DEMO_HOST } from "@/lib/demo";

// shortcut: tsconfig.cli.json maps next/navigation to a private Next path (next/dist/client/components/navigation.react-server.js), re-check it when upgrading Next

// AD-19. Set before any server module loads, since env.ts parses on import.
process.env.DATABASE_URL = "pglite://.data/demo";
process.env.JUDGE_PROVIDER = "replay";
process.env.DEMO_MODE = "1";
process.env.APP_BASE_URL = `http://localhost:${process.env.PORT || 3000}`;

const { env } = await import("@/server/env");
const { migrateFromEnv } = await import("@/server/db/migrate");
const { seed, seedAndClose } = await import("@/server/demo");

// A fixed path: no environment value can widen the delete.
await rm(path.join(process.cwd(), ".data", "demo"), {
  recursive: true,
  force: true,
});
await migrateFromEnv();
await seedAndClose(seed);

console.log(`
Toppsvar demo: ${env.APP_BASE_URL}/logg-inn
  E-post:  ${DEMO_HOST.email}
  Passord: ${DEMO_HOST.password}
`);

// Node plus Next's own bin, not a shell, so it runs the same on Windows.
const nextBin = createRequire(import.meta.url).resolve("next/dist/bin/next");
const child = spawn(
  process.execPath,
  [nextBin, "dev", "--port", String(env.PORT)],
  { stdio: "inherit" },
);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => child.kill(signal));
// Ended by a forwarded Ctrl+C or SIGTERM is a normal stop.
child.on("exit", (code, signal) => process.exit(signal ? 0 : (code ?? 1)));
