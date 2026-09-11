#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read
// The Pit. Two players, two stakes, one pot — and the only thing that actually
// matters is that the pot is paid out exactly once. Every exit from a duel (a
// win, a cancel, a table nobody joined, a confirm nobody gave, a player who
// wandered off) releases the same escrow, so every one of them is a chance to
// pay twice, pay nobody, or mint sahurs out of a race. This walks all of them
// and counts the money after each.
//
// Run the app with short duel clocks so the ten-minute and ten-second waits
// happen in a second:
//   ADMIN_KEY=devadminkey DUEL_OPEN_MS=1200 DUEL_CONFIRM_MS=1200 DUEL_MOVE_MS=1200 \
//     deno run --allow-net --allow-env --unstable-kv server.ts
//   ADMIN_KEY=devadminkey API=... deno run --allow-net --allow-env --allow-read scripts/test-duel.ts

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const API = (Deno.env.get("API") || "http://127.0.0.1:8000").replace(/\/$/, "");
const ADMIN = Deno.env.get("ADMIN_KEY") || "devadminkey";
const OPEN_MS = Number(Deno.env.get("DUEL_OPEN_MS") || 1200);
const CONFIRM_MS = Number(Deno.env.get("DUEL_CONFIRM_MS") || 1200);
const MOVE_MS = Number(Deno.env.get("DUEL_MOVE_MS") || 1200);

function must(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}
async function j(path: string, opt?: RequestInit) {
  const r = await fetch(API + path, opt);
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
const post = (path: string, obj: unknown) =>
  j(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(obj) });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const money = (n: number) => Math.round(n * 100) / 100;

// ---------------------------------------------------------------------------
// source: the shape of the rules, read off the server rather than trusted
const src = await Deno.readTextFile(`${ROOT}/server.ts`);
must(/DUEL_OPEN_MS"\) \|\| 10 \* 60 \* 1000\)/.test(src), "an unjoined table must default to a 10 minute life");
must(/DUEL_CONFIRM_MS"\) \|\| 10 \* 1000\)/.test(src), "the confirm window must default to 10 seconds");
// the pot is both stakes and nothing is skimmed: a rake would break every
// conservation assertion below, so the absence of one is pinned here too
must(/credits\.push\(\{ id: w\.id, amount: round2\(d\.bet \* seatedPlayers\(d\)\.length\) \}\)/.test(src),
  "the winner must take every stake at the table — no rake, no rounding");
must(/if \(ranks\.filter\(\(r\) => r === hi\)\.length !== 1\) continue/.test(src),
  "a high-card tie must be re-cut at any table size, not split or pushed");
must(/if \(entry\.value\?\.settled\) return false;/.test(src),
  "commitDuel must refuse to pay a duel that is already settled");
// every release of the escrow has to ride the same guarded commit
const commits = [...src.matchAll(/kv\.atomic\(\)/g)].length;
must(commits > 0, "no atomic commits found at all — did the file move?");
must(/async function commitDuel\([\s\S]*?op = op\.check\(cur\)/.test(src),
  "commitDuel must check every balance it credits");

// ---------------------------------------------------------------------------
async function member(tag: string) {
  const n = tag + Math.random().toString(36).slice(2, 8);
  const a = await post("/apply", { username: n, application: "the pit" });
  const token = a.body?.token as string;
  must(!!token, "apply failed for " + n);
  const pend = await j("/admin/pending?key=" + encodeURIComponent(ADMIN));
  const id = (pend.body.pending || []).find((x: { username: string }) => x.username === n)?.id;
  must(!!id, n + " not pending");
  must(!!(await post("/admin/decide", { key: ADMIN, id, action: "approve" })).body?.ok, "approve failed");
  // stake them from the admin side so the faucet cooldown is not in the way
  must(!!(await post("/admin/setbal", { key: ADMIN, id, balance: 100 })).body?.ok, "setbal failed for " + n);
  return { name: n, token, id };
}
const bal = async (t: string) => money((await j("/cas/me?token=" + encodeURIComponent(t))).body.balance as number);

// Opening a table is churn-capped per account, and this file opens a lot of
// them. Assert on the way in so a tripped cap names itself rather than showing
// up later as an unreadable duel id.
async function table(token: string, game: string, bet: number, seats?: number): Promise<string> {
  const c = await post("/duel/create", seats ? { token, game, bet, seats } : { token, game, bet });
  must(c.body?.ok === true, "could not open a table: " + JSON.stringify(c.body));
  return c.body.duel.id as string;
}

// Every section below starts from a known balance rather than inheriting
// whatever the last one left, so each assertion stands on its own and a failure
// names the thing that actually broke.
async function fund(m: { id: string }, amount: number) {
  must(!!(await post("/admin/setbal", { key: ADMIN, id: m.id, balance: amount })).body?.ok,
    "setbal failed");
}

// A duel can only ever move sahurs between its two players. This snapshots
// both, runs something, and insists the total is untouched.
async function conserved(a: string, b: string, what: string, fn: () => Promise<void>) {
  const before = (await bal(a)) + (await bal(b));
  await fn();
  const after = (await bal(a)) + (await bal(b));
  must(money(before) === money(after),
    `${what} changed the total sahurs in play: ${before} -> ${after}`);
}

const A = await member("pitA");
const B = await member("pitB");
const C = await member("pitC");

// ---------------------------------------------------------------------------
// 1. a table costs you the stake up front, and taking it down gives it back
{
  await fund(A, 100);
  const start = await bal(A.token);
  const c = await post("/duel/create", { token: A.token, game: "tung", bet: 5 });
  must(c.body?.ok === true, "create failed: " + JSON.stringify(c.body));
  must((await bal(A.token)) === money(start - 5), "creating a table must debit the stake immediately");
  const id = c.body.duel.id;

  // and you cannot open a second one while that is standing
  const two = await post("/duel/create", { token: A.token, game: "tung", bet: 5 });
  must(two.body?.error === "already in a duel", "a player may only hold one table at a time");
  must((await bal(A.token)) === money(start - 5), "the refused second table must not have cost anything");

  const x = await post("/duel/cancel", { token: A.token, id });
  must(x.body?.ok === true, "cancel failed: " + JSON.stringify(x.body));
  must((await bal(A.token)) === start, "cancelling must refund exactly the stake");

  // the exploit this is really about: cancelling twice
  const again = await post("/duel/cancel", { token: A.token, id });
  must(again.body?.ok !== true, "a duel must not be cancellable twice");
  must((await bal(A.token)) === start, "the second cancel must not pay again");
}

// 2. a table nobody sits at refunds itself — ONCE, however many readers reach
//    it at the same instant.
//    This is the sharpest edge in the whole file. Nothing runs on a timer, so
//    the refund happens inside whichever request first notices the clock has
//    run out — and if a dozen notice together, a dozen refunds are attempted.
//    Every one of them is a fresh stake minted out of nothing. Measured: with
//    the check on the duel entry removed from commitDuel, a handful of
//    simultaneous readers pays the host twice within a couple of rounds; with
//    it, no amount of pushing does. Several rounds, a crowd each time.
{
  for (let round = 0; round < 3; round++) {
    await fund(A, 100);
    const start = await bal(A.token);
    const c = await post("/duel/create", { token: A.token, game: "tung", bet: 7 });
    must(c.body?.ok === true, "create failed: " + JSON.stringify(c.body));
    const id = c.body.duel.id;
    await sleep(OPEN_MS + 300);
    // one burst, fired together, all landing on an overdue table
    await Promise.all(
      new Array(12).fill(0).map(() => j("/duel/state?token=" + encodeURIComponent(A.token) + "&id=" + id)),
    );
    const end = await bal(A.token);
    must(end === start,
      `an expired table must refund exactly once — 12 simultaneous readers turned ${start} into ${end}`);
    const st = await j("/duel/state?token=" + encodeURIComponent(A.token) + "&id=" + id);
    must(st.body.duel.state === "done" && st.body.duel.reason === "expired", "the expired table must read as expired");
  }
  // and the lobby sweeps them too, so a host who never comes back is still paid
  await fund(A, 100);
  const c = await post("/duel/create", { token: A.token, game: "tung", bet: 7 });
  must(c.body?.ok === true, "create failed: " + JSON.stringify(c.body));
  await sleep(OPEN_MS + 300);
  await j("/duel/list?token=" + encodeURIComponent(B.token));   // someone else's page load
  must((await bal(A.token)) === 100, "the lobby must sweep an abandoned table back to its host");
}

// 3. two people cannot take the same seat, and only the one who got it pays
{
  await fund(A, 100); await fund(B, 100); await fund(C, 100);
  const c = await post("/duel/create", { token: A.token, game: "tung", bet: 4 });
  const id = c.body.duel.id;
  const beforeB = await bal(B.token), beforeC = await bal(C.token);
  const rush = await Promise.all([
    post("/duel/join", { token: B.token, id }),
    post("/duel/join", { token: C.token, id }),
  ]);
  const seated = rush.filter((r) => r.body?.ok === true);
  must(seated.length === 1, `exactly one player may sit down, ${seated.length} did`);
  const paid = [money(beforeB - (await bal(B.token))), money(beforeC - (await bal(C.token)))].filter((d) => d !== 0);
  must(paid.length === 1 && paid[0] === 4, `only the seated player may be debited, saw ${JSON.stringify(paid)}`);
  // let it die on the confirm clock; both stakes come home
  const tot = (await bal(A.token)) + (await bal(B.token)) + (await bal(C.token));
  await sleep(CONFIRM_MS + 400);
  await j("/duel/state?token=" + encodeURIComponent(A.token) + "&id=" + id);
  const st = await j("/duel/state?token=" + encodeURIComponent(A.token) + "&id=" + id);
  must(st.body.duel.reason === "unconfirmed", "a duel nobody confirmed must end unconfirmed");
  const tot2 = (await bal(A.token)) + (await bal(B.token)) + (await bal(C.token));
  must(money(tot2 - tot) === 8, `both stakes must come back (${tot} -> ${tot2})`);
}

// 3b. cancel against a join. Both want to release the same escrow — the host's
//     stake back, or the guest's stake in — and if both were ever allowed to
//     land the host would be refunded for a table that is now being played,
//     which is a stake conjured out of nothing.
//
//     Two shapes. Fired together, exactly one may win (on one server the cancel
//     reliably gets to its commit first, since it reads less before committing,
//     so this half mostly proves the join is refused cleanly and costs nobody
//     anything). Fired just after a join has landed — the actual exploit, where
//     a host watches someone sit down and then tries to take their stake back
//     out from under the duel — the cancel must be refused and the host must
//     still be down their stake.
{
  // its own players: this section opens eight tables and the churn cap is
  // per account, so borrowing A would starve the sections after it
  const H = await member("racH"), G = await member("racG");
  for (let round = 0; round < 4; round++) {
    await fund(H, 100); await fund(G, 100);
    const id = await table(H.token, "tung", 9);
    const startA = await bal(H.token), startB = await bal(G.token);

    const [cancelled, joined] = await Promise.all([
      post("/duel/cancel", { token: H.token, id }),
      post("/duel/join", { token: G.token, id }),
    ]);
    const cancelWon = cancelled.body?.ok === true;
    const joinWon = joined.body?.ok === true;
    must(cancelWon !== joinWon,
      `exactly one of cancel/join may succeed, got cancel=${cancelWon} join=${joinWon}`);

    const endA = await bal(H.token), endB = await bal(G.token);
    if (cancelWon) {
      must(endA === money(startA + 9), `the cancel won, so the host gets their stake back once (${startA} -> ${endA})`);
      must(endB === startB, `the guest never sat down, so nothing may leave their balance (${startB} -> ${endB})`);
    } else {
      must(endA === startA, `the join won, so the host's stake stays on the table (${startA} -> ${endA})`);
      must(endB === money(startB - 9), `the guest sat down, so exactly their stake is staked (${startB} -> ${endB})`);
      await sleep(CONFIRM_MS + 400);
      await j("/duel/state?token=" + encodeURIComponent(H.token) + "&id=" + id);
    }
  }

  // the exploit proper: take the stake back after somebody has already sat down
  for (let round = 0; round < 4; round++) {
    await fund(H, 100); await fund(G, 100);
    const id = await table(H.token, "tung", 9);
    const seat = await post("/duel/join", { token: G.token, id });
    must(seat.body?.ok === true, "the guest should be seated: " + JSON.stringify(seat.body));
    const midA = await bal(H.token), midB = await bal(G.token);

    // several attempts at once, in case one of them can slip through
    const tries = await Promise.all(
      new Array(6).fill(0).map(() => post("/duel/cancel", { token: H.token, id })),
    );
    must(tries.every((t) => t.body?.ok !== true),
      "a table that has been joined must not be cancellable: " + JSON.stringify(tries.map((t) => t.body)));
    must((await bal(H.token)) === midA,
      `a refused cancel must not refund the host (${midA} -> ${await bal(H.token)})`);
    must((await bal(G.token)) === midB, "a refused cancel must not touch the guest");

    // the duel is still a real duel, and settles normally on its own clock
    const st = await j("/duel/state?token=" + encodeURIComponent(H.token) + "&id=" + id);
    must(st.body.duel.state === "confirm", "the joined table must still be waiting on confirmations");
    await sleep(CONFIRM_MS + 400);
    await j("/duel/state?token=" + encodeURIComponent(H.token) + "&id=" + id);
    must((await bal(H.token)) === money(midA + 9) && (await bal(G.token)) === money(midB + 9),
      "once the confirm window lapses both stakes come home, exactly once each");
  }
}

// 4. your own table is not a seat, and a stranger cannot play your duel
{
  await fund(A, 100); await fund(B, 100);
  const c = await post("/duel/create", { token: A.token, game: "tung", bet: 3 });
  const id = c.body.duel.id;
  must((await post("/duel/join", { token: A.token, id })).status === 400, "you cannot join your own table");
  must((await post("/duel/join", { id })).status === 401, "an unauthenticated join must be refused");
  must((await post("/duel/join", { token: "garbage", id })).status === 401, "a bad key must be refused");
  await post("/duel/join", { token: B.token, id });
  const third = await post("/duel/confirm", { token: C.token, id });
  must(third.status === 403, "someone who is not in the duel cannot confirm it");
  must((await j("/duel/state?token=" + encodeURIComponent(C.token) + "&id=" + id)).status === 403,
    "someone who is not in the duel cannot read it");
  await sleep(CONFIRM_MS + 400);
  await j("/duel/list?token=" + encodeURIComponent(A.token));
}

// 5. a full game of Tung, Wood, Fire: the winner takes both stakes, exactly
{
  await fund(A, 100); await fund(B, 100);
  const startA = await bal(A.token), startB = await bal(B.token);
  const c = await post("/duel/create", { token: A.token, game: "tung", bet: 6 });
  const id = c.body.duel.id;
  await post("/duel/join", { token: B.token, id });
  must((await post("/duel/move", { token: A.token, id, move: "tung" })).body?.error === "not now",
    "no moves before both players have confirmed");
  await post("/duel/confirm", { token: A.token, id });
  const live = await post("/duel/confirm", { token: B.token, id });
  must(live.body.duel.state === "live", "two confirms must open the table");

  // A plays tung, B plays wood — tung splits the wood, so A takes every round
  let guard = 0;
  for (;;) {
    const st = await j("/duel/state?token=" + encodeURIComponent(A.token) + "&id=" + id);
    if (st.body.duel.state === "done") break;
    must(guard++ < 8, "the duel never finished");
    // sending twice in one round must not be a way to change your mind
    await post("/duel/move", { token: A.token, id, move: "tung" });
    const dup = await post("/duel/move", { token: A.token, id, move: "fire" });
    must(dup.body?.error === "already played", "a second move in one round must be refused");
    // and until they answer, their pick is not visible
    const peek = await j("/duel/state?token=" + encodeURIComponent(A.token) + "&id=" + id);
    must(peek.body.duel.theirMove === undefined, "the opponent's move must never be shipped");
    await post("/duel/move", { token: B.token, id, move: "wood" });
  }
  const fin = await j("/duel/state?token=" + encodeURIComponent(A.token) + "&id=" + id);
  must(fin.body.duel.winner === A.name, "tung splits the wood — the host should have won");
  must((await bal(A.token)) === money(startA + 6), "the winner must be up exactly the loser's stake");
  must((await bal(B.token)) === money(startB - 6), "the loser must be down exactly their stake");
}

// 6. walking away after confirming is a forfeit, not a free refund
{
  await fund(A, 100); await fund(B, 100);
  const startA = await bal(A.token), startB = await bal(B.token);
  const c = await post("/duel/create", { token: A.token, game: "tung", bet: 9 });
  const id = c.body.duel.id;
  await post("/duel/join", { token: B.token, id });
  await post("/duel/confirm", { token: A.token, id });
  await post("/duel/confirm", { token: B.token, id });
  await post("/duel/move", { token: A.token, id, move: "fire" });   // B never answers
  await sleep(MOVE_MS + 400);
  await j("/duel/state?token=" + encodeURIComponent(A.token) + "&id=" + id);
  const fin = await j("/duel/state?token=" + encodeURIComponent(A.token) + "&id=" + id);
  must(fin.body.duel.reason === "forfeit", "an absent player must forfeit");
  must(fin.body.duel.winner === A.name, "the player who was there must take it");
  must((await bal(A.token)) === money(startA + 9), "the forfeit must pay the pot to the player who stayed");
  must((await bal(B.token)) === money(startB - 9), "the player who left must lose their stake, once");
}

// 7. both of you wandering off is a wash, not a double payout
{
  await fund(A, 100); await fund(B, 100);
  const startA = await bal(A.token), startB = await bal(B.token);
  const c = await post("/duel/create", { token: A.token, game: "tung", bet: 8 });
  const id = c.body.duel.id;
  await post("/duel/join", { token: B.token, id });
  await post("/duel/confirm", { token: A.token, id });
  await post("/duel/confirm", { token: B.token, id });
  await sleep(MOVE_MS + 400);
  // a crowd of readers all racing the same sweep
  await Promise.all(new Array(6).fill(0).map(() =>
    j("/duel/state?token=" + encodeURIComponent(A.token) + "&id=" + id)
  ));
  must((await bal(A.token)) === startA, "a duel nobody played must refund the host once");
  must((await bal(B.token)) === startB, "a duel nobody played must refund the guest once");
}

// 8. The Cut: one card each, settled the instant the second yes lands
{
  await fund(A, 100); await fund(B, 100);
  const startA = await bal(A.token), startB = await bal(B.token);
  const c = await post("/duel/create", { token: A.token, game: "cut", bet: 10 });
  const id = c.body.duel.id;
  must(c.body.duel.seats === 2, "a cut with no seats asked for must default to 2");
  await post("/duel/join", { token: B.token, id });
  await post("/duel/confirm", { token: A.token, id });
  const done = await post("/duel/confirm", { token: B.token, id });
  must(done.body.duel.state === "done", "the cut must resolve on the second confirm");
  const cards = done.body.duel.cards;
  must(!!cards && !!cards.host && !!cards.guest, "the cut must show both cards");
  must(cards.host !== cards.guest, "the cut must not deal the same card twice");
  const winner = done.body.duel.winner;
  must(winner === A.name || winner === B.name, "the cut must have a winner");
  const endA = await bal(A.token), endB = await bal(B.token);
  must(money(endA + endB) === money(startA + startB), "the cut must not mint or burn sahurs");
  must(money(Math.abs(endA - startA)) === 10 && money(Math.abs(endB - startB)) === 10,
    "exactly one stake must change hands in a cut");
  must((winner === A.name) === (endA > startA), "the balance that went up must belong to the declared winner");
}

// 9. you cannot stake what you do not have, and a refused stake costs nothing
{
  await fund(A, 100);
  const D = await member("pitD");
  must(!!(await post("/admin/setbal", { key: ADMIN, id: D.id, balance: 1 })).body?.ok, "setbal failed");
  const broke = await post("/duel/create", { token: D.token, game: "tung", bet: 50 });
  must(broke.body?.error === "insufficient", "a stake beyond your balance must be refused");
  must((await bal(D.token)) === 1, "a refused table must not move the balance");
  // and the same on the way in to someone else's table
  const c = await post("/duel/create", { token: A.token, game: "tung", bet: 50 });
  const id = c.body.duel.id;
  const cannot = await post("/duel/join", { token: D.token, id });
  must(cannot.body?.error === "insufficient", "you cannot sit at a table you cannot cover");
  must((await bal(D.token)) === 1, "a refused seat must not move the balance");
  await post("/duel/cancel", { token: A.token, id });
}

// 10. the whole thing, end to end, conserving every sahur
await fund(A, 100);
await fund(B, 100);
await conserved(A.token, B.token, "a full duel", async () => {
  const c = await post("/duel/create", { token: A.token, game: "cut", bet: 12 });
  const id = c.body.duel.id;
  await post("/duel/join", { token: B.token, id });
  await post("/duel/confirm", { token: A.token, id });
  await post("/duel/confirm", { token: B.token, id });
});

// 11. The Cut at three and four: the table stays open until the last chair
//     is taken, every seated stake is conserved, and a tied high card is
//     re-cut until one player has it. Tung, Wood, Fire is still two chairs
//     no matter what you ask for.
{
  const P = await member("cutP");
  const Q = await member("cutQ");
  const R = await member("cutR");
  const S = await member("cutS");
  const T = await member("cutT");

  const forced = await post("/duel/create", { token: P.token, game: "tung", bet: 3, seats: 4 });
  must(forced.body.duel.seats === 2, "tung, wood, fire must stay a two-player table");
  await post("/duel/cancel", { token: P.token, id: forced.body.duel.id });

  const weird = await post("/duel/create", { token: P.token, game: "cut", bet: 3, seats: 9 });
  must(weird.body.duel.seats === 2, "a cut that asks for a nonsense size must fall back to 2");
  await post("/duel/cancel", { token: P.token, id: weird.body.duel.id });

  // three chairs: the first guest does not start the handshake
  await fund(P, 100); await fund(Q, 100); await fund(R, 100);
  const three = await post("/duel/create", { token: P.token, game: "cut", bet: 5, seats: 3 });
  must(three.body.duel.seats === 3 && three.body.duel.state === "open", "a 3-seat cut must open as a 3-seat table");
  const id3 = three.body.duel.id;
  const first = await post("/duel/join", { token: Q.token, id: id3 });
  must(first.body?.ok === true && first.body.duel.state === "open",
    "the first guest at a 3-seat table must leave it filling: " + JSON.stringify(first.body));
  must(first.body.duel.filled === 2, "two people should be seated after the first sit-down");
  must((await post("/duel/confirm", { token: P.token, id: id3 })).body?.error === "not now",
    "nobody may confirm a cut that is still filling");

  // host can still take a filling table down, and both stakes come home
  const midP = await bal(P.token), midQ = await bal(Q.token);
  const pulled = await post("/duel/cancel", { token: P.token, id: id3 });
  must(pulled.body?.ok === true, "the host must be able to take a filling cut down");
  must((await bal(P.token)) === money(midP + 5) && (await bal(Q.token)) === money(midQ + 5),
    "cancelling a filling cut must refund everyone who sat");

  // play a 3-seat cut through, then a 4-seat one
  async function playCut(seats: number, players: { name: string; token: string }[], bet: number) {
    const starts = [];
    for (const p of players) starts.push(await bal(p.token));
    const opened = await post("/duel/create", { token: players[0].token, game: "cut", bet, seats });
    must(opened.body?.ok === true && opened.body.duel.seats === seats,
      "could not open a " + seats + "-seat cut: " + JSON.stringify(opened.body));
    const id = opened.body.duel.id as string;
    for (let i = 1; i < players.length; i++) {
      const seat = await post("/duel/join", { token: players[i].token, id });
      must(seat.body?.ok === true, "sit-down " + i + " failed: " + JSON.stringify(seat.body));
      const expect = i === players.length - 1 ? "confirm" : "open";
      must(seat.body.duel.state === expect,
        "after " + (i + 1) + " seated a " + seats + "-seat cut should be " + expect + ", got " + seat.body.duel.state);
    }
    // a stranger still cannot walk in once it is full
    if (seats === 3) {
      const late = await post("/duel/join", { token: T.token, id });
      must(late.body?.error === "taken", "a full cut must refuse another sit-down");
    }
    const afterFull = await post("/duel/cancel", { token: players[0].token, id });
    must(afterFull.body?.ok !== true, "a full cut must not be cancellable");

    let last = await post("/duel/confirm", { token: players[0].token, id });
    must(last.body?.ok === true, "confirm failed for " + players[0].name + ": " + JSON.stringify(last.body));
    for (let i = 1; i < players.length; i++) {
      last = await post("/duel/confirm", { token: players[i].token, id });
      must(last.body?.ok === true, "confirm failed for " + players[i].name + ": " + JSON.stringify(last.body));
    }
    must(last.body.duel.state === "done", "the cut must resolve on the last confirm");
    const cards = last.body.duel.cards;
    const hands = last.body.duel.hands as { name: string; card: string; you: boolean }[];
    must(!!cards && !!cards.host && !!cards.guest, "the cut must still show host and guest cards");
    must(Array.isArray(hands) && hands.length === seats, "the cut must deal one card per seat");
    must(hands.every((h) => !!h.card), "every seated player must receive a card");
    const names = players.map((p) => p.name);
    must(names.includes(last.body.duel.winner), "the cut must name one of the seated winners");
    const ends = [];
    for (const p of players) ends.push(await bal(p.token));
    const before = starts.reduce((a, b) => a + b, 0);
    const after = ends.reduce((a, b) => a + b, 0);
    must(money(before) === money(after),
      seats + "-seat cut minted or burned sahurs: " + before + " -> " + after);
    const deltas = ends.map((e, i) => money(e - starts[i]));
    const up = deltas.filter((x) => x > 0);
    const down = deltas.filter((x) => x < 0);
    must(up.length === 1 && up[0] === money(bet * (seats - 1)),
      seats + "-seat winner must be up the other stakes, saw " + JSON.stringify(deltas));
    must(down.length === seats - 1 && down.every((x) => x === money(-bet)),
      seats + "-seat losers must each be down exactly their stake, saw " + JSON.stringify(deltas));
  }

  await fund(P, 100); await fund(Q, 100); await fund(R, 100);
  await playCut(3, [P, Q, R], 5);
  await fund(P, 100); await fund(Q, 100); await fund(R, 100); await fund(S, 100);
  await playCut(4, [P, Q, R, S], 4);

  // two guests racing for the remaining chairs of a 3-seat table both sit
  await fund(P, 100); await fund(Q, 100); await fund(R, 100);
  const race = await post("/duel/create", { token: P.token, game: "cut", bet: 2, seats: 3 });
  const raceId = race.body.duel.id;
  const rush = await Promise.all([
    post("/duel/join", { token: Q.token, id: raceId }),
    post("/duel/join", { token: R.token, id: raceId }),
  ]);
  const sat = rush.filter((x) => x.body?.ok === true);
  must(sat.length === 2, "both guests must be able to sit a 3-seat cut at once, " + sat.length + " did");
  const st = await j("/duel/state?token=" + encodeURIComponent(P.token) + "&id=" + raceId);
  must(st.body.duel.state === "confirm" && st.body.duel.filled === 3,
    "a 3-seat cut with both guests in must be waiting on confirms");
  await sleep(CONFIRM_MS + 400);
  await j("/duel/state?token=" + encodeURIComponent(P.token) + "&id=" + raceId);
  must((await bal(P.token)) === 100 && (await bal(Q.token)) === 100 && (await bal(R.token)) === 100,
    "an unconfirmed 3-seat cut must refund every stake once");

  // a filling table that expires refunds everyone who sat, once
  await fund(P, 100); await fund(Q, 100);
  const slow = await post("/duel/create", { token: P.token, game: "cut", bet: 6, seats: 4 });
  const sid = slow.body.duel.id;
  must((await post("/duel/join", { token: Q.token, id: sid })).body?.ok === true, "second seat on a 4-cut failed");
  await sleep(OPEN_MS + 300);
  await Promise.all(new Array(8).fill(0).map(() =>
    j("/duel/state?token=" + encodeURIComponent(P.token) + "&id=" + sid)
  ));
  must((await bal(P.token)) === 100 && (await bal(Q.token)) === 100,
    "an expired filling cut must refund every seated stake once");
}

console.log(
  "the pit: stakes escrowed on commit and released exactly once — cancel, expiry, " +
    "unconfirmed, forfeit, double-forfeit and a played hand all pay once; seat races " +
    "debit one player; no rake, no minting, no double refunds; the cut seats 2, 3 or 4",
);
