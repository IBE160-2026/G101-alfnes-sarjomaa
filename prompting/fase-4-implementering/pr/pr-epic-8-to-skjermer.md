# Story 8.6: Spillet krever to visninger

Etter story 8.5 testet Sondre piloten igjen. To ting virket galt: «Start spillet» sendte verten rett inn i visningen på én skjerm, og den visningen hjalp ikke verten fordi fasiten ikke står der. Beslutningen er logget i `wiki/prosjekt/beslutninger.md` (2026-11-25), og FR-23 til FR-27 i PRD-en er endret.

## Hva er endret
- **Visningen på én skjerm (`/skjerm`) og «Fortsett spillet» er fjernet.** Spillet spilles alltid med vertsvisningen (`/vert`) på PC-en og TV-visningen (`/tv`) på TV-en eller en annen enhet. Gamle lenker til `/skjerm` sender verten til spillsiden.
- **Lagoppsettet** har fått sin egen side, `/spill/<id>/lag`, med brødsmulesti.
- **Etter «Start spillet»** kommer verten til spillsiden med «Vertsvisning med fasit», «Åpne TV-visning», en linje om hvor hver visning åpnes, og advarselen om speiling.
- **TV-en før start** viser «Spillet starter snart» og går over i spillet når verten starter.
- **Slettet:** `Board.tsx` og annen kode som bare gjaldt visningen på én skjerm, rundt 400 linjer i `src/`. Testene er flyttet til `/lag`, `/vert` og `/tv`, så alle krav i FR-24 til FR-27 fortsatt er dekket.
- **README:** nye skjermbilder av TV-en, vertsvisningen og sluttstillingen. Diagrammet `vertsflyt` er tegnet på nytt.

## Review
Rapportene ligger i `.docs/implementation-artifacts/reviews/story-8-6-*.md`, med «Fixes» nederst.
- **`bmad-code-review`:** «Approve», 0 høy, 0 medium og 13 lave. 11 er rettet, blant annet tester av en annen verts spill i *ready* og av F-tasten med Ctrl og Shift.
- **`ponytail-review`:** «Ship». Rundt 70 linjer dupliserte tester og hjelpefunksjoner er fjernet. Ryddingen avdekket en ustabil test (tastetrykk før siden var klar), som nå venter på siden.
- **`impeccable` audit:** 19/20. `/lag` manglet brødsmulesti, og linjen om to vinduer leste som oversatt. Begge er rettet.

## Sjekker
Lint, format og typecheck er rene. `npm run test`: 833 passerer (1 hoppet over). `npm run test:e2e`: 106 passerer. Ingen migrasjoner.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
