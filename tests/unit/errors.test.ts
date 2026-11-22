import { describe, expect, it } from "vitest";
import { z } from "zod";
import { DomainError, MESSAGES, toFailure, validate } from "@/lib/errors";

describe("errors", () => {
  it("FR-1, AD-4: NOT_FOUND and WRONG_STATE have their exact bokmål messages", () => {
    expect(MESSAGES.NOT_FOUND).toBe("Vi finner ikke dette spillet.");
    expect(MESSAGES.WRONG_STATE).toBe(
      "Spillet er i en annen fase nå. Last inn siden på nytt.",
    );
  });

  it("AD-17: toFailure gives the action result shape for a DomainError", () => {
    expect(
      toFailure(
        new DomainError("EMAIL_TAKEN", { email: MESSAGES.EMAIL_TAKEN }),
      ),
    ).toEqual({
      ok: false,
      code: "EMAIL_TAKEN",
      message: "Det finnes allerede en konto med denne e-posten.",
      fieldErrors: {
        email: "Det finnes allerede en konto med denne e-posten.",
      },
    });
    expect(toFailure(new DomainError("INVALID_CREDENTIALS"))).toEqual({
      ok: false,
      code: "INVALID_CREDENTIALS",
      message: "Feil e-post eller passord.",
    });
  });

  it("FR-11: any other error becomes INTERNAL without its original message", () => {
    const failure = toFailure(new Error("secret@example.test hemmelig"));
    expect(failure).toEqual({
      ok: false,
      code: "INTERNAL",
      message: "Noe gikk galt hos oss. Prøv igjen om litt.",
    });
    expect(JSON.stringify(failure)).not.toContain("secret");
  });

  it("AD-17: validate throws INVALID_INPUT with the first message per field", () => {
    const schema = z.object({ a: z.string().min(2, "kort").max(1, "lang") });
    expect(() => validate(schema, { a: "" })).toThrow(DomainError);
    try {
      validate(schema, { a: "" });
    } catch (error) {
      expect(toFailure(error)).toMatchObject({
        code: "INVALID_INPUT",
        fieldErrors: { a: "kort" },
      });
    }
  });
});
