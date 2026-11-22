"use server";

import { toFailure, type ActionResult } from "@/lib/errors";
import * as collection from "@/server/collection";

// The Token arrives only in this POST body, never in a URL (AD-7). No session is read.
export async function openInviteLink(
  gameId: unknown,
  token: unknown,
): Promise<
  ActionResult<Awaited<ReturnType<typeof collection.openInviteLink>>>
> {
  try {
    return { ok: true, data: await collection.openInviteLink(gameId, token) };
  } catch (error) {
    return toFailure(error);
  }
}
