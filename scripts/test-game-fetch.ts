#!/usr/bin/env -S deno run --allow-read
// Launching a game without framing it.
//
// A catalog title used to be an <iframe> pointed at the game's URL. Networks
// that refuse to frame things then refuse the whole catalog, and a refused
// frame is a black rectangle with no error to catch — so the game is fetched
// and written into the tab as the whole document instead. Same bytes, same
// origin rules, but it arrives as an ordinary page load.
//
// Two things have to hold for that to work, and they are what this checks.
//
//   The whole document is written, not injected into a container. Half these
//   games call document.write while they load, and the Unity and Godot
//   loaders read location and document.baseURI. Given the whole document they
//   behave as if you had navigated to them; given a container they do not.
//
//   Relative assets still resolve. A game written into about:blank would
//   otherwise look for index.js next to the SHRINE. The 777 gn-math stubs
//   carry an absolute <base> of their own and must keep it; the ~53 that are
//   folders of relative files need one injected.
//
//   deno run --allow-read scripts/test-game-fetch.ts

import { SHRINE_FILES, readShrineFile } from "./shrine-sources.ts";

function must(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

// ---------------------------------------------------------------------------
// build the client the shrine window actually runs
const sources = await Promise.all(SHRINE_FILES.map(readShrineFile));
const store: Record<string, string> = {};
// deno-lint-ignore no-explicit-any
const win: any = {};
win.window = win;
win.localStorage = {
  getItem: (k: string) => (k in store ? store[k] : null),
  setItem: (k: string, v: string) => { store[k] = String(v); },
  removeItem: (k: string) => { delete store[k]; },
};
win.document = { write() {}, open() {}, close() {} };
const href = "https://kanyewest50000.github.io/offline-learning/index.html";
const u = new URL(href);
const loc = {
  href, search: "", hash: "", origin: u.origin, protocol: u.protocol,
  host: u.host, hostname: u.hostname, port: u.port, pathname: u.pathname,
};
new Function("window", "location", "localStorage", "document", sources.join("\n;\n"))(
  win, loc, win.localStorage, win.document,
);
const js = String(win.Shrine.CHAT_JS || "");
must(js.length > 0, "no chat client was emitted");

// ---------------------------------------------------------------------------
// a game is fetched, and the tab gets the whole document
must(/fetch\(url,\{credentials:"omit"\}\)/.test(js), "openPlay must fetch the game");
must(/w\.document\.open\(\);w\.document\.write\(withBase\(html,url\)\);w\.document\.close\(\)/.test(js),
  "the fetched game must be written as the WHOLE document, not injected into a container");
// the fallback is still there for when the fetch is what cannot get through
must(/function playFrame\(/.test(js), "the iframe fallback must still exist");
must(/\.catch\(function\(\)\{if\(!w\.closed\)playFrame\(/.test(js),
  "a failed fetch must fall back to the frame rather than leaving a blank tab");
// and nothing frames a game on the way in
const openPlay = js.slice(js.indexOf("function openPlay("), js.indexOf("function buildCatalog("));
must(!/iframe/i.test(openPlay), "openPlay must not create an iframe: " + openPlay.slice(0, 120));
// Tung's own three went through an in-page frame and must not any more
must(/function openOriginal\(g\)\{openPlay\(g\);\}/.test(js),
  "the originals must open the same way as the rest of the catalog");

// ---------------------------------------------------------------------------
// lift the two helpers out of the client and run them for real
function grab(name: string): string {
  const i = js.indexOf("function " + name + "(");
  must(i >= 0, "could not find " + name + " in the emitted client");
  let depth = 0;
  for (let k = js.indexOf("{", i); k < js.length; k++) {
    if (js[k] === "{") depth++;
    else if (js[k] === "}") { depth--; if (!depth) return js.slice(i, k + 1); }
  }
  throw new Error(name + " is not closed");
}
const helpers = new Function(
  grab("gameDir") + ";" + grab("withBase") + ";return {gameDir:gameDir,withBase:withBase};",
)() as { gameDir: (u: string) => string; withBase: (h: string, u: string) => string };

must(helpers.gameDir("https://x.test/games/kye/Dino/index.html") === "https://x.test/games/kye/Dino/",
  "gameDir must give the folder the game lives in");
must(helpers.gameDir("https://x.test/g/0.html?v=2#frag") === "https://x.test/g/",
  "a query or a fragment is not part of the folder");

// a stub that already points somewhere keeps pointing there
const stub = '<html><head><base href="https://cdn.example/a/"><title>x</title></head><body></body></html>';
must(helpers.withBase(stub, "https://x.test/g/0.html") === stub,
  "a game with its own base must be left alone — that base is where its wasm lives");

// a folder game gets its own folder, before anything that would use it
const rel = '<html><head><title>Dino</title></head><body><script src="index.js"></script></body></html>';
const out = helpers.withBase(rel, "https://x.test/games/kye/Dino/index.html");
must(/<base href="https:\/\/x\.test\/games\/kye\/Dino\/">/.test(out),
  "a relative game must be given its own folder as the base: " + out.slice(0, 120));
must(out.indexOf("<base") < out.indexOf("index.js"),
  "the base must come before the first thing that resolves against it");

// and the awkward shapes still get one
must(/<head><base href="https:\/\/x\.test\/g\/">/.test(
  helpers.withBase('<html><body><img src="a.png"></body></html>', "https://x.test/g/0.html"),
), "a document with no head must be given one");
must(helpers.withBase('<div><img src="a.png"></div>', "https://x.test/g/0.html")
  .indexOf('<base href="https://x.test/g/">') === 0,
  "a bare fragment must get the base in front of it");

console.log(
  "game fetch: a title is fetched and written into its tab as the whole document rather than framed — " +
    "the stubs keep the absolute base their assets live under, a folder game is given its own, and a " +
    "fetch that cannot get through still falls back to the frame",
);
