---
title: 'Story 2.3: Invite link page: open, closed and unknown'
type: 'feature'
created: '2026-11-22'
baseline_revision: 'd5cfeafac597a606742fda849b49c3a8b6a5f387'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/.docs/implementation-artifacts/epic-2-context.md'
  - '{project-root}/.docs/planning-artifacts/ux-designs/ux-Toppsvar-2026-11-21/DESIGN.md'
  - '{project-root}/.claude/skills/impeccable/reference/craft-floor.md'
warnings: [oversized]
deferred:
  - summary: >-
      LinkStatus removes storageKey(gameId, token) for any unknown Token, so a truncated or mangled Token that keeps the real Token's first 16 characters deletes the real link's key.
    evidence: |-
      storageKey uses only token.slice(0, 16); a messenger that cuts the link after 16+ characters gives a malformed Token with the same key. Harmless today because nothing writes the key before Story 2.4; from 2.4 on it holds the edit secret and unsent draft. The fix (skip removal unless TOKEN_PATTERN matches) contradicts the literal LinkStatus rule in this spec and AC3's wording, so Story 2.4, which starts writing the key, must settle it.
    location: >-
      src/components/LinkStatus.tsx:17
    severity: medium
---

<intent-contract>

## Intent

**Problem:** Story 2.2 hands out links `<APP_BASE_URL>/svar/<gameId>#<token>`, but `/svar` does not exist: a Participant who taps a link gets the Host 404 with Host chrome. Nothing tells them a link is closed or not valid, and nothing can load the Questions for an open link (FR-6, FR-9, FR-10, FR-11, FR-1).

**Approach:** Add `/svar/[gameId]` as a generic server shell that decides only `unknown` / `closed` / `open` from the Game in the URL, with its own `not-found.tsx` and `error.tsx` and no Host code, plus `Referrer-Policy: no-referrer`. For `open`, a client component reads the Token from the fragment and calls the Server Action `openInviteLink(gameId, token)`, which returns the Game title and Questions or `LINK_UNKNOWN` / `COLLECTION_CLOSED`. Closed and unknown pages remove the link's `localStorage` key. Story 2.3's six ACs in `epics.md` (repeated below) are the contract; AD-5, AD-6, AD-7 and AD-17 govern.

## Boundaries & Constraints

**Always:**
- The implementer first invokes `ponytail` (level `full`), then `impeccable` (no launcher: "Launcher unavailable" path; read `reference/craft-floor.md` right before UI edits). *Operate* mode, phone at 360 px. DESIGN.md and EXPERIENCE.md win. Ponytail never cuts a requirement, validation, error handling, accessibility, anonymity or the tests below.
- **Error codes** (`src/lib/errors.ts`, asserted in `tests/unit/errors.test.ts`): `LINK_UNKNOWN` "Vi finner ikke denne lenken." and `COLLECTION_CLOSED` "Innsamlingen er stengt.".
- **`src/lib/invite-link.ts`** (pure) gains `TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/` (the shape `newToken()` makes) and `storageKey(gameId, token)` = `` `toppsvar:${gameId}:${token.slice(0, 16)}` `` (AD-8; Stories 2.4/2.5 reuse it).
- **`games.find(gameId: string) → { title, state } | null`**: no owner check, malformed or missing ID → `null` (reuse the `UUID` regex), selects only `title` and `state`. Comment: only for the Participant's link page.
- **`questions.ofGame(gameId) → Question[]`** in position order, no owner check; `questions.list` becomes `getOwned` + `ofGame` (behaviour unchanged).
- **`collection.linkStatus(gameId: string) → "unknown" | "closed" | "open"`** and **`collection.openInviteLink(gameId: unknown, token: unknown) → { title, questions: { id, text }[] }`**, both in `withBoundary("collection", …)`. `openInviteLink` order: non-string or unknown Game → `LINK_UNKNOWN`; state not in `PERMITTED.openInviteLink` → `COLLECTION_CLOSED` (**before any Token check**, because close deletes the links); token not a string matching `TOKEN_PATTERN` → `LINK_UNKNOWN`; no `invite_link` row with `token_hash = sha256(token) AND game_id = gameId` → `LINK_UNKNOWN`; else title + `questions.ofGame`. A read: no lock, no transaction, no write, no `updated_at` touch.
- **Action** `src/app/svar/[gameId]/actions.ts` (`"use server"`): `openInviteLink(gameId: unknown, token: unknown) → Promise<ActionResult<…>>` = module call, `toFailure` on error. No `auth`, no `revalidatePath`, no purge.
- **Shell** `src/app/svar/[gameId]/page.tsx`: `metadata = { robots: { index: false, follow: false } }` and no title (the root default renders `<title>Toppsvar</title>`), no Open Graph. `linkStatus(gameId)`: `unknown` → `notFound()`; `closed` → `<LinkStatus status="closed" />`; `open` → `<InviteLinkView gameId />`. All inside `<ParticipantChrome>`. Renders no Game title and no Question.
- **`src/app/svar/not-found.tsx`**: `<ParticipantChrome><LinkStatus status="unknown" /></ParticipantChrome>`, no metadata title. **`src/app/svar/error.tsx`** (client): `ParticipantChrome` + `ServerError`.
- **`next.config.ts`** `headers()`: `/svar/:path*` → `Referrer-Policy: no-referrer`.
- **ESLint zone** for `src/app/svar/**`: also bans `@/server/auth` ("No auth code runs under /svar (AD-6)."), keeping the routes' db/judge ban (a later zone replaces the earlier rule's patterns, so repeat it). `tests/unit/lint-zones.test.ts` gets both cases.
- **`ParticipantChrome`** (`src/components/`, no hooks, usable from client and server): `<header>` with the wordmark "Toppsvar" as plain text (not a link; `font-display`), `<main id="innhold" tabIndex={-1}>` one column, max 560 px (`max-w-140`), 16 px gutter. No nav, skip link, account or link to any Host page.
- **`LinkStatus`** (client): `closed` → `<h1>` "Innsamlingen er stengt." + `<p>` "Verten har stengt innsamlingen, så svar kan ikke lenger sendes inn eller endres."; `unknown` → `<h1>` "Vi finner ikke denne lenken." + `<p>` "Den kan være skrevet feil eller ikke lenger gyldig. Be den som sendte deg den om en ny.". On mount it removes `storageKey(<2nd path segment>, <hash without "#">)` from `localStorage` in a `try` (storage can throw).
- **`InviteLinkView`** (client): on mount reads `location.hash.slice(1)` and calls the action. Loading: "Henter spørsmålene …" (`role="status"`, delayed with `animate-appear`). `LINK_UNKNOWN` / `COLLECTION_CLOSED` → `LinkStatus` with the matching status. Ok → `document.title = "{title} – Toppsvar"`, `<h1>` title and an `<ol>` of the Question texts (Story 2.4 replaces the list with the form). `INTERNAL` or other code → danger Notice with its message; rejected call → `unstable_rethrow`, then `NETWORK`; both with a `secondary` "Prøv igjen" that re-runs the load.
- **Tests:** titles start with the IDs they prove; each e2e test registers its own Host. `tests/TRACE.md`: FR-1, FR-3, FR-6, FR-9, FR-10, FR-11, NFR-4, NFR-6 rows; remove "Story 2.3" from those "Pending" lists, and "None yet." where a row now exists.

**Never:**
- No Token, hash or link in any log, URL the server receives, query string, cookie or rendered server HTML. No Game title or Question in the shell's server HTML.
- No auth or session code under `/svar` (no `requireHost`, `hasSessionCookie`, `HostChrome`, purge); `src/proxy.ts` already skips `/svar` and stays as is.
- No answer form, notice, submission table, edit secret or draft writing (Stories 2.4, 2.5). No lock in `openInviteLink`.
- No new dependency, env var or Route Handler. Do not edit `.logs/`, `prompting/`, or this intent contract.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Open | collecting Game, its token | `{ title, questions }` in position order; client title "{title} – Toppsvar" | — |
| Foreign token | token of Game B, gameId of collecting Game A | `LINK_UNKNOWN` | unknown page |
| Unknown / malformed token | random 43-char token; "abc"; ""; a number | `LINK_UNKNOWN` | unknown page, key removed |
| Revoked | row deleted, Game collecting | `LINK_UNKNOWN`, identical to unknown | unknown page |
| No Game | random UUID; "abc"; deleted Game | `linkStatus` `unknown` → `notFound()`; action `LINK_UNKNOWN` | unknown page, key removed |
| Closed | each state except collecting, any token (valid, unknown, revoked or malformed) | `linkStatus` `closed`; action `COLLECTION_CLOSED` | closed page, key removed |
| DB error | `invite_link` renamed | `INTERNAL`; one log line `{ module, op, code, sqlstate }`, no Token, hash or gameId | "Prøv igjen" |
| Network | action POST aborted | `NETWORK` message, "Prøv igjen" reloads | retry |

</intent-contract>

## Code Map

- `src/proxy.ts:25` -- matcher already excludes `svar(?:/|$)`, so no session cookie is re-set under `/svar`. Read-only.
- `src/app/layout.tsx` -- root metadata `title: { default: "Toppsvar", template: "%s – Toppsvar" }`; a page with no title gets "Toppsvar". `RouteFocus` reads no cookie.
- `src/app/not-found.tsx`, `src/app/error.tsx` -- the root ones read the session / render `HostChrome`; `/svar` needs its own.
- `src/components/HostChrome.tsx` -- header/main markup and classes to mirror (without link, nav, skip link). `src/components/ServerError.tsx` -- 500 body for `svar/error.tsx`. `src/components/Notice.tsx`, `Button.tsx`, `useFormAction.ts` (`NETWORK`).
- `src/components/InviteLinkPanel.tsx` -- pattern for a client component calling a Server Action: import from `@/app/.../actions`, `unstable_rethrow` on rejection, `MESSAGES`.
- `src/server/games/index.ts:31-37` -- `UUID` and `assertGameId`; add `find` beside `getOwned`.
- `src/server/questions/index.ts:58-68` -- `list`; extract `ofGame`.
- `src/server/collection/index.ts` -- add `linkStatus`, `openInviteLink`; `createInviteLinks` shows imports (`sha256`, `inviteLink`, `withBoundary`, `getDb`).
- `src/lib/game-state.ts` -- `PERMITTED.openInviteLink` (collecting) exists. `src/lib/token.ts` -- `sha256`, `newToken`. `src/lib/invite-link.ts`, `src/lib/errors.ts`.
- `eslint.config.mjs` -- `zone()` helper, routes zone; add the svar zone after it.
- `next.config.ts` -- add `headers()`.
- `tests/integration/invite-links.test.ts` -- `newGame` setup pattern (insert Game + Questions directly), `createInviteLinks` action to get real tokens. `tests/integration/auth-internal.test.ts:23` -- `stderrOf` pattern. `tests/integration/next-mocks.ts` -- `NotFoundError`, mocks.
- `tests/e2e/invite-links.spec.ts` -- `createGame`, `addQuestion`, `openCollection` helpers (copy, as 2.2 did), `[data-link]` link texts. `tests/e2e/delete.spec.ts` -- delete flow ("Slett spillet", "Slett for godt"), `page.route` abort. `tests/e2e/fixtures.ts` -- `registerHost`, `seriousViolations`, `FOCUS_RING`.
- `tests/TRACE.md` -- sections listed under Always.

## Tasks & Acceptance

**Execution:**
- `src/lib/errors.ts`, `src/lib/invite-link.ts` -- codes, `TOKEN_PATTERN`, `storageKey` -- AC3–AC5
- `src/server/games/index.ts`, `src/server/questions/index.ts` -- `find`, `ofGame` -- AC4, AC5
- `src/server/collection/index.ts` -- `linkStatus`, `openInviteLink` -- AC3–AC6
- `src/app/svar/[gameId]/actions.ts`, `src/app/svar/[gameId]/page.tsx`, `src/app/svar/not-found.tsx`, `src/app/svar/error.tsx` -- action, shell, unknown, 500 -- AC1–AC4
- `src/components/ParticipantChrome.tsx`, `src/components/LinkStatus.tsx`, `src/components/InviteLinkView.tsx` -- chrome, closed/unknown, open loader -- AC1–AC5
- `next.config.ts`, `eslint.config.mjs` -- header, auth ban -- AC1, AC2
- `tests/unit/errors.test.ts`, `tests/unit/lint-zones.test.ts`, `tests/unit/token.test.ts` -- messages; svar bans auth and still db; `TOKEN_PATTERN` accepts 100 `newToken()`s and rejects 42/44 chars and `+`, `/`, `=`; `storageKey` shape -- AC2–AC5
- `tests/integration/collection.test.ts` -- the I/O matrix through the action and `linkStatus` (closed for all six non-collecting states with a real, an unknown and a revoked token); Questions in position order after a reorder; `game.updated_at` unchanged after open; the shell page rendered with `renderToStaticMarkup` for an open Game holds no title, Question text or token, for a closed Game the closed copy, and throws `NotFoundError` for a missing one; the forced DB error log line -- AC3–AC6
- `tests/e2e/invite-link-page.spec.ts` -- (a) `page.request.get` of a valid link's path: `<title>Toppsvar</title>`, robots `noindex`, no `og:` meta, no Game title or Question text, `referrer-policy: no-referrer`; opening it in the browser shows the title as `<h1>`, document title "{title} – Toppsvar" and the Question, and no request URL recorded by `page.on("request")` contains the Token; (b) in the Host's own context (session cookie): no "Logg ut", "Mine spill", "Hopp til innhold", no `a[href^="/spill"]` or `a[href="/"]`, and the document response has no `set-cookie`; (c) random UUID, "abc" gameId, malformed token, unknown token, and the link of a deleted Game each show the unknown heading and body, with a pre-seeded `storageKey` gone; (d) a *draft* Game's ID with a made-up token shows the closed copy and the key is removed; (e) 360 px: no horizontal scroll and axe has no serious or critical violations on the open, closed and unknown pages; (f) aborted action POST → `NETWORK` with "Prøv igjen", which loads the Questions once the route is released -- AC1–AC4, NFR-4, NFR-6
- `tests/TRACE.md` -- rows as listed under Always -- epic rule

**Acceptance Criteria (from epics.md, the contract):**
- AC1 (FR-11, AD-7 · e2e): Given a valid Invite link, when the browser requests `/svar/<gameId>`, then the server HTML has `<title>Toppsvar</title>`, `noindex`, no Open Graph tags, no Game title and no Questions, the response carries `Referrer-Policy: no-referrer`, and no request URL the server receives contains the Token.
- AC2 (FR-1, UX-DR27 · e2e): Given a browser that also holds a Host session cookie, when it opens an Invite link, then the page shows no login, account indicator, Host chrome or link to any Host page, and no session is read.
- AC3 (FR-9, FR-3, UX-DR19 · e2e): Given a non-existent `gameId`, a malformed Token, an unknown Token, or a deleted Game, when the link is opened, then each shows the same page, "Vi finner ikke denne lenken." with "Den kan være skrevet feil eller ikke lenger gyldig. Be den som sendte deg den om en ny.", and the link's `localStorage` key is removed.
- AC4 (FR-10 · integration + e2e): Given a Game whose state is not *collecting*, when any of its links is opened, then the page shows "Innsamlingen er stengt." with "Verten har stengt innsamlingen, så svar kan ikke lenger sendes inn eller endres.", decided from the Game in the URL before any Token lookup, and the `localStorage` key is removed.
- AC5 (FR-6 · integration): Given a valid link of a *collecting* Game, when the client calls `openInviteLink(gameId, token)`, then it returns the Game title and the Questions in position order, and the client sets the title "{Game title} – Toppsvar"; and a Token that belongs to another Game returns `LINK_UNKNOWN`, because lookup is by `(token_hash, game_id)`.
- AC6 (FR-11 · integration): Given a forced DB error inside `openInviteLink`, when the action fails, then it returns `INTERNAL`, and the log output holds only `{ module, op, code, sqlstate }`, with no Token or hash.

## Spec Change Log

## Review Triage Log

### 2026-11-22 — Review pass
- verdicts: 30 findings — high 0, medium 8, low 15, false 7, maybe-false 0
- findings:
  - `[medium]` `[patch]` Verification gap: the client `COLLECTION_CLOSED` branch of `InviteLinkView` was never run — new e2e test rewrites a real `LINK_UNKNOWN` action response (via `route.fetch()`) to `COLLECTION_CLOSED`: closed copy, no alert, seeded key removed.
  - `[medium]` `[patch]` Verification gap: the resolved `INTERNAL` branch was never run (the abort test hits the network catch) — same test rewrites to `INTERNAL`: danger alert with the message and "Prøv igjen", no unknown/closed copy, seeded key kept.
  - `[medium]` `[patch]` Edge Case Hunter: `/svar`, `/svar/<id>/x` fall to the root not-found, which reads the session cookie and shows Host chrome — added `src/app/svar/page.tsx` and `src/app/svar/[gameId]/[...rest]/page.tsx` (only `notFound()`); e2e in the Host's context shows the unknown page with no "Mine spill"/"Logg ut"/nav.
  - `[medium]` `[defer]` Edge Case Hunter: a malformed Token sharing the real Token's first 16 characters deletes the real link's key — no data exists in the key before Story 2.4, and the guard contradicts the spec's LinkStatus rule and AC3 wording; deferred to Story 2.4 (frontmatter `deferred`).
  - `[low]` `[patch]` Edge Case Hunter: a fragment-only change (pasted replacement link, FR-9) does not reload, so the old view stays — `InviteLinkView` reloads on `hashchange`; e2e sets `location.hash` to the valid Token and sees the Game title.
  - `[low]` `[reject]` Edge Case Hunter: close between `games.find` and the link select gives `LINK_UNKNOWN` instead of `COLLECTION_CLOSED` — a millisecond window in a read; the visible result (a dead link, key cleared) is the same class, and the fix needs a second state read or a cross-module transaction. Story 3.1 owns close.
  - `[low]` `[reject]` Edge Case Hunter: an upper-case or percent-encoded gameId yields a different storage key — links are generated lower-case UUIDs; only a hand-edited URL differs.
  - `[low]` `[patch]` Edge Case Hunter: the AD-6 auth ban misses the Participant components in `src/components` — the svar zone now lists `InviteLinkView.tsx`, `LinkStatus.tsx`, `ParticipantChrome.tsx`; lint-zones case added.
  - `[false]` `[reject]` Intent alignment: sprint status, triage log and spine amendment are not in the diff — the run was at review; finalization writes and commits them.
  - `[low]` `[patch]` Intent alignment: the AC2 lint ban does not cover the components — same entry as the Edge Case Hunter row above.
  - `[false]` `[reject]` Intent alignment: unknown Game (server 404) and unknown Token (client, 200) differ in HTTP status — AC3 is about the page shown, which is one component; AD-5 mandates `notFound()` for the segment, and the shell reveals Game existence by design (AD-7).
  - `[false]` `[reject]` Intent alignment: the closed e2e uses a *draft* Game — recorded design note; no close screen exists before Epic 3, e2e cannot write the server's PGlite, and integration covers real and revoked Tokens in all six states; the rewritten-response e2e now also covers the client closed path.
  - `[low]` `[reject]` Intent alignment: `page.request.get` of the shell shares the Host's cookie — nothing under `/svar` reads a cookie (lint ban, proxy matcher), and the browser half of the test runs in a fresh cookieless context.
  - `[false]` `[reject]` Intent alignment: the client title is only tested e2e — e2e is AC5's client surface; the action half is integration-tested.
  - `[medium]` `[patch]` Intent alignment: unmatched `/svar` paths fall to the root not-found — same entry as the Edge Case Hunter row.
  - `[false]` `[reject]` Intent alignment: a `gameId` alone reveals existence and collecting state — AD-7's shell rule shows `unknown`/`closed`/`open` from the Game by design; only title and Questions are Token-gated.
  - `[false]` `[reject]` Intent alignment: additions beyond the ACs (Question list, retry, `svar/error.tsx`, lint refactor, `ofGame`) — each comes from EXPERIENCE.md, AD-5 or the spec.
  - `[low]` `[patch]` Blind Hunter: hash-only navigation does not reload, and a late response could overwrite a newer one — same entry as the `hashchange` row; the reload makes the stale response moot.
  - `[low]` `[reject]` Blind Hunter: close race between the two reads — same as the Edge Case Hunter row.
  - `[low]` `[reject]` Blind Hunter: `games.find` and `questions.ofGame` have no owner check and any route may call them — both are named and commented for `/svar`, the spine's module table now says "no owner check, for /svar", and their only callers resolve the Game first; an export-level lint ban adds config for a hypothetical caller.
  - `[medium]` `[patch]` Blind Hunter: mistyped `/svar` URLs land on the Host 404 — same entry as the Edge Case Hunter row.
  - `[low]` `[patch]` Blind Hunter: the auth ban misses the Participant components — same entry as above.
  - `[low]` `[reject]` Blind Hunter: closed and unknown pages keep the generic title "Toppsvar" — AD-7 fixes the shell's `<title>Toppsvar</title>` for every status, and each page has a clear `<h1>`.
  - `[medium]` `[patch]` Blind Hunter: "Prøv igjen" unmounts itself and focus drops to `<body>` — after a retried load settles, focus goes to the new `<h1>` (`tabindex=-1`) or back to "Prøv igjen" if it failed again; the abort e2e presses Enter and asserts the `<h1>` is focused.
  - `[medium]` `[patch]` Blind Hunter: the client closed and `INTERNAL` branches have no test — same entry as the verification-gap rows.
  - `[low]` `[reject]` Blind Hunter: `LinkStatus` duplicates `MESSAGES.LINK_UNKNOWN`/`COLLECTION_CLOSED` — they are different strings by purpose: Story 2.7 gives `LINK_UNKNOWN` the Host's inline message "Denne lenken er ikke en aktiv lenke i dette spillet.", so coupling would break the Participant page.
  - `[false]` `[reject]` Blind Hunter: parsing the gameId from `location.pathname` breaks on a trailing slash or encoding — Next redirects a trailing slash away, there is no base path, and Game IDs are UUIDs.
  - `[low]` `[reject]` Blind Hunter: `TOKEN_PATTERN` belongs next to `newToken()` — no named harm; `token.ts` imports `node:crypto`, and the pattern sits with the other link helpers the spec placed in `invite-link.ts`.
  - `[low]` `[patch]` Blind Hunter: the `storageKey` test is titled FR-7 but traced under FR-9 — retitled "FR-9, AD-8: …".
  - `[low]` `[patch]` Blind Hunter: the `MutationObserver` title workaround fights Next unmarked — kept (the implementer saw Next rewrite `<title>` after the action resolves) and given a `shortcut:` comment.

### AI suggestions corrected or rejected (grading evidence)

- **Orchestrator corrected the planning reading of AD-7:** the spine checked the Token first, but close deletes every link (AD-9), so after close every Token would look unknown. The spec put the Game state first (AC4, EXPERIENCE) and the spine's AD-7 line was amended.
- **Orchestrator corrected the implementer after review:** unmatched `/svar` URLs showed Host chrome and read the session; the auth lint ban missed the Participant components; a pasted replacement link did not load; "Prøv igjen" dropped focus; two client branches had no test (closed via the action and `INTERNAL`); a test title disagreed with TRACE.md; the title workaround lacked a `shortcut:` marker.
- **Reviewer suggestions rejected:** reusing `MESSAGES` for the page copy (Story 2.7 changes `LINK_UNKNOWN`'s message for the Host), page titles for closed/unknown (AD-7 fixes the shell title), lint bans for single exports, moving `TOKEN_PATTERN`, a second state read for a millisecond close race, case-folding the gameId, a cookieless shell request, and seven claims refuted outright. Reasons are in the rows above.
- **Implementer departure accepted:** a `MutationObserver` re-applies `document.title`, because Next re-renders the root `<title>` after the Server Action resolves (observed with mutation logging); marked `shortcut:`.
- **Deferred, not dropped:** a mangled Token that keeps the first 16 characters deletes the real link's key; harmless until Story 2.4 writes the key, which must settle it.

## Design Notes

- **State before Token.** AD-7's lookup order put the Token first, but `collection.close` (AD-9) deletes every `invite_link` row, so after close every Token would look unknown. AC4 and EXPERIENCE ("the Game state is checked first") need *closed* to win. `openInviteLink` therefore checks the Game, then the Token; it is a read and takes no lock. The spine's AD-7 line is amended: submit (Story 2.4) still locks and re-checks both under the lock.
- **Shell vs. client.** The server knows only the `gameId`, so it can decide *unknown* and *closed* itself; *open* needs the Token, which never leaves the browser except in the action's POST body. An unknown Game uses `notFound()` into the segment's `not-found.tsx` (AD-5), so the page is the same component as a client-side `LINK_UNKNOWN`.
- **"No session is read"** is enforced, not just observed: the ESLint zone bans `@/server/auth` under `src/app/svar`, the proxy matcher skips `/svar`, and the e2e test checks there is no `set-cookie` on the document while a session cookie is present.
- **Closed e2e uses a *draft* Game.** No screen can close Collection before Epic 3, and e2e cannot write the running server's PGlite directory. A *draft* Game is "not collecting" too, and the state is decided before the Token, so any made-up Token proves the path; the integration test covers all six non-collecting states with real and revoked Tokens.

## Verification

**Commands:**
- `npm run lint && npm run format:check && npm run typecheck` -- expected: exit 0
- `npm test` -- expected: all pass offline
- `npm run test:e2e` -- expected: all specs pass

**Manual checks:**
- Open, closed and unknown pages at 360 px and 320 px: one column, 16 px gutter, wordmark only, no horizontal scroll, text at least 14 px.

## Auto Run Result

Status: done

**Summary.** A Participant's link `/svar/<gameId>#<token>` now opens a generic server shell (`<title>Toppsvar</title>`, `noindex, nofollow`, no Open Graph, no Game title or Question, `Referrer-Policy: no-referrer`, no session read) that decides only *unknown*, *closed* or *open* from the Game in the URL. For *open*, the client reads the Token from the fragment and calls the Server Action `openInviteLink`, which checks the Game state before the Token (close deletes the links) and looks the link up by `(token_hash, game_id)`, returning the title and the Questions in position order; the client sets "{title} – Toppsvar". Missing Games, malformed, unknown, foreign and revoked Tokens and deleted Games all show "Vi finner ikke denne lenken."; any Game not *collecting* shows "Innsamlingen er stengt."; both remove the link's `localStorage` key. A DB error is `INTERNAL` with one log line of `{ module, op, code, sqlstate }`.

**Files.**
- `src/lib/errors.ts`, `src/lib/invite-link.ts`: `LINK_UNKNOWN`, `COLLECTION_CLOSED`; `TOKEN_PATTERN`, `storageKey`.
- `src/server/games/index.ts`: `find` (title and state, no owner check). `src/server/questions/index.ts`: `ofGame`; `list` uses it.
- `src/server/collection/index.ts`: `linkStatus`, `openInviteLink`.
- `src/app/svar/[gameId]/{page,actions}.tsx|ts`, `src/app/svar/{not-found,error,page}.tsx`, `src/app/svar/[gameId]/[...rest]/page.tsx`: shell, action, unknown page, 500, catch-alls.
- `src/components/{ParticipantChrome,LinkStatus,InviteLinkView}.tsx`: wordmark-only chrome, closed/unknown copy with key removal, open loader with retry, focus and title.
- `next.config.ts` (`Referrer-Policy`), `eslint.config.mjs` (no `@/server/auth` under `/svar` or in the Participant components).
- Tests: `tests/integration/collection.test.ts`, `tests/e2e/invite-link-page.spec.ts`; additions to `errors`, `lint-zones`, `token`, `error-pages` unit tests; `tests/TRACE.md` FR-1, FR-3, FR-6, FR-9, FR-10, FR-11, NFR-4, NFR-6.
- `ARCHITECTURE-SPINE.md`: AD-7 lookup order (state first; open is a read; submit locks and re-checks), `games.find` and `questions.ofGame` in the module table.

**Review.** 30 findings (high 0, medium 8, low 15, false 7). Patched 7 entries (medium 3: unmatched `/svar` URLs, retry focus, untested client branches; low 4: lint scope, `hashchange`, test title, `shortcut:` comment). Deferred 1 (medium, for Story 2.4). Rejected 15 rows with reasons in the triage log.

**Follow-up review recommended: true.** Three medium entries were patched. The unverified risk: the rewritten-response e2e depends on the RSC flight format of a Server Action response (it asserts the replaced strings are present, so it fails loudly rather than silently), and the `hashchange` reload and retry focus are proven only in Chromium.

**Verification.** `lint`, `format:check`, `typecheck` clean; `npm test` 325 passed in 28 files; `npm run test:e2e` 69 passed. All offline, no key. The implementer checked the open, closed and unknown pages at 360 and 320 px (one column, wordmark only, no horizontal scroll, 16 px text).

**Residual risks.** The title workaround re-applies `document.title` against Next's head re-render (`shortcut:`); a close racing an open can show *unknown* instead of *closed*; a mangled Token keeping the first 16 characters clears the real link's key (deferred to Story 2.4); `games.find` and `questions.ofGame` have no owner check by design and rely on naming and the spine's module table.

**Spine amendments.** AD-7 lookup order: the Game state first (no Game → `LINK_UNKNOWN`, not *collecting* → `COLLECTION_CLOSED`), then the Token by `(token_hash, game_id)`; `openInviteLink` is a read without lock, `submitAnswerSet` locks and re-checks. Module table: `games` exports `find` (read, no owner check, for `/svar`), `questions` exports `ofGame` (read).

**Deferred item resolved in Story 2.4 (2026-11-22).** Orchestrator decision: the key's value is JSON `{ token, editSecret }` holding the full Token, and `LinkStatus` removes the key only when the stored Token equals the current one exactly (`clearLinkStore` in `src/lib/invite-link.ts`). AC3/AC4 still hold for the actual link; a cut-short or mangled Token sharing the first 16 characters keeps the real link's value. The 2.3 e2e tests now seed `JSON.stringify({ token })`, and a cut-short-link test was added. See `spec-2-4-answer-form-and-first-submission.md`, Design Notes.
