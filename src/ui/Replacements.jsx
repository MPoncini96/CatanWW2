import { useMemo } from 'react';
import { formatUnits } from '../world/forces.js';
import { formationName } from '../world/deploy.js';
import { COLUMN_RATE, replacementFor } from '../game/production.js';
import { supplyFor } from '../game/supply.js';
import { formatAmount } from '../world/resources.js';
import { RESOURCES } from '../world/resources.js';

/**
 * Asking for replacements.
 *
 * A column that has been fought over comes out at sixty per cent, and without a
 * way to put men back a war here ends in exhaustion rather than a decision. So
 * this is the other half of the fighting: it lists what is standing on the hex,
 * how much of each formation is left, and what a day of the depots would cost.
 *
 * Nothing here promises anything. Whether a column is actually rebuilt depends
 * on what is in the stores when the day turns, and the day turns after the
 * fighting — so a column cannot be topped up into the middle of the battle it
 * is losing.
 */
export function Replacements({
  world,
  power,
  day,
  cell,
  strengths,
  wanted,
  economy,
  capacity,
  onToggle,
  onSend,
  onCancel,
  busy,
  error,
}) {
  const asked = useMemo(() => new Set(wanted), [wanted]);

  // Whether anything can be got here at all is supply's question, and it is
  // asked before the factories are.
  const supplied = supplyFor(world, power, day)[cell] === 1;
  const rate = supplied ? COLUMN_RATE : 0;

  const rows = useMemo(() => {
    const out = [];
    for (const column of world.garrisons.byCell.get(cell) ?? []) {
      if (column.formation.nation !== power) continue;
      const full = world.garrisons.opening.find((p) => p.id === column.id)?.strength ?? column.strength;
      const have = strengths?.get(column.id) ?? column.strength;
      const paper = Object.values(full).reduce((a, b) => a + b, 0);
      const now = Object.values(have).reduce((a, b) => a + b, 0);
      out.push({
        column,
        share: paper ? now / paper : 1,
        want: replacementFor({ world, column: { ...column, strength: full }, have, day, supplied }),
      });
    }
    return out.sort((a, b) => a.share - b.share);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, power, cell, day, strengths, supplied]);

  // What a day of it would take out of the stores, if everything ticked here
  // were sent. The stores are the seat's whole stock, not this hex's share of
  // it, so the figure is meant to be read against the panel on the left.
  const bill = useMemo(() => {
    const total = {};
    let men = 0;
    let effort = 0;
    for (const row of rows) {
      if (!asked.has(row.column.id) || !row.want) continue;
      men += row.want.men;
      effort += row.want.effort;
      for (const [store, amount] of Object.entries(row.want.cost)) {
        total[store] = (total[store] ?? 0) + amount;
      }
    }
    return { total, men, effort };
  }, [rows, asked]);


  return (
    <div className="march">
      <div className="march__head">
        <h4>
          Replacements
          <em>
            {rate
              ? `up to ${Math.round(rate * 100)}% of a formation a day`
              : 'nothing can reach this hex'}
          </em>
        </h4>
        <div className="march__buttons">
          {error && <span className="march__error">{error}</span>}
          <span className="march__count">
            {bill.men
              ? `${formatUnits(bill.men)} men · ${RESOURCES.filter((r) => bill.total[r.id])
                  .map((r) => formatAmount(bill.total[r.id], r.unit))
                  .join(' · ')}`
              : 'nothing asked for'}
          </span>
          <button type="button" onClick={onCancel} disabled={busy}>
            Done
          </button>
          <button type="button" className="march__send" onClick={onSend} disabled={busy}>
            {busy ? 'Sending…' : 'Send orders'}
          </button>
        </div>
      </div>

      {!rows.length ? (
        <p className="march__none">Nothing of yours is standing here.</p>
      ) : (
        <ul className="march__list">
          {rows.map(({ column, share, want }) => (
            <li key={column.id} className={want ? '' : 'is-barred'}>
              <label>
                <input
                  type="checkbox"
                  checked={asked.has(column.id)}
                  disabled={!want || busy}
                  onChange={() => onToggle(column.id)}
                />
                <span className="march__name">{formationName(column.formation)}</span>
                <span className="march__from">{Math.round(share * 100)}% of strength</span>
                <span className="march__men">
                  {want
                    ? `+${formatUnits(want.added.infantry ?? 0)} men`
                    : share >= 1
                      ? 'at full strength'
                      : 'out of reach'}
                </span>
              </label>
              {want && (
                <p className="march__why">
                  {RESOURCES.filter((r) => want.cost[r.id])
                    .map((r) => `${formatAmount(want.cost[r.id], r.unit)} ${r.name.toLowerCase()}`)
                    .join(', ')}
                  {` · ${formatUnits(want.men)} drafted`}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
      {economy && (
        <p className="march__none" style={{ marginTop: '6px' }}>
          {capacity && (
            <>
              The factories can do {formatUnits(Math.round(capacity.plantDays))} a day across the
              whole army; this hex is asking for {formatUnits(Math.round(bill.effort))} of it
              {bill.effort > capacity.plantDays && ', which is more than there is'}.{' '}
            </>
          )}
          In hand:{' '}
          {economy.stores
            .filter((s) => bill.total[s.id])
            .map((s) => `${s.name} ${formatAmount(s.stock, s.unit)}`)
            .join(' · ') || 'nothing is being asked for yet'}
          . What the day cannot cover is simply not sent.
        </p>
      )}
    </div>
  );
}
