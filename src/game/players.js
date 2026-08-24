import { NATIONS, NEUTRAL } from '../world/nations.js';

// The eight seats.
//
// Every belligerent on the board is playable, which is the whole list minus the
// independents. Nobody is locked out by date: Italy can be claimed on 1
// September 1939, it simply has nobody it is allowed to fight until 10 June
// 1940. The same is true of the United States, which has no entry event yet.

export const PLAYERS = NATIONS.map((nation, index) => ({ ...nation, index })).filter(
  (nation) => nation.index !== NEUTRAL,
);

export const PLAYER_IDS = PLAYERS.map((p) => p.id);

export function isPlayer(id) {
  return PLAYER_IDS.includes(id);
}

export function playerNamed(id) {
  return PLAYERS.find((p) => p.id === id) ?? null;
}
