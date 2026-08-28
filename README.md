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

One game, seven seats, and a calendar that starts on 1 September 1939.

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

### One inspector, and a rail that is not one

The hex lives in the **dossier**, along the foot of the board: the place, the
people, what it makes, what holds it, what has been fought over it and what is
moored off it, all in columns at once. It is read in a sweep rather than
scrolled, which is why it lies across the bottom, and it folds down to its own
title bar when the globe wants the whole screen.

There used to be a second inspector in the rail, layer-scoped, answering only
the question the map was currently asking. That was the right idea before the
dossier existed and pure duplication afterwards — the same hex described twice,
in two shapes, in two places. It is gone, and took 197 lines of App.jsx with it.

The ground itself — terrain, height, temperature, rainfall — is the one column
that follows the layer, and appears only on Terrain. On Nations you are asking
who holds a hex and on Output what comes out of it, and neither question is
answered by how wet it is.

### The rail, and its drawers

What is left on the left is what you *work with*: the seat, who else is at the
table, the button that ends the day, and the hour at which it ends itself.

Everything else there is **reference** — the stores, the manpower, the industry,
the map key — and reference now lives behind a row of three names with one open
at a time. The rail had grown to seven stacked blocks in a column three hundred
pixels wide, and the test that failed was writing the industry panel and then
having to scroll to find it. It no longer scrolls at all.

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
| Fighters | 18 | 30 |
| Bombers | 80 | 15 |

In men, and every figure is an argument. **A tank is 90 men going forward and 40
standing still**: a panzer division of 300 tanks and 13,000 men fought like two
or three infantry divisions, and armour dug in to hold ground wastes the only
thing that made it worth having. **Artillery is the reverse** — it killed more
men than anything else in both wars, and it killed most of them from a prepared
position onto ground the attacker had to cross. **Infantry defends better than
it attacks**, because it can dig. **Bombers hit hard and hold nothing.**

**A fighter is worth two thirds as much over somebody else's ground as over its
own**, and the gap is the largest of any arm on the table. At home it fights on
ground control, it is minutes from its own airfield, and a pilot who jumps lands
among friends and flies again next week. Over the enemy it is at the end of its
range, it is watching the fuel gauge, and every loss is permanent. That asymmetry
decided the Battle of Britain — the RAF recovered half its shot-down pilots and
the Luftwaffe recovered none of them — and it is why every air force in the war
found defence cheaper than offence.

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
withdraws — asking seven seats to choose each time would stall the day, and the
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

### Walking to the war

A nation's armies are deployed where a nation keeps armies, which is not where
the fighting is. Germany opens with divisions in Bavaria, in the Rhineland, in
East Prussia and around Berlin, and getting them to the Polish frontier was a
fortnight of ticking the same boxes on the same six hexes every morning. That is
not a decision. It is the absence of one, repeated.

So **an army with nothing better to do walks towards the nearest enemy of its own
accord, and stops when it gets there.** Two rules make that safe to leave on:

**It stops at the line.** Stepping onto ground somebody else is holding is an
attack, and an attack is a decision — so the standing order brings a column up
to the frontier and leaves it there. Nothing is ever committed to a battle by a
rule the player did not think about that morning.

**An order beats it.** Anything you have told a column to do this morning is what
it does; the advance only ever moves the columns you said nothing about. That is
the whole of how it is overridden, and it needs no second mechanism. There is
also a switch in the rail for a player who would rather place every division by
hand.

Only the manoeuvre elements go — field formations and armour. Depots, flak,
fortress troops and security garrisons hold what they are standing on, which is
what they were put there for.

The route is a breadth-first field: every hex of your ground carries its distance
from the contact line, and a column steps to the neighbour with a smaller number.
Ground with no way to the front — an island, a pocket cut off behind the enemy,
or anywhere at all when you are fighting nobody — is marked -1 and nothing on it
moves. Britain on 1 September has no front, and no British division stirs.

It ends. Germany moves 64 formations on the first morning, 38 on the second, 13
on the third, and nothing after that: the army arrives and the record stops
growing. What it leaves behind is 115 moves, which is the whole of the German
concentration against Poland.

### Two armies, one road

Battles are found by two armies standing on one hex. In a straight swap — A
ordered onto B's hex while B is ordered onto A's — nobody ever shares one, so
until this rule existed **they marched through each other**. The Polish Army
Pomorze charging the German 3rd Army finished the day *behind* it on German
soil, having never fought the thing it charged, while Germany walked into the
position it had left.

A head-on pair is now caught before the moves are committed, and goes one of two
ways depending on how lopsided it is.

**Evenly matched — a meeting engagement.** Neither gets through. Both moves are
cancelled, both columns stay where they started, and they fight with **no
terrain bonus for either side**: nobody is dug in, both were in the open and
moving, and the hex the fight is recorded on is an accident of which index was
lower. The loser falls back out of its *own* position — and is never pocketed,
because the winner is still a hex away and nobody was overrun. No ground changes
hands. Win the encounter and the road in front of you is empty *tomorrow*, which
keeps one hex a day honest.

**Heavily one-sided — the stronger presses home.** At **three to one or better**
the big army does not stop; only the weak one's march is cancelled, so the
stronger arrives on top of it and the day resolves an ordinary attack, with the
weaker defending its own ground and getting the terrain for it.

That threshold exists to kill a specific trick: parking an army by throwing a
battalion head-on at it. Without it, a token force could cancel any advance in
the game for the price of the token force, every day, for ever.

On the frontier of 1 September there are 224 places a German column stands next
to a Polish one. 56 of those pairings are under 3:1 and would be meeting
engagements; 168 are over it and the German would shoulder through — which is
about the right shape for that particular week.

Only a **true swap** counts. A column that moves aside while another moves in has
genuinely gone, and the ground behind it is genuinely free.

Both halves are written down, because a player who ordered an attack and got a
defence is owed a sentence about why. The day's report says either *"met Poland
head-on"* or *"14th Army never got away — it ran head-on into the enemy doing
the same thing"*, with the odds it ran into.

## Supply

Nothing in the model stopped a German column marching to Vladivostok. It would
arrive tired, and then fight exactly as well as it had at home, which is the one
thing every campaign of this war says is impossible. The Wehrmacht did not stop
outside Moscow because it ran out of Germans.

**Two stages, because that is how it worked: the railways carry it a long way,
and then it goes on lorries a short way.**

1. From every **depot**, out along the rail network as far as **22 hexes**.
2. From every hex the railways reached, out over any ground at all as far as
   **5 hexes**. This is the tail, it is about three hundred kilometres, and it
   is why an advance stops.

A depot is a **city**, a **railhead** or a **port**. Cities because that is what
a city was for and why they were the objectives — taking one extends your reach
rather than merely adding to your score.

**Enemy ground conducts nothing**, and that is the whole point of it. A column
encircled on a captured railhead is standing on a railway that goes nowhere. So
is a besieged city: a depot ringed entirely by people you are fighting is a
depot under siege, and Berlin surrounded is Berlin cut off. Neutral ground does
conduct, because the 14th Army spent the last week of August in Slovakia and was
not living off the land.

### What it costs to be without it

An army out of supply fights at **three fifths**, loses **4% of itself a day**,
and is sent no replacements. The starvation goes into the same record as the
battle casualties, flagged `starved`, because it is the same thing: men coming
off a column. Nothing needs a second shape to say so.

### How the data got there

The rule was written first and then held against one question — **is every army
on the board fed on the first morning?** Every one of them was deployed where it
could be maintained; that is what a deployment is. So an army starving on 1
September means the rule is wrong, not the order of battle.

It found four things, in this order:

- **No sea supply at all**, which starved East Prussia across the Corridor and
  Libya across the Mediterranean.
- **Depots only where the 189-city table had a city**, which is nowhere between
  the Urals and the Pacific — so the Transbaikal Front, fed in reality by the
  Trans-Siberian, starved on its own frontier.
- **Trackless ground refusing to conduct at all**, which starved the Leningrad
  district on the Finnish border.
- And then, once every coast fed an army: **a column that had walked to the
  Arctic shore of Siberia was in supply.** The population data cannot tell a
  port from a beach — the cells under Benghazi and Aden both read zero people
  while the Ob estuary reads four thousand — so the ports are named, like the
  railheads and like the colonial garrisons before them.

`world/depots.js` holds both lists. They are not cities and were never meant to
be; several were sidings. For the purpose of getting shells forward that is what
they were.

The check is now a test, and it is the strongest one in the suite: **every army
on the board can be fed on the first morning.** The only exceptions are
formations the order of battle deliberately puts on somebody else's ground — the
8th Route Army in the Shanxi hills inside the Japanese occupation, and the
Gibraltar, Malta and Aden garrisons, all three of which are smaller than a 67 km
hex and so are placed on the nearest land the board has, which for Malta is
Sicily.

### On the map

Ground of yours that nothing can reach is drained towards a dead grey. It keeps
its colour, because a hex has to go on saying whose it is, but a salient that
has outrun its railheads reads as a pale finger before anybody has to be told.
On the Soviet page the Trans-Siberian is visible as a thread of live colour
through a continent of it.

Only your own ground is drawn that way. What the other side can feed is not
something you would know.

**One simplification worth naming:** sea supply asks nothing about who commands
the sea. A port you hold feeds you whether or not a convoy could reach it.
Blockade is a naval matter, and the navies do not do anything yet.

## Replacements

A column that has been fought over comes out at sixty per cent, and seven days
of losing badly leaves five. Without a way to put men back, a war here ends in
mutual exhaustion rather than a decision — which is not how any of the armies of
1939 worked. They rebuilt divisions endlessly out of the draft and the
factories, and the side that could do it faster won.

**You rebuild what you have and never invent anything new.** A column is
restored towards the strength its formation deployed with and not one man past
it. That keeps the order of battle meaning something — 178 formations stays 178
— and it is what happened: the 4th Army was rebuilt several times and was the
4th Army each time. Raising new formations is a different feature.

### What it costs

| | |
| --- | --- |
| A man | 0.8 t steel, 2 kg rubber, and one civilian |
| A tank | 25 t steel, 2 t rubber, four crew |
| A gun | 6 t steel, six crew |
| A fighter | 2.5 t aluminium, a pilot |
| A bomber | 8 t aluminium, five crew |

Mind the units, which are not the same for every store: oil, iron and steel are
kept in **kilotonnes** and aluminium and rubber in **tonnes**, because that is
how the outputs of 1939 were published and it is what the economy already
carried.

### How fast, and where

**Three things ration it, and they are three different questions.**

**Can anything get there?** That is supply, and it is asked first. A column out
of supply is sent nothing at all.

**How much can one formation absorb?** Up to **8% of itself a day**. A division
cannot double overnight however many rifles are waiting: the men have to be
found, moved and put in the right companies.

**How much can the country make?** That is the factories, and it is the limit
that actually binds.

### The factories

A **works** is one of the **53 steelworks** in `resourceSites.js` — Pittsburgh,
the Ruhr, Magnitogorsk, Le Creusot, Yawata — each with its real 1938–39 output.
They were already on the board as sources of income. They now do a second job:
they are what turns steel into rifles, and they belong to whoever holds the hex.

Capacity is measured in **plant-days**, where one plant-day is one man's kit —
the smallest thing a war economy makes. Everything else is measured against him:

| | plant-days |
| --- | --- |
| A man | 1 |
| A field gun | 8 |
| A fighter | 20 |
| A tank | 30 |
| A bomber | 60 |

Ratios of *industrial effort*, which is why a fighter costs more than a gun that
outweighs it several times over. A thousand tonnes of annual steel is worth
seven plant-days, set so that Germany's 18,800 kt comes out at about 130,000 —
which is what the old flat rate gave it, so the balance measured then still
holds. A nation with no heavy industry still rebuilds a little out of its own
people, which is negligible beside a working Ruhr and is the whole of what China
has.

That produces the industrial geography of the war as a single column of figures:

| | works held | steel, kt/yr | plant-days a day |
| --- | --- | --- | --- |
| United States | 9 | 48,000 | 338,000 |
| Soviet Union | 6 | 18,600 | 135,000 |
| Germany | 6 | 18,800 | 133,000 |
| United Kingdom | 11 | 16,200 | 128,000 |
| France | 6 | 13,700 | 99,000 |
| Japan | 4 | 6,700 | 52,000 |
| Italy | 3 | 1,900 | 15,000 |
| China | 0 | 0 | 1,700 |

Italy at a ninth of Germany and China at nothing at all are not adjustments;
they are what the steel tables said.

### What it produces

- Ask for Germany's whole army to be rebuilt and **81 of 167 columns** are sent
  men. The day spends **133,306 plant-days of 133,336** — the factories fill and
  stop. Which formations get the men is the decision, and it is the player's.
- A formation smashed to two fifths comes back in about **a week and a half**.
- **The Ruhr alone is 64% of German steel**, and three hexes are 86% of it. Its
  hex holds the heaviest anti-aircraft concentration on the board and no field
  troops whatever — which is a target described from two directions at once.
- A works that has been bombed contributes nothing until it is repaired.
  `capacityFor` already takes the raids and reads them; there is simply nothing
  yet that fills the list.

### Where the answer lives

The same place as everything else. A column is what it deployed with, **less
what the battles took, plus what the factories put back** — worked out again
from the record every time it is asked for. The stores are the opening stock
plus every day's net since, **less everything already spent**; still derived
from the calendar, with a second term rather than a balance that gets edited.

Replacements arrive **after** the day's fighting, so a column cannot be topped
up into the middle of the battle it is losing. And a seat that asks for six
columns and can pay for four gets the first four, in the order it ticked them —
a decision the player has already made, and better than a rule that spreads the
shortfall evenly and rebuilds nothing properly.

**Retreat is not on the Actions menu any more.** It was, and it should not have
been: a beaten army falls back on its own, and offering it as an order implied a
choice that does not exist. The three things a seat can do to a hex are march
in, march onto somebody, and send up replacements.

## Men

The war economy was half a model. Stores said whether the steel existed and the
factories said whether anybody could turn it into rifles, and between them they
decided everything — which meant a division cost twelve kilotonnes of steel and
about a tenth of one day of German industry, and nothing else at all. **Nobody
had to find the men.**

That is the wrong shortage. Steel was never what stopped Germany raising
divisions in 1944; eighteen-year-olds were. Britain broke up whole divisions in
1944 to keep the others up to strength. So there is now one pool, and two things
draw on it: **replacing the formations you have, and raising new ones.** That is
the trade, and it is the one every general staff in the war actually argued
about.

### The rate

**Seventy men a million a day at home, three a million in an empire.**

The home figure is set from what the war took out of each country, and the
striking thing is how little the number varies: Germany's 13.6 million over six
years from a home population of 74 million, the Soviet Union's 34 million from
216 million, and American conscription all land within a few per cent of each
other. That three unlike states agree is not a coincidence — it is roughly what
a twentieth-century industrial society can take out of itself and still work.

The colonial rate exists for Britain, which holds 725 million people and is
40 million at home. India raised two and a half million men from four hundred
and eighty-seven million, entirely by volunteering — there was no conscription,
no reserve system, and in most places no intention of arming the population at
all. At the home rate Britain raises the largest army in history, twice over.

| | over six years | actually mobilised |
| --- | --- | --- |
| Soviet Union | 33.2M | 34M |
| United States | 16.5M | 16.1M |
| China | 12.7M | 14M |
| Germany | 11.5M | 13.6M |
| United Kingdom | 10.7M | 8.7M |

Thirty days' intake is trained and waiting on the first morning, which for
Germany is the Ersatzheer — the replacement army that existed precisely so the
field army did not have to wait for the next class to be called up.

## Raising a formation

Until now a nation could rebuild what the order of battle gave it in September
1939 and nothing else, so over six years the war could only shrink. That is the
wrong shape for this war above all: the United States Army had nine divisions in
1939 and eighty-nine in 1945.

A formation is ordered at a **city or works you hold and can supply**, and it
appears there months later.

| | to raise | men |
| --- | --- | --- |
| Infantry division | 90 days | 15,040 |
| Motorised division | 120 days | 13,030 |
| Armoured division | 180 days | 11,230 |
| Artillery brigade | 60 days | 2,120 |
| Fighter group | 120 days | 1,620 |
| Bomber group | 150 days | 2,590 |

Everything is paid **on the day it is ordered** — the class is called up, the
contracts are placed — and the men are out of the depots for the whole time they
are training, which is exactly where they were. What arrives is a formation like
any other: it marches, fights, starves and can be rebuilt exactly as the ones the
war started with.

### What it took to fit into the board

Everything on this board is replayed from a fixed opening list, so a formation
that was not in 1939 has nowhere to live. The roster now grows: a finished
raising is appended to it, built from the record alone so that the server and
every client construct the identical formation from the identical entry.

The cost of that is one line in `strengthsAt`: a placement carries the day it
came into being, and has **no strength before it**. Without that a division
ordered in 1943 turns up at full strength in the record of 1940, because the
roster is one list and a list does not know about time.

Appending is idempotent by id, because both the server and every client replay
the whole raising record whenever they load, and a division must not be raised
twice for having been read twice.

## The day's returns

Everything a war does here goes into four lists — the battles, the ground, the
starvation, and what came up from the depots — and until this existed **none of
it was anywhere a player could see.** You ended the day, the map quietly
changed, and the only way to find out how was to click every hex you held and
read them one at a time. The dispatch cards that pop up are timeline events,
not your war.

So the report opens on its own when the day turns and there is something to
say, and closes to a button in the top bar. It says, in order: who you fought
and how it went, what changed hands, who is going hungry, what the factories
managed — **and what they refused**, with the reason. A player who asks for
fifteen columns and is given four should be told why, and the day used to
swallow that silently.

Nothing is stored for it. Ask again tomorrow and it works tomorrow out.

### Two things it got wrong first

**The parts did not add up to the whole.** A column that fights in the morning
and goes hungry in the afternoon is in two entries of the record, and reading
each as *how much less of it is there than yesterday* charges the whole day to
both — so the report said the battle cost 7,900 men and the famine 8,000, out
of 7,900 lost in all. The day is now walked in the order it happened, each entry
taking its own share off a running strength. There is a test that the parts sum
to the total, and it is the one that caught this.

**Every hex in Poland was called "Poland".** Three separate fights all reported
from the same place name is not telling anybody where anything happened; Poland
is seventy hexes. A place is now the city if there is one and the region *with
its coordinates* if there is not.

## Orders on the ground

You ticked columns in a panel, pressed send, and the globe showed nothing — so
there was no way to look at your own plan, and none at all to remember it an
hour later. A day's orders were the one thing on this board that existed only
in the player's head.

An **arrow** from where each column stands to where it is going, and a **dashed
ring** on any hex expecting men from the depots. Several columns commonly march
into one hex from the same neighbour, so the arrows are counted rather than
stacked: six down one lane is one arrow with a 6 on it. They are drawn only for
the seat that gave them, and only past nine pixels a cell, below which an arrow
is wider than it is long.

Four of them converging on one hex is what a concentric attack looks like, and
it needs no legend.

## The clock

**A day that only ends when all seven seats have said so ends when the slowest
player wakes up.** There was no way to proceed without them at all, which is
the difference between a demo and something people can play across time zones.

A day now closes on its own after twenty-four hours, whoever has not finished.
Anyone who gave no orders simply gave no orders — a real cost, and the point:
the war does not wait, and neither did any of the actual staffs. The war room
says when it will turn.

Two things it will not do. It never turns an **unattended** board — a game
nobody is sitting at stays where it was left rather than running through the
war overnight. And a game **saved before the clock existed** reopens its day on
load rather than finding itself a year overdue and turning eight hundred times.

Set `HEXWW2_DAY_HOURS` to play faster, which is also how the clock was tested:
a five-second day, one seat that gave no orders, and the log saying *the day ran
out; germany gave no orders*.

## Strategic bombing

Everything on this board had been waiting for it. Fighters have carried a
combat rating since the day they were placed and it decided nothing; the
anti-aircraft formations were a label; the Ruhr sat under the heaviest flak
concentration in the world guarding nothing at all; and `capacityFor` has taken
a list of raids since the factories were built without anybody ever putting one
in it.

**A bomber group flies from its airfield to a works within ten hexes** — about
seven hundred kilometres, which is a He 111 or a Wellington with a bomb load. It
is contested by **fighters within three hexes of the target**, because a Bf 109
could neither escort nor intercept further than that, and by **whatever flak is
standing on the hex**. Guns do not travel; they defend the hex they are on.

Only by people you are actually fighting. The first version counted every
aeroplane on earth that was not yours, so a raid on the Ruhr in September 1939
was met by the Dutch and the Belgians as well as the Luftwaffe — 236 fighters
where there should have been 170. While nobody could shoot back at them it was
merely a thumb on the scale. It stopped being harmless the moment escorts
arrived, because it would have had Fighter Command destroying neutral air forces
over countries nobody had invaded.

Nobody takes any ground. That is the whole point of the thing, and the argument
about whether it was worth doing lasted the entire war.

### One night, one raid

Everything a power sends against one works on one day is **a single raid**.
Bomber Command is three groups on three airfields and it did not attack the Ruhr
three times in a night — it attacked once, together, and the reason to do so is
that a large formation saturates a defence that would destroy a small one. The
first version resolved each group separately and every one of them was cut to
pieces on its own: 160 bombers, half of them lost, the works shut for a single
day. Nobody makes that trade twice.

Sent together, the same aircraft do this:

> **480 bombers sent, 408 through, 15% lost** — against 170 fighters and 1,000
> guns. The Ruhr out for **nine days**, which is **64% of German steel** gone
> with it.

A seventh of Bomber Command for nine days of German industry is a real decision,
and it is the decision the whole offensive was about. An undefended works costs
almost nothing and is shut for a fortnight, which is why you defend one.

A group that flies is turned round the next day and cannot go again — the same
rule as a column that marched, for the same reason.

### What it costs

Aircraft, and only aircraft. The first version took the loss share off every arm
in the group, so seventeen per cent of the bombers were shot down and seventeen
per cent of the fitters who fuelled them went with them. A casualty entry may
now name the arms it touches, and a raid names bombers.

The damage is a line in the record — `{ day, cell, until }` — so a works is out
until the day it is not, and `capacityFor` reads it without knowing anything
about aeroplanes. Replacements are sent **after** the bombers have flown: a
works put out this morning makes nothing this afternoon, and that single
ordering is the whole of what strategic bombing does here.

## Escort

A fighter had exactly one offensive job and this is it: **a fighter group
ordered against a target flies escort**. It takes no ground, it bombs nothing,
and it lands back on the airfield it took off from — which is true of every air
mission here, because a raid emits no move record and never has.

The fight over the target now produces **three numbers rather than one**:

| | what it loses |
| --- | --- |
| The bombers | what the escort could not hold off, plus the guns |
| The escort | what the interceptors got through it |
| The interceptors | what the escort got through them |

Before this, only the first of those existed. The defending fighters were
invulnerable: they took a raid apart every night for six years and never lost an
aeroplane.

**An escort is worth 0.72 of the interceptor it is holding off.** The interceptor
picks its moment; the escort cannot. It is tied to bombers flying a straight line
at a fixed height and speed, it cannot chase, and it has to be where its charges
are — so it fights the fight the defender chooses. That is why escorting was the
harder job and the one that took longest to solve.

### What it buys

Bomber Command against the Ruhr, the same 480 bombers every time:

| escort | through | lost | RAF fighters lost | Luftwaffe fighters lost |
| --- | --- | --- | --- | --- |
| none | 408 | 15% | 0 | 4 |
| 300 | 434 | 10% | 32 | 20 |
| 600 | 435 | 9% | 32 | 40 |

The four German fighters lost to the unescorted raid are the floor that applies
to everything in the air — two per cent, the same floor the bombers get. Bomber
formations had gunners and the gunners hit things.

Three things fall out of that and all of them are the argument the USAAF had
with itself for four years.

**The first escort is worth sending.** Three hundred fighters save 26 bombers and
cost 32 of their own — roughly even in airframes, and much better than even in
crews, since a bomber carries five men and a fighter carries one.

**The second is not, for the bombers.** Doubling the escort saves one more
bomber. The escort can shoot down fighters and it can never shoot down a gun, so
**flak is the floor** — once the escort outweighs the interceptors, everything
still lost over the Ruhr is lost to the thousand guns standing on it, and no
number of fighters touches that.

**But it doubles what the Luftwaffe pays.** The escort's own losses are flat —
the interceptors shoot down what they can shoot down, however many come at them —
while German losses scale straight with the escort sent. Which is the whole of
the case for the long-range escort as an attrition weapon rather than as
protection, and the reason it eventually won: not that it got the bombers
through, but that it made coming up to meet them unaffordable.

A fighter group is turned round the next day like any other, and a group carrying
both fighters and bombers does both jobs on the same flight.

## Close support

Aircraft could do exactly three things on this board and none of them was
attacking anybody. They could wreck a **factory**; they could **shoot down**
somebody else's bombers; and if you marched an air group onto a hex a battle
happened to be fought over, its aircraft counted towards that battle at eighty
points a bomber. So the Luftwaffe of 1939 — built almost entirely around
supporting an army in the field — could not support an army in the field.

A **strike** is the strategic raid pointed at troops instead of at a works, and
it shares everything with it: the same ten hexes of range, the same interception
by fighters within three, the same flak, the same escort, and the same arithmetic
for who does not come home — one `airCombat`, called from both, because it is the
same flight whichever the target is. Two things make it its own mission.

**It happens before the fighting.** The order of a day puts strikes ahead of the
battles, so bombing a hex in the morning and assaulting it in the afternoon is
one plan rather than two days of work. That is the whole reason to have it.

**The ground protects.** The multiplier a defender gets for standing in mountains
or a city is the same multiplier that protects it from the air, because it is the
same fact about the ground: men in a wood are hard to bomb for exactly the
reasons they are hard to shell. The panel leads with it — *18k men · the ground
is worth 1.40 to them* — because it is the decision.

Twelve men a bomber, because most bombs missed. What air attack actually did to a
division was stop it moving in daylight and break up its concentrations; the
casualties were a by-product. And never more than **8% of a hex in a day**,
however much you send: air power did not destroy armies, and the ceiling only
starts binding above about a hundred and seventy bombers, so a squadron gets a
squadron's result and an air fleet gets an air fleet's.

What that comes to: Luftflotte 1 putting 280 bombers onto an undefended Polish
position on the coast kills 2,353 men and drops its defence from 27,165 to
24,952 — worth having before an assault, and nowhere near enough to take the
hex. The ground still has to be won on the ground.

The range limit does real work. From Silesia and Pomerania the Polish positions
are two to five hexes off; Luftflotte 3, facing France, is twelve, and is told
so: *a bomber of 1939 goes 10 and comes back.*

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

## The Pacific

A hex is 4,455 km². Iwo Jima is 21 km², Tarawa is 31, Wake is 7, Midway is 6.

So the entire Central Pacific rounded to open water. Of twenty-four places the
Pacific war was decided at, **twenty-one came out of `earth.bin` as ocean** —
Guadalcanal, Okinawa, Saipan, the Marianas, the Marshalls, the whole Aleutian
chain, and Pearl Harbor, which was a stretch of empty sea with a fleet moored on
it.

The ownership tables had known about them all along and had nowhere to put them:
Guam, Wake, the Marianas, the Carolines, the Marshalls, the Solomons and the
Western Aleutians all had territory boxes claiming **zero hexes**, because a box
can only claim ground that exists.

`islands.js` puts the ground there — about fifty of them, stamped onto the
nearest water cell before terrain, population, resources or ownership are worked
out. Everything downstream then treats them as ordinary land, and **the 1939
tables claimed them without a line changing**: Guadalcanal came out British in
the Solomons, Saipan and Truk and Kwajalein Japanese in the South Seas Mandate,
Attu and Kiska American in Alaska. Attu and Kiska matter: they were invaded in
June 1942 and held for over a year, the only American soil occupied in the war.

Sizes are real areas rounded up to a minimum of one hex, and deliberately not
generous. Guadalcanal is one hex, and the point of it was never its size.

### Who is on them

Small garrisons, and **34 of the 50 islands have nobody at all**.

That is not an omission. On 1 September 1939 most of these places were held by a
district officer and a police sergeant. **Wake** had Pan American Airways and a
construction gang; the Marine detachment did not arrive until August 1941.
**Attu** had forty-five Aleuts and a schoolteacher, and Dutch Harbor was not
begun until 1940. The Japanese mandate was *forbidden fortification* by the
treaty it was held under, so Truk has the 4th Fleet setting up house and very
little behind it — the fortifying started in 1940. Guam had 153 Marines and 247
men of the Insular Force Guard, and the Naval Act of 1939 had just declined to
fortify it on the grounds that doing so would provoke Japan. It fell in two days.

An empty island is why a battalion could take one, and why the Pacific war looked
the way it did.

What did go on: the Ceylon, Fiji, Bermuda, Jamaica, Mauritius and Falklands
defence forces; the New Guinea Volunteer Rifles and the Solomons constabulary;
the Guam, Midway and Samoa naval stations; the New Caledonia and Tahiti
colonials; the 4th Fleet base staff and Okinawa. And **the Netherlands East
Indies army** — 35,000 men of the KNIL, which was missing entirely and was the
only thing standing between the oil of Sumatra and Borneo and anybody who wanted
it.

### Three flags the map had wrong

Filling in the Pacific meant fifty new pieces of land arrived unclaimed, and the
country layer assigns unclaimed ground to the nearest thing that *is* claimed.
Mostly that worked: the Aleutians came out American, Rabaul Australian, the
Carolines Japanese. Three did not.

**Tarawa and Makin came out Japanese**, because the South Seas Mandate was the
nearest claim — but in 1939 they were the Gilbert and Ellice Islands Colony, and
Japan did not take them until December 1941. Tarawa is remembered as a Japanese
fortress; it was a British one first, and briefly. **Tahiti** was handed to Fiji,
four thousand kilometres away and British. **Ascension** was handed to Liberia.
All three now have their own boxes, along with Nauru, Mauritius and both halves
of Samoa — which was split in 1899, the western islands eventually to New Zealand
and Tutuila with its harbour at Pago Pago to the United States.

### And a garrison standing in the sea

The island stations were garrisoning **Mauritius from a hex of open ocean**,
because Mauritius is 2,040 km² — half a hex — and had never been stamped. Worse,
the starvation rule did not complain, because it had *just* been taught that a
column standing on water is a column on a ship and therefore fed.

Two lessons, both now tests. Mauritius is on the board. And the suite asserts
directly that **not one formation anywhere is deployed onto water** — a garrison
in the sea is a data bug, not a convoy, and the ship guard must not be allowed
to hide one.

The eleven garrisons that then starved on their first morning did so because a
beach is not a harbour. Koror, Kwajalein, Naha, Tulagi, Pago Pago, Papeete,
Namlea, Makassar and the rest went into the ports table after them.

## When a government falls

Every other rule here settles one hex at a time. That is the right model for a
campaign and the wrong one for the end of a country: France did not lose 30,000
hexes in six weeks, it lost about a fifth of them and then signed, and the rest
changed hands in an afternoon because a government in Bordeaux said so.

**Hold an enemy capital for one full day and the country capitulates.** Taken
this morning is a raid and the country has until tomorrow to take it back; still
held tomorrow is a government that has stopped governing.

Then the country splits in two, and the halves go to different people.

| Capital falls | Metropole → | Empire → | |
| --- | --- | --- | --- |
| Brussels | the conqueror | **Britain** | the Congo |
| Amsterdam | the conqueror | **Britain** | the East Indies, Suriname, Curaçao |
| Copenhagen | the conqueror | **Britain** | Iceland and Greenland |
| Oslo | the conqueror | **Britain** | |
| Athens | the conqueror | **Britain** | |
| Paris | the conqueror | **nobody** | Vichy — up for grabs |
| Warsaw, Belgrade | the conqueror | — | there is no empire |

Five governments went to London in 1940 and their empires went with them. The
arithmetic of that is the point of the whole rule: taking Belgium, the
Netherlands and Denmark gains Germany **21 hexes** and gains Britain **1,470** —
along with 64% more oil and twice the rubber, because the Netherlands East
Indies is the second-largest oil producer in the Allied world and Japan comes
for it three years later.

**France is the exception, and it is the interesting one.** Vichy kept the
empire and fought Britain for it: Mers-el-Kébir in July, Dakar in September,
Syria in 1941, Madagascar in 1942 — while Japan walked into Indochina in the
same months. So the French empire goes *neutral* rather than British. Handing
2,345 hexes and 115 million people to Britain for taking one city would be the
largest windfall in the game; turning them loose starts a scramble, which is
what actually happened.

The army does not change sides. A capitulated country's formations and fleets
are gone — 1.8 million French soldiers went into captivity in six weeks, and the
navy was scuttled, interned or seized inside two years. Its trade routes shut
for good, because a lane needs a country at the far end of it. What a successor
inherits is ground and what is under it, and no troops to hold it with, which is
exactly the strain Britain was under.

**The great powers cannot capitulate.** No great power in this war surrendered
on losing its capital — France is the single exception, which is why France is
on the list and the seven seats are not. Taking Moscow is devastating and it is
not a surrender.

### France is a country, not a seat

There are **seven seats**. France keeps its colour, its ground, its army, its
navy and its trade routes; what it has not got is anybody giving it orders.

That is deliberate. On this board France is a thing that *happens to you* rather
than a thing you play: an unplayed France sits in the Maginot, does not
manoeuvre, does not counterattack, and loses Paris — and when Paris goes, six
weeks of war resolve in a day and the map redraws itself from the Rhine to the
Congo. Sitting a player there and asking them to lose on schedule would be a
worse job than any of the seven that are left. `/france` now falls back to the
index rather than breaking.

One consequence worth knowing: if Warsaw falls before the Soviet player has
marched, *all* of Poland goes to Germany. The 17 September entry declares a war;
it does not move any ground. Stalin's share of Poland has to be taken, and there
are ten days to do it in.

## Getting an army across water

Land units marched between adjacent land hexes and nothing else, and the
consequences of that were much larger than they looked.

**Tokyo sat on a 55-hex island and London on a 47-hex one, so neither could ever
be taken.** Sicily had four hexes and not one was walkable from the Italian
mainland, so Italy could only be beaten by beating Germany first. San Francisco,
Los Angeles and New York were on another continent. **Both Axis victory
conditions were therefore unreachable** — each needs a sea crossing — and of the
fifty Pacific islands, 46 were isolated single hexes that nothing could reach.

A fleet now lifts columns. They **embark** from a coast onto a fleet in the water
beside it, they ride while it steams, and they **land** onto a coast beside
wherever it has got to, into whatever is standing there.

### How a column crosses

A column aboard is given a move record each day mirroring the ship, so its
position *is* the ship's position. That is the whole trick, and it is why
nothing downstream had to be rewritten: `positionsAt` is nine lines, knows
nothing about ships, and goes on being the single answer to where everything is.

What it costs is three guards. A column at sea **takes no part in a land
battle** — it is standing on water and cannot fight for ground. It **captures
nothing**. And it **does not starve**, because it is on a ship with the rations,
where without the guard every army afloat would starve on the crossing.

### What a fleet can lift

Six hundred men a hull, submarines excepted. That is set from the largest
landing anybody ever did: the Royal Navy's 265 surface hulls come to about
159,000 men and Overlord put 156,000 ashore on the first day. So **the whole of
one navy, concentrated, is one Normandy** — and Portsmouth on its own lifts
14,400, which is enough for an anti-aircraft command and not nearly enough for
the BEF. A squadron does not carry an army.

Tanks weigh forty men each and guns twelve, which is why the first wave was never
an armoured division.

### What a landing is worth

Almost nothing on the day. An assault fights at **45%** of its strength, and its
tanks and artillery at 15% of that again — at Omaha nearly every tank launched
offshore sank before it reached the beach, and at Tarawa the landing craft
grounded on a reef and the marines waded the rest. In practice infantry comes
ashore at 38% of what it marches at and armour at 18%, so **an assault needs
about four to one to match a defender on the beach**.

Shore bombardment, which has existed since the navy was built, does exactly what
it was for: anything of yours lying offshore and not itself in action fires in
support.

And an army caught at sea goes down with the ships carrying it. That is the whole
risk of the operation and the reason nobody mounted one without command of the
water first: a division on a transport cannot shoot back, cannot dig in, and
cannot run.

## The war at sea

For a long time the fleets were furniture. They sat at sixty-five anchorages,
could not move, could not fight and could not be lost, while everything else
grew around them. This is the rest of it.

### Moving

Like a column, in that an order names a destination and the day carries it out.
Unlike a column in the one way that matters: **a ship steams through the night.**
An army marches eight hours and sleeps; a fleet does not, which is why it makes
six hexes a day and a division makes half of one. Six hexes is four hundred
kilometres — eighteen knots held for a day and a night, a fleet passage rather
than a dash. There is no rest day for the same reason.

A fleet's position is replayed like everything else here: the opening anchorage
plus every sailing since. Nothing is stored twice.

**The submarines are their own command.** At Wilhelmshaven the U-boats were
pulled into a separate flotilla, and the same everywhere else. This is the same
decision the armour got when the armies were deployed, for the same reason: if
the only orderable thing at Wilhelmshaven is "Wilhelmshaven", then sending the
boats into the Atlantic sends the battleships with them, and no navy worked that
way.

### What each ship is worth

| | Attacking | Defending |
| --- | --- | --- |
| Battleship | 100 | 100 |
| Carrier | 120 | 30 |
| Cruiser | 45 | 45 |
| Destroyer | 25 | 32 |
| Submarine | 85 | 15 |

The spread between the columns is the character of the type. A carrier strikes
from beyond the horizon and is a floating hangar if anything reaches it. A
submarine is the same bargain drawn harder — the most dangerous thing in the
water while it is unseen and nearly helpless once it is not. A battleship is the
only type as good at one as the other, which is what people meant by a capital
ship.

Then a counter matrix, and every entry in it is something that happened:

- **A submarine against a capital ship** is *Royal Oak* at Scapa and *Courageous*
  in the Western Approaches, both inside the first month. Twenty boats against
  four battleships is about nineteen to one.
- **A destroyer against a submarine** is the answer to it, and the reason a
  convoy escort was destroyers and nothing else.
- **A submarine against a destroyer** is a bad afternoon for the submarine.
- **A submarine against another submarine** goes to whichever moved second. The
  boat lying quiet hears the boat under way, so a defending submarine is worth
  eight times its own defence against an attacking one — large, because it has to
  overcome the hunting boat's own bonus to come out the right way round.

There is no holding a hex of water. Nobody captures the sea, so the beaten side
is simply the one that loses ships and the winner is left with the sea room,
which is all anybody ever won at sea.

### The guns offshore

A battleship one hex from a land battle adds about two thousand men to it, a
cruiser six hundred. Enough to decide a close fight on a coast and never enough
to take an inland one, which is what shore bombardment was for and the limit of
what it did.

**Only from a fleet that is not itself in action.** A battleship engaged with
another battleship is not shelling anybody's trenches — which is why the sea is
resolved before the land each day, so that what is free to fire is already
known.

### The convoys

Every other rule here is about who is standing on a hex. This one is not. A
trade route is something a country *needs* rather than something it holds:
Britain in 1939 imported two thirds of its food, all of its oil and most of its
iron ore, and the entire German naval effort for six years was the proposition
that if you cut enough of those lanes the island stops.

So a lane is modelled as a stream, not a ship. The token on the water is one
convoy standing for the whole trade — it sails its track, out and back, on a
schedule nobody orders it to keep — and while it is at sea the lane pays its
cargo into the stores every day. It cannot be ordered anywhere, which is the
point of a convoy: an admiral who could reroute the whole Atlantic trade every
morning would never lose a ship.

Twelve lanes: Halifax and Trinidad and the Cape and Abadan to Britain, New York
and Algiers to France, Narvik and Luleå to Germany, the Levant to Italy, the
Indies and the Pacific to Japan, and the Guianas to a neutral America. Each is
built by interpolating great circles between waypoints, snapping every sample to
water, and stitching what is left over a water-only search — so a convoy is
somewhere every day and can be met there. Two hops survive that: Suez and the
Bosphorus, both genuinely dry at 67 km to the hex, and a ship crosses them the
way a ship did without the water being drawn.

**Beat the escort and the convoy is not damaged, it is gone.** There is no such
thing as a merchant ship that lost the action and steamed on. The lane pays
nothing for twelve days while a new convoy is made up, and the stores feel it
the same morning — `economyFor` reads the sinking record directly, so the whole
effect of six years of commerce raiding is a function of that one list.

It takes a pack to do it. One flotilla of twenty boats breaks an ordinary
escort; the Halifax run, which was worth twelve destroyers, needs two. That is
the shape of the tonnage war: the answer to the U-boat was never a better ship,
it was more escorts on the convoy that mattered.

### What the cargo figures are, and are not

They are not the historical tonnages divided by 365, and trying to make them so
was the first thing that failed — Britain landed about 44 million tons in 1939,
which at this scale would swamp every other number on the panel and make home
production irrelevant.

They are the *share of the war effort that came by sea*, which is what the
mechanic is about. Against the opening incomes the lanes carry 76% of British
oil, all of France's, 93% of Italy's and 95% of Japan's; 46% of German iron ore,
which is why Narvik mattered so much; and every ton of American and Japanese
rubber, none of which grew north of the tropics. The stores panel says so under
each figure — *76% by sea* — because that is the number a submarine is aimed at.

Cut them all and the stores start falling in weeks rather than years, which is
the pressure the real blockade applied, arriving at the right answer by a route
the tonnage tables do not take.

## How the war ends

Until now it could not. Every other rule decides a hex, a day or a country; none
of them decided the game, and a nation reduced to nothing simply held no hexes
and went on being asked for orders.

The shape is asymmetric, because the war was. **An Axis power is finished when
its own capital falls. An Allied one is not** — losing London does not end
Britain, and losing Moscow did not end the Soviet Union in any of the years it
nearly happened.

### The Allies win by beating all three

| | is finished when |
| --- | --- |
| **Germany** | Berlin is held by the Allies |
| **Italy** | every hex of **Sicily** is lost — or Germany goes first |
| **Japan** | Tokyo is held — or the Asian mainland is gone *and* the cities are burnt |

**Sicily rather than Rome**, because Sicily is what actually did it. Husky landed
on 10 July 1943; Mussolini was deposed on the 25th and the armistice signed on 3
September — with Rome still in German hands, and staying there another nine
months. Rome was never the point.

And when Italy goes, **its ground goes out of the war with it.** 875 hexes pass
to nobody: an armistice is not a conquest, and both sides may then walk onto it,
which is exactly what the next twenty months were.

Italy following Germany is not a shortcut either. Italy was a junior partner
whose war depended entirely on German strength, and it left the moment that
strength stopped covering it.

### Japan's second door

Tokyo is one way. The other is the one that actually happened: **lose Manchukuo
and occupied China, and lose 0.5% of the home islands' population to bombing.**

That number is the historical one — roughly 400,000 civilians of about 72
million. On this board the home islands hold 53 million, so the bar is **267,205
dead**, which at twelve per bomber-through is about 22,000 bomber-sorties: two to
three months of maximum effort, on top of a land campaign that has already taken
the whole Asian mainland.

It is measured against the **home islands**, not the empire. Summing everyone on
Japanese ground gives 277 million — Korea, Formosa, Manchukuo, occupied China —
and it would then *shrink* as Japan lost them, moving the bar while somebody was
climbing it.

There is a chain hidden in this, and it is the right one: a bomber goes ten
hexes, so burning the Japanese cities means basing within ten hexes of them,
which means holding the Marianas or Okinawa, which means the islands above.
Saipan is why there is a B-29 campaign.

### The Axis wins by finishing the job

Either **Paris, London and Moscow all held *and* China erased**, or **San
Francisco, Los Angeles and New York held**.

China is the hard half, and it is a whole country rather than a capital on
purpose: China's government had already lost its capital twice by 1939 and gone
on fighting from further up the Yangtze. There is no one city whose loss ends
China, which is precisely why Japan was still there in 1945.

### What a player sees

A **The war** panel in the rail, sent down from the server rather than worked out
in the browser, so the scoreboard and the rule that ends the game are one answer
and not two. It shows each Axis power's state, the dial on Japan's bombing bar,
and a row of lights for each Allied losing condition. When it is over a banner
takes the top of the page, a beaten power may give no more orders, and the day
stops turning.

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

### Tomorrow, drawn on today

A day's orders used to exist only in the player's head, which is the wrong place
for them. Four things are now drawn on the board, and the whole point of the set
is that they do not look alike.

**A march** is a solid gold arrow, one hex long, stopping short of the middle of
the hex it enters so the head sits on the edge rather than on top of whatever is
standing there. Several columns going the same way are one arrow with a count on
it, because six arrows along one line is one arrow drawn six times.

**An advance** — the march the standing order will make if you say nothing — is
the same arrow at half the weight and dashed. The only question a player has
about these is which ones are theirs, so the answer is in how they are drawn. It
is worked out on the client by the same function the server runs at the end of
the day, on the same inputs, so what is drawn is what will happen rather than a
guess at it. Give a column an order and its ghost disappears on the next frame,
which is the whole of how the standing order is overridden.

**A flight** is a dashed arc in a cold blue nothing on the ground uses, with a
ring on the airfield it leaves from. Bowed rather than straight because a
mission is the one order that does not concern the ground it crosses: a straight
solid line from an airfield to a works reads as a march through everything in
between, which is exactly the wrong thing to say about aircraft. Raids on works
and strikes on troops are drawn the same, being the same aeroplanes on the same
night.

**A hex waiting on the depots** is a dashed green ring.

Arrows switch off below nine pixels a cell, where they are shorter than their
own heads. Flights stay on down to three, because a bomber goes ten hexes and is
still a legible line across half of Germany at a zoom where a march is a smudge
— and that is exactly the zoom at which you are looking at where the aircraft
are going.

### The button that ends the day

Pinned to the foot of the rail, and the rail scrolls underneath it. It used to
sit halfway down that column, under the seat list and above five drawers, so on
a short window — or with a hex selected and the dossier open across the bottom
of the map — it was simply below the fold. A player who had just spent ten
minutes giving orders had to go looking for the way to say they were finished.

Everything else in that column is reference. This is the one thing that is an
action, and it is the last one of the day.

### One button, and a way out

Every order panel had **Done** and **Send orders**, and Done did neither thing
its name promised: it shut the panel and left every box that had been ticked
still ticked, so a panel opened by mistake put orders on the map behind it.

There is now one confirming button — **Save & close**, which sends the orders to
the server, shuts the panel and lets go of the hex — and **Cancel**, which puts
back what the server last confirmed and shuts, keeping the hex. The server's
copy is the only truth about what has been ordered, which is why it is what gets
restored rather than a snapshot taken on opening.

The asymmetry over the hex is deliberate. Saving is the end of what you were
doing with that ground, so leaving it ringed in gold with its dossier open says
the opposite. Giving up on a panel usually means you are about to open a
different one on the same hex.

Clicking the selected hex a second time deselects it. The way out of a selection
used to be finding somewhere you did not care about and clicking that, which is
not a way out.

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
           depots.js                             — railheads and ports, 1939
           oob1939.js deploy.js  forces.js    — the order of battle, and
                                                 where each formation stands
           navies.js                            — the fleets of 1939
           economy.js                            — stores, income and upkeep
           countries.js  leanings.js              — countries, colours, sympathies
  render/  globe.js  globeCamera.js  layers.js    — WebGL globe
           globeView.js                           — input and the frame loop
           labels.js  cities.js  fleets.js        — names, dots and fleets, in 2D
           orders.js                             — the arrows of tomorrow, the
                                                   ghosts of the standing order
                                                   and the arcs of a night's
                                                   flying
           selection.js                          — gold along the hex you clicked
           units.js                              — what is standing on a hex
  ui/      App.jsx  NationIndex.jsx  Survey.jsx  — the pages
           routes.js routes.jsx                  — what a path means, and
                                                   the link that follows it
           Dossier.jsx                           — the whole of a hex, along
                                                   the foot of the board
           Economy.jsx  Drawer.jsx               — the books, and the rail
           Totals.jsx  DayReport.jsx             — the board, and the day
           WarRoom.jsx  EndDay.jsx  EventCard.jsx  — the seat, the one
                                                   control that never scrolls
                                                   away, and the dispatches
           intel.js (in world/)                  — what a seat may know
  game/    calendar.js  events.js                — the date, and the war table
           belligerence.js                       — who may fight whom, and when
           orders.js                             — what a seat may order on a hex
           movement.js                           — marching, resting and replay
           combat.js                             — what an arm is worth, and
                                                   who is left holding the hex
           bombing.js                            — the works, and the flak
           production.js                         — the factories, and putting
                                                   the men back
           supply.js                             — and getting it forward
           report.js                             — what the day brought
           players.js  state.js                  — the seven seats and the turn
tools/     build-earth.mjs  preview-earth.mjs     — data baking
```

`src/world/` is pure — it has no browser dependency at all now that the asset
URL is imported lazily — so the whole board can be built and checked under plain
Node, and the same code can run on a server as the authoritative map. That is
how the grid, the world build, the territory probes and the camera maths are all
verified.

## Not built yet

Shipyards, which now have something to do: hulls can be lost, so they can be
replaced, and the yards are the obvious next thing the factories should learn to
build. Blockade of the coasts, as against of the trade routes — sea supply is
still assumed rather than earned, so East Prussia and Libya feed themselves
across water nobody controls. Fighter sweeps and escorts: a fighter presently
defends and never flies. Fuel, which is the one thing a fleet needs that this
does not model — a ship steams six hexes a day for ever and never puts into
port. Raising new formations, as against rebuilding the ones in the order of
battle. And a way to win or lose, which the game still does not have: a nation
reduced to nothing simply holds no hexes. The board carries terrain, movement cost (`TERRAIN[].move`),
population, six resource outputs and an owner per hex, exposes `neighbours()`
for pathfinding — six of them, all equidistant — marks which hexes are cities, and will log every transfer of
territory — but nothing drives them yet.
