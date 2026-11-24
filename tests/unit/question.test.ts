import { randomUUID } from "node:crypto";
import { webcrypto } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DomainError, validate } from "@/lib/errors";
import { newQuestionId, saveQuestionSchema } from "@/lib/question";

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

describe("newQuestionId", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("FR-4: gives a version-4 UUID that saveQuestionSchema accepts, without crypto.randomUUID (plain http://<LAN-IP>)", () => {
    vi.stubGlobal("crypto", {
      getRandomValues: <T extends Uint8Array>(a: T) =>
        webcrypto.getRandomValues(a),
    });
    expect(crypto.randomUUID).toBeUndefined();
    const ids = Array.from({ length: 200 }, newQuestionId);
    for (const id of ids) {
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
      expect(validate(saveQuestionSchema, input("Hva?", id)).questionId).toBe(
        id,
      );
    }
    expect(new Set(ids).size).toBe(ids.length);
  });
});
