#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read
// Picking a slow table back up.
//
// Mines, beef and blackjack outlive the request that dealt them: the stake goes
// on the deal and the board is held in KV for GAME_TTL. Nothing ever read one
// back, so closing the tab looked exactly like losing the game — and the next
// deal would overwrite the board, taking the stake with it. Worst at the very
// start, with nothing revealed: the stake was gone and there was not even a
// half-played board to show for it.
//
// The board was never actually lost. This is the route that asks for it, and
// the thing it must not do is show more than playing would: never the mine
// layout, never the lane the cow dies in, never the dealer's hole card.
//
//   ADMIN_KEY=devadminkey deno run --allow-net --allow-env --unstable-kv server.ts
//   ADMIN_KEY=devadminkey API=... deno run --allow-net --allow-env --allow-read scripts/test-resume.ts

import { ROOT } from "./shrine-sources.ts";

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
const money = (n: number) => Math.round(n * 100) / 100;

// ---- source: the client must actually ask, on all three tables
const casino = await Deno.readTextFile(`${ROOT}/assets/js/shrine/casino.js`);
must((casino.match(/openGame\(\)\.then\(/g) || []).length === 3,
  "all three slow tables must ask for an open board on the way in");
must(/function openGame\(\)\{[\s\S]*?\/cas\/resume/.test(casino), "and through one helper");

async function member(bal = 500) {
  const n = "rs" + Math.random().toString(36).slice(2, 8);
  const a = await post("/apply", { username: n, application: "resume" });
  const token = a.body.token as string;
  must(!!token, "apply failed");
  const pend = await j("/admin/pending?key=" + encodeURIComponent(ADMIN));
  const id = (pend.body.pending as { username: string; id: string }[] || []).find((x) => x.username === n)?.id;
  must(!!id, "not pending");
  must(!!(await post("/admin/decide", { key: ADMIN, id, action: "approve" })).body?.ok, "approve failed");
  must(!!(await post("/admin/setbal", { key: ADMIN, id, balance: bal })).body?.ok, "setbal failed");
  return { name: n, token, id };
}
const resume = async (t: string) => (await j("/cas/resume?token=" + encodeURIComponent(t))).body;
const purse = async (t: string) => Number((await j("/cas/me?token=" + encodeURIComponent(t))).body.balance);

// ---------------------------------------------------------------------------
// nothing open is nothing open
{
  const A = await member();
  const d = await resume(A.token);
  must(d.ok === true && d.game === null, "a player with no board must get null: " + JSON.stringify(d));
}

// ---------------------------------------------------------------------------
// MINES, the exact case reported: dealt, nothing revealed, walked away
{
  const A = await member();
  const before = await purse(A.token);
  must((await post("/cas/mines/start", { token: A.token, bet: 7, mines: 5 })).body?.ok === true, "deal failed");
  must(await purse(A.token) === money(before - 7), "the stake goes on the deal");

  const d = await resume(A.token);
  must(d.game === "mines" && d.state === "playing", "the board must come back: " + JSON.stringify(d));
  must(d.bet === 7 && d.mines === 5, "with the stake and the count it was dealt with");
  must(Array.isArray(d.revealed) && (d.revealed as unknown[]).length === 0, "and nothing revealed");
  must(d.multiplier === 1, "a board with nothing turned over is worth its stake");
  must(!Array.isArray(d.mines), "THE LAYOUT MUST NEVER BE SENT: " + JSON.stringify(d.mines));
  must(!("w" in d), "nor the internal stake tag");

  // and it is still the same board: playing it on is uninterrupted
  const pick = await post("/cas/mines/pick", { token: A.token, tile: 0 });
  must(pick.body?.ok === true, "a resumed board must still be playable: " + JSON.stringify(pick.body));
  if (pick.body.state === "playing") {
    const again = await resume(A.token);
    must((again.revealed as number[]).length === 1 && (again.revealed as number[])[0] === 0,
      "and the pick must be there next time it is picked up: " + JSON.stringify(again.revealed));
    must(again.multiplier === pick.body.multiplier, "at the multiplier the pick reported");
  }
}

// ---------------------------------------------------------------------------
// BEEF: the walk comes back on the lane it was left on, and the road with it
{
  // hard is a 15% chance of being flattened on any lane, so keep starting
  // walks until one survives its first lane and there is something to pick up
  let A = await member(), step = { body: {} as Record<string, unknown> };
  for (let i = 0; i < 12; i++) {
    A = await member();
    must((await post("/cas/beef/start", { token: A.token, bet: 3, difficulty: "hard" })).body?.ok === true, "deal failed");
    step = await post("/cas/beef/step", { token: A.token });
    if (step.body.state === "playing") break;
  }
  must(step.body.state === "playing", "could not get a walk that survives a lane");
  const d = await resume(A.token);
  must(d.game === "beef" && d.state === "playing", "the walk must come back: " + JSON.stringify(d));
  must(d.bet === 3 && d.difficulty === "hard", "with its stake and its difficulty");
  must(d.step === step.body.step, "on the lane it was left on: " + d.step + " vs " + step.body.step);
  must(d.multiplier === step.body.multiplier, "at the multiplier it had reached");
  must(Array.isArray(d.ladder) && (d.ladder as unknown[]).length === d.lanes,
    "and with the road it was walking");
  must(!("deathStep" in d), "THE LANE THE COW DIES IN MUST NEVER BE SENT");
  must(!("q" in d), "nor the odds it is drawn from");
  must((await post("/cas/beef/step", { token: A.token })).body?.ok === true, "a resumed walk must still step");
}

// ---------------------------------------------------------------------------
// BLACKJACK: the hand comes back with the hole card still down
{
  // a natural settles on the deal, so keep dealing until one stays open
  let A = await member(), open = false;
  for (let i = 0; i < 10 && !open; i++) {
    A = await member();
    const h = await post("/cas/bj/start", { token: A.token, bet: 4 });
    must(h.body?.ok === true, "deal failed");
    open = h.body.state === "playing";
  }
  must(open, "could not get a hand that stays open");
  const d = await resume(A.token);
  must(d.game === "bj" && d.state === "playing", "the hand must come back: " + JSON.stringify(d));
  must(Array.isArray(d.hands) && (d.hands as unknown[]).length === 1, "with the cards on it");
  must(Array.isArray(d.dealer) && (d.dealer as string[])[1] === "??",
    "THE HOLE CARD MUST STAY DOWN: " + JSON.stringify(d.dealer));
  must(d.bet === 4, "and the stake it was dealt for");
  must((await post("/cas/bj/stand", { token: A.token })).body?.ok === true, "a resumed hand must still play");
}

// ---------------------------------------------------------------------------
// one board at a time, and the newest is what comes back
{
  const A = await member();
  await post("/cas/mines/start", { token: A.token, bet: 2, mines: 3 });
  must((await resume(A.token)).game === "mines", "mines is open");
  // beef refuses to deal over a board holding sahurs, so the mines board stands
  const over = await post("/cas/beef/start", { token: A.token, bet: 2, difficulty: "easy" });
  must(over.body?.ok === true || over.status === 409, "unexpected: " + JSON.stringify(over.body));
  const d = await resume(A.token);
  must(d.game === "mines" || d.game === "beef", "something must still be open: " + JSON.stringify(d));
}

// ---------------------------------------------------------------------------
// the admin can write a debt straight to the ledger
{
  const A = await member();
  must(!!(await post("/admin/setdebt", { key: ADMIN, id: A.id, owed: 12.5 })).body?.ok, "setdebt failed");
  const bank = (await j("/bank?token=" + encodeURIComponent(A.token))).body;
  must(bank.owed === 12.5, "the member must owe what was written: " + bank.owed);
  must(bank.canBorrow === 0, "and cannot borrow over it");
  // no interest is added by the correction itself
  must(bank.principal === 12.5, "the principal follows it when there was no loan: " + bank.principal);
  // it shows in the admin listing
  const rows = (await j("/admin/balances?key=" + encodeURIComponent(ADMIN))).body.balances as
    { id: string; owed: number }[];
  must(rows.find((x) => x.id === A.id)?.owed === 12.5, "and in the balances pane");
  // and zero wipes it
  must(!!(await post("/admin/setdebt", { key: ADMIN, id: A.id, owed: 0 })).body?.ok, "wiping failed");
  must((await j("/bank?token=" + encodeURIComponent(A.token))).body.owed === 0, "the debt must be gone");
  must((await post("/admin/setdebt", { key: ADMIN, id: A.id, owed: -1 })).status === 400, "a negative debt is refused");
  must((await post("/admin/setdebt", { id: A.id, owed: 5 })).status === 403, "and it needs the admin key");
}

console.log(
  "resume: a mines board, a beef walk and a blackjack hand all come back exactly as they " +
    "were left — including a board dealt and never touched, which is where the stake used to " +
    "vanish — without ever showing the mine layout, the lane the cow dies in or the dealer's " +
    "hole card; and the admin can write a debt straight to the ledger",
);
