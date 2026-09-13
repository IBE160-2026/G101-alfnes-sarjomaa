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

> **Avklaring vi trenger:** oppgaveteksten sier «Innlevering av `product-brief.md`», mens
> BMAD-verktøyet produserer `.docs/planning-artifacts/briefs/brief-.../brief.md`.
> Vi bør enten følge BMAD-konvensjonen (som referansegruppene) eller legge en `product-brief.md`
> i rota. Se [[beslutninger]].

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

> ⚠️ **Vi har `.gitignore`-blokka, men ikke `_bmad/` eller `bmad-*`-skillene installert ennå.**
> Det må på plass før fase 1 kjøres med verktøystøtte.

## Kvalitetsnivået i referansebriefen

G23s `brief.md`: **~890 ord / ~85 linjer**, YAML-frontmatter (`title`, `status: draft`, `created`, `updated`),
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
