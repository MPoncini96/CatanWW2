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
import { TILE_COUNT, grid, neighbours } from '../src/world/sphere.js';
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
import { NATION_INDEX, NEUTRAL, SEA } from '../src/world/nations.js';
import { canSeeForces } from '../src/world/intel.js';

let checks = 0;
let failures = 0;

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

console.log(
  `\n${checks - failures}/${checks} checks passed` + (failures ? ` — ${failures} FAILED` : ''),
);
process.exit(failures ? 1 : 0);
