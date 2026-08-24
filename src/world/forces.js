import { TILE_COUNT, grid, neighbours } from './sphere.js';
import { NATIONS, NATION_INDEX, SEA } from './nations.js';
import { TERRAIN } from './terrain.js';

// The armies of 1939, deployed across the board.
//
// Totals are the real orders of battle on the eve of the war, and the shape of
// them is the story: the Red Army with more tanks than everyone else combined
// and the Wehrmacht with a fifth as many; the United States, soon to out-build
// the world, fielding an army smaller than Portugal's.
//
// Where they stand matters as much as how many there are. Armies of this period
// massed on the frontier they expected to fight on and left the interior thinly
// held, so deployment here is driven by three things: the theatres each power
// was actually watching, whether a hex sits on a hostile border, and where the
// people and the factories are.

export const UNITS = [
  { id: 'infantry', name: 'Infantry', short: 'Inf', color: '#8d9bb0', per: 1 },
  { id: 'tanks', name: 'Tanks', short: 'Tank', color: '#c08a4a', per: 1 },
  { id: 'artillery', name: 'Artillery', short: 'Arty', color: '#b0705a', per: 1 },
  { id: 'fighters', name: 'Fighters', short: 'Ftr', color: '#6fb7d8', per: 1 },
  { id: 'bombers', name: 'Bombers', short: 'Bmr', color: '#9a7fc4', per: 1 },
];

export const UNIT_INDEX = Object.fromEntries(UNITS.map((u, i) => [u.id, i]));

/**
 * Strength on 1 September 1939. Infantry is men under arms after mobilisation;
 * the rest are machines. Figures are the standard estimates, rounded.
 */
export const FORCES_1939 = {
  germany: { infantry: 3_180_000, tanks: 3200, artillery: 11_000, fighters: 1100, bombers: 1600 },
  ussr: { infantry: 2_400_000, tanks: 21_000, artillery: 40_000, fighters: 4000, bombers: 3500 },
  france: { infantry: 2_900_000, tanks: 3300, artillery: 11_000, fighters: 700, bombers: 400 },
  uk: { infantry: 1_100_000, tanks: 1150, artillery: 1300, fighters: 750, bombers: 550 },
  italy: { infantry: 1_600_000, tanks: 1500, artillery: 7000, fighters: 800, bombers: 800 },
  japan: { infantry: 1_700_000, tanks: 2000, artillery: 5000, fighters: 1200, bombers: 1000 },
  usa: { infantry: 190_000, tanks: 400, artillery: 800, fighters: 800, bombers: 500 },
  china: { infantry: 2_500_000, tanks: 100, artillery: 800, fighters: 200, bombers: 100 },
  // Everyone who stayed out of it, pooled. This is not a bloc — it is thirty
  // separate armies that never fought as one — but leaving it out puts a
  // million Poles at zero while the Wehrmacht masses on their border. Poland
  // alone accounts for about a million men and 880 tanks of this.
  neutral: { infantry: 5_200_000, tanks: 2600, artillery: 9000, fighters: 900, bombers: 500 },
};

/**
 * Where each power actually had its army in September 1939.
 *
 * Boxes multiply a hex's share. Without them the model spreads an army evenly
 * over an empire, which is how you end up with a third of the Wehrmacht in
 * Bavaria while Poland faces nobody.
 */
const DEPLOYMENTS = {
  germany: [
    { name: 'Polish frontier', box: [15.5, 49.0, 20.0, 55.0], weight: 5 },
    { name: 'East Prussia', box: [19.0, 53.8, 23.2, 56.0], weight: 4 },
    { name: 'Bohemian marches', box: [15.0, 48.5, 19.0, 51.5], weight: 3 },
    { name: 'West Wall', box: [5.8, 47.5, 9.0, 52.0], weight: 3 },
  ],
  france: [
    { name: 'Maginot Line', box: [5.5, 47.5, 8.4, 49.8], weight: 5 },
    { name: 'Belgian frontier', box: [2.0, 49.0, 6.0, 51.2], weight: 4 },
    { name: 'Alpine front', box: [5.8, 43.5, 7.8, 46.5], weight: 3 },
    { name: 'North Africa', box: [-9.0, 30.0, 11.0, 37.5], weight: 2 },
  ],
  uk: [
    { name: 'Home islands', box: [-8.3, 49.8, 2.1, 59.0], weight: 5 },
    { name: 'Egypt and the Canal', box: [24.6, 21.9, 36.9, 31.7], weight: 5 },
    { name: 'North-west frontier', box: [66.0, 28.0, 78.0, 37.0], weight: 4 },
    { name: 'Malaya and Singapore', box: [100.1, 1.1, 104.6, 6.8], weight: 3 },
    { name: 'Palestine', box: [34.2, 29.1, 39.4, 33.3], weight: 3 },
  ],
  ussr: [
    { name: 'Western military districts', box: [23.0, 46.0, 33.0, 60.0], weight: 5 },
    { name: 'Ukraine', box: [26.0, 44.0, 40.0, 52.0], weight: 5 },
    { name: 'Far East and Mongolia border', box: [110.0, 42.0, 140.0, 54.0], weight: 5 },
    { name: 'Caucasus', box: [38.0, 38.0, 50.0, 45.0], weight: 2 },
  ],
  italy: [
    { name: 'Alpine and Po', box: [6.5, 43.8, 13.9, 46.7], weight: 5 },
    { name: 'Libya', box: [9.3, 19.5, 25.2, 34.0], weight: 4 },
    { name: 'Albania', box: [19.2, 39.6, 21.1, 42.4], weight: 4 },
    { name: 'East Africa', box: [34.5, -1.7, 48.5, 18.1], weight: 3 },
  ],
  japan: [
    { name: 'North China', box: [110.0, 32.0, 122.5, 41.5], weight: 5 },
    { name: 'Lower Yangtze', box: [114.5, 27.5, 122.5, 33.0], weight: 5 },
    { name: 'Manchukuo and the Soviet border', box: [117.0, 43.0, 135.2, 53.6], weight: 6 },
    { name: 'Kwangtung', box: [111.5, 20.8, 117.5, 24.5], weight: 3 },
    { name: 'Home islands', box: [128.3, 30.0, 146.0, 45.7], weight: 2 },
  ],
  usa: [
    { name: 'Panama Canal', box: [-80.0, 8.6, -79.4, 9.5], weight: 6 },
    { name: 'Hawaii', box: [-161, 18.5, -154.5, 22.5], weight: 5 },
    { name: 'Philippines', box: [116.5, 4.5, 127.0, 21.2], weight: 4 },
    { name: 'Atlantic seaboard', box: [-80.0, 33.0, -69.0, 43.0], weight: 2 },
  ],
  neutral: [
    { name: 'Poland', box: [16.3, 49.2, 26.3, 55.2], weight: 5 },
    { name: 'The Low Countries', box: [2.5, 49.4, 7.3, 53.6], weight: 4 },
    { name: 'The Balkans', box: [13.4, 40.8, 29.8, 48.6], weight: 3 },
    { name: 'Switzerland', box: [5.9, 45.8, 10.5, 47.9], weight: 3 },
    { name: 'Scandinavia', box: [4.0, 55.0, 31.2, 71.3], weight: 2 },
    { name: 'Turkey', box: [25.5, 35.5, 44.9, 42.6], weight: 2 },
  ],
  china: [
    { name: 'Wuhan and the Yangtze', box: [106.0, 27.0, 116.0, 33.0], weight: 5 },
    { name: 'Shensi and the north-west', box: [104.0, 33.0, 112.0, 40.0], weight: 5 },
    { name: 'Changsha front', box: [110.0, 24.0, 116.0, 29.0], weight: 5 },
    { name: 'Szechwan redoubt', box: [102.0, 28.0, 110.0, 33.0], weight: 3 },
  ],
};

/** Rivals for the purpose of massing on a frontier. */
const HOSTILE = {
  germany: ['france', 'uk', 'ussr', 'neutral'],
  france: ['germany', 'italy'],
  uk: ['germany', 'italy'],
  ussr: ['germany', 'japan'],
  italy: ['france', 'uk'],
  japan: ['china', 'ussr'],
  usa: [],
  china: ['japan'],
  // The neutrals watched the powers that might come for them.
  neutral: ['germany', 'italy', 'ussr', 'japan'],
};

const IMPASSABLE = new Set(['glacier', 'peak']);

function inBox(box, lat, lon) {
  return lon >= box[0] && lon <= box[2] && lat >= box[1] && lat <= box[3];
}

/** Deterministic 0..1 from a hex index — same armies on every client. */
function jitterAt(i, salt) {
  let h = Math.imul((i ^ salt) + 0x7ed55d16, 0x2545f491);
  h ^= h >>> 16;
  h = Math.imul(h, 0x45d9f3b);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/**
 * Deploy every power's army across the hexes it holds.
 *
 * @returns {{counts: Uint32Array[], totals: number[][], byNation: object}}
 */
export function buildForces(world) {
  const sphere = grid();
  const owner = world.ownership.owner;
  const counts = UNITS.map(() => new Uint32Array(TILE_COUNT));

  // How exposed each hex is: hexes on a hostile land border carry the most,
  // and the pressure falls away a few hexes back.
  const frontier = new Float32Array(TILE_COUNT);
  const seeds = [];
  for (let i = 0; i < TILE_COUNT; i += 1) {
    {
      const nation = owner[i];
      if (nation === SEA) continue;
      const rivals = HOSTILE[NATIONS[nation].id] ?? [];
      if (!rivals.length) continue;
      for (const j of neighbours(i)) {
        const other = owner[j];
        if (other === SEA || other === nation) continue;
        if (rivals.includes(NATIONS[other].id)) {
          frontier[i] = 1;
          seeds.push(i);
          break;
        }
      }
    }
  }
  let wave = seeds;
  for (let depth = 1; depth <= 3 && wave.length; depth += 1) {
    const next = [];
    const value = 1 - depth * 0.25;
    for (const i of wave) {
      for (const j of neighbours(i)) {
        if (owner[j] === SEA || frontier[j] >= value) continue;
        frontier[j] = value;
        next.push(j);
      }
    }
    wave = next;
  }

  // Score every hex for each power, then scale the score to the real total.
  const byNation = {};
  let popMax = 1;
  for (let i = 0; i < TILE_COUNT; i += 1) if (world.population[i] > popMax) popMax = world.population[i];

  for (const [id, force] of Object.entries(FORCES_1939)) {
    const nation = NATION_INDEX[id];
    const zones = DEPLOYMENTS[id] ?? [];
    const hexes = [];
    // Ground and air are drawn to different things, so each gets its own score.
    const groundScore = [];
    const airScore = [];
    let groundTotal = 0;
    let airTotal = 0;

    for (let i = 0; i < TILE_COUNT; i += 1) {
      {
        if (owner[i] !== nation) continue;
        const terrain = TERRAIN[world.biome[i]];
        if (IMPASSABLE.has(terrain.id)) continue;

        const lat = sphere.lat[i];
        const lon = sphere.lon[i];
        let zone = 1;
        for (const z of zones) if (inBox(z.box, lat, lon)) zone = Math.max(zone, z.weight);

        // Every province keeps a garrison; the rest follows the people. The
        // shallow exponent matters — a linear share would put nearly the whole
        // army in a handful of city hexes, while a hard cap flattens Berlin and
        // a Bavarian village to the same weight.
        const settled = 0.2 + 0.8 * Math.pow(world.population[i] / popMax, 0.3);
        const jitter = 0.8 + jitterAt(i, 0x51ed) * 0.4;

        // Ground forces mass on the frontier and in the deployment zones.
        const ground = zone * (1 + frontier[i] * 1.5) * settled * jitter;
        // Air forces sit on airfields behind the line, near cities and industry,
        // so they follow settlement far more than they follow the border.
        const air = zone * (1 + frontier[i] * 0.5) * settled * settled * jitter;

        hexes.push(i);
        groundScore.push(ground);
        airScore.push(air);
        groundTotal += ground;
        airTotal += air;
      }
    }
    if (!hexes.length) continue;

    // Apportion by largest remainder rather than rounding each hex on its own.
    // Britain has 1,150 tanks and 6,852 hexes: round independently and almost
    // every hex floors to zero, quietly losing two thirds of the tank park.
    // Flooring first and then handing the remaining machines to the hexes with
    // the largest fractions keeps the total exact and puts the leftovers where
    // the pressure is greatest, which is where they belong anyway.
    const apportion = (unit, shares) => {
      const u = UNIT_INDEX[unit];
      const target = force[unit];
      const exact = new Float64Array(hexes.length);
      let assigned = 0;
      for (let k = 0; k < hexes.length; k += 1) {
        exact[k] = target * shares[k];
        const whole = Math.floor(exact[k]);
        counts[u][hexes[k]] = whole;
        assigned += whole;
      }
      let left = target - assigned;
      if (left > 0) {
        const order = Array.from({ length: hexes.length }, (_, k) => k).sort(
          (a, b) => (exact[b] - Math.floor(exact[b])) - (exact[a] - Math.floor(exact[a])),
        );
        for (let k = 0; k < left; k += 1) counts[u][hexes[order[k % order.length]]] += 1;
      }
      return target;
    };

    const groundShare = groundScore.map((x) => (groundTotal > 0 ? x / groundTotal : 0));
    const airShare = airScore.map((x) => (airTotal > 0 ? x / airTotal : 0));
    const totals = UNITS.map(() => 0);
    totals[UNIT_INDEX.infantry] = apportion('infantry', groundShare);
    totals[UNIT_INDEX.tanks] = apportion('tanks', groundShare);
    totals[UNIT_INDEX.artillery] = apportion('artillery', groundShare);
    totals[UNIT_INDEX.fighters] = apportion('fighters', airShare);
    totals[UNIT_INDEX.bombers] = apportion('bombers', airShare);

    byNation[id] = { force, deployed: totals, hexes: hexes.length };
  }

  const totals = counts.map((c) => {
    let sum = 0;
    for (let i = 0; i < c.length; i += 1) sum += c[i];
    return sum;
  });

  // A rough combat-power score, so one number can shade the map. The weights
  // are only a ranking: a tank is worth a company of riflemen, a bomber more.
  const strength = new Float32Array(TILE_COUNT);
  let max = 0;
  for (let i = 0; i < TILE_COUNT; i += 1) {
    const s =
      counts[UNIT_INDEX.infantry][i] +
      counts[UNIT_INDEX.tanks][i] * 30 +
      counts[UNIT_INDEX.artillery][i] * 15 +
      counts[UNIT_INDEX.fighters][i] * 60 +
      counts[UNIT_INDEX.bombers][i] * 90;
    strength[i] = s;
    if (s > max) max = s;
  }

  return { counts, totals, byNation, strength, maxStrength: max };
}

export function formatUnits(n) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}
