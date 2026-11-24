# Spec: hardening before the Stage 1 freeze

Branch: `herding-for-frysen`, from `main` at `f16adbe`. Date: 2026-11-24.

Input: the whole-repo audit `reviews/ponytail-audit-2026-11-24.md` and the debt ledger `reviews/ponytail-debt-2026-11-24.md`. Scope: the cheap findings only, before the freeze on 1 December. Every finding was checked against the code before it was acted on. Ponytail (`full`) applied throughout; `impeccable` was used for the one UI change (finding 14), which changes no pixels.

Gates on every commit: `npx prettier --check .`, `npm run lint`, `npm run typecheck` and `npm run test`, all green. `npm run test:e2e` was run once at the end (result below).

## Findings

| Finding | Done | Commit |
|---|---|---|
| Should 1, missing indexes under the delete cascade | Added `answer_question_id_idx`, `answer_group_id_idx` and `answer_group_question_id_idx` in migration `drizzle/0015_hard_terrax.sql` (via `npm run db:generate`; `npx drizzle-kit check` is clean). A test in `tests/integration/delete.test.ts` reads `pg_index` and was checked to fail without the migration. No timing test: the audit's PGlite measurement (4.4 s to 45 ms per deleted Game) stands as the evidence. The `shortcut:` on `purgeExpired` now names the real limit (debt row 10). | `fd3d0c0` |
| Should 2, `crypto.randomUUID` on plain http | `newQuestionId()` in `src/lib/question.ts` builds a version-4 UUID from `crypto.getRandomValues`; `QuestionEditor.tsx` uses it and the `shortcut:` is gone (debt row 5). Unit test removes `crypto.randomUUID` and checks shape, uniqueness and that `saveQuestionSchema` accepts the ids. | `3f16f24` |
| Should 3, `PORT` in `.env.local` | README row and `.env.example` comment say that `npm run dev` and `npm start` take `PORT` from the shell, and only `npm run demo` reads it from `.env.local`. | `1a2bf14` |
| Should 4, delete raw Answer text at Board lock | **Not done.** It changes AD-15 and an anonymity test, so it is a group decision, as the audit says. | none |
| Should 5, unbounded login queue | `SCRYPT_QUEUE_MAX = 8` in `src/lib/limits.ts`; one more scrypt run is refused with `INTERNAL` ("Prøv igjen om litt"). `verifyPassword` rethrows that `DomainError` instead of returning false, so a flood never counts toward an account lockout. The unit test was checked to fail with the cap removed and with the rethrow removed. The `shortcut:` (debt row 8) now names the limit that remains: the cap is per process and there is no per-IP limit. | `903184d` |
| Should 6, CLI tests spawn `node_modules/.bin/tsx` | The three files spawn `process.execPath` with `node_modules/tsx/dist/cli.mjs`. They stay offline: the key is empty or a dummy, and no env file is read. Not run on Windows here. | `8ed1398` |
| Should 7, Token uniqueness (FR-5) untested | Integration test: a second `invite_link` row with an existing `token_hash`, for another Game, is refused with SQLSTATE 23505. TRACE line under FR-5. | `1e1d379` |
| Should 8, Game lock proof on Postgres | **CI experiment not done**, as instructed. The stale TRACE line (debt row 14) is reworded: it names the Postgres race test that replaces the SQL-text check in CI, and states what is not proven (nobody has seen that test fail without `FOR UPDATE`, and only close against submit is raced there). | `1db68ab` |
| Debt row 7, `limits.ts` trigger | Reworded: three-digit Scores alone are normal; the column is at risk only when four long wide-letter names and Scores over 99 occur together. | `1db68ab` |
| Nice 9, `grouping.countsOf` used only by tests | **Skipped.** The replacement, `rankedGroups`, is private to the review module, and its public reader `review.load` has state guards that one of the three tests (in _grouping_) would not pass. Not a small, clearly safe change. | none |
| Nice 14, static Notices as live regions | `live={false}` on the Review page's fallback and narrow-screen Notices and on the played Game's deletion notice. The two tests that found the deletion notice by `role="status"` now find it by text. Note: `EXPERIENCE.md` gives info Notices `role="status"` in the component table but asks for one polite region per page; this follows the epic 7 decision (static text is not a status). | `eca02f3` |
| Nice 18, `typescript-eslint` devDependency | **Rejected.** Nothing imports it, but it is a deliberate exact pin recorded in the architecture spine (Stack, and the TypeScript 6.0.3 rationale in the architecture memlog). Removing it lets `eslint-config-next` resolve `^8.56.0` instead and needs a spine change, which is not worth it before the freeze. | none |
| Nice 10 to 13, 15 to 17, 19, 20 | Skipped, as instructed: not clearly safe and small enough for this pass. | none |

## Migration

`drizzle/0015_hard_terrax.sql`: three `CREATE INDEX` statements, no data change. It runs at app start on PGlite (local, demo, tests). On Postgres it runs only with a manual `npm run db:migrate` against Neon's `DATABASE_URL_UNPOOLED` (AD-3); the orchestrator ran it on the pilot before merge. The code does not need the indexes to be correct, only to be fast.

## Verification

- `npm run test` after the last commit: 824 passed, 1 skipped.
- `npm run test:e2e` after the last code commit: 100 passed. The first run found one more test (`tests/e2e/play.spec.ts`) that located the deletion notice by `role="status"`; it was fixed in the same commit as finding 14 (`eca02f3`), so every commit stays green.
- One full `npm run test` run during the work failed with timeouts in unrelated files while the machine's load average was above 20; the rerun was green and no test was changed for it.
