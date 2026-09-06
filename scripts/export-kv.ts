#!/usr/bin/env -S deno run --unstable-kv --allow-env --allow-net --allow-read --allow-write
//
// Export the Shrine of Tung Deno KV (users, tokens, chat, casino, shop, bans).
//
// Deno Deploy does NOT offer a "download database" button. The hosted KV lives
// behind the KV Connect protocol. You dump it from a machine that can reach
// api.deno.com (your laptop is fine) BEFORE the project is deleted.
//
// Step-by-step (production):
//   1. dash.deno.com -> Account -> Access Tokens -> New Access Token
//   2. Open the project -> KV tab -> copy the Database ID
//   3. export DENO_KV_ACCESS_TOKEN='ddp_…'
//      export DENO_KV_URL='https://api.deno.com/databases/<DATABASE_ID>/connect'
//   4. deno run --unstable-kv --allow-env --allow-net --allow-read --allow-write \
//        scripts/export-kv.ts shrine-kv.json
//
// USAGE_EXCEEDED on the *website* often still leaves this path working: the
// CLI talks to api.deno.com, not your isolate. If connect also fails, do not
// delete the project — wait for quota reset or ask Deno support. See KV.md.
//
// The JSON contains session tokens under ["tok", …]. Treat it like a password
// dump. Use --redact only for an inspectable copy you might share; that copy
// cannot restore logins.
//
import {
  APP_PREFIXES,
  expireInForKey,
  keyToJson,
  openKvFromEnv,
  parseArgs,
  prefixName,
  redactKey,
  type Snapshot,
  SNAPSHOT_FORMAT,
  SNAPSHOT_VERSION,
  type SnapshotEntry,
} from "./kv-shared.ts";

const USAGE = `export-kv.ts — dump shrine Deno KV to JSON

Usage:
  deno run --unstable-kv --allow-env --allow-net --allow-read --allow-write \\
    scripts/export-kv.ts [outfile.json] [--redact]

Env:
  DENO_KV_URL            remote connect URL or local sqlite path
  DENO_KV_PATH           local sqlite path (if DENO_KV_URL unset)
  DENO_KV_ACCESS_TOKEN   required for https://api.deno.com/… URLs

The snapshot is pretty-printed JSON. ["tok"] values are login secrets.
`;

if (import.meta.main) {
  const { flags, positional } = parseArgs(Deno.args);
  if (flags.help) {
    console.log(USAGE);
    Deno.exit(0);
  }

  const redact = Boolean(flags.redact);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = String(
    flags.out || positional[0] || `shrine-kv-${stamp}.json`,
  );

  const { kv, source } = await openKvFromEnv();
  try {
    const seen = new Set<string>();
    const entries: SnapshotEntry[] = [];
    const counts: Record<string, number> = {};

    // Walk every prefix server.ts uses, then a full-store pass so nothing is missed.
    const selectors: Deno.KvKey[] = [...APP_PREFIXES, []];
    for (const prefix of selectors) {
      for await (const e of kv.list({ prefix }, { consistency: "strong" })) {
        const id = JSON.stringify(keyToJson(e.key));
        if (seen.has(id)) continue;
        seen.add(id);
        const name = prefixName(e.key);
        counts[name] = (counts[name] || 0) + 1;
        const key = redact ? redactKey(e.key) : e.key;
        const expireIn = expireInForKey(e.key) ?? null;
        entries.push({
          key: keyToJson(key),
          value: e.value,
          expireIn,
        });
      }
    }

    const snapshot: Snapshot = {
      format: SNAPSHOT_FORMAT,
      version: SNAPSHOT_VERSION,
      exportedAt: new Date().toISOString(),
      source: redact ? `${source} (tokens redacted)` : source,
      warning:
        'This file contains session tokens under keys ["tok", …] unless --redact was used. Treat it as a secret. Do not commit it.',
      prefixes: APP_PREFIXES.map((p) => String(p[0])),
      counts,
      entries,
    };

    await Deno.writeTextFile(outPath, JSON.stringify(snapshot, null, 2) + "\n");
    console.log(JSON.stringify(
      {
        ok: true,
        out: outPath,
        source,
        redacted: redact,
        entries: entries.length,
        counts,
      },
      null,
      2,
    ));
    if (redact) {
      console.error(
        "Note: --redact snapshot cannot restore logins. Keep a non-redacted copy offline.",
      );
    }
  } finally {
    kv.close();
  }
}
