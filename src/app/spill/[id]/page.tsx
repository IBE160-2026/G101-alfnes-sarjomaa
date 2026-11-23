import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache, type ReactNode } from "react";
import { CloseCollection } from "@/components/CloseCollection";
import { CollectingRefresh } from "@/components/CollectingRefresh";
import { DeleteGame } from "@/components/DeleteGame";
import { InviteLinkPanel } from "@/components/InviteLinkPanel";
import { ProgressCount } from "@/components/ProgressCount";
import { QuestionEditor } from "@/components/QuestionEditor";
import { RevokeLinkPanel } from "@/components/RevokeLinkPanel";
import { StatusBadge } from "@/components/StatusBadge";
import { DomainError } from "@/lib/errors";
import { FEWER_THAN_3 } from "@/lib/limits";
import * as auth from "@/server/auth";
import * as collection from "@/server/collection";
import { env } from "@/server/env";
import * as games from "@/server/games";
import * as questions from "@/server/questions";

// The close action posts here and inherits this (AD-24): close then VACUUMs, and
// Grouping (Story 4.2) runs after it.
export const maxDuration = 300;

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

  // One route; later stories add their state's panel here. Sections are keyed so the
  // Invite link panel (key "links") keeps its client state, the only copy of the new
  // links, when the first batch refreshes the page from draft to collecting.
  let panel: ReactNode[] = [];
  if (game.state === "draft" || game.state === "collecting") {
    const { hostId } = await auth.requireHost();
    const list = await questions.list(hostId, game.id);
    const progress = await collection.progress(hostId, game.id);
    const draft = game.state === "draft";
    const links = (
      <section key="links" aria-labelledby="lenker" className="mt-10">
        <h2 id="lenker" className="text-heading">
          {draft ? "Lag invitasjonslenker" : "Flere lenker"}
        </h2>
        <InviteLinkPanel
          gameId={game.id}
          state={game.state}
          issued={progress.issued}
          questionCount={list.length}
        />
      </section>
    );
    panel = draft
      ? [
          <section key="questions" aria-labelledby="sporsmal" className="mt-10">
            <h2 id="sporsmal" className="text-heading">
              Spørsmål
            </h2>
            <QuestionEditor gameId={game.id} questions={list} />
          </section>,
          links,
        ]
      : [
          <section
            key="progress"
            aria-labelledby="innsamling"
            className="mt-10"
          >
            <h2 id="innsamling" className="text-heading">
              Innsamling
            </h2>
            <ProgressCount
              active={progress.active}
              submissions={progress.submissions}
            />
            <CloseCollection
              gameId={game.id}
              canClose={progress.submissions !== FEWER_THAN_3}
              noKey={!env.OPENROUTER_API_KEY && !env.DEMO_MODE}
            />
            <CollectingRefresh />
          </section>,
          links,
          <section key="revoke" aria-labelledby="erstatt" className="mt-10">
            <h2 id="erstatt" className="text-heading">
              Erstatt en tapt lenke
            </h2>
            <RevokeLinkPanel gameId={game.id} issued={progress.issued} />
          </section>,
          <section key="locked" aria-labelledby="sporsmal" className="mt-10">
            <h2 id="sporsmal" className="text-heading">
              Spørsmål (låst)
            </h2>
            <ol className="mt-4 flex list-decimal flex-col gap-2 pl-6">
              {list.map((q) => (
                <li key={q.id} className="break-words">
                  {q.text}
                </li>
              ))}
            </ol>
          </section>,
        ];
  } else if (game.state === "grouping") {
    // The only place the Judge is explained (UX).
    // shortcut: nothing runs Grouping yet, so the Game stays here; Grouping, progress and 3 s polling arrive in Story 4.2.
    panel = [
      <section key="grouping" aria-labelledby="gruppering" className="mt-10">
        <h2 id="gruppering" className="text-heading">
          Gruppering
        </h2>
        <p className="mt-4 max-w-prose">
          {/* The no-break space keeps the ellipsis off the start of a line. */}
          Dommeren, en KI-modell, grupperer svarene&nbsp;… Det tar vanligvis
          under to minutter.
        </p>
        {/* Past the lease Grouping is slow or interrupted (AD-9), so the Host gets the way on. */}
        {game.leaseExpired && (
          <p className="mt-2 max-w-prose">
            Grupperingen tar lengre tid enn vanlig. Last inn siden på nytt.
          </p>
        )}
      </section>,
    ];
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
