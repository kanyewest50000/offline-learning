const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const html = await Deno.readTextFile(`${ROOT}/games/tung/snake.html`);
const asset = `${ROOT}/assets/eviltungtungtungsahur.jpg`;

if (!html.includes('evil.src="../../assets/eviltungtungtungsahur.jpg"')) {
  throw new Error("snake.html does not load the evil tung sprite");
}
if (!html.includes("if(foe && head.x===foe.x && head.y===foe.y)")) {
  throw new Error("walking into evil tung does not kill the player");
}
if (!html.includes("if(onSnake(x,y)) return false")) {
  throw new Error("spawn helpers do not refuse snake-occupied cells");
}
if (!html.includes('localStorage.getItem("sahur-snake-best")')) {
  throw new Error("high score localStorage key missing");
}
if (!html.includes('ctx.fillText("best "+best')) {
  throw new Error("best score is not drawn in the HUD");
}
if (!html.includes("drawWarn") || !html.includes("WARN_MS")) {
  throw new Error("warning box before spawn is missing");
}

try {
  const st = await Deno.stat(asset);
  if (st.size < 1000) throw new Error("evil tung image is too small");
} catch (e) {
  throw e instanceof Error ? e : new Error("missing assets/eviltungtungtungsahur.jpg");
}

type Pt = { x: number; y: number };
const N = 18;
let snake: Pt[] = [{ x: 8, y: 9 }, { x: 7, y: 9 }, { x: 6, y: 9 }];
let food: Pt | null = { x: 2, y: 2 };
let cursed: Pt | null = null;
let warn: Pt | null = null;
let foe: Pt | null = null;

function onSnake(x: number, y: number) {
  return snake.some((p) => p.x === x && p.y === y);
}
function reserved(x: number, y: number) {
  if (onSnake(x, y)) return true;
  if (food && food.x === x && food.y === y) return true;
  if (cursed && cursed.x === x && cursed.y === y) return true;
  if (warn && warn.x === x && warn.y === y) return true;
  if (foe && foe.x === x && foe.y === y) return true;
  return false;
}
function pickClearCell() {
  for (let i = 0; i < 400; i++) {
    const x = (Math.random() * N) | 0;
    const y = (Math.random() * N) | 0;
    if (!reserved(x, y)) return { x, y };
  }
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      if (!reserved(x, y)) return { x, y };
    }
  }
  return null;
}

if (onSnake(8, 9) !== true || onSnake(6, 9) !== true) throw new Error("tail occupancy broken");
if (pickClearCell() == null) throw new Error("empty board produced no spawn cell");
for (let i = 0; i < 120; i++) {
  const cell = pickClearCell();
  if (!cell || reserved(cell.x, cell.y) || onSnake(cell.x, cell.y)) {
    throw new Error("hazard picked a reserved cell");
  }
}

const full = Array.from({ length: N * N }, (_, i) => ({ x: i % N, y: (i / N) | 0 }));
snake = full;
food = cursed = warn = foe = null;
if (pickClearCell() !== null) throw new Error("full snake still found a spawn cell");

snake = [{ x: 8, y: 9 }, { x: 7, y: 9 }, { x: 6, y: 9 }];
let died = "";
function step(dir: Pt, foeCell: Pt | null) {
  const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
  if (foeCell && head.x === foeCell.x && head.y === foeCell.y) {
    died = "evil";
    return;
  }
  snake.unshift(head);
  snake.pop();
}
step({ x: 1, y: 0 }, { x: 9, y: 9 });
if (died !== "evil") throw new Error("head-on foe did not kill");
if (snake[0].x !== 8) throw new Error("death still moved the snake");

{
  const startX = 2;
  const target = { x: 14, y: 9 };
  const stepMs = 120;
  const warnAt = 200;
  const spawnAt = warnAt + 900;
  const headAt = (t: number) => startX + Math.floor(t / stepMs);
  const hitAt = (target.x - startX) * stepMs;
  if (headAt(spawnAt) >= target.x) {
    throw new Error("demo spawn is too late; snake would already occupy the cell");
  }
  if (hitAt <= spawnAt) {
    throw new Error("demo path never reaches the foe after spawn");
  }
  if (hitAt - spawnAt < stepMs) {
    throw new Error("demo foe is not visible for a full step");
  }
}

console.log("snake evil tung: ok");
