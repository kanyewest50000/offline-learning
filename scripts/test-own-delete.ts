#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read
// Taking back your own words.
//
// Anybody may delete their own line in the room — the bin a moderator has on
// every line, everybody has on their own — and nobody but a moderator may
// delete anybody else's. In a DM, you may take back your own lines and never
// the other person's; the line goes, the other end's open window drops it on
// its next ordinary poll (a marker takes the next seq, so no poll pays an extra
// read for it), their unread badge never counts what was taken back, and the
// preview on both rails moves to the newest line still standing.
//
//   ADMIN_KEY=devadminkey deno run --allow-net --allow-env --unstable-kv server.ts
//   ADMIN_KEY=devadminkey API=... deno run --allow-net --allow-env --allow-read scripts/test-own-delete.ts

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

async function member(tag: string) {
  const name = tag + Math.random().toString(36).slice(2, 8);
  let a = await post("/apply", { username: name, application: "own delete test" });
  for (let i = 0; a.body?.error === "slow down" && i < 15; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    a = await post("/apply", { username: name, application: "own delete test" });
  }
  const token = a.body?.token as string;
  must(!!token, "apply failed for " + name + ": " + JSON.stringify(a.body));
  const pend = await j("/admin/pending?key=" + encodeURIComponent(ADMIN));
  const id = (pend.body.pending as { username: string; id: string }[] || []).find((x) => x.username === name)?.id;
  must(!!id, name + " not pending");
  must(!!(await post("/admin/decide", { key: ADMIN, id, action: "approve" })).body?.ok, "approve failed");
  return { name, token, id: id as string };
}

// ===========================================================================
// source: both clients draw the bin on your own lines, and act on a bulk del
// ===========================================================================
const src = await Deno.readTextFile(`${ROOT}/server.ts`);
const shrine = await readShrine();
const embed = await Deno.readTextFile(`${ROOT}/embed/chat.html`);
must(shrine.includes("var canDel=!!m.mine&&!isT;if(IS_MOD)canDel=true;"), "the shrine must put a bin on your own lines");
must(embed.includes("var canDel = !!m.mine") && embed.includes("if (IS_MOD) canDel = true;"), "so must the embed");
must(shrine.includes("for(var di=0;di<ev.ids.length;di++)dropMsg(ev.ids[di])"), "the shrine must drop every line a bulk del names");
must(embed.includes("for (var di = 0; di < ev.ids.length; di++) dropMsg(ev.ids[di])"), "so must the embed");
must(shrine.includes('apiPost("/dm/delete"'), "a DM line must be deletable from the page");
must(shrine.includes("if(m.del){dmDropSeq(m.del);continue;}"), "and an open window must drop a line the other end took back");
must(/function ownsMessage\(ref: MsgRef, user: any\): boolean \{\s*if \(ref\.from\) return false;/.test(src),
  "his lines are nobody's to take back");
must(src.includes("uid: user.id } as MsgRef"), "/send must record whose line it is, server-side");

// ===========================================================================
// the room
// ===========================================================================
const A = await member("odA"), B = await member("odB");
const say = async (tok: string, text: string) => {
  const id = "od" + Math.random().toString(36).slice(2, 10);
  const r = await post("/send", { token: tok, id, text });
  must(r.body?.ok === true, "could not say " + text + ": " + JSON.stringify(r.body));
  return id;
};
const inRoom = async (id: string) =>
  ((await j("/admin/chat?key=" + encodeURIComponent(ADMIN))).body.messages as { id: string }[] || [])
    .some((m) => m.id === id);

const mine = await say(A.token, "something i will regret");
const theirs = await say(B.token, "something b said");
// the line never carries who wrote it by id — that lives only in the index
const win = JSON.stringify((await j("/events?since=0&token=" + encodeURIComponent(B.token))).body);
must(!win.includes(A.id), "a room event must not carry the author's id");

const byB = await post("/delete", { token: B.token, id: mine });
must(byB.status === 403 && byB.body.error === "forbidden", "B must not delete A's line: " + JSON.stringify(byB.body));
must(await inRoom(mine), "…and it is still there");
const cursor = (await j("/events?since=0&token=" + encodeURIComponent(B.token))).body.cursor as number;
const own = await post("/delete", { token: A.token, id: mine });
must(own.body?.ok === true && own.body.id === mine, "A must be able to delete their own line: " + JSON.stringify(own.body));
must(!(await inRoom(mine)), "the line is out of the room");
must(await inRoom(theirs), "and nobody else's went with it");
const after = (await j("/events?since=" + cursor + "&token=" + encodeURIComponent(B.token))).body.events as
  { type: string; id?: string }[];
must(after.some((e) => e.type === "del" && e.id === mine), "open windows are told to drop it: " + JSON.stringify(after));
must((await post("/delete", { token: A.token, id: mine })).status === 404, "twice is gone, not an error that deletes more");
must((await post("/delete", { token: A.token, id: theirs })).status === 403, "A cannot delete B's line either");
must((await post("/react", { token: B.token, id: mine, e: "🔥" })).status === 404, "a deleted line cannot be reacted to");

// a chat ban shuts this too
const later = await say(A.token, "one more");
must(!!(await post("/admin/chatban", { key: ADMIN, id: A.id, chatBanned: true })).body?.ok, "chat ban failed");
must((await post("/delete", { token: A.token, id: later })).status === 403, "a barred member cannot reach into the room");
must(!!(await post("/admin/chatban", { key: ADMIN, id: A.id, chatBanned: false })).body?.ok, "unban failed");
must((await post("/delete", { token: A.token, id: later })).body?.ok === true, "and can once it is lifted");

// ===========================================================================
// direct messages
// ===========================================================================
type Conv = { id: string; last: string; unread: number };
const rail = async (tok: string) => ((await j("/dm/list?token=" + encodeURIComponent(tok))).body.convs as Conv[]) || [];
const withOf = (tok: string, other: string, since = 0) =>
  j("/dm/with?token=" + encodeURIComponent(tok) + "&with=" + encodeURIComponent(other) + "&since=" + since);
// the burst cap is a few lines every few seconds, and this file writes faster
// than a person; waiting it out is the cap working, not the test failing
const send = async (tok: string, to: string, text: string) => {
  let r = await post("/dm/send", { token: tok, to, text });
  for (let i = 0; r.body?.error === "slow down" && i < 10; i++) {
    await new Promise((res) => setTimeout(res, 1500));
    r = await post("/dm/send", { token: tok, to, text });
  }
  must(r.body?.ok === true, "could not DM " + text + ": " + JSON.stringify(r.body));
  return (r.body.msg as { seq: number }).seq;
};
const del = (tok: string, other: string, seq: number) => post("/dm/delete", { token: tok, with: other, seq });

const s1 = await send(A.token, B.id, "first thing");
const s2 = await send(A.token, B.id, "second thing");
must((await rail(B.token)).find((c) => c.id === A.id)?.unread === 2, "B has two waiting");
const s3 = await send(B.token, A.id, "b's reply");

// B has the conversation open up to here
const open = await withOf(B.token, A.id);
const seen = open.body.seq as number;
must(seen === s3, "B's window is at the newest line");

// refusals
must((await del(B.token, A.id, s1)).status === 403, "B cannot take back A's line");
must((await del(A.token, B.id, s3)).status === 403, "nor A B's");
must((await del(A.token, B.id, 999)).status === 404, "a seq with nothing there is gone");
must((await del(A.token, B.id, 0)).status === 400, "a nonsense seq is refused");
must((await del(A.token, A.id, s1)).status === 400, "there is no conversation with yourself");

// A takes back the second line
must((await del(A.token, B.id, s2)).body?.ok === true, "A must be able to take back their own line");
// B's open window hears about it on its next ordinary poll
const tick = await withOf(B.token, A.id, seen);
const marks = tick.body.msgs as { seq: number; del?: number; text: string }[];
must(marks.length === 1 && marks[0].del === s2 && marks[0].text === "", "the poll carries a marker, and no words: " + JSON.stringify(marks));
// and a fresh open never shows it
const fresh = JSON.stringify((await withOf(A.token, B.id)).body);
must(!fresh.includes("second thing"), "the line is gone for good");
must(fresh.includes("first thing") && fresh.includes("b's reply"), "and only that line");
// the admin dump shows the conversation as it now stands, markers and all left out
const dump = await post("/admin/dm/thread", { key: ADMIN, user: A.id, peer: B.id });
const dumped = dump.body.msgs as { text: string }[];
must(dumped.length === 2 && !JSON.stringify(dumped).includes("second thing"), "the dump has two lines: " + JSON.stringify(dumped));

// unread: C gets two lines, A takes both back before C looks — nothing waits
const C = await member("odC");
const c1 = await send(A.token, C.id, "are you there");
const c2 = await send(A.token, C.id, "never mind");
must((await rail(C.token)).find((c) => c.id === A.id)?.unread === 2, "C has two waiting");
must((await del(A.token, C.id, c2)).body?.ok === true, "take back the second");
let row = (await rail(C.token)).find((c) => c.id === A.id);
must(row?.unread === 1 && row?.last === "are you there", "one waits, and the preview is the line still standing: " + JSON.stringify(row));
must((await del(A.token, C.id, c1)).body?.ok === true, "take back the first");
row = (await rail(C.token)).find((c) => c.id === A.id);
must(row?.unread === 0 && row?.last === "", "nothing waits once both are gone: " + JSON.stringify(row));
const aRow = (await rail(A.token)).find((c) => c.id === C.id);
must(aRow?.unread === 0 && aRow?.last === "", "and A's own rail agrees: " + JSON.stringify(aRow));
// and a line written after all that counts normally
await send(A.token, C.id, "hello again");
must((await rail(C.token)).find((c) => c.id === A.id)?.unread === 1, "a new line counts as one");
await withOf(C.token, A.id);
must((await rail(C.token)).find((c) => c.id === A.id)?.unread === 0, "and reading it clears it");

// a shut conversation has nothing to take back
must((await post("/dm/block", { token: B.token, to: A.id, blocked: true })).body?.blocked === true, "block failed");
must((await del(A.token, B.id, s1)).status === 403, "not while it is blocked");
must((await post("/dm/block", { token: B.token, to: A.id, blocked: false })).body?.blocked === false, "unblock failed");

console.log(
  "own delete: a member can delete their own line in the room and nobody else's (a moderator " +
    "still can), open windows drop it, and a chat ban shuts it; in a DM a member takes back " +
    "only their own lines, the other end's open window drops it on its next poll, a fresh open " +
    "never shows it, the admin dump leaves it out, and the unread badge and preview on both " +
    "rails never count what was taken back",
);
