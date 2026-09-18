# Stockfish, vendored

`stockfish.js`, `stockfish.wasm` and `stockfish.worker.js` are the
[stockfish.wasm](https://www.npmjs.com/package/stockfish.wasm) build of
[Stockfish](https://stockfishchess.org/), version 0.10.0, copied here
unmodified so the shrine never has to fetch an engine off somebody else's host.

**Stockfish is licensed under the GNU General Public License v3.** The full
text is in `Copying.txt` and stays with these files. The engine is loaded as a
separate program — a Web Worker that the page talks to over UCI messages, the
same arrangement lichess and every other browser front end uses — and it is not
modified. If you fork this repo, keep `Copying.txt` next to the binary and keep
this note.

It is only ever served as a static file, from the same host the games are on.
It never touches the backend.
