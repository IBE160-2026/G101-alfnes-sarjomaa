# Tidsplan og leveranser

> Kilde: forelesningsslide (uke-for-uke-tabell) fra emneansvarlig.
> Se også [[bmad-rammeverket]] for hva hver fase innebærer.

## Ukeplan

| Uke | Fase / aktivitet | Leveranse |
|-----|------------------|-----------|
| 42 | Oppdater og forbedre `proposal.md` | `proposal.md` |
| 43 | **Fase 1 og 2: Analyse + planlegging** (brainstorm + product manager) | `product-brief.md`, `PRD.md` |
| 44 | **Fase 3: Løsningsarkitektur** (architect + ux/ui designer) | `solution-architecture.md`, `ux-specification.md`, `frontend-prompt.md` |
| 45 | **Fase 3: Løsningsarkitektur** (fortsetter) | samme som uke 44 |
| 46 | **Fase 4: Implementering** (syklus) | Epic-basert utvikling – JIT |
| 47 | **Fase 4: Implementering** (fortsetter) | FERDIG fungerende app |
| 48 | Refleksjonsrapport | Mal ligger i Canvas |
| 49 | Refleksjonsrapport | **Lever GitHub-repo som zip + rapport: 5. desember** |

## Status for G101

- [x] Uke 42 — `proposal.md` — **skrevet 2026-09-14** (2626 ord). Se [[proposal]]
- [x] Uke 43 — `product-brief.md` ← **ferdig 2026-09-14** (Toppsvar, 1628 ord)
- [ ] Uke 43 — `PRD.md` ← *vi er her* (skill: `bmad-prd`)
- [ ] Uke 44–45 — `solution-architecture.md`, `ux-design-specification.md`, `frontend-prompt.md`
- [ ] Uke 46–47 — implementering
- [ ] Uke 48–49 — refleksjonsrapport + innlevering

## `proposal.md` — feilkonklusjon korrigert 2026-09-14

Her tok vi feil én gang, og korreksjonen er verdt å ha stående.

**Første konklusjon (feil):** ingen av de 132 repoene i `IBE160-2026` har en `proposal.md`,
altså er den ikke en reell repo-leveranse.

**Hva som manglet:** forrige studieår ligger i en annen organisasjon, `github.com/IBE160`.
Der har omtrent **48 av 54 repo** en `proposal.md`, stort sett i rota. Emneansvarlig har
til og med sin egen i `IBE160/beergame/.grading/proposal.md`, og det finnes en
**vurderingsrubrikk på 100 poeng** for den. Se [[proposal]].

**Hvorfor feilen oppsto:** årets kull har ikke kommet dit ennå — 114 av 132 repo er tomme
stillas. Fravær hos et kull som ikke har nådd milepælen er ikke bevis for noe.
Sjekk alltid fjoråret først, se [[kullet]].

**Konsekvens:** `proposal.md` ble skrevet 2026-09-14 og ligger i rota. Den er et annet
dokument enn briefen — den krever teknologistack, datamodell, tidsplan med milepæler og
risikovurdering, som briefen bevisst utelater. Briefen erstattet den altså aldri.

## Navn å merke seg fra fjoråret

- UX-dokumentet het **`ux-design-specification.md`** hos 25 av 26 sterke grupper, ikke
  `ux-specification.md` som sliden sier.
- **`frontend-prompt.md` finnes i 1 av 26 repo.** Nesten ingen presedens.
- Fjoråret la dokumenter i **`docs/`**, ikke `.docs/`. Vår `.docs/` kommer av BMAD v6.12s
  standard. Se [[kullet]].

## Merk

- Endelig innlevering er **GitHub-repo som zip + rapport**, frist **5. desember**.
- Alle fase-dokumenter skal ligge i repoet, ikke bare sluttproduktet — prosessen er en del av vurderingen.
