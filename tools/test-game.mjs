/**
 * The rules, under plain Node.
 *
 *   npm test
 *
 * `src/game/` is pure — no browser, no network, no clock, no file — which is
 * the whole reason it can be checked like this. The territory table is pure
 * too: a box list and a point test, with no need for the baked Earth data.
 *
 * Nothing here draws anything. What is checked is the part that decides what a
 * player may do: what day it is, who may fight whom, who takes a turn, and who
 * holds the ground.
 */
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
import { territoryAt } from '../src/world/territories.js';
import { countryFor } from '../src/world/countries.js';

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

  // Colonies answer to their metropoles rather than to nobody.
  eq(country(-8.84, 13.23), 'Angola', 'Luanda is Angolan');
  eq(country(-5.55, 12.19), 'Angola', 'and Cabinda with it');
  eq(country(11.86, -15.6), 'Portuguese Guinea', 'Bissau is Portuguese');
  eq(country(9.51, -13.71), 'French West Africa', 'and Conakry French');
  eq(country(8.48, -13.23), 'Sierra Leone', 'while Freetown is British');
}

console.log(
  `\n${checks - failures}/${checks} checks passed` + (failures ? ` — ${failures} FAILED` : ''),
);
process.exit(failures ? 1 : 0);
