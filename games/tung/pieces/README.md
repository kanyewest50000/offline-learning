# The chess piece set

Drop twelve PNGs in this folder and both boards — the game against the computer
in `../chess.html` and the chess table in the pit — start using them. Nothing
else has to change: each board probes for `wP.png` once when it opens, and falls
back to the Unicode glyphs if it is not there, so an empty folder is not a
broken board.

## The names

The usual ones, so a set downloaded from anywhere is probably already named
right. Colour first, then the piece letter, uppercase:

```
wP.png  wN.png  wB.png  wR.png  wQ.png  wK.png     white
bP.png  bN.png  bB.png  bR.png  bQ.png  bK.png     black
```

`P` pawn, `N` knight, `B` bishop, `R` rook, `Q` queen, `K` king.

## What they should be

- **Transparent background.** The square's colour shows through; a white or
  green backing will look like a sticker on the board.
- **Square, and the same size as each other.** They are drawn with
  `object-fit: contain`, so an odd one out is scaled rather than cropped, but a
  set that does not agree with itself looks it.
- **Big enough.** A square is about 77 CSS pixels at the largest board size, so
  on a 2× screen the image is painted at ~154. **256×256 is a good size** —
  bigger is wasted bytes, smaller goes soft.
- **SVG would be better if you have it.** It scales perfectly and is usually
  smaller. If you want to use SVGs instead, the only change needed is the `.png`
  in `pieceFile()` in `../chess.html` and `pcFile()` in
  `assets/js/shrine/casino.js`.

Keep the whole set under a few hundred KB. They are served as static files from
the same host the games are on, and cached after the first load — they never
touch the backend.

## Licensing

If you take a set from somewhere, check what it is licensed under and keep the
licence with it, the way `../stockfish/Copying.txt` sits next to Stockfish.
