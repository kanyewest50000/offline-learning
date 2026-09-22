#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read
// Direct messages. The room is one stream everybody reads; a DM is a stream of
// its own, keyed by the pair, and that is the whole access story — the id of a
// conversation is built from both members' ids, so the only conversations you
// can name are the ones you are in. There is no per-message check to forget.
//
// Four things are worth guarding.
//
// Delivery and privacy: a line reaches exactly the other end, `mine` is right
// on both sides, and a third member cannot read it however they ask — by name,
// by id, or by guessing the pair.
//
// The badge: a line the recipient has not opened counts as unread, opening the
// conversation is what clears it, reading never un-reads anything, and the
// sender never badges themselves.
//
// The chat ban, in BOTH directions: someone shut out of the room can neither
// send a DM nor be sent one. A ban that left DMs open would not be a ban, it
// would be a change of venue; one that only stopped them sending would leave
// everybody else free to talk AT them. The other side is told the conversation
// is closed rather than that the member is gone.
//
// And the clients: the room and the rail are one pane, so the room has to
// survive being left and come back whole.
//
//   ADMIN_KEY=devadminkey deno run --allow-net --allow-env --unstable-kv server.ts
//   ADMIN_KEY=devadminkey API=... deno run --allow-net --allow-env --allow-read scripts/test-dm.ts

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
// source-level: the gate is the same one the room uses, on every route
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

// A DM is chat, so it goes through chatBlock() like every other chat route —
// never straight to blockState(), which would ignore the chat-only ban.
for (
  const route of [
    'req.method === "GET" && path === "/dm/list"',
    'req.method === "GET" && path === "/dm/with"',
    'req.method === "POST" && path === "/dm/send"',
  ]
) {
  const body = handler(route);
  must(body.includes("chatBlock(u)"), route + " must gate the caller on chatBlock()");
  must(!body.includes("blockState("), route + " must not call blockState() directly — that would ignore the chat ban");
}
// the two routes that reach a second member gate that member too, or a chat
// ban would only be half a ban
for (const route of ['req.method === "GET" && path === "/dm/with"', 'req.method === "POST" && path === "/dm/send"']) {
  must(handler(route).includes("chatBlock(other)"), route + " must gate the OTHER end too");
}
// the conversation id is derived, never taken from the request
must(
  /function convOf\(a: string, b: string\): string \{\s*return a < b \? a \+ "~" \+ b : b \+ "~" \+ a;/.test(src),
  "convOf() must sort the pair so both sides name the same conversation",
);
must(!/params\.get\("conv"\)|b\.conv\b/.test(src), "no route may take a conversation id from the client");
// a message and both sides' view of it land together or not at all
const append = src.slice(src.indexOf("async function dmAppend("));
must(
  /\.check\(seqE\)\.check\(mineE\)\.check\(theirsE\)/.test(append),
  "dmAppend() must guard the counter and both conversation rows in one commit",
);
must(
  /read: Number\(theirsE\.value\?\.read\) \|\| 0/.test(append),
  "dmAppend() must leave the recipient's read mark alone — that is the unread count",
);

// the clients: a rail beside the room, and a way into a DM from a name in it
const shrine = await readShrine();
for (
  const bit of [
    ['id="dmrail"', "the conversation rail"],
    ['id="dmlist"', "the list of conversations"],
    ['id="convhead"', "a header naming the open conversation"],
    ['id="profDm"', "a send-a-message button on the profile card"],
    ["/dm/list", "the list poll"],
    ["/dm/with", "the conversation poll"],
    ["/dm/send", "the composer"],
  ] as const
) {
  must(shrine.includes(bit[0]), "the shrine client is missing " + bit[1] + " (" + bit[0] + ")");
}
must(shrine.includes("function openRoom("), "the client must be able to go back to the room");
must(/#dmrail\{flex:0 0 \d+px/.test(shrine), "the rail needs a fixed width beside the room");
// A rail row is a <button>, and the skins re-declare `button` as an attribute
// plus an element — which outranks a bare `.dmrow` in the base sheet. Without a
// themed `.dmrow` of its own, every unselected row wears the solid button
// colour the moment somebody puts a skin on.
must(
  /'& \.dmrow\{background:transparent\}'/.test(shrine),
  "the skins must re-declare .dmrow's background, or `button` wins the rail",
);
must(/'& \.dmrow\.on\{/.test(shrine), "the skins must say which row is the open one");

// ===========================================================================
// live
// ===========================================================================
async function member(tag: string) {
  const name = tag + Math.random().toString(36).slice(2, 8);
  const a = await post("/apply", { username: name, application: "dm test" });
  const token = a.body?.token as string;
  must(!!token, "apply failed for " + name);
  const pend = await j("/admin/pending?key=" + encodeURIComponent(ADMIN));
  const id = (pend.body.pending as { username: string; id: string }[] || [])
    .find((x) => x.username === name)?.id;
  must(!!id, name + " not pending");
  must(!!(await post("/admin/decide", { key: ADMIN, id, action: "approve" })).body?.ok, "approve failed");
  return { name, token, id: id as string };
}

type Conv = { id: string; name: string; last: string; ts: number; unread: number };
const convs = async (token: string): Promise<Conv[]> =>
  ((await j("/dm/list?token=" + encodeURIComponent(token))).body.convs as Conv[]) || [];
const convWith = (token: string, who: string, since = 0) =>
  j("/dm/with?token=" + encodeURIComponent(token) + "&with=" + encodeURIComponent(who) + "&since=" + since);
const dm = (token: string, to: string, text: string) => post("/dm/send", { token, to, text });
const chatBan = (id: string, on: boolean) => post("/admin/chatban", { key: ADMIN, id, chatBanned: on });

// /dm/send shares the room's flood cap (MSG_MAX per MSG_WINDOW_MS). This test
// sends far more often than a person would, so wait out the window rather than
// read a 429 as a refusal.
async function sendOk(token: string, to: string, text: string) {
  for (let i = 0; i < 8; i++) {
    const r = await dm(token, to, text);
    if (r.status !== 429) return r;
    await new Promise((res) => setTimeout(res, 2500));
  }
  throw new Error("still rate-limited after waiting: " + text);
}

const A = await member("dmA");
const B = await member("dmB");
const C = await member("dmC");   // the one who must never see any of it

// --- nothing to show before anything is said --------------------------------
must((await convs(A.token)).length === 0, "a new member has no conversations");
const emptyOpen = await convWith(A.token, B.name);
must(emptyOpen.status === 200 && (emptyOpen.body.msgs as unknown[]).length === 0,
  "opening a conversation that does not exist yet is empty, not an error: " + JSON.stringify(emptyOpen.body));
must((await convs(A.token)).length === 0, "merely looking must not create a conversation");

// --- refusals ----------------------------------------------------------------
must((await dm(A.token + "x", B.name, "hi")).status === 401, "a bad token cannot send");
must((await dm(A.token, A.name, "hi")).body.error === "yourself", "nobody DMs themselves");
must((await dm(A.token, A.id, "hi")).body.error === "yourself", "…by id either");
must((await dm(A.token, "nosuchmemberatall", "hi")).body.error === "not_found", "an unknown recipient is not_found");
must((await dm(A.token, B.name, "   ")).body.error === "empty", "an empty line is refused");
must((await j("/dm/list")).status === 401, "the list needs a token");
must((await convWith(A.token, "nosuchmemberatall")).status === 404, "reading an unknown conversation is 404");
must((await convWith(A.token, A.name)).body.error === "yourself", "…and you are not a conversation");

// --- a line lands, once, on both sides --------------------------------------
const sent = await sendOk(A.token, B.name, "meet me behind the shrine");
must(sent.body?.ok === true, "A should be able to DM B: " + JSON.stringify(sent.body));
must((sent.body.msg as { mine: boolean }).mine === true, "the sender's own line comes back as theirs");

const bSees = await convWith(B.token, A.name);
const bMsgs = bSees.body.msgs as { text: string; mine: boolean; seq: number }[];
must(bMsgs.length === 1 && bMsgs[0].text === "meet me behind the shrine",
  "B must get exactly the line A sent: " + JSON.stringify(bMsgs));
must(bMsgs[0].mine === false, "B did not write it");
must((bSees.body.with as { name: string }).name === A.name, "the conversation names the other end");

// a name and an id are the same conversation, not two
must(!!(await sendOk(B.token, A.id, "behind which shrine")).body?.ok, "addressing by id works");
const aSees = await convWith(A.token, B.name);
must((aSees.body.msgs as unknown[]).length === 2, "one conversation, both lines: " + JSON.stringify(aSees.body.msgs));
must((await convs(A.token)).length === 1, "…and one row in the list");
const byId = await convWith(A.token, B.id);
must(JSON.stringify(byId.body.msgs) === JSON.stringify(aSees.body.msgs),
  "naming the other end by id must open the same conversation as by name");

// --- C cannot get at it, however they ask ------------------------------------
must((await convs(C.token)).length === 0, "C has no conversations");
for (
  const [label, r] of [
    ["by A's name", await convWith(C.token, A.name)],
    ["by A's id", await convWith(C.token, A.id)],
    ["by B's name", await convWith(C.token, B.name)],
  ] as const
) {
  must((r.body.msgs as unknown[]).length === 0, "C must see nothing " + label);
  must(!JSON.stringify(r.body).includes("behind the shrine"), "C must not get a word of it " + label);
}

// --- the badge ----------------------------------------------------------------
// A has read everything they have opened; B has an unread line waiting
must((await convs(A.token)).find((c) => c.id === B.id)?.unread === 0,
  "A opened the conversation last, so nothing is unread");
await sendOk(A.token, B.name, "the one with the vending machine");
await sendOk(A.token, B.name, "bring sahurs");
const bRow = (await convs(B.token)).find((c) => c.id === A.id);
must(!!bRow, "B's list must carry the conversation");
must(bRow!.unread === 2, "B has two unread, got " + bRow!.unread);
must(bRow!.last === "bring sahurs", "the list previews the newest line, got " + JSON.stringify(bRow!.last));
must((await convs(A.token)).find((c) => c.id === B.id)?.unread === 0, "a sender never badges themselves");

// opening it is what clears the badge
const bOpen = await convWith(B.token, A.name);
must((bOpen.body.msgs as unknown[]).length === 4, "opening replays the conversation");
must((await convs(B.token)).find((c) => c.id === A.id)?.unread === 0, "reading clears the badge");
// and an incremental poll that brings back nothing does not un-read it
const tip = bOpen.body.seq as number;
must(((await convWith(B.token, A.name, tip)).body.msgs as unknown[]).length === 0, "since=seq is a quiet poll");
must((await convs(B.token)).find((c) => c.id === A.id)?.unread === 0, "a quiet poll leaves the badge cleared");
// a stale `since` does not roll the read mark backwards either
await convWith(B.token, A.name, 1);
must((await convs(B.token)).find((c) => c.id === A.id)?.unread === 0, "the read mark only ever moves forward");

// the rail is ordered by who spoke last
await sendOk(C.token, B.name, "unrelated business");
const bList = await convs(B.token);
must(bList.length === 2, "B has two conversations now");
must(bList[0].id === C.id, "the newest conversation sorts first, got " + JSON.stringify(bList.map((c) => c.name)));

// ===========================================================================
// the chat ban, both directions
// ===========================================================================
must((await chatBan(A.id, true)).body?.chatBanned === true, "chat ban failed");

const gagged = await dm(A.token, B.name, "let me out");
must(gagged.status === 403 && gagged.body.error === "blocked" && gagged.body.reason === "chatban",
  "a chat-banned member cannot send a DM: " + gagged.status + " " + JSON.stringify(gagged.body));
must((await j("/dm/list?token=" + encodeURIComponent(A.token))).body.reason === "chatban",
  "…nor list their conversations");
must((await convWith(A.token, B.name)).body.reason === "chatban", "…nor read one");

const toThem = await dm(B.token, A.name, "are you there");
must(toThem.status === 403 && toThem.body.error === "closed",
  "nobody can DM a chat-banned member: " + toThem.status + " " + JSON.stringify(toThem.body));
const closed = await convWith(B.token, A.name);
must(closed.body.closed === true && (closed.body.msgs as unknown[]).length === 0,
  "the other side reads as closed rather than gone: " + JSON.stringify(closed.body));
must(!JSON.stringify(closed.body).includes("vending machine"),
  "a closed conversation shows none of its history");
// nothing of the refused line was written
must(!(await convs(B.token)).some((c) => c.last === "are you there"), "a refused DM must not reach the list");

// the ban is the chat's, not the shrine's: the tables are still open
must((await j("/cas/me?token=" + encodeURIComponent(A.token))).status === 200,
  "a chat ban must not close the casino");

// --- lifting it hands the conversation back ----------------------------------
must((await chatBan(A.id, false)).body?.chatBanned === false, "lifting the chat ban failed");
must(!!(await sendOk(A.token, B.name, "i can write again")).body?.ok, "A must be able to DM again");
const backList = await convs(A.token);
must(backList.length === 1 && backList[0].id === B.id, "A's conversations come back");
const backOpen = await convWith(B.token, A.name);
must(JSON.stringify(backOpen.body.msgs).includes("vending machine"),
  "a chat ban is not a purge — the conversation is where they left it");
must(JSON.stringify(backOpen.body.msgs).includes("i can write again"), "…with the new line on the end");
must(!JSON.stringify(backOpen.body.msgs).includes("let me out"), "the line refused during the ban was never written");

// ===========================================================================
// blocking
//
// A block is one member shutting one conversation, and it shuts it BOTH ways:
// a block that only stopped them writing would leave you writing at somebody
// who cannot answer. The end that set it is told so, because theirs is a door
// they can open — and the end that was blocked is told too, by name: "you have
// been blocked by X", rather than a dead composer and a guess. It is a DM
// matter only; the room shows both of them to each other exactly as before.
// ===========================================================================
const blk = (token: string, to: string, on: boolean) =>
  post("/dm/block", { token, to, blocked: on });

const P = await member("dmP");   // does the blocking
const Q = await member("dmQ");   // gets blocked

await sendOk(P.token, Q.name, "before the falling out");
await sendOk(Q.token, P.name, "and a reply");

// --- refusals ---------------------------------------------------------------
must((await blk(P.token + "x", Q.id, true)).status === 401, "a bad token cannot block");
must((await blk(P.token, P.id, true)).body.error === "yourself", "nobody blocks themselves");
must((await blk(P.token, "nosuchmemberatall", true)).body.error === "not_found", "an unknown member is not_found");

// --- the block --------------------------------------------------------------
const on = await blk(P.token, Q.id, true);
must(on.body?.ok === true && on.body.blocked === true && on.body.byYou === true,
  "blocking failed: " + JSON.stringify(on.body));

// neither of them can write
const pWrite = await dm(P.token, Q.id, "still cross");
must(pWrite.status === 403 && pWrite.body.error === "you_blocked",
  "the blocker is told it was them: " + JSON.stringify(pWrite.body));
const qWrite = await dm(Q.token, P.id, "what did i do");
must(qWrite.status === 403 && qWrite.body.error === "blocked_you" && qWrite.body.name === P.name,
  "a block must stop the other end too, and say whose it is: " + JSON.stringify(qWrite.body));

// neither of them can read it
const pSees = await convWith(P.token, Q.id);
must(pSees.body.closed === true && pSees.body.byYou === true, "the blocker sees their own block");
must((pSees.body.msgs as unknown[]).length === 0, "a shut conversation shows nothing");
const qSees = await convWith(Q.token, P.id);
must(qSees.body.closed === true, "the other end sees it closed");
must(qSees.body.byYou === undefined, "…not as their own block: " + JSON.stringify(qSees.body));
must(qSees.body.byThem === true, "…but as P's, so the page can say who: " + JSON.stringify(qSees.body));
must((qSees.body.with as { name?: string })?.name === P.name, "…and the name to say is P's");
must(pSees.body.byThem === undefined, "P was not blocked by anybody: " + JSON.stringify(pSees.body));
must(!JSON.stringify(qSees.body).includes("falling out"), "a shut conversation shows no history");

// and it is a DM matter only: the room still carries both of them, both ways
const saidP = "p says something in the room " + Math.random().toString(36).slice(2, 6);
const saidQ = "q answers in the room " + Math.random().toString(36).slice(2, 6);
must((await post("/send", { token: P.token, text: saidP })).body?.ok === true, "P could not speak in the room");
must((await post("/send", { token: Q.token, text: saidQ })).body?.ok === true, "Q could not speak in the room");
for (const [who, tok] of [["P", P.token], ["Q", Q.token]] as const) {
  const room = JSON.stringify((await j("/events?since=0&token=" + encodeURIComponent(tok))).body);
  must(room.includes(saidP) && room.includes(saidQ), who + " must still see both of them in the room");
}

// a blocked conversation is not a source of unread
const pRow = (await convs(P.token)).find((c) => c.id === Q.id) as Conv & { closed?: boolean; byYou?: boolean };
must(pRow?.closed === true && pRow?.byYou === true, "the blocker's rail says it was theirs");
must(pRow?.unread === 0, "nothing waits in a conversation that is shut");
const qRow = (await convs(Q.token)).find((c) => c.id === P.id) as Conv & { closed?: boolean; byYou?: boolean; byThem?: boolean };
must(qRow?.closed === true, "the other end's rail shows it closed");
must(qRow?.byYou !== true, "…but never as theirs");
must(qRow?.byThem === true, "…and as P's block, so the row can say they were blocked");
must((pRow as { byThem?: boolean }).byThem === false, "P's own row was not blocked by Q");

// --- the two sides are independent ------------------------------------------
// Q clearing "their" block must not lift P's, or anybody could undo being
// blocked by blocking and unblocking in turn.
must((await blk(Q.token, P.id, false)).body?.blocked === true,
  "the other end must not be able to lift a block that is not theirs");
must((await convWith(P.token, Q.id)).body.closed === true, "P's block is still standing");
// and both ends blocking at once survives one of them relenting
must((await blk(Q.token, P.id, true)).body?.byYou === true, "Q can set their own block");
must((await blk(Q.token, P.id, false)).body?.blocked === true, "P's block outlives Q's");

// --- lifting it -------------------------------------------------------------
const off = await blk(P.token, Q.id, false);
must(off.body?.ok === true && off.body.blocked === false, "unblocking failed: " + JSON.stringify(off.body));
const back = await convWith(P.token, Q.id);
must(!back.body.closed, "the conversation reopens");
must(JSON.stringify(back.body.msgs).includes("before the falling out"),
  "a block is not a purge — the conversation is where they left it");
must(JSON.stringify(back.body.msgs).includes("and a reply"), "…both sides of it");
must(!JSON.stringify(back.body.msgs).includes("still cross"), "lines refused during the block were never written");
must(!!(await sendOk(Q.token, P.name, "friends again")).body?.ok, "and they can write again");

// --- a chat ban still outranks it -------------------------------------------
must((await chatBan(Q.id, true)).body?.chatBanned === true, "chat ban failed");
must((await dm(P.token, Q.id, "hello")).body.error === "closed",
  "a chat-banned member is closed whether or not anybody blocked them");
must((await chatBan(Q.id, false)).body?.chatBanned === false, "lifting the chat ban failed");

// --- and the client has the control ------------------------------------------
must(shrine.includes('id="convBlock"'), "the conversation header needs a block control");
must(shrine.includes("/dm/block"), "the client must be able to set one");
must(/function dmSetShut\(/.test(shrine), "the client must paint the shut state");
// the blocked end must not be handed a button that cannot work
must(/DMSHUT\.on&&!DMSHUT\.mine.*display="none"/.test(shrine),
  "the control must be hidden from the end that did not set it");
// and the blocked end is told, in words, by whom
must(shrine.includes('"you have been blocked by "+n+"."'), "the page must say who blocked them");
must(shrine.includes('r.error==="blocked_you"'), "a refused send must be read as a block");
must(shrine.includes("dmSetShut(true,!!r.byYou,!!r.byThem)"), "the poll must pass on whose block it is");
must(shrine.includes('c.byThem?"blocked you"'), "the rail row must say it too");
must(shrine.includes('d.className="dmnotice"'), "and the empty conversation must say it where it can be seen");

console.log(
  "DMs: a line reaches one other member and nobody else (by name or by id, and a third " +
    "member cannot reach it either way), the unread badge counts what is waiting and only " +
    "reading clears it, the rail sorts by who spoke last, and a chat ban shuts DMs in both " +
    "directions — they cannot send, nobody can send to them, the other side reads as closed " +
    "rather than gone, the casino stays open throughout, and lifting it hands the " +
    "conversation back intact. A block shuts one conversation the same way in both " +
    "directions, tells the end that set it and tells the other end who blocked them, " +
    "leaves the room showing both of them to each other, " +
    "keeps the two sides independent, and gives the conversation back whole when lifted",
);
