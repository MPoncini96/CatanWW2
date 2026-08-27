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
/** How long this day has left, in words a player can act on. */
function untilClose(at) {
  const left = at - Date.now();
  if (left <= 0) return 'The day is closing on its own.';
  const hours = Math.floor(left / 3600000);
  const minutes = Math.floor((left % 3600000) / 60000);
  if (hours >= 1) return `Turns on its own in ${hours}h ${minutes}m, ready or not.`;
  return `Turns on its own in ${minutes}m, ready or not.`;
}

export function WarRoom({ power, state, onReady, onClaim, onLeave, busy, error }) {
  const [name, setName] = useState('');
  const player = BY_ID[power];
  if (!player) return null;

  const seat = state?.seats.find((s) => s.power === power) ?? null;
  const mine = seat?.isYou ?? false;
  const voting = (state?.seats ?? []).filter((s) => s.taken && s.votes);
  const waiting = state?.waitingOn ?? [];
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

      {mine && seat.votes && (
        <>
          <button
            type="button"
            className={`war__end${seat.ready ? ' is-done' : ''}`}
            disabled={busy}
            onClick={() => onReady(!seat.ready)}
          >
            {seat.ready ? 'Waiting — take it back' : 'End Current Day'}
          </button>
          <p className="war__waiting">
            {seat.ready
              ? waiting.length
                ? `Waiting on ${waiting.map((id) => BY_ID[id].name).join(', ')}`
                : 'Turning the day…'
              : `${voting.length - waiting.length} of ${voting.length} ready`}
          </p>
          {/* And when it turns anyway. A day that only ends when everybody has
              said so ends when the slowest player wakes up; this is the hour
              at which the war stops waiting. */}
          {state?.closesAt && <p className="war__clock">{untilClose(state.closesAt)}</p>}
          {!seat.inTheWar && (
            <p className="war__note">
              Nobody at this table is in the war yet, so the pace is yours until somebody is.
            </p>
          )}
        </>
      )}

      {mine && !seat.votes && (
        <div className="war__watching">
          <strong>View only</strong>
          <p>
            {player.name} has nobody it may fight, so it takes no turns:{' '}
            {seat.entersOn === null
              ? 'no event on the timeline brings it into the war.'
              : `it enters the war on ${formatDateShort(seat.entersOn)}, in ${
                  seat.entersOn - state.day
                } ${seat.entersOn - state.day === 1 ? 'day' : 'days'}.`}{' '}
            The calendar turns without it.
          </p>
          {waiting.length > 0 && (
            <p className="war__waiting">
              Waiting on {waiting.map((id) => BY_ID[id].name).join(', ')}
            </p>
          )}
        </div>
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
