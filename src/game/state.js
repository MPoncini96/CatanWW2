import { PLAYER_IDS, isPlayer } from './players.js';
import { eventsOn, nextEventAfter } from './events.js';
import { formatDate } from './calendar.js';
import { entersOn, isActive, warSummary } from './belligerence.js';

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
export function advance(game) {
  game.day += 1;
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
    next: nextEventAfter(game.day),
    waitingOn: voting.filter((id) => !game.seats[id].ready),
  };
}
