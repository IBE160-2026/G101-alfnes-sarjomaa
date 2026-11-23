import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const eslint = new ESLint();

async function ruleIds(filePath: string, code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });
  return result.messages.map((m) => m.ruleId ?? "fatal");
}

// One case per rule family; the folders of later modules are covered by the same rules.
const cases: [file: string, source: string, banned: boolean][] = [
  ["src/app/x.ts", "@/server/db", true],
  ["src/components/X.tsx", "@/server/judge", true],
  ["src/app/x.ts", "@/server/health", false],
  ["src/proxy.ts", "@/server/db", true],
  ["src/app/svar/[gameId]/x.ts", "@/server/auth", true],
  ["src/app/svar/[gameId]/x.ts", "@/server/db", true],
  ["src/components/LinkStatus.tsx", "@/server/auth", true],
  ["src/components/AnswerForm.tsx", "@/server/auth", true],
  ["src/app/spill/x.ts", "@/server/auth", false],
  ["src/lib/x.ts", "@/server/env", true],
  ["src/lib/x.ts", "@/lib/limits", false],
  ["src/server/auth/x.ts", "@/server/games", true],
  ["src/server/games/x.ts", "@/server/auth", false],
  ["src/server/games/x.ts", "@/server/judge/providers/mock", true],
  ["src/server/judge/x.ts", "@/server/games", true],
  ["src/server/grouping/x.ts", "@/server/judge/providers/replay", true],
  ["src/server/grouping/x.ts", "@/server/judge", false],
  ["src/server/judge/x.ts", "@/server/judge/providers/mock", false],
  ["src/server/grouping/x.ts", "@/server/judge/record", true],
  ["src/server/judge/x.ts", "@/server/judge/record", false],
  ["src/cli/x.ts", "@/server/judge/record", false],
  ["src/cli/x.ts", "@/server/judge/providers/mock", true],
  ["src/server/db/x.ts", "@/server/auth", true],
  ["src/server/games/x.ts", "@/app/page", true],
  ["src/cli/x.ts", "@/server/db/client", true],
  ["src/cli/x.ts", "@/server/db/migrate", false],
  ["src/cli/x.ts", "@/server/db/dump", false],
  ["src/server/games/x.ts", "../auth", true],
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

  it.each([
    ["src/server/grouping/x.ts", true],
    ["src/cli/x.ts", true],
    ["src/server/judge/providers/x.ts", false],
  ])(
    "AD-13: naming openrouter.ai in %s is banned: %s",
    async (file, banned) => {
      for (const code of [
        'fetch("https://openrouter.ai/api/v1/chat/completions");\n',
        "const host = `openrouter.ai`;\n",
        'fetch("https://OpenRouter.AI/api");\n',
      ]) {
        const ids = await ruleIds(file, code);
        expect(ids.includes("no-restricted-syntax")).toBe(banned);
        expect(ids).not.toContain("fatal");
      }
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
