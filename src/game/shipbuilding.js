import { NATION_INDEX } from '../world/nations.js';
import { yardAt } from '../world/shipyards.js';
import { COSTS, effortOf } from './production.js';
import { menAvailable } from './manpower.js';
import { inSupply } from './supply.js';

// Laying down a hull.
//
// Until now a fleet could only ever get smaller. Ships were sunk in fleet
// actions and convoys were sunk in the Atlantic and there was no answer to
// either, so the sea was a resource that ran one way — which is exactly
// backwards for this war. The naval war of 1939 was fought by fleets built
// before it; the naval war of 1944 was fought almost entirely by ships that
// did not exist when it started. Two hundred and thirty American destroyers
// and a hundred and fifty escort carriers are not a detail of that war, they
// are the reason it ended when it did.
//
// ---------------------------------------------------------------- the rules
//
// **A slip is the constraint, not steel.** A berth holding a battleship for
// three years is a berth not holding twelve destroyers, and that trade is the
// decision this whole system exists to offer. It is also the argument every
// naval staff in the war actually had, and the one Germany lost before it
// started: Plan Z needed berths that did not exist.
//
// **A capital ship needs a capital berth.** There were far fewer of those than
// of ordinary slips. Germany could lay down a battleship at three places on
// earth and the Soviet Union at two, one of which spent the war under siege.
//
// **Everything is paid on the day the keel is laid** — the steel, the plant
// and the crew — because that is when the contract is placed and the ratings
// are entered. The men in particular are gone for the whole build, which is
// where they were: a navy and an army drew on the same population and argued
// about it constantly.
//
// **The hull joins the nearest fleet of its own power** and then has to steam
// wherever it is wanted, like everything else on this board. A submarine joins
// the flotilla rather than the battle fleet, because the flotilla is a
// separate command and that is the whole reason it is a separate fleet.

/**
 * What a yard may lay down.
 *
 * Destroyers and submarines come in flotillas because that is how they were
 * ordered — nobody laid down one destroyer — and because one order ought to be
 * one decision worth making. A single boat would be a rounding error against a
 * navy of sixty.
 *
 * `days` is keel to commissioning, at wartime speed. The peacetime figures
 * were half again as long, and the American figures by 1944 were half of
 * these; this is the middle of a war and the numbers are the middle ones.
 */
export const HULLS = [
  {
    id: 'battleships',
    name: 'Battleship',
    hulls: 1,
    days: 1200,
    slips: 4,
    capital: true,
    crew: 1900,
    steel: 45,
    effort: 50000,
    note: 'Three and a half years, and it will not be here for the war you are fighting now.',
  },
  {
    id: 'carriers',
    name: 'Fleet Carrier',
    hulls: 1,
    days: 900,
    slips: 3,
    capital: true,
    crew: 2000,
    steel: 28,
    effort: 40000,
    note: 'Less steel than a battleship and more reach than any of them.',
  },
  {
    id: 'cruisers',
    name: 'Cruiser',
    hulls: 1,
    days: 600,
    slips: 2,
    capital: false,
    crew: 800,
    steel: 12,
    effort: 14000,
    note: 'The ship that has to be everywhere, which is why everybody ran out of them.',
  },
  {
    id: 'destroyers',
    name: 'Destroyer Flotilla',
    hulls: 4,
    days: 330,
    slips: 2,
    capital: false,
    crew: 1000,
    steel: 8,
    effort: 10000,
    note: 'Four of them, in under a year. This is what wins the Atlantic.',
  },
  {
    id: 'submarines',
    name: 'Submarine Flotilla',
    hulls: 4,
    days: 220,
    slips: 1,
    capital: false,
    crew: 200,
    steel: 3.6,
    effort: 5000,
    note: 'The cheapest hull in the war by every measure, and the deadliest per ton.',
  },
];

export const HULL_INDEX = Object.fromEntries(HULLS.map((h) => [h.id, h]));

/** Men a hull asks for: the ship's company, and it never comes back to the army. */
export function menIn(hull) {
  return Math.round((hull?.crew ?? 0) * (hull?.hulls ?? 1));
}

/** And what the stores must find. A warship is steel and almost nothing else. */
export function costOf(hull) {
  if (!hull) return {};
  const cost = { steel: hull.steel * hull.hulls };
  // The crew are equipped like anybody else, which is not nothing across two
  // thousand men.
  for (const [store, rate] of Object.entries(COSTS.infantry ?? {})) {
    cost[store] = (cost[store] ?? 0) + rate * menIn(hull);
  }
  return cost;
}

/** And what the factories must find. */
export function effortFor(hull) {
  return (hull?.effort ?? 0) * (hull?.hulls ?? 1) + effortOf({ infantry: menIn(hull) });
}

/** Is this yard out of action, and until when? */
export function yardOut(raids, cell, day) {
  let until = 0;
  for (const raid of raids ?? []) {
    if (raid.cell !== cell) continue;
    if (raid.day <= day && (raid.until ?? 0) > day) until = Math.max(until, raid.until);
  }
  return until;
}

/** Which keels are still on the stocks at a yard on a given day. */
export function onTheStocks(keels, yard, day) {
  return (keels ?? []).filter((k) => k.yard === yard && k.day <= day && k.ready > day);
}

/**
 * Berths free at a yard today.
 *
 * A yard put out of action by bombing has none. That is harsher than it is for
 * a steel works — which goes on making some steel — and it is meant to be: a
 * slipway with a hole in it launches nothing, and the whole reason to fly to
 * Kiel is that the hull on the stocks there stops moving.
 */
export function slipsFree(world, yard, keels, day, raids) {
  if (!yard) return 0;
  if (yardOut(raids, yard.cell, day)) return 0;
  const used = onTheStocks(keels, yard.id, day).reduce((n, k) => n + (k.slips ?? 0), 0);
  return Math.max(0, yard.slips - used);
}

/** Everything a power has on the stocks anywhere, for the panel that adds it up. */
export function buildingOn(keels, power, day) {
  return (keels ?? []).filter((k) => k.power === power && k.day <= day && k.ready > day);
}

/** And which have floated. */
export function commissionedBy(keels, day) {
  return (keels ?? []).filter((k) => k.ready <= day);
}

/**
 * May this seat lay this down here?
 *
 * Returns null if it may, or the sentence saying why not.
 */
export function mayLay({
  world,
  power,
  cell,
  hull,
  day,
  keels,
  raids,
  economy,
  capacity,
  replacements,
  raisings,
  spent,
  ordered,
  slips,
}) {
  if (!power) return 'Nobody is sitting at this seat.';
  if (!hull) return 'Nothing is selected to build.';
  if (cell === null || cell === undefined) return 'No hex is selected.';

  const yard = yardAt(world, cell);
  if (!yard) return 'There is no shipyard on this hex.';
  if (world.ownership.owner[cell] !== NATION_INDEX[power]) {
    return `${yard.name} is not yours.`;
  }
  if (!yard.berth) return `${yard.name} has no anchorage to hand a ship to.`;
  if (!inSupply(world, power, day, cell)) return `Nothing can be got to ${yard.name} to build with.`;

  const out = yardOut(raids, cell, day);
  if (out) return `${yard.name} is bombed out until day ${out}.`;

  if (hull.capital && !yard.capital) {
    return `${yard.name} has no berth long enough for a capital ship.`;
  }
  const free = (slips ?? slipsFree(world, yard, keels, day, raids)) - (ordered?.slips ?? 0);
  if (hull.slips > free) {
    return `${Math.max(0, free)} of ${yard.slips} slips are free; this needs ${hull.slips}.`;
  }

  // The crew, which came out of the same population as the infantry.
  const need = menIn(hull);
  const have = menAvailable(world, power, day, replacements, raisings, keels) - (ordered?.men ?? 0);
  if (need > have) {
    return `${Math.round(have).toLocaleString()} men are available; this needs ${need.toLocaleString()}.`;
  }

  if (economy) {
    for (const [store, amount] of Object.entries(costOf(hull))) {
      const index = economy.stores.findIndex((s) => s.id === store);
      if (index < 0) continue;
      const inHand = economy.stores[index].stock - (spent?.[store] ?? 0);
      if (amount > inHand) {
        return `not enough ${economy.stores[index].name.toLowerCase()} — ${Math.round(amount)} wanted, ${Math.round(Math.max(0, inHand))} in hand`;
      }
    }
  }

  if (capacity !== undefined && capacity !== null && effortFor(hull) > capacity) {
    return `the factories can find ${Math.round(capacity).toLocaleString()} plant-days today; this needs ${effortFor(hull).toLocaleString()}.`;
  }
  return null;
}

/**
 * A name for a hull, in the order its kind was ordered.
 *
 * Ships were named and classes were numbered, and a game that named them would
 * need six hundred names and a way to stop reusing HMS Hood. A batch number is
 * honest about what this is.
 */
export function nameFor(power, hull, existing) {
  const n = (existing ?? []).filter((k) => k.power === power && k.hull === hull.id).length + 1;
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? 'th' : { 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] ?? 'th';
  return `${n}${suffix} ${hull.name}`;
}

/** Which fleet a finished hull joins. */
export function berthFor(yard, hull) {
  if (!yard) return null;
  return hull?.id === 'submarines' ? (yard.boatBerth ?? yard.berth) : yard.berth;
}
