import { TILE_COUNT } from '../world/sphere.js';
import { PALETTE_RGB, SHADES, TERRAIN, rgbOf } from '../world/terrain.js';
import { NATIONS, NEUTRAL, SEA } from '../world/nations.js';
import { RESOURCES } from '../world/resources.js';
import { canSeeForces } from '../world/intel.js';

// One colour per cell, as bytes.
//
// The flat board used to redraw thousands of polygons every time a layer
// changed, and cached the results in three tiers to make that bearable. The
// globe holds its geometry on the GPU permanently and only ever swaps the
// colours, so switching between Terrain, Nations and Forces costs one upload of
// half a megabyte instead of a rebuild.

/** Sea drawn under the resource overlays: dark, so the output reads first. */
const BACKDROP = [10, 17, 26];
const UNCLAIMED = [42, 48, 58];
/** Ground whose garrison this seat is not allowed to know about. */
const UNKNOWN = [30, 35, 44];

/** Two colours, mixed: 0 is all of the first, 1 all of the second. */
function mix(a, b, amount) {
  return [
    a[0] + (b[0] - a[0]) * amount,
    a[1] + (b[1] - a[1]) * amount,
    a[2] + (b[2] - a[2]) * amount,
  ];
}

function write(out, i, rgb, scale = 1) {
  out[i * 4] = rgb[0] * scale;
  out[i * 4 + 1] = rgb[1] * scale;
  out[i * 4 + 2] = rgb[2] * scale;
  out[i * 4 + 3] = 255;
}

/** The physical world: biome colour, stepped by the per-cell shade. */
export function terrainColors(world, out) {
  for (let i = 0; i < TILE_COUNT; i += 1) {
    write(out, i, PALETTE_RGB[world.biome[i]][world.shade[i]]);
  }
  return out;
}

/**
 * Who holds what, and what they have standing on it.
 *
 * These were two layers and are now one, because they were always one question:
 * a political map that cannot show where the divisions are is a map of who owns
 * the ground rather than who holds it. Every country keeps its own colour — a
 * belligerent's empire in its flag, the neutrals each in their own — and the
 * colour is lifted by the weight of the garrison on that cell, so the front
 * line, the fortified frontier and the empty interior all read at a glance
 * without a second layer to switch to.
 *
 * Three things are being said at once, and they have to stay distinguishable:
 *
 *   bright colour   whose it is, and a great deal standing on it
 *   dim colour      whose it is, and little or nothing standing on it
 *   grey            whose it is, and you are not allowed to count it
 *
 * The floor matters. Ground with no garrison is drawn at 42% rather than fading
 * out, because ownership is public and an empty province is still somebody's;
 * only what the fog takes is allowed to lose its colour, and even then it keeps
 * a third of it, so the shape of the other side's empire is still legible.
 *
 * The sea keeps the blue it has on the terrain layer. Armies sit only on land,
 * so the water is not competing with them, and it keeps the coastlines — which
 * is where the fronts of 1939 mostly ran.
 */
const FLOOR = 0.42;
const FOG_MIX = 0.66;

export function politicalColors(world, out, viewer = null) {
  const owner = world.ownership.owner;
  const strength = world.forceStrength;
  const logMax = Math.log1p(world.maxForceStrength || 1);
  const cache = new Map();

  for (let i = 0; i < TILE_COUNT; i += 1) {
    const nation = owner[i];
    if (nation === SEA) {
      write(out, i, PALETTE_RGB[world.biome[i]][world.shade[i]]);
      continue;
    }

    const id = world.countryOf ? world.countryOf[i] : -1;
    const country = id >= 0 ? world.countries[id] : null;
    const hex = country ? country.color : NATIONS[nation].color;
    let rgb = cache.get(hex);
    if (!rgb) {
      rgb = rgbOf(hex);
      cache.set(hex, rgb);
    }
    if (nation === NEUTRAL && !country) rgb = UNCLAIMED;

    if (!canSeeForces(viewer, nation)) {
      write(out, i, mix(rgb, UNKNOWN, FOG_MIX));
      continue;
    }

    // Log scale: a garrison of ten thousand and one of a million are both worth
    // seeing, and a linear ramp would show only the second.
    const value = strength ? strength[i] : 0;
    const t = value > 0 ? Math.log1p(value) / logMax : 0;
    write(out, i, rgb, FLOOR + t * (1 - FLOOR));
  }
  return out;
}

/**
 * What the land produced — all five at once.
 *
 * Five separate maps meant five buttons and no way to see that the oil is in
 * one hemisphere and the rubber in another. One map instead: a cell takes the
 * colour of whatever it is most notable for, and its brightness from how
 * notable that is.
 *
 * "Most notable" has to be measured per resource or the answer would be the
 * same everywhere. Iron is mined by the hundred million tonnes and aluminium by
 * the hundred thousand, so a raw comparison makes every smelter on earth
 * invisible; each cell's output is scored against the largest of its own kind,
 * on a log scale, and the biggest of those five scores picks the colour.
 */
export function outputColors(world, out) {
  const amounts = world.resources;
  const logMax = amounts.map((a) => {
    let max = 0;
    for (let i = 0; i < a.length; i += 1) if (a[i] > max) max = a[i];
    return Math.log1p(max || 1);
  });
  const rgb = RESOURCES.map((r) => rgbOf(r.color));

  for (let i = 0; i < TILE_COUNT; i += 1) {
    let best = -1;
    let bestShare = 0;
    for (let r = 0; r < amounts.length; r += 1) {
      if (amounts[r][i] <= 0) continue;
      const share = Math.log1p(amounts[r][i]) / logMax[r];
      if (share > bestShare) {
        bestShare = share;
        best = r;
      }
    }
    if (best < 0) {
      // Keep a hint of the coastline under the overlay so the shape of the
      // world does not disappear along with the zeroes.
      write(out, i, TERRAIN[world.biome[i]].water ? BACKDROP : UNCLAIMED);
      continue;
    }
    write(out, i, rgb[best], 0.3 + bestShare * 0.7);
  }
  return out;
}

/**
 * Fill `out` for whichever layer is on show.
 *
 * `viewer` is the seat looking at it. Only the Nations layer cares: who holds
 * what is public, how much of it is under arms is not.
 */
export function colorsFor(world, layer, out, viewer = null) {
  if (layer === 'nations') return politicalColors(world, out, viewer);
  if (layer === 'output') return outputColors(world, out);
  return terrainColors(world, out);
}

export { SHADES };
