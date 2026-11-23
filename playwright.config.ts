import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;
const DEV_PORT = 3101;
// Set, not defaulted: the dev server always listens on DEV_PORT, and specs read this.
const devURL = `http://localhost:${DEV_PORT}`;
process.env.E2E_DEV_URL = devURL;

// One fresh PGlite directory per run. Workers inherit process.env, so specs read
// the same path. The directory itself does not exist until the app opens the DB.
process.env.E2E_DB_DIR ??= path.join(
  mkdtempSync(path.join(tmpdir(), "toppsvar-e2e-")),
  "db",
);
// Both servers' stdout and stderr, and the values the browsers sent, land here; the
// global teardown fails the run if any value appears in a log (FR-11).
process.env.E2E_OUT_DIR ??= path.dirname(process.env.E2E_DB_DIR);
const OUT = process.env.E2E_OUT_DIR;

// All nine env.ts keys: next start loads .env.local but never overrides a key
// already set, even to "", so nothing from a developer's .env.local leaks in.
const env = {
  DATABASE_URL: `pglite://${process.env.E2E_DB_DIR}`,
  PORT: String(PORT),
  APP_BASE_URL: baseURL,
  OPENROUTER_API_KEY: "",
  JUDGE_PROVIDER: "replay",
  JUDGE_MODEL: "",
  DEMO_MODE: "",
  REGISTRATION_CODE: "",
  CRON_SECRET: "",
  NEXT_TELEMETRY_DISABLED: "1",
};

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  // No retries: a retry would reuse the server and DB dir, so the first smoke test cannot pass twice.
  retries: 0,
  reporter: "list",
  use: { baseURL, trace: "retain-on-failure" },
  // The smoke spec asserts the DB is still unopened, so it runs before any spec that registers a Host.
  projects: [
    {
      name: "smoke",
      testMatch: "smoke.spec.ts",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "chromium",
      testIgnore: "smoke.spec.ts",
      dependencies: ["smoke"],
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  globalTeardown: "./tests/e2e/server-output.teardown.ts",
  webServer: [
    {
      command: `npm run build && npm run start > "${OUT}/start.log" 2>&1`,
      url: baseURL,
      reuseExistingServer: false,
      timeout: 300_000,
      env,
    },
    // Only next dev prints Server Function arguments and forwards browser console output,
    // so server-output.spec.ts drives this one. It is npm run demo (next dev on .data/demo,
    // replay, DEMO_MODE=1), which demo.spec.ts needs, since one next dev runs per repo.
    // The demo sets its own DATABASE_URL, JUDGE_PROVIDER, DEMO_MODE and APP_BASE_URL.
    // shortcut: Next 16's lockDistDir lets one next dev run per repo, so this exits (reason in dev.log) while a developer's npm run dev or demo runs, and every e2e run deletes and recreates the working copy's .data/demo; give it its own distDir if that bites.
    {
      command: `npm run demo > "${OUT}/dev.log" 2>&1`,
      url: `${devURL}/api/health`,
      reuseExistingServer: false,
      timeout: 300_000,
      env: { ...env, PORT: String(DEV_PORT) },
    },
  ],
});
