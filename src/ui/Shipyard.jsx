import { useMemo } from 'react';
import { formatUnits } from '../world/forces.js';
import { yardAt } from '../world/shipyards.js';
import {
  HULLS,
  costOf,
  effortFor,
  mayLay,
  menIn,
  onTheStocks,
  slipsFree,
  yardOut,
} from '../game/shipbuilding.js';

/**
 * Putting a hull on the stocks.
 *
 * The panel leads with the slips, because the slips are the decision. Steel is
 * never what stops a warship — a battleship is a day of British steel output
 * and three and a half years of a berth — and a player who reads this for ten
 * seconds should come away knowing that the question is not what they can
 * afford but what they are willing to give the berth to.
 *
 * What is already on the stocks is listed underneath with the day it floats,
 * since the whole difficulty of building a navy is that you are deciding what
 * you will need three years from now.
 */
export function Shipyard({
  world,
  power,
  day,
  cell,
  keels,
  raids,
  manpower,
  economy,
  capacity,
  replacements,
  raisings,
  laying,
  onToggle,
  onSend,
  onCancel,
  busy,
  error,
}) {
  const picked = useMemo(() => laying ?? [], [laying]);
  const yard = useMemo(() => yardAt(world, cell), [world, cell]);

  const free = useMemo(
    () => slipsFree(world, yard, keels, day, raids),
    [world, yard, keels, day, raids],
  );
  const bombed = useMemo(() => yardOut(raids, cell, day), [raids, cell, day]);

  const options = useMemo(() => {
    // Everything already ticked has taken its berth, its men and its steel, so
    // the next one has to fit in what is left rather than in the whole yard.
    let men = 0;
    let slips = 0;
    const spent = {};
    let plant = capacity?.plantDays ?? 0;
    for (const order of picked) {
      const h = HULLS.find((x) => x.id === order.hull);
      if (!h) continue;
      men += menIn(h);
      plant -= effortFor(h);
      if (order.cell === cell) slips += h.slips;
      for (const [store, amount] of Object.entries(costOf(h))) {
        spent[store] = (spent[store] ?? 0) + amount;
      }
    }
    return HULLS.map((hull) => ({
      hull,
      chosen: picked.filter((p) => p.hull === hull.id && p.cell === cell).length,
      why: mayLay({
        world,
        power,
        cell,
        hull,
        day,
        keels,
        raids,
        economy,
        capacity: plant,
        replacements,
        raisings,
        spent,
        ordered: { men, slips },
      }),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, power, cell, day, keels, raids, economy, capacity, replacements, raisings, picked]);

  const stocks = useMemo(
    () => onTheStocks(keels, yard?.id, day).sort((a, b) => a.ready - b.ready),
    [keels, yard?.id, day],
  );

  const taken = picked
    .filter((o) => o.cell === cell)
    .reduce((n, o) => n + (HULLS.find((x) => x.id === o.hull)?.slips ?? 0), 0);

  if (!yard) {
    return (
      <div className="march">
        <p className="march__none">There is no shipyard on this hex.</p>
      </div>
    );
  }

  return (
    <div className="march">
      <div className="march__head">
        <h4>
          {yard.name}
          {yard.also?.length ? ` · with ${yard.also.join(' and ')}` : ''}
          <em>
            {bombed
              ? `bombed out until day ${bombed} — nothing moves on the stocks`
              : `${free} of ${yard.slips} slips free · ${yard.capital ? 'a capital berth' : 'no capital berth'} · hulls join ${yard.berthName}`}
          </em>
        </h4>
        <div className="march__buttons">
          {error && <span className="march__error">{error}</span>}
          <span className="march__count">
            {taken
              ? `${taken} slip${taken === 1 ? '' : 's'} committed`
              : manpower
                ? `${formatUnits(manpower.available)} men in the depots`
                : 'nothing ordered'}
          </span>
          <button type="button" className="march__drop" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="march__send" onClick={onSend} disabled={busy}>
            {busy ? 'Saving…' : 'Save & close'}
          </button>
        </div>
      </div>

      <ul className="march__list">
        {options.map(({ hull, chosen, why }) => (
          <li key={hull.id} className={why ? 'is-barred' : ''}>
            <label>
              <input
                type="checkbox"
                checked={chosen > 0}
                disabled={Boolean(why) && chosen === 0}
                onChange={() => onToggle(hull.id, cell)}
              />
              <span className="march__name">
                {hull.name}
                {hull.hulls > 1 ? ` · ${hull.hulls} hulls` : ''}
                {chosen > 1 ? ` ×${chosen}` : ''}
              </span>
              <span className="march__from">
                {hull.days} days · {hull.slips} slip{hull.slips === 1 ? '' : 's'}
              </span>
              <span className="march__men">{formatUnits(menIn(hull))} crew</span>
            </label>
            <p className="march__why">{why ?? hull.note}</p>
          </li>
        ))}
      </ul>

      {stocks.length > 0 && (
        <>
          <p className="march__none" style={{ marginTop: '8px', fontWeight: 600 }}>
            On the stocks here
          </p>
          <ul className="march__list">
            {stocks.map((keel) => (
              <li key={keel.id}>
                <label>
                  <span className="march__name">{keel.name}</span>
                  <span className="march__from">
                    {keel.ready - day} day{keel.ready - day === 1 ? '' : 's'} to go
                  </span>
                  <span className="march__men">
                    {keel.slips} slip{keel.slips === 1 ? '' : 's'} · joins {keel.fleetName}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="march__none" style={{ marginTop: '6px' }}>
        The berth is the cost that matters. A battleship is about one day of national steel and
        three and a half years of a slip that could have held twelve destroyers in the same time —
        which is the argument every naval staff in the war actually had, and the one Germany lost
        before it started. Everything is paid the day the keel is laid, and a yard that is bombed
        launches nothing at all until it is repaired.
      </p>
    </div>
  );
}
