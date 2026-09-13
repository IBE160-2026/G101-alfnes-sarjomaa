# 2026-09-13 — Gjennomgang av kildemateriale og oppsett av wiki

## Gjort

- Lest alt i `.idea/main_brief/`: `task.md`, `template.md`, `product-brief-beergame.md`,
  `BMAD_Product_Brief_Student_Template.pdf` (12 s.), `Prosjektforslag_ Programmering med KI.pdf` (4 s.)
- Lest tidsplan-screenshot i `.idea/`
- Inspisert de to referanserepoene i `IBE160-2026` (begge offentlige)
- Bygget `wiki/` som Obsidian-lik vault, skrevet om `CLAUDE.md`

## Funn verdt å huske

1. **Prosjektforslag-PDF-en inneholder ingen frister eller vurderingskriterier** utover
   at «vanskelighetsgraden vil være en viktig del av sensuren». Alt om faser og leveranser
   kommer fra tidsplan-sliden og oppgaveteksten.
2. **BMAD legger ikke briefen i rota.** Referanserepoene har den i
   `.docs/planning-artifacts/briefs/brief-<navn>-<dato>/brief.md`. Oppgaveteksten sier
   `product-brief.md`. Uavklart — se [[beslutninger]].
3. **Referansenivået er ~890 ord, 8 seksjoner.** Ikke lengre.
4. **`.memlog.md`-mønsteret** fra G23 er verdt å kopiere: append-only logg med
   `(decision)`/`(assumption)`/`(change)`-tagger ved siden av briefen.
5. **Vi mangler `_bmad/`** selv om `.gitignore` allerede er forberedt for det.

## Neste

Skrive `product-brief.md` for [[produktide]] — fase 1. Se [[fase-1-product-brief]].
