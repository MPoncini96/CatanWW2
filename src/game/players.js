import { NATIONS, NEUTRAL } from '../world/nations.js';

// The seven seats.
//
// Every belligerent on the board is playable except two: the independents, who
// are nobody's to play, and France.
//
// **France is a country here, not a seat.** It keeps its colour, its ground,
// its army, its navy and its trade routes; what it does not have is anybody
// giving it orders. That is deliberate and it is the whole design of 1940 on
// this board: France is a thing that *happens to you* rather than a thing you
// play, and when Paris goes, six weeks of war resolve in a day and the map
// redraws itself from the Rhine to the Congo. Sitting a player there and asking
// them to lose on schedule would be a worse job than any of the seven left.
//
// It does *fight*, though. It used to sit in the Maginot and not move a
// division while every other empty chair on the board massed and attacked, so
// the one army that was supposed to make 1940 expensive was the only one that
// did nothing at all — which read as a bug rather than as a decision. France
// gets a staff like any unseated power. What it does not get is a seat.
//
// Nobody is locked out by date: Italy can be claimed on 1 September 1939, it
// simply has nobody it is allowed to fight until 10 June 1940.

export const UNPLAYED = new Set(['france']);

export const PLAYERS = NATIONS.map((nation, index) => ({ ...nation, index })).filter(
  (nation) => nation.index !== NEUTRAL && !UNPLAYED.has(nation.id),
);

export const PLAYER_IDS = PLAYERS.map((p) => p.id);

export function isPlayer(id) {
  return PLAYER_IDS.includes(id);
}

export function playerNamed(id) {
  return PLAYERS.find((p) => p.id === id) ?? null;
}
