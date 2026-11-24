# Story 8.5: Egen TV-visning og vertsvisning med fasit

Sondre testet piloten og ville utvide PC-skjermen til TV-en: rommet skal se brettet og poengene, mens verten ser fasiten og styrer spillet fra PC-en. Endringen er logget i `wiki/prosjekt/beslutninger.md`, og FR-24 til FR-27 i PRD-en er endret 2026-11-24.

## Hva er nytt
- **`/spill/<id>/tv`:** bare brettet, spørsmålet, poengene og hvem som svarer, med bom-panelet og avsløringene. Ingen kontroller, bare F for fullskjerm. Skjulte svar og antall sendes aldri til siden. Det er testet mot både HTML og RSC-dataene.
- **`/spill/<id>/vert`:** fasiten med alle åtte svarene og antallene, merket avslørt, uten poeng eller skjult. Siden har poengene og de samme handlingene som knapper og hurtigtaster, og knappen «Åpne TV-visning» åpner ett TV-vindu.
- **Synk:** handlinger i `/vert` og `/skjerm` sendes til TV-vinduet over BroadcastChannel, så et vindu i samme nettleser oppdateres med én gang. TV-en spør også serveren hvert 2. sekund, så den følger med på en annen enhet. Pollingen stopper etter 10 minutter uten endringer og starter igjen ved fokus, synlighet eller en melding.
- **`/skjerm`,** visningen på én skjerm, er uendret. Logikken er flyttet til en felles `usePlay`.
- **Spillsiden** viser «Fortsett spillet», «Åpne TV-visning» og «Vertsvisning med fasit», med en advarsel om å utvide skjermen, ikke speile den.

## Review
Rapportene ligger i `.docs/implementation-artifacts/reviews/story-8-5-*.md`, med «Fixes» nederst.
- **`bmad-code-review`:** 0 høy, 2 medium og 14 lave.
  - TV-en kunne havne på feilsiden hvis pollingen traff mens siste spørsmål ble avsluttet. Nå laster den siden på nytt.
  - En glemt TV ville spurt Neon rundt 14 000 ganger i timen for alltid. Nå stopper pollingen etter 10 minutter uten endringer.
  - Seks hull i testene er tettet.
- **`ponytail-review`:** «Ship». Dupliserte tester er slettet.
- **`impeccable` audit:** 17/20. TV-en viste en fokusramme rundt «Sluttstilling» som hele rommet så. Den er fjernet. TV-en fulgte vertsvinduet innen 1–144 ms.

## Kjente begrensninger
- En TV på en annen enhet viser ikke bom-panelet, fordi bom ikke lagres (`shortcut:` i `TvBoard.tsx`).
- Åpnes TV-en før spillet starter, ser rommet lagoppsettet.

## Sjekker
Lint, format og typecheck er rene. `npm run test`: 832 passerer (1 hoppet over). `npm run test:e2e`: 105 passerer. Ingen migrasjoner.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
