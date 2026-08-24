import { TILE_COUNT, grid, neighbours } from './sphere.js';
import { NATIONS, NATION_INDEX, NEUTRAL, SEA } from './nations.js';
import { TERRITORIES_1939 } from './territories.js';
import { TERRAIN } from './terrain.js';
import { attachLeanings } from './leanings.js';

// Countries, as distinct from powers.
//
// The eight belligerents are drawn in their own colours wherever they and their
// empires reach, so the shape of the war stays readable at a glance. Everyone
// else — the neutrals the powers were about to march through or bargain over —
// gets a colour of their own rather than sharing one anonymous grey.
//
// A country is a group of territory boxes. Several boxes make one country
// because a country's shape rarely fits one rectangle: Yugoslavia takes three,
// Mexico three, mainland Italy four.

/**
 * Territory name -> country. Anything not listed keeps its own name, which is
 * why most of the file is only the cases where the two differ.
 */
const TERRITORY_COUNTRY = {
  // --- Greater Germany ---
  Silesia: 'Germany',
  Saar: 'Germany',
  'Bohemia and Moravia': 'Bohemia',
  // --- The Soviet Union ---
  'Maritime Province': 'Soviet Union',
  'Maritime Province (Amur)': 'Soviet Union',
  Chukotka: 'Soviet Union',
  // --- The United Kingdom ---
  'Northern Ireland': 'United Kingdom',
  'Southern England': 'United Kingdom',
  'Canada (Ontario)': 'Canada',
  'Canada (Quebec)': 'Canada',
  'Vancouver Island': 'Canada',
  Newfoundland: 'Canada',
  'British Baluchistan': 'India',
  'Sierra Leone and the Gambia': 'Sierra Leone',
  'Rhodesia and Nyasaland': 'Rhodesia',
  'Anglo-Egyptian Sudan': 'Sudan',
  'Palestine and Transjordan': 'Palestine',
  'The Trucial Coast and Qatar': 'The Gulf States',
  Kuwait: 'The Gulf States',
  'Papua and New Guinea': 'Papua',
  'Malaya (centre)': 'Malaya',
  'Malaya (Johore)': 'Malaya',
  'The Bahamas': 'Bahamas',
  'West Indies (Trinidad)': 'West Indies',
  // --- France ---
  Corsica: 'France',
  'Alsace-Lorraine': 'France',
  'Syria and Lebanon': 'Syria',
  'French Indochina': 'Indochina',
  'French Indochina (Annam)': 'Indochina',
  // --- Italy ---
  'Northern Italy': 'Italy',
  'Central Italy': 'Italy',
  'Southern Italy': 'Italy',
  Sicily: 'Italy',
  Sardinia: 'Italy',
  // --- The United States ---
  'New England': 'United States',
  'St Lawrence Island': 'United States',
  'Alaska Panhandle (north)': 'Alaska',
  'Alaska Panhandle (south)': 'Alaska',
  'Western Aleutians': 'Alaska',
  // --- Japan and its empire ---
  'Japan (Kyushu and the west)': 'Japan',
  'Japan (Hokkaido)': 'Japan',
  'Ryukyu Islands': 'Japan',
  'Kuril Islands': 'Japan',
  'Korea (north-west)': 'Korea',
  'Korea (north-centre)': 'Korea',
  'Korea (north-east)': 'Korea',
  'Mariana Islands': 'South Seas Mandate',
  'Caroline Islands': 'South Seas Mandate',
  'Marshall Islands': 'South Seas Mandate',
  'Manchukuo (Amur)': 'Manchukuo',
  'Manchukuo (Amur bend)': 'Manchukuo',
  'Manchukuo (Lesser Khingan)': 'Manchukuo',
  'Manchukuo (Jehol)': 'Manchukuo',
  'Manchukuo (Liaodong)': 'Manchukuo',
  'Manchukuo (Hulunbuir)': 'Manchukuo',
  'North China': 'Occupied China',
  'Lower Yangtze': 'Occupied China',
  Kwangtung: 'Occupied China',
  Hainan: 'Occupied China',
  // --- China ---
  'Northern Xinjiang': 'China',
  'Gansu Corridor': 'China',
  'Inner Mongolia': 'China',
  // --- Neutrals whose boxes are split ---
  Eire: 'Ireland',
  'Norway (Arctic)': 'Norway',
  'Norway (Nordland)': 'Norway',
  'Norway (Finnmark)': 'Norway',
  Svalbard: 'Norway',
  'Belgium (Ardennes)': 'Belgium',
  'Netherlands (south)': 'Netherlands',
  'Netherlands (north)': 'Netherlands',
  'Spain (Catalonia)': 'Spain',
  'Bolivia (Pando)': 'Bolivia',
  'Colombia (Amazonia)': 'Colombia',
  'Colombia (Putumayo)': 'Colombia',
  'Colombia (Leticia)': 'Colombia',
  'Peru (Loreto)': 'Peru',
  'Peru (centre)': 'Peru',
  'Peru (Madre de Dios)': 'Peru',
  'Bolivia (Beni)': 'Bolivia',
  'Bolivia (Chaco)': 'Bolivia',
  'Sweden (Norrland)': 'Sweden',
  'Sweden (Lapland)': 'Sweden',
  'Chile (Atacama)': 'Chile',
  'Chile (Araucania)': 'Chile',
  'Chile (Magellan)': 'Chile',
  'Poland (Galicia)': 'Poland',
  'Yugoslavia (Dalmatia)': 'Yugoslavia',
  'Yugoslavia (Bosnia and Serbia)': 'Yugoslavia',
  'Yugoslavia (Montenegro)': 'Yugoslavia',
  'Carpathian Ruthenia': 'Hungary',
  'Mongolia (west)': 'Mongolia',
  'Mongolia (Khovsgol)': 'Mongolia',
  'Mongolia (central)': 'Mongolia',
  'Mongolia (east)': 'Mongolia',
  'Mongolia (Dornod)': 'Mongolia',
  'Mongolia (south-east)': 'Mongolia',
  'Greenland (south)': 'Greenland',
  'Greenland (west)': 'Greenland',
  'Greenland (north-west)': 'Greenland',
  'Greenland (Thule)': 'Greenland',
  'Ellesmere Island': 'Canada',
  'Ellesmere Island (north)': 'Canada',
  'Mexico (northwest)': 'Mexico',
  'Mexico (centre)': 'Mexico',
  'Mexico (southeast)': 'Mexico',
  'Saudi Arabia and Yemen': 'Saudi Arabia',
  'Wakhan Corridor': 'Afghanistan',
  'Spanish Morocco and Rio de Oro': 'Spanish Morocco',
};

/**
 * Colours for the neutrals. Hand-assigned rather than generated, so that
 * countries which share a border also differ in hue — the whole point is being
 * able to tell Hungary from Romania at a glance. Muted enough to sit under the
 * belligerents without competing with them.
 */
const NEUTRAL_COLORS = {
  // Europe, where the borders are tightest and the colours must differ most.
  Poland: '#b8574e',
  Slovakia: '#c98a52',
  Hungary: '#8f7fb8',
  Romania: '#5f9e7a',
  Yugoslavia: '#a8626f',
  Bulgaria: '#7b8f52',
  Greece: '#5a8fa8',
  Albania: '#9c7a5a',
  Switzerland: '#b05f5f',
  Belgium: '#6f7fa8',
  Netherlands: '#c08a5a',
  Denmark: '#a85f7a',
  Norway: '#5f7f9c',
  Sweden: '#6f96b8',
  Finland: '#8aa8bd',
  Ireland: '#5f9c6a',
  Iceland: '#7fa8a0',
  Spain: '#c0985a',
  Portugal: '#8a9c5f',
  Estonia: '#7a94a8',
  Latvia: '#96788f',
  Lithuania: '#a88a6a',
  Turkey: '#a87a52',
  // The Near East and Asia.
  Persia: '#7f9c62',
  Afghanistan: '#9c8560',
  'Saudi Arabia': '#c2a068',
  Oman: '#a89060',
  Thailand: '#8f6f9c',
  Tibet: '#93a3b3',
  Nepal: '#7f8fa0',
  Bhutan: '#6f8f8a',
  Mongolia: '#a89870',
  'Netherlands East Indies': '#8fa85f',
  Borneo: '#7a9c6f',
  'Portuguese Timor': '#9c7f6f',
  // Africa.
  Liberia: '#7f9c8a',
  Angola: '#a87f5f',
  Mozambique: '#8a7f9c',
  'Spanish Morocco': '#b08a6f',
  // The Americas.
  Mexico: '#7fa06a',
  'Central America': '#a09060',
  'West Indies': '#a06f7f',
  Brazil: '#6f9c7a',
  Argentina: '#7f96b0',
  Chile: '#a87a6f',
  Peru: '#96856f',
  Bolivia: '#8f7a96',
  Colombia: '#a89060',
  Venezuela: '#8a9c6f',
  Ecuador: '#7f9c96',
  Paraguay: '#9c9060',
  Uruguay: '#6f8fa0',
  Greenland: '#8aa0b0',
  'Dutch Guiana': '#7f8f9c',
};

const FALLBACK_NEUTRAL = '#6a7280';

/** The country a territory belongs to. */
export function countryFor(territory) {
  return TERRITORY_COUNTRY[territory.name] ?? territory.name;
}

/**
 * Build the country layer: which country holds each hex, what colour it draws
 * in, and where to write its name.
 */
export function buildCountries(world) {
  const owner = world.ownership.owner;

  // Every distinct country named by the territory table, in table order.
  const index = new Map();
  const countries = [];
  for (const territory of TERRITORIES_1939) {
    const name = countryFor(territory);
    if (index.has(name)) continue;
    index.set(name, countries.length);
    const power = NATION_INDEX[territory.owner] ?? NEUTRAL;
    countries.push({
      id: countries.length,
      name,
      power,
      // A belligerent's colonies fly its colours, so the shape of the war stays
      // readable; the neutrals each get their own.
      color:
        power === NEUTRAL
          ? NEUTRAL_COLORS[name] ?? FALLBACK_NEUTRAL
          : NATIONS[power].color,
      hexes: 0,
    });
  }

  // Territory boxes are tested in order, first match wins, exactly as
  // ownership is resolved — so the two layers always agree.
  const byName = new Map();
  for (const territory of TERRITORIES_1939) {
    byName.set(territory.name, index.get(countryFor(territory)));
  }

  const countryOf = new Int16Array(TILE_COUNT).fill(-1);
  for (let i = 0; i < TILE_COUNT; i += 1) {
    if (owner[i] === SEA) continue;
    const name = world.territoryName[i];
    const id = name === null ? undefined : byName.get(name);
    if (id === undefined) continue;
    countryOf[i] = id;
    countries[id].hexes += 1;
  }

  labelAnchors(world, countryOf, countries);
  attachLeanings(countries);
  return { countries, countryOf };
}

/**
 * Where to write each country's name.
 *
 * The centroid of everything a country owns is wrong for a scattered empire —
 * it puts "United Kingdom" in the mid-Atlantic. Each country is instead broken
 * into connected blocks and labelled on the largest, at the point inside it
 * furthest from any edge, so the name sits in open ground rather than across a
 * coastline.
 */
function labelAnchors(world, countryOf, countries) {
  const sphere = grid();
  const seen = new Uint8Array(TILE_COUNT);
  const best = new Map(); // country id -> { size, cells }

  for (let start = 0; start < TILE_COUNT; start += 1) {
    const id = countryOf[start];
    if (id < 0 || seen[start]) continue;
    const stack = [start];
    seen[start] = 1;
    const cells = [];
    while (stack.length) {
      const i = stack.pop();
      cells.push(i);
      for (const j of neighbours(i)) {
        if (seen[j] || countryOf[j] !== id) continue;
        seen[j] = 1;
        stack.push(j);
      }
    }
    const current = best.get(id);
    if (!current || cells.length > current.size) best.set(id, { size: cells.length, cells });
  }

  for (const country of countries) {
    const block = best.get(country.id);
    if (!block) continue;
    const inBlock = new Set(block.cells);
    // Distance from the edge of the block, by breadth-first spread inwards.
    // No poles to special-case any more: every cell has a full ring of
    // neighbours, so the edge of a block is simply where they run out.
    let frontier = block.cells.filter((i) => neighbours(i).some((j) => !inBlock.has(j)));
    let deepest = frontier.length ? frontier : block.cells;
    const visited = new Set(frontier);
    while (frontier.length) {
      const next = [];
      for (const i of frontier) {
        for (const j of neighbours(i)) {
          if (visited.has(j) || !inBlock.has(j)) continue;
          visited.add(j);
          next.push(j);
        }
      }
      if (next.length) deepest = next;
      frontier = next;
    }
    const anchor = deepest[Math.floor(deepest.length / 2)];
    country.labelCell = anchor;
    country.labelLat = sphere.lat[anchor];
    country.labelLon = sphere.lon[anchor];
    country.blockHexes = block.size;
  }
}
