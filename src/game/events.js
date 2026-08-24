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
//
// It is also the turn order. A power that has nobody to fight has nothing to
// decide, so a seat only votes on the end of the day once the timeline has put
// it in the war: Italy watches until 10 June 1940 and the United States until
// 7 December 1941, exactly as they did. Every one of the eight has a row here
// that lets it in, and the day it arrives is read off this table rather than
// written down anywhere else.
//
// Rows must stay in date order: `sameAs` is resolved against the wars declared
// before it, and the replay walks the list once, in order.

/**
 * A side in a war grant. One of:
 *   { power: 'germany' }            a belligerent power
 *   { country: 'Poland' }           a single country by name
 *   { ledBy: ['uk', 'france'] }     those powers and every country they hold
 *   { sameAs: 'germany' }           whoever that power may currently fight
 */
export const EVENTS_1939 = [
  {
    id: 'the-war-in-china',
    day: dayOf(1939, 9, 1),
    name: 'The war in China',
    text:
      'The war in China is two years old. Japan holds the coast, the north China ' +
      'plain, the Yangtze as far as Wuhan and, since February, Hainan; the ' +
      'Nationalist government fights on from Chongqing. Neither side has ever ' +
      'declared war, and both have been fighting since the Marco Polo Bridge.',
    wars: [[{ power: 'japan' }, { power: 'china' }]],
  },
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
    id: 'the-winter-war',
    day: dayOf(1939, 11, 30),
    name: 'The Winter War',
    text:
      'The Soviet Union has bombed Helsinki and crossed the Karelian frontier, ' +
      'having first announced a government of its own for Finland. The League of ' +
      'Nations expels it a fortnight later. Britain and France weigh sending help ' +
      'and cannot agree how.',
    wars: [[{ power: 'ussr' }, { country: 'Finland' }]],
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
  {
    id: 'barbarossa',
    day: dayOf(1941, 6, 22),
    name: 'Operation Barbarossa',
    text:
      'Three million men crossed the Soviet frontier this morning on a front of ' +
      'two thousand miles, without a declaration and in breach of the pact signed ' +
      'in Moscow twenty-two months ago. Italy and Romania have declared war on ' +
      'the Soviet Union the same day.',
    wars: [
      [{ power: 'germany' }, { power: 'ussr' }],
      [{ power: 'italy' }, { power: 'ussr' }],
    ],
  },
  {
    id: 'pearl-harbor',
    day: dayOf(1941, 12, 7),
    name: 'Pearl Harbor',
    text:
      'Japanese carrier aircraft attacked the Pacific Fleet at its moorings this ' +
      'morning without warning, and within hours Japan was ashore in Malaya and ' +
      'over Hong Kong. The United States and the British Empire are at war with ' +
      'Japan.',
    wars: [[{ power: 'japan' }, { ledBy: ['usa', 'uk'] }]],
  },
  {
    id: 'germany-declares-on-america',
    day: dayOf(1941, 12, 11),
    name: 'Germany declares war on the United States',
    text:
      'Germany and Italy have declared war on the United States, which was under ' +
      'no obligation to declare war on them. The two halves of the war are now ' +
      'one war.',
    wars: [
      [{ power: 'germany' }, { ledBy: ['usa'] }],
      [{ power: 'italy' }, { ledBy: ['usa'] }],
    ],
  },
];

// The replay walks this list once, in order, so a row out of date order would
// resolve `sameAs` against a future it has not seen yet.
for (let i = 1; i < EVENTS_1939.length; i += 1) {
  if (EVENTS_1939[i].day < EVENTS_1939[i - 1].day) {
    throw new Error(`events out of order: ${EVENTS_1939[i].id} precedes ${EVENTS_1939[i - 1].id}`);
  }
}

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
