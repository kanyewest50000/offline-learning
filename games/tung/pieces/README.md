# The chess piece sets

Four themes, named the way chess.com names them:

```
neo        classic        ocean        icy_sea
```

Both boards — the game against the computer in `../chess.html` and the chess
table in the pit — look for each theme in two places, **in this order**:

1. **`games/tung/pieces/<theme>/`**, right here in the repo.
2. **`https://images.chesscomfiles.com/chess-themes/pieces/<theme>/150/`**,
   which is where these came from.

Whichever answers first is used for the rest of the session. If neither is
reachable the boards fall back to the Unicode glyphs, so a blocked network gets
a plain board rather than sixty-four broken images.

## Why local is tried first

This site exists to work on networks that block things, and
`images.chesscomfiles.com` is exactly the sort of host a school filter
swallows — chess.com is a commonly blocked domain. A set sitting in this folder
is the one that survives that; the remote one is a convenience that works until
it doesn't. Hotlinking is also somebody else's artwork on somebody else's
bandwidth, and they can turn it off whenever they like.

**So: to make a theme dependable, put its twelve files here.** Nothing else has
to change — the boards pick the local copy up automatically and stop asking
chess.com about that theme entirely.

## The names

Lowercase, colour then piece, which is chess.com's own convention:

```
wp.png  wn.png  wb.png  wr.png  wq.png  wk.png     white
bp.png  bn.png  bb.png  br.png  bq.png  bk.png     black
```

`p` pawn, `n` knight, `b` bishop, `r` rook, `q` queen, `k` king. So a theme you
have vendored lives at e.g. `games/tung/pieces/neo/wq.png`.

## What they should be

- **Transparent background** — the square's colour shows through.
- **Square, and consistent across the set.** They are drawn with
  `object-fit: contain`, so an odd one is scaled rather than cropped.
- **150×150 matches what the remote set serves** and is plenty: a square is
  about 77 CSS pixels at the largest board size. 256 if you want headroom on a
  2× screen.

## Which theme is showing

There is a **pieces** picker in the lobby of both boards. The choice is kept in
`localStorage` under `shrine-pieces` and applies to the board immediately.

## Licensing

The remote images are chess.com's artwork and are not covered by anything in
this repo. If you vendor a set, use one you are allowed to use and keep its
licence with it, the way `../stockfish/Copying.txt` sits next to Stockfish.
