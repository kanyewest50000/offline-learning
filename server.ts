// Shrine of Tung backend — HTTP-polling chat with history + application auth.
// Storage: Deno KV (persistent, free on Deno Deploy). No WebSockets.
//
// Set these in the Deno Deploy dashboard (Settings -> Environment Variables):
//   DISCORD_WEBHOOK_URL  where applications are posted (optional)
//   ADMIN_KEY            password for the /admin page (required to approve)
//
// Endpoints (JSON, CORS-open):
//   POST /apply         {username, application}          -> {token, status}
//   GET  /status?token=                                   -> {status, username}
//   GET  /events?since=&token=                            -> {events, cursor}
//   POST /send          {token, id, text, reply}          -> {ok}
//   POST /react         {token, id, e, op, eid}           -> {ok}
//   GET  /admin                                           -> admin page (html)
//   GET  /admin/pending?key=                              -> {pending:[...]}
//   POST /admin/decide  {key, id, action:"approve"|"reject"} -> {ok, status}

const kv = await Deno.openKv();
const WEBHOOK = Deno.env.get("DISCORD_WEBHOOK_URL") || "";
const ADMIN_KEY = Deno.env.get("ADMIN_KEY") || "";
const HISTORY = 500; // number of recent events retained

// Deno KV key-space (how the pieces connect):
//   ["seq"]            -> number   monotonically increasing event counter
//   ["ev", seq]        -> event    the append-only chat log (msg/react), trimmed to HISTORY
//   ["app", id]        -> app      one application record {id,username,application,status,ts}
//   ["name", lowercase]-> id       reserves a username so two people can't take the same one
//   ["tok", token]     -> id       maps a secret session token back to its application id
// A client flows: /apply (creates app + token) -> /status (poll until approved)
// -> /events (replay history + long-poll new ones) + /send + /react.

const CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...CORS },
  });
}

function rid(n = 16) {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return Array.from(a).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function clip(v: unknown, n: number) {
  return String(v ?? "").trim().slice(0, n);
}

// monotonic event sequence via compare-and-set
async function nextSeq(): Promise<number> {
  for (;;) {
    const cur = await kv.get<number>(["seq"]);
    const next = (cur.value ?? 0) + 1;
    const res = await kv.atomic().check(cur).set(["seq"], next).commit();
    if (res.ok) return next;
  }
}

async function appendEvent(ev: Record<string, unknown>) {
  const seq = await nextSeq();
  ev.seq = seq;
  await kv.set(["ev", seq], ev);
  if (seq > HISTORY) await kv.delete(["ev", seq - HISTORY]);
  return seq;
}

// deno-lint-ignore no-explicit-any
async function authUser(token: string | null): Promise<any | null> {
  if (!token) return null;
  const t = await kv.get<string>(["tok", token]);
  if (!t.value) return null;
  // deno-lint-ignore no-explicit-any
  const app = await kv.get<any>(["app", t.value]);
  if (!app.value || app.value.status !== "approved") return null;
  return app.value;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const path = url.pathname;
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  // ---------- apply ----------
  if (req.method === "POST" && path === "/apply") {
    // deno-lint-ignore no-explicit-any
    const b: any = await req.json().catch(() => ({}));
    const username = clip(b.username, 24);
    const application = clip(b.application, 500);
    if (!username || !application) return json({ error: "missing" }, 400);
    const lower = username.toLowerCase();
    const id = rid(8), token = rid(24);
    const app = { id, username, application, status: "pending", ts: Date.now() };
    const res = await kv.atomic()
      .check({ key: ["name", lower], versionstamp: null })
      .set(["name", lower], id)
      .set(["app", id], app)
      .set(["tok", token], id)
      .commit();
    if (!res.ok) return json({ error: "username taken" }, 409);
    if (WEBHOOK) {
      fetch(WEBHOOK, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          content: "**new Shrine of Tung application**\nusername: " + username +
            "\napplication: " + application + "\nid: `" + id + "`",
        }),
      }).catch(() => {});
    }
    return json({ token, status: "pending", username });
  }

  // ---------- status ----------
  if (req.method === "GET" && path === "/status") {
    const token = url.searchParams.get("token");
    if (!token) return json({ status: "none" });
    const t = await kv.get<string>(["tok", token]);
    if (!t.value) return json({ status: "none" });
    // deno-lint-ignore no-explicit-any
    const app = await kv.get<any>(["app", t.value]);
    if (!app.value) return json({ status: "none" });
    return json({ status: app.value.status, username: app.value.username });
  }

  // ---------- events (poll) ----------
  if (req.method === "GET" && path === "/events") {
    const user = await authUser(url.searchParams.get("token"));
    if (!user) return json({ error: "unauthorized" }, 401);
    const since = Number(url.searchParams.get("since") || "0") || 0;
    const events: unknown[] = [];
    let cursor = since;
    // deno-lint-ignore no-explicit-any
    for await (const e of kv.list<any>({ prefix: ["ev"], start: ["ev", since + 1] }, { limit: 500 })) {
      events.push(e.value);
      cursor = e.value.seq;
    }
    return json({ events, cursor });
  }

  // ---------- send ----------
  if (req.method === "POST" && path === "/send") {
    // deno-lint-ignore no-explicit-any
    const b: any = await req.json().catch(() => ({}));
    const user = await authUser(b.token);
    if (!user) return json({ error: "unauthorized" }, 401);
    const text = clip(b.text, 1000);
    if (!text) return json({ error: "empty" }, 400);
    const reply = b.reply && b.reply.id
      ? { id: clip(b.reply.id, 32), name: clip(b.reply.name, 24), text: clip(b.reply.text, 140) }
      : null;
    const id = clip(b.id, 32) || rid(8);
    await appendEvent({ type: "msg", id, name: user.username, text, reply });
    return json({ ok: true });
  }

  // ---------- react ----------
  if (req.method === "POST" && path === "/react") {
    // deno-lint-ignore no-explicit-any
    const b: any = await req.json().catch(() => ({}));
    const user = await authUser(b.token);
    if (!user) return json({ error: "unauthorized" }, 401);
    const id = clip(b.id, 32);
    const e = clip(b.e, 16);
    const op = b.op === -1 ? -1 : 1;
    const eid = clip(b.eid, 16) || rid(6);
    if (!id || !e) return json({ error: "bad" }, 400);
    await appendEvent({ type: "react", id, e, op, eid, name: user.username });
    return json({ ok: true });
  }

  // ---------- admin ----------
  if (req.method === "GET" && path === "/admin") {
    return new Response(ADMIN_HTML, { headers: { "content-type": "text/html; charset=utf-8" } });
  }
  if (req.method === "GET" && path === "/admin/pending") {
    if (!ADMIN_KEY || url.searchParams.get("key") !== ADMIN_KEY) return json({ error: "forbidden" }, 403);
    const pending: unknown[] = [];
    // deno-lint-ignore no-explicit-any
    for await (const e of kv.list<any>({ prefix: ["app"] })) {
      if (e.value.status === "pending") {
        pending.push({ id: e.value.id, username: e.value.username, application: e.value.application, ts: e.value.ts });
      }
    }
    // deno-lint-ignore no-explicit-any
    pending.sort((a: any, b: any) => a.ts - b.ts);
    return json({ pending });
  }
  if (req.method === "POST" && path === "/admin/decide") {
    // deno-lint-ignore no-explicit-any
    const b: any = await req.json().catch(() => ({}));
    if (!ADMIN_KEY || b.key !== ADMIN_KEY) return json({ error: "forbidden" }, 403);
    // deno-lint-ignore no-explicit-any
    const app = await kv.get<any>(["app", clip(b.id, 32)]);
    if (!app.value) return json({ error: "not found" }, 404);
    const status = b.action === "approve" ? "approved" : "rejected";
    await kv.set(["app", app.value.id], { ...app.value, status });
    return json({ ok: true, status });
  }

  // ---------- admin: list already-decided users (approved + revoked) ----------
  // used by the "approved users" panel. revoked users keep status "rejected",
  // which authUser() already treats as no-access, so revoking = reject.
  if (req.method === "GET" && path === "/admin/users") {
    if (!ADMIN_KEY || url.searchParams.get("key") !== ADMIN_KEY) return json({ error: "forbidden" }, 403);
    const users: unknown[] = [];
    // deno-lint-ignore no-explicit-any
    for await (const e of kv.list<any>({ prefix: ["app"] })) {
      if (e.value.status === "approved" || e.value.status === "rejected") {
        users.push({ id: e.value.id, username: e.value.username, status: e.value.status, ts: e.value.ts });
      }
    }
    // deno-lint-ignore no-explicit-any
    users.sort((a: any, b: any) =>
      a.status !== b.status
        ? (a.status === "approved" ? -1 : 1)                       // approved first
        : a.username.toLowerCase().localeCompare(b.username.toLowerCase()));
    return json({ users });
  }

  // ---------- admin: rename an existing user ----------
  // moves the ["name", lowercase] reservation to the new spelling (guarding
  // against collisions) and updates the display name on the ["app", id] record.
  if (req.method === "POST" && path === "/admin/rename") {
    // deno-lint-ignore no-explicit-any
    const b: any = await req.json().catch(() => ({}));
    if (!ADMIN_KEY || b.key !== ADMIN_KEY) return json({ error: "forbidden" }, 403);
    const id = clip(b.id, 32);
    const username = clip(b.username, 24);
    if (!id || !username) return json({ error: "missing" }, 400);
    // deno-lint-ignore no-explicit-any
    const app = await kv.get<any>(["app", id]);
    if (!app.value) return json({ error: "not found" }, 404);
    const oldLower = String(app.value.username).toLowerCase();
    const newLower = username.toLowerCase();
    if (newLower === oldLower) {
      // same name (maybe just casing): update the display value, leave the reservation
      await kv.set(["app", id], { ...app.value, username });
      return json({ ok: true, username });
    }
    const taken = await kv.get<string>(["name", newLower]);
    if (taken.value) {
      if (taken.value === id) { await kv.set(["app", id], { ...app.value, username }); return json({ ok: true, username }); }
      return json({ error: "username taken" }, 409);
    }
    const res = await kv.atomic()
      .check({ key: ["name", newLower], versionstamp: null })
      .delete(["name", oldLower])
      .set(["name", newLower], id)
      .set(["app", id], { ...app.value, username })
      .commit();
    if (!res.ok) return json({ error: "username taken" }, 409);
    return json({ ok: true, username });
  }

  if (req.method === "POST" && path === "/admin/clear") {
    // deno-lint-ignore no-explicit-any
    const b: any = await req.json().catch(() => ({}));
    if (!ADMIN_KEY || b.key !== ADMIN_KEY) return json({ error: "forbidden" }, 403);
    let n = 0;
    for (const prefix of [["app"], ["name"], ["tok"]]) {
      for await (const e of kv.list({ prefix })) {
        await kv.delete(e.key);
        n++;
      }
    }
    return json({ ok: true, cleared: n });
  }

  // ---------- health ----------
  return new Response("Shrine of Tung backend is alive", {
    headers: { "content-type": "text/plain", ...CORS },
  });
});

const ADMIN_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Shrine of Tung — admin</title>
<style>
:root{color-scheme:dark}
body{margin:0;font-family:system-ui,Segoe UI,Roboto,sans-serif;background:#1d1206;color:#f5efe0}
header{padding:16px 20px;background:#2b1a0a;border-bottom:1px solid #3a2410;font-weight:700}
main{max-width:720px;margin:0 auto;padding:20px}
.keybar{display:flex;gap:8px;margin-bottom:16px}
input{flex:1;padding:10px 12px;border-radius:8px;border:1px solid #3a2410;background:#160d04;color:#f5efe0;font-size:14px}
button{padding:10px 14px;border:none;border-radius:8px;font-weight:600;cursor:pointer}
.load{background:#c8823c;color:#1d1206}
.app{background:#241505;border:1px solid #3a2410;border-radius:12px;padding:14px 16px;margin-bottom:12px}
.app h3{margin:0 0 4px;font-size:16px}
.app p{margin:0 0 12px;color:#e9d9c2;white-space:pre-wrap;word-break:break-word}
.app small{color:#c8823c}
.row{display:flex;gap:8px}
.ok{background:#2e7d32;color:#fff}
.no{background:#7a2e2e;color:#fff}
.empty{color:#c8823c;padding:20px 0}
.sec{margin:26px 0 10px;font-size:18px;font-weight:700}
.uname{flex:1;min-width:0}
.app small.rev{color:#e0908a}
</style></head><body>
<header>Shrine of Tung — pending applications</header>
<main>
<div class="keybar"><input id="key" type="password" placeholder="admin key" autocomplete="off"><button class="load" id="load">load</button><button class="no" id="clear">clear all</button></div>
<div id="list"><div class="empty">enter your admin key and hit load.</div></div>
<h2 class="sec">approved users</h2>
<div id="users"><div class="empty">load to see approved users.</div></div>
</main>
<script>
var keyEl=document.getElementById("key"),list=document.getElementById("list"),users=document.getElementById("users");
try{var k=localStorage.getItem("shrine-admin-key");if(k)keyEl.value=k;}catch(e){}
function loadAll(){refresh();refreshUsers();}   /* both panels share the one "load" button */
document.getElementById("load").onclick=loadAll;
document.getElementById("clear").onclick=function(){
  if(!confirm("Delete ALL applications (pending + approved)? Everyone will have to re-apply."))return;
  fetch("/admin/clear",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({key:keyEl.value.trim()})}).then(function(r){return r.json();}).then(function(d){alert(d.error?d.error:("cleared "+d.cleared+" entries"));loadAll();});
};
function refresh(){
  var key=keyEl.value.trim();try{localStorage.setItem("shrine-admin-key",key);}catch(e){}
  list.innerHTML='<div class="empty">loading...</div>';
  fetch("/admin/pending?key="+encodeURIComponent(key)).then(function(r){return r.json();}).then(function(d){
    if(d.error){list.innerHTML='<div class="empty">'+d.error+' — check your key.</div>';return;}
    if(!d.pending.length){list.innerHTML='<div class="empty">no pending applications.</div>';return;}
    list.innerHTML="";
    d.pending.forEach(function(a){
      var el=document.createElement("div");el.className="app";
      var h=document.createElement("h3");h.textContent=a.username;el.appendChild(h);
      var p=document.createElement("p");p.textContent=a.application;el.appendChild(p);
      var s=document.createElement("small");s.textContent=new Date(a.ts).toLocaleString();el.appendChild(s);
      var row=document.createElement("div");row.className="row";row.style.marginTop="10px";
      var ok=document.createElement("button");ok.className="ok";ok.textContent="approve";ok.onclick=function(){decide(a.id,"approve");};
      var no=document.createElement("button");no.className="no";no.textContent="reject";no.onclick=function(){decide(a.id,"reject");};
      row.appendChild(ok);row.appendChild(no);el.appendChild(row);
      list.appendChild(el);
    });
  }).catch(function(){list.innerHTML='<div class="empty">network error.</div>';});
}
function decide(id,action){
  fetch("/admin/decide",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({key:keyEl.value.trim(),id:id,action:action})}).then(function(r){return r.json();}).then(function(){refresh();refreshUsers();});
}
/* the "approved users" panel: lists decided users, lets you rename or revoke/restore */
function refreshUsers(){
  var key=keyEl.value.trim();
  users.innerHTML='<div class="empty">loading...</div>';
  fetch("/admin/users?key="+encodeURIComponent(key)).then(function(r){return r.json();}).then(function(d){
    if(d.error){users.innerHTML='<div class="empty">'+d.error+' — check your key.</div>';return;}
    if(!d.users.length){users.innerHTML='<div class="empty">no approved users yet.</div>';return;}
    users.innerHTML="";
    d.users.forEach(function(u){
      var el=document.createElement("div");el.className="app";
      var row=document.createElement("div");row.className="row";row.style.alignItems="center";
      var inp=document.createElement("input");inp.className="uname";inp.value=u.username;inp.maxLength=24;
      var save=document.createElement("button");save.className="load";save.textContent="save name";
      save.onclick=function(){rename(u.id,inp.value.trim());};
      var act=document.createElement("button");
      if(u.status==="approved"){act.className="no";act.textContent="revoke";act.onclick=function(){decide(u.id,"reject");};}
      else{act.className="ok";act.textContent="restore";act.onclick=function(){decide(u.id,"approve");};}
      row.appendChild(inp);row.appendChild(save);row.appendChild(act);
      el.appendChild(row);
      var meta=document.createElement("small");
      meta.textContent=(u.status==="approved"?"approved":"revoked")+" · "+new Date(u.ts).toLocaleString();
      if(u.status!=="approved")meta.className="rev";
      el.appendChild(meta);
      users.appendChild(el);
    });
  }).catch(function(){users.innerHTML='<div class="empty">network error.</div>';});
}
function rename(id,name){
  if(!name)return;
  fetch("/admin/rename",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({key:keyEl.value.trim(),id:id,username:name})}).then(function(r){return r.json();}).then(function(d){if(d.error)alert(d.error);refreshUsers();});
}
</script></body></html>`;
