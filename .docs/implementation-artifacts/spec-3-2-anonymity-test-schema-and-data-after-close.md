---
title: 'Story 3.2: Anonymity test: schema and data after close'
type: 'feature'
created: '2026-11-22'
baseline_revision: 'c8e20b4e609ef2e3632e3e55e27d243844204085'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/.docs/implementation-artifacts/epic-3-context.md'
warnings: [oversized]
deferred:
  - summary: >-
      The Story 3.1 shuffle test accepts whole Answer sets written as blocks in a non-arrival order.
    evidence: |-
      Its set check is `sets.some((k, i) => i > 0 && k < sets[i - 1])`, which passes for blocks ordered 2, 0, 1.
      anonymity.test.ts now counts set runs (> 3) and went red on that break, so the property is covered; 3.1's own check is only weaker than its comment claims.
    location: >-
      tests/integration/collection.test.ts:1207
    severity: low
---

<intent-contract>

## Intent

**Problem:** Story 3.1 made close the single anonymisation step, but nothing inspects the stored schema and data as a whole after a real close. FR-13 and SM-3 need that proof on every run (AD-22 names `tests/integration/anonymity.test.ts`).

**Approach:** Add `tests/integration/anonymity.test.ts`. It builds one Game through the real actions (links, submits, a revoke), captures every Token, hash and edit secret, runs the real `closeCollection`, and then inspects `information_schema` and every row of every table. Test-only: no production code changes.

## Boundaries & Constraints

**Always:**
- One closed Game per file, made only through real entry points: `createInviteLinks`, `submitAnswerSet`, `revokeInviteLink`, `closeCollection`. The close runs its real VACUUM. The Questions are inserted directly, as in `collection.test.ts`.
- The fixture is 5 links: 3 submitted (3 Questions × 5 Answers each, every text naming its set), 1 unused, 1 revoked before close. The revoke issues a replacement link, which stays unused and is captured too. Every captured secret must be gone after close: Tokens, `sha256(Token)`, edit secrets and `sha256(edit secret)`.
- AC1 pins today's `answer` shape exactly: column name, `data_type`, `is_nullable` and `column_default`, for six columns. `group_id` arrives in Story 4.2, and AC1 names seven AD-10 columns. The list is an explicit allow-list with a comment pointing at 4.2, so 4.2 must add `group_id` to it on purpose. Never loosen it to "at most N" or "a subset of".
- Timestamp check: no column of type `timestamp*`, `date`, `time*` or `interval`, and no column named `*_at`, outside `host`, `session` and `game`. Assert the query finds `game.created_at`, so it cannot pass by matching nothing.
- Sequence check: `answer` has no identity column and no `nextval` default, and the `public` schema owns no sequence at all.
- Link check: once `invite_link` and `submission` hold zero rows, no table other than `host`, `session`, `invite_link` and `submission` has a column whose name contains `token`, `hash`, `secret`, `link` or `submission`. `host` and `session` are excluded because they hold the Host's own password hash and session-token hash, not a Participant's. No foreign key from any other table points at `invite_link` or `submission`.
- AC2 scans `row_to_json` of every row of every base table outside the system schemas. That covers every text and uuid column, and jsonb as well.
- AC3: no Contributor key appears under two Questions, and every `answer.id` and key is a v4 UUID.
- AC4: outside `host` and `session`, no column name matches the Participant identity patterns (`email`, `ip`, `user_agent`, `device`, `fingerprint`, `account`, `participant`, `phone`, a `*name` with a person prefix), and no column has type `inet`, `cidr` or `macaddr`. A bare `name` stays allowed, because Epic 6 names teams.
- The arrival-order check, which the intent asks for: in `ORDER BY ctid` the Game's 45 rows neither keep each key's rows contiguous nor keep the set indices non-decreasing. They also share one `xmin`, since they were inserted in one statement and so carry no per-row insertion sequence.
- Test titles carry FR IDs. Add `tests/TRACE.md` rows under FR-11 and FR-13, and drop 3.2 from their "Pending" lines.
- Prove that each check can fail: break the guarded code once (migration or `close`), watch the test go red, then restore it. Record each break here.

**Never:**
- No production code change, unless a check finds a real leak. In that case, fix the leak and record it.
- No Host-view, log or `env.ts`/`game` fixed-list checks. Those are Story 3.3. No after-confirm checks. Those are Story 5.5.
- No full-schema column allow-list beyond `answer`. Later epics add tables, and the name and type rules cover them.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Closed Game | 3 sets, 1 unused link, 1 revoked link, then a real close | every AC1–AC4 check and the order check pass | — |
| Schema regression | a migration adds a timestamp, serial, token column or a link FK to a Participant-side table | the matching AC1 or AC4 check fails | test red |
| Close regression | close keeps a link or set, reuses a key across Questions, or skips the shuffle | AC2, AC3 or the order check fails | test red |

</intent-contract>

## Code Map

- `tests/integration/collection.test.ts:1-141` -- the pattern to copy: the `next/*` mocks, `auth.register` with a session cookie, and the direct insert of `game` and `question`. Then `createInviteLinks` (links end in `#<token>`), and `submitAnswerSet(gameId, token, { answers, editSecret })`. No race mocks are needed.
- `tests/integration/collection.test.ts:1185-1210` -- the 3.1 `ctid` run and interleave check. The anonymity file repeats it compactly on its own fixture. It is the AD-22 home for FR-13, and 3.1's copy stays.
- `tests/integration/invite-links.test.ts:237-256` -- `information_schema.tables` plus `row_to_json(t)::text`, through `sql.identifier`. `db.execute` returns `{ rows }`, cast as there.
- `src/app/spill/[id]/actions.ts:71-89` -- `createInviteLinks`, `revokeInviteLink({ gameId, link })` and `closeCollection({ gameId })`.
- `src/server/collection/index.ts:281-316` -- `close`, the code guarded by AC2, AC3 and the order check (read-only).
- `drizzle/0006_rare_earthquake.sql` -- the `answer` DDL guarded by AC1 (read-only; broken temporarily only for the fail proof).
- `src/lib/token.ts` -- `newToken`, `sha256`.
- `tests/TRACE.md:145-180` -- the FR-11 and FR-13 sections.

## Tasks & Acceptance

**Execution:**
- `tests/integration/anonymity.test.ts` -- create. `beforeAll`: register the Host and build the fixture. Capture the secrets and close. Then one `describe` with one `it` per AC (AC1 may split into its four clauses), plus the order check -- AC1–AC4 and FR-13 arrival order.
- `tests/TRACE.md` -- add the rows and update "Pending" -- conventions.
- `.docs/implementation-artifacts/sprint-status.yaml` -- set `3-2-…` to `done` at finalization.

**Acceptance Criteria:**
- Given the story's AC1–AC4 in `epics.md`, when `npm run test` runs, then each has a passing test in `anonymity.test.ts` whose title carries its FR ID.
- Given each guarded rule, when it is broken once in the migration or in `close`, then at least one anonymity test fails, as this spec's fail-proof log records.

## Spec Change Log

- **`game.invite_links_issued` is exempt from the link-name check.** The rule as written ("no column whose name contains `link`") fails on today's schema, because `game` has the FR-8 counter `invite_links_issued` (integer). It counts issued links and references none, so it is not a leak. The test exempts exactly that one column, with a comment. No production change.
- **The column checks read only the `public` schema.** Drizzle keeps its migration log in `drizzle.__drizzle_migrations`, which has `hash` and `created_at` columns and would trip the name rules. That table belongs to the tooling, not the app. The AC2 row scan still covers every base table outside `pg_catalog` and `information_schema`, the drizzle one included.
- **The revoked link submits before it is revoked**, so its Token, edit secret and their hashes are captured as well (6 Tokens and 4 edit secrets, 20 values with hashes). The order check also asserts that only sets 0 to 2 reach `answer`.

- **Review pass 2026-11-22: the column and sequence checks now read every app schema.** This supersedes the "public only" entry above. They read every schema except `pg_catalog`, `information_schema`, `drizzle` and `pg_%`. The drizzle migration log stays out for the reason given there, and an app table in any other schema is now inspected.

### Fail-proof log (2026-11-22)

Each break was applied once, `tests/integration/anonymity.test.ts` was run, and the file was then restored (`git status` clean apart from the new files).

| Break | Where | Red test(s) |
|-------|-------|-------------|
| `answer.created_at timestamptz DEFAULT now()` | migration 0006 | AC1 shape, AC1 timestamp |
| `question.created_at timestamptz` | migration 0006 | AC1 timestamp |
| `question.seq serial` | migration 0006 | AC1 sequence (the `public` schema owns a sequence) |
| `answer.seq integer GENERATED ALWAYS AS IDENTITY` | migration 0006 | AC1 shape, AC1 sequence |
| `question.token_hash text` | migration 0006 | AC1 link |
| `question.x text REFERENCES invite_link` | migration 0006 | AC1 link (foreign key) |
| `question.addr inet` | migration 0006 | AC4 |
| `game.participant_email text` | migration 0006 | AC4 |
| `close` keeps `invite_link` (delete removed) | `collection/index.ts` | AC1 link (rows remain), AC2 |
| `close` uses one key per set across all Questions | `collection/index.ts` | AC3 |
| `close` inserts without `shuffle` | `collection/index.ts` | order check |
| `close` inserts each row in its own savepoint | `collection/index.ts` | order check (`xmin`) |
| `close` shuffles inside each set, then writes the sets as blocks in a shuffled order | `collection/index.ts` | order check (set runs) |
| `close` runs one INSERT per row in the same transaction | `collection/index.ts` | order check (`cmin`; `xmin` stays single) |
| `close` skips `vacuumCollectionTables` | `collection/index.ts` | AC2 (`pg_relation_size` not 0) |
| revoke updates the link instead of deleting it, so the revoked set reaches close | `collection/index.ts` | AC2 (`"S4 Q"` in `answer`), AC3, order check |
| `close` keeps `invite_link`, with the AC2 count and size assertion skipped for this run only | `collection/index.ts` + test | AC2 (16-character hash prefix in `invite_link`) |
| `CREATE TABLE app2.t (created_at timestamptz)` | migration 0006 | AC1 timestamp (non-`public` schema) |
| `CREATE SEQUENCE app2.s` | migration 0006 | AC1 sequence (non-`public` schema) |
| `question.times timestamptz[]` | migration 0006 | AC1 timestamp (array) |
| `question.span tstzrange` | migration 0006 | AC1 timestamp (range) |
| `question.peers inet[]` | migration 0006 | AC4 (array type) |
| `question."Token_Hash" text` | migration 0006 | AC1 link (case-insensitive) |
| `question."EMAIL" text` | migration 0006 | AC4 (case-insensitive) |
| `question.forwarded_for text` | migration 0006 | AC4 (new pattern) |

## Review Triage Log

### 2026-11-22 — Review pass
- verdicts: 28 findings — high 0, medium 4, low 20, false 4, maybe-false 0
- findings:
  - `[low]` `[reject]` Intent Alignment 1: the review section is empty. It is written at finalization (this entry and the section below). The reviewer saw the tree before step 4.
  - `[low]` `[patch]` Intent Alignment 2: AC2's "`invite_link` and `submission` hold no row" was asserted only in the AC1 test. The AC2 test now asserts both row counts as well.
  - `[false]` `[reject]` Intent Alignment 3: AC1 is checked by name, not by value. AC1 is an `information_schema` inspection. The value side ("holding") is AC2's row scan, and the link reference and set ID both *are* the `token_hash` that the scan searches for.
  - `[low]` `[patch]` Intent Alignment 4: the AC1 scope was `public` only. Same root as Edge Case 5; fixed there.
  - `[low]` `[reject]` Intent Alignment 5: a bare `name` column passes AC4. This is deliberate: Epic 6 names teams, and a broad `name` rule would flag that table. Person-prefixed names are banned.
  - `[medium]` `[patch]` Intent Alignment 6: the order check catches only some orders. Same root as Blind Hunter 1; fixed there.
  - `[low]` `[reject]` Intent Alignment 7: the fail-proof is prose only. The intent asks to break once, see red and restore. A permanent mutation harness is an addition nobody asked for.
  - `[low]` `[reject]` Intent Alignment 8: `game` and `question` are inserted directly. The intent's "real" covers the close, the schema and the rows. Every write that close and FR-13 depend on goes through the real actions.
  - `[false]` `[reject]` Verification Gap (other): the spec says `done` before review. The orchestrator had already reset it to `in-review` before step 4 (the subagent set it early). It is set to `done` only at finalization.
  - `[low]` `[patch]` Edge Case 1: a timestamp stored as an array or range slipped past the check. The timestamp check now reads `udt_name` with an optional `_`, including the range and multirange types.
  - `[low]` `[patch]` Edge Case 2: `inet[]` passed AC4. Same root as Edge Case 1: the leading `_` is stripped before the type match.
  - `[low]` `[patch]` Edge Case 3: an IP in a `text` column named `remote_addr`, `client_addr` or `forwarded_for` passed. The identity pattern now adds `addr|forwarded|(^|_)ua$|cookie|user_id`.
  - `[low]` `[patch]` Edge Case 4: the regexes were case-sensitive, so a quoted `"TokenHash"` would pass. The `i` flag was added to both.
  - `[low]` `[patch]` Edge Case 5: tables or sequences outside `public` were never inspected. Both queries now read every app schema (system schemas and `drizzle` excluded).
  - `[medium]` `[patch]` Edge Case 6: nothing proved close's VACUUM ran, so dead tuples holding the hashes would stay unseen. The AC2 test now asserts `pg_relation_size` 0 for both tables. It went red with the `vacuumCollectionTables` call removed.
  - `[low]` `[patch]` Edge Case 7: only exact copies of a secret were caught. The scan now searches for the 16-character prefix of each secret, which also catches a truncated "short id". Uppercase and base64 re-encodings were rejected: no code re-encodes them, and each would add a branch per secret.
  - `[medium]` `[patch]` Blind Hunter 1: shuffling inside each set and then writing the sets as whole blocks passed. That keeps a set's Answers joinable by position. The check now counts set runs and requires more than 3. It went red with that exact break.
  - `[low]` `[patch]` Blind Hunter 2: `xmin` proves one transaction, not one statement. The order check now also requires a single `cmin`. It went red with one INSERT per row in the same transaction, while `xmin` stayed single.
  - `[medium]` `[patch]` Blind Hunter 3: nothing checked that the VACUUM ran. Same root as Edge Case 6; fixed there.
  - `[low]` `[reject]` Blind Hunter 4: the fixture never edits a set before close. A resubmit updates the one row in place, and close reads only live rows. A stale version could survive only as a dead tuple, which the VACUUM size check now covers. Adding an edit round to the fixture guards a state nobody showed can happen.
  - `[low]` `[patch]` Blind Hunter 5: the revoked set's text was only checked inside `answer`. The AC2 scan now also fails on `"S4 Q"` anywhere.
  - `[low]` `[patch]` Blind Hunter 6: the identity pattern missed address-style names. Same root as Edge Case 3; fixed there.
  - `[low]` `[patch]` Blind Hunter 7: array columns slipped past the type checks. Same root as Edge Case 1; fixed there.
  - `[low]` `[patch]` Blind Hunter 8: only exact secrets were searched. Same root as Edge Case 7; fixed there.
  - `[low]` `[reject]` Blind Hunter 9: materialized views are not scanned. No matview exists or is planned in the spine. Switching the scan to `pg_class` guards a hypothetical object.
  - `[low]` `[reject]` Blind Hunter 10: the `group_id` and `invite_links_issued` departures are not listed in `deferred`. The fix is to edit this spec, so it is rejected by rule. Both choices are recorded in Design Notes and the Spec Change Log. The allow-list itself turns red in Story 4.2, and that failure is the reminder.
  - `[false]` `[reject]` Blind Hunter 11: the spec is marked `done` with no review. Same refutation as the Verification Gap row.
  - `[false]` `[reject]` Blind Hunter 12: the TRACE row overstates the order check. The row was reworded in the same patch to name set runs, `cmin`, the VACUUM size and the prefix search, so it now matches the test.

### AI suggestions corrected or rejected (grading evidence)

- **The orchestrator corrected the task as given:**
  - AC1 says "exactly seven" columns. The test pins today's six exactly, as an allow-list with a comment pointing at Story 4.2, and is never loosened to "at most N".
  - The orchestrator added the `xmin` check, which goes beyond the ACs: a per-row arrival sequence can also hide in the system columns.
- **The orchestrator corrected the implementer:**
  - The implementer marked the spec and sprint status `done` before any review. The spec was reset to `in-review` until finalization.
  - The implementer's first order check accepted whole sets written as blocks.
  - Its link-column scope covered only `public`.
  - Both were fixed in review, with the breaks above.
- **The implementer departed from the spec, and the orchestrator accepted it:**
  - `game.invite_links_issued` is exempt from the link-name rule. It is a counter and references no link.
  - The drizzle migration log is excluded from the name rules.
- **Reviewer suggestions rejected:**
  - an empty review section (written at finalization);
  - value-checking AC1 (that is AC2);
  - banning a bare `name`;
  - a permanent mutation harness;
  - creating the Game through actions;
  - uppercase or base64 secret variants;
  - an edit round in the fixture;
  - scanning materialized views;
  - `deferred` entries for spec choices;
  - two premature-`done` claims.

  The reasons are in the rows above.
- **Deferred:** the 3.1 shuffle test in `collection.test.ts` has the same weak set check (`some` decrease). It is pre-existing and outside this diff. The new anonymity test now covers the property.

## Design Notes

- **The `group_id` gap.** Story 3.1 deferred `group_id` to Story 4.2, together with `answer_group`, because a FK column without its table would be a dangling half. Pinning the six columns exactly keeps AC1's intent ("exactly", not "at most"). When 4.2 adds the column, this test fails until someone adds `group_id` to the list. That is the deliberate update the allow-list comment asks for.
- **Why `xmin`.** Postgres stamps each row with the inserting transaction ID. A close that inserted per set, or per Question, in separate transactions would leave an arrival sequence in the system columns, even with shuffled ids. One statement gives one `xmin`.

## Verification

**Commands:**
- `npm run lint && npm run typecheck` -- expected: clean
- `npm run test` -- expected: all pass, offline
- `npm run test:e2e` -- expected: all pass (no change expected, but the suite must stay green)

## Auto Run Result

Status: done

**Summary.** `tests/integration/anonymity.test.ts` (Story 3.2, AD-22) closes one Game through the real actions:
- 5 links: 3 sets of 3 Questions × 5 Answers, 1 unused link, 1 link that submitted and was revoked (its replacement stays unused);
- 20 captured secrets;
- the real `closeCollection`, VACUUM included.

It then inspects the schema and every stored row. Its 8 tests check:
- **AC1, shape:** the exact six-column `answer` shape (type, nullability, default), as an allow-list that Story 4.2 must extend with `group_id` on purpose;
- **AC1, timestamps:** none outside `host`, `session` and `game`, arrays and ranges included;
- **AC1, sequences:** no identity column, no `nextval` default, and no sequence in any app schema;
- **AC1, links:** no token, hash, secret, link or submission column, and no FK into the two link tables;
- **AC2:** both tables at 0 rows and 0 bytes after the VACUUM, and no secret prefix or revoked text in any row of any table;
- **AC3:** no key under two Questions, and v4 ids and keys;
- **AC4:** no Participant identity name or network type outside `host` and `session`;
- **Physical order:** shuffled across keys and across sets (set runs > 3), with one `xmin` and one `cmin`.

No production code changed.

**Files changed.**
- `tests/integration/anonymity.test.ts` (new): the suite.
- `tests/TRACE.md`: rows under FR-11 and FR-13, and 3.2 removed from Pending.
- `.docs/implementation-artifacts/sprint-status.yaml`: 3-2 set to `done`.
- This spec.

**Review.** 28 findings: 0 high, 4 medium, 20 low, 4 false.
- **Patched:** 17 rows in 10 entries (2 medium: set blocks, VACUUM; 8 low).
- **Deferred:** 1 item (the weak set check in 3.1's own test).
- **Rejected:** 11 rows (7 low, 4 false), each with its reason above.

**Fail proof.** 25 temporary breaks, in migration 0006, in `close` and in the revoke, each seen red and restored. They are listed in the fail-proof log.

**Follow-up review recommended: true.** Two medium entries were patched. The unverified risk is real Postgres: the VACUUM-size and `xmin`/`cmin` checks run only on PGlite with one Game per file. On Neon, `VACUUM (FULL, SKIP_LOCKED)` can skip a locked table, which would leave dead tuples. Other Games' rows also make `pg_relation_size` non-zero, so that check has no real-Postgres equivalent yet.

**Verification.**
- `npm run lint`, `npm run typecheck` and `npm run format:check` are clean.
- `npm run test`: 423 passed in 33 files. The anonymity file passed 3 of 3 reruns.
- `npm run test:e2e`: 84 passed.
- No server was left running.

**Residual risks.**
- The `answer` allow-list turns red when Story 4.2 adds `group_id`. This is intended.
- The name rules are deny-lists: an identity column with an unusual name would pass, though AC2's value scan still catches any captured secret.
