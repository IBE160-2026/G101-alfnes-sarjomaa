# Epic 2 code review (bmad-code-review)

- **Date:** 2026-11-22
- **Scope:** `git diff epic-1-fundament..epic-2-innsamling`, stories 2.1 to 2.7 (74 files, +9,297/-72). The reviewers read the source diff: `src/`, `drizzle/*.sql`, `next.config.ts` and `eslint.config.mjs`, 3,004 lines. The Verification Gap layer also read `tests/`, which brings the total to 7,288 lines. Docs and `drizzle/meta` were left out.
- **Mode:** `full`. The diff was checked against `epics.md` (Epic 2), `spec-2-1` to `spec-2-7`, `epic-2-context.md`, `ARCHITECTURE-SPINE.md` (AD-7 and AD-8 as amended) and PRD FR-5 to FR-14.
- **Layers:**
  - The four standard layers: Blind Hunter, Edge Case Hunter, Verification Gap and Acceptance Auditor.
  - A fifth focused layer for this epic, which examined anonymity end to end, races between stories, authorization on every new server action, Participant data loss, and the two known open items.
  - All five layers completed and none failed.
- **Triage:**
  - Every claim was checked against the code at the cited lines.
  - Items that a per-story review had already rejected were dismissed unless a reviewer brought a new argument.
  - The HIGH finding was confirmed in `node_modules/next` (16.4.6).
- **Test run:** `npm run test` passed 29 files and 389 tests in 8.4 s.
- **No fixes were applied.** No source file, story spec or sprint status was changed.

## Summary

| Severity | Count | Routing |
|---|---:|---|
| High | 1 | patch |
| Medium | 1 | decision needed |
| Low | 6 | 3 patch, 3 defer |
| Dismissed | 24 | see the last section |

The HIGH finding breaks FR-11 and FR-12 on the path the README tells people to use (`npm run dev`), and no test can catch it. Once it is fixed, no other finding breaks an acceptance criterion.

These areas came out clean (verified in triage, not only claimed by a layer):

- **Token handling.** Tokens come from 32 bytes of `randomBytes`, and only `sha256(token)` is stored.
  - The Token travels only in the URL fragment and in the Server Action POST body.
  - `/svar/*` sends `Referrer-Policy: no-referrer`.
  - The server shell knows only the `gameId`, and renders no title, no Question and no Open Graph tags.
  - `withBoundary` and `log()` write only module, op, code and SQLSTATE.
- **Schema.** `invite_link` and `submission` have no timestamp, serial or ordinal column.
  - `submit` locks the Game without a `hostId`, so `game.updated_at` never moves on a Participant action.
  - The Host only ever receives `{ active, issued, submissions | "fewer-than-3" }`. The exact count below three never leaves `progress()`.
- **Identical responses.** `revokeInviteLink` answers the same whether or not the link had an Answer set. `openInviteLink` returns the same shape for a missing, wrong or malformed edit secret.
- **Authorization.**
  - `createInviteLinks` and `revokeInviteLink` both call `requireHost` and then `lockForMutation(hostId)`. The order is owner, state, cap, then link, so a foreign Host always gets `NOT_FOUND`.
  - The question actions use the same lock under `PERMITTED.editQuestions`.
  - The Participant actions read no session. They validate the `gameId` as a UUID and check the Token and the secret against `TOKEN_PATTERN`.
  - `submit` re-validates answers against the Question IDs stored on the server.
- **Races.**
  - `submit`, `revokeInviteLink` and `deleteGame` all take the Game row `FOR UPDATE`.
  - `submit` re-checks both the state and the link under that lock, and a revoke cascades any submission that committed before it.
  - The cap is reserved atomically (`UPDATE … WHERE issued + n <= 50`), and a double submit is an idempotent upsert.
- **Links shown once.**
  - The section `key="links"` keeps `InviteLinkPanel` state across the change from draft to collecting.
  - `CollectingRefresh` skips its refresh while any `[data-link]` is on screen.
  - Links come only from an action's return value, never from the RSC tree.
- **Participant data.** The draft is saved and the edit secret written before the submit call is made, so a response lost after commit still leaves the matching secret on the device.

## Findings

### High

#### H1. The dev server prints every Token and edit secret to the terminal (patch)

- **Source:** the focused anonymity layer, confirmed by the orchestrator.
- **Location:** `next.config.ts:3-16`, which has no `logging` key. The leaked arguments come from `src/app/svar/[gameId]/actions.ts:7-36` and `src/app/spill/[id]/actions.ts:83-97`. `README.md:58` tells readers to run `npm run dev`.
- **Evidence:**
  - In Next 16.4.6, `logging.serverFunctions` defaults to `true` (`node_modules/next/dist/server/config-shared.js:135-137`).
  - In development, `action-handler.js:794` records every Server Function call.
  - `dev/log-requests.js:47-50` then writes `ƒ name(args)` to **stdout**, with arguments stringified to depth 2 and breadth 3 (`dev/server-action-logger.js`).
  - As a result, `openInviteLink(gameId, "<token>", "<editSecret>")` prints both secrets in full.
  - `submitAnswerSet(gameId, "<token>", { answers: …, editSecret: "…" })` prints the Token and the edit secret. The answer arrays show only as `[Array]`.
- **Failure scenario:**
  1. The Host runs the app with `npm run dev` on their own laptop at the party, as the README says.
  2. Every time a guest opens or submits, the terminal shows a timestamped line with that link's Token and edit secret.
  3. The Host knows which link went to whom, so the log already tells them *who answered and when*. That breaks FR-12, and FR-11's rule that logs never hold a Token.
  4. The Host then writes `{ token, editSecret }` into localStorage under `toppsvar:<gameId>:<token[0..16]>` and opens the link. `openInviteLink` returns that guest's saved answers before close, which also breaks FR-7 (as amended) and AD-8.
- **Why no test catches it:**
  - The integration tests call module functions directly.
  - The log-leak assertions read `stderr`, but Next writes this log to `stdout`.
  - Playwright runs `next build && next start`, and this logging is dev-only.
- **Fix:** add `logging: { serverFunctions: false }` to `next.config.ts`.
  - Add a unit test that imports the config and asserts the setting, so a later edit cannot silently remove it.
  - Optionally add a line to `tests/manual/checklist.md`: "run `npm run dev`, submit an answer set, and grep the terminal for the Token".
  - `incomingRequests` can stay on, since request URLs never carry the Token. Turning it off for `/svar` would also hide the per-submit `POST /svar/<gameId>` timestamps, which is optional hardening.

### Medium

#### M1. Links shown once are lost on any in-app navigation, and lost links can never be revoked (decision needed; known open item a)

- **Source:** the focused anonymity layer, plus the orchestrator's own reading.
- **Location:** `src/components/OnceLinkList.tsx:29-41`, which has the `shortcut:` comment. The escape routes are `src/components/HostChrome.tsx:28` (logo), `:35` ("Mine spill" `NavLink`), the log-out form, the breadcrumb `Link` at `src/app/spill/[id]/page.tsx:125`, and browser Back.
- **Failure scenario:**
  1. The Host creates 20 links, then clicks the breadcrumb or "Mine spill" before copying them.
  2. Next navigates on the client, so `beforeunload` never fires and the links are gone.
  3. They remain active rows. Each one uses a slot under the cap of 50 and adds to the "av N" denominator, so progress can never read "N av N".
  4. They also cannot be revoked, because `revokeInviteLink` needs the pasted link text (FR-9). Collection then runs with permanent ghost links, and the Host's only recourse is to create more links while the cap allows.
- **New argument against the Story 2.2 rejection:** Story 2.2 rejected this because AC4 asks only for the browser's leave-page warning. That rejection predates Story 2.7. It did not weigh that a lost link is unrecoverable: it cannot be revoked and it inflates the denominator for the rest of Collection.
- **Why decision needed:** the cheap fix needs either a new fixed Norwegian string or a decision to reuse an existing one. EXPERIENCE.md owns the copy.
- **Fix options:**
  - **(a) Intercept clicks and submits.** While the list is mounted, add capture-phase `click` and `submit` listeners on `document`. On a click inside `a[href]`, or on a form submit, call `confirm(<copy>)` and `preventDefault()` on cancel. Next's `Link` honours `defaultPrevented`. This is about 10 lines in the existing effect, and the current `shortcut:` comment stays for Back/forward (popstate cannot be cancelled).
  - **(b) Keep the current behaviour** and record the consequence (ghost links that cannot be revoked) in the residual risks and the README.

### Low (patch)

#### L1. The in-transaction race guards in `submit` have no test

- **Source:** verification-gap.
- **Location:** `src/server/collection/index.ts:245-259`. These are the `NOT_FOUND → LINK_UNKNOWN` and `WRONG_STATE → COLLECTION_CLOSED` mapping and the `linkExists(tx, …)` re-check under the lock.
- **Verified:** the code is correct when read; the gap is in the tests. Every submit test in `tests/integration/collection.test.ts:321-610` is refused earlier, in `resolveLink`. Delete the re-check or the mapping, and every test still passes.
- **What would ship if a guard is removed:**
  - **Re-check removed:** a submit racing a revoke hits the `submission → invite_link` foreign key and returns `INTERNAL`.
  - **Mapping removed:** a submit racing a delete shows the Host's copy "Vi finner ikke dette spillet." to the Participant.
- **New argument against the Story 2.4 deferral:** Story 3.1's close deletes every link. This mapping is the only thing that keeps a submit racing a close saying "closed" rather than "unknown" or "internal".
- **Fix:** partially mock `@/server/questions` so that `ofGame` runs a hook once. `ofGame` is called between `resolveLink` and the transaction, at line 242. In three cases, the hook should:
  - revoke the link, and the test asserts `LINK_UNKNOWN`;
  - delete the Game, and the test asserts `LINK_UNKNOWN`;
  - set the state to `grouping`, and the test asserts `COLLECTION_CLOSED`.

  Each case should also assert that no `submission` row exists. Land this before Story 3.1.

#### L2. Comments claim the 30 s refresh "coarsens timing", which is not true

- **Source:** the focused anonymity layer.
- **Location:** `src/server/collection/index.ts:118-120`, `src/components/ProgressCount.tsx:1-2`.
- **Failure scenario:** the Host can reload the Game page at any moment and get the exact count, so the refresh interval gives no timing protection above three. FR-8 requires only the floor below three, so the code is fine. The problem is that Epic 7's README has to list the anonymity limits truthfully, and these comments are its most likely source.
- **Fix:** reword both comments. The floor hides arrivals below three. Above three, the count is exact whenever the Host reloads, which FR-8 accepts.

#### L3. The two default answer fields are defined in two places

- **Source:** acceptance-auditor.
- **Location:** `src/components/AnswerForm.tsx:43` (`DEFAULT_FIELDS = 2`, used at `:411`) and `src/lib/answer-set.ts:73` (`[...given, "", ""]…Math.max(2, …)`).
- **Failure scenario:** someone changes one of the two values. `toFields` then pads to a different count than the one the form treats as fixed (the fields without "Fjern"). This breaks the epic-2-context rule "limits live only in `src/lib/limits.ts`".
- **Fix:** add `ANSWER_FIELDS_DEFAULT = 2` to `limits.ts` and use it in both places.

### Low (defer)

#### L4. The stale-tab refresh branches in the link panels are not exercised end to end

- **Source:** verification-gap.
- **Location:**
  - `src/components/RevokeLinkPanel.tsx:16,44,66`, which refreshes on `WRONG_STATE`, `NOT_FOUND` and `LINK_CAP_REACHED` and falls back to the cap sentence for focus;
  - `src/components/InviteLinkPanel.tsx:15-20,85`, for `QUESTIONS_REQUIRED` and `NOT_FOUND`.
- **Gap:** the server side of each code is covered in integration tests, but the client reaction is not. Removing a code from either `REFRESH_ON` set fails no test.
- **Why defer:** these are rare recovery paths for a stale tab, and the server already refuses correctly. If time allows, add one two-tab case to `revoke.spec.ts` that mirrors `invite-links.spec.ts:221`.

#### L5. Submitting through a link the Host holds shows whether it was used, and replaces the Participant's set, but nothing records this

- **Source:** acceptance-auditor + the focused anonymity layer.
- **Location:** `src/server/collection/index.ts:261-267` (the upsert without the old secret, as AD-8 and FR-7 specify) and `:141-142` (the exact count from three).
- **Failure scenario:**
  1. The count reads 5, and the Host submits junk through a link they kept.
  2. On reload, 6 means that guest had not answered. 5 means they had, and their set has now been silently replaced: their phone shows an empty form, because the secret no longer matches.
- **Assessment:** this is the same participation leak that PRD FR-9 accepts for revoke, and it reveals no answer content. PRD §1.1 mentions "a Host who answers through links they keep", but not the probe or the overwrite.
- **Why defer:** the fix is documentation. Add a line next to FR-9's note, and in the Epic 7 README's list of anonymity limits. No code change is needed.

#### L6. The physical row order of `submission` and `invite_link` follows write order (forward note for Epic 3)

- **Source:** the orchestrator's own reading.
- **Location:** `drizzle/0004_medical_nebula.sql`, `drizzle/0005_shallow_dakota_north.sql`, `src/server/collection/index.ts:56-58,261-267`.
- **Detail:** neither table has a time column, but a `SELECT` without `ORDER BY`, or a `pg_dump`, returns rows in heap order.
  - That is issue order for links. The Host knows link 1 went to the first guest.
  - It is roughly last-write order for Answer sets.
  - Before close this is covered by PRD §1.1, which accepts that someone with database access can correlate before close.
- **Risk:** Story 3.1/3.2 copies Answer sets out before AD-9 deletes the links. If that copy runs in heap order, the SM-3 dump taken after the Board is confirmed preserves arrival order, which breaks FR-12 and FR-13.
- **What to do in Epic 3:** have the close copy rows in a random or content-defined order (for example `ORDER BY random()` or a sort on the content). Make Story 3.2's anonymity audit check row order as well as columns.

## Dismissed findings

Each line gives the source layer, then the verdict and the reason.

1. *Blind Hunter*: the count drops after revoking a used link. **False.** PRD FR-9 accepts this explicitly, and Stories 2.6 and 2.7 rejected it with no new argument since.
2. *Blind Hunter*: a blur save racing "Åpne innsamlingen", and the first click on a disabled "Lag lenker". **Low.** Story 2.2 rejected both, and Next queues Server Actions from one client one after another, so the save lands first.
3. *Blind Hunter*: a deleted draft flashes back, and a failed `removeQuestion` is ignored. **Low.** This is a recorded residual risk in Story 2.1, and it needs a failure inside a sub-second window.
4. *Blind Hunter*: an empty revoke field shows `LINK_NOT_ACTIVE`. **Rejected.** Spec 2.7 prescribes exactly this (line 41), so the fix would mean editing the spec.
5. *Blind Hunter*: there is no index on `invite_link.game_id`. **Low.** Story 2.2 rejected it: at most 50 rows per Game, deleted at close.
6. *Blind Hunter*: limits are written into message strings. **Low.** This is the project convention, rejected in Stories 2.1 and 2.2.
7. *Blind Hunter*: the `/svar` lint zone lists files by hand. **Low.** No harm shown: the shared components import nothing from `@/server/auth`, and `server-only` already stops server code at build time.
8. *Blind Hunter*: the question textarea has no `maxLength`. **False.** Spec 2.1 deliberately lets 201 characters through to the field error, and e2e (b) tests that.
9. *Blind Hunter*: three action wrappers are duplicated. **Low.** It is a style point, and Story 2.2 rejected the cast.
10. *Blind Hunter*: repeated owner lookups and sequential queries on the Game page. **Low.** At pilot scale the cost is negligible, and no user would notice.
11. *Blind Hunter*: a hidden tab keeps polling. **Low.** Story 2.6 rejected it.
12. *Blind Hunter*: up to 500 ms of draft typing is lost on reload or `hashchange`. **Low.** Story 2.5 rejected it.
13. *Blind Hunter*: gaps in the error summary (heading wording, field errors not tied to a question, a non-DomainError rethrown). **Low.** Story 2.4 rejected these: they are reachable only by a hand-crafted request.
14. *Edge Case Hunter*: "færre enn 3 av 2 svar mottatt". **Low.** The copy is fixed by UX-DR6, and Story 2.6 rejected it.
15. *Edge Case Hunter*: a *draft* Game's link says "closed". **False.** This is the spec 2.3 design: the state is checked before the Token, and *draft* counts as not collecting.
16. *Edge Case Hunter*: clearing a saved Question shows an empty field while the server keeps the old text. **Rejected.** Spec 2.1 says empty Questions are never sent, so the fix would mean editing the spec.
17. *Edge Case Hunter*: clicking an invalid trigger twice sets the same error and leaves focus on the trigger. **Low.** It is rare, and a keyboard user lands in the field after the first press.
18. *Edge Case Hunter*: the `InviteLinkPanel` notice unmounts on a refresh. **Low.** Story 2.2 rejected it as a rare two-tab case, and the message stays visible.
19. *Edge Case Hunter*: focus is lost after a cap refresh in `RevokeLinkPanel`. **Maybe false, low at most.** It depends on whether the state update after `await` commits before the refresh. Settling it needs a two-tab e2e (see L4), which would only confirm a low finding, so it is rejected.
20. *Acceptance Auditor*: the loading and failure states on the link page have no `<h1>`. **Low.** Spec 2.3 defines those states without one, and a fix needs new heading copy.
21. *Acceptance Auditor*: some WRONG_STATE cases live in `collection.test.ts`, not `game-state.test.ts`. **Low.** The behaviour is fully tested; only the location breaks the convention.
22. *Focused layer*: a network drop after commit loses a replacement or new link (known open item b). **Low.** It needs a lost response inside a sub-second window, and recovery exists: "Flere lenker" plus the refreshed "N av maks 50". Story 2.7 rejected it. A cheap mitigation, if wanted later, is copy only: on a network failure, say that the link may have been revoked and how to make a new one.
23. *Focused layer*: a revoke while a guest is typing clears their draft on the next submit. **Low.** Spec 2.3 and 2.4 require `LinkStatus` to clear on unknown, and a Host revokes only links they believe are lost.
24. *Focused layer*: on a shared device the edit secret stays in that browser. **Already deferred.** Story 2.5 deferred the README line on exposure on a shared phone. FR-7 accepts "same device".

## Epic 2 review fixes (2026-11-22)

Fixes landed on `epic-2-innsamling` in commits `5e60949`, `55989b3`, `36b30cf` and `24c2ea9` (with UI audit fixes in `2e08f43`). After the last commit, `npm run test` passes 387 tests and `npm run test:e2e` passes 81.

- **H1, fixed** (`5e60949`). `next.config.ts` now sets `logging: { serverFunctions: false, browserToTerminal: false }`, with a comment that cites FR-11 and FR-12. `tests/unit/next-config.test.ts` fails if either setting is removed. The check of other logging paths found one more leak: Next 16 forwards browser console warnings and errors to the dev terminal by default (`browserDebugInfoInTerminal: 'warn'`). On a party LAN, that means a guest's browser console would print in the Host's terminal, so it is now off too. Nothing else needed a change:
  - `incomingRequests` logs only URL paths, and the Token is in the fragment, which never reaches the server.
  - The server makes no `fetch` calls, so fetch logging has nothing to print.
  - `log()` still writes only module, op, code and sqlstate.
  - The dev error overlay shows only in the browser that hit the error.
  - `next start` never logs Server Function calls.
- **M1, fixed with option (a)** (`55989b3`). While `OnceLinkList` is mounted, a capture-phase `click` listener on same-origin links and a `submit` listener on forms ask with `window.confirm("Lenkene vises ikke igjen. Vil du gå videre uten å ha kopiert dem?")`. Cancel keeps the page and the links. EXPERIENCE.md has no beforeunload copy of its own, so this is the orchestrator's sentence.
  - In-page anchors and modified clicks such as Ctrl-click are not intercepted, and when both panels show a list, the Host is asked only once per click.
  - The listeners go away when "Jeg har kopiert lenkene" unmounts the list.
  - Browser Back and Forward inside the app are still uncovered, because popstate cannot be cancelled. A `shortcut:` comment records this.
  - The e2e test in `invite-links.spec.ts` clicks "Mine spill" with links on screen, dismisses the confirm, and checks that the same links are still there.
- **L1, fixed** (`36b30cf`). `collection.test.ts` partially mocks `@/server/questions`, so a hook runs once after `ofGame`, between submit's lookup and its transaction. Three cases cover a revoked link (`LINK_UNKNOWN`), a deleted Game (`LINK_UNKNOWN`) and a Game moved to _grouping_ (`COLLECTION_CLOSED`), each with no `submission` row. Removing either the mapping or the re-check under the lock makes all three fail; this was checked.
- **L2, fixed** (`36b30cf`). The comments in `collection/index.ts` and `ProgressCount.tsx` now say that the floor hides arrivals below three, and that above three the count is exact on any reload, which FR-8 accepts.
- **L3, fixed** (`36b30cf`). `ANSWER_FIELDS_DEFAULT = 2` now lives in `limits.ts`, and both `AnswerForm.tsx` and `toFields` use it.
- **L4, deferred, unchanged.** The stale-tab refresh branches in the link panels still have no e2e test.
- **L5, deferred, unchanged.** The probe and overwrite through a link the Host keeps is a documentation item for the PRD note on FR-9 and the Epic 7 README.
- **L6, deferred, unchanged.** The physical row order of `submission` and `invite_link` is a forward note for Stories 3.1 and 3.2 (copy in random or content order, and audit row order).
