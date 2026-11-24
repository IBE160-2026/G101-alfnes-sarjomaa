import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { cache, Suspense } from "react";
import { HostPlay } from "@/components/HostPlay";
import { FinalScores, PlayView, StageLoading } from "@/components/PlayView";
import { FocusOnMount } from "@/components/RouteFocus";
import { ScoreList } from "@/components/ScoreList";
import { TeamSetup } from "@/components/TeamSetup";
import { DomainError } from "@/lib/errors";
import { formatDate } from "@/lib/format";
import { QUESTION_SET_CREDIT } from "@/lib/question-sets";
import * as auth from "@/server/auth";
import * as games from "@/server/games";
import * as play from "@/server/play";

// skjerm: the one shared screen with controls; tv: the room's Board only; vert: the
// Host view with the answer key and the controls.
type View = "skjerm" | "tv" | "vert";

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
  if (game.state === "played") {
    const final = await play.finalScores(game.hostId, game.id);
    return view === "vert" ? (
      <HostFinal gameId={game.id} {...final} />
    ) : (
      <FinalScores gameId={game.id} tv={view === "tv"} {...final} />
    );
  }
  if (game.state !== "playing") redirect(`/spill/${game.id}`);
  if (view === "vert")
    return (
      <HostPlay
        gameId={game.id}
        {...await play.answerKey(game.hostId, game.id)}
      />
    );
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

// FR-27: the Host view's final standing, highest Score first, on the light Host page.
function HostFinal({
  gameId,
  teams,
  deleteAfter,
}: play.FinalScores & { gameId: string }) {
  return (
    <>
      <h1 id="sluttstilling" className="text-display">
        Sluttstilling
      </h1>
      {/* The answer key and its controls unmounted with the last move. */}
      <FocusOnMount id="sluttstilling" />
      <ScoreList teams={teams} />
      <p className="mt-6">{`Spillet slettes automatisk ${formatDate(deleteAfter)}.`}</p>
      <Link
        href={`/spill/${gameId}`}
        className="mt-6 inline-flex min-h-11 items-center text-primary underline"
      >
        Tilbake til spillet
      </Link>
    </>
  );
}
