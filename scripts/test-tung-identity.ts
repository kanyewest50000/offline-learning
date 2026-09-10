#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read
// tung posts in the chat but is not a member, and must not be mistakable for
// one. Three things hold that up:
//   1. the name is reserved, so nobody can wear it
//   2. his posts carry from:"tung", stamped server-side and nowhere else
//   3. the client styles on that flag and never on the name, so a member who
//      somehow holds the name still renders as the member they are
//
//   ADMIN_KEY=devadminkey WISDOM_MIN_MS=1200 WISDOM_MAX_MS=1600 \
//     deno run --allow-net --allow-env --unstable-kv server.ts
//   ADMIN_KEY=devadminkey API=... deno run --allow-net --allow-env --allow-read scripts/test-tung-identity.ts

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const API = (Deno.env.get("API") || "http://127.0.0.1:8000").replace(/\/$/, "");
const ADMIN = Deno.env.get("ADMIN_KEY") || "devadminkey";
const WINDOW_MS = Number(Deno.env.get("WISDOM_MAX_MS") || 1600);

function must(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}
async function j(path: string, opt?: RequestInit) {
  const r = await fetch(API + path, opt);
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
const post = (path: string, obj: unknown) =>
  j(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(obj) });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// 1. The name is his alone.
const REFUSE = ["tung", "Tung", "TUNG", "TuNg", " tung ", "t.u.n.g", "T U N G", "_tung_", "t-u-n-g"];
for (const n of REFUSE) {
  const r = await post("/apply", { username: n, application: "impersonation attempt" });
  must(r.status === 409 && !!r.body.error, `"${n}" must not be claimable, got ${r.status} ${JSON.stringify(r.body)}`);
}
// but only names that actually reduce to his — these are ordinary names
const ALLOW = ["tung99", "tungsten", "tunglord", "notatung"];
const madeIds: string[] = [];
for (const n of ALLOW) {
  const uniq = n + Date.now().toString(36).slice(-4);
  const r = await post("/apply", { username: uniq, application: "ordinary member" });
  must(!!r.body.token, `"${uniq}" should be claimable, got ${JSON.stringify(r.body)}`);
  const pend = await j("/admin/pending?key=" + encodeURIComponent(ADMIN));
  const id = (pend.body.pending || []).find((x: { username: string }) => x.username === uniq)?.id;
  must(!!id, uniq + " not pending");
  madeIds.push(id);
}
// and the admin page cannot hand the name out either
const r0 = await post("/admin/rename", { key: ADMIN, id: madeIds[0], username: "tung" });
must(r0.status === 409, "the admin must not be able to rename anyone to his name: " + JSON.stringify(r0.body));
const r1 = await post("/admin/rename", { key: ADMIN, id: madeIds[0], username: "T U N G" });
must(r1.status === 409, "rename must normalise the same way apply does");

// ---------------------------------------------------------------------------
// 2. His posts are stamped, and the stamp survives to both readers.
async function member(tag: string) {
  const n = tag + Date.now().toString(36).slice(-5);
  const a = await post("/apply", { username: n, application: "tung identity test" });
  const token = a.body?.token as string;
  must(!!token, "apply failed for " + n);
  const pend = await j("/admin/pending?key=" + encodeURIComponent(ADMIN));
  const id = (pend.body.pending || []).find((x: { username: string }) => x.username === n)?.id;
  must(!!(await post("/admin/decide", { key: ADMIN, id, action: "approve" })).body?.ok, "approve failed");
  return { name: n, token };
}
const alice = await member("tidA");
// prime his clock, let the window pass, then make him speak
await post("/send", { token: alice.token, text: "priming" });
await sleep(WINDOW_MS + 400);
await post("/send", { token: alice.token, text: "hello room" });
await sleep(400);

// deno-lint-ignore no-explicit-any
const dump = (await j("/admin/chat?key=" + encodeURIComponent(ADMIN))).body.messages as any[];
const his = dump.filter((m) => m.from === "tung");
must(his.length > 0, "no wisdom was stamped from:\"tung\" — the mark never reached the chat dump");
must(his.every((m) => m.name === "tung"), "a stamped post carries his name too");
const mine = dump.filter((m) => m.name === alice.name);
must(mine.length > 0 && mine.every((m) => !m.from), "a member's own posts must never carry the mark");

// the live event stream carries it as well, which is what the chat reads
const ev = (await j("/events?since=0&token=" + encodeURIComponent(alice.token))).body;
// deno-lint-ignore no-explicit-any
const evTung = (ev.events || []).filter((e: any) => e.type === "msg" && e.from === "tung");
must(evTung.length > 0, "/events must carry from:\"tung\" — without it the chat cannot style him");

// ---------------------------------------------------------------------------
// 3. The client keys on the flag, never on the name.
const chat = await Deno.readTextFile(`${ROOT}/assets/js/shrine/chat.js`);
// deno-lint-ignore no-explicit-any
const win: { Shrine: Record<string, any> } = {
  Shrine: { LBL: { POPUP: "p", ORIGINALS: "o", WEB_VEIL: "w" } },
};
new Function("window", "location", chat)(win, { href: "https://example.test/", search: "" });
const emitted = win.Shrine.CHAT_JS as string;

const isTungSrc = emitted.match(/function isTung\([^)]*\)\{.*?\}/s);
must(!!isTungSrc, "the emitted client has no isTung()");
const isTung = new Function(isTungSrc![0] + "; return isTung;")() as (m: unknown) => boolean;
must(isTung({ from: "tung", name: "tung" }) === true, "a stamped post is his");
must(isTung({ name: "tung" }) === false,
  "the name alone must NOT mark someone as tung — a member holding it would be badged as him");
must(isTung({ name: "tung", from: null }) === false, "an unstamped post is never his");
must(isTung({ name: "alice", from: "tung" }) === true, "the flag is what counts, not the spelling");
must(isTung({}) === false && isTung(null) === false, "isTung must tolerate junk");

// the flag has to survive the event->message mapping; it was dropped there once
must(
  /add\(\{[^}]*from:ev\.from/.test(emitted),
  "the event mapping must pass `from` through to add(), or nothing downstream ever sees it",
);
// and these must sit at the top level of the client, not inside a neighbour
function depthAt(src: string, needle: string): number {
  const at = src.indexOf(needle);
  must(at >= 0, "emitted client is missing " + needle);
  let d = 0;
  for (let i = 0; i < at; i++) {
    if (src[i] === "{") d++;
    else if (src[i] === "}") d--;
  }
  return d;
}
for (const decl of ["function isTung(", "function tungProfile(", "function openProfile("]) {
  must(depthAt(emitted, decl) === 1, decl + " must sit at the top level of the client");
}
// his card must not offer a tip button, and must not ask the server who he is
must(/function tungProfile\(\)\{(?:(?!function )[\s\S])*?profTip[\s\S]*?display="none"/.test(emitted),
  "tung's card must hide the tip button — he is not tippable");
must(!/function tungProfile\(\)\{(?:(?!function )[\s\S])*?tip\/profile/.test(emitted),
  "tung's card must not query /tip/profile — he has no member record");

console.log(
  `tung identity: name unclaimable (${REFUSE.length} spellings refused, ${ALLOW.length} ordinary names still fine, ` +
    `rename blocked too); his posts stamped server-side and the mark survives to /events and the admin dump; ` +
    `the client styles on the flag, so holding the name would not make you him`,
);
