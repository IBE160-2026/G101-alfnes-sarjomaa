# Fase 3: UX, arkitektur, epics og sprintplan

Planleggingsfasen i BMAD, fra ferdig PRD til en sprintplan som er klar for implementering. Ingen kode.

## Innhold
- **UX** (`bmad-ux`, headless): `DESIGN.md` og `EXPERIENCE.md` med ASCII-wireframes og en statisk mockup av gjennomgang, svarskjema og TV-visning (`.docs/planning-artifacts/ux-designs/ux-Toppsvar-2026-11-21/`).
- **Arkitektur** (`bmad-architecture`, headless med full reviewer-gate og seks gjennomganger i `reviews/`): `ARCHITECTURE-SPINE.md`, AD-1 til AD-24. Next.js 16, PGlite lokalt og Postgres ved deploy, Drizzle, scrypt-innlogging, én dommer med live-, replay- og mock-leverandør.
- **Epics og stories:** 34 stories i trinn 1 fordelt på 7 epics, og en trinn 2-epic som venter på SM-1. Alle FR-er i trinn 1 er dekket, og testtype er oppgitt per akseptkriterium.
- **Sprintplan** (`bmad-sprint-planning`): readiness-gaten besto uten funn, og `sprint-status.yaml` er laget.

## Kvalitetssikring og KI-korreksjoner
- **Arkitekturen fant en feil i vår egen PRD:** etter FR-7 kunne verten lese svar før lukking ved å åpne en av lenkene sine, og det brøt FR-12. Vi snevret inn FR-7 til enheten som sendte svarene.
- **Krysssjekk av UX, arkitektur og PRD**, som ble skrevet parallelt: 11 avvik måtte rettes og 3 var kosmetiske. Alle er rettet (`reviews/consistency-review-2026-11-21.md`).
- **`impeccable`-critique** av designet ga 29/40. 12 funn ble tatt inn, blant annet at TV-visningen ikke fikk plass i 1080 px, at lange svar ble kuttet, og at fokusringen var usynlig. Fontbyttet ble avvist.
- **Dommeren** ble byttet til OpenRouter med `deepseek/deepseek-v4.1-flash`, som er billigere og som gruppa har nøkkel til.

Promptene ligger i `prompting/fase-3-arkitektur/`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
