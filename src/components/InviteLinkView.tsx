"use client";

import { unstable_rethrow } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { openInviteLink } from "@/app/svar/[gameId]/actions";
import { AnswerForm } from "@/components/AnswerForm";
import { Button } from "@/components/Button";
import { LinkStatus } from "@/components/LinkStatus";
import { Notice } from "@/components/Notice";
import { NETWORK } from "@/components/useFormAction";
import { readLinkStore } from "@/lib/invite-link";

type Question = { id: string; text: string };
type View =
  | { kind: "loading" }
  | { kind: "closed" | "unknown" }
  | { kind: "failed"; message: string }
  | {
      kind: "open";
      token: string;
      title: string;
      questions: Question[];
      answers?: Record<string, string[]>;
    };

// The Token stays in the fragment, which the browser never sends; it leaves only in
// the action's POST body. The form submits with the Token it was opened with. The stored
// edit secret goes along, so only this device gets its saved set back (AD-8).
async function fetchView(gameId: string): Promise<View> {
  const token = location.hash.slice(1);
  try {
    const result = await openInviteLink(
      gameId,
      token,
      readLinkStore(gameId, token)?.editSecret,
    );
    if (result.ok) return { kind: "open", token, ...result.data };
    if (result.code === "LINK_UNKNOWN") return { kind: "unknown" };
    if (result.code === "COLLECTION_CLOSED") return { kind: "closed" };
    return { kind: "failed", message: result.message };
  } catch (error) {
    unstable_rethrow(error);
    return { kind: "failed", message: NETWORK };
  }
}

export function InviteLinkView({ gameId }: { gameId: string }) {
  const [view, setView] = useState<View>({ kind: "loading" });
  const load = useCallback(() => fetchView(gameId).then(setView), [gameId]);
  const refocus = useRef(false);
  const retryRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    void load();
  }, [load]);

  // A pasted replacement link changes only the fragment, which loads nothing by itself.
  useEffect(() => {
    const reload = () => location.reload();
    window.addEventListener("hashchange", reload);
    return () => window.removeEventListener("hashchange", reload);
  }, []);

  // "Prøv igjen" and a submit that finds the link gone unmount themselves, so focus goes
  // to what replaced them once the view settles.
  useEffect(() => {
    if (!refocus.current || view.kind === "loading") return;
    refocus.current = false;
    if (view.kind === "failed") return retryRef.current?.focus();
    const h1 = document.querySelector("h1");
    h1?.setAttribute("tabindex", "-1");
    h1?.focus();
  }, [view]);

  // Next re-renders the root layout's <title> ("Toppsvar") when a Server Action
  // resolves, after this effect has run, so the title is re-applied whenever <head> changes.
  // shortcut: re-applies the title against Next's head re-render after Server Actions, replace with metadata or a React <title> once Next stops rewriting <title>.
  const title = view.kind === "open" ? `${view.title} – Toppsvar` : null;
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

  switch (view.kind) {
    case "loading":
      return (
        <p role="status" className="animate-appear">
          Henter spørsmålene …
        </p>
      );
    case "closed":
    case "unknown":
      return <LinkStatus status={view.kind} />;
    case "failed":
      return (
        <>
          <Notice tone="danger">{view.message}</Notice>
          <Button
            type="button"
            variant="secondary"
            className="mt-4"
            ref={retryRef}
            onClick={() => {
              refocus.current = true;
              setView({ kind: "loading" });
              void load();
            }}
          >
            Prøv igjen
          </Button>
        </>
      );
    case "open":
      return (
        <>
          <h1 className="text-display text-balance">{view.title}</h1>
          <AnswerForm
            gameId={gameId}
            token={view.token}
            questions={view.questions}
            saved={view.answers}
            onUnknown={() => {
              refocus.current = true;
              setView({ kind: "unknown" });
            }}
          />
        </>
      );
  }
}
