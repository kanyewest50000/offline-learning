#!/usr/bin/env -S deno run --allow-net --allow-env
// The anonymous IP cap must key on the address the trusted edge appends (the
// last x-forwarded-for hop), not the client-controllable leftmost value.
// Rotating the leftmost entry — the "pitchfork the header in Burp" bypass —
// must not mint a fresh bucket per request.
//
// This mirrors Deno Deploy, where the edge appends the real client IP as the
// last hop: here the last hop is held fixed and only the spoofed prefix varies.
//
// Usage (server running):
//   IP_BASE=http://127.0.0.1:8000 deno run --allow-net --allow-env scripts/test-ip-spoof-guard.ts

const BASE = (Deno.env.get("IP_BASE") || "http://127.0.0.1:8000").replace(/\/$/, "");

function fail(msg: string): never {
  console.error("FAIL:", msg);
  Deno.exit(1);
}

async function hit(xff: string) {
  const r = await fetch(BASE + "/nope", { headers: { "x-forwarded-for": xff } });
  await r.body?.cancel();
  return r.status;
}

// One real client behind the edge, rotating a spoofed prefix every request.
// The trusted (last) hop is the same throughout, so all of these share a bucket
// and the 90/min cap must trip.
const realClient = "203.0.113." + (1 + Math.floor(Math.random() * 250));
let tripped = false;
let sent = 0;
for (let i = 0; i < 130; i++) {
  const spoof = "10." + (i % 256) + "." + ((i * 7) % 256) + "." + ((i * 13) % 256);
  const status = await hit(spoof + ", " + realClient);
  sent++;
  if (status === 429) { tripped = true; break; }
}
if (!tripped) {
  fail("rotating the leftmost x-forwarded-for never tripped the cap in " + sent + " requests — the spoof still works");
}

// A genuinely different trusted hop is its own bucket and is not already
// blocked by the burst above.
const other = await hit("10.0.0.1, 198.51.100.7");
if (other === 429) {
  fail("a different real client was blocked — the cap is keying on the wrong hop");
}

console.log("PASS leftmost-spoof capped after " + sent + " reqs; a separate real client (" + other + ") is unaffected");
