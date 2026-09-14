# Kullet — hva de andre gruppene faktisk gjør

> Alle gruppene ligger åpent under `github.com/IBE160-2026`. Når kursmaterialet er tvetydig,
> er kullet det beste tilgjengelige beviset. Kjør `./scripts/scan-cohort.sh`.
> Tallene under er fra 2026-09-14.

## To feller

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

## Aktivitet

**18 av 132 repo** hadde eget innhold. De resterende 114 er stillas: `README.md`,
`.gitignore`, `.gitattributes`.

| Repo | Egne filer | Har |
|------|-----------:|-----|
| `beergame` (emneansvarlig) | 8 | bmad, `.docs`, brief |
| G10-andreassen-lundberg | 238 | bmad, `_bmad-output`, brief, **PRD**, **arkitektur** |
| G101 (oss) | 21 | bmad, `.docs`, brief |
| G03, G04, G53, G65 | 4–5 | bmad, `_bmad-output`, brief |
| G23, G58 | 5 | bmad, `.docs`, brief |
| G16-shyam | 4 | `.docs`, brief |
| G36-steponaitis | 3 | bmad, **ingen brief** |
| G02, G09, G19, G56, G129 | 3 | brief i rota, **ingen bmad** |
| G18, G25 | 3 | ingenting ennå |

## Hvor legger folk briefen?

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

- **`proposal.md` finnes ikke i ett eneste repo.** Se [[tidsplan]].
- **G10 er lengst framme** og eneste gruppe med PRD og arkitektur. De lagde dessuten
  **tre** briefer samme dag (`forplanner`, `pantbuddy`, `VaktMatch`) før de valgte —
  og emneansvarlig la igjen `tilbakemelding-tre-briefer-2026-09-07.md` i repoet deres.
  Verdt å lese før vi ber om tilbakemelding selv.
- **Bare 13 grupper har en brief i det hele tatt.** Statistikk på 13 datapunkter er svakt
  bevis. Emneansvarliges eget `beergame` veier tyngre enn en tilfeldig gruppe.
