import { z } from "zod";

// The FormData shape only; auth.logIn validates the values.
export const loginForm = z.object({
  email: z.string().default(""),
  password: z.string().default(""),
});
