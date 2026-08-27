import { cellAt, grid, neighbours } from './sphere.js';
import { T } from './terrain.js';

// The islands the baked Earth is too coarse to hold.
//
// A hex is 4,455 km². Iwo Jima is 21 km², Tarawa is 31, Wake is 7, Midway is 6.
// At this resolution the entire Central Pacific rounds to open water, and it
// did: of twenty-four places the Pacific war was decided at, twenty-one came
// out of `earth.bin` as ocean — Guadalcanal, Okinawa, Saipan, the Marianas, the
// Marshalls, the whole Aleutian chain, and Pearl Harbor.
//
// The ownership tables already knew about them and had nowhere to put them.
// Guam, Wake, the Marianas, the Carolines, the Marshalls, the Solomons and the
// Western Aleutians all had territory boxes claiming exactly **zero hexes**,
// because a box can only claim ground that exists.
//
// So this table puts the ground there. Each island is stamped onto the nearest
// cell and grown outward to the size it should be, before terrain, population,
// resources or ownership are worked out — after which everything downstream
// treats them as ordinary land and the boxes claim them without a line
// changing.
//
// `hexes` is the real area rounded up to at least one, because an island that
// is smaller than a cell is still an island somebody has to land on. Sizes are
// deliberately not generous: Guadalcanal is one hex, and the point of it was
// never its size.

/** Tropical rock and coral. Everything in the Central and South Pacific. */
const ATOLL = { terrain: T.beach, elevation: 0.002 };
/** Something with a jungle interior and a ridge in it, which is what made them awful. */
const VOLCANIC = { terrain: T.jungle, elevation: 0.03 };
/** The Aleutians: no trees, fog nine days in ten, and williwaws. */
const ARCTIC = { terrain: T.tundra, elevation: 0.02 };

export const ISLANDS_1939 = [
  // ------------------------------------------------------- the Aleutian chain
  // Attu and Kiska were invaded in June 1942 and held for over a year — the
  // only American soil occupied in the war, and the reason a whole fleet spent
  // 1943 in the fog off Alaska.
  { name: 'Attu', lat: 52.9, lon: 173.2, hexes: 1, ...ARCTIC },
  { name: 'Kiska', lat: 51.98, lon: 177.5, hexes: 1, ...ARCTIC },
  { name: 'Adak', lat: 51.85, lon: -176.65, hexes: 1, ...ARCTIC },
  { name: 'Amchitka', lat: 51.5, lon: 179.0, hexes: 1, ...ARCTIC },
  { name: 'Atka', lat: 52.2, lon: -174.2, hexes: 1, ...ARCTIC },
  { name: 'Unalaska', lat: 53.9, lon: -166.5, hexes: 1, ...ARCTIC },
  { name: 'Umnak', lat: 53.25, lon: -168.4, hexes: 1, ...ARCTIC },

  // ------------------------------------------------------------------ Hawaii
  // The board had two hexes of Hawaii and neither of them was Oahu, so Pearl
  // Harbor was a stretch of open ocean with a fleet moored on it.
  { name: 'Oahu', lat: 21.45, lon: -157.98, hexes: 1, terrain: T.jungle, elevation: 0.02 },
  { name: 'Kauai', lat: 22.05, lon: -159.5, hexes: 1, ...VOLCANIC },
  { name: 'Midway', lat: 28.2, lon: -177.37, hexes: 1, ...ATOLL },
  { name: 'Johnston', lat: 16.73, lon: -169.53, hexes: 1, ...ATOLL },

  // ----------------------------------------------------- the Central Pacific
  { name: 'Wake', lat: 19.28, lon: 166.65, hexes: 1, ...ATOLL },
  { name: 'Guam', lat: 13.45, lon: 144.75, hexes: 1, ...VOLCANIC },
  { name: 'Saipan', lat: 15.2, lon: 145.75, hexes: 1, ...VOLCANIC },
  { name: 'Tinian', lat: 15.0, lon: 145.62, hexes: 1, ...ATOLL },
  { name: 'Iwo Jima', lat: 24.78, lon: 141.32, hexes: 1, ...VOLCANIC },
  { name: 'Chichi Jima', lat: 27.07, lon: 142.2, hexes: 1, ...VOLCANIC },
  { name: 'Okinawa', lat: 26.33, lon: 127.8, hexes: 1, ...VOLCANIC },
  { name: 'Truk', lat: 7.42, lon: 151.78, hexes: 1, ...ATOLL },
  { name: 'Palau', lat: 7.5, lon: 134.55, hexes: 1, ...VOLCANIC },
  { name: 'Peleliu', lat: 7.0, lon: 134.25, hexes: 1, ...ATOLL },
  { name: 'Yap', lat: 9.53, lon: 138.13, hexes: 1, ...ATOLL },
  { name: 'Ponape', lat: 6.87, lon: 158.22, hexes: 1, ...VOLCANIC },
  { name: 'Kwajalein', lat: 9.2, lon: 167.48, hexes: 1, ...ATOLL },
  { name: 'Eniwetok', lat: 11.5, lon: 162.33, hexes: 1, ...ATOLL },
  { name: 'Majuro', lat: 7.1, lon: 171.38, hexes: 1, ...ATOLL },
  { name: 'Tarawa', lat: 1.35, lon: 173.0, hexes: 1, ...ATOLL },
  { name: 'Makin', lat: 3.37, lon: 172.9, hexes: 1, ...ATOLL },

  // -------------------------------------------------------- the South Pacific
  { name: 'Rabaul', lat: -4.4, lon: 152.1, hexes: 2, ...VOLCANIC },
  { name: 'Guadalcanal', lat: -9.5, lon: 160.1, hexes: 1, ...VOLCANIC },
  { name: 'Tulagi', lat: -9.1, lon: 160.15, hexes: 1, ...ATOLL },
  { name: 'New Georgia', lat: -8.3, lon: 157.4, hexes: 1, ...VOLCANIC },
  { name: 'Santa Isabel', lat: -8.0, lon: 159.1, hexes: 1, ...VOLCANIC },
  { name: 'Espiritu Santo', lat: -15.4, lon: 166.9, hexes: 1, ...VOLCANIC },
  { name: 'Efate', lat: -17.7, lon: 168.35, hexes: 1, ...VOLCANIC },
  { name: 'New Caledonia', lat: -21.5, lon: 165.5, hexes: 2, ...VOLCANIC },
  { name: 'Fiji', lat: -17.8, lon: 178.0, hexes: 2, ...VOLCANIC },
  { name: 'Samoa', lat: -13.8, lon: -172.0, hexes: 1, ...VOLCANIC },
  // Tutuila separately from Western Samoa, because they were two countries with
  // two flags and the naval station at Pago Pago was one of them.
  { name: 'Tutuila', lat: -14.3, lon: -170.7, hexes: 1, ...VOLCANIC },
  { name: 'Tahiti', lat: -17.65, lon: -149.45, hexes: 1, ...VOLCANIC },
  { name: 'Nauru', lat: -0.53, lon: 166.93, hexes: 1, ...ATOLL },
  { name: 'Canton', lat: -2.8, lon: -171.7, hexes: 1, ...ATOLL },

  // ------------------------------------------------------------- and the rest
  { name: 'Corregidor', lat: 14.39, lon: 120.58, hexes: 1, ...ATOLL },
  { name: 'Ceylon', lat: 7.6, lon: 80.7, hexes: 2, terrain: T.jungle, elevation: 0.03 },
  { name: 'Andaman Islands', lat: 12.0, lon: 92.8, hexes: 1, ...VOLCANIC },
  { name: 'Diego Garcia', lat: -7.3, lon: 72.4, hexes: 1, ...ATOLL },
  // Mauritius, which the island stations were garrisoning from a hex of open
  // ocean until somebody checked. 2,040 km2 is half a hex and it is still a
  // place, and it was where the eastbound convoys watered.
  { name: 'Mauritius', lat: -20.2, lon: 57.5, hexes: 1, ...VOLCANIC },
  { name: 'Ascension', lat: -7.95, lon: -14.37, hexes: 1, ...VOLCANIC },
  { name: 'Bermuda', lat: 32.3, lon: -64.75, hexes: 1, ...ATOLL },
  { name: 'Azores', lat: 38.6, lon: -28.0, hexes: 1, ...VOLCANIC },
  { name: 'Malta', lat: 35.9, lon: 14.45, hexes: 1, ...ATOLL },
];

/**
 * Put the islands on the map.
 *
 * Called before anything reads the land mask, so that terrain, coastlines,
 * population, resources and ownership all see an ordinary piece of ground.
 * Grown outward over water only — an island that runs into a continent stops,
 * which keeps Corregidor from annexing Bataan.
 *
 * @returns {Map<number, object>} the cells claimed, and which island claimed them
 */
export function stampIslands(isLand) {
  const sphere = grid();
  const claimed = new Map();

  for (const island of ISLANDS_1939) {
    const start = cellAt(sphere, island.lat, island.lon);
    // Somebody else's ground already, or a real coastline the baked map did
    // hold: leave it alone rather than paving over it.
    if (isLand[start] && !claimed.has(start)) continue;

    const taken = [];
    const seen = new Set([start]);
    let frontier = [start];
    while (taken.length < island.hexes && frontier.length) {
      const next = [];
      for (const cell of frontier) {
        if (taken.length >= island.hexes) break;
        if (isLand[cell] && !claimed.has(cell)) continue;
        taken.push(cell);
        for (const j of neighbours(cell)) {
          if (seen.has(j) || isLand[j]) continue;
          seen.add(j);
          next.push(j);
        }
      }
      frontier = next;
    }

    for (const cell of taken) {
      isLand[cell] = 1;
      claimed.set(cell, island);
    }
  }
  return claimed;
}
