import { TILE_COUNT } from '../world/sphere.js';
import { NATION_INDEX } from '../world/nations.js';

// Men.
//
// The war economy has been half a model. Stores said whether the steel existed
// and the factories said whether anybody could turn it into rifles, and between
// them they decided everything — which meant a division cost 12 kilotonnes of
// steel and about a tenth of one day of Germany's industry, and nothing else at
// all. Nobody had to find the men.
//
// That is the wrong shortage. Steel was never what stopped Germany raising
// divisions in 1944; eighteen-year-olds were. Britain broke up whole divisions
// in 1944 to keep the others up to strength. The Red Army's replacement crisis
// of 1942 was a crisis of men and not of tanks.
//
// So there is now one pool, and two things draw on it: **replacing the
// formations you have, and raising new ones.** That is the trade, and it is the
// one every general staff in the war actually argued about.

/**
 * Men a million people yield in a day, at home.
 *
 * Set from what the war actually took out of each country. Germany mobilised
 * about 13.6 million over six years from a home population of 74 million, which
 * is seventy a million a day; the Soviet Union's 34 million from 216 million is
 * about the same; American conscription ran at very nearly the identical rate.
 * That three unlike states landed on one number is not a coincidence — it is
 * roughly what a twentieth-century industrial society can take out of itself
 * and still function.
 */
export const HOME_RECRUITS = 70;

/**
 * And what an empire yields, which is a twentieth of that.
 *
 * India raised two and a half million men, entirely by volunteering, from four
 * hundred and eighty-seven million people. A colony is not a manpower pool with
 * a bigger number on it: there was no conscription, no reserve system, and in
 * most places no intention of arming the population at all. Without this
 * distinction Britain recruits from 725 million and raises the largest army in
 * the history of the world, twice over.
 */
export const COLONIAL_RECRUITS = 3;

/**
 * What is already trained and waiting on the first morning.
 *
 * Thirty days' intake, which for Germany is the Ersatzheer — the replacement
 * army that existed precisely so that the field army did not have to wait for
 * the next class to be called up. Without an opening pool the first month of
 * the war has no replacements in it at all, which is not what any of these
 * countries looked like in September 1939.
 */
export const OPENING_DAYS = 30;

/** The country each power draws its own people from. */
export const HOMELAND = {
  usa: 'United States',
  uk: 'United Kingdom',
  ussr: 'Soviet Union',
  china: 'China',
  germany: 'Germany',
  italy: 'Italy',
  japan: 'Japan',
  france: 'France',
};

// Recruiting depends on the ground held and the ground changes, so this is
// keyed on the ownership version rather than kept for ever.
const CACHE = new WeakMap();

/**
 * Men a power can call up in a day.
 *
 * Counted over the ground it actually holds, so losing your own country costs
 * you the men in it — and taking somebody else's does not hand you theirs at
 * the home rate, because an occupied population is not a reserve.
 */
export function recruitsPerDay(world, power) {
  const seat = NATION_INDEX[power];
  if (seat === undefined) return 0;
  const stamp = `${power}|${world.ownership.version}`;
  let per = CACHE.get(world);
  if (per?.has(stamp)) return per.get(stamp);
  if (!per) {
    per = new Map();
    CACHE.set(world, per);
  }

  const home = HOMELAND[power];
  let ours = 0;
  let theirs = 0;
  for (let i = 0; i < TILE_COUNT; i += 1) {
    if (world.ownership.owner[i] !== seat) continue;
    const id = world.countryOf?.[i] ?? -1;
    const name = id >= 0 ? world.countries[id].name : null;
    if (name === home) ours += world.population[i];
    else theirs += world.population[i];
  }
  const rate = (ours * HOME_RECRUITS + theirs * COLONIAL_RECRUITS) / 1e6;
  per.set(stamp, rate);
  return rate;
}

/** Everyone a power has called up by a given day, including the opening class. */
export function menCalledUp(world, power, day) {
  return recruitsPerDay(world, power) * (day + OPENING_DAYS);
}

/**
 * And everyone it has already put somewhere.
 *
 * Both kinds of demand, from the two records that carry them: men sent forward
 * to bring a formation back up, and men found for a formation that did not
 * exist before.
 */
export function menSpent(power, day, replacements = [], raisings = []) {
  let spent = 0;
  for (const entry of replacements) {
    if (entry.power !== power || entry.day > day) continue;
    spent += entry.men ?? 0;
  }
  for (const entry of raisings) {
    if (entry.power !== power || entry.day > day) continue;
    spent += entry.men ?? 0;
  }
  return spent;
}

/** What is left to give out today. */
export function menAvailable(world, power, day, replacements = [], raisings = []) {
  return Math.max(0, menCalledUp(world, power, day) - menSpent(power, day, replacements, raisings));
}

/** The whole picture, for a panel that has to explain itself. */
export function manpowerFor(world, power, day, replacements = [], raisings = []) {
  const perDay = recruitsPerDay(world, power);
  const calledUp = menCalledUp(world, power, day);
  const spent = menSpent(power, day, replacements, raisings);
  return {
    perDay,
    calledUp,
    spent,
    available: Math.max(0, calledUp - spent),
  };
}
