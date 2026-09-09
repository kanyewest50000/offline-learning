#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read
// Reaching the web veil takes two separate yeses: the global switch on /admin,
// and that member being on the veil whitelist (per-user, off by default). Miss
// either and the destination is never disclosed — the shut veil and the
// not-for-you veil are the same holding page with different words.
//
//   ADMIN_KEY=devadminkey PROXY_URL=https://example.invalid/hub \
//     deno run --allow-net --allow-env --unstable-kv server.ts
//   ADMIN_KEY=devadminkey PROXY_URL=https://example.invalid/hub API=... \
//     deno run --allow-net --allow-env --allow-read scripts/test-veil-toggle.ts

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const API = (Deno.env.get("API") || "http://127.0.0.1:8000").replace(/\/$/, "");
const ADMIN = Deno.env.get("ADMIN_KEY") || "devadminkey";
const URL_EXPECTED = Deno.env.get("PROXY_URL") || "";

function must(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}
async function j(path: string, opt?: RequestInit) {
  const r = await fetch(API + path, opt);
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
const post = (path: string, obj: unknown) =>
  j(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(obj) });

// the destination must not be sitting in the static repo any more
for (const f of ["assets/js/shrine/config.js", "assets/js/shrine/chat.js", "assets/js/shrine/markup.js"]) {
  const src = await Deno.readTextFile(`${ROOT}/${f}`);
  must(!/thecontrolhub|PROXY_URL\s*=\s*"http/.test(src), f + " still hard-codes a veil destination");
}
// the switch alone must never be enough: with no PROXY_URL configured, an
// admin who flips it on still leaves members on the holding page rather than
// opening a blank tab. (Verified live too; asserted here since this test runs
// against a server that does have PROXY_URL set.)
const server = await Deno.readTextFile(`${ROOT}/server.ts`);
must(
  /async function veilLive\(\)[^}]*if \(!PROXY_URL\) return false;/s.test(server),
  "veilLive must refuse to go live without a configured PROXY_URL",
);

// and the holding page must still be in the document, in both its wordings
const markup = await Deno.readTextFile(`${ROOT}/assets/js/shrine/markup.js`);
must(markup.includes('id="veil"') && markup.includes("Coming Soon"), "the Coming Soon veil page is missing");
must(markup.includes("the veil is thin. the path is not yet for you."), "the shut-veil copy changed");
const chat = await Deno.readTextFile(`${ROOT}/assets/js/shrine/chat.js`);
must(chat.includes("VEIL_DENIED"), "the not-for-you wording is missing");
must(chat.includes("The Gate Knows You"), "the denied page needs its own heading");
must(chat.includes("r.live&&r.allowed&&r.url"), "the client must require both the switch and the whitelist");

// The chat client is one long string built from many concatenated pieces, and a
// JS comment between two of them is NOT a statement boundary — it is easy to
// drop a helper inside the function that happens to straddle the seam, where it
// is invisible to every caller. So evaluate the module and check the emitted
// source really does declare these at the top level of the client IIFE.
const win: { Shrine: Record<string, any> } = {
  Shrine: { LBL: { POPUP: "p", ORIGINALS: "o", WEB_VEIL: "w" } },
};
new Function("window", "location", chat)(win, { href: "https://example.test/", search: "" });
const emitted = win.Shrine.CHAT_JS as string;
function depthAt(src: string, needle: string): number {
  const at = src.indexOf(needle);
  must(at >= 0, "emitted client is missing " + needle);
  let d = 0;
  for (let i = 0; i < at; i++) {
    if (src[i] === "{") d++;
    else if (src[i] === "}") d--;
  }
  return d;
}
// depth 1 == directly inside the client's own IIFE
for (const decl of ["function showVeil(", "var VEIL_SHUT=", "var VEIL_DENIED="]) {
  const d = depthAt(emitted, decl);
  must(d === 1, `${decl} is nested ${d} braces deep — it must sit at the top level of the client`);
}
must(!/function topShow\(v\)\{[^}]*showVeil/.test(emitted), "showVeil must not live inside topShow");

const stamp = Date.now().toString(36).slice(-6);
const name = "veil" + stamp;
const applied = await post("/apply", { username: name, application: "veil toggle test" });
const token = applied.body?.token as string;
must(!!token, "apply failed");

// a pending (unapproved) member gets nothing at all
const pendingPeek = await j("/veil?token=" + encodeURIComponent(token));
must(pendingPeek.status === 401, "an unapproved member must not read the veil state");

const pend = await j("/admin/pending?key=" + encodeURIComponent(ADMIN));
const id = (pend.body.pending || []).find((x: { username: string }) => x.username === name)?.id;
must(!!id, "not pending");
must(!!(await post("/admin/decide", { key: ADMIN, id, action: "approve" })).body?.ok, "approve failed");

// admin can read the switch, and PROXY_URL being set shows as `configured`
const seen = await j("/admin/veil?key=" + encodeURIComponent(ADMIN));
must(seen.status === 200, "admin cannot read the veil state");
must(seen.body.configured === true, "PROXY_URL must be set for this test — export it for both processes");

// no key, no switch
must((await j("/admin/veil?key=wrong")).status === 403, "a wrong key must not read the veil state");
must((await post("/admin/veil", { key: "wrong", live: true })).status === 403, "a wrong key must not flip the veil");

const peek = () => j("/veil?token=" + encodeURIComponent(token));
const setSwitch = (live: boolean) => post("/admin/veil", { key: ADMIN, live });
const setUser = (allowed: boolean) => post("/admin/veiluser", { key: ADMIN, id, allowed });

// a new member is off the whitelist until tung says otherwise
const fresh = (await j("/admin/users?key=" + encodeURIComponent(ADMIN))).body
  .users.find((u: { id: string }) => u.id === id);
must(fresh.veil === false, "veil access must be off by default for a new member");

// ---- switch off, not whitelisted ----
await setSwitch(false); await setUser(false);
let m = await peek();
must(m.body.live === false && m.body.allowed === false, "shut veil should read closed");
must(!("url" in m.body), "a closed veil must not disclose the destination");

// ---- switch off, whitelisted: still nothing ----
await setUser(true);
m = await peek();
must(m.body.live === false, "the whitelist must not open a veil the switch has shut");
must(!("url" in m.body), "a closed veil must not disclose the destination to a whitelisted member");

// ---- switch on, not whitelisted: the not-for-you page ----
await setSwitch(true); await setUser(false);
m = await peek();
must(m.body.live === true, "the switch is on, so live should read true");
must(m.body.allowed === false, "an unlisted member must not be allowed through");
must(!("url" in m.body), "an unlisted member must never receive the destination");

// ---- switch on, whitelisted: through ----
await setUser(true);
m = await peek();
must(m.body.live === true && m.body.allowed === true, "a whitelisted member should be allowed through");
must(m.body.url === URL_EXPECTED, `allowed member should get PROXY_URL, got ${JSON.stringify(m.body.url)}`);

// ---- revoking one member closes it for them alone ----
await setUser(false);
m = await peek();
must(m.body.allowed === false && !("url" in m.body), "revoking veil access did not take effect");

// only the admin key can move the whitelist
must((await post("/admin/veiluser", { key: "wrong", id, allowed: true })).status === 403,
  "a wrong key must not grant veil access");

await setSwitch(false);

// a stranger with no token never sees either
must((await j("/veil")).status === 401, "an anonymous visitor must not read the veil state");

console.log(
  "web veil: needs both the /admin switch and the per-user whitelist; url never " +
    "disclosed unless both are on; both holding-page wordings present",
);
