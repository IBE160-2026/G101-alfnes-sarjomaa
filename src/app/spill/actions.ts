"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { createGameForm } from "@/app/spill/schema";
import { toFailure, validate, type Failure } from "@/lib/errors";
import * as auth from "@/server/auth";
import * as games from "@/server/games";

export async function createGame(
  _prev: unknown,
  formData: FormData,
): Promise<Failure> {
  let id: string;
  try {
    const { hostId } = await auth.requireHost();
    ({ id } = await games.create(
      hostId,
      validate(createGameForm, Object.fromEntries(formData)),
    ));
  } catch (error) {
    unstable_rethrow(error); // the login redirect from requireHost
    return toFailure(error);
  }
  revalidatePath("/spill");
  redirect(`/spill/${id}`);
}
