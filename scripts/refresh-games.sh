#!/usr/bin/env bash
# Refresh the vendored gn-math game loader stubs in games/g/.
#
# Why this exists: each file in games/g/ is a ~20 KB loader stub that the site
# serves from its OWN origin, so no game is ever fetched from a gn-math CDN path
# (which some content filters flag). The stub then loads the real game from that
# game's own host (jsDelivr, etc.) via its built-in <base>. This script
# re-downloads those stubs from gn-math/html at a chosen commit so you can pick
# up loader fixes or newer games.
#
# Usage:
#   scripts/refresh-games.sh          # latest commit on gn-math/html's main
#   scripts/refresh-games.sh <ref>    # a specific commit SHA, branch, or tag
#
# After it runs, review `git status games/g/` and commit. New game files are
# reported but NOT auto-added to the launcher — wire them into the GAMES array
# in index.html by hand if you want them listed.
set -euo pipefail

REPO="gn-math/html"
REF="${1:-}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/games/g"

# Resolve the latest default-branch commit when no ref is given.
if [ -z "$REF" ]; then
  REF="$(curl -fsSL "https://api.github.com/repos/$REPO/commits/main" \
    | grep -oE '"sha"[[:space:]]*:[[:space:]]*"[0-9a-f]{40}"' | head -1 \
    | grep -oE '[0-9a-f]{40}')"
fi
[ -n "$REF" ] || { echo "error: could not resolve a commit ref for $REPO" >&2; exit 1; }
echo "Refreshing $REPO stubs at $REF"
echo "  -> $DEST"

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT

# One request: the repo tarball at the pinned ref.
curl -fsSL "https://codeload.github.com/$REPO/tar.gz/$REF" -o "$TMP/html.tgz"
mkdir -p "$TMP/x"
tar xzf "$TMP/html.tgz" -C "$TMP/x" --strip-components=1

# Refuse to sync from an empty/garbage download so a bad fetch can't wipe games/g/.
new_count="$(find "$TMP/x" -maxdepth 1 -name '*.html' | wc -l | tr -d ' ')"
[ "$new_count" -gt 0 ] || { echo "error: no .html stubs in download; leaving games/g/ untouched" >&2; exit 1; }

mkdir -p "$DEST"
before="$(cd "$DEST" && ls ./*.html 2>/dev/null | xargs -n1 basename 2>/dev/null | sort || true)"

# Replace the stub set with the freshly downloaded one.
find "$DEST" -maxdepth 1 -name '*.html' -delete
cp "$TMP"/x/*.html "$DEST"/
after="$(cd "$DEST" && ls ./*.html 2>/dev/null | xargs -n1 basename | sort)"

total="$(printf '%s\n' "$after" | grep -c . || true)"
echo "stubs now: $total ($(du -sh "$DEST" | cut -f1))"

added="$(comm -13 <(printf '%s\n' "$before") <(printf '%s\n' "$after") || true)"
removed="$(comm -23 <(printf '%s\n' "$before") <(printf '%s\n' "$after") || true)"
n_added="$(printf '%s\n' "$added" | grep -c . || true)"
n_removed="$(printf '%s\n' "$removed" | grep -c . || true)"
echo "changed vs previous games/g/: +$n_added / -$n_removed"
[ "$n_added" -gt 0 ] && { echo "new stub files (not yet in the GAMES list in index.html):"; printf '%s\n' "$added" | sed 's/^/  /'; }

# Safety: warn if any game the launcher references no longer has a stub.
if [ -f "$ROOT/index.html" ]; then
  referenced="$(grep -oE 'gn-math/html/[0-9a-f]+/[^"]+\.html' "$ROOT/index.html" \
    | sed -E 's#.*/##' | sort -u || true)"
  missing="$(comm -23 <(printf '%s\n' "$referenced") <(printf '%s\n' "$after") || true)"
  n_missing="$(printf '%s\n' "$missing" | grep -c . || true)"
  if [ "$n_missing" -gt 0 ]; then
    echo "WARNING: $n_missing game(s) referenced by index.html no longer have a stub:" >&2
    printf '%s\n' "$missing" | sed 's/^/  /' >&2
  fi
fi

echo "Done. Review 'git status games/g/' and commit."
