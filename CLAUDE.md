# G101 — Claudeception

Gruppeprosjekt i **IBE160 Programmering med KI**, Høgskolen i Molde, høsten 2026.
Medlemmer: Sondre Alfnes, Daniel P Sarjomaa.
Produkt: **Toppsvar** — Family Feud-aktig festspill der verten lager sitt eget spørreskjema.

Prosjektet følger **BMAD Method v6.12.0** fase for fase. Dokumentasjonen i `./wiki` er
kanonisk kilde for hva som gjelder — les den før du gjetter.

## Arbeidsregler

- **Ikke commit.** Legg igjen endringene ustagede; Sondre leser gjennom og committer selv.
- **Jobb på `main`.** Ingen feature branches i dette repoet.
- **Bruk subagenter** for å holde hovedkonteksten ren. Ikke la orkestratoren lese mange
  små filer den ikke faktisk trenger — deleger lesing/søk og behold konklusjonen.
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
| `product-brief.md` | **Generert kopi** av briefen. Rediger aldri denne direkte |
| `.docs/planning-artifacts/briefs/brief-Toppsvar-2026-09-14/` | Kanonisk fase 1: `brief.md`, `addendum.md`, `.memlog.md` |
| `_bmad/` | BMAD-rammeverket. `config.toml` er installer-styrt og skal ikke redigeres |
| `_bmad/custom/config.toml` | Fellesoppsett vi *skal* redigere, og som committes |
| `.claude/skills/bmad-*` | 39 BMAD-skills |
| `wiki/` | All prosjektdokumentasjon. Start i `wiki/index.md` |
| `.idea/` | **Gitignorert.** Oppgavetekst, PDF-er, mal, eksempelbrief — kun lokalt |

### Briefen finnes to steder — med vilje

Oppgaveteksten krever filnavnet `product-brief.md`, men BMAD hardkoder `brief.md` inne i
en datert kjøremappe. Løsningen er begge deler, der kjøremappa er kanonisk:

```bash
cp ".docs/planning-artifacts/briefs/brief-Toppsvar-2026-09-14/brief.md" product-brief.md
diff -q ".docs/planning-artifacts/briefs/brief-Toppsvar-2026-09-14/brief.md" product-brief.md
```

Kjør `cp` som siste steg før enhver commit som rører briefen. En kopi som har kommet ut
av synk er verre enn ingen kopi. Ikke bruk symlink — sluttleveringen er en zip.

## Status

- [x] Uke 42 — `proposal.md`
- [x] **Fase 1 — `product-brief.md`** (Toppsvar, 1395 ord, `status: draft`)
- [ ] Fase 2 — `PRD.md` (skill: `bmad-prd`)
- [ ] Fase 3 — `solution-architecture.md`, `ux-specification.md`, `frontend-prompt.md`
- [ ] Fase 4 — implementering
- [ ] Refleksjonsrapport

Sett `status: final` i frontmatteren før innlevering, og kjør `cp`-en på nytt.
Sluttinnlevering: **GitHub-repo som zip + refleksjonsrapport, 5. desember.**
