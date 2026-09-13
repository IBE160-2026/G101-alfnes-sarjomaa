# BMAD-installasjon

> Installert 2026-09-14. BMAD Method **v6.12.0** — samme versjon som begge referanserepoene
> og emneansvarliges eget `beergame`-repo. Se [[repo-konvensjoner]].

## Kommandoen som ble kjørt

```bash
npx -y bmad-method@6.12.0 install \
  --directory /Users/sondrealfnes/Documents/Molde/G101-alfnes-sarjomaa \
  --modules bmm,cis \
  --channel stable \
  --tools claude-code \
  --no-shims \
  --user-name "G101" \
  --communication-language "English" \
  --document-output-language "English" \
  --output-folder ".docs" \
  --set core.project_name="Toppsvar" \
  --yes
```

Hvorfor hvert flagg:

| Flagg | Grunn |
|-------|-------|
| `--modules bmm,cis` | `core` legges til automatisk. `cis` er brainstorming/kreativitet — uke 43 heter «brainstorm + product manager» |
| `--tools claude-code` | **Påkrevd** sammen med `--yes`. Uten den feiler installasjonen hardt |
| `--no-shims` | Matcher referanserepoene. `--shims` ville lagt til ~14 utdaterte skills |
| `--output-folder ".docs"` | v6.12.0 defaulter til `_bmad-output`. Referanserepoene og `beergame` bruker `.docs` |
| `--set core.project_name=` | Ellers blir navnet mappenavnet `G101-alfnes-sarjomaa`, og det havner rett inn i kjøremappenavnet |
| `--channel stable` | Ga CIS v0.3.2 — nøyaktig samme som referanserepoene |

Resultat: 39 `bmad-*`-skills, `_bmad/` med 20 filer, tom `.docs/`.
De 7 eksisterende design-skillene under `.claude/skills/` ble **ikke** rørt — installereren
eier kun oppføringer med `bmad-`-prefiks.

## Rekkefølgen som reddet oss

`.gitignore` med BMAD-blokka **må være committet før** installasjonen. Referansegruppe G36
installerte før de hadde den, og har derfor `_bmad/config.user.toml` permanent sporet i git —
den ene fila kurset eksplisitt sier ikke skal committes. Git untracker ikke med tilbakevirkende
kraft. Vår `.gitignore` lå allerede i HEAD, så vi slapp unna.

## Feilen vi fant og fikset

`user_name` og `communication_language` er **user-scoped** nøkler. Installereren skriver dem
kun til `_bmad/config.user.toml` — som er gitignorert. På en fersk klone finnes ikke den fila,
og da skjer dette:

```
$ uv run _bmad/scripts/render_skill.py --project-root . --skill .claude/skills/bmad-build
HALT: missing config value `communication_language`
```

Reprodusert 2026-09-14 ved å flytte `config.user.toml` midlertidig vekk. Konsekvensen er at
`bmad-build` og `bmad-build-auto` ville vært ubrukelige for Daniel fra dag én — altså nøyaktig
i ukene 46–47 når de trengs. Samme feil ligger udiagnostisert i referansegruppe G23.

**Fiks:** verdiene er pinnet i `_bmad/custom/config.toml`, som *er* committet:

```toml
[core]
user_name = "G101"
communication_language = "English"
document_output_language = "English"
project_name = "Toppsvar"
output_folder = ".docs"
```

Verifisert: med `config.user.toml` fjernet renderer `bmad-build` nå uten feil.

## Regler for konfigurasjon

- **Ikke rediger `_bmad/config.toml`.** Headeren sier det selv: «Installer-managed.
  Regenerated on every install — treat as read-only.»
- Varige fellesvalg hører hjemme i `_bmad/custom/config.toml`.
- Personlige valg havner i `_bmad/config.user.toml` og `_bmad/custom/*.user.toml` — begge gitignorert.

## Verifisering etter installasjon

```bash
ls .claude/skills | grep -c '^bmad-'        # 39
git check-ignore -v _bmad/config.user.toml  # skal gi treff
git check-ignore -v _bmad/render            # skal gi treff
uv run _bmad/scripts/resolve_config.py --project-root . | head -20
```

## Angre

```bash
npx bmad-method@6.12.0 uninstall
```
