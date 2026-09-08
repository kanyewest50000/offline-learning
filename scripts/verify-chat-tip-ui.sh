#!/usr/bin/env bash
# Smoke-check that the shrine wires tip profile + tip POST + login-key confirm.
# The overlays are markup (shrine/markup.js), the handlers are the chat client
# (shrine/chat.js), so grep across the whole shrine module set.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
files=("$ROOT"/assets/js/shrine/*.js)
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
  if ! grep -F -q -- "$n" "${files[@]}"; then
    echo "MISSING: $n" >&2
    exit 1
  fi
done
echo "chat tip UI wiring OK"
