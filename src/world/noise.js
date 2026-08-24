// Small seeded value noise, used to break up derived fields (ocean depth) that
// would otherwise show the geometry of the grid they were computed on.
// Sampled on a cylinder so it matches across the world's wrap seam.

function hash(ix, iy, iz, seed) {
  let h = seed | 0;
  h = Math.imul(h ^ (ix | 0), 374761393);
  h = Math.imul(h ^ (iy | 0), 668265263);
  h = Math.imul(h ^ (iz | 0), 1274126177);
  h ^= h >>> 15;
  h = Math.imul(h, 2246822519);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

function fade(t) {
  return t * t * (3 - 2 * t);
}

/** Value noise in 0..1 at a point on a cylinder of the given circumference. */
export function cylinderNoise(x, y, circumference, frequency, seed) {
  const theta = (x / circumference) * Math.PI * 2;
  const radius = (circumference * frequency) / (2 * Math.PI);
  const nx = Math.cos(theta) * radius;
  const nz = Math.sin(theta) * radius;
  const ny = y * frequency;

  const x0 = Math.floor(nx);
  const y0 = Math.floor(ny);
  const z0 = Math.floor(nz);
  const fx = fade(nx - x0);
  const fy = fade(ny - y0);
  const fz = fade(nz - z0);

  const lerp = (a, b, t) => a + (b - a) * t;
  const c00 = lerp(hash(x0, y0, z0, seed), hash(x0 + 1, y0, z0, seed), fx);
  const c10 = lerp(hash(x0, y0 + 1, z0, seed), hash(x0 + 1, y0 + 1, z0, seed), fx);
  const c01 = lerp(hash(x0, y0, z0 + 1, seed), hash(x0 + 1, y0, z0 + 1, seed), fx);
  const c11 = lerp(hash(x0, y0 + 1, z0 + 1, seed), hash(x0 + 1, y0 + 1, z0 + 1, seed), fx);

  return lerp(lerp(c00, c10, fy), lerp(c01, c11, fy), fz);
}

/** Two octaves of cylinderNoise, in 0..1. */
export function fbm2(x, y, circumference, frequency, seed) {
  return (
    cylinderNoise(x, y, circumference, frequency, seed) * 0.67 +
    cylinderNoise(x, y, circumference, frequency * 2.7, seed + 1013) * 0.33
  );
}

/**
 * Value noise in 0..1 at a point on the unit sphere.
 *
 * The cylinder version had to match itself across the wrap seam and stretched
 * towards the poles. On the sphere there is no seam and no pole, so the noise
 * is simply sampled in three dimensions at the point itself.
 */
export function sphereNoise(x, y, z, frequency, seed) {
  const nx = x * frequency;
  const ny = y * frequency;
  const nz = z * frequency;

  const x0 = Math.floor(nx);
  const y0 = Math.floor(ny);
  const z0 = Math.floor(nz);
  const fx = fade(nx - x0);
  const fy = fade(ny - y0);
  const fz = fade(nz - z0);

  const lerp = (a, b, t) => a + (b - a) * t;
  const c00 = lerp(hash(x0, y0, z0, seed), hash(x0 + 1, y0, z0, seed), fx);
  const c10 = lerp(hash(x0, y0 + 1, z0, seed), hash(x0 + 1, y0 + 1, z0, seed), fx);
  const c01 = lerp(hash(x0, y0, z0 + 1, seed), hash(x0 + 1, y0, z0 + 1, seed), fx);
  const c11 = lerp(hash(x0, y0 + 1, z0 + 1, seed), hash(x0 + 1, y0 + 1, z0 + 1, seed), fx);

  return lerp(lerp(c00, c10, fy), lerp(c01, c11, fy), fz);
}

/** Two octaves of sphereNoise, in 0..1. */
export function fbm3(x, y, z, frequency, seed) {
  return (
    sphereNoise(x, y, z, frequency, seed) * 0.67 +
    sphereNoise(x, y, z, frequency * 2.7, seed + 1013) * 0.33
  );
}
