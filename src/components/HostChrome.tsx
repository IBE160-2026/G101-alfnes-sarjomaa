import Link from "next/link";
import type { ReactNode } from "react";
import { logOut } from "@/app/actions";
import { Button } from "@/components/Button";
import { NavLink } from "@/components/NavLink";

const control =
  "inline-flex min-h-11 items-center rounded-md px-4 hover:bg-surface-sunken";

export function HostChrome({
  signedIn,
  children,
}: {
  signedIn: boolean;
  children: ReactNode;
}) {
  return (
    <>
      {/* data-host-chrome: hidden under the play view's stage (globals.css). */}
      <a
        data-host-chrome=""
        href="#innhold"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-10 focus:inline-flex focus:min-h-11 focus:items-center focus:rounded-md focus:bg-surface focus:px-4"
      >
        Hopp til innhold
      </a>
      <header data-host-chrome="" className="border-b border-line">
        <div className="mx-auto flex max-w-320 items-center justify-between gap-4 px-4 py-2 sm:px-8">
          <Link
            href={signedIn ? "/spill" : "/"}
            className="inline-flex min-h-11 items-center font-display text-heading"
          >
            Toppsvar
          </Link>
          {signedIn && (
            <nav aria-label="Hovedmeny" className="flex items-center gap-1">
              <NavLink href="/spill" className={control}>
                Mine spill
              </NavLink>
              <form action={logOut}>
                <Button type="submit" variant="ghost">
                  Logg ut
                </Button>
              </form>
            </nav>
          )}
        </div>
      </header>
      <main
        id="innhold"
        tabIndex={-1}
        className="mx-auto max-w-320 px-4 py-12 sm:px-8"
      >
        {/* Review marks itself data-wide to use the full 1280 px host width. */}
        <div className="max-w-200 has-[[data-wide]]:max-w-none">{children}</div>
      </main>
    </>
  );
}
