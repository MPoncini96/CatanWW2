import { neighbours } from '../world/sphere.js';
import { NATIONS, NATION_INDEX, SEA } from '../world/nations.js';
import { TERRAIN } from '../world/terrain.js';
import { CAPITAL_CELLS } from '../world/capitals.js';
import { atWar, positionsAt } from './movement.js';

// Fighting for a hex.
//
// A cell is 4,455 km² and the heaviest of them holds 186,000 men, so a battle
// here is not a battle — it is an army group's frontage for a day. That decides
// almost everything about the model. Losses are percentages rather than counts,
// nothing is annihilated in an afternoon, and a fight that lasted a week in the
// histories is a week of daily attacks here rather than one enormous roll.
//
// What decides it: how many men and machines each side has, what each of those
// is worth attacking or defending, how good the troops are, and what the ground
// does for whoever is standing on it. Then a modest amount of luck, because a
// model with none is arithmetic and a model with much is a lottery.

/**
 * What each arm is worth, attacking and defending, in men.
 *
 * A tank is 90 men going forward and 40 standing still: a panzer division of
 * 300 tanks and 13,000 men fought like two or three infantry divisions, and
 * armour dug in to hold ground wastes the only thing that made it worth having.
 * Artillery is the reverse — it killed more men than anything else in both
 * wars, and it kills most of them from a prepared position onto ground the
 * attacker has to cross. Bombers hit hard and cannot hold anything. Fighters
 * decide who else gets to do those things, which is worth something and not
 * much, on the ground.
 */
export const RATINGS = {
  infantry: { attack: 1, defend: 1.3 },
  tanks: { attack: 90, defend: 40 },
  artillery: { attack: 60, defend: 80 },
  fighters: { attack: 25, defend: 25 },
  bombers: { attack: 80, defend: 15 },
};

/** What the ground is worth to whoever is holding it. */
export const TERRAIN_DEFENCE = {
  peak: 2.2,
  mountain: 2.0,
  glacier: 1.8,
  swamp: 1.6,
  jungle: 1.6,
  forest: 1.4,
  taiga: 1.3,
  hills: 1.25,
  tundra: 1.1,
  savanna: 1.05,
  desert: 1.0,
  plains: 1.0,
  beach: 0.9,
};

/** A town is worth more than the field it stands in. Ask Stalingrad. */
const CITY_DEFENCE = 1.3;

/** How much of a side is lost in a day of it, before the ratio is applied. */
const BASE_LOSS = 0.1;
const LEAST_LOSS = 0.02;
const WORST_LOSS = 0.35;

/** And what it costs to be beaten with nowhere to go. */
const POCKET_LOSS = 0.6;

/** How far luck is allowed to move the answer. */
const LUCK = 0.2;

/**
 * Two rolls for a fight, the same on every machine that asks.
 *
 * Seeded from the day and the hex rather than from a generator with a hidden
 * state, so a battle can be recomputed from the record and comes out the same —
 * which is what lets the whole game be replayed rather than stored.
 */
export function luckAt(day, cell) {
  const mix = (n) => {
    let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
  const seed = Math.imul(day + 1, 0x27d4eb2d) ^ Math.imul(cell + 1, 0x165667b1);
  return [1 + (mix(seed) - 0.5) * 2 * LUCK, 1 + (mix(seed ^ 0x5bf03635) - 0.5) * 2 * LUCK];
}

/** What a set of columns is worth, attacking or defending. */
export function strengthOf(columns, mode, strengths) {
  let total = 0;
  for (const column of columns) {
    const have = strengths?.get(column.id) ?? column.strength;
    const quality = column.formation.quality ?? 0.5;
    for (const [arm, rating] of Object.entries(RATINGS)) {
      total += (have[arm] ?? 0) * rating[mode] * quality;
    }
  }
  return total;
}

/** What the ground and the height are worth to the defender. */
export function groundBonus(world, cell, fromCell) {
  let bonus = TERRAIN_DEFENCE[TERRAIN[world.biome[cell]].id] ?? 1;
  if (world.cityAt?.[cell] >= 0) bonus *= CITY_DEFENCE;
  if (fromCell !== undefined && fromCell !== null) {
    // Height, in metres, over the ground the attack is coming from. Both are
    // stored 0-1 across a 7 km band and have to be read back out.
    const climb = (world.elevation[cell] - world.elevation[fromCell]) * 7000;
    bonus *= 1 + Math.max(-0.15, Math.min(0.3, climb / 3000));
  }
  return bonus;
}

/**
 * Where a beaten column falls back to.
 *
 * Automatic, and not the player's to decide: an army that has lost a position
 * withdraws, and asking a seat to choose each time would either stall the day
 * waiting for eight people or hand them a decision the men on the ground were
 * making without orders anyway.
 *
 * It goes to its own nation's ground, preferring to put distance between itself
 * and whoever pushed it — the hex furthest from the attack, then the ground
 * that is hardest to follow it onto. Nothing random: the same rout gives the
 * same answer everywhere.
 */
export function retreatTo(world, cell, nation, fromCell) {
  const owner = world.ownership.owner;
  const seat = NATION_INDEX[nation];
  const options = [];
  for (const j of neighbours(cell)) {
    if (owner[j] === SEA || owner[j] !== seat) continue;
    if (j === fromCell) continue;
    let away = 0;
    if (fromCell !== undefined && fromCell !== null) {
      away = [...neighbours(fromCell)].includes(j) ? 0 : 1;
    }
    options.push({
      cell: j,
      away,
      cover: TERRAIN_DEFENCE[TERRAIN[world.biome[j]].id] ?? 1,
    });
  }
  if (!options.length) return null;
  options.sort((a, b) => b.away - a.away || b.cover - a.cover || a.cell - b.cell);
  return options[0].cell;
}

/** Is this the hex a government sits on? Nobody falls back out of one. */
export function isCapital(cell) {
  return CAPITAL_CELLS().has(cell);
}

/**
 * Resolve one hex's fight for one day.
 *
 * @returns {{winner, attack, defence, losses, retreat, pocket}}
 */
export function fight({ world, cell, day, attackers, defenders, strengths, fromCell }) {
  const [luckA, luckD] = luckAt(day, cell);
  const attack = strengthOf(attackers, 'attack', strengths) * luckA;
  const defence = strengthOf(defenders, 'defend', strengths) * groundBonus(world, cell, fromCell) * luckD;

  const attackerWins = attack > defence;
  const ratio = attackerWins ? attack / Math.max(1, defence) : defence / Math.max(1, attack);

  // The loser loses in proportion to how badly it was beaten; the winner in
  // inverse proportion. A one-sided fight is cheap for the winner and dear for
  // the loser, an even one costs both about a tenth of what they brought.
  const loserShare = Math.min(WORST_LOSS, Math.max(LEAST_LOSS, BASE_LOSS * ratio));
  const winnerShare = Math.min(WORST_LOSS, Math.max(LEAST_LOSS, BASE_LOSS / ratio));

  const losers = attackerWins ? defenders : attackers;
  const winners = attackerWins ? attackers : defenders;

  // Only the defender can be pushed off the hex; a beaten attacker simply goes
  // back where it came from, which it always can, because it was there this
  // morning.
  let retreat = null;
  let pocket = false;
  if (attackerWins) {
    const nation = defenders[0]?.formation.nation;
    if (isCapital(cell)) pocket = true;
    else {
      retreat = retreatTo(world, cell, nation, fromCell);
      pocket = retreat === null;
    }
  }

  return {
    winner: attackerWins ? 'attacker' : 'defender',
    attack: Math.round(attack),
    defence: Math.round(defence),
    loserShare: pocket ? Math.max(loserShare, POCKET_LOSS) : loserShare,
    winnerShare,
    losers: losers.map((c) => c.id),
    winners: winners.map((c) => c.id),
    retreat,
    pocket,
    fromCell: fromCell ?? null,
  };
}


/**
 * What is left of every column, after every battle up to this day.
 *
 * Replayed like everything else. A column is not stored with a strength that
 * gets edited — it is the strength it deployed with, less what each battle it
 * was in took off it, worked out again from the record every time. A column
 * that has been through four fights is four multiplications, and the answer is
 * the same on every machine that asks.
 */
export function strengthsAt(placements, battles, day) {
  const left = new Map();
  for (const placement of placements) left.set(placement.id, { ...placement.strength });
  for (const battle of battles) {
    if (battle.day > day) break;
    const take = (ids, share) => {
      for (const id of ids) {
        const have = left.get(id);
        if (!have) continue;
        for (const arm of Object.keys(have)) {
          have[arm] = Math.max(0, Math.floor(have[arm] * (1 - share)));
        }
      }
    };
    take(battle.losers, battle.loserShare);
    take(battle.winners, battle.winnerShare);
  }
  return left;
}

/**
 * Fight every hex two hostile armies are standing on, and see who holds it.
 *
 * Called once a day, after the marches. A battle is a hex where columns of two
 * nations that may fight each other are standing at the end of the day's
 * movement — which is all an attack is: you marched onto ground somebody else
 * was holding.
 *
 * @returns {{battles: Array, retreats: Array, captures: Array}}
 */
export function resolveDay({ world, day, moves, battles: past }) {
  const positions = positionsAt(world.garrisons.opening, moves, day);
  const strengths = strengthsAt(world.garrisons.opening, past, day - 1);

  // Who is standing where, and who got there today.
  const onCell = new Map();
  const arrivedToday = new Map();
  for (const move of moves) {
    if (move.day === day) arrivedToday.set(move.column, move.from);
  }
  for (const column of world.garrisons.opening) {
    const have = strengths.get(column.id);
    if (!have || Object.values(have).every((n) => n === 0)) continue;
    const cell = positions.get(column.id);
    if (!onCell.has(cell)) onCell.set(cell, []);
    onCell.get(cell).push(column);
  }

  const fought = [];
  const retreats = [];
  const captures = [];

  for (const [cell, columns] of [...onCell].sort((a, b) => a[0] - b[0])) {
    const sides = new Map();
    for (const column of columns) {
      const nation = column.formation.nation;
      if (!sides.has(nation)) sides.set(nation, []);
      sides.get(nation).push(column);
    }
    if (sides.size < 2) continue;

    // Which two of them are actually at war. More than two is possible and
    // rare; the first pair the war table allows is the fight.
    const names = [...sides.keys()];
    let pair = null;
    for (let a = 0; a < names.length && !pair; a += 1) {
      for (let b = a + 1; b < names.length && !pair; b += 1) {
        if (atWar(day, names[a], names[b], world, cell)) pair = [names[a], names[b]];
      }
    }
    if (!pair) continue;

    // The attacker is whoever arrived today. If both did, the ground decides;
    // if it is nobody's ground, the one that did not move defends.
    const cameToday = (nation) => sides.get(nation).some((c) => arrivedToday.has(c.id));
    let attackNation = pair.find((n) => cameToday(n)) ?? pair[0];
    if (pair.every(cameToday)) {
      const holder = world.ownership.owner[cell];
      const defender = pair.find((n) => NATION_INDEX[n] === holder);
      if (defender) attackNation = pair.find((n) => n !== defender);
    }
    const defendNation = pair.find((n) => n !== attackNation);

    const attackers = sides.get(attackNation);
    const defenders = sides.get(defendNation);
    const fromCell = attackers.map((c) => arrivedToday.get(c.id)).find((c) => c !== undefined) ?? null;

    const result = fight({ world, cell, day, attackers, defenders, strengths, fromCell });
    const record = {
      day,
      cell,
      attacker: attackNation,
      defender: defendNation,
      ...result,
    };
    fought.push(record);

    if (result.winner === 'attacker') {
      // The beaten side falls back, or is destroyed where it stands.
      if (result.retreat !== null) {
        for (const column of defenders) {
          retreats.push({
            day,
            power: defendNation,
            column: column.id,
            from: cell,
            to: result.retreat,
            retreat: true,
          });
        }
      }
      captures.push({ day, cell, from: defendNation, to: attackNation, pocket: result.pocket });
    } else {
      // A beaten attacker goes back where it came from — it was there this
      // morning, so it always can.
      for (const column of attackers) {
        const back = arrivedToday.get(column.id);
        if (back === undefined) continue;
        retreats.push({
          day,
          power: attackNation,
          column: column.id,
          from: cell,
          to: back,
          retreat: true,
        });
      }
    }
  }

  // ------------------------------------------------------------------------
  // Ground taken without a fight.
  //
  // Most of a country has nobody standing on it — forty of Poland's seventy
  // hexes hold no garrison at all — and until this existed an army could march
  // across all of them without taking one. A hex belongs to whoever is standing
  // on it, and if nobody is, to whoever walks in.
  const held = new Map();
  for (const [cell, columns] of onCell) {
    const nations = new Set(columns.map((c) => c.formation.nation));
    if (nations.size === 1) held.set(cell, [...nations][0]);
  }
  const alreadyTaken = new Set(captures.map((c) => c.cell));
  for (const [cell, nation] of [...held].sort((a, b) => a[0] - b[0])) {
    if (alreadyTaken.has(cell)) continue;
    const owner = world.ownership.owner[cell];
    if (owner === NATION_INDEX[nation]) continue;
    // Somebody has to have walked in. Standing where you deployed does not
    // take ground, or the 8th Route Army would own its base areas in Shanxi
    // before anybody had given an order — which is not what a partisan base is,
    // and is a strange thing to find on the first morning of a game.
    if (!(onCell.get(cell) ?? []).some((c) => arrivedToday.has(c.id))) continue;
    if (!atWar(day, nation, NATIONS[owner].id, world, cell)) continue;
    captures.push({ day, cell, from: NATIONS[owner].id, to: nation, walkedIn: true });
    alreadyTaken.add(cell);
  }

  // ------------------------------------------------------------------------
  // And ground nobody can hold any longer.
  //
  // An undefended hex whose every land neighbour is held by one enemy has been
  // cut off from whatever it belonged to, and falls without anyone marching
  // into it. This is what mops up pockets, and it is also the only way a
  // mountain is taken from an army that will not come down off it.
  //
  // Worked out against the ownership as it stood at the start of the pass, so
  // one pocket collapsing cannot collapse the next in the same day — a pocket
  // gives way over days, and a pass that cascaded would depend on the order
  // the cells happened to be visited in.
  const before = world.ownership.owner.slice();
  for (let cell = 0; cell < before.length; cell += 1) {
    const owner = before[cell];
    if (owner === SEA || alreadyTaken.has(cell)) continue;
    if ((onCell.get(cell) ?? []).length) continue;

    let ring = null;
    let land = 0;
    let surrounded = true;
    for (const j of neighbours(cell)) {
      if (before[j] === SEA) continue;
      land += 1;
      if (ring === null) ring = before[j];
      if (before[j] !== ring) {
        surrounded = false;
        break;
      }
    }
    if (!surrounded || land < 2 || ring === null || ring === owner) continue;
    const taker = NATIONS[ring].id;
    if (!atWar(day, taker, NATIONS[owner].id, world, cell)) continue;
    captures.push({ day, cell, from: NATIONS[owner].id, to: taker, cutOff: true });
    alreadyTaken.add(cell);
  }

  return { battles: fought, retreats, captures };
}
