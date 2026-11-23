"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import {
  mergeGroups,
  moveAnswers,
  renameGroup,
} from "@/app/spill/[id]/actions";
import { Button } from "@/components/Button";
import { GroupCard } from "@/components/GroupCard";
import { Notice } from "@/components/Notice";
import { focusHeading } from "@/components/RouteFocus";
import { TextField } from "@/components/TextField";
import { callAction } from "@/components/useFormAction";
import type { ActionResult } from "@/lib/errors";
import { groups, people } from "@/lib/format";
import { BOARD_SIZE, LABEL_MAX } from "@/lib/limits";
import type { ReviewGroup } from "@/server/review";

const RETRY = "Endringen ble ikke lagret. Prøv igjen.";

type Failure = "locked" | "retry";
// What a finished operation announces, and the element (a CSS selector) that takes focus.
type Done = { text?: string; focus: string };
type Renaming = {
  groupId: string;
  label: string;
  value: string;
  error?: string;
  failure?: Failure;
};

function FailureNotice({
  failure,
  gameId,
  className,
}: {
  failure: Failure;
  gameId: string;
  className?: string;
}) {
  return (
    <Notice tone="danger" className={className}>
      {failure === "locked" ? (
        <>
          Brettet er allerede låst.{" "}
          <Link href={`/spill/${gameId}`} className="underline">
            Gå til spillet
          </Link>
        </>
      ) : (
        RETRY
      )}
    </Notice>
  );
}

// The Board and Ikke på brettet sections with Group or Answer selection, the
// SelectionBar and the inline rename field (FR-20, UX-DR11, UX-DR12, UX-DR18).
// Forkastet comes in as children: it has no checkboxes. The page keys this by
// Question, so a Question change clears the selection.
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
  // Group selection and Answer selection are mutually exclusive (UX-DR11).
  const [selected, setSelected] = useState<string[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [target, setTarget] = useState<string>();
  const [failure, setFailure] = useState<Failure>();
  const [done, setDone] = useState<Done>();
  const [renaming, setRenaming] = useState<Renaming>();
  const [op, setOp] = useState<"merge" | "move" | "new">();
  const [pending, startTransition] = useTransition();
  const [renamePending, startRename] = useTransition();

  // After the refreshed list has committed: focus moves to the affected Group.
  useEffect(() => {
    if (!done) return;
    const el = document.querySelector(done.focus);
    if (el instanceof HTMLInputElement) el.focus();
    else focusHeading(el);
  }, [done]);

  function toggleGroup(id: string) {
    if (pending) return;
    setFailure(undefined);
    setAnswers([]);
    setSelected((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    );
  }

  function toggleChip(ids: string[]) {
    if (pending) return;
    setFailure(undefined);
    setSelected([]);
    setAnswers((current) =>
      current.includes(ids[0])
        ? current.filter((x) => !ids.includes(x))
        : [...current, ...ids],
    );
  }

  // The bar unmounts, so focus that was in it goes back to the first ticked checkbox.
  function clear() {
    if (pending) return;
    const inBar = barRef.current?.contains(document.activeElement);
    const first = selected[0]
      ? `velg-${selected[0]}`
      : answers[0] && `velg-svar-${answers[0]}`;
    setSelected([]);
    setAnswers([]);
    setFailure(undefined);
    if (inBar && first) document.getElementById(first)?.focus();
  }

  const onKey = useEffectEvent((event: KeyboardEvent) => {
    if (event.key === "Escape") clear();
  });
  const hasSelection = selected.length > 0 || answers.length > 0;
  useEffect(() => {
    if (!hasSelection) return;
    const listener = (event: KeyboardEvent) => onKey(event);
    document.addEventListener("keydown", listener);
    return () => document.removeEventListener("keydown", listener);
  }, [hasSelection]);

  // A stale view (the Groups changed elsewhere): show the saved state.
  function stale() {
    setSelected([]);
    setAnswers([]);
    setRenaming(undefined);
    focusHeading(document.getElementById("pa-brettet"));
    router.refresh();
  }

  // Pessimistic: waits for the server; the success state commits with the refreshed list.
  function run<T>(
    kind: "merge" | "move" | "new",
    request: () => Promise<ActionResult<T>>,
    onSuccess: (data: T) => void,
  ) {
    if (pending) return;
    setOp(kind);
    setFailure(undefined);
    // An open rename field is cancelled: its Group may be gone after the edit.
    setRenaming(undefined);
    // Empties the live region, so an identical sentence is announced again.
    setDone(undefined);
    startTransition(async () => {
      const result = await callAction(request);
      startTransition(() => {
        if (result?.ok) {
          setSelected([]);
          setAnswers([]);
          onSuccess(result.data);
        } else if (result?.code === "NOT_FOUND") stale();
        else setFailure(result?.code === "WRONG_STATE" ? "locked" : "retry");
      });
    });
  }

  const merge = () =>
    run(
      "merge",
      () => mergeGroups({ gameId, groupIds: selected }),
      (m) =>
        setDone({
          text: `Slått sammen til «${m.label}», nå ${people(m.count)}, plass ${m.position}.`,
          focus: `#gruppe-${m.groupId}`,
        }),
    );

  const move = (groupId?: string) =>
    run(
      groupId ? "move" : "new",
      () => moveAnswers({ gameId, answerIds: answers, groupId }),
      (m) => {
        if (!m.created)
          return setDone({
            text: `${m.moved} svar flyttet til «${m.label}».`,
            focus: `#gruppe-${m.groupId}`,
          });
        setRenaming({ groupId: m.groupId, label: m.label, value: m.label });
        setDone({
          text: `Ny gruppe «${m.label}» laget. Skriv et nytt navn eller trykk Enter.`,
          focus: "[data-rename-field]",
        });
      },
    );

  function closeRename(text?: string) {
    if (!renaming) return;
    setRenaming(undefined);
    setDone({ text, focus: `#gruppe-${renaming.groupId}` });
  }

  function onRenameKey(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (!renaming) return;
    if (event.key === "Escape") {
      // Never reaches the selection's Esc listener on document.
      event.preventDefault();
      event.stopPropagation();
      // While saving, the field stays so a failure can still show in it.
      if (!renamePending) closeRename();
      return;
    }
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (renamePending) return;
    const label = renaming.value.trim();
    if (label === renaming.label) return closeRename();
    setRenaming({ ...renaming, error: undefined, failure: undefined });
    setDone(undefined);
    startRename(async () => {
      const result = await callAction(() =>
        renameGroup({ gameId, groupId: renaming.groupId, label }),
      );
      startRename(() => {
        if (result?.ok) closeRename("Navnet er endret.");
        else if (result?.code === "NOT_FOUND") stale();
        else if (result?.code === "INVALID_INPUT" && result.fieldErrors?.label)
          setRenaming((r) => r && { ...r, error: result.fieldErrors!.label });
        else
          setRenaming(
            (r) =>
              r && {
                ...r,
                failure: result?.code === "WRONG_STATE" ? "locked" : "retry",
              },
          );
      });
    });
  }

  const card = (g: ReviewGroup, rank: number, look: "board" | "below") => {
    const ownsSelected = g.chips.some((c) => answers.includes(c.ids[0]));
    const editing = renaming?.groupId === g.id ? renaming : undefined;
    return (
      <GroupCard
        key={g.id}
        rank={rank}
        look={look}
        {...g}
        selected={selected.includes(g.id)}
        busy={pending && (selected.includes(g.id) || ownsSelected)}
        onToggle={() => toggleGroup(g.id)}
        chipSelected={(c) => answers.includes(c.ids[0])}
        onToggleChip={(c) => toggleChip(c.ids)}
        notice={
          editing?.failure && (
            <FailureNotice
              failure={editing.failure}
              gameId={gameId}
              className="mb-3"
            />
          )
        }
        rename={
          editing && (
            <TextField
              name="label"
              label="Navn på gruppen"
              data-rename-field=""
              value={editing.value}
              maxLength={LABEL_MAX}
              autoComplete="off"
              error={editing.error}
              counter={`${editing.value.length}/${LABEL_MAX}`}
              onChange={(e) =>
                setRenaming({ ...editing, value: e.target.value })
              }
              // Selected, so typing replaces the default label.
              onFocus={(e) => e.currentTarget.select()}
              onKeyDown={onRenameKey}
              className="min-w-0 flex-1"
            />
          )
        }
      />
    );
  };

  const n = selected.length;
  // Board then below: the ranked order, which sorts by Count. A Group that already
  // holds every ticked Answer is left out, so a move always moves something.
  const options = [...board, ...below].filter(
    (g) => !answers.every((id) => g.chips.some((c) => c.ids.includes(id))),
  );
  // The chosen Group, or the first while it is unset or gone after a refresh.
  const targetId = options.some((g) => g.id === target)
    ? target!
    : options[0]?.id;

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

      {hasSelection && (
        <div
          ref={barRef}
          data-selection-bar=""
          className="sticky bottom-4 z-10 mt-8 rounded-lg bg-ink p-4 text-surface shadow-lg [&_:focus-visible]:outline-focus-inverse"
        >
          {failure && (
            <FailureNotice failure={failure} gameId={gameId} className="mb-4" />
          )}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <p className="text-title">
              {n > 0 ? groups(n) : `${answers.length} svar`} valgt
            </p>
            <div className="ml-auto flex flex-wrap items-center gap-3">
              {n === 1 && <p>Velg minst to grupper for å slå sammen.</p>}
              {n > 1 && (
                <Button
                  type="button"
                  variant="inverse"
                  pending={pending}
                  pendingLabel="Slår sammen …"
                  onClick={merge}
                >
                  Slå sammen {n} grupper
                </Button>
              )}
              {n === 0 && (
                <>
                  {targetId && (
                    <>
                      <label htmlFor="flytt-til">Flytt til gruppe</label>
                      <select
                        id="flytt-til"
                        value={targetId}
                        onChange={(e) => setTarget(e.target.value)}
                        className="min-h-11 max-w-64 rounded-md bg-surface px-3 text-ink"
                      >
                        {options.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.label} ({g.count})
                          </option>
                        ))}
                      </select>
                      <Button
                        type="button"
                        variant="inverse"
                        pending={pending && op === "move"}
                        pendingLabel="Flytter …"
                        onClick={() => move(targetId)}
                      >
                        Flytt
                      </Button>
                    </>
                  )}
                  <Button
                    type="button"
                    variant="inverse"
                    pending={pending && op === "new"}
                    pendingLabel="Lager gruppe …"
                    onClick={() => move()}
                  >
                    Ny gruppe
                  </Button>
                </>
              )}
              <Button type="button" variant="inverse" onClick={clear}>
                Fjern valg
              </Button>
            </div>
          </div>
        </div>
      )}

      <p aria-live="polite" className="sr-only">
        {done?.text}
      </p>
    </>
  );
}
