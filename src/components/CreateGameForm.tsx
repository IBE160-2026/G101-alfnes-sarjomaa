"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { Notice } from "@/components/Notice";
import { TextField } from "@/components/TextField";
import { useFormAction } from "@/components/useFormAction";
import type { Failure } from "@/lib/errors";
import { GAME_TITLE_COUNTER_FROM, GAME_TITLE_MAX } from "@/lib/limits";

export function CreateGameForm({
  action,
}: {
  action: (prev: unknown, formData: FormData) => Promise<Failure>;
}) {
  // Controlled, so the typed title survives a failed submit and drives the counter.
  const [title, setTitle] = useState("");
  const {
    state,
    submit,
    pending,
    formRef,
    noticeRef,
    fieldErrors,
    showNotice,
  } = useFormAction(action, ["title"]);

  // Trimmed, as the server counts it.
  const length = title.trim().length;
  const count = `${length} av ${GAME_TITLE_MAX} tegn`;
  return (
    <>
      {showNotice && (
        <Notice tone="danger" ref={noticeRef} tabIndex={-1} className="mt-6">
          {state?.message}
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
          aria-required
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          error={fieldErrors.title}
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
          pendingLabel={"Lager spill\u00a0…"}
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
