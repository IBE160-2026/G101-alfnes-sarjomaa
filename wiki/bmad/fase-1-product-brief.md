# Fase 1 — Product Brief

> Leveranse uke 43. Se [[tidsplan]] og [[bmad-rammeverket]].
> Mal: [[product-brief-mal]]. Referanseeksempel: `.idea/main_brief/product-brief-beergame.md`.

Kortversjon: **hva, hvorfor, hvem og hvordan** — før detaljerte krav.

## De åtte seksjonene og spørsmålet hver av dem svarer på

| # | Seksjon | Spørsmålet den svarer på |
|---|---------|--------------------------|
| 1 | Executive Summary | Hva er dette, hvilket problem løser det, og hvorfor nå? |
| 2 | The Problem | Hvem har vondt, hva skjer i dag, og hva koster status quo? |
| 3 | The Solution | Hvilken opplevelse eller hvilket utfall endrer seg for brukeren? |
| 4 | What Makes This Different | Hvorfor denne tilnærmingen framfor alternativene? |
| 5 | Who This Serves | Hvem er primærbrukerne, og hva ser suksess ut som for dem? |
| 6 | Success Criteria | Hvilke målbare signaler sier at produktet virker? |
| 7 | Scope | Hva er innenfor v1, hva er eksplisitt utenfor? |
| 8 | Vision | Hva kan dette bli om 2–3 år hvis det lykkes? |

BMAD teller selv 7 seksjoner (Scope + Vision slås sammen), men malen bruker 8 overskrifter.

## Krav per seksjon

**Executive Summary** — 2–3 kompakte avsnitt. Skal kunne stå alene. Ingen uforklart sjargong.
Formel som fungerer:
> «For *[bruker]* lager vi *[produkt]* som hjelper dem å *[utfall]*, fordi i dag *[smerte]*.
> Nå er riktig tidspunkt fordi *[utløser/mulighet]*.»

Skriv denne **sist**. Ikke start med funksjoner — start med formål, problem og utfall.

**The Problem** — hvem opplever smerten, hva gjør de i dag, hva er frustrerende/tregt/dyrt/risikabelt,
og hva skjer hvis ingenting endres. Konkret, ikke generisk.

**The Solution** — hva bygges, hva kan brukerne gjøre annerledes, hvilket resultat forbedres.
BMAD er eksplisitt: hold denne på **opplevelse og utfall, ikke implementasjon**. Teknologivalg kommer senere.

**What Makes This Different** — sammenlign med brukerens *reelle* alternativer, inkludert
å gjøre ingenting, regneark, manuelt arbeid, konkurrenter, eksisterende system.

> **Ærlighetsregelen:** ikke finn opp en «moat». Hvis fordelen er bedre gjennomføring,
> en strammere arbeidsflyt, domenekunnskap eller fart — si det rett ut.

Nyttig tabell å fylle ut først:

| Alternativ i dag | Hvorfor brukerne tåler det | Hvorfor vår tilnærming er bedre |
|------------------|----------------------------|--------------------------------|
| | | |

**Who This Serves** — levende, men kort. Behov og atferd, ikke demografisk pynt.
Hvem føler problemet sterkest? Hva prøver de å få til?

**Success Criteria** — må kombinere **brukersuksess** og **produkt-/forretningssuksess**,
og bruke signaler man faktisk kan observere:

| Signal | Metrikk / bevis | Mål | Når måles det |
|--------|-----------------|-----|---------------|
| Brukerutfall | | | |
| Adopsjon / atferd | | | |
| Kvalitet / tillit | | | |
| Forretning / formål | | | |

**Scope** — et *grensedokument*, ikke en funksjonsliste. Ca. 5 punkter INN og 5 punkter UT,
på kapabilitetsnivå. Detaljerte krav hører hjemme i PRD.

> **Scope-testen:** hvis du kan fjerne et punkt og fortsatt teste kjerneverdien,
> hører det sannsynligvis ikke hjemme i versjon én.

**Vision** — horisont 2–3 år. NÅ (bevis kjerneverdien) → NESTE (lær, forfin, utvid) → 2–3 ÅR.
Inspirerende, men jordnært: visjonen skal vokse troverdig ut av problemet og v1-verdien.

## Kvalitetssjekk før innlevering

- [ ] **Klarhet** — leseren forstår produktet uten muntlig forklaring
- [ ] **Problembevis** — smerten er konkret, ikke generisk
- [ ] **Utfallsfokus** — løsningen beskriver endret opplevelse før teknologi
- [ ] **Differensiering** — alternativene er anerkjent ærlig
- [ ] **Brukere** — primærmålgruppa er spesifikk nok til å designe for
- [ ] **Suksess** — minst noen signaler er målbare
- [ ] **Scope** — versjon én har eksplisitte grenser
- [ ] **Visjon** — 2–3-årsretningen er ambisiøs, men troverdig
- [ ] **Lengde** — kan destilleres til ca. 1–2 sider

## Vanlige feil

- Skrive en funksjonsliste i stedet for en produkthistorie
- Bruke «alle» som målgruppe
- Påstå differensiering uten å sammenligne alternativer
- Suksesskriterier som ikke kan måles
- La versjon én inneholde hele veikartet
- Forklare arkitektur før behovet er bevist

## Arbeidsøkt på 20 minutter (BMADs egen oppskrift)

| Tid | Oppgave |
|-----|---------|
| 0–3 min | Brain dump: produkt, bruker, smerte, hvorfor nå |
| 3–7 min | Skriv Problem + Solution. Fjern implementasjonsdetaljer |
| 7–11 min | Navngi alternativer, differensiering og primærbruker |
| 11–15 min | Definer suksesssignaler og v1-grenser |
| 15–18 min | Skriv visjonen (2–3 år) |
| 18–20 min | Skriv Executive Summary **sist**, og kutt alt som ikke er nødvendig |

## Fagfellevurdering — 3 spørsmål

1. Hvilket problem tror du dette produktet løser?
2. Hva er den største antakelsen i briefen?
3. Hva ville du fjernet fra versjon én?
