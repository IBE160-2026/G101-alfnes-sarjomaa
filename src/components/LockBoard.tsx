"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { confirmBoard } from "@/app/spill/[id]/actions";
import { Button } from "@/components/Button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { FailureNotice } from "@/components/ReviewGroups";
import { callAction } from "@/components/useFormAction";

// FR-21, UX-DR8, UX-DR17: aria-disabled with its reason while a Question is unreviewed,
// then a ConfirmDialog. The server checks again under the lock.
export function LockBoard({
  id,
  gameId,
  remaining,
}: {
  // The reason's id; the page renders this twice (rail and narrow-screen foot).
  id: string;
  gameId: string;
  remaining: number;
}) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [failure, setFailure] = useState<"locked" | "retry">();
  const [pending, startTransition] = useTransition();
  const ready = remaining === 0;
  // Set only by this instance's own refused confirm, so an edit or mark elsewhere that
  // changes `ready` never pulls focus here.
  const refused = useRef(false);

  // The refresh after the refusal swaps the dialog for the disabled button (a second
  // tab un-reviewed a Question), and focus in the removed dialog falls to <body>.
  useEffect(() => {
    if (ready || !refused.current) return;
    refused.current = false;
    if (document.activeElement === document.body)
      rootRef.current?.querySelector("button")?.focus();
  }, [ready]);

  function lock() {
    setFailure(undefined);
    startTransition(async () => {
      const result = await callAction(() => confirmBoard({ gameId }));
      startTransition(() => {
        // RouteFocus moves focus to the Game page's <h1>.
        if (result?.ok) router.push(`/spill/${gameId}`);
        else if (
          result?.code === "QUESTIONS_UNREVIEWED" ||
          result?.code === "NOT_FOUND"
        ) {
          refused.current = result.code === "QUESTIONS_UNREVIEWED";
          router.refresh();
        } else setFailure(result?.code === "WRONG_STATE" ? "locked" : "retry");
      });
    });
  }

  if (!ready)
    return (
      <div ref={rootRef}>
        <Button
          type="button"
          variant="primary"
          aria-disabled="true"
          aria-describedby={id}
          className="w-full"
        >
          Lås brettet
        </Button>
        <p id={id} className="mt-2 text-body-sm">
          Gjennomgå alle spørsmålene først ({remaining} igjen).
        </p>
      </div>
    );

  return (
    // The trigger fills the rail, as the disabled button does.
    <div ref={rootRef} className="[&>button]:w-full">
      <ConfirmDialog
        triggerLabel="Lås brettet"
        triggerVariant="primary"
        title="Låse brettet?"
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
            pendingLabel={"Låser\u00a0…"}
            onClick={lock}
          >
            Lås brettet
          </Button>
        }
      >
        <p>
          Dette kan ikke angres. Brettet låses slik det er nå, og gjennomgangen
          kan ikke endres mer.
        </p>
        {failure && <FailureNotice failure={failure} gameId={gameId} />}
      </ConfirmDialog>
    </div>
  );
}
