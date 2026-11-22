import type { z } from "zod";

export type ErrorCode =
  | "INVALID_INPUT"
  | "INVALID_CREDENTIALS"
  | "EMAIL_TAKEN"
  | "REGISTRATION_CODE_WRONG"
  | "NOT_FOUND"
  | "WRONG_STATE"
  | "QUESTION_CAP_REACHED"
  | "INTERNAL";

export const MESSAGES: Record<ErrorCode, string> = {
  INVALID_INPUT: "Sjekk feltene som er merket, og prøv igjen.",
  INVALID_CREDENTIALS: "Feil e-post eller passord.",
  EMAIL_TAKEN: "Det finnes allerede en konto med denne e-posten.",
  REGISTRATION_CODE_WRONG: "Registreringskoden stemmer ikke.",
  NOT_FOUND: "Vi finner ikke dette spillet.",
  WRONG_STATE: "Spillet er i en annen fase nå. Last inn siden på nytt.",
  QUESTION_CAP_REACHED: "Du har nådd maks 20 spørsmål.",
  INTERNAL: "Noe gikk galt hos oss. Prøv igjen om litt.",
};

export type FieldErrors = Record<string, string>;

export class DomainError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly fieldErrors?: FieldErrors,
  ) {
    super(code);
    this.name = "DomainError";
  }
}

export type Failure = {
  ok: false;
  code: ErrorCode;
  message: string;
  fieldErrors?: FieldErrors;
};

export type ActionResult<T> = { ok: true; data: T } | Failure;

// Anything that is not a DomainError becomes INTERNAL, so no foreign message reaches the client.
export function toFailure(error: unknown): Failure {
  const e = error instanceof DomainError ? error : new DomainError("INTERNAL");
  return {
    ok: false,
    code: e.code,
    message: MESSAGES[e.code],
    ...(e.fieldErrors && { fieldErrors: e.fieldErrors }),
  };
}

// Parses or throws INVALID_INPUT with the first message per top-level field.
export function validate<S extends z.ZodType>(
  schema: S,
  input: unknown,
): z.output<S> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  const fieldErrors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const field = String(issue.path[0] ?? "");
    fieldErrors[field] ??= issue.message;
  }
  throw new DomainError("INVALID_INPUT", fieldErrors);
}
