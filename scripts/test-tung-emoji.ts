#!/usr/bin/env -S deno run --allow-read
// :tung: is the cricket bat. Three bats then :sahur: summons the god portrait.

import { readShrine, ROOT } from "./shrine-sources.ts";

function must(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

// the shortcode table lives in shrine/chat.js, the embed sizing in shrine/styles.js
const shrine = await readShrine();
const embed = await Deno.readTextFile(`${ROOT}/embed/chat.html`);

must(shrine.includes('"tung":"🏏"'), "shrine chat must map :tung: to the bat");
must(embed.includes('"tung":"🏏"'), "embed chat must map :tung: to the bat");
must(shrine.includes("function makeGodCombo()"), "shrine chat must embed tung tung god");
must(embed.includes("function makeGodCombo()"), "embed chat must embed tung tung god");
must(shrine.includes(":tung:\\\\s*:tung:\\\\s*:tung:\\\\s*:sahur:"), "shrine combo is :tung: x3 then :sahur:");
must(embed.includes(":tung:\\s*:tung:\\s*:tung:\\s*:sahur:"), "embed combo is :tung: x3 then :sahur:");
must(shrine.includes("i.src=TUNGGOD_IMG"), "shrine god embed uses the injected god portrait");
must(embed.includes("assets/tungtunggod.png"), "embed god embed points at tungtunggod.png");
must(shrine.includes(".embed.god{max-height:min(70vh,560px)}"), "god portrait is larger than an inline emoji");
must(embed.includes(".embed.god{max-height:min(70vh,560px)}"), "embed god portrait is larger than an inline emoji");
must(!shrine.includes(":tongue:\\\\s*:tongue:\\\\s*:tongue:\\\\s*:sahur:"), "the tongue combo must not embed a portrait");
must(!embed.includes(":tongue:\\s*:tongue:\\s*:tongue:\\s*:sahur:"), "embed must not keep the tongue combo");
must(!shrine.includes("function makeCombo()"), "shrine chat must not keep the old sahur combo helper");
must(!embed.includes("function makeCombo()"), "embed chat must not keep the old sahur combo helper");

const god = await Deno.stat(`${ROOT}/assets/tungtunggod.png`);
must(god.isFile && god.size > 1000, "tungtunggod.png must ship with the repo");

console.log("tung emoji and god-combo checks passed");
