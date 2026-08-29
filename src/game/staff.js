import { TILE_COUNT, neighbours } from '../world/sphere.js';
import { NATION_INDEX, NATIONS, SEA } from '../world/nations.js';
import { enemiesOf, mayFight } from './belligerence.js';
import { UNPLAYED } from './players.js';
import { CAPITAL_CELLS } from '../world/capitals.js';
import { isMobile, mayMarch } from './movement.js';
import { groundBonus, strengthOf } from './combat.js';
import { airCombat, defenceOf, hexesApart, mayRaid, reachFrom } from './bombing.js';
import { mayStrike } from './strike.js';
import { FLEET_SPEED, fleetStrength, mayShip, navigable } from './naval.js';
import { waterPath } from '../world/convoys.js';
import { SHIPS } from '../world/navies.js';
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
// **It flies, and it goes to sea, but it does not land.** A mission is one day and goes
// nowhere — no pathfinding, no plan spread over a week — which is exactly why
// an automaton cannot look stupid doing it, and why this came first. A navy
// wandering the Atlantic and an amphibious landing are the two that can, and
// they are left out.
//
// Leaving the air out was the larger hole. Every air system on this board —
// strategic bombing, close support, escort, the flak, the carriers — was
// entirely one-sided the moment a seat was empty: a player bombed and was never
// bombed back. The sea had the same hole and the same answer.
//
// At sea it does two things and no more, because they are the two that need no
// judgement about where a war is going: **submarines hunt trade, and destroyers
// screen it.** Everything else stays at its anchorage, which is where a fleet
// in being spends its war and is a great deal better than a battle squadron
// wandering the Atlantic on an automaton's initiative.

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
  // And the powers that have no chair to sit in. France is the only one, and
  // it is unseated permanently rather than because nobody turned up — so it is
  // the one power that always gets a staff, and the only army on the board that
  // would otherwise never move whatever the table did.
  for (const power of UNPLAYED) {
    if (NATION_INDEX[power] === undefined) continue;
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

/**
 * Every column this force can give marching orders to.
 *
 * Nothing standing on a capital. A garrison on a capital is a garrison *of* the
 * capital, and marching it off to feed the front is how a government falls —
 * the first version had Poland march two of Warsaw's four columns out on the
 * first morning, dropping the city's defence from a hundred and eleven thousand
 * to sixteen, and Warsaw was gone on the fifth day against the twenty-six it
 * held for in 1939.
 *
 * Blunt on purpose. Losing a capital is what the whole capitulation system
 * keys on, so the one hex a staff must never leave open is easy to name.
 */
export function forcesOf(world, power, country) {
  const capitals = CAPITAL_CELLS();
  const out = [];
  for (const column of world.garrisons.opening) {
    if (column.formation.nation !== power) continue;
    if (!MANOEUVRE.has(column.formation.type)) continue;
    if (country >= 0 && homeCountry(world, column) !== country) continue;
    if (capitals.has(column.cell)) continue;
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
 * Used by `airOrders` above as well, which reads earlier in the file than this
 * is declared. That is a plain function declaration and hoists; the ordering is
 * by subject rather than by dependency.
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
      // Empty ground you cannot feed an army on is not a prize, it is the
      // march rule dodged. An attack may go into supply it does not have —
      // you take the position and the depots follow — but walking into a hex
      // nobody is defending is a march, and marches stay inside the net. The
      // first version let France walk twenty-four undefended hexes into
      // Germany and starve on every one of them.
      if (!against.length && !supplied[j]) continue;
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
  return {
    standing: standingAt(world, positions),
    supplied: new Map(),
    // What the air defence over a hex is worth to each power that might ask.
    priced: new Map(),
    // And where a ship may float, which does not change from one force to the
    // next and costs a walk of the whole board to work out.
    water: waterMap(world),
    day,
  };
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
 * Bombers over one hex past which more bombers do nothing.
 *
 * A strike is capped at eight per cent of what is standing on a hex however
 * much is sent, and the cap starts binding around a hundred and seventy against
 * a full-strength position. Everything past that is aircraft lost for nothing,
 * so the staff spreads them over the next target instead.
 */
export const SATURATED = 200;

/** And the same for a works, which is shut for longer the more gets through. */
export const SATURATED_WORKS = 320;

/**
 * How much of an air force goes up on any one morning.
 *
 * The first version sent everything that could fly, every day, and flew three
 * air forces into the ground doing it: Bomber Command went from 550 aircraft to
 * 70 in six weeks, and by the fortieth day there was nothing left to raid with.
 * A raid on a defended target costs a tenth to a quarter of what is sent, which
 * is a real price for a decision made now and then and ruinous as a habit.
 *
 * A third, so a group flies about every third day. Air forces husbanded their
 * strength exactly this way and for exactly this reason.
 */
export const SORTIE = 1 / 3;

/**
 * And what a mission has to cost before it is not worth flying.
 *
 * Fourteen per cent of the bombers sent. Above that the staff would be trading
 * its air force for a factory shut for a week, which is the trade every bomber
 * command in the war got wrong at least once and none of them got wrong twice.
 */
export const COSTLY = 0.14;

/** Every air group of this force that could fly today. */
function airGroups(world, power, country, positions, aboard, flown, ordered) {
  const out = [];
  for (const column of world.garrisons.opening) {
    if (column.formation.nation !== power) continue;
    if (column.formation.type !== 'air') continue;
    if (country >= 0 && homeCountry(world, column) !== country) continue;
    if (aboard?.has(column.id) || flown?.has(column.id) || ordered?.has(column.id)) continue;
    if (positions.get(column.id) === undefined) continue;
    out.push(column);
  }
  // By id, so the same board gives the same missions on every machine.
  return out.sort((a, b) => (a.id < b.id ? -1 : 1));
}

/**
 * The missions this force flies today.
 *
 * Two kinds, in the order a staff would want them.
 *
 * **The air goes in before the infantry does.** Every hex the staff is
 * attacking this morning is a hex worth bombing first, which is the whole
 * reason strikes are resolved ahead of the battles. Targets are taken heaviest
 * first, because that is where softening is worth most, and each is filled only
 * to the point where another bomber would achieve nothing.
 *
 * **Then the works.** Whatever has not been given a battle to support goes for
 * the largest factory it can reach and come back from.
 *
 * Fighters go last and only to targets that are already having bombs dropped on
 * them, because a fighter over a hex nobody is bombing is a fighter spending
 * its one sortie of the day on nothing.
 *
 * @returns {{striking: Array, raiding: Array}} orders in the shape a seat gives
 */
export function airOrders({
  world,
  power,
  country = -1,
  party,
  day,
  positions,
  strengths,
  attacks,
  aboard,
  flown,
  standing,
  shared,
}) {
  const all = airGroups(world, power, country, positions, aboard, flown, null);
  if (!all.length) return { striking: [], raiding: [] };
  // Only a share of it goes up. The rest is being serviced, which is where
  // most of an air force was on most days.
  const groups = all.slice(0, Math.max(1, Math.round(all.length * SORTIE)));
  const where = standing ?? standingAt(world, positions);

  const striking = [];
  const raiding = [];
  const spent = new Set();
  const bombersOver = new Map();
  const bombs = (column) =>
    (strengths?.get(column.id) ?? column.strength).bombers ?? 0;

  // ---- what the infantry is going for this morning -------------------------
  const targets = [...new Set((attacks ?? []).map((m) => m.to))];
  targets.sort((a, b) => {
    const weigh = (cell) =>
      strengthOf(defendersOn(world, cell, party, day, where), 'defend', strengths);
    return weigh(b) - weigh(a) || a - b;
  });

  // What a mission over this hex would cost. An escort is not counted: the
  // staff decides whether the bombers can be spared before it decides who goes
  // with them, which is the pessimistic way round.
  //
  // Kept for the whole day rather than for one force, because `defenceOf`
  // walks every column on the board and measures the distance to each: pricing
  // fifty-three works afresh for each of eight forces took six hundred
  // milliseconds a morning, four hundred times what the rest of this costs.
  const priced = shared?.priced ?? new Map();
  const tooDear = (target, weight) => {
    const key = `${power}@${target}`;
    if (!priced.has(key)) {
      priced.set(key, defenceOf(world, target, power, positions, strengths, day));
    }
    const against = priced.get(key);
    const share = airCombat({
      guardFighters: against.fighters,
      guardFlak: against.flak,
      escort: 0,
      bombers: weight,
    }).bomberShare;
    return share > COSTLY;
  };

  const send = (column, target, into, check) => {
    const why = check(column, target);
    if (why) return false;
    spent.add(column.id);
    into.push({ column: column.id, target });
    bombersOver.set(target, (bombersOver.get(target) ?? 0) + bombs(column));
    return true;
  };

  const strikeCheck = (column, target) =>
    mayStrike({
      world,
      column: { ...column, strength: strengths?.get(column.id) ?? column.strength },
      target,
      power,
      day,
      positions,
      flown: flown ?? new Set(),
      ordered: spent,
    });

  for (const target of targets) {
    for (const column of groups) {
      if (spent.has(column.id) || !bombs(column)) continue;
      if ((bombersOver.get(target) ?? 0) >= SATURATED) break;
      // Priced against everything going, not against this group alone: a
      // formation saturates a defence that would destroy a squadron, so the
      // question is whether the whole raid is worth it.
      if (tooDear(target, (bombersOver.get(target) ?? 0) + bombs(column))) continue;
      send(column, target, striking, strikeCheck);
    }
  }

  // ---- and then the factories ---------------------------------------------
  const works = [...(world.works ?? [])].sort((a, b) => b.output - a.output || a.cell - b.cell);
  const raidCheck = (column, target) =>
    mayRaid({
      world,
      column: { ...column, strength: strengths?.get(column.id) ?? column.strength },
      target,
      power,
      day,
      positions,
      raids: [],
      ordered: spent,
    });

  for (const column of groups) {
    if (spent.has(column.id) || !bombs(column)) continue;
    const from = positions.get(column.id);
    const goes = reachFrom(world, from);
    // The four biggest it can reach, and no further down the list. A staff
    // that priced every works on the board until it found an affordable one
    // spent its whole morning on arithmetic about factories in Siberia.
    const near = works.filter((site) => hexesApart(from, site.cell) <= goes).slice(0, 4);
    for (const site of near) {
      if ((bombersOver.get(site.cell) ?? 0) >= SATURATED_WORKS) continue;
      if (tooDear(site.cell, (bombersOver.get(site.cell) ?? 0) + bombs(column))) continue;
      if (send(column, site.cell, raiding, raidCheck)) break;
    }
  }

  // ---- and the escorts, where there is something to escort -----------------
  const escorted = new Map();
  for (const order of striking) escorted.set(order.target, striking);
  for (const order of raiding) escorted.set(order.target, raiding);
  for (const column of groups) {
    if (spent.has(column.id)) continue;
    const from = positions.get(column.id);
    const goes = reachFrom(world, from);
    for (const [target, into] of escorted) {
      if (hexesApart(from, target) > goes) continue;
      const check = into === striking ? strikeCheck : raidCheck;
      if (send(column, target, into, check)) break;
    }
  }

  return { striking, raiding };
}

/**
 * How much of a fleet has to be one kind of ship before that is what it is for.
 *
 * Three fifths. A flotilla that is nearly all submarines is a raiding force
 * whatever else is tied up alongside it, and one that is nearly all destroyers
 * is an escort group. Anything more mixed than that is a battle squadron, and a
 * battle squadron stays where it is.
 */
export const OF_A_KIND = 0.6;

/**
 * Odds a raider wants before it goes for a convoy.
 *
 * The same rule as on land and for the same reason. A U-boat that closes with
 * a well-screened convoy is fighting destroyers, and a destroyer is worth three
 * times a submarine to a submarine — the first version sent every flotilla at
 * the nearest lane whatever was guarding it, and Germany lost twenty-seven
 * U-boats in six weeks against the nine it lost in the whole of 1939.
 *
 * A boat that cannot win slips away and waits, which is what it did.
 */
export const AT_SEA = 1.2;

/**
 * How near an escort group stays to the trade it is screening.
 *
 * Eight hexes is about a day and a half's steaming — near enough to come up
 * when something happens, and far enough that a flotilla already on station
 * does not spend the war shuffling one hex a day after a convoy it is
 * effectively sitting on. It also stops a hundred and twenty-six fleets asking
 * for a route across an ocean every morning, which was most of what a day
 * cost.
 */
export const ON_STATION = 8;

/**
 * What a fleet is for, or null if it is a battle squadron.
 *
 * **Anything with a capital ship in it is a battle squadron**, however many
 * destroyers are tied up alongside. Counting hulls alone made Scapa Flow an
 * escort group — forty-seven destroyers against four battleships and two
 * carriers is ninety-three per cent destroyers by number — and sent the Home
 * Fleet off to shepherd convoys with the King George V in tow. What is left
 * once the capital ships are excluded is the nineteen small stations that
 * actually did this work: Simonstown, Aden, Trincomalee, Dakar, Casablanca.
 */
export function fleetIsFor(fleet) {
  const hulls = SHIPS.reduce((n, s) => n + (fleet.ships?.[s.id] ?? 0), 0);
  if (hulls < 1) return null;
  if ((fleet.ships.battleships ?? 0) + (fleet.ships.carriers ?? 0) > 0) return null;
  if ((fleet.ships.submarines ?? 0) / hulls >= OF_A_KIND) return 'raiding';
  if ((fleet.ships.destroyers ?? 0) / hulls >= OF_A_KIND) return 'escorting';
  return null;
}

/**
 * The next hex on the way to somewhere, over water.
 *
 * A real path rather than a step towards the compass bearing. Greedy steering
 * works in the open ocean and pins a fleet against the first coast it meets,
 * and every U-boat base in this war is behind a strait — Kiel is in the Baltic
 * and the way out is the Kattegat, which no bearing will find.
 */
export function steerTo(world, from, to, isWater, speed = FLEET_SPEED) {
  if (from === to) return null;
  const path = waterPath(from, to, isWater, 12000);
  if (!path?.length) return null;
  // Steps along the path are not the same as hexes apart. Six moves round a
  // headland can leave a fleet more than six hexes from where it started, and
  // `mayShip` measures the second — so back down the path until the day's
  // steaming actually fits inside a day's steaming. Without this the order was
  // simply refused and the fleet sat still.
  for (let k = Math.min(path.length, speed); k >= 1; k -= 1) {
    if (hexesApart(from, path[k - 1]) <= speed) return path[k - 1];
  }
  return null;
}

/**
 * The sailing orders this force gives today.
 *
 * Submarines steer for the nearest convoy of somebody they are fighting;
 * destroyers steer for the nearest convoy of their own. Neither needs to know
 * anything it should not: a convoy runs to a published schedule and the whole
 * Atlantic war was fought over where that schedule went.
 *
 * @returns {Array<{fleet: string, to: number}>} orders in the shape a seat gives
 */
export function navalOrders({
  world,
  power,
  country = -1,
  party,
  day,
  fleets,
  isWater,
  ordered,
}) {
  // A country inside the pooled neutral has no navy of its own to give orders
  // to — the fleets on this board belong to nations.
  if (country >= 0) return [];
  const water = isWater ?? waterMap(world);
  const out = [];
  const taken = new Set(ordered ?? []);

  const convoys = (fleets ?? []).filter((f) => f.cargo && f.afloat);
  const theirs = convoys.filter((c) => c.power !== power && mayFight(day, party, c.power));
  const ours = convoys.filter((c) => c.power === power);

  const mine = (fleets ?? [])
    .filter((f) => f.power === power && f.afloat && !f.cargo && !taken.has(f.id))
    .sort((a, b) => (a.id < b.id ? -1 : 1));

  for (const fleet of mine) {
    const job = fleetIsFor(fleet);
    if (!job) continue;
    const hunting = job === 'raiding' ? theirs : ours;
    if (!hunting.length) continue;

    // An escort already covering something stays where it is.
    if (job === 'escorting') {
      const covered = hunting.some((c) => hexesApart(fleet.cell, c.cell) <= ON_STATION);
      if (covered) continue;
    }

    // The nearest one it is willing to go for, ties by id so the same board
    // gives the same orders on every machine.
    let target = null;
    let nearest = Infinity;
    for (const convoy of hunting) {
      const away = hexesApart(fleet.cell, convoy.cell);
      if (away >= nearest) continue;
      // A raider weighs the screen before it closes. An escort does not: it is
      // joining its own trade, not attacking it.
      if (job === 'raiding') {
        // Weighed the way the action itself will weigh it. A convoy counts as
        // a ship of its own kind — that is what a submarine is worth three
        // times against — and leaving it out of the sum made every lane look
        // like a destroyer screen with nothing behind it, so no boat ever went.
        const trade = { ...convoy.ships, convoys: 1 };
        const attack = fleetStrength(fleet.ships, 'attack', trade);
        const screen = fleetStrength(convoy.ships, 'defend', fleet.ships);
        if (attack < AT_SEA * Math.max(1, screen)) continue;
      }
      nearest = away;
      target = convoy;
    }
    if (!target || target.cell === fleet.cell) continue;

    const to = steerTo(world, fleet.cell, target.cell, water);
    if (to === null || to === undefined || !navigable(world, to)) continue;
    const why = mayShip({
      world,
      fleet,
      to,
      power,
      day,
      positions: new Map((fleets ?? []).map((f) => [f.id, f.cell])),
      ordered: taken,
    });
    if (why) continue;
    taken.add(fleet.id);
    out.push({ fleet: fleet.id, to, hunting: target.id });
  }
  return out;
}

/** Which hexes a ship can float on. Built once a day and handed round. */
export function waterMap(world) {
  const water = new Uint8Array(TILE_COUNT);
  for (let i = 0; i < TILE_COUNT; i += 1) water[i] = navigable(world, i) ? 1 : 0;
  return water;
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
