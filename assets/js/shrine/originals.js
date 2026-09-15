/* ==========================================================================
   Shrine of Tung — originals hub
   Tung's own games, which live in this repo under games/tung/ rather than
   coming from anyone else's host. The originals view renders this list.
   ========================================================================== */
(function () {
  "use strict";
  var Shrine = (window.Shrine = window.Shrine || {});

  /* config.js sets Shrine.BASE and normally loads first; the page is the
     fallback so this module still stands up on its own, which is how the
     source-level tests in scripts/ load it. */
  var BASE = Shrine.BASE || location.href;

  var ORIGINALS = [
    {n:"Flappy Tung", u: new URL("games/tung/flappy.html", BASE).href, s:"gravity is inevitable. tung disagrees."},
    {n:"Sahur Snake", u: new URL("games/tung/snake.html", BASE).href, s:"eat. lengthen. forget why."},
    {n:"Sahur Pong", u: new URL("games/tung/pong.html", BASE).href, s:"he returns every serve. he always has."}
  ];

  Shrine.ORIGINALS = ORIGINALS;
})();
