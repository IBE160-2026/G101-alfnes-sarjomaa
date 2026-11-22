import type { ReactNode } from "react";

// Participant pages: the wordmark as plain text and nothing else. No link, nav,
// skip link or account, so nothing points at a Host page (FR-1, UX-DR27).
export function ParticipantChrome({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="border-b border-line px-4 py-2">
        <p className="mx-auto flex min-h-11 max-w-140 items-center font-display text-heading">
          Toppsvar
        </p>
      </header>
      <main id="innhold" tabIndex={-1} className="px-4 py-8 wrap-break-word">
        <div className="mx-auto max-w-140">{children}</div>
      </main>
    </>
  );
}
