"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  nextQuestion,
  passTurn,
  revealSlot,
  undoReveal,
} from "@/app/spill/[id]/actions";
import { FullscreenKey, isShortcut } from "@/components/FullscreenKey";
import { focusHeading } from "@/components/RouteFocus";
import { callAction } from "@/components/useFormAction";
import type { ActionResult, ErrorCode } from "@/lib/errors";
import type { PlayView } from "@/server/play";

// Another tab already moved on: the saved state is the answer, so refresh, no banner.
const STALE: ErrorCode[] = [
  "NOT_FOUND",
  "WRONG_STATE",
  "WRONG_QUESTION",
  "ALREADY_REVEALED",
  "NOTHING_TO_UNDO",
];

// UX-DR21 list budget: 696 px for up to eight rows with 8 px gaps, each 80–104 px.
const rowHeight = (n: number) =>
  Math.min(104, Math.max(80, (696 - 8 * (n - 1)) / n));

const BOM_MS = 1500;

const SHORTCUTS = [
  ["1–8", "Avslør plassen med det nummeret"],
  ["M", "Bom"],
  ["Z", "Angre siste avsløring"],
  ["T", "Neste lag"],
  ["U", "Vis resten uten poeng"],
  ["N, →", "Neste spørsmål"],
  ["F", "Fullskjerm av og på"],
  ["?", "Vis hurtigtastene"],
  ["Esc", "Lukk"],
];

const CONTROL = "min-h-11 rounded-sm px-2 hover:text-stage-ink";

// FR-24 to FR-27, UX-DR13, UX-DR14: the Board's tiles, the live region and the control
// bar. Every move is saved by a Server Action; the revalidated page shows the result.
export function Board({
  gameId,
  questionPosition,
  total,
  board,
  lastReveal,
  credit,
}: {
  gameId: string;
  questionPosition: number;
  total: number;
  board: PlayView["board"];
  lastReveal: PlayView["lastReveal"];
  // FR-33: the source credit, at the bar's right end (EXPERIENCE.md, play view rules).
  credit?: string;
}) {
  const router = useRouter();
  const listRef = useRef<HTMLOListElement>(null);
  const undoRef = useRef<HTMLButtonElement>(null);
  const helpRef = useRef<HTMLDialogElement>(null);
  const busy = useRef(false);
  const [pending, startTransition] = useTransition();
  const [clicked, setClicked] = useState<string>();
  const [said, setSaid] = useState("");
  const [failure, setFailure] = useState<string>();
  // Held as the Question it was switched on for, so it is off on any other (no remount).
  const [unscoredFor, setUnscoredFor] = useState<number>();
  const unscored = unscoredFor === questionPosition;
  // Bom is visual only (FR-26 covers Reveals): a new key restarts the panel's animation.
  const [miss, setMiss] = useState(0);
  const missTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // The slot to focus once it renders in this state (a revealed row, or a tile again).
  const focusAfter = useRef<{ id: string; revealed: boolean }>(undefined);
  // The Question whose <h1> takes focus once it renders (a focused tile unmounted).
  const focusQuestion = useRef<number>(undefined);

  const canUndo = lastReveal !== null;
  const allRevealed = board.every((s) => s.revealed);

  const slotElement = (id: string) =>
    listRef.current?.querySelector<HTMLElement>(`[data-slot="${id}"]`);

  // One move at a time, with the same failure handling for every move.
  function run<T>(
    call: () => Promise<ActionResult<T>>,
    onOk: (data: T) => void,
    onStale?: () => void,
  ) {
    if (busy.current) return;
    busy.current = true;
    setFailure(undefined);
    startTransition(async () => {
      const result = await callAction(call);
      busy.current = false;
      if (result?.ok) return onOk(result.data);
      // Not revealed by this tab, so no animation when a refresh shows it revealed.
      setClicked(undefined);
      if (!result) setFailure("Mistet forbindelsen.");
      else if (STALE.includes(result.code)) {
        onStale?.();
        router.refresh();
      } else setFailure("Fikk ikke lagret trekket. Prøv igjen.");
    });
  }

  function reveal(id: string) {
    if (busy.current) return;
    // Marked now, so only a tile revealed from this tab animates (not a reload or refresh).
    setClicked(id);
    const hadFocus = slotElement(id)?.contains(document.activeElement);
    const focusRow = () => {
      if (hadFocus) focusAfter.current = { id, revealed: true };
    };
    // The last hidden tile: the one live region says both sentences (EXPERIENCE.md).
    const done =
      board.filter((s) => !s.revealed).length === 1
        ? " Alle svarene er avslørt."
        : "";
    run(
      () => revealSlot({ gameId, boardSlotId: id, scored: !unscored }),
      ({ label, count, team }) => {
        setSaid(
          (team
            ? `«${label}», ${count} poeng til ${team}.`
            : `«${label}» er avslørt uten poeng.`) + done,
        );
        focusRow();
      },
      focusRow,
    );
  }

  function undo() {
    if (!lastReveal) return;
    const hadFocus = undoRef.current === document.activeElement;
    const last = board.filter((s) => s.revealed).length === 1;
    // A revealed row with focus unmounts when undone, so its tile takes focus back.
    const focusedSlot = document.activeElement
      ?.closest<HTMLElement>("[data-slot]")
      ?.getAttribute("data-slot");
    run(
      () => undoReveal({ gameId, boardSlotId: lastReveal }),
      ({ boardSlotId, label, count, team }) => {
        setClicked(undefined);
        setSaid(
          team
            ? `Angret. «${label}» er skjult igjen, ${count} poeng trukket fra ${team}.`
            : `Angret. «${label}» er skjult igjen.`,
        );
        // Angre goes with the last Reveal, so focus goes to the tile it hid again.
        if ((hadFocus && last) || focusedSlot === boardSlotId)
          focusAfter.current = { id: boardSlotId, revealed: false };
      },
    );
  }

  function nextTeam() {
    run(
      () => passTurn({ gameId }),
      ({ team }) => setSaid(`${team} svarer nå.`),
    );
  }

  // On the last Question this finishes the Game, and the page swaps to "Sluttstilling".
  function next() {
    const inList = listRef.current?.contains(document.activeElement);
    run(
      () => nextQuestion({ gameId, position: questionPosition }),
      (result) => {
        if (result.finished) return;
        setSaid(`Spørsmål ${result.position} av ${total}.`);
        if (inList) focusQuestion.current = result.position;
      },
    );
  }

  function bom() {
    setMiss((n) => n + 1);
    // A trailing no-break space on every other miss, so a repeat is announced again.
    setSaid((said) => (said === "Bom." ? "Bom.\u00a0" : "Bom."));
    clearTimeout(missTimer.current);
    missTimer.current = setTimeout(() => setMiss(0), BOM_MS);
  }
  useEffect(() => () => clearTimeout(missTimer.current), []);

  function toggleUnscored() {
    setUnscoredFor(unscored ? undefined : questionPosition);
    setSaid(unscored ? "Avslører med poeng." : "Avslører uten poeng.");
  }

  // Shortcuts (EXPERIENCE.md). Re-bound each render, so the listener sees the current
  // Board. Ignored in a text field and inside the open overlay.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!isShortcut(event)) return;
      if (event.key === "?") return helpRef.current?.showModal();
      if (event.shiftKey) return;
      const key = event.key.toLowerCase();
      if (key === "m") bom();
      else if (key === "z") {
        if (canUndo) undo();
      } else if (key === "t") nextTeam();
      else if (key === "u") toggleUnscored();
      else if (key === "n" || key === "arrowright") next();
      else {
        const slot = board.find((s) => String(s.position) === event.key);
        if (slot && !slot.revealed) reveal(slot.id);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    if (focusQuestion.current === questionPosition) {
      focusQuestion.current = undefined;
      focusHeading();
    }
    const want = focusAfter.current;
    if (
      !want ||
      !board.some((s) => s.id === want.id && s.revealed === want.revealed)
    )
      return;
    focusAfter.current = undefined;
    slotElement(want.id)?.focus();
  }, [board, questionPosition]);

  const height = rowHeight(board.length);
  const hints = (
    <>
      <p className={failure ? "hidden" : "ml-auto text-stage-ink"}>
        {allRevealed && "Alle svarene er avslørt."}
      </p>
      {/* Kept mounted under the banner, so F still works. */}
      <FullscreenKey className={failure ? "hidden" : ""} />
    </>
  );
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
            ) : (
              <button
                type="button"
                data-slot={slot.id}
                aria-label={`Avslør plass ${slot.position}`}
                onClick={() => reveal(slot.id)}
                className={`flex flex-1 items-center rounded-md border-2 bg-stage-tile px-6 text-left text-tv-label ${
                  pending && slot.id === clicked
                    ? "border-stage-ink"
                    : unscored
                      ? "border-dashed border-stage-line"
                      : "border-stage-line"
                }`}
              >
                <span className="w-14">{slot.position}</span>
              </button>
            )}
          </li>
        ))}
      </ol>
      {miss > 0 && (
        <div
          key={miss}
          aria-hidden="true"
          className="bom-panel pointer-events-none col-start-1 row-start-2 place-self-center rounded-md border-2 border-stage-line bg-stage-raised px-16 py-6 text-tv-score text-stage-ink"
        >
          Bom
        </div>
      )}
      <p role="status" className="sr-only">
        {said}
      </p>
      <div
        className={`col-span-2 row-start-3 flex items-center ${credit ? "gap-6" : "gap-8"} rounded-md bg-stage-raised px-6 font-sans text-tv-control text-stage-muted`}
      >
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
        {credit ? (
          // FR-33: the credit takes a second line at the right end, so the fullest bar
          // (every control and both hints) still fits 1920 px.
          <div className={failure ? "hidden" : "ml-auto text-right leading-none"}>
            <div className="flex justify-end gap-6">{hints}</div>
            <p>{credit}</p>
          </div>
        ) : (
          hints
        )}
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
