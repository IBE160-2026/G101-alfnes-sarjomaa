---
name: Toppsvar
status: final
created: 2026-11-21
updated: 2026-11-22
sources:
  - ../../prds/prd-Toppsvar-2026-10-12/prd.md
  - ../../briefs/brief-Toppsvar-2026-09-14/brief.md
  - ../../briefs/brief-Toppsvar-2026-09-14/addendum.md
  - ../../briefs/brief-Toppsvar-2026-09-14/tilbakemelding-product-brief.md
---

# Toppsvar — Experience Spine

> Behavior contract: information architecture, states, interactions, accessibility and flows. Visual tokens live in `DESIGN.md` and are referenced as `{path.to.token}`. Capitalised terms are the PRD Glossary (§3), used verbatim. Wireframes below and the static mock [`mockups/key-screens.html`](mockups/key-screens.html) illustrate; **both spines win on conflict with any wireframe or mock.**

## Foundation

- **Three surfaces, one Next.js app, Tailwind CSS.** (1) The **answer form**, on a Participant's phone at 360 px. (2) **Host pages**, on a laptop, with **Review** as the most demanding screen. (3) The **play view**, on a 1920×1080 TV or projector mirrored from the Host's laptop.
- **No UI library.** Thirteen small components (`DESIGN.md` → Components) on native HTML: `<dialog>`, `<fieldset>`, checkboxes, `<select>`. No toast system, no drag-and-drop, no animation library.
- **Interface language:** Norwegian bokmål (NFR-7), `<html lang="nb">`. Every microcopy example here is the literal string to ship unless marked as a pattern.
- **Scope:** Stage 1 only. Stage 2 hooks are noted where a Stage 1 choice must leave room for them.
- **Budget:** two developers, about nine days for all of Stage 1. Where this spine had a choice, it took the option with fewer states and fewer components.

## Information Architecture

| Route | Surface | Who | Purpose |
|---|---|---|---|
| `/` | Landing | Anyone | One sentence on what Toppsvar is; "Logg inn" and "Opprett konto". In Demo mode, a Notice with the demo login |
| `/registrer` | Register | Anyone | Create a Host account (FR-1) |
| `/logg-inn` | Log in | Anyone | Log in (FR-1) |
| `/spill` | Game list ("Mine spill") | Host | List own Games with StatusBadge; create a Game (FR-2) |
| `/spill/[id]` | Game page | Host | State-driven hub: Questions, Invite links, progress, revoke, close, start play, delete (FR-3 to FR-10) |
| `/spill/[id]/gjennomgang` | Review | Host | Correct the Grouping and confirm the Board (FR-19 to FR-21) |
| `/spill/[id]/skjerm` | Team setup → play view → final Scores | Host, shown to the room | FR-23 to FR-27. For a *played* Game it shows the final Scores |
| Invite link (shape owned by architecture) | Answer form | Participant | Answer, return, change (FR-6, FR-7) |

**Navigation.** Host pages share a top bar: wordmark "Toppsvar" (links to `/spill`), "Mine spill", "Logg ut". Game pages show a breadcrumb `Mine spill › {Game title}`. There is no sidebar. The play view has no top bar; it is a full-window canvas with its own control bar. Participant pages have no navigation at all and no link to any Host page.

**The Game page follows the Game state** (PRD §4.1). One route, one primary action per state:

| State | StatusBadge | Main panel | Primary action |
|---|---|---|---|
| *draft* | Utkast | Question editor; "Lag invitasjonslenker" panel | "Lag invitasjonslenker" (opens Collection) |
| *collecting* | Samler inn | Locked Question list; ProgressCount; create more links; "Erstatt en tapt lenke" | "Steng innsamlingen" |
| *grouping* | Grupperer | Grouping status | — (waits) |
| *in review* | Til gjennomgang | Summary: Questions, Groups proposed, any fallback | "Gå til gjennomgangen" |
| *ready* | Klar | "Brettet er låst." Question count | "Start spillet" |
| *playing* | Spilles | Current Question and Scores | "Fortsett spillet" |
| *played* | Ferdig | Final Scores; auto-deletion date | — |

Every state shows "Slett spillet" at the bottom of the page (FR-3).

## Surface: Review

The product's decision point (PRD §4.6), sketched first and in most detail. Laptop, `{spacing.host-max}`.

### Wireframe — Review, Question 3 of 9, three Answers selected

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Toppsvar                                                                  Mine spill   Logg ut  │
├─────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Mine spill › Hyttetur 2026 › Gjennomgang                                                        │
│ ┌ Notice (warning) ───────────────────────────────────────────────────────────────────────────┐ │
│ │ Dommeren fikk ikke gruppert spørsmål 4 og 7. De starter med én gruppe per ulikt svar,   │ │
│ │ så du slår sammen for hånd. De andre spørsmålene har dommerens forslag.                 │ │
│ └─────────────────────────────────────────────────────────────────────────────────────────────┘ │
│ ┌ Question rail (288) ──────┐ ┌ Main pane ──────────────────────────────────────────────────┐   │
│ │ 2 av 9 gjennomgått        │ │ Spørsmål 3 av 9                      [Marker som gjennomgått]│   │
│ │                           │ │ Hva sier Jonas til dørvakten som aldri funker?              │   │
│ │ 1 Hva gjør Maren når hun… │ │                                                             │   │
│ │   ✓ Gjennomgått           │ │ På brettet (8 grupper)                                      │   │
│ │ 2 Hvem forsvinner først…  │ │ ┌─────────────────────────────────────────────────────────┐ │   │
│ │   ✓ Gjennomgått           │ │ │ ☐ 1. Jeg kjenner eieren                 5 personer  [⋯] │ │   │
│ │▶3 Hva sier Jonas til dør… │ │ │   [☐ jeg kjenner eieren · 3 svar] [☐ kjenner sjefen]    │ │   │
│ │                           │ │ │   [☐ eieren er kompisen min]                            │ │   │
│ │ 4 Hva finner Siri i lomm… │ │ └─────────────────────────────────────────────────────────┘ │   │
│ │   Manuell                 │ │ ┌─────────────────────────────────────────────────────────┐ │   │
│ │ 5 …                       │ │ │ ☐ 2. Jeg står på gjestelista            4 personer  [⋯] │ │   │
│ │ …                         │ │ │   [☑ står på lista · 2 svar] [☐ jeg er på gjestelista]  │ │   │
│ │ 9 …                       │ │ │   [☑ jeg skal bare hente jakka]                         │ │   │
│ │                           │ │ └─────────────────────────────────────────────────────────┘ │   │
│ │ ───────────────────────── │ │   … groups 3–8 …                                            │   │
│ │ [  Lås brettet  ] (aria-  │ │ ━━━ Alt under streken vises ikke i spillet ━━━━━━━━━━━ │   │
│ │  disabled)                │ │ Ikke på brettet (2 grupper)                                 │   │
│ │ Gjennomgå alle spørsmålene│ │ Vises ikke i spillet. Slå dem sammen med en gruppe over     │   │
│ │ først (7 igjen).          │ │ for at de skal telle.                                       │   │
│ │                           │ │ ┌ (surface-sunken) ───────────────────────────────────────┐ │   │
│ └───────────────────────────┘ │ │ ☐ 9. Han lager scene                    1 person   [⋯]  │ │   │
│                               │ │   [☑ lager scene i døra]                                │ │   │
│                               │ └─────────────────────────────────────────────────────────┘ │   │
│                               │ Forkastet (1 gruppe)                                        │   │
│                               │ ┌ (surface-sunken) ───────────────────────────────────────┐ │   │
│                               │ │ ~~Noe om eksen~~               2 personer [Angre forkasting]│   │
│                               │ │   noe om eksen · tar opp eksen                          │ │   │
│                               │ └─────────────────────────────────────────────────────────┘ │   │
│                               │                                                             │   │
│                               │ ┌ SelectionBar (sticky, ink) ─────────────────────────────┐ │   │
│                               │ │ 3 svar valgt   [Flytt til gruppe ▾] [Ny gruppe] [Fjern valg]│   │
│                               │ └─────────────────────────────────────────────────────────┘ │   │
│                               └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

The board-limit divider "Alt under streken vises ikke i spillet" sits between rank 8 and rank 9 and only appears when a Question has more than eight non-discarded Groups. The rendered version of this state is in [`mockups/key-screens.html`](mockups/key-screens.html#review).

### Review anatomy

| Region | Content | Rules |
|---|---|---|
| Fallback Notice | Which Questions fell back (FR-17) | `notice-warning`, shown above the layout until every fallback Question is marked reviewed. Omitted when no Question fell back. Copy follows `fallback_reason` (AD-12): `NO_KEY` → "Ingen KI-nøkkel er satt opp, så alle spørsmålene starter med én gruppe per ulikt svar."; `NO_STORED_RULING` → "Det finnes ingen lagret avgjørelse for spørsmål {N}, så det starter med én gruppe per ulikt svar."; `TIMEOUT`, `ERROR`, `REFUSAL`, `INVALID_OUTPUT` → "Dommeren fikk ikke gruppert spørsmål {N}. Det starter med én gruppe per ulikt svar." (wireframe wording; "rakk ikke" is false for three of these four codes). In Demo mode the `NO_STORED_RULING` wording is used for both, never the key sentence. |
| Question rail | Count "K av N gjennomgått"; one row per Question: number, truncated text (full text in `title` attribute and accessible name), status words | Visible status words only: "✓ Gjennomgått" (`success`) and "Manuell" for fallback Questions. No status line means not reviewed; the words "Ikke gjennomgått" stay in the accessible name only. A change clears the mark, so the status line disappears (FR-20); there is no separate "changed" status. Current Question has `aria-current="page"`. |
| Lås brettet | Primary button at the foot of the rail | `aria-disabled` with visible reason "Gjennomgå alle spørsmålene først (N igjen)." until all are marked; then opens ConfirmDialog. |
| Question header | "Spørsmål 3 av 9", Question text in `{typography.heading}`; at its right, "Marker som gjennomgått" (replaces the status pill) | When already reviewed, the same spot shows "✓ Gjennomgått" plus "Neste spørsmål". |
| *På brettet* | Heading `<h3>` in `{typography.title}` `ink`, sentence case: "På brettet (8 grupper)". GroupCards ranked 1 to 8 in Board order (FR-16, FR-21) | Count shown as "1 person" / "N personer" (Count = distinct Contributor keys, FR-15). |
| Board-limit divider | 2 px solid `line-strong` line, label in `{typography.label}` `ink`: "Alt under streken vises ikke i spillet" | Only when >8 non-discarded Groups. |
| *Ikke på brettet* | Heading `<h3>`: "Ikke på brettet (1 gruppe)". Groups ranked 9+ (FR-19) | Same GroupCard, on `surface-sunken` with a `1px dashed {colors.line-strong}` border, with the sentence "Vises ikke i spillet. Slå dem sammen med en gruppe over for at de skal telle." Omitted when empty. |
| *Forkastet* | Heading `<h3>`: "Forkastet (1 gruppe)". Discarded Groups (FR-20) | Read-only cards, label struck through, Answers listed as plain text, one "Angre forkasting" button. A Group whose only Answer equals its label does not repeat it; only "N svar" follows when there are several. No checkboxes. Omitted when empty. |
| Marker som gjennomgått | Primary button in the Question header, right-aligned (not below the sections) | Marks the Question reviewed and moves to the next unreviewed Question. Its error shows directly under the button. |
| Compact single-Answer row | A Group with one chip whose text equals its label | Renders as one 52 px row (checkbox · rank · label · Count · menu) without a chip row; if renamed, the raw Answer follows the label in `body-sm` `ink-muted`. With several identical Answers the count follows as "· N svar", or as "N svar" alone when the label is the raw Answer. **Presentation only:** it is still an ordinary Group (AD-15), and "Flytt" or "Ny gruppe" on it equals selecting the Group. Keeps a fallback Question with ~40 singleton Groups to roughly 2,100 px instead of ~3,400 px. |
| SelectionBar | Appears when anything is selected | See Component Patterns. |

### Review operations

All operations are scoped to the current Question and confirmed by the server before the screen changes (pessimistic, with the affected cards `aria-busy` and dimmed while pending; NFR-5 caps this at one second).

| Operation (FR-20) | How | Result on screen | Announced (live region) |
|---|---|---|---|
| **Merge** | Tick two or more Group checkboxes → SelectionBar "Slå sammen N grupper" | One Group, label of the highest-Count source (ties by rank), Count recomputed as distinct Contributor keys; list re-sorts; focus moves to the merged Group's heading | "Slått sammen til «Jeg kjenner eieren», nå 6 personer, plass 1." |
| **Move to another Group** | Tick Answer chips (from one or several Groups) → "Flytt til gruppe" → choose from a list of the Question's non-discarded Groups, sorted by Count, each shown as "label (N)" | Chips move; both Groups recount; empty source Groups disappear; focus moves to the target Group | "3 svar flyttet til «Jeg står på gjestelista»." |
| **Move to a new Group** | Tick chips → "Ny gruppe" | New Group with the FR-16 default label; its rename field opens with focus | "Ny gruppe «står på lista» laget. Skriv et nytt navn eller trykk Enter." |
| **Rename** | Group menu → "Gi nytt navn", or click the label | Inline TextField, counter "N/40"; Enter saves, Esc cancels | "Navnet er endret." |
| **Discard** | Group menu → "Forkast fra brettet" | Card moves to *Forkastet*; the next Group below the limit (if any) moves up onto the Board | "«Noe om eksen» er forkastet og vises ikke i spillet." |
| **Undo discard** | "Angre forkasting" on a discarded card | Group returns to its ranked place | "«Noe om eksen» er tilbake." |
| **Mark reviewed** (FR-21) | "Marker som gjennomgått" | Rail status updates; next unreviewed Question opens | "Spørsmål 3 er gjennomgått. Viser spørsmål 4." |
| **Confirm Board** (FR-21) | "Lås brettet" → ConfirmDialog | Game moves to *ready*; redirect to the Game page | — (page change) |

Every change to a Question clears its reviewed mark (FR-20), and the rail drops its "✓ Gjennomgått" line (not reviewed). There is **no general undo in Review**: each operation can be reversed by another (merge ↔ move to new Group; discard ↔ undo discard; rename ↔ rename).

**Answer chips.** Each Answer appears under exactly one Group (FR-19). Answers with the same normalised text (FR-17 definition) in one Group collapse into one chip showing the most common written form plus "· N svar"; ticking it selects all of them. Chips are sorted **alphabetically**, never by arrival or rank, so the display implies no order (FR-13). Answer sets, Contributor keys and ranks are never shown (FR-12).

**Mark reviewed with no Group left on the Board.** Decided by AD-15 (`NO_GROUPS_ON_BOARD`). If every Group of a Question is discarded, "Marker som gjennomgått" shows, under the button, the inline error "Minst én gruppe må være på brettet før du kan markere spørsmålet." (see Open Questions).

### PRD §10 item 2 — Answers near the Judge's threshold (decided)

**Stage 1 shows no threshold or confidence signal of any kind**, matching FR-19. Near-threshold cases are found structurally instead: small Groups the Judge kept apart land in *Ikke på brettet*, where the Host sees them next to the Board; the "Flytt til gruppe" list is sorted by Count, so the likely target is at the top; and fallback Questions are flagged "Manuell". **Stage 2 candidate:** if architecture's grouping strategy can produce a per-Answer "borderline" flag cheaply, an AnswerChip may carry a small text marker "usikker" in `{colors.ink-muted}`. Never a group-level percentage, and never in the play view.

## Surface: Answer form

Phone first, 360 px wide, `{spacing.gutter-mobile}` gutters, content max `{spacing.form-max}`.

### Wireframe — first visit (left) and submit with missing Answers (right)

```
┌──────────────────────────────┐   ┌──────────────────────────────┐
│ Toppsvar                     │   │ ┌ Notice (danger) ─────────┐ │
│ Hyttetur 2026                │   │ │ 2 spørsmål mangler svar  │ │
│ ┌ Notice (info) ───────────┐ │   │ │ · Spørsmål 4: Hva finner │ │
│ │ Ingen kan se hvem som    │ │   │ │   Siri i lomma…          │ │
│ │ skrev hvilket svar,      │ │   │ │ · Spørsmål 7: Hvem …     │ │
│ │ heller ikke verten.      │ │   │ └──────────────────────────┘ │
│ │ Verten leser likevel     │ │   │  (focus lands here; each     │
│ │ alle svarene slik de er  │ │   │   line links to its fieldset)│
│ │ skrevet, og svarene kan  │ │   │ …                            │
│ │ bli sendt til en ekstern │ │   │ ┌ Spørsmål 4 av 9 (danger) ┐ │
│ │ KI-tjeneste for          │ │   │ │ Feil: Skriv minst ett    │ │
│ │ gruppering.              │ │   │ │ svar.                    │ │
│ └──────────────────────────┘ │   │ │ Hva finner Siri i lomma  │ │
│ Gi 1–5 svar per spørsmål.    │   │ │ dagen derpå?             │ │
│ Skriv det første du kommer…  │   │ │ Svar 1                   │ │
│ ┌ Spørsmål 1 av 9 ─────────┐ │   │ │ [______________________] │ │
│ │ Hva gjør Maren når hun   │ │   │ │ Svar 2 (valgfritt)       │ │
│ │ har forsovet seg?        │ │   │ │ [______________________] │ │
│ │ Svar 1                   │ │   │ │ + Legg til svar          │ │
│ │ [______________________] │ │   │ └──────────────────────────┘ │
│ │ Svar 2 (valgfritt)       │ │   │ …                            │
│ │ [______________________] │ │   │ 7 av 9 spørsmål har svar     │
│ │ + Legg til svar          │ │   │ [       Send inn svar      ] │
│ └──────────────────────────┘ │   │ Utkastet lagres bare på      │
│ … Spørsmål 2–9 …             │   │ denne enheten. Sender du inn │
│ 0 av 9 spørsmål har svar     │   │ fra en annen enhet …         │
│ [       Send inn svar      ] │   │                              │
│ Utkastet lagres bare på      │   │                              │
│ denne enheten. Sender du inn │   │                              │
│ fra en annen enhet …         │   └──────────────────────────────┘
└──────────────────────────────┘
```

The wireframe abbreviates the instruction and helper lines (marked "…"); the literal strings are in the Answer form rules.

### Answer form rules

- **Instruction line**, under the anonymity notice: "Gi 1–5 svar per spørsmål. Skriv det første du kommer på i Svar 1." Rank 1 only breaks ties (FR-16), so the line does not ask for "the most important".
- **Header:** wordmark "Toppsvar" and the Game title. No name, email, avatar, account indicator or login link anywhere (FR-1, FR-6, FR-11). Page `<title>`: the server shell is generic ("Toppsvar", AD-7); the client sets "{Game title} – Toppsvar" after `openInviteLink` returns.
- **Anonymity notice** (FR-14), above the first Question, `notice-info`, exactly: *"Ingen kan se hvem som skrev hvilket svar, heller ikke verten. Verten leser likevel alle svarene slik de er skrevet, og svarene kan bli sendt til en ekstern KI-tjeneste for gruppering."* It has no condition: it does not depend on which Judge provider is configured (sprint change proposal 2026-11-23, D1).
- **One AnswerFieldset per Question**, all on one scrolling page (8 to 15 Questions is a short scroll; paging would add states). Two fields shown: "Svar 1" and "Svar 2 (valgfritt)". "Legg til svar" adds a field up to five (FR-6), then disappears. Added fields 3 to 5 have a "Fjern" button (`aria-label="Fjern svar 3"`). Rank is field order; there is no reorder control in Stage 1.
- **Inputs:** `maxlength="80"`, `autocomplete="off"`, `autocapitalize="sentences"`, `enterkeyhint="next"`. A counter "N/80" appears from 60 characters. A server refusal of an over-long Answer shows "Svaret kan ha maks 80 tegn." under the field.
- **Progress line** above the submit button: "N av M spørsmål har svar". Not sticky, so it never covers a field when the phone keyboard is open.
- **Submit** "Send inn svar" (first time) or "Lagre endringer" (returning). Validation runs on submit only, never while typing. Missing Questions → error summary (`notice-danger`) at the top, focus moved to it, one link per missing Question; each affected fieldset gets the inline error "Skriv minst ett svar." (FR-6).
- **Confirmation** replaces the form: heading "Svarene dine er lagret.", body "Du kan endre dem på denne enheten og i denne nettleseren helt til verten stenger innsamlingen." (FR-7), and a secondary button "Se eller endre svarene".
- **Returning** through the same Invite link **on the submitting device and browser** (FR-7, AD-8): the form is pre-filled with the saved Answer set and opens with `notice-info` "Du har allerede sendt inn. Endringer lagres først når du trykker «Lagre endringer»." On any other device or browser the link opens an empty form, exactly like an unused link, and submitting there replaces the earlier Answer set. The form carries one helper line under the submit button, in both visits: "Utkastet lagres bare på denne enheten. Sender du inn fra en annen enhet, erstatter det de forrige svarene."

### PRD §10 item 5 — Unsent drafts (decided)

**Yes, the answer form keeps an unsent draft on the Participant's device, and only there.**

- Stored in `localStorage` as the Participant types (debounced, about 500 ms), under one key per Invite link, `toppsvar:<gameId>:<first 16 chars of token>`, never the whole Token and with no hashing in the browser (`crypto.subtle` does not exist on plain `http://<LAN-IP>`). The same key also holds the edit secret (AD-8). Nothing is sent to the server before "Send inn svar" (FR-6).
- Status line under the submit button: the single helper line above (it replaces the two separate lines, so the CTA is not crowded on a 360 px screen).
- On load, a local draft wins over the server copy and the page says: "Du har endringer som ikke er sendt inn." with a ghost button "Forkast endringene".
- The draft is cleared after a successful submit. The whole key, draft and edit secret, is cleared whenever the server answers "closed" or "unknown" for this Invite link.
- Rationale: UJ-2 has Jonas on a bus, where a dropped tab or connection is the common failure; losing half a form is the realistic way a Participant gives up. The cost is that someone else using the same phone could read the draft before it is sent. That is the same exposure as the phone's browser history holding the Invite link, so it adds no new risk class. The README's anonymity section should mention it.

## Surface: Game page and other Host pages

### Wireframe — Game page in *collecting*

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Toppsvar                                               Mine spill   Logg ut  │
├──────────────────────────────────────────────────────────────────────────────┤
│ Mine spill › Hyttetur 2026                                                   │
│ Hyttetur 2026                                              [Samler inn]      │
│                                                                              │
│ ┌ Innsamling ──────────────────────────────────────────────────────────────┐ │
│ │  færre enn 3   av 11 svar mottatt                                        │ │
│ │  Du ser bare antallet, aldri hvem som har svart.                         │ │
│ │                                                                          │ │
│ │  [ Steng innsamlingen ] (aria-disabled)                                  │ │
│ │  Du trenger minst 3 innsendte svar før du kan stenge. Det beskytter      │ │
│ │  anonymiteten. Lag flere lenker, vent litt, eller slett spillet.         │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│ ┌ Flere lenker ────────────────────┐ ┌ Erstatt en tapt lenke ─────────────┐  │
│ │ Antall  [ 2 ]  [Lag lenker]      │ │ Lim inn lenken  [________________] │  │
│ │ 11 av maks 50 lenker brukt.      │ │ [Trekk tilbake og lag ny]          │  │
│ └──────────────────────────────────┘ └────────────────────────────────────┘  │
│ ┌ Spørsmål (låst) ─────────────────────────────────────────────────────────┐ │
│ │ 1. Hva gjør Maren når hun har forsovet seg?                               │ │
│ │ 2. …                                                                      │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│ ── Slett spillet ──                                                          │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Host page rules

| Page / panel | Rules |
|---|---|
| **Register / log in** (FR-1) | `/registrer` shows a TextField "Registreringskode" only when the server requires `REGISTRATION_CODE` (AD-21); a wrong code: "Registreringskoden stemmer ikke." Email + password TextFields with real `<label>`s and `autocomplete="email"`, `"new-password"` / `"current-password"`. Password helper "Minst 10 tegn." Wrong credentials: one message, "Feil e-post eller passord." Expired session: redirect to `/logg-inn` with `notice-info` "Du ble logget ut etter 14 dager uten bruk. Logg inn igjen." |
| **Game list** (FR-2) | Create row at the top: TextField "Navn på spillet" (1–80, counter from 60) + "Lag spill". Rows: title (link), StatusBadge, "Sist endret {dato}". Newest first. |
| **Question editor** (FR-4, *draft*) | Ordered list of Questions, each a textarea (1–200, counter from 160) with "Flytt opp", "Flytt ned" and "Slett" buttons (no drag). Autosave on blur with inline status "Lagret" / "Fikk ikke lagret. Prøv igjen." `[ASSUMPTION]` "Legg til spørsmål" below the list with "N av 20 spørsmål"; hidden at 20. Empty Questions are not saved. |
| **Create Invite links** (FR-5) | Number field "Antall lenker" (1 to the remaining of 50) + "Lag lenker". The panel shows "{issued} av maks 50 lenker brukt." from `progress.issued`. At the cap (`LINK_CAP_REACHED`, also on revoke): "Spillet har nådd maks 50 lenker." Zero Questions: `aria-disabled` with "Skriv minst ett spørsmål først." First creation in *draft* asks through ConfirmDialog: "Åpne innsamlingen? Spørsmålene låses når du lager de første lenkene, og kan ikke endres etterpå." |
| **OnceLinkList** (FR-5, FR-9) | Shown once, right after creation. Heading "Kopier lenkene nå". Text: "Av hensyn til anonymiteten lagrer vi ikke lenkene, så de kan ikke vises igjen. Send én lenke til hver deltaker." "Kopier alle" + per-link "Kopier". Closed with "Jeg har kopiert lenkene"; leaving the page before that triggers the browser's leave-page warning. |
| **ProgressCount** (FR-8) | "færre enn 3 av N svar mottatt" until three Answer sets exist, then "K av N svar mottatt". N counts active (not revoked) Invite links. Fixed sentence below: "Du ser bare antallet, aldri hvem som har svart." Refreshed on page load and every 30 s; never animated. |
| **Revoke** (FR-9) | TextField "Lim inn lenken" + "Trekk tilbake og lag ny" → ConfirmDialog, same text every time: "Trekke tilbake lenken? Alt som er sendt inn via den, slettes. Du får én ny lenke, som vises bare én gang." Confirm → OnceLinkList with one link. A pasted link that is not an active link of this Game comes back as inline `LINK_UNKNOWN`: "Denne lenken er ikke en aktiv lenke i dette spillet." (never a 404) |
| **Close Collection** (FR-10) | Below three: `aria-disabled`, reason as in the wireframe. From three: ConfirmDialog "Stenge innsamlingen? Dette kan ikke angres. Lenkene slutter å virke, og svarene grupperes." With no model key, the dialog adds: "Ingen KI-nøkkel er satt opp, så du grupperer for hånd i gjennomgangen." |
| **Grouping** (FR-15) | Status panel: "Dommeren, en KI-modell, grupperer svarene … Det tar vanligvis under to minutter." (the only place the Judge is explained; the term map is unchanged elsewhere) Progress "4 av 9 spørsmål ferdig", from `grouping.progress` (AD-12). Polls every 3 s and moves to *in review* on completion. |
| **Start play** (*ready*) | "Brettet er låst. 9 spørsmål er klare." + "Start spillet" → `/spill/[id]/skjerm`. |
| **Played** (FR-3, FR-27) | Final Scores table, a link "Vis sluttstilling" to `/spill/[id]/skjerm`, and `notice-info` "Spillet og alle svarene slettes automatisk {dato}." |
| **Usage report** (FR-18) | Button "Last ned bruksrapport" on the Game page from *in review* onward (`GET /api/spill/[gameId]/rapport`, AD-17). Content-free counters only. |
| **Delete** (FR-3) | `button-secondary-danger` "Slett spillet" on the page → ConfirmDialog "Slette «{title}»? Spørsmål, lenker, svar, brett og poeng slettes for godt." Confirm "Slett for godt" as filled `button-danger` (the only place it appears). Afterwards: `/spill` with `notice-success` "«{title}» er slettet." |
| **Demo mode** (FR-31) | A thin `notice-info` band under the top bar on every Host page: "Demomodus: alt innhold er oppdiktet, og dommeren bruker lagrede avgjørelser." The login page shows the demo login and a button "Fyll inn demobrukeren"; login page and band read the demo credentials from one shared constant (AD-19). |

## Surface: Play view

`/spill/[id]/skjerm`. **Team setup** first, on a light Host page: "Hvem spiller?", two TextFields prefilled "Lag 1" and "Lag 2", "Legg til lag" up to four, "Fjern" down to two (FR-23); names 1–14 characters (AD-16; 14 so four Teams fit the Team column at 48 px, with each Score beside its name), over-long: "Navnet kan ha maks 14 tegn.". "Start spillet" switches to the play view, with the hint "Trykk F for fullskjerm."

### Wireframe — play view, 1920×1080, Question 3, two Groups revealed, Team 1's turn

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│  Hva sier Jonas til dørvakten som aldri funker?          (56 px)         │  Spørsmål 3 av 9      │
│                                                                          │ ┌───────────────────┐ │
│  ┌────────────────────────────────────────────────────────────────────┐  │ │ Svarer nå    48px │ │
│  │ 1   Jeg kjenner eieren                                    [  6  ]  │  │ Hyttegjengen 48px │ │
│  └────────────────────────────────────────────────────────────────────┘  │ │ 23           80px │ │
│  ┌────────────────────────────────────────────────────────────────────┐  │ └───────────────────┘ │
│  │ 2                                                                  │  │                       │
│  └────────────────────────────────────────────────────────────────────┘  │   Lag 2               │
│  ┌────────────────────────────────────────────────────────────────────┐  │   14                  │
│  │ 3   Jeg er bare her for å hente noen                      [  3  ]  │  │                       │
│  └────────────────────────────────────────────────────────────────────┘  │                       │
│  ┌────────────────────────────────────────────────────────────────────┐  │                       │
│  │ 4                                                                  │  │                       │
│  └────────────────────────────────────────────────────────────────────┘  │                       │
│  ┌────────────────────────────────────────────────────────────────────┐  │                       │
│  │ 5                                                                  │  │                       │
│  └────────────────────────────────────────────────────────────────────┘  │                       │
│                                                                          │                       │
├──────────────────────────────────────────────────────────────────────────┴───────────────────────┤
│  Bom [M]    Angre [Z]    Neste lag [T]    Vis resten uten poeng [U]    Neste spørsmål [N]   ? (24px)│
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Play view rules

- **Canvas:** a fixed 1920×1080 layout scaled to fit the window (CSS `transform: scale()` from the window size), so the 48 px minimum (FR-24) holds on the TV whatever the laptop resolution. Background `{colors.stage}`.
- **Team column:** "Spørsmål N av M" at the top in `{typography.tv-team}` `stage-muted`, then the Teams. The active Team is a mint-filled card (`{components.team-score-active}`) with "Svarer nå" at 48 px above the name. Each Score sits to the right: beside the name, and on the active card beside "Svarer nå". Team names are 1–14 characters.
- **Labels never truncate:** a revealed label that does not fit one line wraps to two (line-height 1.05) and the row grows to 112 px. Question text is 56 px up to 80 characters, 48 px above that, budgeted at four lines.
- **Never shown:** raw Answers, discarded Groups, Groups below the Board limit, Contributor data (FR-24). The view reads only the confirmed Board.
- **Hidden tiles** show only their rank, so the number of rows shows how many Groups there are (FR-24). Each tile is a `<button>`: **click = scored Reveal for the current Team** (FR-25). From the click until the server acknowledges, the tile border is `{components.board-tile-pending}` (`stage-ink`). A revealed tile is no longer a button; clicking it does nothing (the refusal in FR-25 is enforced server-side too).
- **Scored Reveal** (CSS transitions only, no dependency, starting after the server acknowledges; about 700 ms in all): t = 0 tile fill `stage-tile` → `stage-ink` (180 ms); t = 120 ms label fades in with a 12 px slide (220 ms); t = 300 ms Count badge fades in, scaling 0.9 → 1 (160 ms); t = 460 ms the active Team's Score counts up over 400 ms with digits in `stage-accent`, returning to `stage-ink` at the end. With `prefers-reduced-motion` all of it is instant and the colour change is kept. Announced: "«Jeg kjenner eieren», 6 poeng til Hyttegjengen."
- **Bom [M]:** shows the word "Bom" centred over the list in `{typography.tv-score}` 80 px `stage-ink`, on a `stage-raised` panel with a 2 px `stage-line` border and padding 24 / 64 px; 150 ms in, 1.2 s hold, 150 ms out. No icon, no sound, no state change, not undoable (FR-26 covers Reveals only). The turn does not pass by itself.
- **Angre [Z]:** undoes the most recent Reveal on the current Question, scored or unscored (FR-26); hidden when there is none. Announced: "Angret. «Jeg kjenner eieren» er skjult igjen, 6 poeng trukket fra Hyttegjengen."
- **Neste lag [T]:** moves the "Svarer nå" card to the next Team in order, wrapping (FR-27).
- **Vis resten uten poeng [U]:** a toggle (`aria-pressed`). While on, the control-bar item reads "Avslører uten poeng [U]" in `stage-ink` weight 700, the hidden tiles switch to `2px dashed {colors.stage-line}` (the unscored look, previewed), and tile clicks make unscored Reveals (`board-tile-unscored`, "uten poeng"). It switches off on the next Question.
- **Neste spørsmål [N or →]:** moves on (FR-27); unrevealed Groups stay hidden. On the last Question the label is "Vis sluttstilling".
- **Shortcuts:** `1`–`8` click the tile with that rank; `F` toggles fullscreen; `?` opens a shortcut overlay; `Esc` closes it or leaves fullscreen.
- **Final Scores** (FR-27): heading "Sluttstilling", Teams sorted by Score, centred vertically, each Score in `{typography.tv-score-final}` 120 px; the winner takes the `team-score-active` look with "Vinner" replacing "Svarer nå" (ties: "Uavgjort" on every tied Team). One 24 px line for the Host: "Spillet slettes automatisk {dato}." and a link "Tilbake til spillet".
- **Persistence:** every action is saved before the screen changes, so a reload restores Question, Team, Reveals and Scores (FR-27).
- **Stage 2 room:** the control bar's right end is reserved for the FR-33 source credit, so it can arrive without a layout change.

## Voice and Tone

Microcopy only; brand posture is in `DESIGN.md` → Brand & Style. Norwegian bokmål, "du" form, short complete sentences. Errors say what happened, then what to do. No exclamation marks on Host and Participant pages, no emoji, no blame.

| Do | Don't |
|---|---|
| "Svarene dine er lagret." | "Suksess! Svarene ble sendt inn 🎉" |
| "Skriv minst ett svar." | "Feltet er påkrevd." |
| "Du trenger minst 3 innsendte svar før du kan stenge. Det beskytter anonymiteten." | "Kan ikke stenge (min. 3)." |
| "Vi finner ikke denne lenken. Be den som sendte deg den om en ny." | "Ugyldig token." / "Lenken er trukket tilbake." |
| "Bom" | "Feil!" or a red X |
| "Dommeren grupperer svarene …" | "KI-en jobber med magien sin …" |

**Term map** (Glossary → interface word). Use these and no synonyms:

| Glossary | UI word | Glossary | UI word |
|---|---|---|---|
| Host | verten (third person) / du | Grouping | gruppering |
| Participant | deltaker | Group | gruppe |
| Game | spill | Count | "N personer" (Review), the number on the tile (play) |
| Question | spørsmål | Review | gjennomgang |
| Invite link | lenke (invitasjonslenke in headings) | Board | brett |
| Answer | svar | Team | lag |
| Answer set | never shown; "svarene dine" to the Participant | Reveal | avsløre |
| Collection | innsamling | Score | poeng |
| Judge | dommeren | Demo mode | demomodus |

## Component Patterns

Behavioral rules; the visual spec is `DESIGN.md` → Components.

| Component | Use | Behavioral rules |
|---|---|---|
| **Button** | Everywhere | Native `<button>`. When an action is not yet allowed, use `aria-disabled="true"` plus a visible reason (focusable, so screen readers find the reason) rather than `disabled`. While pending: in-progress verb, `aria-busy`, ignores repeat clicks. |
| **TextField** | All text input | Always a visible `<label>`. Helper and error text tied with `aria-describedby`; `aria-invalid` on error. Validates on submit or blur, never per keystroke. Counter is announced only at the limit ("80 av 80 tegn"). |
| **AnswerFieldset** | Answer form | `<fieldset>` + `<legend>` ("Spørsmål N av M: {text}"). "Legg til svar" moves focus to the new field; "Fjern" moves focus to the previous field. Error state: `aria-invalid` on the first field, error text first inside the fieldset. |
| **Notice** | Info, success, warning, error banners | `role="status"` for info and success, `role="alert"` only for errors raised by a user action. Never auto-dismisses. The error summary variant contains in-page links that move focus to the fieldset. |
| **StatusBadge** | Game list, Game page | Text is the state word; never interactive. |
| **ProgressCount** | Game page, *collecting* | Shows "færre enn 3" below three Answer sets (FR-8). Updates silently, with no live announcement and no animation, so a change cannot be timed against a message sent. |
| **OnceLinkList** | After creating or replacing Invite links | "Kopier" uses the Clipboard API; the label changes to "Kopiert" for 2 s and a live region says "Lenke kopiert." If clipboard access fails, the link text is selected and the message reads "Marker og kopier lenken selv." Links are never re-fetched. |
| **ConfirmDialog** | Irreversible or anonymity-relevant actions only: open Collection, revoke, close Collection, confirm Board, delete Game | Native `<dialog>` with `showModal()`. Focus starts on the **cancel** button; Esc cancels; focus returns to the trigger. One level deep, never stacked. |
| **GroupCard** | Review | Checkbox label: "Velg gruppen «{label}», N personer". Overflow menu is a disclosure button listing "Gi nytt navn" and "Forkast fra brettet". Clicking the label starts rename. |
| **AnswerChip** | Review | A checkbox with the Answer text as its label ("· N svar" included). Selecting chips clears any Group selection, and vice versa. |
| **SelectionBar** | Review | Visible only with a selection. Content by selection: ≥2 Groups → "Slå sammen N grupper"; 1 Group → hint "Velg minst to grupper for å slå sammen."; ≥1 Answer → "Flytt til gruppe" (native `<select>` + "Flytt") and "Ny gruppe". "Fjern valg" or Esc clears. Selection clears when the Question changes. |
| **BoardTile** | Play view | Hidden: `<button>` named "Avslør plass N". Revealed: static text. Unscored: static, with "uten poeng" in its accessible name. |
| **TeamScore** | Play view, final Scores | The active Team is marked with the words "Svarer nå" ("Vinner" on the final Scores), not only the mint fill. Score changes count up over 400 ms (instant with reduced motion). |

## State Patterns

Every surface has its loading, empty and error states defined here. Loading states appear only after 300 ms, so fast responses do not flash.

| Surface | Loading | Empty | Error / edge |
|---|---|---|---|
| Landing | Static | — | — |
| Register / log in | Button "Logger inn …" | — | "Feil e-post eller passord." · "Passordet må ha minst 10 tegn." · "Det finnes allerede en konto med denne e-posten." · Network: "Fikk ikke kontakt. Sjekk nettet og prøv igjen." |
| Game list | Three skeleton rows | "Du har ingen spill ennå. Gi det første et navn over, for eksempel «Hyttetur 2026»." | Title empty or >80: "Navnet må ha 1–80 tegn." · Load failure: `notice-danger` "Fikk ikke hentet spillene dine. Last inn siden på nytt." |
| Game page, any | Skeleton header + panel | — | Unknown Game **or another Host's Game**: one page, "Vi finner ikke dette spillet." + link to Mine spill (FR-1) · Expired session → log-in redirect |
| — *draft* | — | No Questions: "Ingen spørsmål ennå. Skriv det første, gjerne om noen dere kjenner, for eksempel «Hva gjør Jonas når han har forsovet seg?»" | Autosave failure inline per Question · 20 reached: "Du har nådd maks 20 spørsmål." |
| — *collecting* | — | 0 Answer sets: ProgressCount "færre enn 3 av N svar mottatt" (never 0) | Close below three: reason text (FR-10) · 50 links reached: "Spillet har nådd maks 50 lenker." · Bad pasted link (revoke) |
| — *grouping* | Status panel (this *is* the loading state) | — | Judge failures do not show here; they surface as the fallback Notice in Review (FR-17) · Grouping slow or interrupted: `notice-warning` "**Grupperingen tar lengre tid enn vanlig.** Siden oppdateres av seg selv. Stopper grupperingen, fortsetter den der den slapp." (AD-12 resumes the Judge after the lease and the 3 s poll triggers it, so the Host is not told to reload; no manual grouping is offered here) |
| — *ready* / *playing* / *played* | — | — | — |
| Review | Skeleton rail + three skeleton cards | No empty state exists by construction (≥3 Answer sets, each answering every Question). A Question with *Ikke på brettet* or *Forkastet* empty omits that section | Operation failure, shown where the Host is looking: selection operations (merge, move, new Group) inside the SelectionBar above its actions (`danger-soft` fill, `danger` text), selection kept; card operations (rename, discard, undo discard) inline at the top of the affected GroupCard; mark reviewed under its button. Same sentence everywhere, "Endringen ble ikke lagret. Prøv igjen."; screen otherwise unchanged · Board already confirmed (other tab): "Brettet er allerede låst." + link to the Game page · Game not in *in review*: redirect to Game page |
| Team setup | — | — | Fewer than two Teams impossible (no Fjern below two) · Empty name: "Laget trenger et navn." · Game not *ready* (or *playing*, which resumes): redirect |
| Play view | Stage background, "Henter spillet …" in `tv-team` | All Groups revealed: control bar hint "Alle svarene er avslørt." and "Neste spørsmål" emphasised | Save failure: banner in place of the control-bar row (`{components.control-bar-error}`, 64 px, `stage-ink`, weight 700), never over the list, "Fikk ikke lagret trekket. Prøv igjen." State unchanged; no red · Lost connection: same banner with "Mistet forbindelsen." |
| Final Scores | — | — | — |
| Answer form | Generic server shell, then the client loads through `openInviteLink`; slow network: "Henter spørsmålene …" | — (a Game with zero Questions cannot have Invite links, FR-5) | Missing Answers: error summary + inline (FR-6) · Over 80: "Svaret kan ha maks 80 tegn." · Network: "Fikk ikke sendt svarene. Sjekk nettet og prøv igjen. Utkastet ditt ligger fortsatt på denne enheten." · Closed during editing: "Innsamlingen ble stengt før svarene dine kom fram, så de ble ikke lagret." (FR-10) |
| Answer form — closed | — | — | Also shown for a revoked link once Collection has closed (the Game state is checked first). Page: "Innsamlingen er stengt." + "Verten har stengt innsamlingen, så svar kan ikke lenger sendes inn eller endres." No form (FR-10, UJ-2) |
| Answer form — unknown link | — | — | One page for malformed, revoked, deleted and never-existing links: "Vi finner ikke denne lenken." + "Den kan være skrevet feil eller ikke lenger gyldig. Be den som sendte deg den om en ny." (FR-3, FR-9) |
| Any Host action | — | — | Stale view after another tab changed the state (`NOT_FOUND`, `ALREADY_REVEALED`, `WRONG_QUESTION`): refresh the view from the server instead of retrying; the saved state is shown |
| Any page | — | — | 404: "Siden finnes ikke." · 500: "Noe gikk galt hos oss. Prøv igjen om litt." Both keep the top bar (Host) or the wordmark only (Participant) |

## Interaction Primitives

- **Click, tap, keyboard.** No drag-and-drop anywhere (reordering Questions uses buttons; moving Answers uses selection). No hover-only affordances; the GroupCard menu is always visible.
- **Saving:** Question editor autosaves on blur; every other change is an explicit action confirmed by the server before the screen updates, with pending state on the affected element. No optimistic updates, so there is no rollback to design.
- **Confirmation** only for the five actions listed under ConfirmDialog. Discard, rename, merge and move are not confirmed, because they are reversible.
- **Focus management:** after route change, focus goes to the page `<h1>`; after Review operations, to the affected Group heading; after dialogs, back to the trigger.
- **Live regions:** one polite region per page announces the results listed in the Review operations table and the play view rules.
- **Keyboard shortcuts:** only in the play view (`1`–`8`, `M`, `Z`, `T`, `U`, `N`/`→`, `F`, `?`, `Esc`), shown in the control bar and the `?` overlay, ignored while focus is in a text field. Review uses Tab, Space, Enter and Esc only.
- **Motion:** CSS only, no animation library. Reveal = the staged sequence in the play view rules (about 700 ms); Score counts up over 400 ms; "Bom" fades in and out (150 ms in, 1.2 s hold, 150 ms out). No tile flips. `prefers-reduced-motion: reduce` makes all of it instant.
- **Sound:** none in Stage 1.
- **Banned:** sticky bottom bars on the phone form, infinite scroll, toasts that disappear, modals on top of modals, autoplay sound, anything that shows which Invite link has answered.

## Accessibility Floor

Behavioral rules; contrast pairs are verified in `DESIGN.md` → Colors.

- **WCAG 2.1 AA** on all three surfaces (NFR-6). The answer form is fully usable by keyboard and screen reader (VoiceOver on iOS, TalkBack on Android, NVDA on Windows).
- **Structure:** one `<h1>` per page; landmarks (`header`, `main`, `nav` on Host pages); skip link "Hopp til innhold" on Host pages; `lang="nb"`.
- **Forms:** every input has a visible `<label>`; Question groups are `<fieldset>`/`<legend>`; errors are linked with `aria-describedby`, marked `aria-invalid`, and gathered in an error summary that receives focus.
- **Focus:** visible ring `{components.focus}` on light surfaces; on ink surfaces (the SelectionBar) and on the stage use `{components.focus-inverse}`; never removed. Tab order follows reading order; in Review: rail, then main pane top to bottom, then SelectionBar.
- **Not color alone:** reviewed, fallback, discarded, active Team and unscored tiles all carry words.
- **Targets:** at least 44×44 px (`{spacing.control-min}`).
- **Reflow and zoom:** the answer form works at 320 CSS px and at 200 % text zoom without horizontal scrolling. Host pages work at 200 % zoom on a 1280 px screen (the Review rail collapses as described in Responsive & Platform).
- **Images:** the product uses no content images. Decorative icons are `aria-hidden`; icon-only buttons have an `aria-label`.
- **Time:** nothing times out on the Participant; the "Bom" panel and "Kopiert" label are the only timed text, and both are also announced.

**Manual checklist** (committed with the code, per SM-1, for what tests cannot automate):

| # | Check | Covers |
|---|---|---|
| A1 | Play view on a 1920×1080 window: question, labels, Counts, Team names and Scores measure ≥ 48 px in dev tools; readable from 3 m on a real TV | FR-24 |
| A2 | Complete the answer form with keyboard only (Tab, Shift+Tab, Enter, Space), including the error summary links | NFR-6 |
| A3 | Complete the answer form with VoiceOver (iOS) or TalkBack: notice, legends, labels, errors and confirmation are read | NFR-6, FR-14 |
| A4 | Answer form at 360 px and 320 px, and at 200 % zoom: no horizontal scroll, keyboard never hides the focused field | NFR-4, NFR-6 |
| A5 | Run axe (or Lighthouse accessibility) on landing, log in, Game list, Game page in each state, Review, play view, answer form, closed and unknown pages: no serious or critical findings | NFR-6 |
| A6 | Review end to end with keyboard only: merge, move, new Group, rename, discard, undo discard, mark, confirm | NFR-6, FR-20, FR-21 |
| A8 | Play view, 200-character Question + 8 Groups, and four 14-character Team names of wide letters (e.g. "WWWW…"): everything fits 1080 px with the control bar and every Score visible | FR-24 |
| A9 | Play view, a 40-character label of wide letters (e.g. "MMMM…Ø") shows in full, wrapped if needed, never truncated | FR-24 |
| A10 | Review, keyboard only: the focus ring is visible on every SelectionBar control | NFR-6 |
| A7 | Play view: no raw Answer, discarded Group or below-limit Group is visible at any point of a full round | FR-24 |

## Responsive & Platform

| Surface | Target | Behavior across sizes |
|---|---|---|
| Answer form | 360 px phone, current mobile Safari and Chrome (NFR-4) | One column always; content max 560 px centred on tablets and laptops. |
| Host pages | Laptop, ≥1280 px | Usable down to 1024 px. Review below 1280: rail narrows to 240 px. Below 1024: the rail becomes a `<select>` "Spørsmål 3 av 9 – Ikke gjennomgått" above the main pane, with "Lås brettet" at the bottom of the page. Below 768: Review shows `notice-info` "Gjennomgangen er laget for større skjerm. Den virker her, men blir trang." |
| Play view | 1920×1080 TV or projector, mirrored from the laptop | Fixed canvas scaled to the window; letterboxed on other aspect ratios. On a laptop screen alone it is simply smaller. Mirroring means the room sees the control bar, which is why it is quiet. |

## Anonymity in the Interface

Interface rules that carry PRD §4.4 and §6.1. These are acceptance rules, not preferences.

1. No Participant page shows or asks for a name, email, account, avatar or login (FR-1, FR-6, FR-11).
2. The Host never sees per-Invite-link state: not used/unused, not timestamps, not order. Only the ProgressCount, with "færre enn 3" below three (FR-8, FR-12).
3. Invite links are shown once and never again (FR-5, FR-9).
4. No Answer text appears anywhere on Host pages before Collection closes (FR-12).
5. Review shows Answers grouped by Group only, sorted alphabetically, never by Answer set, Contributor key, rank or arrival (FR-12, FR-13).
6. Unknown and revoked Invite links look identical (FR-9); revoke always shows the same warning (FR-9).
7. The product never nudges the Host to chase specific people (§6.1): no reminders, no "who hasn't answered".
8. Unsent drafts stay on the Participant's device (§10 item 5 above).

## Inspiration & Anti-patterns

- **Lifted from GOV.UK Design System:** the error summary that takes focus and links to each failing field; validation on submit, not while typing; "one primary action per page".
- **Lifted from the origin party's paper process:** the Host reads raw Answers and decides; the screen is a tidier version of that table, not a dashboard.
- **Rejected — the television game show's trappings** (PRD §6.3): oval board, gold flipping panels, red X strikes, buzzers, "the survey says". See `DESIGN.md` → Brand & Style.
- **Rejected — the source form's signed-in account indicator above a promise of anonymity** (addendum): the reason for rule 1 of Anonymity in the Interface.
- **Rejected — Kahoot-style timers, podiums and player names on phones:** play happens off one screen, and the Participants' phones are done once they submit.
- **Rejected — a confidence percentage per Group:** FR-19 rules it out for Stage 1, and the raw Answers are the stronger signal.

## Key Flows

Protagonists are the PRD's invented personas (§2.3); journey names are verbatim.

### UJ-1. Maren builds a Game for her friend group's cabin weekend.

1. Maren registers at `/registrer` on her laptop and lands on an empty "Mine spill": "Du har ingen spill ennå."
2. She types "Hyttetur 2026" and clicks "Lag spill". The Game page opens in *draft* with the empty Question editor.
3. She writes nine Questions; each shows "Lagret" when she tabs on.
4. She sets "Antall lenker" to 11 and clicks "Lag lenker". The ConfirmDialog warns that the Questions lock; she confirms.
5. The OnceLinkList shows eleven links. She uses "Kopier" on each and pastes them into private messages, then clicks "Jeg har kopiert lenkene".
6. Over the week the ProgressCount reads "færre enn 3 av 11", then "4 av 11", then "10 av 11".
7. **Climax:** on Friday she clicks "Steng innsamlingen", confirms, watches "Dommeren grupperer svarene …", and a minute later the StatusBadge reads *Til gjennomgang* with "Gå til gjennomgangen".

Failure path: one friend has lost his link. Maren pastes the old link into "Erstatt en tapt lenke", reads that anything sent through it will be deleted, confirms, and copies the single new link from the OnceLinkList.

### UJ-2. Jonas answers on the bus and adds a better Answer the next day.

1. Jonas taps the link in a messaging app. The answer form opens: wordmark, "Hyttetur 2026", the two-sentence anonymity notice.
2. He fills "Svar 1" and "Svar 2" for each Question. The bus goes into a tunnel and the tab reloads; his text is still there, because the draft lives on the phone.
3. He clicks "Send inn svar". One Question was empty: the error summary takes focus and links him straight to it. He fills it in and submits again.
4. **Climax:** "Svarene dine er lagret. Du kan endre dem på denne enheten og i denne nettleseren helt til verten stenger innsamlingen." Nothing on the screen names him.
5. The next morning he opens the same link on the same phone: the form is pre-filled, with "Du har allerede sendt inn." He taps "Legg til svar" on one Question, adds a third Answer and taps "Lagre endringer".
6. After Maren closes Collection, the link shows "Innsamlingen er stengt."

Failure path: had Maren revoked his link, it would show "Vi finner ikke denne lenken.", identical to a mistyped link.

### UJ-3. Maren fixes the Board before the cabin weekend.

1. Maren opens Review. The fallback Notice says the Judge timed out on Questions 4 and 7; the rail marks them "Manuell".
2. On Question 1 she reads the chips under each Group, ticks the Groups "sov over seg" and "forsov seg" and clicks "Slå sammen 2 grupper". The merged Group moves to rank 1 with its Count recomputed, and focus lands on it.
3. On Question 3 she ticks the chip "snakker med dørvakten" inside "snakker med fremmede" and clicks "Ny gruppe"; the rename field opens and she presses Enter to keep the default label.
4. She renames a long label so it reads well on a TV ("12/40"), and discards a Group she does not want on a shared screen; it moves to *Forkastet*.
5. She clicks "Marker som gjennomgått" and Review moves to the next unreviewed Question.
6. On Questions 4 and 7 she merges the one-Answer Groups by hand.
7. **Climax:** the rail reads "9 av 9 gjennomgått", "Lås brettet" becomes active, and she confirms in the dialog. The Game page says "Brettet er låst. 9 spørsmål er klare."

Failure path: a merge request fails. "Endringen ble ikke lagret. Prøv igjen." appears inside the SelectionBar, the Groups are unchanged, and the selection stays so she can retry at once.

### UJ-4. The cabin plays from the TV.

1. Maren connects her laptop to the cabin TV, clicks "Start spillet", names the Teams "Hyttegjengen" and "Lag 2", and presses F for fullscreen.
2. Question 1 appears with five numbered hidden tiles; the "Svarer nå" card marks Hyttegjengen.
3. The Team shouts a Guess. Maren clicks tile 1 (or presses `1`).
4. **Climax:** the label "Jeg kjenner eieren" and the Count 6 appear, and Hyttegjengen's Score counts up from 17 to 23.
5. The next Guess misses: she presses `M`, "Bom" shows for a moment, and she presses `T` to pass the turn.
6. When the Question is done she presses `U` and reveals the rest without points, then `N` for the next Question.
7. After Question 9, "Vis sluttstilling" shows both Teams' final Scores with "Vinner" on the top Team.

Failure path: Maren clicks tile 3 when the Team said tile 2's answer. She presses `Z`; tile 3 hides again and its Count is subtracted. She clicks tile 2.

### UJ-5. Siri, the examiner, runs the project without the group's keys.

1. Siri starts Demo mode with the README's single command and opens `/logg-inn`. A Notice shows the demo login; she clicks "Fyll inn demobrukeren" and logs in.
2. The Demo mode band explains that all content is invented and the Judge uses stored decisions.
3. "Mine spill" lists the demo Game in *Samler inn*, with "K av N svar mottatt".
4. She clicks "Steng innsamlingen" and confirms.
5. **Climax:** without any model call, the Game reaches *Til gjennomgang* with Judge-proposed Groups from Stored rulings, and Review opens with no fallback Notice.
6. She merges, renames, marks every Question reviewed, locks the Board and plays a round to "Sluttstilling".

Failure path: if the stored rulings were missing for a Question, that Question would show as "Manuell" with the fallback Notice; the flow still completes (FR-30).

*UJ-6 (Stage 2) is out of scope for this spine; the play view reserves room for its source credit.*

## Open Questions

1. **Visual direction.** The palette (berry, forest stage, mint) and the display face (Bricolage Grotesque) were chosen in a headless run. They meet every constraint, but the group should confirm or swap them before implementation. Swapping is cheap while tokens are only names in a Tailwind theme. The 2026-11-21 impeccable critique noted Bricolage Grotesque as a common display face and suggested showing a second option; the font is kept and the note acknowledged.
2. **A Question with no Group on the Board.** Decided: marking it reviewed is blocked, as AD-15 `NO_GROUPS_ON_BOARD` (the UX memlog resolved it the same way). The PRD is silent.
3. **Host preview of the answer form.** Not in the PRD. Today a Host cannot see the form without creating an Invite link, which opens Collection and locks the Questions. A read-only preview in *draft* would reuse the AnswerFieldset with no submit and would help SM-6 (Host autonomy). Stage 1 nice-to-have or Stage 2?
4. **Extended display.** Stage 1 assumes the TV mirrors the laptop, so the room sees the control bar. A two-window mode (controls on the laptop, clean board on the TV) is a Stage 2 candidate.

## Notes for Architecture

- The Invite link's URL shape is architecture's choice. The UX needs the Game identifiable from the URL (FR-10 closed page) and benefits if the Token never reaches server logs (FR-11), e.g. by carrying it in the URL fragment and posting it in the request body.
- The browser keeps one `localStorage` key per link, `toppsvar:<gameId>:<first 16 chars of token>`, holding the draft and the edit secret. No hashing in the browser.
- Grouping progress per Question is optional; the UX degrades to an indeterminate status.
- Review and play actions must answer within one second (NFR-5), since the UI waits for the server before changing.
- Demo mode should expose the demo credentials to the log-in page.
