import { PLAYERS } from '../game/players.js';
import { formatDateShort } from '../game/calendar.js';

const BY_ID = Object.fromEntries(PLAYERS.map((p) => [p.id, p]));

/**
 * The table: what day it is, who has finished with it, and the one button that
 * moves the war forward.
 *
 * The day only turns when every player who has taken a seat says it may, so
 * this panel is really a list of who everyone is still waiting for.
 */
export function WarRoom({ state, onReady, onLeave, busy }) {
  if (!state) return null;
  const me = state.seats.find((s) => s.isYou);
  const held = state.seats.filter((s) => s.taken);
  const waiting = state.waitingOn ?? [];
  const mine = state.war?.find((w) => w.power === state.you);

  return (
    <div className="war">
      <div className="war__date">
        <strong>{state.date}</strong>
        <span>day {state.day}</span>
      </div>

      {mine && (
        <p className="war__standing">
          {mine.atWar
            ? `At war · ${mine.enemies.length} ${mine.enemies.length === 1 ? 'party' : 'parties'}`
            : 'Not yet at war'}
        </p>
      )}

      <ul className="war__seats">
        {state.seats.map((seat) => {
          const player = BY_ID[seat.power];
          return (
            <li
              key={seat.power}
              className={
                (seat.taken ? 'is-taken' : 'is-empty') +
                (seat.ready ? ' is-ready' : '') +
                (seat.isYou ? ' is-you' : '')
              }
            >
              <i style={{ background: player.color }} />
              <span className="war__seatName">{player.name}</span>
              <em>
                {!seat.taken
                  ? 'empty'
                  : seat.ready
                    ? 'ready'
                    : seat.name
                      ? seat.name
                      : 'thinking'}
              </em>
            </li>
          );
        })}
      </ul>

      {me && (
        <>
          <button
            type="button"
            className={`war__end${me.ready ? ' is-done' : ''}`}
            disabled={busy}
            onClick={() => onReady(!me.ready)}
          >
            {me.ready ? 'Waiting — take it back' : 'End Current Day'}
          </button>
          <p className="war__waiting">
            {me.ready
              ? waiting.length
                ? `Waiting on ${waiting.map((id) => BY_ID[id].name).join(', ')}`
                : 'Turning the day…'
              : `${held.length - waiting.length} of ${held.length} ready`}
          </p>
        </>
      )}

      {state.next && (
        <p className="war__next">
          Next: {state.next.name} · {formatDateShort(state.next.day)}
        </p>
      )}

      <button type="button" className="war__leave" onClick={onLeave}>
        Log out
      </button>
    </div>
  );
}
