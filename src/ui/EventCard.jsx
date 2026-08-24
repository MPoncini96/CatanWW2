import { formatDate } from '../game/calendar.js';

/**
 * What the world did today.
 *
 * Events arrive from the timeline rather than from a player, so they go in
 * front of everyone at once when the calendar lands on their date. Dismissing
 * one is per-browser: the event stays in the log for good, this only decides
 * whether it is currently in the way.
 */
export function EventCard({ event, onDismiss, remaining }) {
  if (!event) return null;
  return (
    <div className="dispatch" role="dialog" aria-modal="true">
      <div className="dispatch__card">
        <p className="dispatch__date">{formatDate(event.day)}</p>
        <h2>{event.name}</h2>
        <p className="dispatch__text">{event.text}</p>
        <button type="button" onClick={onDismiss}>
          {remaining > 1 ? `Next dispatch (${remaining - 1} more)` : 'Understood'}
        </button>
      </div>
    </div>
  );
}
