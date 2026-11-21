---
reviewer: adversary
target: ARCHITECTURE-SPINE.md (draft, 2026-11-21)
spec: prds/prd-Toppsvar-2026-10-12/prd.md (§3, §4, §5, §6)
cross-checked: ux-designs/ux-Toppsvar-2026-11-21/EXPERIENCE.md (where a UX rule makes a divergence concrete)
date: 2026-11-21
---

# Adversarial review: compatible-by-the-letter, incompatible in fact

Method: for each finding, two units one level down (stories or modules built by different people or agents, reading only the spine and their story). Both units follow every AD as written, yet the result does not work, or breaks a PRD testable consequence. Each finding ends with the AD text to add or tighten.

**Verdict:** the spine is strong on anonymity at close and on the Judge boundary. The holes sit where two modules meet: `answer_group` has no column contract and two writers, `game` columns are written by four modules through exports that don't exist, the transaction-passing contract is implicit, and Grouping start/restart races on every close. One Host-visible timestamp defeats FR-8.

| Tier | Count |
| --- | ---: |
| Critical | 2 |
| High | 7 |
| Medium | 14 |
| Low | 6 |

---

## Critical

### C1. Participant submits touch `game.updated_at`, and the Host's Game list shows it (FR-8, FR-12)

- **Unit A, `collection.submit`:** follows AD-8 to the letter: "Each edit replaces the row and touches `game.updated_at`."
- **Unit B, Game list (FR-2):** follows EXPERIENCE.md ("Rows: title, StatusBadge, 'Sist endret {dato}'") and passes the `game` row, `updated_at` included, to a client component.
- **Divergence:** the Host messages one person, refreshes the list, and sees "Sist endret" move to today. Even if only the date is rendered, the RSC payload carries the full ISO timestamp to the browser. This is exactly what FR-8's "fewer than 3" rule exists to prevent ("so a Host cannot learn who answered by watching it change right after messaging one person"). The AD-22 `host-anonymity.spec.ts` looks for Answer text and per-link state. It will not flag a timestamp, so CI passes.
- **Severity:** critical. It defeats an explicit PRD guard, and nothing would catch it.
- **Fix (tighten AD-8, AD-23; add to AD-10's Host-DTO rule):**
  > Participant actions never write any `game` column. `game.updated_at` is bumped only by Host mutations, through `games.lockForMutation` (see H2). While a Game is `draft` or `collecting`, no Host page, DTO, RSC prop or action response contains `updated_at` or any other value that changes on a Participant submit; the Game list shows `created_at` instead. `host-anonymity.spec.ts` submits an Answer set between two Host page loads and asserts that the two serialised responses are byte-identical apart from the progress count once it reaches 3.

### C2. `answer_group` has two writers and no column contract, so labels go stale and SM-5 data diverges

- **Unit A, `grouping` story:** owns `answer_group` (AD-1) and creates it with what AD-12 and AD-18 mention: `id, question_id, label, origin, edit_count`. It stores `label` as the FR-16 default at creation.
- **Unit B, `review` story:** AD-1 gives it "updates to `answer.group_id` and `answer_group` after Grouping", which contradicts AD-1's own rule that "only the owning module writes a table". It needs a discard flag, which no AD defines. It adds `discarded boolean` in its own migration and computes the label on read as "custom ?? default", because AD-11 lists Default label among the rules that are computed when read.
- **Divergence:**
  1. If A's stored label wins, then after "Move to a new Group" (split, UJ-3), the source Group keeps the label "snakker med dørvakten" even though no such Answer remains. That breaks FR-16 ("default label is its most frequent normalised Answer text").
  2. If B's computed label wins, A's stored labels are dead data. The merge rule ("keeps the label of the merged Group with the highest Count") then has nowhere to persist when that label was itself a default.
  3. Merge: A expects the surviving Group to keep its id. B inserts a new `origin = host` Group. SM-5 ("share of `origin = judge` Groups that reach the Board with `edit_count = 0`") then measures different things depending on who wrote merge.
  4. Empty Groups: UX says "empty source Groups disappear". The spine is silent. One story deletes the empty Groups and another keeps them with Count 0, and then a zero-Count Group can reach `board_slot`.
- **Severity:** critical. This is the central data contract of the screen the PRD calls the decision point, it has two authors, and parallel branches will generate conflicting migrations for the same table.
- **Fix (new AD-1 row and a column list in AD-10):**
  > `grouping` owns the `answer` and `answer_group` schemas and exports the only writers: `insertAnswers`, `run`, and for Review `createGroup(tx, questionId, answerIds)`, `moveAnswers(tx, answerIds, groupId)`, `setCustomLabel(tx, groupId, label | null)`, `setDiscarded(tx, groupId, bool)` and `deleteIfEmpty(tx, groupId)`. `review` writes neither table directly. `answer_group` columns are exactly `id, question_id, custom_label (nullable, 1–40), discarded (bool, default false), origin (judge | fallback | host), edit_count`. The effective label is `custom_label ?? defaultLabel(answers)`, computed when read (AD-11). Merge keeps the id of the highest-ranked source Group, sets its `custom_label` to that Group's effective label at merge time, moves every other source's Answers into it, and deletes the emptied sources. A Group left with zero Answers by any operation is deleted in the same transaction. `edit_count += 1` on every Group whose Answers, label or discard flag change in an operation (the merge survivor, both sides of a move, the new Group excepted since it is `origin = host`).

---

## High

### H1. Cross-module writers that open their own transaction, or use the singleton `db`, deadlock under PGlite

- **Unit A, `review.rename`:** opens `db.transaction(tx => …)`, locks the Game, and calls `questions.setReviewed(tx, id, false)` as AD-15 requires.
- **Unit B, `questions.setReviewed`:** follows the Conventions rule "A multi-row change is one `db.transaction`". It ignores the `tx` it was given, or wraps a fresh `db.transaction`, or calls `db.update` on the singleton.
- **Divergence:** PGlite serialises transactions behind one mutex, so the inner call waits on the outer transaction forever. The request hangs. On Postgres, the inner write runs on another connection, outside the lock, and is not atomic with the outer change. Both units satisfy "inside the caller's transaction (`tx`) where atomicity matters", because nothing says who decides what matters.
- **Severity:** high. It hangs the dev server, and the cause is hard to diagnose.
- **Fix (tighten AD-1):**
  > Every function exported from a module's `index.ts` for use by another module takes `tx: Tx` (exported from `src/server/db`) as its first parameter, runs only on that `tx`, and never calls `db.transaction` or touches the singleton `db`. Only a module's top-level entry point, the one a Server Action, Route Handler or CLI calls, opens a transaction. Entry points never take `tx`. Lint rule: inside `src/server/<module>/`, the `db` import is allowed only in the file that defines entry points.

### H2. `game` columns are written by four modules through exports that don't exist

- **Units:** `collection.createInviteLinks` and `revoke` increment `game.invite_links_issued` (AD-8). `grouping` writes `game.grouping_lease_until` (AD-12). `play.finish` "sets `game.played_at`" (AD-16). `collection` and the others "touch" `updated_at`.
- **Divergence:** `games` exports only `transition, getOwned, bumpCounters, touch`. Each story either writes `game` directly, which breaks AD-1, or invents its own `games.*` export, so the result is two or three ad-hoc helpers with different locking. The Participant path has no `hostId`, so `getOwned` can't lock for it either. Each module then hand-writes its own `SELECT … FOR UPDATE`. One will forget it, or use `FOR SHARE`, and "submit racing close" becomes a real race.
- **Severity:** high.
- **Fix (tighten AD-1, AD-4):**
  > `games` exports the only `game` writers: `lockForMutation(tx, { hostId?, gameId, states })` (locks `FOR UPDATE`, applies the AD-5 ownership check when `hostId` is given, refuses with `WRONG_STATE` or `NOT_FOUND`, and bumps `updated_at` only for Host calls; see C1), `transition(tx, gameId, from, to)` (sets `played_at` when `to = played` and `grouping_lease_until` when `to = grouping`), `reserveInviteLinks(tx, gameId, n)` (increments `invite_links_issued` and refuses with `LINK_CAP_REACHED` past 50), `acquireGroupingLease(gameId, seconds)` and `bumpCounters`. Every state-dependent mutation starts with `lockForMutation`. No other module issues `FOR UPDATE` on `game`.

### H3. Every close starts two Grouping runs

- **Unit A, close action:** commits, returns, and starts `grouping.run` with `after()` (AD-9, AD-12). `run` sets the lease when it starts.
- **Unit B, Game page:** on load, restarts a run "that died" when the lease is not in the future (AD-12). The close action's client immediately navigates to or refreshes the Game page.
- **Divergence:** the page load arrives before the `after()` callback has set the lease, sees `grouping` with a null lease, and starts a second run. Each Question's items then go to the Judge twice. That breaks §6.2 ("never judged twice") and AD-12's own "No pair is judged twice", and doubles cost. If counters are bumped at "Finish" (AD-12), both runners can bump them, which falsifies the FR-18 export. A lease that is shorter than the 120 s bound, and never renewed, also lets the 2 s polling (AD-17) restart a healthy run.
- **Severity:** high.
- **Fix (tighten AD-12):**
  > The lease is set to `now() + 180 s` by `games.transition(collecting → grouping)` inside the close transaction. `grouping.run(gameId)` is the `after()` starter and runs unconditionally once. A Host page load calls `grouping.resumeIfStale(gameId)`, which takes the lease by compare-and-set (`UPDATE game SET grouping_lease_until = now() + 180 s WHERE id = $1 AND state = 'grouping' AND grouping_lease_until < now()`) and runs only if a row was updated. The runner extends the lease after each completed Question. Counters for a Question (`judge_groups_proposed`, `judge_calls`, `questions_fell_back`) are bumped in the same transaction that inserts its `grouping_result`, never at Finish. If inserting that `grouping_result` hits the unique violation, the transaction rolls back and the result is discarded.

### H4. "Question position" has no definition, and play steps by `+1`

- **Unit A, `questions` story (FR-4):** stores `question.position`. Remove leaves gaps (1, 2, 4), and reorder swaps positions or uses fractional keys.
- **Unit B, `play` story:** stores `play_state.current_question_position` (AD-16), implements "next Question" as `+1`, and "last Question" as `position = count(question)`.
- **Divergence:** after one removal in draft, play looks up position 3, finds nothing, and either crashes or ends early. FR-27's "after the last Question … the Game moves to *played*" then fails. The answer form and Review ("Spørsmål 3 av 9") also number Questions from `position`.
- **Severity:** high.
- **Fix (tighten AD-16, add a `questions` rule in AD-4):**
  > `question.position` is dense `1..n`, unique per `(game_id, position)`, and renumbered in the same transaction on every remove or reorder. Positions are frozen once the Game leaves `draft`. `play_state` stores `current_question_id` and `current_team_id` (not positions). "Next Question" is the Question with the smallest `position` greater than the current one. "Last" means none exists. `board_slot.position` is the slot's rank within its Question and is never compared with `question.position`.

### H5. Module functions check the Game's owner but not the IDs of its children, which allows cross-Host writes (FR-1)

- **Unit A, `review.moveAnswers(hostId, gameId, answerIds, targetGroupId)`:** follows AD-5. It calls `getOwned(tx, hostId, gameId)`, then runs `UPDATE answer SET group_id = $target WHERE id IN (answerIds)`.
- **Unit B, `play.reveal(hostId, gameId, boardSlotId)`:** does the same with a `board_slot` id.
- **Divergence:** the ownership check covers the Game in the URL, not the children named in the input. A Host who has any `answerId`, `groupId` or `boardSlotId` from another Game can move that Game's Answers into their own Group, and then read the Answer text in their own Review. That breaks FR-1 ("refused with the same response as for a Game that does not exist") and FR-12. It also allows moves across Questions within one Game, which AD-10 ("Answers joined across Questions") is meant to prevent.
- **Severity:** high. The fix costs one join.
- **Fix (tighten AD-5):**
  > Every ID taken from input other than `gameId` (Question, Answer, Group, Board slot, Team) is resolved with a join constrained to the owned `gameId`, and Answer and Group IDs in one Review operation must also share one `question_id`. If any ID fails to resolve, the call throws `NotFound`, and the whole operation is refused. `authz.test.ts` covers one child ID from a foreign Game per mutating function.

### H6. Ranking and the Board limit are computed in two places with two collations

- **Unit A, Review display:** sorts in SQL, `ORDER BY count DESC, rank1 DESC, label`, because AD-11 says Count is computed "in SQL".
- **Unit B, `review.confirmBoard`:** sorts with `src/lib/ranking.ts` (AD-11) using `a.localeCompare(b)`, or JS `<`.
- **Divergence:** SQL `ORDER BY label` uses the database collation. PGlite uses the C collation, and a hosted Postgres usually uses `en_US.UTF-8`. Neither sorts æ ø å like `nb`. Review can therefore show one order and freeze another. The order on PGlite can also differ from the order in the CI Postgres job. Two Groups can end up with the same label after a rename, so the final tie is undefined. Whether "most frequent `normalized_text`" counts rows or distinct contributors also differs between implementers: one person who wrote "pizza" five times wins the label under the row count.
- **Severity:** high. It breaks FR-19's "in Board order" against FR-21's Board, and it is flaky across drivers.
- **Fix (tighten AD-11):**
  > Order is decided only by `rankGroups()` and `boardCut()` in `src/lib/ranking.ts`. SQL supplies per-Group aggregates (`count`, `rank1_count`, label frequencies by distinct `contributor_key`) and never orders by label. Labels are compared with `new Intl.Collator('nb', { sensitivity: 'base' })`, and the final tiebreak is `answer_group.id`. Review display, the "Ikke på brettet" split and `confirmBoard` all call `boardCut(rankGroups(groups))`. Frequency for the default label counts distinct Contributor keys, not rows.

### H7. The `/svar` page renders Questions for anyone who has the `gameId`, and reads that need the token have no transport

- **Unit A, `/svar/[gameId]` page:** follows AD-7. The `gameId` decides status, so on `open` it server-renders the form with every Question. The token is only needed at submit.
- **Unit B, "reopen" story (FR-7):** needs `collection.loadOwnAnswerSet(token)`. AD-17 covers mutations only, so it fetches with `?t=<token>` from a client component or a Route Handler.
- **Divergence:** under A, the Question text (usually about named people) is served to anyone who has the path, and the path lands in platform access logs (AD-24) and in history once the fragment is dropped. Under B, the token ends up in a query string, which is exactly what AD-7 exists to prevent.
- **Severity:** high.
- **Fix (tighten AD-7, AD-17):**
  > The `/svar/[gameId]` server render contains only the status shell (`unknown | closed | open`) and the notice. Questions and the link's existing Answer set are returned by one Server Action, `openInviteLink(gameId, token)`, which looks up `invite_link` by `(token_hash, game_id)` and returns `unknown` if no row matches. Server Actions are also the only transport for reads that need a token. No Route Handler or query string ever carries a token.

---

## Medium

### M1. Review story cannot build "Angre forkasting" without breaking AD-4

- **A:** AD-4's `in_review` list: "merge, move, rename, discard, mark reviewed, confirm".
- **B:** EXPERIENCE.md requires "Undo discard", and checks it in the A6 manual check.
- **Divergence:** a story that follows AD-4 refuses it. A story that follows UX departs from AD-4 without amending the spine. Split also needs to be explicit (UJ-3).
- **Fix:** in AD-4, `in_review`: "merge, move to an existing or new Group (split), rename, discard, undo discard, mark reviewed, confirm". Add `groups_restored` to AD-18, or state that undo discard decrements nothing.

### M2. `questions.setReviewed` is refused by the draft-only lock

- **A, `questions` story (FR-4):** guards every write to `question` with "state must be `draft`" (FR-4: "edit, add or remove … after Collection has opened is refused").
- **B, `review`:** calls `setReviewed(tx, id, …)` in `in_review` (AD-15).
- **Fix (AD-15):** "`questions.setReviewed` is the only `question` write allowed outside `draft`. It requires `in_review` and changes only `reviewed`."

### M3. Grouping can get stuck in `grouping` when the last two Questions finish together

- **A:** the per-Question write checks "does every Question have a result now?" and, if so, transitions (AD-12, Finish).
- **B:** writes the Question result without locking the Game row, because AD-4's lock rule names "every state-dependent mutation", and B reads Grouping as exempt ("none, except Grouping writing its results").
- **Divergence:** under READ COMMITTED, the two final transactions each see 19 of 20 results, so neither transitions. A resume finds no Question without a result, so it does nothing, and the Game stays in `grouping` for good.
- **Fix (AD-12):** "Each per-Question write calls `games.lockForMutation(tx, { gameId, states: ['grouping'] })`. After all Questions settle, `run` and `resumeIfStale` call `finishIfComplete(gameId)` (lock, count results, transition by compare-and-set). A resume with no Questions missing still calls it."

### M4. The `Judge` interface can't tell whether a result was stored or live, or what a failure was

- **A, `judge` story:** the anthropic provider returns a stored ruling (`calls: 0`) when the items match exactly. It throws `new Error('timeout')` or rethrows SDK errors, and retries invalid output internally.
- **B, `grouping` story:** sets `source` from `judge.info.provider` (so `judge` for anthropic), maps unknown errors to `ERROR`, and also retries once on `INVALID_OUTPUT`.
- **Divergence:** `grouping_result.source` is wrong for exact-match replays, so the rapport and the SM-5 inputs are wrong. `TIMEOUT` and `REFUSAL` collapse into `ERROR`, and FR-17's "told which Questions fell back" shows the wrong reason. Up to 4 calls per Question instead of 2.
- **Fix (AD-13):** "`partition` returns `{ assignments, calls, uncovered, source: 'live' | 'stored' }`. Failures throw `JudgeError` (exported from `judge/index.ts`) with `reason: FallbackReason`. An aborted signal is `TIMEOUT`. The provider owns the single retry, and `calls` includes it. `grouping` never retries, and maps any non-`JudgeError` throw to `ERROR`. `assignments` are canonicalised in `src/lib` (first-occurrence order `0..k-1`), and uncovered replay items get numbers after the stored clusters."

### M5. Uncovered replay items are counted as Judge proposals

- **A, replay:** "each uncovered item becomes its own cluster" with `fell_back = false` (AD-13). A ruling that covers none of the items is still `source = replay`.
- **B, grouping:** gives every Group of a non-fallback Question `origin = judge` and counts it in `judge_groups_proposed`.
- **Divergence:** demo extras and coincidental Question-text matches inflate SM-5 ("Groups that reach the Board unedited"). Review also shows these singletons as Judge proposals, not as "group by hand".
- **Fix (AD-12, AD-18):** "A Group formed only from uncovered items gets `origin = fallback` and is not counted in `judge_groups_proposed`. A replay ruling that covers zero items is a fallback with `NO_STORED_RULING`."

### M6. `judge:eval` items are raw strings, while AD-14 says they are normalised

- **A, `judge-eval` story:** AD-20: "Each raw answer string is an item, weighted by its respondent count."
- **B, `judge-record` / grouping:** AD-14: "`items` is the sorted distinct normalised list". "Sorted" itself is undefined (UTF-16 code-unit order or locale order).
- **Divergence:** `protoqa-dev.json` is recorded under one convention and replayed under the other. The anthropic provider's "item set matches exactly" never matches, so it goes live. B-cubed is scored over a different item set than Grouping ever sends. ProtoQA raw strings that normalise equal but sit in different gold clusters also have no rule.
- **Fix (AD-14, AD-20):** "Items are `normalize()`d, deduplicated and sorted by code-unit order (`[...set].sort()`), and the same function in `src/lib/normalize.ts` is used by grouping, replay, record and eval. In eval, a normalised item's weight is the sum of its raw strings' respondent counts, and its gold cluster is the cluster holding the largest share of that weight."

### M7. Default labels can be 80 characters, or empty, but labels must be 1 to 40

- **A, grouping:** default label = most frequent `normalized_text` (AD-11). Answers can be 80 characters, and `"!!!"` normalises to `""`.
- **B, review rename:** enforces 1 to 40 characters (FR-20) on rename only. `confirmBoard` copies whatever label it gets, and play renders it at 48 px or more.
- **Divergence:** a 70-character label overflows the TV layout, and an empty label shows up as a blank tile. Some stories truncate, others refuse to confirm, others do nothing.
- **Fix (AD-11):** "Default labels are cut to 40 characters at a word boundary in `ranking.ts`. `normalize()` falls back to the trimmed, lower-cased text when stripping punctuation leaves nothing. Answer validation trims first, and an Answer that is empty after trimming counts as an empty field (FR-6)."

### M8. `submission.jsonb` shape and rank numbering are undefined

- **A, form/submit story:** stores `{ [questionId]: ["a", "", "c"] }` as the fields stand, with the empty field kept to preserve field positions.
- **B, close story:** reads `rank = index + 1` (so 1, 3), or keys the answers by question position.
- **Divergence:** gaps in `rank` change the rank-1 tiebreak, and skew it if `""` is ever inserted. Keying by position and keying by id disagree.
- **Fix (AD-8):** "`submission.answers` is `{ questionId: string[] }` with every Question id present. Each array holds 1 to 5 trimmed, non-empty strings in field order, with empties removed before storage, so `rank = index + 1` is dense. The zod schema lives in `src/lib/answer-set.ts` and is used by the action, by `collection.submit` (again, with the Question ids from the DB) and by `close`."

### M9. Validation sits only in the action, so the CLI and tests bypass it

- **A:** Conventions put "zod schemas … next to each Server Action".
- **B:** `src/cli/demo.ts` and the integration tests call `collection.submit` directly (AD-1, AD-22). "One Answer for every Question" also needs the DB, so a shape schema can't express it.
- **Fix (AD-17):** "zod in `actions.ts` checks shape only. Every invariant (limits, completeness against stored Question ids, state) is enforced inside the module function, which reuses the shared schema from `src/lib`. The demo seed writes only through module functions."

### M10. The Server Action result shape has no place for field errors, and the error codes are an open list

- **A, participant form:** FR-6 requires showing "which Questions are missing". It adds `fieldErrors` to the result.
- **B, other actions:** return `{ ok: false, code, message }` exactly. Codes like `COLLECTION_CLOSED` vs `WRONG_STATE`, and `UNKNOWN_LINK` vs `NOT_FOUND`, get invented separately. One story turns `NotFound` into `notFound()` inside the action, another returns `{ ok: false, code: 'NOT_FOUND' }`.
- **Fix (AD-17):** "Result: `{ ok: true, data } | { ok: false, code, message, fieldErrors?: Record<string, string> }`. All codes and their bokmål messages live in `src/lib/errors.ts` as one `as const` map, and a new code is added there. zod failure → `INVALID_INPUT` with `fieldErrors` keyed by Question id. Unexpected throws → `INTERNAL`, logged without arguments. Actions return `NOT_FOUND` as data, and only pages call `notFound()`. On `/svar`, status and submit errors are exactly `LINK_UNKNOWN` and `COLLECTION_CLOSED`, decided in AD-7 order (Game first)."

### M11. Session sliding expiry and the `/svar` exclusion depend on where the cookie is refreshed

- **A, auth story:** sets the cookie `Max-Age = 14 d` at login and slides only the DB row. RSCs can't set cookies.
- **B, auth story variant:** adds a `proxy.ts` (middleware) on all paths to refresh the cookie and the DB row.
- **Divergence:** under A, a Host who uses the app daily is logged out 14 days after login, which breaks FR-1's "expires after 14 days without use". Under B, `/svar` requests touch the session row and get `Set-Cookie`, contrary to AD-7's "never reads the session cookie".
- **Fix (AD-6):** "The cookie has no `Max-Age` (a browser-session cookie) or is refreshed only by `proxy.ts`, whose `matcher` is limited to `/spill/:path*`, `/logg-inn` and `/api/spill/:path*`. The DB `session.expires_at` is the authority and is extended at most once per hour by `auth.getSession`. Nothing under `/svar` or `/api/health` runs auth code."

### M12. `reveal` trusts the client's team and Question

- **A, play client:** sends `{ boardSlotId, teamId, scored }` from what it last rendered.
- **B, `play.reveal`:** follows AD-16 (refuses a slot that is already revealed) and inserts the reveal.
- **Divergence:** with a stale tab, or a double click across "Neste spørsmål", a slot from an earlier Question gets revealed and scored, or the Count goes to the wrong Team. FR-25 says "current Team".
- **Fix (AD-16):** "`reveal` takes `{ boardSlotId, scored }` only. The Team is `play_state.current_team_id`, read under the Game lock, and a slot whose Question is not `play_state.current_question_id` is refused with `WRONG_QUESTION`."

### M13. A Question can reach play with zero Board slots

- **A, review:** the Host discards every Group of one Question, then marks it reviewed and confirms. AD-15 only requires `reviewed`.
- **B, play:** renders a Question with no tiles. Whether it is skipped or blocks "Vis sluttstilling" depends on who wrote it.
- **Fix (AD-15):** "`confirmBoard` refuses with `EMPTY_BOARD_QUESTION` if any Question has zero non-discarded Groups."

### M14. Parallel epic branches generate clashing migrations

- **A, B:** two epic branches each run `db:generate` and both produce `0004_*.sql` plus a `_journal.json` entry. AD-3 says migrations are "never edited after merge", but says nothing before merge.
- **Fix (AD-3):** "Before merging, a branch deletes its unmerged migrations, rebases onto `main` and regenerates, so each PR adds migrations only after the latest one on `main`. CI fails if `drizzle-kit check` reports drift."

---

## Low

### L1. AD-11 says "Count in SQL", while unit tests cover "Count recalculation" in `src/lib`

A lib Count function needs `contributor_key`, and selecting it in a Host-facing query breaks AD-10. **Fix:** "Count is computed only in SQL. `tests/unit` covers ranking and label rules over aggregates. Count recalculation is an integration test."

### L2. `edit_count` and `groups_*` counters per operation

Covered by C2's `edit_count` rule. Also fix whether `groups_merged` counts operations or absorbed Groups: **"`groups_merged += sources − 1`, `answers_moved += answers`, `groups_renamed += 1`, `groups_discarded += 1`."**

### L3. Revoke and submit can resolve a token from another Game

`invite_link.token_hash` is unique across Games, so a lookup by hash alone accepts a Game B token under a Game A path or Game A's revoke field. **Fix (AD-7, AD-8):** "Every token lookup is `WHERE token_hash = $1 AND game_id = $2`."

### L4. Where `purgeExpired` keeps its "once an hour" state

It isn't said whether that state lives in memory (per instance on Vercel) or in a table. **Fix (AD-23):** "Throttle in memory per process (`globalThis`). Duplicate runs are harmless because the delete is idempotent."

### L5. Deleting a Game before close leaves dead Answer tuples

AD-9 vacuums after close only. A Game deleted during `collecting` keeps its submission tuples until autovacuum. **Fix (AD-23):** "`games.delete` and `purgeExpired` run `VACUUM submission, invite_link` after commit when a deleted Game was `collecting`." Name this in the README.

### L6. Stage 2 door: `transition(tx, gameId, from, to)` can't express `create → ready`

Also, nothing marks a Question-set Game for the FR-33 credit on the play screen. **Fix (AD-4, Deferred):** "FR-33 Games are inserted directly in `ready` by `games.createFromQuestionSet`, and `game.kind ∈ collected | question_set` is added then."

---

## PRD consequences at risk if the spine ships as is

| PRD consequence | Broken by |
| --- | --- |
| FR-8 "cannot learn who answered by watching it change" | C1 |
| FR-12 Host view, FR-1 "refused as not found" | H5, H7 |
| FR-16 default label after a split | C2 |
| FR-19 "in Board order" = FR-21 Board | H6 |
| FR-15 "runs exactly once", §6.2 "never judged twice", FR-18 counters | H3, M3 |
| FR-17 "told which Questions fell back" (correct reason) | M4 |
| FR-20 labels 1–40 | M7 |
| FR-25 "current Team", FR-26 undo scope | M12 |
| FR-27 reaching *played* | H4, M13 |
| FR-1 14-day sliding session | M11 |
