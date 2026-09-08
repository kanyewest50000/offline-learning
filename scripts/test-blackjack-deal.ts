#!/usr/bin/env -S deno run --allow-read
// Opening deal order, dealer draws, and the 0.4s gap live in the shrine's
// casino client (assets/js/shrine/casino.js). Pull those helpers out and check
// them the same way a stand reply would feed the table.

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
    const ch = src[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  fail("unclosed " + name);
}

if (!src.includes("var BJ_DEAL_MS=400;")) {
  fail("opening deal gap must be 400ms");
}
if (!src.includes("t0+n*BJ_DEAL_MS") || !src.includes("window.setTimeout(tick,wait)")) {
  fail("cards must be dealt through a 400ms timeout, not all at once");
}
if (!src.includes('if(up)q.push({t:"D",c:up});') || !src.includes('q.push({t:"D",c:"??"});')) {
  fail("opening deal must put the upcard down before the hole");
}
if (src.indexOf('if(up)q.push({t:"D",c:up});') > src.indexOf('q.push({t:"D",c:"??"});')) {
  fail("the hole must be queued after the upcard so it sits on the right");
}

const settleAt = src.indexOf("function settle(d){");
const celebrateAt = src.indexOf("if(d.payout>d.bet)celebrate(", settleAt);
const playingReturn = src.indexOf('if(d.state==="playing"){', settleAt);
if (settleAt < 0 || celebrateAt < 0 || playingReturn < 0) {
  fail("settle / celebrate wiring missing");
}
if (!(playingReturn < celebrateAt)) {
  fail("win toast must not fire while the hand is still playing");
}
const setBalAt = src.indexOf("setBal(d.balance)", settleAt);
if (setBalAt < 0 || setBalAt > celebrateAt) {
  fail("balance update belongs in settle after the deal, next to the toast");
}
if (!(playingReturn < setBalAt)) {
  fail("balance must stay put until the dealer is finished");
}
if (!src.includes("wrap.replaceChild(e,wrap.children[i])")) {
  fail("paintCards must replace one slot so a hole flip cannot redeal the upcard");
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

const fn = new Function(
  fns +
    `; return {bjDealQueue:bjDealQueue,bjDealerView:bjDealerView,bjPrepareShown:bjPrepareShown,bjApplyShown:bjApplyShown,bjTotal:bjTotal};`,
) as () => {
  bjDealQueue: (shown: Shown, d: Server) => Event[];
  bjDealerView: (d: Server) => string[];
  bjPrepareShown: (shown: Shown, d: Server) => Shown;
  bjApplyShown: (shown: Shown, ev: Event) => void;
  bjTotal: (cards: string[]) => number;
};

const { bjDealQueue, bjDealerView, bjPrepareShown, bjApplyShown, bjTotal } = fn();

type Shown = { dealer: string[]; hands: string[][] };
type Event = { t: string; h?: number; at?: number; c: string };
type Server = {
  state: string;
  dealer: string[];
  hands: { cards: string[] }[];
};

function empty(): Shown {
  return { dealer: [], hands: [[]] };
}

function codes(q: Event[]): string[] {
  return q.map((ev) => ev.t + ":" + ev.c + (typeof ev.at === "number" ? "@" + ev.at : ""));
}

{
  const d: Server = {
    state: "playing",
    dealer: ["A♠", "??"],
    hands: [{ cards: ["10♥", "9♣"] }],
  };
  const q = bjDealQueue(empty(), d);
  if (codes(q).join(",") !== "P:10♥,D:A♠,P:9♣,D:??") {
    fail("opening deal must be player, upcard, player, hole, got " + codes(q).join(","));
  }
  if (bjDealerView(d).join(",") !== "A♠,??") {
    fail("during play the hole sits right of the upcard");
  }
}

{
  const d: Server = {
    state: "done",
    dealer: ["K♠", "A♥"],
    hands: [{ cards: ["A♣", "10♦"] }],
  };
  const q = bjDealQueue(empty(), d);
  if (codes(q).join(",") !== "P:A♣,D:K♠,P:10♦,D:??,D:A♥@1") {
    fail("a natural must deal four cards then flip the hole, got " + codes(q).join(","));
  }
}

{
  const shown: Shown = { dealer: ["6♦", "??"], hands: [["10♥", "8♣"]] };
  const d: Server = {
    state: "done",
    dealer: ["6♦", "K♠", "5♥"],
    hands: [{ cards: ["10♥", "8♣"] }],
  };
  const q = bjDealQueue(shown, d);
  if (codes(q).join(",") !== "D:K♠@1,D:5♥") {
    fail("dealer play must flip the hole then draw, got " + codes(q).join(","));
  }
  if (q.some((ev) => ev.t === "D" && ev.c === "6♦")) {
    fail("stand must not queue the upcard again: " + codes(q).join(","));
  }
}

{
  const shown: Shown = { dealer: ["6♦", "??"], hands: [["10♥", "8♣"]] };
  const d: Server = {
    state: "playing",
    dealer: ["6♦", "??"],
    hands: [{ cards: ["10♥", "8♣", "3♠"] }],
  };
  const q = bjDealQueue(shown, d);
  if (codes(q).join(",") !== "P:3♠") {
    fail("a hit is one new player card, got " + codes(q).join(","));
  }
}

{
  const shown: Shown = { dealer: ["9♠", "??"], hands: [["8♥", "8♦"]] };
  const d: Server = {
    state: "playing",
    dealer: ["9♠", "??"],
    hands: [{ cards: ["8♥", "K♣"] }, { cards: ["8♦", "5♠"] }],
  };
  const prepared = bjPrepareShown(shown, d);
  if (prepared.hands.map((h) => h.join("")).join("|") !== "8♥|8♦") {
    fail("a split must move the pair before the new cards land, got " + JSON.stringify(prepared.hands));
  }
  const q = bjDealQueue(shown, d);
  if (codes(q).join(",") !== "P:K♣,P:5♠") {
    fail("a split then deals one card to each hand, got " + codes(q).join(","));
  }
}

{
  const shown = empty();
  const q = bjDealQueue(shown, {
    state: "playing",
    dealer: ["7♣", "??"],
    hands: [{ cards: ["2♥", "3♦"] }],
  });
  q.forEach((ev) => bjApplyShown(shown, ev));
  if (bjTotal(shown.dealer) !== 7) fail("hole card must not count until it is turned over");
  if (bjTotal(shown.hands[0]) !== 5) fail("player total during the deal is wrong");
}

console.log("blackjack deal queue: ok");
