# Ponytail audit of the whole repo, 2026-11-24

Scope: `main` at `ff0a998` (after the epic 8 merge), before the Stage 1 freeze on 1 December. Read: `src/` (server, app, components, lib, CLI), `tests/` (unit, integration, e2e, `TRACE.md`), `scripts/`, `.github/`, the root config, `drizzle/` for sanity, and `README.md` checked line by line against the code. The audit was split into three read-only slices (server and security, UI and lib, tests/CI/README), and every finding below was checked again against the code before it was kept. Findings that the epic 1 to 8 reviews in this folder already fixed or explicitly accepted are left out, unless there is new evidence (then the earlier decision is named).

The project rule applies throughout: this audit never proposes cutting a Stage 1 FR, anonymity (FR-11 to FR-13), validation, error handling, security, accessibility or the tests the grader runs. Lean findings only touch what nobody asked for.

Tests run: `vitest run` gave 819 passed and 2 skipped (both skips expected outside CI or a git checkout). `lint`, `format:check`, `typecheck` and `judge:eval` were clean. The e2e suite was not run.

**What this repo does:** Toppsvar is a Family Feud-style party game. A Host writes Questions, sends one-time Invite links, Participants answer anonymously on their phones, a language-model Judge (or a stored replay without a key) groups similar Answers into ranked Boards, the Host reviews them, and the group plays from one shared screen. It is a Next.js 16 app with Drizzle on PGlite locally and Postgres on the Vercel pilot.

**Load assumed:** the pilot in SM-6, that is a few Hosts, Games of 8 to 15 Questions with 10 to 30 Participants each, on Vercel serverless functions with a Neon Postgres database; and the grader running everything locally on PGlite with no key.

## Must fix

None. Nothing found lets one Host touch another Host's Game, lets a Host tie an Answer to an Invite link or a Participant, loses data, or breaks the grader's path.

## Should fix

1. **Deleting a Game scans the whole `answer` table once per Group** (`src/server/db/schema.ts:168-190`, hot paths `src/server/games/index.ts:306-355` and `:329-355`)
   - **What this is:** A Game owns Questions, Questions own Groups (`answer_group`) and Answers (`answer`). Deleting a Game, by the Host or by the retention purge (FR-3), removes all of them through `ON DELETE CASCADE` foreign keys (links from one table to another that delete the child rows with the parent).
   - **Problem:** `answer.question_id`, `answer.group_id` and `answer_group.question_id` have no index. Postgres runs the cascade once per deleted Group, and each run reads every Answer of every Game in the database. Without a key every distinct Answer becomes its own Group, so a Game easily has hundreds of Groups. Measured on PGlite with 100 Games (180,000 Answers): deleting one Game took 4.4 s without the indexes and 45 ms with them, and a purge of 30 Games took 108 s. Native Postgres is faster, but the shape is the same, and the purge runs inside a serverless function with a time limit. `board_slot.group_id` already got an index for this reason; `answer` did not.
   - **Fix:** Add `index().on(t.questionId)` and `index().on(t.groupId)` to `answer` and `index().on(t.questionId)` to `answer_group`, then `npm run db:generate` for one migration. The Review reads and the Grouping updates, which filter `answer` by `question_id`, get faster too.
   - **If we skip it:** Delete and purge get slower with every Game in the database, and a purge on the pilot can time out and leave expired Games behind, which is an FR-3 failure. Epic 1 and epic 4 rejected foreign-key indexes for pilot scale; this is raised again because it is measured and the fix is three lines. The `shortcut:` at `src/server/games/index.ts:329` names the wrong ceiling (see the debt ledger of the same date, row 10).

2. **"Legg til spørsmål" throws on plain-http LAN addresses** (`src/components/QuestionEditor.tsx:105-106`)
   - **What this is:** A new Question row gets its id from `crypto.randomUUID()` in the browser.
   - **Problem:** `crypto.randomUUID` exists only in a secure context (https or localhost). The code elsewhere plans for the app on plain `http://<LAN-IP>`: `src/server/collection/index.ts:68-69` says `APP_BASE_URL` may be a LAN IP, `src/components/OnceLinkList.tsx:76-77` handles the Host's own page there (no clipboard), and `src/lib/invite-link.ts:80-84` avoids `crypto.subtle` for the same reason. A Host who opens the app at that LAN address gets a `TypeError` on click, and nothing happens. The `shortcut:` comment's premise, "every supported setup is a secure context", contradicts those three places. The e2e test for plain http (`tests/e2e/invite-links.spec.ts:181`) only removes `navigator.clipboard`, so it does not catch this.
   - **Fix:** Build the version-4 UUID from `crypto.getRandomValues`, which works in any context, as `newEditSecret` already does. The result still has to pass `z.uuid()` in `src/lib/question.ts:9`. Then delete the `shortcut:` comment.
   - **If we skip it:** A Host on a LAN setup cannot write Questions (FR-4) and gets no error message.

3. **README says `PORT` in `.env.local` sets the port, but `npm run dev` and `npm start` ignore it there** (`README.md:248`, `.env.example:6`)
   - **What this is:** The environment table lists `PORT` (default 3000), and `.env.example` says to copy it to `.env.local`.
   - **Problem:** Next reads `PORT` for its listening port from the shell only, before it loads any `.env*` file. It does load `.env.local` for the app's own code, so `src/server/env.ts:35` builds the default `APP_BASE_URL` from the new `PORT`. Someone who sets `PORT=4000` in `.env.local` gets a server on 3000 and Invite links pointing at 4000. Only `npm run demo` works, because it loads the file into Node first.
   - **Fix:** In the README row and the `.env.example` comment, say to set `PORT` in the shell (`PORT=4000 npm run dev`), and that `.env.local` works only for `npm run demo`.
   - **If we skip it:** A grader who follows the README to change the port gets broken links and has to debug it.

4. **Raw Answer text stays in the database after the Board is locked, though nothing reads it** (`src/server/review/index.ts:485`, `src/server/grouping/index.ts:144-160`)
   - **What this is:** When the Host locks the Board (`confirmBoard`, *in_review* to *ready*), the code clears `contributor_key` and `rank` on every `answer` row (AD-10).
   - **Problem:** After *ready*, play reads only `board_slot` and the usage report reads only `answer_group` and `board_slot`. The state machine has no way back to Review (`src/lib/game-state.ts:20-27`). Yet the free-text Answers, often about named people who did not consent, stay for up to 30 days after play or 90 days idle. PRD §6.1 and the FR-3 rationale say the product "keeps nothing it does not need".
   - **Fix:** In `confirmBoard`, after the Counts are frozen into `board_slot`, delete this Game's `answer` rows and keep `answer_group` for the report. This changes AD-15 and the assertion in `tests/integration/anonymity.test.ts:324-334`, so it is a decision for the group, not a silent fix.
   - **If we skip it:** Nothing breaks, and the PRD's retention rules are met. The cost is a longer exposure window for the most sensitive data the app holds.

5. **The login queue's `shortcut:` trigger has already fired** (`src/server/auth/password.ts:17`)
   - **What this is:** Password hashing (scrypt, deliberately slow) runs at most two at a time per process, and further logins wait in a queue with no size limit and no rate limit.
   - **Problem:** The comment says to add a cap "before a public pilot". The pilot is public, with open registration (AD-24). A flood of login requests makes every real Host wait behind it. Account takeover is not the risk, since the per-account lockout already stops guessing.
   - **Fix:** Refuse with the existing `INTERNAL` error ("Prøv igjen om litt") when `waiting.length` passes a small bound, about three lines. Or decide that the pilot's size makes this acceptable and reword the trigger so it no longer names a condition that is already true.
   - **If we skip it:** Anyone can slow down login for all Hosts on one serverless instance at a time.

6. **Three CLI test files fail on Windows** (`tests/integration/judge-cli.test.ts:13`, `tests/integration/judge-eval.test.ts:66`, `tests/integration/manual-tools.test.ts:79`)
   - **What this is:** These tests start the CLI scripts with `spawnSync("node_modules/.bin/tsx", ...)`.
   - **Problem:** On Windows that file is a POSIX shell script, and `spawnSync` without a shell cannot run it, so about 20 tests fail with `ENOENT`. The rest of the repo cares about Windows (`make-zip.test.ts` skips there, `src/cli/demo.ts` is written to be portable), and the grader's operating system is unknown.
   - **Fix:** `spawnSync(process.execPath, [join(ROOT, "node_modules/tsx/dist/cli.mjs"), ...args])` in the three files.
   - **If we skip it:** A grader on Windows sees red tests in `npm run test` that say nothing about the app.

7. **The PRD consequence "Tokens are unique across all Games" has no test** (`tests/unit/token.test.ts:11-15`, PRD FR-5)
   - **What this is:** Invite link Tokens are 32 random bytes, and only their hash is stored, as the primary key of `invite_link` (`src/server/db/schema.ts:100`).
   - **Problem:** The test checks only length and alphabet. Nothing fails if the primary key is dropped or the Token gets shorter, and `tests/TRACE.md` never mentions uniqueness for FR-5.
   - **Fix:** One integration test that inserting a duplicate `token_hash` is rejected, plus a TRACE line.
   - **If we skip it:** A testable consequence of a Stage 1 FR stays untested, which a grader checking TRACE against the PRD can see.

8. **The Game lock's Postgres proof is not recorded, and its TRACE note is stale** (`tests/TRACE.md:142`, `tests/integration/collection.test.ts:1437`, `:1605`)
   - **What this is:** FR-10 (submit, close and revoke do not race) rests on `lockForMutation` taking `FOR UPDATE`. On PGlite, which runs one transaction at a time, a SQL-text test pins it. On Postgres that test is skipped and the real race test at `:1437` runs in CI's `postgres` job.
   - **Problem:** TRACE still says the SQL-text check is a "`shortcut:` until Story 7.3's real-Postgres CI job", but that job exists. More important, there is no record that the Postgres race test fails when `.for("update")` is removed, and only close against submit is raced; revoke is pinned only by the PGlite text test.
   - **Fix:** Remove `.for("update")` on a branch once, confirm the `postgres` CI job goes red, and reword the TRACE line to say which test covers the lock on Postgres.
   - **If we skip it:** The strongest concurrency guarantee in the app rests on a test nobody has seen fail.

## Nice to have

9. **`grouping.countsOf` is used only by tests** (`src/server/grouping/index.ts:424-438`)
   - **What this is:** A function that counts distinct contributors per Group.
   - **Problem:** No production code calls it. `rankedGroups` in `src/server/review/index.ts:49-64` runs the same SQL. Only `tests/integration/grouping.test.ts:487,633,761` call it.
   - **Fix:** Delete it and point those three assertions (and `tests/TRACE.md:217-218`, Story 4.2 AC4) at `rankedGroups` or the Review DTO, so the "two Answers of one contributor count as one" check stays.
   - **If we skip it:** Two copies of one counting rule can drift apart.

10. **Small duplicated helpers in the server** (`src/server/auth/session.ts:19-21` and `src/lib/token.ts:8-10`; `src/server/auth/session.ts:25`; `src/server/games/index.ts:45` and `src/server/review/index.ts:166`; `src/lib/invite-link.ts:28`, `src/lib/review.ts:59`, `src/lib/play.ts:30`)
    - **What this is:** `sha256` is defined twice. `createSession` repeats `randomBytes(32).toString("base64url")` instead of calling `newToken()`. A UUID regex is defined twice, once case-insensitive (`/i`) and once not. Three `z.object({ gameId: z.string() })` schemas are identical.
    - **Problem:** The two UUID regexes disagree: an upper-case UUID passes one check and fails the other. The rest is copy-paste that must change together.
    - **Fix:** Import `sha256` and `newToken` from `src/lib/token.ts`, export one `UUID` constant, and share one `gameRefSchema`. Validation stays the same.
    - **If we skip it:** About 15 extra lines, and one inconsistency in what counts as a valid id.

11. **The owner check is copied across the Game's pages** (`src/app/spill/[id]/page.tsx:36-74`, `src/app/spill/[id]/skjerm/page.tsx:12-32`, `src/app/spill/[id]/gjennomgang/page.tsx:16-41`)
    - **What this is:** Each page has its own `isNotFound`, `cache(ownedGame)` and `generateMetadata`, and the Game page calls `auth.requireHost()` four more times (lines 92, 225, 242, 259) only to get `hostId`.
    - **Fix:** One `src/app/spill/[id]/owned-game.ts` that returns `{ hostId, ...game }` plus the title metadata. About 30 lines fewer.
    - **If we skip it:** A change to the not-found or title rule must be made in three places.

12. **`lockForMutation` has a `touch` option with one caller** (`src/server/games/index.ts:150-184`, `:317`)
    - **What this is:** `touch: false` skips one `updated_at` write, used only by `deleteOwned`, on a row deleted in the same transaction.
    - **Fix:** Drop the option. The extra write on a row about to be deleted costs nothing.
    - **If we skip it:** One option to read and test that does no useful work.

13. **Grouping writes one UPDATE per Group inside the Game lock** (`src/server/grouping/index.ts:234-243`)
    - **What this is:** After the Judge answers, each Group's Answers get their `group_id` in a loop.
    - **Problem:** Without a key that is one round trip per distinct Answer, up to a few hundred per Question, while the Game row is locked. On a remote database each round trip costs milliseconds.
    - **Fix:** One `UPDATE answer SET group_id = v.group_id FROM (VALUES ...) v WHERE ...` per Question. Finding 1's index also helps here.
    - **If we skip it:** Grouping on the pilot is slower than it needs to be, but it finishes.

14. **Three static Notices are announced as live status messages** (`src/app/spill/[id]/gjennomgang/page.tsx:100`, `:104`, `src/app/spill/[id]/page.tsx:270`)
    - **What this is:** `Notice` defaults to `role="status"`, a live region that screen readers announce when it changes. Epic 7 added `live={false}` for static text but applied it only to the demo Notices.
    - **Problem:** The Review page ends up with four polite live regions, while `EXPERIENCE.md:391` asks for one. These three are page text, not status.
    - **Fix:** Add `live={false}` to the three.
    - **If we skip it:** Screen-reader users may hear page text announced out of order (NFR-6).

15. **`/svar/[gameId]` lacks the `await connection()` that AD-2 asks for** (`src/app/svar/[gameId]/page.tsx:13-17`)
    - **What this is:** AD-2 says every page that reads the database calls `connection()` so Next never caches it.
    - **Problem:** This page reads `linkStatus` but has no cookie, search parameter or `connection()` call. Today it still renders per request (no prerender entry), but nothing pins that. If Next ever caches it, a closed collection could show as open.
    - **Fix:** Add `await connection();` as the first line.
    - **If we skip it:** It works now and depends on Next's current defaults.

16. **Two hardening items from the architecture review were never applied** (`next.config.ts:11-18`, `src/server/env.ts`)
    - **What this is:** The architecture anonymity and security review asked for `Content-Security-Policy: frame-ancestors 'none'` and `X-Content-Type-Options: nosniff` on all pages (L4), and for `DEMO_MODE=1` to be refused with a `postgres://` database (L10).
    - **Problem:** Only `Referrer-Policy` on `/svar` exists. SameSite=Lax cookies already keep the Host's session out of cross-site frames, so the risk is low. A pilot started with `DEMO_MODE=1` by mistake would show the demo login on a real database.
    - **Fix:** One `/:path*` entry in `headers()`, and one check in `parseEnv` that throws when `DEMO_MODE` is set and `DATABASE_URL` is not `pglite:`.
    - **If we skip it:** Two small, documented decisions stay undone.

17. **Small component leftovers** (`src/components/ReviewGroups.tsx:48`, `src/components/AnswerForm.tsx:38`)
    - **What this is:** `FailureNotice` lives inside the 551-line `ReviewGroups.tsx` but is imported by `LockBoard.tsx` and `MarkReviewed.tsx`. `NETWORK_SUBMIT` is exported but nothing imports it; `tests/e2e/answer-form.spec.ts:19` declares its own copy.
    - **Fix:** Move `FailureNotice` next to `Notice.tsx`, and drop the `export` on `NETWORK_SUBMIT`.
    - **If we skip it:** Unrelated components depend on the Review list's file.

18. **`typescript-eslint` is a direct devDependency that nothing imports** (`package.json`)
    - **What this is:** No config or source file imports it. `eslint-config-next` already brings it in.
    - **Fix:** Remove it, and update `ARCHITECTURE-SPINE.md:522` and `:544`, which list it as a pinned stack choice, in the same commit.
    - **If we skip it:** One extra dependency to keep in step.

19. **CI does not check that the root `PRD.md` and `product-brief.md` match their sources** (`.github/workflows/ci.yml`, `scripts/sync-brief.sh`)
    - **What this is:** The script regenerates the root copies and checks them against itself, but only when someone runs it. They are in sync today.
    - **Fix:** One CI step: `./scripts/sync-brief.sh && git diff --exit-code -- product-brief.md PRD.md`.
    - **If we skip it:** A forgotten sync before the zip goes out unnoticed, and the project rules call an out-of-sync copy worse than none.

20. **A few tests repeat others** (`tests/integration/play.test.ts:324`, `tests/integration/report.test.ts:632`, `:640`, `tests/unit/game-state.test.ts`)
    - **What this is:** Three delete tests check what `tests/integration/delete.test.ts:237` already checks for every foreign key under `game`. In `game-state.test.ts`, the 49-pair `canTransition` test derives its expectation from the same constant it tests, and the `createGameSchema` and `formatDate` tests sit in the wrong file.
    - **Fix:** Drop the three delete tests and their TRACE lines (48-49), drop the 49-pair test, and move the two misplaced tests to their own files.
    - **If we skip it:** About 40 lines of tests that cannot fail on their own.

Left out, smaller: 5 (the PR template has no line for the review summaries `CLAUDE.md` requires, `make-zip.test.ts`'s in-repo check can match an outer repo, `tests/integration/db-open-retry.test.ts` is not cited in TRACE, `npm run demo` prints a harmless `.env not found` line on Node 26, and on serverless each cold instance can run the hourly purge and its `VACUUM FULL`, which multiplies the known vacuum shortcut). Outside the code: the GitHub repo has nine merged PRs and no issues, and the grading guide names issues under Process.

Verdict: Healthy for Stage 1, with no Must findings. Fix first: finding 1 (three indexes, one migration) and finding 3 (README `PORT` text), both cheap and on paths the grader or the pilot will hit; then decide findings 4 and 5, and record the Postgres lock proof in finding 8.

Lean: -100 lines, -1 dependency possible (findings 9 to 12, 17, 18 and 20).

Not checked: the e2e suite and anything visual or runtime in a browser (ports 3000, 3101 and 3200 were off limits); the CI `postgres` job itself and native Postgres timings (the index numbers in finding 1 are from PGlite); live OpenRouter behaviour; Windows behaviour (finding 6 is inferred from the spawn call); pilot environment values and Neon connection limits; `wiki/`, `prompting/` and the BMAD planning artifacts beyond the PRD, the architecture spine and the earlier reviews; the manual checklist rows, which are still unfilled and are stated as such in the README.
