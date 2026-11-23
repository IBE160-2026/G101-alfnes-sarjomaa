import { unstable_rethrow } from "next/navigation";
import { useActionState, useEffect, useRef } from "react";
import type { ActionResult, Failure } from "@/lib/errors";

type State = Pick<Failure, "message" | "fieldErrors"> | null;

export const NETWORK = "Fikk ikke kontakt. Sjekk nettet og prøv igjen.";

// Calls an object-input Server Action. null means the request never made it (show
// NETWORK); Next's login redirect still propagates.
export async function callAction<T>(
  action: () => Promise<ActionResult<T>>,
): Promise<ActionResult<T> | null> {
  try {
    return await action();
  } catch (error) {
    unstable_rethrow(error);
    return null;
  }
}

// Runs a form's Server Action. Success redirects, which rejects here with Next's
// redirect error and must propagate; any other rejection means the request never
// made it. After a failure, focus goes to the first invalid field, else the notice.
// `fields` names the inputs the form renders: an error for any other key shows in
// the notice instead, so it is never silent.
export function useFormAction(
  action: (prev: unknown, formData: FormData) => Promise<Failure>,
  fields: readonly string[] = [],
) {
  const formRef = useRef<HTMLFormElement>(null);
  const noticeRef = useRef<HTMLDivElement>(null);
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

  const fieldErrors = state?.fieldErrors ?? {};
  const showNotice = !!state && !fields.some((field) => fieldErrors[field]);
  return {
    state,
    submit,
    pending,
    formRef,
    noticeRef,
    fieldErrors,
    showNotice,
  };
}
