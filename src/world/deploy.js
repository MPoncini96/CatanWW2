import { TILE_COUNT, cellAt, grid, neighbours } from './sphere.js';
import { NATION_INDEX, NEUTRAL, SEA } from './nations.js';
import { TERRAIN } from './terrain.js';
import { FIELD_TYPES, FORMATIONS, ZONES } from './oob1939.js';

// Putting the armies of 1939 on the ground.
//
// The old generator scored every hex a nation owned and handed out the army in
// proportion to the score. It produced a smooth field, and a smooth field is
// the one thing 1939 was not: the Wehrmacht had sixty divisions in Silesia and
// Pomerania and none at all between them and the Rhine, and the Red Army had
// two million men in three corners of a country eleven time zones wide.
// Smearing by population gave Berlin a tank park and put nine aircraft in a
// Brandenburg village of seven hundred thousand farmers.
//
// So nothing here is smeared. `oob1939.js` lists formations; this file decides
// which hex each one stands on, and the rules are the ones a staff officer
// would have used: how far is it to the enemy, what does the doctrine say
// about depth, what will the ground carry, and is there a railway to it.
//
// Three things are quantised on purpose. A tank formation goes into one hex
// whole, because it existed as a division and not as a mist. An air group goes
// onto one airfield, and no aircraft appears anywhere that is not one. And
// depots, rear-area security and anti-aircraft are counted apart from field
// strength, because a hex holding twelve thousand recruits in a training
// barracks is not holding twelve thousand soldiers.

/** How much weight a hex of each kind of ground will carry. */
const TERRAIN_FACTOR = {
  plains: 1,
  beach: 0.9,
  hills: 0.75,
  forest: 0.7,
  savanna: 0.65,
  taiga: 0.45,
  swamp: 0.3,
  desert: 0.25,
  jungle: 0.25,
  mountain: 0.3,
  tundra: 0.12,
  peak: 0,
  glacier: 0,
};

/** Roads and railways, by grade. */
export const ACCESS = { NONE: 0, ROAD: 1, RAIL: 2 };

/**
 * Depth profiles. The argument is distance to the enemy in hexes; the result is
 * how much of the zone's weight a hex at that distance carries.
 *
 * This is the parameter that makes one nation look unlike another on the map,
 * and every one of these curves is an argument somebody was having at the time.
 */
const DOCTRINE = {
  // Everything at one point and nothing beside it. Germany in the east.
  schwerpunkt: {
    depth: (d) => (d <= 1 ? 1 : d === 2 ? 0.5 : d === 3 ? 0.22 : d <= 5 ? 0.08 : 0.02),
    peak: 3.4,
  },
  // Flat along the whole frontier, thin everywhere, reserve too far back to
  // matter. Poland, and the reason Poland lasted five weeks.
  cordon: {
    depth: (d) => (d <= 1 ? 1 : d === 2 ? 0.8 : d === 3 ? 0.6 : d <= 5 ? 0.4 : 0.15),
    peak: 0.85,
  },
  // Everything on the works, and the field armies behind them rather than in
  // them — which is what a fortified line is for. The fortress troops use the
  // first curve and are pinned to the line itself; everyone else uses the
  // second and stands one to four hexes back, where the reserves were.
  fortified_line: {
    depth: (d) => (d <= 1 ? 1 : d === 2 ? 0.3 : d === 3 ? 0.16 : d <= 6 ? 0.07 : 0.02),
    fieldDepth: (d) => (d <= 1 ? 0.5 : d === 2 ? 1 : d === 3 ? 0.7 : 0),
    peak: 1.9,
    fieldPeak: 1.35,
  },
  // Moderate at the line and a large echelon behind it. The Soviet districts.
  defense_in_depth: {
    depth: (d) => (d <= 1 ? 1 : d <= 3 ? 0.75 : d <= 6 ? 0.4 : d <= 9 ? 0.18 : 0.05),
    peak: 1.9,
  },
  // No line at all: garrison points, and empty ground between them.
  imperial_nodes: { depth: () => 1, peak: 1, nodes: true },
  // Cities, ports, and the railway between them. Japan in China.
  corridor_occupation: { depth: () => 1, peak: 1, nodes: true, halo: 0.1 },
  // A handful of posts in a country with no field army to speak of.
  skeleton: { depth: () => 1, peak: 1, nodes: true },
};

/** Weights below this fraction of the zone maximum are dropped as noise. */
const TAIL = 0.04;

/** How far the front-line search walks before giving up, in hexes. */
const FRONT_REACH = 14;

function inBox(box, lat, lon) {
  return lon >= box[0] && lon <= box[2] && lat >= box[1] && lat <= box[3];
}

/**
 * Roads and railways, which the board does not otherwise model.
 *
 * There is no rail layer in the data, and inventing one town by town would be
 * a second world to maintain. What there is instead is where the people and
 * the cities are, and in 1939 that is very nearly the same map: railways were
 * built to towns, and ground with nobody on it had nothing but tracks. So this
 * reads access off settlement — but as a gate, not as a weight. It decides
 * whether a formation may stand on a hex at all; it never decides how much
 * stands there. That distinction is the whole difference from the old model.
 */
export function buildAccess(world) {
  const owner = world.ownership.owner;
  const grade = new Uint8Array(TILE_COUNT);

  // How far to the nearest town, over land.
  const townDistance = new Uint8Array(TILE_COUNT).fill(255);
  let wave = [];
  for (const city of world.cities) {
    townDistance[city.index] = 0;
    wave.push(city.index);
  }
  for (let d = 1; d <= 6 && wave.length; d += 1) {
    const next = [];
    for (const i of wave) {
      for (const j of neighbours(i)) {
        if (owner[j] === SEA || townDistance[j] !== 255) continue;
        townDistance[j] = d;
        next.push(j);
      }
    }
    wave = next;
  }

  for (let i = 0; i < TILE_COUNT; i += 1) {
    if (owner[i] === SEA) continue;
    const people = world.population[i];
    let coastal = false;
    for (const j of neighbours(i)) {
      if (owner[j] === SEA) {
        coastal = true;
        break;
      }
    }
    if (townDistance[i] <= 2 || people >= 120_000) grade[i] = ACCESS.RAIL;
    else if (townDistance[i] <= 5 || people >= 25_000 || (coastal && people >= 12_000)) {
      grade[i] = ACCESS.ROAD;
    }
  }

  // Every post the order of battle names by hand counts as served, whatever
  // the settlement data makes of the desert around it. Tobruk and Asmara had
  // roads because there was a garrison there; the garrison is the evidence.
  for (const formation of FORMATIONS) {
    if (!formation.sites) continue;
    for (const [lat, lon] of formation.sites) {
      const cell = landCellAt(world, lat, lon);
      if (grade[cell] === ACCESS.NONE) grade[cell] = ACCESS.ROAD;
    }
  }
  return grade;
}

/** Which cells belong to any of these countries or powers. */
function targetMask(world, facing) {
  const mask = new Uint8Array(TILE_COUNT);
  const owner = world.ownership.owner;
  const powers = [];
  const countries = [];
  for (const name of facing) {
    if (NATION_INDEX[name] !== undefined) {
      powers.push(NATION_INDEX[name]);
      continue;
    }
    // The territory table splits large countries into pieces and names the
    // pieces after the whole: Poland and Poland (Galicia), Mongolia and five
    // Gobis. Facing Poland means facing all of it.
    const matched = world.countries.filter((c) => c.name === name || c.name.startsWith(`${name} (`));
    if (!matched.length) throw new Error(`deploy: nothing on the board is called ${name}`);
    for (const country of matched) countries.push(country.id);
  }
  for (let i = 0; i < TILE_COUNT; i += 1) {
    if (owner[i] === SEA) continue;
    if (powers.includes(owner[i]) || countries.includes(world.countryOf[i])) mask[i] = 1;
  }
  return mask;
}

/**
 * Hexes to the nearest enemy ground, walked over your own.
 *
 * Both restrictions matter. Over land, because distance across water is not a
 * frontage: Denmark is four hexes from Poland over the Baltic and no Danish
 * division was facing it. And over your own ground, because a walk that is
 * allowed through third countries measures the wrong thing entirely — let it
 * cross Belgium and the Ruhr comes out four hexes from France, so the reserves
 * of Army Group C end up in Essen. They stood on the Rhine, and the way to say
 * so is that the only route from the Saar to the Ruhr runs the long way round,
 * up the German side of the frontier.
 */
function frontDistance(world, facing, home, staging) {
  const owner = world.ownership.owner;
  const mask = targetMask(world, facing);
  const distance = new Uint8Array(TILE_COUNT).fill(255);
  let wave = [];
  for (let i = 0; i < TILE_COUNT; i += 1) {
    if (mask[i]) {
      distance[i] = 0;
      wave.push(i);
    }
  }
  const passable = (i) =>
    owner[i] !== SEA && (owner[i] === home || (staging && owner[i] === NEUTRAL));
  for (let d = 1; d <= FRONT_REACH && wave.length; d += 1) {
    const next = [];
    for (const i of wave) {
      for (const j of neighbours(i)) {
        if (distance[j] !== 255 || !passable(j)) continue;
        distance[j] = d;
        next.push(j);
      }
    }
    wave = next;
  }
  return distance;
}

/**
 * The hexes a zone covers: its own nation's ground, land, passable, and not
 * the enemy's.
 *
 * The ownership test is what keeps a rectangle honest. Several zones are drawn
 * as boxes over a corner of the world and a box does not respect a frontier —
 * without this, the pooled neutral army garrisons Berlin because Berlin is a
 * city inside the box marked "everywhere else". A zone may declare `staging`
 * to stand on neutral ground as well, which exactly one of them does: the 14th
 * Army spent the last week of August assembling in Slovakia.
 */
function zoneCells(world, zone) {
  const sphere = grid();
  const owner = world.ownership.owner;
  const enemy = zone.facing ? targetMask(world, zone.facing) : null;
  const home = NATION_INDEX[zone.nation];
  const cells = [];
  for (let i = 0; i < TILE_COUNT; i += 1) {
    if (owner[i] === SEA) continue;
    if (owner[i] !== home && !(zone.staging && owner[i] === NEUTRAL)) continue;
    if (enemy && enemy[i]) continue;
    if (TERRAIN_FACTOR[TERRAIN[world.biome[i]].id] === 0) continue;
    if (!zone.boxes.some((box) => inBox(box, sphere.lat[i], sphere.lon[i]))) continue;
    cells.push(i);
  }
  return cells;
}

/**
 * How much of a zone's strength each of its hexes carries.
 *
 * Three things multiply: what the doctrine says about depth, what the ground
 * will carry, and whether anything can be got to it. Then the whole is raised
 * to the doctrine's peak, which is what separates an army that concentrates
 * from one that spreads: at 2.6 the best hex in a zone ends up with several
 * times the zone average, at 0.85 the zone is nearly flat.
 */
function zoneWeights(world, zone, cells, state, kind) {
  const rule = DOCTRINE[zone.doctrine];
  if (!rule) throw new Error(`deploy: no doctrine called ${zone.doctrine}`);
  const distance = zone.facing ? state.frontFor(zone) : null;
  const access = state.access;
  const weights = new Float64Array(cells.length);

  // Garrison-point doctrines: towns, and for an occupation the ground between
  // them that the railway runs over. Nothing else at all.
  if (rule.nodes) {
    const inZone = new Set(cells);
    for (let k = 0; k < cells.length; k += 1) {
      const city = world.cityAt[cells[k]];
      if (city >= 0) weights[k] = Math.pow(world.cities[city].population, 0.55);
    }
    const halo = rule.halo ?? 0;
    if (halo > 0) {
      const seeded = Float64Array.from(weights);
      for (let k = 0; k < cells.length; k += 1) {
        if (seeded[k] > 0) continue;
        let best = 0;
        for (const j of neighbours(cells[k])) {
          if (!inZone.has(j)) continue;
          const city = world.cityAt[j];
          if (city >= 0) best = Math.max(best, Math.pow(world.cities[city].population, 0.55));
        }
        weights[k] = best * halo;
      }
    }
  } else {
    const curve = (kind === 'field' && rule.fieldDepth) || rule.depth;
    for (let k = 0; k < cells.length; k += 1) {
      const d = distance ? distance[cells[k]] : 255;
      weights[k] = d === 255 ? 0.01 : curve(d);
    }
  }

  // The ground, and the road to it.
  for (let k = 0; k < cells.length; k += 1) {
    const i = cells[k];
    weights[k] *= TERRAIN_FACTOR[TERRAIN[world.biome[i]].id] ?? 0.5;
    if (access[i] === ACCESS.NONE) weights[k] = zone.colonial ? weights[k] * 0.35 : 0;
    else if (access[i] === ACCESS.ROAD) weights[k] *= 0.75;
  }

  let max = 0;
  for (const w of weights) if (w > max) max = w;
  if (max === 0) {
    // A zone with no town in the city table and no road the access rule will
    // admit. Rather than lose the formation, garrison the best-served ground.
    // Only a dozen hexes of it: spreading a garrison over an empty province
    // is the exact failure this file exists to remove. It is also reported,
    // because it means the data wants a named post instead of a rectangle.
    const scored = cells
      .map((cell, k) => ({
        k,
        score:
          (TERRAIN_FACTOR[TERRAIN[world.biome[cell]].id] ?? 0.5) *
          (1 + access[cell]) *
          (1 + Math.log10(1 + world.population[cell])),
      }))
      .sort((a, b) => b.score - a.score || a.k - b.k)
      .slice(0, 12);
    for (const entry of scored) {
      weights[entry.k] = entry.score;
      if (entry.score > max) max = entry.score;
    }
    state.warnings.push(`zone ${zone.name}: no town and no road in it, garrisoning its best ground`);
  }
  const peak = (kind === 'field' && rule.fieldPeak) || rule.peak;
  for (let k = 0; k < cells.length; k += 1) {
    weights[k] = weights[k] < max * TAIL ? 0 : Math.pow(weights[k] / max, peak);
  }
  return weights;
}

/** The land cell a place is on, walking off the water if the point misses. */
function landCellAt(world, lat, lon) {
  const owner = world.ownership.owner;
  const start = cellAt(grid(), lat, lon);
  if (owner[start] !== SEA) return start;
  const seen = new Set([start]);
  let wave = [start];
  for (let d = 0; d < 6; d += 1) {
    const next = [];
    for (const i of wave) {
      for (const j of neighbours(i)) {
        if (seen.has(j)) continue;
        if (owner[j] !== SEA) return j;
        seen.add(j);
        next.push(j);
      }
    }
    wave = next;
  }
  return start;
}

/** Split a whole number over shares, keeping the total exact. */
function apportion(total, shares) {
  const out = new Array(shares.length).fill(0);
  const sum = shares.reduce((a, b) => a + b, 0);
  if (!(sum > 0) || total <= 0) return out;
  const fraction = [];
  let given = 0;
  for (let k = 0; k < shares.length; k += 1) {
    const exact = (total * shares[k]) / sum;
    out[k] = Math.floor(exact);
    given += out[k];
    fraction.push([exact - out[k], k]);
  }
  fraction.sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let n = 0; n < total - given; n += 1) out[fraction[n % fraction.length][1]] += 1;
  return out;
}

/**
 * The short name of a formation, for a panel.
 *
 * The one it declares, or failing that the first clause of its source note,
 * which is a decent label for "3rd Army (Kuchler), East Prussia" and a poor
 * one for a sentence. Anything still too long to sit in a column is cut at a
 * word rather than mid-syllable.
 */
export function formationName(formation) {
  if (formation.name) return formation.name;
  const cut = formation.source.search(/[,—(]/);
  let head = (cut > 0 ? formation.source.slice(0, cut) : formation.source).trim();
  head = head.replace(/^the /, '');
  if (head.length > 30) head = `${head.slice(0, head.lastIndexOf(' ', 30))}…`;
  return head.charAt(0).toUpperCase() + head.slice(1);
}

export const ARMS = ['infantry', 'tanks', 'artillery', 'fighters', 'bombers'];

/** Is this formation's strength field strength, or is it a depot behind it? */
export function isField(formation) {
  return FIELD_TYPES.has(formation.type);
}

/**
 * Read the order of battle and put every formation on the ground.
 *
 * @returns {{placements: Array, byCell: Map, airbases: Set, access: Uint8Array}}
 */
export function placeFormations(world) {
  const fronts = new Map();
  const state = {
    access: buildAccess(world),
    warnings: [],
    frontFor(zone) {
      const key = `${zone.nation}|${zone.staging ? 'staging' : ''}|${zone.facing.join('|')}`;
      if (!fronts.has(key)) {
        fronts.set(
          key,
          frontDistance(world, zone.facing, NATION_INDEX[zone.nation], Boolean(zone.staging)),
        );
      }
      return fronts.get(key);
    },
  };

  // Every zone costs a walk of the globe, so each is worked out once.
  const zoneCache = new Map();
  function resolveZone(id) {
    if (zoneCache.has(id)) return zoneCache.get(id);
    const zone = ZONES[id];
    if (!zone) throw new Error(`deploy: no zone called ${id}`);
    const cells = zoneCells(world, zone);
    if (!cells.length) throw new Error(`deploy: zone ${id} covers no usable ground`);
    const rank = (kind) => {
      const weights = zoneWeights(world, zone, cells, state, kind);
      return cells
        .map((cell, k) => ({ cell, weight: weights[k] }))
        .filter((entry) => entry.weight > 0)
        .sort((a, b) => b.weight - a.weight || a.cell - b.cell);
    };
    const front = zone.facing ? state.frontFor(zone) : null;
    const resolved = { zone, cells, order: rank(null), fieldOrder: rank('field'), front, taken: 0 };
    zoneCache.set(id, resolved);
    return resolved;
  }

  const placements = [];
  const byCell = new Map();
  const airbases = new Set();

  for (const formation of FORMATIONS) {
    let targets;

    if (formation.sites) {
      const merged = new Map();
      for (const [lat, lon, weight] of formation.sites) {
        // Two sites can land on the same 67 km hex — Portsmouth and
        // Southampton do. Merge rather than place one formation twice on one
        // cell, which would make it look like two.
        const cell = landCellAt(world, lat, lon);
        merged.set(cell, (merged.get(cell) ?? 0) + (weight ?? 1));
      }
      targets = [...merged].map(([cell, weight]) => ({ cell, weight }));
    } else {
      const zone = resolveZone(formation.zone);
      if (formation.type === 'armor' || formation.type === 'air') {
        // Quantised: the whole division into one hex. Successive formations in
        // the same zone take successive hexes, so an army group's armour reads
        // as several assembly areas and not as one impossible stack.
        const pick = zone.order[Math.min(zone.taken, zone.order.length - 1)];
        zone.taken += 1;
        targets = [{ cell: pick.cell, weight: 1 }];
      } else if (formation.type === 'fortress') {
        // Static troops sit on the works, and the works are on the line.
        const onLine = zone.order.filter((e) => zone.front && zone.front[e.cell] <= 1);
        const use = onLine.length
          ? onLine
          : zone.order.slice(0, Math.max(1, Math.round(zone.order.length * 0.2)));
        targets = use.map((e) => ({ cell: e.cell, weight: e.weight }));
      } else {
        const use = formation.type === 'field' ? zone.fieldOrder : zone.order;
        targets = use.map((e) => ({ cell: e.cell, weight: e.weight }));
      }
    }

    const shares = targets.map((t) => t.weight);
    const split = {};
    for (const arm of ARMS) split[arm] = apportion(formation.strength[arm] ?? 0, shares);

    targets.forEach((target, k) => {
      const strength = {};
      let any = 0;
      for (const arm of ARMS) {
        strength[arm] = split[arm][k];
        any += strength[arm];
      }
      if (!any) return;
      const placement = { formation, cell: target.cell, strength };
      placements.push(placement);
      if (!byCell.has(target.cell)) byCell.set(target.cell, []);
      byCell.get(target.cell).push(placement);
      if (strength.fighters + strength.bombers > 0) airbases.add(target.cell);
    });
  }

  return { placements, byCell, airbases, access: state.access, warnings: state.warnings };
}

export { TERRAIN_FACTOR };
