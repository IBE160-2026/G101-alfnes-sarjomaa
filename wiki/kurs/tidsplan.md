# Tidsplan og leveranser

> Kilde: forelesningsslide (uke-for-uke-tabell) fra emneansvarlig.
> Se også [[bmad-rammeverket]] for hva hver fase innebærer.

## Ukeplan

| Uke | Fase / aktivitet | Leveranse |
|-----|------------------|-----------|
| 38 | **Arbeidskrav:** product brief i repoet, frist 20. sept. kl. 23:59, **senere flyttet til 27. sept.** | `product-brief.md` |
| 42 | Oppdater og forbedre `proposal.md` | `proposal.md` |
| 43 | **Fase 1 og 2: Analyse + planlegging** (brainstorm + product manager) | `product-brief.md`, `PRD.md` |
| 44 | **Fase 3: Løsningsarkitektur** (architect + ux/ui designer) | `solution-architecture.md`, `ux-specification.md`, `frontend-prompt.md` |
| 45 | **Fase 3: Løsningsarkitektur** (fortsetter) | samme som uke 44 |
| 46 | **Fase 4: Implementering** (syklus) | Epic-basert utvikling – JIT |
| 47 | **Fase 4: Implementering** (fortsetter) | FERDIG fungerende app |
| 48 | Refleksjonsrapport | Mal ligger i Canvas |
| 49 | Refleksjonsrapport | **Lever GitHub-repo som zip + rapport: 5. desember** |

## Status for G101

- [x] **Arbeidskrav** — product brief levert 2026-09-14, før fristen 20. sept. Godkjent med
  justeringer 2026-10-06. Se [[ibe160]]
- [x] `proposal.md` — skrevet 2026-09-14 (2626 ord). En ekstra leveranse i fjorårets format, ikke krevd i år. Se [[proposal]]
- [x] Brief revidert etter tilbakemeldingen — 2026-10-12 (trinn 1/2, testbare kriterier, poeng og dobbeltsvar avklart)
- [x] `PRD.md` — **ferdig 2026-10-13** (`status: final`), uke 42. Én uke foran sliden
- [x] Uke 44–45 — UX og arkitektur, ferdig 2026-11-22 (BMAD v6 kaller dem `DESIGN.md`/`EXPERIENCE.md` og `ARCHITECTURE-SPINE.md`)
- [ ] Uke 46–47 — implementering ← **nå** (epic 1–7 og story 8.1 merget 2026-11-23/24; SM-1 venter på manuelle sjekker)
- [ ] Uke 48–49 — refleksjonsrapport + innlevering

## Kullets faktiske tempo — vi ligger etter (per 2026-11-21)

Sliden over har én takt. Kunngjøringene i Canvas viser en annen, se [[kunngjoringer]]:

| Når | Hva faglærer ba om |
|-----|--------------------|
| 5. nov. | PRD ferdig |
| 12. nov. | Design og UX ferdig |
| 13.–16. nov. | Resten av planleggingen gjennomgått: arkitektur, epics og stories, sprintplanlegging |
| 17. nov. | Implementering, kjørt med `/goal` for lange oppgaver |

Vi var tre uker foran med PRD-en (13. okt.), men har ikke begynt på UX og arkitektur. Kullet er
nå i implementering. **Det er to uker til innleveringen 5. des.** Planleggingen som gjenstår
(UX, arkitektur, epics og sprintplan) må gå raskt, slik at implementeringen får mest tid.
Kode og funksjonalitet er 70 % av karakteren.

## Gjennomføringsplanen i Canvas er en leseplan

Siden «Gjennomføringsplan» (lagt ut 19. sep.) fordeler læreboka *Agentic Programming with
Claude Code* og oppgaveboka over uke 35–47, med 2–3 timer i uka. Den sier ingenting om
leveranser utover dette:

| Uke | Bokdel |
|-----|--------|
| 35–41 | Del I, teori: verktøy, BMAD, agentisk programmering, kontekst og MCP |
| 42 | Del II: oppsett av prosjektet, med beergame, MVP og stack (kap. 5–7) |
| 43 | Del III: BMAD-rollene, analytiker → PM → UX → arkitekt → epics og readiness gate (kap. 8–12) |
| 44 | Del IV: utviklingssyklusen, med sprint planning, stories, dev-agent, code review og correct course (kap. 13–17) |
| 45 | **Prosjektuke**: «del II–IV skal være ferdig og rapporten leveres». Ingen ny lesing |
| 46 | Del V: DevOps, IaC og containere, CI/CD med GitHub Actions, overvåking, produksjon (kap. 18–22) |
| 47 | Del VI: retrospektiv og etikk (kap. 23–24) |

Kapitlene i del III og IV er ment som oppslagsverk mens prosjektet kjøres. Kap. 17.5 dekker
`bmad-quick-dev` og `bmad-dev-auto`, og kap. 20 dekker CI med GitHub Actions. Begge er nyttige
i fase 4.

«Rapporten leveres» i uke 45 stemmer ikke med fristen 5. des. som står alle andre steder. Det
er trolig bokplanens egen takt. Vi har ikke spurt faglærer om det.

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
