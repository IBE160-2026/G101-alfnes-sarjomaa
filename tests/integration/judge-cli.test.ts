import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const temp = mkdtempSync(join(tmpdir(), "judge-cli-"));
afterAll(() => rmSync(temp, { recursive: true, force: true }));

// No --env-file flag, so a developer's .env or .env.local is never read here.
function cli(script: string, key: string, ...args: string[]) {
  return spawnSync(
    "node_modules/.bin/tsx",
    ["--conditions=react-server", `src/cli/${script}`, ...args],
    {
      encoding: "utf8",
      env: { ...process.env, OPENROUTER_API_KEY: key },
      timeout: 30_000,
    },
  );
}

describe("judge CLIs before any network call", () => {
  it("AD-13: without a key judge:smoke prints that it skipped and exits 0", () => {
    const { status, stdout } = cli("judge-smoke.ts", "");
    expect(stdout.trim()).toBe("skipped: no OPENROUTER_API_KEY");
    expect(status).toBe(0);
  });

  it("AD-14 (AC5): without a key judge:record refuses with exit 1 and names the variable, before reading its input", () => {
    const { status, stdout, stderr } = cli(
      "judge-record.ts",
      "",
      "absent.json",
      ".data/rulings/x.json",
    );
    expect(stderr).toMatch(/OPENROUTER_API_KEY/);
    expect(stdout).toBe("");
    expect(status).toBe(1);
  });

  it("AD-14 (AC5): with a key judge:record refuses an output path outside .data/ with exit 1", () => {
    const { status, stdout, stderr } = cli(
      "judge-record.ts",
      "x",
      "absent.json",
      "src/x.json",
    );
    expect(stderr).toMatch(/Refusing to write/);
    expect(stdout).toBe("");
    expect(status).toBe(1);
  });

  it("AD-14 (AC5): with a key judge:record rejects a malformed input file with exit 1 and writes no output", () => {
    const input = join(temp, "in.json");
    writeFileSync(input, JSON.stringify([{ question: "Nevn et dyr" }]));
    const output = `.data/judge-cli-${process.pid}.json`;
    const { status, stdout, stderr } = cli(
      "judge-record.ts",
      "x",
      input,
      output,
    );
    expect(stderr).toMatch(/Invalid input/);
    expect(stdout).toBe("");
    expect(status).toBe(1);
    expect(existsSync(output)).toBe(false);
  });
});
