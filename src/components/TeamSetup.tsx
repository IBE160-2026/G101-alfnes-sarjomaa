"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import { startPlay } from "@/app/spill/[id]/actions";
import { Button } from "@/components/Button";
import { Notice } from "@/components/Notice";
import { focusPageHeading } from "@/components/RouteFocus";
import { TextField } from "@/components/TextField";
import { callAction, NETWORK } from "@/components/useFormAction";
import { TEAMS_MAX, TEAMS_MIN } from "@/lib/limits";
import { teamNameSchema } from "@/lib/play";

// key: stable across removals, so a field keeps its input and focus when a row above goes.
type Row = { key: number; name: string; error?: string };
type Failure = { started: true } | { message: string };

// FR-23, UX-DR22: two to four named Teams, then play starts on the server.
export function TeamSetup({ gameId }: { gameId: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const noticeRef = useRef<HTMLDivElement>(null);
  const nextKey = useRef(TEAMS_MIN);
  // The field (by key) or the add button to focus once the render it waits for is done.
  const focusAfter = useRef<number | "add" | null>(null);
  const [rows, setRows] = useState<Row[]>([
    { key: 0, name: "Lag 1" },
    { key: 1, name: "Lag 2" },
  ]);
  const [failure, setFailure] = useState<Failure>();
  const [pending, startTransition] = useTransition();
  // On success the refreshed page swaps this form for the play view, so focus goes to
  // its <h1> when this unmounts, once the stage has streamed in past "Henter spillet …".
  const acted = useRef(false);

  useEffect(() => {
    const target = focusAfter.current;
    if (target === null) return;
    focusAfter.current = null;
    if (target === "add") addRef.current?.focus();
    else
      formRef.current
        ?.querySelector<HTMLInputElement>(`[data-key="${target}"]`)
        ?.focus();
  }, [rows]);

  useEffect(() => {
    if (failure) noticeRef.current?.focus();
  }, [failure]);

  useEffect(
    () => () => {
      if (acted.current) focusPageHeading();
    },
    [],
  );

  function add() {
    const key = nextKey.current++;
    focusAfter.current = key;
    // From the key, not the row count, so a default name never repeats after a removal.
    setRows((rs) => [...rs, { key, name: `Lag ${key + 1}` }]);
  }

  function remove(key: number) {
    focusAfter.current = "add";
    setRows((rs) => rs.filter((r) => r.key !== key));
  }

  function edit(key: number, name: string) {
    setRows((rs) =>
      rs.map((r) => (r.key === key ? { key, name, error: undefined } : r)),
    );
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    const checked = rows.map((r) => {
      const result = teamNameSchema.safeParse(r.name);
      return { ...r, error: result.error?.issues[0].message };
    });
    const firstInvalid = checked.find((r) => r.error);
    setRows(checked);
    if (firstInvalid) {
      focusAfter.current = firstInvalid.key;
      return;
    }
    setFailure(undefined);
    startTransition(async () => {
      const result = await callAction(() =>
        startPlay({ gameId, teams: rows.map((r) => r.name) }),
      );
      if (result?.ok) {
        acted.current = true;
        return;
      }
      if (result?.code === "NOT_FOUND") return router.refresh();
      // A rejected call may still have started play, so the page refreshes too, and
      // focus follows if that swaps in the play view.
      if (!result) {
        acted.current = true;
        router.refresh();
      }
      setFailure(
        result?.code === "WRONG_STATE"
          ? { started: true }
          : // No field is marked for a server INVALID_INPUT, so its reason shows here.
            {
              message: result
                ? (result.fieldErrors?.teams ?? result.message)
                : NETWORK,
            },
      );
    });
  }

  return (
    <>
      <h1 className="text-display">Hvem spiller?</h1>
      <form ref={formRef} noValidate onSubmit={submit} className="mt-6">
        <ol className="flex max-w-md flex-col gap-4">
          {rows.map((row, i) => (
            <li key={row.key} className="flex items-start gap-3">
              <TextField
                name={`lag-${i + 1}`}
                data-key={row.key}
                label={`Navn på lag ${i + 1}`}
                value={row.name}
                error={row.error}
                autoComplete="off"
                onChange={(e) => edit(row.key, e.target.value)}
                className="min-w-0 flex-1"
              />
              {rows.length > TEAMS_MIN && (
                // Aligned with the input: the label above it is 20 px (text-label).
                <Button
                  type="button"
                  variant="secondary"
                  className="mt-6 min-h-12"
                  onClick={() => remove(row.key)}
                >
                  Fjern<span className="sr-only"> lag {i + 1}</span>
                </Button>
              )}
            </li>
          ))}
        </ol>
        {rows.length < TEAMS_MAX && (
          <Button
            ref={addRef}
            type="button"
            variant="secondary"
            className="mt-4"
            onClick={add}
          >
            Legg til lag
          </Button>
        )}
        {failure && (
          <Notice
            tone="danger"
            ref={noticeRef}
            tabIndex={-1}
            className="mt-6 max-w-md"
          >
            {"started" in failure ? (
              <>
                Spillet har allerede startet.{" "}
                <Link href={`/spill/${gameId}`} className="underline">
                  Gå til spillet
                </Link>
              </>
            ) : (
              failure.message
            )}
          </Notice>
        )}
        <div className="mt-8">
          <Button
            type="submit"
            variant="primary"
            pending={pending}
            pendingLabel={"Starter …"}
          >
            Start spillet
          </Button>
        </div>
      </form>
    </>
  );
}
