import { neighbours } from '../world/sphere.js';
import { NATIONS, NATION_INDEX, SEA } from '../world/nations.js';
import { TERRAIN } from '../world/terrain.js';
import { formationName } from '../world/deploy.js';
import { mayFight } from './belligerence.js';

// Marching.
//
// One hex an order, and a column that arrives somewhere spends the next day
// standing still. That is 33 km a day, which is what an army on its feet did in
// 1939 — the panzer divisions did twice it, and the model does not distinguish,
// because a rule you can hold in your head is worth more here than a rule that
// is right about the Wehrmacht and wrong about everybody else.
//
// High ground costs an extra day of that rest, so a mountain hex takes three
// days to enter rather than two. It is not shut: nothing on this board is.
// Sealing the mountains would wall off a fifth of the world's land and leave
// five thousand hexes with no passable neighbour at all — Denver would have no
// land route to San Francisco — so height is expensive rather than impossible,
// which is also what the Ardennes turned out to be.
//
// ------------------------------------------------------------- what moves
//
// The atom is a column: the part of a formation standing on one hex. Not the
// formation, because a formation is not in one place — the Kwantung Army holds
// 261 hexes and cannot march as a thing. Not a number of men either, because
// then every order needs a slider and every hex needs bookkeeping. What stands
// on a hex moves off it whole, and never divides further.

/**
 * May these two nations fight each other on this hex today?
 *
 * Both names are tried, because the pooled neutral is not a belligerent and
 * the country standing on the ground is: Germany is at war with Poland on the
 * first of September and with Independent never, and the hex under Warsaw has
 * to answer to the first of those.
 */
export function atWar(day, a, b, world, cell) {
  if (a === b) return false;
  const named = (nation) =>
    nation === 'neutral' && world.countryOf[cell] >= 0
      ? world.countries[world.countryOf[cell]].name
      : nation;
  return mayFight(day, named(a), named(b)) || mayFight(day, a, b);
}

/** Ground that costs a second day of rest to enter. */
const HIGH_GROUND = new Set(['mountain', 'peak', 'glacier']);

/**
 * Below this, a formation does not march at all.
 *
 * The Maginot fortress troops are 0.02 and the coastal batteries are not much
 * more: they were poured into the ground they stood on and the whole argument
 * about the Maginot Line is that it could not go anywhere.
 */
export const IMMOBILE_BELOW = 0.1;

/** Days a column must stand still after arriving on this kind of ground. */
export function restDays(terrainId) {
  return HIGH_GROUND.has(terrainId) ? 2 : 1;
}

/** Can this formation march at all, or is it part of the landscape? */
export function isMobile(formation) {
  return (formation.mobility ?? 0) >= IMMOBILE_BELOW;
}

/**
 * Where every column stands on a given day.
 *
 * Positions are replayed from the opening deployment and the log of moves that
 * have actually happened, rather than stored. It is the same discipline the
 * economy uses — stores are the opening figure plus the net of every day since
 * — and for the same reason: two copies of where an army is would eventually
 * disagree, and the copy that disagreed would be the one on screen.
 *
 * @param {Array} placements the opening deployment, each with an id
 * @param {Array} moves      executed moves, oldest first
 * @param {number} day       the day to read positions for
 */
export function positionsAt(placements, moves, day) {
  const at = new Map();
  for (const placement of placements) at.set(placement.id, placement.cell);
  for (const move of moves) {
    if (move.day > day) break;
    at.set(move.column, move.to);
  }
  return at;
}

/**
 * The day each column last arrived where it is, or null if it has never moved.
 *
 * Null rather than zero, and the difference matters on the first morning: a
 * division that has stood in Silesia since August is not resting, it is ready.
 */
export function arrivalsAt(moves, day) {
  const on = new Map();
  for (const move of moves) {
    if (move.day > day) break;
    on.set(move.column, move.day);
  }
  return on;
}

/**
 * May this seat order this column into this hex, for tomorrow?
 *
 * Returns null if it may, or the sentence saying why not. Every refusal is a
 * sentence for the same reason the order menu's are: a control that says no
 * without saying why is worse than no control.
 */
export function mayMarch({ world, column, to, power, day, positions, arrivals, ordered }) {
  if (!power) return 'Nobody is sitting at this seat.';
  if (!column) return 'Nothing is selected to march.';
  const name = formationName(column.formation);
  if (column.formation.nation !== power) return `${name} is not yours to order.`;
  if (!isMobile(column.formation)) {
    return `${name} cannot march — it is fixed to the ground it holds.`;
  }
  if (ordered?.has(column.id)) return 'Already under orders for tomorrow.';

  const from = positions.get(column.id);
  if (from === undefined) return 'This column is not on the board.';
  if (from === to) return 'It is already there.';

  // One hex an order. Anything further is several days of marching, given a day
  // at a time, which is the whole of the movement model.
  let adjacent = false;
  for (const j of neighbours(from)) if (j === to) adjacent = true;
  if (!adjacent) return 'A column marches one hex a day, and that hex is further.';

  const owner = world.ownership.owner;
  if (owner[to] === SEA) return 'There is no ground there.';

  // Resting. The rule is arrival, not distance: a column that came in
  // yesterday is still sorting itself out, and one that climbed into the
  // mountains is doing it for two days.
  const arrived = arrivals.get(column.id);
  if (arrived !== undefined) {
    const needs = restDays(TERRAIN[world.biome[from]].id);
    if (day - arrived < needs) {
      const left = needs - (day - arrived);
      return left === 1 ? 'Arrived today — it rests tomorrow.' : `Still climbing — ${left} days of rest to come.`;
    }
  }

  // Where it may go. Ground its own nation holds; neutral ground it is already
  // standing on, because the 14th Army spent the last week of August in
  // Slovakia and has to be able to shuffle about in it; and the ground of
  // anybody it is at war with, which is the only definition of an attack this
  // model needs — you march onto a hex somebody else is holding and the day
  // works out what happens.
  //
  // What is refused is the third case: marching into a neutral you are not
  // fighting. That is an invasion, and an invasion is a declaration, which
  // belongs to the timeline rather than to a column commander.
  const homeGround = owner[to] === NATION_INDEX[power];
  if (!homeGround) {
    const alreadyThere = world.garrisons.byCell
      .get(to)
      ?.some((p) => p.formation.nation === power);
    if (!alreadyThere && !atWar(day, power, NATIONS[owner[to]].id, world, to)) {
      const held = world.countryOf[to] >= 0 ? world.countries[world.countryOf[to]].name : 'that ground';
      return `You are not at war with ${held}.`;
    }
  }

  return null;
}

/**
 * Turn a day's accepted orders into moves, and stamp them with the day they
 * happen on — which is the day after they were given.
 */
export function executeOrders(orders, day) {
  const moves = [];
  for (const [power, list] of Object.entries(orders ?? {})) {
    for (const order of list ?? []) {
      moves.push({ day, power, column: order.column, from: order.from, to: order.to });
    }
  }
  // Stable, so replaying the log gives the same answer on every client.
  moves.sort((a, b) => (a.power < b.power ? -1 : a.power > b.power ? 1 : a.column < b.column ? -1 : 1));
  return moves;
}
