"use client";

import { useEffect } from "react";

// Next re-renders the root layout's <title> ("Toppsvar") after hydration and when a
// Server Action resolves, after this effect has run, so the title is re-applied
// whenever <head> changes. null leaves the title alone.
// shortcut: re-applies the title against Next's head re-render, replace with metadata or a React <title> once Next stops rewriting <title>.
export function useDocumentTitle(title: string | null) {
  useEffect(() => {
    if (title === null) return;
    const apply = () => {
      if (document.title !== title) document.title = title;
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.head, {
      subtree: true,
      childList: true,
      characterData: true,
    });
    return () => observer.disconnect();
  }, [title]);
}
