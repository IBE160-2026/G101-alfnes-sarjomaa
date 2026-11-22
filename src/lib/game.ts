import { z } from "zod";
import { GAME_TITLE_MAX } from "@/lib/limits";

const TITLE_LENGTH = "Navnet må ha 1–80 tegn.";

export const createGameSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, TITLE_LENGTH)
    .max(GAME_TITLE_MAX, TITLE_LENGTH),
});
