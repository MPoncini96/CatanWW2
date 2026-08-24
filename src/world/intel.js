import { NATIONS, NATION_INDEX, NEUTRAL, SEA } from './nations.js';

// What a seat is allowed to know about the ground.
//
// One rule, in one place, because it is asked twice from opposite ends of the
// program: the inspector asks it about a cell a player clicked, and the Forces
// layer asks it about all 114,492 at once. Two copies would drift, and the copy
// that drifted would be the one that leaked.
//
// What it hides is military: how many men, tanks, guns and aircraft stand on a
// hex. Terrain, population, cities and output stay visible to everyone — those
// were in every almanac in 1939, and a game where you cannot see that Germany
// has no oil is not modelling the war, it is modelling ignorance of it.

/**
 * May this seat see the garrison standing on this cell?
 *
 * @param {string|null} viewer  the power whose page this is, or null for none
 * @param {number} owner        nation index of the cell, or SEA
 *
 * Three things are visible: your own ground, the ground of anyone on your side,
 * and the neutrals. The last is deliberate. The Independent army is not one
 * army — it is thirty of them that never fought as one — and Poland's divisions
 * on 1 September are not a German secret, they are the reason the war started
 * where it did. Hiding them would blind everyone to the same thing.
 */
export function canSeeForces(viewer, owner) {
  if (owner === SEA) return false;
  // Nobody at the table: the map is a reference, not a hand of cards.
  if (!viewer) return true;
  if (owner === NEUTRAL) return true;
  const seat = NATION_INDEX[viewer];
  if (seat === undefined) return true;
  if (owner === seat) return true;
  const mine = NATIONS[seat].side;
  return mine !== null && mine === NATIONS[owner].side;
}

/** Everyone whose garrisons this seat may see, for a legend or a total. */
export function visibleTo(viewer) {
  return NATIONS.map((_, index) => index).filter((index) => canSeeForces(viewer, index));
}
