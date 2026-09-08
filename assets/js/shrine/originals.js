/* ==========================================================================
   Shrine of Tung — originals hub
   Tung's own games, which live in this repo under games/tung/ rather than
   coming from anyone else's host. The originals view renders this list.
   ========================================================================== */
(function () {
  "use strict";
  var Shrine = (window.Shrine = window.Shrine || {});

  var ORIGINALS = [
    {n:"Flappy Tung", u: new URL("games/tung/flappy.html", location.href).href, s:"gravity is inevitable. tung disagrees."},
    {n:"Sahur Snake", u: new URL("games/tung/snake.html", location.href).href, s:"eat. lengthen. forget why."},
    {n:"Sahur Pong", u: new URL("games/tung/pong.html", location.href).href, s:"he returns every serve. he always has."}
  ];

  Shrine.ORIGINALS = ORIGINALS;
})();
