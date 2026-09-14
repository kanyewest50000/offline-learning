#!/usr/bin/env -S deno run --allow-read
// The last gem on a mines board is an auto-cashout. That used to skip the
// readout, so current / next / found / left stayed on the pick before.
//
//   deno run --allow-read scripts/test-mines-panel.ts

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const src = await Deno.readTextFile(`${ROOT}/assets/js/shrine/casino.js`);

function must(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const pick = src.match(/function pick\(idx,c\)\{[\s\S]*?function enableHidden|function pick\(idx,c\)\{[\s\S]*?start\.onclick/);
must(!!pick, "mines pick() not found");
const body = pick![0];
const panel = body.indexOf("setPanel(");
const clear = body.indexOf('d.state==="cashout"');
must(panel >= 0, "pick() never writes the panel");
must(clear >= 0, "pick() never handles a cleared board");
must(panel < clear, "the last gem must write the panel before the cashout return");
must(
  /setPanel\(mult\(d\.multiplier\),d\.nextMultiplier!=null\?mult\(d\.nextMultiplier\):"—",\(d\.revealed\|\|\[\]\)\.length\)/.test(body),
  "a clear has no next tile; found/left come from the revealed list",
);

console.log("PASS mines last gem writes current / next / found / left");
