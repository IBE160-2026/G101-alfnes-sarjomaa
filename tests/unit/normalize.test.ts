import { describe, expect, it } from "vitest";
import { normalize, NORMALIZE_VERSION } from "@/lib/normalize";

describe("normalize", () => {
  it("FR-17: exports NORMALIZE_VERSION 1", () => {
    expect(NORMALIZE_VERSION).toBe(1);
  });

  it("FR-17: applies NFC, so a decomposed å equals the composed one", () => {
    expect(normalize("Båder")).toBe("båder");
    expect(normalize("Båder")).toBe(normalize("Båder"));
  });

  it("FR-17: lower-cases without a locale, including Æ, Ø, Å and a Turkish dotted İ", () => {
    expect(normalize("ÆØÅ Kari")).toBe("æøå kari");
    // The locale-free mapping keeps the dot as U+0307; a Turkish locale would give plain "i".
    expect(normalize("İstanbul")).toBe("i̇stanbul");
    expect(normalize("I")).toBe("i");
  });

  it("FR-17: trims and collapses inner whitespace, tabs and newlines included", () => {
    expect(normalize("  Kari \t og\n\n Ola  ")).toBe("kari og ola");
  });

  it("FR-17: strips trailing .,!?;:… mixed with spaces, but not inside the text", () => {
    expect(normalize("Kari!")).toBe("kari");
    expect(normalize("Kari . ! ? ;: … ,")).toBe("kari");
    expect(normalize("Kari...")).toBe("kari");
    expect(normalize("K.a,r!i?")).toBe("k.a,r!i");
  });

  it("FR-17: falls back to the trimmed lower-cased text when nothing else is left", () => {
    expect(normalize(" ?! ")).toBe("?!");
    expect(normalize("…")).toBe("…");
    expect(normalize("  ")).toBe("");
  });
});
