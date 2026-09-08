#!/usr/bin/env -S deno run --allow-net --allow-env
// Shop items can ask the buyer to type something (sent on to the webhook) and
// can show them something back after redeeming. This checks the whole path:
// the prompt label is listed but the output is held back, a missing response
// is refused before any sahurs are spent, and on success the typed text lands
// in the webhook while the output comes back to the buyer.
//
// Usage (app running with ADMIN_KEY, and DISCORD_WEBHOOK_URL pointed at the
// capture server whose GET side is CAPTURE):
//   ADMIN_KEY=devadminkey API=... CAPTURE=... deno run --allow-net --allow-env scripts/test-shop-input-output.ts

const API = (Deno.env.get("API") || "http://127.0.0.1:8000").replace(/\/$/, "");
const CAPTURE = (Deno.env.get("CAPTURE") || "http://127.0.0.1:8090").replace(/\/$/, "");
const ADMIN = Deno.env.get("ADMIN_KEY") || "devadminkey";

function fail(msg: string): never {
  console.error("FAIL:", msg);
  Deno.exit(1);
}
async function j(path: string, opt?: RequestInit) {
  const r = await fetch(API + path, opt);
  const body = await r.json().catch(() => ({}));
  return { status: r.status, body };
}
const post = (path: string, obj: unknown) =>
  j(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(obj) });

// approved buyer, funded
const username = "shopIO" + Date.now().toString(36).slice(-6);
const apply = await post("/apply", { username, application: "shop io test" });
const token = apply.body?.token as string;
if (!token) fail("apply failed");
const pending = await j("/admin/pending?key=" + encodeURIComponent(ADMIN));
const id = (pending.body.pending || []).find((a: { username: string }) => a.username === username)?.id;
if (!id) fail("not pending");
if (!(await post("/admin/decide", { key: ADMIN, id, action: "approve" })).body?.ok) fail("approve failed");
if (!(await post("/admin/setbal", { key: ADMIN, id, balance: 1000 })).body?.ok) fail("setbal failed");

// one item that asks for input and hands back an output, one plain item
const LABEL = "Your Discord tag";
const OUTPUT = "CODE-ABC123\nkeep this safe";
const withIO = await post("/admin/shop/set", { key: ADMIN, name: "Sahur code", desc: "a code", price: 10, inputLabel: LABEL, output: OUTPUT });
const plain = await post("/admin/shop/set", { key: ADMIN, name: "A shoutout", desc: "just a ping", price: 5 });
const idIO = withIO.body?.item?.id, idPlain = plain.body?.item?.id;
if (!idIO || !idPlain) fail("item create failed: " + JSON.stringify([withIO.body, plain.body]));
if (withIO.body.item.inputLabel !== LABEL || withIO.body.item.output !== OUTPUT) fail("set did not persist input/output");

// the public list carries the prompt but never the output
const list = await j("/shop/list?token=" + encodeURIComponent(token));
const seenIO = (list.body.items || []).find((x: { id: string }) => x.id === idIO);
const seenPlain = (list.body.items || []).find((x: { id: string }) => x.id === idPlain);
if (!seenIO || !seenPlain) fail("items not in shop list");
if (seenIO.inputLabel !== LABEL) fail("inputLabel not listed for the buyer to be prompted");
if ("output" in seenIO) fail("output must not be exposed in the public list");
if (seenPlain.inputLabel) fail("plain item should have no input prompt");

// redeeming the input item with nothing typed is refused, and costs nothing
const noInput = await post("/shop/redeem", { token, itemId: idIO });
if (noInput.status !== 400 || noInput.body.error !== "input required") {
  fail("empty input should be refused with 'input required', got " + JSON.stringify(noInput.body));
}
const balAfterRefusal = (await j("/shop/list?token=" + encodeURIComponent(token))).body.balance;
if (balAfterRefusal !== 1000) fail("a refused redemption still moved the balance: " + balAfterRefusal);

// redeem with input: output comes back, balance drops by the price
const TYPED = "spooky#0001 <@everyone>";
const good = await post("/shop/redeem", { token, itemId: idIO, input: TYPED });
if (!good.body?.ok) fail("redeem with input failed: " + JSON.stringify(good.body));
if (good.body.output !== OUTPUT) fail("output not returned to the buyer: " + JSON.stringify(good.body.output));
if (good.body.balance !== 990) fail("balance should be 990 after a 10 redeem, got " + good.body.balance);

// plain item: no output, works with no input
const plainRedeem = await post("/shop/redeem", { token, itemId: idPlain });
if (!plainRedeem.body?.ok) fail("plain redeem failed: " + JSON.stringify(plainRedeem.body));
if (plainRedeem.body.output) fail("plain item should return no output");

// the webhook saw the typed text, with pings defused, and the plain redeem had none
const caps = await (await fetch(CAPTURE + "/captured")).json() as string[];
// the app also webhooks on /apply, so scope to redemption posts
const redeems = caps.map((c) => JSON.parse(c)).filter((p) => (p.content || "").includes("shop redemption"));
if (redeems.length !== 2) fail("expected 2 redemption webhooks (the refusal must not fire one), got " + redeems.length);
const ioHook = redeems.find((p) => (p.content || "").includes("Sahur code"));
const plainHook = redeems.find((p) => (p.content || "").includes("A shoutout"));
if (!ioHook) fail("no webhook for the input item");
if (!ioHook.content.includes(TYPED)) fail("the typed input did not reach the webhook: " + ioHook.content);
if (!ioHook.allowed_mentions || JSON.stringify(ioHook.allowed_mentions.parse) !== "[]") {
  fail("webhook must disable mentions so a typed @everyone cannot ping");
}
if (!plainHook) fail("no webhook for the plain item");
if (plainHook.content.includes("input:")) fail("a no-input item should not carry an input line");

console.log("PASS list prompts w/o leaking output; empty input refused & free; input reached webhook (pings off); output returned; plain item clean");
