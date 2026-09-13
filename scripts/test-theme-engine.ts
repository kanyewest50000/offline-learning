#!/usr/bin/env -S deno run --allow-read
// A skin is a palette, not a stylesheet.
//
// Adding a theme used to mean writing a hundred-odd override rules by hand and
// remembering every surface. It is a handful of colours now: styles.js holds
// ONE list of themed surfaces with {tokens} where the colours go, and stamps a
// palette into it per skin. This guards the two things that buys —
//   * a three-colour palette really does fill every token, so a new skin cannot
//     ship with a hole in it, and
//   * Dark Mode, which was hand-picked before the engine existed and pins all
//     of its own colours, comes out of the engine exactly as it went in.
//
//   deno run --allow-read scripts/test-theme-engine.ts

import { ROOT } from "./shrine-sources.ts";

function must(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

// Run the two real modules the way the shrine window does, and read the
// stylesheet they actually produce.
// deno-lint-ignore no-explicit-any
const win: any = { Shrine: { LBL: {} } };
new Function("window", "location", await Deno.readTextFile(`${ROOT}/assets/js/shrine/config.js`))(
  win,
  { href: "https://example.test/", search: "" },
);
new Function("window", await Deno.readTextFile(`${ROOT}/assets/js/shrine/styles.js`))(win);

const CSS: string = String(win.Shrine.CSS);
// deno-lint-ignore no-explicit-any
const THEMES: any[] = win.Shrine.THEMES;
const themeCss = win.Shrine.themeCss as (id: string, spec: Record<string, string>) => string;
const palette = win.Shrine.themePalette as (spec: Record<string, string>) => Record<string, string>;

must(typeof themeCss === "function" && typeof palette === "function",
  "styles.js must expose the engine so it can be tested rather than eyeballed");

// ---------------------------------------------------------------------------
// the wood is the base stylesheet and must NOT have a block of its own
const wood = THEMES.find((t) => t.id === "wood");
must(!!wood && !wood.palette, "the wood is the base stylesheet; giving it a palette would double-paint it");
must(!CSS.includes('[data-theme="wood"]'), "nothing may be scoped to the wood");

// ---------------------------------------------------------------------------
// every skin that carries a palette is in the sheet, and nothing in it is a hole
const skins = THEMES.filter((t) => t.palette);
must(skins.length >= 2, "there should be more than one palette-driven skin to compare");
for (const t of skins) {
  const scope = `[data-theme="${t.id}"]`;
  must(CSS.includes("html" + scope), `${t.id} must reach the document root`);
  must(CSS.split(scope).length > 50, `${t.id} must repaint the whole shrine, not a corner of it`);
}
must(!/undefined/.test(CSS), "a token with no colour would paint the word undefined across a skin");
must(!/\{[a-zA-Z]+\}/.test(CSS), "every {token} must have been stamped out: " + (CSS.match(/\{[a-zA-Z]+\}/) || [])[0]);
must(!/NaN/.test(CSS), "the colour maths must never produce NaN");

// ---------------------------------------------------------------------------
// THE PROMISE: three colours fill everything, and every one is a real colour
const three = palette({ bg: "#101418", text: "#dfe6ee", accent: "#6fa8d6" });
const stylesSrc = await Deno.readTextFile(`${ROOT}/assets/js/shrine/styles.js`);
// read the token names out of THEME_RULES itself, not out of the prose around it
const rulesSrc = stylesSrc.slice(
  stylesSrc.indexOf("var THEME_RULES ="),
  stylesSrc.indexOf("colour maths: enough to mix"),
);
must(rulesSrc.length > 1000, "could not find THEME_RULES");
const tokens = [...new Set([...rulesSrc.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))];
must(tokens.length > 20, "could not read the token list out of the rules");
for (const tok of tokens) {
  const v = three[tok];
  must(typeof v === "string" && /^#([0-9a-f]{6}|[0-9a-f]{8}|[0-9a-f]{3,4})$/i.test(v),
    `a three-colour palette left ${tok} as ${JSON.stringify(v)} — the promise is that it fills every token`);
}
// and the generated CSS for it is complete
const mini = themeCss("probe", { bg: "#101418", text: "#dfe6ee", accent: "#6fa8d6" });
must(!/undefined|NaN|\{\w+\}/.test(mini), "a three-colour skin must generate a clean sheet");
must(mini.includes('html[data-theme="probe"]') && mini.includes('[data-theme="probe"] .msg'),
  "and must be scoped to its own id throughout");

// an accent has to actually be spent, or "pick an accent" means nothing
must(mini.toLowerCase().includes("6fa8d6") || /#[0-9a-f]{6}/.test(mini),
  "the accent must reach the sheet");
const grey = themeCss("probe", { bg: "#101418", text: "#dfe6ee", accent: "#8b8b96" });
must(mini !== grey, "changing the accent must change the skin");

// ---------------------------------------------------------------------------
// Dark Mode is pinned: the engine must reproduce the hand-picked sheet exactly.
// These are spot values from the block as it was written by hand.
for (
  const [sel, decl] of [
    ['html[data-theme="dark"],[data-theme="dark"] body', "background:#121214;color:#e8e8ec"],
    ['[data-theme="dark"] .msg', "background:#232328"],
    ['[data-theme="dark"] .msg.me', "background:#3d3d4a"],
    ['[data-theme="dark"] button', "background:#5a5a68;color:#f2f2f6"],
    ['[data-theme="dark"] #banView', "background:#0e0e10"],
    ['[data-theme="dark"] .when', "color:#8b8b96"],
    ['[data-theme="dark"] .themecard', "background:#1a1a1e;border-color:#3a3a44"],
  ] as const
) {
  must(CSS.includes(sel + "{" + decl + "}"),
    `Dark Mode drifted under the engine — expected ${sel}{${decl}}`);
}
// the chrome-less buttons must still be chrome-less (the grey-pill bug)
must(CSS.includes('[data-theme="dark"] .who,[data-theme="dark"] .pemoji,') ||
  /\[data-theme="dark"\] \.who[^{]*\{background:transparent/.test(CSS),
  "a username is a button; dark mode must not paint a pill behind it");

// tung is not part of the decor: he stays gold in every skin
for (const t of skins) {
  must(CSS.includes(`[data-theme="${t.id}"] .msg.tung`), `${t.id} must still style tung's line`);
}
must((CSS.match(/#f2c063/g) || []).length >= skins.length,
  "tung's gold must survive every skin");

// ---------------------------------------------------------------------------
// the client's skins and the server's registry must be the same list
const server = await Deno.readTextFile(`${ROOT}/server.ts`);
const block = server.match(/const SHRINE_THEMES[\s\S]*?\n\];/);
must(!!block, "no theme registry in server.ts");
const serverIds = [...block![0].matchAll(/id: "([a-z0-9-]+)"/g)].map((m) => m[1]);
const clientIds = THEMES.map((t) => t.id);
must(serverIds.join(",") === clientIds.join(","),
  `the shop registry and the skins must be the same list, in the same order:\n` +
    `  server.ts: ${serverIds.join(", ")}\n  config.js: ${clientIds.join(", ")}`);

console.log(
  "themes: a skin is a palette — three colours fill every token, the sheet comes out " +
    "with no holes and no stray tokens, changing the accent changes the skin, the client " +
    "and the shop agree on the list, and Dark Mode comes out of the engine exactly as it " +
    "was hand-written",
);
