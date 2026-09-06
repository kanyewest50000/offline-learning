# Embedded Shrine chat

Chat-only slice of the Shrine of Tung. No games launcher, no casino, no shrine faucet, no chooser.

## Direct embed (this repo)

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

## Obfuscated embed (secondary repo)

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
