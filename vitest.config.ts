import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const fromRoot = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\//, replacement: `${fromRoot("./src")}/` },
      {
        find: /^server-only$/,
        replacement: fromRoot("./node_modules/server-only/empty.js"),
      },
    ],
  },
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    // TEST_POSTGRES_URL switches to the CI Postgres job's per-file databases.
    setupFiles: process.env.TEST_POSTGRES_URL
      ? ["tests/postgres-setup.ts", "tests/setup.ts"]
      : ["tests/setup.ts"],
    // Each integration file migrates its own PGlite. With every file in parallel, on a loaded
    // laptop or a small CI runner, that can exceed the 5 s / 10 s defaults.
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // All nine env.ts keys, so nothing from the shell leaks in. Empty means unset.
    env: {
      DATABASE_URL: "pglite://:memory:",
      PORT: "",
      APP_BASE_URL: "",
      OPENROUTER_API_KEY: "",
      JUDGE_PROVIDER: "mock",
      JUDGE_MODEL: "",
      DEMO_MODE: "",
      REGISTRATION_CODE: "",
      CRON_SECRET: "",
    },
  },
});
