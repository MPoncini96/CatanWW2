import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as G from '../src/game/state.js';

// The one game.
//
// There is deliberately no game list, no lobby and no matchmaking: this server
// holds a single game of Terra and hands it to whoever turns up. That is the
// whole scope for now, and it keeps the state small enough to keep in memory
// and write out as one JSON file.
//
// What it does not hold is the map. The world is deterministic — the same
// earth.bin and the same code give the same 114,492 cells every time — so the
// board never crosses the wire. Only what has actually changed does: the date,
// who is sitting where, who has finished today, and what the timeline has said.

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SAVE = path.join(HERE, 'game.json');
const DIST = path.join(HERE, '..', 'dist');
const PORT = Number(process.env.PORT) || 5170;

// --------------------------------------------------------------- the game

let game = load();

function load() {
  if (fs.existsSync(SAVE)) {
    try {
      const saved = JSON.parse(fs.readFileSync(SAVE, 'utf8'));
      console.log(`resumed a game on day ${saved.day} (${saved.log.length} events so far)`);
      return saved;
    } catch (err) {
      console.error(`could not read ${SAVE}: ${err.message} — starting a new game`);
    }
  }
  const fresh = G.newGame();
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
    const view = G.publicState(game, G.seatOf(game, listener.token));
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
    return json(res, 200, G.publicState(game, seat));
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
    return json(res, 200, G.publicState(game, seat));
  }

  if (url.pathname === '/api/stream' && req.method === 'GET') {
    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    });
    const listener = { res, token };
    listeners.add(listener);
    res.write(`data: ${JSON.stringify(G.publicState(game, seat))}\n\n`);
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
  if (!G.readyToAdvance(game)) return;
  const fired = G.advance(game);
  const when = G.publicState(game, null).date;
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
  const view = G.publicState(game, null);
  console.log(`Terra on http://localhost:${PORT}  —  ${view.date}, day ${view.day}`);
});
