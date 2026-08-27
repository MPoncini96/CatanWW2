import { useMemo } from 'react';
import { formatUnits } from '../world/forces.js';
import { formationName } from '../world/deploy.js';
import { BOMBER_RANGE, airCombat, defenceOf, hexesApart, mayRaid } from '../game/bombing.js';

/**
 * Sending the bombers.
 *
 * Chosen from the target rather than from the airfield, like everything else
 * here: you pick the works you want shut and the panel lists every group that
 * can reach it and come back. The ones that cannot say why — usually because
 * they are four hundred kilometres too far away, which was the whole difficulty
 * of the thing.
 *
 * What it will cost is shown before it is ordered, because that is the decision:
 * a defended target takes a fifth of what you send, and an undefended one takes
 * almost nothing. It is the only number anybody argued about for six years.
 */
export function Raid({
  world,
  power,
  day,
  cell,
  positions,
  strengths,
  raids,
  raiding,
  onToggle,
  onSend,
  onCancel,
  busy,
  error,
}) {
  const chosen = useMemo(() => new Set((raiding ?? []).map((r) => r.column)), [raiding]);

  const groups = useMemo(() => {
    const out = [];
    for (const column of world.garrisons.opening) {
      if (column.formation.nation !== power) continue;
      const have = strengths?.get(column.id) ?? column.strength;
      // Fighters count too. A group of them ordered against a target is flying
      // escort, which is the one offensive thing a fighter does here.
      if (!(have.bombers > 0) && !(have.fighters > 0)) continue;
      const at = positions?.get(column.id) ?? column.cell;
      out.push({
        column,
        bombers: have.bombers ?? 0,
        fighters: have.fighters ?? 0,
        quality: column.formation.quality ?? 0.5,
        away: hexesApart(at, cell),
        why: mayRaid({
          world,
          column: { ...column, strength: have },
          target: cell,
          power,
          day,
          positions,
          raids,
          ordered: new Set([...chosen].filter((id) => id !== column.id)),
        }),
      });
    }
    return out.sort((a, b) => Number(Boolean(a.why)) - Number(Boolean(b.why)) || a.away - b.away);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, power, day, cell, positions, strengths, raids, chosen]);

  const against = useMemo(
    () => defenceOf(world, cell, power, positions, strengths, day),
    [world, cell, power, positions, strengths, day],
  );

  const sending = groups.filter((g) => chosen.has(g.column.id));
  const bombers = sending.reduce((n, g) => n + g.bombers, 0);
  const escort = sending.reduce((n, g) => n + g.fighters, 0);
  const works = (world.works ?? []).filter((w) => w.cell === cell);

  // What the escort is buying, which is the only reason to send one: the same
  // bombers over the same target, with and without it.
  const flight = {
    guardFighters: against.fighters,
    guardFlak: against.flak,
    bombers: sending.reduce((n, g) => n + g.bombers * g.quality, 0),
  };
  const weight = sending.reduce((n, g) => n + g.fighters * g.quality, 0);
  const cost = airCombat({ ...flight, escort: weight }).bomberShare;
  const alone = airCombat({ ...flight, escort: 0 }).bomberShare;

  return (
    <div className="march">
      <div className="march__head">
        <h4>
          Bomb {works.map((w) => w.name).join(', ') || 'this hex'}
          <em>
            {works.length
              ? `${works.reduce((n, w) => n + w.output, 0).toLocaleString()} kt of steel a year`
              : 'nothing here to put out of action'}
          </em>
        </h4>
        <div className="march__buttons">
          {error && <span className="march__error">{error}</span>}
          <span className="march__count">
            {bombers
              ? `${formatUnits(bombers)} bombers${escort ? ` and ${formatUnits(escort)} escort` : ''} · losing about ${Math.round(cost * 100)}%${escort ? ` instead of ${Math.round(alone * 100)}%` : ''}`
              : escort
                ? `${formatUnits(escort)} fighters sweeping · nothing to drop`
                : `defended by ${Math.round(against.fighters)} fighters and ${Math.round(against.flak)} guns`}
          </span>
          <button type="button" onClick={onCancel} disabled={busy}>
            Done
          </button>
          <button type="button" className="march__send" onClick={onSend} disabled={busy}>
            {busy ? 'Sending…' : 'Send orders'}
          </button>
        </div>
      </div>

      {!groups.length ? (
        <p className="march__none">You have no aircraft anywhere.</p>
      ) : (
        <ul className="march__list">
          {groups.map(({ column, bombers: n, fighters: f, away, why }) => (
            <li key={column.id} className={why ? 'is-barred' : ''}>
              <label>
                <input
                  type="checkbox"
                  checked={chosen.has(column.id)}
                  disabled={Boolean(why) || busy}
                  onChange={() => onToggle(column.id, cell)}
                />
                <span className="march__name">{formationName(column.formation)}</span>
                <span className="march__from">
                  {Math.round(away)} hexes {away <= BOMBER_RANGE ? 'away' : '— too far'}
                </span>
                <span className="march__men">
                  {[
                    n ? `${formatUnits(n)} bombers` : '',
                    f ? `${formatUnits(f)} escort` : '',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </label>
              {why && <p className="march__why">{why}</p>}
            </li>
          ))}
        </ul>
      )}
      <p className="march__none" style={{ marginTop: '6px' }}>
        Everything sent against one works on one night is one raid: a large formation saturates the
        defence that a small one is destroyed by. What gets through decides how long the works is
        out, and a group that flies is turned round the next day and cannot go again. Fighters sent
        with them fly escort — they hold the interceptors off the bombers and fight them for it, but
        they can do nothing at all about the flak.
      </p>
    </div>
  );
}
