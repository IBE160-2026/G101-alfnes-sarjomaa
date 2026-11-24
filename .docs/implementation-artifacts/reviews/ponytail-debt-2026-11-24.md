# Ponytail debt ledger, 2026-11-24

Scope: `main` at `ff0a998` (after the epic 8 merge), before the Stage 1 freeze on 1 December. Scanned with `git grep -nE '(#|//|/[*]|\{/\*|<!--) ?(shortcut|ponytail):'` over every tracked file outside `_bmad/`, `.claude/`, `.docs/`, `wiki/` and `prompting/`, so `src/`, `tests/`, `scripts/`, `.github/`, `drizzle/` and the root config were all covered. A second, looser grep for `shortcut:` found one more marker in prose (`tests/TRACE.md`), which is listed too. No older `ponytail:` markers remain. One hit was skipped: `src/components/FullscreenKey.tsx:5` says "A play-view shortcut", which is a keyboard shortcut, not a deferral.

The skill reads and reports only. Nothing in the code was changed.

Assessment key: **keep** (the limit is real but acceptable for Stage 1 and the trigger is clear), **fix before freeze**, **move to Stage 2** (belongs in the Stage 2 backlog rather than the code), **stale** (the reason is gone and the comment can be removed or reworded).

## Ledger

### Root config

1. `playwright.config.ts:74`, the e2e suite runs `npm run demo` as its second web server on the working copy's `.data/demo`. **Ceiling:** Next 16 allows one `next dev` per repo, so the run exits (reason in `dev.log`) while a developer's `npm run dev` or demo is running, and every e2e run deletes and recreates `.data/demo`. **Upgrade:** give the e2e server its own `distDir` if that bites. **Assessment: keep.** It only affects developers who run e2e and the demo at once. The grader runs one at a time, and the failure is explicit, not silent.

### src/cli

2. `src/cli/demo.ts:7`, `tsconfig.cli.json` maps `next/navigation` to a private Next path (`next/dist/client/components/navigation.react-server.js`). **Ceiling:** a private import can move in any Next release. **Upgrade:** re-check when upgrading Next. **Assessment: keep.** `next` is pinned to the exact version `16.4.6` in `package.json`, and CI's demo smoke step would catch a break. Do not bump Next before the freeze.

### src/components

3. `src/components/DownloadReport.tsx:10`, the usage report link fetches on click so an error stays on the Game page. **Ceiling:** without JavaScript, an error still opens the raw JSON body. **Upgrade:** add a no-JS error page "if that matters". **Assessment: keep.** The trigger is soft, but the no-JS error path is a rare corner of an already rare download, and the JS path, which every supported browser uses, handles the error.

4. `src/components/OnceLinkList.tsx:35`, the once-shown Invite link list warns before leaving through `beforeunload` and in-app link clicks. **Ceiling:** browser Back and Forward inside the app are not covered, because `popstate` cannot be cancelled. **Upgrade:** intercept the router if Hosts lose links that way. **Assessment: keep.** A lost link can be revoked and a new one created, so the worst case is extra work for the Host, not lost Answers. Watch for it in the pilot (SM-6).

5. `src/components/QuestionEditor.tsx:105`, new Question drafts get their client-side id from `crypto.randomUUID()`. **Ceiling:** it needs a secure context (https or localhost). **Upgrade:** generate the id another way if plain-http LAN hosting is ever supported. **Assessment: fix before freeze (small).** The premise "every supported setup is a secure context" does not hold in the code's own terms. The architecture spine (AD-8, edit secret) plans for plain `http://<LAN-IP>`, `src/server/collection/index.ts:68-69` says `APP_BASE_URL` may be a LAN IP, and `src/components/OnceLinkList.tsx:76-77` already handles the Host's own page on plain `http://<LAN-IP>` (no clipboard there). A Host who opens the app at the LAN address that `APP_BASE_URL` points to gets a `TypeError` from "Legg til spørsmål" and cannot write Questions (FR-4). The fix is a few lines: build the version-4 UUID from `crypto.getRandomValues`, which works without a secure context, as `newEditSecret` in `src/lib/invite-link.ts:84` already does. See the audit of the same date, finding 2.

6. `src/components/useDocumentTitle.ts:8`, a `MutationObserver` re-applies the page title after Next re-renders the root layout's `<title>`. **Ceiling:** a workaround for framework behaviour. **Upgrade:** replace with metadata or a React `<title>` once Next stops rewriting `<title>`. **Assessment: keep.** The trigger is tied to a Next upgrade, which is frozen (see row 2). The title matters for screen readers (NFR-6), so the workaround must stay until the upgrade.

### src/lib

7. `src/lib/limits.ts:54`, `TEAM_NAME_MAX = 14` is sized so four names of wide letters fit the Team column at 48 px with up to two-digit Scores. **Ceiling:** three-digit Scores with four such names overflow. **Upgrade:** raise only if a real round gets there. **Assessment: keep, but the trigger is misleading.** Three-digit Scores are normal at pilot scale: SM-6 describes 8 to 15 Questions and 10 to 30 Participants, and a Score is the sum of revealed Counts, so a Team passes 100 in an ordinary round. Overflow still needs four Teams with near-maximum wide-letter names at the same time, which is unlikely with real names. Suggested follow-up before the freeze: run manual check A8 once with a three-digit Score, or reword the trigger to "if four long names and three-digit Scores occur together".

### src/server

8. `src/server/auth/password.ts:17`, scrypt runs are capped at `SCRYPT_CONCURRENCY` (2) per process with a wait queue. **Ceiling:** the queue is unbounded and there is no rate limit, so a login flood delays real Hosts. **Upgrade:** add a queue cap or a per-IP limit before a public pilot. **Assessment: fix before freeze, or consciously accept and reword.** The trigger has fired: the pilot is publicly reachable with open registration (AD-24). Per-account brute force is already stopped by the lockout counter (epic 1 review, finding 9), so this is about availability, not account takeover. The smallest fix is a queue cap that refuses with the existing `INTERNAL` error ("Prøv igjen om litt") when `waiting.length` passes a small bound. On Vercel each function instance has its own queue, so the cap limits delay per instance, not across the deployment. If the group decides the pilot's size makes this acceptable, change the trigger so it no longer names a condition that is already true.

9. `src/server/db/vacuum.ts:23`, `VACUUM (FULL, SKIP_LOCKED) submission, invite_link` after a close, a delete and the hourly purge. **Ceiling:** it rewrites both tables for every Game under ACCESS EXCLUSIVE, so submits to other Games wait for it. **Upgrade:** per-Game cleanup or partitioning if submits start queueing behind it. **Assessment: keep.** This is what makes FR-11 to FR-13 hold at the storage level (dead rows do not linger), so it must not be cut. At pilot scale the tables are tiny and SKIP_LOCKED avoids waiting on held locks.

10. `src/server/games/index.ts:329`, the FR-3 retention purge is one unbatched `DELETE` with no index on `played_at`/`updated_at`. **Ceiling:** fine at pilot scale. **Upgrade:** batch it and add an index if Games reach tens of thousands. **Assessment: keep the shortcut, but its ceiling names the wrong limit.** The `game` table is small, so the missing index on `played_at`/`updated_at` is harmless. The real cost of this `DELETE` is in the cascade: `answer.question_id`, `answer.group_id` and `answer_group.question_id` have no index, so every deleted Group scans the whole `answer` table. That cliff comes after dozens of Games, not tens of thousands. See the audit of the same date, finding 1, which proposes the three indexes.

11. `src/server/judge/providers/openrouter.ts:101`, on 429 or 5xx the live Judge retries at once and ignores `Retry-After`. **Ceiling:** a 429 usually repeats. **Upgrade:** wait for `Retry-After` inside the abort signal if 429s show up in the pilot. **Assessment: keep.** The grader runs without a key (replay or mock Judge), so this path never runs in grading, and a failed Grouping run already has a retry path for the Host.

12. `src/server/judge/providers/replay.ts:107`, the replay Judge names the first covered item's ruling as the result's model and prompt version. **Ceiling:** other items may come from a different ruling. **Upgrade:** record one model per Question if mixed fixtures ever matter. **Assessment: keep.** The recorded fixtures in `data/rulings/` come from one model per run, so the reported model is right for every fixture that ships.

### tests

13. `tests/e2e/fixtures.ts:31`, the anonymity secret scan records every string leaf of a `/svar` action's arguments. **Ceiling:** Answers under 3 characters and UUID-shaped Answers are not scanned (too many false hits). **Upgrade:** add them if a test ever relies on such an Answer. **Assessment: keep.** It is a deliberate filter in a test helper, and no test Answer is that short or UUID-shaped.

14. `tests/TRACE.md:142`, the trace entry for the Game lock test says the SQL-text check (`for update`) stands in for a real race test "(`shortcut:` until Story 7.3's real-Postgres CI job)". **Assessment: stale, reword.** Story 7.3's job exists: `.github/workflows/ci.yml` has the `postgres` job (Postgres 17, `TEST_POSTGRES_URL`), and on Postgres the SQL-text test is skipped (`tests/integration/collection.test.ts:1605`, `it.skipIf(onPostgres)`) while the real concurrent test at `tests/integration/collection.test.ts:1437` ("a close started while submit holds the Game lock waits for it") runs there. The entry should say which test covers the lock on Postgres instead of naming a future story. Whether that Postgres test was checked to fail without `.for("update")` is not recorded; if it was not, check it once before the freeze, since FR-10 rests on it.

## Summary

| Assessment | Count | Rows |
|---|---:|---|
| Keep | 11 | 1, 2, 3, 4, 6, 7, 9, 10, 11, 12, 13 |
| Fix before freeze | 1 | 5 |
| Fix before freeze, or accept and reword | 1 | 8 |
| Move to Stage 2 | 0 | |
| Stale, reword | 1 | 14 |

14 markers, 0 with no trigger. Two triggers need attention even though they exist: row 8's trigger ("before a public pilot") is already true, and row 7's trigger ("if a real round gets there") will be true in an ordinary pilot round, so it should name the real condition. Row 3's trigger ("if that matters") is the softest of the rest.
