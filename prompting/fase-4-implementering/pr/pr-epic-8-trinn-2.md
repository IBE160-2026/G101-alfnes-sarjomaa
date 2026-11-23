# Epic 8 (trinn 2): Ferdige spørsmålssett

Story 8.1 (FR-33): verten kan lage et spill fra et ferdig spørsmålssett. Spillet hopper over innsamling, gruppering og gjennomgang og starter rett i *ready*. Fem sett med fem spørsmål hver, hentet fra den crowdsourcede delen av ProtoQA (CC BY 4.0) og oversatt til norsk uten modellkall. Antallene er uendret, og brettet kuttes på åtte grupper med appens egen rangering.

Gruppa valgte å starte trinn 2 før SM-1-porten er bestått, fordi det som gjenstår der er manuelle sjekker. Avviket fra PRD §6.5 er logget i `wiki/prosjekt/beslutninger.md`. Story 8.2–8.4 venter fortsatt på porten.

## Settene
Hjemme, Mat og drikke, Jobb og reise, Barn og oppvekst og Blandet drops. Hvert spørsmål og hver gruppe har kilde-id-en sin, så alt kan spores tilbake til `data/protoqa/dev.crowdsourced.jsonl`. Spilleskjermen viser «Spørsmål fra ProtoQA (CC BY 4.0), oversatt og tilpasset», og `ATTRIBUTION.md` beskriver hva som er endret.

## Review
Story-reviewen fant 32 funn (1 medium). Rapportene for hele epicen ligger i `.docs/implementation-artifacts/reviews/epic-8-*.md`, med «Epic 8 review fixes» nederst.
- **`bmad-code-review`:** 0 høy, 1 medium og 10 lave.
  - Medium: koden leser den nye kolonnen med en gang, så Neon må migreres før merge. Det er gjort, og sjekklista sier det nå.
  - Et spørsmål motsa brettet sitt («kjæledyr i bur, men ikke en fugl», med «Papegøye» på brettet). Det er byttet ut med et annet ProtoQA-spørsmål.
  - «Knuse med vilje» ble til «ødelegge med vilje», slik at verbet passer alle gruppene.
- **`ponytail-review`:** «Ship», uten «must». Fem dupliserte tester og én test som aldri kunne feile, er slettet.
- **`impeccable` audit:** 17/20.
  - P1: valget av sett forsvant etter en mislykket innsending, så verten fikk et vanlig utkast i stedet. Rettet, med e2e-test.
  - Språkvasken ga 6 nye spørsmålsformuleringer og 10 nye etiketter. Hver etikett er sjekket mot den engelske gruppa, og antallene er uendret.
  - Sett-spill sier «Brettet er klart» i stedet for «låst».

## Sjekker (lokalt, uten nett og uten nøkler)
Lint, format og typecheck er rene. `npm run test`: 820 passerer (1 hoppet over). `npm run test:e2e`: 100 passerer, axe er ren.

## Migrasjoner
`0014` legger til den valgfrie kolonnen `game.question_set`. Den er kjørt mot Neon før merge.

## KI-feil fanget av orkestratoren
Rettingsrunden committet `Board.tsx` uformatert, og `format:check` i CI ville feilet. Rettet i en egen commit før PR-en.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
