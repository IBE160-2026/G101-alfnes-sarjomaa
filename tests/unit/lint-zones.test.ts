import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const eslint = new ESLint();

async function ruleIds(filePath: string, code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });
  return result.messages.map((m) => m.ruleId ?? "fatal");
}

const cases: [file: string, source: string, banned: boolean][] = [
  ["src/app/x.ts", "@/server/db", true],
  ["src/app/x.ts", "@/server/db/client", true],
  ["src/components/X.tsx", "@/server/judge", true],
  ["src/app/x.ts", "@/server/health", false],
  ["src/lib/x.ts", "@/server/env", true],
  ["src/lib/x.ts", "@/components/Button", true],
  ["src/lib/x.ts", "@/lib/limits", false],
  ["src/server/auth/x.ts", "@/server/games", true],
  ["src/server/auth/x.ts", "@/server/db", false],
  ["src/server/games/x.ts", "@/server/auth", false],
  ["src/server/questions/x.ts", "@/server/games", false],
  ["src/server/collection/x.ts", "@/server/review", true],
  ["src/server/play/x.ts", "@/server/review", false],
  ["src/server/games/x.ts", "@/server/db", false],
  ["src/server/games/x.ts", "@/server/judge", false],
  ["src/server/games/x.ts", "@/server/judge/providers/mock", true],
  ["src/server/judge/x.ts", "@/server/judge/providers/mock", false],
  ["src/server/judge/x.ts", "@/server/games", true],
  ["src/server/db/x.ts", "@/server/auth", true],
  ["src/cli/x.ts", "@/server/db/client", true],
  ["src/cli/x.ts", "@/server/db", true],
  ["src/cli/x.ts", "@/server/db/migrate", false],
  ["src/server/games/x.ts", "../auth", true],
  ["tests/unit/x.test.ts", "../setup", true],
  ["src/server/games/x.ts", "./../auth", true],
  ["src/server/games/x.ts", "@/app/page", true],
  ["src/server/log.ts", "@/components/Button", true],
  ["src/proxy.ts", "@/server/db", true],
];

describe("ESLint layer zones", () => {
  it.each(cases)(
    "AD-1: %s importing %s is banned: %s",
    async (file, source, banned) => {
      const ids = await ruleIds(file, `import "${source}";\n`);
      expect(ids.includes("no-restricted-imports")).toBe(banned);
      expect(ids).not.toContain("fatal");
    },
  );

  it("AD-17: console is banned outside src/server/log.ts", async () => {
    expect(
      await ruleIds("src/server/games/x.ts", 'console.log("x");\n'),
    ).toContain("no-console");
    expect(
      await ruleIds("src/server/log.ts", 'console.log("x");\n'),
    ).not.toContain("no-console");
  });
});
