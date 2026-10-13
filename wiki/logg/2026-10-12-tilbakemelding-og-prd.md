# 2026-10-12 — Tilbakemelding fra faglærer, korrigert vekting, revidert brief og PRD-utkast

## Gjort

- Leste faglærers tilbakemelding (commit `3d75a2b`, 2026-10-06), som konkluderte med
  *«Godt utgangspunkt med justeringer»* og vanskelighetsgrad **Middels**.
- **Rettet vektingen overalt:** kode 70 %, rapport 30 %, ingen muntlig. Se [[ibe160]].
- Skrev [[sensorveiledning-del-1]], de sju kriteriene koden vurderes etter.
- Merket [[proposal]] som fjorårets format. I år er arbeidskravet selve briefen.
- Reviderte briefen: trinn 1/2, fire testbare kriterier, pilotmål merket som pilotmål, én
  personlig lenke per deltaker, enkleste poengregler, gruppering én gang ved lukking, og hele
  trinn 1 skal kunne kjøres uten modellnøkkel. Se [[beslutninger]].
- Skrev `PRD.md`-utkastet (fase 2): 33 FR-er merket Stage 1/Stage 2, 6 brukerreiser (én av dem
  er sensor som kjører appen uten nøkkel), og testbare konsekvenser per FR.
- Utvidet `sync-brief.sh` til også å generere `PRD.md`, og rettet en feil som ville kuttet
  dokumentet ved første `---`.
- Kjørte BMADs reviewer gate på PRD-en: avstemming mot alle kildene og en rubrikkgjennomgang
  (fire funn med høy alvorlighet, ingen kritiske). Rettet alle funn med høy alvorlighet og de
  fleste middels. Det viktigste var at anonymiteten ikke var testbar i vertens grensesnitt
  under innsamlingen, og at en svarsett-ID kunne koble én persons svar på tvers av spørsmål.
  Gjennomgangene ligger ved siden av `prd.md`.
- Promptene fra økta ligger i `prompting/fase-2-planlegging/`.

## Funn verdt å huske

1. **Fjorårets materiale viser format, ikke årets regler.** Andre gang vi har lest feil
   kildeår som fasit. Se [[kullet]].
2. **Sensor kjører appen uten våre nøkler.** Det gjør demomodus til et krav i både PRD og
   arkitektur, ikke en testbekvemmelighet.
3. **Commit-historikken vurderes.** Faglærer påpekte at alt skjedde 13.–14. september.

## Neste

1. ~~Bekreft antakelsene i PRD-en~~ — gjort 2026-10-13. Sondre delegerte alle beslutningene
   («du bestemmer alt sammen»), og PRD-en ble satt til `status: final`. Beslutningene står i
   PRD §11 og i [[beslutninger]].
2. Fase 3: `bmad-ux` (skisser gjennomgangsflaten først) og `bmad-architecture`. Avgjør stack,
   modell og demomodus.
