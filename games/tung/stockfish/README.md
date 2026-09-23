# Stockfish, vendored

`stockfish.js`, `stockfish.wasm` and `stockfish.asm.js` are
[Stockfish.js](https://github.com/nmrugg/stockfish.js) — the
[`stockfish`](https://www.npmjs.com/package/stockfish) npm package, version
10.0.2, which is [Stockfish](https://stockfishchess.org/) 10 compiled to
WebAssembly — copied here unmodified from the package's `src/` folder, so the
shrine never has to fetch an engine off somebody else's host.

It is the **single-threaded** build, on purpose. The one that used to be here
was the multi-threaded `stockfish.wasm` build, which needs `SharedArrayBuffer`;
browsers only allow that on a page served with cross-origin isolation headers,
which a static host does not send, so it never started and every "stockfish"
game was quietly played by tung's own head. This build needs nothing from the
host. `stockfish.js` is the worker the page starts; it loads `stockfish.wasm`
next to it, or `stockfish.asm.js` where WebAssembly is unavailable.

**Stockfish is licensed under the GNU General Public License v3.** The full
text is in `Copying.txt` and stays with these files. The engine is loaded as a
separate program — a Web Worker that the page talks to over UCI messages, the
same arrangement lichess and every other browser front end uses — and it is not
modified. If you fork this repo, keep `Copying.txt` next to the binary and keep
this note.

It is only ever served as a static file, from the same host the games are on.
It never touches the backend.
