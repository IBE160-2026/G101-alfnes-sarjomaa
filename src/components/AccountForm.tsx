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
  const askForCode = mode === "register" && askCode;
  // Controlled, so the email survives the form reset after a failed submit.
  const [email, setEmail] = useState("");
  const {
    state,
    submit,
    pending,
    formRef,
    noticeRef,
    fieldErrors,
    showNotice,
  } = useFormAction(
    action,
    askForCode
      ? ["email", "password", "registrationCode"]
      : ["email", "password"],
  );

  return (
    <>
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
