import Link from "next/link";
import { register } from "@/app/registrer/actions";
import { AccountForm } from "@/components/AccountForm";
import { env } from "@/server/env";

export default function RegisterPage() {
  return (
    <main className="mx-auto max-w-140 px-4 py-24 sm:py-32">
      <Link
        href="/"
        className="inline-flex min-h-11 items-center font-display text-heading"
      >
        Toppsvar
      </Link>
      <h1 className="mt-6 text-display">Opprett konto</h1>
      <AccountForm
        mode="register"
        askCode={env.REGISTRATION_CODE !== undefined}
        action={register}
      />
    </main>
  );
}
