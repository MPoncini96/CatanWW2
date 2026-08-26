import { formatAmount } from '../world/resources.js';
import { formatPerDay } from '../world/economy.js';
import { formatPopulation } from '../world/population.js';
import { formatUnits } from '../world/forces.js';

// What this nation has, takes in, and burns standing still.
//
// Split in two, because they answer different questions and get looked at at
// different moments. The **stores** are the metal: what the ground produces
// against what the army and fleet consume doing nothing at all. Germany opens
// the war with 165 days of oil in hand, Italy 206, China twelve — which is the
// whole of why the map looks the way it does by 1941.
//
// The **forces** are the men, and the plant that puts them back when they are
// gone. Both are reference rather than working state — you look at them, close
// them, and go back to the map — which is why they live in drawers now instead
// of stacked down the rail.

/** The five stores, and the third figure, which is the one that decides wars. */
export function Stores({ economy }) {
  if (!economy) return null;
  return (
    <ul className="economy__stores">
      {economy.stores.map((store) => (
        <li key={store.id}>
          <span className="economy__head">
            <i style={{ background: store.color }} />
            <span className="economy__name">{store.name}</span>
            <strong>{formatAmount(store.stock, store.unit)}</strong>
          </span>
          <span className={`economy__flow${store.net < 0 ? ' is-falling' : ''}`}>
            <span className="economy__in">
              +{formatPerDay(store.income, store.unit)}
              {/* What part of that income crosses water — the number a submarine
                  is aimed at, and the only reason the convoy panel means
                  anything. Shown only where there is trade to lose. */}
              {store.sea > 0 && (
                <em title={`${formatPerDay(store.sea, store.unit)} a day arrives by sea`}>
                  {Math.round((store.sea / store.income) * 100)}% by sea
                </em>
              )}
            </span>
            <span className="economy__out">
              {store.upkeep > 0 ? `−${formatPerDay(store.upkeep, store.unit)}` : 'nothing'}
            </span>
            <span className="economy__net">
              {store.net >= 0 ? '+' : '−'}
              {formatPerDay(Math.abs(store.net), store.unit)} a day
            </span>
            {store.daysLeft !== null && (
              <span className="economy__left">{store.daysLeft} days left</span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** The men under arms, the people behind them, and the plant that rebuilds. */
export function Forces({ economy, capacity }) {
  if (!economy) return null;
  return (
    <div className="economy">
      <dl className="economy__people">
        <div>
          <dt>Under arms</dt>
          <dd>{formatPopulation(economy.military)}</dd>
        </div>
        <div>
          <dt>Civilians</dt>
          <dd>{formatPopulation(economy.civilian)}</dd>
        </div>
      </dl>
      <p className="economy__note">
        {formatPopulation(economy.soldiers)} in the field and {formatPopulation(economy.sailors)} at
        sea, out of {formatPopulation(economy.people)} living on the ground it holds.
      </p>
      <p className="economy__note">
        {economy.machines.tanks.toLocaleString()} tanks ·{' '}
        {economy.machines.artillery.toLocaleString()} guns ·{' '}
        {economy.machines.aircraft.toLocaleString()} aircraft ·{' '}
        {economy.machines.hulls.toLocaleString()} hulls
      </p>

      {/* What the works can turn out. Not a store — you cannot save it up — but
          the ceiling on how much of an army can be rebuilt in a day, and the
          reason a steelworks is worth taking and worth bombing. */}
      {capacity && (
        <>
          <h3>Industry</h3>
          <dl className="economy__people">
            <div>
              <dt>Steelworks</dt>
              <dd>
                {capacity.works.length}
                {capacity.down > 0 && <em className="economy__down"> · {capacity.down} out</em>}
              </dd>
            </div>
            <div>
              <dt>A day&apos;s plant</dt>
              <dd>{formatUnits(Math.round(capacity.plantDays))}</dd>
            </div>
          </dl>
          <p className="economy__note">
            {capacity.steel.toLocaleString()} kt of steel a year, and a day of it rebuilds that many
            men — or a thirtieth as many tanks. It cannot be saved up.
          </p>
          {capacity.works.length > 0 && (
            <p className="economy__note">
              Heaviest: {capacity.works[0].name} ({capacity.works[0].output.toLocaleString()} kt),{' '}
              {Math.round((capacity.works[0].output / Math.max(1, capacity.steel)) * 100)}% of it.
            </p>
          )}
        </>
      )}
    </div>
  );
}
