import { cellAt, neighbours } from './sphere.js';
import { TERRAIN } from './terrain.js';
import { NATION_INDEX } from './nations.js';

// The yards of 1939.
//
// A fleet could be sunk and nothing on this board could replace it. Six naval
// powers had the largest shipbuilding industries on earth and the game did not
// know they existed, so every hull lost was lost for good and the sea was a
// resource that only ever ran down. That is the wrong shape for a war whose
// outcome at sea was decided by construction: the Royal Navy that won the
// Atlantic was not the one that started it, and the United States Navy of 1945
// was built almost entirely after Pearl Harbor.
//
// ---------------------------------------------------------------- the shape
//
// **A yard is a place.** That is the whole reason for putting them on the map
// rather than giving each power a build queue. A yard sits on a hex somebody
// owns, it can be bombed, and it can be taken — the RAF spent four years over
// Kiel and Hamburg for exactly this reason, and Germany took the French yards
// at Saint-Nazaire and Lorient and used them for the rest of the war.
//
// **A slip is the constraint.** Not steel and not money: you could build as
// many hulls at once as you had berths to build them on, and a berth holding a
// battleship for three years is a berth not holding twelve destroyers. That
// trade is the decision this whole system exists to offer, and it is the one
// every naval staff in the war actually argued about.
//
// **A finished ship joins the fleet nearest the yard.** Ships were built where
// the yards were and then steamed to where they were wanted; the sailing
// orders already model the second half of that, so the yard only has to hand
// the hulls to the nearest anchorage of its own power and let the player take
// it from there.

/**
 * @typedef {object} Yard
 * @property {string} power  who built it, on 1 September 1939
 * @property {string} name
 * @property {number} lat
 * @property {number} lon
 * @property {number} slips  hulls it can have in build at once
 * @property {boolean} [capital]  whether it can lay down a capital ship
 */

/**
 * Where warships were built, and how much of a berth each place had.
 *
 * Slips are naval building berths, not total shipyard capacity: the Clyde and
 * the Tyne between them launched more merchant tonnage than warships, and the
 * merchant yards are not here because merchant hulls are the convoys, which
 * are modelled elsewhere.
 *
 * `capital` marks the berths long and deep enough for a battleship or a fleet
 * carrier. There were far fewer of those than of ordinary slips and it was a
 * real constraint — Germany could only build a Bismarck at four places on
 * earth, and one of the reasons the Kriegsmarine's Plan Z was fantasy is that
 * the berths for it did not exist.
 */
export const YARDS_1939 = [
  // ------------------------------------------------------------- Britain --
  // The largest naval shipbuilding industry in the world in 1939 and the one
  // that had been starved longest: twenty years of treaty limits and the Ten
  // Year Rule had shut berths that took the whole first half of the war to
  // reopen.
  { power: 'uk', name: 'Clydebank', lat: 55.9, lon: -4.4, slips: 6, capital: true },
  { power: 'uk', name: 'Barrow', lat: 54.1, lon: -3.2, slips: 4, capital: true },
  { power: 'uk', name: 'Tyneside', lat: 55.0, lon: -1.5, slips: 5, capital: true },
  { power: 'uk', name: 'Birkenhead', lat: 53.4, lon: -3.0, slips: 4, capital: true },
  { power: 'uk', name: 'Belfast', lat: 54.6, lon: -5.9, slips: 4, capital: true },
  { power: 'uk', name: 'Portsmouth Dockyard', lat: 50.8, lon: -1.1, slips: 3 },
  { power: 'uk', name: 'Devonport Dockyard', lat: 50.4, lon: -4.2, slips: 3 },
  { power: 'uk', name: 'Chatham Dockyard', lat: 51.4, lon: 0.5, slips: 3 },

  // -------------------------------------------------------------- America --
  // Eight yards that could build a capital ship, and behind them an industry
  // that had not yet been asked for anything. Everything about the American
  // figures here is what existed in 1939 and not what was there by 1943, when
  // the country was launching a destroyer escort every two days.
  { power: 'usa', name: 'Newport News', lat: 36.98, lon: -76.43, slips: 5, capital: true },
  { power: 'usa', name: 'New York Navy Yard', lat: 40.70, lon: -73.97, slips: 5, capital: true },
  { power: 'usa', name: 'Philadelphia Navy Yard', lat: 39.89, lon: -75.18, slips: 4, capital: true },
  { power: 'usa', name: 'Norfolk Navy Yard', lat: 36.82, lon: -76.30, slips: 4, capital: true },
  { power: 'usa', name: 'Fore River', lat: 42.24, lon: -70.95, slips: 4, capital: true },
  { power: 'usa', name: 'Camden', lat: 39.94, lon: -75.13, slips: 4, capital: true },
  { power: 'usa', name: 'Bath', lat: 43.91, lon: -69.81, slips: 4 },
  { power: 'usa', name: 'Kearny', lat: 40.75, lon: -74.10, slips: 4 },
  { power: 'usa', name: 'Mare Island', lat: 38.10, lon: -122.27, slips: 4 },
  { power: 'usa', name: 'Puget Sound Navy Yard', lat: 47.55, lon: -122.65, slips: 3 },

  // ---------------------------------------------------------------- Japan --
  // Kure built the Yamato and could build nothing else while it did, which is
  // the argument against a battleship in one sentence.
  { power: 'japan', name: 'Kure', lat: 34.24, lon: 132.56, slips: 5, capital: true },
  { power: 'japan', name: 'Nagasaki', lat: 32.74, lon: 129.87, slips: 4, capital: true },
  { power: 'japan', name: 'Yokosuka', lat: 35.29, lon: 139.67, slips: 4, capital: true },
  { power: 'japan', name: 'Kobe', lat: 34.68, lon: 135.19, slips: 4 },
  { power: 'japan', name: 'Sasebo', lat: 33.16, lon: 129.72, slips: 3 },
  { power: 'japan', name: 'Maizuru', lat: 35.47, lon: 135.39, slips: 3 },

  // -------------------------------------------------------------- Germany --
  // Four berths that could take a capital ship and a great many that could
  // take a U-boat, which is the shape the Kriegsmarine's war actually took
  // whatever Plan Z said about it.
  { power: 'germany', name: 'Kiel', lat: 54.33, lon: 10.14, slips: 5, capital: true },
  { power: 'germany', name: 'Hamburg', lat: 53.53, lon: 9.95, slips: 5, capital: true },
  { power: 'germany', name: 'Wilhelmshaven', lat: 53.51, lon: 8.14, slips: 4, capital: true },
  { power: 'germany', name: 'Bremen', lat: 53.10, lon: 8.75, slips: 4 },
  { power: 'germany', name: 'Stettin', lat: 53.42, lon: 14.55, slips: 3 },

  // ---------------------------------------------------------------- Italy --
  { power: 'italy', name: 'Genoa', lat: 44.40, lon: 8.92, slips: 4, capital: true },
  { power: 'italy', name: 'Trieste', lat: 45.65, lon: 13.77, slips: 4, capital: true },
  { power: 'italy', name: 'Taranto', lat: 40.47, lon: 17.24, slips: 3 },
  { power: 'italy', name: 'La Spezia', lat: 44.10, lon: 9.83, slips: 3 },
  { power: 'italy', name: 'Naples', lat: 40.84, lon: 14.25, slips: 3 },

  // ------------------------------------------------------------ The Soviets --
  // Two of the four are on seas that cannot reinforce each other, and
  // Leningrad — which is most of it — spent the war under siege and inside
  // artillery range.
  { power: 'ussr', name: 'Leningrad', lat: 59.93, lon: 30.31, slips: 5, capital: true },
  { power: 'ussr', name: 'Nikolayev', lat: 46.97, lon: 32.00, slips: 4, capital: true },
  { power: 'ussr', name: 'Molotovsk', lat: 64.56, lon: 39.83, slips: 3 },
  { power: 'ussr', name: 'Komsomolsk', lat: 50.55, lon: 137.01, slips: 3 },

  // China had no yards worth the name and no navy left to build for: what
  // there was went down at Jiangyin in 1937, scuttled across the Yangtze.
];

/**
 * Put the yards on the board.
 *
 * Each one resolves to a hex and to the anchorages its finished ships will be
 * handed to — the nearest station of the same power, by great circle, worked
 * out once here so that the server and every client agree without either
 * sending the other a map.
 *
 * Two anchorages, because the submarines are a separate command. A boat built
 * at Kiel joins the U-boat flotilla and not the battle fleet, for the same
 * reason the flotilla is a separate fleet in the first place: if the only
 * thing you can order at Wilhelmshaven is "Wilhelmshaven", then sending the
 * U-boats into the Atlantic sends the capital ships with them.
 */
export function buildYards(world, sphere, stations) {
  const out = [];
  for (const yard of YARDS_1939) {
    const cell = slipway(world, sphere, cellAt(sphere, yard.lat, yard.lon), yard.power);
    const nearest = (want) => {
      let best = null;
      let closest = Infinity;
      for (const station of stations ?? []) {
        if (station.power !== yard.power) continue;
        if (station.id.endsWith('-flotilla') !== want) continue;
        const away = greatCircle(sphere.lat[cell], sphere.lon[cell], station.lat, station.lon);
        // Ties by id, so the answer does not depend on the order of a list.
        if (away < closest || (away === closest && best && station.id < best.id)) {
          closest = away;
          best = station;
        }
      }
      return best;
    };
    const berth = nearest(false);
    const flotilla = nearest(true);
    out.push({
      id: `yard:${yard.power}:${yard.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      power: yard.power,
      name: yard.name,
      cell,
      slips: yard.slips,
      capital: Boolean(yard.capital),
      // Where the hulls go when they float. Null only if the power has no
      // anchorage of that kind, and a power with neither cannot build at all.
      berth: berth?.id ?? flotilla?.id ?? null,
      berthName: berth?.name ?? flotilla?.name ?? null,
      boatBerth: flotilla?.id ?? berth?.id ?? null,
      boatBerthName: flotilla?.name ?? berth?.name ?? null,
    });
  }
  return merge(out).sort((a, b) => a.cell - b.cell);
}

/**
 * Two yards on one hex are one yard.
 *
 * Four pairs of these land on the same cell and at sixty-seven kilometres
 * across they are honestly the same place: Kearny is across the Hudson from
 * the New York Navy Yard, Newport News is across Hampton Roads from Norfolk.
 * The alternative is a lookup by hex that quietly returns the first of two and
 * loses the other's berths, which is how a nation ends up with nine slips it
 * cannot use.
 *
 * The larger yard gives the merged one its name and the rest are kept in
 * `also`, because "Hamburg" on the map and "with Bremen" in the panel is both
 * true and the way anyone would say it.
 */
function merge(yards) {
  const byCell = new Map();
  for (const yard of yards) {
    const already = byCell.get(yard.cell);
    if (!already) {
      byCell.set(yard.cell, { ...yard, also: [] });
      continue;
    }
    // The bigger of the two names the place; the smaller is remembered.
    const [keep, folded] = already.slips >= yard.slips ? [already, yard] : [yard, already];
    byCell.set(yard.cell, {
      ...keep,
      also: [...(already.also ?? []), ...(yard.also ?? []), folded.name],
      slips: already.slips + yard.slips,
      capital: already.capital || yard.capital,
    });
  }
  return [...byCell.values()];
}

/**
 * The hex a yard actually stands on.
 *
 * A dockyard's coordinates are the quay, and at 67 kilometres to a cell the
 * quay usually falls in the water: nine of these thirty-eight landed at sea on
 * the first attempt, and Leningrad landed in Finland. So the nominal cell is
 * only a starting point, and the yard walks outward from it to the nearest
 * hex that is dry, held by the power that built it, and on the coast — because
 * a shipyard that cannot get a hull to the sea is a factory.
 *
 * Deliberately preferring, in order: its own coast, its own dry ground, any
 * coast. The last is the fallback that never fires on this board and is here
 * so that moving a yard by a degree cannot silently put it in the ocean.
 */
function slipway(world, sphere, from, power) {
  const owner = world?.ownership?.owner;
  const seat = NATION_INDEX[power];
  const dry = (i) => !TERRAIN[world.biome[i]].water;
  const coastal = (i) => {
    for (const j of neighbours(i)) if (TERRAIN[world.biome[j]].water) return true;
    return false;
  };

  let ownDry = -1;
  let anyCoast = -1;
  // Breadth-first, so the first hit at each radius is the nearest one.
  const seen = new Set([from]);
  let wave = [from];
  for (let step = 0; step <= 4 && wave.length; step += 1) {
    const next = [];
    for (const i of wave) {
      if (dry(i)) {
        const mine = !owner || owner[i] === seat;
        if (mine && coastal(i)) return i;
        if (mine && ownDry === -1) ownDry = i;
        if (coastal(i) && anyCoast === -1) anyCoast = i;
      }
      for (const j of neighbours(i)) {
        if (seen.has(j)) continue;
        seen.add(j);
        next.push(j);
      }
    }
    wave = next;
  }
  if (ownDry >= 0) return ownDry;
  if (anyCoast >= 0) return anyCoast;
  return from;
}

/** Kilometres between two points on the surface. */
function greatCircle(lat1, lon1, lat2, lon2) {
  const r = Math.PI / 180;
  const a = Math.sin(lat1 * r) * Math.sin(lat2 * r);
  const b = Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.cos((lon2 - lon1) * r);
  return Math.acos(Math.max(-1, Math.min(1, a + b))) * 6371;
}

/** The yard on a hex, if there is one. */
export function yardAt(world, cell) {
  return (world.shipyards ?? []).find((y) => y.cell === cell) ?? null;
}

/** Every yard a power built in 1939, wherever it stands now. */
export function yardsOf(world, power) {
  return (world.shipyards ?? []).filter((y) => y.power === power);
}
