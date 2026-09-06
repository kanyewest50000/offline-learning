# Export / import shrine Deno KV

Deno Deploy does **not** let you download the hosted KV as a file from the
dashboard. The data is a managed FoundationDB-backed store. You dump it over
the **KV Connect** API from any machine that has a personal access token.

There is no `deno kv dump` subcommand in current Deno (2.x). Use the scripts
in this folder (or `Deno.openKv(connectUrl)` + `kv.list` yourself).

## What is stored (every prefix in `server.ts`)

| Prefix | Meaning | TTL on write |
| --- | --- | --- |
| `["app", id]` | Application: username, text, `status`, `ts`, `thread`, `banned`, `note`, `timeoutUntil` | none |
| `["name", lowercase]` | Username reservation → app id | none |
| `["tok", token]` | **Session secret** → app id | none |
| `["seq"]` | Chat event counter | none |
| `["ev", seq]` | Chat / react history | 14 days |
| `["cas", id]` | Casino `{bal, lastClaim}` | ~400 days inactivity |
| `["bj", id]` | In-progress blackjack | 6 hours |
| `["mines", id]` | In-progress mines | 6 hours |
| `["beef", id]` | In-progress beef | 6 hours |
| `["shopitem", itemId]` | Shop catalog | none |

Bans, timeouts, and admin notes live on the `["app"]` record. Shop *redemptions*
are not stored as their own keys (Discord notify only); balances are on `["cas"]`.

`export-kv.ts` also walks the empty prefix so an unknown key is not silently dropped.

## 1. Create a Deno Deploy access token

1. Open [https://dash.deno.com/account](https://dash.deno.com/account)
2. **Access Tokens** → **New Access Token**
3. Copy it once. It looks like `ddp_…`

```bash
export DENO_KV_ACCESS_TOKEN='ddp_…'
```

## 2. Find the database id

1. Open the project on [https://dash.deno.com](https://dash.deno.com)
2. **KV** tab (or Project Settings → KV)
3. Copy the **Database ID** (a UUID)

The connect URL is always:

```
https://api.deno.com/databases/<DATABASE_ID>/connect
```

```bash
export DENO_KV_URL='https://api.deno.com/databases/<DATABASE_ID>/connect'
```

## 3. Export (do this before deleting the project)

From a checkout of this repo, on your laptop (not inside the failing isolate):

```bash
deno run --unstable-kv --allow-env --allow-net --allow-read --allow-write \
  scripts/export-kv.ts shrine-kv.json
```

That writes pretty-printed JSON. **`["tok"]` keys are live login secrets.**
Keep `shrine-kv.json` offline. Do not commit it. Do not paste it into chat.

Inspect without leaking tokens:

```bash
deno run --unstable-kv --allow-env --allow-net --allow-read --allow-write \
  scripts/export-kv.ts shrine-kv.redacted.json --redact
```

A redacted file cannot restore logins.

## 4. Does this still work under `USAGE_EXCEEDED`?

Often **yes** for this CLI, even when `https://<your-project>.deno.dev` returns
`USAGE_EXCEEDED`.

`USAGE_EXCEEDED` is the **project isolate** refusing HTTP (request / CPU quota).
These scripts open KV at `api.deno.com` with your account token. That path does
not invoke `server.ts`.

It can still fail if:

- the token or database id is wrong
- the whole account is locked / billing-blocked
- you already **deleted** the project (the KV goes with it)

If remote connect fails, **do not delete the project**. Retry after quota reset
or write Deno support. An HTTP admin export (not included; off by design) would
almost certainly fail while the isolate is over quota — that is why this is CLI.

## 5. Import on a new host

### New Deno Deploy Classic project

1. Create the new project. Copy **its** database id from the KV tab.
2. Import **into the new database** (not the old one):

```bash
export DENO_KV_ACCESS_TOKEN='ddp_…'
export DENO_KV_URL='https://api.deno.com/databases/<NEW_DATABASE_ID>/connect'
deno run --unstable-kv --allow-env --allow-net --allow-read --allow-write \
  scripts/import-kv.ts shrine-kv.json
```

3. Deploy `server.ts` as usual. On Deploy, `Deno.openKv()` is that project's KV.
   Users keep the same tokens / usernames / balances.

### VPS or local Deno (leaving Deploy)

Import into an explicit sqlite file:

```bash
export DENO_KV_URL=/var/lib/shrine/kv.sqlite
deno run --unstable-kv --allow-env --allow-read --allow-write \
  scripts/import-kv.ts shrine-kv.json
```

`server.ts` today calls `Deno.openKv()` with no argument, so a different script
does **not** share that file automatically. Point the backend at the imported
store with one line:

```ts
const kv = await Deno.openKv(Deno.env.get("DENO_KV_URL") || undefined);
```

Then run the server with `DENO_KV_URL=/var/lib/shrine/kv.sqlite`.

`--dry-run` prints counts without writing.

## TTL note

`kv.list` / `kv.get` do not return remaining `expireIn`. Import re-applies the
same TTLs `server.ts` uses on write (14d chat, ~400d balances, 6h in-progress
games). Chat lines that were about to expire get a fresh 14 days.

## Optional HTTP export

Not added. A dump includes every session token and can be huge. Leave it off
unless you later gate it on `ADMIN_KEY` **and** a second explicit env flag
defaulting to off. Prefer this CLI while the project is still alive.
