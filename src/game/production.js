import { ACCESS } from '../world/deploy.js';
import { RESOURCES } from '../world/resources.js';

// Replacements.
//
// A formation that has been fought over comes out of it at sixty per cent, and
// seven days of losing badly leaves five. Without a way to put men back, a war
// here ends in mutual exhaustion rather than a decision — which is not how any
// of the armies of 1939 worked. They rebuilt divisions, endlessly, out of the
// draft and the factories, and the side that could do it faster won.
//
// So: **you rebuild what you have, and never invent anything new.** A column is
// restored towards the strength its formation deployed with and not one man
// past it. That keeps the order of battle meaning something — 178 formations
// stays 178 — and it is what actually happened: the 4th Army was rebuilt four
// times and was the 4th Army each time. Raising new formations is a different
// thing and can be a different feature.
//
// Like everything else here, replacements are a line in the record rather than
// a number that gets edited. A column is what it deployed with, less what the
// battles took, plus what the factories put back — worked out again from the
// record every time it is asked for.

/**
 * What one of each costs, in the units the stores are kept in.
 *
 * Tonnes of steel for the things made of steel, tonnes of aluminium for the
 * things that have to fly, and rubber for anything with wheels. A Panzer III
 * weighed twenty tonnes and a Bf 109 about two, most of it alloy; the rest is
 * scaled off those two so the ratios read right even where the absolute figures
 * are rough.
 */
// NOTE the units, which are not the same for every store: oil, iron and steel
// are kept in kilotonnes and aluminium and rubber in tonnes, because that is
// how the outputs of 1939 were published and it is what the economy already
// carries. So a tank costs 0.025 — twenty-five tonnes of steel — and a fighter
// costs 2.5, which is two and a half tonnes of aluminium.
export const COSTS = {
  infantry: { steel: 0.0008, rubber: 0.002 },
  tanks: { steel: 0.025, rubber: 2 },
  artillery: { steel: 0.006, rubber: 0.2 },
  fighters: { aluminium: 2.5, rubber: 0.4 },
  bombers: { aluminium: 8, rubber: 1.2 },
};

/**
 * How much of itself a column can get back in a day, by what can reach it.
 *
 * A depot on a railhead turns replacements round in a week; a column at the end
 * of a track does not. This is the lever that decides whether the model works
 * at all: rebuild to full every day and defending costs nothing and nothing is
 * ever decided.
 */
export const REBUILD_RATE = { [ACCESS.RAIL]: 0.04, [ACCESS.ROAD]: 0.015, [ACCESS.NONE]: 0 };

/** Men are drawn from the civilians of the ground a nation holds. */
export const CREW = { infantry: 1, tanks: 4, artillery: 6, fighters: 2, bombers: 5 };

const ARMS = ['infantry', 'tanks', 'artillery', 'fighters', 'bombers'];

/** The stores, by the id the economy knows them by. */
const STORE_INDEX = Object.fromEntries(RESOURCES.map((r, i) => [r.id, i]));

/**
 * What it would cost to bring this column back up, and how far it can get.
 *
 * @returns {{added: object, cost: object, men: number, share: number}|null}
 */
export function replacementFor({ world, column, have, day }) {
  const rate = REBUILD_RATE[world.garrisons.access[column.cell]] ?? 0;
  if (!rate) return null;

  const full = column.strength;
  const added = {};
  const cost = {};
  let men = 0;
  let anything = 0;

  for (const arm of ARMS) {
    const want = full[arm] ?? 0;
    if (!want) continue;
    const short = want - (have[arm] ?? 0);
    if (short <= 0) continue;
    // A day's worth, measured against what the formation is meant to be rather
    // than against what is left of it — otherwise a column ground down to
    // nothing would rebuild at nothing a day and never come back at all.
    const n = Math.min(short, Math.max(1, Math.floor(want * rate)));
    if (n <= 0) continue;
    added[arm] = n;
    anything += n;
    men += n * (CREW[arm] ?? 1);
    for (const [store, each] of Object.entries(COSTS[arm] ?? {})) {
      cost[store] = (cost[store] ?? 0) + n * each;
    }
  }
  if (!anything) return null;
  void day;
  return { added, cost, men, share: rate };
}

/** Everything a nation has spent on replacements up to and including a day. */
export function spentBy(replacements, power, day) {
  const spent = {};
  let men = 0;
  for (const entry of replacements) {
    if (entry.day > day) break;
    if (entry.power !== power) continue;
    for (const [store, amount] of Object.entries(entry.cost ?? {})) {
      spent[store] = (spent[store] ?? 0) + amount;
    }
    men += entry.men ?? 0;
  }
  return { stores: spent, men };
}

/**
 * Can this nation pay for these replacements today?
 *
 * Checked against what it actually has in hand, which is the opening stock plus
 * every day's net since, less everything it has already spent. The stores were
 * derived from the calendar before anybody could spend them; this keeps them
 * derived and adds a second term rather than starting to store a balance.
 */
export function canAfford(economy, cost, alreadySpent = {}) {
  for (const [store, amount] of Object.entries(cost)) {
    const index = STORE_INDEX[store];
    if (index === undefined) return `there is no such thing as ${store}`;
    const have = (economy.stores[index]?.stock ?? 0) - (alreadySpent[store] ?? 0);
    if (have < amount) {
      return `not enough ${economy.stores[index].name.toLowerCase()} — ${Math.round(amount)} wanted, ${Math.round(Math.max(0, have))} in hand`;
    }
  }
  return null;
}

/**
 * What is left of every column once the factories have had their say.
 *
 * Applied after the battles, and capped at the strength the formation deployed
 * with: a rebuilt division is the division again, never more of one.
 */
export function applyReplacements(left, placements, replacements, day) {
  const full = new Map(placements.map((p) => [p.id, p.strength]));
  for (const entry of replacements) {
    if (entry.day > day) break;
    const have = left.get(entry.column);
    const cap = full.get(entry.column);
    if (!have || !cap) continue;
    for (const [arm, n] of Object.entries(entry.added ?? {})) {
      have[arm] = Math.min(cap[arm] ?? 0, (have[arm] ?? 0) + n);
    }
  }
  return left;
}
