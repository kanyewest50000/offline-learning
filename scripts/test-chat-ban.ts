#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read
// The chat-only ban. `banned` shuts the whole shrine; `chatBanned` shuts the
// room and nothing else — the member cannot read a line and cannot post one,
// while the casino, the pit, the faucet, the shop, tips and the veil carry on
// exactly as before.
//
// Two halves are worth guarding. The room really is shut: every route that
// reads a line, writes one, or puts their name into it answers 403/blocked,
// including the ones that only *announce* something (a giveaway claim), and
// including someone who pads the request with the admin key to widen the
// history window. And nothing else moved: the tables are still open, which is
// the entire point of having a second flag instead of reusing the first.
//
//   ADMIN_KEY=devadminkey deno run --allow-net --allow-env --unstable-kv server.ts
//   ADMIN_KEY=devadminkey API=... deno run --allow-net --allow-env --allow-read scripts/test-chat-ban.ts

import { readShrine, ROOT } from "./shrine-sources.ts";

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
// source-level: the two gates must stay two gates
// ===========================================================================
const src = await Deno.readTextFile(`${ROOT}/server.ts`);

// pull one route handler out of the file so the assertions below are about that
// route and not about the word appearing somewhere else in 3700 lines.
function handler(match: string): string {
  const at = src.indexOf(match);
  must(at >= 0, "could not find the route: " + match);
  must(src.indexOf(match, at + 1) < 0, "the route guard is not unique: " + match);
  // a handler runs until the next top-level `  if (req.method` / `  if (path`
  const rest = src.slice(at + match.length);
  const end = rest.search(/\n  if \((?:req\.method|path)/);
  return rest.slice(0, end < 0 ? rest.length : end);
}

// every chat route goes through chatBlock(), never straight to blockState().
// this is the whole separation: miss one and that route stays open to a
// chat-banned member.
for (
  const route of [
    'req.method === "GET" && path === "/events"',
    'req.method === "POST" && path === "/send"',
    'req.method === "POST" && path === "/react"',
    'req.method === "POST" && path === "/gift/claim"',
  ]
) {
  const body = handler(route);
  must(body.includes("chatBlock("), route + " must gate on chatBlock()");
  must(!body.includes("blockState("), route + " must not call blockState() directly — that would ignore the chat ban");
}
// ...and the casino gate must NOT, or a chat ban would shut the tables too.
must(
  /async function casUser[\s\S]*?blockState\(u\)\.blocked/.test(src),
  "casUser must stay on blockState() so a chat ban never closes the casino",
);
must(
  /function chatBlock\([\s\S]*?if \(u\.chatBanned\) return \{ blocked: true, reason: "chatban"/.test(src),
  "chatBlock() must add the chat-only reason on top of blockState()",
);
// the flag is set through its own endpoint, and read back on the user list
must(src.includes('path === "/admin/chatban"'), "the admin needs a /admin/chatban endpoint");
must(/chatBanned: !!e\.value\.chatBanned/.test(src), "/admin/users must ship chatBanned");
must(/chatBanned: !!app\.value\.chatBanned/.test(src), "/status and /login must ship chatBanned");
must(src.includes("function setChatBan("), "the admin page needs a setChatBan()");
must(src.includes("ban from chat"), "the admin page needs a chat-ban button");
must(src.includes("restore chat access"), "the admin page needs a way to lift it");

// both clients paint the narrow ban as its own thing
const shrine = await readShrine();
must(shrine.includes('why==="chatban"'), "the shrine client must recognise the chatban reason");
must(shrine.includes("s.chatBanned"), "the shrine client must read chatBanned off /status");
const embed = await Deno.readTextFile(`${ROOT}/embed/chat.html`);
must(embed.includes('why === "chatban"'), "the embed must recognise the chatban reason");
must(embed.includes("s.chatBanned"), "the embed must read chatBanned off /status");

// ===========================================================================
// live: shut the room, leave the rest standing
// ===========================================================================
async function member(tag: string) {
  const name = tag + Math.random().toString(36).slice(2, 8);
  const a = await post("/apply", { username: name, application: "chat ban test" });
  const token = a.body?.token as string;
  must(!!token, "apply failed for " + name);
  const pend = await j("/admin/pending?key=" + encodeURIComponent(ADMIN));
  const id = (pend.body.pending as { username: string; id: string }[] || [])
    .find((x) => x.username === name)?.id;
  must(!!id, name + " not pending");
  must(!!(await post("/admin/decide", { key: ADMIN, id, action: "approve" })).body?.ok, "approve failed");
  return { name, token, id: id as string };
}
const chatBan = (id: string, on: boolean) => post("/admin/chatban", { key: ADMIN, id, chatBanned: on });
const events = (token: string, since = 0, extra = "") =>
  j("/events?since=" + since + "&token=" + encodeURIComponent(token) + extra);
// A fresh open (since=0) is capped at six a minute per token, and this test
// re-checks the gate far more often than that. The gate runs before any of the
// since handling, so an incremental poll answers the same question about who is
// blocked and why, out of a bucket roomy enough to ask it repeatedly.
const whyBlocked = async (token: string) => (await events(token, 1)).body.reason;
const say = (token: string, text: string) =>
  post("/send", { token, id: "cb-" + Math.random().toString(36).slice(2, 10), text });
// tung talks to himself on his own schedule; only count what members said
const roomSaid = async (): Promise<{ id: string; name: string; text: string }[]> =>
  ((await j("/admin/chat?key=" + encodeURIComponent(ADMIN))).body.messages as
    { id: string; name: string; text: string; from?: string }[] || [])
    .filter((m) => m.from !== "tung");

const A = await member("cbA");   // the one who loses the chat
const B = await member("cbB");   // the one who does not

// --- the key gates the endpoint at all -------------------------------------
must((await post("/admin/chatban", { id: A.id, chatBanned: true })).status === 403, "chatban must need the admin key");
must((await post("/admin/chatban", { key: ADMIN + "x", id: A.id, chatBanned: true })).status === 403, "a wrong key must not ban");
must((await post("/admin/chatban", { key: ADMIN, id: "nosuchid", chatBanned: true })).status === 404, "an unknown id is 404");

// --- before: A is an ordinary member ---------------------------------------
const said = await say(A.token, "i was here before the ban");
must(said.body?.ok === true, "A should be able to speak before the ban: " + JSON.stringify(said.body));
const beforeId = (await roomSaid()).find((m) => m.text === "i was here before the ban")?.id;
must(!!beforeId, "A's line should be in the room");
const openRead = await events(A.token);
must(!openRead.body.blocked, "A should be able to read before the ban");
must((await post("/gift/claim", { token: A.token, id: "nosuchgift" })).status === 404,
  "an un-banned member reaching for a gift that isn't there gets 'gone', not 'blocked'");

// B leaves a line for A to fail to react to
const bSaid = await say(B.token, "B is still talking");
must(bSaid.body?.ok === true, "B should be able to speak");
const bId = (await roomSaid()).find((m) => m.text === "B is still talking")?.id;
must(!!bId, "B's line should be in the room");

// --- the ban ----------------------------------------------------------------
const banned = await chatBan(A.id, true);
must(banned.body?.ok === true && banned.body?.chatBanned === true, "chat ban failed: " + JSON.stringify(banned.body));

// reading: a fresh open, an incremental poll, and an attempt to widen the
// window with the admin key all come back shut, with nothing of the room in them
for (
  const [label, r] of [
    ["fresh open", await events(A.token, 0)],
    ["incremental poll", await events(A.token, 1)],
    ["with the admin key bolted on", await events(A.token, 0, "&key=" + encodeURIComponent(ADMIN))],
  ] as const
) {
  must(r.body.blocked === true, "a chat-banned member must be blocked on " + label);
  must(r.body.reason === "chatban", label + " must name the chat ban, got " + JSON.stringify(r.body.reason));
  must(Array.isArray(r.body.events) && (r.body.events as unknown[]).length === 0,
    label + " must carry no events at all");
  must(!JSON.stringify(r.body).includes("B is still talking"), label + " must not leak a word of the room");
}

// writing: /send, /react and a giveaway claim are all refused
const gagged = await say(A.token, "can anyone hear me");
must(gagged.status === 403 && gagged.body.error === "blocked" && gagged.body.reason === "chatban",
  "/send must refuse a chat-banned member: " + gagged.status + " " + JSON.stringify(gagged.body));
must(!(await roomSaid()).some((m) => m.text === "can anyone hear me"), "the refused line must not reach the room");
const react = await post("/react", { token: A.token, id: bId, e: "🔥", op: 1 });
must(react.status === 403 && react.body.reason === "chatban", "/react must refuse a chat-banned member: " + JSON.stringify(react.body));
const gift = await post("/gift/claim", { token: A.token, id: "nosuchgift" });
must(gift.status === 403 && gift.body.error === "blocked",
  "a giveaway claim announces the claimant in the room, so it must be refused too: " +
    gift.status + " " + JSON.stringify(gift.body));

// what the clients are told: shrine-wide access is NOT revoked
for (
  const [label, body] of [
    ["/status", (await j("/status?token=" + encodeURIComponent(A.token))).body],
    ["/login", (await post("/login", { token: A.token })).body],
  ] as const
) {
  must(body.status === "approved", label + " must still say approved");
  must(body.chatBanned === true, label + " must report the chat ban");
  must(body.blocked !== true, label + " must NOT report a shrine-wide block — that would shut the casino gate");
}

// --- everything that is not the chat still works ---------------------------
const me = await j("/cas/me?token=" + encodeURIComponent(A.token));
must(me.status === 200 && me.body.username === A.name, "the casino must still know a chat-banned member: " + JSON.stringify(me.body));
const faucet = await post("/cas/claim", { token: A.token });
must(faucet.body?.ok === true || faucet.body?.error === "cooldown", "the faucet must still run: " + JSON.stringify(faucet.body));
const dice = await post("/cas/dice", { token: A.token, bet: 0.1, target: 50 });
must(dice.status === 200 && dice.body.error === undefined, "the tables must still take a bet: " + JSON.stringify(dice.body));
must((await j("/duel/list?token=" + encodeURIComponent(A.token))).status === 200, "the pit must stay open");
must((await j("/shop/list?token=" + encodeURIComponent(A.token))).status === 200, "the shop must stay open");
must((await j("/tip/profile?token=" + encodeURIComponent(A.token) + "&user=" + encodeURIComponent(B.name))).status === 200,
  "profiles must stay readable");
const veil = await j("/veil?token=" + encodeURIComponent(A.token));
must(veil.body.error !== "blocked", "the veil must not treat a chat ban as a block: " + JSON.stringify(veil.body));
// and they can still be paid: B tips A
const tipped = await post("/tip", { token: B.token, to: A.name, amount: 0.1 });
must(tipped.body?.ok === true || tipped.body?.error === "insufficient",
  "a chat-banned member must still be able to receive: " + JSON.stringify(tipped.body));

// --- the room carries on without them --------------------------------------
const bAfter = await say(B.token, "B carried on");
must(bAfter.body?.ok === true, "B must be unaffected by A's ban");
const bRead = await events(B.token);
must(!bRead.body.blocked, "B must still be able to read");
must(JSON.stringify(bRead.body).includes("i was here before the ban"),
  "a chat ban is not a purge — what they already said stays where it is");

// ===========================================================================
// the two flags are independent, and the wider one wins the wording
// ===========================================================================
must((await post("/admin/ban", { key: ADMIN, id: A.id, banned: true })).body?.ok === true, "full ban failed");
must((await j("/cas/me?token=" + encodeURIComponent(A.token))).status === 401, "a full ban must shut the casino");
must(await whyBlocked(A.token) === "banned", "a full ban outranks the chat ban in the wording");
// lifting the full ban must not lift the chat ban
must((await post("/admin/ban", { key: ADMIN, id: A.id, banned: false })).body?.ok === true, "unban failed");
must((await j("/cas/me?token=" + encodeURIComponent(A.token))).status === 200, "the casino reopens with the full ban lifted");
must(await whyBlocked(A.token) === "chatban", "lifting the full ban must leave the chat ban standing");

// a live timeout outranks it too, and clearing the timeout leaves it standing
must((await post("/admin/timeout", { key: ADMIN, id: A.id, until: Date.now() + 60_000 })).body?.ok === true, "timeout failed");
must(await whyBlocked(A.token) === "timeout", "a live timeout outranks the chat ban in the wording");
must((await post("/admin/timeout", { key: ADMIN, id: A.id, until: 0 })).body?.ok === true, "clearing the timeout failed");
must(await whyBlocked(A.token) === "chatban", "clearing a timeout must leave the chat ban standing");

// the user list shows it, and shows it separately from `banned`
const listed = (await j("/admin/users?key=" + encodeURIComponent(ADMIN))).body.users as
  { id: string; banned: boolean; chatBanned: boolean }[];
const rowA = listed.find((u) => u.id === A.id);
must(!!rowA && rowA.chatBanned === true && rowA.banned === false, "the admin list must show A as chat-banned only");
must(listed.find((u) => u.id === B.id)?.chatBanned === false, "B must not be marked");

// ===========================================================================
// lifting it gives the room back
// ===========================================================================
must((await chatBan(A.id, false)).body?.chatBanned === false, "lifting the chat ban failed");
const back = await events(A.token);
must(!back.body.blocked, "A must be able to read again: " + JSON.stringify(back.body));
must(JSON.stringify(back.body).includes("B carried on"), "A must get the room back, including what they missed");
const speaks = await say(A.token, "i can hear you again");
must(speaks.body?.ok === true, "A must be able to speak again: " + JSON.stringify(speaks.body));
must((await roomSaid()).some((m) => m.text === "i can hear you again"), "A's line must land in the room again");

console.log(
  "chat ban: the room is shut both ways (events, send, react, gift claim — and the admin key " +
    "does not widen it), /status and /login keep the shrine-wide verdict separate, the casino, " +
    "pit, faucet, shop, tips and veil all stay open, the flag is independent of `banned` and of " +
    "timeouts, and lifting it hands the room back",
);
