import { TILE_COUNT, neighbours } from '../world/sphere.js';
import { NATION_INDEX, NATIONS, SEA } from '../world/nations.js';
import { atWar, isMobile, mayMarch } from './movement.js';

// Walking to the war.
//
// A nation's armies are deployed where a nation keeps armies, which is not
// where the fighting is. Germany opens with divisions in Bavaria, in the
// Rhineland, in East Prussia and around Berlin, and getting them to the Polish
// frontier is a fortnight of ticking the same boxes on the same six hexes every
// morning. That is not a decision. It is the absence of one, repeated.
//
// So an army with nothing better to do walks towards the nearest enemy of its
// own accord, and stops when it gets there.
//
// ---------------------------------------------------------------- two rules
//
// **It stops at the line.** Stepping onto ground somebody else is holding is an
// attack, and an attack is a decision — so the standing order brings a column
// up to the frontier and leaves it there. Nothing is ever committed to a battle
// by a rule the player did not think about that morning.
//
// **An order beats it.** Anything you have told a column to do this morning is
// what it does; the advance only ever moves the columns you said nothing about.
// That is the whole of how it is overridden, and it needs no second mechanism.

/** The kinds of formation that go towards the guns. */
const MANOEUVRE = new Set(['field', 'armor']);

/**
 * How far every hex of a nation's ground is from somebody it is fighting.
 *
 * A breadth-first walk inward from the contact line, over that nation's own
 * ground only. Cells it cannot reach — an island, a pocket cut off behind the
 * enemy, or anywhere at all when the nation is not fighting anybody — stay at
 * -1, and nothing on them moves.
 *
 * @returns {Int32Array} hexes from the front, or -1 where there is no way there
 */
export function frontDistance(world, power, day) {
  const owner = world.ownership.owner;
  const seat = NATION_INDEX[power];
  const far = new Int32Array(TILE_COUNT).fill(-1);
  if (seat === undefined) return far;

  // The line: our ground that touches ground held by somebody we may fight.
  let wave = [];
  for (let i = 0; i < TILE_COUNT; i += 1) {
    if (owner[i] !== seat) continue;
    for (const j of neighbours(i)) {
      const held = owner[j];
      if (held === SEA || held === seat) continue;
      if (!atWar(day, power, NATIONS[held].id, world, j)) continue;
      far[i] = 0;
      wave.push(i);
      break;
    }
  }

  // And inward over our own ground.
  let step = 0;
  while (wave.length) {
    step += 1;
    const next = [];
    for (const i of wave) {
      for (const j of neighbours(i)) {
        if (owner[j] !== seat || far[j] !== -1) continue;
        far[j] = step;
        next.push(j);
      }
    }
    wave = next;
  }
  return far;
}

/**
 * The step each idle column takes towards the fighting.
 *
 * Only columns that have been given nothing else to do, are able to march at
 * all, and are further from the line than the hex next door. A column already
 * on the line stays on it — going forward from there is an attack.
 *
 * @returns {Array<{power, column, from, to, advance: true}>}
 */
export function advanceOrders({ world, power, day, positions, arrivals, taken, aboard }) {
  const far = frontDistance(world, power, day);
  const out = [];
  const ordered = new Set(taken ?? []);

  for (const column of world.garrisons.opening) {
    if (column.formation.nation !== power) continue;
    if (!MANOEUVRE.has(column.formation.type)) continue;
    if (!isMobile(column.formation)) continue;
    if (ordered.has(column.id)) continue;
    // At sea, and the ship decides where it goes.
    if (aboard?.has(column.id)) continue;

    const from = positions.get(column.id);
    if (from === undefined) continue;
    const here = far[from];
    // Not on ground with a way to the front, or standing on the line already.
    if (here <= 0) continue;

    // The neighbour that is nearer. Ties go to the lowest cell index, so the
    // same board gives the same advance on every machine that works it out.
    let best = -1;
    let bestFar = here;
    for (const j of neighbours(from)) {
      const there = far[j];
      if (there < 0 || there >= bestFar) continue;
      if (best === -1 || there < bestFar || j < best) {
        best = j;
        bestFar = there;
      }
    }
    if (best === -1) continue;

    // Checked against the ordinary rules, which is where resting, immobility
    // and everything else is already written down.
    const why = mayMarch({
      world,
      column,
      to: best,
      power,
      day,
      positions,
      arrivals,
      ordered,
    });
    if (why) continue;

    ordered.add(column.id);
    // Stamped with the day, like every other move. Without it `positionsAt`
    // stops filtering by date — `undefined > day` is false — and every advance
    // ever made applies to every day the record is asked about.
    out.push({ day, power, column: column.id, from, to: best, advance: true });
  }
  return out;
}
