# Plan for fase 3 og 4 — fra PRD til innlevert app

> Skrevet 2026-11-21. Utgangspunkt: PRD-en er ferdig (13. okt.), men UX, arkitektur, epics og
> kode mangler. Kullet er i implementering, og det er **14 dager til innleveringen 5. des.**
> Se [[tidsplan]], [[kunngjoringer]] og [[sensorveiledning-del-1]].

## Prinsipper

- **Trinn 1 først, og ferdig.** Trinn 2 starter bare hvis SM-1 (alle testbare konsekvenser i
  trinn 1 er dekket av tester som passerer) er oppfylt. Det står i PRD §6.5.
- **BMAD hele veien, men raskt.** Prosess og KI-styring er 30 % av del 1. Sensor ser etter
  BMAD-dokumenter som faktisk er brukt, og kode som kan spores til stories. Vi hopper derfor
  ikke over UX, arkitektur og epics, men kjører dem med delegerte beslutninger, slik vi gjorde
  med PRD-en.
- **Én branch og én PR per epic**, med én commit per story. KI-en committer lokalt, og
  gruppa pusher og merger. Se [[beslutninger]].
- **Hver story har tester** før den regnes som ferdig. Hele testsuiten skal gå uten nett
  (NFR-3).
- **KI-korreksjoner noteres underveis** i `prompting/`. A–B på Prosess krever konkrete
  eksempler på at vi avviste eller rettet KI.

## Fase 3 — planlegging (21.–23. nov.)

Branch: `fase-3-planlegging`, som ender i én PR.

| Steg | Skill | Resultat | Kjøres |
|------|-------|----------|--------|
| 3.1 | `bmad-ux` (headless) | `DESIGN.md` + `EXPERIENCE.md`, med gjennomgangsflaten skissert først | Parallelt med 3.2 |
| 3.2 | `bmad-architecture` (headless) | `ARCHITECTURE-SPINE.md`: stack, datamodell, dommer-grensesnitt, demomodus | Parallelt med 3.1 |
| 3.3 | `bmad-create-epics-and-stories` | Epics og stories med akseptkriterier sporet til FR-er | Etter 3.1 og 3.2 |
| 3.4 | `bmad-sprint-planning` (headless) | Readiness gate og `sprint-status.yaml` | Etter 3.3 |

Rammene for arkitekturen er bestemt av gruppa (delegert til KI 2026-11-21) og sendes inn som
føringer:

- **Next.js + TypeScript + Tailwind**, som i `proposal.md`.
- **PostgreSQL-dialekt.** Lokalt brukes en innebygd database som ikke trenger installasjon
  (kandidat: PGlite), og ved deploy en vanlig Postgres via `DATABASE_URL`. Forskjellen er bare
  konfigurasjon (NFR-1, NFR-2). Supabase er dermed ikke nødvendig lokalt.
- **Egen innlogging** med e-post og passord, og sesjoner i databasen. Ingen tredjepart.
- **Én dommer bak et grensesnitt**, med tre implementasjoner: Claude via API, avspilling av
  lagrede dommer-svar, og mock. Uten nøkkel brukes manuell gruppering.
- **Vitest + Playwright**, ESLint + Prettier, og GitHub Actions som kjører alt uten nett.
- Maks tre kommandoer fra klon til kjørende demo (NFR-1).

## Fase 4 — implementering (23. nov.–1. des.)

Epicene kommer fra steg 3.3. Forventet rekkefølge, ut fra avhengighetene i PRD-en:

1. **Fundament**: prosjektoppsett, database, innlogging for verten, spill og tilstander, CI
2. **Spørsmål og innsamling**: invitasjonslenker, svarskjema, endring, progresjon, tilbakekalling
3. **Lukking og anonymitet**: lukking, sletting av token, bidragsnøkler, og anonymitetstestene
4. **Gruppering**: dommeren, manuell gruppering, rangering, lagrede dommer-svar, evaluering
5. **Gjennomgang**: slå sammen, flytte, gi nytt navn, forkaste, merke som gjennomgått, bekrefte
6. **Spill**: lag, brett, treff og bom, angre, turer, sluttresultat
7. **Demomodus og levering**: demodata, README, ende-til-ende uten nøkkel, ny klon fra README

Per story: `ponytail` (full) og så `bmad-build`, med plan, implementering, tester og review, og
én commit. Per epic: `bmad-code-review` og `ponytail-review`, der funnene og rettingene skrives
inn i PR-beskrivelsen. Det er sporet av kodegjennomgang sensor ser etter under Testing. Før
frysen 1. des. kjøres `ponytail-debt`, og før innlevering `ponytail-audit`.

## Innspurt (1.–5. des.)

| Dato | Hva |
|------|-----|
| 1. des. | **Trinn 1 fryses.** Etter dette kommer bare feilrettinger, tester og README |
| 2.–3. des. | Kjøre fra en ny klon etter README, slik sensor gjør (15–20 min). Manuell sjekkliste for FR-24 og NFR-6 |
| 2.–4. des. | Refleksjonsrapporten, se [[refleksjonsrapport]] |
| 5. des. | Innlevering: repoet som zip + rapporten |

Trinn 2 (FR-33 først) tas bare hvis det er tid etter 1. des., og ikke på bekostning av
rapporten.

## Risiko

| Risiko | Tiltak |
|--------|--------|
| For lite tid til hele trinn 1 | Rekkefølgen over gjør at hver epic gir en kjørbar app. Spill (6) og demo (7) er viktigere enn polering av gjennomgangen |
| Anonymitetskravene (FR-11 til FR-13) gjør datamodellen vanskelig | Avgjøres i arkitekturen før koding, og testes med egne tester i epic 3 |
| Sensor får ikke appen til å kjøre | Innebygd database, ingen nøkkel, én demokommando, og CI som kjører fra ren klon |
| PR-ene blir liggende umergede | Gruppa merger hver epic før neste starter. Ellers stables branchene |
