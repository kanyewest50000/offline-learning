const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const html = await Deno.readTextFile(`${ROOT}/games/tung/snake.html`);
const asset = `${ROOT}/assets/eviltungtungtungsahur.jpg`;

if (!html.includes('evil.src="../../assets/eviltungtungtungsahur.jpg"')) {
  throw new Error("snake.html does not load the evil tung sprite");
}
if (!html.includes("placeFoe") || !html.includes("onSnake")) {
  throw new Error("snake.html is missing spawn occupancy guards");
}
if (!html.includes("sahur-snake-best")) {
  throw new Error("high score localStorage key missing");
}
if (!html.includes("best "+"${") && !html.includes('ctx.fillText("best "+best')) {
  throw new Error("best score is not drawn in the HUD");
}

try {
  await Deno.stat(asset);
} catch {
  throw new Error("missing assets/eviltungtungtungsahur.jpg");
}

const chrome = Deno.env.get("CHROME") || "google-chrome";
const port = 8764;
const server = Deno.serve({ hostname: "127.0.0.1", port, onListen: () => {} }, async (req) => {
  const url = new URL(req.url);
  let path = decodeURIComponent(url.pathname);
  if (path === "/") path = "/scripts/test-snake-evil.html";
  const file = `${ROOT}${path}`;
  try {
    const data = await Deno.readFile(file);
    const ext = file.split(".").pop() || "";
    const types: Record<string, string> = {
      html: "text/html; charset=utf-8",
      js: "text/javascript; charset=utf-8",
      css: "text/css; charset=utf-8",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
    };
    return new Response(data, { headers: { "content-type": types[ext] || "application/octet-stream" } });
  } catch {
    return new Response("nope", { status: 404 });
  }
});

const cmd = new Deno.Command(chrome, {
  args: [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--virtual-time-budget=20000",
    "--dump-dom",
    `http://127.0.0.1:${port}/scripts/test-snake-evil.html`,
  ],
  stdout: "piped",
  stderr: "piped",
});
const out = await cmd.output();
server.shutdown();
const dom = new TextDecoder().decode(out.stdout);
if (!/id="out"[^>]*>PASS</.test(dom) && !/>PASS</.test(dom)) {
  const fail = dom.match(/FAIL[^<]*/);
  throw new Error("browser harness failed: " + (fail ? fail[0] : "no PASS in dump-dom"));
}
console.log("snake evil tung: ok");
