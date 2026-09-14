# 2026-09-14 — BMAD installert og product brief skrevet

## Gjort

- Dyp gjennomgang av begge referanserepoene, BMADs egen product-brief-skill, og hele
  kullorganisasjonen `IBE160-2026` (132 repo).
- Installert BMAD Method v6.12.0 (`bmm` + `cis` v0.3.2, 39 skills). Se [[bmad-install]].
- Fant og fikset en konfigurasjonsfeil som ville ødelagt `bmad-build` for Daniel.
- Skrevet `brief.md` (1395 ord), `addendum.md` og `.memlog.md` (16 oppføringer).
- Kopiert briefen til `product-brief.md` i rota.

## Funn som endret planen

1. **Emneansvarliges beergame-eksempel er 1813 ord, ikke ~890.** Den forrige antakelsen var
   basert på G23 alene. G23 ligger i nedre ende av spennet; medianen i kullet er ~1040.
2. **G36 har ingen brief i det hele tatt.** Av de to repoene oppgaveteksten kaller «Example»
   er bare G23 et ekte gjennomført eksempel — og G23s ferdige versjon ligger på en umerget
   branch, ikke på `main`. Leser man bare `main` får man et utkast med konkurrentnavn,
   dollarpriser og umålbare suksesskriterier som alle ble strøket i siste runde.
3. **Filnavnstriden er ikke en smakssak.** Av 13 grupper med brief bruker de 8 som har
   `_bmad/` kjøremappa; de 5 som la fila i rota har ikke rammeverket. Derfor begge deler.
4. **`.docs` vs `_bmad-output`:** samme BMAD-versjon gir ulik standard avhengig av
   installasjonsdato. Vi tvang `.docs` for å matche referansene.
5. **GitHubs kodesøk er blindt for denne organisasjonen** — den er for ny til å være indeksert.
   Alle søk må gå via git-treet per repo.

## Arbeidsmåte

Briefen ble skrevet i fire uavhengige varianter med ulik innfallsvinkel — vertens arbeidsbyrde,
tillit og anonymitet, KI-grupperingen, og anledningen — og hver variant ble vurdert av tre
dommere: BMADs egen kvalitetssjekkliste, emnets rubrikk, og rent formatkrav. Vinneren
(«anledningen», 83,3) ble så syntetisert sammen med det beste fra de tre andre.

Synteseutkastet dro inn igjen et ekte fornavn fra det private kildeskjemaet. Det ble fanget
i etterkontrollen og anonymisert. Repoet er offentlig, så dette er verdt å sjekke hver gang.

## Senere samme dag

- Briefen utvidet med LAAJ-grupperingen og ferdige spørsmålssett: 1395 → 1628 ord.
- Oppdaget at forrige studieår ligger i en egen organisasjon, `github.com/IBE160`, med 54
  ferdige prosjekter. Det snudde konklusjonen om `proposal.md` — se [[proposal]].
- `proposal.md` skrevet (2626 ord) mot `case-description-template.md` og 100-poengsrubrikken.
- Funnet vektingen av emnet: kode 30 %, refleksjonsrapport 40 %, muntlig 30 %. Se [[ibe160]].
- `prompting/` opprettet, fordi rapporten krever lagrede prompter.

## Neste

`PRD.md` (fase 2, samme uke) med skillen `bmad-prd`. Språk- og seksjonsvalgene fra briefen
skal holde der også. Se [[tidsplan]].
