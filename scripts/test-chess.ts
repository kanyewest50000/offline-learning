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
const to = src.indexOf("const CHESS_MOVE_MS");
must(from > 0 && to > from, "could not find the chess engine in server.ts");
const engine = `
${src.slice(from, to)}
export { chessApply, chessEnd, chessFen, chessFromUci, chessKey, chessMoves, chessParse, chessSan, chessUci, CHESS_START };
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
async function table(a: any, b: any, bet: number) {
  const made = await post("/duel/create", { token: a.token, game: "chess", bet });
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

// --- the client draws a board and owns no rules ------------------------------
const casino = await Deno.readTextFile(`${ROOT}/assets/js/shrine/casino.js`);
must(casino.includes("function chessBoard("), "the client needs a board to draw");
must(casino.includes('"pit-chess"'), "chess needs a tile in the pit");
must(/legal\[i\]\.slice\(0,2\)===picked/.test(casino),
  "the client must offer the server's legal list rather than work moves out itself");
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
    "loser put up",
);
