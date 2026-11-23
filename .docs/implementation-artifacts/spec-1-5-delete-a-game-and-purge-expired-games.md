---
title: 'Story 1.5: Delete a Game and purge expired Games'
type: 'feature'
created: '2026-11-22'
baseline_revision: '252961a4c9dcf0ffc15670bc44443d49393881ec'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/.docs/implementation-artifacts/epic-1-context.md'
  - '{project-root}/.docs/planning-artifacts/ux-designs/ux-Toppsvar-2026-11-21/DESIGN.md'
  - '{project-root}/.claude/skills/impeccable/reference/craft-floor.md'
warnings: [oversized]
deferred: []
---

<intent-contract>

## Intent

**Problem:** A Host cannot delete a Game, and nothing removes old Games, so data about friends who never consented is kept forever (FR-3, PRD §6.1). The `ConfirmDialog` that four later destructive actions reuse does not exist yet, and nothing proves that future child tables cascade from `game`.

**Approach:** Add `played_at`, a `games.deleteOwned` entry point that locks the Game in any state and deletes it, an idempotent `games.purgeExpired` with an hourly in-process trigger fired after Host requests, and a `GET /api/purge` Route Handler gated by `CRON_SECRET`. On the Game page, add "Slett spillet" (secondary-danger) opening a native `ConfirmDialog`, with "Slett for godt" (filled danger) deleting and landing on `/spill` with a success Notice. Story 1.5's four ACs in `epics.md` (repeated below) are the contract; AD-4 (deletion), AD-17, AD-21 and AD-23 govern.

## Boundaries & Constraints

**Always:**
- The implementer first invokes `ponytail` (level `full`), then `impeccable` (no launcher: follow its "Launcher unavailable" path and read `reference/craft-floor.md` right before any UI edit). *Operate* mode. DESIGN.md and EXPERIENCE.md win over both skills. Ponytail never cuts a requirement: validation, error handling, security, accessibility and the tests below are all required.
- **Schema:** `game` gains `played_at timestamptz` (nullable, `utc` options), nothing else. Migration via `npm run db:generate`, committed. `games.transition` sets `played_at = new Date()` in the same UPDATE when `to === "played"` and never otherwise.
- **`games.deleteOwned(hostId, gameId) → { title }`** inside `withBoundary("games", "deleteOwned", …)`: opens one `db.transaction`, calls `lockForMutation(tx, { hostId, gameId, states: PERMITTED.deleteGame })`, deletes the row by id, returns the locked row's `title`. Missing, foreign and malformed IDs are the same `NOT_FOUND` (inherited from `lockForMutation`).
- **`games.purgeExpired() → { deleted: number }`** inside `withBoundary("games", "purgeExpired", …)`: one `DELETE … RETURNING id` of Games where (`played_at` is not null and `played_at <= now − 30 days`) or (`played_at` is null and `updated_at <= now − 90 days`), with `now = new Date()` (JS clock, so fake timers control it). Idempotent.
- **`games.purgeIfDue() → Promise<void>`**: never rejects. If the last attempt in this process was under one hour ago (marker on `globalThis`, epoch ms from `Date.now()`), returns without a query. Otherwise sets the marker first (so concurrent requests do not both run), then awaits `purgeExpired()` and swallows any error (the boundary already logged `{ module: "games", op: "purgeExpired", code: "INTERNAL", sqlstate }`).
- **Host-request trigger:** `src/app/spill/layout.tsx` calls `after(() => games.purgeIfDue())` (from `next/server`) after `requireHost()` succeeds. The purge therefore runs after the response and can never fail or delay it.
- **`GET /api/purge`** (`src/app/api/purge/route.ts`): `await connection()` first. `env.CRON_SECRET` unset → 404 `{ status: "disabled" }`. Header `Authorization` not equal to `Bearer ${CRON_SECRET}` (missing included) → 401 `{ status: "refused" }`; compare with `crypto.timingSafeEqual` over SHA-256 digests of both strings. Right secret → `purgeExpired()` and 200 `{ status: "ok", deleted }`; a purge failure → 500 `{ status: "error" }` (already logged by the boundary). Disabled and refused calls touch nothing (no query, no marker).
- **Action `src/app/spill/[id]/actions.ts` `deleteGame(prev, formData)`** (`"use server"`), sibling `schema.ts` with `deleteGameForm = z.object({ gameId: z.string().default("") })`. Inside one `try`: `auth.requireHost()`, validate the FormData shape, `games.deleteOwned`. The `catch` calls `unstable_rethrow(error)` first, then returns `toFailure(error)`. On success: `revalidatePath("/spill")`, then `redirect(\`/spill?slettet=${encodeURIComponent(title)}\`)`.
- **`/spill` notice:** `GamesPage` reads `searchParams`; when `slettet` is a single string it renders `Notice tone="success"` "«{slettet}» er slettet." between the `<h1>` and the create form. `Notice` gains `success: { role: "status", className: "bg-success-soft text-success" }`. React escapes the text; nothing else reads the parameter.
- **`Button`** gains exactly three variants from DESIGN.md: `secondary` (surface fill, `text-primary`, 1 px `border-line-strong`), `secondary-danger` (surface fill, `text-danger`, 1 px `border-danger`), `danger` (`bg-danger`, `text-on-primary`, `text-title`). Hovers stay inside the palette: `secondary` `hover:bg-surface-sunken`, `secondary-danger` `hover:bg-danger-soft`, `danger` `hover:bg-danger/90` (white text stays above 4.5:1). No other Button change.
- **`ConfirmDialog` (`src/components/ConfirmDialog.tsx`, client)**: owns its trigger and its native `<dialog>`. Props: `triggerLabel`, `triggerVariant`, `title`, `children` (consequence text and any error), `confirm` (the confirm control, a node the caller supplies, typically a `<form>` with a submit `Button`). The trigger calls `showModal()` and then focuses the cancel button ("Avbryt", `button-secondary`). Esc (native `cancel`) and "Avbryt" close it; the `close` event returns focus to the trigger. `aria-labelledby` the title (`<h2 className="text-heading">`), `aria-describedby` the consequence. Visual: `bg-surface`, `rounded-lg`, padding 24 px, max 480 px wide (full width minus 32 px gutter on phones), `shadow-xl`, backdrop `rgba(30, 26, 34, 0.55)`, actions right-aligned and wrapping, cancel before confirm. Never stacked.
- **Delete UI (`src/components/DeleteGame.tsx`, client)**: `useActionState` wrapper exactly like `CreateGameForm` (rethrow Next control flow, otherwise "Fikk ikke kontakt. Sjekk nettet og prøv igjen."). Renders `ConfirmDialog` with trigger "Slett spillet" (`secondary-danger`), title "Slette «{title}»?", body "Spørsmål, lenker, svar, brett og poeng slettes for godt.", and a failure as a danger `Notice` inside the dialog above the actions (dialog stays open, focus moves to the Notice). Confirm is `<form action>` with hidden `gameId` and `Button variant="danger"` "Slett for godt", pending "Sletter …". `button-danger` appears nowhere else.
- **Game page:** below the state panel in every state (outside the `switch`), a footer block separated by a top `border-line` with generous space above, holding `<DeleteGame gameId title />`.
- Test titles start with the FR/AD/UX/NFR ID they prove. `tests/TRACE.md` FR-3 gets this story's rows; its "None yet" line goes and "Pending" becomes "Stories 2.3, 4.3, 6.4". Each e2e test registers its own Host.

**Never:**
- No soft delete, undo, trash or "deleted on" notice (the *played* notice is Story 6.4). No purge UI, no cron config file, no new env var, no new dependency.
- No second lock path: deletion goes through `lockForMutation`. No code outside `games` deletes or updates `game`.
- No different response, message or timing branch between a foreign and a missing Game ID. No Game data (IDs, titles) in any log line or Route Handler response other than the count.
- `/api/purge` never runs the purge, sets the marker or opens the DB when disabled or refused.
- No test-only route or env switch in production code. Do not edit `.logs/`, `prompting/`, or this intent contract.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Delete OK | own Game in each of the 7 states | row gone, no row references it, redirect `/spill?slettet={title}`, Notice "«{title}» er slettet." | — |
| Delete foreign / missing / malformed | B deletes A's Game, a random UUID, `"abc"` | identical `{ ok: false, code: "NOT_FOUND", message: "Vi finner ikke dette spillet." }`; A's Game and its `updated_at` unchanged | Notice inside the dialog |
| Delete logged out | no cookie | redirect `/logg-inn`, nothing deleted | redirect not swallowed |
| Delete network failure | POST aborted | dialog stays open, danger Notice "Fikk ikke kontakt. Sjekk nettet og prøv igjen." focused | — |
| Cancel | Esc or "Avbryt" | dialog closed, focus on "Slett spillet", nothing deleted | — |
| Purge | played 30 d + 1 s ago; played 29 d ago (updated 100 d ago); never played, updated 90 d + 1 s ago; never played, updated 89 d ago | only the first and third are deleted, `deleted: 2`; second run `deleted: 0` | — |
| Hourly trigger | `purgeIfDue` at t, t + 59 min, t + 60 min, each with a newly expired Game | runs at t and t + 60 min only | — |
| Purge fails | `game` table renamed | `purgeIfDue` resolves; one log line `{ module: "games", op: "purgeExpired", code: "INTERNAL", sqlstate }`; spill layout still renders its children | swallowed |
| `/api/purge` | `CRON_SECRET` unset / wrong or missing header / `Bearer {secret}` | 404 disabled / 401 refused / 200 ok with `deleted` | expired Game survives the first two |
| `played_at` | `transition(playing→played)` vs any other legal edge | set to now / stays null | — |

</intent-contract>

## Code Map

- `src/server/db/schema.ts:38-46` -- `game` table; add `playedAt: timestamp("played_at", utc)`. `npm run db:generate` writes `drizzle/0002_*.sql` + meta.
- `src/server/games/index.ts` -- `lockForMutation` (line ~77) and `transition` (line ~104) to reuse/extend; `withBoundary` + `getDb` pattern from `create`. Transactions: `db.transaction(async (tx) => …)` as in `src/server/auth/index.ts:61`. `PERMITTED` and `GameState` from `@/lib/game-state`. Drizzle operators: `and`, `or`, `lte`, `isNull`, `isNotNull`, `eq`.
- `src/server/boundary.ts` -- `withBoundary(module, op, fn)` logs `{ module, op, code: "INTERNAL", sqlstate }` and throws `DomainError("INTERNAL")`.
- `src/server/env.ts` -- `env.CRON_SECRET` (`string | undefined`; empty string already means unset). `src/app/**` may import `@/server/env` (lint bans only `@/server/(db|judge)`).
- `src/app/api/health/route.ts` -- Route Handler pattern (`connection()`, `Response.json`).
- `src/app/spill/actions.ts`, `src/app/spill/schema.ts` -- action + FormData-shape pattern to copy for `deleteGame`.
- `src/app/spill/layout.tsx` -- add the `after()` trigger after `requireHost()`.
- `src/app/spill/page.tsx` -- add `{ searchParams }: PageProps<"/spill">` and the success Notice; `tests/integration/authz.test.ts:208` calls `GamesPage()` with no argument and must pass `{ searchParams: Promise.resolve({}) }` (cast as needed).
- `src/app/spill/[id]/page.tsx` -- add the footer with `<DeleteGame>` after `{panel}`.
- `src/components/{Button,Notice}.tsx` -- add variants/tone. `src/components/CreateGameForm.tsx` -- the `useActionState` wrapper, NETWORK message and focus-on-error pattern for `DeleteGame`.
- `src/app/globals.css` -- tokens exist: `bg-surface`, `border-line-strong`, `border-danger`, `text-danger`, `bg-danger`, `bg-danger-soft`, `bg-success-soft`, `text-success`, `rounded-lg`, `text-heading`. No backdrop token: use an arbitrary `backdrop:bg-[rgb(30_26_34/0.55)]`.
- `tests/integration/next-mocks.ts` -- `cookieJar`, `run`, `RedirectError`, `NotFoundError`. To exercise the layout, mock `next/server` keeping the real exports and replacing `after` with a stand-in that calls the callback and records its promise (see `auth-secure-and-code.test.ts:10-13` for the `importOriginal` pattern).
- `tests/integration/auth-secure-and-code.test.ts:20-30` -- `vi.stubEnv` + `vi.resetModules()` + dynamic import pattern for loading `env.ts` with a different `CRON_SECRET`. The DB singleton lives on `globalThis`, so it survives `resetModules`.
- `tests/integration/authz.test.ts` -- Hosts A/B fixture, `rejection` helper, `gameRow`; "with the game table dropped" block must stay last.
- `tests/integration/game-state.test.ts` -- direct `game` row fixtures, fake `Date`; add the `played_at` case here.
- `tests/e2e/fixtures.ts` -- `test`, `registerHost`, `FOCUS_RING`, `seriousViolations`. `tests/e2e/games.spec.ts` -- create-Game flow to reuse.
- `tests/TRACE.md:29-34` -- FR-3 section.

## Tasks & Acceptance

**Execution:**
- `src/server/db/schema.ts` + `npm run db:generate` -- `played_at` column, committed migration -- AC3
- `src/server/games/index.ts` -- `played_at` in `transition`; `deleteOwned`, `purgeExpired`, `purgeIfDue` -- AC1, AC2, AC3
- `src/app/api/purge/route.ts` -- the gated Route Handler -- AC4
- `src/app/spill/layout.tsx` -- `after(() => games.purgeIfDue())` -- AC3
- `src/app/spill/[id]/{actions.ts,schema.ts,page.tsx}` -- `deleteGame` action, FormData shape, footer with `DeleteGame` -- AC1
- `src/app/spill/page.tsx` -- `slettet` success Notice -- AC1
- `src/components/{ConfirmDialog,DeleteGame}.tsx`, `src/components/{Button,Notice}.tsx` -- dialog, delete UI, three variants, success tone -- AC1
- `tests/integration/delete.test.ts` -- (a) AC2: for each of the seven states, a direct `game` row of Host A is deleted through `deleteGame` (the action), redirecting to `/spill?slettet={encoded title}`; afterwards, for every foreign key referencing `game` found in `pg_constraint` (`confrelid = 'game'::regclass`), zero rows hold that ID, and the `game` row is gone. (b) Schema test: every foreign key whose referenced table is `game` has `confdeltype = 'c'`; the same query run for `host` finds `session` and `game` (proves the query sees FKs). (c) AuthZ: B's `deleteGame` with A's Game ID, a random UUID and `"abc"` returns the same `NOT_FOUND` failure, and A's row and `updated_at` are unchanged; logged out redirects to `/logg-inn` and deletes nothing. (d) The Game page component in each of the seven states renders a button "Slett spillet". -- AC1, AC2, FR-1
- `tests/integration/purge.test.ts` -- fake `Date`. (a) The purge matrix rows, then a second `purgeExpired` deletes 0 and leaves the survivors. (b) `purgeIfDue` hourly: runs at t, not at t + 59 min, again at t + 60 min (observed through newly inserted expired Games). (c) `transition(playing→played)` sets `played_at` to now; `draft→collecting` leaves it null. (d) Last in the file: rename `game` away; `purgeIfDue` (time advanced past the hour) resolves; stderr got exactly the `games/purgeExpired/INTERNAL` line with a SQLSTATE; rendering `SpillLayout` for a logged-in Host with the mocked `after` returns markup containing its children and the recorded `after` promise resolves -- AC3, FR-3
- `tests/integration/purge-route.test.ts` -- load the route three times with `CRON_SECRET` unset, then set to a value: unset → 404 `disabled`; set with no header and with `Bearer wrong` → 401 `refused`; `Bearer {secret}` → 200 `ok` with `deleted: 1`. An expired Game survives every non-200 call and is gone after the 200 one; a young Game survives all -- AC4, AD-17
- `tests/e2e/delete.spec.ts` -- (a) On a draft Game page, "Slett spillet" has a 1 px border in the danger color on a white fill (not a filled red button). Clicking it opens a dialog named "Slette «{title}»?" with the consequence sentence, and "Avbryt" is focused. Esc closes it and focus returns to "Slett spillet"; "Avbryt" does the same. (b) Reopen, click "Slett for godt" (background is the danger color): lands on `/spill` with the Notice "«{title}» er slettet." and the title no longer listed; opening the old Game URL shows "Vi finner ikke dette spillet.". (c) The POST is aborted (`page.route` abort on the action POST): the dialog stays open with "Fikk ikke kontakt. Sjekk nettet og prøv igjen." and the Game still exists. (d) axe finds no serious or critical violations with the dialog open and on `/spill` with the success Notice; the trigger, "Avbryt" and "Slett for godt" show the focus ring and are at least 44 px high -- AC1, UX-DR8, NFR-6
- `tests/TRACE.md` -- FR-3 rows for every new test; pending line updated; the e2e accessibility checks also get a row under the existing NFR-6 section -- epic rule

**Acceptance Criteria (from epics.md, the contract):**
- AC1 (FR-3, UX-DR8 · e2e): Given a Game page in any state, when the Host clicks "Slett spillet" (a `secondary-danger` button, not filled red), then a native ConfirmDialog asks "Slette «{title}»? Spørsmål, lenker, svar, brett og poeng slettes for godt." with focus on cancel; Esc cancels and returns focus to the trigger, and "Slett for godt" (the filled `danger` button, which appears only in this dialog) deletes the Game and lands on `/spill` with "«{title}» er slettet."
- AC2 (FR-3 · integration): Given Games in each of the seven states, when each is deleted, then no row anywhere references the deleted Game, and a schema test asserts that every foreign key to `game` is `ON DELETE CASCADE`, so tables added by later stories are covered by the same test.
- AC3 (FR-3 · integration): Given a Game 30 days past `played_at`, a never-played Game 90 days past `updated_at`, and younger Games of both kinds, when `games.purgeExpired()` runs, then only the two expired Games are deleted, a second run changes nothing, and a purge triggered from a Host request runs at most once an hour per process, and a purge failure is caught and the Host request that triggered it still succeeds.
- AC4 (FR-3, AD-17 · integration): Given `GET /api/purge`, when it is called without `CRON_SECRET` configured, with a wrong secret, or with the right one, then it is disabled, refused, or runs the purge, respectively, and never has another side effect.

## Spec Change Log

## Review Triage Log

### 2026-11-22 — Review pass
- verdicts: 35 findings — high 0, medium 1, low 30, false 4, maybe-false 0
- findings:
  - `[low]` `[reject]` Blind Hunter: no `vercel.json` cron entry and no README note on `CRON_SECRET`, so the daily backstop never runs — no pilot exists yet; deployment config is Story 7.5 and the README is Story 7.4. Locally and for the examiner, Host traffic triggers the purge.
  - `[low]` `[patch]` Blind Hunter: the NFR-7 row for `delete.spec.ts` in `tests/TRACE.md` copies the NFR-6 accessibility text — replaced with the bokmål strings the spec actually asserts.
  - `[false]` `[reject]` Blind Hunter: the migration does not backfill `played_at` for Games already in *played* — no code path reaches *played* before Epic 6 and there is no seed data, so no such row can exist. A CHECK constraint would also block the tests' direct state fixtures.
  - `[low]` `[reject]` Blind Hunter: the purge starts only on hard loads, because client navigation and actions skip the layout — intended (Design Notes). The hourly cap limits how often it runs anyway, and putting the trigger in every page adds calls for no retention gain.
  - `[low]` `[patch]` Blind Hunter: known limits have no `shortcut:` comment (CLAUDE.md) — added one to `purgeExpired` (unbatched DELETE, no index). The per-process marker is the spine's own design (AD-23), not a shortcut.
  - `[low]` `[reject]` Blind Hunter: a failed delete's error Notice is still shown when the dialog is reopened, and it is not refocused — it takes a failure, then a cancel, then a reopen; resetting `useActionState` needs a remount key or a reset callback, more than a direct correction.
  - `[false]` `[reject]` Blind Hunter: nothing sets focus after a successful delete — `RouteFocus` focuses the `/spill` `<h1>` on the pathname change (EXPERIENCE.md: focus goes to `<h1>` after a route change), and the Notice comes right after it.
  - `[low]` `[reject]` Blind Hunter: `?slettet=` is spoofable and survives reload — decided in Design Notes, using the same mechanism as Story 1.3's `?utlopt=1`; it shows only escaped text on the Host's own page.
  - `[low]` `[reject]` Blind Hunter: Esc or "Avbryt" during a pending delete closes the dialog, so a later error lands in a hidden dialog — this needs Esc pressed within a request's round trip plus a server failure. A success still redirects. The fix is a new `busy` guard on `ConfirmDialog`.
  - `[low]` `[patch]` Blind Hunter: the `route.ts` comment cites AD-17 for the cron backstop — changed to AD-23. The test titles citing AD-17 are correct: they cover the error boundary and the Route Handler list.
  - `[low]` `[reject]` Blind Hunter: the backdrop color is hard-coded, and `danger` uses `text-title` while `secondary` does not — DESIGN.md gives the backdrop as a literal `confirm-dialog` value with no color token; `danger` mirrors `primary`, the other confirm variant, and cancel is `button-secondary`, which has no title type.
  - `[low]` `[reject]` Blind Hunter: no exact-boundary purge test, no missing-`gameId` test, `resetModules` leaves a second DB client — ±1 s already proves the comparison; an empty `gameId` goes the malformed-ID path that is tested; the DB client is a `globalThis` singleton, so `resetModules` reuses it.
  - `[false]` `[reject]` Blind Hunter: `drizzle/meta` is missing from the diff — it was left out of the review diff on purpose; commit `ceeb4a8` has the snapshot and journal, and `drizzle-kit check` is clean.
  - `[low]` `[patch]` Verification gap: the `/api/purge` 500 branch is untested — added a last test in `purge-route.test.ts` that renames `game` and asserts 500, `{ status: "error" }` and the single boundary log line.
  - `[medium]` `[patch]` Verification gap: the dialog's handling of a server-returned failure (`NOT_FOUND`) is never exercised — added an e2e test that deletes the Game in a second page, confirms in the stale dialog, and asserts the focused alert "Vi finner ikke dette spillet." with the dialog still open.
  - `[low]` `[reject]` Verification gap (other): `?slettet=` is spoofable — same as the Blind Hunter row.
  - `[false]` `[reject]` Intent audit: the sprint status and the triage log are not in the diff — the review ran before finalize, which writes both.
  - `[low]` `[reject]` Intent audit: AC1's "any state" is browser-tested only on *draft* — no other state is reachable through the UI in Epic 1; the integration test renders the button in all seven states, and the dialog is state-independent.
  - `[low]` `[reject]` Intent audit: the AC2 checks run over zero child tables today — by design (Design Notes); the `host` query proves the catalog query sees real foreign keys, and Epic 2's tables fall under it automatically.
  - `[low]` `[reject]` Intent audit: the AC3 layout test mocks `after()` — `after()`'s timing belongs to Next; forcing a purge failure in the e2e production server would need a test-only switch, which the spec forbids.
  - `[low]` `[reject]` Intent audit: the hourly cap is tested through `purgeIfDue` directly, not through a request — the layout calls exactly that function, and the layout test proves the wiring.
  - `[low]` `[reject]` Intent audit: `/api/purge` skips the hourly cap, against a literal reading of AD-23 — AC4 says the right secret "runs the purge"; capping it would make the daily cron a no-op after any Host visit (Design Notes).
  - `[low]` `[reject]` Intent audit: "never has another side effect" is checked narrowly — disabled and refused calls return before any DB or module call (the code), and the tests check the rows and the marker.
  - `[low]` `[patch]` Intent audit: AD-17 lists only login and create Game as redirect flows, but `deleteGame` redirects (AC1) — spine AD-17 "Result shape" amended to add delete Game (Delivery convention: a departure amends the spine in the same PR).
  - `[low]` `[reject]` Intent audit: `?slettet=` reload and crafting — same as the Blind Hunter row.
  - `[low]` `[patch]` Intent audit: the NFR-7 trace row is a copy — same patch as the Blind Hunter row.
  - `[low]` `[reject]` Edge Case Hunter: a stale error Notice when the dialog reopens — same as the Blind Hunter row.
  - `[low]` `[reject]` Edge Case Hunter: Esc or "Avbryt" while pending — same as the Blind Hunter row.
  - `[low]` `[reject]` Edge Case Hunter: focusing the error Notice in a closed dialog does nothing — same root cause as the pending-close row.
  - `[low]` `[reject]` Edge Case Hunter: an empty `?slettet=` shows «» er slettet. — only reachable by a crafted URL, since titles have at least one character; harmless text on the Host's own page.
  - `[low]` `[reject]` Edge Case Hunter: `?slettet=` spoof and repeat — same as the Blind Hunter row.
  - `[low]` `[reject]` Edge Case Hunter: an unbatched DELETE can time out the cron — a Host has a handful of Games; the limit is now recorded in the `shortcut:` comment patched above.
  - `[low]` `[reject]` Edge Case Hunter: a clock moving backwards skips the purge until it passes the marker — at most one skipped hour on a rare event, and the daily cron still runs.
  - `[low]` `[reject]` Edge Case Hunter: a composite foreign key to `game` would be checked on its first column only — the spine's convention is single `<entity>_id` columns toward `game`, and the cascade check (`confdeltype`) covers the whole constraint anyway.
  - `[low]` `[patch]` Edge Case Hunter: the NFR-7 trace row is a copy — same patch as the Blind Hunter row.

### AI suggestions corrected or rejected (grading evidence)

- **Orchestrator corrected the implementer** after review: the NFR-7 trace row was a copy-paste of the NFR-6 row, the `/api/purge` failure branch and the dialog's server-failure path had no tests, a known limit lacked its `shortcut:` comment, a comment cited the wrong AD, and the spine's AD-17 redirect list was not amended. All six were patched.
- **Implementer departures accepted:** `Button` props changed from `ButtonHTMLAttributes` to `ComponentProps<"button">` so that `ref` reaches the button, which a type-only change needed for focus handling. `games.spec.ts`'s keyboard helper now counts only visible controls, because the closed dialog's buttons are not tab stops.
- **Reviewer suggestions rejected:** cron and deployment config (Story 7.5), a `played_at` backfill and a CHECK constraint, a purge trigger on every page, resetting the dialog's error state, a `busy` guard against closing during a pending delete, a one-time flash in place of `?slettet=`, batched deletes, clock-skew guards, composite-key handling, a backdrop token and exact-boundary tests. Each one adds code for an unreachable, rare or harmless case; the reasons are in the rows above.
- **Planning interpretations recorded:** `/api/purge` bypasses the hourly marker, the Notice travels in `?slettet=`, and `after()` in the spill layout is the Host-request trigger (Design Notes).

## Design Notes

- **Notice across the redirect.** The title rides in `?slettet=`, the same mechanism as Story 1.3's `/logg-inn?utlopt=1`. A flash cookie cannot be cleared from a server component, so it would reappear on the next visit to `/spill`; the query parameter disappears as soon as the Host follows any link. A crafted `?slettet=x` only shows an escaped sentence on the Host's own page, with no action attached. The title stays in the Host's own browser history, which is the Host's device, not stored data.
- **Why `after()` in the spill layout.** AD-23 says Host requests trigger the purge. The layout runs on every hard load of a Host page and already holds the session check; `after()` runs the purge once the response is sent, so a slow or failing purge cannot touch the request. Client-side navigations skip the layout, which only means fewer attempts; the hourly marker caps them anyway.
- **`/api/purge` skips the hourly marker.** The daily cron is the backstop for a pilot nobody visits; capping it by a marker that Host traffic also sets would make it a no-op whenever a Host visited in the last hour.
- **ConfirmDialog owns its trigger.** Focus-on-cancel, Esc and focus-return (UX-DR8) live in one place, so the four later dialogs get them for free. The confirm control stays a caller-supplied node, because each caller has its own form and pending state.
- **Cascade test with no child tables yet.** Today no table references `game`, so the assertion is vacuous until Epic 2. Running the same query against `host` proves it finds real foreign keys and their delete rule.

## Verification

**Commands:**
- `npm run lint && npm run format:check && npm run typecheck` -- expected: exit 0
- `npm test` -- expected: all pass offline (237 existing plus the new tests)
- `npm run test:e2e` -- expected: all specs pass
- `npx drizzle-kit check` and a second `npm run db:generate` -- expected: no new migration

**Manual checks:**
- Screenshots of the Game page (footer with "Slett spillet"), the open dialog, the dialog with an error, and `/spill` with the success Notice at 1280 and 375 px match DESIGN.md: white trigger with red border, filled red only in the dialog, dialog 480 px max with the dark backdrop, nothing below 14 px.

## Auto Run Result

Status: done

**Summary.** A Host can delete a Game from its page in any state. The page shows "Slett spillet" (secondary-danger), which opens a native `ConfirmDialog` with focus on "Avbryt". Esc or "Avbryt" closes it and returns focus to the trigger. "Slett for godt" (filled danger, used only here) deletes the Game through `games.deleteOwned`, which locks the row with `lockForMutation` in any state, then lands on `/spill` with "«{title}» er slettet.". A foreign, missing or malformed ID gets one identical `NOT_FOUND`, shown inside the dialog.

Retention: `game.played_at` is set by `transition(playing→played)`. `games.purgeExpired()` deletes Games 30 days after *played*, or 90 days after the last Host change if never played. `games.purgeIfDue()` runs it at most hourly per process from `after()` in the spill layout and never fails the request. `GET /api/purge` is disabled without `CRON_SECRET`, refuses a wrong secret (compared timing-safe) and otherwise purges.

A catalog-driven schema test asserts that every foreign key to `game` cascades, so it also covers later tables.

**Files.**
- `src/server/db/schema.ts`, `drizzle/0002_amusing_owl.sql` + meta: the `played_at` column.
- `src/server/games/index.ts`: `played_at` in `transition`; `deleteOwned`, `purgeExpired`, `purgeIfDue`.
- `src/app/api/purge/route.ts`: the cron Route Handler gated by `CRON_SECRET`.
- `src/app/spill/layout.tsx`: the `after()` purge trigger.
- `src/app/spill/[id]/{actions,schema,page}.ts(x)`: the `deleteGame` action, its FormData shape, and the page footer with the delete control.
- `src/app/spill/page.tsx`: the `?slettet=` success Notice.
- `src/components/{ConfirmDialog,DeleteGame}.tsx`: the dialog and the delete UI. `Button.tsx` gets the `secondary`, `secondary-danger` and `danger` variants; `Notice.tsx` gets the `success` tone.
- Spine AD-17 "Result shape": delete Game added to the redirect flows.
- Tests: `tests/integration/{delete,purge,purge-route}.test.ts` and `tests/e2e/delete.spec.ts`, plus updates to `authz.test.ts`, `games.spec.ts` and `tests/TRACE.md`.

**Review.** 35 findings (high 0, medium 1, low 30, false 4).
- Patched 6 entries covering 9 rows (entry verdicts: medium 1, low 5).
- Deferred 0.
- Rejected 26, each with its reason in the triage log.

**Follow-up review recommended: false.** One medium entry was patched (a test gap, now covered by a passing e2e test). No high was found.

**Verification (after patches, local Node):**
- `npm run lint`, `format:check` and `typecheck` are clean.
- `npm test`: 264/264 in 22 files.
- `npm run test:e2e`: 44/44.
- `drizzle-kit check` is clean, and a second `db:generate` produced no migration.
- The implementer reviewed screenshots of the Game page, the open dialog, the dialog with an error, and `/spill` with the success Notice at 1280 and 375 px against DESIGN.md.

**Residual risks.**
- The cascade test checks zero child tables until Epic 2 adds them. The `host` query proves the catalog query itself works.
- The purge runs only on hard loads of Host pages, plus the cron once the pilot exists (Story 7.5 must add the cron entry and `CRON_SECRET`).
- Two dialog edge cases were rejected: a stale error shown on reopen, and closing during a pending delete.
- `?slettet=` can be crafted to show a harmless sentence.
- impeccable `critique`/`audit`/`harden`, `ponytail-review` and `bmad-code-review` are due on the epic branch before the PR (CLAUDE.md), not run here.
