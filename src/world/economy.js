import { TILE_COUNT } from './sphere.js';
import { NATION_INDEX, SEA } from './nations.js';
import { RESOURCES, RESOURCE_INDEX } from './resources.js';
import { UNITS } from './forces.js';
import { SHIPS } from './navies.js';

// What a nation has, what it takes in, and what it burns keeping the machine
// running.
//
// Three numbers per resource, and the third is the one that decides wars. A
// country's output is public and its stores are not far behind, but the gap
// between what comes in and what an army and a fleet consume standing still is
// what put Germany into Romania and Japan into the Indies.
//
// Nothing here is stored with the game. Stores are the opening figure plus the
// net of every day since, which is a pure function of the date — the same trick
// the belligerence table uses, and for the same reason: a number that is
// derived cannot drift out of step with the thing it is derived from. When
// orders arrive and a player can spend, this is what moves to the server.

/**
 * Stores on hand, 1 September 1939, in the unit each resource is kept in —
 * thousands of tonnes for oil, ore and steel, tonnes for aluminium and rubber.
 *
 * These are the strategic reserves, not the year's production. Germany opened
 * the war with about three months of oil and a rubber stock that would not have
 * shod its lorries for a season; Japan was sitting on two years of fuel for the
 * fleet and had been hoarding since 1937. Those two rows are most of why the
 * war went where it did.
 */
export const STOCKPILES_1939 = {
  usa: { oil: 25000, iron: 12000, steel: 6000, aluminium: 90000, rubber: 200000 },
  uk: { oil: 5500, iron: 4000, steel: 2000, aluminium: 40000, rubber: 120000 },
  france: { oil: 3000, iron: 5000, steel: 1200, aluminium: 25000, rubber: 60000 },
  ussr: { oil: 4000, iron: 6000, steel: 2500, aluminium: 20000, rubber: 30000 },
  china: { oil: 100, iron: 200, steel: 50, aluminium: 1000, rubber: 2000 },
  germany: { oil: 2400, iron: 3000, steel: 1500, aluminium: 60000, rubber: 15000 },
  italy: { oil: 1800, iron: 800, steel: 500, aluminium: 30000, rubber: 20000 },
  japan: { oil: 5300, iron: 2000, steel: 1500, aluminium: 25000, rubber: 40000 },
};

/**
 * What a day of standing still costs, per unit.
 *
 * Not fighting — existing. Engines are run, tracks and airframes wear out,
 * shells are fired on ranges, and men are drafted through to replace those
 * leaving. Oil and steel are in kt, aluminium and rubber in tonnes, so the
 * numbers look small; multiplied by three million men they are not.
 *
 * Infantry is priced per thousand men, everything else per machine or hull.
 */
export const UPKEEP = {
  // Per 1,000 men: rations move by lorry, and rifles wear out.
  infantry: { oil: 0.003, steel: 0.002 },
  tanks: { oil: 0.0004, steel: 0.0002, rubber: 0.004 },
  artillery: { steel: 0.0001 },
  fighters: { oil: 0.0006, aluminium: 0.02, rubber: 0.002 },
  bombers: { oil: 0.002, aluminium: 0.06, rubber: 0.004 },
  // Per hull. A capital ship alongside still burns oil for steam and power.
  battleships: { oil: 0.06, steel: 0.004 },
  carriers: { oil: 0.05, steel: 0.004, aluminium: 0.4 },
  cruisers: { oil: 0.02, steel: 0.002 },
  destroyers: { oil: 0.008, steel: 0.0006 },
  submarines: { oil: 0.004, steel: 0.0003 },
};

/** Ship's company, for counting how many of a nation's men are at sea. */
const CREW = {
  battleships: 1200,
  carriers: 1400,
  cruisers: 700,
  destroyers: 180,
  submarines: 50,
};

const DAYS_IN_YEAR = 365;

/** Past this, a falling store is not a shortage anybody has to plan around. */
const HORIZON = 3 * DAYS_IN_YEAR;

/** A daily rate, which in kt is usually a fraction, so it is shown in tonnes. */
export function formatPerDay(value, unit) {
  if (!value) return '—';
  if (unit === 'kt/yr') {
    if (value >= 100) return `${Math.round(value)} kt`;
    if (value >= 1) return `${value.toFixed(1)} kt`;
    return `${Math.round(value * 1000)} t`;
  }
  if (value >= 10) return `${Math.round(value)} t`;
  return `${value.toFixed(1)} t`;
}

/** Everything a nation holds, earns and burns, on a given day. */
export function economyFor(world, power, day, spent = {}) {
  const nation = NATION_INDEX[power];
  const owner = world.ownership.owner;

  // ---- what the ground it holds produces, and who lives on it ------------
  const output = RESOURCES.map(() => 0);
  let people = 0;
  for (let i = 0; i < TILE_COUNT; i += 1) {
    if (owner[i] !== nation || owner[i] === SEA) continue;
    people += world.population[i];
    for (let r = 0; r < RESOURCES.length; r += 1) output[r] += world.resources[r][i];
  }

  // ---- what it keeps under arms ------------------------------------------
  const forces = world.forcesByNation?.[power]?.deployed ?? UNITS.map(() => 0);
  const armed = Object.fromEntries(UNITS.map((u, k) => [u.id, forces[k]]));
  const fleet = { ...(world.navies?.byPower?.[power] ?? {}) };
  let sailors = 0;
  for (const ship of SHIPS) sailors += (fleet[ship.id] ?? 0) * CREW[ship.id];

  // ---- what a day of it costs --------------------------------------------
  const upkeep = RESOURCES.map(() => 0);
  const charge = (id, count, scale = 1) => {
    const rates = UPKEEP[id];
    if (!rates || !count) return;
    for (const [resource, rate] of Object.entries(rates)) {
      upkeep[RESOURCE_INDEX[resource]] += rate * count * scale;
    }
  };
  charge('infantry', armed.infantry / 1000);
  charge('tanks', armed.tanks);
  charge('artillery', armed.artillery);
  charge('fighters', armed.fighters);
  charge('bombers', armed.bombers);
  for (const ship of SHIPS) charge(ship.id, fleet[ship.id] ?? 0);

  // ---- and where that leaves the stores today ----------------------------
  const opening = STOCKPILES_1939[power] ?? {};
  const stores = RESOURCES.map((resource, r) => {
    const income = output[r] / DAYS_IN_YEAR;
    const spend = upkeep[r];
    const net = income - spend;
    const stock = Math.max(0, (opening[resource.id] ?? 0) + net * day - (spent[resource.id] ?? 0));
    return {
      id: resource.id,
      name: resource.name,
      unit: resource.unit,
      color: resource.color,
      stock,
      income,
      upkeep: spend,
      net,
      // How long the stores last at today's rate — the only number on this
      // panel that ever decided anything. Beyond three years it is not a
      // shortage, it is a rounding error with a long tail, and saying "38,000
      // days" would make the number that matters look like the others.
      daysLeft:
        net < 0 && stock > 0 && stock / -net <= HORIZON ? Math.floor(stock / -net) : null,
    };
  });

  return {
    power,
    stores,
    // Men under arms: the army as mobilised, plus every ship's company.
    military: armed.infantry + sailors,
    soldiers: armed.infantry,
    sailors,
    civilian: Math.max(0, people - armed.infantry - sailors),
    people,
    machines: {
      tanks: armed.tanks,
      artillery: armed.artillery,
      aircraft: armed.fighters + armed.bombers,
      hulls: fleet.hulls ?? 0,
    },
  };
}
