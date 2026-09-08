#!/usr/bin/env -S deno run --allow-read
// Shop redeem used to call window.prompt / confirm. The altar overlay and the
// admin output box have to stay shrine-native, and casino stakes under/over
// the rails have to name the floor and the ceiling instead of "bad bet".

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");

function must(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const index = await Deno.readTextFile(`${ROOT}/index.html`);
const server = await Deno.readTextFile(`${ROOT}/server.ts`);

must(!index.includes("prompt(it.inputLabel)"), "shop redeem must not use the browser prompt");
must(!index.includes('confirm("Redeem '), "shop redeem must not use the browser confirm");
must(index.includes("function shopAsk(it,go)"), "shop redeem must open an in-page overlay");
must(index.includes("function shopRedeem(it,buy,input)"), "shop redeem must stay in the overlay callback");
must(index.includes('el("h3",null,"place it on the altar")'), "overlay title must be the altar line");
must(index.includes("tung does not do refunds. tung does not do sympathy."), "overlay must keep the deadpan refund line");
must(index.includes('placeholder="tung is listening"'), "overlay input must use the listening placeholder");
must(index.includes("so be it") && index.includes("walk away"), "overlay buttons must be so be it / walk away");
must(index.includes("tung asked a question. you stared back. try again."), "empty overlay answer must scold, not look like a form error");
must(index.includes("#tipAmt,#shopAsk{"), "shop overlay field must share the tip-box width rules");
must(index.includes('ov.id="shopOverlay"'), "overlay must be a named shrine dialog");

const marker = "var CASINO_JS = `";
const jsStart = index.indexOf(marker);
must(jsStart >= 0, "CASINO_JS template is missing");
const jsEnd = index.indexOf("\n`;\n\n  function sahurChatDoc", jsStart);
must(jsEnd > jsStart, "CASINO_JS close is missing");
const casinoJs = index.slice(jsStart + marker.length, jsEnd);
must(!casinoJs.includes("${"), "CASINO_JS is a template literal and cannot interpolate");
must(!casinoJs.includes("`"), "CASINO_JS cannot contain backticks");
must(casinoJs.includes("function shopAsk(it,go)"), "shop overlay lives inside CASINO_JS");
new Function("SHRINE_API", casinoJs);

must(server.includes("input,textarea{flex:1;padding:10px 12px;border-radius:8px;border:1px solid #3a2410;background:#160d04;color:#f5efe0;font-size:14px;font-family:inherit;box-sizing:border-box}"), "admin fields must style input and textarea the same");
must(server.includes("textarea{min-height:72px;resize:vertical;width:100%}"), "admin textarea needs its own height, not the native widget look");
must(server.includes('var output=document.createElement("textarea");output.className="uname"'), "shop editor output stays a textarea");
must(!server.includes('output.style.cssText="resize:vertical;font-family:inherit"'), "output must not rely on a one-off inline style");

must(!server.includes('error: "bad bet"'), "casino routes must not return the old bad-bet string");
must(server.includes("that offering is beneath the altar."), "under-min bets must name the altar floor");
must(server.includes("even tung tung god has a ceiling."), "over-max bets must name the ceiling");
must(server.includes("tung does not wager ghosts. put a real number on the felt."), "non-numbers need the ghost line");
must(server.includes("function wagerError(") && server.includes("function readWager("), "bet copy is centralized");
must((server.match(/wagerError\(b\.bet\)/g) || []).length === 7, "every casino start path must surface wagerError");

console.log("shop overlay, admin output CSS, and wager copy checks passed");
