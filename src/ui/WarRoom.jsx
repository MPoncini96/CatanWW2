import { PLAYERS } from '../game/players.js';
import { formatDateShort } from '../game/calendar.js';

const BY_ID = Object.fromEntries(PLAYERS.map((p) => [p.id, p]));

/**
 * The table: what day it is, who has finished with it, and the one button that
 * moves the war forward.
 *
 * The day only turns when every player in the war says it may, so this panel is
 * really a list of who everyone is still waiting for. A power the timeline has
 * not let in yet gets no button: it is watching, it is not holding anybody up,
 * and saying so plainly is better than showing a control that would be refused.
 */
export function WarRoom({ state, onReady, onLeave, onLedger, busy }) {
  if (!state) return null;
  const me = state.seats.find((s) => s.isYou);
  const voting = state.seats.filter((s) => s.taken && s.votes);
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
            : mine.entersOn === null
              ? 'Not in the war'
              : `Not yet at war · ${formatDateShort(mine.entersOn)}`}
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
                (seat.inTheWar ? '' : ' is-watching') +
                (seat.isYou ? ' is-you' : '')
              }
            >
              <i style={{ background: player.color }} />
              <span className="war__seatName">{player.name}</span>
              <em>
                {!seat.taken
                  ? 'empty'
                  : !seat.votes
                    ? 'watching'
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

      <button type="button" className="war__ledger" onClick={onLedger}>
        Who may attack whom
      </button>

      {me && me.votes && (
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
              : `${voting.length - waiting.length} of ${voting.length} ready`}
          </p>
          {!me.inTheWar && (
            <p className="war__note">
              Nobody at this table is in the war yet, so the pace is yours until somebody is.
            </p>
          )}
        </>
      )}

      {me && !me.votes && (
        <div className="war__watching">
          <strong>View only</strong>
          <p>
            {BY_ID[me.power].name} has nobody it may fight, so it takes no turns:{' '}
            {me.entersOn === null
              ? 'no event on the timeline brings it into the war.'
              : `it enters the war on ${formatDateShort(me.entersOn)}, in ${
                  me.entersOn - state.day
                } ${me.entersOn - state.day === 1 ? 'day' : 'days'}.`}{' '}
            The calendar turns without it.
          </p>
          {waiting.length > 0 && (
            <p className="war__waiting">
              Waiting on {waiting.map((id) => BY_ID[id].name).join(', ')}
            </p>
          )}
        </div>
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
