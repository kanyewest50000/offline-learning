// Anonymous IP cap is 90/min. Authenticated (token) traffic is exempt.
const BASE = Deno.env.get("EGRESS_BASE") || "http://127.0.0.1:8026";

async function hit(path: string, init?: RequestInit) {
  const r = await fetch(BASE + path, init);
  const buf = new Uint8Array(await r.arrayBuffer());
  return { status: r.status, bytes: buf.byteLength, text: new TextDecoder().decode(buf) };
}

const g = await hit("/g/469.html");
if (g.status !== 410) throw new Error("/g/ wanted 410 got " + g.status);
if (g.bytes > 200) throw new Error("/g/ body too big: " + g.bytes);

const admin = await hit("/admin");
if (admin.bytes > 800) throw new Error("/admin without key too big: " + admin.bytes);

const first = await hit("/apply", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ username: "authed" + Date.now(), application: "token holder" }),
});
const tok = JSON.parse(first.text).token as string;
if (!tok) throw new Error("apply did not return a token: " + first.text);

for (let i = 0; i < 11; i++) {
  const a = await hit("/apply", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "nat" + i + Date.now(), application: "shared ip" }),
  });
  if (a.status === 429) throw new Error("/apply 429 on try " + i);
}

let limited = false;
for (let i = 0; i < 90; i++) {
  const h = await hit("/nope");
  if (h.status === 429) { limited = true; break; }
}
const after = await hit("/nope");
if (!limited && after.status !== 429) throw new Error("anonymous 90/min never tripped");

const st = await hit("/status?token=" + encodeURIComponent(tok));
if (st.status === 429) throw new Error("authed /status hit the IP cap");
if (st.status !== 200) throw new Error("authed /status wanted 200 got " + st.status);

console.log("PASS /g/", g.bytes, "B; /admin", admin.bytes, "B; 12 applies ok; anon 429; authed /status", st.status);
