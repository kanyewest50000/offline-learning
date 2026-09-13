#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read
// Calling tung into a cut.
//
// A cut wants a body in the other chair and there is not always one about, so
// the host can call tung. He cuts a card like anyone else — but he is NOT a
// member: no account, no balance, no lock. That makes a table he is sitting at
// a house table wearing the pit's clothes, and the one thing it changes is the
// money. Between players a pot has no rake and never will. Against tung it pays
// the house's 0.1% edge, the same as every other table in the casino.
//
// So this counts the money on every exit: he wins, he loses, the table is taken
// down, the player never confirms. Nothing may pay twice, and nothing may pay
// into an account that does not exist.
//
//   ADMIN_KEY=devadminkey DUEL_OPEN_MS=1500 DUEL_CONFIRM_MS=1500 \
//     deno run --allow-net --allow-env --unstable-kv server.ts
//   ADMIN_KEY=devadminkey API=... deno run --allow-net --allow-env --allow-read scripts/test-call-tung.ts

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const API = (Deno.env.get("API") || "http://127.0.0.1:8000").replace(/\/$/, "");
const ADMIN = Deno.env.get("ADMIN_KEY") || "devadminkey";
const CONFIRM_MS = Number(Deno.env.get("DUEL_CONFIRM_MS") || 1500);
const HOUSE = 0.999;

function must(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}
async function j(path: string, opt?: RequestInit) {
  const r = await fetch(API + path, opt);
  return { status: r.status, body: await r.json().catch(() => ({})) as Record<string, unknown> };
}
const post = (path: string, obj: unknown) =>
  j(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(obj) });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const money = (n: number) => Math.round(n * 100) / 100;

// ---- source: he must be unable to collide with, or be paid as, a member
const src = await Deno.readTextFile(`${ROOT}/server.ts`);
must(/const BOT_ID = "tung!bot";/.test(src), "tung's id must not be something rid() could ever mint");
must(/winners\.forEach\(\(w, i\) => \{ if \(!isBot\(w\)\) credits\.push/.test(src),
  "tung winning must credit nobody — there is no balance behind him");
must(/for \(const p of people\) if \(!isBot\(p\)\) credits\.push\(\{ id: p\.id, amount: d\.bet \}\);/.test(src),
  "a void table must not refund a stake tung never put in");
must(/const pot = hasBot\(d\) \? floor2\(round2\(d\.bet \* people\.length\) \* HOUSE\) : round2\(d\.bet \* people\.length\);/.test(src),
  "a table with tung at it must pay the house edge, and one without must not");
must(/const CAN_CALL_TUNG = new Set\(\["cut"\]\);/.test(src), "the cut is the table he sits at");
must(/function tungSide\(n: number\): DuelSide \{[\s\S]*?id: BOT_ID \+ "#" \+ n,/.test(src),
  "each chair he takes needs an id of its own, or two of him are one player");

async function member(tag: string) {
  const n = tag + Math.random().toString(36).slice(2, 8);
  const a = await post("/apply", { username: n, application: "call tung" });
  const token = a.body.token as string;
  must(!!token, "apply failed");
  const pend = await j("/admin/pending?key=" + encodeURIComponent(ADMIN));
  const id = (pend.body.pending as { username: string; id: string }[] || []).find((x) => x.username === n)?.id;
  must(!!id, n + " not pending");
  must(!!(await post("/admin/decide", { key: ADMIN, id, action: "approve" })).body?.ok, "approve failed");
  return { name: n, token, id };
}
const A = await member("cuA"), B = await member("cuB");
const fund = async (m: { id: string }, n: number) =>
  must(!!(await post("/admin/setbal", { key: ADMIN, id: m.id, balance: n })).body?.ok, "setbal failed");
const bal = async (t: string) => money((await j("/cas/me?token=" + encodeURIComponent(t))).body.balance as number);

// ---------------------------------------------------------------------------
// he only comes to a cut, only to the host's own table, and only once
{
  await fund(A, 100);
  const tw = await post("/duel/create", { token: A.token, game: "tung", bet: 5 });
  const twId = (tw.body.duel as { id: string }).id;
  const no = await post("/duel/call", { token: A.token, id: twId });
  must(no.status === 400, "tung does not throw a hand of tung, wood, fire: " + no.status);
  await post("/duel/cancel", { token: A.token, id: twId });

  const c = await post("/duel/create", { token: A.token, game: "cut", bet: 5, seats: 2 });
  const id = (c.body.duel as { id: string }).id;
  must((c.body.duel as { canCall: boolean }).canCall === true, "the host's own filling cut must offer him");
  const notYours = await post("/duel/call", { token: B.token, id });
  must(notYours.status === 403, "only the host may call him: " + notYours.status);
  const seated = await post("/duel/call", { token: A.token, id });
  must(seated.body?.ok === true, "he must come: " + JSON.stringify(seated.body));
  const view = seated.body.duel as Record<string, unknown>;
  must(view.state === "confirm", "and that fills a two-seat table: " + view.state);
  must(view.tung === true, "the table must say it is his");
  const seats = view.players as { name: string; bot?: boolean; confirmed: boolean }[];
  must(seats.length === 2 && seats[1].bot === true && seats[1].name === "tung",
    "he takes one chair, under his own name: " + JSON.stringify(seats));
  must(seats[1].confirmed === true, "and he says yes on the way in");
  must((await post("/duel/call", { token: A.token, id })).status === 409, "a full table has no chair for another");
  must((await bal(A.token)) === 95, "his chair costs the player nothing extra: " + (await bal(A.token)));

  // a player cannot take the chair he is in
  must((await post("/duel/join", { token: B.token, id })).body?.error === "taken",
    "a full table must refuse a body");

  // ---- play it out and count the money
  const before = await bal(A.token);
  const done = await post("/duel/confirm", { token: A.token, id });
  const d = done.body.duel as Record<string, unknown>;
  must(d.state === "done" && d.reason === "play", "one yes is the whole handshake: " + d.state + "/" + d.reason);
  const paid = d.paid as { name: string; amount: number }[];
  const after = await bal(A.token);
  if (d.winner === A.name) {
    const want = Math.floor(10 * HOUSE * 100) / 100;   // the pot, less the house edge
    must(paid.length === 1 && paid[0].amount === want,
      "a win against tung pays the pot less the edge: " + JSON.stringify(paid) + " wanted " + want);
    must(after === money(before + want), "and lands in the balance: " + before + " -> " + after);
    must(want < 10, "which is strictly less than the two stakes — that IS the edge");
  } else {
    must(d.winner === "tung", "if it is not the player it is tung: " + d.winner);
    must(paid.length === 1 && paid[0].name === "tung", "he is named as having taken it");
    must(after === before, "and nothing comes back: " + before + " -> " + after);
  }
  // whatever happened, reading it again must not pay again
  await Promise.all(new Array(8).fill(0).map(() =>
    j("/duel/state?token=" + encodeURIComponent(A.token) + "&id=" + id)
  ));
  must((await bal(A.token)) === after, "a cut against tung must settle exactly once");
}

// ---------------------------------------------------------------------------
// He fills as many chairs as are empty. One call is one chair, and the offer
// stays up until the table is full — at four seats with nobody about that is
// the player against three of him.
{
  await fund(A, 100);
  const c = await post("/duel/create", { token: A.token, game: "cut", bet: 4, seats: 4 });
  const id = (c.body.duel as { id: string }).id;
  for (let want = 1; want <= 3; want++) {
    const before = await bal(A.token);
    const r = await post("/duel/call", { token: A.token, id });
    must(r.body?.ok === true, "call " + want + " failed: " + JSON.stringify(r.body));
    const v = r.body.duel as Record<string, unknown>;
    must(v.tungs === want, "call " + want + " should seat " + want + " of him, got " + v.tungs);
    must(v.filled === want + 1, "and fill " + (want + 1) + " chairs, got " + v.filled);
    // the offer stays up while a chair is empty, and goes when the table fills
    must(v.canCall === (want < 3), "after call " + want + " the offer should be " + (want < 3));
    must(v.state === (want < 3 ? "open" : "confirm"), "state after call " + want + ": " + v.state);
    must((await bal(A.token)) === before, "and none of his chairs costs the player anything");
  }
  const full = await j("/duel/state?token=" + encodeURIComponent(A.token) + "&id=" + id);
  const seats = (full.body.duel as { players: { name: string; bot?: boolean }[] }).players;
  must(seats.length === 4, "four chairs");
  must(seats.filter((x) => x.bot).length === 3, "three of them his: " + JSON.stringify(seats));
  must(seats[0].name === A.name && !seats[0].bot, "and the host in the first");
  must((full.body.duel as { pot: number }).pot === 16, "the pot is every chair: " +
    (full.body.duel as { pot: number }).pot);
  must((await post("/duel/call", { token: A.token, id })).status === 409, "a full table has no chair left");

  // one yes and it deals; the player is up against three cards, not one
  const beforeA = await bal(A.token);
  const done = await post("/duel/confirm", { token: A.token, id });
  const d = done.body.duel as Record<string, unknown>;
  must(d.state === "done" && d.reason === "play", "his yeses are already in: " + d.state);
  const hands = d.hands as { name: string; card: string }[];
  must(hands.length === 4, "four cards are cut: " + JSON.stringify(hands));
  const paid = d.paid as { name: string; amount: number }[];
  must(paid.length === 1, "one of the four takes it");
  const want4 = Math.floor(16 * HOUSE * 100) / 100;
  must(paid[0].amount === want4, "the four chairs less the edge: " + paid[0].amount + " wanted " + want4);
  const afterA = await bal(A.token);
  if (d.winner === A.name) must(afterA === money(beforeA + want4), "the player took it: " + beforeA + " -> " + afterA);
  else {
    must(d.winner === "tung", "otherwise it is his: " + d.winner);
    must(afterA === beforeA, "and nothing comes back: " + beforeA + " -> " + afterA);
  }
  // reading it again must not pay again
  await Promise.all(new Array(6).fill(0).map(() =>
    j("/duel/state?token=" + encodeURIComponent(A.token) + "&id=" + id)
  ));
  must((await bal(A.token)) === afterA, "a table of three tungs still settles exactly once");
}

// ---------------------------------------------------------------------------
// Every cut, whoever takes it, moves exactly the right money. The odds
// themselves are cutDealFor's and are covered in scripts/test-duel.ts — what is
// new here is the till: a win pays the pot less the edge, a loss pays nothing,
// and the edge is never rounded away.
//
// Opening a table is churn-capped per account, so the two of them take turns
// hosting to stay well inside it.
{
  await fund(A, 5000); await fund(B, 5000);
  const want = Math.floor(20 * HOUSE * 100) / 100;   // two chairs at 10, less the edge
  must(want < 20, "the edge must actually be taken: " + want);
  let wins = 0;
  const ROUNDS = 16;
  for (let i = 0; i < ROUNDS; i++) {
    const host = i % 2 ? B : A;
    const before = await bal(host.token);
    const c = await post("/duel/create", { token: host.token, game: "cut", bet: 10, seats: 2 });
    must(c.body?.ok === true, "create failed on cut " + i + ": " + JSON.stringify(c.body));
    const id = (c.body.duel as { id: string }).id;
    must((await post("/duel/call", { token: host.token, id })).body?.ok === true, "he must come every time");
    must((await bal(host.token)) === money(before - 10), "the stake leaves on the way in");
    const done = await post("/duel/confirm", { token: host.token, id });
    const d = done.body.duel as Record<string, unknown>;
    must(d.state === "done" && d.reason === "play", "every cut resolves on the yes: " + d.state);
    const paid = d.paid as { name: string; amount: number }[];
    must(paid.length === 1, "a cut is never a push: " + JSON.stringify(paid));
    const after = await bal(host.token);
    if (d.winner === host.name) {
      wins++;
      must(paid[0].amount === want, "a win must pay the pot less the edge: " + paid[0].amount);
      must(after === money(before - 10 + want), "into the balance: " + before + " -> " + after);
      must(after < money(before + 10), "and never the full two stakes — that is the edge");
    } else {
      must(d.winner === "tung", "if it is not the player it is tung: " + d.winner);
      must(paid[0].name === "tung", "named as having taken it");
      must(after === money(before - 10), "and the stake simply stays gone: " + before + " -> " + after);
    }
  }
  // the deck is cut, not fixed: over sixteen it cannot be all one way
  must(wins > 0, "tung cannot win every cut");
  must(wins < ROUNDS, "nor can he lose every one");
}

// ---------------------------------------------------------------------------
// every other way out of a table he is sitting at
{
  // taken down while still filling: the player's stake comes home, and no
  // phantom stake of his comes home with it
  await fund(A, 100);
  const c = await post("/duel/create", { token: A.token, game: "cut", bet: 8, seats: 3 });
  const id = (c.body.duel as { id: string }).id;
  must((await post("/duel/call", { token: A.token, id })).body?.ok === true, "he sits at a three-seat table too");
  const mid = await j("/duel/state?token=" + encodeURIComponent(A.token) + "&id=" + id);
  must((mid.body.duel as { state: string }).state === "open", "which is still one chair short");
  must((mid.body.duel as { filled: number }).filled === 2, "with him counted in it");
  must((await bal(A.token)) === 92, "one stake is out");
  const pulled = await post("/duel/cancel", { token: A.token, id });
  must(pulled.body?.ok === true, "the host may still take it down");
  must((await bal(A.token)) === 100, "exactly one stake comes back: " + (await bal(A.token)));
}
{
  // the player never confirms: his table times out like any other
  await fund(A, 100);
  const c = await post("/duel/create", { token: A.token, game: "cut", bet: 9, seats: 2 });
  const id = (c.body.duel as { id: string }).id;
  must((await post("/duel/call", { token: A.token, id })).body?.ok === true, "call failed");
  must((await bal(A.token)) === 91, "staked");
  await sleep(CONFIRM_MS + 500);
  await Promise.all(new Array(8).fill(0).map(() =>
    j("/duel/state?token=" + encodeURIComponent(A.token) + "&id=" + id)
  ));
  const st = await j("/duel/state?token=" + encodeURIComponent(A.token) + "&id=" + id);
  must((st.body.duel as { reason: string }).reason === "unconfirmed", "it must time out: " +
    (st.body.duel as { reason: string }).reason);
  must((await bal(A.token)) === 100, "and hand back exactly one stake, once: " + (await bal(A.token)));
}

// ---------------------------------------------------------------------------
// a three-hander: two players and tung, and the pot is all three chairs
{
  await fund(A, 100); await fund(B, 100);
  const c = await post("/duel/create", { token: A.token, game: "cut", bet: 6, seats: 3 });
  const id = (c.body.duel as { id: string }).id;
  must((await post("/duel/join", { token: B.token, id })).body?.ok === true, "B sits down");
  const called = await post("/duel/call", { token: A.token, id });
  must(called.body?.ok === true, "and tung takes the last chair: " + JSON.stringify(called.body));
  const v = called.body.duel as Record<string, unknown>;
  must(v.state === "confirm" && v.filled === 3, "which fills it: " + v.state + " " + v.filled);
  must(v.pot === 18, "the pot is every chair, his included: " + v.pot);
  const beforeA = await bal(A.token), beforeB = await bal(B.token);
  await post("/duel/confirm", { token: A.token, id });
  const done = await post("/duel/confirm", { token: B.token, id });
  const d = done.body.duel as Record<string, unknown>;
  must(d.state === "done", "two yeses and his own start the deal: " + d.state);
  const paid = d.paid as { name: string; amount: number }[];
  must(paid.length === 1, "a cut always has exactly one winner: " + JSON.stringify(paid));
  const want = Math.floor(18 * HOUSE * 100) / 100;
  must(paid[0].amount === want, "who takes the three chairs less the edge: " + paid[0].amount + " wanted " + want);
  const afterA = await bal(A.token), afterB = await bal(B.token);
  if (d.winner === A.name) must(afterA === money(beforeA + want) && afterB === beforeB, "A took it");
  else if (d.winner === B.name) must(afterB === money(beforeB + want) && afterA === beforeA, "B took it");
  else {
    must(d.winner === "tung", "otherwise it is his: " + d.winner);
    must(afterA === beforeA && afterB === beforeB, "and neither player is paid a thing");
  }
}

console.log(
  "call tung: he comes to a cut and only a cut, to the host's own table, one chair per call and " +
    "as many calls as there are empty chairs, already confirmed; each chair counts toward the pot " +
    "without staking an account that does not exist; " +
    "a table he sits at pays the house edge where a table between players pays none; and every " +
    "exit — his win, the player's, a cancel, a table nobody confirmed — moves exactly one stake, " +
    "exactly once",
);
