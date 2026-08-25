import { formatAmount } from '../world/resources.js';
import { formatPerDay } from '../world/economy.js';
import { formatPopulation } from '../world/population.js';

/**
 * What this nation has, takes in, and burns standing still.
 *
 * Three numbers per resource, and the third is the one that decides wars: the
 * gap between what a country's ground produces and what its army and fleet
 * consume doing nothing at all. Germany opens the war with 174 days of oil in
 * hand, Italy 206, China twelve — which is the whole of why the map looks the
 * way it does by 1941.
 */
export function Economy({ economy, onActions }) {
  if (!economy) return null;

  return (
    <div className="economy">
      <h3>
        Stores <em>what it earns · what it burns · the day&apos;s net</em>
      </h3>
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

      <button type="button" className="economy__actions" onClick={onActions}>
        Actions
      </button>
      <p className="economy__note">Nothing to order yet — this is where orders will go.</p>
    </div>
  );
}
