// Shrine of Tung backend — HTTP-polling chat with history + application auth.
// Storage: Deno KV (persistent, free on Deno Deploy). No WebSockets.
//
// Set these in the Deno Deploy dashboard (Settings -> Environment Variables):
//   SHOP_WEBHOOK_URL         where shop redemptions are posted (optional)
//   APPLICATION_WEBHOOK_URL  where new applications are posted (optional)
//   ADMIN_KEY                password for the /admin page (required to approve)
//   WISDOM_MIN_MS/_MAX_MS    gap between two Wisdoms of Tung (optional, 45m/2h)
//   WISDOM_GIFT_CHANCE       odds a wisdom is a giveaway instead (optional, 0.2)
//   WISDOM_GIFT_AMOUNT       sahurs a giveaway pays the first claimant (optional, 50)
//   PROXY_URL                where the web veil actually goes (optional)
//
// Endpoints (JSON, CORS-open):
//   POST /apply         {username, application}          -> {token, status}
//   POST /login         {token}                          -> {token, status, username}
//   GET  /status?token=                                   -> {status, username}
//   GET  /events?since=&token=                            -> {events, cursor}
//   POST /send          {token, id, text, reply}          -> {ok, ts}
//   POST /react         {token, id, e, op, eid}           -> {ok}
//   GET  /tip/profile?token=&user=                        -> {username, createdAt, balance}
//   POST /tip           {token, to, amount}               -> {ok, amount, fromBalance, toBalance, to}
//   GET  /admin                                           -> admin page (html)
//   GET  /admin/pending?key=                              -> {pending:[...]}
//   GET  /admin/chat?key=                                 -> {messages:[...]} last HISTORY chat lines
//   POST /admin/clearchat {key}                           -> {ok, cleared}
//   POST /admin/decide  {key, id, action:"approve"|"reject"} -> {ok, status}
//   GET  /veil?token=                                     -> {live, allowed, url?}
//   POST /gift/claim    {token, id}                       -> {ok, amount, balance, by}
//   GET  /duel/list?token=                                -> {open:[...], mine, balance}
//   POST /duel/create   {token, game, bet, seats?}        -> {ok, duel, balance}
//   POST /duel/cancel   {token, id}                       -> {ok, refunded, balance}
//   POST /duel/join     {token, id}                       -> {ok, duel, balance}
//   POST /duel/confirm  {token, id}                       -> {ok, duel, balance}
//   POST /duel/move     {token, id, move}                 -> {ok, duel, balance}
//   GET  /duel/state?token=&id=                           -> {ok, duel, balance}
//   GET  /admin/veil?key=                                 -> {live, configured}
//   POST /admin/veil    {key, live}                       -> {ok, live, configured}
//   POST /admin/veiluser {key, id, allowed}               -> {ok, veil}

// Deno.openKv() with no argument keeps its database in a per-location cache
// directory, which means every run on one machine shares it. SHRINE_KV_PATH
// lets a test run point at a file of its own so one run cannot inherit the
// last one's chat history, wisdom clock or balances. Unset in production, where
// Deno Deploy provides the database.
const kv = await Deno.openKv(Deno.env.get("SHRINE_KV_PATH") || undefined);
// Two separate Discord webhooks so redemptions and applications land in their
// own channels. Either can be unset; that kind of notification just goes quiet.
const SHOP_WEBHOOK = Deno.env.get("SHOP_WEBHOOK_URL") || "";
const APPLICATION_WEBHOOK = Deno.env.get("APPLICATION_WEBHOOK_URL") || "";
const ADMIN_KEY = Deno.env.get("ADMIN_KEY") || "";
// Where the web veil goes once it is opened. Kept in the environment rather
// than in the static repo so the destination is not sitting in public source,
// and handed to a member only when the global switch AND that member's own
// veil flag are both on.
const PROXY_URL = Deno.env.get("PROXY_URL") || "";
const HISTORY = 500; // number of recent events retained (hard cap)
const OPEN_MSGS = 100; // a fresh /events?since=0 only ships this many chat lines
const MSG_MAX = 3; // chat messages one account may post
const MSG_WINDOW_MS = 6000; // ...within this window, before /send starts refusing

// gn-math HTML loaders live on GitHub Pages at games/g/, pinned to
// 9b343737669dd2067dd6cd731859a99008772388 (see scripts/refresh-games.sh).
// GET /g/ used to re-proxy those pages through Deno and is gone so scrapers
// cannot burn quota. This process does not serve the static repo.
const TTL_MS = 14 * 24 * 60 * 60 * 1000; // messages auto-expire after 2 weeks

// ---------------------------------------------------------------------------
// Tung's Casino — FUN-MONEY ONLY. "Sahurs" have no cash value, cannot be bought,
// and cannot be cashed out. Sahurs normally enter circulation only through the
// Shrine of Sahur faucet (a free claim every 2h). Admins can VIEW balances and,
// as a moderation tool (e.g. resetting an exploiter who found a bug), SET a
// balance to an exact value via /admin/setbal — an explicit, key-gated action.
// Every outcome is decided here on the server with crypto RNG, so nothing about a
// bet, a shuffle, a mine layout, or a crash point is manipulable from the client.
const HOUSE = 0.999;                      // 0.1% house edge baked into fair payouts (blackjack has its own fixed payouts and is unaffected)
const FAUCET_AMOUNT = 10;                 // sahurs per claim
const FAUCET_INTERVAL = 2 * 60 * 60 * 1000; // every 2 hours
const MIN_BET = 0.1;                      // smallest allowed wager
const MAX_BET = 100000;                   // sanity cap
const CAS_TTL = 400 * 24 * 60 * 60 * 1000;   // balances persist ~13 months of inactivity
const GAME_TTL = 6 * 60 * 60 * 1000;      // an abandoned in-progress hand self-expires

// Casino KV key-space (layered on top of the chat key-space above):
//   ["cas", id]        -> {bal, lastClaim}   a user's sahur balance + faucet clock
//   ["bj", id]         -> blackjack hand in progress (deleted when it resolves)
//   ["mines", id]      -> mines board in progress
//   ["beef", id]       -> beef (crash-chicken) walk in progress
//   ["shopitem", itemId] -> {id,name,desc,price,active,ts}  a redeemable shop entry
//   ["shoppend", uid, rid] -> unfinished redeem (paid, still owes an answer)
// One active hand per game per user; starting a new one replaces the old.

// crypto-strong float in [0,1).
// 53 bits of entropy = the top 21 bits of the first word (a[0] >>> 11) used as the
// high half, plus all 32 bits of the second. 21 + 32 = 53, so the numerator is
// always < 2^53 and the quotient lands in [0,1). (Using all 32 bits of a[0] here
// would overflow to ~2^11 and break every game — do not "simplify" this.)
function rnd(): number {
  const a = new Uint32Array(2);
  crypto.getRandomValues(a);
  return ((a[0] >>> 11) * 0x100000000 + a[1]) / 0x20000000000000;
}
function rndInt(n: number): number { return Math.floor(rnd() * n); }
function round2(n: number): number { return Math.round(n * 100) / 100; }
// Payouts are FLOORED, never rounded, and are always computed from the exact
// multiplier rather than the 2dp one shown to the player. Rounding both the
// multiplier and then the payout upward compounds: at the 0.10 minimum stake
// that pushed dice roll-under-94 to a 103% return, i.e. a farmable +EV bet.
// Flooring guarantees the edge can never be rounded away at any stake.
function floor2(n: number): number { return Math.floor(n * 100 + 1e-9) / 100; }
function payoutOf(bet: number, exactMult: number): number { return floor2(bet * exactMult); }

// Look a user-supplied key up in a config map WITHOUT walking the prototype
// chain. Plain `MAP[key]` lets "__proto__" resolve to Object.prototype, which is
// truthy — that slipped past a `if (!cfg)` guard and produced NaN multipliers
// that then corrupted balances. Always route untrusted keys through this.
// deno-lint-ignore no-explicit-any
function pick<T>(map: Record<string, T>, key: any): T | null {
  if (typeof key !== "string" && typeof key !== "number") return null;
  return Object.prototype.hasOwnProperty.call(map, key) ? map[key as string] : null;
}

// bet validation shared by every game. casino callers surface wagerError() so a
// stake under the floor or over the ceiling is named, not dumped as "bad bet".
function readWager(v: unknown): { bet: number } | { error: string } {
  const n = Number(v);
  if (!Number.isFinite(n)) {
    return { error: "tung does not wager ghosts. put a real number on the felt." };
  }
  const b = round2(n);
  if (b < MIN_BET) {
    return { error: "that offering is beneath the altar. the floor is " + MIN_BET.toFixed(1) + " sahurs. tung counted." };
  }
  if (b > MAX_BET) {
    return { error: "even tung tung god has a ceiling. " + MAX_BET + " sahurs is it. sit down." };
  }
  return { bet: b };
}
function wagerError(v: unknown): string {
  const w = readWager(v);
  return "error" in w ? w.error : "tung does not wager ghosts. put a real number on the felt.";
}
function parseBet(v: unknown): number | null {
  const w = readWager(v);
  return "bet" in w ? w.bet : null;
}

// deno-lint-ignore no-explicit-any
async function getCas(id: string): Promise<{ bal: number; lastClaim: number }> {
  const r = await kv.get<{ bal: number; lastClaim: number }>(["cas", id]);
  const v = r.value ?? { bal: 0, lastClaim: 0 };
  // heal a balance that was ever written as NaN/Infinity so it can't linger as
  // an "always solvent" record (see the finite guards in adjustBalance below)
  if (!Number.isFinite(v.bal)) return { bal: 0, lastClaim: Number.isFinite(v.lastClaim) ? v.lastClaim : 0 };
  return v;
}

// Atomic balance change. delta may be negative (a wager). Returns the new balance,
// or null if the balance would go negative (insufficient funds) — the check+commit
// loop makes double-spends from concurrent requests impossible.
async function adjustBalance(id: string, delta: number): Promise<number | null> {
  // A non-finite delta must never reach the store: `NaN < -1e-9` is false, so the
  // overdraw guard below would pass it, and Math.max(0, NaN) is NaN — which reads
  // as permanently solvent and lets a player bet without limit.
  if (!Number.isFinite(delta)) return null;
  for (;;) {
    const cur = await kv.get<{ bal: number; lastClaim: number }>(["cas", id]);
    const rec = cur.value ?? { bal: 0, lastClaim: 0 };
    const base = Number.isFinite(rec.bal) ? rec.bal : 0;
    const nb = round2(base + delta);
    if (!Number.isFinite(nb) || nb < -1e-9) return null; // would overdraw or corrupt
    const res = await kv.atomic().check(cur)
      .set(["cas", id], { ...rec, bal: Math.max(0, nb) }, { expireIn: CAS_TTL }).commit();
    if (res.ok) return Math.max(0, nb);
  }
}

// ---------------------------------------------------------------------------
// Claiming an in-progress game (mines / beef / blackjack).
//
// Every one of those games ends the same way: read the stored hand, work out
// what it pays, delete it, credit the player. Done as three separate steps that
// is a money printer — N requests all read the same live hand, all pass the
// "is there a game?" guard, and all credit the payout, so one 10 sahur bet can
// be cashed out eight times for eight payouts. Measured, before this existed:
// 8 of 8 concurrent cashouts paid, and a blackjack stand paid 120 on a hand
// worth 20.
//
// So the delete and the credit ride in ONE commit, guarded by a check on the
// game entry itself. Whoever commits first takes the record with them; every
// racing duplicate finds its check stale and is told there is no game. These
// two are the ONLY way a game record may be ended — never `kv.delete` a live
// hand next to an `adjustBalance`.
// deno-lint-ignore no-explicit-any
async function claimGame(key: Deno.KvKey, entry: Deno.KvEntryMaybe<any>): Promise<boolean> {
  if (!entry.value) return false;
  return (await kv.atomic().check(entry).delete(key).commit()).ok;
}
// Claim it AND pay it. Returns the new balance, or null if somebody else got
// there first (in which case nothing was written and nothing was paid).
// deno-lint-ignore no-explicit-any
async function settleGame(
  key: Deno.KvKey,
  entry: Deno.KvEntryMaybe<any>,
  uid: string,
  payout: number,
): Promise<number | null> {
  if (!entry.value) return null;
  const pay = Number.isFinite(payout) && payout > 0 ? payout : 0;
  for (;;) {
    const cur = await kv.get<{ bal: number; lastClaim: number }>(["cas", uid]);
    const rec = cur.value ?? { bal: 0, lastClaim: 0 };
    const base = Number.isFinite(rec.bal) ? rec.bal : 0;
    const nb = round2(base + pay);
    if (!Number.isFinite(nb) || nb < 0) return null;
    const res = await kv.atomic()
      .check(entry)
      .check(cur)
      .delete(key)
      .set(["cas", uid], { ...rec, bal: nb }, { expireIn: CAS_TTL })
      .commit();
    if (res.ok) return nb;
    // Two different losses look the same from here, so ask which it was: if the
    // game record has moved, another request has already settled this hand and
    // we must not pay. If only the balance moved, try again.
    const again = await kv.get(key);
    if (again.versionstamp !== entry.versionstamp) return null;
  }
}

// Resolve an approved member by username (case-insensitive). Returns null if the
// name is free, pending, rejected, or otherwise not tippable.
// deno-lint-ignore no-explicit-any
async function findApprovedByUsername(username: string): Promise<any | null> {
  const lower = clip(username, 24).toLowerCase();
  if (!lower) return null;
  const name = await kv.get<string>(["name", lower]);
  if (!name.value) return null;
  // deno-lint-ignore no-explicit-any
  const app = await kv.get<any>(["app", name.value]);
  if (!app.value || app.value.status !== "approved") return null;
  return app.value;
}

// Atomic tip/donation: debit `fromId` and credit `toId` in ONE Deno KV transaction
// so a concurrent double-spend cannot invent sahurs, and a crash mid-transfer cannot
// debit without credit. Optional tipId adds an idempotency lock so retries cannot
// double-pay. Returns new balances, "insufficient", or null for bad amount.
async function transferBalance(
  fromId: string,
  toId: string,
  amount: number,
  tipId?: string,
): Promise<{ from: number; to: number; replay?: boolean } | "insufficient" | null> {
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (fromId === toId) return null;
  const TIP_LOCK_TTL = 7 * 24 * 60 * 60 * 1000;
  for (;;) {
    if (tipId) {
      const lock = await kv.get<{ from: string; to: string; amount: number }>(["tiplock", tipId]);
      if (lock.value) {
        return {
          from: round2((await getCas(fromId)).bal),
          to: round2((await getCas(toId)).bal),
          replay: true,
        };
      }
    }
    const fromCur = await kv.get<{ bal: number; lastClaim: number }>(["cas", fromId]);
    const toCur = await kv.get<{ bal: number; lastClaim: number }>(["cas", toId]);
    const fromRec = fromCur.value ?? { bal: 0, lastClaim: 0 };
    const toRec = toCur.value ?? { bal: 0, lastClaim: 0 };
    const fromBase = Number.isFinite(fromRec.bal) ? fromRec.bal : 0;
    const toBase = Number.isFinite(toRec.bal) ? toRec.bal : 0;
    const fromNb = round2(fromBase - amount);
    const toNb = round2(toBase + amount);
    if (!Number.isFinite(fromNb) || fromNb < -1e-9) return "insufficient";
    if (!Number.isFinite(toNb) || toNb < 0) return null;
    let op = kv.atomic()
      .check(fromCur)
      .check(toCur)
      .set(["cas", fromId], { ...fromRec, bal: Math.max(0, fromNb) }, { expireIn: CAS_TTL })
      .set(["cas", toId], { ...toRec, bal: Math.max(0, toNb) }, { expireIn: CAS_TTL });
    if (tipId) {
      const lock = await kv.get(["tiplock", tipId]);
      op = op.check(lock).set(["tiplock", tipId], {
        from: fromId, to: toId, amount, ts: Date.now(),
      }, { expireIn: TIP_LOCK_TTL });
    }
    const res = await op.commit();
    if (res.ok) return { from: Math.max(0, fromNb), to: Math.max(0, toNb) };
  }
}

// A logged-in, un-blocked casino player. Casino access == chat access: you must be
// an approved member and not currently banned or timed out.
// deno-lint-ignore no-explicit-any
async function casUser(token: unknown): Promise<any | null> {
  const u = await authUser(typeof token === "string" ? token : null);
  if (!u) return null;
  if (blockState(u).blocked) return null;
  return u;
}

// Best-effort webhook post: never blocks the reply, never throws, and no-ops
// when that webhook is unset. Every message we send carries text typed by the
// public, so allowed_mentions is always empty — nothing from here can ping.
function postWebhook(url: string, content: string) {
  if (!url) return;
  fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
  }).catch(() => {});
}

// post a shop redemption to the shop webhook
function notifyRedeem(username: string, item: { name: string; price: number }, input?: string) {
  if (!SHOP_WEBHOOK) return;
  let content = "🛒 **shop redemption**\nuser: **" + username + "**\nitem: **" +
    item.name + "**\ncost: **" + item.price + " sahurs**";
  // whatever the buyer typed rides along verbatim, fenced so its own markdown
  // cannot reshape the message.
  if (input) content += "\ninput:\n```\n" + input.replace(/```/g, "ʼʼʼ") + "\n```";
  postWebhook(SHOP_WEBHOOK, content);
}

type ShopPending = {
  id: string;
  itemId: string;
  name: string;
  price: number;
  inputLabel: string;
  output: string;
  ts: number;
};

async function listShopPending(uid: string): Promise<ShopPending[]> {
  const rows: ShopPending[] = [];
  for await (const e of kv.list<ShopPending>({ prefix: ["shoppend", uid] })) {
    if (e.value) rows.push(e.value);
  }
  rows.sort((a, c) => a.ts - c.ts);
  return rows;
}

// --- card helpers (blackjack) ---
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const SUITS = ["♠", "♥", "♦", "♣"];
function drawCard(): string { return RANKS[rndInt(13)] + SUITS[rndInt(4)]; }
// best hand value treating aces as 11 then dropping to 1 as needed
function handValue(cards: string[]): { total: number; soft: boolean } {
  let total = 0, aces = 0;
  for (const c of cards) {
    const r = c.slice(0, c.length - 1);
    if (r === "A") { aces++; total += 11; }
    else if (r === "K" || r === "Q" || r === "J" || r === "10") total += 10;
    else total += Number(r);
  }
  let soft = aces > 0;
  while (total > 21 && aces > 0) { total -= 10; aces--; soft = aces > 0; }
  return { total, soft };
}

// ---------------------------------------------------------------------------
// The shrine's skins.
//
// Only the ones marked `free` are everybody's. Every other theme is LOCKED to
// everybody until tung puts it in the shop and that member buys it — which is
// the default on purpose: adding a row here ships a theme nobody can wear yet,
// rather than quietly giving it away to the whole shrine.
//
// Ownership lives at ["theme", uid, themeId]. The client is told what it owns
// and never decides for itself; a locked theme it tries to wear anyway is
// simply not in the stylesheet it was served.
const SHRINE_THEMES: { id: string; name: string; note: string; free?: boolean }[] = [
  { id: "wood", name: "Tung’s Wood", note: "the shrine as it was built.", free: true },
  { id: "dark", name: "Dark Mode", note: "the wood, after hours." },
];
function themeById(id: string) {
  return SHRINE_THEMES.find((t) => t.id === id) || null;
}
async function ownsTheme(uid: string, id: string): Promise<boolean> {
  const t = themeById(id);
  if (!t) return false;
  if (t.free) return true;
  return (await kv.get<number>(["theme", uid, id])).value === 1;
}

// roulette: which pockets are red on a European wheel
const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

// beef (crash-chicken) difficulties: per-step SURVIVAL probability + lane cap.
// higher risk => lower survival => steeper multiplier (0.99 / survival^step).
const BEEF: Record<string, { q: number; lanes: number }> = {
  easy: { q: 0.96, lanes: 24 },
  medium: { q: 0.92, lanes: 22 },
  hard: { q: 0.85, lanes: 20 },
  daredevil: { q: 0.75, lanes: 18 },
};

// plinko payout tables (Stake-style), indexed by risk then row count, bucket 0..rows.
// mines fair multiplier after `safe` clean reveals with `count` mines on 25 tiles:
//   HOUSE * C(25,safe) / C(25-count,safe)  ==  HOUSE * Π (25-i)/(25-count-i)
// exact values drive payouts; the round2 wrappers are what the client displays
function minesMultExact(count: number, safe: number): number {
  let m = HOUSE;
  for (let i = 0; i < safe; i++) m *= (25 - i) / (25 - count - i);
  return m;
}
function minesMult(count: number, safe: number): number { return round2(minesMultExact(count, safe)); }
// beef multiplier after surviving `step` lanes at per-step survival prob q
function beefMultExact(q: number, step: number): number { return HOUSE / Math.pow(q, step); }
function beefMult(q: number, step: number): number { return round2(beefMultExact(q, step)); }

// ---- blackjack, played as a list of hands so splitting is just "more hands" ----
// state: { hands:[{cards,bet,done,result,payout}], active, dealer, split, base }
function rankOf(c: string): string { return c.slice(0, c.length - 1); }

// Dealer draws once, after every hand is finished, then each hand is paid on its
// own stake. A two-card 21 only pays 3:2 when the hand was never split — after a
// split it is an ordinary 21, which is the standard rule.
// `entry` is the ["bj", uid] read this request worked from: the hand is claimed
// and paid in one commit, so several stands landing together settle once.
// deno-lint-ignore no-explicit-any
async function bjResolve(uid: string, st: any, entry: Deno.KvEntryMaybe<any>, purse: Purse) {
  const anyAlive = st.hands.some((h: any) => handValue(h.cards).total <= 21);
  if (anyAlive) while (handValue(st.dealer).total < 17) st.dealer.push(drawCard());
  const dv = handValue(st.dealer).total;
  let total = 0;
  for (const h of st.hands) {
    const pv = handValue(h.cards).total;
    if (pv > 21) { h.result = "bust"; h.payout = 0; }
    else if (!st.split && h.cards.length === 2 && pv === 21) { h.result = "blackjack"; h.payout = payoutOf(h.bet, 2.5); }
    else if (dv > 21) { h.result = "dealer_bust"; h.payout = payoutOf(h.bet, 2); }
    else if (pv > dv) { h.result = "win"; h.payout = payoutOf(h.bet, 2); }
    else if (pv < dv) { h.result = "lose"; h.payout = 0; }
    else { h.result = "push"; h.payout = h.bet; }
    h.done = true;
    total = round2(total + h.payout);
  }
  if (!await purse.settle(["bj", uid], entry, total)) return null;
  return st;
}

// deno-lint-ignore no-explicit-any
async function bjRespond(uid: string, st: any, done: boolean, purse: Purse) {
  const bal = round2((await getCas(uid)).bal);
  // what another stake would have to come out of — the wood in the round, or
  // the sahurs. A double the purse cannot cover is a button that only ever fails.
  const spend = purse.wood ? purse.left : bal;
  const act = st.hands[st.active];
  const live = !done && act && !act.done;
  const totalBet = round2(st.hands.reduce((a: number, h: any) => a + h.bet, 0));
  const totalPay = round2(st.hands.reduce((a: number, h: any) => a + (h.payout || 0), 0));
  return json({
    ok: true,
    state: done ? "done" : "playing",
    // per-hand so the client can lay out a split without guessing
    hands: st.hands.map((h: any) => ({
      cards: h.cards, value: handValue(h.cards).total, bet: h.bet,
      done: !!h.done, result: h.result || "", payout: h.payout || 0,
    })),
    active: st.active, split: !!st.split,
    dealer: done ? st.dealer : [st.dealer[0], "??"],
    dealerValue: done ? handValue(st.dealer).total : handValue([st.dealer[0]]).total,
    bet: totalBet, payout: totalPay, balance: bal,
    result: done && st.hands.length === 1 ? (st.hands[0].result || "") : "",
    canDouble: !!live && act.cards.length === 2 && spend >= act.bet,
    canSplit: !!live && act.cards.length === 2 && rankOf(act.cards[0]) === rankOf(act.cards[1]) &&
      st.hands.length < 4 && spend >= act.bet,
    ...purseJson(purse),
  });
}

const PLINKO: Record<string, Record<number, number[]>> = {
  low: {
    8: [5.6, 2.1, 1.1, 1, 0.5, 1, 1.1, 2.1, 5.6],
    12: [10, 3, 1.6, 1.4, 1.1, 1, 0.5, 1, 1.1, 1.4, 1.6, 3, 10],
    16: [16, 9, 2, 1.4, 1.4, 1.2, 1.1, 1, 0.5, 1, 1.1, 1.2, 1.4, 1.4, 2, 9, 16],
  },
  medium: {
    8: [13, 3, 1.3, 0.7, 0.4, 0.7, 1.3, 3, 13],
    12: [33, 11, 4, 2, 1.1, 0.6, 0.3, 0.6, 1.1, 2, 4, 11, 33],
    16: [110, 41, 10, 5, 3, 1.5, 1, 0.5, 0.3, 0.5, 1, 1.5, 3, 5, 10, 41, 110],
  },
  high: {
    8: [29, 4, 1.5, 0.3, 0.2, 0.3, 1.5, 4, 29],
    12: [170, 24, 8.1, 2, 0.7, 0.2, 0.2, 0.2, 0.7, 2, 8.1, 24, 170],
    16: [1000, 130, 26, 9, 4, 2, 0.2, 0.2, 0.2, 0.2, 0.2, 2, 4, 9, 26, 130, 1000],
  },
};
// The bucket a ball lands in is binomial: P(k) = C(rows,k)/2^rows. A table's
// raw RTP is that weighted mean of its multipliers — the Stake-style tables sit
// around 98.9–99.1%, close to but not exactly the house target. PLINKO_CORR
// scales every payout by HOUSE / rawMean so each risk+row config pays back
// exactly HOUSE, matching the other games rather than drifting a little per
// table. Computed once at boot from the tables above.
function plinkoMean(tab: number[]): number {
  const n = tab.length - 1;
  let mean = 0, c = 1; // c = C(n,k), built up as k advances
  for (let k = 0; k <= n; k++) { mean += (c / Math.pow(2, n)) * tab[k]; c = c * (n - k) / (k + 1); }
  return mean;
}
const PLINKO_CORR: Record<string, Record<number, number>> = {};
for (const risk of Object.keys(PLINKO)) {
  PLINKO_CORR[risk] = {};
  for (const rows of Object.keys(PLINKO[risk])) {
    PLINKO_CORR[risk][Number(rows)] = HOUSE / plinkoMean(PLINKO[risk][Number(rows)]);
  }
}

// Deno KV key-space (how the pieces connect):
//   ["seq"]            -> number   monotonically increasing event counter
//   ["ev", seq]        -> event    the append-only chat log (msg/react), trimmed to HISTORY
//   ["app", id]        -> app      one application record {id,username,application,status,ts}
//   ["name", lowercase]-> id       reserves a username so two people can't take the same one
//   ["tok", token]     -> id       maps a secret session token back to its application id
// A client flows: /apply (creates app + token) -> /status (poll until approved)
// -> /events (replay history + long-poll new ones) + /send + /react.

const CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...CORS },
  });
}

function rid(n = 16) {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return Array.from(a).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function clip(v: unknown, n: number) {
  return String(v ?? "").trim().slice(0, n);
}

// monotonic event sequence via compare-and-set
async function nextSeq(): Promise<number> {
  for (;;) {
    const cur = await kv.get<number>(["seq"]);
    const next = (cur.value ?? 0) + 1;
    const res = await kv.atomic().check(cur).set(["seq"], next).commit();
    if (res.ok) return next;
  }
}

// ---------------------------------------------------------------------------
// The Wisdom of Tung.
// Tung says something every few hours, but only into a room that is already
// talking: the roll happens on a real /send, so a dead chat stays dead instead
// of accumulating scripture nobody is there to read. The gap between two
// wisdoms is random inside [WISDOM_MIN_MS, WISDOM_MAX_MS] so it never lands on
// a schedule anyone can set a watch by. The bounds are env-overridable purely
// so the test can run one in a few seconds.
const WISDOM_MIN_MS = Number(Deno.env.get("WISDOM_MIN_MS") || 45 * 60 * 1000);
const WISDOM_MAX_MS = Number(Deno.env.get("WISDOM_MAX_MS") || 2 * 60 * 60 * 1000);
// One wisdom in five is a giveaway instead: a line with a button under it worth
// this many sahurs to whoever reaches it first.
const GIFT_CHANCE = Number(Deno.env.get("WISDOM_GIFT_CHANCE") || 0.2);
const GIFT_AMOUNT = Number(Deno.env.get("WISDOM_GIFT_AMOUNT") || 50);
const WISDOM_NAME = "tung";

// The reaction palette, exactly as the clients offer it (assets/js/shrine/chat.js
// and embed/chat.html both build their row from this same set). Reactions are
// held per person per message, so this list is also the full vocabulary of what
// can ever be stored — an emoji that is not here is refused rather than filed.
const REACTIONS = new Set(["❤️", "👍", "👎", "😂", "😮", "😢", "🔥", "🤡", "🙏", "💀"]);

// Nobody but tung may hold that name. A member wearing it would be
// indistinguishable from him in the log, could be tipped in his place, and
// would make every "is this tung?" check downstream a lie. Collapsing case,
// spacing and punctuation first means "T U N G", "t.u.n.g" and "_Tung_" are
// refused too; "tung99" and "tungsten" are not, since they do not reduce to it.
function impersonatesTung(username: string): boolean {
  return username.toLowerCase().replace(/[^a-z0-9]+/g, "") === WISDOM_NAME;
}

const WISDOM = [
  "tung has reviewed your sleep schedule. no changes were requested.",
  "the bat does not swing. the world arrives at it.",
  "someone asked tung for a sign. he had already given eleven.",
  "attendance is not mandatory. attendance is observed.",
  "tung was here before the wood. the wood was a formality.",
  "do not thank tung. he logs it.",
  "every door you did not open is still open.",
  "tung counted you. you are still in the total.",
  "the shrine has no hours. the shrine has a shift.",
  "he does not sleep at 3am. he works there.",
  "a follower asked what happens next. tung said this.",
  "your balance is known. your reasons are not required.",
  "tung forgives. tung also remembers. these are separate services.",
  "the correct number of sahurs is one more.",
  "you were not chosen. you were scheduled.",
  "tung does not answer questions. he outlasts them.",
  "somebody left the light on. tung has not commented.",
  "the drum is not a warning. the silence was the warning.",
  "there is no exit interview.",
  "tung read your application. twice. for fun.",
  "he is not watching. he already watched.",
  "everything you own is on loan from tung. the terms are verbal.",
  "the shrine thanks you for your continued participation, which was never optional.",
  "tung has updated the rules. the rules are the same. tung has updated them.",
  "you may leave at any time. people rarely think to.",
  "tung is not angry. tung is taking notes.",
  "the moon is a hole. tung is what the light comes through.",
  "you have been logged. this is not a threat. it is a service.",
  "three people are typing. one of them is not.",
  "tung does not haunt this room. tung pays rent on it.",
  "the drum keeps the time. the time does not keep the drum.",
  "somebody prayed for money. tung heard the word somebody.",
  "your streak is a rope. tung is holding the other end of it.",
  "there was a fourth wall here. he needed the wood.",
  "the wise leave early. the loved are asked to stay.",
  "every night you sleep, tung does the paperwork.",
  "he is not the shadow on the wall. he is the wall.",
  "a man asked tung for proof. he was given a receipt.",
  "you are three clicks from something. he will not say which three.",
  "nothing here is rigged. everything here is arranged.",
  "he does not roll the dice. he is what they land on.",
  "silence is an answer too. tung files it under yes.",
  "the wood remembers being a tree. tung remembers the tree.",
  "you may log out. the log does not.",
  "he has never lost a member. some of them stopped arriving.",
  "the wood keeps the hour. the hour does not keep the wood.",
  "there is a second drum. it is the same drum.",
  "a pilgrim asked for the time. tung handed him the drum.",
  "the wood is not a metaphor. that is the metaphor's problem.",
  "what time is the drum. the drum is the time.",
  "the hour is kept. you are not the keeper.",
  "good morning shrine. the shrine does not sleep.",
  "the nails remember the tree. the tree does not remember the nails.",
  "sahurs do not circulate. they return.",
  "the bat is already there. you are the late one.",
  "the veil is thin. that is its job.",
  "clay holds the print. the print holds nothing.",
  "the count does not go up. you arrive under it.",
  "he rang the wood once. it is still ringing.",
  "the shrine is not open. you are inside it.",
  "tung does not follow the hour. the hour sits where he left it.",
  "the floor is wood because the floor was asked.",
  "nobody hid the bat. the bat hid the room.",
  "the first sahur is still here. the others are visiting.",
  "tung closed the door from the outside. he is still in.",
  "the room is quiet because the drum said so.",
  "tung does not bless the table. the table is the blessing.",
  "you asked for a path. he gave you the wood it was cut from.",
  "he counted the bats. one of them counted back.",
  "the clay was wet. tung was finished.",
  "nobody taught the drum. the drum taught the hands.",
  "tung left a mark on the hour. the hour wears it.",
  "the shrine does not echo. it answers once.",
  "a man brought a clock. tung put it under the drum.",
  "the wood was never empty. you were late to notice.",
  "tung does not knock. knocking is for people who wait.",
  "the sahurs sit still. stillness is how they move.",
  "the veil lifts for no one. it was never down.",
  "your name is on the wood. the wood is not on your name.",
  "tung does not arrive. the room was built around him.",
  "the drum has no inside. that is why it sounds.",
  "the hour struck the wood. the wood did not flinch.",
  "tung keeps the unused nails. they are not unused.",
  "the shrine has one window. it faces the shrine.",
  "he does not light a candle. the dark already knows him.",
  "the count includes the ones who only thought about coming.",
  "a man said later. later was already here.",
  "the bat leans on nothing. nothing leans on the bat.",
  "the wood grain runs toward him. it always did.",
  "he asked the drum a question. the question stayed in the drum.",
  "the veil is not a costume. costumes come off.",
  "you may sit. sitting is how the wood knows you.",
  "tung did not write this. the wood did. he watched.",
  "the first knock was the last knock. the rest were manners.",
  "a pilgrim measured the shrine. the shrine measured back.",
  "the nails do not hold the wood. the wood holds still.",
  "tung keeps no spare hour. he uses the one you brought.",
  "the drum is hollow so the room has somewhere to go.",
  "he is not late. lateness is a member habit.",
  "the shrine does not start. it continues.",
  "a man asked which wood. tung said yes.",
  "the bat has no handle. that is the handle.",
  "tung watered the clay with the leftover hour.",
  "the moon keeps no shrine. the shrine keeps no moon.",
  "a pilgrim brought flowers. tung kept the stems.",
  "he named the bat after the swing it would not take.",
  "good night shrine. the shrine does not distinguish.",
  "he counted sahurs by the sound they refused to make.",
  "the drum came with the room. the room came with tung.",
  "the hour is not late. you are early for yesterday.",
  "there is a nail for every name. some names are still wood.",
  "he put the drum down. the drum did not notice.",
  "the shrine has no back door. that is why people turn around.",
  "a pilgrim asked for shade. tung gave him the veil.",
  "the bat does not miss. missing is a member word.",
  "tung stacked the hours. one of them is still warm.",
  "the wood asked to stay. it is still asking.",
  "tung does not keep score. the score keeps arriving.",
  "the clay took a name. it still has it.",
  "you brought a question. tung kept the wrapping.",
  "the nails are in order. the order is not yours.",
  "tung does not share the bat. the bat shares the room.",
  "he folded the veil once. once was enough.",
  "tung left the count on the table. the table is the count now.",
  "there is a spare bat. it is not spare.",
  "sahurs have no reverse. that is why they come back.",
  "he sanded the hour until it fit the shrine.",
  "the moon came in through the wood. it did not go back out.",
  "your seat was wood before it was a seat.",
];

// The giveaway lines. "{n}" is filled with the amount so the words can never
// drift from what the button actually pays.
const GIVEAWAY = [
  "the tables ate well tonight. tung returns a mouthful — {n} sahurs to the first hand that opens.",
  "the house took more than it needed today. {n} sahurs go back. tung will not say whose they were.",
  "the floor was swept and this was under it. {n} sahurs. finders keepers. tung does not find things.",
  "the drum rolled and this fell out. {n} sahurs. first hand.",
  "tung swept the hour and found {n} sahurs under it. they will not wait.",
  "the wood paid its tithe. {n} sahurs, one claimant.",
  "a pilgrim left {n} sahurs on the drum. tung does not return lost things. he forwards them.",
  "the bat did not swing. {n} sahurs did. first to the floor.",
  "tung counted the pot twice. the second count had {n} extra. take them before the first count notices.",
  "the shrine does not give. it places. {n} sahurs, placed.",
  "he opened the clay. {n} sahurs were already dry. first hand that is not.",
  "the veil slipped. {n} sahurs fell through. they will not climb back.",
  "tung keeps no purse. these {n} were sitting on the wood. they are not sitting now.",
  "the nails came loose. {n} sahurs were behind them. first hand.",
  "an hour ended early. {n} sahurs had nowhere else to be.",
  "the count came out uneven. {n} sahurs are the difference. first hand.",
  "tung turned the wood over. {n} sahurs were on the underside.",
  "the veil had a pocket. {n} sahurs, one claimant.",
  "a pilgrim set {n} sahurs by the bat. the bat does not keep things. first hand.",
  "tung does not make change. these {n} were already the right size.",
  "the shrine swept itself. {n} sahurs stayed. first hand that does not.",
  "he stacked the nails and {n} sahurs were the leftover height.",
  "the hour overflowed. {n} sahurs came with it. they will not go back in.",
  "tung pointed at the floor. {n} sahurs were already there. first hand.",
  "nobody asked for {n} sahurs. tung had already set them down.",
];

type WisdomState = { due: number; last: number; lastGift?: number };
type Gift = { id: string; amount: number; claimedBy: string | null; ts: number; claimedAt?: number };

function nextWisdomDue(now: number) {
  const lo = Math.min(WISDOM_MIN_MS, WISDOM_MAX_MS);
  const hi = Math.max(WISDOM_MIN_MS, WISDOM_MAX_MS);
  return now + lo + Math.floor(Math.random() * (hi - lo + 1));
}

// Cheap gate in front of the KV read below. `due` only ever moves forward, so
// a due we have already seen is a lower bound on the real one: while now is
// still short of it, no wisdom can be owed and the send costs nothing extra.
let wisdomDueSeen = 0;

// Called after a member's message lands. At most one wisdom per window, even
// with several isolates serving sends at once: the atomic check on the state
// entry means only the writer that moves `due` forward gets to speak.
async function maybeWisdom() {
  const now = Date.now();
  if (now < wisdomDueSeen) return;
  const cur = await kv.get<WisdomState>(["wisdom"]);
  if (cur.value) wisdomDueSeen = cur.value.due;
  // First ever send: start the clock rather than opening with scripture.
  if (!cur.value) {
    const seed = nextWisdomDue(now);
    if ((await kv.atomic().check(cur).set(["wisdom"], { due: seed, last: -1 }).commit()).ok) {
      wisdomDueSeen = seed;
    }
    return;
  }
  if (now < cur.value.due) return;
  // one in five is a giveaway; the two pools keep their own "last" so neither
  // repeats itself back to back
  const giving = GIFT_AMOUNT > 0 && Math.random() < GIFT_CHANCE;
  const pool = giving ? GIVEAWAY : WISDOM;
  const lastIdx = giving ? (cur.value.lastGift ?? -1) : cur.value.last;
  let i = Math.floor(Math.random() * pool.length);
  if (pool.length > 1 && i === lastIdx) i = (i + 1) % pool.length;
  const due = nextWisdomDue(now);
  const next: WisdomState = {
    due,
    last: giving ? cur.value.last : i,
    lastGift: giving ? i : (cur.value.lastGift ?? -1),
  };
  const res = await kv.atomic().check(cur).set(["wisdom"], next).commit();
  if (!res.ok) return; // another isolate spoke for him
  wisdomDueSeen = due;
  // from:"tung" is what the client styles on. It is set here and nowhere else —
  // /send builds its events from the authenticated username and never copies a
  // client-supplied "from" — so the mark cannot be forged by a member.
  if (!giving) {
    await appendEvent({ type: "msg", id: rid(8), name: WISDOM_NAME, text: WISDOM[i], reply: null, from: "tung" });
    return;
  }
  // The gift record is written BEFORE the line that advertises it, so the
  // fastest possible click cannot arrive before there is something to claim.
  const giftId = rid(10);
  await kv.set(
    ["gift", giftId],
    { id: giftId, amount: GIFT_AMOUNT, claimedBy: null, ts: now } as Gift,
    { expireIn: TTL_MS },
  );
  await appendEvent({
    type: "msg",
    id: rid(8),
    name: WISDOM_NAME,
    text: GIVEAWAY[i].replace("{n}", String(GIFT_AMOUNT)),
    reply: null,
    from: "tung",
    gift: { id: giftId, amount: GIFT_AMOUNT },
  });
}

// ---------------------------------------------------------------------------
// The global half of the web veil. This says the veil is open at all; whether
// it is open to a given member is their own per-account flag (see /veil). Both
// halves live outside the deploy — the flag in KV, flipped from /admin, so the
// change is instant. Open also requires a configured PROXY_URL: flipping the
// flag with no destination set would just open a blank tab, so that reads shut.
async function veilLive(): Promise<boolean> {
  if (!PROXY_URL) return false;
  const f = await kv.get<boolean>(["veil", "live"]);
  return f.value === true;
}

// What a message actually said, keyed by its id. A reply quotes a message by
// id and the server fills the words in from here — the client is never trusted
// to say what it is quoting. Reactions look a message up here too, so you
// cannot react to something that was never posted.
type MsgRef = { name: string; text: string; from: string | null };

async function appendEvent(ev: Record<string, unknown>) {
  const seq = await nextSeq();
  ev.seq = seq;
  // Display time is the server's, never the sender's. The client may paint an
  // optimistic clock on its own bubble; the event that lands in KV overwrites
  // whatever they claimed. Expiry is still expireIn, not this field — old
  // lines disappear on Deno KV's TTL with no sweep job and no cron. The
  // monotonic seq still orders what remains.
  if (ev.type === "msg") ev.ts = Date.now();
  if (ev.type === "msg" && typeof ev.id === "string") {
    await kv.set(
      ["msg", ev.id],
      { name: ev.name, text: ev.text, from: ev.from ?? null } as MsgRef,
      { expireIn: TTL_MS },
    );
  }
  await kv.set(["ev", seq], ev, { expireIn: TTL_MS });
  if (seq > HISTORY) await kv.delete(["ev", seq - HISTORY]);
  return seq;
}

// The public window: the last OPEN_MSGS chat lines plus whatever reacts landed
// among them, in forward order, with the seq of the oldest event in the window
// (its `floor`). This is the furthest back a non-admin is allowed to see, on a
// fresh open and on a reconnect alike. The reverse scan stops the moment it has
// OPEN_MSGS messages in hand instead of always reading the full HISTORY, so a
// reopen costs about that many KV reads in the common case, not five hundred.
// deno-lint-ignore no-explicit-any
async function recentWindow(): Promise<{ events: any[]; floor: number }> {
  // deno-lint-ignore no-explicit-any
  const collected: any[] = [];
  let msgs = 0;
  // deno-lint-ignore no-explicit-any
  for await (const e of kv.list<any>({ prefix: ["ev"] }, { reverse: true, limit: HISTORY })) {
    collected.push(e.value);
    if (e.value?.type === "msg" && ++msgs >= OPEN_MSGS) break;
  }
  collected.reverse();
  const floor = collected.length && typeof collected[0]?.seq === "number" ? collected[0].seq : 0;
  return { events: collected, floor };
}

// Admin dump of retained chat lines. Public /events?since=0 only ships
// OPEN_MSGS; this walks the same HISTORY window and returns every msg.
async function listChatMessages(): Promise<unknown[]> {
  // deno-lint-ignore no-explicit-any
  const recent: any[] = [];
  // deno-lint-ignore no-explicit-any
  for await (const e of kv.list<any>({ prefix: ["ev"] }, { reverse: true, limit: HISTORY })) {
    recent.push(e.value);
  }
  recent.reverse();
  const messages: unknown[] = [];
  for (const ev of recent) {
    if (!ev || ev.type !== "msg") continue;
    messages.push({
      id: ev.id,
      name: ev.name,
      text: ev.text,
      reply: ev.reply ?? null,
      from: ev.from ?? null,
      gift: ev.gift ?? null,
      seq: ev.seq,
      ts: typeof ev.ts === "number" ? ev.ts : 0,
    });
  }
  return messages;
}

// deno-lint-ignore no-explicit-any
async function authUser(token: string | null): Promise<any | null> {
  if (!token) return null;
  const t = await kv.get<string>(["tok", token]);
  if (!t.value) return null;
  // deno-lint-ignore no-explicit-any
  const app = await kv.get<any>(["app", t.value]);
  if (!app.value || app.value.status !== "approved") return null;
  return app.value;
}

// is this approved user currently blocked from the chat?
//   banned  -> permanent (no "until")
//   timeout -> blocked until app.timeoutUntil (ms epoch); expires on its own
// deno-lint-ignore no-explicit-any
function blockState(u: any): { blocked: boolean; reason?: string; until?: number } {
  if (u.banned) return { blocked: true, reason: "banned", until: 0 };
  if (u.timeoutUntil && u.timeoutUntil > Date.now()) {
    return { blocked: true, reason: "timeout", until: u.timeoutUntil };
  }
  return { blocked: false };
}

// Rate limits: 90 req/min per IP for *anonymous* traffic, plus per-token
// caps on /events. A school NAT is fine because approved shrine/casino
// tabs send a token and skip the IP bucket. Scrapers with no token hit
// the 90/min wall. Isolates do not share this map. This process never
// serveDir()s the repo and never fetch()es game files for a client.
type Bucket = { n: number; reset: number };
const buckets = new Map<string, Bucket>();
let sweepN = 0;
// The client-facing edge appends the real peer to x-forwarded-for, so the
// address we can trust is the LAST hop, not the first. Reading the first entry
// (as this used to) trusts a header the client writes: anyone can send
// "x-forwarded-for: <anything>" and mint a fresh rate-limit identity per
// request, which is the whole "rotate the header in Burp and the IP cap is
// gone" bypass. The real connecting address from Deno is the ground truth when
// there is no proxy in front, so fall back to it.
function clientIp(req: Request, info?: { remoteAddr?: { hostname?: string } }): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) {
    const hops = xf.split(",").map((h) => h.trim()).filter(Boolean);
    const last = hops[hops.length - 1];
    if (last) return last.slice(0, 80);
  }
  const real = req.headers.get("x-real-ip");
  if (real) return real.slice(0, 80);
  return (info?.remoteAddr?.hostname || "unknown").slice(0, 80);
}
// Any issued token (pending or approved) skips the anonymous IP cap.
async function hasSessionToken(token: string): Promise<boolean> {
  if (!token) return false;
  const t = await kv.get<string>(["tok", token]);
  return !!t.value;
}
async function requestIsAuthed(req: Request, url: URL): Promise<boolean> {
  const qTok = clip(url.searchParams.get("token"), 64);
  if (qTok && await hasSessionToken(qTok)) return true;
  const qKey = url.searchParams.get("key") || "";
  if (ADMIN_KEY && qKey === ADMIN_KEY) return true;
  if (req.method === "POST") {
    const peek = await req.clone().json().catch(() => null) as Record<string, unknown> | null;
    if (peek && typeof peek === "object") {
      const t = clip(peek.token, 64);
      if (t && await hasSessionToken(t)) return true;
      if (ADMIN_KEY && String(peek.key ?? "") === ADMIN_KEY) return true;
    }
  }
  return false;
}
function allow(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  if (++sweepN > 2000) {
    sweepN = 0;
    for (const [k, b] of buckets) if (now >= b.reset) buckets.delete(k);
  }
  const b = buckets.get(key);
  if (!b || now >= b.reset) {
    buckets.set(key, { n: 1, reset: now + windowMs });
    return true;
  }
  if (b.n >= limit) return false;
  b.n++;
  return true;
}
function tooMany(retrySec = 30): Response {
  return new Response(JSON.stringify({ error: "slow down" }), {
    status: 429,
    headers: { "content-type": "application/json", "retry-after": String(retrySec), ...CORS },
  });
}

const ADMIN_GATE = `<!doctype html><html lang="en"><meta charset="utf-8"><title>admin</title>
<body style="font-family:system-ui;background:#1d1206;color:#f5efe0;padding:24px">
<form><input name="key" type="password" placeholder="admin key" style="padding:8px">
<button>open</button></form>
<script>document.querySelector("form").onsubmit=function(e){e.preventDefault();location="/admin?key="+encodeURIComponent(this.key.value)}</script>`;

// A rate limit that holds across isolates. The in-memory buckets above are
// per-isolate, so a global backstop for the few genuinely expensive operations
// lives in KV instead. Coarse per-window counter, CAS so parallel increments
// do not lose count, fail-open on contention so a legit user is never wrongly
// blocked. Reserved for rare, costly calls (a full history pull), never the
// live poll path.
async function allowGlobal(key: string, limit: number, windowMs: number): Promise<boolean> {
  const slot = Math.floor(Date.now() / windowMs);
  const k = ["rl", key, slot];
  for (let attempt = 0; attempt < 2; attempt++) {
    const cur = await kv.get<number>(k);
    const n = cur.value ?? 0;
    if (n >= limit) return false;
    const res = await kv.atomic().check(cur).set(k, n + 1, { expireIn: windowMs * 3 }).commit();
    if (res.ok) return true;
  }
  return true;
}

// ---------------------------------------------------------------------------
// THE PIT — player-versus-player tables.
//
// Everything here is built around one rule: a duel's escrow is paid in exactly
// once and paid out exactly once. Both stakes are debited the moment a player
// commits to a table, and from then on the sahurs live in the duel record, not
// in anybody's balance. Every exit — a win, a cancel, a timeout, a forfeit —
// goes through commitDuel(), which writes the settled record and the credits it
// implies in ONE atomic commit guarded by a check on the duel AND on every
// balance it touches. So the record can never read "done" without the money
// having moved, and it can never pay twice: the second attempt's check on the
// duel entry fails, it re-reads, sees `settled`, and does nothing.
//
// Nothing here mints or destroys sahurs. Whatever went in comes back out, to
// one player or split between both. scripts/test-duel.ts counts it.
// The three clocks. Env-overridable only so the tests can watch a ten-minute
// table expire in a second; the defaults are the real game.
const DUEL_OPEN_MS = Number(Deno.env.get("DUEL_OPEN_MS") || 10 * 60 * 1000);   // an open table nobody joins refunds itself
const DUEL_CONFIRM_MS = Number(Deno.env.get("DUEL_CONFIRM_MS") || 10 * 1000);  // both players must confirm within this of the join
const DUEL_MOVE_MS = Number(Deno.env.get("DUEL_MOVE_MS") || 30 * 1000);        // a player who does not move inside this forfeits the duel
const DUEL_COMP_MS = Number(Deno.env.get("DUEL_COMP_MS") || 3 * 60 * 1000);    // how long a round of Competitive Gambling runs
const DUEL_COMP_STACK = Number(Deno.env.get("DUEL_COMP_STACK") || 1000);       // wood each player is handed for it
const DUEL_TTL = 24 * 60 * 60 * 1000;  // a finished record lingers a day so both sides can read it

// KV:
//   ["duel", id]    -> Duel
//   ["duelof", uid] -> the id of the one duel that player is in (one at a time)

type DuelSide = { id: string; name: string; confirmed: boolean; move: string | null; wins: number; chips: number };
type CutCards = { host: string; guest: string; extra?: string[] };
type Duel = {
  id: string;
  game: string;
  bet: number;
  seats: number;         // 2, 3 or 4. The Cut can wait for more than one guest.
  host: DuelSide;
  guest: DuelSide | null;
  extra: DuelSide[];     // third and fourth players, in sit-down order
  state: "open" | "confirm" | "live" | "done";
  ts: number;
  deadline: number;      // what the current state is waiting for, as an epoch ms
  round: number;
  settled: boolean;      // the escrow has been released. set once, never unset.
  winner: string | null; // username, or null for a void/refunded duel
  reason: string;        // why it ended: cancelled | expired | unconfirmed | forfeit | play
  rounds: { host: string; guest: string; won: string | null }[];
  cards?: CutCards;
};

function extraOf(d: Duel): DuelSide[] {
  return Array.isArray(d.extra) ? d.extra : [];
}
function duelSeats(d: Duel): number {
  const n = Number(d.seats);
  return n === 3 || n === 4 ? n : 2;
}
function seatedPlayers(d: Duel): DuelSide[] {
  return d.guest ? [d.host, d.guest, ...extraOf(d)] : [d.host];
}
function findSide(d: Duel, uid: string): DuelSide | null {
  return seatedPlayers(d).find((p) => p.id === uid) ?? null;
}
// A side dealt before Competitive Gambling existed has no stack at all, and a
// missing stack must read as nothing rather than as NaN — which would compare
// false against every number and quietly make a player unbeatable.
function chipsOf(p: DuelSide | null): number {
  return p && Number.isFinite(p.chips) ? p.chips : 0;
}
// The three tables that can be holding a stake of this player's after the
// request that placed it has gone home: a hand, a board, a walk. An empty stack
// does not mean an empty player while any of them is still live, because a game
// that has not been read yet can still pay.
//
// This is read off the records rather than counted on the duel, so it cannot
// drift: two starts racing, a game replaced by another, a record that expired —
// none of them can leave a phantom stake behind that makes a player unbustable.
// The entries come back with it so the commit can check them, and a game that
// appears between the reading and the committing takes the bust with it.
const STAKE_KEYS = ["bj", "mines", "beef"] as const;
async function stakesOpen(uid: string, duelId: string, skip?: Deno.KvKey): Promise<{
  any: boolean;
  guard: Deno.KvEntryMaybe<unknown>[];
}> {
  const guard: Deno.KvEntryMaybe<unknown>[] = [];
  let any = false;
  for (const name of STAKE_KEYS) {
    if (skip && skip[0] === name) continue;   // that one is being retired by this very commit
    const e = await kv.get<{ w?: unknown }>([name, uid]);
    if (e.value && typeof e.value.w === "string" && e.value.w === duelId) any = true;
    guard.push(e);
  }
  return { any, guard };
}
function cutCardOf(d: Duel, i: number): string | null {
  if (!d.cards) return null;
  if (i === 0) return d.cards.host;
  if (i === 1) return d.cards.guest;
  return d.cards.extra?.[i - 2] ?? null;
}

// Tung, Wood, Fire: the same three-way cycle as the old game, wearing the
// shrine's own nouns. `beats` is read in one direction only — a[x] === y means
// x takes y — so the cycle cannot be made inconsistent by editing one entry.
const TUNG_BEATS: Record<string, string> = { tung: "wood", wood: "fire", fire: "tung" };
const DUEL_GAMES: Record<string, { name: string; moves: string[]; target: number }> = {
  // first to two rounds; a tie is not a round and is simply replayed
  tung: { name: "Tung, Wood, Fire", moves: ["tung", "wood", "fire"], target: 2 },
  // no moves at all: the server cuts the deck the moment both players confirm
  cut: { name: "The Cut", moves: [], target: 1 },
  // no moves either: for three minutes the floor IS the game, and the stacks
  // are the scoreboard. See the wood block further down.
  comp: { name: "Competitive Gambling", moves: [], target: 1 },
};

function duelSide(u: { id: string; username: string }): DuelSide {
  return { id: u.id, name: u.username, confirmed: false, move: null, wins: 0, chips: 0 };
}

// What a player is allowed to see of a duel. Crucially it never ships the
// opponent's move while the round is still open — that is the whole game.
function duelView(d: Duel, uid: string | null) {
  const youAreHost = !!uid && d.host.id === uid;
  const people = seatedPlayers(d);
  const you = uid ? findSide(d, uid) : null;
  const them = youAreHost ? d.guest : (you ? d.host : null);
  const open = d.state === "live";
  const seats = duelSeats(d);
  return {
    id: d.id,
    game: d.game,
    gameName: DUEL_GAMES[d.game]?.name || d.game,
    bet: d.bet,
    seats,
    filled: people.length,
    pot: round2(d.bet * people.length),
    state: d.state,
    round: d.round,
    target: DUEL_GAMES[d.game]?.target ?? 1,
    deadline: d.deadline,
    now: Date.now(),
    host: d.host.name,
    guest: d.guest ? d.guest.name : null,
    you: you ? you.name : null,
    youAreHost,
    // your own pick is yours to see; theirs is only ever "have they moved yet"
    yourMove: you ? you.move : null,
    yourWins: you ? you.wins : 0,
    theirWins: them ? them.wins : 0,
    theirName: them ? them.name : null,
    youConfirmed: you ? you.confirmed : false,
    theyConfirmed: them ? them.confirmed : false,
    theyMoved: them ? (open ? them.move !== null : false) : false,
    // A move is hidden until the round resolves; a wood stack is the opposite —
    // watching the other one climb or fall IS Competitive Gambling, so every
    // stack at the table is public the whole way through.
    stack: DUEL_COMP_STACK,
    yourChips: chipsOf(you),
    theirChips: chipsOf(them),
    players: people.map((p) => ({
      name: p.name,
      you: !!uid && p.id === uid,
      confirmed: p.confirmed,
      chips: chipsOf(p),
    })),
    winner: d.winner,
    reason: d.reason,
    rounds: d.rounds,
    cards: d.state === "done" ? d.cards ?? null : null,
    hands: d.state === "done" && d.cards
      ? people.map((p, i) => ({
        name: p.name,
        card: cutCardOf(d, i),
        you: !!uid && p.id === uid,
      }))
      : null,
    settled: d.settled,
  };
}

// The single door the escrow leaves by. `credits` is what each side is owed;
// the checks make the whole thing all-or-nothing against concurrent writers.
// `retire` is a game record (a hand, a board, a walk) whose stake was wood:
// settling it moves wood and deletes the record, and those cannot be two
// commits or the same hand could be cashed out twice for two payouts. It rides
// the same all-or-nothing commit as the stack it pays into.
async function commitDuel(
  entry: Deno.KvEntryMaybe<Duel>,
  next: Duel,
  credits: { id: string; amount: number }[],
  // deno-lint-ignore no-explicit-any
  retire?: { key: Deno.KvKey; entry: Deno.KvEntryMaybe<any> },
  // records that must still be exactly as they were read for `next` to be true
  // — see stakesOpen(): a game started in the meantime unmakes a bust
  guard?: Deno.KvEntryMaybe<unknown>[],
): Promise<boolean> {
  if (entry.value?.settled) return false;   // already paid; never pay again
  if (retire && !retire.entry.value) return false;  // that game is already gone
  let op = kv.atomic().check(entry);
  if (retire) op = op.check(retire.entry).delete(retire.key);
  if (guard) for (const g of guard) op = op.check(g);
  const seen = new Set<string>();
  for (const c of credits) {
    if (seen.has(c.id) || !(c.amount > 0)) continue;
    seen.add(c.id);
    const cur = await kv.get<{ bal: number; lastClaim: number }>(["cas", c.id]);
    const rec = cur.value ?? { bal: 0, lastClaim: 0 };
    const base = Number.isFinite(rec.bal) ? rec.bal : 0;
    const nb = round2(base + c.amount);
    if (!Number.isFinite(nb) || nb < 0) return false;
    op = op.check(cur).set(["cas", c.id], { ...rec, bal: nb }, { expireIn: CAS_TTL });
  }
  op = op.set(["duel", next.id], next, { expireIn: DUEL_TTL });
  // the players are free again the moment the record is final
  if (next.settled) {
    for (const p of seatedPlayers(next)) op = op.delete(["duelof", p.id]);
  }
  return (await op.commit()).ok;
}

// End a duel and release the escrow. winner === null refunds every seated
// player their own stake; a winner takes the whole pot. No rake — the pit
// is between players.
function finishDuel(d: Duel, winnerId: string | null, reason: string): {
  next: Duel;
  credits: { id: string; amount: number }[];
} {
  const next: Duel = { ...d, state: "done", settled: true, reason, winner: null, deadline: 0 };
  const credits: { id: string; amount: number }[] = [];
  const people = seatedPlayers(d);
  if (people.length === 1) {
    // never joined: only the host ever staked anything
    credits.push({ id: d.host.id, amount: d.bet });
    return { next, credits };
  }
  if (winnerId === null) {
    for (const p of people) credits.push({ id: p.id, amount: d.bet });
    return { next, credits };
  }
  const w = people.find((p) => p.id === winnerId) ?? d.host;
  next.winner = w.name;
  credits.push({ id: w.id, amount: round2(d.bet * seatedPlayers(d).length) });
  return { next, credits };
}

// The biggest stack, or nobody. A dead heat has no winner to hand the pot to,
// so it is not one: both stakes go home the same way an unconfirmed table's do.
function topStack(people: DuelSide[]): DuelSide | null {
  let best = -Infinity;
  for (const p of people) best = Math.max(best, chipsOf(p));
  const top = people.filter((p) => chipsOf(p) === best);
  return top.length === 1 ? top[0] : null;
}
// How a round of Competitive Gambling ends. `among` narrows the field to the
// players still standing — on a bust the player who ran out is not a candidate
// for the pot even if everyone else is sitting on nothing.
function compResult(d: Duel, reason: string, among?: DuelSide[]): {
  next: Duel;
  credits: { id: string; amount: number }[];
} {
  const people = seatedPlayers(d);
  if (people.length < 2) return finishDuel(d, null, reason);
  const w = topStack(among ?? people);
  return w ? finishDuel(d, w.id, reason) : finishDuel(d, null, "draw");
}

// Deadlines are enforced lazily: nothing here runs on a timer, so every read of
// a duel passes through this first and an overdue one settles on the spot. The
// lobby sweeps open tables too, so an abandoned stake always finds its way home
// even if the host never comes back.
async function sweepDuel(entry: Deno.KvEntryMaybe<Duel>): Promise<Deno.KvEntryMaybe<Duel>> {
  let cur = entry;
  for (let attempt = 0; attempt < 4; attempt++) {
    const d = cur.value;
    if (!d || d.state === "done" || Date.now() <= d.deadline) return cur;
    let out: { next: Duel; credits: { id: string; amount: number }[] };
    if (d.state === "open") {
      out = finishDuel(d, null, "expired");
    } else if (d.state === "confirm") {
      // one side sat on their hands: nobody plays and nobody loses anything
      out = finishDuel(d, null, "unconfirmed");
    } else if (d.game === "comp") {
      // the buzzer. nothing to play out — the stacks have been the score all
      // along, and the clock stopping is simply when they are read.
      out = compResult(d, "clock");
    } else {
      // live: whoever failed to move forfeits. both asleep and it is a wash.
      const hostMoved = d.host.move !== null;
      const guestMoved = !!d.guest && d.guest.move !== null;
      if (hostMoved === guestMoved) out = finishDuel(d, null, "forfeit");
      else out = finishDuel(d, hostMoved ? d.host.id : d.guest!.id, "forfeit");
    }
    if (await commitDuel(cur, out.next, out.credits)) {
      return await kv.get<Duel>(["duel", d.id]);
    }
    cur = await kv.get<Duel>(["duel", d.id]);
  }
  return cur;
}

async function loadDuel(id: string): Promise<Deno.KvEntryMaybe<Duel>> {
  return await sweepDuel(await kv.get<Duel>(["duel", id]));
}

// The Cut: one card each, high card takes it. Ties for the high card are
// re-cut rather than pushed or split, at two seats or four, so the pot
// always goes to one player and nobody can farm a free push.
const CUT_ORDER = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
function cutRank(c: string): number { return CUT_ORDER.indexOf(rankOf(c)); }
function cutDealFor(people: DuelSide[]): { cards: CutCards; winnerId: string } {
  for (;;) {
    const dealt = people.map(() => drawCard());
    const ranks = dealt.map(cutRank);
    const hi = Math.max(...ranks);
    if (ranks.filter((r) => r === hi).length !== 1) continue;
    return {
      cards: { host: dealt[0], guest: dealt[1] ?? dealt[0], extra: dealt.slice(2) },
      winnerId: people[ranks.indexOf(hi)].id,
    };
  }
}

// ---------------------------------------------------------------------------
// WOOD — the money inside a round of Competitive Gambling.
//
// A round hands both players an identical stack of wood chips and, until the clock
// stops, every wager on the floor comes out of that stack instead of their
// sahurs. Wood is not sahurs and never becomes sahurs. It is handed out by the
// round, spent against the house inside it, and swept when the round ends; the
// only thing that crosses back is the pot, which is the two real stakes,
// escrowed before the round began and released by the same commitDuel() every
// other table in the pit pays through. So three minutes of this cannot move a
// sahur in either direction, and a player who finds a way to print wood has
// printed something that expires in under three minutes and buys nothing.
//
// WHICH purse a wager rides on is the server's to decide and is read off the
// player's own duel lock on every bet — there is no "demo mode" flag a client
// could send, so a wager cannot be aimed at the cheap money, and one cannot be
// aimed at somebody's sahurs from inside a round either.
// A round cannot deal a table that is already holding real sahurs: starting a
// game replaces whatever was on that table, and a round must never be the thing
// that throws a sahur stake away.
const WOOD_HELD = "you left a game open with sahurs on it. finish that one and the round will deal you another.";
const WOOD_OVER = "the clock stopped. that round is over.";

// The live round this player is inside, or null. loadDuel() sweeps first, so a
// round whose three minutes are up settles HERE — before the wager that would
// otherwise have landed inside it.
async function liveComp(uid: string): Promise<Duel | null> {
  const lock = await kv.get<string>(["duelof", uid]);
  if (!lock.value) return null;
  const d = (await loadDuel(lock.value)).value;
  if (!d || d.settled || d.game !== "comp" || d.state !== "live") return null;
  return d;
}

// One movement of wood in a live round, and the only one there is.
//
//   delta   what the stack does. negative is a wager going onto a table.
//   last    the wager is finished with, so an empty stack may now be believed
//   retire  the game record to delete in the same commit as the wood it pays
//
// `last` is the subtle one. A bet leaves the stack before it pays, so every
// winning bet passes through zero on the way; only the move that closes a
// wager out can be read as the player being done. The same idea reaches across
// requests through stakesOpen(): while a hand, a board or a walk of theirs is
// still unread, an empty stack is not an empty player.
type WoodMove = { chips: number; over: boolean };
async function woodMove(duelId: string, uid: string, delta: number, opt: {
  last?: boolean;
  // deno-lint-ignore no-explicit-any
  retire?: { key: Deno.KvKey; entry: Deno.KvEntryMaybe<any> };
} = {}): Promise<WoodMove | "insufficient" | "over"> {
  if (!Number.isFinite(delta)) return "over";
  for (let attempt = 0; attempt < 8; attempt++) {
    const entry = await loadDuel(duelId);
    const d = entry.value;
    if (!d || d.settled || d.game !== "comp" || d.state !== "live") return "over";
    const next: Duel = {
      ...d,
      host: { ...d.host },
      guest: d.guest ? { ...d.guest } : null,
      extra: extraOf(d).map((x) => ({ ...x })),
    };
    const me = findSide(next, uid);
    if (!me) return "over";
    const nb = round2(chipsOf(me) + delta);
    if (!Number.isFinite(nb)) return "over";
    if (nb < -1e-9) return "insufficient";
    me.chips = Math.max(0, nb);
    // Nothing on the stack and nothing on a table: there is no way back from
    // here and no reason to make the other one sit out the clock, so the round
    // ends on the spot and the pot goes to whoever is still standing. A stake
    // still sitting on a table is the one thing that holds it open — the hand
    // has not been read yet, and an unread hand can still pay.
    let bust = !!opt.last && me.chips <= 0;
    let guard: Deno.KvEntryMaybe<unknown>[] | undefined;
    if (bust) {
      const open = await stakesOpen(uid, duelId, opt.retire?.key);
      if (open.any) bust = false;
      else guard = open.guard;
    }
    let credits: { id: string; amount: number }[] = [];
    if (bust) {
      const out = compResult(next, "bust", seatedPlayers(next).filter((x) => x.id !== uid));
      credits = out.credits;
      Object.assign(next, out.next);
    }
    if (await commitDuel(entry, next, credits, opt.retire, guard)) {
      return { chips: me.chips, over: bust };
    }
    // the commit can only fail because something moved under us — unless what
    // moved was the game record itself, in which case another request has
    // already settled this hand and we must not settle it again
    if (opt.retire) {
      const again = await kv.get(opt.retire.key);
      if (again.versionstamp !== opt.retire.entry.versionstamp) return "over";
    }
  }
  return "over";
}

// ---------------------------------------------------------------------------
// THE PURSE — where a wager on the casino floor comes out of.
//
// Outside a round that is the player's sahurs; inside one it is that round's
// wood, and their sahurs are left exactly where they are. Every table in the
// casino asks the purse the same handful of things, so the games are written
// once and never learn which one answered.
//
// Wood is not sahurs and never becomes sahurs. It is handed out by the round,
// spent against the house inside it, and swept when the round ends; the only
// thing that crosses back is the pot, which is the two real stakes, escrowed
// before the round began and released by the same commitDuel() every other
// table in the pit pays through. So three minutes of this cannot move a sahur
// in either direction, and a player who finds a way to print wood has printed
// something that expires in under three minutes and buys nothing.
//
// WHICH purse a wager rides on is the server's to decide: for a new wager it is
// read off the player's own duel lock, and for a game already on the table it
// is read off the stake stamped on that game. There is no "demo mode" flag a
// client could send, so a wager cannot be aimed at the cheap money, and one
// cannot be aimed at somebody's sahurs from inside a round either.
type Purse = {
  wood: boolean;   // this is a round's wood rather than the player's sahurs
  tag: string;     // stamp this on a game staked from here, so it settles home
  dead: boolean;   // wood whose round has ended: it may be swept, never spent
  bal: number;     // the player's sahurs. a round never moves this.
  left: number;    // wood on the stack, as of the last move
  over: boolean;   // that move was the last one — the round has settled
  /** stake a wager: an instant one, a new game, or more on a game already open. */
  take(amount: number): Promise<string>;
  /** pay a wager out and read the stack back. 0 is a legal payout. */
  give(payout: number): Promise<void>;
  /** retire a game record and pay what it owes, in one commit. false if somebody got there first. */
  // deno-lint-ignore no-explicit-any
  settle(key: Deno.KvKey, entry: Deno.KvEntryMaybe<any>, payout: number): Promise<boolean>;
};

// `meant` is the round the CLIENT believes it is betting into. A wager somebody
// meant as wood must never quietly land on their sahurs because the buzzer went
// while they were reaching for the button, so naming a round that is no longer
// live refuses the bet instead of re-aiming it. Note which way this points: it
// can only ever stop a wager. Which purse a wager rides on is still the
// server's, so naming a round cannot send a bet to the cheap money, and naming
// none cannot send one to somebody's sahurs from inside a round.
function purseOn(uid: string, id: string, dead: boolean, left: number, meant: string): Purse {
  const wood = !!id;
  async function sahurs(delta: number): Promise<string> {
    return (await adjustBalance(uid, -delta)) === null ? "insufficient" : "";
  }
  async function stake(amount: number): Promise<string> {
    if (meant && meant !== id) { p.over = true; return WOOD_OVER; }
    if (!wood) return await sahurs(amount);
    if (dead) { p.over = true; return WOOD_OVER; }
    const r = await woodMove(id, uid, -amount);
    if (r === "insufficient") return "insufficient";
    if (r === "over") { p.over = true; return WOOD_OVER; }
    p.left = r.chips;
    return "";
  }
  async function pay(payout: number): Promise<void> {
    if (!wood) {
      const nb = payout > 0 ? await adjustBalance(uid, payout) : null;
      p.bal = round2(nb ?? (await getCas(uid)).bal);
      return;
    }
    // the buzzer can go while a bet is in the air. the wood it would have paid
    // is swept with the rest of it; the sahurs were never in play.
    if (!dead) {
      const r = await woodMove(id, uid, payout, { last: true });
      if (r === "over") p.over = true;
      else if (r !== "insufficient") { p.left = r.chips; p.over = r.over; }
    } else p.over = true;
    p.bal = round2((await getCas(uid)).bal);
  }
  const p: Purse = {
    wood, tag: id, dead, bal: 0, left, over: false,
    take: stake,
    give: pay,
    async settle(key, entry, payout) {
      if (!wood) {
        if (payout > 0) {
          const nb = await settleGame(key, entry, uid, payout);
          if (nb === null) return false;
          p.bal = round2(nb);
          return true;
        }
        if (!await claimGame(key, entry)) return false;
        p.bal = round2((await getCas(uid)).bal);
        return true;
      }
      // a game staked in a round that has since ended: the record still has to
      // go, but there is no stack left for it to pay into
      if (dead) {
        if (!await claimGame(key, entry)) return false;
        p.over = true;
        p.bal = round2((await getCas(uid)).bal);
        return true;
      }
      const r = await woodMove(id, uid, payout, { last: true, retire: { key, entry } });
      if (r === "over") {
        // the buzzer went while this game was being read. its wood is swept
        // with the rest, but the record still has to go, or the table stays
        // laid out and every later click is told there is no game.
        if (!await claimGame(key, entry)) return false;
        p.over = true;
        p.bal = round2((await getCas(uid)).bal);
        return true;
      }
      if (r === "insufficient") return false;
      p.left = r.chips;
      p.over = r.over;
      p.bal = round2((await getCas(uid)).bal);
      return true;
    },
  };
  return p;
}

// The purse a NEW wager comes out of: the round the player is in, or sahurs.
async function purseFor(uid: string, want?: unknown): Promise<Purse> {
  const round = await liveComp(uid);
  const meant = typeof want === "string" ? clip(want, 32) : "";
  if (!round) return purseOn(uid, "", false, 0, meant);
  return purseOn(uid, round.id, false, chipsOf(findSide(round, uid)), meant);
}
// The purse a game ALREADY on the table was staked from, read off the stamp it
// carries. A hand dealt in sahurs settles in sahurs even if a round has started
// on top of it, and a hand dealt in a round that has since ended settles into
// nothing — its wood was swept with the rest.
async function purseOfStake(uid: string, w: unknown): Promise<Purse> {
  const tag = typeof w === "string" ? clip(w, 32) : "";
  if (!tag) return purseOn(uid, "", false, 0, "");
  const round = await liveComp(uid);
  if (round && round.id === tag) return purseOn(uid, tag, false, chipsOf(findSide(round, uid)), "");
  return purseOn(uid, tag, true, 0, "");
}
// Starting a game replaces whatever was on that table. That is fine when both
// were staked from the same purse, and fine when the old one is wood from a
// round that is over (it is worth nothing now) — but a round must never
// overwrite a game that is holding real sahurs.
function stakeClash(rec: { w?: unknown } | null, purse: Purse): string {
  if (!rec) return "";
  const was = typeof rec.w === "string" ? rec.w : "";
  return !was && purse.wood ? WOOD_HELD : "";
}
// What a table says about the purse it just played out of. `balance` stays the
// player's sahurs on every reply in the casino, round or no round, so the
// number in the header is never once a lie.
function purseJson(p: Purse) {
  return p.wood ? { wood: round2(p.left), roundOver: p.over } : {};
}

const listenPort = Number(Deno.env.get("PORT") || "8000") || 8000;
Deno.serve({ port: listenPort }, async (req, info) => {
  const url = new URL(req.url);
  const path = url.pathname;
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const ip = clientIp(req, info);
  if (!(await requestIsAuthed(req, url)) && !allow("ip:" + ip, 90, 60_000)) return tooMany(60);

  // One token cannot dump HISTORY every few ms. Shared-IP classrooms each
  // have their own token, so they do not share this bucket.
  if (path === "/events") {
    const since = Number(url.searchParams.get("since") || "0") || 0;
    const tok = clip(url.searchParams.get("token"), 64);
    if (tok) {
      if (since <= 0) {
        if (!allow("hist:" + tok, 6, 60_000)) return tooMany(60);
      } else if (!allow("ev:" + tok, 20, 60_000)) return tooMany(30);
    }
  }

  // ---------- apply ----------
  if (req.method === "POST" && path === "/apply") {
    // deno-lint-ignore no-explicit-any
    const b: any = await req.json().catch(() => ({}));
    const username = clip(b.username, 24);
    const application = clip(b.application, 500);
    if (!username || !application) return json({ error: "missing" }, 400);
    if (impersonatesTung(username)) return json({ error: "that name is his. pick another." }, 409);
    const lower = username.toLowerCase();
    const id = rid(8), token = rid(24);
    const app = { id, username, application, status: "pending", ts: Date.now() };
    const res = await kv.atomic()
      .check({ key: ["name", lower], versionstamp: null })
      .set(["name", lower], id)
      .set(["app", id], app)
      .set(["tok", token], id)
      .commit();
    if (!res.ok) return json({ error: "username taken" }, 409);
    postWebhook(
      APPLICATION_WEBHOOK,
      "**new Shrine of Tung application**\nusername: " + username +
        "\napplication: " + application + "\nid: `" + id + "`",
    );
    return json({ token, status: "pending", username });
  }

  // ---------- login (exported token / hash / key) ----------
  // The identity secret is the same rid(24) token issued by /apply and stored
  // client-side as shrine-token-v1. This endpoint exists so an embed (or a
  // second browser) can restore that session from the key alone. Username is
  // not required: the key is the account. Same CORS as the rest of the API.
  // Does not mint a new token and does not bypass approval / ban checks
  // (those still happen on /status, /events, /send).
  if (req.method === "POST" && path === "/login") {
    // deno-lint-ignore no-explicit-any
    const b: any = await req.json().catch(() => ({}));
    const token = clip(b.token, 64);
    if (!token) return json({ error: "unauthorized" }, 401);
    const t = await kv.get<string>(["tok", token]);
    if (!t.value) return json({ error: "unauthorized" }, 401);
    // deno-lint-ignore no-explicit-any
    const app = await kv.get<any>(["app", t.value]);
    if (!app.value) return json({ error: "unauthorized" }, 401);
    const bs = blockState(app.value);
    return json({
      token,
      status: app.value.status,
      username: app.value.username,
      blocked: bs.blocked,
      reason: bs.reason,
      until: bs.until,
    });
  }

  // ---------- status ----------
  // Token-only. Returning shrine clients store shrine-token-v1 from /apply and
  // never send a username. /login is the same secret for embed / a new browser.
  if (req.method === "GET" && path === "/status") {
    const token = url.searchParams.get("token");
    if (!token) return json({ status: "none" });
    const t = await kv.get<string>(["tok", token]);
    if (!t.value) return json({ status: "none" });
    // deno-lint-ignore no-explicit-any
    const app = await kv.get<any>(["app", t.value]);
    if (!app.value) return json({ status: "none" });
    const bs = blockState(app.value);
    // `thread` carries the back-and-forth between tung and the applicant so the
    // pending screen can show questions and the applicant's answers.
    return json({ status: app.value.status, username: app.value.username, blocked: bs.blocked, reason: bs.reason, until: bs.until, thread: app.value.thread || [] });
  }

  // ---------- respond (applicant replies to tung's follow-up question) ----------
  // works for a PENDING applicant, identified by their token — no approval needed.
  if (req.method === "POST" && path === "/respond") {
    // deno-lint-ignore no-explicit-any
    const b: any = await req.json().catch(() => ({}));
    const token = clip(b.token, 64);
    if (!token) return json({ error: "unauthorized" }, 401);
    const t = await kv.get<string>(["tok", token]);
    if (!t.value) return json({ error: "unauthorized" }, 401);
    // deno-lint-ignore no-explicit-any
    const app = await kv.get<any>(["app", t.value]);
    if (!app.value) return json({ error: "unauthorized" }, 401);
    const text = clip(b.text, 500);
    if (!text) return json({ error: "empty" }, 400);
    const thread = (app.value.thread || []).concat([{ from: "applicant", text, ts: Date.now() }]);
    await kv.set(["app", app.value.id], { ...app.value, thread });
    return json({ ok: true, thread });
  }

  // ---------- events (poll) ----------
  // Token-only, same as /status /send /react. Username is not part of the query.
  if (req.method === "GET" && path === "/events") {
    const user = await authUser(url.searchParams.get("token"));
    if (!user) return json({ error: "unauthorized" }, 401);
    // banned / timed-out users get a blocked payload so the client shows the ban screen
    const bs = blockState(user);
    if (bs.blocked) return json({ blocked: true, reason: bs.reason, until: bs.until, events: [], cursor: Number(url.searchParams.get("since") || "0") || 0 });
    let since = Number(url.searchParams.get("since") || "0") || 0;
    // The admin dashboard (and its exports) may walk the whole retained log;
    // it proves itself with the admin key. Everyone else is held to the public
    // window, however they ask for it.
    const isAdmin = ADMIN_KEY !== "" && url.searchParams.get("key") === ADMIN_KEY;
    const events: unknown[] = [];
    let cursor = since;
    if (since <= 0) {
      // A fresh open gets exactly the public window: the last OPEN_MSGS lines
      // plus the reacts among them. No full-log dump.
      const win = await recentWindow();
      const inWindow = new Set<string>();
      for (const ev of win.events) {
        events.push(ev);
        if (ev?.type === "msg" && typeof ev.id === "string") inWindow.add(ev.id);
        if (typeof ev?.seq === "number") cursor = ev.seq;
      }
      // Which of these reactions are yours. The counts rebuild themselves from
      // the +1/-1 events, but "did I press this" is state only the server has
      // now — without it a reload would leave your own chips unlit, and pressing
      // one again would be a no-op the client could not explain.
      const mine: [string, string][] = [];
      for await (const e of kv.list<number>({ prefix: ["rx", user.id] }, { limit: 2000 })) {
        const mid = e.key[2], emo = e.key[3];
        if (typeof mid === "string" && typeof emo === "string" && inWindow.has(mid)) mine.push([mid, emo]);
      }
      return json({ events, cursor, mine });
    } else {
      // Incremental poll. A live client is only a few events behind newest, so
      // the common case serves straight from `since` with no extra work. Only
      // when a non-admin asks to reach much further back — a reconnect after
      // being away, or someone hand-editing since=1 to scrape the backlog — do
      // we pull it up to the public window's floor. That both enforces "no
      // further than the last OPEN_MSGS messages without admin" and defuses the
      // replay-from-1 read amplification, since the reach-back can no longer
      // return the whole log. The bounded catch-up scan is itself capped in KV
      // so it cannot be spun across isolates.
      if (!isAdmin) {
        const seqTip = await kv.get<number>(["seq"]);
        const newest = seqTip.value ?? 0;
        if (since < newest - 60) {
          if (!await allowGlobal("hist:" + user.id, 10, 60_000)) return tooMany(30);
          const win = await recentWindow();
          if (win.floor > 0 && since < win.floor - 1) {
            since = win.floor - 1;
            cursor = since;
          }
        }
      }
      // deno-lint-ignore no-explicit-any
      for await (const e of kv.list<any>({ prefix: ["ev"], start: ["ev", since + 1] }, { limit: HISTORY })) {
        events.push(e.value);
        cursor = e.value.seq;
      }
    }
    return json({ events, cursor });
  }

  // ---------- send ----------
  if (req.method === "POST" && path === "/send") {
    // deno-lint-ignore no-explicit-any
    const b: any = await req.json().catch(() => ({}));
    const user = await authUser(b.token);
    if (!user) return json({ error: "unauthorized" }, 401);
    const sbs = blockState(user);
    if (sbs.blocked) return json({ error: "blocked", reason: sbs.reason, until: sbs.until }, 403);
    const text = clip(b.text, 1000);
    if (!text) return json({ error: "empty" }, 400);
    // Per-account flood cap: MSG_MAX messages per MSG_WINDOW_MS. Keyed on the
    // account, not the IP or connection, so it holds whether someone spams from
    // one tab, several tabs, or a script reusing the token — and a shared
    // classroom IP is unaffected. Checked only after the message proves
    // non-empty, so empty POSTs cannot burn a real message's allowance. The
    // in-memory gate rejects a rapid burst on the spot at zero KV cost; the KV
    // gate, reached only once a send is otherwise allowed, makes the cap hold
    // across isolates so it cannot be sidestepped by fanning out. The admin key
    // posts uncapped, for moderator announcements and for seeding.
    const modPost = ADMIN_KEY !== "" && String(b.key ?? "") === ADMIN_KEY;
    if (!modPost) {
      if (!allow("msg:" + user.id, MSG_MAX, MSG_WINDOW_MS)) return tooMany(Math.ceil(MSG_WINDOW_MS / 1000));
      if (!await allowGlobal("msg:" + user.id, MSG_MAX, MSG_WINDOW_MS)) return tooMany(Math.ceil(MSG_WINDOW_MS / 1000));
    }
    // A reply used to carry the quoted name and text straight from the sender,
    // which meant anyone could post a reply block attributing any words to any
    // member — or to tung. Only the id travels now; the words are read back out
    // of what was actually posted. A quote whose message has aged out of the
    // two week window is dropped rather than invented, so the message still
    // sends, just without the quote.
    let reply: { id: string; name: string; text: string } | null = null;
    const replyId = b.reply && b.reply.id ? clip(b.reply.id, 32) : "";
    if (replyId) {
      const q = await kv.get<MsgRef>(["msg", replyId]);
      if (q.value) {
        reply = { id: replyId, name: String(q.value.name), text: String(q.value.text).slice(0, 140) };
      }
    }
    // The id is the sender's, so their own optimistic bubble matches the one
    // that comes back — but it is claimed exactly once. Without that, picking
    // an id that is already taken would overwrite another message's entry in
    // the quote index and let a reply be pointed at rewritten words.
    const id = clip(b.id, 32) || rid(8);
    const claim = await kv.atomic()
      .check({ key: ["msg", id], versionstamp: null })
      .set(["msg", id], { name: user.username, text, from: null } as MsgRef, { expireIn: TTL_MS })
      .commit();
    if (!claim.ok) return json({ error: "duplicate" }, 409);
    const posted: Record<string, unknown> = { type: "msg", id, name: user.username, text, reply };
    await appendEvent(posted);
    // tung occasionally has something to add. only ever after a real message,
    // so the room is never talking to itself.
    await maybeWisdom();
    return json({ ok: true, ts: posted.ts });
  }

  // ---------- react ----------
  // Counts are accumulated by each client from the +1/-1 events it sees, so an
  // unrecorded reaction is an unbounded one: the old route took `op` from the
  // sender and kept no state, which meant a hundred POSTs put a hundred on the
  // chip. Whether a given person has a given reaction on a given message is now
  // a fact the server holds, and the delta is derived from it — so pressing the
  // same reaction twice is a no-op, and the count can never exceed the number
  // of real members who actually pressed it.
  if (req.method === "POST" && path === "/react") {
    // deno-lint-ignore no-explicit-any
    const b: any = await req.json().catch(() => ({}));
    const user = await authUser(b.token);
    if (!user) return json({ error: "unauthorized" }, 401);
    const rbs = blockState(user);
    if (rbs.blocked) return json({ error: "blocked", reason: rbs.reason, until: rbs.until }, 403);
    const id = clip(b.id, 32);
    const e = clip(b.e, 16);
    const eid = clip(b.eid, 16) || rid(6);
    if (!id || !e) return json({ error: "bad" }, 400);
    if (!REACTIONS.has(e)) return json({ error: "not a reaction" }, 400);
    // you may only react to something that was actually said
    const target = await kv.get<MsgRef>(["msg", id]);
    if (!target.value) return json({ error: "gone" }, 404);
    if (!allow("rx:" + user.id, 30, 10_000)) return tooMany(10);
    // keyed by person first so a client can be told, on open, which of the
    // chips in front of it are its own — see the `mine` list on /events
    const key = ["rx", user.id, id, e];
    const cur = await kv.get<number>(key);
    const on = cur.value === 1;
    const wants = b.op === -1 ? false : true;
    if (on === wants) return json({ ok: true, state: on ? 1 : 0, noop: true });
    const flip = wants
      ? kv.atomic().check(cur).set(key, 1, { expireIn: TTL_MS })
      : kv.atomic().check(cur).delete(key);
    if (!(await flip.commit()).ok) return json({ ok: true, state: on ? 1 : 0, noop: true });
    await appendEvent({ type: "react", id, e, op: wants ? 1 : -1, eid, name: user.username });
    return json({ ok: true, state: wants ? 1 : 0 });
  }

  // ---------- web veil: is it open, and where does it go? ----------
  // Approved members only, and the URL ships only when the veil is actually
  // open — a closed veil never discloses the destination.
  if (req.method === "GET" && path === "/veil") {
    const user = await authUser(url.searchParams.get("token"));
    if (!user || user.status !== "approved") return json({ error: "unauthorized" }, 401);
    if (blockState(user).blocked) return json({ error: "blocked" }, 403);
    if (!await veilLive()) return json({ live: false, allowed: false });
    // The veil being open is not the same as it being open to you. Membership of
    // the whitelist is per-account and off by default, and the destination
    // travels only to someone who is on it.
    if (user.veil !== true) return json({ live: true, allowed: false });
    return json({ live: true, allowed: true, url: PROXY_URL });
  }

  // ---------- claim a giveaway ----------
  // First one here wins, and wins exactly once. The claim and the payout land
  // in a SINGLE atomic commit guarded by checks on both keys we read: if
  // anyone else took the gift, or this player's balance moved, the commit is
  // refused and we look again. That closes both races at once — two people
  // cannot both be paid, and there is no window where a gift reads as claimed
  // but was never credited.
  if (req.method === "POST" && path === "/gift/claim") {
    // deno-lint-ignore no-explicit-any
    const b: any = await req.json().catch(() => ({}));
    const user = await authUser(b.token);
    if (!user) return json({ error: "unauthorized" }, 401);
    if (blockState(user).blocked) return json({ error: "blocked" }, 403);
    const id = clip(b.id, 32);
    if (!id) return json({ error: "missing" }, 400);

    for (let attempt = 0; attempt < 8; attempt++) {
      const gift = await kv.get<Gift>(["gift", id]);
      if (!gift.value) return json({ error: "gone" }, 404);
      if (gift.value.claimedBy) return json({ error: "claimed", by: gift.value.claimedBy }, 409);
      const amount = round2(Number(gift.value.amount) || 0);
      if (!(amount > 0)) return json({ error: "gone" }, 404);

      const cur = await kv.get<{ bal: number; lastClaim: number }>(["cas", user.id]);
      const rec = cur.value ?? { bal: 0, lastClaim: 0 };
      const base = Number.isFinite(rec.bal) ? rec.bal : 0;
      const nb = round2(base + amount);
      if (!Number.isFinite(nb)) return json({ error: "gone" }, 404);

      const res = await kv.atomic()
        .check(gift)
        .check(cur)
        .set(["gift", id], { ...gift.value, claimedBy: user.username, claimedAt: Date.now() }, { expireIn: TTL_MS })
        .set(["cas", user.id], { ...rec, bal: nb }, { expireIn: CAS_TTL })
        .commit();
      if (res.ok) {
        // tell the room, so every open client retires the button at once
        await appendEvent({ type: "gift", id, by: user.username, amount });
        return json({ ok: true, amount, balance: nb, by: user.username });
      }
      // lost the check: either someone claimed it, or our own balance moved.
      // the next pass re-reads and finds out which.
    }
    return json({ error: "busy" }, 503);
  }

  // ======================= THE PIT (player vs player) =======================
  // Auth is the same casino gate as everywhere else. Every route that touches a
  // duel goes through loadDuel(), so an overdue table settles itself before the
  // request is even considered — you cannot act on a duel whose clock has run.

  // ---------- what is on offer, and what am I already in ----------
  if (req.method === "GET" && path === "/duel/list") {
    const u = await casUser(url.searchParams.get("token"));
    if (!u) return json({ error: "unauthorized" }, 401);
    const open: unknown[] = [];
    for await (const e of kv.list<Duel>({ prefix: ["duel"] }, { limit: 200 })) {
      const d = e.value;
      if (!d || d.state !== "open") continue;
      // an open table past its hour is swept here rather than shown; the host
      // gets their stake back without ever having to reopen the page
      if (Date.now() > d.deadline) { await sweepDuel(e); continue; }
      open.push({
        id: d.id, game: d.game, gameName: DUEL_GAMES[d.game]?.name || d.game,
        bet: d.bet, seats: duelSeats(d), filled: seatedPlayers(d).length,
        host: d.host.name, mine: d.host.id === u.id, ts: d.ts, deadline: d.deadline,
      });
    }
    open.sort((a, b) => (b as { ts: number }).ts - (a as { ts: number }).ts);
    const lock = await kv.get<string>(["duelof", u.id]);
    let mine = null;
    if (lock.value) {
      const d = await loadDuel(lock.value);
      // a settled duel is not "mine" any more — commitDuel drops the lock, but a
      // stale one must not pin the player out of starting another
      if (d.value && !d.value.settled) mine = duelView(d.value, u.id);
      else if (!d.value) await kv.delete(["duelof", u.id]);
    }
    const c = await getCas(u.id);
    return json({
      ok: true, balance: round2(c.bal), open, mine, now: Date.now(),
      games: Object.keys(DUEL_GAMES).map((k) => ({ id: k, name: DUEL_GAMES[k].name })),
      openMs: DUEL_OPEN_MS, confirmMs: DUEL_CONFIRM_MS, moveMs: DUEL_MOVE_MS,
      compMs: DUEL_COMP_MS, compStack: DUEL_COMP_STACK,
    });
  }

  // ---------- put a table up ----------
  if (req.method === "POST" && path === "/duel/create") {
    // deno-lint-ignore no-explicit-any
    const b: any = await req.json().catch(() => ({}));
    const u = await casUser(b.token);
    if (!u) return json({ error: "unauthorized" }, 401);
    // Churn guard only. What actually stops someone flooding the pit is the
    // one-table-at-a-time lock below; this just keeps open/cancel cycling from
    // becoming a write amplifier.
    if (!allow("duel:" + u.id, 20, 60_000)) return tooMany(30);
    const game = DUEL_GAMES[clip(b.game, 16)] ? clip(b.game, 16) : null;
    if (!game) return json({ error: "no such game" }, 400);
    const bet = parseBet(b.bet);
    if (bet === null) return json({ error: wagerError(b.bet) }, 400);
    // one table at a time. the lock is claimed in the same commit as the debit,
    // so two tabs racing to open a table cannot both stake.
    const lock = await kv.get<string>(["duelof", u.id]);
    if (lock.value) return json({ error: "already in a duel" }, 409);
    const cur = await kv.get<{ bal: number; lastClaim: number }>(["cas", u.id]);
    const rec = cur.value ?? { bal: 0, lastClaim: 0 };
    const base = Number.isFinite(rec.bal) ? rec.bal : 0;
    const nb = round2(base - bet);
    if (nb < -1e-9) return json({ error: "insufficient" }, 402);
    const now = Date.now();
    const id = rid(10);
    const want = Number(b.seats);
    const seats = game === "cut" && (want === 3 || want === 4) ? want : 2;
    const duel: Duel = {
      id, game, bet, seats, host: duelSide(u), guest: null, extra: [], state: "open", ts: now,
      deadline: now + DUEL_OPEN_MS, round: 1, settled: false, winner: null, reason: "", rounds: [],
    };
    const res = await kv.atomic()
      .check(lock).check(cur)
      .set(["duelof", u.id], id, { expireIn: DUEL_TTL })
      .set(["cas", u.id], { ...rec, bal: Math.max(0, nb) }, { expireIn: CAS_TTL })
      .set(["duel", id], duel, { expireIn: DUEL_TTL })
      .commit();
    if (!res.ok) return json({ error: "busy" }, 409);
    return json({ ok: true, duel: duelView(duel, u.id), balance: Math.max(0, nb) });
  }

  // ---------- take the table back down ----------
  // Only while it is still filling. A 2-seat table stops being open the
  // instant someone sits, so a cancel cannot slip in after the handshake
  // starts. A 3- or 4-seat Cut stays open until the last chair is taken,
  // and taking it down refunds everyone who already sat.
  if (req.method === "POST" && path === "/duel/cancel") {
    // deno-lint-ignore no-explicit-any
    const b: any = await req.json().catch(() => ({}));
    const u = await casUser(b.token);
    if (!u) return json({ error: "unauthorized" }, 401);
    const entry = await loadDuel(clip(b.id, 32));
    const d = entry.value;
    if (!d) return json({ error: "gone" }, 404);
    if (d.host.id !== u.id) return json({ error: "not yours" }, 403);
    if (d.settled) return json({ error: "over", duel: duelView(d, u.id) }, 409);
    if (d.state !== "open") return json({ error: "someone is at the table", duel: duelView(d, u.id) }, 409);
    const out = finishDuel(d, null, "cancelled");
    if (!await commitDuel(entry, out.next, out.credits)) {
      const again = await loadDuel(d.id);
      return json({ error: "someone is at the table", duel: again.value ? duelView(again.value, u.id) : null }, 409);
    }
    return json({ ok: true, refunded: d.bet, balance: round2((await getCas(u.id)).bal) });
  }

  // ---------- sit down at someone else's table ----------
  if (req.method === "POST" && path === "/duel/join") {
    // deno-lint-ignore no-explicit-any
    const b: any = await req.json().catch(() => ({}));
    const u = await casUser(b.token);
    if (!u) return json({ error: "unauthorized" }, 401);
    // a 3- or 4-seat table can take two sit-downs at once, so a lost race
    // against another empty chair is retried rather than called taken
    for (let attempt = 0; attempt < 6; attempt++) {
      const entry = await loadDuel(clip(b.id, 32));
      const d = entry.value;
      if (!d) return json({ error: "gone" }, 404);
      if (d.state !== "open") return json({ error: "taken" }, 409);
      if (d.host.id === u.id) return json({ error: "that is your own table" }, 400);
      if (findSide(d, u.id)) return json({ error: "already in a duel" }, 409);
      if (seatedPlayers(d).length >= duelSeats(d)) return json({ error: "taken" }, 409);
      const lock = await kv.get<string>(["duelof", u.id]);
      if (lock.value) return json({ error: "already in a duel" }, 409);
      const cur = await kv.get<{ bal: number; lastClaim: number }>(["cas", u.id]);
      const rec = cur.value ?? { bal: 0, lastClaim: 0 };
      const bal = Number.isFinite(rec.bal) ? rec.bal : 0;
      const nb = round2(bal - d.bet);
      if (nb < -1e-9) return json({ error: "insufficient" }, 402);
      const extra = extraOf(d).map((s) => ({ ...s }));
      let guest = d.guest ? { ...d.guest } : null;
      if (!guest) guest = duelSide(u);
      else extra.push(duelSide(u));
      const filled = 1 + (guest ? 1 : 0) + extra.length;
      const full = filled >= duelSeats(d);
      const now = Date.now();
      const next: Duel = {
        ...d, guest, extra,
        state: full ? "confirm" : "open",
        deadline: full ? now + DUEL_CONFIRM_MS : d.deadline,
      };
      // seat, stake and lock in one commit: two people racing for the last
      // seat means exactly one debit, and the loser is told the table is taken.
      const res = await kv.atomic()
        .check(entry).check(lock).check(cur)
        .set(["duelof", u.id], d.id, { expireIn: DUEL_TTL })
        .set(["cas", u.id], { ...rec, bal: Math.max(0, nb) }, { expireIn: CAS_TTL })
        .set(["duel", d.id], next, { expireIn: DUEL_TTL })
        .commit();
      if (res.ok) return json({ ok: true, duel: duelView(next, u.id), balance: Math.max(0, nb) });
    }
    return json({ error: "taken" }, 409);
  }

  // ---------- both of you, say yes, within ten seconds ----------
  if (req.method === "POST" && path === "/duel/confirm") {
    // deno-lint-ignore no-explicit-any
    const b: any = await req.json().catch(() => ({}));
    const u = await casUser(b.token);
    if (!u) return json({ error: "unauthorized" }, 401);
    for (let attempt = 0; attempt < 6; attempt++) {
      const entry = await loadDuel(clip(b.id, 32));
      const d = entry.value;
      if (!d) return json({ error: "gone" }, 404);
      if (d.settled) return json({ error: "over", duel: duelView(d, u.id) }, 409);
      if (d.state !== "confirm") return json({ error: "not now", duel: duelView(d, u.id) }, 409);
      const next: Duel = {
        ...d,
        host: { ...d.host },
        guest: d.guest ? { ...d.guest } : null,
        extra: extraOf(d).map((s) => ({ ...s })),
      };
      const mine = findSide(next, u.id);
      if (!mine) return json({ error: "not your duel" }, 403);
      mine.confirmed = true;
      const people = seatedPlayers(next);
      const allIn = people.length >= duelSeats(next) && people.every((p) => p.confirmed);
      let credits: { id: string; amount: number }[] = [];
      if (allIn && d.game === "cut") {
        // no moves to make: the deck is cut the instant the last yes lands, in
        // the same commit, so there is no unsettled window to time out inside
        const cut = cutDealFor(people);
        const done = finishDuel({ ...next, cards: cut.cards }, cut.winnerId, "play");
        done.next.cards = cut.cards;
        credits = done.credits;
        Object.assign(next, done.next);
      } else if (allIn && d.game === "comp") {
        // three minutes on the clock and a stack of wood chips each, dealt in the
        // same commit as the last yes so nobody starts a tick early
        next.state = "live";
        next.deadline = Date.now() + DUEL_COMP_MS;
        for (const pl of seatedPlayers(next)) pl.chips = DUEL_COMP_STACK;
      } else if (allIn) {
        next.state = "live";
        next.deadline = Date.now() + DUEL_MOVE_MS;
      }
      if (await commitDuel(entry, next, credits)) {
        return json({ ok: true, duel: duelView(next, u.id), balance: round2((await getCas(u.id)).bal) });
      }
    }
    return json({ error: "busy" }, 503);
  }

  // ---------- play a hand ----------
  if (req.method === "POST" && path === "/duel/move") {
    // deno-lint-ignore no-explicit-any
    const b: any = await req.json().catch(() => ({}));
    const u = await casUser(b.token);
    if (!u) return json({ error: "unauthorized" }, 401);
    const move = clip(b.move, 16);
    for (let attempt = 0; attempt < 6; attempt++) {
      const entry = await loadDuel(clip(b.id, 32));
      const d = entry.value;
      if (!d) return json({ error: "gone" }, 404);
      if (d.settled) return json({ error: "over", duel: duelView(d, u.id) }, 409);
      if (d.state !== "live") return json({ error: "not now", duel: duelView(d, u.id) }, 409);
      const cfg = DUEL_GAMES[d.game];
      if (!cfg || cfg.moves.indexOf(move) < 0) return json({ error: "not a move" }, 400);
      const mine = d.host.id === u.id ? "host" : (d.guest && d.guest.id === u.id ? "guest" : null);
      if (!mine) return json({ error: "not your duel" }, 403);
      const me = mine === "host" ? d.host : d.guest!;
      // one pick per round, and it is final. re-sending is not a way to see
      // their answer first and then change yours.
      if (me.move !== null) return json({ error: "already played", duel: duelView(d, u.id) }, 409);
      const next: Duel = {
        ...d, host: { ...d.host }, guest: d.guest ? { ...d.guest } : null, rounds: d.rounds.slice(),
      };
      if (mine === "host") next.host.move = move; else next.guest!.move = move;
      let credits: { id: string; amount: number }[] = [];
      const hm = next.host.move, gm = next.guest!.move;
      if (hm !== null && gm !== null) {
        // both are in, so the round can be read. a tie is not a round: it is
        // wiped and replayed, on a fresh clock.
        const hostTakes = TUNG_BEATS[hm] === gm;
        const guestTakes = TUNG_BEATS[gm] === hm;
        next.rounds.push({
          host: hm, guest: gm,
          won: hostTakes ? next.host.name : (guestTakes ? next.guest!.name : null),
        });
        if (hostTakes) next.host.wins += 1;
        if (guestTakes) next.guest!.wins += 1;
        next.host.move = null;
        next.guest!.move = null;
        if (next.host.wins >= cfg.target || next.guest!.wins >= cfg.target) {
          const winner = next.host.wins >= cfg.target ? next.host.id : next.guest!.id;
          const done = finishDuel(next, winner, "play");
          credits = done.credits;
          Object.assign(next, done.next);
        } else {
          if (hostTakes || guestTakes) next.round += 1;
          next.deadline = Date.now() + DUEL_MOVE_MS;
        }
      }
      if (await commitDuel(entry, next, credits)) {
        return json({ ok: true, duel: duelView(next, u.id), balance: round2((await getCas(u.id)).bal) });
      }
    }
    return json({ error: "busy" }, 503);
  }

  // ---------- watch the clock ----------
  if (req.method === "GET" && path === "/duel/state") {
    const u = await casUser(url.searchParams.get("token"));
    if (!u) return json({ error: "unauthorized" }, 401);
    const entry = await loadDuel(clip(url.searchParams.get("id"), 32));
    const d = entry.value;
    if (!d) return json({ error: "gone" }, 404);
    if (!findSide(d, u.id)) {
      return json({ error: "not your duel" }, 403);
    }
    return json({ ok: true, duel: duelView(d, u.id), balance: round2((await getCas(u.id)).bal) });
  }

  // ---------- which skins this member may wear ----------
  // Every theme the shrine has, each marked owned or not, and for the locked
  // ones whatever the shop is currently asking. The settings page draws its
  // list straight from this, so a theme that is not on sale reads as locked
  // with nothing to click rather than as a button that quietly does nothing.
  if (req.method === "GET" && path === "/themes") {
    const u = await casUser(url.searchParams.get("token"));
    if (!u) return json({ error: "unauthorized" }, 401);
    // what the shop is selling, by theme
    const forSale = new Map<string, { itemId: string; price: number; name: string }>();
    // deno-lint-ignore no-explicit-any
    for await (const e of kv.list<any>({ prefix: ["shopitem"] })) {
      const th = String(e.value?.theme || "");
      if (!th || !e.value.active) continue;
      const price = round2(Number(e.value.price));
      const cur = forSale.get(th);
      // if two items grant the same theme, quote the cheaper one
      if (!cur || price < cur.price) forSale.set(th, { itemId: e.value.id, price, name: e.value.name });
    }
    const themes = [];
    for (const t of SHRINE_THEMES) {
      const owned = await ownsTheme(u.id, t.id);
      const sale = forSale.get(t.id) || null;
      themes.push({
        id: t.id, name: t.name, note: t.note, free: !!t.free, owned,
        price: !owned && sale ? sale.price : null,
        itemName: !owned && sale ? sale.name : null,
      });
    }
    return json({ ok: true, themes, balance: round2((await getCas(u.id)).bal) });
  }

  // ---------- admin ----------
  if (req.method === "GET" && path === "/admin") {
    // Full admin HTML is ~20KB. Serving it to every scanner was free egress.
    // Without a matching key, return a tiny gate instead.
    const key = url.searchParams.get("key") || "";
    if (!ADMIN_KEY || key !== ADMIN_KEY) {
      return new Response(ADMIN_GATE, {
        status: key ? 401 : 200,
        headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
      });
    }
    return new Response(ADMIN_HTML, {
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
    });
  }
  if (req.method === "GET" && path === "/admin/pending") {
    if (!ADMIN_KEY || url.searchParams.get("key") !== ADMIN_KEY) return json({ error: "forbidden" }, 403);
    const pending: unknown[] = [];
    // deno-lint-ignore no-explicit-any
    for await (const e of kv.list<any>({ prefix: ["app"] })) {
      if (e.value.status === "pending") {
        pending.push({ id: e.value.id, username: e.value.username, application: e.value.application, ts: e.value.ts, thread: e.value.thread || [] });
      }
    }
    // deno-lint-ignore no-explicit-any
    pending.sort((a: any, b: any) => a.ts - b.ts);
    return json({ pending });
  }

  // ---------- admin: dump retained chat (not part of the other list loads) ----------
  if (req.method === "GET" && path === "/admin/chat") {
    if (!ADMIN_KEY || url.searchParams.get("key") !== ADMIN_KEY) return json({ error: "forbidden" }, 403);
    const messages = await listChatMessages();
    return json({ messages, count: messages.length });
  }

  // ---------- admin: wipe the chat log ----------
  // Drops every retained event — messages and the reactions on them alike.
  // The ["seq"] counter deliberately survives: it is what every connected
  // client is holding as its cursor, and winding it back would make the next
  // messages reuse seq numbers those clients have already passed, so they would
  // never see them. Leaving it be means an open chat simply goes quiet until
  // someone speaks again. Accounts, balances and shop items are untouched.
  if (req.method === "POST" && path === "/admin/clearchat") {
    // deno-lint-ignore no-explicit-any
    const b: any = await req.json().catch(() => ({}));
    if (!ADMIN_KEY || b.key !== ADMIN_KEY) return json({ error: "forbidden" }, 403);
    let cleared = 0;
    for await (const e of kv.list({ prefix: ["ev"] })) {
      await kv.delete(e.key);
      cleared++;
    }
    return json({ ok: true, cleared });
  }

  // ---------- admin: read / flip the web veil ----------
  // `configured` tells the dashboard whether PROXY_URL is set at all, without
  // ever handing the URL itself to the page.
  // ---------- post a message as somebody else ----------
  // The one place in the app where a message's author is not the account that
  // sent the request. Key-gated, and deliberately narrow: the name has to
  // belong to a real approved member (or be tung himself), so this cannot
  // conjure a line from an account that never existed. It is a moderator tool
  // for seeding and for putting words in tung's mouth on purpose — every other
  // route derives the author from the token and always will.
  if (req.method === "POST" && path === "/admin/postas") {
    // deno-lint-ignore no-explicit-any
    const b: any = await req.json().catch(() => ({}));
    if (!ADMIN_KEY || b.key !== ADMIN_KEY) return json({ error: "forbidden" }, 403);
    const asName = clip(b.username, 24);
    const text = clip(b.text, 1000);
    if (!asName || !text) return json({ error: "missing" }, 400);
    // tung is not a member and has no record to look up, so he is named here
    const asTung = impersonatesTung(asName);
    let name = WISDOM_NAME;
    if (!asTung) {
      const app = await findApprovedByUsername(asName);
      if (!app) return json({ error: "no such member" }, 404);
      name = app.username;       // use their real casing, not what was typed
    }
    // the quote is resolved the same way an ordinary send resolves it: nobody,
    // admin included, gets to write words into somebody else's mouth twice over
    let reply: { id: string; name: string; text: string } | null = null;
    const replyId = b.replyTo ? clip(b.replyTo, 32) : "";
    if (replyId) {
      const q = await kv.get<MsgRef>(["msg", replyId]);
      if (!q.value) return json({ error: "no such message" }, 404);
      reply = { id: replyId, name: String(q.value.name), text: String(q.value.text).slice(0, 140) };
    }
    const id = rid(8);
    await appendEvent({
      type: "msg", id, name, text, reply,
      from: asTung ? "tung" : null,
    });
    return json({ ok: true, id, username: name, tung: asTung });
  }

  if (req.method === "GET" && path === "/admin/veil") {
    if (!ADMIN_KEY || url.searchParams.get("key") !== ADMIN_KEY) return json({ error: "forbidden" }, 403);
    const f = await kv.get<boolean>(["veil", "live"]);
    return json({ live: f.value === true, configured: PROXY_URL !== "" });
  }
  if (req.method === "POST" && path === "/admin/veil") {
    // deno-lint-ignore no-explicit-any
    const b: any = await req.json().catch(() => ({}));
    if (!ADMIN_KEY || b.key !== ADMIN_KEY) return json({ error: "forbidden" }, 403);
    const live = b.live === true;
    await kv.set(["veil", "live"], live);
    return json({ ok: true, live, configured: PROXY_URL !== "" });
  }

  // ---------- admin: send a follow-up message/question to an applicant ----------
  if (req.method === "POST" && path === "/admin/message") {
    // deno-lint-ignore no-explicit-any
    const b: any = await req.json().catch(() => ({}));
    if (!ADMIN_KEY || b.key !== ADMIN_KEY) return json({ error: "forbidden" }, 403);
    // deno-lint-ignore no-explicit-any
    const app = await kv.get<any>(["app", clip(b.id, 32)]);
    if (!app.value) return json({ error: "not found" }, 404);
    const text = clip(b.text, 1000);
    if (!text) return json({ error: "empty" }, 400);
    const thread = (app.value.thread || []).concat([{ from: "admin", text, ts: Date.now() }]);
    await kv.set(["app", app.value.id], { ...app.value, thread });
    return json({ ok: true, thread });
  }
  if (req.method === "POST" && path === "/admin/decide") {
    // deno-lint-ignore no-explicit-any
    const b: any = await req.json().catch(() => ({}));
    if (!ADMIN_KEY || b.key !== ADMIN_KEY) return json({ error: "forbidden" }, 403);
    // deno-lint-ignore no-explicit-any
    const app = await kv.get<any>(["app", clip(b.id, 32)]);
    if (!app.value) return json({ error: "not found" }, 404);
    const status = b.action === "approve" ? "approved" : "rejected";
    await kv.set(["app", app.value.id], { ...app.value, status });
    return json({ ok: true, status });
  }

  // ---------- admin: send an approved user back to review (pending) ----------
  // flips status to "pending" so they drop back to the application screen where
  // the follow-up thread lives. their token + thread are kept, so the existing
  // conversation carries over and they can answer new questions.
  if (req.method === "POST" && path === "/admin/repend") {
    // deno-lint-ignore no-explicit-any
    const b: any = await req.json().catch(() => ({}));
    if (!ADMIN_KEY || b.key !== ADMIN_KEY) return json({ error: "forbidden" }, 403);
    // deno-lint-ignore no-explicit-any
    const app = await kv.get<any>(["app", clip(b.id, 32)]);
    if (!app.value) return json({ error: "not found" }, 404);
    await kv.set(["app", app.value.id], { ...app.value, status: "pending" });
    return json({ ok: true, status: "pending" });
  }

  // ---------- admin: list approved users (with ban/timeout state) ----------
  // powers the "approved users" panel. each row carries banned + timeoutUntil
  // so the admin can see who is currently blocked and until when.
  if (req.method === "GET" && path === "/admin/users") {
    if (!ADMIN_KEY || url.searchParams.get("key") !== ADMIN_KEY) return json({ error: "forbidden" }, 403);
    const users: unknown[] = [];
    // deno-lint-ignore no-explicit-any
    for await (const e of kv.list<any>({ prefix: ["app"] })) {
      if (e.value.status === "approved") {
        users.push({
          id: e.value.id, username: e.value.username, ts: e.value.ts,
          banned: !!e.value.banned, timeoutUntil: e.value.timeoutUntil || 0,
          note: e.value.note || "", veil: e.value.veil === true,
        });
      }
    }
    // deno-lint-ignore no-explicit-any
    users.sort((a: any, b: any) => a.username.toLowerCase().localeCompare(b.username.toLowerCase()));
    return json({ users });
  }

  // ---------- admin: ban / unban a user (permanent block) ----------
  if (req.method === "POST" && path === "/admin/ban") {
    // deno-lint-ignore no-explicit-any
    const b: any = await req.json().catch(() => ({}));
    if (!ADMIN_KEY || b.key !== ADMIN_KEY) return json({ error: "forbidden" }, 403);
    // deno-lint-ignore no-explicit-any
    const app = await kv.get<any>(["app", clip(b.id, 32)]);
    if (!app.value) return json({ error: "not found" }, 404);
    const banned = b.banned !== false; // default true; pass banned:false to unban
    await kv.set(["app", app.value.id], { ...app.value, banned });
    return json({ ok: true, banned });
  }

  // ---------- admin: delete a user entirely ----------
  // removes the application record, frees the username, revokes every token
  // pointing at it, and wipes their casino balance / in-progress hands so they
  // cannot linger on the admin balances pane as "(deleted)".
  if (req.method === "POST" && path === "/admin/delete") {
    // deno-lint-ignore no-explicit-any
    const b: any = await req.json().catch(() => ({}));
    if (!ADMIN_KEY || b.key !== ADMIN_KEY) return json({ error: "forbidden" }, 403);
    const id = clip(b.id, 32);
    // deno-lint-ignore no-explicit-any
    const app = await kv.get<any>(["app", id]);
    if (!app.value) return json({ error: "not found" }, 404);
    const lower = String(app.value.username).toLowerCase();
    const atomic = kv.atomic()
      .delete(["app", id])
      .delete(["name", lower])
      .delete(["cas", id])
      .delete(["bj", id])
      .delete(["mines", id])
      .delete(["beef", id]);
    for await (const e of kv.list<string>({ prefix: ["tok"] })) {
      if (e.value === id) atomic.delete(e.key);
    }
    await atomic.commit();
    return json({ ok: true, deleted: true });
  }

  // ---------- admin: attach a private note to a user ----------
  if (req.method === "POST" && path === "/admin/note") {
    // deno-lint-ignore no-explicit-any
    const b: any = await req.json().catch(() => ({}));
    if (!ADMIN_KEY || b.key !== ADMIN_KEY) return json({ error: "forbidden" }, 403);
    // deno-lint-ignore no-explicit-any
    const app = await kv.get<any>(["app", clip(b.id, 32)]);
    if (!app.value) return json({ error: "not found" }, 404);
    const note = clip(b.note, 500); // admin-only; never sent to the user
    await kv.set(["app", app.value.id], { ...app.value, note });
    return json({ ok: true, note });
  }

  // ---------- admin: let one user through the web veil ----------
  // Off by default and independent of the global switch: both have to be on
  // before anyone reaches the destination.
  if (req.method === "POST" && path === "/admin/veiluser") {
    // deno-lint-ignore no-explicit-any
    const b: any = await req.json().catch(() => ({}));
    if (!ADMIN_KEY || b.key !== ADMIN_KEY) return json({ error: "forbidden" }, 403);
    // deno-lint-ignore no-explicit-any
    const app = await kv.get<any>(["app", clip(b.id, 32)]);
    if (!app.value) return json({ error: "not found" }, 404);
    const veil = b.allowed === true;
    await kv.set(["app", app.value.id], { ...app.value, veil });
    return json({ ok: true, veil });
  }

  // ---------- admin: time a user out until a timestamp (ms epoch) ----------
  if (req.method === "POST" && path === "/admin/timeout") {
    // deno-lint-ignore no-explicit-any
    const b: any = await req.json().catch(() => ({}));
    if (!ADMIN_KEY || b.key !== ADMIN_KEY) return json({ error: "forbidden" }, 403);
    // deno-lint-ignore no-explicit-any
    const app = await kv.get<any>(["app", clip(b.id, 32)]);
    if (!app.value) return json({ error: "not found" }, 404);
    const until = Number(b.until) > 0 ? Math.floor(Number(b.until)) : 0; // 0 clears the timeout
    await kv.set(["app", app.value.id], { ...app.value, timeoutUntil: until });
    return json({ ok: true, timeoutUntil: until });
  }

  // ---------- admin: rename an existing user ----------
  // moves the ["name", lowercase] reservation to the new spelling (guarding
  // against collisions) and updates the display name on the ["app", id] record.
  if (req.method === "POST" && path === "/admin/rename") {
    // deno-lint-ignore no-explicit-any
    const b: any = await req.json().catch(() => ({}));
    if (!ADMIN_KEY || b.key !== ADMIN_KEY) return json({ error: "forbidden" }, 403);
    const id = clip(b.id, 32);
    const username = clip(b.username, 24);
    if (!id || !username) return json({ error: "missing" }, 400);
    if (impersonatesTung(username)) return json({ error: "that name is his. pick another." }, 409);
    // deno-lint-ignore no-explicit-any
    const app = await kv.get<any>(["app", id]);
    if (!app.value) return json({ error: "not found" }, 404);
    const oldLower = String(app.value.username).toLowerCase();
    const newLower = username.toLowerCase();
    if (newLower === oldLower) {
      // same name (maybe just casing): update the display value, leave the reservation
      await kv.set(["app", id], { ...app.value, username });
      return json({ ok: true, username });
    }
    const taken = await kv.get<string>(["name", newLower]);
    if (taken.value) {
      if (taken.value === id) { await kv.set(["app", id], { ...app.value, username }); return json({ ok: true, username }); }
      return json({ error: "username taken" }, 409);
    }
    const res = await kv.atomic()
      .check({ key: ["name", newLower], versionstamp: null })
      .delete(["name", oldLower])
      .set(["name", newLower], id)
      .set(["app", id], { ...app.value, username })
      .commit();
    if (!res.ok) return json({ error: "username taken" }, 409);
    return json({ ok: true, username });
  }

  if (req.method === "POST" && path === "/admin/clear") {
    // deno-lint-ignore no-explicit-any
    const b: any = await req.json().catch(() => ({}));
    if (!ADMIN_KEY || b.key !== ADMIN_KEY) return json({ error: "forbidden" }, 403);
    let n = 0;
    for (const prefix of [["app"], ["name"], ["tok"]]) {
      for await (const e of kv.list({ prefix })) {
        await kv.delete(e.key);
        n++;
      }
    }
    return json({ ok: true, cleared: n });
  }

  // ======================= TUNG'S CASINO (fun money) =======================

  // ---------- my balance + faucet clock ----------
  if (req.method === "GET" && path === "/cas/me") {
    const u = await casUser(url.searchParams.get("token"));
    if (!u) return json({ error: "unauthorized" }, 401);
    // ask about the round FIRST: it may be overdue, and settling it pays a pot
    // that the balance below has to already know about
    const round = await liveComp(u.id);
    const c = await getCas(u.id);
    const next = c.lastClaim + FAUCET_INTERVAL;
    return json({
      username: u.username, balance: round2(c.bal),
      canClaim: Date.now() >= next, nextClaim: c.lastClaim ? next : 0,
      faucetAmount: FAUCET_AMOUNT, faucetInterval: FAUCET_INTERVAL,
      round: round ? duelView(round, u.id) : null,
    });
  }

  // ---------- Shrine of Sahur: claim the free faucet ----------
  if (req.method === "POST" && path === "/cas/claim") {
    // deno-lint-ignore no-explicit-any
    const b: any = await req.json().catch(() => ({}));
    const u = await casUser(b.token);
    if (!u) return json({ error: "unauthorized" }, 401);
    // guard the faucet clock atomically so a double-click can't double-claim
    for (;;) {
      const cur = await kv.get<{ bal: number; lastClaim: number }>(["cas", u.id]);
      const rec = cur.value ?? { bal: 0, lastClaim: 0 };
      const now = Date.now();
      const next = rec.lastClaim + FAUCET_INTERVAL;
      if (rec.lastClaim && now < next) return json({ error: "cooldown", nextClaim: next }, 429);
      const nb = round2(rec.bal + FAUCET_AMOUNT);
      const res = await kv.atomic().check(cur)
        .set(["cas", u.id], { bal: nb, lastClaim: now }, { expireIn: CAS_TTL }).commit();
      if (res.ok) return json({ ok: true, balance: nb, claimed: FAUCET_AMOUNT, nextClaim: now + FAUCET_INTERVAL });
    }
  }

  // ---------- tip / donate sahurs to another approved member ----------
  // Auth required (same gate as casino/chat). Profile lookup is members-only and
  // returns username + registration date + current balance so the tip UI can confirm
  // the recipient before posting. Transfer is a single atomic debit+credit.
  if (req.method === "GET" && path === "/tip/profile") {
    const u = await casUser(url.searchParams.get("token"));
    if (!u) return json({ error: "unauthorized" }, 401);
    const name = clip(url.searchParams.get("user") || url.searchParams.get("username"), 24);
    if (!name) return json({ error: "invalid" }, 400);
    const app = await findApprovedByUsername(name);
    if (!app) return json({ error: "not_found" }, 404);
    const c = await getCas(app.id);
    return json({
      username: app.username,
      createdAt: Number(app.ts) || 0,
      registeredAt: Number(app.ts) || 0,
      balance: round2(c.bal),
      self: app.id === u.id,
    });
  }
  if (req.method === "POST" && path === "/tip") {
    // deno-lint-ignore no-explicit-any
    const b: any = await req.json().catch(() => ({}));
    const u = await casUser(b.token);
    if (!u) return json({ error: "unauthorized" }, 401);
    const toName = clip(b.to ?? b.username, 24);
    const amount = parseBet(b.amount); // same min/max + finite checks as casino wagers
    if (!toName || amount === null) return json({ error: "invalid" }, 400);
    if (toName.toLowerCase() === String(u.username).toLowerCase()) {
      return json({ error: "self" }, 400);
    }
    const tipId = clip(b.tipId, 64);
    if (tipId && tipId.length < 8) return json({ error: "invalid" }, 400);
    const app = await findApprovedByUsername(toName);
    if (!app) return json({ error: "not_found" }, 404);
    if (app.id === u.id) return json({ error: "self" }, 400);
    const moved = await transferBalance(u.id, app.id, amount, tipId || undefined);
    if (moved === "insufficient") return json({ error: "insufficient" }, 402);
    if (!moved) return json({ error: "invalid" }, 400);
    return json({
      ok: true,
      amount,
      to: app.username,
      fromBalance: round2(moved.from),
      toBalance: round2(moved.to),
      replay: !!moved.replay,
    });
  }

  // ---------- DICE (roll under) — instant ----------
  if (req.method === "POST" && path === "/cas/dice") {
    // deno-lint-ignore no-explicit-any
    const b: any = await req.json().catch(() => ({}));
    const u = await casUser(b.token);
    if (!u) return json({ error: "unauthorized" }, 401);
    const bet = parseBet(b.bet);
    if (bet === null) return json({ error: wagerError(b.bet) }, 400);
    const target = round2(Number(b.target));
    const over = b.over === true;             // false = roll under, true = roll over
    if (!(target >= 2 && target <= 98)) return json({ error: "target 2–98" }, 400);
    // winning span as a percentage of the 0–100 roll range
    const chance = over ? 100 - target : target;
    if (!(chance >= 2 && chance <= 98)) return json({ error: "bad target" }, 400);
    const purse = await purseFor(u.id, b.round);
    const no = await purse.take(bet);
    if (no) return json({ error: no }, no === "insufficient" ? 402 : 409);
    const roll = round2(rnd() * 100);
    const win = over ? roll > target : roll < target;
    const exact = (100 / chance) * HOUSE;
    const mult = win ? round2(exact) : 0;
    const payout = win ? payoutOf(bet, exact) : 0;
    await purse.give(payout);
    return json({ ok: true, roll, target, over, chance, win, multiplier: mult, payout, balance: purse.bal, ...purseJson(purse) });
  }

  // ---------- LIMBO — instant ----------
  if (req.method === "POST" && path === "/cas/limbo") {
    // deno-lint-ignore no-explicit-any
    const b: any = await req.json().catch(() => ({}));
    const u = await casUser(b.token);
    if (!u) return json({ error: "unauthorized" }, 401);
    const bet = parseBet(b.bet);
    if (bet === null) return json({ error: wagerError(b.bet) }, 400);
    const target = round2(Number(b.target)); // desired cash-out multiplier
    if (!(target >= 1.01 && target <= 1000000)) return json({ error: "target 1.01–1e6" }, 400);
    const purse = await purseFor(u.id, b.round);
    const no = await purse.take(bet);
    if (no) return json({ error: no }, no === "insufficient" ? 402 : 409);
    // crash point c with P(c >= t) = HOUSE/t  → fair, 0.1% edge. The win MUST be
    // decided on the exact crash: comparing the 2dp-rounded value let a 1.996
    // round up to 2.00 and clear a 2.00 target it should have missed, which
    // handed the player back part of the edge (worse the lower the target —
    // 99.25% RTP at 2×, 99.49% at 1.10×). Floor the displayed value so what the
    // player sees never rounds up past the real crash either.
    const crashExact = Math.max(1, HOUSE / (1 - rnd()));
    const win = crashExact >= target;
    const crash = floor2(crashExact);
    const payout = win ? payoutOf(bet, target) : 0;
    await purse.give(payout);
    return json({ ok: true, crash, target, win, multiplier: win ? target : 0, payout, balance: purse.bal, ...purseJson(purse) });
  }

  // ---------- ROULETTE (European single-zero) — instant ----------
  if (req.method === "POST" && path === "/cas/roulette") {
    // deno-lint-ignore no-explicit-any
    const b: any = await req.json().catch(() => ({}));
    const u = await casUser(b.token);
    if (!u) return json({ error: "unauthorized" }, 401);
    const bet = parseBet(b.bet);
    if (bet === null) return json({ error: wagerError(b.bet) }, 400);
    const kind = clip(b.kind, 12);   // number|red|black|odd|even|low|high|dozen|column
    const val = Math.floor(Number(b.value)); // for number(0-36), dozen(1-3), column(1-3)
    // resolve payout multiplier (winnings-to-stake) for each bet kind
    const spin = rndInt(37);
    const isRed = RED.has(spin), zero = spin === 0;
    // Roulette keeps the true single-zero wheel: flat 2×/3×/36× payouts with a
    // green zero. The edge is structural (the zero), a fixed ~2.70% on every
    // bet, and is deliberately NOT flattened to the 0.1% the other games use.
    let won = false, mult = 0;
    if (kind === "number") { if (!(val >= 0 && val <= 36)) return json({ error: "number 0–36" }, 400); won = spin === val; mult = 36; }
    else if (kind === "red") { won = isRed; mult = 2; }
    else if (kind === "black") { won = !isRed && !zero; mult = 2; }
    else if (kind === "odd") { won = !zero && spin % 2 === 1; mult = 2; }
    else if (kind === "even") { won = !zero && spin % 2 === 0; mult = 2; }
    else if (kind === "low") { won = spin >= 1 && spin <= 18; mult = 2; }
    else if (kind === "high") { won = spin >= 19 && spin <= 36; mult = 2; }
    else if (kind === "dozen") { if (!(val >= 1 && val <= 3)) return json({ error: "dozen 1–3" }, 400); won = !zero && Math.ceil(spin / 12) === val; mult = 3; }
    else if (kind === "column") { if (!(val >= 1 && val <= 3)) return json({ error: "column 1–3" }, 400); won = !zero && spin % 3 === (val % 3); mult = 3; }
    else return json({ error: "bad kind" }, 400);
    const purse = await purseFor(u.id, b.round);
    const no = await purse.take(bet);
    if (no) return json({ error: no }, no === "insufficient" ? 402 : 409);
    const payout = won ? payoutOf(bet, mult) : 0;
    await purse.give(payout);
    return json({ ok: true, spin, color: zero ? "green" : (isRed ? "red" : "black"), win: won, multiplier: won ? mult : 0, payout, balance: purse.bal, ...purseJson(purse) });
  }

  // ---------- PLINKO — instant ----------
  if (req.method === "POST" && path === "/cas/plinko") {
    // deno-lint-ignore no-explicit-any
    const b: any = await req.json().catch(() => ({}));
    const u = await casUser(b.token);
    if (!u) return json({ error: "unauthorized" }, 401);
    const bet = parseBet(b.bet);
    if (bet === null) return json({ error: wagerError(b.bet) }, 400);
    const risk = clip(b.risk, 8);
    const rows = Math.floor(Number(b.rows));
    const riskTab = pick(PLINKO, risk);
    const table = riskTab ? pick(riskTab, rows) : null;
    if (!table) return json({ error: "rows 8/12/16, risk low/medium/high" }, 400);
    const purse = await purseFor(u.id, b.round);
    const no = await purse.take(bet);
    if (no) return json({ error: no }, no === "insufficient" ? 402 : 409);
    const path2: number[] = [];
    let bucket = 0;
    for (let i = 0; i < rows; i++) { const r = rnd() < 0.5 ? 1 : 0; path2.push(r); bucket += r; }
    // correct the raw table to exactly HOUSE (risk/rows validated above)
    const exact = table[bucket] * PLINKO_CORR[risk][rows];
    const payout = payoutOf(bet, exact);
    await purse.give(payout);
    return json({ ok: true, path: path2, bucket, multiplier: round2(exact), payout, balance: purse.bal, ...purseJson(purse) });
  }

  // ---------- BLACKJACK (start / hit / stand / double) ----------
  if (req.method === "POST" && path === "/cas/bj/start") {
    // deno-lint-ignore no-explicit-any
    const b: any = await req.json().catch(() => ({}));
    const u = await casUser(b.token);
    if (!u) return json({ error: "unauthorized" }, 401);
    const bet = parseBet(b.bet);
    if (bet === null) return json({ error: wagerError(b.bet) }, 400);
    const purse = await purseFor(u.id, b.round);
    // deno-lint-ignore no-explicit-any
    const held = await kv.get<any>(["bj", u.id]);
    const clash = stakeClash(held.value, purse);
    if (clash) return json({ error: clash }, 409);
    const no = await purse.take(bet);
    if (no) return json({ error: no }, no === "insufficient" ? 402 : 409);
    const player = [drawCard(), drawCard()];
    const dealer = [drawCard(), drawCard()];
    const pv = handValue(player), dv = handValue(dealer);
    const st = { hands: [{ cards: player, bet, done: false, result: "", payout: 0 }], active: 0, dealer, split: false, base: bet, w: purse.tag };
    if (pv.total === 21 || dv.total === 21) {
      // natural(s) resolve immediately, before any split is possible
      let result = "", payout = 0;
      if (pv.total === 21 && dv.total === 21) { result = "push"; payout = bet; }
      else if (pv.total === 21) { result = "blackjack"; payout = payoutOf(bet, 2.5); }
      else { result = "dealer_blackjack"; payout = 0; }
      st.hands[0].done = true; st.hands[0].result = result; st.hands[0].payout = payout;
      // never stored, so there is no record to claim — pay it straight out
      await purse.give(payout);
      return await bjRespond(u.id, st, true, purse);
    }
    await kv.set(["bj", u.id], st, { expireIn: GAME_TTL });
    return await bjRespond(u.id, st, false, purse);
  }
  if (req.method === "POST" && (path === "/cas/bj/hit" || path === "/cas/bj/stand" ||
      path === "/cas/bj/double" || path === "/cas/bj/split")) {
    // deno-lint-ignore no-explicit-any
    const b: any = await req.json().catch(() => ({}));
    const u = await casUser(b.token);
    if (!u) return json({ error: "unauthorized" }, 401);
    // deno-lint-ignore no-explicit-any
    const g = await kv.get<any>(["bj", u.id]);
    // drop any hand stored in the pre-split shape rather than misread it
    if (!g.value || !Array.isArray(g.value.hands)) {
      if (g.value) await kv.delete(["bj", u.id]);
      return json({ error: "no hand" }, 400);
    }
    const st = g.value;
    const h = st.hands[st.active];
    if (!h || h.done) return json({ error: "no hand" }, 400);
    // the hand settles into whatever staked it, whatever the player is in now
    const purse = await purseOfStake(u.id, st.w);

    if (path === "/cas/bj/hit") {
      h.cards.push(drawCard());
      if (handValue(h.cards).total > 21) h.done = true;
    } else if (path === "/cas/bj/stand") {
      h.done = true;
    } else if (path === "/cas/bj/double") {
      if (h.cards.length !== 2) return json({ error: "can only double on the first move" }, 400);
      const more = await purse.take(h.bet);
      if (more) return json({ error: more }, more === "insufficient" ? 402 : 409);
      h.bet = round2(h.bet * 2);          // the extra stake rides on this hand only
      h.cards.push(drawCard());
      h.done = true;
    } else {
      // split: the pair becomes two hands, each carrying its own stake
      if (h.cards.length !== 2 || rankOf(h.cards[0]) !== rankOf(h.cards[1])) return json({ error: "not a pair" }, 400);
      if (st.hands.length >= 4) return json({ error: "too many hands" }, 400);
      const more = await purse.take(h.bet);
      if (more) return json({ error: more }, more === "insufficient" ? 402 : 409);
      const moved = h.cards.pop();
      const wasAces = rankOf(h.cards[0]) === "A";
      h.cards.push(drawCard());
      const nh = { cards: [moved, drawCard()], bet: h.bet, done: false, result: "", payout: 0 };
      st.hands.splice(st.active + 1, 0, nh);
      st.split = true;
      // split aces take exactly one card each and then stand
      if (wasAces) { h.done = true; nh.done = true; }
      else if (handValue(h.cards).total > 21) h.done = true;
    }

    while (st.active < st.hands.length && st.hands[st.active].done) st.active++;
    if (st.active >= st.hands.length) {
      const done = await bjResolve(u.id, st, g, purse);
      if (!done) return json({ error: "no hand" }, 400);   // another request settled it
      return await bjRespond(u.id, done, true, purse);
    }
    if (!(await kv.atomic().check(g).set(["bj", u.id], st, { expireIn: GAME_TTL }).commit()).ok) {
      return json({ error: "no hand" }, 400);   // a concurrent action moved the hand
    }
    return await bjRespond(u.id, st, false, purse);
  }

  // ---------- MINES (start / pick / cashout) ----------
  if (req.method === "POST" && path === "/cas/mines/start") {
    // deno-lint-ignore no-explicit-any
    const b: any = await req.json().catch(() => ({}));
    const u = await casUser(b.token);
    if (!u) return json({ error: "unauthorized" }, 401);
    const bet = parseBet(b.bet);
    if (bet === null) return json({ error: wagerError(b.bet) }, 400);
    const count = Math.floor(Number(b.mines));
    if (!(count >= 1 && count <= 24)) return json({ error: "mines 1–24" }, 400);
    const purse = await purseFor(u.id, b.round);
    // deno-lint-ignore no-explicit-any
    const held = await kv.get<any>(["mines", u.id]);
    const clash = stakeClash(held.value, purse);
    if (clash) return json({ error: clash }, 409);
    const no = await purse.take(bet);
    if (no) return json({ error: no }, no === "insufficient" ? 402 : 409);
    // choose `count` distinct mine cells out of 25
    const cells = [...Array(25).keys()];
    for (let i = cells.length - 1; i > 0; i--) { const j = rndInt(i + 1); [cells[i], cells[j]] = [cells[j], cells[i]]; }
    const mines = cells.slice(0, count).sort((a, c) => a - c);
    await kv.set(["mines", u.id], { mines, bet, count, revealed: [], w: purse.tag }, { expireIn: GAME_TTL });
    return json({ ok: true, state: "playing", mines: count, revealed: [], multiplier: 1, nextMultiplier: minesMult(count, 1), ...purseJson(purse) });
  }
  if (req.method === "POST" && path === "/cas/mines/pick") {
    // deno-lint-ignore no-explicit-any
    const b: any = await req.json().catch(() => ({}));
    const u = await casUser(b.token);
    if (!u) return json({ error: "unauthorized" }, 401);
    // deno-lint-ignore no-explicit-any
    const g = await kv.get<any>(["mines", u.id]);
    if (!g.value) return json({ error: "no game" }, 400);
    const st = g.value;
    const purse = await purseOfStake(u.id, st.w);
    const tile = Math.floor(Number(b.tile));
    if (!(tile >= 0 && tile <= 24) || st.revealed.includes(tile)) return json({ error: "bad tile" }, 400);
    if (st.mines.includes(tile)) {
      // a board that pays nothing still has to be read back: the stake stops
      // being in play, and only then can an empty stack mean an empty player
      if (!await purse.settle(["mines", u.id], g, 0)) return json({ error: "no game" }, 400);
      return json({ ok: true, state: "boom", tile, mines: st.mines, balance: purse.bal, ...purseJson(purse) });
    }
    st.revealed.push(tile);
    const safe = st.revealed.length;
    const mult = minesMult(st.count, safe);
    // auto-win once every safe tile is uncovered
    if (safe === 25 - st.count) {
      const payout = payoutOf(st.bet, minesMultExact(st.count, safe));
      if (!await purse.settle(["mines", u.id], g, payout)) return json({ error: "no game" }, 400);
      return json({ ok: true, state: "cashout", tile, multiplier: mult, payout, revealed: st.revealed, mines: st.mines, balance: purse.bal, ...purseJson(purse) });
    }
    if (!(await kv.atomic().check(g).set(["mines", u.id], st, { expireIn: GAME_TTL }).commit()).ok) {
      return json({ error: "no game" }, 400);   // a concurrent pick or cashout moved it
    }
    return json({ ok: true, state: "playing", tile, revealed: st.revealed, multiplier: mult, nextMultiplier: minesMult(st.count, safe + 1) });
  }
  if (req.method === "POST" && path === "/cas/mines/cashout") {
    // deno-lint-ignore no-explicit-any
    const b: any = await req.json().catch(() => ({}));
    const u = await casUser(b.token);
    if (!u) return json({ error: "unauthorized" }, 401);
    // deno-lint-ignore no-explicit-any
    const g = await kv.get<any>(["mines", u.id]);
    if (!g.value) return json({ error: "no game" }, 400);
    const st = g.value;
    if (!st.revealed.length) return json({ error: "reveal a tile first" }, 400);
    const purse = await purseOfStake(u.id, st.w);
    const mult = minesMult(st.count, st.revealed.length);
    const payout = payoutOf(st.bet, minesMultExact(st.count, st.revealed.length));
    if (!await purse.settle(["mines", u.id], g, payout)) return json({ error: "no game" }, 400);   // already cashed out
    return json({ ok: true, state: "cashout", multiplier: mult, payout, mines: st.mines, balance: purse.bal, ...purseJson(purse) });
  }

  // ---------- BEEF (crash-chicken: start / step / cashout) ----------
  if (req.method === "POST" && path === "/cas/beef/start") {
    // deno-lint-ignore no-explicit-any
    const b: any = await req.json().catch(() => ({}));
    const u = await casUser(b.token);
    if (!u) return json({ error: "unauthorized" }, 401);
    const bet = parseBet(b.bet);
    if (bet === null) return json({ error: wagerError(b.bet) }, 400);
    const diff = clip(b.difficulty, 10);
    const cfg = pick(BEEF, diff);
    if (!cfg) return json({ error: "difficulty easy/medium/hard/daredevil" }, 400);
    const purse = await purseFor(u.id, b.round);
    // deno-lint-ignore no-explicit-any
    const held = await kv.get<any>(["beef", u.id]);
    const clash = stakeClash(held.value, purse);
    if (clash) return json({ error: clash }, 409);
    const no = await purse.take(bet);
    if (no) return json({ error: no }, no === "insufficient" ? 402 : 409);
    // pre-roll the death lane NOW so the outcome is fixed server-side and the
    // client cannot influence any step. deathStep = first lane the chicken dies on.
    let deathStep = cfg.lanes + 1; // survives the whole road unless rolled sooner
    for (let s = 1; s <= cfg.lanes; s++) { if (rnd() >= cfg.q) { deathStep = s; break; } }
    await kv.set(["beef", u.id], { bet, q: cfg.q, lanes: cfg.lanes, deathStep, step: 0, w: purse.tag }, { expireIn: GAME_TTL });
    return json({ ok: true, state: "playing", step: 0, lanes: cfg.lanes, multiplier: 1, nextMultiplier: beefMult(cfg.q, 1), ...purseJson(purse) });
  }
  if (req.method === "POST" && path === "/cas/beef/step") {
    // deno-lint-ignore no-explicit-any
    const b: any = await req.json().catch(() => ({}));
    const u = await casUser(b.token);
    if (!u) return json({ error: "unauthorized" }, 401);
    // deno-lint-ignore no-explicit-any
    const g = await kv.get<any>(["beef", u.id]);
    if (!g.value) return json({ error: "no game" }, 400);
    const st = g.value;
    // refuse a walk whose config isn't sane (e.g. a record written before the
    // prototype-lookup fix); drop it rather than compute NaN multipliers
    if (!Number.isFinite(st.q) || !Number.isFinite(st.lanes) || !Number.isFinite(st.bet)) {
      await kv.delete(["beef", u.id]);
      return json({ error: "no game" }, 400);
    }
    const purse = await purseOfStake(u.id, st.w);
    const nextStep = st.step + 1;
    if (nextStep >= st.deathStep) {
      if (!await purse.settle(["beef", u.id], g, 0)) return json({ error: "no game" }, 400);
      return json({ ok: true, state: "dead", step: nextStep, deathStep: st.deathStep, balance: purse.bal, ...purseJson(purse) });
    }
    st.step = nextStep;
    const mult = beefMult(st.q, nextStep);
    if (nextStep >= st.lanes) {
      // reached the far side — auto cash out at the top multiplier
      const payout = payoutOf(st.bet, beefMultExact(st.q, nextStep));
      if (!await purse.settle(["beef", u.id], g, payout)) return json({ error: "no game" }, 400);
      return json({ ok: true, state: "cashout", step: nextStep, multiplier: mult, payout, balance: purse.bal, ...purseJson(purse) });
    }
    if (!(await kv.atomic().check(g).set(["beef", u.id], st, { expireIn: GAME_TTL }).commit()).ok) {
      return json({ error: "no game" }, 400);   // a concurrent step or cashout moved it
    }
    return json({ ok: true, state: "playing", step: nextStep, multiplier: mult, nextMultiplier: beefMult(st.q, nextStep + 1) });
  }
  if (req.method === "POST" && path === "/cas/beef/cashout") {
    // deno-lint-ignore no-explicit-any
    const b: any = await req.json().catch(() => ({}));
    const u = await casUser(b.token);
    if (!u) return json({ error: "unauthorized" }, 401);
    // deno-lint-ignore no-explicit-any
    const g = await kv.get<any>(["beef", u.id]);
    if (!g.value) return json({ error: "no game" }, 400);
    const st = g.value;
    if (!Number.isFinite(st.q) || !Number.isFinite(st.lanes) || !Number.isFinite(st.bet)) {
      await kv.delete(["beef", u.id]);
      return json({ error: "no game" }, 400);
    }
    if (st.step < 1) return json({ error: "take a step first" }, 400);
    const purse = await purseOfStake(u.id, st.w);
    const mult = beefMult(st.q, st.step);
    const payout = payoutOf(st.bet, beefMultExact(st.q, st.step));
    if (!await purse.settle(["beef", u.id], g, payout)) return json({ error: "no game" }, 400);   // already cashed out
    return json({ ok: true, state: "cashout", step: st.step, multiplier: mult, payout, balance: purse.bal, ...purseJson(purse) });
  }

  // ---------- SHOP: list active items + redeem ----------
  if (req.method === "GET" && path === "/shop/list") {
    const u = await casUser(url.searchParams.get("token"));
    if (!u) return json({ error: "unauthorized" }, 401);
    const items: unknown[] = [];
    // deno-lint-ignore no-explicit-any
    for await (const e of kv.list<any>({ prefix: ["shopitem"] })) {
      // inputLabel is shipped so the buyer can be prompted; output is held back
      // until they actually redeem (it may be a code or a one-time reward).
      if (e.value.active) {
        items.push({
          id: e.value.id,
          name: e.value.name,
          desc: e.value.desc,
          price: e.value.price,
          inputLabel: e.value.inputLabel || "",
          theme: e.value.theme || "",
          themeName: e.value.theme ? (themeById(e.value.theme)?.name || "") : "",
          // an item that unlocks something you already have is not for you
          owned: e.value.theme ? await ownsTheme(u.id, e.value.theme) : false,
        });
      }
    }
    // deno-lint-ignore no-explicit-any
    items.sort((a: any, c: any) => a.price - c.price);
    const bal = (await getCas(u.id)).bal;
    return json({ items, pending: await listShopPending(u.id), balance: round2(bal) });
  }
  if (req.method === "POST" && path === "/shop/redeem") {
    // deno-lint-ignore no-explicit-any
    const b: any = await req.json().catch(() => ({}));
    const u = await casUser(b.token);
    if (!u) return json({ error: "unauthorized" }, 401);
    // deno-lint-ignore no-explicit-any
    const it = await kv.get<any>(["shopitem", clip(b.itemId, 32)]);
    if (!it.value || !it.value.active) return json({ error: "unavailable" }, 404);
    // the question (discord tag, etc) is asked AFTER they have paid. a missing
    // answer must not block the sale — the client shows the field once the
    // shelves already have their sahurs.
    const inputLabel = String(it.value.inputLabel || "").trim();
    const input = clip(b.input, 500);
    const price = round2(Number(it.value.price));
    // Buying a skin you already wear is just a donation, so refuse it before
    // taking the sahurs rather than after.
    const grants = String(it.value.theme || "");
    if (grants && await ownsTheme(u.id, grants)) return json({ error: "already owned" }, 409);
    const bal = await adjustBalance(u.id, -price);
    if (bal === null) return json({ error: "insufficient" }, 402);
    // The debit has happened, so the grant must not be conditional on anything
    // that can fail afterwards — it is written before the reply is built, and
    // writing it twice is the same as writing it once.
    if (grants && themeById(grants)) await kv.set(["theme", u.id, grants], 1);
    let pending: ShopPending | null = null;
    if (inputLabel && !input) {
      // they paid. walking away must not lose the question — keep an owed
      // redeem until they answer, and put it back on the shop list.
      pending = {
        id: rid(6),
        itemId: it.value.id,
        name: it.value.name,
        price,
        inputLabel,
        output: String(it.value.output || ""),
        ts: Date.now(),
      };
      await kv.set(["shoppend", u.id, pending.id], pending, { expireIn: CAS_TTL });
    }
    notifyRedeem(u.username, { name: it.value.name, price }, inputLabel ? input : "");
    return json({
      ok: true,
      balance: round2(bal),
      item: it.value.name,
      price,
      output: it.value.output || "",
      inputLabel,
      pending,
      theme: grants || null,
    });
  }
  if (req.method === "POST" && path === "/shop/tell") {
    // deno-lint-ignore no-explicit-any
    const b: any = await req.json().catch(() => ({}));
    const u = await casUser(b.token);
    if (!u) return json({ error: "unauthorized" }, 401);
    const input = clip(b.input, 500);
    if (!input) return json({ error: "input required" }, 400);
    const redeemId = clip(b.redeemId, 32);
    const itemId = clip(b.itemId, 32);
    let pending: ShopPending | null = null;
    if (redeemId) {
      const hit = await kv.get<ShopPending>(["shoppend", u.id, redeemId]);
      pending = hit.value;
    } else if (itemId) {
      const owed = (await listShopPending(u.id)).filter((p) => p.itemId === itemId);
      pending = owed[0] || null;
    }
    if (!pending) return json({ error: "nothing to add" }, 400);
    await kv.delete(["shoppend", u.id, pending.id]);
    notifyRedeem(u.username, { name: pending.name, price: pending.price }, input);
    return json({ ok: true, output: pending.output || "" });
  }

  // ---------- admin: SET a player's balance (moderation tool) ----------
  // sets the balance to an exact value, keeping the faucet clock intact. gated by
  // the admin key. intended for cleaning up an exploiter, not day-to-day economy.
  if (req.method === "POST" && path === "/admin/setbal") {
    // deno-lint-ignore no-explicit-any
    const b: any = await req.json().catch(() => ({}));
    if (!ADMIN_KEY || b.key !== ADMIN_KEY) return json({ error: "forbidden" }, 403);
    const id = clip(b.id, 32);
    const bal = round2(Number(b.balance));
    if (!id || !isFinite(bal) || bal < 0 || bal > 1e12) return json({ error: "bad balance" }, 400);
    const cur = await kv.get<{ bal: number; lastClaim: number }>(["cas", id]);
    const rec = cur.value ?? { bal: 0, lastClaim: 0 };
    await kv.set(["cas", id], { ...rec, bal }, { expireIn: CAS_TTL });
    return json({ ok: true, balance: bal });
  }

  // ---------- admin: VIEW balances ----------
  if (req.method === "GET" && path === "/admin/balances") {
    if (!ADMIN_KEY || url.searchParams.get("key") !== ADMIN_KEY) return json({ error: "forbidden" }, 403);
    const rows: { id: string; username: string; balance: number }[] = [];
    // map app id -> username for approved users
    const names: Record<string, string> = {};
    // deno-lint-ignore no-explicit-any
    for await (const e of kv.list<any>({ prefix: ["app"] })) {
      if (e.value.status === "approved") names[e.value.id] = e.value.username;
    }
    // deno-lint-ignore no-explicit-any
    for await (const e of kv.list<any>({ prefix: ["cas"] })) {
      const id = String(e.key[1]);
      const username = names[id];
      if (!username) continue;
      rows.push({ id, username, balance: round2(e.value.bal || 0) });
    }
    rows.sort((a, c) => c.balance - a.balance);
    return json({ balances: rows });
  }

  // ---------- admin: shop management (list all / upsert / delete) ----------
  // the list the shop editor's theme dropdown is built from
  if (req.method === "GET" && path === "/admin/themes") {
    if (!ADMIN_KEY || url.searchParams.get("key") !== ADMIN_KEY) return json({ error: "forbidden" }, 403);
    return json({ ok: true, themes: SHRINE_THEMES.map((t) => ({ id: t.id, name: t.name, free: !!t.free })) });
  }
  if (req.method === "GET" && path === "/admin/shop") {
    if (!ADMIN_KEY || url.searchParams.get("key") !== ADMIN_KEY) return json({ error: "forbidden" }, 403);
    const items: unknown[] = [];
    // deno-lint-ignore no-explicit-any
    for await (const e of kv.list<any>({ prefix: ["shopitem"] })) items.push(e.value);
    // deno-lint-ignore no-explicit-any
    items.sort((a: any, c: any) => (a.ts || 0) - (c.ts || 0));
    return json({ items });
  }
  if (req.method === "POST" && path === "/admin/shop/set") {
    // deno-lint-ignore no-explicit-any
    const b: any = await req.json().catch(() => ({}));
    if (!ADMIN_KEY || b.key !== ADMIN_KEY) return json({ error: "forbidden" }, 403);
    const name = clip(b.name, 60);
    const desc = clip(b.desc, 200);
    const price = round2(Number(b.price));
    if (!name || !(price >= 0)) return json({ error: "name + price required" }, 400);
    const id = clip(b.id, 32) || rid(6);
    const active = b.active !== false;
    // inputLabel: what the buyer is asked to type (blank = no prompt).
    // output: what they are shown after redeeming (blank = nothing extra).
    const inputLabel = clip(b.inputLabel, 80);
    const output = clip(b.output, 1000);
    // theme: redeeming this item unlocks that skin for the buyer. Checked
    // against the registry so a typo cannot create an item that sells nothing.
    const theme = clip(b.theme, 32);
    if (theme && !themeById(theme)) return json({ error: "no such theme" }, 400);
    if (theme && themeById(theme)!.free) return json({ error: "that theme is already everyone's" }, 400);
    // deno-lint-ignore no-explicit-any
    const existing = await kv.get<any>(["shopitem", id]);
    const ts = existing.value?.ts || Date.now();
    await kv.set(["shopitem", id], { id, name, desc, price, active, ts, inputLabel, output, theme });
    return json({ ok: true, item: { id, name, desc, price, active, ts, inputLabel, output, theme } });
  }
  if (req.method === "POST" && path === "/admin/shop/delete") {
    // deno-lint-ignore no-explicit-any
    const b: any = await req.json().catch(() => ({}));
    if (!ADMIN_KEY || b.key !== ADMIN_KEY) return json({ error: "forbidden" }, 403);
    await kv.delete(["shopitem", clip(b.id, 32)]);
    return json({ ok: true, deleted: true });
  }

  // ---------- gone: gn-math HTML proxy ----------
  // Loaders are vendored on GitHub Pages (games/g/). Keep this 410 so old
  // scrapers and leftover clients cannot pull HTML through Deno.
  if (req.method === "GET" && path.startsWith("/g/")) {
    return new Response("gone: game loaders are on GitHub Pages at games/g/", {
      status: 410,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "public, max-age=86400",
        ...CORS,
      },
    });
  }

  // ---------- health ----------
  return new Response("Shrine of Tung backend is alive", {
    headers: { "content-type": "text/plain", ...CORS },
  });
});

const ADMIN_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Shrine of Tung — admin</title>
<style>
:root{color-scheme:dark}
body{margin:0;font-family:system-ui,Segoe UI,Roboto,sans-serif;background:#1d1206;color:#f5efe0}
header{padding:16px 20px;background:#2b1a0a;border-bottom:1px solid #3a2410;font-weight:700}
.shell{display:flex;min-height:calc(100vh - 53px)}
aside.nav{width:230px;flex-shrink:0;background:#241505;border-right:1px solid #3a2410;padding:12px 8px;display:flex;flex-direction:column;gap:4px}
.navbtn{width:100%;text-align:left;background:transparent;color:#e9d9c2;padding:10px 12px;border-radius:8px;font-size:13px;display:flex;align-items:center;gap:8px}
.navbtn:hover{background:#3a2410}
.navbtn.on{background:#c8823c;color:#1d1206}
.navbtn .count{margin-left:auto;font-weight:700;opacity:.85;font-variant-numeric:tabular-nums}
.content{flex:1;min-width:0;padding:20px 24px;max-width:780px}
.pane{display:none}
.pane.on{display:block}
.pane h2{margin:0 0 4px;font-size:18px}
.hint{color:#c8823c;font-size:13px;margin:0 0 14px}
.keybar{display:flex;gap:8px;margin-bottom:16px}
input,textarea{flex:1;padding:10px 12px;border-radius:8px;border:1px solid #3a2410;background:#160d04;color:#f5efe0;font-size:14px;font-family:inherit;box-sizing:border-box}
textarea{min-height:72px;resize:vertical;width:100%}
.search{width:100%;flex:none;box-sizing:border-box;margin:0 0 14px}
button{padding:10px 14px;border:none;border-radius:8px;font-weight:600;cursor:pointer}
.load{background:#c8823c;color:#1d1206}
.app{background:#241505;border:1px solid #3a2410;border-radius:12px;padding:14px 16px;margin-bottom:12px}
.app h3{margin:0 0 4px;font-size:16px}
.app p{margin:0 0 12px;color:#e9d9c2;white-space:pre-wrap;word-break:break-word}
.app small{color:#c8823c}
.app.tungline{border-left:3px solid #f2c063}
.tungtag{margin-left:8px;font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#1d1206;background:#f2c063;border-radius:4px;padding:1px 6px;vertical-align:middle}
.vlab{flex:1;min-width:150px}
.row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.row+.row{margin-top:8px}
.ok{background:#2e7d32;color:#fff}
.no{background:#7a2e2e;color:#fff}
.empty{color:#c8823c;padding:20px 0}
.uname{flex:1;min-width:120px}
.tin{flex:0 1 220px;min-width:150px}
.app small.rev{color:#e0908a}
.thread{margin:12px 0 0;display:flex;flex-direction:column;gap:6px}
.tmsg{padding:7px 11px;border-radius:10px;font-size:.86rem;max-width:85%;white-space:pre-wrap;word-break:break-word}
.tmsg.admin{align-self:flex-end;background:#c8823c;color:#1d1206}
.tmsg.applicant{align-self:flex-start;background:#241505;border:1px solid #3a2410}
.tmsg .twhen{display:block;font-size:10px;opacity:.8;margin-bottom:3px}
.app h3 .when{margin-left:8px;font-size:11px;font-weight:500;color:#c8823c;letter-spacing:0;text-transform:none}
.danger p{color:#e9d9c2;line-height:1.45}
</style></head><body>
<header>Shrine of Tung — admin</header>
<div class="shell">
<aside class="nav">
<button type="button" class="navbtn on" data-pane="pending">Approve / deny <span class="count" id="count-pending"></span></button>
<button type="button" class="navbtn" data-pane="users">Manage users <span class="count" id="count-users"></span></button>
<button type="button" class="navbtn" data-pane="balances">Casino balances <span class="count" id="count-balances"></span></button>
<button type="button" class="navbtn" data-pane="shop">Shop items <span class="count" id="count-shop"></span></button>
<button type="button" class="navbtn" data-pane="chat">Chat log <span class="count" id="count-chat"></span></button>
<button type="button" class="navbtn" data-pane="postas">Post as&hellip;</button>
<button type="button" class="navbtn" data-pane="veil">Web veil <span class="count" id="count-veil"></span></button>
<button type="button" class="navbtn" data-pane="danger">Wipe data</button>
</aside>
<div class="content">
<div class="keybar"><input id="key" type="password" placeholder="admin key" autocomplete="off"><button class="load" id="load">load</button></div>
<section class="pane on" id="pane-pending">
<h2>Approve / deny users</h2>
<p class="hint">Pending applications. Search by name, id, or application text.</p>
<input class="search" id="search-pending" placeholder="search pending users…" autocomplete="off">
<div id="list"><div class="empty">enter your admin key and hit load.</div></div>
</section>
<section class="pane" id="pane-users">
<h2>Manage users</h2>
<p class="hint">Approved users: rename, ban, timeout, web-veil access, note, re-review, or delete.</p>
<input class="search" id="search-users" placeholder="search approved users…" autocomplete="off">
<div id="users"><div class="empty">load to see approved users.</div></div>
</section>
<section class="pane" id="pane-balances">
<h2>Manage casino balances</h2>
<p class="hint">Fun-money sahurs. Set a balance only as a moderation tool.</p>
<input class="search" id="search-balances" placeholder="search player balances…" autocomplete="off">
<div id="balances"><div class="empty">load to see player balances.</div></div>
</section>
<section class="pane" id="pane-shop">
<h2>Shop items</h2>
<p class="hint">Add, edit, hide, or delete redeemable shop entries.</p>
<div id="shop"><div class="empty">load to manage the shop.</div></div>
<div class="row" style="margin-top:12px"><button class="load" id="addItem">+ add shop item</button></div>
</section>
<section class="pane" id="pane-chat">
<h2>Chat log</h2>
<p class="hint">The last 500 retained chat lines. Not loaded with the other lists — dump only when you need it. Clearing wipes every retained message and reaction; accounts, balances and shop items are untouched.</p>
<div class="row" style="margin-bottom:14px"><button class="load" id="dumpChat">dump last 500</button><button class="no" id="clearChat">clear chat log</button></div>
<div id="chatlog"><div class="empty">not loaded. click dump last 500.</div></div>
</section>
<section class="pane" id="pane-postas">
<h2>Post as&hellip;</h2>
<p class="hint">Drop a message into the chat under somebody else's name. The name must belong to an approved member, or be <b>tung</b> — who posts with his own mark, exactly like a Wisdom. Reply-to is optional: give the id of a message (the chat log shows one under each line) and the quote is filled in from what that message actually says.</p>
<div class="field"><label for="paName">post as</label><input id="paName" class="uname" placeholder="username, or tung" autocomplete="off"></div>
<div class="field"><label for="paText">message</label><textarea id="paText" class="uname" placeholder="what they said"></textarea></div>
<div class="field"><label for="paReply">reply to (optional message id)</label><input id="paReply" class="uname" placeholder="leave empty for no quote" autocomplete="off"></div>
<div class="row" style="margin-top:12px"><button class="load" id="paSend">post it</button><span id="paMsg" class="hint"></span></div>
</section>
<section class="pane" id="pane-veil">
<h2>Web veil</h2>
<p class="hint">The global half of the veil. "Coming Soon" shows the holding page to everyone; "Live" opens it — but only for members you have also approved individually, on the web-veil line of their card under Manage users. Takes effect immediately — no redeploy.</p>
<div id="veilbox"><div class="empty">enter your admin key and hit load.</div></div>
</section>
<section class="pane danger" id="pane-danger">
<h2>Wipe data</h2>
<p>Delete every application (pending and approved). Usernames and tokens are wiped; everyone must re-apply. Casino balances and shop items are not cleared by this.</p>
<div class="row" style="margin-top:12px"><button class="no" id="clear">clear all applications</button></div>
</section>
</div>
</div>
<script>
var keyEl=document.getElementById("key"),list=document.getElementById("list"),users=document.getElementById("users");
var balances=document.getElementById("balances"),shop=document.getElementById("shop"),chatlog=document.getElementById("chatlog");
var pendingCache=null,usersCache=null,balancesCache=null,pendingErr=null,usersErr=null,balancesErr=null;
try{var qk=new URLSearchParams(location.search).get("key");if(qk)keyEl.value=qk;else{var k=localStorage.getItem("shrine-admin-key");if(k)keyEl.value=k;}}catch(e){}
function loadAll(){refresh();refreshUsers();refreshBalances();refreshShop();refreshVeil();}
document.getElementById("load").onclick=loadAll;
document.getElementById("dumpChat").onclick=dumpChat;
document.getElementById("clearChat").onclick=function(){
  var key=keyEl.value.trim();
  if(!key){alert("enter your admin key first");return;}
  if(!confirm("Delete the whole chat log? Every retained message and reaction goes. Accounts, balances and shop items are not touched."))return;
  var btn=this;btn.disabled=true;
  fetch("/admin/clearchat",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({key:key})})
    .then(function(r){return r.json();})
    .then(function(d){
      btn.disabled=false;
      if(d.error){alert(d.error);return;}
      chatlog.innerHTML='<div class="empty">chat log cleared ('+d.cleared+' events).</div>';
      setCount("chat",0);
    })
    .catch(function(){btn.disabled=false;alert("could not reach the server.");});
};
var veilbox=document.getElementById("veilbox"),veilCount=document.getElementById("count-veil");
function paintVeil(st){
  veilbox.innerHTML="";
  if(st.error){veilbox.innerHTML='<div class="empty">'+st.error+'</div>';veilCount.textContent="";return;}
  var live=st.live===true, ready=st.configured===true;
  veilCount.textContent=live?"live":"off";
  var card=document.createElement("div");card.className="card";
  var h=document.createElement("b");h.textContent=live?"Live — the veil is open":"Coming Soon — the veil is closed";
  card.appendChild(h);
  var sub=document.createElement("p");sub.className="hint";
  sub.textContent=ready
    ? (live?"Approved members get the destination in a tab; everyone else still gets a holding page.":"Everyone gets the holding page, approved or not.")
    : "PROXY_URL is not set in the environment, so the veil stays closed whatever this says. Set it in the Deploy dashboard first.";
  card.appendChild(sub);
  var row=document.createElement("div");row.className="row";
  var on=document.createElement("button");on.textContent="open the veil";on.className=live?"":"load";on.disabled=live||!ready;
  var off=document.createElement("button");off.textContent="close the veil";off.className="no";off.disabled=!live;
  on.onclick=function(){setVeil(true);};off.onclick=function(){setVeil(false);};
  row.appendChild(on);row.appendChild(off);card.appendChild(row);
  veilbox.appendChild(card);
}
function refreshVeil(){
  var k=keyEl.value.trim();if(!k)return;
  fetch("/admin/veil?key="+encodeURIComponent(k)).then(function(r){return r.json();})
    .then(paintVeil).catch(function(){paintVeil({error:"could not reach the server."});});
}
function setVeil(live){
  var k=keyEl.value.trim();if(!k)return;
  fetch("/admin/veil",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({key:k,live:live})})
    .then(function(r){return r.json();}).then(paintVeil)
    .catch(function(){paintVeil({error:"could not reach the server."});});
}
document.getElementById("clear").onclick=function(){
  if(!confirm("Delete ALL applications (pending + approved)? Everyone will have to re-apply."))return;
  fetch("/admin/clear",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({key:keyEl.value.trim()})}).then(function(r){return r.json();}).then(function(d){alert(d.error?d.error:("cleared "+d.cleared+" entries"));loadAll();});
};
function showPane(id){
  var panes=document.querySelectorAll(".pane");
  for(var i=0;i<panes.length;i++) panes[i].classList.toggle("on", panes[i].id==="pane-"+id);
  var btns=document.querySelectorAll(".navbtn");
  for(var j=0;j<btns.length;j++) btns[j].classList.toggle("on", btns[j].getAttribute("data-pane")===id);
}
var navBtns=document.querySelectorAll(".navbtn");
document.getElementById("paSend").onclick=postAs;
for(var n=0;n<navBtns.length;n++){
  navBtns[n].onclick=function(){showPane(this.getAttribute("data-pane"));};
}
function qOf(id){var el=document.getElementById(id);return el?el.value.trim().toLowerCase():"";}
function matches(q, parts){
  if(!q) return true;
  for(var i=0;i<parts.length;i++){
    if(String(parts[i]==null?"":parts[i]).toLowerCase().indexOf(q)>=0) return true;
  }
  return false;
}
function setCount(id, n){
  var el=document.getElementById("count-"+id);
  if(el) el.textContent = (n==null || n==="") ? "" : String(n);
}
function bindSearch(id, fn){
  var el=document.getElementById(id);
  if(!el) return;
  el.addEventListener("input", fn);
}
bindSearch("search-pending", function(){renderPending();});
bindSearch("search-users", function(){renderUsers();});
bindSearch("search-balances", function(){renderBalances();});
function postAs(){
  var key=keyEl.value.trim();
  var name=document.getElementById("paName").value.trim();
  var text=document.getElementById("paText").value;
  var replyTo=document.getElementById("paReply").value.trim();
  var out=document.getElementById("paMsg");
  if(!name||!text.trim()){out.textContent="need a name and a message.";return;}
  out.textContent="posting...";
  fetch("/admin/postas",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({key:key,username:name,text:text,replyTo:replyTo})})
    .then(function(r){return r.json();}).then(function(d){
      if(d.error){
        out.textContent=d.error==="no such member"?"no approved member by that name.":
          (d.error==="no such message"?"no message with that id — it may have aged out.":d.error);
        return;
      }
      out.textContent="posted as "+d.username+(d.tung?" (the shrine)":"")+".";
      document.getElementById("paText").value="";
      document.getElementById("paReply").value="";
    }).catch(function(){out.textContent="network error.";});
}

function dumpChat(){
  var key=keyEl.value.trim();
  chatlog.innerHTML='<div class="empty">loading...</div>';
  fetch("/admin/chat?key="+encodeURIComponent(key)).then(function(r){return r.json();}).then(function(d){
    if(d.error){chatlog.innerHTML='<div class="empty">'+d.error+' — check your key.</div>';setCount("chat","");return;}
    var msgs=d.messages||[];
    setCount("chat", msgs.length);
    if(!msgs.length){chatlog.innerHTML='<div class="empty">no chat messages retained.</div>';return;}
    chatlog.innerHTML="";
    msgs.forEach(function(m){
      var el=document.createElement("div");el.className="app";
      var h=document.createElement("h3");h.textContent=m.name||"";
      if(m.from==="tung"){var tg=document.createElement("span");tg.className="tungtag";tg.textContent="the shrine";h.appendChild(tg);el.classList.add("tungline");}
      if(m.ts){var tm=document.createElement("span");tm.className="when";tm.textContent=" · "+new Date(m.ts).toLocaleString();h.appendChild(tm);}
      el.appendChild(h);
      if(m.reply&&m.reply.text){
        var rp=document.createElement("small");rp.textContent="reply to "+(m.reply.name||"")+" — "+m.reply.text;el.appendChild(rp);
      }
      var p=document.createElement("p");p.textContent=m.text||"";el.appendChild(p);
      var s=document.createElement("small");s.textContent="seq "+m.seq+" · id "+m.id;el.appendChild(s);
      chatlog.appendChild(el);
    });
  }).catch(function(){chatlog.innerHTML='<div class="empty">network error.</div>';});
}
function refresh(){
  var key=keyEl.value.trim();try{localStorage.setItem("shrine-admin-key",key);}catch(e){}
  list.innerHTML='<div class="empty">loading...</div>';
  fetch("/admin/pending?key="+encodeURIComponent(key)).then(function(r){return r.json();}).then(function(d){
    if(d.error){pendingCache=null;pendingErr=d.error;renderPending();return;}
    pendingErr=null;pendingCache=d.pending||[];renderPending();
  }).catch(function(){pendingCache=null;pendingErr="network error.";renderPending();});
}
function renderPending(){
  setCount("pending", pendingCache?pendingCache.length:"");
  if(pendingErr){list.innerHTML='<div class="empty">'+pendingErr+' — check your key.</div>';return;}
  if(!pendingCache){list.innerHTML='<div class="empty">enter your admin key and hit load.</div>';return;}
  var q=qOf("search-pending");
  var shown=pendingCache.filter(function(a){
    var thread=(a.thread||[]).map(function(m){return m.text||"";});
    return matches(q, [a.username, a.id, a.application].concat(thread));
  });
  if(!pendingCache.length){list.innerHTML='<div class="empty">no pending applications.</div>';return;}
  if(!shown.length){list.innerHTML='<div class="empty">no matching applications.</div>';return;}
  list.innerHTML="";
  shown.forEach(function(a){
    var el=document.createElement("div");el.className="app";
    var h=document.createElement("h3");h.textContent=a.username;el.appendChild(h);
    var p=document.createElement("p");p.textContent=a.application;el.appendChild(p);
    var s=document.createElement("small");s.textContent="id "+a.id+" · "+new Date(a.ts).toLocaleString();el.appendChild(s);
    var row=document.createElement("div");row.className="row";row.style.marginTop="10px";
    var ok=document.createElement("button");ok.className="ok";ok.textContent="approve";ok.onclick=function(){decide(a.id,"approve");};
    var no=document.createElement("button");no.className="no";no.textContent="reject";no.onclick=function(){decide(a.id,"reject");};
    row.appendChild(ok);row.appendChild(no);el.appendChild(row);
    if((a.thread||[]).length){
      var th=document.createElement("div");th.className="thread";
      a.thread.forEach(function(m){
        var b=document.createElement("div");b.className="tmsg "+(m.from==="admin"?"admin":"applicant");
        var tw=document.createElement("div");tw.className="twhen";
        tw.textContent=(m.from==="admin"?"tung":a.username)+(m.ts?" · "+new Date(m.ts).toLocaleString():"");
        var tx=document.createElement("div");tx.textContent=m.text;
        b.appendChild(tw);b.appendChild(tx);
        th.appendChild(b);
      });
      el.appendChild(th);
    }
    var mrow=document.createElement("div");mrow.className="row";mrow.style.marginTop="8px";
    var mi=document.createElement("input");mi.className="uname";mi.placeholder="ask a follow-up question…";mi.maxLength=1000;
    var mb=document.createElement("button");mb.className="load";mb.textContent="send";
    mb.onclick=function(){var t=mi.value.trim();if(!t)return;mi.value="";sendMsg(a.id,t);};
    mi.addEventListener("keydown",function(ev){if(ev.key==="Enter"){ev.preventDefault();mb.onclick();}});
    mrow.appendChild(mi);mrow.appendChild(mb);el.appendChild(mrow);
    list.appendChild(el);
  });
}
function decide(id,action){
  fetch("/admin/decide",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({key:keyEl.value.trim(),id:id,action:action})}).then(function(r){return r.json();}).then(function(){refresh();refreshUsers();});
}
function sendMsg(id,text){
  fetch("/admin/message",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({key:keyEl.value.trim(),id:id,text:text})}).then(function(r){return r.json();}).then(function(d){if(d.error)alert(d.error);refresh();});
}
function toLocalInput(ms){var d=new Date(ms - new Date(ms).getTimezoneOffset()*60000);return d.toISOString().slice(0,16);}
function refreshUsers(){
  var key=keyEl.value.trim();
  users.innerHTML='<div class="empty">loading...</div>';
  fetch("/admin/users?key="+encodeURIComponent(key)).then(function(r){return r.json();}).then(function(d){
    if(d.error){usersCache=null;usersErr=d.error;renderUsers();return;}
    usersErr=null;usersCache=d.users||[];renderUsers();
  }).catch(function(){usersCache=null;usersErr="network error.";renderUsers();});
}
function renderUsers(){
  setCount("users", usersCache?usersCache.length:"");
  if(usersErr){users.innerHTML='<div class="empty">'+usersErr+' — check your key.</div>';return;}
  if(!usersCache){users.innerHTML='<div class="empty">load to see approved users.</div>';return;}
  var q=qOf("search-users");
  var shown=usersCache.filter(function(u){
    var st=u.banned?"banned":(u.timeoutUntil&&u.timeoutUntil>Date.now()?"timeout timed out":"active");
    return matches(q, [u.username, u.id, u.note||"", st, u.veil?"veil approved":"veil not approved"]);
  });
  if(!usersCache.length){users.innerHTML='<div class="empty">no approved users yet.</div>';return;}
  if(!shown.length){users.innerHTML='<div class="empty">no matching users.</div>';return;}
  users.innerHTML="";
  shown.forEach(function(u){
    var el=document.createElement("div");el.className="app";
    var row=document.createElement("div");row.className="row";
    var inp=document.createElement("input");inp.className="uname";inp.value=u.username;inp.maxLength=24;
    var save=document.createElement("button");save.className="load";save.textContent="save name";
    save.onclick=function(){rename(u.id,inp.value.trim());};
    var ban=document.createElement("button");
    if(u.banned){ban.className="ok";ban.textContent="unban";ban.onclick=function(){setBan(u.id,false);};}
    else{ban.className="no";ban.textContent="ban";ban.onclick=function(){setBan(u.id,true);};}
    var rev=document.createElement("button");rev.className="load";rev.textContent="re-review";rev.title="send back to the application screen to ask follow-up questions";
    rev.onclick=function(){repend(u.id,u.username);};
    var del=document.createElement("button");del.className="no";del.textContent="delete";del.title="remove the user entirely (frees the username)";
    del.onclick=function(){deleteUser(u.id,u.username);};
    row.appendChild(inp);row.appendChild(save);row.appendChild(rev);row.appendChild(ban);row.appendChild(del);
    el.appendChild(row);
    var trow=document.createElement("div");trow.className="row";
    var dt=document.createElement("input");dt.type="datetime-local";dt.className="tin";
    if(u.timeoutUntil&&u.timeoutUntil>Date.now())dt.value=toLocalInput(u.timeoutUntil);
    var apply=document.createElement("button");apply.className="no";apply.textContent="time out until";
    apply.onclick=function(){if(!dt.value){alert("pick a date/time first");return;}var ms=new Date(dt.value).getTime();if(!(ms>Date.now())){alert("pick a time in the future");return;}setTimeoutUntil(u.id,ms);};
    var clr=document.createElement("button");clr.className="load";clr.textContent="clear timeout";
    clr.onclick=function(){setTimeoutUntil(u.id,0);};
    trow.appendChild(dt);trow.appendChild(apply);trow.appendChild(clr);
    el.appendChild(trow);
    var vrow=document.createElement("div");vrow.className="row";
    var vlab=document.createElement("small");vlab.className="vlab";
    vlab.textContent=u.veil?"web veil: approved":"web veil: not approved";
    if(!u.veil)vlab.className="vlab rev";
    var vbtn=document.createElement("button");
    if(u.veil){vbtn.className="no";vbtn.textContent="revoke veil access";vbtn.onclick=function(){setVeilUser(u.id,false);};}
    else{vbtn.className="ok";vbtn.textContent="approve for veil";vbtn.onclick=function(){setVeilUser(u.id,true);};}
    vrow.appendChild(vlab);vrow.appendChild(vbtn);
    el.appendChild(vrow);
    var nrow=document.createElement("div");nrow.className="row";
    var note=document.createElement("input");note.className="uname";note.placeholder="private note (admin only)";note.value=u.note||"";note.maxLength=500;
    var nsave=document.createElement("button");nsave.className="load";nsave.textContent="save note";
    nsave.onclick=function(){saveNote(u.id,note.value.trim());};
    nrow.appendChild(note);nrow.appendChild(nsave);
    el.appendChild(nrow);
    var meta=document.createElement("small");
    var idline=" · id "+u.id;
    if(u.banned){meta.textContent="banned (permanent)"+idline;meta.className="rev";}
    else if(u.timeoutUntil&&u.timeoutUntil>Date.now()){meta.textContent="timed out until "+new Date(u.timeoutUntil).toLocaleString()+idline;meta.className="rev";}
    else{meta.textContent="active · joined "+new Date(u.ts).toLocaleString()+idline;}
    el.appendChild(meta);
    users.appendChild(el);
  });
}
function rename(id,name){
  if(!name)return;
  fetch("/admin/rename",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({key:keyEl.value.trim(),id:id,username:name})}).then(function(r){return r.json();}).then(function(d){if(d.error)alert(d.error);refreshUsers();});
}
function setBan(id,banned){
  fetch("/admin/ban",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({key:keyEl.value.trim(),id:id,banned:banned})}).then(function(r){return r.json();}).then(function(d){if(d.error)alert(d.error);refreshUsers();});
}
function setTimeoutUntil(id,until){
  fetch("/admin/timeout",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({key:keyEl.value.trim(),id:id,until:until})}).then(function(r){return r.json();}).then(function(d){if(d.error)alert(d.error);refreshUsers();});
}
function setVeilUser(id,allowed){
  fetch("/admin/veiluser",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({key:keyEl.value.trim(),id:id,allowed:allowed})}).then(function(r){return r.json();}).then(function(d){if(d.error)alert(d.error);refreshUsers();});
}
function saveNote(id,note){
  fetch("/admin/note",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({key:keyEl.value.trim(),id:id,note:note})}).then(function(r){return r.json();}).then(function(d){if(d.error)alert(d.error);refreshUsers();});
}
function deleteUser(id,name){
  if(!confirm("Delete "+name+" entirely? This frees the username and cannot be undone."))return;
  fetch("/admin/delete",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({key:keyEl.value.trim(),id:id})}).then(function(r){return r.json();}).then(function(d){if(d.error)alert(d.error);refreshUsers();refreshBalances();});
}
function repend(id,name){
  if(!confirm("Send "+name+" back to review? They'll return to the application screen where you can ask follow-up questions."))return;
  fetch("/admin/repend",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({key:keyEl.value.trim(),id:id})}).then(function(r){return r.json();}).then(function(d){if(d.error)alert(d.error);refresh();refreshUsers();});
}
function refreshBalances(){
  var key=keyEl.value.trim();
  balances.innerHTML='<div class="empty">loading...</div>';
  fetch("/admin/balances?key="+encodeURIComponent(key)).then(function(r){return r.json();}).then(function(d){
    if(d.error){balancesCache=null;balancesErr=d.error;renderBalances();return;}
    balancesErr=null;balancesCache=d.balances||[];renderBalances();
  }).catch(function(){balancesCache=null;balancesErr="network error.";renderBalances();});
}
function renderBalances(){
  setCount("balances", balancesCache?balancesCache.length:"");
  if(balancesErr){balances.innerHTML='<div class="empty">'+balancesErr+' — check your key.</div>';return;}
  if(!balancesCache){balances.innerHTML='<div class="empty">load to see player balances.</div>';return;}
  var q=qOf("search-balances");
  var shown=balancesCache.filter(function(u){
    return matches(q, [u.username, u.id, String(u.balance), (u.balance!=null?Number(u.balance).toFixed(2):"")+" sahurs"]);
  });
  if(!balancesCache.length){balances.innerHTML='<div class="empty">no balances yet (nobody has claimed sahurs).</div>';return;}
  if(!shown.length){balances.innerHTML='<div class="empty">no matching balances.</div>';return;}
  balances.innerHTML="";
  shown.forEach(function(u){
    var el=document.createElement("div");el.className="app";
    var row=document.createElement("div");row.className="row";
    var name=document.createElement("h3");name.style.flex="1";name.style.margin="0";name.textContent=u.username;
    var bal=document.createElement("small");bal.textContent=u.balance.toFixed(2)+" sahurs";bal.style.color="#f2c063";bal.style.fontWeight="700";
    row.appendChild(name);row.appendChild(bal);el.appendChild(row);
    var idline=document.createElement("small");idline.textContent="id "+u.id;el.appendChild(idline);
    var srow=document.createElement("div");srow.className="row";srow.style.marginTop="8px";
    var inp=document.createElement("input");inp.type="number";inp.min="0";inp.step="0.01";inp.className="tin";inp.placeholder="new balance";inp.value=u.balance.toFixed(2);inp.style.flex="0 1 160px";
    var set=document.createElement("button");set.className="no";set.textContent="set balance";
    set.onclick=function(){setBalance(u.id,u.username,inp.value);};
    srow.appendChild(inp);srow.appendChild(set);el.appendChild(srow);
    balances.appendChild(el);
  });
}
function setBalance(id,name,val){
  var b=Number(val);
  if(!(b>=0)){alert("balance must be 0 or more");return;}
  if(!confirm("Set "+name+"'s balance to "+b.toFixed(2)+" sahurs?"))return;
  fetch("/admin/setbal",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({key:keyEl.value.trim(),id:id,balance:b})}).then(function(r){return r.json();}).then(function(d){if(d.error){alert(d.error);return;}refreshBalances();});
}
function refreshShop(){
  var key=keyEl.value.trim();
  shop.innerHTML='<div class="empty">loading...</div>';
  // the registry first: every card's dropdown is built from it
  loadThemes().then(function(){
  fetch("/admin/shop?key="+encodeURIComponent(key)).then(function(r){return r.json();}).then(function(d){
    if(d.error){shop.innerHTML='<div class="empty">'+d.error+' — check your key.</div>';setCount("shop","");return;}
    shop.innerHTML="";
    setCount("shop", (d.items||[]).length);
    if(!d.items.length){shop.innerHTML='<div class="empty">no shop items yet. hit “add shop item”.</div>';return;}
    d.items.forEach(function(it){shop.appendChild(itemCard(it));});
  }).catch(function(){shop.innerHTML='<div class="empty">network error.</div>';});
  });
}
var THEME_LIST=[];
function loadThemes(){
  var key=keyEl.value.trim();
  return fetch("/admin/themes?key="+encodeURIComponent(key)).then(function(r){return r.json();})
    .then(function(d){ if(d && d.themes) THEME_LIST=d.themes.filter(function(t){return !t.free;}); })
    .catch(function(){});
}
function itemCard(it){
  it=it||{name:"",desc:"",price:0,active:true,inputLabel:"",output:"",theme:""};
  var el=document.createElement("div");el.className="app";
  var r1=document.createElement("div");r1.className="row";
  var name=document.createElement("input");name.className="uname";name.placeholder="item name";name.value=it.name||"";name.maxLength=60;
  var price=document.createElement("input");price.type="number";price.min="0";price.step="0.1";price.className="tin";price.placeholder="price";price.value=(it.price!=null?it.price:"");price.style.flex="0 1 120px";
  r1.appendChild(name);r1.appendChild(price);el.appendChild(r1);
  var r2=document.createElement("div");r2.className="row";
  var desc=document.createElement("input");desc.className="uname";desc.placeholder="description (optional)";desc.value=it.desc||"";desc.maxLength=200;
  r2.appendChild(desc);el.appendChild(r2);
  var r2b=document.createElement("div");r2b.className="row";
  var inputLabel=document.createElement("input");inputLabel.className="uname";inputLabel.placeholder="ask the buyer for… (optional, e.g. your Discord tag)";inputLabel.value=it.inputLabel||"";inputLabel.maxLength=80;
  r2b.appendChild(inputLabel);el.appendChild(r2b);
  var r2c=document.createElement("div");r2c.className="row";
  var output=document.createElement("textarea");output.className="uname";output.placeholder="shown to them after they redeem (optional, e.g. a code)";output.value=it.output||"";output.maxLength=1000;output.rows=3;
  r2c.appendChild(output);el.appendChild(r2c);
  // what this item unlocks. The list is the shrine's own theme registry, so a
  // theme added to the code shows up here and nowhere else until it is sold.
  var r2d=document.createElement("div");r2d.className="row";
  var tlab=document.createElement("label");tlab.style.cssText="display:flex;align-items:center;gap:8px;color:#e9d9c2;font-size:14px;flex:1";
  tlab.appendChild(document.createTextNode("unlocks theme"));
  var theme=document.createElement("select");theme.className="uname";theme.style.flex="1";
  var none=document.createElement("option");none.value="";none.textContent="— nothing, an ordinary item —";theme.appendChild(none);
  THEME_LIST.forEach(function(t){
    var o=document.createElement("option");o.value=t.id;o.textContent=t.name+"  ("+t.id+")";theme.appendChild(o);
  });
  theme.value=it.theme||"";
  // an unknown/removed theme would silently reset the dropdown to "nothing",
  // so keep it visible rather than letting a save wipe it
  if((it.theme||"")&&theme.value!==it.theme){
    var o2=document.createElement("option");o2.value=it.theme;o2.textContent=it.theme+" (not in the registry)";
    theme.appendChild(o2);theme.value=it.theme;
  }
  tlab.appendChild(theme);r2d.appendChild(tlab);el.appendChild(r2d);
  var r3=document.createElement("div");r3.className="row";
  var lab=document.createElement("label");lab.style.cssText="display:flex;align-items:center;gap:6px;color:#e9d9c2;font-size:14px";
  var chk=document.createElement("input");chk.type="checkbox";chk.checked=it.active!==false;chk.style.flex="0";
  lab.appendChild(chk);lab.appendChild(document.createTextNode("visible in shop"));
  var save=document.createElement("button");save.className="load";save.textContent=it.id?"save":"create";
  save.onclick=function(){saveItem(it.id,name.value.trim(),desc.value.trim(),price.value,chk.checked,inputLabel.value.trim(),output.value,el,theme.value);};
  r3.appendChild(lab);r3.appendChild(save);
  if(it.id){var del=document.createElement("button");del.className="no";del.textContent="delete";del.onclick=function(){deleteItem(it.id,it.name);};r3.appendChild(del);}
  el.appendChild(r3);
  return el;
}
function saveItem(id,name,desc,price,active,inputLabel,output,card,theme){
  if(!name){alert("item needs a name");return;}
  if(!(Number(price)>=0)){alert("price must be 0 or more");return;}
  fetch("/admin/shop/set",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({key:keyEl.value.trim(),id:id||"",name:name,desc:desc,price:Number(price),active:active,inputLabel:inputLabel,output:output,theme:theme||""})}).then(function(r){return r.json();}).then(function(d){if(d.error){alert(d.error);return;}refreshShop();});
}
function deleteItem(id,name){
  if(!confirm("Delete shop item: "+name+" ?"))return;
  fetch("/admin/shop/delete",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({key:keyEl.value.trim(),id:id})}).then(function(r){return r.json();}).then(function(d){if(d.error){alert(d.error);return;}refreshShop();});
}
document.getElementById("addItem").onclick=function(){
  if(!keyEl.value.trim()){alert("enter your admin key first");return;}
  loadThemes().then(function(){
    var ph=shop.querySelector(".empty");if(ph)ph.remove();
    shop.appendChild(itemCard(null));
  });
};
</script></body></html>`;
