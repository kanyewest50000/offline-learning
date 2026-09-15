#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read
// Poker — the pit's tournament.
//
// Three things have to hold, and they are what this file is about.
//
//   The hand rankings are right. A pot goes to whoever the evaluator says it
//   goes to, so a wrong straight or a missed wheel is money.
//
//   Chips are conserved. Every hand, through every side pot an all-in cuts,
//   the chips on the table add up to the stacks that were dealt. A pot that
//   pays out more than went in is printing money; one that pays less is
//   eating it.
//
//   Sahurs are conserved. The chips are a fiction inside the table; the
//   buy-ins are real, escrowed before a card was dealt, and exactly one
//   player's balance may be larger at the end.
//
// The evaluator is imported as the real TypeScript out of server.ts rather
// than copied here, so this cannot quietly pass against a stale copy.
//
//   ADMIN_KEY=devadminkey deno run --allow-net --allow-env --unstable-kv server.ts
//   ADMIN_KEY=devadminkey API=http://127.0.0.1:8000 deno run --allow-net --allow-env --allow-read scripts/test-poker.ts

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const API = (Deno.env.get("API") || "http://127.0.0.1:8000").replace(/\/$/, "");
const ADMIN = Deno.env.get("ADMIN_KEY") || "devadminkey";

function must(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

// ---------------------------------------------------------------------------
// lift the engine's pure half out of server.ts and run it for real
const src = await Deno.readTextFile(`${ROOT}/server.ts`);
const from = src.indexOf("const PK_ORDER");
const to = src.indexOf("function pokerLevel");
must(from > 0 && to > from, "could not find the poker evaluator in server.ts");
const engine = `
const RANKS = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
const SUITS = ["♠","♥","♦","♣"];
function rndInt(n: number): number { return Math.floor(Math.random() * n); }
function rankOf(c: string): string { return c.slice(0, c.length - 1); }
${src.slice(from, to)}
export { pokerScore, pokerCmp, splitChips, pokerDeck, POKER_NAMES, pkVal };
`;
const mod = await import("data:application/typescript," + encodeURIComponent(engine));
const { pokerScore, pokerCmp, splitChips, pokerDeck, POKER_NAMES } = mod;

const S = "♠", H = "♥", D = "♦", C = "♣";
// each row is a hand and the category it must land in, worst to best
const HANDS: [string, string[], number][] = [
  ["high card", [`A${S}`, `J${H}`, `9${D}`, `7${C}`, `5${S}`, `3${H}`, `2${D}`], 0],
  ["a pair", [`A${S}`, `A${H}`, `9${D}`, `7${C}`, `5${S}`, `3${H}`, `2${D}`], 1],
  ["two pair", [`A${S}`, `A${H}`, `9${D}`, `9${C}`, `5${S}`, `3${H}`, `2${D}`], 2],
  ["three of a kind", [`A${S}`, `A${H}`, `A${D}`, `9${C}`, `5${S}`, `3${H}`, `2${D}`], 3],
  ["a straight", [`5${S}`, `6${H}`, `7${D}`, `8${C}`, `9${S}`, `K${H}`, `2${D}`], 4],
  ["a flush", [`A${S}`, `J${S}`, `9${S}`, `7${S}`, `3${S}`, `K${H}`, `2${D}`], 5],
  ["a full house", [`A${S}`, `A${H}`, `A${D}`, `9${C}`, `9${S}`, `3${H}`, `2${D}`], 6],
  ["four of a kind", [`A${S}`, `A${H}`, `A${D}`, `A${C}`, `9${S}`, `3${H}`, `2${D}`], 7],
  ["a straight flush", [`5${S}`, `6${S}`, `7${S}`, `8${S}`, `9${S}`, `K${H}`, `2${D}`], 8],
];
for (const [label, cards, cat] of HANDS) {
  const got = pokerScore(cards);
  must(got[0] === cat, `${label} must read as ${POKER_NAMES[cat]}, got ${POKER_NAMES[got[0]]}`);
}
// and each beats the one below it
for (let i = 1; i < HANDS.length; i++) {
  const lo = pokerScore(HANDS[i - 1][1]), hi = pokerScore(HANDS[i][1]);
  must(pokerCmp(hi, lo) > 0, `${HANDS[i][0]} must beat ${HANDS[i - 1][0]}`);
}
// the wheel is a straight at all — the ace has to be allowed to play low
must(pokerScore([`A${S}`, `2${H}`, `3${D}`, `4${C}`, `5${S}`, `K${H}`, `9${D}`])[0] === 4,
  "A-2-3-4-5 must read as a straight");
// and it is the LOWEST one — five high, not ace high. It is kept out of the
// ascending chain above for exactly this reason: it shares a category with the
// nine-high straight and must still lose to it.
must(
  pokerCmp(pokerScore([`A${S}`, `2${H}`, `3${D}`, `4${C}`, `5${S}`, `K${H}`, `9${D}`]),
    pokerScore([`2${S}`, `3${H}`, `4${D}`, `5${C}`, `6${S}`, `K${H}`, `9${D}`])) < 0,
  "the wheel must lose to a six-high straight",
);
// an ace does not wrap round the top
must(pokerScore([`Q${S}`, `K${H}`, `A${D}`, `2${C}`, `3${S}`, `7${H}`, `9${D}`])[0] === 0,
  "Q-K-A-2-3 is not a straight");
// the same hand in both holes is a genuine chop
must(pokerCmp(pokerScore([`A${S}`, `K${H}`, `Q${D}`, `J${C}`, `10${S}`, `3${H}`, `2${D}`]),
  pokerScore([`A${C}`, `K${D}`, `Q${H}`, `J${S}`, `10${H}`, `3${S}`, `2${C}`])) === 0,
  "the same straight in two suits must tie");
// kickers are read, not ignored
must(pokerCmp(pokerScore([`A${S}`, `A${H}`, `K${D}`, `7${C}`, `5${S}`, `3${H}`, `2${D}`]),
  pokerScore([`A${C}`, `A${D}`, `Q${H}`, `7${S}`, `5${H}`, `3${S}`, `2${C}`])) > 0,
  "a king kicker must beat a queen kicker");
// a full deck is 52 distinct cards, not a shoe drawn with replacement
{
  const deck = pokerDeck();
  must(deck.length === 52, "a deck is 52 cards, got " + deck.length);
  must(new Set(deck).size === 52, "a deck must not repeat a card");
}
// a split leaves nothing behind and mints nothing
for (const [pot, ways] of [[100, 3], [7, 2], [1, 4], [0, 3], [12345, 7]]) {
  const sh = splitChips(pot, ways);
  must(sh.length === ways, "a split must pay every winner");
  must(sh.reduce((a: number, b: number) => a + b, 0) === pot, `${pot} split ${ways} ways must add back to ${pot}`);
  must(sh.every((x: number) => x >= 0), "no share may be negative");
  must(Math.max(...sh) - Math.min(...sh) <= 1, "shares must differ by at most one chip");
}

// ---------------------------------------------------------------------------
// the blind structure has to actually finish a tournament
{
  const lv = src.slice(src.indexOf("const POKER_LEVELS"), src.indexOf("type PokerSeat"));
  const rows = Array.from(lv.matchAll(/\[(\d+),\s*(\d+)\]/g)).map((m) => [Number(m[1]), Number(m[2])]);
  must(rows.length >= 7, "expected a blind ladder, found " + rows.length + " levels");
  must(rows[6][0] === 250 && rows[6][1] === 500,
    "level 7 must be 250/500, got " + rows[6].join("/"));
  for (let i = 1; i < rows.length; i++) {
    must(rows[i][1] > rows[i - 1][1], "the blinds must never step down (level " + (i + 1) + ")");
  }
  // level 7 begins at six level-lengths in; at the shipped three minutes that
  // is eighteen, which is the "after 15-20 minutes" this was asked for
  const perLevel = Number((src.match(/POKER_LEVEL_MS[^|]*\|\|\s*(\d+)\s*\*\s*60\s*\*\s*1000/) || [])[1] || 0);
  must(perLevel > 0, "could not read the level length");
  const mins = 6 * perLevel;
  must(mins >= 15 && mins <= 20, "250/500 must arrive 15-20 minutes in, got " + mins);
  // and the ladder must keep climbing past it, or a stubborn heads-up never ends
  const last = rows[rows.length - 1];
  must(last[1] >= 2000, "the ladder must end high enough to force the issue, got " + last.join("/"));
}

// ---------------------------------------------------------------------------
// a real tournament, over the wire
// deno-lint-ignore no-explicit-any
async function call(path: string, init?: RequestInit): Promise<any> {
  const r = await fetch(API + path, init);
  return await r.json().catch(() => ({}));
}
// deno-lint-ignore no-explicit-any
function post(path: string, body: unknown): Promise<any> {
  return call(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

type Player = { name: string; token: string; id: string };
const nap = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function member(tag: string, bal: number): Promise<Player> {
  const name = tag + Math.random().toString(36).slice(2, 8);
  // A tournament needs a table full of people and this file fills several, so
  // it walks straight into the anonymous rate limit that protects /apply from
  // exactly this. That guard is the thing working, not a failure — so back off
  // and come back rather than reporting poker broken.
  // The cap is a fixed window, so the wait has to be able to outlast a whole
  // one rather than nibbling at the end of it — 5s a go, up to a little over a
  // minute, which is the window plus slack.
  let ap = await post("/apply", { username: name, application: "poker" });
  for (let wait = 0; ap.error === "slow down" && wait < 15; wait++) {
    await nap(5000);
    ap = await post("/apply", { username: name, application: "poker" });
  }
  must(ap.token, "could not apply as " + name + ": " + JSON.stringify(ap).slice(0, 120));
  const pend = await call("/admin/pending", { headers: { "x-admin-key": ADMIN } });
  // deno-lint-ignore no-explicit-any
  const row = (pend.pending || []).find((p: any) => p.username === name);
  must(row, "application for " + name + " never landed");
  const ok = await post("/admin/decide", { key: ADMIN, id: row.id, action: "approve" });
  must(ok.status === "approved", "could not approve " + name + ": " + JSON.stringify(ok));
  await post("/admin/setbal", { key: ADMIN, id: row.id, balance: bal });
  return { name, token: ap.token, id: row.id };
}

const BUY_IN = 5;
type Seen = { showdowns: number; rivers: number; sidePots: number; raises: number };
type Mine = { canCheck: boolean; toCall: number; raiseTo: number; maxTo: number };

// Two ways to play, because they prove different things. The wild one shoves
// constantly, which is what makes all-ins, side pots and short stacks happen.
// The patient one checks, calls and makes real raises, which is what carries
// hands to a river and puts them face up — without it the evaluator never runs
// in an actual game and the whole showdown path goes untested.
function decide(profile: string, p: Mine) {
  const r = Math.random();
  if (profile === "wild") {
    if (r < 0.30 && p.maxTo > 0) return { action: "allin", amount: 0 };
    if (p.canCheck) return { action: "check", amount: 0 };
    if (r < 0.55) return { action: "fold", amount: 0 };
    return { action: "call", amount: 0 };
  }
  // patient
  if (r < 0.06 && p.maxTo > 0) return { action: "allin", amount: 0 };
  if (r < 0.22 && p.raiseTo > 0 && p.raiseTo < p.maxTo) {
    return { action: "raise", amount: p.raiseTo };   // exactly the minimum legal raise
  }
  if (p.canCheck) return { action: "check", amount: 0 };
  if (r < 0.30) return { action: "fold", amount: 0 };
  return { action: "call", amount: 0 };
}

async function tournament(seats: number, profile: string, seen: Seen): Promise<void> {
  const players: Player[] = [];
  for (let i = 0; i < seats; i++) players.push(await member("pk", 50));
  const before = players.map(() => 50);

  const made = await post("/duel/create", { token: players[0].token, game: "poker", bet: BUY_IN, seats });
  must(made.ok, "could not open a " + seats + "-seat table: " + JSON.stringify(made).slice(0, 160));
  const id = made.duel.id;
  must(made.duel.seats === seats, "table wanted " + seats + " seats, got " + made.duel.seats);
  for (let i = 1; i < seats; i++) {
    const j = await post("/duel/join", { token: players[i].token, id });
    must(j.ok, players[i].name + " could not sit: " + JSON.stringify(j).slice(0, 160));
  }
  for (const p of players) {
    const c = await post("/duel/confirm", { token: p.token, id });
    must(c.ok, p.name + " could not confirm: " + JSON.stringify(c).slice(0, 160));
  }

  const stackTotal = (st: { poker: { stack: number } }) => st.poker.stack * seats;
  let hands = 0, acts = 0, shownHand = -1, riverHand = -1;
  for (;;) {
    must(acts++ < 4000, "a " + seats + "-seat tournament never finished");
    // whoever is to act, ask them
    const st = await call("/duel/state?token=" + players[0].token + "&id=" + id);
    must(st.ok || st.duel, "lost the table: " + JSON.stringify(st).slice(0, 160));
    const dv = st.duel;
    if (dv.settled) {
      must(dv.state === "done", "a finished tournament must be done");
      break;
    }
    const pk = dv.poker;
    must(pk, "a live poker table must carry its state");
    hands = Math.max(hands, pk.hand);

    // ---- the invariant, checked on every single look at the table ----
    const onTable = pk.seats.reduce((a: number, s: { chips: number }) => a + s.chips, 0) + pk.pot;
    must(onTable === stackTotal(dv),
      `chips leaked: ${onTable} on the table, ${stackTotal(dv)} were dealt (hand ${pk.hand})`);
    must(pk.seats.every((s: { chips: number }) => s.chips >= 0), "a stack went negative");
    // nobody may see anybody else's hole cards while the hand is live
    for (const s of pk.seats) {
      if (!s.you && !pk.show) {
        must(s.cards.length === 0, "a live hand leaked " + s.name + "'s hole cards");
      }
    }

    // what the table has actually shown us, so the run can prove it exercised
    // the parts that matter rather than just finishing. Counted once per hand,
    // not once per look, or a slow poller would inflate every number here.
    if (pk.show && pk.hand !== shownHand) { seen.showdowns++; shownHand = pk.hand; }
    if (pk.street >= 3 && pk.hand !== riverHand) { seen.rivers++; riverHand = pk.hand; }
    // more than one all-in still in the hand is what cuts a side pot
    if (pk.seats.filter((s: { allIn: boolean; folded: boolean }) => s.allIn && !s.folded).length >= 1 &&
      pk.seats.filter((s: { folded: boolean; out: boolean }) => !s.folded && !s.out).length >= 3) seen.sidePots++;

    // A finished hand stays up for a moment so it can be read. Nobody is to act
    // while it does; the next deal comes off the table's own clock, which the
    // next read of it triggers.
    if (pk.showing) {
      must(pk.toAct < 0, "nobody may be asked to act while a hand is being shown");
      await nap(40);
      continue;
    }

    const turn = pk.toAct;
    must(turn >= 0, "a live table with nobody to act (hand " + pk.hand + ")");
    const actor = players[turn];
    const view = await call("/duel/state?token=" + actor.token + "&id=" + id);
    const mine = view.duel.poker;
    must(mine.yourTurn, "the table says seat " + turn + " is to act but they disagree");
    must(mine.yourCards.length === 2, "a player in a hand must hold two cards");
    const mv = decide(profile, mine);
    if (mv.action === "raise") seen.raises++;
    const res = await post("/duel/poker", { token: actor.token, id, action: mv.action, amount: mv.amount });
    must(res.ok || res.error, "a move got no answer");
    // an illegal move must be refused with a reason, never silently applied
    if (!res.ok) must(typeof res.error === "string" && res.error.length > 0, "a refusal must say why");
  }

  // ---- one winner, and the sahurs add up ----
  const fin = await call("/duel/state?token=" + players[0].token + "&id=" + id);
  const dv = fin.duel;
  must(dv.winner, "a tournament must end with a winner, got " + JSON.stringify(dv.paid));
  must(dv.paid.length === 1, "a tournament pays exactly one player, got " + dv.paid.length);
  must(Math.abs(dv.paid[0].amount - BUY_IN * seats) < 1e-9,
    "the winner takes every buy-in: got " + dv.paid[0].amount + " of " + BUY_IN * seats);

  let after = 0;
  for (const p of players) {
    const bal = await call("/cas/me?token=" + p.token);
    must(Number.isFinite(Number(bal.balance)), "could not read " + p.name + "'s balance: " + JSON.stringify(bal).slice(0, 120));
    after += Number(bal.balance);
  }
  const start = before.reduce((a, b) => a + b, 0);
  must(Math.abs(after - start) < 1e-9,
    `sahurs were ${start} before and ${after} after — the pit must not mint or eat them`);
  console.log(`  ${seats}-handed: ${hands} hands, ${acts} actions, ${dv.winner} took ${dv.paid[0].amount}`);
}

// ---------------------------------------------------------------------------
// the table refuses what it should, before any of it is played for real
{
  const a = await member("pkx", 50), b = await member("pkx", 50), c = await member("pkx", 50);
  const made = await post("/duel/create", { token: a.token, game: "poker", bet: BUY_IN, seats: 2 });
  const id = made.duel.id;
  await post("/duel/join", { token: b.token, id });
  await post("/duel/confirm", { token: a.token, id });
  await post("/duel/confirm", { token: b.token, id });

  const st = await call("/duel/state?token=" + a.token + "&id=" + id);
  const pk = st.duel.poker;
  const onTurn = pk.toAct === 0 ? a : b;
  const offTurn = pk.toAct === 0 ? b : a;

  const outOfTurn = await post("/duel/poker", { token: offTurn.token, id, action: "check", amount: 0 });
  must(outOfTurn.error === "not your turn", "acting out of turn must be refused: " + JSON.stringify(outOfTurn));

  const stranger = await post("/duel/poker", { token: c.token, id, action: "check", amount: 0 });
  must(stranger.error === "not your table", "a stranger must not reach the table: " + JSON.stringify(stranger));

  // preflop the big blind is out there, so the first player always owes something
  const mine = (await call("/duel/state?token=" + onTurn.token + "&id=" + id)).duel.poker;
  if (mine.toCall > 0) {
    const cheat = await post("/duel/poker", { token: onTurn.token, id, action: "check", amount: 0 });
    must(/to call/.test(String(cheat.error)), "checking into a bet must be refused: " + JSON.stringify(cheat));
    const small = await post("/duel/poker", { token: onTurn.token, id, action: "raise", amount: mine.raiseTo - 1 });
    must(/at least/.test(String(small.error)), "an undersized raise must be refused: " + JSON.stringify(small));
  }
  const nonsense = await post("/duel/poker", { token: onTurn.token, id, action: "dance", amount: 0 });
  must(nonsense.error === "no such move", "an invented move must be refused: " + JSON.stringify(nonsense));

  // the table is still exactly where it was — nothing refused was half-applied
  const after = (await call("/duel/state?token=" + a.token + "&id=" + id)).duel.poker;
  must(after.hand === pk.hand && after.toAct === pk.toAct && after.pot === pk.pot,
    "a refused move must leave the table untouched");
  console.log("  refusals: out of turn, not your table, checking into a bet, short raise, invented move");
}

// ---------------------------------------------------------------------------
// who speaks first. Heads-up is the case every poker engine gets wrong once:
// the button posts the small blind and acts FIRST before the flop, then LAST
// on every street after it. Getting this backwards is not cosmetic — it hands
// position to the wrong player for the whole tournament.
{
  const a = await member("pko", 50), b = await member("pko", 50);
  const made = await post("/duel/create", { token: a.token, game: "poker", bet: BUY_IN, seats: 2 });
  const id = made.duel.id;
  await post("/duel/join", { token: b.token, id });
  await post("/duel/confirm", { token: a.token, id });
  await post("/duel/confirm", { token: b.token, id });

  const look = async () => (await call("/duel/state?token=" + a.token + "&id=" + id)).duel.poker;
  let p = await look();
  const players = [a, b];

  must(p.toAct === p.button,
    `heads-up preflop the button acts first: button ${p.button}, to act ${p.toAct}`);
  // the button is also the small blind, so it has the smaller amount out
  const sb = p.seats[p.button], bb = p.seats[1 - p.button];
  must(sb.inStreet < bb.inStreet,
    `the heads-up button posts the small blind: ${sb.inStreet} vs ${bb.inStreet}`);
  must(sb.inStreet === p.blinds[0] && bb.inStreet === p.blinds[1],
    `the blinds must be posted as ${p.blinds.join("/")}, got ${sb.inStreet}/${bb.inStreet}`);

  // walk it to a flop: the button calls, the big blind checks
  await post("/duel/poker", { token: players[p.toAct].token, id, action: "call", amount: 0 });
  p = await look();
  must(p.street === 0, "calling the small blind must not end the street — the big blind still has an option");
  await post("/duel/poker", { token: players[p.toAct].token, id, action: "check", amount: 0 });
  p = await look();
  must(p.street === 1, "a call and a check must bring the flop, got street " + p.street);
  must(p.board.length === 3, "a flop is three cards, got " + p.board.length);
  must(p.toAct === 1 - p.button,
    `after the flop the button acts LAST heads-up: button ${p.button}, to act ${p.toAct}`);
  console.log("  order: heads-up button acts first preflop and last after it, blinds posted correctly");
}

console.log("tournaments:");
const seen: Seen = { showdowns: 0, rivers: 0, sidePots: 0, raises: 0 };
for (const seats of [2, 3, 4, 5]) await tournament(seats, "wild", seen);
for (const seats of [3, 5]) await tournament(seats, "patient", seen);
// a run that never reached a showdown proved nothing about the hand rankings in
// an actual game, however green it looked
must(seen.showdowns > 0, "no hand was ever shown down — the evaluator went unexercised");
must(seen.rivers > 0, "no hand ever reached a river");
must(seen.raises > 0, "no real raise was ever made");
console.log(
  `  exercised: ${seen.showdowns} showdowns, ${seen.rivers} looks at a river, ` +
    `${seen.raises} raises, ${seen.sidePots} multi-way all-in spots`,
);

console.log(
  "poker: the rankings are right (wheel low, no wrap-round ace, kickers read), a deck is 52 " +
    "distinct cards, split pots add back to the chip, the blinds reach 250/500 eighteen minutes " +
    "in and keep climbing — and across 2-, 3-, 4- and 5-handed tournaments the chips on the table " +
    "always add up to the stacks dealt, no hole card is ever visible to anyone else mid-hand, and " +
    "the sahurs that went in are the sahurs that came out",
);
