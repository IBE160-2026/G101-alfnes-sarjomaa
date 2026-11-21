# Vendret kopi — taste-skill (design-taste-frontend)

- Kilde: https://github.com/leonxlnx/taste-skill, commit `f6b7657` (2026-11-07), mappa `skills/taste-skill/`
- Lisens: MIT (`LICENSE`)
- Vendret inn 2026-11-21 av G101.

**Bevisst utelatt:** `scripts/` (Node-skript som starter Chrome og henter URL-er), `assets/`
(37 MB med bilder, ikoner og scener) og `hooks:`-blokka i frontmatter i `SKILL.md`, som kjørte
`scripts/gate.mjs` ved hver Stop med opptil 600 sekunders timeout. Ellers er SKILL.md uendret.
Det betyr at `checker`/`gate`/`shoot` og andre skriptkommandoer i SKILL.md ikke er tilgjengelige.

Skillen er laget for markedsføringssider. Se CLAUDE.md for hvordan vi bruker den på en app.
