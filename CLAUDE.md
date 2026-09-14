# G101 — Claudeception

Gruppeprosjekt i **IBE160 Programmering med KI**, Høgskolen i Molde, høsten 2026.
Medlemmer: Sondre Alfnes, Daniel P Sarjomaa.
Produkt: **Toppsvar** — Family Feud-aktig festspill der verten lager sitt eget spørreskjema.

Prosjektet følger **BMAD Method v6.12.0** fase for fase. Dokumentasjonen i `./wiki` er
kanonisk kilde for hva som gjelder — les den før du gjetter.

## Arbeidsregler

- **Ikke commit.** Legg igjen endringene ustagede; Sondre leser gjennom og committer selv.
- **Jobb på `main`.** Ingen feature branches i dette repoet. Med mindre det er spesifisert.
- **Bruk subagenter** for å holde hovedkonteksten ren. Ikke la orkestratoren lese mange
  små filer den ikke faktisk trenger — deleger lesing/søk og behold konklusjonen. Eller bruk også subagents til å få egne eksperter innen egne domener.
- **Dokumentér i `./wiki`.** Obsidian-lik vault med `[[wikilenker]]`. Nye notater skal
  lenkes inn fra `wiki/index.md`, ellers blir de aldri funnet igjen.
- **Repoet er offentlig** på `github.com/IBE160-2026/G101-alfnes-sarjomaa`. Kildematerialet
  i `.idea/` navngir privatpersoner og er gitignorert. Reelle navn derfra skal **aldri**
  inn i en sporet fil — bruk anonymiserte plassholdere.

## Språk

| Hva | Språk |
|-----|-------|
| `wiki/`, `README.md`, `CLAUDE.md`, commit-meldinger | Norsk |
| BMAD-artefakter (`brief.md`, `addendum.md`, `.memlog.md`, senere `PRD.md`) | **Engelsk**, overskrifter og brødtekst |

Engelsk i BMAD-artefaktene matcher emneansvarliges eget eksempel
(`product-brief-beergame.md`). Referansegruppa G23 brukte engelske overskrifter med
norsk brødtekst — vi gjør det ikke. Valget skal holde for `PRD.md` også.

## Hvor ting ligger

| Sti | Innhold |
|-----|---------|
| `product-brief.md` | **Generert** av `scripts/sync-brief.sh` — brødteksten uten frontmatter. Rediger aldri direkte |
| `.docs/planning-artifacts/briefs/brief-Toppsvar-2026-09-14/` | Kanonisk fase 1: `brief.md`, `addendum.md`, `.memlog.md` |
| `_bmad/` | BMAD-rammeverket. `config.toml` er installer-styrt og skal ikke redigeres |
| `_bmad/custom/config.toml` | Fellesoppsett vi *skal* redigere, og som committes |
| `.claude/skills/bmad-*` | 39 BMAD-skills |
| `scripts/sync-brief.sh` | Genererer og verifiserer rot-kopien av briefen |
| `scripts/scan-cohort.sh` | Ser hva resten av kullet har levert, og hvor |
| `wiki/` | All prosjektdokumentasjon. Start i `wiki/index.md` |
| `.idea/` | **Gitignorert.** Oppgavetekst, PDF-er, mal, eksempelbrief — kun lokalt |

### Briefen finnes to steder — med vilje

Oppgaveteksten krever filnavnet `product-brief.md`, men BMAD hardkoder `brief.md` inne i
en datert kjøremappe. Løsningen er begge deler, der kjøremappa er kanonisk og den eneste
som redigeres for hånd.

Filene skiller seg på **nøyaktig én** måte, med vilje: BMADs product-brief-skill krever
YAML-frontmatter (`title`, `status`, `created`, `updated`), men **GitHub rendrer den
frontmatteren som en tabell** øverst på sida. Leveransefila er derfor uten frontmatter —
noe som også matcher emneansvarliges eget eksempel, `product-brief-beergame.md`, som
ikke har frontmatter.

```bash
./scripts/sync-brief.sh
```

Kjør den som siste steg før enhver commit som rører briefen. Scriptet stripper
frontmatteren, skriver `product-brief.md`, og feiler hvis brødteksten har kommet ut av
synk eller frontmatteren har sneket seg inn igjen. En kopi som har kommet ut av synk er
verre enn ingen kopi.

Ikke bruk symlink — sluttleveringen er en zip, og ikke alle zip-verktøy tar vare på dem.
Ikke rediger `product-brief.md` direkte; endringene blir overskrevet neste gang scriptet kjører.

## Er du usikker? Sjekk hva resten av kullet gjorde

Alle gruppene ligger åpent i samme organisasjon: `github.com/IBE160-2026`. Når det er uklart
hva en leveranse skal hete, hvor den skal ligge, eller om den i det hele tatt hører hjemme i
repoet, er kullet det beste tilgjengelige beviset — bedre enn å gjette.

```bash
./scripts/scan-cohort.sh                      # hvilke grupper har faktisk laget noe, og hva
./scripts/scan-cohort.sh 'brief\.md$'         # hvor legger folk briefen?
./scripts/scan-cohort.sh 'prd|architecture'   # hvem har kommet videre, og hva kalte de det?
./scripts/scan-cohort.sh --all proposal       # søk i alle repo, også de urørte
```

**To feller scriptet finnes for å unngå:**

1. **`gh search code --owner IBE160-2026 ...` gir 0 treff på alt.** Organisasjonen er for ny
   til å være indeksert av GitHubs kodesøk. Stoler du på det, konkluderer du feilaktig med at
   kullet ikke har levert noe. Scriptet går gjennom git-treet til hvert repo i stedet.
2. **De fleste repo er bare stillas.** Av 132 repo hadde 18 noe eget innhold da vi sjekket
   2026-09-14. Scriptet skjuler resten, og holder `_bmad/` og `*/skills/` utenfor tellingen —
   ellers ser hver gruppe som bare installerte BMAD ut som om de har skrevet både brief,
   PRD og arkitektur, siden skill-mappene heter `bmad-product-brief`, `bmad-prd` og
   `bmad-architecture`.

Dette er hvordan vi slo fast at ingen leverer `proposal.md` (se [[tidsplan]]), og at grupper
som kjører BMAD legger briefen i kjøremappa framfor i rota (se [[repo-konvensjoner]]).

Vurder resultatene som bevis, ikke som fasit: én gruppe kan ha misforstått like gjerne som oss.
Emneansvarliges eget `beergame`-repo veier tyngre enn en tilfeldig gruppe.

## Status

- [x] Uke 42 — `proposal.md`
- [x] **Fase 1 — `product-brief.md`** (Toppsvar, 1395 ord, `status: final`)
- [ ] Fase 2 — `PRD.md` (skill: `bmad-prd`)
- [ ] Fase 3 — `solution-architecture.md`, `ux-specification.md`, `frontend-prompt.md`
- [ ] Fase 4 — implementering
- [ ] Refleksjonsrapport

Fase 1 er satt til `status: final`. Samme status brukes på `addendum.md`, og skal brukes
på `PRD.md`, så vokabularet holdes konsistent (`draft` → `final`).
Sluttinnlevering: **GitHub-repo som zip + refleksjonsrapport, 5. desember.**
