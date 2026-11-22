"use client";

import { useId, useRef, type ComponentProps, type ReactNode } from "react";
import { Button } from "@/components/Button";

// Native modal <dialog>: focus starts on cancel, Esc cancels, focus returns to
// the trigger (UX-DR8). The caller supplies the confirm control and its form.
export function ConfirmDialog({
  triggerLabel,
  triggerVariant,
  title,
  children,
  confirm,
  beforeOpen,
}: {
  triggerLabel: string;
  triggerVariant: ComponentProps<typeof Button>["variant"];
  title: string;
  children: ReactNode;
  confirm: ReactNode;
  // false keeps the dialog closed, e.g. when a field next to the trigger is invalid.
  beforeOpen?: () => boolean;
}) {
  const id = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  function open() {
    if (beforeOpen && !beforeOpen()) return;
    dialogRef.current?.showModal();
    cancelRef.current?.focus();
  }

  return (
    <>
      <Button
        ref={triggerRef}
        type="button"
        variant={triggerVariant}
        onClick={open}
      >
        {triggerLabel}
      </Button>
      <dialog
        ref={dialogRef}
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-body`}
        onClose={() => triggerRef.current?.focus()}
        className="m-auto w-[calc(100%-2rem)] max-w-120 rounded-lg bg-surface p-6 text-ink shadow-xl backdrop:bg-ink/55"
      >
        <h2 id={`${id}-title`} className="text-heading">
          {title}
        </h2>
        <div id={`${id}-body`} className="mt-3 flex flex-col gap-4">
          {children}
        </div>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Button
            ref={cancelRef}
            type="button"
            variant="secondary"
            onClick={() => dialogRef.current?.close()}
          >
            Avbryt
          </Button>
          {confirm}
        </div>
      </dialog>
    </>
  );
}
