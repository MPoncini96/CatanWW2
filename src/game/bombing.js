import { grid } from '../world/sphere.js';
import { NATION_INDEX, NATIONS } from '../world/nations.js';
import { formationName } from '../world/deploy.js';
import { atWar } from './movement.js';

// Strategic bombing.
//
// Everything on this board has been waiting for it. Fighters have carried a
// combat rating since the day they were placed and it has never decided
// anything; the anti-aircraft formations have been a label; the Ruhr has sat
// under the heaviest flak concentration in the world guarding nothing; and
// `capacityFor` has taken a list of raids since the factories were built
// without anybody ever putting one in it.
//
// ---------------------------------------------------------------- the rules
//
// A bomber group flies from its airfield to a **works** within ten hexes,
// which is about seven hundred kilometres and is what a He 111 or a Wellington
// could do with a bomb load. It is contested by **fighters within three hexes
// of the target** — a Bf 109 could not escort anything further than that, and
// could not intercept beyond it either — and by whatever **flak** is standing
// on the hex.
//
// What comes back is a factory out of action for a few days, and fewer
// bombers. Neither side takes ground; that is the whole point of the thing,
// and the argument about whether it was worth doing lasted the entire war.

/** How far a bomber can go and come back. Ten hexes is about 700 km. */
export const BOMBER_RANGE = 10;

/** And how far a fighter reaches, to escort or to intercept. */
export const FIGHTER_RANGE = 3;

/**
 * People killed on the ground, per bomber that gets through.
 *
 * Bombing a factory in 1939-45 meant bombing the district around it, and every
 * air force involved knew it. The number is set from the campaign that ended
 * the Pacific war: roughly 33,000 B-29 sorties against the home islands killed
 * something like 400,000 civilians, and the single worst night — Tokyo, 10
 * March 1945 — killed a hundred thousand with 279 aircraft.
 *
 * Twelve per bomber sits between those two, nearer the campaign average than
 * the worst night, because most raids were not the worst night.
 */
export const CIVILIANS_PER_BOMBER = 12;

/**
 * And never more than this share of a hex's people in one night.
 *
 * A cell holds up to 186,000 people, and without a cap a large enough raid on a
 * small enough town would kill more of them than live there.
 */
export const WORST_CIVILIAN_SHARE = 0.03;

/**
 * What a defender is worth against a bomber.
 *
 * A fighter is worth rather more than a gun, and there were far fewer of them.
 * The Ruhr's 1,439 guns come to about five hundred, which is a serious defence
 * against any raid of the period and is meant to be: it was the most heavily
 * defended airspace on earth.
 */
export const FIGHTER_WEIGHT = 1.2;

/**
 * And what one is worth escorting, which is less.
 *
 * The interceptor picks its moment; the escort cannot. It is tied to bombers
 * flying a straight line at a fixed height and speed, it cannot chase, and it
 * has to be somewhere its charges are — so it fights the fight the defender
 * chooses. Sixty per cent of an interceptor is the going rate for that, and it
 * is why escorting was the harder job and the one that took longest to solve.
 */
export const ESCORT_WEIGHT = 0.72;
export const FLAK_WEIGHT = 0.35;

/**
 * How hard a raid is punished, before the odds are applied.
 *
 * The first numbers here were far too cruel: one group of 160 against the Ruhr
 * lost half of itself and shut the works for a single day, which is not a trade
 * anybody makes twice. The worst nights of the real bomber offensive cost
 * something like a fifth, and those were the nights that got written about.
 */
const BASE_LOSS = 0.1;
const LEAST_LOSS = 0.02;
const WORST_LOSS = 0.25;

/** Bombers that have to get through to shut a works for one day. */
const BOMBERS_PER_DAY = 45;

/** However well it goes, a works is back inside a fortnight. */
const LONGEST_SHUTDOWN = 14;

// A hex is 67 km across on a globe of radius 6,371, so one hex is this many
// radians of arc. Distances between cells are measured on the sphere rather
// than by walking the grid: an aeroplane does not care what is underneath it.
const HEX_RADIANS = 67 / 6371;

/** How many hexes apart two cells are, as the bomber flies. */
export function hexesApart(a, b) {
  const sphere = grid();
  const dot =
    sphere.center[a * 3] * sphere.center[b * 3] +
    sphere.center[a * 3 + 1] * sphere.center[b * 3 + 1] +
    sphere.center[a * 3 + 2] * sphere.center[b * 3 + 2];
  return Math.acos(Math.max(-1, Math.min(1, dot))) / HEX_RADIANS;
}

/** The luck of a raid, seeded so it can be recomputed anywhere. */
export function raidLuck(day, cell) {
  let h = Math.imul((day + 1) ^ Math.imul(cell + 1, 0x9e3779b9), 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return 0.8 + ((h >>> 0) / 4294967296) * 0.4;
}

/**
 * May this seat send this group against this hex?
 *
 * Returns null if it may, or the sentence saying why not.
 */
export function mayRaid({ world, column, target, power, day, positions, raids, ordered }) {
  if (!power) return 'Nobody is sitting at this seat.';
  if (!column) return 'Nothing is selected to fly.';
  const name = formationName(column.formation);
  if (column.formation.nation !== power) return `${name} is not yours to order.`;
  if (ordered?.has(column.id)) return 'Already flying tomorrow.';

  // Bombers to do the work, or fighters to see them there. A group of fighters
  // ordered against a target is an escort, and it is the only offensive thing
  // a fighter can do.
  const bombers = column.strength?.bombers ?? 0;
  const fighters = column.strength?.fighters ?? 0;
  if (!bombers && !fighters) return `${name} has no aircraft in it.`;

  // A group that flew yesterday is being patched up and rearmed today. The
  // same rule as a column that marched, for the same reason.
  const flewYesterday = (raids ?? []).some(
    (r) => r.day === day && (r.columns ?? []).includes(column.id),
  );
  if (flewYesterday) return 'It flew today and is being turned round.';

  const from = positions?.get(column.id) ?? column.cell;
  const owner = world.ownership.owner[target];
  if (owner < 0) return 'There is nothing out there to bomb.';
  if (owner === NATION_INDEX[power]) return 'That is your own factory.';
  if (!atWar(day, power, NATIONS[owner].id, world, target)) {
    const held = world.countryOf[target] >= 0 ? world.countries[world.countryOf[target]].name : 'them';
    return `You are not at war with ${held}.`;
  }

  const works = (world.works ?? []).filter((w) => w.cell === target);
  if (!works.length) return 'There is no works on that hex to put out of action.';

  const reach = hexesApart(from, target);
  if (reach > BOMBER_RANGE) {
    return `${Math.round(reach)} hexes — a bomber of 1939 goes ${BOMBER_RANGE} and comes back.`;
  }
  return null;
}

/**
 * Everything that would try to stop a raid on this hex.
 *
 * Only what is actually fighting you. `day` is not optional in spirit: without
 * it this counted every aeroplane on earth that was not yours, so a raid on the
 * Ruhr was met by the Dutch and the Belgians as well as the Luftwaffe. That
 * merely inflated the defence while nobody could shoot back at it. Now that an
 * escort costs the interceptors something, it would have Fighter Command
 * destroying neutral air forces over a country nobody had invaded.
 */
export function defenceOf(world, target, nation, positions, strengths, day) {
  let fighters = 0;
  let flak = 0;
  const guards = [];
  for (const column of world.garrisons.opening) {
    if (column.formation.nation === nation) continue;
    const owner = NATION_INDEX[column.formation.nation];
    if (owner === undefined) continue;
    const have = strengths?.get(column.id) ?? column.strength;
    const where = positions?.get(column.id) ?? column.cell;
    const quality = column.formation.quality ?? 0.5;
    // Neutral until somebody makes them otherwise. `atWar` reads the country
    // under the aircraft, which is how one 'neutral' nation holds thirty
    // countries that come into the war on thirty different days.
    if (day !== undefined && !atWar(day, nation, column.formation.nation, world, where)) continue;

    // Flak only defends the hex it is standing on. Guns do not travel.
    if (where === target && column.formation.type === 'aa') {
      flak += (have.artillery ?? 0) * quality;
    }
    // Fighters reach as far as fighters reached, which is not far.
    if ((have.fighters ?? 0) > 0 && hexesApart(where, target) <= FIGHTER_RANGE) {
      fighters += have.fighters * quality;
      guards.push(column.id);
    }
  }
  return {
    fighters,
    flak,
    total: fighters * FIGHTER_WEIGHT + flak * FLAK_WEIGHT,
    // Who they belong to, so an escort that fights them can cost them
    // something. Without this the defending fighters were invulnerable: they
    // took a raid apart every night for six years and never lost an aeroplane.
    guards,
  };
}

/**
 * The fight in the air over a target.
 *
 * Three things come out of it and they are not the same number: what the
 * bombers lose, what the escort loses, and what the defenders lose. An escort
 * does not shoot down flak, so the guns come through whatever happens — which
 * is the whole reason flak was worth having.
 */
export function airCombat({ guardFighters, guardFlak, escort, bombers }) {
  const guarding = guardFighters * FIGHTER_WEIGHT;
  const escorting = escort * ESCORT_WEIGHT;
  // What the escort could not hold off, plus the guns, which it never can.
  const covered = Math.max(0, guarding - escorting) + guardFlak * FLAK_WEIGHT;

  const clamp = (n) => Math.min(WORST_LOSS, Math.max(LEAST_LOSS, n));
  return {
    covered,
    bomberShare: clamp(BASE_LOSS * (covered / Math.max(1, bombers))),
    // The escort fights the interceptors, and the interceptors fight back.
    escortShare: escort > 0 ? clamp(BASE_LOSS * (guarding / Math.max(1, escorting))) : 0,
    guardShare: guardFighters > 0 ? clamp(BASE_LOSS * (escorting / Math.max(1, guarding))) : 0,
  };
}

/**
 * Fly every raid ordered for today.
 *
 * @returns {{raids: Array, losses: Array}} what the works suffered, and the
 *          bombers that did not come back — the second in the same shape as
 *          every other casualty, so the record needs no new kind of entry.
 */
export function resolveRaids({ world, day, raiding, positions, strengths, past }) {
  const raids = [];
  const losses = [];
  const flown = new Set();

  // Everything one power sends against one target on one day is **one raid**.
  // Bomber Command is three groups on three airfields and it did not attack the
  // Ruhr three times in a night — it attacked once, together, and the whole
  // point of doing so is that a large formation saturates the defence that a
  // small one is destroyed by. Resolving them separately made massing
  // impossible and every group was cut to pieces on its own.
  const missions = new Map();
  for (const [power, orders] of Object.entries(raiding ?? {})) {
    for (const order of orders ?? []) {
      const column = world.garrisons.opening.find((c) => c.id === order.column);
      if (!column || column.formation.nation !== power) continue;
      if (flown.has(column.id)) continue;
      const why = mayRaid({
        world,
        column: { ...column, strength: strengths?.get(column.id) ?? column.strength },
        target: order.target,
        power,
        day: day - 1,
        positions,
        raids: past,
        ordered: flown,
      });
      if (why) continue;
      flown.add(column.id);
      const key = `${power}@${order.target}`;
      if (!missions.has(key)) missions.set(key, { power, target: order.target, columns: [] });
      missions.get(key).columns.push(column);
    }
  }

  for (const { power, target, columns } of [...missions.values()].sort(
    (a, b) => a.target - b.target || (a.power < b.power ? -1 : 1),
  )) {
    let bombers = 0;
    let strength = 0;
    let escort = 0;
    let escortWeight = 0;
    for (const column of columns) {
      const have = strengths?.get(column.id) ?? column.strength;
      const quality = column.formation.quality ?? 0.5;
      const n = have.bombers ?? 0;
      bombers += n;
      strength += n * quality;
      // Anything with fighters in it is flying escort, whether or not it is
      // also carrying bombs. A group of both does both.
      const f = have.fighters ?? 0;
      escort += f;
      escortWeight += f * quality;
    }
    const luck = raidLuck(day, target);
    strength *= luck;
    escortWeight *= luck;
    const against = defenceOf(world, target, power, positions, strengths, day);

    const fight = airCombat({
      guardFighters: against.fighters,
      guardFlak: against.flak,
      escort: escortWeight,
      bombers: strength,
    });
    const share = fight.bomberShare;
    const through = Math.max(0, Math.round(bombers * (1 - share)));
    const out = Math.min(LONGEST_SHUTDOWN, Math.round(through / BOMBERS_PER_DAY));

    const works = (world.works ?? []).filter((w) => w.cell === target);
    raids.push({
      day,
      cell: target,
      power,
      columns: columns.map((c) => c.id),
      against: NATIONS[world.ownership.owner[target]]?.id ?? null,
      bombers,
      through,
      share,
      fighters: Math.round(against.fighters),
      flak: Math.round(against.flak),
      escort: Math.round(escort),
      escortShare: fight.escortShare,
      guardShare: fight.guardShare,
      // The day the works is working again. Read by `capacityFor`, which has
      // been waiting for somebody to put a number in it.
      until: day + out,
      days: out,
      works: works.map((w) => w.name),
      output: works.reduce((n, w) => n + w.output, 0),
      // And what it cost the people who lived there, which is a separate number
      // from what it cost the factory and is the one that ends wars.
      killed: Math.round(
        Math.min(
          through * CIVILIANS_PER_BOMBER,
          (world.population?.[target] ?? 0) * WORST_CIVILIAN_SHARE,
        ),
      ),
    });

    // What the escort lost holding the interceptors off, and what the
    // interceptors lost being held off. Fighters on both sides, and nobody
    // else: a raid costs aircraft, not the fitters who armed them.
    if (escort > 0 && fight.escortShare > 0) {
      losses.push({
        day,
        cell: target,
        raid: true,
        arms: ['fighters'],
        losers: columns.map((c) => c.id),
        loserShare: fight.escortShare,
        winners: [],
        winnerShare: 0,
      });
    }
    if (against.guards.length && fight.guardShare > 0) {
      losses.push({
        day,
        cell: target,
        raid: true,
        arms: ['fighters'],
        losers: against.guards,
        loserShare: fight.guardShare,
        winners: [],
        winnerShare: 0,
      });
    }

    losses.push({
      day,
      cell: target,
      raid: true,
      // Aircraft, and only aircraft. The men on the airfield are still on it.
      arms: ['bombers'],
      losers: columns.map((c) => c.id),
      winners: [],
      loserShare: share,
      winnerShare: 0,
      nation: power,
    });
  }
  return { raids, losses };
}

/**
 * Everyone a nation has lost to bombing, up to a given day.
 *
 * Summed from the raid record rather than taken out of `world.population`,
 * because the population is built once from the baked map and everything else
 * on this board is replayed. A number that can be recomputed from the log is a
 * number two clients cannot disagree about.
 */
export function civilianDead(raids, nation, day = Infinity) {
  let dead = 0;
  for (const raid of raids ?? []) {
    if (raid.day > day) continue;
    if (raid.against !== nation) continue;
    dead += raid.killed ?? 0;
  }
  return dead;
}
