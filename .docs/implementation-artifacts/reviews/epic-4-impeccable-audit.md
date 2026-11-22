# Epic 4 impeccable audit (audit + harden)

Branch `epic-4-gruppering`, scope `git diff epic-3-lukking..epic-4-gruppering`. Mode: Operate. Contract: `DESIGN.md` and `EXPERIENCE.md` in `.docs/planning-artifacts/ux-designs/ux-Toppsvar-2026-11-21/`. The launcher was unavailable, so this is a source audit only. Nothing was rendered and no server was started. Contrast was checked against the contract's verified table, not measured in a browser. Copy was read against `copy-tells.md`.

Files in scope: `src/app/spill/[id]/page.tsx` (grouping panel, in review summary, report link), `src/components/GroupingRefresh.tsx`, `src/app/api/spill/[gameId]/rapport/route.ts`.

## Scores

| Dimension | Score | Key finding |
|---|---|---|
| Accessibility | 3 | No noisy live region, focus handoff to the in review heading works. The slow-state sentence and the report error path are the gaps. |
| Performance | 3 | A 3 s `router.refresh` also runs in a hidden tab. |
| Theming | 4 | Only token classes, no hard-coded colors. |
| Responsive | 4 | `min-h-11`, `max-w-prose`, `max-w-md`, and `break-words` is not needed on the new numbers. |
| Implementation integrity | 3 | Copy and the slow-state sentence contradict the polling. The in review panel has no way forward until Epic 5. |
| **Total** | **17/20** | Good. Nothing blocks. |

Verdict on integrity: pass. The new UI reuses `text-display` for the count, the secondary-button classes, and `focusHeading`. The sentence in `ProgressCount` and the one here share a shape on purpose.

## Must

None. No WCAG A or AA failure and nothing that blocks a task.

## Should

### S1. Report errors navigate away to a raw JSON page (`page.tsx:225-233`, `route.ts:36-43`)

A plain `<a href="/api/spill/<id>/rapport">` is a navigation. When the route answers 404, 409 or 500 (Game deleted in another tab, 500 from the boundary), the browser replaces the Game page with `{"code":"NOT_FOUND","message":"..."}`. There is no chrome, no heading, no way back except the browser's Back button, and screen readers meet an unstyled document. This is the "something went wrong with no recovery" case that `harden` exists for, and it contradicts the contract's wording "errors name the problem and the recovery". Offline, the browser shows its own error page in place of the app.

Fix: a small client component `DownloadReport` that keeps the `<a>` (so it works without JS and for the e2e download test) and takes over the click.

```tsx
"use client";
import { useState, type MouseEvent } from "react";
import { Notice } from "@/components/Notice";

export function DownloadReport({ href }: { href: string }) {
  const [error, setError] = useState<string | null>(null);
  async function onClick(e: MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    setError(null);
    try {
      const res = await fetch(href);
      if (res.redirected) return void window.location.assign(href); // session expired: let the login redirect run
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        return setError(body?.message ?? "Fikk ikke hentet bruksrapporten. Prøv igjen.");
      }
      const url = URL.createObjectURL(await res.blob());
      const a = Object.assign(document.createElement("a"), { href: url, download: "toppsvar-bruksrapport.json" });
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Fikk ikke hentet bruksrapporten. Sjekk nettet og prøv igjen.");
    }
  }
  return (<>
    <a href={href} onClick={onClick} className="…same classes…">Last ned bruksrapport</a>
    {error && <Notice tone="danger" className="mt-3 max-w-md">{error}</Notice>}
  </>);
}
```

The `download` attribute is safe here because the click handler decides what happens. The no-JS fallback is still the plain link. Focus stays on the link and the `danger` Notice has `role="alert"`, so the error is announced once. `MESSAGES[code]` is already in Norwegian and free of foreign text (`errors.ts:57`). Shortcut worth a comment: `shortcut: the no-JS fallback still shows raw JSON on error, when a plain form post is not worth it`. Playwright's download event still fires from `a.click()`.

### S2. The slow-state sentence tells the Host to do what the page already does (`page.tsx:159-163`)

"Grupperingen tar lengre tid enn vanlig. Last inn siden på nytt." sits on a page that refreshes itself every 3 s, and every refresh past the lease calls `resumeIfStale`. The instruction is redundant and implies the Host must act. A Host who reloads loses nothing, but one who waits is also right, and the copy suggests waiting is wrong. The contract (`EXPERIENCE.md`, empty/error table, row *grouping*) says exactly this sentence, and says it polls, so the contradiction lives in the contract, not only in the code.

Fix, two parts:

1. Amend the contract sentence and the code to: "Grupperingen tar lengre tid enn vanlig. Siden oppdateres av seg selv, og dommeren starter på nytt hvis noe har stoppet." The second clause is only true because `resumeIfStale` exists, so keep it short if you prefer: "Grupperingen tar lengre tid enn vanlig. Siden oppdateres av seg selv."
2. Render it as `<Notice tone="warning">` with a bold first phrase ("Det tar lengre tid enn vanlig.") instead of a bare `<p>`. The `warning` Notice has `role="status"` (`Notice.tsx:7`). It enters the DOM once, and the poll keeps the same node, so it is announced once and not on every refresh. Today the sentence is silent for screen reader users and has no visual weight against the count. It also uses the `warning` meaning that DESIGN.md reserves for "fallback notice".

If the group does not want to touch the contract, the minimum is the Notice wrapper and the `max-w-prose` stays.

### S3. The in review panel is a dead end (`page.tsx:166-192`)

The state shows three numbers and then nothing. UX-DR16 gives each state one primary action, and `EXPERIENCE.md` expects Review to follow. Until Epic 5 ships, the Host sees "Grupperingen er ferdig" with no next step and no sentence saying more is coming. The only control on the page is the secondary report link. That is acceptable on a branch that ends before Epic 5, but not for a build that is demoed or handed in at this commit.

Fix: leave the numbers, and until Epic 5 add no button (a dead button is worse). Replace the shortcut comment at `page.tsx:168-169` with the project's form, `shortcut: no Review link until Epic 5, add the primary "Gå gjennom grupperingen" here`, so `ponytail-debt` lists it. When Epic 5 lands, that link is the page's one primary button.

## Nice

### N1. The count row names are slightly ambiguous (`page.tsx:171-175`)

"Spørsmål 9" reads like a label for question 9, not a total. Use "Spørsmål i alt". "Grupper foreslått" and "Spørsmål å gruppere for hånd" are clear and follow the term map (gruppe, spørsmål). They never mention a key, a model, or Demo mode, and `fellBack` counts every fallback reason the same way (no key, timeout, NO_STORED_RULING), so the summary is correct in Demo mode. Verified against `summary()` in `src/server/grouping/index.ts:234-258`: it reads only `fell_back` and `origin = judge`, never the reason. Keep it that way. One edge: when all questions fell back, "Grupperingen er ferdig" with "Grupper foreslått 0" is still true, and "Spørsmål å gruppere for hånd 9" states the consequence plainly.

### N2. Polling continues in a hidden tab and fails silently (`GroupingRefresh.tsx:11`)

`setInterval(router.refresh, 3000)` runs for the whole grouping state, also in a background tab, and a failed refresh (offline) leaves the old count on screen with no sign that it is stale. For a two-minute state this is cheap. Cheapest hardening: skip when `document.hidden`, and rely on the S2 sentence after the 180 s lease for the stalled case. Add `shortcut: polls while hidden and shows nothing when offline, add visibility pause if hosting costs matter`.

### N3. Completion is announced only by the focus move (`GroupingRefresh.tsx:12-17`)

When grouping ends the section unmounts and focus goes to the `#gjennomgang` heading, which announces "Grupperingen er ferdig". This works for the common case (focus on `body`). If the Host's focus was on the footer "Slett spillet" button, focus stays there and the change is silent except for the badge text. That is correct behavior (focus is never stolen from a control the Host is using) and the contract bans noisy regions, so leave it. Document it in the spec rather than add a live region.

### N4. Add a trust line under the report link (`page.tsx:225-233`)

The brand rule "trust is visible" and FR-11 to FR-13 suggest one `text-body-sm text-ink-muted` line under the link: "Bare tall, aldri svar eller navn." Contract text for the button stays "Last ned bruksrapport". Only add it if the group wants the line; it is not in the contract.

## Checks that passed

- **Tokens:** every new class is a token (`text-display`, `text-heading`, `text-title`, `border-line`, `border-line-strong`, `bg-surface`, `bg-surface-sunken`, `text-primary`). No hex, no arbitrary values.
- **Contrast:** `primary` on `surface` is above 7:1 and `ink` on `paper` is 16:1, from the contract table. The `border-line` dividers in the `dl` are decorative, which the contract allows for `line`.
- **Live regions:** none on the polled panel, same as `ProgressCount`. The count is a static paragraph and the `{done}` span reads as "3 av 9 spørsmål ferdig" (the template string starts with a space).
- **Keyboard path:** the report link is a real `<a>`, reachable in DOM order before the delete footer, `min-h-11` (44 px), and picks up the global `:focus-visible` 3 px ring. No keyboard trap, no hover-only affordance.
- **Secondary, not primary:** the link uses the secondary-button classes, so each state keeps its single primary action. The classes duplicate `Button.tsx` VARIANTS; the 4.3 review rejected the refactor and that is still reasonable.
- **Loading:** the grouping panel is the loading state per the contract table, and `router.refresh` does not trigger `loading.tsx`, so there is no skeleton flash every 3 s.
- **Reduced motion:** nothing animates in the new UI.
- **Copy against contract:** "Dommeren, en KI-modell, grupperer svarene … Det tar vanligvis under to minutter." and "N av M spørsmål ferdig" match the contract text. The no-break space before the ellipsis is a good detail. No ban words, no em dashes, no stock phrases, no emoji.
- **Anonymity:** the report is counters and origins only; the route has `Cache-Control: no-store`.

## Recommended order

1. S1 `DownloadReport` client component (about 25 lines).
2. S2 slow-state sentence as a warning Notice, with the contract amended in the same commit.
3. S3 replace the shortcut comment with the debt-ledger form.
4. N1 to N4 if time allows, N2 before release only if hosting is metered.

## Epic 4 review fixes (2026-11-22)

**S1, fixed in `3d67def`.** A new client component, `DownloadReport`, keeps the plain `<a href>` for no-JS. On click it fetches the report and saves the blob as `toppsvar-bruksrapport.json`. A non-2xx response shows the route's bokmål `message` (or a generic one) in a `danger` Notice, which has `role="alert"`, and the Game page stays put. A network failure shows the shared `NETWORK` message. A redirected response (expired session) navigates to the link, so the server sends the Host to `/logg-inn`. `close.spec.ts` covers a stubbed 404 (alert shown, URL unchanged) and the cleared cookie (lands on `/logg-inn`), on top of the existing download check. The no-JS error limit has a `shortcut:` comment.

**S2, fixed in `3d67def`.** The slow-state text is now a `warning` Notice with `role="status"`: "**Grupperingen tar lengre tid enn vanlig.** Siden oppdateres av seg selv. Stopper grupperingen, fortsetter den der den slapp." Each part is true: the 3 s poll re-renders the page, and past the lease that render queues `resumeIfStale`, which skips Questions that are already done. The `EXPERIENCE.md` row was amended to match, and so were `epic-4-context.md` and TRACE. The node enters the DOM once per stall, so it is announced once. One thing to know: once the resume holds a fresh lease, the next poll hides the Notice again. That was the Story 4.2 behaviour and is unchanged.

**S3, fixed in `3d67def`.** The *in review* panel now has `shortcut: no way forward from in review until Epic 5, add the primary "Gå til gjennomgangen" link here in Story 5.1.` The label matches `EXPERIENCE.md`.

**N1, fixed in `3d67def`.** "Spørsmål" became "Spørsmål i alt". The integration and e2e assertions were updated.

**N2 to N4, skipped.** They were outside the agreed scope (only N1 if it took one line).
