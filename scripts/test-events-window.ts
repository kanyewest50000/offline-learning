#!/usr/bin/env -S deno run --allow-net --allow-env
// Fresh /events?since=0 returns only the last 30 chat messages.
// Incremental polls after that still receive new lines.
//
// Usage (server already running with ADMIN_KEY):
//   ADMIN_KEY=devadminkey API=http://127.0.0.1:8000 deno run --allow-net --allow-env scripts/test-events-window.ts

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

const username = "evWin" + Date.now().toString(36).slice(-6);
const apply = await j("/apply", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ username, application: "events window test" }),
});
if (!apply.body?.token) fail("apply failed: " + JSON.stringify(apply.body));
const token = apply.body.token as string;

const pending = await j("/admin/pending?key=" + encodeURIComponent(ADMIN));
const row = (pending.body.pending || []).find((a: { username: string }) => a.username === username);
if (!row?.id) fail("applicant not in pending");
const decide = await j("/admin/decide", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ key: ADMIN, id: row.id, action: "approve" }),
});
if (!decide.body?.ok) fail("approve failed: " + JSON.stringify(decide.body));

const tag = "w" + Date.now().toString(36);
for (let i = 1; i <= 40; i++) {
  const sent = await j("/send", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token, key: ADMIN, id: tag + "-" + i, text: "line " + i }),
  });
  if (!sent.body?.ok) fail("send " + i + " failed: " + JSON.stringify(sent.body));
}

const fresh = await j("/events?since=0&token=" + encodeURIComponent(token));
if (fresh.status !== 200) fail("fresh events: " + JSON.stringify(fresh));
const msgs = (fresh.body.events || []).filter((e: { type: string }) => e.type === "msg");
if (msgs.length !== 30) fail("expected 30 messages on reopen, got " + msgs.length);
if (msgs[0].text !== "line 11" || msgs[29].text !== "line 40") {
  fail("window should be lines 11-40, got " + msgs[0].text + " .. " + msgs[29].text);
}
const cursor = fresh.body.cursor;
if (typeof cursor !== "number" || cursor <= 0) fail("missing cursor: " + JSON.stringify(fresh.body));

const extra = await j("/send", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ token, id: tag + "-41", text: "line 41" }),
});
if (!extra.body?.ok) fail("send 41 failed");

const inc = await j("/events?since=" + cursor + "&token=" + encodeURIComponent(token));
const incMsgs = (inc.body.events || []).filter((e: { type: string }) => e.type === "msg");
if (!incMsgs.some((e: { text: string }) => e.text === "line 41")) {
  fail("incremental poll missed the new line: " + JSON.stringify(inc.body));
}

console.log("PASS /events?since=0 returns the last 30 messages");
