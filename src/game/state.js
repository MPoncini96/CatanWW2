import { PLAYER_IDS, isPlayer } from './players.js';
import { eventsOn, nextEventAfter } from './events.js';
import { formatDate } from './calendar.js';
import { entersOn, isActive, warSummary } from './belligerence.js';
import { executeOrders, positionsAt } from './movement.js';
import { resolveDay, strengthsAt } from './combat.js';
import { canAfford, capacityFor, replacementFor, spentBy } from './production.js';
import { supplyFor } from './supply.js';
import { economyFor } from '../world/economy.js';

// The game itself: what day it is, who is playing, and who has finished.
//
// One game, and no clock. The calendar moves when every player in the war says
// it may — which means a day can last a minute or a fortnight, and the pace is
// entirely the players'. A seat nobody has claimed cannot hold the day up, or a
// game of three would never start.
//
// Nor can a seat that is not in the war yet. Italy on 1 September 1939 has
// nobody it may fight and nothing to decide, so it watches: it sees the board,
// the timeline and every dispatch, and the day turns without asking it. That
// comes straight off the event table — the day a power may first fight anybody
// is the day it starts voting — so nothing here has to be kept in step by hand.
//
// This module is pure. It never reads a clock, touches the network or writes a
// file; the server does all of that around it. That is what makes the whole
// turn engine testable under plain Node.

export function newGame() {
  return {
    version: 1,
    day: 0,
    seats: Object.fromEntries(PLAYER_IDS.map((id) => [id, null])),
    // Every event that has fired, oldest first — the game's own history.
    log: [],
    // Orders for tomorrow, per seat. Secret: a seat is only ever sent its own.
    // Cleared when the day turns, because an order is for one day.
    orders: {},
    // Marches that have actually happened, oldest first. Public, and the only
    // record of where an army is — every client replays it against the opening
    // deployment rather than being sent a map.
    moves: [],
    // And the fights, which are the other half of the same record: the moves
    // say where a column is and these say what is left of it.
    battles: [],
    // Ground that has changed hands, so a client can replay the map as well as
    // the armies.
    captures: [],
    // And what the factories put back, which is the third and last thing the
    // record has to say about a column: where it is, what the fighting took,
    // and what came up from the depots.
    replacements: [],
    // Works that have been bombed and the day each is expected back. Empty
    // until there is bombing; `capacityFor` already reads it, so the day a
    // raid lands the factories stop on their own.
    raids: [],
    // Which columns each seat wants replacements sent to tomorrow.
    rebuilding: {},
    // And the ones that were asked for and not sent, with the reason. The day
    // used to swallow these, which meant a player could ask for fifteen
    // columns, be given four, and never find out why — the most annoying kind
    // of silence a game can keep.
    refused: [],
    // Bumped on every change so clients can tell whether they are current.
    revision: 0,
  };
}

/** Take a seat. Returns the seat, or an error if it is already held. */
export function claim(game, power, token, name) {
  if (!isPlayer(power)) return { error: `${power} is not a seat at this table` };
  if (game.seats[power]) return { error: `${power} is already taken` };
  game.seats[power] = { token, name: name || null, ready: false, claimedOn: game.day };
  game.revision += 1;
  return { seat: game.seats[power] };
}

/** Give up a seat. The day may then advance without it. */
export function release(game, power) {
  if (!game.seats[power]) return { error: 'that seat is empty' };
  game.seats[power] = null;
  game.revision += 1;
  return {};
}

/** Which seat a token holds, or null. */
export function seatOf(game, token) {
  if (!token) return null;
  for (const power of PLAYER_IDS) {
    if (game.seats[power]?.token === token) return power;
  }
  return null;
}

/** Declare a player finished with today, or take it back. */
export function setReady(game, power, ready) {
  const seat = game.seats[power];
  if (!seat) return { error: 'that seat is empty' };
  if (!voters(game).includes(power)) {
    const when = entersOn(power);
    return {
      error: when === null
        ? 'you are not in the war, and the day turns without you'
        : 'you are not in the war yet, and the day turns without you',
    };
  }
  seat.ready = Boolean(ready);
  game.revision += 1;
  return { ready: seat.ready };
}

/** The seats that are held, in board order. */
export function occupied(game) {
  return PLAYER_IDS.filter((id) => game.seats[id] !== null);
}

/**
 * The seats whose vote the calendar waits for: the ones in the war.
 *
 * With one exception. A table where nobody is in the war yet — three players
 * who have taken Italy, the United States and China's neighbours on day 0 —
 * would never be able to move the calendar at all, and would sit at 1 September
 * for good. So when no seated power is in the war, every seated player votes:
 * they are all watching, and they can agree to watch faster.
 */
export function voters(game) {
  const held = occupied(game);
  const fighting = held.filter((id) => isActive(game.day, id));
  return fighting.length ? fighting : held;
}

/** Is this seat in the war today, rather than watching it? */
export function inTheWar(game, power) {
  return isActive(game.day, power);
}

/**
 * Should the calendar move on?
 *
 * Every player whose vote counts has to say so. An empty table never advances —
 * otherwise a game with nobody in it would run away to 1945 on its own the
 * moment it was created.
 */
export function readyToAdvance(game) {
  const voting = voters(game);
  if (voting.length === 0) return false;
  return voting.every((id) => game.seats[id].ready);
}

/**
 * Move to the next day.
 *
 * Everyone's readiness is cleared, and anything the timeline has to say about
 * the new date is written into the log for the clients to put in front of
 * their players.
 */
export function advance(game, world = null) {
  // The order of a day, and it matters: the marches happen, then whoever ends
  // up sharing a hex with somebody they are at war with fights over it, then
  // the beaten fall back — which is itself a march, stamped with the same day,
  // so that where an army is stays one question with one answer.
  game.day += 1;
  game.moves.push(...executeOrders(game.orders, game.day));
  game.orders = {};

  if (world) {
    const { battles, retreats, captures } = resolveDay({
      world,
      day: game.day,
      moves: game.moves,
      battles: game.battles,
      replacements: game.replacements,
    });
    game.battles.push(...battles);
    game.moves.push(...retreats);
    for (const capture of captures) {
      world.ownership.set(capture.cell, capture.to, { day: game.day, reason: 'taken' });
      game.captures.push(capture);
    }
    // And last, the replacements — after the fighting, so that a column cannot
    // be rebuilt into the middle of the battle it is losing.
    // A new day's refusals only. Yesterday's are of no use to anybody and the
    // list would otherwise grow for ever.
    game.refused = game.refused.filter((r) => r.day >= game.day);
    game.replacements.push(...sendReplacements(game, world));
    game.rebuilding = {};
  }
  for (const id of PLAYER_IDS) {
    if (game.seats[id]) game.seats[id].ready = false;
  }
  const fired = eventsOn(game.day).map((e) => ({
    id: e.id,
    day: e.day,
    name: e.name,
    text: e.text,
  }));
  game.log.push(...fired);
  game.revision += 1;
  return fired;
}

/**
 * Write down a seat's orders for tomorrow, replacing whatever it said before.
 *
 * Replacing rather than adding: a player who changes their mind is giving the
 * day's orders again, not a second set of them, and cancelling one column is
 * simply sending a shorter list.
 */
export function setOrders(game, power, orders, rebuilding = null) {
  if (!isPlayer(power)) return { error: `${power} is not a seat at this table` };
  game.orders[power] = orders;
  if (rebuilding !== null) game.rebuilding[power] = rebuilding;
  game.revision += 1;
  return { orders, rebuilding: game.rebuilding[power] ?? [] };
}

/**
 * Send up whatever each seat asked for and can pay for.
 *
 * Asked for, in the order it asked: a nation that wants six columns rebuilt and
 * can afford four gets the first four. That is a decision the player has
 * already made by the order they ticked them in, and it is better than a rule
 * that spreads the shortfall evenly and rebuilds nothing properly.
 *
 * The check is against the stores in hand — the opening stock, plus every day's
 * net since, less everything already spent — so the books stay derived from the
 * calendar and the record rather than being a balance that gets edited.
 */
function sendReplacements(game, world) {
  const sent = [];
  const refused = [];
  const columns = new Map(world.garrisons.opening.map((p) => [p.id, p]));
  const positions = positionsAt(world.garrisons.opening, game.moves, game.day);
  const left = strengthsAt(world.garrisons.opening, game.battles, game.day, game.replacements);

  for (const [power, wanted] of Object.entries(game.rebuilding ?? {})) {
    if (!wanted?.length) continue;
    const economy = economyFor(world, power, game.day, spentBy(game.replacements, power, game.day).stores);
    // Two things ration a day's replacements, and they are different things.
    // The stores say whether the metal exists; the factories say whether
    // anybody can turn it into rifles. A nation can be rich in steel and unable
    // to use it, which is most of what strategic bombing was for.
    const capacity = capacityFor(world, power, game.day, game.raids, economy.people);
    let plantDays = capacity.plantDays;
    const running = {};
    for (const id of wanted) {
      const column = columns.get(id);
      if (!column || column.formation.nation !== power) continue;
      const have = left.get(id);
      if (!have) continue;
      const where = positions.get(id) ?? column.cell;
      const want = replacementFor({
        world,
        column: { ...column, cell: where },
        have,
        day: game.day,
        supplied: supplyFor(world, power, game.day)[where] === 1,
      });
      if (!want) {
        refused.push({
          day: game.day,
          power,
          column: id,
          why: supplyFor(world, power, game.day)[where]
            ? 'already at full strength'
            : 'out of supply — nothing can be got to it',
        });
        continue;
      }
      if (want.effort > plantDays) {
        refused.push({ day: game.day, power, column: id, why: 'the factories were full' });
        continue;
      }
      const short = canAfford(economy, want.cost, running);
      if (short) {
        refused.push({ day: game.day, power, column: id, why: short });
        continue;
      }
      plantDays -= want.effort;
      for (const [store, amount] of Object.entries(want.cost)) {
        running[store] = (running[store] ?? 0) + amount;
      }
      sent.push({ day: game.day, power, column: id, ...want });
    }
  }
  game.refused.push(...refused);
  return sent;
}

/** Fire whatever the opening date has to say, once, when a game is created. */
export function openingEvents(game) {
  const fired = eventsOn(game.day).map((e) => ({
    id: e.id,
    day: e.day,
    name: e.name,
    text: e.text,
  }));
  game.log.push(...fired);
  game.revision += 1;
  return fired;
}

/**
 * Everything a client is allowed to see.
 *
 * Seat tokens never leave the server. Nothing else is secret yet — once orders
 * exist, this is the function that has to keep them from leaking, so it is
 * built from the start as a deliberate projection rather than the state itself.
 */
export function publicState(game, viewer) {
  const voting = voters(game);
  return {
    revision: game.revision,
    day: game.day,
    date: formatDate(game.day),
    you: viewer ?? null,
    seats: PLAYER_IDS.map((id) => ({
      power: id,
      taken: game.seats[id] !== null,
      name: game.seats[id]?.name ?? null,
      ready: game.seats[id]?.ready ?? false,
      isYou: id === viewer,
      // Whether this seat is fighting today or watching, and the day it gets
      // in. Both are derived from the timeline, but they are sent rather than
      // left to the client to work out, so that what the button does and what
      // the server will accept are one answer and not two.
      inTheWar: isActive(game.day, id),
      entersOn: entersOn(id),
      votes: voting.includes(id),
    })),
    war: warSummary(game.day, PLAYER_IDS),
    log: game.log,
    // Where every army has marched, for the client to replay. This is not a
    // secret and could not be one: the board is deterministic and every client
    // already builds every garrison from the same tables. What *is* secret is
    // what a seat intends to do tomorrow, which is why the orders below are
    // the viewer's own and nobody else's.
    moves: game.moves,
    battles: game.battles,
    captures: game.captures,
    replacements: game.replacements,
    refused: viewer ? (game.refused ?? []).filter((r) => r.power === viewer) : [],
    raids: game.raids,
    orders: viewer ? (game.orders[viewer] ?? []) : [],
    rebuilding: viewer ? (game.rebuilding[viewer] ?? []) : [],
    next: nextEventAfter(game.day),
    waitingOn: voting.filter((id) => !game.seats[id].ready),
  };
}
