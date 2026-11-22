"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { closeCollection } from "@/app/spill/[id]/actions";
import { Button } from "@/components/Button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Notice } from "@/components/Notice";
import { focusHeading } from "@/components/RouteFocus";
import { callAction, NETWORK } from "@/components/useFormAction";
import { MESSAGES } from "@/lib/errors";

// Stale views: the page shows the Game's real state after a refresh.
const REFRESH_ON = new Set(["WRONG_STATE", "NOT_FOUND", "TOO_FEW_ANSWER_SETS"]);

// FR-10. Below three sets the trigger is aria-disabled with the reason; the server
// checks again under the lock. `canClose` comes from progress, so no count leaks.
export function CloseCollection({
  gameId,
  canClose,
  noKey,
}: {
  gameId: string;
  canClose: boolean;
  noKey: boolean;
}) {
  const router = useRouter();
  const reasonId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const noticeRef = useRef<HTMLDivElement>(null);
  const [failure, setFailure] = useState<string>();
  const [pending, startTransition] = useTransition();
  // After an action this panel unmounts when the page changes state, and the trigger the
  // dialog would return focus to goes with it, so focus moves to the new state's heading.
  const acted = useRef(false);
  const shown = useRef(canClose);

  useEffect(() => {
    if (failure) noticeRef.current?.focus();
  }, [failure]);

  // A refresh swaps the disabled trigger for the dialog's, or back after a refused close,
  // and the control that held focus goes with it. The panel survived, so nothing is armed.
  useEffect(() => {
    if (shown.current === canClose) return;
    shown.current = canClose;
    acted.current = false;
    if (document.activeElement === document.body)
      rootRef.current?.querySelector("button")?.focus();
  }, [canClose]);

  useEffect(
    () => () => {
      if (acted.current)
        focusHeading(document.getElementById("gruppering") ?? undefined);
    },
    [],
  );

  function close() {
    setFailure(undefined);
    startTransition(async () => {
      const result = await callAction(() => closeCollection({ gameId }));
      if (result?.ok) {
        acted.current = true;
        return;
      }
      // A rejected call may still have committed on the server, so the page refreshes;
      // but offline the dialog stays, with the notice, so the focus move is not armed.
      if (!result) router.refresh();
      else if (REFRESH_ON.has(result.code)) {
        acted.current = true;
        router.refresh();
      }
      setFailure(result ? result.message : NETWORK);
    });
  }

  if (!canClose)
    return (
      <div ref={rootRef} className="mt-6">
        <Button
          type="button"
          variant="primary"
          aria-disabled="true"
          aria-describedby={reasonId}
        >
          Steng innsamlingen
        </Button>
        <p id={reasonId} className="mt-2 max-w-prose text-body-sm">
          {MESSAGES.TOO_FEW_ANSWER_SETS}
        </p>
      </div>
    );

  return (
    <div ref={rootRef} className="mt-6">
      <ConfirmDialog
        triggerLabel="Steng innsamlingen"
        triggerVariant="primary"
        title="Stenge innsamlingen?"
        beforeOpen={() => {
          setFailure(undefined);
          return true;
        }}
        busy={pending}
        confirm={
          <Button
            type="button"
            variant="primary"
            pending={pending}
            pendingLabel={"Stenger\u00a0…"}
            onClick={close}
          >
            Steng innsamlingen
          </Button>
        }
      >
        <p>
          Dette kan ikke angres. Lenkene slutter å virke, og svarene grupperes.
        </p>
        {noKey && (
          <p>
            Ingen KI-nøkkel er satt opp, så du grupperer for hånd i
            gjennomgangen.
          </p>
        )}
        {failure && (
          <Notice tone="danger" ref={noticeRef} tabIndex={-1}>
            {failure}
          </Notice>
        )}
      </ConfirmDialog>
    </div>
  );
}
