"use client";

import { useEffect } from "react";
import { storageKey } from "@/lib/invite-link";

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

// A closed or unknown link has nothing left to keep, so its saved draft and secret go.
export function LinkStatus({ status }: { status: keyof typeof COPY }) {
  useEffect(() => {
    try {
      const gameId = location.pathname.split("/")[2] ?? "";
      localStorage.removeItem(storageKey(gameId, location.hash.slice(1)));
    } catch {
      // Storage can be blocked or unavailable; there is then nothing to remove.
    }
  }, []);

  const [heading, body] = COPY[status];
  return (
    <>
      <h1 className="text-display text-balance">{heading}</h1>
      <p className="mt-4">{body}</p>
    </>
  );
}
