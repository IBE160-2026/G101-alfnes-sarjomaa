"use client";

import { unstable_rethrow, useRouter } from "next/navigation";
import {
  startTransition,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  moveQuestion,
  removeQuestion,
  saveQuestion,
} from "@/app/spill/[id]/actions";
import { Button } from "@/components/Button";
import { MESSAGES, type ActionResult, type Failure } from "@/lib/errors";
import {
  QUESTION_COUNTER_FROM,
  QUESTION_TEXT_MAX,
  QUESTIONS_MAX,
} from "@/lib/limits";

type Question = { id: string; text: string };
type Status = { tone: "success" | "danger"; text: string } | null;

const EMPTY =
  "Ingen spørsmål ennå. Skriv det første, gjerne om noen dere kjenner, for eksempel «Hva gjør Jonas når han har forsovet seg?»";
const FAILED = "Fikk ikke lagret. Prøv igjen.";

// A rejection is the network (the request never made it), except Next's login redirect.
async function call(
  action: () => Promise<ActionResult<null>>,
): Promise<ActionResult<null> | null> {
  try {
    return await action();
  } catch (error) {
    unstable_rethrow(error);
    return null;
  }
}

// Rows follow the `questions` prop (server truth after every revalidatePath), plus the
// draft rows the server does not have yet, at the end.
export function QuestionEditor({
  gameId,
  questions,
}: {
  gameId: string;
  questions: Question[];
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const [drafts, setDrafts] = useState<string[]>([]);
  // Focus to move once the DOM shows the result: `before` is the questions prop the
  // change was made against (null: the next render, for local-only changes).
  const focusAfter = useRef<{
    before: Question[] | null;
    apply: () => void;
  } | null>(null);

  // A saved draft arrives in the prop with the same id (and React key), so it stops being a draft.
  const pendingDrafts = drafts.filter(
    (id) => !questions.some((q) => q.id === id),
  );
  if (pendingDrafts.length !== drafts.length) setDrafts(pendingDrafts);

  useEffect(() => {
    const pending = focusAfter.current;
    if (!pending || pending.before === questions) return;
    focusAfter.current = null;
    pending.apply();
  });

  const textareas = () =>
    Array.from(rootRef.current?.querySelectorAll("textarea") ?? []);
  const areaOf = (id: string) =>
    rootRef.current?.querySelector<HTMLTextAreaElement>(
      `[data-id="${id}"] textarea`,
    );

  function focusAfterRemove(before: Question[] | null, index: number) {
    focusAfter.current = {
      before,
      apply: () => {
        const areas = textareas();
        (areas[index] ?? areas[index - 1] ?? addRef.current)?.focus();
      },
    };
  }

  function focusAfterMove(id: string, direction: "up" | "down") {
    focusAfter.current = {
      before: questions,
      apply: () => {
        const row = rootRef.current?.querySelector(`[data-id="${id}"]`);
        (
          row?.querySelector<HTMLElement>(`[data-move="${direction}"]`) ??
          row?.querySelector<HTMLElement>("[data-move]")
        )?.focus();
      },
    };
  }

  // A draft still empty has no save sent, so it is reused; one with text gets a new row.
  function add() {
    const empty = pendingDrafts
      .map(areaOf)
      .find((area) => area && !area.value.trim());
    if (empty) return empty.focus();
    // shortcut: crypto.randomUUID needs a secure context (https or localhost), which every supported setup is; generate the id another way if plain-http LAN hosting is ever supported.
    const id = crypto.randomUUID();
    setDrafts((current) => [...current, id]);
    focusAfter.current = { before: null, apply: () => areaOf(id)?.focus() };
  }

  const rows = [
    ...questions.map((q) => ({ ...q, saved: true })),
    ...pendingDrafts.map((id) => ({ id, text: "", saved: false })),
  ];
  const savedCount = questions.length;

  return (
    <div ref={rootRef}>
      {savedCount === 0 && <p className="mt-2">{EMPTY}</p>}
      {rows.length > 0 && (
        <ol className="mt-4 flex flex-col gap-6">
          {rows.map((row, index) => (
            <QuestionRow
              key={row.id}
              gameId={gameId}
              id={row.id}
              initialText={row.text}
              number={index + 1}
              saved={row.saved}
              canMoveUp={row.saved && index > 0}
              canMoveDown={row.saved && index < savedCount - 1}
              onMoved={(direction) => focusAfterMove(row.id, direction)}
              onRemoved={() => focusAfterRemove(questions, index)}
              onDropDraft={() => {
                setDrafts((current) => current.filter((id) => id !== row.id));
                focusAfterRemove(null, index);
              }}
            />
          ))}
        </ol>
      )}
      <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
        {savedCount >= QUESTIONS_MAX ? (
          <p>{MESSAGES.QUESTION_CAP_REACHED}</p>
        ) : (
          <>
            <Button
              ref={addRef}
              type="button"
              variant="secondary"
              onClick={add}
            >
              Legg til spørsmål
            </Button>
            <p className="text-body-sm text-ink-muted">
              {savedCount} av {QUESTIONS_MAX} spørsmål
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function QuestionRow({
  gameId,
  id,
  initialText,
  number,
  saved,
  canMoveUp,
  canMoveDown,
  onMoved,
  onRemoved,
  onDropDraft,
}: {
  gameId: string;
  id: string;
  initialText: string;
  number: number;
  saved: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoved: (direction: "up" | "down") => void;
  onRemoved: () => void;
  onDropDraft: () => void;
}) {
  const router = useRouter();
  const fieldId = useId();
  const errorId = `${fieldId}-error`;
  const [text, setText] = useState(initialText);
  const [status, setStatus] = useState<Status>(null);
  const [error, setError] = useState<string | undefined>();
  const [busy, startBusy] = useTransition();
  // Refs, so a save that settles reads the text typed meanwhile.
  const textRef = useRef(initialText);
  const lastSaved = useRef<string | null>(saved ? initialText : null);
  const inFlight = useRef(false);
  // A draft deleted while its save is in flight; a save that lands is then removed again.
  const dropped = useRef(false);

  function showFailure(result: Failure | null) {
    if (
      result?.code === "WRONG_STATE" ||
      result?.code === "NOT_FOUND" ||
      result?.code === "QUESTION_CAP_REACHED"
    )
      router.refresh();
    setStatus({
      tone: "danger",
      text: !result || result.code === "INTERNAL" ? FAILED : result.message,
    });
  }

  function save() {
    const sent = textRef.current.trim();
    // Empty Questions are never sent; the server keeps the last saved text.
    if (dropped.current || inFlight.current) return;
    if (!sent || sent === lastSaved.current) {
      setError(undefined);
      if (!sent) setStatus(null);
      return;
    }
    inFlight.current = true;
    startTransition(async () => {
      const result = await call(() =>
        saveQuestion({ gameId, questionId: id, text: sent }),
      );
      inFlight.current = false;
      if (dropped.current) {
        if (result?.ok)
          await call(() => removeQuestion({ gameId, questionId: id }));
        return;
      }
      if (result?.ok) {
        lastSaved.current = sent;
        setError(undefined);
        setStatus({ tone: "success", text: "Lagret" });
      } else if (result?.fieldErrors?.text) {
        setError(result.fieldErrors.text);
        setStatus(null);
      } else {
        showFailure(result);
      }
      // A blur during the save was not sent; catch up if the text changed since.
      if (textRef.current.trim() !== sent) save();
    });
  }

  function run(action: () => Promise<ActionResult<null>>, onDone: () => void) {
    startBusy(async () => {
      const result = await call(action);
      if (result?.ok) onDone();
      else showFailure(result);
    });
  }

  const length = text.trim().length;
  const count = `${length} av ${QUESTION_TEXT_MAX} tegn`;
  const suffix = <span className="sr-only"> spørsmål {number}</span>;

  return (
    <li data-id={id}>
      <label htmlFor={fieldId} className="block text-label">
        Spørsmål {number}
      </label>
      <textarea
        id={fieldId}
        rows={2}
        aria-required
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          textRef.current = event.target.value;
          setStatus(null);
        }}
        onBlur={save}
        className={`mt-1 block w-full resize-y rounded-sm bg-surface text-body text-ink ${
          error
            ? "border-2 border-danger px-2.75 py-1.75"
            : "border border-line-strong px-3 py-2"
        }`}
      />
      <div className="mt-1 flex min-h-5 gap-4 text-body-sm">
        <p
          role="status"
          className={
            status?.tone === "success" ? "text-success" : "text-danger"
          }
        >
          {status?.text}
        </p>
        {length >= QUESTION_COUNTER_FROM && (
          <span aria-hidden="true" className="ml-auto text-ink-muted">
            {count}
          </span>
        )}
      </div>
      <p aria-live="polite" className="sr-only">
        {length >= QUESTION_TEXT_MAX ? count : ""}
      </p>
      {/* Always rendered, so the error is announced: it arrives after focus has left. */}
      <p
        id={errorId}
        aria-live="polite"
        className={error ? "mt-1 text-body-sm text-danger" : ""}
      >
        {error && (
          <>
            <span className="sr-only">Feil: </span>
            {error}
          </>
        )}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {canMoveUp && (
          <Button
            type="button"
            variant="ghost"
            data-move="up"
            pending={busy}
            onClick={() =>
              run(
                () => moveQuestion({ gameId, questionId: id, direction: "up" }),
                () => onMoved("up"),
              )
            }
          >
            Flytt opp{suffix}
          </Button>
        )}
        {canMoveDown && (
          <Button
            type="button"
            variant="ghost"
            data-move="down"
            pending={busy}
            onClick={() =>
              run(
                () =>
                  moveQuestion({ gameId, questionId: id, direction: "down" }),
                () => onMoved("down"),
              )
            }
          >
            Flytt ned{suffix}
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          pending={busy}
          onClick={() => {
            if (saved)
              return run(
                () => removeQuestion({ gameId, questionId: id }),
                onRemoved,
              );
            dropped.current = true;
            onDropDraft();
          }}
        >
          Slett{suffix}
        </Button>
      </div>
    </li>
  );
}
