"use client";

import {
  useEffect,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { Button } from "@/components/Button";

// A GroupCard's always-visible menu (UX-DR10): a disclosure with "Gi nytt navn" and
// "Forkast fra brettet". Esc closes it and returns focus to the trigger, a pointer-down
// outside closes it, and picking an item closes it. While `busy` it does nothing.
export function GroupMenu({
  groupId,
  label,
  busy,
  onRename,
  onDiscard,
}: {
  groupId: string;
  label: string;
  busy: boolean;
  onRename: () => void;
  onDiscard: () => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const listId = `meny-${groupId}`;

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  function onKeyDown(event: ReactKeyboardEvent) {
    if (!open || event.key !== "Escape") return;
    // Never reaches the selection's Esc listener on document.
    event.preventDefault();
    event.stopPropagation();
    setOpen(false);
    trigger.current?.focus();
  }

  function pick(action: () => void) {
    setOpen(false);
    // The item unmounts; the trigger keeps focus until the result moves it.
    trigger.current?.focus();
    action();
  }

  // Tabbing out closes it. A null relatedTarget (Safari's mouse-down on an item) is
  // ignored; the pointer-down listener handles outside clicks.
  function onBlur(event: FocusEvent<HTMLDivElement>) {
    const next = event.relatedTarget;
    if (open && next && !root.current?.contains(next)) setOpen(false);
  }

  return (
    <div ref={root} className="relative" onKeyDown={onKeyDown} onBlur={onBlur}>
      <Button
        ref={trigger}
        type="button"
        variant="ghost"
        aria-label={`Mer for «${label}»`}
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => !busy && setOpen((o) => !o)}
        className="size-11 px-0 text-title"
      >
        <span aria-hidden="true">⋯</span>
      </Button>
      <ul
        id={listId}
        hidden={!open}
        className="absolute top-full right-0 z-20 mt-1 w-max min-w-48 rounded-md border border-line bg-surface p-1 shadow-lg"
      >
        <li>
          <Button
            type="button"
            variant="ghost"
            onClick={() => pick(onRename)}
            className="w-full justify-start!"
          >
            Gi nytt navn
          </Button>
        </li>
        <li>
          <Button
            type="button"
            variant="ghost"
            onClick={() => pick(onDiscard)}
            className="w-full justify-start!"
          >
            Forkast fra brettet
          </Button>
        </li>
      </ul>
    </div>
  );
}
