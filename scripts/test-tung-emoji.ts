#!/usr/bin/env -S deno run --allow-read
// :tung: is the cricket bat. Three bats then :sahur: summons the god portrait.

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");

function must(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const index = await Deno.readTextFile(`${ROOT}/index.html`);
const embed = await Deno.readTextFile(`${ROOT}/embed/chat.html`);

must(index.includes('"tung":"🏏"'), "shrine chat must map :tung: to the bat");
must(embed.includes('"tung":"🏏"'), "embed chat must map :tung: to the bat");
must(index.includes("function makeGodCombo()"), "shrine chat must embed tung tung god");
must(embed.includes("function makeGodCombo()"), "embed chat must embed tung tung god");
must(index.includes(":tung:\\\\s*:tung:\\\\s*:tung:\\\\s*:sahur:"), "shrine combo is :tung: x3 then :sahur:");
must(embed.includes(":tung:\\s*:tung:\\s*:tung:\\s*:sahur:"), "embed combo is :tung: x3 then :sahur:");
must(index.includes("i.src=TUNGGOD_IMG"), "shrine god embed uses the injected god portrait");
must(embed.includes("assets/tungtunggod.png"), "embed god embed points at tungtunggod.png");
must(index.includes(".embed.god{max-height:min(70vh,560px)}"), "god portrait is larger than the sahur combo");
must(embed.includes(".embed.god{max-height:min(70vh,560px)}"), "embed god portrait is larger than the sahur combo");
must(index.includes(":tongue:\\\\s*:tongue:\\\\s*:tongue:\\\\s*:sahur:"), "the old tongue combo must still fire");

const god = await Deno.stat(`${ROOT}/assets/tungtunggod.png`);
must(god.isFile && god.size > 1000, "tungtunggod.png must ship with the repo");

console.log("tung emoji and god-combo checks passed");
