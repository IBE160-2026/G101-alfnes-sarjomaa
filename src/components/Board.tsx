"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { revealSlot } from "@/app/spill/[id]/actions";
import { FullscreenKey } from "@/components/FullscreenKey";
import { callAction } from "@/components/useFormAction";
import type { ErrorCode } from "@/lib/errors";
import type { PlayView } from "@/server/play";

// Another tab already moved on: the saved state is the answer, so refresh, no banner.
const STALE: ErrorCode[] = [
  "NOT_FOUND",
  "WRONG_STATE",
  "WRONG_QUESTION",
  "ALREADY_REVEALED",
];

// UX-DR21 list budget: 696 px for up to eight rows with 8 px gaps, each 80–104 px.
const rowHeight = (n: number) =>
  Math.min(104, Math.max(80, (696 - 8 * (n - 1)) / n));

// FR-24, FR-25, UX-DR13, UX-DR14: the Board's tiles, the live region and the control-bar
// row. A click or rank key makes a scored Reveal; the revalidated page shows the result.
export function Board({
  gameId,
  board,
}: {
  gameId: string;
  board: PlayView["board"];
}) {
  const router = useRouter();
  const listRef = useRef<HTMLOListElement>(null);
  const busy = useRef(false);
  const [pending, startTransition] = useTransition();
  const [clicked, setClicked] = useState<string>();
  const [said, setSaid] = useState("");
  const [failure, setFailure] = useState<string>();
  // The slot whose button had focus, to focus its revealed row once it renders.
  const focusAfter = useRef<string>(undefined);

  const slotElement = (id: string) =>
    listRef.current?.querySelector<HTMLElement>(`[data-slot="${id}"]`);

  function reveal(id: string) {
    if (busy.current) return;
    busy.current = true;
    setFailure(undefined);
    // Marked now, so only a tile revealed from this tab animates (not a reload or refresh).
    setClicked(id);
    const hadFocus = slotElement(id)?.contains(document.activeElement);
    startTransition(async () => {
      const result = await callAction(() =>
        revealSlot({ gameId, boardSlotId: id, scored: true }),
      );
      busy.current = false;
      if (result?.ok) {
        const { label, count, team } = result.data;
        setSaid(`«${label}», ${count} poeng til ${team}.`);
        if (hadFocus) focusAfter.current = id;
        return;
      }
      // Not revealed by this tab, so no animation when a refresh shows it revealed.
      setClicked(undefined);
      if (!result) setFailure("Mistet forbindelsen.");
      else if (STALE.includes(result.code)) {
        if (hadFocus) focusAfter.current = id;
        router.refresh();
      } else setFailure("Fikk ikke lagret trekket. Prøv igjen.");
    });
  }

  // Keys 1–8 click the tile with that rank (EXPERIENCE.md, shortcuts). Re-bound each
  // render, so the listener always sees the current Board.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey)
        return;
      const target = event.target as HTMLElement;
      if (target.closest("input, textarea, select, [contenteditable]")) return;
      const slot = board.find((s) => String(s.position) === event.key);
      if (slot && !slot.revealed) reveal(slot.id);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    const id = focusAfter.current;
    if (!id || !board.some((s) => s.id === id && s.revealed)) return;
    focusAfter.current = undefined;
    slotElement(id)?.focus();
  }, [board]);

  const height = rowHeight(board.length);
  return (
    <>
      <ol
        ref={listRef}
        className="col-start-1 row-start-2 flex min-h-0 flex-col gap-2"
      >
        {board.map((slot) => (
          <li
            key={slot.id}
            className="flex"
            style={{ flex: `0 1 ${height}px` }}
          >
            {slot.revealed ? (
              <div
                data-slot={slot.id}
                data-revealing={slot.id === clicked ? "" : undefined}
                tabIndex={-1}
                className="flex flex-1 items-center rounded-md border-2 border-stage-ink bg-stage-ink px-6 text-ink"
              >
                <span className="w-14 shrink-0 text-tv-label">
                  {slot.position}
                </span>
                <span className="reveal-label min-w-0 flex-1 break-words text-tv-label leading-[1.05]">
                  {slot.label}
                </span>
                <span className="reveal-count ml-6 min-w-24 shrink-0 rounded-full bg-count-badge px-4 py-2 text-center text-tv-count tabular-nums text-stage-ink">
                  {slot.count}
                  <span className="sr-only"> poeng</span>
                </span>
              </div>
            ) : (
              <button
                type="button"
                data-slot={slot.id}
                aria-label={`Avslør plass ${slot.position}`}
                onClick={() => reveal(slot.id)}
                className={`flex flex-1 items-center rounded-md border-2 bg-stage-tile px-6 text-left text-tv-label ${
                  pending && slot.id === clicked
                    ? "border-stage-ink"
                    : "border-stage-line"
                }`}
              >
                <span className="w-14">{slot.position}</span>
              </button>
            )}
          </li>
        ))}
      </ol>
      <p role="status" className="sr-only">
        {said}
      </p>
      <div className="col-span-2 row-start-3 flex items-center rounded-md bg-stage-raised px-6 font-sans text-tv-control text-stage-muted">
        {failure && (
          <p role="alert" className="font-bold text-stage-ink">
            {failure}
          </p>
        )}
        {/* Kept mounted under the banner, so F still works. */}
        <FullscreenKey className={failure ? "hidden" : ""} />
      </div>
    </>
  );
}
