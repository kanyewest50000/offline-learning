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
                          plinko, blackjack, mines, beef, the pit, shop, faucet)
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
nothing. The same rule runs through the chat — a reply quotes a message by id
and the server fills in what that message actually said, and whether a reaction
is yours is a fact the server holds — so neither the words above a reply nor the
number on a reaction chip can be set by whoever sent the request.

## the pit

Three tables in the casino where the opponent is another member rather than the
house: **Tung, Wood, Fire** (tung splits the wood, the wood feeds the fire, the
fire takes tung — first to two rounds, a tie is replayed), **The Cut** (one
card each, high card takes it) and **Competitive Gambling** (three minutes on
the casino floor, a stack of wood each, biggest pile at the buzzer).

A round of Tung, Wood, Fire is two hidden picks resolving into one outcome, and
it is shown as exactly that: the two moves slide in from opposite sides onto the
same line, meet, and the loser is taken out of the world. A tie has nothing to
resolve, so the two rebound and it is played again. The Cut has nothing to play
at all — both cards are decided before either is shown — so its whole experience
is the wait: the deck is cut, your card stirs and turns over slowly, and you sit
with it for three full seconds while theirs shivers under a sheen before it
turns. The result is held behind the second card, because knowing it early is
the one thing that would make the pause worthless.

Competitive Gambling is the one where the pit is not the game. Both players are
handed the same stack of wood and turned loose on the whole floor for three
minutes — every table, not a sprint corner of them — and whoever is sitting on
the bigger pile when the clock stops takes the pot. A dead heat is nobody's win
and both stakes go home.

Running the wood out ends the round there and then, with one exception that
matters: a stake still sitting on a table is not spent, it is unread. A player
who puts their last wood on a mines board is on zero and still in it, because
the board can pay; the round ends when the board is read, not when it is dealt.
That is taken off the game records themselves rather than off a counter, so two
deals racing each other, a hand replaced by another, or a record that expired
cannot leave a phantom stake behind that makes somebody unbustable. The flip
side is the buzzer: a hand still open when the clock stops is a stake paid and
never played, and it scores as spent. Otherwise the last ten seconds of every
round would be worth a free look at a hand you could abandon.

Wood is not sahurs and never becomes sahurs. It is handed out by the round,
spent against the house inside it, and swept when the round ends; the only thing
that crosses back is the pot, which is the two real stakes and was escrowed
before the round began, so three minutes of this cannot move a sahur in either
direction. Which purse a wager comes out of is read off the player's own duel
lock on every bet rather than sent with it, so a wager cannot be aimed at the
cheap money — and one cannot be aimed at somebody's sahurs from inside a round
either. A bet does name the round it believes it is in, but that can only ever
refuse a wager: it is there so a roll meant as wood does not land on real sahurs
because the buzzer went while the player was reaching for the button.

A hand, a board or a walk outlives the request that dealt it, so each one
carries the stake it was dealt from and settles back into that: a hand dealt in
sahurs still pays sahurs after a round has started on top of it, and a hand
dealt in a round that has since ended pays into nothing, because its wood was
swept with the rest. A round will not deal over a game that is holding real
sahurs — it says so and asks you to finish that one first — since replacing it
is how the casino has always started a fresh game, and a round must never be the
thing that throws a real stake away. Retiring one of those records and moving
the wood it owes is a single commit, so a hand cannot be cashed out twice.

The round follows the player rather than waiting on the table's page: a strip
over every casino screen carries both stacks and the clock, both live, and the
result finds them wherever in the casino they are standing when it stops. The
header keeps showing sahurs the whole time, because that number is never once a
lie.

The stack on that strip is held while a table is still showing a wager. The
server answers a bet the instant it is decided, which on every table here is
well before the player has seen it happen, and painting that number as it
arrived would give the wheel away while it was still spinning, the cow away
mid-lane and the dealer's hole card away before he turned it. So the stake comes
off the pile when it goes out and the rest lands when the table says it has
finished — and the poll keeps its hands off in between, since all it knows is
the answer.

Opening a table takes you to its own page, and the way to take it down is on
that page: a countdown to when it closes itself and a button that hands the
stake straight back — once. Both stakes are debited the moment a player
commits and from then on the sahurs live in the duel record, not in anybody's
balance. Every way out — a win, a
cancel, a table nobody joined inside ten minutes, a confirm nobody gave inside
ten seconds, a player who wandered off mid-round — goes through one function
that writes the settled record and the credits it implies in a single atomic
commit. So a duel can never read as finished without the money having moved, and
it can never pay twice. Nothing is raked: whatever went in comes back out.

Nothing runs on a timer. The clocks are enforced lazily — every read of a duel
settles an overdue one first, and the lobby sweeps abandoned tables — so a stake
always finds its way home even if the host never reopens the page.
`scripts/test-duel.ts` walks every exit and counts the money after each, with a
dozen readers racing the same expiry.

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

`WISDOM_MIN_MS` and `WISDOM_MAX_MS` (default 45m / 2h) bound the gap between two
Wisdoms of Tung — the lines he drops into the chat on his own. He only speaks
into a room that is already talking, so the roll happens on a real message and
a dead chat stays dead. Set both to a couple of seconds to watch one happen.

One line in five is a giveaway instead: the same voice, but with a button under
it worth `WISDOM_GIFT_AMOUNT` sahurs (default 50) to whoever reaches it first.
`WISDOM_GIFT_CHANCE` (default 0.2) sets the odds; 1 makes every line a giveaway,
which is how the tests force one. The claim and the payout land in a single
atomic commit, so exactly one person can ever win a given gift and the winner is
paid exactly once — `scripts/test-gift-claim.ts` throws a dozen simultaneous
claims at one gift and counts the money.

## settings and skins

A boxed gear in the top-left of the main menu opens the settings page: the
**theme**, and the **tab disguise** — the title and favicon this window and
every game tab opened from it wear, which used to sit as a bar over the catalog.
The chosen theme is stamped on `<html data-theme>` as the document is written,
so a dark window never flashes the wood first.

Skins are property. Only Tung's Wood is free, and it is also the base
stylesheet, so it overrides nothing. **Every other theme is locked to every
member until tung puts it in the shop and that member buys it** — and that is
the default on purpose: adding a row to `SHRINE_THEMES` in `server.ts` (plus its
block in `styles.js`) ships a skin nobody can wear yet rather than quietly
handing it to the whole shrine. The shop editor on `/admin` scans that registry,
so a new theme appears in its dropdown by itself and only needs a price.

Ownership is per member, lives in KV, and is the server's to state: the settings
page asks `/themes` what it may wear and draws a padlock over anything else, so
a locked skin cannot be selected by editing the client — it simply is not in the
stylesheet that was served. Buying charges once, re-buying is refused rather
than taken as a donation, and taking an item off the shelves does not repossess
what people already bought. `scripts/test-themes.ts` covers all of it.

## admin

`/admin` has a **Post as…** pane: drop a line into the chat under an approved
member's name, or as tung, who posts with his own mark. It is the one place in
the app where a message's author is not the account that sent the request —
key-gated, and the name still has to belong to somebody real.

`scripts/test-*.ts` are standalone `deno run --allow-read` checks; the ones that
read source go through `scripts/shrine-sources.ts` so they keep working when a
chunk moves file. `scripts/refresh-games.sh` re-vendors the gn-math loader
stubs, and `tidy-games.js` rewrites the `GAMES` array in
`assets/js/shrine/games-catalog.js`.
