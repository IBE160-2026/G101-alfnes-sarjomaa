"use client";

import { useEffect } from "react";

// A play shortcut: no modifier but Shift, no repeat, not typed into a text field or the
// open overlay. Shared by the Host view's and the TV page's keydown listeners.
export function isShortcut(event: KeyboardEvent) {
  if (event.repeat || event.ctrlKey || event.metaKey || event.altKey)
    return false;
  const target = event.target as HTMLElement;
  return !target.closest("input, textarea, select, [contenteditable], dialog");
}

// F toggles fullscreen on the TV page. No visible hint: the Host view says it instead.
export function FullscreenKey() {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "f" || event.shiftKey) return;
      if (!isShortcut(event)) return;
      // A refused request (no user gesture, a browser policy) leaves the page as it is.
      (document.fullscreenElement
        ? document.exitFullscreen()
        : document.documentElement.requestFullscreen()
      ).catch(() => {});
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return null;
}
