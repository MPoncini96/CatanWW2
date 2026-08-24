import { facingAt, discRadius, overlapsAny } from './labels.js';

// Cities, drawn over the globe rather than into it.
//
// The surface lives on the GPU and never changes; dots and names are text and
// small shapes, which is exactly what a 2D canvas is good at. Both are placed
// from the same camera, so they stay pinned to their ground as the globe turns.

const DOT_FILL = '#ffe6a8';
const DOT_EDGE = 'rgba(40, 24, 8, 0.85)';
const LABEL = '#fff4d9';
const LABEL_SHADOW = 'rgba(0, 0, 0, 0.85)';

/**
 * Dot radius in pixels. Area tracks population — radius goes as the square root
 * — so a 4M city covers twice the ink of a 2M one rather than four times it.
 */
function radiusFor(population, pixelsPerCell) {
  const relative = Math.sqrt(population / 1e6); // 1.0 at a million, 2.9 at London
  return Math.max(1.2, Math.min(20, (1.2 + pixelsPerCell * 0.09) * relative));
}

/**
 * The smallest city worth drawing at this zoom. Zoomed out, only the giants
 * appear; zoomed in, everything does — so the globe never turns into confetti.
 */
function minPopulationFor(pixelsPerCell) {
  if (pixelsPerCell < 3) return 3e6;
  if (pixelsPerCell < 6) return 1.2e6;
  if (pixelsPerCell < 11) return 500e3;
  if (pixelsPerCell < 20) return 200e3;
  return 0;
}

export function drawCityMarkers(ctx, world, camera, width, height, taken = []) {
  const cities = world.cities;
  if (!cities || !cities.length) return;

  const pixelsPerCell = camera.pixelsPerCell(width, height);
  const minPop = minPopulationFor(pixelsPerCell);
  const showLabels = pixelsPerCell > 5;
  const fontSize = Math.max(10, Math.min(15, 8 + pixelsPerCell * 0.16));
  const radius = discRadius(camera, width, height);

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.font = `600 ${fontSize}px 'Inter', 'Segoe UI', system-ui, sans-serif`;

  // Largest first: when two names collide the bigger city keeps its own.
  const order = cities
    .filter((c) => c.population >= minPop)
    .sort((a, b) => b.population - a.population);

  const out = {};
  const placed = taken.slice();
  for (const city of order) {
    camera.project(city.lat, city.lon, width, height, out);
    if (!out.visible) continue;
    if (out.x < -40 || out.x > width + 40 || out.y < -40 || out.y > height + 40) continue;

    // Fade a city out as it goes over the limb rather than snapping it off.
    const facing = facingAt(out, radius, width, height);
    if (facing < 0.12) continue;
    ctx.globalAlpha = Math.min(1, facing * 2.4);

    const r = radiusFor(city.population, pixelsPerCell);
    ctx.beginPath();
    ctx.arc(out.x, out.y, r, 0, Math.PI * 2);
    ctx.fillStyle = DOT_FILL;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = DOT_EDGE;
    ctx.stroke();

    if (!showLabels || facing < 0.4) continue;
    const w = ctx.measureText(city.name).width;
    const ty = out.y - r - 3;
    const box = {
      left: out.x - w / 2 - 2,
      right: out.x + w / 2 + 2,
      top: ty - fontSize,
      bottom: ty + 2,
    };
    if (overlapsAny(box, placed)) continue;
    placed.push(box);

    ctx.lineWidth = 3;
    ctx.strokeStyle = LABEL_SHADOW;
    ctx.strokeText(city.name, out.x, ty);
    ctx.fillStyle = LABEL;
    ctx.fillText(city.name, out.x, ty);
  }

  ctx.globalAlpha = 1;
  ctx.restore();
}
