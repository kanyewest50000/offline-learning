#!/usr/bin/env node
"use strict";
const fs = require("fs");
const path = require("path");

// directory basenames considered useless import wrappers (edit freely).
// their CONTENTS get hoisted into the parent; real game folders + category
// folders (kye, tools, emulators, Flash, Cookie...) are NOT listed, so survive.
const WRAPPERS = new Set(["FSM_stuff", "VexGames", "gnmath", "goodnightmath", "games"]);

const ROOT = process.cwd();
const GAMES_DIR = path.join(ROOT, "games");
const INDEX = path.join(ROOT, "index.html");
const APPLY = process.argv.includes("--apply");
if (!fs.existsSync(GAMES_DIR)) { console.error("!! no games/ here — cd to repo root."); process.exit(1); }
if (!fs.existsSync(INDEX)) { console.error("!! no index.html here."); process.exit(1); }

function walkDirs(dir, depth, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory() || e.name === ".git") continue;
    const p = path.join(dir, e.name);
    out.push({ p, name: e.name, depth });
    walkDirs(p, depth + 1, out);
  }
}
const allDirs = []; walkDirs(GAMES_DIR, 0, allDirs);
const wrapperDirs = allDirs.filter(d => WRAPPERS.has(d.name)).sort((a, b) => b.depth - a.depth);

const PREFIX = "https://kanyewest50000.github.io/offline-learning/games/";
const cleanUrl = u => !u.startsWith(PREFIX) ? u :
  PREFIX + u.slice(PREFIX.length).split("/").map(decodeURIComponent).filter(s => !WRAPPERS.has(s)).map(encodeURIComponent).join("/");
const urlToRepoPath = u => !u.startsWith(PREFIX) ? null : path.join("games", ...u.slice(PREFIX.length).split("/").map(decodeURIComponent));

let html = fs.readFileSync(INDEX, "utf8");
const m = html.match(/var GAMES = (\[[\s\S]*?\]);/);
if (!m) { console.error("!! couldn't find `var GAMES = [...];` in index.html"); process.exit(1); }
let games; try { games = JSON.parse(m[1]); } catch (e) { console.error("!! GAMES isn't valid JSON:", e.message); process.exit(1); }

const collisions = []; let movedCount = 0;
for (const w of wrapperDirs) {
  if (!fs.existsSync(w.p)) continue;
  const parent = path.dirname(w.p);
  for (const child of fs.readdirSync(w.p)) {
    const src = path.join(w.p, child), dst = path.join(parent, child);
    if (fs.existsSync(dst)) { collisions.push({ src, dst }); continue; }
    if (APPLY) fs.renameSync(src, dst);
    movedCount++;
  }
  if (APPLY && fs.existsSync(w.p) && fs.readdirSync(w.p).length === 0) fs.rmdirSync(w.p);
}

let changed = 0, kept = 0, missing = 0;
const newGames = games.map(g => {
  const cleaned = cleanUrl(g.u);
  if (cleaned === g.u) { kept++; return g; }
  if (APPLY) {
    const np = urlToRepoPath(cleaned);
    if (np && fs.existsSync(np)) { changed++; return { n: g.n, u: cleaned }; }
    const op = urlToRepoPath(g.u); if (!op || !fs.existsSync(op)) missing++;
    kept++; return g;
  }
  changed++; return { n: g.n, u: cleaned };
});
if (APPLY) {
  fs.copyFileSync(INDEX, INDEX + ".bak");
  fs.writeFileSync(INDEX, html.replace(/var GAMES = \[[\s\S]*?\];/, "var GAMES = " + JSON.stringify(newGames) + ";"));
}

console.log("wrappers:", [...WRAPPERS].join(", "));
console.log("file moves:", movedCount, APPLY ? "(applied)" : "(dry-run)");
console.log("menu urls -> changed:", changed, "| unchanged:", kept, "| missing-after:", missing);
if (collisions.length) {
  console.log("\n!! " + collisions.length + " name clashes SKIPPED (left in place, not overwritten):");
  collisions.slice(0, 40).forEach(c => console.log("   " + path.relative(ROOT, c.src) + " -> " + path.relative(ROOT, c.dst)));
}
if (!APPLY) {
  console.log("\nrewrites preview:");
  newGames.forEach((g, i) => { if (g.u !== games[i].u) console.log("   " + games[i].u.slice(PREFIX.length) + "  ->  " + g.u.slice(PREFIX.length)); });
  console.log("\nDRY RUN — nothing changed. Re-run with --apply to move + rewrite.");
} else {
  console.log("\nApplied. Original menu backed up to index.html.bak");
}
