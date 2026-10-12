# Sensorveiledning del 1 — hvordan koden vurderes (70 %)

> Kilde: faglærers tilbakemelding på briefen, 2026-10-06,
> `.docs/planning-artifacts/briefs/brief-Toppsvar-2026-09-14/tilbakemelding-product-brief.md`.
> Tilbakemeldingen siterer kriteriene og vektene fra sensorveiledningen for del 1. Det er den
> **eneste offisielle rubrikken for årets kull** vi har. Se [[ibe160]].

Del 1 er 70 % av karakteren. Innenfor del 1:

| # | Kriterium | Vekt i del 1 | ≈ av total | Hva sensor ser etter |
|---|-----------|-------------:|-----------:|----------------------|
| 1 | **Prosess og KI-styring** | 30 % | 21 % | En sporbar vei fra brief → PRD → stories → kode. Jevn commit-historikk over tid |
| 2 | **Funksjonalitet og omfang** | 20 % | 14 % | En kjerneflyt som er ferdig og stabil, og nok innhold til å vise reell funksjonalitet |
| 3 | **Kvalitetssikring og testing** | 15 % | 10,5 % | Suksesskriterier og funksjoner som er konkrete nok til å bli testtilfeller, og testene selv |
| 4 | **Design og brukeropplevelse** | 10 % | 7 % | Tydelige brukere og flyter, gjerne med skisser av de viktigste skjermbildene |
| 5 | **Kodekvalitet og arkitektur** | 10 % | 7 % | Begrunnede teknologivalg som ikke er mer komplekse enn appen trenger |
| 6 | **README og kjørbarhet** | 10 % | 7 % | Kan kjøres lokalt etter README, **uten gruppas nøkler, betalte kontoer eller egen infrastruktur** |
| 7 | **Ryddighet i repoet** | 5 % | 3,5 % | Plan for hemmeligheter, testdata og dokumentasjon |

## Hva dette betyr for Toppsvar

**1. Commit oftere.** Faglærer påpekte at «nesten alt skjedde 13.–14. september». Sensor leser
commit-historikken som bevis på prosess. Arbeidsregelen om at Sondre committer selv står
fortsatt, men det bør skje i mindre biter og jevnere over tid.

**2. Trinn 1 først.** Kjerneflyten skal være stabil før trinn 2 påbegynnes. Inndelingen står i
den reviderte briefen og i PRD-en.

**3. Hver funksjon trenger et testbart kriterium.** Faglærer foreslo selv fire, og de står nå i
briefen:
- en deltaker kan gjenåpne og utvide svaret sitt via samme lenke
- etter at innsamlingen er lukket, avvises nye svar
- ingen tabell lagrer tidspunkt eller rekkefølge som kobler svar til token
- uten LLM-nøkkel kan verten gruppere manuelt og spille hele runden

Supplér med enhetstester for poeng, rangering og token.

**4. Skisser gjennomgangsflaten.** Den er den mest krevende flaten. Den hører hjemme i
UX-fasen (`ux-design-specification.md`).

**5. Én dommer-modul**, som brukes både til gruppering og til gjettematching.

**6. Demomodus uten nøkkel.** Sensor har ikke vår API-nøkkel. Hele flyten, også gjettematching,
må virke uten den. Det krever ferdig spørsmålssett, demodata og hurtigbufrede dommer-svar.
Dette er et arkitekturkrav, og det er nok det enkeltpunktet som er lettest å glemme og dyrest å
ettermontere.

**7. Bestem hvor data ligger.** ProtoQA-data og merkede testdata trenger en fast plass.
**Ingen svar om ekte personer committes** — housewarming-svarene blir værende i `.idea/`.

## Knyttet til fasene

| Kriterium | Hvor det avgjøres |
|-----------|-------------------|
| 1 Prosess | Hele veien: wiki, `prompting/`, `.memlog.md`, commits |
| 2 Omfang | Brief (trinn) → PRD (FR-prioritet) → epics |
| 3 Testing | PRD (akseptkriterier) → stories → kode + CI |
| 4 Design | `ux-design-specification.md` |
| 5 Arkitektur | `solution-architecture.md` |
| 6 Kjørbarhet | Arkitektur (demomodus) → README |
| 7 Ryddighet | Arkitektur (mappestruktur, `.env.example`) |
