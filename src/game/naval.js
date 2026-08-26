import { TERRAIN } from '../world/terrain.js';
import { NATION_INDEX, SEA } from '../world/nations.js';
import { grid, neighbours } from '../world/sphere.js';
import { SHIPS } from '../world/navies.js';
import { RELIEF_DAYS, convoyCell } from '../world/convoys.js';
import { hexesApart } from './bombing.js';
import { atWar } from './movement.js';

// The war at sea.
//
// Ships have been on this board since the fleets were placed and have done
// nothing at all: they sat at sixty-five anchorages, could not move, could not
// fight, and could not be lost. Everything else has grown around them.
//
// ------------------------------------------------------------ how they move
//
// Like a column, in that an order names a destination and the day carries it
// out. Unlike a column in the one way that matters: **a ship steams through the
// night.** An army marches for eight hours and sleeps; a fleet does not, which
// is why it goes six hexes a day and a division goes half of one. Six hexes is
// four hundred kilometres, which is eighteen knots held for twenty-four hours —
// a fleet passage rather than a flat-out dash.
//
// There is no rest day for the same reason. What a fleet needs instead is fuel,
// and fuel comes from a port; that is a rule for another day and is noted where
// it would go.

/** Hexes a fighting fleet makes in a day. Six is about eighteen knots. */
export const FLEET_SPEED = 6;

/** And a convoy, which goes at the speed of its slowest tramp steamer. */
export const CONVOY_SPEED = 4;

/**
 * What each kind of ship is worth, attacking and defending.
 *
 * The spread between the two columns is the whole character of the type. A
 * **carrier** strikes from beyond the horizon and is a floating hangar if
 * anything reaches it — 120 to strike with and 30 to survive with. A
 * **submarine** is the same bargain drawn harder: it is the most dangerous
 * thing in the water while it is unseen and nearly helpless once it is not.
 * A **battleship** is the only type that is as good at one as the other, which
 * is what people meant by a capital ship.
 */
export const NAVAL = {
  battleships: { attack: 100, defend: 100 },
  carriers: { attack: 120, defend: 30 },
  cruisers: { attack: 45, defend: 45 },
  destroyers: { attack: 25, defend: 32 },
  submarines: { attack: 85, defend: 15 },
};

/**
 * And what each is worth *against a particular kind of ship*.
 *
 * This is where the rock-paper-scissors of a naval war lives, and every entry
 * is something that actually happened. A submarine against a capital ship is
 * the *Royal Oak* at Scapa Flow and the *Courageous* in the Western Approaches,
 * both inside the first month. A destroyer against a submarine is the answer to
 * it, and the reason a convoy escort was destroyers and nothing else. A
 * submarine against a destroyer is a bad afternoon for the submarine.
 *
 * And a submarine hunting another submarine is the worst duel in the war for
 * whoever is doing the hunting: the boat lying quiet hears the boat under way,
 * which is why a defending submarine is worth four times its own attack.
 */
export const COUNTERS = {
  submarines: { battleships: 2.2, carriers: 2.4, cruisers: 1.8, destroyers: 0.3, convoys: 3, submarines: 0.5 },
  destroyers: { submarines: 3.2, battleships: 0.4, carriers: 0.8, convoys: 1 },
  carriers: { battleships: 1.5, cruisers: 1.6, destroyers: 1.4, submarines: 1.2, convoys: 1.6 },
  battleships: { cruisers: 1.5, destroyers: 1.6, carriers: 1.3, submarines: 0.5, convoys: 1.4 },
  cruisers: { destroyers: 1.3, convoys: 1.5, submarines: 0.7, battleships: 0.6 },
};

/**
 * A submarine lying in wait is a different animal from one on the hunt.
 *
 * Large, because it has to overcome the attacking boat's own bonus to come out
 * the right way round: a submarine on the hunt is worth 85 and the one it is
 * hunting is worth 15, and if the quiet boat did not get most of an order of
 * magnitude for lying still, the duel would go to whoever moved first. It
 * should go to whoever moved second, which is the entire reason submarines
 * spent the war creeping.
 */
export const DEFENDING_SUBMARINE_VS_SUBMARINE = 8;

/** How much of a beaten fleet goes down in a day, before the odds are applied. */
const BASE_LOSS = 0.12;
const LEAST_LOSS = 0.02;
const WORST_LOSS = 0.4;

/**
 * What a battleship's guns are worth to a land battle beside them.
 *
 * A fifteen-inch broadside onto a beach was worth a great deal and was never
 * worth as much as the navy said it was. A battleship counts for about two
 * thousand men, a cruiser for six hundred — enough to decide a close fight on a
 * coast and never enough to take an inland one, which is what shore bombardment
 * was for and the limit of what it did.
 */
export const BOMBARDMENT = { battleships: 2000, cruisers: 600, destroyers: 120 };

/** Is this hex water a ship can be on? */
export function navigable(world, cell) {
  return world.ownership.owner[cell] === SEA && TERRAIN[world.biome[cell]].water;
}

/** What a fleet is worth, attacking or defending, against what is in front of it. */
export function fleetStrength(ships, mode, against = null) {
  let total = 0;
  for (const ship of SHIPS) {
    const n = ships?.[ship.id] ?? 0;
    if (!n) continue;
    let worth = NAVAL[ship.id][mode];
    if (against) {
      // Weighted by what the other side actually consists of, so a destroyer
      // screen is worth what it is worth against the boats in front of it and
      // not against the idea of a submarine.
      let hulls = 0;
      let matched = 0;
      for (const other of SHIPS) {
        const m = against[other.id] ?? 0;
        if (!m) continue;
        hulls += m;
        matched += m * (COUNTERS[ship.id]?.[other.id] ?? 1);
      }
      if (hulls) worth *= matched / hulls;
      if (mode === 'defend' && ship.id === 'submarines' && (against.submarines ?? 0) > 0) {
        worth *= DEFENDING_SUBMARINE_VS_SUBMARINE;
      }
    }
    total += n * worth;
  }
  return total;
}

/** Two rolls for an action at sea, the same on every machine that asks. */
export function seaLuck(day, cell) {
  const mix = (n) => {
    let h = Math.imul(n ^ 0x6b43a9b5, 0x2545f491);
    h ^= h >>> 15;
    h = Math.imul(h, 0x45d9f3b);
    h ^= h >>> 13;
    return (h >>> 0) / 4294967296;
  };
  const seed = Math.imul(day + 3, 0x9e3779b9) ^ Math.imul(cell + 7, 0x85ebca6b);
  return [0.8 + mix(seed) * 0.4, 0.8 + mix(seed ^ 0x27d4eb2d) * 0.4];
}

/**
 * May this seat send this fleet there?
 *
 * Returns null if it may, or the sentence saying why not.
 */
export function mayShip({ world, fleet, to, power, day, positions, ordered }) {
  if (!power) return 'Nobody is sitting at this seat.';
  if (!fleet) return 'No fleet is selected.';
  if (fleet.power !== power) return `${fleet.name} is not yours to order.`;
  if (fleet.cargo) return `${fleet.name} sails to a schedule, not to orders.`;
  if (ordered?.has(fleet.id)) return 'Already under orders for tomorrow.';

  const from = positions?.get(fleet.id) ?? fleet.cell;
  if (from === to) return 'It is already there.';
  if (!navigable(world, to)) return 'There is no water there.';

  const away = hexesApart(from, to);
  if (away > FLEET_SPEED) {
    return `${Math.round(away)} hexes — a fleet makes ${FLEET_SPEED} in a day.`;
  }
  return null;
}

/**
 * Fight every stretch of water two hostile fleets are sitting on.
 *
 * The shape is the land battle's, deliberately: whoever arrived is attacking,
 * both sides lose, and the beaten one leaves. What is different is that the sea
 * cannot be held — nobody captures a hex of water — so a beaten fleet simply
 * withdraws towards its own coast and the winner is left with the sea room,
 * which is all anybody ever won at sea.
 */
export function resolveSea({ world, day, positions, fleets, arrivedToday }) {
  const battles = [];
  const onCell = new Map();
  for (const fleet of fleets) {
    if (fleet.sunkUntil > day) continue;
    const cell = positions.get(fleet.id) ?? fleet.cell;
    if (!onCell.has(cell)) onCell.set(cell, []);
    onCell.get(cell).push(fleet);
  }

  for (const [cell, here] of [...onCell].sort((a, b) => a[0] - b[0])) {
    const sides = new Map();
    for (const fleet of here) {
      if (!sides.has(fleet.power)) sides.set(fleet.power, []);
      sides.get(fleet.power).push(fleet);
    }
    if (sides.size < 2) continue;

    const names = [...sides.keys()];
    let pair = null;
    for (let a = 0; a < names.length && !pair; a += 1) {
      for (let b = a + 1; b < names.length && !pair; b += 1) {
        if (atWar(day, names[a], names[b], world, cell)) pair = [names[a], names[b]];
      }
    }
    if (!pair) continue;

    const cameToday = (power) => sides.get(power).some((f) => arrivedToday?.has(f.id));
    const attacker = pair.find((p) => cameToday(p)) ?? pair[0];
    const defender = pair.find((p) => p !== attacker);

    const sum = (list) => {
      const out = Object.fromEntries(SHIPS.map((s) => [s.id, 0]));
      out.convoys = 0;
      for (const f of list) {
        for (const s of SHIPS) out[s.id] += f.ships?.[s.id] ?? 0;
        if (f.cargo) out.convoys += 1;
      }
      return out;
    };
    const ours = sum(sides.get(attacker));
    const theirs = sum(sides.get(defender));

    const [luckA, luckD] = seaLuck(day, cell);
    const attack = fleetStrength(ours, 'attack', theirs) * luckA;
    const defence = fleetStrength(theirs, 'defend', ours) * luckD;
    const attackerWins = attack > defence;
    const ratio = attackerWins ? attack / Math.max(1, defence) : defence / Math.max(1, attack);

    const loserShare = Math.min(WORST_LOSS, Math.max(LEAST_LOSS, BASE_LOSS * ratio));
    const winnerShare = Math.min(WORST_LOSS, Math.max(LEAST_LOSS, BASE_LOSS / ratio));

    battles.push({
      day,
      cell,
      attacker,
      defender,
      winner: attackerWins ? 'attacker' : 'defender',
      attack: Math.round(attack),
      defence: Math.round(defence),
      loserShare,
      winnerShare,
      losers: (attackerWins ? sides.get(defender) : sides.get(attacker)).map((f) => f.id),
      winners: (attackerWins ? sides.get(attacker) : sides.get(defender)).map((f) => f.id),
    });
  }
  return battles;
}

/**
 * What the guns offshore add to a fight on the beach.
 *
 * Only from a fleet that is not itself in action: a battleship engaged with
 * another battleship is not shelling anybody's trenches. And only one hex —
 * a fifteen-inch gun reached about twenty miles and a hex is forty-two.
 */
export function bombardmentFor({ world, cell, nation, fleets, positions, engaged, day }) {
  let guns = 0;
  const ships = [];
  for (const fleet of fleets) {
    if (fleet.power !== nation || fleet.cargo) continue;
    if (fleet.sunkUntil > day) continue;
    const at = positions.get(fleet.id) ?? fleet.cell;
    if (engaged?.has(at)) continue;
    if (hexesApart(at, cell) > 1.4) continue;
    let some = 0;
    for (const [id, worth] of Object.entries(BOMBARDMENT)) {
      some += (fleet.ships?.[id] ?? 0) * worth;
    }
    if (some > 0) {
      guns += some;
      ships.push(fleet.name);
    }
  }
  return { guns, ships };
}

/** Is this water up against a coast of your own — somewhere to run to? */
export function friendlyCoast(world, cell, nation) {
  const owner = world.ownership.owner;
  const seat = NATION_INDEX[nation];
  for (const j of neighbours(cell)) if (owner[j] === seat) return true;
  return false;
}

// --------------------------------------------------------------- the replay
//
// Where a fleet is and what is left of it are the same kind of question the
// board already answers about an army, and they get the same kind of answer:
// nothing is stored twice. A station's position is its opening anchorage plus
// every sailing since; its strength is its opening establishment less every
// action it has been in. A convoy needs neither, because it keeps a schedule —
// its position on any day is a function of the day.

/** Every fleet on the board: the fighting ones and the trade. */
export function fleetsOf(world) {
  return [...(world.navies?.stations ?? []), ...(world.convoys ?? [])];
}

/** Where each fleet is on the morning of `day`. */
export function fleetPositionsAt(world, sailings, day) {
  const at = new Map();
  for (const fleet of world.navies?.stations ?? []) at.set(fleet.id, fleet.cell);
  for (const sail of sailings ?? []) {
    if (sail.day > day) continue;
    at.set(sail.fleet, sail.to);
  }
  for (const convoy of world.convoys ?? []) {
    at.set(convoy.id, convoyCell(convoy, day, CONVOY_SPEED));
  }
  return at;
}

/** And what each has left, after everything it has been in. */
export function fleetShipsAt(world, seaBattles, day) {
  const left = new Map();
  for (const fleet of fleetsOf(world)) left.set(fleet.id, { ...fleet.ships });
  for (const battle of seaBattles ?? []) {
    if (battle.day > day) continue;
    const take = (ids, share) => {
      for (const id of ids) {
        const have = left.get(id);
        if (!have) continue;
        for (const ship of SHIPS) {
          if (have[ship.id]) have[ship.id] = Math.max(0, have[ship.id] * (1 - share));
        }
      }
    };
    take(battle.losers, battle.loserShare);
    take(battle.winners, battle.winnerShare);
  }
  return left;
}

/** Which lanes are shut on a given day, and until when. */
export function lanesOut(sinkings, day) {
  const out = new Map();
  for (const sunk of sinkings ?? []) {
    const until = sunk.until ?? sunk.day + RELIEF_DAYS;
    if (day >= sunk.day && day < until) out.set(sunk.convoy, until);
  }
  return out;
}

/**
 * Every fleet as it stands on `day`: where, with what, and whether it is there
 * at all. This is the one call the rest of the game makes.
 */
export function fleetsAt(world, { sailings, seaBattles, sinkings }, day) {
  const at = fleetPositionsAt(world, sailings, day);
  const ships = fleetShipsAt(world, seaBattles, day);
  const shut = lanesOut(sinkings, day);
  const sphere = grid();
  const out = [];
  for (const fleet of fleetsOf(world)) {
    const hulls = ships.get(fleet.id) ?? fleet.ships;
    const total = SHIPS.reduce((sum, s) => sum + (hulls[s.id] ?? 0), 0);
    const cell = at.get(fleet.id) ?? fleet.cell;
    out.push({
      ...fleet,
      cell,
      // Recomputed rather than carried over, because the opening figures are
      // the anchorage and a fleet that has sailed is not at its anchorage. A
      // marker drawn from a stale pair of coordinates is the sort of bug that
      // looks like a rendering problem for a week.
      lat: sphere.lat[cell],
      lon: sphere.lon[cell],
      ships: hulls,
      hulls: total,
      sunkUntil: shut.get(fleet.id) ?? 0,
      afloat: total > 0.5 && !shut.has(fleet.id),
    });
  }
  return out;
}

/**
 * A day at sea, start to finish.
 *
 * Sailings first, then whoever has ended the day sharing water with somebody
 * they are at war with. A convoy whose escort is beaten is not damaged — it is
 * gone, and the lane behind it stops delivering until a new one is made up,
 * which is the only reason any of this is here.
 */
export function resolveNavalDay({ world, day, sailing = {}, sailings = [], seaBattles = [], sinkings = [] }) {
  const ordered = [];
  const arrivedToday = new Set();
  for (const [power, orders] of Object.entries(sailing)) {
    for (const order of orders ?? []) {
      const fleet = fleetsOf(world).find((f) => f.id === order.fleet);
      if (!fleet || fleet.power !== power || fleet.cargo) continue;
      const from = fleetPositionsAt(world, sailings, day - 1).get(fleet.id) ?? fleet.cell;
      if (from === order.to) continue;
      ordered.push({ day, fleet: fleet.id, power, from, to: order.to });
      arrivedToday.add(fleet.id);
    }
  }

  const after = [...sailings, ...ordered];
  const fleets = fleetsAt(world, { sailings: after, seaBattles, sinkings }, day).filter(
    (f) => f.afloat,
  );
  const positions = new Map(fleets.map((f) => [f.id, f.cell]));

  const battles = resolveSea({ world, day, positions, fleets, arrivedToday });

  // A beaten convoy is a sunk convoy. There is no such thing as a merchant
  // ship that lost the action and steamed on.
  const sunk = [];
  const byId = new Map(fleets.map((f) => [f.id, f]));
  for (const battle of battles) {
    for (const id of battle.losers) {
      const fleet = byId.get(id);
      if (!fleet?.cargo) continue;
      sunk.push({
        day,
        convoy: id,
        route: fleet.route,
        power: fleet.power,
        cell: battle.cell,
        by: battle.winner === 'attacker' ? battle.attacker : battle.defender,
        until: day + RELIEF_DAYS,
      });
    }
  }

  return { sailings: ordered, battles, sinkings: sunk };
}

/** Water a battle is being fought over, so the guns there are busy. */
export function engagedCells(battles) {
  return new Set((battles ?? []).map((b) => b.cell));
}
