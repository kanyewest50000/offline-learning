#!/usr/bin/env -S deno run --allow-net --allow-env
// Shop items can ask the buyer to type something (sent on to the webhook) and
// can show them something back after redeeming. The question field waits
// until they have already paid. Output is held back from the public list.
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

const username = "shopIO" + Date.now().toString(36).slice(-6);
const apply = await post("/apply", { username, application: "shop io test" });
const token = apply.body?.token as string;
if (!token) fail("apply failed");
const pending = await j("/admin/pending?key=" + encodeURIComponent(ADMIN));
const id = (pending.body.pending || []).find((a: { username: string }) => a.username === username)?.id;
if (!id) fail("not pending");
if (!(await post("/admin/decide", { key: ADMIN, id, action: "approve" })).body?.ok) fail("approve failed");
if (!(await post("/admin/setbal", { key: ADMIN, id, balance: 1000 })).body?.ok) fail("setbal failed");

const LABEL = "Your Discord tag";
const OUTPUT = "CODE-ABC123\nkeep this safe";
const withIO = await post("/admin/shop/set", { key: ADMIN, name: "Sahur code", desc: "a code", price: 10, inputLabel: LABEL, output: OUTPUT });
const plain = await post("/admin/shop/set", { key: ADMIN, name: "A shoutout", desc: "just a ping", price: 5 });
const idIO = withIO.body?.item?.id, idPlain = plain.body?.item?.id;
if (!idIO || !idPlain) fail("item create failed: " + JSON.stringify([withIO.body, plain.body]));
if (withIO.body.item.inputLabel !== LABEL || withIO.body.item.output !== OUTPUT) fail("set did not persist input/output");

const list = await j("/shop/list?token=" + encodeURIComponent(token));
const seenIO = (list.body.items || []).find((x: { id: string }) => x.id === idIO);
const seenPlain = (list.body.items || []).find((x: { id: string }) => x.id === idPlain);
if (!seenIO || !seenPlain) fail("items not in shop list");
if (seenIO.inputLabel !== LABEL) fail("inputLabel not listed so the client knows a question comes after pay");
if ("output" in seenIO) fail("output must not be exposed in the public list");
if (seenPlain.inputLabel) fail("plain item should have no input prompt");

// paying with nothing typed is the sale: they are charged, the output ships,
// and the label comes back so the client can show the field now.
const paid = await post("/shop/redeem", { token, itemId: idIO });
if (!paid.body?.ok) fail("redeem without input should still sell, got " + JSON.stringify(paid.body));
if (paid.body.output !== OUTPUT) fail("output not returned after the sale: " + JSON.stringify(paid.body.output));
if (paid.body.inputLabel !== LABEL) fail("sale must return inputLabel so the field can appear after pay");
if (paid.body.balance !== 990) fail("balance should be 990 after a 10 redeem, got " + paid.body.balance);
if (!paid.body.pending?.id || paid.body.pending.itemId !== idIO) {
  fail("sale must return a pending redeem so they can finish later: " + JSON.stringify(paid.body.pending));
}
if (paid.body.pending.inputLabel !== LABEL || paid.body.pending.output !== OUTPUT) {
  fail("pending must keep the question and the output: " + JSON.stringify(paid.body.pending));
}

// walking away is a client close. the owed answer must still be on the list.
const listed = await j("/shop/list?token=" + encodeURIComponent(token));
const owed = (listed.body.pending || []).find((p: { id: string }) => p.id === paid.body.pending.id);
if (!owed) fail("unfinished redeem missing from /shop/list after pay: " + JSON.stringify(listed.body.pending));
if (owed.output !== OUTPUT) fail("list pending must still carry the output");
if (listed.body.balance !== 990) fail("listing unfinished redemptions must not charge again");

const tooSoon = await post("/shop/tell", { token, redeemId: paid.body.pending.id, itemId: idIO });
if (tooSoon.status !== 400 || tooSoon.body.error !== "input required") {
  fail("an empty tell should be refused, got " + JSON.stringify(tooSoon));
}
if ((await j("/shop/list?token=" + encodeURIComponent(token))).body.pending?.length !== 1) {
  fail("a refused tell must leave the unfinished redeem on the shelf");
}

const TYPED = "spooky#0001 <@everyone>";
const told = await post("/shop/tell", { token, redeemId: paid.body.pending.id, itemId: idIO, input: TYPED });
if (!told.body?.ok) fail("tell after pay failed: " + JSON.stringify(told.body));
if (told.body.output !== OUTPUT) fail("tell should still return the output: " + JSON.stringify(told.body.output));
if ((await j("/shop/list?token=" + encodeURIComponent(token))).body.pending?.length) {
  fail("answering must clear the unfinished redeem");
}

const twice = await post("/shop/tell", { token, itemId: idIO, input: "again" });
if (twice.status !== 400 || twice.body.error !== "nothing to add") {
  fail("a second tell should be refused, got " + JSON.stringify(twice));
}

const plainRedeem = await post("/shop/redeem", { token, itemId: idPlain });
if (!plainRedeem.body?.ok) fail("plain redeem failed: " + JSON.stringify(plainRedeem.body));
if (plainRedeem.body.output) fail("plain item should return no output");
if (plainRedeem.body.inputLabel) fail("plain item should not ask a question after pay");

const stray = await post("/shop/tell", { token, itemId: idPlain, input: "nope" });
if (stray.status !== 400 || stray.body.error !== "nothing to add") {
  fail("telling on a no-question item should fail, got " + JSON.stringify(stray));
}

const caps = await (await fetch(CAPTURE + "/captured")).json() as string[];
const redeems = caps.map((c) => JSON.parse(c)).filter((p) => (p.content || "").includes("shop redemption"));
if (redeems.length !== 3) fail("expected 3 redemption webhooks (sale, tell, plain), got " + redeems.length);
const saleHook = redeems.find((p) => (p.content || "").includes("Sahur code") && !(p.content || "").includes("input:"));
const tellHook = redeems.find((p) => (p.content || "").includes("Sahur code") && (p.content || "").includes("input:"));
const plainHook = redeems.find((p) => (p.content || "").includes("A shoutout"));
if (!saleHook) fail("no webhook for the sale itself");
if (!tellHook) fail("no webhook for the typed answer");
if (!tellHook.content.includes(TYPED)) fail("the typed input did not reach the webhook: " + tellHook.content);
if (!tellHook.allowed_mentions || JSON.stringify(tellHook.allowed_mentions.parse) !== "[]") {
  fail("webhook must disable mentions so a typed @everyone cannot ping");
}
if (!plainHook) fail("no webhook for the plain item");
if (plainHook.content.includes("input:")) fail("a no-input item should not carry an input line");

console.log("PASS sale without an answer still charges and returns output; question field is after pay; tell reaches webhook (pings off); plain item clean");
