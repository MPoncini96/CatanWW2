import { formatAmount } from '../world/resources.js';
import { formatPerDay } from '../world/economy.js';
import { formatPopulation } from '../world/population.js';
import { formatUnits } from '../world/forces.js';

/**
 * What this nation has, takes in, and burns standing still.
 *
 * Three numbers per resource, and the third is the one that decides wars: the
 * gap between what a country's ground produces and what its army and fleet
 * consume doing nothing at all. Germany opens the war with 174 days of oil in
 * hand, Italy 206, China twelve — which is the whole of why the map looks the
 * way it does by 1941.
 */
export function Economy({ economy, open, onToggle, capacity }) {
  if (!economy) return null;

  return (
    <div className="economy">
      {/* Five resources with three figures each is fifteen numbers, and they
          are reference rather than working state — you check the oil, you close
          it, you go back to the map. So they fold away behind their own name
          and the manpower, which is one line, stays out. */}
      <details className="economy__vault" open={open} onToggle={(e) => onToggle?.(e.currentTarget.open)}>
        <summary>
          Resources <em>what it earns · what it burns · the day&apos;s net</em>
        </summary>
      <ul className="economy__stores">
        {economy.stores.map((store) => (
          <li key={store.id}>
            <span className="economy__head">
              <i style={{ background: store.color }} />
              <span className="economy__name">{store.name}</span>
              <strong>{formatAmount(store.stock, store.unit)}</strong>
            </span>
            <span className={`economy__flow${store.net < 0 ? ' is-falling' : ''}`}>
              <span className="economy__in">+{formatPerDay(store.income, store.unit)}</span>
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
      </details>

      <h3>Manpower</h3>
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
        {formatPopulation(economy.soldiers)} in the field and{' '}
        {formatPopulation(economy.sailors)} at sea, out of{' '}
        {formatPopulation(economy.people)} living on the ground it holds.
      </p>
      <p className="economy__note">
        {economy.machines.tanks.toLocaleString()} tanks ·{' '}
        {economy.machines.artillery.toLocaleString()} guns ·{' '}
        {economy.machines.aircraft.toLocaleString()} aircraft ·{' '}
        {economy.machines.hulls.toLocaleString()} hulls
      </p>

      {/* What the works can turn out. Not a store — you cannot save it up —
          but the ceiling on how much of an army can be rebuilt in a day, and
          the reason a steelworks is worth taking and worth bombing. */}
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
              <dt>A day's plant</dt>
              <dd>{formatUnits(Math.round(capacity.plantDays))}</dd>
            </div>
          </dl>
          <p className="economy__note">
            {capacity.steel.toLocaleString()} kt of steel a year, and a day of it rebuilds that
            many men — or a thirtieth as many tanks. It cannot be saved up.
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
