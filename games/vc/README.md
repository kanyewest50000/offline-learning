# GTA: Vice City web port — static build

A static, backend-free build of the DOS Zone Vice City web port. Drop it on GitHub
Pages (or Netlify / Cloudflare Pages / any static host) and it just runs.

    index.html
    404.html           SPA fallback (copy of index.html)
    favicon.ico
    .nojekyll
    run-local.cmd      local preview (not needed once deployed)
    assets/            ~1.8 MB total

## Deploy to GitHub Pages

    git init
    git add .
    git commit -m "VC web port"
    git branch -M main
    git remote add origin https://github.com/<you>/<repo>.git
    git push -u origin main

Then: repo -> Settings -> Pages -> Source: "Deploy from a branch" -> `main` / `/ (root)`.

Works at both `https://<you>.github.io/` and `https://<you>.github.io/<repo>/` —
every path in the build is document-relative, so no base-path configuration.

## What was changed from the downloaded copy

1. **Removed the redirect.** `index.html` shipped with a guard that bounced any
   hostname other than `localhost` / `127.0.0.1` back to `https://quenq.com`.
   That is why opening the saved page did nothing. It's gone.

2. **Made all paths relative.** The original referenced `/assets/...` from the
   site root, which only works if the page is hosted at the domain root. Fixed in
   `index.html`, `assets/index-DzSA9k2A.js` and `assets/js/game.js`.

3. **Un-hardcoded the router base.** The Vue router was built with
   `createWebHistory("/")`, so at `https://<you>.github.io/<repo>/` no route
   matched and the page rendered blank. It now derives the base from
   `location.pathname`, which works at any depth.

4. **Added `404.html`** (a copy of `index.html`). The Save/Mod managers are
   client-side routes; without this, reloading on `/save` would 404 on GitHub
   Pages. Also added `.nojekyll` so Pages serves the folder verbatim.

5. **Pointed the game data at the origin CDN.** See below.

## Where the game data comes from

Only the ~1.7 MB app shell is in this folder. The actual game is not:

| What | Size | Where it comes from |
|---|---|---|
| App shell (html/js/css) | ~1.7 MB | this folder |
| `vc-sky-en-v6.wasm` | 7.6 MB | `vc.quenq.com` |
| `vc-sky-en-v6.data.00`–`.06` | ~135 MB | `vc.quenq.com` |
| Streamed map models, skins, audio | on demand | `vc.quenq.com` |

The engine streams map chunks, vehicle/ped models and audio as you move around
the world — that's why parts of the map pop in while playing. Those requests are
issued by the wasm against `cdn.dos.zone` and rewritten at runtime.

`vc.quenq.com` serves all of it with `Access-Control-Allow-Origin: *`, so a static
page on another domain can fetch it directly. One constant controls this, at the
top of `assets/js/game.js`:

```js
const REMOTE_BASE = "https://vc.quenq.com/vcsky/";
```

The 135 MB downloads once per visitor and is then kept in the browser's Cache
Storage, so repeat visits start fast. Saves live in IndexedDB.

**This hotlinks someone else's CDN.** It costs them bandwidth for every visitor
you send, and it breaks the day they move or block it. To self-host instead,
mirror `https://vc.quenq.com/vcsky/` into a `vcsky/` folder next to `index.html`
and set `REMOTE_BASE = "vcsky/"` — but note that's ~150 MB, over GitHub Pages'
recommended 1 GB repo limit only in aggregate, though well past what Pages is
meant to serve. A cheap object store (R2/B2/S3) is the better home for it.

## Testing locally

**Double-click `run-local.cmd`.** It serves the folder and opens your browser.

Do not open `index.html` directly. A `file://` page shows a white screen and
cannot be fixed by editing the files — on a `file://` origin browsers block
module scripts (CORS, origin `null`), Cache Storage does not exist, and Chrome
blocks IndexedDB. This port needs all three. It must come off an HTTP origin.

GitHub Pages serves over HTTPS, so none of this affects the deployed site.

Any static server works if you'd rather not use the launcher:

    python -m http.server 8777
    npx serve .

## Known rough edges

- Deep-linking to `/save/` or `/mods/` *with* a trailing slash breaks relative
  asset resolution. Without the slash (`/save`, `/mods`) it's fine, and that's
  what the in-app buttons produce.
- First load pulls 135 MB. Until it lands, the loading bar is the only feedback.
