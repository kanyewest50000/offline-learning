#!/usr/bin/env -S deno run --allow-net --allow-env
// After DELETE /admin/delete, that user's casino row must vanish from
// GET /admin/balances. A still-approved player with a balance stays listed.
//
// Usage (server already running with ADMIN_KEY):
//   ADMIN_KEY=devadminkey API=http://127.0.0.1:8000 deno run --allow-net --allow-env scripts/test-admin-delete-balance.ts

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

const suffix = Date.now().toString(36).slice(-6);
const gone = await approveUser("goneBal" + suffix, "delete-balance test victim");
const stay = await approveUser("stayBal" + suffix, "delete-balance test keeper");

const setGone = await j("/admin/setbal", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ key: ADMIN, id: gone.id, balance: 77.25 }),
});
if (!setGone.body?.ok) fail("setbal victim failed: " + JSON.stringify(setGone.body));
const setStay = await j("/admin/setbal", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ key: ADMIN, id: stay.id, balance: 12.5 }),
});
if (!setStay.body?.ok) fail("setbal keeper failed: " + JSON.stringify(setStay.body));

const before = await j("/admin/balances?key=" + encodeURIComponent(ADMIN));
if (before.status !== 200) fail("balances before delete: " + JSON.stringify(before));
const beforeRows = (before.body.balances || []) as { id: string; username: string; balance: number }[];
if (!beforeRows.some((r) => r.id === gone.id && r.balance === 77.25)) {
  fail("victim balance missing before delete: " + JSON.stringify(beforeRows));
}
if (!beforeRows.some((r) => r.id === stay.id && r.balance === 12.5)) {
  fail("keeper balance missing before delete: " + JSON.stringify(beforeRows));
}

const del = await j("/admin/delete", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ key: ADMIN, id: gone.id }),
});
if (!del.body?.ok || !del.body?.deleted) fail("delete failed: " + JSON.stringify(del.body));

const after = await j("/admin/balances?key=" + encodeURIComponent(ADMIN));
if (after.status !== 200) fail("balances after delete: " + JSON.stringify(after));
const afterRows = (after.body.balances || []) as { id: string; username: string; balance: number }[];
if (afterRows.some((r) => r.id === gone.id)) {
  fail("deleted user still listed in balances: " + JSON.stringify(afterRows));
}
if (afterRows.some((r) => r.username === "(deleted)")) {
  fail("balances still expose a (deleted) row: " + JSON.stringify(afterRows));
}
const keeper = afterRows.find((r) => r.id === stay.id);
if (!keeper || keeper.balance !== 12.5) {
  fail("keeper balance should remain: " + JSON.stringify(afterRows));
}

const users = await j("/admin/users?key=" + encodeURIComponent(ADMIN));
const userIds = (users.body.users || []).map((u: { id: string }) => u.id);
if (userIds.includes(gone.id)) fail("deleted user still in /admin/users");
if (!userIds.includes(stay.id)) fail("keeper missing from /admin/users");

console.log("PASS deleted user's casino balance is gone from /admin/balances");
