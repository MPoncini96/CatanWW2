import { TILE_COUNT, cellAt, grid, neighbours } from './sphere.js';
import { FARM_ZONES, SITES, ZONES } from './resourceSites.js';
import { TERRAIN } from './terrain.js';

// What each hex produced in a year, around 1939.
//
// This is output, not endowment: a tile scores for the ore actually being
// raised and the fields actually being worked, not for what might be there. So
// Saudi Arabia is nearly dry (Dammam had only just come in), Libya has no oil
// at all, and the Athabasca sands and the Pilbara are blank.
//
// Food works differently from the rest. Minerals sit where geology put them,
// but food in 1939 was grown where people were — before cheap long-haul
// transport, most of what a district ate, it grew. So farm output follows
// settlement, and then the export breadbaskets are lifted on top.

// Colours have to carry on a dark, dimmed map, so these lean brighter than the
// material itself — oil reads as amber rather than the conventional black.
export const RESOURCES = [
  { id: 'food', name: 'Food', unit: 'kt/yr', color: '#9ad35a' },
  { id: 'oil', name: 'Oil', unit: 'kt/yr', color: '#e0a83c' },
  { id: 'iron', name: 'Iron ore', unit: 'kt/yr', color: '#e0765a' },
  { id: 'steel', name: 'Steel', unit: 'kt/yr', color: '#8fd0e8' },
  { id: 'aluminium', name: 'Aluminium', unit: 't/yr', color: '#e8eef5' },
  { id: 'rubber', name: 'Rubber', unit: 't/yr', color: '#c98fd8' },
];

export const RESOURCE_INDEX = Object.fromEntries(RESOURCES.map((r, i) => [r.id, i]));

/** Cropland value of a terrain, relative to good plains. */
const FARMLAND = {
  plains: 1,
  forest: 0.55, // cleared in patches; woodland between
  hills: 0.5,
  beach: 0.4,
  swamp: 0.6, // wet, but this is where rice grows
  savanna: 0.3,
  jungle: 0.2,
  taiga: 0.08,
  mountain: 0.07,
  desert: 0.04, // oasis and wadi only
  tundra: 0.01,
  peak: 0,
  glacier: 0,
};

/** Grazing value — the dry and cold country that carries stock but not crops. */
const PASTURE = {
  savanna: 0.55,
  plains: 0.4,
  hills: 0.45,
  tundra: 0.18, // reindeer
  taiga: 0.12,
  mountain: 0.2,
  desert: 0.06,
  forest: 0.15,
  swamp: 0.1,
  jungle: 0.05,
  beach: 0.1,
  peak: 0,
  glacier: 0,
};

// World totals to calibrate against, in the units each resource is stored in.
const WORLD_FARM_FOOD = 1_150_000; // kt/yr, grain equivalent incl. pasture
const FISHERY_SHARE = 0.75; // of a zone's catch that lands near shore

const FARMLAND_WEIGHT = TERRAIN.map((t) => (t.water ? 0 : FARMLAND[t.id] ?? 0));
const PASTURE_WEIGHT = TERRAIN.map((t) => (t.water ? 0 : PASTURE[t.id] ?? 0));

function inBox(box, lat, lon) {
  return lon >= box[0] && lon <= box[2] && lat >= box[1] && lat <= box[3];
}

function farmZoneFactor(lat, lon) {
  let factor = 1;
  for (const z of FARM_ZONES) if (inBox(z.box, lat, lon)) factor *= z.factor;
  return factor;
}

/** Cell a lat/lon lands on, walked to the nearest land if the site needs it. */
function tileFor(lat, lon, isLand, wantLand) {
  const index = cellAt(grid(), lat, lon);
  if (!wantLand || isLand[index]) return index;

  // Coastal works and offshore fields can fall on a sea cell; walk out.
  const seen = new Set([index]);
  let frontier = [index];
  for (let depth = 0; depth < 5 && frontier.length; depth += 1) {
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
  return index;
}

/**
 * Per-tile annual output for every resource.
 *
 * @returns {{amounts: Float32Array[], totals: number[], sites: Array}}
 */
export function buildResources(world) {
  const sphere = grid();
  const isLand = new Uint8Array(TILE_COUNT);
  for (let i = 0; i < TILE_COUNT; i += 1) isLand[i] = TERRAIN[world.biome[i]].water ? 0 : 1;

  const amounts = RESOURCES.map(() => new Float32Array(TILE_COUNT));
  const sitesByTile = new Map();

  // ---- Point sources: fields, mines, works, smelters -----------------------
  for (const [resource, name, lat, lon, output] of SITES) {
    const r = RESOURCE_INDEX[resource];
    if (r === undefined) continue;
    const index = tileFor(lat, lon, isLand, true);
    amounts[r][index] += output;
    if (!sitesByTile.has(index)) sitesByTile.set(index, []);
    sitesByTile.get(index).push({ resource, name, output });
  }

  // ---- Area sources: plantations and fisheries ------------------------------
  // Zone boxes overlap — the Malayan and Sumatran estates share the Strait of
  // Malacca, and neighbouring fisheries meet along their edges. Tiles are
  // claimed by the first zone that covers them, so no ground is worked twice.
  const claimed = RESOURCES.map(() => new Uint8Array(TILE_COUNT));

  for (const zone of ZONES) {
    const r = RESOURCE_INDEX[zone.resource];
    if (r === undefined) continue;

    // Score every eligible tile first, then divide the zone's output by score.
    const tiles = [];
    const scores = [];
    let totalScore = 0;

    for (let i = 0; i < TILE_COUNT; i += 1) {
      {
        if (claimed[r][i]) continue;
        const lat = sphere.lat[i];
        const lon = sphere.lon[i];
        if (!inBox(zone.box, lat, lon)) continue;

        let score;
        if (zone.sea) {
          if (isLand[i]) continue;
          // Fish were landed by boats working out of ports, so a zone's catch
          // belongs near the shore, not spread evenly over deep water.
          const coastal = neighbours(i).some((j) => isLand[j]);
          score = coastal ? 1 : TERRAIN[world.biome[i]].id === 'shelf' ? FISHERY_SHARE : 0.15;
        } else {
          if (!isLand[i]) continue;
          // Estates were carved out of wet tropical forest, so jungle is prime
          // ground for rubber even though it is poor cropland.
          score =
            TERRAIN[world.biome[i]].id === 'jungle' ? 1 : FARMLAND_WEIGHT[world.biome[i]];
        }
        if (score <= 0) continue;
        claimed[r][i] = 1;
        tiles.push(i);
        scores.push(score);
        totalScore += score;
      }
    }

    if (totalScore <= 0) continue;
    for (let k = 0; k < tiles.length; k += 1) {
      amounts[r][tiles[k]] += (scores[k] / totalScore) * zone.output;
    }
  }

  // ---- Food from farm and pasture -----------------------------------------
  // Two passes: score every tile, then scale the world to the target total.
  const foodScore = new Float32Array(TILE_COUNT);
  let scoreTotal = 0;

  // Population per tile, normalised, is the proxy for how hard land was worked.
  let popMax = 1;
  for (let i = 0; i < TILE_COUNT; i += 1) {
    if (world.population[i] > popMax) popMax = world.population[i];
  }

  for (let i = 0; i < TILE_COUNT; i += 1) {
    {
      if (!isLand[i]) continue;
      const farm = FARMLAND_WEIGHT[world.biome[i]];
      const graze = PASTURE_WEIGHT[world.biome[i]];
      if (farm <= 0 && graze <= 0) continue;

      const lat = sphere.lat[i];
      const lon = sphere.lon[i];

      // How intensively the land was worked. A square-root of local population
      // keeps the curve from running away under a city while still putting the
      // market gardens where the mouths were; the floor leaves room for the
      // thinly peopled export country to still farm.
      //
      // Population is averaged over the tile and its neighbours first. Regional
      // populations come from rectangles, so density steps at a box edge; left
      // raw, that step draws a visible straight line across the farm map.
      let popSum = world.population[i];
      let popCount = 1;
      for (const j of neighbours(i)) {
        popSum += world.population[j];
        popCount += 1;
      }
      const density = Math.min(1, Math.sqrt(popSum / popCount / popMax) * 3);
      const worked = 0.18 + 0.82 * density;

      // Pasture needs far less labour than cropland, so it stays productive out
      // in the empty country — the pampas, the veld, the Australian runs.
      const score = farm * worked * farmZoneFactor(lat, lon) + graze * (0.35 + 0.65 * worked);
      foodScore[i] = score;
      scoreTotal += score;
    }
  }

  const foodIdx = RESOURCE_INDEX.food;
  if (scoreTotal > 0) {
    const perScore = WORLD_FARM_FOOD / scoreTotal;
    for (let i = 0; i < TILE_COUNT; i += 1) {
      if (foodScore[i] > 0) amounts[foodIdx][i] += foodScore[i] * perScore;
    }
  }

  // Per-resource summary, worked out once. The renderer needs the maximum for
  // its colour ramp and the producing-tile count to tell a point source from a
  // field; both are constants, and rescanning 117,760 tiles every frame to
  // rediscover them is pure waste.
  const stats = amounts.map((a) => {
    let sum = 0;
    let max = 0;
    let producing = 0;
    for (let i = 0; i < a.length; i += 1) {
      const v = a[i];
      if (v <= 0) continue;
      sum += v;
      producing += 1;
      if (v > max) max = v;
    }
    return { total: sum, max, producing, pointSource: producing < a.length * 0.06 };
  });

  return { amounts, totals: stats.map((x) => x.total), stats, sitesByTile };
}

/** Format an amount in a resource's own unit. */
export function formatAmount(value, unit) {
  if (value <= 0) return '—';
  if (unit === 'kt/yr') {
    if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)} Mt`;
    if (value >= 10) return `${Math.round(value)} kt`;
    return `${value.toFixed(1)} kt`;
  }
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)} kt`;
  return `${Math.round(value)} t`;
}
