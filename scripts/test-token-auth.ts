#!/usr/bin/env -S deno run --allow-net --allow-env
// Regression: token-only shrine auth still works after POST /login exists.
// Username is NOT required for /status, /events, or /send.
//
// Usage (server already running):
//   ADMIN_KEY=devadminkey API=http://127.0.0.1:8002 deno run --allow-net --allow-env scripts/test-token-auth.ts

const API = (Deno.env.get("API") || "http://127.0.0.1:8010").replace(/\/$/, "");
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

const user = "restore" + Date.now().toString(36).slice(-8);
const apply = await j("/apply", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ username: user, application: "regression: token-only restore" }),
});
if (!apply.body?.token) fail("POST /apply did not return a token: " + JSON.stringify(apply.body));
const token = apply.body.token as string;
if (apply.body.status !== "pending") fail("expected pending after apply");

const pending = await j("/admin/pending?key=" + encodeURIComponent(ADMIN));
const row = (pending.body.pending || []).find((a: { username: string }) => a.username === user);
if (!row?.id) fail("applicant not in /admin/pending");

const decide = await j("/admin/decide", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ key: ADMIN, id: row.id, action: "approve" }),
});
if (!decide.body?.ok) fail("approve failed: " + JSON.stringify(decide.body));

// Token-only /status — no username query param, no Authorization header.
const st = await j("/status?token=" + encodeURIComponent(token));
if (st.body.status !== "approved") fail("/status token-only: " + JSON.stringify(st.body));
if (st.body.username !== user) fail("/status username mismatch");

const stNoUser = await j("/status?token=" + encodeURIComponent(token) + "&username=");
if (stNoUser.body.status !== "approved") fail("/status still approved with empty username param");

const ev = await j("/events?since=0&token=" + encodeURIComponent(token));
if (ev.status !== 200 || ev.body.error) fail("/events token-only: " + JSON.stringify(ev.body));
if (!Array.isArray(ev.body.events)) fail("/events missing events array");

const sent = await j("/send", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ token, id: "t" + Date.now().toString(36), text: "token-only send" }),
});
if (!sent.body?.ok) fail("/send token-only: " + JSON.stringify(sent.body));

const loginOk = await j("/login", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ username: user, token }),
});
if (loginOk.body.token !== token) fail("POST /login should return the same token");
if (loginOk.body.status !== "approved") fail("POST /login status: " + JSON.stringify(loginOk.body));

const loginBad = await j("/login", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ username: "not-" + user, token }),
});
if (loginBad.status !== 401) fail("mismatched username should 401, got " + loginBad.status);

const none = await j("/status?token=definitely-not-a-token");
if (none.body.status !== "none") fail("unknown token should be status none");

console.log("PASS token-only /status /events /send; /login still checks username");
console.log("user=" + user);
console.log("token=" + token);
