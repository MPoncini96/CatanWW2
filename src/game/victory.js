import { TILE_COUNT } from '../world/sphere.js';
import { NATIONS, NATION_INDEX, SEA } from '../world/nations.js';
import { capitalCell } from '../world/capitals.js';
import { civilianDead } from './bombing.js';

// How the war ends.
//
// Until now it could not. Every other rule decides a hex, a day, a country;
// none of them decides the game, and a nation reduced to nothing simply held no
// hexes and went on being asked for orders. This is the answer to that.
//
// The shape is deliberately asymmetric, because the war was. **An Axis power is
// finished when its own capital falls.** An Allied one is not: losing London
// does not end Britain, and losing Moscow did not end the Soviet Union in any
// of the years it nearly happened. The Allies lose by being comprehensively
// beaten — every western capital *and* China, or the American seaboard — which
// is a far higher bar and ought to be.

/** How much of Japan's people have to die under the bombers. */
export const JAPAN_BOMBING_TOLL = 0.005;

/** Which side a power is on. */
export function sideOf(power) {
  return NATIONS.find((n) => n.id === power)?.side ?? null;
}

/** Is this cell held by somebody on the given side? */
function heldBySide(world, cell, side) {
  const owner = world.ownership.owner[cell];
  if (owner === undefined || owner === SEA) return false;
  return NATIONS[owner]?.side === side;
}

/** The cell a named city sits on. */
export function cityCell(world, name) {
  const cities = world.cities ?? [];
  for (let i = 0; i < cities.length; i += 1) {
    if (cities[i].name === name) return cities[i].index ?? cities[i].cell ?? null;
  }
  return null;
}

/** How many hexes a nation still holds. */
export function hexesHeld(world, power) {
  const seat = NATION_INDEX[power];
  if (seat === undefined) return 0;
  let count = 0;
  for (let i = 0; i < TILE_COUNT; i += 1) if (world.ownership.owner[i] === seat) count += 1;
  return count;
}

/**
 * Every hex belonging to a named country.
 *
 * Cached per world, because the standings ask this four times and the standings
 * go out with every broadcast — four walks of 114,492 cells on every keystroke
 * somebody makes anywhere in the game. Which country a hex *is* never changes;
 * only who holds it does, and that is read separately.
 */
const COUNTRY_CELLS = new WeakMap();

export function countryHexes(world, name) {
  let cache = COUNTRY_CELLS.get(world);
  if (!cache) {
    cache = new Map();
    COUNTRY_CELLS.set(world, cache);
  }
  const had = cache.get(name);
  if (had) return had;

  const ids = new Set();
  for (const country of world.countries ?? []) if (country.name === name) ids.add(country.id);
  const cells = [];
  for (let i = 0; i < TILE_COUNT; i += 1) {
    if (ids.has(world.countryOf?.[i] ?? -1)) cells.push(i);
  }
  cache.set(name, cells);
  return cells;
}

/** Every hex a nation holds right now. Not cached: this is the thing that moves. */
export function heldCells(world, power) {
  const seat = NATION_INDEX[power];
  const cells = [];
  if (seat === undefined) return cells;
  for (let i = 0; i < TILE_COUNT; i += 1) if (world.ownership.owner[i] === seat) cells.push(i);
  return cells;
}

/** Does the given side hold every hex of a named country? */
export function holdsAllOf(world, name, side) {
  const cells = countryHexes(world, name);
  if (!cells.length) return false;
  return cells.every((cell) => heldBySide(world, cell, side));
}

/**
 * Is each Axis power finished, and why?
 *
 * Order matters here: Germany is decided first, because Italy's fate hangs on
 * it. That is not a shortcut — it is what happened. Italy was a junior partner
 * whose war depended entirely on German strength, and it left the war the
 * moment that strength stopped covering it.
 */
export function defeats(world, game) {
  const raids = game?.raids ?? [];
  const out = {};

  // ---- Germany: Berlin -------------------------------------------------
  const berlin = capitalCell('germany');
  out.germany = heldBySide(world, berlin, 'allies')
    ? { defeated: true, why: 'Berlin has fallen' }
    : { defeated: false, why: null };

  // ---- Italy: Sicily, or Germany ----------------------------------------
  // Sicily rather than Rome, because Sicily is what actually did it. Husky
  // landed on 10 July 1943; Mussolini was deposed on the 25th and the armistice
  // signed on 3 September, with Rome still in German hands and staying there
  // for another nine months. Losing Sicily was the moment Italy stopped being
  // a belligerent, and Rome was never the point.
  const sicily = holdsAllOf(world, 'Sicily', 'allies');
  out.italy = sicily
    ? { defeated: true, why: 'Sicily is lost, and with it the government' }
    : out.germany.defeated
      ? { defeated: true, why: 'Germany is beaten, and Italy cannot fight on alone' }
      : { defeated: false, why: null };

  // ---- Japan: Tokyo, or the mainland and the cities ---------------------
  const tokyo = capitalCell('japan');
  const people = peopleOf(world, 'Japan');
  const dead = civilianDead(raids, 'japan');
  const toll = people > 0 ? dead / people : 0;
  const mainlandGone =
    !hasAnyOf(world, 'Manchukuo', 'japan') && !hasAnyOf(world, 'Occupied China', 'japan');

  if (heldBySide(world, tokyo, 'allies')) {
    out.japan = { defeated: true, why: 'Tokyo has fallen' };
  } else if (mainlandGone && toll >= JAPAN_BOMBING_TOLL) {
    out.japan = {
      defeated: true,
      why:
        `the mainland is lost and ${Math.round(dead / 1000)},000 civilians are dead ` +
        `under the bombing — ${(toll * 100).toFixed(2)}% of the nation`,
    };
  } else {
    out.japan = {
      defeated: false,
      why: null,
      // Shown while it is still running, because a condition nobody can see the
      // progress of is a condition nobody will play towards.
      mainlandGone,
      dead,
      toll,
      // The bar itself, sent rather than left for the browser to reconstruct
      // from a ratio — which it could, badly.
      needed: Math.round(people * JAPAN_BOMBING_TOLL),
      people: Math.round(people),
    };
  }

  return out;
}

/**
 * The people of a named country, as the board was built.
 *
 * Deliberately a country and not a nation. Summing everyone on Japanese-owned
 * ground gives 277 million, because that counts Korea, Formosa, Manchukuo and
 * occupied China — and it would then *shrink* as Japan lost them, which would
 * make the bombing bar move while somebody was climbing it. The home islands
 * are a fixed 72 million and stay 72 million however the war goes.
 */
export function peopleOf(world, country) {
  let people = 0;
  for (const cell of countryHexes(world, country)) people += world.population[cell];
  return people;
}

/** Does a power still hold any part of a named country? */
function hasAnyOf(world, name, power) {
  const seat = NATION_INDEX[power];
  return countryHexes(world, name).some((cell) => world.ownership.owner[cell] === seat);
}

/**
 * Has anybody won?
 *
 * @returns {null | {side, why, at}} null while the war is still going.
 */
export function victory(world, game) {
  const beaten = defeats(world, game);

  // ---- the Allies, by finishing all three -------------------------------
  if (beaten.germany.defeated && beaten.italy.defeated && beaten.japan.defeated) {
    return {
      side: 'allies',
      why: 'Germany, Italy and Japan are all beaten',
      detail: [beaten.germany.why, beaten.italy.why, beaten.japan.why],
    };
  }

  // ---- the Axis, by taking Europe and China -----------------------------
  // Four things, and China is the hard one: not a capital but a whole country,
  // because China's government had already lost its capital twice by 1939 and
  // gone on fighting from further up the Yangtze. There is no one city whose
  // loss ends China, which is exactly why Japan was still there in 1945.
  const capitals = [
    ['Paris', capitalCell('france')],
    ['London', capitalCell('uk')],
    ['Moscow', capitalCell('ussr')],
  ];
  const takenCapitals = capitals.filter(([, cell]) => heldBySide(world, cell, 'axis'));
  const chinaGone = hexesHeld(world, 'china') === 0;
  if (takenCapitals.length === capitals.length && chinaGone) {
    return {
      side: 'axis',
      why: 'Paris, London and Moscow are taken and China has ceased to exist',
      detail: capitals.map(([name]) => `${name} is held`),
    };
  }

  // ---- or by reaching America -------------------------------------------
  const american = ['San Francisco', 'Los Angeles', 'New York'];
  const cells = american.map((name) => [name, cityCell(world, name)]);
  const reached = cells.filter(([, cell]) => cell !== null && heldBySide(world, cell, 'axis'));
  if (reached.length === american.length) {
    return {
      side: 'axis',
      why: 'the Axis stands in San Francisco, Los Angeles and New York',
      detail: american.map((name) => `${name} is held`),
    };
  }

  return null;
}

/**
 * Everything a player needs to see about how close the end is.
 *
 * Sent with the public state rather than worked out in the browser, so the
 * scoreboard and the rule that ends the game are the same answer and not two.
 */
export function standings(world, game) {
  const beaten = defeats(world, game);
  const capitals = [
    ['Paris', capitalCell('france')],
    ['London', capitalCell('uk')],
    ['Moscow', capitalCell('ussr')],
  ];
  const american = ['San Francisco', 'Los Angeles', 'New York'];
  return {
    axis: {
      germany: beaten.germany,
      italy: beaten.italy,
      japan: beaten.japan,
    },
    allies: {
      capitals: capitals.map(([name, cell]) => ({
        name,
        lost: heldBySide(world, cell, 'axis'),
      })),
      china: hexesHeld(world, 'china'),
      cities: american.map((name) => {
        const cell = cityCell(world, name);
        return { name, lost: cell !== null && heldBySide(world, cell, 'axis') };
      }),
    },
    over: victory(world, game),
  };
}
