#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read
// The admin key must never travel in a URL.
//
// A query string is the worst place to put a secret: it lands in the address
// bar, in browser history, in a bookmark, in every access log the request
// passes through, and in the Referer of anything the page goes on to load. The
// panel used to be reached at /admin?key=..., which put it in all of them at
// once, and then polled seven more endpoints with it in the query string.
//
// It rides a header now. The query parameter is still ACCEPTED, because the
// scripts in this folder pass it that way from a terminal where none of those
// exposures apply — but nothing the browser does may use it.
//
//   ADMIN_KEY=devadminkey deno run --allow-net --allow-env --unstable-kv server.ts
//   ADMIN_KEY=devadminkey API=... deno run --allow-net --allow-env --allow-read scripts/test-admin-key-privacy.ts

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const API = (Deno.env.get("API") || "http://127.0.0.1:8000").replace(/\/$/, "");
const ADMIN = Deno.env.get("ADMIN_KEY") || "devadminkey";

function must(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

// ---------------------------------------------------------------------------
// the door never hands the panel to a GET, however the key is presented
const gate = await fetch(API + "/admin");
const gateHtml = await gate.text();
must(gate.status === 200, "the door must open to anyone: " + gate.status);
must(!gateHtml.includes("pane-users"), "a GET must never return the panel");
must(gateHtml.length < 900, "the door is an egress guard; it must stay small: " + gateHtml.length);
must(!gateHtml.includes(ADMIN), "and must not contain the key it is asking for");

// an old bookmark with the key on it is sent to the bare path rather than served
const booked = await fetch(API + "/admin?key=" + encodeURIComponent(ADMIN), { redirect: "manual" });
must(booked.status === 303, "a keyed /admin must redirect, not serve: " + booked.status);
must(booked.headers.get("location") === "/admin",
  "and must land on the bare path so the bar is clean from then on: " + booked.headers.get("location"));
const bookedBody = await booked.text();
must(!bookedBody.includes("pane-users"), "and must not smuggle the panel into the redirect body");

// the panel comes back from a POST, where the key is in a body
const panel = await fetch(API + "/admin", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ key: ADMIN }),
});
const panelHtml = await panel.text();
must(panel.status === 200, "the right key must open the panel: " + panel.status);
must(panelHtml.includes("pane-users"), "and that must actually be the panel");
const wrong = await fetch(API + "/admin", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ key: ADMIN + "x" }),
});
must(wrong.status === 403, "a wrong key must be refused: " + wrong.status);
must(!(await wrong.text()).includes("pane-users"), "and told nothing");

// ---------------------------------------------------------------------------
// the panel it hands over has to actually run
//
// It is ONE inline script, so a syntax error anywhere in it is a syntax error
// everywhere: the shell renders, the key box sits there, the panes keep their
// placeholder text and not one button does anything. Nothing else here would
// notice — every check in this file is about an HTTP response, and a page that
// throws on parse still answers 200 with the right markup in it.
//
// It has happened: ADMIN_HTML is a template literal, so a `\n` written into a
// confirm() string is a REAL newline by the time it reaches the browser, and a
// real newline inside a JS string literal ends the script. It has to be `\\n`.
// Parsing it is the whole test; `new Function` compiles without running.
{
  const script = panelHtml.match(/<script>([\s\S]*)<\/script>/);
  must(!!script, "the panel must ship its script");
  try {
    new Function(script![1]);
  } catch (e) {
    throw new Error(
      "the panel's script does not parse, so nothing on the page works: " +
        (e instanceof Error ? e.message : String(e)) +
        " \u2014 look for a lone \\n in a string inside the ADMIN_HTML template literal",
    );
  }
  // and the key the door just proved must be the key the panel uses. A key
  // remembered from last time only ever fills an EMPTY box: overwriting the
  // one the gate handed over meant every pane came back "forbidden" on a key
  // the door had just accepted, and the panel then wrote the stale one
  // straight back to localStorage.
  const remember = panelHtml.indexOf('localStorage.getItem("shrine-admin-key")');
  must(remember > 0, "the panel still remembers a key between visits");
  must(/if\(!keyEl\.value\)\{var qk=/.test(panelHtml),
    "a remembered key must not overwrite the one the gate handed over");
  must(panelHtml.indexOf("window.__ADMIN_KEY") < remember,
    "the gate's handover has to happen before anything else touches the box");
}

// ---------------------------------------------------------------------------
// every admin read takes the header, and still takes the query for the scripts
for (const route of ["/admin/pending", "/admin/users", "/admin/balances", "/admin/chat", "/admin/veil", "/admin/shop", "/admin/themes"]) {
  const viaHeader = await fetch(API + route, { headers: { "x-admin-key": ADMIN } });
  must(viaHeader.status === 200, route + " must accept the key in a header: " + viaHeader.status);
  const viaQuery = await fetch(API + route + "?key=" + encodeURIComponent(ADMIN));
  must(viaQuery.status === 200, route + " must still accept it in the query, for the scripts");
  const none = await fetch(API + route);
  must(none.status === 403, route + " must refuse with no key at all: " + none.status);
  const bad = await fetch(API + route, { headers: { "x-admin-key": ADMIN + "x" } });
  must(bad.status === 403, route + " must refuse a wrong header key: " + bad.status);
}
// the header must also lift the anonymous rate limit, or the panel polls into it
must((await fetch(API + "/admin/users", { headers: { "x-admin-key": ADMIN } })).status === 200,
  "a header-authed request must be treated as authenticated");
// and a preflight has to allow the header, or a browser would never send it
const pre = await fetch(API + "/admin/users", { method: "OPTIONS" });
must((pre.headers.get("access-control-allow-headers") || "").includes("x-admin-key"),
  "the preflight must allow the header: " + pre.headers.get("access-control-allow-headers"));

// ---------------------------------------------------------------------------
// source: nothing the PANEL does may put the key in a URL
const src = await Deno.readTextFile(`${ROOT}/server.ts`);
const panelStart = src.indexOf("const ADMIN_HTML");
must(panelStart > 0, "could not find the panel");
const panelSrc = src.slice(panelStart);
must(!/fetch\("\/admin\/[a-z/]*\?key="/.test(panelSrc),
  "the panel must not put the key in a query string: " +
    (panelSrc.match(/fetch\("\/admin\/[a-z/]*\?key="/) || [])[0]);
must(!/location\s*=\s*"\/admin\?key/.test(src), "nothing may navigate to a keyed /admin");
must(/function aget\(path\)\{[\s\S]*?"x-admin-key":keyEl\.value\.trim\(\)/.test(panelSrc),
  "the panel's reads must go through one helper that sets the header");
// every read in the panel goes through it. Writes are left alone on purpose:
// they carry the key in a request body, which is not a URL and not logged.
for (const route of ["/admin/pending", "/admin/users", "/admin/balances", "/admin/chat", "/admin/veil", "/admin/shop", "/admin/themes"]) {
  must(panelSrc.includes(`aget("${route}")`), route + " must be read through the header helper");
}
must(!/fetch\("\/admin[a-z/]*\?/.test(panelSrc),
  "no request the panel makes may carry a query string at all: " +
    (panelSrc.match(/fetch\("\/admin[a-z/]*\?[^"]*"/) || [])[0]);

// and the gate hands the key over in memory, not on the address bar
must(/window\.__ADMIN_KEY=k;document\.open\(\);document\.write\(h\);document\.close\(\)/.test(src),
  "the gate must write the panel into the page it is on, not navigate to it");
must(/try\{delete window\.__ADMIN_KEY;\}catch\(e\)\{window\.__ADMIN_KEY=null;\}/.test(src),
  "and the panel must take it off the window once it has it");

console.log(
  "admin key: a GET never yields the panel and an old keyed bookmark is redirected to the " +
    "bare path; the panel arrives from a POST and every one of its reads carries the key in a " +
    "header, so it reaches no address bar, no history entry and no access log — while the " +
    "query parameter still works from a terminal. The panel it hands over parses, and the key " +
    "the door just proved is the one it uses",
);
