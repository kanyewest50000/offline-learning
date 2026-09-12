/* ==========================================================================
   Shrine of Tung — casino client
   Source text for the casino IIFE that runs inside the about:blank shrine
   window and owns everything under #casino: the lobby, dice, limbo, roulette,
   plinko, blackjack, mines, beef, the shop and the shrine faucet.
   ========================================================================== */
(function () {
  "use strict";
  var Shrine = (window.Shrine = window.Shrine || {});

  /* ---------------------------------------------------------------------------
     Tung's Casino client. A standalone IIFE (runs after the chat IIFE) that owns
     everything inside #casino. It shares nothing with the chat code except the
     saved token in localStorage and the SHRINE_API base. All outcomes come from
     the Deno server (server.ts) — this file only sends bets/actions and paints
     whatever the server returns, so a player editing this code changes nothing.
     Written as a template literal (no backticks / no ${ } inside) since it is
     injected into the about:blank shrine window. */
  var CASINO_JS = `
(function(){
  var API=SHRINE_API, TKEY="shrine-token-v1";
  function tok(){try{return localStorage.getItem(TKEY)||"";}catch(e){return "";}}
  function jget(p){return fetch(API+p).then(function(r){return r.json().catch(function(){return{};});});}
  function jpost(p,b){b=b||{};b.token=tok();return fetch(API+p,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(b)}).then(function(r){if(refused(r)){refusedGate();return;}return r.json().catch(function(){return{};});});}
  function el(t,c,txt){var e=document.createElement(t);if(c)e.className=c;if(txt!=null)e.textContent=txt;return e;}
  function sv(t,a){var e=document.createElementNS("http://www.w3.org/2000/svg",t);for(var k in a)e.setAttribute(k,a[k]);return e;}

  /* ---- drawn game icons (the rest stay emoji) ---- */
  var SPADE_D="M12 2.2c-.3 0-.5.1-.7.3C9 4.9 3.6 9.6 3.6 13.6c0 2.2 1.8 3.9 3.9 3.9.8 0 1.6-.3 2.2-.7-.2 1.5-1 2.8-2.3 3.6-.3.2-.4.5-.3.8.1.3.4.5.7.5h8.4c.3 0 .6-.2.7-.5.1-.3 0-.6-.3-.8-1.3-.8-2.1-2.1-2.3-3.6.6.4 1.4.7 2.2.7 2.1 0 3.9-1.7 3.9-3.9 0-4-5.4-8.7-7.7-11.1-.2-.2-.4-.3-.7-.3z";
  // plinko: a ball dropping with speed lines trailing above it
  function icoPlinko(){
    var s=sv("svg",{viewBox:"0 0 24 24",width:"26",height:"26","aria-hidden":"true"});
    [["M8.5 3.2h7",".38"],["M6 7h12",".6"],["M8.8 10.8h6.4",".85"]].forEach(function(p){
      s.appendChild(sv("path",{d:p[0],stroke:"currentColor","stroke-width":"1.9","stroke-linecap":"round",fill:"none",opacity:p[1]}));
    });
    s.appendChild(sv("circle",{cx:"12",cy:"18",r:"4.2",fill:"currentColor"}));
    return s;
  }
  // blackjack: a playing card with the ace of spades centred on it
  function icoBlackjack(){
    var s=sv("svg",{viewBox:"0 0 24 24",width:"26",height:"26","aria-hidden":"true"});
    s.appendChild(sv("rect",{x:"5",y:"2.5",width:"14",height:"19",rx:"2.6",fill:"currentColor","fill-opacity":".15",stroke:"currentColor","stroke-width":"1.5"}));
    var g=sv("g",{transform:"translate(6.48,6.48) scale(0.46)"});
    g.appendChild(sv("path",{fill:"currentColor",d:SPADE_D}));
    s.appendChild(g);
    return s;
  }
  // the pit's own two: tung himself, and a single card on its back
  function icoPitTung(){
    var i=el("img","piticon");
    i.src=(typeof TUNG_IMG!=="undefined")?TUNG_IMG:"";i.alt="";
    i.onerror=function(){i.style.display="none";};
    return i;
  }
  function icoCut(){
    var s=sv("svg",{viewBox:"0 0 24 24",width:"26",height:"26","aria-hidden":"true"});
    s.appendChild(sv("rect",{x:"6",y:"2.5",width:"12",height:"19",rx:"2.6",fill:"currentColor","fill-opacity":".15",stroke:"currentColor","stroke-width":"1.5"}));
    s.appendChild(sv("path",{d:"M9.5 8.5h5M9.5 12h5M9.5 15.5h5",stroke:"currentColor","stroke-width":"1.5","stroke-linecap":"round",fill:"none",opacity:".7"}));
    return s;
  }
  // competitive gambling: a chip that is also a clock, because it is both
  function icoComp(){
    var s=sv("svg",{viewBox:"0 0 24 24",width:"26",height:"26","aria-hidden":"true"});
    s.appendChild(sv("circle",{cx:"12",cy:"12",r:"8.4",fill:"currentColor","fill-opacity":".15",stroke:"currentColor","stroke-width":"1.5"}));
    ["M12 3.6V6","M12 18V20.4","M3.6 12H6","M18 12H20.4"].forEach(function(d){
      s.appendChild(sv("path",{d:d,stroke:"currentColor","stroke-width":"1.7","stroke-linecap":"round",fill:"none"}));
    });
    s.appendChild(sv("path",{d:"M12 8.2V12l2.7 1.7",fill:"none",stroke:"currentColor","stroke-width":"1.7","stroke-linecap":"round","stroke-linejoin":"round"}));
    return s;
  }
  function gameIcon(id){
    if(id==="plinko")return icoPlinko();
    if(id==="blackjack")return icoBlackjack();
    if(id==="pit-tung")return icoPitTung();
    if(id==="pit-cut")return icoCut();
    if(id==="pit-comp")return icoComp();
    return el("span",null,{roulette:"◉",mines:"💣",beef:"🐄",limbo:"📈",dice:"🎲"}[id]||"");
  }
  function money(n){return (Math.round(Number(n)*100)/100).toFixed(2);}
  function mult(n){return (Math.round(Number(n)*100)/100).toFixed(2)+"x";}

  var screen=document.getElementById("casscreen");
  var balEl=document.getElementById("casbal");
  var casEl=document.getElementById("casino");
  var BAL=0, claimTimer=null;
  function setBal(b){if(typeof b==="number"&&!isNaN(b)){BAL=b;balEl.textContent=money(b);paintBars();}}

  /* Out of sahurs? point them at the shrine. Inside a game that prompt shows
     every time they are dry, since it is the answer to "why can't I bet". In
     the lobby it is a one-time nudge for a new player, remembered per browser. */
  var VIEW="lobby", brokeEl=null, BROKE_KEY="shrine-broke-hint";
  function hideBroke(){if(brokeEl&&brokeEl.parentNode)brokeEl.parentNode.removeChild(brokeEl);}
  function buildBroke(){
    var e=el("div","brokebar");
    var t=el("div","grow");
    t.appendChild(el("h4",null,"you are out of sahurs"));
    t.appendChild(el("p",null,"tung tung god provides, and asks nothing back. claim your free sahurs at the shrine."));
    e.appendChild(t);
    var go=el("button","cbtn go","go to the shrine");
    go.onclick=function(){if(window.__casinoShrine)window.__casinoShrine();};
    e.appendChild(go);
    var x=el("button","brokex","\u2715");x.title="dismiss";
    x.onclick=hideBroke;
    e.appendChild(x);
    return e;
  }
  function paintBroke(){
    var w=screen.querySelector(".caswrap");
    if(!w||VIEW==="shrine"){hideBroke();return;}      // no point nagging at the shrine itself
    if(ROUND.live){hideBroke();return;}               // nor mid-round: they have wood to spend and their sahurs are in the pot
    if(BAL>0.0001){hideBroke();return;}
    if(VIEW==="lobby"){
      var seen=false;try{seen=localStorage.getItem(BROKE_KEY)==="1";}catch(e){}
      if(seen){hideBroke();return;}
      try{localStorage.setItem(BROKE_KEY,"1");}catch(e){}
    }
    if(!brokeEl)brokeEl=buildBroke();
    if(brokeEl.parentNode!==w)w.insertBefore(brokeEl,w.firstChild);
  }
  /* leaving a table stops holding its wager: from here on the server's own
     number is the honest one, whatever the table was in the middle of showing */
  function clearTimer(){if(claimTimer){clearInterval(claimTimer);claimTimer=null;}ROUND.hold=false;pitStop();}
  /* the two strips that ride above whatever screen is open */
  function paintBars(){paintBroke();paintRound();}

  /* ---- a round of Competitive Gambling, from anywhere in the casino ----
     A round is the one thing in here that is not a screen. The player is not
     sat at the pit's table for those three minutes, they are out on the floor
     spending wood, and the floor is every other page in the casino. So the
     round gets a bar of its own that rides above whatever they have open —
     both stacks and the clock — and a poll that outlives every navigation,
     because the three minutes do not care which table they are standing at.
     The wood itself is the server's: this only paints what it is told. */
  var ROUND={live:null,poll:null,tick:null,bar:null,done:null,mine:0,hold:false};
  function hideRound(){if(ROUND.bar&&ROUND.bar.parentNode)ROUND.bar.parentNode.removeChild(ROUND.bar);}
  function roundStop(){
    if(ROUND.poll){clearInterval(ROUND.poll);ROUND.poll=null;}
    if(ROUND.tick){clearInterval(ROUND.tick);ROUND.tick=null;}
    ROUND.live=null;ROUND.hold=false;hideRound();
  }
  function buildRound(){
    var e=el("div","roundbar");
    e.appendChild(el("span","rtag","round"));
    var mine=el("div","rside");
    mine.appendChild(el("b",null,"you"));
    mine._v=el("span","rv","-");mine.appendChild(mine._v);
    var theirs=el("div","rside");
    theirs._n=el("b",null,"them");theirs.appendChild(theirs._n);
    theirs._v=el("span","rv","-");theirs.appendChild(theirs._v);
    /* the unit sits between the two stacks, exactly as it does on the big
       scoreboard, so the bar and the table's page read as the same thing */
    e.appendChild(mine);e.appendChild(el("span","rvs","wood"));e.appendChild(theirs);
    e._clock=el("span","rclock","");e.appendChild(e._clock);
    var go=el("button","cbtn sec","the table");
    go.onclick=function(){if(ROUND.live){var v=ROUND.live;clearTimer();pitEnter(v);}};
    e.appendChild(go);
    e._mine=mine;e._theirs=theirs;
    return e;
  }
  function paintRound(){
    if(!ROUND.live){hideRound();return;}
    var w=screen.querySelector(".caswrap");
    /* the table's own page says all of this bigger, so the bar stands down there */
    if(!w||VIEW==="pit"){hideRound();return;}
    if(!ROUND.bar)ROUND.bar=buildRound();
    if(ROUND.bar.parentNode!==w)w.insertBefore(ROUND.bar,w.firstChild);
    paintRoundClock();
  }
  function paintRoundClock(){
    var d=ROUND.live,b=ROUND.bar;
    if(!d||!b||!b.isConnected)return;
    var mine=ROUND.mine;
    b._mine._v.textContent=money(mine);
    b._theirs._n.textContent=d.theirName||"them";
    b._theirs._v.textContent=money(d.theirChips);
    b._mine.className="rside"+(mine>d.theirChips?" up":(mine<d.theirChips?" down":""));
    b._theirs.className="rside"+(d.theirChips>mine?" up":(d.theirChips<mine?" down":""));
    var ms=pitLeft(d.deadline);
    b._clock.textContent=pitClockText(ms);
    b._clock.className="rclock"+(ms<=15000?" hot":"");
  }
  /* One duel view in, and everything that cares about a round picks it up: the
     bar, the poll, and the moment it stops being live. */
  function roundSync(v){
    if(v&&v.game==="comp"&&v.state==="live"){
      var fresh=!ROUND.live;
      ROUND.live=v;
      /* while a table is still playing a wager out, the number it is going to
         land on is not ours to paint yet — see roundBet below */
      if(fresh||!ROUND.hold)ROUND.mine=v.yourChips;
      if(!ROUND.poll)ROUND.poll=setInterval(roundPoll,1400);
      if(!ROUND.tick)ROUND.tick=setInterval(paintRoundClock,250);
      paintRound();
      return;
    }
    if(!ROUND.live)return;
    /* the buzzer. take them to the result wherever in the casino they are
       standing — and if they are not in the casino at all, hold it for when
       they next open it, because the pot has already moved without them. */
    var over=(v&&v.id===ROUND.live.id)?v:null;
    roundStop();
    if(!over)return;
    /* topShow() sets this display outright, so it is the honest answer to "is
       the casino the thing on screen" — and an empty one means this window has
       never opened the casino at all, which counts as not looking. */
    var watching=casEl&&casEl.style.display&&casEl.style.display!=="none";
    if(watching){clearTimer();pitEnter(over);}
    else ROUND.done=over;
  }
  function roundPoll(){
    if(!ROUND.live){roundStop();return;}
    /* the pit's own page is already polling this duel; two would only race */
    if(VIEW==="pit")return;
    jget("/duel/state?token="+encodeURIComponent(tok())+"&id="+encodeURIComponent(ROUND.live.id)).then(function(d){
      if(refused(d)){roundStop();refusedGate();return;}
      if(!d||d.error){if(d&&d.error==="gone")roundStop();return;}
      pitSkew(d);setBal(d.balance);roundSync(d.duel);
    }).catch(function(){});
  }
  /* Every wager on the floor names the round it believes it is in. The server
     decides which purse it comes out of either way — this can only ever stop a
     bet, never aim one — so a roll meant as wood cannot land on real sahurs
     because the buzzer went while they were reaching for the button. */
  function wager(body){if(ROUND.live)body.round=ROUND.live.id;return body;}

  /* ---- a wager is not over until the table has finished showing it ----
     The server answers a bet with the stack it landed on, and it answers the
     instant the bet is decided — which on every table here is well before the
     player has seen it happen. Painting that number as it arrives would give
     the wheel away while it was still spinning, the cow away mid-lane and the
     dealer's hole card away before he turned it. So the stack is held from the
     moment a stake leaves it until the table says it has finished: roundBet()
     takes the stake off the pile, roundSaw() lands whatever came back. The poll
     keeps its hands off in between, since all it knows is the answer. */
  function roundBet(amount){
    if(!ROUND.live)return;
    ROUND.hold=true;
    var n=Number(amount);
    if(isFinite(n)&&n>0)ROUND.mine=Math.max(0,Math.round((ROUND.mine-n)*100)/100);
    paintRoundClock();pitPaintClock();
  }
  /* a stake is out and the table is holding it — a board dealt, a hand in
     motion. The stack is the server's number now, but it is still held: what
     that stake is worth has not been decided yet. */
  function roundStaked(d){
    if(!ROUND.live||!d||typeof d.wood!=="number")return;
    ROUND.mine=d.wood;paintRoundClock();pitPaintClock();
  }
  function roundSaw(d){
    if(!ROUND.live)return;
    ROUND.hold=false;
    ROUND.mine=(d&&typeof d.wood==="number")?d.wood:ROUND.live.yourChips;
    paintRoundClock();pitPaintClock();
    if(d&&d.roundOver)roundPoll();
  }

  /* the win celebration: a box that pops over the whole casino showing what you
     just took, then fades. shared by every game. */
  var winpop=null;
  /* The toast has to go inert once it has played. Leaving the casino sets
     #casino to display:none, and returning flips it back to display:flex —
     which RESTARTS any css animation still attached, replaying the previous
     game's win out of nowhere. So .show is stripped the moment the keyframes
     finish, and again whenever the casino is entered or left. */
  function hideWin(){ if(winpop) winpop.classList.remove("show"); }
  function celebrate(payout,m){
    if(!(Number(payout)>0))return;
    if(!winpop){
      winpop=el("div");winpop.id="winpop";
      winpop._a=el("span","wamt","");winpop._m=el("span","wmul","");
      winpop.appendChild(winpop._a);winpop.appendChild(winpop._m);
      winpop.addEventListener("animationend",hideWin);
      casEl.appendChild(winpop);
    }
    winpop._a.textContent="+"+money(payout)+(ROUND.live?" wood":" sahurs");
    winpop._m.textContent=mult(m);
    winpop.classList.remove("show");
    void winpop.offsetWidth;            /* restart the keyframes */
    winpop.classList.add("show");
  }

  window.__casinoBack=function(){clearTimer();hideWin();};
  window.__casinoShop=function(){clearTimer();hideWin();viewShop();};
  window.__casinoShrine=function(){clearTimer();hideWin();viewShrine();};

  window.__casinoOpen=function(){
    clearTimer();hideWin();
    if(DEAD_KEY&&!tok()){deadKeyGate();return;}
    var lw=column();
    var l=el("div","casgate");l.appendChild(el("p",null,"loading the tables..."));lw.appendChild(l);
    jget("/cas/me?token="+encodeURIComponent(tok())).then(function(d){
      if(refused(d)){refusedGate();return;}
      if(!d||d.error){showGate();return;}
      setBal(d.balance);
      /* a round runs whether or not this window is looking at it, so the first
         thing the casino asks on the way in is whether one is still going —
         and whether one finished while they were somewhere else */
      roundSync(d.round||null);
      if(ROUND.done){var fin=ROUND.done;ROUND.done=null;pitEnter(fin);return;}
      renderLobby(d);
    }).catch(netGate);
  };

  /* Every gate screen is the same shape: a heading and some lines, painted over
     whatever was on the table. Going through here means no screen can be left
     showing a half-finished "loading..." when a request comes back refused. */
  function gate(title,lines){
    clearTimer();
    var gw=column();
    var g=el("div","casgate");
    g.appendChild(el("h3",null,title));
    for(var i=0;i<lines.length;i++)g.appendChild(el("p",null,lines[i]));
    gw.appendChild(g);
  }

  function showGate(){
    gate("members only",[
      "Tung's Casino is for approved members of the Shrine of Tung. You need chat access to play.",
      "Head back and open the Shrine of Tung to apply. Once tung approves you, your sahurs live under that same username."
    ]);
  }

  /* Set once we have dropped a key the server disowned. Without it the next
     screen would fall back to the generic "members only" gate, because by then
     there is genuinely no key left to explain — and the reason they are looking
     at a gate would quietly change out from under them. */
  var DEAD_KEY=false;
  function clearTok(){DEAD_KEY=true;try{localStorage.removeItem(TKEY);}catch(e){}}

  function deadKeyGate(){
    gate("this key is no longer valid",[
      "the account it belonged to is gone. tung may have removed it, or it was never his to begin with.",
      "head back and open the Shrine of Tung to apply again. you will be given a new key."
    ]);
  }

  /* did the server refuse our key? casUser() collapses deleted, unapproved and
     banned all into one "unauthorized", so this only tells us it said no. */
  function refused(d){return !!(d&&d.error==="unauthorized");}

  /* The key was refused. /cas/me cannot say why, so ask /status — the same
     endpoint the chat believes — and name the actual reason. A key the server
     has disowned is dropped here rather than retried forever, which is what the
     chat does too; a key that is merely blocked or pending is kept. */
  function refusedGate(){
    var t=tok();
    if(!t){if(DEAD_KEY){deadKeyGate();}else{showGate();}return;}
    gate("checking your key\u2026",["one moment."]);
    jget("/status?token="+encodeURIComponent(t)).then(function(s){
      var st=s&&s.status;
      if(st==="approved"){
        if(s.blocked){
          gate("you are blocked",[
            s.reason==="banned"
              ? "tung has barred you from the shrine. the tables are shut to you."
              : "you are timed out. the tables reopen when it lifts.",
            "nothing you had is gone. it waits."
          ]);
        }else{
          showGate();
        }
        return;
      }
      if(st==="pending"){
        gate("still pending",[
          "tung has not finished reading your application.",
          "the tables open the moment he approves you."
        ]);
        return;
      }
      /* "none" (deleted, or never existed) and "rejected": this key is spent */
      clearTok();setBal(0);deadKeyGate();
    }).catch(function(){
      gate("the shrine did not answer",[
        "could not reach the shrine to check your key.",
        "check your connection and try again."
      ]);
    });
  }

  /* a request died in transit — never clear a key over a network blip */
  function netGate(){
    gate("the shrine did not answer",[
      "the tables could not be reached.",
      "check your connection and try again."
    ]);
  }

  /* ---------- the Shrine of Tung Tung God (the faucet), its own page ---------- */
  function viewShrine(){
    var v=mount("Shrine of Tung Tung God","⛲");VIEW="shrine";hideBroke();
    var altar=el("div","altar");
    var img=el("img","godimg");
    img.src=(typeof TUNGGOD_IMG!=="undefined")?TUNGGOD_IMG:"";
    img.alt="Tung Tung God";
    img.onerror=function(){img.style.display="none";};
    altar.appendChild(img);
    altar.appendChild(el("p","godsub","offer nothing. receive sahurs. such is his way."));
    var claim=el("button","cbtn go");claim.id="casclaim";
    altar.appendChild(claim);
    var sub=el("p","godnote","");altar.appendChild(sub);
    v.appendChild(altar);
    var r=res(v);

    var me={canClaim:false,nextClaim:0,faucetAmount:10};
    function paintClaim(){
      var now=Date.now();
      if(me.canClaim||!me.nextClaim||now>=me.nextClaim){
        claim.disabled=false;claim.textContent="claim "+(me.faucetAmount||10)+" sahurs";
        sub.textContent="free sahurs, on the house. every 2 hours.";clearTimer();
      }else{
        claim.disabled=true;
        var s=Math.max(0,Math.floor((me.nextClaim-now)/1000));
        var h=Math.floor(s/3600),m=Math.floor((s%3600)/60),ss=s%60;
        claim.textContent="next claim in "+h+"h "+(m<10?"0":"")+m+"m "+(ss<10?"0":"")+ss+"s";
        sub.textContent="tung already blessed you. he does not pour twice in two hours. sit.";
      }
    }
    claim.disabled=true;claim.textContent="consulting the shrine...";
    jget("/cas/me?token="+encodeURIComponent(tok())).then(function(d){
      /* these two paint a whole new screen, which is the point: leaving the
         claim button sitting on "consulting the shrine..." is how this page
         used to hang forever on a key the server had already refused. */
      if(refused(d)){refusedGate();return;}
      if(!d||d.error){showGate();return;}
      setBal(d.balance);
      me.canClaim=d.canClaim;me.nextClaim=d.nextClaim;me.faucetAmount=d.faucetAmount||10;
      paintClaim();clearTimer();claimTimer=setInterval(paintClaim,1000);
    }).catch(netGate);

    claim.onclick=function(){
      claim.disabled=true;
      jpost("/cas/claim",{}).then(function(d){if(refused(d)){refusedGate();return;}
        if(d&&d.ok){
          setBal(d.balance);me.canClaim=false;me.nextClaim=d.nextClaim;
          celebrate(d.claimed,1);ok(r,"tung tung god provides.");
        }else if(d&&d.nextClaim){me.canClaim=false;me.nextClaim=d.nextClaim;}
        paintClaim();
      }).catch(paintClaim);
    };
  }

  /* ---------- lobby ---------- */
  function renderLobby(me){
    clearTimer();VIEW="lobby";
    var w=column();
    // no shrine card here: the Shrine button in the header is the only way in
    // the pit first: the tables where the opponent is a person, not the house
    w.appendChild(el("div","seclabel","the pit — player against player"));
    var pit=el("div","casmenu pit");
    [["Tung, Wood, Fire","pit-tung"],["The Cut","pit-cut"],["Competitive Gambling","pit-comp"]].forEach(function(g){
      var b=el("button","casgame pvp");
      var ci=el("div","ci");ci.appendChild(gameIcon(g[1]));
      b.appendChild(ci);
      b.appendChild(el("div",null,g[0]));
      b.onclick=function(){openPlay(g[1]);};
      pit.appendChild(b);
    });
    w.appendChild(pit);
    w.appendChild(el("div","seclabel","the floor — you against tung"));
    w.appendChild(floorMenu(""));
    paintBars();
    w.appendChild(el("div","casnote","Sahurs have no cash value and can never be bought, sold, or cashed out."));
  }

  /* The house's own tables. The lobby and a live round both lay these out, and
     they lay out the same ones: a round is the whole floor, not a corner of it. */
  var FLOOR=[["Blackjack","blackjack"],["Roulette","roulette"],["Mines","mines"],
    ["Beef","beef"],["Limbo","limbo"],["Dice","dice"],["Plinko","plinko"]];
  function floorMenu(cls){
    var grid=el("div","casmenu"+(cls?" "+cls:""));
    FLOOR.forEach(function(g){
      var b=el("button","casgame");
      var ci=el("div","ci");ci.appendChild(gameIcon(g[1]));
      b.appendChild(ci);
      b.appendChild(el("div",null,g[0]));
      b.onclick=function(){openPlay(g[1]);};
      grid.appendChild(b);
    });
    return grid;
  }

  function openPlay(name){
    clearTimer();
    if(name.indexOf("pit-")===0)return viewPit(name.slice(4));
    if(name==="dice")return viewDice();
    if(name==="limbo")return viewLimbo();
    if(name==="roulette")return viewRoulette();
    if(name==="plinko")return viewPlinko();
    if(name==="blackjack")return viewBlackjack();
    if(name==="mines")return viewMines();
    if(name==="beef")return viewBeef();
  }

  /* ---------- shared scaffolding ---------- */
  /* every screen lives in one centred column so nothing pins to the left edge
     or sprawls across a wide desktop window */
  function column(){screen.innerHTML="";var w=el("div","caswrap");screen.appendChild(w);return w;}
  function mount(title,icon){
    VIEW="game";
    var w=column();
    var back=el("button","casback","← back to lobby");
    back.onclick=function(){window.__casinoOpen();};
    w.appendChild(back);
    var v=el("div","casview");
    var h=el("h3");
    h.appendChild(typeof icon==="string"?el("span",null,icon):icon);
    h.appendChild(el("span",null,title));
    v.appendChild(h);
    w.appendChild(v);
    paintBars();
    return v;
  }
  function betField(def){var i=el("input");i.type="number";i.min="0.1";i.step="0.1";i.value=def||"1";return i;}
  function ctl(label,node){var c=el("div","ctl");c.appendChild(el("span",null,label));c.appendChild(node);return c;}
  function selectOf(opts,def){var s=el("select");opts.forEach(function(o){var op=el("option",null,o[1]);op.value=o[0];s.appendChild(op);});if(def)s.value=def;return s;}
  function res(v){var r=el("div","casres","");v.appendChild(r);return r;}
  function ok(r,t){r.className="casres win";r.textContent=t;}
  function bad(r,t){r.className="casres lose";r.textContent=t;}
  function statBox(label){var s=el("div","stat");s.appendChild(el("b",null,label));var val=el("span",null,"-");s.appendChild(val);s.val=val;return s;}
  function pcell(label,cls){var c=el("div","pcell"+(cls?" "+cls:""));c.appendChild(el("b",null,label));var s=el("span",null,"-");c.appendChild(s);c.val=s;return c;}
  function divider(){return el("div","pdiv");}

  /* ---------- DICE ---------- */
  function viewDice(){
    var v=mount("Dice","🎲");
    var bet=betField("1");
    var row=el("div","ctlrow");
    row.appendChild(ctl("bet",bet));
    var seg=el("div","seg");
    var bUnder=el("button",null,"roll under");var bOver=el("button",null,"roll over");
    seg.appendChild(bUnder);seg.appendChild(bOver);
    row.appendChild(ctl("direction",seg));
    v.appendChild(row);

    var OVER=false, TARGET=50;
    var readout=el("div",null,"—");
    readout.style.cssText="text-align:center;font-size:34px;font-weight:800;color:#f2c063;font-variant-numeric:tabular-nums;padding:10px 0 6px;line-height:1";
    v.appendChild(readout);

    var wrap=el("div","dicewrap");
    var track=el("div","dtrack");
    var win=el("div","dwin");track.appendChild(win);
    var mark=el("div","dmark");mark.style.left="50%";track.appendChild(mark);
    var handle=el("div","dhandle");track.appendChild(handle);
    wrap.appendChild(track);
    var scale=el("div","dscale");
    ["0","25","50","75","100"].forEach(function(t){scale.appendChild(el("span",null,t));});
    wrap.appendChild(scale);
    v.appendChild(wrap);

    var stats=el("div","dstats");
    var sTarget=statBox("target"),sChance=statBox("win chance"),sPay=statBox("payout");
    stats.appendChild(sTarget);stats.appendChild(sChance);stats.appendChild(sPay);
    v.appendChild(stats);
    var r=res(v);
    var go=el("button","cbtn go","roll");v.appendChild(go);

    function paint(){
      bUnder.className=OVER?"":"on";bOver.className=OVER?"on":"";
      handle.style.left=TARGET+"%";
      if(OVER){win.style.left=TARGET+"%";win.style.right="0";win.style.width="auto";}
      else{win.style.left="0";win.style.width=TARGET+"%";win.style.right="auto";}
      var chance=OVER?(100-TARGET):TARGET;
      sTarget.val.textContent=(OVER?"> ":"< ")+TARGET.toFixed(0);
      sChance.val.textContent=chance.toFixed(0)+"%";
      sPay.val.textContent=(99/chance).toFixed(3)+"x";
    }
    function setTarget(t){TARGET=Math.min(98,Math.max(2,Math.round(t)));paint();}
    bUnder.onclick=function(){OVER=false;paint();};
    bOver.onclick=function(){OVER=true;paint();};
    function fromEvent(ev){
      var rect=track.getBoundingClientRect();
      var x=(ev.touches?ev.touches[0].clientX:ev.clientX)-rect.left;
      setTarget(x/rect.width*100);
    }
    var dragging=false;
    function down(ev){dragging=true;fromEvent(ev);ev.preventDefault();}
    function move(ev){if(dragging)fromEvent(ev);}
    function up(){dragging=false;}
    track.addEventListener("mousedown",down);track.addEventListener("touchstart",down,{passive:false});
    document.addEventListener("mousemove",move);document.addEventListener("touchmove",move,{passive:false});
    document.addEventListener("mouseup",up);document.addEventListener("touchend",up);
    paint();

    go.onclick=function(){
      go.disabled=true;r.className="casres";r.textContent="";
      roundBet(bet.value);
      jpost("/cas/dice",wager({bet:Number(bet.value),target:TARGET,over:OVER})).then(function(d){if(refused(d)){refusedGate();return;}
        if(d.error){go.disabled=false;roundSaw(d);bad(r,d.error);return;}
        // slide the marker to the rolled spot while the number counts up to it
        var from=parseFloat(mark.style.left)||0, to=d.roll, t0=Date.now(), dur=520;
        mark.style.background=d.win?"#6ee787":"#ff8080";
        mark.style.boxShadow="0 0 8px "+(d.win?"#6ee787":"#ff8080");
        mark.style.left=to+"%";
        readout.style.color="#f5efe0";
        (function tick(){
          var p=Math.min(1,(Date.now()-t0)/dur);
          var e=1-Math.pow(1-p,3);
          readout.textContent=(from+(to-from)*e).toFixed(2);
          if(p<1)requestAnimationFrame(tick);
          else{
            readout.textContent=to.toFixed(2);
            readout.style.color=d.win?"#6ee787":"#e0908a";
            go.disabled=false;setBal(d.balance);roundSaw(d);
            if(d.win){ok(r,"rolled "+d.roll.toFixed(2)+"  —  WIN "+mult(d.multiplier));celebrate(d.payout,d.multiplier);}
            else bad(r,"rolled "+d.roll.toFixed(2)+"  —  needed "+(d.over?"above ":"below ")+d.target+". lost.");
          }
        })();
      }).catch(function(){go.disabled=false;roundSaw(null);bad(r,"network error");});
    };
  }

  /* ---------- LIMBO ---------- */
  function viewLimbo(){
    var v=mount("Limbo","📈");
    var bet=betField("1");
    var tgt=el("input");tgt.type="number";tgt.min="1.01";tgt.step="0.01";tgt.value="2";
    var row=el("div","ctlrow");
    row.appendChild(ctl("bet",bet));row.appendChild(ctl("target x",tgt));
    v.appendChild(row);
    var big=el("div",null,"1.00x");
    big.style.cssText="font-size:46px;font-weight:800;text-align:center;padding:26px 0;color:#f2c063;font-variant-numeric:tabular-nums;line-height:1";
    v.appendChild(big);
    var r=res(v);
    var go=el("button","cbtn go","play");v.appendChild(go);
    go.onclick=function(){
      go.disabled=true;r.className="casres";r.textContent="";
      roundBet(bet.value);
      jpost("/cas/limbo",wager({bet:Number(bet.value),target:Number(tgt.value)})).then(function(d){if(refused(d)){refusedGate();return;}
        if(d.error){go.disabled=false;roundSaw(d);bad(r,d.error);return;}
        setBal(d.balance);
        var target=d.crash,t0=Date.now(),dur=750;
        big.style.color="#f5efe0";
        (function tick(){
          var p=Math.min(1,(Date.now()-t0)/dur);
          big.textContent=(1+(target-1)*(1-Math.pow(1-p,3))).toFixed(2)+"x";
          if(p<1)requestAnimationFrame(tick);
          else{
            big.textContent=target.toFixed(2)+"x";
            big.style.color=d.win?"#6ee787":"#e0908a";
            go.disabled=false;roundSaw(d);
            if(d.win){ok(r,"crashed at "+mult(d.crash)+"  —  WIN");celebrate(d.payout,d.multiplier);}
            else bad(r,"crashed at "+mult(d.crash)+"  —  needed "+mult(d.target)+". lost.");
          }
        })();
      }).catch(function(){go.disabled=false;roundSaw(null);bad(r,"network error");});
    };
  }

  /* ---------- ROULETTE ---------- */
  var WHEEL=[0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
  var REDS={};[1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36].forEach(function(n){REDS[n]=1;});
  function colorOf(n){return n===0?"green":(REDS[n]?"red":"black");}
  function viewRoulette(){
    var v=mount("Roulette","◉");
    var bet=betField("1");
    var row=el("div","ctlrow");row.appendChild(ctl("bet",bet));v.appendChild(row);

    var SZ=320,C=SZ/2,R1=150,R2=92,step=360/37;
    var wrap=el("div","wheelwrap");
    var svg=sv("svg",{width:SZ,height:SZ,viewBox:"0 0 "+SZ+" "+SZ});
    var g=sv("g",{});g.setAttribute("class","wheel");
    function pt(rr,deg){var a=(deg-90)*Math.PI/180;return [C+rr*Math.cos(a),C+rr*Math.sin(a)];}
    WHEEL.forEach(function(n,i){
      var a0=i*step-step/2,a1=i*step+step/2;
      var o0=pt(R1,a0),o1=pt(R1,a1),i1=pt(R2,a1),i0=pt(R2,a0);
      var d="M"+o0[0]+" "+o0[1]+" A"+R1+" "+R1+" 0 0 1 "+o1[0]+" "+o1[1]+" L"+i1[0]+" "+i1[1]+" A"+R2+" "+R2+" 0 0 0 "+i0[0]+" "+i0[1]+" Z";
      var col=colorOf(n);
      g.appendChild(sv("path",{d:d,fill:col==="green"?"#1f6b32":(col==="red"?"#a32020":"#23232b"),stroke:"#0d0d10","stroke-width":"0.7"}));
      var tp=pt((R1+R2)/2,i*step);
      var tx=sv("text",{x:tp[0],y:tp[1],fill:"#fff","font-size":"9","font-weight":"700","text-anchor":"middle","dominant-baseline":"central",transform:"rotate("+(i*step)+" "+tp[0]+" "+tp[1]+")"});
      tx.textContent=String(n);g.appendChild(tx);
    });
    svg.appendChild(g);
    svg.appendChild(sv("circle",{cx:C,cy:C,r:R2-6,fill:"#2b1a0a",stroke:"#7a5a1a","stroke-width":"2"}));
    // the ball rides just inside the rim in its own group, spun the other way.
    // an inner group hops radially + wobbles a few pockets as it drops in.
    var ballG=sv("g",{});ballG.setAttribute("class","ball");
    var hop=sv("g",{});hop.setAttribute("class","ballhop");
    hop.appendChild(sv("circle",{cx:C,cy:C-(R1-11),r:5.5,fill:"#fff",stroke:"#1d1206","stroke-width":"1"}));
    hop.appendChild(sv("circle",{cx:C-1.6,cy:C-(R1-12.6),r:1.8,fill:"#ffffffee"}));
    ballG.appendChild(hop);
    svg.appendChild(ballG);
    wrap.appendChild(svg);v.appendChild(wrap);
    g.style.transformOrigin=C+"px "+C+"px";
    ballG.style.transformOrigin=C+"px "+C+"px";
    hop.style.transformOrigin=C+"px "+C+"px";
    hop.style.transformBox="view-box";

    var SEL={kind:"red",value:0};
    var board=el("div","rboard");
    var cells={};
    for(var n=0;n<=36;n++){(function(num){
      var c=el("div","rnum "+colorOf(num),String(num));
      c.onclick=function(){SEL={kind:"number",value:num};paintSel();};
      cells[num]=c;board.appendChild(c);
    })(n);}
    v.appendChild(board);
    var outs=el("div","routside");
    var OUT=[["red","Red"],["black","Black"],["odd","Odd"],["even","Even"],["low","1-18"],["high","19-36"],
             ["dozen","1st 12",1],["dozen","2nd 12",2],["dozen","3rd 12",3],
             ["column","Col 1",1],["column","Col 2",2],["column","Col 3",3]];
    var outEls=[];
    OUT.forEach(function(o){
      var b=el("div","rout",o[1]);
      b.onclick=function(){SEL={kind:o[0],value:o[2]||0};paintSel();};
      b._k=o[0];b._v=o[2]||0;outEls.push(b);outs.appendChild(b);
    });
    v.appendChild(outs);
    var selInfo=el("div","casnote","");v.appendChild(selInfo);
    function paintSel(){
      for(var n=0;n<=36;n++)cells[n].classList.toggle("sel",SEL.kind==="number"&&SEL.value===n);
      outEls.forEach(function(b){b.classList.toggle("sel",b._k===SEL.kind&&b._v===(SEL.value||0)&&SEL.kind!=="number");});
      selInfo.textContent="betting: "+(SEL.kind==="number"?("number "+SEL.value):
        (SEL.kind==="dozen"?("dozen "+SEL.value):(SEL.kind==="column"?("column "+SEL.value):SEL.kind)));
    }
    var r=res(v);
    var go=el("button","cbtn go","spin");v.appendChild(go);
    paintSel();

    var rot=0, brot=0;
    go.onclick=function(){
      go.disabled=true;r.className="casres";r.textContent="spinning...";
      roundBet(bet.value);
      jpost("/cas/roulette",wager({bet:Number(bet.value),kind:SEL.kind,value:SEL.value})).then(function(d){if(refused(d)){refusedGate();return;}
        if(d.error){go.disabled=false;roundSaw(d);bad(r,d.error);return;}
        var idx=WHEEL.indexOf(d.spin);
        // wheel forward so the winning pocket ends at the top, under the ball
        rot += 360*5 + (((-idx*step - rot) % 360) + 360) % 360;
        g.style.transform="rotate("+rot+"deg)";
        // ball orbits the other way, then hops between pockets as it drops in
        brot -= 360*7;
        ballG.classList.remove("dropping");
        void ballG.getBoundingClientRect();
        ballG.classList.add("dropping");
        ballG.style.transform="rotate("+brot+"deg)";
        setTimeout(function(){
          go.disabled=false;setBal(d.balance);roundSaw(d);
          var label=d.spin+" "+d.color;
          if(d.win){ok(r,label+"  —  WIN "+mult(d.multiplier));celebrate(d.payout,d.multiplier);}
          else bad(r,label+"  —  lost.");
        },4150);
      }).catch(function(){go.disabled=false;roundSaw(null);bad(r,"network error");});
    };
  }

  /* ---------- PLINKO ---------- */
  function viewPlinko(){
    var v=mount("Plinko",icoPlinko());
    var bet=betField("1");
    var risk=selectOf([["low","Low"],["medium","Medium"],["high","High"]],"medium");
    var rows=selectOf([["8","8"],["12","12"],["16","16"]],"12");
    var row=el("div","ctlrow");
    row.appendChild(ctl("bet",bet));row.appendChild(ctl("risk",risk));row.appendChild(ctl("rows",rows));
    v.appendChild(row);

    var TABLES={
      low:{8:[5.6,2.1,1.1,1,0.5,1,1.1,2.1,5.6],12:[10,3,1.6,1.4,1.1,1,0.5,1,1.1,1.4,1.6,3,10],16:[16,9,2,1.4,1.4,1.2,1.1,1,0.5,1,1.1,1.2,1.4,1.4,2,9,16]},
      medium:{8:[13,3,1.3,0.7,0.4,0.7,1.3,3,13],12:[33,11,4,2,1.1,0.6,0.3,0.6,1.1,2,4,11,33],16:[110,41,10,5,3,1.5,1,0.5,0.3,0.5,1,1.5,3,5,10,41,110]},
      high:{8:[29,4,1.5,0.3,0.2,0.3,1.5,4,29],12:[170,24,8.1,2,0.7,0.2,0.2,0.2,0.7,2,8.1,24,170],16:[1000,130,26,9,4,2,0.2,0.2,0.2,0.2,0.2,2,4,9,26,130,1000]}
    };
    // board and buckets live in ONE fixed-width box so the ball's landing x and
    // the bucket centres are measured on the exact same scale
    var board=el("div","plinkboard");
    var boardWrap=el("div","plinkwrap");board.appendChild(boardWrap);
    var buckets=el("div","pbuckets");board.appendChild(buckets);
    v.appendChild(board);
    var r=res(v);
    var go=el("button","cbtn go","drop");v.appendChild(go);

    var W=300,ball=null,svg=null,cx=W/2,bw=0,rowH=0,topY=22,R=12;
    function build(){
      R=Number(rows.value);bw=W/(R+1);rowH=Math.min(20,240/R);
      var H=topY+R*rowH+14;
      boardWrap.innerHTML="";
      // no width/height attributes: CSS gives it width:100%;height:auto so the
      // viewBox scales uniformly to the shared board width (x maps 1:1 to buckets)
      svg=sv("svg",{viewBox:"0 0 "+W+" "+H,preserveAspectRatio:"xMidYMid meet"});
      for(var rr=0;rr<R;rr++)for(var i=0;i<=rr;i++){
        svg.appendChild(sv("circle",{cx:cx+(i-rr/2)*bw,cy:topY+rr*rowH,r:2.2,fill:"#7a5a1a"}));
      }
      ball=sv("circle",{cx:cx,cy:6,r:4.5,fill:"#f2c063",stroke:"#1d1206","stroke-width":"1"});
      svg.appendChild(ball);
      boardWrap.appendChild(svg);
      var tab=TABLES[risk.value][R];
      buckets.innerHTML="";
      tab.forEach(function(m){
        var b=el("div","pb",m+"x");
        b.style.background=m>=2?"#8a5a28":(m>=1?"#3a2410":"#5a2020");
        buckets.appendChild(b);
      });
    }
    rows.onchange=build;risk.onchange=build;build();

    go.onclick=function(){
      go.disabled=true;r.className="casres";r.textContent="";
      Array.prototype.forEach.call(buckets.children,function(b){b.classList.remove("hit");});
      roundBet(bet.value);
      jpost("/cas/plinko",wager({bet:Number(bet.value),risk:risk.value,rows:R})).then(function(d){if(refused(d)){refusedGate();return;}
        if(d.error){go.disabled=false;roundSaw(d);bad(r,d.error);return;}
        var rights=0,k=0;
        ball.setAttribute("cx",cx);ball.setAttribute("cy",6);
        function stepDown(){
          if(k>=d.path.length){
            var bel=buckets.children[rights];if(bel)bel.classList.add("hit");
            go.disabled=false;setBal(d.balance);roundSaw(d);
            if(d.multiplier>1){ok(r,"landed "+mult(d.multiplier));celebrate(d.payout,d.multiplier);}
            else bad(r,"landed "+mult(d.multiplier)+"  (+"+money(d.payout)+")");
            return;
          }
          rights+=d.path[k];k++;
          ball.setAttribute("cx",cx+(2*rights-k)*bw/2);
          ball.setAttribute("cy",topY+k*rowH);
          setTimeout(stepDown,Math.max(40,320/R));
        }
        ball.style.transition="none";
        setTimeout(function(){ball.style.transition="cx .09s linear, cy .09s linear";stepDown();},20);
      }).catch(function(){go.disabled=false;roundSaw(null);bad(r,"network error");});
    };
  }

  /* ---------- BLACKJACK ---------- */
  /* a card with a back and a front; the deal animation spins it face-up */
  function cardEl(c){
    var wrap=el("div","pcard"+(c==="??"?" hole":""));
    var inner=el("div","pcinner");
    var back=el("div","pcface pcback","♠");
    var front=el("div","pcface pcfront");
    if(c!=="??"){
      if(c.indexOf("♥")>=0||c.indexOf("♦")>=0)front.className="pcface pcfront red";
      front.textContent=c;
    }
    inner.appendChild(back);inner.appendChild(front);
    wrap.appendChild(inner);
    return wrap;
  }
  /* one icon per action so the buttons read at a glance */
  function strokePath(d,w){return sv("path",{d:d,fill:"none",stroke:"currentColor","stroke-width":w||"2.4","stroke-linecap":"round","stroke-linejoin":"round"});}
  function icoBox(){return sv("svg",{viewBox:"0 0 24 24",width:"20",height:"20","aria-hidden":"true"});}
  function icoHit(){var s=icoBox();s.appendChild(strokePath("M12 4v13"));s.appendChild(strokePath("M6 12l6 6 6-6"));return s;}
  function icoStand(){var s=icoBox();s.appendChild(strokePath("M5 11h14","2.9"));var p=strokePath("M5 16h14","2.9");p.setAttribute("opacity",".45");s.appendChild(p);return s;}
  function icoDouble(){var s=icoBox();s.appendChild(strokePath("M6 5l6 6 6-6"));s.appendChild(strokePath("M6 13l6 6 6-6"));return s;}
  function icoDeal(){var s=icoBox();s.appendChild(sv("rect",{x:"4",y:"5",width:"9",height:"13",rx:"2",fill:"none",stroke:"currentColor","stroke-width":"2"}));
    s.appendChild(sv("rect",{x:"11",y:"7",width:"9",height:"13",rx:"2",fill:"none",stroke:"currentColor","stroke-width":"2",opacity:".55"}));return s;}
  function icoSplit(){var s=icoBox();s.appendChild(strokePath("M12 20v-6"));s.appendChild(strokePath("M12 14l-5-5"));s.appendChild(strokePath("M12 14l5-5"));return s;}
  function bjBtn(cls,label,icon){var b=el("button","bjbtn "+cls);b.appendChild(icon);b.appendChild(el("span",null,label));return b;}
  /* The server only ever reports the total of a finished hand, so a hand that is
     still being dealt has to be counted here: aces are 11 until that busts, and
     the hole card is worth nothing while it is still face down. */
  function bjCardValue(c){
    var r=c.slice(0,c.length-1);
    if(r==="A")return 11;
    if(r==="K"||r==="Q"||r==="J"||r==="10")return 10;
    return Number(r)||0;
  }
  function bjTotal(cards){
    var total=0,aces=0;
    cards.forEach(function(c){
      if(c==="??")return;
      var v=bjCardValue(c);total+=v;if(v===11)aces++;
    });
    while(total>21&&aces>0){total-=10;aces--;}
    return total;
  }
  var BJ_DEAL_MS=400;                  // beat between one card landing and the next
  function bjCopyShown(shown){
    return {dealer:shown.dealer.slice(),hands:shown.hands.map(function(h){return h.slice();})};
  }
  function bjApplyShown(shown,ev){
    if(ev.t==="D"){
      if(typeof ev.at==="number")shown.dealer[ev.at]=ev.c;
      else shown.dealer.push(ev.c);
    }else{
      if(!shown.hands[ev.h])shown.hands[ev.h]=[];
      if(typeof ev.at==="number")shown.hands[ev.h][ev.at]=ev.c;
      else shown.hands[ev.h].push(ev.c);
    }
  }
  /* Server order is already [upcard, hole, ...hits] — the hole sits to the
     right of the card you can see, same as a real shoe. During play the hole
     is still "??". Do not swap them: putting the hole on the left made a
     stand wipe the upcard and deal it again. */
  function bjDealerView(d){
    return (d.dealer||[]).slice();
  }
  function bjSameCards(a,b){
    if(!a||!b||a.length!==b.length)return false;
    for(var i=0;i<a.length;i++)if(a[i]!==b[i])return false;
    return true;
  }
  function bjSyncSplits(shown,d){
    if(!d.hands)return;
    while(shown.hands.length<d.hands.length){
      var k=0;
      while(k<shown.hands.length&&bjSameCards(shown.hands[k],d.hands[k].cards))k++;
      var moved=(k<shown.hands.length&&shown.hands[k].length)?shown.hands[k].pop():null;
      shown.hands.splice(Math.min(k+1,shown.hands.length),0,moved?[moved]:[]);
    }
  }
  function bjIsOpening(shown){
    return shown.dealer.length===0&&shown.hands.every(function(h){return !h.length;});
  }
  function bjPrepareShown(shown,d){
    var cur=bjCopyShown(shown);
    if(!bjIsOpening(cur))bjSyncSplits(cur,d);
    return cur;
  }
  /* Opening deal is you, upcard, you, hole — so the hole lands on the right
     of the card you can already see. Anything after that — a hit, the hole
     turning over, the dealer drawing to 17 — is appended in that order so
     the renderer can sleep BJ_DEAL_MS between each card. */
  function bjDealQueue(shown,d){
    var cur=bjPrepareShown(shown,d);
    var q=[];
    if(bjIsOpening(shown)){
      var p=(d.hands[0]&&d.hands[0].cards)||[];
      var up=(d.dealer&&d.dealer[0])||"";
      if(p[0])q.push({t:"P",h:0,c:p[0]});
      if(up)q.push({t:"D",c:up});
      if(p[1])q.push({t:"P",h:0,c:p[1]});
      q.push({t:"D",c:"??"});
      q.forEach(function(ev){bjApplyShown(cur,ev);});
    }else{
      (d.hands||[]).forEach(function(h,i){
        if(!cur.hands[i])cur.hands[i]=[];
        (h.cards||[]).forEach(function(c,j){
          if(cur.hands[i][j]!==c){
            var ev={t:"P",h:i,c:c};
            if(cur.hands[i][j]!==undefined)ev.at=j;
            q.push(ev);
            bjApplyShown(cur,ev);
          }
        });
      });
    }
    bjDealerView(d).forEach(function(c,j){
      if(cur.dealer[j]!==c){
        var ev={t:"D",c:c};
        if(cur.dealer[j]!==undefined)ev.at=j;
        q.push(ev);
        bjApplyShown(cur,ev);
      }
    });
    return q;
  }
  window.__bj={DEAL_MS:BJ_DEAL_MS,dealerView:bjDealerView,dealQueue:bjDealQueue,apply:bjApplyShown,prepare:bjPrepareShown,total:bjTotal};
  function viewBlackjack(){
    var v=mount("Blackjack",icoBlackjack());
    var bet=betField("1");
    var deal=bjBtn("deal","deal",icoDeal());
    var row=el("div","ctlrow");
    row.appendChild(ctl("bet",bet));row.appendChild(ctl(" ",deal));
    v.appendChild(row);

    // the table: dealer above, your hand(s) below, everything centred
    var table=el("div","bjtable");
    var dlab=el("div","bjlabel","dealer"),dval=el("div","bjval","-"),dcards=el("div","bjcards");
    var plab=el("div","bjlabel","you"),phands=el("div","bjhands");
    [dlab,dval,dcards,el("div","bjsplit"),plab,phands].forEach(function(x){table.appendChild(x);});
    v.appendChild(table);

    var acts=el("div","bjacts");v.appendChild(acts);   // actions sit under your hand
    var r=el("div","bjres","");v.appendChild(r);
    function setRes(cls,txt){r.className="bjres"+(cls?" "+cls:"");r.textContent=txt;}

    /* One reply carries everything that just happened — after a stand that is
       the hole card plus every card the dealer draws on top of it. Laying all of
       it down at once hands the player the result before they have seen a single
       card, so only the cards already on the felt are painted. Fresh ones wait
       BJ_DEAL_MS behind the last. The result line, the balance, the payout toast
       and the next set of buttons all wait for the last card to land. */
    var shown={dealer:[],hands:[[]]};
    var handUI=[];
    var dealTimer=null;
    var live=null;                       // server snapshot for the hand in motion

    /* Cards keep their DOM node between paints, because rebuilding one that is
       already on the table would restart its deal animation. Only the index that
       actually changed is replaced — a prefix wipe used to throw away the
       upcard when the hole flipped, so stand looked like the dealer was dealt
       twice. "??" turning into a real card is still a change, and that is the
       hole's flip. */
    function paintCards(wrap,cards){
      while(wrap.children.length>cards.length)wrap.removeChild(wrap.lastChild);
      for(var i=0;i<cards.length;i++){
        if(i<wrap.children.length&&wrap.children[i]._card===cards[i])continue;
        var e=cardEl(cards[i]);e._card=cards[i];
        if(i<wrap.children.length)wrap.replaceChild(e,wrap.children[i]);
        else wrap.appendChild(e);
      }
    }
    function ensureHands(){
      while(handUI.length<shown.hands.length){
        var ui={box:el("div","bjhand"),tag:el("div","bjhtag"),val:el("div","bjval","-"),wrap:el("div","bjcards")};
        ui.box.appendChild(ui.tag);ui.box.appendChild(ui.val);ui.box.appendChild(ui.wrap);
        phands.appendChild(ui.box);
        handUI.push(ui);
      }
    }
    function dealerShownValue(){
      var vis=shown.dealer.some(function(c){return c!=="??";});
      return vis?String(bjTotal(shown.dealer)):"?";
    }
    function renderShown(){
      ensureHands();
      var multi=shown.hands.length>1||(live&&live.hands&&live.hands.length>1);
      paintCards(dcards,shown.dealer);
      dval.textContent=shown.dealer.length?dealerShownValue():"-";
      phands.className="bjhands"+(multi?" multi":"");
      shown.hands.forEach(function(cards,i){
        var ui=handUI[i];if(!ui)return;
        ui.tag.style.display=multi?"":"none";
        ui.tag.className="bjhtag";
        ui.tag.textContent="hand "+(i+1);
        ui.val.textContent=cards.length?String(bjTotal(cards)):"-";
        paintCards(ui.wrap,cards);
      });
      plab.textContent=multi?("your hands ("+shown.hands.length+")"):"you";
    }
    function stopDeal(){if(dealTimer){clearTimeout(dealTimer);dealTimer=null;}}
    function clearTable(){
      stopDeal();
      shown={dealer:[],hands:[[]]};
      handUI=[];live=null;
      dcards.innerHTML="";phands.innerHTML="";acts.innerHTML="";
      dval.textContent="-";plab.textContent="you";
      table.classList.remove("bjdealing");
    }
    var LABEL={blackjack:"BLACKJACK!",win:"you win!",dealer_bust:"dealer busts - you win!",push:"push - bet returned",lose:"dealer wins",bust:"you bust",dealer_blackjack:"dealer blackjack"};

    // every card is down, so the round can now be given away
    function settle(d){
      var multi=d.hands.length>1;
      handUI.forEach(function(ui,i){
        var hd=d.hands[i];if(!hd)return;
        ui.box.className="bjhand"+(d.state==="playing"&&i===d.active?" active":"")+(hd.done&&d.state!=="playing"?" settled":"");
        if(multi&&hd.result){
          ui.tag.className="bjhtag"+((hd.payout>hd.bet)?" win":(hd.result==="push"?"":" lose"));
          ui.tag.textContent=LABEL[hd.result]||hd.result;
        }
      });
      acts.innerHTML="";
      if(d.state==="playing"){
        var hit=bjBtn("hit","hit",icoHit());hit.onclick=function(){act("/cas/bj/hit");};
        var stand=bjBtn("stand","stand",icoStand());stand.onclick=function(){act("/cas/bj/stand");};
        acts.appendChild(hit);acts.appendChild(stand);
        var stake=(d.hands[d.active]||{}).bet||0;
        if(d.canDouble){var db=bjBtn("dbl","double",icoDouble());db.onclick=function(){act("/cas/bj/double",stake);};acts.appendChild(db);}
        if(d.canSplit){var sp=bjBtn("split","split",icoSplit());sp.onclick=function(){act("/cas/bj/split",stake);};acts.appendChild(sp);}
        setRes("",multi?("playing hand "+(d.active+1)+" of "+d.hands.length):"");
        return;
      }
      // the server sends the new balance with the first reply, but the header and
      // the win toast have to wait until the dealer has finished taking cards
      if(typeof d.balance==="number")setBal(d.balance);
      roundSaw(d);
      if(multi){
        // a split round is summarised by what came back versus what was staked
        var net=Math.round((d.payout-d.bet)*100)/100;
        setRes(net>0?"win":(net<0?"lose":""),
          net>0?("you take "+money(d.payout)+" on "+money(d.bet)+" staked"):
          (net<0?("you lose "+money(-net)):"push - stake returned"));
      }else{
        var msg=LABEL[d.result]||d.result;
        if(d.result==="push")setRes("",msg);
        else if(d.payout>0)setRes("win",msg);
        else setRes("lose",msg);
      }
      if(d.payout>d.bet)celebrate(d.payout,d.bet?d.payout/d.bet:1);
      deal.disabled=false;bet.disabled=false;
    }
    function playQueue(q,done){
      var n=0;
      var t0=Date.now();
      function tick(){
        dealTimer=null;
        if(!table.isConnected)return;    // left the table part way through a round
        if(n>=q.length){done();return;}
        bjApplyShown(shown,q[n]);
        n+=1;
        renderShown();
        // schedule from t0 so a slow paint cannot collapse the 0.4s gaps
        var wait=Math.max(0,(t0+n*BJ_DEAL_MS)-Date.now());
        dealTimer=window.setTimeout(tick,wait);
      }
      tick();
    }
    function paint(d){
      stopDeal();
      live=d;
      if(d.state==="playing")roundStaked(d);   /* the stake is out; the hand is not read */
      var q=bjDealQueue(shown,d);
      shown=bjPrepareShown(shown,d);
      renderShown();
      table.classList.add("bjdealing");
      acts.innerHTML="";
      playQueue(q,function(){
        table.classList.remove("bjdealing");
        settle(d);
      });
    }
    /* the second argument is the extra stake a double or a split pushes out;
       hit and stand cost nothing, and either way what the hand is worth is not
       settled until the dealer is done */
    function act(p,more){
      Array.prototype.forEach.call(acts.querySelectorAll("button"),function(b){b.disabled=true;});
      if(more)roundBet(more);
      jpost(p,{}).then(function(d){if(refused(d)){refusedGate();return;}if(d.error){if(more)roundSaw(d);setRes("lose",d.error);deal.disabled=false;bet.disabled=false;return;}paint(d);})
        .catch(function(){if(more)roundSaw(null);setRes("lose","network error");deal.disabled=false;bet.disabled=false;});
    }
    deal.onclick=function(){
      deal.disabled=true;bet.disabled=true;
      clearTable();setRes("","");        // a new round deals every card fresh
      roundBet(bet.value);
      jpost("/cas/bj/start",wager({bet:Number(bet.value)})).then(function(d){if(refused(d)){refusedGate();return;}
        if(d.error){roundSaw(d);setRes("lose",d.error);deal.disabled=false;bet.disabled=false;return;}
        paint(d);
      }).catch(function(){roundSaw(null);setRes("lose","network error");deal.disabled=false;bet.disabled=false;});
    };
  }

  /* ---------- MINES ---------- */
  function viewMines(){
    var v=mount("Mines","💣");
    var bet=betField("1");
    var mn=el("input");mn.type="number";mn.min="1";mn.max="24";mn.step="1";mn.value="3";
    var start=el("button","cbtn go","start");
    var cash=el("button","cbtn stop","cash out");cash.style.display="none";
    var row=el("div","ctlrow");
    row.appendChild(ctl("bet",bet));row.appendChild(ctl("mines",mn));
    var bwrap=el("div","casrow");bwrap.appendChild(start);bwrap.appendChild(cash);
    row.appendChild(ctl(" ",bwrap));
    v.appendChild(row);
    // dedicated readout panel
    var panel=el("div","panel");
    var pCur=pcell("current"),pNext=pcell("next"),pFound=pcell("💎 found","gem"),pLeft=pcell("💎 left","gem");
    panel.appendChild(pCur);panel.appendChild(divider());panel.appendChild(pNext);
    panel.appendChild(divider());panel.appendChild(pFound);panel.appendChild(divider());panel.appendChild(pLeft);
    v.appendChild(panel);
    var grid=el("div","grid5");v.appendChild(grid);
    var r=res(v);
    var cells=[],live=false,safeTotal=0;
    function build(active){
      grid.innerHTML="";cells=[];
      for(var i=0;i<25;i++){(function(idx){
        var c=el("div","cell"+(active?"":" dis"),"");cells.push(c);
        c.onclick=function(){if(live)pick(idx,c);};grid.appendChild(c);
      })(i);}
    }
    build(false);
    function setPanel(cur,next,found){
      pCur.val.textContent=cur;pNext.val.textContent=next;
      pFound.val.textContent=found;pLeft.val.textContent=Math.max(0,safeTotal-found);
    }
    setPanel("—","—","0");
    function enableHidden(){cells.forEach(function(x){if(!x.classList.contains("safe")&&!x.classList.contains("mine"))x.classList.remove("dis");});}
    function endRound(){live=false;cash.style.display="none";start.style.display="";bet.disabled=false;mn.disabled=false;
      cells.forEach(function(c){c.classList.add("dis");});}
    function pick(idx,c){
      live=false;cells.forEach(function(x){x.classList.add("dis");});
      jpost("/cas/mines/pick",{tile:idx}).then(function(d){if(refused(d)){refusedGate();return;}
        if(d.error){bad(r,d.error);live=true;enableHidden();return;}
        if(d.state==="boom"){
          c.className="cell mine";c.textContent="💣";
          (d.mines||[]).forEach(function(m){if(cells[m]){cells[m].className="cell mine";cells[m].textContent="💣";}});
          setBal(d.balance);roundSaw(d);bad(r,"boom. you lost.");endRound();return;
        }
        c.className="cell safe dis";c.textContent="💎";
        if(d.state==="cashout"){setBal(d.balance);roundSaw(d);ok(r,"cleared the board! "+mult(d.multiplier));celebrate(d.payout,d.multiplier);endRound();return;}
        setPanel(mult(d.multiplier),mult(d.nextMultiplier),d.revealed.length);
        cash.textContent="cash out "+mult(d.multiplier);
        live=true;enableHidden();
      }).catch(function(){bad(r,"network error");live=true;enableHidden();});
    }
    start.onclick=function(){
      start.disabled=true;
      /* the stake is on the board from the moment it is dealt; what it is worth
         is the thing that waits for the board to be read */
      roundBet(bet.value);
      jpost("/cas/mines/start",wager({bet:Number(bet.value),mines:Number(mn.value)})).then(function(d){if(refused(d)){refusedGate();return;}
        start.disabled=false;
        if(d.error){roundSaw(d);bad(r,d.error);return;}
        roundStaked(d);
        setBal(BAL-Number(bet.value));
        safeTotal=25-Number(mn.value);
        start.style.display="none";cash.style.display="";bet.disabled=true;mn.disabled=true;
        r.className="casres";r.textContent="";build(true);live=true;
        setPanel("1.00x",mult(d.nextMultiplier),0);
        cash.textContent="cash out";
      }).catch(function(){start.disabled=false;roundSaw(null);bad(r,"network error");});
    };
    cash.onclick=function(){
      cash.disabled=true;
      jpost("/cas/mines/cashout",{}).then(function(d){if(refused(d)){refusedGate();return;}
        cash.disabled=false;
        if(d.error){bad(r,d.error);return;}
        setBal(d.balance);roundSaw(d);(d.mines||[]).forEach(function(m){if(cells[m]&&!cells[m].classList.contains("safe")){cells[m].className="cell mine";cells[m].textContent="💣";}});
        ok(r,"cashed out "+mult(d.multiplier));celebrate(d.payout,d.multiplier);endRound();
      }).catch(function(){cash.disabled=false;bad(r,"network error");});
    };
  }

  /* ---------- BEEF ---------- */
  function viewBeef(){
    var v=mount("Beef","🐄");
    var bet=betField("1");
    var diff=selectOf([["easy","Easy"],["medium","Medium"],["hard","Hard"],["daredevil","Daredevil"]],"easy");
    var start=el("button","cbtn go","start");
    var step=el("button","cbtn","step →");step.style.display="none";
    var cash=el("button","cbtn stop","cash out");cash.style.display="none";
    var row=el("div","ctlrow");
    row.appendChild(ctl("bet",bet));row.appendChild(ctl("difficulty",diff));
    var bwrap=el("div","casrow");bwrap.appendChild(start);bwrap.appendChild(step);bwrap.appendChild(cash);
    row.appendChild(ctl(" ",bwrap));
    v.appendChild(row);
    var panel=el("div","panel");
    var pLane=pcell("lane"),pCur=pcell("current"),pNext=pcell("next");
    panel.appendChild(pLane);panel.appendChild(divider());panel.appendChild(pCur);panel.appendChild(divider());panel.appendChild(pNext);
    v.appendChild(panel);
    var road=el("div","road");v.appendChild(road);
    var r=res(v);
    var LANES=0,STEP=0,Q={easy:0.96,medium:0.92,hard:0.85,daredevil:0.75};
    function build(n,q){
      road.innerHTML="";
      for(var i=1;i<=n;i++){
        var L=el("div","rlane");
        L.appendChild(el("div","lm",(0.99/Math.pow(q,i)).toFixed(2)+"x"));
        L.appendChild(el("div","lc",""));
        L.appendChild(el("div",null,String(i)));
        // traffic in every lane the cow has not reached
        var car=el("div","car","🚗");
        car.style.animationDuration=(1.0+Math.random()*1.4).toFixed(2)+"s";
        car.style.animationDelay=(-Math.random()*2.4).toFixed(2)+"s";
        L.appendChild(car);
        road.appendChild(L);
      }
      var st=road.children[0];if(st)st.classList.add("cur");
    }
    function placeAnimal(idx){
      Array.prototype.forEach.call(road.children,function(L,i){
        L.classList.remove("cur");
        L.querySelector(".lc").textContent="";
        if(i<idx)L.classList.add("done");
      });
      var cur=road.children[idx];
      if(cur){cur.classList.add("cur");cur.querySelector(".lc").textContent="🐄";cur.scrollIntoView({block:"nearest",inline:"center"});}
    }
    function running(on){start.style.display=on?"none":"";step.style.display=on?"":"none";cash.style.display=on?"":"none";bet.disabled=on;diff.disabled=on;}
    start.onclick=function(){
      start.disabled=true;
      roundBet(bet.value);
      jpost("/cas/beef/start",wager({bet:Number(bet.value),difficulty:diff.value})).then(function(d){if(refused(d)){refusedGate();return;}
        start.disabled=false;
        if(d.error){roundSaw(d);bad(r,d.error);return;}
        roundStaked(d);
        setBal(BAL-Number(bet.value));
        LANES=d.lanes;STEP=0;build(LANES,Q[diff.value]||0.92);running(true);
        r.className="casres";r.textContent="";cash.style.display="none";
        pLane.val.textContent="0 / "+LANES;pCur.val.textContent="1.00x";pNext.val.textContent=mult(d.nextMultiplier);
      }).catch(function(){start.disabled=false;roundSaw(null);bad(r,"network error");});
    };
    step.onclick=function(){
      step.disabled=true;
      jpost("/cas/beef/step",{}).then(function(d){if(refused(d)){refusedGate();return;}
        if(d.error){step.disabled=false;bad(r,d.error);return;}
        if(d.state==="dead"){
          // walk into the lane, let a car flatten him, THEN report it
          placeAnimal(d.step-1);
          var L=road.children[d.step-1]||road.children[LANES-1];
          var car=L&&L.querySelector(".car");
          if(car){car.style.display="block";car.className="car hit";}
          setTimeout(function(){
            if(L){L.classList.remove("cur");L.classList.add("boom");L.querySelector(".lc").textContent="💥";}
            step.disabled=false;setBal(d.balance);roundSaw(d);
            bad(r,"splat. the cow didn't make it.");running(false);
          },560);
          return;
        }
        step.disabled=false;
        STEP=d.step;placeAnimal(STEP-1);
        road.children[STEP-1].classList.add("done");
        if(d.state==="cashout"){setBal(d.balance);roundSaw(d);ok(r,"made it across! "+mult(d.multiplier));celebrate(d.payout,d.multiplier);running(false);return;}
        cash.style.display="";cash.textContent="cash out "+mult(d.multiplier);
        pLane.val.textContent=STEP+" / "+LANES;pCur.val.textContent=mult(d.multiplier);pNext.val.textContent=mult(d.nextMultiplier);
      }).catch(function(){step.disabled=false;bad(r,"network error");});
    };
    cash.onclick=function(){
      cash.disabled=true;
      jpost("/cas/beef/cashout",{}).then(function(d){if(refused(d)){refusedGate();return;}
        cash.disabled=false;
        if(d.error){bad(r,d.error);return;}
        setBal(d.balance);roundSaw(d);ok(r,"cashed out "+mult(d.multiplier));celebrate(d.payout,d.multiplier);running(false);
      }).catch(function(){cash.disabled=false;bad(r,"network error");});
    };
  }

  /* ---------- THE PIT (player vs player) ---------- */
  /* Two tables where the opponent is another member rather than the house. The
     client holds no rules at all: it posts create/join/confirm/move and paints
     whatever the server says the duel now looks like. It never learns the other
     player's pick until the server has both, because the server does not send
     it — so there is nothing here to read out of devtools and nothing to time.

     Every screen here is driven by one poll (pitPoll) and one countdown tick
     (pitTick), both owned by PIT and both torn down by clearTimer(), which every
     navigation already calls. */
  var PIT={game:null,id:null,poll:null,tick:null,skew:0,shape:"",left:null,node:null,reveal:[],
    busy:false,pending:null,roundsSeen:null,last:null,chips:null};
  /* the clash: the beat between a round resolving and the next one starting */
  var CL_IN_MS=520, CL_HIT_MS=600, CL_SAY_MS=1000, CL_HOLD_MS=2050;
  /* How a cut is dealt. There is nothing to play in this game — both cards are
     decided before either is shown — so the entire experience is the wait, and
     it is paced deliberately: the deck is cut, your card stirs and turns over
     slowly, you sit with it for three full seconds while THEIR card starts to
     shiver, and only then does it turn. The result is held back behind the
     second card, because knowing the outcome early is the one thing that would
     make the pause worthless. */
  var CUT_STIR_MS=250;    /* a card wakes up before it turns */
  var CUT_FIRST_MS=700;   /* yours turns */
  var CUT_FLIP_MS=900;    /* and takes this long doing it — slow on purpose */
  var CUT_GAP_MS=3000;    /* start to start between the two cards */
  var CUT_TEASE_MS=1000;  /* their card starts shivering this long beforehand */
  var PIT_GAMES={
    tung:{name:"Tung, Wood, Fire",moves:["tung","wood","fire"],
      blurb:"tung splits the wood. the wood feeds the fire. the fire takes tung.",
      sub:"first to two rounds. a tie is no round at all — play it again."},
    cut:{name:"The Cut",moves:[],
      blurb:"one card each. the high card takes the pot.",
      sub:"nothing to play. the deck is cut the moment everyone at the table says yes. a tie is re-cut."},
    comp:{name:"Competitive Gambling",moves:[],
      blurb:"three minutes on the floor. a stack of wood each. the bigger pile at the buzzer takes the pot.",
      sub:"the whole floor, played in wood. it is not sahurs and never becomes sahurs \u2014 it is handed out for the round and swept when it ends, while your sahurs sit in the pot the whole time. run the wood out with nothing left on a table and the round ends there and then."}
  };
  function pitStop(){
    if(PIT.poll){clearInterval(PIT.poll);PIT.poll=null;}
    if(PIT.tick){clearInterval(PIT.tick);PIT.tick=null;}
    /* a half-dealt cut must not keep turning cards over on a screen the player
       has already left */
    PIT.reveal.forEach(function(t){clearTimeout(t);});
    PIT.reveal=[];
    PIT.chips=null;
    /* if a clash was mid-flight its callback will never land, so the render
       gate has to be lifted here or every later paint would be swallowed */
    PIT.busy=false;PIT.pending=null;
  }
  function pitAfter(ms,fn){
    var t=setTimeout(function(){
      PIT.reveal=PIT.reveal.filter(function(x){return x!==t;});
      fn();
    },ms);
    PIT.reveal.push(t);
    return t;
  }
  /* Turn one card over, in the slot it is already lying face down in. Replacing
     the node is what runs the animation — same mechanic blackjack uses to flip
     its hole card, and the same .pcard markup, so the two tables deal alike. */
  function cutTurn(slot,card){
    var c=cardEl(card);
    if(slot.firstChild)slot.replaceChild(c,slot.firstChild);
    else slot.appendChild(c);
  }
  /* the server ships its own clock with every duel, so the countdowns run off
     the server's deadline rather than a browser clock that may be minutes out */
  function pitSkew(d){if(d&&typeof d.now==="number")PIT.skew=d.now-Date.now();}
  function pitLeft(deadline){return Math.max(0,(Number(deadline)||0)-(Date.now()+PIT.skew));}
  function pitSecs(ms){return String(Math.ceil(ms/1000));}
  /* the confirm and move clocks are seconds; an open table runs for ten
     minutes, and "600s" is not something anybody reads as time */
  function pitClockText(ms){
    var t=Math.ceil(ms/1000);
    if(t<60)return t+"s";
    return Math.floor(t/60)+"m "+(t%60<10?"0":"")+(t%60)+"s";
  }
  function moveIcon(m){
    if(m==="tung"){var i=el("img","pmimg");i.src=(typeof TUNG_IMG!=="undefined")?TUNG_IMG:"";i.alt="tung";i.onerror=function(){i.style.display="none";};return i;}
    return el("span","pmemoji",m==="wood"?"🪵":"🔥");
  }
  function moveName(m){return m==="tung"?"tung":(m==="wood"?"wood":"fire");}

  /* ---- the pit lobby: who is waiting, and a form to wait yourself ---- */
  function viewPit(game){
    var cfg=PIT_GAMES[game]||PIT_GAMES.tung;
    var v=mount(cfg.name,gameIcon("pit-"+game));VIEW="pit";paintRound();PIT.game=game;PIT.id=null;PIT.shape="";
    PIT.roundsSeen=null;PIT.busy=false;PIT.pending=null;
    v.appendChild(el("p","pitblurb",cfg.blurb));
    v.appendChild(el("p","pitsub",cfg.sub));

    var bet=betField("1");
    var seatsSel=game==="cut"?selectOf([["2","2"],["3","3"],["4","4"]],"2"):null;
    var open=el("button","cbtn go","put up a table");
    var row=el("div","ctlrow");
    row.appendChild(ctl("stake",bet));
    if(seatsSel)row.appendChild(ctl("players",seatsSel));
    var bw=el("div","casrow");bw.appendChild(open);
    row.appendChild(ctl(" ",bw));
    v.appendChild(row);
    var r=res(v);
    v.appendChild(el("div","seclabel","open tables"));
    var list=el("div","pitlist");v.appendChild(list);
    v.appendChild(el("div","casnote",game==="cut"
      ?"your stake is held the moment you sit down, and comes straight back if the table is cancelled, it does not fill within 10 minutes, or anyone does not confirm."
      :(game==="comp"
        ?"your stake is held the moment you sit down, and comes straight back if the table is cancelled, nobody joins within 10 minutes, or either of you does not confirm. the wood inside the round is worth nothing outside it \u2014 the stakes are the only sahurs on the table."
        :"your stake is held the moment you sit down, and comes straight back if the table is cancelled, nobody joins within 10 minutes, or either of you does not confirm.")));

    open.onclick=function(){
      open.disabled=true;r.className="casres";r.textContent="";
      var body={game:game,bet:Number(bet.value)};
      if(seatsSel)body.seats=Number(seatsSel.value);
      jpost("/duel/create",body).then(function(d){if(refused(d)){refusedGate();return;}
        open.disabled=false;
        if(!d||d.error){bad(r,d&&d.error==="already in a duel"?"you are already at a table.":(d&&d.error)||"could not open a table");return;}
        setBal(d.balance);pitRefresh();
      }).catch(function(){open.disabled=false;bad(r,"network error");});
    };

    function paintList(d){
      /* a table of your own is never in this list: you are taken to its page */
      var rows=(d.open||[]).filter(function(t){return t.game===game&&!t.mine;});
      list.innerHTML="";
      if(!rows.length){
        list.appendChild(el("div","casnote","nobody is waiting. put a table up and someone will find it."));
        return;
      }
      rows.forEach(function(t){
        var box=el("div","pitrow"+(t.mine?" mine":""));
        var g=el("div","grow");
        g.appendChild(el("h4",null,t.mine?"your table":t.host));
        var lf=pitLeft(t.deadline);
        var seats=t.seats||2, filled=t.filled||1;
        var wait=(seats>2?(filled+" / "+seats+" seated"):(t.mine?"waiting for someone":"waiting"))
          +" — "+pitClockText(lf)+" left";
        g.appendChild(el("p",null,wait));
        box.appendChild(g);
        box.appendChild(el("div","price",money(t.bet)+" sahurs"));
        var sit=el("button","cbtn go","sit down");
        sit.onclick=function(){
          sit.disabled=true;
          jpost("/duel/join",{id:t.id}).then(function(rr){if(refused(rr)){refusedGate();return;}
            sit.disabled=false;
            if(!rr||rr.error){bad(r,rr.error==="taken"?"somebody beat you to it.":(rr.error==="insufficient"?"not enough sahurs for that stake.":(rr.error==="already in a duel"?"you are already at a table.":"could not sit down")));pitRefresh();return;}
            setBal(rr.balance);pitEnter(rr.duel);
          }).catch(function(){sit.disabled=false;bad(r,"network error");});
        };
        box.appendChild(sit);
        list.appendChild(box);
      });
    }

    function pitRefresh(){
      jget("/duel/list?token="+encodeURIComponent(tok())).then(function(d){
        if(refused(d)){refusedGate();return;}
        if(!d||d.error)return;
        pitSkew(d);setBal(d.balance);
        /* your own table takes you to its own page, waiting or not */
        if(d.mine){pitEnter(d.mine);return;}
        paintList(d);
      }).catch(function(){});
    }
    pitStop();pitRefresh();
    /* brisk, because a table of yours being joined starts a ten second clock */
    PIT.poll=setInterval(pitRefresh,1500);
  }

  /* ---- one duel, from the handshake to the result ---- */
  function pitEnter(view){
    pitStop();
    PIT.id=view.id;PIT.game=view.game||PIT.game;PIT.shape="";PIT.roundsSeen=null;PIT.pending=null;
    pitRender(view);
    PIT.poll=setInterval(function(){
      jget("/duel/state?token="+encodeURIComponent(tok())+"&id="+encodeURIComponent(PIT.id)).then(function(d){
        if(refused(d)){refusedGate();return;}
        if(!d||d.error){if(d&&d.error==="gone"){pitStop();openPlay("pit-"+(PIT.game||"tung"));}return;}
        pitSkew(d);setBal(d.balance);pitRender(d.duel);
      }).catch(function(){});
    },1200);
  }

  function pitSend(path,body,onErr){
    return jpost(path,body).then(function(d){if(refused(d)){refusedGate();return null;}
      if(!d||d.error){if(onErr)onErr(d&&d.error);if(d&&d.duel){pitSkew(d);pitRender(d.duel);}return null;}
      pitSkew(d);setBal(d.balance);pitRender(d.duel);return d;
    }).catch(function(){if(onErr)onErr("network");return null;});
  }

  /* The screen is rebuilt only when the duel changes shape — state, round, what
     you have already done. Everything else is a countdown, and redrawing the
     page under a running clock makes buttons impossible to hit. */
  function pitRender(d){
    PIT.last=d;
    /* the bar belongs to the rest of the casino, but this page is the same
       round: keep it fed here too, and stand it down once the round is read */
    if(d.game==="comp"&&d.state==="live")roundSync(d);
    else if(ROUND.live&&ROUND.live.id===d.id)roundStop();
    /* a clash owns the screen while it plays; the newest state waits for it */
    if(PIT.busy){PIT.pending=d;return;}
    /* first sight of a duel establishes the baseline, so reopening one that is
       already several rounds in does not replay them all */
    if(PIT.roundsSeen===null){PIT.roundsSeen=(d.rounds&&d.rounds.length)||0;}
    else if(d.rounds&&d.rounds.length>PIT.roundsSeen&&(PIT_GAMES[d.game]||{}).moves&&(PIT_GAMES[d.game]||{}).moves.length){
      PIT.roundsSeen=d.rounds.length;
      pitClash(d,d.rounds[d.rounds.length-1],function(){
        PIT.busy=false;
        var nxt=PIT.pending||d;PIT.pending=null;
        PIT.shape="";                       /* the clash replaced the screen */
        pitRender(nxt);
      });
      return;
    }
    var cfg=PIT_GAMES[d.game]||PIT_GAMES.tung;
    var who=(d.players||[]).map(function(p){return p.name+":"+(p.confirmed?"1":"0");}).join(",");
    var shape=[d.state,d.round,d.yourMove,d.youConfirmed,d.theyConfirmed,d.theyMoved,d.winner,d.reason,d.guest,d.filled,who].join("|");
    if(shape===PIT.shape){pitPaintClock();return;}
    PIT.shape=shape;
    if(PIT.tick){clearInterval(PIT.tick);PIT.tick=null;}
    var v=mount(cfg.name,gameIcon("pit-"+d.game));VIEW="pit";paintRound();
    var back=v.parentNode.querySelector(".casback");
    /* mid-round the casino floor IS the game, so the way out of this page is
       the floor rather than the pit's own list of tables */
    if(back)back.onclick=(d.game==="comp"&&d.state==="live")
      ?function(){clearTimer();window.__casinoOpen();}
      :function(){pitStop();viewPit(d.game);};

    var head=el("div","pitvs");
    var names=(d.players&&d.players.length)?d.players.slice():[{name:d.you||"you",you:true},{name:d.theirName||"\u2026"}];
    var seats=d.seats||2;
    while(names.length<seats)names.push({name:"\u2026"});
    names.forEach(function(p,i){
      if(i)head.appendChild(el("span","pvs","vs"));
      head.appendChild(el("span","pn",p.you?(d.you||"you"):(p.name||"\u2026")));
    });
    v.appendChild(head);
    v.appendChild(el("div","pitpot",money(d.pot)+" sahurs on the table"));

    var clock=el("div","pitclock","");v.appendChild(clock);
    PIT.left=clock;
    var body=el("div","pitbody");v.appendChild(body);
    var note=el("div","casres","");v.appendChild(note);

    if(d.state==="open"){
      /* The table page while it is still filling. A 2-seat table only lives
         here with the host alone; a 3- or 4-seat Cut stays here until the
         last chair is taken. This is the only page that can take it down. */
      var filled=d.filled||1, need=Math.max(0,(d.seats||2)-filled);
      if(d.youAreHost){
        body.appendChild(el("p","pitsay",filled<=1?"your table is up.":(filled+" of "+(d.seats||2)+" seated.")));
        body.appendChild(el("p","pitsub",need===0
          ?"the table is full."
          :(need===1
            ?(filled<=1?"waiting for somebody to sit down. nobody has yet, so you can take it back."
              :"waiting for one more. you can still take it down.")
            :"waiting for "+need+" more. you can still take it down.")));
        var kill=el("button","cbtn stop","take it down \u2014 "+money(d.bet)+" sahurs back");
        kill.onclick=function(){
          kill.disabled=true;
          jpost("/duel/cancel",{id:d.id}).then(function(rr){if(refused(rr)){refusedGate();return;}
            kill.disabled=false;
            if(!rr||rr.error){
              /* somebody sat down in the moment between painting and clicking */
              bad(note,rr&&rr.error==="someone is at the table"?"too late — somebody just sat down.":"could not take it down.");
              return;
            }
            setBal(rr.balance);
            pitStop();viewPit(d.game);
          }).catch(function(){kill.disabled=false;bad(note,"network error");});
        };
        body.appendChild(kill);
        body.appendChild(el("p","pitsub",filled<=1
          ?"if nobody comes, it closes itself and the stake comes back either way."
          :"taking it down sends every stake home. if it never fills, the same thing happens on its own."));
      }else{
        body.appendChild(el("p","pitsay","you are seated."));
        body.appendChild(el("p","pitsub",need===1
          ?"waiting for one more. the deck is cut once the table is full and everyone says yes."
          :"waiting for "+need+" more. the deck is cut once the table is full and everyone says yes."));
        body.appendChild(el("p","pitsub","your stake is held. it comes back if the host takes the table down or the table never fills."));
      }
    }else if(d.state==="confirm"){
      var many=(d.seats||2)>2;
      var ready=(d.players||[]).filter(function(p){return p.confirmed;}).length;
      var total=(d.players&&d.players.length)||(d.seats||2);
      body.appendChild(el("p","pitsay",d.youConfirmed
        ?(many?"you are in. waiting on the others.":"you are in. waiting on them.")
        :(many?"the table is full. say yes before the clock runs out.":"they are waiting. say yes before the clock runs out.")));
      body.appendChild(el("p","pitsub",many
        ?(ready+" of "+total+" have confirmed.")
        :(d.theyConfirmed?"they have confirmed.":"they have not confirmed yet.")));
      if(!d.youConfirmed){
        var yes=el("button","cbtn go","i'm in");
        yes.onclick=function(){yes.disabled=true;pitSend("/duel/confirm",{id:d.id},function(){yes.disabled=false;bad(note,"too late.");});};
        body.appendChild(yes);
      }
      if(d.game==="comp"){
        body.appendChild(el("p","pitsub","say yes and you are each handed "+money(d.stack)+" wood and three minutes to do something with it."));
      }
      body.appendChild(el("p","pitsub",many
        ?"if anyone does not confirm, every stake comes straight back."
        :"if either of you does not confirm, both stakes come straight back."));
    }else if(d.state==="live"&&d.game==="comp"){
      /* the scoreboard is both stacks, and they are both public: watching
         theirs move is the game as much as moving your own is. */
      body.appendChild(compScore(d,false));
      body.appendChild(el("p","pitsub","wood. not sahurs, and never sahurs \u2014 it is swept when the clock stops. the pot is what is actually on the table."));
      body.appendChild(floorMenu("comp"));
      body.appendChild(el("p","pitsub","the whole floor, and the round follows you onto whatever you pick. a hand still open when the clock stops is a stake you paid and never played, so finish what you start \u2014 and while one is still open you are not out, however empty the stack reads."));
    }else if(d.state==="live"){
      var score=el("div","pitscore");
      score.appendChild(el("span","sv",String(d.yourWins)));
      score.appendChild(el("span","sl","round "+d.round+" — first to "+d.target));
      score.appendChild(el("span","sv",String(d.theirWins)));
      body.appendChild(score);
      if(d.yourMove){
        var picked=el("div","pitpicked");
        picked.appendChild(el("span","pl","you played"));
        picked.appendChild(moveIcon(d.yourMove));
        picked.appendChild(el("span","pl",d.theyMoved?"they have played too":"waiting on them"));
        body.appendChild(picked);
      }else{
        var pickRow=el("div","pitmoves");
        cfg.moves.forEach(function(m){
          var b=el("button","pitmove");
          b.appendChild(moveIcon(m));
          b.appendChild(el("span",null,moveName(m)));
          b.onclick=function(){
            Array.prototype.forEach.call(pickRow.querySelectorAll("button"),function(x){x.disabled=true;});
            pitSend("/duel/move",{id:d.id,move:m},function(e){
              Array.prototype.forEach.call(pickRow.querySelectorAll("button"),function(x){x.disabled=false;});
              bad(note,e==="already played"?"you already played this round.":"that did not land.");
            });
          };
          pickRow.appendChild(b);
        });
        body.appendChild(pickRow);
        body.appendChild(el("p","pitsub","they cannot see your pick, and you cannot see theirs. play before the clock runs out or you forfeit."));
      }
      pitHistory(body,d);
    }else if(d.state==="done"){
      /* stop the poll and the clock BEFORE the cut starts dealing, so the
         reveal timers registered below are not cleared by our own cleanup */
      pitStop();
      var won=d.winner&&d.winner===d.you;
      var big=el("div","pitend"+(d.winner?(won?" win":" lose"):""));
      var dealing=false,cutSay=null,cutHands=[];
      if(d.reason==="play"&&(d.hands||d.cards)){
        dealing=true;
        cutHands=(d.hands&&d.hands.length)?d.hands.slice():[
          {name:"you",card:d.youAreHost?d.cards.host:d.cards.guest,you:true},
          {name:d.theirName||"them",card:d.youAreHost?d.cards.guest:d.cards.host,you:false}
        ];
        cutHands.sort(function(a,b){return (b.you?1:0)-(a.you?1:0);});
        var cards=el("div","pitcards");
        cutHands.forEach(function(h){
          var box=el("div","pcut");
          box.appendChild(el("b",null,h.you?"you":(h.name||"them")));
          h.slot=el("div","cutslot");
          h.slot.appendChild(cardEl("??"));
          box.appendChild(h.slot);
          cards.appendChild(box);
        });
        /* every card face down first, so the row is its final size from the
           start and nothing jumps as they turn */
        body.appendChild(cards);
        cutSay=el("div","clashsay cut","");body.appendChild(cutSay);
      }
      var many=(d.seats||2)>2;
      /* a round that was actually played is read off its stacks; the pit's
         other exits (never joined, never confirmed) still read as themselves */
      var ranOut=d.reason==="bust";
      var buzzer=d.game==="comp"&&(ranOut||d.reason==="clock"||d.reason==="draw");
      if(buzzer){
        body.appendChild(compScore(d,true));
        big.textContent=!d.winner
          ?"a dead heat. neither of you is ahead, so both stakes are back."
          :(won
            ?(ranOut?"they ran the wood out. the pot is yours.":"you finish on the bigger pile. you take the pot.")
            :(ranOut?"you ran the wood out. the pot went to "+d.winner+".":d.winner+" finishes on the bigger pile and takes the pot."));
      }else big.textContent=!d.winner
        ?(d.reason==="cancelled"?"table taken down. your stake is back."
          :d.reason==="expired"?(many?"the table never filled. your stake is back.":"nobody came. your stake is back.")
          :d.reason==="unconfirmed"?(many?"someone never confirmed. every stake is back.":"one of you never confirmed. both stakes are back.")
          :"nobody played. both stakes are back.")
        :(won?(d.reason==="forfeit"?"they never played. the pot is yours.":"you take the pot.")
              :(d.reason==="forfeit"?"you did not play in time. the pot went to them.":d.winner+" takes the pot."));
      body.appendChild(big);
      pitHistory(body,d);
      var again=el("button","cbtn go","back to the pit");
      again.onclick=function(){pitStop();viewPit(d.game);};
      body.appendChild(again);
      var potx=d.seats||d.filled||2;
      if(!dealing){
        if(d.winner&&won)celebrate(d.pot,potx);
      }else{
        /* the result would give the last card away, so it waits behind it */
        big.style.visibility="hidden";
        again.style.visibility="hidden";
        function cutTell(t){if(!cutSay)return;cutSay.textContent=t;cutSay.className="clashsay cut show";}
        cutTell("the deck is cut.");
        var mineH=cutHands[0], rest=cutHands.slice(1);
        /* yours: it stirs, then turns */
        pitAfter(CUT_STIR_MS,function(){if(mineH&&mineH.slot)mineH.slot.className="cutslot hot";});
        pitAfter(CUT_FIRST_MS,function(){
          if(!mineH)return;
          mineH.slot.className="cutslot";
          cutTurn(mineH.slot,mineH.card);
        });
        pitAfter(CUT_FIRST_MS+CUT_FLIP_MS,function(){if(mineH)cutTell("you drew "+mineH.card+".");});
        rest.forEach(function(h,i){
          var start=CUT_FIRST_MS+(i+1)*CUT_GAP_MS;
          var label=rest.length===1?"them":(h.name||"them");
          pitAfter(start-CUT_TEASE_MS,function(){
            h.slot.className="cutslot hot";
            cutTell("and for "+label+"\u2026");
          });
          pitAfter(start,function(){
            h.slot.className="cutslot";
            cutTurn(h.slot,h.card);
          });
        });
        var lastAt=CUT_FIRST_MS+Math.max(1,rest.length)*CUT_GAP_MS+CUT_FLIP_MS;
        pitAfter(lastAt,function(){
          if(d.winner){
            cutHands.forEach(function(h){
              if((h.you&&won)||(!h.you&&h.name===d.winner))h.slot.className="cutslot won";
            });
          }
          cutTell(d.winner?(won?"yours is higher.":(many?d.winner+" is higher.":"theirs is higher.")):"");
          pitAfter(420,function(){
            big.style.visibility="";
            again.style.visibility="";
            if(d.winner&&won)celebrate(d.pot,potx);
          });
        });
      }
    }
    pitPaintClock();
    if(d.state!=="done"&&!PIT.tick)PIT.tick=setInterval(pitPaintClock,200);
  }

  /* ---- the clash ----
     A round is two hidden picks that become one outcome, so it is shown as
     exactly that: the two moves slide in from opposite sides onto the same
     line, meet in the middle, and the loser is taken out of the world — the
     winner ends up standing alone where they met. A tie has nothing to
     resolve, so the two rebound off each other and go back where they came
     from. The name of the move that took it is the headline; who that was
     good news for is the line under it, because the move alone does not say. */
  function clashFighter(move){
    var f=el("div","cfighter");
    var ic=el("div","cic");ic.appendChild(moveIcon(move));
    f.appendChild(ic);
    f.appendChild(el("span","cnm",moveName(move)));
    return f;
  }
  function pitClash(d,rr,done){
    PIT.busy=true;
    var cfg=PIT_GAMES[d.game]||PIT_GAMES.tung;
    var v=mount(cfg.name,gameIcon("pit-"+d.game));VIEW="pit";paintRound();
    var back=v.parentNode.querySelector(".casback");
    if(back)back.onclick=function(){pitStop();viewPit(d.game);};
    var head=el("div","pitvs");
    head.appendChild(el("span","pn",d.you||"you"));
    head.appendChild(el("span","pvs","vs"));
    head.appendChild(el("span","pn",d.theirName||"\u2026"));
    v.appendChild(head);
    v.appendChild(el("div","pitpot","round "+d.rounds.length));

    var mineMove=d.youAreHost?rr.host:rr.guest;
    var theirMove=d.youAreHost?rr.guest:rr.host;
    var tie=rr.won===null;
    var iWon=!tie&&rr.won===d.you;

    var stage=el("div","clash");
    var L=clashFighter(mineMove),R=clashFighter(theirMove);
    var spark=el("div","cspark");
    stage.appendChild(L);stage.appendChild(R);stage.appendChild(spark);
    v.appendChild(stage);
    var say=el("div","clashsay","");v.appendChild(say);
    var sub=el("div","clashsub","");v.appendChild(sub);

    var OUT=112,MEET=30;
    function at(el2,x,extra){el2.style.transform="translate(-50%,-50%) translateX("+x+"px)"+(extra||"");}
    at(L,-OUT);at(R,OUT);
    void stage.offsetWidth;                 /* start from the outer marks, not from nowhere */

    pitAfter(40,function(){at(L,-MEET);at(R,MEET);});
    pitAfter(40+CL_IN_MS,function(){
      spark.className="cspark go";
      if(tie){
        /* nothing gives, so they come off each other */
        at(L,-OUT);at(R,OUT);
      }else{
        var win=iWon?L:R, lose=iWon?R:L;
        win.classList.add("cwin");
        at(win,0," scale(1.16)");
        /* the loser is pushed through and gone */
        at(lose,(lose===L?-1:1)*(MEET-14)," scale(.3)");
        lose.classList.add("cgone");
      }
    });
    pitAfter(40+CL_SAY_MS,function(){
      say.textContent=tie?"tie":(moveName(iWon?mineMove:theirMove)+" wins");
      say.className="clashsay show"+(tie?"":(iWon?" win":" lose"));
      sub.textContent=tie
        ?(moveName(mineMove)+" against "+moveName(theirMove)+". play it again.")
        :(iWon?"you take the round.":"they take the round.");
      sub.className="clashsub show";
    });
    pitAfter(CL_HOLD_MS,function(){done();});
  }

  /* The two stacks side by side. The live one hands its numbers to the clock
     tick, so a roll either player makes moves them without rebuilding the
     screen under the hands of whoever is mid-click. */
  function compScore(d,fin){
    var sc=el("div","compscore"+(fin?" fin":""));
    var mine=el("div","cstack"+(fin&&d.yourChips>d.theirChips?" up":""));
    mine.appendChild(el("b",null,"you"));
    var mv=el("span","cv",money(d.yourChips));mine.appendChild(mv);
    var theirs=el("div","cstack"+(fin&&d.theirChips>d.yourChips?" up":""));
    theirs.appendChild(el("b",null,d.theirName||"them"));
    var tv=el("span","cv",money(d.theirChips));theirs.appendChild(tv);
    sc.appendChild(mine);sc.appendChild(el("span","cvs","wood"));sc.appendChild(theirs);
    if(!fin)PIT.chips={you:mv,them:tv};
    return sc;
  }

  /* every round already played, from your side of the table */
  function pitHistory(body,d){
    if(!d.rounds||!d.rounds.length)return;
    var hist=el("div","pithist");
    d.rounds.forEach(function(rr,i){
      var line=el("div","ph");
      line.appendChild(el("span","phn",String(i+1)));
      line.appendChild(moveIcon(d.youAreHost?rr.host:rr.guest));
      line.appendChild(el("span","phv",rr.won===null?"tie":(rr.won===d.you?"you":"them")));
      line.appendChild(moveIcon(d.youAreHost?rr.guest:rr.host));
      hist.appendChild(line);
    });
    body.appendChild(hist);
  }

  /* The only things that move between rebuilds: the countdown, and — while a
     round is running — the two stacks, which change on every roll either of
     them makes and must not take the screen with them. */
  function pitPaintClock(){
    var d=PIT.last;
    if(!d)return;
    if(PIT.chips&&PIT.chips.you.isConnected){
      PIT.chips.you.textContent=money(ROUND.live&&ROUND.live.id===d.id?ROUND.mine:d.yourChips);
      PIT.chips.them.textContent=money(d.theirChips);
    }
    if(!PIT.left||!PIT.left.isConnected)return;
    if(d.state==="done"||!d.deadline){PIT.left.textContent="";PIT.left.className="pitclock";return;}
    var ms=pitLeft(d.deadline);
    PIT.left.textContent=pitClockText(ms);
    /* three minutes is not ten seconds: "hot" has to mean something different
       on a round than it does on a confirm nobody has given yet */
    var hot=d.game==="comp"?15000:4000;
    PIT.left.className="pitclock"+(ms<=hot?" hot":"");
  }

  /* ---------- SHOP ---------- */
  function viewShop(){
    var v=mount("Shop","🛒");VIEW="shop";
    var r=res(v);
    var listWrap=el("div",null,"");v.appendChild(listWrap);
    function shopLoad(){
      listWrap.innerHTML="";
      listWrap.appendChild(el("div","casnote","loading shop..."));
      jget("/shop/list?token="+encodeURIComponent(tok())).then(function(d){
        listWrap.innerHTML="";
        if(refused(d)){refusedGate();return;}
        if(d.error){bad(r,d.error);return;}
        setBal(d.balance);
        var pending=d.pending||[];
        var items=d.items||[];
        if(!pending.length&&!items.length){
          listWrap.appendChild(el("div","casnote","the shelves are empty. tung hasn't stocked the shop yet."));
          return;
        }
        if(pending.length){
          listWrap.appendChild(el("div","casnote","unfinished. you already paid. tung is still waiting."));
          pending.forEach(function(p){
            var box=el("div","shopitem wait");
            var g=el("div","grow");
            g.appendChild(el("h4",null,p.name||"offering"));
            g.appendChild(el("p",null,"unfinished. tung is still waiting."));
            if(p.output)g.appendChild(el("p",null,p.output));
            box.appendChild(g);
            box.appendChild(el("div","price","paid"));
            var ans=el("button","cbtn","answer him");
            ans.onclick=function(){shopCollect(p);};
            box.appendChild(ans);
            listWrap.appendChild(box);
          });
        }
        if(items.length){
          if(pending.length)listWrap.appendChild(el("div","casnote","the shelves"));
          items.forEach(function(it){
            var box=el("div","shopitem");
            var g=el("div","grow");g.appendChild(el("h4",null,it.name));if(it.desc)g.appendChild(el("p",null,it.desc));
            /* an item that unlocks a skin says so, and says when it is already
               yours — buying it twice would just be a donation */
            if(it.themeName)g.appendChild(el("p",null,it.owned?("unlocks the "+it.themeName+" theme — already yours."):("unlocks the "+it.themeName+" theme.")));
            box.appendChild(g);
            box.appendChild(el("div","price",money(it.price)+" sahurs"));
            var buy=el("button","cbtn",it.owned?"owned":"redeem");
            if(it.owned)buy.disabled=true;
            else buy.onclick=function(){shopConfirm(it,buy);};
            box.appendChild(buy);
            listWrap.appendChild(box);
          });
        }
      }).catch(function(){listWrap.innerHTML="";bad(r,"network error");});
    }
    shopLoad();
    function shopPaintOut(text){
      var prev=v.querySelector(".shopout");if(prev)prev.remove();
      if(!text)return;
      var ob=el("div","shopout",text);
      ob.style.cssText="margin:8px 0;padding:10px 12px;border:1px solid #7a5a1a;border-radius:8px;background:#160d04;color:#f2c063;white-space:pre-wrap;word-break:break-word;font-size:13px;user-select:text";
      if(r.nextSibling)v.insertBefore(ob,r.nextSibling);else v.appendChild(ob);
    }
    function shopRedeem(it,buy,done){
      buy.disabled=true;
      jpost("/shop/redeem",{itemId:it.id}).then(function(rr){if(refused(rr)){refusedGate();return;}
        buy.disabled=false;
        if(rr.error){done(rr);return;}
        setBal(rr.balance);ok(r,"redeemed "+rr.item+". tung has been notified. he did not smile.");
        shopPaintOut(rr.output);
        shopLoad();
        done(rr);
      }).catch(function(){buy.disabled=false;done({error:"network error"});});
    }
    /* buy first. the question field is a stranger until the sahurs have moved.
       same tung-brown card as the tip overlay, two beats: pay, then speak.
       walking away after pay must leave the owed question on the shelf. */
    function shopOverlay(spec){
      var old=document.getElementById("shopOverlay");
      if(old&&old.parentNode)old.parentNode.removeChild(old);
      var ov=el("div","ov");ov.id="shopOverlay";ov.setAttribute("role","dialog");
      var card=el("div","ovcard");
      card.appendChild(el("h3",null,spec.title));
      card.appendChild(el("p","ovsub",spec.sub));
      var inp=null;
      if(spec.ask){
        card.appendChild(el("p","ovsub",spec.ask));
        inp=el("input");inp.id="shopAsk";inp.placeholder="tung is listening";
        inp.maxLength=200;card.appendChild(inp);
      }
      var err=el("p","overr","");card.appendChild(err);
      var acts=el("div","ovacts");
      var yes=el("button",null,spec.yes||"so be it");
      var no=el("button","ghost",spec.no||"walk away");
      function close(){if(ov.parentNode)ov.parentNode.removeChild(ov);}
      function walk(){close();if(spec.onNo)spec.onNo();}
      no.onclick=walk;
      ov.addEventListener("click",function(ev){if(ev.target===ov)walk();});
      yes.onclick=function(){
        var input=inp?String(inp.value||"").trim():"";
        if(inp&&!input){err.textContent="tung asked a question. you stared back. try again.";return;}
        spec.onYes(input,{close:close,err:function(t){err.textContent=t;},busy:function(on){yes.disabled=on;no.disabled=on;}});
      };
      if(inp)inp.addEventListener("keydown",function(ev){if(ev.key==="Enter"){ev.preventDefault();yes.onclick();}});
      acts.appendChild(yes);acts.appendChild(no);card.appendChild(acts);
      ov.appendChild(card);document.body.appendChild(ov);ov.style.display="flex";
      if(inp)try{inp.focus();}catch(e){}
    }
    function shopConfirm(it,buy){
      shopOverlay({
        title:"place it on the altar",
        sub:it.name+" costs "+money(it.price)+" sahurs. tung does not do refunds. tung does not do sympathy.",
        ask:"",
        onYes:function(_input,api){
          api.busy(true);
          shopRedeem(it,buy,function(rr){
            if(rr.error){api.err(rr.error==="insufficient"?"not enough sahurs. the shelves do not do credit.":rr.error);api.busy(false);return;}
            api.close();
            if(rr.pending)shopCollect(rr.pending);
          });
        }
      });
    }
    function shopCollect(p){
      shopOverlay({
        title:"the shelves have you",
        sub:"you already paid. the question remains. walk away and it will still be waiting on the shelf.",
        ask:p.inputLabel,
        yes:"answer him",
        onYes:function(input,api){
          api.busy(true);
          jpost("/shop/tell",{redeemId:p.id,itemId:p.itemId,input:input}).then(function(rr){if(refused(rr)){refusedGate();return;}
            if(rr.error){api.err(rr.error==="nothing to add"?"tung already heard you. or he never will.":rr.error);api.busy(false);return;}
            api.close();
            ok(r,"tung wrote it down. he did not smile.");
            shopPaintOut(rr.output);
            shopLoad();
          }).catch(function(){api.err("the shelves are silent.");api.busy(false);});
        },
        onNo:function(){shopLoad();}
      });
    }
  }
})();
`;

  Shrine.CASINO_JS = CASINO_JS;
})();
