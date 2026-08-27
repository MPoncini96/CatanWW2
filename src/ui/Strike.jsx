import { useMemo } from 'react';
import { formatUnits } from '../world/forces.js';
import { formationName } from '../world/deploy.js';
import { BOMBER_RANGE, airCombat, defenceOf, hexesApart } from '../game/bombing.js';
import { groundBonus } from '../game/combat.js';
import { MEN_PER_BOMBER, WORST_STRIKE, mayStrike } from '../game/strike.js';

/**
 * Sending the bombers against an army.
 *
 * The other half of what aircraft are for, and the half this board did not
 * have: a raid on a works shuts a factory, and this one hurts the men standing
 * on a hex you are about to attack.
 *
 * The panel leads with the cover, because that is the decision. Troops in the
 * open on a plain take the full weight; the same troops in mountains or a city
 * take half of it, for the same reason they are hard to shell — and finding
 * that out after the bombers have gone is the wrong time.
 */
export function Strike({
  world,
  power,
  day,
  cell,
  positions,
  strengths,
  raids,
  striking,
  onToggle,
  onSend,
  onCancel,
  busy,
  error,
}) {
  const chosen = useMemo(() => new Set((striking ?? []).map((s) => s.column)), [striking]);

  // Everybody who flew today is turned round; the same rule as a raid, and the
  // same list, because a group flies one mission in a day whichever it is.
  const flown = useMemo(
    () =>
      new Set(
        (raids ?? []).filter((r) => r.day === day).flatMap((r) => r.columns ?? []),
      ),
    [raids, day],
  );

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
        why: mayStrike({
          world,
          column: { ...column, strength: have },
          target: cell,
          power,
          day,
          positions,
          flown,
          ordered: new Set([...chosen].filter((id) => id !== column.id)),
        }),
      });
    }
    return out.sort((a, b) => Number(Boolean(a.why)) - Number(Boolean(b.why)) || a.away - b.away);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, power, day, cell, positions, strengths, flown, chosen]);

  const against = useMemo(
    () => defenceOf(world, cell, power, positions, strengths, day),
    [world, cell, power, positions, strengths, day],
  );

  // What is standing there, and how much the ground is doing for it.
  const { men, cover } = useMemo(() => {
    let n = 0;
    for (const column of world.garrisons.opening) {
      if (column.formation.nation === power) continue;
      if ((positions?.get(column.id) ?? column.cell) !== cell) continue;
      n += (strengths?.get(column.id) ?? column.strength).infantry ?? 0;
    }
    return { men: n, cover: groundBonus(world, cell) };
  }, [world, power, cell, positions, strengths]);

  const sending = groups.filter((g) => chosen.has(g.column.id));
  const bombers = sending.reduce((n, g) => n + g.bombers, 0);
  const escort = sending.reduce((n, g) => n + g.fighters, 0);

  // What is lost getting there, and so what actually arrives over the hex.
  const flight = {
    guardFighters: against.fighters,
    guardFlak: against.flak,
    bombers: sending.reduce((n, g) => n + g.bombers * g.quality, 0),
  };
  const cost = airCombat({
    ...flight,
    escort: sending.reduce((n, g) => n + g.fighters * g.quality, 0),
  }).bomberShare;
  const through = Math.round(bombers * (1 - cost));
  const hurt = men > 0 ? Math.min(WORST_STRIKE, (through * MEN_PER_BOMBER) / cover / men) : 0;

  return (
    <div className="march">
      <div className="march__head">
        <h4>
          Strike the troops here
          <em>
            {men > 0
              ? `${formatUnits(men)} men · the ground is worth ${cover.toFixed(2)} to them`
              : 'there is nobody standing here'}
          </em>
        </h4>
        <div className="march__buttons">
          {error && <span className="march__error">{error}</span>}
          <span className="march__count">
            {bombers
              ? `${formatUnits(bombers)} bombers${escort ? ` and ${formatUnits(escort)} escort` : ''} · about ${formatUnits(Math.round(men * hurt))} men, losing ${Math.round(cost * 100)}%`
              : escort
                ? `${formatUnits(escort)} fighters sweeping · nothing to drop`
                : `defended by ${Math.round(against.fighters)} fighters and ${Math.round(against.flak)} guns`}
          </span>
          <button type="button" className="march__drop" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="march__send" onClick={onSend} disabled={busy}>
            {busy ? 'Saving…' : 'Save & close'}
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
        The air goes in before the infantry does, so bombing a hex and then assaulting it is one
        day's plan. Air power never took a position on its own — the ceiling is{' '}
        {Math.round(WORST_STRIKE * 100)}% of what is standing there, however much you send, and the
        ground still has to be won on the ground.
      </p>
    </div>
  );
}
