import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { DomainError, validate } from "@/lib/errors";
import { saveQuestionSchema } from "@/lib/question";

const MESSAGE = "Spørsmålet må ha 1–200 tegn.";
const input = (text: string, questionId: string = randomUUID()) => ({
  gameId: randomUUID(),
  questionId,
  text,
});

function fieldErrorsOf(value: unknown) {
  try {
    validate(saveQuestionSchema, value);
  } catch (error) {
    return (error as DomainError).fieldErrors;
  }
  return null;
}

describe("saveQuestionSchema", () => {
  it.each([
    ["an empty", ""],
    ["a whitespace-only", "   "],
    ["a 201-character", "a".repeat(201)],
  ])("FR-4: refuses %s text with the length message", (_, text) => {
    expect(fieldErrorsOf(input(text))).toEqual({ text: MESSAGE });
  });

  it("FR-4: accepts 1 and 200 characters and trims", () => {
    expect(validate(saveQuestionSchema, input("a")).text).toBe("a");
    expect(validate(saveQuestionSchema, input("a".repeat(200))).text).toBe(
      "a".repeat(200),
    );
    expect(validate(saveQuestionSchema, input("  Hva?  ")).text).toBe("Hva?");
  });

  it("FR-4: refuses a questionId that is not a UUID", () => {
    expect(fieldErrorsOf(input("Hva?", "abc"))).toHaveProperty("questionId");
  });
});
