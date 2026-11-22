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

async function questionAction(
  op: (hostId: string, input: unknown) => Promise<void>,
  input: unknown,
): Promise<ActionResult<null>> {
  try {
    const { hostId } = await auth.requireHost();
    await op(hostId, input);
    // op validated the input, so gameId is a string here.
    revalidatePath(`/spill/${(input as { gameId: string }).gameId}`);
    return { ok: true, data: null };
  } catch (error) {
    unstable_rethrow(error); // the login redirect from requireHost
    return toFailure(error);
  }
}

export async function saveQuestion(
  input: unknown,
): Promise<ActionResult<null>> {
  return questionAction(questions.save, input);
}

export async function moveQuestion(
  input: unknown,
): Promise<ActionResult<null>> {
  return questionAction(questions.move, input);
}

export async function removeQuestion(
  input: unknown,
): Promise<ActionResult<null>> {
  return questionAction(questions.remove, input);
}
