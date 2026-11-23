// Play's input schemas (FR-23). The client checks each Team name with teamNameSchema;
// play.start checks the whole input again.
import { z } from "zod";
import { TEAM_NAME_MAX, TEAMS_MAX, TEAMS_MIN } from "@/lib/limits";

export const teamNameSchema = z
  .string()
  .trim()
  .min(1, "Laget trenger et navn.")
  .max(TEAM_NAME_MAX, `Navnet kan ha maks ${TEAM_NAME_MAX} tegn.`);

const TEAM_COUNT = "Velg to til fire lag.";

export const startPlaySchema = z.object({
  gameId: z.string(),
  teams: z
    .array(teamNameSchema)
    .min(TEAMS_MIN, TEAM_COUNT)
    .max(TEAMS_MAX, TEAM_COUNT),
});

// AD-16: the Team comes from play_state under the Game lock, never from the client.
export const revealSchema = z.object({
  gameId: z.string(),
  boardSlotId: z.string(),
  scored: z.boolean(),
});

// Next Team acts on the Game's saved play state; the Game is all it takes.
export const playGameSchema = z.object({ gameId: z.string() });

// The Reveal the Host's screen shows as the last: a stale tab must never undo another.
export const undoSchema = z.object({
  gameId: z.string(),
  boardSlotId: z.string(),
});

// The Question the Host's screen shows: a stale tab or a double press must never skip
// a Question or end the Game (WRONG_QUESTION).
export const nextQuestionSchema = z.object({
  gameId: z.string(),
  position: z.number().int(),
});
