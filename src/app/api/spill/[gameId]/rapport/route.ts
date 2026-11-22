import { unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import { DomainError, toFailure } from "@/lib/errors";
import { REPORT_STATES } from "@/lib/game-state";
import * as auth from "@/server/auth";
import * as games from "@/server/games";
import * as grouping from "@/server/grouping";

const STATUS: Partial<Record<string, number>> = {
  NOT_FOUND: 404,
  WRONG_STATE: 409,
};

// The usage report (AD-18): counters and per-Question origins only, never Answer content
// (FR-11..FR-13). Composes like the Game page, since grouping imports games.
export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/spill/[gameId]/rapport">,
): Promise<Response> {
  await connection();
  const { gameId } = await params;
  try {
    const { hostId } = await auth.requireHost();
    const game = await games.getOwned(hostId, gameId);
    if (!REPORT_STATES.includes(game.state))
      throw new DomainError("WRONG_STATE");
    const counters = await games.counters(game.id);
    const questions = await grouping.usage(game.id);
    return Response.json(
      { counters, questions },
      {
        headers: {
          "Content-Disposition":
            'attachment; filename="toppsvar-bruksrapport.json"',
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    unstable_rethrow(error); // requireHost's redirect to /logg-inn
    const { code, message } = toFailure(error); // anything else was logged by the boundary
    return Response.json(
      { code, message },
      { status: STATUS[code] ?? 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
