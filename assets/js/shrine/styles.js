/* ==========================================================================
   Shrine of Tung — window stylesheet
   The whole stylesheet for the about:blank shrine window, held as a string
   because that window is written with document.write and cannot reliably load
   a relative <link>. Covers every view: gate, chat, catalog, originals,
   casino tables, shop and the overlays.
   ========================================================================== */
(function () {
  "use strict";
  var Shrine = (window.Shrine = window.Shrine || {});

  Shrine.CSS =
      'html,body{margin:0;height:100%;font-family:system-ui,Segoe UI,Roboto,sans-serif;background:#1d1206;color:#f5efe0}' +
      'body{display:flex;flex-direction:column}' +
      'iframe{display:none}' +
      '#mainhdr{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 14px;background:#2b1a0a;border-bottom:1px solid #3a2410;font-weight:600}' +
      '#hdrShrine{display:flex;flex-direction:column;flex:1;min-width:0}' +
      '#hdrShrine small{font-weight:400;color:#c8823c;margin-top:2px}' +
      '#hdrCasino{display:none;align-items:center;gap:10px;flex:1;min-width:0;flex-wrap:wrap}' +
      '#hdrCasino .chtitle{display:flex;align-items:center;gap:6px;color:#f2c063;font-weight:800;white-space:nowrap}' +
      '.hbtn{padding:7px 12px;border-radius:9px;background:#241505;border:1px solid #7a5a1a;color:#f2c063;font-weight:700;cursor:pointer;white-space:nowrap;flex:0 0 auto;font-size:13px}' +
      '.hbtn:hover{background:#3a2410;border-color:#c8823c}' +
      '#gate{flex:1;display:none;align-items:center;justify-content:center;padding:24px;text-align:center;min-height:0}' +
      '#gate h2{margin:0 0 8px}' +
      '#gate p{margin:0 0 12px;color:#c8823c;font-size:14px}' +
      '#applyView,#pendingView{max-width:300px;width:100%}' +
      '#pendingView{display:none}' +
      '#applyForm{display:flex;flex-direction:column;gap:8px}' +
      '#ga{resize:vertical}' +
      '#myhash{display:inline-block;margin:2px 0 12px;padding:6px 10px;border-radius:6px;background:#160d04;border:1px solid #3a2410;font-family:monospace;color:#f2c063;word-break:break-all}' +
      '.hint{font-size:12px}' +
      '.warn{font-size:12px;color:#f2c063;margin:12px 0 0}' +
      '#appThread{display:flex;flex-direction:column;gap:6px;margin:14px 0 0;text-align:left}' +
      '#appThread .tmsg{padding:7px 11px;border-radius:10px;font-size:13px;max-width:90%;white-space:pre-wrap;word-break:break-word}' +
      '#appThread .tmsg.admin{align-self:flex-start;background:#241505;border:1px solid #3a2410}' +
      '#appThread .tmsg.me{align-self:flex-end;background:#c8823c;color:#1d1206}' +
      '#respBox{display:none;flex-direction:column;gap:8px;margin:12px 0 0}' +
      '#respText{resize:vertical}' +
      '#gate .row{display:flex;gap:8px;justify-content:center}' +
      '#chat{flex:1;display:none;flex-direction:column;min-height:0}' +
      '#banView{flex:1;display:none;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:8px;padding:24px;background:#160d04}' +
      '#banTitle{font-size:22px;font-weight:800}' +
      '#banUntil{color:#c8823c;font-size:14px}' +
      '#log{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:8px}' +
      '.msg{max-width:75%;padding:8px 12px;border-radius:12px;background:#2b1a0a;align-self:flex-start;word-wrap:break-word}' +
      '.msg.me{align-self:flex-end;background:#8a5a28}' +
      '.who{display:block;font-size:11px;color:#c8823c;margin-bottom:2px;background:transparent;border:0;padding:0;cursor:pointer;font-family:inherit;font-weight:600;text-align:left;line-height:1.2}' +
      '.who:hover{color:#f2c063;text-decoration:underline}' +
      '.msg.me .who{color:#f2c063}' +
      /* profile / tip / login-key overlays — shrine-native chrome, not marketing page */
      '.ov{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:#000a;z-index:50;padding:16px}' +
      '.ovcard{width:100%;max-width:320px;background:linear-gradient(160deg,#2e1c08,#1d1206);border:1px solid #7a5a1a;border-radius:14px;padding:16px;box-shadow:0 12px 40px #000a}' +
      '.ovcard h3{margin:0 0 6px;color:#f2c063;font-size:16px}' +
      '.ovcard .ovsub{margin:0 0 12px;font-size:12px;color:#c8823c;font-style:italic;line-height:1.45}' +
      '.ovrow{display:flex;justify-content:space-between;gap:8px;align-items:baseline;font-size:13px;padding:7px 0;border-top:1px solid #3a2410}' +
      '.ovrow b{color:#8a6a3a;font-weight:600;font-size:11px;letter-spacing:.04em;text-transform:uppercase}' +
      '.ovrow span{color:#f5efe0;text-align:right}' +
      '.ovacts{display:flex;gap:8px;margin-top:14px;flex-wrap:wrap}' +
      '.ovacts button{flex:1;min-width:110px}' +
      '.overr{min-height:16px;margin:8px 0 0;font-size:12px;color:#e0908a}' +
      '#tipAmt,#shopAsk{width:100%;margin-top:4px;box-sizing:border-box}' +
      '.tiptoast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#1f4023;border:1px solid #6ee787;color:#bdf5c8;padding:10px 14px;border-radius:10px;font-size:13px;z-index:60;box-shadow:0 8px 24px #0008;max-width:90%}' +
      'form{display:flex;gap:8px}' +
      '#f{padding:12px;background:#2b1a0a;border-top:1px solid #3a2410}' +
      'input,textarea{padding:10px 12px;border-radius:8px;border:1px solid #3a2410;background:#160d04;color:#f5efe0;font-size:14px;font-family:inherit}' +
      '#u{width:90px}#m{flex:1}' +
      'button{padding:10px 16px;border:none;border-radius:8px;background:#c8823c;color:#1d1206;font-weight:600;cursor:pointer}' +
      'button.ghost{background:transparent;color:#c8823c;border:1px solid #3a2410}' +
      '#picker{display:none;gap:2px;flex-wrap:wrap;max-height:132px;overflow-y:auto;padding:8px 12px;background:#241505;border-top:1px solid #3a2410}' +
      '.pemoji{padding:4px;font-size:20px;line-height:1;background:transparent;border:0;border-radius:6px;cursor:pointer;color:inherit}' +
      '.pemoji:hover{background:#3a2410}' +
      '#pick{padding:10px 12px;background:#160d04;border:1px solid #3a2410;color:#f5efe0;font-weight:400}' +
      '.msg{position:relative}' +
      '.acts{position:absolute;top:-12px;right:6px;display:none;gap:2px}' +
      '.msg:hover .acts{display:flex}' +
      '.act{padding:2px 6px;font-size:12px;line-height:1;background:#160d04;border:1px solid #3a2410;border-radius:6px;color:#f5efe0;font-weight:400;cursor:pointer}' +
      '.quote{font-size:12px;color:#c8823c;border-left:3px solid #c8823c;padding:2px 6px;margin-bottom:4px;border-radius:4px;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%}' +
      '.quote b{color:#f5efe0}' +
      '.reacts{display:flex;gap:4px;flex-wrap:wrap;margin-top:4px}' +
      '.reacts:empty{display:none}' +
      '.chip{padding:1px 7px;font-size:12px;line-height:1.7;background:#160d04;border:1px solid #3a2410;border-radius:10px;color:#f5efe0;font-weight:400;cursor:pointer}' +
      '.chip.on{background:#8a5a28;border-color:#c8823c}' +
      '.flash{outline:2px solid #f2c063}' +
      '.isvg{height:1.7em;width:auto;vertical-align:-0.5em}' +
      '.embed{display:block;max-width:100%;max-height:240px;border-radius:8px;margin-top:3px}' +
      '.embed.god{max-height:min(70vh,560px)}' +
      '#replybar{display:none;align-items:center;gap:8px;padding:6px 12px;background:#241505;border-top:1px solid #3a2410;font-size:12px;color:#c8823c}' +
      '#replybar b{color:#f5efe0}' +
      '#replybar .x{margin-left:auto;cursor:pointer;padding:2px 8px;background:#160d04;border:1px solid #3a2410;border-radius:6px}' +
      '#rpal{position:fixed;display:none;gap:2px;padding:4px;background:#241505;border:1px solid #3a2410;border-radius:10px;z-index:10;box-shadow:0 6px 20px #0008}' +
      '#rpal button{padding:3px 4px;font-size:18px;line-height:1;background:transparent;border:0;cursor:pointer}' +
      '#rpal button:hover{background:#3a2410;border-radius:6px}' +
      '#choose{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:24px}' +
      '#choose h2{margin:0 0 6px;text-align:center}' +
      '#choicerow{display:flex;gap:14px;width:100%;max-width:800px;flex-wrap:wrap;justify-content:center}' +
      '.bigbtn{flex:1 1 150px;min-width:150px;max-width:186px;aspect-ratio:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;text-align:center;padding:12px;font-size:15px;border-radius:14px;line-height:1.25}' +
      '.bicon{width:44%;height:auto}' +   /* the chat speech-bubble svg */
      '.bimg{width:58%;aspect-ratio:1;object-fit:cover;border-radius:10px}' +   /* the sahur png */
      '#shrine{flex:1;display:none;flex-direction:column;min-height:0}' +
      '#shrinebar{display:flex;align-items:center;gap:8px;padding:10px 12px;background:#2b1a0a;border-bottom:1px solid #3a2410}' +
      '#exportKey{margin-left:auto;font-size:12px;display:none}' +
      '#loginBox{margin-top:18px;display:flex;flex-direction:column;gap:8px;text-align:left}' +
      '#loginBox .hint{margin:0 0 2px}' +
      '#play{flex:1;display:none;flex-direction:column;min-height:0}' +
      '#playbar{display:flex;gap:8px;padding:10px 12px;background:#2b1a0a;border-bottom:1px solid #3a2410}' +
      '#cloakbar{display:flex;gap:8px;padding:8px 12px;background:#241505;border-bottom:1px solid #3a2410}' +
      '#cloakbar input{flex:1;min-width:0;font-size:12px}' +
      '#gsearch{flex:1}' +
      '#playgrid{flex:1;overflow-y:auto;padding:16px;display:grid;grid-template-columns:repeat(auto-fill,minmax(165px,1fr));gap:10px;align-content:start}' +
      '.gtile{min-height:64px;padding:14px 8px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;background:#241505;border:1px solid #3a2410;border-radius:10px;color:#f5efe0;cursor:pointer;text-align:center;line-height:1.25}' +
      '.gtile:hover{background:#3a2410}' +
      /* Tung's Originals hub — in-window, not the CDN grid */
      '#originals{flex:1;display:none;flex-direction:column;min-height:0;background:radial-gradient(120% 80% at 50% 0%,#241505 0%,#160d04 60%)}' +
      '#origbar{display:flex;align-items:center;gap:8px;padding:10px 12px;background:linear-gradient(180deg,#32200c,#2b1a0a);border-bottom:1px solid #3a2410}' +
      '#origTitle{font-weight:700;color:#f2c063}' +
      '#orighub{flex:1;overflow-y:auto;padding:28px 24px;display:flex;flex-direction:column;gap:16px;align-items:center}' +
      '.origlead{margin:0;font-size:13px;color:#c8823c;font-style:italic;text-align:center;max-width:420px}' +
      '.origgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;width:100%;max-width:720px}' +
      '.origtile{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;min-height:140px;padding:18px 14px;background:linear-gradient(155deg,#2e1c08,#1d1206);border:1px solid #4a3316;border-radius:12px;color:#f5efe0;cursor:pointer;text-align:center;box-shadow:0 2px 0 #0004}' +
      '.origtile:hover{transform:translateY(-2px);border-color:#c8823c;box-shadow:0 6px 16px #0007}' +
      '.origtile strong{color:#f2c063;font-size:15px}' +
      '.origtile span{font-size:12px;color:#c8823c;font-style:italic;font-weight:400}' +
      '#origplay{flex:1;display:none;flex-direction:column;min-height:0}' +
      '#origframe{display:block;flex:1;width:100%;border:0;background:#160d04}' +
      /* ---- casino ---- */
      '.casbtn{display:flex;align-items:center;gap:6px;padding:8px 12px;background:#241505;border:1px solid #7a5a1a;color:#f2c063;font-weight:700;border-radius:10px;cursor:pointer;flex:0 0 auto}' +
      '.casbtn:hover{background:#3a2410;border-color:#c8823c}' +
      '.casbtn svg{flex:0 0 auto}' +
      '#casino{flex:1;display:none;flex-direction:column;min-height:0;background:radial-gradient(120% 80% at 50% 0%,#241505 0%,#160d04 60%);position:relative;overflow:hidden}' +
      '#casbalwrap{margin-left:auto;background:#160d04;border:1px solid #7a5a1a;border-radius:999px;padding:5px 12px;font-size:13px;color:#f5efe0;white-space:nowrap;flex:0 0 auto}' +
      '#casbalwrap b{color:#f2c063;font-weight:600}' +
      /* dice: draggable target track */
      '.dicewrap{padding:6px 4px 0}' +
      '.dtrack{position:relative;height:46px;border-radius:23px;background:#5a2020;overflow:hidden;cursor:pointer;border:1px solid #3a2410;touch-action:none}' +
      '.dwin{position:absolute;top:0;bottom:0;background:#1f4023}' +
      '.dhandle{position:absolute;top:-6px;width:26px;height:58px;margin-left:-13px;border-radius:7px;background:#f2c063;border:2px solid #1d1206;cursor:grab;box-shadow:0 2px 6px #0007}' +
      '.dmark{position:absolute;top:-10px;width:4px;height:66px;margin-left:-2px;background:#fff;box-shadow:0 0 6px #fff;transition:left .45s cubic-bezier(.2,.8,.3,1)}' +
      '.dscale{display:flex;justify-content:space-between;font-size:10px;color:#8a6a3a;margin-top:4px}' +
      '.dstats{display:flex;gap:10px;flex-wrap:wrap;margin-top:8px}' +
      '.stat{flex:1;min-width:90px;background:#241505;border:1px solid #3a2410;border-radius:10px;padding:8px 10px}' +
      '.stat b{display:block;font-size:10px;color:#8a6a3a;font-weight:600;text-transform:uppercase;letter-spacing:.04em}' +
      '.stat span{font-size:19px;font-weight:700;color:#f2c063}' +
      '.seg{display:flex;border:1px solid #7a5a1a;border-radius:9px;overflow:hidden}' +
      '.seg button{padding:8px 14px;background:#241505;color:#c8823c;border:0;font-weight:700;cursor:pointer;font-size:13px}' +
      '.seg button.on{background:#c8823c;color:#1d1206}' +
      /* roulette */
      '.wheelwrap{display:flex;justify-content:center;padding:4px 0}' +
      '.wheel{transition:transform 4s cubic-bezier(.15,.85,.2,1)}' +
      /* the ball orbits the other way and settles a touch before the wheel stops.
         .ballhop (nested) drops into the pocket with a few bounces in the last
         second-and-a-half, wobbling a pocket or two as it finds its rest. */
      '.ball{transition:transform 3.7s cubic-bezier(.12,.78,.18,1)}' +
      '.ballhop{transform-box:view-box}' +
      '.ball.dropping .ballhop{animation:ballDrop 3.7s both}' +
      '@keyframes ballDrop{' +
      '0%,58%{transform:rotate(0deg) translateY(0)}' +
      '68%{transform:rotate(-22deg) translateY(22px)}' +
      '76%{transform:rotate(14deg) translateY(5px)}' +
      '84%{transform:rotate(-10deg) translateY(18px)}' +
      '91%{transform:rotate(5deg) translateY(8px)}' +
      '100%{transform:rotate(0deg) translateY(16px)}}' +
      '.rboard{display:grid;grid-template-columns:repeat(12,1fr);gap:3px;margin-top:8px}' +
      '.rnum{aspect-ratio:1;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;border-radius:4px;cursor:pointer;color:#fff;border:1px solid transparent}' +
      '.rnum.red{background:#a32020}.rnum.black{background:#23232b}.rnum.green{background:#1f6b32}' +
      '.rnum.sel{border-color:#f2c063;box-shadow:0 0 0 2px #f2c063 inset}' +
      '.routside{display:flex;gap:4px;flex-wrap:wrap;margin-top:6px}' +
      '.rout{flex:1;min-width:64px;padding:8px 6px;font-size:11px;font-weight:700;border-radius:6px;background:#241505;border:1px solid #3a2410;color:#f5efe0;cursor:pointer;text-align:center}' +
      '.rout.sel{border-color:#f2c063;background:#3a2410;color:#f2c063}' +
      /* plinko */
      /* board + buckets share ONE box of identical width so the ball's x (in SVG
         user units) maps onto the same scale the buckets are laid out on. */
      '.plinkboard{width:100%;max-width:620px;margin:0 auto}' +
      '.plinkwrap{width:100%}' +
      '.plinkwrap svg{display:block;width:100%;height:auto}' +
      /* gap MUST stay 0: any gap shifts bucket centres off the ball landing spots.
         separation comes from a border, which box-sizing keeps inside the width. */
      '.pbuckets{display:flex;gap:0;margin-top:4px;flex-wrap:nowrap;width:100%}' +
      '.pb{flex:1 1 0;min-width:0;box-sizing:border-box;border:1px solid #1d1206;padding:9px 0;font-size:12px;font-weight:700;text-align:center;border-radius:4px;background:#3a2410;color:#f5efe0;overflow:hidden;transition:transform .12s ease}' +
      '.pb.hit{background:#f2c063;color:#1d1206;transform:translateY(-3px)}' +
      /* beef road */
      '.road{display:flex;gap:0;overflow-x:auto;background:#23232b;border-radius:10px;padding:0;border:2px solid #3a2410}' +
      '.rlane{flex:0 0 84px;min-height:128px;display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:8px 2px;border-right:2px dashed #55555f;font-size:11px;color:#9a9aa5;position:relative}' +
      '.rlane:last-child{border-right:0}' +
      '.rlane .lm{font-weight:700;color:#c8823c;font-size:11px}' +
      '.rlane .lc{font-size:22px;line-height:1;height:26px}' +
      '.rlane.done{background:#1f4023;color:#6ee787}' +
      '.rlane.done .lm{color:#6ee787}' +
      '.rlane.cur{background:#3a2410;box-shadow:inset 0 0 0 2px #f2c063}' +
      '.rlane.boom{background:#5a2020}' +
      /* traffic: a car loops down every lane the chicken has not cleared yet */
      '.rlane{overflow:hidden}' +
      '.car{position:absolute;left:50%;margin-left:-13px;font-size:22px;line-height:1;will-change:transform;animation:drive linear infinite}' +
      '@keyframes drive{from{transform:translateY(-38px)}to{transform:translateY(112px)}}' +
      '.rlane.done .car,.rlane.cur .car{display:none}' +
      '.car.hit{animation:squash .55s linear forwards}' +
      '@keyframes squash{from{transform:translateY(-38px)}to{transform:translateY(112px)}}' +
      /* the win celebration that pops over the whole casino */
      '#winpop{position:absolute;left:50%;top:27%;transform:translate(-50%,-50%) scale(.7);z-index:40;pointer-events:none;opacity:0;' +
      'background:linear-gradient(160deg,#2e7d32,#1f4023);border:2px solid #6ee787;border-radius:16px;padding:16px 26px;text-align:center;' +
      'box-shadow:0 12px 40px #000a,0 0 0 4px #6ee78722}' +
      '#winpop.show{animation:winpop 1.9s cubic-bezier(.2,1.2,.3,1) forwards}' +
      '#winpop .wamt{display:block;font-size:24px;font-weight:800;color:#fff;line-height:1.1;text-shadow:0 2px 6px #0008}' +
      '#winpop .wmul{display:block;margin-top:4px;font-size:15px;font-weight:800;color:#bdf5c8;letter-spacing:.03em}' +
      '@keyframes winpop{0%{opacity:0;transform:translate(-50%,-50%) scale(.7)}' +
      '14%{opacity:1;transform:translate(-50%,-58%) scale(1.06)}' +
      '26%{transform:translate(-50%,-56%) scale(1)}' +
      '72%{opacity:1;transform:translate(-50%,-56%) scale(1)}' +
      '100%{opacity:0;transform:translate(-50%,-74%) scale(.95)}}' +
      /* mines: dedicated readout panel */
      '.panel{display:flex;gap:8px;background:linear-gradient(150deg,#2b1a0a,#1d1206);border:1px solid #7a5a1a;border-radius:14px;padding:12px}' +
      '.pcell{flex:1;min-width:0;text-align:center}' +
      '.pcell b{display:block;font-size:9px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#8a6a3a;margin-bottom:3px}' +
      '.pcell span{font-size:24px;font-weight:800;color:#f2c063;font-variant-numeric:tabular-nums}' +
      '.pcell.gem span{color:#6ee787}' +
      '.pdiv{width:1px;background:#3a2410;flex:0 0 1px}' +
      /* ---- general polish: lobby, chooser and the catalog grid ---- */
      '.casmenu{gap:12px}' +
      '.casgame{background:linear-gradient(155deg,#2e1c08,#1d1206);border:1px solid #4a3316;box-shadow:0 2px 0 #0004;transition:transform .12s ease,border-color .12s ease,box-shadow .12s ease}' +
      '.casgame:hover{transform:translateY(-2px);border-color:#c8823c;box-shadow:0 6px 16px #0007}' +
      '.casgame .ci{color:#f2c063;filter:drop-shadow(0 2px 3px #0006)}' +
      '.faucet{background:linear-gradient(135deg,#3a2410,#241505 60%);box-shadow:inset 0 1px 0 #ffffff10,0 4px 14px #0005}' +
      '.faucet h3{letter-spacing:.02em}' +
      '.seclabel{font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#8a6a3a;margin:2px 0 -4px}' +
      /* the Shrine of Tung Tung God: his portrait on an altar above the faucet */
      '.altar{display:flex;flex-direction:column;align-items:center;text-align:center;gap:12px;padding:18px 16px 22px;' +
      'background:radial-gradient(80% 60% at 50% 12%,#3a2410 0%,#241505 55%,#1d1206 100%);' +
      'border:1px solid #7a5a1a;border-radius:18px;box-shadow:inset 0 1px 0 #ffffff12,0 8px 28px #0006}' +
      '.godimg{width:min(64%,230px);height:auto;border-radius:14px;border:2px solid #7a5a1a;' +
      'box-shadow:0 0 0 6px #c8823c1a,0 10px 30px #0008;animation:godfloat 5s ease-in-out infinite}' +
      '@keyframes godfloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}' +
      '.godsub{margin:0;font-size:13px;color:#c8823c;max-width:280px;font-style:italic}' +
      '.godnote{margin:0;font-size:12px;color:#8a6a3a}' +
      '.altar #casclaim{min-width:200px;font-size:15px}' +
      /* the catalog grid page */
      '#playbar{background:linear-gradient(180deg,#32200c,#2b1a0a)}' +
      '#gsearch{border-radius:9px}' +
      '#gsearch:focus{outline:none;border-color:#c8823c;box-shadow:0 0 0 2px #c8823c40}' +
      '.gtile{background:linear-gradient(155deg,#2a1a08,#1f1305);border-color:#4a3316;transition:transform .1s ease,border-color .1s ease,background .1s ease}' +
      '.gtile:hover{transform:translateY(-2px);border-color:#c8823c;background:linear-gradient(155deg,#3a2410,#2a1a08)}' +
      '#cloakbar{background:#1d1206}' +
      '#cloakbar input:focus{outline:none;border-color:#c8823c}' +
      /* the chooser */
      /* .bigbtn paints a DARK gradient over the default button background, so it
         must also override the default dark button text colour — otherwise the
         non-ghost chooser button (Shrine of Tung) renders #1d1206 on #241505 and
         its currentColor svg goes with it. Match the ghost/catalog gold. */
      '.bigbtn{background:linear-gradient(155deg,#3a2410,#241505);border:1px solid #4a3316;color:#c8823c;transition:transform .12s ease,border-color .12s ease}' +
      '.bigbtn:hover{transform:translateY(-3px);border-color:#c8823c}' +
      '#choose h2{letter-spacing:.02em}' +
      '#casscreen{flex:1;overflow-y:auto;padding:28px 24px;display:flex;flex-direction:column;gap:18px}' +
      /* one centred column: keeps boards off the left edge on a wide window */
      '.caswrap{width:100%;max-width:920px;margin:0 auto;display:flex;flex-direction:column;gap:18px}' +
      '.casgate{margin:auto;max-width:340px;text-align:center;color:#e9d9c2}' +
      '.casgate h3{margin:0 0 8px;color:#f2c063}' +
      '.casgate p{margin:0 0 10px;font-size:14px;color:#c8823c}' +
      '.faucet{display:flex;align-items:center;gap:10px;flex-wrap:wrap;background:linear-gradient(135deg,#2b1a0a,#241505);border:1px solid #7a5a1a;border-radius:14px;padding:14px 16px}' +
      '.faucet h3{margin:0;font-size:15px;color:#f2c063}' +
      '.faucet p{margin:2px 0 0;font-size:12px;color:#c8823c}' +
      '.faucet .grow{flex:1;min-width:120px}' +
      '#casclaim{padding:10px 16px;border:none;border-radius:10px;background:#c8823c;color:#1d1206;font-weight:700;cursor:pointer}' +
      '#casclaim:disabled{opacity:.55;cursor:not-allowed}' +
      '.casmenu{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}' +
      '.casgame{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;min-height:120px;padding:18px 12px;background:#241505;border:1px solid #3a2410;border-radius:12px;color:#f5efe0;font-weight:700;font-size:13px;cursor:pointer;text-align:center}' +
      '.casgame:hover{background:#3a2410;border-color:#7a5a1a}' +
      '.casgame .ci{font-size:26px;line-height:1}' +
      '.casview{display:flex;flex-direction:column;gap:12px}' +
      '.casview h3{margin:0;color:#f2c063;display:flex;align-items:center;gap:8px}' +
      '.casrow{display:flex;gap:8px;flex-wrap:wrap;align-items:center}' +
      '.casrow label{font-size:12px;color:#c8823c}' +
      /* the casino container is #casino — these were written as .casino and so
         never applied, which is why the selects rendered as bare OS widgets. */
      '#casino input,#casino select{padding:9px 11px;border-radius:9px;border:1px solid #3a2410;background:#160d04;color:#f5efe0;font-size:14px;font-family:inherit}' +
      '#casino input[type=number]{width:96px}' +
      '#casino input:focus,#casino select:focus{outline:none;border-color:#c8823c;box-shadow:0 0 0 2px #c8823c40}' +
      /* themed dropdown: kill the native chrome, draw our own caret */
      '#casino select{appearance:none;-webkit-appearance:none;-moz-appearance:none;cursor:pointer;padding-right:30px;font-weight:600;color:#f2c063;' +
      'background-image:url("data:image/svg+xml;charset=utf8,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 12 8\'%3E%3Cpath fill=\'%23c8823c\' d=\'M1 1.5 6 6.5l5-5\'/%3E%3C/svg%3E");' +
      'background-repeat:no-repeat;background-position:right 10px center;background-size:11px}' +
      '#casino select:hover{border-color:#7a5a1a}' +
      /* a labelled control capsule so bet/risk/rows read as one tidy row */
      '.ctl{display:flex;flex-direction:column;gap:4px}' +
      '.ctl>span{font-size:10px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#8a6a3a}' +
      '.ctlrow{display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;background:#1d1206;border:1px solid #3a2410;border-radius:12px;padding:12px}' +
      '.cbtn{padding:10px 16px;border:none;border-radius:9px;background:#c8823c;color:#1d1206;font-weight:700;cursor:pointer}' +
      '.cbtn:disabled{opacity:.5;cursor:not-allowed}' +
      '.cbtn.sec{background:#241505;color:#f2c063;border:1px solid #7a5a1a}' +
      '.cbtn.go{background:#2e7d32;color:#fff}' +
      '.cbtn.stop{background:#7a2e2e;color:#fff}' +
      '.casres{min-height:22px;font-size:14px;font-weight:600}' +
      '.casres.win{color:#6ee787}.casres.lose{color:#e0908a}' +
      '.casback{align-self:flex-start;background:transparent;border:1px solid #3a2410;color:#c8823c;padding:6px 12px;border-radius:8px;cursor:pointer}' +
      /* margin:0 auto matters: without it the capped grid pins to the left */
      '.grid5{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;max-width:460px;width:100%;margin:0 auto}' +
      '.cell{aspect-ratio:1;display:flex;align-items:center;justify-content:center;font-size:30px;background:#241505;border:1px solid #3a2410;border-radius:8px;cursor:pointer;color:#f5efe0}' +
      '.cell:hover{background:#3a2410}' +
      '.cell.safe{background:#1f4023;border-color:#2e7d32}' +
      '.cell.mine{background:#5a2020;border-color:#7a2e2e}' +
      '.cell.dis{pointer-events:none;opacity:.85}' +
      '.lanes{display:flex;gap:4px;overflow-x:auto;padding:8px 2px}' +
      '.lane{flex:0 0 auto;width:52px;min-height:60px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;background:#241505;border:1px solid #3a2410;border-radius:8px;font-size:11px;color:#c8823c}' +
      '.lane.on{background:#1f4023;border-color:#2e7d32;color:#6ee787}' +
      '.lane.dead{background:#5a2020;border-color:#7a2e2e}' +
      '.cards{display:flex;gap:6px;flex-wrap:wrap}' +
      /* ---- blackjack table ---- */
      '.bjtable{display:flex;flex-direction:column;align-items:center;gap:8px;padding:6px 0 2px}' +
      '.bjtable.bjdealing{pointer-events:none}' +
      '.bjlabel{font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#8a6a3a}' +
      '.bjval{font-size:30px;font-weight:800;color:#f2c063;line-height:1;font-variant-numeric:tabular-nums}' +
      '.bjcards{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;min-height:142px;align-items:center}' +
      '.bjsplit{width:100%;max-width:280px;height:1px;background:#3a2410;margin:4px 0}' +
      /* split hands sit side by side; the one you are playing is ringed. cards
         shrink once there is more than one hand so two fit across a phone. */
      '.bjhands{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;width:100%}' +
      '.bjhand{display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px 10px;border-radius:14px;border:2px solid transparent;transition:border-color .15s ease,background .15s ease}' +
      '.bjhand.active{border-color:#f2c063;background:#ffffff0d}' +
      '.bjhand.settled{opacity:.72}' +
      '.bjhtag{font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#8a6a3a}' +
      '.bjhtag.win{color:#6ee787}.bjhtag.lose{color:#e0908a}' +
      '.bjhands.multi .pcard{width:76px;height:108px}' +
      '.bjhands.multi .pcface{font-size:26px;border-radius:10px}' +
      '.bjhands.multi .pcback{font-size:22px}' +
      '.bjhands.multi .bjval{font-size:22px}' +
      '.bjhands.multi .bjcards{min-height:112px;gap:8px}' +
      '.bjbtn.split{background:linear-gradient(160deg,#9a5cd0,#6a3596)}' +
      /* A card that flips face-up as it is dealt. Deliberately 2D: a rotateY +
         backface-visibility version rendered the BACK of every card, because the
         preserve-3d context gets flattened here and flattening inverts which
         face is hidden. Squeezing scaleX through zero and swapping the faces at
         the halfway point reads the same and has no 3D context to lose.
         There is no stagger here: the table deals the cards one at a time, so a
         card element only ever exists once its turn has come. The flip is the
         same 0.4s as the gap, so one card finishes landing before the next is
         created — overlapping 0.5s flips on a 0.4s beat read as one pile. */
      '.pcard{width:98px;height:138px;position:relative;flex:0 0 auto}' +
      '.pcinner{position:absolute;left:0;top:0;right:0;bottom:0;animation:dealIn .4s cubic-bezier(.3,.8,.4,1) both}' +
      '.pcface{position:absolute;left:0;top:0;right:0;bottom:0;' +
      'border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:34px;font-weight:800;box-shadow:0 8px 20px #0008}' +
      '.pcfront{background:#f7f2e6;color:#1d1206;border:1px solid #cfc6b0;opacity:0;animation:faceIn .4s both}' +
      '.pcfront.red{color:#b3261e}' +
      '.pcback{background:linear-gradient(135deg,#3a2410,#241505);color:#7a5a1a;border:1px solid #7a5a1a;font-size:30px;' +
      'animation:faceOut .4s both}' +
      /* the dealer hole card just drops in and stays face down */
      '.pcard.hole .pcinner{animation-name:dealBack}' +
      '.pcard.hole .pcback{animation:none;opacity:1}' +
      '.pcard.hole .pcfront{animation:none;opacity:0}' +
      '@keyframes dealIn{0%{opacity:0;transform:translateY(-20px) scaleX(1)}30%{opacity:1}50%{transform:translateY(0) scaleX(.06)}100%{opacity:1;transform:translateY(0) scaleX(1)}}' +
      '@keyframes dealBack{0%{opacity:0;transform:translateY(-20px)}100%{opacity:1;transform:translateY(0)}}' +
      '@keyframes faceIn{0%,49%{opacity:0}50%,100%{opacity:1}}' +
      '@keyframes faceOut{0%,49%{opacity:1}50%,100%{opacity:0}}' +
      /* action buttons, each with its own colour */
      '.bjacts{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:6px;min-height:60px}' +
      '.bjbtn{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;min-width:88px;padding:10px 16px;' +
      'border:none;border-radius:14px;font-weight:800;font-size:13px;letter-spacing:.06em;text-transform:uppercase;cursor:pointer;color:#fff;' +
      'box-shadow:0 4px 0 #0007,0 6px 14px #0005;transition:transform .1s ease,filter .1s ease}' +
      '.bjbtn:hover:not(:disabled){transform:translateY(-2px);filter:brightness(1.12)}' +
      '.bjbtn:active:not(:disabled){transform:translateY(2px);box-shadow:0 1px 0 #0007}' +
      '.bjbtn:disabled{opacity:.4;cursor:not-allowed}' +
      '.bjbtn.hit{background:linear-gradient(160deg,#34a85a,#1d6b36)}' +
      '.bjbtn.stand{background:linear-gradient(160deg,#c8514a,#8a2b26)}' +
      '.bjbtn.dbl{background:linear-gradient(160deg,#5286d8,#2d5192)}' +
      '.bjbtn.deal{background:linear-gradient(160deg,#e0a44a,#b57420);color:#1d1206}' +
      '.bjres{text-align:center;font-size:16px;font-weight:800;min-height:24px}' +
      '.bjres.win{color:#6ee787}.bjres.lose{color:#e0908a}' +
      '.card{min-width:38px;height:54px;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;background:#f5efe0;color:#1d1206;border-radius:6px;border:1px solid #ccc}' +
      '.card.red{color:#b3261e}' +
      '.shopitem{display:flex;align-items:center;gap:12px;background:#241505;border:1px solid #3a2410;border-radius:12px;padding:12px 14px}' +
      '.shopitem.wait{border-color:#c8823c}' +
      '.shopitem .grow{flex:1}' +
      '.shopitem h4{margin:0 0 2px;font-size:14px}' +
      '.shopitem p{margin:0;font-size:12px;color:#c8823c}' +
      '.shopitem .price{font-weight:700;color:#f2c063;white-space:nowrap}' +
      '.casnote{font-size:11px;color:#8a6a3a;text-align:center;margin-top:4px}' +
      /* shown when you run dry: always inside a game, once ever in the lobby.
         text stays left; the shrine button is pinned to the far right. extra
         right padding keeps that button clear of the dismiss X. */
      '.brokebar{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:nowrap;position:relative;' +
      'background:linear-gradient(135deg,#3a2410,#241505);border:1px solid #c8823c;border-radius:14px;padding:16px 48px 16px 18px;' +
      'box-shadow:0 6px 20px #0006}' +
      '.brokebar .grow{flex:1 1 auto;min-width:0}' +
      '.brokebar h4{margin:0 0 3px;font-size:16px;color:#f2c063}' +
      '.brokebar p{margin:0;font-size:13px;color:#c8823c}' +
      '.brokebar .cbtn{white-space:nowrap;flex:0 0 auto;margin-left:auto}' +
      '.brokex{position:absolute;top:8px;right:10px;background:transparent;border:0;color:#8a6a3a;font-size:14px;cursor:pointer;padding:2px 6px;line-height:1}' +
      '.brokex:hover{color:#f2c063}' +
      '@media(max-width:560px){.brokebar{flex-wrap:wrap}.brokebar .cbtn{width:auto;margin-left:auto}}';

  /* the in-page in-page player styles were removed — catalog items now open in a
     separate about:blank tab that carries its own header + iframe styles */
})();
