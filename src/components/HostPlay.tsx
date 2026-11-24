"use client";

import { Button } from "@/components/Button";
import { Notice } from "@/components/Notice";
import { OpenTvLink } from "@/components/OpenTvLink";
import { SHORTCUTS, usePlay } from "@/components/usePlay";
import type { AnswerKey } from "@/server/play";

// F belongs to the TV window; the Host view has every other play shortcut.
const HOST_SHORTCUTS = SHORTCUTS.filter(([key]) => key !== "F");

// FR-24 to FR-27: the Host view on a light Host page. The answer key with every slot's
// label and Count, the moves of the shared screen (usePlay) and the Teams; the TV page
// follows over the channel.
export function HostPlay({
  gameId,
  question,
  total,
  teams,
  board,
  lastReveal,
}: AnswerKey & { gameId: string }) {
  const {
    listRef,
    undoRef,
    helpRef,
    pending,
    clicked,
    said,
    failure,
    unscored,
    canUndo,
    allRevealed,
    reveal,
    undo,
    nextTeam,
    next,
    bom,
    toggleUnscored,
  } = usePlay({
    gameId,
    questionPosition: question.position,
    total,
    board,
    lastReveal,
  });

  return (
    <div
      data-wide=""
      className="grid gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1fr)_20rem]"
    >
      <div className="min-w-0">
        <h1 className="text-display break-words text-balance">
          {question.text}
        </h1>
        <p className="mt-2 text-ink-muted">
          Spørsmål {question.position} av {total}
        </p>
        <h2 id="fasit" className="sr-only">
          Fasit
        </h2>
        <ol
          ref={listRef}
          aria-labelledby="fasit"
          className="mt-6 border-t border-line"
        >
          {board.map((slot) => (
            <li
              key={slot.id}
              // A revealed row takes focus after its Reveal, as the stage tile does.
              data-slot={slot.revealed ? slot.id : undefined}
              tabIndex={slot.revealed ? -1 : undefined}
              // 5rem below sm still holds "Avslør" and "Uten poeng", so a 360 px phone keeps room for the label.
              className="grid min-h-15 grid-cols-[2rem_minmax(0,1fr)_auto_5rem] sm:grid-cols-[2rem_minmax(0,1fr)_auto_7.5rem] items-center gap-x-4 border-b border-line py-2 focus-visible:rounded-sm"
            >
              <span className="text-title tabular-nums text-ink-muted">
                {slot.position}
              </span>
              <span className="text-title break-words">{slot.label}</span>
              <span className="text-title tabular-nums">
                {slot.count}
                <span className="sr-only"> poeng</span>
              </span>
              {slot.revealed ? (
                <span
                  className={
                    slot.scored
                      ? "justify-self-end text-label text-success"
                      : "justify-self-end text-label text-ink-muted"
                  }
                >
                  {slot.scored ? "Avslørt" : "Uten poeng"}
                </span>
              ) : (
                <Button
                  variant="secondary"
                  data-slot={slot.id}
                  aria-label={`Avslør plass ${slot.position}`}
                  pending={pending && slot.id === clicked}
                  className="justify-self-end"
                  onClick={() => reveal(slot.id)}
                >
                  Avslør
                </Button>
              )}
            </li>
          ))}
        </ol>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button variant="secondary" onClick={bom}>
            Bom [M]
          </Button>
          {canUndo && (
            <Button ref={undoRef} variant="secondary" onClick={undo}>
              Angre [Z]
            </Button>
          )}
          <Button variant="secondary" onClick={nextTeam}>
            Neste lag [T]
          </Button>
          <Button
            variant="secondary"
            aria-pressed={unscored}
            className="aria-pressed:border-primary aria-pressed:bg-primary-soft aria-pressed:font-bold"
            onClick={toggleUnscored}
          >
            {unscored ? "Avslører uten poeng [U]" : "Vis resten uten poeng [U]"}
          </Button>
          {/* Primary once every slot is out: the one next step left (UX-DR16). */}
          <Button
            variant={allRevealed ? "primary" : "secondary"}
            onClick={next}
          >
            {question.position === total
              ? "Vis sluttstilling [N]"
              : "Neste spørsmål [N]"}
          </Button>
          <Button
            variant="secondary"
            aria-label="Hurtigtaster"
            className="min-w-11"
            onClick={() => helpRef.current?.showModal()}
          >
            ?
          </Button>
        </div>
        {failure && (
          <Notice tone="danger" className="mt-4">
            {failure}
          </Notice>
        )}
        <p role="status" className="mt-2 min-h-6 text-ink-muted">
          {said}
        </p>
      </div>
      <section aria-labelledby="lagene">
        <h2 id="lagene" className="text-heading">
          Lag
        </h2>
        <ol className="mt-4 flex flex-col gap-2">
          {teams.map((team) => (
            <li
              key={team.id}
              aria-current={team.current || undefined}
              className={`rounded-md border px-4 py-3 ${
                team.current
                  ? "border-primary bg-primary-soft text-primary"
                  : "border-line bg-surface"
              }`}
            >
              {team.current && (
                <p className="text-label text-primary">Svarer nå</p>
              )}
              <div className="flex items-baseline justify-between gap-4">
                <p className="min-w-0 text-title break-words">{team.name}</p>
                <p className="font-display text-display tabular-nums">
                  {team.score}
                  <span className="sr-only"> poeng</span>
                </p>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-8 border-t border-line pt-6">
          <OpenTvLink
            gameId={gameId}
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-line-strong bg-surface px-4 text-primary hover:bg-surface-sunken"
          />
          <p className="mt-2 text-body-sm text-ink-muted">
            Trykk F i TV-vinduet for fullskjerm.
          </p>
          <p className="mt-1 text-body-sm text-ink-muted">
            Bruk TV-en som utvidet skjerm, ikke speilet, ellers ser alle i
            rommet fasiten.
          </p>
        </div>
      </section>
      <dialog
        ref={helpRef}
        aria-labelledby="hurtigtaster"
        className="m-auto w-[calc(100%-2rem)] max-w-120 rounded-lg bg-surface p-6 text-ink shadow-xl backdrop:bg-ink/55"
      >
        <h2 id="hurtigtaster" className="text-heading">
          Hurtigtaster
        </h2>
        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
          {HOST_SHORTCUTS.map(([key, action]) => (
            <div key={key} className="contents">
              <dt>
                <kbd className="font-sans font-bold">{key}</kbd>
              </dt>
              <dd>{action}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-6 flex justify-end">
          <Button variant="secondary" onClick={() => helpRef.current?.close()}>
            Lukk
          </Button>
        </div>
      </dialog>
    </div>
  );
}
