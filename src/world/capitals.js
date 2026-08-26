import { cellAt, grid } from './sphere.js';

// Where the governments sat on 1 September 1939.
//
// A capital is one rule and one rule only here: **nobody retreats out of one.**
// An army beaten on any other hex falls back onto its own ground; an army
// beaten on the hex its government sits on is destroyed where it stands. That
// is not sentiment, it is what happened — Warsaw held for three weeks after the
// campaign around it was decided, and the Polish army in the pocket did not
// withdraw because there was no longer anywhere to withdraw to that mattered.
//
// The coordinates are the cities themselves; the cell is worked out from the
// grid, so the list stays readable and moving to a finer grid changes nothing.

export const CAPITALS_1939 = [
  ['Berlin', 52.52, 13.4, 'germany'],
  ['London', 51.5, -0.13, 'uk'],
  ['Paris', 48.86, 2.35, 'france'],
  ['Moscow', 55.75, 37.62, 'ussr'],
  ['Rome', 41.9, 12.5, 'italy'],
  ['Tokyo', 35.69, 139.69, 'japan'],
  ['Washington', 38.9, -77.04, 'usa'],
  // Nanjing had fallen in 1937 and the government had gone up the Yangtze.
  ['Chongqing', 29.56, 106.55, 'china'],
  // The neutrals, each of which is its own belligerent when its turn comes.
  ['Warsaw', 52.23, 21.01, 'Poland'],
  ['Brussels', 50.85, 4.35, 'Belgium'],
  ['Amsterdam', 52.37, 4.9, 'Netherlands'],
  ['Helsinki', 60.17, 24.94, 'Finland'],
  ['Oslo', 59.91, 10.75, 'Norway'],
  ['Stockholm', 59.33, 18.07, 'Sweden'],
  ['Copenhagen', 55.68, 12.57, 'Denmark'],
  ['Belgrade', 44.79, 20.45, 'Yugoslavia'],
  ['Bucharest', 44.43, 26.1, 'Romania'],
  ['Budapest', 47.5, 19.04, 'Hungary'],
  ['Sofia', 42.7, 23.32, 'Bulgaria'],
  ['Athens', 37.98, 23.73, 'Greece'],
  ['Ankara', 39.93, 32.86, 'Turkey'],
  ['Madrid', 40.42, -3.7, 'Spain'],
  ['Lisbon', 38.72, -9.14, 'Portugal'],
  ['Bern', 46.95, 7.45, 'Switzerland'],
  ['Prague', 50.08, 14.44, 'Bohemia and Moravia'],
  ['Vienna', 48.21, 16.37, 'Austria'],
];

let cache = null;

/** The cells the governments sit on. Worked out once. */
export function CAPITAL_CELLS() {
  if (cache) return cache;
  const sphere = grid();
  cache = new Set(CAPITALS_1939.map(([, lat, lon]) => cellAt(sphere, lat, lon)));
  return cache;
}

/** Whose capital is on this cell, if any. */
export function capitalAt(cell) {
  const sphere = grid();
  for (const [name, lat, lon, whose] of CAPITALS_1939) {
    if (cellAt(sphere, lat, lon) === cell) return { name, whose };
  }
  return null;
}
