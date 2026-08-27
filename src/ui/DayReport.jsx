import { UNITS, formatUnits } from '../world/forces.js';

/**
 * What the day brought, for the seat that has to answer for it.
 *
 * Everything here was already in the record and none of it was anywhere a
 * player could see. You ended the day, the map quietly changed, and the only
 * way to find out how was to click every hex you owned and read them one at a
 * time. That is not a hard game, it is an opaque one.
 *
 * It opens on its own when the day turns and there is something to say, and
 * closes to a button in the top bar, because the second thing you want after
 * reading it is the map back.
 */
export function DayReport({ report, date, onClose }) {
  if (!report) return null;

  const arms = (counts) =>
    UNITS.filter((u) => counts?.[u.id] > 0)
      .map((u) => `${formatUnits(counts[u.id])} ${u.short.toLowerCase()}`)
      .join(', ');

  return (
    <>
      <button type="button" className="totals__scrim" onClick={onClose} aria-label="Close" />
      <div className="report" role="dialog" aria-label="The day">
        <header className="report__head">
          <h2>{date}</h2>
          <button type="button" onClick={onClose}>
            Back to the map
          </button>
        </header>

        {report.quiet ? (
          <p className="report__quiet">
            Nothing happened that anybody will write down. No fighting, no ground changed hands, and
            nothing came up from the depots.
          </p>
        ) : (
          <div className="report__body">
            {report.battles.length > 0 && (
              <section>
                <h3>The fighting</h3>
                <ul className="report__list">
                  {report.battles.map((b, n) => (
                    <li key={`b${n}`} className={b.won ? 'is-won' : 'is-lost'}>
                      <span className="report__where">{b.where}</span>
                      <span className="report__what">
                        {b.attacking ? 'attacked' : 'attacked by'} {b.against} —{' '}
                        <strong>{b.won ? 'held' : 'gave way'}</strong>
                        {b.pocket && b.won && ', and the pocket was destroyed'}
                        {b.pocket && !b.won && ', with nowhere to fall back to'}
                      </span>
                      <span className="report__cost">
                        {b.strength.toLocaleString()} against {b.theirs.toLocaleString()}
                        {b.lost && ` · lost ${arms(b.lost)}`}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {(report.flown.length > 0 || report.bombed.length > 0) && (
              <section>
                <h3>The bombing</h3>
                <ul className="report__list">
                  {report.flown.map((r, n) => (
                    <li key={`f${n}`} className={r.days > 0 ? 'is-won' : ''}>
                      <span className="report__where">{r.works.join(', ') || r.where}</span>
                      <span className="report__what">
                        {r.bombers} sent, {r.through} through —{' '}
                        <strong>
                          {r.days > 0 ? `out for ${r.days} day${r.days === 1 ? '' : 's'}` : 'no lasting damage'}
                        </strong>
                      </span>
                      <span className="report__cost">
                        lost {Math.round(r.share * 100)}% · {r.fighters} fighters, {r.flak} guns
                      </span>
                    </li>
                  ))}
                  {report.bombed.map((r, n) => (
                    <li key={`x${n}`} className="is-lost">
                      <span className="report__where">{r.works.join(', ') || r.where}</span>
                      <span className="report__what">
                        bombed by {r.through} aircraft —{' '}
                        <strong>
                          {r.days > 0 ? `out for ${r.days} day${r.days === 1 ? '' : 's'}` : 'the works held'}
                        </strong>
                      </span>
                      <span className="report__cost">
                        {r.fighters} fighters and {r.flak} guns up · {Math.round(r.share * 100)}% of
                        them shot down
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {report.fell?.length > 0 && (
              <section>
                <h3>The governments</h3>
                <ul className="report__list">
                  {report.fell.map((c, n) => (
                    <li
                      key={`g${n}`}
                      className={c.took || c.inherited ? 'is-won' : ''}
                    >
                      <span className="report__where">{c.country} capitulates</span>
                      <span className="report__what">
                        {c.metropoleCells} hexes to <strong>{c.to}</strong>
                        {c.empireCells > 0 && (
                          <>
                            {' · '}
                            {c.empireCells} of empire{' '}
                            <strong>{c.empire === 'nobody' ? 'go their own way' : `to ${c.empire}`}</strong>
                          </>
                        )}
                      </span>
                      <span className="report__cost">
                        {c.note ? `${c.note} · ` : ''}
                        {c.forces} formations lay down their arms
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {(report.actions?.length > 0 ||
              report.sunk?.length > 0 ||
              report.raided?.length > 0) && (
              <section>
                <h3>The sea</h3>
                <ul className="report__list">
                  {(report.actions ?? []).map((a, n) => (
                    <li key={`s${n}`} className={a.won ? 'is-won' : 'is-lost'}>
                      <span className="report__where">{a.where}</span>
                      <span className="report__what">
                        {a.attacking ? 'engaged' : 'was engaged by'} {a.against} —{' '}
                        <strong>{a.won ? 'held the water' : 'broke off'}</strong>
                      </span>
                      <span className="report__cost">
                        {a.fleets.join(', ')} · {a.strength} against {a.theirs} · lost{' '}
                        {Math.round(a.share * 100)}% of the hulls engaged
                      </span>
                    </li>
                  ))}
                  {(report.raided ?? []).map((c, n) => (
                    <li key={`r${n}`} className="is-won">
                      <span className="report__where">{c.where}</span>
                      <span className="report__what">
                        convoy destroyed — <strong>{c.lane}</strong>
                      </span>
                      <span className="report__cost">
                        {c.from} loses that cargo for {c.days} days
                      </span>
                    </li>
                  ))}
                  {(report.sunk ?? []).map((c, n) => (
                    <li key={`c${n}`} className="is-lost">
                      <span className="report__where">{c.where}</span>
                      <span className="report__what">
                        convoy lost — <strong>{c.lane}</strong>
                      </span>
                      <span className="report__cost">
                        nothing lands on this route until day {c.until}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {(report.taken.length > 0 || report.lost.length > 0) && (
              <section>
                <h3>The ground</h3>
                <ul className="report__list">
                  {report.taken.map((g, n) => (
                    <li key={`t${n}`} className="is-won">
                      <span className="report__where">{g.where}</span>
                      <span className="report__what">taken · {g.how}</span>
                    </li>
                  ))}
                  {report.lost.map((g, n) => (
                    <li key={`l${n}`} className="is-lost">
                      <span className="report__where">{g.where}</span>
                      <span className="report__what">lost · {g.how}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {report.starving.length > 0 && (
              <section>
                <h3>Out of supply</h3>
                <ul className="report__list">
                  {report.starving.map((s, n) => (
                    <li key={`h${n}`} className="is-lost">
                      <span className="report__where">{s.where}</span>
                      <span className="report__what">{s.columns.join(', ')}</span>
                      <span className="report__cost">
                        {s.lost ? `wasted ${arms(s.lost)}` : 'going without'}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {(report.sent.length > 0 || report.refused.length > 0) && (
              <section>
                <h3>From the depots</h3>
                <ul className="report__list">
                  {report.sent.map((r, n) => (
                    <li key={`s${n}`} className="is-won">
                      <span className="report__where">{r.column}</span>
                      <span className="report__what">brought up to strength</span>
                      <span className="report__cost">{arms(r.added)}</span>
                    </li>
                  ))}
                  {report.refused.map((r, n) => (
                    <li key={`r${n}`}>
                      <span className="report__where">{r.column}</span>
                      <span className="report__what">nothing sent</span>
                      <span className="report__cost">{r.why}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="report__sum">
              <h3>The day, in all</h3>
              <p>
                {Object.keys(report.losses).length
                  ? `Lost: ${arms(report.losses)}.`
                  : 'Nothing was lost.'}{' '}
                {Object.keys(report.gains).length
                  ? `Made good: ${arms(report.gains)}.`
                  : 'Nothing was made good.'}
              </p>
            </section>
          </div>
        )}
      </div>
    </>
  );
}
