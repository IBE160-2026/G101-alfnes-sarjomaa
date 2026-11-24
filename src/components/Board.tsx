"use client";

import type { RefObject } from "react";
import { FullscreenKey } from "@/components/FullscreenKey";
import { SHORTCUTS, usePlay } from "@/components/usePlay";
import type { PlayView } from "@/server/play";

// UX-DR21 list budget: 696 px for up to eight rows with 8 px gaps, each 80–104 px.
const rowHeight = (n: number) =>
  Math.min(104, Math.max(80, (696 - 8 * (n - 1)) / n));

const CONTROL = "min-h-11 rounded-sm px-2 hover:text-stage-ink";

// The stage's top list, shared by the shared screen and the TV page. Without onReveal a
// hidden tile is not a button (the TV page has no controls).
export function BoardTiles({
  board,
  listRef,
  revealing,
  pendingSlot,
  unscored = false,
  onReveal,
}: {
  board: PlayView["board"];
  listRef?: RefObject<HTMLOListElement | null>;
  revealing: (id: string) => boolean;
  pendingSlot?: string;
  unscored?: boolean;
  onReveal?: (id: string) => void;
}) {
  const height = rowHeight(board.length);
  const hiddenBorder = unscored
    ? "border-dashed border-stage-line"
    : "border-stage-line";
  return (
    <ol
      ref={listRef}
      className="col-start-1 row-start-2 flex min-h-0 flex-col gap-2"
    >
      {board.map((slot) => (
        <li key={slot.id} className="flex" style={{ flex: `0 1 ${height}px` }}>
          {slot.revealed ? (
            <div
              data-slot={slot.id}
              data-revealing={revealing(slot.id) ? "" : undefined}
              tabIndex={-1}
              // min-w-0: an unbroken 40-character label wraps inside the tile (A9).
              className={`flex min-w-0 flex-1 items-center rounded-md border-2 px-6 ${
                slot.scored
                  ? "border-stage-ink bg-stage-ink text-ink"
                  : "border-dashed border-stage-line bg-stage-raised text-stage-ink"
              }`}
            >
              <span className="w-14 shrink-0 text-tv-label">
                {slot.position}
              </span>
              <span className="reveal-label min-w-0 flex-1 break-words text-tv-label leading-[1.05]">
                {slot.label}
              </span>
              {slot.scored ? (
                <span className="reveal-count ml-6 min-w-24 shrink-0 rounded-full bg-count-badge px-4 py-2 text-center text-tv-count tabular-nums text-stage-ink">
                  {slot.count}
                  <span className="sr-only"> poeng</span>
                </span>
              ) : (
                <span className="reveal-count ml-6 flex shrink-0 items-baseline gap-4">
                  <span className="text-tv-count tabular-nums text-stage-muted">
                    {slot.count}
                  </span>
                  <span className="font-sans text-tv-control text-stage-muted">
                    uten poeng
                  </span>
                </span>
              )}
            </div>
          ) : onReveal ? (
            <button
              type="button"
              data-slot={slot.id}
              aria-label={`Avslør plass ${slot.position}`}
              onClick={() => onReveal(slot.id)}
              className={`flex flex-1 items-center rounded-md border-2 bg-stage-tile px-6 text-left text-tv-label ${
                slot.id === pendingSlot ? "border-stage-ink" : hiddenBorder
              }`}
            >
              <span className="w-14">{slot.position}</span>
            </button>
          ) : (
            <div
              className={`flex flex-1 items-center rounded-md border-2 bg-stage-tile px-6 text-tv-label ${hiddenBorder}`}
            >
              <span className="w-14">{slot.position}</span>
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}

// "Bom" over the list; a new key restarts its animation. Visual only: a miss saves nothing.
export function BomPanel({ miss }: { miss: number }) {
  if (miss === 0) return null;
  return (
    <div
      key={miss}
      aria-hidden="true"
      className="bom-panel pointer-events-none col-start-1 row-start-2 place-self-center rounded-md border-2 border-stage-line bg-stage-raised px-16 py-6 text-tv-score text-stage-ink"
    >
      Bom
    </div>
  );
}

// FR-24 to FR-27, UX-DR13, UX-DR14: the shared screen's tiles, the live region and the
// control bar, over the play moves in usePlay.
export function Board({
  gameId,
  questionPosition,
  total,
  board,
  lastReveal,
}: {
  gameId: string;
  questionPosition: number;
  total: number;
  board: PlayView["board"];
  lastReveal: PlayView["lastReveal"];
}) {
  const {
    listRef,
    undoRef,
    helpRef,
    pending,
    clicked,
    said,
    failure,
    unscored,
    miss,
    canUndo,
    allRevealed,
    reveal,
    undo,
    nextTeam,
    next,
    bom,
    toggleUnscored,
  } = usePlay({ gameId, questionPosition, total, board, lastReveal });

  return (
    <>
      <BoardTiles
        board={board}
        listRef={listRef}
        revealing={(id) => id === clicked}
        pendingSlot={pending ? clicked : undefined}
        unscored={unscored}
        onReveal={reveal}
      />
      <BomPanel miss={miss} />
      <p role="status" className="sr-only">
        {said}
      </p>
      <div className="col-span-2 row-start-3 flex items-center gap-8 rounded-md bg-stage-raised px-6 font-sans text-tv-control text-stage-muted">
        {failure ? (
          <p role="alert" className="font-bold text-stage-ink">
            {failure}
          </p>
        ) : (
          <>
            <button type="button" className={CONTROL} onClick={bom}>
              Bom [M]
            </button>
            {canUndo && (
              <button
                ref={undoRef}
                type="button"
                className={CONTROL}
                onClick={undo}
              >
                Angre [Z]
              </button>
            )}
            <button type="button" className={CONTROL} onClick={nextTeam}>
              Neste lag [T]
            </button>
            <button
              type="button"
              aria-pressed={unscored}
              className={`${CONTROL} ${unscored ? "font-bold text-stage-ink" : ""}`}
              onClick={toggleUnscored}
            >
              {unscored
                ? "Avslører uten poeng [U]"
                : "Vis resten uten poeng [U]"}
            </button>
            <button
              type="button"
              className={`${CONTROL} ${allRevealed ? "font-bold text-stage-ink" : ""}`}
              onClick={next}
            >
              {questionPosition === total
                ? "Vis sluttstilling [N]"
                : "Neste spørsmål [N]"}
            </button>
            <button
              type="button"
              aria-label="Hurtigtaster"
              className={`${CONTROL} min-w-11`}
              onClick={() => helpRef.current?.showModal()}
            >
              ?
            </button>
          </>
        )}
        <p className={failure ? "hidden" : "ml-auto text-stage-ink"}>
          {allRevealed && "Alle svarene er avslørt."}
        </p>
        {/* Kept mounted under the banner, so F still works. */}
        <FullscreenKey className={failure ? "hidden" : ""} />
      </div>
      <dialog
        ref={helpRef}
        aria-labelledby="hurtigtaster"
        className="m-auto w-[calc(100%-2rem)] max-w-160 rounded-lg border-2 border-stage-line bg-stage-raised p-10 font-sans text-tv-control text-stage-ink backdrop:bg-stage/80"
      >
        <h2 id="hurtigtaster" className="text-display">
          Hurtigtaster
        </h2>
        <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-8 gap-y-3">
          {SHORTCUTS.map(([key, action]) => (
            <div key={key} className="contents">
              <dt>
                <kbd className="font-sans font-bold">{key}</kbd>
              </dt>
              <dd className="font-normal">{action}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-8 flex justify-end">
          <button
            type="button"
            className="min-h-11 rounded-md border-2 border-stage-line px-6 hover:border-stage-ink"
            onClick={() => helpRef.current?.close()}
          >
            Lukk
          </button>
        </div>
      </dialog>
    </>
  );
}
