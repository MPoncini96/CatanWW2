import { PLAYERS } from '../game/players.js';

const BY_ID = Object.fromEntries(PLAYERS.map((p) => [p.id, p]));

/**
 * The one control that is never out of reach.
 *
 * It used to live halfway down the rail, under the seat list and above five
 * drawers, in a column that scrolls. On a short window — or with a hex
 * selected and the dossier open across the foot of the map — it was simply
 * below the fold, and a player who had spent ten minutes giving orders had to
 * go looking for the way to say they were finished.
 *
 * So it is pinned to the bottom of the rail and it does not move. Everything
 * else in that column is reference; this is the one thing that is an action,
 * and it is the last one of the day.
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

export function EndDay({ power, state, onReady, busy }) {
  const player = BY_ID[power];
  if (!player) return null;

  const seat = state?.seats?.find((s) => s.power === power) ?? null;
  // Nobody is sitting here. The button would be refused and saying so is the
  // panel above's job, not this bar's.
  if (!seat?.isYou) return null;

  const voting = (state?.seats ?? []).filter((s) => s.taken && s.votes);
  const waiting = state?.waitingOn ?? [];

  return (
    <div className="endday">
      {/* Everybody with a seat gets this, whether or not their vote is one of
          the ones the day is waiting on. It used to be hidden from any power
          not yet in the war, on the reasoning that such a power takes no
          turns. That was true when it was written and is not any more: a
          neutral can march inside its own borders, raise divisions, sail
          fleets and load them. */}
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
          said so ends when the slowest player wakes up; this is the hour at
          which the war stops waiting. */}
      {state?.closesAt && <p className="war__clock">{untilClose(state.closesAt)}</p>}
    </div>
  );
}
