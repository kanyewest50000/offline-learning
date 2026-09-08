#!/usr/bin/env -S deno run --allow-net --allow-env
// Casino games used to dump any illegal stake as "bad bet". A number under
// the floor or over the ceiling has to say so, in tung's voice, and a legal
// stake still has to play.
//
// Usage (server already running with ADMIN_KEY):
//   ADMIN_KEY=devadminkey API=http://127.0.0.1:8000 deno run --allow-net --allow-env scripts/test-bet-limits.ts

const API = (Deno.env.get("API") || "http://127.0.0.1:8000").replace(/\/$/, "");
const ADMIN = Deno.env.get("ADMIN_KEY") || "devadminkey";

function fail(msg: string): never {
  console.error("FAIL:", msg);
  Deno.exit(1);
}

async function j(path: string, opt?: RequestInit) {
  const r = await fetch(API + path, opt);
  const body = await r.json().catch(() => ({}));
  return { status: r.status, body };
}

const post = (path: string, obj: unknown) =>
  j(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(obj) });

const username = "betLim" + Date.now().toString(36).slice(-6);
const apply = await post("/apply", { username, application: "bet limit test" });
const token = apply.body?.token as string;
if (!token) fail("apply failed: " + JSON.stringify(apply.body));
const pending = await j("/admin/pending?key=" + encodeURIComponent(ADMIN));
const id = (pending.body.pending || []).find((a: { username: string }) => a.username === username)?.id;
if (!id) fail("not pending");
if (!(await post("/admin/decide", { key: ADMIN, id, action: "approve" })).body?.ok) fail("approve failed");
if (!(await post("/admin/setbal", { key: ADMIN, id, balance: 50 })).body?.ok) fail("setbal failed");

async function dice(bet: unknown) {
  return post("/cas/dice", { token, bet, target: 50, over: false });
}

const under = await dice(0.01);
if (under.status !== 400 || under.body.error !== "that offering is beneath the altar. the floor is 0.1 sahurs. tung counted.") {
  fail("under-min should name the floor, got " + JSON.stringify(under));
}
if (under.body.error === "bad bet") fail("under-min still says bad bet");

const over = await dice(100001);
if (over.status !== 400 || over.body.error !== "even tung tung god has a ceiling. 100000 sahurs is it. sit down.") {
  fail("over-max should name the ceiling, got " + JSON.stringify(over));
}

const ghost = await dice("nope");
if (ghost.status !== 400 || ghost.body.error !== "tung does not wager ghosts. put a real number on the felt.") {
  fail("non-number should use the ghost line, got " + JSON.stringify(ghost));
}

const limboUnder = await post("/cas/limbo", { token, bet: 0.05, target: 2 });
if (limboUnder.status !== 400 || !String(limboUnder.body.error || "").includes("beneath the altar")) {
  fail("limbo under-min should share the altar line, got " + JSON.stringify(limboUnder));
}

const ok = await dice(1);
if (ok.body.error) fail("a legal 1 sahur dice bet failed: " + JSON.stringify(ok.body));
if (typeof ok.body.balance !== "number") fail("legal dice bet should return a balance");

const after = await j("/shop/list?token=" + encodeURIComponent(token));
if (after.body.balance !== ok.body.balance) fail("balance after the legal bet did not stick");

console.log("PASS under-min names the floor; over-max names the ceiling; ghosts named; legal dice still plays");
