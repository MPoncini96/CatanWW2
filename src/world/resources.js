import { TILE_COUNT, cellAt, grid, neighbours } from './sphere.js';
import { SITES, ZONES } from './resourceSites.js';
import { TERRAIN } from './terrain.js';

// What each hex produced in a year, around 1939.
//
// This is output, not endowment: a tile scores for the ore actually being
// raised, not for what might be there. So Saudi Arabia is nearly dry (Dammam
// had only just come in), Libya has no oil at all, and the Athabasca sands and
// the Pilbara are blank.
//
// Five things, and all five are war materials. Food was modelled here too — it
// followed the people rather than the geology, which made it the odd one out —
// and has been taken out: it is not on the board and no hex reports it.

// Colours have to carry on a dark, dimmed map, so these lean brighter than the
// material itself — oil reads as amber rather than the conventional black.
export const RESOURCES = [
  { id: 'oil', name: 'Oil', unit: 'kt/yr', color: '#e0a83c' },
  { id: 'iron', name: 'Iron ore', unit: 'kt/yr', color: '#e0765a' },
  { id: 'steel', name: 'Steel', unit: 'kt/yr', color: '#8fd0e8' },
  { id: 'aluminium', name: 'Aluminium', unit: 't/yr', color: '#e8eef5' },
  { id: 'rubber', name: 'Rubber', unit: 't/yr', color: '#c98fd8' },
];

export const RESOURCE_INDEX = Object.fromEntries(RESOURCES.map((r, i) => [r.id, i]));

/**
 * How well ground carries a rubber estate.
 *
 * These were the cropland weights, back when this file grew food as well, and
 * they are kept because an estate wanted the same ground a crop would: flat,
 * warm and wet. Jungle is the exception that scores highest — the estates of
 * Malaya and Sumatra were cut straight out of it.
 */
const ESTATE = {
  jungle: 1,
  plains: 1,
  swamp: 0.6,
  forest: 0.55,
  hills: 0.5,
  beach: 0.4,
  savanna: 0.3,
  taiga: 0.08,
  mountain: 0.07,
  desert: 0.04,
  tundra: 0.01,
  peak: 0,
  glacier: 0,
};

const ESTATE_WEIGHT = TERRAIN.map((t) => (t.water ? 0 : ESTATE[t.id] ?? 0));

function inBox(box, lat, lon) {
  return lon >= box[0] && lon <= box[2] && lat >= box[1] && lat <= box[3];
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

        if (!isLand[i]) continue;
        const score = ESTATE_WEIGHT[world.biome[i]];
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
