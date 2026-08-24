import { NATIONS, NATION_INDEX } from '../world/nations.js';
import { canSeeForces } from '../world/intel.js';
import { facingAt, discRadius, overlapsAny } from './labels.js';
import { drawFleetIcons } from './units.js';

// Fleets, drawn on the water.
//
// An army is spread over the ground its nation owns and can be shaded into the
// map itself. A navy cannot: it is a few dozen ships in a handful of
// anchorages, and colouring a sea cell for it would say that the fleet owns the
// ocean, which is the one thing a fleet does not do. So a fleet is a marker —
// a diamond, told apart from the round city dots at a glance.
//
// What the fog hides here is the count, not the anchorage. Everyone knew the
// Home Fleet lay at Scapa and the Regia Marina at Taranto; nobody outside the
// Admiralty knew exactly what was moored there on a given morning. So a foreign
// station is drawn hollow and at a fixed size, and one you may count is filled
// and sized by what is in it.

const EDGE = 'rgba(6, 12, 20, 0.9)';
const LABEL = '#e8f2ff';
const LABEL_SHADOW = 'rgba(0, 0, 0, 0.85)';

/** Marker radius. Area tracks hulls, so twenty ships is not twice ten. */
function radiusFor(hulls, pixelsPerCell) {
  const relative = Math.sqrt(Math.max(1, hulls) / 40);
  return Math.max(2.5, Math.min(22, (2.6 + pixelsPerCell * 0.16) * relative));
}

function diamond(ctx, x, y, r) {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r * 0.72, y);
  ctx.lineTo(x, y + r);
  ctx.lineTo(x - r * 0.72, y);
  ctx.closePath();
}

export function drawFleetMarkers(ctx, world, camera, width, height, viewer, taken = []) {
  const navies = world.navies;
  if (!navies || !navies.stations.length) return;

  const pixelsPerCell = camera.pixelsPerCell(width, height);
  const showLabels = pixelsPerCell > 4;
  const fontSize = Math.max(9, Math.min(14, 7.5 + pixelsPerCell * 0.15));
  const radius = discRadius(camera, width, height);

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.font = `600 ${fontSize}px 'Inter', 'Segoe UI', system-ui, sans-serif`;

  // Biggest first, so a crowded sea keeps the fleet that matters.
  const order = navies.stations.slice().sort((a, b) => b.hulls - a.hulls);
  const out = {};
  const placed = taken.slice();

  for (const station of order) {
    const known = canSeeForces(viewer, NATION_INDEX[station.power]);
    // A commerce raider already at sea is nobody else's to see.
    if (station.secret && !known) continue;
    camera.project(station.lat, station.lon, width, height, out);
    if (!out.visible) continue;
    if (out.x < -40 || out.x > width + 40 || out.y < -40 || out.y > height + 40) continue;

    const facing = facingAt(out, radius, width, height);
    if (facing < 0.12) continue;
    ctx.globalAlpha = Math.min(1, facing * 2.4);

    const color = NATIONS[NATION_INDEX[station.power]].color;
    const r = known ? radiusFor(station.hulls, pixelsPerCell) : Math.max(3, 2.6 + pixelsPerCell * 0.12);

    // Close in there is room for the ships themselves — but only for a fleet
    // this seat may count. A strength you are not allowed to know does not get
    // drawn in silhouette; it stays a diamond.
    const drewShips = known && drawFleetIcons(ctx, station, out.x, out.y, pixelsPerCell);
    if (!drewShips) {
      diamond(ctx, out.x, out.y, r);
      if (known) {
        ctx.fillStyle = color;
        ctx.fill();
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = EDGE;
        ctx.stroke();
      } else {
        // A base you know about and cannot count: the outline only.
        ctx.lineWidth = 1.6;
        ctx.strokeStyle = color;
        ctx.stroke();
      }
    }

    if (!showLabels || facing < 0.4) continue;
    const text = known ? `${station.name} · ${station.hulls}` : station.name;
    ctx.font = `600 ${fontSize}px 'Inter', 'Segoe UI', system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const w = ctx.measureText(text).width;
    const ty = out.y + (drewShips ? pixelsPerCell * 0.42 : r) + 2;
    const box = { left: out.x - w / 2 - 2, right: out.x + w / 2 + 2, top: ty - 2, bottom: ty + fontSize };
    if (overlapsAny(box, placed)) continue;
    placed.push(box);

    ctx.lineWidth = 3;
    ctx.strokeStyle = LABEL_SHADOW;
    ctx.strokeText(text, out.x, ty);
    ctx.fillStyle = LABEL;
    ctx.fillText(text, out.x, ty);
  }

  ctx.globalAlpha = 1;
  ctx.restore();
}
