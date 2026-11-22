---
title: 'Story 2.4: Answer form and first submission'
type: 'feature'
created: '2026-11-22'
baseline_revision: 'c02de8bf9f161eadfd0c799daa44556df015bfdc'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/.docs/implementation-artifacts/epic-2-context.md'
  - '{project-root}/.docs/planning-artifacts/ux-designs/ux-Toppsvar-2026-11-21/DESIGN.md'
  - '{project-root}/.claude/skills/impeccable/reference/craft-floor.md'
  - '{project-root}/.claude/skills/design-taste-frontend/references/copy-tells.md'
warnings: [oversized]
deferred:
  - summary: >-
      The lock-time error mapping and link re-check in collection.submit (a close, revoke or delete racing a submit after resolveLink) have no test.
    evidence: |-
      Every closed/unknown/revoked integration case is stopped by resolveLink before the transaction, so deleting the NOT_FOUND/WRONG_STATE mapping or the linkExists(tx) re-check passes all tests. Settle by stubbing games.find to return a stale collecting state, or by racing collection.close (Story 3.1) against a submit; neither pattern exists yet. If the mapping broke, a racing Participant would see INTERNAL or WRONG_STATE instead of the closed/unknown page.
    location: >-
      src/server/collection/index.ts:132-139
    severity: medium (unverified)
---

<intent-contract>

## Intent

**Problem:** An open Invite link shows only a read-only list of Questions (Story 2.3). A Participant cannot give Answers, nothing is stored, and the anonymity notice FR-14 requires is missing (FR-6, FR-7, FR-11, FR-14).

**Approach:** Replace the list with an `AnswerForm` (anonymity notice, one fieldset per Question, 1 to 5 fields, submit-only validation with an error summary). Add the `submission` table, the pure `src/lib/answer-set.ts` schema shared by client and server, the module entry point `collection.submit` and the Server Action `submitAnswerSet`. The browser makes a 32-byte edit secret and keeps it, with the full Token, in the link's single `localStorage` key. Settle 2.3's deferred item: the key is removed only when its stored Token equals the current Token exactly. Story 2.4's six ACs in `epics.md` (repeated below) are the contract. AD-4, AD-7, AD-8 and AD-17 govern.

## Boundaries & Constraints

**Always:**
- The implementer first invokes `ponytail` (level `full`), then `impeccable` (no launcher: use the "Launcher unavailable" path and read `reference/craft-floor.md` right before UI edits). This is *Operate* mode on a phone at 360 px. DESIGN.md and EXPERIENCE.md win on conflict. For microcopy, check `copy-tells.md`, but every Norwegian string below is fixed copy: use it verbatim. Ponytail never cuts a requirement, validation, error handling, accessibility, anonymity or a test listed here.
- **Limits** (`src/lib/limits.ts`): `ANSWER_TEXT_MAX = 80`, `ANSWER_COUNTER_FROM = 60`, `ANSWERS_PER_QUESTION_MAX = 5`.
- **`src/lib/answer-set.ts`** (pure, the AD-8 schema). It exports `ANSWER_MISSING = "Skriv minst ett svar."`, `ANSWER_TOO_LONG = "Svaret kan ha maks 80 tegn."` and `parseAnswerSet(input: unknown, questionIds: readonly string[]): Record<string, string[]>`.
  - The input is a record of Question ID to the raw field values in field order. Each value is trimmed. A trimmed value over 80 characters fails with key `` `${qid}.${fieldIndex}` `` (`fieldIndex` is the raw 0-based field index). An array of more than 5 entries, or anything that is not an array, fails with key `qid`. After the empties are dropped, a Question with no Answer fails with key `qid` and `ANSWER_MISSING`.
  - Every `questionIds` entry absent from the input fails with key `qid` and `ANSWER_MISSING`. Every input key not in `questionIds` fails with its own key. A non-object input fails.
  - Any failure throws `DomainError("INVALID_INPUT", fieldErrors)`. Success returns `{ [qid]: trimmed non-empty strings in field order }`, so `rank = index + 1`. Build it with zod where that fits; the field-index key is the reason `validate()` cannot be reused as is.
- **`src/lib/invite-link.ts`** gains the link store, which holds one JSON value per `storageKey(gameId, token)`: `type LinkStore = { token: string; editSecret?: string }`. Every function wraps storage access in `try` (storage can throw) and never throws itself.
  - `readLinkStore(gameId, token): LinkStore | null` returns the parsed value only if its `token === token` exactly. A value that is missing, unparseable or has a different Token gives `null`.
  - `writeLinkStore(gameId, store: LinkStore)` writes the value.
  - `clearLinkStore(gameId, token)` removes the key only when `readLinkStore` returns non-null.
  - `newEditSecret()` returns 32 bytes from `crypto.getRandomValues`, as base64url without padding, via `btoa`. Do not use `crypto.subtle` or `Uint8Array.toBase64`: the first is missing on plain `http://<LAN-IP>` and the second on older phones. It matches `TOKEN_PATTERN`.
- **`LinkStatus`** replaces its `removeItem` with `clearLinkStore(<2nd path segment>, location.hash.slice(1))`. Orchestrator decision, recorded in Design Notes.
- **Schema** (`src/server/db/schema.ts`): `submission` has `token_hash text PRIMARY KEY REFERENCES invite_link(token_hash) ON DELETE CASCADE`, `answers jsonb NOT NULL` (typed `Record<string, string[]>`) and `edit_secret_hash text NOT NULL`. It has **no timestamp, ordinal or other column** (FR-12). Comment the reason. Generate the migration with `npm run db:generate` and commit `drizzle/0005_*.sql` with its snapshot and journal entry. Never hand-write it.
- **`collection.submit(gameId: unknown, token: unknown, input: unknown): Promise<void>`** in `withBoundary("collection", "submit", …)`. The order follows AD-7.
  - (1) The same lookup as `openInviteLink`: non-string or unknown Game → `LINK_UNKNOWN`, then state not in `PERMITTED.submitAnswers` → `COLLECTION_CLOSED`, then a bad Token pattern or no `invite_link` row for `(sha256(token), gameId)` → `LINK_UNKNOWN`. Extract one private helper used by both entry points, and keep `openInviteLink`'s behaviour unchanged.
  - (2) `input` must be an object with `editSecret` a string matching `TOKEN_PATTERN`, otherwise `INVALID_INPUT` with field `editSecret`. Then `parseAnswerSet(input.answers, ids of questions.ofGame(gameId))`. This read is outside the transaction: Questions are frozen once the Game leaves *draft*, and a `getDb()` query inside a PGlite transaction deadlocks.
  - (3) `db.transaction`: `games.lockForMutation(tx, { gameId, states: PERMITTED.submitAnswers })` with **no `hostId`**, so `updated_at` is not touched. Map its `NOT_FOUND` → `LINK_UNKNOWN` and `WRONG_STATE` → `COLLECTION_CLOSED`. Re-check the `invite_link` row on `tx` → `LINK_UNKNOWN`. Upsert `submission` with `{ tokenHash, answers, editSecretHash: sha256(editSecret) }` and `onConflictDoUpdate` on `token_hash`, setting both columns: one row per link, and a later submit replaces the set and its secret (AD-8).
  - Nothing is written on any failure.
- **Action** `submitAnswerSet(gameId: unknown, token: unknown, input: unknown) → Promise<ActionResult<null>>` in `src/app/svar/[gameId]/actions.ts`. It calls the module and uses `toFailure` on error, like `openInviteLink`. No auth, no `revalidatePath`.
- **`InviteLinkView`** keeps the Token it opened with (`location.hash.slice(1)` at load) in the `open` view. In the `open` case it renders the `<h1>` title and then `<AnswerForm gameId token questions />`, in place of the `<ol>`.
- **`AnswerForm`** (`src/components/AnswerForm.tsx`, client). Each item is in render order.
  1. **Error summary** (only after a failed validation): `Notice tone="danger"` with `tabIndex={-1}`, focused when shown. Its first line is `"{n} spørsmål mangler svar"` when n ≥ 1 Questions are missing, else `MESSAGES.INVALID_INPUT`. Under it, a list with one link per Question that has any error, text `"Spørsmål N: {text}"` and `href="#sporsmal-N"`. The link's `onClick` calls `preventDefault()`, focuses that fieldset's first input and scrolls it into view. A changed fragment would trigger `InviteLinkView`'s `hashchange` reload and overwrite the Token.
  2. **Anonymity notice**: `Notice tone="info"` with exactly "Ingen kan se hvem som skrev hvilket svar, heller ikke verten. Verten leser likevel alle svarene slik de er skrevet." (no other text inside).
  3. **Instruction** `<p>`: "Gi 1–5 svar per spørsmål. Skriv det første du kommer på i Svar 1."
  4. **`<form noValidate>`**: one `<fieldset id="sporsmal-N">` per Question, styled per DESIGN.md AnswerFieldset (surface card, `rounded-md`, `p-4`; error: 2 px `danger` border and the error text first in the card). The legend's accessible text is "Spørsmål N av M: {text}". Visually "Spørsmål N av M" is in `label` and the text in `title`, and the colon may be `sr-only`.
     - Two `TextField`s by default, "Svar 1" and "Svar 2 (valgfritt)". Added fields are "Svar N (valgfritt)".
     - Inputs carry `maxLength={80}`, `autoComplete="off"`, `autoCapitalize="sentences"` and `enterKeyHint="next"`. From 60 trimmed characters a visible counter `"N/80"` shows (`aria-hidden`). One `sr-only` polite region in the form announces `"80 av 80 tegn"` when the edited field reaches 80.
     - "Legg til svar" (`ghost`, with an inline SVG plus, `aria-hidden`; no Unicode glyph) adds a field, focuses it, and is gone at 5 fields.
     - Fields 3 to 5 have a `ghost` "Fjern" with `aria-label="Fjern svar N"`. It removes that field and focuses the previous field.
     - Errors: a missing Question puts `ANSWER_MISSING` first inside its fieldset and sets `aria-invalid` and `aria-describedby` on its first field. A field error (`qid.i`) uses that field's TextField `error`.
  5. **Progress** `<p>` "N av M spørsmål har svar". N counts Questions with at least one non-blank field. It is not sticky and not live.
  6. **Other failure** `Notice tone="danger"`: `NETWORK_SUBMIT` = "Fikk ikke sendt svarene. Sjekk nettet og prøv igjen. Utkastet ditt ligger fortsatt på denne enheten." for a rejected call (after `unstable_rethrow`), or the failure's `message` for `INTERNAL` and any other unhandled code. The form keeps every value.
  7. **Submit** `Button variant="primary" type="submit"`, "Send inn svar", or "Lagre endringer" after a success in this session. It is `pending` with `pendingLabel="Sender …"`.
  8. **Helper** `<p>` under the button: "Utkastet lagres bare på denne enheten. Sender du inn fra en annen enhet, erstatter det de forrige svarene."
- **Submit flow**: validation runs on submit only. Run `parseAnswerSet(fields, questionIds)` in the browser first. On `DomainError` show the summary and inline errors and **send nothing**.
  - If it passes: `stored = readLinkStore(gameId, token)`, `editSecret = stored?.editSecret ?? newEditSecret()`, and `writeLinkStore(gameId, { ...stored, token, editSecret })` **before** the call, so a response lost after commit still leaves the matching secret. Then call `submitAnswerSet(gameId, token, { answers: fields, editSecret })`.
  - `INVALID_INPUT` with `fieldErrors` → the same summary and inline rendering.
  - `COLLECTION_CLOSED` → replace the form with `Notice tone="danger"` "Innsamlingen ble stengt før svarene dine kom fram, så de ble ikke lagret." and `clearLinkStore(gameId, token)`.
  - `LINK_UNKNOWN` → `<LinkStatus status="unknown" />`.
  - Success → replace the form with `<h2 tabIndex={-1}>` "Svarene dine er lagret." (focused), `<p>` "Du kan endre dem på denne enheten og i denne nettleseren helt til verten stenger innsamlingen.", and `Button variant="secondary"` "Se eller endre svarene". That button shows the form again with the submitted values and the label "Lagre endringer", and focuses the `<h1>`.
- **ESLint**: add `src/components/AnswerForm.tsx` to the `/svar` zone, plus a `lint-zones` case.
- **Spine** (`ARCHITECTURE-SPINE.md`, AD-8 Edit secret bullet): the key's value is JSON `{ token, editSecret }` (Story 2.5 adds the draft). It is removed only when its stored Token equals the current Token exactly. One device reuses its secret across submits. The secret has the Token's shape (43 base64url characters). The Server Action is `submitAnswerSet`, and the module entry point is `collection.submit`.
- **Manual checklist**: create `tests/manual/checklist.md` with a short intro and rows A2, A3 and A4, copied from EXPERIENCE.md's Accessibility Floor table.
- **Tests**: titles start with the IDs they prove. Each e2e test registers its own Host. In `tests/TRACE.md`, add FR-6, FR-7, FR-11, FR-14, NFR-4 and NFR-6 rows, and add FR-9 rows for the key-removal change. Remove "Story 2.4" from those "Pending" lists, and remove "None yet." where a row now exists.

**Never:**
- Never log or put in a URL any Token, hash, edit secret, Answer or action argument (AD-17). The submission row gets no timestamp, and no Host-visible value changes on submit, `game.updated_at` included (AD-8).
- Never send a request with Answer text before "Send inn svar", and never store a draft (Story 2.5). There is no returning notice, no pre-fill from the server and no `editSecret` parameter on `openInviteLink` (Story 2.5).
- Never hash in the browser, and never use `crypto.subtle`. Never put the full Token in the key name.
- No new dependency, env var, Route Handler or error code. Do not edit `.logs/`, `prompting/`, or this intent contract.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| First submit | collecting, valid Token, every Question with fields like `[" a ", "", "c"]`, valid secret | `ok`; one `submission` row: `token_hash = sha256(token)`, answers `{ q: ["a","c"] }`, `edit_secret_hash = sha256(secret)`; `game.updated_at` unchanged | — |
| Second submit, same link | a row exists | still one row, answers and secret hash replaced | — |
| Missing Question | key absent, or only blank fields | `INVALID_INPUT`, `fieldErrors[qid] = "Skriv minst ett svar."`, no row | summary + inline |
| Over-long | trimmed 81 chars at field index 1 (80 is accepted) | `INVALID_INPUT`, `fieldErrors["qid.1"] = "Svaret kan ha maks 80 tegn."`, no row | under that field |
| Too many / unknown / malformed | 6 entries; extra unknown Question ID; answers not an object or a value not an array; `editSecret` missing or not 43 base64url chars | `INVALID_INPUT`, no row | summary with `MESSAGES.INVALID_INPUT` |
| Bad link | non-string, malformed, unknown, foreign or revoked Token; missing or malformed Game | `LINK_UNKNOWN`, no row | unknown page |
| Not collecting | each of the six other states | `COLLECTION_CLOSED`, no row | "Innsamlingen ble stengt før …", key cleared |
| Revoke after submit | `invite_link` row deleted | the `submission` row is gone (cascade) | — |
| DB error | `submission` renamed | `INTERNAL`; one log line with only `{ module, op, code, sqlstate }`, no Token, hash, secret or Answer | danger Notice, values kept |
| Network | action POST aborted | "Fikk ikke sendt svarene. Sjekk nettet og prøv igjen. Utkastet ditt ligger fortsatt på denne enheten." | values kept |
| Link store | stored `token` equals current / shares only the first 16 chars / value unparseable / storage throws | clear removes / keeps / keeps; read returns value / null / null / null | never throws |

</intent-contract>

## Code Map

- `src/components/InviteLinkView.tsx`: `fetchView` reads the hash (add `token` to the open view), and its `open` case renders the `<ol>` to replace. The `hashchange` reload is why summary links must `preventDefault`. The retry focus and the title `MutationObserver` stay as they are.
- `src/components/LinkStatus.tsx:19-27`: the `removeItem` to swap for `clearLinkStore`.
- `src/lib/invite-link.ts`: `TOKEN_PATTERN` and `storageKey`. Add the link store here. The file is already client-safe, because `LinkStatus` imports it.
- `src/lib/errors.ts`: `DomainError`, `FieldErrors`, `MESSAGES.INVALID_INPUT`, `toFailure`. The existing `validate()` keys only by `path[0]`.
- `src/lib/question.ts`: a zod schema pattern with a constant message. `src/lib/limits.ts`: limit names.
- `src/server/collection/index.ts:57-85`: the `openInviteLink` lookup to extract into a shared helper. `createInviteLinks` shows the transaction and `lockForMutation` usage.
- `src/server/games/index.ts:100-130`: `lockForMutation`. Without `hostId` it has no owner filter and no `updated_at` write, and it throws `NOT_FOUND`/`WRONG_STATE`. `find` returns null for malformed IDs.
- `src/server/questions/index.ts:58-66`: `ofGame(gameId)` uses `getDb()`, so call it outside the transaction.
- `src/server/db/schema.ts`: `inviteLink` (for the FK reference). `drizzle/`: migrations 0000 to 0004, generated by `npm run db:generate`.
- `src/app/svar/[gameId]/actions.ts`: add `submitAnswerSet` beside `openInviteLink`.
- `src/components/TextField.tsx`: label, `error` with an `sr-only` "Feil: ", `counter`, `aria-describedby`. It generates its id with `useId`, so focus fields via refs or a `data-` attribute, not by guessed ids. `CreateGameForm.tsx:28-71` shows the counter and the `sr-only` limit announcement. `Button.tsx`: `pending`/`pendingLabel`, `ghost`/`secondary`. `Notice.tsx`: `ref`, `tabIndex`; `danger` is `role="alert"`.
- `src/components/useFormAction.ts`: `NETWORK` is a different string. The answer form uses its own `NETWORK_SUBMIT`.
- `eslint.config.mjs`: the `/svar` zone's file list. `tests/unit/lint-zones.test.ts`: the case table.
- `tests/integration/collection.test.ts`: `collectingGame()` (real Tokens and 3 Question IDs), `setState`, `revoke`, `NOT_COLLECTING`. The forced-DB-error test at line 212 is the pattern for renaming a table and capturing stderr. Add a `describe("submitAnswerSet")` here.
- `tests/e2e/invite-link-page.spec.ts`: `createGame`, `addQuestion`, `collectingGame`, `openWithSeededKey` (seeds `"utkast"`, which must now be `JSON.stringify({ token })`), `storedValue`, `noHorizontalScroll`. Two tests assert `getByRole("listitem")`, and these must assert the fieldset legend instead. `tests/e2e/fixtures.ts`: `registerHost`, `seriousViolations`, `localOnly`.
- `tests/unit/token.test.ts`: the `storageKey` test, beside which the link-store tests go.

## Tasks & Acceptance

**Execution:**
- `src/lib/limits.ts`, `src/lib/answer-set.ts`: limits, messages, `parseAnswerSet`. Covers AC3 and AC4.
- `src/lib/invite-link.ts`, `src/components/LinkStatus.tsx`: link store and `newEditSecret`; exact-Token removal. Covers AC5 and the 2.3 decision.
- `src/server/db/schema.ts`, `drizzle/0005_*` (generated): the `submission` table. Covers AC5.
- `src/server/collection/index.ts`, `src/app/svar/[gameId]/actions.ts`: shared lookup helper, `submit`, `submitAnswerSet`. Covers AC3 to AC5.
- `src/components/AnswerForm.tsx`, `src/components/InviteLinkView.tsx`: the form, the summary, the confirmation and the failure states. Covers AC1 to AC6.
- `eslint.config.mjs`, `tests/unit/lint-zones.test.ts`: `AnswerForm.tsx` in the `/svar` zone. Covers AC6 and AD-6.
- `.docs/planning-artifacts/architecture/architecture-Toppsvar-2026-11-21/ARCHITECTURE-SPINE.md`: the AD-8 amendment, as worded under Always.
- `tests/unit/answer-set.test.ts`: every `parseAnswerSet` row of the matrix (trim, empties dropped, order, 80 accepted and 81 refused with the index key, 6 entries, missing key, all-blank, unknown key, non-object). Covers AC3 and AC4.
- `tests/unit/token.test.ts`: the link-store rows of the matrix, against a `Map`-backed `localStorage` stub on `globalThis` and a stub whose methods throw. `newEditSecret()` matches `TOKEN_PATTERN` and two calls differ. Covers AC5.
- `tests/integration/collection.test.ts`: every server row of the matrix through the `submitAnswerSet` action, asserting the `submission` rows directly. This includes `game` unchanged after the first submit, the cascade on revoke, and the DB-error log line. Covers AC3 to AC5.
- `tests/e2e/answer-form.spec.ts` (new; copy the helpers, with a Game of two Questions):
  - (a) At 360 px: the exact notice, the instruction and the helper line. Legends and labels. Input attributes. Three "Legg til svar" clicks give 5 fields, with focus on each new one and then no button. "Fjern svar 4" focuses Svar 3. No counter at 59 characters, "60/80" at 60. The progress line goes from "0 av 2" to "1 av 2". No horizontal scroll at 360 px and at 320 px. Axe finds nothing serious. No "Logg ut", "Mine spill" or `@`.
  - (b) Submit with Question 2 empty: the summary "1 spørsmål mangler svar" is focused and links "Spørsmål 2: …". "Skriv minst ett svar." is in fieldset 2, and its first field is `aria-invalid`. No POST with a `next-action` header is sent. Clicking the link focuses Question 2's Svar 1, and `location.hash` is still the Token.
  - (c) Remove `maxlength` with `page.evaluate`, type 81 characters, and submit: "Svaret kan ha maks 80 tegn." shows under that field.
  - (d) A complete submit with an empty Svar 2 and a filled Svar 3: the confirmation heading is focused, with the body and the button. The `localStorage` value at `storageKey` parses to `{ token: <link token>, editSecret: /^[A-Za-z0-9_-]{43}$/ }`. "Se eller endre svarene" shows the form with the values and "Lagre endringer".
  - (e) An aborted submit POST shows the network sentence, and the typed values are still there.
  - Covers AC1 to AC6, NFR-4 and NFR-6.
- `tests/e2e/invite-link-page.spec.ts`: seed the JSON value, swap `listitem` for the legend, and add a test. That test seeds the real link's key with `{ token: real }`, then opens `/svar/<gameId>#<real.slice(0,16)>x`. The unknown page shows, and the real key's value is unchanged. This covers the 2.3 decision and FR-9.
- `tests/manual/checklist.md`: A2, A3, A4. Covers AC6.
- `tests/TRACE.md`: the rows as listed under Always. This is the epic rule.

**Acceptance Criteria (from epics.md, the contract):**
- AC1 (FR-14 · e2e): Given an open Invite link, when the answer form renders, then above the first Question it shows, as an info Notice, exactly "Ingen kan se hvem som skrev hvilket svar, heller ikke verten. Verten leser likevel alle svarene slik de er skrevet."
- AC2 (FR-6, NFR-4, UX-DR9, UX-DR19 · e2e): Given the answer form on a 360 px viewport, when the Participant fills it in, then:
  - each Question is a fieldset with "Svar 1" and "Svar 2 (valgfritt)";
  - "Legg til svar" adds fields up to five and then disappears;
  - fields 3 to 5 have "Fjern" (`aria-label="Fjern svar N"`) with the focus rules of UX-DR9;
  - inputs carry `maxlength="80"`, `autocomplete="off"`, `autocapitalize="sentences"` and `enterkeyhint="next"`, and a counter appears from 60 characters;
  - "Gi 1–5 svar per spørsmål. Skriv det første du kommer på i Svar 1." sits under the notice;
  - "N av M spørsmål har svar" sits above "Send inn svar", with the one helper line "Utkastet lagres bare på denne enheten. Sender du inn fra en annen enhet, erstatter det de forrige svarene." below it;
  - and there is no horizontal scroll.
- AC3 (FR-6 · integration + e2e): Given a form where some Questions have no Answer, when the Participant submits, then nothing is stored on the server, an error summary listing the missing Questions takes focus with a link to each fieldset, and each affected fieldset shows "Skriv minst ett svar."; and on a complete submit, empty fields are ignored and each Answer is stored with rank = field order.
- AC4 (FR-6 · integration): Given a submit that bypasses the browser limits, when it carries an Answer over 80 characters, more than five Answers, a missing Question or an unknown Question ID, then `collection.submit` refuses it against `src/lib/answer-set.ts` and the stored Question IDs, and an over-long Answer shows "Svaret kan ha maks 80 tegn." under its field.
- AC5 (FR-6, FR-7, AD-8 · integration + e2e): Given a first complete submit, when it succeeds, then exactly one `submission` row keyed by the link's `token_hash` holds the Answer set and `sha256` of a 32-byte edit secret generated in the browser and kept under `toppsvar:<gameId>:<first 16 chars of token>`; and the form is replaced by "Svarene dine er lagret." with "Du kan endre dem på denne enheten og i denne nettleseren helt til verten stenger innsamlingen." and the button "Se eller endre svarene".
- AC6 (FR-6, FR-11, NFR-6 · e2e + manual): Given the answer form, when it is inspected and scanned, then it shows no name, email, account indicator or other identity, a network failure shows "Fikk ikke sendt svarene. Sjekk nettet og prøv igjen. Utkastet ditt ligger fortsatt på denne enheten.", and axe reports no serious or critical violations; and checklist items A2 (keyboard only), A3 (screen reader) and A4 (360 px, 320 px, 200 % zoom) are added to `tests/manual/checklist.md`.

## Spec Change Log

## Review Triage Log

### 2026-11-22 — Review pass
- verdicts: 41 findings — high 0, medium 7, low 21, false 11, maybe-false 2
- findings:
  - `[low]` `[reject]` Blind Hunter: index-keyed field errors (`qid.i`) point at the wrong field after "Fjern". Only over-long errors are index-keyed, and those are reachable only when the browser's `maxlength` is bypassed, because the shared parser runs first. Re-keying errors on removal adds a branch for a path no Participant meets.
  - `[low]` `[reject]` Blind Hunter: the summary list can be empty for `editSecret`/`answers`/unknown-key errors. Our client always sends every Question ID and a valid secret, so only a hand-crafted request gets there, and the heading still says what to do.
  - `[low]` `[reject]` Blind Hunter: summary links focus Svar 1 even for a field error on Svar 3. Same bypass-only path as above; the spec's rule is the fieldset's first input.
  - `[low]` `[patch]` Blind Hunter: the counter and announcement count trimmed characters while `maxLength` stops raw characters, so with spaces typing stops at "78/80" with no announcement. Fixed: both now use the raw `value.length`.
  - `[low]` `[reject]` Blind Hunter: "80 av 80 tegn" is announced only once. Every keystroke below 80 resets the region to "", so a second field reaching 80 by typing changes the text again. Only a paste straight after the first field hit 80 stays silent. This is the house pattern (`CreateGameForm`).
  - `[low]` `[reject]` Blind Hunter: the confirmation promises editing even when storage failed. This happens only with blocked storage, and the device-editing promise is Story 2.5's read. Telling the form about a write failure adds a new state for a rare case.
  - `[medium]` `[patch]` Blind Hunter: no e2e covers what happens after the server answers (closed, unknown, server field errors, `INTERNAL`). Fixed: a new e2e test rewrites a real submit response to each of the four codes and asserts the sentence and focus, the cleared key, the unknown page, the alert with values kept, and the server field error under its field.
  - `[medium]` `[patch]` Blind Hunter: no test shows one device keeps its secret. Fixed: test (d) presses "Lagre endringer" and asserts the stored `editSecret` is unchanged.
  - `[low]` `[patch]` Blind Hunter: e2e checks visibility, not the order AC1/AC2 state. Fixed: test (a) asserts DOM order (notice before the instruction before the first fieldset; progress before the submit button before the helper line).
  - `[low]` `[patch]` Blind Hunter: TRACE.md says "five fields" for the scroll check, which runs with four. Fixed the wording.
  - `[low]` `[reject]` Blind Hunter: no test guards "no timestamp column on `submission`". Story 3.2's anonymity schema test is planned to fail on any timestamp column outside `host`, `session` and `game`. The column list is in this story's generated migration.
  - `[false]` `[reject]` Blind Hunter: unknown input keys are echoed back, and the response grows with the request. The echo reaches only the sender, the Server Action body is capped by Next's body limit, and `questionIds` has at most 20 entries. No one else is harmed.
  - `[low]` `[reject]` Blind Hunter: a bad `editSecret` is reported before Answer errors. Our client always sends a valid secret, so only a hand-crafted request needs two round trips.
  - `[low]` `[reject]` Blind Hunter: the spec does not match the code (secret shape check, `onUnknown`, visible colon, `TextField` pass-through). The fix is to edit this build's spec. The departures are recorded under Auto Run Result instead.
  - `[medium]` `[patch]` Blind Hunter: the cut-short-link e2e guards a negative assertion with `networkidle`, so it can pass before `LinkStatus`'s effect runs. Fixed: it now waits for a frame and a task after the unknown heading shows, then asserts the value is unchanged.
  - `[low]` `[reject]` Blind Hunter: the malformed-input unit cases only assert `toBeDefined()`. The keys the UI renders (`qid`, `qid.i`) are asserted exactly in other unit and integration tests. The `answers`/`editSecret` keys are never rendered per field.
  - `[low]` `[reject]` Blind Hunter: the anonymity notice is a live region (`role="status"`), and the closed Notice is focused with `role="alert"`. EXPERIENCE and the AC require the info Notice, which is the house component with that role. The double read on the closed state is the same pattern as the existing error notices.
  - `[false]` `[reject]` Intent alignment: nothing is committed, the triage log is empty, and the sprint status is unchanged. The audit ran at review; finalization writes and commits all three.
  - `[low]` `[patch]` Intent alignment: the decision is recorded in the 2.4 spec, not in 2.3, where the item was deferred. Fixed: the 2.3 spec's Auto Run Result gets a "resolved in Story 2.4" note.
  - `[low]` `[reject]` Intent alignment: the mangled-token tests use only the 17-character shape, not a 43-character Token differing after character 16. Both go through the same exact `token ===` comparison that the unit test asserts; the e2e page path is the same `LinkStatus`.
  - `[medium]` `[patch]` Intent alignment: AC4's over-long display is proven only on the client path. Same root cause as the post-response row above; the rewritten `INVALID_INPUT` response now shows the server's field error under its field.
  - `[maybe-false]` `[defer]` Intent alignment: the lock-and-re-check race is untested. Same root cause as the Verification Gap race row below.
  - `[low]` `[reject]` Intent alignment: no test ties the browser's stored secret to the database hash. E2e cannot read the server's PGlite. Integration proves the stored hash is `sha256` of the secret sent, and e2e proves the browser sends and keeps one secret.
  - `[false]` `[reject]` Intent alignment: layout order is not asserted. This was patched under the Blind Hunter order row; it is the same item.
  - `[false]` `[reject]` Intent alignment: the summary link focuses the first input and leaves the fragment unchanged. That is by design: a changed fragment would reload the page through `InviteLinkView`'s `hashchange` handler and replace the Token.
  - `[low]` `[patch]` Intent alignment: axe runs only on the clean form. Fixed: tests (b) and (d) also scan the error summary and the confirmation.
  - `[false]` `[reject]` Intent alignment: `TextField` was edited and `tests/manual/checklist.md` was added outside scope. The checklist is AC6, and the `TextField` merge is needed to tie the first field to the fieldset error (UX-DR9).
  - `[false]` `[reject]` Intent alignment: `epic-2-context.md` was not recompiled. It was recompiled and committed as `c02de8b` before the baseline, so it is not in the diff. This story's AD-8 amendment makes it stale again, and the next story recompiles it.
  - `[false]` `[reject]` Intent alignment: the upsert and "Lagre endringer" go beyond "first submission". Without the upsert, the "Se eller endre svarene" button the AC requires leads to a primary-key `INTERNAL`. AD-8's replace rule is defended in Design Notes.
  - `[false]` `[reject]` Intent alignment: "the spec" is ambiguous between 2.3 and 2.4. The decision is now in both (see the patched row above).
  - `[false]` `[reject]` Intent alignment: the skill invocations are not visible in the diff. They are process, not code. The implementer reported invoking `ponytail` and `impeccable` and taking screenshots at 360 and 320 px.
  - `[medium]` `[patch]` Verification Gap: the closed and unknown submit outcomes are never exercised. Same root cause and fix as the post-response row.
  - `[medium]` `[patch]` Verification Gap: server field errors and `INTERNAL` never reach the form in a test. Same root cause and fix.
  - `[medium]` `[patch]` Verification Gap: secret reuse and the write before the call are unverified. Test (d) asserts reuse; test (e) asserts that `{ token, editSecret }` is stored after the aborted POST.
  - `[low]` `[patch]` Verification Gap: the field-only summary text and link are unchecked. Test (c) asserts `MESSAGES.INVALID_INPUT` and the "Spørsmål 1: …" link.
  - `[low]` `[patch]` Verification Gap: the "80 av 80 tegn" announcement is untested. Test (a) fills 80 characters and asserts the polite region.
  - `[maybe-false]` `[defer]` Verification Gap: the transaction's `NOT_FOUND`/`WRONG_STATE` mapping and the link re-check after `resolveLink` are untested. To settle it, stub `games.find` to return a stale state, or race a close against a submit. Neither pattern exists in the repo. Deferred, with an if-true grade of medium.
  - `[low]` `[reject]` Edge Case Hunter: index-keyed errors after "Fjern". Same claim as the first Blind Hunter row: reachable only by bypassing `maxlength`. Rejected there as low.
  - `[low]` `[patch]` Edge Case Hunter: raw versus trimmed length at the 80 limit. Same root cause as the Blind Hunter counter row, and patched there.
  - `[false]` `[reject]` Edge Case Hunter: a hash change during a pending submit lets the old response replace the new view. The `hashchange` handler calls `location.reload()`, so the old component and its pending promise are gone.
  - `[false]` `[reject]` Edge Case Hunter: an own `__proto__` key slips past the unknown-key check. The assignment to `errors.__proto__` is ignored, but `answers` is built only from `questionIds`, so the extra key is never stored or used. Nothing reaches the database.

### AI suggestions corrected or rejected (grading evidence)

- **Orchestrator correction of 2.3's deferred fix:** the reviewer had suggested skipping removal unless `TOKEN_PATTERN` matched. That would still let a 43-character Token sharing the first 16 characters clear the real key. The orchestrator replaced it with an exact-Token match on a stored full Token.
- **Planner corrections to the spine reading:** AD-7 (`submitAnswerSet`) and AD-8/AC4 (`collection.submit`) name different functions; both names were kept, for the action and the module. The plan found two things the spine did not say. A summary link that changes the fragment would reload the page and drop the Token. A `getDb()` read inside the transaction would deadlock PGlite.
- **Implementer departures accepted:**
  - `onUnknown` instead of rendering `LinkStatus` inside the form: two `<h1>`s would break the one-`<h1>` rule.
  - A visible legend colon: Chrome read an `sr-only` colon as "2 :".
  - The missing-answer error sits under the legend: HTML requires the legend first in a fieldset.
  - A stored secret is reused only if it has the right shape.
  - `TextField` merges caller `aria-*` attributes.
- **Reviewer suggestions corrected after review:** the counter and maxlength mismatch, the untested response branches, the unproven secret reuse and write-before-call, the order and announcement checks, axe on the error and confirmation states, the `networkidle` wait, and the TRACE wording.
- **Reviewer suggestions rejected:**
  - Re-keying errors on "Fjern", handling an empty summary list, focusing the errored field and reporting a bad `editSecret` together with Answer errors: all reachable only by bypassing `maxlength` or by a hand-crafted request.
  - Signalling a storage write failure.
  - A no-timestamp schema test: Story 3.2 owns it.
  - Capping echoed keys.
  - A 43-character mangled-token case.
  - Replacing the house `Notice` role.
  - Three claims refuted outright: the pending-submit race across a `hashchange`, the `__proto__` key, and the out-of-scope upsert.
  - Reasons are in the rows above.

## Design Notes

- **Key removal: exact Token only (orchestrator decision on 2.3's deferred item).** The key holds only the first 16 Token characters, so a link cut short or mangled by a messenger maps to the real link's key. Since 2.4 that key holds the edit secret, and from 2.5 the draft. The value now stores the full Token, and the closed and unknown pages remove the key only when the stored Token equals the current one. AC3/AC4 of 2.3 still hold for the actual link. Accepted cost: the full Token now sits in `localStorage`. That is the same exposure EXPERIENCE already accepts for browser history holding the link, and the key *name* still never holds the whole Token.
- **Naming.** AD-7 says submits go through `submitAnswerSet`, and AD-8 and AC4 say `collection.submit`. Both are used: the Server Action is `submitAnswerSet`, and the module entry point is `collection.submit`.
- **Upsert now, not in 2.5.** The primary key permits one row per link. Without `onConflictDoUpdate`, a second submit (after "Se eller endre svarene") would hit a primary-key violation and become `INTERNAL`. Replacing the set is AD-8's rule anyway, and Story 2.5 adds the secret-gated read.
- **One parser for both sides.** The browser runs the same `parseAnswerSet` before sending, so the client's missing and over-long errors and the server's refusals share one key format and one renderer. The server still re-checks against the stored Question IDs (AC4).
- **Secret written before the call.** If the response is lost after commit, the device still holds the matching secret. If the submit fails, a stored secret without a row is harmless: 2.5's read then simply returns nothing, exactly like an unused link.

## Verification

**Commands:**
- `npm run lint && npm run format:check && npm run typecheck`: expected exit 0
- `npm test`: expected all pass offline
- `npm run test:e2e`: expected all specs pass

**Manual checks:**
- Answer form at 360 px and 320 px: one column, 16 px gutter, cards not cramped, the counter and "Fjern" not overlapping the label, and no horizontal scroll.

## Auto Run Result

Status: done

**Summary.** An open Invite link now shows the answer form instead of a read-only list.
- **Form.** The exact two-sentence anonymity notice, then the instruction line and one fieldset per Question ("Spørsmål N av M: …"). Each fieldset has "Svar 1" and "Svar 2 (valgfritt)", "Legg til svar" up to five fields, "Fjern svar N" with the UX-DR9 focus rules, the input attributes, a raw-length counter from 60, the progress line, "Send inn svar" and the one helper line.
- **Validation.** It runs on submit only, through the same `parseAnswerSet` the server uses. Missing Questions give a focused error summary whose links focus the fieldset without touching the fragment, plus the inline "Skriv minst ett svar.". An over-long field gives "Svaret kan ha maks 80 tegn.".
- **Storing.** A valid submit generates (or reuses) a 32-byte edit secret in the browser and stores `{ token, editSecret }` under the link's key before calling `submitAnswerSet`. `collection.submit` repeats the AD-7 lookup and validates against the stored Question IDs. It then locks the Game without a Host ID (no `updated_at` touch), re-checks the link under the lock, and upserts the link's single `submission` row with `sha256(editSecret)`.
- **Results.** Success shows "Svarene dine er lagret." with the device sentence and "Se eller endre svarene". Closed, unknown, `INTERNAL`, field-error and network outcomes each have their own copy.
- **2.3 deferred item.** The closed and unknown pages now clear the key only when the stored Token equals the current one exactly.

**Files.**
- `src/lib/limits.ts`, `src/lib/answer-set.ts`: the answer limits, the two messages and `parseAnswerSet`, shared by client and server.
- `src/lib/invite-link.ts`: `LinkStore`, `readLinkStore`, `writeLinkStore`, `clearLinkStore` (exact Token only) and `newEditSecret`. `src/components/LinkStatus.tsx` uses `clearLinkStore`.
- `src/server/db/schema.ts`, `drizzle/0005_shallow_dakota_north.sql` with its snapshot and journal: the `submission` table (token_hash PK/FK cascade, answers jsonb, edit_secret_hash; no timestamp).
- `src/server/collection/index.ts`: `resolveLink` is shared by `openInviteLink` (behaviour unchanged) and the new `submit`. `src/app/svar/[gameId]/actions.ts`: `submitAnswerSet`.
- `src/components/AnswerForm.tsx` (new), `src/components/InviteLinkView.tsx` (renders the form, keeps the opened Token, `onUnknown` refocus), `src/components/TextField.tsx` (merges caller `aria-describedby`/`aria-invalid`).
- `eslint.config.mjs`, `tests/unit/lint-zones.test.ts`: `AnswerForm.tsx` is in the `/svar` auth ban.
- Tests:
  - `tests/unit/answer-set.test.ts` (new) and the link-store tests in `tests/unit/token.test.ts`.
  - `describe("submitAnswerSet")` in `tests/integration/collection.test.ts`.
  - `tests/e2e/answer-form.spec.ts` (new: six tests).
  - `tests/e2e/invite-link-page.spec.ts`: JSON seeds, fieldset instead of list, and the cut-short-link test.
- Docs: `tests/manual/checklist.md` (new: A2, A3, A4), `tests/TRACE.md` (FR-6, FR-7, FR-9, FR-10, FR-11, FR-14, NFR-4, NFR-6), the AD-8 amendment in `ARCHITECTURE-SPINE.md`, a resolution note in the 2.3 spec, and `sprint-status.yaml` (2-4 done).

**Implementer departures from the spec wording (accepted).**
- `AnswerForm` takes `onUnknown`, so `InviteLinkView` renders the unknown page: two `<h1>`s otherwise.
- The legend colon is visible: Chrome read an `sr-only` colon as "2 :".
- The missing-answer error is the first thing after the legend: HTML requires the legend to come first.
- A stored secret is reused only if it has the Token's shape.
- `TextField` merges caller `aria-*` attributes.

**Review.** 41 findings: high 0, medium 7, low 21, false 11, maybe-false 2.
- **Patched (13 rows):**
  - Three medium entries: the untested post-response branches (closed, unknown, `INTERNAL`, server field errors); the unproven secret reuse and write-before-call; the `networkidle` negative wait.
  - Six low entries: the raw-length counter and announcement, the AC1/AC2 order assertions, the field-only summary assertions, the "80 av 80 tegn" assertion, axe on the summary and confirmation, and the TRACE wording and 2.3 spec note.
- **Deferred (1):** the race path's lock-time error mapping, medium (unverified).
- **Rejected:** 27 rows, each with its reason in the triage log.

**Follow-up review recommended: true.** Three medium entries were patched. The specific unverified risks:
- The new rewritten-response e2e depends on the RSC flight body of a Server Action (it asserts the replaced string is present, so it fails loudly rather than silently).
- The close or revoke race inside `collection.submit` is still untested (deferred).

**Verification.**
- `npm run lint`, `format:check` and `typecheck` are clean.
- `npm test`: 354 passed in 29 files.
- `npm run test:e2e`: 76 passed. In the first full run, one pre-existing Story 1.4 test (`games.spec.ts:204`, skeleton timing) failed once under parallel load; it passed on re-run and again in the final full run.
- Everything ran offline with no key. The implementer checked the form at 360 and 320 px with screenshots: empty, error and confirmation states, one column, no overlap, no horizontal scroll.
- Manual checks A2 to A4 (keyboard only, screen reader, 200 % zoom on a real phone) are still to be run by the group.

**Residual risks.**
- The full Token now sits in `localStorage` (orchestrator decision; the same exposure as browser history).
- A storage failure leaves the confirmation's device-editing promise unbacked.
- A close racing a submit relies on untested lock-time mapping.
- `games.spec.ts:204` is timing-sensitive under load.

**Spine amendments.** The AD-8 edit-secret bullet now states:
- The key's value is JSON `{ token, editSecret }` with the full Token.
- One device reuses its secret.
- The secret has the Token's shape.
- The key is cleared only when the stored Token equals the current one exactly.
- Submits go through the Server Action `submitAnswerSet`, whose module entry point is `collection.submit`.
