"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { after } from "next/server";
import {
  DELETED_COOKIE,
  deletedCookieOptions,
} from "@/app/spill/deleted-notice";
import { toFailure, type ActionResult, type Failure } from "@/lib/errors";
import * as auth from "@/server/auth";
import * as collection from "@/server/collection";
import * as games from "@/server/games";
import * as grouping from "@/server/grouping";
import * as play from "@/server/play";
import * as questions from "@/server/questions";
import * as review from "@/server/review";

export async function deleteGame(
  _prev: unknown,
  formData: FormData,
): Promise<Failure> {
  let title: string;
  try {
    const { hostId } = await auth.requireHost();
    // A missing or non-string ID is just a Game that does not exist (NOT_FOUND).
    const gameId = String(formData.get("gameId") ?? "");
    ({ title } = await games.deleteOwned(hostId, gameId));
  } catch (error) {
    unstable_rethrow(error); // the login redirect from requireHost
    return toFailure(error);
  }
  (await cookies()).set(DELETED_COOKIE, title, deletedCookieOptions);
  revalidatePath("/spill");
  redirect("/spill");
}

// Every object-input Host action: session, the module call (which validates the input),
// a refresh of the Game page (and `subPath` under it), and any error as a Failure.
async function hostAction<T>(
  op: (hostId: string, input: unknown) => Promise<T>,
  input: unknown,
  subPath?: string,
): Promise<ActionResult<T>> {
  try {
    const { hostId } = await auth.requireHost();
    const data = await op(hostId, input);
    // op validated the input, so gameId is a string here.
    const page = `/spill/${(input as { gameId: string }).gameId}`;
    revalidatePath(page);
    if (subPath) revalidatePath(`${page}/${subPath}`);
    return { ok: true, data };
  } catch (error) {
    unstable_rethrow(error); // the login redirect from requireHost
    return toFailure(error);
  }
}

export async function saveQuestion(
  input: unknown,
): Promise<ActionResult<void>> {
  return hostAction(questions.save, input);
}

export async function moveQuestion(
  input: unknown,
): Promise<ActionResult<void>> {
  return hostAction(questions.move, input);
}

export async function removeQuestion(
  input: unknown,
): Promise<ActionResult<void>> {
  return hostAction(questions.remove, input);
}

export async function createInviteLinks(
  input: unknown,
): Promise<ActionResult<{ links: string[] }>> {
  return hostAction(collection.createInviteLinks, input);
}

export async function revokeInviteLink(
  input: unknown,
): Promise<ActionResult<{ link: string }>> {
  return hostAction(collection.revokeInviteLink, input);
}

// A "use server" file exports only async functions, so this action inherits
// maxDuration = 300 from the Game page it posts to (AD-24). Grouping runs after the
// response (AD-12); the boundary has already logged any failure.
export async function closeCollection(
  input: unknown,
): Promise<ActionResult<void>> {
  const result = await hostAction(collection.close, input);
  if (result.ok) {
    const { gameId } = input as { gameId: string };
    after(() => grouping.run(gameId).catch(() => {}));
  }
  return result;
}

export async function mergeGroups(
  input: unknown,
): Promise<ActionResult<review.MergeResult>> {
  return hostAction(review.merge, input, "gjennomgang");
}

export async function moveAnswers(
  input: unknown,
): Promise<ActionResult<review.MoveResult>> {
  return hostAction(review.moveAnswers, input, "gjennomgang");
}

export async function renameGroup(
  input: unknown,
): Promise<ActionResult<review.LabelResult>> {
  return hostAction(review.rename, input, "gjennomgang");
}

export async function discardGroup(
  input: unknown,
): Promise<ActionResult<review.LabelResult>> {
  return hostAction(review.discard, input, "gjennomgang");
}

export async function restoreGroup(
  input: unknown,
): Promise<ActionResult<review.LabelResult>> {
  return hostAction(review.restore, input, "gjennomgang");
}

export async function markReviewed(
  input: unknown,
): Promise<ActionResult<review.MarkResult>> {
  return hostAction(review.setReviewed, input, "gjennomgang");
}

export async function confirmBoard(
  input: unknown,
): Promise<ActionResult<{ questions: number }>> {
  return hostAction(review.confirmBoard, input, "gjennomgang");
}

export async function startPlay(input: unknown): Promise<ActionResult<void>> {
  return hostAction(play.start, input, "skjerm");
}

export async function revealSlot(
  input: unknown,
): Promise<ActionResult<play.RevealResult>> {
  return hostAction(play.reveal, input, "skjerm");
}

export async function undoReveal(
  input: unknown,
): Promise<ActionResult<play.UndoResult>> {
  return hostAction(play.undo, input, "skjerm");
}

export async function passTurn(
  input: unknown,
): Promise<ActionResult<{ team: string }>> {
  return hostAction(play.nextTeam, input, "skjerm");
}

export async function nextQuestion(
  input: unknown,
): Promise<ActionResult<play.NextQuestionResult>> {
  return hostAction(play.nextQuestion, input, "skjerm");
}
