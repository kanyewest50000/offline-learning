#!/usr/bin/env -S deno run --allow-read
// Shop redeem used to call window.prompt / confirm. The altar overlay and the
// admin output box have to stay shrine-native, and casino stakes under/over
// the rails have to name the floor and the ceiling instead of "bad bet".

import { readShrine, ROOT, readShrineFile } from "./shrine-sources.ts";

function must(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

// the shop and the bet rails live in shrine/casino.js, the field widths in shrine/styles.js
const shrine = await readShrine();
const casinoModule = await readShrineFile("assets/js/shrine/casino.js");
const server = await Deno.readTextFile(`${ROOT}/server.ts`);

must(!shrine.includes("prompt(it.inputLabel)"), "shop redeem must not use the browser prompt");
must(!shrine.includes('confirm("Redeem '), "shop redeem must not use the browser confirm");
must(shrine.includes("function shopConfirm(it,buy)"), "shop redeem must open a pay overlay first");
must(shrine.includes("function shopCollect(p)"), "the question field must wait until after they have paid");
must(shrine.includes("function shopRedeem(it,buy,done)"), "shop redeem must run from the pay overlay");
must(shrine.includes("function shopLoad()"), "the shop must reload so an unfinished redeem stays on the shelf");
must(shrine.includes('title:"place it on the altar"'), "pay overlay title must be the altar line");
must(shrine.includes('title:"the shelves have you"'), "the question overlay must only open after a sale");
must(shrine.includes("tung does not do refunds. tung does not do sympathy."), "overlay must keep the deadpan refund line");
must(shrine.includes("you already paid. the question remains. walk away and it will still be waiting on the shelf."), "walking away after pay must admit the question is still owed");
must(shrine.includes("unfinished. you already paid. tung is still waiting."), "unfinished redemptions must stay visible on the shop");
must(shrine.includes('shopitem wait'), "owed answers must be a distinct unfinished card");
must(shrine.includes('"answer him"'), "the unfinished card must let them finish later");
must(shrine.includes("if(spec.onNo)spec.onNo()"), "walk away and the backdrop must keep the owed question");
must(shrine.includes("redeemId:p.id"), "the typed answer must name the unfinished redeem");
must(shrine.includes('placeholder="tung is listening"'), "overlay input must use the listening placeholder");
must(shrine.includes("so be it") && shrine.includes("walk away"), "overlay buttons must be so be it / walk away");
must(shrine.includes("tung asked a question. you stared back. try again."), "empty overlay answer must scold, not look like a form error");
must(shrine.includes("#tipAmt,#shopAsk{"), "shop overlay field must share the tip-box width rules");
must(shrine.includes('ov.id="shopOverlay"'), "overlay must be a named shrine dialog");
must(shrine.includes("if(spec.ask){"), "the input field must be gated on the after-pay overlay");
must(!shrine.includes("if(it.inputLabel){"), "the buy overlay must not grow an input just because the item has a question");

const marker = "var CASINO_JS = `";
const jsStart = casinoModule.indexOf(marker);
must(jsStart >= 0, "CASINO_JS template is missing");
const jsEnd = casinoModule.indexOf("\n`;\n", jsStart);
must(jsEnd > jsStart, "CASINO_JS close is missing");
const casinoJs = casinoModule.slice(jsStart + marker.length, jsEnd);
must(!casinoJs.includes("${"), "CASINO_JS is a template literal and cannot interpolate");
must(!casinoJs.includes("`"), "CASINO_JS cannot contain backticks");
must(casinoJs.includes("function shopCollect(p)"), "after-pay question overlay lives inside CASINO_JS");
must(casinoJs.includes("function shopLoad()"), "unfinished redemptions are painted from /shop/list");
must(casinoJs.includes("ask:\"\""), "the pay overlay must pass an empty ask so no field is created");
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
must(!server.includes('if (inputLabel && !input) return json({ error: "input required"'), "a missing answer must not block the sale");
must(server.includes('path === "/shop/tell"'), "typed answers land on /shop/tell after the sale");
must(server.includes('["shoppend", u.id, pending.id]'), "a pending question is stored only after they have paid");
must(server.includes("pending: await listShopPending(u.id)"), "the shop list must return unfinished redemptions");

must(server.includes("const FAUCET_INTERVAL = 2 * 60 * 60 * 1000"), "the shrine faucet is every 2 hours");
must(shrine.includes("free sahurs, on the house. every 2 hours."), "ready shrine copy must name the two-hour pour");
must(shrine.includes("tung already blessed you. he does not pour twice in two hours. sit."), "cooldown copy must not pretend the blessing lasts all day");
must(!shrine.includes("blessed you today"), "a two-hour faucet must not say tung blessed you today");

console.log("shop overlay, admin output CSS, and wager copy checks passed");
