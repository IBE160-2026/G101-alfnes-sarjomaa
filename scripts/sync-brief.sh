#!/usr/bin/env bash
# Regenerate the root product-brief.md from the canonical BMAD brief.
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
# Run this as the last step before any commit that touches the brief.
set -euo pipefail
cd "$(dirname "$0")/.."

SRC=".docs/planning-artifacts/briefs/brief-Toppsvar-2026-09-14/brief.md"
DST="product-brief.md"

[ -f "$SRC" ] || { echo "missing canonical brief: $SRC" >&2; exit 1; }

# Drop everything up to and including the closing frontmatter delimiter,
# then trim the leading blank lines that leaves behind.
awk 'n==2; /^---$/{n++}' "$SRC" | sed '/./,$!d' > "$DST"

# Verify: body must match, and the delivered file must carry no frontmatter.
if diff -q <(awk 'n==2; /^---$/{n++}' "$SRC" | sed '/./,$!d') "$DST" >/dev/null; then
  echo "OK  body in sync"
else
  echo "FAIL body differs" >&2; exit 1
fi

if head -1 "$DST" | grep -q '^---$'; then
  echo "FAIL $DST still has frontmatter" >&2; exit 1
else
  echo "OK  $DST has no frontmatter"
fi

echo "OK  $(grep -c '^## ' "$DST") sections, $(wc -w < "$DST" | tr -d ' ') words"
