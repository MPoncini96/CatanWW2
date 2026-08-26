import { TILE_COUNT } from './sphere.js';
import { FORMATIONS } from './oob1939.js';
import { ARMS, isField, placeFormations } from './deploy.js';

// The armies of 1939, as they stood on the first of September.
//
// The order of battle is in `oob1939.js` and the placing is in `deploy.js`.
// What is left here is the board's view of the result: five numbers a hex, a
// strength score to shade the map with, and the totals each power can be held
// to. Nothing in this file decides where anything goes.
//
// The shape of the totals is the story. The Red Army with more tanks than
// everyone else combined and the Wehrmacht with a seventh as many; the United
// States, which would out-build the world inside three years, fielding an army
// smaller than Belgium's. The shape of the *deployment* is a second story, and
// a sharper one: two thirds of the German field army stands in four provinces,
// and there is nothing between Berlin and the Rhine but recruits and flak.

export const UNITS = [
  { id: 'infantry', name: 'Infantry', short: 'Inf', color: '#8d9bb0', per: 1 },
  { id: 'tanks', name: 'Tanks', short: 'Tank', color: '#c08a4a', per: 1 },
  { id: 'artillery', name: 'Artillery', short: 'Arty', color: '#b0705a', per: 1 },
  { id: 'fighters', name: 'Fighters', short: 'Ftr', color: '#6fb7d8', per: 1 },
  { id: 'bombers', name: 'Bombers', short: 'Bmr', color: '#9a7fc4', per: 1 },
];

export const UNIT_INDEX = Object.fromEntries(UNITS.map((u, i) => [u.id, i]));

/**
 * What each formation type is called on a panel, and whether its men count as
 * soldiers in the line.
 *
 * The distinction is the point of the rewrite. A hex in the Ruhr with ninety
 * thousand men on it is not a field army — it is flak crews, and most of them
 * are seventeen. Labelling that as infantry was the single most misleading
 * thing the old map did, so the roles are carried through to the display.
 */
export const ROLES = {
  field: { name: 'Field army', field: true },
  armor: { name: 'Armour', field: true },
  fortress: { name: 'Fortress troops', field: true },
  air: { name: 'Air force', field: false },
  depot: { name: 'Depot and training', field: false },
  security: { name: 'Rear area', field: false },
  aa: { name: 'Anti-aircraft', field: false },
};

/**
 * Strength on 1 September 1939, summed from the order of battle.
 *
 * Derived rather than declared, so a correction to a formation moves the
 * national total with it and the two can never disagree.
 */
export const FORCES_1939 = (() => {
  const out = {};
  for (const formation of FORMATIONS) {
    const nation = (out[formation.nation] ??= {
      infantry: 0,
      tanks: 0,
      artillery: 0,
      fighters: 0,
      bombers: 0,
    });
    for (const arm of ARMS) nation[arm] += formation.strength[arm] ?? 0;
  }
  return out;
})();

/**
 * What a man of each kind is worth to the shading on the map. Field troops are
 * worth what they are; a training battalion, a rear-area company and a flak
 * crew are not going to stop anybody, and should not light the map as though
 * they might. The guns they serve are counted at full weight regardless.
 */
const COMBAT_WORTH = { field: 1, armor: 1, fortress: 1, air: 0.4, aa: 0.15, security: 0.25, depot: 0.08 };

/**
 * Count what a set of placements puts on the board.
 *
 * Separated from the placing because it is run more than once: the opening
 * deployment is placed, and then every day a column marches the whole thing is
 * counted again from wherever the columns now are. Nothing about where an army
 * is gets stored twice — the positions are replayed and this reads them.
 *
 * @returns {object} the same shape `buildForces` returns
 */
export function tallyPlacements(placements) {
  const counts = UNITS.map(() => new Uint32Array(TILE_COUNT));

  // Field strength kept apart from everything else, so a depot hex can be told
  // from a front-line one by something other than reading the label.
  const fieldInfantry = new Uint32Array(TILE_COUNT);
  const roleAt = new Array(TILE_COUNT).fill(null);
  const roleWeight = new Float32Array(TILE_COUNT);

  const byNation = {};
  for (const [id, force] of Object.entries(FORCES_1939)) {
    byNation[id] = {
      force,
      deployed: UNITS.map(() => 0),
      hexes: 0,
      field: 0,
      support: 0,
      formations: 0,
    };
  }

  const byCell = new Map();
  const airbases = new Set();
  const held = new Map();
  for (const placement of placements) {
    const nation = byNation[placement.formation.nation];
    const cell = placement.cell;
    for (let u = 0; u < UNITS.length; u += 1) {
      const n = placement.strength[UNITS[u].id];
      counts[u][cell] += n;
      nation.deployed[u] += n;
    }
    const men = placement.strength.infantry;
    if (isField(placement.formation)) {
      fieldInfantry[cell] += men;
      nation.field += men;
    } else {
      nation.support += men;
    }
    // A hex takes its name from whatever has the most men standing on it.
    if (men >= roleWeight[cell]) {
      roleWeight[cell] = men;
      roleAt[cell] = placement.formation.type;
    }
    nation.formations += 1;
    if (!held.has(placement.formation.nation)) held.set(placement.formation.nation, new Set());
    held.get(placement.formation.nation).add(cell);
    if (!byCell.has(cell)) byCell.set(cell, []);
    byCell.get(cell).push(placement);
    if (placement.strength.fighters + placement.strength.bombers > 0) airbases.add(cell);
  }
  for (const [id, cells] of held) if (byNation[id]) byNation[id].hexes = cells.size;

  const totals = counts.map((c) => {
    let sum = 0;
    for (let i = 0; i < c.length; i += 1) sum += c[i];
    return sum;
  });

  // A rough combat-power score, so one number can shade the map. The weights
  // are only a ranking: a tank is worth a company of riflemen, a bomber more.
  //
  // Men are counted by what they are for, which is why this is summed over
  // formations rather than off the per-cell totals. A hundred thousand recruits
  // in the depots of Wehrkreis III are a hundred thousand men and almost no
  // combat power, and a map that lights Berlin as brightly as Silesia is
  // telling the reader the opposite of what was true.
  const strength = new Float32Array(TILE_COUNT);
  for (const placement of placements) {
    const worth = COMBAT_WORTH[placement.formation.type] ?? 1;
    strength[placement.cell] +=
      placement.strength.infantry * worth +
      placement.strength.tanks * 30 +
      placement.strength.artillery * 15 +
      placement.strength.fighters * 60 +
      placement.strength.bombers * 90;
  }
  let max = 0;
  for (let i = 0; i < TILE_COUNT; i += 1) if (strength[i] > max) max = strength[i];

  return {
    counts,
    totals,
    byNation,
    strength,
    maxStrength: max,
    fieldInfantry,
    roleAt,
    placements,
    byCell,
    airbases,
  };
}

/**
 * Deploy every power's army across the board, and count it.
 *
 * @returns {{counts: Uint32Array[], totals: number[][], byNation: object}}
 */
export function buildForces(world) {
  const deployment = placeFormations(world);
  return {
    ...tallyPlacements(deployment.placements),
    opening: deployment.placements,
    access: deployment.access,
    warnings: deployment.warnings,
  };
}

/** Which nation, if any, has men standing on this hex. */
export function garrisonOwner(world, index) {
  const here = world.garrisons?.byCell.get(index);
  if (!here?.length) return null;
  return here[0].formation.nation;
}

export function formatUnits(n) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}
