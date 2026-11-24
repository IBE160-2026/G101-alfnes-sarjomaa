import Link from "next/link";
import type { CSSProperties } from "react";
import { Board } from "@/components/Board";
import { FullscreenKey } from "@/components/FullscreenKey";
import { FocusOnMount } from "@/components/RouteFocus";
import { TvBoard } from "@/components/TvBoard";
import { formatDate } from "@/lib/format";
import type { PlayView as Data, FinalScores as Final } from "@/server/play";

// 56 px up to this many characters, 48 px above (EXPERIENCE.md, play view rules).
const SHORT_QUESTION = 80;

const STAGE =
  "fixed inset-0 overflow-hidden bg-stage font-display text-stage-ink [&_:focus-visible]:outline-focus-inverse";

// FR-24, UX-DR21: the shared screen from saved state, on a fixed 1920×1080 canvas that
// globals.css scales to the window. Fixed over the Host page, whose chrome globals.css
// hides while a [data-stage] element is on the page. `tv`: the TV page, with no controls.
export function PlayView({
  gameId,
  question,
  total,
  teams,
  board,
  lastReveal,
  credit,
  tv = false,
}: Data & { gameId: string; credit?: string; tv?: boolean }) {
  return (
    <div data-stage="" className={STAGE}>
      {/* pb-[3px]: the budget's remainder, 1080 − 48 − 221 − 24 − 696 − 24 − 64 = 3, so the list row is 696 px. */}
      <div className="stage-canvas grid grid-cols-[1312px_448px] grid-rows-[minmax(221px,auto)_minmax(0,1fr)_64px] gap-x-8 gap-y-6 px-16 pt-12 pb-[3px]">
        <h1
          className={`self-start break-words text-balance ${
            question.text.length > SHORT_QUESTION
              ? "text-tv-question-long"
              : "text-tv-question"
          }`}
        >
          {question.text}
        </h1>
        <div className="col-start-2 row-span-2 row-start-1 min-h-0">
          <p className="text-tv-team text-stage-muted">
            Spørsmål {question.position} av {total}
          </p>
          {/* FR-33: attribution, not game content, so the 24 px host style (EXPERIENCE.md). */}
          {credit && (
            <p className="mt-2 font-sans text-tv-control text-stage-muted">
              {credit}
            </p>
          )}
          {/* The Score sits beside the name (beside "Svarer nå" on the active card), so four
              14-character names of wide letters still fit the 941 px column (A8). */}
          <ol aria-label="Lag" className="mt-6 flex flex-col gap-3">
            {teams.map((team) => (
              <li
                key={team.id}
                aria-current={team.current || undefined}
                className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 rounded-md px-6 py-4 ${
                  team.current
                    ? "bg-stage-accent text-stage-on-accent"
                    : "bg-stage-raised"
                }`}
              >
                {team.current && <p className="text-tv-team">Svarer nå</p>}
                <p
                  className={`text-tv-team break-words hyphens-auto ${
                    team.current ? "col-span-2" : ""
                  }`}
                >
                  {team.name}
                </p>
                <p
                  className={`text-tv-score tabular-nums ${
                    team.current ? "col-start-2 row-start-1" : ""
                  }`}
                >
                  {/* Counts up visually by CSS; the real value is the sr-only text. */}
                  <span
                    aria-hidden="true"
                    className="score-count"
                    style={{ "--score": team.score } as CSSProperties}
                  />
                  <span className="sr-only">{team.score} poeng</span>
                </p>
              </li>
            ))}
          </ol>
        </div>
        {tv ? (
          <TvBoard
            gameId={gameId}
            board={board}
            version={JSON.stringify([question.position, teams, board])}
          />
        ) : (
          <Board
            gameId={gameId}
            questionPosition={question.position}
            total={total}
            board={board}
            lastReveal={lastReveal}
          />
        )}
      </div>
    </div>
  );
}

// FR-27, UX-DR21: "Sluttstilling" on the same canvas. The top Score takes the active
// card look with "Vinner", or "Uavgjort" on every Team that shares it. On the TV page
// (`tv`) the Host-only line and link are left out; F still works.
export function FinalScores({
  gameId,
  teams,
  deleteAfter,
  tv = false,
}: Final & { gameId: string; tv?: boolean }) {
  const top = teams[0].score;
  const tied = teams.filter((t) => t.score === top).length > 1;
  return (
    <div data-stage="" className={STAGE}>
      <div className="stage-canvas flex flex-col items-center justify-center">
        <div className="w-280">
          <h1 id="sluttstilling" className="text-tv-question">
            Sluttstilling
          </h1>
          <FocusOnMount id="sluttstilling" />
          <ol aria-label="Sluttstilling" className="mt-12 flex flex-col gap-4">
            {teams.map((team) => {
              const best = team.score === top;
              return (
                <li
                  key={team.id}
                  className={`flex items-center justify-between gap-8 rounded-md px-8 py-6 ${
                    best
                      ? "bg-stage-accent text-stage-on-accent"
                      : "bg-stage-raised"
                  }`}
                >
                  <div className="min-w-0">
                    {best && (
                      <p className="text-tv-team">
                        {tied ? "Uavgjort" : "Vinner"}
                      </p>
                    )}
                    <p className="text-tv-team break-words">{team.name}</p>
                  </div>
                  <p className="text-tv-score-final tabular-nums">
                    {team.score}
                    <span className="sr-only"> poeng</span>
                  </p>
                </li>
              );
            })}
          </ol>
          {tv ? (
            <FullscreenKey className="hidden" />
          ) : (
            <div className="mt-12 flex items-center justify-between gap-8 font-sans text-tv-control">
              <p className="text-stage-muted">
                {`Spillet slettes automatisk ${formatDate(deleteAfter)}.`}
              </p>
              <FullscreenKey className="text-stage-muted" />
              <Link
                href={`/spill/${gameId}`}
                className="inline-flex min-h-11 items-center rounded-sm text-stage-ink underline underline-offset-4"
              >
                Tilbake til spillet
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Shown while play.load runs; appear keeps it invisible for 300 ms, so fast loads never flash.
export function StageLoading() {
  return (
    <div data-stage="" className={`${STAGE} grid place-items-center`}>
      <p role="status" className="animate-appear text-tv-team text-stage-ink">
        Henter spillet&nbsp;…
      </p>
    </div>
  );
}
