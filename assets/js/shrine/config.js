/* ==========================================================================
   Shrine of Tung — shared configuration
   First shrine file to load: it creates the window.Shrine namespace every other
   shrine module hangs off. Backend base URL, the artwork URLs, the ace mark and
   the cloaked UI labels all live here because the chat, the casino, the catalog
   and the window shell each need some of them.
   ========================================================================== */
(function () {
  "use strict";
  var Shrine = (window.Shrine = window.Shrine || {});

  /* ---------- the backend ----------
     clicking Sahur opens an about:blank window running the chat client, which
     talks to the Deno backend (server.ts) over plain HTTP: apply -> poll
     /status -> poll /events for history + live messages, POST /send + /react.
     a hidden tab does not fire /events or /status; on visible, one catch-up
     /events?since= then 8s. auth, usernames, approvals and message history
     all live server-side in Deno KV. the discord webhook + admin key live
     in the server's env vars. */
  var SHRINE_API = "https://offline-learning.kanyewest50000.deno.net";
  try {
    var _apiQ = new URLSearchParams(location.search).get("api");
    if (_apiQ) SHRINE_API = String(_apiQ).replace(/\/$/, "");
  } catch (e) {}

  /* Tung artwork now ships with the repo instead of hotlinking someone else's CDN.
     Resolved to absolute URLs here because the shrine/casino windows are written
     into about:blank, which has no base URL for relative paths to resolve against. */
  var TUNG_IMG = new URL("assets/tungtungtungsahur.png", location.href).href;
  var TUNGGOD_IMG = new URL("assets/tungtunggod.png", location.href).href;

  /* html-escape for anything interpolated into the shrine document */
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /* ace-of-spades mark used by the casino button and the casino header */
  function SPADE(size) {
    return '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size + '" aria-hidden="true">' +
      '<path fill="currentColor" d="M12 2.2c-.3 0-.5.1-.7.3C9 4.9 3.6 9.6 3.6 13.6c0 2.2 1.8 3.9 3.9 3.9.8 0 1.6-.3 2.2-.7-.2 1.5-1 2.8-2.3 3.6-.3.2-.4.5-.3.8.1.3.4.5.7.5h8.4c.3 0 .6-.2.7-.5.1-.3 0-.6-.3-.8-1.3-.8-2.1-2.1-2.3-3.6.6.4 1.4.7 2.2.7 2.1 0 3.9-1.7 3.9-3.9 0-4-5.4-8.7-7.7-11.1-.2-.2-.4-.3-.7-.3z"/></svg>';
  }

  /* UI cloak: Cyrillic/script lookalikes read as Latin on screen but use other
     codepoints, so Ctrl+F / naive source scanners miss the hot words. Escapes
     only — those ASCII words never appear in these constants. */
  var LBL_PLAYS = "gam\u0435s";
  var LBL_PLAYS_CAP = "Gam\u0435s";
  var LBL_VEIL = "pr\u043Exy";
  var LBL_VEIL_CAP = "Pr\u043Exy";
  var LBL_CURATED = "Tung\u2019s Curated " + LBL_PLAYS_CAP;
  var LBL_ORIGINALS = "Tung\u2019s Original " + LBL_PLAYS_CAP;
  var LBL_WEB_VEIL = "Web " + LBL_VEIL_CAP;
  var LBL_SEARCH = "search " + LBL_PLAYS;
  var LBL_POPUP = "allow popups to play " + LBL_PLAYS;

  /* the web veil is a destination now, not a "coming soon" page: the chooser
     button opens it in its own tab through the same opener the catalog uses, so
     it gets the same cloaked title, the same header and the same egg lines. */
  var VEIL_URL = "https://thecontrolhub.pages.dev";

  Shrine.API = SHRINE_API;
  Shrine.TUNG_IMG = TUNG_IMG;
  Shrine.TUNGGOD_IMG = TUNGGOD_IMG;
  Shrine.VEIL_URL = VEIL_URL;
  Shrine.esc = esc;
  Shrine.SPADE = SPADE;
  Shrine.LBL = {
    PLAYS: LBL_PLAYS,
    PLAYS_CAP: LBL_PLAYS_CAP,
    VEIL: LBL_VEIL,
    VEIL_CAP: LBL_VEIL_CAP,
    CURATED: LBL_CURATED,
    ORIGINALS: LBL_ORIGINALS,
    WEB_VEIL: LBL_WEB_VEIL,
    SEARCH: LBL_SEARCH,
    POPUP: LBL_POPUP
  };
})();
