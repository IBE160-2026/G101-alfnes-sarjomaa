#!/usr/bin/env bash
# Regenerate the root product-brief.md and PRD.md from the canonical BMAD artifacts.
#
# The assignment names the file "product-brief.md", but BMAD hardcodes "brief.md"
# inside a dated run folder. The run folder copy is canonical and the only one
# ever edited by hand.
#
# The two differ in exactly one way, on purpose: BMAD's product-brief skill
# requires YAML frontmatter (title/status/created/updated), but GitHub renders
# that frontmatter as a table at the top of the page. The delivered file is
# therefore body-only, which also matches the instructor's own exemplar
# (product-brief-beergame.md has no frontmatter).
#
# Run this as the last step before any commit that touches the brief or the PRD.
set -euo pipefail
cd "$(dirname "$0")/.."

# Canonical source -> delivered root file. The PRD follows the same pattern:
# BMAD writes prd.md in a dated run folder, the course expects PRD.md.
PAIRS=(
  ".docs/planning-artifacts/briefs/brief-Toppsvar-2026-09-14/brief.md:product-brief.md"
  ".docs/planning-artifacts/prds/prd-Toppsvar-2026-10-12/prd.md:PRD.md"
)

# Print everything after the closing frontmatter delimiter, minus leading blank
# lines. Counting stops at two, so a horizontal rule in the body survives.
body() { awk 'n>=2{print; next} /^---$/{n++}' "$1" | sed '/./,$!d'; }

for pair in "${PAIRS[@]}"; do
  SRC="${pair%%:*}" DST="${pair##*:}"
  [ -f "$SRC" ] || { echo "missing canonical source: $SRC" >&2; exit 1; }
  [ "$(head -1 "$SRC")" = "---" ] || { echo "FAIL $SRC has no frontmatter" >&2; exit 1; }

  body "$SRC" > "$DST"

  # Verify against an independent count: delivered file = source minus frontmatter.
  fm_end=$(grep -n '^---$' "$SRC" | sed -n 2p | cut -d: -f1)
  if diff -q <(tail -n +"$((fm_end + 1))" "$SRC" | sed '/./,$!d') "$DST" >/dev/null; then
    echo "OK  $DST body in sync"
  else
    echo "FAIL $DST body differs" >&2; exit 1
  fi
  if head -1 "$DST" | grep -q '^---$'; then
    echo "FAIL $DST still has frontmatter" >&2; exit 1
  fi
  echo "OK  $DST: no frontmatter, $(grep -c '^## ' "$DST") sections, $(wc -w < "$DST" | tr -d ' ') words"
done
