#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read
// Skins are property. Only the ones marked `free` in the registry belong to
// everybody; every other theme is locked to every member until tung puts it in
// the shop and that member buys it. That default is the point — adding a theme
// to the code must ship it locked, not quietly hand it to the whole shrine.
//
//   ADMIN_KEY=devadminkey deno run --allow-net --allow-env --unstable-kv server.ts
//   ADMIN_KEY=devadminkey API=... deno run --allow-net --allow-env --allow-read scripts/test-themes.ts

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const API = (Deno.env.get("API") || "http://127.0.0.1:8000").replace(/\/$/, "");
const ADMIN = Deno.env.get("ADMIN_KEY") || "devadminkey";

function must(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}
async function j(path: string, opt?: RequestInit) {
  const r = await fetch(API + path, opt);
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
const post = (path: string, obj: unknown) =>
  j(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(obj) });
const money = (n: number) => Math.round(n * 100) / 100;

// ---------------------------------------------------------------------------
// source: exactly one theme may be free, and it must be the base stylesheet
const src = await Deno.readTextFile(`${ROOT}/server.ts`);
const block = src.match(/const SHRINE_THEMES[\s\S]*?\n\];/);
must(!!block, "no theme registry in server.ts");
const frees = [...block![0].matchAll(/id: "([a-z0-9-]+)"[^}]*free: true/g)].map((m) => m[1]);
must(frees.length === 1 && frees[0] === "wood",
  "only the wood may be free — anything else is a theme given away by accident: " + JSON.stringify(frees));
// the client must not be the one deciding what it owns
const chat = await Deno.readTextFile(`${ROOT}/assets/js/shrine/chat.js`);
must(/api\("\/themes\?token="/.test(chat), "the client must ask the server which themes are its own");

async function member(tag: string, balance = 500) {
  const n = tag + Math.random().toString(36).slice(2, 8);
  const a = await post("/apply", { username: n, application: "themes" });
  const token = a.body?.token as string;
  must(!!token, "apply failed for " + n);
  const pend = await j("/admin/pending?key=" + encodeURIComponent(ADMIN));
  const id = (pend.body.pending || []).find((x: { username: string }) => x.username === n)?.id;
  must(!!id, n + " not pending");
  must(!!(await post("/admin/decide", { key: ADMIN, id, action: "approve" })).body?.ok, "approve failed");
  must(!!(await post("/admin/setbal", { key: ADMIN, id, balance })).body?.ok, "setbal failed");
  return { name: n, token, id };
}
// deno-lint-ignore no-explicit-any
const themes = async (t: string): Promise<any[]> =>
  (await j("/themes?token=" + encodeURIComponent(t))).body.themes || [];
const theme = async (t: string, id: string) => (await themes(t)).find((x) => x.id === id);
const bal = async (t: string) => money((await j("/cas/me?token=" + encodeURIComponent(t))).body.balance as number);

const A = await member("thA");
const B = await member("thB");

// ---------------------------------------------------------------------------
// 1. locked by default, and free means free
{
  const all = await themes(A.token);
  must(all.length >= 2, "the registry should carry more than one skin");
  const wood = all.find((t) => t.id === "wood");
  must(wood && wood.free === true && wood.owned === true, "the wood is everybody's");
  for (const t of all) {
    if (t.free) continue;
    must(t.owned === false, `a paid theme must start locked, ${t.id} did not`);
  }
  must((await theme(A.token, "dark")).owned === false, "dark mode starts locked");
}

// 2. a locked theme with nothing on the shelves quotes no price
{
  const dark = await theme(A.token, "dark");
  must(dark.price === null, "a theme that is not in the shop must not quote a price");
}

// 3. tung puts it in the shop
const item = await post("/admin/shop/set", {
  key: ADMIN, name: "Dark Mode skin", desc: "the wood, after hours", price: 40, active: true, theme: "dark",
});
must(item.body?.ok === true, "could not shelve the theme: " + JSON.stringify(item.body));
const itemId = item.body.item.id;
{
  const dark = await theme(A.token, "dark");
  must(dark.owned === false, "shelving a theme must not give it to anybody");
  must(dark.price === 40, `the price must come from the shop, got ${dark.price}`);
  // and the buyer's shop list says what it unlocks
  const list = (await j("/shop/list?token=" + encodeURIComponent(A.token))).body.items || [];
  const row = list.find((i: { id: string }) => i.id === itemId);
  must(!!row && row.theme === "dark" && row.themeName === "Dark Mode", "the shop row must name the skin it unlocks");
  must(row.owned === false, "not owned yet");
}

// 4. only the theme registry may be sold
{
  const bogus = await post("/admin/shop/set", { key: ADMIN, name: "x", price: 1, theme: "not-a-theme" });
  must(bogus.status === 400, "an item cannot grant a theme that does not exist");
  const freebie = await post("/admin/shop/set", { key: ADMIN, name: "y", price: 1, theme: "wood" });
  must(freebie.status === 400, "selling a theme everybody already has must be refused");
  must((await post("/admin/shop/set", { name: "z", price: 1, theme: "dark" })).status === 403,
    "shelving a theme needs the admin key");
}

// 5. buying it unlocks it — for the buyer, and for nobody else
{
  const before = await bal(A.token);
  const buy = await post("/shop/redeem", { token: A.token, itemId });
  must(buy.body?.ok === true, "redeem failed: " + JSON.stringify(buy.body));
  must(buy.body.theme === "dark", "the reply should name the skin it granted");
  must((await bal(A.token)) === money(before - 40), "the price must actually be charged");
  must((await theme(A.token, "dark")).owned === true, "the buyer owns it now");
  must((await theme(B.token, "dark")).owned === false,
    "ownership is per member — buying it must not unlock it for the whole shrine");
}

// 6. and it cannot be bought twice
{
  const before = await bal(A.token);
  const again = await post("/shop/redeem", { token: A.token, itemId });
  must(again.status === 409 && again.body?.error === "already owned",
    "buying a skin you already wear must be refused, got " + JSON.stringify(again.body));
  must((await bal(A.token)) === before, "a refused re-purchase must not charge anything");
  const list = (await j("/shop/list?token=" + encodeURIComponent(A.token))).body.items || [];
  must(list.find((i: { id: string }) => i.id === itemId).owned === true,
    "the shop must show it as already owned");
}

// 7. you cannot buy what you cannot afford, and a poor member stays locked
{
  const C = await member("thC", 5);
  const broke = await post("/shop/redeem", { token: C.token, itemId });
  must(broke.body?.error === "insufficient", "a skin beyond your balance must be refused");
  must((await bal(C.token)) === 5, "a refused purchase must not move the balance");
  must((await theme(C.token, "dark")).owned === false, "and must not unlock anything");
}

// 8. taking it off the shelves does not repossess it
{
  must(!!(await post("/admin/shop/set", {
    key: ADMIN, id: itemId, name: "Dark Mode skin", price: 40, active: false, theme: "dark",
  })).body?.ok, "could not hide the item");
  must((await theme(A.token, "dark")).owned === true, "a bought skin stays bought");
  const bDark = await theme(B.token, "dark");
  must(bDark.owned === false && bDark.price === null,
    "with nothing on the shelves it is locked again with no price for everyone else");
}

// 9. the endpoint is members-only
{
  must((await j("/themes")).status === 401, "anonymous callers get nothing");
  must((await j("/themes?token=garbage")).status === 401, "a bad key gets nothing");
}

console.log(
  "themes: locked by default and per member — only the wood is free, a skin is quoted only while it is " +
    "on the shelves, buying charges once and unlocks for the buyer alone, re-buying is refused, and " +
    "unshelving does not repossess",
);
