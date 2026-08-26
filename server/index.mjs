import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as G from '../src/game/state.js';
import { buildWorld } from '../src/world/earth.js';
import { TILE_COUNT } from '../src/world/sphere.js';
import { arrivalsAt, mayMarch, positionsAt } from '../src/game/movement.js';
import { mayRaid } from '../src/game/bombing.js';
import { fleetsAt, fleetsOf, mayShip } from '../src/game/naval.js';

// The one game.
//
// There is deliberately no game list, no lobby and no matchmaking: this server
// holds a single game of HexWW2.world and hands it to whoever turns up. That
// is the whole scope for now, and it keeps the state small enough to hold in
// memory and write out as one JSON file.
//
// What it does not hold is the map. The world is deterministic — the same
// earth.bin and the same code give the same 114,492 cells every time — so the
// board never crosses the wire. Only what has actually changed does: the date,
// who is sitting where, who has finished today, and what the timeline has said.

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SAVE = path.join(HERE, 'game.json');
const DIST = path.join(HERE, '..', 'dist');
const PORT = Number(process.env.PORT) || 5170;
// How long a day stays open before it turns without everybody. A day by
// default; set HEXWW2_DAY_HOURS to something small to play a fast game, or to
// watch the clock work without waiting until tomorrow.
const DAY_MS = process.env.HEXWW2_DAY_HOURS
  ? Number(process.env.HEXWW2_DAY_HOURS) * 3600000
  : G.DAY_LENGTH_MS;

// --------------------------------------------------------------- the board
//
// The server builds the world too. It costs a second at startup and it is the
// same code the browser runs, so the two cannot disagree — which starts to
// matter the moment orders arrive, because whether a column may march
// somewhere is a question about terrain and ownership, and the browser is not
// where a rule is enforced.

const world = (() => {
  const bin = fs.readFileSync(path.join(HERE, '..', 'src', 'world', 'earth.bin'));
  return buildWorld(
    bin.subarray(0, TILE_COUNT),
    bin.subarray(TILE_COUNT, TILE_COUNT * 2),
    bin.subarray(TILE_COUNT * 2, TILE_COUNT * 3),
  );
})();

// --------------------------------------------------------------- the game

let game = load();
// Put the armies where the record says they are and the ground where it says
// it went, in case this is a resumed game.
for (const capture of game.captures ?? []) world.ownership.set(capture.cell, capture.to, capture);
world.march(game.moves ?? [], game.day, game.battles ?? [], game.replacements ?? []);

function load() {
  if (fs.existsSync(SAVE)) {
    try {
      const saved = JSON.parse(fs.readFileSync(SAVE, 'utf8'));
      // A game saved before the armies could move has neither field. Fill them
      // in rather than refusing to load: the opening deployment with no marches
      // against it is exactly what that game was.
      saved.orders ??= {};
      saved.moves ??= [];
      saved.battles ??= [];
      saved.captures ??= [];
      saved.replacements ??= [];
      saved.raids ??= [];
      saved.refused ??= [];
      // A game saved before the clock existed reopens its day now rather than
      // finding itself a year overdue and turning eight hundred times.
      saved.opened ||= Date.now();
      saved.raiding ??= {};
      saved.rebuilding ??= {};
      // A game saved before there was a war at sea has fleets that have never
      // moved, been in action or lost a convoy, which is exactly what an empty
      // record means. Nothing else has to be done to it.
      saved.sailing ??= {};
      saved.sailings ??= [];
      saved.seaBattles ??= [];
      saved.sinkings ??= [];
      console.log(`resumed a game on day ${saved.day} (${saved.log.length} events so far)`);
      return saved;
    } catch (err) {
      console.error(`could not read ${SAVE}: ${err.message} — starting a new game`);
    }
  }
  const fresh = G.newGame();
  fresh.opened = Date.now();
  G.openingEvents(fresh);
  console.log('started a new game on 1 September 1939');
  return fresh;
}

function save() {
  fs.writeFileSync(SAVE, JSON.stringify(game, null, 2));
}

// ------------------------------------------------------------ subscribers

const listeners = new Set();

/** Push the new state to everyone watching, each seeing only their own view. */
function broadcast() {
  save();
  for (const listener of listeners) {
    const view = G.publicState(game, G.seatOf(game, listener.token), DAY_MS);
    listener.res.write(`data: ${JSON.stringify(view)}\n\n`);
  }
}

// ----------------------------------------------------------------- routes

/**
 * The seat token, from the Authorization header — or from the query string,
 * because EventSource cannot send headers and the live stream needs to know
 * who is watching in order to mark their own seat.
 */
function tokenFrom(req, url) {
  const header = req.headers.authorization ?? '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  return url.searchParams.get('t') || null;
}

function json(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json',
    'cache-control': 'no-store',
  });
  res.end(text);
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return {};
  }
}

async function api(req, res, url) {
  const token = tokenFrom(req, url);
  const seat = G.seatOf(game, token);

  if (url.pathname === '/api/state' && req.method === 'GET') {
    return json(res, 200, G.publicState(game, seat, DAY_MS));
  }

  if (url.pathname === '/api/claim' && req.method === 'POST') {
    const { power, name } = await readBody(req);
    // Already sitting somewhere? Give the seat back rather than refusing, so a
    // refreshed tab does not lock its own player out.
    if (seat) return json(res, 200, { token, power: seat });
    const fresh = crypto.randomUUID();
    const result = G.claim(game, power, fresh, name);
    if (result.error) return json(res, 409, result);
    broadcast();
    return json(res, 200, { token: fresh, power });
  }

  if (url.pathname === '/api/logout' && req.method === 'POST') {
    if (!seat) return json(res, 200, {});
    G.release(game, seat);
    maybeAdvance();
    broadcast();
    return json(res, 200, {});
  }

  if (url.pathname === '/api/ready' && req.method === 'POST') {
    if (!seat) return json(res, 401, { error: 'take a seat first' });
    const { ready } = await readBody(req);
    // A seat the timeline has not let into the war yet cannot end the day. The
    // client hides the button, but the rule lives here: the browser is not
    // where a rule is enforced.
    const result = G.setReady(game, seat, ready !== false);
    if (result.error) return json(res, 409, result);
    maybeAdvance();
    broadcast();
    return json(res, 200, G.publicState(game, seat, DAY_MS));
  }

  if (url.pathname === '/api/orders' && req.method === 'POST') {
    if (!seat) return json(res, 401, { error: 'take a seat first' });
    const { orders, rebuilding, raiding, sailing } = await readBody(req);
    if (!Array.isArray(orders)) return json(res, 400, { error: 'orders must be a list' });
    if (orders.length > 400) return json(res, 400, { error: 'too many orders for one day' });
    if (rebuilding !== undefined && !Array.isArray(rebuilding)) {
      return json(res, 400, { error: 'rebuilding must be a list of columns' });
    }
    if ((rebuilding?.length ?? 0) > 400) {
      return json(res, 400, { error: 'too many columns to rebuild in one day' });
    }
    if (raiding !== undefined && !Array.isArray(raiding)) {
      return json(res, 400, { error: 'raiding must be a list of missions' });
    }
    if ((raiding?.length ?? 0) > 100) {
      return json(res, 400, { error: 'too many raids for one night' });
    }
    if (sailing !== undefined && !Array.isArray(sailing)) {
      return json(res, 400, { error: 'sailing must be a list of fleets' });
    }
    if ((sailing?.length ?? 0) > 100) {
      return json(res, 400, { error: 'too many fleets to sail in one day' });
    }

    // Checked here and not only in the browser. Each order is checked against
    // the board as it stands *and* against the ones already accepted in the
    // same message, so a list cannot quietly order one column twice.
    const columns = new Map(world.garrisons.opening.map((p) => [p.id, p]));
    const positions = positionsAt(world.garrisons.opening, game.moves, game.day);
    const arrivals = arrivalsAt(game.moves, game.day);
    const taken = new Set();
    const accepted = [];
    for (const order of orders) {
      const column = columns.get(order?.column);
      const why = mayMarch({
        world,
        column,
        to: order?.to,
        power: seat,
        day: game.day,
        positions,
        arrivals,
        ordered: taken,
      });
      if (why) return json(res, 409, { error: why, column: order?.column });
      taken.add(column.id);
      accepted.push({ column: column.id, from: positions.get(column.id), to: order.to });
    }

    // Which columns want replacements is not checked here beyond being this
    // seat's own: whether they can be paid for depends on what the day does to
    // the stores, so it is settled when the day turns and not before.
    const rebuild = (rebuilding ?? []).filter((id) => {
      const column = columns.get(id);
      return column && column.formation.nation === seat;
    });
    // Raids are checked here, because whether a target is in range and at war
    // is a fact about the board and the browser is not where a rule is kept.
    const flights = [];
    const flying = new Set();
    for (const mission of raiding ?? []) {
      const column = columns.get(mission?.column);
      const why = mayRaid({
        world,
        column,
        target: mission?.target,
        power: seat,
        day: game.day,
        positions,
        raids: game.raids,
        ordered: flying,
      });
      if (why) return json(res, 409, { error: why, column: mission?.column });
      flying.add(column.id);
      flights.push({ column: column.id, target: mission.target });
    }

    // And the fleets, checked the same way and for the same reason: how far a
    // ship goes in a day is a rule, and a rule that only the browser knows is
    // not a rule.
    const fleets = new Map(fleetsOf(world).map((f) => [f.id, f]));
    const afloat = fleetsAt(world, game, game.day);
    const anchored = new Map(afloat.map((f) => [f.id, f.cell]));
    const weighed = new Set();
    const sails = [];
    for (const order of sailing ?? []) {
      const why = mayShip({
        world,
        fleet: fleets.get(order?.fleet),
        to: order?.to,
        power: seat,
        day: game.day,
        positions: anchored,
        ordered: weighed,
      });
      if (why) return json(res, 409, { error: why, fleet: order?.fleet });
      weighed.add(order.fleet);
      sails.push({ fleet: order.fleet, to: order.to });
    }

    G.setOrders(game, seat, accepted, rebuild, flights, sails);
    broadcast();
    return json(res, 200, G.publicState(game, seat, DAY_MS));
  }

  if (url.pathname === '/api/stream' && req.method === 'GET') {
    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    });
    const listener = { res, token };
    listeners.add(listener);
    res.write(`data: ${JSON.stringify(G.publicState(game, seat, DAY_MS))}\n\n`);
    // Keep proxies from closing an idle stream.
    const beat = setInterval(() => res.write(': beat\n\n'), 25000);
    req.on('close', () => {
      clearInterval(beat);
      listeners.delete(listener);
    });
    return undefined;
  }

  return json(res, 404, { error: 'no such endpoint' });
}

/**
 * Move the calendar on if everyone at the table has said so.
 *
 * There is no clock: a day lasts exactly as long as the slowest player wants it
 * to. That was a deliberate choice — the waiting is part of the game.
 */
function maybeAdvance() {
  // Either everybody has finished, or the day has run out of hours. The second
  // is what makes eight seats across as many time zones playable at all.
  const forced = G.overdue(game, Date.now(), DAY_MS);
  if (!G.readyToAdvance(game) && !forced) return;
  if (forced) {
    const waiting = G.publicState(game, null, DAY_MS).waitingOn;
    if (waiting.length) console.log(`    the day ran out; ${waiting.join(', ')} gave no orders`);
  }
  const before = { moves: game.moves.length, battles: game.battles.length };
  // The world goes in, because the day is not only a date: the marches happen
  // on it, the fights happen on it, and the ground changes hands on it.
  const fired = G.advance(game, world, Date.now());
  world.march(game.moves, game.day, game.battles, game.replacements);
  const marched = game.moves.length - before.moves;
  const fought = game.battles.length - before.battles;
  const when = G.publicState(game, null, DAY_MS).date;
  if (marched) console.log(`    ${marched} column${marched === 1 ? '' : 's'} on the move`);
  for (const battle of game.battles.slice(before.battles)) {
    console.log(
      `    battle at ${battle.cell}: ${battle.attacker} ${battle.attack} against ` +
        `${battle.defender} ${battle.defence} — ${battle.winner} holds it` +
        (battle.pocket ? ', the beaten side destroyed where it stood' : ''),
    );
  }
  const rebuilt = game.replacements.filter((r) => r.day === game.day);
  if (rebuilt.length) {
    const men = rebuilt.reduce((n, r) => n + r.men, 0);
    console.log(`    ${rebuilt.length} columns brought back up — ${men.toLocaleString()} men`);
  }
  void fought;
  if (fired.length) {
    console.log(`--> ${when}: ${fired.map((e) => e.name).join('; ')}`);
  } else {
    console.log(`--> ${when}`);
  }
}

// ----------------------------------------------------------- static files

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.bin': 'application/octet-stream',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.webp': 'image/webp',
};

function serveStatic(req, res, url) {
  if (!fs.existsSync(DIST)) {
    return json(res, 404, { error: 'nothing built yet — run npm run build' });
  }
  const wanted = url.pathname === '/' ? '/index.html' : url.pathname;
  const file = path.join(DIST, path.normalize(wanted).replace(/^(\.\.[/\\])+/, ''));
  if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    // Single page: anything unrecognised is the app itself.
    return sendFile(res, path.join(DIST, 'index.html'));
  }
  return sendFile(res, file);
}

function sendFile(res, file) {
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}

// ------------------------------------------------------------------ serve

// Nothing else would notice the day running out: every other call into
// maybeAdvance is somebody pressing a button, and the whole point of a clock is
// the case where nobody does.
setInterval(() => {
  const before = game.day;
  maybeAdvance();
  if (game.day !== before) broadcast();
}, 20_000).unref?.();

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    return serveStatic(req, res, url);
  } catch (err) {
    console.error(err);
    return json(res, 500, { error: err.message });
  }
});

server.listen(PORT, () => {
  const view = G.publicState(game, null, DAY_MS);
  console.log(`HexWW2.world on http://localhost:${PORT}  —  ${view.date}, day ${view.day}`);
});
