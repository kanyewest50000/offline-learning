#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read
// The door.
//
// Nothing is on the other side of it until tung says yes. Not the chat, not the
// casino, not the catalog, not the originals, not the proxy — one page, and it
// is the application. The casino used to be hidden on its own for this, with a
// rule of its own; that rule is gone, because a general one replaced it and two
// rules that say the same thing are one rule and one bug waiting to happen.
//
// And the third verdict on an application: "send him to tung". Rejecting leaves
// somebody able to apply again. This does not — the account is banned as well,
// and the shrine renders nothing at all for the token in their browser.
//
// What that is and is not: the blank page is keyed to the token, so clearing
// site data gets them back to an application form like any stranger. The
// ACCOUNT is what stays banned, server-side, and that half is real. This file
// asserts both halves so neither is mistaken for the other later.
//
//   ADMIN_KEY=devadminkey deno run --allow-net --allow-env --unstable-kv server.ts
//   ADMIN_KEY=devadminkey API=... deno run --allow-net --allow-env --allow-read scripts/test-gate.ts

import { readShrine, ROOT } from "./shrine-sources.ts";

const API = (Deno.env.get("API") || "http://127.0.0.1:8000").replace(/\/$/, "");
const ADMIN = Deno.env.get("ADMIN_KEY") || "devadminkey";

function must(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}
async function j(path: string, opt?: RequestInit) {
  const r = await fetch(API + path, opt);
  return { status: r.status, body: await r.json().catch(() => ({})) as Record<string, unknown> };
}
const post = (path: string, obj: unknown) =>
  j(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(obj) });
const nap = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ===========================================================================
// source-level: approval is the only gate, and it is one gate
// ===========================================================================
const src = await Deno.readTextFile(`${ROOT}/server.ts`);
const shrine = await readShrine();

// Every route that reads a token goes through authUser() or casUser(), and
// authUser() itself refuses anybody who is not approved. That is what makes the
// client-side gate presentation rather than security.
must(
  /async function authUser\([\s\S]*?app\.value\.status !== "approved"\) return null;/.test(src),
  "authUser() must refuse a token whose account is not approved",
);
// the only things a stranger may reach, and why each one has to be open
for (const open of ["/apply", "/status", "/login", "/respond", "/version"]) {
  must(src.includes(`path === "${open}"`), "expected an open route " + open);
}

// the casino's own gate is gone; nothing may bring it back
must(!shrine.includes("paintCasinoGate"), "the casino must not have a gate of its own any more");
must(/function paintGate\(/.test(shrine), "there must be one gate, and this is it");
// The casino tile ships hidden in the markup so nothing flashes before /status
// answers, which means something has to put it BACK. Removing the casino's own
// gate without moving that job into the general one left approved members
// staring at a chooser with no casino on it.
must(/if\(chooseCasino\)chooseCasino\.style\.display=APPROVED\?"":"none";/.test(shrine),
  "paintGate() must put the casino tile back for an approved member");
// the shrine opens on its own door and resolves which door from /status
must(/topShow\("shrine"\);show\("apply"\);refreshGate\(\);/.test(shrine),
  "the client must boot to the application, not to the chooser");
// and the chooser is only ever opened from the one place that knows you are in
must(/if\(!OPENED\)\{OPENED=true;topShow\("choose"\);\}/.test(shrine),
  "only startChat() may open the chooser, and only once");
// the blank page has to actually empty the document
must(/function banish\(\)\{/.test(shrine), "the client needs a banish()");
must(/document\.documentElement\.innerHTML="<head><\/head><body><\/body>";/.test(shrine),
  "banish() must empty the document rather than hide things inside it");
must(/if\(s&&s\.banished\)\{APPROVED=false;IS_MOD=false;banish\(\);return;\}/.test(shrine),
  "/status saying banished must blank the page before anything else happens");

// ===========================================================================
// live
// ===========================================================================
async function applicant(tag: string) {
  const name = tag + Math.random().toString(36).slice(2, 7);
  let a = await post("/apply", { username: name, application: "let me in" });
  for (let i = 0; a.body?.error === "slow down" && i < 20; i++) {
    await nap(4000);
    a = await post("/apply", { username: name, application: "let me in" });
  }
  const token = a.body?.token as string;
  must(token, "apply failed for " + name + ": " + JSON.stringify(a.body));
  const pend = await j("/admin/pending?key=" + encodeURIComponent(ADMIN));
  const id = (pend.body.pending as { username: string; id: string }[] || [])
    .find((x) => x.username === name)?.id;
  must(id, name + " is not pending");
  return { name, token, id: id as string };
}
const decide = (id: string, action: string) => post("/admin/decide", { key: ADMIN, id, action });

// --- a pending applicant reaches nothing -------------------------------------
const P = await applicant("gtP");
for (
  const [label, r] of [
    ["the casino", await j("/cas/me?token=" + encodeURIComponent(P.token))],
    ["the pit", await j("/duel/list?token=" + encodeURIComponent(P.token))],
    ["the shop", await j("/shop/list?token=" + encodeURIComponent(P.token))],
    ["the room", await j("/events?since=0&token=" + encodeURIComponent(P.token))],
    ["conversations", await j("/dm/list?token=" + encodeURIComponent(P.token))],
    ["the veil", await j("/veil?token=" + encodeURIComponent(P.token))],
  ] as const
) {
  must(r.status === 401 || r.body.error, "a pending applicant must not reach " + label + ": " + JSON.stringify(r.body));
}
// but they can still talk to tung about their application, or nobody could be let in
must((await j("/status?token=" + encodeURIComponent(P.token))).body.status === "pending", "/status must answer them");
must((await post("/respond", { token: P.token, text: "please" })).body?.thread, "/respond must stay open to them");

// ===========================================================================
// sent to tung
// ===========================================================================
const B = await applicant("gtB");
const sent = await decide(B.id, "banish");
must(sent.body?.ok && sent.body.banished === true && sent.body.status === "rejected",
  "the banish verdict must reject AND banish: " + JSON.stringify(sent.body));

// what their own client is told, which is what makes the page go white
const st = await j("/status?token=" + encodeURIComponent(B.token));
must(st.body.banished === true, "/status must report it: " + JSON.stringify(st.body));
must(st.body.blocked === true && st.body.reason === "banned",
  "…and it is a real ban underneath, not only a white page: " + JSON.stringify(st.body));
const li = await post("/login", { token: B.token });
must(li.body.banished === true, "/login must report it too, or a fresh tab would let them in");

// the account is shut everywhere, which is the half that is not cosmetic
for (
  const [label, r] of [
    ["the casino", await j("/cas/me?token=" + encodeURIComponent(B.token))],
    ["the pit", await j("/duel/list?token=" + encodeURIComponent(B.token))],
    ["the room", await j("/events?since=0&token=" + encodeURIComponent(B.token))],
    ["a DM", await post("/dm/send", { token: B.token, to: P.name, text: "hi" })],
    ["the faucet", await post("/cas/claim", { token: B.token })],
  ] as const
) {
  must(r.status === 401 || r.body.error, "a banished account must be refused " + label + ": " + JSON.stringify(r.body));
}
// and they cannot take the name back by applying again with it
const again = await post("/apply", { username: B.name, application: "second go" });
must(again.body?.error || again.status >= 400, "the name must stay taken: " + JSON.stringify(again.body));

// --- approving is how it is undone ------------------------------------------
must((await decide(B.id, "approve")).body?.ok, "approve failed");
const back = await j("/status?token=" + encodeURIComponent(B.token));
must(back.body.status === "approved", "they should be approved now");
must(!back.body.banished, "approving must lift the banishment, or they see a white page while approved");
must(!back.body.blocked, "…and the ban with it: " + JSON.stringify(back.body));
must((await j("/cas/me?token=" + encodeURIComponent(B.token))).status === 200, "the casino opens again");

// --- and an ordinary rejection is still the softer one -----------------------
const R = await applicant("gtR");
must((await decide(R.id, "reject")).body?.ok, "reject failed");
const rst = await j("/status?token=" + encodeURIComponent(R.token));
must(rst.body.status === "rejected", "rejected is rejected");
must(!rst.body.banished, "a plain rejection must NOT blank their site: " + JSON.stringify(rst.body));

console.log(
  "the gate: nothing but the application, /status, /login, /respond and /version is reachable " +
    "before tung says yes — the client boots to the door rather than the chooser, the casino's " +
    "own gate is gone because one general rule replaced it, and only being approved opens the " +
    "chooser. 'Send him to tung' rejects and bans the account (refused by the casino, the pit, " +
    "the room, DMs and the faucet, and the name stays taken) and tells their client to empty " +
    "the document; approving them again lifts both, and a plain rejection still does neither",
);
