import { useMemo } from 'react';
import { SHIPS } from '../world/navies.js';
import { hexesApart } from '../game/bombing.js';
import { FLEET_SPEED, mayShip, navigable } from '../game/naval.js';

/**
 * Sending a fleet to sea.
 *
 * Chosen from the water you want it on rather than from the anchorage, which is
 * the same way marches and raids are given here: you click the sea and the
 * panel lists every fleet that could be there tomorrow morning. Six hexes is
 * four hundred kilometres, so the list is short and the ones that are too far
 * say so by how far.
 *
 * Convoys are not on it. They keep a schedule and cannot be ordered anywhere —
 * which is the point of them, and the reason the whole Atlantic could be fought
 * over a line somebody else had already drawn.
 */
export function Sail({ world, power, day, cell, fleets, sailing, onToggle, onSend, onCancel, busy, error }) {
  const chosen = useMemo(() => new Map((sailing ?? []).map((s) => [s.fleet, s.to])), [sailing]);

  const positions = useMemo(
    () => new Map((fleets ?? []).map((f) => [f.id, f.cell])),
    [fleets],
  );

  const mine = useMemo(() => {
    const out = [];
    for (const fleet of fleets ?? []) {
      if (fleet.power !== power || fleet.cargo || !fleet.afloat) continue;
      out.push({
        fleet,
        away: hexesApart(fleet.cell, cell),
        why: mayShip({
          world,
          fleet,
          to: cell,
          power,
          day,
          positions,
          ordered: new Set([...chosen.keys()].filter((id) => id !== fleet.id)),
        }),
      });
    }
    return out.sort((a, b) => Number(Boolean(a.why)) - Number(Boolean(b.why)) || a.away - b.away);
  }, [world, power, day, cell, fleets, positions, chosen]);

  const here = (fleets ?? []).filter((f) => f.cell === cell && f.afloat);
  const water = navigable(world, cell);

  return (
    <div className="march">
      <div className="march__head">
        <h4>
          Sail to this water
          <em>
            {!water
              ? 'there is no water here'
              : here.length
                ? `${here.map((f) => f.name).join(', ')} is already here`
                : 'open sea'}
          </em>
        </h4>
        <div className="march__buttons">
          {error && <span className="march__error">{error}</span>}
          <span className="march__count">
            {chosen.size ? `${chosen.size} fleet${chosen.size === 1 ? '' : 's'} sailing` : 'none sailing'}
          </span>
          <button type="button" onClick={onCancel} disabled={busy}>
            Done
          </button>
          <button type="button" className="march__send" onClick={onSend} disabled={busy}>
            {busy ? 'Sending…' : 'Send orders'}
          </button>
        </div>
      </div>

      {!mine.length ? (
        <p className="march__none">You have no fleets at sea.</p>
      ) : (
        <ul className="march__list">
          {mine.map(({ fleet, away, why }) => (
            <li key={fleet.id} className={why ? 'is-barred' : ''}>
              <label>
                <input
                  type="checkbox"
                  checked={chosen.get(fleet.id) === cell}
                  disabled={Boolean(why) || busy}
                  onChange={() => onToggle(fleet.id, cell)}
                />
                <span className="march__name">{fleet.name}</span>
                <span className="march__from">
                  {Math.round(away)} hexes {away <= FLEET_SPEED ? 'away' : '— too far'}
                </span>
                <span className="march__men">
                  {SHIPS.filter((s) => (fleet.ships[s.id] ?? 0) >= 0.5)
                    .map((s) => `${Math.round(fleet.ships[s.id])} ${s.short}`)
                    .join(' · ') || 'no ships'}
                </span>
              </label>
              {why && <p className="march__why">{why}</p>}
            </li>
          ))}
        </ul>
      )}
      <p className="march__none" style={{ marginTop: '6px' }}>
        A fleet makes {FLEET_SPEED} hexes a day and does not stop for the night, which is the one
        way it is not an army. Whatever it meets that it is at war with, it fights: there is no
        holding a hex of water, so the beaten side is the one that loses ships and the winner is
        left with the sea room.
      </p>
    </div>
  );
}
