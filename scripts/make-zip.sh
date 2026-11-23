#!/usr/bin/env bash
# Build the hand-in zip from the last commit. git archive takes only tracked files, so
# .env.local, .idea/, .data/, .next/ and node_modules/ never ship.
#
#   ./scripts/make-zip.sh               # G101-alfnes-sarjomaa.zip in the repository root
#   ./scripts/make-zip.sh /abs/out.zip  # or anywhere else
set -euo pipefail
name=G101-alfnes-sarjomaa
root=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
out=${1:-$root/$name.zip}
case $out in /*) ;; *) out=$PWD/$out ;; esac

if [ -n "$(git -C "$root" status --porcelain)" ]; then
  echo "warning: uncommitted changes are left out; the zip is built from HEAD" >&2
fi
# Run from the root: inside a subdirectory, git archive packs only that subdirectory.
git -C "$root" archive --format=zip --prefix="$name/" -o "$out" HEAD
echo "$out"
