#!/usr/bin/env -S deno run --allow-net --allow-env
// Per-account chat flood cap: MSG_MAX (3) messages per MSG_WINDOW_MS (6s).
// The 4th within the window is refused with 429, and only the accepted ones
// ever reach the log. The window recovers on its own. A second account is
// throttled independently, so one spammer cannot mute the room.
//
// Usage (server running with ADMIN_KEY):
//   ADMIN_KEY=devadminkey API=http://127.0.0.1:8000 deno run --allow-net --allow-env scripts/test-send-ratelimit.ts

const API = (Deno.env.get("API") || "http://127.0.0.1:8000").replace(/\/$/, "");
const ADMIN = Deno.env.get("ADMIN_KEY") || "devadminkey";
const MAX = 3;
const WINDOW_MS = 6000;

function fail(msg: string): never {
  console.error("FAIL:", msg);
  Deno.exit(1);
}
async function j(path: string, opt?: RequestInit) {
  const r = await fetch(API + path, opt);
  const body = await r.json().catch(() => ({}));
  return { status: r.status, body };
}
async function approve(name: string): Promise<string> {
  const apply = await j("/apply", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: name, application: "ratelimit test" }),
  });
  const token = apply.body?.token as string;
  if (!token) fail("apply failed for " + name + ": " + JSON.stringify(apply.body));
  const pending = await j("/admin/pending?key=" + encodeURIComponent(ADMIN));
  const row = (pending.body.pending || []).find((a: { username: string }) => a.username === name);
  if (!row?.id) fail("applicant " + name + " not pending");
  const decide = await j("/admin/decide", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ key: ADMIN, id: row.id, action: "approve" }),
  });
  if (!decide.body?.ok) fail("approve failed for " + name);
  return token;
}
function send(token: string, tag: string, i: number) {
  return j("/send", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token, id: tag + "-" + i, text: tag + " " + i }),
  });
}

const stamp = Date.now().toString(36).slice(-6);
const alice = await approve("rlA" + stamp);
const bob = await approve("rlB" + stamp);

// Alice fires a burst. The first MAX succeed, the rest are refused with 429.
const tagA = "A" + stamp;
let ok = 0, limited = 0;
for (let i = 1; i <= 8; i++) {
  const r = await send(alice, tagA, i);
  if (r.status === 200 && r.body?.ok) ok++;
  else if (r.status === 429) limited++;
  else fail("unexpected /send status " + r.status + ": " + JSON.stringify(r.body));
}
if (ok !== MAX) fail("expected exactly " + MAX + " sends to land in the burst, got " + ok);
if (limited !== 8 - MAX) fail("expected " + (8 - MAX) + " refusals, got " + limited);

// Bob is on his own clock: his first message lands even though Alice is capped.
const bobFirst = await send(bob, "B" + stamp, 1);
if (bobFirst.status !== 200) fail("bob throttled by alice's cap — limiter is not per-account (" + bobFirst.status + ")");

// Only Alice's accepted messages are actually in the log.
const ev = await j("/events?since=0&token=" + encodeURIComponent(alice));
const mine = (ev.body.events || []).filter((e: { type: string; text?: string }) =>
  e.type === "msg" && typeof e.text === "string" && e.text.startsWith(tagA + " ")
);
if (mine.length !== MAX) fail("log holds " + mine.length + " of Alice's messages, expected " + MAX);

// After the window closes, Alice can post again.
await new Promise((r) => setTimeout(r, WINDOW_MS + 500));
const recovered = await send(alice, tagA, 99);
if (recovered.status !== 200) fail("Alice still blocked after the window elapsed (" + recovered.status + ")");

console.log(
  "PASS burst: " + ok + " sent / " + limited + " refused; bob unaffected; " +
    "log had " + mine.length + " msgs; recovered after " + (WINDOW_MS / 1000) + "s",
);
