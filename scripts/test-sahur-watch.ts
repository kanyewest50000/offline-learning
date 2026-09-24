#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read
// The sahur watch: catching the scripts that claim the faucet the second it is
// ready and snipe tung's giveaways before a person could have read them.
//
// Every claim — faucet or giveaway — is written down with when it was made,
// how long after it became claimable, a salted tag for the network it came
// from, and what the page could say about the click (a real click? a tab
// somebody was looking at? how long since the last touch?). Rules read that
// log on each claim; a member who trips enough of them lands in the panel's
// review queue, where their claims can be read and a verdict given: barred
// from claiming, paid less, made to wait longer, what they took taken back.
// The rules are public, in server.ts; the numbers they are set to live in KV
// and are changed from the panel.
//
// This file checks the source, then drives it all against a live server. It
// changes the watch's settings to make each rule trip on demand, and puts
// them back at the end.
//
//   ADMIN_KEY=devadminkey deno run --allow-net --allow-env --unstable-kv server.ts
//   ADMIN_KEY=devadminkey API=... deno run --allow-net --allow-env --allow-read scripts/test-sahur-watch.ts
//
// With the server's SHRINE_KV_PATH, --allow-write and --unstable-kv it also
// winds a member's faucet clock back to check the timing rules, and checks an
// account's deletion takes the watch's notes with it.

import { readShrineFile, ROOT } from "./shrine-sources.ts";

const API = (Deno.env.get("API") || "http://127.0.0.1:8000").replace(/\/$/, "");
const ADMIN = Deno.env.get("ADMIN_KEY") || "devadminkey";
const KV_PATH = Deno.env.get("SHRINE_KV_PATH") || "";
const HOUR = 3600_000, DAY = 24 * HOUR;

function must(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}
// deno-lint-ignore no-explicit-any
type Any = any;
async function j(path: string, opt?: RequestInit) {
  const r = await fetch(API + path, opt);
  return { status: r.status, body: await r.json().catch(() => ({})) as Any };
}
const post = (path: string, obj: unknown) =>
  j(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(obj) });
const watch = (what: string, body: Record<string, unknown> = {}) => post("/admin/watch/" + what, { key: ADMIN, ...body });

// ===========================================================================
// the source
// ===========================================================================
const server = await Deno.readTextFile(ROOT + "/server.ts");
const chat = await readShrineFile("assets/js/shrine/chat.js");
const casino = await readShrineFile("assets/js/shrine/casino.js");

must(server.includes('await kv.get(["watch", "config"])'), "the watch's settings must live in KV, not in the public source");
must((server.match(/await watchClaim\(/g) || []).length === 2, "both the faucet and the giveaways must write every claim down");
const claimRoute = server.slice(server.indexOf('path === "/cas/claim"'), server.indexOf("// ---------- pick a game back up"));
must(claimRoute.indexOf('if (pen.banned) return json({ error: "claim_banned"') > 0 &&
  claimRoute.indexOf('if (pen.banned) return json({ error: "claim_banned"') < claimRoute.indexOf("for (;;)"),
  "a barred member must be refused before the faucet clock is even read");
must(claimRoute.includes("const interval = FAUCET_INTERVAL * pen.slowX;") &&
  claimRoute.includes("const amount = round2(FAUCET_AMOUNT * pen.reducePct / 100);"),
  "the faucet must pay and wait what the penalty says");
must(/\} catch \(_e\) \{ \/\* a claim is never refused because the watch could not look \*\/ \}/.test(server),
  "the watch must never be able to break the claim it follows");
must(server.includes('crypto.subtle.digest("SHA-256", new TextEncoder().encode("net|" + ADMIN_KEY + "|" + ip))'),
  "networks are kept as a salted hash, never the address");
// the page says how the click was made, and both claim buttons send it
must(chat.includes("window.__claimProof=function(ev){return{tr:ev&&ev.isTrusted?1:0,"), "the page must describe the click");
must(chat.includes('\'["pointermove","keydown","wheel","touchstart"].forEach(function(t){document.addEventListener(t,function(){LAST_INPUT=Date.now();}'),
  "how long the hands sat still is measured from moves, keys and touches — never the pointerdown of the click itself");
must(chat.includes('apiPost("/gift/claim",{token:TOKEN,id:id,cli:window.__claimProof(ev)})'), "a giveaway claim must carry it");
must(chat.includes("claimGift(m.gift.id,ev);"), "…from the real click event");
must(casino.includes('jpost("/cas/claim",{cli:cli})'), "the faucet claim must carry it");
must(casino.includes('if(d&&d.error==="claim_banned"){me.banUntil=d.until||0;paintClaim();return;}'),
  "a barred member must be told the altar is closed to them");
must(casino.includes('"free sahurs, on the house. every 2 hours."'), "an unpunished member sees the faucet exactly as before");
// the panel
must(server.includes('data-pane="watch"') && server.includes('id="pane-watch"'), "the panel needs its Sahur watch pane");
must(/function loadAll\(\)\{[^}]*watchFlags\(\);/.test(server), "the review count must load with everything else");
must(server.indexOf('apost("/admin/talk/send"') < server.indexOf('apost("/admin/timeout",{id:d.id'),
  "a warning must go out before a timeout, which would shut tung's DM out");
must(server.includes('const watchKeys: Deno.KvKey[] = [["claimpen", id], ["watch", "flag", id]];'),
  "deleting an account must take the watch's notes on it");

// ===========================================================================
// live
// ===========================================================================
async function member(tag: string) {
  const name = tag + Math.random().toString(36).slice(2, 8);
  let a = await post("/apply", { username: name, application: "sahur watch test" });
  for (let i = 0; a.body?.error === "slow down" && i < 15; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    a = await post("/apply", { username: name, application: "sahur watch test" });
  }
  const token = a.body?.token as string;
  must(!!token, "apply failed for " + name + ": " + JSON.stringify(a.body));
  const pend = await j("/admin/pending?key=" + encodeURIComponent(ADMIN));
  const id = (pend.body.pending as { username: string; id: string }[] || []).find((x) => x.username === name)?.id;
  must(!!id, name + " not pending");
  must(!!(await post("/admin/decide", { key: ADMIN, id, action: "approve" })).body?.ok, "approve failed");
  return { name, token, id: id as string };
}
type M = Awaited<ReturnType<typeof member>>;
const PROOF = { tr: 1, vis: 1, foc: 1, idle: 400 };
const claim = (m: M, cli?: unknown) => post("/cas/claim", { token: m.token, ...(cli ? { cli } : {}) });
const me = async (m: M) => (await j("/cas/me?token=" + encodeURIComponent(m.token))).body;
const lookup = async (m: M) => {
  const r = await watch("user", { id: m.id });
  must(r.body?.ok, "lookup failed for " + m.name + ": " + JSON.stringify(r.body));
  return r.body;
};
const flags = async () => {
  const r = await watch("flags");
  must(r.body?.ok, "the review queue did not load: " + JSON.stringify(r.body));
  return r.body as { open: Any[]; closed: Any[] };
};
const openFlag = async (m: M) => (await flags()).open.find((f) => f.uid === m.id);
const closedFlag = async (m: M) => (await flags()).closed.find((f) => f.uid === m.id);

// the panel as served: the page is a template literal in server.ts, which eats
// single backslashes, so the pattern that turns each rule's {placeholders}
// into number boxes has to arrive intact
const panel = await (await fetch(API + "/admin", {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ key: ADMIN }),
})).text();
must(panel.includes("WRULE_TEXT[k].split(/(\\{\\w+\\})/)") && panel.includes("var m=/^\\{(\\w+)\\}$/.exec(part);"),
  "the rules tab must turn every {placeholder} into a number box");

// the key
must((await post("/admin/watch/config", { key: "wrong" })).status === 403, "a wrong key must not read the settings");
must((await post("/admin/watch/flags", {})).status === 403, "no key must not read the queue");
must((await post("/admin/watch/punish", { key: "nope", id: "x" })).status === 403, "nor punish anybody");

// the settings: whatever is saved is clamped, and what is not sent keeps its default
const first = await watch("config");
must(first.body?.ok && first.body.config && first.body.defaults && first.body.names, "the settings must load");
const ORIGINAL = first.body.config;
const DEFAULTS = first.body.defaults;
must(Object.keys(DEFAULTS.rules).length >= 11, "there should be eleven rules to tune");
for (const k of Object.keys(DEFAULTS.rules)) must(typeof first.body.names[k] === "string", "rule " + k + " needs a name");
const junk = await watch("config", {
  config: { minRules: 0, keepDays: 1, quietDays: 500, rules: { volume: { count: 99999, hours: -5 }, sharednet: { on: "yes" } } },
});
const jc = junk.body.config;
must(jc.minRules === 1 && jc.keepDays === 3 && jc.quietDays === 90, "the global numbers must be clamped: " + JSON.stringify(jc));
must(jc.rules.volume.count === 500 && jc.rules.volume.hours === 1, "a rule's numbers must be clamped: " + JSON.stringify(jc.rules.volume));
must(jc.rules.sharednet.on === false, "only a real true turns a rule on");
must(jc.rules.regular.seconds === DEFAULTS.rules.regular.seconds && jc.rules.regular.on === DEFAULTS.rules.regular.on,
  "a rule that was not sent keeps its default");
must((await watch("config")).body.config.rules.volume.count === 500, "the save must stick");

// every rule off but the ones named, each set to trip at once
function only(over: Record<string, Record<string, unknown>>, extra: Record<string, unknown> = {}) {
  const rules: Any = {};
  for (const k of Object.keys(DEFAULTS.rules)) rules[k] = { ...DEFAULTS.rules[k], on: false };
  for (const [k, v] of Object.entries(over)) rules[k] = { ...rules[k], ...v, on: true };
  return { on: true, minRules: 1, quietDays: 3, keepDays: 30, rules, ...extra };
}
async function setCfg(c: unknown) {
  const r = await watch("config", { config: c });
  must(r.body?.ok, "saving the settings failed: " + JSON.stringify(r.body));
}

try {
  // ---- a claim straight from a script says nothing about the click ----
  await setCfg(only({ noclick: { count: 1, of: 1 } }));
  const S = await member("swS"), P = await member("swP");
  const sc = await claim(S);
  must(sc.body?.ok && sc.body.claimed === 10 && sc.body.faucet === 10, "an unpunished claim pays 10: " + JSON.stringify(sc.body));
  must(typeof sc.body.nextClaim === "number" && Math.abs(sc.body.nextClaim - Date.now() - 2 * HOUR) < 60_000,
    "…and the clock is two hours as ever");
  must((await claim(P, PROOF)).body?.ok, "a claim from the page goes through");
  const sf = await openFlag(S);
  must(sf && sf.hits.some((h: Any) => h.rule === "noclick"), "a claim with no click behind it must be flagged: " + JSON.stringify(sf));
  must(sf.name === S.name && sf.status === "open", "the flag names them and is open");
  must(!(await openFlag(P)), "a claim made from the page must not be");
  const sl = await lookup(S);
  must(sl.logs.length === 1 && sl.logs[0].kind === "faucet" && sl.logs[0].amt === 10 && !sl.logs[0].cli,
    "the lookup must show the claim as made: " + JSON.stringify(sl.logs));
  must(/^[0-9a-f]{10}$/.test(sl.logs[0].net) && !JSON.stringify(sl).includes("127.0.0.1"),
    "the network is a tag, never an address: " + sl.logs[0].net);
  must(sl.hits.some((h: Any) => h.rule === "noclick") && sl.flag?.status === "open", "the lookup shows what trips and the flag");
  must(sl.balance === 10 && sl.faucet.amount === 10, "and their balance and the faucet");
  const pl = await lookup(P);
  must(JSON.stringify(pl.logs[0].cli) === JSON.stringify(PROOF), "what the page said is kept as sent: " + JSON.stringify(pl.logs[0].cli));
  must(pl.hits.length === 0 && !pl.flag, "nothing trips on a real click");
  // what a script might send instead is clamped, not trusted
  const F = await member("swF");
  must((await claim(F, { tr: true, vis: "1", foc: 7, idle: -50, extra: "x" })).body?.ok, "a claim with junk proof still goes through");
  const fl = await lookup(F);
  must(JSON.stringify(fl.logs[0].cli) === JSON.stringify({ tr: 0, vis: 0, foc: 0, idle: 0 }),
    "only exactly 1 counts as yes: " + JSON.stringify(fl.logs[0].cli));

  // ---- from a tab nobody is looking at ----
  await setCfg(only({ hidden: { count: 1, of: 1 } }));
  const H = await member("swH");
  must((await claim(H, { ...PROOF, vis: 0 })).body?.ok, "a hidden-tab claim still goes through");
  must((await openFlag(H))?.hits.some((h: Any) => h.rule === "hidden"), "a claim from a hidden tab must be flagged");

  // ---- a real click on a mouse nobody has moved: a macro ----
  await setCfg(only({ still: { count: 1, of: 1, seconds: 600 } }));
  const K = await member("swK"), K2 = await member("swL");
  must((await claim(K, { ...PROOF, idle: 3_600_000 })).body?.ok && (await claim(K2, PROOF)).body?.ok, "claims failed");
  must((await openFlag(K))?.hits.some((h: Any) => h.rule === "still"), "a click after an hour of stillness must be flagged");
  must(!(await openFlag(K2)), "a click after moving the mouse must not");
  must(!(await lookup(S)).hits.some((h: Any) => h.rule === "still"), "nor a claim with no proof at all — that is the no-click rule's to judge");

  // ---- one network, many accounts: every member here claims from 127.0.0.1 ----
  await setCfg(only({ sharednet: { accounts: 2, hours: 1 } }));
  const N = await member("swN");
  must((await claim(N, PROOF)).body?.ok, "claim failed");
  must((await openFlag(N))?.hits.some((h: Any) => h.rule === "sharednet"), "a shared network must be flagged when it is on");
  const nl = await lookup(N);
  must(nl.nets.length === 1 && nl.nets[0].others.includes(S.name) && nl.nets[0].others.includes(P.name),
    "the lookup must name who else claims from that network: " + JSON.stringify(nl.nets));

  // ---- needing two rules at once ----
  await setCfg(only({ volume: { count: 1, hours: 24 }, noclick: { count: 1, of: 1 } }, { minRules: 2 }));
  const V1 = await member("swV"), V2 = await member("swW");
  must((await claim(V1, PROOF)).body?.ok && (await claim(V2)).body?.ok, "claims failed");
  must(!(await openFlag(V1)), "one rule of two must not flag");
  const v2 = await openFlag(V2);
  must(v2 && v2.hits.length === 2, "two of two must: " + JSON.stringify(v2));

  // ---- the watch switched off still writes down, and a scan catches up ----
  await setCfg(only({ noclick: { count: 1, of: 1 } }, { on: false }));
  const O = await member("swO");
  must((await claim(O)).body?.ok, "claim failed");
  must(!(await openFlag(O)), "with the watch off nobody is flagged");
  must((await lookup(O)).logs.length === 1, "…but the claim is still written down");
  await setCfg(only({ noclick: { count: 1, of: 1 } }));
  const scan = await watch("scan");
  must(scan.body?.ok && scan.body.looked >= 8 && scan.body.flagged >= 1, "a scan must look at everyone: " + JSON.stringify(scan.body));
  must(await openFlag(O), "…and flag who trips the rules as they are now");

  // ---- barred from claiming, giveaways too ----
  const sb = await watch("punish", { id: S.id, ban: { hours: 1, gifts: true }, note: "clicked by nobody" });
  must(sb.body?.ok && /barred from claiming for 1h \(giveaways too\)/.test(sb.body.verdict), "punish failed: " + JSON.stringify(sb.body));
  const sm = await me(S);
  must(sm.canClaim === false && Math.abs(sm.claimBan - Date.now() - HOUR) < 60_000, "the casino must know they are barred: " + JSON.stringify(sm));
  const sbc = await claim(S, PROOF);
  must(sbc.status === 403 && sbc.body.error === "claim_banned" && sbc.body.until === sm.claimBan,
    "a barred faucet claim must be refused, saying until when: " + JSON.stringify(sbc));
  const sbg = await post("/gift/claim", { token: S.token, id: "nosuchgift" });
  must(sbg.status === 403 && sbg.body.error === "claim_banned", "and a giveaway: " + JSON.stringify(sbg));
  must(!(await openFlag(S)), "a verdict takes them off the queue");
  const sClosed = await closedFlag(S);
  must(sClosed && sClosed.verdict === sb.body.verdict && sClosed.closedAt > 0, "…and keeps it: " + JSON.stringify(sClosed));
  const sl2 = await lookup(S);
  must(sl2.penalty?.note === "clicked by nobody" && sl2.now.banned === true, "the lookup shows the penalty and the note");
  // what they were judged for is spent: a scan under the same rules leaves them be
  await watch("scan");
  must(!(await openFlag(S)), "the claims a verdict was given for must not flag them again");
  must((await watch("lift", { id: S.id })).body?.ok, "lift failed");
  const sm2 = await me(S);
  must(sm2.claimBan === undefined && !sm2.reduced && !sm2.slowed, "a lifted penalty is gone at once: " + JSON.stringify(sm2));
  must((await post("/gift/claim", { token: S.token, id: "nosuchgift" })).status === 404, "giveaways open again");
  must((await lookup(S)).penalty === null, "and the lookup says so");

  // ---- barred from the faucet only ----
  must((await watch("punish", { id: P.id, ban: { hours: 2, gifts: false } })).body?.ok, "punish failed");
  must((await claim(P, PROOF)).body?.error === "claim_banned", "the faucet is barred");
  must((await post("/gift/claim", { token: P.token, id: "nosuchgift" })).status === 404, "but giveaways are not, when so set");
  await watch("lift", { id: P.id });

  // ---- paid less ----
  const C = await member("swC");
  const cp = await watch("punish", { id: C.id, reduce: { pct: 50, days: 7 } });
  must(cp.body?.ok && cp.body.verdict === "claims paid at 50% for 7 days", "reduce failed: " + JSON.stringify(cp.body));
  const cm = await me(C);
  must(cm.faucetAmount === 5 && cm.reduced?.pct === 50 && Math.abs(cm.reduced.until - Date.now() - 7 * DAY) < 60_000,
    "the casino must show the reduced claim: " + JSON.stringify(cm));
  const cc = await claim(C, PROOF);
  must(cc.body?.ok && cc.body.claimed === 5 && cc.body.faucet === 5 && cc.body.balance === 5, "a reduced claim pays half: " + JSON.stringify(cc.body));
  must((await lookup(C)).logs[0].amt === 5, "and is logged at what it paid");

  // ---- made to wait longer ----
  const D = await member("swD");
  must((await watch("punish", { id: D.id, slow: { x: 3, days: 2 } })).body?.ok, "slow failed");
  const dm = await me(D);
  must(dm.faucetInterval === 6 * HOUR && dm.slowed?.x === 3 && dm.canClaim === true, "the casino must show the longer wait: " + JSON.stringify(dm));
  const dc = await claim(D, PROOF);
  must(dc.body?.ok && Math.abs(dc.body.nextClaim - Date.now() - 6 * HOUR) < 60_000, "the next claim is three times as far: " + JSON.stringify(dc.body));
  const dc2 = await claim(D, PROOF);
  must(dc2.status === 429 && dc2.body.nextClaim === dc.body.nextClaim, "and held to it");

  // ---- what they took, taken back ----
  const E = await member("swE");
  must((await claim(E, PROOF)).body?.balance === 10, "claim failed");
  const et = await watch("punish", { id: E.id, takeBack: { days: 1 } });
  must(et.body?.ok && et.body.taken === 10 && et.body.penalty === null, "take back failed: " + JSON.stringify(et.body));
  must((await me(E)).balance === 0, "the balance must drop by what they claimed");
  const et2 = await watch("punish", { id: E.id, takeBack: { days: 1 } });
  must(et2.body.taken === 0, "never below nothing");

  // ---- not a bot ----
  const hd = await watch("dismiss", { id: H.id, quietDays: 1 });
  must(hd.body?.ok && hd.body.quietDays === 1, "dismiss failed: " + JSON.stringify(hd.body));
  const hClosed = await closedFlag(H);
  must(hClosed?.verdict === "dismissed — not a bot" && Math.abs(hClosed.quietUntil - Date.now() - DAY) < 60_000,
    "a dismissal closes the flag and leaves them alone: " + JSON.stringify(hClosed));
  await setCfg(only({ hidden: { count: 1, of: 1 }, volume: { count: 1, hours: 24 } }));
  await watch("scan");
  must(!(await openFlag(H)), "a dismissed member is not flagged again while quiet");

  // ---- a verdict with nothing ticked is still a verdict ----
  const ov = await watch("punish", { id: O.id });
  must(ov.body?.ok && ov.body.verdict === "reviewed" && ov.body.penalty === null, "an empty verdict: " + JSON.stringify(ov.body));
  must(!(await openFlag(O)), "…closes the review");
  must((await watch("user", { id: "nobody-at-all" })).status === 404, "a lookup of nobody is a 404");

  // ---- the clock: claiming the moment it is ready, like clockwork ----
  const canWrite = (await Deno.permissions.query({ name: "write" })).state === "granted";
  const reach = !!KV_PATH && canWrite && typeof Deno.openKv === "function";
  // opened for each touch and closed straight after, never held across a
  // request — the server has the same SQLite file open
  const withKv = async <T>(f: (kv: Deno.Kv) => Promise<T>): Promise<T> => {
    const k = await Deno.openKv(KV_PATH);
    try {
      return await f(k);
    } finally {
      k.close();
    }
  };
  let timing = "not checked (run with SHRINE_KV_PATH, --allow-write and --unstable-kv)";
  if (reach) {
    await setCfg(only({ quick: { count: 1, of: 1, seconds: 30 } }));
    const Q = await member("swQ");
    must((await claim(Q, PROOF)).body?.ok, "claim failed");
    must((await lookup(Q)).logs[0].lag === undefined, "the first claim ever has no clock to be early or late on");
    // wind the clock back so the faucet has been ready for four seconds
    const rewind = () =>
      withKv(async (kv) => {
        const e = await kv.get<{ bal: number; lastClaim: number }>(["cas", Q.id]);
        await kv.set(["cas", Q.id], { ...e.value!, lastClaim: Date.now() - 2 * HOUR - 4000 });
      });
    for (let i = 0; i < 3; i++) {
      await rewind();
      must((await claim(Q, PROOF)).body?.ok, "a claim after the rewind failed");
    }
    const ql = await lookup(Q);
    must(ql.logs.length === 4 && ql.logs.slice(1).every((l: Any) => l.lag >= 4000 && l.lag < 30_000),
      "each claim must record how long it sat ready: " + JSON.stringify(ql.logs.map((l: Any) => l.lag)));
    must((await openFlag(Q))?.hits.some((h: Any) => h.rule === "quick"), "claiming the instant it is ready must be flagged");
    // the rest of the clock rules, read live against the same four claims
    await setCfg(only({
      regular: { of: 3, seconds: 600 }, volume: { count: 4, hours: 1 }, streak: { perDay: 4, days: 1 },
    }));
    const qh = (await lookup(Q)).hits.map((h: Any) => h.rule).sort().join(",");
    must(qh === "regular,streak,volume", "clockwork, volume and a day's streak must all read the log: " + qh);
    // punished, then deleted: nothing of the watch's is left
    must((await watch("punish", { id: Q.id, reduce: { pct: 10, days: 1 } })).body?.ok, "punish failed");
    must((await post("/admin/delete", { key: ADMIN, id: Q.id })).body?.ok, "delete failed");
    const left = await withKv(async (kv) => {
      let n = 0;
      for await (const _e of kv.list({ prefix: ["claimlog", Q.id] })) n++;
      if ((await kv.get(["claimpen", Q.id])).value) n++;
      if ((await kv.get(["watch", "flag", Q.id])).value) n++;
      return n;
    });
    must(left === 0, "a deleted account must take its claim log, penalty and flag with it (" + left + " left)");
    timing = "checked";
  }
  must((await post("/admin/delete", { key: ADMIN, id: V2.id })).body?.ok, "delete failed");
  const after = await flags();
  must(![...after.open, ...after.closed].some((f) => f.uid === V2.id), "a deleted account leaves the review queue");

  console.log(
    "sahur watch: every faucet and giveaway claim is written down with its timing, a salted network tag " +
      "and what the page said about the click; the rules — numbers in KV, clamped on save — flag a " +
      "scripted claim, a hidden tab, a shared network, and two rules at once only when asked; a scan " +
      "catches up; a verdict bars the faucet (and giveaways, or not), pays less, waits longer or takes " +
      "back what was claimed, closes the review and spends its evidence; a dismissal keeps them off the " +
      "queue; lifting ends it; deleting the account ends the lot. timing rules: " + timing,
  );
} finally {
  // put the watch back as it was found
  await watch("config", { config: ORIGINAL });
}
