# Story 8.5 code review (bmad-code-review)

- **Date:** 2026-11-24
- **Scope:** `git diff origin/main...epic-8-vertsvisning`, which covers Story 8.5 (Separate TV view and host view with answer key). 14 commits, from `e694b9a` to `6219e5f`, on the merge base `7f5d408` (the spec's `baseline_revision`).
  - 31 files changed, +1,939/-543.
  - The reviewers read the whole diff: 3,209 lines, about 198 kB.
- **Mode:** `full`. The diff was checked against:
  - `spec-8-5-separate-tv-view-and-host-view-with-answer-key.md`, including its review triage log, Design Notes and residual risks. Items that log rejected were not raised again unless there was a new argument;
  - `epic-8-context.md` and Story 8.5 in `epics.md`;
  - the PRD: FR-24 to FR-27 as amended on 2026-11-24, and §11;
  - the 2026-11-24 amendments in `EXPERIENCE.md` and `DESIGN.md`;
  - `ARCHITECTURE-SPINE.md`, with AD-15, AD-16 and AD-17 as amended, and the routes and limits rows.
- **Layers:** Blind Hunter, Edge Case Hunter, Verification Gap and Acceptance Auditor. All four completed and none failed.
- **Focus asked for by the orchestrator:**
  - that `/tv` never receives a hidden label or Count, in its HTML, its RSC payload or a `BroadcastChannel` message;
  - the owner and state checks on `/tv` and `/vert`;
  - that the `usePlay` refactor did not change how `/skjerm` behaves;
  - that the stale-tab protections (`WRONG_QUESTION`, `lastReveal`) still hold when `/vert` and `/skjerm` are open at once;
  - whether the `BroadcastChannel` and the 2 s poll are correct: visibility, cleanup, no refresh storms, and the cost of each open TV on Vercel and Neon;
  - keyboard handling on `/vert` (text fields and the overlay);
  - the accessibility of `/vert`;
  - test gaps.
- **Triage:**
  - Every claim was checked at the cited lines, and past the diff where needed: `src/server/play/index.ts` (`readPlay`, `undo`, `nextQuestion`, `reveal`), `src/app/spill/[id]/actions.ts` (`hostAction`), `src/app/spill/layout.tsx`, `src/app/spill/error.tsx`, `src/server/auth/index.ts` (`requireHost`), `src/server/games/index.ts` (`purgeIfDue`), `src/components/FullscreenKey.tsx`, `src/components/HostChrome.tsx`, the colour tokens in `src/app/globals.css`, and the `/skjerm` page and `Board` on `origin/main`.
  - `usePlay` was compared line by line with the logic it replaces in `Board` on `origin/main` (see "Verified clean").
  - No OpenRouter call was made, and no `.env` file was read.
- **Test run:** not run, because two other reviewers were using the same working copy. No finding depended on a test result. The spec records the author's run (831 passed, 1 skipped; e2e 102 of 104, with two cold-compile failures that passed on a rerun).
- **No fixes were applied.** No source file, story spec, `deferred-work.md` or sprint status was changed. The step-04 write-back to the story file was skipped on purpose, because this run was asked to triage and report only.

## Summary

| Severity | Count | Routing |
|---|---:|---|
| High | 0 | |
| Medium | 2 | 1 patch, 1 decision needed |
| Low | 14 | 12 patch, 1 decision needed, 1 defer |
| Dismissed | 19 | see the last section |

### Verified clean (checked in triage, not only claimed by a layer)

- **`/tv` never receives a hidden label or Count.**
  - The TV renders only from `play.load`. `load` maps every hidden slot to `{ id, position, revealed }`, so `label` and `count` are dropped before the object leaves the server. `PlayView` passes that `board` to the client component `TvBoard` unchanged, so the RSC payload carries the same stripped objects as the HTML. A `router.refresh()` from the poll or the channel re-runs the same server render, so the refresh payload is stripped too.
  - Team setup (*ready*) and Sluttstilling (*played*) get no Board at all. `lastReveal` and the hidden slots' ids do reach the TV, but they are UUIDs, as they already were on `/skjerm`.
  - The channel carries only the strings `"changed"` and `"bom"` (`PlayMessage`). Neither page reads state from a message (AD-16).
  - The integration test fetches the prerendered `/tv` and checks that the hidden labels of this Question and every later Question's labels are absent. The e2e fetches the full HTML with its inline RSC data before and after a Reveal. Finding 6 covers the Counts, which neither test checks.
- **Owner and state checks.**
  - The three pages share one `playPage` switch. `ownedGame` is `requireHost` plus `games.getOwned`, wrapped in `cache()` so the metadata and the page share one read. Missing, foreign and malformed ids all become `notFound()`, and a foreign Game gets the not-found title (AD-5).
  - `play.answerKey` goes through `readPlay`, which calls `games.getOwned` again and refuses any state but *playing* with `WRONG_STATE`. The layout's `requireHost` runs first as before. `authz.test.ts` covers `answerKey` for Host B.
  - *ready* shows Team setup, *played* shows Sluttstilling on `/tv` and the final standing on `/vert`, and every other state redirects to the Game page. This matches the spec.
- **The answer key reads only the Board.** `readPlay` reads `play_state`, `question`, `team` with Scores, `reveal` and `review.getBoard`, which returns `board_slot` rows. It never touches `answer` or `answer_group`. A discarded Group or a Group below the cut has no `board_slot` row, so it cannot reach `/vert` (AD-15).
- **The `usePlay` refactor did not change `/skjerm`.** `run`, `reveal`, `undo`, `nextTeam`, `next`, `bom`, `toggleUnscored`, the shortcut listener, the focus effects, `STALE` and every announced string are the same as in `Board` on `origin/main`. Only two things were added: `run` posts `"changed"` after a successful move, and `bom` posts `"bom"`. Neither changes what `/skjerm` renders, because nothing on `/skjerm` listens to the channel. `BoardTiles` keeps the old tile markup, and the stage still uses `clicked` for its animation. The `/skjerm` integration and e2e tests are unchanged, except for the Game page test, which now expects the two new links (AC7).
- **Stale-tab protections when `/vert` and `/skjerm` are open together.** These checks are on the server, so they hold for any number of tabs:
  - A stale Reveal of a slot on an earlier Question gets `WRONG_QUESTION`. A slot that another tab already revealed gets `ALREADY_REVEALED`.
  - A stale Angre sends the `lastReveal` its own page shows. `undo` compares it with the newest Reveal on the current Question and answers `NOTHING_TO_UNDO` if they differ.
  - A stale "Neste spørsmål" sends its `position` and gets `WRONG_QUESTION`.
  - All of these codes are in `STALE`, so the stale page refreshes without a banner.
  - `/vert` does not follow other tabs between its own moves. The spec triage rejected that on purpose.
- **Channel and poll mechanics.**
  - `useTvSync` opens one channel per mount and one interval, and its cleanup closes the channel and clears both the interval and the Bom timer. Its dependencies (`gameId`, `router`) are stable, so it does not re-subscribe on every render.
  - `postToTv` opens, posts and closes a channel for each message, so it leaks nothing.
  - The poll refreshes only when `document.visibilityState === "visible"`.
  - Moves are serialised by the `busy` ref, so a burst of keys gives at most one channel refresh per saved move, plus the poll. Polling stops at *played*, because `FinalScores` mounts no sync hook.
- **Keyboard on `/vert`.** `isShortcut` ignores repeats and modifiers, and any target inside `input, textarea, select, [contenteditable], dialog`. `/vert` has no text field. While the shortcut dialog is open, focus is inside the `dialog`, so no move fires and `?` cannot call `showModal()` twice. `F` is left out of the Host view's shortcut list, and the page mounts no `FullscreenKey`.
- **Accessibility of `/vert`.**
  - Each move is a real `Button`. Every hidden row has an "Avslør" button whose accessible name, "Avslør plass N", starts with its visible text (WCAG 2.5.3).
  - The status line is `role="status"`. A revealed row says "Avslørt" or "Uten poeng" in words, not only in colour. `success` `#1d6b45` on white is about 6.4:1.
  - The pressed unscored toggle uses `aria-pressed`, and the current Team uses `aria-current` with the words "Svarer nå".
  - Focus moves to the revealed row (`tabIndex={-1}`) after a Reveal, and back to the "Avslør" button after Angre. Both are e2e-tested.
  - `data-wide` lets `HostChrome` give the page the full 1280 px width.
- **No migration, no new table, no new Route Handler, no websockets, and no change to `play`'s mutations or error codes.** `TV_POLL_MS` lives in `src/lib/limits.ts`, and the spine's limits row names it.

## Findings

### Medium

#### 1. A TV poll that overlaps the last "Neste spørsmål" can leave the room's TV on the error page

- **Location:** `src/app/spill/[id]/play-page.tsx:58` and `:100-119` (`ownedGame`, then `PlayStage` → `play.load`); `src/server/play/index.ts:125-127` (`readPlay` reads the state again and throws `WRONG_STATE`); `src/app/spill/error.tsx`.
- **Source:** Edge Case Hunter, verified in triage.
- **What happens:**
  - Every render of `/tv` reads the Game's state twice. `ownedGame` reads it first and finds *playing*. `play.load` reads it again inside the Suspense boundary.
  - If "Vis sluttstilling" (or a delete) commits between the two reads, `readPlay` throws `WRONG_STATE` (or `NOT_FOUND`). The error goes to `spill/error.tsx`, the light Host error page with a retry button.
  - That error boundary does not reset on `router.refresh()`, and `TvBoard` has unmounted, so the poll and the channel listener are gone. The TV stays on the error page in front of the room until someone clicks "Prøv igjen" on the TV.
  - A TV on another device follows only by polling, so it is the most exposed. In the same browser, the channel refresh that follows the commit may replace the failing poll response, but that is not certain. The window is the time between the two reads, so the chance is a few percent per finished Game, and the failure comes at the climax of the evening.
  - The same double read existed on `/skjerm`, but there only the Host's own move triggered a render after the commit. The 2 s poll is what makes the race reachable.
- **Fix:** in `playPage`, catch a `DomainError` with the code `WRONG_STATE` from `play.load` and `play.answerKey`, and `redirect` to the same path (`/spill/${id}/${view}`), so the next render reads the new state and shows Sluttstilling. Treat `NOT_FOUND` the same way, which gives the not-found page. One integration test can stub the state between the two reads.

#### 2. A forgotten TV window polls the server every 2 s indefinitely (decision needed)

- **Location:** `src/components/TvBoard.tsx:35-37`; `src/app/spill/layout.tsx` (`requireHost` on every render); `src/lib/limits.ts` (`SESSION_TTL_MS` 14 days, `RETENTION_IDLE_MS` 90 days).
- **Source:** triage, from the orchestrator's cost focus. No layer raised it, and the spec triage rejected "poll load on the pilot not assessed" without numbers.
- **What happens:**
  - Each poll is a full `router.refresh()`. That is one Vercel function invocation and about eight Neon queries: the session, `getOwned` twice, the current Question, the Question count, the Teams with Scores, the Board and the Reveals.
  - One visible TV therefore costs about 1,800 renders and 14,000 queries per hour.
  - During a game that is fine. The problem is a TV left on a *ready* or *playing* Game. Nothing stops the poll:
    - `visibilityState` stays `"visible"` when the TV screen is switched off but the extended display is still connected;
    - each poll renews the 14-day sliding session, so it never expires;
    - an idle Game is only purged after 90 days.
  - Neon then never scales to zero. At the smallest compute size, that alone uses up a free plan's monthly compute hours in two to three weeks. On Vercel Hobby it adds about 43,000 invocations a day.
  - Polling stops at *played*, so the risk is limited to Games that were never finished.
- **Options:**
  - **A (recommended):** stop the poll after a fixed idle time with no change (for example 15 minutes with an unchanged revealed set, Question and Scores). Resume it on `visibilitychange`, on `focus` or on a channel message. Add a `shortcut:` comment and an amendment line in AD-17.
  - **B:** keep the poll as it is, and record the cost and the forgotten-window risk as a `shortcut:` comment in `TvBoard.tsx` and under the spec's residual risks.

### Low

#### 3. The Host view's failure banner is never tested

- **Location:** `src/components/HostPlay.tsx:144-148`; `tests/e2e/tv.spec.ts`.
- **Source:** Verification Gap (pre-verified, filed as `patch`).
- **What happens:** "Mistet forbindelsen." and "Fikk ikke lagret trekket. Prøv igjen." are only tested on `/skjerm` (`tests/e2e/play.spec.ts:379`, `:752`, `:904`, `:944`). If the `Notice` block were removed from `HostPlay`, a failed Reveal on `/vert` would show nothing. The status line would keep its last sentence, and every test would still pass. `/vert` is the page where the Host now plays.
- **Fix:** in `tv.spec.ts`, reuse the pattern from `play.spec.ts:373-379`: abort the POST to `${gamePath}/vert`, press a digit, and expect the alert "Mistet forbindelsen." with the slot still showing "Avslør plass N".

#### 4. The `/skjerm`-to-TV step can pass through the poll instead of the channel

- **Location:** `tests/e2e/tv.spec.ts:258-262`.
- **Source:** Verification Gap (pre-verified, filed as `patch`).
- **What happens:** the spec triage marked "sync from /skjerm to /tv untested" as fixed with this step. In this test, though, the popup TV is not reported hidden, so its 2 s poll runs and often lands inside the 1.5 s window. If `Board` stopped posting on the channel, the step would still pass most of the time. The AC4 test solved the same problem with the hidden-document init script.
- **Fix:** move the `/skjerm` key Reveal into the AC4 test, where the TV is already reported hidden, before "Vis sluttstilling".

#### 5. No test checks that the TV leaves earlier Reveals still on first render

- **Location:** `src/components/TvBoard.tsx:65-73`; `tests/integration/play.test.ts:1018-1050`.
- **Source:** Verification Gap (pre-verified, filed as `patch`).
- **What happens:** the Design Notes say that nothing animates on the TV's first render. Only `tv.spec.ts:89` looks at `data-revealing`, and it checks that a new Reveal does animate. If `seen` started from an empty set, every earlier Reveal would replay its animation each time the TV is opened or reloaded mid-Game, and no test would fail.
- **Fix:** in the `/tv` integration test, which renders a Game with one revealed slot, add `expect(html).not.toContain("data-revealing")`.

#### 6. AC1's tests check hidden labels but not hidden Counts

- **Location:** `tests/integration/play.test.ts:1045`; the e2e HTML fetch in `tests/e2e/tv.spec.ts:158-170`.
- **Source:** Acceptance Auditor.
- **What happens:** AC1 and the new FR-24 consequence say that no hidden label **or Count** reaches the TV. Both tests check only labels. The fixture's hidden Counts (5 and 2) are too short to search for in HTML, so the gap is in the fixture as well as in the assertion. The code is correct, because `load` drops `count` with `label`.
- **Fix:** give the hidden slots distinctive Counts in the fixture (for example 37 and 29), and assert that `">37<"` and `">29<"` are absent from the `/tv` markup.

#### 7. The Bom, Angre and Neste lag buttons on `/vert` are never clicked

- **Location:** `tests/e2e/tv.spec.ts:99-111`.
- **Source:** Acceptance Auditor.
- **What happens:** the spec requires "keyboard and buttons for every action" on the Host view. The e2e test triggers these three moves only by the keys `m`, `z` and `t`. The integration test only checks that the button labels appear. All of them call the same `usePlay` functions as the keys, so the risk is a wrong `onClick` binding, which no test would catch.
- **Fix:** click "Bom [M]", "Angre [Z]" and "Neste lag [T]" once each in the AC4 test, next to the existing key steps.

#### 8. No test checks that the TV's Bom panel goes away

- **Location:** `src/components/TvBoard.tsx:29-32`; `tests/e2e/tv.spec.ts:107`.
- **Source:** Acceptance Auditor.
- **What happens:** the I/O matrix says that the TV shows the Bom panel "for 1.5 s". The TV runs its own copy of the Bom timer in `useTvSync`, which the `/skjerm` tests do not cover. The e2e only checks that the panel appears. A broken timer would leave "Bom" on the room's screen.
- **Fix:** after the `toBeVisible` check, add `await expect(tv.locator(".bom-panel")).toHaveCount(0, { timeout: 3_000 })`.

#### 9. `TRACE.md` still says that `/tv` and `/vert` use the Game title

- **Location:** `tests/TRACE.md:324`.
- **Source:** Acceptance Auditor.
- **What happens:** the triage changed the titles to "TV – {tittel}" and "Vertsvisning – {tittel}", and the integration test asserts them. The TRACE row for AC3 and AC7 still says "the Game title as page title" for both pages, so the trace contradicts the test it points to. (The spec's Always line has the same stale wording. That part is dismissed below, because the fix would edit the spec under review.)
- **Fix:** change the row to "'TV – {title}' and 'Vertsvisning – {title}' as page titles".

#### 10. The current Team card on `/vert` does not use `primary` text as `DESIGN.md` says

- **Location:** `src/components/HostPlay.tsx:163-177`; `DESIGN.md:431`.
- **Source:** Acceptance Auditor.
- **What happens:** the DESIGN.md amendment says that the current Team is "a card on `primary-soft` with `primary` text and the words 'Svarer nå'". Only "Svarer nå" is `text-primary`. The Team name and Score stay in `ink`. The state is still clear from the words and `aria-current`, so this is a visual mismatch with the design contract, which wins over the code in this project.
- **Fix:** add `text-primary` to the card when `team.current` is true. `primary` on `primary-soft` is 7.4:1 according to DESIGN.md's own table.

#### 11. The answer key has no heading

- **Location:** `src/components/HostPlay.tsx:60-64`.
- **Source:** Blind Hunter.
- **What happens:** the Teams column has an `<h2>` "Lag", but the answer key is only an `<ol aria-label="Fasit">`. A screen-reader user can jump to "Lag" by heading but not to the key, which is the main content of the page. This does not break WCAG 2.1 AA, but the page structure is uneven.
- **Fix:** add `<h2 id="fasit" className="sr-only">Fasit</h2>` before the list, and use `aria-labelledby="fasit"` on the `ol`. Use a visible heading instead if the design prefers one.

#### 12. The FR-25 amendment promises that the TV shows a miss, which a TV on another device cannot do

- **Location:** `.docs/planning-artifacts/prds/prd-Toppsvar-2026-10-12/prd.md:366`, and `PRD.md` through `./scripts/sync-brief.sh`.
- **Source:** Blind Hunter.
- **What happens:** the amendment says that the Host "can make the same Reveal or miss from the Host page … and the TV page shows the result without a manual reload". Bom is not saved, so a TV on another device never shows it. AD-17, EXPERIENCE.md and the `shortcut:` comment in `TvBoard.tsx` all say so, and the new FR-27 consequence leaves Bom out on purpose. Only this sentence promises more than the code does.
- **Fix:** add "(a miss only in the same browser, since a miss is not saved)" to the FR-25 amendment, then run `./scripts/sync-brief.sh`.

#### 13. The group's decision of 2026-11-24 is not in the decision log

- **Location:** `wiki/prosjekt/beslutninger.md` on `main`. Its last play rows are dated 2026-11-23.
- **Source:** Blind Hunter. The spec triage rejected it because "the intent forbids touching wiki/".
- **What happens:** the PRD, `epics.md`, `EXPERIENCE.md` and `epic-8-context.md` all cite "the group's decision of 2026-11-24 after the pilot test": start Story 8.5 before SM-1, and amend PRD §4.7. The matching Story 8.1 decision has a row in the log (2026-11-23). `CLAUDE.md` asks for decisions to be documented in `wiki/`. Docs belong on `main`, so the intent's rule for this branch does not stop a row there. A grader following the citation finds nothing.
- **Fix:** add a 2026-11-24 row on `main`: two-page play (TV page and Host view with the answer key) started before SM-1 after the pilot test, with links to the PRD amendment and Story 8.5.

#### 14. The README's Stage 2 status does not mention the two-page mode

- **Location:** `README.md:201-203`.
- **Source:** Blind Hunter.
- **What happens:** the "Trinn 2 er startet" bullet lists only the question sets (FR-33) as done. The intro mentions the TV view and the Host view, but the status section, which a grader reads to see what is finished, does not.
- **Fix:** add one sentence: "TV-visning og vertsvisning med fasit (story 8.5) er på plass."

#### 15. Nothing warns the Host before the answer key appears on a mirrored screen (decision needed)

- **Location:** `src/app/spill/[id]/page.tsx` (the "Vertsvisning med fasit" link), `src/components/HostPlay.tsx`.
- **Source:** Blind Hunter.
- **What happens:** `/vert` shows every hidden label and Count. A laptop plugged into a TV often mirrors the screen by default. One click on "Vertsvisning med fasit" then shows the whole key to the room, and the Question is spoiled. Neither the link nor the page mentions that the TV must be an extended display. The spec's residual risks do not mention this either.
- **Options:**
  - **A:** add one line under the link on the Game page, in `body-sm` `ink-muted`: "Bruk TV-en som utvidet skjerm, ikke speilet." This is new copy, so check it against EXPERIENCE.md.
  - **B:** keep the UI as it is, and record the risk under the spec's residual risks and in the README's two-screen sentence.

#### 16. No test checks that the poll pauses while the TV is hidden (defer)

- **Location:** `src/components/TvBoard.tsx:36`.
- **Source:** Verification Gap (pre-verified, filed as `defer`).
- **What happens:** the AC4 test reports the TV as hidden, but only so that the channel is the only thing that can move it. Every assertion is positive. If the `visibilityState` check were dropped, hidden TV tabs would refresh every 2 s, and every test would still pass.
- **Why deferred:** the only harm is server load, which finding 2 already covers. Proving that nothing happens needs a timed idle window in the e2e suite.

## Dismissed

1. **The TV goes to the login page when the session ends** (Edge Case Hunter, Blind Hunter). The session is sliding, and each poll renews it, so it does not expire during play. Logging out on the laptop in the same browser is a deliberate act after the game. A quiet "logged out" stage state adds a branch for a rare case.
2. **`F` does nothing on the TV in *ready*** (Edge Case Hunter). A TV page on Team setup is reached only by typing the URL, because the links appear in *playing*. `F` works as soon as play starts.
3. **A second, duplicate TV popup when the link is clicked from an unrelated tab** (Edge Case Hunter). A named-window lookup can miss across browsing-context groups, but the result is a second working TV window. That is harmless and rare.
4. **The Design Notes' "the posting page does not refresh twice" is wrong for Team setup on `/tv`** (Edge Case Hunter, claim). This is true: `postToTv` opens a new channel object, so `TvRefresh` on the same page receives the message and refreshes once more after the action's own re-render. It only happens when the Host starts the game from the TV window itself, which is reached only by URL, and the extra refresh is invisible. The note holds for every page that has controls.
5. **The TV in *ready* shows the Host's Team setup form to the room** (Blind Hunter, Edge Case Hunter, claim). The spec's Always list says "*ready* → Team setup as on `/skjerm`" for both pages, and AC5's "no button" is about the TV view in *playing*. The spec triage rejected this already, and there is no new argument.
6. **"About 2 seconds" in the PRD is not testable, and the e2e allows 3 s** (Blind Hunter). Rejected in the spec triage: the bound is the 2 s poll plus one render, and 3 s is that bound with margin.
7. **The triage log cites intent text that is not in the committed spec** (Blind Hunter). True: the log quotes a "Tests section" and other phrases that the committed `<intent-contract>` does not contain. The fix would edit the spec under review, so by the workflow's rule it is not a finding here. It is worth knowing when a grader reads the log.
8. **The documented *ready* flow (a TV on Team setup follows the start) cannot be reached from the UI** (Blind Hunter). Rejected in the spec triage: links in *ready* are new UI that nobody asked for. `TvRefresh` costs one line and makes a reloaded TV recover.
9. **`/vert` has no breadcrumb or "Tilbake til spillet" during play** (Blind Hunter). No page under `/spill/[id]` renders a breadcrumb, so `/vert` matches the rest. `HostChrome` keeps "Mine spill", and the final standing has "Tilbake til spillet".
10. **No designed failure state for the TV** (Blind Hunter). A local error boundary was rejected in the spec triage. The one concrete failure the poll makes reachable is finding 1.
11. **Nothing proves that the answer key cannot leak Review data** (Blind Hunter). False. `readPlay` reads only `board_slot` through `review.getBoard`, plus Teams and Reveals (see "Verified clean"). A discarded Group, a Group below the cut or a raw Answer has no row in that read.
12. **`epic-8-context.md` is generated but was edited by hand** (Blind Hunter). The Story 8.1 review asked for exactly this kind of dated note in the same file. Regenerating it is a separate decision.
13. **The story is `done` while `followup_review_recommended: true`** (Blind Hunter). This review, with the ponytail review running in parallel, is that follow-up.
14. **NFR-5 timing is not extended to the TV** (Blind Hunter). The new FR-27 consequence carries its own bound (1.5 s and about 2 s), and the e2e asserts it. A manual NFR-5 row would repeat that.
15. **The final standing on `/vert` does not mark the winner** (Blind Hunter). Neither DESIGN.md nor EXPERIENCE.md asks for it. The list is sorted by Score, and the TV next to it shows "Vinner" or "Uavgjort".
16. **EXPERIENCE.md still says "Three surfaces"** (Blind Hunter). False. The TV page is the shared-screen surface and `/vert` is a Host page, so the three surfaces are unchanged.
17. **The spec's Always line still says "title = Game title"** (Acceptance Auditor). This is true, but the fix edits the spec under review. The `TRACE.md` half is finding 9.
18. **`/vert` re-renders only because Next re-renders the calling page on any `revalidatePath`** (triage). This is real and recorded under the spec's residual risks. The AC4 e2e asserts that `/vert` shows each move, so a Next upgrade that changes the behaviour would fail CI. No action now.
19. **The README's "Spillet på TV-en" paragraph lists play keys that do nothing on `/tv`** (Blind Hunter). The paragraph describes `/skjerm`, where the keys still work. The status gap is finding 14.

## Verdict

**Approve after finding 1 and the decision in finding 2.** No high findings.

- **Correct and well guarded:**
  - the TV never receives a hidden label or Count, in its markup, its RSC payload or a channel message;
  - owner checks on both pages and on `answerKey`, with one shared state switch;
  - an answer key that reads only `board_slot`;
  - a hook extraction that leaves `/skjerm` unchanged;
  - server-side stale-tab protections that hold for any mix of open pages;
  - clean channel and poll lifecycles;
  - an accessible, keyboard-complete Host view.
- **The two medium findings:**
  - the TV can end the evening on the error page, because a poll can land between the two state reads (1, a small patch);
  - a forgotten TV window keeps Neon and Vercel busy for weeks (2, a decision).
- **The low findings:**
  - six test gaps (3 to 8), each one assertion or one short step;
  - two contract mismatches on `/vert` (10, 11);
  - four documentation fixes (9, 12, 13, 14);
  - one copy decision about mirrored screens (15);
  - one deferred test (16).
- **Before the PR:** patch finding 1 and decide finding 2. Findings 3 to 14 are each a one-line change or one test step.
