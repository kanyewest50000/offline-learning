#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read
// Tung's giveaways with entries, posted from the panel.
//
// A line from tung with a card under it — the prize, how many win it, a
// countdown — and an enter button. Everyone who enters before the timer runs
// out is in the draw once; when it runs out the server picks the winners at
// random, splits the prize between them, pays them and says who won. Being
// fast buys nothing, entering twice buys nothing, and a roll that runs twice at
// once (two isolates, or the panel's "roll it now" pressed while the timer
// fires) pays nobody twice.
//
// This walks it against a live server, including one giveaway left to run out
// on its own clock (a minute), so it takes a little over a minute.
//
//   ADMIN_KEY=devadminkey deno run --allow-net --allow-env --unstable-kv server.ts
//   ADMIN_KEY=devadminkey API=... deno run --allow-net --allow-env --allow-read scripts/test-giveaways.ts

import { readShrineFile, ROOT } from "./shrine-sources.ts";

const API = (Deno.env.get("API") || "http://127.0.0.1:8000").replace(/\/$/, "");
const ADMIN = Deno.env.get("ADMIN_KEY") || "devadminkey";

function must(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}
// deno-lint-ignore no-explicit-any
type Any = any;
async function j(path: string, opt?: RequestInit) {
  const r = await fetch(API + path, opt);
  return { status: r.status, body: await r.json().catch(() => ({})) as Any };
}
const post = (path: string, obj: unknown) =>
  j(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(obj) });
const admin = (what: string, body: Record<string, unknown> = {}) => post("/admin/raffle/" + what, { key: ADMIN, ...body });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ===========================================================================
// the source
// ===========================================================================
const server = await Deno.readTextFile(ROOT + "/server.ts");
const chat = await readShrineFile("assets/js/shrine/chat.js");
must(server.includes("crypto.getRandomValues(b);") && server.includes("function randBelow(n: number)"),
  "the draw must use the platform's CSPRNG, without modulo bias");
must(/\.set\(\["raffle_paid", id, uid\], amt[\s\S]{0,120}\.set\(\["cas", uid\]/.test(server),
  "a winner's paid mark and their balance must be one commit");
must(server.includes("await raffleTick();\n") && /path === "\/events"\) \{\n[\s\S]{0,400}await raffleTick\(\);/.test(server),
  "the room's own poll carries the check for a giveaway that has run out");
must(server.includes("if (raffleBusy || (now < raffleDueSeen && now - raffleLookedAt < 60_000)) return;"),
  "that check is a comparison until something is due, and a read at most once a minute otherwise");
must(chat.includes('apiPost("/raffle/enter",{token:TOKEN,id:R.id})'), "the card's button enters");
must(chat.includes('raffle:ev.from==="tung"&&ev.raffle||null'), "only a line from tung can carry a card");
must(chat.includes("setInterval(raffleAll,1000)") && !/raffle[^"]*"\)\.then[^;]*setInterval/.test(chat),
  "the countdown is the page's own clock, not a poll");
must(server.includes('data-pane="raffles"') && server.includes('id="pane-raffles"'), "the panel needs its Giveaways pane");

// ===========================================================================
// live
// ===========================================================================
async function member(tag: string) {
  const name = tag + Math.random().toString(36).slice(2, 8);
  let a = await post("/apply", { username: name, application: "giveaway test" });
  for (let i = 0; a.body?.error === "slow down" && i < 15; i++) {
    await sleep(5000);
    a = await post("/apply", { username: name, application: "giveaway test" });
  }
  const token = a.body?.token as string;
  must(!!token, "apply failed for " + name + ": " + JSON.stringify(a.body));
  const pend = await j("/admin/pending?key=" + encodeURIComponent(ADMIN));
  const id = (pend.body.pending as { username: string; id: string }[] || []).find((x) => x.username === name)?.id;
  must(!!id, name + " not pending");
  must(!!(await post("/admin/decide", { key: ADMIN, id, action: "approve" })).body?.ok, "approve failed");
  return { name, token, id: id as string };
}
type M = Awaited<ReturnType<typeof member>>;
const enter = (m: M, id: string) => post("/raffle/enter", { token: m.token, id });
const bal = async (m: M) => (await j("/cas/me?token=" + encodeURIComponent(m.token))).body.balance as number;
const room = async (m: M) => ((await j("/events?since=0&token=" + encodeURIComponent(m.token))).body.events || []) as Any[];
const listed = async (id: string) => ((await admin("list")).body.raffles as Any[]).find((r) => r.id === id);

// the key, and the limits
must((await post("/admin/raffle/create", { key: "nope", amount: 10, winners: 1, minutes: 5 })).status === 403, "a wrong key posts nothing");
must((await post("/admin/raffle/list", {})).status === 403, "no key lists nothing");
for (const bad of [{ amount: 0, winners: 1, minutes: 5 }, { amount: 10, winners: 0, minutes: 5 }, { amount: 10, winners: 51, minutes: 5 },
  { amount: 10, winners: 1, minutes: 0 }, { amount: 10, winners: 1, minutes: 99999 }, { amount: "x", winners: 1, minutes: 5 },
  { amount: 0.02, winners: 5, minutes: 5 }]) {
  must((await admin("create", bad)).status === 400, "a giveaway like " + JSON.stringify(bad) + " must be refused");
}

const A = await member("gvA"), B = await member("gvB"), C = await member("gvC"), D = await member("gvD");

// ---- blank message: one of his lines, filled in ----
const g1 = await admin("create", { amount: 90, winners: 2, minutes: 30 });
must(g1.body?.ok && g1.body.raffle.status === "open", "create failed: " + JSON.stringify(g1.body));
const r1 = g1.body.raffle;
must(r1.text.includes("90") && r1.text.includes("2 winners") && !/\{[nw]\}/.test(r1.text), "a blank message is one of his lines, filled in: " + r1.text);
const card = (await room(A)).find((e) => e.type === "msg" && e.raffle?.id === r1.id);
must(card && card.from === "tung" && card.text === r1.text && card.raffle.amount === 90 && card.raffle.winners === 2 &&
  card.raffle.endsAt === r1.endsAt, "the room gets his line with the card: " + JSON.stringify(card));
// ---- a custom one, placeholders and all ----
const g2 = await admin("create", { text: "friday drop: {n} sahurs, {w}", amount: 5, winners: 1, minutes: 30 });
must(g2.body.raffle.text === "friday drop: 5 sahurs, 1 winner", "a custom message is his, placeholders filled: " + g2.body.raffle.text);

// ---- entering ----
const ea = await enter(A, r1.id);
must(ea.body?.ok && ea.body.already === false && ea.body.entries === 1, "A enters: " + JSON.stringify(ea.body));
must((await enter(B, r1.id)).body.entries === 2 && (await enter(C, r1.id)).body.entries === 3, "B and C enter");
const again = await enter(A, r1.id);
must(again.body?.ok && again.body.already === true && again.body.entries === 3, "entering twice is still one entry: " + JSON.stringify(again.body));
// all at once, from one member: still one
await Promise.all([1, 2, 3, 4, 5].map(() => enter(D, r1.id)));
must((await listed(r1.id)).count === 4, "five entries at once from one member count once");
must((await enter(A, "nosuchgiveaway")).status === 404, "a giveaway that does not exist cannot be entered");
must((await post("/raffle/enter", { id: r1.id })).status === 401, "nobody without a key enters");
const names = (await admin("entries", { id: r1.id })).body.names as string[];
must(names.length === 4 && [A, B, C, D].every((m) => names.includes(m.name)), "the panel sees who entered: " + names);
// a chat ban shuts the card with the room; a sahur-watch bar with giveaways shuts it too
const E = await member("gvE"), F = await member("gvF");
await post("/admin/chatban", { key: ADMIN, id: E.id, chatBanned: true });
must((await enter(E, r1.id)).status === 403, "a member shut out of the room cannot enter");
await post("/admin/chatban", { key: ADMIN, id: E.id, chatBanned: false });
await post("/admin/watch/punish", { key: ADMIN, id: F.id, ban: { hours: 1, gifts: true } });
const fb = await enter(F, r1.id);
must(fb.status === 403 && fb.body.error === "claim_banned", "a member barred from giveaways cannot enter: " + JSON.stringify(fb.body));
await post("/admin/watch/lift", { key: ADMIN, id: F.id });

// ---- a member banned after entering is passed over in the draw ----
await post("/admin/ban", { key: ADMIN, id: D.id, banned: true });

// ---- rolled now, from the panel, five times at once ----
const before = { A: await bal(A), B: await bal(B), C: await bal(C) };
const rolls = await Promise.all([1, 2, 3, 4, 5].map(() => admin("end", { id: r1.id })));
must(rolls.some((x) => x.body?.ok), "rolling failed: " + JSON.stringify(rolls.map((x) => x.body)));
const done = await listed(r1.id);
must(done.status === "done" && done.entries === 4 && done.each === 45 && done.picked.length === 2, "two winners of 45: " + JSON.stringify(done));
const won = done.picked.map((p: Any) => p.name) as string[];
must(!won.includes(D.name), "a member banned since entering does not win");
must(new Set(won).size === 2 && won.every((n) => [A.name, B.name, C.name].includes(n)), "two different entrants win: " + won);
const after = { A: await bal(A), B: await bal(B), C: await bal(C) };
for (const [k, m] of [["A", A], ["B", B], ["C", C]] as const) {
  const want = won.includes(m.name) ? 45 : 0;
  must(Math.abs(after[k] - before[k] - want) < 1e-9, m.name + " should have gained " + want + " exactly once, gained " + (after[k] - before[k]));
}
await post("/admin/ban", { key: ADMIN, id: D.id, banned: false });
const ann = (await room(A)).filter((e) => e.type === "msg" && e.raffleEnd?.id === r1.id);
must(ann.length === 1 && ann[0].from === "tung" && ann[0].raffleEnd.each === 45 && ann[0].raffleEnd.entries === 4 &&
  won.every((n) => ann[0].text.includes(n)), "he announces it once, naming the winners: " + JSON.stringify(ann));
must((await enter(C, r1.id)).body.error === "over", "a rolled giveaway takes no more entries");
must((await admin("end", { id: r1.id })).status === 409, "and cannot be rolled again");
must((await bal(A)) === after.A, "nor pay again");

// ---- more winners than entrants: everyone who entered wins ----
const g3 = await admin("create", { amount: 10, winners: 5, minutes: 30 });
await enter(A, g3.body.raffle.id);
await enter(B, g3.body.raffle.id);
await post("/admin/watch/punish", { key: ADMIN, id: B.id, reduce: { pct: 50, days: 1 } });
const a3 = await bal(A), b3 = await bal(B);
const d3 = (await admin("end", { id: g3.body.raffle.id })).body.raffle;
must(d3.picked.length === 2 && d3.each === 5, "two entrants, two winners of 5: " + JSON.stringify(d3));
must((await bal(A)) - a3 === 5, "A takes 5");
must(Math.abs((await bal(B)) - b3 - 2.5) < 1e-9, "B, paid at 50% by the sahur watch, takes 2.5");
await post("/admin/watch/lift", { key: ADMIN, id: B.id });

// ---- nobody enters ----
const g4 = await admin("create", { amount: 7, winners: 1, minutes: 30 });
const d4 = (await admin("end", { id: g4.body.raffle.id })).body.raffle;
must(d4.status === "done" && d4.entries === 0 && d4.picked.length === 0, "an empty drum picks nobody");
must((await room(A)).some((e) => e.raffleEnd?.id === g4.body.raffle.id && /nobody put a hand in the drum/.test(e.text)), "and says so");

// ---- called off ----
await enter(C, g2.body.raffle.id);
const c3 = await bal(C);
const off = await admin("cancel", { id: g2.body.raffle.id });
must(off.body?.ok && off.body.raffle.status === "cancelled", "call off failed: " + JSON.stringify(off.body));
must((await room(A)).some((e) => e.raffleEnd?.id === g2.body.raffle.id && e.raffleEnd.cancelled === true), "the room is told it is off");
must((await enter(A, g2.body.raffle.id)).body.error === "over", "a called-off giveaway takes no entries");
must((await admin("end", { id: g2.body.raffle.id })).status === 409, "and is never rolled");
must((await admin("cancel", { id: g2.body.raffle.id })).status === 409, "nor called off twice");
must((await bal(C)) === c3, "and pays nobody");

// ---- left to run out on its own ----
// No room poll touches it while it runs: the isolate that posted it has a
// timer for its end, and /cas/me (which this watches) does not roll anything.
const g5 = await admin("create", { amount: 20, winners: 1, minutes: 1 });
await enter(A, g5.body.raffle.id);
const a5 = await bal(A);
await sleep(64_000);
must((await bal(A)) - a5 === 20, "it rolled itself when its minute was up, and paid its only entrant");
const d5 = await listed(g5.body.raffle.id);
must(d5.status === "done" && d5.picked[0].name === A.name, "and the panel shows it done: " + JSON.stringify(d5));

console.log(
  "giveaways: the panel posts one to the room as tung (his line or yours, placeholders filled), members " +
    "enter once each, the draw is fair and skips anyone banned since, the prize is split and paid exactly " +
    "once however many rolls race, he announces the winners, an empty drum and a called-off giveaway pay " +
    "nobody, and one left alone rolls itself when its time is up",
);
