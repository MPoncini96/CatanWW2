import { cellAt, grid, neighbours } from './sphere.js';

// Railheads.
//
// Supply starts from depots, and a depot is a city or a stretch of coast — a
// rule that works everywhere the world has cities in it, which is Europe, the
// eastern United States, Japan and the Chinese coast. The city table holds 189
// towns for the whole planet, and it has nothing at all between the Urals and
// the Pacific.
//
// So the Transbaikal Front, which really was fed by a railway, starved on the
// first morning of the game. It is the same gap that made the colonial
// garrisons undeployable until their posts were named by hand, and it takes the
// same answer: these are the places a railway or a road convoy actually reached
// in 1939, listed because the settlement data is too coarse to imply them.
//
// A depot here works exactly as a city does. It is not a city — most of these
// were small towns and some were sidings — but for the purpose of getting shells
// forward that is what they were for.

export const DEPOTS_1939 = [
  // The Trans-Siberian and the Far East. The single most important railway on
  // the board: everything the Red Army had east of the Urals came down it.
  ['Chelyabinsk', 55.16, 61.4],
  ['Omsk', 54.99, 73.37],
  ['Krasnoyarsk', 56.01, 92.87],
  ['Irkutsk', 52.29, 104.28],
  ['Ulan-Ude', 51.83, 107.58],
  ['Chita', 52.03, 113.5],
  // Borzya, which is the railhead Zhukov's supply came down for Khalkhin Gol
  // and then went seven hundred kilometres further by lorry.
  ['Borzya', 50.38, 116.52],
  ['Priargunsk', 50.37, 119.11],
  ['Mogocha', 53.74, 119.74],
  ['Skovorodino', 53.98, 123.94],
  ['Blagoveshchensk', 50.28, 127.53],
  ['Khabarovsk', 48.48, 135.07],
  ['Vladivostok', 43.12, 131.89],
  ['Komsomolsk', 50.55, 137.01],
  // The northern lines, which is how Finland was fought and how lend-lease
  // would later come in.
  ['Murmansk', 68.97, 33.08],
  ['Arkhangelsk', 64.54, 40.54],
  ['Petrozavodsk', 61.79, 34.35],
  ['Vologda', 59.22, 39.89],
  // Soviet Central Asia and the Caucasus.
  ['Tashkent', 41.3, 69.24],
  ['Alma-Ata', 43.24, 76.9],
  ['Baku', 40.41, 49.87],
  ['Tbilisi', 41.72, 44.79],
  ['Ashkhabad', 37.95, 58.38],

  // North-western China: the Ordos, Ningxia and the road to the Soviet border,
  // which is where the northern war zones stood.
  ['Lanzhou', 36.06, 103.83],
  ['Baotou', 40.66, 109.84],
  ['Yinchuan', 38.49, 106.23],
  ['Xian', 34.27, 108.95],
  ['Taiyuan', 37.87, 112.55],
  ['Kunming', 25.04, 102.71],
  ['Guiyang', 26.65, 106.63],
  ['Chengdu', 30.66, 104.06],
  // Manchuria, where the Kwantung Army lived off the South Manchuria Railway.
  ['Harbin', 45.8, 126.53],
  ['Changchun', 43.82, 125.32],
  ['Qiqihar', 47.35, 123.92],
  ['Hailar', 49.2, 119.7],

  // Africa and the Middle East, where the garrisons were and the towns are not.
  ['Sebha', 27.04, 14.43],
  ['Asmara', 15.34, 38.93],
  ['Addis Ababa', 9.03, 38.74],
  ['Khartoum', 15.5, 32.53],
  ['Kano', 12.0, 8.52],
  ['Kampala', 0.31, 32.58],
  ['Elisabethville', -11.66, 27.48],
  ['Salisbury', -17.83, 31.05],
  ['Windhoek', -22.56, 17.08],
  ['Bulawayo', -20.15, 28.58],
  ['Baghdad', 33.31, 44.36],
  ['Kabul', 34.53, 69.17],
  ['Kandahar', 31.62, 65.72],
  ['Lhasa', 29.65, 91.14],
  ['Kashgar', 39.47, 75.99],
  ['Urumqi', 43.83, 87.62],
  ['Ulaanbaatar', 47.89, 106.91],

  // The interiors of the Americas and Australia, which are otherwise empty of
  // anywhere at all for four thousand kilometres.
  ['Denver', 39.74, -104.99],
  ['Winnipeg', 49.9, -97.14],
  ['Edmonton', 53.55, -113.49],
  ['Manaus', -3.12, -60.02],
  ['La Paz', -16.5, -68.15],
  ['Asuncion', -25.26, -57.58],
  ['Alice Springs', -23.7, 133.88],
  ['Kalgoorlie', -30.75, 121.47],
];

/**
 * And the ports.
 *
 * Supply comes ashore at a port, not on any beach. The first version of this
 * let every coastal hex feed an army, which fed Libya and East Prussia
 * correctly and also fed a column that had walked to the Arctic shore of
 * Siberia — and the population data cannot tell the two apart, because the
 * cells under Benghazi and Aden both read zero people while the Ob estuary
 * reads four thousand.
 *
 * So the ports are named, like the railheads and like the colonial garrisons
 * before them. Anything already in the city table is left out; these are the
 * anchorages the settlement data does not imply.
 */
export const PORTS_1939 = [
  // The Mediterranean and the African coasts.
  ['Tripoli', 32.9, 13.19],
  ['Benghazi', 32.12, 20.07],
  ['Tobruk', 32.08, 23.98],
  ['Alexandria', 31.2, 29.92],
  ['Port Said', 31.26, 32.3],
  ['Malta', 35.9, 14.51],
  ['Gibraltar', 36.13, -5.35],
  ['Oran', 35.7, -0.63],
  ['Bizerte', 37.27, 9.87],
  ['Casablanca', 33.57, -7.59],
  ['Dakar', 14.72, -17.47],
  ['Freetown', 8.48, -13.23],
  ['Lagos', 6.45, 3.39],
  ['Luanda', -8.84, 13.23],
  ['Cape Town', -33.92, 18.42],
  ['Durban', -29.86, 31.02],
  ['Mombasa', -4.04, 39.67],
  ['Dar es Salaam', -6.79, 39.21],
  ['Massawa', 15.61, 39.45],
  ['Djibouti', 11.59, 43.15],
  ['Mogadishu', 2.05, 45.32],
  ['Aden', 12.78, 45.03],

  // The northern and Atlantic waters.
  // The Baltic, which is how East Prussia was fed across the Corridor.
  ['Konigsberg', 54.7, 20.5],
  ['Pillau', 54.63, 19.89],
  ['Danzig', 54.35, 18.65],
  ['Memel', 55.7, 21.14],
  ['Stettin', 53.43, 14.55],
  ['Riga', 56.95, 24.11],
  ['Tallinn', 59.44, 24.75],
  ['Reykjavik', 64.13, -21.9],
  ['Narvik', 68.44, 17.43],
  ['Trondheim', 63.43, 10.4],
  ['Bergen', 60.39, 5.32],
  ['Scapa Flow', 58.9, -3.0],
  ['Halifax', 44.65, -63.57],
  ['St Johns', 47.56, -52.71],
  ['Anchorage', 61.22, -149.9],
  ['Vancouver', 49.28, -123.12],
  ['Recife', -8.05, -34.88],
  ['Valparaiso', -33.05, -71.61],
  ['Panama', 8.98, -79.52],
  ['Havana', 23.11, -82.37],
  ['Kingston', 17.97, -76.79],
  ['San Juan', 18.47, -66.11],
  ['Port of Spain', 10.65, -61.5],
  ['Georgetown', 6.8, -58.16],

  // The Indian Ocean and the Far East.
  ['Colombo', 6.93, 79.86],
  ['Rangoon', 16.87, 96.2],
  ['Singapore', 1.35, 103.82],
  ['Penang', 5.41, 100.33],
  ['Hong Kong', 22.32, 114.17],
  ['Manila', 14.6, 120.98],
  ['Batavia', -6.21, 106.85],
  ['Surabaya', -7.25, 112.75],
  ['Darwin', -12.46, 130.84],
  ['Fremantle', -32.06, 115.75],
  ['Auckland', -36.85, 174.76],
  ['Suva', -18.14, 178.44],
  ['Noumea', -22.28, 166.46],
  ['Port Moresby', -9.44, 147.18],
  ['Rabaul', -4.2, 152.18],
  ['Guam', 13.44, 144.79],
  ['Saipan', 15.18, 145.75],
  ['Truk', 7.44, 151.85],
  ['Honolulu', 21.31, -157.86],
  ['Hilo', 19.71, -155.09],
  ['Hakodate', 41.77, 140.73],
  ['Otaru', 43.19, 141.0],
  ['Basra', 30.5, 47.81],
  ['Kismayo', -0.36, 42.55],
  ['Berbera', 10.44, 45.01],
  ['Midway', 28.2, -177.37],
  ['Wake', 19.28, 166.65],
  ['Pearl Harbor', 21.36, -157.96],
  ['San Diego', 32.72, -117.16],
  ['Norfolk', 36.85, -76.29],
  ['Kure', 34.25, 132.57],
  ['Sasebo', 33.18, 129.72],
  ['Maizuru', 35.47, 135.39],
  ['Port Arthur', 38.85, 121.27],
  ['Karafuto', 46.96, 142.74],
  ['Petropavlovsk', 53.02, 158.65],
];

let cache = null;
let ports = null;

/** The cells the depots stand on. Worked out once. */
export function DEPOT_CELLS() {
  if (cache) return cache;
  const sphere = grid();
  cache = new Set(DEPOTS_1939.map(([, lat, lon]) => cellAt(sphere, lat, lon)));
  return cache;
}

/**
 * The cells the ports stand on, and the water beside them.
 *
 * A port named by its harbour often lands on a sea cell — that is what a
 * harbour is — so each one claims the land around it as well. Otherwise half
 * the anchorages on the board would be depots for the fish.
 */
export function PORT_CELLS(isLand) {
  if (ports) return ports;
  const sphere = grid();
  ports = new Set();
  for (const [, lat, lon] of PORTS_1939) {
    const cell = cellAt(sphere, lat, lon);
    if (isLand(cell)) ports.add(cell);
    for (const j of neighbours(cell)) if (isLand(j)) ports.add(j);
  }
  return ports;
}
