# G101 — Claudeception

Gruppeprosjekt i **IBE160 Programmering med KI**, Høgskolen i Molde, høsten 2026.
Medlemmer: Sondre Alfnes, Daniel P Sarjomaa.
Produkt: **Toppsvar** — Family Feud-aktig festspill der verten lager sitt eget spørreskjema.

Prosjektet følger **BMAD Method v6.12.0** fase for fase. Dokumentasjonen i `./wiki` er
kanonisk kilde for hva som gjelder — les den før du gjetter.

## Arbeidsregler

- **Commit i små biter, men ikke push.** Fra 2026-11-21 committer KI-en lokalt, én commit per
  story eller per logisk steg, med norsk melding. Sondre leser gjennom og pusher selv. Bakgrunn:
  sensorveiledningen regner «nesten hele koden i én eller noen få commits» som et varseltegn.
- **Dokumentasjon på `main`, implementering på én branch per epic.** Hver epic (og
  planleggingen i fase 3) får sin egen branch, som ender i én PR som et gruppemedlem merger.
  Sensorveiledningen nevner «branches, pull requests, issues» under Prosess (30 %). Ingen andre
  feature branches. Se [[sensorveiledning-del-1]].
- **Bruk subagenter** for å holde hovedkonteksten ren. Ikke la orkestratoren lese mange
  små filer den ikke faktisk trenger — deleger lesing/søk og behold konklusjonen. Eller bruk også subagents til å få egne eksperter innen egne domener.
- **Dokumentér i `./wiki`.** Obsidian-lik vault med `[[wikilenker]]`. Nye notater skal
  lenkes inn fra `wiki/index.md`, ellers blir de aldri funnet igjen.
- **Repoet er offentlig** på `github.com/IBE160-2026/G101-alfnes-sarjomaa`. Kildematerialet
  i `.idea/` navngir privatpersoner og er gitignorert. Reelle navn derfra skal **aldri**
  inn i en sporet fil — bruk anonymiserte plassholdere.

## Ponytail er alltid på

Ponytail-skillene ligger i repoet (`.claude/skills/ponytail*`), så de virker for hele gruppa
uten global installasjon. **Hver kodeoppgave starter med `ponytail` på nivå `full`**, uten at
noen trenger å be om det. Det gjelder også `bmad-build`, `bmad-build-auto` og subagenter som
skriver kode. En prompt til en slik subagent skal derfor si eksplisitt at den først skal
invokere `ponytail`. Den minste endringen som løser hele oppgaven vinner: gjenbruk kodebasen,
så standardbiblioteket, så en installert avhengighet, og bare til slutt ny kode.

- **Ponytail kutter aldri krav.** Alle FR-er og testbare konsekvenser i trinn 1 i PRD-en
  regnes som «det brukeren ba om». Det samme gjelder anonymiteten (FR-11 til FR-13),
  validering, feilhåndtering, sikkerhet, tilgjengelighet og testene sensor kjører. Ponytail
  kutter ting ingen ba om, ikke ting PRD-en krever.
- **Kjente snarveier** får en kommentar på formen `shortcut: <grensen>, <når den bør
  oppgraderes>`. Kjør `ponytail-debt` før trinn 1 fryses (1. des.) og før innlevering.
- **Review:** bruk `ponytail-review` på hver epic-branch før PR, i tillegg til
  `bmad-code-review`. Begge resultatene oppsummeres i PR-beskrivelsen.
- **Revisjon av hele repoet:** `ponytail-audit` før innlevering.
- Skru av bare når noen sier «stop ponytail» eller «normal mode» i økten. Det gjelder bare
  den økten.

Kopiene oppdateres med `cp -RL ~/.claude/skills/ponytail* .claude/skills/` (de globale er
symlenker), og endringen committes som en egen commit.

## Caveman for chat og rapporter

KI-arbeidet bruker mye tokens, og det meste går til lange svar og rapporter. Derfor:

- **Svar i chatten** er i `caveman`-stil (nivå `lite`): korte setninger, uten fyllord, men alle
  fakta, tall, stier og forbehold beholdes.
- **Subagenter** får beskjed i promptet om å invokere `caveman` og levere sluttrapporten i
  caveman-stil (nivå `full`). Det er rapporten tilbake til orkestratoren som blir kortere, ikke
  arbeidet.
- **Aldri i filer.** Alt som committes skrives som før: spec-er, review-seksjoner, wiki,
  README, BMAD-artefakter, promptarkiv og norske commit-meldinger i hele setninger. Det er
  vurderingsgrunnlag og skal kunne leses av sensor.
- `caveman-review` kan brukes for raske ekstra gjennomganger. Den erstatter ikke
  `bmad-code-review` og `ponytail-review` før PR.
- `caveman-commit` og `caveman-compress` er **bevisst utelatt**. Den første lager engelske
  Conventional Commits, og den andre skriver om dokumentfiler.
- Skru av med «stop caveman» eller «normal mode».

## RTK komprimerer kommandoutdata

[RTK](https://github.com/rtk-ai/rtk) er en CLI-proxy som filtrerer utdata fra kommandoer før de
når KI-ens kontekst: bare feil, sammendrag og det som betyr noe. Den virker som en
`PreToolUse`-hook (`rtk hook claude`) og gjelder også subagenter.

- **Installasjon er per maskin, ikke i repoet.** RTK er et kompilert program. Hver i gruppa
  installerer det selv og kjører `rtk init -g` én gang. Vi legger ikke hooken i
  `.claude/settings.json`, fordi den ville kjørt dobbelt hos dem som har den globalt og feilet
  hos dem som ikke har den.
- **Bruk kommandoer RTK kjenner igjen:** `npm run test` (ikke `npm test`, som slipper gjennom
  ufiltrert), `npm run test:e2e`, `npm run lint`, `npm run typecheck`, `npx vitest`,
  `npx playwright`, `git` og `gh`.
- Når utdata er tomme eller åpenbart feil, kjør `rtk proxy <kommando>` for å få rå utdata.
- `rtk gain` viser hvor mye som er spart.

## Design

Designkontrakten er `DESIGN.md` og `EXPERIENCE.md` i
`.docs/planning-artifacts/ux-designs/ux-Toppsvar-2026-11-21/`. De vinner over alt annet,
også over designskillene. To skills brukes på **alt UI-arbeid**, fra første skjerm i epic 1:

- **`impeccable`** er hovedskillen. Toppsvar er en app, så det er skillens *Operate*-modus som
  gjelder: presisjon og tilbakeholdenhet, ikke markedsføringsuttrykk. Les
  `reference/craft-floor.md` rett før hver UI-endring. Kjør `critique`/`audit` på hver epic
  med UI før PR, og `harden` for tomme, lastende og feilende tilstander. Den kjører i
  «Launcher unavailable»-modus (se `VENDORED.md`). Pek den på designkontrakten over når den ber
  om `PRODUCT.md`/`DESIGN.md`.
- **`design-taste-frontend`** (taste-skill) er laget for markedsføringssider. Vi bruker bare
  tekst- og typografidelene: `references/copy*.md` for mikrotekst uten KI-preg, og
  `library/type.json`/`palettes.json` som sjekk. **Husreglene om hero, bilder og «én seksjon
  per skjerm» gjelder ikke** for svarskjema, gjennomgang eller TV-visning.
- En prompt til en subagent som bygger UI, skal si at den bruker `impeccable` sammen med
  `ponytail`. Designskillene legger aldri til funksjoner som ikke står i PRD-en, og
  tilgjengelighet (WCAG 2.1 AA, NFR-6) kuttes aldri.

Skillene er vendret uten skript og hooks, fordi de lastet ned og kjørte en binær eller
Node-skript automatisk etter hver redigering. Se `VENDORED.md` i hver mappe før de oppdateres.

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
| `proposal.md` | Fjorårets proposal-format. **Ikke krevd i år**, men stack, datamodell og risiko er grunnlag for arkitekturen. Se [[proposal]] |
| `product-brief.md` | **Generert** av `scripts/sync-brief.sh` — brødteksten uten frontmatter. Rediger aldri direkte |
| `.docs/planning-artifacts/briefs/brief-Toppsvar-2026-09-14/` | Kanonisk fase 1: `brief.md`, `addendum.md`, `.memlog.md`, og faglærers `tilbakemelding-product-brief.md` |
| `_bmad/` | BMAD-rammeverket. `config.toml` er installer-styrt og skal ikke redigeres |
| `_bmad/custom/config.toml` | Fellesoppsett vi *skal* redigere, og som committes |
| `.claude/skills/bmad-*` | 39 BMAD-skills |
| `.claude/skills/ponytail*` | Ponytail-skills (MIT), vendret inn 2026-11-21. Se «Ponytail er alltid på» |
| `.claude/skills/caveman*` | Caveman-skills for korte svar, vendret inn 2026-11-22. Se «Caveman for chat og rapporter» |
| `.claude/skills/impeccable`, `.claude/skills/design-taste-frontend` | Designskills (Apache 2.0 / MIT), vendret inn 2026-11-21 uten skript og hooks. Se «Design» |
| `.claude/skills/sesjonslogg` | Sesjonslogg-skillen, se nederst |
| `.docs/planning-artifacts/prds/prd-Toppsvar-2026-10-12/` | Kanonisk fase 2: `prd.md`, `.memlog.md`, gjennomgangsfiler |
| `PRD.md` | **Generert** av `scripts/sync-brief.sh`, på samme måte som briefen. Rediger aldri direkte |
| `scripts/sync-brief.sh` | Genererer og verifiserer rot-kopiene av briefen og PRD-en |
| `scripts/scan-cohort.sh` | Ser hva resten av kullet har levert, og hvor |
| `prompting/` | Promptarkiv, én fil per økt under `fase-N-*/`: bevis på KI-styring i del 1, og råmateriale til refleksjonsrapporten |
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

Kjør den som siste steg før enhver commit som rører briefen eller PRD-en. `PRD.md` følger samme mønster. Scriptet stripper
frontmatteren, skriver `product-brief.md`, og feiler hvis brødteksten har kommet ut av
synk eller frontmatteren har sneket seg inn igjen. En kopi som har kommet ut av synk er
verre enn ingen kopi.

Ikke bruk symlink — sluttleveringen er en zip, og ikke alle zip-verktøy tar vare på dem.
Ikke rediger `product-brief.md` direkte; endringene blir overskrevet neste gang scriptet kjører.

## Er du usikker? Sjekk hva andre grupper gjorde

Det finnes **to** kursorganisasjoner, og **fjoråret er den nyttigste**:

| Org | Hva |
|-----|-----|
| `github.com/IBE160` | **Forrige studieår.** 54 repo med ferdige prosjekter, mange 100+ commits og komplett dokumentsett. **Primærreferanse** |
| `github.com/IBE160-2026` | Årets kull. 132 repo, men 114 er tomme stillas |

```bash
./scripts/scan-cohort.sh                      # fjorårets ferdige prosjekter (standard)
./scripts/scan-cohort.sh proposal             # hvor ligger proposal.md, og hos hvem?
./scripts/scan-cohort.sh 'prd|architecture'   # hva kalte de de neste dokumentene?
./scripts/scan-cohort.sh --org IBE160-2026    # årets kull i stedet
./scripts/scan-cohort.sh --all proposal       # ta med stillas-repoene også
```

**Tre feller — den tredje kostet oss en feilkonklusjon:**

1. **`gh search code --owner IBE160 ...` gir 0 treff på alt.** Ingen av organisasjonene er
   indeksert av GitHubs kodesøk. Scriptet går gjennom git-treet til hvert repo i stedet.
2. **Skill-mappene forurenser filnavnsøk.** `_bmad/`, `.bmad/`, `*/skills/` og
   `.gemini/commands/` holdes utenfor — ellers ser hver gruppe som bare installerte
   rammeverket ut som om de har skrevet brief, PRD og arkitektur, siden mappene heter
   `bmad-product-brief`, `bmad-prd` og `bmad-architecture`.
3. **Et kull som ikke har nådd en milepæl beviser ingenting om den milepælen.** Vi sjekket
   bare `IBE160-2026`, fant null `proposal.md`, og konkluderte med at leveransen ikke fantes.
   Fjoråret har en i ~48 av 54 repo, pluss en 100-poengs vurderingsrubrikk. **Sjekk alltid
   fjoråret først.** Se [[proposal]].

Vurder resultatene som bevis, ikke som fasit: én gruppe kan ha misforstått like gjerne som oss.
Emneansvarliges egne repo (`IBE160/beergame`, `IBE160-2026/beergame`) veier tyngst.

## Vurdering — vektene er kjent

| Del | Vekt |
|-----|-----:|
| **Prosjektkode og funksjonalitet** (del 1, gruppevis) | **70 %** |
| Refleksjonsrapport (del 2, gruppevis) | 30 % |

**Ingen muntlig eksamen.** Kilde: infosiden i Canvas og faglærers tilbakemelding 2026-10-06.
Tallene 30/40/30 som sto her før var fjorårets, og ble hentet fra `IBE160/beergame/.grading/`.
Lærdommen er den samme som med `proposal.md`: **fjorårets materiale viser format, ikke årets regler.**

Del 1 vurderes etter sju kriterier: prosess og KI-styring 30 %, funksjonalitet og omfang 20 %,
testing 15 %, design 10 %, arkitektur 10 %, README og kjørbarhet 10 %, ryddighet 5 %.
Se [[sensorveiledning-del-1]] **før hver fase**. Tre konsekvenser som lett glemmes:

- **Appen må kunne kjøres av sensor uten våre nøkler eller betalte kontoer.** Hele flyten skal
  virke uten modellnøkkel.
- **Commit-historikken er bevis på prosess.** Commit i mindre biter og jevnt over tid.
- *«Dokumentasjon må vise hvordan KI ble brukt, og hvordan studentene har kvalitetssikret koden.»*
  Legg prompter i `prompting/` underveis. Se [[refleksjonsrapport]] og [[ibe160]].

## Status

- [x] **Arbeidskrav — product brief** levert 2026-09-14 (frist 20. sept.). Godkjent med justeringer 2026-10-06
- [x] **Brief revidert** etter tilbakemeldingen 2026-10-12: trinn 1/2, testbare kriterier, poeng og dobbeltsvar avklart
- [x] `proposal.md` (fjorårets format, ikke krevd i år). Se [[proposal]]
- [x] **Fase 2 — `PRD.md`** (skill: `bmad-prd`), `status: final` 2026-10-13. 33 FR-er merket Stage 1/2. Se [[beslutninger]]
- [x] **Fase 3** 2026-11-21/22 på branchen `fase-3-planlegging`: UX, arkitektur, krysssjekk, impeccable-critique, 38 stories, sprintplan. Se [[plan-fase-3-og-4]]
- [ ] Fase 4 — implementering, én branch per epic ← **nå**. Epic 1–7 og story 8.1 merget til `main` 2026-11-23/24 (PR #2–#9 og #19, CI grønn på Node 22/26 og Postgres). SM-1-porten er åpen til de manuelle sjekkene er gjort. Pilot på https://toppsvar.vercel.app, med månedlig Vercel Cron
- [ ] Refleksjonsrapport

Fase 1 er satt til `status: final`. Samme status brukes på `addendum.md`, og skal brukes
på `PRD.md`, så vokabularet holdes konsistent (`draft` → `final`).
Sluttinnlevering: **GitHub-repo som zip + refleksjonsrapport, 5. desember.**

## Sesjonslogg

Når en oppgave eller økt avsluttes, før sluttoppsummeringen, bruk `sesjonslogg`-skillen: dokumenter Oppgave + Plan + Resultat + åpne punkter i `.logs/<bruker>/`, og før åpne punkter i `.logs/<bruker>/issues.md`. Skillen committer loggfila lokalt; push gjør du selv. Gruppens egne regler for commit og språk gjelder foran dette.
