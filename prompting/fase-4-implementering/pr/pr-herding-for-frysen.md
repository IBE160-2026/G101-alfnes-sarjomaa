# Herding før frysen

Rettinger fra revisjonen av hele repoet (`ponytail-audit` og `ponytail-debt` 2026-11-24) før trinn 1 fryses 1. desember. Ingen nye funksjoner.

## Endringer
- **Indekser** på `answer.question_id`, `answer.group_id` og `answer_group.question_id` (migrasjon `0015`). Sletting og opprydding leste hele svartabellen én gang per gruppe: 4,4 s mot 45 ms per sletting med 100 spill i PGlite.
- **`newQuestionId()`** bygger id-en fra `crypto.getRandomValues`. `crypto.randomUUID` finnes ikke på en vanlig http-adresse i lokalnettet, så verten kunne ikke legge til spørsmål der og fikk ingen feilmelding.
- **Tak på påloggingskøen** (32 ventende). En flom av forsøk avvises med «Prøv igjen om litt», teller aldri mot sperringen og skrives til loggen.
- **CLI-testene** starter `tsx` gjennom Node, så de virker på Windows.
- **Ny test for FR-5:** samme token kan ikke brukes i to spill.
- **README og `.env.example`** forklarer hvordan porten settes.
- **Statiske varsler** er ikke lenger live-regioner, og `EXPERIENCE.md` sier det samme.
- **Snarveiene** i `ponytail-debt` som var misvisende eller utdaterte, er omformulert.

## Review
Rapportene ligger i `.docs/implementation-artifacts/reviews/herding-for-frysen-*.md`.
- **`ponytail-review`:** «Ship». Funnet som telte: taket på 8 ventende pålogginger kunne få e2e-testene til å feile på en maskin med 22 eller flere logiske CPU-er, fordi Playwright kjører én arbeider per to CPU-er. Taket er hevet til 32.
- **`bmad-code-review`:** 0 høy, 1 medium og 7 lave. Medium: spesifikasjonen sa at migrasjonen kjører ved oppstart, men på Neon kjøres den for hånd. Den er kjørt før merge, og sjekklista krever nå migrering for alle migrasjoner. Lave funn som er utsatt: test av spørsmålseditoren på en http-adresse, og indekser på de andre fremmednøklene.

## Avvist eller utsatt
- Slette rå svartekst når brettet låses: en gruppebeslutning (issue #15).
- Fjerne `typescript-eslint`: avhengigheten er låst med vilje i arkitekturen.

## Sjekker
Lint, format og typecheck er rene. `npm run test`: 824 passerer (1 hoppet over). `npm run test:e2e`: 100 passerer.

## Migrasjoner
`0015` (tre indekser) er kjørt mot Neon før merge.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
