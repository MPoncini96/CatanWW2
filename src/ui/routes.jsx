import { useEffect, useState } from 'react';
import { PLAYER_IDS } from '../game/players.js';

// Eight pages, one per power, and an index at the root.
//
// There is no router library here and there does not need to be: the whole
// route space is nine strings. `history.pushState` moves between them, one
// event tells the app it happened, and the server already answers any unknown
// path with index.html, so a reload of /germany lands back on Germany.

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
};

/** The power a path names, or null for the index. */
export function powerFromPath(pathname) {
  const slug = pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
  if (!slug) return null;
  const id = ALIASES[slug] ?? slug;
  return PLAYER_IDS.includes(id) ? id : null;
}

/** Where a power's page lives. */
export function pathOf(power) {
  return `/${power}`;
}

const CHANGED = 'terra:navigate';

/** Go to a path without reloading the page. */
export function navigate(href) {
  if (window.location.pathname === href) return;
  window.history.pushState({}, '', href);
  window.dispatchEvent(new Event(CHANGED));
}

/** The current path, following the back button as well as our own links. */
export function useRoute() {
  const [path, setPath] = useState(() => window.location.pathname);
  useEffect(() => {
    const sync = () => setPath(window.location.pathname);
    window.addEventListener('popstate', sync);
    window.addEventListener(CHANGED, sync);
    return () => {
      window.removeEventListener('popstate', sync);
      window.removeEventListener(CHANGED, sync);
    };
  }, []);
  return path;
}

/** A link that navigates without a round trip, but is still a real link. */
export function Link({ href, className, children, ...rest }) {
  return (
    <a
      href={href}
      className={className}
      onClick={(event) => {
        // Leave the modified clicks alone: a middle click or a ctrl-click means
        // "open this somewhere else", and that is the browser's business.
        if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey) return;
        if (event.button !== 0) return;
        event.preventDefault();
        navigate(href);
      }}
      {...rest}
    >
      {children}
    </a>
  );
}
