#!/usr/bin/env -S deno run --allow-read
// Walk the real deal queue the way playQueue does: one event per 400ms beat.
// Chrome is not involved — this is the same apply/render contract the table uses.

import { readShrineFile } from "./shrine-sources.ts";

const src = await readShrineFile("assets/js/shrine/casino.js");

function fail(msg: string): never {
  throw new Error(msg);
}

function extractFunction(name: string): string {
  const start = src.indexOf(`function ${name}(`);
  if (start < 0) fail("missing " + name);
  const brace = src.indexOf("{", start);
  let depth = 0;
  for (let i = brace; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  fail("unclosed " + name);
}

const fns = [
  "bjCardValue",
  "bjTotal",
  "bjCopyShown",
  "bjApplyShown",
  "bjDealerView",
  "bjSameCards",
  "bjSyncSplits",
  "bjIsOpening",
  "bjPrepareShown",
  "bjDealQueue",
].map(extractFunction).join("\n");

const api = new Function(
  fns +
    "; return {bjDealQueue:bjDealQueue,bjApplyShown:bjApplyShown,bjPrepareShown:bjPrepareShown,bjTotal:bjTotal};",
)() as {
  bjDealQueue: (shown: Shown, d: Server) => Event[];
  bjApplyShown: (shown: Shown, ev: Event) => void;
  bjPrepareShown: (shown: Shown, d: Server) => Shown;
  bjTotal: (cards: string[]) => number;
};

type Shown = { dealer: string[]; hands: string[][] };
type Event = { t: string; h?: number; at?: number; c: string };
type Server = {
  state: string;
  dealer: string[];
  hands: { cards: string[]; bet?: number; payout?: number; result?: string }[];
  payout?: number;
  bet?: number;
  balance?: number;
  result?: string;
};

function empty(): Shown {
  return { dealer: [], hands: [[]] };
}

function countCards(shown: Shown): number {
  return shown.dealer.length + shown.hands.reduce((n, h) => n + h.length, 0);
}

function play(shown: Shown, d: Server) {
  const q = api.bjDealQueue(shown, d);
  const start = api.bjPrepareShown(shown, d);
  const frames: { t: number; cards: number; holes: number; balHeld: boolean; dealer: string[]; player: string[] }[] = [];
  const cur = { dealer: start.dealer.slice(), hands: start.hands.map((h) => h.slice()) };
  q.forEach((ev, i) => {
    api.bjApplyShown(cur, ev);
    frames.push({
      t: i * 400,
      cards: countCards(cur),
      holes: cur.dealer.filter((c) => c === "??").length,
      balHeld: d.state === "done",
      dealer: cur.dealer.slice(),
      player: (cur.hands[0] || []).slice(),
    });
  });
  return { q, frames, settleAt: q.length * 400 };
}

{
  const d: Server = {
    state: "done",
    dealer: ["K♠", "A♥"],
    hands: [{ cards: ["A♣", "10♦"], bet: 1, payout: 2.5, result: "blackjack" }],
    payout: 2.5,
    bet: 1,
    balance: 101.5,
    result: "blackjack",
  };
  const { frames, settleAt } = play(empty(), d);
  if (frames.length !== 5) fail("natural is 4 cards then a hole flip, got " + frames.length);
  if (frames[0].t !== 0 || frames[0].cards !== 1 || frames[0].player[0] !== "A♣") {
    fail("t=0 must be the first player card only: " + JSON.stringify(frames[0]));
  }
  if (frames[1].t !== 400 || frames[1].holes !== 0 || frames[1].dealer[0] !== "K♠") {
    fail("t=400 must be the dealer upcard: " + JSON.stringify(frames[1]));
  }
  if (frames[2].t !== 800 || frames[2].player.length !== 2) {
    fail("t=800 must add the second player card: " + JSON.stringify(frames[2]));
  }
  if (frames[3].t !== 1200 || frames[3].dealer[1] !== "??" || frames[3].holes !== 1) {
    fail("t=1200 must be the hole, to the right of the upcard: " + JSON.stringify(frames[3]));
  }
  if (frames[4].t !== 1600 || frames[4].dealer[1] !== "A♥" || frames[4].dealer[0] !== "K♠" || frames[4].holes !== 0) {
    fail("t=1600 must flip the hole in place, not redeal the upcard: " + JSON.stringify(frames[4]));
  }
  if (settleAt !== 2000) fail("toast/balance wait until 400ms after the last card, got " + settleAt);
}

{
  const shown: Shown = { dealer: ["6♦", "??"], hands: [["10♥", "8♣"]] };
  const d: Server = {
    state: "done",
    dealer: ["6♦", "K♠", "5♥"],
    hands: [{ cards: ["10♥", "8♣"] }],
  };
  const { frames, settleAt } = play(shown, d);
  if (frames.map((f) => f.t).join(",") !== "0,400") {
    fail("dealer play is hole-flip then one draw, beats " + frames.map((f) => f.t).join(","));
  }
  if (frames[0].dealer[0] !== "6♦" || frames[0].dealer[1] !== "K♠") {
    fail("first dealer beat flips the hole on the right, got " + frames[0].dealer.join(","));
  }
  if (frames[1].dealer.join(",") !== "6♦,K♠,5♥") {
    fail("second dealer beat is the hit, got " + frames[1].dealer.join(","));
  }
  if (settleAt !== 800) fail("payout waits for the last dealer card plus one beat, got " + settleAt);
}

if (!src.includes("if(typeof d.balance===\"number\")setBal(d.balance);")) {
  fail("balance update must live in settle");
}
const settleAt = src.indexOf("function settle(d){");
const playingReturn = src.indexOf("if(d.state===\"playing\"){", settleAt);
const setBalAt = src.indexOf("setBal(d.balance)", settleAt);
const celebrateAt = src.indexOf("celebrate(d.payout", settleAt);
if (!(playingReturn < setBalAt && playingReturn < celebrateAt)) {
  fail("balance and toast must not fire while the player can still act");
}

console.log("blackjack deal live: ok");
