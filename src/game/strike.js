import { NATIONS, NATION_INDEX } from '../world/nations.js';
import { formationName } from '../world/deploy.js';
import { atWar } from './movement.js';
import { groundBonus } from './combat.js';
import {
  CARRIER_RANGE,
  airCombat,
  defenceOf,
  hexesApart,
  raidLuck,
  reachFrom,
} from './bombing.js';

// Bombing an army.
//
// Aircraft could do exactly three things on this board and none of them was
// attacking anybody. They could wreck a factory; they could shoot down somebody
// else's bombers; and if you marched an air group onto a hex a battle happened
// to be fought over, its aircraft counted towards that battle at eighty points
// a bomber. So the Luftwaffe of 1939 — built almost entirely around supporting
// an army in the field — could not support an army in the field.
//
// This is that mission. It is the strategic raid pointed at troops instead of
// at a works, and it deliberately shares everything with it: the same ten hexes
// of range, the same interception by fighters within three, the same flak, the
// same arithmetic for who does not come home.
//
// ---------------------------------------------------------------- the rules
//
// **It happens before the fighting.** The order of a day puts the strikes ahead
// of the battles, so bombing a hex in the morning and assaulting it in the
// afternoon is one plan rather than two days of work. That is the whole reason
// to have it.
//
// **The ground protects.** The multiplier a defender gets for standing in
// mountains or a city is the same multiplier that protects it from the air,
// because it is the same fact about the ground: men in a wood are hard to
// bomb for exactly the reasons they are hard to shell. Troops caught in the
// open on a plain take the full weight.

/**
 * Men one bomber kills on a hex it gets over, in the open.
 *
 * Low, because most bombs missed. What air attack actually did to a division
 * was stop it moving in daylight and break up its concentrations, and the
 * casualties were a by-product; twelve a sortie is already the good days.
 */
export const MEN_PER_BOMBER = 12;

/**
 * And never more than this share of what is standing there in a day.
 *
 * Air power did not destroy armies. It cost them, it stopped them moving in
 * daylight and it broke up their concentrations, and then the infantry still
 * had to go and take the position.
 *
 * Eight per cent is a very bad day for a division and it takes a massed effort
 * to reach — against a full-strength hex the ceiling only starts binding above
 * about a hundred and seventy bombers, so a squadron gets a squadron's result
 * and an air fleet gets an air fleet's.
 */
export const WORST_STRIKE = 0.08;

// What it costs the crews is not worked out here. It is `airCombat` in
// bombing.js, the same function a raid on a works uses, because it is the same
// flight: the same fighters come up, the same guns fire, and the escort does
// the same job whichever the target is. One set of numbers, one place.

/**
 * May this group go for the troops on this hex?
 *
 * Returns null if it may, or the sentence saying why not.
 */
export function mayStrike({ world, column, target, power, day, positions, flown, ordered }) {
  if (!power) return 'Nobody is sitting at this seat.';
  if (!column) return 'Nothing is selected to fly.';
  const name = formationName(column.formation);
  if (column.formation.nation !== power) return `${name} is not yours to order.`;
  if (ordered?.has(column.id)) return 'Already flying tomorrow.';
  if (flown?.has(column.id)) return 'It flew today and is being turned round.';

  // Bombers to do the work, or fighters to see them there.
  const bombers = column.strength?.bombers ?? 0;
  const fighters = column.strength?.fighters ?? 0;
  if (!bombers && !fighters) return `${name} has no aircraft in it.`;

  const owner = world.ownership.owner[target];
  if (owner === undefined || owner < 0) return 'There is nothing out there to bomb.';
  if (owner === NATION_INDEX[power]) return 'Those are your own men.';

  // Somebody has to be standing there. This is the whole difference from a raid
  // on a works: the target is an army, and an empty hex is not one.
  const here = (world.garrisons.byCell.get(target) ?? []).filter(
    (c) => c.formation.nation !== power,
  );
  if (!here.length) return 'There is nobody standing on that hex.';

  const enemy = here.filter((c) => atWar(day, power, c.formation.nation, world, target));
  if (!enemy.length) {
    const held = world.countryOf?.[target] >= 0 ? world.countries[world.countryOf[target]].name : 'them';
    return `You are not at war with ${held}.`;
  }

  const from = positions?.get(column.id) ?? column.cell;
  const goes = reachFrom(world, from);
  const reach = hexesApart(from, target);
  if (reach > goes) {
    return goes === CARRIER_RANGE
      ? `${Math.round(reach)} hexes — a group flying off a deck goes ${goes} and finds the ship again.`
      : `${Math.round(reach)} hexes — a bomber of 1939 goes ${goes} and comes back.`;
  }
  return null;
}

/**
 * Fly every strike ordered for today.
 *
 * Grouped by target like a raid, and for the same reason: everything one power
 * sends against one hex on one morning is one attack, because a large formation
 * saturates a defence that a small one is destroyed by.
 *
 * @returns {{strikes, losses}} what the troops on the ground suffered, and the
 *          bombers that did not come back — both as ordinary casualty entries.
 */
export function resolveStrikes({ world, day, striking, positions, strengths, flown, past }) {
  const strikes = [];
  const losses = [];
  const sent = new Set(flown ?? []);

  const missions = new Map();
  for (const [power, orders] of Object.entries(striking ?? {})) {
    for (const order of orders ?? []) {
      const column = world.garrisons.opening.find((c) => c.id === order?.column);
      if (!column || column.formation.nation !== power) continue;
      const why = mayStrike({
        world,
        column: { ...column, strength: strengths?.get(column.id) ?? column.strength },
        target: order.target,
        power,
        day,
        positions,
        flown: sent,
        ordered: new Set(),
      });
      if (why) continue;
      sent.add(column.id);
      const key = `${power}@${order.target}`;
      if (!missions.has(key)) missions.set(key, { power, target: order.target, columns: [] });
      missions.get(key).columns.push(column);
    }
  }

  for (const { power, target, columns } of [...missions.values()].sort(
    (a, b) => a.target - b.target || (a.power < b.power ? -1 : 1),
  )) {
    let bombers = 0;
    let weight = 0;
    let escort = 0;
    let escortWeight = 0;
    for (const column of columns) {
      const have = strengths?.get(column.id) ?? column.strength;
      const quality = column.formation.quality ?? 0.5;
      const n = have.bombers ?? 0;
      bombers += n;
      weight += n * quality;
      const f = have.fighters ?? 0;
      escort += f;
      escortWeight += f * quality;
    }
    const luck = raidLuck(day, target);
    weight *= luck;
    escortWeight *= luck;

    const against = defenceOf(world, target, power, positions, strengths, day);
    const fight = airCombat({
      guardFighters: against.fighters,
      guardFlak: against.flak,
      escort: escortWeight,
      bombers: weight,
    });
    const share = fight.bomberShare;
    const through = Math.max(0, Math.round(bombers * (1 - share)));

    // Who is under it, and how hard the ground is making it.
    const under = [];
    let men = 0;
    for (const column of world.garrisons.opening) {
      if ((positions?.get(column.id) ?? column.cell) !== target) continue;
      if (column.formation.nation === power) continue;
      if (!atWar(day, power, column.formation.nation, world, target)) continue;
      const have = strengths?.get(column.id) ?? column.strength;
      let any = 0;
      for (const arm of Object.keys(have)) any += have[arm];
      if (!any) continue;
      under.push(column);
      men += have.infantry ?? 0;
    }
    if (!under.length) continue;

    const cover = groundBonus(world, target);
    const hurt = men > 0
      ? Math.min(WORST_STRIKE, (through * MEN_PER_BOMBER) / cover / men)
      : 0;

    strikes.push({
      day,
      cell: target,
      power,
      columns: columns.map((c) => c.id),
      against: NATIONS[world.ownership.owner[target]]?.id ?? null,
      bombers,
      through,
      share,
      hurt,
      cover: Math.round(cover * 100) / 100,
      killed: Math.round(men * hurt),
      fighters: Math.round(against.fighters),
      flak: Math.round(against.flak),
      escort: Math.round(escort),
      escortShare: fight.escortShare,
      guardShare: fight.guardShare,
      columnsHit: under.map((c) => c.id),
    });

    // What it did to the men on the ground.
    if (hurt > 0) {
      losses.push({
        day,
        cell: target,
        strike: true,
        losers: under.map((c) => c.id),
        loserShare: hurt,
        winners: [],
        winnerShare: 0,
      });
    }

    // The fighters on both sides, if either was there.
    if (escort > 0 && fight.escortShare > 0) {
      losses.push({
        day,
        cell: target,
        strike: true,
        arms: ['fighters'],
        losers: columns.map((c) => c.id),
        loserShare: fight.escortShare,
        winners: [],
        winnerShare: 0,
      });
    }
    if (against.guards.length && fight.guardShare > 0) {
      losses.push({
        day,
        cell: target,
        strike: true,
        arms: ['fighters'],
        losers: against.guards,
        loserShare: fight.guardShare,
        winners: [],
        winnerShare: 0,
      });
    }

    // And what it cost the crews. Aircraft, not the fitters who armed them.
    losses.push({
      day,
      cell: target,
      strike: true,
      arms: ['bombers'],
      losers: columns.map((c) => c.id),
      loserShare: share,
      winners: [],
      winnerShare: 0,
    });
  }

  return { strikes, losses, flew: sent };
}
