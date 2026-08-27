import { TERRITORIES_1939 } from '../world/territories.js';
import { countryFor } from '../world/countries.js';
import { NATIONS, NATION_INDEX } from '../world/nations.js';
import { EVENTS_1939 } from './events.js';

// Who may fight whom, and from when.
//
// Nothing here is stored with the game. The state of the war on any day is
// replayed from the event list, which has two useful consequences: the answer
// can never drift out of step with the timeline, and an event added months from
// now applies correctly to a game already halfway through 1940.
//
// A party is either a power id — 'germany', 'uk' — or a country name, since a
// power can be at war with a country without being at war with the power that
// holds it. Poland on 1 September is exactly that case.
//
// This is the whole of the war so far. There are no orders and no movement:
// what the board knows is who may attack whom, and on what day that became
// true. The turn order falls out of the same table — see `entersOn`.

/**
 * Every country a power holds, from the territory table. Built once.
 *
 * A power's own metropolitan country is left out, because it is not a separate
 * party: 'france' the power and 'France' the country are one belligerent, and
 * listing both makes Germany's enemies on 3 September read as France twice.
 * This is exactly why the powers and the countries were given one name each.
 */
let ledCache = null;
function countriesLedBy(power) {
  if (ledCache === null) {
    ledCache = new Map();
    for (const territory of TERRITORIES_1939) {
      const home = NATIONS[NATION_INDEX[territory.owner]]?.name;
      const country = countryFor(territory);
      if (country === home) continue;
      if (!ledCache.has(territory.owner)) ledCache.set(territory.owner, new Set());
      ledCache.get(territory.owner).add(country);
    }
  }
  return ledCache.get(power) ?? new Set();
}

/** Is this party one of the eight, rather than a country somebody holds? */
export function isPower(party) {
  return party !== 'neutral' && NATION_INDEX[party] !== undefined;
}

/**
 * Order-independent key for a pair, so a war reads the same from either side.
 *
 * The separator is a character no country name can contain. A space would not
 * do: 'New Zealand' and 'Saudi Arabia' both have one, so a key built with a
 * space is ambiguous about where the first party ends. Nothing splits these
 * keys any more - the parties are carried beside them - but an ambiguous key
 * is a trap left lying about for whoever writes the next reader.
 */
const SEP = '\u0000';
function pairKey(a, b) {
  return a < b ? `${a}${SEP}${b}` : `${b}${SEP}${a}`;
}

/**
 * Expand a side of a war grant into the parties it actually covers.
 *
 * `sameAs` is resolved against the wars declared so far rather than the whole
 * timeline, which is what lets Italy in June 1940 inherit exactly the enemies
 * Germany had accumulated by then — no more, and no less.
 */
function resolveSide(side, wars) {
  if (side.power) return [side.power];
  if (side.country) return [side.country];
  if (side.ledBy) {
    const out = [];
    for (const power of side.ledBy) {
      out.push(power);
      for (const country of countriesLedBy(power)) out.push(country);
    }
    return out;
  }
  if (side.sameAs) {
    const out = [];
    for (const { a, b } of wars) {
      if (a === side.sameAs) out.push(b);
      else if (b === side.sameAs) out.push(a);
    }
    return out;
  }
  throw new Error(`unrecognised side: ${JSON.stringify(side)}`);
}

/**
 * Every war the timeline ever declares, in the order it declares them.
 *
 * The whole list is replayed once and cached, because the events are fixed and
 * a game asks this question on every frame. Walking it in order is what keeps
 * `sameAs` honest: when Italy's row is reached, the wars ahead of it in the
 * list are exactly the wars that existed on 10 June 1940.
 *
 * @returns {Array<{ day: number, a: string, b: string, event: string }>}
 */
let declaredCache = null;
function declared() {
  if (declaredCache) return declaredCache;
  const seen = new Set();
  const out = [];
  for (const event of EVENTS_1939) {
    for (const [left, right] of event.wars) {
      const sides = [resolveSide(left, out), resolveSide(right, out)];
      for (const x of sides[0]) {
        for (const y of sides[1]) {
          if (x === y) continue;
          const key = pairKey(x, y);
          if (seen.has(key)) continue;
          seen.add(key);
          out.push({ day: event.day, a: x, b: y, event: event.id });
        }
      }
    }
  }
  declaredCache = out;
  return out;
}

/** The set of wars in force on a given day, as pair keys. */
export function warsAt(day) {
  const wars = new Set();
  for (const war of declared()) {
    if (war.day <= day) wars.add(pairKey(war.a, war.b));
  }
  return wars;
}

/** May these two fight on this day? Parties are power ids or country names. */
export function mayFight(day, a, b) {
  return warsAt(day).has(pairKey(a, b));
}

/** Everything a party may fight on this day, sorted for a stable display. */
export function enemiesOf(day, party) {
  const out = [];
  for (const war of declared()) {
    if (war.day > day) continue;
    if (war.a === party) out.push(war.b);
    else if (war.b === party) out.push(war.a);
  }
  return out.sort();
}

/**
 * The day each party first has anybody to fight, from the whole timeline —
 * including days still in the future, which is how the board can say when a
 * power that is still watching will be let in.
 */
let entryCache = null;
function entryDays() {
  if (entryCache) return entryCache;
  entryCache = new Map();
  for (const { day, a, b } of declared()) {
    for (const party of [a, b]) {
      if (!entryCache.has(party) || entryCache.get(party) > day) entryCache.set(party, day);
    }
  }
  return entryCache;
}

/** The day this party enters the war, or null if the timeline never lets it in. */
export function entersOn(party) {
  return entryDays().get(party) ?? null;
}

/**
 * Is this party in the war on this day?
 *
 * This is the whole of the turn rule. A power with nobody to fight has nothing
 * to decide, so it watches the day go by rather than voting on the end of it.
 */
export function isActive(day, party) {
  const entry = entersOn(party);
  return entry !== null && day >= entry;
}

/**
 * A short summary per power, for the HUD: whether it is in the
 * war yet, when it gets in, and against how much. Powers are listed whether or
 * not anyone is playing them.
 */
export function warSummary(day, powers) {
  return powers.map((power) => {
    const enemies = enemiesOf(day, power);
    return {
      power,
      atWar: enemies.length > 0,
      active: isActive(day, power),
      entersOn: entersOn(power),
      enemies,
      // The other seven are what a player actually looks for first; the long
      // tail of countries is everything their empires bring with them.
      powers: enemies.filter(isPower),
    };
  });
}
