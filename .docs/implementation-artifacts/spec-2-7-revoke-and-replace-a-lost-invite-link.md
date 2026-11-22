---
title: 'Story 2.7: Revoke and replace a lost Invite link'
type: 'feature'
created: '2026-11-22'
baseline_revision: 'c56514157a2715fd9a53cf989078ed3f9295e504'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/.docs/implementation-artifacts/epic-2-context.md'
  - '{project-root}/.docs/planning-artifacts/ux-designs/ux-Toppsvar-2026-11-21/DESIGN.md'
  - '{project-root}/.claude/skills/impeccable/reference/craft-floor.md'
warnings: [oversized]
deferred: []
---

<intent-contract>

## Intent

**Problem:** A Participant who loses an Invite link cannot answer, and the Host has no way to replace it (FR-9). Simply handing out another link would let one person hold two Answer sets, and a revoke that behaved differently for used and unused links would tell the Host who had answered.

**Approach:** Add the owner-checked mutation `collection.revokeInviteLink(hostId, { gameId, link })` behind a Server Action. In one transaction it locks the *collecting* Game, reserves one link through the shared link-issuing path (so the cap refuses first), deletes the pasted link by `(token_hash, game_id)` (its submission goes by cascade) and returns the one new link. The *collecting* Game page gets an "Erstatt en tapt lenke" panel: TextField, ConfirmDialog with fixed text, then OnceLinkList with one link. The four ACs of Story 2.7 in `epics.md` (repeated below) are the contract. AD-8 governs.

## Boundaries & Constraints

**Always:**
- The implementer first invokes the `ponytail` skill (level `full`), then `impeccable` (its launcher is not installed: take the "Launcher unavailable" path and read `reference/craft-floor.md` right before the UI edit). *Operate* mode. DESIGN.md and EXPERIENCE.md win on conflict. Every Norwegian string below is fixed copy: use it verbatim. Ponytail never cuts a requirement, validation, anonymity, accessibility or a test listed here. Do not commit; the orchestrator commits.
- **Shared copy and schema** (`src/lib/invite-link.ts`): `export const LINK_NOT_ACTIVE = "Denne lenken er ikke en aktiv lenke i dette spillet."` and `revokeInviteLinkSchema = z.object({ gameId: z.string(), link: z.string().catch("") })` (a non-string link becomes `""` and so `LINK_UNKNOWN`, never `INVALID_INPUT`).
- **One link-issuing path** (`src/server/collection/index.ts`): extract from `createInviteLinks` a private `issueLinks(tx: Tx, gameId: string, count: number): Promise<string[]>` that calls `games.reserveInviteLinks`, inserts the hashed Tokens and returns the full links. `createInviteLinks` uses it with unchanged behaviour.
- **`revokeInviteLink(hostId: string, input: unknown): Promise<{ link: string }>`** inside `withBoundary("collection", "revokeInviteLink", …)`, in one `db.transaction`, in this order:
  1. `validate(revokeInviteLinkSchema, input)`.
  2. `games.lockForMutation(tx, { hostId, gameId, states: PERMITTED.revokeInviteLink })`: missing, foreign and malformed Game IDs are its one `NOT_FOUND` (AD-5), any state but *collecting* is `WRONG_STATE`. This comes before any look at the link, so another Host learns nothing about it.
  3. `const [link] = await issueLinks(tx, gameId, 1)`: at 50 issued this throws `LINK_CAP_REACHED` and the transaction rolls back, so nothing changes and the old link stays active.
  4. Parse the pasted link: trim it, split at the last `#`; the part before must end with `/svar/${gameId}` and the part after must match `TOKEN_PATTERN`. The origin is not compared (APP_BASE_URL may differ between localhost and a LAN IP).
  5. `tx.delete(inviteLink).where(and(eq(tokenHash, sha256(token)), eq(gameId, gameId))).returning(...)`. If step 4 failed or no row was deleted: `throw new DomainError("LINK_UNKNOWN", { link: LINK_NOT_ACTIVE })`, which rolls back steps 2–3 too.
  6. Return `{ link }`. The success response has the same shape and the same side effects whether or not a submission existed; no code branches on the submission.
- **Server Action** `revokeInviteLink(input: unknown): Promise<ActionResult<{ link: string }>>` in `src/app/spill/[id]/actions.ts`, the same shape as `createInviteLinks` there (`requireHost`, `revalidatePath`, `unstable_rethrow`, `toFailure`).
- **`src/components/RevokeLinkPanel.tsx`** (`"use client"`, props `gameId`, `issued`), modelled on `InviteLinkPanel`:
  - Below the cap: `TextField` `name="link"` label "Lim inn lenken" (`inputMode="url"`, `autoComplete="off"`, `spellCheck={false}`, full width), and a `ConfirmDialog` with `triggerLabel="Trekk tilbake og lag ny"`, `triggerVariant="secondary"` (one primary per region: "Lag lenker" is the page's primary), `title="Trekke tilbake lenken?"`, body `<p>Alt som er sendt inn via den, slettes. Du får én ny lenke, som vises bare én gang.</p>`, confirm `Button variant="primary"` "Trekk tilbake og lag ny" with `pending` and `pendingLabel="Trekker tilbake …"`. The dialog text never depends on the link.
  - `beforeOpen`: clears the notice; an empty (trimmed) field sets the field error `LINK_NOT_ACTIVE`, focuses the field and keeps the dialog closed. No other client-side check.
  - On success: clear the field, show `<OnceLinkList links={[link]} />`; its `onDone` hides it and focuses the field (or the cap sentence when the field is gone).
  - On failure: `LINK_UNKNOWN` sets the field error from `fieldErrors.link`; every failure shows a danger `Notice` inside the dialog with `fieldErrors.link ?? message` (network failure: `NETWORK` from `useFormAction`) and focuses it, as `InviteLinkPanel` does inside its dialog. `WRONG_STATE`, `NOT_FOUND`, `LINK_CAP_REACHED` and a network failure also call `router.refresh()`.
  - At or above the cap (`issued >= INVITE_LINKS_MAX`) and with no new link on screen: only `<p tabIndex={-1}>` `MESSAGES.LINK_CAP_REACHED` instead of the field and button.
- **Game page** (`src/app/spill/[id]/page.tsx`), *collecting* only: keyed sections in this order `progress`, `links`, `revoke`, `locked`. The new section is `<section key="revoke" aria-labelledby="erstatt" className="mt-10">` with `<h2 id="erstatt" className="text-heading">Erstatt en tapt lenke</h2>` and `<RevokeLinkPanel gameId={game.id} issued={progress.issued} />`. Keep `links` a direct keyed sibling (no wrapper), or its once-only links are lost on the draft-to-collecting refresh; sections therefore stack, also on desktop.
- **Spine** (`ARCHITECTURE-SPINE.md`, AD-8 "Revoke" bullet): append "The entry point is `collection.revokeInviteLink(hostId, { gameId, link })`: the owner lock comes first (`NOT_FOUND`, `WRONG_STATE`), then the cap, then the link. The inline `LINK_UNKNOWN` carries the Host copy in `fieldErrors.link`, so the Participant's `LINK_UNKNOWN` message is unchanged."
- **Tests**: titles start with the IDs they prove. Each e2e test registers its own Host; a participant context uses `browser.newContext({ baseURL })` and `localOnly(context)`. In `tests/TRACE.md` add the FR-9 rows and remove "Pending: Story 2.7.".

**Never:**
- Never return, log or render whether the revoked link had a submission; never put the pasted link, its Token or hash in a log, URL or error. No `NOT_FOUND` or 404 page for a bad pasted link of an owned Game.
- No new table, column, migration, error code, env var or dependency. No change to the Participant-facing `LINK_UNKNOWN` message, `OnceLinkList`, `ConfirmDialog` or `CollectingRefresh`. No close button (Story 3.1). Do not edit `.logs/`, `prompting/`, `epics.md` or this intent contract.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Used link | *collecting*, link with a set | `{ ok: true, data: { link } }`; old row and its submission gone; issued +1; new link opens | — |
| Unused link | *collecting*, link without a set | same shape and same row/issued changes as above | — |
| Revoked link opened or submitted | after revoke | `openInviteLink` and `submitAnswerSet` equal the never-existing-link response | `LINK_UNKNOWN` |
| Malformed paste | `"abc"`, `""`, `42`, a bare Token, a 42-char Token, missing `#` | nothing changes (rows, issued, `updated_at`) | `LINK_UNKNOWN`, `fieldErrors.link` = LINK_NOT_ACTIVE |
| Other Game's link | B's link pasted into A (same Host) | nothing changes; B's link still opens | same `LINK_UNKNOWN` |
| Path of another Game | this Game's Token behind `/svar/<other id>` | nothing changes | same `LINK_UNKNOWN` |
| Already revoked | the same link revoked twice | second call changes nothing | same `LINK_UNKNOWN` |
| Cap | issued = 50, valid active link | nothing changes; old link still opens | `LINK_CAP_REACHED` "Spillet har nådd maks 50 lenker." |
| Wrong state | *draft* and *grouping* Game | nothing changes | `WRONG_STATE` |
| Foreign Host | Host B, A's Game and A's valid link; random UUID; `"abc"` | A's rows, issued and `updated_at` unchanged | one identical `NOT_FOUND` |
| Progress after real revoke | 4 links, 4 sets; revoke one, then another | `{ active: 4, issued: 5, submissions: 3 }`, then `{ active: 4, issued: 6, submissions: "fewer-than-3" }` | — |
| Logged out | no session | writes nothing | redirect to `/logg-inn` |

</intent-contract>

## Code Map

- `src/server/collection/index.ts:20-47`: `createInviteLinks`; lines 35-44 become `issueLinks`. `TOKEN_PATTERN`, `sha256`, `newToken`, `BASE_URL`, `inviteLink`, `games`, `PERMITTED`, `and`/`eq` are already imported; add `type Tx` from `@/server/db/client` and the new lib exports.
- `src/server/games/index.ts:101-131` `lockForMutation` (hostId-constrained, touches `updated_at`; `assertGameId` gives `NOT_FOUND`); `:152-169` `reserveInviteLinks` (the one cap check). Read-only.
- `src/lib/game-state.ts:50`: `PERMITTED.revokeInviteLink = ["collecting"]` already exists.
- `src/lib/errors.ts`: `DomainError(code, fieldErrors)`, `toFailure` passes `fieldErrors` through; `LINK_UNKNOWN`, `LINK_CAP_REACHED` messages. Read-only.
- `src/lib/invite-link.ts:1-17`: `createInviteLinksSchema`, `TOKEN_PATTERN`; add the schema and constant here.
- `src/app/spill/[id]/actions.ts:69-82`: `createInviteLinks` action, the pattern to copy.
- `src/components/InviteLinkPanel.tsx`: the panel to model on: `focusNext` effect (46-53), `REFRESH_ON`, failure handling (84-93), notice inside the dialog (97-142), cap sentence (167-170).
- `src/components/ConfirmDialog.tsx`, `OnceLinkList.tsx`, `TextField.tsx` (`error` prop renders "Feil: …" below), `Notice.tsx`, `Button.tsx` (`secondary`, `primary`, `pending`): reuse unchanged. `NETWORK` from `src/components/useFormAction.ts`.
- `src/components/CollectingRefresh.tsx`: skips `router.refresh()` while any `[data-link]` is in the DOM, so the revoke's OnceLinkList is covered too.
- `src/app/spill/[id]/page.tsx:82-110`: the `collecting` array; insert `revoke` after `links`.
- `tests/integration/collection.test.ts`: `collectingGame(title, count)` (66), raw `revoke(token)` (88, keep it for older tests), `UNKNOWN` (40), `describe("progress")` (609) with `send()` and `progressOf()`; actions are imported from `@/app/spill/[id]/actions` at the top. Pattern for a forced DB error with stderr capture at ~256.
- `tests/integration/authz.test.ts:290`: `describe("Invite links across Hosts")`, `as("B")`, `gameOfA`, `gameRow`, `hosts`.
- `tests/integration/invite-links.test.ts:255`: renders `GamePage` for a *collecting* Game.
- `tests/e2e/progress.spec.ts`: 360 px setup, `submitAll` participant helper; `tests/e2e/answer-form.spec.ts:30-72`: `createGame`, `addQuestion`, `openForm`; `tests/e2e/fixtures.ts`: `registerHost`, `localOnly`, `seriousViolations`.
- `tests/TRACE.md:101-111`: FR-9 section ending in "Pending: Story 2.7.".

## Tasks & Acceptance

**Execution:**
- `src/lib/invite-link.ts` -- add `LINK_NOT_ACTIVE`, `revokeInviteLinkSchema` -- shared by server and panel.
- `src/server/collection/index.ts` -- extract `issueLinks`, add `revokeInviteLink` -- AC1-AC3, AD-8.
- `src/app/spill/[id]/actions.ts` -- add `revokeInviteLink` action -- the UI entry point.
- `src/components/RevokeLinkPanel.tsx` -- new -- AC4, UX-DR8.
- `src/app/spill/[id]/page.tsx` -- add the `revoke` section in *collecting* -- AC4.
- `ARCHITECTURE-SPINE.md` -- AD-8 amendment as worded under Always.
- `tests/integration/collection.test.ts` -- `describe("revokeInviteLink")` through the Server Action, every matrix row except foreign Host and progress: assert `toEqual` on the whole result, the `invite_link` and `submission` rows, `inviteLinksIssued` and `updated_at` before and after; the new link matches `/svar/<gameId>#<43 chars>`, its hash row exists and it opens; a used and an unused revoke return results equal after replacing `data.link` and change the row counts the same way. A forced DB error (rename `invite_link`) returns `INTERNAL` and stderr holds one `{ module: "collection", op: "revokeInviteLink", code: "INTERNAL", sqlstate }` line with no Token, hash or link. In `describe("progress")` add the "progress after real revoke" row (the item Story 2.6 deferred). A *collecting* `GamePage` render holds "Erstatt en tapt lenke" and "Lim inn lenken"; a *draft* render holds neither.
- `tests/integration/authz.test.ts` -- foreign-Host row in `describe("Invite links across Hosts")`.
- `tests/e2e/revoke.spec.ts` -- new, at 360 × 740 (AC4): register, create a Game with one Question and 2 links; a participant submits through link 1. Paste link 1, click "Trekk tilbake og lag ny": the dialog "Trekke tilbake lenken?" shows the exact body and focus is on "Avbryt"; confirm: exactly one `[data-link]`, different from both old links, and "3 av maks 50 lenker brukt."; "Jeg har kopiert lenkene" returns focus to "Lim inn lenken". Repeat with the unused link 2: the dialog text is identical. Paste "abc" and confirm: the dialog shows the alert with LINK_NOT_ACTIVE; after "Avbryt" the field shows it as its error, the URL and the `h1` are unchanged (no 404). The participant context opens link 1 and sees "Vi finner ikke denne lenken."; the new link opens the form with the Game title. No horizontal scroll; `seriousViolations` empty with the dialog open and closed.
- `tests/TRACE.md` -- FR-9 rows (integration, authz, e2e); drop "Pending: Story 2.7.".

**Acceptance Criteria (from epics.md, the contract):**
- AC1 (FR-9 · integration): Given a *collecting* Game and one of its active links, with or without a saved Answer set, when the Host pastes the full link and confirms, then the link's row is deleted by `(token_hash, game_id)`, its submission goes with it by cascade, and one new link is created through `games.reserveInviteLinks`, and the response is identical whether or not an Answer set existed.
- AC2 (FR-9 · integration): Given a revoked link, when it is opened or used to submit, then it returns `LINK_UNKNOWN`, the same as a link that never existed.
- AC3 (FR-9 · integration): Given a pasted link that is malformed, belongs to another Game, or was already revoked, and separately a Game that has issued 50 links, when the Host tries to revoke, then the first case returns the inline `LINK_UNKNOWN` "Denne lenken er ikke en aktiv lenke i dette spillet." (never the 404 page), and the second returns `LINK_CAP_REACHED` "Spillet har nådd maks 50 lenker." before anything changes, leaving the old link active.
- AC4 (FR-9, UX-DR8 · e2e): Given the "Erstatt en tapt lenke" panel, when the Host pastes a link and clicks "Trekk tilbake og lag ny", then a ConfirmDialog always says "Trekke tilbake lenken? Alt som er sendt inn via den, slettes. Du får én ny lenke, som vises bare én gang.", and confirming shows the OnceLinkList with exactly one link.

## Spec Change Log

## Review Triage Log

### 2026-11-22 — Review pass
- verdicts: 29 findings — high 0, medium 0, low 22, false 7, maybe-false 0
- findings:
  - `[low]` `[patch]` Verification Gap: the panel's network-failure and refresh branch (`!result`, `REFRESH_ON`) has no test. Patched: `revoke.spec.ts` aborts the POST and asserts the focused `NETWORK` alert in the dialog and no `[data-link]`.
  - `[low]` `[patch]` Verification Gap: the blank-field guard in `beforeOpen` has no test. Patched: `revoke.spec.ts` fills "   ", clicks the trigger and asserts the dialog stays hidden, the field is focused and described by `Feil: ${LINK_NOT_ACTIVE}`.
  - `[low]` `[patch]` Verification Gap (other): a `LINK_CAP_REACHED` refresh swaps the panel to the cap sentence, unmounts the dialog and its notice, and focus falls to `<body>`. Verified in the code path. Patched: the focus effect falls back to the cap sentence (`noticeRef.current ?? capRef.current`).
  - `[false]` `[reject]` Intent alignment: AC3 puts the Host sentence on `LINK_UNKNOWN` itself, while the diff keeps `message` as the Participant copy and carries the sentence in `fieldErrors.link`. The Host sees the exact sentence inline under the field and in the dialog (e2e); changing `message` would change the Participant page, which AC2 requires to stay identical. Recorded in Design Notes.
  - `[false]` `[reject]` Intent alignment: the spine is amended, not only followed. The orchestrator asked for spine amendments to be reported, and the amendment only records choices the spine left open (order, `fieldErrors.link`); no AD-8 rule changes.
  - `[low]` `[patch]` Intent alignment: the cap-before-link order has no test with a bad link at the cap. Shares the root of the Blind Hunter cap-order row; patched there.
  - `[low]` `[patch]` Intent alignment: the blank-field case is tested only at the Server Action surface. Same root as the Verification Gap blank-field row; patched there.
  - `[low]` `[patch]` Intent alignment: the response-driven failure path in the panel has no browser test. Same root as the Verification Gap network row; the aborted-request test now drives the refresh-and-notice branch.
  - `[false]` `[reject]` Intent alignment: UX-DR8 says focus returns to the trigger, but the e2e pins focus on the field. `ConfirmDialog` still returns focus to the trigger on Avbryt and Esc; after a success the dialog unmounts and `OnceLinkList` takes focus, then the emptied field, exactly as `InviteLinkPanel` does in draft.
  - `[false]` `[reject]` Intent alignment: the progress count drops after revoking a used link. PRD FR-9 accepts this explicitly ("reveals participation but not content"); Story 2.6 rejected the same claim.
  - `[false]` `[reject]` Intent alignment: the call through `games.reserveInviteLinks` is checked only indirectly. The cap test fails if revoke bypasses `reserveInviteLinks`, since only that function raises `LINK_CAP_REACHED`.
  - `[low]` `[reject]` Blind Hunter: if the network drops after the server commits, the new link is never shown and a retry says the link is not active. Real but needs a lost response in a sub-second window; the refresh still updates "N av maks 50 lenker brukt.", `createInviteLinks` has the same trade-off, and a fix needs copy nobody has written.
  - `[low]` `[patch]` Blind Hunter: `LINK_CAP_REACHED`, `WRONG_STATE` and `NOT_FOUND` refreshes unmount the dialog and lose focus. Same root as the Verification Gap focus row; patched there for the cap. After `WRONG_STATE` the whole section is gone and the page shows the new state, so there is no panel element to focus.
  - `[low]` `[reject]` Blind Hunter: after a bad paste and Avbryt, focus goes to the trigger, not the field. UX-DR8 requires focus to return to the trigger, and the dialog's alert has already announced the same sentence.
  - `[low]` `[reject]` Blind Hunter: the one-link `OnceLinkList` keeps plural copy ("Kopier lenkene nå"). The copy is fixed in EXPERIENCE.md, which says revoke shows "OnceLinkList with one link"; the spec forbids editing the component.
  - `[low]` `[reject]` Blind Hunter: at the cap the page shows "Spillet har nådd maks 50 lenker." twice. EXPERIENCE.md prescribes this sentence for the cap "also on revoke"; each panel explains why its own action is unavailable, and new copy would be invented.
  - `[low]` `[patch]` Blind Hunter: no test shows the cap is checked before the link. Patched: the cap test also sends `"abc"` at 50 issued and expects `LINK_CAP_REACHED` with nothing changed.
  - `[low]` `[patch]` Blind Hunter: no test covers the blank-field guard, the network failure or `INTERNAL` in the panel. Same root as the two Verification Gap rows; patched there (`INTERNAL` takes the same `result.message` branch the abort test covers through `NETWORK`).
  - `[low]` `[patch]` Blind Hunter: `WRONG_STATE` is tested for only two of six non-collecting states. Patched: `it.each(NOT_COLLECTING)`.
  - `[low]` `[patch]` Blind Hunter: the `updatedAt >=` assertion in the success test cannot fail. Patched: deleted (the touch is not an AC, and a strict `>` could flake within one millisecond).
  - `[false]` `[reject]` Blind Hunter: `actions.ts` casts `input` it never validated. `collection.revokeInviteLink` validates before returning, so `revalidatePath` is reached only with a string `gameId`; it is the same pattern as `createInviteLinks` and `questionAction`.
  - `[low]` `[reject]` Blind Hunter: `link` has no maximum length. Next caps Server Action bodies at 1 MB, and a trim plus `lastIndexOf` on that is microseconds; a length rule adds a branch for no user-visible gain.
  - `[low]` `[patch]` Blind Hunter: `tokenOf` rejects a query string or trailing slash before `#`. Verified: such a link opens for the Participant (the route ignores the query), so revoke disagreed with the link page. Patched with one `replace(/\/?(\?.*)?$/, "")` and a test; trailing punctuation after the Token stays rejected, as it is on the link page.
  - `[false]` `[reject]` Blind Hunter: the e2e `.first()` trigger locator is fragile. `ConfirmDialog` always renders the trigger before the `<dialog>`, and the confirm button inside a closed dialog is not in the accessibility tree.
  - `[low]` `[reject]` Blind Hunter: `RevokeLinkPanel` duplicates `InviteLinkPanel`'s plumbing. The harm is a fix landing in one panel only; the fix is a new shared hook, which is more than a direct correction for two short components.
  - `[low]` `[reject]` Edge Case Hunter: network failure after the commit loses the new link. Same root and reason as the Blind Hunter commit-then-drop row.
  - `[low]` `[patch]` Edge Case Hunter: a refresh while the dialog is open loses focus. Same root as the Verification Gap focus row; patched there.
  - `[low]` `[reject]` Edge Case Hunter: closing the dialog while the request is pending puts an `INTERNAL` or `NETWORK` notice inside the closed dialog. Needs Esc within the request window (typically under 300 ms); `LINK_UNKNOWN` still shows under the field, and the fix needs dialog-open state the shared `ConfirmDialog` does not expose.
  - `[low]` `[patch]` Edge Case Hunter: a query string or trailing slash before `#` is rejected. Same root as the Blind Hunter `tokenOf` row; patched there.

### AI suggestions corrected or rejected (grading evidence)

- **Planner corrections to the plain reading of the story:**
  - The Host copy rides in `fieldErrors.link`, so the Participant's `LINK_UNKNOWN` message (AC2) never changes.
  - The owner lock comes before any look at the pasted link, so another Host always gets `NOT_FOUND` (AD-5).
  - The sections stack instead of following the desktop wireframe's two columns, because a wrapper would remount `InviteLinkPanel` and wipe the first batch of once-only links.
- **Implementer deviation accepted:** `invite-links.spec.ts` scoped its cap assertion to "Flere lenker", because the sentence now appears in both panels; the orchestrator also moved one import into alphabetical order.
- **Reviewer suggestions accepted (patched):** the cap focus fallback, query string and trailing slash in pasted links, and tests for the blank field, the aborted request, `"abc"` at the cap and every non-collecting state; one vacuous assertion deleted.
- **Reviewer suggestions rejected:** changing `message` to the Host copy, focus to the field instead of the trigger, singular `OnceLinkList` copy, new cap copy, a commit-then-drop warning, a length cap on `link`, a shared panel hook, and dialog-open tracking. Reasons are in the rows above.

## Design Notes

- **Cap before link.** AD-8 says the cap refuses "before anything changes". Reserving first inside the transaction makes the order literal; a bad link then rolls the reservation back. At the cap a bad link gets `LINK_CAP_REACHED`, which is fine: the panel hides its form at the cap anyway.
- **Owner lock before link.** A foreign Host must get `NOT_FOUND` whatever they paste, or the difference between `NOT_FOUND` and `LINK_UNKNOWN` would confirm the Game exists (AD-5).
- **`fieldErrors.link` instead of a new code.** `ErrorCode` is closed and `LINK_UNKNOWN`'s message is the Participant's copy. The Host copy rides in `fieldErrors.link`, which `toFailure` already passes through, and is "inline" in the sense of AC3: it lands under the field.
- **Stacked, not side by side.** EXPERIENCE's desktop wireframe puts "Flere lenker" and "Erstatt en tapt lenke" side by side. A grid wrapper would move the `links` section out of the keyed sibling list and remount `InviteLinkPanel` on the draft-to-collecting refresh, wiping the first batch of once-only links. The content column is 800 px, so stacking costs little.
- **Count drop.** Revoking a used link lowers the progress count; PRD FR-9 accepts this ("reveals participation but not content").

## Verification

**Commands:**
- `npm run lint && npm run format:check && npm run typecheck` -- expected: exit 0
- `npm run test` -- expected: all pass offline
- `npm run test:e2e` -- expected: all specs pass

**Manual checks:**
- At 360 px the panel's field is full width with the button below it, and the dialog fits without horizontal scroll.

## Auto Run Result

Status: done

**Summary.** While a Game is *collecting*, the Host can paste a lost Invite link into "Erstatt en tapt lenke", confirm the fixed warning and get one new link, shown once.
- **Server.** `collection.revokeInviteLink(hostId, { gameId, link })` runs one transaction: owner lock (`NOT_FOUND`, `WRONG_STATE`), then one link through the shared `issueLinks` path (`games.reserveInviteLinks`, so the cap refuses first), then the delete by `(token_hash, game_id)` with the submission going by cascade. A pasted link that is not an active link of the Game rolls everything back and returns `LINK_UNKNOWN` with "Denne lenken er ikke en aktiv lenke i dette spillet." in `fieldErrors.link`. The response and the side effects are the same whether or not the link had a set; no code reads the submission.
- **Page.** A `RevokeLinkPanel` section after "Flere lenker": "Lim inn lenken", a secondary "Trekk tilbake og lag ny" that opens the ConfirmDialog "Trekke tilbake lenken?" with the fixed body, then `OnceLinkList` with the one link. Failures stay inline (field error and a focused alert in the dialog), never a 404. At 50 issued the panel shows only the cap sentence.

**Files.**
- `src/lib/invite-link.ts`: `LINK_NOT_ACTIVE`, `revokeInviteLinkSchema`.
- `src/server/collection/index.ts`: `issueLinks` (shared with `createInviteLinks`), `tokenOf`, `revokeInviteLink`.
- `src/app/spill/[id]/actions.ts`: the `revokeInviteLink` Server Action.
- `src/components/RevokeLinkPanel.tsx`: the panel. `src/app/spill/[id]/page.tsx`: the `revoke` section in *collecting*.
- `ARCHITECTURE-SPINE.md`: the AD-8 "Revoke" amendment.
- Tests: `tests/integration/collection.test.ts` (every matrix row, the forced DB error, the page render, and the progress case through the real revoke), `tests/integration/authz.test.ts` (foreign Host), `tests/e2e/revoke.spec.ts` (AC4 at 360 px), `tests/e2e/invite-links.spec.ts` (cap sentence scoped per panel), `tests/TRACE.md` (FR-9 rows).
- `sprint-status.yaml`: 2-7 done (epic-2 stays in-progress). `epic-2-context.md`: recompiled after Story 2.6's spine amendment.

**Review.** 29 findings: high 0, medium 0, low 22, false 7, maybe-false 0.
- **Patched (low, 7 entries):** the focus loss when a cap refresh unmounts the dialog; query string and trailing slash before `#`; tests for the blank-field guard, the aborted request, `"abc"` at the cap and every non-collecting state; a vacuous `updatedAt` assertion deleted.
- **Deferred:** none.
- **Rejected:** 7 false and 8 low rows, each with its reason in the triage log.

**Follow-up review recommended: false.** No high or medium entry was patched.

**Verification.**
- `npm run lint`, `format:check` and `typecheck` are clean.
- `npm run test`: 389 passed in 29 files.
- `npm run test:e2e`: 81 passed.
- Everything ran offline with no key.
- Screenshots at 360 and 1280 px: the field is full width with the secondary button below it, the field error reads cleanly, and the dialog fits at 360 px without horizontal scroll.

**Residual risks.**
- A network drop after the server commits loses the new link; the refreshed "N av maks 50 lenker brukt." is the only hint.
- Revoking a used link lowers the progress count, which PRD FR-9 accepts.
- Closing the dialog during a pending request hides an `INTERNAL` or network notice.
- The panel flow is only proven in Chromium.

**Spine amendments.** AD-8 "Revoke" now adds: the entry point is `collection.revokeInviteLink(hostId, { gameId, link })`; the owner lock comes first (`NOT_FOUND`, `WRONG_STATE`), then the cap, then the link; the inline `LINK_UNKNOWN` carries the Host copy in `fieldErrors.link`, so the Participant's `LINK_UNKNOWN` message is unchanged.
