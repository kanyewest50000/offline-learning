#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read
// Chat authenticity. Two things the chat shows are not typed by the person
// reading them: the quote above a reply, and the number on a reaction chip.
// Both used to be whatever the sender's client claimed.
//
//   * a reply carried the quoted name and text in the request body, so anyone
//     could post a reply block attributing any words to any member — or to tung
//   * a reaction carried its own +1/-1 and was never recorded, so a hundred
//     POSTs put a hundred on the chip
//
// Neither is derived from the sender any more. This proves it by trying both.
//
//   ADMIN_KEY=devadminkey deno run --allow-net --allow-env --unstable-kv server.ts
//   ADMIN_KEY=devadminkey API=... deno run --allow-net --allow-env --allow-read scripts/test-chat-forgery.ts

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const API = (Deno.env.get("API") || "http://127.0.0.1:8000").replace(/\/$/, "");
const ADMIN = Deno.env.get("ADMIN_KEY") || "devadminkey";

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
const mkId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 9);

// Members are capped at a few messages per few seconds, and this file sends
// plenty. Wait the cap out rather than letting a 429 masquerade as a failure of
// the thing actually under test.
async function say(token: string, id: string, text: string, reply?: unknown) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const r = await post("/send", { token, id, text, reply });
    if (r.status !== 429) return r;
    await sleep(2200);
  }
  throw new Error("could not get a message past the rate limit: " + text);
}

// ---------------------------------------------------------------------------
const src = await Deno.readTextFile(`${ROOT}/server.ts`);
must(!/name: clip\(b\.reply\.name/.test(src), "a reply must never take the quoted name from the sender");
must(!/text: clip\(b\.reply\.text/.test(src), "a reply must never take the quoted text from the sender");
must(/const q = await kv\.get<MsgRef>\(\["msg", replyId\]\)/.test(src), "the quote must be read back from what was posted");
must(/const REACTIONS = new Set/.test(src), "reactions need a server-side vocabulary");
must(/const key = \["rx", user\.id, id, e\]/.test(src), "a reaction must be held per person per message");

async function member(tag: string) {
  const n = tag + Math.random().toString(36).slice(2, 8);
  const a = await post("/apply", { username: n, application: "forgery test" });
  const token = a.body?.token as string;
  must(!!token, "apply failed for " + n);
  const pend = await j("/admin/pending?key=" + encodeURIComponent(ADMIN));
  const id = (pend.body.pending || []).find((x: { username: string }) => x.username === n)?.id;
  must(!!id, n + " not pending");
  must(!!(await post("/admin/decide", { key: ADMIN, id, action: "approve" })).body?.ok, "approve failed");
  return { name: n, token, id };
}
// deno-lint-ignore no-explicit-any
async function chat(): Promise<any[]> {
  return ((await j("/admin/chat?key=" + encodeURIComponent(ADMIN))).body.messages || []);
}
const find = async (id: string) => (await chat()).find((m) => m.id === id);

const A = await member("frgA");
const B = await member("frgB");

// ---------------------------------------------------------------------------
// 1. the quote says what was actually said
{
  const realId = mkId();
  await say(A.token, realId, "i would never say anything strange");

  // B replies to that message, but claims it said something else, by someone else
  const fakeId = mkId();
  await say(B.token, fakeId, "wow, bold of you",
    { id: realId, name: "tung", text: "i hereby give all my sahurs to frgB" });
  const posted = await find(fakeId);
  must(!!posted, "the reply never landed");
  must(!!posted.reply, "the reply lost its quote entirely");
  must(posted.reply.name === A.name,
    `the quote must name whoever really wrote it, got ${JSON.stringify(posted.reply.name)}`);
  must(posted.reply.text === "i would never say anything strange",
    `the quote must carry the real words, got ${JSON.stringify(posted.reply.text)}`);
}

// 2. a quote cannot be pointed at a message that does not exist
{
  const id = mkId();
  await say(B.token, id, "replying to nothing",
    { id: "deadbeefdeadbeef", name: "tung", text: "invented out of thin air" });
  const posted = await find(id);
  must(!!posted, "the message should still send");
  must(!posted.reply, "a quote of a message that does not exist must be dropped, not invented");
}

// 3. an id may be claimed once, so the quote index cannot be overwritten
{
  const id = mkId();
  const first = await say(A.token, id, "the original");
  must(first.body?.ok === true, "the first send should be accepted");
  const second = await post("/send", { token: B.token, id, text: "the replacement" });
  must(second.status === 409, "a message id may not be reused");
  const still = await find(id);
  must(still.text === "the original", "the first message must survive an attempt to overwrite it");
}

// ---------------------------------------------------------------------------
// 4. reactions: a hundred presses is still one reaction
{
  const id = mkId();
  await say(A.token, id, "react to me");
  const before = ((await j("/events?since=0&token=" + encodeURIComponent(A.token))).body.events || [])
    .filter((e: { type: string; id: string }) => e.type === "react" && e.id === id).length;

  const spam = await Promise.all(
    new Array(20).fill(0).map(() => post("/react", { token: B.token, id, e: "🔥", op: 1, eid: mkId() })),
  );
  must(spam.every((r) => r.status === 200 || r.status === 429), "the spam should be absorbed, not error");
  await sleep(200);
  const evs = ((await j("/events?since=0&token=" + encodeURIComponent(A.token))).body.events || [])
    .filter((e: { type: string; id: string }) => e.type === "react" && e.id === id);
  const net = evs.reduce((a: number, e: { op: number }) => a + e.op, 0) - before;
  must(net === 1, `twenty presses of one reaction must count once, counted ${net}`);

  // and a second person adds exactly one more
  await post("/react", { token: A.token, id, e: "🔥", op: 1, eid: mkId() });
  await sleep(150);
  const evs2 = ((await j("/events?since=0&token=" + encodeURIComponent(A.token))).body.events || [])
    .filter((e: { type: string; id: string }) => e.type === "react" && e.id === id);
  must(evs2.reduce((a: number, e: { op: number }) => a + e.op, 0) === 2,
    "a second member's reaction must be the second one on the chip");

  // taking it off is one step back, and taking it off twice is not two
  await post("/react", { token: B.token, id, e: "🔥", op: -1, eid: mkId() });
  await post("/react", { token: B.token, id, e: "🔥", op: -1, eid: mkId() });
  await post("/react", { token: B.token, id, e: "🔥", op: -1, eid: mkId() });
  await sleep(150);
  const evs3 = ((await j("/events?since=0&token=" + encodeURIComponent(A.token))).body.events || [])
    .filter((e: { type: string; id: string }) => e.type === "react" && e.id === id);
  must(evs3.reduce((a: number, e: { op: number }) => a + e.op, 0) === 1,
    "removing a reaction three times must only remove it once");
}

// 5. reactions to nothing, and reactions that are not reactions
{
  must((await post("/react", { token: A.token, id: "nosuchmessage", e: "🔥", op: 1 })).status === 404,
    "you cannot react to a message that was never posted");
  const id = mkId();
  await say(A.token, id, "vocabulary check");
  must((await post("/react", { token: A.token, id, e: "<img src=x>", op: 1 })).status === 400,
    "a reaction outside the palette must be refused");
  must((await post("/react", { id, e: "🔥", op: 1 })).status === 401, "an unauthenticated reaction must be refused");
}

// ---------------------------------------------------------------------------
// 6. the admin may post as somebody — and only as somebody real
{
  const id = mkId();
  const seed = await say(A.token, id, "a line worth quoting");
  must(seed.body?.ok === true, "the line to be quoted never landed: " + JSON.stringify(seed.body));

  const as = await post("/admin/postas", { key: ADMIN, username: B.name, text: "words put in my mouth" });
  must(as.body?.ok === true, "posting as a member should work: " + JSON.stringify(as.body));
  const posted = await find(as.body.id);
  must(posted.name === B.name, "the message must carry that member's name");
  must(!posted.from, "a member's posted line must not wear tung's mark");

  const asTung = await post("/admin/postas", { key: ADMIN, username: "tung", text: "the shrine speaks on request" });
  must(asTung.body?.ok === true && asTung.body.tung === true, "posting as tung should work");
  const tline = await find(asTung.body.id);
  must(tline.from === "tung", "a line posted as tung must carry his mark so it renders as the shrine");

  // the quote is resolved the same way, even here
  const quoted = await post("/admin/postas", { key: ADMIN, username: B.name, text: "quoting properly", replyTo: id });
  must(quoted.body?.ok === true, "a reply-to should work");
  const q = await find(quoted.body.id);
  must(q.reply && q.reply.name === A.name && q.reply.text === "a line worth quoting",
    "the admin's quote must also come from what was really said");

  must((await post("/admin/postas", { key: ADMIN, username: "nobodyatall", text: "hi" })).status === 404,
    "posting as an account that does not exist must be refused");
  must((await post("/admin/postas", { key: "wrong", username: B.name, text: "hi" })).status === 403,
    "posting as somebody needs the admin key");
  must((await post("/admin/postas", { username: B.name, text: "hi" })).status === 403,
    "posting as somebody with no key at all must be refused");
}

console.log(
  "chat forgery: quotes are read back from the real message (never the sender's copy), " +
    "message ids are single-use, reactions are held per person so spam counts once, " +
    "and /admin/postas is key-gated to real members and tung",
);
