import "server-only";
import { asc, eq } from "drizzle-orm";
import { DomainError, validate } from "@/lib/errors";
import { PERMITTED } from "@/lib/game-state";
import { startPlaySchema } from "@/lib/play";
import { withBoundary } from "@/server/boundary";
import { getDb } from "@/server/db/client";
import { playState, question, team } from "@/server/db/schema";
import * as games from "@/server/games";

export type PlayView = {
  question: { position: number; text: string };
  total: number;
  teams: { id: string; name: string; score: number; current: boolean }[];
};

// FR-23, AD-16: names the Teams and starts play at Question 1 with Team 1, in one
// transaction under the Game lock, so the owner and state checks hold to the end.
export function start(hostId: string, input: unknown): Promise<void> {
  return withBoundary("play", "start", async () => {
    const { gameId, teams } = validate(startPlaySchema, input);
    const db = await getDb();
    await db.transaction(async (tx) => {
      await games.lockForMutation(tx, {
        hostId,
        gameId,
        states: PERMITTED.startPlay,
      });
      const rows = await tx
        .insert(team)
        .values(teams.map((name, i) => ({ gameId, name, position: i + 1 })))
        .returning({ id: team.id, position: team.position });
      const [first] = await tx
        .select({ id: question.id })
        .from(question)
        .where(eq(question.gameId, gameId))
        .orderBy(asc(question.position))
        .limit(1);
      await tx.insert(playState).values({
        gameId,
        currentQuestionId: first.id,
        currentTeamId: rows.find((r) => r.position === 1)!.id,
      });
      await games.transition(tx, gameId, "ready", "playing");
    });
  });
}

// What the play view shows, from saved state only (FR-23). Reads no Board yet.
export function load(hostId: string, gameId: string): Promise<PlayView> {
  return withBoundary("play", "load", async () => {
    const { state } = await games.getOwned(hostId, gameId);
    if (state !== "playing") throw new DomainError("WRONG_STATE");
    const db = await getDb();
    const [current] = await db
      .select({
        position: question.position,
        text: question.text,
        teamId: playState.currentTeamId,
      })
      .from(playState)
      .innerJoin(question, eq(question.id, playState.currentQuestionId))
      .where(eq(playState.gameId, gameId));
    const total = await db.$count(question, eq(question.gameId, gameId));
    const teams = await db
      .select({ id: team.id, name: team.name })
      .from(team)
      .where(eq(team.gameId, gameId))
      .orderBy(asc(team.position));
    return {
      question: { position: current.position, text: current.text },
      total,
      teams: teams.map((t) => ({
        ...t,
        // shortcut: every Score is 0 until Story 6.2 adds reveal, then sum board_slot.count over the Team's scored Reveals (AD-11).
        score: 0,
        current: t.id === current.teamId,
      })),
    };
  });
}
