#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read
// Chat timestamps. Every message the room keeps now carries a server `ts`, and
// every surface that paints a line — the shrine client, the embed, the admin
// dump, the application thread — has to show it. The clock is never the
// sender's: a body with ts:1 still lands as Date.now().
//
//   ADMIN_KEY=devadminkey deno run --allow-net --allow-env --unstable-kv server.ts
//   ADMIN_KEY=devadminkey API=... deno run --allow-net --allow-env --allow-read scripts/test-chat-timestamps.ts

import { readShrine } from "./shrine-sources.ts";

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

const src = await Deno.readTextFile(`${ROOT}/server.ts`);
must(/if \(ev\.type === "msg"\) ev\.ts = Date\.now\(\)/.test(src), "appendEvent must stamp ts on every chat line");
must(/ts: typeof ev\.ts === "number" \? ev\.ts : 0/.test(src), "the admin dump must ship ts");
must(/return json\(\{ ok: true, ts: posted\.ts \}\)/.test(src), "/send must return the server clock so the optimistic bubble can catch up");
must(!/b\.ts/.test(src.match(/if \(req\.method === "POST" && path === "\/send"\) \{[\s\S]*?return json\(\{ ok: true, ts: posted\.ts \}\);/)?.[0] || "b.ts"),
  "/send must never read a timestamp from the sender");
must(/tm\.className="when"/.test(src), "the admin chat dump must draw a .when clock");
must(/tw\.className="twhen"/.test(src), "the pending-application thread must draw a .twhen clock");

const shrine = await readShrine();
must(shrine.includes('function fmtWhen('), "the shrine client must format message times");
must(shrine.includes('function stampWhen('), "the shrine client must attach <time class=when>");
must(shrine.includes('className="when"'), "the shrine client must mark the clock");
must(/ts:ev\.ts\|\|null/.test(shrine), "the event mapping must pass ts through to add()");
must(/add\(\{id:id,name:ME,text:text,mine:true,reply:rep,ts:Date\.now\(\)\}/.test(shrine),
  "an optimistic send must carry a local clock so the bubble is not blank");
must(/#appThread \.twhen/.test(shrine), "application-thread times need a style");
must(/\[data-theme="dark"\] \.when/.test(shrine), "dark mode must repaint the clock");

const embed = await Deno.readTextFile(`${ROOT}/embed/chat.html`);
must(embed.includes("function fmtWhen("), "the embed must format message times");
must(embed.includes("function stampWhen("), "the embed must attach <time class=when>");
must(/ts:ev\.ts \|\| null/.test(embed), "the embed event mapping must pass ts through");
must(embed.includes('className = "when"') || embed.includes('className="when"'), "the embed must mark the clock");
must(/#appThread \.twhen/.test(embed), "the embed application thread must style its clock");

// emit the real client string and unit-test fmtWhen from it, so a rewrite that
// keeps the name but changes the rules still fails here.
const chat = await Deno.readTextFile(`${ROOT}/assets/js/shrine/chat.js`);
const win: { Shrine: Record<string, unknown> } = {
  Shrine: { LBL: { POPUP: "p", ORIGINALS: "o", WEB_VEIL: "w" } },
};
new Function("window", "location", chat)(win, { href: "https://example.test/", search: "" });
const emitted = String(win.Shrine.CHAT_JS || "");
const fmtSrc = emitted.match(/function fmtWhen\(ts\)\{[\s\S]*?return d\.toLocaleDateString\(undefined,\{year:"numeric",month:"short",day:"numeric"\}\)\+" "\+t;\}/);
must(!!fmtSrc, "could not extract fmtWhen from the emitted client");
const fmtWhen = new Function(fmtSrc![0] + "; return fmtWhen;")() as (ts: unknown) => string;
must(fmtWhen(0) === "" && fmtWhen("") === "" && fmtWhen("nope") === "", "junk must not draw a clock");
const today = fmtWhen(Date.now());
must(today !== "" && !today.includes("yesterday"), "today is just the clock, got " + JSON.stringify(today));
const y = new Date();
y.setDate(y.getDate() - 1);
y.setHours(15, 4, 0, 0);
must(fmtWhen(y.getTime()).startsWith("yesterday "), "yesterday must be labelled, got " + JSON.stringify(fmtWhen(y.getTime())));
must(fmtWhen(Date.UTC(2024, 0, 15, 12, 0, 0)).includes("2024"), "a previous year must keep the year");

async function member(tag: string) {
  const n = tag + Math.random().toString(36).slice(2, 8);
  const a = await post("/apply", { username: n, application: "timestamp test" });
  const token = a.body?.token as string;
  must(!!token, "apply failed for " + n);
  const pend = await j("/admin/pending?key=" + encodeURIComponent(ADMIN));
  const id = (pend.body.pending || []).find((x: { username: string }) => x.username === n)?.id;
  must(!!id, n + " not pending");
  must(!!(await post("/admin/decide", { key: ADMIN, id, action: "approve" })).body?.ok, "approve failed");
  return { name: n, token, id };
}

function recent(ts: unknown, skew = 15_000) {
  return typeof ts === "number" && ts > Date.now() - skew && ts <= Date.now() + 2000;
}

const A = await member("tsA");
const before = Date.now();
const id = "ts-" + Date.now().toString(36);
const sent = await post("/send", { token: A.token, id, text: "what time is it", ts: 1 });
must(sent.body?.ok === true, "send failed: " + JSON.stringify(sent.body));
must(recent(sent.body.ts), "/send must return a server clock, not the forged 1: " + JSON.stringify(sent.body));
must(sent.body.ts !== 1, "the sender must not choose the timestamp");

const evs = ((await j("/events?since=0&token=" + encodeURIComponent(A.token))).body.events || [])
  .filter((e: { type: string; id: string }) => e.type === "msg" && e.id === id);
must(evs.length === 1, "the line should be in /events");
must(recent(evs[0].ts) && evs[0].ts !== 1, "/events must carry the server clock, got " + JSON.stringify(evs[0].ts));
must(evs[0].ts >= before, "the event clock cannot predate the send");

const dump = ((await j("/admin/chat?key=" + encodeURIComponent(ADMIN))).body.messages || [])
  .find((m: { id: string }) => m.id === id);
must(!!dump, "the admin dump should keep the line");
must(dump.ts === evs[0].ts, "admin dump and /events must agree on the clock");

const asTung = await post("/admin/postas", { key: ADMIN, username: "tung", text: "the hour is his" });
must(asTung.body?.ok === true, "postas failed: " + JSON.stringify(asTung.body));
const tline = ((await j("/admin/chat?key=" + encodeURIComponent(ADMIN))).body.messages || [])
  .find((m: { id: string }) => m.id === asTung.body.id);
must(recent(tline?.ts), "a line posted as tung must also carry a clock");

// application thread already stored ts; the pending list must still ship it,
// and a follow-up from tung must arrive with one.
const pendName = "tsP" + Math.random().toString(36).slice(2, 8);
const pend = await post("/apply", { username: pendName, application: "ask me the hour" });
must(!!pend.body?.token, "pending apply failed");
const listed = await j("/admin/pending?key=" + encodeURIComponent(ADMIN));
const row = (listed.body.pending || []).find((x: { username: string }) => x.username === pendName);
must(!!row?.id, "pending applicant missing");
const asked = await post("/admin/message", { key: ADMIN, id: row.id, text: "what hour did you arrive?" });
must(asked.body?.ok === true, "admin follow-up failed");
const last = (asked.body.thread || []).slice(-1)[0];
must(last?.from === "admin" && recent(last.ts), "admin follow-up must carry ts");
const answered = await post("/respond", { token: pend.body.token, text: "just now" });
must(answered.body?.ok === true, "applicant reply failed");
const reply = (answered.body.thread || []).slice(-1)[0];
must(reply?.from === "applicant" && recent(reply.ts), "applicant reply must carry ts");

console.log(
  "chat timestamps: server stamps every line (sender ts is ignored), " +
    "/events and /admin/chat agree, postas and the application thread carry a clock, " +
    "and the shrine + embed clients format today / yesterday / older dates",
);
