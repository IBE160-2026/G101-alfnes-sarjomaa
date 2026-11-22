# Epic 3 code review (bmad-code-review)

- **Date:** 2026-11-22
- **Scope:** `git diff epic-2-innsamling..epic-3-lukking`, which covers stories 3.1 (close as the single anonymisation step), 3.2 (schema and data anonymity test after close) and 3.3 (anonymity of the Host's view and log hygiene), plus the flaky-test fix in `games.spec.ts`.
  - 41 files changed, +3,669/-55.
  - The reviewers read the diff without `drizzle/meta/0006_snapshot.json`: 3,869 lines, 214 kB.
- **Mode:** `full`. The diff was checked against:
  - `spec-3-1`, `spec-3-2` and `spec-3-3`;
  - `epic-3-context.md`;
  - `ARCHITECTURE-SPINE.md`, with AD-9, AD-22 and AD-24 as amended;
  - PRD FR-10 to FR-13 and SM-3.
- **Layers:**
  - The four standard layers: Blind Hunter, Edge Case Hunter, Verification Gap and Acceptance Auditor.
  - A fifth layer focused on security. It looked at linkage after close, FR-10, races, hollow tests and the e2e harness. It confirmed findings 1 and 2 with throwaway PGlite scripts, then deleted them.
  - All five layers completed and none failed.
- **Triage:**
  - Every claim was checked at the cited lines. The checks went past the diff where needed: to callers, `lockForMutation`, `ConfirmDialog`, `node_modules/next` 16.4.6 and EXPERIENCE.md.
  - Items that the per-story reviews had already rejected were dismissed, unless a reviewer brought a new argument. Where a new argument was brought, it is named.
- **Test run:** `npm run test` passed 34 files and 428 tests in 8.9 s. `test:e2e` was not run.
- **No fixes were applied.** No source file, story spec, `deferred-work.md` or sprint status was changed. The step-04 write-back to the story files was skipped on purpose, since this run was asked to triage and report only.

## Summary

| Severity | Count | Routing |
|---|---:|---|
| High | 0 | |
| Medium | 3 | 1 decision needed, 2 patch |
| Low | 8 | 6 patch, 2 defer |
| Dismissed | 16 | see the last section |

**Bottom line.** The anonymity property holds on real Postgres for the live data. After close:

- no column, key, sequence, timestamp, insert order or transaction marker links an Answer to a Participant, an Invite link or the order in which sets arrived;
- the close, submit, revoke, delete and purge races are serialised correctly on the Game row lock.

The weaknesses are of two kinds:

- **Physical cleanup.** The VACUUM that erases the deleted Answer sets from the table files can be skipped without anything noticing (finding 1).
- **Tests.** Three of the protections the epic relies on can be removed while every test stays green (findings 2, 3 and 5). For this epic that matters: SM-3 and the examiner's grade rely on the tests as proof.

### Verified clean (checked in triage, not only claimed by a layer)

- **Shuffle and RNG.**
  - `src/lib/shuffle.ts` is a correct Fisher-Yates: `crypto.randomInt(i + 1)`, which has no modulo bias and no off-by-one (the bound is pinned by the unit test).
  - It runs once over every row of the Game, not per set and not per Question.
- **Keys.**
  - `contributor_key` is `crypto.randomUUID()`, drawn fresh for each set and Question. `answer.id` is `gen_random_uuid()` (v4).
  - There is no serial column, identity column, sequence, timestamp, ordinal or time-ordered id.
  - `anonymity.test.ts` checks this against `information_schema` and `pg_class`.
- **Insert order, physical order, xmin and cmin.**
  - `grouping.insertAnswers` makes one multi-row INSERT, with no chunking and no RETURNING. So every row shares one `xmin` and one `cmin`, and heap order is the shuffled order.
  - In the worst case (50 sets × 20 Questions × 5 Answers × 5 parameters) the INSERT carries 25,000 parameters, well under the limit of 65,535.
  - The set order of the SELECT never reaches `answer`.
- **FR-10.**
  - The floor is checked on the server, after `lockForMutation(FOR UPDATE)` and inside the transaction. The count is submissions joined to this Game's links: at most one per link, and a revoked link's set is already gone through the cascade.
  - On failure the transaction rolls back, `updated_at` included, and the code is `TOO_FEW_ANSWER_SETS`. The message says "minst 3" and never the exact count.
  - The UI disables the trigger from `progress()`, which never reveals a count below three.
- **Races.**
  - Close, submit, revoke, create, delete and purge all lock the same Game row (`games/index.ts:126`).
  - A submit queued behind close re-reads the row under READ COMMITTED and gets `COLLECTION_CLOSED`, so no set is silently lost.
  - Purge's DELETE re-checks `updated_at` (EvalPlanQual) and skips a Game that close just touched.
- **Driver.** Production uses postgres.js over TCP with `prepare: false`, not Neon's HTTP driver. Interactive transactions and `SELECT … FOR UPDATE` both work, and a single-statement VACUUM runs outside a transaction block.
- **Logs.** `log()` writes only module, op, code and SQLSTATE. `next.config.ts` turns off Server Function argument logging and the forwarding of browser console output to the terminal.
- **e2e servers.**
  - `next build` cleans `.next` but keeps `dev` and `lock` (`node_modules/next/dist/build/index.js:620-632`), so the production build and the dev server do not collide.
  - The redirect binds only to `npm run start`, so a build error still reaches the console.
  - Playwright kills each webServer's process group, so no processes are left behind.

### Out of scope, stated on purpose

The code cannot erase copies of the data that live outside the live tables:

- the WAL;
- Neon's point-in-time history, which lets anyone with console access branch from a moment before close and read `submission`, `token_hash` included;
- backups;
- Postgres server logs, if statement or slow-query logging with bind parameters is ever turned on;
- disk blocks freed by `VACUUM FULL`.

The spine (line 440) mentions "Neon's short history". The PRD §1.1 anonymity limit covers only the time before close (see deferred finding D2).

## Findings

### Medium

#### 1. The VACUUM after close can be skipped without a log line or a retry, and autovacuum does not erase the bytes

- **Routing:** decision needed.
- **Source:** edge-case-hunter, blind-hunter and the security layer.
- **Location:** `src/server/db/vacuum.ts:14`. Called from `src/server/collection/index.ts:314` and `src/server/games/index.ts:202` and `:231`.
- **What happens:**
  - `VACUUM (FULL, SKIP_LOCKED)` needs ACCESS EXCLUSIVE on the shared `submission` and `invite_link` tables. If any session holds even ACCESS SHARE at that instant, the table is skipped. That includes another Host's 30-second progress refresh, a guest opening a link, a submit to another Game, or autovacuum.
  - A role that does not own the tables also only gets a skip.
  - Postgres reports both cases as a WARNING notice, not an error, so the `catch` and `log()` never run.
  - Nothing retries until another close, the delete of a *collecting* Game, or a purge that happens to remove one.
- **Failure scenario:**
  - A Host closes while another Game's guest is loading a link page.
  - The dead `submission` tuples stay in the heap and its TOAST. Each one holds `token_hash`, the whole Answer set and the edit secret hash.
  - The Host still has the link text, and can recompute `sha256(token)`. With file-level access (the pilot's own Neon role), that Host can match sets to links.
- **New argument against the 3.1 rejection.** The 3.1 triage rejected this as best-effort and rare. Two facts were not on the table then:
  1. Plain (auto)VACUUM does not overwrite dead tuple bytes. The security layer deleted rows that shared a page with a live row, ran VACUUM and a CHECKPOINT, and still found the deleted text at the same offset in the raw relation file. Only `VACUUM FULL` removed it.
  2. The skip triggers are ordinary traffic in a multi-Host pilot, not exotic contention.
- **Options (the choice is a design decision under AD-9):**
  - (a) Have `purgeExpired` (via `purgeIfDue`, at most hourly) always call `vacuumCollectionTables`. That gives a periodic retry. It is the cheapest option and fine at pilot scale.
  - (b) Replace SKIP_LOCKED with a short `lock_timeout` and a bounded retry loop on a dedicated connection, and log when it still fails.
  - (c) Detect the skip through postgres.js `onnotice` and log it. AD-2 currently keeps driver-specific code out of modules.

#### 2. The AC2 "vacuumed" check cannot tell `VACUUM FULL` from a plain VACUUM, or from no VACUUM at all followed by autovacuum truncation

- **Routing:** patch.
- **Source:** the security layer and blind-hunter.
- **Location:** `tests/integration/anonymity.test.ts:199-205`.
- **What happens:**
  - The test asserts `pg_relation_size('submission') = 0` in a database that holds only the closed Game.
  - A plain VACUUM also truncates a table whose rows are all dead to 0 bytes. The security layer confirmed this on PGlite.
  - In production, other Games' live rows keep those pages, and plain VACUUM leaves the dead bytes in them (finding 1).
  - The check also measures only the main fork, not TOAST or the `token_hash` index. The fixture's sets are about 30 characters per Answer, so they never reach TOAST. A full set (20 Questions × 5 × 80 characters, about 8 kB of jsonb) would.
- **Failure scenario:** someone changes `VACUUM (FULL, …)` to `VACUUM (…)`, perhaps to avoid the ACCESS EXCLUSIVE lock. Every test stays green, and the property is broken on Neon.
- **Fix:**
  - Keep a second Game open in the fixture, with live links and sets.
  - After close and a `CHECKPOINT`, assert that no captured secret prefix appears in `pg_read_binary_file(pg_relation_filepath('submission'))`, which works on PGlite. Do the same for its TOAST relation (`reltoastrelid`).
  - Make one set large enough to be toasted.
  - Drop the bare size check, since it is meaningless once another Game exists.

#### 3. Every close and submit race test passes with `FOR UPDATE` removed

- **Routing:** patch, for the cheap guard. Full coverage is Story 7.3.
- **Source:** the security layer.
- **Location:** `tests/integration/collection.test.ts`, the race tests around lines 1370-1415. The lock under test is `src/server/games/index.ts:126`.
- **What happens:**
  - PGlite has a single connection and runs one transaction at a time. In these tests, close is held back by that queue, not by the row lock.
  - On real Postgres (a postgres.js pool, READ COMMITTED) without `FOR UPDATE`, a submit can commit after close's SELECT (`collection/index.ts:291`) but before its `DELETE invite_link` (`:311`).
  - The cascade then deletes that set. It never reaches `answer`, even though the Participant was told "Svarene dine er lagret."
- **Status:** today's code is correct. The 3.1 follow-up note records the PGlite limitation, but nothing stops a regression before the real-Postgres CI job in Story 7.3.
- **New argument:** a one-line guard exists now. The 3.1 note treated the gap as needing real Postgres.
- **Fix:** add a unit or integration assertion that the query `lockForMutation` builds ends in `for update`, for example by spying on `tx.select(...).for` or checking `toSQL()`.

### Low

#### 4. The server-log recorder misses requests that a page-level route forwards with `route.fetch()`

- **Routing:** patch.
- **Source:** acceptance-auditor.
- **Location:** `tests/e2e/fixtures.ts:43-49`. The affected specs are `tests/e2e/answer-form.spec.ts:353-364` and `tests/e2e/invite-link-page.spec.ts:277-288`.
- **What happens:**
  - A `page.route` handler wins over the context route in `localOnly`.
  - Calling `route.fetch()` sends the real request without passing through the context handler, so `recordLeaves` never sees it.
  - `answer-form.spec.ts` sends a fresh edit secret for every case to the real server. `invite-link-page.spec.ts` sends a random Token. None of these values is written to `secrets.jsonl`.
- **Why this is new:** the 3.3 triage rejected Edge 6b because mocked responses "never reach the server". That holds for `route.abort()`, but not for `route.fetch()` followed by `route.fulfill()`.
- **Impact:** low. Other specs record values of the same kinds on the same code paths, so a generic leak would still be caught. But AC3's "every value" claim does not hold.
- **Fix:** record from `context.on("request", …)` with `request.postDataJSON()`. That event fires however the request is routed.

#### 5. The order assertions accept a deterministic non-shuffle

- **Routing:** patch.
- **Source:** the security layer and blind-hunter.
- **Locations:**
  - `tests/integration/anonymity.test.ts:276` and `:282`;
  - `tests/integration/collection.test.ts:1303-1305`.
- **What happens:**
  - Replace `shuffle(rows)` with `rows.sort((a, b) => a.rank - b.rank)` and all three checks pass. That gives 45 key runs (more than 9), 15 set runs (more than 3), and a set number lower than the one before it.
  - Yet within each rank group the rows are still in arrival order.
  - Separately, the comment at `collection.test.ts:1303` claims the check rejects blocks of whole sets. It passes for blocks in the order 2, 0, 1.
  - `shuffle.test.ts` proves that `shuffle` is correct. Nothing proves that close actually uses it.
- **Fix:**
  - In one close test, mock `@/lib/shuffle` to return a known permutation, and assert that `insertAnswers` receives exactly that array.
  - Replace the weak `some(k < prev)` check with the run count from `anonymity.test.ts`, or delete it and fix the comment.

#### 6. A race-test assertion can never fail

- **Routing:** patch.
- **Source:** blind-hunter and acceptance-auditor.
- **Location:** `tests/integration/collection.test.ts:1381`.
- **What happens:** `expect(closed).toBeUndefined()` always passes, because `collection.close` resolves to `void`. If the close inside the hook failed, the test could not tell. The state and row-count checks after it partly cover this.
- **Fix:** keep the promise and use `await expect(closing).resolves.toBeUndefined()`, as the `lockRace` test at line 1412 already does.

#### 7. `vacuum.ts` has no `shortcut:` comment for its scaling limit

- **Routing:** patch.
- **Source:** blind-hunter.
- **Location:** `src/server/db/vacuum.ts:9-15`.
- **What happens:** every close, every delete of a *collecting* Game and some purges rewrite the whole of `submission` and `invite_link`, for every Game, under ACCESS EXCLUSIVE. Submits to every other open Game wait while that happens. This is fine at pilot scale, but CLAUDE.md requires a marker for known limits, and `ponytail-debt` will not list this one.
- **Fix:** add `// shortcut: rewrites both tables for every Game under ACCESS EXCLUSIVE, fine at pilot scale; switch to per-Game cleanup or partitioning if submits start queueing behind closes.`

#### 8. Overriding `E2E_DEV_URL` breaks the dev server start

- **Routing:** patch.
- **Source:** blind-hunter.
- **Location:** `playwright.config.ts:9-10` and `:79`.
- **What happens:** `E2E_DEV_URL ??=` can be overridden, but the dev server still gets `PORT: String(DEV_PORT)` (3101). With `E2E_DEV_URL=http://localhost:4000`, Playwright waits on port 4000 for 300 s while the server listens on 3101.
- **Fix:** derive the port from the URL, or stop honouring an outside value.

#### 9. The README sends readers to `dev.log` without saying where it is

- **Routing:** patch.
- **Source:** blind-hunter.
- **Location:** `README.md:75`.
- **What happens:** the file sits in a random `mkdtemp` folder (`toppsvar-e2e-XXXX` under the system temp directory). The teardown prints the path, but not when the run aborts during webServer startup, which is exactly the case where the README line applies.
- **Fix:** name the folder pattern, or print `E2E_OUT_DIR` from the config at load time.

#### 10. Focus is lost when close is refused for too few sets

- **Routing:** patch.
- **Source:** blind-hunter, edge-case-hunter, and verification-gap (other).
- **Location:** `src/components/CloseCollection.tsx:58-62`.
- **What happens:**
  - After `TOO_FEW_ANSWER_SETS`, `router.refresh()` turns `canClose` false.
  - The component stays mounted, but swaps the dialog for the disabled branch. The `<h1>` fallback in the unmount cleanup therefore never runs, and focus falls to `<body>`.
  - The `failure` state is set but never shown.
- **How to reach it:** tab B revokes a used link, and tab A confirms.
- **New argument against the 3.1 rejection.** 3.1 rejected this as rare. CLAUDE.md says accessibility (NFR-6, WCAG 2.1 AA, 2.4.3) is never cut, and the fix is a direct one: when `canClose` flips to false after a failed action, focus the reason paragraph (add `tabIndex={-1}`).

### Deferred

#### D1. Two of `CloseCollection`'s refresh-on-failure branches are untested

- **Severity:** low.
- **Source:** verification-gap.
- **Location:** `src/components/CloseCollection.tsx:13` and `:58`.
- **What happens:**
  - Only the `WRONG_STATE` refresh is tested (the two-tab test in `close.spec.ts`).
  - Removing `TOO_FEW_ANSWER_SETS` or `NOT_FOUND` from `REFRESH_ON`, or dropping `!result ||`, keeps every test green.
  - Every such case recovers through the 30 s `CollectingRefresh`.
- **Why it is deferred:** this follows the layer's filed disposition. If the gap is closed later, the natural test is a third two-tab test where tab B revokes a used link, which also exercises finding 10.

#### D2. The anonymity limits leave out Neon's history and the WAL after close

- **Severity:** low.
- **Source:** blind-hunter and the security layer.
- **Locations:** PRD §1.1 (`PRD.md:21`) and `README.md`.
- **What happens:** the PRD limit says only "Before Collection closes, someone with direct database access could correlate…". On Neon, the same holds after close for the length of the history window.
- **Why it is deferred:**
  - The README has no limits section yet, though the PRD says "The README states all of these".
  - Fixing the PRD means editing a frozen spec.
  - The work belongs to the README story. That story should add one sentence about Neon's history, the WAL and backups.

## Dismissed

1. **The no-key sentence is hidden in Demo mode (blind-hunter):** false. EXPERIENCE.md:112 says Demo mode uses the `NO_STORED_RULING` wording and "never the key sentence". The 3.1 patch follows the UX contract.
2. **The grouping panel claims an AI is working even without a key (blind-hunter):** rejected. The copy is verbatim EXPERIENCE.md:254, and changing it means editing the UX contract. The panel also carries a `shortcut:` marker until Story 4.2.
3. **The pending label, `aria-busy` and a double confirm are never tested (blind-hunter):** maybe-false. Low if true. `Button pending` is a shared component, and a second call would get `WRONG_STATE` and refresh to *grouping*, so nothing is lost.
4. **Nothing proves `start.log` keeps capturing while requests run (blind-hunter):** low. `next start` prints no request lines by design, and a marker would need new app code. The empty-file check already catches a capture broken at start.
5. **Esc during a pending close sends the error to a closed dialog (edge-case-hunter):** low. This is the shared `ConfirmDialog` pattern from Epic 1, the fix needs a new prop, and close returning INTERNAL is rare.
6. **`acted` stays true after a network failure (edge-case-hunter):** already rejected in 3.1, with no new argument.
7. **`E2E_OUT_DIR` derives from an outside `E2E_DB_DIR` and can pile up files (edge-case-hunter):** low. The variable is undocumented and nobody sets it, and accumulating `secrets.jsonl` only makes the scan stricter.
8. **Answer counts per key can correlate one Participant across Questions (security layer):** maybe-false. Low if true. AD-10 accepts per-Question keys until `confirmBoard`. No Host view shows `contributor_key` today. Whether one does is for Epic 5 to decide.
9. **A second server starts on every run, even a single spec (security layer and blind-hunter):** already rejected in 3.3 (Blind Hunter 12), with no new argument.
10. **A busy port 3101, or a developer's own `npm run dev`, aborts the whole run (security layer):** low. This is documented in README.md:75 and in the `shortcut:` comment in `playwright.config.ts`.
11. **Each run leaves a temp folder (security layer):** low. It sits in the OS temp directory, and keeping the logs after a run is what makes a teardown failure diagnosable.
12. **`host-view.test.ts` reads only `table_schema = 'public'` (blind-hunter):** false. That test compares against a fixed list, so a table moved out of `public` returns `[]` and fails the test instead of passing.
13. **`next build` and `next dev` share `.next` (focus question):** false. The build keeps `dev` and `lock` when it cleans (`node_modules/next/dist/build/index.js:620-632`).
14. **Build errors are hidden in `start.log` (focus question):** false. The shell redirect binds only to `npm run start`.
15. **The non-owner VACUUM WARNING (edge-case-hunter):** a duplicate of finding 1 (same root cause, folded in there).
16. **Leftover server processes (focus question):** false. Playwright kills each webServer's process group on teardown, and both commands run under its shell.
