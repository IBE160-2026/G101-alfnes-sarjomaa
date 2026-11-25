# Story 8.6 code review (bmad-code-review)

- **Date:** 2026-11-25
- **Scope:** `git diff origin/main...epic-8-to-skjermer`, which covers Story 8.6 (Play needs two views: host view and TV view). Six commits, from `2caf912` to `363cf0e`, on the merge base `87638b6` (the spec's `baseline_revision`).
  - 35 files changed, +1,134/-1,043. `src/components/Board.tsx` is deleted (252 lines).
  - The reviewers read the whole diff: 3,960 lines, about 309 kB. That is over the workflow's 3,000-line mark. The run was unattended, so it went ahead without splitting the diff. Almost 1,100 of those lines are the moved `tests/e2e/play.spec.ts`.
- **Mode:** `full`. The diff was checked against:
  - `spec-8-6-play-needs-two-views-host-view-and-tv-view.md`, including its review triage log, Design Notes and residual risks. This is the follow-up review that the spec recommends (`followup_review_recommended: true`). Items that the log rejected were not raised again unless there was a new argument;
  - `epic-8-context.md` and Story 8.6 in `epics.md`;
  - the PRD: FR-23 to FR-27 as amended on 2026-11-25, and §11;
  - the 2026-11-25 amendments in `EXPERIENCE.md` and `DESIGN.md`;
  - `ARCHITECTURE-SPINE.md`, with AD-15, AD-16 and AD-17 as amended, and the routes row.
- **Layers:** Blind Hunter, Edge Case Hunter, Verification Gap and Acceptance Auditor. All four completed and none failed.
- **Focus asked for by the orchestrator:**
  - that deleting the stage removed nothing that `/tv` or `/vert` still need;
  - the `/skjerm` redirect and the `/vert` redirect in *ready*: the owner check comes before the redirect, and there is no open redirect;
  - `/lag`: the same validation and state checks as before, a double submit, and a stale tab after the start;
  - the waiting `/tv`: no hidden data, it follows into play, and the 10-minute idle stop;
  - that every FR-24 to FR-27 acceptance criterion is still tested through `/vert` and `/tv`;
  - that the README and the screenshots are accurate;
  - dead code left behind.
- **Triage:**
  - Every claim was checked at the cited lines, and past the diff where needed: `src/app/spill/[id]/play-page.tsx`, `lag/page.tsx`, `skjerm/page.tsx`, `page.tsx` and `actions.ts` (`hostAction`), `src/components/TeamSetup.tsx`, `PlayView.tsx`, `TvBoard.tsx`, `usePlay.ts`, `HostPlay.tsx`, `FullscreenKey.tsx` and `RouteFocus.tsx`, `src/app/globals.css`, `tests/integration/authz.test.ts`, `tests/integration/play.test.ts`, `tests/e2e/tv.spec.ts`, `tests/e2e/play.spec.ts`, `tests/manual/checklist.md`, `epic-8-context.md`, `epics.md`, `EXPERIENCE.md` and the host-flow diagram's source.
  - All four screenshots that the README shows for play or the locked Board were opened and compared with their alt texts.
  - No OpenRouter call was made, and no `.env` file was read.
- **Test run:** not run, because two other reviewers were using the same working copy. No finding depended on a test result. The spec records the author's run: 833 passed and 1 skipped, and e2e 106 of 106 after the review fixes.
- **No fixes were applied.** No source file, story spec, `deferred-work.md` or sprint status was changed. The step-04 write-back to the story file was skipped on purpose, because this run was asked to triage and report only.

## Summary

| Severity | Count | Routing |
|---|---:|---|
| High | 0 | |
| Medium | 0 | |
| Low | 13 | 11 patch, 2 defer |
| Dismissed | 7 | see the last section |

The layers raised 23 findings, counting the two halves of the Acceptance Auditor's AC3 finding separately. Triage merged findings with the same cause into 13 entries and dismissed 7.

### Verified clean (checked in triage, not only claimed by a layer)

- **Deleting the stage removed nothing that `/tv` or `/vert` need.**
  - `BoardTiles`, `BomPanel`, `rowHeight` and `BOM_MS` moved into `TvBoard.tsx`. Nothing imports `Board`, `HOST_SHORTCUTS`, `miss`, `focusPageHeading` or `FullscreenKey` with a `className` any more.
  - The CSS the TV uses is still there: the stage tokens, `.stage-canvas`, `[data-revealing]` with its three keyframes, `.score-count` and `.bom-panel`.
  - `usePlay` still returns everything `HostPlay` reads. `clicked` now only drives a slot's pending state on the Host view (`HostPlay.tsx:97`). The TV animates new Reveals on its own, from `seen.revealing` in `TvBoard`.
  - The Host view's shortcut list no longer needs a filter, because `F` left `SHORTCUTS`. "Trykk F i TV-vinduet for fullskjerm." is still on `/vert`.
- **The `/skjerm` redirect is not an open redirect.** It builds `/spill/${encodeURIComponent(id)}` without reading the Game. The prefix is fixed and a `/` in the id is encoded, so the target can never leave `/spill/`. The Game page then does the owner check, as the spine's routes row now says. The integration test covers a real id, a random UUID and a malformed id.
- **The owner check comes before every new redirect.** `playPage` calls `ownedGame` (`requireHost` plus `games.getOwned`) before the `/lag` redirect and the `/vert`-in-*ready* redirect. So a foreign Game gets not-found and learns nothing from a redirect. Finding 1 is about the missing test for this, not the code.
- **`/lag` keeps the old validation and state checks.**
  - It renders the same `TeamSetup` with `teamNameSchema` on the client and the unchanged `play.start` on the server.
  - A double submit is stopped by `if (pending) return` and, across tabs, by `WRONG_STATE` ("Spillet har allerede startet. Gå til spillet").
  - A stale `/lag` tab after the start gets the same message. A reload of `/lag` in any state other than *ready* redirects to the Game page (integration).
  - After a lost response, `router.refresh()` makes `/lag` redirect if the start went through. Finding 12 covers the missing test.
- **The waiting `/tv` holds no hidden data.** `TvWaiting` gets only `gameId` and `title`. It calls no `play` read, so there are no Board slots, Teams or labels in its HTML or RSC payload. The integration test asserts that the whole visible text is "Hyttetur Spillet starter snart", with no form, input or button.
- **The waiting `/tv` follows into play.** `TeamSetup` posts `changed` before `router.replace`, and `TvRefresh` answers it with `router.refresh()`. The e2e reports the TV as hidden, so only the channel can move it. On another device, the 2 s poll moves it. The 10-minute rest applies (`version` is `""` and never changes). It is recorded in a `shortcut:` comment, in AD-17 and in EXPERIENCE.md. Finding 2 is about the manual check the spec says covers it.
- **The Game page matches the spec in all three states.** In *ready*, "Start spillet" links to `/lag`. In *playing*, "Vertsvisning med fasit" is primary and "Åpne TV-visning" secondary, followed by the two-window line and the mirroring warning, and there is no "Fortsett spillet". In *played*, "Åpne TV-visning" is primary. The integration test pins all three.
- **`play` is unchanged.** The only change on the server is the revalidate path in the five play actions (`"skjerm"` to `"vert"`). There is no new Route Handler, migration, table or websocket.
- **FR-24 to FR-27 are still covered through `/vert` and `/tv`.** The TRACE bullets that were spot-checked (the AC2 and AC3 e2e, Bom on the TV with the panel gone within 3 s, Angre, Neste lag, unscored Reveals, Sluttstilling with "Vinner" and "Uavgjort", and F on the waiting screen and on the TV's Sluttstilling) each match a real assertion. Only the stage's own chrome checks went: the control bar, the visible hint and the pending border. Finding 5 is the one stage check that went without a replacement.
- **The README screenshots match their alt texts.** `spill-brett.png` is the TV view at 1920×1080 with two Reveals, the ProtoQA credit and three Teams. `spill-hurtigtaster.png` is the Host view at 1280 wide with the shortcut dialog open and no `F` row. `sluttstilling.png` is the TV's Sluttstilling with "Vinner". Finding 13 is an older screenshot that this story did not touch.

## Findings

### Low

#### 1. A foreign Game in *ready* is never tested on `/lag`, `/tv` or `/vert`

- **Location:** `tests/integration/authz.test.ts:680-708`; `src/app/spill/[id]/play-page.tsx:86-93`.
- **Source:** Acceptance Auditor.
- **What happens:** the B-against-A loop over `LagPage`, `TvPage` and `HostViewPage` creates its two Games in *ready*, but starts both before it renders anything. So it only tests *playing* and *played*. *ready* is the only state where the new branches run: `/lag` renders the form, `/tv` shows the Game title, and `/vert` redirects to `/lag`. The code is correct today, because `ownedGame` runs first. But if someone moved the redirect or the waiting branch above that check, a foreign Game would leak its existence through the redirect, or its title through the waiting screen, and no test would fail. TRACE says that the not-found cases on all three pages are in `authz.test.ts`.
- **Fix:** add a third Game of A's that stays *ready* to that loop.

#### 2. Checklist row T9 has no step for the idle rest, although the spec says it does

- **Location:** `tests/manual/checklist.md:55`.
- **Source:** Blind Hunter and Acceptance Auditor.
- **What happens:** the spec's triage log says that the waiting TV's idle limit was recorded "in … checklist row T9". The Auto Run Result names T9 as where the one unverified risk gets checked on real hardware. T9 checks the extended display, `F` on the waiting screen, the start, and a second device that "follows the start and each move within about 2 s". It does not mention a waiting TV left for more than `TV_IDLE_MS` before the start. The one risk the spec calls unverified has no manual check.
- **Fix:** add to T9: "a TV on a second device left waiting more than 10 minutes before the start does not follow until it is clicked or brought to the front; then it follows within about 2 s".

#### 3. AC3's 1.5 s bound is not timed from the start

- **Location:** `tests/e2e/tv.spec.ts:81-86`.
- **Source:** Acceptance Auditor.
- **What happens:** AC3 says that the TV shows Question 1 within 1.5 s after the Host starts. After the click on "Start spillet", the test first waits for the Host's URL, then for "Spillet er i gang", then for the heading to take focus. Only then does it start the 1.5 s wait on the TV's `<h1>`. The TV could take a lot longer than 1.5 s after the click and the test would still pass.
- **Fix:** start the TV assertion right after the click, and await it together with the Host assertions (`Promise.all`).

#### 4. Test labels still use Story 8.5's AC numbers

- **Location:** `tests/e2e/tv.spec.ts:52` and `:339`.
- **Source:** Blind Hunter and Acceptance Auditor.
- **What happens:** the title at line 52 says "FR-23 to FR-27 (AC4)", which is Story 8.5's AC4. The test now proves Story 8.6's AC1 to AC3: the `/vert` redirect, the waiting screen and the start. TRACE line 339 credits it with "Story 8.6, AC2, AC3", and those labels are only in comments inside the test. The axe test at line 339 says "spec 8.6, AC6", while TRACE and `epics.md` say "Story 8.6". The spec's triage log says the labels were fixed.
- **Fix:** title line 52 "FR-23 to FR-27 (Story 8.5 AC4; Story 8.6 AC1–AC3), AD-17: …", and write "Story 8.6, AC6" at line 339.

#### 5. The check that `F` with a modifier does nothing went with the stage

- **Location:** `src/components/FullscreenKey.tsx:17-18`; `tests/e2e/tv.spec.ts:243-268`.
- **Source:** Verification Gap (pre-verified, filed as `patch`).
- **What happens:** the only test that `Control+f` does not toggle fullscreen was in the deleted stage block of `play.spec.ts` (line 147 at the baseline). Every `F` test left presses plain `f` and expects a toggle. If `if (!isShortcut(event)) return;` or the `shiftKey` check were removed, Ctrl+F (the browser's find) or Shift+F on the TV window would toggle fullscreen in front of the room, and every test would still pass.
- **Fix:** in the AC5 test on the TV page, press `Control+f` and `Shift+F` before the plain `f`, and expect `document.fullscreenElement` to stay `null`.

#### 6. Comments and one test step still describe the deleted stage

- **Location:**
  - `src/app/globals.css:196`: "Board.tsx removes it at 1.5 s". The file is deleted, and `BOM_MS` now lives in `TvBoard.tsx`.
  - `src/app/globals.css:151`: "only on the tile this tab revealed". The TV animates every new Reveal, from any tab.
  - `src/components/usePlay.ts:99` and `:111`: "no animation" and "only a tile revealed from this tab animates". On the Host view, `clicked` only drives the pending state.
  - `src/components/usePlay.ts:72` and `:74`: "or a tile again" and "a focused tile unmounted". The Host view has rows and "Avslør" buttons, not tiles.
  - `src/components/RouteFocus.tsx:15-16`: `FocusOnMount` is "for a stage that replaced the focused control (the Board and its live region …)". Its only caller now is `HostFinal`.
  - `tests/e2e/play.spec.ts:760-766`: with the shortcut dialog open on `/vert`, the test presses `f` and asserts that `document.fullscreenElement` is `null`. `/vert` has no `FullscreenKey` since this story, so the assertion can never fail.
- **Source:** Edge Case Hunter (the CSS comment), Acceptance Auditor (`usePlay` and `RouteFocus`), Verification Gap (the test step), and triage (the other CSS comment and the two `usePlay` lines).
- **What happens:** the spec's Never list says "No keeping dead code", and the Code Map says that the `usePlay` comments should name only the Host view. The next developer who reads them will look for a stage and a `Board` that no longer exist, or trust a check that tests nothing.
- **Fix:** reword the six comments for the TV page and the Host view, and drop `"f"` and the fullscreen assertion from that test step.

#### 7. `epic-8-context.md` still calls Story 8.6 "upcoming"

- **Location:** `.docs/implementation-artifacts/epic-8-context.md:7`.
- **Source:** Blind Hunter.
- **What happens:** the triage log says this was fixed, and the "Routes today (after 8.6)" bullet was rewritten. But the Goal paragraph still says "Upcoming Story 8.6 makes the two views the only way to play", while the Stories list and `sprint-status.yaml` say 8.6 is done. The "What 8.6 changed" bullet is marked as history, so its plan wording ("must move", "the 8.6 spec decides") is fine.
- **Fix:** change "Upcoming Story 8.6 makes" to "Story 8.6 made".

#### 8. Two places in `EXPERIENCE.md` and `epics.md` were missed by the amendment sweep

- **Location:**
  - `EXPERIENCE.md:53`: the Game page's state table gives *played* the primary action "—". The code now renders "Åpne TV-visning" as `PRIMARY_LINK`, and the Played row further down in the same file says so.
  - `epics.md:1135-1137`: Story 6.1's AC still sends the Host to `/spill/[id]/skjerm`, where "Start spillet" opens the play view, and *playing* offers "Fortsett spillet".
  - `epics.md:1555`: Story 8.5's AC still requires the link "Fortsett spillet".
- **Source:** Blind Hunter.
- **What happens:** every other old reference in these two files got a dated 2026-11-25 note. These three describe a route and a link that are now gone, with no note. A grader who reads Story 6.1 or the state table finds the old flow, and nothing points to Story 8.6.
- **Fix:** a short dated note at each place. For example, in the state table: "*Amended 2026-11-25 (Story 8.6):* 'Åpne TV-visning'". In Story 6.1 and Story 8.5: "*Amended 2026-11-25 (Story 8.6):* replaced by `/spill/[id]/lag` and the two-page play".

#### 9. The README does not say what a second device needs

- **Location:** `README.md:10-12` and `:27-32`.
- **Source:** Blind Hunter. Edge Case Hunter's Bom finding (dismissed as item 7) points to the same gap.
- **What happens:** the README now says that play needs "to vinduer … eller to enheter". The PRD, AD-17 and EXPERIENCE.md all give three conditions for the second device that the README leaves out:
  - the TV device must be signed in as the Host;
  - it never shows Bom, because a miss is not saved;
  - it stops following after 10 minutes without a move, until someone wakes it.

  A grader who tries a phone or a second laptop will meet all three with no warning. Before this story, there was a one-screen mode, so the second device was optional. Now it is one of only two ways to play.
- **Fix:** add one sentence to the "Spillet på TV-en" paragraph: "På en annen enhet må du være logget inn som verten. Der vises ikke bom, og TV-en hviler etter ti minutter uten trekk til noen klikker på den."

#### 10. The host-flow diagram still says "én skjerm"

- **Location:** `docs-assets/diagrammer/vertsflyt.excalidraw` and `vertsflyt.png` (the label "2–4 lag, én skjerm" on the step from *ready* to *playing*), shown in the README under "Vertsflyt".
- **Source:** Blind Hunter.
- **What happens:** the spec leaves this on purpose under its residual risks, because the room still watches one screen. That holds for "felles skjerm" on *playing*, and for the landing page (dismissed as item 3). It does not hold for this label. It sits on the Host's own step into play, which now goes through `/lag` and needs two windows, and the README says "Spillet trenger to vinduer" a few lines above it.
- **Fix:** change the label to "2–4 lag, to vinduer" in the `.excalidraw` source, and export the PNG again.

#### 11. Checklist rows T7 and T8 do not say which window to time

- **Location:** `tests/manual/checklist.md:53-54`.
- **Source:** Blind Hunter.
- **What happens:** T6 now says "On the Host view". T7 times Bom, which shows its panel only on a TV page in the same browser, and the Host view only gives a status line. T8 times "Vis sluttstilling" to "Sluttstilling", which now appears on both `/vert` and `/tv`. The person running the check has to guess, and two runs can measure different things.
- **Fix:** start both rows with "On the Host view", as T6 does, and say in T7 that Bom is timed on the TV window in the same browser.

#### 12. A lost response after a start that went through is not tested (defer)

- **Location:** `src/components/TeamSetup.tsx:101`; `tests/e2e/play.spec.ts` ("An aborted start").
- **Source:** Verification Gap (pre-verified, filed as `defer`).
- **What happens:** when the start request reaches the server but its response is lost, `router.refresh()` should make `/lag` redirect to the Game page. The e2e aborts the request before it reaches the server, so the Game stays *ready*, and only the not-started half runs. If `if (!result) router.refresh();` were removed, the Host would be left on `/lag` with "Mistet forbindelsen." while play is running, and every test would still pass.
- **Why deferred:** the path is rare. The old stage version was not tested either, and the server half (the redirect of `/lag` in *playing*) is pinned by an integration test. Close it if the start flow is touched again: forward the POST with `route.fetch()`, then abort the response, and expect "Spillet er i gang".

#### 13. The "Brettet er låst" screenshot has no "Start spillet" (defer)

- **Location:** `docs-assets/skjermbilder/brett-last.png`, in the README's screenshot table.
- **Source:** Acceptance Auditor.
- **What happens:** the image shows the *ready* Game page with only "Last ned bruksrapport" and "Slett spillet". The page has rendered "Start spillet" since Epic 6. The README now leads the reader from "«Start spillet» åpner lagoppsettet" to a table where the locked-Board image lacks that button.
- **Why deferred:** the image is older than this story and this diff did not touch it. It is worth a new screenshot the next time the README images are taken.

## Dismissed

1. **The spec's counts do not match its own triage log** (Blind Hunter). This is true. The verdict line says "12 patched, 11 rejected", but the log has 11 `[patch]` and 12 `[reject]` entries. The Auto Run Result says "2 entries at medium" against 3 in the log. The Tasks say "two screenshots" where three were changed. The fix would edit the spec under review, so by the workflow's rule it is not a finding here. It is worth knowing when a grader reads the log.
2. **EXPERIENCE.md's route table keeps the old flow in its description column** (Blind Hunter). The project amends planning documents with dated notes and keeps the old text as history, as Story 8.5 did in the same rows. The notes on the `/tv` and `/vert` rows give the new behaviour.
3. **The landing page still says "spill topplista sammen på én skjerm"** (Blind Hunter). The room still watches one shared screen, the TV. The spec triage rejected the same claim about PRD §1 and DESIGN.md. The diagram label on the Host's own step is different, and is finding 10.
4. **`/lag` has no breadcrumb or link back to the Game page** (Blind Hunter). Team setup never had one: on `/skjerm` it was the same form without a breadcrumb. The Story 8.5 review dismissed the same point for `/vert`. The top bar keeps "Mine spill", and neither the spec nor EXPERIENCE.md asks for more.
5. **Nothing tracks the follow-up review** (Blind Hunter). This review, with the ponytail review that runs in parallel, is that follow-up.
6. **`BOM_MS` is not in `src/lib/limits.ts`** (Blind Hunter). It is the length of a CSS animation, tied to the `bom` keyframes, not a limit from PRD §11 or a poll interval. It sat in `usePlay.ts` before this story and only moved with the panel.
7. **No screen shows Bom when the TV is on another device** (Edge Case Hunter). This is a recorded and accepted shortcut from Story 8.5: the FR-25 amendment, AD-17 and a `shortcut:` comment in `TvBoard.tsx` all say that a miss is not saved. Story 8.6 does not change it, and the Host view's status line says "Bom.". The part that 8.6 does make worse, that a second device is now one of only two ways to play, is the README gap in finding 9.

## Verdict

**Approve.** No high or medium findings.

- **Correct and well guarded:**
  - the stage is gone without taking anything the TV page or the Host view use;
  - the `/skjerm` redirect is a fixed same-site path, and every other new redirect comes after the owner check;
  - `/lag` keeps the form, its validation and the server's state check, so a double submit or a stale tab gets "Spillet har allerede startet";
  - the waiting TV carries only the Game title and follows into play over the channel or the poll;
  - `play` is unchanged apart from the revalidate path;
  - the README and its three new screenshots are accurate.
- **The low findings:**
  - five test gaps (1, 3, 4, 5, and the deferred 12), each one Game in a fixture, one `Promise.all`, a title, or one key press;
  - one cleanup of six stale comments and a test step that checks nothing (6);
  - five documentation fixes (2, 7, 8, 9, 11);
  - one diagram label (10);
  - one older screenshot (13, deferred).
- **Before the PR:** patch findings 1, 2, 3 and 5. Each of them closes a gap between what the spec or TRACE says is checked and what is actually checked. Findings 4 and 6 to 11 are one-line changes each.

## Fixes

Fix round on 2026-11-25, on `epic-8-to-skjermer`. Every finding was checked against the code before it was changed. None was rejected.

| # | Finding | Result | Commit |
|---|---|---|---|
| 1 | Foreign Game in *ready* on `/lag`, `/tv` and `/vert` | Fixed. The B-against-A loop in `authz.test.ts` has a third Game of A's that stays *ready*, and TRACE says so. | `3820a66` |
| 2 | T9 has no idle-rest step | Fixed. T9 now checks that a TV on a second device left waiting more than 10 minutes does not follow until it is clicked or brought to the front, and then follows within about 2 s. | `8ba1865` |
| 3 | AC3's 1.5 s not timed from the start | Fixed. The TV assertion starts right after the click on "Start spillet" and runs in `Promise.all` with the Host's own assertions. | `3820a66` |
| 4 | Test labels use Story 8.5's AC numbers | Fixed. The first `tv.spec.ts` test says "Story 8.5 AC4; Story 8.6 AC1–AC3", and the comments and the axe test say "Story 8.6". | `3820a66` |
| 5 | No check that F with a modifier does nothing | Fixed. The AC5 test on the TV page presses `Control+f` and `Shift+F` first and expects `document.fullscreenElement` to stay `null`. | `3820a66` |
| 6 | Stale stage comments and a check that cannot fail | Fixed. The comments in `globals.css`, `usePlay.ts` and `RouteFocus.tsx` now name `TvBoard.tsx`, the Host view and the pending Avslør button. The `f` press and the fullscreen assertion in the shortcut-dialog step of `play.spec.ts` are gone. | `8f58a3b`, `3820a66` |
| 7 | `epic-8-context.md` says "Upcoming Story 8.6" | Fixed: "Story 8.6 made". | `8ba1865` |
| 8 | Missed places in `EXPERIENCE.md` and `epics.md` | Fixed with dated notes: the *played* row in the Game page's state table, Story 6.1 AC2 and Story 8.5 AC7. | `8ba1865` |
| 9 | README does not say what a second device needs | Fixed. A short `<details>` block under "Spillet på TV-en" says that the device must be signed in as the Host, never shows Bom, and rests after ten minutes without a move. | `8ba1865` |
| 10 | Host-flow diagram says "én skjerm" | Fixed. The label reads "2–4 lag, to vinduer", and `vertsflyt.excalidraw` and `vertsflyt.png` were generated again. | `15a814e` |
| 11 | T7 and T8 do not say which window to time | Fixed. Both start with "On the Host view", and T7 says that Bom is timed on the TV window in the same browser. | `8ba1865` |
| 12 | Lost response after a start that went through | Deferred, as the review recommends. | |
| 13 | "Brettet er låst" screenshot without "Start spillet" | Deferred, as the review recommends. `lagoppsett.png` also predates the new breadcrumb on `/lag` and can be retaken in the same pass. | |

Dismissed item 4 (no breadcrumb on `/lag`) was overruled by the impeccable audit's S1, and `/lag` now has the breadcrumb (`c9f1c4b`).

While the e2e tests were being checked, one more problem turned up. The Bom/Angre test in `play.spec.ts` sometimes pressed rank keys right after a reload, before the Host view had hydrated. It now waits for hydration first (`c5f59f8`).

Gates after the last commit: lint, typecheck and `npx prettier --check .` are clean. `npm run test` gives 833 passed and 1 skipped, and `npm run test:e2e` gives 106 of 106.
