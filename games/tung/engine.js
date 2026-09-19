/* ==========================================================================
   Who you are playing, when you are not playing a person.

   Two of them, and the page picks between them:

     tung's own head   a few hundred lines of alpha-beta search right here.
                       Starts instantly, costs nothing to fetch, and plays
                       somewhere around a decent club player at "thinking".
     stockfish         the real engine, 350KB of WebAssembly served from this
                       site, run in a Worker and spoken to in UCI.

   Neither one touches the shrine's backend. A game against the computer is a
   thing that happens entirely inside this tab — no table, no escrow, no polling
   and nothing for anybody to pay for.

   Both are handed a FEN and answer with a move in long algebraic ("e2e4",
   "e7e8q"), so the page does not care which of them it is talking to.
   ========================================================================== */
(function () {
  "use strict";
  var R = window.ChessRules;

  /* ---------------------------------------------------------------------
     tung's own head

     Plain alpha-beta over material plus piece-square tables, with a short
     capture-only search at the leaves so it stops hanging pieces to the
     obvious recapture. Move ordering is captures first, by what is taken and
     what does the taking, which is most of what makes the pruning work.
     --------------------------------------------------------------------- */
  var VAL = [0, 100, 320, 330, 500, 900, 20000];

  /* from white's point of view, a1 first; black reads the same table mirrored */
  var PST = {
    1: [ 0,  0,  0,  0,  0,  0,  0,  0,
         5, 10, 10,-20,-20, 10, 10,  5,
         5, -5,-10,  0,  0,-10, -5,  5,
         0,  0,  0, 20, 20,  0,  0,  0,
         5,  5, 10, 25, 25, 10,  5,  5,
        10, 10, 20, 30, 30, 20, 10, 10,
        50, 50, 50, 50, 50, 50, 50, 50,
         0,  0,  0,  0,  0,  0,  0,  0],
    2: [-50,-40,-30,-30,-30,-30,-40,-50,
        -40,-20,  0,  5,  5,  0,-20,-40,
        -30,  5, 10, 15, 15, 10,  5,-30,
        -30,  0, 15, 20, 20, 15,  0,-30,
        -30,  5, 15, 20, 20, 15,  5,-30,
        -30,  0, 10, 15, 15, 10,  0,-30,
        -40,-20,  0,  0,  0,  0,-20,-40,
        -50,-40,-30,-30,-30,-30,-40,-50],
    3: [-20,-10,-10,-10,-10,-10,-10,-20,
        -10,  5,  0,  0,  0,  0,  5,-10,
        -10, 10, 10, 10, 10, 10, 10,-10,
        -10,  0, 10, 10, 10, 10,  0,-10,
        -10,  5,  5, 10, 10,  5,  5,-10,
        -10,  0,  5, 10, 10,  5,  0,-10,
        -10,  0,  0,  0,  0,  0,  0,-10,
        -20,-10,-10,-10,-10,-10,-10,-20],
    4: [  0,  0,  5, 10, 10,  5,  0,  0,
         -5,  0,  0,  0,  0,  0,  0, -5,
         -5,  0,  0,  0,  0,  0,  0, -5,
         -5,  0,  0,  0,  0,  0,  0, -5,
         -5,  0,  0,  0,  0,  0,  0, -5,
         -5,  0,  0,  0,  0,  0,  0, -5,
          5, 10, 10, 10, 10, 10, 10,  5,
          0,  0,  0,  0,  0,  0,  0,  0],
    5: [-20,-10,-10, -5, -5,-10,-10,-20,
        -10,  0,  5,  0,  0,  0,  0,-10,
        -10,  5,  5,  5,  5,  5,  0,-10,
          0,  0,  5,  5,  5,  5,  0, -5,
         -5,  0,  5,  5,  5,  5,  0, -5,
        -10,  0,  5,  5,  5,  5,  0,-10,
        -10,  0,  0,  0,  0,  0,  0,-10,
        -20,-10,-10, -5, -5,-10,-10,-20],
    6: [ 20, 30, 10,  0,  0, 10, 30, 20,
         20, 20,  0,  0,  0,  0, 20, 20,
        -10,-20,-20,-20,-20,-20,-20,-10,
        -20,-30,-30,-40,-40,-30,-30,-20,
        -30,-40,-40,-50,-50,-40,-40,-30,
        -30,-40,-40,-50,-50,-40,-40,-30,
        -30,-40,-40,-50,-50,-40,-40,-30,
        -30,-40,-40,-50,-50,-40,-40,-30]
  };

  /* positive means good for the side to move */
  function evaluate(p) {
    var score = 0;
    for (var i = 0; i < 64; i++) {
      var v = p.b[i];
      if (!v) continue;
      var t = Math.abs(v);
      var sq = v > 0 ? i : (56 - (i & 56) + (i & 7));   /* mirror the rank for black */
      var here = VAL[t] + (PST[t] ? PST[t][sq] : 0);
      score += v > 0 ? here : -here;
    }
    return p.w ? score : -score;
  }

  /* captures first, and among them the fattest target taken by the cheapest
     piece — the single cheapest thing that makes alpha-beta actually prune */
  function order(p, moves) {
    return moves.map(function (m) {
      var taken = Math.abs(p.b[m.to]);
      var mover = Math.abs(p.b[m.from]);
      return { m: m, s: taken ? (VAL[taken] * 10 - VAL[mover]) : (m.promo ? 800 : 0) };
    }).sort(function (a, b) { return b.s - a.s; }).map(function (x) { return x.m; });
  }

  /* only captures, so the leaf is a quiet position rather than the middle of a
     trade — without this it hangs a queen to anything that takes back */
  function quiesce(p, alpha, beta, depth) {
    var stand = evaluate(p);
    if (stand >= beta) return beta;
    if (stand > alpha) alpha = stand;
    if (depth <= 0) return alpha;
    var caps = R.chessMoves(p).filter(function (m) { return !!p.b[m.to] || m.promo; });
    caps = order(p, caps);
    for (var i = 0; i < caps.length; i++) {
      var s = -quiesce(R.chessApply(p, caps[i]), -beta, -alpha, depth - 1);
      if (s >= beta) return beta;
      if (s > alpha) alpha = s;
    }
    return alpha;
  }

  function search(p, depth, alpha, beta, ply) {
    if (depth <= 0) return quiesce(p, alpha, beta, 4);
    var moves = R.chessMoves(p);
    if (!moves.length) {
      /* mate is worse the sooner it happens, so it prefers the long defence */
      return R.chessInCheck(p, p.w) ? -30000 + ply : 0;
    }
    moves = order(p, moves);
    for (var i = 0; i < moves.length; i++) {
      var s = -search(R.chessApply(p, moves[i]), depth - 1, -beta, -alpha, ply + 1);
      if (s >= beta) return beta;
      if (s > alpha) alpha = s;
    }
    return alpha;
  }

  function best(fen, depth, slop) {
    var p = R.chessParse(fen);
    var moves = order(p, R.chessMoves(p));
    if (!moves.length) return null;
    var scored = [];
    /* Full window at the root, every time. The search below is fail-hard: on a
       cutoff it returns the bound rather than the score, which is fine deeper
       down where only the bound is used, and wrong here where the actual number
       decides which move gets played. Narrowing this window to (-inf, -alpha)
       as an ordinary alpha-beta would made every move better than the current
       best come back clamped to exactly equal it — so the first decent move
       found was never beaten, and the thing missed mate in one and declined a
       free queen. Root nodes are few; correctness is worth more than the
       pruning here. */
    for (var i = 0; i < moves.length; i++) {
      scored.push({ m: moves[i], s: -search(R.chessApply(p, moves[i]), depth - 1, -Infinity, Infinity, 1) });
    }
    scored.sort(function (a, b) { return b.s - a.s; });
    /* `slop` is the whole difficulty setting: at easy it will happily take a
       move a bit worse than the best one, which is what makes it beatable
       without making it play nonsense */
    var top = scored[0].s;
    var ok = scored.filter(function (x) { return x.s >= top - slop; });
    return R.chessUci(ok[Math.floor(Math.random() * ok.length)].m);
  }

  function ownHead(depth, slop) {
    return {
      pick: function (fen, done) {
        /* off the paint thread, so the board has already redrawn before this
           starts chewing — otherwise the piece you moved appears late */
        setTimeout(function () { done(best(fen, depth, slop)); }, 10);
      },
      stop: function () {}
    };
  }

  /* ---------------------------------------------------------------------
     stockfish

     The real thing, in a Worker, spoken to in UCI. It is served from this same
     host as an ordinary static file — it never goes near the backend, and it
     is cached by the browser after the first game.

     If it cannot be fetched at all (a network that blocks .wasm, an ad
     blocker, a locked-down school proxy) the game does not break: it falls
     back to tung's own head at its strongest and says so.
     --------------------------------------------------------------------- */
  function stockfish(note) {
    var w = null, ready = false, waiting = null, dead = false;
    /* whether a `go` is outstanding, and the request that is to follow it. Two
       searches at once is not a conversation UCI has: the second `go` arrives
       mid-search and the `bestmove` that comes back answers whichever position
       it feels like. A take-back is exactly how that happens — the board moves
       while he is thinking — so a new question stops the old search and waits
       for it to land rather than talking over it. */
    var busy = false, queued = null;
    var fallback = ownHead(3, 0);

    function giveUp(why) {
      if (dead) return;
      dead = true;
      busy = false;
      try { if (w) w.terminate(); } catch (e) {}
      w = null;
      note(why + " — playing tung's own head instead.");
      if (queued) { waiting = queued; queued = null; }
      if (waiting) { var f = waiting; waiting = null; fallback.pick(f.fen, f.done); }
    }

    try {
      w = new Worker("stockfish/stockfish.js");
    } catch (e) {
      giveUp("stockfish would not start");
    }

    if (w) {
      w.onerror = function () { giveUp("stockfish would not load"); };
      w.onmessage = function (ev) {
        var line = typeof ev.data === "string" ? ev.data : (ev.data && ev.data.data) || "";
        if (line.indexOf("uciok") === 0 || line.indexOf("uciok") > -1) {
          w.postMessage("isready");
          return;
        }
        if (line.indexOf("readyok") > -1) {
          ready = true;
          note("");
          if (waiting) { var q = waiting; waiting = null; ask(q.fen, q.done); }
          return;
        }
        if (line.indexOf("bestmove") === 0) {
          var uci = line.split(/\s+/)[1];
          var cb = w.__cb; w.__cb = null;
          busy = false;
          /* a question was asked while this one was still being answered, so
             this answer is about a board nobody is looking at any more */
          if (queued) { var nx = queued; queued = null; ask(nx.fen, nx.done); return; }
          if (cb) cb(uci && uci !== "(none)" ? uci : null);
        }
      };
      w.postMessage("uci");
      /* it either wakes up or it does not; ten seconds is generous */
      setTimeout(function () { if (!ready && !dead) giveUp("stockfish did not answer"); }, 10000);
    }

    function ask(fen, done) {
      if (busy) {
        /* cut the running search short and let this one go when its bestmove
           comes back; UCI's own way of saying "never mind, the board moved" */
        queued = { fen: fen, done: done };
        w.postMessage("stop");
        return;
      }
      busy = true;
      w.__cb = done;
      w.postMessage("position fen " + fen);
      w.postMessage("go movetime 700");
    }

    return {
      pick: function (fen, done) {
        if (dead) return fallback.pick(fen, done);
        if (!ready) { waiting = { fen: fen, done: done }; return; }
        ask(fen, done);
      },
      stop: function () {
        dead = true; busy = false; queued = null; waiting = null;
        try { if (w) w.terminate(); } catch (e) {} w = null;
      }
    };
  }

  window.TungEngine = {
    make: function (level, note) {
      if (level === "hard") return stockfish(note || function () {});
      /* depth, and how much worse than best it is willing to play */
      if (level === "easy") return ownHead(2, 120);
      return ownHead(4, 12);
    }
  };
})();
