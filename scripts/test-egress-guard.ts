// Checks that scrapable Deno routes stay small and that /apply cannot be spammed.
const BASE = Deno.env.get("EGRESS_BASE") || "http://127.0.0.1:8022";

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
if (admin.text.includes("Approve / deny") || admin.text.includes("ADMIN_HTML")) {
  throw new Error("/admin leaked full panel");
}

const badKey = await hit("/admin?key=nope");
if (badKey.status !== 401) throw new Error("bad admin key wanted 401 got " + badKey.status);
if (badKey.bytes > 800) throw new Error("401 admin body too big: " + badKey.bytes);

const health = await hit("/nope");
if (health.bytes > 80) throw new Error("health too big: " + health.bytes);

let saw429 = false;
for (let i = 0; i < 12; i++) {
  const a = await hit("/apply", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "rl" + i + Date.now(), application: "rate limit test" }),
  });
  if (a.status === 429) { saw429 = true; break; }
}
if (!saw429) throw new Error("/apply never 429'd");

console.log("PASS /g/ 410", g.bytes, "B; /admin gate", admin.bytes, "B; /apply rate-limited");
