"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { toFailure, type Failure } from "@/lib/errors";
import * as auth from "@/server/auth";
import * as games from "@/server/games";
import * as review from "@/server/review";

export async function createGame(
  _prev: unknown,
  formData: FormData,
): Promise<Failure> {
  let id: string;
  try {
    const { hostId } = await auth.requireHost();
    // Both validate every field. A chosen Question set skips straight to ready (FR-33).
    const input = Object.fromEntries(formData);
    ({ id } = input.questionSet
      ? await review.createFromQuestionSet(hostId, input)
      : await games.create(hostId, input));
  } catch (error) {
    unstable_rethrow(error); // the login redirect from requireHost
    return toFailure(error);
  }
  revalidatePath("/spill");
  redirect(`/spill/${id}`);
}
