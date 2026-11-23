"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/Button";
import { Notice } from "@/components/Notice";
import { TextField } from "@/components/TextField";
import { useFormAction } from "@/components/useFormAction";
import type { Failure } from "@/lib/errors";

const COPY = {
  register: {
    button: "Opprett konto",
    pending: "Oppretter konto\u00a0…",
    password: "new-password",
    other: {
      text: "Har du allerede konto?",
      link: "Logg inn",
      href: "/logg-inn",
    },
  },
  login: {
    button: "Logg inn",
    pending: "Logger inn\u00a0…",
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
  demo,
}: {
  mode: "register" | "login";
  askCode: boolean;
  action: (prev: unknown, formData: FormData) => Promise<Failure>;
  // Passed by the server page only in Demo mode, so the login never ships otherwise.
  demo?: { email: string; password: string };
}) {
  const copy = COPY[mode];
  const askForCode = mode === "register" && askCode;
  // Controlled, so the email survives the form reset after a failed submit.
  const [email, setEmail] = useState("");
  const { state, submit, pending, formRef, noticeRef, ...result } =
    useFormAction(
      action,
      askForCode
        ? ["email", "password", "registrationCode"]
        : ["email", "password"],
    );

  // After "Fyll inn demobrukeren" the last submit's errors no longer describe the fields,
  // so they are hidden until the next submit gives a new state.
  const [filledAfter, setFilledAfter] = useState<unknown>(null);
  const stale = state !== null && state === filledAfter;
  const fieldErrors = stale ? {} : result.fieldErrors;
  const showNotice = result.showNotice && !stale;

  function fillDemo() {
    if (!demo) return;
    setEmail(demo.email);
    setFilledAfter(state);
    const form = formRef.current;
    const password = form?.elements.namedItem("password");
    if (password instanceof HTMLInputElement) password.value = demo.password;
    // The submit button's name says what to do next (NFR-6); the form is not sent for the Host.
    form?.querySelector<HTMLButtonElement>('button[type="submit"]')?.focus();
  }

  return (
    <>
      {demo && (
        <Notice tone="info" live={false} className="mt-6">
          <p>
            <strong>Demomodus:</strong> logg inn som{" "}
            <code className="font-mono whitespace-nowrap">{demo.email}</code>{" "}
            med passordet{" "}
            <code className="font-mono whitespace-nowrap">{demo.password}</code>
            .
          </p>
          <Button
            type="button"
            variant="secondary"
            onClick={fillDemo}
            className="mt-3"
          >
            Fyll inn demobrukeren
          </Button>
        </Notice>
      )}
      {showNotice && (
        <Notice tone="danger" ref={noticeRef} tabIndex={-1} className="mt-6">
          {state?.message}
        </Notice>
      )}
      <form ref={formRef} action={submit} noValidate className="mt-6">
        <TextField
          name="email"
          label="E-post"
          type="email"
          autoComplete="email"
          aria-required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={fieldErrors.email}
        />
        <TextField
          name="password"
          label="Passord"
          type="password"
          autoComplete={copy.password}
          aria-required
          helper={mode === "register" ? "Minst 10 tegn." : undefined}
          error={fieldErrors.password}
          className="mt-5"
        />
        {askForCode && (
          <TextField
            name="registrationCode"
            label="Registreringskode"
            type="text"
            autoComplete="off"
            aria-required
            error={fieldErrors.registrationCode}
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
