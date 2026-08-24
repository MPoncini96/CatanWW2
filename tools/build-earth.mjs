/**
 * Samples real Earth rasters onto the spherical grid and writes
 * src/world/earthData.js.
 *
 *   node tools/build-earth.mjs
 *
 * Re-run this after changing FREQUENCY in src/world/sphere.js — the baked data
 * is one value per cell, so it has to match the grid it was built for.
 *
 * Sources (NASA-derived rasters shipped with the three-globe package):
 *   earth-water.png     land/sea mask, 255 = water
 *   earth-topology.png  relief, 0 = sea level
 *   earth-day.jpg       natural-colour imagery, used for a vegetation index
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import jpeg from 'jpeg-js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CACHE = path.join(HERE, '.cache');
const OUT_BIN = path.join(HERE, '..', 'src', 'world', 'earth.bin');
const OUT_META = path.join(HERE, '..', 'src', 'world', 'earthData.js');
const BASE = 'https://unpkg.com/three-globe@2.45.2/example/img';
const ASSETS = ['earth-water.png', 'earth-topology.png', 'earth-day.jpg'];

import { buildSphere, FREQUENCY } from '../src/world/sphere.js';

const WATER_CUT = 128; // above this the mask means open water, not a river

async function ensureAssets() {
  fs.mkdirSync(CACHE, { recursive: true });
  for (const name of ASSETS) {
    const file = path.join(CACHE, name);
    if (fs.existsSync(file)) continue;
    process.stdout.write(`downloading ${name}... `);
    const res = await fetch(`${BASE}/${name}`);
    if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
    fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
    console.log('ok');
  }
}

function loadRasters() {
  const png = (n) => {
    const img = PNG.sync.read(fs.readFileSync(path.join(CACHE, n)));
    return { w: img.width, h: img.height, data: img.data };
  };
  const water = png('earth-water.png');
  const topo = png('earth-topology.png');
  const jpg = jpeg.decode(fs.readFileSync(path.join(CACHE, 'earth-day.jpg')), { useTArray: true });
  return { water, topo, day: { w: jpg.width, h: jpg.height, data: jpg.data } };
}

/** Nearest-neighbour sample of an equirectangular raster. */
function sample(img, lon, lat, channel) {
  let x = Math.floor(((lon + 180) / 360) * img.w);
  let y = Math.floor(((90 - lat) / 180) * img.h);
  x = ((x % img.w) + img.w) % img.w;
  y = Math.max(0, Math.min(img.h - 1, y));
  return img.data[(y * img.w + x) * 4 + channel];
}

/**
 * Sample points spread evenly over a hexagon, as offsets from its centre in
 * units of the circumradius.
 *
 * A hexagon is six equilateral triangles round a common centre, so laying a
 * barycentric grid over each wedge covers the whole cell evenly, with no
 * clustering at the middle and nothing spilling over the edges.
 */
/**
 * Points spread over one spherical cell, as unit vectors.
 *
 * The cell is fanned into triangles from its centre, and each triangle is
 * covered by a barycentric lattice. Dense enough that a strait far narrower
 * than a cell still registers in at least one sample — that is what keeps
 * Gibraltar and the Bosporus open when earth.js works out which water bodies
 * reach the open ocean.
 */
function cellSamples(sphere, cell, depth, out) {
  const deg = sphere.valence[cell];
  const cx = sphere.center[cell * 3];
  const cy = sphere.center[cell * 3 + 1];
  const cz = sphere.center[cell * 3 + 2];
  let n = 0;
  for (let k = 0; k < deg; k += 1) {
    const a = sphere.cornerAt[cell * 6 + k];
    const b = sphere.cornerAt[cell * 6 + ((k + 1) % deg)];
    const ax = sphere.cornerXYZ[a * 3], ay = sphere.cornerXYZ[a * 3 + 1], az = sphere.cornerXYZ[a * 3 + 2];
    const bx = sphere.cornerXYZ[b * 3], by = sphere.cornerXYZ[b * 3 + 1], bz = sphere.cornerXYZ[b * 3 + 2];
    // Skip the shared centre and the shared edge, so samples are not repeated.
    for (let i = 1; i <= depth; i += 1) {
      for (let j = 0; j < i; j += 1) {
        const u = i / depth;
        const v = (j + 0.5) / i;
        const wa = u * (1 - v);
        const wb = u * v;
        const wc = 1 - u;
        let x = ax * wa + bx * wb + cx * wc;
        let y = ay * wa + by * wb + cy * wc;
        let z = az * wa + bz * wb + cz * wc;
        const d = Math.hypot(x, y, z);
        out[n * 3] = x / d;
        out[n * 3 + 1] = y / d;
        out[n * 3 + 2] = z / d;
        n += 1;
      }
    }
  }
  // The centre itself, once.
  out[n * 3] = cx;
  out[n * 3 + 1] = cy;
  out[n * 3 + 2] = cz;
  return n + 1;
}

function main() {
  const { water, topo, day } = loadRasters();
  console.log(
    `rasters: water ${water.w}x${water.h}, topo ${topo.w}x${topo.h}, day ${day.w}x${day.h}`,
  );

  process.stdout.write('building the grid... ');
  const sphere = buildSphere();
  console.log(`${sphere.count.toLocaleString()} cells`);

  const n = sphere.count;
  const land = new Uint8Array(n);
  const elevation = new Uint8Array(n);
  const green = new Uint8Array(n);
  const DEPTH = 4; // 6 * 10 + 1 = 61 points per cell
  const buf = new Float64Array(6 * ((DEPTH * (DEPTH + 1)) / 2) * 3 + 3);
  const toDeg = 180 / Math.PI;

  for (let i = 0; i < n; i += 1) {
    const count = cellSamples(sphere, i, DEPTH, buf);
    let landHits = 0;
    let elevSum = 0;
    let elevCount = 0;
    let greenSum = 0;

    for (let k = 0; k < count; k += 1) {
      const x = buf[k * 3];
      const y = buf[k * 3 + 1];
      const z = buf[k * 3 + 2];
      const lat = Math.asin(Math.min(1, Math.max(-1, y))) * toDeg;
      const lon = Math.atan2(x, z) * toDeg;

      if (sample(water, lon, lat, 0) < WATER_CUT) {
        landHits += 1;
        elevSum += sample(topo, lon, lat, 0);
        const r = sample(day, lon, lat, 0);
        const g = sample(day, lon, lat, 1);
        const b2 = sample(day, lon, lat, 2);
        // Vegetation index proxy: how far green leads the other channels.
        greenSum += Math.max(0, Math.min(255, (g - (r + b2) / 2) * 4 + 40));
        elevCount += 1;
      }
    }

    land[i] = Math.round((landHits / count) * 255);
    elevation[i] = elevCount ? Math.round(elevSum / elevCount) : 0;
    green[i] = elevCount ? Math.round(greenSum / elevCount) : 0;
  }

  // Three byte planes, concatenated. Shipped as a binary asset rather than
  // base64 in JS: a third smaller, and it keeps the bundle lean as the grid grows.
  const blob = Buffer.concat([Buffer.from(land), Buffer.from(elevation), Buffer.from(green)]);
  fs.writeFileSync(OUT_BIN, blob);

  const landTiles = land.reduce((acc, v) => acc + (v >= 128 ? 1 : 0), 0);
  fs.writeFileSync(
    OUT_META,
    `// Generated by tools/build-earth.mjs — do not edit by hand.
//
// Shape of the companion earth.bin: three byte planes, one byte per cell in
// grid order, sampled from NASA-derived equirectangular rasters (land mask,
// topography, natural-colour imagery) shipped with the three-globe package.
export const EARTH = {
  frequency: ${FREQUENCY},
  cells: ${sphere.count},
  /** Byte planes in order, one byte per cell. */
  planes: ['land', 'elevation', 'green'],
};
`,
  );
  console.log(
    `wrote src/world/earth.bin — ${n.toLocaleString()} cells, ` +
      `${((landTiles / n) * 100).toFixed(1)}% land, ${(blob.length / 1024).toFixed(0)} KB`,
  );
}

await ensureAssets();
main();
