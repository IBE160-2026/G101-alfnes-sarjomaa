import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const temp = mkdtempSync(join(tmpdir(), "make-zip-"));
afterAll(() => rmSync(temp, { recursive: true, force: true }));

describe("scripts/make-zip.sh", () => {
  it("NFR-8: builds the hand-in zip from HEAD, every entry under one folder, with no secrets or local data", () => {
    const out = join(temp, "hand-in.zip");
    const run = spawnSync("scripts/make-zip.sh", [out], {
      encoding: "utf8",
      timeout: 60_000,
    });
    expect(run.status).toBe(0);
    expect(run.stdout.trim()).toBe(out);
    const dirty =
      execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }) !==
      "";
    expect(run.stderr.includes("uncommitted changes are left out")).toBe(dirty);

    const entries = execFileSync("unzip", ["-Z1", out], {
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    })
      .split("\n")
      .filter(Boolean);
    expect(entries).toContain("G101-alfnes-sarjomaa/README.md");
    expect(entries).toContain("G101-alfnes-sarjomaa/.env.example");
    for (const entry of entries) {
      expect(entry.startsWith("G101-alfnes-sarjomaa/")).toBe(true);
      const path = entry.slice("G101-alfnes-sarjomaa/".length);
      expect(path).not.toMatch(
        /^(\.idea|\.data|\.next)\/|(^|\/)node_modules\//,
      );
      if (path.startsWith(".env")) expect(path).toBe(".env.example");
    }
  });

  it("NFR-8: writes G101-alfnes-sarjomaa.zip in the repository root by default", () => {
    const out = resolve("G101-alfnes-sarjomaa.zip");
    const run = spawnSync("scripts/make-zip.sh", [], {
      encoding: "utf8",
      timeout: 60_000,
    });
    expect(run.status).toBe(0);
    expect(run.stdout.trim()).toBe(out);
    expect(existsSync(out)).toBe(true);
    rmSync(out);
  });
});
