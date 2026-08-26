import { useEffect, useState } from 'react';
import { formatPopulation } from '../world/population.js';
import { ordersFor } from '../game/orders.js';
import { formatAmount } from '../world/resources.js';
import { ROLES, UNITS, formatUnits } from '../world/forces.js';
import { SHIPS } from '../world/navies.js';

/**
 * The whole of a hex, along the bottom of the screen.
 *
 * The rail on the left answers the question the map is currently asking — on
 * Terrain what the ground is, on Nations who holds it, on Output what comes out
 * of it — and deliberately answers nothing else, because a column of twelve
 * facts puts the one you want in the middle of it.
 *
 * That rule is right for a panel you read while working and wrong for the
 * moment you want to know everything about one place at once. So this strip is
 * the other half of the same idea: not one question in depth but every question
 * at a glance, in columns, across the layers. Switching layer does not change
 * it. It is the dossier on a hex, and the map is what you look at while
 * deciding which hex to open one on.
 */
export function Dossier({ tile, open, onToggle, master, layer, power, day, orders, marchTo, onMarch, march, battles }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [given, setGiven] = useState(null);
  // A different hex is a different decision, so the menu shuts and whatever was
  // picked on the last one stops being displayed against this one.
  useEffect(() => {
    setMenuOpen(false);
    setGiven(null);
  }, [tile?.index]);
  // A menu that stays open while you go back to the map is a menu you have to
  // dismiss twice. Escape and a click anywhere else both shut it.
  useEffect(() => {
    if (!menuOpen) return undefined;
    const shut = (event) => {
      if (event.type === 'keydown' && event.key !== 'Escape') return;
      if (event.type === 'pointerdown' && event.target.closest('.dossier__orders')) return;
      setMenuOpen(false);
    };
    window.addEventListener('keydown', shut);
    window.addEventListener('pointerdown', shut);
    return () => {
      window.removeEventListener('keydown', shut);
      window.removeEventListener('pointerdown', shut);
    };
  }, [menuOpen]);
  const available = ordersFor({ power, day, tile });
  const arriving = (orders ?? []).filter((o) => o.to === tile?.index).length;
  // The last time anybody fought over this hex.
  const here = (battles ?? []).find((b) => b.cell === tile?.index) ?? null;

  if (!open) {
    return (
      <div className="dossier dossier--shut">
        <div className="dossier__bar">
          <button type="button" className="dossier__handle" onClick={onToggle}>
            <span className="dossier__chevron">▲</span>
            {tile ? `${tile.city ? `${tile.city.name} — ` : ''}${tile.terrain.name} · ${tile.label}` : 'Hex dossier'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dossier">
      <div className="dossier__bar">
        <button type="button" className="dossier__handle" onClick={onToggle}>
          <span className="dossier__chevron">▼</span>
          {tile ? `${tile.city ? `${tile.city.name} — ` : ''}${tile.terrain.name} · ${tile.label}` : 'Hex dossier'}
        </button>
        {master ? (
          <em className="dossier__seat">every hex, no fog</em>
        ) : (
          <div className="dossier__orders">
            {orders?.length > 0 && (
              <span className="dossier__given">
                {orders.length} column{orders.length === 1 ? '' : 's'} marching tomorrow
              </span>
            )}
            {given && <span className="dossier__given">{given} — not yet sent</span>}
            <button
              type="button"
              className={`dossier__actions${menuOpen ? ' is-open' : ''}`}
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
            >
              Actions
            </button>
            {menuOpen && (
              <div className="dossier__menu" role="menu">
                {available.map((order) => (
                  <button
                    type="button"
                    key={order.id}
                    role="menuitem"
                    disabled={!order.allowed}
                    title={order.why ?? order.hint}
                    onClick={() => {
                      setMenuOpen(false);
                      // Reinforce is the one that does something now: it opens
                      // the march planner on this hex. The other two are still
                      // waiting on a combat model.
                      // Both of these are the same act: you march onto a
                      // hex. Whether it is a reinforcement or an attack is
                      // decided by who is standing there when you arrive, not
                      // by which button was pressed.
                      if (order.id === 'reinforce' || order.id === 'attack') onMarch?.();
                      else setGiven(order.name);
                    }}
                  >
                    <span>{order.name}</span>
                    <em>{order.allowed ? order.hint : order.why}</em>
                  </button>
                ))}
                <p className="dossier__menu-note">
                  The turn engine takes no orders yet. These say what you would do, and the board
                  already knows which of them it would let you.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {march ? (
        march
      ) : !tile ? (
        <p className="dossier__empty">
          Click a cell. Everything known about it appears here at once — the ground, the people,
          what it produces and what is standing on it — whichever layer the map is showing.
        </p>
      ) : (
        <div className="dossier__columns">
          {/* The ground belongs to the Terrain view. On Nations you are asking
              who holds a hex and on Output what comes out of it, and neither
              question is answered by how wet it is. */}
          {layer === null && (
          <Column title="The ground">
            <Row label="Terrain" value={tile.terrain.name} swatch={tile.terrain.color} />
            {/* Both of these are stored as 0-1 and have to be read back out:
                elevation over the relief band the height byte covers, and
                temperature over the range the climate model was built on. */}
            <Row label="Elevation" value={`${(Math.max(0, tile.elevation) * 7000).toFixed(0)} m`} />
            <Row label="Temperature" value={`${Math.round(tile.temperature * 60 - 30)}°C`} />
            <Row label="Rainfall" value={rainfall(tile.moisture)} />
            <Row label="Move cost" value={tile.terrain.move} />
          </Column>
          )}

          <Column title="The place">
            <Row label="Position" value={tile.label} />
            <Row label="Region" value={tile.territory ?? '—'} />
            <Row
              label="Country"
              value={tile.country?.name ?? '—'}
              swatch={tile.country?.color}
            />
            <Row
              label="Held by"
              value={tile.nation?.name ?? 'Nobody'}
              swatch={tile.nation?.color}
            />
          </Column>

          <Column title="The people">
            {tile.city ? (
              <>
                <Row label="City" value={tile.city.name} />
                <Row label="In the city" value={formatPopulation(tile.city.population)} />
                <Row label="Around it" value={formatPopulation(tile.city.rural ?? 0)} />
                {tile.city.merged.length > 1 && (
                  <Row label="With" value={tile.city.merged.slice(1).join(', ')} />
                )}
              </>
            ) : (
              <>
                <Row label="Population" value={formatPopulation(tile.population)} />
                <Row label="City" value="none" />
              </>
            )}
          </Column>

          <Column title="What it makes">
            {tile.resources.length ? (
              tile.resources.map((r) => (
                <Row
                  key={r.id}
                  label={r.name}
                  value={formatAmount(r.amount, r.unit)}
                  swatch={r.color}
                />
              ))
            ) : (
              <p className="dossier__none">Nothing worth counting.</p>
            )}
            {tile.sites?.length > 0 && (
              <Row label="Works" value={tile.sites.map((s) => s.name).join(', ')} />
            )}
          </Column>

          {here && (
            <Column title="The fighting">
              <Row label="Day" value={here.day} />
              <Row
                label="Attacker"
                value={`${here.attacker} · ${here.attack.toLocaleString()}`}
              />
              <Row
                label="Defender"
                value={`${here.defender} · ${here.defence.toLocaleString()}`}
              />
              <Row
                label="Held by"
                value={here.winner === 'attacker' ? here.attacker : here.defender}
              />
              <p className="dossier__field">
                {here.winner === 'attacker'
                  ? here.pocket
                    ? 'The defenders were destroyed where they stood — there was nowhere to fall back to.'
                    : 'The defenders fell back.'
                  : 'The attack was thrown back the way it came.'}
                {` The beaten side lost ${Math.round(here.loserShare * 100)}% of what it brought, the winner ${Math.round(here.winnerShare * 100)}%.`}
              </p>
            </Column>
          )}

          <Column title="What holds it" wide>
            {tile.forcesUnknown ? (
              <p className="dossier__none">
                Not known — this ground is held by the other side and nobody on yours is looking at
                it.
              </p>
            ) : tile.forces.length ? (
              <>
                <div className="dossier__arms">
                  {UNITS.map((unit, i) => {
                    const count = tile.forces.find((f) => f.id === unit.id)?.count ?? 0;
                    if (!count) return null;
                    return (
                      <span className="dossier__arm" key={unit.id}>
                        <i style={{ background: unit.color }} />
                        {unit.short} <strong>{formatUnits(count)}</strong>
                      </span>
                    );
                  })}
                </div>
                <p className="dossier__field">
                  {tile.fieldInfantry === 0
                    ? 'None of these men are field troops.'
                    : `${formatUnits(tile.fieldInfantry)} of them are field troops.`}
                  {tile.airbase ? ' There is an airfield here.' : ''}
                </p>
                <ul className="dossier__units">
                  {tile.garrison.map((unit) => (
                    <li key={unit.id} title={unit.source}>
                      <span>{unit.name}</span>
                      <em>{ROLES[unit.type]?.name ?? unit.type}</em>
                    </li>
                  ))}
                </ul>
                {arriving > 0 && (
                  <p className="dossier__field">
                    {arriving} column{arriving === 1 ? '' : 's'} ordered here for tomorrow.
                  </p>
                )}
              </>
            ) : (
              <p className="dossier__none">Nobody is holding this ground.</p>
            )}
          </Column>

          {tile.fleet && (
            <Column title="At anchor">
              <Row label="Station" value={tile.fleet.name} />
              {tile.fleetKnown ? (
                SHIPS.map((ship) =>
                  tile.fleet.ships[ship.id] > 0 ? (
                    <Row
                      key={ship.id}
                      label={ship.name}
                      value={tile.fleet.ships[ship.id]}
                      swatch={ship.color}
                    />
                  ) : null,
                )
              ) : (
                <p className="dossier__none">Strength not known.</p>
              )}
            </Column>
          )}
        </div>
      )}
    </div>
  );
}

/** The moisture figure is 0-1 vegetation cover; say it in words. */
function rainfall(m) {
  if (m >= 0.75) return 'very wet';
  if (m >= 0.5) return 'wet';
  if (m >= 0.3) return 'moderate';
  if (m >= 0.15) return 'dry';
  return 'arid';
}

function Column({ title, children, wide }) {
  return (
    <section className={`dossier__column${wide ? ' dossier__column--wide' : ''}`}>
      <h4>{title}</h4>
      {children}
    </section>
  );
}

function Row({ label, value, swatch }) {
  return (
    <div className="dossier__row">
      <span className="dossier__label">
        {swatch && <i style={{ background: swatch }} />}
        {label}
      </span>
      <span className="dossier__value">{value}</span>
    </div>
  );
}
