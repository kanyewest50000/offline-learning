#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read
// Chess.
//
// Two halves, and the first one is the whole thing.
//
// THE RULES. A chess table can be played for sahurs, so a client that can
// invent a move is a client that can invent a win. Every move is checked
// against a generator that lives on the server and nowhere else — and the only
// test worth having for a move generator is perft: count every leaf of the move
// tree from a known position and compare against the published total. Castling
// through check, an en-passant capture that exposes a rank, a pinned knight, a
// promotion that gives mate — each one is a wrong number rather than a subtle
// misbehaviour nobody notices until it costs somebody a pot. Six positions,
// about sixteen million of them.
//
// THE TABLE. That the pit actually refuses what the rules refuse: a move out of
// turn, an illegal move, nonsense, a stranger's move, and a move after the game
// is over. Plus the thing chess has that no other pit table does — a game that
// can be played for nothing, which has to move exactly zero sahurs while a
// staked one still pays out.
//
//   ADMIN_KEY=devadminkey deno run --allow-net --allow-env --unstable-kv server.ts
//   ADMIN_KEY=devadminkey API=... deno run --allow-net --allow-env --allow-read scripts/test-chess.ts
//
// PERFT=deep walks the slow depths too (about half a minute rather than three
// seconds); the default stops where it still catches everything structural.

import { ROOT } from "./shrine-sources.ts";

const API = (Deno.env.get("API") || "http://127.0.0.1:8000").replace(/\/$/, "");
const ADMIN = Deno.env.get("ADMIN_KEY") || "devadminkey";
const DEEP = Deno.env.get("PERFT") === "deep";

function must(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

// ---------------------------------------------------------------------------
// lift the real engine out of server.ts, the same way the poker test does, so
// this cannot quietly pass against a copy that has drifted
const src = await Deno.readTextFile(`${ROOT}/server.ts`);
const from = src.indexOf("type ChessPos = {");
// down to the pit's other game, which takes in the clock block below the engine
// as well — flagging is a rule like any other and is unreachable over HTTP
// without sitting here for three minutes
const to = src.indexOf("// POKER — the pit's tournament.");
must(from > 0 && to > from, "could not find the chess engine in server.ts");
// the general helpers the clock block leans on, lifted the same way rather than
// rewritten here, so a change to any of them shows up as a missing match
const helpers = ["function rnd(", "function rndInt(", "function clip("].map((sig) => {
  const i = src.indexOf("\n" + sig);
  must(i > 0, "could not find " + sig + " in server.ts");
  const line = src.indexOf("\n", i + 1);
  // a one-liner closes on its own line; anything else runs to its closing brace
  if (src.slice(i + 1, line).trimEnd().endsWith("}")) return src.slice(i, line);
  const end = src.indexOf("\n}", i);
  must(end > i, sig + " does not close");
  return src.slice(i, end + 2);
}).join("\n");
const engine = `
${helpers}
${src.slice(from, to)}
export { chessApply, chessDeadline, chessEnd, chessFen, chessFromUci, chessKey, chessLeft, chessMatingMaterial, chessMoves, chessParse, chessSan, chessSeatToAct, chessStart, chessTc, chessUci, CHESS_START, CHESS_TC, CHESS_TC_DEFAULT };
`;
const mod = await import("data:application/typescript," + encodeURIComponent(engine));
const { chessApply, chessEnd, chessFen, chessKey, chessMoves, chessParse, chessSan, CHESS_START } = mod;

// ---------------------------------------------------------------------------
// perft
// deno-lint-ignore no-explicit-any
function perft(pos: any, depth: number): number {
  const ms = chessMoves(pos);
  if (depth === 1) return ms.length;
  let n = 0;
  for (const m of ms) n += perft(chessApply(pos, m), depth - 1);
  return n;
}

// position, and the node count at each depth — these are the standard values,
// and they are the reason this file exists
const PERFT: [string, string, number[]][] = [
  ["initial", CHESS_START, [20, 400, 8902, 197281, 4865609]],
  ["kiwipete", "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1", [48, 2039, 97862, 4085603]],
  ["endgame", "8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1", [14, 191, 2812, 43238, 674624]],
  ["promotion", "r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1", [6, 264, 9467, 422333]],
  ["position 5", "rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8", [44, 1486, 62379, 2103487]],
  ["position 6", "r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10", [46, 2079, 89890, 3894594]],
];
// the depths past this are minutes of work for the same answer; DEEP asks for
// them when it matters, the rest of the time three of them is plenty
const CAP = DEEP ? 9 : 3;

let nodes = 0;
for (const [name, fen, want] of PERFT) {
  const p0 = chessParse(fen);
  must(p0, "the engine could not read a standard FEN: " + name);
  must(chessFen(p0) === fen, `${name}: FEN must survive a round trip, got ${chessFen(p0)}`);
  for (let d = 1; d <= Math.min(want.length, CAP); d++) {
    const got = perft(p0, d);
    nodes += got;
    must(got === want[d - 1], `perft ${name} depth ${d}: got ${got}, expected ${want[d - 1]}`);
  }
}

// ---- the endings, which perft says nothing about --------------------------
{
  // fool's mate: mate is an ending with a winner
  let p = chessParse(CHESS_START);
  for (const uci of ["f2f3", "e7e5", "g2g4", "d8h4"]) {
    const m = chessMoves(p).find((x: { from: number; to: number }) =>
      mod.chessUci(x) === uci || mod.chessUci(x) === uci + "q"
    );
    must(m, "fool's mate: " + uci + " should be legal");
    p = chessApply(p, m);
  }
  const end = chessEnd(p, [chessKey(p)]);
  must(end.over && end.winner === "b" && end.reason === "checkmate",
    "fool's mate must be checkmate for black, got " + JSON.stringify(end));

  // stalemate: no moves and no check is a draw, not a loss
  const sp = chessParse("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1");
  const se = chessEnd(sp, [chessKey(sp)]);
  must(se.over && se.winner === null && se.reason === "stalemate",
    "that position is stalemate, got " + JSON.stringify(se));

  // two bare kings can never mate, so there is nothing left to play for
  const dp = chessParse("8/8/4k3/8/8/3K4/8/8 w - - 0 1");
  must(chessEnd(dp, [chessKey(dp)]).reason === "dead position", "bare kings is a dead position");
  // a king and one bishop each, on the same colour, is dead too
  const bp = chessParse("8/8/3bk3/8/8/3KB3/8/8 w - - 0 1");
  must(chessEnd(bp, [chessKey(bp)]).over, "king and bishop against king and bishop cannot mate");
  // but a rook can, so that game is still going
  const rp = chessParse("8/8/4k3/8/8/3K4/8/4R3 w - - 0 1");
  must(!chessEnd(rp, [chessKey(rp)]).over, "a rook on the board is still a game");

  // the fifty-move rule counts plies, and only a position it can reach
  const fp = chessParse("8/8/4k3/8/8/3K4/8/4R3 w - - 100 80");
  must(chessEnd(fp, [chessKey(fp)]).reason === "fifty-move rule", "a hundred plies is a draw");

  // the same position three times over is a draw whoever repeated it
  const tp = chessParse(CHESS_START);
  const key = chessKey(tp);
  must(chessEnd(tp, [key, key, key]).reason === "threefold repetition", "three of the same position draws");
  must(!chessEnd(tp, [key, key]).over, "…but two is only two");
}

// ---- notation --------------------------------------------------------------
{
  const p = chessParse("r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 4 4");
  const mate = chessMoves(p).find((m: { to: number }) => mod.chessUci(m) === "f3f7");
  must(mate, "Qxf7 should be available there");
  must(chessSan(p, mate) === "Qxf7#", "that move reads Qxf7#, got " + chessSan(p, mate));
  // castling has its own spelling, and it is not a king move to g1
  const cp = chessParse("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
  const oo = chessMoves(cp).find((m: { from: number; to: number }) => mod.chessUci(m) === "e1g1");
  must(oo && chessSan(cp, oo) === "O-O", "kingside castling reads O-O");
  const ooo = chessMoves(cp).find((m: { from: number; to: number }) => mod.chessUci(m) === "e1c1");
  must(ooo && chessSan(cp, ooo) === "O-O-O", "queenside castling reads O-O-O");
  // two knights that can both reach a square have to be told apart
  const dp = chessParse("8/8/8/3k4/8/8/2N1N3/4K3 w - - 0 1");
  const d4 = chessMoves(dp).find((m: { from: number; to: number }) => mod.chessUci(m) === "c2d4");
  must(d4 && chessSan(dp, d4) === "Ncd4", "an ambiguous knight move names its file, got " + chessSan(dp, d4));
}

// ---- the clocks ------------------------------------------------------------
//
// Each player has their own, it runs only while it is their move, and running
// it out ends the game. The half of that worth testing here is the half that
// takes minutes to reach over HTTP: what the clock is worth when it hits zero.
{
  const { chessDeadline, chessLeft, chessMatingMaterial, chessStart, chessTc, CHESS_TC, CHESS_TC_DEFAULT } = mod;

  // the six the lobby offers, and nothing else gets through
  must(Object.keys(CHESS_TC).length === 6, "six controls, got " + Object.keys(CHESS_TC).length);
  for (const id of ["3+0", "3+2", "5+0", "10+0", "15+0", "60+0"]) {
    must(chessTc(id) === id, id + " should be a control you can ask for");
  }
  for (const junk of ["", "1+0", "banana", null, undefined, 5, "99+99"]) {
    must(chessTc(junk) === CHESS_TC_DEFAULT, "a control nobody offers must fall back: " + String(junk));
  }

  // both sides start with the same time, and the increment comes off the table
  const blitz = chessStart("3+2");
  must(blitz.clock[0] === 180_000 && blitz.clock[1] === 180_000, "3|2 starts both sides at three minutes");
  must(blitz.inc === 2_000, "…with two seconds a move");
  must(chessStart("15+0").inc === 0, "15 min has no increment");
  must(chessStart("60+0").clock[0] === 3_600_000, "an hour is an hour");

  // only the player to move is spending anything
  const g = chessStart("5+0");
  const t0 = g.since;
  const toAct = mod.chessSeatToAct(g);
  must(toAct === g.white, "white is to move from the start");
  must(chessLeft(g, t0 + 30_000) === 270_000, "thirty seconds off five minutes");
  must(g.clock[1 - toAct] === 300_000, "the other clock has not moved — it was never running");
  must(chessLeft(g, t0 + 999_999) === 0, "a clock stops at zero rather than going negative");
  must(chessDeadline(g) === t0 + 300_000, "the table's deadline is when the running clock runs out");
  // a finished game is not still counting
  must(chessLeft({ ...g, result: "w" }, t0 + 30_000) === 0, "a game that is over has no clock");

  // and what flagging is worth, which is the rule nobody remembers
  const mates: [string, boolean, boolean][] = [
    ["8/8/8/4k3/8/8/8/4K3 w - - 0 1", true, false],            // bare kings
    ["8/8/8/4k3/8/8/8/4KB2 w - - 0 1", true, false],           // king and bishop
    ["8/8/8/4k3/8/8/8/4KN2 w - - 0 1", true, false],           // king and knight
    ["8/8/8/4k3/8/8/8/3NKN2 w - - 0 1", true, true],           // two knights: helpmate exists
    ["8/8/8/4k3/8/8/8/2B1KN2 w - - 0 1", true, true],          // bishop and knight
    ["8/8/8/4k3/8/8/8/4K2R w - - 0 1", true, true],            // a rook is plenty
    ["8/8/8/4k3/8/8/4P3/4K3 w - - 0 1", true, true],           // so is a pawn
    ["8/5bk1/8/8/8/8/8/4K3 w - - 0 1", false, false],          // black's lone bishop
  ];
  for (const [fen, white, want] of mates) {
    const p = chessParse(fen);
    must(p, "bad test fen " + fen);
    must(chessMatingMaterial(p, white) === want,
      `mating material for ${white ? "white" : "black"} in ${fen} should be ${want}`);
  }
}

// ===========================================================================
// the table
// ===========================================================================
async function j(path: string, opt?: RequestInit) {
  const r = await fetch(API + path, opt);
  return { status: r.status, body: await r.json().catch(() => ({})) as Record<string, unknown> };
}
const post = (path: string, obj: unknown) =>
  j(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(obj) });
const nap = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function member(tag: string) {
  const name = tag + Math.random().toString(36).slice(2, 7);
  let a = await post("/apply", { username: name, application: "chess test" });
  for (let i = 0; a.body?.error === "slow down" && i < 20; i++) {
    await nap(4000);
    a = await post("/apply", { username: name, application: "chess test" });
  }
  const token = a.body?.token as string;
  must(token, "apply failed for " + name + ": " + JSON.stringify(a.body));
  const pend = await j("/admin/pending?key=" + encodeURIComponent(ADMIN));
  const id = (pend.body.pending as { username: string; id: string }[] || [])
    .find((x) => x.username === name)?.id;
  must(id, name + " is not pending");
  await post("/admin/decide", { key: ADMIN, id, action: "approve" });
  return { name, token, id: id as string };
}
const balOf = async (token: string) =>
  (await j("/cas/me?token=" + encodeURIComponent(token))).body.balance as number;

// deno-lint-ignore no-explicit-any
async function table(a: any, b: any, bet: number, tc?: string) {
  const made = await post("/duel/create", { token: a.token, game: "chess", bet, ...(tc ? { tc } : {}) });
  must(made.body?.ok, `a chess table at ${bet} was refused: ` + JSON.stringify(made.body));
  const id = (made.body.duel as { id: string }).id;
  must((await post("/duel/join", { token: b.token, id })).body?.ok, "join failed");
  must((await post("/duel/confirm", { token: a.token, id })).body?.ok, "first confirm failed");
  const live = await post("/duel/confirm", { token: b.token, id });
  must(live.body?.ok, "second confirm failed");
  // deno-lint-ignore no-explicit-any
  const cs = (live.body.duel as any).chess;
  must(cs && cs.fen === CHESS_START, "the board must start set up, got " + JSON.stringify(cs?.fen));
  const tok: Record<string, string> = { [a.name]: a.token, [b.name]: b.token };
  return { id, cs, wTok: tok[cs.white], bTok: tok[cs.black], white: cs.white, black: cs.black };
}
const move = (token: string, id: string, m: string) => post("/duel/chess", { token, id, move: m });

const A = await member("csA"), B = await member("csB");

// --- a free table -----------------------------------------------------------
const before = { a: await balOf(A.token), b: await balOf(B.token) };
const t = await table(A, B, 0);

// the refusals, which are the whole point of the rules living server-side
must((await move(t.bTok, t.id, "e7e5")).body.error === "not your move", "black cannot move first");
must((await move(t.wTok, t.id, "e2e5")).body.error === "illegal move", "a pawn cannot move three squares");
must((await move(t.wTok, t.id, "d1h5")).body.error === "illegal move", "the queen cannot move through her own pawn");
must((await move(t.wTok, t.id, "e1g1")).body.error === "illegal move", "there is nothing to castle past yet");
must((await move(t.wTok, t.id, "notamove")).body.error === "that is not a move", "nonsense is not a move");
const C = await member("csC");
must((await move(C.token, t.id, "e2e4")).body.error === "not your table", "a stranger cannot play your game");

// scholar's mate, which is short enough to be a test and ends in a real mate
const line: [string, string][] = [
  [t.wTok, "e2e4"], [t.bTok, "e7e5"], [t.wTok, "f1c4"], [t.bTok, "b8c6"],
  [t.wTok, "d1h5"], [t.bTok, "g8f6"], [t.wTok, "h5f7"],
];
// deno-lint-ignore no-explicit-any
let last: any = null;
for (const [tok, m] of line) {
  const r = await move(tok, t.id, m);
  must(r.body?.ok, "the move " + m + " was refused: " + JSON.stringify(r.body));
  last = r.body.duel;
}
must(last.chess.san.join(" ") === "e4 e5 Bc4 Nc6 Qh5 Nf6 Qxf7#",
  "the scoresheet should read the game back: " + last.chess.san.join(" "));
must(last.chess.result === "w" && last.chess.reason === "checkmate",
  "that is checkmate for white: " + JSON.stringify(last.chess));
must(last.winner === t.white, "the duel's winner must be the player with white");
must((await move(t.bTok, t.id, "e8e7")).body.error === "over", "a finished game takes no more moves");

// a friendly game moves nothing at all
const after = { a: await balOf(A.token), b: await balOf(B.token) };
must(Math.abs(after.a - before.a) < 1e-9 && Math.abs(after.b - before.b) < 1e-9,
  `a free table must not move a sahur: ${JSON.stringify(before)} -> ${JSON.stringify(after)}`);

// --- and one with sahurs on it ----------------------------------------------
await nap(1200);
const D = await member("csD"), E = await member("csE");
for (const who of [D, E]) await post("/cas/claim", { token: who.token });
const dBefore = await balOf(D.token), eBefore = await balOf(E.token);
const bet = 1;
const t2 = await table(D, E, bet);
const tok2: Record<string, string> = { [D.name]: D.token, [E.name]: E.token };
// both stakes leave the balances the moment the table is made and joined
must(Math.abs((await balOf(tok2[t2.white])) - (t2.white === D.name ? dBefore : eBefore) + bet) < 1e-9,
  "the stake is held when you sit down");
const gone = await post("/duel/chess", { token: t2.bTok, id: t2.id, action: "resign" });
must(gone.body?.ok, "resigning failed: " + JSON.stringify(gone.body));
// deno-lint-ignore no-explicit-any
must((gone.body.duel as any).chess.result === "w", "black resigning hands it to white");
must((gone.body.duel as { winner: string }).winner === t2.white, "…and the pot with it");
const winAfter = await balOf(tok2[t2.white]), loseAfter = await balOf(tok2[t2.black]);
const winBefore = t2.white === D.name ? dBefore : eBefore;
const loseBefore = t2.black === D.name ? dBefore : eBefore;
must(Math.abs(winAfter - (winBefore + bet)) < 1e-9,
  `the winner should be up one stake: ${winBefore} -> ${winAfter}`);
must(Math.abs(loseAfter - (loseBefore - bet)) < 1e-9,
  `the loser should be down one: ${loseBefore} -> ${loseAfter}`);
must(Math.abs((winAfter + loseAfter) - (winBefore + loseBefore)) < 1e-9,
  "and the two of them together must be exactly where they started");

// --- offering a draw, and taking the offer back ------------------------------
// Both halves. Accepting is the one that ends a game, so it is the one with
// money on it; declining is the one that quietly did nothing for a while —
// the offer was only cleared for the seat that MADE it, so the player it was
// made to could press decline all day and it stayed standing on both boards.
{
  await nap(1200);
  const H = await member("csH"), I = await member("csI");
  let at = "";   // whichever table the two of them are sitting at
  const t4 = await table(H, I, 0);
  at = t4.id;
  const offer = (tok: string) => post("/duel/chess", { token: tok, id: at, action: "draw" });
  const clear = (tok: string) => post("/duel/chess", { token: tok, id: at, action: "unoffer" });
  // deno-lint-ignore no-explicit-any
  const drawFrom = (r: any) => r.body?.duel?.chess?.drawFrom ?? null;

  must(drawFrom(await offer(t4.wTok)) === "w", "white's offer must stand as white's");
  // the player it was made to says no: it comes off the board for both of them
  must(drawFrom(await clear(t4.bTok)) === null, "declining must take the offer off the board");
  must(drawFrom(await move(t4.wTok, t4.id, "e2e4")) === null,
    "and it must not come back on the next move");

  // the other half: whoever made it may withdraw it themselves
  must(drawFrom(await offer(t4.bTok)) === "b", "black may offer in turn");
  must(drawFrom(await clear(t4.bTok)) === null, "and withdraw their own offer");

  // and an offer answered by an offer is an agreement
  must(drawFrom(await offer(t4.bTok)) === "b", "black offers again");
  const agreed = await offer(t4.wTok);
  // deno-lint-ignore no-explicit-any
  const cs4 = (agreed.body.duel as any).chess;
  must(cs4.result === "d" && cs4.reason === "agreed",
    "an offer met with an offer is a draw: " + JSON.stringify(cs4.result));
  must((agreed.body.duel as { winner: string | null }).winner === null, "a draw has no winner");
  // an offer does not survive the move that answers it. The same two sit down
  // again rather than two more being minted: the draw released them both, and
  // a test that applies for a fresh member every few lines is a test that
  // eventually trips the shrine's own rate limit on /apply.
  const t5 = await table(H, I, 0);
  at = t5.id;
  must(drawFrom(await offer(t5.wTok)) === "w", "standing before the move");
  must(drawFrom(await move(t5.wTok, t5.id, "d2d4")) === null, "and gone after it");
}

// --- the clock at a real table -----------------------------------------------
{
  await nap(1200);
  const F = await member("csF"), G = await member("csG");
  // the table is opened at 3|2 and has to still be 3|2 when it deals
  const t3 = await table(F, G, 0, "3+2");
  // deno-lint-ignore no-explicit-any
  const cs0 = t3.cs as any;
  must(cs0.tc === "3+2" && cs0.tcName === "3 | 2", "the table kept its control: " + JSON.stringify(cs0.tc));
  must(cs0.clock[0] === 180_000 && cs0.clock[1] === 180_000, "both sides start at three minutes");
  must(cs0.inc === 2_000, "with two seconds a move");
  must(cs0.running === cs0.yourSeat || cs0.running === 1 - cs0.yourSeat, "somebody's clock is running");

  // it is advertised before you sit down, because three minutes and an hour
  // are not the same game whatever the stake says
  const H = await member("csH");
  await post("/duel/create", { token: H.token, game: "chess", bet: 0, tc: "60+0" });
  const listed = (await j("/duel/list?token=" + encodeURIComponent(H.token))).body;
  // deno-lint-ignore no-explicit-any
  const mineRow = (listed.mine as any);
  must(mineRow?.tcName === "1 hour", "an hour table must say so: " + JSON.stringify(mineRow?.tcName));
  // deno-lint-ignore no-explicit-any
  const others = (await j("/duel/list?token=" + encodeURIComponent(F.token))).body as any;
  // deno-lint-ignore no-explicit-any
  const seen = others.open.find((o: any) => o.host === H.name);
  must(seen && seen.tcName === "1 hour", "and so must the row somebody else sees: " + JSON.stringify(seen));
  await post("/duel/cancel", { token: H.token, id: (mineRow as { id: string }).id });

  // a move spends the mover's time and nobody else's, and hands back the
  // increment. Bracketed by the two clock readings either side of the request,
  // so this is what the clock actually says rather than roughly right: two
  // seconds of increment is far wider than a local round trip, and dropping it
  // puts the answer outside the bracket.
  await nap(1100);
  const beforeMove = Date.now();
  const r = await move(t3.wTok, t3.id, "e2e4");
  const afterMove = Date.now();
  must(r.body?.ok, "e4 was refused: " + JSON.stringify(r.body));
  // deno-lint-ignore no-explicit-any
  const cs1 = (r.body.duel as any).chess;
  const wSeat = cs0.running;               // white's seat: it was white to move
  // what came off white, which must be the time between the clock starting and
  // the move landing, less the two seconds back
  const charged = 180_000 + 2_000 - cs1.clock[wSeat];
  const lo = beforeMove - cs0.since, hi = afterMove - cs0.since;
  must(charged >= lo - 250 && charged <= hi + 250,
    `white should have been charged between ${lo} and ${hi} ms with the increment back, got ${charged}`);
  must(charged >= 1_000, "and the clock must move at all — it had been white's move for a second");
  must(cs1.clock[1 - wSeat] === 180_000, "black's clock has not started and must be untouched");
  must(cs1.running === 1 - wSeat, "and now it has");
  must(cs1.since >= beforeMove, "the running clock restarts from the move");
  // the table's own deadline follows the clock rather than a fixed per-move slot
  const dl = (r.body.duel as { deadline: number }).deadline;
  must(Math.abs(dl - (cs1.since + cs1.clock[1 - wSeat])) < 1_000,
    "the table expires when the running clock does");

  // a control nobody offers is not a way to give yourself an hour
  const I = await member("csI");
  const odd = await post("/duel/create", { token: I.token, game: "chess", bet: 0, tc: "999+99" });
  must(odd.body?.ok, "the table should still open: " + JSON.stringify(odd.body));
  // deno-lint-ignore no-explicit-any
  const oddList = (await j("/duel/list?token=" + encodeURIComponent(I.token))).body.mine as any;
  must(oddList?.tcName === "10 min",
    "junk falls back to the default: " + JSON.stringify(oddList?.tcName));
  await post("/duel/cancel", { token: I.token, id: oddList.id });
}

// --- and the lobby offers exactly what the server will take ------------------
{
  const client = await Deno.readTextFile(`${ROOT}/assets/js/shrine/casino.js`);
  const block = client.slice(client.indexOf("var tcSel=game===\"chess\""));
  must(block, "the chess lobby needs a clock picker");
  const offered = [...block.slice(0, block.indexOf(":null;")).matchAll(/\["([0-9]+\+[0-9]+)"/g)].map((m) => m[1]);
  must(offered.length === 6, "the picker should offer six controls, found " + offered.length);
  for (const id of offered) {
    must(mod.CHESS_TC[id], "the lobby offers a control the server does not know: " + id);
  }
  for (const id of Object.keys(mod.CHESS_TC)) {
    must(offered.includes(id), "the server has a control the lobby never offers: " + id);
  }
}

// ===========================================================================
// the game against the computer
//
// It runs entirely in the browser, so it needs the rules in the browser too —
// and that copy is GENERATED from the one above rather than written beside it,
// because two hand-maintained rulebooks is one rulebook and a divergence.
//
// The opponent is checked for what it is actually for: a search that misses
// mate in one is not a weak opponent, it is a broken one. The first cut of it
// was exactly that — the root used a fail-hard window, so any move better than
// the current best came back clamped to equal it and the first decent move
// found was never beaten.
// ===========================================================================
{
  const rules = await Deno.readTextFile(`${ROOT}/games/tung/chess-rules.js`);
  must(rules.includes("GENERATED from server.ts"), "the browser rules must say they are generated");
  // it has to BE the engine above, not a fork of it that has drifted
  for (const fn of ["chessMoves", "chessApply", "chessEnd", "chessSan", "chessParse"]) {
    must(rules.includes(fn), "the generated rules are missing " + fn);
  }
  // a few landmarks from the source, so an edit to server.ts that never got
  // regenerated shows up here rather than as a game that plays by other rules
  for (const bit of ['const CHESS_START = "rnbqkbnr/pppppppp', "threefold repetition", "fifty-move rule"]) {
    must(rules.includes(bit), "the generated rules look stale — missing: " + bit);
  }

  // load both files the way the page does and make the opponent prove itself
  // deno-lint-ignore no-explicit-any
  const win: any = { setTimeout };
  new Function("window", rules)(win);
  const engineSrc = await Deno.readTextFile(`${ROOT}/games/tung/engine.js`);
  new Function("window", engineSrc)(win);
  must(win.TungEngine && typeof win.TungEngine.make === "function", "the page needs an opponent to make");

  const pick = (fen: string): Promise<string> =>
    new Promise((res) => win.TungEngine.make("medium", () => {}).pick(fen, res));

  // positions with one right answer, and it is not a close call
  const TACTICS: [string, string, string[]][] = [
    ["mate in one, back rank", "6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1", ["a1a8"]],
    ["mate in one, the queen", "6k1/5ppp/8/8/8/8/5PPP/3Q2K1 w - - 0 1", ["d1d8"]],
    ["a queen hanging on g4", "rnb1kbnr/pppp1ppp/8/4p3/6q1/5P2/PPPPP1PP/RNBQKBNR w KQkq - 0 1", ["f3g4"]],
  ];
  for (const [name, fen, want] of TACTICS) {
    const got = await pick(fen);
    must(want.includes(got), `the opponent missed ${name}: played ${got}, wanted ${want.join(" or ")}`);
  }
  // and whatever it plays is always legal, from a position with a lot going on
  const messy = "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1";
  const legal = new Set(chessMoves(chessParse(messy)).map(mod.chessUci));
  for (let i = 0; i < 4; i++) {
    const got = await pick(messy);
    must(legal.has(got), "the opponent played an illegal move: " + got);
  }
  // it never reaches for the network — that is the whole point of it being here
  must(!/fetch\(|XMLHttpRequest|SHRINE_API/.test(engineSrc),
    "the computer opponent must not talk to the backend");
  must(engineSrc.includes('new Worker("stockfish/stockfish.js")'),
    "stockfish must be loaded from this host as a static file");
  must(/playing tung's own head instead/.test(engineSrc),
    "and it must fall back when stockfish cannot be fetched at all");
  // A search runs for the better part of a second and the board can move
  // underneath it — a take-back is exactly that. Two `go`s outstanding at once
  // and the bestmove that comes back answers whichever position it feels like,
  // so a new question has to stop the running search and wait for it to land.
  must(/w\.postMessage\("stop"\)/.test(engineSrc),
    "asking stockfish a second question must stop the search already running");

  // The page's take-back goes back until it is YOUR move rather than counting
  // plies off. Counting landed on the computer's move after it had mated you,
  // or after its first move when you have black, and the board then sat on
  // "he is thinking" with nobody to play it — see games/tung/chess.html.
  const page = await Deno.readTextFile(`${ROOT}/games/tung/chess.html`);
  must(!/var back = G\.over \? 1 : 2/.test(page),
    "the take-back must not count plies — it lands on the computer's move");
  must(/while \(G\.hist\.length && !yours\(\)\)/.test(page),
    "it must go back until it is your turn");
  must(/if \(!yours\(\)\) setTimeout\(botMove/.test(page),
    "and ask him to play again if there is no game left to go back through");

  // The move list must not be able to move the board. In normal flow it added
  // its height to the row the board sits in, the centred game grew upward, and
  // after enough moves "tung's own head" ran into the header. It scrolls inside
  // a box that takes the panel's leftover height and contributes none.
  must(/<div class="movebox"><div class="moves" id="moves"><\/div><\/div>/.test(page),
    "the move list has to sit inside its own box");
  must(/\.movebox\{[^}]*position:relative/.test(page) &&
    /\.moves\{position:absolute;inset:0;overflow-y:auto/.test(page),
    "and scroll there, out of flow, so a long game cannot grow the page");
  must(/\.wrap\{[^}]*justify-content:flex-start/.test(page) && /\.lobby,\.game\{margin-top:auto;margin-bottom:auto\}/.test(page),
    "centring is by auto margins, which never push anything up under the header");
}

// --- the client draws a board and owns no rules ------------------------------
const casino = await Deno.readTextFile(`${ROOT}/assets/js/shrine/casino.js`);
must(casino.includes("function chessBoard("), "the client needs a board to draw");
must(casino.includes('"pit-chess"'), "chess needs a tile in the pit");
must(/legal\[i\]\.slice\(0,2\)===picked/.test(casino),
  "the client must offer the server's legal list rather than work moves out itself");
// the pit's scoresheet has a ceiling of its own and scrolls under it, which is
// what keeps a long game there from walking the board anywhere
const pitStyles = await Deno.readTextFile(`${ROOT}/assets/js/shrine/styles.js`);
must(/\.chmoves\{[^']*max-height:\d+px;overflow-y:auto/.test(pitStyles),
  "the pit's move list must stay capped and scroll");
// the one thing that must never appear out here
for (const word of ["chessMoves", "chessAttacked", "chessInCheck"]) {
  must(!casino.includes(word), "the rules must not be copied into the client: " + word);
}

console.log(
  `chess: perft agrees with the published counts over ${nodes.toLocaleString()} positions` +
    (DEEP ? "" : " (PERFT=deep for the slow depths)") +
    ", mate, stalemate, dead positions, the fifty-move rule and threefold repetition all end " +
    "the game correctly, the scoresheet reads back in algebraic, and at the table the server " +
    "refuses a move out of turn, an illegal move, nonsense, a stranger and a finished game — " +
    "while a friendly table moves no sahurs and a staked one pays the winner exactly what the " +
    "loser put up. The six clocks are the six the lobby offers and nothing else gets through; " +
    "each player spends only their own time, the increment comes back on their own move, the " +
    "table expires when the running clock does, and flagging against a side that could never " +
    "have mated is a draw rather than a loss. A draw offer stands for whoever made it, comes " +
    "off the board when it is declined as well as when it is withdrawn, does not survive the " +
    "move that answers it, and met with an offer of its own is an agreement",
);
