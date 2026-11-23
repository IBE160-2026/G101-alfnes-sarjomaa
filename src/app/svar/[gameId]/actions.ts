"use server";

import { toFailure, type ActionResult } from "@/lib/errors";
import * as collection from "@/server/collection";

// The Token and edit secret arrive only in this POST body, never in a URL (AD-7). No session is read.
export async function openInviteLink(
  gameId: unknown,
  token: unknown,
  editSecret?: unknown,
): Promise<
  ActionResult<Awaited<ReturnType<typeof collection.openInviteLink>>>
> {
  try {
    return {
      ok: true,
      data: await collection.openInviteLink(gameId, token, editSecret),
    };
  } catch (error) {
    return toFailure(error);
  }
}

// Answers, Token and edit secret arrive only in this POST body. No session, no revalidate.
export async function submitAnswerSet(
  gameId: unknown,
  token: unknown,
  input: unknown,
): Promise<ActionResult<null>> {
  try {
    await collection.submit(gameId, token, input);
    return { ok: true, data: null };
  } catch (error) {
    return toFailure(error);
  }
}
