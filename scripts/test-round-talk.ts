#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read
// Table talk: the little chat inside a round of Competitive Gambling.
//
// The point of it is that it does not outlive the round. It is one value held
// under the duel and deleted by the very commit that settles it, so there is no
// window where the round is over and the conversation is still readable, and
// nothing to sweep afterwards. Everything below is about that, plus the usual:
// only the people at the table, only while it is running.
//
// The round needs a clock long enough to fill the box inside one: the flood cap
// is five lines per player per five seconds, and the box holds forty.
//
//   ADMIN_KEY=devadminkey DUEL_OPEN_MS=2000 DUEL_CONFIRM_MS=2000 DUEL_COMP_MS=20000 \
//     deno run --allow-net --allow-env --unstable-kv server.ts
//   ADMIN_KEY=devadminkey API=... deno run --allow-net --allow-env --allow-read scripts/test-round-talk.ts

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const API = (Deno.env.get("API") || "http://127.0.0.1:8000").replace(/\/$/, "");
const ADMIN = Deno.env.get("ADMIN_KEY") || "devadminkey";
const COMP_MS = Number(Deno.env.get("DUEL_COMP_MS") || 20000);

function must(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}
async function j(path: string, opt?: RequestInit) {
  const r = await fetch(API + path, opt);
  return { status: r.status, body: await r.json().catch(() => ({})) as Record<string, unknown> };
}
const post = (path: string, obj: unknown) =>
  j(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(obj) });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---- source: the wipe must ride the settling commit, not a sweep afterwards
const src = await Deno.readTextFile(`${ROOT}/server.ts`);
must(/if \(next\.settled\) \{[\s\S]*?op = op\.delete\(\["dtalk", next\.id\]\);/.test(src),
  "the talk must be deleted by the same commit that settles the round");
must(/const cur = await kv\.get<\{ lines: TalkLine\[\] \}>\(\["dtalk", duelId\]\);[\s\S]*?\.check\(cur\)/.test(src),
  "two people talking at once must not lose each other's line");
must(/if \(chatBlock\(u\)\.blocked\) return json\(\{ error: "blocked" \}, 403\);/.test(
  src.slice(src.indexOf('path === "/duel/say"'), src.indexOf('path === "/duel/say"') + 1400)),
  "a round's table talk is a room, so the chat ban must reach it");

async function member(tag: string) {
  const n = tag + Math.random().toString(36).slice(2, 8);
  const a = await post("/apply", { username: n, application: "table talk" });
  const token = a.body.token as string;
  must(!!token, "apply failed");
  const pend = await j("/admin/pending?key=" + encodeURIComponent(ADMIN));
  const id = (pend.body.pending as { username: string; id: string }[] || []).find((x) => x.username === n)?.id;
  must(!!id, n + " not pending");
  must(!!(await post("/admin/decide", { key: ADMIN, id, action: "approve" })).body?.ok, "approve failed");
  must(!!(await post("/admin/setbal", { key: ADMIN, id, balance: 500 })).body?.ok, "setbal failed");
  return { name: n, token, id };
}
const A = await member("tkA"), B = await member("tkB"), C = await member("tkC");
const D = await member("tkD"), OUT = await member("tkOut");

async function liveRound(seats: number, players: { token: string }[]) {
  const made = await post("/duel/create", { token: players[0].token, game: "comp", bet: 1, seats });
  must(made.body?.ok === true, "create failed: " + JSON.stringify(made.body));
  const id = (made.body.duel as { id: string }).id;
  for (let i = 1; i < seats; i++) {
    must((await post("/duel/join", { token: players[i].token, id })).body?.ok === true, "join failed");
  }
  let go;
  for (let i = 0; i < seats; i++) go = await post("/duel/confirm", { token: players[i].token, id });
  must((go?.body?.duel as { state: string })?.state === "live", "the round must start");
  return id;
}
// run one player's stack out. In a two-seat round that leaves nobody to play
// against, which ends it on the spot — so the sections that are not about the
// clock do not have to wait for one.
async function endRound(token: string, id: string) {
  const r = await post("/cas/limbo", { token, bet: 1000, target: 1000000, round: id });
  must(r.body?.roundOver === true, "could not end the round: " + JSON.stringify(r.body));
}
const talkOf = async (token: string, id: string) =>
  (await j("/duel/state?token=" + encodeURIComponent(token) + "&id=" + id)).body.talk as
    { name: string; text: string; ts: number }[];

// ---------------------------------------------------------------------------
// a three-seat round: everybody at the table can talk and everybody hears it
{
  const id = await liveRound(3, [A, B, C]);
  must((await talkOf(A.token, id)).length === 0, "a fresh round starts with nothing said");

  must((await post("/duel/say", { token: A.token, id, text: "who is up" })).body?.ok === true, "A could not speak");
  must((await post("/duel/say", { token: B.token, id, text: "not me" })).body?.ok === true, "B could not speak");
  const heard = await talkOf(C.token, id);
  must(heard.length === 2, "the third player must hear both: " + JSON.stringify(heard));
  must(heard[0].name === A.name && heard[0].text === "who is up", "in order, under the right name");
  must(heard[1].name === B.name && heard[1].text === "not me", "and the second the same");
  must(typeof heard[0].ts === "number" && heard[0].ts > Date.now() - 60_000, "each line carries a clock");

  // somebody who is not at the table can neither read it nor speak into it
  const peek = await j("/duel/state?token=" + encodeURIComponent(OUT.token) + "&id=" + id);
  must(peek.status === 403, "a stranger must not be able to read the table: " + peek.status);
  const butt = await post("/duel/say", { token: OUT.token, id, text: "hello" });
  must(butt.status === 403, "nor speak at it: " + butt.status + " " + JSON.stringify(butt.body));
  must((await talkOf(A.token, id)).length === 2, "and nothing of theirs may land");

  // an empty line is not a line
  must((await post("/duel/say", { token: A.token, id, text: "   " })).status === 400, "empty lines are refused");
  must((await talkOf(A.token, id)).length === 2, "and do not reach the table");

  // ---- THE POINT: the round ending takes the talk with it
  await sleep(COMP_MS + 600);
  const after = await j("/duel/state?token=" + encodeURIComponent(A.token) + "&id=" + id);
  must((after.body.duel as { state: string }).state === "done", "the round should be over by now");
  must(Array.isArray(after.body.talk) && (after.body.talk as unknown[]).length === 0,
    "the talk must be gone the moment the round is: " + JSON.stringify(after.body.talk));
  // and it cannot be spoken into afterwards
  const late = await post("/duel/say", { token: A.token, id, text: "one more" });
  must(late.status === 409, "a finished round must refuse a line: " + late.status);
  must(((await j("/duel/state?token=" + encodeURIComponent(A.token) + "&id=" + id)).body.talk as unknown[]).length === 0,
    "and must still have nothing in it");
}

// ---------------------------------------------------------------------------
// a round that ends early takes it too — the wipe is on the commit, not the clock
{
  const id = await liveRound(2, [A, B]);
  must((await post("/duel/say", { token: A.token, id, text: "quick one" })).body?.ok === true, "say failed");
  must((await talkOf(B.token, id)).length === 1, "B hears it");
  // run A's stack out: the last player standing ends the round on the spot
  const bust = await post("/cas/limbo", { token: A.token, bet: 1000, target: 1000000, round: id });
  must(bust.body?.roundOver === true, "the bust should end a two-seat round: " + JSON.stringify(bust.body));
  const after = await j("/duel/state?token=" + encodeURIComponent(B.token) + "&id=" + id);
  must((after.body.duel as { state: string }).state === "done", "the round ended");
  must((after.body.talk as unknown[]).length === 0,
    "a round that ends early must still take its talk with it: " + JSON.stringify(after.body.talk));
}

// ---------------------------------------------------------------------------
// a chat ban reaches the table, and the room stays shut while the tables stay open
{
  const id = await liveRound(2, [A, B]);
  must(!!(await post("/admin/chatban", { key: ADMIN, id: B.id, chatBanned: true })).body?.ok, "chatban failed");
  const gagged = await post("/duel/say", { token: B.token, id, text: "let me in" });
  must(gagged.status === 403 && gagged.body.error === "blocked",
    "a chat-banned member must not be able to talk at the table: " + JSON.stringify(gagged.body));
  // ...but the round itself is untouched: they can still play it
  const bet = await post("/cas/dice", { token: B.token, bet: 1, target: 50, round: id });
  must(bet.body?.ok === true, "a chat ban must not close the tables: " + JSON.stringify(bet.body));
  must(!!(await post("/admin/chatban", { key: ADMIN, id: B.id, chatBanned: false })).body?.ok, "lifting failed");
  must((await post("/duel/say", { token: B.token, id, text: "thanks" })).body?.ok === true, "and lifting gives it back");
  await endRound(A.token, id);
}

// ---------------------------------------------------------------------------
// the box is small on purpose: long lines are clipped and old ones fall off
{
  // four seats, so forty-odd lines can be said inside one round without any of
  // them tripping the per-player flood cap of five in five seconds
  const crew = [A, B, C, D];
  const id = await liveRound(4, crew);
  const long = "x".repeat(500);
  must((await post("/duel/say", { token: A.token, id, text: long })).body?.ok === true, "a long line still sends");
  must((await talkOf(A.token, id))[0].text.length === 200, "but is clipped to what the box holds");
  let sent = 0;
  for (let i = 0; sent < 45 && i < 300; i++) {
    const who = crew[i % crew.length];
    const r = await post("/duel/say", { token: who.token, id, text: "line " + sent });
    if (r.body?.ok === true) sent++;
    else if (r.status === 429) await sleep(400);       // the cap doing its job
    else must(false, "the table refused a line for the wrong reason: " + r.status + " " + JSON.stringify(r.body));
    if (i % crew.length === crew.length - 1) await sleep(1100);
  }
  must(sent === 45, "could not fill the box inside one round — only got " + sent + " lines in");
  const lines = await talkOf(B.token, id);
  must(lines.length === 40, "only the last 40 lines are kept, got " + lines.length);
  must(lines[lines.length - 1].text === "line 44", "and the newest is the last: " + lines[lines.length - 1].text);
  must(!lines.some((l) => l.text.startsWith("xxx")), "the oldest have fallen off the top");
  // four seats take three busts to leave one player alone, which is what ends it
  for (const who of [B, C, D]) {
    await post("/cas/limbo", { token: who.token, bet: 1000, target: 1000000, round: id });
  }
  const done = await j("/duel/state?token=" + encodeURIComponent(A.token) + "&id=" + id);
  must((done.body.duel as { state: string }).state === "done", "the round should be over");
  must((done.body.talk as unknown[]).length === 0,
    "and a full box is wiped as completely as an empty one: " + JSON.stringify(done.body.talk));
}

console.log(
  "table talk: everyone seated can talk and hear, nobody else can read it or reach it, " +
    "a chat ban shuts it while leaving the tables open, the box clips and caps itself, " +
    "and the round ending — on the clock or early — deletes the whole conversation in the " +
    "same commit that settles the pot",
);
