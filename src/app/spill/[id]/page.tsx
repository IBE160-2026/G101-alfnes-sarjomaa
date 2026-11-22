import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/StatusBadge";
import { DomainError } from "@/lib/errors";
import * as auth from "@/server/auth";
import * as games from "@/server/games";

async function ownedGame(hostId: string, gameId: string) {
  try {
    return await games.getOwned(hostId, gameId);
  } catch (error) {
    // Missing, foreign and malformed IDs all land here, on one page (AD-5).
    if (error instanceof DomainError && error.code === "NOT_FOUND") notFound();
    throw error;
  }
}

export default async function GamePage({ params }: PageProps<"/spill/[id]">) {
  const { id } = await params;
  const { hostId } = await auth.requireHost();
  const game = await ownedGame(hostId, id);

  // One route; later stories add their state's panel as a case here.
  let panel = null;
  switch (game.state) {
    case "draft":
      panel = (
        <section aria-labelledby="sporsmal" className="mt-10">
          <h2 id="sporsmal" className="text-heading">
            Spørsmål
          </h2>
          <p className="mt-2">
            Ingen spørsmål ennå. Skriv det første, gjerne om noen dere kjenner,
            for eksempel «Hva gjør Jonas når han har forsovet seg?»
          </p>
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
    </>
  );
}
