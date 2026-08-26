import { TILE_COUNT, cellAt, grid, neighbours } from './sphere.js';
import { TERRAIN } from './terrain.js';
import { seaCellFor } from './navies.js';

// The trade routes, and the ships on them.
//
// Every other rule in this game is about who is standing on a hex. This one is
// not. A convoy route is a thing a country *needs* rather than a thing it
// holds: Britain in 1939 imported two thirds of its food, all of its oil and
// most of its iron ore, and the entire German naval effort for six years was
// the proposition that if you cut enough of those lanes the island stops.
//
// So a lane is modelled as a stream rather than as a ship. The token on the
// water is one convoy standing for the whole trade — it sails the route, back
// and forth, on a schedule nobody orders it to keep — and while it is at sea
// the lane delivers its cargo into the stores every day. Sink it and the
// delivery stops until the lane is running again. That is the Battle of the
// Atlantic in one sentence, and it is the only mechanic in the game where
// destroying something makes a number somewhere else go down instead of up.

/** Days a lane is out of action after its convoy is sunk. */
export const RELIEF_DAYS = 12;

/** Escorts assigned to a lane, which is what stands between it and a U-boat. */
const ESCORT = { destroyers: 6, cruisers: 1 };

/** A heavier escort, for the lanes that were worth one. */
const STRONG_ESCORT = { destroyers: 12, cruisers: 2 };

/**
 * The lanes of 1 September 1939.
 *
 * `via` is the track, given as the places a ship on it actually passed rather
 * than as a line on a chart: a route from the Gulf to the Clyde goes round
 * Ireland and not through it, and the waypoints are what make it do so.
 *
 * `cargo` is what arrives per day, in the units the stores are kept in — kt for
 * steel, oil and iron, tonnes for aluminium and rubber. The numbers are set so
 * the lane is worth the escort: see the note on tonnage at the foot of the file.
 */
export const ROUTES_1939 = [
  // ---------------------------------------------------- to the British Isles
  // The one everybody means by "the Atlantic". Halifax was where the slow
  // convoys formed up, and HX 1 sailed on 16 September 1939, a fortnight after
  // this board opens.
  {
    id: 'hx-halifax',
    power: 'uk',
    name: 'HX — Halifax to the Clyde',
    via: [[44.5, -63.4], [46.0, -50.0], [50.0, -30.0], [54.0, -15.0], [55.6, -6.5], [55.9, -5.0]],
    cargo: { steel: 9, oil: 6, iron: 5, aluminium: 40 },
    escort: STRONG_ESCORT,
  },
  // Oil out of the Gulf and the Caribbean, which is where Britain's petrol
  // came from before the Middle East fields were piped.
  {
    id: 'tm-trinidad',
    power: 'uk',
    name: 'TM — the Trinidad tanker route',
    via: [[10.6, -61.5], [20.0, -60.0], [35.0, -45.0], [48.0, -25.0], [53.0, -12.0], [55.5, -5.5]],
    cargo: { oil: 11, rubber: 30 },
    escort: ESCORT,
  },
  // Round the Cape, because the Mediterranean was shut to British trade the
  // moment Italy looked like coming in. Six weeks instead of three.
  {
    id: 'ws-cape',
    power: 'uk',
    name: 'WS — the Cape route',
    via: [
      [-33.9, 18.0], [-20.0, 5.0], [0.0, -8.0], [14.0, -20.0], [35.0, -20.0], [48.0, -14.0],
      [55.0, -6.0],
    ],
    cargo: { iron: 4, rubber: 55, aluminium: 30 },
    escort: ESCORT,
  },
  // Abadan to Suez to home: the Anglo-Iranian oil that the Mediterranean
  // Fleet at Alexandria existed to keep flowing.
  {
    id: 'oa-abadan',
    power: 'uk',
    name: 'OA — Abadan and the Suez run',
    via: [
      [29.5, 49.5], [22.0, 60.0], [12.5, 44.0], [20.0, 38.5], [29.5, 32.6], [33.0, 28.0],
      [36.0, 12.0], [36.5, -5.5], [43.0, -11.0], [51.0, -8.0], [55.0, -5.5],
    ],
    cargo: { oil: 9 },
    escort: ESCORT,
  },

  // ------------------------------------------------------------ and to France
  {
    id: 'kj-france',
    power: 'france',
    name: 'KJ — the North American run to Brest',
    via: [[40.5, -73.9], [42.0, -60.0], [45.0, -40.0], [47.0, -20.0], [48.3, -8.0], [48.4, -4.6]],
    cargo: { steel: 5, oil: 5, aluminium: 25 },
    escort: ESCORT,
  },
  // North Africa was not a colony to France so much as a second half: the
  // phosphates, the iron of Ouenza, and nineteen divisions.
  {
    id: 'af-algiers',
    power: 'france',
    name: 'The Algiers and Bizerte crossing',
    via: [[36.8, 3.1], [38.5, 4.5], [41.0, 5.5], [43.2, 5.3]],
    cargo: { iron: 4, oil: 2 },
    escort: ESCORT,
  },

  // -------------------------------------------------------------- to Germany
  // The most important cargo of the first winter of the war. Swedish ore came
  // out of Luleå until the Gulf of Bothnia froze and then out of Narvik, down
  // inside Norwegian territorial water, which is why both sides spent April
  // 1940 fighting over a fishing port inside the Arctic Circle.
  {
    id: 'narvik-ore',
    power: 'germany',
    name: 'The Narvik ore run',
    via: [[68.4, 17.0], [66.0, 11.0], [62.0, 5.0], [58.0, 5.5], [56.5, 7.5], [54.2, 8.5], [53.6, 8.1]],
    cargo: { iron: 14, steel: 3 },
    escort: ESCORT,
  },
  {
    id: 'lulea-ore',
    power: 'germany',
    name: 'The Baltic ore run from Luleå',
    via: [[65.5, 22.4], [62.0, 19.5], [58.5, 19.0], [55.5, 16.5], [54.4, 12.5], [54.1, 10.5]],
    cargo: { iron: 9 },
    escort: ESCORT,
  },

  // --------------------------------------------------------------- and Italy
  // Italy had no coal and no oil, and both came by sea. This lane is the
  // reason the Regia Marina spent 1940 escorting freighters instead of
  // fighting a fleet action.
  {
    id: 'it-levant',
    power: 'italy',
    name: 'The Levant and Black Sea run',
    via: [[44.6, 33.5], [41.5, 29.0], [39.5, 25.0], [37.0, 20.0], [39.0, 17.5], [40.6, 14.3]],
    cargo: { oil: 5, steel: 3 },
    escort: ESCORT,
  },

  // --------------------------------------------------------------- and Japan
  // The oil of the Indies and the rubber of Malaya, both of which Japan was
  // buying in 1939 and took by force in 1942 when the buying was stopped.
  {
    id: 'jp-indies',
    power: 'japan',
    name: 'The Southern Resource Area run',
    via: [[-6.1, 106.8], [1.3, 104.5], [8.0, 108.0], [15.0, 114.0], [22.0, 120.0], [30.0, 128.0], [34.0, 132.4]],
    cargo: { oil: 8, rubber: 70, iron: 4 },
    escort: ESCORT,
  },
  {
    id: 'jp-pacific',
    power: 'japan',
    name: 'The trans-Pacific purchase run',
    via: [[33.7, -118.2], [30.0, -140.0], [28.0, -170.0], [32.0, 165.0], [34.0, 145.0], [35.3, 139.9]],
    cargo: { oil: 7, steel: 4, aluminium: 20 },
    escort: ESCORT,
  },

  // ----------------------------------------------------------------- and USA
  // America is not at war and this lane carries nothing to anybody's front. It
  // is here because the Caribbean bauxite is what the aircraft industry runs
  // on, and because a neutral's shipping being sunk is how neutrals stop being
  // neutral.
  {
    id: 'us-bauxite',
    power: 'usa',
    name: 'The Guianas bauxite run',
    via: [[6.0, -55.2], [12.0, -60.0], [20.0, -68.0], [28.0, -76.0], [34.0, -76.5], [36.8, -76.2]],
    cargo: { aluminium: 90, rubber: 25 },
    escort: ESCORT,
  },
];

/** Points along a great circle between two places, about one hex apart. */
function greatCircle(a, b) {
  const rad = Math.PI / 180;
  const toVec = ([lat, lon]) => {
    const p = lat * rad;
    const l = lon * rad;
    return [Math.cos(p) * Math.cos(l), Math.cos(p) * Math.sin(l), Math.sin(p)];
  };
  const u = toVec(a);
  const v = toVec(b);
  const dot = Math.max(-1, Math.min(1, u[0] * v[0] + u[1] * v[1] + u[2] * v[2]));
  const arc = Math.acos(dot);
  if (arc < 1e-9) return [a];
  // A hex is 67 km across on a sphere of 6,371 km.
  const steps = Math.max(1, Math.round(arc / (67 / 6371)));
  const out = [];
  for (let k = 0; k <= steps; k += 1) {
    const t = k / steps;
    const s1 = Math.sin((1 - t) * arc) / Math.sin(arc);
    const s2 = Math.sin(t * arc) / Math.sin(arc);
    const w = [u[0] * s1 + v[0] * s2, u[1] * s1 + v[1] * s2, u[2] * s1 + v[2] * s2];
    const len = Math.hypot(w[0], w[1], w[2]);
    out.push([Math.asin(w[2] / len) / rad, Math.atan2(w[1], w[0]) / rad]);
  }
  return out;
}

/**
 * The shortest way by water from one cell to another, if there is a near one.
 *
 * Snapping great-circle samples to the nearest water leaves gaps wherever the
 * line clipped a coast: the track hops the African bulge instead of going round
 * it. This walks the hop over water so the convoy is somewhere every day and
 * can be met there.
 *
 * The search is deliberately bounded. If there is no short way through, there
 * is a good chance there is no way through at all except round a continent, and
 * the hop that is left standing is a canal — Suez and Panama are both dry at
 * 67 km to the hex, and a ship on this board goes through them the way a ship
 * did, without the water being drawn.
 */
function waterPath(from, to, isWater, budget = 4000) {
  if (from === to) return [];
  const cameFrom = new Map([[from, -1]]);
  let frontier = [from];
  let seen = 1;
  while (frontier.length && seen < budget) {
    const next = [];
    for (const cell of frontier) {
      for (const j of neighbours(cell)) {
        if (cameFrom.has(j) || !isWater[j]) continue;
        cameFrom.set(j, cell);
        seen += 1;
        if (j === to) {
          const out = [];
          for (let at = to; at !== from; at = cameFrom.get(at)) out.push(at);
          return out.reverse();
        }
        next.push(j);
      }
    }
    frontier = next;
  }
  return null;
}

/**
 * Turn every lane into a track of sea cells.
 *
 * The waypoints are interpolated along great circles and each sample snapped
 * to the nearest water — which is what keeps a convoy off the Cornish coast
 * rather than through it — then consecutive duplicates dropped, because a
 * dozen samples inside one hex is still one hex.
 */
export function buildConvoys(world) {
  const sphere = grid();
  const isWater = new Uint8Array(TILE_COUNT);
  for (let i = 0; i < TILE_COUNT; i += 1) isWater[i] = TERRAIN[world.biome[i]].water ? 1 : 0;

  const convoys = [];
  for (const route of ROUTES_1939) {
    const path = [];
    for (let k = 0; k + 1 < route.via.length; k += 1) {
      for (const [lat, lon] of greatCircle(route.via[k], route.via[k + 1])) {
        const guess = cellAt(sphere, lat, lon);
        const cell = isWater[guess] ? guess : seaCellFor(lat, lon, isWater);
        const last = path[path.length - 1];
        if (last === cell) continue;
        if (last === undefined) {
          path.push(cell);
          continue;
        }
        const stitched = neighbours(last).includes(cell) ? [cell] : waterPath(last, cell, isWater);
        if (stitched) path.push(...stitched);
        else path.push(cell);
      }
    }
    if (path.length < 2) continue;
    const escort = route.escort ?? ESCORT;
    convoys.push({
      id: `convoy:${route.id}`,
      power: route.power,
      name: route.name,
      route: route.id,
      cargo: route.cargo,
      ships: { ...escort },
      path,
      cell: path[0],
      lat: sphere.lat[path[0]],
      lon: sphere.lon[path[0]],
      hulls: Object.values(escort).reduce((a, b) => a + b, 0),
    });
  }
  return convoys;
}

/**
 * Where a convoy is on a given day.
 *
 * Out and back, for ever, at four hexes a day — a triangle wave over the
 * track. Nobody orders this and nobody can change it: the schedule is the
 * point of a convoy, and an admiral who could reroute the whole Atlantic trade
 * every morning would never lose a ship.
 */
export function convoyCell(convoy, day, speed = 4) {
  const span = convoy.path.length - 1;
  if (span <= 0) return convoy.path[0];
  const period = span * 2;
  const along = (((day * speed) % period) + period) % period;
  const index = along <= span ? along : period - along;
  return convoy.path[Math.round(index)];
}

/**
 * What has actually arrived, and what is arriving today.
 *
 * A lane sunk on day 20 delivers nothing from day 20 until day 32, and the
 * cumulative figure is the whole run less the days it was out. Stores are
 * replayed rather than stored, like everything else here, so this has to be
 * computable for any day from the sinking record alone.
 */
export function deliveredBy(convoys, power, day, sinkings = []) {
  const perDay = {};
  const delivered = {};
  for (const convoy of convoys) {
    if (convoy.power !== power) continue;
    let idle = 0;
    let running = true;
    for (const sunk of sinkings) {
      if (sunk.convoy !== convoy.id) continue;
      const from = sunk.day;
      const until = sunk.until ?? sunk.day + RELIEF_DAYS;
      idle += Math.max(0, Math.min(day, until) - Math.min(day, from));
      if (day >= from && day < until) running = false;
    }
    const days = Math.max(0, day - idle);
    for (const [store, rate] of Object.entries(convoy.cargo ?? {})) {
      delivered[store] = (delivered[store] ?? 0) + rate * days;
      if (running) perDay[store] = (perDay[store] ?? 0) + rate;
    }
  }
  return { perDay, delivered };
}

// ---------------------------------------------------------------- on tonnage
//
// The cargo figures are not the historical tonnages divided by 365, and trying
// to make them so was the first thing that failed. Britain landed about 44
// million tons of imports in 1939, which at this game's scale would swamp every
// other number on the economy panel and make home production irrelevant.
//
// What they are instead is the *share of the war effort that came by sea*,
// which is the thing the mechanic is about. Set against the opening incomes,
// these lanes carry a large part of British oil and a useful part of its steel;
// most of German iron ore, which is right and is the reason Narvik mattered so
// much; and a good share of what Japan burned. Cut them all and the stores
// start falling in weeks rather than years — which is the pressure the real
// blockade applied, arriving at the right answer by a route the tonnage tables
// do not take.
