import { TILE_COUNT, neighbours } from '../world/sphere.js';
import { NATION_INDEX, NATIONS, SEA } from '../world/nations.js';
import { enemiesOf, mayFight } from './belligerence.js';
import { isMobile, mayMarch } from './movement.js';
import { groundBonus, strengthOf } from './combat.js';
import { supplyFor } from './supply.js';
import { TEMPLATE_INDEX, menIn as menInTemplate } from './raising.js';

// The staff that runs a power nobody is sitting at.
//
// Everything else on this board assumed seven players who all turn up. An
// unseated power did nothing whatever: it never marched, never attacked, never
// asked the depots for a man and never laid a keel. What it *did* do was
// defend — a garrison fights when it is attacked, flak fires, fighters come up,
// and a fleet fights anybody who sails into it — so the board defended itself
// competently and never once acted.
//
// The result was that a solo game is a march against a statue, and the
// alternative, seven humans on a daily clock, is not a thing that happens.
//
// ---------------------------------------------------------------- the rules
//
// **It plays by the rules a player plays by.** Every order the staff gives goes
// through `mayMarch` exactly as a ticked box does, and anything it refuses the
// staff does not do. There is no path here to a move a human could not have
// made, which is the property that makes the whole thing safe to leave running.
//
// **It masses, then attacks.** A column with nothing better to do walks towards
// the fighting and stops at the line — that rule already existed and is what
// puts weight on a frontier. The staff adds the other half: when the weight on
// a hex is enough, it goes forward. So an unseated power gathers divisions
// against a border for a week and then attacks, which is what a staff does.
//
// **It does not fly, sail, or land.** Those are the three things an automaton
// looks stupid doing, and leaving them out is honest: an unseated navy sitting
// in port is defensible, one blundering into the Atlantic is not.

/**
 * Odds the staff wants before it goes forward.
 *
 * Attacking strength against defending strength with the ground already
 * counted, so this is on top of whatever the terrain is worth — two to one on
 * a plain and nearer four to one into mountains.
 *
 * Measured rather than argued, and the measurement was a surprise. Twenty-five
 * days of a board playing itself, counting the battles a staff attack started
 * and how they went:
 *
 * | odds wanted | attacks made | won | cost to the attacker |
 * | --- | --- | --- | --- |
 * | 1.5 | 68 | 84% | 8.2% |
 * | 2 | 71 | 83% | 8.0% |
 * | 3 | 53 | 85% | 7.2% |
 *
 * Raising the bar buys almost nothing and costs a third of the attacks, which
 * says the win rate is decided by the great majority of attacks being onto
 * weakly-held ground rather than by the marginal one. Two is the middle, and an
 * army that will not attack until it is certain never attacks at all.
 */
export const ODDS = 2;

/**
 * How depleted a formation has to be before the staff asks for men.
 *
 * Not every scratch. A division at ninety-five per cent is a division, and
 * putting it at the head of the queue takes the replacements away from the one
 * at forty that needs them.
 */
export const WORN = 0.9;

/**
 * And how much manpower the staff keeps in hand before raising anything new.
 *
 * Four divisions' worth. Raising is charged before replacements on the same
 * day, so a staff that spent the pool the moment it had enough for one
 * division would never rebuild anything it already had — which is the trade
 * every general staff in the war argued about, and the wrong side of it.
 */
export const IN_HAND = 4;

/**
 * And how many formations it asks the depots for in a morning.
 *
 * The day rations replacements by stores and by factory hours long before it
 * gets near the end of a queue this long, so everything past the cap is work
 * done to produce the same answer. Uncapped it took a day from seven hundred
 * milliseconds to a second, for nothing.
 */
export const QUEUE = 40;

/**
 * What to call whoever holds a hex, as the war table knows them.
 *
 * The pooled neutral is thirty countries and the table does not carry it as a
 * party, so a neutral hex is named by its country: Poland is Independent ground
 * and it is also the reason the war started.
 */
export function partyHolding(world, cell) {
  const held = world.ownership.owner[cell];
  if (held === undefined || held === SEA) return null;
  const nation = NATIONS[held]?.id;
  if (!nation) return null;
  if (nation !== 'neutral') return nation;
  const country = world.countryOf?.[cell] ?? -1;
  return country >= 0 ? world.countries[country].name : null;
}

/**
 * The country a formation belongs to, which is not where it is standing.
 *
 * Read from the hex it was raised on rather than the one it is on today, so a
 * Polish division that has fallen back over its own border is still Polish.
 * `countryOf` is the map of 1939 and never moves, which is what makes this
 * stable enough to replay.
 */
export function homeCountry(world, column) {
  return world.countryOf?.[column.cell] ?? -1;
}

/**
 * Every force that needs a staff today.
 *
 * The seven seats that nobody is sitting at, and — separately — each neutral
 * country that is actually in the war. The second list is deliberately short:
 * there are thirty-odd neutral countries and walking the whole board for each
 * of them every morning would cost more than the rest of the day put together,
 * so a country nobody is fighting is left alone, which is also what it did.
 */
export function forcesNeedingStaff(world, game, day) {
  const out = [];
  for (const power of Object.keys(game.seats ?? {})) {
    if (game.seats[power]) continue;
    out.push({ power, country: -1, party: power });
  }
  // Only the neutrals with somebody to fight *and* something to fight with.
  //
  // Both halves matter. Most country names on this board belong to a seated
  // nation — 'Germany' the country is held by 'germany' the nation — and a
  // country with no neutral ground left has nothing for a staff to move. The
  // first version left them all in, put sixty-one forces on duty where five had
  // an army, and spent the difference walking the whole board for each.
  const neutral = NATION_INDEX.neutral;
  const ground = new Int32Array(world.countries?.length ?? 0);
  for (let i = 0; i < TILE_COUNT; i += 1) {
    if (world.ownership.owner[i] !== neutral) continue;
    const country = world.countryOf[i];
    if (country >= 0) ground[country] += 1;
  }
  const seen = new Set();
  for (let i = 0; i < (world.countries?.length ?? 0); i += 1) {
    const name = world.countries[i].name;
    if (seen.has(name)) continue;
    seen.add(name);
    if (!ground[i]) continue;
    if (!enemiesOf(day, name).length) continue;
    out.push({ power: 'neutral', country: i, party: name });
  }
  return out;
}

/**
 * The hexes this force is holding, as a mask.
 *
 * A seat holds everything its nation owns. A country holds only what is both
 * neutral ground and its own — so ground Germany has taken off Poland stops
 * being Poland's the day it changes hands, which is the whole point.
 */
export function holdings(world, power, country) {
  const owner = world.ownership.owner;
  const seat = NATION_INDEX[power];
  const mine = new Uint8Array(TILE_COUNT);
  if (seat === undefined) return mine;
  const countryOf = world.countryOf;
  for (let i = 0; i < TILE_COUNT; i += 1) {
    if (owner[i] !== seat) continue;
    if (country >= 0 && countryOf[i] !== country) continue;
    mine[i] = 1;
  }
  return mine;
}

/**
 * The kinds of formation a staff moves.
 *
 * The same two the standing order uses, and for the same reason. A depot is
 * supply and marching it forward breaks the web behind the army that needs it —
 * the first version of this moved depots and starved forty-three island
 * garrisons on the first morning. An air group is an aerodrome and belongs on
 * one. Rear-area security is holding the rear areas.
 *
 * Everything left out here still defends the hex it is standing on, which is
 * what all of it was for.
 */
export const MANOEUVRE = new Set(['field', 'armor']);

/** Every column this force can give marching orders to. */
export function forcesOf(world, power, country) {
  const out = [];
  for (const column of world.garrisons.opening) {
    if (column.formation.nation !== power) continue;
    if (!MANOEUVRE.has(column.formation.type)) continue;
    if (country >= 0 && homeCountry(world, column) !== country) continue;
    out.push(column);
  }
  return out;
}

/**
 * How far every hex of this force's ground is from somebody it is fighting.
 *
 * The same breadth-first walk inward from the contact line that a seated power
 * gets, over a mask rather than over a nation, so a country can have one too.
 *
 * @returns {Int32Array} hexes from the front, or -1 where there is no way there
 */
export function frontFrom(world, mine, party, day) {
  const far = new Int32Array(TILE_COUNT).fill(-1);
  let wave = [];
  for (let i = 0; i < TILE_COUNT; i += 1) {
    if (!mine[i]) continue;
    for (const j of neighbours(i)) {
      if (mine[j]) continue;
      const them = partyHolding(world, j);
      if (!them || !mayFight(day, party, them)) continue;
      far[i] = 0;
      wave.push(i);
      break;
    }
  }
  let step = 0;
  while (wave.length) {
    step += 1;
    const next = [];
    for (const i of wave) {
      for (const j of neighbours(i)) {
        if (!mine[j] || far[j] !== -1) continue;
        far[j] = step;
        next.push(j);
      }
    }
    wave = next;
  }
  return far;
}

/**
 * Everything on the board, indexed by the hex it is standing on.
 *
 * Built once a day and handed round. The first version asked the question the
 * other way about — for each hex, walk all nineteen hundred columns and see
 * which are on it — and with six neighbours to weigh for every hex holding
 * troops, across ten forces, that came to fifty million comparisons a morning
 * and was most of what a day cost.
 */
export function standingAt(world, positions) {
  const at = new Map();
  for (const column of world.garrisons.opening) {
    const cell = positions.get(column.id) ?? column.cell;
    const here = at.get(cell);
    if (here) here.push(column);
    else at.set(cell, [column]);
  }
  return at;
}

/** What a column answers to, for the war table: its country if it is neutral. */
function partyOf(world, column) {
  if (column.formation.nation !== 'neutral') return column.formation.nation;
  const country = world.countryOf?.[column.cell] ?? -1;
  return country >= 0 ? world.countries[country].name : null;
}

/**
 * Whoever is standing on a hex that this force may fight.
 *
 * Not simply "everybody who is not mine": a hex can hold two allies, and the
 * question a staff asks before it attacks is what will shoot back.
 */
function defendersOn(world, cell, party, day, standing) {
  const out = [];
  for (const column of standing.get(cell) ?? []) {
    const theirs = partyOf(world, column);
    if (!theirs || theirs === party) continue;
    if (!mayFight(day, party, theirs)) continue;
    out.push(column);
  }
  return out;
}

/**
 * The attacks this force makes today.
 *
 * One hex at a time, and the whole of what is standing on it goes or none of it
 * does. A staff that fed a hex in piecemeal would be doing the thing every
 * manual in the war tells it not to, and this model punishes it exactly as the
 * manuals say it would: strength is added up before the odds are worked out, so
 * two divisions attacking together are worth far more than two attacking a day
 * apart.
 *
 * @returns {Array<{day, power, column, from, to, staff: true}>}
 */
export function attackOrders({
  world,
  power,
  country = -1,
  party,
  day,
  positions,
  arrivals,
  strengths,
  taken,
  aboard,
  mine,
  standing,
  fed,
}) {
  const held = mine ?? holdings(world, power, country);
  const where = standing ?? standingAt(world, positions);
  const supplied = fed ?? supplyFor(world, power, day);
  const ordered = new Set(taken ?? []);
  const out = [];

  // Everything of ours, grouped by the hex it is standing on. Sorted by cell so
  // that the same board gives the same attacks on every machine that works it
  // out.
  const byCell = new Map();
  for (const column of forcesOf(world, power, country)) {
    if (aboard?.has(column.id)) continue;
    if (ordered.has(column.id)) continue;
    if (!isMobile(column.formation)) continue;
    const at = positions.get(column.id);
    if (at === undefined || !held[at]) continue;
    if (!byCell.has(at)) byCell.set(at, []);
    byCell.get(at).push(column);
  }

  for (const from of [...byCell.keys()].sort((a, b) => a - b)) {
    // An army that cannot be fed does not attack. It is the one rule that
    // stops a front running away from its own depots for ever: outrun the
    // supply and the attacks stop, and they start again when it catches up.
    // Without it the China war put a hundred and forty-six Chinese divisions
    // on ground nothing could reach.
    if (!supplied[from]) continue;

    const able = byCell.get(from).filter((c) => !ordered.has(c.id));
    if (!able.length) continue;
    // Weighed honestly, which means telling `strengthOf` who is being fed.
    // Leaving it out counted a starving division at full strength, so the
    // staff attacked at odds it did not have.
    const fedHere = new Set(able.filter((c) => supplied[positions.get(c.id)]).map((c) => c.id));
    const weight = strengthOf(able, 'attack', strengths, fedHere);
    if (weight <= 0) continue;

    // The neighbour worth going for: the one we beat by the widest margin.
    let best = -1;
    let bestOdds = 0;
    for (const j of [...neighbours(from)].sort((a, b) => a - b)) {
      if (held[j]) continue;
      const them = partyHolding(world, j);
      if (!them || !mayFight(day, party, them)) continue;
      const against = defendersOn(world, j, party, day, where);
      const standing =
        strengthOf(against, 'defend', strengths) * groundBonus(world, j, from);
      const odds = weight / Math.max(1, standing);
      if (odds > bestOdds) {
        bestOdds = odds;
        best = j;
      }
    }
    if (best === -1 || bestOdds < ODDS) continue;

    for (const column of able) {
      // Through the same gate a ticked box goes through. Anything a player
      // could not order, the staff does not order either.
      const why = mayMarch({
        world,
        column,
        to: best,
        power,
        day,
        positions,
        arrivals,
        ordered,
      });
      if (why) continue;
      ordered.add(column.id);
      out.push({ day, power, column: column.id, from, to: best, staff: true });
    }
  }
  return out;
}

/**
 * And the marches: everything idle walks towards the fighting.
 *
 * The same rule a seated power gets from its standing order, over a mask so
 * that a country can have one. A column already on the line stays on it —
 * going forward from there is an attack, and attacks are decided above.
 */
export function marchOrders({
  world,
  power,
  country = -1,
  party,
  day,
  positions,
  arrivals,
  taken,
  aboard,
  mine,
  fed,
}) {
  const held = mine ?? holdings(world, power, country);
  const far = frontFrom(world, held, party, day);
  // Where this force can be maintained. A staff does not march an army out of
  // its own supply on the way to a battle: the first version did, and by the
  // fortieth day one column in six was starving on ground nobody had fought
  // over. An attack is different and is allowed to go anywhere — you take the
  // hex and the depots follow — but walking there is not.
  const supplied = fed ?? supplyFor(world, power, day);
  const ordered = new Set(taken ?? []);
  const out = [];

  for (const column of forcesOf(world, power, country)) {
    if (aboard?.has(column.id)) continue;
    if (ordered.has(column.id)) continue;
    if (!isMobile(column.formation)) continue;
    const from = positions.get(column.id);
    if (from === undefined) continue;
    const here = far[from];
    // Not on ground with a way to the front, or standing on the line already.
    if (here <= 0) continue;

    let best = -1;
    let bestFar = here;
    for (const j of neighbours(from)) {
      const there = far[j];
      if (there < 0 || there >= bestFar) continue;
      if (!supplied[j]) continue;
      if (best === -1 || there < bestFar || j < best) {
        best = j;
        bestFar = there;
      }
    }
    if (best === -1) continue;

    const why = mayMarch({ world, column, to: best, power, day, positions, arrivals, ordered });
    if (why) continue;
    ordered.add(column.id);
    out.push({ day, power, column: column.id, from, to: best, staff: true });
  }
  return out;
}

/**
 * The two things every force on a given day needs, worked out once.
 *
 * Both are per *day* and not per force: where everything is standing is one
 * question with one answer, and a supply map belongs to a nation — the thirty
 * neutral countries share one, because the model gives the pooled neutral one
 * network. Computing them inside the loop instead put a flood fill over a
 * hundred and fourteen thousand cells inside a loop over ten forces, and took a
 * day from four hundred milliseconds to two seconds.
 */
export function staffDay(world, positions, day) {
  return { standing: standingAt(world, positions), supplied: new Map(), day };
}

/** The supply map for a nation, made once and kept for the day. */
function fedFor(shared, world, power, day) {
  if (!shared) return supplyFor(world, power, day);
  const already = shared.supplied.get(power);
  if (already) return already;
  const map = supplyFor(world, power, day);
  shared.supplied.set(power, map);
  return map;
}

/**
 * Which of this force's formations want men, worst first.
 *
 * Only what is in supply: replacements go up the same roads the rations do,
 * and asking for them where nothing can reach is how a queue fills with
 * requests that can never be met.
 */
export function depotOrders({ world, power, country = -1, day, positions, strengths, fed }) {
  const supplied = fed ?? supplyFor(world, power, day);
  const wants = [];
  for (const column of world.garrisons.opening) {
    if (column.formation.nation !== power) continue;
    if (country >= 0 && homeCountry(world, column) !== country) continue;
    const at = positions.get(column.id) ?? column.cell;
    if (!supplied[at]) continue;
    const have = strengths?.get(column.id) ?? column.strength;
    let now = 0;
    let full = 0;
    for (const arm of Object.keys(column.strength)) {
      now += have[arm] ?? 0;
      full += column.strength[arm] ?? 0;
    }
    if (full <= 0 || now <= 0) continue;
    const share = now / full;
    if (share >= WORN) continue;
    wants.push({ id: column.id, share });
  }
  // Worst first, and ties by id so the same board gives the same queue.
  wants.sort((a, b) => a.share - b.share || (a.id < b.id ? -1 : 1));
  return wants.slice(0, QUEUE).map((w) => w.id);
}

/**
 * And whether it stands up anything new.
 *
 * One division a day at most, at the best town it holds, and only with four
 * more divisions' worth of men still in the pool behind it. The day's own
 * `mayRaise` does the refusing — the staff proposes and the rules dispose,
 * which is the same arrangement a player gets.
 */
export function raisingOrders({ world, power, day, manpower, template = 'infantry' }) {
  const wants = TEMPLATE_INDEX[template];
  if (!wants) return [];
  const spare = manpower ?? 0;
  if (spare < menInTemplate(wants) * IN_HAND) return [];

  // The largest town it holds and can reach, which is where an army is raised.
  const seat = NATION_INDEX[power];
  let best = -1;
  let biggest = -1;
  for (let i = 0; i < (world.cities?.length ?? 0); i += 1) {
    const cell = world.cities[i].index;
    if (cell === undefined || world.ownership.owner[cell] !== seat) continue;
    const people = world.cities[i].population ?? 0;
    if (people > biggest) {
      biggest = people;
      best = cell;
    }
  }
  if (best < 0) return [];
  return [{ template: wants.id, cell: best }];
}

/**
 * A day's work for one force: what it attacks, and what walks towards the war.
 *
 * Attacks first, because that is the decision. Whatever is not committed to one
 * of them then walks forward, which is how a hex on the line accumulates weight
 * until there is enough of it to go.
 */
export function staffOrders({
  world,
  power,
  country = -1,
  party,
  day,
  positions,
  arrivals,
  strengths,
  taken,
  aboard,
  shared,
}) {
  const mine = holdings(world, power, country);
  const where = shared?.standing ?? standingAt(world, positions);
  const fed = fedFor(shared, world, power, day);
  const ordered = [...(taken ?? [])];
  const attacks = attackOrders({
    world,
    power,
    country,
    party,
    day,
    positions,
    arrivals,
    strengths,
    taken: ordered,
    aboard,
    mine,
    standing: where,
    fed,
  });
  for (const move of attacks) ordered.push(move.column);
  const marches = marchOrders({
    world,
    power,
    country,
    party,
    day,
    positions,
    arrivals,
    taken: ordered,
    aboard,
    mine,
    fed,
  });
  return { attacks, marches, moves: [...attacks, ...marches] };
}
