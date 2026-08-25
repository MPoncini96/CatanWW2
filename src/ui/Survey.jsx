import { useMemo } from 'react';
import { NATIONS, NEUTRAL } from '../world/nations.js';
import { UNIT_INDEX, formatUnits } from '../world/forces.js';
import { Link, pathOf } from './routes.jsx';

/**
 * The board from above, for the seat that is not playing.
 *
 * Every other page belongs to a power and shows that power's war: its books,
 * its orders, and only the ground its own troops can see. This one belongs to
 * nobody, so there is nothing to spend and nothing to hide — what it wants
 * instead is the comparison the eight pages cannot make, which is all of them
 * at once.
 *
 * A table would be the obvious shape and it is the wrong one: seven columns of
 * figures do not fit a rail three hundred pixels wide, and the version that
 * did fit had every heading cut off at the third letter. One line a nation
 * instead, in the order that matters — men first, because that is the war.
 */
export function Survey({ world, tally }) {
  const rows = useMemo(() => {
    if (!world?.forcesByNation) return [];
    const hulls = world.navies?.byPower ?? {};
    const land = Object.fromEntries(tally.map((row) => [row.nation.id, row.tiles]));
    return NATIONS.map((nation) => {
      const force = world.forcesByNation[nation.id];
      if (!force) return null;
      return {
        nation,
        tiles: land[nation.id] ?? 0,
        men: force.deployed[UNIT_INDEX.infantry],
        field: force.field,
        tanks: force.deployed[UNIT_INDEX.tanks],
        guns: force.deployed[UNIT_INDEX.artillery],
        air: force.deployed[UNIT_INDEX.fighters] + force.deployed[UNIT_INDEX.bombers],
        hulls: hulls[nation.id]?.hulls ?? 0,
        seat: nation.id !== 'neutral',
      };
    })
      .filter(Boolean)
      .sort((a, b) => b.men - a.men);
  }, [world, tally]);

  return (
    <div className="panel survey">
      <div className="panel__body">
        <h2>Every hex</h2>
        <p className="panel__note">
          Nobody is sitting here, so nothing is hidden: every garrison, every fleet and every hex
          on the globe reads as it is. Pick a nation to see the same board through its eyes.
        </p>
      </div>

      <ul className="survey__list">
        {rows.map((row) => (
          <li key={row.nation.id}>
            <span className="survey__name">
              <i style={{ background: row.nation.color }} />
              {row.seat ? (
                <Link href={pathOf(row.nation.id)}>{row.nation.name}</Link>
              ) : (
                <span>{row.nation.name}</span>
              )}
              <em>{row.tiles.toLocaleString()} cells</em>
            </span>
            <span className="survey__stats">
              <b>{formatUnits(row.men)}</b> men
              <i>·</i>
              <b>{formatUnits(row.field)}</b> in the field
            </span>
            <span className="survey__stats survey__stats--minor">
              {row.tanks.toLocaleString()} tanks
              <i>·</i>
              {row.guns.toLocaleString()} guns
              <i>·</i>
              {row.air.toLocaleString()} aircraft
              {row.hulls > 0 && (
                <>
                  <i>·</i>
                  {row.hulls} hulls
                </>
              )}
            </span>
          </li>
        ))}
      </ul>

      <p className="panel__note">
        Men are everyone under arms; the field army is the part of it that could fight tomorrow.
        The difference is depots, rear-area troops and flak crews, counted apart because a training
        barracks is not a division.
      </p>
    </div>
  );
}
