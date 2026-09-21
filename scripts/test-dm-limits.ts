#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read
// What a DM is allowed to cost, and reading one from /admin.
//
// Every DM route carries a session token, and a request with a token on it
// skips the anonymous 90-a-minute IP cap by design — that is what keeps a
// school NAT full of approved members from being one identity. Which meant
// /dm/list, /dm/with and /dm/block had no clock on them at all: one approved
// account could ask for any of them as fast as it could open sockets, and
// every ask is KV reads somebody pays for.
//
// The shape of the abuse matters more than the volume. A conversation is
// cheap; what is expensive is how MANY of them one account can bring into
// being, because every row it creates is a row every later read of that rail
// has to walk, for a month. So the thing held here is that STARTING a
// conversation is told apart from replying in one, and only starting one pays.
//
// And the other half: the admin panel can read a conversation, the pair it
// offers comes from the conversations that actually exist, and doing it is a
// read — it must not mark anything read under the people in it.
//
//   ADMIN_KEY=devadminkey deno run --allow-net --allow-env --unstable-kv server.ts
//   ADMIN_KEY=devadminkey API=... deno run --allow-net --allow-env --allow-read scripts/test-dm-limits.ts

import { ROOT } from "./shrine-sources.ts";

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
// source: every route has a clock, and every list read has an end
// ===========================================================================
const src = await Deno.readTextFile(`${ROOT}/server.ts`);

function handler(match: string): string {
  const at = src.indexOf(match);
  must(at >= 0, "could not find the route: " + match);
  const rest = src.slice(at + match.length);
  const end = rest.search(/\n  if \((?:req\.method|path)/);
  return rest.slice(0, end < 0 ? rest.length : end);
}

// Not one of the four may be askable without limit. A route with no allow() in
// it is a route an approved account can hold open a hose against.
for (
  const [route, what] of [
    ['req.method === "GET" && path === "/dm/list"', "the rail"],
    ['req.method === "GET" && path === "/dm/with"', "the conversation poll"],
    ['req.method === "POST" && path === "/dm/block"', "blocking"],
    ['req.method === "POST" && path === "/dm/send"', "the composer"],
  ] as const
) {
  must(/\ballow\("dm/.test(handler(route)), what + " must have a clock on it (" + route + ")");
}
// the rail is the expensive read, and it must not walk an unbounded number of
// rows however many are behind it
must(
  /kv\.list<DmConv>\(\{ prefix: \["dmconv", u\.id\] \}, \{ limit: DM_RAIL \}\)/.test(src),
  "/dm/list must bound what it walks",
);
// a cold replay is the costly one and is counted on both sides of the isolate
// boundary; an incremental poll is nearly free and is not
const withBody = handler('req.method === "GET" && path === "/dm/with"');
must(/since === 0 && !allow\("dmcold:/.test(withBody), "a cold replay needs its own allowance");
must(/since === 0 && !await allowGlobal\("dmcold:/.test(withBody), "…on both sides of an isolate");
// and opening a conversation is told apart from replying in one
const sendBody = handler('req.method === "POST" && path === "/dm/send"');
must(/kv\.get<DmConv>\(\["dmconv", u\.id, other\.id\]\)/.test(sendBody),
  "/dm/send must ask whether this conversation already exists");
must(/allow\("dmnew:/.test(sendBody) && /allowGlobal\("dmnew:/.test(sendBody),
  "…and put a tighter clock on the ones that do not");
must(/dmConvCount\(u\.id, DM_CONV_MAX\) >= DM_CONV_MAX/.test(sendBody),
  "…and a ceiling on how many an account may have");
must(/for await \(const _e of kv\.list\(\{ prefix: \["dmconv", uid\] \}, \{ limit: n \}\)\)/.test(src),
  "counting them must stop at the cap rather than walking the lot");

// the admin dump is a READ. Reusing /dm/with would have marked the conversation
// read under the people in it, which is the one thing it must not do.
const peers = handler('req.method === "POST" && path === "/admin/dm/peers"');
const thread = handler('req.method === "POST" && path === "/admin/dm/thread"');
for (const [body, what] of [[peers, "the peer list"], [thread, "the dump"]] as const) {
  must(!/dmMarkRead|kv\.set|\.commit\(\)/.test(body), what + " must write nothing at all");
}
must(/\{ limit: DM_RAIL \}/.test(peers), "the peer list must be bounded");
must(/\{ limit: DM_DUMP, reverse: true \}/.test(thread),
  "the dump must be bounded, and take a long conversation from its newest end");
// and neither may take a pair off the client as a conversation id
must(!/params\.get\("conv"\)|b\.conv\b/.test(src), "no route may take a conversation id from the client");

// ===========================================================================
// live
// ===========================================================================
async function member(tag: string) {
  const name = tag + Math.random().toString(36).slice(2, 8);
  const a = await post("/apply", { username: name, application: "dm limits" });
  const token = a.body?.token as string;
  must(!!token, "apply failed for " + name);
  const pend = await j("/admin/pending?key=" + encodeURIComponent(ADMIN));
  const id = (pend.body.pending as { username: string; id: string }[] || [])
    .find((x) => x.username === name)?.id;
  must(!!id, name + " not pending");
  must((await post("/admin/decide", { key: ADMIN, id, action: "approve" })).body?.ok, "approve failed");
  return { name, token, id: id as string };
}
const dm = (token: string, to: string, text: string) => post("/dm/send", { token, to, text });
async function sendOk(token: string, to: string, text: string) {
  for (let i = 0; i < 10; i++) {
    const r = await dm(token, to, text);
    if (r.status !== 429) return r;
    await nap(2500);
  }
  throw new Error("still rate-limited after waiting: " + text);
}

const A = await member("dlA");
const B = await member("dlB");

// --- the clocks are there, and a person never meets them --------------------
// A rail poll every twelve seconds is what the client does; ten in ten seconds
// is twelve times that, so a handful in a row must all go through.
for (let i = 0; i < 6; i++) {
  const r = await j("/dm/list?token=" + encodeURIComponent(A.token));
  must(r.status === 200, "an ordinary rail poll must not be refused (" + i + "): " + r.status);
}
// but a hose gets shut off rather than served
let refused = 0;
await Promise.all(Array.from({ length: 40 }, async () => {
  const r = await j("/dm/list?token=" + encodeURIComponent(A.token));
  if (r.status === 429) refused++;
}));
must(refused > 0, "forty rail reads at once must run into the clock");
// and a refusal is a refusal, not a reason to stop being a member
must((await j("/status?token=" + encodeURIComponent(A.token))).status === 200,
  "being rate-limited on the rail must not touch anything else");

// --- replying is not charged what opening costs -----------------------------
// Open one conversation, then talk in it far more than the new-conversation
// clock would ever allow. None of it may be refused for that reason.
must((await sendOk(A.token, B.name, "first line")).body?.ok, "A must be able to open one");
for (let i = 0; i < 8; i++) {
  const r = await sendOk(A.token, B.name, "line " + i);
  must(r.body?.ok, "replying in an open conversation must never meet the new-conversation cap: " +
    JSON.stringify(r.body));
}

// --- but opening them one after another does meet it ------------------------
// The clock allows five a minute. Six fresh members, asked for in a row, must
// not all get through — and what comes back says to slow down rather than
// pretending the line was sent.
const strangers = [];
for (let i = 0; i < 6; i++) strangers.push(await member("dlS" + i));
let opened = 0, stopped = 0;
for (const s of strangers) {
  const r = await dm(A.token, s.name, "hello stranger");
  if (r.body?.ok) opened++;
  else if (r.status === 429 || r.body?.error === "too_many") stopped++;
  await nap(2100);   // stay clear of the ordinary flood cap, which is not the point here
}
must(stopped > 0, "opening six conversations in a row must run into the new-conversation clock");
must(opened > 0, "…but not before any of them were allowed: " + opened);

// ===========================================================================
// reading one from /admin
// ===========================================================================
const P = await member("dlP"), Q = await member("dlQ"), R = await member("dlR");
await sendOk(P.token, Q.name, "behind the shrine");
await sendOk(Q.token, P.name, "which shrine");
await sendOk(P.token, Q.name, "the one with the vending machine");

// what Q's rail says before anybody from /admin has been near it. Reading the
// rail is not reading the conversation, so this does not disturb it either.
const unreadOf = async (token: string, other: string) => {
  const r = await j("/dm/list?token=" + encodeURIComponent(token));
  const row = ((r.body.convs as { id: string; unread: number }[]) || []).find((c) => c.id === other);
  return row ? row.unread : -1;
};
const qUnreadBefore = await unreadOf(Q.token, P.id);
must(qUnreadBefore > 0, "Q has a line waiting that they have not opened: " + qUnreadBefore);

const peersOf = (id: string, key = ADMIN) => post("/admin/dm/peers", { key, id });
const threadOf = (user: string, peer: string, key = ADMIN) =>
  post("/admin/dm/thread", { key, user, peer });

must((await peersOf(P.id, ADMIN + "x")).status === 403, "the peer list needs the admin key");
must((await threadOf(P.id, Q.id, ADMIN + "x")).status === 403, "so does the dump");

const pl = await peersOf(P.id);
must(pl.body?.ok === true, "the peer list failed: " + JSON.stringify(pl.body));
const rows = pl.body.peers as { id: string; name: string; seq: number }[];
must(rows.length === 1 && rows[0].id === Q.id, "P has exactly one conversation, with Q: " + JSON.stringify(rows));
must(rows[0].name === Q.name, "…named as Q is named now");
must(rows[0].seq === 3, "…and counted: " + rows[0].seq);
must(((await peersOf(R.id)).body.peers as unknown[]).length === 0, "R has none");

const th = await threadOf(P.id, Q.id);
must(th.body?.ok === true, "the dump failed: " + JSON.stringify(th.body));
const msgs = th.body.msgs as { from: string; text: string }[];
must(msgs.length === 3, "the whole conversation, both ways: " + JSON.stringify(msgs));
must(msgs[0].text === "behind the shrine" && msgs[2].text === "the one with the vending machine",
  "…oldest first: " + JSON.stringify(msgs.map((m) => m.text)));
must(msgs[0].from === P.id && msgs[1].from === Q.id, "…and it says who wrote which");
must((th.body.a as { name: string }).name === P.name, "both ends are named");
must((th.body.b as { name: string }).name === Q.name, "…both of them");
// the same conversation from the other end is the same conversation
const back = await threadOf(Q.id, P.id);
must((back.body.msgs as unknown[]).length === 3, "naming the pair the other way round reads the same one");

// --- and reading it left no mark ------------------------------------------
// Q has a line sitting unopened. Two dumps have now been taken of the
// conversation it is in, and the badge must be exactly where it was: reading
// somebody's messages from /admin must not mark them read under them, which is
// precisely what reusing /dm/with to do it would have done.
const qUnreadAfter = await unreadOf(Q.token, P.id);
must(qUnreadAfter === qUnreadBefore,
  "the dump must leave the unread count alone: " + qUnreadBefore + " before, " + qUnreadAfter + " after");
// and the person it belongs to can still read it themselves, which IS what
// clears it — the dump changed nothing about that either
const qOpen = await j("/dm/with?token=" + encodeURIComponent(Q.token) + "&with=" + encodeURIComponent(P.id) + "&since=0");
must((qOpen.body.msgs as unknown[]).length === 3, "Q still has the whole conversation to open");
must(await unreadOf(Q.token, P.id) === 0, "…and opening it is still what clears the badge");

// --- the panel has the pane and asks for it without a query string ----------
const panel = await fetch(API + "/admin", {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ key: ADMIN }),
});
const html = await panel.text();
for (
  const [bit, what] of [
    ['data-pane="dms"', "a nav button"],
    ['id="pane-dms"', "a pane"],
    ['id="dmWho"', "the member dropdown"],
    ['id="dmPeer"', "the dropdown of who they talked to"],
    ['id="dmDump"', "something to press"],
  ] as const
) must(html.includes(bit), "the admin panel is missing " + what + " (" + bit + ")");
must(!/fetch\("\/admin\/dm[a-z/]*\?/.test(html),
  "neither call may put a member id in a URL — a body is not an access log");
// and load must not dump anybody's messages on its own, the same rule the
// chat log has had since it was a button of its own
const loadAll = html.match(/function loadAll\(\)\{[^}]+\}/);
must(!!loadAll, "loadAll() missing");
must(!loadAll![0].includes("/admin/dm/"), "load must not read DMs: " + loadAll![0]);

console.log(
  "DM limits: all four routes have a clock and the rail's read is bounded, so one approved " +
    "account can no longer ask for KV reads as fast as it can open sockets; replying in a " +
    "conversation that already exists is never charged what opening a new one costs, while " +
    "opening them one after another runs into a clock and a ceiling. /admin reads a conversation " +
    "by picking a member and then one of the pairs that actually exist, dumps it both ways oldest " +
    "first with both ends named, refuses a wrong key, carries no id in a URL, is not fetched by " +
    "load — and leaves the unread count of the people in it exactly where it was",
);
