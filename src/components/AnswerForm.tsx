"use client";

import { unstable_rethrow } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
} from "react";
import { submitAnswerSet } from "@/app/svar/[gameId]/actions";
import { Button } from "@/components/Button";
import { Notice } from "@/components/Notice";
import { TextField } from "@/components/TextField";
import { ANSWER_MISSING, parseAnswerSet } from "@/lib/answer-set";
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
  ANSWER_TEXT_MAX,
  ANSWERS_PER_QUESTION_MAX,
} from "@/lib/limits";

type Question = { id: string; text: string };
type Phase = "form" | "saved" | "closed";

export const NETWORK_SUBMIT =
  "Fikk ikke sendt svarene. Sjekk nettet og prøv igjen. Utkastet ditt ligger fortsatt på denne enheten.";
const NOTICE =
  "Ingen kan se hvem som skrev hvilket svar, heller ikke verten. Verten leser likevel alle svarene slik de er skrevet.";
const CLOSED =
  "Innsamlingen ble stengt før svarene dine kom fram, så de ble ikke lagret.";
const DEFAULT_FIELDS = 2;

// Field names are `${qid}.${i}`, the same keys parseAnswerSet reports field errors under.
const fieldName = (qid: string, i: number) => `${qid}.${i}`;

export function AnswerForm({
  gameId,
  token,
  questions,
  onUnknown,
}: {
  gameId: string;
  token: string;
  questions: Question[];
  onUnknown: () => void;
}) {
  const [fields, setFields] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(
      questions.map((q) => [q.id, Array<string>(DEFAULT_FIELDS).fill("")]),
    ),
  );
  const [errors, setErrors] = useState<FieldErrors | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("form");
  const [pending, setPending] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const closedRef = useRef<HTMLDivElement>(null);
  const savedRef = useRef<HTMLHeadingElement>(null);
  const focusField = useRef<string | null>(null);
  const questionIds = questions.map((q) => q.id);

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

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setFailure(null);
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
    let result;
    try {
      result = await submitAnswerSet(gameId, token, {
        answers: fields,
        editSecret,
      });
    } catch (error) {
      unstable_rethrow(error);
      setFailure(NETWORK_SUBMIT);
      return;
    } finally {
      setPending(false);
    }

    if (result.ok) {
      setSubmitted(true);
      setPhase("saved");
    } else if (result.code === "INVALID_INPUT" && result.fieldErrors) {
      setErrors({ ...result.fieldErrors });
    } else if (result.code === "COLLECTION_CLOSED") {
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
            const h1 = document.querySelector("h1");
            h1?.setAttribute("tabindex", "-1");
            h1?.focus();
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
      <Notice tone="info" className="mt-6">
        {NOTICE}
      </Notice>
      <p className="mt-4">
        Gi 1–5 svar per spørsmål. Skriv det første du kommer på i Svar 1.
      </p>

      <form ref={formRef} noValidate onSubmit={submit} className="mt-6">
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
                    if (i < DEFAULT_FIELDS) return <div key={i}>{field}</div>;
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
