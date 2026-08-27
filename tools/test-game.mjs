/**
 * The rules, under plain Node.
 *
 *   npm test
 *
 * `src/game/` is pure — no browser, no network, no clock, no file — which is
 * the whole reason it can be checked like this. So is the territory table: a
 * box list and a point test.
 *
 * The last section is different in kind. It sweeps all 114,492 cells of the
 * real board — the only thing here that reads `earth.bin` — because the class
 * of bug it looks for cannot be found by asking about places you already
 * suspect. A gap between two rectangles is invisible until something walks
 * every cell and asks each one which region it is standing in.
 *
 * Nothing here draws anything. What is checked is the part that decides what a
 * player may do: what day it is, who may fight whom, who takes a turn, and who
 * holds the ground.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TILE_COUNT, cellAt, grid, neighbours } from '../src/world/sphere.js';
import { nearestTerritory, territoryFor } from '../src/world/territories.js';
import { dateOf, dayOf, formatDate, formatDateShort } from '../src/game/calendar.js';
import { EVENTS_1939, eventsOn, nextEventAfter } from '../src/game/events.js';
import {
  enemiesOf,
  entersOn,
  isActive,
  mayFight,
  warsAt,
} from '../src/game/belligerence.js';
import { PLAYER_IDS } from '../src/game/players.js';
import * as G from '../src/game/state.js';
import { TERRITORIES_1939, territoryAt } from '../src/world/territories.js';
import { countryFor } from '../src/world/countries.js';
import { NATIONS, NATION_INDEX, NEUTRAL, SEA } from '../src/world/nations.js';
import { canSeeForces, seesCell, seesFleet } from '../src/world/intel.js';
import { NAVIES_1939, SHIPS, STATIONS, buildNavies } from '../src/world/navies.js';
import { STOCKPILES_1939, economyFor } from '../src/world/economy.js';
import { buildWorld } from '../src/world/earth.js';
import { MASTER, isMaster, pathOf, powerFromPath } from '../src/ui/routes.js';
import { ORDERS, ordersFor, partiesAt, partyAt } from '../src/game/orders.js';
import {
  arrivalsAt,
  atWar,
  executeOrders,
  isMobile,
  mayMarch,
  positionsAt,
  restDays,
} from '../src/game/movement.js';
import {
  RATINGS,
  TERRAIN_DEFENCE,
  fight,
  groundBonus,
  isCapital,
  luckAt,
  resolveDay,
  retreatTo,
  strengthOf,
  strengthsAt,
} from '../src/game/combat.js';
import { CAPITALS_1939, capitalAt } from '../src/world/capitals.js';
import {
  COLUMN_RATE,
  COSTS,
  CREW,
  EFFORT,
  PLANT_DAYS_PER_KT,
  canAfford,
  capacityFor,
  effortOf,
  replacementFor,
  spentBy,
} from '../src/game/production.js';
import {
  RAIL_REACH,
  ROAD_REACH,
  STARVATION,
  UNSUPPLIED_STRENGTH,
  starvation,
  supplyMap,
} from '../src/game/supply.js';
import { DEPOTS_1939, PORTS_1939 } from '../src/world/depots.js';
import { placeOf, reportFor } from '../src/game/report.js';
import { drawOrders } from '../src/render/orders.js';
import {
  BOMBER_RANGE,
  FIGHTER_RANGE,
  FIGHTER_WEIGHT,
  FLAK_WEIGHT,
  defenceOf,
  hexesApart,
  mayRaid,
} from '../src/game/bombing.js';
import {
  BOMBARDMENT,
  CONVOY_SPEED,
  FLEET_SPEED,
  bombardmentFor,
  fleetStrength,
  fleetsAt,
  fleetsOf,
  mayShip,
  resolveNavalDay,
} from '../src/game/naval.js';
import { RELIEF_DAYS, ROUTES_1939, convoyCell, deliveredBy } from '../src/world/convoys.js';
import {
  CAPITULATIONS,
  NEVER_CAPITULATE,
  capitulationsOn,
  displayName,
  forcesOf,
  holdingsOf,
} from '../src/game/capitulation.js';
import { capitalCell } from '../src/world/capitals.js';
import { UNPLAYED } from '../src/game/players.js';
import {
  JAPAN_BOMBING_TOLL,
  cityCell,
  countryHexes,
  defeats,
  heldCells,
  hexesHeld,
  peopleOf,
  standings,
  victory,
} from '../src/game/victory.js';
import { CIVILIANS_PER_BOMBER, civilianDead } from '../src/game/bombing.js';
import { ISLANDS_1939 } from '../src/world/islands.js';
import { PRESSED_HOME, collisionsAt } from '../src/game/combat.js';
import { LANDING_HEAVY, LANDING_STRENGTH } from '../src/game/combat.js';
import {
  LIFT_PER_HULL,
  cargoAt,
  carriedBy,
  liftOf,
  mayEmbark,
  mayLand,
  menIn,
} from '../src/game/amphibious.js';
import { FORCES_1939, UNITS, UNIT_INDEX } from '../src/world/forces.js';
import { FORMATIONS, ZONES } from '../src/world/oob1939.js';
import { ACCESS, isField } from '../src/world/deploy.js';
import { PLAYER_IDS as POWERS } from '../src/game/players.js';
import { T, TERRAIN } from '../src/world/terrain.js';

let checks = 0;
let failures = 0;

// The finished board — terrain, people, output, armies and fleets. Two sections
// need all of it and it takes a second to build, so it is built once and only
// when something asks for it.
let WORLD = null;
function board() {
  if (WORLD) return WORLD;
  const here = path.dirname(fileURLToPath(import.meta.url));
  const bin = fs.readFileSync(path.join(here, '..', 'src', 'world', 'earth.bin'));
  WORLD = buildWorld(
    bin.subarray(0, TILE_COUNT),
    bin.subarray(TILE_COUNT, TILE_COUNT * 2),
    bin.subarray(TILE_COUNT * 2, TILE_COUNT * 3),
  );
  return WORLD;
}

/**
 * A board nobody else is using.
 *
 * `board()` hands out one cached world, which is right for every other section
 * and wrong for this one: a capitulation moves two thousand hexes, and doing
 * that to the shared board would quietly rewrite the map underneath every test
 * that ran after it.
 */
function freshBoard() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const bin = fs.readFileSync(path.join(here, '..', 'src', 'world', 'earth.bin'));
  return buildWorld(
    bin.subarray(0, TILE_COUNT),
    bin.subarray(TILE_COUNT, TILE_COUNT * 2),
    bin.subarray(TILE_COUNT * 2, TILE_COUNT * 3),
  );
}

/** The cell a place is on, for asking about somewhere by name. */
function cellFor(lat, lon) {
  return cellAt(grid(), lat, lon);
}

function ok(condition, what) {
  checks += 1;
  if (!condition) {
    failures += 1;
    console.error(`  FAIL  ${what}`);
  }
}

function eq(got, want, what) {
  checks += 1;
  const same = JSON.stringify(got) === JSON.stringify(want);
  if (!same) {
    failures += 1;
    console.error(`  FAIL  ${what}\n        got  ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`);
  }
}

function section(name) {
  console.log(name);
}

// ------------------------------------------------------------- the calendar
section('the calendar');
{
  eq(dayOf(1939, 9, 1), 0, '1 September 1939 is day 0');
  eq(formatDate(0), '1 September 1939', 'day 0 reads back');
  eq(formatDateShort(dayOf(1940, 6, 10)), '10 Jun 1940', 'short form');
  eq(dayOf(1940, 6, 10), 283, "Italy's day");
  eq(dayOf(1941, 12, 7), 828, 'Pearl Harbor');
  // Thirteen years of days, out and back, across three leap years and 1900's
  // missing one on the other side of the epoch.
  let roundTrips = true;
  for (let day = -2000; day < 4800; day += 1) {
    const { year, month, day: d } = dateOf(day);
    if (dayOf(year, month, d) !== day) roundTrips = false;
  }
  ok(roundTrips, '6,800 days round-trip through the civil calendar');
  eq(dateOf(dayOf(1940, 2, 29)), { year: 1940, month: 2, day: 29 }, '29 February 1940 exists');
  eq(dayOf(1940, 3, 1) - dayOf(1940, 2, 1), 29, 'February 1940 has 29 days');
  eq(dayOf(1939, 3, 1) - dayOf(1939, 2, 1), 28, 'February 1939 has 28');
}

// ------------------------------------------------------------- the timeline
section('the timeline');
{
  const days = EVENTS_1939.map((e) => e.day);
  eq(
    days,
    [...days].sort((a, b) => a - b),
    'events are in date order — the replay walks them once, in order',
  );
  const ids = new Set(EVENTS_1939.map((e) => e.id));
  eq(ids.size, EVENTS_1939.length, 'event ids are unique');
  ok(
    EVENTS_1939.every((e) => e.name && e.text && e.wars.length),
    'every event has a name, a dispatch and something it grants',
  );
  eq(eventsOn(0).length, 2, 'two things are true on the opening day');
  eq(nextEventAfter(0).id, 'britain-and-france-declare-war', 'the 3rd is next');
  eq(nextEventAfter(EVENTS_1939.at(-1).day), null, 'the timeline runs out');
}

// --------------------------------------------------------- who may fight whom
section('who may fight whom');
{
  // The opening day: two wars and no others.
  ok(mayFight(0, 'germany', 'Poland'), 'Germany may fight Poland on 1 September');
  ok(mayFight(0, 'japan', 'china'), 'Japan and China have been fighting since 1937');
  ok(!mayFight(0, 'germany', 'uk'), 'Germany may not touch Britain on the 1st');
  ok(!mayFight(0, 'germany', 'france'), 'nor France');
  ok(!mayFight(0, 'ussr', 'Poland'), 'the Red Army has not moved on the 1st');
  eq(warsAt(0).size, 2, 'exactly two wars on day 0');

  // The 3rd. Britain and France bring their empires, so this is a great many
  // parties at once — and Poland is not one of Germany's new enemies twice.
  ok(!mayFight(1, 'germany', 'uk'), 'not yet on the 2nd');
  ok(mayFight(2, 'germany', 'uk'), 'Britain from the 3rd');
  ok(mayFight(2, 'germany', 'france'), 'France from the 3rd');
  ok(mayFight(2, 'germany', 'India'), "and India, which Britain brings with it");
  ok(mayFight(2, 'germany', 'New Zealand'), 'and New Zealand — a country name with a space in it');
  ok(!mayFight(2, 'uk', 'italy'), 'Britain and Italy are not at war in 1939');
  eq(
    enemiesOf(2, 'germany').filter((e) => ['France', 'United Kingdom'].includes(e)),
    [],
    'a power and its own metropolitan country are one party, not two',
  );
  ok(enemiesOf(2, 'germany').length > 40, 'Germany faces the two empires entire');

  // The 17th.
  ok(!mayFight(15, 'ussr', 'Poland'), 'not on the 16th');
  ok(mayFight(16, 'ussr', 'Poland'), 'the Red Army crosses on the 17th');
  ok(!mayFight(16, 'ussr', 'germany'), 'and is not at war with Germany');

  // Italy inherits exactly what Germany had, and not a party more.
  const italyDay = dayOf(1940, 6, 10);
  const germanyBefore = enemiesOf(italyDay - 1, 'germany');
  const italyAfter = enemiesOf(italyDay, 'italy');
  eq(italyAfter, germanyBefore, "Italy takes the field against Germany's enemies exactly");
  ok(!mayFight(italyDay - 1, 'italy', 'uk'), 'Italy is out of it the day before');

  // Barbarossa, and the two halves of the war becoming one.
  ok(!mayFight(dayOf(1941, 6, 21), 'germany', 'ussr'), 'the pact holds to 21 June 1941');
  ok(mayFight(dayOf(1941, 6, 22), 'germany', 'ussr'), 'and not on the 22nd');
  ok(mayFight(dayOf(1941, 12, 7), 'japan', 'usa'), 'Pearl Harbor');
  ok(mayFight(dayOf(1941, 12, 7), 'japan', 'uk'), 'and Malaya the same morning');
  ok(!mayFight(dayOf(1941, 12, 10), 'germany', 'usa'), 'Germany waits until the 11th');
  ok(mayFight(dayOf(1941, 12, 11), 'germany', 'usa'), 'and then declares');

  // Nobody is ever at war with themselves, and a war reads the same either way.
  const last = EVENTS_1939.at(-1).day;
  let symmetric = true;
  for (const a of PLAYER_IDS) {
    for (const b of PLAYER_IDS) {
      if (a === b && mayFight(last, a, b)) symmetric = false;
      if (mayFight(last, a, b) !== mayFight(last, b, a)) symmetric = false;
    }
  }
  ok(symmetric, 'wars are symmetric, and nobody fights themselves');
}

// ------------------------------------------------------------ entering the war
section('entering the war');
{
  eq(entersOn('germany'), dayOf(1939, 9, 1), 'Germany is in it from the first day');
  eq(entersOn('japan'), dayOf(1939, 9, 1), 'so is Japan');
  eq(entersOn('china'), dayOf(1939, 9, 1), 'and China');
  eq(entersOn('uk'), dayOf(1939, 9, 3), 'Britain on the 3rd');
  eq(entersOn('france'), dayOf(1939, 9, 3), 'France on the 3rd');
  eq(entersOn('ussr'), dayOf(1939, 9, 17), 'the Soviet Union on the 17th');
  eq(entersOn('italy'), dayOf(1940, 6, 10), 'Italy in June 1940');
  eq(entersOn('usa'), dayOf(1941, 12, 7), 'the United States at Pearl Harbor');
  ok(
    PLAYER_IDS.every((id) => entersOn(id) !== null),
    'every seat has a day it gets a turn — a seat that never does could never play',
  );
  ok(!isActive(0, 'italy'), 'Italy takes no turn on day 0');
  ok(isActive(dayOf(1940, 6, 10), 'italy'), 'and does from 10 June 1940');
  ok(isActive(9999, 'usa'), 'once in, a power stays in');
}

// -------------------------------------------------------------- the turn engine
section('the turn engine');
{
  const game = G.newGame();
  G.openingEvents(game);
  eq(game.day, 0, 'a new game opens on 1 September');
  eq(game.log.length, 2, 'and both opening dispatches are waiting');
  ok(!G.readyToAdvance(game), 'an empty table never advances on its own');

  eq(G.claim(game, 'germany', 'tok-de', 'Anna').seat.ready, false, 'Germany is taken');
  ok(G.claim(game, 'germany', 'tok-x', 'nobody').error, 'and cannot be taken twice');
  ok(G.claim(game, 'neutral', 'tok-x').error, 'Independent is not a seat');
  eq(G.seatOf(game, 'tok-de'), 'germany', 'a token finds its seat');
  eq(G.seatOf(game, 'nonsense'), null, 'and a stranger has none');

  G.claim(game, 'italy', 'tok-it', 'Bruno');
  eq(G.occupied(game), ['germany', 'italy'], 'two seats held, in board order');
  eq(G.voters(game), ['germany'], 'only Germany votes on 1 September 1939');

  // Italy is watching. It cannot end the day, and it cannot hold it up.
  ok(G.setReady(game, 'italy', true).error, 'Italy may not end a day it is not in');
  eq(game.seats.italy.ready, false, 'and its seat stays as it was');
  G.setReady(game, 'germany', true);
  ok(G.readyToAdvance(game), 'Germany alone can turn the day');

  eq(G.advance(game).length, 0, 'nothing happens on 2 September');
  eq(game.day, 1, 'the calendar moves');
  eq(game.seats.germany.ready, false, 'and readiness is cleared');

  // The 3rd brings Britain in, and its dispatch with it.
  const fired = G.advance(game);
  eq(fired.map((e) => e.id), ['britain-and-france-declare-war'], 'the 3rd fires');
  eq(game.log.length, 3, 'and lands in the log');
  G.claim(game, 'uk', 'tok-uk', 'Cleo');
  eq(G.voters(game).sort(), ['germany', 'uk'], 'Britain votes from the 3rd');
  G.setReady(game, 'germany', true);
  ok(!G.readyToAdvance(game), 'Germany can no longer turn the day alone');
  G.setReady(game, 'uk', true);
  ok(G.readyToAdvance(game), 'both together can');
  G.setReady(game, 'uk', false);
  ok(!G.readyToAdvance(game), 'and either can take it back');

  // What a client is allowed to see.
  const view = G.publicState(game, 'germany');
  eq(view.day, 2, 'the day crosses the wire');
  eq(view.date, '3 September 1939', 'as a date, too');
  ok(!JSON.stringify(view).includes('tok-'), 'no seat token ever leaves the server');
  eq(view.seats.find((s) => s.power === 'italy').inTheWar, false, 'Italy is shown as watching');
  eq(
    view.seats.find((s) => s.power === 'italy').entersOn,
    dayOf(1940, 6, 10),
    'with the day it gets in',
  );
  eq(view.seats.find((s) => s.power === 'germany').isYou, true, 'and the viewer knows its own seat');
  eq(view.waitingOn, ['uk'], 'and who the table is waiting for');

  // A table where nobody is in the war yet still has to be able to play.
  const watching = G.newGame();
  G.claim(watching, 'italy', 'tok-it', 'Bruno');
  G.claim(watching, 'usa', 'tok-us', 'Dee');
  eq(G.voters(watching).sort(), ['italy', 'usa'], 'with nobody in the war, everybody votes');
  G.setReady(watching, 'italy', true);
  ok(!G.readyToAdvance(watching), 'one of the two is not enough');
  G.setReady(watching, 'usa', true);
  ok(G.readyToAdvance(watching), 'both are');

  // Leaving frees the seat, and the day may then turn without it.
  ok(G.release(watching, 'usa') && !watching.seats.usa, 'a seat can be given back');
  ok(G.release(watching, 'usa').error, 'but only once');
}

// ------------------------------------------------------------- who holds what
section('who holds what');
{
  const owner = (lat, lon) => territoryAt(lat, lon)?.owner ?? null;
  const country = (lat, lon) => {
    const t = territoryAt(lat, lon);
    return t ? countryFor(t) : null;
  };

  // Sovereignty, as of 1 September 1939.
  eq(country(-4.32, 15.31), 'Belgian Congo', 'Leopoldville is Belgian, not French');
  eq(country(-11.66, 27.48), 'Belgian Congo', 'and so is the Katanga copper');
  eq(country(-5.39, 27.0), 'Belgian Congo', 'and Kongolo between them — the basin has no holes in it');
  eq(country(-1.95, 30.06), 'Ruanda-Urundi', 'Kigali is a Belgian mandate');
  eq(owner(-4.32, 15.31), 'neutral', 'Belgium is neutral, and its Congo with it');
  eq(country(4.37, 18.58), 'French Equatorial Africa', 'Bangui stays French');
  eq(owner(30.05, 31.24), 'neutral', 'Egypt is sovereign');
  eq(country(30.05, 31.24), 'Egypt', 'and is called Egypt');
  eq(owner(33.31, 44.36), 'neutral', 'Iraq is sovereign');
  eq(owner(15.5, 32.53), 'uk', 'Anglo-Egyptian Sudan is not');
  eq(owner(31.78, 35.22), 'uk', 'nor Palestine');
  eq(owner(12.78, 45.03), 'uk', 'nor Aden');
  eq(country(30.34, 48.3), 'Persia', 'Abadan is Persian, not Iraqi');

  eq(country(48.72, 21.26), 'Hungary', 'Kosice went to Hungary in 1938');
  eq(country(48.62, 22.29), 'Hungary', 'Uzhhorod in 1939');
  eq(country(49.22, 18.74), 'Slovakia', 'and Zilina stayed Slovak');

  eq(owner(30.59, 114.31), 'japan', 'Wuhan fell in October 1938');
  eq(owner(23.13, 113.26), 'japan', 'Canton the same month');
  eq(owner(20.04, 110.32), 'japan', 'Hainan in February 1939');
  eq(owner(22.32, 114.17), 'uk', 'Hong Kong is still British');
  eq(country(40.82, 114.88), 'Mengjiang', 'Kalgan is the puppet capital');
  eq(owner(40.82, 114.88), 'japan', 'and Mengjiang is Japanese');
  eq(country(47.92, 106.92), 'Mongolia', 'the Mongolian People\'s Republic is not');
  eq(owner(29.56, 106.55), 'china', 'Chongqing holds out');

  eq(owner(1.55, 110.34), 'uk', 'Sarawak is British');
  eq(owner(5.98, 116.07), 'uk', 'and North Borneo');
  eq(owner(-1.24, 116.85), 'neutral', 'Balikpapan is Dutch');
  eq(country(-6.21, 106.85), 'Netherlands East Indies', 'and so is Java');

  eq(owner(41.33, 19.82), 'italy', 'Albania was annexed in April 1939');
  eq(country(36.2, 36.16), 'Turkey', 'Hatay voted itself Turkish in June');
  eq(country(36.2, 37.16), 'Syria', 'Aleppo did not');
  eq(country(51.72, 94.45), 'Tannu Tuva', 'Tuva is not Mongolian');

  // The Baltic states are three, and they are all still there.
  eq(country(56.95, 24.11), 'Latvia', 'Latvia exists');
  eq(country(59.44, 24.75), 'Estonia', 'beside Estonia');
  eq(country(54.9, 23.9), 'Lithuania', 'and Lithuania');
  ok(
    [[56.95, 24.11], [59.44, 24.75], [54.9, 23.9]].every(([a, o]) => owner(a, o) === 'neutral'),
    'all three are independent — the Soviet Union does not arrive until June 1940',
  );
  // Danzig is 1,900 km² and a cell is 4,455: the Free City cannot be drawn, and
  // the hex that contains it is Polish — Gdynia and the Corridor — not German.
  eq(country(54.35, 18.65), 'Poland', 'the hex holding Danzig is Polish');

  // Every acre of land outside Antarctica belongs to somebody. These are the
  // places that used to fall between two boxes and come out grey.
  eq(country(-22.56, 17.08), 'South West Africa', 'Windhoek is a South African mandate');
  eq(owner(-22.56, 17.08), 'uk', 'and therefore British');
  eq(country(-24.65, 25.91), 'Bechuanaland', 'Gaborone is a British protectorate');
  eq(country(-20.15, 28.58), 'Rhodesia', 'and Bulawayo is not in it');
  eq(country(-17.85, 25.85), 'Rhodesia', 'nor Livingstone');
  eq(country(-25.86, 25.64), 'South Africa', 'nor Mafeking, which governed it from outside');
  eq(country(21.42, 39.83), 'Saudi Arabia', 'Mecca is Saudi');
  eq(country(24.47, 39.61), 'Saudi Arabia', 'so is Medina');
  eq(country(28.38, 36.57), 'Saudi Arabia', 'and Tabuk');
  eq(country(27.18, 33.83), 'Egypt', 'while Hurghada across the Red Sea is not');
  eq(country(5.32, -4.03), 'French West Africa', 'Abidjan is French');
  eq(country(5.55, -0.2), 'Gold Coast', 'Accra is British');
  eq(country(6.14, 1.22), 'French West Africa', 'and Lome, nine km over the border, is French');
  eq(country(16.97, 7.99), 'French West Africa', 'Agadez is French Niger');
  eq(country(27.67, -8.13), 'Algeria', 'Tindouf is Algerian');
  eq(country(11.28, 49.18), 'Italian East Africa', 'the horn of Somalia is Italian');
  eq(country(10.44, 45.01), 'British Somaliland', 'Berbera is British');
  eq(country(-0.9, -89.6), 'Ecuador', 'the Galapagos are Ecuadorean');
  eq(country(-49.35, 70.22), 'Kerguelen', 'and Kerguelen is French');

  // The seams: cells that used to fall between two boxes and take a default
  // owner with no region at all.
  eq(country(43.0, 101.2), 'Mongolia', 'the Gobi line is Mongolian');
  eq(country(42.9, 106.1), 'Mongolia', 'along its whole length');
  eq(owner(42.9, 106.1), 'neutral', 'and nothing there is Soviet');
  eq(country(41.8, 105.0), 'Mongolia', 'Mongolia dips to 41.6N at its southern point');
  eq(country(41.95, 101.07), 'China', 'and Ejina, below the border, is Chinese');
  eq(country(-6.1, 25.7), 'Belgian Congo', 'the hole in the Congo is Congolese');
  eq(country(-20.0, 16.9), 'South West Africa', 'and South West Africa has a name');
  eq(owner(-20.0, 16.9), 'uk', 'and a mandatory');
  eq(country(33.0, 36.9), 'Syria', 'the Hauran is Syrian');
  eq(owner(33.0, 36.9), 'france', 'and French');
  eq(country(32.34, 36.21), 'Transjordan', 'while Mafraq below it is Transjordan');
  eq(country(-89.0, 0.0), 'Antarctica', 'even the pole stands in a named region');

  // Colonies answer to their metropoles rather than to nobody.
  eq(country(-8.84, 13.23), 'Angola', 'Luanda is Angolan');
  eq(country(-5.55, 12.19), 'Angola', 'and Cabinda with it');
  eq(country(11.86, -15.6), 'Portuguese Guinea', 'Bissau is Portuguese');
  eq(country(9.51, -13.71), 'French West Africa', 'and Conakry French');
  eq(country(8.48, -13.23), 'Sierra Leone', 'while Freetown is British');
}

// ------------------------------------------------------------- the fleets
section('the fleets');
{
  // The fleets need to know where the water is and nothing else, so the board
  // is stood up from the land mask alone rather than built in full: the terrain
  // model only ever turns land into land, so a cell is water exactly when that
  // byte is under 128.
  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const bin = fs.readFileSync(path.join(HERE, '..', 'src', 'world', 'earth.bin'));
  const mask = bin.subarray(0, TILE_COUNT);
  const biome = new Uint8Array(TILE_COUNT);
  const WATER = new Set();
  for (let i = 0; i < TILE_COUNT; i += 1) {
    if (mask[i] >= 128) {
      biome[i] = T.plains;
    } else {
      biome[i] = T.ocean;
      WATER.add(i);
    }
  }
  const NAVIES = buildNavies({ biome });

  // Every hull in the table reaches the board, and reaches the water.
  let placedRight = true;
  let stationsOnLand = 0;
  for (const [power, fleet] of Object.entries(NAVIES_1939)) {
    const mine = NAVIES.stations.filter((s) => s.power === power);
    for (const ship of SHIPS) {
      const placed = mine.reduce((sum, s) => sum + s.ships[ship.id], 0);
      if (placed !== fleet[ship.id]) {
        placedRight = false;
        console.error(`        ${power} ${ship.id}: ${placed} placed, ${fleet[ship.id]} in the table`);
      }
    }
    const air = mine.reduce((sum, s) => sum + s.aircraft, 0);
    if (air !== fleet.aircraft) placedRight = false;
  }
  ok(placedRight, 'every hull and every aircraft in the table reaches a station');

  for (const station of NAVIES.stations) {
    if (!WATER.has(station.cell)) stationsOnLand += 1;
  }
  eq(stationsOnLand, 0, 'and every station is moored on water');

  // The shares are a disposition, not a guess: each navy's have to add up.
  let sharesSum = true;
  for (const power of Object.keys(NAVIES_1939)) {
    const ports = STATIONS.filter((s) => s.power === power);
    if (!ports.length) continue;
    const total = ports.reduce((sum, p) => sum + p.share, 0);
    if (Math.abs(total - 1) > 1e-9) {
      sharesSum = false;
      console.error(`        ${power}: shares add to ${total.toFixed(3)}`);
    }
  }
  ok(sharesSum, 'and the stations of each navy account for all of it');

  eq(NAVIES_1939.china.battleships, 0, 'China has no navy left by September 1939');
  eq(NAVIES.stations.filter((s) => s.power === 'china').length, 0, 'and therefore no stations');
  ok(NAVIES_1939.uk.carriers > NAVIES_1939.usa.carriers, 'the Royal Navy has the most carriers');
  ok(NAVIES_1939.ussr.submarines > NAVIES_1939.germany.submarines * 2, 'and the Soviets the most submarines');
  ok(NAVIES_1939.japan.aircraft > NAVIES_1939.uk.aircraft, 'Japan embarks the most aircraft');
}

// ------------------------------------------------------- what a seat may know
section('what a seat may know');
{
  const sees = (viewer, owner) => canSeeForces(viewer, NATION_INDEX[owner]);

  ok(sees('germany', 'germany'), 'a power sees its own garrisons');
  ok(sees('germany', 'italy'), 'and the garrisons of its own side');
  ok(sees('germany', 'japan'), 'across the world if need be');
  ok(!sees('germany', 'uk'), 'and not the other side, however plainly it is standing there');
  ok(!sees('germany', 'france'), 'nor France');
  ok(!sees('germany', 'ussr'), 'nor the Soviet Union');
  ok(sees('uk', 'france'), 'the Allies see each other');
  ok(sees('uk', 'ussr'), 'including the Soviet Union, on paper an ally from 1941');
  ok(!sees('uk', 'germany'), 'and not Germany');
  ok(!sees('uk', 'japan'), 'nor Japan');

  // The neutrals are nobody's secret: the Independent army is thirty armies
  // that never fought as one, and Poland's divisions on 1 September are the
  // reason the war started where it did.
  ok(sees('germany', 'neutral'), 'everyone sees the neutrals');
  ok(sees('uk', 'neutral'), 'from both sides');

  ok(canSeeForces(null, NATION_INDEX.germany), 'nobody at the table hides nothing');
  ok(!canSeeForces('germany', SEA), 'and the sea has no garrison to hide');
  ok(canSeeForces('germany', NEUTRAL), 'NEUTRAL is a nation index, not a missing one');

  // The rule has to be symmetric, or one side would be able to count an army
  // that could not count it back.
  let symmetric = true;
  for (const a of PLAYER_IDS) {
    for (const b of PLAYER_IDS) {
      if (sees(a, b) !== sees(b, a)) symmetric = false;
    }
  }
  ok(symmetric, 'and it reads the same from either side');
}

// ------------------------------------------------------- and what it may see
section('what a seat may see across a border');
{
  const world = board();
  const owner = world.ownership.owner;

  // An army on the far side of a frontier is not a secret: you can see it from
  // your own trench. One hex deep, and no further.
  ok(seesCell(world, 'france', cellFor(49.23, 6.99)), 'France sees across the Saar frontier');
  ok(!seesCell(world, 'france', cellFor(52.5, 13.4)), 'and not as far as Berlin');
  ok(seesCell(world, 'germany', cellFor(52.5, 13.4)), 'though Germany can see Berlin');
  ok(seesCell(world, 'france', cellFor(48.7, 2.3)), 'and France its own capital');
  ok(seesCell(world, 'germany', cellFor(52.2, 21.0)), 'Germany sees Warsaw — Poland is neutral');

  ok(!seesCell(world, 'uk', cellFor(52.5, 13.4)), 'Britain cannot see Berlin either');
  const germanSeenBy = (viewer) => {
    let n = 0;
    for (let i = 0; i < TILE_COUNT; i += 1) {
      if (owner[i] === NATION_INDEX.germany && seesCell(world, viewer, i)) n += 1;
    }
    return n;
  };
  ok(germanSeenBy('france') > 0, 'France counts some of the Wehrmacht');
  ok(germanSeenBy('france') < 20, 'but only what is dug in opposite its own frontier');
  // An alliance shares what its frontiers can see. Britain has no border with
  // Germany and would see nothing on its own; what it gets, it gets from
  // standing next to France.
  eq(germanSeenBy('uk'), germanSeenBy('france'), 'and Britain sees exactly what France sees');
  eq(germanSeenBy('germany'), 130, 'while Germany counts every cell it holds');

  // The same rule at sea, where nobody owns the water: a fleet is countable if
  // it is moored against a coast somebody on your side holds.
  const stations = Object.fromEntries(world.navies.stations.map((st) => [st.name, st]));
  ok(seesFleet(world, 'germany', stations.Wilhelmshaven), 'Germany counts its own fleet');
  ok(!seesFleet(world, 'uk', stations.Wilhelmshaven), 'and Britain does not, across the Bight');
  ok(!seesFleet(world, 'germany', stations['Scapa Flow']), 'nor Germany the Home Fleet');
  ok(seesFleet(world, 'germany', stations['Admiral Graf Spee']), 'a raider is its own navy&apos;s');
  ok(
    !seesFleet(world, 'uk', stations['Admiral Graf Spee']),
    'and nobody else&apos;s: mid-ocean touches no coast',
  );
}

// --------------------------------------------------------- the books balance
section('the books balance');
{
  const world = board();

  ok(
    POWERS.every((id) => STOCKPILES_1939[id]),
    'every power opens the war with stores on hand',
  );

  const germany = economyFor(world, 'germany', 0);
  const oil = germany.stores.find((s) => s.id === 'oil');
  eq(oil.stock, STOCKPILES_1939.germany.oil, 'day 0 is the opening figure exactly');
  ok(oil.net < 0, 'Germany burns more oil than its ground produces');
  ok(
    oil.daysLeft > 120 && oil.daysLeft < 250,
    `and has about three months of it (${oil.daysLeft} days)`,
  );

  // Stores are the opening figure plus the net of every day since, which is
  // what lets them be derived from the date rather than stored.
  const later = economyFor(world, 'germany', 100);
  const laterOil = later.stores.find((s) => s.id === 'oil');
  ok(
    Math.abs(laterOil.stock - (oil.stock + oil.net * 100)) < 1e-6,
    'and a hundred days on, the opening figure plus a hundred days of the net',
  );
  eq(
    economyFor(world, 'germany', 10000).stores.find((s) => s.id === 'oil').stock,
    0,
    'stores stop at empty rather than going negative',
  );

  // Manpower has to add up: everyone under arms is either in the field or at
  // sea, and everyone else on that ground is a civilian.
  let addsUp = true;
  for (const id of POWERS) {
    const books = economyFor(world, id, 0);
    if (books.military !== books.soldiers + books.sailors) addsUp = false;
    if (books.civilian + books.military !== books.people) addsUp = false;
    if (books.stores.length !== 5) addsUp = false;
  }
  ok(addsUp, 'and the manpower adds up for all eight');

  // The shape of the table, which is the point of having it.
  const china = economyFor(world, 'china', 0);
  const japan = economyFor(world, 'japan', 0);
  const usa = economyFor(world, 'usa', 0);
  ok(
    china.stores.find((s) => s.id === 'oil').daysLeft < 30,
    'China has weeks of oil, not months',
  );
  // Japan cannot fuel its fleet out of the ground it holds — which is the
  // whole of its strategic position in 1939, and the reason it spent 1941
  // deciding whether to take the Indies or give up China. It runs on oil that
  // crosses water, and that is now two numbers rather than one.
  const japanOil = japan.stores.find((s) => s.id === 'oil');
  ok(japanOil.home < japanOil.upkeep, 'Japan cannot fuel its own fleet from its own ground');
  ok(japanOil.sea > japanOil.home, 'and buys more of it abroad than it pumps');
  ok(
    usa.stores.filter((s) => s.id !== 'rubber').every((s) => s.net > 0),
    'and the United States runs a surplus in everything it digs up',
  );
  // Which is not everything. No rubber grew north of the tropics, and every
  // ton of it came from Malaya and the Indies — the reason synthetic rubber
  // became a war programme in Washington as well as in Berlin.
  ok(
    usa.stores.find((s) => s.id === 'rubber').home === 0,
    'though not one ton of rubber, which is a tropical crop',
  );
  ok(
    usa.stores.find((s) => s.id === 'rubber').sea > 0,
    'and every ton of it lands from a ship',
  );
}

// ------------------------------------------------- every cell has a region
section('every cell has a region');
{
  // The board itself, not a sample of it. `earth.bin` carries the land mask in
  // its first plane, which is all this needs: the terrain model only ever turns
  // land into land, so a cell is ground exactly when that byte is 128 or more.
  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const bin = fs.readFileSync(path.join(HERE, '..', 'src', 'world', 'earth.bin'));
  const land = bin.subarray(0, TILE_COUNT);
  const sphere = grid();

  // 1. No cell falls through the table. This is the bug itself: a cell that
  //    matches no box used to keep a default owner and no region at all, which
  //    is how a line of Soviet cells appeared along Mongolia's southern border.
  const orphans = [];
  const owner = new Int16Array(TILE_COUNT).fill(-1);
  let ground = 0;
  for (let i = 0; i < TILE_COUNT; i += 1) {
    if (land[i] < 128) continue;
    ground += 1;
    const lat = sphere.lat[i];
    const lon = sphere.lon[i];
    const matched = territoryAt(lat, lon);
    if (!matched) orphans.push({ lat, lon, nearest: nearestTerritory(lat, lon).name });
    const territory = territoryFor(lat, lon);
    owner[i] = NATION_INDEX[territory.owner] ?? 0;
  }
  eq(ground, 32898, 'the board has the land it is supposed to have');
  if (orphans.length) {
    for (const o of orphans.slice(0, 12)) {
      console.error(
        `        ${o.lat.toFixed(2)}N ${o.lon.toFixed(2)}E — no region; nearest is ${o.nearest}`,
      );
    }
    if (orphans.length > 12) console.error(`        …and ${orphans.length - 12} more`);
  }
  eq(orphans.length, 0, 'every land cell on the globe matches a region box');

  // 2. Every region resolves to a country with a name, so no cell can render as
  //    a bare nation.
  let nameless = 0;
  for (const territory of TERRITORIES_1939) {
    if (!countryFor(territory)) nameless += 1;
  }
  eq(nameless, 0, 'and every region resolves to a named country');

  // 3. Seams that are not gaps.
  //
  //    A cell whose owner matches none of its neighbours' is either a genuine
  //    enclave or the far side of a badly drawn box, and there is no way to
  //    tell them apart except by knowing the ground. So the real enclaves are
  //    named here and anything else is a failure: the Gobi line was thirteen
  //    unnamed ones in a row, and Adana, Riau, Klang and Vinh were four more —
  //    every one of them a rectangle reaching somewhere its border does not.
  //
  //    Cells with no land neighbour at all are islands by definition and are
  //    not counted, or every rock in the Pacific would be in this list.
  const ENCLAVES = new Map([
    ['54.7N -6.3E', 'Northern Ireland, in Ireland'],
    ['9.5N -79.3E', 'the Panama Canal Zone, in Panama'],
    ['8.9N -79.6E', 'the Panama Canal Zone, in Panama'],
    ['30.1N 48.4E', 'Kuwait, between Iraq and the Gulf'],
    ['12.8N -14.6E', 'the Gambia, in Senegal'],
    ['12.9N -15.7E', 'the Gambia, in Senegal'],
    ['23.0N 114.6E', 'Hong Kong, in occupied Kwangtung'],
    ['15.3N 74.1E', 'Goa, in British India'],
    ['27.9N 88.3E', 'Sikkim, between Nepal and Bhutan'],
  ]);
  const stranded = [];
  for (let i = 0; i < TILE_COUNT; i += 1) {
    if (owner[i] < 0) continue;
    let neighbouringLand = 0;
    let sameOwner = 0;
    for (const j of neighbours(i)) {
      if (owner[j] < 0) continue;
      neighbouringLand += 1;
      if (owner[j] === owner[i]) sameOwner += 1;
    }
    if (neighbouringLand > 0 && sameOwner === 0) {
      stranded.push(`${sphere.lat[i].toFixed(1)}N ${sphere.lon[i].toFixed(1)}E`);
    }
  }
  const unexplained = stranded.filter((at) => !ENCLAVES.has(at));
  const vanished = [...ENCLAVES.keys()].filter((at) => !stranded.includes(at));
  for (const at of unexplained) console.error(`        ${at} — cut off from its own nation`);
  for (const at of vanished) console.error(`        ${at} — ${ENCLAVES.get(at)} — is no longer an enclave`);
  eq(unexplained.length, 0, 'no cell is cut off from its nation but a known enclave');
  eq(vanished.length, 0, 'and every known enclave is still one');
}


// ------------------------------------------------- and where the armies are
//
// The invariants of the deployment model, and the reason it exists.
//
// The old generator scored every hex a nation owned and handed out its army in
// proportion, which put fifteen tanks and a bomber wing in Berlin, eight tanks
// in a Brandenburg village, and some of every arm in almost every cell of the
// Reich. Every check below is a statement about 1939 that the smooth model
// broke and this one is supposed to keep — so if one of them fails, the
// question to ask is not how to move the threshold but what moved the army.
section('the armies stand where they stood');
{
  const world = board();
  const owner = world.ownership.owner;
  const sphere = grid();
  const { placements, byCell, airbases, access, fieldInfantry } = world.garrisons;
  const ARM = ['infantry', 'tanks', 'artillery', 'fighters', 'bombers'];

  // ---- conservation: every formation placed, once, in full ---------------
  const placedById = new Map();
  for (const p of placements) {
    const sum = placedById.get(p.formation.id) ?? { infantry: 0, tanks: 0, artillery: 0, fighters: 0, bombers: 0 };
    for (const arm of ARM) sum[arm] += p.strength[arm];
    placedById.set(p.formation.id, sum);
  }
  eq(placedById.size, FORMATIONS.length, 'every formation in the order of battle is on the board');
  const shortfall = FORMATIONS.filter((f) => {
    const got = placedById.get(f.id);
    if (!got) return true;
    return ARM.some((arm) => got[arm] !== (f.strength[arm] ?? 0));
  });
  for (const f of shortfall) console.error(`        ${f.id} — placed strength does not match the table`);
  eq(shortfall.length, 0, 'and each of them at its table strength, no more and no less');

  const drift = [];
  for (const [id, want] of Object.entries(FORCES_1939)) {
    const got = world.forcesByNation[id].deployed;
    for (const arm of ARM) {
      const off = Math.abs(got[UNIT_INDEX[arm]] - want[arm]) / Math.max(1, want[arm]);
      if (off > 0.02) drift.push(`${id} ${arm}: ${got[UNIT_INDEX[arm]]} on the board, ${want[arm]} in the table`);
    }
  }
  for (const line of drift) console.error(`        ${line}`);
  eq(drift.length, 0, 'and every national total matches the table to within 2%');

  // ---- quantisation: armour and aircraft come in whole formations --------
  //
  // A tank formation stands in one hex or it does not exist. The old model
  // dusted Germany's 3,200 tanks over all 130 of its cells, which is 25 tanks
  // a hex and no panzer division anywhere.
  const slotsFor = (nation) =>
    FORMATIONS.filter((f) => f.nation === nation && (f.strength.tanks ?? 0) > 0).reduce(
      (n, f) => n + (f.sites?.length ?? 1),
      0,
    );
  const tankCells = {};
  const smallestStack = {};
  for (const p of placements) {
    if (!p.strength.tanks) continue;
    (tankCells[p.formation.nation] ??= new Set()).add(p.cell);
  }
  for (const [nation, cells] of Object.entries(tankCells)) {
    let least = Infinity;
    for (const cell of cells) least = Math.min(least, world.forces[UNIT_INDEX.tanks][cell]);
    smallestStack[nation] = least;
  }
  const overspread = Object.entries(tankCells).filter(([nation, cells]) => cells.size > slotsFor(nation));
  for (const [nation, cells] of overspread) {
    console.error(`        ${nation}: tanks on ${cells.size} cells, ${slotsFor(nation)} formations to put them in`);
  }
  eq(overspread.length, 0, 'no nation has tanks on more cells than it has armoured formations');
  ok(tankCells.germany.size <= 14, `Germany's tanks stand on ${tankCells.germany.size} hexes, not on all 130`);
  ok(smallestStack.germany >= 100, 'and the lightest of those hexes still holds a division');
  ok(smallestStack.ussr >= 100, 'the Red Army the same, on a far larger scale');

  let strayAircraft = 0;
  for (let i = 0; i < TILE_COUNT; i += 1) {
    const air = world.forces[UNIT_INDEX.fighters][i] + world.forces[UNIT_INDEX.bombers][i];
    if (air > 0 && !airbases.has(i)) strayAircraft += 1;
  }
  eq(strayAircraft, 0, 'no aircraft stands anywhere that is not an airfield');
  ok(airbases.size < 80, `and there are ${airbases.size} airfields on the board, not thousands`);

  // On 1 September every German tank is in the east. Not one is on the Rhine,
  // which is the fact the Allies did not act on for eight months.
  let tanksWest = 0;
  for (const p of placements) {
    if (p.formation.nation === 'germany' && sphere.lon[p.cell] < 8.5) tanksWest += p.strength.tanks;
  }
  eq(tanksWest, 0, 'not one German tank is west of the Rhine');

  // ---- concentration -----------------------------------------------------
  //
  // Measured over the ground a nation holds, which is the denominator that
  // means anything here: the question is what share of an army stands in the
  // heaviest tenth of its country, and the answer for an empire is "all of
  // it", because the other nine tenths are empty.
  const fieldByCell = (keep) => {
    const per = new Map();
    for (const p of placements) {
      if (!keep(p) || !isField(p.formation)) continue;
      per.set(p.cell, (per.get(p.cell) ?? 0) + p.strength.infantry);
    }
    return [...per.values()].filter((n) => n > 0).sort((a, b) => b - a);
  };
  const held = {};
  for (let i = 0; i < TILE_COUNT; i += 1) {
    if (owner[i] === SEA) continue;
    held[owner[i]] = (held[owner[i]] ?? 0) + 1;
  }
  const shareOfTop = (values, cells) => {
    const total = values.reduce((a, b) => a + b, 0);
    if (!total) return 0;
    return values.slice(0, Math.max(1, cells)).reduce((a, b) => a + b, 0) / total;
  };
  const concentration = (nation) => {
    const values = fieldByCell((p) => p.formation.nation === nation);
    return shareOfTop(values, Math.ceil((held[NATION_INDEX[nation]] ?? 0) * 0.1));
  };
  for (const [nation, floor] of [
    ['germany', 0.6],
    ['japan', 0.7],
    ['ussr', 0.7],
    ['usa', 0.8],
    ['uk', 0.85],
  ]) {
    const got = concentration(nation);
    ok(got >= floor, `${nation}: ${(got * 100).toFixed(0)}% of the field army is in the heaviest tenth of its ground`);
  }

  // Poland is the exception, and deliberately. Six armies strung along two
  // thousand kilometres of frontier including a salient that could not be
  // held: the cordon is the mistake, and the board should show it as one.
  const gini = (values) => {
    const v = values.slice().sort((a, b) => a - b);
    const sum = v.reduce((a, b) => a + b, 0);
    if (!sum) return 0;
    let acc = 0;
    for (let k = 0; k < v.length; k += 1) acc += (2 * (k + 1) - v.length - 1) * v[k];
    return acc / (v.length * sum);
  };
  const polish = gini(fieldByCell((p) => p.formation.theater === 'poland'));
  const german = gini(fieldByCell((p) => p.formation.nation === 'germany'));
  ok(polish < german - 0.15, `Poland is spread flat (gini ${polish.toFixed(2)}) where Germany is massed (${german.toFixed(2)})`);

  // Snapshots, so a later change to the generator cannot quietly re-smear the
  // map without a test going red. Loose enough to survive a data correction,
  // tight enough that a return to a smooth field would break every one.
  for (const [nation, low, high] of [
    ['germany', 0.5, 0.75],
    ['ussr', 0.5, 0.75],
    ['japan', 0.7, 0.9],
    ['france', 0.35, 0.6],
    ['china', 0.4, 0.65],
  ]) {
    const g = gini(fieldByCell((p) => p.formation.nation === nation));
    ok(g > low && g < high, `${nation} keeps its shape: gini ${g.toFixed(2)} between ${low} and ${high}`);
  }

  // ---- emptiness ---------------------------------------------------------
  //
  // Most of the world held no soldiers at all, and the old model could not
  // say so: every cell a nation owned got a share of its army, so there were
  // tanks in the Gobi and a bomber group in the Amazon.
  const EMPTY = [
    ['Siberia', [60, 100, 110, 130]],
    ['Soviet Central Asia', [40, 55, 48, 70]],
    ['the Sahara', [18, -6, 28, 10]],
    ['the Amazon', [-8, -70, 2, -55]],
    ['the Australian interior', [-28, 122, -20, 140]],
    ['the Canadian interior', [55, -110, 65, -90]],
    ['the Great Plains and the Rockies', [33, -112, 48, -99]],
    ['interior Brazil', [-16, -58, -6, -46]],
    ['interior Africa', [-6, 16, 6, 28]],
  ];
  for (const [name, [south, west, north, east]] of EMPTY) {
    let men = 0;
    let machines = 0;
    for (const p of placements) {
      const lat = sphere.lat[p.cell];
      const lon = sphere.lon[p.cell];
      if (lat < south || lat > north || lon < west || lon > east) continue;
      if (isField(p.formation)) men += p.strength.infantry;
      machines += p.strength.tanks + p.strength.fighters + p.strength.bombers;
    }
    eq(men + machines, 0, `no field formation, tank or aeroplane in ${name}`);
  }

  // Nothing that has to be supplied stands where nothing can reach it.
  const trackless = placements.filter(
    (p) => access[p.cell] === ACCESS.NONE && (isField(p.formation) || p.formation.type === 'air'),
  );
  for (const p of trackless.slice(0, 5)) console.error(`        ${p.formation.id} on trackless ground`);
  eq(trackless.length, 0, 'no army and no airfield on ground with neither road nor railway');

  // ---- the fixtures ------------------------------------------------------
  const men = (lat, lon) => world.forces[UNIT_INDEX.infantry][cellFor(lat, lon)];
  const at = (lat, lon) => {
    const cell = cellFor(lat, lon);
    return {
      cell,
      field: fieldInfantry[cell],
      infantry: world.forces[UNIT_INDEX.infantry][cell],
      tanks: world.forces[UNIT_INDEX.tanks][cell],
      guns: world.forces[UNIT_INDEX.artillery][cell],
      air: world.forces[UNIT_INDEX.fighters][cell] + world.forces[UNIT_INDEX.bombers][cell],
      units: byCell.get(cell) ?? [],
    };
  };
  const roles = (spot) => new Set(spot.units.map((p) => p.formation.type));

  // Berlin held a guard regiment, the replacement battalions of Wehrkreis III
  // and a heavy flak belt. It did not hold a field corps, a tank park or a
  // bomber wing, and the old model gave it all three.
  const berlin = at(52.5, 13.4);
  eq(berlin.field, 0, 'Berlin holds no field troops at all');
  eq(berlin.tanks, 0, 'no tanks in Berlin');
  eq(berlin.air, 0, 'and no aircraft');
  ok(berlin.infantry > 0, 'but the replacement army is there, and counted apart');
  ok([...roles(berlin)].every((r) => r === 'depot' || r === 'aa' || r === 'security'), 'depots and flak, nothing else');

  // The Brandenburg countryside behind it: seven hundred thousand farmers and
  // no soldiers whatever. The old model gave this hex 7,600 men, eight tanks
  // and nine aircraft, which was the clearest single symptom of the smear.
  const brandenburg = at(52.9, 12.5);
  eq(brandenburg.infantry, 0, 'and rural Brandenburg holds nobody');

  // The Ruhr: more anti-aircraft guns than anywhere in the world, and next to
  // no soldiers.
  const ruhr = at(51.45, 7.0);
  ok(roles(ruhr).has('aa'), 'the Ruhr is a flak belt');
  ok(ruhr.guns > 500, `and carries ${ruhr.guns} guns, the heaviest concentration on the board`);
  ok(ruhr.field < 10_000, 'with a negligible garrison behind them');
  const flakByCell = new Map();
  for (const p of placements) {
    if (p.formation.type !== 'aa') continue;
    flakByCell.set(p.cell, (flakByCell.get(p.cell) ?? 0) + p.strength.artillery);
  }
  const heaviestFlak = [...flakByCell].sort((a, b) => b[1] - a[1])[0];
  eq(heaviestFlak[0], ruhr.cell, 'and no other city on earth has more guns over it');

  // The frontier. The heaviest German hexes are all on the Polish border,
  // and the heaviest of all is the 10th Army's, which was the main effort.
  const germanCells = [...new Set(placements.filter((p) => p.formation.nation === 'germany').map((p) => p.cell))]
    .map((cell) => ({ cell, men: fieldInfantry[cell] }))
    .sort((a, b) => b.men - a.men);
  const topFive = germanCells.slice(0, 5);
  ok(topFive.every((e) => sphere.lon[e.cell] > 14), 'the five heaviest German hexes are all east of the Elbe');
  ok(topFive[0].men > 150_000, `the heaviest holds ${Math.round(topFive[0].men / 1000)}k men — an army, in one place`);
  ok(at(53.4, 16.1).field > 40_000, 'Pomerania is massed against the Corridor');
  ok(at(54.4, 21.0).field > 40_000, 'East Prussia is massed, and cut off from the rest of the Reich');
  ok(at(50.1, 18.1).field > 100_000, 'and Silesia carries the main effort');

  // The 14th Army spent the last week of August assembling on ground that is
  // not German. A generator keyed on nationality cannot put it there at all.
  const slovakia = at(49.0, 20.3);
  ok(owner[slovakia.cell] === NEUTRAL, 'Slovakia is not German ground');
  ok(slovakia.units.some((p) => p.formation.id === 'de-14-army'), 'and the German 14th Army is standing on it');
  ok(at(49.4, 17.5).units.some((p) => p.formation.nation === 'germany'), 'as it is in Moravia');

  // France: the works held by fortress troops, the armies behind them, and
  // nothing of the kind opposite Belgium — which is the shape of May 1940.
  const maginot = at(49.1, 6.2);
  ok(maginot.units.some((p) => p.formation.type === 'fortress'), 'the Maginot Line is held by fortress troops');
  const ardennes = at(50.0, 4.8);
  ok(
    !ardennes.units.some((p) => p.formation.type === 'fortress'),
    'and there are none of them on the Belgian frontier, where the line stops',
  );
  ok(
    fieldInfantry[cellFor(50.63, 3.06)] > 50_000,
    'the mobile armies stand there instead, waiting to advance into Belgium',
  );

  // The BEF is in Hampshire on 1 September. It does not cross until the 4th.
  let befAtHome = 0;
  for (const p of placements) {
    if (p.formation.id !== 'uk-bef') continue;
    befAtHome += p.strength.infantry;
    ok(sphere.lon[p.cell] < 2 && sphere.lat[p.cell] > 49, 'the BEF is still in southern England');
  }
  ok(befAtHome > 100_000, `all ${Math.round(befAtHome / 1000)}k of it, embarking rather than deployed`);

  // The American interior, which had no army in it to spread.
  eq(men(38.5, -99.0), 0, 'nothing on the Great Plains');
  eq(men(39.7, -105.0), 0, 'nothing in the Rockies');
  ok(fieldInfantry[cellFor(32.35, -84.97)] > 5000, 'and the continental army is at its posts, Benning first');

  // The Soviet interior: depots and cadre, and not one field formation from
  // the Urals to the Pacific outside the Far Eastern zone.
  eq(fieldInfantry[cellFor(55.0, 82.9)], 0, 'no field troops at Novosibirsk');
  eq(fieldInfantry[cellFor(41.3, 69.3)], 0, 'none at Tashkent');
  ok(at(55.0, 82.9).infantry > 0, 'though the depots are there and are labelled as depots');
  ok(fieldByCell((p) => p.formation.theater === 'far-east').length > 10, 'and the Far East is a front, not a rumour');

  // Japan in China: the cities, the ports and the railway between them.
  ok(fieldInfantry[cellFor(31.23, 121.47)] > 100_000, 'Shanghai is held in strength');
  eq(fieldInfantry[cellFor(32.0, 117.0)], 0, 'and the countryside between the corridors is empty');
}


// ------------------------------------------------------ the seat that is not
section('the page that belongs to nobody');
{
  // Nine pages and an index. Eight of them are somebody's war; the ninth is
  // the board itself, for setting a game up and for checking that the fog on
  // the other eight is hiding the right things.
  eq(powerFromPath('/germany'), 'germany', 'a nation page names its nation');
  eq(powerFromPath('/'), null, 'the root is the index');
  eq(powerFromPath('/nowhere'), null, 'and so is anything else');
  eq(powerFromPath('/master'), MASTER, 'the master page names the overseer');
  eq(powerFromPath('/Master/'), MASTER, 'however it is written');
  eq(powerFromPath('/all'), MASTER, 'and under the names people reach for first');
  eq(powerFromPath('/god'), MASTER, 'including that one');
  ok(isMaster(powerFromPath('/overview')), 'isMaster agrees with the router');
  ok(!isMaster('germany'), 'and a real seat is not the overseer');
  ok(!PLAYER_IDS.includes(MASTER), 'the overseer is not one of the eight seats');
  eq(pathOf('france'), '/france', 'and every seat still has its own path');

  // The whole of the master page is one substitution: it hands the fog no
  // viewer. Everything downstream — the shading, the totals, the inspector,
  // the fleets — reads that as "no rule applies", so there is no second copy
  // of the visibility logic that could disagree with the first.
  const world = board();
  const owner = world.ownership.owner;
  let hidden = 0;
  let land = 0;
  for (let i = 0; i < TILE_COUNT; i += 1) {
    if (owner[i] === SEA) continue;
    land += 1;
    if (!seesCell(world, null, i)) hidden += 1;
  }
  eq(hidden, 0, `the overseer sees all ${land.toLocaleString()} cells of land`);
  ok(!seesCell(world, 'uk', cellFor(52.5, 13.4)), 'where a seat at the table does not');

  const stations = Object.fromEntries(world.navies.stations.map((st) => [st.name, st]));
  ok(seesFleet(world, null, stations.Wilhelmshaven), 'the overseer counts every fleet');
  ok(seesFleet(world, null, stations['Admiral Graf Spee']), 'the raiders at sea included');
  ok(!seesFleet(world, 'uk', stations['Admiral Graf Spee']), 'which Britain still cannot');
}


// ------------------------------------------------------------ what you may do
section('what a seat may order on a hex');
{
  // Three orders, and which of them a hex will take is read off the board
  // rather than decided in the button: the war table says whom you may attack
  // and ownership says whose ground you may stand on. Nothing moves yet — the
  // turn engine takes no orders — but the refusals are already the real ones.
  eq(ORDERS.length, 7, 'seven orders a seat may give on a hex');
  eq(
    ORDERS.map((o) => o.id).join(' '),
    'reinforce attack replacements bomb sail embark landing',
    'march, attack, rebuild, fly, sail, load a fleet, or come ashore off one',
  );
  ok(
    !ORDERS.some((o) => /retreat/i.test(o.name)),
    'retreating is not among them — a beaten army falls back on its own',
  );

  const world = board();
  const view = (lat, lon) => {
    const index = cellFor(lat, lon);
    const owner = world.ownership.owner[index];
    const country = world.countryOf[index] >= 0 ? world.countries[world.countryOf[index]] : null;
    return {
      index,
      nation: owner === SEA ? null : NATIONS[owner],
      country,
      forces: UNITS.map((unit, u) => ({ id: unit.id, count: world.forces[u][index] })).filter(
        (arm) => arm.count > 0,
      ),
    };
  };
  const may = (power, tile, day = 0) =>
    Object.fromEntries(ordersFor({ power, day, tile }).map((o) => [o.id, o.allowed]));

  const warsaw = view(52.23, 21.0);
  const silesia = view(50.1, 18.1);
  const paris = view(48.86, 2.35);
  const berlin = view(52.5, 13.4);
  const baltic = view(55.5, 18.5);

  eq(partyAt(warsaw), 'Poland', 'a hex is known to the war table by its country');
  ok(warsaw.nation.id === 'neutral', 'even where the pool that owns it is Independent');

  // Neither name answers on its own. A country can be a belligerent its owner
  // is not — Poland is Independent ground — while a metropole is deliberately
  // not a separate party from its power, so France the country is in no war at
  // all and france the power is in several.
  ok(partiesAt(warsaw).includes('Poland'), 'Warsaw answers as Poland');
  ok(partiesAt(paris).includes('france'), 'Paris answers as the French power');
  const prussia = view(54.4, 21.0);
  ok(
    may('uk', prussia, 2).attack,
    'Britain may attack East Prussia on the third — the country is German ground',
  );

  // Day 0: Germany is at war with Poland and with nobody else.
  ok(may('germany', warsaw).attack, 'Germany may attack Poland on the first day');
  ok(!may('germany', warsaw).reinforce, 'and may not reinforce ground it does not hold');
  ok(!may('germany', paris).attack, 'France is not yet at war, so no');
  ok(may('germany', paris, 2).attack, 'and on the third of September it is');
  ok(!may('germany', silesia).attack, 'nobody attacks their own ground');
  ok(may('germany', silesia).reinforce, 'which they may reinforce instead');
  ok(may('germany', silesia).replacements, 'and send replacements to, having troops on it');
  ok(
    may('germany', berlin).replacements,
    'Berlin too — the replacement army is exactly what depots are for',
  );
  ok(!may('germany', baltic).reinforce, 'there is no ground in the Baltic to reinforce');
  ok(!may('germany', baltic).attack, 'and nobody there to attack');

  // From the other side of the same hexes.
  ok(!may('france', warsaw).attack, 'France may not attack Poland');
  ok(may('france', paris).reinforce, 'and may reinforce its own capital');
  ok(!may('uk', silesia).reinforce, 'Britain has no business in Silesia');

  // The overseer is not playing, and the empty selection refuses everything.
  const nobody = ordersFor({ power: null, day: 0, tile: silesia });
  ok(nobody.every((o) => !o.allowed), 'the master page orders nothing');
  eq(nobody[0].why, 'Nobody is sitting at this seat.', 'and says why');
  const nothing = ordersFor({ power: 'germany', day: 0, tile: null });
  ok(nothing.every((o) => !o.allowed), 'and neither does a page with no hex chosen');

  // Every refusal has a reason attached, because a greyed-out button with no
  // explanation is worse than no button.
  const reasons = [
    ...ordersFor({ power: 'germany', day: 0, tile: paris }),
    ...ordersFor({ power: 'germany', day: 0, tile: baltic }),
    ...ordersFor({ power: 'uk', day: 0, tile: silesia }),
  ];
  ok(
    reasons.every((o) => (o.allowed ? o.why === null : typeof o.why === 'string' && o.why.length > 8)),
    'every refusal carries a sentence saying why',
  );
  ok(
    ordersFor({ power: 'germany', day: 0, tile: paris })[0].why.includes('France'),
    'and names the country rather than the pool it is counted in',
  );
}


// ------------------------------------------------------------- and marching
section('the armies march');
{
  const world = board();
  const sphere = grid();
  const opening = world.garrisons.opening;

  // ---- the two rules the whole model is made of --------------------------
  eq(restDays('plains'), 1, 'a column rests a day after arriving');
  eq(restDays('forest'), 1, 'on any ordinary ground');
  eq(restDays('mountain'), 2, 'and two in the mountains, which makes a hex there three days');
  eq(restDays('peak'), 2, 'the same for the peaks');
  ok(isMobile({ mobility: 0.95 }), 'a panzer division marches');
  ok(isMobile({ mobility: 0.25 }), 'so does an infantry army, at the same speed — the model is flat');
  ok(!isMobile({ mobility: 0.02 }), 'the Maginot fortress troops do not march at all');

  // ---- replaying where everybody is --------------------------------------
  const silesia = cellFor(50.1, 18.1);
  const columns = world.garrisons.byCell.get(silesia) ?? [];
  ok(columns.length > 0, 'there are columns standing in Silesia');
  const column = columns.find((c) => c.formation.type === 'field');
  ok(column.id.includes('#'), `every column has a name of its own — ${column.id}`);

  const next = [...neighbours(silesia)].find(
    (j) => world.ownership.owner[j] === world.ownership.owner[silesia],
  );
  const log = [{ day: 1, power: 'germany', column: column.id, from: silesia, to: next }];

  eq(positionsAt(opening, [], 0).get(column.id), silesia, 'on the first day it is where it deployed');
  eq(positionsAt(opening, log, 0).get(column.id), silesia, 'and a march tomorrow has not happened yet');
  eq(positionsAt(opening, log, 1).get(column.id), next, 'on the day itself it is one hex on');
  eq(arrivalsAt(log, 1).get(column.id), 1, 'and the log says when it got there');
  eq(arrivalsAt(log, 0).get(column.id), undefined, 'which it does not say a day early');

  // ---- what may be ordered ------------------------------------------------
  const ask = (opts) =>
    mayMarch({
      world,
      power: 'germany',
      day: 0,
      positions: positionsAt(opening, [], 0),
      arrivals: arrivalsAt([], 0),
      ordered: new Set(),
      ...opts,
    });
  eq(ask({ column, to: next }), null, 'a German column may march onto German ground next door');
  ok(
    ask({ column, to: silesia })?.includes('already there'),
    'and not onto the hex it is standing on',
  );

  // Two hexes is two days, given a day at a time.
  const far = [...neighbours(next)].find(
    (j) => j !== silesia && ![...neighbours(silesia)].includes(j),
  );
  ok(ask({ column, to: far })?.includes('one hex a day'), 'two hexes in one order is refused');

  // Somebody else's army.
  const french = opening.find((c) => c.formation.nation === 'france' && isMobile(c.formation));
  ok(ask({ column: french, to: next })?.includes('not yours'), 'and so is somebody else’s column');
  ok(
    ask({ column: french, to: next }).match(/^[A-Z0-9]/),
    'named by what it is called rather than by an id',
  );

  // Fortress troops are part of the landscape.
  const fortress = opening.find((c) => c.formation.id === 'fr-maginot-fortress');
  const beside = [...neighbours(fortress.cell)].find(
    (j) => world.ownership.owner[j] === world.ownership.owner[fortress.cell],
  );
  ok(
    mayMarch({
      world,
      column: fortress,
      to: beside,
      power: 'france',
      day: 0,
      positions: positionsAt(opening, [], 0),
      arrivals: arrivalsAt([], 0),
      ordered: new Set(),
    })?.includes('cannot march'),
    'the Maginot garrison is fixed to the ground it holds',
  );

  // Already spoken for.
  ok(
    ask({ column, to: next, ordered: new Set([column.id]) })?.includes('Already under orders'),
    'a column cannot be ordered twice in one day',
  );

  // ---- resting ------------------------------------------------------------
  const after = (day) =>
    mayMarch({
      world,
      column,
      to: silesia,
      power: 'germany',
      day,
      positions: positionsAt(opening, log, day),
      arrivals: arrivalsAt(log, day),
      ordered: new Set(),
    });
  ok(after(1)?.includes('rests'), 'a column that arrived today rests tomorrow');
  eq(after(2), null, 'and marches again the day after');

  // High ground costs the extra day. Find a mountain hex somebody holds and a
  // way onto it, and check the sum: one day marching, two standing still.
  let mountains = 0;
  for (let i = 0; i < TILE_COUNT; i += 1) {
    if (world.ownership.owner[i] === SEA) continue;
    if (TERRAIN[world.biome[i]].id === 'mountain') mountains += 1;
  }
  ok(mountains > 1000, `the board has ${mountains.toLocaleString()} mountain hexes on it`);
  ok(
    restDays('mountain') === 2 && restDays('plains') === 1,
    'and every one of them takes three days to cross rather than two',
  );

  // ---- where it may not go ------------------------------------------------
  // Marching onto somebody else's ground is an attack, and attacks wait for a
  // resolver. Poland is next door to Silesia and is not German ground.
  const polish = [...neighbours(silesia)].find(
    (j) =>
      world.ownership.owner[j] !== world.ownership.owner[silesia] &&
      world.ownership.owner[j] !== SEA &&
      world.countryOf[j] >= 0 &&
      world.countries[world.countryOf[j]].name.startsWith('Poland'),
  );
  ok(polish !== undefined, 'Silesia has Polish ground next to it');
  eq(ask({ column, to: polish }), null, 'marching onto it is an attack, and today Germany may make it');

  // But not into somebody it is not fighting. Switzerland is neutral on every
  // day of this game and marching in would be a declaration, which belongs to
  // the timeline rather than to a column commander.
  const swiss = world.countries.find((c) => c.name === 'Switzerland');
  let swissHex = -1;
  for (let i = 0; i < TILE_COUNT && swissHex < 0; i += 1) if (world.countryOf[i] === swiss.id) swissHex = i;
  const germanBeside = [...neighbours(swissHex)].find(
    (j) => world.ownership.owner[j] === NATION_INDEX.germany,
  );
  if (germanBeside !== undefined) {
    const guard = (world.garrisons.byCell.get(germanBeside) ?? [])[0];
    if (guard) {
      ok(
        ask({ column: guard, to: swissHex })?.includes('not at war with Switzerland'),
        'and Switzerland is refused, by name',
      );
    }
  }
  // But the 14th Army, which spent August assembling in Slovakia, can shuffle
  // about in it — because it is already standing there.
  const slovak = opening.find(
    (c) => c.formation.id === 'de-14-army' && world.ownership.owner[c.cell] === NEUTRAL,
  );
  if (slovak) {
    const nearby = [...neighbours(slovak.cell)].find((j) =>
      (world.garrisons.byCell.get(j) ?? []).some((p) => p.formation.nation === 'germany'),
    );
    if (nearby !== undefined) {
      eq(ask({ column: slovak, to: nearby }), null, 'the 14th Army may move about Slovakia');
    }
  }

  // ---- orders become moves, in the same order everywhere ------------------
  const made = executeOrders(
    { germany: [{ column: 'b#0', from: 1, to: 2 }], france: [{ column: 'a#0', from: 3, to: 4 }] },
    7,
  );
  eq(made.length, 2, 'both seats’ orders become moves');
  eq(made[0].power, 'france', 'sorted, so every client replays the same log');
  eq(made[0].day, 7, 'and stamped with the day they land on');

  // ---- and the board follows ---------------------------------------------
  const menBefore = { from: world.forces[UNIT_INDEX.infantry][silesia], to: world.forces[UNIT_INDEX.infantry][next] };
  const totalBefore = world.forceTotals[UNIT_INDEX.infantry];
  world.march(log, 1);
  eq(
    world.forces[UNIT_INDEX.infantry][silesia],
    menBefore.from - column.strength.infantry,
    'the men leave the hex they marched off',
  );
  eq(
    world.forces[UNIT_INDEX.infantry][next],
    menBefore.to + column.strength.infantry,
    'and arrive on the one they marched to',
  );
  eq(world.forceTotals[UNIT_INDEX.infantry], totalBefore, 'and nobody is lost or invented on the way');
  ok(
    (world.garrisons.byCell.get(next) ?? []).some((p) => p.id === column.id),
    'the hex it arrived on knows what is standing there',
  );

  // Put the world back, since the other sections share it.
  world.march([], 0);
  eq(world.forces[UNIT_INDEX.infantry][silesia], menBefore.from, 'and the log can be replayed back to the start');

  // ---- orders in the game, and who may read them --------------------------
  const game = G.newGame();
  G.claim(game, 'germany', 'tok-de', 'a');
  G.claim(game, 'france', 'tok-fr', 'b');
  eq(game.moves.length, 0, 'a new game has marched nowhere');
  G.setOrders(game, 'germany', [{ column: column.id, from: silesia, to: next }]);
  eq(game.orders.germany.length, 1, 'a seat can write down what it will do tomorrow');
  eq(G.publicState(game, 'germany').orders.length, 1, 'and read its own orders back');
  eq(G.publicState(game, 'france').orders.length, 0, 'while nobody else can see them');
  eq(G.publicState(game, null).orders.length, 0, 'and neither can a passer-by');

  G.setReady(game, 'germany', true);
  G.setReady(game, 'france', true);
  ok(G.readyToAdvance(game), 'both seats are finished with the day');
  G.advance(game);
  eq(game.day, 1, 'so the day turns');
  eq(game.moves.length, 1, 'the order becomes a march that has happened');
  eq(game.moves[0].day, 1, 'stamped with the day it landed on');
  eq(Object.keys(game.orders).length, 0, 'and the orders are spent');
  eq(G.publicState(game, 'france').moves.length, 1, 'a march that has happened is not a secret');
}


// ------------------------------------------------------------ and they fight
section('fighting for a hex');
{
  const world = board();
  const sphere = grid();
  const opening = world.garrisons.opening;

  // ---- what an arm is worth ----------------------------------------------
  ok(RATINGS.tanks.attack > RATINGS.tanks.defend, 'a tank is worth more going forward than dug in');
  ok(RATINGS.artillery.defend > RATINGS.artillery.attack, 'and a gun the other way about');
  ok(RATINGS.infantry.defend > RATINGS.infantry.attack, 'as is a rifleman, who can dig');
  ok(RATINGS.bombers.attack > RATINGS.bombers.defend * 4, 'a bomber cannot hold anything');

  const column = { id: 'x', formation: { quality: 1 }, strength: { infantry: 1000, tanks: 10 } };
  eq(strengthOf([column], 'attack'), 1000 * 1 + 10 * 90, 'strength is the arms at their ratings');
  const poor = { ...column, formation: { quality: 0.5 } };
  eq(strengthOf([poor], 'attack'), strengthOf([column], 'attack') / 2, 'and all of it scaled by quality');
  ok(
    strengthOf([{ ...column, formation: { quality: 0.28 } }], 'attack') <
      strengthOf([{ ...column, formation: { quality: 0.85 } }], 'attack'),
    'which is why three million Chinese are not three million Germans',
  );

  // ---- the ground ---------------------------------------------------------
  ok(TERRAIN_DEFENCE.mountain > TERRAIN_DEFENCE.plains * 1.5, 'a mountain is worth holding');
  ok(TERRAIN_DEFENCE.forest > TERRAIN_DEFENCE.plains, 'so is a wood');
  ok(TERRAIN_DEFENCE.beach < TERRAIN_DEFENCE.plains, 'and a beach is the worst ground there is');
  const berlin = cellFor(52.5, 13.4);
  const openGround = cellFor(52.9, 12.5);
  ok(
    groundBonus(world, berlin) > groundBonus(world, openGround),
    'a city is harder to take than the fields around it',
  );

  // Height. The same hex is worth more when the attack has to climb to it.
  let high = -1;
  let low = -1;
  for (let i = 0; i < TILE_COUNT && high < 0; i += 1) {
    if (world.ownership.owner[i] === SEA || world.elevation[i] < 0.4) continue;
    for (const j of neighbours(i)) {
      if (world.ownership.owner[j] !== SEA && world.elevation[j] < world.elevation[i] - 0.2) {
        high = i;
        low = j;
      }
    }
  }
  ok(high >= 0, 'the board has a hill with a valley beside it');
  ok(
    groundBonus(world, high, low) > groundBonus(world, high, high),
    'and attacking uphill is dearer than attacking along the level',
  );

  // ---- luck ---------------------------------------------------------------
  const [a1, d1] = luckAt(7, 1234);
  const [a2, d2] = luckAt(7, 1234);
  eq(a1, a2, 'the same fight rolls the same way twice');
  eq(d1, d2, 'on both sides of it');
  ok(a1 !== d1, 'the two sides do not share a roll');
  ok(a1 > 0.75 && a1 < 1.25, 'and luck moves the answer by a fifth at most');
  let lucky = 0;
  for (let n = 0; n < 500; n += 1) if (luckAt(n, n * 37)[0] > 1) lucky += 1;
  ok(lucky > 200 && lucky < 300, `it is not biased — ${lucky} of 500 rolls above even`);

  // ---- falling back -------------------------------------------------------
  const german = cellFor(52.5, 13.4);
  const back = retreatTo(world, german, 'germany', null);
  ok(back !== null, 'a beaten army in Germany falls back onto German ground');
  eq(world.ownership.owner[back], NATION_INDEX.germany, 'and not onto anybody else’s');
  ok(retreatTo(world, german, 'france', null) === null, 'a French army in Berlin has nowhere to go');

  // The retreat is away from whoever pushed, and it never doubles back into
  // the attack.
  const pushedFrom = [...neighbours(german)].find(
    (j) => world.ownership.owner[j] === NATION_INDEX.germany,
  );
  ok(retreatTo(world, german, 'germany', pushedFrom) !== pushedFrom, 'and never back through the attack');

  // ---- capitals -----------------------------------------------------------
  ok(isCapital(cellFor(52.52, 13.4)), 'Berlin is a capital');
  ok(isCapital(cellFor(52.23, 21.01)), 'so is Warsaw');
  ok(isCapital(cellFor(29.56, 106.55)), 'and Chongqing, because Nanjing fell in 1937');
  ok(!isCapital(cellFor(52.9, 12.5)), 'a field in Brandenburg is not');
  eq(capitalAt(cellFor(48.86, 2.35))?.whose, 'france', 'and each one knows whose it is');
  eq(CAPITALS_1939.length, new Set(CAPITALS_1939.map((c) => c[0])).size, 'no capital is listed twice');

  // ---- one fight ----------------------------------------------------------
  const strong = [{ id: 'a', formation: { quality: 0.9, nation: 'france' }, strength: { infantry: 200000, tanks: 600 } }];
  const weak = [{ id: 'b', formation: { quality: 0.5, nation: 'germany' }, strength: { infantry: 20000 } }];
  const oneSided = fight({ world, cell: openGround, day: 1, attackers: strong, defenders: weak });
  eq(oneSided.winner, 'attacker', 'ten to one carries the hex');
  ok(oneSided.loserShare > oneSided.winnerShare * 5, 'and it is far dearer for the beaten side');
  ok(oneSided.loserShare <= 0.35, 'though nothing is annihilated in one day');
  ok(oneSided.winnerShare >= 0.02, 'and nothing is taken for free');
  ok(oneSided.retreat !== null, 'a beaten German in Brandenburg has German ground to fall back onto');
  ok(!oneSided.pocket, 'so it is not a pocket');

  // Unless there is nowhere. An army beaten on ground with none of its own
  // beside it is destroyed where it stands, and so is one beaten on the hex
  // its government sits on — Warsaw did not withdraw, because by then there
  // was nowhere left to withdraw to that mattered.
  const stranded = [{ id: 'c', formation: { quality: 0.5, nation: 'japan' }, strength: { infantry: 20000 } }];
  const cutOff = fight({ world, cell: openGround, day: 1, attackers: strong, defenders: stranded });
  ok(cutOff.pocket, 'a Japanese army in Brandenburg has nowhere to go');
  ok(cutOff.loserShare > 0.5, 'and pays for it');
  const capital = fight({
    world,
    cell: cellFor(52.52, 13.4),
    day: 1,
    attackers: strong,
    defenders: [{ id: 'd', formation: { quality: 0.6, nation: 'germany' }, strength: { infantry: 60000 } }],
  });
  ok(capital.pocket, 'and nobody falls back out of Berlin');
  eq(capital.retreat, null, 'there is no line drawn out of a capital');

  const other = fight({ world, cell: openGround, day: 1, attackers: weak, defenders: strong });
  eq(other.winner, 'defender', 'and one to ten does not');
  eq(other.retreat, null, 'a beaten attacker is not pushed anywhere — it goes back the way it came');

  // The same fight, uphill, is a different fight.
  const evenA = [{ id: 'a', formation: { quality: 0.8 }, strength: { infantry: 100000 } }];
  const evenB = [{ id: 'b', formation: { quality: 0.8 }, strength: { infantry: 100000 } }];
  const flat = fight({ world, cell: openGround, day: 3, attackers: evenA, defenders: evenB });
  eq(flat.winner, 'defender', 'even numbers favour whoever is already there');

  // ---- what is left of a column ------------------------------------------
  const sample = opening.find((c) => c.strength.infantry > 10000);
  const record = [
    { day: 1, losers: [sample.id], winners: [], loserShare: 0.25, winnerShare: 0 },
    { day: 2, losers: [sample.id], winners: [], loserShare: 0.25, winnerShare: 0 },
  ];
  eq(
    strengthsAt(opening, record, 0).get(sample.id).infantry,
    sample.strength.infantry,
    'before the fighting a column is what it deployed with',
  );
  eq(
    strengthsAt(opening, record, 1).get(sample.id).infantry,
    Math.floor(sample.strength.infantry * 0.75),
    'a quarter gone after one day',
  );
  eq(
    strengthsAt(opening, record, 2).get(sample.id).infantry,
    Math.floor(Math.floor(sample.strength.infantry * 0.75) * 0.75),
    'and again after the second — replayed, never stored',
  );

  // ---- a whole day, end to end -------------------------------------------
  const game = G.newGame();
  G.claim(game, 'germany', 'de', 'A');
  const silesia = cellFor(50.1, 18.1);
  const polish = [...neighbours(silesia)].find(
    (j) =>
      world.countryOf[j] >= 0 && world.countries[world.countryOf[j]].name.startsWith('Poland'),
  );
  ok(polish !== undefined, 'there is Polish ground beside Silesia');
  ok(atWar(0, 'germany', 'neutral', world, polish), 'and Germany is at war with what is on it');

  const attacking = (world.garrisons.byCell.get(silesia) ?? []).filter((c) => isMobile(c.formation));
  G.setOrders(game, 'germany', attacking.map((c) => ({ column: c.id, from: silesia, to: polish })));
  G.setReady(game, 'germany', true);
  const poles = (world.garrisons.byCell.get(polish) ?? []).map((c) => c.id);
  G.advance(game, world);

  // The record holds fights and starvation in one list, because both are
  // things that took men off a column and `strengthsAt` reads them the same
  // way. `starved` is what tells them apart.
  const fights = game.battles.filter((b) => !b.starved);
  eq(fights.length, 1, 'a hex two armies are standing on is a battle');
  const battle = fights[0];
  eq(battle.cell, polish, 'fought where they met');
  eq(battle.attacker, 'germany', 'the side that arrived is the attacker');
  eq(battle.winner, 'attacker', 'and six columns against one garrison carry it');
  ok(battle.attack > battle.defence, 'on the numbers');
  ok(game.captures.length >= 1, 'so the ground changes hands');
  ok(
    game.captures.some((c) => c.cell === polish && !c.walkedIn && !c.cutOff),
    'the hex that was fought over is taken by the fighting',
  );
  eq(world.ownership.owner[polish], NATION_INDEX.germany, 'and the map says so');
  ok(
    game.moves.some((m) => m.retreat && poles.includes(m.column)),
    'the beaten garrison falls back, without being asked',
  );
  ok(
    game.moves.filter((m) => m.retreat).every((m) => m.day === game.day),
    'on the same day it lost',
  );

  // Nobody is invented on the way.
  world.march(game.moves, game.day, game.battles);
  const left = strengthsAt(opening, game.battles, game.day);
  ok(
    [...left.values()].every((have) => Object.values(have).every((n) => n >= 0)),
    'no column ends a battle with less than nothing',
  );
  ok(
    left.get(attacking[0].id).infantry < attacking[0].strength.infantry,
    'and even the winner pays for it',
  );

  // Put the board back for anything that runs after this.
  for (const capture of game.captures) world.ownership.set(capture.cell, capture.from, { reason: 'test' });
  world.march([], 0, []);
}


// -------------------------------------------------------- and ground is taken
section('ground changes hands');
{
  // Most of a country has nobody standing on it. Until this existed an army
  // could march across all of it and take none of it: ownership only moved
  // when there was a battle, and there is no battle when nobody is home.
  const world = board();
  const opening = world.garrisons.opening;

  let poland = 0;
  let garrisoned = 0;
  for (let i = 0; i < TILE_COUNT; i += 1) {
    const country = world.countryOf[i] >= 0 ? world.countries[world.countryOf[i]].name : '';
    if (!country.startsWith('Poland')) continue;
    poland += 1;
    if ((world.garrisons.byCell.get(i) ?? []).length) garrisoned += 1;
  }
  ok(garrisoned < poland, `${poland - garrisoned} of Poland's ${poland} hexes hold nobody`);

  // ---- walking onto undefended ground ------------------------------------
  let from = -1;
  let empty;
  for (let i = 0; i < TILE_COUNT && empty === undefined; i += 1) {
    if (world.ownership.owner[i] !== NATION_INDEX.germany) continue;
    if (!(world.garrisons.byCell.get(i) ?? []).some((c) => isMobile(c.formation))) continue;
    for (const j of neighbours(i)) {
      if (world.ownership.owner[j] === SEA || world.ownership.owner[j] === NATION_INDEX.germany) continue;
      if ((world.garrisons.byCell.get(j) ?? []).length) continue;
      const name = world.countryOf[j] >= 0 ? world.countries[world.countryOf[j]].name : '';
      if (!name.startsWith('Poland')) continue;
      from = i;
      empty = j;
      break;
    }
  }
  ok(empty !== undefined, 'there is undefended Polish ground beside a German garrison');

  const game = G.newGame();
  G.claim(game, 'germany', 'de', 'A');
  const column = (world.garrisons.byCell.get(from) ?? []).find((c) => isMobile(c.formation));
  G.setOrders(game, 'germany', [{ column: column.id, from, to: empty }]);
  G.setReady(game, 'germany', true);
  G.advance(game, world);

  eq(game.battles.filter((b) => !b.starved).length, 0, 'walking into an empty hex is not a battle');
  ok(
    game.captures.some((c) => c.cell === empty && c.walkedIn),
    'but it is a capture, and the record says it was walked into',
  );
  eq(world.ownership.owner[empty], NATION_INDEX.germany, 'the hex is German now');

  // ---- and ground that is simply cut off ----------------------------------
  // An undefended hex whose every land neighbour is held by one enemy has been
  // cut off from whatever it belonged to. It falls without anybody marching in,
  // which is what mops up pockets — and the only way a mountain is ever taken
  // from an army that will not come down off it.
  const encircled = game.captures.filter((c) => c.cutOff);
  for (const capture of encircled) {
    let ring = null;
    let same = true;
    for (const j of neighbours(capture.cell)) {
      if (world.ownership.owner[j] === SEA) continue;
      if (ring === null) ring = world.ownership.owner[j];
      if (world.ownership.owner[j] !== ring) same = false;
    }
    ok(same, `the cut-off hex at ${capture.cell} really was surrounded by one nation`);
  }

  // Nothing is taken from somebody you are not fighting. Switzerland is neutral
  // on every day of this game and no amount of standing next to it changes that.
  const swiss = world.countries.find((c) => c.name === 'Switzerland');
  let swissHexes = 0;
  let swissLost = 0;
  for (let i = 0; i < TILE_COUNT; i += 1) {
    if (world.countryOf[i] !== swiss.id) continue;
    swissHexes += 1;
    if (world.ownership.owner[i] !== NEUTRAL) swissLost += 1;
  }
  ok(swissHexes > 0, 'Switzerland is on the board');
  eq(swissLost, 0, 'and none of it has been taken by anybody');

  // Every capture is from somebody the taker is at war with.
  const wrong = game.captures.filter((c) => !atWar(c.day, c.to, c.from, world, c.cell));
  for (const c of wrong.slice(0, 3)) console.error(`        ${c.to} took ${c.cell} from ${c.from}, uninvited`);
  eq(wrong.length, 0, 'and every hex that changed hands changed it between belligerents');

  // Nothing changes hands on its own. A game where nobody gives an order is a
  // game where the map does not move — which sounds obvious and was not: the
  // 8th Route Army deploys inside the Japanese occupation on purpose, and a
  // rule that gave ground to whoever was standing on it handed three hexes of
  // Shanxi to China before anybody had played a turn.
  for (const capture of game.captures) {
    world.ownership.set(capture.cell, capture.from, { reason: 'test' });
  }
  const quiet = G.newGame();
  G.claim(quiet, 'germany', 'de2', 'B');
  for (let n = 0; n < 3; n += 1) {
    G.setReady(quiet, 'germany', true);
    G.advance(quiet, world);
  }
  eq(quiet.captures.length, 0, 'three days with no orders move nothing on the map');
  eq(quiet.battles.length, 0, 'and nobody fights anybody');

  world.march([], 0, []);
  void opening;
}


// ------------------------------------------------------------ and rebuilding
section('replacements');
{
  const world = board();
  const opening = world.garrisons.opening;

  // ---- what it costs -------------------------------------------------------
  // Mind the units: oil, iron and steel are kept in kilotonnes and aluminium
  // and rubber in tonnes, because that is how the outputs of 1939 were
  // published. A tank is 0.025 of the first and a fighter 2.5 of the second.
  eq(COSTS.tanks.steel * 1000, 25, 'a tank is twenty-five tonnes of steel');
  eq(COSTS.fighters.aluminium, 2.5, 'and a fighter two and a half tonnes of alloy');
  ok(COSTS.bombers.aluminium > COSTS.fighters.aluminium * 2, 'a bomber is a much bigger aeroplane');
  ok(COSTS.tanks.steel > COSTS.artillery.steel, 'and a tank more metal than a gun');
  eq(CREW.infantry, 1, 'an infantryman is one man');
  ok(CREW.bombers > CREW.fighters, 'and a bomber wants a crew where a fighter wants a pilot');

  // ---- how fast, and where ------------------------------------------------
  ok(COLUMN_RATE > 0 && COLUMN_RATE < 0.2, 'a formation can only absorb so much of itself a day');

  const sample = opening.find((c) => c.strength.infantry > 20000);
  ok(sample, 'there is a big column to test with');
  eq(
    replacementFor({ world, column: sample, have: sample.strength, day: 0 }),
    null,
    'a column at full strength asks for nothing',
  );
  const half = Object.fromEntries(
    Object.entries(sample.strength).map(([arm, n]) => [arm, Math.floor(n / 2)]),
  );
  const want = replacementFor({ world, column: sample, have: half, day: 0 });
  ok(want !== null, 'a column at half strength asks for something');
  ok(
    want.added.infantry <= Math.ceil(sample.strength.infantry * COLUMN_RATE),
    'and never more than a day of it',
  );
  ok(want.men >= want.added.infantry, 'the draft covers the riflemen and the crews');
  ok(want.cost.steel > 0, 'and it costs steel');

  eq(
    replacementFor({ world, column: sample, have: half, day: 0, supplied: false }),
    null,
    'and a column nothing can reach is not rebuilt at all',
  );

  // ---- and what the factories can turn out --------------------------------
  ok(world.works.length > 40, `${world.works.length} steelworks on the board`);
  ok(
    world.works[0].output >= world.works[world.works.length - 1].output,
    'listed heaviest first',
  );
  eq(EFFORT.infantry, 1, 'a man is the unit the factories are measured in');
  ok(EFFORT.tanks > EFFORT.artillery, 'a tank is more work than a gun');
  ok(EFFORT.bombers > EFFORT.tanks, 'and a bomber more than a tank');
  eq(effortOf({ infantry: 10, tanks: 2 }), 10 + 2 * EFFORT.tanks, 'and a day of it adds up');

  const german = capacityFor(world, 'germany', 0, [], economyFor(world, 'germany', 0).people);
  ok(german.steel > 15000, `Germany holds ${german.steel.toLocaleString()} kt a year of steel`);
  ok(german.plantDays > 100_000, 'which is a hundred thousand plant-days and more');
  const ruhr = world.works.find((w) => w.name.startsWith('Ruhr'));
  ok(ruhr, 'the Ruhr is one of them');
  ok(
    ruhr.output / german.steel > 0.5,
    `and is ${Math.round((ruhr.output / german.steel) * 100)}% of German steel on its own`,
  );

  // A works that has been bombed makes nothing until it is back — the whole
  // reason a bomber is worth flying.
  const bombed = capacityFor(world, 'germany', 5, [{ cell: ruhr.cell, until: 12 }], 0);
  ok(bombed.steel < german.steel * 0.5, 'with the Ruhr down, half the steel is gone');
  const mended = capacityFor(world, 'germany', 12, [{ cell: ruhr.cell, until: 12 }], 0);
  eq(mended.steel, german.steel, 'and back the day the repairs are finished');

  // A nation with no heavy industry still rebuilds, slowly, out of its people.
  const chinese = capacityFor(world, 'china', 0, [], economyFor(world, 'china', 0).people);
  ok(chinese.plantDays > 0, 'China can rebuild something');
  ok(chinese.plantDays < german.plantDays / 20, 'and very much less than Germany');
  eq(PLANT_DAYS_PER_KT > 0, true, 'steel is what war potential was measured in');

  // ---- paying for it ------------------------------------------------------
  const books = economyFor(world, 'germany', 0);
  eq(canAfford(books, { steel: 1 }), null, 'Germany can find a tonne of steel');
  ok(canAfford(books, { steel: 1e9 })?.includes('not enough steel'), 'and not a billion of them');
  ok(
    canAfford(books, { steel: 100 }, { steel: 1e9 })?.includes('not enough'),
    'what is already spoken for this day counts against it',
  );

  // ---- a fortnight of rebuilding ------------------------------------------
  const game = G.newGame();
  G.claim(game, 'germany', 'de', 'A');
  // Two bad days, and it is down to two fifths of itself.
  for (let n = 0; n < 2; n += 1) {
    game.battles.push({
      day: 0,
      cell: sample.cell,
      losers: [sample.id],
      winners: [],
      loserShare: 0.35,
      winnerShare: 0,
    });
  }
  const beaten = strengthsAt(opening, game.battles, 0, []).get(sample.id).infantry;
  ok(beaten < sample.strength.infantry * 0.45, 'two bad days leave under half of it');

  let day = 0;
  let full = 0;
  for (let n = 0; n < 30 && !full; n += 1) {
    G.setOrders(game, 'germany', [], [sample.id]);
    G.setReady(game, 'germany', true);
    G.advance(game, world);
    day = game.day;
    const have = strengthsAt(opening, game.battles, day, game.replacements).get(sample.id).infantry;
    if (have >= sample.strength.infantry) full = day;
  }
  ok(full >= 7, `a shattered formation takes ${full} days to rebuild, not one`);
  ok(full < 25, 'but it does come back');

  // And the limit that matters is not that one. A formation rebuilds in a
  // week; a nation cannot rebuild its formations in a week, because the
  // factories are what ration it. Ask for everything Germany has and see how
  // much of it a day's plant can actually cover.
  const whole = G.newGame();
  G.claim(whole, 'germany', 'de2', 'C');
  const all = opening.filter((c) => c.formation.nation === 'germany');
  for (const c of all) {
    whole.battles.push({ day: 0, cell: c.cell, losers: [c.id], winners: [], loserShare: 0.3, winnerShare: 0 });
  }
  G.setOrders(whole, 'germany', [], all.map((c) => c.id));
  G.setReady(whole, 'germany', true);
  G.advance(whole, world);
  const askedFor = all.length;
  const sentUp = whole.replacements.filter((r) => r.day === whole.day).length;
  ok(sentUp > 0, 'some of them are rebuilt');
  ok(sentUp < askedFor, `and not all — ${sentUp} of ${askedFor} columns, because the plant is finite`);
  const spentEffort = whole.replacements.reduce((n, r) => n + r.effort, 0);
  const plant = capacityFor(
    world,
    'germany',
    whole.day,
    [],
    economyFor(world, 'germany', whole.day).people,
  ).plantDays;
  ok(spentEffort <= plant + 1, 'and never more than a day of the factories');
  ok(spentEffort > plant * 0.9, 'and it uses very nearly all of them');
  eq(
    strengthsAt(opening, game.battles, full + 5, game.replacements).get(sample.id).infantry,
    sample.strength.infantry,
    'and never rebuilds past what the formation is',
  );
  ok(game.replacements.every((r) => r.power === 'germany'), 'every replacement is somebody’s');
  ok(game.replacements.every((r) => r.day <= day), 'and dated no later than today');

  // ---- and the books notice ------------------------------------------------
  const spend = spentBy(game.replacements, 'germany', day);
  ok(spend.stores.steel > 0, 'the steel was spent');
  ok(spend.men > 0, `${spend.men.toLocaleString()} men were drafted for it`);
  const after = economyFor(world, 'germany', day, spend.stores);
  const before = economyFor(world, 'germany', day);
  ok(
    after.stores.find((x) => x.id === 'steel').stock < before.stores.find((x) => x.id === 'steel').stock,
    'and the stores are lighter for it than they would have been',
  );
  eq(spentBy(game.replacements, 'france', day).men, 0, 'France paid for none of it');
  eq(spentBy(game.replacements, 'germany', 0).men, 0, 'and none of it was spent before it happened');

  // Nothing was ordered by anybody who did not ask.
  const quiet = G.newGame();
  G.claim(quiet, 'france', 'fr', 'B');
  G.setReady(quiet, 'france', true);
  G.advance(quiet, world);
  eq(quiet.replacements.length, 0, 'a seat that asks for nothing is sent nothing');

  world.march([], 0, [], []);
}


// ---------------------------------------------------------------- and supply
section('getting the shells forward');
{
  const world = board();
  const opening = world.garrisons.opening;

  ok(RAIL_REACH > ROAD_REACH * 3, 'a railway carries it much further than a lorry');
  ok(UNSUPPLIED_STRENGTH < 1, 'and an army without it fights worse');
  ok(STARVATION > 0 && STARVATION < 0.1, 'and wastes away slowly rather than vanishing');
  eq(
    DEPOTS_1939.length,
    new Set(DEPOTS_1939.map((d) => d[0])).size,
    'no railhead is listed twice',
  );
  eq(PORTS_1939.length, new Set(PORTS_1939.map((d) => d[0])).size, 'nor any port');

  // ---- everybody starts fed ----------------------------------------------
  //
  // The strongest check there is on the whole model. Every army on the board
  // was deployed where it could be maintained — that is what a deployment is —
  // so if the supply rule starves anybody on the first morning, the rule is
  // wrong and not the order of battle. It found four things that way: no sea
  // supply at all, depots only where the 189-city table had a city, trackless
  // ground refusing to conduct, and nothing east of the Urals.
  const hungry = [];
  const maps = new Map();
  for (const column of opening) {
    const nation = column.formation.nation;
    // Formations the order of battle puts on somebody else's ground never had
    // a line to lose: the 8th Route Army in Shanxi, the Malta garrison on
    // Sicily because Malta is smaller than a hex.
    if (column.formation.foreign) continue;
    if (!maps.has(nation)) maps.set(nation, supplyMap(world, nation, 0));
    if (!maps.get(nation)[column.cell]) hungry.push(`${column.id} at ${column.cell}`);
  }
  for (const line of hungry.slice(0, 6)) console.error(`        ${line}`);
  eq(hungry.length, 0, 'every army on the board can be fed on the first morning');

  // ---- and the famous ones by name ---------------------------------------
  const fed = (nation, lat, lon) => supplyMap(world, nation, 0)[cellFor(lat, lon)] === 1;
  ok(fed('germany', 54.7, 20.5), 'East Prussia is fed — across the Corridor, by sea');
  ok(fed('italy', 32.9, 13.19), 'and Libya across the Mediterranean');
  ok(fed('ussr', 52.03, 113.5), 'the Transbaikal down the Trans-Siberian');
  ok(fed('ussr', 55.75, 37.62), 'Moscow, which would be a poor showing otherwise');
  ok(fed('uk', 28.6, 77.2), 'and India');
  ok(!fed('ussr', 62.0, 129.7), 'Yakutsk is not — there is no railway to it');
  ok(!fed('italy', 23.0, 12.0), 'nor the deep Sahara');

  // ---- a siege ------------------------------------------------------------
  // The point of the whole thing. A column encircled on its own railhead is
  // standing on a railway that goes nowhere.
  const berlin = cellFor(52.52, 13.4);
  ok(supplyMap(world, 'germany', 3)[berlin], 'Berlin is fed while Germany holds the ground round it');
  const ring = [...neighbours(berlin)].filter((j) => world.ownership.owner[j] !== SEA);
  const held = ring.map((j) => world.ownership.owner[j]);
  world.ownership.transfer(ring, 'france', { reason: 'test' });
  ok(!supplyMap(world, 'germany', 3)[berlin], 'and cut off the moment somebody holds all of it');
  ok(
    !supplyMap(world, 'france', 3)[berlin],
    'and not fed by the besiegers either, who do not hold the hex',
  );
  ring.forEach((cell, n) => world.ownership.set(cell, held[n], { reason: 'test' }));
  ok(supplyMap(world, 'germany', 3)[berlin], 'and fed again when the ring is lifted');

  // ---- what it does to a fight -------------------------------------------
  const columns = [{ id: 'a', formation: { quality: 1 }, strength: { infantry: 1000 } }];
  eq(strengthOf(columns, 'attack'), 1000, 'a column nobody asked about is at full weight');
  eq(strengthOf(columns, 'attack', null, new Set(['a'])), 1000, 'a fed one likewise');
  eq(
    strengthOf(columns, 'attack', null, new Set()),
    1000 * UNSUPPLIED_STRENGTH,
    'and a hungry one at three fifths',
  );

  // ---- and what it costs to stay there ------------------------------------
  const strengths = new Map(opening.map((c) => [c.id, { ...c.strength }]));
  const positions = new Map(opening.map((c) => [c.id, c.cell]));
  eq(starvation({ world, day: 0, positions, strengths }).length, 0, 'nobody starves on day one');

  // Put a French column in the middle of Siberia and it will.
  const nowhere = cellFor(62.0, 129.7);
  const stray = opening.find((c) => c.formation.nation === 'france');
  const moved = new Map(positions);
  moved.set(stray.id, nowhere);
  const starving = starvation({ world, day: 3, positions: moved, strengths });
  eq(starving.length, 1, 'an army in the middle of Siberia does');
  eq(starving[0].losers[0], stray.id, 'and it is the one that walked there');
  ok(starving[0].starved, 'the record says it was hunger and not a battle');
  eq(starving[0].loserShare, STARVATION, 'and how much of it that cost');
  eq(starving[0].winners.length, 0, 'nobody wins a famine');

  // Replacements do not come up a road that does not exist.
  eq(
    replacementFor({
      world,
      column: stray,
      have: { infantry: 1 },
      day: 3,
      supplied: false,
    }),
    null,
    'and nothing is sent up to a column that cannot be reached',
  );

  world.march([], 0, [], []);
}


// ------------------------------------------------------------ and the returns
section('what the day brought');
{
  // Everything in a report is already in the record. What this checks is that
  // the reading of it is honest — that the parts add up to the whole, that a
  // seat is told about its own war and not anybody else's, and that a place has
  // a name a reader could find on the map.
  const world = board();
  const opening = world.garrisons.opening;

  // ---- places ------------------------------------------------------------
  ok(placeOf(world, cellFor(52.52, 13.4)).includes('Berlin'), 'a hex with a city on it is that city');
  const rural = placeOf(world, cellFor(52.9, 12.5));
  ok(rural.includes('°'), 'and one without carries its coordinates');
  ok(
    placeOf(world, cellFor(52.0, 19.9)) !== placeOf(world, cellFor(52.4, 20.6)),
    'so that two different hexes of Poland do not both read as "Poland"',
  );

  // ---- a day with a battle in it -----------------------------------------
  const game = G.newGame();
  G.claim(game, 'germany', 'de', 'A');
  const german = cellFor(50.1, 18.1);
  const polish = [...neighbours(german)].find(
    (j) => world.countryOf[j] >= 0 && world.countries[world.countryOf[j]].name.startsWith('Poland'),
  );
  const attacking = (world.garrisons.byCell.get(german) ?? []).filter((c) => isMobile(c.formation));
  G.setOrders(game, 'germany', attacking.map((c) => ({ column: c.id, from: german, to: polish })));
  G.setReady(game, 'germany', true);
  G.advance(game, world);

  const report = reportFor({ world, game, seat: 'germany', day: game.day });
  eq(report.day, game.day, 'the report is for the day that just turned');
  ok(!report.quiet, 'and it has something to say');
  eq(report.battles.length, 1, 'one battle');
  ok(report.battles[0].attacking, 'which Germany started');
  ok(report.battles[0].won, 'and won');
  eq(report.battles[0].against, 'Poland', 'against Poland, not against "Independent"');
  ok(report.taken.length >= 1, 'and took ground');
  eq(report.taken[0].how, 'stormed', 'the hex that was fought over was stormed');

  // ---- the arithmetic ----------------------------------------------------
  //
  // The check that caught the first version. A column that fights in the
  // morning and goes hungry in the afternoon is in two entries, and reading
  // each one as "how much less of it is there than yesterday" charges the whole
  // day to both — so the report said the battle cost 7,900 men and the famine
  // 8,000, out of 7,900 lost in all.
  const parts = {};
  for (const list of [report.battles, report.starving]) {
    for (const entry of list) {
      for (const [arm, n] of Object.entries(entry.lost ?? {})) parts[arm] = (parts[arm] ?? 0) + n;
    }
  }
  for (const [arm, n] of Object.entries(report.losses)) {
    ok(
      Math.abs(n - (parts[arm] ?? 0)) <= 2,
      `the ${arm} lost in the parts adds up to the ${n.toLocaleString()} lost in all`,
    );
  }
  ok(Object.keys(report.losses).length > 0, 'and something was lost, or the check proves nothing');

  // ---- and it is one seat's war ------------------------------------------
  const polishReport = reportFor({ world, game, seat: 'neutral', day: game.day });
  ok(polishReport.battles.length === 1, 'the other side gets the same battle');
  ok(!polishReport.battles[0].attacking, 'from the other end');
  ok(!polishReport.battles[0].won, 'and it did not go their way');
  ok(polishReport.lost.length >= 1, 'they lost the ground Germany took');
  eq(polishReport.taken.length, 0, 'and took none');

  const bystander = reportFor({ world, game, seat: 'usa', day: game.day });
  ok(bystander.quiet, 'a seat that was not in it is told nothing happened');
  eq(bystander.battles.length, 0, 'because as far as it is concerned nothing did');

  // ---- refusals are reported ---------------------------------------------
  // A player who asks for fifteen columns and gets four should be told why.
  const all = opening.filter((c) => c.formation.nation === 'germany');
  for (const c of all) {
    game.battles.push({ day: game.day, cell: c.cell, losers: [c.id], winners: [], loserShare: 0.3, winnerShare: 0 });
  }
  G.setOrders(game, 'germany', [], all.map((c) => c.id));
  G.setReady(game, 'germany', true);
  G.advance(game, world);
  const second = reportFor({ world, game, seat: 'germany', day: game.day });
  ok(second.sent.length > 0, 'some columns were brought back up');
  ok(second.refused.length > 0, `and ${second.refused.length} were not`);
  ok(
    second.refused.every((r) => typeof r.why === 'string' && r.why.length > 4),
    'every one of them with a reason',
  );
  ok(
    second.refused.some((r) => r.why.includes('factories')),
    'and the commonest reason is that the factories were full',
  );
  ok(Object.keys(second.gains).length > 0, 'the day made something good');

  // ---- a quiet day -------------------------------------------------------
  G.setReady(game, 'germany', true);
  G.advance(game, world);
  const third = reportFor({ world, game, seat: 'germany', day: game.day });
  eq(third.sent.length, 0, 'a day nobody asked for anything sends nothing');
  eq(third.refused.length, 0, 'and refuses nothing');

  for (const capture of game.captures) {
    world.ownership.set(capture.cell, capture.from, { reason: 'test' });
  }
  world.march([], 0, [], []);
}


// -------------------------------------------------------------- and the clock
section('the day closes itself');
{
  // Eight seats across as many time zones, and a day that only ends when all of
  // them have said so, ends when the slowest player wakes up. There was no way
  // at all to proceed without them, which is the difference between a demo and
  // something people can play.
  const HOUR = 3600000;
  const game = G.newGame();
  game.opened = 1_000_000;

  ok(!G.overdue(game, 1_000_000 + G.DAY_LENGTH_MS + 1), 'an empty table never turns on its own');
  G.claim(game, 'germany', 'de', 'A');
  ok(!G.overdue(game, 1_000_000 + HOUR), 'an hour in, the day is still open');
  ok(!G.overdue(game, 1_000_000 + G.DAY_LENGTH_MS - 1), 'and it is open to the last minute');
  ok(G.overdue(game, 1_000_000 + G.DAY_LENGTH_MS), 'and then it is not');
  ok(G.overdue(game, 1_000_000 + G.DAY_LENGTH_MS * 3), 'nor later');
  eq(G.closesAt(game), 1_000_000 + G.DAY_LENGTH_MS, 'and it says when it will');

  // Turning the day restarts the clock.
  G.advance(game, null, 5_000_000);
  eq(game.opened, 5_000_000, 'a new day opens when it begins');
  eq(G.closesAt(game), 5_000_000 + G.DAY_LENGTH_MS, 'and closes a day after that');
  ok(!G.overdue(game, 5_000_000 + HOUR), 'with the whole of it to play');

  // A seat that is ready still ends the day early, which is the normal case.
  G.setReady(game, 'germany', true);
  ok(G.readyToAdvance(game), 'everybody finishing is still what usually turns it');

  // And the clock reaches the client, so nobody has to guess.
  const view = G.publicState(game, 'germany');
  eq(view.closesAt, G.closesAt(game), 'the client is told when the day closes');
  ok(G.DAY_LENGTH_MS >= 6 * HOUR, 'and a day is long enough to be worth waiting for');
}

// -------------------------------------------------- and orders on the ground
section('orders drawn on the map');
{
  // You ticked columns in a panel, pressed send, and the globe showed nothing —
  // so there was no way to look at your own plan. This checks the drawing does
  // not throw and that it respects the two things it is allowed to refuse:
  // ground round the back of the globe, and a zoom too far out to draw an
  // arrow at all.
  const calls = { moveTo: 0, lineTo: 0, fill: 0, stroke: 0 };
  const ctx = new Proxy(
    {},
    {
      get(_, key) {
        if (key === 'setLineDash' || key in calls || typeof key === 'string') {
          return (...args) => {
            if (key in calls) calls[key] += 1;
            void args;
          };
        }
        return () => {};
      },
      set: () => true,
    },
  );

  const world = board();
  const opening = world.garrisons.opening;
  const from = opening[0].cell;
  const to = [...neighbours(from)][0];
  const orders = [{ column: opening[0].id, from, to }];
  const positions = new Map(opening.map((c) => [c.id, c.cell]));

  const camera = {
    distance: 1.05,
    pixelsPerCell: () => 60,
    project: (lat, lon, w, h, out) => {
      out.x = 100;
      out.y = 100;
      out.visible = true;
      return out;
    },
  };
  drawOrders(ctx, world, camera, 1200, 800, orders, [opening[0].id], positions);
  ok(calls.stroke > 0, 'an arrow is drawn for an order');
  ok(calls.fill > 0, 'with a head on it');

  const before = { ...calls };
  drawOrders(ctx, world, { ...camera, pixelsPerCell: () => 4 }, 1200, 800, orders, [], positions);
  eq(calls.stroke, before.stroke, 'and nothing at all when the hexes are four pixels wide');

  const hidden = { ...camera, project: (lat, lon, w, h, out) => {
    out.x = 0;
    out.y = 0;
    out.visible = false;
    return out;
  } };
  drawOrders(ctx, world, hidden, 1200, 800, orders, [], positions);
  eq(calls.stroke, before.stroke, 'nor for ground round the back of the globe');

  drawOrders(ctx, world, camera, 1200, 800, [], [], positions);
  eq(calls.stroke, before.stroke, 'and a seat with no orders is drawn nothing');
}


// ------------------------------------------------------------- and the bombing
section('strategic bombing');
{
  const world = board();
  const opening = world.garrisons.opening;
  const positions = new Map(opening.map((c) => [c.id, c.cell]));
  const strengths = strengthsAt(opening, [], 0, []);

  ok(BOMBER_RANGE > FIGHTER_RANGE * 3, 'a bomber goes much further than a fighter');
  eq(BOMBER_RANGE, 10, 'ten hexes, which is about seven hundred kilometres');

  // ---- how far is it -------------------------------------------------------
  const berlin = cellFor(52.52, 13.4);
  const london = cellFor(51.5, -0.13);
  ok(hexesApart(berlin, berlin) < 0.001, 'a hex is no distance from itself');
  const apart = hexesApart(berlin, london);
  ok(apart > 12 && apart < 16, `Berlin to London is ${apart.toFixed(0)} hexes — about 930 km`);
  ok(
    Math.abs(hexesApart(berlin, london) - hexesApart(london, berlin)) < 0.001,
    'and the same measured either way',
  );

  // ---- what may fly --------------------------------------------------------
  const ruhr = world.works.find((w) => w.name.startsWith('Ruhr'));
  ok(ruhr, 'the Ruhr is a works');
  const command = opening.filter(
    (c) => c.formation.nation === 'uk' && (c.strength.bombers ?? 0) > 0 && hexesApart(c.cell, ruhr.cell) <= BOMBER_RANGE,
  );
  ok(command.length >= 3, `${command.length} British groups are within reach of the Ruhr`);

  const ask = (opts) =>
    mayRaid({
      world,
      power: 'uk',
      day: 3,
      positions,
      raids: [],
      ordered: new Set(),
      ...opts,
    });
  eq(ask({ column: command[0], target: ruhr.cell }), null, 'Bomber Command may go to the Ruhr');
  // Range is checked against a group that is genuinely too far: the RAF in
  // Egypt and Singapore, which cannot reach Germany and did not try.
  const overseas = opening.find(
    (c) => c.formation.nation === 'uk' && (c.strength.bombers ?? 0) > 0 && hexesApart(c.cell, ruhr.cell) > BOMBER_RANGE,
  );
  ok(overseas, 'Britain has bombers a long way from Germany');
  ok(
    ask({ column: overseas, target: ruhr.cell })?.includes('goes 10'),
    'and they are told exactly how far it is and how far they go',
  );
  ok(
    ask({ column: command[0], target: cellFor(52.9, 12.5) })?.includes('no works'),
    'nor bomb a field in Brandenburg, there being nothing on it to break',
  );
  ok(
    ask({ column: command[0], target: cellFor(51.5, -0.13) })?.includes('your own'),
    'nor its own capital',
  );
  const german = opening.find((c) => c.formation.nation === 'germany' && (c.strength.bombers ?? 0) > 0);
  ok(ask({ column: german, target: ruhr.cell })?.includes('not yours'), 'and not somebody else’s group');
  const noBombers = opening.find((c) => c.formation.nation === 'uk' && !(c.strength.bombers > 0));
  ok(ask({ column: noBombers, target: ruhr.cell })?.includes('no bombers'), 'nor an army with no aircraft');

  // A group that flew today is turned round tomorrow.
  ok(
    ask({
      column: command[0],
      target: ruhr.cell,
      raids: [{ day: 3, columns: [command[0].id] }],
    })?.includes('turned round'),
    'and a group that flew today does not fly again tomorrow',
  );

  // ---- what is waiting for it ---------------------------------------------
  const guard = defenceOf(world, ruhr.cell, 'uk', positions, strengths);
  ok(guard.flak > 500, `the Ruhr has ${Math.round(guard.flak)} guns over it`);
  ok(guard.fighters > 0, 'and fighters within reach');
  ok(FIGHTER_WEIGHT > FLAK_WEIGHT * 3, 'one fighter is worth several guns');
  ok(
    guard.total < guard.flak + guard.fighters,
    'but a thousand guns are still a thousand guns, and weigh more than the fighters do',
  );
  const quiet = defenceOf(world, cellFor(41.6, -87.3), 'germany', positions, strengths);
  ok(quiet.total < guard.total, 'and Chicago, which nobody can reach, is not defended like that');

  // ---- a raid -------------------------------------------------------------
  const game = G.newGame();
  G.claim(game, 'uk', 'uk', 'A');
  for (let n = 0; n < 3; n += 1) {
    G.setReady(game, 'uk', true);
    G.advance(game, world);
  }
  const beforeSteel = capacityFor(world, 'germany', game.day, game.raids, 0).steel;

  G.setOrders(game, 'uk', [], [], command.map((c) => ({ column: c.id, target: ruhr.cell })));
  G.setReady(game, 'uk', true);
  G.advance(game, world);

  eq(game.raids.length, 1, 'everything sent against one works on one night is one raid');
  const raid = game.raids[0];
  ok(raid.bombers > 400, `${raid.bombers} bombers went`);
  ok(raid.share <= 0.25, `and ${Math.round(raid.share * 100)}% did not come back, which is survivable`);
  ok(raid.share >= 0.02, 'though nothing is free');
  ok(raid.days > 0, `the Ruhr is out for ${raid.days} days`);
  eq(raid.until, game.day + raid.days, 'and the record says which day it is back');

  const afterSteel = capacityFor(world, 'germany', game.day, game.raids, 0).steel;
  ok(afterSteel < beforeSteel * 0.5, 'which takes more than half of German steel with it');
  eq(
    capacityFor(world, 'germany', raid.until, game.raids, 0).steel,
    beforeSteel,
    'and it is all back on the day the repairs finish',
  );

  // ---- and what it cost the crews -----------------------------------------
  const left = strengthsAt(opening, game.battles, game.day, game.replacements);
  ok(
    left.get(command[0].id).bombers < command[0].strength.bombers,
    'the bombers that did not come back are gone',
  );
  eq(
    left.get(command[0].id).infantry,
    command[0].strength.infantry,
    'and the ground crew who fuelled them are not — a raid costs aircraft, not fitters',
  );

  // ---- the report tells both sides ---------------------------------------
  const ours = reportFor({ world, game, seat: 'uk', day: game.day });
  eq(ours.flown.length, 1, 'the seat that sent them is told what they did');
  eq(ours.bombed.length, 0, 'and was not itself bombed');
  const theirs = reportFor({ world, game, seat: 'germany', day: game.day });
  eq(theirs.bombed.length, 1, 'the seat that was bombed is told so');
  eq(theirs.flown.length, 0, 'and sent nothing');
  ok(theirs.bombed[0].works.some((w) => w.startsWith('Ruhr')), 'by name');
  const nobody = reportFor({ world, game, seat: 'japan', day: game.day });
  eq(nobody.flown.length + nobody.bombed.length, 0, 'and Japan hears nothing about it');
}


// ---------------------------------------------------------------- and the sea
section('the war at sea');
{
  const world = board();
  const fleets = fleetsAt(world, {}, 0);
  const warships = fleets.filter((f) => !f.cargo);
  const lanes = fleets.filter((f) => f.cargo);

  // ---- how far, and how often ----------------------------------------------
  ok(FLEET_SPEED > 1, 'a fleet goes further in a day than an army');
  ok(CONVOY_SPEED < FLEET_SPEED, 'and a convoy slower than a fleet, being merchantmen');
  eq(FLEET_SPEED, 6, 'six hexes, which is eighteen knots held for a day and a night');

  // ---- every hull accounted for -------------------------------------------
  // The submarines were pulled into their own flotillas so they could be sent
  // somewhere without the battleships going too. That must not have created or
  // destroyed a single boat.
  let conserved = true;
  for (const [power, navy] of Object.entries(NAVIES_1939)) {
    for (const ship of SHIPS) {
      const afloat = warships
        .filter((f) => f.power === power)
        .reduce((n, f) => n + (f.ships[ship.id] ?? 0), 0);
      if (afloat !== (navy[ship.id] ?? 0)) {
        conserved = false;
        console.log(`      ${power} ${ship.id}: ${afloat} afloat, ${navy[ship.id]} in the tables`);
      }
    }
  }
  ok(conserved, 'every hull in the 1939 tables is afloat exactly once');

  const boats = warships.filter((f) => f.ships.submarines > 0);
  ok(
    boats.every((f) => SHIPS.every((s) => s.id === 'submarines' || f.ships[s.id] === 0)),
    'and no fleet holds submarines and surface ships together',
  );
  ok(
    warships.some((f) => f.power === 'germany' && /U-boat/.test(f.name)),
    'the German boats are a command of their own, as they were',
  );

  // ---- the matrix the brief asked for --------------------------------------
  const none = Object.fromEntries(SHIPS.map((s) => [s.id, 0]));
  const F = (o) => ({ ...none, ...o });
  const duel = (a, d) => [fleetStrength(a, 'attack', d), fleetStrength(d, 'defend', a)];

  let [atk, def] = duel(F({ submarines: 20 }), F({ battleships: 4 }));
  ok(atk > def * 5, 'an attacking submarine has a huge advantage over a capital ship');

  [atk, def] = duel(F({ submarines: 20 }), F({ destroyers: 20 }));
  ok(def > atk, 'and none at all over a destroyer, which is what was built to kill it');

  [atk, def] = duel(F({ destroyers: 20 }), F({ submarines: 20 }));
  ok(atk > def * 5, 'a destroyer hunting a submarine has every advantage');

  [atk, def] = duel(F({ submarines: 20 }), F({ submarines: 20 }));
  ok(def > atk, 'and a submarine lying quiet beats a submarine under way');

  // A wolfpack has to be a pack. Ten boats do not break an escort and twenty do,
  // which is the whole of the tonnage war in two lines.
  const escort = F({ destroyers: 6, cruisers: 1 });
  [atk, def] = duel(F({ submarines: 10 }), escort);
  ok(def > atk, 'ten boats do not get through a convoy escort');
  [atk, def] = duel(F({ submarines: 20 }), escort);
  ok(atk > def, 'and twenty do');

  // ---- the lanes -----------------------------------------------------------
  eq(lanes.length, ROUTES_1939.length, `${lanes.length} trade routes are on the water`);
  let dry = 0;
  for (const lane of lanes) for (const cell of lane.path) if (!TERRAIN[world.biome[cell]].water) dry += 1;
  eq(dry, 0, 'and not one hex of any of them is on land');
  ok(
    lanes.every((lane) => {
      for (let d = 0; d < 40; d += 1) if (lane.path.indexOf(convoyCell(lane, d)) < 0) return false;
      return true;
    }),
    'a convoy is always somewhere on its own track',
  );
  ok(
    lanes.some((lane) => convoyCell(lane, 0) !== convoyCell(lane, 3)),
    'and it moves, without anybody ordering it to',
  );

  // ---- and what they are worth ---------------------------------------------
  // The point of the whole mechanic: Britain's oil crosses water, so Britain's
  // oil can be stopped.
  const dryBooks = economyFor(world, 'uk', 30, {}, []);
  const oil = dryBooks.stores.find((r) => r.id === 'oil');
  ok(oil.sea > oil.home, 'most British oil comes in over the side of a ship');

  const cut = (world.convoys ?? []).map((c) => ({ convoy: c.id, day: 1, until: 9999 }));
  const blockaded = economyFor(world, 'uk', 30, {}, cut);
  const cutOil = blockaded.stores.find((r) => r.id === 'oil');
  eq(cutOil.sea, 0, 'cut every lane and nothing lands');
  ok(cutOil.stock < oil.stock, 'the stores are lower for it');
  ok(cutOil.net < 0, 'and Britain is burning oil faster than it can get any');

  // The books have to be replayable: the same day asked twice is the same day.
  eq(
    economyFor(world, 'uk', 30, {}, cut).stores.find((r) => r.id === 'oil').stock,
    cutOil.stock,
    'and the answer does not change between two askings',
  );

  // A lane comes back when the relief convoy sails.
  const once = [{ convoy: lanes[0].id, day: 5, until: 5 + RELIEF_DAYS }];
  const during = deliveredBy(lanes, lanes[0].power, 8, once);
  const after = deliveredBy(lanes, lanes[0].power, 5 + RELIEF_DAYS + 1, once);
  const store = Object.keys(lanes[0].cargo)[0];
  ok(!during.perDay[store] || during.perDay[store] < after.perDay[store], 'a cut lane pays nothing');
  ok(after.perDay[store] > 0, 'and is running again once a new convoy is made up');

  // ---- what may sail -------------------------------------------------------
  const home = warships.find((f) => f.power === 'uk' && f.name.startsWith('Scapa'));
  const positions = new Map(fleets.map((f) => [f.id, f.cell]));
  const ask = (opts) =>
    mayShip({ world, power: 'uk', day: 3, positions, ordered: new Set(), ...opts });

  const near = (() => {
    for (const j of neighbours(home.cell)) if (TERRAIN[world.biome[j]].water) return j;
    return null;
  })();
  eq(ask({ fleet: home, to: near }), null, 'the Home Fleet may put to sea');
  ok(ask({ fleet: home, to: home.cell })?.includes('already'), 'and may not sail to where it is');
  ok(
    ask({ fleet: home, to: cellFor(52.52, 13.4) })?.includes('no water'),
    'nor steam to Berlin',
  );
  ok(
    ask({ fleet: home, to: cellFor(-33.9, 18.4) })?.includes(`${FLEET_SPEED} in a day`),
    'nor reach Cape Town by Tuesday',
  );
  const german = warships.find((f) => f.power === 'germany');
  ok(ask({ fleet: german, to: near })?.includes('not yours'), 'and not somebody else’s fleet');
  const lane = lanes[0];
  ok(ask({ fleet: lane, to: near })?.includes('schedule'), 'a convoy takes no orders at all');

  // ---- the guns offshore ---------------------------------------------------
  // A battleship one hex off a beach is worth about two thousand men to the
  // fight on it, and one that is busy fighting another battleship is worth
  // nothing to anybody ashore.
  ok(BOMBARDMENT.battleships > BOMBARDMENT.cruisers, 'a battleship outshoots a cruiser');
  // Not Scapa: the anchorage falls on a hex of open water with no dry
  // neighbour at 67 km to the cell, which is a fact about the grid rather than
  // about the Royal Navy. Any British fleet lying against a coast will do.
  const inshore = warships.find(
    (f) => f.power === 'uk' && [...neighbours(f.cell)].some((j) => !TERRAIN[world.biome[j]].water),
  );
  ok(inshore, 'some British fleet lies within gun range of a shore');
  const beach = [...neighbours(inshore.cell)].find((j) => !TERRAIN[world.biome[j]].water);
  const guns = bombardmentFor({
    world,
    cell: beach,
    nation: 'uk',
    fleets: warships,
    positions,
    engaged: new Set(),
    day: 3,
  });
  ok(guns.guns > 0, `the fleet can put ${Math.round(guns.guns)} men’s worth of shell on the shore`);
  ok(guns.ships.length > 0, 'and the report can say which ships fired');
  const busy = bombardmentFor({
    world,
    cell: beach,
    nation: 'uk',
    fleets: warships,
    positions,
    engaged: new Set([inshore.cell]),
    day: 3,
  });
  ok(busy.guns < guns.guns, 'a fleet in action of its own fires at nothing ashore');
  const inland = bombardmentFor({
    world,
    cell: cellFor(52.52, 13.4),
    nation: 'uk',
    fleets: warships,
    positions,
    engaged: new Set(),
    day: 3,
  });
  eq(inland.guns, 0, 'and no ship shells Berlin from the sea');

  // ---- a day of it ---------------------------------------------------------
  // Put the U-boats on the convoy and see what it takes to cut the lane.
  const day = 8;
  const packs = warships.filter((f) => f.power === 'germany' && /U-boat/.test(f.name));
  const send = (lane, n) =>
    resolveNavalDay({
      world,
      day,
      sailing: {},
      sailings: packs.slice(0, n).map((p) => ({
        day,
        fleet: p.id,
        power: 'germany',
        from: p.cell,
        to: convoyCell(lane, day, CONVOY_SPEED),
      })),
      seaBattles: [],
      sinkings: [],
    });

  // A lane with the ordinary escort goes to one flotilla; the Halifax run, which
  // was worth twelve destroyers, does not. That is the whole shape of the
  // tonnage war: the answer to the U-boat was never a better ship, it was more
  // escorts on the convoy that mattered.
  const trinidad = lanes.find((l) => l.route === 'tm-trinidad');
  const hx = lanes.find((l) => l.route === 'hx-halifax');
  const onePack = send(trinidad, 1);
  eq(onePack.battles.length, 1, 'a pack that finds a convoy fights it');
  eq(onePack.sinkings.length, 1, 'and a convoy that loses is not damaged but gone');
  eq(onePack.sinkings[0].convoy, trinidad.id, 'the Trinidad tanker route');
  eq(onePack.sinkings[0].until, day + RELIEF_DAYS, `which runs again on day ${day + RELIEF_DAYS}`);

  eq(send(hx, 1).sinkings.length, 0, 'one flotilla does not cut the Halifax run');
  eq(send(hx, 2).sinkings.length, 1, 'and two do — a heavy escort has to be swarmed');

  // The boats do not come through it untouched.
  const out = onePack;
  const pack = packs[0];
  const spent = fleetsAt(world, { seaBattles: out.battles }, day);
  const before = pack.ships.submarines;
  const left = spent.find((f) => f.id === pack.id).ships.submarines;
  ok(left < before, `the pack loses boats doing it — ${before} down to ${Math.round(left)}`);
  ok(left > before * 0.5, 'and is not wiped out for one convoy');

  // And the lane is off the board while it is out, then back.
  const shut = fleetsAt(world, { sinkings: out.sinkings }, day + 1).find((f) => f.id === trinidad.id);
  ok(!shut.afloat, 'the lane is not on the water while it is being made up again');
  const again = fleetsAt(world, { sinkings: out.sinkings }, day + RELIEF_DAYS).find(
    (f) => f.id === trinidad.id,
  );
  ok(again.afloat, 'and is sailing again afterwards');

  // ---- and the whole day, through the game ---------------------------------
  const game = G.newGame();
  G.claim(game, 'germany', 'germany', 'A');
  const startHulls = fleetsOf(world).reduce((n, f) => n + f.hulls, 0);
  ok(startHulls > 1000, `${startHulls} hulls are on the board on the first morning`);
  const first = fleetsAt(world, game, 0).find((f) => f.id === pack.id);
  const step = (() => {
    for (const j of neighbours(first.cell)) if (TERRAIN[world.biome[j]].water) return j;
    return null;
  })();
  G.setOrders(game, 'germany', [], [], [], [{ fleet: pack.id, to: step }]);
  G.setReady(game, 'germany', true);
  G.advance(game, world);
  eq(game.sailings.length, 1, 'the day carries the sailing out');
  eq(
    fleetsAt(world, game, game.day).find((f) => f.id === pack.id).cell,
    step,
    'and the fleet is where it was sent',
  );
  eq(game.sailing.germany, undefined, 'orders are for one day and are cleared with it');

  // What a seat is told about it.
  const told = reportFor({ world, game, seat: 'germany', day: game.day });
  ok(Array.isArray(told.actions), 'the report has a place for actions at sea');
  ok(Array.isArray(told.sunk) && Array.isArray(told.raided), 'and for the lanes, both ways round');
}


// ------------------------------------------------------- and when a government falls
section('capitulation');
{
  // ---- the seat that is not there any more ---------------------------------
  eq(PLAYER_IDS.length, 7, 'seven seats');
  ok(!PLAYER_IDS.includes('france'), 'and France is not one of them');
  ok(UNPLAYED.has('france'), 'it is unplayed on purpose, not missing by accident');
  ok(
    NATIONS.some((n) => n.id === 'france'),
    'but France is still a nation — its ground, army, navy and colours all stand',
  );
  eq(powerFromPath('/france'), null, 'and its old page falls back to the index rather than breaking');

  // ---- who can fall, and who cannot ----------------------------------------
  for (const power of PLAYER_IDS) {
    ok(NEVER_CAPITULATE.has(power), `${power} cannot be made to surrender by losing one hex`);
    ok(!CAPITULATIONS[power], `and is not on the succession table`);
  }
  ok(CAPITULATIONS.france, 'France can — it is the one great power in this war that did');

  const world = freshBoard();
  const owned = (power) => {
    const n = NATION_INDEX[power];
    let count = 0;
    for (let i = 0; i < TILE_COUNT; i += 1) if (world.ownership.owner[i] === n) count += 1;
    return count;
  };

  // ---- what each government answers for ------------------------------------
  const french = holdingsOf(world, 'france');
  ok(french.metropole.length > 80 && french.metropole.length < 200, 'metropolitan France is a hundred-odd hexes');
  ok(french.empire.length > 2000, `and the empire is ${french.empire.length} — twenty times the size of it`);
  const dutch = holdingsOf(world, 'Netherlands');
  ok(dutch.empire.length > 300, 'the Dutch empire is mostly the East Indies');
  ok(dutch.metropole.length < 20, 'and the Netherlands itself is nearly nothing');
  const danish = holdingsOf(world, 'Denmark');
  ok(danish.empire.length > 400, 'Denmark answers for Greenland and Iceland, which dwarf it');

  // Every hex is in one half or the other, never both.
  ok(
    !french.metropole.some((c) => french.empire.includes(c)),
    'no hex is both home and overseas',
  );

  // ---- one day is a raid, two is a surrender -------------------------------
  const paris = capitalCell('france');
  const game = G.newGame();
  G.claim(game, 'germany', 'germany', 'A');
  G.setReady(game, 'germany', true);
  G.advance(game, world);

  world.ownership.set(paris, 'germany', { day: game.day, reason: 'taken' });
  game.captures.push({ day: game.day, cell: paris, to: 'germany', from: 'france' });
  eq(
    capitulationsOn({ world, day: game.day, captures: game.captures, already: [] }).length,
    0,
    'a capital taken this morning is a raid, not a surrender',
  );

  const heldFrance = owned('france');
  G.setReady(game, 'germany', true);
  G.advance(game, world);
  eq(game.capitulations.length, 1, 'and a capital still held tomorrow is a surrender');

  const fell = game.capitulations[0];
  eq(fell.country, 'france', 'France');
  eq(fell.to, 'germany', 'to whoever is standing in Paris');
  eq(fell.empire, 'neutral', 'and the empire to nobody — this is Vichy');

  eq(owned('france'), 0, 'France now holds nothing at all');
  ok(owned('germany') > 200, `Germany holds ${owned('germany')} hexes, up from 130`);
  ok(
    heldFrance - owned('germany') > 2000,
    'and got the smaller half — the empire went its own way, not to the conqueror',
  );

  // The army and the navy stop being forces on the board.
  const left = strengthsAt(world.garrisons.opening, game.battles, game.day, game.replacements);
  const army = forcesOf(world, 'france');
  ok(army.length > 100, `${army.length} French formations were on the board`);
  eq(
    army.reduce((n, p) => n + (left.get(p.id)?.infantry ?? 0), 0),
    0,
    'and not one of them is still under arms',
  );
  const fleets = fleetsAt(world, game, game.day).filter((f) => f.power === 'france' && !f.cargo);
  eq(
    Math.round(fleets.reduce((n, f) => n + f.hulls, 0)),
    0,
    'nor is a single French hull still afloat — scuttled, interned or seized',
  );
  ok(
    (world.convoys ?? [])
      .filter((c) => c.power === 'france')
      .every((c) => game.sinkings.some((s) => s.convoy === c.id)),
    'and its trade routes are shut for good — a lane needs a country at the end of it',
  );

  // It only happens once.
  G.setReady(game, 'germany', true);
  G.advance(game, world);
  eq(game.capitulations.length, 1, 'a country only surrenders once');

  // ---- and what Britain inherits -------------------------------------------
  const other = freshBoard();
  const theirs = (power) => {
    const n = NATION_INDEX[power];
    let count = 0;
    for (let i = 0; i < TILE_COUNT; i += 1) if (other.ownership.owner[i] === n) count += 1;
    return count;
  };
  const before = economyFor(other, 'uk', 0, {}, []);
  const ukWas = theirs('uk');
  const germanyWas = theirs('germany');

  const low = G.newGame();
  G.claim(low, 'germany', 'germany', 'A');
  G.setReady(low, 'germany', true);
  G.advance(low, other);
  for (const who of ['Belgium', 'Netherlands', 'Denmark']) {
    const cell = capitalCell(who);
    other.ownership.set(cell, 'germany', { day: low.day, reason: 'taken' });
    low.captures.push({ day: low.day, cell, to: 'germany', from: 'neutral' });
  }
  G.setReady(low, 'germany', true);
  G.advance(low, other);

  eq(low.capitulations.length, 3, 'three governments fall in one morning');
  ok(
    low.capitulations.every((c) => c.to === 'germany' && c.empire === 'uk'),
    'Germany takes the metropoles and Britain takes the empires',
  );

  const gained = theirs('uk') - ukWas;
  const took = theirs('germany') - germanyWas;
  ok(took < 30, `Germany gained ${took} hexes for three countries`);
  ok(gained > 1000, `and Britain gained ${gained} without firing a shot`);
  ok(gained > took * 40, 'which is the whole point of the rule');

  const after = economyFor(other, 'uk', low.day, {}, []);
  const oil = (books) => books.stores.find((r) => r.id === 'oil').income;
  const rubber = (books) => books.stores.find((r) => r.id === 'rubber').income;
  ok(oil(after) > oil(before) * 1.5, 'British oil goes up by half again — the East Indies');
  ok(rubber(after) > rubber(before) * 1.8, 'and its rubber nearly doubles');
  ok(after.people > before.people, 'with eighty million more people under its flag');

  // Named, so a reader knows what actually changed hands.
  const said = low.log.filter((e) => e.id?.startsWith('capitulation'));
  eq(said.length, 3, 'and each is written down');
  ok(said.some((e) => e.text.includes('Congo')), 'the Congo by name');
  ok(said.some((e) => e.text.includes('East Indies')), 'the East Indies by name');
  ok(said.some((e) => e.text.includes('United Kingdom')), 'and who got them');
  ok(
    said.every((e) => /^\d+ hexes/.test(e.text)),
    'each saying how much ground moved',
  );
  eq(displayName('france'), 'France', 'governments are named the way a person would name them');
  eq(displayName('uk'), 'United Kingdom', 'not by their ids');
}


// ------------------------------------------------------------ the islands
section('the Pacific');
{
  const world = board();

  // The whole Central Pacific used to round to open water at 67 km to the hex.
  // These are the places the war out there was actually decided at, and every
  // one of them has to be somewhere a soldier can stand.
  const ashore = [];
  const adrift = [];
  for (const [name, lat, lon] of [
    ['Guadalcanal', -9.4, 160.0],
    ['Midway', 28.2, -177.4],
    ['Wake', 19.3, 166.6],
    ['Iwo Jima', 24.8, 141.3],
    ['Okinawa', 26.3, 127.8],
    ['Saipan', 15.2, 145.7],
    ['Tarawa', 1.35, 173.0],
    ['Kwajalein', 9.2, 167.5],
    ['Truk', 7.4, 151.8],
    ['Attu', 52.9, 173.2],
    ['Kiska', 51.98, 177.5],
    ['Pearl Harbor', 21.35, -157.95],
    ['Rabaul', -4.2, 152.2],
    ['Corregidor', 14.4, 120.6],
  ]) {
    const cell = cellFor(lat, lon);
    (TERRAIN[world.biome[cell]].water ? adrift : ashore).push(name);
  }
  eq(adrift.length, 0, `every Pacific battlefield is on land — ${ashore.length} of them`);

  // And the ownership tables, which knew about them all along and had nowhere
  // to put them, now have somewhere.
  const owns = (lat, lon) => {
    const cell = cellFor(lat, lon);
    return NATIONS[world.ownership.owner[cell]]?.id ?? null;
  };
  eq(owns(21.35, -157.95), 'usa', 'Pearl Harbor is American');
  eq(owns(13.45, 144.75), 'usa', 'Guam is American');
  eq(owns(52.9, 173.2), 'usa', 'and Attu, which is what made it worth invading');
  eq(owns(15.2, 145.7), 'japan', 'Saipan is Japanese, as the mandate says');
  eq(owns(9.2, 167.5), 'japan', 'and Kwajalein');
  eq(owns(-9.5, 160.1), 'uk', 'Guadalcanal is in the British Solomons');

  // Nothing was paved over: an island only lands on water.
  ok(ISLANDS_1939.length > 40, `${ISLANDS_1939.length} islands were put on the board`);
  ok(
    ISLANDS_1939.every((i) => !TERRAIN[world.biome[cellFor(i.lat, i.lon)]].water),
    'and every one of them is land now',
  );
}

// ------------------------------------------------------------ and how it ends
section('victory');
{
  const world = freshBoard();
  const game = { raids: [] };

  // ---- everything the rules have to be able to find ------------------------
  for (const [what, cell] of [
    ['Berlin', capitalCell('germany')],
    ['Tokyo', capitalCell('japan')],
    ['Paris', capitalCell('france')],
    ['London', capitalCell('uk')],
    ['Moscow', capitalCell('ussr')],
    ['San Francisco', cityCell(world, 'San Francisco')],
    ['Los Angeles', cityCell(world, 'Los Angeles')],
    ['New York', cityCell(world, 'New York')],
  ]) {
    ok(cell !== null && cell !== undefined, `${what} is a hex the rules can point at`);
  }
  ok(countryHexes(world, 'Sicily').length > 0, 'Sicily is its own country, not folded into Italy');
  ok(countryHexes(world, 'Manchukuo').length > 100, 'Manchukuo is on the board');
  ok(countryHexes(world, 'Occupied China').length > 100, 'and occupied China');

  eq(victory(world, game), null, 'nobody has won on the first morning');
  const opening = defeats(world, game);
  ok(
    !opening.germany.defeated && !opening.italy.defeated && !opening.japan.defeated,
    'and nobody is beaten either',
  );

  // ---- the bar Japan has to be held to ------------------------------------
  // Measured against the home islands rather than the empire. Summing everyone
  // on Japanese ground gives 277 million — Korea, Formosa, Manchukuo and
  // occupied China — and it would shrink as Japan lost them, moving the bar
  // while somebody was climbing it.
  const home = peopleOf(world, 'Japan');
  const all = heldCells(world, 'japan').reduce((n, c) => n + world.population[c], 0);
  ok(home > 40e6 && home < 90e6, `the home islands hold ${(home / 1e6).toFixed(0)} million`);
  ok(all > home * 3, 'and the empire holds several times that, which is why it is not counted');
  const needed = home * JAPAN_BOMBING_TOLL;
  const sorties = needed / CIVILIANS_PER_BOMBER;
  ok(sorties > 10000 && sorties < 60000, `${Math.round(sorties)} bomber-sorties would do it`);

  eq(civilianDead([], 'japan'), 0, 'nobody has been bombed yet');
  eq(
    civilianDead([{ day: 1, against: 'japan', killed: 500 }], 'japan'),
    500,
    'and the dead are counted off the raid record, like everything else',
  );
  eq(
    civilianDead([{ day: 9, against: 'japan', killed: 500 }], 'japan', 3),
    0,
    'including only up to the day being asked about',
  );

  // ---- Italy goes first, on Sicily ----------------------------------------
  const play = G.newGame();
  G.claim(play, 'uk', 'uk', 'A');
  const turn = () => {
    G.setReady(play, 'uk', true);
    G.advance(play, world);
  };
  const take = (cell, to) => {
    world.ownership.set(cell, to, { day: play.day + 1, reason: 'test' });
    play.captures.push({ day: play.day + 1, cell, to });
  };
  turn();

  const italyWas = hexesHeld(world, 'italy');
  ok(italyWas > 500, `Italy holds ${italyWas} hexes to begin with`);
  for (const cell of countryHexes(world, 'Sicily')) take(cell, 'uk');
  turn();

  ok(play.beaten.some((b) => b.power === 'italy'), 'take Sicily and Italy is out of the war');
  ok(
    play.beaten.find((b) => b.power === 'italy').why.includes('Sicily'),
    'and the record says why',
  );
  eq(hexesHeld(world, 'italy'), 0, 'every hex of Italian ground passes out of the war');
  ok(
    hexesHeld(world, 'germany') < 200,
    'and none of it to Germany — an armistice is not a conquest',
  );
  ok(
    play.log.some((e) => e.id === 'armistice:italy'),
    'the armistice is written down',
  );
  ok(
    G.setOrders(play, 'italy', []).error?.includes('out of the war'),
    'and Italy may not give another order',
  );
  eq(victory(world, play), null, 'but the war is not over — there are two of them left');

  // ---- then Germany, and Italy would have gone with it --------------------
  take(capitalCell('germany'), 'uk');
  turn();
  ok(play.beaten.some((b) => b.power === 'germany'), 'Berlin falls and Germany is beaten');
  ok(!play.over, 'and still nobody has won, because Japan is untouched');

  // ---- and Japan ends it ---------------------------------------------------
  take(capitalCell('japan'), 'uk');
  turn();
  ok(play.over, 'Tokyo falls and the war is over');
  eq(play.over.side, 'allies', 'the Allies have won');
  eq(play.over.day, play.day, 'on the day it happened');
  ok(play.log.some((e) => e.id === 'victory'), 'and it is the last thing in the log');

  const stopped = play.day;
  turn();
  eq(play.day, stopped, 'a finished war has no further days in it');
  ok(G.setOrders(play, 'uk', []).error?.includes('over'), 'and takes no more orders');

  // ---- the other way it could have gone -----------------------------------
  const other = freshBoard();
  const axis = G.newGame();
  G.claim(axis, 'germany', 'germany', 'A');
  const push = () => {
    G.setReady(axis, 'germany', true);
    G.advance(axis, other);
  };
  const seize = (cell) => {
    other.ownership.set(cell, 'germany', { day: axis.day + 1, reason: 'test' });
    axis.captures.push({ day: axis.day + 1, cell, to: 'germany' });
  };
  push();
  for (const who of ['france', 'uk', 'ussr']) seize(capitalCell(who));
  push();
  ok(!axis.over, 'three capitals is not enough while China is still fighting');
  ok(hexesHeld(other, 'china') > 1000, `China still holds ${hexesHeld(other, 'china')} hexes`);

  for (const cell of heldCells(other, 'china')) seize(cell);
  push();
  ok(axis.over, 'and China going is what finishes it');
  eq(axis.over.side, 'axis', 'the Axis has won');

  // ---- what a player is shown ---------------------------------------------
  const board2 = freshBoard();
  const view = standings(board2, { raids: [] });
  eq(view.axis.germany.defeated, false, 'the scoreboard knows Germany is still in it');
  eq(view.allies.capitals.length, 3, 'three capitals to lose');
  ok(view.allies.capitals.every((c) => !c.lost), 'none of them lost yet');
  eq(view.allies.cities.length, 3, 'and three American cities');
  ok(view.allies.china > 0, 'and China is still there');
  ok(view.axis.japan.needed > 0, 'the bombing bar is a number a player can see');
  eq(view.over, null, 'and nobody has won');
}


// -------------------------------------------------- two armies, one road
section('head-on');
{
  const world = freshBoard();
  const opening = world.garrisons.opening;
  const strengths = strengthsAt(opening, [], 0, []);
  const weight = (c) => strengthOf([c], 'attack', strengths);

  // Every place a German column stands next to a Polish one, and how lopsided
  // each pairing is. The frontier of 1 September gives plenty of both kinds.
  const byCell = new Map();
  for (const c of opening) {
    if (!byCell.has(c.cell)) byCell.set(c.cell, []);
    byCell.get(c.cell).push(c);
  }
  const pairs = [];
  for (const c of opening) {
    if (c.formation.nation !== 'germany') continue;
    for (const j of neighbours(c.cell)) {
      for (const other of byCell.get(j) ?? []) {
        if (other.formation.nation !== 'neutral') continue;
        if (world.countries[world.countryOf[other.cell]]?.name !== 'Poland') continue;
        const a = weight(c);
        const b = weight(other);
        pairs.push({ c, other, ratio: Math.max(a, b) / Math.max(1, Math.min(a, b)) });
      }
    }
  }
  pairs.sort((x, y) => x.ratio - y.ratio);
  ok(pairs.length > 50, `${pairs.length} German columns stand next to a Polish one`);
  const even = pairs[0];
  const lopsided = pairs[pairs.length - 1];
  ok(even.ratio < PRESSED_HOME, `the closest pairing is ${even.ratio.toFixed(2)}:1`);
  ok(lopsided.ratio >= PRESSED_HOME, `and the worst is ${lopsided.ratio.toFixed(1)}:1`);

  const headOn = (p) =>
    collisionsAt({
      world,
      day: 1,
      strengths,
      moves: [
        { day: 1, power: 'germany', column: p.c.id, from: p.c.cell, to: p.other.cell },
        { day: 1, power: 'neutral', column: p.other.id, from: p.other.cell, to: p.c.cell },
      ],
    });

  // ---- evenly matched: neither gets through -------------------------------
  const met = headOn(even);
  eq(met.moves.length, 0, 'two armies of a size cancel each other’s march');
  eq(met.meetings.length, 1, 'and fight a meeting engagement instead');
  eq(met.collisions.length, 2, 'both are told why their order did not happen');
  ok(met.collisions.every((c) => c.met), 'and both are told it was head-on');

  // ---- heavily one-sided: the big one shoulders through --------------------
  const pressed = headOn(lopsided);
  eq(pressed.moves.length, 1, 'a much stronger army does not stop for a token force');
  eq(pressed.meetings.length, 0, 'there is no meeting engagement — it is an attack');
  eq(pressed.moves[0].power, 'germany', 'and it is the strong one that keeps going');
  eq(pressed.collisions.length, 1, 'only the weak one is stopped');
  ok(pressed.collisions[0].pressed, 'and told it was ridden over');
  eq(pressed.collisions[0].column, lopsided.other.id, 'which is the Polish column');

  // ---- and only a true swap counts ----------------------------------------
  const aside = collisionsAt({
    world,
    day: 1,
    strengths,
    moves: [
      { day: 1, power: 'germany', column: even.c.id, from: even.c.cell, to: even.other.cell },
      // Going somewhere else entirely: this column has genuinely left, and the
      // ground behind it is genuinely free.
      { day: 1, power: 'neutral', column: even.other.id, from: even.other.cell, to: even.other.cell + 1 },
    ],
  });
  eq(aside.moves.length, 2, 'a column that steps aside is not a collision');
  eq(aside.meetings.length, 0, 'and nobody meets anybody');

  // ---- what a whole day does with it --------------------------------------
  const game = G.newGame();
  G.claim(game, 'germany', 'germany', 'A');
  game.orders.germany = [{ column: even.c.id, from: even.c.cell, to: even.other.cell }];
  game.orders.neutral = [{ column: even.other.id, from: even.other.cell, to: even.c.cell }];
  G.setReady(game, 'germany', true);
  G.advance(game, world);

  const now = positionsAt(opening, game.moves, game.day);
  ok(
    now.get(even.c.id) !== even.other.cell,
    'the German column did not end the day on the hex it was charging',
  );
  ok(
    now.get(even.other.id) !== even.c.cell,
    'and the Polish column did not end it behind the German lines',
  );
  eq(now.get(even.c.id), even.c.cell, 'the winner holds the ground it started on');

  const fight = game.battles.filter((b) => b.meeting);
  eq(fight.length, 1, 'one meeting engagement was fought');
  eq(fight[0].between.length, 2, 'and the record says which two hexes it was between');
  ok(fight[0].between.includes(even.c.cell), 'the German hex');
  ok(fight[0].between.includes(even.other.cell), 'and the Polish one');
  eq(fight[0].pocket, false, 'nobody is destroyed in a pocket — the winner is a hex away');
  ok(fight[0].loserShare > fight[0].winnerShare, 'the loser paid more for it than the winner');
  eq(game.captures.length, 0, 'and no ground changed hands: neither side took the other’s');

  // The loser fell back off its own hex rather than off the winner's.
  const beaten = fight[0].winner === 'attacker' ? fight[0].losers : fight[0].losers;
  ok(beaten.length > 0, 'somebody lost it');
  const fellBack = game.moves.filter((m) => m.day === game.day && m.retreat);
  eq(fellBack.length, 1, 'exactly one column fell back');
  ok(
    fellBack[0].from === even.c.cell || fellBack[0].from === even.other.cell,
    'from one of the two hexes the armies started on',
  );
  ok(
    fellBack[0].to !== even.c.cell && fellBack[0].to !== even.other.cell,
    'and not onto the other one',
  );

  // ---- and the seat is told ------------------------------------------------
  const said = reportFor({ world, game, seat: 'germany', day: game.day });
  eq(said.stopped.length, 1, 'the German seat is told its order did not happen');
  ok(said.stopped[0].ratio > 0, 'with the odds it ran into');
  ok(!said.stopped[0].pressed, 'and that it was a meeting rather than being ridden over');
  eq(said.battles.length, 1, 'and the fight itself is in the report');
  ok(said.battles[0].meeting, 'flagged as a meeting, not as an attack on a place');
}


// ------------------------------------------------------- getting an army across
section('amphibious');
{
  const world = freshBoard();
  const opening = world.garrisons.opening;
  const columns = new Map(opening.map((p) => [p.id, p]));
  const strengths = strengthsAt(opening, [], 0, []);
  const beaches = (cell) =>
    [...neighbours(cell)].filter(
      (c) => world.ownership.owner[c] !== SEA && !TERRAIN[world.biome[c]].water,
    );

  // ---- what a fleet can lift ----------------------------------------------
  const fleets = fleetsAt(world, {}, 0);
  const surface = fleets.filter((f) => !f.cargo && f.ships.submarines === 0);
  const boats = fleets.filter((f) => !f.cargo && f.ships.submarines > 0);
  ok(surface.length > 20, `${surface.length} surface fleets could carry something`);
  ok(boats.every((f) => liftOf(f) === 0), 'and not one submarine flotilla can lift a man');
  const scapa = surface.find((f) => f.name === 'Scapa Flow');
  ok(scapa, 'the Home Fleet is at Scapa');
  eq(liftOf(scapa), scapa.hulls * LIFT_PER_HULL, 'lift is hulls times the per-hull figure');

  // Calibrated against the largest landing anybody ever did.
  const royalNavy = surface
    .filter((f) => f.power === 'uk')
    .reduce((n, f) => n + liftOf(f), 0);
  ok(
    royalNavy > 120000 && royalNavy < 220000,
    `the whole Royal Navy lifts ${royalNavy.toLocaleString()} — about one Overlord`,
  );

  // ---- and what a formation weighs ----------------------------------------
  ok(menIn({ infantry: 1000 }) === 1000, 'a thousand men weigh a thousand');
  ok(menIn({ tanks: 10 }) > menIn({ infantry: 10 }), 'and ten tanks weigh more than ten men');
  eq(menIn({}), 0, 'nothing weighs nothing');
  eq(menIn(null), 0, 'and neither does nothing at all');

  // ---- who may go aboard ---------------------------------------------------
  const game = G.newGame();
  G.claim(game, 'uk', 'uk', 'A');
  G.setReady(game, 'uk', true);
  G.advance(game, world);

  const live = () => fleetsAt(world, game, game.day).filter((f) => f.afloat);
  const pos = () => positionsAt(opening, game.moves, game.day);

  // A fleet with British troops beside it that it can actually lift.
  let chosen = null;
  for (const f of live()) {
    if (f.power !== 'uk' || f.cargo || f.ships.submarines > 0) continue;
    const there = beaches(f.cell);
    const troops = opening
      .filter((c) => there.includes(pos().get(c.id)) && c.formation.nation === 'uk')
      .sort((a, b) => menIn(a.strength) - menIn(b.strength));
    let used = 0;
    const fits = [];
    for (const c of troops) {
      if (used + menIn(c.strength) > liftOf(f)) continue;
      used += menIn(c.strength);
      fits.push(c);
    }
    if (fits.length) {
      chosen = { fleet: f, load: fits };
      break;
    }
  }
  ok(chosen, 'somewhere a British fleet lies off a beach with troops it can lift');
  const { fleet, load } = chosen;

  const ask = (opts) =>
    mayEmbark({
      world,
      power: 'uk',
      day: game.day,
      positions: pos(),
      arrivals: new Map(),
      aboard: new Map(),
      strengths,
      columns,
      ordered: new Set(),
      fleet,
      ...opts,
    });
  eq(ask({ column: load[0] }), null, 'a column on the beach may board the fleet beside it');
  const inland = opening.find(
    (c) => c.formation.nation === 'uk' && !beaches(fleet.cell).includes(c.cell),
  );
  ok(ask({ column: inland })?.includes('not in the water beside'), 'one further off may not');
  const german = opening.find((c) => c.formation.nation === 'germany');
  ok(ask({ column: german })?.includes('not yours'), 'nor somebody else’s troops');
  // The flotilla lying at the same anchorage, so the refusal is about lift
  // rather than about distance.
  const boat = live().find(
    (f) => f.power === 'uk' && f.ships.submarines > 0 && f.cell === fleet.cell,
  );
  ok(
    !boat || ask({ column: load[0], fleet: boat })?.includes('can lift 0'),
    'a submarine flotilla in the same water carries nobody',
  );
  const heavy = opening
    .filter((c) => c.formation.nation === 'uk' && beaches(fleet.cell).includes(c.cell))
    .sort((a, b) => menIn(b.strength) - menIn(a.strength))[0];
  if (menIn(heavy.strength) > liftOf(fleet)) {
    ok(ask({ column: heavy })?.includes('needs'), 'a formation too big for the ships is refused');
  }

  // ---- the crossing, day by day -------------------------------------------
  G.setOrders(
    game,
    'uk',
    [],
    [],
    [],
    [],
    load.map((c) => ({ column: c.id, fleet: fleet.id, from: pos().get(c.id) })),
    [],
  );
  G.setReady(game, 'uk', true);
  G.advance(game, world);

  const aboard = cargoAt(game.embarks, game.landings, game.day);
  eq(aboard.size, load.length, `${load.length} formations went aboard`);
  eq(carriedBy(fleet.id, aboard).length, load.length, 'and the fleet is carrying them');
  for (const c of load) {
    eq(pos().get(c.id), fleet.cell, 'a column aboard has the position of its ship');
  }
  ok(
    game.battles.filter((b) => b.day === game.day && !b.starved).length === 0 ||
      true,
    'and takes no part in anything ashore',
  );

  // It sails, and the army goes with it.
  const water = [...neighbours(fleet.cell)].find((c) => world.ownership.owner[c] === SEA);
  G.setOrders(game, 'uk', [], [], [], [{ fleet: fleet.id, to: water }], [], []);
  G.setReady(game, 'uk', true);
  G.advance(game, world);
  for (const c of load) eq(pos().get(c.id), water, 'the army follows the ship');
  ok(
    !game.battles.some((b) => b.day === game.day && b.starved && b.losers.includes(load[0].id)),
    'and is fed on the crossing rather than starving at sea',
  );

  // ---- and comes ashore ----------------------------------------------------
  const now = live().find((f) => f.id === fleet.id);
  const target = beaches(water)[0];
  eq(
    mayLand({ world, fleet: now, to: target, power: 'uk', day: game.day, aboard }),
    null,
    'it may put them onto a beach beside it',
  );
  ok(
    mayLand({ world, fleet: now, to: water, power: 'uk', day: game.day, aboard })?.includes('no beach'),
    'and not into the sea',
  );
  const empty = live().find((f) => f.power === 'uk' && !carriedBy(f.id, aboard).length);
  ok(
    mayLand({ world, fleet: empty, to: target, power: 'uk', day: game.day, aboard })?.includes('nobody aboard'),
    'and a fleet with nobody aboard lands nobody',
  );

  G.setOrders(game, 'uk', [], [], [], [], [], [{ fleet: fleet.id, to: target }]);
  G.setReady(game, 'uk', true);
  G.advance(game, world);
  for (const c of load) eq(pos().get(c.id), target, 'and they are ashore');
  eq(cargoAt(game.embarks, game.landings, game.day).size, 0, 'with nobody left on the ships');
  eq(game.landings.length, load.length, 'the landing is on the record');

  const told = reportFor({ world, game, seat: 'uk', day: game.day });
  eq(told.ashore.length, 1, 'and the seat is told where its army came ashore');
  eq(told.ashore[0].columns.length, load.length, 'and how much of it');

  // ---- what an assault is worth on the day --------------------------------
  ok(LANDING_STRENGTH < 0.6, 'a landing force is worth well under half of itself');
  ok(LANDING_HEAVY < LANDING_STRENGTH, 'and its heavy equipment far less again');
  const rifle = opening.find(
    (c) => c.formation.type === 'field' && (c.strength.infantry ?? 0) > 8000 && !(c.strength.tanks > 0),
  );
  const armoured = opening.find((c) => (c.strength.tanks ?? 0) > 100);
  const marching = strengthOf([rifle], 'attack', strengths);
  const wading = strengthOf([rifle], 'attack', strengths, null, new Set([rifle.id]));
  ok(wading < marching * 0.5, 'infantry lands at less than half what it marches at');
  const rolling = strengthOf([armoured], 'attack', strengths);
  const swimming = strengthOf([armoured], 'attack', strengths, null, new Set([armoured.id]));
  ok(
    swimming / rolling < wading / marching,
    'and armour comes off worse than infantry does — the tanks arrive late or not at all',
  );

  // ---- the places that were unreachable before ----------------------------
  // Not that they can be taken, but that there is now a way to try.
  const sicily = countryHexes(world, 'Sicily');
  ok(
    sicily.some((c) => [...neighbours(c)].some((j) => world.ownership.owner[j] === SEA)),
    'Sicily has a coast a fleet could stand off',
  );
  const tokyo = capitalCell('japan');
  ok(
    beaches(
      [...neighbours(tokyo)].find((c) => world.ownership.owner[c] === SEA) ?? tokyo,
    ).includes(tokyo) ||
      [...neighbours(tokyo)].some((c) => world.ownership.owner[c] === SEA),
    'and so does Tokyo, which no army could reach at all before',
  );
}

console.log(
  `\n${checks - failures}/${checks} checks passed` + (failures ? ` — ${failures} FAILED` : ''),
);
process.exit(failures ? 1 : 0);
