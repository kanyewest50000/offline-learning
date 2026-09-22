#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read
// The pit lobby reads an index of tables that are filling, not every duel
// record of the day.
//
// It used to walk `["duel"]` — up to two hundred records — and throw away the
// ones that were not open. A finished duel lingers a day so both players can
// read the result, so nearly everything it walked was history: two hundred
// reads, every 1.5 seconds, per person standing in the lobby, to show a handful
// of rows. That was the most expensive read in the casino by a distance.
//
// A table that is open now has a key of its own, written and deleted by the
// same commits that move it in and out of that state. The thing to hold is that
// those commits do not miss one — in either direction:
//
//   a table that IS open and has no entry is invisible, which is the failure
//   that would actually cost somebody a game;
//   an entry naming a table that is no longer open is a wasted read, and the
//   lobby deletes it on sight rather than believing it.
//
// The record stays the truth throughout. The index is only ever a hint about
// where to look, which is why a missed delete cannot be more than a nuisance.
//
//   ADMIN_KEY=devadminkey DUEL_OPEN_MS=2000 DUEL_CONFIRM_MS=2000 \
//     deno run --allow-net --allow-env --unstable-kv server.ts
//   ADMIN_KEY=devadminkey API=... deno run --allow-net --allow-env --allow-read scripts/test-pit-index.ts

import { ROOT } from "./shrine-sources.ts";

const API = (Deno.env.get("API") || "http://127.0.0.1:8000").replace(/\/$/, "");
const ADMIN = Deno.env.get("ADMIN_KEY") || "devadminkey";
const OPEN_MS = Number(Deno.env.get("DUEL_OPEN_MS") || 2000);

function must(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}
async function j(path: string, opt?: RequestInit) {
  const r = await fetch(API + path, opt);
  return { status: r.status, body: await r.json().catch(() => ({})) as Record<string, unknown> };
}
const post = (path: string, obj: unknown) =>
  j(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(obj) });
const nap = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ===========================================================================
// source: every commit that can leave a table open, or stop it being open
// ===========================================================================
const src = await Deno.readTextFile(`${ROOT}/server.ts`);
must(/function duelIndex\(op: Deno\.AtomicOperation, d: Duel\): Deno\.AtomicOperation \{/.test(src),
  "one helper decides what the index says, so no site can decide it differently");
must(/d\.state === "open" && !d\.settled\s*\?\s*op\.set\(\["duelopen", d\.id\]/.test(src),
  "…and it is keyed on the state of the record, not on which route called it");

// The four commits that write a duel record outside commitDuel() all have to go
// through it, and so does commitDuel() itself. Counting them is the point: a
// new one added later without the index is exactly the bug this cannot have.
const writes = [...src.matchAll(/\.set\(\["duel", [^\]]*\], [a-z]+, \{ expireIn: DUEL_TTL \}\)/g)].length;
const indexed = [...src.matchAll(/duelIndex\(/g)].length;
must(writes >= 5, "could not find the duel writes: " + writes);
// one definition + one call per write, minus sayAtTable's, which only ever
// touches a table that is already live
must(indexed >= writes, "every commit that writes a duel must also say what the index should be: " +
  indexed + " uses against " + writes + " writes");
must(/for await \(const e of kv\.list<number>\(\{ prefix: \["duelopen"\] \}, \{ limit: 200 \}\)\)/.test(src),
  "the lobby must read the index rather than the duels");
must(/if \(!d \|\| d\.settled \|\| d\.state !== "open"\) \{ await kv\.delete\(\["duelopen", id\]\); continue; \}/.test(src),
  "…and must sweep an entry that has stopped being true instead of trusting it");
must(!/kv\.list<Duel>\(\{ prefix: \["duel"\] \}/.test(src),
  "nothing may walk every duel record any more");

// ===========================================================================
// live
// ===========================================================================
async function member(tag: string) {
  const name = tag + Math.random().toString(36).slice(2, 8);
  const a = await post("/apply", { username: name, application: "pit index" });
  const token = a.body?.token as string;
  must(!!token, "apply failed: " + JSON.stringify(a.body));
  const pend = await j("/admin/pending?key=" + encodeURIComponent(ADMIN));
  const id = (pend.body.pending as { username: string; id: string }[] || [])
    .find((x) => x.username === name)?.id;
  must(!!id, name + " not pending");
  must(!!(await post("/admin/decide", { key: ADMIN, id, action: "approve" })).body?.ok, "approve failed");
  must(!!(await post("/admin/setbal", { key: ADMIN, id, balance: 500 })).body?.ok, "setbal failed");
  return { name, token, id: id as string };
}
const W = await member("pxW");   // watches the lobby and never sits down
const lobby = async () =>
  ((await j("/duel/list?token=" + encodeURIComponent(W.token))).body.open as { id: string }[]) || [];
const listed = async (id: string) => (await lobby()).some((t) => t.id === id);

// --- a table put up is in the lobby -----------------------------------------
const H = await member("pxH"), G = await member("pxG");
const made = await post("/duel/create", { token: H.token, game: "chess", bet: 0 });
must(made.body?.ok, "create failed: " + JSON.stringify(made.body));
const id = (made.body.duel as { id: string }).id;
must(await listed(id), "a table that has just gone up must be in the lobby");

// --- and out of it the moment it stops filling ------------------------------
must((await post("/duel/join", { token: G.token, id })).body?.ok, "join failed");
must(!await listed(id), "a full table must leave the lobby in the commit that filled it");
for (const p of [H, G]) await post("/duel/confirm", { token: p.token, id });
const live = await j("/duel/state?token=" + encodeURIComponent(H.token) + "&id=" + id);
must((live.body.duel as { state: string }).state === "live", "the game should have started");
must(!await listed(id), "…and a live game is not an open table");

// --- cancelling takes it out too --------------------------------------------
const C = await member("pxC");
const cut = await post("/duel/create", { token: C.token, game: "chess", bet: 0 });
const cid = (cut.body.duel as { id: string }).id;
must(await listed(cid), "the second table is up");
must((await post("/duel/cancel", { token: C.token, id: cid })).body?.ok, "cancel failed");
must(!await listed(cid), "a table taken down must leave the lobby");

// --- and so does one that runs out its clock --------------------------------
const X = await member("pxX");
const exp = await post("/duel/create", { token: X.token, game: "chess", bet: 0 });
const xid = (exp.body.duel as { id: string }).id;
must(await listed(xid), "the third table is up");
await nap(OPEN_MS + 700);
must(!await listed(xid), "a table past its clock must be swept out of the lobby");
const dead = await j("/duel/state?token=" + encodeURIComponent(X.token) + "&id=" + xid);
const dv = dead.body.duel as { state: string; reason: string };
must(dv.state === "done" && dv.reason === "expired",
  "…and refunded on the way, exactly as it was before: " + JSON.stringify(dv));

// --- calling tung into the last chair closes it the same way ----------------
const T = await member("pxT");
// a cut cannot be played for nothing — only chess can — so this one is staked
const cutT = await post("/duel/create", { token: T.token, game: "cut", bet: 1 });
must(cutT.body?.ok, "could not put a cut up: " + JSON.stringify(cutT.body));
const tid = (cutT.body.duel as { id: string }).id;
must(await listed(tid), "the cut is up");
// calling tung into the last chair fills it, which closes it the same way a
// player sitting down does
const called = await post("/duel/call", { token: T.token, id: tid });
must(called.body?.ok, "could not call tung: " + JSON.stringify(called.body));
must(!await listed(tid), "a cut tung filled must leave the lobby too");

// --- and a pile of finished games is not something the lobby reads ----------
// Whatever is left over from every test above, plus these: the lobby's answer
// has to be about what is OPEN, not about how much has happened today.
const quiet = await lobby();
must(!quiet.some((t) => t.id === id || t.id === cid || t.id === xid),
  "nothing that has finished may come back: " + JSON.stringify(quiet.map((t) => t.id)));

console.log(
  "pit index: a table is in the lobby from the commit that puts it up to the commit that " +
    "fills, cancels or expires it, and never after — the lobby reads the index and the tables " +
    "it names rather than every duel record of the day, and an entry that has stopped being " +
    "true is swept on sight instead of believed",
);
