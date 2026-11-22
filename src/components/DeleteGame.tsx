"use client";

import { unstable_rethrow } from "next/navigation";
import { useActionState, useEffect, useRef } from "react";
import { deleteGame } from "@/app/spill/[id]/actions";
import { Button } from "@/components/Button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Notice } from "@/components/Notice";

type State = { message: string } | null;

const NETWORK = "Fikk ikke kontakt. Sjekk nettet og prøv igjen.";

export function DeleteGame({
  gameId,
  title,
}: {
  gameId: string;
  title: string;
}) {
  const noticeRef = useRef<HTMLDivElement>(null);

  // Success redirects, which rejects here with Next's redirect error: let it through.
  const [state, submit, pending] = useActionState(
    async (prev: State, formData: FormData): Promise<State> => {
      try {
        return await deleteGame(prev, formData);
      } catch (error) {
        unstable_rethrow(error);
        return { message: NETWORK };
      }
    },
    null,
  );

  useEffect(() => {
    if (state) noticeRef.current?.focus();
  }, [state]);

  return (
    <ConfirmDialog
      triggerLabel="Slett spillet"
      triggerVariant="secondary-danger"
      title={`Slette «${title}»?`}
      confirm={
        <form action={submit}>
          <input type="hidden" name="gameId" value={gameId} />
          <Button
            type="submit"
            variant="danger"
            pending={pending}
            pendingLabel="Sletter …"
          >
            Slett for godt
          </Button>
        </form>
      }
    >
      <p>Spørsmål, lenker, svar, brett og poeng slettes for godt.</p>
      {state && (
        <Notice tone="danger" ref={noticeRef} tabIndex={-1}>
          {state.message}
        </Notice>
      )}
    </ConfirmDialog>
  );
}
