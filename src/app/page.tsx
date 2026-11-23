import Link from "next/link";
import { connection } from "next/server";
import { Notice } from "@/components/Notice";
import { DEMO_HOST } from "@/lib/demo";
import { env } from "@/server/env";

const button =
  "inline-flex min-h-11 items-center justify-center rounded-md px-4 text-title";

// Rendered per request, so DEMO_MODE is read at run time, not baked in at build.
export default async function Home() {
  await connection();
  return (
    <main className="mx-auto max-w-140 px-4 py-24 sm:py-32">
      <h1 className="text-display">Toppsvar</h1>
      <p className="mt-4">
        Lag spørsmål om gjengen, samle inn anonyme svar og spill topplista
        sammen på én skjerm.
      </p>
      {env.DEMO_MODE && (
        <Notice tone="info" live={false} className="mt-6">
          <strong>Demomodus:</strong> logg inn som{" "}
          <code className="font-mono whitespace-nowrap">{DEMO_HOST.email}</code>{" "}
          med passordet{" "}
          <code className="font-mono whitespace-nowrap">
            {DEMO_HOST.password}
          </code>
          .
        </Notice>
      )}
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/logg-inn"
          className={`${button} bg-primary text-on-primary hover:bg-primary-hover`}
        >
          Logg inn
        </Link>
        <Link
          href="/registrer"
          className={`${button} border border-line-strong bg-surface text-primary hover:bg-primary-soft`}
        >
          Opprett konto
        </Link>
      </div>
    </main>
  );
}
