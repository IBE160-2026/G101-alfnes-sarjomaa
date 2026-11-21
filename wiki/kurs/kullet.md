# Kullet — hva de andre gruppene faktisk gjør

Det finnes **to** organisasjoner, og den eldste er den nyttigste:

| Org | Hva | Nytte |
|-----|-----|-------|
| `github.com/IBE160` | **Forrige studieår.** 54 repo, ferdige prosjekter, pushet nov 2025 – jan 2026, mange med 100+ commits og komplett dokumentsett | **Primær referanse** |
| `github.com/IBE160-2026` | Årets kull. 132 repo, men nesten alle er tomme stillas | Viser hva samtidige gjør akkurat nå |

```bash
./scripts/scan-cohort.sh                    # fjorårets ferdige prosjekter (standard)
./scripts/scan-cohort.sh --org IBE160-2026  # årets kull
```

> **Feilen vi gjorde.** Vi sjekket først bare `IBE160-2026`, fant null `proposal.md`, og
> konkluderte med at leveransen ikke fantes. I `IBE160` har omtrent 48 av 54 repo en.
> **Et kull som ikke har nådd en milepæl ennå beviser ingenting om den milepælen.**
> Sjekk alltid fjoråret først. Se [[proposal]].

Tallene under er fra 2026-09-14, og gjenspeiler **det som er pushet til GitHub** —
vår egen rad henger derfor etter så lenge endringer ligger ustaget lokalt.

## Fjorårets kull — hele dokumentsettet

Fjorårets sterke repo ender opp med alle disse: `proposal.md`, product brief, `PRD.md`,
arkitektur, og en refleksjonsrapport. Det er fasiten på hva et ferdig prosjekt inneholder.

### Hvilke repo som faktisk er verdt å kopiere fra

`.grading/part-3.md` i `beergame` inneholder muntlig-karakteren til hver student. Snittet per
gruppe er det nærmeste vi kommer en fasit på hvem som gjorde det bra — men merk at det måler
den **individuelle muntlige** fra fjoråret, ikke repoet. **I år finnes det ingen muntlig
eksamen** (se [[ibe160]]), så snittet sier noe om hvem som forsto prosjektet sitt, ikke om
hvordan årets vurdering vektes.

| Repo | Commits | Muntlig-snitt | Hvorfor se på den |
|------|--------:|--------------:|-------------------|
| `SG-Pre-terminal` | 202 | **4,75** | Ryddigst BMAD-dokumentsett. Beste allroundmodell |
| `SG-418` | 71 | **4,67** | `docs/decisions/` og `prompting/fase_1|fase_2/` med lagrede sesjoner |
| `SG-KI-med-KG` | 502 | 4,50 | Mest dokumentasjon av alle (527 egne filer) |
| `SG-Closed-Group` | 187 | 4,50 | Bygde egne verktøy rundt refleksjonsrapporten |
| `SG-Gruppe-A` | 146 | 4,50 | Ryddig og kompakt |
| `SG-Gruppe-13` | 158 | 4,25 | Docs organisert som `fase-1-analysis/`, `fase-2-plan/`, `fase-3-solutioning/` — nærmest vår egen wiki-modell |
| `SG-NextGenCoding` | 145 | **5,00** | Solo. Viser hva én person rekker |
| `SG-Kassandra` | 449 | **5,00** | Solo, Playwright-tester med skjermbilder |
| `SG-Gruppe-Stavanger` | 367 | 3,75 | Den oppgaveteksten vår peker på |

**Commit-antall forutsier ikke karakter.** `SG-418` har 71 commits og 4,67; `SG-Gruppe-12`
har 229 og 2,67.

### Dokumentsettet et ferdig prosjekt har

Av de 26 sterkeste repoene hadde **alle 26**: `proposal.md`, product brief, `docs/PRD.md`,
`docs/architecture.md`, `docs/epics.md`, `docs/bmm-workflow-status.yaml`.
25 av 26 hadde `docs/ux-design-specification.md` og `docs/project-plan.md`.

To navnedetaljer å ta med videre:

- Fjoråret brukte **`docs/` i rota** — 26 av 26. Ingen brukte `.docs/`. Vår `.docs/` kommer
  av BMAD v6.12s egen standard, ikke av et valg, så det er et versjonsavvik og ikke et brudd.
- UX-dokumentet heter **`ux-design-specification.md`**, ikke `ux-specification.md` som vår
  [[tidsplan]] sier.
- **`frontend-prompt.md` finnes i 1 av 26.** Lager vi en i fase 3, ligger vi foran fjoråret,
  ikke likt.

Merk at fjoråret brukte en eldre BMAD med `.bmad/` og Gemini-kommandoer i `.gemini/commands/`,
mens vi har `_bmad/` og `.claude/skills/`. Mappenavn er derfor ikke direkte overførbare —
dokumentene og strukturen er det.

## Årets kull

### Status 2026-11-21 — kullet er i implementering, vi er ikke

Skannet 2026-11-21 med en subagent som gikk gjennom git-treet til alle 141 repo i
`IBE160-2026`, med skill-mappene filtrert bort. Tallene for faglærers repo og G85 er
etterprøvd for hånd. **Tallene viser at en fil finnes, ikke at den er god.**

| Artefakt | Repo som har den (av 112 med eget innhold) |
|----------|-------------------------------------------:|
| Brief | 111 |
| PRD | 81 |
| UX (`DESIGN.md` / `EXPERIENCE.md`) | 62 |
| Arkitektur (`ARCHITECTURE-SPINE.md`) | 54 |
| Epics | 52 |
| `sprint-status.yaml` | 37 |
| App-kode | 50 |
| Tester | 54 |
| CI-workflow | 27 |

28 repo har bare malen, og ett er tomt. Median antall commits er 28, 40 repo har over 100, og
15 har over 300. **G101 hadde brief, proposal og PRD, men ikke UX, arkitektur eller kode.** Vi
var altså blant de første med PRD, men er nå bak rundt halve kullet.

**Faglærers `beergame`** (654 commits) er referansen for struktur og omfang:

- Mappestruktur: `.docs/planning-artifacts/{briefs,prds,ux-designs,architecture,epics}/<type>-beergame-<dato>/`,
  og `.docs/implementation-artifacts/` med `sprint-status.yaml` og én `spec-N-M-*.md` per
  story. **Vi følger samme mønster.**
- `GOAL.md` i rota er briefen til den autonome `/goal`-kjøringen.
- 15 epics. Per 21. nov. er 108 av 199 stories ferdige, og epic 1–6 er merket ferdig.
  Kunngjøringen 18. nov. sa «3 av 12», så den er utdatert eller telte annerledes.
- Stacken er FastAPI + Next.js 16 + Tailwind 4, med Postgres via Docker Compose. Vitest og
  Playwright, og CI med fem jobber. Den kjøres med `docker compose up --build` **uten nøkler**:
  LLM-kall går til en lokal mock, og fire demokontoer seedes.

**De som har kommet lengst** (målt på sprint-status, app-kode, tester og CI):

| Gruppe | Stack | Status | Verdt å merke seg |
|--------|-------|--------|-------------------|
| G85 | Next.js 16 i rota | 34/34 stories, eneste helt ferdige | `?demo=`-modus med falsk LLM, uten nøkkel. CI og Vercel |
| G68 | Flask | 30/31 stories | Testmodus uten API-nøkkel |
| G04 | FastAPI + Vite/React, Postgres | 28/28 stories (3/6 epics) | Vercel og Neon-previews |
| G18 | Vite/React | 24/24 stories | `npm run dev:demo` kjører offline. Fire CI-workflows |
| G74 | Flask | 95/116 stories, 2 684 commits | Demodata og demoskript |

Mønsteret hos de beste er det samme som i vår PRD: **en demo- eller mockmodus som kjører uten
nøkkel**, CI med tester, og eventuelt Vercel. Det bekrefter FR-30 og FR-31.

Navnekonvensjon i kullet: `DESIGN.md` + `EXPERIENCE.md` (60), `ARCHITECTURE-SPINE.md` (46),
`epics.md` (43) og `sprint-status.yaml`. `_bmad-output/` er vanligere enn `.docs/`, men
faglærer bruker `.docs/`, som vi.

### To feller

**1. GitHubs kodesøk er blindt for denne organisasjonen.**
`gh search code --owner IBE160-2026 <hva som helst>` returnerer `total_count: 0` med exit 0.
Organisasjonen er for ny til å være indeksert. Stoler man på det, konkluderer man med at
kullet ikke har levert noe — som er feil. Man må gå gjennom `git/trees/HEAD?recursive=1`
per repo.

**2. Skill-mappene forurenser ethvert filnavnsøk.**
BMAD installerer mapper som heter `bmad-product-brief`, `bmad-prd` og `bmad-architecture`.
Søker man etter «brief», «prd» eller «architecture» uten å filtrere bort `_bmad/` og
`*/skills/`, ser hver eneste gruppe som bare har installert rammeverket ut som om de har
skrevet alle tre dokumentene. G36 er det tydeligste eksempelet: full BMAD-installasjon,
null planleggingsartefakter.

### Aktivitet

**18 av 132 repo** hadde eget innhold. De resterende 114 er stillas: `README.md`,
`.gitignore`, `.gitattributes`.

| Repo | Egne filer | Har |
|------|-----------:|-----|
| `beergame` (emneansvarlig) | 8 | bmad, `.docs`, brief |
| G10-andreassen-lundberg | 238 | bmad, `_bmad-output`, brief, **PRD**, **arkitektur** |
| G101 (oss) | 21 | bmad, `.docs`, brief, proposal |
| G03, G04, G53, G65 | 4–5 | bmad, `_bmad-output`, brief |
| G23, G58 | 5 | bmad, `.docs`, brief |
| G16-shyam | 4 | `.docs`, brief |
| G36-steponaitis | 3 | bmad, **ingen brief** |
| G02, G09, G19, G56, G129 | 3 | brief i rota, **ingen bmad** |
| G18, G25 | 3 | ingenting ennå |

### Hvor legger folk briefen?

| Mønster | Grupper |
|---------|---------|
| BMAD-kjøremappe (`.docs/` eller `_bmad-output/`) | 8 — alle har `_bmad/` |
| Flat fil i rota (`product-brief.md`, `PRODUCT_BRIEF.md`, `product-brief-lesevenn.md`) | 5 — ingen har `_bmad/` |
| **Begge** | **1 — bare oss** |

Å kun ha rotfila er altså det synlige kjennetegnet på å ikke ha brukt rammeverket.
Se [[repo-konvensjoner]] for hvorfor vi gjør begge deler.

`.docs` mot `_bmad-output` skyldes installasjonsdato, ikke valg: samme BMAD-versjon byttet
standard underveis. Installasjoner til og med 09-09 fikk `.docs`, senere fikk `_bmad-output`.

## Verdt å merke seg

- **`proposal.md` fantes ikke i noe repo i årets kull da vi skannet — men i nesten alle fjorårets.** Vi har nå skrevet vår.
  Se [[proposal]] og [[tidsplan]].
- **G10 er lengst framme** og eneste gruppe med PRD og arkitektur. De lagde dessuten
  **tre** briefer samme dag (`forplanner`, `pantbuddy`, `VaktMatch`) før de valgte —
  og emneansvarlig la igjen `tilbakemelding-tre-briefer-2026-09-07.md` i repoet deres.
  Verdt å lese før vi ber om tilbakemelding selv.
- **Bare 13 grupper har en brief i det hele tatt.** Statistikk på 13 datapunkter er svakt
  bevis. Emneansvarliges eget `beergame` veier tyngre enn en tilfeldig gruppe.
