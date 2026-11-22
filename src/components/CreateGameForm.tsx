"use client";

import { unstable_rethrow } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/Button";
import { Notice } from "@/components/Notice";
import { TextField } from "@/components/TextField";
import type { FieldErrors, Failure } from "@/lib/errors";
import { GAME_TITLE_COUNTER_FROM, GAME_TITLE_MAX } from "@/lib/limits";

type State = { message: string; fieldErrors?: FieldErrors } | null;

const NETWORK = "Fikk ikke kontakt. Sjekk nettet og prøv igjen.";

export function CreateGameForm({
  action,
}: {
  action: (prev: unknown, formData: FormData) => Promise<Failure>;
}) {
  // Controlled, so the typed title survives a failed submit and drives the counter.
  const [title, setTitle] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const noticeRef = useRef<HTMLDivElement>(null);

  // Success redirects, which rejects here with Next's redirect error: let it through.
  const [state, submit, pending] = useActionState(
    async (prev: State, formData: FormData): Promise<State> => {
      try {
        return await action(prev, formData);
      } catch (error) {
        unstable_rethrow(error);
        return { message: NETWORK };
      }
    },
    null,
  );

  useEffect(() => {
    if (!state) return;
    const invalid = formRef.current?.querySelector<HTMLElement>(
      '[aria-invalid="true"]',
    );
    (invalid ?? noticeRef.current)?.focus();
  }, [state]);

  const errors = state?.fieldErrors;
  // Trimmed, as the server counts it.
  const length = title.trim().length;
  const count = `${length} av ${GAME_TITLE_MAX} tegn`;
  return (
    <>
      {state && !errors && (
        <Notice tone="danger" ref={noticeRef} tabIndex={-1} className="mt-6">
          {state.message}
        </Notice>
      )}
      <form
        ref={formRef}
        action={submit}
        noValidate
        className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-start"
      >
        <TextField
          name="title"
          label="Navn på spillet"
          autoComplete="off"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          error={errors?.title}
          counter={
            length >= GAME_TITLE_COUNTER_FROM && (
              <span aria-hidden="true">{count}</span>
            )
          }
          className="sm:flex-1"
        />
        {/* sm:mt-6 lines the button up with the input under its label. */}
        <Button
          type="submit"
          variant="primary"
          pending={pending}
          pendingLabel="Lager spill …"
          className="self-start sm:mt-6 sm:min-h-12"
        >
          Lag spill
        </Button>
        <p aria-live="polite" className="sr-only">
          {length >= GAME_TITLE_MAX ? count : ""}
        </p>
      </form>
    </>
  );
}
