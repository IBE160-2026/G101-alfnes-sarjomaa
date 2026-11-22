"use client";

import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/Button";
import { Notice } from "@/components/Notice";
import { TextField } from "@/components/TextField";
import type { FieldErrors, Failure } from "@/lib/errors";

type State = {
  message: string;
  fieldErrors?: FieldErrors;
  email: string;
} | null;

const NETWORK = "Fikk ikke kontakt. Sjekk nettet og prøv igjen.";

const COPY = {
  register: {
    button: "Opprett konto",
    pending: "Oppretter konto …",
    password: "new-password",
    other: {
      text: "Har du allerede konto?",
      link: "Logg inn",
      href: "/logg-inn",
    },
  },
  login: {
    button: "Logg inn",
    pending: "Logger inn …",
    password: "current-password",
    other: {
      text: "Har du ikke konto?",
      link: "Opprett konto",
      href: "/registrer",
    },
  },
} as const;

const link = "inline-flex min-h-11 items-center text-primary underline";

export function AccountForm({
  mode,
  askCode,
  action,
}: {
  mode: "register" | "login";
  askCode: boolean;
  action: (prev: unknown, formData: FormData) => Promise<Failure>;
}) {
  const copy = COPY[mode];
  const formRef = useRef<HTMLFormElement>(null);
  const noticeRef = useRef<HTMLDivElement>(null);

  // A successful action redirects, which rejects here with Next's redirect error:
  // that one must propagate. Any other rejection means the request never made it.
  const [state, submit, pending] = useActionState(
    async (prev: State, formData: FormData): Promise<State> => {
      const email = String(formData.get("email") ?? "");
      try {
        return { ...(await action(prev, formData)), email };
      } catch (error) {
        unstable_rethrow(error);
        return { message: NETWORK, email };
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

  const errors = state?.fieldErrors;
  return (
    <>
      {state && !errors && (
        <Notice tone="danger" ref={noticeRef} tabIndex={-1} className="mt-6">
          {state.message}
        </Notice>
      )}
      <form ref={formRef} action={submit} noValidate className="mt-6">
        <TextField
          name="email"
          label="E-post"
          type="email"
          autoComplete="email"
          aria-required
          defaultValue={state?.email}
          error={errors?.email}
        />
        <TextField
          name="password"
          label="Passord"
          type="password"
          autoComplete={copy.password}
          aria-required
          helper={mode === "register" ? "Minst 10 tegn." : undefined}
          error={errors?.password}
          className="mt-5"
        />
        {mode === "register" && askCode && (
          <TextField
            name="registrationCode"
            label="Registreringskode"
            type="text"
            autoComplete="off"
            aria-required
            error={errors?.registrationCode}
            className="mt-5"
          />
        )}
        <Button
          type="submit"
          variant="primary"
          pending={pending}
          pendingLabel={copy.pending}
          className="mt-8"
        >
          {copy.button}
        </Button>
      </form>
      <p className="mt-6">
        {copy.other.text}{" "}
        <Link href={copy.other.href} className={link}>
          {copy.other.link}
        </Link>
      </p>
    </>
  );
}
