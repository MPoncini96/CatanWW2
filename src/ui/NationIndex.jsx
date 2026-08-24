import { PLAYERS } from '../game/players.js';
import { formatDate, formatDateShort } from '../game/calendar.js';
import { Link, pathOf } from './routes.jsx';

/**
 * The front door: eight nations, eight pages.
 *
 * Which nation you are is the address you are at, not a modal you dismissed —
 * so a player can be sent a link, keep a tab open on it, and reload without
 * having to say who they are again.
 */
export function NationIndex({ state }) {
  const seats = new Map((state?.seats ?? []).map((s) => [s.power, s]));

  return (
    <div className="index">
      <div className="index__inner">
        <header className="index__head">
          <span className="brand__mark" aria-hidden="true" />
          <div>
            <h1>HexWW2.world</h1>
            <p>Earth on a hex globe · one game, eight seats</p>
          </div>
          {state && (
            <div className="index__date">
              <strong>{state.date}</strong>
              <span>day {state.day}</span>
            </div>
          )}
        </header>

        <p className="index__note">
          Pick the nation you are playing. Each has a page of its own: its board, its orders, and
          what it is allowed to know. There are no passwords yet, so pick the one you agreed on.
        </p>

        <div className="index__grid">
          {PLAYERS.map((player) => {
            const seat = seats.get(player.id);
            const war = state?.war?.find((w) => w.power === player.id);
            return (
              <Link key={player.id} href={pathOf(player.id)} className="index__card">
                <span className="index__flag" style={{ background: player.color }} />
                <span className="index__name">{player.name}</span>
                <span className="index__seat">
                  {seat?.taken ? (seat.name ? `taken · ${seat.name}` : 'taken') : 'open'}
                </span>
                <span className="index__war">
                  {!war
                    ? ''
                    : war.atWar
                      ? `at war · ${war.enemies.length} ${war.enemies.length === 1 ? 'party' : 'parties'}`
                      : war.entersOn === null
                        ? 'not in the war'
                        : `watching · enters ${formatDateShort(war.entersOn)}`}
                </span>
              </Link>
            );
          })}
        </div>

        <p className="index__foot">
          The calendar opens on {formatDate(0)} and turns when every nation in the war says it may.
        </p>
      </div>
    </div>
  );
}
