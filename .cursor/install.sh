#!/usr/bin/env bash
# Idempotent Cloud Agent bootstrap for the offline-learning / Shrine of Tung repo.
# Installs the Deno runtime (needed by server.ts and the static file server) and
# warms the dependency cache so the first boot of each terminal is fast.
set -euo pipefail

DENO_BIN="$HOME/.deno/bin/deno"

if [ ! -x "$DENO_BIN" ]; then
  curl -fsSL https://deno.land/install.sh | sh -s -- -y
fi

export PATH="$HOME/.deno/bin:$PATH"

# server.ts uses only built-in Deno APIs; caching still surfaces any errors early.
deno cache server.ts

# Pre-fetch the std file-server used to serve the static site.
deno cache jsr:@std/http/file-server

deno --version
