#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read
// Reading a member's login key back out of the admin panel.
//
// The key IS the account — casUser() asks for nothing else — so this is the
// one admin read that hands over the ability to be somebody. It exists because
// the key is also the one thing a member cannot be sent again: it is shown once
// on the pending screen, and somebody who loses it has no account left. This is
// the way back in, and the tests below are about it costing what it should and
// no more.
//
//   ADMIN_KEY=devadminkey deno run --allow-net --allow-env --unstable-kv server.ts
//   ADMIN_KEY=devadminkey API=http://127.0.0.1:8000 deno run --allow-net --allow-env --allow-read scripts/test-admin-token.ts

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const API = (Deno.env.get("API") || "http://127.0.0.1:8000").replace(/\/$/, "");
const ADMIN = Deno.env.get("ADMIN_KEY") || "devadminkey";

function must(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}
// deno-lint-ignore no-explicit-any
async function call(path: string, init?: RequestInit): Promise<{ s: number; b: any }> {
  const r = await fetch(API + path, init);
  return { s: r.status, b: await r.json().catch(() => ({})) };
}
// deno-lint-ignore no-explicit-any
function post(path: string, body: unknown): Promise<{ s: number; b: any }> {
  return call(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// a member, and the key /apply issued them
const name = "tokread" + Math.random().toString(36).slice(2, 8);
const applied = await post("/apply", { username: name, application: "reading my own key back" });
const issued = String(applied.b.token || "");
must(issued.length > 0, "/apply did not issue a key");

const pending = await call("/admin/pending", { headers: { "x-admin-key": ADMIN } });
// deno-lint-ignore no-explicit-any
const row = (pending.b.pending || []).find((p: any) => p.username === name);
must(!!row, "the application did not reach the pending list");
const id = String(row.id);

// ---------------------------------------------------------------------------
// the panel gets back exactly the key that was issued, and it still works
const got = await post("/admin/token", { key: ADMIN, id });
must(got.s === 200, "the right key must open the lookup: " + got.s);
must(Array.isArray(got.b.tokens), "it must answer with a list of keys");
must(got.b.tokens.includes(issued), "it must return the key /apply actually issued");
must(got.b.username === name, "and say whose it is, so a mis-click is visible before it is handed over");

// what comes back is the account, not a reference to it
const who = await call("/status?token=" + encodeURIComponent(got.b.tokens[0]));
must(who.b.username === name, "the revealed key must log in as that member: " + JSON.stringify(who.b));

// ---------------------------------------------------------------------------
// and it is refused to everyone else
must((await post("/admin/token", { key: ADMIN + "x", id })).s === 403, "a wrong admin key must be refused");
must((await post("/admin/token", { id })).s === 403, "no admin key at all must be refused");
must((await post("/admin/token", { key: ADMIN, id: "nosuchmember" })).s === 404, "an unknown member is 404");

// A GET must not serve it. The route is a POST so the member's id stays out of
// the address bar, history and the access log, the same reason the admin key
// itself rides a header — and a keyed GET falls through to the liveness line
// rather than being answered, so what matters is that no key comes back on it
// however plausible the URL looks.
const viaGet = await fetch(API + "/admin/token?key=" + encodeURIComponent(ADMIN) + "&id=" + id);
const getBody = await viaGet.text();
must(!getBody.includes(issued), "a GET must never yield a login key");
must(!getBody.includes('"tokens"'), "and must not answer the lookup at all: " + getBody.slice(0, 80));

// ---------------------------------------------------------------------------
// source: the key must not be riding along on every poll of the user list
const src = await Deno.readTextFile(`${ROOT}/server.ts`);
const usersStart = src.indexOf('path === "/admin/users"');
must(usersStart > 0, "could not find the users route");
const usersSrc = src.slice(usersStart, usersStart + 1200);
must(!/token/i.test(usersSrc), "/admin/users must not carry login keys — it is polled");

// and the panel must ask for one by POST, never by putting the id in a URL
const panelStart = src.indexOf("const ADMIN_HTML");
const panelSrc = src.slice(panelStart);
must(panelSrc.includes('fetch("/admin/token",{method:"POST"'), "the panel must ask for a key by POST");
must(!/\/admin\/token\?/.test(panelSrc), "the panel must never put a member id in a query string");
// it is not on screen until somebody asks for it
must(/confirm\("Show "\+name\+"'s login key\?/.test(panelSrc), "revealing a key must be confirmed first");

console.log(
  "admin token: the panel can read a member's login key back — the same one /apply issued, which " +
    "logs in as them — but only by POST, only for one member at a time, only after a confirm, and " +
    "never as part of the polled user list",
);
