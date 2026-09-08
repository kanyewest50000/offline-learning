/* Uniformly scale the game canvas to fit .stage. Never stretch.
   The backing store tracks the on-screen CSS box * devicePixelRatio so the
   bitmap is never smaller than the pixels the browser is painting. Sizing it
   from the logical 420x640 (etc.) and capping DPR left the picture chunky
   whenever the stage was larger than that bitmap. */
(function () {
  var bound = null;

  function applyBacking(canvas, ctx, W, H) {
    var dpr = Math.max(1, window.devicePixelRatio || 1);
    var cssW = canvas.clientWidth || 0;
    var cssH = canvas.clientHeight || 0;
    if (cssW < 2) cssW = parseFloat(canvas.style.width) || W;
    if (cssH < 2) cssH = parseFloat(canvas.style.height) || H;
    var bw = Math.max(1, Math.round(cssW * dpr));
    var bh = Math.max(1, Math.round(cssH * dpr));
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw;
      canvas.height = bh;
    }
    ctx.setTransform(bw / W, 0, 0, bh / H, 0, 0);
    ctx.imageSmoothingEnabled = true;
    if (ctx.imageSmoothingQuality) ctx.imageSmoothingQuality = "high";
  }

  window.__tungHiDPI = function (canvas, ctx, W, H) {
    canvas.setAttribute("data-logical-w", String(W));
    canvas.setAttribute("data-logical-h", String(H));
    bound = { canvas: canvas, ctx: ctx, W: W, H: H };
    applyBacking(canvas, ctx, W, H);
  };

  function fit() {
    var stage = document.querySelector(".stage");
    var frame = document.querySelector(".frame");
    if (!stage || !frame) return;
    var canvas = frame.querySelector("canvas") || document.getElementById("c");
    if (!canvas) return;
    var W = parseInt(canvas.getAttribute("data-logical-w") || "", 10) || canvas.width;
    var H = parseInt(canvas.getAttribute("data-logical-h") || "", 10) || canvas.height;
    var sw = stage.clientWidth, sh = stage.clientHeight;
    if (sw < 2 || sh < 2 || W < 1 || H < 1) return;
    var scale = Math.min(sw / W, sh / H);
    var dw = Math.max(1, Math.floor(W * scale));
    var dh = Math.max(1, Math.floor(H * scale));
    frame.style.width = dw + "px";
    frame.style.height = dh + "px";
    canvas.style.width = dw + "px";
    canvas.style.height = dh + "px";
    if (bound && bound.canvas === canvas) {
      applyBacking(bound.canvas, bound.ctx, bound.W, bound.H);
    }
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
