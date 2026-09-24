#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read
// A timeout, or a ban, shuts the whole shrine — and the page says so once,
// over everything, wherever the member is standing.
//
// It used to be the room's ban screen: the Shrine tile showed it and "back"
// walked straight past it to the catalog, tung's originals and the rest, each
// of which found out on its own when clicked, or never. Now the page has one
// lockout screen over the whole document. It goes up the moment anything the
// page already asks — /status on open, the room's poll that runs under every
// view, the casino being refused — says the account is timed out or banned; it
// stops everything behind it and closes the game tabs the page opened; it
// counts a timeout down and lifts itself. Nothing on the server changed for
// it: this file checks the client, and that the answers it relies on are there.
// A chat ban is still the room's own, narrower screen.
//
//   ADMIN_KEY=devadminkey deno run --allow-net --allow-env --unstable-kv server.ts
//   ADMIN_KEY=devadminkey API=... deno run --allow-net --allow-env --allow-read scripts/test-lockout.ts

import { readShrineFile } from "./shrine-sources.ts";

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

// ===========================================================================
// the screen: last in the document, above every layer, and everything under
// it out of reach rather than merely covered
// ===========================================================================
const markup = await readShrineFile("assets/js/shrine/markup.js");
const styles = await readShrineFile("assets/js/shrine/styles.js");
const chat = await readShrineFile("assets/js/shrine/chat.js");
const casino = await readShrineFile("assets/js/shrine/casino.js");

const lockAt = markup.indexOf('<div id="lockout"');
must(lockAt > 0, "the markup needs the lockout screen");
must(markup.indexOf("'<div id=", lockAt + 10) < 0, "…and it must be the last thing in the body, on top of everything");
for (const id of ["lockTitle", "lockWhy", "lockLeft", "lockUntil"]) must(markup.includes('id="' + id + '"'), "the lockout needs #" + id);
const lockZ = Number((styles.match(/#lockout\{[^}]*z-index:(\d+)/) || [])[1]);
must(lockZ > 0, "the lockout needs a z-index");
const others = [...styles.matchAll(/z-index:(\d+)/g)].map((m) => Number(m[1])).filter((z) => z !== lockZ);
must(others.every((z) => z < lockZ), "nothing may sit above the lockout: " + Math.max(...others) + " vs " + lockZ);
must(styles.includes("body.locked>*:not(#lockout){visibility:hidden}"),
  "everything behind it must be hidden, so it cannot be tabbed to or clicked through");
must(styles.includes("& #lockout{background:{bgSunk}}"), "a skin must repaint it like the rest of the page");

// ===========================================================================
// the client: what puts it up, what it stops, what it refuses, what lifts it
// ===========================================================================
// whatever hears it first: /status (refreshGate), the room's poll (showBan), the casino
must(chat.includes('function showBan(info){if(info&&(info.reason==="timeout"||info.reason==="banned")){lockOut(info);return;}'),
  "a timeout or a ban heard anywhere must become the lockout, not the room's screen");
must(chat.includes("if(s.blocked){showBan(s);}"), "the /status check on open must still route a block through it");
must(/if\(r&&r\.blocked\)\{showBan\(r\);return;\}/.test(chat), "and so must the room's poll, which runs under every view");
must(chat.includes('window.__shrineLock=function(s){if(s&&(s.reason==="timeout"||s.reason==="banned"))lockOut(s);};'),
  "the casino needs a way to put it up");
must(/if\(s\.blocked\)\{\s*\/\*[\s\S]*?\*\/\s*if\(window\.__shrineLock\)\{window\.__shrineLock\(s\);return;\}/.test(casino),
  "a refused casino must hand a timeout or ban to the page's lockout rather than paint its own");
// what it stops
const lockOut = chat.slice(chat.indexOf("function lockOut(info){"), chat.indexOf("function unlock(){"));
for (const [bit, what] of [
  ["polling=false;if(pollT){clearTimeout(pollT);pollT=null;}", "the room's poll"],
  ["if(dmListT){clearInterval(dmListT);dmListT=null;}dmStop();", "the conversations"],
  ["if(window.__casinoHalt)window.__casinoHalt();", "the casino, the round's poll included"],
  ["closePlays();", "every game tab this page opened"],
  ['topShow("shrine");', "whatever view was open"],
  ['document.body.classList.add("locked");', "the page behind it"],
] as const) {
  must(lockOut.includes(bit), "the lockout must stop " + what);
}
must(casino.includes("window.__casinoHalt=function(){clearTimer();hideWin();roundStop();};"),
  "the casino's halt must stop the table polls and the round's poll");
must(chat.includes("PLAYS=PLAYS.filter(function(x){try{return !x.closed;}catch(e){return false;}});PLAYS.push(w);"),
  "every tab openPlay opens (the catalog, the originals, the veil) must be remembered so it can be closed");
must(chat.includes("function closePlays(){for(var i=0;i<PLAYS.length;i++){try{if(PLAYS[i]&&!PLAYS[i].closed)PLAYS[i].close();}catch(e){}}PLAYS=[];}"),
  "and closed");
// what it refuses while it is up
must(chat.includes('function topShow(v){if(LOCKED)v="shrine";'), "no other view may be shown while locked");
must(chat.includes("function openPlay(g){' +\n    'if(LOCKED)return;") || /function openPlay\(g\)\{' \+\s*'if\(LOCKED\)return;/.test(chat),
  "no game may be opened while locked");
must(chat.includes('if(!APPROVED||LOCKED)return;topShow("casino");'), "nor the casino");
must(/chooseVeil\.addEventListener\("click",function\(\)\{' \+\s*'if\(LOCKED\)return;/.test(chat), "nor the veil");
must(chat.includes("if(LOCKED){refreshGate();return;}"), "coming back to the tab asks again and wakes nothing else");
// how it comes down
must(chat.includes('if(LOCKED&&!(s&&s.status==="approved"&&s.blocked))unlock();'),
  "an answer that is no longer a block must take it down");
must(/lockTick=setInterval\(function\(\)\{if\(!LOCKED\)return;lockPaint\(\);if\(!LOCKED\.asked&&Date\.now\(\)>=LOCKED\.until\)\{LOCKED\.asked=true;refreshGate\(\);\}\},1000\)/.test(chat),
  "a timeout counts down and asks once when it runs out");
must(chat.includes('if(LOCKED.reason!=="banned"&&!pageHidden())statusT=setTimeout(refreshGate,5000);'),
  "a timeout lifted early from the panel is picked up by the same five-second check the ban screen used");
// the words
must(chat.includes('"you are timed out":"you are banned"'), "it says which it is");
must(chat.includes('"lifts in "+lockFmt(left)'), "and how long a timeout has left");


// ===========================================================================
// the answers it relies on — already there, nothing new asked for
// ===========================================================================
async function member(tag: string) {
  const name = tag + Math.random().toString(36).slice(2, 8);
  let a = await post("/apply", { username: name, application: "lockout test" });
  for (let i = 0; a.body?.error === "slow down" && i < 15; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    a = await post("/apply", { username: name, application: "lockout test" });
  }
  const token = a.body?.token as string;
  must(!!token, "apply failed for " + name + ": " + JSON.stringify(a.body));
  const pend = await j("/admin/pending?key=" + encodeURIComponent(ADMIN));
  const id = (pend.body.pending as { username: string; id: string }[] || []).find((x) => x.username === name)?.id;
  must(!!id, name + " not pending");
  must(!!(await post("/admin/decide", { key: ADMIN, id, action: "approve" })).body?.ok, "approve failed");
  return { name, token, id: id as string };
}
const status = async (tok: string) => (await j("/status?token=" + encodeURIComponent(tok))).body;
const events = async (tok: string) => (await j("/events?since=0&token=" + encodeURIComponent(tok))).body;

const T = await member("lkT"), B = await member("lkB"), C = await member("lkC");
const until = Date.now() + 10 * 60 * 1000;
must(!!(await post("/admin/timeout", { key: ADMIN, id: T.id, until })).body?.ok, "timeout failed");
must(!!(await post("/admin/ban", { key: ADMIN, id: B.id, banned: true })).body?.ok, "ban failed");
must(!!(await post("/admin/chatban", { key: ADMIN, id: C.id, chatBanned: true })).body?.ok, "chat ban failed");

const st = await status(T.token);
must(st.blocked === true && st.reason === "timeout" && st.until === until, "/status must say timeout, and until when: " + JSON.stringify(st));
const ev = await events(T.token);
must(ev.blocked === true && ev.reason === "timeout", "the room's poll must say it too: " + JSON.stringify(ev));
const sb = await status(B.token);
must(sb.blocked === true && sb.reason === "banned", "/status must say banned: " + JSON.stringify(sb));
const sc = await status(C.token);
must(sc.blocked === false && sc.chatBanned === true, "a chat ban is not a block — it stays the room's own: " + JSON.stringify(sc));
must((await events(C.token)).reason === "chatban", "and the room's poll names it as such");

// ---- a reason, and sahur's own catch ----
must(markup.includes('<p id="lockNote"></p>'), "the lockout needs a line for tung's words");
must(chat.includes('lockTitleEl.textContent=sah?"sahur caught you":(to?"you are timed out":"you are banned");'),
  "a timeout for farming sahurs is sahur's catch");
must(chat.includes('"tung says: \\u201c"+LOCKED.why+"\\u201d"'), "and any timeout can say why");
must(chat.includes('why:String((info&&info.why)||"").slice(0,200),kind:info&&info.kind==="sahur"?"sahur":""'),
  "whatever puts the screen up hands both over");
const embedChat = await Deno.readTextFile(new URL("../embed/chat.html", import.meta.url));
must(embedChat.includes('"sahur caught you"') && embedChat.includes("tung says:"), "the embed says the same");
const W = await member("lkW");
const why = "you know what you did. " + "x".repeat(400);
must(!!(await post("/admin/timeout", { key: ADMIN, id: W.id, until, why, kind: "sahur" })).body?.ok, "timeout with a reason failed");
const ws = await status(W.token);
must(ws.blocked === true && ws.kind === "sahur" && typeof ws.why === "string" && (ws.why as string).length === 200 &&
  (ws.why as string).startsWith("you know what you did."), "/status carries the reason (clipped) and the catch: " + JSON.stringify(ws).slice(0, 300));
const we = await events(W.token);
must(we.kind === "sahur" && typeof we.why === "string", "so does the room's poll");
const wl = await post("/login", { token: W.token });
must(wl.body.kind === "sahur" && typeof wl.body.why === "string", "and /login");
must(!!(await post("/admin/timeout", { key: ADMIN, id: W.id, until, kind: "whatever" })).body?.ok, "re-timeout failed");
const ws2 = await status(W.token);
must(ws2.blocked === true && ws2.why === undefined && ws2.kind === undefined, "a new timeout without them has neither: " + JSON.stringify(ws2));
await post("/admin/timeout", { key: ADMIN, id: W.id, until, why: "spam", kind: "sahur" });
must(!!(await post("/admin/timeout", { key: ADMIN, id: W.id, until: 0 })).body?.ok, "lifting failed");
const ws3 = await status(W.token);
must(ws3.blocked === false && ws3.why === undefined && ws3.kind === undefined, "lifting it clears the reason with it");
const wu = ((await j("/admin/users?key=" + encodeURIComponent(ADMIN))).body.users as Record<string, unknown>[] || []).find((x) => x.id === W.id);
must(wu && wu.timeoutWhy === "" && wu.timeoutKind === "", "and the panel's list agrees: " + JSON.stringify(wu));

// lifting it is what takes the screen down
must(!!(await post("/admin/timeout", { key: ADMIN, id: T.id, until: 0 })).body?.ok, "lifting failed");
must((await status(T.token)).blocked === false, "a lifted timeout reads as open at once");
await post("/admin/ban", { key: ADMIN, id: B.id, banned: false });
await post("/admin/chatban", { key: ADMIN, id: C.id, chatBanned: false });

console.log(
  "lockout: a timeout or a ban puts one screen over the whole page, above every layer, from " +
    "whichever of /status, the room's poll or the casino hears it first; it stops the room, the " +
    "conversations and the casino, closes every game tab the page opened, refuses every view, game, " +
    "the casino and the veil while it is up, counts a timeout down and lifts itself, says the reason tung " +
    "gave and says sahur caught them when it was for farming — and a chat ban stays the room's own screen",
);
