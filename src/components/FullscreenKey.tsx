"use client";

import { useEffect, useState } from "react";

// A play-view shortcut: no modifier but Shift, no repeat, not typed into a text field or
// the open overlay. Shared by every keydown listener on the stage.
export function isShortcut(event: KeyboardEvent) {
  if (event.repeat || event.ctrlKey || event.metaKey || event.altKey)
    return false;
  const target = event.target as HTMLElement;
  return !target.closest("input, textarea, select, [contenteditable], dialog");
}

// F toggles fullscreen on the play view; the hint goes while fullscreen is on.
export function FullscreenKey({ className }: { className: string }) {
  const [full, setFull] = useState(false);

  useEffect(() => {
    const onChange = () => setFull(document.fullscreenElement !== null);
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "f" || event.shiftKey) return;
      if (!isShortcut(event)) return;
      // A refused request (no user gesture, a browser policy) leaves the page as it is.
      (document.fullscreenElement
        ? document.exitFullscreen()
        : document.documentElement.requestFullscreen()
      ).catch(() => {});
    };
    onChange(); // fullscreen may already be on when the view mounts
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return full ? null : <p className={className}>Trykk F for fullskjerm.</p>;
}
