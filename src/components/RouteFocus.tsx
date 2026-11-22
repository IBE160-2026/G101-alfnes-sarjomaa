"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

function focusHeading(h1: HTMLElement) {
  h1.setAttribute("tabindex", "-1");
  h1.focus();
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
