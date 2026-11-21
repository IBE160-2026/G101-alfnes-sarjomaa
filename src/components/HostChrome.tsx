import Link from "next/link";
import type { ReactNode } from "react";
import { logOut } from "@/app/actions";

const control =
  "inline-flex min-h-11 items-center rounded-md px-3 hover:bg-surface-sunken";

// shortcut: shows "Mine spill" and "Logg ut" to every visitor on the root 404/500 pages, make it session-aware when Story 1.3 adds sessions
export function HostChrome({ children }: { children: ReactNode }) {
  return (
    <>
      <a
        href="#innhold"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-10 focus:inline-flex focus:min-h-11 focus:items-center focus:rounded-md focus:bg-surface focus:px-4"
      >
        Hopp til innhold
      </a>
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-320 items-center justify-between gap-4 px-4 py-2 sm:px-8">
          <Link
            href="/spill"
            className="inline-flex min-h-11 items-center font-display text-heading"
          >
            Toppsvar
          </Link>
          <nav aria-label="Hovedmeny" className="flex items-center gap-1">
            <Link href="/spill" className={control}>
              Mine spill
            </Link>
            <form action={logOut}>
              <button type="submit" className={`${control} cursor-pointer`}>
                Logg ut
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main
        id="innhold"
        tabIndex={-1}
        className="mx-auto max-w-320 px-4 py-12 sm:px-8"
      >
        <div className="max-w-200">{children}</div>
      </main>
    </>
  );
}
