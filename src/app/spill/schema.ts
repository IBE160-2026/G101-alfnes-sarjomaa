import { z } from "zod";

// The FormData shape only; games.create validates the values.
export const createGameForm = z.object({
  title: z.string().default(""),
});
