import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { createGame } from "@/app/spill/actions";
import { DELETED_COOKIE } from "@/app/spill/deleted-notice";
import { CreateGameForm } from "@/components/CreateGameForm";
import { Notice } from "@/components/Notice";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDate } from "@/lib/format";
import { QUESTION_SETS } from "@/lib/question-sets";
import * as auth from "@/server/auth";
import * as games from "@/server/games";

async function ownedGames(hostId: string) {
  try {
    return await games.listOwned(hostId);
  } catch (error) {
    unstable_rethrow(error);
    return null; // already logged by the module boundary
  }
}

export const metadata: Metadata = { title: "Mine spill" };

export default async function GamesPage() {
  const { hostId } = await auth.requireHost();
  const slettet = (await cookies()).get(DELETED_COOKIE)?.value;
  const list = await ownedGames(hostId);
  return (
    <>
      <h1 className="text-display">Mine spill</h1>
      {slettet && (
        <Notice tone="success" className="mt-6">
          «{slettet}» er slettet.
        </Notice>
      )}
      <CreateGameForm
        action={createGame}
        questionSets={QUESTION_SETS.map(({ id, name }) => ({ id, name }))}
      />
      {list === null ? (
        <Notice tone="danger" className="mt-10">
          Fikk ikke hentet spillene dine. Last inn siden på nytt.
        </Notice>
      ) : list.length === 0 ? (
        <p className="mt-10">
          Du har ingen spill ennå. Gi det første et navn over, for eksempel
          «Hyttetur 2026».
        </p>
      ) : (
        <ul className="mt-10 divide-y divide-line border-y border-line">
          {list.map((game) => (
            <li
              key={game.id}
              className="flex flex-col py-3 sm:flex-row sm:items-center sm:gap-4"
            >
              <Link
                href={`/spill/${game.id}`}
                className="inline-flex min-h-11 min-w-0 items-center text-title break-words text-primary hover:underline sm:mr-auto"
              >
                {game.title}
              </Link>
              <div className="flex shrink-0 items-center gap-3">
                <StatusBadge state={game.state} />
                <p className="text-body-sm text-ink-muted">
                  Sist endret{" "}
                  <time dateTime={game.updatedAt.toISOString()}>
                    {formatDate(game.updatedAt)}
                  </time>
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
