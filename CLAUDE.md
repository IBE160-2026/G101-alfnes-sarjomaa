# G101 — Claudeception

Gruppeprosjekt i **IBE160 Programmering med KI**, Høgskolen i Molde, høsten 2026.
Medlemmer: Sondre Alfnes, Daniel P Sarjomaa.

Prosjektet følger **BMAD Method** fase for fase. Dokumentasjonen i `./wiki` er
kanonisk kilde for hva som gjelder — les den før du gjetter.

## Arbeidsregler

- **Ikke commit.** Legg igjen endringene ustagede; Sondre leser gjennom og committer selv.
- **Jobb på `main`.** Ingen feature branches i dette repoet.
- **Bruk subagenter** for å holde hovedkonteksten ren. Ikke la orkestratoren lese mange
  små filer den ikke faktisk trenger — deleger lesing/søk og behold konklusjonen.
- **Dokumentér i `./wiki`.** Obsidian-lik vault med `[[wikilenker]]`. Nye notater skal
  lenkes inn fra `wiki/index.md`, ellers blir de aldri funnet igjen.
- **Skriv på norsk** i wiki, README og prosjektdokumentasjon. BMAD-artefaktene
  (`product-brief.md` m.fl.) følger malens engelske seksjonsoverskrifter — se
  `wiki/bmad/fase-1-product-brief.md`.

## Hvor ting ligger

| Sti | Innhold |
|-----|---------|
| `wiki/` | All prosjektdokumentasjon. Start i `wiki/index.md` |
| `wiki/kurs/` | Emnekrav, tidsplan, prosjektforslag |
| `wiki/bmad/` | BMAD-rammeverket, fasekrav, repo-konvensjoner |
| `wiki/prosjekt/` | Produktidé og beslutningslogg |
| `wiki/maler/` | Maler kopiert ut av `.idea/` |
| `.idea/main_brief/` | **Gitignorert.** Oppgavetekst, PDF-er, mal, eksempelbrief — kun lokalt |

Fordi `.idea/` er gitignorert: alt derfra som gruppa trenger, må oppsummeres eller
kopieres inn i `wiki/`.

## Status

Neste leveranse er **`product-brief.md` (fase 1, uke 43)**.
Krav, kvalitetssjekkliste og vanlige feil: `wiki/bmad/fase-1-product-brief.md`.
Full ukeplan og frister: `wiki/kurs/tidsplan.md`.

Sluttinnlevering: **GitHub-repo som zip + refleksjonsrapport, 5. desember.**

## Kjent gap

`.gitignore` inneholder allerede BMAD-blokka, men `_bmad/`-rammeverket og
`bmad-*`-skillene er **ikke installert** i repoet ennå. Referansegruppene kjører
BMAD v6.12.0 med alt sjekket inn. Se `wiki/bmad/repo-konvensjoner.md`.
