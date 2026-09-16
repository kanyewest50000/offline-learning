#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read
// The Bank of Sahur Sahur Sahur.
//
// Borrow up to your cap and you owe the loan plus ten percent. Pay it back, or
// the bank takes half of every faucet claim until it is square. What matters is
// that neither half of that can go wrong with money: a loan and the sahurs it
// hands over are one commit, a claim pays the player and the debt in one commit,
// and the last claim of a loan hands back the remainder instead of overpaying.
//
//   ADMIN_KEY=devadminkey FAUCET_INTERVAL... (the faucet clock is fixed at 2h,
//   so the garnish is exercised by setting the debt up and claiming once)
//   ADMIN_KEY=devadminkey API=... deno run --allow-net --allow-env --allow-read scripts/test-bank.ts

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const API = (Deno.env.get("API") || "http://127.0.0.1:8000").replace(/\/$/, "");
const ADMIN = Deno.env.get("ADMIN_KEY") || "devadminkey";
const INTEREST = 0.10;
// the house cap, which the source is checked against below so this file and
// server.ts cannot drift apart silently.
const DEFAULT_CAP = 25;

function must(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}
async function j(path: string, opt?: RequestInit) {
  const r = await fetch(API + path, opt);
  return { status: r.status, body: await r.json().catch(() => ({})) as Record<string, unknown> };
}
const post = (path: string, obj: unknown) =>
  j(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(obj) });
const money = (n: number) => Math.round(n * 100) / 100;

// ---- source: the two commits that must never come apart
const src = await Deno.readTextFile(`${ROOT}/server.ts`);
must(/\.check\(loanE\)\.check\(cur\)[\s\S]{0,400}?\.set\(\["loan", u\.id\][\s\S]{0,200}?\.set\(\["cas", u\.id\]/.test(src),
  "a loan and the sahurs it hands over must be written in one commit");
must(/const loanE = await kv\.get<Loan>\(\["loan", u\.id\]\);[\s\S]{0,1200}?kv\.atomic\(\)\.check\(cur\)\.check\(loanE\)/.test(src),
  "a claim must read and write the debt in the same commit as the balance");
must(/const take = owed > 0 \? Math\.min\(round2\(FAUCET_AMOUNT \* LOAN_GARNISH\), owed\) : 0;/.test(src),
  "the garnish must never take more than is still owed");
must(/return Math\.ceil\(amount \* \(1 \+ LOAN_INTEREST\) \* 100 - 1e-9\) \/ 100;/.test(src),
  "interest must round up (so a small loan is not free) but through an epsilon, " +
    "or binary floating point charges a penny that is not interest");
must(src.includes("const LOAN_MAX_DEFAULT = " + DEFAULT_CAP + ";"),
  "this test is written against a house cap of " + DEFAULT_CAP + " — server.ts says otherwise");
// the one-off has to come off in the SAME commit that writes the loan, or two
// borrows racing could both lean on it.
must(/\.check\(loanE\)\.check\(cur\)\.check\(boostE\)/.test(src),
  "a borrow must check the one-off in the same commit it writes the loan");
must(/if \(boostE\.value !== null\) op\.delete\(\["loanboost", u\.id\]\);/.test(src),
  "and spend it there, not in a second write that could be lost");

async function member(tag: string) {
  const n = tag + Math.random().toString(36).slice(2, 8);
  const a = await post("/apply", { username: n, application: "the bank" });
  const token = a.body.token as string;
  must(!!token, "apply failed");
  const pend = await j("/admin/pending?key=" + encodeURIComponent(ADMIN));
  const id = (pend.body.pending as { username: string; id: string }[] || []).find((x) => x.username === n)?.id;
  must(!!id, "not pending");
  must(!!(await post("/admin/decide", { key: ADMIN, id, action: "approve" })).body?.ok, "approve failed");
  return { name: n, token, id: id as string };
}
const fund = async (m: { id: string }, n: number) =>
  must(!!(await post("/admin/setbal", { key: ADMIN, id: m.id, balance: n })).body?.ok, "setbal failed");
const bal = async (t: string) => money((await j("/cas/me?token=" + encodeURIComponent(t))).body.balance as number);
const bank = async (t: string) => (await j("/bank?token=" + encodeURIComponent(t))).body;

const A = await member("bkA");

// ---------------------------------------------------------------------------
// the counter: a default cap of twenty-five, no one-off, nothing owed
{
  const d = await bank(A.token);
  must(d.ok === true, "the bank must answer: " + JSON.stringify(d));
  must(d.cap === DEFAULT_CAP, "the house cap is " + DEFAULT_CAP + " sahurs: " + d.cap);
  must(d.boost === 0 && d.limit === DEFAULT_CAP,
    "and nothing extra on top of it: " + JSON.stringify(d));
  must(d.owed === 0 && d.principal === 0, "a new member owes nothing");
  must(d.canBorrow === DEFAULT_CAP, "and may take the lot: " + d.canBorrow);
  must(d.interest === INTEREST, "ten percent on top: " + d.interest);
}

// ---------------------------------------------------------------------------
// borrowing: the money lands, the debt is the loan plus ten percent
{
  await fund(A, 0);
  const got = await post("/bank/borrow", { token: A.token, amount: 10 });
  must(got.body?.ok === true, "borrow failed: " + JSON.stringify(got.body));
  must(got.body.borrowed === 10, "ten out");
  must(got.body.owed === 11, "eleven owed: " + got.body.owed);
  must((await bal(A.token)) === 10, "and ten in hand: " + (await bal(A.token)));
  const d = await bank(A.token);
  must(d.owed === 11 && d.principal === 10, "the counter agrees: " + JSON.stringify(d));
  must(d.canBorrow === 0, "and will not lend again while it stands");
  // one debt at a time
  const again = await post("/bank/borrow", { token: A.token, amount: 1 });
  must(again.status === 409, "a second loan must be refused: " + again.status);
  must((await bal(A.token)) === 10, "and must not have paid out");
}

// ---------------------------------------------------------------------------
// repaying: part, then the rest
{
  const part = await post("/bank/repay", { token: A.token, amount: 4 });
  must(part.body?.ok === true, "part payment failed: " + JSON.stringify(part.body));
  must(part.body.paid === 4 && part.body.owed === 7, "four off eleven leaves seven: " + JSON.stringify(part.body));
  must((await bal(A.token)) === 6, "and comes off the balance: " + (await bal(A.token)));
  // you cannot pay what you do not have
  const broke = await post("/bank/repay", { token: A.token, amount: 100 });
  must(broke.status === 402, "overpaying from an empty pocket must be refused: " + broke.status);
  must((await bal(A.token)) === 6, "and must cost nothing");
  // the rest, with no amount named
  await fund(A, 20);
  const rest = await post("/bank/repay", { token: A.token });
  must(rest.body?.ok === true, "settling failed: " + JSON.stringify(rest.body));
  must(rest.body.paid === 7 && rest.body.owed === 0 && rest.body.cleared === true,
    "the rest clears it: " + JSON.stringify(rest.body));
  must((await bal(A.token)) === 13, "twenty less seven: " + (await bal(A.token)));
  must((await post("/bank/repay", { token: A.token })).status === 409, "nothing left to repay");
  // and the bank will lend again
  must((await bank(A.token)).canBorrow === DEFAULT_CAP, "a settled member may borrow again");
}

// ---------------------------------------------------------------------------
// THE GARNISH. A claim pays the player half and the bank the other half, and
// the debt comes down by exactly what the player did not get.
{
  const B = await member("bkB");
  await fund(B, 0);
  must((await post("/bank/borrow", { token: B.token, amount: 10 })).body?.owed === 11, "borrow failed");
  const before = await bal(B.token);
  const claim = await post("/cas/claim", { token: B.token });
  must(claim.body?.ok === true, "the faucet must still pour: " + JSON.stringify(claim.body));
  const faucet = Number(claim.body.faucet);
  must(faucet === 10, "the faucet is ten: " + faucet);
  must(claim.body.garnished === 5, "the bank takes half: " + claim.body.garnished);
  must(claim.body.claimed === 5, "the player gets the other half: " + claim.body.claimed);
  must(claim.body.owed === 6, "and the debt comes down by the half: " + claim.body.owed);
  must((await bal(B.token)) === money(before + 5), "only the half reaches the balance");
  must((await bank(B.token)).owed === 6, "the counter agrees: " + JSON.stringify(await bank(B.token)));
  must(claim.body.cleared === false, "six still standing is not cleared");
}

// ---------------------------------------------------------------------------
// the LAST claim of a loan hands back the remainder rather than overpaying it
{
  const C = await member("bkC");
  await fund(C, 0);
  // a small loan: owed 2.20, so one garnish of 5 would be more than is owed
  must((await post("/bank/borrow", { token: C.token, amount: 2 })).body?.owed === 2.2,
    "two at ten percent is 2.20");
  const claim = await post("/cas/claim", { token: C.token });
  must(claim.body?.ok === true, "claim failed");
  must(claim.body.garnished === 2.2, "the bank takes only what it is owed: " + claim.body.garnished);
  must(claim.body.claimed === 7.8, "and the player keeps the rest of the ten: " + claim.body.claimed);
  must(claim.body.owed === 0 && claim.body.cleared === true, "which squares it: " + JSON.stringify(claim.body));
  must((await bal(C.token)) === 9.8, "two borrowed plus 7.80 claimed: " + (await bal(C.token)));
  must((await bank(C.token)).owed === 0, "and the bank is done with them");
}

// ---------------------------------------------------------------------------
// a claim with no debt is the whole faucet, exactly as before
{
  const D = await member("bkD");
  await fund(D, 0);
  const claim = await post("/cas/claim", { token: D.token });
  must(claim.body.claimed === 10 && claim.body.garnished === 0,
    "no debt, no cut: " + JSON.stringify(claim.body));
  must((await bal(D.token)) === 10, "the whole ten lands");
}

// ---------------------------------------------------------------------------
// the cap: the house default, a personal one, and nought meaning shut
{
  const E = await member("bkE");
  await fund(E, 0);
  must((await post("/bank/borrow", { token: E.token, amount: DEFAULT_CAP + 1 })).status === 400,
    "over the cap must be refused");
  must((await bal(E.token)) === 0, "and must pay out nothing");

  must(!!(await post("/admin/loanmax", { key: ADMIN, id: E.id, max: 50 })).body?.ok, "raising the cap failed");
  must((await bank(E.token)).cap === 50, "the member sees the new cap");
  const big = await post("/bank/borrow", { token: E.token, amount: 50 });
  must(big.body?.ok === true && big.body.owed === 55, "fifty at ten percent is fifty-five: " + JSON.stringify(big.body));
  must((await bal(E.token)) === 50, "and fifty lands");
  await post("/bank/repay", { token: E.token, amount: 55 });

  // nought shuts the bank to them
  must(!!(await post("/admin/loanmax", { key: ADMIN, id: E.id, max: 0 })).body?.ok, "shutting failed");
  must((await bank(E.token)).cap === 0, "the counter says shut");
  must((await post("/bank/borrow", { token: E.token, amount: 1 })).status === 403,
    "and it must refuse to lend");

  // clearing the override puts them back on the house default
  const back = await post("/admin/loanmax", { key: ADMIN, id: E.id, max: null });
  must(back.body?.loanMax === DEFAULT_CAP && back.body?.loanMaxSet === false,
    "clearing must restore the default, not pin it: " + JSON.stringify(back.body));
  must((await bank(E.token)).cap === DEFAULT_CAP, "and the member is back on the house cap");

  must((await post("/admin/loanmax", { id: E.id, max: 5 })).status === 403, "the cap needs the admin key");
}

// ---------------------------------------------------------------------------
// THE ONE-OFF. The second way tung can raise what the bank will lend, and the
// whole point of it is that it does not behave like the first: it sits on top
// of the standing cap, it is spent by taking a loan at all rather than by the
// part of the loan that leaned on it, and the cap underneath is exactly where
// it was afterwards. A favour that quietly became a new ceiling would be the
// permanent one with extra steps.
{
  const H = await member("bkH");
  await fund(H, 0);
  // before the favour, the standing cap is the whole story
  must((await post("/bank/borrow", { token: H.token, amount: 40 })).status === 400,
    "over the cap must be refused before any one-off");

  const grant = await post("/admin/loanboost", { key: ADMIN, id: H.id, extra: 20 });
  must(grant.body?.ok === true && grant.body.boost === 20 && grant.body.limit === DEFAULT_CAP + 20,
    "granting the one-off failed: " + JSON.stringify(grant.body));
  const d = await bank(H.token);
  must(d.cap === DEFAULT_CAP && d.boost === 20 && d.limit === DEFAULT_CAP + 20,
    "the cap and the one-off must be reported apart: " + JSON.stringify(d));
  must(d.canBorrow === DEFAULT_CAP + 20, "and the two together are what he will hand over");
  must((await post("/bank/borrow", { token: H.token, amount: DEFAULT_CAP + 21 })).status === 400,
    "over cap-plus-one-off must still be refused");

  const big = await post("/bank/borrow", { token: H.token, amount: 40 });
  must(big.body?.ok === true && big.body.spentBoost === 20,
    "the loan must spend the one-off: " + JSON.stringify(big.body));
  must((await bal(H.token)) === 40, "and forty must land: " + (await bal(H.token)));
  await fund(H, 100);
  await post("/bank/repay", { token: H.token });
  const after = await bank(H.token);
  must(after.cap === DEFAULT_CAP && after.boost === 0 && after.limit === DEFAULT_CAP,
    "the favour is gone and the cap has not moved: " + JSON.stringify(after));
  must((await post("/bank/borrow", { token: H.token, amount: 40 })).status === 400,
    "so forty is over the line again");

  // spent by the act of borrowing, not by the part of it that needed the room
  const I = await member("bkI");
  await fund(I, 0);
  await post("/admin/loanboost", { key: ADMIN, id: I.id, extra: 15 });
  must((await post("/bank/borrow", { token: I.token, amount: 1 })).body?.spentBoost === 15,
    "one loan spends it, however small the loan");
  await fund(I, 10);
  await post("/bank/repay", { token: I.token });
  must((await bank(I.token)).boost === 0, "so it is not still sitting there afterwards");

  // taking an unspent one back, and the key it takes to hand one out
  const J = await member("bkJ");
  await post("/admin/loanboost", { key: ADMIN, id: J.id, extra: 12 });
  must((await bank(J.token)).limit === DEFAULT_CAP + 12, "the one-off is on");
  must((await post("/admin/loanboost", { key: ADMIN, id: J.id, extra: 0 })).body?.boost === 0,
    "taking an unspent one back failed");
  must((await bank(J.token)).limit === DEFAULT_CAP, "and the limit is the bare cap again");
  must((await post("/admin/loanboost", { id: J.id, extra: 5 })).status === 403,
    "a one-off needs the admin key");
  must((await post("/admin/loanboost", { key: ADMIN, id: "nosuchid", extra: 5 })).status === 404,
    "an unknown id is 404");
  must((await post("/admin/loanboost", { key: ADMIN, id: J.id, extra: -1 })).status === 400,
    "a negative one-off is refused");

  // it rides on a personal cap too, not only the house one — and the pane sees both
  const K = await member("bkK");
  await fund(K, 1);
  await post("/admin/loanmax", { key: ADMIN, id: K.id, max: 5 });
  await post("/admin/loanboost", { key: ADMIN, id: K.id, extra: 3 });
  const kd = await bank(K.token);
  must(kd.cap === 5 && kd.boost === 3 && kd.limit === 8,
    "a one-off sits on the personal cap, not the house one: " + JSON.stringify(kd));
  const krows = (await j("/admin/balances?key=" + encodeURIComponent(ADMIN))).body;
  const krow = (krows.balances as { id: string; loanMax: number; loanBoost: number; loanLimit: number }[])
    .find((x) => x.id === K.id);
  must(!!krow && krow.loanMax === 5 && krow.loanBoost === 3 && krow.loanLimit === 8,
    "the balances pane must show the cap and the one-off apart: " + JSON.stringify(krow));

  // and six borrows racing must not all lean on the same one-off
  const L = await member("bkL");
  await fund(L, 0);
  await post("/admin/loanboost", { key: ADMIN, id: L.id, extra: 20 });
  const race = await Promise.all(new Array(6).fill(0).map(() =>
    post("/bank/borrow", { token: L.token, amount: 40 })
  ));
  must(race.filter((x) => x.body?.ok === true).length === 1,
    "exactly one of six may win the one-off");
  must((await bal(L.token)) === 40, "and it pays out exactly once: " + (await bal(L.token)));
  must((await bank(L.token)).boost === 0, "with the one-off spent");
}

// ---------------------------------------------------------------------------
// the admin balances pane can see the debt and the cap
{
  const F = await member("bkF");
  await fund(F, 1);
  await post("/bank/borrow", { token: F.token, amount: 3 });
  await post("/admin/loanmax", { key: ADMIN, id: F.id, max: 7 });
  const rows = (await j("/admin/balances?key=" + encodeURIComponent(ADMIN))).body;
  must(rows.loanMaxDefault === DEFAULT_CAP, "the pane must know the house default");
  const row = (rows.balances as { id: string; owed: number; loanMax: number; loanMaxSet: boolean }[])
    .find((x) => x.id === F.id);
  must(!!row, "the member must be listed");
  must(row!.owed === 3.3, "with what they owe: " + row!.owed);
  must(row!.loanMax === 7 && row!.loanMaxSet === true, "and their own cap: " + JSON.stringify(row));
}

// ---------------------------------------------------------------------------
// nonsense is refused, and a borrow race cannot write two loans
{
  const G = await member("bkG");
  await fund(G, 0);
  for (const bad of [0, -5, "abc", null]) {
    const r = await post("/bank/borrow", { token: G.token, amount: bad });
    must(r.status === 400, "a borrow of " + JSON.stringify(bad) + " must be refused: " + r.status);
  }
  must((await bal(G.token)) === 0, "and none of them may pay out");
  const race = await Promise.all(new Array(6).fill(0).map(() =>
    post("/bank/borrow", { token: G.token, amount: 10 })
  ));
  const won = race.filter((x) => x.body?.ok === true);
  must(won.length === 1, "six at once must write exactly one loan, got " + won.length);
  must((await bal(G.token)) === 10, "and pay out exactly once: " + (await bal(G.token)));
  must((await bank(G.token)).owed === 11, "with one debt on the books");
}

// ---------------------------------------------------------------------------
// A one-off also suspends the settle-up rule. Raising somebody's ceiling "just
// this once" is aimed squarely at a member already in the red, and is no use to
// them if the bank still tells them to clear the last one first — so the one-off
// buys the second loan as well as the room for it.
{
  const K = await member("bankK");
  const first = await post("/bank/borrow", { token: K.token, amount: 10 });
  must(first.body?.ok === true, "the first loan must go through: " + JSON.stringify(first.body));
  must((await post("/bank/borrow", { token: K.token, amount: 1 })).body?.error === "settle the last one first.",
    "in debt with no one-off, a second loan is refused");
  must((await bank(K.token)).canBorrow === 0, "and the bank offers nothing more");

  await post("/admin/loanboost", { key: ADMIN, id: K.id, extra: 10 });
  const d = await bank(K.token);
  const num = (v: unknown) => Number(v);
  const room = num(d.canBorrow), limit = num(d.limit), principal = num(d.principal);
  must(room > 0, "a one-off must open the bank to somebody already in debt");
  must(Math.abs(room - (limit - principal)) < 1e-9,
    "and offer exactly the room left under the stretched ceiling: " + JSON.stringify(d));

  // the ceiling is on everything outstanding at once, not on each loan apart
  must(/room left/.test(String((await post("/bank/borrow", { token: K.token, amount: room + 1 })).body?.error)),
    "more than the room left must be refused even while under the ceiling");

  const owedBefore = num(d.owed);
  const second = await post("/bank/borrow", { token: K.token, amount: room });
  must(second.body?.ok === true, "the second loan must go through: " + JSON.stringify(second.body));
  const after = await bank(K.token);
  must(Math.abs(num(after.principal) - (principal + room)) < 1e-9,
    "the principal must STACK, not replace: " + principal + " -> " + num(after.principal));
  must(num(after.owed) > owedBefore,
    "and so must the debt — a second loan must never wipe the first: " + owedBefore + " -> " + num(after.owed));
  must(num(after.boost) === 0, "the one-off is spent by taking it");
  must((await post("/bank/borrow", { token: K.token, amount: 1 })).body?.error === "settle the last one first.",
    "and once it is spent the settle-up rule is back");
}

console.log(
  "the bank: lends up to a cap (" + DEFAULT_CAP + " by default, per-member override, nought to shut it, " +
    "plus a one-off raise that is spent by the next loan and leaves the cap where it was), " +
    "charges ten percent once at signing, takes repayment in part or in full, and garnishes " +
    "half of every faucet claim until square — never more than is owed, never paying the " +
    "player without paying the debt, and writing one debt per borrower that a one-off may " +
    "add to while they are still in it, up to the stretched ceiling and never past it",
);
