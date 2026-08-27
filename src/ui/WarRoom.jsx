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

export function WarRoom({ power, state, onReady, onClaim, onLeave, onStanding, busy, error }) {
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

      {/* Everybody with a seat gets this button, whether or not their vote is
          one of the ones the day is waiting on.

          It used to be hidden from any power not yet in the war, on the
          reasoning that such a power "takes no turns". That was true when it
          was written and is not any more: a neutral can march inside its own
          borders, raise divisions, sail fleets and load them. Hiding the
          control left a player who had just spent ten minutes giving orders
          with no way to say they were finished. */}
      {mine && (
        <>
          <button
            type="button"
            className={`war__end${seat.ready ? ' is-done' : ''}`}
            disabled={busy}
            onClick={() => onReady(!seat.ready)}
          >
            {seat.ready ? 'Waiting — take it back' : 'End Current Day'}
          </button>
          {seat.votes ? (
            <p className="war__waiting">
              {seat.ready
                ? waiting.length
                  ? `Waiting on ${waiting.map((id) => BY_ID[id].name).join(', ')}`
                  : 'Turning the day…'
                : `${voting.length - waiting.length} of ${voting.length} ready`}
            </p>
          ) : (
            // Said rather than hidden, because the alternative is a button that
            // looks like it holds up the war and does not.
            <p className="war__waiting">
              {waiting.length
                ? `The day turns when ${waiting.map((id) => BY_ID[id].name).join(', ')} ${
                    waiting.length === 1 ? 'is' : 'are'
                  } ready — it does not wait for ${player.name}.`
                : `The day does not wait for ${player.name}.`}
            </p>
          )}
          {/* And when it turns anyway. A day that only ends when everybody has
              said so ends when the slowest player wakes up; this is the hour
              at which the war stops waiting. */}
          {state?.closesAt && <p className="war__clock">{untilClose(state.closesAt)}</p>}
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
