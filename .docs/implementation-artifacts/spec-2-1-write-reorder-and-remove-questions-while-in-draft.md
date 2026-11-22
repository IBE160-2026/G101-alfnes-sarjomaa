---
title: 'Story 2.1: Write, reorder and remove Questions while in draft'
type: 'feature'
created: '2026-11-22'
baseline_revision: '2f9c9bdb0d98514eb53be7c319d12f5eb57fecc1'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/.docs/implementation-artifacts/epic-2-context.md'
  - '{project-root}/.docs/planning-artifacts/ux-designs/ux-Toppsvar-2026-11-21/DESIGN.md'
  - '{project-root}/.claude/skills/impeccable/reference/craft-floor.md'
warnings: [oversized]
deferred:
  - summary: >-
      The editor's client reaction to WRONG_STATE (refresh plus message) has no e2e test.
    evidence: |-
      No UI flow can move a Game out of draft until Story 2.2 adds the draft to collecting transition; the server side is covered in game-state.test.ts. Add the e2e case with Story 2.2 (open Collection in a second tab, then blur in the first).
    location: >-
      src/components/QuestionEditor.tsx (showFailure)
    severity: low
---

<intent-contract>

## Intent

**Problem:** A Host can create a Game but cannot write its Questions, so nothing can be collected (FR-4). The *draft* Game page still shows a neutral placeholder behind a `shortcut:` comment instead of the EXPERIENCE.md empty-state sentence.

**Approach:** Add the `question` table and a `questions` module (`list`, `save`, `move`, `remove`) that locks the Game through `games.lockForMutation(..., PERMITTED.editQuestions)` and keeps positions dense `1..n` in the same transaction. On the *draft* Game page, replace the placeholder with a client `QuestionEditor`: one labelled textarea per Question that autosaves on blur, "Flytt opp" / "Flytt ned" / "Slett" buttons, and "Legg til spørsmål" with "N av 20 spørsmål". Story 2.1's four ACs in `epics.md` (repeated below) are the contract; AD-1, AD-4, AD-5, AD-16 (positions) and AD-17 govern.

## Boundaries & Constraints

**Always:**
- The implementer first invokes `ponytail` (level `full`), then `impeccable` (no launcher: "Launcher unavailable" path, read `reference/craft-floor.md` right before UI edits). *Operate* mode. DESIGN.md and EXPERIENCE.md win. Ponytail never cuts a requirement, validation, error handling, accessibility or the tests below.
- **Schema:** `question(id uuid pk, game_id uuid not null → game.id ON DELETE CASCADE, position integer not null, text text not null)` with a unique index on `(game_id, position)`. No timestamps. Migration via `npm run db:generate`, committed.
- **Limits** in `src/lib/limits.ts`: `QUESTIONS_MAX = 20`, `QUESTION_TEXT_MAX = 200`, `QUESTION_COUNTER_FROM = 160`.
- **Schemas** in `src/lib/question.ts` (pure zod, like `src/lib/game.ts`): `text` trimmed, 1–200, message "Spørsmålet må ha 1–200 tegn." for both bounds; `questionId` is `z.uuid()` on save; move/remove take `questionId: z.string()` and `direction: z.enum(["up", "down"])`; `gameId: z.string()` (malformed → `NOT_FOUND` via `lockForMutation`).
- **`ErrorCode`** gains `QUESTION_CAP_REACHED`: "Du har nådd maks 20 spørsmål."
- **Module `src/server/questions/index.ts`** (`import "server-only"`; may import only `auth`, `games`, `db`, `lib`). Every entry point runs in `withBoundary("questions", op, …)`, takes `hostId` first, validates with the shared schema, and every write opens one `db.transaction` that starts with `games.lockForMutation(tx, { hostId, gameId, states: PERMITTED.editQuestions })`:
  - `list(hostId, gameId) → { id, text }[]` ordered by position; resolves the Game with `games.getOwned` first (AD-5).
  - `save(hostId, { gameId, questionId, text }) → void`: an upsert keyed by the client-generated `questionId`. If the id is already a Question of this Game, update its text. Otherwise refuse with `QUESTION_CAP_REACHED` when the Game has 20, else insert at position `count + 1` with `onConflictDoNothing()`; no row returned (the id exists under another Game) → `NOT_FOUND`, nothing written.
  - `move(hostId, { gameId, questionId, direction }) → void`: swaps with the neighbour; a `questionId` not in this Game → `NOT_FOUND`; moving the first up or the last down is a no-op.
  - `remove(hostId, { gameId, questionId }) → void`: deletes the row (constrained to `gameId`) and renumbers the rest `1..n`; unknown id → `NOT_FOUND`.
  - Renumbering writes the whole new order under the Game lock without tripping the unique index (e.g. negate all positions, then set `1..n`).
- **Actions** in `src/app/spill/[id]/actions.ts`: `saveQuestion(input)`, `moveQuestion(input)`, `removeQuestion(input)`, each `(input: unknown) → Promise<ActionResult<null>>`, sharing one small helper: `auth.requireHost()`, call the module with the raw input, `revalidatePath(\`/spill/${gameId}\`)` on success, `catch` → `unstable_rethrow(error)` then `toFailure(error)`.
- **Game page:** the *draft* case reads `questions.list(hostId, game.id)` and renders `<QuestionEditor gameId questions />` inside the existing `<section aria-labelledby="sporsmal">` under `<h2>Spørsmål</h2>`; the `shortcut:` comment and the neutral sentence go.
- **`QuestionEditor` (`src/components/QuestionEditor.tsx`, client)**, rows driven by the `questions` prop (server truth after every `revalidatePath`) plus at most one unsaved draft row at the end:
  - With zero saved Questions, the literal sentence "Ingen spørsmål ennå. Skriv det første, gjerne om noen dere kjenner, for eksempel «Hva gjør Jonas når han har forsovet seg?»" sits above the list.
  - An `<ol>`; each row: visible `<label>` "Spørsmål N", a textarea (`rows={2}`, 16 px, `aria-required`, no `maxLength`), counter "N av 200 tegn" (trimmed length, `aria-hidden`, from 160) right-aligned in `body-sm ink-muted` with an `sr-only` polite announcement only at ≥ 200, an inline status in a `role="status"` element ("Lagret" in `success`; failures in `danger`), a field error tied by `aria-describedby` with `aria-invalid` and a visually hidden "Feil: " prefix, then `ghost` Buttons "Flytt opp" (not on the first saved row), "Flytt ned" (not on the last saved row) and "Slett", each with an `sr-only` " spørsmål N" suffix. The draft row has only "Slett", which just drops it locally.
  - **Autosave on blur:** trimmed text empty → nothing is sent and the status clears; unchanged from the last saved text → nothing is sent; otherwise `saveQuestion`. Typing clears the status. A blur while this row's save is in flight is not sent; when the save settles, the row saves again if its text changed meanwhile.
  - **Results:** ok → "Lagret". `fieldErrors.text` → shown as the field error. `QUESTION_CAP_REACHED` → its message in the status. `WRONG_STATE` / `NOT_FOUND` → `router.refresh()` and the status shows the message. A rejected call (network) or `INTERNAL` → "Fikk ikke lagret. Prøv igjen.". Move/remove failures show in the same row status.
  - **Calls** run inside `startTransition(async …)`; `catch` calls `unstable_rethrow(error)` (the login redirect) before treating it as a network failure, as `useFormAction` does. Move/remove Buttons use `pending` (repeat clicks ignored, `aria-busy`).
  - **"Legg til spørsmål"** (`secondary`) with "N av 20 spørsmål" (N = saved Questions) beside it; at 20 saved both are replaced by "Du har nådd maks 20 spørsmål.". Clicking creates a draft row with `crypto.randomUUID()` and focuses its textarea; if an unsaved draft already exists it only focuses that one.
  - **Focus:** after a confirmed move, the moved Question's same button (or its other move button if the same one is gone); after a confirmed remove, the textarea now at that index, else the previous one, else "Legg til spørsmål". Applied once the refreshed `questions` prop arrives.
- **Tests:** titles start with the IDs they prove. Every new Host action gets a foreign-ID case in `authz.test.ts`; `game-state.test.ts` gets the `WRONG_STATE` case. `tests/TRACE.md` FR-4 gets this story's rows ("None yet" goes; "Pending" becomes "Story 2.2"), and the e2e axe/keyboard check gets a row under NFR-6. Each e2e test registers its own Host. Tests that `drop table game` now need `cascade`.

**Never:**
- No drag and drop, no optimistic reorder, no confirmation dialog for "Slett", no undo.
- No read-only Question list for other states (Story 2.2), no Invite link panel, no Stage 2 stubs.
- No second lock path and no write to `question` outside the `questions` module. No query that resolves a `questionId` without the owned `gameId`.
- No new dependency, env var or Route Handler. No logging of Question text. Do not edit `.logs/`, `prompting/`, or this intent contract.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Add | draft, 2 Questions, new uuid, "  Hva?  " | row "Hva?" at position 3 | — |
| Edit | existing id, new text | text replaced, positions unchanged | — |
| Same id again | a save retried after a lost response | treated as an edit, no duplicate | — |
| Length | text "" / "   " / 201 chars / 200 chars | first three `INVALID_INPUT` with `fieldErrors.text` "Spørsmålet må ha 1–200 tegn.", nothing written; 200 saved | inline field error |
| 21st | 20 Questions, new uuid | `QUESTION_CAP_REACHED` "Du har nådd maks 20 spørsmål.", still 20 | inline status |
| Move | 3 Questions, move #3 up / #1 up | order 1,3,2 dense / unchanged | — |
| Remove | remove position 2 of 4 | remaining positions 1,2,3 in order | — |
| Wrong state | Game in each non-draft state; save, move, remove | `WRONG_STATE`, rows and positions unchanged | refresh + message |
| Foreign | B's Game, random/malformed gameId; A's Game with B's questionId (save, move, remove) | identical `NOT_FOUND`, nothing changed in either Game | refresh + message |
| Logged out | no session | redirect `/logg-inn`, nothing written | redirect not swallowed |
| Network | action POST aborted | status "Fikk ikke lagret. Prøv igjen.", text kept | retry on next blur |

</intent-contract>

## Code Map

- `src/server/db/schema.ts` -- add `question` after `game`; imports `integer`, `uniqueIndex` already present. `utc` not needed.
- `src/server/games/index.ts` -- `lockForMutation(tx, { hostId, gameId, states })` (throws `NOT_FOUND`/`WRONG_STATE`, touches `updated_at`), `getOwned(hostId, gameId)`, `withBoundary` + `getDb().transaction` pattern in `deleteOwned`. Reuse, do not change.
- `src/lib/game-state.ts` -- `PERMITTED.editQuestions = ["draft"]` already exists.
- `src/lib/errors.ts` -- `ErrorCode`, `MESSAGES`, `validate`, `toFailure`, `ActionResult`. `tests/unit/errors.test.ts` asserts exact messages.
- `src/lib/game.ts` -- schema style to copy for `src/lib/question.ts`. `src/lib/limits.ts` -- add the three limits.
- `src/app/spill/[id]/actions.ts` -- existing `deleteGame` shows `requireHost` / `unstable_rethrow` / `toFailure`; add the three actions next to it.
- `src/app/spill/[id]/page.tsx:47-58` -- the *draft* `case` with the `shortcut:` comment to replace. `ownedGame` is `cache()`d; `auth.requireHost()` is also cached per request.
- `src/components/CreateGameForm.tsx` -- counter pattern (trimmed length, `aria-hidden` counter, `sr-only` `aria-live` at the limit). `src/components/TextField.tsx` -- label/error/`aria-describedby` markup and classes to mirror on the textarea (`rounded-sm`, `border-line-strong`, 2 px `border-danger` when invalid, `px-2.75`). `src/components/Button.tsx` -- `ghost`, `secondary`, `pending`. `src/components/useFormAction.ts` -- NETWORK handling and `unstable_rethrow` convention.
- `eslint.config.mjs:11` -- module order already includes `questions` after `games`.
- `tests/integration/next-mocks.ts` -- `cookieJar`, `run` (FormData actions only; the new actions take an object, so call them directly).
- `tests/integration/authz.test.ts` -- Host A/B fixture, `rejection`; the final block does `drop table game` (needs `cascade`). `tests/integration/auth-internal.test.ts:36` -- same.
- `tests/integration/game-state.test.ts` -- `setState`, `codeOf`, the PERMITTED walk; add the question-op `WRONG_STATE` case.
- `tests/integration/delete.test.ts` -- recursive cascade walk; it now finds `question` and must stay green.
- `tests/e2e/fixtures.ts` -- `test`, `registerHost`, `FOCUS_RING`, `seriousViolations`, `tabThrough`. `tests/e2e/games.spec.ts` -- `createGame` helper pattern, asserts `/^Ingen spørsmål ennå\./` on a new Game (still true). `tests/e2e/delete.spec.ts` -- `page.route` abort pattern for an action POST.
- `tests/TRACE.md` -- `## FR-4` and `## NFR-6` sections.

## Tasks & Acceptance

**Execution:**
- `src/lib/limits.ts`, `src/lib/question.ts`, `src/lib/errors.ts` -- limits, zod schemas, `QUESTION_CAP_REACHED` -- AC1
- `src/server/db/schema.ts` + `npm run db:generate` -- `question` table, committed migration -- AC1
- `src/server/questions/index.ts` -- `list`, `save`, `move`, `remove` -- AC1, AC2
- `src/app/spill/[id]/actions.ts` -- three actions -- AC1–AC3
- `src/app/spill/[id]/page.tsx`, `src/components/QuestionEditor.tsx` -- editor in the *draft* panel, empty-state sentence, shortcut resolved -- AC3, AC4
- `tests/unit/question.test.ts` -- schema: "", "   ", 201 refused with the message; 1 and 200 accepted; trimmed; non-uuid questionId refused on save -- AC1
- `tests/integration/questions.test.ts` -- through the actions as Host A: add three, edit, move up/down (incl. first-up no-op), remove the middle; after every op `select position … order by position` is exactly `1..n` and texts are in the expected order; a retried save with the same id edits; 20 then the 21st → `QUESTION_CAP_REACHED` with the message and count stays 20; the length matrix; logged out redirects and writes nothing; `list` returns `{ id, text }` in order -- AC1
- `tests/integration/game-state.test.ts` -- for every non-draft state, `save` (new and existing id), `move` and `remove` are `WRONG_STATE` and the Question rows are unchanged -- AC2
- `tests/integration/authz.test.ts` -- B's save/move/remove on A's Game, a random UUID and `"abc"` → one identical `NOT_FOUND`, A's Questions and `updated_at` unchanged; A saving/moving/removing with B's questionId in A's own Game → `NOT_FOUND`, B's Question unchanged; `drop table game cascade` -- AD-5
- `tests/integration/auth-internal.test.ts` -- `drop table game cascade` -- keeps green
- `tests/e2e/questions.spec.ts` -- (a) new Game shows the full empty-state sentence; "Legg til spørsmål" + "0 av 20 spørsmål"; click focuses textarea "Spørsmål 1"; type, Tab → "Lagret"; reload keeps it and the sentence is gone; (b) counter absent at 159, "160 av 200 tegn" at 160; 201 characters → field error "Spørsmålet må ha 1–200 tegn." with `aria-invalid`; (c) three Questions: "Flytt ned" on #1 and "Flytt opp" on #3 reorder (verified after reload); first row has no "Flytt opp", last none "Flytt ned"; focus follows the moved Question; "Slett" removes and reload confirms; an empty draft blurred is not saved (reload shows none); (d) action POST aborted → "Fikk ikke lagret. Prøv igjen."; (e) 20 Questions → button gone, "Du har nådd maks 20 spørsmål." shown; (f) keyboard-only: every control reachable in reading order with the focus ring, each textarea has a visible label, axe has no serious or critical violations with Questions present and with an error shown -- AC3, AC4
- `tests/TRACE.md` -- FR-4 rows, NFR-6 row -- epic rule

**Acceptance Criteria (from epics.md, the contract):**
- AC1 (FR-4 · integration): Given a Game in *draft*, when the Host adds, edits, moves and removes Questions, then each Question holds 1 to 200 characters, positions stay dense `1..n` and are renumbered in the same transaction on every remove or reorder, and a 21st Question is refused with "Du har nådd maks 20 spørsmål."
- AC2 (FR-4 · integration): Given a Game in any state other than *draft*, when any add, edit, reorder or remove is attempted, then it is refused with `WRONG_STATE` and nothing changes.
- AC3 (FR-4 · e2e): Given the Question editor on the *draft* Game page, when the Host types a Question and tabs away, then it autosaves on blur and shows "Lagret" (or "Fikk ikke lagret. Prøv igjen." on failure), with a counter from 160 characters, and "Flytt opp", "Flytt ned" and "Slett" are buttons (no drag), "Legg til spørsmål" shows "N av 20 spørsmål" and disappears at 20, empty Questions are not saved, and an empty Game shows the EXPERIENCE.md empty-state sentence.
- AC4 (NFR-6 · e2e): Given the Question editor, when it is used by keyboard only and scanned by axe, then every action is reachable in reading order, every textarea has a visible label, and axe reports no serious or critical violations.

## Spec Change Log

## Review Triage Log

### 2026-11-22 — Review pass
- verdicts: 31 findings — high 0, medium 9, low 14, false 8, maybe-false 0
- findings:
  - `[medium]` `[patch]` Blind Hunter: "Slett" on a draft with typed text resurrects it, because the blur already sent the save — the row is marked dropped and a save that lands afterwards is followed by `removeQuestion`; nothing is sent when no save went out.
  - `[medium]` `[patch]` Blind Hunter: typing in the draft then clicking "Legg til spørsmål" only re-focused the draft being saved — "an unsaved draft" read as "a draft with no save sent" (the contract does not address in-flight saves); drafts are a short list, and add() reuses only an empty draft.
  - `[medium]` `[patch]` Blind Hunter: the length error appears after focus has left the field, so screen readers never hear it — the error element is always rendered with `aria-live="polite"`; `aria-invalid`/`aria-describedby` only with an error.
  - `[low]` `[reject]` Blind Hunter: clearing a saved Question gives no feedback — the intent contract specifies exactly this ("nothing is sent and the status clears"), a reload shows the kept text, "Slett" is the delete path, and any message would be invented copy that EXPERIENCE.md does not have.
  - `[low]` `[patch]` Blind Hunter: limits typed into messages, and the cap sentence duplicated in the client — the client now uses `MESSAGES.QUESTION_CAP_REACHED`; building messages from constants rejected (the Epic 1 convention hard-codes "1–80" too, ponytail item 10).
  - `[low]` `[reject]` Blind Hunter: a Question removed in another tab shows the Game-level NOT_FOUND message — rare multi-tab case, the refresh removes the row and its status with it; a fix needs new copy.
  - `[medium]` `[patch]` Blind Hunter: no test that a successful edit moves `game.updated_at` (FR-3 retention) — grouped with the verification-gap finding below; test added.
  - `[false]` `[reject]` Blind Hunter: deleting or purging a Game is not tested with Questions present — `delete.test.ts` asserts `ON DELETE CASCADE` on every foreign key under `game` from the catalog, which now includes `question`, so surviving Questions cannot happen.
  - `[low]` `[patch]` Blind Hunter: move/remove with a malformed `questionId` in the Host's own Game untested — integration test added (NOT_FOUND, nothing changes); separate move/remove schema unit tests rejected as duplicating the integration coverage.
  - `[low]` `[reject]` Blind Hunter: the page checks ownership twice — `questions.list` is an entry point and must enforce AD-5 itself; one primary-key query per page load.
  - `[low]` `[reject]` Blind Hunter: `writeOrder` rewrites every row — n ≤ 20 under the Game lock; a deferrable constraint cannot be expressed in the Drizzle schema without hand-edited migrations (AD-3).
  - `[false]` `[reject]` Blind Hunter: cast of `gameId` in `questionAction` — `revalidatePath` runs only after the module validated `gameId` as a string and `lockForMutation` accepted it as an owned UUID, so the cast cannot be wrong there.
  - `[low]` `[reject]` Blind Hunter: no retry button or leave-page guard after a failed save — the text stays in the field with "Fikk ikke lagret. Prøv igjen." and the next blur retries; EXPERIENCE.md reserves the leave-page warning for OnceLinkList.
  - `[false]` `[reject]` Blind Hunter: stale describe title in `auth-internal.test.ts` — the title still says what it drops (the auth tables and game); `cascade` only removes the foreign key, not a table.
  - `[medium]` `[patch]` Verification gap: successful save/move/remove never checked to bump `game.updated_at` — `questions.test.ts` resets it to T0 before each action and asserts it moved forward after.
  - `[medium]` `[patch]` Verification gap: the catch-up save after an in-flight save is untested — e2e holds the first POST, edits and Tabs again (no second POST), releases, then reload shows the newer text.
  - `[medium]` `[patch]` Verification gap: client handling of server error codes untested — e2e deletes the Game in a second page, then a blur in the first refreshes to "Vi finner ikke dette spillet."; the WRONG_STATE case is deferred to Story 2.2 (no UI path out of *draft* yet).
  - `[false]` `[reject]` Intent alignment: sprint status not updated and nothing committed — that is this workflow's finalize step, done after review.
  - `[false]` `[reject]` Intent alignment: the editor does not use `useFormAction` — the hook wraps `useActionState` for form submits; autosave on blur and button actions are not forms, and the editor keeps the hook's rethrow and network conventions.
  - `[false]` `[reject]` Intent alignment: domain failures show their own messages instead of "Fikk ikke lagret. Prøv igjen." — AC1 and EXPERIENCE.md require "Du har nådd maks 20 spørsmål." for the cap; network and internal failures show the AC3 sentence.
  - `[low]` `[patch]` Intent alignment: AC4 "keyboard only" exercised with `click()` — the NFR-6 test now adds Questions with Enter and moves one with Space, checking focus and order.
  - `[false]` `[reject]` Intent alignment: AC2 tested on the module, not the actions — AC2 asks for integration proof; the actions are thin wrappers proven in `questions.test.ts` and `authz.test.ts`.
  - `[medium]` `[patch]` Intent alignment: `updated_at` on success untested — same group as the verification-gap finding; test added.
  - `[medium]` `[patch]` Edge Case Hunter: draft "Slett" during an in-flight save resurrects the Question — same group as the first Blind Hunter finding.
  - `[low]` `[patch]` Edge Case Hunter: a field error stays when the text is emptied or reverted to the saved text before blur — the early returns now clear it.
  - `[low]` `[reject]` Edge Case Hunter: cleared saved Question with no feedback — same as the Blind Hunter row above.
  - `[low]` `[reject]` Edge Case Hunter: a row keeps local text when another tab changes it — rare multi-tab case; the fix adds a sync effect and a merge rule for text being typed.
  - `[low]` `[patch]` Edge Case Hunter: QUESTION_CAP_REACHED from another tab leaves a stale counter and Add button — the code is added to the refresh list.
  - `[low]` `[reject]` Edge Case Hunter: the Game deleted between `ownedGame()` and `questions.list()` gives the 500 page — a millisecond race, and the fix adds a second NOT_FOUND branch to the page.
  - `[low]` `[patch]` Edge Case Hunter: `onConflictDoNothing()` without a target would report a position conflict as NOT_FOUND — now `{ target: question.id }`.
  - `[false]` `[reject]` Edge Case Hunter: AC3 copy claim — same refutation as the intent-alignment row (the cap sentence is required).

### AI suggestions corrected or rejected (grading evidence)

- **Orchestrator corrected the implementer** after review: a deleted draft could come back, a normal "type, then Legg til spørsmål" flow needed two clicks, the length error was silent to screen readers, a stale error could stay, the cap from another tab left stale controls, and `onConflictDoNothing` was too broad. Four test gaps were closed (`updated_at` on success, a malformed id in the Host's own Game, the catch-up save, the client's NOT_FOUND refresh) and AC4 is now exercised by keyboard.
- **Planning corrected by the orchestrator:** two Epic 1 tests did `drop table game`, which fails once `question` references it, so they now use `cascade`; a server-assigned id for new Questions (the obvious first design) was rejected during planning in favour of a client UUID, because Next resolves an action before committing the revalidated tree, which would remount the row and drop keyboard focus.
- **Reviewer suggestions rejected:** feedback copy for a cleared Question, messages built from constants, a second ownership check skipped on the page, a deferrable unique constraint, a retry button and leave-page guard, multi-tab text sync, a NOT_FOUND branch for a millisecond race, Question-specific stale wording, and three claims refuted outright (cascade coverage, the `gameId` cast, the test title). Reasons are in the rows above.
- **Implementer departure accepted:** the status line keeps its height when empty, so the row buttons do not jump when "Lagret" appears.

## Design Notes

- **Client-generated Question id, one `save` upsert.** The draft row gets its UUID in the browser, so when the refreshed `questions` prop arrives the saved row has the same React key as the draft and keeps its DOM node, focus and status. Next resolves an action's promise before it commits the revalidated tree, so mapping a server-assigned id onto the draft would remount the row and drop keyboard focus. The same id also makes a retried save idempotent instead of creating a duplicate. AD-5 still holds: an id that belongs to another Game hits the primary key, `onConflictDoNothing` returns nothing, and the call is `NOT_FOUND`. `crypto.randomUUID` needs a secure context (https or localhost), which every supported setup is; this gets a `shortcut:` comment.
- **Empty text is never sent.** Clearing an existing Question and tabbing away sends nothing; the server keeps the last saved text, which a reload shows. This is the literal "empty Questions are not saved".
- **Rows follow the server.** Move and remove wait for the server (EXPERIENCE: no optimistic updates) and the order comes back through `revalidatePath`, so a stale tab converges on refresh instead of keeping a client-side copy of the order.
- **Positions with a unique index.** Postgres checks a non-deferrable unique index row by row, so an in-place shift can collide; writing negatives first and then `1..n` avoids it in two statements plus one update per row (n ≤ 20).

## Verification

**Commands:**
- `npm run lint && npm run format:check && npm run typecheck` -- expected: exit 0
- `npm test` -- expected: all pass offline
- `npm run test:e2e` -- expected: all specs pass
- `npx drizzle-kit check` and a second `npm run db:generate` -- expected: no new migration

**Manual checks:**
- The *draft* Game page at 1280 and 375 px with 0, 3 and 20 Questions and with an error: labels above textareas, row buttons wrap without horizontal scroll, nothing below 14 px, "Lagret" in success green, errors in danger red.

## Auto Run Result

Status: done

**Summary.** A Host writes the Game's Questions on the *draft* Game page. Each Question is a labelled textarea that autosaves on blur ("Lagret", or "Fikk ikke lagret. Prøv igjen."), with a counter from 160, "Flytt opp" / "Flytt ned" / "Slett" buttons and "Legg til spørsmål" with "N av 20 spørsmål", replaced by "Du har nådd maks 20 spørsmål." at 20. An empty Game shows the full EXPERIENCE.md sentence, which resolves the Epic 1 `shortcut:` comment. The `questions` module locks the Game through `lockForMutation(PERMITTED.editQuestions)`, so every write outside *draft* is `WRONG_STATE`, and keeps positions dense `1..n` in the same transaction. A save is an upsert keyed by a client-generated UUID, so retries do not duplicate and a foreign id is `NOT_FOUND`.

**Files.**
- `src/server/db/schema.ts`, `drizzle/0003_fresh_zaran.sql` + meta: the `question` table, cascading from `game`, unique `(game_id, position)`.
- `src/lib/{limits,question,errors}.ts`: limits, zod schemas, `QUESTION_CAP_REACHED`.
- `src/server/questions/index.ts`: `list`, `save`, `move`, `remove`.
- `src/app/spill/[id]/actions.ts`: `saveQuestion`, `moveQuestion`, `removeQuestion`.
- `src/app/spill/[id]/page.tsx`, `src/components/QuestionEditor.tsx`: the editor in the *draft* panel.
- Tests: `tests/unit/question.test.ts`, `tests/integration/questions.test.ts`, `tests/e2e/questions.spec.ts`; additions to `game-state.test.ts` and `authz.test.ts`; `cascade` in `authz.test.ts` and `auth-internal.test.ts`; `tests/TRACE.md` FR-4 and NFR-6 rows.

**Review.** 31 findings (high 0, medium 9, low 14, false 8). Patched 12 entries (medium 6, low 6). Deferred 1 (WRONG_STATE client e2e, Story 2.2). Rejected 18 with reasons in the triage log.

**Follow-up review recommended: true.** Six medium entries were patched, and the client draft and focus logic changed in the patch round (drafts as a list, delete during an in-flight save). Those paths are covered only by the new e2e tests; the "deleted draft shows for a moment before `removeQuestion`'s revalidation" flash is unverified by any test.

**Verification.** `lint`, `format:check`, `typecheck` clean; `npm test` 274 passed in 25 files; `npm run test:e2e` 53 passed; `drizzle-kit check` clean and a second `db:generate` produced nothing. All offline, no key. The implementer took screenshots at 1280 and 375 px with 0, 3 and 20 Questions and with an error.

**Residual risks.** Drafts beyond 20 (several unsaved rows at 19) are refused inline by the server rather than hidden; a dropped draft whose save lands can flash once; `crypto.randomUUID` needs a secure context (`shortcut:` comment).

**Spine amendments.** None: the module, lock path, dense positions and action result shape follow AD-1, AD-4, AD-5, AD-16 and AD-17 as written.
