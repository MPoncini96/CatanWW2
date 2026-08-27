import { NATION_INDEX } from '../world/nations.js';
import { COSTS, effortOf } from './production.js';
import { menAvailable } from './manpower.js';
import { inSupply } from './supply.js';

// Raising a formation that did not exist.
//
// Until now a nation could rebuild what the order of battle gave it in
// September 1939 and nothing else, so over six years the war could only shrink.
// That is the wrong shape for this war above all others: the United States
// Army had nine divisions in 1939 and eighty-nine in 1945, the Red Army raised
// hundreds, and the Wehrmacht that invaded Poland with fifty-odd divisions was
// fielding three hundred by 1944.
//
// ---------------------------------------------------------------- the rules
//
// A formation is ordered at a city you hold and in supply, and it appears there
// months later. Everything it will cost — the stores, the factory time and,
// above all, **the men** — is paid on the day it is ordered, because that is
// when the class is called up and the contracts are placed. What arrives at the
// end is a formation like any other: it marches, fights, starves and can be
// rebuilt exactly as the ones the war started with.

/**
 * What a nation may raise.
 *
 * Deliberately few. These are the shapes armies were actually built in, and a
 * longer list would be a catalogue rather than a decision — the interesting
 * question is not which of forty variants to build, it is whether to spend the
 * month's intake on infantry now or armour in half a year.
 *
 * `days` is raising *and training*. A rifle division could be stood up in three
 * months and was not much good for another three; an armoured division took the
 * best part of a year, which is why nobody improvised one.
 */
export const TEMPLATES = [
  {
    id: 'infantry',
    name: 'Infantry Division',
    type: 'field',
    echelon: 'division',
    days: 90,
    quality: 0.5,
    mobility: 0.3,
    strength: { infantry: 15000, artillery: 40 },
    note: 'Three months to raise and three more before it is worth anything.',
  },
  {
    id: 'motorised',
    name: 'Motorised Division',
    type: 'field',
    echelon: 'division',
    days: 120,
    quality: 0.55,
    mobility: 0.8,
    strength: { infantry: 13000, artillery: 30 },
    note: 'Fewer men and lorries for all of them, which is the whole difference.',
  },
  {
    id: 'armour',
    name: 'Armoured Division',
    type: 'armor',
    echelon: 'division',
    days: 180,
    quality: 0.6,
    mobility: 0.9,
    strength: { infantry: 11000, tanks: 200, artillery: 30 },
    note: 'Half a year, and the tanks are the least of what takes the time.',
  },
  {
    id: 'artillery',
    name: 'Artillery Brigade',
    type: 'field',
    echelon: 'corps',
    days: 60,
    quality: 0.55,
    mobility: 0.25,
    strength: { infantry: 2000, artillery: 120 },
    note: 'The cheapest way to make a defensive line hurt.',
  },
  {
    id: 'fighters',
    name: 'Fighter Group',
    type: 'air',
    echelon: 'corps',
    days: 120,
    quality: 0.55,
    mobility: 1,
    strength: { infantry: 1500, fighters: 120 },
    note: 'Mostly ground crew. The pilots are the part that cannot be hurried.',
  },
  {
    id: 'bombers',
    name: 'Bomber Group',
    type: 'air',
    echelon: 'corps',
    days: 150,
    quality: 0.55,
    mobility: 1,
    strength: { infantry: 2500, bombers: 90 },
    note: 'Dear in aluminium, dearer in trained crews.',
  },
];

export const TEMPLATE_INDEX = Object.fromEntries(TEMPLATES.map((t) => [t.id, t]));

/** Men a template asks for: everybody in it, aircrew and gunners included. */
export function menIn(template) {
  let men = 0;
  for (const n of Object.values(template.strength)) men += n;
  return Math.round(men);
}

/** And what the stores must find. */
export function costOf(template) {
  const cost = {};
  for (const [arm, n] of Object.entries(template.strength)) {
    for (const [store, rate] of Object.entries(COSTS[arm] ?? {})) {
      cost[store] = (cost[store] ?? 0) + rate * n;
    }
  }
  return cost;
}

/** And what the factories must find. */
export function effortFor(template) {
  return effortOf(template.strength);
}

/** Which formations are still being raised on a given day. */
export function buildingOn(raisings, power, day) {
  return (raisings ?? []).filter(
    (r) => r.power === power && r.day <= day && r.ready > day,
  );
}

/** And which have arrived. */
export function readyBy(raisings, day) {
  return (raisings ?? []).filter((r) => r.ready <= day);
}

/**
 * The placement a finished raising becomes.
 *
 * Built from the record alone and nothing else, so the server and every client
 * construct the identical formation from the identical entry — which is the
 * whole reason the board can be replayed rather than sent.
 */
export function placementFor(entry) {
  const template = TEMPLATE_INDEX[entry.template];
  if (!template) return null;
  return {
    id: entry.id,
    cell: entry.cell,
    // The day it came into existence. Everything that replays strength has to
    // know this, or a division raised in 1943 turns up at full strength in the
    // record of 1940.
    raisedOn: entry.ready,
    formation: {
      id: entry.id,
      name: entry.name,
      nation: entry.power,
      type: template.type,
      echelon: template.echelon,
      theater: 'raised',
      quality: template.quality,
      mobility: template.mobility,
      raised: true,
      source: `raised ${template.name.toLowerCase()}, ordered on day ${entry.day}`,
    },
    strength: { ...template.strength },
  };
}

/**
 * A name for it.
 *
 * Numbered per nation per kind, in the order they were ordered, because that is
 * how armies name things and because "Infantry division #7" is a worse label
 * than "7th Infantry Division" for no gain.
 */
export function nameFor(power, template, existing) {
  const n = (existing ?? []).filter((r) => r.power === power && r.template === template.id).length + 1;
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? 'th' : { 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] ?? 'th';
  return `${n}${suffix} ${template.name}`;
}

/**
 * May this seat raise this here?
 *
 * Returns null if it may, or the sentence saying why not.
 */
export function mayRaise({
  world,
  power,
  cell,
  template,
  day,
  economy,
  capacity,
  replacements,
  raisings,
  spent,
  ordered,
}) {
  if (!power) return 'Nobody is sitting at this seat.';
  if (!template) return 'Nothing is selected to raise.';
  if (cell === null || cell === undefined) return 'No hex is selected.';

  if (world.ownership.owner[cell] !== NATION_INDEX[power]) {
    return 'A formation is raised on your own ground.';
  }
  // Somewhere that can house, feed and equip a division while it forms.
  const city = (world.cityAt?.[cell] ?? -1) >= 0;
  const works = (world.works ?? []).some((w) => w.cell === cell);
  if (!city && !works) return 'There is no town or works here to raise it at.';
  if (!inSupply(world, power, day, cell)) return 'Nothing can be got to this hex to raise it with.';

  // The men, which is the shortage that matters.
  const need = menIn(template);
  const have = menAvailable(world, power, day, replacements, raisings) - (ordered ?? 0);
  if (need > have) {
    return `${Math.round(have).toLocaleString()} men are available; this needs ${need.toLocaleString()}.`;
  }

  // The stores.
  if (economy) {
    for (const [store, amount] of Object.entries(costOf(template))) {
      const index = economy.stores.findIndex((s) => s.id === store);
      if (index < 0) continue;
      const inHand = economy.stores[index].stock - (spent?.[store] ?? 0);
      if (amount > inHand) {
        return `not enough ${economy.stores[index].name.toLowerCase()} — ${Math.round(amount)} wanted, ${Math.round(Math.max(0, inHand))} in hand`;
      }
    }
  }

  // And the factories, which for infantry is never the binding one and for a
  // bomber group can be.
  if (capacity && effortFor(template) > capacity) {
    return `the factories can find ${Math.round(capacity).toLocaleString()} plant-days today; this needs ${effortFor(template).toLocaleString()}.`;
  }
  return null;
}
