the one and only Tung Tung Tung Sahur Learning Website.

special thanks to my good friends Opus and Grok.

## layout

The site is two things wearing one coat. On top is "Untether", a decoy
education-infrastructure marketing site. Underneath is the Shrine of Tung — a
chat room, a casino, a games catalog and Tung's own originals — which opens in
its own `about:blank` window and stays invisible until someone types `tung`
into the impact calculator on the homepage.

```
index.html              the decoy homepage. markup only.
*.html                  the rest of the decoy site (curriculum, pricing, faq, ...)

assets/css/home.css     homepage stylesheet
assets/css/site.css     shared stylesheet for every other decoy page
assets/js/site.js       decoy subpage runtime (nav, forms, accordions)
assets/js/theme-toggle.js   light/dark switch, shared by every page
assets/js/home.js       homepage runtime: imagery, calculator, odometer, and
                        the three doors to the shrine (the "tung" unlock, the
                        staff portrait, the "popup" keyword)

assets/js/shrine/       everything behind the decoy. loaded in this order:
  config.js               backend URL, artwork, ace mark, cloaked labels
  games-catalog.js        the curated catalog (the GAMES array)
  originals.js            Tung's own games, from games/tung/
  chat.js                 chat client source
  casino.js               casino client source (lobby, dice, limbo, roulette,
                          plinko, blackjack, mines, beef, shop, shrine faucet)
  styles.js               the shrine window's stylesheet
  markup.js               the shrine window's <body>
  window.js               assembles the document and opens the window

server.ts               Deno backend: auth, approvals, chat history, balances,
                        every casino outcome. Runs on Deno Deploy, state in KV.
embed/                  standalone chat embed for other hosts
games/                  vendored game files served from this origin
scripts/                tests and maintenance tools
```

Each shrine module hangs itself off `window.Shrine`; nothing opens on its own.
`window.js` is the only file that knows how to put the pieces together, and it
has to load last. The shrine window is written with `document.write` into an
`about:blank` popup, so its stylesheet and its two clients travel as strings
rather than as `<link>` and `<script src>`.

Outcomes are the server's, never the client's: the casino code only sends bets
and paints whatever `server.ts` replies, so editing it in devtools changes
nothing.

## working on it

```
deno run --allow-net --allow-env --unstable-kv server.ts        # backend
deno run --allow-net --allow-read --allow-sys \
  jsr:@std/http/file-server -p 8080 .                           # static site
```

The backend reads four environment variables, set on Deno Deploy under
Settings -> Environment Variables. `ADMIN_KEY` is required to approve anyone.
The two webhooks are optional and independent — shop redemptions and new
applications post to their own Discord channel, and whichever is unset simply
goes quiet.

| variable | what posts there |
| --- | --- |
| `ADMIN_KEY` | — (password for `/admin`) |
| `SHOP_WEBHOOK_URL` | shop redemptions, including anything the buyer typed |
| `APPLICATION_WEBHOOK_URL` | new applications |

`PROXY_URL` is where the shrine's web veil actually goes. It lives in the
environment rather than in this repo so the destination is not sitting in public
source, and the server hands it out only to someone entitled to it.

Reaching it takes two separate yeses, and the URL travels only when both are
given:

1. the global switch on the **Web veil** pane of `/admin`, and
2. that member being approved on the **Manage users** pane, on the web-veil line
   under their timeout controls.

Both take effect immediately, with no redeploy. Miss either and the member gets
a holding page instead — the same page in two wordings, one for a shut veil and
one for a veil that is open but not to them. With `PROXY_URL` unset the veil
stays shut whatever the switch says, so it can never open a blank tab.

`WISDOM_MIN_MS` and `WISDOM_MAX_MS` (default 2h / 6h) bound the gap between two
Wisdoms of Tung — the lines he drops into the chat on his own. He only speaks
into a room that is already talking, so the roll happens on a real message and
a dead chat stays dead. Set both to a couple of seconds to watch one happen.

`scripts/test-*.ts` are standalone `deno run --allow-read` checks; the ones that
read source go through `scripts/shrine-sources.ts` so they keep working when a
chunk moves file. `scripts/refresh-games.sh` re-vendors the gn-math loader
stubs, and `tidy-games.js` rewrites the `GAMES` array in
`assets/js/shrine/games-catalog.js`.
