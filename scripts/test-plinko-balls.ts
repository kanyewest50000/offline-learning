#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read
// Plinko: several balls on the board at once, and every one of them lands where
// the server said it would.
//
// The animation is the only thing that changed — the drop itself is decided on
// the server and always was. So the thing worth guarding is that the pretty
// version cannot move a ball: the waypoints are computed from the server's own
// left/right path before a frame is drawn, and the last of them is the exact
// centre of the bucket that path adds up to. That is checked here against the
// REAL client code, pulled out of the emitted string, rather than a copy of it.
//
//   ADMIN_KEY=devadminkey deno run --allow-net --allow-env --unstable-kv server.ts
//   ADMIN_KEY=devadminkey API=... deno run --allow-net --allow-env --allow-read scripts/test-plinko-balls.ts

import { ROOT } from "./shrine-sources.ts";

const API = (Deno.env.get("API") || "http://127.0.0.1:8000").replace(/\/$/, "");
const ADMIN = Deno.env.get("ADMIN_KEY") || "devadminkey";

function must(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}
async function j(path: string, opt?: RequestInit) {
  const r = await fetch(API + path, opt);
  return { status: r.status, body: await r.json().catch(() => ({})) as Record<string, unknown> };
}
const post = (path: string, obj: unknown) =>
  j(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(obj) });

// ---------------------------------------------------------------------------
// pull the real client out and unit-test the geometry it actually ships
// deno-lint-ignore no-explicit-any
const win: any = { Shrine: { LBL: { POPUP: "p", ORIGINALS: "o", WEB_VEIL: "w", CURATED: "c", SEARCH: "s", PLAYS: "g" } } };
for (
  const f of ["config.js", "games-catalog.js", "originals.js", "chat.js", "casino.js", "styles.js", "markup.js", "window.js"]
) {
  new Function("window", "location", "document", await Deno.readTextFile(`${ROOT}/assets/js/shrine/${f}`))(
    win,
    { href: "https://example.test/", search: "" },
    undefined,
  );
}
const client = String(win.Shrine.CASINO_JS);
must(client.length > 1000, "could not emit the casino client");

const waySrc = client.match(/function wayPoints\(path\)\s*\{[\s\S]*?return \{pts:pts,bucket:rights\};\s*\}/);
must(!!waySrc, "could not find wayPoints in the emitted client");
// give it the same geometry the board uses, then ask it where a ball goes
function wayFor(rows: number, path: number[]) {
  const W = 300, cx = W / 2, bw = W / (rows + 1), rowH = Math.min(20, 240 / rows), topY = 22;
  const make = new Function(
    "cx", "bw", "rowH", "topY",
    waySrc![0] + "; return wayPoints;",
  )(cx, bw, rowH, topY) as (p: number[]) => { pts: { x: number; y: number }[]; bucket: number };
  return { ...make(path), bw, W };
}

for (const rows of [8, 12, 16]) {
  // every path through the board, for the small one; a good spread for the rest
  const paths: number[][] = [];
  if (rows === 8) {
    for (let mask = 0; mask < (1 << rows); mask++) {
      paths.push(Array.from({ length: rows }, (_, i) => (mask >> i) & 1));
    }
  } else {
    for (let n = 0; n < 400; n++) {
      paths.push(Array.from({ length: rows }, () => (Math.random() < 0.5 ? 1 : 0)));
    }
    paths.push(new Array(rows).fill(0), new Array(rows).fill(1));   // both edges
  }
  for (const path of paths) {
    const w = wayFor(rows, path);
    const bucket = path.reduce((a, b) => a + b, 0);
    must(w.bucket === bucket, `rows ${rows}: the client counted bucket ${w.bucket}, the path says ${bucket}`);
    // one waypoint per peg row, plus the landing, plus the drop into the bucket
    must(w.pts.length === rows + 2, `rows ${rows}: expected ${rows + 2} waypoints, got ${w.pts.length}`);
    // THE invariant: the ball comes to rest on the centre of its own bucket
    const centre = (bucket + 0.5) * w.bw;
    const landed = w.pts[rows].x;
    must(Math.abs(landed - centre) < 1e-9,
      `rows ${rows}, bucket ${bucket}: the ball lands at ${landed}, the bucket is centred at ${centre}`);
    // and it never wanders off the board on the way down
    for (const p of w.pts) {
      must(p.x >= -1e-9 && p.x <= w.W + 1e-9, `rows ${rows}: a waypoint left the board at x=${p.x}`);
    }
    // it only ever falls
    for (let i = 1; i < w.pts.length; i++) {
      must(w.pts[i].y > w.pts[i - 1].y, `rows ${rows}: the ball must never go back up between pegs`);
    }
  }
}

// ---------------------------------------------------------------------------
// the client must be built for more than one ball, and must not give a result
// away. Scoped to plinko's own code: every other table locks its button while
// its one wager plays out, and should carry on doing so.
const pStart = client.indexOf("function viewPlinko()");
const pEnd = client.indexOf("BLACKJACK", pStart);
must(pStart >= 0 && pEnd > pStart, "could not find the plinko client");
const plinko = client.slice(pStart, pEnd);
must(/MAX_BALLS\s*=\s*\d+/.test(plinko), "the board must have a cap on how many balls it will hold");
must(/if\(BALLS\.length>=MAX_BALLS\)/.test(plinko), "and must enforce it rather than queueing forever");
must(/BALLS\.push\(\{/.test(plinko) && /for\(var n=0;n<BALLS\.length;n\+\+\)/.test(plinko),
  "the animation must run over a list of balls, not one ball");
must(/requestAnimationFrame\(tick\)/.test(plinko), "the fall must be a real frame loop");
must(/if\(flying<=0\)\{/.test(plinko) && /roundSaw\(pending\)/.test(plinko),
  "with several in the air, the wood must not be released until the last one lands");
must(/if\(d\.seq>applied\)\{applied=d\.seq;setBal\(d\.balance\);\}/.test(plinko),
  "two drops can answer out of order, so the balance must follow the newest answer");
// the old one-ball-at-a-time lock must be gone
must(!/go\.disabled=true/.test(plinko),
  "the drop button must no longer lock the board to a single ball");

// ---------------------------------------------------------------------------
// live: the server still decides the drop, and its answer is self-consistent
const n = "plk" + Math.random().toString(36).slice(2, 8);
const a = await post("/apply", { username: n, application: "plinko" });
const token = a.body.token as string;
must(!!token, "apply failed");
const pend = await j("/admin/pending?key=" + encodeURIComponent(ADMIN));
const id = (pend.body.pending as { username: string; id: string }[] || []).find((x) => x.username === n)?.id;
must(!!id, "not pending");
must(!!(await post("/admin/decide", { key: ADMIN, id, action: "approve" })).body?.ok, "approve failed");
must(!!(await post("/admin/setbal", { key: ADMIN, id, balance: 10000 })).body?.ok, "setbal failed");

for (const rows of [8, 12, 16]) {
  for (let k = 0; k < 12; k++) {
    const d = await post("/cas/plinko", { token, bet: 1, risk: "medium", rows });
    must(d.body?.ok === true, "plinko failed: " + JSON.stringify(d.body));
    const path = d.body.path as number[];
    const bucket = d.body.bucket as number;
    must(Array.isArray(path) && path.length === rows, "a drop must carry one step per row");
    must(path.every((x) => x === 0 || x === 1), "each step is a left or a right: " + JSON.stringify(path));
    must(path.reduce((x, y) => x + y, 0) === bucket, "the bucket must be the path added up");
    // and the client's own geometry agrees about where that lands
    const w = wayFor(rows, path);
    must(w.bucket === bucket, "the client and the server must agree on the bucket");
  }
}
// several drops in flight at once is just several requests: the server holds no
// per-player plinko state, so they cannot interfere
const many = await Promise.all(new Array(6).fill(0).map(() =>
  post("/cas/plinko", { token, bet: 1, risk: "medium", rows: 12 })
));
must(many.every((m) => m.body?.ok === true), "six drops at once must all play");
must(new Set(many.map((m) => JSON.stringify(m.body.path))).size > 1,
  "and must not all be the same drop");

console.log(
  "plinko: the board holds several balls at once, the fall is a real frame loop, and the " +
    "animation cannot move a ball — every path lands dead on the centre of the bucket it " +
    "adds up to, at 8, 12 and 16 rows, never leaving the board and never travelling upward",
);
