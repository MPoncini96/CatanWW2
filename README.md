# Terra — Earth on a hex globe

The board layer for an online strategy game: planet Earth on 1 September 1939,
on a hexagonal grid wrapped around the sphere itself — the population of the
world, what the land produced, and who held it.

```bash
npm install
npm run build
npm start                 # the game on http://localhost:5170

# or, while working on it, two processes:
npm run server            # the game server
npm run dev               # the board, proxying /api across
```

114,492 cells, every one of them 4,455 km² — 67 km across, at the equator and
at the pole alike. 181 cities, 2.30 billion people, a year's output of food,
oil, iron, steel, aluminium and rubber, every acre of land assigned to one of
eight powers or to nobody, and the armies of 1939 standing on it.

## The game

One game, eight seats, and a calendar that starts on 1 September 1939.

You pick a nation when you arrive. There are no passwords yet — you say who you
are and the table believes you — but a seat already held cannot be taken, so
nobody becomes Germany by accident. Logging out gives the seat back.

**The calendar is the clock.** Nothing happens in real time. The day turns when
every player who has taken a seat presses *End Current Day*, and not before; a
day can last a minute or a fortnight. Pressing it is reversible right up until
the last player agrees, so you can change your mind. Seats nobody is sitting in
cannot hold the day up, which is what lets a game of three run at all.

**The war opens as it did.** What a nation may do is gated by the date, and the
timeline is a table of four rows:

| Date | Day | Event |
| --- | --- | --- |
| 1 Sep 1939 | 0 | Germany invades Poland. Nobody else may fight anybody. |
| 3 Sep 1939 | 2 | Britain and France declare war — and their empires with them, which puts Germany against 47 parties at a stroke. |
| 17 Sep 1939 | 16 | The Red Army crosses into Poland. |
| 10 Jun 1940 | 283 | Italy declares war, inheriting exactly Germany's enemies as they stand that day. |

Each lands as a dispatch in front of every player when the calendar reaches it.

Rights are **replayed from that table** rather than stored with the game, which
has two consequences worth the trouble: the state of the war can never drift out
of step with the timeline, and an event added months from now applies correctly
to a game already halfway through 1940. `sameAs` is what lets Italy inherit
Germany's war without naming a single country — it is resolved against the wars
already declared when the calendar reaches June 1940, so it picks up whatever
Germany actually accumulated.

Nothing acts on any of this yet. You can see that on 2 September Germany may
fight Poland and nobody else, but there are no orders, no movement and no
territory changing hands — that is the next pass, and this is the seam it plugs
into.

### What is not the game

`src/game/` is pure: no browser, no network, no clock, no file. It is verified
under plain Node like `src/world/` is — 4,800 days round-tripped through the
civil calendar, every belligerence rule checked on the day either side of the
event that grants it, and the turn engine driven through four days of two
players agreeing and disagreeing.

The server around it holds exactly one game and writes it to a single JSON file.
**It never sends the map.** The world is deterministic, so client and server
each build the same 114,492 cells from `earth.bin` and only the date, the seats,
the readiness and the event log cross the wire — a couple of kilobytes, pushed
over server-sent events whenever anything changes.

One browser is one seat: seats are remembered in `localStorage`, which is shared
between tabs of the same profile, so two players on one machine need two
profiles.

## Controls

| Input | Action |
| --- | --- |
| Drag | Turn the globe (let go mid-turn and it keeps spinning) |
| Scroll / pinch | Zoom in and out |
| Arrow keys | Turn · `+` / `-` zoom · `0` reset |
| Click a cell | Select and inspect it · click empty space to clear |
| Click the minimap | Jump to that part of the world |
| Names checkbox | Show or hide country names |
| Cities checkbox | Show or hide the settlement layer |
| Layer buttons | Shade the map by nation, by army, or by what the land produced |

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
correction is visible in the tallies: Russia went from 5,854 land hexes to
4,625, Britain from 6,946 to 8,032, and the world's land fraction from 33.6% to
28.7% against the real 29.2%.

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

Every hex carries a year's output of six things, as of 1939. A tile can
carry several at once — Anshan raises iron ore *and* pours steel; the Ruhr makes
steel on ground that also grows food.

This is **output, not endowment**: what was actually being pumped, mined and
grown, not what happens to lie underground. So Saudi Arabia is nearly dry —
Dammam had only just come in and produced about 60 kt against Texas's 25,000 —
Libya has no oil at all, and the Athabasca sands and the Pilbara are blank.

**Minerals and industry** (`resourceSites.js`) are 159 real places with their
annual output: the East Texas field, Baku, Maracaibo, Ploiești; the Mesabi
Range, Lorraine, Kiruna, Krivoy Rog; the Ruhr, Pittsburgh, the Donbas, Yawata;
Bitterfeld, Arvida, Chippis. Every site lands on a land hex within one tile
of its true position.

Two of the six are not dug up at all, and sit where industry put them rather
than where geology did. **Steel** needed coal, ore and capital in one place —
the Ruhr, Pittsburgh, the Donbas, Sheffield. **Aluminium** needed cheap
electricity above all, which is why Norway, Switzerland and Saguenay in Quebec
smelted so far out of proportion to their size, and why Germany — building an
air force — out-produced everyone.

**Rubber and fisheries** are areas rather than points, spread over the tiles
inside them: the Malayan and Sumatran estates that grew over 90% of the world's
natural rubber, and the fishing grounds from the Dogger Bank to the Grand Banks.
Japan was the largest fishing nation on earth. Zone boxes overlap — Malaya and
Sumatra share the Strait of Malacca — so a tile is claimed by the first zone
that covers it and no ground is worked twice.

**Food** works differently from everything else, because it is the one thing
that followed people rather than geology. Before cheap long-haul transport most
of what a district ate, it grew, so cropland output scales with local settlement
— which puts the market gardens around the cities, as asked. Pasture is much
less labour-hungry, so grazing stays productive out in the empty country: the
pampas, the veld, the Australian runs. On top of that sit the export
breadbaskets and irrigated deltas — the corn belt, the prairies, the Ukrainian
black earth, the Irrawaddy and Mekong deltas, Java's sawah — which produced far
above what their own population would suggest.

World totals land close to the real ones:

| | Board | Actual 1939 |
| --- | --- | --- |
| Oil | 264 Mt | ~280 Mt |
| Iron ore | 181 Mt | ~200 Mt |
| Steel | 132 Mt | ~137 Mt |
| Aluminium | 696 kt | ~700 kt |
| Rubber | 1.06 Mt | ~1.1 Mt |
| Food | 1.16 Gt | grain-equivalent, incl. catch |

National shares come out close too: the USA at 58% of world oil against a real
61%, and 36% of steel against 34%; Germany's aluminium the largest in the world.

The limits are the same ones the population layer has. Producing areas are
rectangles, not borders, so a zone edge can cut across the map — the farm layer
is smoothed over neighbouring tiles to keep region boundaries from drawing a
straight line across Asia, but a faint step survives. And a 125 km hex is
coarser than most orefields: Lorraine and Luxembourg's Minette are one tile, as
are Tokyo and Yokohama.

## Who held what

Every land hex belongs to one of the eight powers — the United States,
Great Britain, France, Germany, Italy, Russia, China and Japan — or to nobody,
which is drawn grey. The sea belongs to no one and is never coloured.

Borders are those of **1 September 1939**, so this is the world as the war
opened, not as it ended: Greater Germany includes Austria and Bohemia-Moravia
but Poland is still independent; Italy holds Libya, Albania and Ethiopia; Japan
holds Korea, Formosa, Manchukuo and the slice of China it had taken by late
1939, with free China holding the interior; France and Britain hold their
empires entire.

The neutral list follows the Axis & Allies Global 1939 *Midnight Express*
variant, which keeps an unusually long one — Poland, the Baltic States, Norway,
Sweden, Switzerland, Spain-Portugal, Eire, Turkey, Persia, Afghanistan, Saudi
Arabia, the East Indies and Borneo, Angola and Mozambique, and the whole of
Latin America outside the American possessions. Two departures, because eight
powers were asked for: ANZAC folds into Great Britain, as the Dominions largely
did in 1939, and there is no separate Dutch power — the Netherlands and their
East Indies stay neutral, which in September 1939 they still were.

Set against the historical record, the board gives back the strategic picture
the war actually turned on:

| | Land tiles | People | Steel | Oil |
| --- | --- | --- | --- | --- |
| United States | 2,219 | 121M | 47.1 Mt | 154 Mt |
| Great Britain | 6,929 | 640M | 17.1 Mt | 7.8 Mt |
| Russia | 5,930 | 227M | 18.6 Mt | 29.0 Mt |
| Germany | 112 | 71M | 20.2 Mt | 0.7 Mt |
| Japan | 662 | 281M | 6.7 Mt | 0.3 Mt |
| France | 1,721 | 144M | 9.7 Mt | — |
| Italy | 612 | 55M | 1.9 Mt | 0.1 Mt |
| China | 711 | 83M | — | — |
| Independent | 20,786 | 677M | 10.9 Mt | 72.3 Mt |

Germany with the second-largest steel industry on earth and almost no oil, and
Japan with a tenth of America's steel and none of its own oil, are not artefacts
of the model — they are the reason both went to war the way they did.

### Countries, not just powers

The eight belligerents are drawn in their own colours wherever they and their
empires reach, so the shape of the war stays readable at a glance — India and
Australia fly British gold, Indochina French blue. Everyone else gets a colour
of their own rather than sharing one anonymous grey, because a map where Hungary
and Romania are the same shade is not much of a map.

**112 countries** hold land. A country is a group of territory boxes, since a
country's shape rarely fits one rectangle: Yugoslavia takes three, Mexico three,
mainland Italy four. Neutral colours are hand-assigned rather than generated, so
that countries sharing a border also differ in hue.

Names are written across the ground each country covers, sized by how much land
it holds — the Soviet Union reads at a glance, Luxembourg has to be zoomed into.
The anchor is not the centroid, which for a scattered empire puts "United
Kingdom" in the mid-Atlantic; each country is broken into connected blocks and
labelled on the largest, at the point furthest from any edge, so the name sits
in open ground rather than across a coastline. Country names are laid down
first and city names give way to them, so a capital is never printed across the
middle of its own country's name.

Ten places are smaller than a single hex and so hold no ground at all — Malta,
Gibraltar, Bermuda, Guam, Wake, Puerto Rico, the Panama Canal Zone, the
Dodecanese, the South Seas Mandate and the Bahamas. They are in the territory
table and will appear if the grid is ever refined.

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

Every hex a power holds carries a garrison — infantry, tanks, artillery,
fighters and bombers — and the totals are the real orders of battle on the eve
of the war:

| | Infantry | Tanks | Artillery | Fighters | Bombers |
| --- | --- | --- | --- | --- | --- |
| Germany | 3.18M | 3,200 | 11,000 | 1,100 | 1,600 |
| Soviet Union | 2.40M | 21,000 | 40,000 | 4,000 | 3,500 |
| France | 2.90M | 3,300 | 11,000 | 700 | 400 |
| Britain | 1.10M | 1,150 | 1,300 | 750 | 550 |
| Italy | 1.60M | 1,500 | 7,000 | 800 | 800 |
| Japan | 1.70M | 2,000 | 5,000 | 1,200 | 1,000 |
| China | 2.50M | 100 | 800 | 200 | 100 |
| United States | 190,000 | 400 | 800 | 800 | 500 |
| The neutrals | 5.20M | 2,600 | 9,000 | 900 | 500 |

The shape of that table is the story: the Red Army with more tanks than everyone
else combined and the Wehrmacht with a fifth as many; the United States, about
to out-build the world, fielding an army smaller than Portugal's.

The neutral row is a pool, not a bloc — thirty separate armies that never fought
as one, of which Poland alone is about a million men and 880 tanks. Leaving them
out would put Poland at zero while the Wehrmacht massed on its border.

**Where they stand** matters as much as how many there are. Armies of this
period concentrated on the frontier they expected to fight on and left the
interior thinly held, so deployment is driven by three things: the theatres each
power was actually watching (`DEPLOYMENTS` in `forces.js` — the Polish frontier,
the Maginot Line, the Manchurian border, the Suez Canal), whether a hex sits on
a border with a power that nation had reason to fear, and where the people and
the factories are. Ground and air are scored separately: aircraft sit on
airfields near cities and industry rather than out on the line.

The result reads the way the histories do — about 71,000 men on the German side
of the Silesian border against 11,000 in Berlin, the Maginot hexes nine times
Paris, Yakutsk with a couple of hundred.

Units are apportioned by largest remainder rather than rounded hex by hex.
Britain has 1,150 tanks and 6,852 hexes: round each independently and almost
every hex floors to zero, quietly losing two thirds of the tank park. Flooring
first and then handing the remainder to the hexes with the largest fractions
keeps every power's total exact and puts the leftovers where the pressure is
greatest.

Deployment is deterministic. The forces layer colours each cell by whose troops
stand on it and darkens it by how few there are, on a logarithmic ramp — a
garrison of ten thousand and one of a million are both worth seeing, and a
linear ramp would show only the second. Land nobody garrisons goes grey:
Antarctica, Greenland's ice, the empty quarter of the Sahara.

Unlike the other overlays, the sea keeps its own colours here rather than
receding to a flat backdrop. Armies sit only on land, so the water is not
competing with them for attention, and leaving it alone keeps the coastlines —
which is where the fronts of 1939 mostly ran.

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
between Terrain, Nations, Forces and the resource layers, or handing a province
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
           forces.js                              — armies, 1939
           countries.js  leanings.js              — countries, colours, sympathies
  render/  globe.js  globeCamera.js  layers.js    — WebGL globe
           globeView.js                           — input and the frame loop
           labels.js  cities.js                   — names and dots, in 2D
  ui/      App.jsx  Minimap.jsx                   — React HUD
tools/     build-earth.mjs  preview-earth.mjs     — data baking
```

`src/world/` is pure — it has no browser dependency at all now that the asset
URL is imported lazily — so the whole board can be built and checked under plain
Node, and the same code can run on a server as the authoritative map. That is
how the grid, the world build, the territory probes and the camera maths are all
verified.

## Not built yet

Networking, players, units, turns, and any rule that would make ownership move
on its own. The board carries terrain, movement cost (`TERRAIN[].move`),
population, six resource outputs and an owner per hex, exposes `neighbours()`
for pathfinding — six of them, all equidistant — marks which hexes are cities, and will log every transfer of
territory — but nothing drives them yet.
