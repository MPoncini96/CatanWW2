import { PLAYER_IDS, isPlayer } from './players.js';
import { eventsOn, nextEventAfter } from './events.js';
import { formatDate } from './calendar.js';
import { entersOn, isActive, warSummary } from './belligerence.js';
import { executeOrders, positionsAt } from './movement.js';
import { resolveDay, strengthsAt } from './combat.js';
import { resolveRaids } from './bombing.js';
import { canAfford, capacityFor, replacementFor, spentBy } from './production.js';
import { supplyFor } from './supply.js';
import { economyFor } from '../world/economy.js';
import { engagedCells, fleetsAt, resolveNavalDay } from './naval.js';
import { applyCapitulation, capitulationsOn, displayName } from './capitulation.js';
import { defeats, heldCells, standings, victory } from './victory.js';

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
    // And which bomber groups are to fly, and against what.
    raiding: {},
    // Which fleets are to weigh anchor tomorrow, and for where.
    sailing: {},
    // Where they have actually gone, which is to a fleet what `moves` is to a
    // column: the only record of where it is.
    sailings: [],
    // And the actions, which say what is left of it.
    seaBattles: [],
    // Convoys that did not get through, and the day the lane runs again. The
    // economy reads this directly, so a lane cut this morning stops paying
    // into the stores this morning.
    sinkings: [],
    // Governments that have stopped governing, and where their ground went.
    // The largest single events on the board: one of these moves more hexes in
    // a morning than a month of fighting does.
    capitulations: [],
    // Axis powers that are finished, in the order they finished. Derived from
    // the board every day and written down once, because "when did Italy leave
    // the war" should have one answer for ever after.
    beaten: [],
    // And the end of it: null while the war is still going.
    over: null,
    // And the ones that were asked for and not sent, with the reason. The day
    // used to swallow these, which meant a player could ask for fifteen
    // columns, be given four, and never find out why — the most annoying kind
    // of silence a game can keep.
    refused: [],
    // Bumped on every change so clients can tell whether they are current.
    revision: 0,
    // When the current day opened, so it can close on its own. Eight seats and
    // no clock means one person going to bed stops the war, and there was no
    // way at all to proceed without them.
    opened: 0,
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
/**
 * How long a day may stay open before it turns without everybody.
 *
 * A day that only ends when all seven seats have said so is a day that ends
 * when the slowest player wakes up. Anyone who has not finished simply does not
 * get to give orders — which is a real cost, and is the point: the war does not
 * wait, and neither did any of the actual staffs.
 */
export const DAY_LENGTH_MS = 24 * 60 * 60 * 1000;

/** Has this day been open long enough to close itself? */
export function overdue(game, now, limit = DAY_LENGTH_MS) {
  // Never on an unattended game. A board nobody is sitting at should stay where
  // it was left, not run through the war on its own overnight.
  if (!occupied(game).length) return false;
  if (!game.opened) return false;
  return now - game.opened >= limit;
}

/** When the current day will close of its own accord, if nobody closes it. */
export function closesAt(game, limit = DAY_LENGTH_MS) {
  return game.opened ? game.opened + limit : null;
}

/** What a government falling reads as in the log. */
function capitulationText(fallen) {
  const parts = [
    `${fallen.metropoleCells} hexes of ${displayName(fallen.country)} pass to ` +
      `${displayName(fallen.to)}`,
  ];
  if (fallen.empireCells) {
    parts.push(
      fallen.empire === 'neutral'
        ? `${fallen.empireCells} hexes of empire go their own way — ${fallen.note}`
        : `${fallen.empireCells} hexes of empire pass to ${displayName(fallen.empire)}` +
          (fallen.note ? ` — ${fallen.note}` : ''),
    );
  }
  const arms = [];
  if (fallen.forces.length) arms.push(`${fallen.forces.length} formations`);
  if (fallen.fleets.length) arms.push(`${fallen.fleets.length} fleets`);
  const stood = arms.length ? ` ${arms.join(' and ')} lay down their arms.` : '';
  return `${parts.join(', and ')}.${stood}`;
}

/**
 * Recompute the scoreboard.
 *
 * Called when the ground moves, not when somebody asks for it: it walks the map
 * and the map changes once a day, while `publicState` goes out every time
 * anybody does anything.
 */
export function refreshStandings(game, world) {
  if (!world) return null;
  game.standings = standings(world, game);
  return game.standings;
}

export function advance(game, world = null, now = 0) {
  // A finished war does not have another day in it.
  if (game.over) return [];

  // The order of a day, and it matters: the marches happen, then whoever ends
  // up sharing a hex with somebody they are at war with fights over it, then
  // the beaten fall back — which is itself a march, stamped with the same day,
  // so that where an army is stays one question with one answer.
  game.day += 1;
  game.moves.push(...executeOrders(game.orders, game.day));
  game.orders = {};

  if (world) {
    // The sea goes first. Not for its own sake — nothing on land depends on
    // who won an action in the Atlantic — but because a battleship's guns
    // count towards a fight on the coast only if the battleship is not itself
    // in one, and this is where that is settled.
    const sea = resolveNavalDay({
      world,
      day: game.day,
      sailing: game.sailing,
      sailings: game.sailings,
      seaBattles: game.seaBattles,
      sinkings: game.sinkings,
    });
    game.sailings.push(...sea.sailings);
    game.seaBattles.push(...sea.battles);
    game.sinkings.push(...sea.sinkings);
    game.sailing = {};

    const afloat = fleetsAt(world, game, game.day).filter((f) => f.afloat);
    const navy = {
      fleets: afloat,
      positions: new Map(afloat.map((f) => [f.id, f.cell])),
      engaged: engagedCells(sea.battles),
    };

    const { battles, retreats, captures } = resolveDay({
      world,
      day: game.day,
      moves: game.moves,
      battles: game.battles,
      replacements: game.replacements,
      navy,
    });
    game.battles.push(...battles);
    game.moves.push(...retreats);
    for (const capture of captures) {
      world.ownership.set(capture.cell, capture.to, { day: game.day, reason: 'taken' });
      game.captures.push(capture);
    }

    // And then the governments. This runs after the day's captures are on the
    // record, because the question it asks is about the record: is somebody
    // standing in a capital this morning who was also standing in it yesterday
    // morning? A capital taken today is a raid and the country has until
    // tomorrow to take it back.
    for (const fallen of capitulationsOn({
      world,
      day: game.day,
      captures: game.captures,
      already: game.capitulations,
    })) {
      const { captures: handed, stoodDown, interned, shut } = applyCapitulation(world, fallen);
      // In one go: this is thousands of hexes, and handing them over one at a
      // time would tell every listener thousands of times that the map changed.
      world.ownership.replay(handed);
      game.captures.push(...handed);
      if (stoodDown) game.battles.push(stoodDown);
      if (interned) game.seaBattles.push(interned);
      game.sinkings.push(...shut);
      game.capitulations.push(fallen);
      game.log.push({
        id: `capitulation:${fallen.country}`,
        day: game.day,
        name: `${displayName(fallen.country)} capitulates`,
        text: capitulationText(fallen),
      });
    }
    // And last, the replacements — after the fighting, so that a column cannot
    // be rebuilt into the middle of the battle it is losing.
    // The bombers go before the depots do, because a works that was put out
    // this morning cannot make anything this afternoon. That single ordering
    // is the whole of what strategic bombing does here.
    const flying = resolveRaids({
      world,
      day: game.day,
      raiding: game.raiding,
      positions: positionsAt(world.garrisons.opening, game.moves, game.day),
      strengths: strengthsAt(world.garrisons.opening, game.battles, game.day, game.replacements),
      past: game.raids,
    });
    game.raids.push(...flying.raids);
    game.battles.push(...flying.losses);
    game.raiding = {};

    // Who is out of the war. Checked after the ground has finished moving, so
    // that a capital taken this morning counts today rather than tomorrow.
    const beaten = defeats(world, game);
    for (const [power, state] of Object.entries(beaten)) {
      if (!state.defeated) continue;
      if (game.beaten.some((b) => b.power === power)) continue;
      game.beaten.push({ power, day: game.day, why: state.why });
      game.log.push({
        id: `beaten:${power}`,
        day: game.day,
        name: `${displayName(power)} is beaten`,
        text: `${state.why}. ${displayName(power)} is out of the war.`,
      });

      // Italy goes home. The armistice of 3 September 1943 did not hand Italy
      // to anybody — it took Italy out, and left the ground for whoever wanted
      // to walk onto it, which both sides then spent twenty months doing.
      if (power === 'italy') {
        const italian = heldCells(world, 'italy').map((cell) => ({
          day: game.day,
          cell,
          to: 'neutral',
          from: 'italy',
          armistice: true,
        }));
        world.ownership.replay(italian);
        game.captures.push(...italian);
        game.log.push({
          id: 'armistice:italy',
          day: game.day,
          name: 'The Italian armistice',
          text:
            `${italian.length} hexes of Italian ground pass out of the war altogether. ` +
            'Nobody inherits it; both sides may walk onto it.',
        });
      }
    }

    refreshStandings(game, world);

    // And whether that is the end.
    const won = victory(world, game);
    if (won) {
      game.over = { ...won, day: game.day };
      game.log.push({
        id: 'victory',
        day: game.day,
        name: won.side === 'allies' ? 'The Allies have won' : 'The Axis has won',
        text: `${won.why[0].toUpperCase()}${won.why.slice(1)}.`,
      });
    }

    // And last, the replacements — after the fighting and after the bombing,
    // so that a column cannot be rebuilt into the middle of the battle it is
    // losing, out of a factory that is on fire.
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
  game.opened = now;
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
export function setOrders(
  game,
  power,
  orders,
  rebuilding = null,
  raiding = null,
  sailing = null,
) {
  if (!isPlayer(power)) return { error: `${power} is not a seat at this table` };
  if (game.over) return { error: 'The war is over.' };
  if (game.beaten?.some((b) => b.power === power)) {
    return { error: `${displayName(power)} is out of the war.` };
  }
  game.orders[power] = orders;
  if (rebuilding !== null) game.rebuilding[power] = rebuilding;
  if (raiding !== null) game.raiding[power] = raiding;
  if (sailing !== null) game.sailing[power] = sailing;
  game.revision += 1;
  return {
    orders,
    rebuilding: game.rebuilding[power] ?? [],
    raiding: game.raiding[power] ?? [],
    sailing: game.sailing[power] ?? [],
  };
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
    const economy = economyFor(
      world,
      power,
      game.day,
      spentBy(game.replacements, power, game.day).stores,
      game.sinkings,
    );
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
export function publicState(game, viewer, limit = DAY_LENGTH_MS) {
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
    // When this day closes on its own, so a client can show the clock and
    // nobody has to guess how long they have.
    closesAt: closesAt(game, limit),
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
    // The sea is as public as the land, and for the same reason: a fleet at
    // sea is a thing anybody with a coastguard can see. Where it is *going* is
    // the viewer's own business, and is below with the rest of tomorrow.
    sailings: game.sailings,
    seaBattles: game.seaBattles,
    sinkings: game.sinkings,
    capitulations: game.capitulations,
    beaten: game.beaten,
    // How close the end is. Worked out when the board changes rather than when
    // somebody asks — it costs a walk of the map, and the map only moves once a
    // day, while this goes out on every broadcast.
    standings: game.standings ?? null,
    over: game.over,
    orders: viewer ? (game.orders[viewer] ?? []) : [],
    rebuilding: viewer ? (game.rebuilding[viewer] ?? []) : [],
    raiding: viewer ? (game.raiding[viewer] ?? []) : [],
    sailing: viewer ? (game.sailing[viewer] ?? []) : [],
    next: nextEventAfter(game.day),
    waitingOn: voting.filter((id) => !game.seats[id].ready),
  };
}
