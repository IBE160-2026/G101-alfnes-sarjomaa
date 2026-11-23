# Epic 3: Lukking og anonymitet

**Basert på `epic-2-innsamling`. Merge fase 3, epic 1 og epic 2 først.**

> **Merk:** etter lukking står spillet i *grouping*, og det kommer ikke videre før epic 4 legger til grupperingen. Siden viser «Grupperingen tar lengre tid enn vanlig. Last inn siden på nytt.» Merge helst epic 3 og epic 4 tett etter hverandre.

Story 3.1–3.3: lukking av innsamlingen som det ene anonymiseringssteget, og testene som beviser anonymiteten.

## Stories
| Story | Innhold | Review (funn / rettet / avvist) |
|-------|---------|----------------------------------|
| 3.1 | Lukkingen i én transaksjon: ny tilfeldig bidragsnøkkel per spørsmål, Fisher-Yates-stokking med `crypto.randomInt`, ett samlet innsett, sletting av token-hasher og innsendinger, og VACUUM. FR-10 (minst tre svarsett) sjekkes under radlåsen | 28 / 11 / 16 |
| 3.2 | Anonymitetstest av skjema og data etter en ekte lukking: ingen serie-ID-er, tidsstempler eller token-rester, stokket fysisk rekkefølge, ett `xmin`/`cmin`, og slettede tabeller fjernet fra disken. Testene ble bevist med 25 bevisste brudd i koden | 28 / 17 / 11 |
| 3.3 | Vertens visning under innsamlingen (kan ikke lese svar eller se hvilken lenke som svarte eller når), og logg-hygiene i både `next dev` og `next start` (193 verdier sjekket). To ustabile e2e-tester er stabilisert | – / 3 medium rettet / – |

## Review av hele epicen
Rapportene ligger i `.docs/implementation-artifacts/reviews/epic-3-*.md`, med seksjonen «Epic 3 review fixes» nederst.

- **`bmad-code-review`** (fem reviewere): 0 høye, 3 medium og 8 lave. Anonymiteten holder på ekte Postgres, og lukking, innsending, tilbakekalling, sletting og opprydding venter på hverandre via radlåsen på spillet.
  - VACUUM etter lukking kunne hoppes over uten logg, og da ble svarsettene liggende i tabellfilene. Nå prøver den timevise oppryddingen igjen, og hver hoppet VACUUM logges (AD-9).
  - VACUUM-testen passerte uten `FULL`. Den sjekker nå ny fil, TOAST og indekser.
  - Låsetestene passerer på PGlite uten `FOR UPDATE`. En sjekk av spørringen fanger det til CI kjører mot ekte Postgres (story 7.3).
- **`ponytail-review`:** dommen er «ship», uten «must». Dupliserte tester for stokking og kappløp er fjernet. Den ekstra `next dev`-serveren i e2e beholdes, fordi bare dev-modus logger argumentene til server-funksjoner.
- **`impeccable` audit** (18/20):
  - Dialogene kunne lukkes med Esc mens handlingen pågikk, og da forsvant feilmeldingen. Alle fire dialogene har nå `busy`.
  - Fokus og en melding etter lukking.

## Sjekker (lokalt, uten nett og uten nøkler)
Lint, format og typecheck er rene. `npm run test`: 430 passerer. `npm run test:e2e`: 86 passerer. Alle anonymitetstestene er sett røde med koden brutt med vilje.

## Merk for gruppa
- e2e starter også `next dev` på port 3101. Stopp `npm run dev` før `npm run test:e2e`.
- Radlåser og oppdagelse av hoppet VACUUM er bare testet på PGlite. CI-jobben mot ekte Postgres kommer i story 7.3.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
