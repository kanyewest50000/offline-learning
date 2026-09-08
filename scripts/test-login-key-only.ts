const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");

function must(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const server = await Deno.readTextFile(`${ROOT}/server.ts`);
const index = await Deno.readTextFile(`${ROOT}/index.html`);
const embed = await Deno.readTextFile(`${ROOT}/embed/chat.html`);

must(server.includes("POST /login         {token}"), "server docs must describe key-only login");
must(!server.includes("app.value.username).toLowerCase() !== username.toLowerCase()"), "login must not compare usernames");
must(server.includes('if (!token) return json({ error: "unauthorized" }, 401);'), "login still requires a key");

must(index.includes("already a member? log in with your key."), "shrine login hint must be key-only");
must(!index.includes("log in with your username and key."), "shrine login must not ask for a username");
must(!index.includes('placeholder="username"'), "shrine login box must not have a username field");
must(index.includes('placeholder="desired username"'), "apply form still asks for a username");
must(index.includes('apiPost("/login",{token:k})'), "shrine login posts the key only");
must(!index.includes("enter your username and key."), "shrine login error must not mention username");

must(!embed.includes('id="lu"'), "embed login must not have a username field");
must(embed.includes('placeholder="login key"'), "embed login still has a key field");
must(embed.includes('apiPost("/login", { token:k })'), "embed login posts the key only");
must(embed.includes("the key you copied from the shrine."), "embed login copy is key-only");

console.log("login key-only copy and handlers passed");
