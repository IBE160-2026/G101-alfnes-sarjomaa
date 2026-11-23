---
title: 'Story 1.4: Create and list Games, with a state-driven Game page'
type: 'feature'
created: '2026-11-22'
baseline_revision: '03f8b23ce6234349188e103d3b8f1844968f68bb'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/.docs/implementation-artifacts/epic-1-context.md'
  - '{project-root}/.docs/planning-artifacts/ux-designs/ux-Toppsvar-2026-11-21/DESIGN.md'
  - '{project-root}/.claude/skills/impeccable/reference/craft-floor.md'
warnings: [oversized]
deferred:
  - summary: >-
      Every page shares the browser tab title "Toppsvar", so pages are not titled by topic (WCAG 2.4.2).
    evidence: |-
      Only src/app/layout.tsx sets metadata.title; the landing, /registrer, /logg-inn, 404, /spill and the Game page all show "Toppsvar". App-wide since Story 1.2, not caused by Story 1.4.
    location: >-
      src/app/layout.tsx
    severity: medium
---

<intent-contract>

## Intent

**Problem:** A logged-in Host lands on an empty "Mine spill" and cannot create or open a Game. Nothing models the Game state machine, so every later epic would invent its own state checks. The `RouteFocus` gap that Story 1.2 deferred also becomes reachable here, because this story adds the first `loading.tsx` skeletons.

**Approach:** Add the `game` table and a `games` module (`create`, `listOwned`, `getOwned`, `lockForMutation`, `transition`) driven by a pure `src/lib/game-state.ts` table. Build the create form and list on `/spill`, a state-driven Game page at `/spill/[id]` with breadcrumb and StatusBadge, one Game not-found page shared by missing and foreign Games, and skeletons for both routes. `RouteFocus` waits for the `<h1>` to appear. Story 1.4's five ACs in `epics.md` (repeated below) are the contract, and AD-4, AD-5, AD-17 and AD-23 (`updated_at`) govern.

## Boundaries & Constraints

**Always:**
- The implementer first invokes `ponytail` (level `full`), then `impeccable` (no launcher: follow its "Launcher unavailable" path and read `reference/craft-floor.md` right before any UI edit). This is *Operate* mode. DESIGN.md and EXPERIENCE.md win over both skills. Ponytail never cuts a requirement: validation, error handling, security, accessibility and the tests below are all required.
- **Schema:** table `game`: `id uuid pk default gen_random_uuid()`, `host_id uuid not null → host(id) on delete cascade`, `title text not null`, `state` (Postgres enum `game_state` with the seven values from `GAME_STATES`, `not null default 'draft'`), `created_at` and `updated_at` (`timestamptz not null default now()`). No `played_at` (Story 1.5 adds it with the purge), no other columns. Migration generated with `npm run db:generate` and committed.
- **`src/lib/game-state.ts` (pure):** `GAME_STATES` (the seven, in chain order), `type GameState`, `INITIAL_STATE = "draft"` (entered only by `games.create`), `TRANSITIONS`: exactly the six forward edges draft→collecting→grouping→in_review→ready→playing→played, and `canTransition(from, to)`. Creation plus these six edges are PRD §4.1's seven transitions. Also `type Operation` and `PERMITTED: Record<Operation, readonly GameState[]>`, which encodes AD-4's permitted-operations table one operation per row: `editQuestions` [draft]; `createInviteLinks` [draft, collecting]; `revokeInviteLink`, `openInviteLink`, `submitAnswers`, `closeCollection` [collecting]; `writeGrouping` [grouping]; `editReview`, `confirmBoard` [in_review]; `startPlay` [ready]; `playMove`, `finishPlay` [playing]; `deleteGame` [all seven]. *played* permits only `deleteGame`.
- **`src/server/games/index.ts`** (every file starts `import "server-only"`):
  - `create(hostId, input) → { id }`: validates with `createGameSchema`, inserts in `draft` with `created_at = updated_at = new Date()` (JS clock, so fake timers control it).
  - `listOwned(hostId) → { id, title, state, updatedAt }[]`: only that Host's Games, `created_at desc`.
  - `getOwned(hostId, gameId) → { id, title, state, updatedAt }`: a read.
  - `lockForMutation(tx, { hostId?, gameId, states })`: `SELECT … FOR UPDATE` on the row, constrained to `host_id` when `hostId` is given. A miss throws `NOT_FOUND`. A state outside `states` throws `WRONG_STATE` before any write. Only with `hostId` does it set `updated_at = new Date()`. Returns the row.
  - `transition(tx, gameId, from, to)`: throws `WRONG_STATE` unless `canTransition(from, to)`. Then runs `UPDATE game SET state = to WHERE id = gameId AND state = from RETURNING`, and no row back is also `WRONG_STATE` (compare-and-set). It never touches `updated_at`.
  - A `gameId` that is not a UUID is `NOT_FOUND` before any query, so Postgres never sees it (that would raise 22P02, giving `INTERNAL`). `create`, `listOwned` and `getOwned` run inside `withBoundary("games", op, …)`. The two writers take `tx` first, open no transaction, and leave the boundary to their caller.
- **Errors (`src/lib/errors.ts`):** add exactly `NOT_FOUND` "Vi finner ikke dette spillet." and `WRONG_STATE` "Spillet er i en annen fase nå. Last inn siden på nytt."
- **Validation (`src/lib/game.ts`):** `createGameSchema = z.object({ title })`, where `title` is trimmed, then 1 to `GAME_TITLE_MAX` (80) characters, and both bounds give "Navnet må ha 1–80 tegn.". `src/lib/limits.ts` gains `GAME_TITLE_MAX = 80` and `GAME_TITLE_COUNTER_FROM = 60`.
- **Action `src/app/spill/actions.ts` `createGame(prev, formData)`** (`"use server"`) with a sibling `schema.ts` holding the FormData shape (`title` string, default ""). Inside one `try`: `auth.requireHost()` and then `games.create`. The `catch` calls `unstable_rethrow(error)` first, so the login redirect propagates, then returns `toFailure(error)`. On success: `revalidatePath("/spill")`, then `redirect(\`/spill/${id}\`)`.
- **Layout `src/app/spill/layout.tsx`:** `await auth.requireHost()`, then `<HostChrome signedIn>{children}</HostChrome>`. A layout sits outside the `loading.tsx` Suspense boundary, so a logged-out hard load gets a real redirect before streaming starts. Pages still call `requireHost()` themselves (AD-5, and layouts do not re-run on client navigation). `src/app/spill/page.tsx` drops its own `HostChrome`.
- **`/spill` page:** `<h1>Mine spill</h1>`, then the create row: client component `src/components/CreateGameForm.tsx`, with TextField "Navn på spillet" and Button "Lag spill" / pending "Lager spill …". The two sit side by side from `sm`, stacked below that. Then the list, `<ul>` of rows, each with the title as a link to `/spill/{id}` (min 44 px target), a `StatusBadge` and "Sist endret {dato}". The date uses `formatDate` from `src/lib/format.ts`: `Intl.DateTimeFormat("nb-NO", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Oslo" })`, e.g. "22. november 2026", inside `<time dateTime={iso}>`. With no Games it shows "Du har ingen spill ennå. Gi det første et navn over, for eksempel «Hyttetur 2026»." If `listOwned` throws, the create form stays and a danger `Notice` reads "Fikk ikke hentet spillene dine. Last inn siden på nytt."
- **CreateGameForm behaviour:** follows `AccountForm`'s pattern: a `useActionState` wrapper that rethrows Next control flow and otherwise returns "Fikk ikke kontakt. Sjekk nettet og prøv igjen.". `noValidate`, validation on submit only, the typed title kept after a failure, and focus moved to the invalid field, or to the danger Notice when there are no field errors. No `maxLength`, so an 81-character title reaches the server and is refused. Counter: from 60 characters, "{n} av 80 tegn" sits right-aligned below the field (`body-sm`, `ink-muted`, `aria-hidden`). A separate polite live region says "{n} av 80 tegn" only when n ≥ 80. `TextField` gains one optional `counter?: ReactNode` slot placed right-aligned in the helper row, and nothing else changes in it.
- **`StatusBadge` (`src/components/StatusBadge.tsx`):** a `<span>` pill (`rounded-full`, `text-label`, horizontal padding) with the fixed word and colors from DESIGN.md: draft "Utkast" sunken/ink, collecting "Samler inn" primary-soft/primary, grouping "Grupperer" and in_review "Til gjennomgang" warning-soft/warning, ready "Klar" success-soft/success, playing "Spilles" primary-soft/primary, played "Ferdig" sunken/ink-muted. Typed `Record<GameState, …>`. Never interactive.
- **Game page `src/app/spill/[id]/page.tsx`:** reads `params` (a Promise in Next 16) and calls `requireHost()`, then `games.getOwned`. On `NOT_FOUND` it calls `notFound()` from `next/navigation`; any other error propagates to the root `error.tsx`. Renders `nav aria-label="Brødsmulesti"` with an `<ol>`: link "Mine spill" (min 44 px) › title (`aria-current="page"`, separator `aria-hidden`). Then a header row with the title as the only `<h1>` and the `StatusBadge` beside it. Then the main panel, chosen by a `switch (game.state)`: `draft` renders a `<section aria-labelledby>` with `<h2>Spørsmål</h2>` and the literal empty state "Ingen spørsmål ennå. Skriv det første, gjerne om noen dere kjenner, for eksempel «Hva gjør Jonas når han har forsovet seg?»". Every other state renders no panel yet, because later stories add their panels in this switch.
- **Game not-found `src/app/spill/[id]/not-found.tsx`:** renders inside the spill layout, so it gets the signed-in chrome: `<h1>Vi finner ikke dette spillet.</h1>` and a link "Mine spill" → `/spill`. Missing, foreign and malformed IDs all reach it through the same `notFound()` call.
- **Skeletons:** `src/app/spill/loading.tsx` shows a title bar, the create row and three skeleton rows. `src/app/spill/[id]/loading.tsx` shows a breadcrumb bar, a header bar and one panel. Blocks are `bg-surface-sunken`, `rounded-md`, static (no pulse), and the wrapper is `aria-hidden="true"`. A skeleton never contains an `<h1>`. Skeletons become visible only after 300 ms, via a CSS animation delay starting from `opacity: 0`.
- **`RouteFocus` (resolves Story 1.2's deferral):** after a pathname change it focuses the `<h1>` if one exists. Otherwise it watches `document.body` with a `MutationObserver` until an `<h1>` appears, focuses that, and disconnects. A further pathname change or unmount also disconnects it. First load is still never focused.
- Test titles start with the FR/AD/UX/NFR ID they prove. `tests/TRACE.md` gets this story's rows under FR-1, FR-2, NFR-6, NFR-7 and UX. FR-1's pending line becomes "Story 2.3" and FR-2's becomes none (remove the line). Each e2e test registers its own Host.

**Never:**
- No delete button, ConfirmDialog, purge, `played_at` or `/api/purge` (Story 1.5). No Question editor, Invite links or other state panels (Epic 2 onward). No polling, and no new dependency.
- No second state-check path: no code outside `games` locks or updates `game.state`.
- No different response, message or timing branch between a foreign and a missing Game ID. No Game data in any log line.
- No test-only route or env switch in production code. Do not edit `.logs/`, `prompting/`, or this intent contract.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Create OK | title "  Hyttetur 2026 " | row `draft`, title trimmed, `updated_at = created_at`, redirect `/spill/{id}` | — |
| Title bounds | "", "   ", 81 chars / 1 and 80 chars | refused: `INVALID_INPUT`, `fieldErrors.title` "Navnet må ha 1–80 tegn.", no row / accepted | field `aria-invalid`, focus moves there |
| Logged out create | no cookie | redirect `/logg-inn`, no row | redirect not swallowed into `INTERNAL` |
| List | Host with 2 Games, other Host with 1 | own 2 only, newest first | — |
| Foreign / missing / malformed ID | `getOwned`, `lockForMutation({hostId})`, Game page | `NOT_FOUND` in all three; same page "Vi finner ikke dette spillet." + "Mine spill" link | foreign Game's `updated_at` unchanged |
| Wrong state | `lockForMutation(states: ["collecting"])` on a draft | `WRONG_STATE`, `updated_at` unchanged | — |
| Lock | `lockForMutation` with / without `hostId` | row locked `FOR UPDATE`; `updated_at` set to now / unchanged | — |
| Transition | all 49 (from, to) pairs | only the six chain edges succeed | others `WRONG_STATE`, state unchanged |
| Stale CAS | `transition(draft→collecting)` when row is already `collecting` | `WRONG_STATE` | — |
| List load fails | `listOwned` throws | create form + danger Notice "Fikk ikke hentet spillene dine. Last inn siden på nytt." | logged via boundary |
| Counter | 59 / 60 / 80 / 81 chars | none / "60 av 80 tegn" / announced "80 av 80 tegn" / "81 av 80 tegn" | — |

</intent-contract>

## Code Map

- `src/server/db/schema.ts` -- `host`, `session`; `utc` timestamp options to reuse. Add `pgEnum("game_state", GAME_STATES)` (db may import `@/lib`) and `game`. `npm run db:generate` (runs under `--conditions=react-server`) writes `drizzle/0001_*.sql` and meta.
- `src/server/db/client.ts` -- `getDb()`, `Db`, `Tx`. `Tx` already carries the relations type parameter.
- `src/server/auth/index.ts` -- `requireHost()` returns `{ hostId }` or throws Next's redirect (and `DomainError("INTERNAL")` on a DB failure). This is the pattern to copy for `withBoundary` use and conditional `UPDATE … RETURNING`.
- `src/server/boundary.ts` -- `withBoundary(module, op, fn)`, `sqlstateOf`.
- `src/lib/errors.ts` -- `ErrorCode`, `MESSAGES`, `DomainError`, `toFailure`, `validate(schema, input)` (first message per top-level field). `tests/unit/errors.test.ts` iterates `MESSAGES`, so new codes are covered automatically.
- `src/lib/account.ts`, `src/lib/limits.ts` -- shared-zod-schema and limits precedents.
- `src/app/logg-inn/{actions,schema}.ts` -- action + FormData-shape pattern. `createGame` differs: it also calls `requireHost` inside the try, hence `unstable_rethrow`.
- `src/components/AccountForm.tsx` -- the `useActionState` wrapper, network message and focus-on-error pattern for `CreateGameForm`.
- `src/components/{Button,TextField,Notice,HostChrome,RouteFocus}.tsx` -- reuse. `HostChrome` renders skip link, header, `<main id="innhold">` and the `max-w-200` column, so the spill layout wraps it. Root `error.tsx` sits above the spill layout and renders its own chrome, so the chrome is never doubled.
- `src/app/spill/page.tsx` -- current minimal page; rewrite.
- `src/app/globals.css` -- tokens (`bg-surface-sunken`, `bg-primary-soft`, `text-primary`, `bg-warning-soft`, `text-warning`, `bg-success-soft`, `text-success`, `text-ink-muted`, `rounded-full`, `text-label`, `text-title`, `text-display`). A 300 ms appear animation can live here as `@keyframes` plus a `--animate-*` theme variable; `tests/unit/design-tokens.test.ts` checks only colors, text sizes and radii.
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/{loading,not-found}.md` -- `loading.js` wraps `not-found.js` and `page.js` but not the same-folder `layout.js`. A streamed `notFound()` keeps status 200 and injects `noindex`.
- `tests/integration/next-mocks.ts` -- `cookieJar`, `RedirectError`, `run(action, fields)`. Add a `notFound` stand-in to `nextNavigation()` that throws a recognizable `NotFoundError`, for the page-level authz case.
- `tests/integration/auth.test.ts:1-60` -- mocking and helper pattern. Register Hosts through `auth.register` + the cookie jar, or insert `host` rows directly with any `password_hash` string, to skip scrypt cost.
- `tests/e2e/fixtures.ts` -- `test`, `registerHost(page)`, `tabThrough`, `FOCUS_RING`. `tests/e2e/auth.spec.ts` has the `seriousViolations` axe helper; copy it or move it into fixtures.
- `tests/e2e/visual-foundation.spec.ts:144` -- the existing route-focus test, a pattern for the new one.
- `tests/unit/lint-zones.test.ts` -- already covers `games` zones; no change needed.
- `tests/TRACE.md` -- FR-1 "Pending: Stories 1.4, 2.3"; FR-2 "None yet / Pending: Story 1.4".

## Tasks & Acceptance

**Execution:**
- `src/lib/limits.ts` -- add `GAME_TITLE_MAX`, `GAME_TITLE_COUNTER_FROM` -- AC1
- `src/lib/game-state.ts` -- states, initial state, six edges, `canTransition`, `Operation`, `PERMITTED` -- AC4
- `src/lib/game.ts` -- `createGameSchema` -- AC1
- `src/lib/format.ts` -- `formatDate(date)` (nb-NO, Europe/Oslo) -- AC2
- `src/lib/errors.ts` -- `NOT_FOUND`, `WRONG_STATE` -- AC3, AC4
- `src/server/db/schema.ts` + `npm run db:generate` -- `game_state` enum, `game` table, committed migration -- AC1, AC4
- `src/server/games/index.ts` -- `create`, `listOwned`, `getOwned`, `lockForMutation`, `transition` -- AC1, AC3, AC4
- `src/app/spill/{layout.tsx,page.tsx,actions.ts,schema.ts,loading.tsx}` -- chrome layout with `requireHost`, list page, create action, skeleton -- AC1, AC2, AC3
- `src/app/spill/[id]/{page.tsx,not-found.tsx,loading.tsx}` -- Game page with breadcrumb, h1, badge, state switch; one not-found page; skeleton -- AC3, AC5
- `src/components/{CreateGameForm,StatusBadge}.tsx`, `src/components/TextField.tsx` (`counter` slot) -- AC1, AC2, AC5
- `src/components/RouteFocus.tsx` -- wait for the `<h1>` with a MutationObserver -- 1.2 deferral, UX-DR15
- `tests/unit/game-state.test.ts` -- `GAME_STATES` has seven in chain order; `TRANSITIONS` equals the six edges; `canTransition` over all 49 pairs; `PERMITTED` lists only known states, every state permits `deleteGame`, `played` permits nothing else; `createGameSchema` boundaries (0, whitespace-only, 1, 80, 81, trimmed) with the exact message; `formatDate` of `2026-11-21T23:30Z` is "22. november 2026" -- AC1, AC4
- `tests/integration/game-state.test.ts` -- with direct `game` rows: `transition` for all 49 pairs (state set first, only the six succeed, the rest are `WRONG_STATE` and leave state unchanged); stale `from` is `WRONG_STATE`. `lockForMutation`: missing → `NOT_FOUND`, wrong state → `WRONG_STATE`, and `updated_at` advances with `hostId` and stays put without it (fake `Date`). Proof of `FOR UPDATE`: inside the transaction, after a lock without `hostId`, the row's `xmax` is non-zero where it was 0 before (fall back to asserting the built SQL contains `for update` if `xmax` proves unreliable on PGlite, and record that). Matrix walk: for every `Operation` and every state, `lockForMutation(states: PERMITTED[op])` succeeds exactly when permitted, else `WRONG_STATE` -- AC4
- `tests/integration/authz.test.ts` -- Hosts A and B. Through the actions and the module: `createGame` creates a draft and redirects to `/spill/{id}`; an empty or 81-char title returns the field error and no row; logged out redirects to `/logg-inn`. For B against A's Game ID: `getOwned` and `lockForMutation({ hostId: B })` reject with the same `DomainError("NOT_FOUND")` as a random UUID and as `"abc"`, and A's `updated_at` stays unchanged. `listOwned(B)` excludes A's Game, and `listOwned(A)` is newest first. The Game page component for B with A's ID calls `notFound()`, exactly like a random UUID. Calling `GamesPage` with `listOwned` forced to fail (drop the `game` table, last in the file) renders the danger Notice text -- AC1, AC2, AC3
- `tests/e2e/games.spec.ts` -- (a) a new Host sees the empty-state sentence; creating "Hyttetur 2026" lands on `/spill/{id}` with breadcrumb `Mine spill › Hyttetur 2026`, `<h1>` "Hyttetur 2026" focused, and badge "Utkast". (b) An empty title shows "Navnet må ha 1–80 tegn." with `aria-invalid="true"` and focus on the field, and an 81-char title shows the same. The counter is absent at 59 characters and reads "60 av 80 tegn" at 60. (c) Two Games are listed newest first, each with a title link, "Utkast" and "Sist endret {formatDate(today)}". (d) Host B in a fresh context opening A's Game URL, a random UUID URL and `/spill/abc` sees the same `<h1>` "Vi finner ikke dette spillet.", the same "Mine spill" link and the same HTTP status, and B's list lacks A's title. (e) Logged out, `/spill` and `/spill/{id}` end on `/logg-inn`. (f) Skeleton and focus: delay the non-prefetch RSC request for the Game page (`page.route`, ~1.5 s), click the Game link on `/spill`, and assert the skeleton becomes visible and the Game page `<h1>` is focused once it streams in. If Next does not show the loading boundary under a delayed request, record why in Design Notes and keep the focus assertion. (g) axe finds no serious or critical violations on `/spill` (empty, with Games, with a field error), the Game page and the Game not-found page. Every interactive element on `/spill` and the Game page shows the focus ring and is at least 44 px high -- AC1, AC2, AC3, AC5, NFR-6
- `tests/TRACE.md` -- rows for every new test; pending lines updated -- epic rule
- `.docs/planning-artifacts/architecture/architecture-Toppsvar-2026-11-21/ARCHITECTURE-SPINE.md` (AD-5 "Rendering") -- append one sentence: a Game page behind `loading.tsx` streams, so its `NOT_FOUND` renders the bokmål not-found UI with status 200 and `noindex`, identical for missing and foreign Games; logged-out redirects happen in the spill layout before streaming -- spine amendment (Delivery convention)

**Acceptance Criteria (from epics.md, the contract):**
- AC1 (FR-2): Given a logged-in Host on `/spill`, when they enter a title of 1 to 80 characters in "Navn på spillet" and click "Lag spill", then a Game is created in *draft* and the Host is taken to its Game page, and an empty or longer title is refused with "Navnet må ha 1–80 tegn.", and the counter appears from 60 characters.
- AC2 (FR-2, UX-DR5): Given a Host with Games, when they open `/spill`, then their Games are listed newest first with title link, StatusBadge state word and "Sist endret {dato}", and a Host with no Games sees "Du har ingen spill ennå. Gi det første et navn over, for eksempel «Hyttetur 2026»."
- AC3 (FR-1, FR-2, AD-5): Given Host A's Game and a logged-in Host B, when B opens A's Game URL or calls any Game action with A's Game ID, then B gets exactly the response given for a Game ID that does not exist ("Vi finner ikke dette spillet." with a link to Mine spill), and A's Game never appears in B's list; `tests/integration/authz.test.ts` exists with this case; logged-out requests to `/spill` and Game pages redirect to `/logg-inn`.
- AC4 (AD-4): Given `src/lib/game-state.ts` with the seven states, the seven transitions and the permitted-operations table, when `games.transition(tx, gameId, from, to)` is called for every pair of states, then only the seven PRD §4.1 transitions succeed (compare-and-set), every other pair is refused, and `games.lockForMutation` takes `SELECT … FOR UPDATE`, throws `NOT_FOUND` or `WRONG_STATE`, and touches `game.updated_at` only on Host calls.
- AC5 (UX-DR16, UX-DR15): Given a Game in *draft*, when its Host opens the Game page, then it shows the breadcrumb `Mine spill › {title}`, the title as `<h1>`, and the StatusBadge "Utkast"; the page chooses its main panel by Game state, so later stories add panels without new routes.

## Spec Change Log

## Review Triage Log

### 2026-11-22 — Review pass
- verdicts: 39 findings — high 0, medium 2, low 34, false 3, maybe-false 0
- findings:
  - `[false]` `[reject]` Intent audit: AC4's "seven transitions" are tested as six — PRD §4.1 has seven "Entered when" rows, creation plus six edges; no seventh pair of states exists for `transition()` (Design Notes).
  - `[low]` `[reject]` Intent audit: no action takes a Game ID, so the module and the page stand in for "any Game action" — none exists in this story; Story 1.5's delete adds the first, with its own `authz.test.ts` case (epic rule).
  - `[low]` `[reject]` Intent audit: the spine was edited to describe the code — the Delivery convention requires a departure to amend the spine in the same PR; the departure is forced by EXPERIENCE.md's Game page skeleton.
  - `[low]` `[patch]` Intent audit: "newest first" by `created_at` vs `updated_at` cannot be told apart by the tests — grouped with the verification-gap row below; patched there.
  - `[false]` `[reject]` Intent audit: sprint status, spec and `drizzle/meta` are missing from the patch — the staged diff left out the spec (the claims file) and generated migration metadata on purpose; sprint status is set at finalize; `drizzle-kit check` proves the journal.
  - `[low]` `[patch]` Intent audit: TRACE.md says `errors.test.ts` checks the `NOT_FOUND`/`WRONG_STATE` wording, but it checks only non-empty — test added asserting both exact messages.
  - `[low]` `[patch]` Verification gap: `listOwned` sort column untested (all fixtures have `created_at = updated_at`) — fixture with an old `createdAt` and a newer `updatedAt` added; it sorts last.
  - `[medium]` `[patch]` Verification gap: CreateGameForm's network-failure path (message, focus on Notice, title kept) untested — e2e test added that aborts the POST.
  - `[low]` `[patch]` Verification gap: logged-out redirect checked only by final URL, so removing the layout guard would pass — e2e now asserts a 3xx with `location` `/logg-inn` for `/spill` and a Game path.
  - `[low]` `[patch]` Verification gap (other): TRACE overclaims `errors.test.ts` — same patch as the intent-audit row.
  - `[low]` `[reject]` Verification gap (other): `not-found.tsx` hardcodes the sentence instead of `MESSAGES.NOT_FOUND` — both are literal UX text and the e2e asserts the page string; `NOT_FOUND` will also cover child IDs later, so tying them is the wrong coupling.
  - `[low]` `[reject]` Blind Hunter: no index on `game.host_id` — a Host has a handful of Games and Host deletion does not exist; an index is unrequested surface.
  - `[low]` `[reject]` Blind Hunter: `requireHost` runs in layout and page — the double read is real but cheap; the claimed loss of the expiry notice does not occur on hard loads, because the layout's redirect sits outside Suspense and decides the response; on client navigation only the page runs. `cache()` adds a wrapper for no visible gain.
  - `[low]` `[patch]` Blind Hunter: counter counts the untrimmed title while the server trims — counter, threshold and live region now use `title.trim().length`.
  - `[low]` `[reject]` Blind Hunter: "80" typed in the message and the limit — literal UX string, same rejection as Story 1.3's password copy.
  - `[low]` `[reject]` Blind Hunter: `NOT_FOUND`'s message names the Game, which later child IDs would misuse — only Games resolve to `NOT_FOUND` in this story; the stories adding child IDs own their wording.
  - `[medium]` `[defer]` Blind Hunter: every page shares the tab title "Toppsvar" (WCAG 2.4.2) — real, but app-wide since Story 1.2 (landing, forms, 404 all share it), not caused by this story; fixing it on two pages would leave the rest inconsistent.
  - `[low]` `[reject]` Blind Hunter: `RouteFocus` can steal focus from a user who tabs during the skeleton; no timeout — the obvious guard ("stop if focus left body") breaks header-link navigation, where the clicked link stays focused; a correct guard needs the focus target recorded at navigation start, more than a direct correction for a slow-load-only case. The observer disconnects on the next pathname change.
  - `[low]` `[reject]` Blind Hunter: only the "Utkast" badge colors are axe-checked — all seven pairs are in DESIGN.md's verified-contrast table; the other states are unreachable until later epics, whose e2e runs axe on them.
  - `[low]` `[reject]` Blind Hunter: the not-found tests do not pin status 200 or `noindex` — the AC asks for identical responses, which is asserted; pinning Next's streaming internals would break on framework changes without a product reason.
  - `[low]` `[reject]` Blind Hunter: the panel `switch` has no `default` — the other six states are unreachable in this story, and each later story adds its case (Design Notes).
  - `[low]` `[patch]` Blind Hunter: TRACE overclaims `errors.test.ts` — same patch as the intent-audit row.
  - `[low]` `[reject]` Blind Hunter: no DB `CHECK` on title length — AD-17 puts validation in module entry points, and `games.create` is the only write path.
  - `[low]` `[reject]` Blind Hunter: no tie-breaker on the sort — two Games from one Host in the same millisecond does not happen through the UI.
  - `[low]` `[patch]` Blind Hunter: the skeleton's fade ignores reduced motion — the fade was not required; `--animate-appear` is now `appear 0s 300ms both` (delay kept, no motion).
  - `[false]` `[reject]` Blind Hunter: the patch is missing the spec and `drizzle/meta` — same refutation as the intent-audit row.
  - `[low]` `[reject]` Blind Hunter: `tests/unit/game-state.test.ts` also tests `createGameSchema` and `formatDate` — cosmetic; TRACE rows name the tests precisely.
  - `[low]` `[reject]` Edge Case Hunter: a crafted multipart POST with `title` as a File gets Zod's English message — unreachable from the UI, no security effect; the 1.3 forms share the pattern.
  - `[low]` `[patch]` Edge Case Hunter: counter counts untrimmed — same patch as the Blind Hunter row.
  - `[low]` `[reject]` Edge Case Hunter: a title of only zero-width characters renders blank — the Host only harms their own list; stripping invisible characters is new validation nobody asked for.
  - `[low]` `[reject]` Edge Case Hunter: emoji count as two characters — counter and server count the same UTF-16 length, so the user sees a consistent limit.
  - `[low]` `[reject]` Edge Case Hunter: same-millisecond sort tie — same as the Blind Hunter row.
  - `[low]` `[reject]` Edge Case Hunter: unbounded list — a Host has a handful of Games; pagination is unrequested.
  - `[low]` `[reject]` Edge Case Hunter: `transition` without a prior lock bypasses ownership — AD-4 makes `lockForMutation` the first step of every state-dependent mutation; `transition` is a writer called inside such a transaction, never an entry point.
  - `[low]` `[reject]` Edge Case Hunter: a Host deleted between `requireHost` and the insert gives `INTERNAL` — Host deletion does not exist.
  - `[low]` `[reject]` Edge Case Hunter: no `default` panel — same as the Blind Hunter row.
  - `[low]` `[reject]` Edge Case Hunter: `RouteFocus` focus steal — same as the Blind Hunter row.
  - `[low]` `[patch]` Edge Case Hunter: the "Sist endret" e2e assertion fails across midnight Oslo time — the date is read before and after creating the Games and either is accepted.
  - `[low]` `[reject]` Edge Case Hunter: stray stderr writes would break the log assertion in `authz.test.ts` — the render is controlled by the test and the pattern is the one 1.3's tests use.

### AI suggestions corrected or rejected (grading evidence)

- **Orchestrator corrected the implementer** before review: the I/O matrix's counter rows for 80 (announced) and 81 characters had no test; the orchestrator added both assertions to `games.spec.ts`.
- **Orchestrator corrected the implementer** after review: the network-failure path of the create form, the layout's real redirect, the `created_at` sort and the two new messages were untested; the counter counted untrimmed text; the skeleton faded regardless of reduced motion; the list test could fail across midnight. All seven patched.
- **Reviewer suggestions rejected:** an index on `host_id`, `cache()` around `requireHost`, a DB `CHECK` on titles, pagination, a sort tie-breaker, zero-width and emoji-aware title counting, a `default` panel, a `RouteFocus` focus guard (the simple version breaks header navigation), pinning Next's streamed status, tying the not-found page to `MESSAGES.NOT_FOUND`, and reading copy numbers from `limits.ts`. Each adds code for an unreachable, harmless or framework-internal case (reasons above).
- **Planning interpretation recorded:** AC4's "seven transitions" read as creation plus six edges (Design Notes), and the AD-5 spine amendment for the streamed not-found status.

## Design Notes

- **"Seven transitions".** PRD §4.1's table has seven "Entered when" rows: creation into *draft* plus six edges between states. `transition(from, to)` acts on pairs of existing states, so it has exactly six legal pairs, and `games.create` is the seventh, the only way into *draft*. No reading yields a seventh state pair, so this is not an intent gap.
- **Layout guard and streaming.** `loading.tsx` starts streaming, which fixes the status at 200. A `redirect()` or `notFound()` inside the page still works (Next streams it, adding `noindex` for not-found). The spill layout runs `requireHost()` outside the Suspense boundary, so logged-out hard loads get a real redirect. A Game not-found streams with status 200 and the bokmål not-found UI, identically for missing, foreign and malformed IDs, which is what FR-1 asks. Moving the ownership check into an `[id]/layout.tsx` would give a real 404, but it would run the only DB read of the Game page before the skeleton and leave the skeleton nothing to cover. AD-5 "Rendering" is amended to say so.
- **Why the panel is a `switch` in the page.** One route, and each later story adds a `case`. A registry or panel map would be an abstraction with one entry.
- **Draft panel copy.** The only literal UX string for a fresh draft is the Question editor's empty state, which is true for every new Game. Story 2.1 adds the editor under the same heading.
- **No `played_at` yet.** Only Story 1.5's purge reads it. That story adds the column and sets it in `transition(playing→played)`.

## Verification

**Commands:**
- `npm run lint && npm run format:check && npm run typecheck` -- expected: exit 0
- `npm test` -- expected: all pass offline (206 existing plus the new tests)
- `npm run test:e2e` -- expected: all specs pass
- `npx drizzle-kit check` and a second `npm run db:generate` -- expected: no new migration

**Manual checks:**
- Screenshots of `/spill` (empty, with Games, with a field error, counter shown), the Game page and the Game not-found page at 1280 and 375 px match DESIGN.md: paper background, surface inputs, berry primary button, pill badge, no shadows or gradients, nothing below 14 px.

## Auto Run Result

Status: done

**Summary.** Hosts can create a Game on `/spill` ("Navn på spillet", "Lag spill", counter from 60, "Navnet må ha 1–80 tegn.") and land on its Game page. "Mine spill" lists their Games newest first, each with a title link, a StatusBadge and "Sist endret {dato}", or shows the empty-state sentence. The Game page has the breadcrumb, the title as `<h1>`, "Utkast", and a main panel chosen by a `switch` on the Game state (draft only so far). Missing, foreign and malformed Game IDs all reach one not-found page, "Vi finner ikke dette spillet.", with a link to Mine spill. The `game` table and `game_state` enum come with a committed migration. `src/lib/game-state.ts` holds the states, the six edges and the permitted-operations table. `games.lockForMutation` (`SELECT … FOR UPDATE`, `NOT_FOUND`/`WRONG_STATE`, `updated_at` only on Host calls) and the compare-and-set `games.transition` are proven against a real DB, the matrix walked in full. A spill layout redirects logged-out hard loads before streaming. Both routes have 300 ms skeletons, and `RouteFocus` now waits for the streamed `<h1>`, which resolves Story 1.2's deferral.

**Files.**
- `src/lib/{game-state,game,format}.ts`, `src/lib/{errors,limits}.ts`: state machine table, title schema, Norwegian date, `NOT_FOUND`/`WRONG_STATE`, title limits.
- `src/server/db/schema.ts`, `drizzle/0001_sharp_slayback.sql` + meta: `game_state` enum and `game` table.
- `src/server/games/index.ts`: `create`, `listOwned`, `getOwned`, `lockForMutation`, `transition`.
- `src/app/spill/{layout,page,loading,actions,schema}.tsx|ts`: chrome layout with the login guard, list page, skeleton, create action.
- `src/app/spill/[id]/{page,not-found,loading}.tsx`: Game page, shared not-found, skeleton.
- `src/components/{CreateGameForm,StatusBadge}.tsx`, `TextField.tsx` (`counter` slot), `RouteFocus.tsx` (waits for the `<h1>`), `src/app/globals.css` (`animate-appear`).
- `ARCHITECTURE-SPINE.md` AD-5 "Rendering": one sentence on the streamed not-found status.
- Tests: `tests/unit/game-state.test.ts`, `tests/integration/{game-state,authz}.test.ts`, `tests/e2e/games.spec.ts`, updates to `errors.test.ts`, `auth-internal.test.ts`, `next-mocks.ts`, `fixtures.ts`, `auth.spec.ts`, `tests/TRACE.md`.

**Review.** 39 findings (high 0, medium 2, low 34, false 3). Patched: 7 entries covering 11 rows (entry verdicts: medium 1, low 6). Deferred: 1 (page titles, medium, app-wide since Story 1.2). Rejected: 27, each with its reason in the triage log.

**Follow-up review recommended: false.** One medium and six low entries were patched, all tests or small display fixes, each now covered by a passing test.

**Verification (after patches, local Node):** `npm run lint` clean; `format:check` clean; `typecheck` clean; `npm test` 237/237 in 19 files; `npm run test:e2e` 39/39; `drizzle-kit check` clean and a second `db:generate` produced no migration. The implementer reviewed screenshots of `/spill` (empty, with Games, field error with counter), the Game page and the not-found page at 1280 and 375 px, and fixed uneven row wrapping on mobile.

**Residual risks.**
- A Game not-found streams with status 200 and `noindex` (spine AD-5 amended); the tests assert equality across missing, foreign and malformed IDs, not the code.
- `RouteFocus` focuses the streamed `<h1>` even if a keyboard user tabbed during a slow load (rejected guard, see triage).
- Page titles are generic app-wide (deferred).
- impeccable `critique`/`audit`/`harden`, `ponytail-review` and `bmad-code-review` are due on the epic branch before the PR (CLAUDE.md), not run here.
