/**
 * How close the war is to ending.
 *
 * Two columns, because there are two ways it ends and they are not the same
 * shape. The Axis is a checklist of three powers, each of which can be finished
 * off individually. The Allies cannot be finished off individually at all —
 * losing London does not end Britain — so their side is a set of things that
 * must *all* be true at once, and showing them as a row of lights is the only
 * honest way to draw it.
 *
 * Everything here is computed on the server and sent down, so what a player
 * reads and what actually ends the game are one answer rather than two.
 */
export function Standings({ standings, over }) {
  if (!standings) return <p className="legend__note">The board has not been read yet.</p>;

  const { axis, allies } = standings;
  const axisRows = [
    ['Germany', axis.germany],
    ['Italy', axis.italy],
    ['Japan', axis.japan],
  ];

  return (
    <div className="standings">
      {over && (
        <p className={`standings__over is-${over.side}`}>
          <strong>{over.side === 'allies' ? 'The Allies have won.' : 'The Axis has won.'}</strong>{' '}
          {over.why}.
        </p>
      )}

      <h5>The Axis is beaten when all three are</h5>
      <ul className="standings__list">
        {axisRows.map(([name, state]) => (
          <li key={name} className={state.defeated ? 'is-done' : ''}>
            <span className="standings__name">{name}</span>
            <span className="standings__state">
              {state.defeated ? state.why : 'still in the war'}
            </span>
            {!state.defeated && name === 'Japan' && (
              // The one condition with a dial on it rather than a switch.
              <span className="standings__note">
                {state.mainlandGone ? 'the mainland is lost' : 'holds the Asian mainland'}
                {' · '}
                {(state.dead ?? 0).toLocaleString()} civilians dead of the{' '}
                {(state.needed ?? 0).toLocaleString()} that would end it
              </span>
            )}
          </li>
        ))}
      </ul>

      <h5>The Allies are beaten by either of these</h5>
      <ul className="standings__list">
        <li className={allies.capitals.every((c) => c.lost) && allies.china === 0 ? 'is-done' : ''}>
          <span className="standings__name">Europe and China</span>
          <span className="standings__state">
            {allies.capitals.map((c) => (
              <em key={c.name} className={c.lost ? 'is-lost' : ''}>
                {c.name}
              </em>
            ))}
            <em className={allies.china === 0 ? 'is-lost' : ''}>
              China {allies.china > 0 ? `(${allies.china} hexes)` : '(gone)'}
            </em>
          </span>
        </li>
        <li className={allies.cities.every((c) => c.lost) ? 'is-done' : ''}>
          <span className="standings__name">The American seaboard</span>
          <span className="standings__state">
            {allies.cities.map((c) => (
              <em key={c.name} className={c.lost ? 'is-lost' : ''}>
                {c.name}
              </em>
            ))}
          </span>
        </li>
      </ul>
    </div>
  );
}
