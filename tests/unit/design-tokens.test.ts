import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const DESIGN =
  ".docs/planning-artifacts/ux-designs/ux-Toppsvar-2026-11-21/DESIGN.md";
const css = readFileSync("src/app/globals.css", "utf8");
const frontmatter = readFileSync(DESIGN, "utf8").split("\n---\n")[0];

// Line scan of one top-level frontmatter block: two-space keys, four-space fields.
function block(name: string) {
  const lines = frontmatter.split("\n");
  const start = lines.indexOf(`${name}:`);
  const entries: Record<string, Record<string, string> | string> = {};
  let key = "";
  for (const line of lines.slice(start + 1)) {
    if (/^\S/.test(line)) break;
    const field = line.match(/^ {4}([\w-]+): (.+)$/);
    const entry = line.match(/^ {2}'?([\w-]+)'?:(?: (.+))?$/);
    if (field && key) {
      (entries[key] as Record<string, string>)[field[1]] = unquote(field[2]);
    } else if (entry) {
      key = entry[1];
      entries[key] = entry[2] === undefined ? {} : unquote(entry[2]);
    }
  }
  return entries;
}

const unquote = (v: string) => v.trim().replace(/^'(.*)'$/, "$1");

function declared(name: string) {
  const m = css.match(new RegExp(`^\\s*--${name}:\\s*([^;]+);`, "m"));
  return m?.[1].trim().toLowerCase();
}

const colors = Object.entries(block("colors"));
const type = Object.entries(block("typography")) as [
  string,
  Record<string, string>,
][];
const radii = Object.entries(block("rounded"));

describe("globals.css @theme matches DESIGN.md", () => {
  it("UX-DR1: reads every token group from DESIGN.md", () => {
    expect(colors).toHaveLength(28);
    expect(type).toHaveLength(14);
    expect(radii).toHaveLength(4);
  });

  it.each(colors)("UX-DR1: --color-%s equals %s", (key, value) => {
    expect(declared(`color-${key}`)).toBe(String(value).toLowerCase());
  });

  it.each(type)("UX-DR1: --text-%s and its companions match", (key, t) => {
    expect(declared(`text-${key}`)).toBe(t.fontSize);
    expect(declared(`text-${key}--line-height`)).toBe(t.lineHeight);
    expect(declared(`text-${key}--font-weight`)).toBe(t.fontWeight);
    if (t.letterSpacing)
      expect(declared(`text-${key}--letter-spacing`)).toBe(t.letterSpacing);
  });

  it.each(radii)("UX-DR1: --radius-%s equals %s", (key, value) => {
    expect(declared(`radius-${key}`)).toBe(value);
  });

  it("UX-DR1: Tailwind's default colors and text sizes are reset", () => {
    expect(css).toMatch(/--color-\*:\s*initial;/);
    expect(css).toMatch(/--text-\*:\s*initial;/);
  });
});
