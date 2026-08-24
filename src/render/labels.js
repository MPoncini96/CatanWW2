import { NEUTRAL } from '../world/nations.js';

// Country names, written across the ground they cover.
//
// On the globe a name has one extra way to be wrong: it can be on the far side.
// The camera reports that directly, so a country turns its name off as it goes
// over the horizon rather than sliding it across the limb. Names also shrink
// towards the edge, where the surface is steeply foreshortened.

const LABEL = 'rgba(255, 252, 244, 0.94)';
const SHADOW = 'rgba(0, 0, 0, 0.8)';

/**
 * How large to write a country's name, or zero to leave it out.
 *
 * Size follows how much of the screen the country's main block covers, so the
 * Soviet Union reads at a glance while Luxembourg has to be zoomed into.
 */
function fontFor(country, pixelsPerCell, facing) {
  const span = Math.sqrt(country.blockHexes ?? 1) * pixelsPerCell;
  if (span < 44) return 0;
  // Nothing is written flat-on at the limb, where it would be unreadable.
  if (facing < 0.32) return 0;
  return Math.max(9, Math.min(22, span * 0.15)) * (0.6 + 0.4 * facing);
}

/**
 * @returns {Array} the screen boxes the names took, so the city pass can keep
 * clear of them.
 */
export function drawCountryLabels(ctx, world, camera, width, height) {
  const countries = world.countries;
  if (!countries) return [];

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';

  const pixelsPerCell = camera.pixelsPerCell(width, height);
  const radius = discRadius(camera, width, height);
  // Largest first, so when two names collide the bigger country keeps its own.
  const order = countries
    .filter((c) => c.labelCell !== undefined && c.hexes > 0)
    .sort((a, b) => (b.blockHexes ?? 0) - (a.blockHexes ?? 0));

  const out = {};
  const taken = [];
  for (const country of order) {
    camera.project(country.labelLat, country.labelLon, width, height, out);
    if (!out.visible) continue;

    const facing = facingAt(out, radius, width, height);
    const size = fontFor(country, pixelsPerCell, facing);
    if (size <= 0) continue;
    if (out.x < -120 || out.x > width + 120 || out.y < -20 || out.y > height + 20) continue;

    ctx.font = `600 ${size}px 'Inter', 'Segoe UI', system-ui, sans-serif`;
    const w = ctx.measureText(country.name).width;
    const box = {
      left: out.x - w / 2 - 3,
      right: out.x + w / 2 + 3,
      top: out.y - size * 0.7,
      bottom: out.y + size * 0.7,
    };
    if (overlapsAny(box, taken)) continue;
    taken.push(box);

    ctx.lineWidth = Math.max(2.5, size * 0.28);
    ctx.strokeStyle = SHADOW;
    ctx.strokeText(country.name, out.x, out.y);
    ctx.fillStyle = country.power === NEUTRAL ? 'rgba(255, 252, 244, 0.8)' : LABEL;
    ctx.fillText(country.name, out.x, out.y);
  }

  ctx.restore();
  return taken;
}

/**
 * How square-on the surface is at a projected point: 1 facing the viewer, 0 at
 * the limb. Distance out from the centre of the globe's disc stands in for the
 * angle, which is exact for a sphere.
 */
export function facingAt(point, radius, width, height) {
  if (radius <= 0) return 1;
  const d = Math.hypot(point.x - width / 2, point.y - height / 2) / radius;
  return Math.sqrt(Math.max(0, 1 - Math.min(1, d) ** 2));
}

/** How wide the globe is on screen, measured through the projection itself. */
export function discRadius(camera, width, height) {
  const out = {};
  const horizon = (Math.acos(1 / camera.distance) * 180) / Math.PI;
  camera.project(camera.lat, camera.lon, width, height, out);
  const cx = out.x;
  const cy = out.y;
  const lat = camera.lat + horizon * 0.98;
  const flip = lat > 89.9 ? -1 : 1;
  camera.project(camera.lat + flip * horizon * 0.98, camera.lon, width, height, out);
  return Math.hypot(out.x - cx, out.y - cy) / 0.98;
}

export function overlapsAny(box, taken) {
  return taken.some(
    (t) => box.left < t.right && box.right > t.left && box.top < t.bottom && box.bottom > t.top,
  );
}
