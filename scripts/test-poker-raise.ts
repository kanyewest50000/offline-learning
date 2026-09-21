#!/usr/bin/env -S deno run --allow-read
// Confirming a raise must not be a scroll hunt.
//
// The raise panel is five things stacked — the amount, the minimum, the
// shortcuts, the slider, and the two buttons — which on a phone is the only
// layout there is, and comes to about 230px: four times the height of the
// action bar it replaces. Under a poker table that already fills a laptop
// window, pressing RAISE therefore pushed BET off the bottom of the screen, and
// the one button the panel exists for had to be gone looking for with a clock
// running.
//
// A desktop window has width going spare. So above the poker breakpoint the
// panel is a grid instead: amount and minimum down the left, shortcuts and
// slider in the middle, BACK and BET full-height down the right. Two rows
// rather than five, and near enough the height of the bar it replaces.
//
// The trap this file exists for: @media adds no specificity. The desktop block
// that was already in this stylesheet sits ABOVE the base rules it means to
// override, so every one of its declarations loses to the base rule written
// below it and the layout silently stays as it was. A rule that is overridden
// still looks completely correct in the source.
//
//   deno run --allow-read scripts/test-poker-raise.ts

import { readShrineFile } from "./shrine-sources.ts";

function must(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}
const styles = await readShrineFile("assets/js/shrine/styles.js");
const casino = await readShrineFile("assets/js/shrine/casino.js");
// adjacent string literals are one rule; join them before reading any of it
const css = styles.replace(/'\s*\+\s*'/g, "");

// ---------------------------------------------------------------------------
// the desktop layout exists
const at = css.indexOf(".pkbet{display:grid");
must(at > 0, "the raise panel needs a layout that goes across on a desktop width");
const grid = css.slice(at, css.indexOf("}", css.indexOf("grid-template-areas", at)) + 1);
must(/grid-template-areas:"val pre go" "min sld go"/.test(grid),
  "two rows, with the buttons down the side of both: " + grid.slice(0, 160));
for (const [sel, area] of [
  [".pkbetval", "val"], [".pkminrow", "min"], [".pkpre-row", "pre"], [".pkslidrow", "sld"],
  [".pkbetgo", "go"],
] as const) {
  must(new RegExp(sel.replace(".", "\\.") + "\\{[^{}]*grid-area:" + area).test(css),
    sel + " has to be placed in the grid, or it lands wherever it likes");
}
must(/\.pkbetgo\{[^{}]*align-self:stretch/.test(css),
  "BACK and BET take the height of the block — an easier thing to hit than a strip");

// ---------------------------------------------------------------------------
// and it WINS, which is the half that is easy to get wrong
//
// Every base rule the grid overrides has to be written above it. A media query
// carries no extra weight, so a `.pkbet{display:flex}` further down the file
// beats a `@media{.pkbet{display:grid}}` further up and nothing changes.
const stack = css.indexOf(".pkbet{display:flex");
must(stack > 0, "the stacked layout is still the base, for a screen with no width to spare");
must(stack < at, "…and the grid has to be written after it, or the stack wins and nothing changes");
must(css.indexOf(".pkbet{display:flex", at) < 0, "nothing may put the stack back after the grid");
// the same for every rule the grid reaches into: the base has to be above it
for (
  const decl of [
    ".pkbetval{display:flex", ".pkminrow{display:flex", ".pkpre-row{display:flex",
    ".pkslidrow{display:flex", ".pkbetgo{display:flex", ".pkstep{flex:0 0 auto", ".pkslide{flex:1",
  ]
) {
  const i = css.indexOf(decl);
  must(i > 0, "could not find the base rule: " + decl);
  must(i < at, decl + " is a base rule the desktop grid overrides; it has to come before it");
}
// the block is behind the same breakpoint the rest of the table uses
const media = css.lastIndexOf("@media (min-width:700px)", at);
must(media > 0 && media < at, "the grid belongs behind the poker breakpoint, not at every width");
must(css.indexOf("}", at) < css.length, "…and the block has to close");

// ---------------------------------------------------------------------------
// the panel also makes sure the button is actually on screen
//
// Belt and braces, because the table above the panel can be taller than a short
// window whatever the panel does. Only on the press that opened it: a repaint
// while a number is being chosen must not yank the page about.
must(/PIT\.pkShow=true;/.test(casino), "opening the panel has to say it was opened");
must(/if\(PIT\.pkShow\)\{\s*\n\s*PIT\.pkShow=false;/.test(casino),
  "…and the panel has to spend that, so a repaint does not scroll again");
must(/go\.scrollIntoView\(\{block:"nearest"\}\)/.test(casino),
  'the confirm button must be brought into view, and "nearest" so a window where it already fits does not move');
must(/PIT\.pkRaise=false;PIT\.pkShow=false;\}/.test(casino),
  "and the flag comes down with the panel when it is no longer your turn");

console.log(
  "poker raise: above the poker breakpoint the panel lays out across the screen instead of down " +
    "it — amount and minimum left, shortcuts and slider middle, BACK and BET full-height right — " +
    "so it is two rows rather than five and pressing RAISE no longer pushes BET off the bottom " +
    "of the window; every base rule it overrides is written above it, so the block actually wins " +
    "rather than only looking right; and the press that opens the panel brings the confirm button " +
    "into view, once, without moving a window where it already fits",
);
