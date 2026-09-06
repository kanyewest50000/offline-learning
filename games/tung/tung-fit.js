/* Uniformly scale the game canvas to fit .stage. Never stretch. */
(function () {
  function fit() {
    var stage = document.querySelector(".stage");
    var frame = document.querySelector(".frame");
    if (!stage || !frame) return;
    var canvas = frame.querySelector("canvas") || document.getElementById("c");
    if (!canvas) return;
    var W = canvas.width, H = canvas.height;
    var sw = stage.clientWidth, sh = stage.clientHeight;
    if (sw < 2 || sh < 2 || W < 1 || H < 1) return;
    var scale = Math.min(sw / W, sh / H);
    var dw = Math.max(1, Math.floor(W * scale));
    var dh = Math.max(1, Math.floor(H * scale));
    frame.style.width = dw + "px";
    frame.style.height = dh + "px";
    canvas.style.width = dw + "px";
    canvas.style.height = dh + "px";
  }
  window.__tungFit = fit;
  window.addEventListener("resize", fit);
  window.addEventListener("orientationchange", fit);
  if (typeof ResizeObserver !== "undefined") {
    var stage = document.querySelector(".stage");
    if (stage) new ResizeObserver(fit).observe(stage);
  }
  function boot() { fit(); requestAnimationFrame(fit); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
