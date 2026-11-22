import { z } from "zod";
import { EMAIL_MAX, PASSWORD_MAX, PASSWORD_MIN } from "@/lib/limits";

const INVALID_EMAIL = "Skriv en gyldig e-postadresse.";

// Passwords are never trimmed: every character counts.
export const registrationSchema = z.object({
  email: z
    .string()
    .trim()
    .max(EMAIL_MAX, INVALID_EMAIL)
    .pipe(z.email(INVALID_EMAIL)),
  password: z
    .string()
    .min(PASSWORD_MIN, "Passordet må ha minst 10 tegn.")
    .max(PASSWORD_MAX, "Passordet kan ha maks 256 tegn."),
  registrationCode: z.string(),
});

// No length limit here: an over-long login password is refused as INVALID_CREDENTIALS.
export const loginSchema = z.object({
  email: z.string().trim().min(1, "Skriv e-postadressen din."),
  password: z.string().min(1, "Skriv passordet ditt."),
});
