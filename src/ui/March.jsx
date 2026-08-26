import { useMemo } from 'react';
import { grid, neighbours } from '../world/sphere.js';
import { formatUnits } from '../world/forces.js';
import { formationName } from '../world/deploy.js';
import { mayMarch } from '../game/movement.js';

/**
 * Ordering columns into a hex.
 *
 * The selection runs backwards from how a map usually works, and on purpose:
 * you pick the hex you want held and the panel shows you everything that can
 * be there tomorrow. That is the question a staff officer actually asks — what
 * can reach this place by morning — and it makes the one-hex rule do the work
 * of choosing the list, because the answer is exactly the six hexes around it.
 *
 * Nothing is committed until the orders are sent, and sending replaces the
 * whole day rather than adding to it, so unticking a column is how you cancel.
 */
export function March({
  world,
  power,
  day,
  to,
  positions,
  arrivals,
  orders,
  onToggle,
  onSend,
  onCancel,
  busy,
  error,
}) {
  const sphere = grid();

  // Which way a neighbour lies, so a column can be named by where it is coming
  // from rather than by a cell number nobody can picture.
  const bearing = (from) => {
    const dLat = sphere.lat[from] - sphere.lat[to];
    const dLon = (sphere.lon[from] - sphere.lon[to]) * Math.cos((sphere.lat[to] * Math.PI) / 180);
    const angle = (Math.atan2(dLon, dLat) * 180) / Math.PI;
    const points = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
    return points[Math.round(((angle + 360) % 360) / 45) % 8];
  };

  const ordered = useMemo(() => new Set(orders.map((o) => o.column)), [orders]);

  // Everything of this seat's standing on the six hexes around the target,
  // with the reason attached wherever one of them cannot come.
  const candidates = useMemo(() => {
    const out = [];
    for (const from of neighbours(to)) {
      for (const column of world.garrisons.byCell.get(from) ?? []) {
        if (column.formation.nation !== power) continue;
        const why = mayMarch({
          world,
          column,
          to,
          power,
          day,
          positions,
          arrivals,
          // Asked without this column's own order in the way, so a ticked
          // column does not report itself as already spoken for.
          ordered: new Set([...ordered].filter((id) => id !== column.id)),
        });
        out.push({ column, from, why, ticked: ordered.has(column.id) });
      }
    }
    return out.sort(
      (a, b) =>
        Number(Boolean(a.why)) - Number(Boolean(b.why)) ||
        b.column.strength.infantry - a.column.strength.infantry,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, power, day, to, positions, arrivals, ordered]);

  const coming = orders.filter((o) => o.to === to);
  const men = coming.reduce((sum, o) => {
    const column = world.garrisons.opening.find((p) => p.id === o.column);
    return sum + (column?.strength.infantry ?? 0);
  }, 0);

  return (
    <div className="march">
      <div className="march__head">
        <h4>
          March into {world.territoryName?.[to] ?? 'this hex'}
          <em>arriving tomorrow</em>
        </h4>
        <div className="march__buttons">
          {error && <span className="march__error">{error}</span>}
          <span className="march__count">
            {coming.length
              ? `${coming.length} column${coming.length === 1 ? '' : 's'} · ${formatUnits(men)} men`
              : 'nothing ordered'}
          </span>
          <button type="button" onClick={onCancel} disabled={busy}>
            Done
          </button>
          <button type="button" className="march__send" onClick={onSend} disabled={busy}>
            {busy ? 'Sending…' : 'Send orders'}
          </button>
        </div>
      </div>

      {candidates.length === 0 ? (
        <p className="march__none">
          Nothing of yours is standing on the six hexes around this one. A column marches one hex a
          day, so it has to be next to the ground it is going to take.
        </p>
      ) : (
        <ul className="march__list">
          {candidates.map(({ column, from, why, ticked }) => (
            <li key={column.id} className={why ? 'is-barred' : ''}>
              <label>
                <input
                  type="checkbox"
                  checked={ticked}
                  disabled={Boolean(why) || busy}
                  onChange={() => onToggle(column, from)}
                />
                <span className="march__name">{formationName(column.formation)}</span>
                <span className="march__from">from the {bearing(from)}</span>
                <span className="march__men">
                  {formatUnits(column.strength.infantry)}
                  {column.strength.tanks > 0 && ` · ${column.strength.tanks} tanks`}
                </span>
              </label>
              {why && <p className="march__why">{why}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
