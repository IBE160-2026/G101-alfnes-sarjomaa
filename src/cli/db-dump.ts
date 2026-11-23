import { dumpFromEnv } from "@/server/db/dump";

try {
  console.log(JSON.stringify(await dumpFromEnv(), null, 2));
} catch (error) {
  // Never the message: a postgres URL may carry a password.
  // Drizzle wraps a driver error in one carrying it as `cause`.
  const { code, cause } = (error ?? {}) as {
    code?: unknown;
    cause?: { code?: unknown };
  };
  const shown = typeof code === "string" ? code : cause?.code;
  console.error(
    `db:dump failed${typeof shown === "string" ? ` (${shown})` : ""}. Check DATABASE_URL.`,
  );
  process.exitCode = 1;
}
