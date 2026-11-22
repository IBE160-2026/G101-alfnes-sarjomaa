import { z } from "zod";
import { INVITE_LINKS_MAX } from "@/lib/limits";

const COUNT = "Skriv et tall fra 1 til 50.";

// Malformed gameIds are left to lockForMutation, which makes them NOT_FOUND (AD-5).
export const createInviteLinksSchema = z.object({
  gameId: z.string(),
  count: z
    .number({ error: COUNT })
    .int(COUNT)
    .min(1, COUNT)
    .max(INVITE_LINKS_MAX, COUNT),
});
