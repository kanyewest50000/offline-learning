#!/usr/bin/env bash
# Regenerate games/tung/chess-rules.js from the engine in server.ts.
#
# The browser game against the computer needs the rules in the browser, and the
# pit needs them on the server, and the two must not be allowed to drift — so
# one of them is generated from the other rather than maintained beside it.
# Run this after touching the chess engine; scripts/test-chess.ts checks it.
set -euo pipefail
cd "$(dirname "$0")/.."
python3 - <<'PY'
import io
src = io.open('server.ts', encoding='utf-8').read()
a = src.index("type ChessPos = {")
b = src.index("const CHESS_MOVE_MS")
io.open('/tmp/chess-src.ts', 'w', encoding='utf-8').write(
    src[a:b] +
    "\nexport { chessParse, chessFen, chessMoves, chessApply, chessSan, chessUci, "
    "chessFromUci, chessEnd, chessKey, chessInCheck, chessSq, CHESS_START };\n")
PY
npx --yes esbuild /tmp/chess-src.ts --format=iife --global-name=__CR \
  --target=es2017 --outfile=/tmp/chess-body.js >/dev/null
python3 - <<'PY'
import io
body = io.open('/tmp/chess-body.js', encoding='utf-8').read()
old = io.open('games/tung/chess-rules.js', encoding='utf-8').read()
hdr = old.split("*/", 1)[0] + "*/\n"
io.open('games/tung/chess-rules.js', 'w', encoding='utf-8').write(
    hdr + body + "\nwindow.ChessRules = __CR;\n")
print("games/tung/chess-rules.js regenerated")
PY
