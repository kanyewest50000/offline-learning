#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read
// Deleting an account takes everything it said with it.
//
// Its lines in the room and the quote index behind them, its reactions,
// quotes of it inside other people's replies, and both sides of every direct
// message it was in — including conversations with tung. Nobody else's words
// go with it.
//
// Accounts deleted before that was true left all of it behind, which the panel
// listed as "(gone)". The second half of this file makes some of those the
// way the old delete did — by removing only the account — and checks each way
// they are cleared: the moment the panel or a member looks at one, and the
// panel's one-off clean-up. It needs to reach the database the server is using
// to do that, so it runs only when given the same SHRINE_KV_PATH, with
// --allow-write --unstable-kv; without them it says so and stops after the
// first half.
//
//   ADMIN_KEY=devadminkey SHRINE_KV_PATH=/tmp/shrine.db deno run --allow-net --allow-env --allow-read --allow-write --unstable-kv server.ts
//   ADMIN_KEY=devadminkey SHRINE_KV_PATH=/tmp/shrine.db API=... \
//     deno run --allow-net --allow-env --allow-read --allow-write --unstable-kv scripts/test-user-purge.ts

const API = (Deno.env.get("API") || "http://127.0.0.1:8000").replace(/\/$/, "");
const ADMIN = Deno.env.get("ADMIN_KEY") || "devadminkey";
const KV_PATH = Deno.env.get("SHRINE_KV_PATH") || "";

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
const rnd = () => Math.random().toString(36).slice(2, 8);

async function member(tag: string) {
  const name = tag + rnd();
  let a = await post("/apply", { username: name, application: "purge test" });
  for (let i = 0; a.body?.error === "slow down" && i < 15; i++) {
    await nap(5000);
    a = await post("/apply", { username: name, application: "purge test" });
  }
  const token = a.body?.token as string;
  must(!!token, "apply failed for " + name + ": " + JSON.stringify(a.body));
  const pend = await j("/admin/pending?key=" + encodeURIComponent(ADMIN));
  const id = (pend.body.pending as { username: string; id: string }[] || []).find((x) => x.username === name)?.id;
  must(!!id, name + " not pending");
  must(!!(await post("/admin/decide", { key: ADMIN, id, action: "approve" })).body?.ok, "approve failed");
  return { name, token, id: id as string };
}
// both caps are a few lines every few seconds; waiting them out is the cap working
async function retrying(path: string, body: Record<string, unknown>) {
  let r = await post(path, body);
  for (let i = 0; r.body?.error === "slow down" && i < 10; i++) {
    await nap(1500);
    r = await post(path, body);
  }
  must(r.body?.ok === true, path + " failed: " + JSON.stringify(r.body));
  return r;
}
const say = async (tok: string, text: string, reply?: string) => {
  const id = "pg" + rnd() + rnd();
  await retrying("/send", { token: tok, id, text, ...(reply ? { reply: { id: reply } } : {}) });
  return id;
};
const dm = (tok: string, to: string, text: string) => retrying("/dm/send", { token: tok, to, text });
type Line = { id: string; name: string; text: string; reply: { id: string; text: string } | null };
const room = async () => ((await j("/admin/chat?key=" + encodeURIComponent(ADMIN))).body.messages as Line[]) || [];
type Conv = { id: string; name: string };
const rail = async (tok: string) => ((await j("/dm/list?token=" + encodeURIComponent(tok))).body.convs as Conv[]) || [];
const peers = async (id: string) =>
  ((await post("/admin/dm/peers", { key: ADMIN, id })).body.peers as Conv[]) || [];
const inbox = async () => ((await post("/admin/talk/list", { key: ADMIN })).body.convs as Conv[]) || [];

// ===========================================================================
// deleting an account now
// ===========================================================================
const D = await member("pgD"), E = await member("pgE"), F = await member("pgF");
const dLine = await say(D.token, "d was here " + rnd());
const eLine = await say(E.token, "e was here too");
await retrying("/react", { token: D.token, id: eLine, e: "🔥" });
const eReply = await say(E.token, "replying to d", dLine);
must((await room()).find((m) => m.id === eReply)?.reply?.id === dLine, "E's reply quotes D");
await dm(D.token, E.id, "d to e, privately");
await dm(E.token, D.id, "e back to d");
await dm(D.token, F.id, "d to f");
await dm(E.token, F.id, "e to f, nothing to do with d");
await retrying("/admin/talk/send", { key: ADMIN, user: D.id, text: "tung to d" });
await dm(D.token, "tung", "d answers tung");
must((await rail(E.token)).some((c) => c.id === D.id), "E's rail has D before the delete");
must((await inbox()).some((c) => c.id === D.id), "his inbox has D before the delete");

const cursor = (await j("/events?since=0&token=" + encodeURIComponent(E.token))).body.cursor as number;
const gone = await post("/admin/delete", { key: ADMIN, id: D.id });
must(gone.body?.ok === true, "delete failed: " + JSON.stringify(gone.body));
must((gone.body.conversations as number) === 3, "three conversations went with D: " + JSON.stringify(gone.body));
must((gone.body.lines as number) >= 1, "and D's room line: " + JSON.stringify(gone.body));

const after = await room();
must(!after.some((m) => m.id === dLine), "D's line is out of the room");
must(after.some((m) => m.id === eLine), "E's line is not");
const reply = after.find((m) => m.id === eReply);
must(!!reply && reply.reply === null && reply.text === "replying to d", "E's reply stays, without D's words in it: " + JSON.stringify(reply));
const events = (await j("/events?since=" + cursor + "&token=" + encodeURIComponent(E.token))).body.events as
  { type: string; ids?: string[] }[];
must(events.some((e) => e.type === "del" && (e.ids || []).includes(dLine)), "open windows are told, in one event: " + JSON.stringify(events));
const win = JSON.stringify((await j("/events?since=0&token=" + encodeURIComponent(E.token))).body);
must(!win.includes('"name":"' + D.name + '"'), "nothing in the room window carries D's name any more, reactions included");
must((await post("/react", { token: E.token, id: dLine, e: "🔥" })).status === 404, "D's line cannot be reacted to");
const quoted = await say(E.token, "quoting a ghost", dLine);
must((await room()).find((m) => m.id === quoted)?.reply === null, "nor quoted: the index behind it is gone");

must(!(await rail(E.token)).some((c) => c.id === D.id), "E's rail no longer has D");
must(!(await rail(F.token)).some((c) => c.id === D.id), "F's neither");
must((await rail(F.token)).some((c) => c.id === E.id), "E and F still have theirs");
must(!(await inbox()).some((c) => c.id === D.id), "his inbox no longer has D");
must(!(await peers(E.id)).some((c) => c.id === D.id), "the panel's DM dump has nothing for E and D");
const stillEF = await post("/admin/dm/thread", { key: ADMIN, user: E.id, peer: F.id });
must(JSON.stringify(stillEF.body).includes("nothing to do with d"), "E and F's conversation is untouched");

// The room is shared with every other test in a run, and at least one of them
// counts what is in it; E's lines are the only ones of this file's left, so
// they go before either way out.
const tidy = async () => {
  for (const id of [eLine, eReply, quoted]) await post("/delete", { token: E.token, id });
};

// ===========================================================================
// leftovers from before: an account removed the old way
// ===========================================================================
// The database is a SQLite file the server is using at the same time, and a
// connection held open in here competes with it for the lock — the server's
// next write then fails with "database is locked". So it is opened for each
// read or write and closed straight after, never held across a request.
const canWrite = (await Deno.permissions.query({ name: "write" })).state === "granted";
const reach = !!KV_PATH && canWrite && typeof Deno.openKv === "function";
async function withKv<T>(f: (kv: Deno.Kv) => Promise<T>): Promise<T> {
  const k = await Deno.openKv(KV_PATH);
  try {
    return await f(k);
  } finally {
    k.close();
  }
}
if (!reach) {
  await tidy();
  console.log(
    "account purge: deleting an account takes its room lines, reactions, quotes of it and both " +
      "sides of every DM with it, and nothing of anybody else's. (leftovers from before were not " +
      "checked: run with SHRINE_KV_PATH, --allow-write and --unstable-kv to reach them)",
  );
  Deno.exit(0);
}
// what the old /admin/delete did: the account, and none of its words
async function oldDelete(p: { id: string; name: string }) {
  await withKv(async (kv) => {
    await kv.delete(["app", p.id]);
    await kv.delete(["name", p.name.toLowerCase()]);
  });
}
const dmKeys = (a: string, b: string) =>
  withKv(async (kv) => {
    const conv = a < b ? a + "~" + b : b + "~" + a;
    let n = 0;
    for await (const _e of kv.list({ prefix: ["dmev", conv] })) n++;
    return n;
  });

const H = await member("pgH");

// 1. the panel's DM dump notices one, and it goes
const G = await member("pgG");
await dm(G.token, H.id, "g to h");
await oldDelete(G);
must(await dmKeys(G.id, H.id) > 0, "the old delete left the conversation behind");
must(!(await peers(H.id)).some((c) => c.id === G.id), "the dump's list does not offer a deleted member");
must(await dmKeys(G.id, H.id) === 0, "…and noticing it cleared it");
must(!(await rail(H.token)).some((c) => c.id === G.id), "from H's rail too");

// 2. a member opening one clears it
const K = await member("pgK");
await dm(K.token, H.id, "k to h");
await oldDelete(K);
must((await rail(H.token)).some((c) => c.id === K.id), "the row is still on H's rail");
must((await j("/dm/with?token=" + encodeURIComponent(H.token) + "&with=" + K.id)).status === 404, "it cannot be opened");
must(await dmKeys(K.id, H.id) === 0, "…and trying cleared it");
must(!(await rail(H.token)).some((c) => c.id === K.id), "so the row is gone from the rail");

// 3. his inbox notices one
const M = await member("pgM");
await retrying("/admin/talk/send", { key: ADMIN, user: M.id, text: "tung to m" });
await oldDelete(M);
must(!(await inbox()).some((c) => c.id === M.id), "his inbox does not list a deleted member");
must(await dmKeys(M.id, "tung!voice") === 0, "…and noticing it cleared it");

// 4. the one-off clean-up gets the rest, room lines included
const L = await member("pgL");
const lLine = await say(L.token, "l says something " + rnd());
await dm(L.token, H.id, "l to h");
await oldDelete(L);
must((await room()).some((m) => m.id === lLine), "the old delete left L's line in the room");
const swept = await post("/admin/purgegone", { key: ADMIN });
must(swept.body?.ok === true && (swept.body.accounts as number) >= 1, "the clean-up found L: " + JSON.stringify(swept.body));
must(!(await room()).some((m) => m.id === lLine), "L's room line is gone");
must(await dmKeys(L.id, H.id) === 0, "and the conversation");
must(!(await rail(H.token)).some((c) => c.id === L.id), "and H's row for it");
must((await rail(H.token)).length === 0 || (await rail(H.token)).every((c) => c.id !== L.id), "H's rail is only the living");
// and it touched nobody alive
must((await room()).some((m) => m.id === eLine), "E's line survives the clean-up");
must(JSON.stringify((await post("/admin/dm/thread", { key: ADMIN, user: E.id, peer: F.id })).body).includes("nothing to do with d"),
  "E and F's conversation survives the clean-up");
const again = await post("/admin/purgegone", { key: ADMIN });
must(again.body?.ok === true && again.body.accounts === 0, "a second pass finds nothing: " + JSON.stringify(again.body));
await tidy();

console.log(
  "account purge: deleting an account takes its room lines, reactions, quotes of it and both " +
    "sides of every DM with it (tung's included), and nothing of anybody else's; leftovers of " +
    "accounts removed the old way are cleared when the panel's DM dump, his inbox or a member " +
    "opening one notices them, and the panel's one-off clean-up clears the rest, room lines " +
    "included, and touches nobody alive",
);
