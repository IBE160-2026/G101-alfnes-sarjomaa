import { describe, expect, it } from "vitest";
import { loginSchema, registrationSchema } from "@/lib/account";

const EMAIL = "vert@example.test";

function passwordError(password: string) {
  const result = registrationSchema.safeParse({
    email: EMAIL,
    password,
    registrationCode: "",
  });
  return result.success ? null : result.error.issues[0].message;
}

describe("registrationSchema", () => {
  it.each([
    [9, "Passordet må ha minst 10 tegn."],
    [10, null],
    [256, null],
    [257, "Passordet kan ha maks 256 tegn."],
  ])("FR-1: a %i-character password gives %j", (length, message) => {
    expect(passwordError("p".repeat(length))).toBe(message);
  });

  it("FR-1: never trims the password", () => {
    expect(passwordError(`${" ".repeat(5)}abcd${" ".repeat(5)}`)).toBeNull();
  });

  it("FR-1: trims the email and keeps its case", () => {
    const result = registrationSchema.parse({
      email: "  Vert@Example.test ",
      password: "p".repeat(10),
      registrationCode: "",
    });
    expect(result.email).toBe("Vert@Example.test");
  });

  it.each(["", "ikke-en-adresse", `${"a".repeat(250)}@example.test`])(
    "FR-1: refuses the email %j",
    (email) => {
      const result = registrationSchema.safeParse({
        email,
        password: "p".repeat(10),
        registrationCode: "",
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toBe(
        "Skriv en gyldig e-postadresse.",
      );
    },
  );
});

describe("loginSchema", () => {
  it("FR-1: asks for both fields with their own messages", () => {
    const result = loginSchema.safeParse({ email: "  ", password: "" });
    expect(result.error?.issues.map((i) => [i.path[0], i.message])).toEqual([
      ["email", "Skriv e-postadressen din."],
      ["password", "Skriv passordet ditt."],
    ]);
  });

  it("FR-1: accepts any non-empty password and a trimmed email", () => {
    expect(loginSchema.parse({ email: ` ${EMAIL} `, password: " " })).toEqual({
      email: EMAIL,
      password: " ",
    });
  });
});
