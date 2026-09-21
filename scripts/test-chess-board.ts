#!/usr/bin/env -S deno run --allow-read
// The chess board is drawn once and repainted, not rebuilt.
//
// A move used to be a whole new screen. The duel poll saw a different FEN, the
// shape gate in pitRender() failed, and the entire casino view came down and
// went back up — back button, header, names, pot, clock, board and panel —
// along with thirty-two fresh <img> elements each of which had to come back out
// of cache and decode before its square stopped being empty. From the other
// seat that is the board flashing every time your opponent moves, because that
// is exactly what it is.
//
// Three things hold it still.
//
// A position-only change must not re-mount. The frame the screen is made of and
// the position standing on it are fingerprinted apart, and a difference in the
// second one alone goes to chessPaint() rather than to mount().
//
// chessPaint() must leave alone what has not changed, and must carry the piece
// that moved across as the element it already was rather than making a new one.
//
// And the handlers, now that they outlive the position they were bound under,
// must read the live one instead of closing over the arguments they were built
// with. A board that stopped being rebuilt while its handlers still held last
// move's legal list would offer moves that are no longer there — which is a
// worse bug than the flash.
//
// Plus the cursor, which is what the board says it can do: an 8x8 grid of
// pointers claims every square is worth clicking when most of them do nothing.
//
//   deno run --allow-read scripts/test-chess-board.ts

import { readShrineFile } from "./shrine-sources.ts";

function must(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}
const casino = await readShrineFile("assets/js/shrine/casino.js");
const styles = await readShrineFile("assets/js/shrine/styles.js");
// The stylesheet is written as a run of string literals, so one rule is quite
// often split across two of them. Join adjacent literals back up before looking
// for a rule, or every check here is really a check on where the line wrapped.
const css = styles.replace(/'\s*\+\s*'/g, "");

// ---------------------------------------------------------------------------
// the two fingerprints, and the road between them
must(/var chShape=ch\?\[ch\.fen,/.test(casino), "the position still needs a fingerprint of its own");
must(/var frame=\[d\.state,/.test(casino),
  "the rest of the screen needs one apart from it, or there is nothing to compare");
must(/var shape=frame\+"\|"\+chShape;/.test(casino), "and the whole is the two of them together");
// the fast path: same screen, different position -> repaint, never mount
const fastFrom = casino.indexOf("var shape=frame+");
must(fastFrom > 0, "could not find the shape gate");
// to the mount() that a rebuild goes through, which is what the fast path is
// there to get past. (Searched FROM the gate: there is an earlier PIT.tick.)
const fast = casino.slice(fastFrom, casino.indexOf("var v=mount(", fastFrom));
must(/frame===PIT\.frame/.test(fast), "a position-only change is the one that may skip the rebuild");
must(/PIT\.chUI\.board\.isConnected/.test(fast),
  "…and only while the board it would repaint is still on the screen");
must(/chessPaint\(d,PIT\.chUI\.note\);\s*\n\s*return;/.test(fast),
  "the fast path must repaint and stop, not fall through into mount()");
// PIT.shape="" is how the rest of the file asks for a real rebuild (a piece set
// changing under it, a refused move). An empty one must never take the shortcut.
must(/PIT\.shape&&frame===PIT\.frame/.test(fast),
  'an emptied PIT.shape must force a real rebuild — that is what PIT.shape="" is for');

// ---------------------------------------------------------------------------
// the repaint itself
const paint = casino.slice(casino.indexOf("function chessPaint("), casino.indexOf("function chessHand("));
must(paint.length > 500, "could not find chessPaint()");
// what is on a square is written ON the square, because that is what the diff
// reads — and chessGuess moves pieces about behind the repaint's back
must(/sq\.getAttribute\("data-pc"\)/.test(paint), "the repaint must read what each square already holds");
must(/if\(have===wantPc\)continue;/.test(paint), "…and leave a square that has not changed completely alone");
// the pool: pieces come off before any go down, so the one that moved is the
// one that is put back down
const pool = paint.indexOf("var pool={}");
const fill = paint.indexOf("for(n=0;n<fill.length;n++)");
must(pool > 0 && fill > pool, "pieces must be gathered up before any are put down");
must(/pool\[pc\]\.pop\(\):pcEl\(pc\)/.test(paint),
  "a square must take a piece back out of the pool before it makes a new one");
// the coordinates down the edges belong to the square, so a repaint must not
// touch them — they used to go with the rebuild and come back with it
const build = casino.slice(casino.indexOf("function chessBoard("), casino.indexOf("function chessPaint("));
must(/el\("span","chrk"/.test(build) && /el\("span","chfl"/.test(build),
  "the printed rank and file are put down when the board is built");
must(!/chrk|chfl/.test(paint), "…and a repaint must never touch them again");
// the clocks paint off a view object that has to be replaced too, or they run
// on the position that was there when the board was built
must(/PIT\.chClocks\.view=c;/.test(paint), "the clocks must be pointed at the new position");

// ---------------------------------------------------------------------------
// the handlers outlive the position, so they must not hold one
const hand = casino.slice(casino.indexOf("function chessHand("), casino.indexOf("function chessGuess("));
must(/function chessHand\(boardEl,ui\)\{/.test(hand),
  "chessHand must take the live record rather than a copy of one position");
must(!/\bcells\[/.test(hand.replace(/ui\.cells/g, "")) || /var cells=ui\.cells/.test(hand),
  "nothing in the handlers may read a captured board");
for (const [bit, what] of [
  ["ui.legal", "the legal list"],
  ["ui.cells", "the position"],
  ["ui.d", "the duel"],
  ["ui.note", "where to put a refusal"],
] as const) {
  must(hand.includes(bit), "the handlers must read " + what + " live (" + bit + ")");
}
must(/var live=function\(\)\{return !!\(ui\.c&&ui\.c\.yourTurn&&!ui\.c\.result\);\};/.test(hand),
  "whether there is anything to pick up has to be asked on the press, not once at bind time");
must(/if\(!live\(\)\)return;/.test(hand), "…and asked before a press does anything");

// chessGuess moves pieces without going through the repaint, so it has to keep
// the squares' own record of what they hold in step or the next repaint diffs
// against a board that no longer exists
const guess = casino.slice(casino.indexOf("function chessGuess("), casino.indexOf("function chessMove("));
must(/var mark=function\(sq,pcName\)\{sq\.setAttribute\("data-pc",pcName\|\|""\);\};/.test(guess),
  "chessGuess must be able to say what a square now holds");
must(/mark\(f,""\);/.test(guess), "…and must empty the square the piece came off");
must(/put\(t,promo\?pcEl\(landed\):pc,landed\);/.test(guess), "…and name what landed on the one it went to");

// ---------------------------------------------------------------------------
// the cursor only offers what pressing would actually do
must(/\.chsq\{[^{}]*cursor:default\}/.test(css),
  "a square is not clickable by default — most of the board does nothing");
must(/\.chsq\.pick\{cursor:grab\}/.test(css), "a piece with a move to make offers to be picked up");
must(/\.chsq\.go,\.chsq\.take\{cursor:pointer\}/.test(css),
  "somewhere the piece in hand can land is clickable");
must(/\.chboard\.held,\.chboard\.held \.chsq\{cursor:grabbing\}/.test(css),
  "a piece being carried closes the hand");
// .pick comes off the server's legal list, which is only ever sent to whoever
// is to move — so it can never appear on their turn or on their pieces
must(/grabs\[legal\[i\]\.slice\(0,2\)\]=1;/.test(paint),
  "the grab cursor must come off the server's legal list and nothing else");
must(/if\(grabs\[nm\]\)cls\+=" pick";/.test(paint), "…and be painted from it");
must(/boardEl\.classList\.add\("held"\)/.test(hand) && /boardEl\.classList\.remove\("held"\)/.test(hand),
  "the carried-piece cursor must go on when one is picked up and off when it is put down");

// the skins re-declare everything on this board that `button` would otherwise
// win; a cursor is not one of those, but a skin must not quietly reintroduce one
must(!/& \.chsq\{[^{}]*cursor/.test(css), "no skin may put a cursor back on every square");

console.log(
  "chess board: the screen and the position are fingerprinted apart, so a move repaints the " +
    "board that is already there instead of taking the whole casino view down and building it " +
    "again; the repaint leaves untouched squares alone, carries the piece that moved across as " +
    "the element it already was, never redraws the printed coordinates, and re-points the clocks; " +
    "the handlers read the live position rather than the one they were bound under, and " +
    "chessGuess keeps each square's record of what it holds in step behind them. The cursor " +
    "offers a grab only where the server listed a move, a pointer only where the piece in hand " +
    "can land, a closed hand while one is carried, and an arrow everywhere else",
);
