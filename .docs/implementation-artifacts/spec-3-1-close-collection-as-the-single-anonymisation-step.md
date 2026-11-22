---
title: 'Story 3.1: Close Collection as the single anonymisation step'
type: 'feature'
created: '2026-11-22'
baseline_revision: 'aa26a85c5f8709efc88919d44026e64848e4afb7'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/.docs/implementation-artifacts/epic-3-context.md'
  - '{project-root}/.docs/planning-artifacts/ux-designs/ux-Toppsvar-2026-11-21/DESIGN.md'
  - '{project-root}/.claude/skills/impeccable/reference/craft-floor.md'
warnings: [oversized]
deferred: []
---

<intent-contract>

## Intent

**Problem:** A Game can collect Answer sets but never close. Until it closes, every Answer sits in a `submission` row keyed by a Token hash, so the data still links Answers to Invite links and keeps arrival order.

**Approach:** Add `collection.close`, one transaction that turns every Answer set into shuffled, keyless `answer` rows. Each row gets a fresh random Contributor key per Answer set and Question. The transaction deletes every link and submission of the Game and moves it to *grouping*. A best-effort VACUUM follows the commit. The Game page gets the close button and dialog, and a *grouping* panel.

## Boundaries & Constraints

**Always:**
- One transaction, in the AD-9 order: `lockForMutation(hostId, collecting)`, then at least `SUBMISSIONS_MIN` sets, then the rows, then one `crypto` Fisher-Yates shuffle over every row of the Game, then one `grouping.insertAnswers(tx, rows)` call, then delete `invite_link` (submissions cascade), then `transition(collecting → grouping)`, which sets `grouping_lease_until = now + 180 s`.
- `answer` has `id` (uuid v4 `gen_random_uuid()`), `question_id`, `contributor_key` (uuid, nullable), `rank` (1–5, nullable), `text` and `normalized_text`. `group_id` arrives in Story 4.2. Never add a serial, identity, time-ordered id, timestamp or ordinal.
- `rank` is the 1-based index in the stored set, which is already field order. `normalized_text` comes from `normalize()`.
- The close reads Question IDs from the stored sets' keys, so it never calls `questions.ofGame`, a `getDb()` read that would deadlock inside a PGlite transaction.
- After commit, run `VACUUM (FULL, SKIP_LOCKED) submission, invite_link` outside any transaction. It never throws, and it logs only `{ module, op: "vacuum", code: "INTERNAL", sqlstate }`. The same runs after `games.deleteOwned` deletes a *collecting* Game.
- New `ErrorCode` `TOO_FEW_ANSWER_SETS`, whose message is the full wireframe reason. Nothing reveals an exact count below three.
- `maxDuration = 300` on the Game page. A `"use server"` file may export only async functions, so the close action inherits it from the page it posts to.
- UI copy is the literal bokmål from EXPERIENCE.md. The button follows the `aria-disabled`-plus-visible-reason pattern of `InviteLinkPanel`. Stale-state codes refresh the view.
- Every new check carries its FR IDs in the test title and gets a `tests/TRACE.md` row. Add a foreign-ID case to `authz.test.ts` and a `WRONG_STATE` case to `game-state.test.ts`.

**Never:**
- No `after()` call and no `grouping.run`, `progress`, `resumeIfStale` or 3 s polling (all Story 4.2). No `answer_group` table. No Story 3.2/3.3 anonymity suites, beyond the asserts this story's ACs need.
- No logging of a Token, hash, edit secret, Answer text or action argument.
- Never select the Game's sets in an order that survives into `answer` without the shuffle. No `ORDER BY` stands in for the shuffle.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Close | owner, *collecting*, ≥3 sets | `answer` rows in shuffled order; links and submissions of this Game gone, other Games untouched; state *grouping*; lease about now + 180 s | — |
| Too few | owner, *collecting*, 0–2 sets | nothing changes, `updated_at` included | `TOO_FEW_ANSWER_SETS` |
| Foreign or malformed Game | another Host, random UUID, `"abc"` | nothing changes | `NOT_FOUND` |
| Wrong state | any state except *collecting* | nothing changes | `WRONG_STATE` |
| VACUUM fails | forced rejection | close still `ok`; one log line, SQLSTATE only | swallowed |
| Submit after close | former link, form opened before close | no row | `COLLECTION_CLOSED` |
| Open after close | any former link, revoked ones included | closed page; `openInviteLink` gives `COLLECTION_CLOSED` | — |
| Race | close commits between submit's lookup and its lock | submit refused, no partial set | `COLLECTION_CLOSED` |
| Race | submit commits before close locks | that set is among the closed Answers | — |

</intent-contract>

## Code Map

- `src/server/collection/index.ts` -- add `close(hostId, input)`. Reuse `withBoundary`, `validate`, `games.lockForMutation` and `games.transition`. Sets come from `submission` joined to `invite_link` on `game_id`. `submit` already maps `WRONG_STATE` to `COLLECTION_CLOSED` under the lock; `resolveLink` checks state before the Token (carry-over c).
- `src/server/grouping/index.ts` (new) -- `insertAnswers(tx, rows)`, the only writer of `answer` (AD-1). ESLint `MODULES` already lists `grouping` before `collection`.
- `src/server/db/schema.ts` -- add the `answer` table and `game.grouping_lease_until` (timestamptz, nullable), then run `npm run db:generate` to write migration `0006`.
- `src/server/db/vacuum.ts` (new) -- `vacuumCollectionTables(module)`, best-effort and never throwing. It lives in the db layer because both `games.deleteOwned` and `collection.close` call it, and `games` may not import `collection`.
- `src/server/games/index.ts` -- `transition` sets `groupingLeaseUntil` when `to === "grouping"`. `deleteOwned` vacuums after commit when the locked state was `collecting`.
- `src/lib/normalize.ts` and `src/lib/shuffle.ts` (new) -- pure. `shuffle` uses `randomInt` from `node:crypto`, as `token.ts` uses `node:crypto`.
- `src/lib/limits.ts` -- `GROUPING_LEASE_MS = 180_000`.
- `src/lib/errors.ts` -- `TOO_FEW_ANSWER_SETS`.
- `src/lib/invite-link.ts` -- `closeCollectionSchema = z.object({ gameId: z.string() })`. Malformed IDs are left to `lockForMutation`, as in `createInviteLinksSchema`.
- `src/app/spill/[id]/actions.ts` -- `closeCollection(input)` through `hostAction`.
- `src/app/spill/[id]/page.tsx` -- `maxDuration = 300`. The *collecting* "Innsamling" section adds `<CloseCollection>` under ProgressCount. A new *grouping* section holds the Judge sentence. `noKey = !env.OPENROUTER_API_KEY`, read in the server component.
- `src/components/CloseCollection.tsx` (new) -- patterned on `InviteLinkPanel`: `aria-disabled` trigger plus reason, or `ConfirmDialog` with a pending primary confirm. A failure shows in a `Notice`. `WRONG_STATE`, `NOT_FOUND` and `TOO_FEW_ANSWER_SETS` refresh the view.
- `src/components/AnswerForm.tsx` -- read-only. It already shows the late-submit sentence and clears the key on `COLLECTION_CLOSED`.
- `tests/integration/collection.test.ts` -- has the `race.hook` mock on `questions.ofGame`, which runs between submit's lookup and its transaction. Close never calls `ofGame`, so a hook can run a real close.
- `tests/integration/{authz,game-state,delete}.test.ts`, `tests/TRACE.md` -- extend these.

## Tasks & Acceptance

**Execution:**
- `src/lib/normalize.ts`, `src/lib/shuffle.ts`, `tests/unit/normalize.test.ts`, `tests/unit/shuffle.test.ts` -- create both with `NORMALIZE_VERSION = 1`. Test NFC, `İ`/Turkish-style lower case without a locale, trim, collapse, trailing `.,!?;:…` mixed with spaces, the fallback, and that the shuffle returns a permutation and leaves its input unmutated -- AC1.
- `src/server/db/schema.ts` and `drizzle/0006_*` -- add `answer` and `grouping_lease_until`, with the migration generated -- AC3.
- `src/server/grouping/index.ts`, `src/server/db/vacuum.ts`, `src/server/games/index.ts`, `src/server/collection/index.ts`, `src/lib/{errors,limits,invite-link}.ts` -- `close` as specified -- AC2–AC4.
- `src/app/spill/[id]/{actions.ts,page.tsx}`, `src/components/CloseCollection.tsx` -- action, page states and component. Use `impeccable` and read craft-floor.md first -- AC5.
- `tests/integration/collection.test.ts` -- add a `describe("close")`:
  - the refusal at 0, 1 and 2 sets, with nothing changed;
  - a happy path with rows, ranks, normalisation, one key per set and Question, v4 ids, other Games untouched and the lease;
  - a shuffle proof: 3 sets × 3 Questions × 5 Answers, read in `ORDER BY ctid`, fail if every key's rows are contiguous, which any unshuffled build would produce;
  - `insertAnswers` called once;
  - a forced VACUUM failure through a spy on `db.execute`, with close still `ok` and a log line holding only the SQLSTATE;
  - after close, every former link and a link revoked before close are closed through `openInviteLink`, `linkStatus` and the server shell, and a late submit is `COLLECTION_CLOSED` with no row;
  - both race orders with a real `collection.close`: the hook order, and submit-then-close;
  - an unordered `Promise.all` race that ends either included or refused, never partial -- AC2–AC4, carry-overs a–c.
- `tests/integration/delete.test.ts` -- deleting a *collecting* Game runs the VACUUM, a forced failure still deletes, and deleting a *draft* Game skips the VACUUM -- AC3.
- `tests/integration/authz.test.ts`, `tests/integration/game-state.test.ts` -- foreign-ID `NOT_FOUND` and `WRONG_STATE` cases for close -- conventions.
- `tests/e2e/close.spec.ts` -- the AC5 flow, at 360 px:
  - the button is disabled with the reason at two sets, then the dialog appears at three, with the no-key sentence (e2e runs without a key);
  - Esc cancels, and focus returns to the trigger;
  - confirming shows "Grupperer" and the panel sentence;
  - a Participant whose form opened before close submits, sees the sentence, and their `localStorage` key is gone;
  - axe finds no serious violations -- AC5.
- `tests/TRACE.md` -- add rows under FR-10, FR-13 and FR-17 -- conventions.
- `ARCHITECTURE-SPINE.md` -- amend AD-9 (SKIP_LOCKED instead of `lock_timeout`, the vacuum helper in the db layer) and AD-24 (the action inherits the page's `maxDuration`) -- spine discipline.

**Acceptance Criteria:**
- Given the story's AC1–AC5 in `epics.md`, when the suites run, then each AC has a passing test whose title carries its FR IDs.
- Given a DB dump right after close, when the rows of `answer` are read in physical order, then they do not follow Answer set, Question or arrival order, and no Token hash, submission or link of the Game remains.

## Spec Change Log

## Review Triage Log

### 2026-11-22 — Review pass
- verdicts: 28 findings — high 0, medium 2, low 22, false 4, maybe-false 0
- findings:
  - `[medium]` `[patch]` Verification Gap: the close dialog's failure paths (network failure, stale view) have no test. Fixed: `close.spec.ts` now aborts the POST and checks that the dialog stays open with a focused NETWORK alert and the Game is still collecting. A second tab of the same Host closes the Game, and the first tab's confirm then refreshes to "Grupperer".
  - `[low]` `[patch]` Verification Gap: nothing checks the `randomInt(i + 1)` bound, so a Sattolo variant (`randomInt(i)`) would pass. Fixed: the mock records each `max`, and the test asserts `[4, 3, 2]`.
  - `[low]` `[patch]` Verification Gap: nothing proves the no-key sentence is hidden when a key is set. Fixed: an integration render of the collecting page checks that the sentence is present without a key and without Demo mode, and absent with either.
  - `[low]` `[patch]` Verification Gap (other): `purgeExpired` deletes idle collecting Games without the VACUUM. Fixed: purge returns each deleted state and vacuums when one was collecting. A `purge.test.ts` case covers both a collecting and a draft Game.
  - `[low]` `[reject]` Edge Case Hunter: `SKIP_LOCKED` skips a locked table with only a WARNING notice, so nothing is logged and nothing retries. Real, but the VACUUM is best-effort by AD-9, and a skip needs a concurrent reader of those exact tables during the moment of the call. Detecting a notice is driver-specific (PGlite and postgres.js differ), which AD-2 keeps out of module code.
  - `[low]` `[patch]` Edge Case Hunter: the lease came from the app clock, but AD-9 says DB `now() + 180 s`, and Story 4.2 compares against DB `now()`. Fixed: it is now `sql\`now() + ${GROUPING_LEASE_MS} * interval '1 millisecond'\``.
  - `[false]` `[reject]` Edge Case Hunter: leaving *grouping* never clears `grouping_lease_until`. No code reads the lease. Story 4.2's `acquireGroupingLease` compares it only for a Game in *grouping*, so a stale value on a later state is never consulted.
  - `[low]` `[patch]` Edge Case Hunter: the purge skips the VACUUM. Same root as the Verification Gap purge row; fixed there.
  - `[low]` `[reject]` Edge Case Hunter: the fallback keeps inner whitespace (`"?  !"` vs `"? !"`). AC1 defines the fallback literally as "the trimmed lower-cased text". Two punctuation-only Answers that differ only in inner spaces are rare, and the Judge or the Host can still group them.
  - `[low]` `[reject]` Edge Case Hunter: when `TOO_FEW_ANSWER_SETS` follows a revoke in another tab, the refresh unmounts the dialog and focus drops to body. It needs a revoke in another tab between render and confirm. The disabled branch then shows the same sentence as the failure, so nothing is lost, and the fix needs a new focus effect, not a direct correction.
  - `[low]` `[reject]` Edge Case Hunter: `acted` stays true after a network failure that never committed, so a later unmount focuses an `<h1>`. The only later unmount is a route change, where `RouteFocus` moves focus to the new page's `<h1>` anyway.
  - `[low]` `[patch]` Blind Hunter: the no-key sentence would show in Demo mode, where stored rulings group the Answers. Fixed: `noKey={!env.OPENROUTER_API_KEY && !env.DEMO_MODE}`, covered by the render test above.
  - `[low]` `[patch]` Blind Hunter: the grouping panel promises "under to minutter" while nothing runs Grouping before Story 4.2, and there is no `shortcut:` marker. Fixed: a `shortcut:` comment now sits on the panel.
  - `[low]` `[patch]` Blind Hunter: the AD-9 amendment overstated a "never-block guarantee", although the VACUUM FULL rewrite holds ACCESS EXCLUSIVE briefly. Fixed: the spine now says `SKIP_LOCKED` never waits for a lock or queues ahead of live submits, while the rewrite itself holds both tables briefly.
  - `[low]` `[reject]` Blind Hunter: a skipped VACUUM is never logged. Same root and reason as the Edge Case Hunter `SKIP_LOCKED` row.
  - `[low]` `[reject]` Blind Hunter: the `normalize()` fallback skips the collapse. Same root and reason as the Edge Case Hunter fallback row.
  - `[low]` `[reject]` Blind Hunter: on `TOO_FEW_ANSWER_SETS` the error and focus are lost. Same root and reason as the Edge Case Hunter focus row.
  - `[low]` `[reject]` Blind Hunter: `acted` stays true after a network failure. Same root and reason as the Edge Case Hunter `acted` row.
  - `[low]` `[reject]` Blind Hunter: `answer.question_id` has no index. At pilot scale (at most 50 sets × 20 Questions × 5 Answers per Game) the cascade and later reads scan a small table. Story 4.2 and Epic 5 own the read paths and can add the index with their queries. Adding one now is an addition nobody needs yet.
  - `[low]` `[patch]` Blind Hunter: the rank check hard-codes 5 (`ANSWERS_PER_QUESTION_MAX`), and the nullable columns are unexplained. Fixed: the check is built from the constant (the generated SQL is identical, so the migration is unchanged), and a comment says `review.confirmBoard` clears both columns (AD-10). The nullable part itself is spine-mandated, not a defect.
  - `[low]` `[reject]` Blind Hunter: no test checks the column shape of `answer`. Story 3.2 AC1 (`anonymity.test.ts` over `information_schema`) is that test, and the intent scopes this run to Story 3.1.
  - `[low]` `[patch]` Intent Alignment (a): the run-count proof would pass for a build that keeps Answer sets in arrival order but shuffles inside each set. Fixed: it also asserts that the S{k} set indices in `ctid` order are not non-decreasing.
  - `[medium]` `[patch]` Intent Alignment (b): the "submit first" race order was fully sequential, so submit holding the Game lock while a real close waits was never exercised. Fixed: a one-shot hook around `games.lockForMutation` (the real function runs) starts a real `collection.close` right after submit's lock. Submit succeeds, the close resolves, and the late set's 6 rows are among the Answers.
  - `[false]` `[reject]` Intent Alignment (c): the revoked link is checked only below the browser. AC4 is labelled integration. The server shell decides "closed" from the Game state before any Token, so the rendered shell the test checks is exactly the page a browser gets for any former link.
  - `[low]` `[reject]` Intent Alignment: a skipped VACUUM is not tested. Same root and reason as the Edge Case Hunter `SKIP_LOCKED` row.
  - `[false]` `[reject]` Intent Alignment: `maxDuration` sits on the page only. A `"use server"` module may export only async functions, so the action cannot export it. Server Actions run under the route segment they post to, and the spine is amended accordingly.
  - `[low]` `[patch]` Intent Alignment: the no-key sentence was not checked with a key set. Same root as the Verification Gap no-key row; fixed there.
  - `[false]` `[reject]` Intent Alignment: the bookkeeping is missing from the diff. The spec and the epic-3 context were left out of the review diff on purpose, and `sprint-status.yaml` is updated at finalization, before the commit.

### AI suggestions corrected or rejected (grading evidence)

- **The orchestrator corrected the plain reading of the spine:**
  - `SKIP_LOCKED` replaces `lock_timeout = '2s'`, since a session `SET` cannot be trusted on a pooled connection, and VACUUM cannot share a multi-statement string.
  - The VACUUM helper lives in the db layer, because `games` may not import `collection`.
  - `maxDuration` goes on the page only.
  - Close reads Question IDs from the stored sets, so it never calls `questions.ofGame` inside the transaction, which would deadlock under PGlite.
- **The orchestrator corrected the implementer:** the first full `test:e2e` run failed once in `close.spec.ts`. axe saw `document-title` in the moment the action's re-render rebuilt the head. The orchestrator added a wait for "Hyttetur – Toppsvar" before that axe call, and the spec then passed 20 of 20 repeats. This is a real assertion that the title comes back, not a skip.
- **The implementer departed from the spec, and the orchestrator accepted it:**
  - The existing FR-12 "only the count changes at three" test now masks the close control, since the control changes at three by design.
  - The control is still checked separately.
- **Reviewer suggestions rejected:**
  - logging `SKIP_LOCKED` notices;
  - clearing the lease on leaving *grouping*;
  - collapsing whitespace in the fallback;
  - a focus effect for the rare `TOO_FEW` refresh;
  - resetting `acted`;
  - an index on `answer.question_id`;
  - a schema-shape test (that is Story 3.2);
  - a browser-level revoked-link check.

  The reasons are in the rows above.

## Design Notes

- **SKIP_LOCKED instead of `lock_timeout = '2s'`.** VACUUM cannot run in a transaction block, and a multi-statement string counts as one. So `SET lock_timeout` would have to be a separate statement on the same connection. A pooled postgres.js client (Neon's pooler) does not guarantee that without driver-specific code, which AD-2 keeps in `client.ts`. `SKIP_LOCKED` never waits for a lock and never queues an ACCESS EXCLUSIVE request in front of live submits.
- **Shuffle proof.** Any build that skips the shuffle writes each Answer set's rows for a Question next to each other. A random permutation of 45 rows keeps all nine 5-row blocks contiguous with probability 9!·(5!)⁹/45!, about 10⁻³³, so the test cannot flake.

```ts
const rows = sets.flatMap(({ answers }) =>
  Object.entries(answers).flatMap(([questionId, texts]) => {
    const contributorKey = randomUUID();
    return texts.map((text, i) => ({ questionId, contributorKey, rank: i + 1, text, normalizedText: normalize(text) }));
  }),
);
await grouping.insertAnswers(tx, shuffle(rows));
```

## Verification

**Commands:**
- `npm run lint && npm run format:check && npm run typecheck` -- expected: clean
- `npm run test` -- expected: all pass, offline
- `npm run test:e2e` -- expected: all pass, offline, no key
- `npx drizzle-kit check` -- expected: no drift

## Auto Run Result

Status: done

**Summary.** `collection.close` is the single anonymisation step. One transaction runs the AD-9 sequence:
- lock the Game while it is *collecting*;
- require at least three sets;
- give each Answer set and Question a fresh `randomUUID()` Contributor key;
- normalise the texts;
- shuffle every row of the Game with a `node:crypto` Fisher-Yates;
- write them with one `grouping.insertAnswers` call;
- delete the Game's links (sets go by cascade);
- move the Game to *grouping*, with the lease set to DB `now()` + 180 s.

After the commit, a best-effort `VACUUM (FULL, SKIP_LOCKED)` runs. It never throws and logs only the SQLSTATE. The same VACUUM runs after deleting, or purging, a *collecting* Game. On the Game page, "Steng innsamlingen" is `aria-disabled` with the reason below three sets, and opens the ConfirmDialog from three, adding the no-key sentence when there is neither a key nor Demo mode. After the close, the page shows "Grupperer" and the Judge sentence. A form opened before the close gets the late-submit sentence and loses its `localStorage` key.

**Files changed.**
- `src/server/collection/index.ts`: `close`.
- `src/server/grouping/index.ts` (new): `insertAnswers`, the only writer of `answer`.
- `src/server/db/vacuum.ts` (new): the best-effort VACUUM.
- `src/server/games/index.ts`: the lease in `transition`, and the VACUUM in `deleteOwned` and `purgeExpired`.
- `src/server/db/schema.ts` and `drizzle/0006_rare_earthquake.sql` (with its snapshot): the `answer` table and `game.grouping_lease_until`.
- `src/lib/normalize.ts` and `src/lib/shuffle.ts` (new): the FR-17 rule and the crypto shuffle.
- `src/lib/{errors,limits,invite-link}.ts`: `TOO_FEW_ANSWER_SETS`, `GROUPING_LEASE_MS` and `closeCollectionSchema`.
- `src/app/spill/[id]/{actions.ts,page.tsx}`: the `closeCollection` action, `maxDuration = 300`, the close control and the *grouping* panel.
- `src/components/CloseCollection.tsx` (new): the button, the dialog, and the failure and refresh handling.
- Tests:
  - new: `tests/unit/{normalize,shuffle}.test.ts` and `tests/e2e/close.spec.ts`;
  - extended: `collection`, `authz`, `game-state`, `delete` and `purge` integration tests, and `errors.test.ts`;
  - `tests/TRACE.md` rows.
- `ARCHITECTURE-SPINE.md`: AD-9 and AD-24 amended.

**Review.** 28 findings: 0 high, 2 medium, 22 low, 4 false. 12 rows patched, in 11 entries (2 medium, 9 low); no item deferred. 16 rows rejected: 12 low and 4 false, each with its reason in the triage log.

**Follow-up review recommended: true.** Two medium entries were patched. The unverified risk is that the forced lock-ordering race test runs on PGlite, whose single connection serialises transactions. It proves the ordering, but not row-lock contention between two connections on real Postgres, where `SELECT … FOR UPDATE` is what serialises close and submit.

**Verification.**
- `npm run lint`, `npm run format:check`, `npm run typecheck` and `npx drizzle-kit check` are clean.
- `npm run test`: 415 passed in 32 files.
- `npm run test:e2e`: 84 passed. Before the title wait, `close.spec.ts` alone failed 2 of 12 repeats; after it, it passed 20 of 20.
- No server was left running.

**Residual risks.**
- Nothing runs Grouping until Story 4.2. A closed Game stays in *grouping*, and the panel's "under to minutter" is not yet true (marked with a `shortcut:` comment).
- Story 3.2 AC1 expects all seven AD-10 columns, but `group_id` arrives only in Story 4.2. Story 3.2 must account for that.
- A VACUUM skipped by `SKIP_LOCKED` is silent.
