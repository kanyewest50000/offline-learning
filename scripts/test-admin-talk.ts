#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read
// Talking to a member as tung, from the admin panel.
//
// He is not an account. A direct message still needs two sides, so he has an
// id that is not a member's and a name the room already refuses to anyone
// else. A line sent from Talk to da people arrives in that member's own DM
// menu as him — from:"tung" — and a reply comes back through the ordinary
// composer. It is drawn as a DM, not as the room: an ordinary bubble with his
// portrait and name, and none of the room's "the shrine" mark, which on a
// private conversation made it read as the public chat. Reading his inbox marks his side
// read and must not clear the member's badge. A chat ban and a block still
// shut it, the same as any other DM.
//
//   ADMIN_KEY=devadminkey deno run --allow-net --allow-env --unstable-kv server.ts
//   ADMIN_KEY=devadminkey API=... deno run --allow-net --allow-env --allow-read scripts/test-admin-talk.ts

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

const src = await Deno.readTextFile(`${ROOT}/server.ts`);
const shrine = await readShrine();

// the pane sits under Direct messages, and load does not open his inbox
const dmsAt = src.indexOf('data-pane="dms"');
const talkAt = src.indexOf('data-pane="talk"');
const postAt = src.indexOf('data-pane="postas"');
must(dmsAt > 0 && talkAt > dmsAt && postAt > talkAt, "Talk to da people must sit under Direct messages");
must(src.indexOf('id="pane-dms"') < src.indexOf('id="pane-talk"'), "the pane must follow the Direct messages pane");
for (const bit of ['id="pane-talk"', 'id="talkWho"', 'id="talklist" class="talklist"', 'id="talklog" class="talklog"', 'id="talkform"']) {
  must(src.includes(bit), "the admin panel is missing " + bit);
}
// the pane's CSS targets these by class; without the class the log never took
// the spare height and the composer floated under the last line
must(src.includes("#pane-talk .talklog{flex:1;overflow-y:auto"), "his thread must fill the pane and scroll");
const loadAll = src.match(/function loadAll\(\)\{[^}]+\}/);
must(!!loadAll && !loadAll[0].includes("/admin/talk"), "load must not open his inbox: " + loadAll?.[0]);
must(src.includes('path === "/admin/talk/send"'), "sending as him needs a route");
must(src.includes("from: \"tung\""), "his lines carry the same from:\"tung\" stamp the room styles");
must(src.includes("dmMarkRead(TUNG_DM_ID"), "opening his inbox marks his side read");
// and the shrine paints that stamp with the same mark the room uses
must(shrine.includes("function paintTungWho("), "his name is drawn in one place");
must(shrine.includes('m.from==="tung"'), "a DM line has to notice the stamp");
// in the room he keeps the mark; in a conversation he does not
must(shrine.includes('if(isT){paintTungWho(w,m.name);'), "the room still draws the whole mark");
must(shrine.includes('tb.textContent="the shrine"'), "the room's mark still says the shrine");
must(shrine.includes(".msg.tung{"), "his room line still has its own shape");
const paintSrc = shrine.slice(shrine.indexOf("function paintTungWho(w,name,dm){"));
must(shrine.includes("function paintTungWho(w,name,dm){") && paintSrc.slice(0, paintSrc.indexOf("' +")).includes("if(dm)return;"),
  "the drawing has to be able to leave the room's mark off");
const dmAddSrc = shrine.slice(shrine.indexOf("function dmAdd(m){"), shrine.indexOf("function dmAdd(m){") + 900);
must(dmAddSrc.includes('row.className=m.mine?"msg me dm":"msg dm";'),
  "a DM line from him is an ordinary DM bubble, not the room's proclamation: " + dmAddSrc.slice(0, 400));
must(dmAddSrc.includes('paintTungWho(w,(DM&&DM.name)||"tung",true)'), "a DM line draws him without the room's mark");
must(shrine.includes('if(DM.tung)paintTungWho(convname,DM.name||"tung",true)'), "the conversation header too");
must(shrine.includes('if(c.tung)paintTungWho(n,c.name||"tung",true)'), "and his row on the rail, under the room's own row");
// and from the panel's seat, his lines are the sender's: on the right
const talkPane = src.slice(src.indexOf("function talkLine("), src.indexOf("function talkAdd("));
must(talkPane.includes('row.className=(isT?"msg me":"msg")+(m.deleted?" deleted":"")'), "the panel draws his lines as sent, on the right");
must(talkPane.includes('dt.textContent="(deleted)"'), "and a line the member took back stays, marked");
must(!/tungmark/.test(src.slice(src.indexOf("#pane-talk"), src.indexOf("</style>", src.indexOf("#pane-talk")))),
  "the panel's DM pane carries no room mark");
must(!/msg tung/.test(src.slice(src.indexOf("Talk to da people.") )), "nor the room's line shape");

const panel = await fetch(API + "/admin", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ key: ADMIN }),
});
const html = await panel.text();
must(panel.status === 200, "the panel did not open: " + panel.status);
const script = html.match(/<script>([\s\S]*)<\/script>/);
must(!!script, "the panel must ship its script");
try {
  new Function(script![1]);
} catch (e) {
  throw new Error("the panel's script does not parse: " + (e instanceof Error ? e.message : String(e)));
}
must(html.includes("Talk to da people"), "the heading has to be on the page the key opens");
must(!/fetch\("\/admin\/talk[^"]*\?/.test(html), "his inbox must not put an id in a URL");

async function member(tag: string) {
  const name = tag + Math.random().toString(36).slice(2, 8);
  const a = await post("/apply", { username: name, application: "talk test" });
  const token = a.body?.token as string;
  must(!!token, "apply failed for " + name + ": " + JSON.stringify(a.body));
  const pend = await j("/admin/pending?key=" + encodeURIComponent(ADMIN));
  const id = (pend.body.pending as { username: string; id: string }[] || [])
    .find((x) => x.username === name)?.id;
  must(!!id, name + " not pending");
  must(!!(await post("/admin/decide", { key: ADMIN, id, action: "approve" })).body?.ok, "approve failed");
  return { name, token, id: id as string };
}
type Conv = { id: string; name: string; last: string; unread: number; tung?: boolean };
const convs = async (token: string) =>
  ((await j("/dm/list?token=" + encodeURIComponent(token))).body.convs as Conv[]) || [];
const withTung = (token: string, since = 0) =>
  j("/dm/with?token=" + encodeURIComponent(token) + "&with=" + encodeURIComponent("tung") + "&since=" + since);

const P = await member("talkP");
const Q = await member("talkQ");

must((await post("/admin/talk/send", { key: "nope", user: P.id, text: "hi" })).status === 403, "a wrong key is forbidden");
must((await post("/admin/talk/send", { key: ADMIN, user: P.id, text: "  " })).body.error === "empty", "an empty line is empty");
must((await post("/admin/talk/send", { key: ADMIN, user: "nosuch", text: "hi" })).status === 404, "an unknown member is not found");

const sent = await post("/admin/talk/send", { key: ADMIN, user: P.id, text: "the wood remembers you" });
must(sent.body?.ok === true, "sending as him failed: " + JSON.stringify(sent.body));
must((sent.body.msg as { from?: string }).from === "tung", "the send must name him");

const prow = (await convs(P.token)).find((c) => c.tung);
must(!!prow, "P's rail must grow a row that is him, not a member wearing the name");
must(prow!.name === "tung", "the row is named tung: " + prow!.name);
must(prow!.unread === 1, "P has not opened it: " + prow!.unread);
must((await convs(Q.token)).every((c) => !c.tung), "Q was not written to");

// reading his inbox must not clear P's badge
const peek = await post("/admin/talk/thread", { key: ADMIN, user: P.id });
must(peek.body?.ok === true, "the thread failed: " + JSON.stringify(peek.body));
const peekMsgs = peek.body.msgs as { from?: string; text: string; mine: boolean }[];
must(peekMsgs.length === 1 && peekMsgs[0].from === "tung" && peekMsgs[0].mine === true && peekMsgs[0].text === "the wood remembers you",
  "his thread is the line, marked as his: " + JSON.stringify(peekMsgs));
must((await convs(P.token)).find((c) => c.tung)?.unread === 1, "his read must not clear P's badge");

const opened = await withTung(P.token);
must(opened.body?.ok === true, "P could not open it: " + JSON.stringify(opened.body));
must((opened.body.with as { tung?: boolean; name?: string }).tung === true, "the conversation must say it is him");
must((opened.body.with as { name?: string }).name === "tung", "and be named tung");
const lines = opened.body.msgs as { from?: string; mine: boolean; text: string }[];
must(lines.length === 1 && lines[0].from === "tung" && lines[0].mine === false && lines[0].text === "the wood remembers you",
  "P sees his line, and it is not P's: " + JSON.stringify(lines));
must((await convs(P.token)).find((c) => c.tung)?.unread === 0, "opening it is what clears the badge");

const reply = await post("/dm/send", { token: P.token, to: "tung", text: "i was here" });
must(reply.body?.ok === true, "a reply to him failed: " + JSON.stringify(reply.body));
const inbox = await post("/admin/talk/list", { key: ADMIN });
const inboxRow = (inbox.body.convs as { id: string; unread: number; name: string }[]).find((c) => c.id === P.id);
must(!!inboxRow && inboxRow.unread === 1 && inboxRow.name === P.name, "his inbox shows the reply waiting: " + JSON.stringify(inbox.body));
const back = await post("/admin/talk/thread", { key: ADMIN, user: P.id });
const both = back.body.msgs as { from?: string; mine: boolean; text: string }[];
must(both.length === 2 && both[1].text === "i was here" && both[1].mine === false && both[1].from !== "tung",
  "the reply is theirs: " + JSON.stringify(both));
must(both[0].from === "tung", "his own line keeps the stamp");
const quiet = await post("/admin/talk/list", { key: ADMIN });
must((quiet.body.convs as { id: string; unread: number }[]).find((c) => c.id === P.id)?.unread === 0,
  "opening the reply is what clears his badge");

// Q still cannot see any of it, including by naming him
const qWith = await withTung(Q.token);
must(((qWith.body.msgs as unknown[]) || []).length === 0, "Q has no conversation with him");

// a chat ban still covers this
must(!!(await post("/admin/chatban", { key: ADMIN, id: P.id, chatBanned: true })).body?.ok, "chat ban failed");
const banned = await post("/admin/talk/send", { key: ADMIN, user: P.id, text: "are you there" });
must(banned.status === 403 && banned.body.error === "closed" && banned.body.reason === "chatban",
  "a chat ban must shut this too: " + JSON.stringify(banned.body));
must(!!(await post("/admin/chatban", { key: ADMIN, id: P.id, chatBanned: false })).body?.ok, "unban failed");

// and a block, from their side
const blk = await post("/dm/block", { token: P.token, to: "tung", blocked: true });
must(blk.body?.blocked === true, "the block did not take: " + JSON.stringify(blk.body));
const blocked = await post("/admin/talk/send", { key: ADMIN, user: P.id, text: "hello again" });
must(blocked.status === 403 && blocked.body.error === "blocked", "their block must stop him: " + JSON.stringify(blocked.body));

// ---- general chat: the room from his seat ----
must(src.includes('id="talkRoom"') && src.includes("function talkOpenRoom(){"), "general chat is pinned on his rail");
must(src.includes('aget("/admin/chat"+(roomLoaded?"?since="+roomCursor:""))'),
  "the room is read whole once, then only past the cursor it holds");
must(src.includes('apost("/admin/postas",{username:"tung",text:text,replyTo:rep?rep.id:""})'), "and he speaks in it as tung");
must(src.includes("if(/^tung$/i.test(name)){"), "Post as sends tung here instead");
const kq = "key=" + encodeURIComponent(ADMIN);
const full = await j("/admin/chat?" + kq);
must(typeof full.body.cursor === "number" && Array.isArray(full.body.messages), "a whole read says where it got to: " + JSON.stringify(full.body).slice(0, 200));
const lineId = "rm" + Math.random().toString(36).slice(2, 8);
must((await post("/send", { token: Q.token, id: lineId, text: "is anyone there" })).body?.ok, "Q could not speak");
const said = await post("/admin/postas", { key: ADMIN, username: "tung", text: "always", replyTo: lineId });
must(said.body?.ok && said.body.tung === true, "he could not answer in the room: " + JSON.stringify(said.body));
must((await post("/delete", { token: Q.token, id: lineId })).body?.ok, "Q could not take it back");
const inc = await j("/admin/chat?since=" + full.body.cursor + "&" + kq);
const incMsgs = inc.body.messages as { id: string; from?: string; reply?: { id: string }; deleted?: boolean }[];
must(incMsgs.some((m) => m.id === lineId) && incMsgs.some((m) => m.from === "tung" && m.reply?.id === lineId),
  "the next pass brings only what is new, his answer quoting the line: " + JSON.stringify(inc.body));
must((inc.body.dels as string[]).includes(lineId), "and the delete, so the line can be marked where it sits");
must(Number(inc.body.cursor) > Number(full.body.cursor), "and moves the cursor on");
const past = await j("/admin/chat?since=" + inc.body.cursor + "&" + kq);
must((past.body.messages as unknown[]).length === 0, "past the cursor there is nothing");
must((await j("/admin/chat?since=1")).status === 403, "and none of it without the key");

console.log(
  "talk to da people: a line from the panel arrives in the member's own menu as a DM " +
    "from tung, drawn as a DM rather than as the room, a reply comes back, reading his " +
    "inbox does not clear their badge, and a chat ban or a block still shuts it; general chat reads the room " +
    "past a cursor and speaks in it as him",
);
