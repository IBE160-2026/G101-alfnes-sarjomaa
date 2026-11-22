# Epic 1 code review (bmad-code-review)

- **Date:** 2026-11-22
- **Scope:** `git diff fase-3-planlegging..epic-1-fundament` (118 files, stories 1.1 to 1.5). The reviewers read the diff without `package-lock.json`, `drizzle/meta`, `.docs` and `prompting`: 7,083 lines.
- **Mode:** `full`. Checked against `epics.md` (Epic 1), `spec-1-1` to `spec-1-5`, `epic-1-context.md`, `ARCHITECTURE-SPINE.md` and the PRD.
- **Layers:** Blind Hunter, Edge Case Hunter, Verification Gap and Acceptance Auditor. All four completed and none failed.
- **Triage:** every claim was checked against the code at the cited lines. Items that the per-story reviews had already rejected were dismissed unless a reviewer brought a new argument.
- **Test run:** `npx vitest run` passed 22 files and 264 tests in 7.4 s, with no network and no use of git.
- **No fixes were applied.** No source file, story spec or sprint status was changed.

## Summary

| Severity | Count | Routing |
|---|---:|---|
| High | 0 | — |
| Medium | 1 | defer (unverified, would be medium if true) |
| Low | 13 | 11 patch, 2 defer |
| Dismissed | 27 | see the last section |

No finding breaks an acceptance criterion that a test or the examiner would hit.

These areas came out clean:

- **Authorization (IDOR on Games).** `getOwned`, `deleteOwned` and `lockForMutation` all filter by `host_id`. Missing, foreign and malformed IDs all get the same `NOT_FOUND`.
- **CSRF.** Every mutation is a Server Action, which goes through Next's Origin/Host check. `/api/purge` needs a bearer secret, which is compared in constant time.
- **Cookie flags.** `httpOnly`, `SameSite=Lax`, 14-day `Max-Age`, `Secure` when the URL is https. The database stores only the token hash.
- **Lockout.** The counter increments atomically and the lock is re-checked before each write.
- **Layer rules.** The rules are enforced by ESLint, and a test pins them.
- **Table ownership.** `auth` owns `host` and `session`; `games` owns `game`.
- **Examiner path.** Tests use in-memory PGlite and a mock Judge, need no keys, and do not read `.git`.

The remaining findings are mostly tests that don't cover a guard, places where code has drifted from a convention, and documentation that overstates coverage.

## Findings

### Medium

#### M1. The 14-day logout notice can be lost when the layout and the page both call `requireHost` (defer, unverified)

- **Source:** edge-case-hunter, plus the orchestrator's own reading.
- **Location:** `src/app/spill/layout.tsx:14`, `src/app/spill/page.tsx:21`, `src/app/spill/[id]/page.tsx:21`, `src/server/auth/session.ts:50-52`.
- **Failure scenario:**
  1. A Host comes back after 14 idle days and does a hard load of `/spill`.
  2. `readSession` deletes an expired row on first sight and returns `"expired"`. A second call on the same token then finds no row and returns `"missing"`.
  3. If Next renders the page's `requireHost` before the layout's call reads the row, the page deletes the row first.
  4. The layout then gets `"missing"` and redirects to `/logg-inn` without `?utlopt=1`. The Host sees no "Du ble logget ut etter 14 dager uten bruk" notice, which Story 1.3 AC3 (FR-1) requires.
- **New argument:** spec 1.4 rejected this by saying "the layout's redirect sits outside Suspense and decides the response". That is true, but it does not cover the case where the page's call deletes the row before the layout's call reads it.
- **Why unverified:** I could not establish whether Next 16 starts rendering the page segment before the layout's async body resolves. No e2e test covers expiry: spec 1.3 rejected joining the expiry test end to end.
- **What would settle it:** an e2e run that backdates `session.expires_at` and hard-loads `/spill/{id}` repeatedly, checking every redirect for `utlopt=1`.
- **Recommended fix if confirmed (either one):**
  - wrap `requireHost` in React `cache()` so that it runs once per request, or
  - have `readSession` return `"expired"` without deleting the row, and leave the cleanup to logout or login.

### Low (patch)

#### L1. The 24-hour lockout cap has no test

- **Source:** verification-gap.
- **Location:** `src/server/auth/index.ts:111-116`. Tests stop at `tests/integration/auth.test.ts:165-204`.
- **Failure scenario:** someone removes `Math.min(..., LOCKOUT_MAX_MS)`. The 16th failure then locks for about 34 h, the 17th for about 68 h, and so on, and every test still passes. Anyone who knows a Host's email could lock that Host out for days.
- **Recommended fix:** with a fake `Date`, set `failed_logins = 15`, make one wrong attempt, and assert `locked_until == now + 24 h`.

#### L2. The lockout's guards against parallel attempts are untested on the wrong-password path

- **Source:** verification-gap.
- **Location:** `src/server/auth/index.ts:105-110` (`.where(stillOpen)`) and `:119-124` (`greatest(...)`).
- **Failure scenario:**
  - Today's "locked" test starts with the account already locked. The early return at `:96-97` therefore rejects it before the guarded update runs.
  - Replacing `stillOpen` with `eq(host.id, row.id)`, or dropping `greatest`, passes every test.
  - Without those guards, queued wrong attempts keep raising the count and lengthening a lock that is already in place. A late write could also shorten a longer lock.
- **Recommended fix:** add a race test modelled on `auth.test.ts:224`, but with a wrong password. Assert that `failed_logins` and `locked_until` are unchanged after a lock lands mid-scrypt.

#### L3. On the Game page, a database error is not tested to stay separate from "not found"

- **Source:** verification-gap.
- **Location:** `src/app/spill/[id]/page.tsx:12-15`.
- **Failure scenario:** someone changes the catch to call `notFound()` for every error, and all tests still pass. During a database outage the Host would then read "Vi finner ikke dette spillet." instead of the 500 page.
- **Recommended fix:** add one case to the dropped-table block of `tests/integration/authz.test.ts`, asserting that `GamePage` rejects with `DomainError` code `INTERNAL`.

#### L4. The title counter's trimming has no test

- **Source:** verification-gap.
- **Location:** `src/components/CreateGameForm.tsx:48`. The test is `tests/e2e/games.spec.ts:88-98`.
- **Failure scenario:** reverting to `title.length` passes the e2e test, because it only types `"a".repeat(n)`. A valid title with spaces around it would then be announced as "82 av 80 tegn". That fix was the patch from the Story 1.4 review.
- **Recommended fix:** add one `fill` with `" " + "a".repeat(80) + " "` and expect "80 av 80 tegn".

#### L5. The cascade test only sees tables that point straight at `game`

- **Source:** acceptance-auditor.
- **Location:** `tests/integration/delete.test.ts:56-65` and `:127-129`.
- **Failure scenario:**
  - `foreignKeysTo("game")` only matches constraints where `confrelid = 'game'`.
  - The spine's later tables hang off other tables: `answer`, `answer_group`, `grouping_result` and `board_slot` off `question`; `submission` off `invite_link`; `reveal` off `board_slot` and `team`.
  - If one of those keys gets Drizzle's default `NO ACTION`, deleting a Game fails with `INTERNAL`, and this test stays green.
  - The test claims to cover "tables added by later stories without touching this test", and `epic-1-context.md:52` relies on it.
- **Recommended fix:** use a recursive CTE over `pg_constraint`, starting from `game`, and assert `confdeltype = 'c'` on every edge.

#### L6. The retention limits are not in `src/lib/limits.ts`

- **Source:** acceptance-auditor.
- **Location:** `src/server/games/index.ts:136-161` (`DAY_MS`, inline `30 *` and `90 *`) and `:163` (a second `HOUR_MS`).
- **Failure scenario:**
  - The spine's Limits convention (`ARCHITECTURE-SPINE.md:451`) names "retention 30/90 days" as living only in `limits.ts`.
  - The demo, README or UI copy in a later story will read `limits.ts` and miss these values, or define them a second time.
- **Recommended fix:** move `RETENTION_PLAYED_MS`, `RETENTION_IDLE_MS` and `PURGE_INTERVAL_MS` to `limits.ts`.

#### L7. The delete action's foreign-ID case is not in `authz.test.ts`

- **Source:** acceptance-auditor.
- **Location:** the case is at `tests/integration/delete.test.ts:105`. It is missing from `tests/integration/authz.test.ts`.
- **Failure scenario:**
  - `epics.md:227` and `epic-1-context.md:52` make `authz.test.ts` the one checklist that every Host action adds to.
  - The first action on a Game ID already lives somewhere else. Later epics copying the pattern will scatter the cases, and the AD-5 audit gets harder.
- **Recommended fix:** move the case into `authz.test.ts`, or duplicate it there.

#### L8. The `lockForMutation` comment claims more than the code does

- **Source:** acceptance-auditor.
- **Location:** `src/server/games/index.ts:72`. Compare `:39-42` (`create`), `:109-113` (`transition`) and `:144-158` (`purgeExpired`).
- **Failure scenario:**
  - The comment says this is "the only way a mutation reaches a Game row". But `create`, `transition` and the bulk purge write to `game` without it.
  - The code is safe today: under READ COMMITTED, Postgres re-checks the purge's WHERE clause after waiting for a lock.
  - A later story that trusts the comment could skip a lock it needs.
- **Recommended fix:** reword the comment to "the only way a Host or Player mutation locks a Game row; `purgeExpired` deletes in bulk".

#### L9. `.nvmrc` says `22`, but the stated floor is 22.13

- **Source:** acceptance-auditor.
- **Location:** `.nvmrc:1`. Compare `package.json` `engines: ">=22.13"`.
- **Failure scenario:** a machine that only has an older 22.x installed gets it from `nvm use`. That breaks Story 1.1 AC1, and the examiner may hit it on a fresh clone.
- **Recommended fix:** write `22.13`, or `lts/jod`.

#### L10. `tests/TRACE.md` claims coverage that the tests do not prove

- **Source:** blind-hunter.
- **Location:** `tests/TRACE.md:244` and `tests/TRACE.md:292`.
- **Failure scenario:** the examiner reads TRACE.md as the evidence for the testing criterion, so wrong claims cost credibility.
  - Line 244 says `guards.test.ts` "runs the mock Judge". It only asserts `env.JUDGE_PROVIDER === "mock"`, because no Judge exists yet.
  - Line 292 says the skeleton "fades in". `globals.css:93` says "no fade".
- **Recommended fix:** reword both lines to what the tests assert.

#### L11. The registration code is compared without trimming

- **Source:** blind-hunter and edge-case-hunter.
- **Location:** `src/lib/account.ts:17` and `src/server/auth/index.ts:49-51`.
- **Failure scenario:** a code pasted or autocompleted with a trailing space, which mobile keyboards often add, is refused as `REGISTRATION_CODE_WRONG` with no hint why. This applies to the pilot only: locally the code is unset.
- **Recommended fix:** use `registrationCode: z.string().trim()`. Passwords stay untrimmed.

### Low (defer)

#### L12. `npm run db:migrate` (the Postgres path) is never run by a test or CI

- **Source:** verification-gap, filed as `defer`.
- **Location:** `src/server/db/migrate.ts:19-25` and `src/cli/db-migrate.ts:3`.
- **Failure scenario:** inverting the driver check, or dropping the `migrateDb` call, passes every test. A hosted Postgres would then ship with no tables. The code is correct today.
- **Deferred because:** no Postgres runs offline. Before Story 7.5, add a unit test that mocks `openDb` to return a postgres handle and checks the `migrateDb` call, or rely on the planned CI Postgres job (Story 7.3).

#### L13. The spine still uses names the code does not have

- **Source:** acceptance-auditor.
- **Location:** `ARCHITECTURE-SPINE.md:153` and `:314`, and the Structural Seed and AD-1 table.
- **Failure scenario:**
  - AD-6 names `auth.getSession`, but the function is the internal `readSession` behind `requireHost`.
  - AD-17's list of redirect flows leaves out register.
  - `src/server/health.ts` and `src/server/boundary.ts` are not in the seed.
  - Later stories built from the spine will look for names that do not exist.
- **Deferred because:** the fix edits the architecture document, which is agent context, not code. Do it in a docs commit on `main`.

## Dismissed findings

| # | Source | Finding | Reason |
|---|---|---|---|
| 1 | blind, edge, verification | A crafted `?slettet=` shows a fake "deleted" notice; an empty value shows «» | Rejected in the 1.5 review (Design Notes, same mechanism as `?utlopt=1`). React escapes the text. No new argument. |
| 2 | blind, edge | A failed delete's error shows again when the dialog is reopened | Rejected in the 1.5 review. No new argument. |
| 3 | edge | Esc or Avbryt during a pending delete hides a later error | Rejected in the 1.5 review. No new argument. |
| 4 | blind | The 500 pages have no "Prøv igjen" button or link | Rejected in the 1.2 review: EXPERIENCE.md fixes the copy, and the wordmark links to `/`. Showing signed-out chrome on an error is cosmetic. |
| 5 | blind, edge | A dead session cookie is renewed forever, so the 404 shows the signed-in nav | Rejected in the 1.3 review and recorded in its known limits. |
| 6 | edge | A GET or prefetch carrying an old token overwrites a new login or logout cookie | Rejected in the 1.3 review. No new argument. |
| 7 | blind | Expired and orphaned session rows pile up | Rejected in the 1.3 review: the rows are tiny. |
| 8 | blind | No index on `game.host_id` or `session.host_id` | Rejected in the 1.3 and 1.4 reviews: pilot scale, and Hosts cannot be deleted yet. |
| 9 | blind | The lockout counter never decays, so a known email can keep a Host locked out | This is the policy spec 1.3 set (it resets only on a correct password), so the fix would edit the spec. The missing rate limit already has a `shortcut:` note (`password.ts:17`). |
| 10 | edge | The count update and the lock write are two statements, so a parallel correct login can slip in between | False as a security issue: getting through needs the right password, so a brute-force attacker gains nothing. The fix is a CASE update, more than a direct correction. |
| 11 | edge | Lock claim (commit 687f7ad): "re-checked in every write" | Same root cause as #10. |
| 12 | blind | UI copy writes "10 tegn", "80 tegn" and so on instead of reading `limits.ts` | Rejected in the 1.3 review (literal UX strings). |
| 13 | blind | `CRON_SECRET` has no minimum length | Rejected in the 1.1 review. |
| 14 | blind | No cron entry or README note calls `/api/purge` | Rejected in the 1.5 review: deployment is Story 7.5, and Host traffic triggers the purge. |
| 15 | verification, edge | A cyclic `cause` chain makes `sqlstateOf` loop forever | Rejected in the 1.1 review: drivers never build cyclic causes. |
| 16 | blind | The race test in `auth.test.ts:233` waits a fixed `setTimeout(50)` | Low. In-memory PGlite reads the row within milliseconds, and if timing ever flips, the test still refuses correctly. A real signal needs a hook into the scrypt queue. |
| 17 | blind | `trace.test.ts` only checks headings | By design (SM-1). The content errors are covered by L10. |
| 18 | blind | CI uploads no Playwright traces and has no `timeout-minutes` or `concurrency` | No defect. This is CI hardening nobody asked for. |
| 19 | blind | A signed-in Host can still open `/`, `/logg-inn` and `/registrer` | Rejected in the 1.3 review. |
| 20 | blind | `next.config.ts` traces `./data/rulings/**`, which does not exist yet | False: the spine prescribes it for replay rulings, and the auditor confirmed it matches. |
| 21 | blind | `ConfirmDialog` hard-codes its backdrop colour | The value equals DESIGN.md's `backdrop` token (`rgba(30, 26, 34, 0.55)`). Cosmetic. |
| 22 | blind | "Mine spill" has no `aria-current` | Low. The nav has a single item and WCAG 2.1 AA does not require it. |
| 23 | edge | The Game page has a panel only for `draft` | False as a defect: Epic 1 can only create draft Games. Spec 1.4 lets later stories add their panels. |
| 24 | acceptance | Components reach `src/app` actions in two different ways | No harm named, and no rule broken. |
| 25 | orchestrator | `Secure` is off when `APP_BASE_URL` is unset in production | Spec 1.3 and AD-6 mandate deriving it from `APP_BASE_URL`. Deployment config belongs to Story 7.5. |
| 26 | orchestrator | CSRF on Server Actions | False: Next 16 Server Actions check Origin against Host. There are no GET mutations, and `/api/purge` needs a bearer secret. |
| 27 | orchestrator | IDOR on Games | False: every Host read and write filters by `host_id`, and `authz.test.ts` and `delete.test.ts` cover foreign, random and malformed IDs. |

## Epic 1 review fixes (2026-11-22)

Commits on `epic-1-fundament`: `3a889ba` (titles and UI), `caf2930` (delete notice and session cache), `327f045` (tests and conventions), `531dff0` (simplification).

| ID | Status | Note |
|---|---|---|
| M1 | fixed (`caf2930`) | `requireHost` is wrapped in React `cache()`, so the spill layout and the page share one session read per request. `tests/integration/session-expiry.test.ts` backdates a session, renders the layout and `/spill` one after the other within one request and checks that both redirect to `/logg-inn?utlopt=1`, then that the page shows the notice. Without `cache()` the second render gets `/logg-inn`; this was checked by disabling the memo. Not e2e, because the test process cannot write to the server's PGlite directory while the server holds it. |
| L1 | fixed (`327f045`) | `auth.test.ts`: with `failed_logins = 15`, one wrong attempt locks for exactly 24 h. Removing the cap makes the test fail (checked). |
| L2 | fixed (`327f045`) | `auth.test.ts`: when a lock lands while a wrong-password login waits for scrypt, neither the count nor the lock changes. Replacing `stillOpen` with `eq(host.id, row.id)` makes the test fail (checked). `greatest()` is still covered by reasoning only, because no test can land a lock between the count update and the lock write. |
| L3 | fixed (`327f045`) | `authz.test.ts`, dropped-table block: `GamePage` rejects with `DomainError("INTERNAL")`, not `notFound()`. |
| L4 | fixed (`327f045`) | `games.spec.ts`: `" " + "a".repeat(80) + " "` is announced as "80 av 80 tegn". |
| L5 | fixed (`327f045`) | `delete.test.ts` walks `pg_constraint` recursively from `game` and checks `ON DELETE CASCADE` on every edge. A self-check creates `fk_child → game` and `fk_grandchild → fk_child` (NO ACTION) and asserts that the walk reports the grandchild. |
| L6 | fixed (`327f045`) | `RETENTION_PLAYED_MS`, `RETENTION_IDLE_MS` and `PURGE_INTERVAL_MS` are in `src/lib/limits.ts`. |
| L7 | fixed (`327f045`) | Host B's delete of A's Game, a random UUID and `"abc"` moved to `authz.test.ts`. |
| L8 | fixed (`327f045`) | The comment now says that `lockForMutation` is the only way a Host or Player mutation locks a Game row, and that `create`, `transition` and `purgeExpired` write without it. |
| L9 | fixed (`327f045`) | `.nvmrc` is `22.13`. |
| L10 | fixed (`327f045`) | TRACE.md: `guards.test.ts` asserts only the `mock` provider config, and the skeleton appears after 300 ms without a fade. TRACE.md was also updated for every test that was added, moved or removed in these commits. |
| L11 | fixed (`327f045`) | `registrationCode: z.string().trim()`, plus a test with `" x "`. Passwords are still never trimmed. |
| L12 | skipped | Deferred in the report: no Postgres runs offline. The fix belongs with Story 7.3 (CI Postgres job) or 7.5. |
| L13 | skipped | Deferred in the report: it edits the architecture document, which is a docs commit on `main`. |

Dismissed items that other reports' fixes resolved anyway: #1 (a crafted `?slettet=` link) is gone with the flash cookie, #4 (no "Prøv igjen" on the 500 page) is fixed, #7 (expired sessions pile up) is now purged, and #22 (`aria-current`) is set.

Checks after the fixes, offline and with no keys: `lint`, `format:check` and `typecheck` are clean, `npm test` passes 255 tests in 23 files and `npm run test:e2e` passes 45.
