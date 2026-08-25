import { PLAYER_IDS } from '../game/players.js';

// What the address bar means. No React and no JSX in this file on purpose: the
// path rules are the kind of thing that should be checked without a browser,
// and a test runner cannot import a .jsx. The components that use them live
// next door in routes.jsx.
//
// Eight pages, one per power, a ninth that belongs to nobody, and an index at
// the root. There is no router library and there does not need to be: the
// whole route space is ten strings, `history.pushState` moves between them,
// and the server answers any unknown path with index.html, so a reload of
// /germany lands back on Germany.

/**
 * The page that is not a seat.
 *
 * Every other page is somebody's war and shows only what that somebody may
 * know. This one is nobody's, which is what makes it useful: it is the board
 * as it actually is, for setting a game up, for arguing about a rule, and for
 * checking that the fog on the other eight pages is hiding the right things.
 */
export const MASTER = 'master';

/** Ways of writing a power that are not its id. */
const ALIASES = {
  britain: 'uk',
  'great-britain': 'uk',
  'united-kingdom': 'uk',
  england: 'uk',
  'soviet-union': 'ussr',
  soviet: 'ussr',
  russia: 'ussr',
  'united-states': 'usa',
  america: 'usa',
  us: 'usa',
  deutschland: 'germany',
  reich: 'germany',
  nippon: 'japan',
  italia: 'italy',
  chine: 'china',
  // The overseer, under the names people reach for first.
  all: MASTER,
  everything: MASTER,
  overview: MASTER,
  god: MASTER,
  referee: MASTER,
};

/** The power a path names, MASTER for the overseer, or null for the index. */
export function powerFromPath(pathname) {
  const slug = pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
  if (!slug) return null;
  const id = ALIASES[slug] ?? slug;
  if (id === MASTER) return MASTER;
  return PLAYER_IDS.includes(id) ? id : null;
}

/** Is this page the one that belongs to nobody? */
export function isMaster(power) {
  return power === MASTER;
}

/** Where a power's page lives. */
export function pathOf(power) {
  return `/${power}`;
}
