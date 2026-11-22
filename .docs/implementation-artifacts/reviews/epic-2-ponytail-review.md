# Epic 2 ponytail review (stories 2.1 to 2.7)

Diff reviewed: `git diff epic-1-fundament..epic-2-innsamling` on branch `epic-2-innsamling`. Read-only review, nothing changed.
Assumed load: a party game with one Host and up to 50 Participants per Game, a handful of Games at once, on one Node process.

What this change does: Epic 2 adds the Question editor, Invite link creation (shown once, only the sha256 of each Token stored), the anonymous answer page under `/svar`, the Host progress count with the "fewer than 3" floor, and revoke-and-replace of a lost link. It adds three tables (`question`, `invite_link`, `submission`), a `server/collection` module, and a lot of tests.

I traced the core flows end to end: link creation under the Game row lock, the 50-link cap (checked first, revoked links still counted), the submit upsert, the hash-only lookup, the progress join, and the anonymity columns. All of it is correct, matches AD-5, AD-7, AD-8 and FR-5 to FR-12, and I found no bug and no security hole. No requirement was cut by the existing code, and none of my findings asks for one to be cut. The `shortcut:` comments (password queue, purge delete, title re-apply, `randomUUID`, `beforeunload`) each name a real limit and a trigger, so they are honest. The `randomUUID` one is the only one worth a second look: if the Host ever opens the app over plain `http://<LAN-IP>`, "Legg til spørsmål" throws, because `randomUUID` needs a secure context. The comment says exactly that, so it is a decision, not a finding.

## Must fix

None.

## Should fix

1. **Three copies of the same Host action wrapper** (`src/app/spill/[id]/actions.ts:L36-L90`)
   - **What this is:** Server Actions that check the Host session, call a module function, refresh the Game page and turn errors into a failure result.
   - **Problem:** `questionAction`, `createInviteLinks` and `revokeInviteLink` are the same try/catch with the same `unstable_rethrow`, the same `(input as { gameId: string }).gameId` cast and the same `revalidatePath`. The first one is only typed for `void`, which is the only reason the other two were not folded in.
   - **Fix:** Make `questionAction` generic over the result (`<T>(op: (hostId, input) => Promise<T>, input) => Promise<ActionResult<T>>`) and define all five actions through it. About 25 lines go away.
   - **If we skip it:** The next Host action (Epic 3: close, start) becomes a fourth copy, and a fix to the error path has to be made in four places.

2. **The "call a Server Action, rethrow the login redirect, treat any other throw as no network" block exists five times on the client** (`QuestionEditor.tsx:L34-L44`, `InviteLinkPanel.tsx:L72-L80`, `RevokeLinkPanel.tsx:L62-L68`, `AnswerForm.tsx` submit, `InviteLinkView.tsx` `fetchView`)
   - **What this is:** Each component calls an object-input action (not a form action) and maps a rejected promise to the `NETWORK` sentence.
   - **Problem:** `useFormAction` from Epic 1 cannot serve these calls, because it takes `FormData`, so each component rebuilt the same catch by hand. `QuestionEditor` even has a named helper `call` for it, and the others inline it. The two link panels also share the same `focusNext` ref, `rootRef`, `capRef`, focus effect and `REFRESH_ON` set, with small differences.
   - **Fix:** Export one `callAction(fn): Promise<ActionResult<T> | null>` next to `NETWORK` in `useFormAction.ts` (it already owns the redirect-versus-network rule) and use it in all five places. Leave the two panels separate unless a third one appears. Net about 30 lines.
   - **If we skip it:** The redirect rule is the kind of thing that breaks silently (a session expiring mid-edit shows "no network" instead of the login page) and would have to be re-fixed five times.

3. **Tests that check Node or the platform, not our code, and near-copy tests** (`tests/unit/token.test.ts`, `tests/integration/collection.test.ts`)
   - **What this is:** The Epic 2 test suite, about 4 000 lines in 20 files.
   - **Problem:**
     - `token.test.ts` generates 10 000 Tokens to prove they differ, checks `sha256("abc")` against a known vector, and loops 100 times over `TOKEN_PATTERN`. These test `crypto.randomBytes` and `createHash`, not our code. The `storageKey` test is already covered by the write/read test two blocks later.
     - `collection.test.ts` has three near-identical "table renamed, so INTERNAL and one log line with no secrets" tests (L259, L568, L976) that differ only in the operation.
     - The revoke count cases (L661, L672, L683) and the "used and unused link look the same" cases (L808, L857, L876) overlap each other and `e2e/revoke.spec.ts`.
   - **Fix:** In `token.test.ts` keep the 43-character shape check and the pattern rejection list, drop the 10 000 loop, the known vector and the `storageKey` test. Turn the three INTERNAL tests into one `it.each`. Merge the overlapping revoke cases. Keep every anonymity, cap and log-leak assertion; only the repeated setup and the platform checks go. About 200 to 300 test lines.
   - **If we skip it:** Slower, longer suite, and a reader looking for "what proves anonymity" has to wade through duplicates. The project's own debloat rule (cut about 40 percent, keep every critical test) applies here.

## Nice to have

4. **The Game page re-reads the same owned Game three times** (`src/app/spill/[id]/page.tsx`, the new `if (draft || collecting)` block)
   - **What this is:** The page already holds `game` from the cached `ownedGame`, which now includes `inviteLinksIssued`.
   - **Problem:** It then calls `auth.requireHost()` again, and `questions.list` and `collection.progress` each call `games.getOwned` again. In draft, `progress` also runs the invite-link join only to read `issued`, which `game.inviteLinksIssued` already gives. In collecting this repeats every 30 seconds per open Host page.
   - **Fix:** Use `game.inviteLinksIssued` in draft and call `progress` only when collecting. Small and safe.
   - **If we skip it:** Two or three extra queries per page view. Harmless at one Host, noticeable only if many Hosts poll.

5. **The UI repeats a limit that lives in `limits.ts`** (`ProgressCount.tsx:L9`, `lib/errors.ts` `QUESTION_CAP_REACHED` and `LINK_CAP_REACHED`, `invite-link.ts` `COUNT`, `answer-set.ts` `ANSWER_TOO_LONG`, `question.ts` `TEXT_LENGTH`)
   - **What this is:** Messages with the numbers 20, 50, 80 and 1 to 200 typed into the text.
   - **Problem:** `ProgressCount` also compares against the literal `"fewer-than-3"` instead of the exported `FEWER_THAN_3`. If either side changes, the page shows the raw string "fewer-than-3" as a number instead of "færre enn 3", and nothing fails to compile.
   - **Fix:** Move `FEWER_THAN_3` to `lib/limits.ts` (it cannot be imported from the `server-only` module), import it in `ProgressCount`, and build the messages from the limit constants with a template string.
   - **If we skip it:** A silent mismatch the day someone changes a limit.

Verdict: Ship. Fix 1 and 2 first if you want a smaller diff before the Epic 2 PR; neither blocks the PR.
Lean: -about 300 lines possible (about 55 in source, about 250 in tests).
Not checked: I did not run the test suite or the app, and I read the test files by title and sample, not line by line.

## Epic 2 review fixes (2026-11-22)

Fixes landed on `epic-2-innsamling` in commit `36b30cf`. After it, `npm run test` passes 387 tests and `npm run test:e2e` passes 81.

- **1, fixed.** `hostAction<T>` in `src/app/spill/[id]/actions.ts` now defines all five object-input Host actions. The question actions now return `data: undefined` instead of `null`, and no caller reads it.
- **2, fixed.** `callAction()` is exported from `useFormAction.ts`, next to `NETWORK`, and is used in all five places: `QuestionEditor` (replacing its local `call`), `InviteLinkPanel`, `RevokeLinkPanel`, `AnswerForm` submit and `InviteLinkView` `fetchView`. The two link panels stay separate, as the review suggested.
- **3, fixed.**
  - `token.test.ts` drops the 10,000-Token loop, the `sha256("abc")` vector, the 100-iteration pattern loop and the separate `storageKey` test.
  - `collection.test.ts` merges the three "table renamed, so INTERNAL" tests into one `it.each`. Each case now checks for every secret: the Token, its hash, the edit secret, its hash, the link, an Answer and the gameId.
  - The two raw-revoke progress cases became one.
  - "A revoked link is opened and submitted to like one that never existed" was folded into the used-versus-unused revoke test.
  - The malformed-paste test was merged into the foreign-link test.
  - Every anonymity, cap and log-leak assertion is kept, and `tests/TRACE.md` is updated so that each row still names a test. The net change in tests is smaller than the estimate, because the bmad review's L1 race-guard tests were added in the same commit.
- **4, skipped**, as the orchestrator decided. The Game page still re-reads the owned Game, which costs two or three queries per view.
- **5, fixed.** `FEWER_THAN_3` moved to `lib/limits.ts`, and `ProgressCount` and the tests import it from there. `QUESTION_CAP_REACHED`, `LINK_CAP_REACHED`, the invite-link `COUNT`, `ANSWER_TOO_LONG` and the question `TEXT_LENGTH` are now template strings built from the limit constants. The rendered text is unchanged.
