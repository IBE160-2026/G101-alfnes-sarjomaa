import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;

// One fresh PGlite directory per run. Workers inherit process.env, so specs read
// the same path. The directory itself does not exist until the app opens the DB.
process.env.E2E_DB_DIR ??= path.join(
  mkdtempSync(path.join(tmpdir(), "toppsvar-e2e-")),
  "db",
);

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  // No retries: a retry would reuse the server and DB dir, so the first smoke test cannot pass twice.
  retries: 0,
  reporter: "list",
  use: { baseURL, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run build && npm run start",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 300_000,
    // All nine env.ts keys: next start loads .env.local but never overrides a key
    // already set, even to "", so nothing from a developer's .env.local leaks in.
    env: {
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
    },
  },
});
