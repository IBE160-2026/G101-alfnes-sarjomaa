# Epic 5: Gjennomgang

Story 5.1–5.6: verten retter opp grupperingen før spillet. Gjennomgangsskjermen viser rangerte grupper med antall og råsvar, og verten kan slå sammen, flytte svar, gi nytt navn, forkaste og gjenopprette grupper, markere spørsmål som gjennomgått og låse brettet. Story 5.6 er ekstra og følger opp faglærers PRD-tilbakemelding i koden.

## Stories
| Story | Innhold | Review (funn: medium / lav / falske) |
|-------|---------|--------------------------------------|
| 5.1 | Gjennomgangsskjermen: spørsmålsliste, rangerte grupper med antall personer, brettstreken etter åtte grupper og råsvarene som brikker | 5 / 16 / 12 |
| 5.2 | Slå sammen grupper med valglinje. Hver endring fjerner «gjennomgått»-merket og teller i `edit_count` | 2 / 15 / 12 |
| 5.3 | Flytt valgte svar til en annen gruppe eller en ny gruppe. En ny gruppe får `origin = host`, så den aldri regnes som dommerens forslag (SM-5). En tømt gruppe slettes i samme transaksjon | 9 / 14 / 8 |
| 5.4 | Gi nytt navn, forkast og gjenopprett. Forkasting sletter aldri noe: gruppen havner under *Forkastet*, er frosset for andre endringer og kan aldri nå brettet | 10 / 11 / 13 |
| 5.5 | Marker som gjennomgått og lås brettet. Låsingen er én transaksjon: `board_slot` skrives med frosne antall, alle `contributor_key` og `rank` settes til NULL (FR-13), og spillet går til *ready* | 4 / 15 / 12 |
| 5.6 | Faglærers PRD-tilbakemelding: varselet i svarskjemaet sier at svar kan sendes til en KI-tjeneste, test mot prompt-injeksjon, test som skanner hele databasen etter svartekst etter sletting, og arkitektur og story 7.2 sier at F1 rapporteres uendret etter frysen | 9 / 17 / 6 |

Ingen story hadde høye funn. Hver spec har en review-seksjon med KI-forslag vi rettet eller avviste, og hvorfor.

## Faglærers PRD-tilbakemelding
Tilbakemeldingen (`tilbakemelding-prd.md`, 12. nov.) ble først lest 23. nov. PRD-en ble rettet på `main` med `bmad-correct-course` (`sprint-change-proposal-2026-11-23.md`). Denne PR-en tar resten: kode, tester, arkitektur og epics (story 5.6).

## Review av hele epicen
Rapportene ligger i `.docs/implementation-artifacts/reviews/epic-5-*.md`, med seksjonen «Epic 5 review fixes» nederst.
- **`bmad-code-review`** (fire lag): 0 høy, 1 medium og 7 lave, «approve with patches».
  - Medium: manuell tidtaking (NFR-5) fantes bare for sammenslåing og flytting. Lagt til for navn, forkasting, gjennomgått og låsing.
  - Lave, alle rettet: fokus i låsedialogen, Esc i låsedialogen tømte valget, store bokstaver i ID-er ga `INTERNAL` i stedet for `NOT_FOUND`, kutting av etiketter midt i en emoji, nummereringen under brettstreken, ventetilstand på gruppemenyen, og en testtittel.
  - Funnet i orden: alle sju handlinger låser spillet og sjekker eier og tilstand før de skriver, og låsingen leser antallene før nøklene slettes.
- **`ponytail-review`:** «Ship», uten «must». Tidsgrenser som gjentok de globale i Vitest er fjernet fra 15 filer, og fire kopier av samme avvisningstest er slettet.
- **`impeccable` audit** (17/20):
  - Valglinja dekket kort og tastaturfokus nederst i lista (funnet da skjermbildene til README ble tatt). Rettet med scroll-padding som følger linjas høyde.
  - Standardetiketter sto med liten forbokstav («ullsokker»). Nå vises den vanligste skrivemåten.
  - Fokusringen på lenken i feilmeldingen i valglinja hadde for lav kontrast.
  - To funn utenfor epicen («færre enn 3» som stort tall, og bredden på «Lag lenker») følger `DESIGN.md` og er ikke endret.
- **Ustabile tester:** to e2e-tester feilet én gang i CI på epic 3. Årsaken var at axe kjørte før Next 16 hadde strømmet inn `<title>` på nytt etter `router.refresh()`. Hjelperen venter nå på tittelen. Begge testene passerte 15 av 15 under last.

## Pilot
Arkitekturen er endret (AD-21, AD-24): piloten på https://toppsvar.vercel.app har åpen registrering, Neon Postgres i Frankfurt, og en OpenRouter-nøkkel med kredittgrense USD 0,10. En tom nøkkel gir fallback til manuell gruppering. Migrasjonene i denne PR-en kjøres mot Neon etter merge.

## Sjekker (lokalt, uten nett og uten nøkler)
Lint, format og typecheck er rene. `npm run test`: 675 passerer. `npm run test:e2e`: 91 passerer.

## Kjente begrensninger
- «Start spillet» kommer i story 6.1 (`shortcut:` på *ready*-siden).
- Manuelle sjekker som gjenstår: tastatur hele veien (A6), skjermleser på det nye varselet (A3) og tidtaking T1–T5.
- Låsing og `VACUUM` er bare testet på PGlite til CI-jobben mot Postgres kommer i story 7.3.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
