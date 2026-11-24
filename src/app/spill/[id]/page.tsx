import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { cache, type ReactNode } from "react";
import { CloseCollection } from "@/components/CloseCollection";
import { CollectingRefresh } from "@/components/CollectingRefresh";
import { DeleteGame } from "@/components/DeleteGame";
import { DownloadReport } from "@/components/DownloadReport";
import { GroupingRefresh } from "@/components/GroupingRefresh";
import { InviteLinkPanel } from "@/components/InviteLinkPanel";
import { Notice } from "@/components/Notice";
import { ProgressCount } from "@/components/ProgressCount";
import { QuestionEditor } from "@/components/QuestionEditor";
import { RevokeLinkPanel } from "@/components/RevokeLinkPanel";
import { StatusBadge } from "@/components/StatusBadge";
import { DomainError } from "@/lib/errors";
import { REPORT_STATES } from "@/lib/game-state";
import { formatDate } from "@/lib/format";
import { FEWER_THAN_3 } from "@/lib/limits";
import * as auth from "@/server/auth";
import * as collection from "@/server/collection";
import { env } from "@/server/env";
import * as games from "@/server/games";
import * as grouping from "@/server/grouping";
import * as play from "@/server/play";
import * as questions from "@/server/questions";

// The close action posts here and inherits this (AD-24): close then VACUUMs, and
// Grouping runs after it.
export const maxDuration = 300;

const PRIMARY_LINK =
  "mt-6 inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-4 text-title text-on-primary hover:bg-primary-hover";

const isNotFound = (error: unknown) =>
  error instanceof DomainError && error.code === "NOT_FOUND";

// Each Team and its Score, on the playing and the played Game page.
const scoreList = (teams: { id: string; name: string; score: number }[]) => (
  <dl className="mt-4 max-w-md border-t border-line">
    {teams.map((team) => (
      <div
        key={team.id}
        className="flex items-baseline justify-between gap-4 border-b border-line py-3"
      >
        <dt className="min-w-0 break-words">{team.name}</dt>
        <dd className="text-title tabular-nums">
          {team.score}
          <span className="sr-only"> poeng</span>
        </dd>
      </div>
    ))}
  </dl>
);

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
    const { done, total } = await grouping.progress(game.id);
    // Past the lease the run is slow or interrupted: resume it after the response, so the
    // page never waits for it (AD-12). The boundary has already logged any failure.
    const gameId = game.id;
    if (game.leaseExpired)
      after(() => grouping.resumeIfStale(gameId).catch(() => {}));
    // The only place the Judge is explained (UX).
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
        {/* Static, like ProgressCount: no live region, the poll only refreshes it. */}
        <p className="mt-4 text-body">
          <span className="font-display text-display tabular-nums">{done}</span>
          {` av ${total} spørsmål ferdig`}
        </p>
        {/* Past the lease Grouping is slow or interrupted (AD-9). The poll already resumes it,
            so the Host is told nothing needs doing. */}
        {game.leaseExpired && (
          <Notice tone="warning" className="mt-4 max-w-prose">
            <strong>Grupperingen tar lengre tid enn vanlig.</strong> Siden
            oppdateres av seg selv. Stopper grupperingen, fortsetter den der den
            slapp.
          </Notice>
        )}
        <GroupingRefresh />
      </section>,
    ];
  } else if (game.state === "in_review") {
    const result = await grouping.summary(game.id);
    // Numbers only, no key sentence: it must read right for every fallback reason and in
    // Demo mode. The reason-specific Notice belongs to Review (Epic 5).
    const rows: [string, number][] = [
      ["Spørsmål i alt", result.questions],
      ["Grupper foreslått", result.groupsProposed],
      ["Spørsmål å gruppere for hånd", result.fellBack],
    ];
    panel = [
      <section key="review" aria-labelledby="gjennomgang" className="mt-10">
        <h2 id="gjennomgang" className="text-heading">
          Grupperingen er ferdig
        </h2>
        <dl className="mt-4 max-w-md border-t border-line">
          {rows.map(([label, value]) => (
            <div
              key={label}
              className="flex items-baseline justify-between gap-4 border-b border-line py-3"
            >
              <dt>{label}</dt>
              <dd className="text-title tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        <Link href={`/spill/${game.id}/gjennomgang`} className={PRIMARY_LINK}>
          Gå til gjennomgangen
        </Link>
      </section>,
    ];
  } else if (game.state === "ready") {
    const { hostId } = await auth.requireHost();
    const n = (await questions.list(hostId, game.id)).length;
    panel = [
      <section key="ready" aria-labelledby="brettet" className="mt-10">
        <h2 id="brettet" className="text-heading">
          {/* A set Game's Board came ready-made; the Host never locked it (FR-33). */}
          {game.questionSet ? "Brettet er klart" : "Brettet er låst"}
        </h2>
        <p className="mt-4">
          {n === 1 ? "1 spørsmål er klart." : `${n} spørsmål er klare.`}
        </p>
        <Link href={`/spill/${game.id}/skjerm`} className={PRIMARY_LINK}>
          Start spillet
        </Link>
      </section>,
    ];
  } else if (game.state === "playing") {
    const { hostId } = await auth.requireHost();
    const { question, total, teams } = await play.load(hostId, game.id);
    panel = [
      <section key="playing" aria-labelledby="i-gang" className="mt-10">
        <h2 id="i-gang" className="text-heading">
          Spillet er i gang
        </h2>
        <p className="mt-4">
          Spørsmål {question.position} av {total}.
        </p>
        {scoreList(teams)}
        <Link href={`/spill/${game.id}/skjerm`} className={PRIMARY_LINK}>
          Fortsett spillet
        </Link>
      </section>,
    ];
  } else if (game.state === "played") {
    const { hostId } = await auth.requireHost();
    const { teams, deleteAfter } = await play.finalScores(hostId, game.id);
    panel = [
      <section key="played" aria-labelledby="sluttstilling" className="mt-10">
        <h2 id="sluttstilling" className="text-heading">
          Sluttstilling
        </h2>
        {scoreList(teams)}
        <Link href={`/spill/${game.id}/skjerm`} className={PRIMARY_LINK}>
          Vis sluttstilling
        </Link>
        <Notice tone="info" live={false} className="mt-6 max-w-prose">
          {game.questionSet ? "Spillet" : "Spillet og alle svarene"} slettes
          automatisk {formatDate(deleteAfter)}.
        </Notice>
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
      {/* Secondary, never primary: each state keeps its one primary action (UX-DR16).
          A Question-set Game had no Grouping, so it has nothing to report (FR-33). */}
      {REPORT_STATES.includes(game.state) && !game.questionSet && (
        <div className="mt-10">
          <DownloadReport href={`/api/spill/${game.id}/rapport`} />
        </div>
      )}
      {/* Every state (FR-3), outside the switch. */}
      <footer className="mt-16 border-t border-line pt-6">
        <DeleteGame gameId={game.id} title={game.title} />
      </footer>
    </>
  );
}
