import { TILE_COUNT, grid, neighbours } from './sphere.js';
import { EARTH } from './earthData.js';
import { fbm3 } from './noise.js';
import { SHADES, T, TERRAIN } from './terrain.js';
import { buildPopulation } from './population.js';
import { buildResources } from './resources.js';
import { NATION_INDEX, NEUTRAL, SEA, Ownership } from './nations.js';
import { territoryFor } from './territories.js';
import { buildForces, tallyPlacements } from './forces.js';
import { buildNavies } from './navies.js';
import { positionsAt } from '../game/movement.js';
import { strengthsAt } from '../game/combat.js';
import { buildCountries } from './countries.js';

// Turns the baked per-hex Earth samples (land mask, relief, vegetation)
// into the board the renderer consumes. Everything here is derived from real
// data except ocean depth, which comes from distance to the nearest coast —
// the source rasters carry no bathymetry.

// The sea holds far more heat than the air above it, so it only freezes well
// past the point where the annual air mean drops below zero.
const SEA_ICE_C = -8;
// Distances are in cells, and a cell is now 67 km everywhere rather than 90 km
// at the equator shrinking to 18 km at the pole, so the bands are counted out
// to hold the same distance on the ground.
const SHELF_TILES = 3; // cells from shore that count as continental shelf
const OCEAN_TILES = 16; // beyond this, open ocean becomes abyss

// Breadth-first distance on a hex lattice grows in perfect hexagons, plainly
// visible as haloes around islands at these band widths. Perturbing the
// distance with coherent noise breaks the shape up without moving the
// coastline, which comes from the real land mask.
// The wavelength has to be shorter than the bands are wide, or the noise just
// shifts each ring uniformly and leaves the hexagon intact.
const DEPTH_NOISE_TILES = 8;
const DEPTH_NOISE_FREQ = 26;

const ELEV_HILLS = 0.085; // ~0.6 km
const ELEV_MOUNTAIN = 0.2; // ~1.4 km
const ELEV_PEAK = 0.5; // ~3.5 km

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * Decide which water reaches the open ocean.
 *
 * Straits matter here and most are narrower than a tile — Gibraltar is 14 km
 * against a 90 km hex — so a strict water-tile flood fill seals the
 * Mediterranean off and calls it a lake. The bake samples every hex at 91
 * points, so a hex with any water in it at all has a land fraction below
 * 255; flooding across those keeps sub-tile channels open. The result is
 * intersected back with the real water tiles, so the coastline never moves.
 *
 * What stays a lake is then genuinely landlocked: Caspian, Baikal, Victoria.
 */
function findOcean(isLand, landRaw) {
  const passable = new Uint8Array(TILE_COUNT);
  for (let i = 0; i < TILE_COUNT; i += 1) passable[i] = landRaw[i] < 255 ? 1 : 0;

  const seen = new Uint8Array(TILE_COUNT);
  const isOcean = new Uint8Array(TILE_COUNT);
  let best = null;
  let bestSize = 0;

  for (let start = 0; start < TILE_COUNT; start += 1) {
    if (!passable[start] || seen[start]) continue;
    const body = [];
    const stack = [start];
    seen[start] = 1;
    let water = 0;
    while (stack.length) {
      const i = stack.pop();
      body.push(i);
      if (!isLand[i]) water += 1;
      for (const j of neighbours(i)) {
        if (!passable[j] || seen[j]) continue;
        seen[j] = 1;
        stack.push(j);
      }
    }
    // Rank by open water, not by tile count, so a long coastal chain of mostly
    // dry hexes cannot outvote a real sea.
    if (water > bestSize) {
      bestSize = water;
      best = body;
    }
  }
  if (best) for (const i of best) if (!isLand[i]) isOcean[i] = 1;
  return isOcean;
}

/** Hexes of open sea between each ocean tile and the nearest land. */
function distanceToCoast(isLand, isOcean) {
  const dist = new Int16Array(TILE_COUNT).fill(-1);
  let frontier = [];
  for (let i = 0; i < TILE_COUNT; i += 1) {
    if (!isOcean[i]) continue;
    for (const j of neighbours(i)) {
      if (isLand[j]) {
        dist[i] = 0;
        frontier.push(i);
        break;
      }
    }
  }
  let step = 0;
  while (frontier.length) {
    const next = [];
    step += 1;
    for (const i of frontier) {
      for (const j of neighbours(i)) {
        if (!isOcean[j] || dist[j] !== -1) continue;
        dist[j] = step;
        next.push(j);
      }
    }
    frontier = next;
  }
  for (let i = 0; i < TILE_COUNT; i += 1) if (dist[i] === -1) dist[i] = 0;
  return dist;
}

function pickWater(tempC, depth, ocean) {
  if (tempC < SEA_ICE_C) return T.seaice;
  if (!ocean) return T.lake;
  if (depth <= SHELF_TILES) return T.shelf;
  if (depth <= OCEAN_TILES) return T.ocean;
  return T.abyss;
}

function pickLand({ lat, elev, tempC, veg, coastal, landFrac }) {
  // Permanent ice sheets: Antarctica outright, Greenland by its high interior.
  if (lat < -66) return T.glacier;
  if (lat > 62 && elev > 0.24) return T.glacier;

  // Relief bands, in kilometres (the relief byte spans roughly 0-7 km).
  if (elev > ELEV_PEAK) return tempC < 5 ? T.peak : T.mountain;
  if (elev > ELEV_MOUNTAIN) return T.mountain;

  // A hex the coastline cuts through, at sea level, reads as shore — but
  // not in the far north, where a sandy beach would be nonsense.
  if (coastal && landFrac < 0.72 && elev < 0.12 && tempC > 2) return T.beach;

  if (tempC < -10) return T.tundra;
  if (tempC < 6) return veg > 0.34 ? T.taiga : T.tundra;

  // Vegetation decides before relief here, so an arid plateau stays desert
  // instead of turning into green hills.
  if (veg < 0.26) return T.desert;
  if (veg < 0.38) return T.savanna;
  if (elev > ELEV_HILLS) return T.hills;
  // Greenness alone cannot separate cropland from forest, so the middle of the
  // range is treated as open country and only the greenest land grows trees.
  if (veg < 0.56) return T.plains;
  if (tempC > 21 && veg > 0.68) return T.jungle;
  if (veg > 0.74 && elev < 0.05 && tempC > 10) return T.swamp;
  return T.forest;
}

export function buildWorld(landRaw, elevRaw, greenRaw) {
  const isLand = new Uint8Array(TILE_COUNT);
  for (let i = 0; i < TILE_COUNT; i += 1) isLand[i] = landRaw[i] >= 128 ? 1 : 0;
  const isOcean = findOcean(isLand, landRaw);
  const dist = distanceToCoast(isLand, isOcean);

  const elevation = new Float32Array(TILE_COUNT);
  const temperature = new Float32Array(TILE_COUNT);
  const moisture = new Float32Array(TILE_COUNT);
  const biome = new Uint8Array(TILE_COUNT);
  const shade = new Uint8Array(TILE_COUNT);

  const sphere = grid();
  for (let i = 0; i < TILE_COUNT; i += 1) {
    const lat = sphere.lat[i];
    const elev = elevRaw[i] / 255;
    const veg = greenRaw[i] / 255;
    // Mean annual temperature in Celsius. The quadratic in latitude fits the
    // real profile closely (27C at the equator, 0C at 60 deg, -28C at the
    // pole); altitude then cools it at the standard 6.5C per km, with the
    // relief byte covering roughly 0-7 km.
    const tempC = 27 - 0.0068 * lat * lat - 6.5 * (elev * 7);

    temperature[i] = clamp01((tempC + 30) / 60);
    moisture[i] = veg;

    if (isLand[i]) {
      let coastal = false;
      for (const j of neighbours(i)) {
        if (!isLand[j]) {
          coastal = true;
          break;
        }
      }
      elevation[i] = elev;
      biome[i] = pickLand({ lat, elev, tempC, veg, coastal, landFrac: landRaw[i] / 255 });
    } else {
      const wobble =
        (fbm3(
          sphere.center[i * 3],
          sphere.center[i * 3 + 1],
          sphere.center[i * 3 + 2],
          DEPTH_NOISE_FREQ,
          8191,
        ) -
          0.5) *
        2;
      const depth = Math.max(0, dist[i] + wobble * DEPTH_NOISE_TILES);
      elevation[i] = -clamp01(depth / (OCEAN_TILES + 6));
      biome[i] = pickWater(tempC, depth, isOcean[i]);
    }

    // Shade tracks relief so mountains and deep water read as layered, with a
    // stable per-tile jitter so flat regions still have texture.
    const h = Math.imul(i ^ 0x9e3779b9, 2246822519);
    const jitter = ((h >>> 17) % 256) / 255;
    const relief = isLand[i] ? elev * 2.2 : 1 + elevation[i] * ((OCEAN_TILES + 6) / OCEAN_TILES);
    shade[i] = Math.min(SHADES - 1, Math.floor(clamp01(relief * 0.7 + jitter * 0.3) * SHADES));
  }

  const world = {
    name: 'Earth',
    year: 1939,
    sphere,
    count: TILE_COUNT,
    elevation,
    temperature,
    moisture,
    biome,
    shade,
    terrain: TERRAIN,
  };

  // People go on last: the settlement layer reads the finished terrain.
  const people = buildPopulation(world);
  world.population = people.population;
  world.cityAt = people.cityAt;
  world.cities = people.cities;
  world.urban = people.urban;
  world.rural = people.rural;
  world.totalPopulation = people.total;

  // Resources go on after the people. They no longer depend on them — food did,
  // and food is gone — but the order is kept because forces read both.
  const output = buildResources(world);
  world.resources = output.amounts;
  world.resourceTotals = output.totals;
  world.resourceStats = output.stats;
  world.sitesByTile = output.sitesByTile;

  // Political control. Only land is owned; the sea belongs to nobody here.
  const owner = new Uint8Array(TILE_COUNT).fill(SEA);
  const territoryName = new Array(TILE_COUNT).fill(null);
  for (let i = 0; i < TILE_COUNT; i += 1) {
    if (TERRAIN[biome[i]].water) continue;
    // Every land cell gets a region, and its owner comes from that region.
    // There is no path here that leaves a cell owned by somebody but standing
    // in nowhere: territoryFor falls back to the nearest box rather than to a
    // default nation, and the sweep in `npm test` proves it never has to.
    const territory = territoryFor(sphere.lat[i], sphere.lon[i]);
    owner[i] = NATION_INDEX[territory.owner] ?? NEUTRAL;
    territoryName[i] = territory.name;
  }
  world.ownership = new Ownership(owner);
  world.territoryName = territoryName;

  // Countries: the powers keep their own colours, the neutrals get theirs.
  const nations = buildCountries(world);
  world.countries = nations.countries;
  world.countryOf = nations.countryOf;

  // Armies go on last of all: deployment depends on who owns what, where the
  // hostile frontiers run, and where the people are.
  const armies = buildForces(world);
  world.forces = armies.counts;
  world.forceTotals = armies.totals;
  world.forcesByNation = armies.byNation;
  world.forceStrength = armies.strength;
  world.maxForceStrength = armies.maxStrength;
  // The formations themselves, so a hex can say what is standing on it rather
  // than only how many of them there are.
  world.garrisons = {
    placements: armies.placements,
    byCell: armies.byCell,
    airbases: armies.airbases,
    access: armies.access,
    fieldInfantry: armies.fieldInfantry,
    roleAt: armies.roleAt,
    warnings: armies.warnings,
    // The opening deployment, kept apart from where the columns are now. It is
    // the fixed point every position is replayed from and it never changes.
    opening: armies.opening,
    version: 0,
    listeners: new Set(),
  };

  /**
   * Put the armies where the log of marches says they are on this day.
   *
   * Called with the whole log every time, not with the day's moves: replaying
   * from the opening deployment is what keeps every client agreeing about
   * where an army is without anybody sending a map. A day's worth of marching
   * is a few hundred entries and the tally is 1,682 columns, so doing the
   * whole thing again costs less than a frame.
   */
  world.march = (moves, day, battles = [], replacements = []) => {
    const at = positionsAt(world.garrisons.opening, moves, day);
    const left = strengthsAt(world.garrisons.opening, battles, day, replacements);
    const placements = [];
    for (const placement of world.garrisons.opening) {
      const cell = at.get(placement.id);
      const strength = left.get(placement.id) ?? placement.strength;
      // A column with nothing left of it is off the board. It is not deleted
      // from anything — the record still has it, and replaying to an earlier
      // day puts it back.
      let any = 0;
      for (const arm of Object.keys(strength)) any += strength[arm];
      if (!any) continue;
      placements.push(
        cell === placement.cell && strength === placement.strength
          ? placement
          : { ...placement, cell, strength },
      );
    }
    const tallied = tallyPlacements(placements);
    world.forces = tallied.counts;
    world.forceTotals = tallied.totals;
    world.forcesByNation = tallied.byNation;
    world.forceStrength = tallied.strength;
    world.maxForceStrength = tallied.maxStrength;
    Object.assign(world.garrisons, {
      placements: tallied.placements,
      byCell: tallied.byCell,
      airbases: tallied.airbases,
      fieldInfantry: tallied.fieldInfantry,
      roleAt: tallied.roleAt,
      version: world.garrisons.version + 1,
      day,
    });
    for (const listener of world.garrisons.listeners) listener(world.garrisons);
    return world.garrisons.version;
  };

  /** Tell me when the armies move. Returns the way to stop being told. */
  world.onMarch = (listener) => {
    world.garrisons.listeners.add(listener);
    return () => world.garrisons.listeners.delete(listener);
  };

  // And the fleets, which sit on the water rather than over the ground.
  world.navies = buildNavies(world);
  return world;
}

/** Fetch the baked Earth samples and turn them into the board. */
export async function loadEarth() {
  if (EARTH.cells !== TILE_COUNT) {
    throw new Error(
      `earth.bin is baked for ${EARTH.cells} cells but the grid has ${TILE_COUNT}. ` +
        'Re-run: npm run build:earth',
    );
  }
  const { default: earthBinUrl } = await import('./earth.bin?url');
  const response = await fetch(earthBinUrl);
  if (!response.ok) throw new Error(`earth.bin: HTTP ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const expected = TILE_COUNT * EARTH.planes.length;
  if (bytes.length !== expected) {
    throw new Error(`earth.bin is ${bytes.length} bytes, expected ${expected}`);
  }
  return buildWorld(
    bytes.subarray(0, TILE_COUNT),
    bytes.subarray(TILE_COUNT, TILE_COUNT * 2),
    bytes.subarray(TILE_COUNT * 2, TILE_COUNT * 3),
  );
}
