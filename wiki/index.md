# G101 Wiki

Prosjektwiki for **G101 — Claudeception**, IBE160 Programmering med KI, HiMolde høsten 2026.
Obsidian-stil: notater lenkes med `[[wikilenker]]`.

## Start her

- [[ibe160]] — hva emnet krever, og vektingen: **kode 70 %, rapport 30 %, ingen muntlig**
- [[sensorveiledning-del-1]] — de sju kriteriene koden vurderes etter. **Les før hver fase**
- [[tidsplan]] — ukeplan, faser og frister **(neste: UX og arkitektur)**
- [[produktide]] — hva vi bygger: **Toppsvar**

## Leveranser

- `product-brief.md` — fase 1 og **arbeidskravet**. Levert 2026-09-14, godkjent med justeringer 2026-10-06, revidert 2026-10-12. Kanonisk kopi i `.docs/planning-artifacts/briefs/brief-Toppsvar-2026-09-14/`, sammen med `tilbakemelding-product-brief.md` fra faglærer
- `proposal.md` — fjorårets format, skrevet 2026-09-14. Ikke krevd i år, men grunnlag for arkitekturen. Se [[proposal]]
- `PRD.md` — fase 2, **ferdig 2026-10-13** (`status: final`). Kanonisk i `.docs/planning-artifacts/prds/prd-Toppsvar-2026-10-12/`, generert til rota av `sync-brief.sh`
- Fase 3 — UX og arkitektur, **neste**

## BMAD

- [[bmad-rammeverket]] — planleggingsstien og bærende prinsipp
- [[fase-1-product-brief]] — krav, kvalitetssjekk og arbeidsøkt for fase 1
- [[repo-konvensjoner]] — hvor artefaktene skal ligge, hva som sjekkes inn
- [[bmad-install]] — hvordan rammeverket ble installert, og feilen vi fikset

## Prosjekt

- [[produktide]] — Family Feud med egne spørreskjema
- [[beslutninger]] — beslutningslogg (hva, hvorfor, hva ble valgt bort)
- [[prosjektforslag]] — de 8 forslagene fra emneansvarlig (vi valgte egen idé)
- [[proposal]] — `proposal.md` og fjorårets 100-poengs rubrikk (ikke gjeldende i år)
- [[refleksjonsrapport]] — 30 % av karakteren, gruppevis, og hvorfor promptarkivet fortsatt teller
- [[kullet]] — hva de andre gruppene faktisk har levert, og hvordan man sjekker det

## Logg

- [[2026-09-13-oppstart-dokumentasjon]]
- [[2026-09-14-bmad-og-product-brief]]
- [[2026-10-12-tilbakemelding-og-prd]] — faglærers tilbakemelding, korrigert vekting, revidert brief, PRD-utkast

## Maler

- [[product-brief-mal]] — BMADs product brief-mal

## Mappestruktur

```
wiki/
  index.md          ← denne fila
  kurs/             emneinfo, tidsplan, prosjektforslag
  bmad/             rammeverket og repo-konvensjoner
  prosjekt/         produktidé og beslutninger
  maler/            maler kopiert ut av .idea/ (som er gitignorert)
  logg/             arbeidslogg per økt
```

## Merk om `.idea/`

Kildematerialet (`.idea/main_brief/`: oppgavetekst, PDF-er, mal, eksempelbrief) er
**gitignorert** og finnes bare lokalt hos Sondre. Alt som må deles med gruppa er derfor
oppsummert eller kopiert inn hit.
