// Population by region in 1939, used to spread people over the board with
// something like the real distribution — China and India dense, the Sahara and
// Siberia all but empty.
//
// Boxes are crude [west, south, east, north] rectangles in degrees, tested in
// order, so the FIRST match wins: enclaves and small countries must come before
// the large neighbours that would otherwise swallow them. Only land hexes
// inside a box draw from it, so a box overhanging the sea costs nothing.
//
// Figures are millions, from censuses and standard estimates around 1939. They
// are contemporary political units: "Germany" is the Reich after the Anschluss,
// "India" is British India including today's Pakistan and Bangladesh.

/** @type {Array<{name: string, box: [number, number, number, number], pop: number}>} */
export const REGIONS_1939 = [
  // --- East Asia (specific first, so China does not absorb its neighbours) ---
  { name: 'Korea', box: [124.5, 34, 130.8, 43], pop: 23 },
  { name: 'Japan', box: [128, 30, 146.5, 46], pop: 72 },
  { name: 'Taiwan', box: [119.5, 21.5, 122.5, 25.5], pop: 5.8 },
  { name: 'Mongolia', box: [87, 41.5, 120, 52.5], pop: 0.8 },
  { name: 'China', box: [73, 18, 135, 54], pop: 517 },

  // --- South and Southeast Asia ---
  { name: 'Ceylon', box: [79, 5.5, 82, 10], pop: 5.9 },
  { name: 'Malaya', box: [99.5, 1, 105, 7], pop: 5.3 },
  { name: 'Philippines', box: [116, 4.5, 127, 19.5], pop: 16 },
  { name: 'Netherlands East Indies', box: [95, -11, 141, 6], pop: 69 },
  { name: 'Indochina', box: [100, 8, 110, 23.5], pop: 24 },
  { name: 'Thailand', box: [97, 5.5, 106, 20.5], pop: 15 },
  { name: 'Burma', box: [92, 9.5, 101, 28.5], pop: 16 },
  { name: 'India', box: [66, 6, 97, 37], pop: 380 },

  // --- Middle East and Central Asia ---
  { name: 'Afghanistan', box: [60, 29, 75, 38.5], pop: 10 },
  { name: 'Iran', box: [44, 25, 63.5, 40], pop: 15 },
  { name: 'Iraq', box: [38.5, 29, 48.8, 37.5], pop: 3.7 },
  { name: 'Levant', box: [34, 29, 42.5, 37.5], pop: 6 },
  { name: 'Arabia', box: [34, 12, 60, 32], pop: 8 },
  { name: 'Turkey', box: [25.5, 35.5, 45, 42.5], pop: 17.5 },

  // --- Europe (small states before the large ones they border) ---
  { name: 'Switzerland', box: [5.9, 45.8, 10.5, 47.9], pop: 4.2 },
  { name: 'Low Countries', box: [2.5, 49.4, 7.3, 53.6], pop: 17.2 },
  { name: 'Czechoslovakia', box: [12, 47.7, 22.6, 51.1], pop: 15.3 },
  { name: 'Hungary', box: [16, 45.7, 22.9, 48.6], pop: 9.1 },
  { name: 'Yugoslavia', box: [13.4, 40.8, 23, 46.9], pop: 15.5 },
  { name: 'Bulgaria', box: [22.3, 41, 28.6, 44.2], pop: 6.3 },
  { name: 'Greece', box: [19.3, 34.8, 28.3, 41.8], pop: 7.2 },
  { name: 'Romania', box: [20.2, 43.6, 29.7, 48.3], pop: 20 },
  { name: 'Baltic States', box: [20.9, 53.9, 28.2, 59.7], pop: 5.9 },
  { name: 'Poland', box: [15.2, 48.9, 24.2, 55.2], pop: 35 },
  { name: 'Germany', box: [5.8, 46.5, 15.2, 55.2], pop: 69 },
  { name: 'Italy', box: [6.5, 36.5, 18.6, 47.1], pop: 43.8 },
  { name: 'France', box: [-5, 42, 8.3, 51.2], pop: 41.9 },
  { name: 'Iberia', box: [-10, 36, 3.5, 44], pop: 33.3 },
  { name: 'British Isles', box: [-11, 49.5, 2, 61], pop: 51.7 },
  { name: 'Iceland', box: [-25, 63, -13, 67], pop: 0.12 },
  { name: 'Scandinavia', box: [4, 54.5, 32, 71.5], pop: 16.7 },

  // --- USSR, split up: as one box, empty Siberia would draw the same rate as
  // the Russian heartland, where most Soviet citizens actually lived. ---
  { name: 'Caucasus', box: [38, 38, 50, 45], pop: 15 },
  { name: 'Soviet Central Asia', box: [55, 35, 80, 48], pop: 16 },
  { name: 'European Russia', box: [19, 44, 62, 71], pop: 105 },
  { name: 'Siberia', box: [19, 35, 190, 82], pop: 34 },

  // --- Africa ---
  { name: 'Egypt', box: [24, 22, 37, 32], pop: 16.5 },
  { name: 'Maghreb', box: [-17, 20, 12, 37.5], pop: 17 },
  { name: 'Libya', box: [9, 19, 25.5, 33.5], pop: 0.9 },
  { name: 'Madagascar', box: [43, -26, 51, -11], pop: 4 },
  { name: 'West Africa', box: [-18, 4, 16, 20], pop: 45 },
  { name: 'Central Africa', box: [8, -13, 32, 5], pop: 25 },
  { name: 'East Africa', box: [28, -12, 52, 18], pop: 40 },
  { name: 'Southern Africa', box: [10, -35, 41, -12], pop: 20 },

  // --- The Americas ---
  { name: 'Alaska', box: [-170, 51, -130, 72], pop: 0.07 },
  { name: 'United States', box: [-125, 24.5, -66.9, 49.4], pop: 131 },
  { name: 'Canada', box: [-141, 41.7, -52, 83], pop: 11.3 },
  { name: 'Mexico', box: [-118, 14.5, -86, 32.7], pop: 19.6 },
  { name: 'Central America', box: [-92.5, 7, -77, 18.5], pop: 7 },
  { name: 'Caribbean', box: [-85, 10, -59, 27], pop: 13 },
  { name: 'Guianas', box: [-61.4, 1.2, -51.6, 8.6], pop: 0.7 },
  { name: 'Venezuela', box: [-73.4, 0.6, -59.8, 12.2], pop: 3.8 },
  { name: 'Colombia', box: [-79, -4.2, -66.9, 12.5], pop: 9 },
  { name: 'Ecuador', box: [-81, -5, -75, 1.5], pop: 2.6 },
  { name: 'Peru', box: [-81.4, -18.4, -68.7, 0], pop: 6.6 },
  { name: 'Bolivia', box: [-69.7, -22.9, -57.5, -9.7], pop: 3.3 },
  { name: 'Paraguay', box: [-62.6, -27.6, -54.3, -19.3], pop: 1.1 },
  { name: 'Uruguay', box: [-58.2, -35, -53, -30], pop: 2.1 },
  { name: 'Chile', box: [-76, -56, -66, -17.5], pop: 5 },
  { name: 'Argentina', box: [-73.6, -55, -53.6, -21.8], pop: 13.9 },
  { name: 'Brazil', box: [-74, -34, -34, 5.3], pop: 40 },

  // --- Oceania ---
  { name: 'New Zealand', box: [166, -47.5, 179.9, -34], pop: 1.6 },
  { name: 'Australia', box: [112, -44, 154, -10], pop: 7 },
  { name: 'Pacific Islands', box: [130, -25, 180, 25], pop: 3 },
];

/**
 * Places where people crowd far more tightly than the surrounding land would
 * suggest — nearly always a river. The terrain model knows nothing about
 * rivers, so without these Egypt spreads evenly over its deserts instead of
 * gathering along the Nile, where essentially all Egyptians actually lived.
 *
 * Each entry multiplies the habitability of the hexes inside its box before
 * the region's population is divided up. Regional totals are unchanged; only
 * the distribution within a region shifts.
 */
export const DENSITY_BOOSTS = [
  { name: 'Nile valley', box: [30.2, 22, 33.2, 30.2], factor: 260 },
  { name: 'Nile delta', box: [30.0, 30.2, 32.3, 31.6], factor: 60 },
  { name: 'Mesopotamia', box: [42, 30, 48.5, 37], factor: 8 },
  { name: 'Indus valley', box: [66.5, 24, 75, 34], factor: 3.5 },
  { name: 'Gangetic plain', box: [77, 22, 90.5, 30], factor: 3.5 },
  { name: 'North China plain', box: [112, 31, 122, 41], factor: 3 },
  { name: 'Yangtze valley', box: [106, 27, 122, 33], factor: 2.5 },
  { name: 'Java', box: [105, -9, 115.5, -5.5], factor: 7 },
  { name: 'Red River delta', box: [104.5, 19.5, 107.5, 22.5], factor: 4 },
  { name: 'Mekong delta', box: [104.5, 8.5, 107.5, 11.5], factor: 4 },
  { name: 'Nigeria south', box: [2.5, 4, 9.5, 11], factor: 2.5 },
];

// Factors look large because they multiply the terrain weight underneath, and
// the Nile runs through desert scored at 0.06. The valley needs a big number
// simply to outweigh the sand it crosses.

/** Combined boost at a point — 1 where nothing applies. */
export function boostAt(lat, lon) {
  let factor = 1;
  for (const b of DENSITY_BOOSTS) {
    const [w, s, e, n] = b.box;
    if (lon >= w && lon <= e && lat >= s && lat <= n) factor *= b.factor;
  }
  return factor;
}

/** World total in 1939. The regions above fall a little short of it; the
 *  remainder is spread over land they do not cover (the far north, the deep
 *  interior of Arabia and the Sahara, scattered islands). */
export const WORLD_POPULATION_1939 = 2_300_000_000;

/** Find the region covering a point, or null. First match wins. */
export function regionAt(lat, lon) {
  for (let i = 0; i < REGIONS_1939.length; i += 1) {
    const [w, s, e, n] = REGIONS_1939[i].box;
    if (lon >= w && lon <= e && lat >= s && lat <= n) return i;
  }
  return -1;
}
