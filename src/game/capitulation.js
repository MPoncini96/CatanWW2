import { TILE_COUNT } from '../world/sphere.js';
import { NATION_INDEX, NEUTRAL, SEA } from '../world/nations.js';
import { CAPITALS_1939, capitalCell } from '../world/capitals.js';
import { NATIONS } from '../world/nations.js';

// When a government falls.
//
// Every rule up to here settles one hex at a time: an army marches onto a cell,
// fights for it, and the map changes by that one cell. That is the right model
// for a campaign and it is the wrong model for the end of a country. France did
// not lose 30,000 hexes in six weeks — it lost about a fifth of them, and then
// signed, and the rest changed hands in an afternoon because a government in
// Bordeaux said so.
//
// So: **hold an enemy capital for one full day and the country capitulates.**
// The metropole goes to whoever is standing in the capital. The empire does not
// — it goes wherever the government-in-exile took it, which is a different
// place, and it is the whole reason Britain spent 1940 inheriting other
// people's colonies.
//
// That split is the point of this file. Germany gets Belgium; Britain gets the
// Congo. Germany gets the Netherlands; Britain gets the East Indies, which
// three years later is what Japan comes for. Nobody has to fight for any of it
// hex by hex, which is what makes the game move.

/**
 * Who inherits what, and why.
 *
 * `empire` is who the overseas possessions answer to once the metropole is
 * gone. Null means there is no empire to speak of. `'neutral'` means the
 * colonies go their own way and are there for the taking, which is the single
 * most interesting outcome on this list and belongs to exactly one country.
 *
 * Five governments went to London and their empires went with them. France did
 * not: Vichy kept the empire and fought Britain for it — Mers-el-Kébir in July,
 * Dakar in September, Syria in 1941, Madagascar in 1942 — while Japan walked
 * into Indochina in the same months. Handing all of that to Britain would be a
 * windfall of 2,345 hexes and 115 million people for taking one city. Turning
 * it loose instead starts a scramble, which is what actually happened.
 *
 * The keys are whatever the capitals table calls the government: a power id for
 * the eight, a country name for everybody else.
 */
export const CAPITULATIONS = {
  // The one that matters, and the one that is not like the others. The French
  // empire did **not** go to Britain — Vichy kept it, and Britain had to fight
  // for it: Mers-el-Kébir in July, Dakar in September, Syria in 1941 and
  // Madagascar in 1942. So the colonies stay exactly where they are, still
  // French, still garrisoned, and whoever wants Dakar can go to Dakar.
  france: { empire: 'neutral', note: 'this is Vichy, and it is up for grabs' },

  // Government to London, and with it a thousand merchant ships: the Norwegian
  // merchant marine was the fourth largest in the world and sailed for the
  // Allies for five years. Norway has no colonies, so what Britain gains here
  // is tonnage rather than ground.
  Norway: { empire: 'uk', note: 'Nortraship — the merchant fleet sails for the Allies' },

  // Occupied in six hours; the government kept its desk until 1943. What did
  // not go to Germany was the North Atlantic: Britain took the Faroes in April
  // 1940 and Iceland in May, and the Americans took Greenland the year after.
  Denmark: { empire: 'uk', note: 'Iceland, the Faroes and Greenland — the Atlantic air gap' },

  // The East Indies are the prize: Sumatran and Bornean oil, and the reason
  // there is a Pacific war in 1942 at all.
  Netherlands: { empire: 'uk', note: 'the East Indies, Suriname and Curaçao' },

  // Copper, rubber, and the uranium at Shinkolobwe.
  Belgium: { empire: 'uk', note: 'the Congo' },

  // Government to Cairo, and the Greek merchant fleet with it.
  Greece: { empire: 'uk', note: 'the government to Cairo, and the merchant fleet' },

  // No empire to inherit, and no government left to take one anywhere. Poland
  // is the case the whole board opens on.
  Poland: { empire: null },
  Yugoslavia: { empire: null },

  // These did not fall. They are here because a player may make them fall, and
  // a rule that only covers what happened is not a rule.
  Finland: { empire: null },
  Sweden: { empire: null },
  Switzerland: { empire: null },
  Spain: { empire: null },
  Portugal: { empire: null },
  Turkey: { empire: null },
  Romania: { empire: null },
  Hungary: { empire: null },
  Bulgaria: { empire: null },
  'Bohemia and Moravia': { empire: null },
  Austria: { empire: null },
};

/**
 * The great powers are deliberately absent.
 *
 * Taking Moscow or London is devastating and it is not a surrender. No great
 * power in this war capitulated on losing its capital — France is the single
 * exception, and France is on the list above precisely because it is the
 * exception. Handing a player the whole Soviet Union for one hex would be the
 * largest swing in the game and the least defensible.
 */
export const NEVER_CAPITULATE = new Set(['germany', 'uk', 'ussr', 'italy', 'japan', 'usa', 'china']);

/** The country a government's own ground is called, as the country table knows it. */
const METROPOLE_NAME = {
  france: 'France',
};

/** What to call a government in a sentence a person is going to read. */
export function displayName(key) {
  if (key === 'neutral') return 'nobody';
  return NATIONS.find((n) => n.id === key)?.name ?? METROPOLE_NAME[key] ?? key;
}

/**
 * Who held a cell at the end of a given day.
 *
 * Straight off the capture record, and null if nobody has ever taken it. That
 * null is doing real work: a capital nobody has captured cannot fall, so the
 * whole question is settled without needing to know the opening map.
 */
export function heldOn(cell, day, captures = []) {
  let owner = null;
  for (const capture of captures) {
    if (capture.day > day) break;
    if (capture.cell === cell) owner = capture.to;
  }
  return owner;
}

/**
 * Every hex a government answers for, split into the two halves that go to
 * different people.
 *
 * The two halves are found two different ways, because the board holds them two
 * different ways. A power owns its empire outright — Algeria is French because
 * the owner field says France. Nobody else has that, so a neutral metropole's
 * colonies are linked by the `sovereign` field on the country instead: the
 * Congo is not owned by Belgium, it merely answers to it.
 */
export function holdingsOf(world, key) {
  const metropoleName = METROPOLE_NAME[key] ?? key;
  const power = NATION_INDEX[key];
  const owner = world.ownership.owner;

  // Which country ids count as home, and which as overseas.
  const home = new Set();
  const overseas = new Set();
  for (const country of world.countries ?? []) {
    if (country.name === metropoleName) home.add(country.id);
    else if (country.sovereign === metropoleName) overseas.add(country.id);
  }

  const metropole = [];
  const empire = [];
  for (let i = 0; i < TILE_COUNT; i += 1) {
    if (owner[i] === SEA) continue;
    const country = world.countryOf?.[i] ?? -1;
    if (country >= 0 && home.has(country)) {
      metropole.push(i);
      continue;
    }
    if (country >= 0 && overseas.has(country)) {
      empire.push(i);
      continue;
    }
    // A power's empire is not in the sovereign table — it is simply ground the
    // power owns that is not its own country.
    if (power !== undefined && owner[i] === power) empire.push(i);
  }
  return { metropole, empire };
}

/** The formations a government raised, found by the ground they were raised on. */
export function forcesOf(world, key) {
  const metropoleName = METROPOLE_NAME[key] ?? key;
  const power = NATION_INDEX[key];
  const names = new Set();
  for (const country of world.countries ?? []) {
    if (country.name === metropoleName || country.sovereign === metropoleName) names.add(country.id);
  }
  const out = [];
  for (const placement of world.garrisons?.opening ?? []) {
    const nation = placement.formation.nation;
    // A power's army is its own by name. A neutral's is not — every neutral
    // army on the board is `nation: 'neutral'`, from Warsaw to Bern, so the
    // only thing that says which is which is the ground it was raised on.
    if (power !== undefined && nation === key) out.push(placement);
    else if (nation === 'neutral' && names.has(world.countryOf?.[placement.cell] ?? -1)) {
      out.push(placement);
    }
  }
  return out;
}

/**
 * Which governments fell today.
 *
 * A capital taken this morning is not a capitulation — it is a raid, and the
 * country has a day to take it back. A capital still in the same enemy hands
 * tomorrow morning is a government that has stopped governing.
 */
export function capitulationsOn({ world, day, captures = [], already = [] }) {
  const gone = new Set(already.map((c) => c.country));
  const out = [];

  for (const [, , , key] of CAPITALS_1939) {
    if (gone.has(key)) continue;
    if (NEVER_CAPITULATE.has(key)) continue;
    if (!CAPITULATIONS[key]) continue;

    const cell = capitalCell(key);
    if (cell === null || cell === undefined) continue;

    // Taken, and still in the same hands a day later. A capital that changed
    // hands this morning is a raid; the country has until tomorrow to take it
    // back.
    const to = heldOn(cell, day, captures);
    if (!to || to === 'neutral') continue;
    if (to !== heldOn(cell, day - 1, captures)) continue;
    // Not by its own government, which can happen when a country retakes its
    // own capital and the capture record says so.
    if (to === key) continue;

    const { metropole, empire } = holdingsOf(world, key);
    const successor = CAPITULATIONS[key].empire;
    out.push({
      day,
      country: key,
      to,
      empire: successor,
      note: CAPITULATIONS[key].note ?? null,
      cell,
      metropoleCells: metropole.length,
      empireCells: empire.length,
      forces: forcesOf(world, key).map((p) => p.id),
      fleets: (world.navies?.stations ?? []).filter((f) => f.power === key).map((f) => f.id),
      lanes: (world.convoys ?? []).filter((c) => c.power === key).map((c) => c.id),
    });
  }
  return out;
}

/**
 * Carry one out: move the ground, and stand the army down.
 *
 * The army does not change sides. A capitulated country's formations are gone —
 * 1.8 million French soldiers went into captivity in six weeks, and the
 * colonial garrisons were demobilised or went Vichy. What the successor
 * inherits is ground and what is under it, which it then has to find troops to
 * hold. That is the correct amount of help: Britain gained the Congo's copper
 * and no soldiers to guard it with, which is exactly the strain it was under.
 */
export function applyCapitulation(world, entry) {
  const { metropole, empire } = holdingsOf(world, entry.country);
  const captures = [];

  for (const cell of metropole) {
    if (world.ownership.owner[cell] === NATION_INDEX[entry.to]) continue;
    captures.push({ day: entry.day, cell, to: entry.to, capitulation: entry.country });
  }
  if (entry.empire) {
    for (const cell of empire) {
      if (world.ownership.owner[cell] === NATION_INDEX[entry.empire]) continue;
      captures.push({ day: entry.day, cell, to: entry.empire, capitulation: entry.country });
    }
  }

  // The army stands down where it is: one entry, everything taken.
  const stoodDown = entry.forces.length
    ? {
        day: entry.day,
        cell: entry.cell,
        capitulated: entry.country,
        losers: entry.forces,
        loserShare: 1,
        winners: [],
        winnerShare: 0,
      }
    : null;

  // And so does the fleet. Scuttled, interned or seized — the French navy was
  // all three inside two years — but in every case it stops being a force on
  // this board. Leaving it afloat would leave a ghost squadron nobody commands
  // ambushing people at Mers-el-Kébir on behalf of a country that no longer
  // exists.
  const interned = entry.fleets.length
    ? {
        day: entry.day,
        cell: entry.cell,
        capitulated: entry.country,
        losers: entry.fleets,
        loserShare: 1,
        winners: [],
        winnerShare: 0,
      }
    : null;

  // Its trade stops for good. A lane needs a country at the far end of it.
  const shut = entry.lanes.map((id) => ({
    day: entry.day,
    convoy: id,
    capitulated: entry.country,
    until: NEVER,
  }));

  return { captures, stoodDown, interned, shut };
}

/** A lane that is never coming back. Not Infinity, which does not survive JSON. */
export const NEVER = 999999;
