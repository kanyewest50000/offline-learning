const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");

function must(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const index = await Deno.readTextFile(`${ROOT}/index.html`);
const snake = await Deno.readTextFile(`${ROOT}/games/tung/snake.html`);
const pong = await Deno.readTextFile(`${ROOT}/games/tung/pong.html`);
const flappy = await Deno.readTextFile(`${ROOT}/games/tung/flappy.html`);
const fit = await Deno.readTextFile(`${ROOT}/games/tung/tung-fit.js`);
const tungCss = await Deno.readTextFile(`${ROOT}/games/tung/tung.css`);

must(index.includes('var LBL_PLAYS = "gam\\u0435s";'), "games cloak must replace only the e");
must(index.includes('var LBL_PLAYS_CAP = "Gam\\u0435s";'), "Games cloak must replace only the e");
must(index.includes('var LBL_VEIL = "pr\\u043Exy";'), "proxy cloak must replace only the o");
must(index.includes('var LBL_VEIL_CAP = "Pr\\u043Exy";'), "Proxy cloak must replace only the o");
must(!index.includes("\\u0440"), "Cyrillic r must not appear in shrine labels");
must(!index.includes("\\u0261"), "Latin gamma lookalike must not appear in shrine labels");
must(!index.includes("\\u0455"), "Cyrillic s lookalike must not appear in shrine labels");

const play = JSON.parse('"' + "gam\\u0435s" + '"');
const veil = JSON.parse('"' + "pr\\u043Exy" + '"');
must(play === "gamеs" && play !== "games", "cloaked games must not equal ASCII games");
must(veil === "prоxy" && veil !== "proxy", "cloaked proxy must not equal ASCII proxy");
must([...play].filter((ch) => ch.charCodeAt(0) === 0x0435).length === 1, "games cloak uses one Cyrillic e");
must([...veil].filter((ch) => ch.charCodeAt(0) === 0x043e).length === 1, "proxy cloak uses one Cyrillic o");

must(snake.includes("var N=18, CELL=24, W=N*CELL, H=N*CELL;"), "snake board must fill N*CELL");
must(snake.includes('width="432" height="432"'), "snake canvas must be 432x432");
must(snake.includes("style=\"--gw:432;--gh:432\""), "snake stage must match the board");
must(snake.includes("eat. lengthen. forget why."), "snake tagline must be the forget-why line");
must(!snake.includes("the red square is already taken."), "old snake tagline must be gone");
must(index.includes("eat. lengthen. forget why."), "originals list must use the new snake tagline");
must(snake.includes("var STEP=180;"), "snake step must be slower than 120ms");
must(snake.includes("window.__tungHiDPI"), "snake must use the HiDPI backing store");

must(pong.includes("var PW=28, PH=100, BR=12, WIN=7;"), "pong paddles must be larger rectangles");
must(pong.includes("vx:(toHim?2.1:-2.1)"), "pong serve must be slower than 3.2");
must(pong.includes("ball.vx=dir*(Math.abs(ball.vx)+0.48)"), "pong ball must accelerate faster with no top-speed cap");
must(!pong.includes("Math.min(5.6"), "pong ball speed must be uncapped");
must(snake.includes("foes.push"), "evil tungs must stack on the board");
must(snake.includes("gods.push"), "god tungs must stack on the board");
must(!snake.includes("STAY_MIN"), "evil tungs must not time out");
must(pong.includes("window.__tungHiDPI"), "pong must use the HiDPI backing store");

must(flappy.includes('birdImg.src="../../assets/flappy-tung-bird.png"'), "flappy must use the sahur-filled OG bird");
must(flappy.includes("var GRAV=0.28, FLAP=-5.1, GAP=128, PW=56, SPEED=2.0, SPAWN=140;"), "flappy must be the hard shrine cut: heavier fall, tighter pipes, faster scroll");
must(!flappy.includes("GAP=168"), "the wide easy gap must be gone");
must(!flappy.includes("SPEED=1.28"), "the slow easy scroll must be gone");
must(flappy.includes("window.__tungHiDPI"), "flappy must use the HiDPI backing store");
must(
  /state==="dead"\)\{\s*drawBird\(\);\s*overlay\("fallen"/.test(flappy),
  "fallen overlay must paint after the bird so collision text stays readable",
);
must(
  !/else if\(state==="dead"\) overlay\("fallen"/.test(flappy),
  "fallen overlay must not be painted before the bird",
);
must(flappy.includes('ctx.fillStyle="#1d1206"'), "fallen card must be opaque so the bird cannot show through the text");

/* pong difficulty: the climb has to stay winnable up to the sixth point.
   his reach is capped and his sway never reaches zero, so he can always be
   made to miss — except on the rigged point, where he tracks the ball exactly. */
must(pong.includes("var follow=0.05+heat*0.10;"), "pong AI must close on the ball steadily");
must(pong.includes("var maxStep=1.0+heat*1.8;"), "his bat must stay slow enough that an angled shot beats him at a speed a person can still aim at");
must(!pong.includes("heat*4.5"), "a bat that quick reaches an angled shot before the ball is even hard to read");
must(pong.includes("var wobble=30+(1-heat)*14;"), "the sway must stay with him at every score below the rigged point");
must(!pong.includes("PLACE"), "he must not aim his return away from the player; the angle is the player's to set");

/* the ball is steered by where on the bat it lands, and that angle has to hold
   up as it speeds up or a fast ball flies flatter than a slow one */
must(pong.includes("var ANG=6.5, ANGV=0.30;"), "the return angle must come from the contact point and scale with speed");
must(pong.includes("ball.vy=rel*(ANG+Math.abs(ball.vx)*ANGV);"), "the vertical kick must scale with the ball's speed");
must(!pong.includes("ball.vy=rel*4.0;"), "a fixed vertical kick flattens the ball out as it accelerates");
must(pong.includes("var rel=clamp(((ball.y)-(p.y+PH/2))/(PH/2), -1, 1);"), "contact off the end of the bat must not exceed a full-edge hit");

/* the ball must never cross a paddle without being tested against it */
must(pong.includes("var SUBSTEP=8;"), "no single move may be wider than a fraction of a paddle");
must(pong.includes("function travel(){"), "a frame of travel must be cut into steps");
must(
  pong.includes("var n=Math.max(1, Math.ceil(Math.max(Math.abs(ball.vx), Math.abs(ball.vy))/SUBSTEP));"),
  "the number of steps must follow the ball's speed, vertical travel included",
);
must(pong.includes("ball.x+=ball.vx/n; ball.y+=ball.vy/n;"), "each step must move only its share of the frame");
must(!/ball\.x\+=ball\.vx; ball\.y\+=ball\.vy;/.test(pong), "the ball must not be moved a whole frame in one jump");
must(
  pong.indexOf("aiMove();") < pong.indexOf("travel();"),
  "he must commit his bat for the frame before the ball is moved through it",
);

/* the rigged point: his whole face is the wall at any speed, so a fast ball
   cannot slip through the gap between frames, and he returns it flat */
must(
  /if\(youScore>=WIN-1\)\{\s*him\.y=clamp\(target, minY, maxY\);\s*return;\s*\}/.test(pong),
  "the rigged point must track the ball exactly, with no cap and no sway",
);
must(
  /if\(ball\.x\+BR>him\.x\)\{ ball\.x=him\.x-BR; bounce\(him, -1\); \}/.test(pong),
  "the rigged point must return the ball at any speed, with no gap to tunnel through",
);
must(
  pong.indexOf("if(ball.x+BR>him.x){ ball.x=him.x-BR;") < pong.indexOf("} else if(hitsPad(him)){"),
  "the wall must take precedence over the ordinary paddle test",
);
must(!/if\(ball\.vx>0 && hitsPad\(him\)\) bounce\(him, -1\);/.test(pong), "the old unguarded return would let a fast ball through the rigged point");

/* the night watch: he rises on the court floor, stands down, then the
   broadcast takes the whole shell and the window signs off. */
must(pong.includes("var V_FADE=9000, V_PEAK=0.5, V_GAP=1000, V_AIR=10000, V_DRY=30000, V_LOCK=15000;"), "watch timings must be fade 9s, half opacity, 1s stand-down, 10s on air, 30s dry spell, 15s on the rigged point");
must(
  pong.includes("var need=youScore>=WIN-1 ? V_LOCK : (youScore>=5 ? V_DRY : Infinity);") &&
    pong.includes("if(vigil.dry>=need){ vigil.phase=\"rise\"; vigil.t=0; hangPlate(); }"),
  "the watch must arm only on a stalemate: 30s from five up, 15s on the rigged point, never below five",
);
must(!pong.includes("youScore>=WIN-1 || ("), "reaching the rigged score must no longer arm the watch on its own");
must(pong.includes('if(state==="play"||state==="idle") vigil.dry+=dt;'), "the dry spell must count play and the pause between points, not won or lost boards");
must(/vigil\.a=V_PEAK\*Math\.min\(1, vigil\.t\/V_FADE\);/.test(pong), "the rise must ramp to half opacity over the fade");
must(
  pong.indexOf("drawRonda();") < pong.indexOf('ctx.strokeStyle="#7a5a1a"; ctx.setLineDash([7,8]);'),
  "the plate must paint before the net, the pads, the ball and the score",
);
must(pong.includes('ctx.globalAlpha=vigil.a;'), "the plate must honour the rise alpha");
must(pong.includes("z-index:2147483647"), "the shell cover must sit above everything on the page");
must(pong.includes("background-size:cover"), "the shell cover must fill the page without letterboxing");

/* a picture handed over at the moment it is wanted still has to be decoded
   before it can paint, which showed as a beat of black */
must(pong.includes("function hangPlate(){"), "the cover must be built ahead of the moment it is shown");
must(pong.includes("hangPlate();") && pong.indexOf("hangPlate();") < pong.indexOf("function hangPlate(){"), "the cover must be hung as soon as the watch arms");
must(/opacity:0;pointer-events:none;/.test(pong), "the cover must hang fully transparent and let clicks through until its moment");
must(pong.includes('warm.decode()'), "the cover picture must be decoded up front, not at the moment of reveal");
must(
  pong.includes('el.style.opacity="1"; el.style.pointerEvents="auto";'),
  "revealing the cover must be a change of opacity on the element already hung",
);
/* the picture rides on the element's own background, the way it always has.
   an <img> child rendered as a black screen in the shell it actually runs in. */
must(pong.includes('background:#000 url('), "the cover must carry its picture as its own background");
must(!pong.includes('createElement("img")'), "the cover must not depend on an img element inside the shell");
must(pong.includes("function shell()"), "the cover must be mounted on the outermost reachable document");
must(pong.includes("requestFullscreen"), "the shell must go fullscreen when the broadcast opens");
must(pong.includes("feed.volume=1") && pong.includes("feed.muted=false"), "the broadcast must open at full volume");
must(pong.includes("setTimeout(signOff, V_AIR)"), "the window must sign off after the broadcast");
must(pong.includes('new URL("../../assets/tungrondaclose.png", location.href).href'), "the close plate must resolve absolutely for the about:blank shell");
must(pong.includes('new URL("../../assets/sahur-broadcast.mp3", location.href).href'), "the broadcast must resolve absolutely for the about:blank shell");
must(pong.includes('ronda.src="../../assets/tungronda.png"'), "the court plate must load from assets");

/* the line under the court is the only nudge the room gets about the volume,
   and it is plain text: nothing is ever played to bait it up */
must(pong.includes('<p class="ledger">'), "pong must carry the line under the court");
must(pong.includes("tung rewards those who listen"), "the line must still offer the reward for listening");
must(pong.includes("free sahur codes go out over the air, never on screen."), "the line must send people to the speakers, not the screen");
must(tungCss.includes(".ledger {"), "the line under the court needs a style");
must(!tungCss.includes(".ledger.live"), "the line no longer changes, so it needs no live style");
must(!pong.includes("createBufferSource"), "nothing may be played to bait the volume up");
must(!pong.includes("AudioContext"), "the game must open no audio context of its own");
must(!/setTimeout\((pulse|onAir|whisper)/.test(pong), "no periodic sound may be scheduled");
must(
  pong.split("new Audio(").length > 1 &&
    pong.split("new Audio(").slice(1).every((rest) => rest.startsWith("BROADCAST)")),
  "the broadcast must be the only sound the game loads",
);

const plates = [
  ["tungronda.png", "the pos ronda plate that rises on the court"],
  ["tungrondaclose.png", "the close plate that takes the shell"],
];
for (const [file, what] of plates) {
  let size = 0;
  try {
    size = (await Deno.stat(`${ROOT}/assets/${file}`)).size;
  } catch {
    throw new Error(`assets/${file} is missing — ${what}`);
  }
  /* a stand-in dropped at this path while testing must not satisfy the check:
     these are full-bleed photographs and run to megabytes */
  must(size > 400000, `assets/${file} is only ${size} bytes — too small to be ${what}`);
}
const broadcast = await Deno.stat(`${ROOT}/assets/sahur-broadcast.mp3`);
must(broadcast.size > 100000, "the broadcast audio is missing or truncated");

must(fit.includes("data-logical-w"), "HiDPI fit must scale from logical size");
must(fit.includes("clientWidth"), "HiDPI backing store must track the CSS box");
must(fit.includes("devicePixelRatio"), "HiDPI backing store must use the display DPR");
must(!fit.includes("Math.min(2.5"), "HiDPI must not cap the backing store at 2.5x logical size");

const bird = await Deno.readFile(`${ROOT}/assets/flappy-tung-bird.png`);
must(bird.byteLength > 8000, "composed bird sprite is missing or tiny");
const srcBird = await Deno.stat(`${ROOT}/assets/flappybird.png`);
must(srcBird.size > 8000, "original flappy bird source sprite is missing");

const png = new Uint8Array(bird);
must(png[0] === 0x89 && png[1] === 0x50 && png[2] === 0x4e && png[3] === 0x47, "bird asset is not a PNG");
const ihdr = new TextDecoder().decode(png.slice(12, 16));
must(ihdr === "IHDR", "Bird PNG header is corrupt");
const colorType = png[25];
must(colorType === 6, "composed bird must be RGBA so the black field can be transparent");
const width = (png[16] << 24) | (png[17] << 16) | (png[18] << 8) | png[19];
const height = (png[20] << 24) | (png[21] << 16) | (png[22] << 8) | png[23];
must(width >= 300 && height >= 200, "composed bird crop is unexpectedly small");

console.log("tung games + cloak checks passed");
