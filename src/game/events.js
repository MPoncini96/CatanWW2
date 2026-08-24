import { dayOf } from './calendar.js';

// The war, as it actually happened, on the days it happened.
//
// Each entry is a date and what that date changed. Nothing here describes a
// move a player makes — these are the events the world hands the players, and
// what they grant is permission: who may fight whom, from when.
//
// The list is deliberately thin. Every extra event is one more row, and because
// rights are replayed from this list rather than stored alongside the game, an
// event added later applies correctly to a game already in progress.

/**
 * A side in a war grant. One of:
 *   { power: 'germany' }            a belligerent power
 *   { country: 'Poland' }           a single country by name
 *   { ledBy: ['uk', 'france'] }     those powers and every country they hold
 *   { sameAs: 'germany' }           whoever that power may currently fight
 */
export const EVENTS_1939 = [
  {
    id: 'invasion-of-poland',
    day: dayOf(1939, 9, 1),
    name: 'The invasion of Poland',
    text:
      'At a quarter to five this morning, without a declaration of war, German ' +
      'forces crossed the Polish frontier from Silesia, Pomerania and East ' +
      'Prussia. Warsaw is being bombed. No other power has moved.',
    wars: [[{ power: 'germany' }, { country: 'Poland' }]],
  },
  {
    id: 'britain-and-france-declare-war',
    day: dayOf(1939, 9, 3),
    name: 'Britain and France declare war',
    text:
      'The German government having failed to answer the ultimatum, Britain has ' +
      'been at war with Germany since eleven this morning, and France since five ' +
      'this afternoon. Their empires come with them.',
    wars: [[{ power: 'germany' }, { ledBy: ['uk', 'france'] }]],
  },
  {
    id: 'soviet-invasion-of-poland',
    day: dayOf(1939, 9, 17),
    name: 'The Soviet invasion of Poland',
    text:
      'The Red Army has crossed the eastern frontier in strength, the Polish ' +
      'government having, in Moscow’s words, ceased to exist. Poland is now ' +
      'fighting on two fronts.',
    wars: [[{ power: 'ussr' }, { country: 'Poland' }]],
  },
  {
    id: 'italy-enters-the-war',
    day: dayOf(1940, 6, 10),
    name: 'Italy enters the war',
    text:
      'From the balcony of the Palazzo Venezia, Mussolini has declared war on ' +
      'Britain and France. Italy takes the field against everything Germany is ' +
      'already fighting.',
    wars: [[{ power: 'italy' }, { sameAs: 'germany' }]],
  },
];

/** Every event that has happened on or before this day, in order. */
export function eventsThrough(day) {
  return EVENTS_1939.filter((e) => e.day <= day);
}

/** Events landing exactly on this day — what to put in front of the players. */
export function eventsOn(day) {
  return EVENTS_1939.filter((e) => e.day === day);
}

/** The next event still to come, or null once the timeline runs out. */
export function nextEventAfter(day) {
  return EVENTS_1939.find((e) => e.day > day) ?? null;
}
