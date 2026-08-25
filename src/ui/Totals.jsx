import { NATIONS, NEUTRAL } from '../world/nations.js';
import { UNITS, formatUnits } from '../world/forces.js';
import { SHIPS } from '../world/navies.js';

/**
 * What is on the board, counted.
 *
 * This used to sit in the rail under the map key, where it competed with the
 * cell a player had just clicked. It is reference rather than working state —
 * you look at it, close it, and go back to the map — so it belongs behind a
 * button beside the layer switches.
 *
 * The land is public: who holds what has never been a secret. The two military
 * columns are not, and count only what this seat may see, which is why they
 * carry the line saying so.
 */
export function Totals({ tally, navalTotals, forceTotals, player, onClose }) {
  return (
    <>
      <button type="button" className="totals__scrim" onClick={onClose} aria-label="Close" />
      <div className="totals" role="dialog" aria-label="Totals">
        <div className="totals__group">
          <h3>Ground held</h3>
          <ul>
            {tally.map(({ nation, tiles }) => (
              <li key={nation.id}>
                <i style={{ background: nation.color }} />
                <span>{nation.name}</span>
                <strong>{tiles.toLocaleString()}</strong>
              </li>
            ))}
          </ul>
          <p className="totals__note">Cells of {NATIONS[NEUTRAL].name} land included, at the foot.</p>
        </div>

        {navalTotals && (
          <div className="totals__group">
            <h3>At sea</h3>
            <ul>
              {SHIPS.map((ship) => (
                <li key={ship.id}>
                  <i style={{ background: ship.color }} />
                  <span>{ship.name}</span>
                  <strong>{navalTotals[ship.id].toLocaleString()}</strong>
                </li>
              ))}
            </ul>
          </div>
        )}

        {forceTotals && (
          <div className="totals__group">
            <h3>On land</h3>
            <ul>
              {UNITS.map((unit, i) => (
                <li key={unit.id}>
                  <i style={{ background: unit.color }} />
                  <span>{unit.name}</span>
                  <strong>{formatUnits(forceTotals[i])}</strong>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="totals__note totals__note--wide">
          Ground held is everybody's. The fighting strengths are {player.name}, its side and the
          neutrals — what the other side has is not counted here, because it is not known.
        </p>
      </div>
    </>
  );
}
