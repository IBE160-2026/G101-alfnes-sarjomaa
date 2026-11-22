"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import {
  DELETED_COOKIE,
  deletedCookieOptions,
} from "@/app/spill/deleted-notice";
import { toFailure, type ActionResult, type Failure } from "@/lib/errors";
import * as auth from "@/server/auth";
import * as collection from "@/server/collection";
import * as games from "@/server/games";
import * as questions from "@/server/questions";

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
// a refresh of the Game page, and any error as a Failure.
async function hostAction<T>(
  op: (hostId: string, input: unknown) => Promise<T>,
  input: unknown,
): Promise<ActionResult<T>> {
  try {
    const { hostId } = await auth.requireHost();
    const data = await op(hostId, input);
    // op validated the input, so gameId is a string here.
    revalidatePath(`/spill/${(input as { gameId: string }).gameId}`);
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
// maxDuration = 300 from the Game page it posts to (AD-24).
export async function closeCollection(
  input: unknown,
): Promise<ActionResult<void>> {
  return hostAction(collection.close, input);
}
