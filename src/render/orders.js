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
// Aircraft, in a colour nothing on the ground uses. A flight is the one order
// on this board that does not concern the hexes it crosses.
const AIR = 'rgba(150, 205, 244, 0.92)';
const AIR_DARK = 'rgba(6, 14, 24, 0.6)';
// And the marches nobody ordered: the same arrow, ghosted, because the whole
// question a player has about them is which ones are theirs.
const ADVANCE = 'rgba(226, 199, 141, 0.45)';

/** Least zoom at which an arrow is longer than it is wide. */
const MIN_PIXELS = 9;

/**
 * And the least zoom at which a flight is worth drawing, which is lower.
 *
 * A march is one hex and vanishes into its own arrowhead when the cells get
 * small. A bomber goes ten, so at four pixels a cell it is still a legible
 * line across half of Germany — and zoomed out is exactly when you want to see
 * where the aircraft are going.
 */
const MIN_AIR_PIXELS = 3;

function arrowHead(ctx, x, y, angle, size) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - size * Math.cos(angle - 0.42), y - size * Math.sin(angle - 0.42));
  ctx.lineTo(x - size * Math.cos(angle + 0.42), y - size * Math.sin(angle + 0.42));
  ctx.closePath();
  ctx.fill();
}

/**
 * A flight, drawn as an arc.
 *
 * Bowed rather than straight, and dashed, because a mission is the one order
 * that does not concern the ground it crosses: a straight solid line from an
 * airfield to a works reads as a march through everything in between, which is
 * exactly the wrong thing to say about aircraft. The bow is a fixed share of
 * the distance, so a short hop and a long one look like the same kind of thing.
 *
 * Leaves the path on the context for the caller to stroke, twice, in two
 * colours. Returns where the head goes.
 */
function flightPath(ctx, a, b, size) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const span = Math.hypot(dx, dy);
  if (span < 1) return null;
  // Perpendicular, and always to the same side of the line, so a mission out
  // and a mission back do not draw over one another.
  const bow = Math.min(span * 0.22, 90);
  const cx = (a.x + b.x) / 2 - (dy / span) * bow;
  const cy = (a.y + b.y) / 2 + (dx / span) * bow;

  // Stopped short of the target so the head sits off the hex itself.
  const angle = Math.atan2(b.y - cy, b.x - cx);
  const tipX = b.x - Math.cos(angle) * size * 0.9;
  const tipY = b.y - Math.sin(angle) * size * 0.9;

  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.quadraticCurveTo(cx, cy, tipX, tipY);
  return { tipX, tipY, angle };
}

/**
 * Draw a seat's pending orders.
 *
 * @param {Array} orders     marches ordered for tomorrow: {column, from, to}
 * @param {Array} rebuilding column ids waiting on the depots
 * @param {Map}   positions  where every column stands today
 * @param {Array} missions   air missions ordered: {from, to}
 * @param {Array} advances   the marches nobody ordered: {from, to}
 */
export function drawOrders(
  ctx,
  world,
  camera,
  width,
  height,
  orders,
  rebuilding,
  positions,
  missions,
  advances,
) {
  if (!orders?.length && !rebuilding?.length && !missions?.length && !advances?.length) return;
  const scale = camera.pixelsPerCell(width, height);
  if (scale < MIN_AIR_PIXELS) return;

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

  // ---- what is flying ------------------------------------------------------
  //
  // First, because everything on the ground should be drawn over the top of a
  // line that is nine hundred kilometres long and crosses half the board.
  const flights = new Set();
  for (const m of missions ?? []) {
    if (m?.from === undefined || m?.to === undefined || m.from === m.to) continue;
    flights.add(`${m.from}>${m.to}`);
  }
  if (flights.size) {
    const wing = Math.max(4, Math.min(12, scale * 0.3));
    const dash = [wing * 0.9, wing * 0.7];
    for (const lane of flights) {
      const [from, to] = lane.split('>').map(Number);
      camera.project(sphere.lat[from], sphere.lon[from], width, height, a);
      camera.project(sphere.lat[to], sphere.lon[to], width, height, b);
      if (!a.visible || !b.visible) continue;

      ctx.setLineDash(dash);
      const path = flightPath(ctx, a, b, wing);
      if (!path) continue;
      ctx.lineWidth = Math.max(3, wing * 0.42);
      ctx.strokeStyle = AIR_DARK;
      ctx.stroke();
      // The same path again, in the light colour. A stroke does not consume it.
      ctx.lineWidth = Math.max(1.4, wing * 0.2);
      ctx.strokeStyle = AIR;
      ctx.stroke();

      // The head and the airfield ring are solid: a dashed arrowhead is a
      // smudge.
      ctx.setLineDash([]);
      ctx.fillStyle = AIR;
      arrowHead(ctx, path.tipX, path.tipY, path.angle, wing * 0.9);
      ctx.lineWidth = Math.max(1.2, wing * 0.16);
      ctx.strokeStyle = AIR;
      ctx.beginPath();
      ctx.arc(a.x, a.y, wing * 0.34, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  // Everything below is one hex long and disappears into its own arrowhead
  // long before the aircraft do.
  if (scale < MIN_PIXELS) {
    ctx.restore();
    return;
  }

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

  // ---- and the marches nobody ordered -------------------------------------
  //
  // The same shape as your own and half the weight of them, because the only
  // question worth answering here is which of these you chose. A player who
  // does not like one gives that column an order instead, and the ghost is
  // replaced by the real thing.
  const drifting = new Set();
  for (const step of advances ?? []) {
    if (step?.from === undefined || step?.to === undefined) continue;
    drifting.add(`${step.from}>${step.to}`);
  }
  if (drifting.size) {
    const dash = [size * 0.7, size * 0.55];
    ctx.lineWidth = Math.max(1.2, size * 0.18);
    ctx.strokeStyle = ADVANCE;
    ctx.fillStyle = ADVANCE;
    for (const lane of drifting) {
      const [from, to] = lane.split('>').map(Number);
      camera.project(sphere.lat[from], sphere.lon[from], width, height, a);
      camera.project(sphere.lat[to], sphere.lon[to], width, height, b);
      if (!a.visible || !b.visible) continue;
      const angle = Math.atan2(b.y - a.y, b.x - a.x);
      const shorten = scale * 0.3;
      const tipX = b.x - Math.cos(angle) * shorten;
      const tipY = b.y - Math.sin(angle) * shorten;
      ctx.setLineDash(dash);
      ctx.beginPath();
      ctx.moveTo(a.x + Math.cos(angle) * shorten, a.y + Math.sin(angle) * shorten);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();
      ctx.setLineDash([]);
      arrowHead(ctx, tipX, tipY, angle, size * 0.7);
    }
    ctx.setLineDash([]);
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
