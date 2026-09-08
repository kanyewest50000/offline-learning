/* ==========================================================================
   Untether — homepage runtime
   Everything the decoy landing page does on its own: it fills each .img-slot
   with a drawn illustration or a field photo, runs the impact calculator, and
   keeps the footer odometer. It also holds the three doors out of the decoy —
   the "tung" unlock, the staff portrait that opens the shrine window, and the
   "popup" keyword — but none of the shrine itself, which lives under
   assets/js/shrine/.
   ========================================================================== */
(function () {
  "use strict";

  /* the shrine modules are already loaded; this page only ever calls
     Shrine.open() and reads the artwork URL. */
  var Shrine = window.Shrine || {};

  /* =====================================================================
     Imagery
     Every .img-slot gets an inline-SVG "stock illustration" matching its
     data-theme. Each slot also has a small independent chance of instead
     receiving something... else. Clicking one of those increments the
     otherwise-unused odometer in the footer. That is all it does.
     ===================================================================== */

  var SWAP_CHANCE = 0.01;   /* ultra rare: ~1 slot in 100 shows a cover */

  /* the odometer popup is parked for now. covers still appear and still bump the
     counter — flip this back to true to re-arm the payload. */
  var EGG_POPUP_ENABLED = false;

  function svgWrap(inner, bg) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" role="img">' +
           '<rect width="400" height="300" fill="' + bg + '"/>' + inner + '</svg>';
  }

  /* ---------- real photos for field cases, team, and journal ---------- */
  var FIELD_PHOTOS = {
    mountains: "assets/photos/case-highland.jpg",
    library: "assets/photos/case-library.jpg",
    desert: "assets/photos/case-desert.jpg",
    portrait1: "assets/photos/team-okafor.jpg",
    portrait2: "assets/photos/team-reyes.jpg",
    portrait3: "assets/photos/team-sokhela.jpg",
    portrait4: "assets/photos/team-lindqvist.jpg",
    radio: "assets/photos/journal-radio.jpg",
    solar: "assets/photos/journal-solar.jpg",
    books: "assets/photos/journal-books.jpg"
  };

  /* ---------- stock illustrations, one per theme ---------- */
  var STOCK = {
    classroom: function () {
      return svgWrap(
        '<rect x="40" y="60" width="320" height="150" rx="8" fill="#2e5d43"/>' +
        '<rect x="55" y="75" width="290" height="120" rx="4" fill="#3e7a58"/>' +
        '<text x="200" y="130" text-anchor="middle" font-family="Georgia" font-size="26" fill="#eaf3ec">a + b = learning</text>' +
        '<text x="200" y="165" text-anchor="middle" font-family="Georgia" font-size="13" fill="#bcd8c6">no wifi required</text>' +
        '<rect x="80" y="230" width="70" height="40" rx="5" fill="#c9b98f"/>' +
        '<rect x="165" y="230" width="70" height="40" rx="5" fill="#c9b98f"/>' +
        '<rect x="250" y="230" width="70" height="40" rx="5" fill="#c9b98f"/>',
        '#f0e9d8');
    },
    globe: function () {
      return svgWrap(
        '<circle cx="200" cy="150" r="105" fill="#1f6f43"/>' +
        '<path d="M110 130 q60 -40 180 -10 M100 170 q90 40 200 5 M200 45 q-45 100 0 210 M200 45 q45 100 0 210" stroke="#eaf3ec" stroke-width="3" fill="none" opacity="0.7"/>' +
        '<circle cx="150" cy="120" r="6" fill="#f5d9a8"/><circle cx="255" cy="175" r="6" fill="#f5d9a8"/><circle cx="200" cy="220" r="6" fill="#f5d9a8"/>' +
        '<path d="M150 120 L255 175 L200 220" stroke="#f5d9a8" stroke-width="2" stroke-dasharray="6 5" fill="none"/>',
        '#e9e2d0');
    },
    circuit: function () {
      return svgWrap(
        '<path d="M30 150 H120 V80 H220 V150 H370 M120 150 V230 H260 V150" stroke="#d9931f" stroke-width="3" fill="none"/>' +
        '<circle cx="120" cy="150" r="8" fill="#d9931f"/><circle cx="220" cy="150" r="8" fill="#d9931f"/><circle cx="260" cy="150" r="8" fill="#d9931f"/>' +
        '<rect x="165" y="120" width="110" height="60" rx="6" fill="#2a2620" stroke="#d9931f" stroke-width="2"/>' +
        '<text x="220" y="156" text-anchor="middle" font-family="monospace" font-size="16" fill="#f5d9a8">HEARTH v3</text>',
        '#1c1a15');
    },
    mountains: function () {
      return svgWrap(
        '<path d="M0 240 L110 90 L190 210 L260 110 L400 250 V300 H0 Z" fill="#3e6b52"/>' +
        '<path d="M110 90 L145 140 H80 Z" fill="#eef3ee"/>' +
        '<circle cx="320" cy="70" r="30" fill="#f5d9a8"/>' +
        '<rect x="170" y="235" width="60" height="35" rx="4" fill="#8a6f3e"/><path d="M165 235 L200 210 L235 235 Z" fill="#6e5730"/>',
        '#dcebf0');
    },
    library: function () {
      return svgWrap(
        '<rect x="50" y="50" width="300" height="200" rx="8" fill="#7a5a34"/>' +
        '<rect x="65" y="70" width="40" height="70" fill="#1f6f43"/><rect x="112" y="70" width="40" height="70" fill="#d9931f"/><rect x="159" y="70" width="40" height="70" fill="#8c3b2e"/><rect x="206" y="70" width="40" height="70" fill="#33556e"/><rect x="253" y="70" width="40" height="70" fill="#1f6f43"/><rect x="300" y="70" width="35" height="70" fill="#d9931f"/>' +
        '<rect x="65" y="160" width="40" height="70" fill="#33556e"/><rect x="112" y="160" width="40" height="70" fill="#8c3b2e"/><rect x="159" y="160" width="40" height="70" fill="#1f6f43"/><rect x="206" y="160" width="40" height="70" fill="#d9931f"/><rect x="253" y="160" width="40" height="70" fill="#33556e"/><rect x="300" y="160" width="35" height="70" fill="#8c3b2e"/>',
        '#efe7d4');
    },
    desert: function () {
      return svgWrap(
        '<circle cx="90" cy="80" r="34" fill="#f2c063"/>' +
        '<path d="M0 220 Q120 180 220 215 T400 205 V300 H0 Z" fill="#d9b36a"/>' +
        '<path d="M0 250 Q140 225 400 245 V300 H0 Z" fill="#c69a4d"/>' +
        '<rect x="255" y="150" width="90" height="60" rx="6" fill="#f5efe0"/><path d="M248 150 L300 118 L352 150 Z" fill="#e2d7bd"/>',
        '#f6e3c0');
    },
    radio: function () {
      return svgWrap(
        '<rect x="180" y="120" width="40" height="130" fill="#565043"/>' +
        '<path d="M200 120 L160 250 M200 120 L240 250" stroke="#565043" stroke-width="6"/>' +
        '<circle cx="200" cy="105" r="10" fill="#d9931f"/>' +
        '<path d="M160 85 q40 -35 80 0 M140 60 q60 -55 120 0 M120 38 q80 -70 160 0" stroke="#d9931f" stroke-width="4" fill="none" opacity="0.75"/>',
        '#e9e2d0');
    },
    solar: function () {
      return svgWrap(
        '<circle cx="330" cy="60" r="28" fill="#f2c063"/>' +
        '<g transform="rotate(-12 200 170)"><rect x="90" y="110" width="220" height="120" rx="6" fill="#26456e"/>' +
        '<path d="M90 150 H310 M90 190 H310 M145 110 V230 M200 110 V230 M255 110 V230" stroke="#dcebf0" stroke-width="3"/></g>' +
        '<rect x="185" y="235" width="30" height="45" fill="#565043"/>',
        '#efe7d4');
    },
    books: function () {
      return svgWrap(
        '<g transform="rotate(-8 200 160)"><rect x="120" y="180" width="170" height="26" rx="4" fill="#8c3b2e"/></g>' +
        '<rect x="115" y="150" width="175" height="26" rx="4" fill="#1f6f43"/>' +
        '<g transform="rotate(5 200 130)"><rect x="128" y="118" width="160" height="26" rx="4" fill="#33556e"/></g>' +
        '<g transform="rotate(-3 200 100)"><rect x="140" y="88" width="140" height="26" rx="4" fill="#d9931f"/></g>' +
        '<text x="200" y="255" text-anchor="middle" font-family="Georgia" font-size="14" fill="#8a8271">knowledge, pre-downloaded</text>',
        '#f0e9d8');
    },
    portrait1: function () {
      return svgWrap('<circle cx="200" cy="118" r="58" fill="#8a5a3b"/><path d="M95 300 Q200 195 305 300 Z" fill="#1f6f43"/><path d="M148 92 q52 -44 104 0 v-24 q-52 -30 -104 0 Z" fill="#2a2620"/>', '#e9e2d0');
    },
    portrait2: function () {
      return svgWrap('<circle cx="200" cy="118" r="58" fill="#c98a5b"/><path d="M95 300 Q200 195 305 300 Z" fill="#33556e"/><rect x="150" y="98" width="100" height="14" rx="7" fill="#2a2620"/><circle cx="172" cy="105" r="17" fill="none" stroke="#2a2620" stroke-width="5"/><circle cx="228" cy="105" r="17" fill="none" stroke="#2a2620" stroke-width="5"/>', '#efe7d4');
    },
    portrait3: function () {
      return svgWrap('<circle cx="200" cy="118" r="58" fill="#6e4a2f"/><path d="M95 300 Q200 195 305 300 Z" fill="#8c3b2e"/><path d="M142 100 a58 58 0 0 1 116 0 q-58 -34 -116 0 Z" fill="#2a2620"/>', '#f0e9d8');
    },
    portrait4: function () {
      return svgWrap('<circle cx="200" cy="118" r="58" fill="#d8a878"/><path d="M95 300 Q200 195 305 300 Z" fill="#565043"/><path d="M142 118 q0 -70 58 -70 q58 0 58 70 q-14 -38 -58 -38 q-44 0 -58 38 Z" fill="#b8862f"/>', '#e9e2d0');
    }
  };

  /* ---------- the other kind of "stock image" ---------- */
  /* stylized homage renderings; recognition is left as an exercise */
  function coverWrap(inner, bg) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice" role="img">' +
           '<rect width="400" height="400" fill="' + bg + '"/>' + inner + '</svg>';
  }

  var COVERS = [
    { name: "Up 2 Më",
      url: "https://upload.wikimedia.org/wikipedia/en/3/34/Up_2_Me_album_cover.png",
      svg: coverWrap(
        '<ellipse cx="200" cy="205" rx="95" ry="130" fill="#3a3a3a" opacity="0.85"/>' +
        '<ellipse cx="200" cy="120" rx="52" ry="58" fill="#4a4038" opacity="0.9"/>' +
        '<text x="200" y="330" text-anchor="middle" font-family="Georgia" font-size="44" fill="#cfcfcf" opacity="0.9" style="letter-spacing:4px">Up 2 Më</text>',
        '#141414') },
    { name: "2 Alivë",
      url: "https://upload.wikimedia.org/wikipedia/en/9/91/Yeat2AliveCover.png",
      svg: coverWrap(
        '<ellipse cx="200" cy="185" rx="80" ry="105" fill="#20301c"/>' +
        '<ellipse cx="172" cy="165" rx="16" ry="24" fill="#9fdc7a" opacity="0.9"/>' +
        '<ellipse cx="228" cy="165" rx="16" ry="24" fill="#9fdc7a" opacity="0.9"/>' +
        '<text x="200" y="345" text-anchor="middle" font-family="Georgia" font-size="46" fill="#b8e986" style="letter-spacing:3px">2 Alivë</text>',
        '#0c1408') },
    { name: "2093",
      url: "https://upload.wikimedia.org/wikipedia/en/9/97/Yeat_-_2093.png",
      svg: coverWrap(
        '<rect x="120" y="90" width="160" height="220" rx="80" fill="#aeb6c4" opacity="0.25"/>' +
        '<rect x="145" y="115" width="110" height="170" rx="55" fill="#dfe5ee" opacity="0.35"/>' +
        '<text x="200" y="225" text-anchor="middle" font-family="monospace" font-size="88" fill="#e8edf5" style="letter-spacing:6px">2093</text>' +
        '<text x="200" y="265" text-anchor="middle" font-family="monospace" font-size="16" fill="#7d879a">PSYCHO CEO</text>',
        '#10131a') },
    { name: "4L",
      url: "https://i.scdn.co/image/ab67616d0000b27387b1f578fa40d6ac504b57d7",
      svg: coverWrap(
        '<path d="M200 80 q-70 15 -70 110 v40 h140 v-40 q0 -95 -70 -110 Z" fill="#c9a227"/>' +
        '<rect x="188" y="60" width="24" height="26" rx="8" fill="#c9a227"/>' +
        '<circle cx="200" cy="252" r="16" fill="#a9871f"/>' +
        '<text x="200" y="345" text-anchor="middle" font-family="Georgia" font-size="60" fill="#e6c34a" style="letter-spacing:8px">4L</text>',
        '#171204') },
    { name: "Lyfestylë",
      url: "https://upload.wikimedia.org/wikipedia/en/3/39/Yeat_-_Lyfestyle.png",
      svg: coverWrap(
        '<rect x="90" y="90" width="220" height="220" rx="14" fill="#241a33"/>' +
        '<circle cx="200" cy="180" r="55" fill="#3c2a55"/>' +
        '<path d="M150 300 h100" stroke="#8f6fd0" stroke-width="8"/>' +
        '<text x="200" y="355" text-anchor="middle" font-family="Georgia" font-size="36" fill="#a98ae0" style="letter-spacing:3px">Lyfestylë</text>',
        '#120b1c') }
  ];

  /* ---------- the counter (purpose: unknown) ---------- */
  /* resets every visit — the odometer always starts fresh at 0, so the
     egg is re-earned each time rather than remembered. */
  var counterEl = document.getElementById("mystery-counter");
  var count = 0;

  function renderCount() {
    counterEl.textContent = String(count).padStart(4, "0");
  }

  function bumpCount() {
    count += 1;
    renderCount();
    counterEl.classList.remove("bump");
    void counterEl.offsetWidth; /* restart the animation */
    counterEl.classList.add("bump");
    if (count === 3 && EGG_POPUP_ENABLED) openEasterEgg();
  }

  /* the payload behind the odometer */
  var EGG_URL = "https://interim-sibby-cbv-32a44484.koyeb.app/";

  /* opens an about:blank popup whose entire window is filled by the egg site.
     fires the moment the odometer hits 3. */
  function openEasterEgg() {
    var w = window.open("about:blank", "_blank");
    if (!w) return; /* popup blocked: the odometer keeps its secrets */
    w.document.open();
    w.document.write(
      '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
      '<title>Loading</title>' +
      '<style>html,body{margin:0;padding:0;height:100%;overflow:hidden}' +
      'iframe{width:100%;height:100%;border:none;display:block}' +
      'iframe:not([src]){display:none}</style>' +
      '</head><body>' +
      '<iframe src="' + EGG_URL + '" allow="autoplay; fullscreen"></iframe>' +
      '<script>' +
      'const iframe = document.createElement("iframe");' +
      'document.body.appendChild(iframe);' +
      'iframe.contentDocument.write("<iframe>");' +
      '<\/script>' +
      '</body></html>'
    );
    w.document.close();
  }

  renderCount();

  /* ---------- occasional staff member ---------- */
  var SAHUR_CHANCE = 1; /* guaranteed: the first team portrait is always Sahur, so the chat is always reachable */
  var SAHUR = {
    name: "T. T. T. Sahur",
    /* the photo variant below; the drawn homage in .svg is the fallback */
    url: Shrine.TUNG_IMG,
    svg: coverWrap(
      /* ground shadow + warm lantern glow */
      '<ellipse cx="200" cy="372" rx="150" ry="24" fill="#160d04"/>' +
      '<circle cx="72" cy="82" r="42" fill="#f2c063" opacity="0.22"/>' +
      /* thin plank legs */
      '<rect x="176" y="300" width="16" height="66" rx="8" fill="#a9743c" stroke="#3a2410" stroke-width="3"/>' +
      '<rect x="208" y="300" width="16" height="66" rx="8" fill="#a9743c" stroke="#3a2410" stroke-width="3"/>' +
      /* narrow plank body */
      '<rect x="168" y="214" width="64" height="98" rx="20" fill="#bd7b38" stroke="#3a2410" stroke-width="4"/>' +
      /* wooden log head + shaded side */
      '<rect x="150" y="46" width="100" height="182" rx="48" fill="#c8823c" stroke="#3a2410" stroke-width="4"/>' +
      '<rect x="206" y="62" width="40" height="150" rx="20" fill="#a9743c" opacity="0.45"/>' +
      /* brow ridge */
      '<path d="M156 102 q49 -24 98 0" stroke="#3a2410" stroke-width="5" fill="none"/>' +
      /* big cartoon eyes */
      '<circle cx="182" cy="122" r="24" fill="#f5efe0" stroke="#3a2410" stroke-width="3"/>' +
      '<circle cx="228" cy="122" r="24" fill="#f5efe0" stroke="#3a2410" stroke-width="3"/>' +
      '<circle cx="185" cy="124" r="11" fill="#1a0f05"/>' +
      '<circle cx="225" cy="124" r="11" fill="#1a0f05"/>' +
      '<circle cx="181" cy="119" r="3.5" fill="#ffffff" opacity="0.85"/>' +
      '<circle cx="221" cy="119" r="3.5" fill="#ffffff" opacity="0.85"/>' +
      /* long hanging nose */
      '<path d="M203 126 q-10 42 -4 66 q9 6 15 -2 q5 -32 0 -62 z" fill="#b06f30" stroke="#3a2410" stroke-width="2.5"/>' +
      /* smile */
      '<path d="M172 200 q30 26 60 0" stroke="#3a2410" stroke-width="5" fill="none"/>' +
      /* arms reaching to the grip */
      '<path d="M172 232 q4 12 14 18" stroke="#b06f30" stroke-width="14" fill="none" stroke-linecap="round"/>' +
      '<path d="M226 234 q-16 22 -30 34" stroke="#b06f30" stroke-width="14" fill="none" stroke-linecap="round"/>' +
      /* tapered bat resting on the ground */
      '<circle cx="120" cy="360" r="16" fill="#9c6528" stroke="#3a2410" stroke-width="3"/>' +
      '<path d="M182.9 246.9 L193.1 253.1 L132 366 L108 351 Z" fill="#9c6528" stroke="#3a2410" stroke-width="3"/>' +
      /* hands gripping the handle */
      '<circle cx="186" cy="250" r="12" fill="#c8823c" stroke="#3a2410" stroke-width="3"/>' +
      '<circle cx="197" cy="268" r="12" fill="#bd7b38" stroke="#3a2410" stroke-width="3"/>',
      '#1d1206')
  };

  /* ---------- fill every image slot ---------- */
  function fillWithImage(slot, url, fallbackSvg, creditText) {
    var img = document.createElement("img");
    img.alt = creditText === "field photo" ? "field photo" : "stock image";
    img.loading = "lazy";
    img.onerror = function () {
      /* offline, dead link, or hotlink-blocked: fall back to the drawn homage */
      slot.innerHTML = fallbackSvg + '<span class="credit">stock photo</span>';
    };
    img.src = url;
    slot.innerHTML = "";
    slot.appendChild(img);
    var credit = document.createElement("span");
    credit.className = "credit";
    credit.textContent = creditText || "stock photo";
    slot.appendChild(credit);
  }

  /* ---- the eggs stay dormant until someone types "tung" in the impact
     calculator and the page reloads ---- */
  var TUNG_KEY = "tung-egg-unlocked";
  var TUNG_UNLOCKED = false;
  try { TUNG_UNLOCKED = localStorage.getItem(TUNG_KEY) === "1"; } catch (e) {}
  function lettersOnly(s) { return String(s || "").replace(/[^a-z]/gi, "").toLowerCase(); }
  function unlockTung() {
    var was = false;
    try { was = localStorage.getItem(TUNG_KEY) === "1"; } catch (e) {}
    try { localStorage.setItem(TUNG_KEY, "1"); } catch (x) {}
    TUNG_UNLOCKED = true;
    if (!was) location.reload();
  }
  (function () {
    var buf = "";
    document.addEventListener("keydown", function (e) {
      if (!e.key || e.key.length !== 1) return;
      buf = (buf + e.key.toLowerCase()).slice(-5);
      if (buf === "popup") {
        buf = "";
        var url = prompt("page to iframe inside an about:blank popup:");
        if (url) openUrlPopup(url.trim());
      }
    });
    var amt = document.getElementById("investAmt");
    var out = document.getElementById("investStudents");
    function paintInvest() {
      if (!amt || !out) return;
      var raw = amt.value;
      if (lettersOnly(raw) === "tung") { unlockTung(); return; }
      var n = parseFloat(String(raw).replace(/[^0-9.]/g, ""));
      if (!isFinite(n) || n < 0) { out.textContent = "—"; return; }
      out.textContent = Math.round(n / 8).toLocaleString("en-US");
    }
    if (amt) {
      amt.addEventListener("input", paintInvest);
      paintInvest();
    }
  })();

  /* type "popup", give it a url, and it opens in a full-window iframe inside an
     about:blank popup (plus the nested-iframe dom trick, hidden). */
  function openUrlPopup(url) {
    var w = window.open("about:blank", "_blank");
    if (!w) return; /* popup blocked */
    w.document.open();
    w.document.write(
      '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
      '<title>Loading</title>' +
      '<style>html,body{margin:0;padding:0;height:100%;overflow:hidden}' +
      'iframe{width:100%;height:100%;border:none;display:block}' +
      'iframe:not([src]){display:none}</style>' +
      '</head><body>' +
      '<iframe id="__c" allow="autoplay; fullscreen"></iframe>' +
      '<script>' +
      'const iframe = document.createElement("iframe");' +
      'document.body.appendChild(iframe);' +
      'iframe.contentDocument.write("<iframe>");' +
      '<\/script>' +
      '</body></html>'
    );
    w.document.close();
    /* set the target via the DOM so the url is never parsed as HTML */
    try { w.document.getElementById("__c").setAttribute("src", url); } catch (x) {}
  }

  /* ---------- how it all wires together ----------
     This loop walks every .img-slot on the page and decides what goes in it.
     Nothing "secret" appears until the visitor has typed "tung" in the impact
     calculator once (that sets the TUNG_UNLOCKED flag in localStorage). Once
     unlocked, per slot:
       1. the first team portrait becomes T.T.T. Sahur -> clicking it opens the
          Shrine of Tung chat/catalog window (Shrine.open).
       2. other slots have a SWAP_CHANCE of showing an album "cover" instead of
          the plain illustration -> clicking a cover calls bumpCount(); the 3rd
          click triggers the about:blank easter-egg popup (openEasterEgg).
       3. field cases / team / journal themes use real photos when present.
       4. everything else just gets its themed STOCK illustration.
     Separately, typing "popup" anywhere prompts for a URL and iframes it in an
     about:blank window (openUrlPopup). */
  var sahurPlaced = false; /* he only turns up once — twice in a row looks weird */
  var slots = document.querySelectorAll(".img-slot");
  Array.prototype.forEach.call(slots, function (slot) {
    var theme = slot.getAttribute("data-theme") || "";

    /* team portraits: occasionally the roster gains a very dedicated colleague.
       when he does appear: 70% the drawn version, 30% the actual photo */
    if (TUNG_UNLOCKED && theme.indexOf("portrait") === 0 && !sahurPlaced && Math.random() < SAHUR_CHANCE) {
      sahurPlaced = true;
      if (Math.random() < 0.30) {
        fillWithImage(slot, SAHUR.url, SAHUR.svg);
      } else {
        slot.innerHTML = SAHUR.svg + '<span class="credit">stock photo</span>';
      }
      slot.setAttribute("aria-label", "staff portrait");
      slot.style.cursor = "pointer";
      slot.addEventListener("click", function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        Shrine.open();
      });
      var person = slot.closest(".person");
      var nameEl = person && person.querySelector("h3");
      if (nameEl) nameEl.textContent = SAHUR.name;
      return;
    }

    if (TUNG_UNLOCKED && Math.random() < SWAP_CHANCE) {
      var cover = COVERS[Math.floor(Math.random() * COVERS.length)];
      if (cover.url) {
        fillWithImage(slot, cover.url, cover.svg);
      } else {
        slot.innerHTML = cover.svg + '<span class="credit">stock photo</span>';
      }
      slot.setAttribute("aria-label", "stock image");
      slot.addEventListener("click", function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        bumpCount();
      });
    } else if (FIELD_PHOTOS[theme]) {
      var photoUrl = new URL(FIELD_PHOTOS[theme], location.href).href;
      var fallback = (STOCK[theme] || STOCK.books)();
      fillWithImage(slot, photoUrl, fallback, "field photo");
      slot.setAttribute("aria-label", theme + " photo");
    } else {
      var draw = STOCK[theme] || STOCK.books;
      slot.innerHTML = draw();
      slot.setAttribute("aria-label", theme + " illustration");
    }
  });
})();
