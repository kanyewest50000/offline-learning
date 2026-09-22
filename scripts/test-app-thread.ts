#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read
// The chat on an application ends with its verdict.
//
// Tung asks an applicant questions and they answer, on the application itself.
// That conversation belongs to that review. Let them in, turn them away, or
// send them to tung, and it comes off the record — so sending somebody back to
// review later opens on an empty thread, not on the old questions as if they
// had just been asked. After a verdict neither side can write into it again:
// a line written then would sit on the record waiting for the next review.
//
//   ADMIN_KEY=devadminkey deno run --allow-net --allow-env --unstable-kv server.ts
//   ADMIN_KEY=devadminkey API=... deno run --allow-net --allow-env --allow-read scripts/test-app-thread.ts

const API = (Deno.env.get("API") || "http://127.0.0.1:8000").replace(/\/$/, "");
const ADMIN = Deno.env.get("ADMIN_KEY") || "devadminkey";

function must(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}
async function j(path: string, opt?: RequestInit) {
  const r = await fetch(API + path, opt);
  return { status: r.status, body: await r.json().catch(() => ({})) as Record<string, unknown> };
}
const post = (path: string, obj: unknown) =>
  j(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(obj) });

type Line = { from: string; text: string; ts: number };
type Pending = { id: string; username: string; thread: Line[] };

async function pendingRow(id: string): Promise<Pending | undefined> {
  const r = await j("/admin/pending?key=" + encodeURIComponent(ADMIN));
  return ((r.body.pending as Pending[]) || []).find((p) => p.id === id);
}
const statusOf = async (token: string) =>
  (await j("/status?token=" + encodeURIComponent(token))).body as { status: string; thread: Line[] };

async function applicant(tag: string) {
  const name = tag + Math.random().toString(36).slice(2, 8);
  const a = await post("/apply", { username: name, application: "thread test" });
  const token = a.body?.token as string;
  must(!!token, "apply failed for " + name + ": " + JSON.stringify(a.body));
  const r = await j("/admin/pending?key=" + encodeURIComponent(ADMIN));
  const id = ((r.body.pending as Pending[]) || []).find((x) => x.username === name)?.id;
  must(!!id, name + " not pending");
  return { name, token, id: id as string };
}

// a real back-and-forth, so there is something to lose
async function talk(p: { id: string; token: string }) {
  const q = await post("/admin/message", { key: ADMIN, id: p.id, text: "how did you find the shrine?" });
  must(q.body?.ok === true, "tung could not ask: " + JSON.stringify(q.body));
  const a = await post("/respond", { token: p.token, text: "a friend told me" });
  must(a.body?.ok === true, "the applicant could not answer: " + JSON.stringify(a.body));
  must((await pendingRow(p.id))?.thread.length === 2, "the review shows both lines");
  must((await statusOf(p.token)).thread.length === 2, "and so does their pending screen");
}

const decide = (id: string, action: string) => post("/admin/decide", { key: ADMIN, id, action });
const repend = (id: string) => post("/admin/repend", { key: ADMIN, id });

// ---- let in ---------------------------------------------------------------
const A = await applicant("thA");
await talk(A);
must((await decide(A.id, "approve")).body?.ok === true, "approve failed");
const aIn = await statusOf(A.token);
must(aIn.status === "approved" && aIn.thread.length === 0, "approving must take the thread off: " + JSON.stringify(aIn));

// neither side can put a line back on a decided application
const late = await post("/respond", { token: A.token, text: "am i in?" });
must(late.status === 409 && late.body.error === "not pending", "a member cannot write into a closed application: " + JSON.stringify(late.body));
const lateQ = await post("/admin/message", { key: ADMIN, id: A.id, text: "one more thing" });
must(lateQ.status === 409, "nor can tung, from this route: " + JSON.stringify(lateQ.body));
must((await statusOf(A.token)).status === "approved", "and the refused write must not have touched the account");

// sent back to review: the old conversation is not waiting there
must((await repend(A.id)).body?.ok === true, "repend failed");
const aBack = await pendingRow(A.id);
must(!!aBack && aBack.thread.length === 0, "a re-review opens on an empty thread: " + JSON.stringify(aBack));
must((await statusOf(A.token)).thread.length === 0, "their pending screen too");
// and this review's conversation works as the first one did
await talk(A);
must((await decide(A.id, "approve")).body?.ok === true, "second approve failed");
must((await statusOf(A.token)).thread.length === 0, "the second verdict clears the second thread");

// ---- turned away ----------------------------------------------------------
const R = await applicant("thR");
await talk(R);
must((await decide(R.id, "reject")).body?.ok === true, "reject failed");
must((await post("/respond", { token: R.token, text: "why" })).status === 409, "a rejected applicant cannot keep writing");
must((await repend(R.id)).body?.ok === true, "repend of a rejected applicant failed");
const rBack = await pendingRow(R.id);
must(!!rBack && rBack.thread.length === 0, "rejecting must take the thread off: " + JSON.stringify(rBack));
must((await decide(R.id, "reject")).body?.ok === true, "clean-up reject failed");

// ---- sent to tung ---------------------------------------------------------
const S = await applicant("thS");
await talk(S);
const sent = await decide(S.id, "banish");
must(sent.body?.ok === true && sent.body.banished === true, "banish failed: " + JSON.stringify(sent.body));
must((await repend(S.id)).body?.ok === true, "repend of a banished applicant failed");
const sBack = await pendingRow(S.id);
must(!!sBack && sBack.thread.length === 0, "sending them to tung must take the thread off: " + JSON.stringify(sBack));
// approving is how a banish is undone; leave the account as it would be
must((await decide(S.id, "approve")).body?.ok === true, "clean-up approve failed");

console.log(
  "application thread: approving, rejecting and sending to tung each take the pre-approval " +
    "chat off the record, a re-review opens on an empty thread, and neither side can write " +
    "into an application once it has its verdict",
);
