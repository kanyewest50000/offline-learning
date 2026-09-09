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

  /* the cloaked labels and the veil destination this client bakes in. every
     other capitalised name below (SHRINE_API, GAMES, TUNG_IMG, ORIGINALS, ...)
     is literal text inside the string and resolves against the globals
     window.js injects. */
  var LBL_POPUP = Shrine.LBL.POPUP;
  var LBL_ORIGINALS = Shrine.LBL.ORIGINALS;
  var LBL_WEB_VEIL = Shrine.LBL.WEB_VEIL;
  var VEIL_URL = Shrine.VEIL_URL;

  /* the chat client that gets written into the about:blank window. only uses
     double quotes and backticks so it survives inside this single-quoted blob. */
  var SAHUR_CHAT_JS =
    '(function(){' +
    'var API=SHRINE_API,TKEY="shrine-token-v1";' +
    'var TOKEN=null,ME=null,cursor=0,polling=false,statusT=null,pollT=null,seenEids={};' +
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
    'var hdrShrine=document.getElementById("hdrShrine");' +
    'var hdrCasino=document.getElementById("hdrCasino");' +
    'var chooseShrine=document.getElementById("chooseShrine");' +
    'var choosePlay=document.getElementById("choosePlay");' +
    'var chooseOriginals=document.getElementById("chooseOriginals");' +
    'var chooseVeil=document.getElementById("chooseVeil");' +
    'var originalsEl=document.getElementById("originals");' +
    'var oback=document.getElementById("oback");' +
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
    'function topShow(v){chooseEl.style.display=v==="choose"?"flex":"none";shrineEl.style.display=v==="shrine"?"flex":"none";playEl.style.display=v==="play"?"flex":"none";casinoEl.style.display=v==="casino"?"flex":"none";originalsEl.style.display=v==="originals"?"flex":"none";' +
    /* casino is a chooser destination; the header swaps identity once you are in it */
    'var inCas=v==="casino";hdrShrine.style.display=inCas?"none":"flex";hdrCasino.style.display=inCas?"flex":"none";if(v!=="originals")hideOrigPlay();}' +
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
    'function openPlay(g){' +
    'var w=window.open("about:blank","_blank");' +
    'if(!w){alert(' + JSON.stringify(LBL_POPUP) + ');return;}' +
    'var ct=cloakTitle(),cf=cloakFav();' +
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
    /* iframe src is the same-origin Pages stub (GAMES URLs are remapped
       to games/g/ above). A real src is required: srcdoc made
       location.href about:srcdoc and Unity loaders hung at 0%.
       Leftover gn-math/html URLs are rewritten to games/g/<file> on
       this origin — never Deno, never a CDN HTML host. */
    'var GURL="${g.u}";' +
    'var gf=document.getElementById("gf");' +
    '(function(){' +
    'var mark="gn-math/html/";var idx=GURL.indexOf(mark);' +
    'if(idx>=0){var rest=GURL.slice(idx+mark.length);var s=rest.indexOf("/");' +
    'if(s>=0)GURL=' + JSON.stringify(new URL("games/g/", location.href).href) + '+rest.slice(s+1);}' +
    'gf.src=GURL;' +
    '})();' +
    'document.getElementById("x").onclick=function(){window.close();};' +   /* X = close this game tab */
    'document.getElementById("fs").onclick=function(){var f=document.getElementById("gf");' +
    'if(document.fullscreenElement){(document.exitFullscreen||function(){}).call(document);}' +
    'else{(f.requestFullscreen||f.webkitRequestFullscreen||function(){}).call(f);}};' +   /* toggle iframe fullscreen; header hides while fullscreen */
    /* the nested-iframe easter-egg snippet, kept hidden, added to every game tab */
    'var __egg=document.createElement("iframe");__egg.style.display="none";document.body.appendChild(__egg);__egg.contentDocument.write("<iframe>");' +
    '<\\/script></body></html>`;' +
    'w.document.open();w.document.write(doc);w.document.close();' +
    '}' +
    'function buildCatalog(){playgrid.innerHTML="";GAMES.forEach(function(g){var b=document.createElement("button");b.type="button";b.className="gtile";b.textContent=g.n;b.setAttribute("data-name",g.n.toLowerCase());b.addEventListener("click",function(){openPlay(g);});playgrid.appendChild(b);});}' +
    'function hideOrigPlay(){if(!origplay)return;origplay.style.display="none";orighub.style.display="flex";origframe.src="about:blank";origTitle.textContent=' + JSON.stringify(LBL_ORIGINALS) + ';}' +
    'function openOriginal(g){orighub.style.display="none";origplay.style.display="flex";origTitle.textContent=g.n;origframe.src=g.u;}' +
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
    'var tipTo=null,pendingCopyBtn=null;' +
    'var profEl=document.getElementById("profOverlay");' +
    'var tipEl=document.getElementById("tipOverlay");' +
    'var keyEl=document.getElementById("keyOverlay");' +
    'function money2(n){n=Number(n);if(!isFinite(n))return"—";return(Math.round(n*100)/100).toFixed(2);}' +
    'function fmtDate(ts){ts=Number(ts);if(!ts)return"unknown";try{return new Date(ts).toLocaleDateString(undefined,{year:"numeric",month:"short",day:"numeric"});}catch(e){return"unknown";}}' +
    'function doCopyKey(btn){if(!TOKEN)return;var prev=btn?btn.textContent:"";function done(){if(btn){btn.textContent="copied";setTimeout(function(){btn.textContent=prev;},1400);}}if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(TOKEN).then(done).catch(fb);}else fb();function fb(){var t=document.createElement("textarea");t.value=TOKEN;t.style.position="fixed";t.style.left="-9999px";document.body.appendChild(t);t.select();try{document.execCommand("copy");}catch(e){}document.body.removeChild(t);done();}}' +
    'function copyKey(btn){if(!TOKEN)return;if(!keyEl){doCopyKey(btn);return;}pendingCopyBtn=btn;keyEl.style.display="flex";}' +
    'function confirmCopyKey(){if(keyEl)keyEl.style.display="none";doCopyKey(pendingCopyBtn);pendingCopyBtn=null;}' +
    'function tipErrMsg(e){return e==="insufficient"?"the shrine rejects empty hands.":e==="self"?"tung does not tip himself. neither should you.":e==="not_found"?"that name is not known to the shrine.":e==="invalid"?"that offering is not accepted.":e==="unauthorized"?"the shrine does not recognize you.":"the offering failed. try again.";}' +
    'function openProfile(name){if(!name||!TOKEN||!profEl)return;tipTo=name;' +
    'document.getElementById("profName").textContent=name;' +
    'document.getElementById("profJoined").textContent="…";' +
    'document.getElementById("profBal").textContent="…";' +
    'document.getElementById("profErr").textContent="";' +
    'var tipBtn=document.getElementById("profTip");if(tipBtn)tipBtn.style.display=(String(name).toLowerCase()===String(ME||"").toLowerCase())?"none":"";' +
    'profEl.style.display="flex";' +
    'api("/tip/profile?token="+encodeURIComponent(TOKEN)+"&user="+encodeURIComponent(name)).then(function(r){' +
    'if(!r||r.error){var e=r&&r.error;document.getElementById("profErr").textContent=e==="not_found"?"that name is not known to the shrine.":e==="unauthorized"?"the shrine does not recognize you.":"the shrine is silent. try again.";document.getElementById("profJoined").textContent="—";document.getElementById("profBal").textContent="—";return;}' +
    'var joined=r.createdAt!=null?r.createdAt:(r.registeredAt!=null?r.registeredAt:r.ts);' +
    'document.getElementById("profName").textContent=r.username||name;' +
    'document.getElementById("profJoined").textContent=fmtDate(joined);' +
    'document.getElementById("profBal").textContent=money2(r.balance)+" sahurs";' +
    '}).catch(function(){document.getElementById("profErr").textContent="the shrine is silent. try again.";});}' +
    'function openTip(name){if(!name||!TOKEN)return;if(String(name).toLowerCase()===String(ME||"").toLowerCase())return;tipTo=name;if(profEl)profEl.style.display="none";' +
    'document.getElementById("tipWho").textContent=name;document.getElementById("tipAmt").value="1";document.getElementById("tipErr").textContent="";' +
    'if(tipEl){tipEl.style.display="flex";try{document.getElementById("tipAmt").focus();document.getElementById("tipAmt").select();}catch(e){}}}' +
    'function sendTip(){var amtEl=document.getElementById("tipAmt"),err=document.getElementById("tipErr"),btn=document.getElementById("tipSend");if(!tipTo||!TOKEN||!amtEl)return;var amt=Number(amtEl.value);if(!isFinite(amt)||amt<=0){err.textContent=tipErrMsg("invalid");return;}btn.disabled=true;err.textContent="offering…";' +
    'apiPost("/tip",{token:TOKEN,to:tipTo,amount:amt,tipId:mkId()}).then(function(r){btn.disabled=false;if(r&&r.ok){err.textContent="";if(tipEl)tipEl.style.display="none";var note=document.createElement("div");note.className="tiptoast";note.textContent="offered "+money2(r.amount!=null?r.amount:amt)+" sahurs to "+(r.to||tipTo)+".";document.body.appendChild(note);setTimeout(function(){if(note.parentNode)note.parentNode.removeChild(note);},2200);return;}err.textContent=tipErrMsg(r&&r.error);}).catch(function(){btn.disabled=false;err.textContent="the shrine is silent. try again.";});}' +
    'function mkId(){return Date.now().toString(36)+Math.random().toString(36).slice(2,7);}' +
    'function renderReacts(id){var m=MSGS[id];if(!m)return;m.reactEl.innerHTML="";Object.keys(m.counts).forEach(function(e){var chip=document.createElement("button");chip.type="button";chip.className="chip"+(m.mine[e]?" on":"");chip.textContent=e+" "+m.counts[e];chip.addEventListener("click",function(ev){ev.stopPropagation();toggleReact(id,e);});m.reactEl.appendChild(chip);});}' +
    'function applyReact(id,e,op){var m=MSGS[id];if(!m)return;m.counts[e]=(m.counts[e]||0)+op;if(m.counts[e]<=0)delete m.counts[e];renderReacts(id);}' +
    'function toggleReact(id,e){var m=MSGS[id];if(!m)return;var op=m.mine[e]?-1:1;if(op===1)m.mine[e]=1;else delete m.mine[e];applyReact(id,e,op);var eid=mkId();seenEids[eid]=1;apiPost("/react",{token:TOKEN,id:id,e:e,op:op,eid:eid});}' +
    'function openPalette(id,anchor){rTarget=id;var r=anchor.getBoundingClientRect();rpal.style.left=Math.max(6,Math.min(r.left-90,window.innerWidth-236))+"px";rpal.style.top=(r.bottom+4)+"px";rpal.style.display="flex";}' +
    'function buildRpal(){rpal.innerHTML="";REACTS.forEach(function(e){var b=document.createElement("button");b.type="button";b.textContent=e;b.addEventListener("click",function(ev){ev.stopPropagation();if(rTarget)toggleReact(rTarget,e);rpal.style.display="none";});rpal.appendChild(b);});}' +
    'function setReply(m){replyTo={id:m.id,name:m.name,text:m.text.slice(0,140)};replybar.innerHTML="";var s=document.createElement("span");s.textContent="replying to ";var bb=document.createElement("b");bb.textContent=m.name;s.appendChild(bb);replybar.appendChild(s);var x=document.createElement("span");x.className="x";x.textContent="cancel";x.addEventListener("click",cancelReply);replybar.appendChild(x);replybar.style.display="flex";input.focus();}' +
    'function cancelReply(){replyTo=null;replybar.style.display="none";}' +
    'function add(m){var row=document.createElement("div");row.className=m.mine?"msg me":"msg";if(m.id)row.setAttribute("data-id",m.id);' +
    'var w=document.createElement("button");w.type="button";w.className="who";w.textContent=m.name;w.title="view profile";w.addEventListener("click",function(ev){ev.stopPropagation();openProfile(m.name);});row.appendChild(w);' +
    'if(m.reply){var q=document.createElement("div");q.className="quote";var qn=document.createElement("b");qn.textContent=m.reply.name+": ";q.appendChild(qn);q.appendChild(document.createTextNode(emojify(m.reply.text)));q.addEventListener("click",function(){var t=document.querySelector("[data-id="+m.reply.id+"]");if(t){t.scrollIntoView({block:"center"});t.className+=" flash";setTimeout(function(){t.className=t.className.replace(" flash","");},700);}});row.appendChild(q);}' +
    'var bd=document.createElement("span");bd.className="body";renderBody(bd,m.text);row.appendChild(bd);' +
    'var acts=document.createElement("div");acts.className="acts";var rb=document.createElement("button");rb.type="button";rb.className="act";rb.textContent="😀";rb.title="react";rb.addEventListener("click",function(ev){ev.stopPropagation();openPalette(m.id,rb);});var pb=document.createElement("button");pb.type="button";pb.className="act";pb.textContent="↩";pb.title="reply";pb.addEventListener("click",function(ev){ev.stopPropagation();setReply(m);});acts.appendChild(rb);acts.appendChild(pb);row.appendChild(acts);' +
    'var rc=document.createElement("div");rc.className="reacts";row.appendChild(rc);' +
    'MSGS[m.id]={reactEl:rc,counts:{},mine:{}};' +
    'log.appendChild(row);log.scrollTop=log.scrollHeight;}' +
    /* ---- view switching + application/token auth against the backend ---- */
    'function show(v){gate.style.display=(v==="apply"||v==="pending")?"flex":"none";chat.style.display=v==="chat"?"flex":"none";applyView.style.display=v==="apply"?"block":"none";pendingView.style.display=v==="pending"?"block":"none";banEl.style.display=v==="ban"?"flex":"none";var lb=document.getElementById("loginBox");if(lb)lb.style.display=(v==="apply"&&!TOKEN)?"flex":"none";}' +
    /* banned/timed-out users get a blank screen instead of the chat. a permanent
       ban shows no "until"; a timeout shows the deadline and re-checks /status so
       access lifts on its own once the clock passes it. */
    'function pageHidden(){return !!document.hidden;}' +
    'function showBan(info){polling=false;var isTo=info&&info.reason==="timeout";banTitle.textContent=isTo?"you are timed out":"you are banned";if(isTo&&info.until){banUntil.textContent="until "+new Date(info.until).toLocaleString();banUntil.style.display="";}else{banUntil.style.display="none";}show("ban");if(statusT)clearTimeout(statusT);if(pollT){clearTimeout(pollT);pollT=null;}if(isTo&&!pageHidden())statusT=setTimeout(refreshGate,5000);}' +
    'function applyWarn(t){if(warnEl)warnEl.textContent=t;}' +
    'function applyEvent(ev){if(!ev)return;if(ev.type==="react"){if(seenEids[ev.eid])return;seenEids[ev.eid]=1;applyReact(ev.id,ev.e,ev.op);return;}if(ev.type==="msg"){if(MSGS[ev.id])return;add({id:ev.id,name:ev.name,text:ev.text,mine:ev.name===ME,reply:ev.reply||null});}}' +
    /* hidden tabs do not hit /events. coming back fires one /events?since= catch-up, then every 8s. */
    'function poll(){if(!polling||pageHidden())return;if(pollT){clearTimeout(pollT);pollT=null;}api("/events?since="+cursor+"&token="+encodeURIComponent(TOKEN)).then(function(r){if(r&&r.error==="unauthorized"){polling=false;refreshGate();return;}if(r&&r.blocked){showBan(r);return;}if(r&&r.events){r.events.forEach(applyEvent);if(typeof r.cursor==="number")cursor=r.cursor;}}).catch(function(){}).then(function(){if(polling&&!pageHidden())pollT=setTimeout(poll,8000);});}' +
    'function startPoll(){if(polling)return;polling=true;poll();}' +
    'function startChat(name){ME=name;nameEl.value=name;nameEl.readOnly=true;paintKey();show("chat");input.focus();startPoll();}' +
    /* render tung<->applicant follow-up messages on the pending screen; show the
       reply box only once tung has actually asked something. */
    'function renderThread(thread){thread=thread||[];appThread.innerHTML="";var hasAdmin=false;thread.forEach(function(m){var b=document.createElement("div");b.className="tmsg "+(m.from==="admin"?"admin":"me");b.textContent=(m.from==="admin"?"tung: ":"you: ")+m.text;appThread.appendChild(b);if(m.from==="admin")hasAdmin=true;});respBox.style.display=hasAdmin?"flex":"none";}' +
    'function refreshGate(){TOKEN=loadToken();paintKey();if(!TOKEN){show("apply");return;}if(pageHidden())return;api("/status?token="+encodeURIComponent(TOKEN)).then(function(s){if(!s||typeof s.status!=="string")return;if(s.status==="approved"){if(s.blocked){showBan(s);}else{startChat(s.username||"");}}else if(s.status==="pending"){show("pending");paintKey();renderThread(s.thread);if(statusT)clearTimeout(statusT);if(!pageHidden())statusT=setTimeout(refreshGate,3000);}else if(s.status==="none"||s.status==="rejected"){clearToken();TOKEN=null;paintKey();show("apply");}}).catch(function(){});}' +
    'applyForm.addEventListener("submit",function(ev){ev.preventDefault();if(loadToken()){refreshGate();return;}var u=gu.value.trim(),a=ga.value.trim();if(!u||!a){applyWarn("pick a username and write an application.");return;}applyBtn.disabled=true;applyWarn("submitting...");apiPost("/apply",{username:u,application:a}).then(function(r){applyBtn.disabled=false;if(r&&r.token){saveToken(r.token);TOKEN=r.token;refreshGate();}else if(r&&r.error==="username taken"){applyWarn("that username is taken — pick another.");}else{applyWarn("could not apply, try again.");}}).catch(function(){applyBtn.disabled=false;applyWarn("network error, try again.");});});' +
    'recheckBtn.addEventListener("click",function(){refreshGate();});' +
    'if(copyHashBtn)copyHashBtn.addEventListener("click",function(){copyKey(copyHashBtn);});' +
    'if(exportKeyBtn)exportKeyBtn.addEventListener("click",function(){copyKey(exportKeyBtn);});' +
    'var tipSend=document.getElementById("tipSend"),tipCancel=document.getElementById("tipCancel"),tipAmt=document.getElementById("tipAmt");' +
    'var profClose=document.getElementById("profClose"),profTipBtn=document.getElementById("profTip");' +
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
    'form.addEventListener("submit",function(ev){ev.preventDefault();var text=input.value.trim();if(!text)return;var id=mkId();var rep=replyTo?{id:replyTo.id,name:replyTo.name,text:replyTo.text}:null;input.value="";add({id:id,name:ME,text:text,mine:true,reply:rep});apiPost("/send",{token:TOKEN,id:id,text:text,reply:rep});cancelReply();});' +
    'pick.addEventListener("click",function(ev){ev.stopPropagation();picker.style.display=picker.style.display==="flex"?"none":"flex";rpal.style.display="none";});' +
    'document.addEventListener("click",function(){rpal.style.display="none";picker.style.display="none";});' +
    'buildPicker();buildRpal();buildCatalog();buildOriginals();' +
    'chooseShrine.addEventListener("click",function(){topShow("shrine");refreshGate();});' +
    'choosePlay.addEventListener("click",function(){topShow("play");});' +
    'chooseOriginals.addEventListener("click",function(){topShow("originals");});' +
    /* same opener as the catalog: same cloaked tab title and favicon, same
       header bar, same hidden nested-iframe lines. */
    'chooseVeil.addEventListener("click",function(){openPlay({n:' + JSON.stringify(LBL_WEB_VEIL) + ',u:' + JSON.stringify(VEIL_URL) + '});});' +
    'oback.addEventListener("click",function(){if(origplay.style.display==="flex"){hideOrigPlay();}else{topShow("choose");}});' +
    'chooseCasino.addEventListener("click",function(){topShow("casino");if(window.__casinoOpen)window.__casinoOpen();});' +   /* casino is a chooser bigbtn, same flow as the old header chip */
    'gback.addEventListener("click",function(){topShow("choose");});' +   /* "back" returns from the catalog grid to the chooser screen */
    'cback.addEventListener("click",function(){if(window.__casinoBack)window.__casinoBack();topShow("choose");});' +   /* casino "← back" returns to the chooser */
    'shopBtn.addEventListener("click",function(){if(window.__casinoShop)window.__casinoShop();});' +   /* shop lives on the casino header */
    'shrineBtn.addEventListener("click",function(){if(window.__casinoShrine)window.__casinoShrine();});' +   /* so does the shrine (the faucet) */
    'sback.addEventListener("click",function(){topShow("choose");});' +   /* "back" returns from the shrine/chat to the chooser screen */
    'gsearch.addEventListener("input",filterCatalog);' +
    'cloakTitleEl.value=cloakTitle();cloakFavEl.value=cloakFav();' +
    'cloakTitleEl.addEventListener("input",function(){try{localStorage.setItem(CLOAK_TKEY,cloakTitleEl.value);}catch(e){}document.title=cloakTitle();});' +
    'cloakFavEl.addEventListener("input",function(){try{localStorage.setItem(CLOAK_FKEY,cloakFavEl.value);}catch(e){}var fl=document.getElementById("cloakfav");if(fl)fl.href=cloakFav();});' +
    'document.title=cloakTitle();' +
    'topShow("choose");' +
    'document.addEventListener("visibilitychange",function(){if(pageHidden()){if(pollT){clearTimeout(pollT);pollT=null;}if(statusT){clearTimeout(statusT);statusT=null;}return;}if(polling)poll();if(pendingView.style.display==="block"||banEl.style.display==="flex")refreshGate();});' +
    /* the three lines from before, verbatim */
    'const iframe = document.createElement("iframe");' +
    'document.body.appendChild(iframe);' +
    'iframe.contentDocument.write("<iframe>");' +
    '})();';

  Shrine.CHAT_JS = SAHUR_CHAT_JS;
})();
