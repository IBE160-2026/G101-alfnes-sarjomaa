# Reconcile: PRD vs Architecture Spine

Scope: `prd.md` (final, 2026-11-03) against `ARCHITECTURE-SPINE.md` (draft, 2026-11-21). The spine is not expected to restate every FR or any UI copy. This review lists only (a) contradictions, (b) architecture-relevant requirements with no home, (c) quiet constraints the AD structure dropped, and (d) numeric disagreements.

Totals: 22 findings. High 1, Medium 9, Low 12.

Numeric parameters (§11): no disagreements. Checked: password 10, session 14 days (sliding), 20 Questions, Question 200, Answer 80, 50 links, 1 to 5 Answers, label 40, 8 Board slots, 2 to 4 Teams, Judge 30 s, sizing wall time 90 s against 2 min, three setup commands, 30/90-day retention, token 256 bits against 128. The sizing arithmetic in AD-12 is correct (150 and 250 items, 167,625 and 622,500 all-pairs calls). Pricing and model availability were not verified.

---

## High

### R-01 The Host can open any Invite link and read or edit that Participant's Answer set before close
- **PRD:** FR-5 (Host copies every full link), FR-9 (Host pastes links), FR-7 (the link shows earlier Answers), FR-12 ("no page, response or export available to the Host", "Host cannot read any Answer before Collection closes"), §4.4 intro, §1.1, FR-14.
- **Spine:** AD-8 says it "Prevents: the Host reading Answers or per-link state before close". AD-7 and AD-8 serve an Answer set to whoever presents the token.
- **Gap:** The Host necessarily holds every plaintext token. Opening Jonas's link in a private window shows Jonas's Answers, which is full attribution. The PRD tests only Host pages while logged in. §1.1 lists the pre-close database risk but not this one. The spine inherits the hole and states a guarantee it does not deliver.
- **Fix:** Either state it in AD-8 as accepted residual risk, with matching README and notice wording (FR-14), or raise a PRD change. The usual mitigation is a device-held edit secret (localStorage secret, its hash stored in `submission`), which costs cross-device editing.

---

## Medium

### R-02 "Best-effort VACUUM" does not meet "no stored table holds a Token hash or Answer set" after close
- **PRD:** FR-13, SM-3 ("database dump taken after close"), §1.1.
- **Spine:** AD-9 deletes `submission` and `invite_link` rows, then runs a best-effort `VACUUM`.
- **Gap:** Deleted rows stay as dead tuples and in WAL (PGlite data directory, hosted Postgres) until reused. Those rows pair `token_hash` with the whole Answer set across all Questions. The Host holds the plaintext tokens, so the hashes can be recomputed. A raw data-directory copy then breaks both cross-Question joining and link attribution. A logical `pg_dump` would not show this. Rate it High if the SM-3 audit uses a directory copy.
- **Fix:** In AD-9 say whether close uses `VACUUM FULL` or a rewrite, and state the WAL and backup residue as an explicit limit. The README and §1.1-style notice should name it.

### R-03 No rule keeps `contributor_key` and arrival-correlated ordering out of Review responses
- **PRD:** FR-12 ("After close, Review shows Answers grouped by Group only, never by Answer set or Contributor key").
- **Spine:** The `contributor_key` column sits on `answer` (AD-10). AD-8's read rule covers `collection` only. The map's FR-12 row omits the `review` module.
- **Gap:** Nothing stops a Review query or DTO from returning `contributor_key`, which would show that two Answers in one Question come from the same person. Answer list ordering inside a Group is also unspecified.
- **Fix:** Add to AD-10 or AD-11: Review and Host DTOs never select `contributor_key`, and Counts come from SQL only. Answer lists are ordered by `normalized_text`, never by physical order. Add `review` to the FR-12 map row.

### R-04 The FR-12 test is placed at the wrong layer
- **PRD:** FR-12 ("An automated test, logged in as the Host during Collection, finds no Answer text and no per-Invite-link state in any Host page or response"), §9.1.
- **Spine:** AD-21 puts `host-view.test.ts` under `tests/integration/`, which "tests module functions".
- **Gap:** Module-level calls cannot catch a leak in a rendered page, a Server Action response or the counters export.
- **Fix:** Add an e2e spec (e.g. `tests/e2e/host-anonymity.spec.ts`) that logs in as the Host during Collection and scans every Host page and Server Action response. Keep the integration test as well.

### R-05 Housewarming evaluation can write real Answers into a tracked folder
- **PRD:** §6.1 (real Answers never enter the repository, including fixtures; evaluation "runs locally"), SM-4.
- **Spine:** AD-19 says housewarming Answers "stay in `.idea/` and are scored only locally". AD-14 says `judge:record` writes rulings, containing `question` and `items` in clear text, to `data/rulings/*.json`.
- **Gap:** Nothing says where rulings for the housewarming run are written. The default is the committed folder, in a public repo. AD-19 also defines no way to point the eval at a second dataset (SM-4). A live run sends real names to a third party, which "runs locally" does not cover.
- **Fix:** In AD-19 add `--data <path>` and `--out <path>` options. The local output path is gitignored (e.g. `.idea/rulings/`), and `judge:record` refuses to write real-data rulings under `data/`. Note that the live path leaves the machine.

### R-06 Answer text goes to a model provider, and the spine does not carry that into the notice or README
- **PRD:** FR-14 ("makes no stronger claim than §1.1 supports"), §1.1 (anonymity edges), §6.1.
- **Spine:** AD-12 and AD-13 send each Question's distinct normalised Answer texts to the Anthropic API when a key is set.
- **Gap:** §1.1 names the Host and the database as the only readers. Answers about non-consenting named people also reach a third party, which the PRD never anticipated and the spine does not flag.
- **Fix:** Add a line to AD-13 that only `question` and `items` are sent (no keys, no links). Add a deferred note that the README and FR-14 notice must say live Grouping sends Answer text to the provider. This is a PRD §1.1 follow-up.

### R-07 No mechanism makes SM-1 ("every testable consequence covered") checkable
- **PRD:** SM-1, §9.1.
- **Spine:** AD-21 gives the test layout, a manual checklist and CI, but no way to map consequences to tests.
- **Gap:** SM-1 is the primary success metric and is 15% of the grade (testing). There is no coverage matrix or naming convention to show that each FR consequence is covered or explicitly manual.
- **Fix:** Add a convention: every test names its FR/NFR ids in the `describe` title, and a committed `tests/TRACE.md` (FR to test file or manual item) is checked in CI by a small script.

### R-08 Retention purge can miss the "at most 30 days" bound
- **PRD:** FR-3, §6.1 ("live at most 30 days after play, or 90 if never played").
- **Spine:** AD-22 runs `purgeExpired` "at most once an hour, started from Host requests", and `updated_at` is touched "by every Host mutation".
- **Gap:** If no Host request arrives, expired Games stay, so the bound is a best-effort. A Game in `collecting` that only gets Participant submissions for 90 days counts as unchanged and could be purged during live use.
- **Fix:** In AD-22 also trigger the purge from Participant requests and `/api/health`, and touch `updated_at` on submissions at Game level only. Or record it as a `shortcut:` with the upgrade path (a real scheduler on the pilot host).

### R-09 AD-13 provider default contradicts NFR-3 "Judge calls use Stored rulings or mocks by default"
- **PRD:** NFR-3, FR-15 ("In tests ... no network call").
- **Spine:** AD-13 sets an unset `JUDGE_PROVIDER` to `anthropic` when `ANTHROPIC_API_KEY` is set. AD-21 forces `replay` only for e2e.
- **Gap:** A developer with a key in the shell runs `npm test` on the live provider path. The network guard then rejects the call, and AD-12 turns that into a silent fallback, so tests pass while exercising the wrong path.
- **Fix:** In AD-21, Vitest setup sets `JUDGE_PROVIDER=mock` and clears `ANTHROPIC_API_KEY`. Playwright already pins `replay`. State in AD-13 what `mock` does (it is not defined).

### R-10 FR-18 counters and SM-5 have no schema or ownership
- **PRD:** FR-18, SM-5 ("at least 70% of proposed Groups confirmed unchanged, median changed Group needs one edit, read from the usage counters").
- **Spine:** `game_counters` is owned by `games` (AD-1) and has no columns anywhere. AD-12 only says it is "updated" at finish. Review edits are written by `review`, which does not own the table.
- **Gap:** SM-5 needs per-Group data (proposed or user-made, edit count). Aggregate counters of merge/split/rename/discard operations cannot give "median edits per changed Group" or "unchanged share". No function lets `review` bump the counters.
- **Fix:** In AD-11 or AD-12 define `game_counters` columns, plus `answer_group.origin` and `edit_count` (content-free), and the exported `games.bumpCounters` function that `grouping` and `review` call. Define the `rapport` JSON shape.

---

## Low

### R-11 FR-3 "the Host is told so when play ends" has no home
- **PRD:** FR-3, §6.1.
- **Spine:** AD-16 and AD-22 set `played_at` and the purge, but no AD or map row says the final play screen states the deletion date.
- **Fix:** Add one line to AD-16 (finish returns `deleteAfter = played_at + 30 d`) and a map note for UX.

### R-12 Unknown token, uniform revoke response and the 50-link cap at revoke
- **PRD:** FR-9, UJ-2 edge ("opens after revoke: treated as unknown"), FR-5 (50 including revoked).
- **Spine:** AD-7 defines `unknown` only as "no such Game". AD-8 revokes and then issues a replacement while `invite_links_issued` counts revoked links.
- **Gap:** The outcome for a valid Game with an unmatched token is not stated. The revoke response must not show whether the link had a submission (FR-9 says the Host is told "whether or not an Answer set existed"). At 50 issued the replacement cannot be created, and the behaviour is undefined.
- **Fix:** In AD-7/AD-8: a token hash with no `invite_link` row on a `collecting` Game gives `unknown`. The revoke response is identical either way. At the cap, revoke is refused with a clear code.

### R-13 Small testable consequences without a home
- **PRD:** FR-5 ("zero Questions refused"), FR-4 (add Question in draft), FR-20 (merged label rule), FR-17 ("Host is told which Questions fell back").
- **Spine:** The AD-4 table lists "edit, reorder or delete" Questions (no add). The zero-Question guard, the merged-label rule (highest Count, ties by position) and showing `fell_back` in Review appear nowhere.
- **Fix:** Add them to the AD-4 table and to the `src/lib/ranking.ts` list in AD-11. One line each.

### R-14 `limits.ts` is missing values, and the Token unit test has no lib file
- **PRD:** FR-10 and FR-8 (minimum 3 Answer sets, "fewer than 3"), FR-3 (30/90 days), NFR-3 (unit tests cover Token generation).
- **Spine:** The `limits.ts` list omits the 3-set minimum, retention days and the Judge concurrency of 5. AD-21 lists Token generation as a `src/lib` unit test, but the `src/lib` layout has no token file.
- **Fix:** Add `MIN_ANSWER_SETS`, `RETENTION_PLAYED_DAYS`, `RETENTION_UNPLAYED_DAYS` and `JUDGE_CONCURRENCY` to `limits.ts`. Add `src/lib/token.ts` to the layout.

### R-15 Judge model decision omits SM-4 reasoning and the SM-2 bar
- **PRD:** §10 item 1 (decide against cost, Norwegian slang, boundary), SM-2 (F1 at least 0.70), SM-4.
- **Spine:** AD-13 picks `claude-haiku-5-5` with `effort: low`. Only cost is justified. The 0.70 target appears nowhere; "SM-2 baseline" is deferred.
- **Fix:** Add to AD-13 or Deferred: the 0.70 target, the trigger to change (`JUDGE_MODEL` or effort) if `judge:eval` falls below it, and Norwegian slang as the SM-4 check.

### R-16 Non-imitation of the TV show (§6.3) is not passed to UX
- **PRD:** §6.3 ("name, interface and branding must not imitate the television show").
- **Spine:** Visual system is deferred to UX without this constraint.
- **Fix:** Add one clause to Deferred: no show logos, name, music or sound effects.

### R-17 No constraint against external assets at build or run time
- **PRD:** NFR-1, NFR-3, UJ-5 ("both pass without network access").
- **Spine:** AD-21 has a network guard but no rule for remote fonts, CDNs or telemetry. UX owns the visual system.
- **Gap:** `next/font/google` or a CDN stylesheet would break an offline build or the e2e run.
- **Fix:** Add to Conventions: fonts and assets are self-hosted, and `NEXT_TELEMETRY_DISABLED=1` is set in scripts and CI.

### R-18 Platform request logs on the pilot host sit outside AD-7's "no logging"
- **PRD:** FR-11 ("Logs written while handling an Invite link contain neither Token nor Answer text"), §1.1.
- **Spine:** AD-7 and the Logging convention cover app logs only. AD-23 targets Vercel.
- **Gap:** Platform access logs record IP, user agent and time of POSTs to `/svar/{gameId}`. These are not "stored tables", but they support timing correlation for whoever reads them.
- **Fix:** Add one sentence to AD-23 and the README caveat list; no code change.

### R-19 PRD §6.5 dates and sequencing are not reflected
- **PRD:** §6.5 (architecture in weeks 44 to 45; Stage 1 freeze at end of week 47; Stage 2 only after SM-1).
- **Spine:** Dated 2026-11-21, which is end of week 47, with no delivery or story-order note.
- **Fix:** Confirm against the wiki plan for fase 3 and 4. If the schedule was re-planned, note it (and the first-story spike for PGlite under Next, which AD-2 mentions only in passing). If not, the PRD dates are stale.

### R-20 CI does not prove the README path, and the SM-3 audit has no procedure
- **PRD:** §9.1 ("Fresh-clone run following the README, in CI where possible"), SM-3, UJ-5.
- **Spine:** AD-21 CI runs install, lint, tests and e2e. It never starts `npm run demo` from a clean checkout.
- **Fix:** Add a CI step that runs `npm run demo` and polls `/api/health`. Add `tests/manual/anonymity-audit.md` with the dump-and-grep steps SM-3 needs.

### R-21 NFR-5 (one second per Host action) has no deployed-latency note
- **PRD:** NFR-5.
- **Spine:** AD-16 binds NFR-5, but AD-23 does not say to co-locate the function and the free-tier Postgres region.
- **Fix:** Add "same region" to AD-23 and one manual timing check on the checklist.

### R-22 Stage 2 doors: FR-22 manual order storage is not in Deferred
- **PRD:** FR-22 ("A manual order survives until the Board is confirmed").
- **Spine:** The Deferred list names Question-set import, typed Guesses and strike state, but not where a manual Group order lives before `board_slot` exists (a position column on `answer_group`).
- **Fix:** Add it to the Stage 2 Deferred line.

---

## Incidental (not PRD findings, not counted)

- AD-9 has `collection.close` insert into `answer`, but AD-1 gives `answer` to `grouping`. Same shape: `question.reviewed` is written by `review` but owned by `questions`, and `game_counters` by `games`. Resolve by naming the exported functions the owners expose (e.g. `grouping.insertAnswers(tx, rows)`).
- AD-4's Participant submit must lock the Game row too (the state table says so for "every state-dependent mutation"), which serialises all submissions on one row. This is fine at pilot scale, but note it. PGlite is single-connection, so races are only exercised on hosted Postgres.
