import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GlobeView } from '../render/globeView.js';
import { loadEarth } from '../world/earth.js';
import { EARTH_RADIUS_KM, TILE_COUNT } from '../world/sphere.js';
import { TERRAIN } from '../world/terrain.js';
import { formatPopulation } from '../world/population.js';
import { RESOURCES, formatAmount } from '../world/resources.js';
import { NATIONS, NEUTRAL } from '../world/nations.js';
import { UNITS, formatUnits } from '../world/forces.js';
import { Minimap } from './Minimap.jsx';
import { SeatPicker } from './SeatPicker.jsx';
import { WarRoom } from './WarRoom.jsx';
import { WarLedger } from './WarLedger.jsx';
import { EventCard } from './EventCard.jsx';
import { claimSeat, fetchState, leaveSeat, savedSession, setReady, watch } from '../game/client.js';

// Every cell is the same size now, so there is a single honest number for it.
const KM2_PER_CELL = Math.round((4 * Math.PI * EARTH_RADIUS_KM ** 2) / TILE_COUNT);
const KM_PER_CELL = Math.round(Math.sqrt(KM2_PER_CELL));

/** The hovered tile's output of the resource currently on show. */
function overlayValue(tile, overlay) {
  if (!overlay) return null;
  const found = tile.resources.find((r) => r.id === overlay);
  return found ? ` · ${found.name} ${formatAmount(found.amount, found.unit)}` : null;
}

function pct(value) {
  return `${Math.round(value * 100)}%`;
}

function TileInspector({ tile }) {
  if (!tile) {
    return (
      <div className="panel panel--empty">
        <h2>No cell selected</h2>
        <p>Click anywhere on the globe to inspect it.</p>
      </div>
    );
  }
  const city = tile.city;
  return (
    <div className="panel">
      <div
        className={`panel__swatch${city ? ' panel__swatch--city' : ''}`}
        style={{ background: tile.terrain.color }}
      />
      <div className="panel__body">
        <h2>{city ? city.name : tile.terrain.name}</h2>
        <p className="panel__coords">
          {city ? `${tile.terrain.name} · ` : ''}
          {tile.label}
        </p>
        {tile.nation && (
          <p className="panel__owner">
            <span className="panel__flag" style={{ background: tile.nation.color }} />
            {tile.country ? tile.country.name : tile.nation.name}
            {/* A colony names its metropole rather than reporting itself
                Independent, which is what a colony most certainly was not. */}
            {tile.country?.sovereign
              ? ` · ${tile.country.sovereign}`
              : tile.country && tile.country.name !== tile.nation.name
                ? ` · ${tile.nation.name}`
                : ''}
          </p>
        )}
        {tile.country?.dominion && (
          <p className="panel__note">
            A self-governing Dominion. It is drawn as the United Kingdom because there are eight
            seats, but it had its own parliament and declared war on its own account.
          </p>
        )}
        {tile.country && tile.country.leanAllied !== undefined && (
          <div className="lean">
            <div className="lean__bar">
              <span className="lean__allies" style={{ width: `${tile.country.leanAllied}%` }} />
              <span className="lean__axis" style={{ width: `${100 - tile.country.leanAllied}%` }} />
            </div>
            <p className="lean__legend">
              <span>Allies {tile.country.leanAllied}%</span>
              <span>Axis {100 - tile.country.leanAllied}%</span>
            </p>
          </div>
        )}
        <dl>
          {city && (
            <div>
              <dt>City (1939)</dt>
              <dd>{formatPopulation(city.population)}</dd>
            </div>
          )}
          <div>
            <dt>{city ? 'Surrounding' : 'Population'}</dt>
            <dd>{formatPopulation(city ? city.rural : tile.population)}</dd>
          </div>
          <div>
            <dt>Move cost</dt>
            <dd>{tile.terrain.move}</dd>
          </div>
        </dl>
        {city && city.merged.length > 1 && (
          <p className="panel__note">with {city.merged.slice(1).join(', ')}</p>
        )}
        {tile.forces.length > 0 && (
          <div className="output">
            <h3>Garrison, 1939</h3>
            {tile.forces.map((u) => (
              <div className="output__row" key={u.id}>
                <span className="output__dot" style={{ background: u.color }} />
                <span className="output__name">{u.name}</span>
                <strong>{formatUnits(u.count)}</strong>
              </div>
            ))}
          </div>
        )}
        {tile.resources.length > 0 && (
          <div className="output">
            <h3>Output, 1939</h3>
            {tile.resources.map((r) => (
              <div className="output__row" key={r.id}>
                <span className="output__dot" style={{ background: r.color }} />
                <span className="output__name">{r.name}</span>
                <strong>{formatAmount(r.amount, r.unit)}</strong>
              </div>
            ))}
            {tile.sites.length > 0 && (
              <p className="panel__note">{tile.sites.map((x) => x.name).join(' · ')}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const canvasRef = useRef(null);
  const overlayRef = useRef(null);
  const viewRef = useRef(null);
  const [world, setWorld] = useState(null);
  const [error, setError] = useState(null);
  const [hover, setHover] = useState(null);
  const [selected, setSelected] = useState(null);
  const [cam, setCam] = useState(null);
  const [legendOpen, setLegendOpen] = useState(false);
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [showCities, setShowCities] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [overlay, setOverlay] = useState(null);
  const [ownershipVersion, setOwnershipVersion] = useState(0);

  // The one game, and this browser's seat at it.
  const [session, setSession] = useState(() => savedSession());
  const [game, setGame] = useState(null);
  const [seatError, setSeatError] = useState(null);
  const [busy, setBusy] = useState(false);
  // Dispatches this browser has not yet been shown. The log is the record; this
  // is only what is currently in the way.
  const [seen, setSeen] = useState(() => new Set());

  // Follow the game: one fetch to start, then the stream carries every change.
  // Every frame is tagged with the token it was produced for, because the seat
  // a frame reports is only meaningful for the identity that asked.
  useEffect(() => {
    let live = true;
    const token = session?.token ?? null;
    const receive = (state) => live && setGame({ ...state, forToken: token });
    fetchState(token).then(receive, () => {});
    const stop = watch(token, receive);
    return () => {
      live = false;
      stop();
    };
  }, [session?.token]);

  // A seat that vanished from under us — the server restarted, or someone
  // released it — means this browser is no longer playing. Only a frame
  // produced for this very token can say so: one still in flight from the
  // previous connection knows nothing about the seat just taken, and acting on
  // it would log the player straight back out again.
  useEffect(() => {
    if (!session || !game) return;
    if (game.forToken === session.token && game.you === null) setSession(null);
  }, [game, session]);

  const takeSeat = useCallback(async (power, name) => {
    setSeatError(null);
    try {
      setSession(await claimSeat(power, name));
    } catch (err) {
      setSeatError(err.message);
    }
  }, []);

  const logOut = useCallback(async () => {
    await leaveSeat(session?.token);
    setSession(null);
    const fresh = await fetchState(null).catch(() => null);
    setGame(fresh ? { ...fresh, forToken: null } : null);
  }, [session?.token]);

  const declareReady = useCallback(
    async (ready) => {
      setBusy(true);
      try {
        setGame({ ...(await setReady(session.token, ready)), forToken: session.token });
      } catch (err) {
        setSeatError(err.message);
      } finally {
        setBusy(false);
      }
    },
    [session?.token],
  );

  // Anything the timeline has said that this browser has not acknowledged.
  const pending = useMemo(
    () => (game?.log ?? []).filter((e) => !seen.has(e.id)),
    [game, seen],
  );
  const dismiss = useCallback(() => {
    setSeen((prev) => {
      const next = new Set(prev);
      if (pending[0]) next.add(pending[0].id);
      return next;
    });
  }, [pending]);

  // Only legend the terrains this map actually contains.
  const present = useMemo(() => {
    if (!world) return [];
    const seen = new Set(world.biome);
    return TERRAIN.filter((_, i) => seen.has(i));
  }, [world]);

  useEffect(() => {
    let cancelled = false;
    loadEarth().then(
      (loaded) => !cancelled && setWorld(loaded),
      (err) => !cancelled && setError(err.message),
    );
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!world) return undefined;
    const view = new GlobeView(canvasRef.current, overlayRef.current, world, {
      onHover: setHover,
      onSelect: setSelected,
      onCamera: setCam,
    });
    viewRef.current = view;
    if (import.meta.env.DEV) window.__globe = view; // handy for perf probing
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [world]);

  useEffect(() => {
    viewRef.current?.setShowCities(showCities);
  }, [showCities, world]);

  useEffect(() => {
    viewRef.current?.setShowLabels(showLabels);
  }, [showLabels, world]);

  useEffect(() => {
    viewRef.current?.setOverlay(overlay);
  }, [overlay, world]);

  // Territory can change hands, so the HUD follows the ownership layer.
  useEffect(() => {
    if (!world?.ownership) return undefined;
    return world.ownership.onChange((o) => setOwnershipVersion(o.version));
  }, [world]);

  // Land tiles per power, largest first, neutrals last. Follows the ownership
  // layer, so it stays right when territory changes hands.
  const tally = useMemo(() => {
    if (!world?.ownership) return [];
    const counts = world.ownership.tally();
    return NATIONS.map((nation, i) => ({ nation, tiles: counts[i], i }))
      .filter((row) => row.tiles > 0 && row.i !== NEUTRAL)
      .sort((a, b) => b.tiles - a.tiles)
      .concat(
        counts[NEUTRAL] > 0 ? [{ nation: NATIONS[NEUTRAL], tiles: counts[NEUTRAL], i: NEUTRAL }] : [],
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, ownershipVersion]);

  // The minimap is an equirectangular sheet; clicking it names a latitude and
  // longitude to turn the globe to.
  const jump = useCallback((fx, fy) => {
    viewRef.current?.centerOn(90 - fy * 180, fx * 360 - 180);
  }, []);

  const zoomLabel = cam ? `${cam.pixelsPerCell.toFixed(1)} px/cell` : '';

  if (error) {
    return (
      <div className="app app--message">
        <div className="panel panel--empty">
          <h2>Could not load the world</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand__mark" aria-hidden="true" />
          <div>
            <h1>Terra</h1>
            <p>Earth on a hex globe</p>
          </div>
        </div>
        <div className="layers" role="group" aria-label="Map layer">
          <button
            type="button"
            className={overlay === null ? 'is-active' : ''}
            onClick={() => setOverlay(null)}
          >
            Terrain
          </button>
          <button
            type="button"
            className={overlay === 'nations' ? 'is-active' : ''}
            onClick={() => setOverlay(overlay === 'nations' ? null : 'nations')}
          >
            <i className="layers__flag" />
            Nations
          </button>
          <button
            type="button"
            className={overlay === 'forces' ? 'is-active' : ''}
            onClick={() => setOverlay(overlay === 'forces' ? null : 'forces')}
          >
            <i className="layers__forces" />
            Forces
          </button>
          {RESOURCES.map((r) => (
            <button
              key={r.id}
              type="button"
              className={overlay === r.id ? 'is-active' : ''}
              onClick={() => setOverlay(overlay === r.id ? null : r.id)}
            >
              <i style={{ background: r.color }} />
              {r.name}
            </button>
          ))}
        </div>

        <div className="topbar__stats">
          <span>
            <strong>{TILE_COUNT.toLocaleString()}</strong> cells
          </span>
          <span>
              <strong>{KM2_PER_CELL.toLocaleString()}</strong> km² each
          </span>
          <span>
            <strong>{world ? formatPopulation(world.totalPopulation) : '—'}</strong> people ·{' '}
            <strong>{world ? world.cities.length : '—'}</strong> cities
          </span>
        </div>

        <div className="topbar__actions">
          <label className="toggle">
            <input
              type="checkbox"
              checked={showLabels}
              onChange={(e) => setShowLabels(e.target.checked)}
            />
            Names
          </label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={showCities}
              onChange={(e) => setShowCities(e.target.checked)}
            />
            Cities
          </label>
        </div>
      </header>

      <main className="stage">
        <canvas ref={canvasRef} className="map" tabIndex={0} />
        <canvas ref={overlayRef} className="map map--overlay" />
        {!world && <div className="loading">Loading Earth…</div>}

        <div className="overlay overlay--left">
          <TileInspector tile={selected} />
          {overlay === 'forces' && world && (
            <div className="legend legend--static">
              <div className="legend__items">
                {UNITS.map((u, i) => (
                  <span key={u.id} className="legend__item">
                    <i style={{ background: u.color }} />
                    {u.name}
                    <em>{formatUnits(world.forceTotals[i])}</em>
                  </span>
                ))}
              </div>
            </div>
          )}
          {overlay === 'nations' && tally.length > 0 && (
            <div className="legend legend--static">
              <div className="legend__items">
                {tally.map(({ nation, tiles }) => (
                  <span key={nation.id} className="legend__item">
                    <i style={{ background: nation.color }} />
                    {nation.name}
                    <em>{tiles}</em>
                  </span>
                ))}
              </div>
              <p className="legend__note">
                Eight powers, so Canada, Australia, New Zealand, South Africa and Newfoundland are
                drawn as the United Kingdom — they were self-governing and declared war separately.
                Independent covers both the genuinely neutral and the colonies of neutral powers:
                the Congo is Belgian, the East Indies Dutch, Angola Portuguese.
              </p>
            </div>
          )}
          <details className="legend" open={legendOpen} onToggle={(e) => setLegendOpen(e.currentTarget.open)}>
            <summary>Terrain · {present.length}</summary>
            <div className="legend__items">
              {present.map((t) => (
                <span key={t.id} className="legend__item">
                  <i style={{ background: t.color }} />
                  {t.name}
                </span>
              ))}
            </div>
          </details>
        </div>

        <div className="overlay overlay--right">
          <WarRoom
            state={game}
            onReady={declareReady}
            onLeave={logOut}
            onLedger={() => setLedgerOpen(true)}
            busy={busy}
          />
          <div className="zoom">
            <button type="button" onClick={() => viewRef.current?.zoomBy(1.35)} disabled={cam?.atMax}>
              +
            </button>
            <div className="zoom__bar">
              <div className="zoom__fill" style={{ height: pct(1 - (cam?.altitude ?? 1)) }} />
            </div>
            <button
              type="button"
              onClick={() => viewRef.current?.zoomBy(1 / 1.35)}
              disabled={cam?.atMin}
            >
              −
            </button>
            <button type="button" className="zoom__reset" onClick={() => viewRef.current?.reset()}>
              ⤢
            </button>
          </div>
          {world && <Minimap world={world} viewport={cam} onJump={jump} />}
        </div>

        <footer className="statusbar">
          <span className="statusbar__hint">Drag to turn · scroll to zoom · click a cell</span>
          <span className="statusbar__cursor">
            {hover
              ? `${hover.city ? `${hover.city.name} · ` : ''}${hover.terrain.name} — ${hover.label}` +
                // Region first, then who holds it, and the nation alone only
                // where the two are the same name — Germany in Germany. A cell
                // that reads as a bare nation anywhere else is a cell standing
                // in no region, which is a bug and should look like one.
                (hover.country ? ` · ${hover.country.name}` : '') +
                (hover.nation && hover.nation.name !== hover.country?.name
                  ? ` · ${hover.nation.name}`
                  : '') +
                (hover.population ? ` · ${formatPopulation(hover.population)}` : '') +
                (overlay === 'forces' && hover.forces.length
                  ? ` · ${hover.forces.map((u) => `${u.short} ${formatUnits(u.count)}`).join(' ')}`
                  : '') +
                (overlayValue(hover, overlay) ?? '')
              : `Earth, 1939 · ${KM_PER_CELL} km across every cell, pole to equator`}
          </span>
          <span className="statusbar__zoom">{zoomLabel}</span>
        </footer>
      </main>

      {ledgerOpen && <WarLedger state={game} onClose={() => setLedgerOpen(false)} />}
      {game && !session && <SeatPicker seats={game.seats} onClaim={takeSeat} error={seatError} />}
      {session && pending.length > 0 && (
        <EventCard event={pending[0]} onDismiss={dismiss} remaining={pending.length} />
      )}
    </div>
  );
}
