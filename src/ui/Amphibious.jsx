import { useMemo, useState } from 'react';
import { neighbours } from '../world/sphere.js';
import { formatUnits } from '../world/forces.js';
import { formationName } from '../world/deploy.js';
import {
  aircraftIn,
  carriedBy,
  deckAt,
  deckOf,
  decksUsedAt,
  isAirGroup,
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
    // Biggest lift first, and a squadron with decks counts for something even
    // when it lifts nothing: six carriers and no transports is the fleet you
    // want if what is standing on the beach is a fighter group.
    alongside
      .slice()
      .sort((a, b) => liftOf(b) + deckOf(b) * 8 - (liftOf(a) + deckOf(a) * 8))[0] ??
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
        flying: isAirGroup(column.formation),
        aircraft: aircraftIn(have),
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
          fleets,
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
  // Counted across every fleet of yours on that water: ships in company are
  // one force and their decks are one deck.
  const deck = chosenFleet ? deckAt(chosenFleet.cell, power, fleets) : 0;
  const deckLeft = chosenFleet
    ? deck - decksUsedAt(chosenFleet.cell, power, fleets, aboard ?? new Map(), strengths, columns)
    : 0;
  const chosen = here.filter((h) => picked.has(h.column.id));
  const going = chosen.filter((h) => !h.flying).reduce((n, h) => n + h.weight, 0);
  const flying = chosen.filter((h) => h.flying).reduce((n, h) => n + h.aircraft, 0);

  return (
    <div className="march">
      <div className="march__head">
        <h4>
          {mode === 'embark' ? 'Put to sea' : 'Land here'}
          <em>
            {!alongside.length
              ? 'none of your fleets is in the water beside this hex'
              : mode === 'embark'
                ? `${chosenFleet?.name} can lift ${Math.round(room).toLocaleString()} more` +
                  (deck ? ` · deck for ${Math.max(0, deckLeft)} aircraft` : ' · no carrier')
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
                  {deckOf(f) ? ` · ${deckOf(f)} deck` : ''}
                </option>
              ))}
            </select>
          )}
          <span className="march__count">
            {mode === 'embark'
              ? going || flying
                ? [
                    going ? `${Math.round(going).toLocaleString()} men` : '',
                    flying ? `${flying} aircraft` : '',
                  ]
                    .filter(Boolean)
                    .join(' and ') + ' going aboard'
                : 'nobody going aboard'
              : `${landingHere.size} fleet${landingHere.size === 1 ? '' : 's'} landing`}
          </span>
          <button type="button" className="march__drop" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="march__send" onClick={onSend} disabled={busy}>
            {busy ? 'Saving…' : 'Save & close'}
          </button>
        </div>
      </div>

      {mode === 'embark' ? (
        !here.length ? (
          <p className="march__none">Nothing of yours is standing on this hex.</p>
        ) : (
          <ul className="march__list">
            {here.map(({ column, weight, aircraft, flying: air, why }) => (
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
                  <span className="march__men">
                  {air ? `${aircraft} aircraft` : `${formatUnits(weight)} to lift`}
                </span>
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
