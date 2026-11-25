"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

// Focuses a heading that is not focusable by itself; the page's <h1> by default.
export function focusHeading(
  heading: Element | null = document.querySelector("h1"),
) {
  if (!(heading instanceof HTMLElement)) return;
  heading.setAttribute("tabindex", "-1");
  heading.focus();
}

// Focuses the heading with this id once mounted, for a page that replaced the focused
// control (the Host view's answer key and controls unmount when the Game finishes).
export function FocusOnMount({ id }: { id: string }) {
  useEffect(() => focusHeading(document.getElementById(id)), [id]);
  return null;
}

// Focuses the page's <h1>; behind a loading state (which has no <h1>) it waits for the
// heading to stream in. Returns a cleanup that stops waiting.
function focusPageHeading(): () => void {
  const h1 = document.querySelector("h1");
  if (h1) {
    focusHeading(h1);
    return () => {};
  }
  const observer = new MutationObserver(() => {
    const found = document.querySelector("h1");
    if (!found) return;
    observer.disconnect();
    focusHeading(found);
  });
  observer.observe(document.body, { childList: true, subtree: true });
  return () => observer.disconnect();
}

// Moves focus to the new page's <h1> after a client route change, never on first load.
export function RouteFocus() {
  const pathname = usePathname();
  const previous = useRef(pathname);

  useEffect(() => {
    if (previous.current === pathname) return;
    previous.current = pathname;
    return focusPageHeading();
  }, [pathname]);

  return null;
}
