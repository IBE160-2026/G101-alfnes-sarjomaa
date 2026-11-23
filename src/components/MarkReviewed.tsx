"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { markReviewed } from "@/app/spill/[id]/actions";
import { Button } from "@/components/Button";
import { Notice } from "@/components/Notice";
import { FailureNotice } from "@/components/ReviewGroups";
import { focusHeading } from "@/components/RouteFocus";
import { callAction } from "@/components/useFormAction";
import { MESSAGES } from "@/lib/errors";

type Failure = { questionId: string; kind: "empty" | "locked" | "retry" };

// FR-21, UX-DR17, UX-DR18: the Question header's mark button, or "✓ Gjennomgått" and
// "Neste spørsmål" once marked. The page does not key this by Question, so its polite
// live region survives the navigation a mark causes (ReviewGroups' region remounts).
export function MarkReviewed({
  gameId,
  questionId,
  position,
  reviewed,
  nextHref,
  headingId,
  hasBoard,
}: {
  gameId: string;
  questionId: string;
  position: number;
  reviewed: boolean;
  nextHref?: string;
  headingId: string;
  // The Question has a Group on the Board; the refusal goes once one is back.
  hasBoard: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [failure, setFailure] = useState<Failure>();
  const [done, setDone] = useState<string>();

  // After the next Question (or the refreshed one) has committed.
  useEffect(() => {
    if (done) focusHeading(document.getElementById(headingId));
  }, [done, headingId]);

  function mark() {
    setFailure(undefined);
    // Empties the live region, so an identical sentence is announced again.
    setDone(undefined);
    startTransition(async () => {
      const result = await callAction(() =>
        markReviewed({ gameId, questionId, reviewed: true }),
      );
      startTransition(() => {
        if (result?.ok) {
          const { next } = result.data;
          if (next === null) router.refresh();
          else router.push(`/spill/${gameId}/gjennomgang?q=${next}`);
          setDone(
            `Spørsmål ${position} er gjennomgått.` +
              (next === null
                ? " Alle spørsmålene er gjennomgått."
                : ` Viser spørsmål ${next}.`),
          );
        } else if (result?.code === "NOT_FOUND") router.refresh();
        else
          setFailure({
            questionId,
            kind:
              result?.code === "NO_GROUPS_ON_BOARD"
                ? "empty"
                : result?.code === "WRONG_STATE"
                  ? "locked"
                  : "retry",
          });
      });
    });
  }

  // A failure belongs to the Question it was shown for.
  let shown = failure?.questionId === questionId ? failure.kind : undefined;
  if (shown === "empty" && hasBoard) shown = undefined;

  return (
    <div className="flex max-w-80 shrink-0 flex-col items-end gap-2">
      {reviewed ? (
        <div className="flex shrink-0 items-center gap-4">
          <span className="font-semibold text-success">
            <span aria-hidden="true">✓</span> Gjennomgått
          </span>
          {nextHref && (
            <Link
              href={nextHref}
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-line-strong bg-surface px-4 text-primary hover:bg-surface-sunken"
            >
              Neste spørsmål
            </Link>
          )}
        </div>
      ) : (
        <Button
          type="button"
          variant="primary"
          pending={pending}
          pendingLabel="Markerer …"
          onClick={mark}
        >
          Marker som gjennomgått
        </Button>
      )}
      {shown === "empty" && (
        <Notice tone="danger">{MESSAGES.NO_GROUPS_ON_BOARD}</Notice>
      )}
      {(shown === "locked" || shown === "retry") && (
        <FailureNotice failure={shown} gameId={gameId} />
      )}
      {/* A div, apart from ReviewGroups' p[aria-live]: one region per component. */}
      <div aria-live="polite" className="sr-only">
        {done}
      </div>
    </div>
  );
}
