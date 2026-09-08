#!/usr/bin/env bash
# Refresh the vendored gn-math game loader stubs in games/g/.
#
# Why this exists: each file in games/g/ is a ~20 KB loader stub that GitHub
# Pages serves from THIS origin, so the shrine iframe never fetches HTML from
# Deno or a gn-math CDN path. The stub then loads the real game (wasm/pck/js)
# from that game's own host (jsDelivr, statically, etc.) via <base href>.
#
# Pin: keep DEFAULT_COMMIT in lockstep with the commit baked into GAMES URLs
# in assets/js/shrine/games-catalog.js (gn-math/html/<commit>/...). Bump both
# together.
#
# Usage:
#   scripts/refresh-games.sh              # the pinned commit below
#   scripts/refresh-games.sh <ref>        # a specific SHA, branch, or tag
#   scripts/refresh-games.sh latest       # current gn-math/html main tip
#
# After it runs, review `git status games/g/` and commit. New game files are
# reported but NOT auto-added to the launcher — wire them into the GAMES array
# in assets/js/shrine/games-catalog.js by hand if you want them listed.
set -euo pipefail

REPO="gn-math/html"
# Must match the commit in the games-catalog.js GAMES URLs and any leftover docs.
DEFAULT_COMMIT="9b343737669dd2067dd6cd731859a99008772388"
REF="${1:-$DEFAULT_COMMIT}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/games/g"
CATALOG="$ROOT/assets/js/shrine/games-catalog.js"

if [ "$REF" = "latest" ]; then
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

# Inject a per-game <base href> when the upstream stub omitted one, so relative
# wasm/pck/js resolve against jsDelivr/statically for THAT game — never Deno,
# never this Pages origin.
python3 - "$DEST" "$REF" <<'PY'
import os, re, sys
from pathlib import Path

dest = Path(sys.argv[1])
commit = sys.argv[2]
fallback = f"https://cdn.jsdelivr.net/gh/gn-math/html@{commit}/"
# Full CDN asset URLs (directory = everything through the last slash).
CDN_RE = re.compile(
    r"https://(?:cdn\.jsdelivr\.net|cdn\.statically\.io|"
    r"rawcdn\.githack\.com|raw\.githack\.com)/[^\"'\s<>]+"
)
SKIP_MARKERS = (
    "googletagmanager.com",
    "google-analytics.com",
    "pagead2.googlesyndication",
    "googlesyndication.com",
    "gn-math.github.io",
    "deno.net",
)

def dir_prefix(urls):
    common = os.path.commonprefix(urls)
    slash = common.rfind("/")
    if slash < len("https://"):
        return None
    return common[: slash + 1]

def infer_base(text: str) -> str:
    m = re.search(
        r"""(?:BASE_URL|buildUrl|buildURL)\s*=\s*["'](https://[^"']+)["']""",
        text,
    )
    if m:
        url = m.group(1)
        if not url.endswith("/"):
            url += "/"
        if url.rstrip("/").endswith("Build"):
            url = url[: url.rstrip("/").rfind("/") + 1]
        return url
    prefixes = []
    for m in CDN_RE.finditer(text):
        p = m.group(0).split("?")[0].split("#")[0]
        if any(s in p for s in SKIP_MARKERS):
            continue
        # Incomplete template leftovers like .../repo@ or ${hash}
        if p.rstrip("/").endswith("@") or "${" in p:
            continue
        if not p.endswith("/"):
            slash = p.rfind("/")
            if slash < len("https://"):
                continue
            p = p[: slash + 1]
        prefixes.append(p)
    if not prefixes:
        return fallback
    # Mixed jsdelivr + githack URLs share only "https://". Prefer jsdelivr
    # (then statically, then githack) and take the deepest common folder.
    for needle in ("cdn.jsdelivr.net", "cdn.statically.io", "githack.com"):
        group = [p for p in prefixes if needle in p]
        picked = dir_prefix(group) if group else None
        if picked:
            return picked
    return fallback

def inject(html: str, href: str) -> str:
    if re.search(r"<base\b", html, re.I):
        return html
    tag = f'<base href="{href}">'
    low = html.lower()
    hi = low.find("<head")
    if hi >= 0:
        close = html.find(">", hi)
        if close >= 0:
            return html[: close + 1] + tag + html[close + 1 :]
    ht = low.find("<html")
    if ht >= 0:
        close = html.find(">", ht)
        if close >= 0:
            return html[: close + 1] + tag + html[close + 1 :]
    return tag + html

injected = 0
kept = 0
inferred = 0
fell_back = 0
for path in sorted(dest.glob("*.html")):
    raw = path.read_bytes()
    text = raw.decode("utf-8", "replace")
    if re.search(r"<base\b", text, re.I):
        kept += 1
        continue
    href = infer_base(text)
    if href == fallback:
        fell_back += 1
    else:
        inferred += 1
    out = inject(text, href)
    path.write_bytes(out.encode("utf-8"))
    injected += 1

print(f"base href: kept {kept} existing; injected {injected} "
      f"(inferred {inferred}, gn-math/html fallback {fell_back})")
PY

after="$(cd "$DEST" && ls ./*.html 2>/dev/null | xargs -n1 basename | sort)"

total="$(printf '%s\n' "$after" | grep -c . || true)"
echo "stubs now: $total ($(du -sh "$DEST" | cut -f1))"

added="$(comm -13 <(printf '%s\n' "$before") <(printf '%s\n' "$after") || true)"
removed="$(comm -23 <(printf '%s\n' "$before") <(printf '%s\n' "$after") || true)"
n_added="$(printf '%s\n' "$added" | grep -c . || true)"
n_removed="$(printf '%s\n' "$removed" | grep -c . || true)"
echo "changed vs previous games/g/: +$n_added / -$n_removed"
[ "$n_added" -gt 0 ] && { echo "new stub files (not yet in the GAMES list in games-catalog.js):"; printf '%s\n' "$added" | sed 's/^/  /'; }

# Safety: warn if any game the launcher references no longer has a stub.
if [ -f "$CATALOG" ]; then
  referenced="$(grep -oE 'gn-math/html/[0-9a-f]+/[^"]+\.html' "$CATALOG" \
    | sed -E 's#.*/##' | sort -u || true)"
  missing="$(comm -23 <(printf '%s\n' "$referenced") <(printf '%s\n' "$after") || true)"
  n_missing="$(printf '%s\n' "$missing" | grep -c . || true)"
  if [ "$n_missing" -gt 0 ]; then
    echo "WARNING: $n_missing game(s) referenced by the catalog no longer have a stub:" >&2
    printf '%s\n' "$missing" | sed 's/^/  /' >&2
  fi
fi

echo "Done. Review 'git status games/g/' and commit."
echo "Pinned default: $DEFAULT_COMMIT"
