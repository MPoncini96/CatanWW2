import { grid } from '../world/sphere.js';

// The hex you have clicked.
//
// The view has kept a `selected` cell since the day the dossier was built and
// has never once drawn it. Everything below the map told you what you had
// picked — the place name, the ground, the garrison — and the map itself said
// nothing at all, so on a board of 114,492 cells the one you were reading about
// was wherever you happened to remember clicking.
//
// The outline is the cell's own, not a hexagon drawn near it. A Goldberg
// polyhedron has twelve pentagons and every hex is a slightly different shape
// from its neighbours, so an idealised hexagon laid over the top would sit at
// the wrong angle everywhere and be visibly wrong at the poles. The corners are
// in the sphere already, because the WebGL globe draws every cell from them.

const GOLD = 'rgba(240, 205, 120, 1)';
const GLOW = 'rgba(240, 190, 90, 0.55)';
const SHADE = 'rgba(255, 214, 130, 0.1)';

const toDeg = 180 / Math.PI;

/**
 * Draw the selected cell's border.
 *
 * Three passes: a wide soft stroke for the glow, a narrow bright one for the
 * edge, and a faint wash inside so the cell reads as picked when it is small.
 * At a distance the glow is most of what survives, which is what makes it
 * findable when the whole of Europe is forty pixels across.
 */
export function drawSelection(ctx, camera, width, height, cell) {
  if (cell === undefined || cell === null || cell < 0) return;
  const sphere = grid();
  const sides = sphere.valence[cell];
  if (!sides) return;

  const out = {};
  const points = [];
  for (let k = 0; k < sides; k += 1) {
    const c = sphere.cornerAt[cell * 6 + k] * 3;
    const x = sphere.cornerXYZ[c];
    const y = sphere.cornerXYZ[c + 1];
    const z = sphere.cornerXYZ[c + 2];
    // The same convention the picker uses to turn a point back into a cell.
    camera.project(Math.asin(Math.max(-1, Math.min(1, y))) * toDeg, Math.atan2(x, z) * toDeg, width, height, out);
    // A cell on the far limb has corners that are round the back. Drawing the
    // ones that are visible and closing the path would cut a chord across the
    // globe, so the whole outline goes rather than half of it.
    if (!out.visible) return;
    points.push(out.x, out.y);
  }

  // Wrapped round the seam: a cell straddling the antimeridian projects to
  // corners at both edges of the screen and would draw a band across it.
  let minX = Infinity;
  let maxX = -Infinity;
  for (let i = 0; i < points.length; i += 2) {
    if (points[i] < minX) minX = points[i];
    if (points[i] > maxX) maxX = points[i];
  }
  if (maxX - minX > width * 0.5) return;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1]);
  ctx.closePath();

  ctx.fillStyle = SHADE;
  ctx.fill();

  ctx.lineJoin = 'round';
  ctx.strokeStyle = GLOW;
  ctx.lineWidth = 6;
  ctx.stroke();

  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.restore();
}
