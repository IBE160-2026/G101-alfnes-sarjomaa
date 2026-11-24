import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { cache, Suspense } from "react";
import { FinalScores, PlayView, StageLoading } from "@/components/PlayView";
import { TeamSetup } from "@/components/TeamSetup";
import { DomainError } from "@/lib/errors";
import { QUESTION_SET_CREDIT } from "@/lib/question-sets";
import * as auth from "@/server/auth";
import * as games from "@/server/games";
import * as play from "@/server/play";

// skjerm: the one shared screen with controls; tv: the room's Board only.
type View = "skjerm" | "tv";

const isNotFound = (error: unknown) =>
  error instanceof DomainError && error.code === "NOT_FOUND";

// cache(): generateMetadata and the page share one owner-checked read per request.
const ownedGame = cache(async (gameId: string) => {
  const { hostId } = await auth.requireHost();
  return { hostId, ...(await games.getOwned(hostId, gameId)) };
});

// A foreign Game gets the not-found title too, so its title never leaks (AD-5).
export async function playMetadata(
  params: Promise<{ id: string }>,
): Promise<Metadata> {
  const { id } = await params;
  try {
    return { title: (await ownedGame(id)).title };
  } catch (error) {
    if (isNotFound(error)) return { title: "Vi finner ikke dette spillet" };
    throw error;
  }
}

// FR-23, FR-27: the play pages' one switch. Team setup in ready, the view in playing,
// the final Scores in played, the Game page otherwise.
export async function playPage(params: Promise<{ id: string }>, view: View) {
  const { id } = await params;
  let game;
  try {
    game = await ownedGame(id);
  } catch (error) {
    // Missing, foreign and malformed IDs all land on one page (AD-5).
    if (isNotFound(error)) notFound();
    throw error;
  }
  if (game.state === "ready") return <TeamSetup gameId={game.id} />;
  if (game.state === "played")
    return (
      <FinalScores
        gameId={game.id}
        tv={view === "tv"}
        {...await play.finalScores(game.hostId, game.id)}
      />
    );
  if (game.state !== "playing") redirect(`/spill/${game.id}`);
  return (
    <Suspense fallback={<StageLoading />}>
      <PlayStage
        hostId={game.hostId}
        gameId={game.id}
        credit={game.questionSet ? QUESTION_SET_CREDIT : undefined}
        tv={view === "tv"}
      />
    </Suspense>
  );
}

// credit: the FR-33 source credit, for a Game made from a Question set only.
async function PlayStage({
  hostId,
  gameId,
  credit,
  tv,
}: {
  hostId: string;
  gameId: string;
  credit?: string;
  tv: boolean;
}) {
  return (
    <PlayView
      gameId={gameId}
      credit={credit}
      tv={tv}
      {...await play.load(hostId, gameId)}
    />
  );
}
