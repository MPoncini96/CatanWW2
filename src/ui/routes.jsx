import { useEffect, useState } from 'react';

// Moving between the pages, and the one link component that does it.
//
// What a path *means* is next door in routes.js, which has no React in it so
// that the rules can be tested without a browser. This file is the part that
// needs one: the history entry, the event that tells the app it changed, and
// an anchor that is still a real anchor.

export { MASTER, isMaster, pathOf, powerFromPath } from './routes.js';

const CHANGED = 'hexww2:navigate';

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
