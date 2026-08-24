import { TILE_COUNT } from '../world/sphere.js';
import { PALETTE_RGB, SHADES, TERRAIN, rgbOf } from '../world/terrain.js';
import { NATIONS, NEUTRAL, SEA } from '../world/nations.js';
import { RESOURCES } from '../world/resources.js';

// One colour per cell, as bytes.
//
// The flat board used to redraw thousands of polygons every time a layer
// changed, and cached the results in three tiers to make that bearable. The
// globe holds its geometry on the GPU permanently and only ever swaps the
// colours, so switching between Terrain, Nations and Forces costs one upload of
// half a megabyte instead of a rebuild.

/** Sea drawn under an overlay: dark enough that the land reads first. */
const BACKDROP = [10, 17, 26];
const UNCLAIMED = [42, 48, 58];

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
 * Who holds what.
 *
 * Countries carry their own colour — a belligerent's empire flies its flag, the
 * neutrals each have their own — and the sea recedes so the borders read.
 */
export function politicalColors(world, out) {
  const owner = world.ownership.owner;
  const cache = new Map();
  for (let i = 0; i < TILE_COUNT; i += 1) {
    const nation = owner[i];
    if (nation === SEA) {
      write(out, i, BACKDROP);
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
    write(out, i, nation === NEUTRAL && !country ? UNCLAIMED : rgb);
  }
  return out;
}

/**
 * Where the armies stand.
 *
 * Coloured by whose they are and darkened by how little is there, so the map
 * shows both at once rather than making one stand for the other.
 *
 * The sea keeps its own colours here rather than receding to the backdrop the
 * other overlays use. Armies sit only on land, so the water is not competing
 * with them for attention, and leaving it as it is keeps the coastlines — which
 * is where the fronts of 1939 mostly ran.
 */
export function forceColors(world, out) {
  const owner = world.ownership.owner;
  const strength = world.forceStrength;
  const logMax = Math.log1p(world.maxForceStrength || 1);
  const cache = new Map();
  for (let i = 0; i < TILE_COUNT; i += 1) {
    const nation = owner[i];
    const value = strength ? strength[i] : 0;
    if (nation === SEA) {
      write(out, i, PALETTE_RGB[world.biome[i]][world.shade[i]]);
      continue;
    }
    if (value <= 0) {
      // Land nobody garrisons — Antarctica, the empty quarter of the Sahara.
      // Grey rather than the backdrop, so it still reads as ground now that the
      // sea beside it is in full colour.
      write(out, i, UNCLAIMED);
      continue;
    }
    const hex = NATIONS[nation].color;
    let rgb = cache.get(hex);
    if (!rgb) {
      rgb = rgbOf(hex);
      cache.set(hex, rgb);
    }
    // Log scale: a garrison of ten thousand and one of a million are both worth
    // seeing, and a linear ramp would show only the second.
    const t = Math.log1p(value) / logMax;
    write(out, i, rgb, 0.28 + t * 0.72);
  }
  return out;
}

/** One resource's output, as brightness over a dark ground. */
export function resourceColors(world, resourceId, out) {
  const r = RESOURCES.findIndex((x) => x.id === resourceId);
  if (r < 0) return terrainColors(world, out);
  const amounts = world.resources[r];
  let max = 0;
  for (let i = 0; i < TILE_COUNT; i += 1) if (amounts[i] > max) max = amounts[i];
  const logMax = Math.log1p(max || 1);
  const rgb = rgbOf(RESOURCES[r].color);

  for (let i = 0; i < TILE_COUNT; i += 1) {
    const value = amounts[i];
    if (value <= 0) {
      // Keep a hint of the coastline under the overlay so the shape of the
      // world does not disappear along with the zeroes.
      write(out, i, TERRAIN[world.biome[i]].water ? BACKDROP : UNCLAIMED);
      continue;
    }
    const t = Math.log1p(value) / logMax;
    write(out, i, rgb, 0.3 + t * 0.7);
  }
  return out;
}

/** Fill `out` for whichever layer is on show. */
export function colorsFor(world, layer, out) {
  if (layer === 'nations') return politicalColors(world, out);
  if (layer === 'forces') return forceColors(world, out);
  if (layer) return resourceColors(world, layer, out);
  return terrainColors(world, out);
}

export { SHADES };

/**
 * An equirectangular thumbnail of the whole world, for the minimap.
 *
 * Built by splatting each cell onto the image rather than asking which cell
 * covers each pixel: there are more cells than pixels, so every pixel is
 * covered, and it avoids a hundred thousand nearest-cell searches.
 */
export function buildThumbnail(world, width, height) {
  const sphere = world.sphere;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(width, height);
  const colors = new Uint8Array(TILE_COUNT * 4);
  terrainColors(world, colors);

  for (let i = 0; i < TILE_COUNT; i += 1) {
    const x = Math.min(width - 1, Math.floor(((sphere.lon[i] + 180) / 360) * width));
    const y = Math.min(height - 1, Math.floor(((90 - sphere.lat[i]) / 180) * height));
    const p = (y * width + x) * 4;
    image.data[p] = colors[i * 4];
    image.data[p + 1] = colors[i * 4 + 1];
    image.data[p + 2] = colors[i * 4 + 2];
    image.data[p + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}
