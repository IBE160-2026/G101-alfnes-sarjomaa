import Link from "next/link";
import { connection } from "next/server";
import { register } from "@/app/registrer/actions";
import { AccountForm } from "@/components/AccountForm";
import { env } from "@/server/env";

// Rendered per request, so a build-time snapshot of REGISTRATION_CODE never hides the field.
export default async function RegisterPage() {
  await connection();
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
