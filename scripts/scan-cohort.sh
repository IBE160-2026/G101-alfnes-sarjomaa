#!/usr/bin/env bash
# Scan an IBE160 course organisation to see what other groups have actually built.
#
# TWO ORGANISATIONS, and the older one is the better reference:
#   IBE160-2026  this year's cohort. 132 repos, but almost all are bare scaffolds.
#   IBE160       LAST year's cohort. 54 repos of FINISHED projects, pushed Nov 2025 - Jan 2026,
#                many with 100+ commits and complete document sets. Default target.
#
# Why this exists: when it is unclear what a deliverable should be named, where it belongs,
# or whether it belongs in the repo at all, a finished cohort is the best available evidence.
# Checking only this year's cohort produced a wrong answer once: it showed zero proposal.md
# files, which looked like proof the deliverable did not exist. Last year's cohort has one in
# roughly 48 of 54 repos. A cohort that has not reached a milestone proves nothing about it.
#
# READING A FILE: use the BLOB api, not the contents api. The contents endpoint silently
# TRUNCATES large files - it returned 597 of 1928 lines for beergame/.grading/proposal.md,
# which made a 12719-word document look like 3269 words. No error, no warning.
#     sha=$(gh api "repos/$ORG/$repo/git/trees/HEAD?recursive=1" --jq '.tree[]|select(.path=="P")|.sha')
#     gh api "repos/$ORG/$repo/git/blobs/$sha" --jq '.content' | base64 -d
#
# IMPORTANT: `gh search code --owner IBE160-2026 ...` returns 0 results for EVERY query.
# The organisation is too new to be indexed by GitHub code search. Anyone trusting it will
# wrongly conclude the cohort has produced nothing. This script walks each repo's git tree
# instead, which is the only reliable method here.
#
# Most repos never get past the scaffold, so results are split into active and untouched.
# "Active" means the tree holds something beyond README / .gitignore / .gitattributes / LICENSE.
#
# Usage:
#   ./scripts/scan-cohort.sh                      overview of last year's finished projects
#   ./scripts/scan-cohort.sh proposal             paths matching "proposal" in last year's repos
#   ./scripts/scan-cohort.sh 'prd|architecture'   any extended regex
#   ./scripts/scan-cohort.sh --org IBE160-2026    this year's cohort instead
#   ./scripts/scan-cohort.sh --all proposal       include scaffold-only repos
set -uo pipefail

ORG="IBE160"          # last year's finished projects; --org IBE160-2026 for the current cohort
JOBS=10
INCLUDE_ALL=0
while :; do
  case "${1:-}" in
    --all) INCLUDE_ALL=1; shift ;;
    --org) ORG="${2:?--org needs a value}"; shift 2 ;;
    *) break ;;
  esac
done
PATTERN="${1:-}"

command -v gh >/dev/null || { echo "gh CLI not found" >&2; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "gh not authenticated - run: gh auth login" >&2; exit 1; }

SCAFFOLD='^(README\.md|\.gitignore|\.gitattributes|LICENSE)$'

scan_one() {
  local repo="$1" pattern="$2" include_all="$3" scaffold="$4" org="$5"
  local tree
  tree=$(gh api "repos/$org/$repo/git/trees/HEAD?recursive=1" \
           --jq '.tree[]? | select(.type=="blob") | .path' 2>/dev/null) || return 0
  [ -z "$tree" ] && return 0

  # Ignore vendored framework files when judging whether a group has done real work.
  local own
  own=$(printf '%s\n' "$tree" \
          | grep -vE '^(_bmad/|\.bmad/|\.[A-Za-z0-9_-]+/skills/|\.gemini/commands/|node_modules/)' || true)
  local meaningful
  meaningful=$(printf '%s\n' "$own" | grep -vE "$scaffold" | grep -v '^$' || true)

  local active=0
  [ -n "$meaningful" ] && active=1
  # A committed framework is itself a sign of real activity.
  printf '%s\n' "$tree" | grep -qE '^(_bmad|\.bmad)/' && active=1

  [ "$active" = 0 ] && [ "$include_all" = 0 ] && return 0

  # Search and markers both run against $own: vendored framework files are not the
  # group's own work, and .claude/skills/bmad-product-brief etc. would otherwise match
  # "brief", "prd" and "architecture" in every repo that merely installed BMAD.
  if [ -n "$pattern" ]; then
    local hits
    hits=$(printf '%s\n' "$own" | grep -iE "$pattern" || true)
    [ -z "$hits" ] && return 0
    printf '%s\n' "$hits" | sed "s#^#$repo\t#"
  else
    local marks=""
    printf '%s\n' "$tree" | grep -qE '^(_bmad|\.bmad)/' && marks="$marks bmad"
    printf '%s\n' "$own"  | grep -qE '^\.docs/'       && marks="$marks .docs"
    printf '%s\n' "$own"  | grep -qE '^_bmad-output/' && marks="$marks _bmad-output"
    printf '%s\n' "$own"  | grep -qiE 'brief'         && marks="$marks brief"
    printf '%s\n' "$own"  | grep -qiE 'prd'           && marks="$marks prd"
    printf '%s\n' "$own"  | grep -qiE 'architecture'  && marks="$marks arch"
    printf '%s\n' "$own"  | grep -qiE 'proposal'      && marks="$marks proposal"
    printf '%s\n' "$own"  | grep -qiE 'refleksjon'    && marks="$marks refleksjon"
    [ -z "$marks" ] && marks=" (no artifacts yet)"
    printf '%-46s %4s files %s\n' "$repo" "$(printf '%s\n' "$own" | grep -c . )" "$marks"
  fi
}
export -f scan_one

echo "Scanning $ORG (git trees; code search returns 0 for these orgs)..." >&2
repos=$(gh api "orgs/$ORG/repos" --paginate --jq '.[].name' 2>/dev/null)
total=$(printf '%s\n' "$repos" | grep -c .)
echo "$total repos found. Filtering to active ones..." >&2
echo >&2

printf '%s\n' "$repos" \
  | xargs -P "$JOBS" -I{} bash -c 'scan_one "$@"' _ {} "$PATTERN" "$INCLUDE_ALL" "$SCAFFOLD" "$ORG" \
  | sort

echo >&2
echo "Done. Repos that are scaffold-only are hidden unless --all is passed." >&2
