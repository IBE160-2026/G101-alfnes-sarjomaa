---
title: 'Story 2.2: Create Invite links and open Collection'
type: 'feature'
created: '2026-11-22'
baseline_revision: '3d75b1876fc6ca37a44ecca4daa93218c29494f4'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/.docs/implementation-artifacts/epic-2-context.md'
  - '{project-root}/.docs/planning-artifacts/ux-designs/ux-Toppsvar-2026-11-21/DESIGN.md'
  - '{project-root}/.claude/skills/impeccable/reference/craft-floor.md'
warnings: [oversized]
deferred: []
---

<intent-contract>

## Intent

**Problem:** A Host can write Questions but cannot invite anyone: there are no Invite links, no way to open Collection, and the Game page has no *collecting* panel (FR-5). Story 2.1 also deferred an e2e test of the editor's reaction to `WRONG_STATE`, because no screen could move a Game out of *draft* yet.

**Approach:** Add the `invite_link` table and `game.invite_links_issued`, `src/lib/token.ts`, `games.reserveInviteLinks` (the one cap check) and `collection.createInviteLinks`, which in one transaction locks the Game, refuses zero Questions in *draft*, reserves the count, stores only `sha256(token)` per link, moves *draft* → *collecting* on the first batch, and returns the full links once. The Game page gets an Invite link panel in *draft* and *collecting* (ConfirmDialog on the first batch, OnceLinkList with copy and a copy fallback) and a read-only Question list in *collecting*. Story 2.2's five ACs in `epics.md` (repeated below) are the contract; AD-1, AD-4, AD-5, AD-7, AD-8 and AD-17 govern.

## Boundaries & Constraints

**Always:**
- The implementer first invokes `ponytail` (level `full`), then `impeccable` (no launcher: "Launcher unavailable" path; read `reference/craft-floor.md` right before UI edits). *Operate* mode. DESIGN.md and EXPERIENCE.md win. Ponytail never cuts a requirement, validation, error handling, accessibility, anonymity or the tests below.
- **Schema:** `invite_link(token_hash text pk, game_id uuid not null → game.id ON DELETE CASCADE)`, nothing else: no timestamps, no ordinal, no label. `game.invite_links_issued integer not null default 0`. Migration via `npm run db:generate`, committed.
- **`src/lib/token.ts`** (uses `node:crypto`, no server imports): `newToken()` = `randomBytes(32).toString("base64url")`; `sha256(value)` = hex digest. Session code is not changed.
- **Limits** in `src/lib/limits.ts`: `INVITE_LINKS_MAX = 50`.
- **Schema** in `src/lib/invite-link.ts` (pure zod): `createInviteLinksSchema = { gameId: z.string(), count: z.number().int().min(1).max(50) }`, every count failure (also a non-number) with the message "Skriv et tall fra 1 til 50.".
- **`ErrorCode`** gains `LINK_CAP_REACHED`: "Spillet har nådd maks 50 lenker." and `QUESTIONS_REQUIRED`: "Skriv minst ett spørsmål først." (`tests/unit/errors.test.ts` asserts both).
- **`games.reserveInviteLinks(tx, gameId, count) → number`** (exported writer, caller holds the lock): one `UPDATE game SET invite_links_issued = invite_links_issued + count WHERE id = gameId AND invite_links_issued + count <= INVITE_LINKS_MAX RETURNING invite_links_issued`; no row → `LINK_CAP_REACHED`. Returns the new `issued`.
- **`games.getOwned`** also returns `inviteLinksIssued` (only getOwned; `listOwned`'s four keys stay).
- **`questions.count(tx, gameId) → number`**, an exported reader for `collection`.
- **`collection.createInviteLinks(hostId, input) → { links: string[] }`** in `src/server/collection/index.ts` (`import "server-only"`, `withBoundary("collection", "createInviteLinks", …)`), one `db.transaction`: `games.lockForMutation(tx, { hostId, gameId, states: PERMITTED.createInviteLinks })`; in *draft* with `questions.count === 0` → `QUESTIONS_REQUIRED`; `games.reserveInviteLinks`; insert `count` rows of `{ tokenHash: sha256(token), gameId }`; in *draft* `games.transition(tx, gameId, "draft", "collecting")`. Links are `` `${env.APP_BASE_URL without trailing slash}/svar/${gameId}#${token}` ``. Nothing logs a token, hash or link.
- **Action** `createInviteLinks(input: unknown) → Promise<ActionResult<{ links: string[] }>>` in `src/app/spill/[id]/actions.ts`, same shape as `questionAction` (requireHost, module call with raw input, `revalidatePath` on success, `unstable_rethrow` then `toFailure`).
- **Game page** (`src/app/spill/[id]/page.tsx`): the panel becomes an array of **keyed** sections so React keeps the Invite link panel's client state across the draft → collecting refresh: *draft* = `[questions (editor, unchanged), links]`; *collecting* = `[links, questions (read-only)]`. The links section (key `"links"`) has `<h2>` "Lag invitasjonslenker" in *draft* and "Flere lenker" in *collecting* and renders `<InviteLinkPanel gameId state issued questionCount />`. The read-only section has `<h2 id="sporsmal">` "Spørsmål (låst)" and an `<ol>` of Question texts (`questions.list`), no controls. Other states keep no panel.
- **`InviteLinkPanel` (`src/components/InviteLinkPanel.tsx`, client):**
  - Shows "{issued} av maks 50 lenker brukt." At `issued >= 50` the field and button are replaced by "Spillet har nådd maks 50 lenker.".
  - TextField "Antall lenker" (`type="number"`, `inputMode="numeric"`, `min=1`, `max=remaining`, initial "1", narrow) + Button "Lag lenker" (`primary`, pending "Lager lenker …"). Before any request the client checks an integer 1..remaining, else field error `Skriv et tall fra 1 til ${remaining}.` with `aria-invalid` and focus on the field, nothing sent. Server `fieldErrors.count` shows the same way.
  - *draft* with `questionCount === 0`: "Lag lenker" is `aria-disabled="true"`, clicking does nothing, and the visible reason "Skriv minst ett spørsmål først." is its `aria-describedby`.
  - *draft* otherwise: "Lag lenker" is a ConfirmDialog trigger, title "Åpne innsamlingen?", body "Spørsmålene låses når du lager de første lenkene, og kan ikke endres etterpå.", confirm `primary` "Åpne innsamlingen" (pending "Åpner …"). `ConfirmDialog` gains one optional prop `beforeOpen?: () => boolean` (false → not opened), used for the count check. Failures show in a danger Notice inside the dialog, focused.
  - *collecting*: "Lag lenker" calls the action directly; failures show in a danger Notice under the button.
  - Results: ok → the panel shows `<OnceLinkList links onDone />` in place of the field and button, focus moves to its heading. `WRONG_STATE` / `NOT_FOUND` / `LINK_CAP_REACHED` / `QUESTIONS_REQUIRED` → `router.refresh()` plus the message. `INTERNAL` → its message. Rejected call → `unstable_rethrow` then "Fikk ikke kontakt. Sjekk nettet og prøv igjen." (export `NETWORK` from `useFormAction.ts`, do not duplicate it).
  - After `onDone`, the field and button return and focus goes to "Antall lenker".
- **`OnceLinkList` (`src/components/OnceLinkList.tsx`, client; Story 2.7 reuses it):** box `rounded-md border-2 border-warning bg-surface p-6`; `<h3 tabIndex={-1}>` "Kopier lenkene nå"; a warning Notice (add a `warning` tone to `Notice`: `bg-warning-soft text-warning`, `role="status"`) with "Av hensyn til anonymiteten lagrer vi ikke lenkene, så de kan ikke vises igjen. Send én lenke til hver deltaker."; `primary` "Kopier alle"; a list of links, each in system monospace 14 px with `break-all` and a `secondary` "Kopier" (sr-only suffix " lenke N"); one visible `role="status"` line; `secondary` "Jeg har kopiert lenkene" calls `onDone`.
  - Copy: `navigator.clipboard.writeText` (one link, or all joined by `"\n"`). Success → that button reads "Kopiert" for 2 s and the status says "Lenke kopiert." ("Lenkene kopiert." for "Kopier alle" with more than one link). Any failure, including `navigator.clipboard` undefined on plain `http://<LAN-IP>` → the link text (or the whole list, with the buttons `select-none`) is selected with a DOM Range and the status says "Marker og kopier lenken selv.".
  - While mounted it adds a `beforeunload` listener that calls `preventDefault()`; removed on unmount. Links are never re-fetched or stored anywhere (no `localStorage`, no URL).
- **Tests:** titles start with the IDs they prove. Every new Host action gets a foreign-ID case in `authz.test.ts`; `game-state.test.ts` gets the `WRONG_STATE` case. `tests/TRACE.md`: FR-5 rows ("None yet" goes), FR-4 rows for the read-only list and the WRONG_STATE e2e ("Pending: Story 2.2" goes), FR-12 rows, NFR-6 row; update the "Pending" lists. Each e2e test registers its own Host.

**Never:**
- No raw Token, link or hash in any log, Host page render, later response, cookie, `localStorage` or DB column other than `invite_link.token_hash`. No per-link state, label, number or timestamp anywhere (FR-12).
- No ProgressCount, close button, revoke panel or 30 s refresh (Stories 2.6, 2.7, 3.x); no `/svar` route (Story 2.3); no `submission` table.
- No second cap check outside `reserveInviteLinks`, no second lock path, no write to `invite_link` outside `collection`, no state change outside `games.transition`.
- No new dependency, env var or Route Handler. Do not edit `.logs/`, `prompting/`, or this intent contract.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| First batch | draft, 2 Questions, count 3 | 3 links `http://localhost:3000/svar/<gameId>#<43 chars>`; 3 rows with `token_hash = sha256(token)`; state collecting; issued 3 | — |
| More links | collecting, issued 3, count 2 | 2 links; state stays collecting; issued 5 | — |
| No Questions | draft, 0 Questions | `QUESTIONS_REQUIRED` "Skriv minst ett spørsmål først."; nothing changes | inline |
| Cap | issued 48, count 3 / count 2 / then 1 | `LINK_CAP_REACHED`, nothing created, issued 48 / ok, issued 50 / `LINK_CAP_REACHED` | refresh + message |
| Revoked counted | issued 50, rows deleted directly | still `LINK_CAP_REACHED`; issued stays 50 | — |
| Bad count | 0, 51, 1.5, "3", missing | `INVALID_INPUT`, `fieldErrors.count` "Skriv et tall fra 1 til 50.", nothing written | field error |
| Atomic | the state update fails inside the transaction | no rows, issued and state unchanged, `INTERNAL` | message |
| Wrong state | grouping … played | `WRONG_STATE`, nothing changes | refresh + message |
| Foreign | B's Game, random UUID, "abc" | identical `NOT_FOUND`, A's Game unchanged | refresh + message |
| Logged out | no session | redirect `/logg-inn`, nothing written | redirect not swallowed |
| Network | action POST aborted | "Fikk ikke kontakt. Sjekk nettet og prøv igjen.", no links | retry |

</intent-contract>

## Code Map

- `src/server/db/schema.ts` -- add `invite_link` after `question`; add `inviteLinksIssued` to `game`. Primary key on `text` like `session.tokenHash`.
- `src/server/auth/session.ts:19-27` -- the existing sha256/randomBytes pattern to mirror in `src/lib/token.ts` (do not refactor session).
- `src/server/games/index.ts` -- `lockForMutation` (Host call touches `updated_at`, fine), `transition` (compare-and-set), `getOwned` (`summary` select; add `inviteLinksIssued` only there), `deleteOwned` shows the `withBoundary` + `getDb().transaction` pattern. Add `reserveInviteLinks` next to `transition`.
- `src/server/questions/index.ts` -- add `count(tx, gameId)`; `list(hostId, gameId)` works in any state and feeds the read-only list.
- `src/server/env.ts` -- `env.APP_BASE_URL` is always set (defaults to `http://localhost:${PORT}`; vitest leaves it to `http://localhost:3000`).
- `src/lib/game-state.ts` -- `PERMITTED.createInviteLinks = ["draft", "collecting"]` already exists.
- `src/lib/errors.ts`, `src/lib/limits.ts`, `src/lib/question.ts` (schema style) -- add codes, limit, new `src/lib/invite-link.ts`.
- `eslint.config.mjs:11` -- `collection` is already after `questions` in the module order, so `collection` may import `games` and `questions`.
- `src/app/spill/[id]/actions.ts` -- `questionAction` is the pattern for the new action.
- `src/app/spill/[id]/page.tsx:46-62` -- the `switch` with the *draft* case to turn into keyed sections.
- `src/components/ConfirmDialog.tsx` -- add `beforeOpen`; `src/components/DeleteGame.tsx` shows a dialog with a Notice inside. `src/components/Notice.tsx` -- add `warning`. `src/components/Button.tsx` -- `pending`, variants. `src/components/TextField.tsx` -- label/error markup. `src/components/useFormAction.ts` -- export `NETWORK`. `src/components/QuestionEditor.tsx:209-220` -- `showFailure` refresh pattern and the WRONG_STATE path the new e2e test exercises.
- `tests/integration/next-mocks.ts` -- `cookieJar`, mocks; object actions are called directly. `tests/integration/questions.test.ts` -- setup pattern for a Host with a session and a Game. `tests/integration/delete.test.ts` -- renders `GamePage` with `renderToStaticMarkup` in all seven states (must stay green; its cascade walk will find `invite_link`).
- `tests/integration/authz.test.ts` -- "Questions across Hosts" block is the pattern for the foreign-ID case. `tests/integration/game-state.test.ts` -- `setState`, `codeOf`.
- `tests/e2e/questions.spec.ts` -- `createGame`, `addQuestion`, two-page pattern ("deleted in another tab"), `page.route` abort pattern in `tests/e2e/delete.spec.ts`. `tests/e2e/fixtures.ts` -- `registerHost`, `FOCUS_RING`, `seriousViolations`, `tabThrough`.
- `tests/TRACE.md` -- sections `## FR-4`, `## FR-5`, `## FR-12`, `## NFR-6`.

## Tasks & Acceptance

**Execution:**
- `src/lib/token.ts`, `src/lib/limits.ts`, `src/lib/invite-link.ts`, `src/lib/errors.ts` -- token, limit, schema, codes -- AC1, AC2, AC3
- `src/server/db/schema.ts` + `npm run db:generate` -- table, column, migration -- AC2
- `src/server/games/index.ts` -- `reserveInviteLinks`, `inviteLinksIssued` in `getOwned` -- AC3, AC4
- `src/server/questions/index.ts` -- `count` -- AC2
- `src/server/collection/index.ts` -- `createInviteLinks` -- AC2, AC3
- `src/app/spill/[id]/actions.ts` -- `createInviteLinks` -- AC2
- `src/app/spill/[id]/page.tsx`, `src/components/InviteLinkPanel.tsx`, `src/components/OnceLinkList.tsx`, `src/components/ConfirmDialog.tsx`, `src/components/Notice.tsx`, `src/components/useFormAction.ts` -- panel, list, read-only Questions -- AC4, AC5
- `tests/unit/token.test.ts` -- a token decodes to 32 bytes and matches `^[A-Za-z0-9_-]{43}$`; 10 000 tokens have no duplicate; `sha256("abc")` is the known hex vector -- AC1
- `tests/unit/errors.test.ts` -- the two new messages -- AC2, AC3
- `tests/integration/invite-links.test.ts` -- the I/O matrix through the action (atomicity via a temporary trigger that raises on the state update); rows hold only `token_hash` and `game_id`, each `sha256` of a returned token; `updated_at` moves forward; after creation no column of any public table (`row_to_json` scan) contains a returned token, and `renderToStaticMarkup(GamePage)` in *collecting* contains no token and no `/svar/`, lists the Question texts and has no `textarea`, "Flytt opp", "Flytt ned" or "Legg til spørsmål" -- AC2, AC3, AC5
- `tests/integration/game-state.test.ts` -- `createInviteLinks` in each state after *collecting* is `WRONG_STATE`, nothing changes -- AD-4
- `tests/integration/authz.test.ts` -- B's `createInviteLinks` on A's Game, a random UUID and `"abc"` → identical `NOT_FOUND`, A's state, issued, rows and `updated_at` unchanged -- AD-5
- `tests/e2e/invite-links.spec.ts` -- (a) zero Questions: "Lag lenker" `aria-disabled` described by the reason, click opens nothing; (b) one Question, count 3: dialog with the exact title and body, "Avbryt" focused, Esc keeps *Utkast*; confirm → "Kopier lenkene nå" focused, the notice text, 3 links of the right shape, badge "Samler inn", "Spørsmål (låst)" with no textarea or move/delete buttons, heading "Flere lenker"; (c) with clipboard permissions, "Kopier" on link 2 → "Kopiert", "Lenke kopiert.", clipboard equals link 2, label back to "Kopier" after 2 s; "Kopier alle" → clipboard is the links joined by newlines; (d) `page.close({ runBeforeUnload: true })` before "Jeg har kopiert lenkene" raises a `beforeunload` dialog (dismissed); after it, a reload shows no link or `/svar/` anywhere and "3 av maks 50 lenker brukt."; (e) in *collecting* 2 more links with no dialog, then "5 av maks 50 lenker brukt."; (f) clipboard failing (init script) → "Marker og kopier lenken selv." and the selection equals the link; (g) count 0 → field error with `aria-invalid`, no POST; (h) 50 in one batch → after done, "Spillet har nådd maks 50 lenker." and no field; (i) **Story 2.1 deferral:** an edited Question blurred in tab A after tab B opened Collection refreshes tab A to "Samler inn" with the locked list holding the old text; (j) aborted create POST → the network message, no links; (k) axe has no serious or critical violations on the draft panel, the open dialog, the OnceLinkList and the *collecting* page; Tab reaches "Kopier alle", each "Kopier" and "Jeg har kopiert lenkene" with the focus ring -- AC4, AC5, NFR-6
- `tests/TRACE.md` -- rows as listed under Always -- epic rule

**Acceptance Criteria (from epics.md, the contract):**
- AC1 (FR-5, NFR-3 · unit): Given `src/lib/token.ts`, when Tokens are generated, then each is 32 bytes from `crypto.randomBytes`, base64url-encoded (at least 128 bits), and a large generated sample has no duplicates, and the stored form is `sha256(token)`.
- AC2 (FR-5 · integration): Given a *draft* Game with at least one Question, when the Host creates N links, then N `invite_link` rows hold only `token_hash`, the response returns N full links `<APP_BASE_URL>/svar/<gameId>#<token>`, and the Game moves from *draft* to *collecting* in the same transaction; with zero Questions the request is refused ("Skriv minst ett spørsmål først."), and in *collecting* more links are added without a transition.
- AC3 (FR-5 · integration): Given a Game whose `invite_links_issued` plus the requested number would exceed 50, when the Host creates links, then the request is refused with `LINK_CAP_REACHED` and nothing is created; `invite_links_issued` counts every link ever created, revoked ones included.
- AC4 (FR-5, UX-DR7, UX-DR8 · e2e): Given the "Lag invitasjonslenker" panel, when the Host creates the first links in *draft*, then a ConfirmDialog asks "Åpne innsamlingen? Spørsmålene låses når du lager de første lenkene, og kan ikke endres etterpå."; after confirming, the OnceLinkList "Kopier lenkene nå" shows the links with "Kopier" and "Kopier alle" ("Kopiert" for 2 s and a live "Lenke kopiert."), and leaving before "Jeg har kopiert lenkene" triggers the leave-page warning; after a reload the links are not shown again anywhere, and the panel reads "{issued} av maks 50 lenker brukt."
- AC5 (FR-4, FR-12 · e2e + integration): Given a Game that has moved to *collecting*, when the Host views the Game page, then the Questions are listed read-only with no edit controls, and no Host page, response after creation, or DB column holds a raw Token.

## Spec Change Log

## Review Triage Log

### 2026-11-22 — Review pass
- verdicts: 30 findings — high 0, medium 6, low 15, false 9, maybe-false 0
- findings:
  - `[false]` `[reject]` Blind Hunter: the count re-check in `create()` can fail inside the dialog with the error hidden behind the modal — in *draft* `issued` is always 0 (links exist only in *collecting*), the field is inert while the modal is open, and a refresh that changes `issued` also flips the state and unmounts the dialog, so the re-check cannot fail there.
  - `[low]` `[reject]` Blind Hunter: Esc or "Avbryt" during the pending request hides a later failure in the closed dialog — needs a cancel inside a sub-second local request; the fix adds a pending guard to the shared ConfirmDialog or a second notice slot.
  - `[medium]` `[patch]` Blind Hunter: after "Jeg har kopiert lenkene" on a batch reaching 50, focus fell to `<body>` — the cap sentence now has `tabIndex={-1}` and takes focus; the 50-link e2e asserts it.
  - `[medium]` `[patch]` Blind Hunter: copying link 1 then link 2 set the same "Lenke kopiert." and screen readers heard nothing — `copy()` clears the status before the await, so each success re-announces.
  - `[low]` `[patch]` Blind Hunter: `beforeunload` relied on `preventDefault()` only — `event.returnValue = ""` added for older Safari and Chromium.
  - `[low]` `[reject]` Blind Hunter: no index on `invite_link.game_id` — at most 50 rows per Game, deleted at close; the cascade scan is negligible at pilot scale.
  - `[low]` `[reject]` Blind Hunter: `reserveInviteLinks` returns `issued` that nobody uses — the spec defines the return for Story 2.7's replacement path; one returned column costs nothing.
  - `[low]` `[reject]` Blind Hunter: "50" typed into two messages — same convention as Story 2.1's "1–200" and Epic 1's "1–80" (Story 2.1 triage, ponytail item 10).
  - `[low]` `[reject]` Blind Hunter: a blur save and `createInviteLinks` race in the same tab, and with the first Question unsaved the first click on "Lag lenker" does nothing — the race cannot happen (Next runs a client's Server Actions one at a time and the save leaves on the trigger's mousedown, before the dialog opens); the first-click case is real but the button enables after the save's refresh, and fixing it means sharing unsaved-draft state across two components.
  - `[medium]` `[patch]` Blind Hunter: several panel paths have no e2e — grouped with the three verification-gap rows below; tests added there.
  - `[low]` `[reject]` Blind Hunter: `createGame`/`addQuestion` copied into the new spec — `questions.spec.ts`'s helpers depend on its local locators; moving them is a refactor of an untouched spec.
  - `[false]` `[reject]` Blind Hunter: `revalidatePath` reads `gameId` through a cast — the module validated `gameId` as a string and `lockForMutation` accepted it before the line runs (same refutation as Story 2.1).
  - `[false]` `[reject]` Blind Hunter: spec `context` lacks EXPERIENCE.md — the fix edits this build's spec; EXPERIENCE.md's rules are distilled into the spec body.
  - `[medium]` `[patch]` Verification gap: the panel's domain-error path (Notice + refresh) was never exercised — new e2e: a stale tab asking past the cap gets a focused alert "Spillet har nådd maks 50 lenker." and refreshes to "48 av maks 50 lenker brukt.".
  - `[medium]` `[patch]` Verification gap: the remainder check was only tested at 50 — same e2e: 48 with 3 issued shows "Skriv et tall fra 1 til 47." with `aria-invalid` and no POST.
  - `[low]` `[patch]` Verification gap: the "Kopier alle" fallback was untested — the clipboard-failing e2e now asserts the status and a selection holding all 50 links and no "Kopier".
  - `[low]` `[reject]` Edge Case Hunter: Esc/Avbryt while pending — same as the Blind Hunter row above.
  - `[low]` `[reject]` Edge Case Hunter: `WRONG_STATE` in the dialog from a stale draft tab unmounts the dialog and drops focus — rare two-tab case; the message stays visible under the button, and the fix needs a focus effect keyed on the state flip.
  - `[medium]` `[patch]` Edge Case Hunter: focus lost at the cap after done — same as the Blind Hunter row.
  - `[low]` `[patch]` Edge Case Hunter: a network rejection after the server committed left a stale page — the null result now calls `router.refresh()` before showing the network message.
  - `[low]` `[patch]` Edge Case Hunter: two pending copies orphaned the first "Kopiert" timer — `clearTimeout` right before the new timer.
  - `[low]` `[reject]` Intent alignment: in-app links do not raise the leave-page warning — AC4 and EXPERIENCE.md ask for the browser's leave-page warning, which is delivered; the limit carries a `shortcut:` comment and lost links can be replaced by new ones.
  - `[low]` `[reject]` Intent alignment: "Kopier alle" with several links announces "Lenkene kopiert." — the AC's "Lenke kopiert." is kept for one link; the plural is the honest sentence for many and is recorded in the spec.
  - `[false]` `[reject]` Intent alignment: the client stops a count above the remainder before `LINK_CAP_REACHED` — AC3 is an integration criterion and holds at the server (tested); EXPERIENCE.md bounds the field to "1 to the remaining of 50".
  - `[false]` `[reject]` Intent alignment: revoked links are simulated by deleting rows — revoke does not exist until Story 2.7; deleting the row is exactly what revoke will do, and the counter never decrements.
  - `[false]` `[reject]` Intent alignment: rows hold `game_id` besides `token_hash` — AD-7 looks links up by `(token_hash, game_id)` and the cascade needs the key; no Token or identifying data is stored.
  - `[false]` `[reject]` Intent alignment: only the Game page is checked for Tokens — no Token is stored anywhere (the full-table scan proves it), so no other Host page has a source to render one from.
  - `[low]` `[patch]` Intent alignment: `issued` comes from `getOwned`, not `collection.progress`, and a comment cited AD-7 — the `getOwned` choice is a recorded design note (Story 2.6 adds `progress`); the comment now cites AD-8.
  - `[false]` `[reject]` Intent alignment: the dialog splits the question into title and body — the AC text is shown verbatim as the dialog's accessible name and description, which the e2e test asserts.
  - `[false]` `[reject]` Intent alignment: behaviour beyond the five ACs — it comes from the UX-DRs and EXPERIENCE.md rows the story references (and the Story 2.1 deferral the task named); not a defect.

### AI suggestions corrected or rejected (grading evidence)

- **Orchestrator corrected the implementer** after review: focus was lost at the 50-link cap, repeated copies were silent to screen readers, a network failure after commit left a stale page, a copy timer could reset early, `beforeunload` lacked `returnValue`, and a comment cited the wrong AD. Three test gaps were closed: the panel's server-error path from a stale tab, the remainder check below 50, and the "Kopier alle" fallback selection.
- **Planning corrected by the orchestrator:** the obvious design (a plain panel per state) would remount the panel when the first batch refreshes the page to *collecting* and silently drop the only copy of the links; the spec required keyed sections, and the e2e test shows links and "Samler inn" together. Showing the cap message for a count above the remainder was rejected as misleading in favour of the field error with the real remainder.
- **Reviewer suggestions rejected:** a pending guard in ConfirmDialog, a `game_id` index, dropping the unused return, messages built from constants, moving e2e helpers, a focus effect for a two-tab race, intercepting in-app navigation, shared unsaved-draft state for the first click, and nine claims refuted outright (dialog re-check, the cast, spec context, cap surface, revoke simulation, `game_id`, other Host pages, the dialog's title/body split, behaviour beyond the ACs). Reasons are in the rows above.
- **Implementer departures accepted:** `aria-disabled` styling on Button (DESIGN.md), and a `useRouter` stub in `next-mocks.ts` so the Game page renders in integration tests.

## Design Notes

- **Keyed sections keep the links alive.** The action revalidates the page, which arrives in *collecting* with a different panel. If the Invite link panel were remounted, its `links` state, which exists nowhere else by design, would vanish before the Host copied anything. Rendering the panel as one keyed element (`key="links"`) in the same parent array in both states lets React match it across the refresh and keep the state. The e2e test (b) proves it: links and the "Samler inn" badge are visible together.
- **Copy for a count above the remainder.** EXPERIENCE.md gives no message for asking for more links than are left. The client reuses the schema's sentence with the real remainder ("Skriv et tall fra 1 til 7."), so the cap message stays reserved for the real cap and a stale tab still gets `LINK_CAP_REACHED` from the server.
- **Leave-page warning is the browser's.** `beforeunload` covers reload, closing the tab and typing a new URL, as AC4 asks. Next's client-side links (breadcrumb, top bar) do not fire it; that limit gets a `shortcut:` comment in `OnceLinkList`.
- **`issued` from `getOwned`.** The page already reads the owned Game; adding one column there avoids a second query. Story 2.6's `collection.progress` adds the counts that need `invite_link` and `submission`.

## Verification

**Commands:**
- `npm run lint && npm run format:check && npm run typecheck` -- expected: exit 0
- `npm test` -- expected: all pass offline
- `npm run test:e2e` -- expected: all specs pass
- `npx drizzle-kit check` and a second `npm run db:generate` -- expected: no new migration

**Manual checks:**
- The *draft* and *collecting* Game page at 1280 and 375 px with the OnceLinkList holding 3 and 50 links: links wrap without horizontal scroll, monospace 14 px, warning border, buttons at least 44 px.

## Auto Run Result

Status: done

**Summary.** A Host creates personal Invite links on the Game page. The first batch in *draft* asks "Åpne innsamlingen?" in a ConfirmDialog, then one transaction locks the Game, refuses zero Questions ("Skriv minst ett spørsmål først."), reserves the count against the 50-link cap in `games.reserveInviteLinks`, stores only `sha256(token)` per link and moves the Game to *collecting*. The links `<APP_BASE_URL>/svar/<gameId>#<token>` exist only in that response and in the OnceLinkList ("Kopier", "Kopier alle", "Kopiert" for 2 s, "Lenke kopiert.", a select-the-text fallback "Marker og kopier lenken selv." when the Clipboard API is missing, and a `beforeunload` warning until "Jeg har kopiert lenkene"). After that they are gone: the panel reads "{issued} av maks 50 lenker brukt." In *collecting* the Questions are a read-only list and more links need no dialog. The Story 2.1 deferral is closed: an e2e test edits a Question in a stale tab after another tab opened Collection and sees the refresh to the locked list.

**Files.**
- `src/server/db/schema.ts`, `drizzle/0004_medical_nebula.sql` + meta: `invite_link(token_hash pk, game_id → game cascade)`, `game.invite_links_issued`.
- `src/lib/{token,invite-link,limits,errors}.ts`: Token and hash, count schema, `INVITE_LINKS_MAX`, `QUESTIONS_REQUIRED`, `LINK_CAP_REACHED`.
- `src/server/games/index.ts`: `reserveInviteLinks`; `getOwned` also returns `inviteLinksIssued`.
- `src/server/questions/index.ts`: `count(tx, gameId)` reader.
- `src/server/collection/index.ts`: `createInviteLinks`.
- `src/app/spill/[id]/actions.ts`, `src/app/spill/[id]/page.tsx`: action; keyed sections for *draft* and *collecting*, read-only Questions.
- `src/components/InviteLinkPanel.tsx`, `src/components/OnceLinkList.tsx`: panel and once-only list; `ConfirmDialog` (`beforeOpen`), `Notice` (`warning`), `Button` (`aria-disabled` style), `useFormAction` (`NETWORK` exported).
- Tests: `tests/unit/token.test.ts`, `tests/integration/invite-links.test.ts`, `tests/e2e/invite-links.spec.ts`; additions to `errors.test.ts`, `game-state.test.ts`, `authz.test.ts`; `useRouter` stub in `next-mocks.ts`; `tests/TRACE.md` FR-4, FR-5, FR-12, NFR-6 rows.
- `ARCHITECTURE-SPINE.md`: the `questions` row lists `count` (read) as an export to other modules.

**Review.** 30 findings (high 0, medium 6, low 15, false 9). Patched 9 entries (medium 4 entries from 6 medium rows, low 5). Deferred 0. Rejected 13 low or false rows with reasons in the triage log.

**Follow-up review recommended: true.** Four medium entries were patched (focus at the cap, silent repeated copies, the panel's server-error path, the remainder check). The unverified risk: with `navigator.clipboard` undefined, `writeText` throws synchronously, so clearing and re-setting "Marker og kopier lenken selv." land in one render and a repeated fallback may not re-announce; and the keyed-section state survival and dialog unmount on success are proven only in Chromium.

**Verification.** `lint`, `format:check`, `typecheck` clean; `npm test` 294 passed in 27 files; `npm run test:e2e` 60 passed; `drizzle-kit check` clean and a second `db:generate` produced nothing. All offline, no key. The implementer checked the panel at 1280 and 375 px with 3 and 50 links (no horizontal scroll, 14 px monospace, 44 px buttons).

**Residual risks.** In-app links (breadcrumb, top bar) do not raise the leave-page warning (`shortcut:` comment in `OnceLinkList`); a cancel during a pending create hides a later failure; a two-tab `WRONG_STATE` in the dialog drops focus; a lost response after commit loses that batch's links (they count against the cap; Story 2.7 revoke and new links recover).

**Spine amendments.** One: `questions` exports `count` (read) to `collection`. `issued` is read through `games.getOwned` until Story 2.6 adds `collection.progress`.
