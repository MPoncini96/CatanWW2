// A hex grid on the sphere itself, rather than on a rectangle pretending to be one.
//
// An equirectangular board has one fatal property for a game: its cells are not
// the same size. At 444 x 256 a hex at the equator covered about 7,000 square
// kilometres and one at 87N covered 307 — twenty-three times smaller. Half the
// land hexes sat poleward of 60 degrees holding a fifth of the actual land, so
// Siberia and the Canadian Arctic were worth several times what they should
// have been, and every per-hex quantity inherited the error.
//
// The fix is the Goldberg polyhedron: subdivide an icosahedron, then take the
// dual. Every cell comes out the same size to within a few per cent, there is
// no seam to wrap and no pole to degenerate at.
//
// The catch, and it is unavoidable: you cannot tile a sphere with hexagons
// alone. Exactly twelve cells are pentagons, sitting at the vertices of the
// original icosahedron. Twelve out of a hundred and fourteen thousand.
//
//        subdivided icosahedron          its dual
//              /\  /\  /\                 ⬡ ⬡ ⬡ ⬡
//             /__\/__\/__\      ->       ⬡ ⬡ ⬡ ⬡ ⬡
//             \  /\  /\  /                ⬡ ⬡ ⬡ ⬡
//              \/__\/__\/
//
// Vertices of the subdivided mesh become cell centres; circum-centres of its
// triangles become cell corners. A frequency-n subdivision gives 10n^2 + 2
// cells, so n = 107 gives 114,492 — the same board size as before, with the
// distortion taken out.

/** Subdivision frequency. Cells = 10n^2 + 2. */
export const FREQUENCY = 107;
export const TILE_COUNT = 10 * FREQUENCY * FREQUENCY + 2;
export const TRIANGLE_COUNT = 20 * FREQUENCY * FREQUENCY;
/** Mean radius in kilometres, for turning cell counts into ground truth. */
export const EARTH_RADIUS_KM = 6371;

const PHI = (1 + Math.sqrt(5)) / 2;

// The twelve icosahedron vertices, as three golden rectangles.
const ICO_VERTS = [
  [-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0],
  [0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI],
  [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1],
];

// Twenty faces, all wound anticlockwise seen from outside.
const ICO_FACES = [
  [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
  [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
  [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
  [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
];

function normalise(v) {
  const d = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / d, v[1] / d, v[2] / d];
}

/**
 * Interpolate along the great circle between two unit vectors.
 *
 * Plain linear interpolation would bunch cells towards the middle of each
 * icosahedral face; going along the arc keeps them even.
 */
function slerp(a, b, t, out, o) {
  const dot = Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
  const theta = Math.acos(dot);
  if (theta < 1e-9) {
    out[o] = a[0];
    out[o + 1] = a[1];
    out[o + 2] = a[2];
    return;
  }
  const s = Math.sin(theta);
  const wa = Math.sin((1 - t) * theta) / s;
  const wb = Math.sin(t * theta) / s;
  const x = a[0] * wa + b[0] * wb;
  const y = a[1] * wa + b[1] * wb;
  const z = a[2] * wa + b[2] * wb;
  const d = Math.hypot(x, y, z);
  out[o] = x / d;
  out[o + 1] = y / d;
  out[o + 2] = z / d;
}

/**
 * Global index of the lattice point (i, j) on face `face`.
 *
 * Faces share their edges and corners, so a point on a boundary must come back
 * with the same index whichever face asks for it. Corners take the icosahedron's
 * own numbering, edge points are numbered along the edge from its lower-numbered
 * end, and each face's interior gets a private block after those.
 *
 * Row i runs from the A->B edge across to the A->C edge and holds i + 1 points,
 * so (0,0) is A, (n,0) is B and (n,n) is C.
 */
function latticeIndex(face, i, j, n, edgeId, edgeBase, faceBase) {
  const [a, b, c] = ICO_FACES[face];
  if (i === 0) return a;
  if (i === n && j === 0) return b;
  if (i === n && j === n) return c;

  // The three edges, each addressed from its lower-numbered end.
  if (j === 0) return edgePoint(a, b, i, n, edgeId, edgeBase);
  if (j === i) return edgePoint(a, c, i, n, edgeId, edgeBase);
  if (i === n) return edgePoint(b, c, j, n, edgeId, edgeBase);

  // Interior: rows 2..n-1, and row i holds i - 1 interior points.
  const before = ((i - 1) * (i - 2)) / 2;
  return faceBase + face * (((n - 1) * (n - 2)) / 2) + before + (j - 1);
}

/** Index of the point `k` steps along the edge u->v, out of n. */
function edgePoint(u, v, k, n, edgeId, edgeBase) {
  const lo = Math.min(u, v);
  const hi = Math.max(u, v);
  const id = edgeId.get(lo * 12 + hi);
  const step = u === lo ? k : n - k;
  return edgeBase + id * (n - 1) + (step - 1);
}

/**
 * Build the grid.
 *
 * Returns flat typed arrays rather than objects per cell: at this size the
 * difference is tens of megabytes, and the renderer wants them flat anyway.
 */
export function buildSphere(n = FREQUENCY) {
  const cellCount = 10 * n * n + 2;
  const triCount = 20 * n * n;

  const corners = ICO_VERTS.map(normalise);

  // Number the thirty edges once so both faces sharing one agree.
  const edgeId = new Map();
  for (const [a, b, c] of ICO_FACES) {
    for (const [u, v] of [[a, b], [b, c], [c, a]]) {
      const key = Math.min(u, v) * 12 + Math.max(u, v);
      if (!edgeId.has(key)) edgeId.set(key, edgeId.size);
    }
  }
  const edgeBase = 12;
  const faceBase = edgeBase + edgeId.size * (n - 1);

  const center = new Float64Array(cellCount * 3);
  const triangle = new Int32Array(triCount * 3);

  const left = new Float64Array(3);
  const right = new Float64Array(3);
  let tri = 0;

  for (let f = 0; f < ICO_FACES.length; f += 1) {
    const [ai, bi, ci] = ICO_FACES[f];
    const A = corners[ai];
    const B = corners[bi];
    const C = corners[ci];

    for (let i = 0; i <= n; i += 1) {
      // The ends of row i, then the row itself along the arc between them.
      if (i === 0) {
        center[ai * 3] = A[0];
        center[ai * 3 + 1] = A[1];
        center[ai * 3 + 2] = A[2];
      } else {
        slerp(A, B, i / n, left, 0);
        slerp(A, C, i / n, right, 0);
        for (let j = 0; j <= i; j += 1) {
          const idx = latticeIndex(f, i, j, n, edgeId, edgeBase, faceBase) * 3;
          if (j === 0) {
            center[idx] = left[0];
            center[idx + 1] = left[1];
            center[idx + 2] = left[2];
          } else if (j === i) {
            center[idx] = right[0];
            center[idx + 1] = right[1];
            center[idx + 2] = right[2];
          } else {
            slerp(left, right, j / i, center, idx);
          }
        }
      }
    }

    // Two triangles per lattice cell, wound to match the face.
    for (let i = 0; i < n; i += 1) {
      for (let j = 0; j <= i; j += 1) {
        triangle[tri * 3] = latticeIndex(f, i, j, n, edgeId, edgeBase, faceBase);
        triangle[tri * 3 + 1] = latticeIndex(f, i + 1, j, n, edgeId, edgeBase, faceBase);
        triangle[tri * 3 + 2] = latticeIndex(f, i + 1, j + 1, n, edgeId, edgeBase, faceBase);
        tri += 1;
        if (j < i) {
          triangle[tri * 3] = latticeIndex(f, i, j, n, edgeId, edgeBase, faceBase);
          triangle[tri * 3 + 1] = latticeIndex(f, i + 1, j + 1, n, edgeId, edgeBase, faceBase);
          triangle[tri * 3 + 2] = latticeIndex(f, i, j + 1, n, edgeId, edgeBase, faceBase);
          tri += 1;
        }
      }
    }
  }

  const cornerXYZ = triangleCentres(triangle, center, triCount);
  const { neighbour, cornerAt, valence } = buildDual(triangle, triCount, cellCount);
  const { lat, lon } = geographic(center, cellCount);

  return {
    frequency: n,
    count: cellCount,
    triangleCount: triCount,
    center,
    lat,
    lon,
    neighbour,
    valence,
    cornerAt,
    cornerXYZ,
    index: buildLookup(lat, lon, cellCount),
  };
}

/** Cell corners: the centre of each triangle, pushed back out to the sphere. */
function triangleCentres(triangle, center, triCount) {
  const out = new Float32Array(triCount * 3);
  for (let t = 0; t < triCount; t += 1) {
    const a = triangle[t * 3] * 3;
    const b = triangle[t * 3 + 1] * 3;
    const c = triangle[t * 3 + 2] * 3;
    const x = (center[a] + center[b] + center[c]) / 3;
    const y = (center[a + 1] + center[b + 1] + center[c + 1]) / 3;
    const z = (center[a + 2] + center[b + 2] + center[c + 2]) / 3;
    const d = Math.hypot(x, y, z);
    out[t * 3] = x / d;
    out[t * 3 + 1] = y / d;
    out[t * 3 + 2] = z / d;
  }
  return out;
}

/**
 * Turn the triangle mesh into cells.
 *
 * Every vertex becomes a cell whose corners are the centres of the triangles
 * around it. Walking those triangles in order matters: the corners have to come
 * out as a ring or the polygon is a scribble, and the neighbours have to come
 * out in the same order as the corners so edge N sits between corner N and
 * corner N+1. Each triangle (v, a, b) hands over to the one starting at b.
 */
function buildDual(triangle, triCount, cellCount) {
  // Incident triangles per vertex, as a flat compressed row structure.
  const start = new Int32Array(cellCount + 1);
  for (let t = 0; t < triCount * 3; t += 1) start[triangle[t] + 1] += 1;
  for (let v = 0; v < cellCount; v += 1) start[v + 1] += start[v];
  const fill = start.slice(0, cellCount);
  const incident = new Int32Array(triCount * 3);
  for (let t = 0; t < triCount; t += 1) {
    for (let k = 0; k < 3; k += 1) {
      const v = triangle[t * 3 + k];
      incident[fill[v]] = t * 3 + k; // triangle and which corner of it is v
      fill[v] += 1;
    }
  }

  const neighbour = new Int32Array(cellCount * 6).fill(-1);
  const cornerAt = new Int32Array(cellCount * 6).fill(-1);
  const valence = new Uint8Array(cellCount);

  // next.get(a) -> the triangle at which the ring continues past neighbour a.
  const next = new Map();
  for (let v = 0; v < cellCount; v += 1) {
    next.clear();
    const from = start[v];
    const to = start[v + 1];
    for (let s = from; s < to; s += 1) {
      const slot = incident[s];
      const t = (slot / 3) | 0;
      const k = slot % 3;
      const a = triangle[t * 3 + ((k + 1) % 3)];
      next.set(a, slot);
    }

    const degree = to - from;
    let slot = incident[from];
    for (let step = 0; step < degree; step += 1) {
      const t = (slot / 3) | 0;
      const k = slot % 3;
      const a = triangle[t * 3 + ((k + 1) % 3)];
      const b = triangle[t * 3 + ((k + 2) % 3)];
      neighbour[v * 6 + step] = a;
      cornerAt[v * 6 + step] = t;
      const nextSlot = next.get(b);
      if (nextSlot === undefined) break;
      slot = nextSlot;
    }
    valence[v] = degree;
  }
  return { neighbour, cornerAt, valence };
}

function geographic(center, cellCount) {
  const lat = new Float32Array(cellCount);
  const lon = new Float32Array(cellCount);
  const toDeg = 180 / Math.PI;
  for (let v = 0; v < cellCount; v += 1) {
    const x = center[v * 3];
    const y = center[v * 3 + 1];
    const z = center[v * 3 + 2];
    lat[v] = Math.asin(Math.min(1, Math.max(-1, y))) * toDeg;
    lon[v] = Math.atan2(x, z) * toDeg;
  }
  return { lat, lon };
}

// ---------------------------------------------------------------------------
// Finding the cell under a point.
//
// Cells are about 0.6 degrees across, so a one-degree bucket grid puts a
// handful in each bucket and the nearest cell to any point is always in the
// bucket or one of its eight neighbours. That turns a 114,000-way search into
// about a dozen dot products.
// ---------------------------------------------------------------------------

const BUCKET_LAT = 180;
const BUCKET_LON = 360;

function buildLookup(lat, lon, cellCount) {
  const cells = BUCKET_LAT * BUCKET_LON;
  const start = new Int32Array(cells + 1);
  const bucketOf = new Int32Array(cellCount);
  for (let v = 0; v < cellCount; v += 1) {
    const r = Math.min(BUCKET_LAT - 1, Math.floor(((90 - lat[v]) / 180) * BUCKET_LAT));
    const c = Math.min(BUCKET_LON - 1, Math.floor(((lon[v] + 180) / 360) * BUCKET_LON));
    const b = r * BUCKET_LON + c;
    bucketOf[v] = b;
    start[b + 1] += 1;
  }
  for (let b = 0; b < cells; b += 1) start[b + 1] += start[b];
  const fill = start.slice(0, cells);
  const items = new Int32Array(cellCount);
  for (let v = 0; v < cellCount; v += 1) {
    items[fill[bucketOf[v]]] = v;
    fill[bucketOf[v]] += 1;
  }
  return { start, items };
}

/** The cell containing a direction, given as a unit vector. */
export function cellAtVector(sphere, x, y, z) {
  const toDeg = 180 / Math.PI;
  const lat = Math.asin(Math.min(1, Math.max(-1, y))) * toDeg;
  const lon = Math.atan2(x, z) * toDeg;
  return cellAt(sphere, lat, lon, x, y, z);
}

/** The cell containing a latitude and longitude in degrees. */
export function cellAt(sphere, lat, lon, px, py, pz) {
  let x = px;
  let y = py;
  let z = pz;
  if (x === undefined) {
    const rlat = (lat * Math.PI) / 180;
    const rlon = (lon * Math.PI) / 180;
    const c = Math.cos(rlat);
    x = c * Math.sin(rlon);
    y = Math.sin(rlat);
    z = c * Math.cos(rlon);
  }

  const { start, items } = sphere.index;
  const r0 = Math.min(BUCKET_LAT - 1, Math.floor(((90 - lat) / 180) * BUCKET_LAT));
  const c0 = Math.min(BUCKET_LON - 1, Math.floor(((lon + 180) / 360) * BUCKET_LON));

  // A cell spans a fixed distance on the ground, but longitude buckets narrow
  // towards the poles: at 89.5N one is under a kilometre wide, so a single cell
  // straddles seventy of them. Widen the search in longitude to match.
  const cosLat = Math.max(0.02, Math.cos((lat * Math.PI) / 180));
  const latRing = 2;
  const lonRing = Math.min(BUCKET_LON / 2, Math.ceil(latRing / cosLat));

  let best = -1;
  let bestDot = -2;
  for (let dr = -latRing; dr <= latRing; dr += 1) {
    const r = r0 + dr;
    if (r < 0 || r >= BUCKET_LAT) continue;
    for (let dc = -lonRing; dc <= lonRing; dc += 1) {
      const c = (((c0 + dc) % BUCKET_LON) + BUCKET_LON) % BUCKET_LON;
      const b = r * BUCKET_LON + c;
      for (let s = start[b]; s < start[b + 1]; s += 1) {
        const v = items[s];
        const dot =
          sphere.center[v * 3] * x + sphere.center[v * 3 + 1] * y + sphere.center[v * 3 + 2] * z;
        if (dot > bestDot) {
          bestDot = dot;
          best = v;
        }
      }
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// The board itself.
//
// One grid, built once on first use and shared. Everything downstream indexes
// cells by a single integer, so the awkward (row, column) pairs the rectangular
// board needed are gone — and with them the wrapping, the seam and the two
// special cases at the poles.
// ---------------------------------------------------------------------------

let shared = null;

/** The grid. Built on first call, about a tenth of a second. */
export function grid() {
  if (shared === null) shared = buildSphere();
  return shared;
}

/** Latitude and longitude of a cell's centre, in degrees. */
export function geoCoords(cell) {
  const g = grid();
  return { lat: g.lat[cell], lon: g.lon[cell] };
}

/** The five or six cells sharing an edge with this one. */
export function neighbours(cell) {
  return neighboursOf(grid(), cell);
}

/** Neighbours of a cell, as a plain array. Pentagons return five. */
export function neighboursOf(sphere, cell) {
  const out = [];
  for (let k = 0; k < sphere.valence[cell]; k += 1) {
    const nb = sphere.neighbour[cell * 6 + k];
    if (nb >= 0) out.push(nb);
  }
  return out;
}

export function formatGeo(sphere, cell) {
  const lat = sphere.lat[cell];
  const lon = sphere.lon[cell];
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(1)}°${ns} ${Math.abs(lon).toFixed(1)}°${ew}`;
}
