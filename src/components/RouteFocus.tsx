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

// Moves focus to the new page's <h1> after a client route change, never on first load.
// Behind a loading.tsx skeleton (which has no <h1>) it waits for the heading to stream in.
export function RouteFocus() {
  const pathname = usePathname();
  const previous = useRef(pathname);

  useEffect(() => {
    if (previous.current === pathname) return;
    previous.current = pathname;
    const h1 = document.querySelector("h1");
    if (h1) return focusHeading(h1);
    const observer = new MutationObserver(() => {
      const found = document.querySelector("h1");
      if (!found) return;
      observer.disconnect();
      focusHeading(found);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [pathname]);

  return null;
}
