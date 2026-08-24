import { EVENTS_1939 } from '../game/events.js';
import { PLAYERS } from '../game/players.js';
import { formatDate, formatDateShort } from '../game/calendar.js';

// The ledger: who is at war with whom, who may attack whom, and the table the
// answers come out of.
//
// There is one mechanic on this board and this is it. Everything else — the
// people, the ore, the armies standing on the ground — is scenery until
// somebody may march, and what decides that is a date and a list of pairs.
// So the list is put in front of the players rather than left implicit in a
// count on the HUD.

const BY_ID = Object.fromEntries(PLAYERS.map((p) => [p.id, p]));

function nameOf(party) {
  return BY_ID[party]?.name ?? party;
}

/** One side of a war grant, in words. */
function describeSide(side) {
  if (side.power) return nameOf(side.power);
  if (side.country) return side.country;
  if (side.ledBy) {
    const names = side.ledBy.map(nameOf);
    const last = names.pop();
    return `${names.length ? `${names.join(', ')} and ` : ''}${last}, with their empires`;
  }
  if (side.sameAs) return `everything ${nameOf(side.sameAs)} is already fighting`;
  return '?';
}

function describeEvent(event) {
  return event.wars.map(([a, b]) => `${describeSide(a)} v ${describeSide(b)}`).join(' · ');
}

/** A power's standing today, in one phrase. */
function standing(row, day) {
  if (row.atWar) {
    return row.entersOn === day ? 'In the war, from today' : `In the war since ${formatDateShort(row.entersOn)}`;
  }
  if (row.entersOn === null) return 'Never enters — no event brings it in';
  return `Watching · enters ${formatDateShort(row.entersOn)}`;
}

export function WarLedger({ state, onClose }) {
  if (!state) return null;
  const { day } = state;

  return (
    <div className="ledger" role="dialog" aria-modal="true" aria-label="The state of the war">
      <div className="ledger__card">
        <header className="ledger__head">
          <div>
            <h2>The state of the war</h2>
            <p>
              {state.date} · day {day}
            </p>
          </div>
          <button type="button" className="ledger__close" onClick={onClose}>
            Close
          </button>
        </header>

        <div className="ledger__body">
          <h3>Who may attack whom</h3>
          <p className="ledger__note">
            A power may only move against a party it is at war with, and it only takes turns once
            it is in the war. Until then it holds a seat, sees everything, and the calendar turns
            without it.
          </p>
          <table className="ledger__table">
            <thead>
              <tr>
                <th>Power</th>
                <th>Standing</th>
                <th>May attack</th>
              </tr>
            </thead>
            <tbody>
              {state.war.map((row) => {
                const seat = state.seats.find((s) => s.power === row.power);
                // The other seven read first, then the countries. A short tail
                // is worth naming outright - Germany's whole war on 1 September
                // is one country, and hiding it behind a disclosure would be
                // absurd - while the 47 parties of the 3rd have to fold away.
                const others = row.enemies.filter((e) => !row.powers.includes(e));
                const named = others.length <= 3 ? others : [];
                const folded = others.length <= 3 ? [] : others;
                return (
                  <tr
                    key={row.power}
                    className={
                      (row.atWar ? 'is-fighting' : 'is-watching') + (seat?.isYou ? ' is-you' : '')
                    }
                  >
                    <th scope="row">
                      <i style={{ background: BY_ID[row.power].color }} />
                      {BY_ID[row.power].name}
                      {seat?.isYou && <em>you</em>}
                    </th>
                    <td>{standing(row, day)}</td>
                    <td>
                      {row.enemies.length === 0 ? (
                        <span className="ledger__none">nobody</span>
                      ) : (
                        <>
                          <span className="ledger__chips">
                            {row.powers.map((p) => (
                              <span
                                key={p}
                                className="ledger__chip"
                                style={{ borderColor: BY_ID[p].color }}
                              >
                                {BY_ID[p].name}
                              </span>
                            ))}
                            {named.map((c) => (
                              <span key={c} className="ledger__chip ledger__chip--country">
                                {c}
                              </span>
                            ))}
                          </span>
                          {folded.length > 0 && (
                            <details className="ledger__more">
                              <summary>
                                and {folded.length} {folded.length === 1 ? 'country' : 'countries'}
                              </summary>
                              <p>{folded.join(' · ')}</p>
                            </details>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <h3>The timeline</h3>
          <p className="ledger__note">
            Rights are replayed from this table rather than stored with the game, so the war can
            never drift out of step with it. Everything below today is still to come.
          </p>
          <table className="ledger__table ledger__table--events">
            <tbody>
              {EVENTS_1939.map((event) => {
                const past = event.day < day;
                const today = event.day === day;
                return (
                  <tr
                    key={event.id}
                    className={today ? 'is-today' : past ? 'is-past' : 'is-future'}
                  >
                    <td className="ledger__when">
                      {formatDate(event.day)}
                      <em>
                        {today
                          ? 'today'
                          : past
                            ? `day ${event.day}`
                            : `in ${event.day - day} ${event.day - day === 1 ? 'day' : 'days'}`}
                      </em>
                    </td>
                    <td>
                      <strong>{event.name}</strong>
                      <span className="ledger__grant">{describeEvent(event)}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
