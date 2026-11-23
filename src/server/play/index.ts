import "server-only";
import { and, asc, desc, eq, gt, sql } from "drizzle-orm";
import { DomainError, validate } from "@/lib/errors";
import { PERMITTED } from "@/lib/game-state";
import { RETENTION_PLAYED_MS } from "@/lib/limits";
import {
  nextQuestionSchema,
  playGameSchema,
  revealSchema,
  startPlaySchema,
  undoSchema,
} from "@/lib/play";
import { withBoundary } from "@/server/boundary";
import { getDb, type Db, type Tx } from "@/server/db/client";
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
        scored: boolean;
      }
  )[];
  // The slot Undo would hide. The client sends it back, so a stale tab cannot undo a
  // Reveal it does not show (NOTHING_TO_UNDO instead).
  lastReveal: string | null;
};

export type RevealResult = {
  label: string;
  count: number;
  team: string | null;
};

export type UndoResult = RevealResult & { boardSlotId: string };

export type NextQuestionResult =
  { finished: false; position: number } | { finished: true; deleteAfter: Date };

export type FinalScores = {
  teams: { id: string; name: string; score: number }[];
  deleteAfter: Date;
};

// AD-11: Score is the sum of the Counts of a Team's scored Reveals, never stored.
// Teams in position order.
function teamsWithScores(db: Db, gameId: string) {
  const board = review.getBoard(db, gameId).as("board");
  return db
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
}

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
    const teams = await teamsWithScores(db, gameId);
    const slots = (await review.getBoard(db, gameId)).filter(
      (s) => s.questionId === current.questionId,
    );
    const reveals = await db
      .select({ id: revealRow.boardSlotId, teamId: revealRow.teamId })
      .from(revealRow)
      .where(eq(revealRow.gameId, gameId))
      .orderBy(asc(revealRow.seq));
    // Slot id → scored (an unscored Reveal has no Team).
    const revealed = new Map(reveals.map((r) => [r.id, r.teamId !== null]));
    const onQuestion = new Set(slots.map((s) => s.id));
    return {
      question: { position: current.position, text: current.text },
      total,
      teams: teams.map((t) => ({ ...t, current: t.id === current.teamId })),
      board: slots.map(({ id, position, label, count }) =>
        revealed.has(id)
          ? {
              id,
              position,
              revealed: true as const,
              label,
              count,
              scored: revealed.get(id)!,
            }
          : { id, position, revealed: false as const },
      ),
      lastReveal: reveals.findLast((r) => onQuestion.has(r.id))?.id ?? null,
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

// FR-26, AD-16: deletes the most recent Reveal on the current Question, scored or not.
// Earlier Questions' Reveals are never touched; the Score falls with it (AD-11).
// `boardSlotId` is the Reveal the Host's screen shows as the last; any other is stale.
export function undo(hostId: string, input: unknown): Promise<UndoResult> {
  return withBoundary("play", "undo", async () => {
    const { gameId, boardSlotId } = validate(undoSchema, input);
    const db = await getDb();
    return db.transaction(async (tx) => {
      await games.lockForMutation(tx, {
        hostId,
        gameId,
        states: PERMITTED.playMove,
      });
      const board = review.getBoard(tx, gameId).as("board");
      const [last] = await tx
        .select({
          id: revealRow.id,
          boardSlotId: revealRow.boardSlotId,
          label: board.label,
          count: board.count,
          team: team.name,
        })
        .from(revealRow)
        .innerJoin(board, eq(board.id, revealRow.boardSlotId))
        .innerJoin(
          playState,
          and(
            eq(playState.gameId, revealRow.gameId),
            eq(playState.currentQuestionId, board.questionId),
          ),
        )
        .leftJoin(team, eq(team.id, revealRow.teamId))
        .where(eq(revealRow.gameId, gameId))
        .orderBy(desc(revealRow.seq))
        .limit(1);
      if (last?.boardSlotId !== boardSlotId)
        throw new DomainError("NOTHING_TO_UNDO");
      await tx.delete(revealRow).where(eq(revealRow.id, last.id));
      const { label, count } = last;
      return { boardSlotId, label, count, team: last.team };
    });
  });
}

// FR-27, AD-16: passes the turn to the next Team by position, wrapping to the first.
export function nextTeam(
  hostId: string,
  input: unknown,
): Promise<{ team: string }> {
  return withBoundary("play", "nextTeam", async () => {
    const { gameId } = validate(playGameSchema, input);
    const db = await getDb();
    return db.transaction(async (tx) => {
      await games.lockForMutation(tx, {
        hostId,
        gameId,
        states: PERMITTED.playMove,
      });
      const teams = await tx
        .select({ id: team.id, name: team.name })
        .from(team)
        .where(eq(team.gameId, gameId))
        .orderBy(asc(team.position));
      const [{ teamId }] = await tx
        .select({ teamId: playState.currentTeamId })
        .from(playState)
        .where(eq(playState.gameId, gameId));
      const next =
        teams[(teams.findIndex((t) => t.id === teamId) + 1) % teams.length];
      await tx
        .update(playState)
        .set({ currentTeamId: next.id })
        .where(eq(playState.gameId, gameId));
      return { team: next.name };
    });
  });
}

// AD-16: ends the round; the purge deletes the Game RETENTION_PLAYED_MS after played_at.
async function finish(tx: Tx, gameId: string) {
  const { playedAt } = await games.transition(tx, gameId, "playing", "played");
  return {
    finished: true as const,
    deleteAfter: new Date(playedAt!.getTime() + RETENTION_PLAYED_MS),
  };
}

// FR-27, AD-16: moves to the Question with the smallest greater position, or past the
// last one finishes the Game. `position` must be the current one, so a stale tab or a
// double press is WRONG_QUESTION instead of a skipped Question or an ended Game.
export function nextQuestion(
  hostId: string,
  input: unknown,
): Promise<NextQuestionResult> {
  return withBoundary("play", "nextQuestion", async () => {
    const { gameId, position } = validate(nextQuestionSchema, input);
    const db = await getDb();
    return db.transaction(async (tx) => {
      // PERMITTED.finishPlay equals playMove, so this one lock covers finish too.
      await games.lockForMutation(tx, {
        hostId,
        gameId,
        states: PERMITTED.playMove,
      });
      const [current] = await tx
        .select({ position: question.position })
        .from(playState)
        .innerJoin(question, eq(question.id, playState.currentQuestionId))
        .where(eq(playState.gameId, gameId));
      if (current.position !== position)
        throw new DomainError("WRONG_QUESTION");
      const [next] = await tx
        .select({ id: question.id, position: question.position })
        .from(question)
        .where(
          and(eq(question.gameId, gameId), gt(question.position, position)),
        )
        .orderBy(asc(question.position))
        .limit(1);
      if (!next) return finish(tx, gameId);
      await tx
        .update(playState)
        .set({ currentQuestionId: next.id })
        .where(eq(playState.gameId, gameId));
      return { finished: false as const, position: next.position };
    });
  });
}

// FR-27: the final Scores of a played Game, highest first, ties in Team order.
export function finalScores(
  hostId: string,
  gameId: string,
): Promise<FinalScores> {
  return withBoundary("play", "finalScores", async () => {
    const { state, playedAt } = await games.getOwned(hostId, gameId);
    if (state !== "played") throw new DomainError("WRONG_STATE");
    // played_at is set by the same transition that sets played (games.transition).
    const teams = await teamsWithScores(await getDb(), gameId);
    return {
      // Array.sort is stable, so equal Scores keep the position order.
      teams: teams.sort((a, b) => b.score - a.score),
      deleteAfter: new Date(playedAt!.getTime() + RETENTION_PLAYED_MS),
    };
  });
}
