import { TILE_COUNT, neighbours } from '../world/sphere.js';
import { NATION_INDEX, NATIONS, NEUTRAL, SEA } from '../world/nations.js';
import { ACCESS } from '../world/deploy.js';
import { DEPOT_CELLS, PORT_CELLS } from '../world/depots.js';
import { atWar } from './movement.js';

// Getting the food and the shells forward.
//
// Nothing in the model stopped a German column marching to Vladivostok. It
// would arrive tired, and then it would fight exactly as well as it had at
// home, which is the one thing every campaign of this war says is impossible.
// The Wehrmacht did not stop outside Moscow because it ran out of Germans.
//
// ------------------------------------------------------------ how it works
//
// Two stages, because that is how it worked: **the railways carry it a long
// way, and then it goes on lorries a short way.**
//
//   1. From every depot a nation has, out along the rail network as far as
//      RAIL_REACH hexes.
//   2. From every hex the railways reached, out over any ground at all as far
//      as ROAD_REACH. This is the tail, and it is short — five hexes, which is
//      three hundred kilometres of lorries, and it is why an advance stops.
//
// A **depot** is a city or a stretch of coast. Cities because that is what a
// city was for and why they were the objectives: taking one extends your reach
// rather than merely adding to your score. Coast because in 1939 anything on
// salt water could be fed by ship, and a model without that starves East
// Prussia across the Corridor and Libya across the Mediterranean on the first
// morning, which is not what happened to either.
//
// Enemy ground conducts nothing, and that is what starves a pocket: a column
// encircled on a captured railhead is standing on a railway that goes nowhere,
// and it will be told so. Neutral ground conducts, because the 14th Army spent
// the last week of August in Slovakia and was not living off the land.
//
// One simplification worth naming: sea supply asks nothing about who commands
// the sea. A coast you hold feeds you whether or not anybody could actually get
// a convoy to it. Blockade is a naval matter and the navies do not do anything
// yet.

/** How far supply runs along a railway from the depot that fills it. */
export const RAIL_REACH = 22;

/** And how far beyond the railhead, on everything else. */
export const ROAD_REACH = 5;

/** What an army out of supply is worth in a fight. */
export const UNSUPPLIED_STRENGTH = 0.6;

/** And what a day of going without costs it. */
export const STARVATION = 0.04;

/**
 * Which hexes a nation can get supplies to, on a given day.
 *
 * @returns {Uint8Array} 1 where supply reaches, 0 where it does not
 */
export function supplyMap(world, nation, day) {
  const owner = world.ownership.owner;
  const access = world.garrisons.access;
  const seat = NATION_INDEX[nation];
  const reached = new Uint8Array(TILE_COUNT);

  // Ground that will carry anything: land, and not held by somebody we are
  // fighting. Trackless ground conducts — it just cannot be got far across,
  // which is what the five-hex tail is for. Refusing it outright left the
  // Leningrad district starving on its own frontier.
  const conducts = (i) => {
    if (owner[i] === SEA) return false;
    if (owner[i] === seat) return true;
    return !atWar(day, nation, NATIONS[owner[i]].id, world, i);
  };

  // Somewhere the supplies come from: our own ground, or ground we are standing
  // on by arrangement rather than by conquest — the British garrison in Egypt
  // is fed through Alexandria and Egypt is not British.
  const ours = (i) => {
    if (owner[i] === seat) return true;
    // Ground we are standing on by arrangement rather than by conquest — but
    // only a neutral's. A garrison sitting on another power's soil does not get
    // to run a depot on it: the Malta garrison is deployed in Sicily, because
    // Malta is smaller than a hex, and Sicily is Italy's.
    if (owner[i] !== NEUTRAL || !conducts(i)) return false;
    return (world.garrisons.byCell.get(i) ?? []).some((c) => c.formation.nation === nation);
  };

  // ---- the depots ---------------------------------------------------------
  //
  // A depot ringed entirely by people we are fighting is a depot under siege.
  // It has stores and it is not being filled, and an army sitting on it is cut
  // off however good the railway under its feet is. Without this a surrounded
  // Berlin fed itself for ever, which is not what a siege is.
  const besieged = (i) => {
    let land = 0;
    for (const j of neighbours(i)) {
      if (owner[j] === SEA) continue;
      land += 1;
      if (conducts(j)) return false;
    }
    return land > 0;
  };

  let wave = [];
  const depot = (i) => {
    if (reached[i] || !ours(i) || besieged(i)) return;
    reached[i] = 1;
    wave.push(i);
  };
  for (const city of world.cities) depot(city.index);
  // The railheads the city table is too coarse to imply — the Trans-Siberian
  // and its like, which is how everything east of the Urals was fed.
  for (const cell of DEPOT_CELLS()) depot(cell);
  // And the ports, because supply comes ashore at a harbour and not on any
  // beach: letting every coastal hex feed an army fed Libya correctly and also
  // fed a column that had walked to the Arctic shore of Siberia.
  for (const cell of PORT_CELLS((i) => owner[i] !== SEA)) depot(cell);
  for (let step = 0; step < RAIL_REACH && wave.length; step += 1) {
    const next = [];
    for (const i of wave) {
      for (const j of neighbours(i)) {
        if (reached[j] || access[j] !== ACCESS.RAIL || !conducts(j)) continue;
        reached[j] = 1;
        next.push(j);
      }

    }
    wave = next;
  }

  // ---- and then on lorries ------------------------------------------------
  wave = [];
  for (let i = 0; i < TILE_COUNT; i += 1) if (reached[i]) wave.push(i);
  for (let step = 0; step < ROAD_REACH && wave.length; step += 1) {
    const next = [];
    for (const i of wave) {
      for (const j of neighbours(i)) {
        if (reached[j] || !conducts(j)) continue;
        reached[j] = 1;
        next.push(j);
      }
    }
    wave = next;
  }

  return reached;
}

// One map per nation per day, thrown away when the ground changes under it.
const CACHE = new WeakMap();

/** The supply map, worked out once and kept until something moves. */
export function supplyFor(world, nation, day) {
  let per = CACHE.get(world);
  const stamp = `${nation}|${day}|${world.ownership.version}`;
  if (per?.stamp === stamp) return per.map;
  per = { stamp, map: supplyMap(world, nation, day) };
  CACHE.set(world, per);
  return per.map;
}

/** Can this nation get anything to this hex today? */
export function inSupply(world, nation, day, cell) {
  return supplyFor(world, nation, day)[cell] === 1;
}

/**
 * Everything of one nation's that is standing where nothing can reach it.
 *
 * Returned as casualty entries, which is what they are: a column out of supply
 * is losing men every day to nothing at all, and the record does not need a
 * second shape for it. They carry `starved` so a battle report can tell the
 * difference between a fight and a slow one.
 */
export function starvation({ world, day, positions, strengths }) {
  const out = [];
  const maps = new Map();
  for (const column of world.garrisons.opening) {
    const nation = column.formation.nation;
    const have = strengths.get(column.id);
    if (!have) continue;
    let any = 0;
    for (const arm of Object.keys(have)) any += have[arm];
    if (!any) continue;

    // A formation the order of battle puts on somebody else's ground never had
    // a line of supply to lose. The 8th Route Army is in the Shanxi hills
    // inside the Japanese occupation on purpose and lived off the country for
    // eight years; starving it for being where it is meant to be would be the
    // model punishing the data for telling the truth.
    if (column.formation.foreign) continue;

    const cell = positions.get(column.id) ?? column.cell;
    // On a ship, and therefore fed. A column at sea has the position of the
    // fleet carrying it, which is water; the supply map covers ground, so
    // without this every army afloat would starve on the crossing.
    if (world.ownership.owner[cell] === SEA) continue;

    if (!maps.has(nation)) maps.set(nation, supplyMap(world, nation, day));
    if (maps.get(nation)[cell]) continue;
    out.push({
      day,
      cell,
      starved: true,
      losers: [column.id],
      winners: [],
      loserShare: STARVATION,
      winnerShare: 0,
      nation,
    });
  }
  return out;
}
