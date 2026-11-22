"use client";

import { useState, type MouseEvent } from "react";
import { Notice } from "@/components/Notice";
import { NETWORK } from "@/components/useFormAction";

const FAILED = "Fikk ikke hentet bruksrapporten. Prøv igjen.";

// Keeps the plain link for no-JS, but fetches on click so an error stays on the Game page.
// shortcut: without JS an error still opens the raw JSON body, add a no-JS error page if that matters.
export function DownloadReport({ href }: { href: string }) {
  const [error, setError] = useState<string | null>(null);

  async function download(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    setError(null);
    let response: Response;
    try {
      response = await fetch(href);
    } catch {
      return setError(NETWORK);
    }
    // An expired session was redirected to the login page: go there for real.
    if (response.redirected) return window.location.assign(href);
    if (!response.ok) {
      const body: { message?: unknown } | null = await response
        .json()
        .catch(() => null);
      return setError(
        typeof body?.message === "string" ? body.message : FAILED,
      );
    }
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");
    link.href = url;
    link.download = "toppsvar-bruksrapport.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url));
  }

  return (
    <>
      {/* No `download` attribute here, so a no-JS logged-out redirect is not saved as the file. */}
      <a
        href={href}
        onClick={download}
        className="inline-flex min-h-11 items-center justify-center rounded-md border border-line-strong bg-surface px-4 text-primary hover:bg-surface-sunken"
      >
        Last ned bruksrapport
      </a>
      {error && (
        <Notice tone="danger" className="mt-3 max-w-md">
          {error}
        </Notice>
      )}
    </>
  );
}
