// Biome table. Every hex stores a biome id plus a shade variant, which is what
// lets the renderer batch thousands of hexes into a handful of fills
// while still looking hand-textured.

export const TERRAIN = [
  { id: 'abyss', name: 'Abyss', color: '#0a2038', water: true, move: 1 },
  { id: 'ocean', name: 'Ocean', color: '#123f63', water: true, move: 1 },
  { id: 'shelf', name: 'Coastal Shelf', color: '#1c6188', water: true, move: 1 },
  { id: 'lake', name: 'Lake', color: '#2f7dab', water: true, move: 1 },
  { id: 'seaice', name: 'Sea Ice', color: '#c4d8e4', water: true, move: 2 },
  { id: 'beach', name: 'Shoreline', color: '#d5c188', water: false, move: 1 },
  { id: 'desert', name: 'Desert', color: '#d3ac63', water: false, move: 2 },
  { id: 'savanna', name: 'Savanna', color: '#b0a54e', water: false, move: 1 },
  { id: 'plains', name: 'Plains', color: '#8ba955', water: false, move: 1 },
  { id: 'forest', name: 'Forest', color: '#4a7c46', water: false, move: 2 },
  { id: 'jungle', name: 'Jungle', color: '#2f6b3c', water: false, move: 3 },
  { id: 'swamp', name: 'Wetlands', color: '#5c7346', water: false, move: 3 },
  { id: 'taiga', name: 'Taiga', color: '#3d6a55', water: false, move: 2 },
  { id: 'tundra', name: 'Tundra', color: '#93a292', water: false, move: 2 },
  { id: 'hills', name: 'Hills', color: '#7b8148', water: false, move: 2 },
  { id: 'mountain', name: 'Mountains', color: '#7a7168', water: false, move: 4 },
  { id: 'peak', name: 'Snowcap', color: '#e2e9ee', water: false, move: 5 },
  { id: 'glacier', name: 'Glacier', color: '#eef4f8', water: false, move: 4 },
];

export const T = Object.fromEntries(TERRAIN.map((t, i) => [t.id, i]));

export const SHADES = 4;

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function clamp255(v) {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function shift(rgb, amount) {
  return `rgb(${clamp255(rgb[0] + amount)},${clamp255(rgb[1] + amount)},${clamp255(rgb[2] + amount)})`;
}

// [biome][shade] -> css color. Shade 0 is darkest, SHADES-1 lightest.
export const PALETTE = TERRAIN.map((t) => {
  const rgb = hexToRgb(t.color);
  const span = t.water ? 9 : 14;
  return Array.from({ length: SHADES }, (_, s) => shift(rgb, (s / (SHADES - 1) - 0.5) * 2 * span));
});

// The same palette as numbers rather than CSS strings. The globe uploads one
// colour per cell to the GPU as bytes, so it never wants a string.
export const PALETTE_RGB = TERRAIN.map((t) => {
  const rgb = hexToRgb(t.color);
  const span = t.water ? 9 : 14;
  return Array.from({ length: SHADES }, (_, s) => {
    const a = (s / (SHADES - 1) - 0.5) * 2 * span;
    return [clamp255(rgb[0] + a), clamp255(rgb[1] + a), clamp255(rgb[2] + a)];
  });
});

/** '#rrggbb' to [r, g, b]. */
export function rgbOf(hex) {
  return hexToRgb(hex);
}
