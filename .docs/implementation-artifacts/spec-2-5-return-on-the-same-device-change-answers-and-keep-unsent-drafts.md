---
title: 'Story 2.5: Return on the same device, change Answers, and keep unsent drafts'
type: 'feature'
created: '2026-11-22'
baseline_revision: '982e813e3a6dc1a1a3caa483dee2dabc538a0593'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/.docs/implementation-artifacts/epic-2-context.md'
  - '{project-root}/.docs/implementation-artifacts/spec-2-4-answer-form-and-first-submission.md'
  - '{project-root}/.docs/planning-artifacts/ux-designs/ux-Toppsvar-2026-11-21/DESIGN.md'
  - '{project-root}/.claude/skills/impeccable/reference/craft-floor.md'
warnings: [oversized]
deferred:
  - summary: >-
      The README does not yet say that someone else using the same phone can read an unsent draft.
    evidence: |-
      EXPERIENCE.md (PRD section 10 item 5) says the README's anonymity section should mention the shared-phone draft exposure. The README has no anonymity section yet; Story 7.4 owns the README limits (FR-14 Pending). Add one sentence there.
    location: >-
      README.md
    severity: low
---

<intent-contract>

## Intent

**Problem:** After a submit, reopening the link shows an empty form, and a reload before submitting loses everything typed (FR-7, UX-DR20). The server already replaces the link's single `submission` row (2.4), but nothing reads it back, and nothing keeps a draft.

**Approach:** `openInviteLink` takes an optional edit secret and returns the saved set only when `sha256(editSecret)` matches the row; otherwise its response is byte-for-byte what an unused link gets. The browser sends its stored secret when it opens the link, pre-fills from the saved set, and keeps an unsent draft in the same per-link `localStorage` value, debounced 500 ms. The draft never leaves the device before submit. The four ACs of Story 2.5 in `epics.md` (repeated below) are the contract. AD-8 governs.

## Boundaries & Constraints

**Always:**
- The implementer first invokes `ponytail` (level `full`), then `impeccable` (no launcher: "Launcher unavailable" path; read `reference/craft-floor.md` right before UI edits). *Operate* mode, phone at 360 px. DESIGN.md and EXPERIENCE.md win on conflict. Every Norwegian string below is fixed copy: use it verbatim. Ponytail never cuts a requirement, validation, anonymity, accessibility or a test listed here.
- **Server read** (`src/server/collection/index.ts`): `openInviteLink(gameId: unknown, token: unknown, editSecret?: unknown)`. After `resolveLink` (unchanged order and errors), if `editSecret` is a string matching `TOKEN_PATTERN`, select `submission.answers` where `token_hash = link.tokenHash AND edit_secret_hash = sha256(editSecret)`. On a hit return `{ title, questions, answers }`; on a miss, no secret, or a malformed secret return exactly `{ title, questions }` (no `answers` key), so the existing `toEqual` tests stay green and a wrong secret is indistinguishable from an unused link (AC1, FR-12). Still a read: no lock, no write. The action in `src/app/svar/[gameId]/actions.ts` gains the same third parameter and passes it through.
- **Link store** (`src/lib/invite-link.ts`): `LinkStore` becomes `{ token: string; editSecret?: string; draft?: Record<string, string[]> }`. `draft` is the raw field values per Question ID, in field order, blanks included. No other change to the store functions.
- **Pure helper** (`src/lib/answer-set.ts`): `toFields(set: unknown, questionIds: readonly string[]): Record<string, string[]>`. For each Question ID: the entry's string values if it is an array (non-strings dropped, at most `ANSWERS_PER_QUESTION_MAX`), padded with `""` to at least 2 fields; anything else gives `["", ""]`. Keys not in `questionIds` are dropped; a non-object gives all-empty fields. It turns both the server's saved set and an untrusted stored draft into form state.
- **`InviteLinkView`**: `fetchView` sends `readLinkStore(gameId, token)?.editSecret` as the third argument and keeps `answers` in the `open` view; the `open` case passes `saved={view.answers}` to `AnswerForm`.
- **`AnswerForm`** (new prop `saved?: Record<string, string[]>`):
  - `savedFields` (state) = `toFields(saved, questionIds)`; after a successful submit it becomes the submitted fields. The initial `fields` = `toFields(stored.draft)` when the store (read once in a `useState` initializer) holds a draft that differs from `savedFields`, else `savedFields`. `submitted` starts as `saved !== undefined`, so the button reads "Lagre endringer" for a returning device.
  - "Differs" compares, per Question in `questionIds` order, the trimmed non-empty values (a blank extra field is not a change).
  - **Status notice**, the first thing after the error summary and before the anonymity notice, at most one:
    - restored draft: `Notice tone="info"` with `<p>` "Du har endringer som ikke er sendt inn." and a `ghost` `Button` "Forkast endringene" under it;
    - otherwise, when `submitted`: `Notice tone="info"` "Du har allerede sendt inn. Endringer lagres først når du trykker «Lagre endringer»." (also after "Se eller endre svarene" in the same session).
  - "Forkast endringene" sets `fields` to `savedFields`, drops `draft` from the store (keeping `token` and `editSecret`), hides the draft notice, and moves focus to Question 1's Svar 1 through the existing `focusField` ref.
  - **Draft save**: an effect on `fields` (only while `phase === "form"`) schedules `saveDraft` after `DRAFT_SAVE_MS = 500` and clears the timer in its cleanup (timer kept in a ref). `saveDraft` reads the store and writes `{ ...stored, token, draft: fields }`; when `fields` do not differ from `savedFields` it writes the store without `draft`, or writes nothing if there was no stored value.
  - **Submit**: before validation, clear the timer and save the draft at once, so a failed or lost submit keeps it (the `NETWORK_SUBMIT` sentence promises this). The secret logic of 2.4 stays. On success clear the timer, write `{ token, editSecret }` (no draft), set `savedFields` to the submitted fields, hide the draft notice. On `COLLECTION_CLOSED` clear the timer before `clearLinkStore`.
- **Spine** (`ARCHITECTURE-SPINE.md`, AD-8 Edit secret bullet): the value is JSON `{ token, editSecret, draft }`, `draft` being the raw field values per Question, written about 500 ms after typing stops and on submit, dropped after a successful submit; `openInviteLink(gameId, token, editSecret)` returns `answers` only on a hash match, and otherwise the same response as an unused link. Replace the "(Story 2.5 adds the unsent draft, EXPERIENCE)" parenthesis.
- **Tests**: titles start with the IDs they prove. Each e2e test registers its own Host; a second browser context is made with `browser.newContext({ baseURL })` and `localOnly(context)` (pattern: `tests/e2e/games.spec.ts:144`). In `tests/TRACE.md` add FR-7 and FR-12 rows (and FR-6 for the draft), and remove "Story 2.5" from their "Pending" lists.

**Never:**
- Never send Answer text, a draft or any part of it in a request before "Send inn svar"/"Lagre endringer" (AC4, FR-6). Never sync drafts to the server.
- Never log, or put in a URL, a Token, edit secret, hash or Answer (AD-17). Never return answers, or a different response shape or error, for a wrong or missing secret. No timing or Host-visible change on open.
- Never hash in the browser or use `crypto.subtle`. No new dependency, env var, table, migration, Route Handler or error code. Do not edit `.logs/`, `prompting/`, or this intent contract.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Matching secret | row exists, `sha256(secret)` matches | `{ title, questions, answers }` with the stored set | — |
| Wrong / none / malformed secret | random 43-char secret; no third argument; `"abc"`; a number | `toEqual` the response for an unused sibling link | — |
| Secret of another link | link A's secret sent with link B (B has no row, or its own) | no `answers` | — |
| Replaced from another device | submit with secret S1, then S2 | one row, hash = `sha256(S2)`; opening with S1 gives no `answers`, with S2 gives the new set | — |
| Edit leaves a Question empty | row exists, resubmit with one Question all blank, same secret | `INVALID_INPUT` "Skriv minst ett svar." under the Question ID | row unchanged |
| Draft on unused link | type, wait > 500 ms, reload | fields restored, draft notice, "Send inn svar" | — |
| Draft over saved set | saved set, then edit, reload | draft values shown (draft wins), draft notice, "Lagre endringer"; "Forkast endringene" restores the saved values and shows the returning notice | — |
| Typed then erased | draft equals the saved set (or empty) | no draft stored, no draft notice on reload | — |
| Tampered draft | `draft` not an object, value not an array, 7 entries, non-strings, unknown key | `toFields` gives at most 5 string fields, at least 2, known Questions only | never throws |
| Successful submit | draft stored | value becomes `{ token, editSecret }` | — |
| Closed / unknown | draft stored | whole key cleared (existing exact-Token rule) | — |

</intent-contract>

## Code Map

- `src/server/collection/index.ts:89-101`: `openInviteLink`, the read to extend. `resolveLink` (62-77) returns `tokenHash`. `submit` (105-150) already upserts and replaces the hash, so AC2 needs tests only. Use `getDb()` with `submission` from `src/server/db/schema.ts`; `sha256` from `@/lib/token`.
- `src/app/svar/[gameId]/actions.ts`: `openInviteLink` wrapper; its return type follows the module via `ReturnType`.
- `src/lib/invite-link.ts:24-62`: `LinkStore`, `readLinkStore`, `writeLinkStore`, `clearLinkStore`. Values are spread, so an added `draft` survives `{ ...stored, token, editSecret }`.
- `src/lib/answer-set.ts`: home of `parseAnswerSet`; add `toFields` beside it. `src/lib/limits.ts`: `ANSWERS_PER_QUESTION_MAX`.
- `src/components/InviteLinkView.tsx:21-33`: `fetchView` (reads the hash, builds the `open` view); `111-125`: the `open` case.
- `src/components/AnswerForm.tsx`: `DEFAULT_FIELDS` initializer (55-59), `focusField` effect (73-80), `submit` (126-176; the secret block at 139-146), `submitted` label (384), notices (252-257). `Notice` (`src/components/Notice.tsx`) takes children; `info` is `role="status"`. `Button` variant `ghost`.
- `tests/integration/collection.test.ts:276+`: `describe("submitAnswerSet")` with `fullSet`, `rowsOf`, `invalid`; `collectingGame()` gives 3 Tokens and 3 Question IDs. Add AC1 cases under `describe("openInviteLink")` (line 102) and AC2 cases under `submitAnswerSet`.
- `tests/e2e/answer-form.spec.ts`: helpers `openForm` (returns `{ gameId, token }`), `group`, `field`, `storedValue`, `HELPER`; test (d) at 221 is the submit pattern. Append the 2.5 tests here.
- `tests/e2e/invite-link-page.spec.ts`: the closed and unknown key-clearing tests seed `{ token }`; add a `draft` to one seed so the whole-key clear is shown with a draft present.
- `tests/unit/answer-set.test.ts`, `tests/unit/token.test.ts`: unit homes for `toFields` and the store round-trip with a `draft`.

## Tasks & Acceptance

**Execution:**
- `src/lib/answer-set.ts` -- add `toFields` -- one sanitizer for saved sets and untrusted drafts.
- `src/lib/invite-link.ts` -- add `draft` to `LinkStore` -- AD-8 single key.
- `src/server/collection/index.ts`, `src/app/svar/[gameId]/actions.ts` -- secret-gated `answers` on `openInviteLink` -- AC1.
- `src/components/InviteLinkView.tsx`, `src/components/AnswerForm.tsx` -- send the stored secret, pre-fill, status notices, draft save/restore/discard/clear -- AC3, AC4.
- `.docs/planning-artifacts/architecture/architecture-Toppsvar-2026-11-21/ARCHITECTURE-SPINE.md` -- AD-8 amendment as worded under Always.
- `tests/unit/answer-set.test.ts` -- `toFields` rows of the matrix (saved set padded, 7 entries capped at 5, non-strings dropped, unknown key dropped, non-object and non-array give `["", ""]`).
- `tests/unit/token.test.ts` -- the store round-trips `{ token, editSecret, draft }`.
- `tests/integration/collection.test.ts` -- AC1 (matching, wrong, none, malformed, other link's secret, all compared with an unused sibling) and AC2 (same-device replace, other-device replace then old secret gives no answers, empty-Question edit refused with the row unchanged).
- `tests/e2e/answer-form.spec.ts` -- three tests:
  - (f) AC3: submit, reload in the same context: pre-filled values, the returning notice, "Lagre endringer"; add Svar 3 to Question 1, press "Lagre endringer", reload, Svar 3 is there. A fresh context on the same link: empty fields, no returning notice, "Send inn svar", the helper line.
  - (g) AC4 draft: record every request's URL and post body; type a unique string, poll until `storedValue(...).draft` holds it, reload: the value is restored with the draft notice and the helper line; no recorded request contains the string; then complete and submit: the stored value has no `draft` and keeps `editSecret`.
  - (h) AC4 draft wins: submit, "Se eller endre svarene", change Svar 1, poll for the draft, reload: the draft value and the draft notice show (not the returning notice); axe has no serious violation; "Forkast endringene" restores the saved value, shows the returning notice, focuses Question 1's Svar 1, and the store has no `draft` but the same `editSecret`.
- `tests/e2e/invite-link-page.spec.ts` -- one closed or unknown seed carries a `draft`, still removed.
- `tests/TRACE.md` -- FR-6, FR-7, FR-12 rows; "Story 2.5" out of their Pending lists.

**Acceptance Criteria (from epics.md, the contract):**
- AC1 (FR-7, FR-12 · integration): Given a link with a saved Answer set, when `openInviteLink` is called with the matching edit secret, with a wrong one, and with none, then only the matching call returns the saved Answers; the other two return a response identical to an unused link.
- AC2 (FR-7 · integration): Given a link with a saved Answer set, when a new complete set is submitted from the same device, and later from a device without the secret, then each submit replaces the link's single `submission` row (the second also replaces the secret hash), so the link never holds two Answer sets; and an edit that leaves a Question with no Answer is refused as in FR-6.
- AC3 (FR-7 · e2e): Given a Participant who has submitted, when they reopen the link in the same browser context, then the form is pre-filled, shows "Du har allerede sendt inn. Endringer lagres først når du trykker «Lagre endringer».", and adding a third Answer and pressing "Lagre endringer" saves it; and the same link in a fresh browser context shows an empty form with the same helper line under the submit button, "Utkastet lagres bare på denne enheten. Sender du inn fra en annen enhet, erstatter det de forrige svarene."
- AC4 (UX-DR20, FR-6 · e2e): Given a Participant typing into the form, when they reload the tab before submitting, then the draft is restored from the per-link `localStorage` key (saved about 500 ms after typing stops), and the network log shows no request carrying Answer text before submit; and a local draft wins over the server copy with "Du har endringer som ikke er sendt inn." and "Forkast endringene", the helper line is shown under the submit button, and the draft is cleared after a successful submit.

## Spec Change Log

## Review Triage Log

### 2026-11-22 — Review pass
- verdicts: 23 findings — high 0, medium 3, low 15, false 5, maybe-false 0
- findings:
  - `[low]` `[defer]` Blind Hunter: the README does not mention the shared-phone draft exposure that EXPERIENCE asks for. The README has no anonymity section yet; Story 7.4 writes it. Deferred in frontmatter.
  - `[low]` `[reject]` Blind Hunter: the last ~500 ms of typing is lost if the tab is killed, because the effect cleanup cancels the pending save. This is what a debounced save "about 500 ms after typing stops" (AC4) means; a `pagehide` flush adds a listener and a latest-fields ref, and mobile browsers do not reliably fire `pagehide` on a killed tab anyway.
  - `[low]` `[reject]` Blind Hunter: text typed while a submit is pending is dropped from storage on success. The Participant has just pressed submit and the form is replaced by the confirmation; the fix needs disabled inputs or a second comparison branch for a window users rarely meet.
  - `[low]` `[patch]` Blind Hunter: `toFields` keeps strings of any length, so a corrupted draft fills a field past 80 characters. Fixed: each kept value is cut to `ANSWER_TEXT_MAX`, with a 140-character unit case.
  - `[low]` `[patch]` Blind Hunter: the AC1 integration assertion `unused.ok && "answers" in unused.data` also passes when `unused` is a failure, making the `toEqual(unused)` checks vacuous. Fixed: `expect(unused.ok).toBe(true)` first.
  - `[low]` `[reject]` Blind Hunter: no test seeds a draft for the unknown page or the submit-time unknown branch. `clearLinkStore` removes the key whatever the value holds; the unknown page is tested to remove a `{ token }` value, and the closed page and the submit-time closed branch are tested with a draft present (the flush writes it before the call, and the key is then `null`).
  - `[low]` `[reject]` Blind Hunter: "Forkast endringene" is not announced to screen readers. Focus lands on Question 1's Svar 1, whose restored value is read, and the returning notice follows in reading order; an extra announcement would need new copy that EXPERIENCE does not define.
  - `[false]` `[reject]` Blind Hunter: the spine documents only part of the draft rules. "Draft wins on load" is EXPERIENCE's rule and the comparison and discard details are UI behaviour in this spec's Design Notes; no module boundary or second implementer depends on them, so no named harm.
  - `[low]` `[reject]` Blind Hunter: discarding or erasing on a never-submitted link leaves `{ token }` behind. Harmless: it holds what the browser history already holds, and it is cleared on closed or unknown like any value.
  - `[false]` `[reject]` Blind Hunter: the "never sent before submit" check misses the `openInviteLink` POST on reload. The request listener is attached before the reload, so that POST's body is among the recorded requests the assertion scans.
  - `[low]` `[reject]` Edge Case Hunter: a tab closed within 500 ms of the last keystroke loses those edits. Same root cause and reason as the Blind Hunter debounce row.
  - `[low]` `[reject]` Edge Case Hunter: typing or pressing "Forkast endringene" while a submit is pending. Same root cause and reason as the Blind Hunter pending row.
  - `[low]` `[patch]` Edge Case Hunter: a restored draft edited back to the saved set keeps the draft notice although the store's draft is gone. Fixed: the notice shows only while `draftRestored && differs(fields, savedFields, questionIds)`; otherwise the returning notice applies.
  - `[medium]` `[patch]` Verification Gap: the aborted-submit test reads the draft after the 500 ms timer may already have written it, so removing the flush on submit could pass. Fixed: `page.clock.install()` and `pauseAt` before typing, so the draft can only come from the flush. A mutation run (flush removed) failed the test.
  - `[medium]` `[patch]` Verification Gap: the ~500 ms debounce is not tested while TRACE claims it. Fixed: test (g) pauses the clock, asserts no stored value after `runFor(400)` and the draft after another `runFor(200)`; TRACE now states exactly that. A mutation run (`DRAFT_SAVE_MS = 300`) failed the test.
  - `[medium]` `[patch]` Intent alignment: the "about 500 ms" timing surface is not exercised. Same root cause and fix as the Verification Gap debounce row.
  - `[low]` `[patch]` Intent alignment: the helper line's position under the submit button is asserted only on a first visit. Fixed: test (f) asserts it on the returning view and in the fresh context.
  - `[false]` `[reject]` Intent alignment: "identical" is value equality, and a malformed secret returns before the query while a well-formed wrong one runs it. The timing difference reveals only whether the sender's own secret is well formed, which the sender already knows; whether a row exists is not distinguishable (one primary-key lookup either way).
  - `[low]` `[reject]` Intent alignment: the draft-over-saved path has no network assertion. The reload goes through the same `openInviteLink(gameId, token, editSecret)` call whose arguments never include the draft, and that call is scanned in test (g).
  - `[low]` `[reject]` Intent alignment: closed/unknown with a draft is tested only for closed. Same root cause and reason as the Blind Hunter unknown row.
  - `[false]` `[reject]` Intent alignment: the returning notice also shows after "Se eller endre svarene". The spec's Always list asks for exactly that; changing it would edit this build's spec.
  - `[false]` `[reject]` Intent alignment: additions no reading asks for (flush on submit, the no-change rule, focus after discard, `toFields`, the spine edit). Each is required by this spec's Always list or by Story 2.4's network sentence; none adds a user-visible feature beyond the story.
  - `[low]` `[reject]` Intent alignment: AC2's "refused as in FR-6" is tested only on the server. The client runs the same `parseAnswerSet` before sending, and Story 2.4's e2e tests cover its refusal; an edit takes the same path.

### AI suggestions corrected or rejected (grading evidence)

- **Planner corrections to the plain reading of the story:**
  - A miss returns `{ title, questions }` with no `answers` key rather than `answers: null`, so "identical to an unused link" is a plain `toEqual` and the Story 2.3 tests stay unchanged.
  - Only one status notice shows, with the draft notice first, so a 360 px screen does not get three notices above the first Question.
  - The draft is also written on submit, because Story 2.4's network sentence promises the draft is still on the device.
- **Orchestrator addition after implementation:** the matrix row "typed then erased" had no test. The orchestrator added it to test (h) before review.
- **Reviewer suggestions accepted (patched):**
  - The 80-character cut in `toFields`.
  - The vacuous AC1 assertion.
  - The stale draft notice.
  - The racing flush test.
  - The untested 500 ms timing.
  - The helper-line position on later visits.
- **Reviewer suggestions rejected:**
  - A `pagehide` flush.
  - Disabling inputs while a submit is pending.
  - A screen-reader announcement for discard: it needs new copy.
  - Cleaning up a leftover `{ token }` value.
  - Extra draft seeds for the unknown paths.
  - Spine detail for UI rules.
  - Network checks on the second path.
  - A client-side AC2 test.
  - Three claims refuted outright: the recorded requests miss the reload POST; equal-timing "identical"; the out-of-scope additions.
  - Reasons are in the rows above.

## Design Notes

- **One status notice, draft first.** A device with both a saved set and a draft shows only the draft notice: three notices above the first Question crowd a 360 px screen, and the draft notice is the one that asks for a decision. After "Forkast endringene" the returning notice takes its place.
- **Omit `answers` instead of `answers: null`.** A miss returns the exact unused-link object, so AC1's "identical" is a plain `toEqual` and the 2.3 tests that `toEqual` `{ title, questions }` need no change.
- **Draft flushed on submit.** The network sentence says "Utkastet ditt ligger fortsatt på denne enheten", so a submit inside the 500 ms window must still leave the draft behind.
- **No draft for typed-then-erased.** Comparing trimmed non-empty values keeps the draft notice from appearing for a form that holds nothing new.
- **README.** EXPERIENCE asks the README's anonymity section to mention the shared-phone draft exposure; that section is written in Story 7.4 (FR-14 Pending), so it is not added here.

## Verification

**Commands:**
- `npm run lint && npm run format:check && npm run typecheck` -- expected: exit 0
- `npm run test` -- expected: all pass offline
- `npm run test:e2e` -- expected: all specs pass

**Manual checks:**
- At 360 px: the draft notice with its ghost button and the returning notice sit above the anonymity notice without crowding; no horizontal scroll.

## Auto Run Result

Status: done

**Summary.** A device that has submitted now gets its saved Answers back, and an unsent draft survives a reload.
- **Server.** `openInviteLink(gameId, token, editSecret?)` returns `answers` only when the secret is well formed and `sha256(editSecret)` matches the link's `submission` row. A wrong, missing, malformed or other link's secret gets exactly the unused-link response. It is still a read: no lock, no write.
- **Form.**
  - `InviteLinkView` sends the stored secret. `AnswerForm` pre-fills from the saved set, says "Du har allerede sendt inn. Endringer lagres først når du trykker «Lagre endringer».", and labels the button "Lagre endringer".
  - The draft is kept in the link's one `localStorage` value 500 ms after typing stops, and at once on submit. On load it wins over the saved set with "Du har endringer som ikke er sendt inn." and "Forkast endringene", which restores the saved values and focuses Question 1's Svar 1.
  - A successful submit leaves `{ token, editSecret }`. Closed or unknown clears the whole key.
  - Nothing typed is sent before submit.

**Files.**
- `src/server/collection/index.ts`, `src/app/svar/[gameId]/actions.ts`: secret-gated `answers` on `openInviteLink`.
- `src/lib/invite-link.ts`: `draft` on `LinkStore`. `src/lib/answer-set.ts`: `toFields`, the sanitizer for saved sets and untrusted drafts.
- `src/components/InviteLinkView.tsx`, `src/components/AnswerForm.tsx`: the stored secret, pre-fill, status notices, and draft save, restore, discard and clear.
- `ARCHITECTURE-SPINE.md`: the AD-8 amendment.
- Tests:
  - `tests/unit/answer-set.test.ts`, `tests/unit/token.test.ts`.
  - AC1/AC2 cases in `tests/integration/collection.test.ts`.
  - Tests (f), (g) and (h) in `tests/e2e/answer-form.spec.ts`, plus the paused-clock aborted-submit test and per-case storage resets.
  - A draft seed in `tests/e2e/invite-link-page.spec.ts`.
  - FR-6, FR-7 and FR-12 rows in `tests/TRACE.md`.
- `sprint-status.yaml`: 2-5 done.

**Review.** 23 findings: high 0, medium 3, low 15, false 5, maybe-false 0.
- **Patched:**
  - Two medium entries: the racing flush test, and the untested 500 ms timing (two rows).
  - Four low entries: the 80-character cut, the vacuous AC1 assertion, the stale draft notice, and the helper-line position.
- **Deferred (1):** the README shared-phone note, which belongs to Story 7.4.
- **Rejected:** 15 rows, each with its reason in the triage log.

**Follow-up review recommended: true.** Two medium entries were patched. The specific unverified risks:
- The two timing tests rely on Playwright's `page.clock` fake timers coexisting with Next and React. A Next upgrade that schedules page loading on `setTimeout` could hang them.
- Typing during a pending submit is untested; it was rejected as low.

**Verification.**
- `npm run lint`, `format:check` and `typecheck` are clean.
- `npm run test`: 365 passed in 29 files.
- `npm run test:e2e`: 79 passed.
- Everything ran offline with no key.
- Mutation runs: removing the flush on submit failed the aborted-submit test, and `DRAFT_SAVE_MS = 300` failed test (g). Both were restored and the full suite re-run green.
- The implementer checked 360 px with screenshots: both status notices sit above the anonymity notice, with no horizontal scroll.

**Residual risks.**
- A tab killed within 500 ms of the last keystroke loses those characters.
- The ghost "Forkast endringene" button reads like plain text on the info Notice until hovered. That is DESIGN.md's ghost style; look at it during the epic's impeccable critique.
- The README note is deferred to Story 7.4.
- Manual checks A2 to A4 still need a run on a real phone.

**Spine amendments.** The AD-8 edit-secret bullet now states:
- The key's value is JSON `{ token, editSecret, draft }`. `draft` is the raw field values per Question, written about 500 ms after typing stops and on submit, and dropped after a successful submit. It never reaches the server before a submit.
- `openInviteLink(gameId, token, editSecret)` returns `answers` only on a hash match, and otherwise the same response as an unused link.
