#!/usr/bin/env -S deno run --unstable-kv --allow-env --allow-net --allow-read --allow-write
//
// Restore a shrine-kv-snapshot JSON (from export-kv.ts) into a Deno KV store.
//
// Point a NEW host at the imported data:
//   • New Deno Deploy Classic project: set DENO_KV_URL to THAT project's
//     https://api.deno.com/databases/<NEW_ID>/connect and import. Deploy
//     server.ts as usual — Deno.openKv() on Deploy uses the project's KV.
//   • VPS / local Deno: import into an explicit sqlite file
//     (DENO_KV_URL=/var/lib/shrine/kv.sqlite). server.ts currently calls
//     Deno.openKv() with no path, so either run the server from a wrapper
//     that opens that file, or change the one line to:
//       const kv = await Deno.openKv(Deno.env.get("DENO_KV_URL") || undefined);
//
// expireIn is re-applied from the snapshot (same TTLs server.ts uses on
// write). Deno KV does not expose remaining TTL on list/get.
//
import {
  expireInForKey,
  jsonToKey,
  openKvFromEnv,
  parseArgs,
  prefixName,
  type Snapshot,
  SNAPSHOT_FORMAT,
} from "./kv-shared.ts";

const USAGE = `import-kv.ts — restore shrine Deno KV from JSON

Usage:
  deno run --unstable-kv --allow-env --allow-net --allow-read --allow-write \\
    scripts/import-kv.ts snapshot.json [--dry-run]

Env:
  DENO_KV_URL            destination connect URL or local sqlite path
  DENO_KV_PATH           local sqlite path (if DENO_KV_URL unset)
  DENO_KV_ACCESS_TOKEN   required for https://api.deno.com/… URLs
`;

if (import.meta.main) {
  const { flags, positional } = parseArgs(Deno.args);
  if (flags.help) {
    console.log(USAGE);
    Deno.exit(0);
  }

  const inPath = String(flags.in || positional[0] || "");
  if (!inPath) {
    console.error("usage: import-kv.ts <snapshot.json>");
    Deno.exit(2);
  }

  const raw = JSON.parse(await Deno.readTextFile(inPath));
  if (!raw || raw.format !== SNAPSHOT_FORMAT || !Array.isArray(raw.entries)) {
    throw new Error(
      `not a ${SNAPSHOT_FORMAT} file (got format=${raw?.format} version=${raw?.version})`,
    );
  }
  const snapshot = raw as Snapshot;

  const redactedTok = snapshot.entries.some((e) =>
    e.key[0] === "tok" && e.key[1] === "<redacted>"
  );
  if (redactedTok) {
    throw new Error(
      "this snapshot was exported with --redact; tokens are gone and logins cannot be restored",
    );
  }

  const { kv, source } = await openKvFromEnv();
  const dryRun = Boolean(flags["dry-run"]);
  const counts: Record<string, number> = {};
  let written = 0;

  try {
    for (const entry of snapshot.entries) {
      const key = jsonToKey(entry.key);
      const name = prefixName(key);
      counts[name] = (counts[name] || 0) + 1;
      const expireIn = entry.expireIn ?? expireInForKey(key);
      if (!dryRun) {
        if (expireIn != null) {
          await kv.set(key, entry.value, { expireIn });
        } else {
          await kv.set(key, entry.value);
        }
      }
      written++;
    }

    console.log(JSON.stringify(
      {
        ok: true,
        in: inPath,
        dest: source,
        dryRun,
        written,
        exportedAt: snapshot.exportedAt,
        counts,
      },
      null,
      2,
    ));
  } finally {
    kv.close();
  }
}
