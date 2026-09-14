# Promptarkiv

Refleksjonsrapporten er **40 % av karakteren**, og malen sier eksplisitt:

> «Husk å lagre promptene deres! Inkluder ALLE stegene dere gjorde.»
> — `reflection-report-template.md`, seksjon 2.4 Utviklingsfaser

Dette kan ikke rekonstrueres ærlig i desember. Derfor arkiveres det underveis.

## Struktur

```
prompting/
  fase-1-analyse/      product brief, proposal
  fase-2-planlegging/  PRD
  fase-3-arkitektur/   solution architecture, UX
  fase-4-implementering/
```

Fjorårets beste gruppe på dette (`IBE160/SG-418`, muntlig-snitt 4,67) brukte
`prompting/fase_1/` og `prompting/fase_2/` med lagrede sesjoner som JSON.

## Hva som er verdt å lagre

- Prompten som faktisk ble brukt, ikke en pyntet versjon i etterkant
- Hva som gikk galt, og hva som måtte omformuleres — seksjon 3.3 i rapporten handler om
  KI-spesifikke utfordringer, og de eksemplene er gull
- Tilfeller der KI tok feil og vi oppdaget det. Rapportens seksjon 4.2 og 4.3 krever
  konkrete eksempler på begrensninger, ikke generelle betraktninger

## Personvern

Repoet er offentlig. Ingen ekte navn fra `.idea/`-kildematerialet, ingen API-nøkler,
ingen `@himolde.no`-adresser. Se [CLAUDE.md](../CLAUDE.md).
