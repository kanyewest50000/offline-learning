# Embeds

Two of them, and which you want is decided by what you are willing to put on
somebody else's page.

| | `shrine.js` | `chat.html` |
| --- | --- | --- |
| what is on the page | the whole shrine: chat, casino, the pit, 830 games, the originals, the shop and the faucet | chat, and nothing else |
| how it goes in | one `<script>` tag | an `<iframe>` |
| takes over the page | yes, unless `data-mode="iframe"` | no, it is a frame |

`shrine.js` is the one to reach for. `chat.html` is not an older version of it
and is not going away: it is the narrow surface, for a page where you want
people talking but do not want a casino sitting on it. That is a decision about
the host, not about the code, and no attribute on `shrine.js` makes it — the
chooser is in there once the shrine opens.

The price of having both is that `chat.html` is its own implementation rather
than a slice of `assets/js/shrine/chat.js` — roughly 590 lines that reimplement
the same chat. So a rule that lives in the chat lives in two places, and the
tests in `scripts/` are what keep them honest: `test-moderation`, `test-chat-ban`,
`test-login-key-only`, `test-tung-emoji`, `test-chat-timestamps` and
`test-god-combo-limit` each read `chat.html` and assert the embed carries the
same rule as the shrine. Change how chat behaves and expect to change it twice.

## The whole shrine, one script tag

```html
<script src="https://cdn.jsdelivr.net/gh/kanyewest50000/offline-learning@main/embed/shrine.js"></script>
```

That is the entire paste. It works anywhere a script runs — Replit, w3schools,
CodePen — and needs no checkout and no decoy site. About 90KB gzipped arrives
from the CDN; the shrine then replaces the page it was pasted into.

| attribute | what it does |
| --- | --- |
| `data-mode="iframe"` | keep the host page and put the shrine in a full-screen frame over it |
| `data-base="https://…/"` | serve the artwork, originals and games from a fork instead |

Two hosts, and they are not interchangeable. The **code** may come from a CDN.
The **files** — artwork, originals, the 830 games — may not: jsDelivr serves
`.html` from `/gh/` as `text/plain`, so a game fetched from it arrives as its
own source instead of rendering. `shrine.js` sets `window.SHRINE_BASE` to the
Pages URL before the modules load, and `config.js` resolves every repo path
against it, which is what keeps the catalog off whatever host you pasted into.

Mirrors are tried in order — whoever served `shrine.js`, then jsDelivr, then
statically.io, then Pages — so one blocked CDN is not the end of it. Pin `@main`
to a commit once a version is worth keeping: jsDelivr holds a branch URL for
about 12 hours, so until then a push lands somewhere between now and tomorrow.

Two things worth knowing before you hand the line to anyone:

- **The login key is per-origin**, because localStorage is. People log in on
  that host once with the key they already have. The backend answers
  `access-control-allow-origin: *`, so it does not mind where they are.
- **Games need popups.** They open with `window.open`, so a sandboxed frame
  without `allow-popups` — w3schools' result pane, most likely — still gets the
  chat, the casino and the three originals, but catalog tabs will not open.

Local dry-run against a backend on your own machine:

```html
<script src="/embed/shrine.js" data-base="/"></script>
<!-- then load the host page with ?api=http://127.0.0.1:8000 -->
```

## The chat on its own

Chat-only slice of the Shrine of Tung. No games launcher, no casino, no shrine faucet, no chooser.

### Direct embed (this repo)

Iframe this page:

```html
<iframe
  src="https://kanyewest50000.github.io/offline-learning/embed/chat.html"
  style="width:100%;height:100%;border:0"
  allow="clipboard-write"
></iframe>
```

People log in with **username + login key** (the same `rid(24)` token stored as `shrine-token-v1` on the main shrine). Copy the key from the pending screen, or with **copy login key** once inside chat.

`?api=` overrides the backend (local testing): `embed/chat.html?api=http://127.0.0.1:8000`

### Obfuscated embed (secondary repo)

You cannot hide that the chat *code* comes from this project, but you can hide the GitHub Pages URL you hand to people.

1. Copy `loader.html` into another GitHub Pages repo (or any static host). Renaming it to `index.html` is fine.
2. Leave `CHAT_SRC` pointing at this project (jsDelivr by default), or set it to a pin:
   `https://cdn.jsdelivr.net/gh/kanyewest50000/offline-learning@<commit>/embed/chat.html`
3. Share **the other site’s URL**. The loader fetches the chat and `document.write`s it so the address bar stays on the other host.

Fallbacks already in the loader: jsDelivr → statically.io → this repo’s GitHub Pages.

Local dry-run of the same trick:

```html
<iframe src="/embed/loader.html?src=/embed/chat.html&api=http://127.0.0.1:8000"></iframe>
```
