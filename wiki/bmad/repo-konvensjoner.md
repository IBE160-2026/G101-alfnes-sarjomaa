# Repo-konvensjoner for BMAD-artefakter

> Kilde: de to referanserepoene i `IBE160-2026` som emneansvarlig pekte på
> (`G36-steponaitis`, `G23-eriksen-knudsen-kolstad-samdal`), begge offentlige.
> Begge kjører **BMAD Method v6.12.0**.

## Hvor artefaktene faktisk havner

Dette er viktig: **ingen av referanserepoene har en fil som heter `product-brief.md` i rota.**
BMAD legger den i en datert mappe per kjøring:

```
.docs/
  planning-artifacts/
    briefs/
      brief-<Prosjektnavn>-<ÅÅÅÅ-MM-DD>/
        brief.md        ← selve product brief
        addendum.md     ← overflow: detaljer som hører til nedstrøms-dokumenter
        .memlog.md      ← beslutningslogg fra KI-samtalen
  implementation-artifacts/   ← senere faser
docs/                         ← «project knowledge», ikke planleggingsartefakter
```

Styres av `_bmad/bmm/config.yaml`:

```yaml
planning_artifacts: "{project-root}/.docs/planning-artifacts"
implementation_artifacts: "{project-root}/.docs/implementation-artifacts"
project_knowledge: "{project-root}/docs"
output_folder: "{project-root}/.docs"
```

> **Avklart 2026-09-14: vi gjør begge deler.** Oppgaveteksten navngir `product-brief.md`,
> men BMAD hardkoder filnavnet `brief.md` inne i kjøremappa — det finnes ingen innstilling
> som endrer det. Kjøremappa er kanonisk og den eneste som redigeres; rotfila er en
> byte-identisk kopi laget med `cp`.
>
> ```bash
> cp ".docs/planning-artifacts/briefs/brief-Toppsvar-2026-09-14/brief.md" product-brief.md
> diff -q ".docs/planning-artifacts/briefs/brief-Toppsvar-2026-09-14/brief.md" product-brief.md
> ```
>
> Kjør `cp` som siste steg før hver commit som rører briefen. Ikke symlink — sluttleveringen
> er en zip, og ikke alle zip-verktøy tar vare på symlinker.
>
> Bakgrunn: av 13 grupper i kullet som har levert en brief, bruker de 8 som faktisk har
> installert `_bmad/` kjøremappa; de 5 som la fila i rota har ikke rammeverket i det hele tatt.
> Å kun ha rotfila er altså det synlige kjennetegnet på å ikke ha brukt verktøyet.

## Hva som sjekkes inn

Begge referanserepo committer hele rammeverket, slik at gruppa deler identisk verktøy:

- `_bmad/` — configs + Python-scripts (`config_utils`, `memlog`, `render_skill`, `resolve_config`, `resolve_customization`)
- `.claude/skills/` — 39 `bmad-*`-skills (product-brief, prd, architecture, ux, spec, create-epics-and-stories, sprint-planning, build, code-review, retrospective, brainstorming, …)

Personlig config holdes utenfor. `.gitignore`-blokka vi allerede har i repoet er hentet herfra:

```
# BMAD: keep shared framework, skills, plans and documentation
_bmad/config.user.toml
_bmad/custom/*.user.toml
_bmad/render/
.claude/settings.local.json
```

> ✅ **Installert 2026-09-14** — BMAD v6.12.0, moduler `bmm` + `cis` (v0.3.2), 39 skills.
> Framgangsmåte, flaggbegrunnelser og en konfigurasjonsfeil vi fant og fikset: [[bmad-install]].

## Kvalitetsnivået i referansebriefen

G23s `brief.md`: **~890 ord / ~85 linjer** (emneansvarliges eget eksempel, `product-brief-beergame.md`, er til sammenligning **1813 ord** — G23 ligger altså i nedre ende av spennet, ikke i midten), YAML-frontmatter (`title`, `status: draft`, `created`, `updated`),
åtte `##`-seksjoner. De omrokerte *Who This Serves* foran *The Solution* — i tråd med at malen
er «starting structure, not a contract».

Omtrentlig fordeling:

| Seksjon | Ord |
|---------|-----|
| Executive Summary | 118 |
| The Problem | 143 |
| Who This Serves | 66 |
| The Solution | 89 |
| What Makes This Different | 107 |
| Scope | 133 |
| Success Criteria | 109 |
| Vision | 81 |

**To ting verdt å kopiere:**

1. **Falsifiserbare suksesskriterier.** Ikke «brukerne blir fornøyde», men f.eks.
   «3 av 3 testpersoner finner og forklarer hovedresultatene uten hjelp fra utviklerne».
2. **Scope som hard grense.** Flere ønskede funksjoner ble eksplisitt skjøvet ut av V1,
   ikke latt stå vage.

## `addendum.md` — overflow-filen

Når en teknisk implementasjonsplan dukket opp under brief-samtalen, ble den flyttet ut med
begrunnelsen: *«Supporting depth captured during the brief conversation that belongs in
downstream documents (architecture / implementation plan / sprint planning) rather than the
brief itself.»* Bra mønster — holder briefen på 1–2 sider uten å kaste arbeid.

## `.memlog.md` — beslutningsloggen

Append-only logg ved siden av briefen, generert av `_bmad/scripts/memlog.py` under KI-samtalen.
Hver linje tagget `(event)`, `(decision)`, `(assumption)` eller `(change)`, med YAML-frontmatter
(`topic`, `updated`).

Eksempler på hva den fanger:
- `(decision)` hvorfor 7-fase-planen ble rutet til `addendum.md`
- `(assumption)` en UX-anbefaling flagget som **ikke bekreftet med resten av gruppa**
- `(change)` revisjonsspor med ordtelling per runde (1223 → 873 → 891 ord)

Det finnes ingen separate prompt-logger eller ADR-filer i referanserepoene — memloggen *er*
beslutningsdokumentasjonen. Vår [[beslutninger]] fyller samme rolle inntil `_bmad/` er installert.

## Forskjell fra vår arbeidsflyt

G23 bruker personlige feature-branches (`carmen/product-brief-forbedringer`) for dokumentgjennomgang.
**G101 jobber kun på `main`** — ingen feature branches.


## Hva G101 faktisk leverte i fase 1

```
.docs/planning-artifacts/briefs/brief-Toppsvar-2026-09-14/
    brief.md        1395 ord, 8 seksjoner, engelsk, status: draft
    addendum.md     ~1000 ord — kildeskjema (anonymisert), grupperingsvalg, spilleflyt, anonymitet
    .memlog.md      16 oppføringer, append-only
product-brief.md    byte-identisk kopi av brief.md
```

Briefen ble skrevet i fire uavhengige varianter med ulik innfallsvinkel, hver vurdert av tre
dommere (BMAD-sjekklista, emnets rubrikk, formatkrav), og deretter syntetisert fra vinneren
med det beste fra de tre andre podet inn.
