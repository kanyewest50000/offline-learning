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
the casino floor, a stack of wood each, biggest pile at the buzzer). The last two
seat two, three or four.

A round of Tung, Wood, Fire is two hidden picks resolving into one outcome, and
it is shown as exactly that: the two moves slide in from opposite sides onto the
same line, meet, and the loser is taken out of the world. A tie has nothing to
resolve, so the two rebound and it is played again. The Cut has nothing to play
at all — both cards are decided before either is shown — so its whole experience
is the wait: the deck is cut, your card stirs and turns over slowly, and you sit
with it for three full seconds while theirs shivers under a sheen before it
turns. The result is held behind the second card, because knowing it early is
the one thing that would make the pause worthless.

Competitive Gambling is the one where the pit is not the game. Everyone at the
table is handed the same stack of wood and turned loose on the whole floor for
three minutes — every table, not a sprint corner of them — and whoever is
sitting on the biggest pile when the clock stops takes the pot.

A cut wants a body in the other chair and there is not always one about, so the
host can **call tung** into it. One call is one chair and he can be called again
for as long as a chair is empty, so a four-seat cut with nobody around is the
player against three of him. He is seated already confirmed, because he is
always ready. What he is not is a member: no account, no balance,
no lock. That makes a table he is sitting at a house table wearing the pit's
clothes, and it changes exactly one thing, which is the money. His stake is the
house's, so the pot pays the house's 0.1% edge, the same as the wheel. Between
players there is no rake and never will be. The table says which it is.

The Cut and Competitive Gambling both seat two, three or four; Tung, Wood, Fire
is a hand against one opponent — its rounds, its score and its forfeit rule are
all written for a pair — so it stays two however many a client asks for. A table
waits, and can still be taken down, until its last chair is filled.

Finishing level at the top is not a void: the players on the biggest pile split
what is on the table. Each share is the gap between two floored running totals,
so no share is ever rounded up and they add back to exactly the pot — nothing
minted, nothing left behind. With everyone level that pays each player their own
stake back, which is what a refund used to do; the difference shows at three and
four, where two players can tie above a third. They take the pot between them and
the one who lost stays lost, rather than being handed their stake back for it.

Running the wood out ends a two-player round there and then. At three and four it
usually does not: the rest of the table still has its clock, and one player going
broke must not cut that short — so a bust ends the round only once there is
nobody left to play against. Deciding that means reading whether the others still
have a stake out on the floor, and every record read joins the guard on the
commit, so a hand dealt anywhere between the decision and the commit makes the
commit fail and the call is taken again.

There is one exception that matters throughout: a stake still sitting on a table
is not spent, it is unread. A player
who puts their last wood on a mines board is on zero and still in it, because
the board can pay; the round ends when the board is read, not when it is dealt.
That is taken off the game records themselves rather than off a counter, so two
deals racing each other, a hand replaced by another, or a record that expired
cannot leave a phantom stake behind that makes somebody unbustable. The flip
side is the buzzer: a hand still open when the clock stops is a stake paid and
never played, and it scores as spent. Otherwise the last ten seconds of every
round would be worth a free look at a hand you could abandon.

For the three minutes a round is running, the players at that table get a small
chat of their own. It is not the shrine's chat and shares nothing with it — no
history, no reactions, no retention, no webhook. The whole conversation is one
value held under the round, which is what lets the commit that settles the round
delete it in the same breath: there is no window where the round is over and the
talk is still readable, and nothing to sweep afterwards. It reaches the players
wherever they are standing, because the round does: the table's own page shows
it open, and out on the floor it is a drawer under the round bar. A chat ban
closes it, the way it closes the shrine's chat, while leaving the tables open.

Wood is not sahurs and never becomes sahurs. It is handed out by the round,
spent against the house inside it, and swept when the round ends; the only thing
that crosses back is the pot, which is the real stakes and was escrowed
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

Plinko's board takes several balls at once. Each drop is its own request and
the server holds no plinko state, so they cannot interfere; the client just
stopped locking its button. The fall is a frame loop rather than a slide down a
wire — a ball crosses at a steady rate, falls with y going as t squared so it
accelerates the way a dropped thing does, and kicks off each peg it clips, which
is the part that reads as a bounce. None of that can move a ball: the waypoints
are computed from the server's own left/right path before a frame is drawn, and
the last of them is the exact centre of the bucket that path adds up to.
`scripts/test-plinko-balls.ts` checks every one of the 256 paths through an
8-row board and a few hundred each at 12 and 16, all landing dead on centre.

## leaving a table mid-game

Mines, beef and blackjack outlive the page they were dealt on. The stake goes on
the deal and the board is held server-side for `GAME_TTL`, so closing the tab
never ended a game — but nothing ever read one back, which made it look exactly
like losing it, and the next deal would overwrite the board and take the stake
with it. Worst at the very start: deal a mines board, touch nothing, come back,
and the stake was gone without even a half-played board to show for it.

`GET /cas/resume` is the way to ask. Each of the three views calls it on the way
in and paints whatever it finds — the board, the lane, the hand — and mentions
it if the open game belongs to one of the other two, so a board is never left
open on a screen nobody is looking at. It answers with the same shaping the
game's own replies use mid-play, so a resumed table can never show more than a
played one: never the mine layout, never the lane the cow dies in, never the
dealer's hole card.

## the bank

A third button in the casino header, next to the Shrine and the Shop: the **Bank
of Tung**. It is the shrine's altar next door and reads like one —
one character, one thing he does, one button — except the shrine gives and the
bank lends.

The face behind the counter is rolled fresh each time the page opens: `BANK_IMG`
nine times in ten, `BANK_RARE_IMG` the other one. Both paths and the odds
(`BANK_RARE_CHANCE`) sit together in `assets/js/shrine/config.js`.

Borrow up to your cap and you owe the loan plus ten percent, added once at
signing, so what you owe never moves again except downward. One debt at a time:
topping a loan up would mean charging interest on interest or tracking each
slice's own rate, and neither is worth it for a tenner. Pay it back in part or
in full whenever you like — or do not, and the bank takes half of every Shrine
of Sahur claim until it is square. On a garnished claim the win toast shows the
five that landed and says what the other five went to.

Two things it will not do. It never takes more than is still owed, so the last
claim of a loan hands the remainder back to the player rather than overpaying
the debt. And a loan and the sahurs it puts in your hand are one commit, as are
a claim's payout and the debt it pays down — there is no instant where a debt
exists that was never paid out, or a player is paid without the debt moving.

The cap is ten sahurs by default. Each member can be given their own on the
**Casino balances** pane of `/admin`, which also shows what they currently owe
and can write that debt straight to the ledger — no interest is added by the
correction, and zero wipes it;
zero shuts the bank to them, and clearing the field puts them back on the house
default rather than pinning them to whatever it is today.

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

A skin is a palette, not a stylesheet. `assets/js/shrine/styles.js` holds one
list of every surface a theme repaints, written once with braced token names
where the colours go, and stamps a palette into it per skin — so adding a theme
is a few colours in `assets/js/shrine/config.js` and no CSS at all, and it
cannot miss a surface, because every skin is generated from the same list.

A palette wants three colours — `bg` the ground, `text` the ink, `accent` the
colour the skin is actually about — and the rest of the ramp (panels, borders,
hovers, the muted greys, the solid buttons) is mixed from them. The accent is
spent on the text ramp rather than blended into the surfaces, which is where the
wood spends its orange, so a skin with nothing but an accent still reads as that
colour instead of as another grey. An accent too close to its own ground to be
read is walked toward the ink until it clears. Any single token can be spelled
out to override what the mix would have chosen: **Dark Mode** pins all of its
own, because it was hand-picked before the engine existed — and
`scripts/test-theme-engine.ts` checks it comes back out of the engine exactly as
it went in, along with the promise that three colours fill every token.

The other half of a skin is a row in `SHRINE_THEMES` in `server.ts`, which is
what decides whether it is free or has to be bought; the two lists have to
match, and that test checks it.

## admin

The admin key never travels in a URL. `/admin` is a small door — it is also an
egress guard, so a scanner that finds it gets 800 bytes rather than the 37KB
panel — and the panel itself comes back from a POST, written into the page the
door is already on. The address bar says `/admin` the whole way through, and
every read the panel makes carries the key in an `x-admin-key` header, so it
reaches no history entry, no bookmark and no access log. An old bookmark with
`?key=` on it is redirected to the bare path rather than served. The query
parameter is still accepted, because the scripts in `scripts/` pass it that way
from a terminal, where none of those exposures apply.

`/admin` has a **Post as…** pane: drop a line into the chat under an approved
member's name, or as tung, who posts with his own mark. It is the one place in
the app where a message's author is not the account that sent the request —
key-gated, and the name still has to belong to somebody real.

There are two bans on the **Manage users** pane and they are not the same ban.
**ban** shuts the whole shrine: chat, casino, the pit, the veil, everything.
**ban from chat** shuts the room and only the room — they cannot read a line and
cannot post one, while the casino, the pit, the catalog, the shop, tips and the
veil keep working exactly as before. Server-side the two are separate flags on
the account and separate gates: `blockState()` is the wide one every other part
of the app asks, `chatBlock()` is the one every chat route asks, and the chat
routes are the only ones allowed to use it. Nothing else may reach `chatBlock()`
and no chat route may skip it — that is what keeps a chat ban from quietly
becoming a full one, or a full one from leaving the room open. Setting one flag
never touches the other, and lifting one never lifts the other; a live timeout
or a full ban outranks the chat ban in what the banned member is told, and the
chat ban is still there when either is lifted. `scripts/test-chat-ban.ts` walks
all of it — both halves of the room shut (including a giveaway claim, which
announces the claimant by name, and including a request that pads itself with
the admin key to try to widen the history window), everything else still open,
and the room handed back when the ban is lifted.

`scripts/test-*.ts` are standalone `deno run --allow-read` checks; the ones that
read source go through `scripts/shrine-sources.ts` so they keep working when a
chunk moves file. `scripts/refresh-games.sh` re-vendors the gn-math loader
stubs, and `tidy-games.js` rewrites the `GAMES` array in
`assets/js/shrine/games-catalog.js`.
