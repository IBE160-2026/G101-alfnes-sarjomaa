---
title: "Story 3.3: Anonymity tests: the Host's view during Collection, and log hygiene"
type: 'feature'
created: '2026-11-22'
baseline_revision: 'a962ce313b9500e064e382f48a2a1eea783ca597'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/.docs/implementation-artifacts/epic-3-context.md'
warnings: [oversized]
deferred: []
---

<intent-contract>

## Intent

**Problem:** FR-11 and FR-12 have scattered coverage (Stories 2.3 to 2.7), but nothing drives *every* Host read and action, or the real app as a logged-in Host, before and after a Participant submits. Nothing captures the Next server's own output either, so a Token or Answer that Next itself prints (it logs Server Function arguments and forwards browser console output in `next dev`) would go unseen. AD-22 names `host-view.test.ts`, `host-anonymity.spec.ts` and a server-output capture.

**Approach:** Tests plus the e2e harness only:
- `tests/integration/host-view.test.ts` covers AC1 and AC5.
- A new forced-error case in `collection.test.ts` covers AC4.
- `tests/e2e/host-anonymity.spec.ts` covers AC2.
- AC3 needs three parts. Playwright redirects the output of both servers (`next start` and a second `next dev`) to files. The shared `localOnly` helper records every Token and Answer the browsers send or receive. A global teardown fails the run if any recorded value appears in either file. `tests/e2e/server-output.spec.ts` drives the dev server directly.

## Boundaries & Constraints

**Always:**
- Start by invoking the `ponytail` skill at level `full` (project rule): the smallest complete change, but never cut an AC, anonymity, validation, error handling or a test.
- Test titles carry FR IDs. Add rows to `tests/TRACE.md` under FR-11 and FR-12, and drop 3.3 from both "Pending" lines.
- **AC1** (`host-view.test.ts`): copy the `collection.test.ts` setup: the `next/*` mocks, `auth.register`, and a direct insert of the Game and 3 Questions. Then `createInviteLinks` with count 4, plus one extra link created through the action before the first snapshot.
  - A `reads()` helper returns the output of every Host read available while *collecting*:
    - `GamesPage` and `GamePage` HTML, and the result of `generateMetadata`;
    - `games.listOwned`, `games.getOwned`, `questions.list`, `collection.progress` and `collection.linkStatus`;
    - the `/svar/[gameId]` shell HTML;
    - `openInviteLink(gameId, token)` with no edit secret, for every link (the Host holds the links);
    - the `WRONG_STATE` results of `saveQuestion`, `moveQuestion` and `removeQuestion`;
    - `closeCollection` while there are fewer than 3 sets (refused, so nothing changes).
  - The sequence: take snapshot 0, then submit set 1, change set 1 and submit set 2. After each step `reads()` must `toEqual` snapshot 0. Then submit set 3. Now the outputs may differ from snapshot 0 only in `progress.submissions` (3), the count text and the close control on the Game page. Reuse 2.6's `withoutClose` normalisation, and leave `closeCollection` out of `reads()` from three onwards.
  - The mutating actions:
    - `revokeInviteLink` on a used link and on an unused link return the same result once each returned link's Token is replaced by a placeholder;
    - `createInviteLinks({ count: 1 })` gives the same normalised result before snapshot 0 and after set 3;
    - `deleteGame` at the end returns `{ redirect: "/spill" }`.
  - **The secret scan:** `JSON.stringify` of every output must hold none of these:
    - a Token, except the fresh link(s) that output itself returns;
    - `sha256` of any Token or edit secret;
    - any edit secret;
    - any Answer text.
- **AC5** (also in `host-view.test.ts`): `Object.keys(envSchema.shape)` must equal a fixed sorted list of today's 9 keys. The `game` columns from `information_schema.columns` must equal a fixed list of today's 9 columns, and the `host` columns a fixed list of today's 6 (PRD FR-12 also names a "Host option"). A comment says that adding an entry needs an anonymity review.
- **AC4** (`collection.test.ts`, `describe("INTERNAL")`, a new `it.each` for `openInviteLink` and `submit`):
  - Force a DB failure with `vi.spyOn` on the `getDb()` object, as the VACUUM test does. Choose a call each entry point really makes, and assert that the spy was hit.
  - The thrown error carries the Token, `sha256(Token)`, the edit secret, its hash and an Answer text. They go in `message`, `detail`, `query`, `parameters` and `cause.message`, with `code: "23514"`.
  - Capture `process.stderr.write`, `process.stdout.write` and `console.log`, `info`, `warn`, `error` and `debug`.
  - Expect the exact `INTERNAL` result, exactly one log line `{ module: "collection", op, code: "INTERNAL", sqlstate: "23514" }`, and no secret in the result or in any captured output.
- **AC3 harness** (`playwright.config.ts`):
  - `E2E_OUT_DIR` defaults to `path.dirname(E2E_DB_DIR)` and is exported through `process.env` the same way.
  - `webServer` becomes an array:
    1. the existing server, with its command ending `npm run start > "<E2E_OUT_DIR>/start.log" 2>&1`;
    2. `npm run dev > "<E2E_OUT_DIR>/dev.log" 2>&1` on port 3101. It uses the same env block, but with `DATABASE_URL=pglite://<E2E_OUT_DIR>/dev-db`, `PORT=3101` and `APP_BASE_URL=http://localhost:3101`. Its URL is `/api/health`.
  - `globalTeardown` points at `tests/e2e/server-output.teardown.ts`.
- **Recording** (`fixtures.ts` `localOnly`, which every spec already calls on every context, NFR-3):
  - On a request with a `next-action` header to `/svar/`, parse the POST body as JSON. Record every string leaf that is not a UUID, has at least 3 characters and is not a `$` reference (`$$x` unescapes to `$x`).
  - On every response to a `next-action` request, record each Token found by `/\/svar\/[0-9a-f-]{36}#([A-Za-z0-9_-]{43})/g`.
  - Append each new value as one JSON line to `<E2E_OUT_DIR>/secrets.jsonl`.
- **Teardown:**
  - Throw if `start.log` or `dev.log` is missing or empty, because then the capture is broken.
  - Read `secrets.jsonl` (a missing file means no values).
  - Throw, naming the log and the first 6 characters of each value, if any value appears in either log. Each match must be bounded: no letter, digit, `_` or `-` on either side, with the Unicode flag.
- **`server-output.spec.ts`** uses the dev server through `test.use({ baseURL: "http://localhost:3101" })`, with generous timeouts, because routes compile on first hit.
  - The Host registers, creates a Game with one Question and one link, and copies the link.
  - A Participant opens the link in a fresh `localOnly` context. Inside that page, a `page.evaluate` calls `console.log`, `console.warn` and `console.error` with the Token. The Participant then submits a distinctive Answer.
  - The test polls `dev.log` until it shows the request line for the submit's `POST /svar/` (proof that the capture is live). It then asserts that `dev.log` holds neither the Token, the edit secret (read from `localStorage`) nor the Answer.
- **AC2** (`host-anonymity.spec.ts`, against `next start`): follow the clock pattern of `progress.spec.ts:51-91`.
  - The Host creates a Game with two Questions and four links, then clicks "Jeg har kopiert lenkene".
  - From then on, the test records every response the Host's page receives (URL, status, body; responses without a body are skipped).
  - `visitAll()` goes to `/`, `/spill` and the Game page. On the Game page it then advances the clock 30 s and waits for the refresh response.
  - Phase A runs with no set. Then a Participant in a fresh context submits link 1, with distinctive Answers.
  - Over the next 1 s of real time, the Host page sends no request (nothing is pushed).
  - Phase B must give the same URLs, statuses and bodies as phase A. If a body is provably non-deterministic in an anonymity-neutral way, normalise only that part, and record it here.
  - Sets 2 and 3 are submitted, and phase C shows "3 av 4 svar mottatt".
  - No recorded body in A, B or C may contain any of the 4 Tokens, an edit secret or any submitted Answer text.
  - A fresh context opens used link 1 and gets an empty form, every "Svar" field `""`, exactly like unused link 4.
- Prove each new check can fail: break the guarded code once, watch the test (or the run) go red, then restore it. Record each break in a fail-proof log in this spec.

**Never:**
- No production code change, unless a check finds a real leak. In that case, fix the leak and record it here. `next.config.ts` keeps `serverFunctions: false` and `browserToTerminal: false`, and the existing unit test stays.
- No after-close or after-confirm checks (those are Stories 3.2 and 5.5), and no Review or export checks (5.1 and 4.3).
- No real-time `waitForTimeout` as the condition a test waits on, except the 1 s "nothing arrives" window. No retries, and no longer timeouts used to hide a race.
- No new dependency, and no edits to `.logs/` or `prompting/`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Below three | 0, then 1, then 2 sets, and a changed set | every Host read is identical | test red on any difference |
| At three | the 3rd set | only the count and the close control change | — |
| Used vs unused link | Host reopens or revokes each one | identical outputs after Token normalisation | — |
| Driver error carrying secrets | a forced failure in `openInviteLink` or `submit` | `INTERNAL`, one bare log line, no secret in any stream | — |
| Next logs arguments | `serverFunctions: true` (fail proof) | `server-output.spec` red and the teardown fails the run | — |
| Capture broken | a log file missing or empty | the teardown fails the run | — |

</intent-contract>

## Code Map

- `tests/integration/collection.test.ts:1-160` -- the setup to copy: the mocks, `collectingGame` and `render`. Lines 715-770 hold the 2.6 snapshot test and `withoutClose`. Lines 1000-1040 hold the existing `INTERNAL` `it.each`, where AC4 goes. Lines 1216-1250 show the `vi.spyOn(db, …).mockRejectedValueOnce` pattern.
- `tests/integration/next-mocks.ts` -- `run()` for the FormData actions (`deleteGame`), and `cookieJar`.
- `src/app/spill/[id]/actions.ts`, `src/app/svar/[gameId]/actions.ts`, `src/app/spill/page.tsx`, `src/app/spill/[id]/page.tsx` (`generateMetadata`, `GamePage`) and `src/app/svar/[gameId]/page.tsx` -- every Host read and action (read-only).
- `src/server/collection/index.ts:125-280` -- `progress`, `linkStatus`, `openInviteLink` and `submit` (read-only). `src/server/boundary.ts` -- `withBoundary`, which AC4 guards.
- `src/server/env.ts` (`envSchema`) and `src/server/db/schema.ts:19-56` (`host`, `game`) -- the AC5 lists.
- `playwright.config.ts` -- `webServer`, and `E2E_DB_DIR` through `process.env`.
- `tests/e2e/fixtures.ts:11-25` -- `localOnly`, which every spec calls on every context, and the `context` fixture.
- `tests/e2e/progress.spec.ts` -- `submitAll` and the clock pattern for the 30 s refresh.
- `next.config.ts` -- `logging` (read-only; flipped only for the fail proof).
- `node_modules/next/dist/server/dev/log-requests.js:47-51` -- dev prints `└─ ƒ name(args)` with depth-2 `safe-stable-stringify`. The Token and edit secret are top-level arguments, so they would print in full.
- `.docs/planning-artifacts/architecture/architecture-Toppsvar-2026-11-21/ARCHITECTURE-SPINE.md` -- AD-22, the e2e bullet: it states only `next build && next start`.

## Tasks & Acceptance

**Execution:**
- `tests/integration/host-view.test.ts` -- create -- AC1, AC5.
- `tests/integration/collection.test.ts` -- add the AC4 `it.each` -- AC4.
- `playwright.config.ts` -- both servers write to files, plus the dev server and `globalTeardown` -- AC3.
- `tests/e2e/fixtures.ts` -- recording in `localOnly` -- AC3.
- `tests/e2e/server-output.teardown.ts` -- create -- AC3.
- `tests/e2e/server-output.spec.ts` -- create -- AC3 (the `next dev` path).
- `tests/e2e/host-anonymity.spec.ts` -- create -- AC2.
- `ARCHITECTURE-SPINE.md` AD-22 -- amend the e2e bullet: a second `next dev` server on its own port and PGlite directory, used by `server-output.spec.ts`, and both servers' output captured to files and scanned in the global teardown -- spine rule "a departure amends it in the same PR".
- `tests/TRACE.md` -- rows and Pending -- conventions.
- `.docs/implementation-artifacts/sprint-status.yaml` -- set `3-3-…` to `done` at finalization only.

**Acceptance Criteria:**
- Given the story's AC1 to AC5 in `epics.md`, when `npm run test` and `npm run test:e2e` run, then each AC has a passing test whose title carries its FR ID.
- Given each guarded rule, when it is broken once, then a test or the run fails, as the fail-proof log records.
- Given a full `npm run test:e2e`, when it finishes green, then `start.log` and `dev.log` exist, are non-empty and were scanned against a non-empty `secrets.jsonl`.

## Spec Change Log

## Review Triage Log

### 2026-11-22 — Review pass
- verdicts: 43 findings — high 0, medium 3, low 22, false 6, maybe-false 12
- findings:
  - `[medium]` `[patch]` Blind Hunter 1a: an empty `secrets.jsonl` makes the teardown scan 0 values and pass. `host-anonymity.spec.ts` now asserts the file holds all of its Tokens, edit secrets and Answers.
  - `[low]` `[reject]` Blind Hunter 1b: `postDataJSON()` throws on a non-JSON `/svar` body and stalls the request. Every `/svar` action takes plain arguments, so the body is a JSON array. A throw would hang the spec loudly, never pass it silently.
  - `[low]` `[patch]` Blind Hunter 2a: hashes are not scanned, though AD-7 bans them in logs. The teardown now also scans the sha256 hex of every value. It went red with `sha256(Token)` written to stdout.
  - `[maybe-false]` `[reject]` Blind Hunter 2b: URL-encoded or `\u`-escaped Answers slip past. No server path logs a URL with an Answer in it, and `JSON.stringify` and `util.inspect` print æøå raw. If true, it would only be low.
  - `[maybe-false]` `[reject]` Blind Hunter 3: values under 3 characters are skipped, and an async `response.text()` can drop a Token when the context closes. The skip now has a `shortcut:` comment. Participants' Tokens are recorded synchronously from the request body, and the Host context that receives fresh links stays open. If true, it would only be low.
  - `[medium]` `[patch]` Blind Hunter 4: the "nothing is pushed" window ran with the clock paused. The window now advances 29 s of fake time, then waits 1 s of real time. It went red with a 20 s refresh interval.
  - `[low]` `[reject]` Blind Hunter 5: e2e phase C is never compared with phase A. Exact "only the count changes at three" is proven in `host-view.test.ts`. AC2 asks the e2e for no Answer or Token, and phase C is scanned. Normalising RSC count and close markup would add a fragile parser.
  - `[low]` `[reject]` Blind Hunter 6: headers and bodyless responses are not compared. AC2 is about response bodies, and redirects carry no Host data. A header diff such as `set-cookie` carries no Answer.
  - `[low]` `[reject]` Blind Hunter 7: there is no forced-error case for `revokeInviteLink` or `createInviteLinks`. AC4 names two entry points. Revoke's INTERNAL path is already covered by the renamed-table `it.each`, and the teardown scans `start.log` during `revoke.spec.ts`.
  - `[low]` `[reject]` Blind Hunter 8: `host-view.test.ts` does not capture stdout. Server-side logging of Host actions is covered by the e2e teardown (`start.log`, every Token recorded at creation). AC1 is about outputs.
  - `[low]` `[patch]` Blind Hunter 9a: `epic-3-context.md` said the fixed-list check goes in `env.test.ts`. The line now names `host-view.test.ts`.
  - `[false]` `[reject]` Blind Hunter 9b: `epic-3-context.md` gives three wordings for `answer`. They agree: AD-10 lists seven columns, and the six-until-4.2 deferral is 3.1's recorded decision.
  - `[false]` `[reject]` Blind Hunter 10: sprint status and the spec are not in the diff. Both are written at finalization, and the epic context is committed on its own.
  - `[low]` `[patch]` Blind Hunter 11: the dev URL was defined twice. It is now `process.env.E2E_DEV_URL`, set once in the config.
  - `[low]` `[reject]` Blind Hunter 12: every run pays for a second server. Dev is ready in a few seconds, and the spine (AD-22) and Design Notes record why. Starting it only on selection would need custom harness logic.
  - `[low]` `[patch]` Blind Hunter 13: the wording said "Token or Answer". It is now "Token, edit secret or Answer" in the teardown and in AD-22.
  - `[false]` `[reject]` Intent 1: Host actions are not driven in the e2e. AC2 asks for "every Host page", and every action is covered in `host-view.test.ts` (AC1).
  - `[low]` `[patch]` Intent 2: the timing check was narrow. Same root as Blind Hunter 4; fixed there.
  - `[false]` `[reject]` Intent 3: the close control changes at three. FR-10 requires it from three, and Story 2.6's snapshot test set the same normalisation.
  - `[false]` `[reject]` Intent 4: one check at the end, not per spec. AC3's outcome is "the run fails", which the teardown does with exit code 1.
  - `[low]` `[reject]` Intent 5: only one flow runs on `next dev`. It exercises the two dev-only leaks the Epic 2 review found, through `/svar` actions and the guest console. The config pin covers every other action.
  - `[low]` `[reject]` Intent 6: AC4 forces the error early. The boundary is the guarded unit, and the thrown error carries every secret.
  - `[low]` `[patch]` Intent 7: AC5 is not where the context file says. Same as Blind Hunter 9a.
  - `[false]` `[reject]` Intent 8: the context edits are out of scope. The epic context was stale against the spine, and step 1 of the workflow must recompile it. It gets its own commit.
  - `[medium]` `[patch]` Verification Gap 1: nothing checks that the recorder captured values. Same root as Blind Hunter 1a; fixed there.
  - `[maybe-false]` `[reject]` Verification Gap other: the async response read can drop Tokens. Same as Blind Hunter 3.
  - `[low]` `[reject]` Edge 1: a `postDataJSON` throw. Same as Blind Hunter 1b.
  - `[maybe-false]` `[reject]` Edge 2: `text()` drops a value. Same as Blind Hunter 3.
  - `[low]` `[patch]` Edge 3: short or UUID-shaped Answers are skipped. Documented with a `shortcut:` comment.
  - `[low]` `[patch]` Edge 4: an empty `secrets.jsonl`. Same as Blind Hunter 1a.
  - `[maybe-false]` `[reject]` Edge 5: encoded Answers. Same as Blind Hunter 2b.
  - `[low]` `[reject]` Edge 6: a preset `E2E_DB_DIR` accumulates files. Nobody presets it, and the smoke spec already requires a fresh directory.
  - `[low]` `[patch]` Edge 7: a developer's own `npm run dev` holds Next 16's `lockDistDir` lock, so the e2e dev server exits. This was checked: `experimental.lockDistDir` defaults to true. A `shortcut:` comment in the config (upgrade: its own `distDir`) and one README line were added. A config `distDir` would add production surface for a test.
  - `[low]` `[reject]` Edge 8: server stderr is no longer live. Playwright reports a `webServer` that exits early at once, and the teardown prints both log paths.
  - `[maybe-false]` `[patch]` Edge 9: requests that start while `Promise.all` runs are dropped. `visitAll` now loops until the list is stable. The fix was a direct correction.
  - `[maybe-false]` `[reject]` Edge 10: the prefetch waiter may match a prefetch from the `/spill` page. 15 stressed repeats were green, and a wrong match only makes a phase differ (red), never pass. If true, it would only be low.
  - `[low]` `[patch]` Edge 11: the no-push window. Same as Blind Hunter 4.
  - `[low]` `[patch]` Edge 12: `console.trace`, `dir` and `table` were not captured in AC4. Added.
  - `[maybe-false]` `[reject]` Edge 13: a new Host-option table bypasses AC5. AC5 names the `env.ts` keys and the `game` columns, and `host` was added for the PRD's "Host option". Pinning every table would turn red in each later epic. If true, it would only be low.
  - `[maybe-false]` `[reject]` Edge 14: direct `process.env` reads bypass `envSchema`. `grep -rn "process\.env\." src` finds none outside `env.ts`. If true, it would only be low.
  - `[maybe-false]` `[patch]` Edge 15: the claim "scanned against a non-empty `secrets.jsonl`". Same as Blind Hunter 1a; now asserted in every full run.
  - `[maybe-false]` `[reject]` Edge 16: the claim "records every Token and Answer" is broader than the code. The intent contract lists the recording rules exactly, and the gap is the documented short-string limit. If true, it would only be low.
  - `[maybe-false]` `[reject]` Edge 6b (from the same list): `route.fulfill` requests skip recording. Mocked responses never reach the server, so they cannot leak into its log.

### AI suggestions corrected or rejected (grading evidence)

- **Orchestrator corrections of the task:**
  - The orchestrator named one flaky test, the skeleton test. Reproducing it under CPU load (12 `yes` processes, 14 workers) found two races:
    - **The skeleton test** clicked before the Link prefetch had delivered `loading.tsx`. The trace shows the navigation request leaving before the prefetch without the `/_tree` header.
    - **The logged-out test** used `clearCookies()`, but a `/spill` prefetch still in flight answered with `Set-Cookie` and logged the Host back in.
  - Both were fixed by waiting on the real condition (the loading prefetch response, and a fresh context without the cookie). They were committed separately and proven with `--repeat-each=20`, twice: under load and at default settings.
  - The epic context was stale against the 3.1 spine amendment, so it was recompiled.
- **Orchestrator corrections of the implementer:**
  - The orchestrator sent 9 review patches. These covered recording that nothing checked, a no-push window with the clock paused, hashes not scanned, a dev URL defined twice, the dev lock, console methods missed, late requests dropped and wording.
  - The orchestrator independently re-ran the `serverFunctions: true` break and saw both the spec and the teardown go red.
- **Implementer departures, accepted:**
  - AC2 normalises the random per-request RSC IDs and the response order (Design Notes).
  - AC4 fails `linkExists`, the second select.
  - AC5 adds a `host` column list, because PRD FR-12 names a "Host option".
- **Reviewer suggestions rejected:** 27 rows above, each with its reason. They include:
  - encoded-form scanning;
  - an e2e phase C equality;
  - header comparison;
  - extra forced-error entry points;
  - pinning every table;
  - a test-only `distDir` in `next.config.ts`;
  - starting dev only on selection.

## Design Notes

- **Why the output goes to a file.** Playwright's `webServer` exposes no hook for its output. With `> file 2>&1`, Node writes to a file synchronously, so the output is complete when a response arrives. The syntax works in both `sh` and `cmd.exe`. The cost is that server errors no longer appear live in the Playwright console. The teardown prints the log paths, so they can be found.
- **Why `localOnly` does the recording.** Participants answer in `browser.newContext()` contexts that a fixture never sees. Every context already passes through `localOnly` (NFR-3), so that is the one place that sees every Token and Answer.
- **Why the run uses `next dev` at all.** The two leaks the Epic 2 review found (logged Server Function arguments and forwarded browser console output) exist only in development mode. A `next start` capture can never see them. Next 16 builds dev into `.next/dev`, and the `webServer` entries start one after another, so the build has finished before dev starts.

- **AC2 normalisation (recorded as the spec requires).** Two things vary between phases and neither touches anonymity. (1) An RSC refresh or prefetch keys its viewport and metadata boundaries with a random 21-character per-request ID (`"…v"`, `"…m"`); `withoutRequestIds` replaces only that ID. (2) The order responses arrive in, so each phase is sorted by URL and body before comparing. The Game page also prefetches its visible `/spill` links in the background (route tree, then metadata) on load and again after the refresh; whether a load-time prefetch had landed before the refresh varied, so `visitAll` waits for each of those prefetch responses before moving on. Nothing is dropped from the comparison or the secret scan, and the HTML document bodies needed no normalisation. A response is recorded only if the Host page started its request during the phase, and every such response is awaited in full.
- **AC4 call choice.** Both entry points' second `getDb().select` is `linkExists` in `resolveLink`; the first is `games.find`, whose own boundary would log as `games`. The test fails exactly that call and asserts the spy ran exactly twice.
- **No leak found.** No check found a real leak, so no production code changed.

## Fail-proof Log

Each break was applied once, the named check went red, and the code was restored (`git checkout`).

| Break | Check that went red |
|-------|---------------------|
| `progress` returns the exact count below three | `host-view.test.ts` AC1 snapshot; `host-anonymity.spec.ts` phase B ≠ phase A |
| `revokeInviteLink` also returns the pasted link (`old: pasted`) | `host-view.test.ts` secret scan (old Token in the revoke result) |
| `HOST_SEES_ANSWERS` added to `envSchema` | `host-view.test.ts` "env.ts reads exactly these 9 keys" |
| `alter table game add column show_answers boolean` (test-only, reverted) | `host-view.test.ts` column list |
| `console.error(error)` in `withBoundary` | `collection.test.ts` AC4, both entry points |
| `process.stdout.write(error.detail)` in `withBoundary` | `collection.test.ts` AC4, both entry points |
| `logging.serverFunctions: true` | `server-output.spec.ts` (Token in `dev.log`) and the teardown (Token and edit secret in `dev.log`) |
| `logging.browserToTerminal: true` | `server-output.spec.ts` and the teardown (Token from the guest's console in `dev.log`) |
| submit action writes the Token to stdout | the teardown (3 Tokens in `start.log`), run with `host-anonymity.spec.ts` on `next start` |
| `start.log` redirected to `/dev/null` | the teardown ("start.log is missing or empty"), run exit code 1 |
| `openInviteLink` returns saved Answers without checking the edit secret | `host-anonymity.spec.ts` (used link not empty in a fresh context) |
| `COLLECTING_REFRESH_MS` set to 20 s (a timer-driven request inside the window) | `host-anonymity.spec.ts` "nothing is pushed" (29 s of fake time, then 1 s real) |
| submit action writes `sha256(Token)` to stdout | the teardown ("sha256 of …" in `start.log`) |


## Verification

**Commands:**
- `npm run lint && npm run typecheck && npm run format:check` -- expected: clean
- `npm run test` -- expected: all pass, offline
- `npm run test:e2e` -- expected: all pass, with both logs captured and scanned
- `npx playwright test tests/e2e/host-anonymity.spec.ts tests/e2e/server-output.spec.ts --repeat-each=5` -- expected: green (no flake)

## Auto Run Result

Status: done

**Summary.** Story 3.3 adds the FR-11 and FR-12 proof:
- **`host-view.test.ts`, AC1:**
  - every Host read and refused action is identical at 0, 1, a changed and 2 sets;
  - at 3, only the count and the close control change;
  - a used and an unused link revoke alike;
  - no output holds a Token, hash, edit secret or Answer.
- **`host-view.test.ts`, AC5:** fixed lists of the 9 `env.ts` keys, the 9 `game` columns and the 6 `host` columns.
- **`collection.test.ts`, AC4:** a forced driver error that carries every secret gives `INTERNAL` and one bare log line. No secret reaches stdout, stderr or any console method.
- **`host-anonymity.spec.ts`, AC2:**
  - It drives the real app as a logged-in Host on `next start`.
  - Every page and refresh body is identical before and after a submit, and nothing is pushed in 29 s of fake time plus 1 s of real time.
  - It shows "3 av 4" at three.
  - No body holds a secret.
  - A used link reopens empty in a fresh context.
- **AC3, the server output:**
  - Both `next start` and a second `next dev` write to files.
  - `localOnly` records every Token, edit secret and Answer.
  - The global teardown fails the run on any of them, or their sha256, in either log, and on a missing log.
  - `server-output.spec.ts` checks the dev-only leaks behaviourally.

No production code changed. No leak was found.

**Files changed.**
- `tests/integration/host-view.test.ts` (new): AC1, AC5.
- `tests/integration/collection.test.ts`: the AC4 `it.each`.
- `tests/e2e/host-anonymity.spec.ts` (new): AC2.
- `tests/e2e/server-output.spec.ts` (new): the `next dev` check.
- `tests/e2e/server-output.teardown.ts` (new): the log scan.
- `tests/e2e/fixtures.ts`: recording in `localOnly`.
- `playwright.config.ts`: two servers with captured output, `E2E_OUT_DIR`, `E2E_DEV_URL` and the teardown.
- `README.md`: stop `npm run dev` before `npm run test:e2e`.
- `tests/TRACE.md`: FR-11 and FR-12 rows, and Pending updated.
- `ARCHITECTURE-SPINE.md`, AD-22: the second server and the capture (spine amendment).
- `.docs/implementation-artifacts/epic-3-context.md`: recompiled against the 3.1 spine.
- `sprint-status.yaml`: 3-3 set to done.
- This spec.

**Review.** 43 findings: 0 high, 3 medium, 22 low, 6 false, 12 maybe-false.
- **Patched:** 9 entries (3 medium, 6 low or maybe-false).
- **Deferred:** none.
- **Rejected:** the rest, each with its reason in the triage log.

**Follow-up review recommended: true.** Three medium entries were patched: the unchecked recorder, the no-push window and the hash scan. The risk left unverified is that AC2's equality depends on Next 16.4.6 internals: the per-request RSC ID format and the `/spill` prefetch pattern. A Next upgrade can make it hang or turn red. It cannot make it pass wrongly.

**Verification.**
- `npm run lint`, `npm run typecheck` and `npm run format:check` are clean.
- `npm run test`: 428 passed in 34 files.
- `npm run test:e2e`: 86 passed, with 193 values scanned.
- `host-anonymity.spec.ts` and `server-output.spec.ts` passed `--repeat-each=5`, with 13 passed.
- No server was left on 3100 or 3101.

**Residual risks.**
- The teardown matches Answers of 3 or more characters as whole words, so an everyday word used as an Answer in a future spec could trip it.
- Server stderr now lives in files, not in the console.
- A developer's own `next dev` blocks the e2e dev server (the `shortcut:` comment).

