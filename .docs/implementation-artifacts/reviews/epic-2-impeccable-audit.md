# Epic 2 UI audit (impeccable `audit` + `harden`)

Branch `epic-2-innsamling`, 2026-11-22. Scope: `git diff epic-1-fundament..epic-2-innsamling`. Modes: Operate for the Host pages, a short mobile task at 360 px for the Participant answer form. Contract, which wins on conflict: `DESIGN.md` and `EXPERIENCE.md` in `ux-Toppsvar-2026-11-21`.
Method: source audit of the Epic 2 components and routes, plus contrast computed from the token values. The app was not run in a browser, so the 360 px layout and the keyboard behaviour are judged from classes and code, and anything inferred that way is marked. The impeccable launcher was unavailable, so project context was read directly. `craft-floor.md` and the copy tells were read.

Verdict: a careful, contract-faithful epic. Tokens are used throughout (no hex values, arbitrary sizes or off-scale text classes were added; the only fractional values are `p-3.75` and `px-2.75`, which offset a 2 px border so the box does not jump). Focus management is unusually good: error summary, field add and remove, dialog, copy list and retry all move focus deliberately. Every input is 16 px, every target is 44 px or more, and the anonymity notice matches the contract word for word. The findings are one behaviour bug on the answer form, a cluster of plain-text-looking destructive buttons, and a few recovery and title gaps.

## Audit Health Score

| # | Dimension | Score | Key finding |
|---|---|---:|---|
| 1 | Accessibility | 3 | Enter submits the form despite `enterkeyhint="next"` (M1); participant pages share one title (S4) |
| 2 | Performance | 4 | Polling stops with the state; delayed skeleton and spinner respect reduced motion |
| 3 | Theming | 4 | Tokens only; no dark mode by contract |
| 4 | Responsive | 3 | 360 px holds from classes; nothing found that overflows (not rendered) |
| 5 | Implementation integrity | 3 | Ghost buttons stand in for destructive actions (S1, S2); a few retry instructions have no control (S3) |
| | Total | 17/20 | Good |

Contrast, computed: `text-success` "Lagret" on paper 6.0, `text-danger` on paper 6.7, `ink-muted` on paper and surface 6.9 and 7.4, `primary` on `primary-soft` 7.4, `ink` on `primary-soft` above 14. All pass AA. The 60 % opacity on `aria-disabled` primary lands near 3.3:1, but disabled controls are exempt from 1.4.3 and the contract fixes the 60 %.

## Must

**M1. Enter in an answer field submits the form, although the key is labelled "Neste".** `src/components/AnswerForm.tsx:393` sets `enterKeyHint="next"`; the `<form>` at line 349 has a submit button and there is no `onKeyDown` anywhere in the file. In a browser, Enter in a text input of a form with a submit button is an implicit submit. On a phone the key will say "Neste" and instead send the form: with unanswered Questions the Participant gets the red error summary after the first answer; with every Question answered the set is sent before the optional Svar 2 to 5 are written. The e2e test only asserts the attribute (`tests/e2e/answer-form.spec.ts:127`). Not run in a browser; this is standard form behaviour.
Fix: on the answer inputs, `onKeyDown` for Enter calls `preventDefault()` and focuses the next `input` in the form. On the last input, let Enter submit. The contract keeps "validation on submit only", which this respects. Add an e2e step: type in Svar 1, press Enter, expect focus on Svar 2 and no error summary.

## Should

**S1. "Forkast endringene" looks like body text and throws away typing with no way back.** `AnswerForm.tsx:323-330`. A `ghost` button is transparent with `text-ink`, so inside the `primary-soft` notice it reads as a second sentence, with no border, underline or colour; only hover shows it is a control. It also discards the restored draft at once. The contract names the ghost variant, so keep it, but give this instance an affordance.
Fix: add `text-primary underline underline-offset-2` to this button's `className` (primary on `primary-soft` is 7.4:1). The discard stays immediate: the draft only exists on this device, and the notice already says what it holds. If the group wants a guard, a ConfirmDialog is the existing pattern, but a one-tap discard of one's own unsent text is arguably fine for a short form.

**S2. Three ghost words in a row on every saved Question, one of them destructive and immediate.** `src/components/QuestionEditor.tsx:324-374`. "Flytt opp", "Flytt ned" and "Slett" are all `ghost`, so they look like a line of plain labels. "Slett" removes a saved Question at once, with no confirmation and no undo (the contract specifies the button but not its variant or a guard).
Fix: render "Slett" as `secondary-danger` (the variant exists, DESIGN.md allows it for deletes), and "Flytt opp" and "Flytt ned" as `secondary`, or keep them ghost with `underline`. Optionally skip a confirm for a one-line Question, but show it when the text is longer than a short sentence. Remove the `-ml-2` style hacks only if needed.

**S3. Retry instructions with no retry control.** `QuestionEditor.tsx:30` ("Fikk ikke lagret. Prøv igjen.") shows in the status line under the textarea with nothing to press; the only way to retry is to focus the field and blur it again. The same pattern was flagged in the Epic 1 audit (S1) for the 500 page. Compare the answer form, which does it right: the failure sits above a submit button that retries.
Fix: when the status is a failure, render a small `secondary` button "Prøv igjen" next to it that calls `save()`. Keep the text.

**S4. Participant states after the first load all carry the title "Toppsvar".** `src/components/InviteLinkView.tsx:78` sets `"{title} – Toppsvar"` for the open form only. Closed, unknown, failed and the error and not-found routes keep the generic title (`svar/page.tsx:9`, `svar/not-found.tsx`). Epic 1 raised the same as M1 (WCAG 2.4.2). The server shell being generic is a deliberate contract choice (AD-7); the three status pages are not.
Fix: closed "Innsamlingen er stengt – Toppsvar", unknown and not-found "Vi finner ikke lenken – Toppsvar", failed "Noe gikk galt – Toppsvar". Render a React `<title>` inside `LinkStatus`, as `ServerError.tsx:8` already does. These strings reveal nothing the page body does not.

**S5. "Åpne innsamlingen?" locks the Questions without saying how many, and a failed or unsaved row is silently dropped.** `InviteLinkPanel.tsx:137-141`. The dialog counts on `questionCount` from the server render. A row whose save failed, is mid-save, or is over 200 characters is not in that count, and the locked list that replaces the editor shows only what the server has. The Host has no way to notice the missing Question before it is locked for good. Source inference; not exercised.
Fix: add the count to the dialog text: "Du har {questionCount} spørsmål. De låses når du lager de første lenkene, og kan ikke endres etterpå." The contract sentence stays intact. Optionally refuse to open the dialog while any `QuestionRow` shows a danger status.

## Nice

**N1. Desktop panels stacked, not two columns (known item).** `src/app/spill/[id]/page.tsx:99-104`. The EXPERIENCE wireframe puts "Flere lenker" and "Erstatt en tapt lenke" side by side, but DESIGN.md (Layout & Spacing) says the Game page is one column, max 800 px, and `HostChrome.tsx` sets `max-w-200` (800 px). DESIGN wins on a layout conflict, so the code is right and the wireframe is the stale part. At 800 px two panels would be about 380 px each, which squeezes the pasted-link field. Fix the wireframe, not the code, and record it in the contract as the decided layout.

**N2. "Kopier alle" duplicates "Kopier" for a single link.** `OnceLinkList.tsx:87-94`. In the revoke flow the list holds one link, so two copy buttons sit above and beside it. Hide "Kopier alle" when `links.length === 1`.

**N3. Empty-state sentence points at a missing control.** `QuestionEditor.tsx:28`: "Skriv det første ..." appears with no field; the only control is "Legg til spørsmål" below. Same family as Epic 1 S4. Either reword to "Legg til det første spørsmålet, ...", or render one empty draft row when the list is empty, which also removes a click.

**N4. Revoke with an empty field reports "not an active link".** `RevokeLinkPanel.tsx:114` reuses `LINK_NOT_ACTIVE`. For an empty field "Lim inn lenken først." is truer. The contract fixes the sentence for a pasted non-active link only.

**N5. Over-length Question counter stays muted.** `QuestionEditor.tsx:302`. The textarea has no `maxLength` (the error comes on blur), so "212 av 200 tegn" renders in `ink-muted`. Switch to `text-danger` above the limit; the number already carries the meaning, so the colour is only a boost.

**N6. Anonymity notice is a live region.** `Notice.tsx:4`: every `info` notice is `role="status"`, including the static anonymity text (`AnswerForm.tsx:339`). It is announced politely once at load and adds nothing. Give `Notice` a `role` override or drop it for static copy. Low impact.

**N7. Failed and loading states have no heading.** `InviteLinkView.tsx:95-122` render a paragraph or a notice with no `h1`, so a screen-reader user lands on a page with no heading. Cheap fix: an `h1` "Toppsvar" is already there only as a `<p>` in the chrome; give the failed state an `h1` "Fikk ikke kontakt". Also consider a `<noscript>` line in the loading state, since without JavaScript "Henter spørsmålene ..." would show forever after its 300 ms delay.

**N8. Cancel stays live in the dialog while a request runs.** `ConfirmDialog.tsx:59-66`. Closing during "Åpner ..." does not cancel the call; the links still arrive and the OnceLinkList takes focus. Harmless, but `aria-disabled` on Cancel while `pending` would remove the surprise.

## Checklist results

| Check | Result |
|---|---|
| Tokens only | Pass. No hex, `text-sm`/`xs`, grey or arbitrary values added |
| Type scale | Pass. Display 32 on titles and the progress figure, heading 24, title 18, body 16, body-sm and label 14; nothing under 14 px |
| Focus | Pass. Global 3 px `ink` ring on light surfaces; programmatic focus on summary, notice, heading, fields and retry button |
| Contrast | Pass, see the figures above |
| Keyboard path | One failure, M1. Error summary links jump to the field; dialog starts on Cancel and returns to its trigger; added and removed fields keep focus |
| Error association | Pass. `TextField` joins caller description, helper and error ids; the per-Question error is linked to Svar 1 with `aria-invalid`; "Feil:" is hidden-text prefixed. The fieldset itself carries no description, which is acceptable |
| Empty states | Question list (N3), answer form cannot be empty by construction, game with zero links shows the disabled "Lag lenker" with its reason |
| Loading states | Participant "Henter spørsmålene ..." delayed 300 ms; button pending label delayed 300 ms with width locked; spinner stops under reduced motion |
| Error states | Network failure on submit keeps the draft and says so; closed during editing, unknown and closed link, 500 route with retry, revoke and create failures inside the dialog, cap reached all handled |
| 360 px answer form | Passes from source: one column inside `max-w-140` with a 16 px gutter, fields flex with an 8 px gap beside a 72 px "Fjern", submit full width, long text wraps (`wrap-break-word`, `min-w-0`). Not rendered, so confirm once on a real phone |
| Microcopy | Norwegian, plain, no model tells (no emoji, exclamation marks, stock phrases or invented figures). The example Question in the empty state uses the persona names of the UX docs |
| Anonymity notice (FR-14) | Pass. `AnswerForm.tsx:37-38` is exactly two sentences and equals the EXPERIENCE text; it sits above the first Question, after any draft or returning notice |

## Order of work

M1 first, with its e2e step. Then S1 to S3 (class changes and one small button), S4 (one `<title>` per status), S5 (one sentence). The nice items can wait or be dropped; N1 is a documentation correction.

## Epic 2 review fixes (2026-11-22)

Fixes landed on `epic-2-innsamling` in commits `55989b3`, `2e08f43` and `24c2ea9`. After the last commit, `npm run test` passes 387 tests and `npm run test:e2e` passes 81. The editor's failure state was checked in screenshots at 1280 px and 360 px.

- **M1, fixed** (`55989b3`). A form-level `onKeyDown` makes Enter in an answer field move focus to the next answer input, and from the last one to the submit button ("Send inn svar" or "Lagre endringer"). Enter never submits from a field, and IME composition is left alone. This is stricter than the audit's fix, which let Enter submit from the last field; the orchestrator chose it. The e2e test in `answer-form.spec.ts` presses a real Enter in Svar 1 and in the last field, and checks focus, that no error summary appears and that no request is sent.
- **S1, fixed** (`2e08f43`). "Forkast endringene" stays a ghost button, as EXPERIENCE.md says, but now reads as a link: `text-primary underline underline-offset-2`, at 7.4:1 on `primary-soft`. The discard is still immediate.
- **S2, fixed** (`2e08f43`). In the Question editor, "Slett" is now `secondary-danger` and "Flytt opp" and "Flytt ned" are `secondary`. The e2e test checks the danger border on "Slett". No confirm was added, since the contract does not ask for one.
- **S3, fixed** (`2e08f43`). A save that fails for the network or the server shows a `secondary` "Prøv igjen" button next to "Fikk ikke lagret. Prøv igjen.". The button moves focus to the textarea and resends. Refusals such as wrong state, cap or a field error get no retry button, because retrying cannot help there. The e2e test retries after the network comes back and checks "Lagret" and the reload.
- **S4, fixed** (`2e08f43`). The title approach in `InviteLinkView` (re-applying the title against Next's head re-render) moved into `useDocumentTitle`, which `LinkStatus` also uses. The titles are "Innsamlingen er stengt – Toppsvar" for closed, "Vi finner ikke lenken – Toppsvar" for unknown and not-found, and "Noe gikk galt – Toppsvar" for a failed load. A plain React `<title>` lost to the root metadata title, so it was not used. The e2e tests check every state, both server-rendered and client-side.
- **S5, fixed** (`2e08f43`). The "Åpne innsamlingen?" dialog now starts with "Du har lagret {n} spørsmål.", and the contract sentence is unchanged. The optional block while a row shows a danger status was not built.
- **N2, fixed** (`24c2ea9`). "Kopier alle" is hidden when the list holds one link.
- **N5, fixed** (`24c2ea9`). The Question counter turns `text-danger` above 200 characters.
- **N1, skipped.** It is a wireframe correction, not code.
- **N3, N4 and N6 to N8, skipped.** They are nice-to-haves that need new copy, a new prop or a design decision, so they are more than one-line changes.
