import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const STAGE_1_FRS = [
  ...Array.from({ length: 21 }, (_, i) => i + 1),
  23,
  24,
  25,
  26,
  27,
  30,
  31,
  32,
].map((n) => `FR-${n}`);
const STORY_NFRS = [
  "NFR-1",
  "NFR-2",
  "NFR-3",
  "NFR-4",
  "NFR-5",
  "NFR-6",
  "NFR-7",
  "NFR-8",
];

// Each "## " heading with the "- " bullets under it.
const sections = new Map<string, string[]>();
let current: string[] = [];
for (const line of readFileSync("tests/TRACE.md", "utf8").split("\n")) {
  if (line.startsWith("## "))
    sections.set(line.slice(3).trim(), (current = []));
  else if (line.startsWith("- ")) current.push(line);
}
// A bullet traces when it says CI runs something or names a file under tests/ (a test or a
// manual item) that exists. Bullets that start with "Pending" or "Open", or say "not in CI" or
// "Open until", never trace.
const traces = (bullet: string) =>
  !/^- (Pending|Open)\b|not in CI|Open until/.test(bullet) &&
  (/\bCI runs\b/.test(bullet) ||
    [...bullet.matchAll(/`(tests\/[^`\s]+)`/g)].some(([, path]) =>
      existsSync(path),
    ));

describe("tests/TRACE.md", () => {
  it.each(STAGE_1_FRS)("SM-1: has a heading for Stage 1 %s", (id) => {
    expect(sections.has(id)).toBe(true);
  });

  it.each(STAGE_1_FRS)(
    "SM-1: Stage 1 %s has a bullet naming a test, a manual item or CI",
    (id) => {
      expect((sections.get(id) ?? []).some(traces)).toBe(true);
    },
  );

  it("SM-1: bullets that say they are not covered never trace", () => {
    expect(traces("- CI runs `npm run demo`.")).toBe(true);
    for (const bullet of [
      "- Timed by hand, not in CI.",
      "- `tests/manual/anonymity-audit.md`: the audit. Open until it is run.",
      "- Mentions CI without running anything.",
    ])
      expect(traces(bullet), bullet).toBe(false);
  });

  it.each(STORY_NFRS)("SM-1: has a heading for %s", (id) => {
    expect(sections.has(id)).toBe(true);
  });
});
