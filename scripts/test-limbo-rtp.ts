#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read
// Limbo must run the house edge (RTP 0.999), not leak it back to the player.
// The win used to be decided on the 2dp-ROUNDED crash point, so a 1.996 rounded
// up to 2.00 and cleared a 2.00 target it should have missed — worth ~0.5-0.75%
// of extra RTP, more the lower the target. This checks the win is decided on the
// exact crash (source) and that the running game pays ~99.9% back (Monte Carlo).
//
// Usage (server running with ADMIN_KEY):
//   ADMIN_KEY=devadminkey API=http://127.0.0.1:8000 deno run --allow-net --allow-env --allow-read scripts/test-limbo-rtp.ts

const API = (Deno.env.get("API") || "http://127.0.0.1:8000").replace(/\/$/, "");
const ADMIN = Deno.env.get("ADMIN_KEY") || "devadminkey";
const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const HOUSE = 0.999;

let bad = 0;
function fail(m: string) { console.error("FAIL:", m); bad = 1; }
function ok(m: string) { console.log("ok  -", m); }

// ---------- source: the edge constant + the exact-crash comparison ----------
const src = await Deno.readTextFile(`${ROOT}/server.ts`);
const has = (needle: string, msg: string) => src.includes(needle) ? ok(msg) : fail(msg + " (missing: " + needle + ")");
const hasnt = (needle: string, msg: string) => !src.includes(needle) ? ok(msg) : fail(msg + " (still present: " + needle + ")");

has("const HOUSE = 0.999;", "house edge constant is 0.1% (HOUSE = 0.999)");
has("const crashExact = Math.max(1, HOUSE / (1 - rnd()));", "limbo computes an exact crash point");
has("const win = crashExact >= target;", "limbo decides the win on the exact crash, not the rounded one");
hasnt("const crash = Math.max(1, round2((1 / (1 - rnd())) * HOUSE));", "the old rounded-crash comparison is gone");

// ---------- live Monte Carlo at a low target, where the leak was largest ----------
async function j(path: string, opt?: RequestInit) {
  const r = await fetch(API + path, opt);
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
const post = (path: string, obj: unknown) =>
  j(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(obj) });

const username = "limbo" + Date.now().toString(36).slice(-6);
const token = (await post("/apply", { username, application: "limbo rtp test" })).body?.token as string;
if (!token) fail("apply failed");
const id = (await j("/admin/pending?key=" + encodeURIComponent(ADMIN))).body.pending
  ?.find((a: { username: string }) => a.username === username)?.id;
if (!id) fail("not pending");
await post("/admin/decide", { key: ADMIN, id, action: "approve" });
await post("/admin/setbal", { key: ADMIN, id, balance: 5_000_000 });

// target 1.10: win pays 1.10, p(win)=HOUSE/1.10≈0.908 → low variance, and the
// old rounding leak was ~0.45% here. N=60k, ±0.006 band around 0.999.
const N = 60000, STAKE = 0.1, BAND = 0.006, CONC = 64;
let staked = 0, returned = 0, done = 0, errored = false;
async function worker() {
  while (done < N && !errored) {
    done++;
    const r = await post("/cas/limbo", { token, bet: STAKE, target: 1.1 });
    if (r.body && typeof r.body.balance === "number") { staked += STAKE; returned += (r.body.payout || 0); }
    else { errored = true; fail("limbo bet error: " + JSON.stringify(r.body)); }
  }
}
const t0 = Date.now();
await Promise.all(Array.from({ length: CONC }, worker));
const rtp = returned / staked;
const secs = ((Date.now() - t0) / 1000).toFixed(0);
const line = `limbo t=1.10: RTP ${(rtp * 100).toFixed(3)}%  (target 99.900%, ±${(BAND * 100).toFixed(1)}, N=${N}, ${secs}s)`;
if (Math.abs(rtp - HOUSE) <= BAND) ok(line); else fail(line);

console.log(bad ? "\nLIMBO RTP CHECK FAILED" : "\nlimbo RTP is correct (0.1% edge)");
Deno.exit(bad);
