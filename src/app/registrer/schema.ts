import { z } from "zod";

// The FormData shape only; auth.register validates the values.
export const registerForm = z.object({
  email: z.string().default(""),
  password: z.string().default(""),
  registrationCode: z.string().default(""),
});
