// Shared helpers for shrine Deno KV export / import.
// Prefix list is the complete key-space used by server.ts (verified 2026-09-06).

/** Every first-component prefix server.ts reads or writes. */
export const APP_PREFIXES: Deno.KvKey[] = [
  ["app"], // application records: id, username, application, status, ts, thread, banned, note, timeoutUntil
  ["name"], // lowercase username -> application id
  ["tok"], // session token -> application id   *** SECRETS ***
  ["seq"], // chat event counter (exact key ["seq"])
  ["ev"], // chat / react events
  ["cas"], // casino {bal, lastClaim}
  ["bj"], // in-progress blackjack
  ["mines"], // in-progress mines
  ["beef"], // in-progress beef / crash-chicken
  ["shopitem"], // shop catalog
];

// TTL values copied from server.ts. Deno.Kv list/get does not return remaining
// expireIn, so restore re-applies the same TTL the app would set on write.
const TTL_MS = 14 * 24 * 60 * 60 * 1000; // ["ev"]
const CAS_TTL = 400 * 24 * 60 * 60 * 1000; // ["cas"]
const GAME_TTL = 6 * 60 * 60 * 1000; // ["bj"] ["mines"] ["beef"]

export const SNAPSHOT_FORMAT = "shrine-kv-snapshot";
export const SNAPSHOT_VERSION = 1;

export type JsonKeyPart =
  | string
  | number
  | boolean
  | { t: "bigint"; v: string }
  | { t: "bytes"; v: string };

export type SnapshotEntry = {
  key: JsonKeyPart[];
  value: unknown;
  /** Milliseconds to pass as expireIn on restore, or null if the key does not expire. */
  expireIn: number | null;
};

export type Snapshot = {
  format: typeof SNAPSHOT_FORMAT;
  version: typeof SNAPSHOT_VERSION;
  exportedAt: string;
  source: string;
  warning: string;
  prefixes: string[];
  counts: Record<string, number>;
  entries: SnapshotEntry[];
};

export function prefixName(key: Deno.KvKey): string {
  return key.length === 0 ? "(root)" : String(key[0]);
}

export function expireInForKey(key: Deno.KvKey): number | undefined {
  const p = key[0];
  if (p === "ev") return TTL_MS;
  if (p === "cas") return CAS_TTL;
  if (p === "bj" || p === "mines" || p === "beef") return GAME_TTL;
  return undefined;
}

export function keyToJson(key: Deno.KvKey): JsonKeyPart[] {
  return key.map((part) => {
    if (typeof part === "bigint") return { t: "bigint", v: part.toString() };
    if (part instanceof Uint8Array) {
      return { t: "bytes", v: btoa(String.fromCharCode(...part)) };
    }
    if (
      typeof part === "string" || typeof part === "number" ||
      typeof part === "boolean"
    ) {
      return part;
    }
    throw new Error(`unsupported key part: ${typeof part}`);
  });
}

export function jsonToKey(parts: JsonKeyPart[]): Deno.KvKey {
  return parts.map((part) => {
    if (part && typeof part === "object" && "t" in part) {
      if (part.t === "bigint") return BigInt(part.v);
      if (part.t === "bytes") {
        const bin = atob(part.v);
        const out = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
        return out;
      }
    }
    return part as string | number | boolean;
  });
}

export function redactKey(key: Deno.KvKey): Deno.KvKey {
  if (key[0] === "tok" && key.length >= 2) {
    return ["tok", "<redacted>"];
  }
  return key;
}

/**
 * Open KV from env:
 *   DENO_KV_URL  remote https://api.deno.com/databases/<id>/connect
 *                or a local sqlite path
 *   DENO_KV_PATH alias for a local sqlite path (ignored if DENO_KV_URL is set)
 *
 * Remote Deploy URLs require DENO_KV_ACCESS_TOKEN (a dash.deno.com personal
 * access token). There is no "download KV" button on the dashboard.
 */
export async function openKvFromEnv(): Promise<
  { kv: Deno.Kv; source: string }
> {
  const url = (Deno.env.get("DENO_KV_URL") || "").trim();
  const path = (Deno.env.get("DENO_KV_PATH") || "").trim();
  const target = url || path || undefined;
  if (target && /^https?:\/\//i.test(target)) {
    if (!(Deno.env.get("DENO_KV_ACCESS_TOKEN") || "").trim()) {
      throw new Error(
        "DENO_KV_ACCESS_TOKEN is required to open a remote Deno Deploy KV. " +
          "Create one at https://dash.deno.com/account (Access Tokens).",
      );
    }
  }
  const kv = await Deno.openKv(target);
  return { kv, source: target ?? "(default local store for this script)" };
}

export function parseArgs(args: string[]): {
  flags: Record<string, string | boolean>;
  positional: string[];
} {
  const flags: Record<string, string | boolean> = {};
  const positional: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--help" || a === "-h") {
      flags.help = true;
    } else if (a === "--redact" || a === "--dry-run") {
      flags[a.slice(2)] = true;
    } else if (
      a.startsWith("--") && args[i + 1] && !args[i + 1].startsWith("-")
    ) {
      flags[a.slice(2)] = args[++i];
    } else if (a.startsWith("--")) {
      flags[a.slice(2)] = true;
    } else {
      positional.push(a);
    }
  }
  return { flags, positional };
}
