"use client";

import { useId, useState } from "react";
import { Button } from "@/components/Button";
import { Notice } from "@/components/Notice";
import { TextField } from "@/components/TextField";
import { useFormAction } from "@/components/useFormAction";
import type { Failure } from "@/lib/errors";
import { GAME_TITLE_COUNTER_FROM, GAME_TITLE_MAX } from "@/lib/limits";

export function CreateGameForm({
  action,
  questionSets,
}: {
  action: (prev: unknown, formData: FormData) => Promise<Failure>;
  // FR-33: only id and name, so the sets' JSON stays on the server.
  questionSets: { id: string; name: string }[];
}) {
  // Controlled, so the typed title and the chosen set survive a failed submit.
  const [title, setTitle] = useState("");
  const [questionSet, setQuestionSet] = useState("");
  const setId = useId();
  const {
    state,
    submit,
    pending,
    formRef,
    noticeRef,
    fieldErrors,
    showNotice,
  } = useFormAction(action, ["title", "questionSet"]);

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
        {/* The house TextField look; empty value is the FR-2 path, a set the FR-33 one. */}
        <div className="sm:w-56">
          <label htmlFor={setId} className="block text-label">
            Spørsmål
          </label>
          <select
            id={setId}
            name="questionSet"
            value={questionSet}
            onChange={(event) => setQuestionSet(event.target.value)}
            aria-invalid={fieldErrors.questionSet ? true : undefined}
            aria-describedby={
              fieldErrors.questionSet ? `${setId}-error` : undefined
            }
            className={`mt-1 block min-h-12 w-full rounded-sm bg-surface text-body text-ink ${
              fieldErrors.questionSet
                ? "border-2 border-danger px-2.75"
                : "border border-line-strong px-3"
            }`}
          >
            <option value="">Jeg skriver egne</option>
            <optgroup label="Ferdige sett">
              {questionSets.map((set) => (
                <option key={set.id} value={set.id}>
                  {set.name}
                </option>
              ))}
            </optgroup>
          </select>
          {fieldErrors.questionSet && (
            <p id={`${setId}-error`} className="mt-1 text-body-sm text-danger">
              <span className="sr-only">Feil: </span>
              {fieldErrors.questionSet}
            </p>
          )}
        </div>
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
