"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  nextQuestion,
  passTurn,
  revealSlot,
  undoReveal,
} from "@/app/spill/[id]/actions";
import { isShortcut } from "@/components/FullscreenKey";
import { focusHeading } from "@/components/RouteFocus";
import { callAction } from "@/components/useFormAction";
import type { ActionResult, ErrorCode } from "@/lib/errors";
import { playChannel, type PlayMessage } from "@/lib/play";

// Another tab already moved on: the saved state is the answer, so refresh, no banner.
const STALE: ErrorCode[] = [
  "NOT_FOUND",
  "WRONG_STATE",
  "WRONG_QUESTION",
  "ALREADY_REVEALED",
  "NOTHING_TO_UNDO",
];

export const SHORTCUTS = [
  ["1–8", "Avslør plassen med det nummeret"],
  ["M", "Bom"],
  ["Z", "Angre siste avsløring"],
  ["T", "Neste lag"],
  ["U", "Vis resten uten poeng"],
  ["N, →", "Neste spørsmål"],
  ["?", "Vis hurtigtastene"],
  ["Esc", "Lukk"],
];

// Tells the TV page in this browser to re-read saved state, or to show Bom (AD-17).
export function postToTv(gameId: string, message: PlayMessage) {
  const channel = new BroadcastChannel(playChannel(gameId));
  channel.postMessage(message);
  channel.close();
}

// FR-24 to FR-27: the Host view's play moves and shortcuts.
// Every move is saved by a Server Action; the revalidated page shows the result. A
// slot's element carries data-slot inside listRef, so focus can follow a Reveal.
export function usePlay({
  gameId,
  questionPosition,
  total,
  board,
  lastReveal,
}: {
  gameId: string;
  questionPosition: number;
  total: number;
  board: { id: string; position: number; revealed: boolean }[];
  lastReveal: string | null;
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
      if (result?.ok) {
        postToTv(gameId, "changed");
        return onOk(result.data);
      }
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

  // Bom is visual only (FR-26 covers Reveals): the TV shows the panel, nothing is saved.
  function bom() {
    postToTv(gameId, "bom");
    // A trailing no-break space on every other miss, so a repeat is announced again.
    setSaid((said) => (said === "Bom." ? "Bom.\u00a0" : "Bom."));
  }

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

  return {
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
  };
}
