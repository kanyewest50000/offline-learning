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
  config.js               backend URL, the base the repo's own files are found
                          under, artwork, ace mark, cloaked labels
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
embed/                  standalone embeds for other hosts: the chat on its own,
                        and the whole shrine from one script tag
games/                  vendored game files served from this origin, fetched
                        into their own tab rather than framed
scripts/                tests and maintenance tools
```

Each shrine module hangs itself off `window.Shrine`; nothing opens on its own.
`window.js` is the only file that knows how to put the pieces together, and it
has to load last. The shrine window is written with `document.write` into an
`about:blank` popup, so its stylesheet and its two clients travel as strings
rather than as `<link>` and `<script src>`.

The casino is members-only and the chooser reflects that: its tile ships hidden
and is only put back once `/status` answers `approved`, so somebody still
waiting on their application never sees a casino at all. That is presentation —
the gate itself is `casUser()`, which refuses every table, the pit, the shop and
the faucet to a token that has not been approved, so unhiding the tile from
devtools buys nothing.

Outcomes are the server's, never the client's: the casino code only sends bets
and paints whatever `server.ts` replies, so editing it in devtools changes
nothing. The same rule runs through the chat — a reply quotes a message by id
and the server fills in what that message actually said, and whether a reaction
is yours is a fact the server holds — so neither the words above a reply nor the
number on a reaction chip can be set by whoever sent the request.

## opening a game

A catalog title used to be an `<iframe>` pointed at the game. Networks that
refuse to frame things refuse the whole catalog that way, and a refused frame
is a black rectangle with nothing to catch — so the game is fetched and written
into its tab as the whole document instead. The same bytes over the same
origin rules, arriving as an ordinary page load rather than as a frame.

The whole document, not a container: half of these call `document.write` while
they load, and the Unity and Godot loaders read `location` and
`document.baseURI`. Handed the whole document they behave exactly as they would
if you had navigated to them, which is the only thing that works across all of
them. An `about:blank` popup reports its opener's URL, so `location` is a real
one — the reason this is not a `srcdoc` frame, which reads `about:srcdoc` and
hangs those loaders at 0%.

Relative assets still have to resolve. The 777 gn-math stubs carry an absolute
`<base href>` of their own, pointing at wherever their wasm lives, and keep it.
The rest are folders of relative files and are given their own folder as a base
on the way in — without which a game would look for `index.js` next to the
shrine. `scripts/test-game-fetch.ts` runs both helpers for real.

If the fetch is the thing that cannot get through — a cross-origin embed whose
host sends no CORS header, say — the frame is still there to fall back to,
rather than a blank tab.

## the shrine somewhere else

Because `window.js` builds the whole shrine as one string, the shrine does not
actually need this site. `embed/shrine.js` is that fact made usable: one script
tag, pasted into Replit, w3schools, a CodePen, anything that runs JavaScript.

```html
<script src="https://cdn.jsdelivr.net/gh/kanyewest50000/offline-learning@main/embed/shrine.js"></script>
```

Two hosts are in play there and they are not interchangeable. The **code** — the
eight modules, about 90KB gzipped — can come from a CDN, and jsDelivr serves
`.js` with the right content-type. The **files** — the artwork, the originals,
the 830 vendored games — cannot: jsDelivr hands `.html` out of `/gh/` as
`text/plain`, so a game fetched from it arrives as its own source code instead
of rendering. Those stay on Pages.

`Shrine.BASE` is what keeps the two straight. Every repo path any module builds
is resolved against it rather than against the page, so the one value decides
where the shrine looks for its own things: the artwork in `config.js`, the three
originals, the 777 catalog entries remapped onto `games/g/`, and the game URL
baked into the emitted chat client. On this site it is the page's own folder
and nothing has changed. Pasted elsewhere, `embed/shrine.js` sets
`window.SHRINE_BASE` before the modules load and points all of it back here —
without which a catalog would quietly resolve 777 games onto a stranger's
domain. `?base=` does the same for a one-off test. `scripts/test-shrine-base.ts`
holds that down from both ends: the default must not move, and nothing in the
finished document may name the host it was pasted into.

The login key is per-origin, because localStorage is. Somebody using an embed
logs in on that host once with the key they already have; the backend answers
`access-control-allow-origin: *`, so it does not care where they are. Games open
with `window.open`, so a sandboxed frame without `allow-popups` gets the chat,
the casino and the originals but no catalog tabs.

### getting a push to the people running it

The script tag points at `@main`, which is a branch and therefore a moving
target — and a CDN will not go back to GitHub on every request to see whether it
has moved. jsDelivr holds a branch URL at its edge for hours, and the browser
that fetched it holds a copy for longer than that. Neither is a bug; both mean
somebody who opened the shrine last week is still running last week's shrine.
That is how a friend ends up on a copy with no poker in it.

Asking politely does not work, so the URL changes instead. The embed's first act
is `GET /version` on the backend, which answers with the current deployment's id
and is the one route in the whole system served `no-store` — if that went stale
it would pin everything else to whatever it last said. Every module is then
loaded with `?v=<that build>` on the end. A new deployment is a new set of URLs,
so nothing any cache is holding can answer for them; between deployments the
URLs are identical and every cache keeps working exactly as it did. If the
backend cannot be reached the tag falls back to the current hour, which bounds
the damage without the shrine having to wait on anything — the version request
gives up after two and a half seconds and loads regardless.

`.github/workflows/purge-cdn.yml` is the other half, and the smaller one: on
every push to main it calls jsDelivr's purge API for the embed and the eight
modules, so the CDN edge is current too rather than revalidating lazily behind
the new URL. It is deliberately not allowed to fail a build — the version tag
already gets the new code to everybody; purging only makes the first request
for it faster.

`scripts/test-shrine-base.ts` runs the embed against a fake page and looks at
what it appends: every module has to carry the build the backend reported, two
different builds must not be able to name the same URL, and with no backend at
all it still has to load, still tagged with something that moves.

## direct messages

Beside the room is a rail of conversations, and the room is the first row in it.
Clicking a name in the chat opens that member's profile card, which now has
**send a message** on it next to the tip button; picking it swaps the pane over
to a conversation with them and leaves the room where it was, because the room
and a DM are the same pane wearing different contents — the header renames
itself, the composer's placeholder names who it is writing to, reactions and
replies go away (there is nobody else to react in front of), and going back to
the room replays it from the top rather than resuming a half-scrolled log. Each
row carries the newest line and, if it has not been opened, a count; the rail
sorts by who spoke last. Below 760px it is the first thing to go, because the
room still works without it.

A DM is not the room with a filter on it. The room is one append-only stream
everybody reads; a conversation is a stream of its own and the pair it belongs
to is the key, sorted so both ends name the same one. That is the whole access
story: the only conversation ids that exist are built out of two member ids, so
the only ones you can name are the ones you are in, and there is no per-message
check for somebody to forget to write later. A line and both sides' view of the
conversation are one commit, so a message cannot exist without appearing in the
list that points at it, and the list cannot promise a line that was never
written. The sender has by definition read their own line; the recipient's read
mark is left exactly where it was, and the difference between it and the
conversation's counter is the number on the badge. Opening a conversation is
what clears it — there is no second call to forget — and the mark only ever
moves forward, so a stale poll cannot un-read anything. A conversation ages out
after a month of silence.

The chat ban covers all of it, in both directions. Somebody shut out of the room
can neither send a DM nor be sent one: their own three routes answer `chatban`
like every other chat route, and anybody writing to them is told the
conversation is `closed` rather than that they are gone. A ban that left DMs
open would not be a ban, it would be a change of venue, and one that only
stopped them sending would leave everyone else free to talk at them. Lifting it
hands the conversation back exactly as it was — a ban is not a purge, and the
lines refused while it was on were never written. `scripts/test-dm.ts` walks
delivery to one member and nobody else (by name or by id, with a third member
trying both), the badge, the rail's ordering, and both halves of the ban.

## the pit

Four tables in the casino where the opponent is another member rather than the
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

The Cut and Competitive Gambling both seat two, three or four, and poker goes to
five; Tung, Wood, Fire is a hand against one opponent — its rounds, its score
and its forfeit rule are all written for a pair — so it stays two however many a
client asks for. A table waits, and can still be taken down, until its last
chair is filled.

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

### poker

The fourth table, and the only one that does not resolve in a single stroke.
Two to five seats, no limit hold'em: everyone buys in for the same stake, is
handed a thousand chips, and plays until one of them holds all of them. The
buy-ins are escrowed by the same create-and-join every other table uses and are
released to the last player standing by the same `commitDuel()`, so nothing new
touches anybody's balance.

The chips are the wood again under another name — dealt by the table, moved
around inside it, gone when it ends. What makes them different is that they have
to survive dozens of hands, so the whole tournament is carried on the duel
record and moves with the same atomic commit the escrow rides.

The blinds are what make it end. They step up every three minutes and are
250/500 at eighteen, then keep going to 1000/2000 — at which point a starting
stack is half a big blind and the hands play themselves. Without that, a
tournament nobody is winning would sit in the pit all night holding five
people's sahurs.

Hole cards are hidden the way a move in Tung, Wood, Fire is hidden: you are sent
your own two and nobody else's, and the rest of the table arrives as a count of
face-down cards rather than as cards. A showdown is the only thing that turns
them over, and the finished hand then stays up for a few seconds before the next
is dealt — otherwise paying the pot, busting the empty and dealing again all
happen in one pass, and the cards that won are cleared before anyone can see
them.

Two rules are worth writing down because both of them read as bugs from the
seat. **The hole card plays.** Two hands that miss the board are separated by
the best card either of them is holding, and an ace on the board belongs to
everyone, so it separates nobody: K-J beats 10-J on an ace-high board, and the
only way that hand chops is if the five on the board are the best five for both
— which means it is a straight or better, never still reading as high card.
**A raise has to be at least as big as the last one**, which is not the same as
double the bet. The first bet on a street sets its own minimum, so a bet of 100
into an unopened pot can only be raised to 200; but a raise to 100 over a blind
of 50 was a raise of 50, so it can be re-raised to 150. The raise panel prints
the minimum and, behind a `?`, the arithmetic it came from, because a table that
just refuses a number looks broken.

An uncalled bet is not a pot and was not won. When a shove is called for less,
the part nobody matched is pushed back to whoever put it out before the hands
are compared, the way a dealer does it. Left in, it still reaches the right
stack — the side-pot maths hands it back as a pot only its owner can win — but
it arrives looking like winnings, which puts the loser of the hand in the list
of winners and announces a pot taken outright as a split. Chips a player left
behind when they folded are a different thing: those were matched, so they are
won, and the push-back is measured against them.

Nothing runs on a timer here either. A player who says nothing checks if it is
free and folds if it is not, and the next hand deals itself, both off the same
lazy deadline every other table uses. `scripts/test-poker.ts` plays 2-, 3-, 4-
and 5-handed tournaments out over the wire and counts the chips on every look at
the table: what is in the stacks plus what is in the pot has to equal what was
dealt, through every side pot an all-in cuts. It also asserts a run actually
reached a showdown, because one that never does has proved nothing about the
hand rankings however green it looks. Alongside that it runs the real
`pokerFinishHand()` out of `server.ts` — not a copy of what it does — over the
four settlements that have to come out differently: an uncalled bet, a board
that plays, dead money from a folded player, and an ordinary called pot.

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

## the tables, and how fast they move

Dice, limbo, roulette and plinko all animate an outcome the server has already
decided, so how long the animation takes is free. They take their time by
default — the wheel slowing down and the plinko ball picking its way through
the pegs is most of what there is to watch — and each carries a lightning
button that speeds them up. It is **one** setting, shared by all four and
remembered between visits, because turning it on per game would be maddening.
Mines, beef and blackjack have no button: there you are the slow part.

`pace(slow, fast)` is the only place the setting is read, and
`scripts/test-table-pace.ts` checks that every call to it sits on a line that
picks a duration or a number of wheel turns — never anything a wager, a
multiplier or a path depends on. A speed button that could reach the money
would be a cheat button. The roulette wheel takes its durations from two CSS
custom properties the client sets at spin time, rather than a number frozen in
the stylesheet, so the button can reach them.

The roulette felt is the real layout: zero down the left across all three
number rows, the numbers in the rows a table actually uses (3, 6, 9… along the
top), and every outside bet touching what it covers — each column's box at the
end of its own row, each dozen spanning its twelve, the even-money bets two
columns apiece along the bottom, with red and black wearing red and black
diamonds. Every chip states its odds. The part that can silently go wrong is
the column mapping: `/cas/roulette` pays column *v* when `spin % 3 === v % 3`,
so the row of threes along the top is column **3**, and the test checks the
felt's labels against the server's own rule rather than against a comment.

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
slice's own rate, and neither is worth it at this size. Pay it back in part or
in full whenever you like — or do not, and the bank takes half of every Shrine
of Sahur claim until it is square. On a garnished claim the win toast shows the
five that landed and says what the other five went to.

Two things it will not do. It never takes more than is still owed, so the last
claim of a loan hands the remainder back to the player rather than overpaying
the debt. And a loan and the sahurs it puts in your hand are one commit, as are
a claim's payout and the debt it pays down — there is no instant where a debt
exists that was never paid out, or a player is paid without the debt moving.

The cap is twenty-five sahurs by default, and there are two ways to move it,
both on the **Casino balances** pane of `/admin`. **Set loan cap** is the
permanent one: it is their cap until it is set again, zero shuts the bank to
them, and clearing the field puts them back on the house default rather than
pinning them to whatever it is today. **Grant one-time** is the other: an extra
that sits on top of whatever the cap is and is spent the moment they borrow —
whatever size that loan turned out to be — so "go on, just this once" cannot
quietly become a new ceiling. The bank screen shows the two apart, as a cap and
a *this once*, for the same reason. An unspent one can be taken back.

The one-off comes off in the same commit that writes the loan, so two borrows
racing cannot both lean on it. The same pane shows what each member currently
owes and can write that debt straight to the ledger — no interest is added by
the correction, and zero wipes it.

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
cannot post one, and their DMs go with it in both directions, while the casino,
the pit, the catalog, the shop, tips and the veil keep working exactly as
before. Server-side the two are separate flags on
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

**Moderators** are the third switch on the same card, and the only one that
hands power out rather than taking it away. A moderator gets a bin next to the
react and reply buttons on every chat message and can delete any of them;
`POST /delete` refuses everybody else, including somebody whose flag was taken
back and somebody barred from the room. A delete is not a hidden flag on the
line — the `["ev", seq]` entry stops existing, so a fresh open never replays it,
the `["msg", id]` quote index goes with it, so the line can no longer be quoted
or reacted to, and a `del` event tells every client already holding it on screen
to drop it. The flag itself is deliberately invisible: it rides on `/status` and
`/login` to the account that holds it and on `/admin/users` to this page, and
nowhere else — no event, no reaction, no profile and no room dump carries it, so
nobody in the chat can work out who the moderators are.
`scripts/test-moderation.ts` walks both halves: the bin works and only for
moderators, and every route another member can read is checked for the flag.

The chat polls `/events` every 4 seconds while the tab is visible, and not at
all while it is hidden.

`scripts/test-*.ts` are standalone `deno run --allow-read` checks; the ones that
read source go through `scripts/shrine-sources.ts` so they keep working when a
chunk moves file. `scripts/refresh-games.sh` re-vendors the gn-math loader
stubs, and `tidy-games.js` rewrites the `GAMES` array in
`assets/js/shrine/games-catalog.js`.
