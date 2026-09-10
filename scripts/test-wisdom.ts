#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read
// The Wisdom of Tung: he speaks every few hours, but only into a room that is
// already talking. Run the app with a tiny window so a few seconds stands in
// for a few hours:
//
//   ADMIN_KEY=devadminkey WISDOM_MIN_MS=1200 WISDOM_MAX_MS=1600 \
//     deno run --allow-net --allow-env --unstable-kv server.ts
//   ADMIN_KEY=devadminkey API=... deno run --allow-net --allow-env --allow-read scripts/test-wisdom.ts

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const API = (Deno.env.get("API") || "http://127.0.0.1:8000").replace(/\/$/, "");
const ADMIN = Deno.env.get("ADMIN_KEY") || "devadminkey";
const WINDOW_MS = Number(Deno.env.get("WISDOM_MAX_MS") || 1600);

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

// the canon, read straight from the server so a broken list fails here
const src = await Deno.readTextFile(`${ROOT}/server.ts`);
const block = src.match(/const WISDOM = \[([\s\S]*?)\n\];/);
must(!!block, "WISDOM list not found in server.ts");
const LINES = [...block![1].matchAll(/^\s*"((?:[^"\\]|\\.)*)",$/gm)].map((m) => m[1]);
must(LINES.length >= 12, `expected a decent scripture, got ${LINES.length} lines`);
must(new Set(LINES).size === LINES.length, "the wisdom list has duplicates");
must(LINES.every((l) => l.length > 8 && l.length < 200), "a wisdom is the wrong length");

// A share of his lines are giveaways drawn from a second pool, so anything he
// says may come from either. This test is about the cadence — one per window,
// never into an empty room — not about which pool the line came from, so accept
// both. The giveaway lines carry {n}, filled with the amount at post time.
const gblock = src.match(/const GIVEAWAY = \[([\s\S]*?)\n\];/);
must(!!gblock, "GIVEAWAY list not found in server.ts");
const GLINES = [...gblock![1].matchAll(/^\s*"((?:[^"\\]|\\.)*)",$/gm)].map((m) => m[1]);
const GIFT_RE = GLINES.map((l) =>
  new RegExp("^" + l.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\\{n\\\}/g, "\\d+") + "$")
);
const canon = (t: string) => LINES.includes(t) || GIFT_RE.some((re) => re.test(t));

async function member(name: string) {
  const a = await post("/apply", { username: name, application: "wisdom test" });
  const token = a.body?.token as string;
  must(!!token, "apply failed for " + name);
  const pend = await j("/admin/pending?key=" + encodeURIComponent(ADMIN));
  const id = (pend.body.pending || []).find((x: { username: string }) => x.username === name)?.id;
  must(!!id, name + " not pending");
  must(!!(await post("/admin/decide", { key: ADMIN, id, action: "approve" })).body?.ok, "approve failed");
  return token;
}

async function wisdomsSoFar(): Promise<string[]> {
  const ev = await j("/admin/chat?key=" + encodeURIComponent(ADMIN));
  return (ev.body.messages || [])
    .filter((m: { name: string }) => m.name === "tung")
    .map((m: { text: string }) => m.text);
}

const stamp = Date.now().toString(36).slice(-6);
const alice = await member("wisA" + stamp);
const bob = await member("wisB" + stamp);

// The chat may already have history and a clock part-way through its window.
// One priming send normalises that: however the state started, `due` is now a
// fresh window away, so everything below holds from any starting point.
await post("/send", { token: alice, text: "priming the clock" });
const before = (await wisdomsSoFar()).length;
const since = async () => (await wisdomsSoFar()).slice(before);

// 1. inside the window he stays quiet, however much the room talks
for (let i = 0; i < 3; i++) await post("/send", { token: alice, text: "chatter " + i });
must((await since()).length === 0, "tung spoke inside his own window");

// 2. a quiet room gets nothing: let the whole window pass with nobody talking
await sleep(WINDOW_MS + 400);
must((await since()).length === 0, "tung spoke into an empty room");

// 3. it takes a real message after the window to bring one out
await post("/send", { token: bob, text: "still here" });
let spoken = await since();
must(spoken.length === 1, `expected exactly one wisdom after the window, got ${spoken.length}`);
must(canon(spoken[0]), "tung said something that is not in either pool: " + spoken[0]);

// 4. and then he is done until the next window
for (let i = 0; i < 3; i++) await post("/send", { token: alice, text: "more chatter " + i });
must((await since()).length === 1, "tung spoke twice inside one window");

// 5. next window, another wisdom — and not the same line twice running
await sleep(WINDOW_MS + 400);
await post("/send", { token: bob, text: "and again" });
spoken = await since();
must(spoken.length === 2, `expected a second wisdom, got ${spoken.length}`);
must(canon(spoken[1]), "second wisdom is not in either pool: " + spoken[1]);
must(spoken[0] !== spoken[1], "tung repeated himself back to back");

console.log(
  `wisdom of tung: ${LINES.length} lines + ${GLINES.length} giveaways; quiet inside his window and in an ` +
    `empty room, one per window, no back-to-back repeat (${JSON.stringify(spoken[0])})`,
);
