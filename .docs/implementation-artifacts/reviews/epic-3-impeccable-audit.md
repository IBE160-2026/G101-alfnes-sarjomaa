# Epic 3 design audit (impeccable audit + harden)

Branch `epic-3-lukking`, scope `git diff epic-2-innsamling..epic-3-lukking`. Mode: Operate. Source audit only: no server was started, so contrast, focus order and layout are judged from code and from the contract's own contrast table, not from a render. Launcher unavailable (see `VENDORED.md`), so context was read directly. Contract: `DESIGN.md` and `EXPERIENCE.md` in `ux-designs/ux-Toppsvar-2026-11-21/`. Craft floor and `copy-tells.md` were read.

## Scope notes

- UI added by the diff: `src/components/CloseCollection.tsx` (new), the `grouping` panel in `src/app/spill/[id]/page.tsx:130-143`, and the `TOO_FEW_ANSWER_SETS` message in `src/lib/errors.ts`.
- The Participant closed pages (`LinkStatus.tsx`, `AnswerForm.tsx` closed phase, `svar/[gameId]/page.tsx`) were **not changed** in this diff; Epic 3 only changed the server side. They were still audited because the task lists them, and findings on them are marked "pre-existing".
- Grouping does not run until Story 4.2. The `shortcut:` comment at `page.tsx:132` is declared and is not counted as a defect by itself. Finding M2 is about what the host sees meanwhile.

## Health score

| # | Dimension | Score | Key finding |
|---|-----------|------:|-------------|
| 1 | Accessibility | 3 | Dialog can be dismissed mid-action, hiding the result; focus is dropped on a state swap |
| 2 | Performance | 4 | Nothing heavy; no animation added |
| 3 | Theming | 4 | Tokens only, no hard-coded colour in the diff |
| 4 | Responsive | 4 | `min-h-11` on every control; dialog is `w-[calc(100%-2rem)] max-w-120` |
| 5 | Implementation integrity | 3 | Copy matches the contract; the pending and failure paths are thin |
| | **Total** | **18/20** | Good. Two must-fix items, both about states, not looks. |

## Must

**M1. The confirm dialog can be dismissed while the close is running, and then any failure is invisible.**
`src/components/ConfirmDialog.tsx:45-66` (Avbryt, Esc and the native `<dialog>` cancel are always live) and `src/components/CloseCollection.tsx:114-118` (the failure `Notice` renders inside the dialog). While `pending` is true the host can press Esc or "Avbryt"; the dialog closes, `onClose` moves focus to the trigger, and when the action then fails (`INTERNAL`, `NETWORK`) the `Notice` is in a closed dialog and nobody sees it. The trigger is enabled again, so the host does not know whether the Game closed. This gets worse in Story 4.2, because `page.tsx:19` says the action's `maxDuration` is 300 s and Grouping runs after close.
Fix: give `ConfirmDialog` a `busy?: boolean` prop. While busy, `onCancel` calls `preventDefault()` and "Avbryt" gets `aria-disabled="true"` (not `disabled`, per EXPERIENCE Button rule). `CloseCollection` passes `busy={pending}`. Keep the failure inside the dialog.

**M2. The grouping panel is a dead end and its promise is not true yet.**
`src/app/spill/[id]/page.tsx:130-143`. After a successful close the Game sits in *grouping* forever: no judge runs, nothing polls, and the page tells the host "Det tar vanligvis under to minutter". The contract's slow or interrupted state (EXPERIENCE line 369: "Grupperingen tar lengre tid enn vanlig. Last inn siden på nytt.") is missing, and so is any hint that a reload is the way forward. The Game is the only thing in this state that cannot be left except by deleting it.
Fix before the 1 Dec freeze: land Story 4.2, or until then add a second sentence from the contract ("Grupperingen tar lengre tid enn vanlig. Last inn siden på nytt.") so the host has a recovery path. Do not demo Epic 3 alone with the current text.

## Should

**S1. After a successful close, focus goes to the `<h1>` (the Game title), so a screen reader hears nothing about the new state.**
`CloseCollection.tsx:39-47`. The Game title is announced, but the new "Gruppering" section and the badge change are silent. Fix: focus the section heading instead: give `<h2 id="gruppering">` (`page.tsx:135`) `tabIndex={-1}` and have the cleanup focus `#gruppering` when it exists, falling back to `h1`. This matches the way `InviteLinkView` and `RouteFocus` already restore focus.

**S2. A branch swap remounts the control and drops focus, and `acted` stays true.**
`CloseCollection.tsx:66-82` versus `85-119`. The disabled and enabled branches render different component types under the same `div`, so React remounts them. Two cases: (a) the 30 s refresh (`CollectingRefresh`) flips `canClose` false to true while the host has the disabled button focused, and focus falls to `<body>`; (b) after a `TOO_FEW_ANSWER_SETS` rejection (`:58-60`) the component stays mounted but the dialog is gone, so focus is lost and `acted.current` stays `true`, so a later unmount (breadcrumb click) runs the cleanup at `:39-47` and focuses an old `<h1>`.
Fix: render one `<ConfirmDialog>`-less wrapper with a stable `Button` and swap only its `onClick`/`aria-disabled`, or reset `acted.current = false` in a `useEffect` keyed on `canClose` and call `triggerRef.focus()` where the trigger survives. Do not add a live region for the flip; ProgressCount is silent on purpose (EXPERIENCE ProgressCount row).

**S3. The offline path refreshes the router and marks `acted`.**
`CloseCollection.tsx:58-60`. `!result` means the request never arrived, so `router.refresh()` will fail too, and `acted` is set for nothing. Fix: only set `acted` and refresh for `REFRESH_ON` codes; for `!result` show `NETWORK` and stay. (A rejected call "may still have committed", per the comment, which is true for a timeout. The refresh is cheap, but it should not arm the focus cleanup.)

## Nice

**N1. The disabled trigger still darkens on hover.** `src/components/Button.tsx:11` has `hover:bg-primary-hover` and nothing cancels it under `aria-disabled`, so `CloseCollection.tsx:66-82` looks pressable. Fix: `hover:not-aria-disabled:bg-primary-hover` (and the same for the other variants).

**N2. "Dette kan ikke angres." is plain body text.** `CloseCollection.tsx:106`. DESIGN.md assigns `warning` / `warning-soft` to "cannot be undone" hints. Fix: wrap the first paragraph in `<Notice tone="warning">` (role `status`, so not announced twice with the dialog description).

**N3. The failure `Notice` sits inside the dialog's `aria-describedby` region** (`ConfirmDialog.tsx:51`, `:57`), and it is `role="alert"` and focused. A screen reader may read the failure twice. Fix: move `id={...-body}` onto a wrapper around `children` that excludes the failure, or drop the focus call at `CloseCollection.tsx:36` and rely on `role="alert"`.

**N4. Pending label uses a normal space before the ellipsis.** `CloseCollection.tsx:98` "Stenger …" versus the no-break space at `page.tsx:139`. Width is locked by the grid in `Button.tsx`, so this is cosmetic: use `Stenger&nbsp;…` as a string literal `"Stenger …"`.

**N5. Pre-existing: the "closed during editing" view has no heading and a stale title.** `AnswerForm.tsx:255-260` renders only the danger `Notice`, so the page has no `<h1>` and the tab title still reads "{Game title} – Toppsvar" (only `LinkStatus` sets the closed title). This is likely to trip the A5 axe run (no `page-has-heading-one`). Fix: render `<LinkStatus status="closed" />` copy, or add an `<h1>` "Innsamlingen er stengt." above the Notice and set the title.

## Checked and fine

- **Tokens:** all colour, type and radius classes come from the theme (`bg-primary`, `text-title`, `rounded-lg`, `shadow-xl`, `backdrop:bg-ink/55`). No hex in the diff.
- **Contrast:** reason text is `ink` on `paper`; the grouping panel is body text on `paper`; the failure Notice is `danger` on `danger-soft`. All are covered by the DESIGN.md contrast table. The 60 % opacity disabled button is exempt from SC 1.4.3 and its reason is visible text, as the contract asks.
- **Keyboard path:** trigger, then `showModal()`, focus on "Avbryt" (`ConfirmDialog.tsx:30-33`), Esc cancels, focus returns to the trigger via `onClose`, global 3 px `:focus-visible` ring. The disabled trigger is focusable and linked to its reason with `aria-describedby` (`CloseCollection.tsx:73`).
- **Touch targets:** `min-h-11` on `Button`.
- **Error association:** server failure is a `Notice tone="danger"` with `role="alert"`, cleared on re-open (`beforeOpen`) and focused on arrival.
- **Anonymity (FR-8):** `canClose` is a boolean from `progress.submissions !== FEWER_THAN_3`; the UI never receives the exact count below three. `TOO_FEW_ANSWER_SETS` says "minst 3", not the real number.
- **Copy against the contract, verbatim:** dialog title "Stenge innsamlingen?", body "Dette kan ikke angres. Lenkene slutter å virke, og svarene grupperes.", no-key line "Ingen KI-nøkkel er satt opp, så du grupperer for hånd i gjennomgangen.", refusal text, and the Judge introduction "Dommeren, en KI-modell, grupperer svarene … Det tar vanligvis under to minutter." Term map respected (dommeren, gruppering, verten). No copy-tells: no em dashes, no stock lines, no invented figures.
- **Not in scope but correct:** the Participant closed page (`LinkStatus`) matches EXPERIENCE line 376 word for word, clears the stored draft and secret only for the same Token, and `ParticipantChrome` carries no link to a Host page.
- **Loading:** `spill/[id]/loading.tsx` delays its skeleton 300 ms with no fade; the spinner in `Button.tsx` has `motion-reduce:animate-none`.

## Not verified

No render was run: focus order, the real contrast values, dialog layout at 320 px and at 200 % zoom, and the axe result on the closed pages (A5) need a browser pass.
