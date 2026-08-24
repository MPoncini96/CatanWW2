import { TILE_COUNT, cellAt, grid, neighbours } from './sphere.js';
import { CITIES_1939 } from './cities.js';
import { REGIONS_1939, WORLD_POPULATION_1939, boostAt, regionAt } from './regions.js';
import { TERRAIN } from './terrain.js';

// Puts people on the board as of 1939.
//
// Cities come straight from the historical record. Everyone else — the ~90% of
// the world that did not live in a large city — is spread across the land by
// two factors: which region a hex sits in (real 1939 populations, so China is
// crowded and Australia is not), and how habitable the hex is. Within a
// region the split is smooth, with a per-tile jitter so neighbouring farmland
// does not come out identical.

/** How many people a terrain will carry, relative to open plains. */
const HABITABILITY = {
  plains: 1,
  forest: 0.75,
  hills: 0.7,
  beach: 0.85,
  savanna: 0.5,
  swamp: 0.45,
  jungle: 0.22, // rainforest interiors stayed nearly empty; the coasts did not
  taiga: 0.12,
  mountain: 0.12,
  desert: 0.06,
  tundra: 0.03,
  peak: 0.01,
  glacier: 0,
  // Water carries nobody; people live on the shore beside it.
  ocean: 0,
  shelf: 0,
  abyss: 0,
  lake: 0,
  seaice: 0,
};

const COASTAL_BONUS = 1.45; // ports, fishing, trade
const JITTER = 0.5; // +/- fraction of the local mean

const WEIGHT = TERRAIN.map((t) => HABITABILITY[t.id] ?? 0);

/** Deterministic 0..1 from a tile index — same board on every client. */
function jitterAt(i) {
  let h = Math.imul(i ^ 0x27d4eb2f, 0x9e3779b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

/** Nearest land cell to this one, breadth-first. -1 if there is none. */
function nearestLand(start, isLand) {
  const seen = new Set([start]);
  let frontier = [start];
  for (let depth = 0; depth < 6 && frontier.length; depth += 1) {
    const next = [];
    for (const cell of frontier) {
      for (const j of neighbours(cell)) {
        if (seen.has(j)) continue;
        seen.add(j);
        if (isLand[j]) return j;
        next.push(j);
      }
    }
    frontier = next;
  }
  return -1;
}

/**
 * Place the historical cities onto hexes.
 *
 * Several real cities can share one 90 km hex — Tokyo with Yokohama, the
 * Ruhr with itself. Those merge into a single agglomeration that keeps the
 * largest name and the combined population, which is what the tile really
 * represents at this scale.
 */
function placeCities(isLand) {
  const byTile = new Map();

  const sphere = grid();
  for (const [name, lat, lon, thousands] of CITIES_1939) {
    let index = cellAt(sphere, lat, lon);

    // Ports on a narrow peninsula — Athens, Dakar, Auckland — can fall on a
    // cell the land mask calls sea. Walk out to the nearest land cell so no
    // city is founded in open water.
    if (!isLand[index]) {
      const landed = nearestLand(index, isLand);
      if (landed >= 0) index = landed;
    }

    const existing = byTile.get(index);
    const people = thousands * 1000;
    if (existing) {
      existing.population += people;
      existing.merged.push(name);
      if (people > existing.largest) {
        existing.largest = people;
        existing.name = name;
      }
    } else {
      byTile.set(index, {
        name,
        population: people,
        largest: people,
        merged: [name],
        index,
        lat,
        lon,
      });
    }
  }

  return byTile;
}

/**
 * Population for every hex, plus the city list.
 *
 * @returns {{population: Uint32Array, cityAt: Int32Array, cities: Array, urban: number, rural: number}}
 */
export function buildPopulation(world) {
  const isLand = new Uint8Array(TILE_COUNT);
  for (let i = 0; i < TILE_COUNT; i += 1) isLand[i] = TERRAIN[world.biome[i]].water ? 0 : 1;

  const cityByTile = placeCities(isLand);

  // Habitability weight per hex, and the running total per region.
  const weight = new Float32Array(TILE_COUNT);
  const region = new Int16Array(TILE_COUNT).fill(-1);
  const regionWeight = new Float64Array(REGIONS_1939.length);
  const regionCityPop = new Float64Array(REGIONS_1939.length);
  let looseWeight = 0;
  let looseCityPop = 0;

  const sphere = grid();
  for (let i = 0; i < TILE_COUNT; i += 1) {
    {
      if (!isLand[i]) continue;

      let w = WEIGHT[world.biome[i]];
      if (w > 0) {
        for (const j of neighbours(i)) {
          if (!isLand[j]) {
            w *= COASTAL_BONUS;
            break;
          }
        }
        w *= 1 + (jitterAt(i) - 0.5) * 2 * JITTER;
      }

      const lat = sphere.lat[i];
      const lon = sphere.lon[i];
      if (w > 0) w *= boostAt(lat, lon);
      weight[i] = w;

      const r = regionAt(lat, lon);
      region[i] = r;
      const cityPop = cityByTile.get(i)?.population ?? 0;
      if (r >= 0) {
        regionWeight[r] += w;
        regionCityPop[r] += cityPop;
      } else {
        looseWeight += w;
        looseCityPop += cityPop;
      }
    }
  }

  // Whatever the regions do not account for is spread over land they missed.
  // A region whose box is fully shadowed by earlier ones owns no land at all;
  // its people would silently disappear, so hand them to the loose pool.
  let regionTotal = 0;
  for (let r = 0; r < REGIONS_1939.length; r += 1) {
    if (regionWeight[r] > 0) regionTotal += REGIONS_1939[r].pop * 1e6;
  }
  const looseTotal = Math.max(0, WORLD_POPULATION_1939 - regionTotal);

  // Population left for the countryside once the cities take their share.
  const regionRural = new Float64Array(REGIONS_1939.length);
  for (let r = 0; r < REGIONS_1939.length; r += 1) {
    regionRural[r] = Math.max(0, REGIONS_1939[r].pop * 1e6 - regionCityPop[r]);
  }
  const looseRural = Math.max(0, looseTotal - looseCityPop);

  const population = new Uint32Array(TILE_COUNT);
  const cityAt = new Int32Array(TILE_COUNT).fill(-1);
  let urban = 0;
  let rural = 0;

  for (let i = 0; i < TILE_COUNT; i += 1) {
    if (!isLand[i]) continue;
    const r = region[i];
    const pool = r >= 0 ? regionRural[r] : looseRural;
    const total = r >= 0 ? regionWeight[r] : looseWeight;
    const share = total > 0 ? (weight[i] / total) * pool : 0;
    population[i] = Math.round(share);
    rural += population[i];
  }

  const cities = [...cityByTile.values()].sort((a, b) => b.population - a.population);
  cities.forEach((city, n) => {
    cityAt[city.index] = n;
    city.rural = population[city.index];
    // The city sits on top of the countryside already counted for that tile.
    population[city.index] += city.population;
    urban += city.population;
  });

  return { population, cityAt, cities, urban, rural, total: urban + rural };
}

export function formatPopulation(n) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M`;
  if (n >= 1e4) return `${Math.round(n / 1e3)}k`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return String(n);
}
