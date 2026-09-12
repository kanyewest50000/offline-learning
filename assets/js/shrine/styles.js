/* ==========================================================================
   Shrine of Tung — window stylesheet
   The whole stylesheet for the about:blank shrine window, held as a string
   because that window is written with document.write and cannot reliably load
   a relative <link>. Covers every view: gate, chat, catalog, originals, veil,
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
      '#appThread .twhen{display:block;font-size:10px;color:#8a6a3a;margin-bottom:3px}' +
      '#appThread .tmsg.me .twhen{color:#5a3a14}' +
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
      '.meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:2px}' +
      '.who{display:block;font-size:11px;color:#c8823c;margin-bottom:0;background:transparent;border:0;padding:0;cursor:pointer;font-family:inherit;font-weight:600;text-align:left;line-height:1.2}' +
      '.who:hover{color:#f2c063;text-decoration:underline}' +
      '.msg.me .who{color:#f2c063}' +
      '.when{font-size:10px;font-weight:500;color:#8a6a3a;letter-spacing:.02em;white-space:nowrap;line-height:1.2}' +
      '.msg.me .when{color:#d4b48a}' +
      /* tung does not post as a member and should not read as one: his line runs
         the full width of the log as a notice rather than sitting in the left
         column with everyone else, and carries a mark next to the name. */
      '.msg.tung{align-self:stretch;max-width:100%;background:linear-gradient(160deg,#2e1c08,#1d1206);border:1px solid #7a5a1a;border-left:3px solid #f2c063}' +
      '.msg.tung .body{color:#f5efe0;font-style:italic;line-height:1.5}' +
      '.who.tung{display:flex;align-items:center;gap:6px;color:#f2c063;font-weight:800;letter-spacing:.02em}' +
      '.who.tung:hover{color:#fff}' +
      '.tungmark{font-size:9px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:#1d1206;background:#f2c063;border-radius:4px;padding:1px 5px;line-height:1.5}' +
      '.tungimg{width:15px;height:15px;border-radius:3px;object-fit:cover;flex:0 0 auto}' +
      /* the giveaway button under one of his lines in five */
      '.giftbox{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:8px}' +
      '.giftbtn{background:#f2c063;color:#1d1206;font-weight:800;letter-spacing:.02em;padding:8px 14px;border-radius:9px;border:1px solid #f2c063;cursor:pointer}' +
      '.giftbtn:hover:not(:disabled){background:#fff;border-color:#fff}' +
      '.giftbtn:disabled{cursor:default;opacity:.85}' +
      '.giftbtn.taken{background:transparent;color:#8a6a3a;border:1px solid #3a2410;font-weight:600}' +
      '.giftnote{font-size:12px;color:#c8823c;font-style:italic}' +
      /* his profile card: no join date, no balance, so the ordinary rows go */
      '#profExtra{display:none}' +
      '.ovcard.tung h3{display:flex;align-items:center;gap:7px}' +
      '.ovcard.tung .ovrow b{color:#c8823c}' +
      '.ovcard.tung .ovrow span{color:#f2c063;font-style:italic}' +
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
      '#veil{flex:1;display:none;flex-direction:column;min-height:0;background:radial-gradient(120% 80% at 50% 0%,#241505 0%,#160d04 60%)}' +
      '#veilbar{display:flex;align-items:center;gap:8px;padding:10px 12px;background:linear-gradient(180deg,#32200c,#2b1a0a);border-bottom:1px solid #3a2410}' +
      '#veilTitle{font-weight:700;color:#f2c063}' +
      '#veilbody{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:28px 24px;text-align:center}' +
      '#veilbody h2{margin:0;font-size:28px;color:#f2c063;letter-spacing:.04em}' +
      '#veilbody p{margin:0;max-width:420px;font-size:15px;color:#c8823c;font-style:italic;line-height:1.45}' +
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
      /* ---- the pit: player against player ---- */
      /* the pit inherits .casmenu's four columns so its tiles are the same
         size as the house games below them, rather than a row of banners */
      '.casgame.pvp{border-color:#7a5a1a}' +
      '.casgame.pvp{border-color:#7a5a1a;background:linear-gradient(155deg,#3a2410,#241505)}' +
      '.casgame.pvp:hover{border-color:#f2c063}' +
      '.piticon{width:30px;height:30px;object-fit:cover;border-radius:6px;display:block}' +
      '.pitblurb{margin:0;font-size:14px;color:#f2c063;font-style:italic;line-height:1.5}' +
      '.pitsub{margin:0;font-size:12px;color:#8a6a3a;line-height:1.5}' +
      '.pitlist{display:flex;flex-direction:column;gap:8px}' +
      '.pitrow{display:flex;align-items:center;gap:12px;background:#241505;border:1px solid #3a2410;border-radius:12px;padding:12px 14px}' +
      '.pitrow.mine{border-color:#c8823c;background:linear-gradient(135deg,#3a2410,#241505)}' +
      '.pitrow .grow{flex:1;min-width:0}' +
      '.pitrow h4{margin:0 0 2px;font-size:14px;color:#f5efe0}' +
      '.pitrow p{margin:0;font-size:12px;color:#c8823c}' +
      '.pitrow .price{font-weight:700;color:#f2c063;white-space:nowrap}' +
      /* the duel screen */
      '.pitvs{display:flex;align-items:center;justify-content:center;gap:14px;flex-wrap:wrap}' +
      '.pitvs .pn{font-size:17px;font-weight:800;color:#f5efe0;max-width:40vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.pitvs .pvs{font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#8a6a3a}' +
      '.pitpot{text-align:center;font-size:13px;color:#f2c063;font-weight:700}' +
      '.pitclock{text-align:center;font-size:34px;font-weight:800;color:#c8823c;font-variant-numeric:tabular-nums;line-height:1;min-height:34px}' +
      '.pitclock.hot{color:#e0908a}' +
      '.pitbody{display:flex;flex-direction:column;align-items:center;gap:12px;text-align:center}' +
      '.pitbody .cbtn{min-width:190px}' +
      '.pitsay{margin:0;font-size:16px;color:#f5efe0;font-weight:600}' +
      '.pitbody .pitsub{margin:0;max-width:380px;text-align:center}' +
      '.pitscore{display:flex;align-items:center;justify-content:center;gap:16px}' +
      '.pitscore .sv{font-size:32px;font-weight:800;color:#f2c063;font-variant-numeric:tabular-nums;line-height:1}' +
      '.pitscore .sl{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#8a6a3a}' +
      '.pitmoves{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}' +
      '.pitmove{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;min-width:104px;padding:16px 14px;' +
      'background:linear-gradient(155deg,#3a2410,#241505);border:1px solid #4a3316;border-radius:14px;color:#f2c063;font-weight:800;' +
      'font-size:13px;letter-spacing:.04em;text-transform:lowercase;cursor:pointer;transition:transform .1s ease,border-color .1s ease}' +
      '.pitmove:hover:not(:disabled){transform:translateY(-3px);border-color:#f2c063}' +
      '.pitmove:disabled{opacity:.45;cursor:not-allowed}' +
      '.pmimg{width:38px;height:38px;object-fit:cover;border-radius:8px;display:block}' +
      '.pmemoji{font-size:34px;line-height:1}' +
      '.pitpicked{display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap}' +
      '.pitpicked .pl{font-size:12px;color:#8a6a3a}' +
      '.pitpicked .pmimg{width:44px;height:44px}' +
      /* the clash between rounds: two moves onto one line, and one of them
         does not leave. only transform and opacity move, so it stays smooth. */
      '.clash{position:relative;height:150px;width:100%;max-width:420px;margin:0 auto}' +
      '.cfighter{position:absolute;top:50%;left:50%;display:flex;flex-direction:column;align-items:center;gap:8px;' +
      'transition:transform .52s cubic-bezier(.34,.8,.36,1),opacity .34s ease}' +
      '.cfighter .cic{display:flex;align-items:center;justify-content:center;width:78px;height:78px;border-radius:18px;' +
      'background:linear-gradient(155deg,#3a2410,#241505);border:1px solid #4a3316;box-shadow:0 6px 18px #0006;' +
      'transition:border-color .3s ease,box-shadow .3s ease}' +
      '.cfighter .cic .pmimg{width:48px;height:48px;border-radius:9px}' +
      '.cfighter .cic .pmemoji{font-size:44px}' +
      '.cfighter .cnm{font-size:11px;font-weight:800;letter-spacing:.07em;color:#c8823c;transition:opacity .3s ease}' +
      '.cfighter.cwin .cic{border-color:#f2c063;box-shadow:0 0 0 3px #f2c06333,0 10px 28px #0007}' +
      '.cfighter.cwin .cnm{color:#f2c063}' +
      '.cfighter.cgone{opacity:0}' +
      '.cfighter.cgone .cnm{opacity:0}' +
      /* the moment they meet */
      '.cspark{position:absolute;top:50%;left:50%;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;' +
      'background:radial-gradient(circle,#fff 0%,#f2c063 38%,#f2c06300 70%);opacity:0;pointer-events:none}' +
      '.cspark.go{animation:cspark .55s ease-out forwards}' +
      '@keyframes cspark{0%{opacity:.95;transform:scale(.35)}100%{opacity:0;transform:scale(7.5)}}' +
      '.clashsay{text-align:center;font-size:25px;font-weight:800;color:#f2c063;min-height:32px;line-height:1.2;' +
      'opacity:0;transform:translateY(5px);transition:opacity .3s ease,transform .3s ease}' +
      '.clashsay.show{opacity:1;transform:none}' +
      '.clashsay.win{color:#6ee787}.clashsay.lose{color:#e0908a}' +
      '.clashsub{text-align:center;font-size:12px;color:#8a6a3a;min-height:18px;opacity:0;transition:opacity .3s ease}' +
      '.clashsub.show{opacity:1}' +
      '.pithist{display:flex;flex-direction:column;gap:5px;margin-top:4px;width:100%;max-width:280px}' +
      '.pithist .ph{display:flex;align-items:center;justify-content:center;gap:10px;padding:5px 8px;background:#1d1206;border:1px solid #3a2410;border-radius:8px}' +
      '.pithist .phn{font-size:10px;font-weight:800;color:#8a6a3a;width:12px}' +
      '.pithist .phv{font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#c8823c;width:44px}' +
      '.pithist .pmimg{width:22px;height:22px}' +
      '.pithist .pmemoji{font-size:20px}' +
      '.pitend{font-size:20px;font-weight:800;color:#f5efe0;line-height:1.35;max-width:420px}' +
      '.pitend.win{color:#6ee787}.pitend.lose{color:#e0908a}' +
      '.pitcards{display:flex;gap:18px;justify-content:center;flex-wrap:wrap}' +
      '.pcut{display:flex;flex-direction:column;align-items:center;gap:8px}' +
      '.pcut b{font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#8a6a3a}' +
      /* The cut deals real blackjack cards (.pcard); the slot holds the space
         they land in, fixed to the card's own height so the row is its final
         size before anything turns over.
         Everything below is tempo. Blackjack flips in 0.4s because it deals a
         lot of cards; the cut deals two and has nothing else to offer, so its
         flip is more than twice as slow and the card announces itself first. */
      '.cutslot{position:relative;display:flex;align-items:center;justify-content:center;min-height:138px}' +
      '.cutslot .pcard:not(.hole) .pcinner,.cutslot .pcard:not(.hole) .pcface{animation-duration:.9s}' +
      /* a face-down card is never quite still: a slow sheen crosses its back */
      /* overflow only — .pcface is position:absolute and that is what makes it
         fill the card, so relative here collapses the back to a sliver. It is
         already a containing block for the sheen without any help. */
      '.cutslot .pcard.hole .pcback{overflow:hidden}' +
      '.cutslot .pcard.hole .pcback::after{content:"";position:absolute;top:-40%;left:-70%;width:45%;height:180%;' +
      'background:linear-gradient(100deg,#ffffff00,#ffffff1f,#ffffff00);transform:rotate(18deg);animation:cutsheen 2.6s ease-in-out infinite}' +
      '@keyframes cutsheen{0%{left:-70%}60%,100%{left:140%}}' +
      /* and the one that is about to turn gets restless */
      '.cutslot.hot .pcard{animation:cutshiver .95s ease-in-out infinite}' +
      '.cutslot.hot .pcard.hole .pcback{border-color:#c8823c;box-shadow:0 0 18px #c8823c55}' +
      '.cutslot.hot .pcard.hole .pcback::after{animation-duration:1.1s;background:linear-gradient(100deg,#ffffff00,#f2c06344,#ffffff00)}' +
      '@keyframes cutshiver{0%,100%{transform:translateY(0) rotate(0)}' +
      '25%{transform:translateY(-4px) rotate(-1.4deg)}75%{transform:translateY(-4px) rotate(1.4deg)}}' +
      /* the card that took it keeps a ring, thrown once */
      '.cutslot.won .pcard .pcfront{box-shadow:0 0 0 3px #f2c063,0 10px 30px #0009}' +
      '.cutslot.won::after{content:"";position:absolute;left:50%;top:50%;width:104px;height:144px;' +
      'margin:-72px 0 0 -52px;border-radius:16px;border:2px solid #f2c063;opacity:0;pointer-events:none;' +
      'animation:cutring .95s cubic-bezier(.2,.8,.3,1) forwards}' +
      '@keyframes cutring{0%{opacity:.95;transform:scale(.86)}100%{opacity:0;transform:scale(1.35)}}' +
      /* the running commentary under the two cards */
      '.clashsay.cut{font-size:18px;color:#c8823c;font-weight:700;min-height:26px;margin-top:2px}' +
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
      '@media(max-width:560px){.brokebar{flex-wrap:wrap}.brokebar .cbtn{width:auto;margin-left:auto}}' +
      /* ---- a round of Competitive Gambling, riding over every other screen.
         Same strip as the broke bar so it reads as the casino talking rather
         than as a game: both stacks, the clock, and the way back to the
         table. The leader's number goes gold, the other one goes quiet. ---- */
      '.roundbar{display:flex;align-items:center;gap:14px;flex-wrap:wrap;' +
      'background:linear-gradient(135deg,#3a2410,#241505);border:1px solid #c8823c;border-radius:14px;padding:12px 16px;' +
      'box-shadow:0 6px 20px #0006}' +
      '.roundbar .rtag{font-size:10px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#8a6a3a;flex:0 0 auto}' +
      '.roundbar .rside{display:flex;flex-direction:column;gap:1px;min-width:0}' +
      '.roundbar .rside b{font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#8a6a3a;' +
      'max-width:14ch;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.roundbar .rv{font-size:19px;font-weight:800;color:#c8823c;font-variant-numeric:tabular-nums;line-height:1.1}' +
      '.roundbar .rside.up .rv{color:#f2c063}' +
      '.roundbar .rside.down .rv{color:#8a6a3a}' +
      '.roundbar .rvs{font-size:10px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#8a6a3a}' +
      '.roundbar .rclock{margin-left:auto;font-size:20px;font-weight:800;color:#f5efe0;font-variant-numeric:tabular-nums}' +
      '.roundbar .rclock.hot{color:#e0908a}' +
      '.roundbar .cbtn{flex:0 0 auto;white-space:nowrap}' +
      '@media(max-width:560px){.roundbar .rclock{margin-left:0}}' +
      /* the same two stacks, big, on the table's own page */
      '.compscore{display:flex;align-items:center;justify-content:center;gap:18px;flex-wrap:wrap}' +
      '.compscore .cstack{display:flex;flex-direction:column;align-items:center;gap:2px;min-width:0}' +
      '.compscore .cstack b{font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#8a6a3a;' +
      'max-width:16ch;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.compscore .cv{font-size:32px;font-weight:800;color:#f2c063;font-variant-numeric:tabular-nums;line-height:1}' +
      '.compscore .cvs{font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#8a6a3a}' +
      '.compscore.fin .cstack .cv{color:#8a6a3a}' +
      '.compscore.fin .cstack.up .cv{color:#f2c063}' +
      /* the floor, reprinted inside the round so the quick tables are one
         click from the scoreboard rather than back through the lobby */
      '.casmenu.comp{width:100%;grid-template-columns:repeat(4,1fr)}' +
      '.casmenu.comp .casgame{min-height:92px;font-size:12px}' +
      '@media(max-width:560px){.casmenu.comp{grid-template-columns:repeat(2,1fr)}}' +
      /* ---- the gear, and the settings page behind it ---- */
      '#choose{position:relative}' +
      '.gearbtn{position:absolute;top:16px;left:16px;width:40px;height:40px;padding:0;display:flex;align-items:center;justify-content:center;' +
      'background:#241505;border:1px solid #4a3316;border-radius:11px;color:#c8823c;cursor:pointer;' +
      'transition:transform .12s ease,border-color .12s ease,color .12s ease}' +
      '.gearbtn svg{width:21px;height:21px}' +
      '.gearbtn:hover{border-color:#c8823c;color:#f2c063;transform:rotate(35deg)}' +
      '#settings{flex:1;display:none;flex-direction:column;min-height:0;background:radial-gradient(120% 80% at 50% 0%,#241505 0%,#160d04 60%)}' +
      '#setbar{display:flex;align-items:center;gap:8px;padding:10px 12px;background:linear-gradient(180deg,#32200c,#2b1a0a);border-bottom:1px solid #3a2410}' +
      '#setTitle{font-weight:700;color:#f2c063}' +
      '#setbody{flex:1;overflow-y:auto;padding:24px;display:flex;flex-direction:column;gap:20px;align-items:center}' +
      '.setsec{width:100%;max-width:560px;background:linear-gradient(155deg,#2e1c08,#1d1206);border:1px solid #4a3316;border-radius:14px;padding:18px}' +
      '.setsec h3{margin:0 0 4px;font-size:15px;color:#f2c063}' +
      '.sethint{margin:0 0 14px;font-size:12px;color:#8a6a3a;line-height:1.5}' +
      '.setlock{margin:12px 0 0;font-size:11px;color:#8a6a3a;font-style:italic;text-align:center}' +
      '.setfield{display:flex;flex-direction:column;gap:4px;margin-bottom:10px}' +
      '.setfield>span{font-size:10px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#8a6a3a}' +
      '.setfield input{width:100%;box-sizing:border-box;font-size:13px}' +
      '.setfield input:focus{outline:none;border-color:#c8823c;box-shadow:0 0 0 2px #c8823c40}' +
      '#themegrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}' +
      '.themecard{display:flex;flex-direction:column;align-items:flex-start;gap:6px;padding:12px;text-align:left;' +
      'background:#1d1206;border:1px solid #3a2410;border-radius:12px;color:#f5efe0;cursor:pointer;font-family:inherit}' +
      '.themecard:hover{border-color:#7a5a1a}' +
      '.themecard.on{border-color:#f2c063;box-shadow:0 0 0 1px #f2c063 inset}' +
      '.themecard strong{font-size:13px;color:#f2c063;font-weight:700}' +
      '.themecard .tnote{font-size:11px;color:#8a6a3a;font-style:italic;line-height:1.4}' +
      /* each swatch paints its own theme, so the choice is visible before it is made */
      '.swatch{position:relative;width:100%;height:34px;border-radius:8px;border:1px solid #00000055;display:block}' +
      /* a locked skin still shows its colours — you can see what you are not
         wearing — but it is dimmed and carries the padlock */
      '.themecard.locked{opacity:.72;cursor:pointer}' +
      '.themecard.locked .swatch{filter:grayscale(.55) brightness(.7)}' +
      '.themecard.locked strong{color:#8a6a3a}' +
      '.themecard.locked:hover{opacity:.9;border-color:#4a3316}' +
      '.swlock{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:17px;' +
      'text-shadow:0 1px 3px #000a}' +
      '.swatch.sw-wood{background:linear-gradient(120deg,#2b1a0a 0%,#3a2410 45%,#c8823c 100%)}' +
      '.swatch.sw-dark{background:linear-gradient(120deg,#161618 0%,#232328 45%,#8b8b96 100%)}' +
      /* =====================================================================
         DARK MODE
         The wood above is the shrine as built and owns every colour in this
         sheet. A theme is a block like this one: it repaints the surfaces and
         leaves the layout completely alone, so a new theme can never move
         anything. Only colour properties belong below this line.
         ===================================================================== */
      /* data-theme sits ON <html>, so the root needs an attribute selector and
         everything else a descendant one — "[data-theme] html" would match
         nothing at all */
      'html[data-theme="dark"],[data-theme="dark"] body{background:#121214;color:#e8e8ec}' +
      '[data-theme="dark"] #mainhdr{background:#1c1c20;border-bottom-color:#2a2a30}' +
      '[data-theme="dark"] #hdrShrine small{color:#9a9aa6}' +
      '[data-theme="dark"] .hbtn{background:#232328;border-color:#3a3a44;color:#d6d6de}' +
      '[data-theme="dark"] .hbtn:hover{background:#2e2e36;border-color:#6a6a78}' +
      '[data-theme="dark"] #gate p,[data-theme="dark"] .hint{color:#9a9aa6}' +
      '[data-theme="dark"] .warn{color:#d6d6de}' +
      '[data-theme="dark"] input,[data-theme="dark"] textarea,' +
      '[data-theme="dark"] #casino input,[data-theme="dark"] #casino select{background:#1a1a1e;border-color:#3a3a44;color:#e8e8ec}' +
      '[data-theme="dark"] button{background:#5a5a68;color:#f2f2f6}' +
      '[data-theme="dark"] button.ghost{background:transparent;color:#b8b8c4;border-color:#3a3a44}' +
      '[data-theme="dark"] #myhash{background:#1a1a1e;border-color:#2a2a30;color:#d6d6de}' +
      '[data-theme="dark"] #f,[data-theme="dark"] #picker,[data-theme="dark"] #replybar{background:#1c1c20;border-color:#2a2a30}' +
      '[data-theme="dark"] #pick{background:#1a1a1e;border-color:#3a3a44;color:#e8e8ec}' +
      '[data-theme="dark"] .msg{background:#232328}' +
      '[data-theme="dark"] .msg.me{background:#3d3d4a}' +
      '[data-theme="dark"] .who{color:#9a9aa6}' +
      '[data-theme="dark"] .msg.me .who,[data-theme="dark"] .who:hover{color:#d6d6de}' +
      '[data-theme="dark"] .when{color:#8b8b96}' +
      '[data-theme="dark"] .msg.me .when{color:#b8b8c4}' +
      /* tung stays gold in every theme: he is not part of the decor */
      '[data-theme="dark"] .msg.tung{background:linear-gradient(160deg,#26262c,#19191d);border-color:#5a4a24;border-left-color:#f2c063}' +
      '[data-theme="dark"] .act,[data-theme="dark"] .chip{background:#1a1a1e;border-color:#3a3a44;color:#e8e8ec}' +
      '[data-theme="dark"] .chip.on{background:#3d3d4a;border-color:#6a6a78}' +
      '[data-theme="dark"] .quote{color:#9a9aa6;border-left-color:#6a6a78}' +
      '[data-theme="dark"] .quote b{color:#e8e8ec}' +
      '[data-theme="dark"] #rpal{background:#232328;border-color:#3a3a44}' +
      '[data-theme="dark"] #rpal button:hover,[data-theme="dark"] .pemoji:hover{background:#3a3a44}' +
      '[data-theme="dark"] .bigbtn{background:linear-gradient(155deg,#2a2a31,#1e1e23);border-color:#3a3a44;color:#c6c6d2}' +
      '[data-theme="dark"] .bigbtn:hover{border-color:#8b8b96}' +
      '[data-theme="dark"] .gearbtn{background:#232328;border-color:#3a3a44;color:#b8b8c4}' +
      '[data-theme="dark"] .gearbtn:hover{border-color:#8b8b96;color:#e8e8ec}' +
      '[data-theme="dark"] #shrinebar,[data-theme="dark"] #playbar,[data-theme="dark"] #origbar,' +
      '[data-theme="dark"] #veilbar,[data-theme="dark"] #setbar{background:linear-gradient(180deg,#26262c,#1c1c20);border-bottom-color:#2a2a30}' +
      '[data-theme="dark"] #banView{background:#0e0e10}' +
      '[data-theme="dark"] #banUntil{color:#9a9aa6}' +
      '[data-theme="dark"] .gtile{background:linear-gradient(155deg,#26262c,#1e1e23);border-color:#3a3a44;color:#e8e8ec}' +
      '[data-theme="dark"] .gtile:hover{background:linear-gradient(155deg,#31313a,#26262c);border-color:#8b8b96}' +
      '[data-theme="dark"] #originals,[data-theme="dark"] #veil,[data-theme="dark"] #settings,' +
      '[data-theme="dark"] #casino{background:radial-gradient(120% 80% at 50% 0%,#1e1e23 0%,#111113 60%)}' +
      '[data-theme="dark"] #origTitle,[data-theme="dark"] #veilTitle,[data-theme="dark"] #setTitle{color:#d6d6de}' +
      '[data-theme="dark"] .origlead,[data-theme="dark"] .origtile span,[data-theme="dark"] #veilbody p{color:#9a9aa6}' +
      '[data-theme="dark"] .origtile{background:linear-gradient(155deg,#26262c,#1a1a1e);border-color:#3a3a44;color:#e8e8ec}' +
      '[data-theme="dark"] .origtile strong,[data-theme="dark"] #veilbody h2{color:#d6d6de}' +
      '[data-theme="dark"] .setsec{background:linear-gradient(155deg,#26262c,#19191d);border-color:#3a3a44}' +
      '[data-theme="dark"] .setsec h3{color:#d6d6de}' +
      '[data-theme="dark"] .themecard{background:#1a1a1e;border-color:#3a3a44}' +
      '[data-theme="dark"] .themecard strong{color:#d6d6de}' +
      '[data-theme="dark"] .themecard.on{border-color:#8b8b96;box-shadow:0 0 0 1px #8b8b96 inset}' +
      /* casino surfaces */
      '[data-theme="dark"] #casbalwrap{background:#1a1a1e;border-color:#3a3a44}' +
      '[data-theme="dark"] #casbalwrap b,[data-theme="dark"] #hdrCasino .chtitle{color:#d6d6de}' +
      '[data-theme="dark"] .casgame{background:linear-gradient(155deg,#26262c,#1a1a1e);border-color:#3a3a44;color:#e8e8ec}' +
      '[data-theme="dark"] .casgame:hover{background:#2e2e36;border-color:#8b8b96}' +
      '[data-theme="dark"] .casgame .ci{color:#c6c6d2}' +
      '[data-theme="dark"] .casgame.pvp{border-color:#5a5a68;background:linear-gradient(155deg,#2e2e36,#1e1e23)}' +
      '[data-theme="dark"] .casgame.pvp:hover{border-color:#b8b8c4}' +
      '[data-theme="dark"] .ctlrow,[data-theme="dark"] .pithist .ph{background:#19191d;border-color:#3a3a44}' +
      '[data-theme="dark"] .panel{background:linear-gradient(150deg,#26262c,#19191d);border-color:#3a3a44}' +
      '[data-theme="dark"] .stat,[data-theme="dark"] .cell,[data-theme="dark"] .shopitem,' +
      '[data-theme="dark"] .pitrow,[data-theme="dark"] .rout{background:#232328;border-color:#3a3a44}' +
      '[data-theme="dark"] .cell:hover{background:#2e2e36}' +
      '[data-theme="dark"] .casback{border-color:#3a3a44;color:#b8b8c4}' +
      '[data-theme="dark"] .cbtn{background:#5a5a68;color:#f2f2f6}' +
      '[data-theme="dark"] .cbtn.sec{background:#232328;color:#d6d6de;border-color:#3a3a44}' +
      '[data-theme="dark"] .altar{background:radial-gradient(80% 60% at 50% 12%,#2e2e36 0%,#1e1e23 55%,#141417 100%);border-color:#3a3a44}' +
      '[data-theme="dark"] .godimg{border-color:#5a5a68}' +
      '[data-theme="dark"] .godsub{color:#9a9aa6}' +
      '[data-theme="dark"] #casclaim{background:#5a5a68;color:#f2f2f6}' +
      '[data-theme="dark"] .brokebar,[data-theme="dark"] .roundbar,' +
      '[data-theme="dark"] .pitrow.mine{background:linear-gradient(135deg,#2e2e36,#1e1e23);border-color:#8b8b96}' +
      '[data-theme="dark"] .roundbar .rv,[data-theme="dark"] .compscore .cv{color:#c6c6d2}' +
      '[data-theme="dark"] .roundbar .rside.up .rv,[data-theme="dark"] .compscore.fin .cstack.up .cv{color:#e8e8ec}' +
      '[data-theme="dark"] .roundbar .rside.down .rv,[data-theme="dark"] .compscore.fin .cstack .cv{color:#8b8b96}' +
      '[data-theme="dark"] .roundbar .rclock{color:#e8e8ec}' +
      '[data-theme="dark"] .brokebar h4{color:#e8e8ec}' +
      '[data-theme="dark"] .brokebar p,[data-theme="dark"] .pitrow p{color:#9a9aa6}' +
      '[data-theme="dark"] .pitblurb,[data-theme="dark"] .pitpot,[data-theme="dark"] .pitscore .sv,' +
      '[data-theme="dark"] .pitrow .price{color:#d6d6de}' +
      '[data-theme="dark"] .pitmove{background:linear-gradient(155deg,#2e2e36,#1e1e23);border-color:#3a3a44;color:#d6d6de}' +
      '[data-theme="dark"] .pitmove:hover:not(:disabled){border-color:#b8b8c4}' +
      '[data-theme="dark"] .pitclock{color:#b8b8c4}' +
      '[data-theme="dark"] .cfighter .cic{background:linear-gradient(155deg,#2e2e36,#1e1e23);border-color:#3a3a44}' +
      '[data-theme="dark"] .cfighter .cnm{color:#9a9aa6}' +
      '[data-theme="dark"] .cfighter.cwin .cic{border-color:#b8b8c4;box-shadow:0 0 0 3px #b8b8c433,0 10px 28px #0007}' +
      '[data-theme="dark"] .cfighter.cwin .cnm{color:#e8e8ec}' +
      '[data-theme="dark"] .cspark{background:radial-gradient(circle,#fff 0%,#b8b8c4 38%,#b8b8c400 70%)}' +
      '[data-theme="dark"] .clashsay{color:#d6d6de}' +
      '[data-theme="dark"] .clashsub{color:#8b8b96}' +
      '[data-theme="dark"] .clashsay.cut{color:#9a9aa6}' +
      '[data-theme="dark"] .cutslot.hot .pcard.hole .pcback{border-color:#8b8b96;box-shadow:0 0 18px #8b8b9655}' +
      '[data-theme="dark"] .cutslot.won .pcard .pcfront{box-shadow:0 0 0 3px #d6d6de,0 10px 30px #0009}' +
      '[data-theme="dark"] .cutslot.won::after{border-color:#d6d6de}' +
      '[data-theme="dark"] .ovcard{background:linear-gradient(160deg,#26262c,#19191d);border-color:#3a3a44}' +
      '[data-theme="dark"] .ovcard h3{color:#d6d6de}' +
      '[data-theme="dark"] .ovrow{border-top-color:#2a2a30}' +
      '[data-theme="dark"] .ovrow span{color:#e8e8ec}' +
      '[data-theme="dark"] #appThread .tmsg.admin{background:#232328;border-color:#3a3a44}' +
      '[data-theme="dark"] #appThread .tmsg.me{background:#5a5a68;color:#f2f2f6}' +
      '[data-theme="dark"] #appThread .twhen{color:#8b8b96}' +
      '[data-theme="dark"] #appThread .tmsg.me .twhen{color:#d6d6de}' +
      /* every muted label in the sheet is the same wood brown (#8a6a3a). On a
         grey ground that reads as a stain rather than as quiet text, so they all
         go neutral together — one rule, so a new label picks it up by being
         written in the house style rather than by being remembered here. */
      '[data-theme="dark"] .seclabel,[data-theme="dark"] .casnote,[data-theme="dark"] .ctl>span,' +
      '[data-theme="dark"] .stat b,[data-theme="dark"] .pcell b,[data-theme="dark"] .ovrow b,' +
      '[data-theme="dark"] .bjlabel,[data-theme="dark"] .bjhtag,[data-theme="dark"] .dscale,' +
      '[data-theme="dark"] .godnote,[data-theme="dark"] .brokex,[data-theme="dark"] .ovcard .ovsub,' +
      '[data-theme="dark"] .sethint,[data-theme="dark"] .setlock,[data-theme="dark"] .setfield>span,' +
      '[data-theme="dark"] .themecard .tnote,[data-theme="dark"] .pitsub,[data-theme="dark"] .pitscore .sl,' +
      '[data-theme="dark"] .pitpicked .pl,[data-theme="dark"] .pithist .phn,[data-theme="dark"] .pcut b,' +
      '[data-theme="dark"] .pitvs .pvs,[data-theme="dark"] .roundbar .rtag,' +
      '[data-theme="dark"] .roundbar .rside b,[data-theme="dark"] .roundbar .rvs,' +
      '[data-theme="dark"] .compscore .cstack b,[data-theme="dark"] .compscore .cvs,' +
      '[data-theme="dark"] .origlead{color:#8b8b96}' +
      '[data-theme="dark"] .pithist .phv,[data-theme="dark"] .stat span,[data-theme="dark"] .pcell span{color:#c6c6d2}' +
      '[data-theme="dark"] .pcell.gem span{color:#6ee787}';

  /* the in-page in-page player styles were removed — catalog items now open in a
     separate about:blank tab that carries its own header + iframe styles */
})();
