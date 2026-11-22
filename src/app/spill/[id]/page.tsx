import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { DeleteGame } from "@/components/DeleteGame";
import { StatusBadge } from "@/components/StatusBadge";
import { DomainError } from "@/lib/errors";
import * as auth from "@/server/auth";
import * as games from "@/server/games";

const isNotFound = (error: unknown) =>
  error instanceof DomainError && error.code === "NOT_FOUND";

// cache(): generateMetadata and the page share one owner-checked read per request.
const ownedGame = cache(async (gameId: string) => {
  const { hostId } = await auth.requireHost();
  return games.getOwned(hostId, gameId);
});

// A foreign Game gets the not-found title too, so its title never leaks (AD-5).
export async function generateMetadata({
  params,
}: PageProps<"/spill/[id]">): Promise<Metadata> {
  const { id } = await params;
  try {
    return { title: (await ownedGame(id)).title };
  } catch (error) {
    if (isNotFound(error)) return { title: "Vi finner ikke dette spillet" };
    throw error;
  }
}

export default async function GamePage({ params }: PageProps<"/spill/[id]">) {
  const { id } = await params;
  let game;
  try {
    game = await ownedGame(id);
  } catch (error) {
    // Missing, foreign and malformed IDs all land here, on one page (AD-5).
    if (isNotFound(error)) notFound();
    throw error;
  }

  // One route; later stories add their state's panel as a case here.
  let panel = null;
  switch (game.state) {
    case "draft":
      panel = (
        <section aria-labelledby="sporsmal" className="mt-10">
          <h2 id="sporsmal" className="text-heading">
            Spørsmål
          </h2>
          {/* shortcut: neutral copy while there is no question editor; restore the EXPERIENCE.md sentence ("Skriv det første …") with the editor in Epic 2. */}
          <p className="mt-2">Ingen spørsmål ennå.</p>
        </section>
      );
      break;
  }

  return (
    <>
      <nav aria-label="Brødsmulesti">
        <ol className="flex flex-wrap items-center gap-x-2 text-body-sm">
          <li>
            <Link
              href="/spill"
              className="inline-flex min-h-11 items-center text-primary underline"
            >
              Mine spill
            </Link>
          </li>
          <li className="flex min-w-0 items-center gap-2">
            <span aria-hidden="true" className="text-ink-muted">
              ›
            </span>
            <span aria-current="page" className="break-words">
              {game.title}
            </span>
          </li>
        </ol>
      </nav>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 className="min-w-0 text-display break-words">{game.title}</h1>
        <StatusBadge state={game.state} />
      </div>
      {panel}
      {/* Every state (FR-3), outside the switch. */}
      <footer className="mt-16 border-t border-line pt-6">
        <DeleteGame gameId={game.id} title={game.title} />
      </footer>
    </>
  );
}
