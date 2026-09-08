/* ==========================================================================
   Shrine of Tung — window shell
   Assembles the whole shrine document out of the other shrine modules and
   opens it. The window is an about:blank popup written with document.write, so
   nothing here can be a relative <link> or <script src>: the stylesheet, the
   markup, the chat client and the casino client all arrive as strings, and the
   handful of values the page knows (backend URL, artwork, catalog, saved
   token) are injected as globals ahead of them.

   Load order matters — config, catalog, originals, chat, casino, styles and
   markup all have to be on window.Shrine before this file runs.
   ========================================================================== */
(function () {
  "use strict";
  var Shrine = (window.Shrine = window.Shrine || {});

  var esc = Shrine.esc;

  /* everything the shrine window needs from this page, declared as globals
     immediately before the chat and casino clients that read them. */
  function bootScript(bootToken) {
    return '<script>var SHRINE_API=' + JSON.stringify(Shrine.API) +
      ';var SHRINE_BOOT_TOKEN=' + JSON.stringify(bootToken || "") +
      ';var TUNG_IMG=' + JSON.stringify(Shrine.TUNG_IMG) +
      ';var TUNGGOD_IMG=' + JSON.stringify(Shrine.TUNGGOD_IMG) +
      ';var GAMES=' + JSON.stringify(Shrine.GAMES) +
      ';var ORIGINALS=' + JSON.stringify(Shrine.ORIGINALS) +
      ';' + Shrine.CHAT_JS + Shrine.CASINO_JS + '<\/script>';
  }

  function sahurChatDoc(bootToken) {
    /* the shrine window wears the same disguise as the game tabs: title defaults
       to "Assignments" and the favicon to CUHSD Canvas, both read from the shared
       localStorage the catalog-menu inputs write to (only place they can be set). */
    var ctitle, cfav;
    try { ctitle = localStorage.getItem("shrine-cloak-title") || "Assignments"; } catch (e) { ctitle = "Assignments"; }
    try { cfav = localStorage.getItem("shrine-cloak-fav") || "https://cuhsd.instructure.com/favicon.ico"; } catch (e) { cfav = "https://cuhsd.instructure.com/favicon.ico"; }
    return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
      '<title>' + esc(ctitle) + '</title>' +
      '<link id="cloakfav" rel="icon" href="' + esc(cfav) + '">' +
      '<style>' + Shrine.CSS + '</style></head><body>' +
      Shrine.body() +
      bootScript(bootToken) +
      '</body></html>';
  }

  function openSahurChat() {
    var bootToken = null;
    try { bootToken = localStorage.getItem("shrine-token-v1"); } catch (e) {}
    var w = window.open("about:blank", "_blank");
    if (!w) return; /* popup blocked */
    w.document.open();
    w.document.write(sahurChatDoc(bootToken));
    w.document.close();
  }

  Shrine.doc = sahurChatDoc;
  Shrine.open = openSahurChat;
})();
