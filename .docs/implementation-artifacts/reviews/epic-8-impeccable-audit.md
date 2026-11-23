# Epic 8 impeccable audit (audit), Story 8.1

Branch `epic-8-trinn-2`, scope Story 8.1 (ready-made Question sets, FR-33), `git diff main...epic-8-trinn-2`. Mode: Operate. Contract: `DESIGN.md` and `EXPERIENCE.md` in `.docs/planning-artifacts/ux-designs/ux-Toppsvar-2026-11-21/`. The launcher was unavailable, so the bundled detector did not run. This is a source audit checked against fresh screenshots. The app was started with `npm run demo` in a separate worktree on the branch head, with no model key, so it ran on the seeded PGlite database and the replay judge. Playwright logged in with the demo login and drove the new flow: the create row on "Mine spill" (empty, keyboard focus, a failed submit with a set chosen), one Game from each of the five sets, the Game page in *ready*, *playing* and *played*, Team setup, the play view, and Final Scores. Host pages were captured at 1280×800 and 360 px. The play view was captured at 1920×1080, letterboxed at 1280×720 and 1280×800, with the control bar clipped in five states: start, keyboard focus, "Avslører uten poeng [U]" on, every tile revealed, the last Question ("Vis sluttstilling [N]") and the failure banner. Every one of the 25 Questions was played with all its tiles revealed at 1920×1080, and the Question and label line counts were measured on the live page. Two extra probes checked what the select shows after a failed submit and what a retry creates. The PNGs are kept outside the repo. File names are cited below.

Files in scope: `src/components/CreateGameForm.tsx` (the "Spørsmål" select), `src/app/spill/page.tsx`, `src/app/spill/actions.ts`, `src/app/spill/[id]/page.tsx` (report hidden for a set Game), `src/app/spill/[id]/skjerm/page.tsx`, `src/components/PlayView.tsx` and `src/components/Board.tsx` (the credit), `src/lib/question-sets.ts`, and the copy in `data/question-sets/protoqa-nb.json`.

## Scores

| Dimension | Score | Key finding |
|---|---|---|
| Accessibility | 3 | The select has a visible label, a 48 px target, a `line-strong` border at 3.96:1 and the house 3 px focus ring. After a failed submit it shows and announces "Jeg skriver egne" while the form still holds the chosen set (M1). |
| Performance | 4 | The client gets only `{id, name}` for five sets. The JSON and the zod schema stay on the server, and the credit is a string prop. |
| Theming | 4 | Only existing tokens: the select copies the TextField classes (`line-strong`, `surface`, `rounded-sm`, `min-h-12`), and the credit uses the bar's own `text-tv-control` and `stage-muted`. |
| Responsive | 4 | No horizontal scroll on any Host page at 360 px. The select goes full width under the title field. The control bar holds every item at 1920 px in its fullest state, and the stage scales cleanly to 1280×720. |
| Implementation integrity | 2 | The create path is minimal and contract-true, but a retry after a failed submit can silently make the wrong kind of Game (M1). |
| **Total** | **17/20** | Good. One must-fix before the PR. |

Verdict on integrity: pass with one defect. The feature adds one select, one server branch and one credit line. It adds no new page, no badge, no icon and no colour. A set Game goes straight to *ready*, Team setup and play work unchanged, and the credit sits at the control bar's right end, where `EXPERIENCE.md` (Play view rules, "Stage 2 room") reserved space for it. The one defect is in the form state, not the design: the select's visible value and the value React holds drift apart after a failed submit.

## Must

### M1. [P1] After a failed submit the select shows "Jeg skriver egne" while the set is still chosen, and a retry can create a Host-written Game (`src/components/CreateGameForm.tsx:21`, `:45`, `:69-72`)

Steps, measured on the demo server:

1. Choose "Hjemme", leave the title empty, press "Lag spill". The title gets its error, and the select now shows "Jeg skriver egne" (DOM value `""`), while the component state is still `hjemme` (`create-row-error-1280.png`, `create-row-after-failed-submit-1280.png`). The comment on line 19 says the chosen set survives a failed submit. It does not, as far as the Host can see.
2. Type in the title field. That re-render puts the select back on "Hjemme" without the Host touching it, and "Lag spill" creates a set Game (badge "Klar"). The value changes under the Host's hands.
3. Choose "Hjemme", type a valid title, and let the first request fail (the "Fikk ikke kontakt. Sjekk nettet og prøv igjen." Notice, `create-row-network-failure-1280.png`). The title survives and the select shows "Jeg skriver egne". Pressing "Lag spill" again, which is what the Notice asks for, creates a **draft** Game ("Utkast") with no Questions, though the Host chose a set (`create-retry-result-1280.png`).

The likely cause is React 19's automatic form reset after a `<form action>` runs. The controlled text input is restored afterwards. The controlled select is not, because its state did not change, so React has nothing to re-render until some other state changes. A screen reader also announces "Jeg skriver egne", so the programmatic value is wrong as well as the visible one (WCAG 4.1.2). The e2e test only checks the select on the happy path (`tests/e2e/question-sets.spec.ts:15-16`).

Fix: keep the DOM in step after each action result. For example, give the select a ref and add `useEffect(() => { if (setRef.current) setRef.current.value = questionSet; }, [state])`. Another option is to submit through `onSubmit` with `startTransition`, which skips the automatic reset. Extend the e2e test: choose a set, submit with an empty title, expect the select `toHaveValue(set id)`, then fill in the title, create the Game and expect "Klar". Check the network-failure retry once by hand, or in the test with `page.route` aborting the first POST.

## Should

### S1. [P2] A few Questions and labels read as translations (`data/question-sets/protoqa-nb.json`)

Overall the 25 Questions are natural bokmål in the "Nevn …" format, with no anglicisms in the Questions themselves, no AI tone, no exclamation marks and no US-only content. Every Question fits in one or two lines at 56 px, and every label fits on one line at 48 px. The longest label, "Dødsfall eller krise i familien" (31 characters), stays on one row on the 1920 canvas, so FR-24 holds at 3 m. The wordings below are the ones a Norwegian player would notice. They are worth fixing before the demo, because the stage puts them in front of the whole room. See the copy check below for the full list with suggestions.

- Line 475: "Nevn noe som kan få noen til å endre returflyet sitt." You change a ticket or a booking, not a flight, and "noe … noen" stumbles when read aloud.
- Line 912: "Nevn et kjæledyr folk har i bur, men ikke en fugl." The tacked-on "men ikke en fugl" reads like a direct translation of "other than a bird".
- Line 665: "Nevn noe som holder barn trygge." This is a calque of "keeps kids safe".
- Line 87: the label "Lager" can also be read as the verb ("lager"), or as the beer.
- Line 416: "En mobiltelefon" is the only label with an article.

## Nice

### N1. [P3] Two Game-page lines assume the Host-written path (`src/app/spill/[id]/page.tsx:230`, `:270`)

For a set Game, the *ready* page says "Brettet er låst" although the Host never locked anything (`game-ready-1280.png`). The *played* page says "Spillet og alle svarene slettes automatisk …" although a set Game has no answers (`game-played-360.png`). Neither is wrong enough to confuse anyone, and the spec's "Never" list rules out a per-set page. If the group touches these lines anyway, use "Brettet er klart" for a set Game (it reads well for both paths, so no branch is needed). The deletion line can say "Spillet slettes automatisk …", as Final Scores already does (`PlayView.tsx:142`).

### N2. [P3] The two-line credit block fills the 64 px bar edge to edge (`src/components/Board.tsx:378-384`)

The right-end block is 58 px tall in a 64 px bar. The credit's descenders sit 3 px above the bar's rounded bottom edge, and the hint line above it is 15 px higher than the controls' centre line (`stage-bar-fullest-1920.png`, `stage-bar-credit-1280x720.png`). Nothing clips and the bar does not scroll (`scrollHeight` 64 = `clientHeight`). The spec already records the two-line block as a decision, since one line does not fit the fullest bar at 1920 px. At 1280×720 the credit renders at 16 px in `stage-muted` on `stage-raised` (6.87:1), the same size as every control label, and it is legible. If the group wants it calmer, set the credit in `text-body-sm`-like 18 px on the canvas with `leading-none`. That frees about 8 px and lets the hint line sit on the controls' centre. This is polish only.

## Copy check (native-speaker read of the 25 Questions and labels)

Set names: "Hjemme", "Mat og drikke", "Jobb og reise", "Barn og oppvekst", "Blandet drops". All are short and idiomatic, and "Blandet drops" is a good touch. "Hjemme" is the only one that is not a noun pair. "Hus og hjem" would match the others, but this is optional.

The select copy works: the label "Spørsmål", the default "Jeg skriver egne", the group "Ferdige sett", and the error "Velg et sett fra lista." The credit "Spørsmål fra ProtoQA (CC BY 4.0), oversatt og tilpasset" reads naturally as a credit line.

Questions worth rewording:

| Line | Now | Suggested | Why |
|---|---|---|---|
| 475 | Nevn noe som kan få noen til å endre returflyet sitt. | Nevn en grunn til å endre returbilletten. | You change a ticket, not a flight. It also removes the "noe … noen" stumble. |
| 912 | Nevn et kjæledyr folk har i bur, men ikke en fugl. | Nevn et kjæledyr som bor i bur, og som ikke er en fugl. | The tacked-on "men ikke en fugl" is English word order. |
| 665 | Nevn noe som holder barn trygge. | Nevn noe som beskytter barn. | "holde trygg" is a calque of "keep safe". |
| 238 | Du kjøper melk, egg, sukker og fløte. Nevn noe du sannsynligvis skal lage. | … Nevn noe du trolig skal lage. | "Trolig" is how people say it out loud, and the line gets shorter. Optional. |
| 803 | Nevn noe folk husker lenge, selv når de blir gamle. | Nevn noe folk husker helt til de blir gamle. | "husker lenge" and "selv når de blir gamle" say the same thing. Optional. |

Labels worth rewording (the cluster and the Count stay the same, only the words change):

| Line | Now | Suggested | Why |
|---|---|---|---|
| 87 | Lager | Lagerrom | "Lager" reads as a verb or as beer when it stands alone. |
| 77 | Bar eller kino | Bar eller hjemmekino | Nobody turns a garage into a cinema. |
| 416 | En mobiltelefon | Mobiltelefon | It is the only label with an article. |
| 128 | TV og datamaskin | TV og PC | This matches "TV, PC eller mobil" and "TV, PC og mobil" in the same data. |
| 149 | Basseng eller vanntank | Basseng eller boblebad | A water tank is an Australian or US house item. A Norwegian player will not guess it. Check that the cluster allows it. |
| 735 | Løpe | Løpe inne | On its own, "Løpe" is not something parents forbid. |
| 766 | Kose seg og drive med sport | Slappe av og trene | The pair is clumsy. The suggestion keeps both halves. |
| 791 | Avtjene verneplikten | Førstegangstjeneste | This is the word people use today, and it is shorter. |
| 1059 | Papir eller konvolutt | Krølle papir | "Knuse papir" is not Norwegian. If the cluster is about crushing paper, say "krølle". |
| 622, 627 | Oppmerksom, Hyggelig person (beside "Blid og vennlig" and "Høflig") | Følger godt med, Hyggelig | Four labels on one Board mean "nice". Clearer wording makes it easier for the Host to decide which one a guess matches. |

Data quirks to know about, but not to fix in the copy, because the Board must equal the dataset (FR-33): "Papegøye" (line 936) and "Hund" on the caged-pet Board that excludes birds, "Studere likevel" on the "i stedet for å studere videre" Board, "Treningsklær og sko" in an athlete's fridge, and "Melon" as a vegetable. Players will laugh at these, which suits a party game.

No real names, no brands, no crude content and no exclamation marks appear anywhere in the file.

## Checks that passed

- **The select's label and markup:** a real `<label for>` gives the name "Spørsmål". The options are "Jeg skriver egne" and an `<optgroup label="Ferdige sett">` with the five sets in data order. `aria-invalid` and `aria-describedby` with a "Feil: " prefix are set only when the field has an error, as in TextField (`create-row-1280.png`).
- **House look and alignment:** the select is 48 px tall like the title input, with the same 1 px `line-strong` border (3.96:1 on `surface`, above the 3:1 needed for UI), 6 px radius, 16 px text and 12 px padding. At 1280 px the title field, the 224 px select and "Lag spill" sit on one row, with the button 1 px lower, as before. At 360 px they stack full width with no horizontal scroll (`create-row-360.png`).
- **Focus:** Tab from the title goes to the select. It shows the 3 px `ink` ring with a 2 px offset (`create-row-select-focus-1280.png`). After a failed submit, focus goes to the invalid title field, as `useFormAction` does for every form.
- **One primary action per state:** "Lag spill" on "Mine spill", "Start spillet" on the *ready* Game page, "Fortsett spillet" while *playing*, "Vis sluttstilling" when *played* (`game-ready-*.png`, `game-playing-*.png`, `game-played-*.png`). The usage-report link is hidden for a set Game, as the spec decided.
- **Team setup:** unchanged and correct for a set Game at 1280 and 360 px (`team-setup-*.png`).
- **Credit placement and contrast:** the credit is on the play view only, at the control bar's right end, in `text-tv-control` 24 px `stage-muted` on `stage-raised`, 6.87:1 (`stage-q1-start-1920.png`, `stage-bar-credit-1920.png`). It is absent from Host-written Games, Team setup and Final Scores, as the spec decided (`stage-final-1920.png`). It is hidden under the failure banner, also as decided (`stage-bar-failure-1920.png`).
- **The fullest control bar fits:** with "Angre [Z]", "Avslører uten poeng [U]", "Alle svarene er avslørt.", "Trykk F for fullskjerm." and the credit all showing, the bar is exactly 1792×64 with no overflow (`stage-bar-fullest-1920.png`). The same holds on the last Question with "Vis sluttstilling [N]" (`set0-last-question-bar-1920.png`).
- **FR-24 at 3 m:** all 25 Questions at 56 px, one or two lines. All labels at 48 px, one line each, with no row grown to 112 px. The worst cases are the 75-character Question "Du kjøper melk, egg, sukker og fløte. …" (`set2-q-0-1920.png`) and the 8-row Board "Nevn en luksus …" (`stage-q1-all-revealed-1920.png`). Letterboxed at 1280×720 the canvas scales by 0.667, and labels render at 32 px, the same as every Host-written Game (`stage-q1-all-revealed-1280x720.png`, `stage-q1-1280x800.png`).
- **Keyboard on the stage:** the credit is plain text and adds no tab stops. The Tab order through the bar is unchanged (`stage-bar-focus-1920.png`).
- **Reduced motion:** Story 8.1 adds no motion. Revealing with `prefers-reduced-motion` behaves as in Epic 6.
- **No new tokens or arbitrary values** beyond the `px-2.75` error padding that TextField already uses.

## Recommended order

1. M1: keep the select's DOM value in step with its state after a failed submit, and add the e2e step that proves it.
2. S1: the five Question and label rewordings at lines 475, 912, 665, 87 and 416, then the optional rows in the copy check.
3. N1 and N2 if time allows.
