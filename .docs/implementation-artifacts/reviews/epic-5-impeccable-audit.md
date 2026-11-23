# Epic 5 impeccable audit (audit + harden)

Branch `epic-5-gjennomgang`, scope `git diff origin/main...epic-5-gjennomgang`. Mode: Operate. Contract: `DESIGN.md` and `EXPERIENCE.md` in `.docs/planning-artifacts/ux-designs/ux-Toppsvar-2026-11-21/`. The launcher was unavailable, so the bundled detector did not run. This is a source audit, checked against the README screenshots in `docs-assets/skjermbilder/` (1280×800 at 2x, and 390 px for the phone form). The screenshots were taken before Story 5.5, so the mark and lock buttons show as disabled there. The SelectionBar and GroupCard markup has not changed since then (only `FailureNotice` became exported), so the Review screenshots still show the current bar. No fresh screenshots were taken. Contrast was checked against the contract's verified table and the token values in `globals.css`.

Files in scope: `src/app/spill/[id]/gjennomgang/page.tsx` and `loading.tsx`, `src/components/ReviewGroups.tsx`, `GroupCard.tsx`, `GroupMenu.tsx`, `MarkReviewed.tsx`, `LockBoard.tsx`, the `inverse` Button variant, the `data-wide` switch in `HostChrome.tsx`, the *in review* link and *ready* panel in `src/app/spill/[id]/page.tsx`, and the anonymity notice in `src/components/AnswerForm.tsx`. Two observations about `ProgressCount` and `InviteLinkPanel` are outside the diff. They are answered under Nice because they were asked about.

## Scores

| Dimension | Score | Key finding |
|---|---|---|
| Accessibility | 3 | Keyboard focus can sit fully hidden behind the SelectionBar. The inverse focus ring also applies to the link in the bar's error Notice, where it is white on pale red. |
| Performance | 4 | Pessimistic updates with one `router.refresh` per operation. No polling, no layout reads in loops. |
| Theming | 4 | Only token classes. The new `inverse` variant and `text-surface` on `bg-ink` follow the contract. |
| Responsive | 3 | Targets are 44 px throughout, and the rail becomes a GET `<select>` below 1024 px. On a phone the sticky bar can grow to four rows. |
| Implementation integrity | 3 | Default Group labels are the normalised (lowercase) text and sit next to the capitalised raw form. *Ready* has no way forward and no `shortcut:` comment. |
| **Total** | **17/20** | Good. Nothing blocks. |

Verdict on integrity: pass. Review reuses `GroupCard`, `Notice`, `ConfirmDialog`, `focusHeading` and the shared `Button`, and it adds one variant instead of a new component. Every operation has one live sentence and a focus target, as in the contract's operations table. Failures show where the Host is looking: in the bar, at the top of the card, or under the mark button. The rail's status words match the contract ("✓ Gjennomgått", "Manuell", and "Ikke gjennomgått" for screen readers only).

## Must

None. Nothing fails WCAG 2.1 A or AA (NFR-6), and nothing blocks a task.

## Should

### S1. [P1] The SelectionBar covers Board cards and can hide keyboard focus (`ReviewGroups.tsx:448-453`)

**Observation 1: confirmed, with one correction.** In `gjennomgang-valg.png` (1280×800, two Groups selected) the bar sits over card 5 ("kaffe") completely and over the top half of card 6 ("tøfler"). Card 6 is one of the two selected Groups. The bar is `sticky bottom-4` and placed after the last section in normal flow (`mt-8`). At the end of the scroll it therefore rests below the list, and the last card is never hidden for good. The extra bottom padding on the list that the observation proposes is not needed. The real problems happen mid-scroll:

- **Focus not obscured.** A keyboard user who tabs from card 4's menu to card 5's checkbox gets no scroll, because the checkbox is already inside the viewport, behind the bar. Focus is then fully hidden. This fails WCAG 2.2 SC 2.4.11 Focus Not Obscured (Minimum, AA). NFR-6 names 2.1 AA, so this is not a formal failure, but in 2.1 terms it is the same problem as SC 2.4.7 Focus Visible. Contract: `EXPERIENCE.md`, Accessibility, "Focus … never removed", and tab order "rail, then main pane top to bottom, then SelectionBar".
- **The tick hides itself.** A Host who ticks a card near the bottom of the viewport makes the bar appear on top of the card they just ticked. That is what happened to card 6 in the screenshot.

Fix, two lines of CSS and one effect:

1. In `globals.css`, reserve the bar's height for scroll-into-view while the bar exists:
   ```css
   /* shortcut: fixed bar height, measure the bar with a ResizeObserver if it ever grows a third row on desktop */
   html:has([data-selection-bar]) { scroll-padding-bottom: 8rem; }
   @media (width < 48rem) { html:has([data-selection-bar]) { scroll-padding-bottom: 16rem; } }
   ```
   Browsers count `scroll-padding` when focus moves, so Tab now scrolls the checkbox above the bar. 8rem covers the 76 px bar, its 16 px offset and some air at 1280 px. The bar's error Notice adds about 70 px. That case is rare and still leaves the control partly visible.
2. In `ReviewGroups`, when the bar first appears (`hasSelection` goes from false to true), call `document.activeElement?.scrollIntoView({ block: "nearest" })`. With the padding above, this lifts the ticked checkbox clear of the bar and does nothing when it is already clear. Do not add `behavior: "smooth"`. The contract allows no motion here, and reduced motion would need its own case.

Add an e2e check to `review.spec.ts`: tick card 6 at 1280×800, Tab to the next checkbox, and assert that its bounding box ends above the bar's top edge.

### S2. [P2] Default Group labels are lowercase next to the capitalised raw form (`src/lib/ranking.ts:18-30`, shown by `GroupCard.tsx:87-92`)

**Observation 2: confirmed, and wider than fallback Groups.** `gjennomgang.png` shows "ullsokker" in `title` with "Ullsokker · 4 svar" right after it in `body-sm`. "brettspill / Brettspill", "kaffe / Kaffe" and "tøfler / Tøfler" repeat the pattern, and the discarded card shows "~~ingenting~~ / Ingenting" (`gjennomgang-forkastet.png`). The cause is `defaultLabel`. Its candidates are `answer.normalizedText` (`src/server/review/index.ts:63-67`), so every default label is the normalised form, also for Groups the Judge proposed. The compact row then compares the raw chip text to the label (`GroupCard.tsx:87`), finds "Ullsokker" ≠ "ullsokker", and prints both. The result reads like a mistake, and it repeats on almost every singleton row of a fallback Question. It will matter more in Epic 6: the same label is what the room reads on the TV, at 48 px.

PRD FR-16 says the default label is "its most frequent normalised Answer text". That rule picks *which* text wins. It does not have to decide how the text is *displayed*.

Fix (recommended): keep the FR-16 choice, but display the winning text in its most common written form, which `collapseChips` already computes for chips. In `rankedGroups`, also select `answer.text` per `(groupId, normalizedText)`. Pass the most common raw form along as `labelCandidates[i].display`, and let `defaultLabel` sort on `text` but return `display`, cut at 40 characters as today. Ranking is unaffected because the tie-break collator uses `sensitivity: "base"`. The compact row then hides the duplicate on its own: "Ullsokker · 4 svar" becomes just "· 4 svar" after the label. Add one sentence to FR-16 in the PRD and to the GroupCard row in `DESIGN.md` ("shown in its most common written form"), and add a unit test in `ranking.test.ts`.

Cheaper alternative if time is short: capitalise the first letter in `defaultLabel` (`text.charAt(0).toLocaleUpperCase("nb") + text.slice(1)`) with `shortcut: capitalises instead of using the written form, breaks "iPhone"-style answers; use the most common raw form before the play view ships`. Do not change the compact-row comparison to case-insensitive on its own. Then the label stays lowercase and only the hint disappears.

### S3. [P2] The inverse focus ring also hits the link inside the bar's error Notice (`ReviewGroups.tsx:452-455`)

The bar sets `[&_:focus-visible]:outline-focus-inverse` on every descendant. `FailureNotice` renders inside the bar on a selection failure, and in the `locked` case it contains the link "Gå til spillet". That link gets a white 3 px ring with a 2 px offset, drawn on `danger-soft` (#FBE9E7). That is about 1.2:1, far below the 3:1 the contract's own table requires for focus rings (`DESIGN.md`, contrast table, `focus-inverse` row; WCAG SC 1.4.11 Non-text Contrast, SC 2.4.7 Focus Visible). This is the one link a Host needs after another tab has locked the Board.

Fix: give the Notice in the bar the light-surface ring back with a selector that wins on specificity: `<FailureNotice … className="mb-4 [&_a:focus-visible]:outline-focus-ring" />`. Add the case to the A10 check ("focus ring visible on every SelectionBar control").

### S4. [P2] *Ready* has no way forward and no debt marker (`src/app/spill/[id]/page.tsx:204-215`)

This is the same situation as S3 in the Epic 4 audit. The *ready* panel shows "Brettet er låst" and "N spørsmål er klare.", but the contract's primary action for the state is "Start spillet" (`EXPERIENCE.md`, Game page state table and the Start play row). That button belongs to Story 6.1, which is still in backlog. A dead button would be worse, so do not add one. Add `shortcut: no way forward from ready until Epic 6, add the primary "Start spillet" link to /spill/[id]/skjerm here in Story 6.1` so that `ponytail-debt` lists it. The copy itself matches the contract. The heading drops the full stop, which is fine for a heading.

## Nice

### N1. [P3] The Group checkbox's accessible name leaves out the count (`GroupCard.tsx:66`)

`aria-label="Velg «ullsokker»"` versus the contract's literal string "Velg gruppen «{label}», N personer" (`EXPERIENCE.md`, Component Patterns, GroupCard). The count is the deciding fact when a Host picks merge sources. Screen reader users hear it only if they read the row after the checkbox. Fix: ``aria-label={`Velg gruppen «${label}», ${people(count)}`}`` and update the e2e locators that match on the old name.

### N2. [P3] On a phone the sticky bar can take a third of the screen (`ReviewGroups.tsx:457-516`)

At 360 px an Answer selection wraps the summary, the label, the `<select>`, "Flytt", "Ny gruppe" and "Fjern valg" onto about four rows, which is roughly 230 px of a 640 px viewport. The contract allows this, because Review on a phone "works, but is cramped", and the ban on sticky bars covers only the phone form. S1's 16rem `scroll-padding` keeps focus visible there. If the group wants it tighter, put the label above the select only from `sm:` and let the three buttons share one row with `flex-1`. Otherwise leave it.

### N3. [P3] "færre enn 3" as the display figure (outside the diff: `src/components/ProgressCount.tsx:12-17`)

**Observation 3: confirmed as rendered, but this is contract text, not an Epic 5 defect.** `invitasjonslenker.png` shows "færre enn 3" in 32 px Bricolage followed by "av 5 svar mottatt" in 16 px body. The big words read as a headline fragment, and the line jumps in style when the count reaches 3 and only a numeral is large. `DESIGN.md` (ProgressCount) prescribes exactly this ("The figure ('færre enn 3' or '7') in `display`"). Fix, if the group wants it: amend that row so that only the numeral is display size, giving `<span class="text-body">Færre enn </span><span class="text-display">3</span> av 5 svar mottatt`. The figure keeps the same visual weight in both states, and FR-8 is unaffected because the text still never shows 0, 1 or 2.

### N4. [P3] "Lag lenker" has different widths in *draft* and *collecting* (outside the diff: `src/components/InviteLinkPanel.tsx:100-153`)

**Observation 4: partly confirmed, and the cause is intentional.** The *collecting* button has `pendingLabel="Lager lenker …"`, and `Button` puts both labels in one grid cell, so the button keeps the width of the wider label plus the 16 px spinner. In `spill-oversikt.png` the button is about 180 px for a 90 px label. The *draft* trigger is a `ConfirmDialog` button without a pending label, so it fits its text. That follows the contract's rule "width locked" for loading buttons (`DESIGN.md`, Button). The two widths never appear side by side, since they belong to different Game states. No draft screenshot of the panel exists, so the draft width was not measured. If it bothers anyone, shorten the pending label to "Lager …", which brings the two widths within a few pixels. Do not drop the width lock.

## Checks that passed

- **Tokens:** no hex values or arbitrary colours. Spacing values such as `min-h-13`, `pl-21` and `max-w-64` are on the scale. Ink is used for the bar, `primary-soft` with an inset ring for selected cards and chips, and `surface-sunken` with a dashed `line-strong` border for *Ikke på brettet*, all as in the contract.
- **Contrast:** `surface` text on `ink` in the bar is 17.1:1. `ink-muted` raw forms on `surface` and `surface-sunken` are 7.4 and 6.3:1. `success` text on `surface` in the rail is above 4.5:1. The disabled "Lås brettet" is at 60 % opacity, which SC 1.4.3 exempts for inactive controls, and its reason sits in body text directly under it, tied with `aria-describedby`.
- **Targets:** the Group checkbox label is 44×44 (`size-11`, with negative margins so the 52 px compact row holds). Chips, menu triggers, rail links, breadcrumb links and bar controls are all `min-h-11`.
- **Keyboard and focus:** the menu is a disclosure. Esc closes it and returns focus to the trigger, Tab out closes it, and Esc never reaches the selection listener (`defaultPrevented`). "Fjern valg" and Esc return focus to the first ticked checkbox when focus was in the bar. After each operation focus goes to the merged, moved, discarded or restored Group's `h4`, or to the rename field. Marking moves focus to the Question heading. The lock is placed after the rail's `nav`, never inside the landmark.
- **Live regions:** one polite region per component, emptied before each operation so a repeated sentence is announced again. The sentences match the contract's operations table word for word, including "Spørsmål 3 er gjennomgått. Viser spørsmål 4." Errors use `role="alert"` through the danger Notice. No region on the selection count, as the contract asks.
- **Narrow screens:** below 1024 px the rail becomes a GET form with a `<select>` and "Vis", so changing it never navigates (SC 3.2.2). The lock moves to the foot, and an info Notice says the screen is built for a larger display. The `data-wide` switch in `HostChrome` affects only Review.
- **Loading:** `loading.tsx` is the contract's skeleton rail and three cards, `aria-hidden`, and it appears after 300 ms with no animation. It has no `<h1>`, so RouteFocus waits for the real one.
- **Anonymity:** chips are alphabetical and show text and "· N svar" only. No rank, Contributor key or Answer set reaches the UI. The checkbox IDs use random v4 Answer IDs.
- **Answer form notice:** the new text matches `EXPERIENCE.md` exactly ("…, og svarene kan bli sendt til en ekstern KI-tjeneste for gruppering."), and it has no condition, per the 2026-11-23 sprint change. `svarskjema-mobil.png` still shows the old two-sentence text and should be retaken before the README is final.
- **Copy:** no ban words, no em dashes, no stock phrases. One small inconsistency: "Låser …" in `LockBoard` has a no-break space before the ellipsis, but the pending labels in `ReviewGroups` and `MarkReviewed` ("Slår sammen …", "Markerer …" and the others) use a plain space, so the ellipsis can wrap onto its own line in a narrow bar. Use `\u00a0` there too.

## Recommended order

1. S1: `scroll-padding-bottom` while the bar exists, plus `scrollIntoView` when the bar appears, and an e2e check.
2. S3: the light focus ring on the error Notice link in the bar (one class).
3. S2: default label in its most common written form, with an FR-16 and DESIGN sentence and a unit test (or the capitalise shortcut).
4. S4: the `shortcut:` comment on *ready*.
5. N1 if the e2e locators are cheap to update. N2 to N4 only if the group wants them. N3 and N4 need a contract amendment and are outside Epic 5.
