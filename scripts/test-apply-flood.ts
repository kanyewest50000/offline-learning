#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read
// How big the pile of unanswered applications may get.
//
// /apply is the one route that makes an account, and it is anonymous, so the
// only thing in front of it is the 90-a-minute IP cap. Ninety accounts a minute
// is three KV writes each and ninety more rows in a list tung reads whole every
// time he opens the panel: a morning of that and the panel is useless while the
// door still works.
//
// The obvious guard is a rate cap per address, and it is the wrong one here —
// this repo's own suite applies dozens of times from one address, and a guard
// that turns the tests red is a guard nobody keeps. So the cap is on the thing
// that does the harm: the SIZE of the pile, not the speed it arrives at. Tung
// answering applications makes room for more, which is how it should work
// anyway, and the tests never come near it because they approve what they
// apply for.
//
// The counter behind it is allowed to be wrong. It only ever goes up, so it
// drifts past the truth and trips — and a counter that trips is not believed,
// it is checked against a bounded walk and put right. What that buys is the
// failure it can never produce: the door shut on somebody real because a number
// was stale.
//
// Set the ceiling low or this test spends a long time applying:
//
//   ADMIN_KEY=devadminkey PENDING_MAX=12 \
//     deno run --allow-net --allow-env --unstable-kv server.ts
//   ADMIN_KEY=devadminkey PENDING_MAX=12 API=... \
//     deno run --allow-net --allow-env --allow-read scripts/test-apply-flood.ts

import { ROOT } from "./shrine-sources.ts";

const API = (Deno.env.get("API") || "http://127.0.0.1:8000").replace(/\/$/, "");
const ADMIN = Deno.env.get("ADMIN_KEY") || "devadminkey";
const MAX = Number(Deno.env.get("PENDING_MAX") || 200);

function must(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}
async function j(path: string, opt?: RequestInit) {
  const r = await fetch(API + path, opt);
  return { status: r.status, body: await r.json().catch(() => ({})) as Record<string, unknown> };
}
const post = (path: string, obj: unknown) =>
  j(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(obj) });
const rnd = () => Math.random().toString(36).slice(2, 9);
const nap = (ms: number) => new Promise((r) => setTimeout(r, ms));
// /apply is anonymous, so it is also behind the ordinary 90-a-minute IP cap —
// which is not what this file is about, and which a flood of this size will
// meet long before the ceiling if it is fired flat out. Wait it out rather than
// reading it as an answer. (Set PENDING_MAX low and this never comes up.)
async function apply(n: string) {
  for (let i = 0; i < 40; i++) {
    const r = await post("/apply", { username: n, application: "flood test" });
    if (r.status !== 429) return r;
    await nap(3000);
  }
  throw new Error("still behind the IP cap after two minutes");
}
const pending = async () =>
  ((await j("/admin/pending?key=" + encodeURIComponent(ADMIN))).body.pending as
    { id: string; username: string }[]) || [];
const answerAll = async () => {
  for (const a of await pending()) await post("/admin/decide", { key: ADMIN, id: a.id, action: "reject" });
};

// ===========================================================================
// source: the counter may be wrong, and must never be believed when it refuses
// ===========================================================================
const src = await Deno.readTextFile(`${ROOT}/server.ts`);
must(/async function pendingRoom\(\): Promise<boolean> \{/.test(src), "could not find the ceiling");
const room = src.slice(src.indexOf("async function pendingRoom()"), src.indexOf("\n}", src.indexOf("async function pendingRoom()")));
must(/if \(\(Number\(cur\.value\) \|\| 0\) < PENDING_MAX\) return true;/.test(room),
  "the counter is the fast path and must answer without counting when there is room");
must(/kv\.list<any>\(\{ prefix: \["app"\] \}, \{ limit: PENDING_MAX \+ 1 \}\)/.test(room),
  "…and when it says there is none, it must COUNT — bounded by the ceiling itself");
must(/await kv\.set\(\["pendn"\], n\);/.test(room), "…and put the counter right while it is there");
must(/return n < PENDING_MAX;/.test(room), "…and answer from the count, not from the counter");
// the commit that takes a place must be the commit that makes the account
const applySrc = src.slice(src.indexOf('path === "/apply"'), src.indexOf('path === "/login"'));
must(/\.set\(\["pendn"\], pend \+ 1\)/.test(applySrc), "the pile grows in the commit that grew it");
must(!/\.check\(pend\)/.test(applySrc),
  "the counter must NOT be guarded: a lost increment is drift, which is absorbed, " +
    "and guarding it would refuse somebody for no reason");

// ===========================================================================
// live
// ===========================================================================
// start from whatever is there; this test's own arithmetic is about the delta
await answerAll();
must((await pending()).length === 0, "the pile starts empty for this test");

let took = 0, refused = 0, why = "";
for (let i = 0; i < MAX + 6; i++) {
  const r = await apply("fl" + rnd());
  if (r.body?.token) took++;
  else if (r.status === 503) { refused++; why = String(r.body.error || ""); }
  else must(false, "an application was refused for an unexpected reason: " + JSON.stringify(r.body));
}
must(refused > 0, "a flood must run out of room at some point");
must(took <= MAX + 1, "…at about the ceiling, and it took " + took);
must(took >= MAX - 1, "…but not before it: " + took);
must(/try again later/.test(why), "…and say why, rather than looking broken: " + why);

// and answering some of them lets the next real applicant straight in
const pile = await pending();
must(pile.length >= MAX - 1, "the pile is what was let through: " + pile.length);
for (const a of pile.slice(0, Math.max(2, Math.floor(MAX / 2)))) {
  await post("/admin/decide", { key: ADMIN, id: a.id, action: "reject" });
}
const after = await apply("ok" + rnd());
must(!!after.body?.token, "answering applications must make room again: " + JSON.stringify(after.body));

// the door is not the only thing still working: a member already through it is
// untouched by any of this
must((await j("/status?token=" + encodeURIComponent(after.body.token as string))).body.status === "pending",
  "and the applicant that got in is a normal pending applicant");

await answerAll();

console.log(
  "apply flood: the pile of unanswered applications has a ceiling and a flood stops writing at " +
    "it rather than growing forever; the counter in front of it is a fast path that is checked " +
    "against a bounded count before it is ever allowed to refuse anybody; and tung answering " +
    "applications is what makes room for the next one",
);
