#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read
// The road and the till must quote the same number.
//
// Beef's payout has always run at the house's 0.1% edge (HOUSE / survival^step).
// The client drew its own road from its own copy of the odds and its own house
// constant, and that constant had been left at 0.99 — a 1% edge — so every rung
// on the road under-quoted what the player was actually paid. Two copies of one
// rule is the bug; there is one copy now, and the server hands it over.
//
//   ADMIN_KEY=devadminkey deno run --allow-net --allow-env --unstable-kv server.ts
//   ADMIN_KEY=devadminkey API=... deno run --allow-net --allow-env --allow-read scripts/test-beef-ladder.ts

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const API = (Deno.env.get("API") || "http://127.0.0.1:8000").replace(/\/$/, "");
const ADMIN = Deno.env.get("ADMIN_KEY") || "devadminkey";
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

// ---- source: the client must not hold a house constant or a copy of the odds
const casino = await Deno.readTextFile(`${ROOT}/assets/js/shrine/casino.js`);
const beef = casino.slice(casino.indexOf("function viewBeef()"), casino.indexOf("THE PIT (player vs player)"));
must(beef.length > 0, "could not find the beef client");
must(!/0\.99[^9]/.test(beef), "the beef client must not carry a house constant of its own");
must(!/easy:\s*0\.96/.test(beef), "the beef client must not carry its own copy of the survival odds");
must(/build\(LANES,d\.ladder\)/.test(beef), "the road must be built from the server's ladder");

const src = await Deno.readTextFile(`${ROOT}/server.ts`);
must(/function beefLadder\(q: number, lanes: number\): number\[\]/.test(src),
  "the server must publish the ladder it pays");
must(/rungs\.push\(beefMult\(q, i\)\)/.test(src),
  "and must build it with the very function that decides the payout");
must(/const HOUSE = 0\.999;/.test(src), "beef pays at the house's 0.1% edge, like every other table");

// ---- live: every rung is HOUSE/q^lane, and walking to one pays that rung
async function member() {
  const n = "beef" + Math.random().toString(36).slice(2, 8);
  const a = await post("/apply", { username: n, application: "beef ladder" });
  const token = a.body.token as string;
  must(!!token, "apply failed");
  const pend = await j("/admin/pending?key=" + encodeURIComponent(ADMIN));
  const id = (pend.body.pending as { username: string; id: string }[] || []).find((x) => x.username === n)?.id;
  must(!!id, "not pending");
  must(!!(await post("/admin/decide", { key: ADMIN, id, action: "approve" })).body?.ok, "approve failed");
  must(!!(await post("/admin/setbal", { key: ADMIN, id, balance: 100000 })).body?.ok, "setbal failed");
  return token;
}
const token = await member();
const ODDS: Record<string, number> = { easy: 0.96, medium: 0.92, hard: 0.85, daredevil: 0.75 };

for (const [diff, q] of Object.entries(ODDS)) {
  const s = await post("/cas/beef/start", { token, bet: 1, difficulty: diff });
  must(s.body?.ok === true, "could not start beef on " + diff + ": " + JSON.stringify(s.body));
  const ladder = s.body.ladder as number[];
  const lanes = s.body.lanes as number;
  must(Array.isArray(ladder) && ladder.length === lanes,
    "the ladder must carry one rung per lane: " + JSON.stringify(ladder));
  for (let i = 1; i <= lanes; i++) {
    const want = Math.round((HOUSE / Math.pow(q, i)) * 100) / 100;
    must(ladder[i - 1] === want,
      `${diff} lane ${i}: road says ${ladder[i - 1]}, the 0.1% edge says ${want}`);
    // and the old 1% road really was a different number, or this test proves nothing
    const oldRoad = Math.round((0.99 / Math.pow(q, i)) * 100) / 100;
    if (i >= 3) must(ladder[i - 1] !== oldRoad || want === oldRoad,
      `${diff} lane ${i} must not still read as the 1% road`);
  }
  must(s.body.nextMultiplier === ladder[0], "the panel's first step must be the first rung");
  await post("/cas/beef/cashout", { token });
}

// the rung a player stops on is the multiplier the till uses, and the payout is
// the stake times that multiplier — road, panel and money all one number
let checked = 0;
for (let attempt = 0; attempt < 60 && checked < 3; attempt++) {
  const s = await post("/cas/beef/start", { token, bet: 100, difficulty: "easy" });
  const ladder = s.body.ladder as number[];
  let step = 0, dead = false;
  for (let k = 0; k < 4 && !dead; k++) {
    const r = await post("/cas/beef/step", { token });
    if (r.body.state === "dead") { dead = true; break; }
    step = r.body.step as number;
    must(r.body.multiplier === ladder[step - 1],
      "the panel must read the same rung as the road: " + r.body.multiplier + " vs " + ladder[step - 1]);
  }
  if (dead || step < 1) continue;
  const before = Number((await j("/cas/me?token=" + encodeURIComponent(token))).body.balance);
  const c = await post("/cas/beef/cashout", { token });
  must(c.body?.ok === true, "cashout failed: " + JSON.stringify(c.body));
  must(c.body.multiplier === ladder[step - 1],
    "the till must pay the rung the road quoted: " + c.body.multiplier + " vs " + ladder[step - 1]);
  const after = Number((await j("/cas/me?token=" + encodeURIComponent(token))).body.balance);
  must(Math.round((after - before) * 100) / 100 === c.body.payout,
    "and the balance must move by exactly that payout");
  // the payout is floored off the EXACT multiplier, so it can be a hair under
  // the 2dp rung but never over it — that is the edge, and it never rounds away
  must((c.body.payout as number) <= Math.round(100 * (ladder[step - 1] as number) * 100) / 100 + 1e-9,
    "a payout may never exceed the quoted rung: " + c.body.payout);
  checked++;
}
must(checked === 3, "could not get three clean walks to check");

console.log(
  "beef: the road is the server's own ladder, every rung is the 0.1% edge the till " +
    "actually pays, the panel and the cashout agree with it, and the client no longer " +
    "carries a house constant or a copy of the odds to drift out of step",
);
