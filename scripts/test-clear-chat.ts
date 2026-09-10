#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read
// Clearing the chat from /admin drops every retained event and nothing else.
// The part worth guarding is what happens to a client that was already
// connected: the seq counter must NOT wind back, or the next messages would
// reuse numbers past that client's cursor and it would never see them.
//
//   ADMIN_KEY=devadminkey deno run --allow-net --allow-env --unstable-kv server.ts
//   ADMIN_KEY=devadminkey API=... deno run --allow-net --allow-env --allow-read scripts/test-clear-chat.ts

const API = (Deno.env.get("API") || "http://127.0.0.1:8000").replace(/\/$/, "");
const ADMIN = Deno.env.get("ADMIN_KEY") || "devadminkey";

function must(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}
async function j(path: string, opt?: RequestInit) {
  const r = await fetch(API + path, opt);
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
const post = (path: string, obj: unknown) =>
  j(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(obj) });

async function member(name: string) {
  const a = await post("/apply", { username: name, application: "clear chat test" });
  const token = a.body?.token as string;
  must(!!token, "apply failed for " + name);
  const pend = await j("/admin/pending?key=" + encodeURIComponent(ADMIN));
  const id = (pend.body.pending || []).find((x: { username: string }) => x.username === name)?.id;
  must(!!id, name + " not pending");
  must(!!(await post("/admin/decide", { key: ADMIN, id, action: "approve" })).body?.ok, "approve failed");
  return { token, id };
}
// tung drops his own lines into the room on his own schedule, and this test is
// about clearing what the members said — so count members' messages only.
// Without this the "only thing in the room" check below is a race against his
// next wisdom, which is exactly what it lost when run with a short window.
// deno-lint-ignore no-explicit-any
const dump = async (): Promise<any[]> =>
  ((await j("/admin/chat?key=" + encodeURIComponent(ADMIN))).body.messages || [])
    .filter((m: { from?: string }) => m.from !== "tung");
const clear = () => post("/admin/clearchat", { key: ADMIN });

const stamp = Date.now().toString(36).slice(-6);
const alice = await member("clrA" + stamp);
const bob = await member("clrB" + stamp);

// seed a few lines and a reaction, admin-keyed so the flood cap stays out of it
const tag = "c" + stamp;
for (let i = 1; i <= 4; i++) {
  must(!!(await post("/send", { key: ADMIN, token: alice.token, id: tag + "-" + i, text: "line " + i })).body?.ok,
    "seed send " + i + " failed");
}
must(!!(await post("/react", { token: bob.token, id: tag + "-1", e: "👍", op: 1, eid: tag + "r" })).body?.ok,
  "seed react failed");
must((await dump()).length >= 4, "seeded messages are not in the dump");

// a client that is up to date right now — this is the cursor that must survive
const live = await j("/events?since=0&token=" + encodeURIComponent(alice.token));
const cursorBefore = live.body.cursor as number;
must(cursorBefore > 0, "expected a live cursor before clearing");

// ---- the key is required ----
must((await post("/admin/clearchat", { key: "wrong" })).status === 403, "a wrong key must not clear the chat");
must((await post("/admin/clearchat", {})).status === 403, "no key must not clear the chat");
must((await dump()).length >= 4, "a refused clear must not have deleted anything");

// ---- clear ----
const res = await clear();
must(res.body?.ok === true, "clear failed: " + JSON.stringify(res.body));
must(typeof res.body.cleared === "number" && res.body.cleared >= 5,
  `expected the messages and the reaction to be counted, got ${res.body.cleared}`);
must((await dump()).length === 0, "the chat log is not empty after clearing");

// a fresh open sees an empty room (bar anything tung has said since)
const fresh = await j("/events?since=0&token=" + encodeURIComponent(bob.token));
// deno-lint-ignore no-explicit-any
const freshMsgs = (fresh.body.events || []).filter((e: any) => e.type === "msg" && e.from !== "tung");
must(freshMsgs.length === 0, "a fresh open still sees member messages after clearing");

// ---- the bit that matters: the already-connected client keeps working ----
must(!!(await post("/send", { token: bob.token, id: tag + "-after", text: "after the wipe" })).body?.ok,
  "sending after a clear failed");
const caught = await j("/events?since=" + cursorBefore + "&token=" + encodeURIComponent(alice.token));
const texts = (caught.body.events || []).map((e: { text?: string }) => e.text);
must(texts.includes("after the wipe"),
  "a client connected before the clear never received the next message — the seq counter was wound back");

// and the new line is the only thing in the room
const after = await dump();
must(after.length === 1 && after[0].text === "after the wipe",
  "after a clear the log should hold only what members said since: " +
    JSON.stringify(after.map((m: { text: string }) => m.text)));

// clearing an already-empty log is a no-op, not an error
await clear();
must((await clear()).body?.ok === true, "clearing an empty log should still succeed");

// accounts survive: both members can still talk
must(!!(await post("/send", { token: alice.token, id: tag + "-z", text: "still here" })).body?.ok,
  "clearing the chat must not have disturbed accounts");

console.log("clear chat: admin-key only, wipes messages and reactions, keeps accounts, and a client connected before the wipe still receives what comes after");
