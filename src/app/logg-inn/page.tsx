import type { Metadata } from "next";
import Link from "next/link";
import { logIn } from "@/app/logg-inn/actions";
import { AccountForm } from "@/components/AccountForm";
import { Notice } from "@/components/Notice";
import { DEMO_HOST } from "@/lib/demo";
import { env } from "@/server/env";

export const metadata: Metadata = { title: "Logg inn" };

export default async function LoginPage({
  searchParams,
}: PageProps<"/logg-inn">) {
  const { utlopt } = await searchParams;
  return (
    <main className="mx-auto max-w-140 px-4 py-24 sm:py-32">
      <Link
        href="/"
        className="inline-flex min-h-11 items-center font-display text-heading"
      >
        Toppsvar
      </Link>
      <h1 className="mt-6 text-display">Logg inn</h1>
      {utlopt === "1" && (
        <Notice tone="info" className="mt-6">
          Du ble logget ut etter 14 dager uten bruk. Logg inn igjen.
        </Notice>
      )}
      <AccountForm
        mode="login"
        askCode={false}
        action={logIn}
        demo={env.DEMO_MODE ? DEMO_HOST : undefined}
      />
    </main>
  );
}
