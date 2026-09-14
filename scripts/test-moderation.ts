#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read
// Moderators — the flag that lets an ordinary member delete a chat message, and
// does nothing else.
//
// Two properties are worth guarding, and they pull in opposite directions.
//
// The power is real: a moderator's delete takes the line out of the append-only
// log, out of the quote index and off every other screen, and it cannot be
// reached by anyone who was not given the flag, anyone whose flag was taken
// back, or anyone barred from the room.
//
// The power is invisible: tung asked for no badge. So the flag must never leave
// the server except to the account that holds it. Nothing another member can
// read — an event, a reaction, a profile, the room dump — may carry it, and the
// clients must not paint anything on a moderator's own lines either.
//
//   ADMIN_KEY=devadminkey deno run --allow-net --allow-env --unstable-kv server.ts
//   ADMIN_KEY=devadminkey API=... deno run --allow-net --allow-env --allow-read scripts/test-moderation.ts

import { readShrineFile, ROOT } from "./shrine-sources.ts";

const API = (Deno.env.get("API") || "http://127.0.0.1:8000").replace(/\/$/, "");
const ADMIN = Deno.env.get("ADMIN_KEY") || "devadminkey";

function must(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}
async function j(path: string, opt?: RequestInit) {
  const r = await fetch(API + path, opt);
  return { status: r.status, body: await r.json().catch(() => ({})) as Record<string, unknown> };
}
const post = (path: string, obj: unknown) =>
  j(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(obj) });

// ===========================================================================
// source-level: the gate, and the silence around it
// ===========================================================================
const src = await Deno.readTextFile(`${ROOT}/server.ts`);

function handler(match: string): string {
  const at = src.indexOf(match);
  must(at >= 0, "could not find the route: " + match);
  must(src.indexOf(match, at + 1) < 0, "the route guard is not unique: " + match);
  const rest = src.slice(at + match.length);
  const end = rest.search(/\n  if \((?:req\.method|path)/);
  return rest.slice(0, end < 0 ? rest.length : end);
}

const del = handler('req.method === "POST" && path === "/delete"');
must(del.includes("user.mod !== true"), "/delete must refuse anyone without the flag");
must(del.includes("chatBlock("), "/delete must go through chatBlock() — a barred member does not reach into the room");
must(del.includes("deleteMessage("), "/delete must actually delete the message");
must(/allow\("del:/.test(del), "/delete must be rate limited per account");

// what a delete actually does to the store
must(
  /async function deleteMessage[\s\S]*?kv\.delete\(\["ev", seq\]\)[\s\S]*?kv\.delete\(\["msg", id\]\)[\s\S]*?appendEvent\(\{ type: "del", id \}\)/
    .test(src),
  "deleteMessage() must drop the log entry, drop the quote index and announce the removal",
);

// the flag is granted through its own admin route, and read back on the list
const grant = handler('req.method === "POST" && path === "/admin/mod"');
must(/b\.key !== ADMIN_KEY/.test(grant), "/admin/mod must need the admin key");
must(grant.includes("patchApp("), "/admin/mod must patch rather than clobber the record");
must(/mod: e\.value\.mod === true/.test(src), "/admin/users must ship the flag so the panel can show it");
must(/mod: app\.value\.mod === true/.test(src), "/status and /login must tell the account itself");
must(src.includes("function setMod("), "the admin page needs a setMod()");
must(src.includes("make moderator"), "the admin page needs a button that grants it");
must(src.includes("revoke moderator"), "the admin page needs a button that takes it back");

// NOTHING that goes into the room may carry the flag. every appendEvent() call
// in the file is checked, because one that shipped `mod` would put a badge in
// front of every client that renders events.
for (const call of src.match(/appendEvent\(\{[\s\S]*?\}\)/g) || []) {
  must(!/\bmod\b/.test(call), "an event must never carry the moderator flag: " + call.slice(0, 80));
}

// ===========================================================================
// source-level: the clients draw a bin, and nothing else
// ===========================================================================
const chatJs = await readShrineFile("assets/js/shrine/chat.js");
const embed = await Deno.readTextFile(`${ROOT}/embed/chat.html`);

for (const [label, client] of [["the shrine client", chatJs], ["the embed", embed]] as const) {
  must(/IS_MOD/.test(client), label + " must learn whether this account holds the flag");
  must(/act del/.test(client), label + " must put a third .act button in the row");
  must(/dropMsg/.test(client), label + " must be able to take a line off the screen");
  must(/"\/delete"/.test(client), label + " must call /delete");
  must(/type\s*===\s*"del"/.test(client), label + " must act on a del event");
  // the bin is the only thing the flag draws: it may not reach the name, the
  // meta line, or anything else that would mark a moderator out in the room.
  for (const line of client.split("\n")) {
    if (!line.includes("IS_MOD")) continue;
    must(
      /var IS_MOD|IS_MOD\s*=|if\s*\(IS_MOD\)|IS_MOD:/.test(line),
      label + " uses IS_MOD somewhere other than setting it or drawing the bin: " + line.trim().slice(0, 90),
    );
  }
}

// twice as often as it used to be
must(/setTimeout\(poll,4000\)/.test(chatJs), "the shrine client must poll every 4s");
must(!/setTimeout\(poll,8000\)/.test(chatJs), "the old 8s poll must be gone");
must(/POLL_MS = 4000/.test(embed), "the embed must poll every 4s");
// ...which the incremental bucket has to stay clear of: four seconds is fifteen
// polls a minute, plus one extra catch-up every time a tab comes back. The
// fresh-open bucket is a different expense and must NOT have moved with it.
must(/allow\("ev:" \+ tok, 40, 60_000\)/.test(src),
  "the incremental /events cap must leave headroom above a 4s poll");
must(/allow\("hist:" \+ tok, 6, 60_000\)/.test(src),
  "the fresh-open /events cap must stay where it was — that one replays the window");

// ===========================================================================
// source-level: no casino door for someone who has not been let in
// ===========================================================================
const markup = await readShrineFile("assets/js/shrine/markup.js");
must(
  /id="chooseCasino"[^']*style="display:none"/.test(markup),
  "the casino tile must ship hidden, so an applicant never sees it even for a frame",
);
must(/function paintCasinoGate\(\)\{if\(chooseCasino\)chooseCasino\.style\.display=APPROVED/.test(chatJs),
  "only APPROVED may put the casino tile back");
must(/APPROVED=!!\(s&&s\.status==="approved"\)/.test(chatJs),
  "APPROVED must come from /status saying approved, nothing softer");
must(/chooseCasino\.addEventListener\("click",function\(\)\{if\(!APPROVED\)return;/.test(chatJs),
  "the tile itself must refuse, in case the door is forced open from the console");

// ===========================================================================
// live
// ===========================================================================
async function member(tag: string) {
  const name = tag + Math.random().toString(36).slice(2, 8);
  const a = await post("/apply", { username: name, application: "moderation test" });
  const token = a.body?.token as string;
  must(!!token, "apply failed for " + name);
  const pend = await j("/admin/pending?key=" + encodeURIComponent(ADMIN));
  const id = (pend.body.pending as { username: string; id: string }[] || [])
    .find((x) => x.username === name)?.id;
  must(!!id, name + " not pending");
  return { name, token, id: id as string };
}
async function approved(tag: string) {
  const m = await member(tag);
  must(!!(await post("/admin/decide", { key: ADMIN, id: m.id, action: "approve" })).body?.ok, "approve failed");
  return m;
}
const say = async (token: string, text: string) => {
  const id = "md-" + Math.random().toString(36).slice(2, 10);
  const r = await post("/send", { token, id, text });
  must(r.body?.ok === true, "send failed: " + JSON.stringify(r.body));
  return id;
};
const roomSaid = async (): Promise<{ id: string; text: string }[]> =>
  ((await j("/admin/chat?key=" + encodeURIComponent(ADMIN))).body.messages as
    { id: string; text: string }[] || []);
const inRoom = async (id: string) => (await roomSaid()).some((m) => m.id === id);
const setMod = (id: string, mod: boolean) => post("/admin/mod", { key: ADMIN, id, mod });

const A = await approved("mdA");   // says things
const B = await approved("mdB");   // an ordinary member
const C = await approved("mdC");   // the moderator

// --- granting the flag ------------------------------------------------------
must((await post("/admin/mod", { id: C.id, mod: true })).status === 403, "/admin/mod must need the key");
must((await post("/admin/mod", { key: ADMIN + "x", id: C.id, mod: true })).status === 403, "a wrong key must not grant it");
must((await post("/admin/mod", { key: ADMIN, id: "nosuchid", mod: true })).status === 404, "an unknown id is 404");

// --- before the flag, nobody can delete anything ----------------------------
const first = await say(A.token, "the first thing anyone said");
must(await inRoom(first), "A's line should be in the room");
const byB = await post("/delete", { token: B.token, id: first });
must(byB.status === 403 && byB.body.error === "forbidden",
  "an ordinary member must not be able to delete: " + byB.status + " " + JSON.stringify(byB.body));
const byC = await post("/delete", { token: C.token, id: first });
must(byC.status === 403, "C must not be able to delete before being made a moderator");
must((await post("/delete", { id: first })).status === 401, "a delete with no token at all is unauthorized");
must((await post("/delete", { token: "not-a-token", id: first })).status === 401, "a junk token is unauthorized");
must(await inRoom(first), "none of those refusals may have deleted anything");

const granted = await setMod(C.id, true);
must(granted.body?.ok === true && granted.body?.mod === true, "granting failed: " + JSON.stringify(granted.body));

// --- the account itself is told; nobody else is -----------------------------
for (
  const [label, body] of [
    ["/status", (await j("/status?token=" + encodeURIComponent(C.token))).body],
    ["/login", (await post("/login", { token: C.token })).body],
  ] as const
) {
  must(body.mod === true, label + " must tell the moderator's own client: " + JSON.stringify(body));
}
must((await j("/status?token=" + encodeURIComponent(B.token))).body.mod === false,
  "/status must say plainly that an ordinary member is not one");

// --- and the room cannot tell ----------------------------------------------
const loud = await say(C.token, "a moderator saying an ordinary thing");
const window0 = await j("/events?since=0&token=" + encodeURIComponent(B.token));
must(JSON.stringify(window0.body).includes("a moderator saying an ordinary thing"), "C's line should be in the window");
must(!/"mod"\s*:/.test(JSON.stringify(window0.body)), "the event window must not carry a moderator flag");
const prof = await j("/tip/profile?token=" + encodeURIComponent(B.token) + "&user=" + encodeURIComponent(C.name));
must(prof.status === 200, "B should be able to read C's profile");
must(!/"mod"\s*:/.test(JSON.stringify(prof.body)), "a profile must not disclose the flag: " + JSON.stringify(prof.body));
must(!/"mod"\s*:/.test(JSON.stringify(await roomSaid())), "the room dump must not disclose the flag");

// --- the delete itself ------------------------------------------------------
const before = (await j("/events?since=0&token=" + encodeURIComponent(B.token))).body.cursor as number;
const killed = await post("/delete", { token: C.token, id: first });
must(killed.body?.ok === true && killed.body?.id === first, "the moderator's delete failed: " + JSON.stringify(killed.body));
must(!(await inRoom(first)), "the line must be out of the retained log");
const after = await j("/events?since=0&token=" + encodeURIComponent(B.token));
must(!JSON.stringify(after.body).includes("the first thing anyone said"),
  "a fresh open must never replay a deleted line");
// ...and a client that already had it on screen is told to drop it
const since = await j("/events?since=" + before + "&token=" + encodeURIComponent(B.token));
const dels = (since.body.events as { type: string; id: string }[] || []).filter((e) => e.type === "del");
must(dels.some((e) => e.id === first), "a del event must reach the clients that were watching: " + JSON.stringify(since.body.events));

// --- what is gone is gone ---------------------------------------------------
must((await post("/delete", { token: C.token, id: first })).status === 404, "deleting it twice is 'gone', not a second delete");
must((await post("/react", { token: B.token, id: first, e: "🔥", op: 1 })).status === 404,
  "nothing can be reacted to after it is deleted");
const quoting = "-" + Math.random().toString(36).slice(2, 8);
const replyId = "md-" + Math.random().toString(36).slice(2, 10);
const replied = await post("/send", { token: B.token, id: replyId, text: "quoting a ghost" + quoting, reply: { id: first, name: "x", text: "y" } });
must(replied.body?.ok === true, "a reply to a deleted line must still send");
const ghost = (await roomSaid()).find((m) => m.id === replyId) as { reply?: unknown } | undefined;
must(!!ghost && !ghost.reply, "the quote must come back empty, not invented: " + JSON.stringify(ghost));

// --- the flag is the only thing that opens the bin --------------------------
const second = await say(A.token, "the second thing anyone said");
must((await post("/admin/chatban", { key: ADMIN, id: C.id, chatBanned: true })).body?.ok === true, "chat ban failed");
const gagged = await post("/delete", { token: C.token, id: second });
must(gagged.status === 403 && gagged.body.reason === "chatban",
  "a moderator barred from the room must not reach into it: " + JSON.stringify(gagged.body));
must(await inRoom(second), "the barred moderator's delete must not have landed");
must((await post("/admin/chatban", { key: ADMIN, id: C.id, chatBanned: false })).body?.ok === true, "lifting the chat ban failed");
must((await post("/delete", { token: C.token, id: second })).body?.ok === true, "the moderator should work again once the ban is lifted");

const third = await say(A.token, "the third thing anyone said");
must((await setMod(C.id, false)).body?.mod === false, "revoking failed");
must((await j("/status?token=" + encodeURIComponent(C.token))).body.mod === false, "/status must report the revoked flag");
must((await post("/delete", { token: C.token, id: third })).status === 403, "a revoked moderator must not be able to delete");
must(await inRoom(third), "and the line must still be there");
// tung's own key still works, so the room can be cleaned without handing out a flag
must((await post("/delete", { key: ADMIN, id: third })).body?.ok === true, "the admin key must be able to delete");
must(!(await inRoom(third)), "the admin key's delete must land");

// ===========================================================================
// live: the casino really is shut to someone who has not been approved
// ===========================================================================
const waiting = await member("mdP");
must((await j("/status?token=" + encodeURIComponent(waiting.token))).body.status === "pending", "the applicant should be pending");
for (
  const [label, r] of [
    ["/cas/me", await j("/cas/me?token=" + encodeURIComponent(waiting.token))],
    ["/cas/dice", await post("/cas/dice", { token: waiting.token, bet: 0.1, target: 50 })],
    ["/duel/list", await j("/duel/list?token=" + encodeURIComponent(waiting.token))],
    ["/shop/list", await j("/shop/list?token=" + encodeURIComponent(waiting.token))],
  ] as const
) {
  must(r.status === 401, label + " must refuse an unapproved token, not just hide the tile: " + r.status);
}

console.log("moderation: ok — the bin works, only for moderators, and nobody can tell who they are");
