/* ==========================================================================
   Untether — light/dark toggle
   Pairs with the pre-paint snippet in each page's <head>, which reads the same
   'untether-theme' key before first paint so light mode never flashes.
   ========================================================================== */
(function () {
  "use strict";
  var root = document.documentElement;
  var btn = document.getElementById('themeToggle');
  function isLight() { return root.classList.contains('theme-light'); }
  function syncToggle() {
    if (!btn) return;
    var light = isLight();
    btn.setAttribute('aria-label', light ? 'Switch to dark mode' : 'Switch to light mode');
    btn.setAttribute('aria-pressed', light ? 'true' : 'false');
    btn.title = light ? 'Switch to dark mode' : 'Switch to light mode';
  }
  function setTheme(light) {
    root.classList.toggle('theme-light', !!light);
    try { localStorage.setItem('untether-theme', light ? 'light' : 'dark'); } catch (e) {}
    syncToggle();
  }
  syncToggle();
  if (btn) {
    btn.addEventListener('click', function () { setTheme(!isLight()); });
  }
})();
