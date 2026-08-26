import { TILE_COUNT, cellAt, grid, neighbours } from './sphere.js';
import { TERRAIN } from './terrain.js';

// The fleets of 1 September 1939, at the stations they were kept at.
//
// Armies are spread over ground a nation owns; a navy is not. It sits in a
// handful of anchorages and can be somewhere else in a week, which is the whole
// point of it — so it is modelled as stations rather than as a layer over the
// sea, and the board draws a marker on the water rather than colouring it.
//
// Numbers are the standard orders of battle for the day war broke out, and the
// shape of them is the story: the Royal Navy with more of everything and most
// of it in home waters, the Regia Marina and the Soviet fleet with more
// submarines than anyone and nothing to put behind them, the Kriegsmarine with
// 57 U-boats and five capital ships, and China with nothing at all — the
// Chinese fleet had been sunk or scuttled in the Yangtze two years before.

export const SHIPS = [
  { id: 'battleships', name: 'Battleships', short: 'BB', color: '#f0d98c' },
  { id: 'carriers', name: 'Carriers', short: 'CV', color: '#7fd8c0' },
  { id: 'cruisers', name: 'Cruisers', short: 'CA', color: '#c8b0e8' },
  { id: 'destroyers', name: 'Destroyers', short: 'DD', color: '#9fb8d0' },
  { id: 'submarines', name: 'Submarines', short: 'SS', color: '#d88fa8' },
];

export const SHIP_INDEX = Object.fromEntries(SHIPS.map((s, i) => [s.id, i]));

/**
 * Hulls in commission on 1 September 1939, and the aircraft the carriers
 * embarked. Capital ships count battleships and battlecruisers together, and
 * for Germany the three panzerschiffe with them: Graf Spee was already at sea
 * in the South Atlantic that morning, waiting for a war to start.
 */
export const NAVIES_1939 = {
  // Fifteen capital ships, and only two of them built since 1918. Seven
  // carriers is more than everyone else together, and 181 destroyers is the
  // Atlantic convoy escort force that was about to be found insufficient.
  uk: { battleships: 15, carriers: 7, cruisers: 62, destroyers: 181, submarines: 60, aircraft: 230 },
  // Two oceans and a fleet still based on the American west coast — Pearl
  // Harbor did not become its home until May 1940. Half the destroyers are
  // laid-up four-pipers from the last war, which is why fifty of them could be
  // handed to Britain a year later.
  usa: { battleships: 15, carriers: 5, cruisers: 37, destroyers: 214, submarines: 87, aircraft: 350 },
  // The most carrier aircraft in the world, and a doctrine to go with them.
  japan: { battleships: 10, carriers: 6, cruisers: 38, destroyers: 113, submarines: 63, aircraft: 380 },
  // Strong on paper and split between two seas, with the fast Dunkerques built
  // to catch exactly the German panzerschiffe they never met.
  france: { battleships: 7, carriers: 1, cruisers: 19, destroyers: 70, submarines: 77, aircraft: 40 },
  // 115 submarines, the largest force in the world, and not one carrier: the
  // Regia Marina held that Italy itself was the aircraft carrier.
  italy: { battleships: 4, carriers: 0, cruisers: 22, destroyers: 59, submarines: 115, aircraft: 0 },
  // Five capital ships and 57 U-boats, of which only 26 could reach the
  // Atlantic. Graf Zeppelin was never finished.
  germany: { battleships: 5, carriers: 0, cruisers: 7, destroyers: 22, submarines: 57, aircraft: 0 },
  // 165 submarines across four seas that cannot reinforce each other, and three
  // battleships of 1914 that never left the Baltic and the Black Sea.
  ussr: { battleships: 3, carriers: 0, cruisers: 7, destroyers: 54, submarines: 165, aircraft: 0 },
  // Nothing. What there was went down at Jiangyin in 1937, scuttled across the
  // Yangtze to block it, and the rest was bombed at Wuhan.
  china: { battleships: 0, carriers: 0, cruisers: 0, destroyers: 0, submarines: 0, aircraft: 0 },
};

/**
 * Where each fleet was kept, and how much of it.
 *
 * Shares are of that navy's whole strength and sum to one per power. They are
 * the peacetime disposition rather than a snapshot of any single hour — ships
 * move — but the weight is right: two thirds of the Royal Navy in home waters,
 * the Regia Marina wholly inside the Mediterranean, the Red Banner Fleet split
 * four ways between seas that cannot reinforce one another.
 */
export const STATIONS = [
  // ------------------------------- Royal Navy -----------------------------
  { power: 'uk', name: 'Scapa Flow', lat: 58.9, lon: -3.1, share: 0.26 },
  { power: 'uk', name: 'Rosyth', lat: 56.1, lon: -3.2, share: 0.08 },
  { power: 'uk', name: 'Portsmouth', lat: 50.7, lon: -1.1, share: 0.09 },
  { power: 'uk', name: 'Plymouth', lat: 50.3, lon: -4.3, share: 0.08 },
  { power: 'uk', name: 'The Nore', lat: 51.5, lon: 1.2, share: 0.05 },
  { power: 'uk', name: 'Gibraltar', lat: 36.0, lon: -5.4, share: 0.05 },
  { power: 'uk', name: 'Alexandria', lat: 31.3, lon: 29.9, share: 0.11 },
  { power: 'uk', name: 'Malta', lat: 35.9, lon: 14.5, share: 0.04 },
  { power: 'uk', name: 'Halifax', lat: 44.6, lon: -63.5, share: 0.04 },
  { power: 'uk', name: 'Freetown', lat: 8.4, lon: -13.3, share: 0.03 },
  { power: 'uk', name: 'Simonstown', lat: -34.2, lon: 18.4, share: 0.02 },
  { power: 'uk', name: 'Aden', lat: 12.8, lon: 45.0, share: 0.02 },
  { power: 'uk', name: 'Trincomalee', lat: 8.6, lon: 81.2, share: 0.03 },
  { power: 'uk', name: 'Singapore', lat: 1.2, lon: 103.9, share: 0.05 },
  { power: 'uk', name: 'Hong Kong', lat: 22.3, lon: 114.2, share: 0.02 },
  { power: 'uk', name: 'Sydney', lat: -33.9, lon: 151.3, share: 0.03 },

  // ------------------------------- US Navy --------------------------------
  { power: 'usa', name: 'San Pedro', lat: 33.7, lon: -118.3, share: 0.24 },
  { power: 'usa', name: 'San Diego', lat: 32.7, lon: -117.2, share: 0.11 },
  { power: 'usa', name: 'Puget Sound', lat: 47.6, lon: -122.6, share: 0.05 },
  { power: 'usa', name: 'Pearl Harbor', lat: 21.3, lon: -157.9, share: 0.09 },
  { power: 'usa', name: 'Norfolk', lat: 36.9, lon: -76.3, share: 0.16 },
  { power: 'usa', name: 'New York', lat: 40.5, lon: -74.0, share: 0.09 },
  { power: 'usa', name: 'Boston', lat: 42.3, lon: -70.9, share: 0.06 },
  { power: 'usa', name: 'Key West', lat: 24.5, lon: -81.8, share: 0.05 },
  { power: 'usa', name: 'Guantanamo', lat: 19.9, lon: -75.1, share: 0.05 },
  { power: 'usa', name: 'Panama', lat: 9.3, lon: -79.9, share: 0.05 },
  { power: 'usa', name: 'Cavite', lat: 14.5, lon: 120.9, share: 0.05 },

  // ---------------------- Imperial Japanese Navy --------------------------
  { power: 'japan', name: 'Kure', lat: 34.2, lon: 132.6, share: 0.24 },
  { power: 'japan', name: 'Yokosuka', lat: 35.3, lon: 139.7, share: 0.2 },
  { power: 'japan', name: 'Sasebo', lat: 33.1, lon: 129.7, share: 0.16 },
  { power: 'japan', name: 'Maizuru', lat: 35.5, lon: 135.4, share: 0.07 },
  { power: 'japan', name: 'Ominato', lat: 41.3, lon: 141.2, share: 0.05 },
  { power: 'japan', name: 'Ryojun', lat: 38.8, lon: 121.2, share: 0.06 },
  { power: 'japan', name: 'Takao', lat: 22.6, lon: 120.2, share: 0.06 },
  { power: 'japan', name: 'The Yangtze', lat: 31.3, lon: 121.7, share: 0.06 },
  { power: 'japan', name: 'Truk', lat: 7.4, lon: 151.8, share: 0.05 },
  { power: 'japan', name: 'Palau', lat: 7.5, lon: 134.5, share: 0.05 },

  // ------------------------- Marine Nationale ------------------------------
  { power: 'france', name: 'Brest', lat: 48.4, lon: -4.6, share: 0.24 },
  { power: 'france', name: 'Toulon', lat: 43.1, lon: 5.9, share: 0.28 },
  { power: 'france', name: 'Mers-el-Kébir', lat: 35.7, lon: -0.7, share: 0.14 },
  { power: 'france', name: 'Bizerte', lat: 37.3, lon: 9.9, share: 0.08 },
  { power: 'france', name: 'Cherbourg', lat: 49.7, lon: -1.6, share: 0.07 },
  { power: 'france', name: 'Casablanca', lat: 33.6, lon: -7.7, share: 0.06 },
  { power: 'france', name: 'Dakar', lat: 14.7, lon: -17.5, share: 0.07 },
  { power: 'france', name: 'Saigon', lat: 10.5, lon: 107.0, share: 0.06 },

  // --------------------------- Regia Marina --------------------------------
  { power: 'italy', name: 'Taranto', lat: 40.4, lon: 17.2, share: 0.28 },
  { power: 'italy', name: 'La Spezia', lat: 44.1, lon: 9.8, share: 0.24 },
  { power: 'italy', name: 'Naples', lat: 40.8, lon: 14.2, share: 0.14 },
  { power: 'italy', name: 'Augusta', lat: 37.2, lon: 15.3, share: 0.1 },
  { power: 'italy', name: 'Pola', lat: 44.9, lon: 13.8, share: 0.08 },
  { power: 'italy', name: 'Tobruk', lat: 32.1, lon: 24.0, share: 0.06 },
  { power: 'italy', name: 'Massawa', lat: 15.6, lon: 39.5, share: 0.06 },
  { power: 'italy', name: 'The Dodecanese', lat: 36.4, lon: 28.2, share: 0.04 },

  // -------------------------- Kriegsmarine ---------------------------------
  { power: 'germany', name: 'Wilhelmshaven', lat: 53.6, lon: 8.0, share: 0.35 },
  { power: 'germany', name: 'Kiel', lat: 54.4, lon: 10.2, share: 0.3 },
  { power: 'germany', name: 'Heligoland Bight', lat: 54.2, lon: 7.8, share: 0.14 },
  { power: 'germany', name: 'Danzig Bay', lat: 54.6, lon: 19.0, share: 0.13 },
  { power: 'germany', name: 'Memel', lat: 55.8, lon: 20.9, share: 0.08 },
  // Two panzerschiffe sailed for their war stations in August, before a shot
  // was fired: Deutschland north of Iceland and Graf Spee south of the equator
  // on the morning of the 1st. Named ships rather than a share of a fleet, and
  // secret — a raider at sea is not an anchorage anyone knows about, which was
  // the entire point of sending them. The Admiralty did not find Graf Spee
  // until December.
  {
    power: 'germany',
    name: 'Deutschland',
    lat: 66.5,
    lon: -27.0,
    secret: true,
    ships: { battleships: 1 },
  },
  {
    power: 'germany',
    name: 'Admiral Graf Spee',
    lat: -22.0,
    lon: -18.0,
    secret: true,
    ships: { battleships: 1 },
  },

  // ---------------------- The Soviet Navy, four ways -----------------------
  { power: 'ussr', name: 'Kronstadt', lat: 59.9, lon: 29.2, share: 0.3 },
  { power: 'ussr', name: 'Sevastopol', lat: 44.6, lon: 33.4, share: 0.24 },
  { power: 'ussr', name: 'Polyarny', lat: 69.2, lon: 33.4, share: 0.14 },
  { power: 'ussr', name: 'Vladivostok', lat: 43.0, lon: 131.8, share: 0.24 },
  { power: 'ussr', name: 'Petropavlovsk', lat: 53.0, lon: 158.7, share: 0.08 },
];

/**
 * Whole ships, apportioned by largest remainder.
 *
 * Rounding each station on its own loses hulls — 26% of five carriers is 1.3
 * everywhere and floors to one — so the floors are handed out first and the
 * leftovers go to the stations with the largest fractions. The total that
 * reaches the board is then exactly the total in the table above.
 */
function apportion(total, shares) {
  const exact = shares.map((s) => total * s);
  const counts = exact.map((x) => Math.floor(x));
  let left = total - counts.reduce((a, b) => a + b, 0);
  const order = exact
    .map((x, i) => ({ i, frac: x - Math.floor(x) }))
    .sort((a, b) => b.frac - a.frac);
  for (let k = 0; left > 0; k += 1, left -= 1) counts[order[k % order.length].i] += 1;
  return counts;
}

/** The cell a station sits on: the nearest water to the port itself. */
export function seaCellFor(lat, lon, isWater) {
  const start = cellAt(grid(), lat, lon);
  if (isWater[start]) return start;
  const seen = new Set([start]);
  let frontier = [start];
  for (let depth = 0; depth < 6 && frontier.length; depth += 1) {
    const next = [];
    for (const cell of frontier) {
      for (const j of neighbours(cell)) {
        if (seen.has(j)) continue;
        seen.add(j);
        if (isWater[j]) return j;
        next.push(j);
      }
    }
    frontier = next;
  }
  return start;
}

/**
 * Put every fleet on the water.
 *
 * @returns {{ stations: Array, byCell: Map<number, object>, byPower: object }}
 */
export function buildNavies(world) {
  const sphere = grid();
  const isWater = new Uint8Array(TILE_COUNT);
  for (let i = 0; i < TILE_COUNT; i += 1) isWater[i] = TERRAIN[world.biome[i]].water ? 1 : 0;

  const stations = [];
  const byCell = new Map();
  const byPower = {};

  for (const [power, fleet] of Object.entries(NAVIES_1939)) {
    const ports = STATIONS.filter((s) => s.power === power);
    const hulls = SHIPS.reduce((sum, ship) => sum + (fleet[ship.id] ?? 0), 0);
    byPower[power] = { ...fleet, hulls, stations: ports.length };
    if (!ports.length || hulls === 0) continue;

    // A station either names its ships or takes a share of what is left. The
    // named ones come off the top: two panzerschiffe were already at sea, and
    // spreading them as a percentage would have put five submarines in the
    // South Atlantic and no capital ship anywhere near it.
    const shared = ports.filter((p) => !p.ships);
    const shares = shared.map((p) => p.share);
    const remaining = Object.fromEntries(
      SHIPS.map((ship) => [
        ship.id,
        (fleet[ship.id] ?? 0) - ports.reduce((sum, p) => sum + (p.ships?.[ship.id] ?? 0), 0),
      ]),
    );
    const perShip = Object.fromEntries(
      SHIPS.map((ship) => [ship.id, apportion(Math.max(0, remaining[ship.id]), shares)]),
    );

    // Aircraft ride with the carriers rather than with the tonnage: France's
    // forty are wherever Bearn is, not spread over eight ports.
    const carriersAt = ports.map((p, k) =>
      p.ships ? (p.ships.carriers ?? 0) : perShip.carriers[shared.indexOf(p)],
    );
    const totalCarriers = carriersAt.reduce((a, b) => a + b, 0);
    const aircraft = totalCarriers
      ? apportion(fleet.aircraft ?? 0, carriersAt.map((c) => c / totalCarriers))
      : ports.map(() => 0);

    ports.forEach((port, k) => {
      const ships = Object.fromEntries(
        SHIPS.map((s) => [
          s.id,
          port.ships ? (port.ships[s.id] ?? 0) : perShip[s.id][shared.indexOf(port)],
        ]),
      );
      const total = SHIPS.reduce((sum, s) => sum + ships[s.id], 0);
      if (total === 0 && aircraft[k] === 0) return;

      const cell = seaCellFor(port.lat, port.lon, isWater);
      // Two anchorages can share a hex — Wilhelmshaven and the Heligoland
      // Bight are 30 km apart. They become one fleet with both names.
      const already = byCell.get(cell);
      if (already && already.power === power && !already.secret && !port.secret) {
        already.name = `${already.name} & ${port.name}`;
        for (const s of SHIPS) already.ships[s.id] += ships[s.id];
        already.aircraft += aircraft[k];
        already.hulls += total;
        return;
      }
      const station = {
        // A fleet needs a name the record can hold on to, because from now on
        // it moves: its position on any day is replayed from the opening
        // anchorage plus every sailing since, exactly as a column's is.
        id: `${power}:${port.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        power,
        name: port.name,
        secret: Boolean(port.secret),
        cell,
        // The marker is drawn at the centre of the cell the fleet is on, not at
        // the port itself: a dockyard is on land and the fleet is on the water
        // beside it, and a marker drawn over the quay would select the wrong
        // hex when a player clicked it.
        lat: sphere.lat[cell],
        lon: sphere.lon[cell],
        portLat: port.lat,
        portLon: port.lon,
        ships,
        aircraft: aircraft[k],
        hulls: total,
      };
      // Submarines go into their own flotilla at the same anchorage.
      //
      // Same reason the armour was pulled out of the field formations when the
      // armies were deployed: if the only orderable thing at Wilhelmshaven is
      // "Wilhelmshaven", then sending the U-boats into the Atlantic sends the
      // battleships with them, and no navy in the world worked that way. The
      // boats were a separate command answering to a separate admiral, and
      // making them a separate fleet is what lets them be used as one.
      if (station.ships.submarines > 0 && station.hulls > station.ships.submarines) {
        const boats = station.ships.submarines;
        station.ships = { ...station.ships, submarines: 0 };
        station.hulls -= boats;
        stations.push({
          ...station,
          id: `${station.id}-flotilla`,
          name:
            power === 'germany'
              ? `${station.name} U-boat flotilla`
              : `${station.name} submarine flotilla`,
          ships: Object.fromEntries(SHIPS.map((s) => [s.id, s.id === 'submarines' ? boats : 0])),
          aircraft: 0,
          hulls: boats,
        });
      }

      stations.push(station);
      if (!already) byCell.set(cell, station);
    });
  }

  return { stations, byCell, byPower };
}
