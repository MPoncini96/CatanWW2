import { useState } from 'react';
import { PLAYERS } from '../game/players.js';
import { formatDateShort } from '../game/calendar.js';
import { Link } from './routes.jsx';

const BY_ID = Object.fromEntries(PLAYERS.map((p) => [p.id, p]));

/**
 * One nation's page, in the rail: who you are, what you may do, and who the
 * table is waiting for.
 *
 * The day only turns when every player in the war says it may, so most of this
 * is a list of who everyone is still waiting for. A power the timeline has not
 * let in yet gets no button: it is watching, it is not holding anybody up, and
 * saying so plainly is better than showing a control that would be refused.
 */

export function WarRoom({ power, state, onClaim, onLeave, onStanding, busy, error }) {
  const [name, setName] = useState('');
  const player = BY_ID[power];
  if (!player) return null;

  const seat = state?.seats.find((s) => s.power === power) ?? null;
  const mine = seat?.isYou ?? false;
  const war = state?.war?.find((w) => w.power === power);
  const held = state?.seats.find((s) => s.isYou);

  return (
    <div className="war">
      <div className="war__nation">
        <span className="war__crest" style={{ background: player.color }} />
        <div>
          <h2>{player.name}</h2>
          {war && (
            <p className="war__standing">
              {war.atWar
                ? `At war · ${war.enemies.length} ${war.enemies.length === 1 ? 'party' : 'parties'}`
                : war.entersOn === null
                  ? 'Not in the war'
                  : `Enters the war ${formatDateShort(war.entersOn)}`}
            </p>
          )}
        </div>
      </div>

      {/* Taking the seat, if it is going. No password: you say who you are and
          the table believes you, exactly as it did before there were pages. */}
      {state && !mine && !seat?.taken && (
        <form
          className="war__claim"
          onSubmit={(event) => {
            event.preventDefault();
            onClaim(power, name.trim());
          }}
        >
          <label>
            <span>Your name</span>
            <input
              type="text"
              value={name}
              maxLength={24}
              placeholder="optional"
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <button type="submit" disabled={busy}>
            Take {player.name}
          </button>
          {held && (
            <p className="war__note">
              You are holding {BY_ID[held.power].name}. Taking this one is a second seat, not a
              swap.
            </p>
          )}
        </form>
      )}

      {state && !mine && seat?.taken && (
        <p className="war__note">
          {seat.name ? `${seat.name} is playing ${player.name}.` : 'This seat is taken.'} You are
          looking over their shoulder — and seeing what they see, which is not what the other side
          sees.
        </p>
      )}

      <ul className="war__seats">
        {(state?.seats ?? []).map((row) => {
          const other = BY_ID[row.power];
          return (
            <li
              key={row.power}
              className={
                (row.taken ? 'is-taken' : 'is-empty') +
                (row.ready ? ' is-ready' : '') +
                (row.inTheWar ? '' : ' is-watching') +
                (row.power === power ? ' is-you' : '')
              }
            >
              <i style={{ background: other.color }} />
              <Link className="war__seatName" href={`/${row.power}`}>
                {other.name}
              </Link>
              <em>
                {!row.taken
                  ? 'empty'
                  : !row.votes
                    ? 'watching'
                    : row.ready
                      ? 'ready'
                      : row.name
                        ? row.name
                        : 'thinking'}
              </em>
            </li>
          );
        })}
      </ul>

      {/* The button that ends the day is not here. It is pinned to the foot of
          the rail by `EndDay`, because it is the one control that must never be
          scrolled away from — and this panel is long. */}
      {mine && (
        <>
          {!seat.inTheWar && (
            <p className="war__note">
              {player.name} is not in the war yet
              {seat.entersOn === null
                ? ' and no event on the timeline brings it in'
                : `, and enters on ${formatDateShort(seat.entersOn)} — in ${
                    seat.entersOn - state.day
                  } ${seat.entersOn - state.day === 1 ? 'day' : 'days'}`}
              . It may still march on its own ground, raise formations and put to sea.
            </p>
          )}
          {/* The one setting on this panel, and it is here because it is about
              what the day does rather than about any one hex. An army with
              nothing better to do walks towards the nearest enemy and stops
              when it gets there; anything you have ordered this morning is
              what that column does instead. */}
          <label className="war__standing">
            <input
              type="checkbox"
              checked={state?.standing !== false}
              disabled={busy}
              onChange={(e) => onStanding?.(e.target.checked)}
            />
            <span>
              Advance to the front
              <em>Idle divisions walk towards the fighting and stop at the line.</em>
            </span>
          </label>

        </>
      )}

      {error && <p className="war__error">{error}</p>}

      {state?.next && (
        <p className="war__next">
          Next: {state.next.name} · {formatDateShort(state.next.day)}
        </p>
      )}

      <p className="war__links">
        <Link href="/">All nations</Link>
        {mine && (
          <>
            {' · '}
            <button type="button" className="war__leave" onClick={onLeave}>
              Give up the seat
            </button>
          </>
        )}
      </p>
    </div>
  );
}
