# Epic 6 impeccable audit (audit)

Branch `epic-6-spill`, scope `git diff origin/main...epic-6-spill`. Mode: Operate. Contract: `DESIGN.md` and `EXPERIENCE.md` in `.docs/planning-artifacts/ux-designs/ux-Toppsvar-2026-11-21/`. The launcher was unavailable, so the bundled detector did not run. This is a source audit checked against fresh screenshots. The app was built with `next build` and run with `next start` in a separate worktree on the branch head, with a local PGlite database, no model key and the replay judge. Playwright drove a full round: register, three Questions (one of 189 characters with eight Groups on the Board), five Answer sets, close, Review (one discard, one rename to a 40-character label of wide letters), lock, Team setup, play with scored and unscored Reveals, Bom, the overlay, a forced lost connection, reduced motion, "Sluttstilling" and the played Game page. A second Game was played with four 14-character Team names of wide letters, ending in a four-way tie. Stage shots are 1920×1080. The scaled stage was also captured at 1280×720, and letterboxed at 1280×800 and 1024×768. Host pages are 1280×800, and Team setup also at 375 px. The PNGs are kept outside the repo. File names are cited below.

Files in scope: `src/components/Board.tsx`, `PlayView.tsx` (`PlayView`, `FinalScores`, `StageLoading`), `TeamSetup.tsx`, `FullscreenKey.tsx`, `src/app/spill/[id]/skjerm/page.tsx`, the *ready*, *playing* and *played* panels in `src/app/spill/[id]/page.tsx`, the stage rules in `src/app/globals.css` (canvas scaling, the Reveal, Score and Bom motion, reduced motion, hidden Host chrome), the `data-host-chrome` hook in `HostChrome.tsx`, and `FocusOnMount`/`focusPageHeading` in `RouteFocus.tsx`. Two observations from the production smoke test about `GroupCard.tsx` (Review, outside Epic 6) are answered under Should because they were asked about.

## Scores

| Dimension | Score | Key finding |
|---|---|---|
| Accessibility | 3 | Contrast, the inverse focus ring, reduced motion and the keyboard model all hold. The Board has two polite live regions that can speak at the same moment. |
| Performance | 4 | CSS-only motion on opacity, translate, scale and one tile's fill. The Score counts up through a registered `@property`, with no JS timer. No polling. |
| Theming | 4 | Only stage tokens. The arbitrary values (`leading-[1.05]`, `pb-[3px]`) are contract numbers and are commented. |
| Responsive | 2 | Letterboxing is correct from the first paint. Inside the fixed canvas, a long revealed label and four wide Team names both overflow their boxes. |
| Implementation integrity | 3 | Coherent and contract-true, and it reuses Button, Notice, TextField and `focusHeading`. The 6.2 Score colour decision is recorded in the wiki but not in the design contract. |
| **Total** | **16/20** | Good. One must-fix before the PR. |

Verdict on integrity: pass. The play view follows the contract closely. It uses a single-column top list, the mint Team card with "Svarer nå", a forest Count badge, a dashed preview while "uten poeng" is on, a stage-ink pending border, and the Bom panel in `stage-raised`, never red. The control bar has bracketed shortcuts, and the banner replaces the bar row without covering the list. "Sluttstilling" shows "Vinner", or "Uavgjort" on every tied Team (`stage-sluttstilling-tie-1920.png`). Every announcement in the play view rules is used word for word. The weak spot is content resilience inside the fixed canvas, not the system.

**The 6.2 Score colour decision holds.** Reveals always score for the current Team, and that Team's card is filled `stage-accent`. Digits in `stage-accent` would be mint on mint, at 1:1. The count-up keeps `stage-on-accent` on `stage-accent`, which is 10.7:1 and reads at 80 px from 3 m (`stage-q1-reveal-mid-1920.png` shows the label fading in while the Score is still 0, and `stage-q1-reveal-done-1920.png` shows it settled at 5). See N3 for the contract text that still says otherwise.

## Must

### M1. [P1] A long revealed label breaks out of its tile and covers the Team column (`Board.tsx:243-281`)

The contract's acceptance check A9 fails: "a 40-character label of wide letters (e.g. 'MMMM…Ø') shows in full, wrapped if needed, never truncated" (FR-24). In `stage-q1-all-revealed-1920.png`, Group 5 was renamed to 39 × "M" + "Ø" and revealed unscored. The row runs from the tile's left edge to the right edge of the canvas. It is painted over the third Team card, hiding its name and most of its Score. The Count "2" sits on the canvas edge, and "uten poeng" is cut off by `overflow-hidden`. The scored row (line 247) has the same structure, so a scored Reveal of this label pushes the Count badge off the canvas in the same way. This was read from the code, not captured. The overlay screenshot (`stage-overlay-1920.png`) shows the same row through the backdrop.

Cause: each revealed row is a `flex flex-1` item inside the `li`'s flex box, with no `min-w-0`. Its automatic minimum width is therefore the min-content width of its content. `.reveal-label` has `min-w-0` and `break-words`, but `overflow-wrap: break-word` does not lower the min-content width. The unbroken word sets the row's minimum, and the row grows past the 1312 px column. A label with spaces wraps correctly, which is why the e2e labels ("Kari", "Bjørn") never showed it. No automated test covers A9.

Fix: add `min-w-0` to both revealed row `div`s (lines 247 and 265). The label then wraps inside the tile at `leading-[1.05]`, as the contract asks. `wrap-anywhere` on `.reveal-label` (Tailwind 4.3 has it) would also work, but `min-w-0` fixes the cause. Add an e2e step to the eight-Group test that renames a Board Group to `"M".repeat(39) + "Ø"`, reveals it, and checks three things: the tile's right edge stays at or inside the list's right edge, the Count badge is fully inside the canvas, and the row is at most 112 px tall. With eight Groups the 696 px budget has no slack, so the other rows give up the few pixels the wrapped row needs. They already did so in the screenshot, going from 80 to about 75 px. Check that the hidden tiles' rank numbers still fit.

## Should

### S1. [P2] Four wide Team names overflow the Team column, and the last Score is cut off (`PlayView.tsx:38-66`, `src/lib/limits.ts:52`)

`limits.ts` says "14 characters so four names fit the 448 px Team column at 48 px", and `DESIGN.md` (TeamScore) says the same. That holds for ordinary names but not for wide letters. At `tv-team`, measured on the stage: "Hyttegjengen" is 314 px, "Mammaklubben" 376 px and "Søskenbarnene" 364 px, all within the 400 px content width. "MMMMMMMMMMMMMM" and "WWWWWWWWWWWWWW" (about 672 px) wrap to two lines, and "Mormormormorm" breaks mid-word. With four such names (`stage-wide-team-names-1920.png`) the column content is 1104 px in a 941 px column. The fourth card slides under the control bar, its bottom lands at 1152 px on a 1080 px canvas, and its Score is not visible. The room cannot read one Team's Score. With one wide name (the first Game) the column fits with 3 px to spare.

Fix: on the cards that are not active, put the Score beside the name (`flex items-center justify-between`, as `FinalScores` already does) instead of below it. That saves about 88 px per card, and four two-line names then need about 850 px. The active card keeps the stacked look with "Svarer nå". This changes the TeamScore row in `DESIGN.md`, so amend it in the same commit, and correct the comment in `limits.ts`. Add "four 14-character names of wide letters" to manual check A8. Lowering `TEAM_NAME_MAX` does not help, because about 10 "M" already fill a line.

### S2. [P2] The compact Group row shows a loose "· N svar" (`GroupCard.tsx:87-91`, smoke-test observation 1)

**Confirmed.** `review-groupcard-q1-full.png` shows "Ullsokker · 5 svar … 5 personer", "Kortstokk · 3 svar … 3 personer", and the same on "Brettspill", "Kaffe" and "Tøfler". When the label equals the only raw form, line 89 prints nothing, and line 90 still prints "· N svar". The dot then follows the label with nothing on its left, and the number repeats the right-aligned Count. Since the Epic 5 S2 fix (labels shown in their most common written form), this is the normal case for every unrenamed singleton with more than one Answer, not an edge case. `DESIGN.md` (GroupCard, compact row) asks only for "if renamed, the raw Answer follows the label".

Fix: show the span only when the raw form differs, and keep the answer count after the raw form:

```tsx
{compact && chips[0].text !== label && (
  <span className="min-w-0 text-body-sm break-words text-ink-muted">
    {chips[0].text}
    {chips[0].n > 1 && ` · ${chips[0].n} svar`}
  </span>
)}
```

"Sjokolade · 2 svar" after a renamed label stays as it is now. If the group wants to keep the answer count on unrenamed rows, print it without the dot ("5 svar"), but it then repeats "5 personer". Update any review e2e assertion that matches the old row text.

### S3. [P2] A discarded Group repeats its raw Answer under the struck-through label (`GroupCard.tsx:119-127`, smoke-test observation 2)

**Confirmed.** `review-discarded-repeat.png` shows "~~Ingenting~~ … 1 person [Angre forkasting]" with "Ingenting" again on the line below. The compact rule on line 57 excludes `discarded`, so the plain-text Answer list always renders. With labels now shown in their written form, a single-Answer Group repeats itself. The contract wireframe shows the list for a renamed Group ("~~Noe om eksen~~" over "noe om eksen · tar opp eksen"), where it adds information.

Fix: render the list only when it adds something. In the `look === "discarded"` branch, render nothing when `chips.length === 1 && chips[0].text === label`. Otherwise render the `<ul>` as today, so renamed and multi-Answer discards keep their Answers. Add "unless its only Answer equals the label" to the *Forkastet* row in `EXPERIENCE.md`. In `review.spec.ts`, assert that the discarded card's text contains "Ingenting" once.

## Nice

### N1. [P3] Two polite live regions in the Board can speak at once (`Board.tsx:311-313`, `366-371`)

`EXPERIENCE.md` (Accessibility) asks for "one polite region per page". The Board has the sr-only `said` region and a second `role="status"` for "Alle svarene er avslørt." The last Reveal updates both in the same render ("«Godteri» er avslørt uten poeng." and "Alle svarene er avslørt."), and screen readers often speak only one of two simultaneous polite updates. Fix: append the hint to the `said` sentence when that Reveal completes the Board, and make the bar's hint plain text (no role).

### N2. [P3] The focus ring on a focused heading shows on the TV (`PlayView.tsx:92-95`, `Board.tsx:214-218`)

After N on the last Question, `FocusOnMount` focuses "Sluttstilling". Because the last input was a key, `:focus-visible` matches, and the room sees a 3 px white frame across the 1120 px heading (`stage-sluttstilling-1920.png`). The same happens on the Question `<h1>` after N when focus was in the list. The e2e test asserts this ring on purpose, and the contract says focus is "never removed", so this is a contract question, not a defect. A heading with `tabindex="-1"` is not a control, and WCAG 2.4.7 does not require a ring on it. If the group wants a clean TV, add `[data-stage] h1:focus-visible { outline: none; }` and update the assertion. Leaving it as it is can be defended.

### N3. [P3] The design contract still asks for a mint count-up (`EXPERIENCE.md`, play view rules; `DESIGN.md`, Colors)

The 6.2 decision is in `wiki/prosjekt/beslutninger.md` and the 6.2 spec, but `EXPERIENCE.md` still says "digits in `stage-accent`, returning to `stage-ink`", and `DESIGN.md` lists "Score change" as a role of `stage-accent`. The next reviewer reading the contract will flag the code. Amend both lines to "counts up in the card's own text colour (the scored Team's card is always mint)".

### N4. [P3] Team setup has no breadcrumb (`TeamSetup.tsx:126-129`)

Review shows "Mine spill › Hyttetur 2026 › Gjennomgang". Team setup shows only "Hvem spiller?" (`team-setup-initial-1280.png`), so a Host who opened it by mistake can get back only with the browser's back button or "Mine spill". The contract says Game pages show a breadcrumb. Fix: pass the title from `skjerm/page.tsx` and reuse the Review breadcrumb markup, ending in "Lag".

## Checks that passed

- **FR-24 sizes (A1), measured at 1920×1080:** the 189-character Question is 48 px (`tv-question-long`) and fills four lines in the 221 px block. Tile ranks, labels and Counts are 48 px, Team texts 48 px, Scores 80 px and final Scores 120 px. Only the control bar (24 px, `stage-muted`) and the overlay are smaller, as the contract allows.
- **A8:** the 189-character Question with eight Groups fits, with the list ending at 989 px and the bar at 1013–1077 px (`stage-q1-start-1920.png`). With every control and both hints showing ("Angre", "Avslører uten poeng [U]" in bold, "Alle svarene er avslørt.", "Trykk F for fullskjerm."), the bar uses 1692 of 1792 px. It never wraps, but only about 100 px are left at the right end that the contract reserves for the Stage 2 source credit.
- **Contrast on stage colours:** `stage-on-accent` on `stage-accent` (active card and count-up) 10.7:1. `ink` on `stage-ink` (revealed label) 15.2:1. `stage-ink` on `count-badge` 15.0:1. `stage-muted` on `stage-raised` (control bar, "uten poeng", unscored Count) 6.9:1. `stage-muted` on `stage` ("Spørsmål N av M", the deletion line) 8.3:1. `stage-ink` on `stage-raised` (Bom, banner, overlay) 12.4:1. The dashed `stage-line` edge of an unscored tile on `stage-raised` is about 4.3:1, above the 3:1 needed for UI. The pending border, `stage-ink` on `stage-tile`, is 9.8:1.
- **Focus:** the stage wrapper sets `outline-focus-inverse` on every descendant. The white ring is about 16.8:1 on `stage` and 14:1 on `stage-raised`, and the 2 px offset keeps it on dark ground around a cream tile (`stage-focus-control-1920.png`). Host chrome and the skip link are `display: none` under the stage, so Tab never reaches hidden controls.
- **Overlay:** native `<dialog>` with `showModal()`. Focus starts on "Lukk", Esc closes it, and focus returns to the control that opened it (verified: "Angre"). Shortcuts and F are ignored inside it and in text fields. The list of nine shortcuts matches the contract (`stage-overlay-1920.png`).
- **Reduced motion:** with `reducedMotion: "reduce"`, a Reveal captured 60 ms after the click already shows the cream tile, the label, the badge and the new Score (`stage-q2-reveal-reduced-motion-1920.png`). Bom keeps its 1.5 s panel without the fade. The state change is kept and only the motion goes, as the audit rubric asks.
- **Motion:** the staged Reveal (fill 180 ms, label from 120 ms, badge from 300 ms, Score from 460 ms over 400 ms) runs only on the tile this tab revealed (`data-revealing`), never after a reload or a refresh from another tab. Nothing flips or flashes.
- **States:** "Henter spillet …" in `tv-team` on the stage background. The lost-connection banner "Mistet forbindelsen." replaces the bar row in bold `stage-ink` with `role="alert"`, and the list is untouched (`stage-failure-banner-1920.png`). "Alle svarene er avslørt." appears, and "Neste spørsmål" turns bold. The unscored preview dashes every hidden tile, and the bar item reads "Avslører uten poeng [U]" in bold with `aria-pressed` (`stage-q1-unscored-mode-1920.png`).
- **Letterboxing:** `.stage-canvas` scales from the first server-rendered paint with no layout shift. 1280×720 fills the window, while 1280×800 and 1024×768 are letterboxed and centred (`stage-q2-1280x720.png`, `stage-q2-1280x800-letterbox.png`, `stage-q2-1024x768-letterbox.png`). Two accepted trade-offs of the fixed canvas: browser zoom does not enlarge the stage, and below about 1050 px of window width the 44 px controls scale under 24 px. The control bar is for the Host, and the contract chose the canvas on purpose.
- **Team setup:** prefilled "Lag 1" and "Lag 2", "Legg til lag" up to four, and "Fjern" with "lag N" for screen readers. Errors appear under each field in the contract wording ("Laget trenger et navn.", "Navnet kan ha maks 14 tegn.") and focus goes to the first invalid field. The pending label "Starter …" has a no-break space. It works at 375 px with no horizontal scroll (`team-setup-errors-375.png`).
- **Game page:** *ready* has the primary "Start spillet" link, which removes the Epic 5 `shortcut:` comment. *playing* shows "Spillet er i gang", "Spørsmål N av M." and the Scores with "Fortsett spillet". *played* shows the Scores, "Vis sluttstilling" and the info Notice with the deletion date, matching the contract rows (`game-page-playing-1280.png`, `game-page-played-1280.png`).
- **Anonymity (FR-24, A7):** the stage reads only the confirmed Board. The discarded "Ingenting", the below-limit "Sovepose" and raw forms never appeared in any stage screenshot.
- **Copy:** no exclamation marks, no red and no X for a miss. "Bom" is a plain word. No ban words or em dashes.

## Recommended order

1. M1: `min-w-0` on the two revealed row `div`s, plus an A9 e2e step with a 40-character wide label.
2. S1: Score beside the name on inactive Team cards, the TeamScore amendment in `DESIGN.md`, the comment in `limits.ts`, and four wide names added to A8.
3. S2 and S3: the two `GroupCard` conditions, with the *Forkastet* sentence in `EXPERIENCE.md`.
4. N3: the contract lines for the count-up colour (two sentences).
5. N1, N2 and N4 if time allows. N2 needs a decision in the contract first.
