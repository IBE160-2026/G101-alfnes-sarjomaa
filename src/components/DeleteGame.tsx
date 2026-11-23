"use client";

import { deleteGame } from "@/app/spill/[id]/actions";
import { Button } from "@/components/Button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Notice } from "@/components/Notice";
import { useFormAction } from "@/components/useFormAction";

export function DeleteGame({
  gameId,
  title,
}: {
  gameId: string;
  title: string;
}) {
  // No fields: every failure shows in the notice inside the dialog.
  const { state, submit, pending, noticeRef, showNotice } =
    useFormAction(deleteGame);

  return (
    <ConfirmDialog
      triggerLabel="Slett spillet"
      triggerVariant="secondary-danger"
      title={`Slette «${title}»?`}
      busy={pending}
      confirm={
        <form action={submit}>
          <input type="hidden" name="gameId" value={gameId} />
          <Button
            type="submit"
            variant="danger"
            pending={pending}
            pendingLabel={"Sletter\u00a0…"}
          >
            Slett for godt
          </Button>
        </form>
      }
    >
      <p>Spørsmål, lenker, svar, brett og poeng slettes for godt.</p>
      {showNotice && (
        <Notice tone="danger" ref={noticeRef} tabIndex={-1}>
          {state?.message}
        </Notice>
      )}
    </ConfirmDialog>
  );
}
