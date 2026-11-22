"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { revokeInviteLink } from "@/app/spill/[id]/actions";
import { Button } from "@/components/Button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Notice } from "@/components/Notice";
import { OnceLinkList } from "@/components/OnceLinkList";
import { TextField } from "@/components/TextField";
import { callAction, NETWORK } from "@/components/useFormAction";
import { MESSAGES } from "@/lib/errors";
import { LINK_NOT_ACTIVE } from "@/lib/invite-link";
import { INVITE_LINKS_MAX } from "@/lib/limits";

const REFRESH_ON = new Set(["WRONG_STATE", "NOT_FOUND", "LINK_CAP_REACHED"]);

// Revoke and replace (FR-9). The dialog text never depends on the link, and nothing
// here learns whether the revoked link had an Answer set.
export function RevokeLinkPanel({
  gameId,
  issued,
}: {
  gameId: string;
  issued: number;
}) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const noticeRef = useRef<HTMLDivElement>(null);
  const capRef = useRef<HTMLParagraphElement>(null);
  const [value, setValue] = useState("");
  const [fieldError, setFieldError] = useState<string>();
  const [failure, setFailure] = useState<string>();
  const [link, setLink] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Where focus goes once the DOM shows the change.
  const focusNext = useRef<"field" | "notice" | null>(null);

  useEffect(() => {
    const target = focusNext.current;
    if (!target) return;
    focusNext.current = null;
    // A cap refresh unmounts the dialog and its notice, so the cap sentence takes focus.
    if (target === "notice") (noticeRef.current ?? capRef.current)?.focus();
    // At the cap the field is gone, so the cap sentence takes focus.
    else (rootRef.current?.querySelector("input") ?? capRef.current)?.focus();
  });

  function revoke() {
    setFailure(undefined);
    startTransition(async () => {
      const result = await callAction(() =>
        revokeInviteLink({ gameId, link: value }),
      );
      if (result?.ok) {
        setValue("");
        setFieldError(undefined);
        setLink(result.data.link);
        return;
      }
      // A rejected call may still have committed on the server.
      if (!result || REFRESH_ON.has(result.code)) router.refresh();
      if (result?.code === "LINK_UNKNOWN")
        setFieldError(result.fieldErrors?.link);
      // Inside the dialog the field is out of reach, so the notice says it too.
      setFailure(
        result ? (result.fieldErrors?.link ?? result.message) : NETWORK,
      );
      focusNext.current = "notice";
    });
  }

  return (
    <div ref={rootRef}>
      {link ? (
        <OnceLinkList
          links={[link]}
          onDone={() => {
            setLink(null);
            focusNext.current = "field";
          }}
        />
      ) : issued >= INVITE_LINKS_MAX ? (
        <p ref={capRef} tabIndex={-1} className="mt-4">
          {MESSAGES.LINK_CAP_REACHED}
        </p>
      ) : (
        <div className="mt-4 flex flex-col items-start gap-4">
          <TextField
            name="link"
            label="Lim inn lenken"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            value={value}
            error={fieldError}
            onChange={(event) => {
              setValue(event.target.value);
              setFieldError(undefined);
            }}
            className="w-full"
          />
          <ConfirmDialog
            triggerLabel="Trekk tilbake og lag ny"
            triggerVariant="secondary"
            title="Trekke tilbake lenken?"
            beforeOpen={() => {
              setFailure(undefined);
              if (value.trim()) return true;
              setFieldError(LINK_NOT_ACTIVE);
              focusNext.current = "field";
              return false;
            }}
            busy={pending}
            confirm={
              <Button
                type="button"
                variant="primary"
                pending={pending}
                pendingLabel="Trekker tilbake …"
                onClick={revoke}
              >
                Trekk tilbake og lag ny
              </Button>
            }
          >
            <p>
              Alt som er sendt inn via den, slettes. Du får én ny lenke, som
              vises bare én gang.
            </p>
            {failure && (
              <Notice tone="danger" ref={noticeRef} tabIndex={-1}>
                {failure}
              </Notice>
            )}
          </ConfirmDialog>
        </div>
      )}
    </div>
  );
}
