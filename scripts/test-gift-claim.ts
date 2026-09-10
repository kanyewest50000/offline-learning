#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read
// One in five of tung's lines is a giveaway with a button under it. Exactly one
// person may ever win it, and the winner must be paid exactly once — so the
// claim and the payout ride in a single atomic commit guarded by checks on both
// keys. This fires a crowd at one gift simultaneously and counts the money.
//
// Run the app with a short wisdom window and every wisdom forced to a giveaway:
//   ADMIN_KEY=devadminkey WISDOM_MIN_MS=1200 WISDOM_MAX_MS=1600 \
//     WISDOM_GIFT_CHANCE=1 deno run --allow-net --allow-env --unstable-kv server.ts
//   ADMIN_KEY=devadminkey API=... deno run --allow-net --allow-env --allow-read scripts/test-gift-claim.ts

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const API = (Deno.env.get("API") || "http://127.0.0.1:8000").replace(/\/$/, "");
const ADMIN = Deno.env.get("ADMIN_KEY") || "devadminkey";
const WINDOW_MS = Number(Deno.env.get("WISDOM_MAX_MS") || 1600);
const RACERS = 12;

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

// ---------------------------------------------------------------------------
// source: the odds and the amount are what the lines promise
const server = await Deno.readTextFile(`${ROOT}/server.ts`);
must(/WISDOM_GIFT_CHANCE"\) \|\| 0\.2\)/.test(server), "the default giveaway chance should be 0.2");
must(/WISDOM_GIFT_AMOUNT"\) \|\| 50\)/.test(server), "the default giveaway should be 50 sahurs");
const giveaway = server.match(/const GIVEAWAY = \[([\s\S]*?)\n\];/);
must(!!giveaway, "no GIVEAWAY pool");
const GLINES = [...giveaway![1].matchAll(/^\s*"((?:[^"\\]|\\.)*)",$/gm)].map((m) => m[1]);
must(GLINES.length >= 5, `wanted at least 5 giveaway lines, got ${GLINES.length}`);
must(new Set(GLINES).size === GLINES.length, "the giveaway lines repeat");
must(GLINES.every((l) => l.includes("{n}")),
  "every giveaway line must interpolate {n}, so the words cannot drift from the payout");

async function member(tag: string) {
  const n = tag + Math.random().toString(36).slice(2, 8);
  const a = await post("/apply", { username: n, application: "gift race" });
  const token = a.body?.token as string;
  must(!!token, "apply failed for " + n);
  const pend = await j("/admin/pending?key=" + encodeURIComponent(ADMIN));
  const id = (pend.body.pending || []).find((x: { username: string }) => x.username === n)?.id;
  must(!!id, n + " not pending");
  must(!!(await post("/admin/decide", { key: ADMIN, id, action: "approve" })).body?.ok, "approve failed");
  return { name: n, token, id };
}
const bal = async (token: string) => (await j("/cas/me?token=" + encodeURIComponent(token))).body.balance as number;

// ---------------------------------------------------------------------------
// make him hand one out
const talker = await member("gftT");
await post("/send", { token: talker.token, text: "priming" });
await sleep(WINDOW_MS + 400);
await post("/send", { token: talker.token, text: "anything happening" });
await sleep(500);

// deno-lint-ignore no-explicit-any
const msgs = (await j("/admin/chat?key=" + encodeURIComponent(ADMIN))).body.messages as any[];
const gifts = msgs.filter((m) => m.from === "tung" && m.gift && m.gift.id);
must(gifts.length > 0, "no giveaway was posted — run the server with WISDOM_GIFT_CHANCE=1");
const gift = gifts[gifts.length - 1].gift;
const amount = gift.amount as number;
must(amount > 0, "the giveaway has no amount");
must(gifts[gifts.length - 1].text.includes(String(amount)),
  "the line must name the amount the button actually pays: " + gifts[gifts.length - 1].text);
must(!gifts[gifts.length - 1].text.includes("{n}"), "the {n} placeholder was never filled in");

// ---------------------------------------------------------------------------
// the race: everyone reaches at once
const racers = [];
for (let i = 0; i < RACERS; i++) racers.push(await member("gftR"));
const before = await Promise.all(racers.map((r) => bal(r.token)));

const results = await Promise.all(
  racers.map((r) => post("/gift/claim", { token: r.token, id: gift.id })),
);
const winners = results.filter((r) => r.body?.ok === true);
const losers = results.filter((r) => r.body?.error === "claimed");

must(winners.length === 1,
  `exactly one claim must succeed, got ${winners.length} (${JSON.stringify(results.map((r) => r.body))})`);
must(losers.length === RACERS - 1,
  `every other claim must be told it is taken, got ${losers.length} of ${RACERS - 1}`);
must(losers.every((l) => l.body.by === winners[0].body.by),
  "the losers must all be told the same winner: " + JSON.stringify(losers.map((l) => l.body.by)));

// and the money: exactly one payout, to exactly the winner
const after = await Promise.all(racers.map((r) => bal(r.token)));
const deltas = after.map((b, i) => Math.round((b - before[i]) * 100) / 100);
const paid = deltas.filter((d) => d !== 0);
must(paid.length === 1, `exactly one balance may move, ${paid.length} did: ${JSON.stringify(deltas)}`);
must(paid[0] === amount, `the winner must gain exactly ${amount}, gained ${paid[0]}`);
const winnerIdx = deltas.findIndex((d) => d !== 0);
must(racers[winnerIdx].name === winners[0].body.by,
  "the balance that moved must belong to the account the server declared winner");
const minted = deltas.reduce((a, b) => a + b, 0);
must(Math.round(minted * 100) / 100 === amount,
  `the giveaway must mint exactly ${amount} sahurs in total, minted ${minted}`);

// ---------------------------------------------------------------------------
// and it stays claimed
const again = await post("/gift/claim", { token: racers[winnerIdx].token, id: gift.id });
must(again.body?.error === "claimed", "the winner must not be able to claim twice");
must(Math.round(((await bal(racers[winnerIdx].token)) - before[winnerIdx]) * 100) / 100 === amount,
  "a second claim must not pay again");

// the room is told, so every open client can retire the button
// deno-lint-ignore no-explicit-any
const evs = (await j("/events?since=0&token=" + encodeURIComponent(talker.token))).body.events as any[];
const claimEv = (evs || []).filter((e) => e.type === "gift" && e.id === gift.id);
must(claimEv.length === 1, `exactly one gift event must be broadcast, saw ${claimEv.length}`);
must(claimEv[0].by === winners[0].body.by, "the broadcast must name the winner");

// nonsense and strangers get nothing
must((await post("/gift/claim", { token: talker.token, id: "no-such-gift" })).status === 404,
  "an unknown gift must 404");
must((await post("/gift/claim", { id: gift.id })).status === 401, "a claim with no key must be refused");
must((await post("/gift/claim", { token: "garbage", id: gift.id })).status === 401,
  "a claim with a bad key must be refused");

console.log(
  `gift claim: ${RACERS} racers, 1 winner (${winners[0].body.by}), ${losers.length} told it was taken, ` +
    `exactly ${amount} sahurs minted in total, second claim refused, broadcast seen`,
);
