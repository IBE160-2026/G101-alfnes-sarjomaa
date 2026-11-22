import { z } from "zod";

// The FormData shape only; games.deleteOwned resolves the ID.
export const deleteGameForm = z.object({
  gameId: z.string().default(""),
});
