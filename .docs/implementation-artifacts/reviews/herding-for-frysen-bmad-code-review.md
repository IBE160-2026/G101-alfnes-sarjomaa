# Hardening before the freeze: code review (bmad-code-review)

- **Date:** 2026-11-24
- **Scope:** `git diff origin/main...herding-for-frysen`, from the merge base `f16adbe`. 9 commits, from `fd3d0c0` to `779301a`.
  - 26 files changed, +1,430/-38.
  - 1,207 of the added lines are the generated `drizzle/meta/0015_snapshot.json`. Triage checked the snapshot separately.
- **Mode:** `full`. The diff was checked against:
  - `spec-herding-for-frysen.md`, which maps each audit finding to a commit;
  - `reviews/ponytail-audit-2026-11-24.md`, the findings these commits fix, and its Fixes section;
  - `ARCHITECTURE-SPINE.md`, mainly AD-3 (applying migrations) and AD-6 (hashing limits);
  - the PRD: FR-1, FR-3, FR-4, FR-5 and NFR-6;
  - `EXPERIENCE.md`: the Notice row in the component table and the live-region rule.
- **Layers:** Blind Hunter, Edge Case Hunter, Verification Gap and Acceptance Auditor. All four completed and none failed.
- **Focus asked for by the orchestrator:**
  - migration 0015: is index creation safe on the pilot's Neon database with existing data, are the names right, and is the Drizzle snapshot consistent;
  - `newQuestionId`: a uniform UUID v4 from secure randomness, with no `Math.random`;
  - the scrypt queue cap: can a burst lock out a legitimate login, does a refusal leak anything, and how the error reaches the UI;
  - the Windows-safe CLI spawns: still offline, with no env file read;
  - the FR-5 duplicate-Token test;
  - the `live={false}` Notices against `EXPERIENCE.md`;
  - the accuracy of the README and `.env.example`.
- **Triage:**
  - Every claim was checked at the cited lines, and past the diff where needed: `server/auth/index.ts` (`logIn`, `register`), `server/boundary.ts`, `lib/errors.ts` (`toFailure`, `MESSAGES`), the login Server Action, `server/env.ts`, `server/db/client.ts` and `migrate.ts`, `components/Notice.tsx`, the 0014 and 0015 snapshots, `package.json` scripts, tsx's `package.json`, and the pilot section of `tests/manual/checklist.md`.
  - A script compared the 0014 and 0015 snapshots table by table (see "Verified clean").
  - No OpenRouter call was made, and no `.env` file was read.
- **Test run:** not run. No finding depended on a test result. The spec records `npm run test` (824 passed, 1 skipped) and `npm run test:e2e` (100 passed) after the last code commit.
- **No fixes were applied.** No source file, spec, `deferred-work.md` or sprint status was changed. The step-04 write-back to the spec was skipped on purpose, because this run was asked to triage and report only, and another reviewer works on the same working copy.

## Summary

| Severity | Count | Routing |
|---|---:|---|
| High | 0 | |
| Medium | 1 | patch (deploy step) |
| Low | 7 | 4 patch, 3 defer |
| Dismissed | 13 | see the last section |

### Verified clean (checked in triage, not only claimed by a layer)

- **Migration 0015 (finding 1 of the audit).**
  - Three plain `CREATE INDEX` statements on `answer(question_id)`, `answer(group_id)` and `answer_group(question_id)`. There is no data change, no `UNIQUE` and no `NOT NULL`, so existing rows cannot make it fail.
  - Postgres builds a non-concurrent index under a `SHARE` lock, which blocks writes to `answer` and `answer_group` for the length of the build. At pilot size that is milliseconds. `CONCURRENTLY` is not available anyway, because the Drizzle migrator runs the migrations in a transaction.
  - None of the three duplicates an existing index. No unique index in the schema leads on these columns.
  - The names follow the schema's own pattern (`<table>_<column>_idx`, beside the existing `_key` unique indexes).
  - The 0015 snapshot's `prevId` is the 0014 id. Every table except `answer` and `answer_group` is identical between the two snapshots, and those two differ only by the three indexes, which match `schema.ts`. The journal entry is in order.
  - The code reads nothing new, so the order of deployment and migration does not matter for correctness. The rollout step is still missing (finding 1).
  - The `pg_index` test reads `indkey[0]`, so it checks that each column *leads* an index, which is what the cascade's lookups need.
- **`newQuestionId` (audit finding 2).** It fills 16 bytes from `crypto.getRandomValues`, which browsers provide outside a secure context too. It then sets the version nibble (`bytes[6] & 0x0f | 0x40`) and the RFC 4122 variant (`bytes[8] & 0x3f | 0x80`). The other 122 bits are uniform, and there is no `Math.random` and no modulo bias. It was the only client-side `randomUUID`. The unit test stubs `crypto` with only `getRandomValues`, checks the v4 shape on 200 ids, and checks that `saveQuestionSchema` accepts them.
- **The scrypt queue cap (audit finding 5).**
  - `limited()` refuses before it takes a slot or joins the queue, so a refusal leaks no slot. The `finally` handoff is unchanged.
  - **Lockout.** `logIn` awaits `verifyPassword` with no catch around it. The rethrown `DomainError` leaves the function before `failed_logins` is touched, so a refused attempt never counts toward a lockout. A burst can refuse a legitimate login on the same instance, but it cannot lock the account. The new `shortcut:` states that limit.
  - **Leaks.** The refusal does not depend on the email or the password: the database read happens first for every attempt, and an unknown email goes through the same `limited()` with `DUMMY_HASH`. So it reveals neither whether the account exists nor whether the password is right. It reveals only that the instance is busy.
  - **UI.** `withBoundary` passes the `DomainError` through, the login and registration actions map it with `toFailure`, and the form shows "Noe gikk galt hos oss. Prøv igjen om litt." `register` and `createHost` share the cap through `hashPassword`, with the same message.
- **CLI spawns (audit finding 6).** The three test files spawn `process.execPath` with `node_modules/tsx/dist/cli.mjs`. That file exists in the pinned tsx 4.23.15 and is the target of tsx's public `./cli` export and its `bin`. No `--env-file` flag is passed, and the env carries an empty or dummy `OPENROUTER_API_KEY` or a test `DATABASE_URL`, so the tests stay offline. Node reads no env file unless told to. The only other spawn in `tests/` is `make-zip`, which already skips Windows.
- **FR-5 Token uniqueness (audit finding 7).** The test issues a real link for Game A, then inserts a row with the same `token_hash` for Game B. `invite_link.token_hash` is the primary key, the only unique constraint on the table, so the 23505 can come from nothing else, and Game B is left with no rows.
- **The played Game's deletion notice (audit finding 14).** `Notice` with `live={false}` renders no `role`. That follows the epic 7 decision already used on the landing page and in `AccountForm`. The page keeps one polite region (`EXPERIENCE.md`, the live-region rule), and static text is not a status message. The negative regex in `play.test.ts` fails if `role="status"` comes back on that `div`.
- **Reworded `shortcut:` and TRACE lines (debt rows 7, 8, 10 and 14).** Each names a limit and a trigger, as `CLAUDE.md` asks. The TRACE line for the Game lock states what is not proven.

## Findings

### Medium

#### 1. The pilot on Neon does not get migration 0015 by itself, and the spec says it does

- **Location:** `spec-herding-for-frysen.md:29` ("It runs with `npm run db:migrate` and at app start like the earlier migrations"); `src/server/db/client.ts:60`; AD-3 in `ARCHITECTURE-SPINE.md:100`.
- **Source:** Acceptance Auditor and Edge Case Hunter. The Blind Hunter raised the same point but assumed the migration runs at app start, which is wrong.
- **What happens:**
  - Only `pglite://` databases migrate on open. A `postgres://` database migrates only through a manual `npm run db:migrate`, as AD-3 and `client.ts` say. No build step, `vercel.json` entry or CI job migrates Neon.
  - The pilot section of `tests/manual/checklist.md` says to migrate before merging a PR "whose code reads a new column". This PR adds no column, so someone following the checklist could skip the step.
  - Nothing breaks if the step is skipped, because no query depends on the indexes. But the pilot is the only hosted database, so the fix for audit finding 1 would not reach the place it is for. Every Game delete and purge there would still scan `answer` once per Group.
- **Fix (no code change):**
  - Run `npm run db:migrate` against the pilot with `DATABASE_URL_UNPOOLED`, following the checklist's migrate note. It can run before or after the merge.
  - Say so in the PR description.
  - Correct the spec sentence to "PGlite migrates on open; the pilot needs `npm run db:migrate`", and widen the checklist rule from "a new column" to "any migration".

### Low

#### 2. A login refused by the queue cap leaves no log line

- **Location:** `src/server/auth/password.ts:23-27` (`limited()`), `src/server/boundary.ts:35`, and the new `shortcut:` at `src/server/auth/password.ts:18`.
- **Source:** Blind Hunter, Edge Case Hunter and Verification Gap.
- **What happens:** `limited()` throws `DomainError("INTERNAL")`, and `withBoundary` logs only errors that are not a `DomainError`. A flood that reaches the cap is invisible in the Vercel logs. The new `shortcut:` makes the upgrade depend on Hosts reporting "Prøv igjen om litt", but the operator has no signal of their own to confirm it.
- **Fix:** log one line before the throw, in the existing shape: `log({ module: "auth", op: "scrypt", code: "QUEUE_FULL" })`. It must not include the email. Mention it in the `shortcut:` trigger.

#### 3. The `PORT` text leaves out the effect that made it a finding

- **Location:** `README.md:248`, `.env.example:6-7`; the effect is at `src/server/env.ts:35`.
- **Source:** Edge Case Hunter, Acceptance Auditor and Blind Hunter.
- **What happens:** the new text says that `npm run dev` and `npm start` take `PORT` from the shell, and that "only `npm run demo` reads it here". That is true of the port the server listens on. But Next still loads `.env.local` into `process.env` for the app's code, so `env.ts` builds the default `APP_BASE_URL` from it. A reader who puts `PORT=4000` in `.env.local` and believes it is ignored gets a server on 3000 and Invite links to port 4000. That broken link is the problem the audit described, and the text does not mention it. Setting `PORT` in the shell, as the text says, works correctly, because the shell value wins over `.env.local`.
- **Fix:** add one clause to both places: "a `PORT` in `.env.local` still sets the address in the links, so leave it at 3000 unless you use `npm run demo`."

#### 4. The two Review page Notices could become live regions again without any test failing

- **Location:** `src/app/spill/[id]/gjennomgang/page.tsx:100` and `:104`; `tests/integration/review.test.ts:572` and onwards; `tests/e2e/review.spec.ts:55` and `:145`.
- **Source:** Verification Gap (pre-verified, filed as `patch`), Blind Hunter and Acceptance Auditor.
- **What happens:** the new TRACE line says the played notice is static "like the Review page's fallback and narrow-screen Notices", but only the played notice has a role assertion. The Review tests find the NO_KEY and NARROW texts with `getByText` or by text in the HTML, and neither checks the role. If `live={false}` is removed from either one, it is announced again next to the page's own polite region, and every gate stays green.
- **Fix:** in the "fallback Notice on the page" tests, assert that the HTML has no `role="status"` before the NO_KEY text, and do the same for NARROW. This mirrors `play.test.ts`.

#### 5. Nothing checks that "Legg til spørsmål" uses `newQuestionId`

- **Location:** `src/components/QuestionEditor.tsx:106`; `tests/unit/question.test.ts`; the e2e tests run on `localhost`, which is a secure context.
- **Source:** Verification Gap (pre-verified, filed as `patch`).
- **What happens:** the unit test covers the helper, not its caller. If the editor went back to `crypto.randomUUID()`, every test would still pass, because Playwright runs on `localhost`, where `randomUUID` exists. A Host on plain `http://<LAN-IP>` would then get a `TypeError` on "Legg til spørsmål" again, which is the problem audit finding 2 fixed.
- **Fix:** in `tests/e2e/questions.spec.ts`, use `page.addInitScript` to set `Crypto.prototype.randomUUID` to `undefined`. Then add a Question and expect "Lagret". This follows the existing `navigator.clipboard` pattern in `invite-links.spec.ts`.

#### 6. `EXPERIENCE.md` still gives every info Notice `role="status"` (defer)

- **Location:** `EXPERIENCE.md:350` (component table) against `:391` (one polite region per page); `live={false}` at `gjennomgang/page.tsx:100` and `:104` and `src/app/spill/[id]/page.tsx:270`.
- **Source:** Acceptance Auditor.
- **What happens:** the spec names the conflict and follows the epic 7 decision. The code is right by the live-region rule. But the component table, in a contract that wins over everything else in this project, still describes the old behaviour, and now five call sites differ from it. The gap started in epic 7, so it is not new here.
- **Fix:** a dated amendment to the Notice row: "static page text uses no role; `role="status"` only for a Notice that appears or changes after a user action."

#### 7. AD-6 does not mention the queue cap (defer)

- **Location:** `ARCHITECTURE-SPINE.md:153` ("At most 2 scrypt runs at a time per process"); `src/lib/limits.ts` (`SCRYPT_QUEUE_MAX = 8`).
- **Source:** Acceptance Auditor.
- **What happens:** login and registration can now be refused with `INTERNAL` when more than eight runs are waiting. That is a visible behaviour, and the architecture record does not have it. A later change to the hashing limits would not see the cap, or the rule that a refusal is never counted as a wrong password.
- **Fix:** add one sentence to AD-6's "Hashing limits": "At most 8 more wait; one beyond that is refused with `INTERNAL` and never counted toward a lockout."

#### 8. Other foreign-key columns still have no leading index (defer)

- **Location:** the 0015 snapshot: `invite_link.game_id`, `game.host_id`, `session.host_id`, `reveal.team_id`, and `play_state.current_question_id` and `current_team_id`.
- **Source:** Blind Hunter.
- **What happens:** each purged Game scans `invite_link`, though that table stays small because its rows are deleted at close. The Game list filters `game` by `host_id` with a full scan. At pilot scale none of this is measurable, and the audit did not raise it. The `pg_index` test lists three columns by hand, so it will not catch the next missing index.
- **Fix:** after the freeze, decide whether to index `game.host_id` and `invite_link.game_id`. Optionally, widen the test to walk `pg_constraint` and require a leading index on every foreign key, with a list of allowed exceptions.

## Dismissed

1. **Migration 0015 runs at app start on the pilot, so several serverless instances may race it** (Blind Hunter). False. A `postgres://` URL is never migrated on open (`client.ts:60`, AD-3). Finding 1 covers the real gap, which is the opposite.
2. **Non-concurrent `CREATE INDEX` blocks writes on the pilot** (Blind Hunter). True but negligible at pilot size, and `CONCURRENTLY` is impossible inside the migrator's transaction. See "Verified clean".
3. **The `pg_index` test would accept a partial or invalid index** (Edge Case Hunter). Drizzle generates neither, and no code creates one. A filter would guard a state nobody can reach.
4. **The `play.test.ts` negative regex breaks if markup appears between the role and the text** (Blind Hunter, Edge Case Hunter). `Notice` renders its children straight into the `div` that carries the role, so the regex catches the actual regression. A markup change would be a new component, and its tests would change with it.
5. **The CLI tests hard-code a private tsx path** (Blind Hunter). `dist/cli.mjs` is the target of tsx's public `./cli` export and its `bin`, and tsx is pinned exactly. `createRequire().resolve("tsx/cli")` would give the same file. The repeated constant in two files is cosmetic.
6. **The refusal message says "Noe gikk galt hos oss", which is not a busy message, and the spec quotes only "Prøv igjen om litt"** (Blind Hunter). The message is true enough for a rare overload, and it asks for the right action. A new error code is a new surface for a case the cap exists to make rare. The quote is a substring, not a misquote.
7. **`SCRYPT_QUEUE_MAX = 8` has no rationale** (Blind Hunter). Eight waiters behind two runs is about four rounds of one derivation each, which is well inside the request time limit. The number is a judgement call, and the `shortcut:` names when to revisit it.
8. **No integration test calls `logIn` with the queue full** (Blind Hunter). `logIn` awaits `verifyPassword` with no catch, so the throw leaves before any counter write. The unit test was checked to fail without the rethrow, and the existing integration tests already prove that the counter is written only after `verifyPassword` returns.
9. **Registration can now fail with `INTERNAL`, and that is not written down** (Blind Hunter). The same `shortcut:` and limit cover both paths. Finding 7 records the cap in AD-6, and that covers both.
10. **The debt ledger `ponytail-debt-2026-11-24.md` is out of date** (Blind Hunter). It is a dated snapshot, not a living file. `CLAUDE.md` asks for `ponytail-debt` to be run again before the freeze, and that run regenerates it.
11. **Audit findings 4 and 8 are not tracked as issues** (Blind Hunter). Both are recorded as "not done" in the spec and in the audit's Fixes table, which are committed. Moving them into `.logs/` is the session log's job, not a code change.
12. **The spec says "two tests" and the audit says "three tests" for finding 14** (Blind Hunter, Acceptance Auditor). The spec is right for the tests that now find the notice by text. The third file asserts that the role is absent. The fix would be an edit to the spec or the audit text, and nothing depends on it.
13. **The `PORT=3000` line in `.env.example` should be commented out** (Blind Hunter). The value equals the default, so copying it changes nothing. Finding 3 covers the real trap.

## Verdict

**Approve after the pilot migration in finding 1.** No high findings.

- **Correct and well guarded:**
  - an index-only migration that is safe on populated tables, with consistent names and a correct snapshot chain;
  - a v4 UUID from `getRandomValues`, with no `Math.random`;
  - a queue cap that leaks nothing, never counts toward a lockout and shows the generic retry message;
  - offline CLI spawns that work without a shell;
  - an FR-5 test that hits the real primary key;
  - static Notices that follow the one-polite-region rule.
- **The one medium finding:** the pilot gets the new indexes only when someone runs `npm run db:migrate` against Neon. The spec says otherwise (finding 1).
- **The low findings:**
  - an unlogged refusal (2) and an incomplete `PORT` sentence (3);
  - two test gaps on the call sites of the changed code (4 and 5);
  - three items to defer: the design contract (6), the spine (7) and further indexes (8).
- **Before the PR:** migrate the pilot and say so in the PR description (finding 1). Findings 2 to 5 are each one line or one test.
