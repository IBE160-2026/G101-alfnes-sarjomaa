"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { mergeGroups } from "@/app/spill/[id]/actions";
import { Button } from "@/components/Button";
import { GroupCard } from "@/components/GroupCard";
import { Notice } from "@/components/Notice";
import { focusHeading } from "@/components/RouteFocus";
import { callAction } from "@/components/useFormAction";
import { BOARD_SIZE } from "@/lib/limits";
import type { MergeResult, ReviewGroup } from "@/server/review";

const groups = (n: number) => (n === 1 ? "1 gruppe" : `${n} grupper`);
const people = (n: number) => (n === 1 ? "1 person" : `${n} personer`);

// The Board and Ikke på brettet sections with Group selection and the SelectionBar
// (FR-20, UX-DR12, UX-DR18). Forkastet comes in as children: it has no checkboxes.
// The page keys this by Question, so a Question change clears the selection.
export function ReviewGroups({
  gameId,
  board,
  below,
  children,
}: {
  gameId: string;
  board: ReviewGroup[];
  below: ReviewGroup[];
  children?: ReactNode;
}) {
  const router = useRouter();
  const barRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [failure, setFailure] = useState<"locked" | "retry">();
  const [merged, setMerged] = useState<MergeResult>();
  const [pending, startTransition] = useTransition();

  // After the refreshed list has committed: the merged Group's heading takes focus.
  useEffect(() => {
    if (merged)
      focusHeading(document.getElementById(`gruppe-${merged.groupId}`));
  }, [merged]);

  function toggle(id: string) {
    if (pending) return;
    setFailure(undefined);
    setSelected((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    );
  }

  // The bar unmounts, so focus that was in it goes back to the first ticked checkbox.
  function clear() {
    if (pending) return;
    const inBar = barRef.current?.contains(document.activeElement);
    const first = selected[0];
    setSelected([]);
    setFailure(undefined);
    if (inBar && first)
      document
        .getElementById(`gruppe-${first}`)
        ?.parentElement?.querySelector("input")
        ?.focus();
  }

  const onKey = useEffectEvent((event: KeyboardEvent) => {
    if (event.key === "Escape") clear();
  });
  const hasSelection = selected.length > 0;
  useEffect(() => {
    if (!hasSelection) return;
    const listener = (event: KeyboardEvent) => onKey(event);
    document.addEventListener("keydown", listener);
    return () => document.removeEventListener("keydown", listener);
  }, [hasSelection]);

  function merge() {
    setFailure(undefined);
    startTransition(async () => {
      const result = await callAction(() =>
        mergeGroups({ gameId, groupIds: selected }),
      );
      // Inside a transition, so the state commits with the refreshed list.
      startTransition(() => {
        if (result?.ok) {
          setSelected([]);
          setMerged(result.data);
        } else if (result?.code === "NOT_FOUND") {
          // A stale view: the Groups changed elsewhere.
          setSelected([]);
          focusHeading(document.getElementById("pa-brettet"));
          router.refresh();
        } else setFailure(result?.code === "WRONG_STATE" ? "locked" : "retry");
      });
    });
  }

  const card = (g: ReviewGroup, rank: number, look: "board" | "below") => (
    <GroupCard
      key={g.id}
      rank={rank}
      look={look}
      {...g}
      selected={selected.includes(g.id)}
      busy={pending && selected.includes(g.id)}
      onToggle={() => toggle(g.id)}
    />
  );
  const n = selected.length;

  return (
    <>
      {board.length > 0 && (
        <section aria-labelledby="pa-brettet" className="mt-8">
          <h3 id="pa-brettet" className="text-title">
            På brettet ({groups(board.length)})
          </h3>
          <ol className="mt-3 flex flex-col gap-2">
            {board.map((g, i) => card(g, i + 1, "board"))}
          </ol>
        </section>
      )}

      {below.length > 0 && (
        <>
          <p className="mt-8 border-t-2 border-line-strong pt-2 text-label">
            Alt under streken vises ikke i spillet
          </p>
          <section aria-labelledby="ikke-pa-brettet" className="mt-6">
            <h3 id="ikke-pa-brettet" className="text-title">
              Ikke på brettet ({groups(below.length)})
            </h3>
            <p className="mt-1 max-w-prose">
              Vises ikke i spillet. Slå dem sammen med en gruppe over for at de
              skal telle.
            </p>
            <ol className="mt-3 flex flex-col gap-2">
              {below.map((g, i) => card(g, BOARD_SIZE + i + 1, "below"))}
            </ol>
          </section>
        </>
      )}

      {children}

      {n > 0 && (
        <div
          ref={barRef}
          data-selection-bar=""
          className="sticky bottom-4 z-10 mt-8 rounded-lg bg-ink p-4 text-surface shadow-lg [&_:focus-visible]:outline-focus-inverse"
        >
          {failure && (
            <Notice tone="danger" className="mb-4">
              {failure === "locked" ? (
                <>
                  Brettet er allerede låst.{" "}
                  <Link href={`/spill/${gameId}`} className="underline">
                    Gå til spillet
                  </Link>
                </>
              ) : (
                "Endringen ble ikke lagret. Prøv igjen."
              )}
            </Notice>
          )}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <p className="text-title">
              {n === 1 ? "1 gruppe valgt" : `${n} grupper valgt`}
            </p>
            <div className="ml-auto flex flex-wrap items-center gap-3">
              {n === 1 ? (
                <p>Velg minst to grupper for å slå sammen.</p>
              ) : (
                <Button
                  type="button"
                  variant="inverse"
                  pending={pending}
                  pendingLabel={"Slår sammen …"}
                  onClick={merge}
                >
                  Slå sammen {n} grupper
                </Button>
              )}
              <Button type="button" variant="inverse" onClick={clear}>
                Fjern valg
              </Button>
            </div>
          </div>
        </div>
      )}

      <p aria-live="polite" className="sr-only">
        {merged &&
          `Slått sammen til «${merged.label}», nå ${people(merged.count)}, plass ${merged.position}.`}
      </p>
    </>
  );
}
