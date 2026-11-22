"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { deleteGameForm } from "@/app/spill/[id]/schema";
import { toFailure, validate, type Failure } from "@/lib/errors";
import * as auth from "@/server/auth";
import * as games from "@/server/games";

export async function deleteGame(
  _prev: unknown,
  formData: FormData,
): Promise<Failure> {
  let title: string;
  try {
    const { hostId } = await auth.requireHost();
    const { gameId } = validate(deleteGameForm, Object.fromEntries(formData));
    ({ title } = await games.deleteOwned(hostId, gameId));
  } catch (error) {
    unstable_rethrow(error); // the login redirect from requireHost
    return toFailure(error);
  }
  revalidatePath("/spill");
  redirect(`/spill?slettet=${encodeURIComponent(title)}`);
}
