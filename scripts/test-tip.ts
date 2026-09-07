#!/usr/bin/env -S deno run --allow-net --allow-env
// Tip / donation API: successful tip, insufficient, self, not_found, unauth,
// invalid amount, and concurrent double-spend safety.
//
// Usage (server already running with ADMIN_KEY):
//   ADMIN_KEY=devadminkey API=http://127.0.0.1:8000 deno run --allow-net --allow-env scripts/test-tip.ts

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

async function approveUser(username: string, application: string) {
  const apply = await j("/apply", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, application }),
  });
  if (!apply.body?.token) fail("apply failed for " + username + ": " + JSON.stringify(apply.body));
  const token = apply.body.token as string;

  const pending = await j("/admin/pending?key=" + encodeURIComponent(ADMIN));
  const row = (pending.body.pending || []).find((a: { username: string }) => a.username === username);
  if (!row?.id) fail("applicant not in pending: " + username);

  const decide = await j("/admin/decide", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ key: ADMIN, id: row.id, action: "approve" }),
  });
  if (!decide.body?.ok) fail("approve failed: " + JSON.stringify(decide.body));
  return { token, id: row.id as string, username };
}

async function setBal(id: string, balance: number) {
  const r = await j("/admin/setbal", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ key: ADMIN, id, balance }),
  });
  if (!r.body?.ok) fail("setbal failed: " + JSON.stringify(r.body));
}

const suffix = Date.now().toString(36).slice(-6);
const alice = await approveUser("tipA" + suffix, "tip test alice");
const bob = await approveUser("tipB" + suffix, "tip test bob");
await setBal(alice.id, 50);
await setBal(bob.id, 10);

// --- unauthenticated rejected ---
const noAuth = await j("/tip", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ to: bob.username, amount: 1 }),
});
if (noAuth.status !== 401 || noAuth.body.error !== "unauthorized") {
  fail("unauthenticated tip should 401 unauthorized, got " + JSON.stringify(noAuth));
}
const noAuthProf = await j("/tip/profile?user=" + encodeURIComponent(bob.username));
if (noAuthProf.status !== 401 || noAuthProf.body.error !== "unauthorized") {
  fail("unauthenticated profile should 401, got " + JSON.stringify(noAuthProf));
}

// --- profile lookup ---
const prof = await j(
  "/tip/profile?token=" + encodeURIComponent(alice.token) + "&user=" + encodeURIComponent(bob.username),
);
if (prof.status !== 200 || prof.body.username !== bob.username) {
  fail("profile lookup failed: " + JSON.stringify(prof));
}
if (typeof prof.body.createdAt !== "number" || prof.body.createdAt <= 0) {
  fail("profile missing createdAt: " + JSON.stringify(prof.body));
}
if (prof.body.balance !== 10) fail("profile balance expected 10, got " + prof.body.balance);

const missing = await j(
  "/tip/profile?token=" + encodeURIComponent(alice.token) + "&user=nobody-" + suffix,
);
if (missing.status !== 404 || missing.body.error !== "not_found") {
  fail("missing profile should not_found: " + JSON.stringify(missing));
}

// --- self-tip rejected ---
const selfTip = await j("/tip", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ token: alice.token, to: alice.username, amount: 1 }),
});
if (selfTip.status !== 400 || selfTip.body.error !== "self") {
  fail("self tip should error self: " + JSON.stringify(selfTip));
}

// --- invalid amount ---
for (const amount of [0, -5, NaN, Infinity, "nope", 1e20]) {
  const bad = await j("/tip", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: alice.token, to: bob.username, amount }),
  });
  if (bad.status !== 400 || bad.body.error !== "invalid") {
    fail("invalid amount " + String(amount) + " should be invalid: " + JSON.stringify(bad));
  }
}

// --- tip nonexistent user ---
const ghost = await j("/tip", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ token: alice.token, to: "ghost-" + suffix, amount: 1 }),
});
if (ghost.status !== 404 || ghost.body.error !== "not_found") {
  fail("tip to missing user should not_found: " + JSON.stringify(ghost));
}

// --- insufficient funds ---
const poor = await j("/tip", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ token: alice.token, to: bob.username, amount: 99999 }),
});
if (poor.status !== 402 || poor.body.error !== "insufficient") {
  fail("overdraw should insufficient: " + JSON.stringify(poor));
}
const meAfterPoor = await j("/cas/me?token=" + encodeURIComponent(alice.token));
if (meAfterPoor.body.balance !== 50) fail("failed tip must not change balance: " + meAfterPoor.body.balance);

// --- successful tip ---
const ok = await j("/tip", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ token: alice.token, to: bob.username, amount: 12.5 }),
});
if (!ok.body?.ok || ok.body.amount !== 12.5 || ok.body.to !== bob.username) {
  fail("successful tip failed: " + JSON.stringify(ok));
}
if (ok.body.fromBalance !== 37.5) fail("fromBalance expected 37.5 got " + ok.body.fromBalance);
if (ok.body.toBalance !== 22.5) fail("toBalance expected 22.5 got " + ok.body.toBalance);

const aliceMe = await j("/cas/me?token=" + encodeURIComponent(alice.token));
const bobMe = await j("/cas/me?token=" + encodeURIComponent(bob.token));
if (aliceMe.body.balance !== 37.5) fail("alice cas/me after tip: " + aliceMe.body.balance);
if (bobMe.body.balance !== 22.5) fail("bob cas/me after tip: " + bobMe.body.balance);

// --- concurrent double-spend: both try to tip 30 when alice only has 37.5 ---
// At most one can succeed; total conserved; no negative.
await setBal(alice.id, 30);
await setBal(bob.id, 0);
const [r1, r2] = await Promise.all([
  j("/tip", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: alice.token, to: bob.username, amount: 30 }),
  }),
  j("/tip", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: alice.token, to: bob.username, amount: 30 }),
  }),
]);
const results = [r1, r2];
const wins = results.filter((r) => r.body?.ok);
const fails = results.filter((r) => r.body?.error === "insufficient");
if (wins.length !== 1) fail("concurrent tips: expected exactly 1 win, got " + JSON.stringify(results));
if (fails.length !== 1) fail("concurrent tips: expected exactly 1 insufficient, got " + JSON.stringify(results));

const aliceFinal = await j("/cas/me?token=" + encodeURIComponent(alice.token));
const bobFinal = await j("/cas/me?token=" + encodeURIComponent(bob.token));
if (aliceFinal.body.balance !== 0) fail("alice after race should be 0, got " + aliceFinal.body.balance);
if (bobFinal.body.balance !== 30) fail("bob after race should be 30, got " + bobFinal.body.balance);
if (aliceFinal.body.balance < 0 || bobFinal.body.balance < 0) fail("negative balance after race");

// --- tipId replay is idempotent ---
await setBal(alice.id, 20);
await setBal(bob.id, 0);
const tipId = "idemp" + Date.now().toString(36) + "zz";
const first = await j("/tip", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ token: alice.token, to: bob.username, amount: 5, tipId }),
});
if (!first.body?.ok || first.body.fromBalance !== 15) fail("tipId first tip: " + JSON.stringify(first));
const second = await j("/tip", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ token: alice.token, to: bob.username, amount: 5, tipId }),
});
if (!second.body?.ok || !second.body.replay) fail("tipId replay should be idempotent: " + JSON.stringify(second));
if (second.body.fromBalance !== 15) fail("tipId replay must not debit again: " + second.body.fromBalance);
const bobAfter = await j("/cas/me?token=" + encodeURIComponent(bob.token));
if (bobAfter.body.balance !== 5) fail("bob should have exactly 5 after replay, got " + bobAfter.body.balance);

console.log("PASS tip API: auth, profile, self, invalid, not_found, insufficient, success, concurrent, tipId replay");
console.log("alice=" + alice.username + " bob=" + bob.username);
