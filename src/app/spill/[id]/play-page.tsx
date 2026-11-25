import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { cache, Suspense } from "react";
import { HostPlay } from "@/components/HostPlay";
import {
  FinalScores,
  PlayView,
  StageLoading,
  TvWaiting,
} from "@/components/PlayView";
import { FocusOnMount } from "@/components/RouteFocus";
import { ScoreList } from "@/components/ScoreList";
import { TeamSetup } from "@/components/TeamSetup";
import { DomainError } from "@/lib/errors";
import { formatDate } from "@/lib/format";
import { QUESTION_SET_CREDIT } from "@/lib/question-sets";
import * as auth from "@/server/auth";
import * as games from "@/server/games";
import * as play from "@/server/play";

// lag: Team setup; tv: the room's Board only; vert: the Host view with the answer key
// and the controls.
type View = "lag" | "tv" | "vert";

const isNotFound = (error: unknown) =>
  error instanceof DomainError && error.code === "NOT_FOUND";

// A move can commit between ownedGame's state read and play's own, most often under the
// TV's poll at the last "Vis sluttstilling" or a delete. Render the path again, so it
// shows the new state (Sluttstilling, not-found) instead of the error page.
async function orReread<T>(read: Promise<T>, path: string): Promise<T> {
  try {
    return await read;
  } catch (error) {
    if (
      error instanceof DomainError &&
      (error.code === "WRONG_STATE" || error.code === "NOT_FOUND")
    )
      redirect(path);
    throw error;
  }
}

// cache(): generateMetadata and the page share one owner-checked read per request.
const ownedGame = cache(async (gameId: string) => {
  const { hostId } = await auth.requireHost();
  return { hostId, ...(await games.getOwned(hostId, gameId)) };
});

// The TV and Host view titles tell the two windows apart when the Host drags or shares one.
const TITLE_PREFIX: Record<View, string> = {
  lag: "Lagoppsett – ",
  tv: "TV – ",
  vert: "Vertsvisning – ",
};

// A foreign Game gets the not-found title too, so its title never leaks (AD-5).
export async function playMetadata(
  params: Promise<{ id: string }>,
  view: View,
): Promise<Metadata> {
  const { id } = await params;
  try {
    return { title: TITLE_PREFIX[view] + (await ownedGame(id)).title };
  } catch (error) {
    if (isNotFound(error)) return { title: "Vi finner ikke dette spillet" };
    throw error;
  }
}

// FR-23, FR-27: the play pages' one switch. Team setup only on /lag in ready; in ready the
// TV waits and the Host view sends the Host to /lag; the view in playing, the final Scores
// in played, the Game page otherwise.
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
  const path = `/spill/${game.id}/${view}`;
  if (view === "lag") {
    if (game.state !== "ready") redirect(`/spill/${game.id}`);
    return <TeamSetup gameId={game.id} />;
  }
  if (game.state === "ready") {
    if (view === "vert") redirect(`/spill/${game.id}/lag`);
    return <TvWaiting gameId={game.id} title={game.title} />;
  }
  if (game.state === "played") {
    const final = await orReread(play.finalScores(game.hostId, game.id), path);
    return view === "vert" ? (
      <HostFinal gameId={game.id} {...final} />
    ) : (
      <FinalScores {...final} />
    );
  }
  if (game.state !== "playing") redirect(`/spill/${game.id}`);
  if (view === "vert")
    return (
      <HostPlay
        gameId={game.id}
        {...await orReread(play.answerKey(game.hostId, game.id), path)}
      />
    );
  return (
    <Suspense fallback={<StageLoading />}>
      <PlayStage
        hostId={game.hostId}
        gameId={game.id}
        credit={game.questionSet ? QUESTION_SET_CREDIT : undefined}
        path={path}
      />
    </Suspense>
  );
}

// credit: the FR-33 source credit, for a Game made from a Question set only.
async function PlayStage({
  hostId,
  gameId,
  credit,
  path,
}: {
  hostId: string;
  gameId: string;
  credit?: string;
  path: string;
}) {
  return (
    <PlayView
      gameId={gameId}
      credit={credit}
      {...await orReread(play.load(hostId, gameId), path)}
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
