import { describe, expect, it } from "vitest";
import {
  ANSWER_MISSING,
  ANSWER_TOO_LONG,
  parseAnswerSet,
  toFields,
} from "@/lib/answer-set";
import { DomainError, MESSAGES } from "@/lib/errors";

const IDS = ["q1", "q2"];

function fieldErrorsOf(input: unknown, ids: readonly string[] = IDS) {
  try {
    parseAnswerSet(input, ids);
  } catch (error) {
    expect(error).toBeInstanceOf(DomainError);
    expect((error as DomainError).code).toBe("INVALID_INPUT");
    return (error as DomainError).fieldErrors;
  }
  throw new Error("expected INVALID_INPUT");
}

describe("parseAnswerSet", () => {
  it("FR-6: trims, drops empty fields and keeps field order (rank = index + 1)", () => {
    expect(
      parseAnswerSet({ q1: [" a ", "", "c"], q2: ["  ", "b", ""] }, IDS),
    ).toEqual({ q1: ["a", "c"], q2: ["b"] });
  });

  it("FR-6: 80 trimmed characters are accepted, 81 refused under the field index key", () => {
    const max = "x".repeat(80);
    expect(parseAnswerSet({ q1: [`  ${max}  `], q2: ["b"] }, IDS)).toEqual({
      q1: [max],
      q2: ["b"],
    });
    expect(fieldErrorsOf({ q1: ["a", "x".repeat(81)], q2: ["b"] })).toEqual({
      "q1.1": ANSWER_TOO_LONG,
    });
    expect(ANSWER_TOO_LONG).toBe("Svaret kan ha maks 80 tegn.");
  });

  it("FR-6: six entries fail with the Question key, five pass", () => {
    expect(fieldErrorsOf({ q1: Array(6).fill("a"), q2: ["b"] })).toEqual({
      q1: MESSAGES.INVALID_INPUT,
    });
    expect(
      parseAnswerSet({ q1: Array(5).fill("a"), q2: ["b"] }, IDS).q1,
    ).toHaveLength(5);
  });

  it("FR-6: a missing key and an all-blank Question are both Skriv minst ett svar.", () => {
    expect(fieldErrorsOf({ q1: ["a"] })).toEqual({ q2: ANSWER_MISSING });
    expect(fieldErrorsOf({ q1: ["", "  "], q2: [] })).toEqual({
      q1: ANSWER_MISSING,
      q2: ANSWER_MISSING,
    });
    expect(ANSWER_MISSING).toBe("Skriv minst ett svar.");
  });

  it("FR-6: an unknown Question ID fails under its own key", () => {
    expect(fieldErrorsOf({ q1: ["a"], q2: ["b"], q3: ["c"] })).toEqual({
      q3: MESSAGES.INVALID_INPUT,
    });
  });

  it.each([
    ["null", null],
    ["a string", "svar"],
    ["an array", [["a"], ["b"]]],
  ])("FR-6: %s as the Answer set fails", (_, input) => {
    expect(fieldErrorsOf(input)).toBeDefined();
  });

  it("FR-6: a value that is not an array, or a non-string entry, fails", () => {
    expect(fieldErrorsOf({ q1: "a", q2: ["b"] })).toEqual({
      q1: MESSAGES.INVALID_INPUT,
    });
    expect(fieldErrorsOf({ q1: ["a", 7], q2: ["b"] })).toEqual({
      "q1.1": MESSAGES.INVALID_INPUT,
    });
  });
});

describe("toFields", () => {
  it("FR-7: a saved set becomes form fields, padded to two per Question", () => {
    expect(toFields({ q1: ["a", "b", "c"], q2: ["d"] }, IDS)).toEqual({
      q1: ["a", "b", "c"],
      q2: ["d", ""],
    });
  });

  it("FR-6, AD-8: a tampered draft gives at most five string fields, at least two, known Questions only", () => {
    expect(
      toFields(
        { q1: Array(7).fill("x"), q2: ["a", 7, null, "b"], q3: ["z"] },
        IDS,
      ),
    ).toEqual({ q1: Array(5).fill("x"), q2: ["a", "b"] });
    expect(toFields({ q1: "a", q2: { 0: "b" } }, IDS)).toEqual({
      q1: ["", ""],
      q2: ["", ""],
    });
  });

  it.each([
    ["undefined", undefined],
    ["null", null],
    ["a string", "utkast"],
    ["a number", 7],
  ])("FR-6: %s gives empty fields and never throws", (_, input) => {
    expect(toFields(input, IDS)).toEqual({ q1: ["", ""], q2: ["", ""] });
  });
});
