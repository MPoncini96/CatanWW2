import { useMemo } from 'react';
import { formatUnits } from '../world/forces.js';
import {
  TEMPLATES,
  buildingOn,
  costOf,
  effortFor,
  mayRaise,
  menIn,
} from '../game/raising.js';

/**
 * Ordering a formation that does not exist yet.
 *
 * The panel is a list of what an army can be built in, and against each one the
 * three things it costs: men, stores, and months. Men are shown first and at the
 * top, because men are the shortage — the factory time is never what stops a
 * rifle division and the steel is trivial, and a player who reads this panel
 * for ten seconds should come away knowing that.
 *
 * What is already building is listed underneath with the day it arrives, since
 * the whole difficulty of raising an army is that you are deciding what you will
 * need six months from now.
 */
export function Raise({
  world,
  power,
  day,
  cell,
  manpower,
  economy,
  capacity,
  replacements,
  raisings,
  raising,
  onToggle,
  onSend,
  onCancel,
  busy,
  error,
}) {
  const picked = useMemo(() => raising ?? [], [raising]);

  const options = useMemo(() => {
    // Everything already ticked is already spoken for, so the next one has to
    // fit in what is left rather than in the whole pool.
    let men = 0;
    const spent = {};
    let plant = capacity?.plantDays ?? 0;
    for (const order of picked) {
      const t = TEMPLATES.find((x) => x.id === order.template);
      if (!t) continue;
      men += menIn(t);
      plant -= effortFor(t);
      for (const [store, amount] of Object.entries(costOf(t))) {
        spent[store] = (spent[store] ?? 0) + amount;
      }
    }
    return TEMPLATES.map((template) => ({
      template,
      chosen: picked.filter((p) => p.template === template.id).length,
      why: mayRaise({
        world,
        power,
        cell,
        template,
        day,
        economy,
        capacity: plant,
        replacements,
        raisings,
        spent,
        ordered: men,
      }),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, power, cell, day, economy, capacity, replacements, raisings, picked]);

  const building = useMemo(
    () => buildingOn(raisings, power, day).sort((a, b) => a.ready - b.ready),
    [raisings, power, day],
  );

  const committed = picked.reduce((n, o) => {
    const t = TEMPLATES.find((x) => x.id === o.template);
    return n + (t ? menIn(t) : 0);
  }, 0);

  return (
    <div className="march">
      <div className="march__head">
        <h4>
          Raise a formation
          <em>
            {manpower
              ? `${formatUnits(manpower.available)} men in the depots · ${formatUnits(manpower.perDay)} called up a day`
              : 'the depots are empty'}
          </em>
        </h4>
        <div className="march__buttons">
          {error && <span className="march__error">{error}</span>}
          <span className="march__count">
            {committed ? `${formatUnits(committed)} men committed` : 'nothing ordered'}
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
        {options.map(({ template, chosen, why }) => (
          <li key={template.id} className={why ? 'is-barred' : ''}>
            <label>
              <input
                type="checkbox"
                checked={chosen > 0}
                disabled={Boolean(why) && chosen === 0}
                onChange={() => onToggle(template.id, cell)}
              />
              <span className="march__name">
                {template.name}
                {chosen > 1 ? ` ×${chosen}` : ''}
              </span>
              <span className="march__from">{template.days} days</span>
              <span className="march__men">{formatUnits(menIn(template))} men</span>
            </label>
            <p className="march__why">
              {why ?? template.note}
            </p>
          </li>
        ))}
      </ul>

      {building.length > 0 && (
        <>
          <p className="march__none" style={{ marginTop: '8px', fontWeight: 600 }}>
            In the depots
          </p>
          <ul className="march__list">
            {building.map((entry) => (
              <li key={entry.id}>
                <label>
                  <span className="march__name">{entry.name}</span>
                  <span className="march__from">
                    {entry.ready - day} day{entry.ready - day === 1 ? '' : 's'} to go
                  </span>
                  <span className="march__men">{formatUnits(entry.men)} men</span>
                </label>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="march__none" style={{ marginTop: '6px' }}>
        Everything is paid on the day it is ordered — the class is called up and the contracts are
        placed — and the men are out of the depots for the whole time they are training. The same
        pool pays for replacing the formations you already have, which is the trade every general
        staff in the war spent it arguing about.
      </p>
    </div>
  );
}
