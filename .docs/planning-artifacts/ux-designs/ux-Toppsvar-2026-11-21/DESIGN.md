---
name: Toppsvar
description: Party game where a Host turns anonymous Answers about the group into a ranked Board, reviews it, and plays it from one shared screen. Next.js + Tailwind CSS; tokens map 1:1 onto a Tailwind theme.
status: final
created: 2026-11-21
updated: 2026-11-22
sources:
  - ../../prds/prd-Toppsvar-2026-10-12/prd.md
  - ../../briefs/brief-Toppsvar-2026-09-14/brief.md
  - ../../briefs/brief-Toppsvar-2026-09-14/addendum.md
colors:
  # Light surfaces: Host pages and the Participant answer form
  paper: '#FAF7F2'
  surface: '#FFFFFF'
  surface-sunken: '#F1ECE4'
  ink: '#1E1A22'
  ink-muted: '#5A5363'
  line: '#E2DBD0'
  line-strong: '#857D8C'
  primary: '#7B2D5E'
  primary-hover: '#5F2148'
  primary-soft: '#F5E7F0'
  on-primary: '#FFFFFF'
  focus-ring: '#1E1A22'
  focus-inverse: '#FFFFFF'
  success: '#1D6B45'
  success-soft: '#E2F1E8'
  warning: '#7A4E00'
  warning-soft: '#FCEFD2'
  danger: '#A8231A'
  danger-soft: '#FBE9E7'
  # Stage surfaces: the play view only (dark by design)
  stage: '#10201E'
  stage-raised: '#1A302C'
  stage-tile: '#24413C'
  stage-line: '#739690'
  stage-ink: '#F6F1E7'
  stage-muted: '#A7BAB4'
  stage-accent: '#7FE0C2'
  stage-on-accent: '#10201E'
  count-badge: '#10201E'
typography:
  display:
    fontFamily: "'Bricolage Grotesque', system-ui, sans-serif"
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  heading:
    fontFamily: "'Bricolage Grotesque', system-ui, sans-serif"
    fontSize: 24px
    fontWeight: '700'
    lineHeight: '1.25'
  title:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: 18px
    fontWeight: '600'
    lineHeight: '1.4'
  body:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  body-sm:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.45'
  label:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: 14px
    fontWeight: '600'
    lineHeight: '1.4'
  tv-question:
    fontFamily: "'Bricolage Grotesque', system-ui, sans-serif"
    fontSize: 56px
    fontWeight: '700'
    lineHeight: '1.15'
  tv-question-long:
    fontFamily: "'Bricolage Grotesque', system-ui, sans-serif"
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.15'
  tv-label:
    fontFamily: "'Bricolage Grotesque', system-ui, sans-serif"
    fontSize: 48px
    fontWeight: '600'
    lineHeight: '1.15'
  tv-count:
    fontFamily: "'Bricolage Grotesque', system-ui, sans-serif"
    fontSize: 48px
    fontWeight: '800'
    lineHeight: '1'
  tv-score:
    fontFamily: "'Bricolage Grotesque', system-ui, sans-serif"
    fontSize: 80px
    fontWeight: '800'
    lineHeight: '1'
  tv-score-final:
    fontFamily: "'Bricolage Grotesque', system-ui, sans-serif"
    fontSize: 120px
    fontWeight: '800'
    lineHeight: '1'
  tv-team:
    fontFamily: "'Bricolage Grotesque', system-ui, sans-serif"
    fontSize: 48px
    fontWeight: '600'
    lineHeight: '1.15'
  tv-control:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.2'
rounded:
  sm: 6px
  md: 10px
  lg: 16px
  full: 9999px
spacing:
  # Keys and values equal Tailwind's default 4 px scale, so no spacing override is needed.
  '1': 4px
  '2': 8px
  '3': 12px
  '4': 16px
  '6': 24px
  '8': 32px
  '12': 48px
  '16': 64px
  gutter-mobile: 16px
  gutter-host: 32px
  gutter-tv: 64px
  host-max: 1280px
  form-max: 560px
  control-min: 44px
components:
  button-primary:
    background: '{colors.primary}'
    backgroundHover: '{colors.primary-hover}'
    foreground: '{colors.on-primary}'
    radius: '{rounded.md}'
    minHeight: '{spacing.control-min}'
    typography: '{typography.title}'
  button-secondary:
    background: '{colors.surface}'
    foreground: '{colors.primary}'
    border: '1px solid {colors.line-strong}'
    radius: '{rounded.md}'
    minHeight: '{spacing.control-min}'
  button-ghost:
    background: 'transparent'
    foreground: '{colors.ink}'
    radius: '{rounded.md}'
    minHeight: '{spacing.control-min}'
  button-secondary-danger:
    background: '{colors.surface}'
    foreground: '{colors.danger}'
    border: '1px solid {colors.danger}'
    radius: '{rounded.md}'
    minHeight: '{spacing.control-min}'
  button-danger:
    background: '{colors.danger}'
    foreground: '{colors.on-primary}'
    radius: '{rounded.md}'
    minHeight: '{spacing.control-min}'
  text-field:
    background: '{colors.surface}'
    foreground: '{colors.ink}'
    border: '1px solid {colors.line-strong}'
    borderInvalid: '2px solid {colors.danger}'
    radius: '{rounded.sm}'
    minHeight: 48px
    typography: '{typography.body}'
  focus:
    outline: '3px solid {colors.focus-ring}'
    outlineOffset: 2px
  focus-inverse:
    outline: '3px solid {colors.focus-inverse}'
    outlineOffset: 2px
  notice-info:
    background: '{colors.primary-soft}'
    foreground: '{colors.ink}'
    radius: '{rounded.md}'
  notice-success:
    background: '{colors.success-soft}'
    foreground: '{colors.success}'
    radius: '{rounded.md}'
  notice-warning:
    background: '{colors.warning-soft}'
    foreground: '{colors.warning}'
    radius: '{rounded.md}'
  notice-danger:
    background: '{colors.danger-soft}'
    foreground: '{colors.danger}'
    radius: '{rounded.md}'
  status-badge:
    background: '{colors.surface-sunken}'
    foreground: '{colors.ink}'
    radius: '{rounded.full}'
    typography: '{typography.label}'
  progress-count:
    foreground: '{colors.ink}'
    typography: '{typography.display}'
  once-link-list:
    background: '{colors.surface}'
    border: '2px solid {colors.warning}'
    radius: '{rounded.md}'
  confirm-dialog:
    background: '{colors.surface}'
    radius: '{rounded.lg}'
    backdrop: 'rgba(30, 26, 34, 0.55)'
  group-card:
    background: '{colors.surface}'
    border: '1px solid {colors.line}'
    radius: '{rounded.md}'
  group-card-selected:
    background: '{colors.primary-soft}'
    border: '2px solid {colors.primary}'
  answer-chip:
    background: '{colors.surface-sunken}'
    foreground: '{colors.ink}'
    radius: '{rounded.sm}'
    typography: '{typography.body}'
  answer-chip-selected:
    background: '{colors.primary-soft}'
    border: '2px solid {colors.primary}'
  selection-bar:
    background: '{colors.ink}'
    foreground: '{colors.surface}'
    radius: '{rounded.lg}'
  board-tile-hidden:
    background: '{colors.stage-tile}'
    border: '2px solid {colors.stage-line}'
    foreground: '{colors.stage-ink}'
    radius: '{rounded.md}'
    typography: '{typography.tv-label}'
  board-tile-hidden-unscored-mode:
    background: '{colors.stage-tile}'
    border: '2px dashed {colors.stage-line}'
  board-tile-pending:
    border: '2px solid {colors.stage-ink}'
  board-tile-revealed:
    background: '{colors.stage-ink}'
    foreground: '{colors.ink}'
    countBackground: '{colors.count-badge}'
    countForeground: '{colors.stage-ink}'
    radius: '{rounded.md}'
  board-tile-unscored:
    background: '{colors.stage-raised}'
    border: '2px dashed {colors.stage-line}'
    foreground: '{colors.stage-ink}'
    countForeground: '{colors.stage-muted}'
    radius: '{rounded.md}'
  team-score:
    background: '{colors.stage-raised}'
    foreground: '{colors.stage-ink}'
    radius: '{rounded.md}'
  team-score-active:
    background: '{colors.stage-accent}'
    foreground: '{colors.stage-on-accent}'
    labelTypography: '{typography.tv-team}'
  control-bar:
    background: '{colors.stage-raised}'
    foreground: '{colors.stage-muted}'
    typography: '{typography.tv-control}'
  control-bar-error:
    background: '{colors.stage-raised}'
    foreground: '{colors.stage-ink}'
    typography: '{typography.tv-control}'
---

# Toppsvar — Design Spine

> Visual identity contract. `EXPERIENCE.md` owns behavior, states and flows; it references tokens here as `{path.to.token}`. Both spines win on conflict with [the key-screen mock](mockups/key-screens.html). The mock predates the 2026-11-21 impeccable critique (`reviews/impeccable-critique-2026-11-21.md`) and is not updated: where it differs, the spines win.

## Brand & Style

Toppsvar is a party game played in someone's living room, about people who are in that room. The visual posture is **a warm house party, not a TV studio**. Host and Participant pages are calm and paper-like: they are places to write, read and correct, and they should feel trustworthy, because anonymity only works if people believe the form. The play view is the one loud surface: a dark stage, large cream tiles and a single mint accent that marks whose turn it is.

Three rules carry the brand:

1. **The content is the show.** Questions and Answers are the funny part. Chrome stays quiet: no illustrations, mascots, confetti or decorative gradients.
2. **Trust is visible.** Nothing on a Participant page looks like an account, avatar or identity. The anonymity notice is set in body text, not small print.
3. **Not the TV show.** The format resembles a known television game show, and PRD §6.3 forbids imitating its name, look or branding. Toppsvar therefore avoids a blue-and-gold stage, an oval board frame, flipping number panels, a red X for a miss, buzzer sounds and any "the survey says" phrasing. The play view is a single-column ranked *top list* (the product's name), not a two-column board.

`[ASSUMPTION]` The palette and the display face were chosen in a headless run without the group's input. They meet every contrast and legibility constraint, but the group should confirm the direction (see `EXPERIENCE.md`, Open Questions).

## Colors

Two families: **light** for Host pages and the answer form, **stage** for the play view. There is no dark mode for the light surfaces in Stage 1.

| Token | Hex | Role | Never used for |
|---|---|---|---|
| `paper` | `#FAF7F2` | Page background, light surfaces | Text |
| `surface` | `#FFFFFF` | Cards, inputs, dialogs | — |
| `surface-sunken` | `#F1ECE4` | Answer chips; the *Ikke på brettet* and *Forkastet* sections in Review | Primary content areas |
| `ink` | `#1E1A22` | Body text, headings, focus ring on light surfaces, SelectionBar | — |
| `ink-muted` | `#5A5363` | Helper text, counters, metadata | Anything the user must read to act |
| `line` | `#E2DBD0` | Decorative dividers and card borders | Input or control borders (fails 3:1) |
| `line-strong` | `#857D8C` | Input and checkbox borders, secondary button border | Text |
| `primary` | `#7B2D5E` (berry) | Primary buttons, links, selected state | Error or warning meaning; anything on the stage |
| `primary-hover` | `#5F2148` | Hover and pressed state of `primary` | — |
| `primary-soft` | `#F5E7F0` | Selected Group card and chip, info notice | — |
| `focus-inverse` | `#FFFFFF` | Focus ring on dark surfaces: the SelectionBar and the play view | Light surfaces |
| `success` / `success-soft` | `#1D6B45` / `#E2F1E8` | *Gjennomgått* marks, "Lagret" status, success notice | Decoration |
| `warning` / `warning-soft` | `#7A4E00` / `#FCEFD2` | Fallback notice, displayed-once link panel, "cannot be undone" hints | Errors |
| `danger` / `danger-soft` | `#A8231A` / `#FBE9E7` | Validation errors, delete actions | A miss in play (a miss is not an error) |
| `stage` | `#10201E` (forest) | Play view background | Light surfaces |
| `stage-raised` | `#1A302C` | Team column, control bar, unscored tiles | — |
| `stage-tile` | `#24413C` | Hidden tile fill | — |
| `stage-line` | `#739690` | Hidden tile border (needed: tile fill alone is 1.5:1 against `stage`) | Text |
| `stage-ink` | `#F6F1E7` (cream) | Text on stage; revealed tile fill | — |
| `stage-muted` | `#A7BAB4` | Control bar text, "uten poeng" marker | Labels or Scores |
| `stage-accent` | `#7FE0C2` (mint) | Active Team card fill, Score change | Revealed tiles, decoration |
| `count-badge` | `#10201E` (forest) | Count badge on a revealed tile, with `stage-ink` digits | Anything else |

### Verified contrast (WCAG 2.1 AA)

| Pair | Ratio | Requirement |
|---|---:|---|
| `ink` on `paper` / `surface` / `surface-sunken` | 16.0 / 17.1 / 14.6 | 4.5 text |
| `ink-muted` on `paper` / `surface` / `surface-sunken` | 6.9 / 7.4 / 6.3 | 4.5 text |
| `on-primary` on `primary` / `primary-hover` | 8.8 / 11.7 | 4.5 text |
| `primary` on `paper` / `primary-soft` | 8.3 / 7.4 | 4.5 text |
| `success` on `success-soft` · `warning` on `warning-soft` · `danger` on `danger-soft` | 5.6 · 6.3 · 6.1 | 4.5 text |
| `line-strong` on `surface` / `paper` | 4.0 / 3.7 | 3.0 UI boundary |
| `stage-ink` on `stage` / `stage-raised` / `stage-tile` | 15.0 / 12.4 / 9.8 | 4.5 text |
| `stage-muted` on `stage` / `stage-raised` / `stage-tile` | 8.3 / 6.9 / 5.4 | 4.5 text |
| `stage-accent` on `stage` / `stage-raised` | 10.7 / 8.9 | 3.0 UI |
| `stage-line` on `stage` / `stage-tile` | 5.2 / 3.4 | 3.0 UI boundary |
| `ink` on `stage-ink` (revealed tile) · `primary` on `stage-ink` | 15.2 · 7.8 | 4.5 text |
| `focus-inverse` on `ink` (SelectionBar) / on `stage` | 17.1 / 16.8 | 3.0 UI |
| `stage-on-accent` on `stage-accent` (active Team card, all text) | 10.7 | 4.5 text |
| `stage-ink` on `count-badge` (Count digits) · `count-badge` on `stage-ink` (badge edge against the cream tile) | 15.0 · 15.0 | 4.5 text · 3.0 UI |
| `stage-ink` on `stage-raised` ("Bom" panel, control-bar banner) | 12.4 | 4.5 text |
| `stage-ink` on `stage-tile` (pending tile border) | 9.8 | 3.0 UI |
| `stage-line` on `stage` (dashed hidden tile while "uten poeng" is on) | 5.2 | 3.0 UI |
| `danger` on `surface` (`button-secondary-danger` text and border) | 7.2 | 4.5 text · 3.0 UI |

State is never carried by color alone: every colored status also has a word ("Gjennomgått", "Manuell", "uten poeng", "Svarer nå").

## Typography

Two families. **Bricolage Grotesque** (display, headings, everything on the TV) gives the product its party voice and has wide, open letterforms that hold up at distance. **The system UI stack** handles body text, forms and controls, so the answer form loads instantly on any phone. Both cover æ, ø and å. Font kept after the 2026-11-21 critique, which noted Bricolage Grotesque as a common display face; the group's choice stays Open Question 1 in `EXPERIENCE.md`.

The display face is **self-hosted from npm** (e.g. `@fontsource-variable/bricolage-grotesque`), never loaded from a CDN at build or run time, so the app builds, tests and runs offline (NFR-1, NFR-3). If the font fails, the fallback is `system-ui`, and all sizes still hold.

| Role | Token | Where |
|---|---|---|
| Display | `{typography.display}` 32 px | Page titles ("Mine spill", Game title), the ProgressCount figure |
| Heading | `{typography.heading}` 24 px | Section headings, the current Question in Review |
| Title | `{typography.title}` 18 px | Group labels in Review, Review section headings (`<h3>`), button text, Question legends on the form |
| Body | `{typography.body}` 16 px | Everything else, including **every input** (16 px stops iOS from zooming on focus) |
| Body small | `{typography.body-sm}` 14 px | Helper text, character counters |
| Label | `{typography.label}` 14 px | Field labels, StatusBadge |

Nothing on a laptop or phone is smaller than 14 px.

**TV ramp** (play view at 1920×1080, read from about 3 m). Everything the room reads is at least 48 px (FR-24): `{typography.tv-question}` 56 px, stepping down to `{typography.tv-question-long}` 48 px for Questions over 80 characters; `{typography.tv-label}` and `{typography.tv-count}` 48 px; `{typography.tv-team}` 48 px; `{typography.tv-score}` 80 px; `{typography.tv-score-final}` 120 px on the final Scores. Counts and Scores use `font-variant-numeric: tabular-nums` so digits do not jump. The only text below 48 px is the host-only control bar, `{typography.tv-control}` at 24 px in `stage-muted`, kept deliberately quiet so the room looks at the list.

## Layout & Spacing

Spacing uses Tailwind's default 4 px scale unchanged; the frontmatter repeats the keys the spines reference (`{spacing.4}` = `p-4` = 16 px). Named layout tokens:

| Surface | Width | Gutter | Grid |
|---|---|---|---|
| Answer form (phone) | full width, content max `{spacing.form-max}` 560 px, centred on larger screens | `{spacing.gutter-mobile}` 16 px | One column |
| Host pages (laptop) | content max `{spacing.host-max}` 1280 px | `{spacing.gutter-host}` 32 px | Game list and Game page: one column, max 800 px. Review: 288 px Question rail + flexible main pane |
| Play view (TV) | fixed 1920×1080 canvas, scaled to fit the window | `{spacing.gutter-tv}` 64 px | Main column 1312 px (Question + top list) · Team column 448 px · gap 32 px |

**Play view vertical budget (1080 px):** 48 top gutter · Question block budgeted at four lines of 48 px (221 px) · 24 gap · top list of up to 8 rows (696 px) · 24 gap · control bar 64 px · remainder as bottom gutter = 1077 px. "Spørsmål N av M" sits at the top of the Team column in `tv-team` / `stage-muted`, not in the main column. Row height is `clamp(80px, (696px − 8px × (n − 1)) / n, 104px)` with 8 px gaps: 104 px for six Groups or fewer, 80 px for eight. Rows are top-aligned and the row count still equals the Group count. A row whose revealed label wraps grows to 112 px (see BoardTile). Worst case, a 200-character Question with 8 Groups, fits 1080 px with the control bar visible.

Touch and click targets are at least `{spacing.control-min}` 44×44 px on every surface.

### Tailwind theme mapping

Tokens map by name; no renaming in code. With Tailwind v4 (CSS-first), declare them in `globals.css`:

```css
@theme {
  --color-paper: #FAF7F2;      /* every colors.* token → --color-<name> → bg-paper, text-ink, border-line-strong … */
  --color-primary: #7B2D5E;
  --color-stage: #10201E;
  /* … */
  --font-display: 'Bricolage Grotesque', system-ui, sans-serif;
  --text-tv-label: 48px;        /* every typography.* size → --text-<name> → text-tv-label */
  --radius-md: 10px;            /* rounded.* → --radius-<name> → rounded-md */
}
```

With Tailwind v3 the same names go under `theme.extend.colors`, `fontSize` and `borderRadius`. Spacing needs no entry. Component tokens become small React components (see Components), not `@apply` classes.

## Elevation & Depth

Flat by default. Depth means only "this floats above the page and will go away":

- **SelectionBar** in Review and **ConfirmDialog** use Tailwind `shadow-lg` / `shadow-xl`.
- Cards use a 1 px `line` border and no shadow.
- The play view uses no shadows; hidden, revealed and unscored tiles differ by fill and border.

## Shapes

`{rounded.sm}` 6 px for inputs and answer chips; `{rounded.md}` 10 px for buttons, cards, notices and tiles; `{rounded.lg}` 16 px for dialogs and the SelectionBar; `{rounded.full}` only for StatusBadge pills. Tiles are plain rounded rectangles: no ovals, bevels or frames.

## Components

The whole Stage 1 set is thirteen components. Anything not listed is a plain Tailwind-styled HTML element. Behavior for each lives in `EXPERIENCE.md` → Component Patterns.

| Component | Visual spec |
|---|---|
| **Button** | Variants `button-primary`, `button-secondary`, `button-secondary-danger`, `button-ghost`, `button-danger`. `button-secondary-danger` is a secondary button with `danger` text and a 1 px `danger` border, used for "Slett spillet" on the Game page; filled `button-danger` appears only inside a ConfirmDialog ("Slett for godt"). Min height 44 px, padding `{spacing.4}` horizontal. One primary per view region. Loading: label changes to the in-progress verb ("Sender …"), a 16 px spinner left of it, width locked. `aria-disabled` buttons keep their colors at 60 % opacity, with the reason shown as `body-sm` text directly below. |
| **TextField** | `text-field`. Label above (`label`), helper or counter below (`body-sm`, `ink-muted`). Invalid: 2 px `danger` border, error text in `danger` below the field with a leading "Feil:" for screen readers (visually hidden). Character counter right-aligned. |
| **AnswerFieldset** | A `surface` card, `{rounded.md}`, padding `{spacing.4}`. Legend: "Spørsmål 3 av 9" in `label` + Question text in `title`. Up to five TextFields stacked with `{spacing.3}` gap; "Legg til svar" as `button-ghost` with a plus sign. Error: card border becomes 2 px `danger`, error text at the top of the card. |
| **Notice** | `notice-info`, `notice-success`, `notice-warning`, `notice-danger`. Full width of its container, padding `{spacing.4}`, a bold first phrase, then body text. No icons required; if an icon is used it is decorative (`aria-hidden`). |
| **StatusBadge** | `status-badge` pill with the Game state word. State words have fixed colors: *Utkast* sunken/ink, *Samler inn* primary-soft/primary, *Grupperer* warning-soft/warning, *Til gjennomgang* warning-soft/warning, *Klar* success-soft/success, *Spilles* primary-soft/primary, *Ferdig* sunken/ink-muted. |
| **ProgressCount** | The figure ("færre enn 3" or "7") in `display`, "av 11 svar mottatt" in `body` beside it. No progress bar: a bar animating as answers arrive invites the timing inference FR-8 guards against. |
| **OnceLinkList** | `once-link-list`: 2 px `warning` border. Heading "Kopier lenkene nå", warning Notice text, a monospace list (system monospace, 14 px) of links each with a `button-secondary` "Kopier", and one `button-primary` "Kopier alle". |
| **ConfirmDialog** | `confirm-dialog` on native `<dialog>`, max 480 px wide, padding `{spacing.6}`. Title in `heading`, consequence text in `body`, actions right-aligned: cancel as `button-secondary`, confirm as `button-primary` or `button-danger` for destructive actions. |
| **GroupCard** | `group-card`, padding `{spacing.4}`. Header row: checkbox · rank ("1.") in `title` · label in `title` · Count ("4 personer") in `label` right-aligned · overflow menu (`button-ghost`, "Mer for «…»"). Body: AnswerChips wrapped with `{spacing.2}` gap. Selected: `group-card-selected`. Cards in *Ikke på brettet* sit on `surface-sunken` with an extra `1px dashed {colors.line-strong}` border. Discarded cards sit in the *Forkastet* section on `surface-sunken` with the label struck through. **Compact single-Answer row:** a Group with one chip whose text equals its label renders as one 52 px row (checkbox · rank · label · Count · menu) with no chip row; if renamed, the raw Answer follows the label in `body-sm` `ink-muted`. This is presentation only: it is still an ordinary Group (AD-15), and "Flytt" or "Ny gruppe" on it equals selecting the Group. |
| **AnswerChip** | `answer-chip`: checkbox + raw Answer text in `body`; collapsed duplicates show "· 3 svar" in `ink-muted`. Selected: `answer-chip-selected`. Min height 44 px. |
| **SelectionBar** | `selection-bar`, sticky to the bottom of the Review main pane, `shadow-lg`. Left: selection summary in `title`. Right: actions as `button-secondary` restyled on dark (surface fill, ink text). Focus on this dark surface uses `{components.focus-inverse}`. An operation error shows inside the bar above its actions in `danger-soft` fill / `danger` text. |
| **BoardTile** | Three looks. **Hidden** `board-tile-hidden`: rank number in `tv-label` at left (rank slot 56 px), rest of the row empty; while "Vis resten uten poeng" is on, the border turns `2px dashed {colors.stage-line}` (`board-tile-hidden-unscored-mode`), previewing the unscored look; while a click waits for the server the border is `2px solid {colors.stage-ink}` (`board-tile-pending`). **Revealed** `board-tile-revealed`: rank, label in `tv-label`, Count in `tv-count` in `stage-ink` digits inside a `count-badge` pill at right (`min-width: 96px`). **Unscored** `board-tile-unscored`: dashed border, label in `stage-ink`, Count in `stage-muted`, and "uten poeng" in 24 px beside it. Row height follows the clamp in Layout & Spacing. **A revealed label is never truncated:** if it does not fit one line it wraps to two at line-height 1.05 and the row grows to 112 px. |
| **TeamScore** | `team-score` block per Team, stacked in the Team column: Team name in `tv-team`, Score in `tv-score`. Team names are 1 to 14 characters so four Teams fit the 400 px content width. Active Team: `team-score-active`, a card filled `stage-accent` with all text in `stage-on-accent`, and the words "Svarer nå" in `tv-team` (48 px) above the name; no badge, no side border. On "Sluttstilling" every Team uses `tv-score-final` 120 px, Teams are centred vertically, and the winner takes the `team-score-active` look with "Vinner" in place of "Svarer nå". |

The play view's **control bar** (`control-bar`) is part of the play view layout, not a reusable component: a row of `tv-control` text buttons on `stage-raised`, each showing its keyboard shortcut in brackets ("Angre [Z]"). While "Vis resten uten poeng" is on, its item reads "Avslører uten poeng [U]" in `stage-ink` at weight 700. A save-failure or lost-connection banner (`control-bar-error`, 64 px, `stage-ink`, weight 700) replaces the control-bar row and never overlays the list.

## Do's and Don'ts

| Do | Don't |
|---|---|
| Keep the light surfaces quiet so Questions and Answers carry the fun | Add illustrations, mascots, confetti or gradients |
| Use one accent per surface: berry on light, mint on stage (the Count badge is forest, not berry) | Use mint on light surfaces or berry anywhere on the stage |
| Size everything the room reads at 48 px or more, including whose turn it is | Put anything the room must read in the 24 px control-bar style |
| Use `focus-inverse` for focus on `ink` and stage surfaces (it replaces the former mint stage ring) | Leave an ink focus ring on an ink background |
| Show state with a word plus color | Rely on color, icons or position alone |
| Use `danger` only for errors and destructive actions | Show a miss in red, or with an X |
| Self-host fonts from npm | Load fonts or icons from a CDN |
| Use a single-column top list on the TV | Copy a TV game-show board: oval frame, gold panels, flipping tiles, buzzers |
| Use plain text for identity-free Participant pages | Show avatars, account icons, names or emails anywhere a Participant looks |
