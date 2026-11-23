import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

// realpath: git prints /private/var where macOS's tmpdir() says /var.
const temp = realpathSync(mkdtempSync(join(tmpdir(), "make-zip-")));
afterAll(() => rmSync(temp, { recursive: true, force: true }));

const ok = (cmd: string, args: string[]) =>
  spawnSync(cmd, args, { encoding: "utf8" }).stdout?.trim();
// The hand-in is an extracted zip with no .git, and Windows has no bash.
const win = process.platform === "win32";
const inRepo =
  !win && ok("git", ["rev-parse", "--is-inside-work-tree"]) === "true";
const hasUnzip = !win && spawnSync("unzip", ["-v"]).status === 0;

describe("scripts/make-zip.sh", () => {
  it.skipIf(!inRepo || !hasUnzip)(
    "NFR-8: builds the hand-in zip from HEAD, every entry under one folder, with no secrets or local data",
    () => {
      const out = join(temp, "hand-in.zip");
      const run = spawnSync("scripts/make-zip.sh", [out], {
        encoding: "utf8",
        timeout: 60_000,
      });
      expect(run.status).toBe(0);
      expect(run.stdout.trim()).toBe(out);

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
        expect(entry).not.toMatch(
          /(^|\/)(\.idea|\.data|\.next|node_modules)\//,
        );
        const base = entry.replace(/\/$/, "").split("/").pop() ?? "";
        if (base.startsWith(".env")) expect(base).toBe(".env.example");
      }
    },
  );
});
