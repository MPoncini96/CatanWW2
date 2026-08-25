import { cellAt, neighbours } from '../world/sphere.js';
import { UNITS } from '../world/forces.js';
import { SHIPS } from '../world/navies.js';
import { SEA } from '../world/nations.js';
import { visibilityFor } from '../world/intel.js';
import { facingAt, discRadius } from './labels.js';

// What is actually standing on a hex, once a hex is big enough to draw it on.
//
// Zoomed out, a garrison is a brightness: the whole globe at once, and one
// number per cell is all the room there is. Zoomed in past about thirty pixels
// a cell there is room for the thing itself, and a shape says what a shade
// cannot — that this hex holds infantry and a tank squadron and one bomber
// group, not merely "a lot".
//
// The ground symbols are the NATO ones, near enough: a box with an X is
// infantry, a box with an oval is armour, a box with a dot is artillery. They
// were designed to be told apart at a glance in bad light on a paper map, which
// is the same problem this has. Aircraft and ships get silhouettes, because
// nobody reads a box with a wing in it as an aeroplane.

/** Below this many pixels per cell there is no room, and the shading says it. */
const MIN_PIXELS = 30;

/** Combat weight, matching the strength score the shading uses. */
const WEIGHT = { infantry: 1, tanks: 30, artillery: 15, fighters: 60, bombers: 90 };

function box(ctx, x, y, s) {
  ctx.beginPath();
  ctx.rect(x - s * 0.7, y - s * 0.45, s * 1.4, s * 0.9);
}

/**
 * Infantry: a helmet, seen from the front.
 *
 * The NATO box with an X in it is what a staff officer draws, and it needs a
 * legend to read. A helmet needs nothing: it is the one shape on a battlefield
 * that means a man is under it.
 */
function infantry(ctx, x, y, s) {
  ctx.beginPath();
  // The dome, and the brim it sits in.
  ctx.ellipse(x, y + s * 0.06, s * 0.52, s * 0.46, 0, Math.PI, Math.PI * 2);
  ctx.lineTo(x + s * 0.66, y + s * 0.12);
  ctx.quadraticCurveTo(x, y + s * 0.4, x - s * 0.66, y + s * 0.12);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // The rivet line where the brim is riveted to the shell.
  ctx.beginPath();
  ctx.moveTo(x - s * 0.5, y + s * 0.08);
  ctx.lineTo(x + s * 0.5, y + s * 0.08);
  ctx.stroke();
}

/** Armour: the box with a track oval inside it. */
function armour(ctx, x, y, s) {
  box(ctx, x, y, s);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(x, y, s * 0.45, s * 0.26, 0, 0, Math.PI * 2);
  ctx.stroke();
}

/** Artillery: the box with a round shot in it. */
function artillery(ctx, x, y, s) {
  box(ctx, x, y, s);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, s * 0.2, 0, Math.PI * 2);
  ctx.fillStyle = ctx.strokeStyle;
  ctx.fill();
}

/** A fighter from above: one engine, short wings, small tailplane. */
function fighter(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y - s * 0.6);
  ctx.lineTo(x + s * 0.14, y - s * 0.12);
  ctx.lineTo(x + s * 0.66, y + s * 0.16);
  ctx.lineTo(x + s * 0.66, y + s * 0.3);
  ctx.lineTo(x + s * 0.12, y + s * 0.22);
  ctx.lineTo(x + s * 0.3, y + s * 0.58);
  ctx.lineTo(x, y + s * 0.48);
  ctx.lineTo(x - s * 0.3, y + s * 0.58);
  ctx.lineTo(x - s * 0.12, y + s * 0.22);
  ctx.lineTo(x - s * 0.66, y + s * 0.3);
  ctx.lineTo(x - s * 0.66, y + s * 0.16);
  ctx.lineTo(x - s * 0.14, y - s * 0.12);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

/**
 * A bomber: bigger than a fighter, with a longer wing and two engines on it.
 *
 * Size alone would be ambiguous — a fighter close to the camera and a bomber
 * far from it — so the nacelles carry the difference as well.
 */
function bomber(ctx, x, y, s) {
  const b = s * 1.3;
  ctx.beginPath();
  ctx.moveTo(x, y - b * 0.62);
  ctx.lineTo(x + b * 0.15, y - b * 0.3);
  ctx.lineTo(x + b * 0.92, y - b * 0.02);
  ctx.lineTo(x + b * 0.92, y + b * 0.14);
  ctx.lineTo(x + b * 0.14, y + b * 0.2);
  ctx.lineTo(x + b * 0.4, y + b * 0.6);
  ctx.lineTo(x, y + b * 0.5);
  ctx.lineTo(x - b * 0.4, y + b * 0.6);
  ctx.lineTo(x - b * 0.14, y + b * 0.2);
  ctx.lineTo(x - b * 0.92, y + b * 0.14);
  ctx.lineTo(x - b * 0.92, y - b * 0.02);
  ctx.lineTo(x - b * 0.15, y - b * 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.rect(x + side * b * 0.5 - b * 0.08, y - b * 0.16, b * 0.16, b * 0.26);
    ctx.fill();
    ctx.stroke();
  }
}

/**
 * A battleship: long hull, two turrets fore and aft, a tripod mast.
 *
 * The three gun ships were told apart at sea by their silhouettes, which is
 * exactly what recognition manuals were for, so they are told apart here the
 * same way rather than by one shape in three sizes.
 */
function battleship(ctx, x, y, s) {
  const l = s * 0.95;
  ctx.beginPath();
  ctx.moveTo(x - l, y + s * 0.08);
  ctx.lineTo(x + l, y + s * 0.08);
  ctx.lineTo(x + l * 0.7, y + s * 0.42);
  ctx.lineTo(x - l * 0.78, y + s * 0.42);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Turrets fore and aft, and the bridge between them.
  for (const at of [-0.55, 0.5]) {
    ctx.beginPath();
    ctx.rect(x + l * at - s * 0.14, y - s * 0.1, s * 0.28, s * 0.18);
    ctx.fill();
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.rect(x - s * 0.16, y - s * 0.34, s * 0.32, s * 0.42);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x, y - s * 0.34);
  ctx.lineTo(x, y - s * 0.62);
  ctx.stroke();
}

/** A cruiser: shorter, one funnel, no turret ends. */
function cruiser(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x - s * 0.78, y + s * 0.1);
  ctx.lineTo(x + s * 0.82, y + s * 0.1);
  ctx.lineTo(x + s * 0.5, y + s * 0.4);
  ctx.lineTo(x - s * 0.6, y + s * 0.4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.rect(x - s * 0.18, y - s * 0.24, s * 0.3, s * 0.34);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + s * 0.24, y + s * 0.1);
  ctx.lineTo(x + s * 0.24, y - s * 0.2);
  ctx.stroke();
}

/** A destroyer: small, low, and all bow wave. */
function destroyer(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x - s * 0.6, y + s * 0.14);
  ctx.lineTo(x + s * 0.72, y + s * 0.06);
  ctx.lineTo(x + s * 0.42, y + s * 0.36);
  ctx.lineTo(x - s * 0.5, y + s * 0.36);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.rect(x - s * 0.1, y - s * 0.12, s * 0.2, s * 0.22);
  ctx.fill();
  ctx.stroke();
}

/** A carrier: a flat deck, an island to starboard, an aeroplane on it. */
function carrier(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x - s * 0.95, y + s * 0.02);
  ctx.lineTo(x + s * 0.95, y + s * 0.02);
  ctx.lineTo(x + s * 0.62, y + s * 0.38);
  ctx.lineTo(x - s * 0.7, y + s * 0.38);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.rect(x + s * 0.12, y - s * 0.26, s * 0.2, s * 0.28);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - s * 0.58, y - s * 0.16);
  ctx.lineTo(x - s * 0.16, y - s * 0.16);
  ctx.moveTo(x - s * 0.37, y - s * 0.36);
  ctx.lineTo(x - s * 0.37, y + s * 0.0);
  ctx.stroke();
}

/** A submarine: long hull, conning tower, periscope. */
function submarine(ctx, x, y, s) {
  ctx.beginPath();
  ctx.ellipse(x, y + s * 0.22, s * 0.8, s * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.rect(x - s * 0.13, y - s * 0.14, s * 0.28, s * 0.3);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + s * 0.01, y - s * 0.14);
  ctx.lineTo(x + s * 0.01, y - s * 0.46);
  ctx.stroke();
}

const GROUND = {
  infantry,
  tanks: armour,
  artillery,
  fighters: fighter,
  bombers: bomber,
};

const NAVAL = {
  battleships: battleship,
  carriers: carrier,
  cruisers: cruiser,
  destroyers: destroyer,
  submarines: submarine,
};

/** Icon size at this zoom, and whether there is room to number them. */
function sizing(pixelsPerCell) {
  const size = Math.max(7, Math.min(30, pixelsPerCell * 0.2));
  return { size, spread: pixelsPerCell * 0.34, labels: size >= 13 };
}

/**
 * Where within a cell a symbol sits.
 *
 * A row of symbols reads as a legend — a list of what is here. Scattered, it
 * reads as men and machines standing on ground, which is what it is. The
 * scatter has to be the same every frame or the map would crawl, so it comes
 * out of the cell number and the symbol's place in the list rather than out of
 * a random number generator: same cell, same arm, same spot, for ever.
 */
function scatterAt(cell, k, count, spread) {
  if (count === 1) return { dx: 0, dy: 0 };
  const hash = Math.imul(cell ^ Math.imul(k + 1, 0x9e3779b9), 2246822519) >>> 0;
  const wobble = ((hash & 0xffff) / 0xffff - 0.5) * 1.1;
  const reach = 0.42 + 0.58 * (((hash >>> 16) & 0xffff) / 0xffff);
  const angle = (k / count) * Math.PI * 2 + wobble;
  return {
    dx: Math.cos(angle) * spread * reach,
    // Cells are wider than they are tall on screen, so the scatter is too.
    dy: Math.sin(angle) * spread * reach * 0.78,
  };
}

/** Draw a cell's symbols, scattered over it, numbered if there is room. */
function drawScattered(ctx, entries, x, y, cell, size, spread, labels) {
  entries.forEach((entry, k) => {
    const { dx, dy } = scatterAt(cell, k, entries.length, spread);
    const cx = x + dx;
    const cy = y + dy;
    ctx.lineWidth = Math.max(0.8, size * 0.07);
    ctx.strokeStyle = 'rgba(6, 10, 16, 0.9)';
    ctx.fillStyle = entry.color;
    entry.draw(ctx, cx, cy, size);
    if (!labels) return;
    ctx.font = `600 ${Math.round(size * 0.58)}px 'Inter', 'Segoe UI', system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const text = entry.count >= 10000 ? `${Math.round(entry.count / 1000)}k` : String(entry.count);
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.strokeText(text, cx, cy + size * 0.6);
    ctx.fillStyle = '#eef4fb';
    ctx.fillText(text, cx, cy + size * 0.6);
  });
}

/**
 * Symbols for everything standing within sight of the middle of the view.
 *
 * Only the cells near the camera are considered: at this zoom the screen holds
 * a few hundred of them, and walking all 114,492 to find out which ones are on
 * screen would cost more than drawing them.
 */
export function drawUnitIcons(ctx, world, camera, width, height, viewer) {
  const pixelsPerCell = camera.pixelsPerCell(width, height);
  if (pixelsPerCell < MIN_PIXELS || !world.forces) return;

  const { size, spread, labels } = sizing(pixelsPerCell);
  const sphere = world.sphere;
  const owner = world.ownership.owner;
  const visible = viewer ? visibilityFor(world, viewer) : null;
  const radius = discRadius(camera, width, height);

  // Everything within reach of the middle of the screen, and no further.
  const reach = Math.ceil(Math.max(width, height) / pixelsPerCell / 1.6) + 2;
  const start = cellAt(sphere, camera.lat, camera.lon);
  const seen = new Set([start]);
  let frontier = [start];
  const cells = [start];
  for (let depth = 0; depth < reach; depth += 1) {
    const next = [];
    for (const cell of frontier) {
      for (const j of neighbours(cell)) {
        if (seen.has(j)) continue;
        seen.add(j);
        next.push(j);
        cells.push(j);
      }
    }
    frontier = next;
  }

  ctx.save();
  ctx.lineJoin = 'round';
  const out = {};

  for (const cell of cells) {
    const nation = owner[cell];
    if (nation === SEA) continue;
    if (visible && !visible[cell]) continue;

    // Everything on the cell, not a selection of it. The heaviest arm is
    // placed first so the scatter puts it nearest the middle, but nothing is
    // dropped: a hex with one bomber on it should show the bomber.
    const present = UNITS.map((unit, u) => ({
      unit,
      count: world.forces[u][cell],
      weight: world.forces[u][cell] * (WEIGHT[unit.id] ?? 1),
    }))
      .filter((entry) => entry.count > 0)
      .sort((a, b) => b.weight - a.weight)
      .map((entry) => ({ count: entry.count, color: entry.unit.color, draw: GROUND[entry.unit.id] }));
    if (!present.length) continue;

    camera.project(sphere.lat[cell], sphere.lon[cell], width, height, out);
    if (!out.visible) continue;
    if (out.x < -60 || out.x > width + 60 || out.y < -60 || out.y > height + 60) continue;
    const facing = facingAt(out, radius, width, height);
    if (facing < 0.35) continue;
    ctx.globalAlpha = Math.min(1, (facing - 0.35) * 4);

    drawScattered(ctx, present, out.x, out.y, cell, size, spread, labels);
  }

  ctx.globalAlpha = 1;
  ctx.restore();
}

/**
 * A fleet's own symbols, for when the diamond has room to become the ships.
 *
 * @returns {boolean} whether it drew anything, so the caller can fall back
 */
export function drawFleetIcons(ctx, station, x, y, pixelsPerCell) {
  if (pixelsPerCell < MIN_PIXELS) return false;
  const { size, spread, labels } = sizing(pixelsPerCell);
  // Every type moored here, in the order the types are listed, which is
  // heaviest first: the battleship lands nearest the middle of the anchorage.
  const present = SHIPS.map((ship) => ({ ship, count: station.ships[ship.id] }))
    .filter((entry) => entry.count > 0)
    .map((entry) => ({ count: entry.count, color: entry.ship.color, draw: NAVAL[entry.ship.id] }));
  if (!present.length) return false;
  drawScattered(ctx, present, x, y, station.cell, size, spread, labels);
  return true;
}
