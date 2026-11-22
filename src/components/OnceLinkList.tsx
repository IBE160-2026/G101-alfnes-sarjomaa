"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/Button";
import { Notice } from "@/components/Notice";

const COPIED_MS = 2000;
const LEAVE =
  "Lenkene vises ikke igjen. Vil du gå videre uten å ha kopiert dem?";
const asked = new WeakSet<Event>();

// The only place the full links ever appear (FR-5, FR-12): they live in this
// component's props and are never re-fetched or stored.
export function OnceLinkList({
  links,
  onDone,
}: {
  links: string[];
  onDone: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Index of the link whose button reads "Kopiert", or "all".
  const [copied, setCopied] = useState<number | "all" | null>(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  // Until "Jeg har kopiert lenkene" unmounts this list, leaving the page asks first:
  // beforeunload for reload, closing the tab and a typed URL; a confirm for in-app
  // links and forms, since Next navigates those without unloading.
  // shortcut: browser Back/Forward inside the app is not covered (popstate cannot be cancelled), intercept the router if Hosts lose links that way.
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Older Safari and Chromium show the prompt only with returnValue set.
      event.returnValue = "";
    };
    const confirmLeave = (event: Event) => {
      // Both panels can show a list at once; ask once per event.
      if (event.defaultPrevented || asked.has(event)) return;
      asked.add(event);
      if (!window.confirm(LEAVE)) event.preventDefault();
    };
    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest?.("a[href]");
      if (
        !(link instanceof HTMLAnchorElement) ||
        link.origin !== location.origin ||
        link.target === "_blank" ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        // An in-page anchor such as "Hopp til innhold" stays on the page.
        (link.pathname === location.pathname && link.hash)
      )
        return;
      confirmLeave(event);
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", confirmLeave, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", confirmLeave, true);
      clearTimeout(timer.current);
    };
  }, []);

  // Selects the text for a manual copy, e.g. on plain http://<LAN-IP>, where
  // navigator.clipboard is undefined.
  function selectForManualCopy(node: Node) {
    const range = document.createRange();
    range.selectNodeContents(node);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }

  async function copy(which: number | "all") {
    const text = which === "all" ? links.join("\n") : links[which];
    clearTimeout(timer.current);
    setCopied(null);
    // Cleared first, so a repeated message is announced again.
    setStatus("");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setStatus(
        which === "all" && links.length > 1
          ? "Lenkene kopiert."
          : "Lenke kopiert.",
      );
      clearTimeout(timer.current); // another copy may have started meanwhile
      timer.current = setTimeout(() => setCopied(null), COPIED_MS);
    } catch {
      const list = listRef.current;
      const node =
        which === "all" ? list : list?.querySelectorAll("[data-link]")[which];
      if (node) selectForManualCopy(node);
      setStatus("Marker og kopier lenken selv.");
    }
  }

  return (
    <div className="mt-4 rounded-md border-2 border-warning bg-surface p-6">
      <h3 ref={headingRef} tabIndex={-1} className="text-title">
        Kopier lenkene nå
      </h3>
      <Notice tone="warning" className="mt-3">
        Av hensyn til anonymiteten lagrer vi ikke lenkene, så de kan ikke vises
        igjen. Send én lenke til hver deltaker.
      </Notice>
      <Button
        type="button"
        variant="primary"
        className="mt-4"
        onClick={() => copy("all")}
      >
        {copied === "all" ? "Kopiert" : "Kopier alle"}
      </Button>
      <ol ref={listRef} className="mt-4 flex flex-col divide-y divide-line">
        {links.map((link, i) => (
          <li
            key={link}
            className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3"
          >
            <span
              data-link
              className="min-w-0 flex-1 basis-64 font-mono text-body-sm break-all"
            >
              {link}
            </span>
            <Button
              type="button"
              variant="secondary"
              className="select-none"
              onClick={() => copy(i)}
            >
              {copied === i ? "Kopiert" : "Kopier"}
              <span className="sr-only"> lenke {i + 1}</span>
            </Button>
          </li>
        ))}
      </ol>
      <p role="status" className="mt-2 min-h-5 text-body-sm">
        {status}
      </p>
      <Button
        type="button"
        variant="secondary"
        className="mt-4"
        onClick={onDone}
      >
        Jeg har kopiert lenkene
      </Button>
    </div>
  );
}
