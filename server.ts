// Shrine of Tung backend — HTTP-polling chat with history + application auth.
// Storage: Deno KV (persistent, free on Deno Deploy). No WebSockets.
//
// Set these in the Deno Deploy dashboard (Settings -> Environment Variables):
//   DISCORD_WEBHOOK_URL  where applications are posted (optional)
//   ADMIN_KEY            password for the /admin page (required to approve)
//
// Endpoints (JSON, CORS-open):
//   POST /apply         {username, application}          -> {token, status}
//   GET  /status?token=                                   -> {status, username}
//   GET  /events?since=&token=                            -> {events, cursor}
//   POST /send          {token, id, text, reply}          -> {ok}
//   POST /react         {token, id, e, op, eid}           -> {ok}
//   GET  /admin                                           -> admin page (html)
//   GET  /admin/pending?key=                              -> {pending:[...]}
//   POST /admin/decide  {key, id, action:"approve"|"reject"} -> {ok, status}

const kv = await Deno.openKv();
const WEBHOOK = Deno.env.get("DISCORD_WEBHOOK_URL") || "";
const ADMIN_KEY = Deno.env.get("ADMIN_KEY") || "";
const HISTORY = 500; // number of recent events retained (hard cap)
const TTL_MS = 14 * 24 * 60 * 60 * 1000; // messages auto-expire after 2 weeks

// ---------------------------------------------------------------------------
// Tung's Casino — FUN-MONEY ONLY. "Sahurs" have no cash value, cannot be bought,
// and cannot be cashed out. Sahurs normally enter circulation only through the
// Shrine of Sahur faucet (a free claim every 20h). Admins can VIEW balances and,
// as a moderation tool (e.g. resetting an exploiter who found a bug), SET a
// balance to an exact value via /admin/setbal — an explicit, key-gated action.
// Every outcome is decided here on the server with crypto RNG, so nothing about a
// bet, a shuffle, a mine layout, or a crash point is manipulable from the client.
const HOUSE = 0.99;                       // 1% house edge baked into fair payouts
const FAUCET_AMOUNT = 10;                 // sahurs per claim
const FAUCET_INTERVAL = 20 * 60 * 60 * 1000; // every 20 hours
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

// bet validation shared by every game
function parseBet(v: unknown): number | null {
  const b = round2(Number(v));
  if (!isFinite(b) || b < MIN_BET || b > MAX_BET) return null;
  return b;
}

// deno-lint-ignore no-explicit-any
async function getCas(id: string): Promise<{ bal: number; lastClaim: number }> {
  const r = await kv.get<{ bal: number; lastClaim: number }>(["cas", id]);
  return r.value ?? { bal: 0, lastClaim: 0 };
}

// Atomic balance change. delta may be negative (a wager). Returns the new balance,
// or null if the balance would go negative (insufficient funds) — the check+commit
// loop makes double-spends from concurrent requests impossible.
async function adjustBalance(id: string, delta: number): Promise<number | null> {
  for (;;) {
    const cur = await kv.get<{ bal: number; lastClaim: number }>(["cas", id]);
    const rec = cur.value ?? { bal: 0, lastClaim: 0 };
    const nb = round2(rec.bal + delta);
    if (nb < -1e-9) return null; // would overdraw
    const res = await kv.atomic().check(cur)
      .set(["cas", id], { ...rec, bal: Math.max(0, nb) }, { expireIn: CAS_TTL }).commit();
    if (res.ok) return Math.max(0, nb);
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

// post a shop redemption to the chat webhook (best-effort, never blocks the reply)
function notifyRedeem(username: string, item: { name: string; price: number }) {
  if (!WEBHOOK) return;
  fetch(WEBHOOK, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      content: "🛒 **shop redemption**\nuser: **" + username + "**\nitem: **" +
        item.name + "**\ncost: **" + item.price + " sahurs**",
    }),
  }).catch(() => {});
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
function minesMult(count: number, safe: number): number {
  let m = HOUSE;
  for (let i = 0; i < safe; i++) m *= (25 - i) / (25 - count - i);
  return round2(m);
}
// beef multiplier after surviving `step` lanes at per-step survival prob q
function beefMult(q: number, step: number): number {
  return round2(HOUSE / Math.pow(q, step));
}

// resolve a completed blackjack hand (player stood/doubled, dealer has played)
// deno-lint-ignore no-explicit-any
async function settle(st: any, pv: number, dv: number, finish: (r: string, p: number, d: number) => Promise<Response>): Promise<Response> {
  if (dv > 21) return await finish("dealer_bust", round2(st.bet * 2), dv);
  if (pv > dv) return await finish("win", round2(st.bet * 2), dv);
  if (pv < dv) return await finish("lose", 0, dv);
  return await finish("push", st.bet, dv); // tie returns the stake
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

async function appendEvent(ev: Record<string, unknown>) {
  const seq = await nextSeq();
  ev.seq = seq;
  // expireIn gives the key a native TTL: Deno KV deletes it ~2 weeks later on
  // its own, so old chat lines disappear with no per-message timestamp, no
  // sweep job, and no cron. The monotonic seq still orders what remains.
  await kv.set(["ev", seq], ev, { expireIn: TTL_MS });
  if (seq > HISTORY) await kv.delete(["ev", seq - HISTORY]);
  return seq;
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

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const path = url.pathname;
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  // ---------- apply ----------
  if (req.method === "POST" && path === "/apply") {
    // deno-lint-ignore no-explicit-any
    const b: any = await req.json().catch(() => ({}));
    const username = clip(b.username, 24);
    const application = clip(b.application, 500);
    if (!username || !application) return json({ error: "missing" }, 400);
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
    if (WEBHOOK) {
      fetch(WEBHOOK, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          content: "**new Shrine of Tung application**\nusername: " + username +
            "\napplication: " + application + "\nid: `" + id + "`",
        }),
      }).catch(() => {});
    }
    return json({ token, status: "pending", username });
  }

  // ---------- status ----------
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
  if (req.method === "GET" && path === "/events") {
    const user = await authUser(url.searchParams.get("token"));
    if (!user) return json({ error: "unauthorized" }, 401);
    // banned / timed-out users get a blocked payload so the client shows the ban screen
    const bs = blockState(user);
    if (bs.blocked) return json({ blocked: true, reason: bs.reason, until: bs.until, events: [], cursor: Number(url.searchParams.get("since") || "0") || 0 });
    const since = Number(url.searchParams.get("since") || "0") || 0;
    const events: unknown[] = [];
    let cursor = since;
    // deno-lint-ignore no-explicit-any
    for await (const e of kv.list<any>({ prefix: ["ev"], start: ["ev", since + 1] }, { limit: 500 })) {
      events.push(e.value);
      cursor = e.value.seq;
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
    const reply = b.reply && b.reply.id
      ? { id: clip(b.reply.id, 32), name: clip(b.reply.name, 24), text: clip(b.reply.text, 140) }
      : null;
    const id = clip(b.id, 32) || rid(8);
    await appendEvent({ type: "msg", id, name: user.username, text, reply });
    return json({ ok: true });
  }

  // ---------- react ----------
  if (req.method === "POST" && path === "/react") {
    // deno-lint-ignore no-explicit-any
    const b: any = await req.json().catch(() => ({}));
    const user = await authUser(b.token);
    if (!user) return json({ error: "unauthorized" }, 401);
    const id = clip(b.id, 32);
    const e = clip(b.e, 16);
    const op = b.op === -1 ? -1 : 1;
    const eid = clip(b.eid, 16) || rid(6);
    if (!id || !e) return json({ error: "bad" }, 400);
    await appendEvent({ type: "react", id, e, op, eid, name: user.username });
    return json({ ok: true });
  }

  // ---------- admin ----------
  if (req.method === "GET" && path === "/admin") {
    return new Response(ADMIN_HTML, { headers: { "content-type": "text/html; charset=utf-8" } });
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
          note: e.value.note || "",
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
  // removes the application record, frees the username, and revokes every token
  // pointing at it. unlike a ban, this leaves no trace and the name can be reused.
  if (req.method === "POST" && path === "/admin/delete") {
    // deno-lint-ignore no-explicit-any
    const b: any = await req.json().catch(() => ({}));
    if (!ADMIN_KEY || b.key !== ADMIN_KEY) return json({ error: "forbidden" }, 403);
    const id = clip(b.id, 32);
    // deno-lint-ignore no-explicit-any
    const app = await kv.get<any>(["app", id]);
    if (!app.value) return json({ error: "not found" }, 404);
    const lower = String(app.value.username).toLowerCase();
    const atomic = kv.atomic().delete(["app", id]).delete(["name", lower]);
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
    const c = await getCas(u.id);
    const next = c.lastClaim + FAUCET_INTERVAL;
    return json({
      username: u.username, balance: round2(c.bal),
      canClaim: Date.now() >= next, nextClaim: c.lastClaim ? next : 0,
      faucetAmount: FAUCET_AMOUNT, faucetInterval: FAUCET_INTERVAL,
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

  // ---------- DICE (roll under) — instant ----------
  if (req.method === "POST" && path === "/cas/dice") {
    // deno-lint-ignore no-explicit-any
    const b: any = await req.json().catch(() => ({}));
    const u = await casUser(b.token);
    if (!u) return json({ error: "unauthorized" }, 401);
    const bet = parseBet(b.bet);
    if (bet === null) return json({ error: "bad bet" }, 400);
    const target = round2(Number(b.target));
    const over = b.over === true;             // false = roll under, true = roll over
    if (!(target >= 2 && target <= 98)) return json({ error: "target 2–98" }, 400);
    // winning span as a percentage of the 0–100 roll range
    const chance = over ? 100 - target : target;
    if (!(chance >= 2 && chance <= 98)) return json({ error: "bad target" }, 400);
    if (await adjustBalance(u.id, -bet) === null) return json({ error: "insufficient" }, 402);
    const roll = round2(rnd() * 100);
    const win = over ? roll > target : roll < target;
    const mult = win ? round2((100 / chance) * HOUSE) : 0;
    const payout = round2(bet * mult);
    const bal = win ? await adjustBalance(u.id, payout) : (await getCas(u.id)).bal;
    return json({ ok: true, roll, target, over, chance, win, multiplier: mult, payout, balance: round2(bal!) });
  }

  // ---------- LIMBO — instant ----------
  if (req.method === "POST" && path === "/cas/limbo") {
    // deno-lint-ignore no-explicit-any
    const b: any = await req.json().catch(() => ({}));
    const u = await casUser(b.token);
    if (!u) return json({ error: "unauthorized" }, 401);
    const bet = parseBet(b.bet);
    if (bet === null) return json({ error: "bad bet" }, 400);
    const target = round2(Number(b.target)); // desired cash-out multiplier
    if (!(target >= 1.01 && target <= 1000000)) return json({ error: "target 1.01–1e6" }, 400);
    if (await adjustBalance(u.id, -bet) === null) return json({ error: "insufficient" }, 402);
    // crash point c with P(c >= t) = HOUSE/t  → fair, 1% edge
    const crash = Math.max(1, round2((1 / (1 - rnd())) * HOUSE));
    const win = crash >= target;
    const payout = win ? round2(bet * target) : 0;
    const bal = win ? await adjustBalance(u.id, payout) : (await getCas(u.id)).bal;
    return json({ ok: true, crash, target, win, multiplier: win ? target : 0, payout, balance: round2(bal!) });
  }

  // ---------- ROULETTE (European single-zero) — instant ----------
  if (req.method === "POST" && path === "/cas/roulette") {
    // deno-lint-ignore no-explicit-any
    const b: any = await req.json().catch(() => ({}));
    const u = await casUser(b.token);
    if (!u) return json({ error: "unauthorized" }, 401);
    const bet = parseBet(b.bet);
    if (bet === null) return json({ error: "bad bet" }, 400);
    const kind = clip(b.kind, 12);   // number|red|black|odd|even|low|high|dozen|column
    const val = Math.floor(Number(b.value)); // for number(0-36), dozen(1-3), column(1-3)
    // resolve payout multiplier (winnings-to-stake) for each bet kind
    const spin = rndInt(37);
    const isRed = RED.has(spin), zero = spin === 0;
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
    if (await adjustBalance(u.id, -bet) === null) return json({ error: "insufficient" }, 402);
    const payout = won ? round2(bet * mult) : 0;
    const bal = won ? await adjustBalance(u.id, payout) : (await getCas(u.id)).bal;
    return json({ ok: true, spin, color: zero ? "green" : (isRed ? "red" : "black"), win: won, multiplier: won ? mult : 0, payout, balance: round2(bal!) });
  }

  // ---------- PLINKO — instant ----------
  if (req.method === "POST" && path === "/cas/plinko") {
    // deno-lint-ignore no-explicit-any
    const b: any = await req.json().catch(() => ({}));
    const u = await casUser(b.token);
    if (!u) return json({ error: "unauthorized" }, 401);
    const bet = parseBet(b.bet);
    if (bet === null) return json({ error: "bad bet" }, 400);
    const risk = clip(b.risk, 8);
    const rows = Math.floor(Number(b.rows));
    const table = PLINKO[risk] && PLINKO[risk][rows];
    if (!table) return json({ error: "rows 8/12/16, risk low/medium/high" }, 400);
    if (await adjustBalance(u.id, -bet) === null) return json({ error: "insufficient" }, 402);
    const path2: number[] = [];
    let bucket = 0;
    for (let i = 0; i < rows; i++) { const r = rnd() < 0.5 ? 1 : 0; path2.push(r); bucket += r; }
    const mult = table[bucket];
    const payout = round2(bet * mult);
    const bal = await adjustBalance(u.id, payout);
    return json({ ok: true, path: path2, bucket, multiplier: mult, payout, balance: round2(bal!) });
  }

  // ---------- BLACKJACK (start / hit / stand / double) ----------
  if (req.method === "POST" && path === "/cas/bj/start") {
    // deno-lint-ignore no-explicit-any
    const b: any = await req.json().catch(() => ({}));
    const u = await casUser(b.token);
    if (!u) return json({ error: "unauthorized" }, 401);
    const bet = parseBet(b.bet);
    if (bet === null) return json({ error: "bad bet" }, 400);
    if (await adjustBalance(u.id, -bet) === null) return json({ error: "insufficient" }, 402);
    const player = [drawCard(), drawCard()];
    const dealer = [drawCard(), drawCard()];
    const pv = handValue(player), dv = handValue(dealer);
    let state = "playing", result = "", payout = 0;
    if (pv.total === 21 || dv.total === 21) {
      // natural(s) resolve immediately
      if (pv.total === 21 && dv.total === 21) { result = "push"; payout = bet; }
      else if (pv.total === 21) { result = "blackjack"; payout = round2(bet * 2.5); }
      else { result = "dealer_blackjack"; payout = 0; }
      state = "done";
      if (payout > 0) await adjustBalance(u.id, payout);
    }
    if (state === "playing") {
      await kv.set(["bj", u.id], { player, dealer, bet, done: false }, { expireIn: GAME_TTL });
    } else {
      await kv.delete(["bj", u.id]);
    }
    const bal = (await getCas(u.id)).bal;
    return json({
      ok: true, state, result,
      player, playerValue: pv.total,
      dealer: state === "done" ? dealer : [dealer[0], "??"],
      dealerValue: state === "done" ? dv.total : handValue([dealer[0]]).total,
      bet, payout, balance: round2(bal),
      canDouble: state === "playing" && player.length === 2,
    });
  }
  if (req.method === "POST" && (path === "/cas/bj/hit" || path === "/cas/bj/stand" || path === "/cas/bj/double")) {
    // deno-lint-ignore no-explicit-any
    const b: any = await req.json().catch(() => ({}));
    const u = await casUser(b.token);
    if (!u) return json({ error: "unauthorized" }, 401);
    // deno-lint-ignore no-explicit-any
    const g = await kv.get<any>(["bj", u.id]);
    if (!g.value || g.value.done) return json({ error: "no hand" }, 400);
    const st = g.value;
    const finish = async (result: string, payout: number, dv: number) => {
      await kv.delete(["bj", u.id]);
      if (payout > 0) await adjustBalance(u.id, payout);
      const bal = (await getCas(u.id)).bal;
      return json({ ok: true, state: "done", result, player: st.player, playerValue: handValue(st.player).total, dealer: st.dealer, dealerValue: dv, bet: st.bet, payout, balance: round2(bal) });
    };
    const dealerPlay = () => { while (handValue(st.dealer).total < 17) st.dealer.push(drawCard()); return handValue(st.dealer).total; };
    if (path === "/cas/bj/hit") {
      st.player.push(drawCard());
      const pv = handValue(st.player).total;
      if (pv > 21) return await finish("bust", 0, handValue(st.dealer).total);
      await kv.set(["bj", u.id], st, { expireIn: GAME_TTL });
      const bal = (await getCas(u.id)).bal;
      return json({ ok: true, state: "playing", player: st.player, playerValue: pv, dealer: [st.dealer[0], "??"], dealerValue: handValue([st.dealer[0]]).total, bet: st.bet, balance: round2(bal), canDouble: false });
    }
    if (path === "/cas/bj/double") {
      if (st.player.length !== 2) return json({ error: "can only double on first move" }, 400);
      if (await adjustBalance(u.id, -st.bet) === null) return json({ error: "insufficient" }, 402);
      st.bet = round2(st.bet * 2);
      st.player.push(drawCard());
      const pv = handValue(st.player).total;
      if (pv > 21) return await finish("bust", 0, handValue(st.dealer).total);
      const dv = dealerPlay();
      return await settle(st, pv, dv, finish);
    }
    // stand
    const pv = handValue(st.player).total;
    const dv = dealerPlay();
    return await settle(st, pv, dv, finish);
  }

  // ---------- MINES (start / pick / cashout) ----------
  if (req.method === "POST" && path === "/cas/mines/start") {
    // deno-lint-ignore no-explicit-any
    const b: any = await req.json().catch(() => ({}));
    const u = await casUser(b.token);
    if (!u) return json({ error: "unauthorized" }, 401);
    const bet = parseBet(b.bet);
    if (bet === null) return json({ error: "bad bet" }, 400);
    const count = Math.floor(Number(b.mines));
    if (!(count >= 1 && count <= 24)) return json({ error: "mines 1–24" }, 400);
    if (await adjustBalance(u.id, -bet) === null) return json({ error: "insufficient" }, 402);
    // choose `count` distinct mine cells out of 25
    const cells = [...Array(25).keys()];
    for (let i = cells.length - 1; i > 0; i--) { const j = rndInt(i + 1); [cells[i], cells[j]] = [cells[j], cells[i]]; }
    const mines = cells.slice(0, count).sort((a, c) => a - c);
    await kv.set(["mines", u.id], { mines, bet, count, revealed: [] }, { expireIn: GAME_TTL });
    return json({ ok: true, state: "playing", mines: count, revealed: [], multiplier: 1, nextMultiplier: minesMult(count, 1) });
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
    const tile = Math.floor(Number(b.tile));
    if (!(tile >= 0 && tile <= 24) || st.revealed.includes(tile)) return json({ error: "bad tile" }, 400);
    if (st.mines.includes(tile)) {
      await kv.delete(["mines", u.id]);
      const bal = (await getCas(u.id)).bal;
      return json({ ok: true, state: "boom", tile, mines: st.mines, balance: round2(bal) });
    }
    st.revealed.push(tile);
    const safe = st.revealed.length;
    const mult = minesMult(st.count, safe);
    // auto-win once every safe tile is uncovered
    if (safe === 25 - st.count) {
      await kv.delete(["mines", u.id]);
      const payout = round2(st.bet * mult);
      const bal = await adjustBalance(u.id, payout);
      return json({ ok: true, state: "cashout", tile, multiplier: mult, payout, revealed: st.revealed, mines: st.mines, balance: round2(bal!) });
    }
    await kv.set(["mines", u.id], st, { expireIn: GAME_TTL });
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
    await kv.delete(["mines", u.id]);
    const mult = minesMult(st.count, st.revealed.length);
    const payout = round2(st.bet * mult);
    const bal = await adjustBalance(u.id, payout);
    return json({ ok: true, state: "cashout", multiplier: mult, payout, mines: st.mines, balance: round2(bal!) });
  }

  // ---------- BEEF (crash-chicken: start / step / cashout) ----------
  if (req.method === "POST" && path === "/cas/beef/start") {
    // deno-lint-ignore no-explicit-any
    const b: any = await req.json().catch(() => ({}));
    const u = await casUser(b.token);
    if (!u) return json({ error: "unauthorized" }, 401);
    const bet = parseBet(b.bet);
    if (bet === null) return json({ error: "bad bet" }, 400);
    const diff = clip(b.difficulty, 10);
    const cfg = BEEF[diff];
    if (!cfg) return json({ error: "difficulty easy/medium/hard/daredevil" }, 400);
    if (await adjustBalance(u.id, -bet) === null) return json({ error: "insufficient" }, 402);
    // pre-roll the death lane NOW so the outcome is fixed server-side and the
    // client cannot influence any step. deathStep = first lane the chicken dies on.
    let deathStep = cfg.lanes + 1; // survives the whole road unless rolled sooner
    for (let s = 1; s <= cfg.lanes; s++) { if (rnd() >= cfg.q) { deathStep = s; break; } }
    await kv.set(["beef", u.id], { bet, q: cfg.q, lanes: cfg.lanes, deathStep, step: 0 }, { expireIn: GAME_TTL });
    return json({ ok: true, state: "playing", step: 0, lanes: cfg.lanes, multiplier: 1, nextMultiplier: beefMult(cfg.q, 1) });
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
    const nextStep = st.step + 1;
    if (nextStep >= st.deathStep) {
      await kv.delete(["beef", u.id]);
      const bal = (await getCas(u.id)).bal;
      return json({ ok: true, state: "dead", step: nextStep, deathStep: st.deathStep, balance: round2(bal) });
    }
    st.step = nextStep;
    const mult = beefMult(st.q, nextStep);
    if (nextStep >= st.lanes) {
      // reached the far side — auto cash out at the top multiplier
      await kv.delete(["beef", u.id]);
      const payout = round2(st.bet * mult);
      const bal = await adjustBalance(u.id, payout);
      return json({ ok: true, state: "cashout", step: nextStep, multiplier: mult, payout, balance: round2(bal!) });
    }
    await kv.set(["beef", u.id], st, { expireIn: GAME_TTL });
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
    if (st.step < 1) return json({ error: "take a step first" }, 400);
    await kv.delete(["beef", u.id]);
    const mult = beefMult(st.q, st.step);
    const payout = round2(st.bet * mult);
    const bal = await adjustBalance(u.id, payout);
    return json({ ok: true, state: "cashout", step: st.step, multiplier: mult, payout, balance: round2(bal!) });
  }

  // ---------- SHOP: list active items + redeem ----------
  if (req.method === "GET" && path === "/shop/list") {
    const u = await casUser(url.searchParams.get("token"));
    if (!u) return json({ error: "unauthorized" }, 401);
    const items: unknown[] = [];
    // deno-lint-ignore no-explicit-any
    for await (const e of kv.list<any>({ prefix: ["shopitem"] })) {
      if (e.value.active) items.push({ id: e.value.id, name: e.value.name, desc: e.value.desc, price: e.value.price });
    }
    // deno-lint-ignore no-explicit-any
    items.sort((a: any, c: any) => a.price - c.price);
    const bal = (await getCas(u.id)).bal;
    return json({ items, balance: round2(bal) });
  }
  if (req.method === "POST" && path === "/shop/redeem") {
    // deno-lint-ignore no-explicit-any
    const b: any = await req.json().catch(() => ({}));
    const u = await casUser(b.token);
    if (!u) return json({ error: "unauthorized" }, 401);
    // deno-lint-ignore no-explicit-any
    const it = await kv.get<any>(["shopitem", clip(b.itemId, 32)]);
    if (!it.value || !it.value.active) return json({ error: "unavailable" }, 404);
    const price = round2(Number(it.value.price));
    const bal = await adjustBalance(u.id, -price);
    if (bal === null) return json({ error: "insufficient" }, 402);
    notifyRedeem(u.username, { name: it.value.name, price });
    return json({ ok: true, balance: round2(bal), item: it.value.name, price });
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
      rows.push({ id, username: names[id] || "(deleted)", balance: round2(e.value.bal || 0) });
    }
    rows.sort((a, c) => c.balance - a.balance);
    return json({ balances: rows });
  }

  // ---------- admin: shop management (list all / upsert / delete) ----------
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
    // deno-lint-ignore no-explicit-any
    const existing = await kv.get<any>(["shopitem", id]);
    const ts = existing.value?.ts || Date.now();
    await kv.set(["shopitem", id], { id, name, desc, price, active, ts });
    return json({ ok: true, item: { id, name, desc, price, active, ts } });
  }
  if (req.method === "POST" && path === "/admin/shop/delete") {
    // deno-lint-ignore no-explicit-any
    const b: any = await req.json().catch(() => ({}));
    if (!ADMIN_KEY || b.key !== ADMIN_KEY) return json({ error: "forbidden" }, 403);
    await kv.delete(["shopitem", clip(b.id, 32)]);
    return json({ ok: true, deleted: true });
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
main{max-width:720px;margin:0 auto;padding:20px}
.keybar{display:flex;gap:8px;margin-bottom:16px}
input{flex:1;padding:10px 12px;border-radius:8px;border:1px solid #3a2410;background:#160d04;color:#f5efe0;font-size:14px}
button{padding:10px 14px;border:none;border-radius:8px;font-weight:600;cursor:pointer}
.load{background:#c8823c;color:#1d1206}
.app{background:#241505;border:1px solid #3a2410;border-radius:12px;padding:14px 16px;margin-bottom:12px}
.app h3{margin:0 0 4px;font-size:16px}
.app p{margin:0 0 12px;color:#e9d9c2;white-space:pre-wrap;word-break:break-word}
.app small{color:#c8823c}
.row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.row+.row{margin-top:8px}
.ok{background:#2e7d32;color:#fff}
.no{background:#7a2e2e;color:#fff}
.empty{color:#c8823c;padding:20px 0}
.sec{margin:26px 0 10px;font-size:18px;font-weight:700}
.uname{flex:1;min-width:120px}
.tin{flex:0 1 220px;min-width:150px}
.app small.rev{color:#e0908a}
.thread{margin:12px 0 0;display:flex;flex-direction:column;gap:6px}
.tmsg{padding:7px 11px;border-radius:10px;font-size:.86rem;max-width:85%;white-space:pre-wrap;word-break:break-word}
.tmsg.admin{align-self:flex-end;background:#c8823c;color:#1d1206}
.tmsg.applicant{align-self:flex-start;background:#241505;border:1px solid #3a2410}
</style></head><body>
<header>Shrine of Tung — pending applications</header>
<main>
<div class="keybar"><input id="key" type="password" placeholder="admin key" autocomplete="off"><button class="load" id="load">load</button><button class="no" id="clear">clear all</button></div>
<div id="list"><div class="empty">enter your admin key and hit load.</div></div>
<h2 class="sec">approved users</h2>
<div id="users"><div class="empty">load to see approved users.</div></div>
<h2 class="sec">🎰 casino — player balances <small style="font-weight:400;color:#8a6a3a">(set a balance only to clean up an exploiter)</small></h2>
<div id="balances"><div class="empty">load to see player balances.</div></div>
<h2 class="sec">🛒 shop items</h2>
<div id="shop"><div class="empty">load to manage the shop.</div></div>
<div class="row" style="margin-top:12px"><button class="load" id="addItem">+ add shop item</button></div>
</main>
<script>
var keyEl=document.getElementById("key"),list=document.getElementById("list"),users=document.getElementById("users");
var balances=document.getElementById("balances"),shop=document.getElementById("shop");
try{var k=localStorage.getItem("shrine-admin-key");if(k)keyEl.value=k;}catch(e){}
function loadAll(){refresh();refreshUsers();refreshBalances();refreshShop();}   /* all panels share the one "load" button */
document.getElementById("load").onclick=loadAll;
document.getElementById("clear").onclick=function(){
  if(!confirm("Delete ALL applications (pending + approved)? Everyone will have to re-apply."))return;
  fetch("/admin/clear",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({key:keyEl.value.trim()})}).then(function(r){return r.json();}).then(function(d){alert(d.error?d.error:("cleared "+d.cleared+" entries"));loadAll();});
};
function refresh(){
  var key=keyEl.value.trim();try{localStorage.setItem("shrine-admin-key",key);}catch(e){}
  list.innerHTML='<div class="empty">loading...</div>';
  fetch("/admin/pending?key="+encodeURIComponent(key)).then(function(r){return r.json();}).then(function(d){
    if(d.error){list.innerHTML='<div class="empty">'+d.error+' — check your key.</div>';return;}
    if(!d.pending.length){list.innerHTML='<div class="empty">no pending applications.</div>';return;}
    list.innerHTML="";
    d.pending.forEach(function(a){
      var el=document.createElement("div");el.className="app";
      var h=document.createElement("h3");h.textContent=a.username;el.appendChild(h);
      var p=document.createElement("p");p.textContent=a.application;el.appendChild(p);
      var s=document.createElement("small");s.textContent=new Date(a.ts).toLocaleString();el.appendChild(s);
      var row=document.createElement("div");row.className="row";row.style.marginTop="10px";
      var ok=document.createElement("button");ok.className="ok";ok.textContent="approve";ok.onclick=function(){decide(a.id,"approve");};
      var no=document.createElement("button");no.className="no";no.textContent="reject";no.onclick=function(){decide(a.id,"reject");};
      row.appendChild(ok);row.appendChild(no);el.appendChild(row);
      // follow-up thread (tung's questions + the applicant's answers)
      if((a.thread||[]).length){
        var th=document.createElement("div");th.className="thread";
        a.thread.forEach(function(m){
          var b=document.createElement("div");b.className="tmsg "+(m.from==="admin"?"admin":"applicant");
          b.textContent=(m.from==="admin"?"tung: ":a.username+": ")+m.text;
          th.appendChild(b);
        });
        el.appendChild(th);
      }
      // ask a follow-up question
      var mrow=document.createElement("div");mrow.className="row";mrow.style.marginTop="8px";
      var mi=document.createElement("input");mi.className="uname";mi.placeholder="ask a follow-up question…";mi.maxLength=1000;
      var mb=document.createElement("button");mb.className="load";mb.textContent="send";
      mb.onclick=function(){var t=mi.value.trim();if(!t)return;mi.value="";sendMsg(a.id,t);};
      mi.addEventListener("keydown",function(ev){if(ev.key==="Enter"){ev.preventDefault();mb.onclick();}});
      mrow.appendChild(mi);mrow.appendChild(mb);el.appendChild(mrow);
      list.appendChild(el);
    });
  }).catch(function(){list.innerHTML='<div class="empty">network error.</div>';});
}
function decide(id,action){
  fetch("/admin/decide",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({key:keyEl.value.trim(),id:id,action:action})}).then(function(r){return r.json();}).then(function(){refresh();refreshUsers();});
}
function sendMsg(id,text){
  fetch("/admin/message",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({key:keyEl.value.trim(),id:id,text:text})}).then(function(r){return r.json();}).then(function(d){if(d.error)alert(d.error);refresh();});
}
/* the "approved users" panel: rename, ban/unban, and time users out */
// format a ms-epoch into the value a <input type=datetime-local> expects (local, no seconds)
function toLocalInput(ms){var d=new Date(ms - new Date(ms).getTimezoneOffset()*60000);return d.toISOString().slice(0,16);}
function refreshUsers(){
  var key=keyEl.value.trim();
  users.innerHTML='<div class="empty">loading...</div>';
  fetch("/admin/users?key="+encodeURIComponent(key)).then(function(r){return r.json();}).then(function(d){
    if(d.error){users.innerHTML='<div class="empty">'+d.error+' — check your key.</div>';return;}
    if(!d.users.length){users.innerHTML='<div class="empty">no approved users yet.</div>';return;}
    users.innerHTML="";
    d.users.forEach(function(u){
      var el=document.createElement("div");el.className="app";
      // row 1: username field + save + ban/unban
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
      // row 2: timeout-until picker + apply + clear
      var trow=document.createElement("div");trow.className="row";
      var dt=document.createElement("input");dt.type="datetime-local";dt.className="tin";
      if(u.timeoutUntil&&u.timeoutUntil>Date.now())dt.value=toLocalInput(u.timeoutUntil);
      var apply=document.createElement("button");apply.className="no";apply.textContent="time out until";
      apply.onclick=function(){if(!dt.value){alert("pick a date/time first");return;}var ms=new Date(dt.value).getTime();if(!(ms>Date.now())){alert("pick a time in the future");return;}setTimeoutUntil(u.id,ms);};
      var clr=document.createElement("button");clr.className="load";clr.textContent="clear timeout";
      clr.onclick=function(){setTimeoutUntil(u.id,0);};
      trow.appendChild(dt);trow.appendChild(apply);trow.appendChild(clr);
      el.appendChild(trow);
      // row 3: private admin note
      var nrow=document.createElement("div");nrow.className="row";
      var note=document.createElement("input");note.className="uname";note.placeholder="private note (admin only)";note.value=u.note||"";note.maxLength=500;
      var nsave=document.createElement("button");nsave.className="load";nsave.textContent="save note";
      nsave.onclick=function(){saveNote(u.id,note.value.trim());};
      nrow.appendChild(note);nrow.appendChild(nsave);
      el.appendChild(nrow);
      // status line
      var meta=document.createElement("small");
      if(u.banned){meta.textContent="banned (permanent)";meta.className="rev";}
      else if(u.timeoutUntil&&u.timeoutUntil>Date.now()){meta.textContent="timed out until "+new Date(u.timeoutUntil).toLocaleString();meta.className="rev";}
      else{meta.textContent="active · joined "+new Date(u.ts).toLocaleString();}
      el.appendChild(meta);
      users.appendChild(el);
    });
  }).catch(function(){users.innerHTML='<div class="empty">network error.</div>';});
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
function saveNote(id,note){
  fetch("/admin/note",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({key:keyEl.value.trim(),id:id,note:note})}).then(function(r){return r.json();}).then(function(d){if(d.error)alert(d.error);refreshUsers();});
}
function deleteUser(id,name){
  if(!confirm("Delete "+name+" entirely? This frees the username and cannot be undone."))return;
  fetch("/admin/delete",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({key:keyEl.value.trim(),id:id})}).then(function(r){return r.json();}).then(function(d){if(d.error)alert(d.error);refreshUsers();});
}
function repend(id,name){
  if(!confirm("Send "+name+" back to review? They'll return to the application screen where you can ask follow-up questions."))return;
  fetch("/admin/repend",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({key:keyEl.value.trim(),id:id})}).then(function(r){return r.json();}).then(function(d){if(d.error)alert(d.error);refresh();refreshUsers();});
}
/* ---- casino: player balances (READ ONLY — there is deliberately no edit path) ---- */
function refreshBalances(){
  var key=keyEl.value.trim();
  balances.innerHTML='<div class="empty">loading...</div>';
  fetch("/admin/balances?key="+encodeURIComponent(key)).then(function(r){return r.json();}).then(function(d){
    if(d.error){balances.innerHTML='<div class="empty">'+d.error+' — check your key.</div>';return;}
    if(!d.balances.length){balances.innerHTML='<div class="empty">no balances yet (nobody has claimed sahurs).</div>';return;}
    balances.innerHTML="";
    d.balances.forEach(function(u){
      var el=document.createElement("div");el.className="app";
      var row=document.createElement("div");row.className="row";
      var name=document.createElement("h3");name.style.flex="1";name.style.margin="0";name.textContent=u.username;
      var bal=document.createElement("small");bal.textContent=u.balance.toFixed(2)+" sahurs";bal.style.color="#f2c063";bal.style.fontWeight="700";
      row.appendChild(name);row.appendChild(bal);el.appendChild(row);
      // moderation: set this player's balance to an exact value
      var srow=document.createElement("div");srow.className="row";srow.style.marginTop="8px";
      var inp=document.createElement("input");inp.type="number";inp.min="0";inp.step="0.01";inp.className="tin";inp.placeholder="new balance";inp.value=u.balance.toFixed(2);inp.style.flex="0 1 160px";
      var set=document.createElement("button");set.className="no";set.textContent="set balance";
      set.onclick=function(){setBalance(u.id,u.username,inp.value);};
      srow.appendChild(inp);srow.appendChild(set);el.appendChild(srow);
      balances.appendChild(el);
    });
  }).catch(function(){balances.innerHTML='<div class="empty">network error.</div>';});
}
function setBalance(id,name,val){
  var b=Number(val);
  if(!(b>=0)){alert("balance must be 0 or more");return;}
  if(!confirm("Set "+name+"'s balance to "+b.toFixed(2)+" sahurs?"))return;
  fetch("/admin/setbal",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({key:keyEl.value.trim(),id:id,balance:b})}).then(function(r){return r.json();}).then(function(d){if(d.error){alert(d.error);return;}refreshBalances();});
}
/* ---- casino: shop management (add / edit / enable / delete items) ---- */
function refreshShop(){
  var key=keyEl.value.trim();
  shop.innerHTML='<div class="empty">loading...</div>';
  fetch("/admin/shop?key="+encodeURIComponent(key)).then(function(r){return r.json();}).then(function(d){
    if(d.error){shop.innerHTML='<div class="empty">'+d.error+' — check your key.</div>';return;}
    shop.innerHTML="";
    if(!d.items.length){shop.innerHTML='<div class="empty">no shop items yet. hit “add shop item”.</div>';return;}
    d.items.forEach(function(it){shop.appendChild(itemCard(it));});
  }).catch(function(){shop.innerHTML='<div class="empty">network error.</div>';});
}
function itemCard(it){
  it=it||{name:"",desc:"",price:0,active:true};
  var el=document.createElement("div");el.className="app";
  var r1=document.createElement("div");r1.className="row";
  var name=document.createElement("input");name.className="uname";name.placeholder="item name";name.value=it.name||"";name.maxLength=60;
  var price=document.createElement("input");price.type="number";price.min="0";price.step="0.1";price.className="tin";price.placeholder="price";price.value=(it.price!=null?it.price:"");price.style.flex="0 1 120px";
  r1.appendChild(name);r1.appendChild(price);el.appendChild(r1);
  var r2=document.createElement("div");r2.className="row";
  var desc=document.createElement("input");desc.className="uname";desc.placeholder="description (optional)";desc.value=it.desc||"";desc.maxLength=200;
  r2.appendChild(desc);el.appendChild(r2);
  var r3=document.createElement("div");r3.className="row";
  var lab=document.createElement("label");lab.style.cssText="display:flex;align-items:center;gap:6px;color:#e9d9c2;font-size:14px";
  var chk=document.createElement("input");chk.type="checkbox";chk.checked=it.active!==false;chk.style.flex="0";
  lab.appendChild(chk);lab.appendChild(document.createTextNode("visible in shop"));
  var save=document.createElement("button");save.className="load";save.textContent=it.id?"save":"create";
  save.onclick=function(){saveItem(it.id,name.value.trim(),desc.value.trim(),price.value,chk.checked,el);};
  r3.appendChild(lab);r3.appendChild(save);
  if(it.id){var del=document.createElement("button");del.className="no";del.textContent="delete";del.onclick=function(){deleteItem(it.id,it.name);};r3.appendChild(del);}
  el.appendChild(r3);
  return el;
}
function saveItem(id,name,desc,price,active,card){
  if(!name){alert("item needs a name");return;}
  if(!(Number(price)>=0)){alert("price must be 0 or more");return;}
  fetch("/admin/shop/set",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({key:keyEl.value.trim(),id:id||"",name:name,desc:desc,price:Number(price),active:active})}).then(function(r){return r.json();}).then(function(d){if(d.error){alert(d.error);return;}refreshShop();});
}
function deleteItem(id,name){
  if(!confirm("Delete shop item: "+name+" ?"))return;
  fetch("/admin/shop/delete",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({key:keyEl.value.trim(),id:id})}).then(function(r){return r.json();}).then(function(d){if(d.error){alert(d.error);return;}refreshShop();});
}
document.getElementById("addItem").onclick=function(){
  if(!keyEl.value.trim()){alert("enter your admin key first");return;}
  var ph=shop.querySelector(".empty");if(ph)ph.remove();
  shop.appendChild(itemCard(null));
};
</script></body></html>`;
