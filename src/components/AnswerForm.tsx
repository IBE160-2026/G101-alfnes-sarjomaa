"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { submitAnswerSet } from "@/app/svar/[gameId]/actions";
import { Button } from "@/components/Button";
import { Notice } from "@/components/Notice";
import { focusHeading } from "@/components/RouteFocus";
import { TextField } from "@/components/TextField";
import { callAction } from "@/components/useFormAction";
import { ANSWER_MISSING, parseAnswerSet, toFields } from "@/lib/answer-set";
import { DomainError, MESSAGES, type FieldErrors } from "@/lib/errors";
import {
  clearLinkStore,
  newEditSecret,
  readLinkStore,
  TOKEN_PATTERN,
  writeLinkStore,
} from "@/lib/invite-link";
import {
  ANSWER_COUNTER_FROM,
  ANSWER_FIELDS_DEFAULT,
  ANSWER_TEXT_MAX,
  ANSWERS_PER_QUESTION_MAX,
} from "@/lib/limits";

type Question = { id: string; text: string };
type Phase = "form" | "saved" | "closed";
type Fields = Record<string, string[]>;

export const NETWORK_SUBMIT =
  "Fikk ikke sendt svarene. Sjekk nettet og prøv igjen. Utkastet ditt ligger fortsatt på denne enheten.";
const NOTICE =
  "Ingen kan se hvem som skrev hvilket svar, heller ikke verten. Verten leser likevel alle svarene slik de er skrevet.";
const CLOSED =
  "Innsamlingen ble stengt før svarene dine kom fram, så de ble ikke lagret.";
const RETURNING =
  "Du har allerede sendt inn. Endringer lagres først når du trykker «Lagre endringer».";
const DRAFT_SAVE_MS = 500;

// Field names are `${qid}.${i}`, the same keys parseAnswerSet reports field errors under.
const fieldName = (qid: string, i: number) => `${qid}.${i}`;

// Compares the trimmed non-empty values per Question: a blank extra field is not a change.
function differs(a: Fields, b: Fields, questionIds: readonly string[]) {
  const given = (f: Fields) =>
    JSON.stringify(
      questionIds.map((qid) => f[qid].map((v) => v.trim()).filter((v) => v)),
    );
  return given(a) !== given(b);
}

// The draft stays on this device (AD-8, FR-6). A form that holds nothing new stores none.
function saveDraft(
  gameId: string,
  token: string,
  fields: Fields,
  savedFields: Fields,
  questionIds: readonly string[],
) {
  const stored = readLinkStore(gameId, token);
  if (differs(fields, savedFields, questionIds))
    writeLinkStore(gameId, { ...stored, token, draft: fields });
  // JSON.stringify leaves out an undefined draft.
  else if (stored) writeLinkStore(gameId, { ...stored, draft: undefined });
}

export function AnswerForm({
  gameId,
  token,
  questions,
  saved,
  onUnknown,
}: {
  gameId: string;
  token: string;
  questions: Question[];
  saved?: Fields;
  onUnknown: () => void;
}) {
  const questionIds = useMemo(() => questions.map((q) => q.id), [questions]);
  // A local draft wins over the saved set on load (AD-8), unless it holds nothing new.
  const [start] = useState(() => {
    const savedFields = toFields(saved, questionIds);
    const draft = readLinkStore(gameId, token)?.draft;
    const drafted = draft == null ? null : toFields(draft, questionIds);
    const restored =
      drafted !== null && differs(drafted, savedFields, questionIds);
    return { savedFields, fields: restored ? drafted : savedFields, restored };
  });
  const [savedFields, setSavedFields] = useState(start.savedFields);
  const [fields, setFields] = useState<Fields>(start.fields);
  const [draftRestored, setDraftRestored] = useState(start.restored);
  const [errors, setErrors] = useState<FieldErrors | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("form");
  const [pending, setPending] = useState(false);
  const [submitted, setSubmitted] = useState(saved !== undefined);
  const [announcement, setAnnouncement] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const closedRef = useRef<HTMLDivElement>(null);
  const savedRef = useRef<HTMLHeadingElement>(null);
  const focusField = useRef<string | null>(null);
  const draftTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Added and removed fields exist only after the render, so focus moves here.
  useEffect(() => {
    if (focusField.current === null) return;
    formRef.current
      ?.querySelector<HTMLInputElement>(`[name="${focusField.current}"]`)
      ?.focus();
    focusField.current = null;
  }, [fields]);

  useEffect(() => {
    if (errors) summaryRef.current?.focus();
  }, [errors]);

  // Saved about 500 ms after typing stops, only to this device's storage.
  useEffect(() => {
    if (phase !== "form") return;
    draftTimer.current = setTimeout(
      () => saveDraft(gameId, token, fields, savedFields, questionIds),
      DRAFT_SAVE_MS,
    );
    return () => clearTimeout(draftTimer.current);
  }, [fields, phase, gameId, token, savedFields, questionIds]);

  useEffect(() => {
    if (phase === "closed") closedRef.current?.focus();
    if (phase === "saved") savedRef.current?.focus();
  }, [phase]);

  function setField(qid: string, i: number, value: string) {
    setFields((all) => ({
      ...all,
      [qid]: all[qid].map((v, j) => (j === i ? value : v)),
    }));
    setAnnouncement(
      value.length >= ANSWER_TEXT_MAX
        ? `${ANSWER_TEXT_MAX} av ${ANSWER_TEXT_MAX} tegn`
        : "",
    );
  }

  function discardDraft() {
    focusField.current = fieldName(questionIds[0], 0);
    setFields(savedFields);
    setDraftRestored(false);
    const stored = readLinkStore(gameId, token);
    if (stored) writeLinkStore(gameId, { ...stored, draft: undefined });
  }

  function addField(qid: string) {
    focusField.current = fieldName(qid, fields[qid].length);
    setFields((all) => ({ ...all, [qid]: [...all[qid], ""] }));
  }

  function removeField(qid: string, i: number) {
    focusField.current = fieldName(qid, i - 1);
    setFields((all) => ({
      ...all,
      [qid]: all[qid].filter((_, j) => j !== i),
    }));
  }

  // preventDefault: a changed fragment would make InviteLinkView reload with it as the Token.
  function jumpTo(event: MouseEvent<HTMLAnchorElement>, n: number) {
    event.preventDefault();
    const fieldset = document.getElementById(`sporsmal-${n}`);
    fieldset?.scrollIntoView({ block: "start" });
    fieldset
      ?.querySelector<HTMLInputElement>("input")
      ?.focus({ preventScroll: true });
  }

  // enterKeyHint="next": Enter moves to the next answer field, from the last one to
  // the submit button, and never submits from a field.
  function nextOnEnter(event: KeyboardEvent<HTMLFormElement>) {
    const input = event.target;
    if (
      event.key !== "Enter" ||
      event.nativeEvent.isComposing ||
      !(input instanceof HTMLInputElement)
    )
      return;
    event.preventDefault();
    const form = event.currentTarget;
    const inputs = [...form.querySelectorAll("input")];
    (
      inputs[inputs.indexOf(input) + 1] ??
      form.querySelector<HTMLButtonElement>('button[type="submit"]')
    )?.focus();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setFailure(null);
    // At once, so a refused or lost submit still leaves the draft (NETWORK_SUBMIT says so).
    clearTimeout(draftTimer.current);
    saveDraft(gameId, token, fields, savedFields, questionIds);
    try {
      parseAnswerSet(fields, questionIds);
    } catch (error) {
      if (!(error instanceof DomainError)) throw error;
      setErrors({ ...error.fieldErrors });
      return;
    }
    setErrors(null);

    // Kept before the call, so a response lost after commit still leaves the matching secret.
    const stored = readLinkStore(gameId, token);
    const editSecret =
      typeof stored?.editSecret === "string" &&
      TOKEN_PATTERN.test(stored.editSecret)
        ? stored.editSecret
        : newEditSecret();
    writeLinkStore(gameId, { ...stored, token, editSecret });

    setPending(true);
    const result = await callAction(() =>
      submitAnswerSet(gameId, token, { answers: fields, editSecret }),
    );
    setPending(false);
    if (!result) return setFailure(NETWORK_SUBMIT);

    if (result.ok) {
      clearTimeout(draftTimer.current);
      writeLinkStore(gameId, { token, editSecret });
      setSavedFields(fields);
      setDraftRestored(false);
      setSubmitted(true);
      setPhase("saved");
    } else if (result.code === "INVALID_INPUT" && result.fieldErrors) {
      setErrors({ ...result.fieldErrors });
    } else if (result.code === "COLLECTION_CLOSED") {
      clearTimeout(draftTimer.current);
      clearLinkStore(gameId, token);
      setPhase("closed");
    } else if (result.code === "LINK_UNKNOWN") {
      onUnknown();
    } else {
      setFailure(result.message);
    }
  }

  if (phase === "closed")
    return (
      <Notice tone="danger" ref={closedRef} tabIndex={-1} className="mt-6">
        {CLOSED}
      </Notice>
    );

  if (phase === "saved")
    return (
      <>
        <h2
          ref={savedRef}
          tabIndex={-1}
          className="mt-6 text-heading text-balance"
        >
          Svarene dine er lagret.
        </h2>
        <p className="mt-2">
          Du kan endre dem på denne enheten og i denne nettleseren helt til
          verten stenger innsamlingen.
        </p>
        <Button
          type="button"
          variant="secondary"
          className="mt-6"
          onClick={() => {
            setPhase("form");
            focusHeading();
          }}
        >
          Se eller endre svarene
        </Button>
      </>
    );

  const missing = questionIds.filter(
    (qid) => errors?.[qid] === ANSWER_MISSING,
  ).length;
  const hasError = (qid: string) =>
    !!errors &&
    Object.keys(errors).some((k) => k === qid || k.startsWith(`${qid}.`));
  // Edited back to the saved set, a restored draft is gone (saveDraft drops it).
  const showDraftNotice =
    draftRestored && differs(fields, savedFields, questionIds);
  const answered = questionIds.filter((qid) =>
    fields[qid].some((v) => v.trim() !== ""),
  ).length;

  return (
    <>
      {errors && (
        <Notice tone="danger" ref={summaryRef} tabIndex={-1} className="mt-6">
          <p className="font-semibold">
            {missing > 0
              ? `${missing} spørsmål mangler svar`
              : MESSAGES.INVALID_INPUT}
          </p>
          <ul className="mt-1">
            {questions.map(
              (q, i) =>
                hasError(q.id) && (
                  <li key={q.id}>
                    <a
                      href={`#sporsmal-${i + 1}`}
                      onClick={(event) => jumpTo(event, i + 1)}
                      className="inline-flex min-h-11 items-center underline underline-offset-2"
                    >
                      Spørsmål {i + 1}: {q.text}
                    </a>
                  </li>
                ),
            )}
          </ul>
        </Notice>
      )}
      {showDraftNotice ? (
        <Notice tone="info" className="mt-6">
          <p>Du har endringer som ikke er sendt inn.</p>
          <Button
            type="button"
            variant="ghost"
            onClick={discardDraft}
            className="mt-2 -ml-2 px-2 text-primary underline underline-offset-2"
          >
            Forkast endringene
          </Button>
        </Notice>
      ) : (
        submitted && (
          <Notice tone="info" className="mt-6">
            {RETURNING}
          </Notice>
        )
      )}
      <Notice
        tone="info"
        className={showDraftNotice || submitted ? "mt-4" : "mt-6"}
      >
        {NOTICE}
      </Notice>
      <p className="mt-4">
        Gi 1–5 svar per spørsmål. Skriv det første du kommer på i Svar 1.
      </p>

      <form
        ref={formRef}
        noValidate
        onSubmit={submit}
        onKeyDown={nextOnEnter}
        className="mt-6"
      >
        <div className="space-y-4">
          {questions.map((q, n) => {
            const questionError = errors?.[q.id];
            const errorId = `sporsmal-${n + 1}-feil`;
            return (
              <fieldset
                key={q.id}
                id={`sporsmal-${n + 1}`}
                className={`min-w-0 rounded-md bg-surface ${
                  questionError
                    ? "border-2 border-danger p-3.75"
                    : "border border-line p-4"
                }`}
              >
                <legend className="float-left w-full">
                  <span className="block text-label text-ink-muted">
                    {/* A visible colon: an sr-only one is positioned, so Chrome reads "2 :". */}
                    Spørsmål {n + 1} av {questions.length}:
                  </span>{" "}
                  <span className="mt-1 block text-title">{q.text}</span>
                </legend>
                <div className="clear-both space-y-3 pt-3">
                  {questionError && (
                    <p id={errorId} className="text-body-sm text-danger">
                      <span className="sr-only">Feil: </span>
                      {questionError}
                    </p>
                  )}
                  {fields[q.id].map((value, i) => {
                    const name = fieldName(q.id, i);
                    // Raw, like maxLength: a trimmed count would stall below 80 with spaces.
                    const length = value.length;
                    const field = (
                      <TextField
                        name={name}
                        label={i === 0 ? "Svar 1" : `Svar ${i + 1} (valgfritt)`}
                        value={value}
                        onChange={(event) =>
                          setField(q.id, i, event.target.value)
                        }
                        maxLength={ANSWER_TEXT_MAX}
                        autoComplete="off"
                        autoCapitalize="sentences"
                        enterKeyHint="next"
                        error={errors?.[name]}
                        aria-invalid={
                          i === 0 && questionError ? true : undefined
                        }
                        aria-describedby={
                          i === 0 && questionError ? errorId : undefined
                        }
                        counter={
                          length >= ANSWER_COUNTER_FROM && (
                            <span aria-hidden="true">
                              {length}/{ANSWER_TEXT_MAX}
                            </span>
                          )
                        }
                        className="min-w-0 flex-1"
                      />
                    );
                    if (i < ANSWER_FIELDS_DEFAULT)
                      return <div key={i}>{field}</div>;
                    return (
                      <div key={i} className="flex items-start gap-2">
                        {field}
                        {/* mt-6 lines the button up with the input under its label. */}
                        <Button
                          type="button"
                          variant="ghost"
                          aria-label={`Fjern svar ${i + 1}`}
                          onClick={() => removeField(q.id, i)}
                          className="mt-6 min-h-12 shrink-0"
                        >
                          Fjern
                        </Button>
                      </div>
                    );
                  })}
                  {fields[q.id].length < ANSWERS_PER_QUESTION_MAX && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => addField(q.id)}
                      className="-ml-2 px-2"
                    >
                      <span className="inline-flex items-center gap-2">
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 16 16"
                          className="size-4 shrink-0"
                        >
                          <path
                            d="M8 3v10M3 8h10"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                          />
                        </svg>
                        Legg til svar
                      </span>
                    </Button>
                  )}
                </div>
              </fieldset>
            );
          })}
        </div>

        <p className="mt-6">
          {answered} av {questions.length} spørsmål har svar
        </p>
        {failure && (
          <Notice tone="danger" className="mt-4">
            {failure}
          </Notice>
        )}
        <Button
          type="submit"
          variant="primary"
          pending={pending}
          pendingLabel="Sender …"
          className="mt-4 w-full"
        >
          {submitted ? "Lagre endringer" : "Send inn svar"}
        </Button>
        <p className="mt-2 text-body-sm text-ink-muted">
          Utkastet lagres bare på denne enheten. Sender du inn fra en annen
          enhet, erstatter det de forrige svarene.
        </p>
        <p aria-live="polite" className="sr-only">
          {announcement}
        </p>
      </form>
    </>
  );
}
