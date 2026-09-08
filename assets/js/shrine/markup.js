/* ==========================================================================
   Shrine of Tung — window markup
   The <body> of the about:blank shrine window. Every view ships in the document
   at once and the chat/casino clients show and hide them: the chooser, the
   shrine chat, the catalog, the originals hub, the web veil, the casino and the
   profile / tip / login-key overlays.
   ========================================================================== */
(function () {
  "use strict";
  var Shrine = (window.Shrine = window.Shrine || {});

  var esc = Shrine.esc;
  var SPADE = Shrine.SPADE;
  var TUNG_IMG = Shrine.TUNG_IMG;
  var TUNGGOD_IMG = Shrine.TUNGGOD_IMG;
  var LBL_CURATED = Shrine.LBL.CURATED;
  var LBL_ORIGINALS = Shrine.LBL.ORIGINALS;
  var LBL_WEB_VEIL = Shrine.LBL.WEB_VEIL;
  var LBL_SEARCH = Shrine.LBL.SEARCH;

  Shrine.body = function () {
    /* one top-level header that swaps identity: the shrine title normally, a
       full casino header (back / title / balance / shop) while in the casino. */
    return '' +
      '<header id="mainhdr">' +
      '<div id="hdrShrine"><span>Shrine of Tung</span><small>hi</small></div>' +
      '<div id="hdrCasino">' +
      '<button id="cback" class="hbtn" type="button">← back</button>' +
      '<div class="chtitle">' + SPADE(18) + '<span>Tung&#8217;s Casino</span></div>' +
      '<div id="casbalwrap" title="your sahur balance"><span id="casbal">0.00</span> <b>sahurs</b></div>' +
      '<button id="shrineBtn" class="hbtn" type="button">⛲ Shrine</button>' +
      '<button id="shopBtn" class="hbtn" type="button">🛒 Shop</button>' +
      '</div>' +
      '</header>' +
      '<div id="choose">' +
      '<h2>enter the shrine</h2>' +
      '<div id="choicerow">' +
      /* chat button: a simple speech-bubble svg above the label */
      '<button id="chooseShrine" class="bigbtn" type="button">' +
      '<svg class="bicon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>' +
      '<span>Shrine of Tung</span></button>' +
      /* play-catalog button: the tung tung tung sahur png above the label */
      '<button id="choosePlay" class="bigbtn ghost" type="button">' +
      '<img class="bimg" src="' + esc(TUNG_IMG) + '" alt="">' +
      '<span>' + LBL_CURATED + '</span></button>' +
      /* casino button: same bigbtn as curated catalog */
      '<button id="chooseCasino" class="bigbtn ghost" type="button">' +
      SPADE(18).replace('<svg viewBox', '<svg class="bicon" viewBox') +
      '<span>Tung’s Casino</span></button>' +
      '<button id="chooseOriginals" class="bigbtn ghost" type="button">' +
      '<img class="bimg" src="' + esc(TUNGGOD_IMG) + '" alt="">' +
      '<span>' + LBL_ORIGINALS + '</span></button>' +
      '<button id="chooseVeil" class="bigbtn ghost" type="button">' +
      '<svg class="bicon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>' +
      '<span>' + LBL_WEB_VEIL + '</span></button>' +
      '</div>' +
      '</div>' +
      '<div id="shrine">' +
      '<div id="shrinebar"><button id="sback" class="ghost" type="button">← back</button><button id="exportKey" class="ghost" type="button">copy login key</button></div>' +
      '<div id="gate">' +
      '<div id="applyView">' +
      '<h2 id="applyTitle">apply to enter</h2>' +
      '<p id="applyDesc">members only. pick a username, then tell tung your real name and how you found the shrine. wait for review.</p>' +
      '<form id="applyForm">' +
      '<input id="gu" autocomplete="off" placeholder="desired username">' +
      '<textarea id="ga" rows="4" placeholder="your application — real name, how you found us, why tung should bless you"></textarea>' +
      '<button id="applyBtn" type="submit">apply</button>' +
      '</form><p class="warn">heads up — your username is permanent. you cannot change it later.</p>' +
      '<div id="loginBox"><p class="hint">already a member? log in with your key.</p>' +
      '<input id="lk" autocomplete="off" placeholder="login key">' +
      '<button id="loginBtn" type="button">log in</button></div></div>' +
      '<div id="pendingView">' +
      '<h2>application pending</h2>' +
      '<p>tung is reviewing your submission.</p>' +
      '<p class="hint">save this key — it is your login for the embedded chat and other devices. keep it secret.</p>' +
      '<code id="myhash"></code>' +
      '<p class="hint">once youre approved, reload the site and reopen the shrine.</p>' +
      '<div id="appThread"></div>' +
      '<div id="respBox"><textarea id="respText" rows="2" placeholder="reply to tung..."></textarea><button id="respBtn" type="button">send reply</button></div>' +
      '<div class="row"><button id="copyHash" type="button">copy key</button><button id="recheckBtn" type="button">check access</button></div>' +
      '</div></div>' +
      '<div id="chat">' +
      '<div id="log"></div>' +
      '<div id="picker"></div>' +
      '<div id="replybar"></div>' +
      '<form id="f"><input id="u" autocomplete="off" placeholder="your name"><input id="m" autocomplete="off" placeholder="say something... try :sob:"><button id="pick" type="button" title="emojis">😀</button><button>send</button></form>' +
      '</div>' +
      '<div id="banView"><div id="banTitle">you are banned</div><div id="banUntil"></div></div>' +
      '</div>' +
      '<div id="play">' +
      '<div id="playbar"><button id="gback" class="ghost" type="button">← back</button><input id="gsearch" autocomplete="off" placeholder="' + LBL_SEARCH + '"></div>' +
      '<div id="cloakbar"><input id="cloakTitle" autocomplete="off" placeholder="tab title (default: Assignments)"><input id="cloakFav" autocomplete="off" placeholder="favicon url (default: Canvas)"></div>' +
      '<div id="playgrid"></div>' +   /* the catalog grid is the whole play view now; items open in their own tab */
      '</div>' +
      '<div id="originals">' +
      '<div id="origbar"><button id="oback" class="ghost" type="button">← back</button><span id="origTitle">' + LBL_ORIGINALS + '</span></div>' +
      '<div id="orighub"></div>' +
      '<div id="origplay"><iframe id="origframe" allow="autoplay; fullscreen; gamepad" allowfullscreen></iframe></div>' +
      '</div>' +
      '<div id="veil">' +
      '<div id="veilbar"><button id="pback" class="ghost" type="button">← back</button><span id="veilTitle">' + LBL_WEB_VEIL + '</span></div>' +
      '<div id="veilbody">' +
      '<h2>Coming Soon</h2>' +
      '<p>the veil is thin. the path is not yet for you.</p>' +
      '<p>tung walks it already. he will open the gate when the hour is his.</p>' +
      '</div></div>' +
      /* ---- Tung’s Casino: top-level view; its chrome lives in the main header ---- */
      '<div id="casino"><div id="casscreen"></div></div>' +
      '<div id="rpal"></div>' +
      /* chat profile / tip / login-key confirm overlays */
      '<div id="profOverlay" class="ov" role="dialog" aria-modal="true">' +
      '<div class="ovcard">' +
      '<h3 id="profName">member</h3>' +
      '<p class="ovsub">a pilgrim of the shrine.</p>' +
      '<div class="ovrow"><b>joined</b><span id="profJoined">—</span></div>' +
      '<div class="ovrow"><b>sahurs</b><span id="profBal">—</span></div>' +
      '<p id="profErr" class="overr"></p>' +
      '<div class="ovacts"><button id="profTip" type="button">offer sahurs</button><button id="profClose" class="ghost" type="button">close</button></div>' +
      '</div></div>' +
      '<div id="tipOverlay" class="ov" role="dialog" aria-modal="true">' +
      '<div class="ovcard">' +
      '<h3>offer sahurs</h3>' +
      '<p class="ovsub">your generosity is appealing in the eyes of tung tung god. continue.</p>' +
      '<p class="ovsub" style="font-style:normal;color:#8a6a3a;margin:0">to <b id="tipWho" style="color:#f2c063"></b></p>' +
      '<input id="tipAmt" type="number" min="0.1" step="0.1" inputmode="decimal" placeholder="amount">' +
      '<p id="tipErr" class="overr"></p>' +
      '<div class="ovacts"><button id="tipSend" type="button">continue</button><button id="tipCancel" class="ghost" type="button">never mind</button></div>' +
      '</div></div>' +
      '<div id="keyOverlay" class="ov" role="dialog" aria-modal="true">' +
      '<div class="ovcard">' +
      '<h3>copy login key</h3>' +
      '<p class="ovsub">this key spends sahurs and opens every gate. anyone who holds it is you.</p>' +
      '<div class="ovacts"><button id="keyConfirm" type="button">copy anyway</button><button id="keyCancel" class="ghost" type="button">cancel</button></div>' +
      '</div></div>';
  };
})();
