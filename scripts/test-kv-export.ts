#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read --allow-write --allow-run --unstable-kv
// The whole database out of a running server, and into another KV, intact.
//
// POST /admin/export pages through every entry with the admin key and nothing
// else; scripts/kv-export.ts writes the pages to a file; scripts/kv-import.ts
// writes the file into a fresh KV. This checks the route, then — given
// --allow-run, --allow-write and --unstable-kv — runs both scripts and reads
// the copy back: an account, its balance, a chat line and a giveaway's entry
// counter (a KvU64, which JSON cannot carry as it is) all arrive as they left.
//
// It also checks that big answers now go out gzipped and small ones do not.
//
//   ADMIN_KEY=devadminkey deno run --allow-net --allow-env --unstable-kv server.ts
//   ADMIN_KEY=devadminkey API=... deno run -A --unstable-kv scripts/test-kv-export.ts

const API = (Deno.env.get("API") || "http://127.0.0.1:8000").replace(/\/$/, "");
const ADMIN = Deno.env.get("ADMIN_KEY") || "devadminkey";

function must(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}
// deno-lint-ignore no-explicit-any
type Any = any;
async function j(path: string, opt?: RequestInit) {
  const r = await fetch(API + path, opt);
  return { status: r.status, body: await r.json().catch(() => ({})) as Any };
}
const post = (path: string, obj: unknown) =>
  j(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(obj) });

async function member(tag: string) {
  const name = tag + Math.random().toString(36).slice(2, 8);
  let a = await post("/apply", { username: name, application: "export test" });
  for (let i = 0; a.body?.error === "slow down" && i < 15; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    a = await post("/apply", { username: name, application: "export test" });
  }
  const token = a.body?.token as string;
  must(!!token, "apply failed for " + name + ": " + JSON.stringify(a.body));
  const pend = await j("/admin/pending?key=" + encodeURIComponent(ADMIN));
  const id = (pend.body.pending as { username: string; id: string }[] || []).find((x) => x.username === name)?.id;
  must(!!id, name + " not pending");
  must(!!(await post("/admin/decide", { key: ADMIN, id, action: "approve" })).body?.ok, "approve failed");
  return { name, token, id: id as string };
}

// ---- gzip: the big answers shrink on the wire, the small ones are left alone ----
{
  const big = await fetch(API + "/admin", {
    method: "POST", headers: { "content-type": "application/json", "accept-encoding": "gzip" }, body: JSON.stringify({ key: ADMIN }),
  });
  const txt = await big.text();
  must(big.headers.get("content-encoding") === "gzip" && txt.includes("Shrine of Tung"),
    "the panel must go out gzipped and still read as the panel: " + big.headers.get("content-encoding"));
  must((big.headers.get("vary") || "").toLowerCase().includes("accept-encoding"), "and say it varies by what the client accepts");
  const plain = await fetch(API + "/admin", {
    method: "POST", headers: { "content-type": "application/json", "accept-encoding": "identity" }, body: JSON.stringify({ key: ADMIN }),
  });
  await plain.text();
  must(!plain.headers.get("content-encoding"), "a client that does not take gzip gets it plain");
  const small = await fetch(API + "/status?token=nope", { headers: { "accept-encoding": "gzip" } });
  await small.text();
  must(!small.headers.get("content-encoding"), "a small answer is not gzipped");
  must(small.headers.get("access-control-allow-origin") === "*", "and keeps its CORS headers");
}

// ---- the route ----
must((await post("/admin/export", { key: "nope" })).status === 403, "a wrong key exports nothing");
must((await post("/admin/export", {})).status === 403, "no key exports nothing");

const M = await member("exM");
await post("/admin/setbal", { key: ADMIN, id: M.id, balance: 123.45 });
const lineId = "ex" + Math.random().toString(36).slice(2, 8);
must((await post("/send", { token: M.token, id: lineId, text: "carry me over" })).body?.ok, "send failed");
const g = await post("/admin/raffle/create", { key: ADMIN, amount: 5, winners: 1, minutes: 60 });
const rid = g.body.raffle.id as string;
await post("/raffle/enter", { token: M.token, id: rid });

// paged small, to walk the cursor
const seen: { k: Any[]; v: Any }[] = [];
let cursor = "", pages = 0;
for (;;) {
  const r = await post("/admin/export", { key: ADMIN, cursor, limit: 5 });
  must(r.body?.ok && Array.isArray(r.body.entries), "a page failed: " + JSON.stringify(r.body).slice(0, 200));
  seen.push(...r.body.entries);
  pages++;
  if (!r.body.cursor) break;
  cursor = r.body.cursor;
  must(pages < 10000, "the cursor never ran out");
}
must(pages > 1, "a small page size must take more than one page");
const keys = new Set(seen.map((e) => JSON.stringify(e.k)));
must(keys.size === seen.length, "no entry may come twice across pages");
const app = seen.find((e) => e.k[0] === "app" && e.k[1] === M.id);
must(app && app.v.username === M.name, "the account is in it");
must(seen.some((e) => e.k[0] === "tok" && e.k[1] === M.token && e.v === M.id), "and the login key that is the account");
const cnt = seen.find((e) => e.k[0] === "rafflen" && e.k[1] === rid);
must(cnt && cnt.v && cnt.v.$u64 === "1", "a KvU64 travels tagged: " + JSON.stringify(cnt));

// ---- the scripts, into a fresh KV ----
const canRun = (await Deno.permissions.query({ name: "run" })).state === "granted" &&
  (await Deno.permissions.query({ name: "write" })).state === "granted" && typeof Deno.openKv === "function";
let scripts = "not run (give --allow-run, --allow-write and --unstable-kv)";
if (canRun) {
  const dir = await Deno.makeTempDir();
  const file = dir + "/export.ndjson", db = dir + "/copy.db";
  const here = new URL(".", import.meta.url).pathname;
  const ex = await new Deno.Command(Deno.execPath(), {
    args: ["run", "--allow-net", "--allow-env", "--allow-write", here + "kv-export.ts", file],
    env: { API, ADMIN_KEY: ADMIN }, stdout: "piped", stderr: "piped",
  }).output();
  must(ex.success, "kv-export failed: " + new TextDecoder().decode(ex.stderr));
  const lines = (await Deno.readTextFile(file)).split("\n").filter(Boolean).length;
  must(lines >= seen.length, "the file holds the database: " + lines + " lines for " + seen.length + " entries");
  const im = await new Deno.Command(Deno.execPath(), {
    args: ["run", "--allow-read", "--allow-write", "--allow-env", "--unstable-kv", here + "kv-import.ts", file, db],
    stdout: "piped", stderr: "piped",
  }).output();
  must(im.success, "kv-import failed: " + new TextDecoder().decode(im.stderr));
  const copy = await Deno.openKv(db);
  try {
    const a = (await copy.get<Any>(["app", M.id])).value;
    must(a && a.username === M.name && a.status === "approved", "the account arrived: " + JSON.stringify(a));
    must((await copy.get(["tok", M.token])).value === M.id, "and its login key");
    const c = (await copy.get<Any>(["cas", M.id])).value;
    must(c && c.bal === 123.45, "and its balance: " + JSON.stringify(c));
    const msg = (await copy.get<Any>(["msg", lineId])).value;
    must(msg && msg.text === "carry me over", "and its chat line");
    const n = (await copy.get(["rafflen", rid])).value;
    must(n instanceof Deno.KvU64 && n.value === 1n, "and the counter is a counter again: " + String(n));
    let count = 0;
    for await (const _e of copy.list({ prefix: [] })) count++;
    must(count >= seen.length, "every entry arrived: " + count + " of " + seen.length);
  } finally {
    copy.close();
    await Deno.remove(dir, { recursive: true });
  }
  scripts = "exported to a file and imported into a fresh KV, intact";
}
await post("/admin/raffle/cancel", { key: ADMIN, id: rid });

console.log(
  "kv export: big answers go out gzipped and small ones plain; /admin/export hands over every entry " +
    "a page at a time to the admin key and nobody else, login keys and counters included; scripts: " + scripts,
);
