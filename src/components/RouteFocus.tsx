"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

// Moves focus to the new page's <h1> after a client route change, never on first load.
export function RouteFocus() {
  const pathname = usePathname();
  const previous = useRef(pathname);

  useEffect(() => {
    if (previous.current === pathname) return;
    previous.current = pathname;
    const h1 = document.querySelector("h1");
    if (!h1) return;
    h1.setAttribute("tabindex", "-1");
    h1.focus();
  }, [pathname]);

  return null;
}
