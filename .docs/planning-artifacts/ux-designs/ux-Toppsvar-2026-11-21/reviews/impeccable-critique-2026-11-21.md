# Design critique: Toppsvar UX contract — 2026-11-21

DEGRADED: single-context (delegated run; the impeccable launcher and detector are deliberately not vendored, see `.claude/skills/impeccable/VENDORED.md`).

- **Skill:** `impeccable critique`, "Launcher unavailable" path. Assessment A (design review) ran in this context. Assessment B (detector) was not available. In its place the static mock was inspected in a browser at `http://127.0.0.1:8765/key-screens.html` and measured with in-page scripts.
- **Target:** `DESIGN.md`, `EXPERIENCE.md`, `mockups/key-screens.html` in this folder. Product context: PRD §1, §2, §4.6, §4.7, §5, §6.3.
- **Modes:** Host pages and Review = Operate. Answer form = Operate (short mobile task). Play view = Experience (TV, read from 3 m).
- **Fixed constraints (not challenged):** WCAG 2.1 AA, bokmål, no imitation of the TV show, ≥ 48 px for room-read text, 13 components, Tailwind mapping, 2 developers × ~9 days, no features beyond the PRD.
- **Microcopy** was checked against `design-taste-frontend/references/copy-tells.md` and `copy-voice.md`. Only the microcopy rules were used.

## Design health score

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 3 | Review errors render off-screen. The "uten poeng" mode and a pending tile click have no visible state |
| 2 | Match system / real world | 3 | "Dommeren" is never explained as a model. "Sin tur" is not idiomatic as a standalone label |
| 3 | User control and freedom | 3 | Every Review operation has an inverse. Play has Angre. Good |
| 4 | Consistency and standards | 3 | Berry shows up on the stage, and the 24 px "Sin tur" badge breaks DESIGN's own rules. The mock uses 12–13 px text below the 14 px floor |
| 5 | Error prevention | 3 | Strong `aria-disabled` reasons and confirm dialogs. Weak spots: the U toggle and truncated TV labels |
| 6 | Recognition rather than recall | 3 | The control bar shows its shortcuts. The rail repeats "Ikke gjennomgått" until the signal drowns |
| 7 | Flexibility and efficiency | 3 | The play view has shortcuts. Review has no bulk path for fallback Questions with 30+ singletons |
| 8 | Aesthetic and minimalist design | 3 | Quiet light surfaces. The TV leaves its lower ~40 % empty with ≤ 5 Groups |
| 9 | Error recovery | 3 | Copy names the problem and the fix. Placement is the gap (finding 8) |
| 10 | Help and documentation | 2 | Only the `?` overlay exists. Nothing explains the Judge or the U mode |
| **Total** | | **29/40** | **Good** |

**Cognitive load:** moderate (3 of 8 checks fail). The fails are chunking (fallback Questions start with one Group per distinct Answer), visual hierarchy (the on-Board / off-Board boundary is the weakest type on the screen) and working memory (merging Groups scattered across a long scroll). The SelectionBar holds 4 options, inside the limit.

## Design specificity verdict

**Authored where it counts.** The forest stage, cream tiles, a single mint turn marker and a single-column *top list* all come from this product's name and from its §6.3 ban. Nothing here could be mistaken for the blue-and-gold show. The light surfaces (paper, berry, system UI) are a common warm-app look, which is the right restraint for Operate. The one category-reflex choice is Bricolage Grotesque, a very common display face in 2025–26 work. That is already Open Question 1 and is not ranked below.

**Deterministic scan:** not run (detector not vendored). Browser measurements stand in for it (see the findings).

**What's working (one line):** the anonymity copy is honest and specific, the state tables are unusually complete, the "a miss is not an error" rule is followed through, and the reasons on `aria-disabled` buttons are exemplary.

## Ranked findings

### 1. MUST (P1): the play view's vertical budget overflows 1080 px, and short boards leave the lower half empty

**Where:** DESIGN.md → Layout & Spacing → *Play view vertical budget*; Typography → *TV ramp*.

**Problem:** The budget leaves out the "Spørsmål 3 av 9" line (48 px × 1.15 ≈ 55 px). It also assumes three lines at 48 px, while a 120-character Question at 56 px measured **193 px** (three lines) in the mock. Questions may be 200 characters (FR-4), which is four lines at 48 px (≈ 221 px). Worst case: 64 + 55 + 221 + 24 + 696 + 24 + 64 ≈ **1148 px**, so the control bar or row 8 falls off the canvas. With ≤ 5 Groups, rows fixed at 80 px leave ~40 % of the screen as dead stage, exactly where the room is looking.

**Replace with:**
- Move "Spørsmål N av M" to the top of the Team column (`tv-team`, `stage-muted`). The column has spare height.
- Top gutter 48 px (was 64).
- Question size by length: `tv-question` 56 px for ≤ 80 characters, `tv-question-long` 48 px above that. The block is budgeted at 4 lines (221 px). New total: 48 + 221 + 24 + 696 + 24 + 64 = **1077 px**.
- Row height: `clamp(80px, (696px − 8px × (n − 1)) / n, 104px)`. That gives 104 px for n ≤ 6 and 80 px for 8. The row count still equals the Group count.
- Add an A1 check row: "200-character Question + 8 Groups fits 1080 px with the control bar visible".

### 2. MUST (P1): revealed labels can be cut off with an ellipsis on the TV

**Where:** DESIGN.md → Components → *BoardTile*. EXPERIENCE.md → *Play view rules* (silent on overflow). Mock `.tile .l { text-overflow: ellipsis }`.

**Problem:** The label slot measured 1072 px. A 41-character label of wide letters measured **1115 px** at 48 px in system-ui, and Bricolage is wider still. Truncating the Answer at the reveal destroys the one thing the room waited for.

**Replace with:**
- Rule in BoardTile: "A revealed label is never truncated. If it does not fit one line, it wraps to two at line-height 1.05 and the row grows to 112 px."
- Shrink the fixed parts so wrapping stays rare: rank slot 56 px (was 72), Count badge `min-width: 96px`.
- Add A1 row: "40-character label of wide letters (e.g. 'MMMM…Ø') shows in full".

### 3. MUST (P1): the turn marker breaks DESIGN's own ≥ 48 px rule, and long Team names do not fit

**Where:** DESIGN.md → Components → *TeamScore* ("mint 'Sin tur' badge in 24 px"), contradicting Do's and Don'ts ("Size everything the room reads at 48 px or more"). EXPERIENCE.md → *TeamScore*, *Play view* Team setup (names 1–20).

**Problem:**
- Whose turn it is matters more to the room than anything except the reveal, yet it is set in 24 px with a 6 px edge.
- A 20-character name ("Hyttegjengen på tur 2") measured **468 px** at 48 px. The column's content width is 400 px.
- "Sin tur" alone is not idiomatic bokmål. The reflexive needs a subject in the same clause.

**Replace with:**
- `team-score-active`: background `{colors.stage-accent}`, all text `{colors.stage-on-accent}` (10.7:1, the pair already verified in reverse). Drop the badge and the left border.
- Above the name, the words **"Svarer nå"** in `tv-team` 48 px.
- Team names: cap at 14 characters (AD-16 constant; copy "Navnet kan ha maks 14 tegn."). The alternative is to allow a two-line wrap, but then 4 Teams no longer fit the column.

### 4. MUST (P1, WCAG 2.4.7): the focus ring is invisible inside the SelectionBar

**Where:** DESIGN.md frontmatter `components.focus` (`3px solid {colors.focus-ring}` = ink) and `selection-bar` (background ink). EXPERIENCE.md → Accessibility Floor → *Focus*.

**Problem:** An ink ring 2 px outside a white button sits on the ink bar, so it does not show. The SelectionBar is where every merge and move happens, and A6 tests it keyboard-only.

**Replace with:**
- New token `focus-inverse: { outline: '3px solid {colors.surface}', outlineOffset: 2px }`, used on any `ink`-filled surface (SelectionBar).
- One line under Accessibility Floor: "On ink surfaces use `{components.focus-inverse}`."

### 5. SHOULD (P2): the reveal, the miss and the finale are under-designed for the product's peak moments

**Where:** EXPERIENCE.md → Interaction Primitives → *Motion*; Play view rules → *Bom*, *Final Scores*. DESIGN.md → Colors (`stage-accent` role "Score change", never specified).

**Problem:** UJ-4's climax is a 200 ms fade, and "Bom" appears at the same 48 px as the labels. The finale is a sorted list. The constraints rule out confetti and sound, not choreography.

**Replace with** (CSS transitions only, starting after the server acknowledges):
- **Reveal sequence:**
  - t = 0: tile fill `stage-tile` → `stage-ink`, 180 ms.
  - t = 120 ms: label fades in with a 12 px slide, 220 ms.
  - t = 300 ms: Count badge fades in, scaling 0.9 → 1, 160 ms.
  - t = 460 ms: the active Team's Score counts up over 400 ms with its digits in `stage-accent`, returning to `stage-ink` at the end.
- **Bom:** centred over the list, `stage-raised` panel, 2 px `stage-line` border, padding 24 / 64 px. "Bom" in `tv-score` 80 px `stage-ink`; 150 ms in, 1.2 s hold, 150 ms out.
- **Finale:** the winner uses the `team-score-active` look, with "Vinner" replacing "Svarer nå". New token `tv-score-final: 120px` for every Team on "Sluttstilling", Teams centred vertically.
- `prefers-reduced-motion`: all of it instant, the colour change kept.

### 6. SHOULD (P2): Review's most consequential boundary gets its weakest type

**Where:** DESIGN.md → Typography (no section-heading role); Colors (`surface-sunken` on `paper` ≈ 1.07:1). EXPERIENCE.md → *Review anatomy*. Mock `.sec` (13 px uppercase, `ink-muted`), `.limit`.

**Problem:** "On the Board / not on the Board / discarded" decides what the room sees. Today that split is carried by 13 px tracked eyebrows, a thin dashed line and a fill 1.07:1 from the page.

**Replace with:**
- Section headings as `<h3>` in `{typography.title}` 18 px `ink`, sentence case:
  - "På brettet (8 grupper)"
  - "Ikke på brettet (1 gruppe)"
  - "Forkastet (1 gruppe)"
- Board-limit divider: 2 px solid `line-strong`, label in `{typography.label}` `ink`, text "Alt under streken vises ikke i spillet".
- *Ikke på brettet* cards: add `1px dashed {colors.line-strong}` to the sunken fill.

### 7. SHOULD (P2): Review density breaks down on fallback Questions, and the rail is mostly noise

**Where:** DESIGN.md → Components → *GroupCard*, *AnswerChip*. EXPERIENCE.md → *Review anatomy* (Question rail, Marker som gjennomgått).

**Problem:**
- A "Manuell" Question with 11 Participants starts with up to ~40 singleton Groups. Each card is ~85 px because the label row repeats its one chip, so the Question becomes a ~3,400 px scroll against the PRD's "about twenty minutes".
- "Ikke gjennomgått" is printed 7 times in the rail.
- The per-Question primary action sits below all sections.

**Replace with:**
- **Singleton GroupCard:** a Group with one chip whose text equals its label renders as one 52 px row (checkbox · rank · label · Count · menu) with no chip row. If renamed, the raw Answer follows the label in `body-sm` `ink-muted`. The chip checkbox is not needed there: "Flytt"/"Ny gruppe" on a singleton equals selecting the Group.
- **Rail:** show only "✓ Gjennomgått" and "Manuell". No status line means not reviewed. The word stays in the accessible name.
- Move "Marker som gjennomgått" to the right of the Question header, replacing the status pill.

### 8. SHOULD (P2): Review operation errors appear where the Host is not looking

**Where:** EXPERIENCE.md → State Patterns → *Review* ("`notice-danger` at top of the main pane").

**Problem:** The Host acts from the sticky SelectionBar at the bottom of a long pane. With no toasts, a failure at the top is invisible.

**Replace with:**
- Selection operations (merge, move, new Group): the error shows inside the SelectionBar above its actions, `danger-soft` fill / `danger` text, "Endringen ble ikke lagret. Prøv igjen.", selection kept.
- Card operations (rename, discard, undo discard): the same sentence inline at the top of the affected GroupCard.
- Mark reviewed: under the button.

### 9. SHOULD (P2): berry on the stage breaks "one accent per surface"

**Where:** DESIGN.md frontmatter `board-tile-revealed.countBackground: '{colors.primary}'`; Do's and Don'ts row 2.

**Replace with:** `countBackground: '{colors.stage}'`, `countForeground: '{colors.stage-ink}'` (15.0:1, already verified). A dark pill on a cream tile reads harder from 3 m than berry, and the stage stays two-colour plus mint.

### 10. SHOULD (P2): the Host cannot see play-view mode and pending state

**Where:** EXPERIENCE.md → Play view rules (*Vis resten uten poeng*, Persistence); State Patterns → *Play view* (save-failure banner position unspecified). DESIGN.md → control bar.

**Problem:** If the Host forgets U is on, the next correct Guess scores nothing, and only a 24 px muted label changed. A tile click waits up to 1 s with no feedback.

**Replace with:**
- **While U is on:** hidden tiles switch to `2px dashed {colors.stage-line}` (the unscored look, previewed), and the control-bar item renders `stage-ink` weight 700 as "Avslører uten poeng [U]".
- **Pending click:** the tile border turns `stage-ink` until the server acknowledges.
- **Save-failure / lost-connection banner:** replaces the control-bar row (64 px, `stage-ink` weight 700), never overlaying the list.

### 11. SHOULD (P2): microcopy that misleads or goes unexplained

**Where:** EXPERIENCE.md → Review anatomy (*Fallback Notice*); Host page rules (*Grouping*); Answer form rules / mock instruction line.

| Now | Problem | Replace with |
|---|---|---|
| "Dommeren rakk ikke spørsmål 4 og 7." (used for `TIMEOUT`, `ERROR`, `REFUSAL`, `INVALID_OUTPUT`) | "Rakk ikke" (ran out of time) is false for three of the four codes | "Dommeren fikk ikke gruppert spørsmål 4 og 7." (rest of the sentence unchanged) |
| "Dommeren grupperer svarene …" | First appearance of "dommeren". The Host is never told it is a model | "Dommeren, en KI-modell, grupperer svarene …" (only here; term map unchanged elsewhere) |
| "Gi 1–5 svar per spørsmål, det viktigste først." | "Viktigste" is vague. Rank 1 only breaks ties (FR-16) | "Gi 1–5 svar per spørsmål. Skriv det første du kommer på i Svar 1." |
| Two helper lines under "Send inn svar" | Three small text blocks crowd the one CTA on a 360 px screen | One line: "Utkastet lagres bare på denne enheten. Sender du inn fra en annen enhet, erstatter det de forrige svarene." |

The copy otherwise passes the tells check: no exclamation marks, no virtue words, errors say what happened and what to do, and the anonymity notice states a real limit.

### 12. NICE (P3): a filled red delete button on every Game page competes with the berry primary

**Where:** DESIGN.md → Components → *Button* (`button-danger`). EXPERIENCE.md → Host page rules → *Delete* ("`button-danger` 'Slett spillet'"). The two are dark warm reds about 45° apart in hue with similar lightness.

**Replace with:** on the page, "Slett spillet" as `button-secondary` with `danger` text and a 1 px `danger` border. Filled `button-danger` ("Slett for godt") only inside the ConfirmDialog. One primary action per state stays unambiguous.

## Persona red flags

- **Maren (Host, project persona), fallback Question 4:** scrolls ~40 one-chip cards. Ticks Groups 6 screens apart. The merge fails and the error appears off-screen at the top (findings 7, 8).
- **Sam (keyboard / screen reader), Review A6:** tabs into the SelectionBar and loses the focus ring entirely (finding 4).
- **The couch at 3 m (project persona):** cannot tell whose turn it is from a 24 px pill. A long Team name runs out of its card, and a revealed answer ends in "…" (findings 2, 3).
- **Casey (Participant on the bus):** fine overall. The form is the strongest surface. Only the crowded CTA area needs work (finding 11).

## Minor observations

- The mock goes below DESIGN's 14 px floor: `.sec` 13 px, `.rail .st` 13 px, `.tag` 12 px, `.pt` wordmark 13 px. Implementation should follow DESIGN, not the mock.
- In the mock, "Jeg kjenner eieren" has Count 5 in Review but 6 on the TV.
- The mock's TV frame clips the control bar: the 10 px border is inside a 540 px box with `border-box` sizing. This is a mock artefact only.
- StatusBadge *Til gjennomgang* in warning amber reads as a problem, but it is a call to action. Consider `primary-soft`/`primary`, and *Grupperer* in sunken/ink.
- ProgressCount sets "færre enn 3" in 32 px display type. That works, but the phrase sits awkwardly as a "figure". Consider `heading` 24 px for the phrase and `display` only for digits.

## Questions to consider

- If the mint fill marks whose turn it is (finding 3), should mint mean anything else on the stage? Today it is also the focus ring and the Score change.
- Would the group pick Bricolage Grotesque if shown a second option with the same æøå coverage and offline packaging? This is cheap to decide now (Open Question 1).
- Is "Svarer nå" or "Står for tur" closer to how the origin party actually talked?

## Run notes

- No snapshot was persisted to `.impeccable/critique/` (launcher absent).
- Browser inspection: one fresh tab on the local mock, closed afterwards. No server was started by this run.
- DESIGN.md and EXPERIENCE.md were not edited.

Questions skipped: delegated run.
