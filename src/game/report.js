import { NATIONS, NATION_INDEX } from '../world/nations.js';
import { fleetsOf } from './naval.js';
import { displayName } from './capitulation.js';
import { TEMPLATE_INDEX } from './raising.js';
import { strengthsAt } from './combat.js';
import { formationName } from '../world/deploy.js';
import { grid } from '../world/sphere.js';

// What the day brought.
//
// Everything below is already in the record — the battles, the ground, the
// starvation, what came up from the depots — and until this file existed none
// of it was anywhere a player could see. You ended the day and the map had
// quietly changed, and the only way to find out how was to click every hex you
// owned and read them one at a time.
//
// So this is not a new system. It is the one that reads the four lists back and
// says, in order: who you fought, what it cost, what changed hands, who is
// going hungry, and what the factories could and could not manage. Nothing is
// stored for it. Ask again tomorrow and it works the day out again.

const ARMS = ['infantry', 'tanks', 'artillery', 'fighters', 'bombers'];

/** Who a reader would say was holding this hex. */
function countryOn(world, cell, nation) {
  const country = world.countryOf?.[cell] >= 0 ? world.countries[world.countryOf[cell]] : null;
  const power = NATIONS[NATION_INDEX[nation]]?.name;
  if (!country) return power ?? '—';
  return country.name === power ? power : country.name;
}

/**
 * A place a reader can picture, rather than a cell number.
 *
 * A city if there is one, and otherwise the region *with its coordinates* —
 * because a report of three separate fights that all say "Poland" is not
 * telling anybody where anything happened. Poland is seventy hexes.
 */
export function placeOf(world, cell) {
  const city = world.cityAt?.[cell] >= 0 ? world.cities[world.cityAt[cell]] : null;
  if (city) return city.name;
  const sphere = grid();
  const lat = sphere.lat[cell];
  const lon = sphere.lon[cell];
  const where = `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lon).toFixed(1)}°${lon >= 0 ? 'E' : 'W'}`;
  const region = world.territoryName?.[cell];
  return region ? `${region} · ${where}` : where;
}

/** How much came off a set of columns between two days. */
function difference(before, after, ids) {
  const out = {};
  let any = 0;
  for (const id of ids) {
    const was = before.get(id);
    const now = after.get(id);
    if (!was) continue;
    for (const arm of ARMS) {
      const gone = (was[arm] ?? 0) - (now?.[arm] ?? 0);
      if (gone <= 0) continue;
      out[arm] = (out[arm] ?? 0) + gone;
      any += gone;
    }
  }
  return any ? out : null;
}

/**
 * What one entry in the record cost, as against what the whole day cost.
 *
 * The difference matters and the first version of this got it wrong. A column
 * that fought in the morning and went hungry in the afternoon appears in two
 * entries, and asking "how much less of it is there than yesterday" for each of
 * them attributes the whole day's loss to both — so the report said the battle
 * cost 7,900 men and the famine cost 8,000, out of 7,900 lost.
 *
 * So the day is walked in the order it happened, each entry taking its own
 * share off a running strength. The parts now add up to the whole, because they
 * are worked out the same way the whole was.
 */
function costsOfTheDay(opening, record, day) {
  const running = new Map();
  for (const placement of opening) running.set(placement.id, { ...placement.strength });
  for (const entry of record) {
    if (entry.day >= day) break;
    for (const [ids, share] of [[entry.losers, entry.loserShare], [entry.winners, entry.winnerShare]]) {
      for (const id of ids ?? []) {
        const have = running.get(id);
        if (!have) continue;
        for (const arm of entry.arms ?? ARMS) {
          if (have[arm] === undefined) continue;
          have[arm] = Math.max(0, Math.floor(have[arm] * (1 - share)));
        }
      }
    }
  }

  // Kept per column rather than per entry, because a report is written for one
  // seat and half of what a battle costs is somebody else's.
  const cost = new Map();
  for (const entry of record) {
    if (entry.day !== day) continue;
    const took = new Map();
    for (const [ids, share] of [[entry.losers, entry.loserShare], [entry.winners, entry.winnerShare]]) {
      for (const id of ids ?? []) {
        const have = running.get(id);
        if (!have) continue;
        const mine = {};
        for (const arm of entry.arms ?? ARMS) {
          if (have[arm] === undefined) continue;
          const after = Math.max(0, Math.floor(have[arm] * (1 - share)));
          const gone = have[arm] - after;
          have[arm] = after;
          if (gone > 0) mine[arm] = gone;
        }
        took.set(id, mine);
      }
    }
    cost.set(entry, took);
  }
  return cost;
}

/**
 * Everything that happened to one seat on one day.
 *
 * @returns {{day, battles, taken, lost, starving, sent, refused, losses, gains, quiet}}
 */
export function reportFor({ world, game, seat, day }) {
  const opening = world.garrisons.opening;
  const mine = new Set(
    opening.filter((c) => c.formation.nation === seat).map((c) => c.id),
  );
  const nameOf = (id) => {
    const column = opening.find((c) => c.id === id);
    return column ? formationName(column.formation) : id;
  };

  const before = strengthsAt(opening, game.battles ?? [], day - 1, game.replacements ?? []);
  const after = strengthsAt(opening, game.battles ?? [], day, game.replacements ?? []);
  // What each entry cost on its own, so the parts add up to the whole.
  const cost = costsOfTheDay(opening, game.battles ?? [], day);
  // What an entry cost *this seat*, which is half of what it cost in all.
  const oursOnly = (entry) => {
    const per = cost.get(entry);
    if (!per) return null;
    const out = {};
    let any = 0;
    for (const [id, took] of per) {
      if (!mine.has(id)) continue;
      for (const [arm, n] of Object.entries(took)) {
        out[arm] = (out[arm] ?? 0) + n;
        any += n;
      }
    }
    return any ? out : null;
  };

  // ---- the fighting --------------------------------------------------------
  const battles = [];
  const starving = [];
  for (const entry of game.battles ?? []) {
    if (entry.day !== day) continue;

    if (entry.starved) {
      if (!entry.losers.some((id) => mine.has(id))) continue;
      // Gathered by hex rather than by column. Six columns going hungry on one
      // hex is one fact about one place, and listing it six times — four of
      // them reading "14th Army", because four detachments of it marched
      // together — tells a reader less than saying it once.
      const seat = starving.find((x) => x.cell === entry.cell) ?? {
        cell: entry.cell,
        where: placeOf(world, entry.cell),
        columns: [],
        lost: null,
      };
      if (!starving.includes(seat)) starving.push(seat);
      for (const id of entry.losers) if (mine.has(id)) seat.columns.push(nameOf(id));
      const took = oursOnly(entry);
      if (took) {
        seat.lost ??= {};
        for (const [arm, n] of Object.entries(took)) seat.lost[arm] = (seat.lost[arm] ?? 0) + n;
      }
      continue;
    }

    const attacking = entry.attacker === seat;
    const defending = entry.defender === seat;
    if (!attacking && !defending) continue;
    const won = (attacking && entry.winner === 'attacker') || (defending && entry.winner === 'defender');
    const ours = [...entry.losers, ...entry.winners].filter((id) => mine.has(id));
    battles.push({
      cell: entry.cell,
      where: placeOf(world, entry.cell),
      // A head-on collision has an attacker and a defender in the record
      // because the record needs two columns to put them in, but neither side
      // was defending anything — both were marching. The report should say so
      // rather than telling one of them it was attacked in a place it had
      // already left.
      meeting: Boolean(entry.meeting),
      between: entry.between ?? null,
      attacking,
      won,
      pocket: entry.pocket,
      // Named by the country standing on the ground where there is one. The
      // pooled neutral is thirty armies and "attacked Independent" tells a
      // reader nothing about who was in the way.
      against: countryOn(world, entry.cell, attacking ? entry.defender : entry.attacker),
      strength: attacking ? entry.attack : entry.defence,
      theirs: attacking ? entry.defence : entry.attack,
      columns: ours.map(nameOf),
      lost: oursOnly(entry),
    });
  }

  // ---- the ground ----------------------------------------------------------
  const taken = [];
  const lost = [];
  for (const capture of game.captures ?? []) {
    if (capture.day !== day) continue;
    // Ground that changed hands because a government fell is not listed hex by
    // hex. Four capitulations move about four thousand cells, and a reader
    // scrolling past 1,470 lines reading "Belgian Congo (Katanga) — taken" has
    // been told less than the one line above that says Britain got the Congo.
    if (capture.capitulation) continue;
    const how = capture.cutOff ? 'cut off' : capture.walkedIn ? 'walked into' : 'stormed';
    if (capture.to === seat) {
      taken.push({ cell: capture.cell, where: placeOf(world, capture.cell), how, from: capture.from });
    } else if (capture.from === seat) {
      lost.push({ cell: capture.cell, where: placeOf(world, capture.cell), how, to: capture.to });
    }
  }

  // ---- the bombing ---------------------------------------------------------
  const flown = [];
  const bombed = [];
  for (const raid of game.raids ?? []) {
    if (raid.day !== day) continue;
    const entry = {
      cell: raid.cell,
      where: placeOf(world, raid.cell),
      works: raid.works,
      bombers: raid.bombers,
      through: raid.through,
      share: raid.share,
      days: raid.days,
      fighters: raid.fighters,
      flak: raid.flak,
    };
    if (raid.power === seat) flown.push(entry);
    else if (raid.against === seat) bombed.push(entry);
  }

  // ---- the sea -------------------------------------------------------------
  // Two lists, because they are two different mornings. An action is something
  // this seat's ships were in and can be told about in ships. A lane cut is
  // something that happened to a merchant fleet six hundred miles away and is
  // felt as a number on the stores panel a week later, which is why it is worth
  // saying out loud on the day it happens.
  const actions = [];
  const fleetName = (id) =>
    fleetsOf(world).find((f) => f.id === id)?.name ?? id;
  for (const entry of game.seaBattles ?? []) {
    if (entry.day !== day) continue;
    const attacking = entry.attacker === seat;
    const defending = entry.defender === seat;
    if (!attacking && !defending) continue;
    const won =
      (attacking && entry.winner === 'attacker') || (defending && entry.winner === 'defender');
    actions.push({
      cell: entry.cell,
      where: placeOf(world, entry.cell),
      attacking,
      won,
      against: attacking ? entry.defender : entry.attacker,
      strength: attacking ? entry.attack : entry.defence,
      theirs: attacking ? entry.defence : entry.attack,
      fleets: (won ? entry.winners : entry.losers).map(fleetName),
      // What a share of a fleet means in hulls is not worth spelling out to a
      // reader who is about to see the new count anyway. The share is.
      share: won ? entry.winnerShare : entry.loserShare,
    });
  }

  const sunk = [];
  const raided = [];
  for (const entry of game.sinkings ?? []) {
    if (entry.day !== day) continue;
    const line = {
      cell: entry.cell,
      where: placeOf(world, entry.cell),
      lane: fleetName(entry.convoy),
      until: entry.until,
      days: entry.until - entry.day,
    };
    if (entry.power === seat) sunk.push(line);
    else if (entry.by === seat) raided.push({ ...line, from: entry.power });
  }

  // ---- and what the bombers did to an army ---------------------------------
  const struck = [];
  const bombed2 = [];
  for (const hit of game.strikes ?? []) {
    if (hit.day !== day) continue;
    const line = {
      cell: hit.cell,
      where: placeOf(world, hit.cell),
      bombers: hit.bombers,
      through: hit.through,
      killed: hit.killed,
      share: hit.share,
      cover: hit.cover,
      fighters: hit.fighters,
      flak: hit.flak,
    };
    if (hit.power === seat) struck.push(line);
    else if (hit.against === seat) bombed2.push(line);
  }

  // ---- who walked to the war on their own ----------------------------------
  // One line rather than a list. Sixty-four formations stepping east on the
  // first morning is one fact about the army, not sixty-four facts about
  // divisions, and a reader who wants the detail has the map.
  let advanced = 0;
  for (const move of game.moves ?? []) {
    if (move.day === day && move.advance && move.power === seat) advanced += 1;
  }

  // ---- what the depots produced --------------------------------------------
  const formed = [];
  const ordered = [];
  for (const entry of game.raisings ?? []) {
    if (entry.power !== seat) continue;
    if (entry.ready === day) {
      formed.push({
        name: entry.name,
        where: placeOf(world, entry.cell),
        men: entry.men,
        days: entry.ready - entry.day,
      });
    }
    if (entry.day === day) {
      ordered.push({
        name: entry.name,
        where: placeOf(world, entry.cell),
        men: entry.men,
        ready: entry.ready,
        days: TEMPLATE_INDEX[entry.template]?.days ?? entry.ready - entry.day,
      });
    }
  }

  // ---- across the water ----------------------------------------------------
  // A landing is the largest single thing a seat can order and it would
  // otherwise appear only as an ordinary attack on a hex, with nothing to say
  // the men came off a ship.
  const ashore = [];
  for (const entry of game.landings ?? []) {
    if (entry.day !== day || entry.power !== seat) continue;
    const spot = ashore.find((x) => x.cell === entry.to) ?? {
      cell: entry.to,
      where: placeOf(world, entry.to),
      columns: [],
    };
    if (!ashore.includes(spot)) ashore.push(spot);
    spot.columns.push(nameOf(entry.column));
  }
  const embarked = [];
  for (const entry of game.embarks ?? []) {
    if (entry.day !== day || entry.power !== seat) continue;
    embarked.push({ column: nameOf(entry.column), where: placeOf(world, entry.from) });
  }

  // ---- orders that never happened ------------------------------------------
  // A player who ordered an attack and got a defence is owed a sentence about
  // why. Both halves of a collision get one: the column that was ridden over
  // before it could start, and the pair that ran into each other.
  const stopped = [];
  for (const entry of game.collisions ?? []) {
    if (entry.day !== day || entry.power !== seat) continue;
    stopped.push({
      column: nameOf(entry.column),
      where: placeOf(world, entry.from),
      towards: placeOf(world, entry.to),
      pressed: Boolean(entry.pressed),
      by: entry.by ? countryOn(world, entry.to, entry.by) : null,
      ratio: entry.ratio,
    });
  }

  // ---- and any government that stopped governing ---------------------------
  // The largest thing that can happen in a day, and the only entry in this
  // report that is not about a hex: one of these moves more ground in a morning
  // than a month of fighting does.
  const fell = [];
  for (const entry of game.capitulations ?? []) {
    if (entry.day !== day) continue;
    fell.push({
      country: displayName(entry.country),
      to: displayName(entry.to),
      empire: entry.empire ? displayName(entry.empire) : null,
      note: entry.note,
      metropoleCells: entry.metropoleCells,
      empireCells: entry.empireCells,
      forces: entry.forces.length,
      // Which of the three this seat is: the one that took the capital, the one
      // that inherited the empire, or a bystander who is merely being told.
      took: entry.to === seat,
      inherited: entry.empire === seat,
    });
  }

  // ---- the depots ----------------------------------------------------------
  const sent = [];
  for (const entry of game.replacements ?? []) {
    if (entry.day !== day || entry.power !== seat) continue;
    sent.push({ column: nameOf(entry.column), added: entry.added, men: entry.men, effort: entry.effort });
  }
  const refused = (game.refused ?? [])
    .filter((r) => r.day === day && r.power === seat)
    .map((r) => ({ column: nameOf(r.column), why: r.why }));

  // ---- and the arithmetic --------------------------------------------------
  const losses = difference(before, after, mine) ?? {};
  const gains = {};
  for (const entry of sent) {
    for (const [arm, n] of Object.entries(entry.added ?? {})) gains[arm] = (gains[arm] ?? 0) + n;
  }

  // "14th Army, 14th Army, 14th Army" is four detachments of one army and reads
  // like a stutter. Say it once and count it.
  for (const spot of starving) {
    const seen = new Map();
    for (const name of spot.columns) seen.set(name, (seen.get(name) ?? 0) + 1);
    spot.columns = [...seen].map(([name, n]) => (n > 1 ? `${name} ×${n}` : name));
  }

  return {
    day,
    flown,
    bombed,
    battles,
    actions,
    sunk,
    raided,
    fell,
    stopped,
    ashore,
    embarked,
    formed,
    ordered,
    advanced,
    struck,
    strafed: bombed2,
    taken,
    lost,
    starving,
    sent,
    refused,
    losses,
    gains,
    quiet:
      advanced === 0 &&
      struck.length === 0 &&
      bombed2.length === 0 &&
      battles.length === 0 &&
      formed.length === 0 &&
      ordered.length === 0 &&
      ashore.length === 0 &&
      embarked.length === 0 &&
      stopped.length === 0 &&
      fell.length === 0 &&
      actions.length === 0 &&
      sunk.length === 0 &&
      raided.length === 0 &&
      flown.length === 0 &&
      bombed.length === 0 &&
      taken.length === 0 &&
      lost.length === 0 &&
      starving.length === 0 &&
      sent.length === 0 &&
      refused.length === 0,
  };
}
