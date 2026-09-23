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
// The slice runs all the way to pokerDealNext() so it carries the side-pot
// maths, the uncalled-bet push-back and pokerFinishHand() itself, not just the
// evaluator. Who gets paid what — and what the table then SAYS happened — is as
// much "the rules" as which hand wins, and it is the half a player argues with.
// Taking the real pokerFinishHand() rather than a copy of what it does is the
// point: a copy would keep passing after the real one stopped calling a step.
// Only the table's own dials are stubbed; none of them are read below.
const src = await Deno.readTextFile(`${ROOT}/server.ts`);
const from = src.indexOf("const PK_ORDER");
const to = src.indexOf("function pokerDealNext");
must(from > 0 && to > from, "could not find the poker evaluator in server.ts");
const engine = `
const RANKS = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
const SUITS = ["♠","♥","♦","♣"];
const POKER_LEVELS: [number, number][] = [[25, 50]];
const POKER_LEVEL_MS = 180000;
const POKER_SHOW_MS = 6000;
const POKER_END_MS = 3000;
type PokerSeat = { cards: string[]; chips: number; inStreet: number; inHand: number;
  folded: boolean; allIn: boolean; out: boolean; acted: boolean };
// deno-lint-ignore no-explicit-any
type PokerState = any;
function rndInt(n: number): number { return Math.floor(Math.random() * n); }
function rankOf(c: string): string { return c.slice(0, c.length - 1); }
${src.slice(from, to)}
export { pokerScore, pokerCmp, splitChips, pokerDeck, POKER_NAMES, pkVal,
  pokerFinishHand };
`;
const mod = await import("data:application/typescript," + encodeURIComponent(engine));
const { pokerScore, pokerCmp, splitChips, pokerDeck, POKER_NAMES } = mod;
const { pokerFinishHand } = mod;

const S = "♠", H = "♥", D = "♦", C = "♣";
// each row is a hand and the category it must land in, worst to best
const HANDS: [string, string[], number][] = [
  ["high card", [`A${S}`, `J${H}`, `9${D}`, `7${C}`, `5${S}`, `3${H}`, `2${D}`], 0],
  ["pair", [`A${S}`, `A${H}`, `9${D}`, `7${C}`, `5${S}`, `3${H}`, `2${D}`], 1],
  ["two pair", [`A${S}`, `A${H}`, `9${D}`, `9${C}`, `5${S}`, `3${H}`, `2${D}`], 2],
  ["three of a kind", [`A${S}`, `A${H}`, `A${D}`, `9${C}`, `5${S}`, `3${H}`, `2${D}`], 3],
  ["straight", [`5${S}`, `6${H}`, `7${D}`, `8${C}`, `9${S}`, `K${H}`, `2${D}`], 4],
  ["flush", [`A${S}`, `J${S}`, `9${S}`, `7${S}`, `3${S}`, `K${H}`, `2${D}`], 5],
  ["full house", [`A${S}`, `A${H}`, `A${D}`, `9${C}`, `9${S}`, `3${H}`, `2${D}`], 6],
  ["four of a kind", [`A${S}`, `A${H}`, `A${D}`, `A${C}`, `9${S}`, `3${H}`, `2${D}`], 7],
  ["straight flush", [`5${S}`, `6${S}`, `7${S}`, `8${S}`, `9${S}`, `K${H}`, `2${D}`], 8],
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
// The hole card plays. Two hands that miss the board entirely are separated by
// the best card either of them holds, and the ace on the board belongs to both
// of them, so it separates nothing. This is the shape that gets argued about —
// it looks like a chop from the seat because the top card is shared.
{
  const board = [`A${S}`, `9${D}`, `7${C}`, `5${H}`, `3${S}`];
  const kj = pokerScore([`K${D}`, `J${S}`, ...board]);
  const tj = pokerScore([`10${H}`, `J${C}`, ...board]);
  must(kj[0] === 0 && tj[0] === 0, "neither hand should have made anything");
  must(pokerCmp(kj, tj) > 0, "K-J must beat 10-J on an ace-high board: the king plays");
  // and it is only ever a chop when the five on the board are the best five
  // for both — never while both are still reading as high card
  const play = [`A${S}`, `K${H}`, `Q${C}`, `J${D}`, `10${S}`];
  must(pokerCmp(pokerScore([`K${D}`, `J${S}`, ...play]), pokerScore([`10${H}`, `J${C}`, ...play])) === 0,
    "a board that plays is a chop");
}
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
// who the table says won it
//
// Chips nobody matched are not a pot and were not won. They come back to the
// player who put them out, and the hand is announced without them. Get this
// wrong and the money still lands in the right stack — it comes back out of the
// side-pot maths as a pot only its owner can win — but it arrives looking like
// a win: the loser turns up among the winners, their row is lit as a winner,
// and a pot taken outright is announced as a split. Which is exactly what a
// player sees when they hold the best hand and are told they chopped it.
{
  type Seat = {
    cards: string[]; chips: number; inStreet: number; inHand: number;
    folded: boolean; allIn: boolean; out: boolean; acted: boolean;
  };
  const seat = (cards: string[], inHand: number, o: Partial<Seat> = {}): Seat => ({
    cards, chips: 0, inStreet: inHand, inHand,
    folded: false, allIn: false, out: false, acted: true, ...o,
  });
  // hand the real pokerFinishHand() a table and read back what it says
  type Row = { name: string; hand: string; won: number };
  const settle = (seats: Seat[], names: string[], board: string[]) => {
    // deno-lint-ignore no-explicit-any
    const ps: any = {
      seats, board, button: 0, startedAt: Date.now(), show: null, note: "", log: [],
      toAct: -1, next: 0, street: 4, deck: [], call: 0, minRaise: 50, hand: 1,
      reveal: false, runout: 0,
    };
    const staked = seats.reduce((a, s) => a + s.chips + s.inHand, 0);
    pokerFinishHand(ps, names);
    const show = (ps.show || []) as Row[];
    return {
      show,
      note: ps.note as string,
      winners: show.filter((x) => x.won > 0).map((x) => x.name),
      stacks: seats.map((s) => s.chips),
      staked, paid: seats.reduce((a, s) => a + s.chips, 0),
      log: ps.log as string[],
    };
  };
  const dry = [`A${S}`, `9${D}`, `7${C}`, `5${H}`, `3${S}`];   // nothing plays off it
  const kj = [`K${D}`, `J${S}`], tj = [`10${H}`, `J${C}`];

  // the reported hand: the best hand is all in for 100, the other had 200 out,
  // so 100 of theirs was never called
  {
    const r = settle(
      [seat(kj, 100, { allIn: true }), seat(tj, 200, { chips: 300 })],
      ["best", "other"],
      dry,
    );
    must(r.winners.length === 1 && r.winners[0] === "best",
      "the better hand takes it alone, got: " + r.note);
    must(!r.note.includes("split"), "an uncalled bet must not turn a win into a split: " + r.note);
    must(r.show[1].won === 0, "the losing hand must not be shown as having won anything");
    must(r.note === "best takes 200", 'the pot is what was matched: expected "best takes 200", got "' + r.note + '"');
    must(r.log.some((l) => /takes back 100 uncalled/.test(l)), "the push-back must be on the record");
    must(r.stacks[0] === 200 && r.stacks[1] === 400,
      "stacks after: " + JSON.stringify(r.stacks) + " — the loser keeps the 100 nobody called");
    must(r.staked === r.paid, "chips must conserve: " + r.staked + " in, " + r.paid + " out");
  }
  // the same board, the same money, but both hands are the board: a real chop
  {
    const play = [`A${S}`, `K${H}`, `Q${C}`, `J${D}`, `10${S}`];
    const r = settle([seat(kj, 200), seat(tj, 200)], ["one", "two"], play);
    must(r.winners.length === 2 && r.note.includes("split"), "a genuine chop must still say split: " + r.note);
    must(r.staked === r.paid, "chips must conserve through a chop");
  }
  // money a folded player left behind was matched, so it is won, not returned —
  // the test that keeps the push-back from swallowing dead money
  {
    const r = settle([
      seat(kj, 300),                                  // best hand, most out
      seat(tj, 100, { allIn: true }),                 // short all in
      seat([`2${D}`, `3${D}`], 250, { folded: true }), // folded, chips stay
    ], ["best", "short", "folder"], dry);
    must(r.log.some((l) => /takes back 50 uncalled/.test(l)),
      "only the 50 above the folder's 250 was uncalled: " + JSON.stringify(r.log));
    must(r.note === "best takes 600",
      'the folder\'s money is part of the pot: expected "best takes 600", got "' + r.note + '"');
    must(r.winners.length === 1 && r.winners[0] === "best", "one winner, got: " + r.note);
    must(r.stacks[0] === 650, "the winner takes the pot and their own 50 back, got " + r.stacks[0]);
    must(r.staked === r.paid, "chips must conserve with dead money in the pot");
  }
  // an ordinary called showdown is untouched by any of this
  {
    const r = settle([seat(kj, 200), seat(tj, 200)], ["best", "other"], dry);
    must(r.note === "best takes 400" && r.winners.length === 1 && r.stacks[0] === 400,
      "a fully called pot goes whole to the best hand: " + r.note + " " + JSON.stringify(r.stacks));
    must(!r.log.some((l) => /takes back/.test(l)),
      "nothing to push back when both put in the same: " + JSON.stringify(r.log));
    must(r.staked === r.paid, "chips must conserve");
  }
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
// every chair a poker table has, which is no longer something a host chooses
const SEAT_MAX = 5;

// Open a poker table and get two people dealt in at it. The table has five
// chairs whoever asks for it, so a heads-up game is the HOST closing it at two
// rather than the table filling up — /duel/start is that decision, and it hands
// over to the same handshake a full table does.
async function headsUp(a: Player, b: Player): Promise<string> {
  const made = await post("/duel/create", { token: a.token, game: "poker", bet: BUY_IN });
  must(made.ok, "could not open a table: " + JSON.stringify(made).slice(0, 160));
  const id = made.duel.id as string;
  must(made.duel.seats === SEAT_MAX, "a poker table opens with every chair: " + made.duel.seats);
  const sat = await post("/duel/join", { token: b.token, id });
  must(sat.ok, b.name + " could not sit down: " + JSON.stringify(sat).slice(0, 160));
  const go = await post("/duel/start", { token: a.token, id });
  must(go.ok, "the host could not deal it heads-up: " + JSON.stringify(go).slice(0, 160));
  must(go.duel.state === "confirm", "dealing hands over to the handshake: " + go.duel.state);
  must((await post("/duel/confirm", { token: a.token, id })).ok, a.name + " could not confirm");
  must((await post("/duel/confirm", { token: b.token, id })).ok, b.name + " could not confirm");
  return id;
}
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

  // A poker table is a lobby: it opens with every chair it has, whoever turns
  // up sits down, and the host deals with however many that came to. So the
  // number of players is decided HERE, by how many of them sit, rather than
  // asked for up front — and the table is closed by the host saying so.
  const made = await post("/duel/create", { token: players[0].token, game: "poker", bet: BUY_IN });
  must(made.ok, "could not open a table: " + JSON.stringify(made).slice(0, 160));
  const id = made.duel.id;
  must(made.duel.seats === SEAT_MAX, "a poker table opens with every chair: " + made.duel.seats);
  for (let i = 1; i < seats; i++) {
    const j = await post("/duel/join", { token: players[i].token, id });
    must(j.ok, players[i].name + " could not sit: " + JSON.stringify(j).slice(0, 160));
  }
  // a table that filled every chair has already closed itself; one the host
  // stopped short of full has to be dealt
  if (seats < SEAT_MAX) {
    const go = await post("/duel/start", { token: players[0].token, id });
    must(go.ok, "the host could not deal " + seats + "-handed: " + JSON.stringify(go).slice(0, 160));
    must(go.duel.state === "confirm", "dealing hands over to the handshake: " + go.duel.state);
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
    // Nobody may see anybody else's hole cards while the hand is still being
    // played. There are exactly two ways a hand becomes visible — it was shown
    // down, or every chip is in and the board is being run out — and in both
    // of them there is no decision left for the knowledge to be worth
    // anything. Anything else is a leak.
    for (const s of pk.seats) {
      if (!s.you && !pk.show && !pk.reveal) {
        must(s.cards.length === 0, "a live hand leaked " + s.name + "'s hole cards");
      }
    }
    if (pk.reveal && !pk.show) {
      must(pk.toAct < 0, "hands were turned face up while " + pk.seats[pk.toAct]?.name + " could still act");
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
    // Two states where the table is moving on its own clock and nobody is
    // being asked for anything: a finished hand still on show, and a board
    // being run out over all-ins.
    if (pk.showing || pk.runout) {
      must(pk.toAct < 0, "nobody may be asked to act while the table is dealing itself out");
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
  const id = await headsUp(a, b);

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
  const id = await headsUp(a, b);

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

// ---------------------------------------------------------------------------
// An all-in is not a result, it is a hand that still has to be watched. When
// the last chip goes in with board to come, the rest of it must be dealt a
// street at a time with the hands face up — not resolved inside the request
// that called the bet, which cuts straight from the call to the win screen and
// throws away the only part of an all-in anybody cares about.
{
  const a = await member("pkr", 50), b = await member("pkr", 50);
  const id = await headsUp(a, b);
  const players = [a, b];
  const look = async (who = a) => (await call("/duel/state?token=" + who.token + "&id=" + id)).duel.poker;

  // Both of them sit down with the same stack, so a split pot knocks nobody
  // out and the table simply deals the next hand — which is a draw, not the
  // last hand this is about. So a chop is played again, from the next deal.
  // deno-lint-ignore no-explicit-any
  let p: any = null, done: any = null, streets = new Set<number>(), sawRunout = 0;
  for (let attempt = 0; attempt < 6; attempt++) {
    // get it all in before the flop
    p = await look();
    const first = p.toAct;
    await post("/duel/poker", { token: players[first].token, id, action: "allin", amount: 0 });
    p = await look();
    must(p.toAct === 1 - first, "the other player must be asked to call the all-in");
    await post("/duel/poker", { token: players[p.toAct].token, id, action: "call", amount: 0 });

    // the moment the call lands the hand must NOT be over
    p = await look();
    must(!p.show, "an all-in called before the flop must not resolve on the spot");
    must(p.street < 3, "the board must still have cards to come, got street " + p.street);
    must(p.runout, "the table must be running the board out");
    must(p.toAct < 0, "nobody may be asked to act during a runout");
    must(p.reveal, "the hands must be face up once every chip is in");
    for (const s of p.seats) {
      must(s.cards.length === 2, s.name + "'s hand must be face up during a runout, got " + s.cards.length);
    }

    // and the streets have to arrive one at a time rather than all at once
    streets = new Set<number>([p.street]);
    sawRunout = 0;
    done = null;
    for (let i = 0; i < 150; i++) {
      await nap(200);
      const q = await look();
      streets.add(q.street);
      if (q.runout) sawRunout++;
      if (q.show) { done = q; break; }
    }
    must(done, "the runout never finished");
    must(sawRunout > 0, "the runout was never visible — it resolved in one go");
    must(streets.size >= 2, "the board arrived all at once: only saw street " + [...streets].join(","));
    must(done!.board.length === 5, "a runout must deal the whole board, got " + done!.board.length);
    must(done!.show.length === 2, "both hands must be shown down, got " + done!.show.length);
    if (!done!.seats.every((s: { chips: number }) => s.chips > 0)) break;
    // chopped: wait for the next deal and go again
    const was = done!.hand;
    for (let i = 0; i < 100; i++) {
      await nap(200);
      const q = await look();
      if (q.hand > was && q.toAct >= 0) break;
    }
  }
  must(!done!.seats.every((s: { chips: number }) => s.chips > 0), "six split pots in a row — the hand never ended the tournament");

  // ---- and the table is not whipped away the moment the pot is paid --------
  // Both of them are all in, so this hand ends the tournament — and the duel
  // used to be finished in the very beat that awarded the pot, which replaced
  // the board with the result screen before either player had read the river
  // that put somebody out. The last hand gets the same pause every other hand
  // gets; only when it is up does the table come down.
  const shownAt = Date.now();
  const duelNow = async () => (await call("/duel/state?token=" + a.token + "&id=" + id)).duel;
  const atShowdown = await duelNow();
  must(atShowdown.state === "live" && !atShowdown.settled,
    "the tournament must not be finished in the beat that pays the last pot: " + atShowdown.state);

  let ended = null, endedAt = 0;
  for (let i = 0; i < 150; i++) {
    await nap(200);
    const dv = await duelNow();
    if (dv.state === "done") { ended = dv; endedAt = Date.now(); break; }
    must(dv.poker && dv.poker.board.length === 5,
      "the whole board must stay readable while the hand is held up");
    must(dv.poker.show && dv.poker.show.length === 2, "…and so must both hands");
  }
  must(ended, "the tournament never finished after its last hand");
  const held = endedAt - shownAt;
  must(held >= 2000, "the last hand must stay up long enough to read — held only " + held + "ms");
  must(held < 20000, "…but it must not sit there forever: " + held + "ms");
  must(ended!.poker && ended!.poker.board.length === 5,
    "the finished duel still carries the board that decided it");
  must(!!ended!.winner || (ended!.paid || []).length > 0, "somebody has to have taken it");
  console.log(
    "  all-in: dealt out over " + streets.size + " streets with both hands face up, then shown " +
      "down — not resolved in the call — and the table it ended on stays up " + held +
      "ms before the duel is finished",
  );
}

// ---------------------------------------------------------------------------
// The number in the middle of the table
//
// Two different pots, and they are not interchangeable. `pot` is the running
// total, which is what a pot-sized raise is reckoned against. `potMid` is what
// the middle SHOWS: the pot as it stood when this street began. The chips going
// in right now are already drawn in front of the people who pushed them out, so
// counting them in the middle as well is the same money on screen twice, and a
// total that jumps on every call is not one anybody can read a decision off.
{
  const a = await member("pkm", 50), b = await member("pkm", 50);
  const id = await headsUp(a, b);
  const players = [a, b];
  const look = async () => (await call("/duel/state?token=" + a.token + "&id=" + id)).duel.poker;
  const act = async (p: { toAct: number }, action: string, amount = 0) =>
    await post("/duel/poker", { token: players[p.toAct].token, id, action, amount });

  let p = await look();
  must(typeof p.potMid === "number", "the table must send the pot its middle shows");
  must(p.pot > 0, "the blinds are out, so the running total is not zero");
  must(p.potMid === 0, "…but nothing has been swept in yet: " + p.potMid);

  await act(p, "call");
  p = await look();
  must(p.potMid === 0, "a call preflop still does not move the middle: " + p.potMid);
  if (p.toAct >= 0) { await act(p, "check"); p = await look(); }
  must(p.street === 1 && p.board.length === 3, "the flop must be out, got street " + p.street);
  must(p.potMid === p.pot, "between streets the two agree: " + p.potMid + " vs " + p.pot);
  const onFlop = p.potMid;
  must(onFlop > 0, "and the middle has finally taken in the preflop money");

  const bettor = p.toAct;
  await act(p, "raise", onFlop + 20);
  p = await look();
  must(p.pot > onFlop, "the running total takes a bet straight away: " + p.pot);
  must(p.potMid === onFlop, "the middle does not move while it is still going in: " + p.potMid);
  must(p.seats[bettor].inStreet > 0, "…because it is drawn in front of the bettor instead");

  await act(p, "call");
  p = await look();
  must(p.street === 2 && p.board.length === 4, "the turn must be out");
  must(p.potMid === p.pot, "and now the middle carries the whole street: " + p.potMid + " vs " + p.pot);
  must(p.potMid > onFlop, "…which is more than it was before the betting");
  console.log(
    "  the pot: the middle holds still through a street and moves when the chips are swept in, " +
      "while the running total a raise is reckoned against rides alongside it",
  );
}

// ---------------------------------------------------------------------------
// The table is a lobby
//
// It used to be a fixed-size thing: the host said how many were playing when
// they put it up, and it waited for exactly that many. Which was a guess either
// way round — open it for five and a table nobody else found sat there for ten
// minutes and refunded itself; open it for two and the third person to turn up
// could not sit down. Two is a game, five is a game, and which one you get
// depends on who happens to be about.
//
// So it opens with every chair it has, anybody may take one, and the host deals
// with whoever is there. What must NOT go with that: the handshake. Starting is
// choosing who is at the table, not skipping the agreeing to it — everyone
// seated still says yes or every stake goes home.
{
  const h = await member("pkl", 50), g = await member("pkl", 50), x = await member("pkl", 50);

  // the number asked for is not read at all
  const made = await post("/duel/create", { token: h.token, game: "poker", bet: BUY_IN, seats: 2 });
  must(made.ok, "could not open a table: " + JSON.stringify(made).slice(0, 160));
  const id = made.duel.id;
  must(made.duel.seats === SEAT_MAX, "a poker table opens with every chair it has: " + made.duel.seats);
  must(made.duel.hostStarts === true, "…and says it is closed by a decision");
  must(made.duel.canStart === false, "…which cannot be taken with nobody at it");

  // and the pit says which kind of table it is, because it changes whether
  // sitting down means waiting for four more people or for one press
  const list = await call("/duel/list?token=" + h.token);
  const row = (list.open || []).find((t: { id: string }) => t.id === id);
  must(row && row.hostStarts === true, "the pit list must say the host deals this one");

  must(!(await post("/duel/start", { token: h.token, id })).ok, "one player is not a game");
  must((await post("/duel/join", { token: g.token, id })).ok, "could not sit down");
  const two = (await call("/duel/state?token=" + h.token + "&id=" + id)).duel;
  must(two.state === "open", "two of five is not full, so it is still open: " + two.state);
  must(two.canStart === true, "…and now there is something for the host to decide");
  must(!(await post("/duel/start", { token: g.token, id })).ok, "only the host deals");

  const go = await post("/duel/start", { token: h.token, id });
  must(go.ok, "the host could not deal: " + JSON.stringify(go).slice(0, 160));
  must(go.duel.state === "confirm", "dealing hands over to the handshake: " + go.duel.state);
  // the roster is settled the moment it is dealt
  must(!(await post("/duel/join", { token: x.token, id })).ok,
    "nobody may sit down at a table that has been dealt");
  must((await post("/duel/confirm", { token: h.token, id })).ok, "host could not confirm");
  must((await post("/duel/confirm", { token: g.token, id })).ok, "guest could not confirm");
  const live = (await call("/duel/state?token=" + h.token + "&id=" + id)).duel;
  must(live.state === "live", "two yeses out of two must start it: " + live.state);
  must(live.poker.seats.length === 2, "heads-up, at a five-chair table: " + live.poker.seats.length);
  must(live.pot === BUY_IN * 2, "and the pot is what the two of them put in: " + live.pot);

  // a table that DOES fill still closes itself — there is nothing left to
  // decide once every chair is taken
  const p5: Player[] = [];
  for (let i = 0; i < SEAT_MAX; i++) p5.push(await member("pkf", 50));
  const full = await post("/duel/create", { token: p5[0].token, game: "poker", bet: BUY_IN });
  const fid = full.duel.id;
  for (let i = 1; i < SEAT_MAX; i++) {
    must((await post("/duel/join", { token: p5[i].token, id: fid })).ok, "could not sit at the full table");
  }
  const shut = (await call("/duel/state?token=" + p5[0].token + "&id=" + fid)).duel;
  must(shut.state === "confirm", "a full table still closes itself: " + shut.state);
  must(shut.canStart === false, "…with nothing left for the host to decide");
  for (const p of p5) await post("/duel/confirm", { token: p.token, id: fid });
  const five = (await call("/duel/state?token=" + p5[0].token + "&id=" + fid)).duel;
  must(five.poker.seats.length === SEAT_MAX, "five-handed: " + five.poker.seats.length);

  // and the tables that DO name a number still name it, and still wait
  const c = await member("pkc", 50);
  const cut = await post("/duel/create", { token: c.token, game: "cut", bet: BUY_IN, seats: 3 });
  must(cut.duel.seats === 3, "a cut still seats what it was asked for: " + cut.duel.seats);
  must(cut.duel.hostStarts === false, "…and still waits to fill");
  must(!(await post("/duel/start", { token: c.token, id: cut.duel.id })).ok,
    "…and cannot be dealt short of it");
  await post("/duel/cancel", { token: c.token, id: cut.duel.id });

  console.log(
    "  the lobby: the table opens with all " + SEAT_MAX + " chairs whatever was asked for, anybody " +
      "sits, only the host deals and not with fewer than two; dealing settles the roster and " +
      "still goes through the handshake; a table that fills closes itself; and the cut still " +
      "names its number and waits for it",
  );
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
  "poker: the rankings are right (wheel low, no wrap-round ace, kickers read, and the hole card " +
    "plays — K-J beats 10-J on an ace-high board), a deck is 52 distinct cards, split pots add " +
    "back to the chip, a bet nobody called is pushed back rather than paid out as a win (so a pot " +
    "taken outright is never announced as a split, while a board that plays still chops and a " +
    "folded player's chips are still won), the blinds reach 250/500 eighteen minutes in and keep " +
    "climbing — and across 2-, 3-, 4- and 5-handed tournaments the chips on the table always add " +
    "up to the stacks dealt, no hole card is ever visible to anyone else mid-hand, and the sahurs " +
    "that went in are the sahurs that came out",
);
