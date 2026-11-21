import { readFileSync } from "node:fs";
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
const STORY_NFRS = ["NFR-1", "NFR-2", "NFR-3", "NFR-6", "NFR-7", "NFR-8"];

const headings = new Set(
  readFileSync("tests/TRACE.md", "utf8")
    .split("\n")
    .filter((line) => line.startsWith("## "))
    .map((line) => line.slice(3).trim()),
);

describe("tests/TRACE.md", () => {
  it.each(STAGE_1_FRS)("SM-1: has a heading for Stage 1 %s", (id) => {
    expect(headings.has(id)).toBe(true);
  });

  it.each(STORY_NFRS)("SM-1: has a heading for %s", (id) => {
    expect(headings.has(id)).toBe(true);
  });
});
