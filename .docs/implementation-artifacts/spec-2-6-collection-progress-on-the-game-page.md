---
title: 'Story 2.6: Collection progress on the Game page'
type: 'feature'
created: '2026-11-22'
baseline_revision: 'ee517a64de97577d24490b29468473074c7c1e76'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/.docs/implementation-artifacts/epic-2-context.md'
  - '{project-root}/.docs/implementation-artifacts/spec-2-2-create-invite-links-and-open-collection.md'
  - '{project-root}/.docs/planning-artifacts/ux-designs/ux-Toppsvar-2026-11-21/DESIGN.md'
  - '{project-root}/.claude/skills/impeccable/reference/craft-floor.md'
warnings: [oversized]
deferred:
  - summary: >-
      The progress revoke cases use a raw DELETE; the real revoke (Story 2.7) also creates a replacement link and bumps issued.
    evidence: |-
      tests/integration/collection.test.ts revokes with `revoke(token)`, a direct DELETE of the invite_link row. Story 2.7's `games.reserveInviteLinks` path adds one link and increments issued, so after a real revoke `active` stays the same, `issued` grows by one and the count can drop. Add a progress case through the real revoke action when Story 2.7 lands.
    location: >-
      tests/integration/collection.test.ts
    severity: low
  - summary: >-
      EXPERIENCE.md UJ-5 step 3 shows "K av N svar mottatt" on "Mine spill", but the Game list rules give rows only title, StatusBadge and "Sist endret".
    evidence: |-
      EXPERIENCE.md line 507 (UJ-5, demo mode) contradicts the Game list rule at line 247. Story 2.6 is scoped to the Game page and its AC3 pins the Game list as unchanged. Settle the wording when the demo-mode story (Epic 7) is planned.
    location: >-
      .docs/planning-artifacts/ux-designs/ux-Toppsvar-2026-11-21/EXPERIENCE.md:507
    severity: low
---

<intent-contract>

## Intent

**Problem:** While a Game is *collecting*, the Host cannot see how many Answer sets have come in (FR-8), and the page reads `issued` straight off `games.getOwned`, a stopgap Story 2.2 left "until Story 2.6 adds `collection.progress`". The count itself is an anonymity risk: an exact small number, or a count that animates or is announced the moment a set arrives, lets the Host time a submission against a message they sent (FR-8, FR-12).

**Approach:** Add the owner-checked read `collection.progress(hostId, gameId)` returning `{ active, issued, submissions }`, with `submissions` the literal `"fewer-than-3"` below three. The Game page reads it on every load in *draft* and *collecting*, feeds `issued` to the Invite link panel from it (replacing `game.inviteLinksIssued`), and in *collecting* shows a static ProgressCount in an "Innsamling" section, refreshed by `router.refresh()` every 30 s (AD-17). The three ACs of Story 2.6 in `epics.md` (repeated below) are the contract. AD-8 governs.

## Boundaries & Constraints

**Always:**
- The implementer first invokes `ponytail` (level `full`), then `impeccable` (no launcher: "Launcher unavailable" path; read `reference/craft-floor.md` right before the UI edit). *Operate* mode. DESIGN.md and EXPERIENCE.md win on conflict. Every Norwegian string below is fixed copy: use it verbatim. Ponytail never cuts a requirement, validation, anonymity, accessibility or a test listed here.
- **Limits** (`src/lib/limits.ts`): `SUBMISSIONS_MIN = 3` (one-line comment: the FR-8 count floor, and the FR-10 close floor Story 3.1 reuses) and `COLLECTING_REFRESH_MS = 30_000` (AD-17).
- **Server read** (`src/server/collection/index.ts`): `export const FEWER_THAN_3 = "fewer-than-3"` and `progress(hostId: string, gameId: string): Promise<{ active: number; issued: number; submissions: number | typeof FEWER_THAN_3 }>` inside `withBoundary("collection", "progress", …)`:
  - Owner check and `issued` through `games.getOwned(hostId, gameId)` (the pattern of `questions.list`): missing, foreign and malformed IDs are its one `NOT_FOUND` (AD-5). `issued` = its `inviteLinksIssued`; `games` keeps owning the `game` table (AD-1).
  - One query on collection's own tables: `invite_link` where `game_id = gameId`, left-joined to `submission` on `token_hash`; `active` = count of links, the submission count = count of joined submissions (drizzle `count()`).
  - `submissions` = `FEWER_THAN_3` when the count is below `SUBMISSIONS_MIN`, else the count. The exact number below three never leaves the function.
  - A read: no lock, no write, no `updated_at`. No state filter (in *draft* every count is 0).
- **Game page** (`src/app/spill/[id]/page.tsx`), branch `draft || collecting`:
  - `const progress = await collection.progress(hostId, game.id)`; `InviteLinkPanel` gets `issued={progress.issued}`. Nothing on the page reads `game.inviteLinksIssued` any more.
  - In *collecting* the keyed sections are, in this order: `progress`, `links`, `locked`. Keep the existing `links` key and markup so the panel's once-only links survive.
  - The `progress` section: `<section aria-labelledby="innsamling" className="mt-10">` with `<h2 id="innsamling" className="text-heading">Innsamling</h2>`, then `<ProgressCount active={progress.active} submissions={progress.submissions} />` and `<CollectingRefresh />`.
- **`src/components/ProgressCount.tsx`** (no `"use client"`): a `<p>` whose text is exactly "færre enn 3 av N svar mottatt" or "K av N svar mottatt" (N = `active`, K = `submissions`), with the figure ("færre enn 3" or K) in a `<span className="text-display">` and the rest in body type beside it, wrapping cleanly at 360 px. Below it a `<p className="text-body-sm text-ink-muted">` "Du ser bare antallet, aldri hvem som har svart." No progress bar or `<meter>`, no `role`, no `aria-live`, no transition or animation class (UX-DR6).
- **`src/components/CollectingRefresh.tsx`** (`"use client"`, renders `null`): `useEffect` with `setInterval(() => router.refresh(), COLLECTING_REFRESH_MS)` and `clearInterval` in its cleanup. Mounted only in the *collecting* section, so polling stops with the state.
- **Spine** (`ARCHITECTURE-SPINE.md`, AD-8 "Host reads" bullet): replace `collection.progress(gameId)` with `collection.progress(hostId, gameId)`, owner-checked through `games.getOwned` (`NOT_FOUND` for missing, foreign and malformed IDs, AD-5), returning `{ active, issued, submissions }` with `submissions` the literal `"fewer-than-3"` below three and never the exact number; the Game page reads `issued` only from it. Keep the bullet's last sentence.
- **Tests**: titles start with the IDs they prove. Each e2e test registers its own Host; a participant context is made with `browser.newContext({ baseURL })` and `localOnly(context)` (pattern: `tests/e2e/games.spec.ts:144`). In `tests/TRACE.md` replace FR-8's "None yet." and "Pending: Story 2.6." with the new rows, add an FR-12 row and remove "2.6" from FR-12's Pending list.

**Never:**
- Never return, render, log or put in an attribute the exact submission count below three. Never show which link was used, when, or in which order; no per-link row, timestamp, "last answer" or "who hasn't answered" (FR-11 to FR-13, EXPERIENCE anonymity rules 2 and 7).
- No `aria-live`, `role="status"`, toast, animation, transition or progress bar on the count. No polling outside *collecting*, no websocket, no client data library, no Route Handler or Server Action for progress (AD-17: pages read in server components).
- No new table, column, migration, error code, env var or dependency. No close button, revoke panel or "Erstatt en tapt lenke" (Stories 2.7, 3.1). Do not edit `.logs/`, `prompting/`, or this intent contract.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| No submissions | *collecting*, 4 links, 0 sets | `{ active: 4, issued: 4, submissions: "fewer-than-3" }` | — |
| One and two sets | 1, then 2 submissions | `submissions: "fewer-than-3"` both times | — |
| Three and four | 3, then 4 submissions | `submissions: 3`, then `4` | — |
| Changed set | a link resubmits with new Answers | count unchanged | — |
| Revoked link with a set | 4 sets, one link row deleted (cascade) | `active: 3, issued: 4, submissions: 3` | — |
| Revoke drops below three | 3 sets, one link with a set deleted | `submissions: "fewer-than-3"` | — |
| *draft* Game | no links | `{ active: 0, issued: 0, submissions: "fewer-than-3" }` | — |
| Foreign / random / malformed ID | Host B on A's Game, random UUID, `"abc"` | rejects | one identical `NOT_FOUND` |

</intent-contract>

## Code Map

- `src/server/games/index.ts:66-80`: `getOwned` already returns `inviteLinksIssued` with the owner check and UUID guard; reuse it, do not change it.
- `src/server/questions/index.ts:71`: `list` calls `games.getOwned` as its owner check: the pattern to copy.
- `src/server/collection/index.ts`: add `progress` after `createInviteLinks`; imports `inviteLink`, `submission`, `getDb`, `withBoundary`, `games` are already there; add `count` from `drizzle-orm`.
- `src/app/spill/[id]/page.tsx:52-91`: the `draft || collecting` branch; `issued={game.inviteLinksIssued}` at 63 is the stopgap to replace; the `collecting` array at 78-91 gets the `progress` section first.
- `src/components/InviteLinkPanel.tsx:22-31`: `issued` prop, unchanged; "N av maks 50 lenker brukt." at 201.
- `src/components/RouteFocus.tsx`: moves focus only on a pathname change, so `router.refresh()` never moves focus.
- `src/app/globals.css:44-56`: `text-display` (32 px) and `text-body` tokens.
- `src/app/spill/page.tsx`: the Game list with "Sist endret" from `updatedAt`, rendered by `GamesPage()` in `tests/integration/authz.test.ts:323`.
- `tests/integration/collection.test.ts`: `collectingGame(title, count)` (63) gives `gameId`, Question `ids`, Tokens; `revoke(token)` (88); `submitAnswerSet` is imported; `describe("submitAnswerSet")` has `fullSet`. Add `describe("progress")` for AC1 and AC3 here.
- `tests/integration/invite-links.test.ts:255-279`: renders `GamePage` and expects "3 av maks 50 lenker brukt."; must stay green through `progress.issued`.
- `tests/integration/authz.test.ts:133` (`getOwned` across Hosts with `rejection`) and `:290` (`describe("Invite links across Hosts")`): home for the cross-Host `progress` case.
- `tests/integration/next-mocks.ts:51`: `useRouter` mock has `refresh`, so `CollectingRefresh` renders in `renderToStaticMarkup`.
- `tests/e2e/answer-form.spec.ts:33-72`: `createGame`, `addQuestion`, `openForm` (creating links through the dialog, reading `[data-link]`); `:278` and `:460`: `page.clock.install()` / `pauseAt` / `runFor` pattern. `tests/e2e/fixtures.ts`: `registerHost`, `localOnly`, `seriousViolations`.

## Tasks & Acceptance

**Execution:**
- `src/lib/limits.ts` -- add `SUBMISSIONS_MIN`, `COLLECTING_REFRESH_MS` -- limits live only here.
- `src/server/collection/index.ts` -- add `FEWER_THAN_3` and `progress` -- AC1, AD-8.
- `src/components/ProgressCount.tsx`, `src/components/CollectingRefresh.tsx` -- new -- AC2, UX-DR6, AD-17.
- `src/app/spill/[id]/page.tsx` -- read `progress`, feed `issued` from it, add the `progress` section in *collecting* -- AC2, drops the 2.2 stopgap.
- `.docs/planning-artifacts/architecture/architecture-Toppsvar-2026-11-21/ARCHITECTURE-SPINE.md` -- AD-8 amendment as worded under Always.
- `tests/integration/collection.test.ts` -- `describe("progress")`:
  - AC1: every matrix row except the cross-Host one, through `collection.progress(hostId, gameId)` with `toEqual`.
  - AC3: with 4 links, render `GamePage` and `GamesPage` and read the `game` row; after a first submit and after that link changes its Answers, both HTML strings and the row (`updated_at` included) are identical to before; after the third submit, the Game page HTML equals the earlier HTML with "færre enn 3" replaced by "3" and the list HTML and row are unchanged; a later change by one link leaves both identical again. The Game page HTML holds "færre enn 3 av 4 svar mottatt" before the third submit and "Du ser bare antallet, aldri hvem som har svart.", and never `aria-live`, `role="status"` or `progressbar`.
- `tests/integration/authz.test.ts` -- AC1/AD-5: Host B's `progress` on A's Game, a random UUID and `"abc"` reject with the same `NOT_FOUND`.
- `tests/e2e/progress.spec.ts` -- new, one test at 360 × 740 (AC2):
  1. `page.clock.install()` before the first navigation; register, create a Game, add one Question, create 4 links through the dialog and keep them from `[data-link]`.
  2. `page.clock.pauseAt(Date.now() + 60_000)` (fires the interval once): the 4 once-only links are still shown, and the page reads "færre enn 3 av 4 svar mottatt" with the fixed sentence. Then "Jeg har kopiert lenkene".
  3. In a participant context, submit links 1 and 2 (Svar 1, "Send inn svar", heading "Svarene dine er lagret."); on the Host page `runFor(30_000)`: still "færre enn 3 av 4 svar mottatt".
  4. Submit links 3 and 4; the Host page still reads "færre enn 3 …" before the timer; `runFor(30_000)`: "4 av 4 svar mottatt".
  5. Then: no `progressbar` or `meter`; no `[aria-live]` and no `role` of `status`, `alert` or `log` in the "Innsamling" region; the figure's computed `animation-name` is `none` and `transition-duration` `0s`; the headings "Flere lenker" and "Spørsmål (låst)" and the Question text are visible, "Innsamling" comes before "Flere lenker"; "4 av maks 50 lenker brukt."; no horizontal scroll; `seriousViolations` is empty.
- `tests/TRACE.md` -- FR-8 rows (integration, authz, e2e) and an FR-12 row (AC3); "2.6" out of FR-8's and FR-12's Pending lists.

**Acceptance Criteria (from epics.md, the contract):**
- AC1 (FR-8 · integration): Given a *collecting* Game with active links and submissions, when `collection.progress(gameId)` is called, then it returns the active-link count, `issued`, and the submission count, where any count below three is returned only as "fewer than 3" and never as an exact number.
- AC2 (FR-8, UX-DR6 · e2e): Given the *collecting* Game page, when submissions go from zero to four, then ProgressCount reads "færre enn 3 av N svar mottatt" and then "4 av N svar mottatt", with "Du ser bare antallet, aldri hvem som har svart." below it, no progress bar, no animation and no live-region announcement; it refreshes on load and every 30 s; and the page also shows the locked Question list and the "Flere lenker" panel.
- AC3 (FR-12 · integration): Given a Host-facing read of the Game page and the Game list, when a Participant submits or changes an Answer set, then no Host-visible value changes, including `game.updated_at` and "Sist endret", except the progress count once it is three or more.

## Spec Change Log

## Review Triage Log

### 2026-11-22 — Review pass
- verdicts: 25 findings — high 0, medium 3, low 13, false 9, maybe-false 0
- findings:
  - `[false]` `[reject]` Blind Hunter: revoking a link and watching the count drop tells the Host whether that link was used, and nothing records the trade-off. PRD FR-9 records it explicitly ("the drop in the progress count can reveal that the person had answered, which reveals participation but not content"); hiding it would contradict the accepted design.
  - `[low]` `[patch]` Blind Hunter: the comments in `ProgressCount.tsx` and `collection.progress` say an arrival "cannot be timed", which holds only below three. Fixed: both comments now say the floor hides arrivals below three and the silent 30 s refresh coarsens timing above it.
  - `[low]` `[reject]` Blind Hunter: with 1 or 2 active links the page reads "færre enn 3 av 2 svar mottatt" and never says close needs three sets. The copy is fixed by UX-DR6 and EXPERIENCE ("færre enn 3 av N" until three sets); the close-floor reason belongs to Story 3.1's close button, and new wording would need copy nobody has written.
  - `[low]` `[reject]` Blind Hunter: `progress` reads `issued` and the counts in two queries, so a concurrent link batch can briefly show more active links than issued, and the owner check runs twice per request. The window is milliseconds, the next refresh corrects it, and the cap is enforced again on the server; one combined query would make `collection` read the `games` table directly (AD-1).
  - `[false]` `[reject]` Blind Hunter: the `"fewer-than-3"` literal is written twice, so a server rename would silently show the raw value. The page passes `progress.submissions`, typed from `FEWER_THAN_3`, into the `ProgressCount` prop; a rename fails `npm run typecheck` at the page.
  - `[low]` `[patch]` Blind Hunter: no test shows polling stops outside *collecting*, and a hidden tab keeps refreshing. Patched the test half with the draft-page assertion (shared root with the Verification Gap draft row). The hidden-tab half is rejected: one auth check and two small reads every 30 s per open tab is negligible, and AD-17 asks for a refresh every 30 s while collecting.
  - `[false]` `[reject]` Blind Hunter: `replace("færre enn 3", "3")` replaces only the first match. The string occurs once on the page today; a second occurrence would make the test fail loudly, not pass wrongly.
  - `[false]` `[reject]` Blind Hunter: `progress` is untested outside *draft* and *collecting*. No caller reaches it in other states, and after close AD-9 deletes every link, so it can only return zeros and the floor.
  - `[medium]` `[patch]` Edge Case Hunter: a background refresh that fails (error boundary) or redirects to `/logg-inn` while the once-only links are on screen wipes their only copy. Fixed: `CollectingRefresh` skips `router.refresh()` while `[data-link]` is in the DOM; the e2e test proves the skip, and a mutation run without the guard fails it.
  - `[low]` `[reject]` Edge Case Hunter: a hidden or forgotten tab keeps polling. Same root cause and reason as the Blind Hunter hidden-tab half.
  - `[low]` `[reject]` Edge Case Hunter: a link batch between the `getOwned` read and the count query lets `active` exceed `issued`. Same root cause and reason as the Blind Hunter two-query row.
  - `[low]` `[reject]` Edge Case Hunter: 1 or 2 active links read "færre enn 3 av 2" for good. Same root cause and reason as the Blind Hunter copy row.
  - `[low]` `[patch]` Edge Case Hunter: the e2e "still fewer than 3" checks can match before the refresh response arrives. Fixed with the Verification Gap period row: the test now pins each tick with `runFor(29_000)` (unchanged) then `runFor(1_000)` (changed), so every unchanged check is followed by a change that only a refresh can show.
  - `[low]` `[defer]` Edge Case Hunter: the revoke cases use a raw DELETE, not Story 2.7's revoke with its replacement link. The real revoke does not exist yet; deferred in frontmatter for Story 2.7.
  - `[medium]` `[patch]` Verification Gap: the 30 s period is not pinned; any period from a few seconds to about 60 s passes. Fixed: `runFor(29_000)` asserts no refresh and `runFor(1_000)` asserts the new count, twice; a mutation run with `COLLECTING_REFRESH_MS = 45_000` fails the test.
  - `[medium]` `[patch]` Verification Gap: "the once-only links survive the refresh" passes before any refresh lands. Same root cause as the Edge Case Hunter link-wipe row: refreshes are now skipped while links are shown, and the test asserts the links and the stale count one second (real time) after the tick.
  - `[low]` `[patch]` Verification Gap: nothing checks that the draft page leaves out the Innsamling section and its refresh. Fixed: a draft `GamePage` render asserts no "Innsamling" and no "svar mottatt".
  - `[false]` `[reject]` Intent alignment: the spec is uncommitted, sprint-status still says backlog and the triage log is empty. The diff was staged before finalization, which writes all three.
  - `[low]` `[reject]` Intent alignment: "drop the stopgap" could mean removing `inviteLinksIssued` from `games.getOwned`, which the diff keeps. The stopgap Story 2.2 recorded was the page reading the column; the page now reads `issued` only from `collection.progress`, and removing the column from `getOwned` would force `collection` to query the `game` table that `games` owns (AD-1). Recorded in Design Notes.
  - `[false]` `[reject]` Intent alignment: the signature is `progress(hostId, gameId)`, not AC1's `progress(gameId)`. Deliberate: a Host read without an owner check would leak another Host's counts (AD-5); the spine is amended to match.
  - `[low]` `[patch]` Intent alignment: the browser never shows a set count between "færre enn 3" and "4". Fixed by the restructured e2e test, which now shows "3 av 4 svar mottatt" before "4 av 4".
  - `[false]` `[reject]` Intent alignment: AC3 compares server-rendered HTML, not the RSC payload, so values passed to client components could change unseen. The only client props on the page are `issued` and `questionCount`, which a submit never changes, and the integration test also compares the `game` row.
  - `[low]` `[defer]` Intent alignment: EXPERIENCE UJ-5 step 3 puts "K av N svar mottatt" on "Mine spill", while the diff keeps the Game list free of it. The Game list rule in the same file omits it and Story 2.6 is scoped to the Game page; the UX inconsistency is deferred in frontmatter for the demo-mode story.
  - `[false]` `[reject]` Intent alignment: from three sets the count still places an arrival within a 30 s window. AC3 allows exactly this ("except the progress count once it is three or more") and FR-8 floors only below three.
  - `[false]` `[reject]` Intent alignment: `epic-2-context.md` was not recompiled after this story's spine amendment. The next story's build finds the spine newer than the context and recompiles it automatically.

### AI suggestions corrected or rejected (grading evidence)

- **Planner corrections to the plain reading of the story:**
  - `collection.progress` takes `hostId` first, against AC1's `progress(gameId)`, so another Host's counts never leak (AD-5).
  - Only the submission count is floored at three; the active-link count is the Host's own action and reveals nothing.
  - `issued` keeps coming from `games.getOwned` inside `progress`, so `collection` never reads the `game` table directly.
- **Implementer deviations accepted:** `font-display tabular-nums` on the figure (the size class sets no family), the literal prop type in `ProgressCount` (a component never imports from `@/server`), and `clock.resume()` before axe.
- **Reviewer suggestions accepted (patched):** the refresh skip while once-only links are shown, the pinned 30 s period, the honest comments, the "3 av 4" step in the browser, and the draft-page assertion.
- **Reviewer suggestions rejected:** hiding revoke's effect on the count, new copy for fewer than three links, one combined query across `game` and `invite_link`, a shared constant module for the literal, pausing in hidden tabs, a sturdier replace in the snapshot test, tests for states no caller reaches, dropping the column from `getOwned`, and a recompile after this story's spine edit. Reasons are in the rows above.

## Design Notes

- **`hostId` in the signature.** The ACs write `collection.progress(gameId)`, but a Host read without an owner check would leak another Host's counts (AD-5). Every Host entry point takes `hostId` first; the spine is amended to match.
- **`issued` still comes from `games.getOwned`.** `games` owns the `game` table (AD-1), and `getOwned` is already the owner-checked read `questions.list` builds on. The stopgap Story 2.2 left was the *page* reading the column itself; now the page reads `issued`, `active` and `submissions` from one place, `collection.progress`. Dropping the column from `getOwned` would force `collection` to query `game` directly.
- **Only "active" links can be "fewer than 3".** The active-link count is the Host's own action (create, revoke) and reveals nothing, so only `submissions` is floored.
- **Why no live region.** EXPERIENCE: the count updates silently, so a change cannot be timed against a message sent. A refresh every 30 s plus a floor of three is the whole protection; an announcement would undo it.

## Verification

**Commands:**
- `npm run lint && npm run format:check && npm run typecheck` -- expected: exit 0
- `npm run test` -- expected: all pass offline
- `npm run test:e2e` -- expected: all specs pass

**Manual checks:**
- At 360 px the Innsamling section reads as one line or wraps cleanly between figure and "av N svar mottatt"; no horizontal scroll.

## Auto Run Result

Status: done

**Summary.** The *collecting* Game page now shows how many Answer sets have come in, and nothing more.
- **Server.** `collection.progress(hostId, gameId)` is owner-checked through `games.getOwned` (one `NOT_FOUND` for missing, foreign and malformed IDs). It returns `{ active, issued, submissions }`, with `submissions` the literal `"fewer-than-3"` below three. It is a read: no lock, no write.
- **Page.** An "Innsamling" section comes first in *collecting*. It reads "færre enn 3 av N svar mottatt" or "K av N svar mottatt", with "Du ser bare antallet, aldri hvem som har svart." below. It has no bar, live region or motion.
  - `router.refresh()` runs every 30 s while collecting. It is skipped while the once-only links are on screen, so a failed refresh or a login redirect can never wipe them.
  - The Invite link panel reads `issued` from `progress`, so the Story 2.2 stopgap is gone from the page.

**Files.**
- `src/lib/limits.ts`: `SUBMISSIONS_MIN`, `COLLECTING_REFRESH_MS`.
- `src/server/collection/index.ts`: `FEWER_THAN_3`, `progress`.
- `src/components/ProgressCount.tsx`: the static count. `src/components/CollectingRefresh.tsx`: the 30 s refresh with the once-only-links guard.
- `src/app/spill/[id]/page.tsx`: reads `progress`; the Innsamling section; `issued` from `progress`.
- `ARCHITECTURE-SPINE.md`: the AD-8 "Host reads" amendment.
- Tests: `tests/integration/collection.test.ts` (AC1 matrix, AC3 snapshots, draft page), `tests/integration/authz.test.ts` (cross-Host `NOT_FOUND`), `tests/e2e/progress.spec.ts` (AC2 at 360 px), `tests/TRACE.md` (FR-8 and FR-12 rows).
- `sprint-status.yaml`: 2-6 done.

**Review.** 25 findings: high 0, medium 3, low 13, false 9, maybe-false 0.
- **Patched:** two medium entries (the link wipe on a failed refresh with the unproven link survival; the unpinned 30 s period with the weak "still" checks and the missing "3 av N" step) and three low entries (the comments, the draft-page assertion, and the polling test half).
- **Deferred (2):** a progress case through Story 2.7's real revoke; the EXPERIENCE UJ-5 versus Game list wording.
- **Rejected:** 9 false and 9 low rows, each with its reason in the triage log.

**Follow-up review recommended: true.** Two medium entries were patched. The specific unverified risks:
- The `[data-link]` guard couples `CollectingRefresh` to `OnceLinkList`'s markup; a rename of that attribute would silently re-enable refreshes while links are shown. Only the e2e test would catch it.
- The clock-driven tests rely on Playwright's `pauseAt` rescheduling the interval from the pause point, and on a 1 s real wait for a refresh to land.

**Verification.**
- `npm run lint`, `format:check` and `typecheck` are clean.
- `npm run test`: 372 passed in 29 files.
- `npm run test:e2e`: 80 passed.
- Everything ran offline with no key.
- Mutation runs: removing the `[data-link]` guard failed the e2e test, and so did `COLLECTING_REFRESH_MS = 45_000`. Both were restored and the full suite re-run green. Before the patch, a 10-minute interval also failed it.
- The implementer checked 360 px with screenshots: "færre enn 3 av 4 svar mottatt" fits on one line, and there is no horizontal scroll.

**Residual risks.**
- From three sets on, the count still places an arrival within a 30 s window. AC3 allows this.
- Revoking a link with a set lowers the count, which PRD FR-9 accepts.
- A Game with only 1 or 2 links reads "færre enn 3 av 2 svar mottatt". Story 3.1's close-floor reason should explain it.
- The refresh is only proven in Chromium.

**Spine amendments.** AD-8 "Host reads" now says:
- `collection.progress(hostId, gameId)` is owner-checked through `games.getOwned` (AD-5).
- It returns `{ active, issued, submissions }`, with `submissions` `"fewer-than-3"` below three and never the exact number.
- The Game page reads `issued` only from it.
