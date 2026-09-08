#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run
// Drive the real blackjack client with a canned start reply and prove the
// four-card opening (you, hole, you, upcard) lands 400ms apart, and that the
// balance / result stay put until the hole has been turned over.

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const src = await Deno.readTextFile(`${ROOT}/index.html`);

function fail(msg: string): never {
  throw new Error(msg);
}

const jsStart = src.indexOf("var CASINO_JS = `");
const jsOpen = src.indexOf("\n", jsStart) + 1;
const jsEnd = src.indexOf("\n`;", jsOpen);
if (jsStart < 0 || jsEnd < 0) fail("CASINO_JS block missing");
const casinoJs = src.slice(jsOpen, jsEnd);

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>bj-live</title>
<style>
html,body{margin:0;background:#1d1206;color:#f5efe0;font-family:system-ui,sans-serif}
#casino{display:flex;flex-direction:column;min-height:100vh;position:relative}
#casbalwrap{padding:10px 14px;background:#2b1a0a;border-bottom:1px solid #3a2410;font-weight:700;color:#f2c063}
#casscreen{flex:1;padding:24px}
.caswrap{max-width:920px;margin:0 auto;display:flex;flex-direction:column;gap:18px}
.casmenu{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
.casgame{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;min-height:80px;padding:12px;background:#241505;border:1px solid #3a2410;border-radius:12px;color:#f5efe0;font-weight:700;cursor:pointer}
.casview{display:flex;flex-direction:column;gap:12px}
.casview h3{margin:0;color:#f2c063;display:flex;align-items:center;gap:8px}
.ctlrow{display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;background:#1d1206;border:1px solid #3a2410;border-radius:12px;padding:12px}
.ctl{display:flex;flex-direction:column;gap:4px}
.bjtable{display:flex;flex-direction:column;align-items:center;gap:8px}
.bjtable.bjdealing{pointer-events:none}
.bjlabel{font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#8a6a3a}
.bjval{font-size:30px;font-weight:800;color:#f2c063;line-height:1}
.bjcards{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;min-height:142px;align-items:center}
.bjsplit{width:100%;max-width:280px;height:1px;background:#3a2410;margin:4px 0}
.bjhands{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;width:100%}
.bjhand{display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px 10px}
.pcard{width:98px;height:138px;position:relative;flex:0 0 auto}
.pcinner{position:absolute;inset:0;animation:dealIn .5s cubic-bezier(.3,.8,.4,1) both}
.pcface{position:absolute;inset:0;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:34px;font-weight:800}
.pcfront{background:#f7f2e6;color:#1d1206;opacity:0;animation:faceIn .5s both}
.pcback{background:#241505;color:#7a5a1a;animation:faceOut .5s both}
.pcard.hole .pcinner{animation-name:dealBack}
.pcard.hole .pcback{animation:none;opacity:1}
.pcard.hole .pcfront{animation:none;opacity:0}
@keyframes dealIn{0%{opacity:0;transform:translateY(-20px)}100%{opacity:1;transform:translateY(0)}}
@keyframes dealBack{0%{opacity:0;transform:translateY(-20px)}100%{opacity:1;transform:translateY(0)}}
@keyframes faceIn{0%,49%{opacity:0}50%,100%{opacity:1}}
@keyframes faceOut{0%,49%{opacity:1}50%,100%{opacity:0}}
.bjacts{display:flex;gap:10px;justify-content:center;min-height:60px}
.bjbtn{min-width:88px;padding:10px 16px;border:none;border-radius:14px;font-weight:800;cursor:pointer;color:#fff;background:#b57420}
.bjres{text-align:center;font-size:16px;font-weight:800;min-height:24px}
.casback{align-self:flex-start;background:transparent;border:1px solid #3a2410;color:#c8823c;padding:6px 12px;border-radius:8px;cursor:pointer}
#winpop{position:absolute;left:50%;top:27%;transform:translate(-50%,-50%);z-index:40;opacity:0}
#winpop.show{opacity:1}
</style>
</head>
<body>
<div id="casino">
  <div id="casbalwrap"><span id="casbal">0.00</span> <b>sahurs</b></div>
  <div id="casscreen"></div>
</div>
<pre id="report">running</pre>
<script>
var SHRINE_API="http://127.0.0.1:8000";
var canned={
  ok:true,state:"done",
  hands:[{cards:["A♣","10♦"],value:21,bet:1,done:true,result:"blackjack",payout:2.5}],
  active:0,split:false,
  dealer:["K♠","A♥"],dealerValue:21,
  bet:1,payout:2.5,balance:101.5,result:"blackjack",
  canDouble:false,canSplit:false
};
var _fetch=window.fetch;
window.fetch=function(url,opt){
  var u=String(url);
  function ok(body){return Promise.resolve({json:function(){return Promise.resolve(body);}});}
  if(u.indexOf("/cas/me")>=0)return ok({username:"tester",balance:100,canClaim:false,nextClaim:0,faucetAmount:0,faucetInterval:0});
  if(u.indexOf("/cas/bj/start")>=0)return ok(canned);
  return _fetch.apply(this,arguments);
};
</script>
<script>
${casinoJs}
</script>
<script>
function snap(){
  var fronts=[].map.call(document.querySelectorAll(".pcfront"),function(e){return e.textContent;});
  var holes=document.querySelectorAll(".pcard.hole").length;
  var res=document.querySelector(".bjres");
  var pop=document.getElementById("winpop");
  return {
    cards:document.querySelectorAll(".pcard").length,
    holes:holes,
    fronts:fronts,
    bal:document.getElementById("casbal").textContent,
    res:res?res.textContent:"",
    toast:!!(pop&&pop.classList.contains("show"))
  };
}
function waitFor(fn,tries){
  return new Promise(function(resolve,reject){
    (function tick(n){
      try{var v=fn();if(v)return resolve(v);}catch(e){}
      if(n<=0)return reject(new Error("timeout"));
      setTimeout(function(){tick(n-1);},25);
    })(tries||200);
  });
}
(async function(){
  var log=[];
  window.__casinoOpen();
  var btn=await waitFor(function(){
    return [].filter.call(document.querySelectorAll(".casgame"),function(b){return /Blackjack/.test(b.textContent);})[0];
  });
  btn.click();
  var deal=await waitFor(function(){return document.querySelector(".bjbtn.deal");});
  var t0=Date.now();
  function rec(tag){var s=snap();s.t=Date.now()-t0;s.tag=tag;log.push(s);}
  rec("pre");
  deal.click();
  var marks=[50,200,600,1000,1400,1800,2200];
  for(var i=0;i<marks.length;i++){
    await new Promise(function(r){setTimeout(r,marks[i]-(i?marks[i-1]:0));});
    rec("t"+marks[i]);
  }
  document.getElementById("report").textContent=JSON.stringify({log:log});
  document.title="DONE";
})().catch(function(e){
  document.getElementById("report").textContent="FAIL "+e;
  document.title="FAIL";
});
</script>
</body>
</html>
`;

const out = "/tmp/bj-live.html";
await Deno.writeTextFile(out, html);

const chrome = "/usr/local/bin/google-chrome";
const proc = new Deno.Command(chrome, {
  args: [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--virtual-time-budget=12000",
    "--dump-dom",
    "file://" + out,
  ],
  stdout: "piped",
  stderr: "piped",
});
const result = await proc.output();
const dom = new TextDecoder().decode(result.stdout);
const err = new TextDecoder().decode(result.stderr);
const reportMatch = dom.match(/<pre id="report">([\s\S]*?)<\/pre>/);
if (!reportMatch) {
  console.error(err.slice(-2000));
  fail("live page did not write a report");
}
const raw = reportMatch[1].replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");
if (raw.startsWith("FAIL")) fail(raw);
const report = JSON.parse(raw);
const by = Object.fromEntries(report.log.map((s: { tag: string }) => [s.tag, s]));

function at(tag: string) {
  if (!by[tag]) fail("missing snapshot " + tag);
  return by[tag] as {
    cards: number;
    holes: number;
    fronts: string[];
    bal: string;
    res: string;
    toast: boolean;
  };
}

if (at("t50").cards !== 1) fail("first card should be down immediately, got " + at("t50").cards);
if (at("t200").cards !== 1) fail("second card must wait the 0.4s gap, still wanted 1 at 200ms, got " + at("t200").cards);
if (at("t600").cards !== 2) fail("hole should land around 400ms, got " + at("t600").cards + " cards");
if (at("t600").holes < 1) fail("the second card has to be the face-down hole");
if (at("t1000").cards !== 3) fail("second player card should land around 800ms, got " + at("t1000").cards);
if (at("t1400").cards !== 4) fail("upcard should land around 1200ms, got " + at("t1400").cards);
if (at("t50").bal !== "100.00" || at("t1400").bal !== "100.00") {
  fail("balance must stay at the pre-hand amount while cards are still coming");
}
if (at("t1400").res) fail("result line leaked before the hole flip: " + at("t1400").res);
if (at("t1400").toast) fail("win toast fired before the dealer finished");
if (at("t2200").bal !== "101.50") fail("balance should update only after the deal, got " + at("t2200").bal);
if (!/BLACKJACK/i.test(at("t2200").res)) fail("result should read BLACKJACK after the hole flip, got " + at("t2200").res);
if (at("t2200").holes !== 0) fail("hole must be face-up once the dealer is finished");

console.log("blackjack deal live: ok");
console.log(JSON.stringify(report.log.map((s: { tag: string; cards: number; holes: number; bal: string; res: string }) => s)));
