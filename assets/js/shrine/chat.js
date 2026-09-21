/* ==========================================================================
   Shrine of Tung — chat client
   Source text for the chat IIFE that runs inside the about:blank shrine window:
   apply -> poll /status -> poll /events for history and live messages, then
   POST /send and /react. Auth, usernames, approvals and history all live
   server-side in server.ts (Deno KV). It is a string, not live code, because
   the window it runs in is written with document.write.
   ========================================================================== */
(function () {
  "use strict";
  var Shrine = (window.Shrine = window.Shrine || {});

  /* the cloaked labels this client bakes in. every other capitalised name
     below (SHRINE_API, GAMES, TUNG_IMG, ORIGINALS, ...) is literal text inside
     the string and resolves against the globals window.js injects. The veil's
     destination is deliberately NOT among them — it is a server secret the
     backend hands out, and only while the veil is open. */
  var LBL_POPUP = Shrine.LBL.POPUP;
  var LBL_ORIGINALS = Shrine.LBL.ORIGINALS;
  var LBL_WEB_VEIL = Shrine.LBL.WEB_VEIL;

  /* the chat client that gets written into the about:blank window. only uses
     double quotes and backticks so it survives inside this single-quoted blob. */
  var SAHUR_CHAT_JS =
    '(function(){' +
    'var API=SHRINE_API,TKEY="shrine-token-v1";' +
    'var TOKEN=null,ME=null,cursor=0,polling=false,statusT=null,pollT=null,seenEids={};' +
    /* IS_MOD: this account may delete messages. APPROVED: tung has let them in.
       both come off /status and both are about THIS client only — the moderator
       flag is never on anything the room can see, so a moderator looks exactly
       like everybody else to everybody else. */
    'var IS_MOD=false,APPROVED=false,OPENED=false;' +
    'if(typeof SHRINE_BOOT_TOKEN==="string"&&SHRINE_BOOT_TOKEN){try{if(!localStorage.getItem(TKEY))localStorage.setItem(TKEY,SHRINE_BOOT_TOKEN);}catch(e){}}' +
    'var gate=document.getElementById("gate");' +
    'var applyView=document.getElementById("applyView");' +
    'var pendingView=document.getElementById("pendingView");' +
    'var appThread=document.getElementById("appThread");' +
    'var respBox=document.getElementById("respBox");' +
    'var respText=document.getElementById("respText");' +
    'var respBtn=document.getElementById("respBtn");' +
    'var chat=document.getElementById("chat");' +
    'var banEl=document.getElementById("banView");' +
    'var banTitle=document.getElementById("banTitle");' +
    'var banUntil=document.getElementById("banUntil");' +
    'var applyForm=document.getElementById("applyForm");' +
    'var gu=document.getElementById("gu");' +
    'var ga=document.getElementById("ga");' +
    'var applyTitle=document.getElementById("applyTitle");' +
    'var applyDesc=document.getElementById("applyDesc");' +
    'var applyBtn=document.getElementById("applyBtn");' +
    'var warnEl=document.querySelector("#applyView .warn");' +
    'var recheckBtn=document.getElementById("recheckBtn");' +
    'var myhash=document.getElementById("myhash");' +
    'var copyHashBtn=document.getElementById("copyHash");' +
    'var exportKeyBtn=document.getElementById("exportKey");' +
    'var lk=document.getElementById("lk");' +
    'var loginBtn=document.getElementById("loginBtn");' +
    'var log=document.getElementById("log");' +
    'var dmrail=document.getElementById("dmrail");' +
    'var dmlist=document.getElementById("dmlist");' +
    'var convname=document.getElementById("convname");' +
    'var convsub=document.getElementById("convsub");' +
    'var convBlock=document.getElementById("convBlock");' +
    'var form=document.getElementById("f");' +
    'var input=document.getElementById("m");' +
    'var nameEl=document.getElementById("u");' +
    'var picker=document.getElementById("picker");' +
    'var pick=document.getElementById("pick");' +
    'var replybar=document.getElementById("replybar");' +
    'var rpal=document.getElementById("rpal");' +
    'var chooseEl=document.getElementById("choose");' +
    'var shrineEl=document.getElementById("shrine");' +
    'var playEl=document.getElementById("play");' +
    'var casinoEl=document.getElementById("casino");' +
    'var chooseCasino=document.getElementById("chooseCasino");' +
    'var cback=document.getElementById("cback");' +
    'var shopBtn=document.getElementById("shopBtn");' +
    'var shrineBtn=document.getElementById("shrineBtn");' +
    'var bankBtn=document.getElementById("bankBtn");' +
    'var hdrShrine=document.getElementById("hdrShrine");' +
    'var hdrCasino=document.getElementById("hdrCasino");' +
    'var chooseShrine=document.getElementById("chooseShrine");' +
    'var choosePlay=document.getElementById("choosePlay");' +
    'var chooseOriginals=document.getElementById("chooseOriginals");' +
    'var chooseVeil=document.getElementById("chooseVeil");' +
    'var originalsEl=document.getElementById("originals");' +
    'var veilEl=document.getElementById("veil");' +
    'var veilH=document.getElementById("veilH");' +
    'var veilP1=document.getElementById("veilP1");' +
    'var veilP2=document.getElementById("veilP2");' +
    'var oback=document.getElementById("oback");' +
    'var pback=document.getElementById("pback");' +
    'var orighub=document.getElementById("orighub");' +
    'var origplay=document.getElementById("origplay");' +
    'var origframe=document.getElementById("origframe");' +
    'var origTitle=document.getElementById("origTitle");' +
    'var gback=document.getElementById("gback");' +
    'var sback=document.getElementById("sback");' +
    'var gsearch=document.getElementById("gsearch");' +
    'var playgrid=document.getElementById("playgrid");' +
    'var cloakTitleEl=document.getElementById("cloakTitle");' +
    'var cloakFavEl=document.getElementById("cloakFav");' +
    'var settingsEl=document.getElementById("settings");' +
    'var openSettingsBtn=document.getElementById("openSettings");' +
    'var setbackBtn=document.getElementById("setback");' +
    'var themegrid=document.getElementById("themegrid");' +
    /* catalog titles no longer play inside this chat window — each opens in its own
       about:blank tab (see openPlay below), so there are no in-page player refs */
    /* ---- discord-style emoji shortcodes + per-user pinned favourites ---- */
    'var EMOJI={"sob":"😭","joy":"😂","rofl":"🤣","skull":"💀","fire":"🔥","heart":"❤️","broken_heart":"💔","100":"💯","pray":"🙏","eyes":"👀","sunglasses":"😎","thinking":"🤔","cry":"😢","sweat_smile":"😅","heart_eyes":"😍","smirk":"😏","wink":"😉","grin":"😁","upside_down":"🙃","melting":"🫠","clap":"👏","ok_hand":"👌","thumbsup":"👍","thumbsdown":"👎","poop":"💩","tada":"🎉","rocket":"🚀","star":"⭐","zzz":"😴","cold_face":"🥶","hot_face":"🥵","nauseated":"🤢","wave":"👋","muscle":"💪","brain":"🧠","moai":"🗿","wood":"🪵","bat":"🦇","goat":"🐐","sparkles":"✨","raised_hands":"🙌","facepalm":"🤦","shrug":"🤷","angry":"😡","yawn":"🥱","salute":"🫡","israel":"🇮🇱","middle_finger":"🖕","sweat_drops":"💦","pleading":"🥺","clown":"🤡","rich":"🤑","feet":"🦶","tongue":"👅","wheelchair":"♿","ninja":"🥷","sahur":"🗿","tung":"🏏"};' +
    'function emojify(t){return t.replace(/:([a-z0-9_+-]+):/g,function(m,c){return EMOJI[c]||m;});}' +
    'function insertTok(tok){var s=input.selectionStart,e=input.selectionEnd;if(s==null){s=e=input.value.length;}input.value=input.value.slice(0,s)+tok+" "+input.value.slice(e);var p=s+tok.length+1;input.focus();try{input.setSelectionRange(p,p);}catch(x){}}' +
    /* sahur shares the moai glyph, so show its real PNG in the picker instead —
       otherwise the two 🗿 buttons are indistinguishable and you hit the wrong one. */
    'function buildPicker(){picker.innerHTML="";Object.keys(EMOJI).forEach(function(code){var b=document.createElement("button");b.type="button";b.className="pemoji";if(code==="sahur"){var im=document.createElement("img");im.src=SAHUR_IMG;im.alt=":sahur:";im.style.cssText="width:20px;height:20px;object-fit:cover;border-radius:4px;display:block";b.appendChild(im);}else{b.textContent=EMOJI[code];}b.title=":"+code+":";b.addEventListener("click",function(){insertTok(":"+code+":");picker.style.display="none";});picker.appendChild(b);});}' +
    /* ---- the chooser + tung curated catalog ---- */
    /* the main header swaps identity with the view: shrine title everywhere, a
       full casino header (back / title / balance / shop) once inside the casino. */
    'function topShow(v){chooseEl.style.display=v==="choose"?"flex":"none";shrineEl.style.display=v==="shrine"?"flex":"none";playEl.style.display=v==="play"?"flex":"none";casinoEl.style.display=v==="casino"?"flex":"none";originalsEl.style.display=v==="originals"?"flex":"none";veilEl.style.display=v==="veil"?"flex":"none";settingsEl.style.display=v==="settings"?"flex":"none";' +
    /* casino is a chooser destination; the header swaps identity once you are in it */
    'var inCas=v==="casino";hdrShrine.style.display=inCas?"none":"flex";hdrCasino.style.display=inCas?"flex":"none";if(v!=="originals")hideOrigPlay();}' +
    /* the holding page wears one of two faces: the veil is shut, or the veil is
       open and you are not on tung's list. same page, different words. */
    'var VEIL_SHUT=["Coming Soon","the veil is thin. the path is not yet for you.","tung walks it already. he will open the gate when the hour is his."];' +
    'var VEIL_DENIED=["The Gate Knows You","the veil is open tonight. it did not open for you.","tung keeps a list. your name is on a different one."];' +
    'function showVeil(words){var w=words||VEIL_SHUT;veilH.textContent=w[0];veilP1.textContent=w[1];veilP2.textContent=w[2];topShow("veil");}' +
    /* clicking a game opens it in its OWN about:blank tab. we write a tiny self-
       contained document into that tab: a header bar (styled to match the shrine
       chrome) holding an X that closes the tab and a fullscreen button, plus an
       iframe that loads the actual game. fullscreen puts the iframe itself full-
       screen so the header vanishes, and Esc restores it. note: `<\/script>` is
       escaped because this whole string is embedded inside the chat popup, which
       is itself embedded inside index.html\'s single-quoted blob. */
    /* tab disguise: game tabs default to the browser title "Assignments" and the
       CUHSD Canvas favicon, both overridable from the catalog menu and remembered
       in localStorage. empty value falls back to the default. */
    'var CLOAK_TKEY="shrine-cloak-title",CLOAK_FKEY="shrine-cloak-fav";' +
    'function cloakTitle(){try{return localStorage.getItem(CLOAK_TKEY)||"Assignments";}catch(e){return "Assignments";}}' +
    'function cloakFav(){try{return localStorage.getItem(CLOAK_FKEY)||"https://cuhsd.instructure.com/favicon.ico";}catch(e){return "https://cuhsd.instructure.com/favicon.ico";}}' +
    /* ---- themes ----
       The id rides on <html data-theme>, which is all the stylesheet needs.
       WHICH themes this member may wear is the server's business, not this
       client's: /themes says what is owned and what the shop wants for the
       rest, so a locked skin cannot be selected by editing anything here —
       and a theme added to the shrine is locked for everybody by default
       until it is put in the shop and bought. The wood is free and is also
       the base stylesheet, so it overrides nothing. ---- */
    'var THEMES=' + JSON.stringify(Shrine.THEMES) + ';' +
    'var THEME_KEY="shrine-theme",THEME_DEF=' + JSON.stringify(Shrine.THEME_DEFAULT) + ';' +
    'var THEME_STATE=null;' +
    'function themeOk(id){for(var i=0;i<THEMES.length;i++)if(THEMES[i].id===id)return true;return false;}' +
    'function themeOwned(id){' +
    'if(id===THEME_DEF)return true;' +
    'if(!THEME_STATE)return false;' +
    'for(var i=0;i<THEME_STATE.length;i++)if(THEME_STATE[i].id===id)return !!THEME_STATE[i].owned;' +
    'return false;}' +
    'function loadTheme(){try{var t=localStorage.getItem(THEME_KEY);if(t&&themeOk(t))return t;}catch(e){}return THEME_DEF;}' +
    'function applyTheme(id){if(!themeOk(id))id=THEME_DEF;document.documentElement.setAttribute("data-theme",id);}' +
    'function saveTheme(id){try{localStorage.setItem(THEME_KEY,id);}catch(e){}applyTheme(id);paintThemes();}' +
    /* a skin that is no longer yours must not keep being worn */
    'function reconcileTheme(){var cur=loadTheme();if(cur!==THEME_DEF&&!themeOwned(cur))saveTheme(THEME_DEF);}' +
    'function paintThemes(){if(!themegrid)return;var cur=loadTheme();' +
    'Array.prototype.forEach.call(themegrid.children,function(c){' +
    'if(c.getAttribute("data-theme")===cur)c.classList.add("on");else c.classList.remove("on");});}' +
    /* the grid is drawn from whatever the server last told us; before it has
       answered, only the free default is offered rather than guessing */
    'function buildThemes(){if(!themegrid)return;themegrid.innerHTML="";' +
    'var rows=THEME_STATE||THEMES.map(function(t){return {id:t.id,name:t.name,note:t.note,owned:t.id===THEME_DEF,price:null};});' +
    'rows.forEach(function(t){' +
    'var owned=t.owned||t.id===THEME_DEF;' +
    'var b=document.createElement("button");b.type="button";b.className="themecard"+(owned?"":" locked");b.setAttribute("data-theme",t.id);' +
    'var sw=document.createElement("span");sw.className="swatch sw-"+t.id;' +
    'if(!owned){var lk=document.createElement("span");lk.className="swlock";lk.textContent="\uD83D\uDD12";sw.appendChild(lk);}' +
    'b.appendChild(sw);' +
    'var n=document.createElement("strong");n.textContent=t.name;b.appendChild(n);' +
    'var d=document.createElement("span");d.className="tnote";' +
    'd.textContent=owned?t.note:(t.price!=null?("in the shop \u2014 "+t.price+" sahurs"):"not for sale yet.");' +
    'b.appendChild(d);' +
    'b.addEventListener("click",function(){' +
    'if(owned){saveTheme(t.id);return;}' +
    'var msg=document.getElementById("themeMsg");' +
    'if(msg)msg.textContent=t.price!=null' +
    '?("locked. tung sells it in the casino shop for "+t.price+" sahurs.")' +
    ':"locked. tung has not put this one on the shelves.";});' +
    'themegrid.appendChild(b);});paintThemes();}' +
    /* ask the shrine what is ours, then redraw */
    'function refreshThemes(){' +
    'var t=loadToken();if(!t){buildThemes();return;}' +
    'api("/themes?token="+encodeURIComponent(t)).then(function(r){' +
    'if(r&&r.themes){THEME_STATE=r.themes;reconcileTheme();}' +
    'buildThemes();' +
    '}).catch(function(){buildThemes();});}' +
    /* ---- launching a game ----
       It used to be an iframe pointed at the game's URL. Some networks refuse
       to frame anything, and a refused frame is a black rectangle with no
       error to catch — so the game is FETCHED instead and written into the tab
       as the whole document. Same bytes, same origin rules, but it arrives as
       an ordinary page load rather than as a frame, which is the thing being
       blocked.

       Writing the whole document rather than injecting into a container is
       deliberate: half these games call document.write themselves while they
       load, and Unity and Godot loaders read location and document.baseURI.
       Given the whole document they behave exactly as they would if you had
       navigated to them, which nothing short of the whole document achieves.

       The cost is the tab's own header bar, which cannot survive the game
       writing over the document, so the cloak is re-applied afterwards
       instead. And if the fetch is what fails — a cross-origin embed without
       CORS, say — the old iframe is still there to fall back to. */
    'function gameDir(u){var q=u.split("#")[0].split("?")[0];var i=q.lastIndexOf("/");return i>=0?q.slice(0,i+1):q;}' +
    /* the gn-math stubs carry an absolute <base> of their own and must keep
       it; everything else is a folder of relative assets and needs one, or it
       would look for them wherever the shrine happens to be served from */
    'function withBase(html,u){' +
    'if(/<base[\\s>]/i.test(html))return html;' +
    'var tag="<base href=\\""+gameDir(u)+"\\">";' +
    'if(/<head[^>]*>/i.test(html))return html.replace(/<head[^>]*>/i,function(m){return m+tag;});' +
    'if(/<html[^>]*>/i.test(html))return html.replace(/<html[^>]*>/i,function(m){return m+"<head>"+tag+"</head>";});' +
    'return tag+html;}' +
    /* Leftover gn-math/html URLs are rewritten to games/g/<file> under
       Shrine.BASE — never Deno, never a CDN HTML host (jsDelivr serves .html
       as text/plain, so a game would arrive as its own source text). */
    'function gameUrl(u){var mark="gn-math/html/";var idx=u.indexOf(mark);' +
    'if(idx>=0){var rest=u.slice(idx+mark.length);var s=rest.indexOf("/");' +
    'if(s>=0)return ' + JSON.stringify(new URL("games/g/", Shrine.BASE || location.href).href) + '+rest.slice(s+1);}' +
    'return u;}' +
    'function playShell(ct,cf,msg){' +
    'return `<!DOCTYPE html><html><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1"><title>${ct}</title>' +
    '<link rel="icon" href="${cf}">' +
    '<style>html,body{margin:0;height:100%;background:#000;color:#c8823c;' +
    'font-family:system-ui,Segoe UI,Roboto,sans-serif}' +
    '#boot{display:flex;align-items:center;justify-content:center;height:100vh;padding:24px;text-align:center;font-size:14px}' +
    '</style></head><body><div id="boot">${msg}</div></body></html>`;}' +
    /* the game replaces the document, title and icon included, so the disguise
       is put back over the top of whatever it set */
    'function reCloak(w,ct,cf){var go=function(){try{' +
    'w.document.title=ct;' +
    'var l=w.document.querySelector("link[rel~=\'icon\']");' +
    'if(!l){l=w.document.createElement("link");l.rel="icon";(w.document.head||w.document.documentElement).appendChild(l);}' +
    'l.href=cf;}catch(e){}};' +
    'setTimeout(go,60);setTimeout(go,800);setTimeout(go,2500);try{w.addEventListener("load",go);}catch(e){}}' +
    /* the way it used to be done, kept for when the fetch is the thing that
       cannot get through */
    'function playFrame(w,g,url,ct,cf){' +
    'var doc=`<!DOCTYPE html><html><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1"><title>${ct}</title>' +
    '<link rel="icon" href="${cf}">' +
    '<style>html,body{margin:0;height:100%;background:#000;font-family:system-ui,Segoe UI,Roboto,sans-serif}' +
    '#wrap{display:flex;flex-direction:column;height:100vh}' +
    '#bar{display:flex;align-items:center;gap:8px;padding:8px 12px;background:#2b1a0a;border-bottom:1px solid #3a2410;color:#f5efe0}' +
    '#ttl{flex:1;font-weight:600;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '#bar button{background:#241505;border:1px solid #3a2410;color:#f5efe0;border-radius:8px;padding:5px 11px;font-size:15px;line-height:1;cursor:pointer}' +
    '#bar button:hover{background:#3a2410}#gf{flex:1;width:100%;border:0;background:#000}' +
    '</style></head><body><div id="wrap"><div id="bar">' +
    '<button id="x" title="close">✕</button><span id="ttl">${g.n}</span>' +
    '<button id="fs" title="fullscreen">⛶</button></div>' +
    '<iframe id="gf" allow="autoplay; fullscreen; gamepad; clipboard-read; clipboard-write" allowfullscreen></iframe>' +
    '</div><script>' +
    'document.getElementById("gf").src="${url}";' +
    'document.getElementById("x").onclick=function(){window.close();};' +
    'document.getElementById("fs").onclick=function(){var f=document.getElementById("gf");' +
    'if(document.fullscreenElement){(document.exitFullscreen||function(){}).call(document);}' +
    'else{(f.requestFullscreen||f.webkitRequestFullscreen||function(){}).call(f);}};' +
    'try{var __egg=document.createElement("iframe");__egg.style.display="none";document.body.appendChild(__egg);__egg.contentDocument.write("<iframe>");}catch(e){}' +
    '<\\/script></body></html>`;' +
    'w.document.open();w.document.write(doc);w.document.close();}' +
    'function openPlay(g){' +
    'var w=window.open("about:blank","_blank");' +
    'if(!w){alert(' + JSON.stringify(LBL_POPUP) + ');return;}' +
    'var ct=cloakTitle(),cf=cloakFav();' +
    'w.document.open();w.document.write(playShell(ct,cf,"loading\\u2026"));w.document.close();' +
    'var url=gameUrl(g.u);' +
    'fetch(url,{credentials:"omit"}).then(function(r){' +
    'if(!r.ok)throw new Error(String(r.status));return r.text();' +
    '}).then(function(html){' +
    'if(w.closed)return;' +
    'w.document.open();w.document.write(withBase(html,url));w.document.close();' +
    'reCloak(w,ct,cf);' +
    '}).catch(function(){if(!w.closed)playFrame(w,g,url,ct,cf);});' +
    '}' +
    'function buildCatalog(){playgrid.innerHTML="";GAMES.forEach(function(g){var b=document.createElement("button");b.type="button";b.className="gtile";b.textContent=g.n;b.setAttribute("data-name",g.n.toLowerCase());b.addEventListener("click",function(){openPlay(g);});playgrid.appendChild(b);});}' +
    'function hideOrigPlay(){if(!origplay)return;origplay.style.display="none";orighub.style.display="flex";origframe.src="about:blank";origTitle.textContent=' + JSON.stringify(LBL_ORIGINALS) + ';}' +
    /* Tung's own three went through the same in-page iframe, and an iframe is
       an iframe wherever it is pointed — so they open in a fetched tab like
       everything else in the catalog now. The hub still lists them. */
    'function openOriginal(g){openPlay(g);}' +
    'function buildOriginals(){orighub.innerHTML="";var lead=document.createElement("p");lead.className="origlead";lead.textContent="he made these himself. they are not kind.";orighub.appendChild(lead);var grid=document.createElement("div");grid.className="origgrid";ORIGINALS.forEach(function(g){var b=document.createElement("button");b.type="button";b.className="origtile";var t=document.createElement("strong");t.textContent=g.n;var s=document.createElement("span");s.textContent=g.s;b.appendChild(t);b.appendChild(s);b.addEventListener("click",function(){openOriginal(g);});grid.appendChild(b);});orighub.appendChild(grid);}' +
    'function filterCatalog(){var q=gsearch.value.toLowerCase();Array.prototype.forEach.call(playgrid.children,function(b){b.style.display=b.getAttribute("data-name").indexOf(q)>=0?"":"none";});}' +
    /* ---- :sahur: inline png, :tung: bat, tung x3 + sahur embeds the god ---- */
    'var SAHUR_IMG=TUNG_IMG;' +
    'function makeSahurSvg(){var i=document.createElement("img");i.className="isvg";i.alt=":sahur:";i.title=":sahur:";i.src=SAHUR_IMG;return i;}' +
    'function makeGodCombo(){var i=document.createElement("img");i.className="embed god";i.alt="tung tung tung god";i.loading="lazy";i.src=TUNGGOD_IMG;return i;}' +
    'function renderInline(el,seg){var re=/:([a-z0-9_+-]+):/g,last=0,m;while((m=re.exec(seg))){if(m.index>last)el.appendChild(document.createTextNode(seg.slice(last,m.index)));var code=m[1];if(code==="sahur")el.appendChild(makeSahurSvg());else if(EMOJI[code])el.appendChild(document.createTextNode(EMOJI[code]));else el.appendChild(document.createTextNode(m[0]));last=re.lastIndex;}if(last<seg.length)el.appendChild(document.createTextNode(seg.slice(last)));}' +
    /* one god embed per message, no matter how many combos are in it. the first
       combo becomes the portrait; any after it just render as bats + sahur. */
    'function renderBody(el,text){el.textContent="";var re=/:tung:\\s*:tung:\\s*:tung:\\s*:sahur:/g;var m=re.exec(text);if(!m){renderInline(el,text);return;}renderInline(el,text.slice(0,m.index));el.appendChild(makeGodCombo());renderInline(el,text.slice(re.lastIndex));}' +
    /* ---- message replies + reactions (live-only, over the same relay) ---- */
    'var MSGS={};' +
    'var REACTS=["❤️","👍","👎","😂","😮","😢","🔥","🤡","🙏","💀"];' +
    'var replyTo=null,rTarget=null;' +
    'function api(p,opt){return fetch(API+p,opt).then(function(r){return r.json().catch(function(){return {};});});}' +
    'function apiPost(p,body){return api(p,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});}' +
    'function loadToken(){try{var t=localStorage.getItem(TKEY);if(t){t=String(t).trim();if(t)return t;}}catch(e){}if(typeof SHRINE_BOOT_TOKEN==="string"&&SHRINE_BOOT_TOKEN){var b=String(SHRINE_BOOT_TOKEN).trim();if(b)return b;}return null;}' +
    'function saveToken(t){try{localStorage.setItem(TKEY,t);}catch(e){}if(typeof SHRINE_BOOT_TOKEN!=="undefined")SHRINE_BOOT_TOKEN=t;}' +
    'function clearToken(){try{localStorage.removeItem(TKEY);}catch(e){}if(typeof SHRINE_BOOT_TOKEN!=="undefined")SHRINE_BOOT_TOKEN="";}' +
    'function paintKey(){if(myhash)myhash.textContent=TOKEN||"";if(exportKeyBtn)exportKeyBtn.style.display=TOKEN?"inline-block":"none";}' +
    /* login key = full access. confirm before clipboard so people know what they are copying. */
    'var tipTo=null,profId=null,pendingCopyBtn=null;' +
    'var profEl=document.getElementById("profOverlay");' +
    'var tipEl=document.getElementById("tipOverlay");' +
    'var keyEl=document.getElementById("keyOverlay");' +
    'function money2(n){n=Number(n);if(!isFinite(n))return"—";return(Math.round(n*100)/100).toFixed(2);}' +
    'function fmtDate(ts){ts=Number(ts);if(!ts)return"unknown";try{return new Date(ts).toLocaleDateString(undefined,{year:"numeric",month:"short",day:"numeric"});}catch(e){return"unknown";}}' +
    /* chat times: time of day if it was today, "yesterday" if it was, otherwise
       the date. the full locale string sits on the title so a hover still has
       the exact moment. empty string means "do not draw a clock" — old events
       that predate the field, or junk. */
    'function fmtWhen(ts){ts=Number(ts);if(!ts)return"";var d=new Date(ts);if(isNaN(d.getTime()))return"";var now=new Date();var t=d.toLocaleTimeString(undefined,{hour:"numeric",minute:"2-digit"});if(d.getFullYear()===now.getFullYear()&&d.getMonth()===now.getMonth()&&d.getDate()===now.getDate())return t;var y=new Date(now.getFullYear(),now.getMonth(),now.getDate()-1);if(d.getFullYear()===y.getFullYear()&&d.getMonth()===y.getMonth()&&d.getDate()===y.getDate())return"yesterday "+t;if(d.getFullYear()===now.getFullYear())return d.toLocaleDateString(undefined,{month:"short",day:"numeric"})+" "+t;return d.toLocaleDateString(undefined,{year:"numeric",month:"short",day:"numeric"})+" "+t;}' +
    'function stampWhen(el,ts){if(!el)return;var old=el.querySelector("time.when");if(old&&old.parentNode)old.parentNode.removeChild(old);var label=fmtWhen(ts);if(!label)return;var d=new Date(Number(ts));if(isNaN(d.getTime()))return;var tm=document.createElement("time");tm.className="when";tm.dateTime=d.toISOString();tm.title=d.toLocaleString();tm.textContent=label;el.appendChild(tm);}' +
    'function doCopyKey(btn){if(!TOKEN)return;var prev=btn?btn.textContent:"";function done(){if(btn){btn.textContent="copied";setTimeout(function(){btn.textContent=prev;},1400);}}if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(TOKEN).then(done).catch(fb);}else fb();function fb(){var t=document.createElement("textarea");t.value=TOKEN;t.style.position="fixed";t.style.left="-9999px";document.body.appendChild(t);t.select();try{document.execCommand("copy");}catch(e){}document.body.removeChild(t);done();}}' +
    'function copyKey(btn){if(!TOKEN)return;if(!keyEl){doCopyKey(btn);return;}pendingCopyBtn=btn;keyEl.style.display="flex";}' +
    'function confirmCopyKey(){if(keyEl)keyEl.style.display="none";doCopyKey(pendingCopyBtn);pendingCopyBtn=null;}' +
    'function tipErrMsg(e){return e==="insufficient"?"the shrine rejects empty hands.":e==="self"?"tung does not tip himself. neither should you.":e==="not_found"?"that name is not known to the shrine.":e==="invalid"?"that offering is not accepted.":e==="unauthorized"?"the shrine does not recognize you.":"the offering failed. try again.";}' +
    /* One card, two faces. The ordinary one asks the server who this member is;
       tung's is written here, because he has no join date, no balance and no
       server record to ask about — he is not a member. */
    'function tungProfile(){' +
    'var card=profEl.querySelector(".ovcard");if(card)card.classList.add("tung");' +
    'var std=document.getElementById("profStd");if(std)std.style.display="none";' +
    'var sub=document.getElementById("profSub");if(sub)sub.textContent="not a member. the shrine itself, wearing a name so it can be addressed.";' +
    'document.getElementById("profName").textContent="tung";' +
    'document.getElementById("profErr").textContent="";' +
    'var tipBtn=document.getElementById("profTip");if(tipBtn)tipBtn.style.display="none";' +
    'var ex=document.getElementById("profExtra");' +
    'if(ex){ex.style.display="block";ex.innerHTML="";' +
    'var rows=[["first seen","before the wood"],["sahurs","all of them"],["answers to","no one"],["last seen","he did not leave"],["status","watching"]];' +
    'rows.forEach(function(r){var d=document.createElement("div");d.className="ovrow";var b=document.createElement("b");b.textContent=r[0];var v=document.createElement("span");v.textContent=r[1];d.appendChild(b);d.appendChild(v);ex.appendChild(d);});' +
    'var note=document.createElement("p");note.className="ovsub";note.style.margin="12px 0 0";note.textContent="he does not take offerings. he takes note.";ex.appendChild(note);}' +
    'profEl.style.display="flex";}' +
    'function openProfile(name,isT){if(!name||!TOKEN||!profEl)return;' +
    'if(isT){tipTo=null;tungProfile();return;}' +
    /* put the card back to its ordinary shape — it is shared with tung's */
    'var card0=profEl.querySelector(".ovcard");if(card0)card0.classList.remove("tung");' +
    'var std0=document.getElementById("profStd");if(std0)std0.style.display="";' +
    'var ex0=document.getElementById("profExtra");if(ex0){ex0.style.display="none";ex0.innerHTML="";}' +
    'var sub0=document.getElementById("profSub");if(sub0)sub0.textContent="a pilgrim of the shrine.";' +
    'tipTo=name;profId=null;' +
    'document.getElementById("profName").textContent=name;' +
    'document.getElementById("profJoined").textContent="…";' +
    'document.getElementById("profBal").textContent="…";' +
    'document.getElementById("profErr").textContent="";' +
    'var tipBtn=document.getElementById("profTip");if(tipBtn)tipBtn.style.display=(String(name).toLowerCase()===String(ME||"").toLowerCase())?"none":"";' +
    'profEl.style.display="flex";' +
    'api("/tip/profile?token="+encodeURIComponent(TOKEN)+"&user="+encodeURIComponent(name)).then(function(r){' +
    'if(!r||r.error){var e=r&&r.error;document.getElementById("profErr").textContent=e==="not_found"?"that name is not known to the shrine.":e==="unauthorized"?"the shrine does not recognize you.":"the shrine is silent. try again.";document.getElementById("profJoined").textContent="—";document.getElementById("profBal").textContent="—";return;}' +
    'var joined=r.createdAt!=null?r.createdAt:(r.registeredAt!=null?r.registeredAt:r.ts);' +
    'profId=r.id||null;' +
    'document.getElementById("profName").textContent=r.username||name;' +
    'document.getElementById("profJoined").textContent=fmtDate(joined);' +
    'document.getElementById("profBal").textContent=money2(r.balance)+" sahurs";' +
    '}).catch(function(){document.getElementById("profErr").textContent="the shrine is silent. try again.";});}' +
    /* the way into a conversation from the room: the card you get by clicking
       a name. It carries the id so the DM is opened against the account rather
       than against a string somebody could have renamed out from under it. */
    'function dmFromProfile(){' +
    'if(!tipTo)return;' +
    'var who=tipTo,id=profId||tipTo;' +
    'if(profEl)profEl.style.display="none";' +
    'openDM(id,who);}' +
    'function openTip(name){if(!name||!TOKEN)return;if(String(name).toLowerCase()===String(ME||"").toLowerCase())return;tipTo=name;if(profEl)profEl.style.display="none";' +
    'document.getElementById("tipWho").textContent=name;document.getElementById("tipAmt").value="1";document.getElementById("tipErr").textContent="";' +
    'if(tipEl){tipEl.style.display="flex";try{document.getElementById("tipAmt").focus();document.getElementById("tipAmt").select();}catch(e){}}}' +
    'function sendTip(){var amtEl=document.getElementById("tipAmt"),err=document.getElementById("tipErr"),btn=document.getElementById("tipSend");if(!tipTo||!TOKEN||!amtEl)return;var amt=Number(amtEl.value);if(!isFinite(amt)||amt<=0){err.textContent=tipErrMsg("invalid");return;}btn.disabled=true;err.textContent="offering…";' +
    'apiPost("/tip",{token:TOKEN,to:tipTo,amount:amt,tipId:mkId()}).then(function(r){btn.disabled=false;if(r&&r.ok){err.textContent="";if(tipEl)tipEl.style.display="none";var note=document.createElement("div");note.className="tiptoast";note.textContent="offered "+money2(r.amount!=null?r.amount:amt)+" sahurs to "+(r.to||tipTo)+".";document.body.appendChild(note);setTimeout(function(){if(note.parentNode)note.parentNode.removeChild(note);},2200);return;}err.textContent=tipErrMsg(r&&r.error);}).catch(function(){btn.disabled=false;err.textContent="the shrine is silent. try again.";});}' +
    'function mkId(){return Date.now().toString(36)+Math.random().toString(36).slice(2,7);}' +
    'function renderReacts(id){var m=MSGS[id];if(!m)return;m.reactEl.innerHTML="";Object.keys(m.counts).forEach(function(e){var chip=document.createElement("button");chip.type="button";chip.className="chip"+(m.mine[e]?" on":"");chip.textContent=e+" "+m.counts[e];chip.addEventListener("click",function(ev){ev.stopPropagation();toggleReact(id,e);});m.reactEl.appendChild(chip);});}' +
    'function applyReact(id,e,op){var m=MSGS[id];if(!m)return;m.counts[e]=(m.counts[e]||0)+op;if(m.counts[e]<=0)delete m.counts[e];renderReacts(id);}' +
    /* the server holds whether a reaction is yours, so its answer is the truth
       and this optimistic flip is only a guess. if they disagree, put it back. */
    'function toggleReact(id,e){var m=MSGS[id];if(!m)return;var op=m.mine[e]?-1:1;if(op===1)m.mine[e]=1;else delete m.mine[e];applyReact(id,e,op);var eid=mkId();seenEids[eid]=1;' +
    'apiPost("/react",{token:TOKEN,id:id,e:e,op:op,eid:eid}).then(function(r){' +
    'if(!r||typeof r.state!=="number")return;var want=r.state===1,have=!!m.mine[e];if(want===have)return;' +
    'if(want){m.mine[e]=1;applyReact(id,e,1);}else{delete m.mine[e];applyReact(id,e,-1);}}).catch(function(){});}' +
    /* which of the chips on screen are ours, told to us when the window opens */
    'function markMine(list){if(!list||!list.length)return;list.forEach(function(p){var m=MSGS[p[0]];if(!m)return;m.mine[p[1]]=1;renderReacts(p[0]);});}' +
    'function openPalette(id,anchor){rTarget=id;var r=anchor.getBoundingClientRect();rpal.style.left=Math.max(6,Math.min(r.left-90,window.innerWidth-236))+"px";rpal.style.top=(r.bottom+4)+"px";rpal.style.display="flex";}' +
    'function buildRpal(){rpal.innerHTML="";REACTS.forEach(function(e){var b=document.createElement("button");b.type="button";b.textContent=e;b.addEventListener("click",function(ev){ev.stopPropagation();if(rTarget)toggleReact(rTarget,e);rpal.style.display="none";});rpal.appendChild(b);});}' +
    'function setReply(m){replyTo={id:m.id,name:m.name,text:m.text.slice(0,140)};replybar.innerHTML="";var s=document.createElement("span");s.textContent="replying to ";var bb=document.createElement("b");bb.textContent=m.name;s.appendChild(bb);replybar.appendChild(s);var x=document.createElement("span");x.className="x";x.textContent="cancel";x.addEventListener("click",cancelReply);replybar.appendChild(x);replybar.style.display="flex";input.focus();}' +
    'function cancelReply(){replyTo=null;replybar.style.display="none";}' +
    /* from:"tung" is stamped by the server on his own posts and on nothing else,
       so this never has to guess from the name — which also means a member who
       somehow holds that name still renders as the ordinary member they are. */
    'function isTung(m){return !!(m&&m.from==="tung");}' +
    /* one in five of his lines carries a giveaway: a button worth some sahurs to
       whoever reaches it first. the server decides the winner — this only draws
       the button and retires it once somebody has. */
    'var GIFTS={};' +
    'function retireGift(id,by,mine){var g=GIFTS[id];if(!g)return;g.btn.disabled=true;g.btn.classList.add("taken");' +
    'g.btn.textContent=mine?("you took "+g.amount+" sahurs"):"taken";' +
    'g.note.textContent=mine?"tung noticed.":(by?("claimed by "+by):"claimed");}' +
    'function claimGift(id){var g=GIFTS[id];if(!g||!TOKEN)return;' +
    'g.btn.disabled=true;g.btn.textContent="reaching\u2026";g.note.textContent="";' +
    'apiPost("/gift/claim",{token:TOKEN,id:id}).then(function(r){' +
    'if(r&&r.ok){retireGift(id,r.by,true);return;}' +
    'if(r&&r.error==="claimed"){retireGift(id,r.by,false);return;}' +
    'if(r&&r.error==="gone"){retireGift(id,null,false);g.note.textContent="nothing is there. it never was.";return;}' +
    'g.btn.disabled=false;g.btn.textContent="claim "+g.amount+" sahurs";' +
    'g.note.textContent=(r&&r.error==="blocked")?"not you.":"the shrine did not answer. try again.";' +
    '}).catch(function(){g.btn.disabled=false;g.btn.textContent="claim "+g.amount+" sahurs";g.note.textContent="the shrine did not answer. try again.";});}' +
    /* taking a line off this screen — because a del event said so, or because we
       just pressed the bin — and asking the shrine to take it off everyone else's.
       already gone counts as done, so pressing twice is not an error. */
    'function dropMsg(id){var r=MSGS[id];if(r&&r.row&&r.row.parentNode)r.row.parentNode.removeChild(r.row);delete MSGS[id];}' +
    'function delBtn(id){var m=MSGS[id];return m&&m.row?m.row.querySelector(".act.del"):null;}' +
    'function delMsg(id){if(!TOKEN){dropMsg(id);return;}apiPost("/delete",{token:TOKEN,id:id}).then(function(r){' +
    'if(r&&(r.ok||r.error==="gone")){dropMsg(id);return;}' +
    'var b=delBtn(id);if(b){b.disabled=false;b.textContent="🗑";b.title="the shrine would not — try again";}' +
    '}).catch(function(){var b=delBtn(id);if(b){b.disabled=false;b.textContent="🗑";}});}' +
    'function add(m){var isT=isTung(m);var row=document.createElement("div");row.className=m.mine?"msg me":"msg";if(isT)row.classList.add("tung");if(m.id)row.setAttribute("data-id",m.id);' +
    'var meta=document.createElement("div");meta.className="meta";' +
    'var w=document.createElement("button");w.type="button";w.className="who";w.textContent=m.name;w.title="view profile";' +
    /* his name gets his portrait and a mark, so the line reads as the shrine
       speaking rather than as somebody in the room */
    'if(isT){w.classList.add("tung");w.textContent="";var ti=document.createElement("img");ti.className="tungimg";ti.src=TUNG_IMG;ti.alt="";ti.onerror=function(){ti.style.display="none";};w.appendChild(ti);var tn=document.createElement("span");tn.textContent=m.name;w.appendChild(tn);var tb=document.createElement("span");tb.className="tungmark";tb.textContent="the shrine";w.appendChild(tb);w.title="who is this";}' +
    'w.addEventListener("click",function(ev){ev.stopPropagation();openProfile(m.name,isT);});meta.appendChild(w);stampWhen(meta,m.ts);row.appendChild(meta);' +
    'if(m.reply){var q=document.createElement("div");q.className="quote";var qn=document.createElement("b");qn.textContent=m.reply.name+": ";q.appendChild(qn);q.appendChild(document.createTextNode(emojify(m.reply.text)));q.addEventListener("click",function(){var t=document.querySelector("[data-id="+m.reply.id+"]");if(t){t.scrollIntoView({block:"center"});t.className+=" flash";setTimeout(function(){t.className=t.className.replace(" flash","");},700);}});row.appendChild(q);}' +
    'var bd=document.createElement("span");bd.className="body";renderBody(bd,m.text);row.appendChild(bd);' +
    'var acts=document.createElement("div");acts.className="acts";var rb=document.createElement("button");rb.type="button";rb.className="act";rb.textContent="😀";rb.title="react";rb.addEventListener("click",function(ev){ev.stopPropagation();openPalette(m.id,rb);});var pb=document.createElement("button");pb.type="button";pb.className="act";pb.textContent="↩";pb.title="reply";pb.addEventListener("click",function(ev){ev.stopPropagation();setReply(m);});acts.appendChild(rb);acts.appendChild(pb);' +
    /* moderators get a third button and nobody else does. it arms on the first
       click and fires on the second, so one stray tap on a tiny target cannot
       destroy a line; it disarms itself again after four seconds. */
    'if(IS_MOD){var db=document.createElement("button");db.type="button";db.className="act del";db.textContent="🗑";db.title="delete this message";var armed=0,armT=null;' +
    'db.addEventListener("click",function(ev){ev.stopPropagation();if(!armed){armed=1;db.textContent="⚠";db.title="click again to delete";if(armT)clearTimeout(armT);armT=setTimeout(function(){armed=0;db.textContent="🗑";db.title="delete this message";},4000);return;}' +
    'if(armT)clearTimeout(armT);armed=0;db.disabled=true;delMsg(m.id);});acts.appendChild(db);}' +
    'row.appendChild(acts);' +
    'if(m.gift&&m.gift.id){var gw=document.createElement("div");gw.className="giftbox";' +
    'var gb=document.createElement("button");gb.type="button";gb.className="giftbtn";gb.textContent="claim "+m.gift.amount+" sahurs";' +
    'var gn=document.createElement("span");gn.className="giftnote";' +
    'GIFTS[m.gift.id]={btn:gb,note:gn,amount:m.gift.amount};' +
    'gb.addEventListener("click",function(ev){ev.stopPropagation();claimGift(m.gift.id);});' +
    'gw.appendChild(gb);gw.appendChild(gn);row.appendChild(gw);}' +
    'var rc=document.createElement("div");rc.className="reacts";row.appendChild(rc);' +
    'MSGS[m.id]={reactEl:rc,counts:{},mine:{},meta:meta,row:row};' +
    'log.appendChild(row);log.scrollTop=log.scrollHeight;}' +
    /* ---- view switching + application/token auth against the backend ---- */
    'function show(v){gate.style.display=(v==="apply"||v==="pending")?"flex":"none";chat.style.display=v==="chat"?"flex":"none";applyView.style.display=v==="apply"?"block":"none";pendingView.style.display=v==="pending"?"block":"none";banEl.style.display=v==="ban"?"flex":"none";var lb=document.getElementById("loginBox");if(lb)lb.style.display=(v==="apply"&&!TOKEN)?"flex":"none";}' +
    /* banned/timed-out/chat-banned users get a blank screen instead of the chat.
       a permanent ban shows no "until"; a timeout shows the deadline; a chat ban
       says so in as many words, because only the room is shut and the casino,
       the pit and the games are still open one view up. a timeout and a chat ban
       both re-check /status so access comes back on its own — the timeout when
       its clock passes, the chat ban when tung lifts it. */
    'function pageHidden(){return !!document.hidden;}' +
    'function showBan(info){polling=false;var why=(info&&info.reason)||"";var isTo=why==="timeout";var isChat=why==="chatban";' +
    'banTitle.textContent=isTo?"you are timed out":(isChat?"the room is shut to you":"you are banned");' +
    'if(isTo&&info.until){banUntil.textContent="until "+new Date(info.until).toLocaleString();banUntil.style.display="";}' +
    'else if(isChat){banUntil.textContent="tung has barred you from the chat. you cannot read it and you cannot speak in it. everything else is still yours — the casino, the pit, the games, the shop.";banUntil.style.display="";}' +
    'else{banUntil.style.display="none";}' +
    'show("ban");if(statusT)clearTimeout(statusT);if(pollT){clearTimeout(pollT);pollT=null;}' +
    'if((isTo||isChat)&&!pageHidden())statusT=setTimeout(refreshGate,isChat?15000:5000);}' +
    'function applyWarn(t){if(warnEl)warnEl.textContent=t;}' +
    'function applyEvent(ev){if(!ev)return;if(ev.type==="del"){dropMsg(ev.id);return;}if(ev.type==="react"){if(seenEids[ev.eid])return;seenEids[ev.eid]=1;applyReact(ev.id,ev.e,ev.op);return;}if(ev.type==="gift"){retireGift(ev.id,ev.by,ev.by===ME);return;}if(ev.type==="msg"){if(MSGS[ev.id]){if(MSGS[ev.id].meta)stampWhen(MSGS[ev.id].meta,ev.ts);return;}add({id:ev.id,name:ev.name,text:ev.text,mine:ev.name===ME,reply:ev.reply||null,from:ev.from||null,gift:ev.gift||null,ts:ev.ts||null});}}' +
    /* hidden tabs do not hit /events. coming back fires one /events?since= catch-up, then every 4s. */
    'function poll(){if(!polling||pageHidden())return;if(pollT){clearTimeout(pollT);pollT=null;}api("/events?since="+cursor+"&token="+encodeURIComponent(TOKEN)).then(function(r){if(r&&r.error==="unauthorized"){polling=false;refreshGate();return;}if(r&&r.blocked){showBan(r);return;}if(r&&r.events){r.events.forEach(applyEvent);if(typeof r.cursor==="number")cursor=r.cursor;}if(r&&r.mine)markMine(r.mine);}).catch(function(){}).then(function(){if(polling&&!pageHidden())pollT=setTimeout(poll,4000);});}' +
    'function startPoll(){if(polling)return;polling=true;poll();}' +
    'function startChat(name){ME=name;nameEl.value=name;nameEl.readOnly=true;paintKey();show("chat");input.focus();startPoll();dmStart();' +
    /* the first time tung says yes, the door opens onto the chooser rather than
       dropping them straight into the room \u2014 but only once, or every poll
       would yank them back out of whatever they were doing */
    'if(!OPENED){OPENED=true;topShow("choose");}}' +
    /* render tung<->applicant follow-up messages on the pending screen; show the
       reply box only once tung has actually asked something. */
    'function renderThread(thread){thread=thread||[];appThread.innerHTML="";var hasAdmin=false;thread.forEach(function(m){var b=document.createElement("div");b.className="tmsg "+(m.from==="admin"?"admin":"me");var tw=document.createElement("div");tw.className="twhen";tw.textContent=(m.from==="admin"?"tung":"you")+(m.ts?" · "+fmtWhen(m.ts):"");var tx=document.createElement("div");tx.textContent=m.text;b.appendChild(tw);b.appendChild(tx);appThread.appendChild(b);if(m.from==="admin")hasAdmin=true;});respBox.style.display=hasAdmin?"flex":"none";}' +
    /* the casino is members-only, so its door is not even drawn until tung has
       approved you — the server refuses every table to an unapproved token anyway,
       this just stops the tile existing. the moderator flag rides in on the same
       answer. both start off and are only ever turned on by a real /status. */
    /* Sent to tung. Not a screen with a message on it \u2014 the whole document
       goes, and what is left is a white page with nothing in it and nothing
       polling. It is keyed to the token in this browser, so clearing site data
       gets them back to an application form; what does not come back is the
       account, which stays banned server-side however many times they apply. */
    'var BANISHED=false;' +
    'function banish(){' +
    'if(BANISHED)return;BANISHED=true;' +
    'polling=false;if(pollT){clearTimeout(pollT);pollT=null;}' +
    'if(statusT){clearTimeout(statusT);statusT=null;}' +
    'if(dmListT){clearInterval(dmListT);dmListT=null;}dmStop();' +
    'try{document.documentElement.setAttribute("data-theme","");}catch(e){}' +
    'document.title="";' +
    /* built rather than written as markup: this file is one long single-quoted
       string, and a nested attribute quote does not survive the trip out */
    'document.documentElement.innerHTML="<head></head><body></body>";' +
    'try{document.body.style.background="#fff";document.body.style.margin="0";}catch(e){}' +
    '}' +
    /* Everything behind the door is behind the door. Before tung has said yes
       there is no chooser, no catalog, no originals, no proxy and no casino \u2014
       one page, and it is the application. The casino used to be hidden on its
       own for this; it does not need its own rule any more, because nothing at
       all is reachable until APPROVED is true. */
    'function paintGate(){' +
    'if(sback)sback.style.display=APPROVED?"":"none";' +
    /* the casino tile ships hidden in the markup so nothing shows for even a
       frame before /status has answered; putting it back is this gate's job
       now rather than a second one of its own */
    'if(chooseCasino)chooseCasino.style.display=APPROVED?"":"none";' +
    'if(!APPROVED)topShow("shrine");' +
    '}' +
    'function syncAccess(s){' +
    'if(s&&s.banished){APPROVED=false;IS_MOD=false;banish();return;}' +
    'APPROVED=!!(s&&s.status==="approved");IS_MOD=APPROVED&&s.mod===true;paintGate();}' +
    'function pokeAccess(){var t=loadToken();if(!t){syncAccess(null);return;}api("/status?token="+encodeURIComponent(t)).then(function(s){if(s&&typeof s.status==="string")syncAccess(s);}).catch(function(){});}' +
    'function refreshGate(){TOKEN=loadToken();paintKey();if(!TOKEN){syncAccess(null);show("apply");return;}if(pageHidden())return;api("/status?token="+encodeURIComponent(TOKEN)).then(function(s){if(!s||typeof s.status!=="string")return;syncAccess(s);if(s.status==="approved"){if(s.blocked){showBan(s);}else if(s.chatBanned){showBan({reason:"chatban"});}else{startChat(s.username||"");}}else if(s.status==="pending"){show("pending");paintKey();renderThread(s.thread);if(statusT)clearTimeout(statusT);if(!pageHidden())statusT=setTimeout(refreshGate,3000);}else if(s.status==="none"||s.status==="rejected"){clearToken();TOKEN=null;paintKey();show("apply");}}).catch(function(){});}' +
    'applyForm.addEventListener("submit",function(ev){ev.preventDefault();if(loadToken()){refreshGate();return;}var u=gu.value.trim(),a=ga.value.trim();if(!u||!a){applyWarn("pick a username and write an application.");return;}applyBtn.disabled=true;applyWarn("submitting...");apiPost("/apply",{username:u,application:a}).then(function(r){applyBtn.disabled=false;if(r&&r.token){saveToken(r.token);TOKEN=r.token;refreshGate();}else if(r&&r.error==="username taken"){applyWarn("that username is taken — pick another.");}else{applyWarn("could not apply, try again.");}}).catch(function(){applyBtn.disabled=false;applyWarn("network error, try again.");});});' +
    'recheckBtn.addEventListener("click",function(){refreshGate();});' +
    'if(copyHashBtn)copyHashBtn.addEventListener("click",function(){copyKey(copyHashBtn);});' +
    'if(exportKeyBtn)exportKeyBtn.addEventListener("click",function(){copyKey(exportKeyBtn);});' +
    'var tipSend=document.getElementById("tipSend"),tipCancel=document.getElementById("tipCancel"),tipAmt=document.getElementById("tipAmt");' +
    'var profClose=document.getElementById("profClose"),profTipBtn=document.getElementById("profTip");' +
    'var profDmBtn=document.getElementById("profDm");' +
    'if(profDmBtn)profDmBtn.addEventListener("click",dmFromProfile);' +
    'var keyConfirm=document.getElementById("keyConfirm"),keyCancel=document.getElementById("keyCancel");' +
    'if(profClose)profClose.addEventListener("click",function(){if(profEl)profEl.style.display="none";});' +
    'if(profTipBtn)profTipBtn.addEventListener("click",function(){openTip(tipTo);});' +
    'if(tipCancel)tipCancel.addEventListener("click",function(){if(tipEl)tipEl.style.display="none";});' +
    'if(tipSend)tipSend.addEventListener("click",function(){sendTip();});' +
    'if(tipAmt)tipAmt.addEventListener("keydown",function(ev){if(ev.key==="Enter"){ev.preventDefault();sendTip();}});' +
    'if(keyConfirm)keyConfirm.addEventListener("click",confirmCopyKey);' +
    'if(keyCancel)keyCancel.addEventListener("click",function(){if(keyEl)keyEl.style.display="none";pendingCopyBtn=null;});' +
    'if(profEl)profEl.addEventListener("click",function(ev){if(ev.target===profEl)profEl.style.display="none";});' +
    'if(tipEl)tipEl.addEventListener("click",function(ev){if(ev.target===tipEl)tipEl.style.display="none";});' +
    'if(keyEl)keyEl.addEventListener("click",function(ev){if(ev.target===keyEl){keyEl.style.display="none";pendingCopyBtn=null;}});' +
    'if(loginBtn)loginBtn.addEventListener("click",function(){var k=lk?lk.value.trim():"";if(!k){applyWarn("enter your login key.");return;}loginBtn.disabled=true;applyWarn("logging in...");apiPost("/login",{token:k}).then(function(r){loginBtn.disabled=false;if(r&&r.token){saveToken(r.token);TOKEN=r.token;applyWarn("");refreshGate();}else{applyWarn("that key is not known to the shrine.");}}).catch(function(){loginBtn.disabled=false;applyWarn("network error, try again.");});});' +
    'if(lk)lk.addEventListener("keydown",function(ev){if(ev.key==="Enter"){ev.preventDefault();if(loginBtn)loginBtn.click();}});' +
    'respBtn.addEventListener("click",function(){var t=respText.value.trim();if(!t)return;respText.value="";apiPost("/respond",{token:TOKEN,text:t}).then(function(r){if(r&&r.thread)renderThread(r.thread);});});' +
    /* ---- conversations ----
       DM is null in the room and {id,name} in a conversation. One pane holds
       both, so switching is: stop what was filling it, empty it, start the
       other. The room replays from the beginning when it is come back to,
       which costs one read and is the only way to be sure nothing said while
       you were away is missing. */
    'var DM=null,dmSeq=0,dmT=null,dmListT=null,dmSending=0,dmSkip={},dmRun=0;' +
    /* stopping the poll has to disown the request already in the air as well as
       the timer, or its reply lands on top of whatever replaced it */
    'function dmStop(){dmRun++;if(dmT){clearTimeout(dmT);dmT=null;}}' +
    /* ---- blocking ----
       DMSHUT says whether this conversation is shut and, if it is, whether it
       was this end that shut it — which is the whole difference between a
       button that says "unblock" and a line saying there is nothing to do. */
    'var DMSHUT={on:false,mine:false};' +
    'function dmPaintBlock(){' +
    'if(!convBlock)return;' +
    'if(!DM){convBlock.style.display="none";return;}' +
    'convBlock.style.display="inline-block";' +
    'if(DMSHUT.on&&!DMSHUT.mine){convBlock.style.display="none";return;}' +
    'convBlock.textContent=DMSHUT.on?"unblock":"block";' +
    'convBlock.className=DMSHUT.on?"on":"";}' +
    /* the sub line under the name is where the state is explained, because the
       button alone cannot say why the composer stopped working */
    'function dmSetShut(on,mine){' +
    /* a shut conversation shows nothing, so that what is on screen matches
       what opening it again would give you */
    'if(on&&!DMSHUT.on){log.innerHTML="";dmSeq=0;}' +
    'DMSHUT={on:!!on,mine:!!mine};' +
    'if(DM&&convsub){' +
    'convsub.textContent=!on?"only the two of you":mine?"you blocked "+DM.name+". they are not told.":"this conversation is closed.";}' +
    'if(input)input.disabled=!!on;' +
    'dmPaintBlock();}' +
    'function dmToggleBlock(){' +
    'if(!DM||!TOKEN)return;' +
    'var conv=DM,want=!DMSHUT.on;' +
    'if(want&&!confirm("block "+conv.name+"? neither of you will be able to write to the other. you can undo this."))return;' +
    'convBlock.disabled=true;' +
    'apiPost("/dm/block",{token:TOKEN,to:conv.id,blocked:want}).then(function(r){' +
    'convBlock.disabled=false;' +
    'if(DM!==conv)return;' +
    'if(!r||r.error){convsub.textContent="that did not go through.";return;}' +
    'dmSetShut(r.blocked,r.byYou);' +
    /* unblocking leaves an empty pane, so read the conversation back in */
    'if(!r.blocked){log.innerHTML="";dmSeq=0;dmStop();dmPoll();}' +
    'dmListRefresh();' +
    '}).catch(function(){convBlock.disabled=false;});}' +
    'if(convBlock)convBlock.addEventListener("click",dmToggleBlock);' +
    /* a conversation line: plain, because a DM has no reactions, no replies
       and no gifts — pretending otherwise would be a row of buttons that do
       nothing */
    'function dmAdd(m){var row=document.createElement("div");row.className=m.mine?"msg me dm":"msg dm";' +
    'var meta=document.createElement("div");meta.className="meta";' +
    'var w=document.createElement("span");w.className="who";w.textContent=m.mine?(ME||"you"):(DM?DM.name:"");meta.appendChild(w);' +
    'stampWhen(meta,m.ts);row.appendChild(meta);' +
    'var bd=document.createElement("span");bd.className="body";renderBody(bd,m.text);row.appendChild(bd);' +
    'log.appendChild(row);log.scrollTop=log.scrollHeight;return row;}' +
    /* `dmSeq` is only ever moved by a response we actually rendered, so a reply
       we throw away is simply fetched again rather than lost. The one thing
       that can arrive twice is a line of our own, already on screen from the
       moment it was typed; it comes back with a seq, and `dmSkip` is where the
       send leaves word to let that one through unrendered. */
    'function dmPoll(){' +
    'if(!DM||!TOKEN)return;' +
    /* A hidden tab is not reading anything, so it has no business asking. The
       chain is kept alive rather than dropped — returning outright would end
       the poll for good — and coming back to the tab kicks it immediately, so
       nothing is waited for. */
    'if(pageHidden()){dmT=setTimeout(dmPoll,5000);return;}' +
    'var conv=DM,run=dmRun;' +
    'api("/dm/with?token="+encodeURIComponent(TOKEN)+"&with="+encodeURIComponent(conv.id)+"&since="+dmSeq).then(function(r){' +
    'if(DM!==conv||run!==dmRun)return;' +
    'if(r&&r.error){dmT=setTimeout(dmPoll,4000);return;}' +
    'if(r&&r.closed){dmSetShut(true,!!r.byYou);}' +
    'else if(r&&r.msgs){if(DMSHUT.on)dmSetShut(false,false);' +
    'for(var i=0;i<r.msgs.length;i++){var m=r.msgs[i];' +
    'if(m.mine&&dmSkip[m.seq]){delete dmSkip[m.seq];continue;}dmAdd(m);}' +
    'if(r.seq>dmSeq)dmSeq=r.seq;}' +
    'if(r&&r.msgs&&r.msgs.length)dmListRefresh();' +
    'dmT=setTimeout(dmPoll,2500);' +
    '}).catch(function(){if(DM===conv&&run===dmRun)dmT=setTimeout(dmPoll,4000);});}' +
    /* going back to the room. cursor 0 so the history is replayed rather than
       resumed from a mark that moved on without us. */
    'function openRoom(){' +
    'dmStop();DM=null;dmSeq=0;dmSkip={};' +
    'DMSHUT={on:false,mine:false};if(input)input.disabled=false;dmPaintBlock();' +
    'convname.textContent="the shrine";convsub.textContent="everyone who is here";' +
    'input.placeholder="say something... try :sob:";' +
    'log.innerHTML="";MSGS={};cursor=0;seenEids={};' +
    'dmPaint();polling=true;poll();}' +
    'function openDM(id,name){' +
    'if(!id||!TOKEN)return;' +
    'if(String(name||"").toLowerCase()===String(ME||"").toLowerCase())return;' +
    'if(polling)polling=false;' +
    'if(pollT){clearTimeout(pollT);pollT=null;}' +
    'dmStop();' +
    'DM={id:String(id),name:String(name||"")};dmSeq=0;dmSkip={};' +
    'convname.textContent=DM.name;' +
    'dmSetShut(false,false);' +
    'input.placeholder="message "+DM.name+"\u2026";' +
    'log.innerHTML="";cancelReply();' +
    'dmPaint();dmPoll();' +
    'try{input.focus();}catch(e){}}' +
    /* the rail: the room, then whoever has been talked to, newest first */
    'function dmPaint(){' +
    'if(!dmlist)return;' +
    'dmlist.innerHTML="";' +
    'var room=document.createElement("button");room.type="button";' +
    'room.className="dmrow"+(DM?"":" on");' +
    'var rn=document.createElement("span");rn.className="dmname";rn.textContent="the shrine";room.appendChild(rn);' +
    'var rs=document.createElement("span");rs.className="dmlast";rs.textContent="the whole room";room.appendChild(rs);' +
    'room.addEventListener("click",function(){if(DM)openRoom();});' +
    'dmlist.appendChild(room);' +
    'for(var i=0;i<DMS.length;i++){(function(c){' +
    'var b=document.createElement("button");b.type="button";' +
    'b.className="dmrow"+(DM&&DM.id===c.id?" on":"")+(c.unread>0?" unread":"");' +
    'var top=document.createElement("span");top.className="dmtop";' +
    'var n=document.createElement("span");n.className="dmname";n.textContent=c.name;top.appendChild(n);' +
    'if(c.unread>0){var u=document.createElement("span");u.className="dmbadge";u.textContent=c.unread>99?"99+":String(c.unread);top.appendChild(u);}' +
    'b.appendChild(top);' +
    'var l=document.createElement("span");l.className="dmlast";' +
    'l.textContent=c.closed?(c.byYou?"blocked":"closed"):(c.last||"");b.appendChild(l);' +
    'b.addEventListener("click",function(){openDM(c.id,c.name);});' +
    'dmlist.appendChild(b);' +
    '})(DMS[i]);}' +
    'if(!DMS.length){var e=document.createElement("div");e.className="dmempty";' +
    'e.textContent="no conversations yet. click a name in the room to start one.";dmlist.appendChild(e);}}' +
    'var DMS=[];' +
    'function dmListRefresh(){' +
    'if(!TOKEN||!APPROVED||pageHidden())return;' +
    'api("/dm/list?token="+encodeURIComponent(TOKEN)).then(function(r){' +
    'if(!r||r.error||!r.convs)return;' +
    'DMS=r.convs;' +
    'dmPaint();' +
    '}).catch(function(){});}' +
    'function dmStart(){if(dmListT)clearInterval(dmListT);dmListRefresh();dmListT=setInterval(dmListRefresh,12000);}' +
    'form.addEventListener("submit",function(ev){ev.preventDefault();var text=input.value.trim();if(!text)return;' +
    /* one composer, two destinations — whichever the pane is showing */
    'if(DM){var conv=DM;input.value="";' +
    /* the line goes up the moment it is typed, and the poll is held off until
       the send answers — otherwise a poll landing in between would fetch the
       same line back and put it on screen twice. `dmSkip` carries the seq the
       send comes back with, so the copy the next poll brings is let through
       without being drawn again. */
    'var row=dmAdd({text:text,ts:Date.now(),mine:true});' +
    'dmSending++;dmStop();' +
    'apiPost("/dm/send",{token:TOKEN,to:conv.id,text:text}).then(function(r){' +
    'if(r&&r.msg){dmSkip[r.msg.seq]=1;if(DM===conv)convsub.textContent="only the two of you";}' +
    /* a refused line is taken back off the screen rather than left sitting
       there looking sent */
    'if(r&&r.error){if(row&&row.parentNode)row.parentNode.removeChild(row);' +
    'if(DM===conv){' +
    'if(r.error==="you_blocked")dmSetShut(true,true);' +
    'else if(r.error==="closed")dmSetShut(true,false);' +
    /* the conversation cap: a first line to somebody new is the one thing a
       DM can do that costs the shrine anything lasting, so there is a ceiling
       on how many conversations one member may have going. Saying which it
       is beats "that did not send" — nothing is wrong with the line, and
       nothing about trying again will help. */
    'else if(r.error==="too_many")convsub.textContent="too many conversations open \u2014 this would be a new one."' +
    ';else convsub.textContent=r.error==="slow down"?"slow down \u2014 too many messages."' +
    ':"that did not send.";}}' +
    'dmListRefresh();' +
    '}).catch(function(){if(row&&row.parentNode)row.parentNode.removeChild(row);' +
    '}).then(function(){dmSending--;if(!dmSending&&DM===conv){dmStop();dmPoll();}});return;}' +
    'var id=mkId();var rep=replyTo?{id:replyTo.id,name:replyTo.name,text:replyTo.text}:null;input.value="";add({id:id,name:ME,text:text,mine:true,reply:rep,ts:Date.now()});apiPost("/send",{token:TOKEN,id:id,text:text,reply:rep}).then(function(r){if(r&&r.ts&&MSGS[id]&&MSGS[id].meta)stampWhen(MSGS[id].meta,r.ts);});cancelReply();});' +
    'pick.addEventListener("click",function(ev){ev.stopPropagation();picker.style.display=picker.style.display==="flex"?"none":"flex";rpal.style.display="none";});' +
    'document.addEventListener("click",function(){rpal.style.display="none";picker.style.display="none";});' +
    'buildPicker();buildRpal();buildCatalog();buildOriginals();' +
    'chooseShrine.addEventListener("click",function(){topShow("shrine");refreshGate();});' +
    'choosePlay.addEventListener("click",function(){topShow("play");});' +
    'chooseOriginals.addEventListener("click",function(){topShow("originals");});' +
    /* the veil has two faces and the server picks: tung flips it from /admin.
       open -> the destination in its own tab, through the same opener the
       catalog uses (same cloaked title and favicon, same header, same hidden
       nested-iframe lines). closed, or unreachable -> the holding page. */
    'chooseVeil.addEventListener("click",function(){' +
    /* loadToken(), not the cached TOKEN: TOKEN is only filled in once you have
       entered the shrine view, and the veil is reachable straight from the
       chooser. the saved key is the real source either way. */
    'var t=loadToken();' +
    'if(!t){showVeil(VEIL_SHUT);return;}' +
    'api("/veil?token="+encodeURIComponent(t)).then(function(r){' +
    /* open AND you are on the list -> the destination in its own tab.
       open but you are not -> the same page, different words.
       shut, or anything went wrong -> the shut-veil page. */
    'if(r&&r.live&&r.allowed&&r.url){openPlay({n:' + JSON.stringify(LBL_WEB_VEIL) + ',u:r.url});}' +
    'else if(r&&r.live){showVeil(VEIL_DENIED);}' +
    'else{showVeil(VEIL_SHUT);}' +
    '}).catch(function(){showVeil(VEIL_SHUT);});' +
    '});' +
    'oback.addEventListener("click",function(){if(origplay.style.display==="flex"){hideOrigPlay();}else{topShow("choose");}});' +
    'pback.addEventListener("click",function(){topShow("choose");});' +
    'chooseCasino.addEventListener("click",function(){if(!APPROVED)return;topShow("casino");if(window.__casinoOpen)window.__casinoOpen();});' +   /* casino is a chooser bigbtn, same flow as the old header chip */
    'gback.addEventListener("click",function(){topShow("choose");});' +   /* "back" returns from the catalog grid to the chooser screen */
    'cback.addEventListener("click",function(){if(window.__casinoBack)window.__casinoBack();topShow("choose");});' +   /* casino "← back" returns to the chooser */
    'shopBtn.addEventListener("click",function(){if(window.__casinoShop)window.__casinoShop();});' +   /* shop lives on the casino header */
    'shrineBtn.addEventListener("click",function(){if(window.__casinoShrine)window.__casinoShrine();});' +   /* so does the shrine (the faucet) */
    'if(bankBtn)bankBtn.addEventListener("click",function(){if(window.__casinoBank)window.__casinoBank();});' +   /* and the bank, next to it */
    'sback.addEventListener("click",function(){topShow("choose");});' +   /* "back" returns from the shrine/chat to the chooser screen */
    'gsearch.addEventListener("input",filterCatalog);' +
    'if(openSettingsBtn)openSettingsBtn.addEventListener("click",function(){topShow("settings");refreshThemes();});' +
    'if(setbackBtn)setbackBtn.addEventListener("click",function(){topShow("choose");});' +
    'applyTheme(loadTheme());refreshThemes();' +
    'cloakTitleEl.value=cloakTitle();cloakFavEl.value=cloakFav();' +
    'cloakTitleEl.addEventListener("input",function(){try{localStorage.setItem(CLOAK_TKEY,cloakTitleEl.value);}catch(e){}document.title=cloakTitle();});' +
    'cloakFavEl.addEventListener("input",function(){try{localStorage.setItem(CLOAK_FKEY,cloakFavEl.value);}catch(e){}var fl=document.getElementById("cloakfav");if(fl)fl.href=cloakFav();});' +
    'document.title=cloakTitle();' +
    /* The shrine opens on its own door. refreshGate() is what decides which
       door it is \u2014 apply, the pending screen, a ban, or the room \u2014 and
       from there startChat() is the only thing that opens the chooser, so the
       catalog, the originals, the proxy and the casino do not exist as far as
       anybody tung has not approved is concerned. It used to boot straight to
       the chooser and gate only the casino tile; this is that rule made
       general, which is why the casino no longer needs one of its own. */
    'topShow("shrine");show("apply");refreshGate();' +
    'document.addEventListener("visibilitychange",function(){if(pageHidden()){if(pollT){clearTimeout(pollT);pollT=null;}if(statusT){clearTimeout(statusT);statusT=null;}return;}if(polling)poll();' +
    /* the conversations went quiet with the tab; catch them up now rather than
       leaving the rail a few seconds stale on the way back in */
    'if(DM){dmStop();dmPoll();}dmListRefresh();' +
    'if(pendingView.style.display==="block"||banEl.style.display==="flex")refreshGate();});' +
    /* the three lines from before, verbatim */
    'const iframe = document.createElement("iframe");' +
    'document.body.appendChild(iframe);' +
    'iframe.contentDocument.write("<iframe>");' +
    '})();';

  Shrine.CHAT_JS = SAHUR_CHAT_JS;
})();
