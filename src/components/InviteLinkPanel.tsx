"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { createInviteLinks } from "@/app/spill/[id]/actions";
import { Button } from "@/components/Button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Notice } from "@/components/Notice";
import { OnceLinkList } from "@/components/OnceLinkList";
import { TextField } from "@/components/TextField";
import { callAction, NETWORK } from "@/components/useFormAction";
import { MESSAGES } from "@/lib/errors";
import { INVITE_LINKS_MAX } from "@/lib/limits";

const REFRESH_ON = new Set([
  "WRONG_STATE",
  "NOT_FOUND",
  "LINK_CAP_REACHED",
  "QUESTIONS_REQUIRED",
]);

export function InviteLinkPanel({
  gameId,
  state,
  issued,
  questionCount,
}: {
  gameId: string;
  state: "draft" | "collecting";
  issued: number;
  questionCount: number;
}) {
  const router = useRouter();
  const reasonId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const noticeRef = useRef<HTMLDivElement>(null);
  const capRef = useRef<HTMLParagraphElement>(null);
  const [count, setCount] = useState("1");
  const [fieldError, setFieldError] = useState<string>();
  const [failure, setFailure] = useState<string>();
  const [links, setLinks] = useState<string[] | null>(null);
  const [pending, startTransition] = useTransition();
  // Where focus goes once the DOM shows the change.
  const focusNext = useRef<"field" | "notice" | null>(null);

  useEffect(() => {
    const target = focusNext.current;
    if (!target) return;
    focusNext.current = null;
    if (target === "notice") noticeRef.current?.focus();
    // At the cap the field is gone, so the cap sentence takes focus.
    else (rootRef.current?.querySelector("input") ?? capRef.current)?.focus();
  });

  const remaining = INVITE_LINKS_MAX - issued;
  const blocked = state === "draft" && questionCount === 0;
  const confirmFirst = state === "draft" && !blocked;

  // Integer 1..remaining before anything is sent; the server checks again.
  function checkCount(): boolean {
    const n = Number(count);
    if (/^\d+$/.test(count.trim()) && n >= 1 && n <= remaining) return true;
    setFieldError(`Skriv et tall fra 1 til ${remaining}.`);
    focusNext.current = "field";
    return false;
  }

  function create() {
    if (!checkCount()) return;
    setFailure(undefined);
    startTransition(async () => {
      const result = await callAction(() =>
        createInviteLinks({ gameId, count: Number(count) }),
      );
      if (result?.ok) {
        setFieldError(undefined);
        setLinks(result.data.links);
        return;
      }
      // A rejected call may still have committed on the server.
      if (!result || REFRESH_ON.has(result.code)) router.refresh();
      if (result?.fieldErrors?.count) {
        setFieldError(result.fieldErrors.count);
        focusNext.current = "field";
        // Inside the dialog the field is out of reach, so the notice says it too.
        if (!confirmFirst) return;
      }
      setFailure(result ? result.message : NETWORK);
      focusNext.current = "notice";
    });
  }

  const notice = failure && (
    <Notice tone="danger" ref={noticeRef} tabIndex={-1}>
      {failure}
    </Notice>
  );

  let action;
  if (blocked)
    action = (
      <Button
        type="button"
        variant="primary"
        aria-disabled="true"
        aria-describedby={reasonId}
      >
        Lag lenker
      </Button>
    );
  else if (confirmFirst)
    action = (
      <ConfirmDialog
        triggerLabel="Lag lenker"
        triggerVariant="primary"
        title="Åpne innsamlingen?"
        beforeOpen={() => {
          setFailure(undefined);
          return checkCount();
        }}
        busy={pending}
        confirm={
          <Button
            type="button"
            variant="primary"
            pending={pending}
            pendingLabel={"Åpner\u00a0…"}
            onClick={create}
          >
            Åpne innsamlingen
          </Button>
        }
      >
        <p>Du har lagret {questionCount} spørsmål.</p>
        <p>
          Spørsmålene låses når du lager de første lenkene, og kan ikke endres
          etterpå.
        </p>
        {notice}
      </ConfirmDialog>
    );
  else
    action = (
      <Button
        type="button"
        variant="primary"
        pending={pending}
        pendingLabel={"Lager lenker\u00a0…"}
        onClick={create}
      >
        Lag lenker
      </Button>
    );

  return (
    <div ref={rootRef}>
      {links ? (
        <OnceLinkList
          links={links}
          onDone={() => {
            setLinks(null);
            focusNext.current = "field";
          }}
        />
      ) : remaining <= 0 ? (
        <p ref={capRef} tabIndex={-1} className="mt-4">
          {MESSAGES.LINK_CAP_REACHED}
        </p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-start gap-x-4">
            <TextField
              name="count"
              label="Antall lenker"
              type="number"
              inputMode="numeric"
              min={1}
              max={remaining}
              value={count}
              error={fieldError}
              onChange={(event) => {
                setCount(event.target.value);
                setFieldError(undefined);
              }}
              className="w-28"
            />
            {/* Below the label, centred on the 48 px field. */}
            <div className="mt-6 flex min-h-12 items-center">{action}</div>
          </div>
          {blocked && (
            <p id={reasonId} className="mt-2 text-body-sm">
              {MESSAGES.QUESTIONS_REQUIRED}
            </p>
          )}
          {!confirmFirst && notice && <div className="mt-4">{notice}</div>}
        </>
      )}
      <p className="mt-4 text-body-sm text-ink-muted">
        {issued} av maks {INVITE_LINKS_MAX} lenker brukt.
      </p>
    </div>
  );
}
