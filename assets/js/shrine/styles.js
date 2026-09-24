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
      /* The room and the conversations share one message pane, with a rail
         down the left saying which is in it. Two panes rather than a drawer
         because the list is only worth having if it is visible — a DM you have
         to go looking for is one you never read. */
      '#chat{flex:1;display:none;flex-direction:row;min-height:0}' +
      '#chatmain{flex:1;display:flex;flex-direction:column;min-width:0;min-height:0}' +
      /* min-width:0 and the cap are what actually hold the rail at its width:
         a flex item's min-width is auto, so one long line with no spaces in it
         widens the rail and squeezes the conversation, and the ellipsis below
         never gets the chance to do its job */
      '#dmrail{flex:0 0 232px;max-width:232px;min-width:0;display:flex;flex-direction:column;min-height:0;' +
      'background:#1d1206;border-right:1px solid #3a2410}' +
      '#dmrailhead{padding:13px 14px 9px;font-size:11px;font-weight:800;letter-spacing:.14em;' +
      'text-transform:uppercase;color:#8a6a3a}' +
      '#dmlist{flex:1;overflow-y:auto;padding:0 8px 10px;display:flex;flex-direction:column;gap:2px}' +
      '.dmrow{display:flex;flex-direction:column;gap:2px;align-items:stretch;text-align:left;width:100%;' +
      'padding:8px 10px;border-radius:9px;border:1px solid transparent;background:transparent;cursor:pointer}' +
      '.dmrow:hover{background:#241505}' +
      '.dmrow.on{background:#2b1a0a;border-color:#3a2410}' +
      '.dmtop{display:flex;align-items:center;gap:7px;min-width:0}' +
      '.dmname{flex:1;min-width:0;font-size:13px;font-weight:700;color:#f5efe0;overflow:hidden;' +
      'text-overflow:ellipsis;white-space:nowrap}' +
      '.dmrow.unread .dmname{color:#f2c063}' +
      '.dmlast{font-size:11px;color:#8a6a3a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;max-width:100%}' +
      '.dmbadge{flex:0 0 auto;min-width:18px;height:18px;padding:0 5px;border-radius:999px;background:#c8823c;' +
      'color:#1d1206;font-size:10px;font-weight:800;line-height:18px;text-align:center}' +
      '.dmempty{padding:10px;font-size:11px;color:#8a6a3a;line-height:1.5}' +
      /* which conversation the pane is showing, above it */
      '#convhead{display:flex;align-items:baseline;gap:9px;padding:12px 16px;background:#2b1a0a;' +
      'border-bottom:1px solid #3a2410;min-height:44px}' +
      '#convname{font-size:15px;font-weight:800;color:#f5efe0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '#convsub{font-size:11px;color:#8a6a3a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0}' +
      /* quiet until it is wanted: a block button that shouts would get pressed
         by accident, and this one is not easy to take back for the other side */
      '#convBlock{display:none;flex:0 0 auto;padding:5px 11px;border-radius:7px;font-size:11px;font-weight:700;' +
      'background:transparent;border:1px solid #3a2410;color:#8a6a3a;cursor:pointer}' +
      '#convBlock:hover{border-color:#8a5a28;color:#f2c063;background:#241505}' +
      '#convBlock.on{border-color:#8a5a28;color:#f2c063}' +
      /* a DM line has no reactions, replies or gifts, so it does not reserve
         room for the buttons that would work them */
      '.msg.dm .acts{display:none}' +
      /* the one thing a shut conversation shows: who shut it */
      '.dmnotice{align-self:center;margin:auto 0;padding:12px 18px;max-width:420px;text-align:center;' +
      'font-size:13px;font-weight:700;line-height:1.45;color:#f2c063;background:#241505;' +
      'border:1px solid #3a2410;border-radius:10px}' +
      /* the rail is the first thing to go when there is no width for it; the
         room still works without it */
      '@media (max-width:760px){#dmrail{display:none}}' +
      '#banView{flex:1;display:none;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:8px;padding:24px;background:#160d04}' +
      '#banTitle{font-size:22px;font-weight:800}' +
      '#banUntil{color:#c8823c;font-size:14px;line-height:1.45;max-width:40ch}' +
      /* the lockout covers everything, and everything under it is taken out
         of reach as well as out of sight: hidden rather than merely covered,
         so nothing behind it can be tabbed to or clicked through */
      '#lockout{position:fixed;inset:0;z-index:1000;display:none;align-items:center;justify-content:center;padding:24px;background:#160d04}' +
      'body.locked>*:not(#lockout){visibility:hidden}' +
      '.lockcard{max-width:520px;display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center}' +
      '#lockTitle{margin:0;font-size:30px;font-weight:800;color:#f5efe0}' +
      '#lockWhy{margin:0;font-size:15px;line-height:1.5;color:#c8823c}' +
      '#lockLeft{margin:8px 0 0;font-size:24px;font-weight:800;color:#f2c063;font-variant-numeric:tabular-nums}' +
      '#lockNote{margin:0;font-size:15px;line-height:1.5;color:#f5efe0;font-style:italic}' +
      '#lockLeft:empty,#lockUntil:empty,#lockNote:empty{display:none}' +
      '#lockUntil{margin:0;font-size:13px;color:#8a6a3a}' +
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
      '.tungmark{font-size:9px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:#1d1206;background:#f2c063;border-radius:4px;padding:1px 5px;line-height:1.5;flex:0 0 auto}' +
      '.tungimg{width:15px;height:15px;border-radius:3px;object-fit:cover;flex:0 0 auto}' +
      /* the same mark on the rail and in the conversation header, so a DM from
         him is recognisable before the thread is even open */
      '.dmname.tung,#convname.tung{display:flex;align-items:center;gap:6px;color:#f2c063;font-weight:800;min-width:0}' +
      '.dmname.tung .tungname,#convname.tung .tungname{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}' +
      /* the giveaway button under one of his lines in five */
      '.giftbox{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:8px}' +
      '.giftbtn{background:#f2c063;color:#1d1206;font-weight:800;letter-spacing:.02em;padding:8px 14px;border-radius:9px;border:1px solid #f2c063;cursor:pointer}' +
      '.giftbtn:hover:not(:disabled){background:#fff;border-color:#fff}' +
      '.giftbtn:disabled{cursor:default;opacity:.85}' +
      '.giftbtn.taken{background:transparent;color:#8a6a3a;border:1px solid #3a2410;font-weight:600}' +
      '.giftnote{font-size:12px;color:#c8823c;font-style:italic}' +
      /* his giveaway with entries: the prize, the winners, the clock, enter */
      '.rafflebox{margin-top:10px;padding:10px 12px;border:1px solid #7a5a1a;border-radius:10px;background:rgba(242,192,99,.06);display:flex;flex-direction:column;gap:8px;max-width:560px}' +
      '.raffletop{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}' +
      '.raffleprize{font-size:18px;font-weight:800;color:#f2c063;font-style:normal}' +
      '.rafflewin{font-size:12px;color:#c8823c;font-style:normal}' +
      '.rafflebot{display:flex;align-items:center;gap:10px;flex-wrap:wrap}' +
      '.raffleleft{font-size:12px;color:#e9d9c2;font-style:normal;font-variant-numeric:tabular-nums}' +
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
      /* how long a spin takes is set on the <svg> at spin time, not baked in
         here, because the lightning button changes it. the defaults are the
         unhurried ones; turbo sets these properties to something much shorter. */
      '.wheel{transition:transform var(--spin,7s) cubic-bezier(.15,.85,.2,1)}' +
      /* the ball orbits the other way and settles a touch before the wheel stops.
         .ballhop (nested) drops into the pocket with a few bounces at the end,
         wobbling a pocket or two as it finds its rest. */
      '.ball{transition:transform var(--ballspin,6.5s) cubic-bezier(.12,.78,.18,1)}' +
      '.ballhop{transform-box:view-box}' +
      '.ball.dropping .ballhop{animation:ballDrop var(--ballspin,6.5s) both}' +
      '@keyframes ballDrop{' +
      '0%,58%{transform:rotate(0deg) translateY(0)}' +
      '68%{transform:rotate(-22deg) translateY(22px)}' +
      '76%{transform:rotate(14deg) translateY(5px)}' +
      '84%{transform:rotate(-10deg) translateY(18px)}' +
      '91%{transform:rotate(5deg) translateY(8px)}' +
      '100%{transform:rotate(0deg) translateY(16px)}}' +
      /* ---- the felt ----
         The old board was a bare 12-wide grid of numbers with 36 orphaned on a
         row of its own, and under it a dozen identical brown pills that told you
         nothing about what they paid or where they sat. This is the real layout
         instead: zero down the left, the numbers in the three rows a table
         actually uses, and every outside bet touching the numbers it covers —
         the column boxes at the end of their own row, each dozen spanning its
         twelve, the even-money bets two columns apiece along the bottom. It
         means the felt explains the bet, which is the whole point of a felt.
         14 columns: zero, the twelve number columns, the 2:1 boxes. */
      '.rtable{display:grid;grid-template-columns:1.15fr repeat(12,1fr) 1.3fr;gap:3px;margin-top:10px}' +
      '.rtable > *{display:flex;flex-direction:column;align-items:center;justify-content:center;' +
      'gap:1px;border-radius:5px;border:1px solid transparent;cursor:pointer;color:#fff;' +
      'font-weight:800;text-align:center;line-height:1.05;min-width:0;overflow:hidden}' +
      '.rtable > *:hover{filter:brightness(1.2)}' +
      /* the payout, small and quiet, on every chip — so nobody has to know that
         a corner of a roulette table pays 2:1 to find out that it does */
      '.rtable .pay{font-size:9px;font-weight:700;opacity:.6;letter-spacing:.03em}' +
      '.rnum{aspect-ratio:1;font-size:clamp(9px,1.9vw,13px)}' +
      '.rnum.red{background:#a32020}.rnum.black{background:#23232b}' +
      '.rzero{grid-area:1/1/4/2;background:#1f6b32;font-size:clamp(12px,2.4vw,18px)}' +
      '.rcol{background:#241505;border-color:#3a2410;color:#f2c063;font-size:clamp(9px,1.6vw,11px)}' +
      '.rdozen,.reven{background:#241505;border-color:#3a2410;color:#f5efe0;' +
      'padding:9px 3px;font-size:clamp(9px,1.7vw,12px)}' +
      /* red and black are told apart by being red and black, the way they are on
         a table, rather than by being two more identical brown pills */
      '.rdiam{width:11px;height:11px;border-radius:2px;transform:rotate(45deg);margin-bottom:2px}' +
      '.rdiam.red{background:#c92b2b}' +
      '.rdiam.black{background:#2b2b34;box-shadow:0 0 0 1px #ffffff70}' +
      '.rtable .sel{border-color:#f2c063;box-shadow:0 0 0 2px #f2c063 inset}' +
      /* what you are about to put money on, said once, in words */
      '.rpick{display:flex;align-items:center;justify-content:center;gap:8px;margin-top:10px;' +
      'padding:9px 12px;border-radius:9px;background:#241505;border:1px solid #3a2410;font-size:13px;color:#c8823c}' +
      '.rpick b{color:#f2c063;font-weight:800}' +
      '.rpick .pay{font-size:11px;font-weight:700;color:#8a6a3a;letter-spacing:.03em;opacity:1}' +
      /* the lightning button: every table that animates gets one, and it is the
         same setting on all of them (see TURBO in casino.js) */
      '.boltbtn{margin-left:auto;display:inline-flex;align-items:center;gap:5px;flex:0 0 auto;' +
      'padding:5px 11px;border-radius:999px;background:#241505;border:1px solid #3a2410;' +
      'color:#8a6a3a;font-size:11px;font-weight:800;cursor:pointer;letter-spacing:.05em;text-transform:uppercase}' +
      '.boltbtn:hover{border-color:#c8823c;color:#c8823c}' +
      '.boltbtn.on{background:#f2c063;border-color:#f2c063;color:#1d1206}' +
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
      /* the poker table. Five seats have to fit a phone, so a seat is a narrow
         card that wraps rather than a place around an oval — the oval is the
         first thing to break at 380px and it buys nothing a stack and a bet
         do not already say. */
      '.pkhead{display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;color:#8a6a3a}' +
      '.pkblind{font-size:17px;font-weight:800;color:#f2c063;font-variant-numeric:tabular-nums}' +
      '.pklvl,.pkhand{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase}' +
      '.pkup{font-size:11px;color:#c8823c;font-variant-numeric:tabular-nums}' +
      /* the table itself: an oval of felt inside a wooden rail, with the seats
         set around its rim by angle rather than laid out in a row. The player
         looking at it is always at the bottom. */
      '.pkstage{position:relative;width:100%;max-width:880px;aspect-ratio:1/.6;margin:0 auto}' +
      /* a phone column cannot carry a two-to-one table: the board and the
         seat under it end up in the same forty pixels, so below this the
         oval goes rounder and the casino.js radii follow at the same width */
      '@media (max-width:699px){.pkstage{max-width:470px;aspect-ratio:1/.86}' +
      '.pkfelt{top:15%;bottom:15%}}' +
      '.pkfelt{position:absolute;left:3%;right:3%;top:13%;bottom:13%;border-radius:50%;' +
      'background:radial-gradient(120% 120% at 50% 32%,#2f5d3f 0%,#23472f 45%,#183121 100%);' +
      'border:7px solid #3a2410;box-shadow:inset 0 0 26px #0009,0 10px 26px #0007,0 0 0 2px #241505}' +
      '.pkmid{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;gap:4px;z-index:1}' +
      '.pkboard{display:flex;justify-content:center;gap:clamp(3px,1.1vw,5px)}' +
      '.pkboard .pcard{width:clamp(25px,7.2vw,34px);height:clamp(35px,10.1vw,48px)}' +
      '.pkboard .pcface{font-size:clamp(10px,2.9vw,14px);border-radius:4px;box-shadow:0 3px 8px #0007}' +
      '.pkslot{width:clamp(25px,7.2vw,34px);height:clamp(35px,10.1vw,48px);border:1px dashed #ffffff26;border-radius:5px;background:#ffffff08}' +
      '.pkpot{font-size:clamp(15px,4.4vw,20px);font-weight:800;color:#f7e6b8;font-variant-numeric:tabular-nums;text-shadow:0 2px 4px #0009;line-height:1}' +
      '.pkpotlab{font-size:10px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#ffffff66}' +
      /* a seat straddles the rim, its cards above its name plate */
      '.pkseat{position:absolute;transform:translate(-50%,-50%);width:clamp(62px,17.5vw,82px);' +
      'display:flex;flex-direction:column;align-items:center;gap:3px;z-index:2}' +
      '.pkseat.folded{opacity:.42}' +
      '.pkseat.out{opacity:.26}' +
      '.pkplate{width:100%;background:#241505;border:1px solid #3a2410;border-radius:9px;padding:4px 5px;text-align:center;box-shadow:0 3px 9px #0007}' +
      '.pkseat.you .pkplate{border-color:#c8823c}' +
      '.pkseat.turn .pkplate{border-color:#f2c063;box-shadow:0 0 0 2px #f2c06355,0 3px 9px #0007}' +
      '.pkname{display:flex;align-items:center;justify-content:center;gap:4px;font-size:11px;font-weight:700;color:#f5efe0;line-height:1.2}' +
      '.pkwho{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:58px}' +
      '.pkdealer{flex:0 0 auto;width:14px;height:14px;border-radius:50%;background:#c8823c;color:#1d1206;font-size:9px;font-weight:800;line-height:14px}' +
      '.pkstack{font-size:13px;font-weight:800;color:#f2c063;font-variant-numeric:tabular-nums;line-height:1.3}' +
      '.pktag{font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#c8823c}' +
      '.pkmade{position:absolute;left:50%;bottom:-7px;transform:translateX(-50%);z-index:3;' +
      'background:#a33a2e;color:#fff;font-size:9px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;' +
      'padding:1px 7px;border-radius:999px;white-space:nowrap;box-shadow:0 2px 6px #0009}' +
      '.pkhole{position:relative;display:flex;justify-content:center;gap:3px;min-height:1px}' +
      '.pkhole .pcard{width:clamp(22px,6.4vw,30px);height:clamp(31px,9vw,42px)}' +
      '.pkhole .pcface{font-size:clamp(9px,2.6vw,13px);border-radius:4px;box-shadow:0 2px 6px #0008}' +
      /* your own two are dealt bigger, the way they are on every table */
      '.pkseat.you .pkhole .pcard{width:clamp(30px,8.6vw,40px);height:clamp(42px,12vw,56px)}' +
      '.pkseat.you .pkhole .pcface{font-size:clamp(12px,3.4vw,17px);border-radius:5px}' +
      '.pkseat.you{width:clamp(78px,23vw,104px)}' +
      '.pkseat.you .pkwho{max-width:74px}' +
      /* what somebody has pushed out this street, between them and the pot */
      /* the table is nearly twice the size on a desktop, so what sits on it
         grows too rather than rattling around in the middle of it */
      '@media (min-width:700px){' +
      '.pkboard{gap:7px}' +
      '.pkboard .pcard,.pkslot{width:46px;height:64px}' +
      '.pkboard .pcface{font-size:19px;border-radius:6px}' +
      '.pkpot{font-size:26px}' +
      '.pkseat{width:108px}' + '.pkseat.you{width:132px}' +
      '.pkwho{max-width:76px}' + '.pkseat.you .pkwho{max-width:100px}' +
      '.pkhole .pcard{width:34px;height:48px}' +
      '.pkhole .pcface{font-size:14px;border-radius:5px}' +
      '.pkseat.you .pkhole .pcard{width:48px;height:67px}' +
      '.pkseat.you .pkhole .pcface{font-size:20px;border-radius:6px}' +
      '.pkname{font-size:12px}' + '.pkstack{font-size:15px}' +
      /* the row of decisions belongs to the table above it, so it grows with
         it rather than sitting in a narrow strip under a wide oval */
      '.pkbar,.pkbet{max-width:620px}' + '.pkact{min-height:58px}' +
      '.pkactlab{font-size:14px}' +
      '.pkchip{font-size:11px;padding:2px 8px}' +
      '}' +
      '.pkchip{position:absolute;transform:translate(-50%,-50%);z-index:1;' +
      'font-size:9px;font-weight:800;font-variant-numeric:tabular-nums;color:#1d1206;' +
      'background:#e8c07a;border:2px solid #b8873c;border-radius:999px;padding:1px 5px;box-shadow:0 2px 6px #0008}' +
      /* a card only performs its deal once; after that it is simply there */
      '.pcard.still .pcinner{animation:none}' +
      '.pcard.still .pcfront{animation:none;opacity:1}' +
      '.pcard.still .pcback{animation:none;opacity:0}' +
      '.pcard.still.hole .pcfront{opacity:0}' +
      '.pcard.still.hole .pcback{opacity:1}' +
      /* One row of decisions across the bottom, the way every table does it:
         what it costs to stay, what it costs to push, the free one, the way
         out — each carrying the key that presses it. The one that does not
         apply is dimmed rather than removed, so the row never reshuffles
         under a finger already on its way down. */
      '.pkbar{display:flex;gap:7px;width:100%;max-width:470px;margin:0 auto}' +
      '.pkact{position:relative;flex:1 1 0;min-width:0;min-height:52px;display:flex;align-items:center;justify-content:center;' +
      'background:#1a1008;border:2px solid #3a2410;border-radius:10px;cursor:pointer;padding:10px 4px}' +
      '.pkactlab{font-size:13px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:#f5efe0;white-space:nowrap}' +
      '.pkactkey{position:absolute;top:2px;right:6px;font-size:9px;font-weight:700;color:#8a6a3a;text-transform:uppercase}' +
      '.pkact.call,.pkact.check,.pkact.raise{border-color:#2f7d4f}' +
      '.pkact.call .pkactlab,.pkact.check .pkactlab,.pkact.raise .pkactlab{color:#5fd08a}' +
      '.pkact.fold{border-color:#a33a2e}' +
      '.pkact.fold .pkactlab{color:#e0736a}' +
      '.pkact.bet{background:#2f9d5f;border-color:#2f9d5f}' +
      '.pkact.bet .pkactlab{color:#0b2413}' +
      '.pkact.off{opacity:.3;cursor:default}' +
      '.pkact:not(.off):hover{filter:brightness(1.2)}' +
      /* the raise panel, which takes the bar's place rather than sitting under
         it: while you are picking a number, the number is the only decision */
      /* ---- chess ----
         The board is a square grid that gives up its width before the side
         panel does, so on a narrow screen the moves go under it rather than
         the board shrinking to a postage stamp. */
      '.chwrap{display:flex;gap:16px;align-items:flex-start;justify-content:center;flex-wrap:wrap;width:100%}' +
      /* ROWS as well as columns, or a rank with pieces on it is taller than an
         empty one and the board comes out lopsided */
      '.chboard{display:grid;grid-template-columns:repeat(8,1fr);grid-template-rows:repeat(8,1fr);' +
      'width:min(72vh,440px);aspect-ratio:1;touch-action:none;user-select:none;' +
      'border:2px solid #3a2410;border-radius:4px;overflow:hidden;flex:0 0 auto}' +
      /* An 8x8 grid of pointer cursors says everything on the board is worth
         clicking, when on most of it nothing happens at all. The cursor only
         offers something where there IS something: a piece you could pick up
         (.pick, which chessPaint puts only on squares the server listed a move
         from — so never on their turn and never on their pieces), a square the
         piece in hand could go to (.go/.take), and the closed hand while one is
         actually being carried. Everywhere else is an ordinary arrow. */
      '.chsq{position:relative;padding:0;border:0;border-radius:0;display:flex;align-items:center;' +
      'justify-content:center;cursor:default}' +
      '.chsq.pick{cursor:grab}' +
      '.chsq.go,.chsq.take{cursor:pointer}' +
      '.chboard.held,.chboard.held .chsq{cursor:grabbing}' +
      '.chsq.lt{background:#e8d3ae}' + '.chsq.dk{background:#a97a4c}' +
      /* One glyph set for both sides — the solid one — coloured and outlined,
         which is how a real board draws them. The outline glyphs for white
         against the solid ones for black read as text, not as pieces. */
      '.chp{width:100%;height:100%;display:flex;align-items:center;justify-content:center;' +
      'font-size:min(7.4vh,45px);line-height:1;pointer-events:none;user-select:none}' +
      '.chp.w{color:#fffdf8;-webkit-text-stroke:1.6px #2b2018;text-shadow:0 1.5px 1.5px rgba(0,0,0,.30)}' +
      '.chp.b{color:#2b2018;-webkit-text-stroke:1.2px #16100b;text-shadow:0 1.5px 1.5px rgba(0,0,0,.25)}' +
      /* a real piece set: the image fills the square and takes none of the
         glyph's type styling with it */
      '.chp.img{width:100%;height:100%;object-fit:contain;-webkit-text-stroke:0;text-shadow:none;display:block}' +
      '.chdrag .chp.img{width:100%;height:100%}' +
      '.chsq.last{background:rgba(205,210,106,.62)}' + '.chsq.last.dk{background:rgba(170,178,74,.72)}' +
      '.chsq.from{background:rgba(242,192,99,.78)}' + '.chsq.from.dk{background:rgba(214,161,66,.85)}' +
      '.chsq.chk{background:radial-gradient(circle,rgba(255,80,60,.95) 0%,rgba(255,80,60,.75) 32%,rgba(255,60,40,0) 72%)}' +
      /* somewhere you could go: a dot on an empty square, a ring round a piece */
      '.chsq.go::after{content:"";position:absolute;width:30%;height:30%;border-radius:50%;background:rgba(20,14,8,.26);pointer-events:none}' +
      '.chsq.take::after{content:"";position:absolute;inset:0;border-radius:50%;border:6px solid rgba(20,14,8,.26);pointer-events:none}' +
      '.chsq.over{box-shadow:inset 0 0 0 4px rgba(255,255,255,.65)}' +
      '.chdrag{position:fixed;z-index:80;pointer-events:none;display:flex;align-items:center;' +
      'justify-content:center;line-height:1;will-change:transform}' +
      '.chrk,.chfl{position:absolute;font-size:10px;font-weight:700;pointer-events:none;opacity:.7}' +
      '.chrk{top:1px;left:3px}' + '.chfl{bottom:0;right:3px}' +
      '.chsq.lt .chrk,.chsq.lt .chfl{color:#a97a4c}' +
      '.chsq.dk .chrk,.chsq.dk .chfl{color:#e8d3ae}' +
      '.chside{flex:1 1 190px;min-width:180px;max-width:280px;display:flex;flex-direction:column;gap:9px}' +
      /* the draw offer and the two buttons are built once as empty slots so the
         order down the panel is fixed; display:contents keeps an empty one from
         spending one of the column's 9px gaps on nothing */
      '.chslot{display:contents}' +
      '.chwho{display:flex;align-items:center;gap:8px}' +
      '.chdot{width:11px;height:11px;border-radius:50%;border:1px solid #3a2410;flex:0 0 auto}' +
      '.chdot.w{background:#fffaf0}' + '.chdot.b{background:#241505}' +
      '.chname{font-weight:700;font-size:13px;color:#f5efe0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      /* the clock. Dim until it is your turn, and it goes red in the last ten
         seconds, which is when it stops being furniture and starts being the
         only thing on the screen. */
      '.chclock{margin-left:auto;flex:0 0 auto;font-variant-numeric:tabular-nums;font-weight:800;' +
      'font-size:17px;letter-spacing:.02em;padding:3px 10px;border-radius:7px;' +
      'background:#1a1008;border:1px solid #3a2410;color:#8a6a3a;min-width:66px;text-align:center}' +
      '.chclock.on{background:#e8d3ae;border-color:#e8d3ae;color:#241505}' +
      '.chclock.low{color:#f2c063}' + '.chclock.on.low{background:#c8823c;border-color:#c8823c;color:#1d1206}' +
      '.chclock.out{background:#7a2b1e;border-color:#7a2b1e;color:#fff}' +
      '.chstate{font-size:12px;color:#c8823c;font-weight:700}' +
      '.chstate.check{color:#f2c063}' + '.chstate.over{color:#f5efe0}' +
      '.chmoves{flex:1;min-height:0;max-height:210px;overflow-y:auto;background:#1a1008;border:1px solid #3a2410;' +
      'border-radius:8px;padding:7px 9px;font-size:12px;font-variant-numeric:tabular-nums}' +
      '.chmvrow{display:grid;grid-template-columns:28px 1fr 1fr;gap:4px}' +
      '.chmvn{color:#8a6a3a}' + '.chmv{color:#f5efe0}' +
      '.choffer{display:flex;align-items:center;gap:7px;flex-wrap:wrap;font-size:12px;color:#f2c063}' +
      '.chacts{display:flex;gap:7px}' + '.chacts .cbtn{flex:1;padding:8px 10px;font-size:12px}' +
      /* the promotion picker sits over everything, because the move is not sent
         until it has been answered */
      '.chpromo{position:fixed;inset:0;margin:auto;height:max-content;width:max-content;z-index:60;display:flex;gap:8px;' +
      'align-items:center;background:#241505;border:1px solid #8a5a28;border-radius:12px;padding:12px}' +
      '.chpbtn{font-size:34px;line-height:1;padding:4px 10px;border-radius:8px;border:1px solid #3a2410;' +
      'background:#e8d3ae;cursor:pointer}' +
      '.chpbtn.w{color:#fffdf8;-webkit-text-stroke:1.6px #2b2018}' +
      '.chpbtn.b{color:#2b2018;-webkit-text-stroke:1.2px #16100b}' +
      '.chpbtn:hover{background:#f2c063}' +
      '@media (max-width:620px){.chboard{width:min(92vw,440px)}}' +
      '.pkbet{display:flex;flex-direction:column;gap:7px;width:100%;max-width:470px;margin:0 auto}' +
      '.pkbetval{display:flex;align-items:center;gap:8px;background:#1a1008;border:1px solid #3a2410;border-radius:10px;padding:7px 11px}' +
      '.pkbetlab{font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#8a6a3a;flex:0 0 auto}' +
      '.pkbetnum{flex:1;min-width:0;background:transparent;border:0;color:#f2c063;font-size:23px;font-weight:800;' +
      'text-align:right;font-variant-numeric:tabular-nums;padding:0;-moz-appearance:textfield}' +
      '.pkbetnum::-webkit-outer-spin-button,.pkbetnum::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}' +
      '.pkbetbb{flex:0 0 auto;font-size:11px;font-weight:700;color:#c8823c;min-width:46px;text-align:right}' +
      /* the least this spot will take, under the box rather than inside it —
         it is a fact about the table, not part of the number being chosen */
      '.pkminrow{display:flex;align-items:center;gap:7px;padding:0 3px;font-size:11px}' +
      '.pkminlab{font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#8a6a3a}' +
      '.pkminval{flex:1;min-width:0;font-weight:800;color:#c8823c;font-variant-numeric:tabular-nums}' +
      '.pkpre-row{display:flex;gap:5px}' +
      '.pkchipbtn{flex:1 1 0;min-width:0;padding:8px 2px;background:#241505;border:1px solid #3a2410;border-radius:8px;' +
      'color:#f5efe0;font-size:10px;font-weight:800;letter-spacing:.03em;cursor:pointer;white-space:nowrap}' +
      '.pkchipbtn:hover{background:#3a2410}' +
      '.pkslidrow{display:flex;align-items:center;gap:8px}' +
      '.pkstep{flex:0 0 auto;width:40px;height:34px;background:#241505;border:1px solid #3a2410;border-radius:8px;' +
      'color:#f2c063;font-size:17px;font-weight:800;cursor:pointer;line-height:1}' +
      '.pkslide{flex:1;min-width:0;accent-color:#c8823c;height:26px}' +
      '.pkbetgo{display:flex;gap:7px}' +
      /* ---- the raise panel, on a screen with room across rather than down ----
         Stacked it is five rows and about 230px: four times the height of the
         action bar it replaces, under a table that already fills a laptop
         window. So pressing RAISE pushed the one button the panel exists for
         off the bottom of the screen, and confirming a raise meant going to
         look for it with a clock running. A phone column has nowhere to put
         those rows except under each other. A desktop window has width going
         spare, so across they go: the amount and its minimum down the left, the
         shortcuts and the slider in the middle, BACK and BET full-height down
         the right. Two rows, about ninety pixels — near enough what the bar it
         replaces took, so opening it barely moves the table at all.

         This sits AFTER the rules it overrides on purpose. @media adds no
         specificity of its own, so the desktop block further up loses to any
         base rule of the same weight that is written below it. */
      '@media (min-width:700px){' +
      '.pkbet{display:grid;max-width:780px;' +
      'grid-template-columns:minmax(190px,1fr) minmax(220px,1.25fr) 168px;' +
      'grid-template-areas:"val pre go" "min sld go";' +
      'align-items:center;column-gap:12px;row-gap:7px}' +
      '.pkbetval{grid-area:val;padding:5px 11px}' +
      '.pkminrow{grid-area:min}' +
      '.pkpre-row{grid-area:pre}' +
      '.pkslidrow{grid-area:sld}' +
      /* the two that matter take the whole height of the block, which is a far
         easier thing to put a pointer on than a 52px strip */
      '.pkbetgo{grid-area:go;align-self:stretch}' +
      '.pkbetgo .pkact{min-height:0}' +
      '.pkstep{height:32px}' + '.pkslide{height:24px}' +
      '}' +
      /* the pre-action: a tick box, because it sets what will happen rather
         than doing anything now, and a mark beside it that says so */
      '.pkprerow{display:flex;align-items:center;justify-content:center;gap:8px}' +
      '.pkprebox{display:inline-flex;align-items:center;gap:8px;cursor:pointer;user-select:none;' +
      'padding:7px 13px;border-radius:9px;background:#1a1008;border:1px solid #3a2410}' +
      '.pkprebox:hover{border-color:#7a5a1a}' +
      '.pkprebox.on{border-color:#c8823c;background:#241505}' +
      '.pkprecb{flex:0 0 auto;width:15px;height:15px;margin:0;accent-color:#c8823c;cursor:pointer}' +
      '.pkprelab{font-size:12px;font-weight:700;letter-spacing:.02em;color:#c8823c;white-space:nowrap}' +
      '.pkprebox.on .pkprelab{color:#f2c063}' +
      '.pkhelp{position:relative;flex:0 0 auto;cursor:help;outline:none}' +
      '.pkhelpq{display:flex;align-items:center;justify-content:center;width:17px;height:17px;' +
      'border-radius:50%;border:1px solid #7a5a1a;color:#c8823c;font-size:11px;font-weight:800;line-height:1}' +
      '.pkhelp:hover .pkhelpq,.pkhelp:focus .pkhelpq{background:#c8823c;color:#1d1206;border-color:#c8823c}' +
      '.pkhelptip{display:none;position:absolute;bottom:26px;left:50%;transform:translateX(-50%);' +
      'width:min(262px,78vw);padding:9px 11px;border-radius:9px;background:#1a1008;border:1px solid #7a5a1a;' +
      'color:#f5efe0;font-size:11px;font-weight:500;line-height:1.5;text-align:left;z-index:9;' +
      'box-shadow:0 8px 22px #000a}' +
      '.pkhelp:hover .pkhelptip,.pkhelp:focus .pkhelptip{display:block}' +
      '.pkshow{display:flex;flex-direction:column;gap:6px;width:100%;max-width:420px}' +
      '.pkshowrow{display:flex;align-items:center;gap:8px;background:#241505;border:1px solid #3a2410;border-radius:10px;padding:6px 10px}' +
      '.pkshowrow.won{border-color:#c8823c}' +
      '.pkshowname{flex:0 0 auto;font-size:12px;font-weight:700;color:#f5efe0;max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.pkshowcards{display:flex;gap:3px}' +
      '.pkshowcards .pcard{width:26px;height:36px}' +
      '.pkshowcards .pcface{font-size:11px;border-radius:5px}' +
      '.pkshowhand{flex:1;text-align:right;font-size:11px;color:#c8823c}' +
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
      /* ---- table talk: the little chat inside a round ---- */
      /* ---- the bank: the altar next door, with a counter in it ---- */
      '.godimg.lender{max-height:210px;border-radius:12px}' +
      '.bankstat{display:flex;justify-content:center;gap:10px;flex-wrap:wrap;margin:14px 0 4px}' +
      '.bcell{display:flex;flex-direction:column;align-items:center;gap:2px;min-width:104px;' +
      'padding:8px 12px;border:1px solid #3a2410;border-radius:10px;background:#160d04}' +
      '.bcell b{font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#8a6a3a}' +
      '.bcell span{font-size:18px;font-weight:800;color:#f2c063;font-variant-numeric:tabular-nums}' +
      '.bcell.hot{border-color:#7a2e2e}' +
      '.bcell.hot span{color:#e0908a}' +
      /* flex-end, the same as .ctlrow: a .ctl is a label stacked over its
         control, so without it the button stretches and sits off the input's
         baseline instead of level with it */
      '.bankctl{display:flex;justify-content:center;gap:10px;flex-wrap:wrap;align-items:flex-end;margin-top:6px}' +
      '#winpop .wnote{display:block;font-size:13px;font-weight:700;color:#e0908a;margin-top:2px}' +
      '.talkbox{display:flex;flex-direction:column;gap:8px;width:100%;max-width:560px;margin:0 auto}' +
      '.tklog{min-height:84px;max-height:150px;overflow-y:auto;display:flex;flex-direction:column;gap:4px;' +
      'padding:8px 10px;border:1px solid #3a2410;border-radius:10px;background:#160d04;text-align:left}' +
      '.tkline{font-size:13px;line-height:1.35;word-break:break-word}' +
      '.tkline b{color:#c8823c;font-weight:700;margin-right:6px}' +
      '.tkform{display:flex;gap:8px}' +
      '.tkin{flex:1;min-width:0;padding:8px 10px;border-radius:8px;border:1px solid #3a2410;' +
      'background:#160d04;color:#f5efe0;font-family:inherit;font-size:14px}' +
      '.talkdrawer{flex-basis:100%;margin-top:8px}' +
      /* ---- the same box, on a poker table ----
         A round button in the corner of the screen, and the log above it
         when it is open. It used to sit in the header, where every button is
         a wide one, so it drew as a long bar beside the hand number. Fixed,
         so it never takes a row, and the log never takes one either. */
      '.pkdock{position:fixed;right:16px;bottom:16px;z-index:70;display:flex;flex-direction:column;' +
      'align-items:flex-end;gap:8px;pointer-events:none}' +
      '.pkdock>*{pointer-events:auto}' +
      '.pktalkbtn{position:relative;width:46px;height:46px;min-width:46px;padding:0;margin:0;border-radius:50%;' +
      'border:1px solid #7a5a1a;background:#241505;color:#f2c063;font-size:18px;line-height:1;cursor:pointer;' +
      'display:flex;align-items:center;justify-content:center;box-shadow:0 8px 22px #000a;flex:0 0 auto}' +
      '.pktalkbtn:hover{border-color:#c8823c;background:#3a2410}' +
      '.pktalkbtn.on{background:#c8823c;border-color:#c8823c;color:#1d1206}' +
      '.pktalkbtn.hot{border-color:#f2c063;color:#f2c063}' +
      '.pktalkface{pointer-events:none;line-height:1}' +
      '.pkbadge{display:none;position:absolute;top:-3px;right:-3px;min-width:16px;height:16px;padding:0 4px;' +
      'box-sizing:border-box;border-radius:999px;background:#f2c063;color:#1d1206;font-size:10px;font-weight:800;' +
      'line-height:16px;text-align:center}' +
      '.pktalk{position:relative;width:min(320px,calc(100vw - 32px));background:#1d1206;border:1px solid #3a2410;' +
      'border-radius:12px;padding:10px;box-shadow:0 12px 34px #000a}' +
      '.pktalk .talkbox{max-width:none}' +
      '@media (max-width:620px){.pkdock{left:16px;right:16px}.pktalk{width:auto;align-self:stretch}}' +
      /* a live table fits the window it is open in. Below the poker breakpoint
         the column still scrolls, because a phone has no width to give the
         oval. From there up, the felt takes whatever height the buttons leave
         and the page itself does not move. */
      '.pkfit{width:100%}' +
      '@media (min-width:700px){' +
      '#casscreen.pkpage{position:relative;overflow:hidden;padding:8px 16px 12px;gap:0;min-height:0}' +
      '#casscreen.pkpage .caswrap{flex:1;min-height:0;max-width:1120px;display:grid;' +
      'grid-template-columns:auto auto minmax(0,1fr) auto;' +
      'grid-template-rows:auto minmax(0,1fr) auto;' +
      'grid-template-areas:"back title pot clock" "body body body body" "note note note note";' +
      'align-items:center;column-gap:12px;row-gap:6px}' +
      '#casscreen.pkpage .casback{grid-area:back;padding:4px 10px;font-size:12px}' +
      '#casscreen.pkpage .casview{display:contents}' +
      '#casscreen.pkpage .casview h3{grid-area:title;font-size:15px;white-space:nowrap}' +
      '#casscreen.pkpage .pitpot{grid-area:pot;font-size:12px;line-height:1.2;overflow:hidden;' +
      'text-overflow:ellipsis;white-space:nowrap}' +
      '#casscreen.pkpage .pitclock{grid-area:clock;font-size:22px;min-height:0;line-height:1;text-align:right}' +
      '#casscreen.pkpage .pitclock:empty{display:none}' +
      '#casscreen.pkpage .casres{grid-area:note}' +
      '#casscreen.pkpage .casres:empty{display:none}' +
      '#casscreen.pkpage .pitbody{grid-area:body;min-height:0;width:100%;gap:8px;align-self:stretch;overflow:hidden}' +
      '#casscreen.pkpage .pkhead{flex-wrap:nowrap;gap:8px}' +
      '#casscreen.pkpage .pitbody .pitsub{max-width:none;line-height:1.3}' +
      '#casscreen.pkpage .pkfit{flex:1 1 auto;min-height:0;width:100%;display:flex;flex-direction:column;' +
      'justify-content:flex-end;align-items:center;gap:8px;container-type:size}' +
      '#casscreen.pkpage .pkstage{container-type:size;margin:0;max-width:none;aspect-ratio:auto;' +
      'width:min(980px,calc(100cqw - 120px),calc((100cqh - 40px) / 0.56));' +
      'height:min(560px,calc(100cqh - 40px),calc((100cqw - 120px) * 0.56))}' +
      '#casscreen.pkpage .pkboard .pcard,#casscreen.pkpage .pkslot{width:clamp(30px,5.2cqw,46px);height:clamp(42px,7.3cqw,64px)}' +
      '#casscreen.pkpage .pkboard .pcface{font-size:clamp(12px,2.1cqw,19px)}' +
      '#casscreen.pkpage .pkpot{font-size:clamp(16px,3cqw,26px)}' +
      '#casscreen.pkpage .pkseat{width:clamp(78px,13cqw,108px)}' +
      '#casscreen.pkpage .pkseat.you{width:clamp(96px,16cqw,132px)}' +
      '#casscreen.pkpage .pkwho{max-width:9cqw}' +
      '#casscreen.pkpage .pkseat.you .pkwho{max-width:12cqw}' +
      '#casscreen.pkpage .pkhole .pcard{width:clamp(26px,4cqw,34px);height:clamp(36px,5.6cqw,48px)}' +
      '#casscreen.pkpage .pkhole .pcface{font-size:clamp(11px,1.6cqw,14px)}' +
      '#casscreen.pkpage .pkseat.you .pkhole .pcard{width:clamp(34px,5.4cqw,48px);height:clamp(48px,7.6cqw,67px)}' +
      '#casscreen.pkpage .pkseat.you .pkhole .pcface{font-size:clamp(14px,2.2cqw,20px)}' +
      '#casscreen.pkpage .pkbar{width:min(680px,calc(100% - 108px));max-width:680px}' +
      '#casscreen.pkpage .pkbet{width:min(780px,calc(100% - 80px));max-width:780px}' +
      '#casscreen.pkpage .pkact{min-height:46px;padding:6px 4px}' +
      '}' +
      /* tung at a table is marked the way he is marked in the chat: gold, and
         not part of whatever the skin is doing */
      '.pitvs .pn.tung{color:#f2c063}' +
      '.roundbar .cbtn.sec.hot{background:#c8823c;color:#1d1206}' +
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
      '.swatch.sw-dark{background:linear-gradient(120deg,#161618 0%,#232328 45%,#8b8b96 100%)}';

  /* =====================================================================
     THEME ENGINE — everything above this line is the shrine as built, and
     that IS the wood: it has no theme block of its own because every other
     skin overrides away from it.

     A skin is a PALETTE, not a stylesheet. THEME_RULES below is the one list
     of surfaces a skin repaints, written once with braced token names where
     the colours go, and themeCss() stamps a palette into it and scopes every
     rule to that skin. So adding a theme is a few colours in config.js and
     nothing else: no CSS to write, and no way to miss a surface, because every
     skin is generated from the same list.

     A palette needs three colours: the ground, the ink and the accent. Every
     other token is mixed from those, and any of them can be spelled out when a
     skin wants something specific. Dark Mode pins all of its own, because it
     was hand-picked before this existed and should not shift under it.

     Only colour belongs in here. A theme repaints; it never moves anything.
     ===================================================================== */

  /* "&" is the themed root: "&" alone becomes html[data-theme=id] and "& .x"
     becomes [data-theme=id] .x — data-theme sits ON <html>, so the root needs
     the attribute selector itself and everything else a descendant one. */
  var THEME_RULES =
      '&,& body{background:{bg};color:{text}}' +
      '& #mainhdr{background:{surface};border-bottom-color:{lineSoft}}' +
      '& #hdrShrine small{color:{muted}}' +
      '& .hbtn{background:{raised};border-color:{line};color:{heading}}' +
      '& .hbtn:hover{background:{hover};border-color:{lineMid}}' +
      '& #gate p,& .hint{color:{muted}}' +
      '& .warn{color:{heading}}' +
      '& input,& textarea,& #casino input,& #casino select{background:{inset};border-color:{line};color:{text}}' +
      '& button{background:{solid};color:{solidInk}}' +
      '& button.ghost{background:transparent;color:{textDim};border-color:{line}}' +
      '& .who,& .pemoji,& .casback,& .brokex{background:transparent}' +
      '& #myhash{background:{inset};border-color:{lineSoft};color:{heading}}' +
      '& #f,& #picker,& #replybar{background:{surface};border-color:{lineSoft}}' +
      '& #pick{background:{inset};border-color:{line};color:{text}}' +
      '& .msg{background:{raised}}' +
      '& .msg.me{background:{pressed}}' +
      '& .dmnotice{background:{raised};border-color:{line};color:{heading}}' +
      '& .who{color:{muted}}' +
      '& .msg.me .who,& .who:hover{color:{heading}}' +
      '& .when{color:{lineHot}}' +
      '& .msg.me .when{color:{textDim}}' +
      '& .msg.tung{background:linear-gradient(160deg,{raisedHi},{raisedLo});border-color:#5a4a24;border-left-color:#f2c063}' +
      /* his name stays gold under a skin. the plain `.who` rule is the same
         weight and comes first, which would otherwise wash the mark out */
      '& .who.tung{color:#f2c063}' +
      '& .who.tung:hover{color:#fff}' +
      '& .dmname.tung,& #convname.tung{color:#f2c063}' +
      '& .act,& .chip{background:{inset};border-color:{line};color:{text}}' +
      '& .chip.on{background:{pressed};border-color:{lineMid}}' +
      '& .quote{color:{muted};border-left-color:{lineMid}}' +
      '& .quote b{color:{text}}' +
      '& #rpal{background:{raised};border-color:{line}}' +
      '& #rpal button:hover,& .pemoji:hover{background:{line}}' +
      '& .bigbtn{background:linear-gradient(155deg,{raisedHi2},{bgCore});border-color:{line};color:{text2}}' +
      '& .bigbtn:hover{border-color:{lineHot}}' +
      '& .gearbtn{background:{raised};border-color:{line};color:{textDim}}' +
      '& .gearbtn:hover{border-color:{lineHot};color:{text}}' +
      '& #shrinebar,& #playbar,& #origbar,& #veilbar,& #setbar{background:linear-gradient(180deg,{raisedHi},{surface});border-bottom-color:{lineSoft}}' +
      '& #banView{background:{bgSunk}}' +
      '& #banUntil{color:{muted}}' +
      '& #lockout{background:{bgSunk}}' +
      '& #lockTitle{color:{text}}' +
      '& #lockWhy{color:{muted}}' +
      '& #lockNote{color:{text}}' +
      '& #lockLeft{color:{heading}}' +
      '& #lockUntil{color:{textDim}}' +
      '& .gtile{background:linear-gradient(155deg,{raisedHi},{bgCore});border-color:{line};color:{text}}' +
      '& .gtile:hover{background:linear-gradient(155deg,{hoverHi},{raisedHi});border-color:{lineHot}}' +
      '& #originals,& #veil,& #settings,& #casino{background:radial-gradient(120% 80% at 50% 0%,{bgCore} 0%,{bgEdge} 60%)}' +
      '& #origTitle,& #veilTitle,& #setTitle{color:{heading}}' +
      '& .origlead,& .origtile span,& #veilbody p{color:{muted}}' +
      '& .origtile{background:linear-gradient(155deg,{raisedHi},{inset});border-color:{line};color:{text}}' +
      '& .origtile strong,& #veilbody h2{color:{heading}}' +
      '& .setsec{background:linear-gradient(155deg,{raisedHi},{raisedLo});border-color:{line}}' +
      '& .setsec h3{color:{heading}}' +
      '& .themecard{background:{inset};border-color:{line}}' +
      '& .themecard strong{color:{heading}}' +
      '& .themecard.on{border-color:{lineHot};box-shadow:0 0 0 1px {lineHot} inset}' +
      '& #casbalwrap{background:{inset};border-color:{line}}' +
      '& #casbalwrap b,& #hdrCasino .chtitle{color:{heading}}' +
      '& .casgame{background:linear-gradient(155deg,{raisedHi},{inset});border-color:{line};color:{text}}' +
      '& .casgame:hover{background:{hover};border-color:{lineHot}}' +
      '& .casgame .ci{color:{text2}}' +
      '& .casgame.pvp{border-color:{solid};background:linear-gradient(155deg,{hover},{bgCore})}' +
      '& .casgame.pvp:hover{border-color:{textDim}}' +
      '& .ctlrow,& .pithist .ph{background:{raisedLo};border-color:{line}}' +
      '& .panel{background:linear-gradient(150deg,{raisedHi},{raisedLo});border-color:{line}}' +
      '& .stat,& .cell,& .shopitem,& .pitrow,& .rcol,& .rdozen,& .reven,& .rpick{background:{raised};border-color:{line}}' +
      '& .boltbtn{background:{raised};border-color:{line};color:{textDim}}' +
      '& .boltbtn.on{background:{solid};border-color:{solid};color:{solidInk}}' +
      '& .cell:hover{background:{hover}}' +
      '& .casback{border-color:{line};color:{textDim}}' +
      '& .cbtn{background:{solid};color:{solidInk}}' +
      '& .cbtn.sec{background:{raised};color:{heading};border-color:{line}}' +
      '& .altar{background:radial-gradient(80% 60% at 50% 12%,{hover} 0%,{bgCore} 55%,{sunk} 100%);border-color:{line}}' +
      '& .godimg{border-color:{solid}}' +
      '& .godsub{color:{muted}}' +
      '& #casclaim{background:{solid};color:{solidInk}}' +
      '& .brokebar,& .roundbar,& .pitrow.mine{background:linear-gradient(135deg,{hover},{bgCore});border-color:{lineHot}}' +
      '& .roundbar .rv,& .compscore .cv{color:{text2}}' +
      '& .roundbar .rside.up .rv,& .compscore.fin .cstack.up .cv{color:{text}}' +
      '& .roundbar .rside.down .rv,& .compscore.fin .cstack .cv{color:{lineHot}}' +
      '& .roundbar .rclock{color:{text}}' +
      '& .brokebar h4{color:{text}}' +
      '& .brokebar p,& .pitrow p{color:{muted}}' +
      '& .pitblurb,& .pitpot,& .pitscore .sv,& .pitrow .price{color:{heading}}' +
      /* the poker table, in whatever skin is on. The wood's felt is green
         because a wooden rail round green baize is what a table looks like;
         every other skin repaints it in its own deep tone rather than keeping
         a green that would belong to nothing else on the screen. */
      '& .pkfelt{background:radial-gradient(120% 120% at 50% 32%,{raisedHi} 0%,{sunk} 45%,{bgSunk} 100%);' +
      'border-color:{line};box-shadow:inset 0 0 26px {shadowHard},0 10px 26px {shadow},0 0 0 2px {bgEdge}}' +
      '& .pkplate,& .pkshowrow{background:{raised};border-color:{line}}' +
      '& .pkseat.you .pkplate,& .pkshowrow.won{border-color:{lineHot}}' +
      '& .pkseat.turn .pkplate{border-color:{lineHot};box-shadow:0 0 0 2px {lineHotA33},0 3px 9px {shadow}}' +
      '& .pkname,& .pkshowname{color:{text}}' +
      '& .pkdealer{background:{lineHot};color:{solidInk}}' +
      '& .pkblind,& .pkstack{color:{heading}}' +
      '& .pkpot{color:{text}}' +
      '& .pkhead{color:{muted}}' +
      '& .pkup,& .pktag,& .pkshowhand{color:{textDim}}' +
      '& .pkact,& .pkbetval{background:{sunk};border-color:{line}}' +
      '& .pkactlab{color:{text}}' + '& .pkactkey{color:{muted}}' +
      '& .pkchipbtn,& .pkstep{background:{raised};border-color:{line};color:{heading}}' +
      '& .pkprebox,& .pkhelptip{background:{sunk};border-color:{line}}' +
      '& #dmrail{background:{bgSunk};border-right-color:{lineSoft}}' +
      '& #dmrailhead{color:{muted}}' +
      /* a rail row is a <button>, and `& button` above is an attribute plus an
         element, which outranks the plain `.dmrow` in the base sheet — without
         this every unselected row wears the solid button colour under a skin */
      '& .dmrow{background:transparent}' +
      '& .dmrow:hover{background:{raised}}' +
      '& .dmrow.on{background:{surface};border-color:{line}}' +
      '& .dmname{color:{text}}' + '& .dmrow.unread .dmname{color:{heading}}' +
      '& .dmlast,& .dmempty{color:{muted}}' +
      '& .dmbadge{background:{lineHot};color:{solidInk}}' +
      '& #convhead{background:{surface};border-bottom-color:{lineSoft}}' +
      '& #convname{color:{text}}' + '& #convsub{color:{muted}}' +
      '& #convBlock{background:transparent;border-color:{line};color:{muted}}' +
      '& #convBlock:hover{background:{raised};border-color:{lineHot};color:{heading}}' +
      '& #convBlock.on{border-color:{lineHot};color:{heading}}' +
      '& .pkprebox.on{border-color:{lineHot};background:{raised}}' +
      '& .pkprelab{color:{textDim}}' + '& .pkprebox.on .pkprelab{color:{heading}}' +
      '& .pkprecb{accent-color:{lineHot}}' +
      '& .pkhelpq{border-color:{lineMid};color:{textDim}}' +
      '& .pkhelp:hover .pkhelpq,& .pkhelp:focus .pkhelpq{background:{lineHot};color:{solidInk};border-color:{lineHot}}' +
      '& .pkhelptip{color:{text};border-color:{lineMid}}' +
      '& .pkchipbtn:hover{background:{hover}}' +
      '& .chboard{border-color:{line}}' +
      '& .chside .chname{color:{text}}' +
      '& .chclock{background:{sunk};border-color:{line};color:{muted}}' +
      '& .chclock.on{background:{solid};border-color:{solid};color:{solidInk}}' +
      '& .chclock.low{color:{heading}}' +
      '& .chclock.on.low{background:{lineHot};border-color:{lineHot};color:{solidInk}}' +
      /* .out keeps its red in every skin: a flag is the one thing on this board
         that has to read the same whatever the shrine is painted like */
      '& .chstate{color:{textDim}}' +
      '& .chstate.check{color:{heading}}' + '& .chstate.over{color:{text}}' +
      '& .chmoves{background:{sunk};border-color:{line}}' +
      '& .chmvn{color:{muted}}' + '& .chmv{color:{text}}' +
      '& .chdot{border-color:{line}}' +
      '& .choffer{color:{heading}}' +
      '& .chpromo{background:{surface};border-color:{lineHot}}' +
      '& .pkbetnum,& .pkbetbb{color:{heading}}' + '& .pkbetlab{color:{muted}}' +
      '& .pkminlab{color:{muted}}' + '& .pkminval{color:{heading}}' +
      '& .pkslide{accent-color:{lineHot}}' +
      '& .pkchip{background:{lineHot};border-color:{lineMid};color:{solidInk}}' +
      '& .pitmove{background:linear-gradient(155deg,{hover},{bgCore});border-color:{line};color:{heading}}' +
      '& .pitmove:hover:not(:disabled){border-color:{textDim}}' +
      '& .pitclock{color:{textDim}}' +
      '& .cfighter .cic{background:linear-gradient(155deg,{hover},{bgCore});border-color:{line}}' +
      '& .cfighter .cnm{color:{muted}}' +
      '& .cfighter.cwin .cic{border-color:{textDim};box-shadow:0 0 0 3px {lineHotA20},0 10px 28px {shadow}}' +
      '& .cfighter.cwin .cnm{color:{text}}' +
      '& .cspark{background:radial-gradient(circle,#fff 0%,{textDim} 38%,{lineHotA00} 70%)}' +
      '& .clashsay{color:{heading}}' +
      '& .clashsub{color:{lineHot}}' +
      '& .clashsay.cut{color:{muted}}' +
      '& .cutslot.hot .pcard.hole .pcback{border-color:{lineHot};box-shadow:0 0 18px {lineHotA33}}' +
      '& .cutslot.won .pcard .pcfront{box-shadow:0 0 0 3px {heading},0 10px 30px {shadowHard}}' +
      '& .cutslot.won::after{border-color:{heading}}' +
      '& .ovcard{background:linear-gradient(160deg,{raisedHi},{raisedLo});border-color:{line}}' +
      '& .ovcard h3{color:{heading}}' +
      '& .ovrow{border-top-color:{lineSoft}}' +
      '& .ovrow span{color:{text}}' +
      '& #appThread .tmsg.admin{background:{raised};border-color:{line}}' +
      '& #appThread .tmsg.me{background:{solid};color:{solidInk}}' +
      '& #appThread .twhen{color:{lineHot}}' +
      '& #appThread .tmsg.me .twhen{color:{heading}}' +
      '& .seclabel,& .casnote,& .ctl>span,& .stat b,& .pcell b,& .ovrow b,& .bjlabel,& .bjhtag,& .dscale,& .godnote,& .brokex,& .ovcard .ovsub,& .sethint,& .setlock,& .setfield>span,& .themecard .tnote,& .pitsub,& .pitscore .sl,& .pitpicked .pl,& .pithist .phn,& .pcut b,& .pitvs .pvs,& .roundbar .rtag,& .roundbar .rside b,& .roundbar .rvs,& .compscore .cstack b,& .compscore .cvs,& .origlead{color:{lineHot}}' +
      '& .pithist .phv,& .stat span,& .pcell span{color:{text2}}' +
      '& .pcell.gem span{color:{good}}' +
      '& .tklog{background:{inset};border-color:{line}}' +
      '& .pktalk{background:{raised};border-color:{line}}' +
      '& .pktalkbtn{background:{raised};border-color:{line};color:{heading}}' +
      '& .pktalkbtn.on{background:{lineHot};border-color:{lineHot};color:{solidInk}}' +
      '& .pktalkbtn.hot{border-color:{heading};color:{heading}}' +
      '& .pkbadge{background:{heading};color:{bg}}' +
      '& .tkline b{color:{muted}}' +
      '& .tkin{background:{inset};border-color:{line};color:{text}}' +
      '& .roundbar .cbtn.sec.hot{background:{lineHot};color:{bg}}' +
      '& .bcell{background:{inset};border-color:{line}}' +
      '& .bcell b{color:{muted}}' +
      '& .bcell span{color:{heading}}' +
      '& .bcell.hot{border-color:{lineMid}}';

  /* ---- colour maths: enough to mix two hexes, and no more ---- */
  function hexOf(c){
    var h=String(c||"").trim().replace(/^#/,"");
    if(h.length===3)h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
    if(!/^[0-9a-f]{6}$/i.test(h))return null;
    return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)];
  }
  function hex2(n){var v=Math.max(0,Math.min(255,Math.round(n))).toString(16);return v.length<2?"0"+v:v;}
  /* t=0 is all a, t=1 is all b */
  function mix(a,b,t){
    var x=hexOf(a),y=hexOf(b);
    if(!x||!y)return a;
    return "#"+hex2(x[0]+(y[0]-x[0])*t)+hex2(x[1]+(y[1]-x[1])*t)+hex2(x[2]+(y[2]-x[2])*t);
  }
  /* a hex with an alpha channel, for the few places a skin needs to fade */
  function fade(c,a){var x=hexOf(c);return x?"#"+hex2(x[0])+hex2(x[1])+hex2(x[2])+hex2(a*255):c;}
  /* rough perceived brightness, 0..1 */
  function lum(c){var x=hexOf(c);return x?(0.2126*x[0]+0.7152*x[1]+0.0722*x[2])/255:0;}
  /* An accent is chosen for how it looks, not for how it reads. This is the
     guard on the three-colour promise: if the colour a skin picked sits too
     close to its own ground to be read as text, it is walked toward the ink
     until it clears. A skin that wants the flat accent anyway can still name
     the token outright. */
  function readable(c,bg,ink){
    var gap=Math.abs(lum(c)-lum(bg));
    for(var t=0;t<1&&gap<.30;t+=.1){c=mix(c,ink,.1);gap=Math.abs(lum(c)-lum(bg));}
    return c;
  }

  /* The whole derivation. The fractions ARE the ramp: how far a surface or a
     line sits from the ground, travelling toward the ink. Read top to bottom
     it goes deepest background, through the panels, out to the borders, then
     back down through the text weights. */
  var THEME_MIX = {
    bgSunk:    function(p){return mix(p.bg,"#000000",.25);},
    bgEdge:    function(p){return mix(p.bg,"#000000",.10);},
    bgCore:    function(p){return mix(p.bg,p.text,.06);},
    sunk:      function(p){return mix(p.bg,"#000000",.12);},
    inset:     function(p){return mix(p.bg,p.text,.04);},
    surface:   function(p){return mix(p.bg,p.text,.06);},
    raised:    function(p){return mix(p.bg,p.text,.10);},
    raisedHi:  function(p){return mix(p.bg,p.text,.13);},
    raisedHi2: function(p){return mix(p.bg,p.text,.12);},
    raisedLo:  function(p){return mix(p.bg,p.text,.04);},
    hover:     function(p){return mix(p.bg,p.text,.16);},
    hoverHi:   function(p){return mix(p.bg,p.text,.19);},
    pressed:   function(p){return mix(p.bg,p.text,.22);},
    lineSoft:  function(p){return mix(p.bg,p.text,.08);},
    line:      function(p){return mix(p.bg,p.text,.18);},
    lineMid:   function(p){return mix(p.bg,p.text,.32);},
    lineHot:   function(p){return p.accent?mix(p.accent,p.bg,.40):mix(p.bg,p.text,.48);},
    solid:     function(p){return mix(p.bg,p.text,.28);},
    solidInk:  function(p){return mix(p.text,"#ffffff",.35);},
    /* The text ramp is where the accent actually gets spent. In the wood these
       slots are the orange and the gold — the username, the hints, the section
       headings — so a skin with an accent and nothing else still reads as that
       colour rather than as another grey. A skin that wants grey says so, the
       way Dark Mode does. */
    heading:   function(p){return p.accent?readable(mix(p.accent,"#ffffff",.35),p.bg,p.text):mix(p.text,p.bg,.10);},
    text2:     function(p){return p.accent?mix(p.text,p.accent,.25):mix(p.text,p.bg,.18);},
    textDim:   function(p){return p.accent?readable(mix(p.accent,p.text,.30),p.bg,p.text):mix(p.text,p.bg,.28);},
    muted:     function(p){return p.accent?readable(p.accent,p.bg,p.text):mix(p.text,p.bg,.42);},
    good:      function(p){return "#6ee787";},
    /* the fades, derived so they stay in the skin's own family */
    lineHotA20:function(p){return fade(p.lineHot,.20);},
    lineHotA00:function(p){return fade(p.lineHot,0);},
    lineHotA33:function(p){return fade(p.lineHot,.33);},
    shadow:    function(p){return fade("#000000",.47);},
    shadowHard:function(p){return fade("#000000",.60);}
  };
  /* `accent` is deliberately not in the ramp: it is the one colour a skin is
     actually ABOUT, and blending it into every surface is how a theme turns
     into mud. It is spent where the shrine points at something. */
  function palette(spec){
    var p={},k;
    for(k in spec)if(Object.prototype.hasOwnProperty.call(spec,k))p[k]=spec[k];
    /* order matters: the fades read lineHot, so the ramp fills first */
    for(k in THEME_MIX){
      if(Object.prototype.hasOwnProperty.call(THEME_MIX,k)&&p[k]===undefined)p[k]=THEME_MIX[k](p);
    }
    return p;
  }
  function themeCss(id,spec){
    var p=palette(spec),scope='[data-theme="'+id+'"]';
    return THEME_RULES
      .replace(/\{(\w+)\}/g,function(whole,key){
        /* a token with no colour would paint the word "undefined" across the
           skin; falling back to the ink keeps it readable while it is wrong */
        return p[key]===undefined?p.text:p[key];
      })
      .replace(/&( |,|\{)/g,function(whole,after){
        return (after===" "?scope:"html"+scope)+after;
      });
  }

  /* Every skin in the registry that carries a palette gets a block. The wood
     carries none: it is the base stylesheet above. */
  var SKINS=Shrine.THEMES||[];
  for(var si=0;si<SKINS.length;si++){
    if(SKINS[si]&&SKINS[si].palette)Shrine.CSS+=themeCss(SKINS[si].id,SKINS[si].palette);
  }
  Shrine.themeCss=themeCss;
  Shrine.themePalette=palette;

  /* the in-page in-page player styles were removed — catalog items now open in a
     separate about:blank tab that carries its own header + iframe styles */
})();
