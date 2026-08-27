import { useMemo, useState } from 'react';
import { neighbours } from '../world/sphere.js';
import { formatUnits } from '../world/forces.js';
import { formationName } from '../world/deploy.js';
import {
  carriedBy,
  liftOf,
  loadOf,
  mayEmbark,
  mayLand,
  menIn,
} from '../game/amphibious.js';

/**
 * Getting an army across water, from the beach it is standing on.
 *
 * Both halves of the operation are asked about a coastal hex, which is the way
 * every other order here works: you click the ground and the panel tells you
 * what can happen on it. Loading asks which of your fleets in the water beside
 * it will take what is standing on it; landing asks which of your loaded fleets
 * will put its army onto it.
 *
 * The lift is shown before anything is ticked, because that is the decision. A
 * squadron carries what a squadron carries, and finding out that half your army
 * is still on the wrong beach is not something to discover after the day turns.
 */
export function Amphibious({
  world,
  power,
  day,
  cell,
  mode,
  fleets,
  positions,
  strengths,
  arrivals,
  aboard,
  embarking,
  landing,
  onToggleEmbark,
  onToggleLanding,
  onSend,
  onCancel,
  busy,
  error,
}) {
  const columns = useMemo(
    () => new Map((world?.garrisons.opening ?? []).map((p) => [p.id, p])),
    [world],
  );

  // Your fleets in the water touching this hex.
  const alongside = useMemo(() => {
    const near = new Set(neighbours(cell));
    return (fleets ?? []).filter(
      (f) => f.power === power && !f.cargo && f.afloat && near.has(f.cell),
    );
  }, [fleets, power, cell]);

  const [carrier, setCarrier] = useState(null);
  const chosenFleet =
    alongside.find((f) => f.id === carrier) ??
    alongside.slice().sort((a, b) => liftOf(b) - liftOf(a))[0] ??
    null;

  const picked = useMemo(() => new Set((embarking ?? []).map((e) => e.column)), [embarking]);
  const landingHere = useMemo(() => new Set((landing ?? []).map((l) => l.fleet)), [landing]);

  // ---- what is standing here that could go ---------------------------------
  const here = useMemo(() => {
    if (mode !== 'embark') return [];
    const out = [];
    for (const column of world?.garrisons.opening ?? []) {
      if (column.formation.nation !== power) continue;
      if ((positions?.get(column.id) ?? column.cell) !== cell) continue;
      const have = strengths?.get(column.id) ?? column.strength;
      out.push({
        column,
        weight: menIn(have),
        why: mayEmbark({
          world,
          column,
          fleet: chosenFleet,
          power,
          day,
          positions,
          arrivals,
          aboard,
          strengths,
          columns,
          ordered: new Set([...picked].filter((id) => id !== column.id)),
        }),
      });
    }
    return out.sort((a, b) => Number(Boolean(a.why)) - Number(Boolean(b.why)) || a.weight - b.weight);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, world, power, cell, day, positions, strengths, arrivals, aboard, chosenFleet, picked]);

  // ---- and what is offshore that could come ashore -------------------------
  const loaded = useMemo(() => {
    if (mode !== 'land') return [];
    return alongside
      .map((fleet) => ({
        fleet,
        carrying: carriedBy(fleet.id, aboard ?? new Map()),
        why: mayLand({ world, fleet, to: cell, power, day, aboard }),
      }))
      .filter((f) => f.carrying.length > 0 || !f.why)
      .sort((a, b) => Number(Boolean(a.why)) - Number(Boolean(b.why)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, alongside, world, cell, power, day, aboard]);

  const room = chosenFleet
    ? liftOf(chosenFleet) - loadOf(chosenFleet.id, aboard ?? new Map(), strengths, columns)
    : 0;
  const going = here.filter((h) => picked.has(h.column.id)).reduce((n, h) => n + h.weight, 0);

  return (
    <div className="march">
      <div className="march__head">
        <h4>
          {mode === 'embark' ? 'Put to sea' : 'Land here'}
          <em>
            {!alongside.length
              ? 'none of your fleets is in the water beside this hex'
              : mode === 'embark'
                ? `${chosenFleet?.name} can lift ${Math.round(room).toLocaleString()} more`
                : `${loaded.reduce((n, f) => n + f.carrying.length, 0)} formations offshore`}
          </em>
        </h4>
        <div className="march__buttons">
          {error && <span className="march__error">{error}</span>}
          {mode === 'embark' && alongside.length > 1 && (
            <select
              className="march__pick"
              value={chosenFleet?.id ?? ''}
              onChange={(e) => setCarrier(e.target.value)}
              disabled={busy}
            >
              {alongside.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} · {liftOf(f).toLocaleString()}
                </option>
              ))}
            </select>
          )}
          <span className="march__count">
            {mode === 'embark'
              ? going
                ? `${Math.round(going).toLocaleString()} men going aboard`
                : 'nobody going aboard'
              : `${landingHere.size} fleet${landingHere.size === 1 ? '' : 's'} landing`}
          </span>
          <button type="button" onClick={onCancel} disabled={busy}>
            Done
          </button>
          <button type="button" className="march__send" onClick={onSend} disabled={busy}>
            {busy ? 'Sending…' : 'Send orders'}
          </button>
        </div>
      </div>

      {mode === 'embark' ? (
        !here.length ? (
          <p className="march__none">Nothing of yours is standing on this hex.</p>
        ) : (
          <ul className="march__list">
            {here.map(({ column, weight, why }) => (
              <li key={column.id} className={why ? 'is-barred' : ''}>
                <label>
                  <input
                    type="checkbox"
                    checked={picked.has(column.id)}
                    disabled={Boolean(why) || busy}
                    onChange={() => onToggleEmbark(column.id, chosenFleet?.id, cell)}
                  />
                  <span className="march__name">{formationName(column.formation)}</span>
                  <span className="march__from">{column.formation.type}</span>
                  <span className="march__men">{formatUnits(weight)} to lift</span>
                </label>
                {why && <p className="march__why">{why}</p>}
              </li>
            ))}
          </ul>
        )
      ) : !loaded.length ? (
        <p className="march__none">You have nothing loaded in the water beside this hex.</p>
      ) : (
        <ul className="march__list">
          {loaded.map(({ fleet, carrying, why }) => (
            <li key={fleet.id} className={why ? 'is-barred' : ''}>
              <label>
                <input
                  type="checkbox"
                  checked={landingHere.has(fleet.id)}
                  disabled={Boolean(why) || busy}
                  onChange={() => onToggleLanding(fleet.id, cell)}
                />
                <span className="march__name">{fleet.name}</span>
                <span className="march__from">{fleet.hulls} hulls</span>
                <span className="march__men">
                  {carrying.length} formation{carrying.length === 1 ? '' : 's'} aboard
                </span>
              </label>
              {why && <p className="march__why">{why}</p>}
            </li>
          ))}
        </ul>
      )}

      <p className="march__none" style={{ marginTop: '6px' }}>
        {mode === 'embark'
          ? 'A column aboard has the position of the ship carrying it, and goes down with it if the ship is caught. Nothing else can touch it: it cannot fight, cannot take ground, and does not go hungry.'
          : 'An assault lands at less than half strength, and its tanks and guns at a fraction of that — the heavy equipment comes ashore late or not at all. Anything of yours lying offshore and not itself in action will fire in support.'}
      </p>
    </div>
  );
}
