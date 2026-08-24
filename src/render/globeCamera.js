// Where the viewer is standing.
//
// A flat board is looked at from above and slid about; a globe is turned. The
// camera therefore holds a point on the surface to face, and a distance to hold
// off at, rather than an x, y and zoom.
//
// Longitude wraps for free — there is no seam to cross and no wrapped copy of
// the world to pick between, which the flat renderer had to do on every draw.
// Latitude is clamped just short of the poles so the up vector never flips.

const DEG = Math.PI / 180;
const MIN_DISTANCE = 1.035; // just above the surface
const MAX_DISTANCE = 4.2; // the whole globe, with room around it
const MAX_LAT = 89.5;
const FOV = 42 * DEG;

/** Radians of arc a cell spans, for turning zoom into pixels per cell. */
function cellArc(sphere) {
  // 10n^2 + 2 cells over the whole sphere; a cell's radius in arc is roughly
  // the radius of a circle of that area.
  return Math.sqrt((4 * Math.PI) / sphere.count / Math.PI);
}

export class GlobeCamera {
  constructor(sphere) {
    this.sphere = sphere;
    this.lat = 25;
    this.lon = 10;
    this.distance = 3.2;
    this.arc = cellArc(sphere);
    this.spin = { lat: 0, lon: 0 };
  }

  clone() {
    return { lat: this.lat, lon: this.lon, distance: this.distance, arc: this.arc };
  }

  /**
   * Turn the globe.
   *
   * Dragging near the limb of a zoomed-out globe should move the surface as far
   * as dragging through the middle, so the amount of turn is scaled by how much
   * of the sphere the view actually covers, and by the cosine of the latitude
   * so east-west dragging keeps up near the poles.
   */
  rotateBy(dxFraction, dyFraction) {
    const reach = Math.min(1, this.distance - 1) * 110 + 12;
    const cos = Math.max(0.18, Math.cos(this.lat * DEG));
    this.lon = wrapLon(this.lon - (dxFraction * reach) / cos);
    this.lat = Math.max(-MAX_LAT, Math.min(MAX_LAT, this.lat + dyFraction * reach));
  }

  /** Move in or out. `factor` above 1 moves closer. */
  zoomBy(factor) {
    const height = Math.max(MIN_DISTANCE, Math.min(MAX_DISTANCE, 1 + (this.distance - 1) / factor));
    this.distance = height;
  }

  centerOn(lat, lon) {
    this.lat = Math.max(-MAX_LAT, Math.min(MAX_LAT, lat));
    this.lon = wrapLon(lon);
  }

  get altitude() {
    return (this.distance - 1) / (MAX_DISTANCE - 1);
  }

  /** How many pixels a cell covers vertically at the centre of the view. */
  pixelsPerCell(viewportHeight) {
    // Half the viewport spans this much arc at the sub-viewer point.
    const halfWorld = Math.tan(FOV / 2) * (this.distance - 1);
    return (this.arc / halfWorld) * (viewportHeight / 2);
  }

  /**
   * Model-view-projection, and the rotation on its own for lighting.
   *
   * The model rotation brings the faced point round to meet the viewer:
   * spin west by the longitude, then tilt down by the latitude.
   */
  matrices(mvp, rot, aspect) {
    const cl = Math.cos(-this.lon * DEG);
    const sl = Math.sin(-this.lon * DEG);
    const cp = Math.cos(this.lat * DEG);
    const sp = Math.sin(this.lat * DEG);

    // Rx(lat) * Ry(-lon), column-major.
    const r = rot;
    r[0] = cl;      r[3] = 0;    r[6] = sl;
    r[1] = sp * sl; r[4] = cp;   r[7] = -sp * cl;
    r[2] = -cp * sl; r[5] = sp;  r[8] = cp * cl;

    const f = 1 / Math.tan(FOV / 2);
    // Fit the depth range to what is actually visible: the nearest ground is
    // directly below at distance - 1, the furthest is the horizon at
    // sqrt(distance^2 - 1). Pinning the near plane near zero instead costs all
    // the depth precision at the surface, and the cell edges — lifted only a
    // thousandth of a radius clear of it — stop passing the depth test.
    const near = Math.max(0.002, (this.distance - 1) * 0.5);
    const far = Math.sqrt(Math.max(0.01, this.distance * this.distance - 1)) * 1.05 + near;
    const nf = 1 / (near - far);

    // proj * translate(0, 0, -distance) * rot, written out rather than
    // multiplied: it is three known matrices and this runs every frame.
    const px = f / aspect;
    const py = f;
    const pz = (far + near) * nf;
    const pw = 2 * far * near * nf;

    mvp[0] = px * r[0];
    mvp[1] = py * r[1];
    mvp[2] = pz * r[2];
    mvp[3] = -r[2];

    mvp[4] = px * r[3];
    mvp[5] = py * r[4];
    mvp[6] = pz * r[5];
    mvp[7] = -r[5];

    mvp[8] = px * r[6];
    mvp[9] = py * r[7];
    mvp[10] = pz * r[8];
    mvp[11] = -r[8];

    mvp[12] = 0;
    mvp[13] = 0;
    mvp[14] = pz * -this.distance + pw;
    mvp[15] = this.distance;
    return mvp;
  }

  /** A ray from the eye through a point on the canvas, in eye space. */
  rayThrough(screenX, screenY, width, height) {
    const t = Math.tan(FOV / 2);
    const nx = (2 * screenX) / width - 1;
    const ny = 1 - (2 * screenY) / height;
    const x = nx * t * (width / height);
    const y = ny * t;
    const len = Math.hypot(x, y, 1);
    return [x / len, y / len, -1 / len];
  }

  /**
   * Where a ray from the eye meets the globe, in the world's own coordinates.
   *
   * The eye sits at the origin looking down -Z with the sphere's centre at
   * -distance, so this is the near root of a quadratic; a miss returns null,
   * which is how clicking the space around the globe deselects.
   */
  hitSphere(dir) {
    const cz = -this.distance;
    const b = dir[2] * cz;
    const disc = b * b - (cz * cz - 1);
    if (disc < 0) return null;
    const t = b - Math.sqrt(disc);
    if (t <= 0) return null;
    // The hit in eye space, then undone by the model rotation.
    return this.toModel(dir[0] * t, dir[1] * t, dir[2] * t + this.distance);
  }

  /** Eye space back to the world's own coordinates: the transpose of the rotation. */
  toModel(x, y, z) {
    const cl = Math.cos(-this.lon * DEG);
    const sl = Math.sin(-this.lon * DEG);
    const cp = Math.cos(this.lat * DEG);
    const sp = Math.sin(this.lat * DEG);
    return [
      cl * x + sp * sl * y - cp * sl * z,
      cp * y + sp * z,
      sl * x - sp * cl * y + cp * cl * z,
    ];
  }

  /**
   * Where a point on the surface lands on the canvas.
   *
   * `visible` is false for anything round the back: a point is over the horizon
   * once it tips past where the tangent from the eye touches, which for a unit
   * sphere is exactly where its rotated depth falls below 1 / distance.
   */
  project(lat, lon, width, height, out) {
    const rlat = lat * DEG;
    const rlon = lon * DEG;
    const c = Math.cos(rlat);
    const x = c * Math.sin(rlon);
    const y = Math.sin(rlat);
    const z = c * Math.cos(rlon);

    const cl = Math.cos(-this.lon * DEG);
    const sl = Math.sin(-this.lon * DEG);
    const cp = Math.cos(this.lat * DEG);
    const sp = Math.sin(this.lat * DEG);

    const ex = cl * x + sl * z;
    const ey = sp * sl * x + cp * y - sp * cl * z;
    const ez = -cp * sl * x + sp * y + cp * cl * z;

    out.visible = ez > 1 / this.distance;
    const depth = this.distance - ez;
    const t = Math.tan(FOV / 2);
    out.x = ((ex / (depth * t * (width / height))) * 0.5 + 0.5) * width;
    out.y = (0.5 - (ey / (depth * t)) * 0.5) * height;
    return out;
  }
}

function wrapLon(lon) {
  let l = lon;
  while (l > 180) l -= 360;
  while (l < -180) l += 360;
  return l;
}

export { MIN_DISTANCE, MAX_DISTANCE };
