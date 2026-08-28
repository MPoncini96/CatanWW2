import { neighbours } from '../world/sphere.js';
import { NATION_INDEX, SEA } from '../world/nations.js';
import { TERRAIN } from '../world/terrain.js';
import { SHIPS } from '../world/navies.js';
import { formationName } from '../world/deploy.js';
import { atWar, isMobile, restDays } from './movement.js';

// Getting an army across water.
//
// Until this existed, no army could cross a single hex of sea, and the
// consequences were larger than they looked. Tokyo sat on a 55-hex island and
// London on a 47-hex one, so neither could ever be taken. Sicily had four hexes
// and not one of them was walkable from the Italian mainland, so Italy could
// only be beaten by beating Germany first. The American seaboard was on another
// continent. **Both Axis victory conditions were unreachable**, because each
// needed a sea crossing, and the fifty Pacific islands were decorative — 46 of
// them isolated single hexes with nothing able to reach them.
//
// ---------------------------------------------------------------- the rules
//
// A fleet lifts columns. They **embark** from a coast onto a fleet in the water
// beside it, they ride while it steams, and they **land** onto a coast beside
// wherever it has got to — into whatever is standing there.
//
// A column aboard is given a move record each day mirroring the ship, so its
// position is the ship's position and nothing downstream had to be rewritten to
// find it. What that costs is three guards: a column at sea takes no part in a
// land battle, captures no ground, and does not starve, because it is on a ship
// with the rations.

/**
 * Men one hull can lift.
 *
 * An attack transport of the period carried about 1,500 and a division is
 * 15,000, so a division is ten ships — but the hulls counted here are warships,
 * and warships did not carry armies. What this number really stands for is the
 * merchant shipping that came with every landing and is not modelled ship by
 * ship: a fleet's lift is a proxy for the convoy it can escort and organise.
 *
 * Six hundred a hull is set from the largest landing anybody ever did: the
 * Royal Navy's 265 surface hulls come to about 159,000 men, and Overlord put
 * 156,000 ashore on the first day. So the whole of one navy, concentrated, is
 * one Normandy — and Scapa Flow on its own lifts 41,000, which carries a large
 * formation and not an army group.
 */
export const LIFT_PER_HULL = 600;

/** Submarines lift nothing. This should not need saying and the code needs it. */
const CANNOT_LIFT = new Set(['submarines']);

/**
 * Aircraft one carrier can land, feed and turn round.
 *
 * A fleet carrier of the period ran seventy to ninety, and the number that
 * mattered was never the hangar — it was the deck. Seventy-two is an air group
 * of the kind that fought at Midway, and it means a squadron of six carriers is
 * about four hundred aircraft, which is what the Kido Butai actually was.
 */
export const DECK_PER_CARRIER = 72;

/** Is this formation aircraft rather than men? */
export function isAirGroup(formation) {
  return formation?.type === 'air';
}

/**
 * Deck space on a fleet.
 *
 * Carriers only, which is the whole rule. A hundred destroyers have room for a
 * fighter group in exactly the sense that a car park has room for an
 * aeroplane.
 */
export function deckOf(fleet) {
  if (!fleet || fleet.cargo) return 0;
  return Math.floor((fleet.ships?.carriers ?? 0) * DECK_PER_CARRIER);
}

/**
 * And deck space at an anchorage, which is what actually decides it.
 *
 * Every carrier of one power sitting on one hex, because ships in company are
 * one force and their decks are one deck. This is not a convenience: with one
 * carrier to a station, no air group on the board fits on any single fleet —
 * Fighter Command is 150 aircraft and a deck is 72 — so a rule counting fleets
 * one at a time makes the whole thing unusable.
 *
 * Counting the hex instead says something true and turns it into an operation:
 * **you need a carrier squadron, not a carrier.** Two decks take a raised
 * fighter group, three take Fighter Command, and six take four hundred
 * aircraft, which is what the Kido Butai was.
 */
export function deckAt(cell, power, fleets) {
  let deck = 0;
  for (const fleet of fleets ?? []) {
    if (fleet.power !== power || fleet.cell !== cell || !fleet.afloat) continue;
    deck += deckOf(fleet);
  }
  return deck;
}

/** And what is already parked on it, across every fleet in company. */
export function decksUsedAt(cell, power, fleets, aboard, strengths, columns) {
  let aircraft = 0;
  for (const fleet of fleets ?? []) {
    if (fleet.power !== power || fleet.cell !== cell) continue;
    aircraft += decksUsed(fleet.id, aboard, strengths, columns);
  }
  return aircraft;
}

/** Aircraft in a formation, counted as aircraft rather than as tonnage. */
export function aircraftIn(strength) {
  return Math.round((strength?.fighters ?? 0) + (strength?.bombers ?? 0));
}

/** And how much of a fleet's deck is already spoken for. */
export function decksUsed(fleetId, aboard, strengths, columns) {
  let aircraft = 0;
  for (const id of carriedBy(fleetId, aboard)) {
    const column = columns?.get(id);
    if (!isAirGroup(column?.formation)) continue;
    aircraft += aircraftIn(strengths?.get(id) ?? column?.strength ?? {});
  }
  return aircraft;
}

/** What a fleet can carry. */
export function liftOf(fleet) {
  if (!fleet || fleet.cargo) return 0;
  let hulls = 0;
  for (const ship of SHIPS) {
    if (CANNOT_LIFT.has(ship.id)) continue;
    hulls += fleet.ships?.[ship.id] ?? 0;
  }
  return Math.floor(hulls * LIFT_PER_HULL);
}

/** Which columns are at sea, and in what. */
export function cargoAt(embarks, landings, day) {
  const aboard = new Map();
  for (const entry of embarks ?? []) {
    if (entry.day > day) continue;
    aboard.set(entry.column, entry.fleet);
  }
  for (const entry of landings ?? []) {
    if (entry.day > day) continue;
    aboard.delete(entry.column);
  }
  return aboard;
}

/** Everything a given fleet is carrying. */
export function carriedBy(fleetId, aboard) {
  const out = [];
  for (const [column, fleet] of aboard) if (fleet === fleetId) out.push(column);
  return out;
}

/**
 * How many men a fleet has aboard already.
 *
 * Air groups are not counted. They are not cargo — they are flying off the
 * carriers, and a squadron does not lose its lift because its own aircraft are
 * on their own decks.
 */
export function loadOf(fleetId, aboard, strengths, columns) {
  let men = 0;
  for (const id of carriedBy(fleetId, aboard)) {
    const column = columns?.get(id);
    if (isAirGroup(column?.formation)) continue;
    const have = strengths?.get(id) ?? column?.strength ?? {};
    men += menIn(have);
  }
  return men;
}

/** What a formation weighs, in men. Everything on a ship takes up room. */
export function menIn(strength) {
  let men = 0;
  for (const [arm, n] of Object.entries(strength ?? {})) {
    if (!n) continue;
    // A tank takes the room of a platoon and a gun rather less. The numbers are
    // rough on purpose: the point is that an armoured division is far harder to
    // put ashore than a rifle division, which is why the first wave never was
    // one.
    if (arm === 'tanks') men += n * 40;
    else if (arm === 'artillery') men += n * 12;
    else if (arm === 'fighters' || arm === 'bombers') men += n * 8;
    else men += n;
  }
  return men;
}

/** Is this a hex an army could stand on? */
function isGround(world, cell) {
  return world.ownership.owner[cell] !== SEA && !TERRAIN[world.biome[cell]].water;
}

/**
 * May this column go aboard this fleet?
 *
 * Returns null if it may, or the sentence saying why not.
 */
export function mayEmbark({
  world,
  column,
  fleet,
  power,
  day,
  positions,
  arrivals,
  aboard,
  strengths,
  columns,
  // Every fleet on the board, so that carriers in company can be counted as
  // one deck. Optional: without it the rule falls back to the single fleet,
  // which is right for cargo and too strict for aircraft.
  fleets,
  ordered,
}) {
  if (!power) return 'Nobody is sitting at this seat.';
  if (!column) return 'Nothing is selected to put aboard.';
  if (!fleet) return 'No fleet is selected to carry it.';
  const name = formationName(column.formation);

  if (column.formation.nation !== power) return `${name} is not yours to order.`;
  if (fleet.power !== power) return `${fleet.name} is not yours to order.`;
  if (fleet.cargo) return 'A convoy carries freight, not armies.';
  if (!fleet.afloat) return `${fleet.name} is not at sea.`;
  if (!isMobile(column.formation)) return `${name} cannot be moved — it is fixed where it stands.`;
  if (ordered?.has(column.id)) return 'Already under orders for tomorrow.';
  if (aboard?.has(column.id)) return `${name} is already aboard.`;

  const from = positions.get(column.id);
  if (from === undefined) return 'This column is not on the board.';
  if (!isGround(world, from)) return `${name} is already at sea.`;

  // The ship has to be in the water next to the beach it is loading from.
  if (![...neighbours(from)].includes(fleet.cell)) {
    return `${fleet.name} is not in the water beside ${name}.`;
  }

  // A column that came in yesterday is still sorting itself out, and loading a
  // ship is not less work than marching.
  const arrived = arrivals?.get(column.id);
  if (arrived !== undefined) {
    const needs = restDays(TERRAIN[world.biome[from]].id);
    if (day - arrived < needs) return 'Arrived today — it embarks tomorrow.';
  }

  const have = strengths?.get(column.id) ?? column.strength;

  // An air group is not cargo. It flies onto the carriers and off them again,
  // which is the one thing a ship can do that no hex can: a carrier is an
  // aerodrome that is somewhere else next week.
  //
  // Bombers are allowed, and the first version of this refused them on the
  // grounds that a bomber needs a runway. That was wrong twice over: it barred
  // every air group on the board, since almost all of them are mixed, and a
  // carrier air group was mostly strike aircraft anyway — the four hundred
  // aeroplanes that flew at Pearl Harbor were largely bombers and torpedo
  // planes. What a deck cannot take is a heavy, and the deck limit and the
  // four-hex reach already say that without a rule about types.
  if (isAirGroup(column.formation)) {
    const deck = fleets ? deckAt(fleet.cell, power, fleets) : deckOf(fleet);
    if (!deck) return `${fleet.name} has no carrier for ${name} to land on.`;
    const used = fleets
      ? decksUsedAt(fleet.cell, power, fleets, aboard ?? new Map(), strengths, columns)
      : decksUsed(fleet.id, aboard ?? new Map(), strengths, columns);
    const space = deck - used;
    const wants = aircraftIn(have);
    if (wants > space) {
      return `${Math.max(0, space)} places on the decks here; ${name} is ${wants} aircraft.`;
    }
    return null;
  }

  const room = liftOf(fleet) - loadOf(fleet.id, aboard ?? new Map(), strengths, columns);
  const needsRoom = menIn(have);
  if (needsRoom > room) {
    return `${fleet.name} can lift ${Math.round(room).toLocaleString()} more; ${name} needs ${Math.round(needsRoom).toLocaleString()}.`;
  }
  return null;
}

/**
 * May this fleet put its army ashore here?
 *
 * The same question a march asks about a hex, asked from the water: your own
 * ground, or the ground of somebody you are fighting. Landing on a neutral you
 * are not at war with is an invasion, and an invasion is a declaration.
 */
export function mayLand({ world, fleet, to, power, day, aboard }) {
  if (!power) return 'Nobody is sitting at this seat.';
  if (!fleet) return 'No fleet is selected.';
  if (fleet.power !== power) return `${fleet.name} is not yours to order.`;
  if (fleet.cargo) return 'A convoy carries freight, not armies.';
  if (!fleet.afloat) return `${fleet.name} is not at sea.`;

  const carried = carriedBy(fleet.id, aboard ?? new Map());
  if (!carried.length) return `${fleet.name} has nobody aboard.`;
  if (!isGround(world, to)) return 'There is no beach there.';
  if (![...neighbours(fleet.cell)].includes(to)) {
    return `${fleet.name} is not in the water beside that hex.`;
  }

  const owner = world.ownership.owner[to];
  if (owner === NATION_INDEX[power]) return null;
  const held = world.countryOf?.[to] >= 0 ? world.countries[world.countryOf[to]].name : null;
  const parties = [held, world.ownership.nationAt(to)?.id].filter(Boolean);
  if (!parties.length) return 'Nothing on that hex answers to anybody.';
  if (!parties.some((party) => atWar(day, power, party, world, to))) {
    return `You are not at war with ${held ?? 'them'}.`;
  }
  return null;
}

/**
 * The moves an army at sea makes today.
 *
 * One per carried column per day, mirroring the ship. That is a few records a
 * day for a loaded fleet and it is what lets `positionsAt` — which is nine
 * lines and knows nothing about ships — go on being the one answer to where
 * everything is.
 */
export function ridingMoves({ day, fleets, aboard, positions }) {
  const moves = [];
  const byId = new Map(fleets.map((f) => [f.id, f]));
  for (const [column, fleetId] of aboard) {
    const fleet = byId.get(fleetId);
    if (!fleet) continue;
    if (positions.get(column) === fleet.cell) continue;
    moves.push({
      day,
      power: fleet.power,
      column,
      from: positions.get(column),
      to: fleet.cell,
      riding: fleet.id,
    });
  }
  return moves;
}
