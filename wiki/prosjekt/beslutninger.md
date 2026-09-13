# Beslutningslogg

Kort logg over valg som er tatt, hvorfor, og hva alternativet var.
Nyeste øverst. Én rad = én beslutning som er vanskelig å utlede fra koden alene.

| Dato | Beslutning | Begrunnelse | Alternativ som ble valgt bort |
|------|------------|-------------|-------------------------------|
| 2026-09-13 | Jobber kun på `main` — ingen feature branches | Liten gruppe, dokumenttunge leveranser; enklere historikk | Per-person feature branches (som referansegruppe G23 bruker) |
| 2026-09-13 | Produktidé: Family Feud med egne spørreskjema | Bygger på en reell, testet brukeropplevelse (innflyttingsfest); tydelig smertepunkt i dagens manuelle Google Forms-flyt | — |
| 2026-09-13 | Dokumentasjon i `./wiki` som Obsidian-lik vault | Lett å finne fram i, `[[wikilenker]]` binder notatene sammen, ingen verktøy-lås | Alt i README, eller `docs/`-mappe uten intern lenking |

## Åpne spørsmål

| Spørsmål | Hvorfor det haster |
|----------|--------------------|
| Skal briefen ligge i rota som `product-brief.md`, eller følge BMAD-konvensjonen `.docs/planning-artifacts/briefs/brief-<navn>-<dato>/brief.md`? | Oppgaveteksten og verktøyet sier ulike ting. Må avklares før fase 1 leveres. Se [[repo-konvensjoner]] |
| Skal `_bmad/` + `bmad-*`-skillene installeres og committes, slik referansegruppene gjør? | `.gitignore` er allerede forberedt, men rammeverket mangler |
| Har vi bedt emneansvarlig om tilbakemelding på den egendefinerte idéen? | Staben tilbyr dette eksplisitt for egne prosjekter. Se [[ibe160]] |

## Mal for nye rader

```
| ÅÅÅÅ-MM-DD | <hva ble bestemt> | <hvorfor> | <hva ble valgt bort> |
```
