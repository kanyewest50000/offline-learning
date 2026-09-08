#!/usr/bin/env -S deno run --allow-net --allow-env
// A non-admin cannot reach past the public window (the last OPEN_MSGS = 30
// messages) however they ask: since=0 and a hand-edited since=1 both stop at
// the same floor. The admin key still walks the whole retained log.
//
// Usage (server already running with ADMIN_KEY):
//   ADMIN_KEY=devadminkey API=http://127.0.0.1:8000 deno run --allow-net --allow-env scripts/test-events-history-cap.ts

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

// approved account
const username = "histCap" + Date.now().toString(36).slice(-6);
const apply = await j("/apply", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ username, application: "history cap test" }),
});
const token = apply.body?.token as string;
if (!token) fail("apply failed: " + JSON.stringify(apply.body));
const pending = await j("/admin/pending?key=" + encodeURIComponent(ADMIN));
const row = (pending.body.pending || []).find((a: { username: string }) => a.username === username);
if (!row?.id) fail("applicant not pending");
const decide = await j("/admin/decide", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ key: ADMIN, id: row.id, action: "approve" }),
});
if (!decide.body?.ok) fail("approve failed");

// 80 messages: comfortably more than the 30-line window
const tag = "h" + Date.now().toString(36);
for (let i = 1; i <= 80; i++) {
  const sent = await j("/send", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token, id: tag + "-" + i, text: "hist " + i }),
  });
  if (!sent.body?.ok) fail("send " + i + " failed: " + JSON.stringify(sent.body));
}

const msgsOf = (b: { events?: { type: string; text?: string }[] }) =>
  (b.events || []).filter((e) => e.type === "msg") as { text: string }[];

// the honest scrape attempt: ask from the very beginning as a non-admin
const scrape = await j("/events?since=1&token=" + encodeURIComponent(token));
if (scrape.status !== 200) fail("since=1 status " + scrape.status);
const scraped = msgsOf(scrape.body);
if (scraped.length > 30) {
  fail("non-admin since=1 returned " + scraped.length + " messages — the backlog is not capped");
}
if (scraped.length && scraped[0].text === "hist 1") {
  fail("non-admin since=1 reached the first message; it must start no earlier than the window");
}
// whatever it returned must be inside the last-30 window (hist 51..80)
for (const m of scraped) {
  const n = Number(m.text.split(" ")[1]);
  if (n < 51) fail("non-admin saw message " + n + ", older than the 30-line window");
}

// a fresh open agrees on the floor
const fresh = msgsOf((await j("/events?since=0&token=" + encodeURIComponent(token))).body);
if (fresh.length !== 30) fail("fresh open should be 30, got " + fresh.length);
if (fresh[0].text !== "hist 51" || fresh[29].text !== "hist 80") {
  fail("window should be hist 51..80, got " + fresh[0].text + " .. " + fresh[29].text);
}

// admin walks everything through the dedicated dump
const dump = await j("/admin/chat?key=" + encodeURIComponent(ADMIN));
const dumpMsgs = (dump.body.messages || []).filter((m: { text?: string }) =>
  typeof m.text === "string" && m.text.startsWith("hist ")
);
if (dumpMsgs.length < 80) {
  fail("admin dump should hold all 80, got " + dumpMsgs.length);
}

// admin key on /events itself is not clamped
const adminEv = await j("/events?since=1&key=" + encodeURIComponent(ADMIN) + "&token=" + encodeURIComponent(token));
const adminMsgs = msgsOf(adminEv.body);
if (adminMsgs.length <= 30) {
  fail("admin /events since=1 should not be clamped, got " + adminMsgs.length);
}

console.log(
  "PASS non-admin capped at " + scraped.length + " msgs from since=1; " +
    "fresh open 30; admin dump " + dumpMsgs.length + "; admin /events " + adminMsgs.length,
);
