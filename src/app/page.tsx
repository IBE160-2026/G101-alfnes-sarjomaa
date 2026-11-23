import Link from "next/link";

const button =
  "inline-flex min-h-11 items-center justify-center rounded-md px-4 text-title";

export default function Home() {
  return (
    <main className="mx-auto max-w-140 px-4 py-24 sm:py-32">
      <h1 className="text-display">Toppsvar</h1>
      <p className="mt-4">
        Lag spørsmål om gjengen, samle inn anonyme svar og spill topplista
        sammen på én skjerm.
      </p>
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
