#!/usr/bin/env -S deno run --allow-read
// Where "back" goes during a round of Competitive Gambling.
//
// A round is the one thing in the casino that is not a screen. For its three
// minutes the player is not sat at the pit's table, they are out on the floor
// spending wood — they leave the table's own page, pick a house game off it,
// and the round follows them onto it.
//
// Which means that while one is running, the table's page IS the lobby. It
// carries the whole floor menu, both stacks and the table talk. Walking out of
// a game therefore has to land back on it, and it did not: every view in the
// casino is mounted by one function that hardwired "← back to lobby" to the
// casino floor, so leaving a game mid-round put the player one level further
// out than they had come from, with the round reduced to a bar along the top
// and the way back to it a different button in a different place.
//
// Three things to hold.
//
// The button follows the round rather than the page: one rule, in one place,
// so a game added later cannot quietly get the old behaviour.
//
// The round's OWN page is the exception, and stays one — standing on it, the
// way out really is the casino floor. It says so, too: a page that is the
// round cannot offer to take you to the round.
//
// And it is not a label written once at mount. A round starting or ending
// under an open game has to move the button, or it keeps offering a way back
// to a table that is over.
//
//   deno run --allow-read scripts/test-round-back.ts

import { readShrineFile } from "./shrine-sources.ts";

function must(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}
const casino = await readShrineFile("assets/js/shrine/casino.js");

// ---------------------------------------------------------------------------
// one rule, in one place
must(/function paintBack\(btn,out\)\{/.test(casino),
  "where back goes has to be decided in one place, not written out per view");
must(/function roundTable\(\)\{/.test(casino),
  "and there has to be one way back to the round's page");
// mount() is every view in the casino. It must ask rather than assume.
const mount = casino.slice(casino.indexOf("function mount(title,icon,paced)"), casino.indexOf("function betField("));
must(mount.length > 100, "could not find mount()");
must(/paintBack\(back,null\);/.test(mount),
  "mount() must ask where back goes rather than hardwiring the casino floor");
must(!/back\.onclick=function\(\)\{window\.__casinoOpen\(\);\};/.test(mount),
  "…and must not still be hardwiring it");

// what the rule actually is
const rule = casino.slice(casino.indexOf("function paintBack(btn,out)"), casino.indexOf("function refreshBack("));
must(/if\(ROUND\.live\)\{/.test(rule), "a live round is what changes it");
must(/back to the round/.test(rule), "…and the button has to say where it is going");
must(/if\(!roundTable\(\)\)window\.__casinoOpen\(\);/.test(rule),
  "a round can end between the paint and the press, so the press has to cope");
must(/btn\._out=out\|\|null;/.test(rule),
  "a button given a destination of its own has to be remembered as such");

// the one journey, used by the bar as well, so the two cannot drift apart
const barAt = casino.indexOf('var go=el("button","cbtn sec","the table")');
must(barAt > 0, "the round bar still has a button onto the table");
// searched FROM the button: there is an earlier e.appendChild(go) in the file
const bar = casino.slice(barAt, casino.indexOf("e.appendChild(go);", barAt));
must(/go\.onclick=function\(\)\{roundTable\(\);\};/.test(bar),
  "the round bar's own button must be the same journey, not a second copy of it");

// ---------------------------------------------------------------------------
// the round's own page is the exception, and stays one
const pit = casino.slice(casino.indexOf('var back=v.parentNode.querySelector(".casback");'));
must(/paintBack\(back,\(d\.game==="comp"&&d\.state==="live"\)/.test(pit),
  "the pit's pages must hand their own destination to the same rule");
must(/\?function\(\)\{clearTimer\(\);window\.__casinoOpen\(\);\}/.test(pit),
  "…and from the round's page the way out is still the floor");
must(/:function\(\)\{pitStop\(\);viewPit\(d\.game\);\}\);/.test(pit),
  "…while every other pit page still goes to its own list of tables");

// ---------------------------------------------------------------------------
// and the label is kept in step as the round comes and goes
must(/function refreshBack\(\)\{/.test(casino), "a round starting or ending has to move the button");
const refresh = casino.slice(casino.indexOf("function refreshBack()"), casino.indexOf("function mount("));
must(/if\(b&&!b\._out\)paintBack\(b,null\);/.test(refresh),
  "…but only the buttons that were not given a destination of their own");
must(/function paintRound\(\)\{\s*\n?\s*refreshBack\(\);/.test(casino),
  "the round's own paint is what notices a round starting");
const stop = casino.slice(casino.indexOf("function roundStop()"), casino.indexOf("function buildRound("));
must(/refreshBack\(\);/.test(stop), "and a round ending has to take the offer back off it");

console.log(
  "round back: while a round is running the way out of a house game is the round's own page — " +
    "which is the lobby for those three minutes, floor menu and all — decided by one rule that " +
    "every view in the casino goes through rather than per-view; the round's own page keeps the " +
    "casino floor as its way out and says so; the round bar's button is the same journey rather " +
    "than a second copy of it; and a round starting or ending under an open game moves the button " +
    "under it, without touching the pages that were given a destination of their own",
);
