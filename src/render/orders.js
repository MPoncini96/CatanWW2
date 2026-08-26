import { grid } from '../world/sphere.js';

// The orders you have given, drawn on the ground they concern.
//
// You ticked columns in a panel, pressed send, and the globe showed nothing.
// So there was no way to look at your own plan — not to check it, and
// certainly not to remember it an hour later. A day's orders are the one thing
// on this board that exists only in the player's head, and that is the wrong
// place for it.
//
// An arrow from where a column stands to where it is going, and a ring on any
// hex expecting men from the depots. Both are drawn only for the seat that
// gave them: an order is a secret until the day turns, and this is the one
// layer that is genuinely private rather than merely presented that way.

const MARCH = 'rgba(230, 201, 138, 0.9)';
const MARCH_DARK = 'rgba(20, 14, 6, 0.55)';
const REBUILD = 'rgba(122, 186, 142, 0.85)';

/** Least zoom at which an arrow is longer than it is wide. */
const MIN_PIXELS = 9;

function arrowHead(ctx, x, y, angle, size) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - size * Math.cos(angle - 0.42), y - size * Math.sin(angle - 0.42));
  ctx.lineTo(x - size * Math.cos(angle + 0.42), y - size * Math.sin(angle + 0.42));
  ctx.closePath();
  ctx.fill();
}

/**
 * Draw a seat's pending orders.
 *
 * @param {Array} orders    marches ordered for tomorrow: {column, from, to}
 * @param {Array} rebuilding column ids waiting on the depots
 * @param {Map}   positions  where every column stands today
 */
export function drawOrders(ctx, world, camera, width, height, orders, rebuilding, positions) {
  if (!orders?.length && !rebuilding?.length) return;
  const scale = camera.pixelsPerCell(width, height);
  if (scale < MIN_PIXELS) return;

  const sphere = grid();
  // `project` reports whether a point is over the horizon in `visible`; there
  // is no depth on the result to compare against. Reading one that was never
  // written meant every arrow was skipped as being round the back.
  const a = { x: 0, y: 0, visible: false };
  const b = { x: 0, y: 0, visible: false };
  const size = Math.max(4, Math.min(13, scale * 0.22));

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // ---- what is marching ---------------------------------------------------
  //
  // Several columns commonly march into one hex from the same neighbour, and
  // six arrows drawn along one line is one arrow drawn six times. Counted
  // instead, and the count is written where the arrow lands.
  const lanes = new Map();
  for (const order of orders ?? []) {
    const key = `${order.from}>${order.to}`;
    lanes.set(key, (lanes.get(key) ?? 0) + 1);
  }

  for (const [lane, count] of lanes) {
    const [from, to] = lane.split('>').map(Number);
    camera.project(sphere.lat[from], sphere.lon[from], width, height, a);
    camera.project(sphere.lat[to], sphere.lon[to], width, height, b);
    if (!a.visible || !b.visible) continue;

    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    // Stopped short of the middle of the target, so the head sits on the edge
    // of the hex it is entering rather than on top of whatever is standing
    // there.
    const shorten = scale * 0.3;
    const tipX = b.x - Math.cos(angle) * shorten;
    const tipY = b.y - Math.sin(angle) * shorten;
    const tailX = a.x + Math.cos(angle) * shorten;
    const tailY = a.y + Math.sin(angle) * shorten;

    ctx.lineWidth = Math.max(3, size * 0.5);
    ctx.strokeStyle = MARCH_DARK;
    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();

    ctx.lineWidth = Math.max(1.5, size * 0.26);
    ctx.strokeStyle = MARCH;
    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();

    ctx.fillStyle = MARCH;
    arrowHead(ctx, tipX, tipY, angle, size);

    if (count > 1 && size >= 7) {
      ctx.font = `600 ${Math.round(size * 0.85)}px 'Inter', 'Segoe UI', system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const midX = (tailX + tipX) / 2;
      const midY = (tailY + tipY) / 2;
      ctx.lineWidth = 3;
      ctx.strokeStyle = MARCH_DARK;
      ctx.strokeText(String(count), midX, midY);
      ctx.fillText(String(count), midX, midY);
    }
  }

  // ---- and what is waiting on the depots ----------------------------------
  const waiting = new Set();
  for (const id of rebuilding ?? []) {
    const cell = positions?.get(id);
    if (cell !== undefined) waiting.add(cell);
  }
  ctx.lineWidth = Math.max(1.5, size * 0.22);
  ctx.strokeStyle = REBUILD;
  ctx.setLineDash([size * 0.5, size * 0.45]);
  for (const cell of waiting) {
    camera.project(sphere.lat[cell], sphere.lon[cell], width, height, a);
    if (!a.visible) continue;
    ctx.beginPath();
    ctx.arc(a.x, a.y, scale * 0.34, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.restore();
}
