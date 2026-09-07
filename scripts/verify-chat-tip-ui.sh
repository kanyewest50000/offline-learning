#!/usr/bin/env bash
# Smoke-check that index.html wires tip profile + tip POST + login-key confirm.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
f="$ROOT/index.html"
need=(
  'profOverlay'
  'tipOverlay'
  'keyOverlay'
  '/tip/profile'
  'apiPost("/tip"'
  'openProfile'
  'sendTip'
  'confirmCopyKey'
  'your generosity is appealing in the eyes of tung tung god'
  'this key spends sahurs and opens every gate'
  'w.className="who"'
)
for n in "${need[@]}"; do
  if ! grep -F -q "$n" "$f"; then
    echo "MISSING: $n" >&2
    exit 1
  fi
done
echo "chat tip UI wiring OK"
