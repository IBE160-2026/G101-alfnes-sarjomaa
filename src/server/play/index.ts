import "server-only";
import { asc, eq, sql } from "drizzle-orm";
import { DomainError, validate } from "@/lib/errors";
import { PERMITTED } from "@/lib/game-state";
import { revealSchema, startPlaySchema } from "@/lib/play";
import { withBoundary } from "@/server/boundary";
import { getDb } from "@/server/db/client";
import {
  playState,
  question,
  reveal as revealRow,
  team,
} from "@/server/db/schema";
import * as games from "@/server/games";
import * as review from "@/server/review";

export type PlayView = {
  question: { position: number; text: string };
  total: number;
  teams: { id: string; name: string; score: number; current: boolean }[];
  // A hidden slot carries no label or Count, so the client cannot leak it (FR-24).
  board: (
    | { id: string; position: number; revealed: false }
    | {
        id: string;
        position: number;
        revealed: true;
        label: string;
        count: number;
      }
  )[];
};

export type RevealResult = {
  label: string;
  count: number;
  team: string | null;
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

// What the play view shows, from saved state only (FR-23, FR-24, FR-27). Reads the
// Board only through review.getBoard (AD-15), never answer or answer_group.
export function load(hostId: string, gameId: string): Promise<PlayView> {
  return withBoundary("play", "load", async () => {
    const { state } = await games.getOwned(hostId, gameId);
    if (state !== "playing") throw new DomainError("WRONG_STATE");
    const db = await getDb();
    const [current] = await db
      .select({
        questionId: playState.currentQuestionId,
        position: question.position,
        text: question.text,
        teamId: playState.currentTeamId,
      })
      .from(playState)
      .innerJoin(question, eq(question.id, playState.currentQuestionId))
      .where(eq(playState.gameId, gameId));
    const total = await db.$count(question, eq(question.gameId, gameId));
    // AD-11: Score is the sum of the Counts of a Team's scored Reveals, never stored.
    const board = review.getBoard(db, gameId).as("board");
    const teams = await db
      .select({
        id: team.id,
        name: team.name,
        score: sql<number>`coalesce(sum(${board.count}), 0)`.mapWith(Number),
      })
      .from(team)
      .leftJoin(revealRow, eq(revealRow.teamId, team.id))
      .leftJoin(board, eq(board.id, revealRow.boardSlotId))
      .where(eq(team.gameId, gameId))
      .groupBy(team.id)
      .orderBy(asc(team.position));
    const slots = (await review.getBoard(db, gameId)).filter(
      (s) => s.questionId === current.questionId,
    );
    const revealed = new Set(
      (
        await db
          .select({ id: revealRow.boardSlotId })
          .from(revealRow)
          .where(eq(revealRow.gameId, gameId))
      ).map((r) => r.id),
    );
    return {
      question: { position: current.position, text: current.text },
      total,
      teams: teams.map((t) => ({ ...t, current: t.id === current.teamId })),
      board: slots.map(({ id, position, label, count }) =>
        revealed.has(id)
          ? { id, position, revealed: true as const, label, count }
          : { id, position, revealed: false as const },
      ),
    };
  });
}

// FR-25, AD-16: reveals one slot of the current Question, crediting the play_state Team
// when scored. One transaction under the Game lock; the turn does not pass.
export function reveal(hostId: string, input: unknown): Promise<RevealResult> {
  return withBoundary("play", "reveal", async () => {
    const { gameId, boardSlotId, scored } = validate(revealSchema, input);
    const db = await getDb();
    return db.transaction(async (tx) => {
      await games.lockForMutation(tx, {
        hostId,
        gameId,
        states: PERMITTED.playMove,
      });
      // Compared as text, so a malformed id is just a slot that is not there.
      const slot = (await review.getBoard(tx, gameId)).find(
        (s) => s.id === boardSlotId,
      );
      if (!slot) throw new DomainError("NOT_FOUND");
      const [current] = await tx
        .select({
          questionId: playState.currentQuestionId,
          teamId: team.id,
          name: team.name,
        })
        .from(playState)
        .innerJoin(team, eq(team.id, playState.currentTeamId))
        .where(eq(playState.gameId, gameId));
      if (slot.questionId !== current.questionId)
        throw new DomainError("WRONG_QUESTION");
      const inserted = await tx
        .insert(revealRow)
        .values({
          gameId,
          boardSlotId: slot.id,
          teamId: scored ? current.teamId : null,
          // Safe under the Game lock: no other Reveal of this Game runs concurrently.
          seq: sql`(select coalesce(max(${revealRow.seq}), 0) + 1 from ${revealRow} where ${revealRow.gameId} = ${gameId})`,
        })
        .onConflictDoNothing({ target: revealRow.boardSlotId })
        .returning({ id: revealRow.id });
      if (inserted.length === 0) throw new DomainError("ALREADY_REVEALED");
      return {
        label: slot.label,
        count: slot.count,
        team: scored ? current.name : null,
      };
    });
  });
}
