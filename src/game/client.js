// Talking to the one server.
//
// The token identifies a seat. There is no password yet, so it proves nothing —
// anyone who wanted a different nation could simply claim it. What it does do is
// put the seam in the right place: when passwords arrive, only /api/claim
// changes, and every other call already carries the identity it needs.

const KEY = 'hexww2.session';
// What the key was called when the game was called Terra. Read once, so that
// renaming the game does not strand a seat: the token is how a player proves
// the seat is theirs, and a seat nobody can prove cannot be given back.
const FORMER_KEY = 'terra.session';

export function savedSession() {
  try {
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem(FORMER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function remember(session) {
  try {
    localStorage.removeItem(FORMER_KEY);
    if (session) localStorage.setItem(KEY, JSON.stringify(session));
    else localStorage.removeItem(KEY);
  } catch {
    // A browser with storage switched off can still play, it just forgets the
    // seat on refresh.
  }
}

async function call(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(path, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data;
}

export function fetchState(token) {
  return call('/api/state', { token });
}

export async function claimSeat(power, name) {
  const session = await call('/api/claim', { method: 'POST', body: { power, name } });
  remember(session);
  return session;
}

export async function leaveSeat(token) {
  await call('/api/logout', { method: 'POST', token }).catch(() => {});
  remember(null);
}

export function setReady(token, ready) {
  return call('/api/ready', { method: 'POST', body: { ready }, token });
}

/**
 * Give this seat's marching orders for tomorrow.
 *
 * The whole day's list every time, replacing whatever was there: cancelling a
 * column is sending the list without it. The server checks every one of them
 * against its own copy of the board and refuses the lot if any is impossible,
 * so a client that has drifted cannot half-commit a day.
 */
export function setOrders(token, orders, rebuilding = [], raiding = [], sailing = []) {
  return call('/api/orders', {
    method: 'POST',
    body: { orders, rebuilding, raiding, sailing },
    token,
  });
}

/**
 * Watch the game.
 *
 * The stream carries the whole public state on every change rather than a
 * patch: it is a couple of kilobytes, and a client that reconnects after a
 * dropped connection is immediately correct instead of holding a stale patch
 * chain. The browser reconnects on its own.
 */
export function watch(token, onState) {
  const url = token ? `/api/stream?t=${encodeURIComponent(token)}` : '/api/stream';
  const source = new EventSource(url);
  source.onmessage = (event) => {
    try {
      onState(JSON.parse(event.data));
    } catch {
      // A malformed frame is not worth tearing the stream down for.
    }
  };
  return () => source.close();
}
