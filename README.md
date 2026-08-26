# HexWW2.world — Earth on a hex globe

The board layer for an online strategy game: planet Earth on 1 September 1939,
on a hexagonal grid wrapped around the sphere itself — the population of the
world, what the land produced, and who held it.

```bash
npm install
npm run build
npm start                 # the game on http://localhost:5170
npm test                  # the rules, under plain Node

# or, while working on it, two processes:
npm run server            # the game server
npm run dev               # the board, proxying /api across
```

114,492 cells, every one of them 4,455 km² — 67 km across, at the equator and
at the pole alike. 181 cities, 2.30 billion people, a year's output of oil,
iron, steel, aluminium and rubber, every acre of land assigned to one of eight
powers or to nobody, the armies of 1939 standing on it and the fleets of 1939
at their moorings.

## The game

One game, eight seats, and a calendar that starts on 1 September 1939.

**A nation is a page.** `/germany` is Germany's board, `/uk` is Britain's, and
so on through `/france`, `/usa`, `/ussr`, `/china`, `/japan` and `/italy`; the
root is an index of all eight. Which nation you are is the address you are at
rather than a modal you dismissed, so a player can be sent a link, keep the tab
open, and reload without saying who they are again. There are no passwords yet —
you say who you are and the table believes you — but a seat already held cannot
be taken, so nobody becomes Germany by accident.

**Each page shows that nation's war, and only what that nation may know.** The
garrison on a hex is visible if the ground is yours, your side's, or a neutral's;
the other side's is *Not known*, and on the map it keeps its colour but loses
its shading — you can see whose ground it is, which was never a secret, and not
how much is standing on it.

**Except across a frontier.** An army dug in opposite you is not a secret
either: you can see it from your own trench, and in 1939 both sides of every
border in Europe knew roughly what was facing them. So the fog is drawn cell by
cell, and it stops one hex short of ground your side holds. On France's page the
German hexes along the Rhine are lit and counted while everything behind them
is dark; Britain, which borders Germany nowhere, sees exactly what France sees
and nothing more, because an alliance shares what its frontiers can see.

The line is *ground your side holds*, not *ground you can see*. The neutrals are
visible to everybody, and if their ground counted as a frontier then Britain
would be reading the Wehrmacht's order of battle through Belgium and Poland from
four hundred miles away. The totals count what the map draws and no more.

HexWW2.worldin, population, cities and output stay visible to everyone. Those were in
every almanac in 1939, and a game where you cannot see that Germany has no oil is
not modelling the war, it is modelling ignorance of it.

One caveat, stated plainly: this is a rule the interface keeps, not a secret the
server keeps. The world is deterministic and every browser builds all of it, so
the numbers are in the client whether it draws them or not — and with no
passwords, anyone can open another nation's page. Real secrecy means generating
forces on the server and sending each seat only its own, which is a change to
make when orders arrive and there is something worth hiding.

**The calendar is the clock.** Nothing happens in real time. The day turns when
every player *in the war* presses *End Current Day*, and not before; a day can
last a minute or a fortnight. Pressing it is reversible right up until the last
player agrees, so you can change your mind. Seats nobody is sitting in cannot
hold the day up, which is what lets a game of three run at all.

**A power that is not in the war yet takes no turns.** Italy on 1 September 1939
has nobody it may fight and therefore nothing to decide, so it watches: it holds
its seat, sees the whole board, gets every dispatch, and the calendar turns
without asking it. The panel says *View only* and gives it no button rather than
one that would be refused, and the rule is enforced on the server, because the
browser is not where a rule lives. The one exception is a table where nobody is
in the war yet — three players who have taken Italy, the United States and a
seat still at peace — which would otherwise sit at 1 September for good: when no
seated power is fighting, every seated player votes.

Nothing about that is written down. The day a power may first fight anybody is
the day it starts taking turns, and both come off the same table.

**The war opens as it did.** What a nation may do is gated by the date, and the
timeline is a table of nine rows:

| Date | Day | Event |
| --- | --- | --- |
| 1 Sep 1939 | 0 | The war in China, two years old already: Japan against China, and nobody else in it. |
| 1 Sep 1939 | 0 | Germany invades Poland. No other power in Europe may move. |
| 3 Sep 1939 | 2 | Britain and France declare war — and their empires with them, which puts Germany against 46 parties at a stroke. |
| 17 Sep 1939 | 16 | The Red Army crosses into Poland. |
| 30 Nov 1939 | 90 | The Winter War: the Soviet Union invades Finland. |
| 10 Jun 1940 | 283 | Italy declares war, inheriting exactly Germany's enemies as they stand that day. |
| 22 Jun 1941 | 660 | Operation Barbarossa. |
| 7 Dec 1941 | 828 | Pearl Harbor. Japan against the United States and the British Empire at once. |
| 11 Dec 1941 | 832 | Germany and Italy declare war on the United States, and the two halves of the war become one. |

Each lands as a dispatch in front of every player when the calendar reaches it,
and each is also the day a seat starts playing: Germany, Japan and China from
the first day, Britain and France on the 3rd, the Soviet Union on the 17th,
Italy in June 1940, the United States at Pearl Harbor.

**The ledger** — *Who may attack whom* in the war room — is the whole mechanic
on one page: every power, whether it is fighting or watching, the day it gets
in, and the list of everything it may move against. Germany's list on the 3rd is
two powers and forty-four countries; Italy's, until June 1940, is nobody.

Rights are **replayed from that table** rather than stored with the game, which
has two consequences worth the trouble: the state of the war can never drift out
of step with the timeline, and an event added months from now applies correctly
to a game already halfway through 1940. `sameAs` is what lets Italy inherit
Germany's war without naming a single country — it is resolved against the wars
already declared when the calendar reaches June 1940, so it picks up whatever
Germany actually accumulated.

A power and its own metropolitan country are one party, not two: `ledBy` brings
in everything Britain holds *except* the United Kingdom, or Germany's enemy list
would name France twice. That is also why the powers and the countries were
given one name each.

Nothing acts on any of this yet. You can see that on 2 September Germany may
fight Poland and nobody else, but there are no orders, no movement and no
territory changing hands — that is the next pass, and this is the seam it plugs
into.

### What is not the game

`src/game/` is pure: no browser, no network, no clock, no file. `npm test` runs
it under plain Node — 215 checks: 6,800 days round-tripped through the civil
calendar, every belligerence rule checked on the day either side of the event
that grants it, the turn engine driven through a game where one player is in the
war and the other is watching, and a hundred places on the map asked who holds
them.

The last section is different in kind: it sweeps **all 114,492 cells** of the
real board and fails if any land cell resolves to no region, or if any cell is
cut off from its own nation without being one of the nine enclaves that are
named in the test — Northern Ireland, the Canal Zone, Kuwait, the Gambia, Hong
Kong, Goa and Sikkim. That is not a check you can write by thinking of places to
try, which is the point: a gap between two rectangles is invisible until
something walks every cell and asks each one where it is standing.

The server around it holds exactly one game and writes it to a single JSON file.
**It never sends the map.** The world is deterministic, so client and server
each build the same 114,492 cells from `earth.bin` and only the date, the seats,
the readiness and the event log cross the wire — a couple of kilobytes, pushed
over server-sent events whenever anything changes.

One browser is one seat: seats are remembered in `localStorage`, which is shared
between tabs of the same profile, so two players on one machine need two
profiles.

## The page

The board takes 80% of the width and sits in the top right. Down the left is the
rail — the nation, its seat, the day's one button, the ledger, and whatever cell
was last clicked. Along the bottom of the board sits the dossier, and under that
a single line: the cursor's reading on the left, and **the date in the bottom
right corner**, which is the one number the whole table shares.

The rail is 20% of the width but never narrower than 240px: below a 1200px
window the board gives way rather than the writing. The globe watches its own
box and fits itself to the shorter side of it, so the split is a grid rule and
nothing else needs telling.

### Two inspectors, on purpose

The **rail** answers the question the map is currently asking, and refuses to
answer any other. On Terrain it says this is forest and what it costs to cross;
on Nations who holds it and what is standing on it; on Output how much oil comes
out. A hex is a dozen facts at once, and printing all of them means the one you
are looking for is somewhere in the middle of a column.

That is the right rule for a panel you read while working, and the wrong one for
the moment you want to know everything about one place. So the **dossier** along
the foot of the board is the other half of the same idea: the place, the people,
what it makes, what holds it and what is moored off it, all in columns at once.
It is read in a sweep rather than scrolled, which is why it lies across the
bottom instead of being added to the rail, and it folds down to its own title bar
when the globe wants the whole screen.

The ground itself — terrain, height, temperature, rainfall — is the one column
that follows the layer, and appears only on Terrain. On Nations you are asking
who holds a hex and on Output what comes out of it, and neither question is
answered by how wet it is.

The two obey the same fog. On Britain's page the dossier on a Berlin hex gives
the terrain, the region, the population and the steel — all of which were in
every almanac in 1939 — and says of the garrison only that it is not known,
because nobody on Britain's side is looking at it.

### Orders

**Actions** sits at the right-hand end of the dossier bar, because an order is
given to a hex and that is the panel about a hex. It offers three: **Reinforce**,
**Attack**, and **Retreat / Fortify**. Reinforce marches; the other two are
waiting on a combat model.

Which of the three a hex will take is decided by the board rather than by the
button, in `game/orders.js`. Ownership says whose ground you may stand on and
the war table says whom you may attack, so on 1 September Germany may attack
Warsaw and not Paris, and on the 3rd it may attack both, without a line of that
file changing. Every refusal carries the reason: *This ground is Poland's*, *You
are not at war with France*, *Nothing of yours is standing here*. A greyed-out
button with no explanation is worse than no button.

The one subtlety is what to call a hex when asking. Both names have to be tried,
because neither answers alone: a country can be a belligerent its owner is not —
Poland is Independent ground and the reason the war started — while a metropole
is deliberately *not* a separate party from its power, so France the country is
in no war at all and `france` the power is in several.

### /master

A ninth page, and the only one that is not a seat. `/master` — also `/all`,
`/overview`, `/god` — hands the fog no viewer, and every rule that asks whether
this seat may see a thing answers yes. Every garrison, every fleet and every hex
on the globe reads as it is.

It is one substitution and not a second copy of the visibility logic: the page
passes `null` where the others pass their nation, and the shading, the totals,
the dossier and the fleet markers all read that as "no rule applies". There is
nothing to disagree with, which matters, because a second implementation of a
fog rule is a leak waiting for the first divergence.

The rail there carries what the eight pages cannot: all nine powers side by
side, land, men, field army, tanks, guns, aircraft and hulls. It is for setting
a game up, for arguing about a rule, and for checking that the fog everywhere
else is hiding the right things.

## Controls

| Input | Action |
| --- | --- |
| Drag | Turn the globe (let go mid-turn and it keeps spinning) |
| Scroll / pinch | Zoom in and out |
| Arrow keys | Turn · `+` / `-` zoom · `0` reset |
| Click a cell | Select and inspect it · click empty space to clear |
| Names checkbox | Show or hide country names |
| Cities checkbox | Show or hide the settlement layer |
| Layer buttons | Terrain, who holds the ground and what is standing on it, or what it produced |

## The grid

The board is a Goldberg polyhedron: an icosahedron subdivided 107 times and
then dualised, which gives 10n² + 2 = 114,492 cells laid over the sphere.

```
   subdivided icosahedron          its dual
         /\  /\  /\                 ⬡ ⬡ ⬡ ⬡
        /__\/__\/__\      ->       ⬡ ⬡ ⬡ ⬡ ⬡
        \  /\  /\  /                ⬡ ⬡ ⬡ ⬡
         \/__\/__\/
```

Vertices of the subdivided mesh become cell centres; the centres of its
triangles become cell corners. Cells are addressed by a single integer. There
are no rows, no columns, no wrap, and no poles to special-case — every cell has
a full ring of neighbours, which removed a special case from every breadth-first
walk in the project.

**Why not a rectangle.** The board used to be 444 × 256 hexes on an
equirectangular sheet, and that sheet lies about area. A hex at the equator
covered about 7,000 km²; one at 87°N covered 307. Twenty-three times smaller.

| Latitude | km² per hex | vs the equator |
| --- | --- | --- |
| 0–10°N | 7,013 | 100% |
| 40–50°N | 4,978 | 71% |
| 60–70°N | 2,975 | 42% |
| 85–90°N | 307 | 4% |

Half the land hexes sat poleward of 60° holding a fifth of the actual land, so
Siberia and the Canadian Arctic were worth several times what they should have
been — and population, resources and garrisons all inherited the error. The
correction is visible in the tallies: the Soviet Union went from 5,854 land
hexes to 4,580, Britain from 6,946 to 7,611, and the world's land fraction from
33.6% to 28.7% against the real 29.2%.

On the sphere the spread is **1.18×** rather than 23×: hexagons run 4,133 to
4,857 km².

**The twelve pentagons.** You cannot tile a sphere with hexagons alone. Exactly
twelve cells are pentagons, sitting where the original icosahedron had vertices,
each about two-thirds the area of a hexagon. Four of them fall on land — in
Siberia, Algeria, Sulawesi and the Amazon — and the rest are at sea. Everything
that walks the grid reads a cell's valence rather than assuming six.

The grid builds in about 110 ms and is verified on every run: 114,492 cells,
exactly twelve of valence five and none of any valence but five or six, every
neighbour link mutual, every corner shared by exactly three cells, and the cell
areas summing to the sphere to one part in a million.

## Where Earth comes from

`tools/build-earth.mjs` samples three NASA-derived equirectangular rasters
(shipped with the `three-globe` package) at 91 points inside every hex and
bakes one byte each into `src/world/earth.bin`:

| Raster | Baked as |
| --- | --- |
| `earth-water.png` | fraction of the hex that is dry land |
| `earth-topology.png` | mean relief, roughly 0–7 km |
| `earth-day.jpg` | vegetation index, from how far green leads red and blue |

```bash
npm run build:earth      # re-bake (downloads and caches the rasters)
npm run preview:earth    # ASCII sanity check of the baked data
```

The data ships as a binary asset rather than base64 inside the bundle — a third
smaller, cached separately, and fetched in parallel with the JS. `earthData.js`
holds only its shape.

The baked file is one value per hex, so **re-run `build:earth` after
changing `COLS`/`ROWS`** in `src/world/grid.js` — `loadEarth()` throws if the
two disagree. Keep the `COLS`/`ROWS` constants at the top of the tool in step
with the grid.

`src/world/earth.js` turns those three bytes into terrain:

- **Temperature** is mean annual °C, `27 − 0.0068·lat² − 6.5·km`. The quadratic
  tracks the real latitude profile closely (27 °C at the equator, 0 °C at 60°,
  −28 °C at the pole) and altitude cools at the standard lapse rate.
- **Relief** bands split hills / mountains / snowcap at 0.6, 1.4 and 3.5 km.
- **Vegetation** picks desert → savanna → plains → forest → jungle. Vegetation
  is checked before relief so an arid plateau stays desert instead of turning
  into green hills.
- **Ocean depth** is the one derived quantity — the source rasters carry no
  bathymetry, so shelf/ocean/abyss come from a breadth-first distance to the
  nearest coast, perturbed by coherent noise. The noise is not decoration:
  breadth-first distance on a hex lattice grows in perfect hexagons, and without
  it every island wears a visible hexagonal halo.
- **Lakes vs seas** comes from which water reaches the open ocean. Most straits
  are narrower than a hex — Gibraltar is 14 km against 90 km — so a plain
  water-tile flood fill seals the Mediterranean off and calls it a lake. The
  dense sampling means any hex containing water at all has a land fraction
  below 255, and flooding across those keeps sub-hex channels open. The result
  is intersected back with the real water tiles, so the coastline never moves.

Spot checks land where they should: Sahara, Arabia, Gobi and the Outback are
desert; the Amazon, Congo and Java are jungle; Siberia, Alaska and Moscow are
taiga; Tibet and the Andes are snowcap; Greenland and Antarctica are ice; the
Mediterranean, Baltic, Black Sea and Persian Gulf are open sea, while the
Caspian, Aral, Baikal, Victoria and the Great Lakes are lakes.

Known limits. The climate model is latitude-only, so it has no ocean currents —
the Barents Sea freezes when the real one stays open — and greenness alone
cannot separate cropland from forest, so the Ukrainian and Argentine grasslands
come out as forest. Separately, straits below about half a tile still close: the
board types the Mediterranean as sea, but a future naval pathfinder would find
it a closed basin, since Gibraltar is land at this resolution.

## People, 1939

The world had about 2.30 billion people in 1939, and the board places all of
them. Two files carry the history and one turns it into tiles.

**Cities** (`cities.js`) are 181 real places with their populations from the
censuses around that year — 1939 in Germany, the USSR and Japan, 1940 in the
USA, 1941 in India and Britain. London leads at 8.6M, then New York, Tokyo,
Paris, Berlin, Moscow.

At 90 km per hex some cities share one. Those merge into one
agglomeration keeping the larger name and the combined total, which is what the
tile honestly represents: Tokyo absorbs Yokohama to reach 7.8M, Osaka absorbs
Kobe. A port on a headland too narrow for the land mask — Athens, Dakar,
Auckland — is walked out to the nearest land hex rather than left at sea.

**Everyone else** is the ~93% who did not live in a large city, spread by
`population.js` using three inputs:

- **Region** (`regions.js`) — about sixty boxes carrying real 1939 populations,
  in contemporary political units: China 517M, India (including today's
  Pakistan and Bangladesh) 380M, the USSR split into European Russia, the
  Caucasus, Central Asia and Siberia so that empty tundra does not draw the same
  rate as the Russian heartland. Boxes are tested in order and the first match
  wins, so small countries are listed before the large neighbours that would
  otherwise swallow them.
- **Habitability** — how many people a terrain carries relative to open plains:
  plains 1.0, forest 0.75, jungle 0.22, desert 0.06, tundra 0.03, ice 0. Coasts
  get a 1.45x bonus for ports and fishing, and each tile takes a deterministic
  ±50% jitter so neighbouring farmland is not identical.
- **River corridors** — the terrain model knows nothing about rivers, so
  without help Egypt spreads evenly across its deserts instead of gathering on
  the Nile. A short list of corridors multiplies habitability inside them: the
  Nile valley and delta, Mesopotamia, the Indus, the Gangetic plain, the North
  China plain, Java. These change only the distribution *within* a region, never
  its total.

Regional totals come out within 2% of the historical figures, and the world
sums to 2.30 billion. Resulting densities are close to the real ones: England
196/km² against roughly 250 in reality, Java 210, the Gangetic plain 172, Kansas
12.6 against 10, the Sahara 0.2 against 0.2, the Australian interior 0.1
against 0.1.

The limits are worth stating. Rectangles are not borders, so a region's edge
cuts across the map rather than along a frontier. The Nile is 20 km wide and a
tile is 125 km, so the river cannot be resolved — the corridor gathers Egyptians
into the right few tiles, but the valley's true density is far higher than any
tile average can show. And the split between city and countryside is only as
good as the city list: a place not in it is folded into the rural spread.

Everything is deterministic — no `Math.random()` — so every client builds an
identical board, and a server can send a seedless world by construction.

## What the land produced

Every hex carries a year's output of five things, as of 1939: oil, iron ore,
steel, aluminium and rubber. All five are war materials, and a tile can carry
several at once — Anshan raises iron ore *and* pours steel.

They share one layer rather than five. Five buttons meant no way to see that the
oil is in one hemisphere and the rubber in another, so a cell now takes the
colour of whatever it is most notable for, and its brightness from how notable
that is. "Most notable" is measured against the largest producer of that same
thing: iron is raised by the hundred million tonnes and aluminium by the hundred
thousand, and compared raw, every smelter on earth would be invisible.

**Food used to be here and is not any more.** It followed the people rather
than the geology — cropland scaled with local settlement, the breadbaskets were
lifted on top, and the fisheries were the only sea zones on the board — which
made it the odd one out among five war materials. It is gone from the layer, the
panel and the data; `git log` has the model if it is ever wanted back.

This is **output, not endowment**: what was actually being pumped and mined, not
what happens to lie underground. So Saudi Arabia is nearly dry —
Dammam had only just come in and produced about 60 kt against Texas's 25,000 —
Libya has no oil at all, and the Athabasca sands and the Pilbara are blank.

**Minerals and industry** (`resourceSites.js`) are 159 real places with their
annual output: the East Texas field, Baku, Maracaibo, Ploiești; the Mesabi
Range, Lorraine, Kiruna, Krivoy Rog; the Ruhr, Pittsburgh, the Donbas, Yawata;
Bitterfeld, Arvida, Chippis. Every site lands on a land hex within one tile
of its true position.

Two of the five are not dug up at all, and sit where industry put them rather
than where geology did. **Steel** needed coal, ore and capital in one place —
the Ruhr, Pittsburgh, the Donbas, Sheffield. **Aluminium** needed cheap
electricity above all, which is why Norway, Switzerland and Saguenay in Quebec
smelted so far out of proportion to their size, and why Germany — building an
air force — out-produced everyone.

**Rubber** is an area rather than a point, spread over the tiles inside it: the
Malayan and Sumatran estates that grew over 90% of the world's natural rubber,
and the smaller ones from Ceylon to the Gold Coast. Estates were cut out of wet
tropical forest, so jungle scores highest and the rest of the ground scores as
cropland would. Zone boxes overlap — Malaya and Sumatra share the Strait of
Malacca — so a tile is claimed by the first zone that covers it and no ground is
worked twice.

World totals land close to the real ones:

| | Board | Actual 1939 |
| --- | --- | --- |
| Oil | 264 Mt | ~280 Mt |
| Iron ore | 181 Mt | ~200 Mt |
| Steel | 132 Mt | ~137 Mt |
| Aluminium | 696 kt | ~700 kt |
| Rubber | 1.06 Mt | ~1.1 Mt |

National shares come out close too: the USA at 58% of world oil against a real
61%, and 36% of steel against 34%; Germany's aluminium the largest in the world.

The limits are the same ones the population layer has. Producing areas are
rectangles, not borders, so a zone edge can cut across the map. And a hex is
coarser than most orefields: Lorraine and Luxembourg's Minette are one tile, as
are Tokyo and Yokohama.

## Who held what

Every land hex belongs to one of the eight powers — the United States, the
United Kingdom, France, Germany, Italy, the Soviet Union, China and Japan — or
to nobody, which is drawn grey. The sea belongs to no one and is never coloured.

One name per power, and it is the name the country layer uses: the legend used
to say *Great Britain* and *Russia* over ground the map itself labelled *United
Kingdom* and *Soviet Union*.

Borders are those of **1 September 1939**, so this is the world as the war
opened, not as it ended: Greater Germany includes Austria and Bohemia-Moravia
but Poland is still independent; Italy holds Libya, Albania — annexed that April
— and Ethiopia; Japan holds Korea, Formosa, Manchukuo, the puppet Mengjiang in
Inner Mongolia, and the China it had taken by late 1939, which is the coast, the
northern plain, the Yangtze up to Wuhan, Canton and Hainan, with Chongqing and
the west still Nationalist; France and Britain hold their empires entire.

**Ownership is sovereignty, not influence.** The two are separate fields and
they are kept separate. Egypt and Iraq were sovereign states in 1939 — a treaty
gave Britain the Canal Zone, Habbaniya and Shaiba, and a right of passage, and
none of that is ownership — so they are Independent on the map and lean 85%
Allied on the slider. Anglo-Egyptian Sudan, a condominium run from London, is
British; so are Palestine, Transjordan and Aden. Hungary holds Carpatho-Ruthenia
and the southern edge of Slovakia, taken by award in 1938 and 1939 rather than
by conquest. Hatay is Turkish, by a vote in June 1939.

The neutral list follows the Axis & Allies Global 1939 *Midnight Express*
variant, which keeps an unusually long one — Poland, the Baltic States (all
three of them, independent until June 1940), Norway, Sweden, Switzerland,
Spain-Portugal, Eire, Turkey, Persia, Afghanistan, Saudi Arabia, the East
Indies, Angola and Mozambique, and the whole of Latin America outside the
American possessions. Not the Sahara, though the variant lists it: it was
French, and drawing it grey was a gap between two boxes rather than a decision.

**Every acre of land stands in a named region**, which was not true until
recently, and could not be made true by fixing the places anyone happened to
notice.

The territory table is an ordered list of rectangles, and rectangles fail in two
ways. One stops short and leaves a hole: South West Africa fell between Angola
and South Africa, Bechuanaland between Rhodesia and the Transvaal, the Ivory
Coast below French West Africa's southern edge, Niger between Nigeria and
Algeria, the Hejaz west of Saudi Arabia's, the horn of Somalia east of Italian
East Africa's, a strip of the Congo between Kasai and Tanganyika, and the
Galapagos and Kerguelen outside every box on the board. The other reaches too
far: Syria's box took Adana, Iraq's took the Syrian Jazira, Palestine's took the
Hauran, Thailand's took a slice of Laos, and Johore's crossed the Strait of
Malacca into Sumatra.

The first kind is the dangerous one, because a cell that matched no box kept a
default owner and no region at all — and a nation without a region reads on the
map exactly like any other nation. That is how a one-cell line of **Soviet
Union** came to run along Mongolia's southern border, three thousand kilometres
from the nearest Russian: Mongolia's boxes stopped at 43°N, China's began at
42.5°N, and every cell in the half-degree between them fell through the whole
table into the Soviet box at the bottom of it.

So the state is gone rather than the symptom. `territoryFor` is what assigns
ground now, and where no box matches it takes the nearest one by centroid
distance instead of a default nation. It should never fire, and the sweep in
`npm test` fails if it does — a seam wants closing in the table, not papering
over in the fallback.

Antarctica is a region too, now: Independent, because seven governments claimed
it and none of them had a soul living there, but *named*, which its 3,183 cells
were not.

**Neutral is not the same as ownerless.** A neutral power's colonies belong to
it and are drawn in its colours: the Belgian Congo and Ruanda-Urundi are
Belgian, the East Indies, Suriname and Curaçao Dutch, Angola, Mozambique,
Portuguese Guinea, Cape Verde, Goa, Macau and Timor Portuguese. Each keeps its
own name — writing "Portugal" across Africa would put the label on the wrong
continent — and takes its metropole's lean, because a colony had no foreign
policy of its own to lean with.

Three abstractions are worth stating outright rather than leaving to be noticed:

- **The Dominions.** Canada, Australia, New Zealand, South Africa and
  Newfoundland are drawn as the United Kingdom. They were not: each had its own
  parliament, and Australia and New Zealand declared war on 3 September, South
  Africa on the 6th after a vote that brought the government down, Canada on the
  10th after one in the Commons. Eight powers were asked for, so they fold in —
  and the legend and the cell inspector both say so.
- **There is no Dutch power.** The Netherlands and the East Indies are neutral,
  which in September 1939 they still were.
- **Tibet independent, Xinjiang Chinese.** Both are de-facto readings. Tibet had
  run its own affairs since 1913 and no power's writ reached Lhasa; Xinjiang was
  Sheng Shicai's, garrisoned by Soviet troops, and nominally Chinese. Tannu Tuva
  is neither Mongolian nor yet Soviet: a republic of its own on paper, a Soviet
  client in fact, annexed outright in 1944.

Danzig is a case the grid cannot hold: 1,900 km² against a 4,455 km² cell. The
Free City is not drawn, and the hex that contains it is **Polish** — Gdynia and
the Corridor — rather than being quietly handed to Germany.

Set against the historical record, the board gives back the strategic picture
the war actually turned on:

| | Land tiles | People | Steel | Oil |
| --- | --- | --- | --- | --- |
| United States | 2,183 | 120M | 48.0 Mt | 154.0 Mt |
| United Kingdom | 7,611 | 725M | 16.2 Mt | 3.1 Mt |
| Soviet Union | 4,580 | 216M | 18.6 Mt | 29.0 Mt |
| Germany | 130 | 87M | 18.8 Mt | 0.7 Mt |
| Japan | 705 | 276M | 6.7 Mt | 0.3 Mt |
| France | 2,457 | 157M | 13.7 Mt | — |
| Italy | 879 | 60M | 1.9 Mt | 0.1 Mt |
| China | 1,086 | 83M | — | — |
| Independent | 13,267 | 576M | 8.3 Mt | 77.1 Mt |

Germany with the second-largest steel industry on earth and almost no oil, and
Japan with a tenth of America's steel and none of its own oil, are not artefacts
of the model — they are the reason both went to war the way they did.

### One map of who holds what

Ownership and armies were two layers and are now one, because they were always
one question: a political map that cannot show where the divisions are is a map
of who owns the ground rather than who holds it. Every country keeps its own
colour, and the colour is lifted by the weight of the garrison on that cell, so
the front line, the fortified frontier and the empty interior all read at once.

Three things are said at the same time and have to stay apart: a bright colour
is whose it is and a great deal standing on it; a dim colour is whose it is and
little or nothing; grey is whose it is and you are not allowed to count it.
Ground with no garrison is floored at 42% rather than fading out, because an
empty province is still somebody's — only the fog is allowed to take colour
away, and even then it leaves a third of it, so the shape of the other side's
empire is still legible.

The panel follows the layer. On Terrain it says this is forest and what it costs
to cross, on Nations who holds it and what is on it, on Oil how much oil comes
out — one question at a time, rather than a column of twelve facts with the one
you want in the middle of it.

### Countries, not just powers

The eight belligerents are drawn in their own colours wherever they and their
empires reach, so the shape of the war stays readable at a glance — India and
Australia fly British gold, Indochina French violet. Everyone else gets a colour
of their own rather than sharing one anonymous grey, because a map where Hungary
and Romania are the same shade is not much of a map.

**127 countries** hold land. A country is a group of territory boxes, since a
country's shape rarely fits one rectangle: Yugoslavia takes three, Mexico three,
mainland Italy four, the Belgian Congo twelve — the basin is a fan, and the
river is its border on the west. Neutral colours are hand-assigned rather than
generated, so that countries sharing a border also differ in hue, and a colony
takes its metropole's colour rather than a hue of its own.

Names are written across the ground each country covers, sized by how much land
it holds — the Soviet Union reads at a glance, Luxembourg has to be zoomed into.
The anchor is not the centroid, which for a scattered empire puts "United
Kingdom" in the mid-Atlantic; each country is broken into connected blocks and
labelled on the largest, at the point furthest from any edge, so the name sits
in open ground rather than across a coastline. Country names are laid down
first and city names give way to them, so a capital is never printed across the
middle of its own country's name.

Kerguelen and the Galapagos hold one cell each. Twelve more places are smaller
than a single hex and so hold no ground at all —
Malta, Gibraltar, Bermuda, Guam, Wake, the Dodecanese, the South Seas Mandate,
the Solomons, the Bahamas, Macau, Cape Verde and Curaçao. They are in the
territory table and will appear if the grid is ever refined. Hatay, Goa and the
southern Slovak strip only just clear the bar, at one to three cells each.

### Ownership is meant to move

Control is a mutable layer over the generated world, not part of it. Every
change is recorded, so a territory's history can be replayed and the map redraws
itself:

```js
world.ownership.set(tileIndex, 'germany', { turn: 1, reason: 'Fall Weiss' });
world.ownership.transfer(polishTiles, 'germany', { turn: 1 });
world.ownership.history(tileIndex);  // [{ from, to, turn, reason }, …]
world.ownership.tally();             // land tiles per power
world.ownership.onChange(fn);        // fires once per batch, not per hex
```

`transfer` moves a whole campaign's worth of ground as a single event, and the
renderer reads ownership fresh every frame, so nothing has to be rebuilt when a
border moves.

### Where the boxes strain

Territories are rectangles tested in order, first match wins, so the file's
order carries as much meaning as its numbers — the neutrals are carved out
before the empires, and the Soviet Union comes last in Eurasia because its box
would otherwise eat half the list.

Diagonal borders and awkward shapes are the weak point, and several places need
more than one box to come out right:

- **Italy** is a long diagonal boot, and its bounding box takes in Nice and half
  the French Riviera. Four boxes step down the peninsula instead.
- **Yugoslavia** spans the same latitudes as southern Italy, so a single box
  reaches across the Adriatic and claims Naples and Bari. It narrows to the east
  as it runs south, in three steps.
- **Mongolia** reaches furthest north in the west; squared off to 52.5°N and
  120°E it takes Irkutsk, Ulan-Ude, Chita, Urumqi and Hailar with it.
- **Tibet, Nepal and Bhutan** are three countries, not one Himalayan block —
  squared off together they reach down to the Ganges and swallow Lucknow.
- **Afghanistan** only touches 75°E along the Wakhan corridor, a strip barely a
  degree tall; squaring that off puts Kashmir in Afghanistan.
- **Eastern Europe** is where ordering matters most. The Soviet box is the last
  in Eurasia, so any ground the neutral boxes fail to cover falls through to it
  and draws a red strip across the map — that is what left Slovakia and the
  Carpathians Soviet, and what stopped Poland at 24°E when in 1939 it still
  reached 26°E. In the other direction, Poland's box is carved out before the
  Axis ones, so Bohemia and Moravia and East Prussia have to be claimed ahead of
  it or a neutral strip cuts straight through the Reich.
- **Alaska** stops at the 141st meridian except for the panhandle, which tapers
  south-east along the coast with the Yukon and British Columbia just inland.
  Squared off, it takes Whitehorse, Dawson City, Prince Rupert and Inuvik.
- The **Bering Strait** needs its own ordering: Chukotka runs past the dateline
  into negative longitudes, where a Soviet box measured eastward from 19°E
  cannot reach it, and St Lawrence Island sits west of Chukotka's edge.
- **Spain** only reaches east of Greenwich north of Valencia; as one rectangle
  it crosses the Mediterranean and takes the Algerian coast at Algiers.
- The **Rio Grande** and the **St Lawrence** each need several boxes to descend
  properly, **Vancouver Island** reaches south of the 49th parallel, and
  **Alsace-Lorraine** and the **Saar** must be claimed ahead of Germany.
- **Greenland** was Danish, all of it, but its west coast runs further west the
  further north you go, so one box from 60°W leaves Thule and the north-west to
  Canada. Ellesmere's east coast slopes the same way, and the two are separated
  by Nares Strait — 30 km, a third of a hex — so both are stepped and Ellesmere
  is claimed first.
- **Manchukuo** is bounded by two rivers and neither runs straight. The Amur
  falls away south-east, from 53°N above Mohe to 48°N at Khabarovsk, so a
  rectangle carried to 53.6°N takes the whole Soviet Amur bank. In the south
  Jehol stops at the Great Wall while Liaodong runs on down its peninsula, and
  one box across both reaches Tianjin.
- **Mongolia** touches 52°N only in the middle, around Lake Khövsgöl. Squared
  off at that latitude it takes Irkutsk, Ulan-Ude and Chita; squared off at its
  southern edge it takes Chinese Inner Mongolia.
- **Japan** is not a rectangle either: one box from 128.3°E to 146°E reaches
  straight across the Sea of Japan and takes north-east Korea and the Manchurian
  border country with it. Korea in turn is claimed ahead of Japan, or the Kyushu
  box crosses the strait to Busan, and its northern border is the Yalu and the
  Tumen, climbing from 40°N on the west coast to 42.5°N on the east.
- **Norway** is a coastal strip that leans east as it climbs. Carried to 31°E it
  takes Swedish and Finnish Lapland, Kiruna and Rovaniemi included. **Sweden**
  reaches 24°E only in the Torne valley at the top; squared off there it takes
  the Finnish side of the Gulf of Bothnia, and Saaremaa besides.
- **Chile** is a strip whose eastern edge moves with latitude: as one box it
  takes Argentine Patagonia and Río Gallegos, and it has to sit ahead of Bolivia
  to keep Calama but behind Peru to leave Tacna.
- **Bolivia** as one rectangle takes Brazilian Acre, the Pantanal and the
  Paraguayan Chaco. **Peru**'s eastern edge bulges — 69.9°W in Loreto, 68.65°W
  where Madre de Dios pushes furthest in, back to 69.4°W at Titicaca — and held
  straight it reaches over the Andes to Cobija. **Colombia** touches 4.2°S only
  in the Leticia corridor; squared off there it covers almost all of Ecuador,
  Quito included. The **West Indies** box has to follow the mainland rather than
  precede it, or it takes the Colombian and Venezuelan coast, Caracas with it —
  only Trinidad needs claiming first.
- Gaps matter as much as overlaps. The Soviet Union is last in Eurasia, so any
  ground the boxes fail to cover turns red: the strip below Mongolia was the
  seam between Mongolia's eastern tip, Hulunbuir and Chinese Inner Mongolia, and
  a second wedge sat on the inside of the Amur's bend.
- The **Strait of Malacca** runs diagonally, so a single Malayan box crosses it
  onto Sumatra; **Annam** reaches past 108.4°E, but only in the centre — carried
  north the wider box crosses the gulf onto Hainan.

Some things are simply smaller than a hex. Luxembourg has no entry at all: the
Grand Duchy, the French Briey-Longwy basin and the Luxembourgish Minette all
land on one hex, which goes to France as the larger owner of that orefield.
Northern Ireland, at about one hex across, has to be claimed explicitly or
Eire's box takes Belfast with it. Vienna and Bratislava are 55 km apart and
share a hex, so Slovakia's box deliberately stops short of Bratislava: reaching
it would take Vienna, which is fourteen times the size.

Border towns that face each other across a river cannot be separated at all.
Heihe and Blagoveshchensk are a kilometre apart across the Amur, Tornio and
Haparanda across the Torne, Linjiang and Chunggang across the Yalu; in each case
both land on one hex and one side wins it. Tacna and Arica are 55 km apart and
would share a hex too, which is why Chile's Atacama box is ordered behind Peru.

Verified against 269 named locations, from Vienna and Vladivostok to Qaanaaq
and Río Gallegos, plus two sweeps. One flood-fills for fragments of a country
stranded inside another — the signature of a box cutting into its neighbour.
The other hunts the opposite failure, ground no box covers, which falls through
to whichever big block comes last. Five fragments survive and all five are meant
to: Panama east of the Canal Zone, which the Zone genuinely bisected, Hainan,
Trinidad, Northern Ireland and the Torres Strait islands.

## Which way the neutrals leaned

Every independent country carries one number: the percentage leaning towards the
Allies, with the remainder to the Axis. Fifty-three countries, each a starting
position rather than a verdict — like ownership, it is meant to move.

The numbers stay off the ends deliberately. On 1 September 1939 no neutral had
committed, and most had reasons pulling both ways. Romania held a British
guarantee and sold its oil to Germany. Finland's quarrel was with the Soviet
Union, which the Allies were about to be allied to. Argentina's officer corps
admired Germany while its trade ran to Britain. Only a country already acting as
a client sits near an extreme — Slovakia at 8, whose troops marched into Poland
alongside the Wehrmacht — and nothing sits at 0 or 100.

They run from Slovakia's 8 to Poland's 92, with the median at 60: thirty-five
lean Allied, fifteen lean Axis, and Chile, Bolivia and Tibet sit even. Click any
independent hex to see its split.

## The armies of 1939

The armies are a table of **formations**, not a quantity of men to be spread
over a country. `oob1939.js` lists two hundred of them — armies, corps,
divisions, air fleets, fortress commands, depots, flak belts — each with a
strength, a type, a quality, and either a deployment zone or a list of named
places. `deploy.js` reads that table and decides which hex each formation
stands on. Nothing in the model divides a national total by an area.

That is a rewrite of what used to be here, and the reason is worth keeping.
The old generator scored every hex a power owned — frontier pressure, terrain,
population — and handed out the army in proportion to the score. It produced a
smooth field, and 1939 was not smooth. It gave Berlin fifteen tanks, nine
fighters and fourteen bombers, when Berlin held a guard regiment, some
replacement battalions and a great deal of anti-aircraft. It gave a farming
district of Brandenburg seven thousand six hundred men and eight tanks, when
the whole point of the Wehrkreis system was that the field divisions *left*
their home districts on mobilisation. Every German cell held tanks, and Germany
had 3,200 of them, all in six panzer divisions and four light divisions parked
in four provinces. The map was answering a question nobody asks — what is the
average military presence here — instead of the one everybody asks, which is
where is the army.

| | Infantry | Tanks | Artillery | Fighters | Bombers |
| --- | --- | --- | --- | --- | --- |
| Germany | 3.43M | 3,390 | 15,535 | 1,100 | 1,600 |
| Soviet Union | 2.50M | 21,000 | 30,930 | 4,000 | 3,500 |
| France | 3.20M | 3,300 | 12,300 | 800 | 600 |
| Britain | 1.04M | 1,150 | 2,315 | 750 | 550 |
| Italy | 1.64M | 1,320 | 6,550 | 800 | 800 |
| Japan | 1.78M | 2,000 | 5,360 | 1,200 | 1,000 |
| China | 2.50M | 100 | 780 | 200 | 100 |
| United States | 233,000 | 400 | 1,025 | 800 | 500 |
| The neutrals | 5.68M | 2,059 | 12,315 | 900 | 500 |

Those totals are **summed from the formation table**, not declared beside it, so
a correction to one division moves the national figure with it and the two can
never drift apart. The shape of the table is the story: the Red Army with more
tanks than everyone else combined and the Wehrmacht with a sixth as many; the
United States, about to out-build the world, fielding an army smaller than
Belgium's.

The neutral row is a pool, not a bloc — thirty separate armies that never fought
as one, of which Poland alone is about a million men and 880 tanks. Each of them
is deployed on its own frontier, because that is where each of them stood.

### Deployment zones

A **zone** is a piece of ground with a front and a doctrine. It names the
rectangles it covers, the countries its front looks at, and how the strength in
it falls away with depth. Distance to the enemy is walked hex by hex over *your
own ground* — not across water, because Denmark is four hexes from Poland over
the Baltic and no Danish division was facing it, and not through third
countries, because a walk allowed through Belgium makes the Ruhr four hexes from
France and puts the reserves of Army Group C in Essen.

The doctrine is the parameter that makes one nation look unlike another:

| profile | shape | who |
| --- | --- | --- |
| `schwerpunkt` | one point carries several times the average | Germany in the east |
| `cordon` | flat along the whole frontier, thin reserve | Poland |
| `fortified_line` | heavy on the works, the field armies just behind | France, Finland |
| `defense_in_depth` | moderate at the line, a large echelon behind | the Soviet western districts |
| `imperial_nodes` | no line at all — discrete garrison points | Britain, Italy overseas |
| `corridor_occupation` | cities, ports and the railway between them | Japan in China |
| `skeleton` | peacetime cadre at a handful of posts | the United States, most neutrals |

Three things are quantised on purpose. **Armour** goes into one hex whole,
because a panzer division existed as a division and not as a mist; successive
formations in a zone take successive hexes, so an army group's armour reads as
several assembly areas rather than one impossible stack. **Aircraft** appear
only on cells that hold an air formation, and nowhere else on the board — there
are 58 airfields on a globe of 114,492 hexes. And **depots, rear-area security
and anti-aircraft are counted apart from field strength**, so a hex holding
twelve thousand recruits in a training barracks is no longer indistinguishable
from a hex holding a division. The inspector names what is standing there and
says how many of the men are field troops.

Two rules keep formations off ground that could not have held them. Terrain
scales what a hex will carry — mountain, marsh, desert and tundra carry little.
And a hex with no road and no railway carries nothing at all: there is no rail
layer in the data, so access is read off settlement and cities, which in 1939 is
very nearly the same map. It is used as a gate and never as a weight, and that
distinction is the whole difference from the old model. Every post the order of
battle names by hand counts as served, whatever the desert around it looks
like — Tobruk had a road because there was a garrison there.

### What comes out

- **Berlin**: 116,000 men, all of them replacement battalions and flak crews,
  no field troops, no tanks, no aircraft.
- **Rural Brandenburg**: nothing whatever.
- **The Ruhr**: 1,439 anti-aircraft guns, the heaviest concentration on earth,
  and not one field soldier.
- **Silesia**: 186,000 men in a single hex — the 10th Army, the main effort.
  The five heaviest German hexes are all east of the Elbe and not one German
  tank is west of the Rhine.
- **Slovakia and Moravia**: the German 14th Army, standing on ground that is not
  German, which a generator keyed on nationality cannot do at all.
- **The Maginot Line**: fortress troops on the works, five armies a hex or two
  behind, and nothing of the kind opposite Belgium — which is the shape of May
  1940.
- **French armour**: 2,300 tanks in eight penny packets attached to infantry
  corps, against Germany's 3,390 in fourteen fists. The same argument both
  countries were having, visible without a word of explanation.
- **The BEF**: still in Hampshire. It does not cross until the 4th.
- **The American interior**: empty. So is Siberia, Soviet Central Asia, the
  Sahara, the Amazon, interior Australia, interior Canada and the Great Plains.
- **The Chinese countryside** between the Japanese corridors: empty, because the
  Japanese army held cities, ports and railways and nothing in between.

1,269 hexes of 114,492 hold anything at all. Roughly 60% of the German field
army stands in the heaviest tenth of German ground, 86% of the Japanese in the
heaviest tenth of Japanese; Poland is the deliberate exception, spread flat
along a frontier it could not hold, and the test suite asserts that it is
flatter than Germany rather than better.

Strength is apportioned within a formation by largest remainder rather than
rounded hex by hex, so every formation puts exactly its table strength on the
board — not one man more and not one fewer. The whole of it is deterministic,
and it is what lifts the colour on the Nations layer: a cell's brightness is
the weight of the garrison on it, on a logarithmic ramp, because a garrison of
ten thousand and one of a million are both worth seeing and a linear ramp would
show only the second.

## Marching

**One hex an order, and a column that arrives somewhere stands still the next
day.** That is 33 km a day, which is what an army on its feet did in 1939. The
panzer divisions did twice it and the model does not distinguish, because a rule
you can hold in your head is worth more here than one that is right about the
Wehrmacht and wrong about everybody else. Fortress troops do not march at all:
the whole argument about the Maginot Line is that it could not go anywhere, and
`mobility` below 0.1 says so.

**High ground costs a second day of that rest**, so a mountain hex takes three
days to enter rather than two. It is not shut, and nothing on this board is.
Sealing the mountains was considered and measured: it would wall off **7,138
cells, 21.7% of all land**, and leave **5,357 of them with no passable neighbour
at all** — permanently unconquerable, since there would be nothing to surround
them from. Denver would have no land route to San Francisco and Rostov none to
Persia. Height is expensive instead, which is also what the Ardennes turned out
to be.

### What moves

**A column: the part of a formation standing on one hex.** Not the formation,
because a formation is not in one place — the Kwantung Army holds 261 hexes and
cannot march as a thing. Not a number of men either, because then every order
needs a slider and every hex needs bookkeeping. What stands on a hex moves off
it whole and never divides further, so `de-1-panzer#0` is the 1st Panzer
Division's first detachment for as long as the game lasts, wherever it happens
to be standing.

### Giving the order

You pick **the hex you want held**, and the panel lists everything that can be
standing on it by morning. That is backwards from how a map usually works and it
is the question a staff officer actually asks — what can reach this place by
tomorrow — and it lets the one-hex rule choose the list, because the answer is
exactly the six hexes around it. Each candidate is named by its formation, the
direction it would come from and what it would bring; the ones that cannot come
say why.

Orders are for **the next day only**. Sending replaces the whole day rather than
adding to it, so unticking a column is how you cancel. Concentration is not
scheduled — you march six divisions to one place over six days, one order at a
time, in whatever view of it the enemy has.

### Where the answer lives

Nowhere twice. Positions are **replayed** from the opening deployment and the
log of marches that have happened, exactly as the stores are the opening figure
plus the net of every day since. Two copies of where an army is would eventually
disagree, and the copy that disagreed would be the one on screen.

The server builds the world too — the same code, the same `earth.bin` — and
checks every order against its own copy before accepting it. A column that has
just arrived, one two hexes away, one that belongs to France: all refused there
and not only in the browser. What crosses the wire is the log, never the map.

Executed marches are public; **orders for tomorrow are not**, and a seat is only
ever sent its own. The distinction is the honest one available here: the board
is deterministic and every client already builds every garrison from the same
tables, so where an army *is* could never have been a secret. What you *intend*
still is.

## Fighting for a hex

A cell is 4,455 km² and the heaviest of them holds 186,000 men, so a battle here
is not a battle — it is an army group's frontage for a day. That decides almost
everything about the model. **Losses are percentages, not counts**, nothing is
annihilated in an afternoon, and a fight that took a week in the histories is a
week of daily attacks here rather than one enormous roll.

There is no separate attack order. **You march onto a hex somebody else is
holding**, and if you are at war with them the day works out what happens. What
is refused is marching into a neutral you are *not* fighting: that is an
invasion, and an invasion is a declaration, which belongs to the timeline rather
than to a column commander.

### What each arm is worth

| | attacking | defending |
| --- | --- | --- |
| Infantry | 1 | 1.3 |
| Tanks | 90 | 40 |
| Artillery | 60 | 80 |
| Fighters | 25 | 25 |
| Bombers | 80 | 15 |

In men, and every figure is an argument. **A tank is 90 men going forward and 40
standing still**: a panzer division of 300 tanks and 13,000 men fought like two
or three infantry divisions, and armour dug in to hold ground wastes the only
thing that made it worth having. **Artillery is the reverse** — it killed more
men than anything else in both wars, and it killed most of them from a prepared
position onto ground the attacker had to cross. **Infantry defends better than
it attacks**, because it can dig. **Bombers hit hard and hold nothing.**
Fighters decide who else gets to do those things, which on the ground is worth
something and not much.

All of it is multiplied by the formation's **quality**, which is what stops
2.5 million Chinese infantry outweighing 1.8 million Japanese. That field has
been sitting in the order of battle since it was written and this is the first
thing to read it.

### What the ground is worth

The defender multiplies by terrain — mountain 2.0, swamp and jungle 1.6, forest
1.4, hills 1.25, plains 1.0, **beach 0.9**, because there is nowhere worse to be
caught. A city is worth another 1.3 on top; ask Stalingrad. And attacking uphill
costs up to a further 30%, read off the real height difference in metres.

Then both sides are rolled against a **±20% band**, seeded from the day and the
hex rather than from a generator with a hidden state — so a battle can be
recomputed from the record and comes out the same everywhere, which is what lets
the whole game be replayed rather than stored.

### Who leaves

The loser's share of losses rises with how badly it was beaten and the winner's
falls, both clamped: **nothing costs less than 2% or more than 35% in a day**. A
ten-to-one attack is cheap for the attacker and dear for the defender; an even
one costs both about a tenth of what they brought.

**Retreat is automatic and not a decision.** An army that has lost a position
withdraws — asking eight seats to choose each time would stall the day, and the
men on the ground were doing it without orders anyway. It falls back onto its own
nation's ground, preferring to put distance between itself and whatever pushed
it, then the hardest ground to be followed onto. Nothing random: the same rout
gives the same answer on every machine.

Two exceptions, and both are the same rule. **An army with nowhere of its own to
fall back to is destroyed where it stands**, losing 60% rather than 35%. And
**nobody retreats out of a capital** — Warsaw held for three weeks after the
campaign around it was decided, because by then there was nowhere left to
withdraw to that mattered. `world/capitals.js` lists the twenty-six governments
of 1939 and that is the only thing being a capital does.

A beaten *attacker* is not pushed anywhere. It goes back the hex it came from,
which it always can, because it was standing there that morning.

### Taking ground

A battle is not the only way a hex changes hands, and for most of a map it is
not even the usual one: **forty of Poland's seventy hexes hold no garrison at
all**, and until the rule below existed an army could march across every one of
them and take none. Ownership moved only when there was a fighting, and there is
no fight when nobody is home.

So there are three ways ground changes hands, and all of them require being at
war with whoever holds it:

- **Fought for.** The attacker wins and the defenders leave.
- **Walked into.** A column marches onto undefended enemy ground. It has to have
  *marched* — standing where you deployed does not take anything, or the 8th
  Route Army would own its base areas in Shanxi before anybody had given an
  order, which is not what a partisan base is.
- **Cut off.** An undefended hex whose every land neighbour is held by one enemy
  has been severed from whatever it belonged to and falls without anyone
  entering it. This is what mops up pockets, and it is the only way a mountain
  is ever taken from an army that will not come down off it.

The last is worked out against the ownership as it stood at the start of the
pass, so one pocket collapsing cannot collapse the next one in the same day. A
pocket gives way over days, and a cascade would depend on the order the cells
happened to be visited in.

### What that does to an offensive

A column that arrives somewhere rests the next day, and a column that has just
taken a hex has arrived. So **an attack cannot be repeated the following day by
the troops that made it** — pressing an offensive means feeding fresh columns in
behind, which is what relief in place is, and it holds an advance to roughly one
hex every two days. That was not designed; it falls out of the movement rule and
the combat rule meeting.

## The books

Each nation's page carries its own books down the left: what it holds, what the
ground it holds pays it, and what a day of standing still costs it. Not
fighting — existing. Engines are run, tracks and airframes wear out, shells are
fired on ranges, and men are drafted through to replace those leaving.

| | Oil in hand | A day's net | Lasts |
| --- | --- | --- | --- |
| Germany | 2.4 Mt | −13.7 kt | **174 days** |
| Italy | 1.8 Mt | −8.7 kt | 206 days |
| France | 3.0 Mt | −13.0 kt | 231 days |
| Japan | 5.3 Mt | −10.6 kt | 499 days |
| China | 100 kt | −7.9 kt | **12 days** |
| United Kingdom | 5.5 Mt | −1.1 kt | — |
| Soviet Union | 4.0 Mt | +53.0 kt | — |
| United States | 25 Mt | +416 kt | — |

That column on the right is the whole argument of the war in one number.
Germany opens with about three months of oil, which is what sent it into
Romania and eventually into the Caucasus; Japan with two years of it, and no
way of making more, which is what sent it into the Indies; China with a fortnight
and an army of two and a half million; the United States with a surplus of
everything it digs up — and no rubber at all, because rubber is a tropical crop
and every ton of it came from Malaya and the Indies. That last row is why
synthetic rubber became a war programme in Washington as well as in Berlin.

Stores are the opening figure plus the net of every day since, which makes them
a pure function of the date — the same trick the belligerence table uses, and
for the same reason: a number that is derived cannot drift out of step with the
thing it is derived from. When orders arrive and a player can spend, this is
what moves to the server. The **Actions** button under the books is where those
orders will go; it does nothing yet, and says so.

Totals for the whole board — ground held by each power, and the fighting
strengths this seat may count — sit behind the **Totals** button beside the
layer switches. Ground held is everybody's; the two military columns are not,
and stop at what the fog allows.

## The fleets of 1939

An army is spread over the ground its nation owns. A navy is not — it is a few
dozen ships in a handful of anchorages, and can be somewhere else in a week,
which is the whole point of it. So fleets are stations rather than a layer:
a diamond on the water, told apart from the round city dots at a glance.

| | Capital ships | Carriers | Cruisers | Destroyers | Submarines | Carrier aircraft |
| --- | --- | --- | --- | --- | --- | --- |
| United Kingdom | 15 | 7 | 62 | 181 | 60 | 230 |
| United States | 15 | 5 | 37 | 214 | 87 | 350 |
| Japan | 10 | 6 | 38 | 113 | 63 | 380 |
| France | 7 | 1 | 19 | 70 | 77 | 40 |
| Italy | 4 | — | 22 | 59 | 115 | — |
| Germany | 5 | — | 7 | 22 | 57 | — |
| Soviet Union | 3 | — | 7 | 54 | 165 | — |
| China | — | — | — | — | — | — |

Capital ships count battleships and battlecruisers together, and for Germany
the three panzerschiffe with them. The shape of the table is again the story:
seven British carriers, more than everyone else together, and only two British
capital ships built since 1918; the largest submarine forces in the world flying
the Soviet and Italian flags with nothing to put behind them; Japan embarking
more carrier aircraft than anyone; and China with nothing at all, its fleet
scuttled across the Yangtze at Jiangyin two years before to block the river.

**Where they were.** Two thirds of the Royal Navy in home waters and the rest
strung from Halifax to Sydney; the US Fleet on the American west coast, because
Pearl Harbor did not become its home until May 1940; the Regia Marina wholly
inside the Mediterranean; the Soviet navy split four ways between seas that
cannot reinforce one another. Shares are of each navy's whole strength and the
hulls are apportioned by largest remainder, so what reaches the board is exactly
what is in the table.

Two German ships are not at a station at all. Deutschland and Admiral Graf Spee
sailed for their war stations in August, before a shot was fired — one north of
Iceland, one south of the equator on the morning of the 1st — so they are named
ships rather than a share of a fleet, and they are **secret**: a raider at sea
is not an anchorage anyone knows about, and no other seat can see them. The
Admiralty did not find Graf Spee until December.

**Close in, the shading gives way to the units themselves.** Past about thirty
pixels a cell there is room to draw what is actually standing there, so the
board does — everything on the hex, not a selection of it, scattered over the
ground rather than lined up in a row. A row reads as a legend, a list of what is
here; scattered, it reads as men and machines standing on ground, which is what
it is. The scatter comes out of the cell number rather than a random generator,
so the same hex holds the same arrangement for ever and the map does not crawl.

  a helmet          infantry — the one shape that needs no legend
  a box with an oval  armour
  a box with a dot    artillery
  a small aeroplane   fighters
  a large one, twin-engined  bombers

Ships are silhouettes too, and a different one each: a battleship with turrets
fore and aft and a tripod mast, a cruiser with a single funnel, a destroyer low
and all bow wave, a carrier with its island and an aeroplane on the deck, a
submarine with a conning tower. Recognition manuals told them apart by their
outlines at sea, which is the same problem again. Counts appear beside each
symbol once there is room for them.

Only the cells near the middle of the view are considered — at that zoom the
screen holds a few hundred, and walking all 114,492 to find out which are on it
would cost more than drawing them.

**What the fog hides at sea is the count, not the anchorage.** Everyone knew the
Home Fleet lay at Scapa and the Regia Marina at Taranto; nobody outside the
Admiralty knew what was moored there on a given morning. So a foreign station is
drawn as an outline at a fixed size and the panel says its strength is not
known, while one you may count is filled, sized by its hulls, and labelled with
them — and close in, becomes the ships: a battleship, a carrier with its island
and an aeroplane on the deck, a submarine with its conning tower. A strength you
are not allowed to know never becomes a silhouette; it stays a diamond.

## Rendering

The globe is WebGL 2; the names and city dots on top of it are a plain 2D canvas
in the same place. Both draw outside React, so turning the globe never triggers
a re-render — the HUD only re-renders when hover, selection or the camera
readout changes.

**The geometry is uploaded once and never touched again.** Every cell is fanned
into triangles from its centre: 686,940 triangles, 2,060,820 vertices, about
33 MB. Corners are shared by three cells but their colours are not, so the
vertices cannot be shared either — that is what makes a border a hard edge
rather than a gradient.

**Colour is not in that buffer.** Each vertex carries only its cell number and
looks the colour up in a 512 × 256 texture holding one pixel per cell. Switching
between HexWW2.worldin, Nations, Forces and the resource layers, or handing a province
to someone else, therefore costs a single upload of half a megabyte — the
geometry never moves.

That indirection is the whole reason for WebGL here. The flat board could cache
its way out of trouble: the view was axis-aligned, so the world could be baked
into an image and chunks, and it had to be — painting the political map hex by
hex cost over 500 ms a frame with the world on screen. A globe turning under the
cursor has no such luxury. Every frame is a new projection, and nothing can be
pre-baked.

Measured under software rasterisation in a backgrounded tab, which is
pessimistic, and including a `readPixels` sync that itself costs a millisecond:

| | median | p95 |
| --- | --- | --- |
| Whole globe | 2.1 ms | 5.3 ms |
| Mid zoom | 3.2 ms | 6.7 ms |
| Close in | 2.9 ms | 6.0 ms |

Switching layer costs 3.4 ms. Picking a cell costs **6 microseconds**: a ray
from the eye to the sphere, then a lookup in a latitude/longitude bucket index
that turns a 114,000-way search into about a dozen dot products. Near the poles
a bucket is under a kilometre wide while a cell is 67 km, so the search widens
in longitude by 1/cos(latitude) — without that, cells near the poles could not
be clicked at all.

The sphere is lit by a fixed light, which needs no normal buffer: on a unit
sphere the position *is* the normal.

**Cell edges** are drawn as lines only once they are more than 7 px apart,
below which they would be a grey wash over the whole globe. Every edge belongs
to two cells, and taking it only from the lower-numbered of the pair draws each
one exactly once. The depth range is fitted to what is actually visible — near
plane at half the distance to the ground below, far plane at the horizon — 
because pinning the near plane near zero spends all the depth precision at the
surface, and the edges, lifted a thousandth of a radius clear of it, stop
passing the depth test entirely.

**Names and dots** are 2D canvas work, which is what 2D canvas is good at. Both
are placed through the same camera as the surface, so they stay pinned to their
ground as the globe turns, and both have a failure mode the flat board did not:
they can be round the back. A point is over the horizon exactly when its rotated
depth falls below 1 / distance, so labels switch off there rather than sliding
across the limb, and fade out as they approach it. Text also shrinks towards the
edge, where the ground is steeply foreshortened. Where labels would collide, the
larger country or city keeps its name and the smaller goes without.

## Layout

```
src/
  world/   sphere.js                              — the geodesic grid
           earth.js  earth.bin  earthData.js
           noise.js  terrain.js                   — terrain
           cities.js  regions.js  population.js   — people, 1939
           resourceSites.js  resources.js         — output, 1939
           nations.js  territories.js             — control, 1939
           capitals.js                           — the twenty-six governments
           oob1939.js deploy.js  forces.js    — the order of battle, and
                                                 where each formation stands
           navies.js                            — the fleets of 1939
           economy.js                            — stores, income and upkeep
           countries.js  leanings.js              — countries, colours, sympathies
  render/  globe.js  globeCamera.js  layers.js    — WebGL globe
           globeView.js                           — input and the frame loop
           labels.js  cities.js  fleets.js        — names, dots and fleets, in 2D
           units.js                              — what is standing on a hex
  ui/      App.jsx  NationIndex.jsx  Survey.jsx  — the pages
           routes.js routes.jsx                  — what a path means, and
                                                   the link that follows it
           Dossier.jsx                           — the whole of a hex, along
                                                   the foot of the board
           Economy.jsx  Totals.jsx               — the books, and the board
           WarRoom.jsx  WarLedger.jsx  EventCard.jsx
           intel.js (in world/)                  — what a seat may know
  game/    calendar.js  events.js                — the date, and the war table
           belligerence.js                       — who may fight whom, and when
           orders.js                             — what a seat may order on a hex
           movement.js                           — marching, resting and replay
           combat.js                             — what an arm is worth, and
                                                   who is left holding the hex
           players.js  state.js                  — the eight seats and the turn
tools/     build-earth.mjs  preview-earth.mjs     — data baking
```

`src/world/` is pure — it has no browser dependency at all now that the asset
URL is imported lazily — so the whole board can be built and checked under plain
Node, and the same code can run on a server as the authoritative map. That is
how the grid, the world build, the territory probes and the camera maths are all
verified.

## Not built yet

Air missions: fighters 3 hexes, bombers 10, returning to the airfield they left
— specified and not built, so aircraft presently fight only for the hex they are
parked on. Supply, which is the thing that should stop an advance outrunning its
railheads, and which the access layer built for deployment already knows enough
to model. Production, so that the stores mean something and Germany's 165 days
of oil have a consequence. And a way to win or lose, which the game does not yet
have: a nation reduced to nothing simply holds no hexes. The board carries terrain, movement cost (`TERRAIN[].move`),
population, six resource outputs and an owner per hex, exposes `neighbours()`
for pathfinding — six of them, all equidistant — marks which hexes are cities, and will log every transfer of
territory — but nothing drives them yet.
