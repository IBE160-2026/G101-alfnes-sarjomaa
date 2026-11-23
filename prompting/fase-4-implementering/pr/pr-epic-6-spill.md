# Epic 6: Spill

Story 6.1–6.5: gjengen spiller fra én delt skjerm. Verten navngir to til fire lag og starter spillet. Brettet vises på en 1920×1080-flate som skaleres til TV-en, verten avslører svar med poeng, uten poeng, markerer bom, angrer og bytter lag, og går videre til neste spørsmål og sluttstillingen. Story 6.5 spiller en hel runde uten modellnøkkel fra registrering til sluttstilling.

## Stories
| Story | Innhold | Review (funn: medium / lav / falske) |
|-------|---------|--------------------------------------|
| 6.1 | Navngi lagene og start spillet. Laget og spilltilstanden lagres i én transaksjon, og spillet går fra *ready* til *playing* | 1 / 22 / 14 |
| 6.2 | Brettet på storskjermen og avsløringer med poeng. Spillet leser bare det låste brettet (`board_slot`), og en skjult plass sender aldri etikett eller antall til nettleseren. Poengene er en SQL-sum | 2 / 32 / 11 |
| 6.3 | Bom, angre, neste lag og avsløring uten poeng, med hurtigtaster og en oversikt over dem | 2 / 26 / 10 |
| 6.4 | Neste spørsmål, sluttstilling og det ferdigspilte spillet. «Neste spørsmål» sender med hvilket spørsmål skjermen viser, så et dobbelttrykk eller en gammel fane aldri hopper over et spørsmål | 0 / 15 / 10 |
| 6.5 | Ende-til-ende-test av en hel runde uten modellnøkkel, med axe og sjekk av serverloggen for tokener og svartekst. Passerte 5 av 5 på rad | 3 / 16 / 5 |

Ingen story hadde høye funn. Hver spec har en review-seksjon med KI-forslag vi rettet eller avviste, og hvorfor.

## Review av hele epicen
Rapportene ligger i `.docs/implementation-artifacts/reviews/epic-6-*.md`, med seksjonen «Epic 6 review fixes» nederst.
- **`bmad-code-review`** (fire lag): 0 høy, 1 medium og 1 lav, «approve with patches».
  - Medium: angre fra en gammel fane slettet en avsløring fanen ikke viste, og poengene forsvant fra laget. Nå sender fanen hvilken avsløring den angrer, og serveren avviser hvis den ikke er den siste. Testet for samme spørsmål og for en fane som står på et tidligere spørsmål.
  - Lav: to av feilkodene fra gamle faner manglet test. `WRONG_STATE` har nå en e2e-test.
  - Sluttstilling med ett tastetrykk og uten bekreftelse ble vurdert på nytt og beholdt: PRD-en og AD-4 gir *played* ingen vei tilbake, og et feiltrykk koster ingen poeng. Logget i `wiki/prosjekt/beslutninger.md`.
- **`ponytail-review`:** «Ship», uten «must». Poenglista på spillsiden er én funksjon, en enhetstestfil som gjentok integrasjonstestene er slettet, og tastaturkontrollen og avslørte plasser er slått sammen.
- **`impeccable` audit** (16/20, med ekte skjermbilder i 1920×1080, 1280×720 og 1024×768):
  - Must: en etikett på 40 tegn uten mellomrom rant ut av plassen og dekket lagkortene. Rettet, med e2e-test.
  - Fire svært brede lagnavn presset det fjerde kortet under kontrollinja. Poengene står nå til høyre for navnet, og navn deles med bindestrek.
  - To funn fra røyktesten i produksjon: en løs «· 2 svar» på gruppekort, og forkastede grupper som gjentok svaret sitt. Begge rettet.
  - `DESIGN.md` og `EXPERIENCE.md` er oppdatert til fargen på poengtellingen som ble valgt i 6.2 (mynte på mynte ville gitt kontrast 1:1).

## Sjekker (lokalt, uten nett og uten nøkler)
Lint, format og typecheck er rene. `npm run test`: 731 passerer. `npm run test:e2e`: 97 passerer.

## Migrasjoner
`0012` (lag og spilltilstand) og `0013` (avsløringer) legger bare til tabeller. De kjøres mot Neon før merge.

## Kjente begrensninger
- Manuelle sjekker som gjenstår: lesbarhet på en ekte TV på 3 meters avstand (A1, A7–A9) og tidtaking T6–T8.
- Fire lagnavn på 14 brede tegn med tresifrede poeng kan fortsatt flyte over (`shortcut:` i `limits.ts`).
- Brødcrumb på lagoppsettet er utsatt.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
