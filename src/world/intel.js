import { TILE_COUNT, neighbours } from './sphere.js';
import { NATIONS, NATION_INDEX, NEUTRAL, SEA } from './nations.js';

// What a seat is allowed to know about the ground.
//
// One rule, in one place, because it is asked from three ends of the program:
// the inspector asks it about a cell a player clicked, the Nations layer asks
// it about all 114,492 at once, and the totals ask it about every army and
// fleet on the board. Copies would drift, and the copy that drifted would be
// the one that leaked.
//
// What it hides is military: how many men, tanks, guns, aircraft and ships are
// there. Terrain, population, cities and output stay visible to everyone —
// those were in every almanac in 1939, and a game where you cannot see that
// Germany has no oil is not modelling the war, it is modelling ignorance of it.

/**
 * May this seat see the garrisons of this nation, wherever they stand?
 *
 * Three cases: your own ground, the ground of anyone on your side, and the
 * neutrals. The last is deliberate. The Independent army is not one army — it
 * is thirty of them that never fought as one — and Poland's divisions on 1
 * September are not a German secret, they are the reason the war started where
 * it did. Hiding them would blind everyone to the same thing.
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

/** Everyone whose garrisons this seat may see anywhere, for a legend or total. */
export function visibleTo(viewer) {
  return NATIONS.map((_, index) => index).filter((index) => canSeeForces(viewer, index));
}

/**
 * Which cells this seat may count, cell by cell.
 *
 * The side rule is not the whole of it. An army on the far side of a frontier
 * is not a secret — you can see it from your own trench, and in 1939 both sides
 * of every border in Europe knew roughly what was dug in opposite. So a cell is
 * counted if the side rule allows it, **or if it touches ground your side
 * holds**. Everything deeper than one hex stays dark.
 *
 * "Ground your side holds" is narrower than "ground you can see", and the
 * difference matters: the neutrals are visible to everybody, and if their
 * ground counted as a frontier then Britain would be reading the Wehrmacht's
 * order of battle through Belgium and Poland from four hundred miles away. Only
 * your own trenches look across at anything.
 *
 * The same array answers for the sea, which no one owns: a fleet is countable
 * if it is moored against a coast your side holds. A raider in mid-ocean
 * touches nothing, which is exactly the point of one.
 */
export function visibilityFor(world, viewer) {
  const cached = CACHE.get(world);
  if (cached?.has(viewer ?? '')) return cached.get(viewer ?? '');

  const owner = world.ownership.owner;
  const seat = NATION_INDEX[viewer];
  const side = seat === undefined ? null : NATIONS[seat].side;

  // Ground this seat's own side stands on. Not the neutrals: nobody has a
  // trench in Belgium to look out of.
  const held = new Uint8Array(TILE_COUNT);
  for (let i = 0; i < TILE_COUNT; i += 1) {
    const at = owner[i];
    if (at === SEA || at === NEUTRAL) continue;
    held[i] = at === seat || (side !== null && NATIONS[at].side === side) ? 1 : 0;
  }

  const visible = new Uint8Array(TILE_COUNT);
  for (let i = 0; i < TILE_COUNT; i += 1) {
    if (owner[i] !== SEA && canSeeForces(viewer, owner[i])) {
      visible[i] = 1;
      continue;
    }
    for (const j of neighbours(i)) {
      if (held[j]) {
        visible[i] = 1;
        break;
      }
    }
  }

  const perViewer = cached ?? new Map();
  perViewer.set(viewer ?? '', visible);
  CACHE.set(world, perViewer);
  return visible;
}

// One array per world per seat. The world is rebuilt when the page changes
// nation, so this never grows past a handful of entries.
const CACHE = new WeakMap();

/** May this seat count what is standing on this cell? */
export function seesCell(world, viewer, index) {
  if (!viewer) return true;
  return visibilityFor(world, viewer)[index] === 1;
}

/**
 * May this seat count this fleet?
 *
 * Its own and its side's, wherever they are — a navy knows where its own ships
 * are — and anyone else's that is moored against a coast it can see.
 */
export function seesFleet(world, viewer, station) {
  if (canSeeForces(viewer, NATION_INDEX[station.power])) return true;
  return seesCell(world, viewer, station.cell);
}
