# G101 — Claudeception

Gruppeprosjekt i **IBE160 Programmering med KI** ved Høgskolen i Molde, høsten 2026 (15 studiepoeng).

Repoet inneholder gruppens applikasjon og dokumentasjon av utvikling, testing og kvalitetssikring med KI.

## Produkt

**Toppsvar** — et Family Feud-aktig festspill der verten lager sitt eget spørreskjema om sin
egen gjeng. Deltakerne svarer anonymt i fritekst, en språkmodell grupperer svar som betyr det
samme til rangerte topp-lister, verten retter opp grupperingen, og gjengen spiller live fra én
delt skjerm. Et ferdig spørsmålssett følger med, så en gjeng kan spille med én gang uten å
vente på at et skjema fylles ut.

## Medlemmer

- Sondre Alfnes
- Daniel P Sarjomaa

## Leveranser

| Dokument | Fase | Hva det er |
|----------|------|------------|
| [`proposal.md`](proposal.md) | Uke 42 | Prosjektforslaget: omfang, teknologivalg, datamodell, tidsplan og risiko. Vurderes mot en egen 100-poengs rubrikk |
| [`product-brief.md`](product-brief.md) | Fase 1 (uke 43) | Produkthistorien: hva, hvorfor, hvem og hvordan — bevisst uten teknologi |
| `PRD.md` | Fase 2 (uke 43) | *Ikke skrevet ennå* |
| `solution-architecture.md`, `ux-design-specification.md` | Fase 3 (uke 44–45) | *Ikke skrevet ennå* |
| Refleksjonsrapport | Uke 48–49 | **40 % av karakteren.** Leveres 5. desember |

`proposal.md` og `product-brief.md` overlapper med vilje ikke: forslaget spesifiserer stack,
datamodell, milepæler og risiko, mens briefen holder seg til opplevelsen og utfallet.
Se [`wiki/kurs/proposal.md`](wiki/kurs/proposal.md).

`product-brief.md` er **generert** fra den kanoniske BMAD-artefakten i
`.docs/planning-artifacts/briefs/brief-Toppsvar-2026-09-14/`, som også inneholder
`addendum.md` og beslutningsloggen `.memlog.md`. Rediger kjøremappa, ikke rotfila, og kjør
`./scripts/sync-brief.sh`.

## Prosess

Prosjektet følger **BMAD Method v6.12.0**: Product Brief → PRD → UX + Arkitektur →
Epics & Stories → Implementering. Rammeverket ligger i `_bmad/` med 39 skills under
`.claude/skills/`.

Prompter arkiveres underveis i [`prompting/`](prompting/README.md) — refleksjonsrapporten
krever eksplisitt at alle stegene dokumenteres, og det lar seg ikke rekonstruere i etterkant.

## Dokumentasjon

All prosjektdokumentasjon ligger i [`wiki/`](wiki/index.md) — emnekrav og vurdering,
tidsplan, BMAD-faser, produktidé og beslutningslogg.

Nyttige skript:

```bash
./scripts/sync-brief.sh     # regenererer product-brief.md fra BMAD-kjøremappa
./scripts/scan-cohort.sh    # ser hva andre grupper i emnet har levert, og hvor
```
