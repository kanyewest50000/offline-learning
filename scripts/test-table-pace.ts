#!/usr/bin/env -S deno run --allow-read
// The four tables that animate an outcome — dice, limbo, roulette, plinko —
// and the roulette felt they are laid on.
//
// Two things to hold still.
//
// The pace. Every one of them runs unhurried by default and every one of them
// carries the same lightning button, which is ONE remembered setting rather
// than a per-game toggle. What the button must never be is a way to change the
// odds: the server has already decided the outcome before a frame is drawn, so
// pace() may only ever appear where a DURATION is chosen. A pace() that leaked
// into a wager, a multiplier or a path would be a cheat button.
//
// The felt. The old board was a 12-wide grid with 36 orphaned on a row of its
// own and a strip of twelve identical pills underneath. The layout below is the
// real one, and the part that can silently go wrong is the column mapping: the
// server pays column v when spin % 3 === v % 3, so the row of threes at the top
// has to be labelled column 3. Get that backwards and the felt lies about what
// the player just bet on.
//
//   deno run --allow-read scripts/test-table-pace.ts

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
function must(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}
const casino = await Deno.readTextFile(`${ROOT}/assets/js/shrine/casino.js`);
const styles = await Deno.readTextFile(`${ROOT}/assets/js/shrine/styles.js`);
const server = await Deno.readTextFile(`${ROOT}/server.ts`);

// pull one view out of the client so an assertion is about that view
function view(name: string): string {
  const at = casino.indexOf("function view" + name + "(");
  must(at >= 0, "no view" + name + "() in casino.js");
  const rest = casino.slice(at + 1);
  const end = rest.search(/\n  function view|\n  \/\* ---------- /);
  return rest.slice(0, end < 0 ? rest.length : end);
}

// ===========================================================================
// one setting, remembered, and off by default
// ===========================================================================
must(/var TURBO=false;/.test(casino), "the tables must start unhurried");
must(/localStorage\.getItem\(TKEY_TURBO\)==="1"/.test(casino), "and remember the choice between visits");
must(/function pace\(slow,fast\)\{return TURBO\?fast:slow;\}/.test(casino),
  "pace() is the only place the setting is read");
must(/function boltBtn\(\)/.test(casino), "there must be a lightning button");
must(casino.split("TKEY_TURBO").length - 1 >= 3, "the setting is stored under one key, in one place");

// every paced table gets the button; the ones where the PLAYER is the slow part
// do not, because there is nothing there to hurry up
for (const [name, paced] of [
  ["Dice", true], ["Limbo", true], ["Roulette", true], ["Plinko", true],
  ["Mines", false], ["Beef", false], ["Blackjack", false],
] as const) {
  const body = view(name);
  // the icon argument can itself be a call, so match to the end of the statement
  const has = /mount\("[^"]+",[^;]*,\s*true\)/.test(body.slice(0, 400));
  must(has === paced, name + (paced ? " must carry the lightning button" : " must not carry one"));
}

// ===========================================================================
// the button changes durations and NOTHING else
// ===========================================================================
// every real call in the file — one that passes the two numbers, as opposed to
// the prose above it that names pace() with empty parens
const paceLines = casino.split("\n").filter((l) => /pace\(\s*\d/.test(l));
const paceCalls = (casino.match(/pace\(\s*\d/g) || []).length;
must(paceCalls >= 6, "expected pace() in all four tables, found " + paceCalls);
for (const line of paceLines) {
  must(
    /dur=pace\(|spinMs=pace\(|turns=pace\(|bturns=pace\(|return pace\(/.test(line),
    "pace() may only choose a duration or a number of turns, never anything a wager depends on: " +
      line.trim().slice(0, 90),
  );
}
// and it is nowhere near the money
for (const [label, body] of [
  ["dice", view("Dice")], ["limbo", view("Limbo")],
  ["roulette", view("Roulette")], ["plinko", view("Plinko")],
] as const) {
  const wager = body.split("\n").filter((l) => /jpost\(|wager\(|roundBet\(/.test(l));
  for (const line of wager) {
    must(!line.includes("pace("), label + " must not let the speed setting touch a wager: " + line.trim().slice(0, 80));
  }
}

// each table is slower than it was, and turbo is faster than it was
const paces: [string, RegExp, number, number][] = [
  ["dice", /dur=pace\((\d+),(\d+)\)/, 520, 520],
  ["limbo", /var target=d\.crash,t0=Date\.now\(\),dur=pace\((\d+),(\d+)\)/, 750, 750],
  ["roulette", /spinMs=pace\((\d+),(\d+)\)/, 4150, 4150],
  ["plinko", /return pace\((\d+),(\d+)\);/, 115, 115],
];
for (const [name, re, wasSlow, wasFast] of paces) {
  const m = casino.match(re);
  must(!!m, name + " must choose its duration through pace()");
  const slow = Number(m![1]), fast = Number(m![2]);
  must(slow > wasSlow, name + " must be slower than the " + wasSlow + " it used to be, got " + slow);
  must(fast < wasFast, name + " on turbo must beat the old " + wasFast + ", got " + fast);
  must(slow > fast * 2, name + ": the button has to be worth pressing — " + slow + " vs " + fast);
}

// the wheel spins on properties the client sets, not a duration frozen in the
// stylesheet, or the button could not reach it
must(/--spin,7s/.test(styles) && /--ballspin,6\.5s/.test(styles),
  "the wheel and ball must read their duration from a custom property");
must(/svg\.style\.setProperty\("--spin"/.test(casino) && /svg\.style\.setProperty\("--ballspin"/.test(casino),
  "and the spin must set them from pace()");
must(/},spinMs\+150\);/.test(casino), "the settle must be timed off the same number, not a constant");

// ===========================================================================
// the felt: the real layout, and a column mapping that matches what pays
// ===========================================================================
const roul = view("Roulette");
must(/\.rtable\{display:grid;grid-template-columns:1\.15fr repeat\(12,1fr\) 1\.3fr/.test(styles),
  "the felt is zero, twelve number columns, and the 2:1 boxes");
must(/\.rzero\{grid-area:1\/1\/4\/2/.test(styles), "zero spans all three number rows, as it does on a table");
must(!/\.rboard\{|\.routside\{|\.rout\{/.test(styles), "the old board and pill strip must be gone");
must(!/"rboard"|"routside"|"rout"/.test(casino), "and nothing may still build them");

// THE mapping. /cas/roulette pays column v on spin % 3 === v % 3, so the row
// that starts at 3 is column 3. The client lays the rows out as [first, column]
// pairs; every pair has to satisfy the server's own rule.
must(/column"\) \{ [\s\S]{0,80}?won = !zero && spin % 3 === \(val % 3\)/.test(server),
  "the server's column rule moved — re-check the felt against it");
const rows = roul.match(/\[\[3,3\],\[2,2\],\[1,1\]\]/);
must(!!rows, "the felt must lay its three rows out as first-number/column pairs");
for (const [first, col] of [[3, 3], [2, 2], [1, 1]]) {
  must(first % 3 === col % 3,
    "row starting at " + first + " is labelled column " + col + ", but the server pays that row to column " +
      (first % 3 === 0 ? 3 : first % 3));
}
// the dozens cover 1-12, 13-24, 25-36 in order, and sit under their own numbers
must(/\[\["1st 12",1\],\["2nd 12",2\],\["3rd 12",3\]\]/.test(roul), "the dozens must be in order");
must(/c\.style\.gridColumn=\(2\+i\*4\)\+" \/ span 4"/.test(roul), "each dozen must span exactly its twelve numbers");
must(/c\.style\.gridColumn=\(2\+i\*2\)\+" \/ span 2"/.test(roul), "the even-money bets are two columns apiece");
// every chip says what it pays, and red and black look like red and black
for (const pay of ["35:1", "2:1", "1:1"]) {
  must(roul.includes('"' + pay + '"'), "the felt must print the " + pay + " payout on its chips");
}
must(/\["red","Red","red"\]/.test(roul) && /\["black","Black","black"\]/.test(roul),
  "red and black must carry a colour swatch, not just a word");
must(/\.rdiam\.red\{background:/.test(styles) && /\.rdiam\.black\{background:/.test(styles),
  "and the swatch must actually be painted");
// exactly one bet at a time, and it is spelled out in words
must(/pickPay\.textContent="pays "/.test(roul), "the chosen bet must be named with its payout");
must(/SEL\.kind!=="number"&&b\._k===SEL\.kind/.test(roul),
  "an outside chip may only light up when an outside bet of the same kind is chosen");

console.log(
  "tables: all four animate slowly by default behind one remembered lightning button " +
    "that can only ever change a duration; the roulette felt is the real layout, " +
    "its column boxes agree with what the server pays, and every chip states its odds",
);
