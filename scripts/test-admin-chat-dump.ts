#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read
// GET /admin/chat dumps retained chat messages, but only with the admin key.
// The admin page must not fetch that dump from loadAll / the header Load button.
//
// Usage (server already running with ADMIN_KEY):
//   ADMIN_KEY=devadminkey API=http://127.0.0.1:8000 deno run --allow-net --allow-env --allow-read scripts/test-admin-chat-dump.ts

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

const src = await Deno.readTextFile(new URL("../server.ts", import.meta.url));
const htmlStart = src.indexOf("const ADMIN_HTML");
if (htmlStart < 0) fail("ADMIN_HTML missing");
const html = src.slice(htmlStart);
if (!html.includes('id="dumpChat"') || !html.includes("function dumpChat(")) {
  fail("admin page is missing the chat dump button/handler");
}
if (!html.includes('data-pane="chat"') || !html.includes('id="pane-chat"')) {
  fail("admin page is missing the chat log pane");
}
const loadAll = html.match(/function loadAll\(\)\{[^}]+\}/);
if (!loadAll) fail("loadAll() missing from ADMIN_HTML");
if (loadAll[0].includes("dumpChat") || loadAll[0].includes("/admin/chat")) {
  fail("loadAll() must not fetch the chat dump: " + loadAll[0]);
}

const noKey = await j("/admin/chat");
if (noKey.status !== 403 || noKey.body?.error !== "forbidden") {
  fail("GET /admin/chat without key should 403: " + JSON.stringify(noKey));
}
const badKey = await j("/admin/chat?key=wrong");
if (badKey.status !== 403 || badKey.body?.error !== "forbidden") {
  fail("GET /admin/chat with wrong key should 403: " + JSON.stringify(badKey));
}

const username = "chatDump" + Date.now().toString(36).slice(-6);
const apply = await j("/apply", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ username, application: "admin chat dump test" }),
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

// Seeding 41 lines is not a flood test. The per-account cap is MSG_MAX per
// MSG_WINDOW_MS on /send, and the server exempts admin-key posts precisely so a
// moderator (or a fixture like this one) can seed without tripping it — the
// line still lands under the sender's own username. What this file is actually
// about is the *receiving* side: what /events and /admin/chat hand back.
// scripts/test-send-ratelimit.ts is where the send cap itself is tested.
const tag = "d" + Date.now().toString(36);
for (let i = 1; i <= 40; i++) {
  const sent = await j("/send", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ key: ADMIN, token, id: tag + "-" + i, text: "dump " + i }),
  });
  if (!sent.body?.ok) fail("send " + i + " failed: " + JSON.stringify(sent.body));
}
const reply = await j("/send", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    key: ADMIN,
    token,
    id: tag + "-reply",
    text: "dump reply",
    reply: { id: tag + "-1", name: username, text: "dump 1" },
  }),
});
if (!reply.body?.ok) fail("reply send failed: " + JSON.stringify(reply.body));
const react = await j("/react", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ token, id: tag + "-1", e: "👍", op: 1, eid: tag + "r" }),
});
if (!react.body?.ok) fail("react failed: " + JSON.stringify(react.body));

const fresh = await j("/events?since=0&token=" + encodeURIComponent(token));
const openMsgs = (fresh.body.events || []).filter((e: { type: string }) => e.type === "msg");
if (openMsgs.length !== 30) {
  fail("public reopen should still be 30 msgs, got " + openMsgs.length);
}

const dump = await j("/admin/chat?key=" + encodeURIComponent(ADMIN));
if (dump.status !== 200) fail("dump status: " + JSON.stringify(dump));
const messages = (dump.body.messages || []) as {
  id: string;
  name: string;
  text: string;
  reply?: { id?: string; name?: string; text?: string } | null;
  seq: number;
}[];
if (dump.body.count !== messages.length) {
  fail("count mismatch: " + dump.body.count + " vs " + messages.length);
}
if (messages.length > 500) fail("dump returned more than HISTORY: " + messages.length);

const ours = messages.filter((m) => String(m.id || "").startsWith(tag + "-"));
if (ours.length !== 41) fail("expected 41 dumped lines for this run, got " + ours.length);
if (ours[0].text !== "dump 1" || ours[39].text !== "dump 40") {
  fail("dump order wrong: " + ours[0].text + " .. " + ours[ours.length - 2]?.text);
}
const replyRow = ours.find((m) => m.id === tag + "-reply");
if (!replyRow?.reply || replyRow.reply.text !== "dump 1") {
  fail("reply not in dump: " + JSON.stringify(replyRow));
}
if (messages.some((m) => (m as { type?: string }).type === "react")) {
  fail("react events leaked into the message dump");
}
if (ours.some((m) => m.name !== username)) {
  fail("unexpected name in dump");
}

const gate = await fetch(API + "/admin");
const gateBytes = (await gate.arrayBuffer()).byteLength;
if (gateBytes > 800) fail("unauthenticated /admin grew too large: " + gateBytes);

console.log("PASS /admin/chat dumps retained messages without loadAll");
