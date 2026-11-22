import { describe, expect, it } from "vitest";
import { collapseChips, fallbackNotice } from "@/lib/review";

const KEY =
  "Ingen KI-nøkkel er satt opp, så alle spørsmålene starter med én gruppe per ulikt svar.";

const q = (
  position: number,
  fallbackReason: string | null,
  reviewed = false,
) => ({ position, fallbackReason, reviewed });

describe("collapseChips", () => {
  it("FR-19 (AC3): equal normalised texts become one chip in the most common written form, with n Answers", () => {
    expect(
      collapseChips([
        { text: "Kari", normalizedText: "kari" },
        { text: "kari", normalizedText: "kari" },
        { text: "kari!", normalizedText: "kari" },
        { text: "kari", normalizedText: "kari" },
      ]),
    ).toEqual([{ text: "kari", n: 4 }]);
  });

  it("FR-19 (AC3): a tie keeps the first written form in SQL order", () => {
    expect(
      collapseChips([
        { text: "Kari", normalizedText: "kari" },
        { text: "kari", normalizedText: "kari" },
      ]),
    ).toEqual([{ text: "Kari", n: 2 }]);
  });

  it("FR-13, FR-19 (AC3): chips keep the given (alphabetical) order", () => {
    expect(
      collapseChips([
        { text: "Anne", normalizedText: "anne" },
        { text: "bjørn", normalizedText: "bjørn" },
        { text: "Bjørn", normalizedText: "bjørn" },
        { text: "Bjørn", normalizedText: "bjørn" },
        { text: "ola", normalizedText: "ola" },
      ]),
    ).toEqual([
      { text: "Anne", n: 1 },
      { text: "Bjørn", n: 3 },
      { text: "ola", n: 1 },
    ]);
  });
});

describe("fallbackNotice", () => {
  it("FR-17 (AC4): no fallback Question means no Notice", () => {
    expect(fallbackNotice([q(1, null), q(2, null)], false)).toBeNull();
  });

  it("FR-17 (AC4): every Question NO_KEY outside Demo mode gives the key sentence", () => {
    expect(fallbackNotice([q(1, "NO_KEY"), q(2, "NO_KEY")], false)).toBe(KEY);
  });

  it("FR-17 (AC4): in Demo mode NO_KEY reads as no stored ruling, never the key sentence", () => {
    expect(fallbackNotice([q(1, "NO_KEY"), q(2, "NO_KEY")], true)).toBe(
      "Det finnes ingen lagret avgjørelse for spørsmål 1 og 2, så de starter med én gruppe per ulikt svar.",
    );
  });

  it("FR-17 (AC4): NO_KEY on some Questions while others have Judge Groups names them instead of the key sentence", () => {
    expect(fallbackNotice([q(1, null), q(2, "NO_KEY")], false)).toBe(
      "Det finnes ingen lagret avgjørelse for spørsmål 2, så det starter med én gruppe per ulikt svar.",
    );
  });

  it("FR-17 (AC4): NO_STORED_RULING on every Question still names them, never the key sentence", () => {
    expect(
      fallbackNotice(
        [
          q(1, "NO_STORED_RULING"),
          q(2, "NO_STORED_RULING"),
          q(3, "NO_STORED_RULING"),
        ],
        false,
      ),
    ).toBe(
      "Det finnes ingen lagret avgjørelse for spørsmål 1, 2 og 3, så de starter med én gruppe per ulikt svar.",
    );
  });

  it.each(["TIMEOUT", "ERROR", "REFUSAL", "INVALID_OUTPUT"])(
    "FR-17 (AC4): %s reads as the Judge did not group the Question",
    (reason) => {
      expect(fallbackNotice([q(1, null), q(4, reason)], false)).toBe(
        "Dommeren fikk ikke gruppert spørsmål 4. Det starter med én gruppe per ulikt svar.",
      );
    },
  );

  it("FR-17 (AC4): several failures and a missing ruling give both sentences with plural lists", () => {
    expect(
      fallbackNotice(
        [q(1, "NO_STORED_RULING"), q(2, null), q(4, "TIMEOUT"), q(7, "ERROR")],
        false,
      ),
    ).toBe(
      "Det finnes ingen lagret avgjørelse for spørsmål 1, så det starter med én gruppe per ulikt svar. Dommeren fikk ikke gruppert spørsmål 4 og 7. De starter med én gruppe per ulikt svar.",
    );
  });

  it("FR-17 (AC4): the Notice stays while any fallback Question is unreviewed and goes once all are reviewed", () => {
    expect(fallbackNotice([q(1, "TIMEOUT", true), q(2, "ERROR")], false)).toBe(
      "Dommeren fikk ikke gruppert spørsmål 1 og 2. De starter med én gruppe per ulikt svar.",
    );
    expect(
      fallbackNotice(
        [q(1, "TIMEOUT", true), q(2, "ERROR", true), q(3, null)],
        false,
      ),
    ).toBeNull();
    expect(fallbackNotice([q(1, "NO_KEY", true)], false)).toBeNull();
  });
});
