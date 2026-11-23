import { describe, expect, it } from "vitest";
import { ANSWERS_PER_QUESTION_MAX, INVITE_LINKS_MAX } from "@/lib/limits";
import {
  collapseChips,
  fallbackNotice,
  mergeGroupsSchema,
  moveAnswersSchema,
  renameGroupSchema,
} from "@/lib/review";

const KEY =
  "Ingen KI-nøkkel er satt opp, så alle spørsmålene starter med én gruppe per ulikt svar.";

const q = (
  position: number,
  fallbackReason: string | null,
  reviewed = false,
) => ({ position, fallbackReason, reviewed });

// Answers in SQL order, with ids a1, a2, … in that order.
const answers = (...rows: [string, string][]) =>
  rows.map(([text, normalizedText], i) => ({
    id: `a${i + 1}`,
    text,
    normalizedText,
  }));

describe("collapseChips", () => {
  it("FR-19 (AC3): equal normalised texts become one chip in the most common written form, with n Answers", () => {
    expect(
      collapseChips(
        answers(
          ["Kari", "kari"],
          ["kari", "kari"],
          ["kari!", "kari"],
          ["kari", "kari"],
        ),
      ),
    ).toEqual([{ text: "kari", n: 4, ids: ["a1", "a2", "a3", "a4"] }]);
  });

  it("FR-19 (AC3): a tie keeps the first written form in SQL order", () => {
    expect(collapseChips(answers(["Kari", "kari"], ["kari", "kari"]))).toEqual([
      { text: "Kari", n: 2, ids: ["a1", "a2"] },
    ]);
  });

  it("FR-13, FR-19, FR-20 (AC3): chips keep the given (alphabetical) order, each with its own Answers' ids", () => {
    expect(
      collapseChips(
        answers(
          ["Anne", "anne"],
          ["bjørn", "bjørn"],
          ["Bjørn", "bjørn"],
          ["Bjørn", "bjørn"],
          ["ola", "ola"],
        ),
      ),
    ).toEqual([
      { text: "Anne", n: 1, ids: ["a1"] },
      { text: "Bjørn", n: 3, ids: ["a2", "a3", "a4"] },
      { text: "ola", n: 1, ids: ["a5"] },
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

describe("mergeGroupsSchema", () => {
  const ok = (groupIds: unknown) =>
    mergeGroupsSchema.safeParse({ gameId: "g", groupIds }).success;
  const ids = (n: number) => Array.from({ length: n }, (_, i) => `id-${i}`);
  const MAX = INVITE_LINKS_MAX * ANSWERS_PER_QUESTION_MAX;

  it("FR-20 (AC2): takes 2 to one Group per possible Answer, all distinct", () => {
    expect(ok(ids(2))).toBe(true);
    expect(ok(ids(MAX))).toBe(true);
  });

  it("FR-20 (AC2): refuses fewer than two, more than the cap, duplicates and non-strings", () => {
    expect(ok([])).toBe(false);
    expect(ok(ids(1))).toBe(false);
    expect(ok(ids(MAX + 1))).toBe(false);
    expect(ok(["a", "a"])).toBe(false);
    expect(ok(["a", 1])).toBe(false);
    expect(ok("a,b")).toBe(false);
  });
});

describe("moveAnswersSchema", () => {
  const ok = (input: object) =>
    moveAnswersSchema.safeParse({ gameId: "g", ...input }).success;
  const ids = (n: number) => Array.from({ length: n }, (_, i) => `id-${i}`);
  const MAX = INVITE_LINKS_MAX * ANSWERS_PER_QUESTION_MAX;

  it("FR-20 (AC1): takes 1 to every possible Answer, all distinct, with or without a target", () => {
    expect(ok({ answerIds: ids(1) })).toBe(true);
    expect(ok({ answerIds: ids(MAX), groupId: "t" })).toBe(true);
  });

  it("FR-20 (AC2): refuses none, more than the cap, duplicates and non-strings", () => {
    expect(ok({ answerIds: [] })).toBe(false);
    expect(ok({ answerIds: ids(MAX + 1) })).toBe(false);
    expect(ok({ answerIds: ["a", "a"] })).toBe(false);
    expect(ok({ answerIds: ["a", 1] })).toBe(false);
    expect(ok({ answerIds: ["a"], groupId: 1 })).toBe(false);
  });
});

describe("renameGroupSchema", () => {
  const parse = (label: unknown) =>
    renameGroupSchema.safeParse({ gameId: "g", groupId: "x", label });

  it("FR-20 (AC4): trims and takes 1 to 40 characters", () => {
    expect(parse("  Ny  ").data?.label).toBe("Ny");
    expect(parse("x".repeat(40)).success).toBe(true);
  });

  it("FR-20 (AC4): empty and over 40 characters give the field messages", () => {
    expect(parse("   ").error?.issues[0].message).toBe("Skriv et navn.");
    expect(parse("x".repeat(41)).error?.issues[0].message).toBe(
      "Navnet kan ha maks 40 tegn.",
    );
  });
});
