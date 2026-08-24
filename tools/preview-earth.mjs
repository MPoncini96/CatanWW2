/**
 * ASCII sanity check of the baked Earth data.
 *
 *   node tools/preview-earth.mjs [columns]
 *
 * The board is a sphere now, so this projects it back onto an equirectangular
 * sheet purely to have something to look at in a terminal.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EARTH } from '../src/world/earthData.js';
import { grid } from '../src/world/sphere.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const bin = fs.readFileSync(path.join(HERE, '..', 'src', 'world', 'earth.bin'));
if (bin.length !== EARTH.cells * 3) {
  throw new Error(`earth.bin is ${bin.length} bytes, expected ${EARTH.cells * 3}`);
}
const land = bin.subarray(0, EARTH.cells);
const elev = bin.subarray(EARTH.cells, EARTH.cells * 2);

const width = Number(process.argv[2]) || 108;
const height = Math.round(width / 2);
const sphere = grid();

// Splat every cell onto the sheet: there are more cells than characters.
const rows = Array.from({ length: height }, () => new Array(width).fill(' '));
for (let i = 0; i < EARTH.cells; i += 1) {
  if (land[i] < 128) continue;
  const x = Math.min(width - 1, Math.floor(((sphere.lon[i] + 180) / 360) * width));
  const y = Math.min(height - 1, Math.floor(((90 - sphere.lat[i]) / 180) * height));
  const e = elev[i];
  rows[y][x] = e > 120 ? '#' : e > 60 ? '+' : e > 25 ? '.' : ':';
}
for (const row of rows) console.log(row.join(''));

const landCells = land.reduce((acc, v) => acc + (v >= 128 ? 1 : 0), 0);
console.log(
  `\n${EARTH.cells.toLocaleString()} cells at frequency ${EARTH.frequency}, ` +
    `${((landCells / EARTH.cells) * 100).toFixed(1)}% land`,
);
