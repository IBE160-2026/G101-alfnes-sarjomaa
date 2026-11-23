"use client";

import { useEffect } from "react";
import { useDocumentTitle } from "@/components/useDocumentTitle";
import { clearLinkStore } from "@/lib/invite-link";

const TITLES = {
  closed: "Innsamlingen er stengt – Toppsvar",
  unknown: "Vi finner ikke lenken – Toppsvar",
} as const;

const COPY = {
  closed: [
    "Innsamlingen er stengt.",
    "Verten har stengt innsamlingen, så svar kan ikke lenger sendes inn eller endres.",
  ],
  unknown: [
    "Vi finner ikke denne lenken.",
    "Den kan være skrevet feil eller ikke lenger gyldig. Be den som sendte deg den om en ny.",
  ],
} as const;

// A closed or unknown link has nothing left to keep, so its saved draft and secret go,
// but only when they belong to exactly this Token (a cut-short link shares the key).
export function LinkStatus({ status }: { status: keyof typeof COPY }) {
  useDocumentTitle(TITLES[status]);

  useEffect(() => {
    clearLinkStore(
      location.pathname.split("/")[2] ?? "",
      location.hash.slice(1),
    );
  }, []);

  const [heading, body] = COPY[status];
  return (
    <>
      <h1 className="text-display text-balance">{heading}</h1>
      <p className="mt-4">{body}</p>
    </>
  );
}
