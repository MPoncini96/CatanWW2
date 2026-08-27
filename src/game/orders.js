import { mayFight } from './belligerence.js';

// What a nation may order on a hex.
//
// Nothing here moves anything yet — the turn engine takes no orders, and this
// file will be where they are validated when it does. What it does now is
// decide which of the three are *offerable* on a given hex on a given day, and
// say why when one is not, because a button that is greyed out without a reason
// is worse than no button.
//
// The rules are read off the board rather than invented: the war table decides
// whom you may attack, and ownership decides whose ground you may stand on. So
// on 1 September Germany may attack a Polish hex and not a French one, and by
// the 3rd it may attack both — without a line of this file changing.

export const ORDERS = [
  {
    id: 'reinforce',
    name: 'Reinforce',
    hint: 'Bring men and machines up to this hex.',
  },
  {
    id: 'attack',
    name: 'Attack',
    hint: 'Go forward against the ground in front of you.',
  },
  {
    id: 'replacements',
    name: 'Replacements',
    hint: 'Spend the stores to bring the formations here back up to strength.',
  },
  {
    id: 'bomb',
    name: 'Bomb the works',
    hint: 'Send the bombers, and put the factory here out of action for days.',
  },
  {
    id: 'sail',
    name: 'Sail here',
    hint: 'Send a fleet to this water, and fight whatever it finds on it.',
  },
];

/**
 * Which parties the war table might know this hex by.
 *
 * Both, because they are not the same question and neither answers on its own.
 * A country can be a belligerent its owner is not — Poland is Independent
 * ground and the reason the war started — so a table asked only about powers
 * could not tell you that Germany may attack Warsaw today. But a metropole is
 * deliberately *not* a separate party: 'france' the power and 'France' the
 * country are one belligerent and the table only carries the first, so a table
 * asked only about countries says Germany may not attack Paris on the third of
 * September, which is the day it declares.
 *
 * So: ask about both, and a war with either is a war.
 */
export function partiesAt(tile) {
  if (!tile?.nation) return [];
  const out = [];
  if (tile.country?.name) out.push(tile.country.name);
  if (tile.nation.id !== 'neutral') out.push(tile.nation.id);
  return out;
}

/** What to call this hex to a reader: the country if it has one. */
export function partyAt(tile) {
  if (!tile?.nation) return null;
  return tile.country?.name ?? tile.nation.id;
}

/**
 * The three orders, each with whether it may be given here and why not.
 *
 * @param {{power: string|null, day: number, tile: object|null}} at
 * @returns {Array<{id, name, hint, allowed, why}>}
 */
export function ordersFor({ power, day = 0, tile = null }) {
  const decide = (order) => {
    if (!power) return 'Nobody is sitting at this seat.';
    if (!tile) return 'No hex is selected.';
    const mine = tile.nation?.id === power;
    const parties = partiesAt(tile);

    // Named by its country wherever it has one. "This ground is Independent’s"
    // is true and useless: the pooled neutral is thirty armies, and the one
    // standing here is Poland’s.
    const held = tile.country?.name ?? tile.nation?.name;

    // Sailing is the only order given about water, and the only one that asks
    // nothing at all about who holds the hex — because nobody holds it. The sea
    // is not owned, is not captured, and is not defended; it is only ever
    // occupied by whoever is currently floating on it.
    if (order.id === 'sail') {
      return tile.terrain?.water ? null : 'A ship cannot go inland.';
    }

    if (order.id === 'reinforce') {
      if (!tile.nation) return 'There is no ground here to reinforce.';
      return mine ? null : `This ground is ${held}’s.`;
    }

    if (order.id === 'attack') {
      if (!tile.nation) return 'There is nobody here to attack.';
      if (mine) return 'You cannot attack your own ground.';
      if (!parties.length) return 'Nothing on this hex answers to anybody.';
      const war = parties.some((party) => mayFight(day, power, party));
      return war ? null : `You are not at war with ${held}.`;
    }

    // Bombing is the one order that is not about the ground. It asks nothing
    // about who is standing on the hex and everything about what is built on
    // it: a works, held by somebody you are fighting, within reach of an
    // aerodrome of yours.
    if (order.id === 'bomb') {
      if (!tile.works?.length) return 'There is no works here to put out of action.';
      if (mine) return 'That is your own factory.';
      if (!parties.length) return 'Nothing on this hex answers to anybody.';
      return parties.some((party) => mayFight(day, power, party))
        ? null
        : `You are not at war with ${held}.`;
    }

    // Replacements go to troops you already have standing somewhere. Retreat
    // used to be an option and is not offered any more, because it is not a
    // decision: a beaten army falls back on its own, and asking seven seats to
    // choose each time would stall the day for the sake of an order the men on
    // the ground were carrying out without one.
    const men = tile.forces?.reduce((sum, arm) => sum + arm.count, 0) ?? 0;
    if (!men) return 'Nothing of yours is standing here.';
    if (!mine && !tile.garrison?.some((unit) => unit.nation === power)) {
      return 'This is not your ground.';
    }
    return null;
  };

  return ORDERS.map((order) => {
    const why = decide(order);
    return { ...order, allowed: why === null, why };
  });
}
