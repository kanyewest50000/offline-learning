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
must(flappy.includes("var GRAV=0.16, FLAP=-4.0, GAP=168, PW=54, SPEED=1.28, SPAWN=200;"), "flappy gravity must be lighter and pipes further apart");
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
must(pong.includes("var follow=0.05+heat*0.09;"), "pong AI must chase the ball gently");
must(pong.includes("var maxStep=2.0+heat*1.9;"), "pong AI reach must stay capped as the score climbs");
must(pong.includes("var wobble=30+(1-heat)*60;"), "pong AI sway must narrow but never reach zero");
must(!pong.includes("var wobble=(1-heat)*9;"), "the old sway curve made him perfect from 3 points on");
must(
  /if\(youScore>=WIN-1\)\{\s*him\.y=clamp\(target, minY, maxY\);\s*return;\s*\}/.test(pong),
  "the rigged point must still track the ball exactly, with no cap and no sway",
);

/* the night watch: he rises on the court floor, stands down, then the
   broadcast takes the whole shell and the window signs off. */
must(pong.includes("var V_FADE=9000, V_PEAK=0.5, V_GAP=3000, V_AIR=10000, V_DRY=25000;"), "watch timings must be fade 9s, half opacity, 3s stand-down, 10s on air, 25s dry spell");
must(pong.includes("youScore>=WIN-1 || (youScore>=4 && vigil.dry>=V_DRY)"), "the watch must arm on the rigged score or a dry spell from 4 points up");
must(pong.includes('if(state==="play"||state==="idle") vigil.dry+=dt;'), "the dry spell must count play and the pause between points, not won or lost boards");
must(/vigil\.a=V_PEAK\*Math\.min\(1, vigil\.t\/V_FADE\);/.test(pong), "the rise must ramp to half opacity over the fade");
must(
  pong.indexOf("drawRonda();") < pong.indexOf('ctx.strokeStyle="#7a5a1a"; ctx.setLineDash([7,8]);'),
  "the plate must paint before the net, the pads, the ball and the score",
);
must(pong.includes('ctx.globalAlpha=vigil.a;'), "the plate must honour the rise alpha");
must(pong.includes("z-index:2147483647"), "the shell cover must sit above everything on the page");
must(pong.includes("background-size:cover"), "the shell cover must fill the page without letterboxing");
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
  must(size > 20000, `assets/${file} is too small to be ${what}`);
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
