#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read
// A key the server has disowned must never leave the casino sitting on a
// "loading..." screen, and must say which kind of refusal it was. /cas/me
// collapses deleted, unapproved and banned into one "unauthorized", so the
// client re-asks /status — the endpoint the chat already trusts — to tell them
// apart. This checks both halves: the server contract those branches rest on,
// and that every request in the casino actually routes a refusal to the gate.
//
//   ADMIN_KEY=devadminkey deno run --allow-net --allow-env --unstable-kv server.ts
//   ADMIN_KEY=devadminkey API=... deno run --allow-net --allow-env --allow-read scripts/test-casino-auth.ts

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const API = (Deno.env.get("API") || "http://127.0.0.1:8000").replace(/\/$/, "");
const ADMIN = Deno.env.get("ADMIN_KEY") || "devadminkey";

function must(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}
async function j(path: string, opt?: RequestInit) {
  const r = await fetch(API + path, opt);
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
const post = (path: string, obj: unknown) =>
  j(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(obj) });

// ---------------------------------------------------------------------------
// 1. Source: no request in the casino may swallow a refusal.
// Every jget/jpost callback has to route "unauthorized" to refusedGate(),
// otherwise the screen it was painting stays half-finished — which is exactly
// how the faucet page used to sit on "consulting the shrine..." forever.
const casino = await Deno.readTextFile(`${ROOT}/assets/js/shrine/casino.js`);

const unguarded = casino.split("\n")
  .map((l, i) => ({ n: i + 1, l }))
  .filter(({ l }) => /jpost\(.*\)\.then\(function\(\w+\)\{/.test(l) && !l.includes("refused("));
must(
  unguarded.length === 0,
  "these casino actions do not handle a refused key: " +
    unguarded.map((u) => `line ${u.n}`).join(", "),
);

for (const fn of ["function refused(", "function refusedGate(", "function deadKeyGate(", "function netGate("]) {
  must(casino.includes(fn), "casino is missing " + fn);
}
// a refusal must be told apart from a network blip: a blip must never bin a key
must(
  /function netGate\(\)\{[\s\S]{0,400}?\}/.test(casino) && !/function netGate\(\)\{[\s\S]{0,400}?clearTok\(\)/.test(casino),
  "netGate must not clear the key — a network error is not a dead account",
);
must(/function refusedGate\(\)[\s\S]{0,1600}?clearTok\(\)/.test(casino), "refusedGate must drop a key the server disowned");
// the three screens that paint a "loading" state must all reach a gate
must(casino.includes(".catch(netGate)"), "the loading paths must land somewhere on a network failure");

// ---------------------------------------------------------------------------
// 2. Live: the server contract those branches read.
async function member(tag: string) {
  const name = tag + Date.now().toString(36).slice(-5);
  const a = await post("/apply", { username: name, application: "casino auth test" });
  const token = a.body?.token as string;
  must(!!token, "apply failed for " + name);
  const pend = await j("/admin/pending?key=" + encodeURIComponent(ADMIN));
  const id = (pend.body.pending || []).find((x: { username: string }) => x.username === name)?.id;
  must(!!id, name + " not pending");
  return { name, token, id };
}
const approve = (id: string) => post("/admin/decide", { key: ADMIN, id, action: "approve" });
const casMe = (t: string) => j("/cas/me?token=" + encodeURIComponent(t));
const status = (t: string) => j("/status?token=" + encodeURIComponent(t));

// -- deleted: /cas/me refuses, /status says the account is gone, so the client
//    can say "get a new key" instead of a generic members-only wall
const dead = await member("cauD");
await approve(dead.id);
must((await casMe(dead.token)).status === 200, "an approved member should reach the tables");
await post("/admin/delete", { key: ADMIN, id: dead.id });
let m = await casMe(dead.token);
must(m.status === 401 && m.body.error === "unauthorized", "a deleted key must be refused by /cas/me");
must((await status(dead.token)).body.status === "none", "/status must report a deleted account as none");

// -- banned: refused at the tables, but the account still exists, so the key
//    must be kept rather than binned
const banned = await member("cauB");
await approve(banned.id);
await post("/admin/ban", { key: ADMIN, id: banned.id, banned: true });
m = await casMe(banned.token);
must(m.status === 401, "a banned member must not reach the tables");
const bst = await status(banned.token);
must(bst.body.status === "approved" && bst.body.blocked === true,
  "/status must show a banned member as approved-but-blocked, so the client keeps their key");

// -- pending: same shape, different reason
const pending = await member("cauP");
m = await casMe(pending.token);
must(m.status === 401, "an unapproved member must not reach the tables");
must((await status(pending.token)).body.status === "pending", "/status must report pending");

// -- garbage and empty
must((await casMe("nonsense-token")).status === 401, "a garbage key must be refused");
must((await status("nonsense-token")).body.status === "none", "/status must report a garbage key as none");
must((await j("/cas/me?token=")).status === 401, "an empty key must be refused");

// -- and a live account still plays
const good = await member("cauG");
await approve(good.id);
await post("/admin/setbal", { key: ADMIN, id: good.id, balance: 100 });
const ok = await casMe(good.token);
must(ok.status === 200 && ok.body.balance === 100, "an approved member must still reach the tables");
const roll = await post("/cas/dice", { token: good.token, bet: 1, target: 50, over: false });
must(roll.body && !roll.body.error, "an approved member must still be able to play: " + JSON.stringify(roll.body));

console.log(
  "casino auth: every request routes a refused key to the gate; deleted/banned/pending " +
    "are told apart via /status; a dead key is dropped, a blocked one kept, and live play is unaffected",
);
