# Rubric review: ARCHITECTURE-SPINE.md (Toppsvar, initiative altitude, build-substrate)

Reviewer role: rubric walker in the Reviewer Gate. Spine read in full. PRD (`prd-Toppsvar-2026-10-12/prd.md`) read in full for coverage. UX documents (`ux-designs/ux-Toppsvar-2026-11-21/EXPERIENCE.md`, `DESIGN.md`) skimmed by grep, because they exist in the repo and the spine does not cite them (see M-7). Tech versions are only flagged where a claim looks suspicious (L-7); another reviewer verifies them.

## Verdict

The spine fixes most of the real divergence points and covers every Stage 1 FR/NFR, but it contradicts its own single-owner rule between `review` and `grouping`, leaves the Host-can-open-any-link anonymity hole as a deferral, leaks submission timing through `game.updated_at`, and has no real environment/migration model. Fix the four High items before epics are cut.

## Counts

| Tier | Count |
| --- | --- |
| Critical | 0 |
| High | 4 |
| Medium | 12 |
| Low | 8 |

## Rubric walk (summary)

| Checklist item | Result |
| --- | --- |
| Fixes the real divergence points, misses none | Mostly. Misses: table ownership is internally contradicted (H-2), error-code registry and read-path/UI data flow (M-9), normalisation contract (M-11), environment model (H-4). |
| Every AD Rule enforceable and prevents its stated divergence | Partly. AD-1 layering, AD-5 child ids, AD-4 lock+state check, AD-12 lease, AD-17 error shapes, AD-21 README/env parity have no mechanism (M-1, M-2, M-3, M-9, M-10). AD-9, AD-10, AD-15, AD-16 are well enforced by tests or structure. |
| Nothing under Deferred lets two units diverge | One item can: Host reading an Answer set through a held link (H-1). Others are safe. Two Deferred items are already answered by the existing UX documents (M-7). |
| Named tech verified-current | Not my job; suspicious items listed in L-7. |
| Covers the driving spec | Yes. FR-1..FR-21, FR-23..FR-27, FR-30..FR-32 and NFR-1..NFR-8 all map to ADs; Stage 2 doors (FR-22, FR-28, FR-29, FR-33) are kept open credibly (`board_slot.group_id` nullable, `create -> ready`, `judge.match`). PRD §6.2 cost statement for both Games is present and the arithmetic checks out (167,625 and 622,500 all-pairs; 3 and 4 waves). |
| Altitude-owned dimensions decided, deferred or open | Deployment/environments: partial (H-4). Infra/provider: partial (H-4). Operations: logging decided, observability deferred, backups/rollback/spend control/abuse missing (M-5, M-6, H-4). Security: authN/authZ/secrets good; rate limiting deferred with a cost-abuse angle (M-5). |
| Internal consistency | Several small cross-reference and naming slips (L-1) and two spine-vs-UX conflicts (M-7). |
| Bloat | Yes, about a fifth of the document is process or seed detail (M-12). |

---

## High

### H-1. Deferred: the Host can read every pre-close Answer set by opening a link they hold

- **Location:** AD-8 "Known gap"; Deferred item 1; PRD FR-7 vs FR-12, FR-8.
- **Problem:** The Host creates every Invite link, sees each once in a copyable list, and pastes each into a message. Opening any of them shows that link's Answer set and attributes it to the person they sent it to. This defeats FR-12 ("the Host cannot read any Answer before Collection closes"), makes the "fewer than 3" mask in FR-8 and all of AD-8's "absent from every Host page" work cosmetic against a curious Host, and is undetectable. `host-anonymity.spec.ts` passes anyway because it never opens a link. The spine calls this "an open PRD question", but PRD §10 lists five deferred items and this is not one of them, so the claim is not traceable. Leaving it open can make units diverge: a device-held edit secret changes the `submission` key (AD-8), the link/URL contract (AD-7), the FR-7 "same link on another device" behaviour and the `/svar` reads, not only `collection.loadOwnAnswerSet`.
- **Fix:** Decide now, before epics. Option A (accept): amend PRD FR-12 and §1.1 to say pre-close anonymity holds against the app but not against a Host who opens their own links, and add the line to the README contract and the Participant notice (FR-14). Option B (fix): add an edit secret generated in the browser, stored hashed in `submission` (`edit_secret_hash`), required for reopen, with the cost that reopening works only on the same device or with a second copied secret. Either way record it as an AD (not Deferred), and add the PRD §10 entry so the cross-reference is true.

### H-2. AD-1 "single owner per table" is contradicted by its own module table

- **Location:** AD-1 table, rows `review`, `grouping`, `games`, `collection`; AD-8, AD-12, AD-16.
- **Problem:** (a) `grouping` owns `answer` and `answer_group`, yet the `review` row says it performs "updates to `answer.group_id` and `answer_group` after Grouping" (merge, move, rename, discard, `edit_count`, `origin = host`). `grouping`'s exported writers are only `insertAnswers` and `run`, so `review` must write another module's tables directly, which the rule forbids. These two modules are the likeliest pair of epics to be built in parallel. (b) The same gap exists for `game` columns that other modules must write but `games` exports no writer for: `invite_links_issued` (written by `collection` on create and revoke, AD-8), `grouping_lease_until` (written by `grouping`, AD-12), `played_at` (set by `play.finish`, AD-16). None of these columns appear in a schema listing either.
- **Fix:** Pick one owner per table by function, not by phase. Simplest: `review` owns the Group-editing functions and `grouping` exports one writer used by both (`grouping.writeGroups(tx, ...)`), or move `answer_group` and `answer.group_id` ownership entirely to `grouping` and have it export `merge`, `move`, `rename`, `discard`, `undoDiscard` that `review` calls. Add the missing writers to the table (`games.claimLease`, `games.bumpLinksIssued`, and let `games.transition(..., 'played')` set `played_at`). List the `game` columns once (`host_id`, `title`, `state`, `invite_links_issued`, `grouping_lease_until`, `created_at`, `updated_at`, `played_at`).

### H-3. `game.updated_at` is touched on every Participant submit, which is a timing side channel into FR-8

- **Location:** AD-8 Storage ("touches `game.updated_at`"), AD-23, Conventions "Time and IDs".
- **Problem:** FR-8 and the UX `ProgressCount` component go to lengths so the Host cannot time a change against a message ("fewer than 3", silent updates). Touching a Game-level timestamp on each submit recreates exactly that signal for any Host-visible use of `updated_at` ("sist endret" in the Game list, the `rapport` export, any DTO that selects `*`). No rule keeps it out of Host DTOs, and `host-anonymity.spec.ts` only scans for Answer text and per-link state, so it would not catch it. Also, `touch` semantics are undefined elsewhere: which Host mutations touch, so the 90-day "last change" purge (FR-3) is ambiguous.
- **Fix:** Do not touch on Participant writes. Use a separate `last_activity_at` that is never selected by Host-facing queries, or touch only on Host mutations, link creation and close, and define "last change" as exactly that set. Add to AD-10 or AD-8: Host DTOs are explicit field lists and never include `updated_at` while the Game is `collecting`. Extend `host-anonymity.spec.ts` to assert no timestamp changes between two polls straddling a submit.

### H-4. No environment model: migrate-on-deploy, preview deployments, dev auto-migrate, provider and region are open

- **Location:** AD-3 ("automatically by `demo`, `dev` and the test setups"), AD-24 ("Deployment runs `npm run db:migrate` before it serves traffic"), AD-21, Stack ("free-tier Postgres"), Structural Seed (Pilot subgraph).
- **Problem:** The spine names local, demo, test and one "pilot", but never says what environments exist or what `DATABASE_URL` each uses. Concretely: (1) On Vercel, a migrate step in the build runs for every preview deployment against whichever `DATABASE_URL` the project shares, so a PR branch can migrate the pilot database; the spine says `next build` never touches the DB, so it is also unclear where migrate runs. (2) `dev` auto-migrates whatever `DATABASE_URL` is in `.env.local`, which includes a hosted URL, contradicting AD-3's "no `push` against shared data". (3) The Postgres provider and region are unnamed, yet the DB holds Answers about named people before close and Host emails; region and provider decide the "DB operator can see" README statement. (4) Backups, restore and rollback are not mentioned, but AD-9 and the README promise depend on what backups hold. (5) The deployed driver must work behind a pooler (free-tier hosts usually front Postgres with one): postgres.js needs `prepare: false` and a small `max`, and this is invisible until deploy. (6) No rule that migrations are forward-only and compatible with the previous deployed build.
- **Fix:** Add an environments table (local dev, demo, test/CI, preview, pilot): URL source, who migrates, and whether the live Judge is allowed. Rules: only `main` deploys, previews are disabled or get `pglite://memory`; `db:migrate` runs as an explicit deploy step against the pilot database only; `dev` and `demo` auto-migrate only for `pglite://` URLs and refuse `postgres://` unless `--allow-remote`. Name the Postgres provider and region (EU) or put them under Deferred with an owner and trigger; set `postgres()` options for pooler use in `client.ts`; add one line on backups and rollback (accept: none, restore by redeploy from a dump, stated in README).

---

## Medium

### M-1. AD-4 has no single enforceable entry point and no machine-readable state table

- **Location:** AD-4 Rule and "Allowed mutations" table.
- **Problem:** "Every state-dependent mutation runs in one transaction that first locks the Game row and checks the state" depends on each feature author remembering both steps. The table of allowed mutations per state lives only in prose, so each module will encode its own `if (state !== ...)` and error code. The exported writers (`transition`, `getOwned`, `bumpCounters`, `touch`) include no lock-and-check helper. Deletion "in any state" is also not locked, so deleting a Game while Grouping runs lets the run write into a vanished Game.
- **Fix:** Export `games.lock(tx, gameId, allowedStates)` as the only way to obtain the Game row in a mutation (it does `FOR UPDATE`, throws `WRONG_STATE`), have `getOwned` build on it, and put the state-to-operation table in `src/lib/game-state.ts` used by modules and by an integration test that walks the whole matrix. Specify that deletion locks the row and that an in-flight `grouping.run` aborts quietly when the Game is gone.

### M-2. AD-12 resume lease is under-specified

- **Location:** AD-12 "Start and resume", `game.grouping_lease_until`.
- **Problem:** No lease duration, no atomic claim, no renewal, no owner of the write (see H-2). The Host page polls every 2 s and a page load may restart a run. If the lease is shorter than the 90 to 120 s worst-case bound, a live run is restarted and two runs call the Judge for the same Question (double cost, wrong `judge_calls`); the unique `grouping_result` only makes the second writer fail. Restart-from-GET also puts a side effect in a page render.
- **Fix:** Add to the rule: claim is a compare-and-set in a short transaction (`UPDATE game SET grouping_lease_until = now()+interval WHERE id = $1 AND (lease IS NULL OR lease < now())`, run only if one row changed); lease length = bound + margin (for example 150 s) and extended per completed Question; add the value to `limits.ts`. Say whether restart happens from the page render or from a Server Action triggered by the poll.

### M-3. AD-5 stops at the Game; child-id operations can cross tenants

- **Location:** AD-5 Rule; AD-8 Revoke ("Revoke parses a pasted link the same way"); AD-15 `questions.setReviewed(tx, id, false)`.
- **Problem:** The rule only requires loading the Game via `getOwned`. Many Host functions take a child id (Question, Group, Answer, link, reveal). `invite_link.token_hash` is unique across Games, so revoke-by-pasted-link that looks up by hash alone lets a Host who learns another Game's link (any Participant can be a Host) revoke it and delete that Participant's Answer set. `authz.test.ts` is listed but does not say it enumerates every exported Host function.
- **Fix:** Add: every child lookup carries `AND game_id = <owned game id>`; no module function accepts only a child id; revoke checks that the link's `gameId` equals the Game being edited and uses `(game_id, token_hash)`. Make it structural: `getOwned` returns a `GameCtx` that module functions require as a parameter. Let `authz.test.ts` iterate over a registry of Host-facing exports (fails when a new one is not registered).

### M-4. The Postgres CI job is first in the cut order, but it is the only real test of AD-4 locking and AD-2 parity

- **Location:** Deferred "Cut order"; AD-22 "CI Postgres job"; AD-22 `collection.test.ts` ("submit racing close").
- **Problem:** Integration tests run on `pglite://memory`, which is a single connection that, to my knowledge, serialises transactions, so the submit-versus-close race cannot occur there and the `FOR UPDATE` behaviour is never exercised. The only job that can is the Postgres service-container job, which is cut first, while the same sentence says "never cut AD-4". Cutting it also leaves NFR-2 ("same build, different configuration") unverified for postgres.js, `jsonb`, `VACUUM FULL` and `gen_random_uuid()` on the deployed driver.
- **Fix:** Either keep one Postgres-backed job (just `collection.test.ts` and `play`/`games` concurrency tests, two connections) outside the cut list, or state that AD-4 locking is unproven without it and remove it from "never cut". Verify the PGlite serialisation claim in the first story and note the result in AD-2.

### M-5. Operations and abuse: open registration, a live key, memory-hard hashing and no spend or rate bound

- **Location:** AD-6, AD-24, Deferred "Login rate limiting".
- **Problem:** On a public pilot with `ANTHROPIC_API_KEY` set, anyone can register a Host (no verification or gate), create Games, submit their own Answer sets and close Collection, each close making up to 20 paid Judge calls. Each login or registration also spends about 128 MiB and a few hundred ms of scrypt. There is no spend ceiling, no registration gate, no request throttle. "Add them if the pilot shows a need" is a reactive control for a cost exposure on a key the group pays for.
- **Fix:** Decide one cheap control and name it: for example `REGISTRATION_CODE` (optional env; if set, registration requires it) and "the pilot key has a console spend limit, stated in README". Add a per-process in-memory throttle on login/registration if wanted. Keep full rate limiting deferred, but record the trigger (key set on a public host).

### M-6. Retention is best-effort and runs only when traffic arrives; `touch` is undefined

- **Location:** AD-23; PRD FR-3, §6.1.
- **Problem:** The 30/90-day deletion is the PRD's main consent mitigation ("the product keeps nothing it does not need"), but purge only runs on Host, Participant or `/api/health` requests, throttled "at most once an hour" with no stated mechanism (in-memory per instance on serverless means it is not at-most-once, and with no traffic it never runs). On a quiet deployment, or a laptop that is off, expired Answers persist. The README contract never says so. See also H-3 on `touch`.
- **Fix:** Say plainly "retention is enforced when the app is running and receives requests". Add the daily Vercel Cron option for the pilot (or run purge once at process start and on each `/api/health`) and put the limitation in the README anonymity section. Store the last-run marker in the DB if "once an hour" matters; otherwise drop the claim. Keep destructive work out of `/api/health` (L-4).

### M-7. The UX documents exist but the spine ignores them; several decisions conflict with them

- **Location:** frontmatter `sources`/`companions: []`; Deferred items 2, 3 and 4; Structural Seed routes; AD-17 polling; AD-15.
- **Problem:** `ux-designs/ux-Toppsvar-2026-11-21/` (DESIGN.md, EXPERIENCE.md) is committed, yet the spine defers "Component library", "Review presentation" and "Unsent drafts" to it as if still pending, and never lists it. Conflicts found: (a) draft key: spine says `localStorage` keyed by `gameId`, UX says keyed per link by a hash of the Token (two Participants on one device would collide under the spine's rule); (b) polling: AD-17 says 2 s, UX says 3 s; (c) routes: UX fixes `/`, `/registrer`, `/logg-inn`, `/spill`, `/spill/[id]`, `/spill/[id]/gjennomgang`, `/spill/[id]/skjerm`, while the spine seed shows `logg-inn/` doing "login and registration" and leaves Review and play paths open (URL segments are a cross-unit contract); (d) UX asks whether a Question with every Group discarded can be marked reviewed; AD-15 `confirmBoard` produces zero `board_slot` rows for it and play has no rule; (e) UX assumes Team names 1 to 20 characters and a per-Question "n av m" Grouping progress; `limits.ts` has no Team-name limit and AD-12 does not say progress is exposed (it can be: count of `grouping_result` rows).
- **Fix:** Add both UX files to `sources`/`companions`. Replace the three Deferred items with "decided in UX" plus the architecture constraint. Adopt the UX route table by reference in the Conventions (or list the segments). Align polling to one interval in `limits.ts`. Decide (d) in AD-15: `setReviewed(true)` is refused with `NO_GROUPS_ON_BOARD` when no non-discarded Group exists. Add Team-name length to Limits and an `grouping.progress(gameId)` read.

### M-8. AD-11: Count in SQL versus "pure functions", and the title overstates

- **Location:** AD-11 Rule; AD-22 `tests/unit/` list; PRD NFR-3.
- **Problem:** "Count is `count(distinct contributor_key)` ... in SQL", then "These rules are pure functions in `src/lib/ranking.ts`". Count cannot be both. AD-22 lists "Count recalculation" under unit tests of `src/lib`, as NFR-3 demands, so a unit author will write a second, JS implementation of Count that can drift from the SQL. The title says "never stored" and the last line then freezes `board_slot.count`.
- **Fix:** State which is which: Count is SQL only, `ranking.ts` takes `{groupId, count, rank1Count, label}` rows and ranks and labels them; Score is `sum` in one SQL function and a pure `score(reveals)` used by tests, or only SQL. Move "Count recalculation" to an integration test (`review.test.ts`: merge and move recount by distinct key). Retitle: "Count and Score are derived when read; the Board freezes them at confirm".

### M-9. AD-17 leaves error codes, the read path and UI data flow open

- **Location:** AD-17; Conventions "Validation and errors"; AD-5 (`NotFound` vs `NOT_FOUND`).
- **Problem:** Codes are `SCREAMING_SNAKE` with a trailing "..." but there is no named file, no closed union and no code-to-bokmål map ("The bokmål UI message comes from the code": from where?). The structural seed has no `errors.ts`. Server Actions may `redirect()` (login, create Game), which conflicts with "returns `{ ok ... }`". "Zod schemas sit next to each Server Action" collides with the `'use server'` rule that such a file may export only async functions, so schemas shared with client-side validation must live in a sibling file. The Participant read path (load questions and own Answer set from the fragment token) is not stated: the rule says mutations are Server Actions and Route Handlers are only `rapport` and `health`, so reads are presumably Server Actions too, but a unit could put the token in a `GET` query. Reads and revalidation after mutation (RSC read, `revalidatePath`, no client store) are unspecified for the heaviest screen, Review.
- **Fix:** Add `src/lib/errors.ts`: `DomainError`, a closed `ErrorCode` union and the bokmål message map (one place, tested for completeness). Say that actions return a result except `redirect()` flows. Put schemas in `schema.ts` beside `actions.ts`. State: "Participant reads are Server Actions too; no token ever in a GET URL or query." State: "Pages read in server components; after a mutation the action calls `revalidatePath` for the affected page; no client data library."

### M-10. Several Rules have no enforcement mechanism

- **Location:** AD-1 (layers, `server-only`), AD-7/AD-21/Conventions "Logging" (no logging of tokens), AD-21 ("README and code disagreeing about variables"), AD-22 `tests/TRACE.md`.
- **Problem:** Import direction, "src/app never imports `src/server/db`", "only `log.ts` logs" and "`.env.example` lists each variable" are all stated as rules but nothing fails when they are broken. The Style row names ESLint but no boundary or `no-console` rule. `TRACE.md` is "maintained" by hand and its completeness is not checked.
- **Fix:** Add to the Style row: ESLint `no-restricted-imports` or `import/no-restricted-paths` zones that encode the AD-1 table, `no-console` except `src/server/log.ts`. Add three tiny tests: `.env.example` keys equal `env.ts` schema keys equal the README table; every `FR-n` of Stage 1 appears in a test title (script reads `TRACE.md`); no module imports outside the allowed-direction matrix. Also add an acyclic order between modules (for example `auth, games, questions` before `collection, grouping, review, play`) since the table permits `games <-> collection` cycles.

### M-11. Judge boundary details that decide behaviour are missing, and the normalisation contract is not stated

- **Location:** AD-12 "Items", AD-13, AD-14; PRD FR-17 normalisation.
- **Problem:** (a) Normalisation is the key under which stored rulings, replay and `uncovered` items match, but the spine only says "the FR-17 rule". Unicode form, locale-sensitive lowercasing (æ, ø, å), what counts as trailing punctuation: any change in `normalize.ts` silently turns fixture items into `uncovered` clusters, and `demo-replay.test.ts` only asserts `source = replay` and "no fallback", so it still passes while quality degrades. (b) "If the output is invalid" is not defined (length equals items, integers in range, cluster numbering). (c) Retry policy covers invalid output only; HTTP 429/529 go straight to fallback `ERROR`, and the SDK's default `maxRetries` would retry on top, making `judge_calls` (SM-C2) wrong; `max_tokens` is not stated. (d) `NO_KEY` versus `NO_STORED_RULING`: with the default provider selection a keyless run takes the replay path and never produces `NO_KEY`; `source` has no mapping for `mock`.
- **Fix:** Define `normalize()` in two lines in AD-12 (NFC, `toLowerCase()` locale-independent, trim, collapse whitespace, strip trailing `. ! ? , ;`), add `normalizeVersion` next to `promptVersion` in rulings and `grouping_result`, and make `demo-replay.test.ts` assert `uncovered_items = 0`. Define valid output in `judge/index.ts` (validation lives in the provider, throws `INVALID_OUTPUT`). Set `maxRetries: 0`, a bounded `max_tokens`, and one retry on 429/5xx inside the 30 s signal. Define: `NO_KEY` is produced whenever provider resolution finds no key and no ruling; `source` is `judge` for anthropic, `replay` for replay and for stored-ruling hits, `judge` for mock.

### M-12. Bloat: process and seed detail that does not constrain divergence

- **Location:** Conventions rows "README contract", "Style", "Process"; AD-22 CI step list; "Departures from proposal.md"; Deferred "Cut order"; AD-12 sizing table.
- **Problem:** The README contract duplicates `sensorveiledning-del-1` and is a delivery checklist; the Style row repeats the ESLint ignore list; "Process" holds the PR template and `make-zip.sh`; the eight CI steps and the seven-row Departures table are history and tooling. The cut order is project planning. Agents re-read the spine on every unit, so this costs tokens and buries the real invariants. The sizing table is required by PRD §6.2, but Judge-call counts and the tokens-per-call columns are evidence, not rules.
- **Fix:** Keep one line each: "CI runs only README scripts, with no key, on the Node matrix"; "README must state the anonymity limits named in AD-8, AD-9 and AD-24"; "one PR per epic, a departure amends this spine". Move the README contract, Departures, cut order and PR template to `wiki/` and link them. Shrink the sizing table to calls and wall-time bound per Game, with the arithmetic in a footnote.

---

## Low

### L-1. Naming and cross-reference slips

- Conventions "DB naming" says singular tables and `id uuid` primary keys "except `invite_link.token_hash` and `session.token_hash`", but `submission` (PK = `token_hash`), `play_state` and `game_counters` (PK `game_id`) and `grouping_result` (unique `question_id`) are also exceptions, and `game_counters` is plural. Fix: list the exceptions or rename (`game_counter`).
- `NotFound` (AD-5) versus `DomainError('NOT_FOUND')` (Conventions); pick one.
- `[ADOPTED]` appears on AD-1, AD-2, AD-6, AD-22 and is never defined; AD-2 and AD-6 depart from `proposal.md`, so it does not mean "from the proposal". Define or remove.
- Stack table omits `@axe-core/playwright`, required by AD-22.
- ER diagram omits `board_slot.group_id -> answer_group` and `reveal.game_id`.
- `/api/health` is English while the route-segment convention says bokmål; the seed folds registration into `logg-inn/` while UX has `/registrer` (see M-7).

### L-2. AD-2 parsing and bundling details

`pglite://memory` collides with a directory named `memory`; relative paths (`pglite://.data/local`) parse as URL host `.data`, so `client.ts` needs its own parser. Import the drivers dynamically so the deployed bundle never loads PGlite's WASM. State both in the Rule.

### L-3. AD-6 details

"`Secure` except on localhost" is an environment branch in code, which AD-2 forbids elsewhere; derive it from the `APP_BASE_URL` scheme instead. Registering a Host per e2e spec at `N=2^17` costs about 128 MiB and hundreds of ms each; since the hash string carries its parameters, allow a test-only low cost via `env.ts` (never accepted in production).

### L-4. Dynamic routes, health endpoint and root layout

- AD-2 says `next build` never touches the DB "because every DB-reading route is dynamic", but names no mechanism; the `/svar/[gameId]` route reads no cookies, the usual dynamic trigger. State `export const dynamic = 'force-dynamic'` (or `await connection()`) on every DB-reading route and lint for it.
- `/api/health` also runs the destructive purge (AD-23); a liveness probe should not delete data or fail when purge throws.
- AD-7 "own root layout" for `/svar` implies multiple root layouts, which in the App Router drops the top-level `not-found.tsx`/`global-error.tsx` handling the Conventions require (verify against current Next docs). State the invariant behaviourally instead: the `/svar` subtree calls no `cookies()` or `headers()` for sessions and renders no Host chrome.

### L-5. `VACUUM FULL` in AD-9

It runs after commit with no retry, so a crash between commit and vacuum skips it; it takes an `ACCESS EXCLUSIVE` lock on `submission` and `invite_link` for all Games, blocking other Hosts' submits on a shared deployment; and nothing tests it. Say it is best-effort: wrapped so failure does not fail close, logged, and described as such in the README next to the write-ahead-log caveat.

### L-6. Test gates that are not quite gates

- AD-22 "reject any request to a host other than localhost" is implementable in Vitest (undici/nock) and for the browser (`page.route`), but not for the Next server process under Playwright; for that the real guard is no key plus `JUDGE_PROVIDER=replay`. Say so.
- SM-2 requires F1 at least 0.70, but `judge-eval.test.ts` asserts only "at least the recorded baseline", so a committed ruling below 0.70 passes. Assert both, and name where the baseline lives.
- The CI "smoke step that starts `npm run demo`" needs to run it in the background and kill it; one phrase fixes it.

### L-7. Suspicious technology claims (for the version-checking reviewer)

- `claude-haiku-5-5` at USD 0.10 / 0.50 per million tokens: Haiku 4.5 was priced at 1 / 5, so this is a tenfold drop; confirm model ID and price, because the whole sizing table depends on them.
- `output_config.effort: "low"` on a Haiku-class model: confirm the parameter is supported for that model.
- `@anthropic-ai/sdk` 1.12.0: confirm a 1.x line exists and that the `output_config.format` JSON-schema option and `stop_reason: "refusal"` are as described.
- `eslint` 10.15.0 with `eslint-config-next` 16.4.6: confirm peer compatibility. Also confirm Next 16 "middleware/proxy" naming if M-9 or L-8 adds an auth gate, and the `outputFileTracingIncludes` key location.
- Vercel Hobby "up to 300 s per function with fluid compute" and `after()` running inside the same `maxDuration`: confirm current limits.
- PGlite 0.5.17, `@electric-sql/pglite-socket` `pglite-server --run`, vitest 5.1.1, Node 26 described as LTS in November 2026: spot-check.

### L-8. Rules that cannot be mechanically verified, and one missing gate

- "No tracked file holds text derived from `.idea/`" (AD-19, AD-20, CLAUDE.md redaction rule) cannot be checked in CI, which has no `.idea/`. Add it as a checkbox in the PR template and a denylist grep of known placeholder-sensitive terms kept outside the repo.
- Host page protection (unauthenticated user reaches `/spill/...`) is unspecified: per-page `auth.requireHost()` or a proxy redirect. Say per-page, and that no auth decision is made in a proxy, so AD-5 stays the single check.

---

## Deferred check (explicit)

| Deferred item | Can two units diverge? |
| --- | --- |
| Host reading an Answer set through a link | Yes, see H-1. |
| Component library and visual system | No; UX already decided "no UI library" (M-7). |
| Review presentation | No; UX decided structurally (M-7). |
| Unsent drafts | Yes, mildly: spine key (`gameId`) conflicts with UX key (token hash) (M-7). |
| Judge prompt wording and SM-2 baseline | No, format and bar fixed; gate wording in L-6. |
| Login rate limiting and account recovery | Not a divergence; cost-abuse angle in M-5. |
| Stage 2 data | No, doors kept (M-7 only for the zero-slot Question). |
| Several Hosts per Game | No. |
| Observability beyond console | Fine as stated. |
| Cut order | Conflicts with "never cut AD-4" (M-4). |

## What is solid (not findings)

AD-9/AD-10 (single anonymisation transaction, banned columns, schema-inspecting test) and the xmin-safe single-batch insert; AD-7 token-in-fragment with game-path status; AD-15 snapshot Board so play cannot read Review data; AD-16 reveal log with unique slot and highest-`seq` undo; AD-13 one boundary with three providers and no network in tests; AD-12's per-Question partition design and the all-pairs cost comparison; the examiner path (`clone`, `install`, `demo`) matching NFR-1.
