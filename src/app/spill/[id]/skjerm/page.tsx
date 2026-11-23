import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { cache, Suspense } from "react";
import { PlayView, StageLoading } from "@/components/PlayView";
import { TeamSetup } from "@/components/TeamSetup";
import { DomainError } from "@/lib/errors";
import * as auth from "@/server/auth";
import * as games from "@/server/games";
import * as play from "@/server/play";

const isNotFound = (error: unknown) =>
  error instanceof DomainError && error.code === "NOT_FOUND";

// cache(): generateMetadata and the page share one owner-checked read per request.
const ownedGame = cache(async (gameId: string) => {
  const { hostId } = await auth.requireHost();
  return { hostId, ...(await games.getOwned(hostId, gameId)) };
});

// A foreign Game gets the not-found title too, so its title never leaks (AD-5).
export async function generateMetadata({
  params,
}: PageProps<"/spill/[id]/skjerm">): Promise<Metadata> {
  const { id } = await params;
  try {
    return { title: (await ownedGame(id)).title };
  } catch (error) {
    if (isNotFound(error)) return { title: "Vi finner ikke dette spillet" };
    throw error;
  }
}

// FR-23: Team setup in ready, the play view in playing, the Game page otherwise.
export default async function ScreenPage({
  params,
}: PageProps<"/spill/[id]/skjerm">) {
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
  // shortcut: a played Game redirects too until Story 6.4 shows its final Scores here.
  if (game.state !== "playing") redirect(`/spill/${game.id}`);
  return (
    <Suspense fallback={<StageLoading />}>
      <PlayStage hostId={game.hostId} gameId={game.id} />
    </Suspense>
  );
}

async function PlayStage({
  hostId,
  gameId,
}: {
  hostId: string;
  gameId: string;
}) {
  return <PlayView gameId={gameId} {...await play.load(hostId, gameId)} />;
}
