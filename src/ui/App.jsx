import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GlobeView } from '../render/globeView.js';
import { loadEarth } from '../world/earth.js';
import { EARTH_RADIUS_KM, TILE_COUNT } from '../world/sphere.js';
import { TERRAIN } from '../world/terrain.js';
import { formatPopulation } from '../world/population.js';
import { RESOURCES, formatAmount } from '../world/resources.js';
import { NATIONS, NATION_INDEX, NEUTRAL } from '../world/nations.js';
import { UNITS, formatUnits } from '../world/forces.js';
import { canSeeForces } from '../world/intel.js';
import { PLAYERS } from '../game/players.js';
import { WarRoom } from './WarRoom.jsx';
import { WarLedger } from './WarLedger.jsx';
import { EventCard } from './EventCard.jsx';
import { NationIndex } from './NationIndex.jsx';
import { Link, powerFromPath, useRoute } from './routes.jsx';
import { claimSeat, fetchState, leaveSeat, savedSession, setReady, watch } from '../game/client.js';

// Every cell is the same size now, so there is a single honest number for it.
const KM2_PER_CELL = Math.round((4 * Math.PI * EARTH_RADIUS_KM ** 2) / TILE_COUNT);
const KM_PER_CELL = Math.round(Math.sqrt(KM2_PER_CELL));

const BY_ID = Object.fromEntries(PLAYERS.map((p) => [p.id, p]));

/** The hovered tile's output of the resource currently on show. */
function overlayValue(tile, overlay) {
  if (!overlay) return null;
  const found = tile.resources.find((r) => r.id === overlay);
  return found ? ` · ${found.name} ${formatAmount(found.amount, found.unit)}` : null;
}

function pct(value) {
  return `${Math.round(value * 100)}%`;
}

/**
 * The cell, read through whichever layer is on show.
 *
 * A hex is a dozen facts at once — terrain, people, owner, sympathy, garrison,
 * six kinds of output — and printing all of them means the one you are looking
 * for is somewhere in the middle of a column. So the panel answers the question
 * the map is currently asking and nothing else: on Terrain it says this is
 * forest and what it costs to cross, on Nations who holds it and which way it
 * leans, on Forces what is standing on it, and on Oil how much oil comes out.
 *
 * The swatch follows the same rule and shows the colour this cell is drawn in,
 * so the panel and the ground agree at a glance.
 */
function TileInspector({ tile, layer }) {
  if (!tile) {
    return (
      <div className="panel panel--empty">
        <h2>No cell selected</h2>
        <p>Click anywhere on the globe to inspect it.</p>
      </div>
    );
  }

  const city = tile.city;
  const resource = layer && layer !== 'nations' ? layer : null;
  const output = resource ? tile.resources.find((r) => r.id === resource) : null;
  const definition = resource ? RESOURCES.find((r) => r.id === resource) : null;

  const swatch =
    layer === 'nations'
      ? (tile.country?.color ?? tile.nation?.color ?? tile.terrain.color)
      : (definition?.color ?? tile.terrain.color);

  return (
    <div className="panel">
      <div
        className={`panel__swatch${city ? ' panel__swatch--city' : ''}`}
        style={{ background: swatch }}
      />
      <div className="panel__body">
        <h2>{city ? city.name : tile.terrain.name}</h2>
        <p className="panel__coords">
          {city ? `${tile.terrain.name} · ` : ''}
          {tile.label}
        </p>

        {/* ---- Terrain: the ground itself, and who lives on it ---- */}
        {layer === null && (
          <>
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
          </>
        )}

        {/* ---- Nations: who holds it, and which way it leans ---- */}
        {layer === 'nations' && tile.nation && (
          <>
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
            {tile.country?.dominion && (
              <p className="panel__note">
                A self-governing Dominion. It is drawn as the United Kingdom because there are
                eight seats, but it had its own parliament and declared war on its own account.
              </p>
            )}
            {tile.country && tile.country.leanAllied !== undefined && (
              <div className="lean">
                <div className="lean__bar">
                  <span className="lean__allies" style={{ width: `${tile.country.leanAllied}%` }} />
                  <span
                    className="lean__axis"
                    style={{ width: `${100 - tile.country.leanAllied}%` }}
                  />
                </div>
                <p className="lean__legend">
                  <span>Allies {tile.country.leanAllied}%</span>
                  <span>Axis {100 - tile.country.leanAllied}%</span>
                </p>
              </div>
            )}
            {/* Who holds it and what they hold it with are one question, so
                they are one section. */}
            {tile.forcesUnknown ? (
              <div className="output output--unknown">
                <h3>Garrison, 1939</h3>
                <p>Not known — this ground is held by the other side.</p>
              </div>
            ) : tile.forces.length > 0 ? (
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
            ) : (
              <div className="output output--unknown">
                <h3>Garrison, 1939</h3>
                <p>Nobody is holding this ground.</p>
              </div>
            )}
          </>
        )}

        {/* ---- One resource: what this cell produced in a year ---- */}
        {resource && (
          <div className={`output${output ? '' : ' output--unknown'}`}>
            <h3>{definition?.name ?? resource}, 1939</h3>
            {output ? (
              <>
                <div className="output__row">
                  <span className="output__dot" style={{ background: output.color }} />
                  <span className="output__name">{output.name}</span>
                  <strong>{formatAmount(output.amount, output.unit)}</strong>
                </div>
                {tile.sites.length > 0 && (
                  <p className="panel__note">{tile.sites.map((x) => x.name).join(' · ')}</p>
                )}
              </>
            ) : (
              <p>None here.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const path = useRoute();
  const power = powerFromPath(path);

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
  const [overlay, setOverlay] = useState('nations');
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

  const takeSeat = useCallback(async (which, name) => {
    setSeatError(null);
    setBusy(true);
    try {
      setSession(await claimSeat(which, name));
    } catch (err) {
      setSeatError(err.message);
    } finally {
      setBusy(false);
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
      setSeatError(null);
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
    const found = new Set(world.biome);
    return TERRAIN.filter((_, i) => found.has(i));
  }, [world]);

  // The world is only built on a nation's page. The index does not need it, and
  // building it there would spend a second of work to show eight links.
  useEffect(() => {
    if (!power || world) return undefined;
    let cancelled = false;
    loadEarth().then(
      (loaded) => !cancelled && setWorld(loaded),
      (err) => !cancelled && setError(err.message),
    );
    return () => {
      cancelled = true;
    };
  }, [power, world]);

  useEffect(() => {
    if (!world || !power) return undefined;
    const view = new GlobeView(canvasRef.current, overlayRef.current, world, {
      onHover: setHover,
      onSelect: setSelected,
      onCamera: setCam,
      viewer: power,
    });
    viewRef.current = view;
    if (import.meta.env.DEV) window.__globe = view; // handy for perf probing
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [world, power]);

  // Whose board this is. Changing it repaints the Forces layer, because what a
  // seat may see moves with the seat.
  useEffect(() => {
    viewRef.current?.setViewer(power);
    setSelected(null);
    setHover(null);
  }, [power, world]);

  // These three run after the view is built, and again whenever it is rebuilt —
  // which is what changing nation does. Leave `power` out of the lists and the
  // new board comes back on the Terrain layer while the button still reads
  // Nations, because the setting never reached the view that replaced the one
  // it was set on.
  useEffect(() => {
    viewRef.current?.setShowCities(showCities);
  }, [showCities, world, power]);

  useEffect(() => {
    viewRef.current?.setShowLabels(showLabels);
  }, [showLabels, world, power]);

  useEffect(() => {
    viewRef.current?.setOverlay(overlay);
  }, [overlay, world, power]);

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

  // Force totals for the legend, counting only what this seat may see. The
  // world's own totals are everybody's, and printing them under a fogged map
  // would hand back in one line exactly what the fog is for.
  const forceTotals = useMemo(() => {
    if (!world?.forcesByNation) return null;
    const totals = UNITS.map(() => 0);
    for (const [id, row] of Object.entries(world.forcesByNation)) {
      if (!canSeeForces(power, NATION_INDEX[id])) continue;
      row.deployed.forEach((count, u) => {
        totals[u] += count;
      });
    }
    return totals;
  }, [world, power]);

  const zoomLabel = cam ? `${cam.pixelsPerCell.toFixed(1)} px/cell` : '';
  const player = power ? BY_ID[power] : null;

  // The index: eight nations and nothing else to decide.
  if (!power) return <NationIndex state={game} />;

  if (error) {
    return (
      <div className="app app--message">
        <div className="panel panel--empty">
          <h2>Could not load the world</h2>
          <p>{error}</p>
          <p>
            <Link href="/">Back to all nations</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <Link className="brand" href="/">
          <span className="brand__mark" style={{ background: player.color }} aria-hidden="true" />
          <div>
            <h1>{player.name}</h1>
            <p>HexWW2.world · Earth on a hex globe</p>
          </div>
        </Link>
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

      <div className="layout">
        <aside className="rail">
          <WarRoom
            power={power}
            state={game}
            onReady={declareReady}
            onClaim={takeSeat}
            onLeave={logOut}
            onLedger={() => setLedgerOpen(true)}
            busy={busy}
            error={seatError}
          />
          <TileInspector tile={selected} layer={overlay} />
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
              {forceTotals && (
                <>
                  <div className="legend__items legend__items--rule">
                    {UNITS.map((u, i) => (
                      <span key={u.id} className="legend__item">
                        <i style={{ background: u.color }} />
                        {u.name}
                        <em>{formatUnits(forceTotals[i])}</em>
                      </span>
                    ))}
                  </div>
                  <p className="legend__note">
                    Colour is who holds the ground; brightness is how much is standing on it.
                    The count is {player.name}, its side and the neutrals — the grey ground is the
                    ground you are not allowed to count.
                  </p>
                </>
              )}
              <p className="legend__note">
                Eight powers, so Canada, Australia, New Zealand, South Africa and Newfoundland are
                drawn as the United Kingdom — they were self-governing and declared war separately.
                Independent covers both the genuinely neutral and the colonies of neutral powers:
                the Congo is Belgian, the East Indies Dutch, Angola Portuguese.
              </p>
            </div>
          )}
          <details
            className="legend"
            open={legendOpen}
            onToggle={(e) => setLegendOpen(e.currentTarget.open)}
          >
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
          <p className="rail__stats">
            {TILE_COUNT.toLocaleString()} cells · {KM2_PER_CELL.toLocaleString()} km² each ·{' '}
            {world ? formatPopulation(world.totalPopulation) : '—'} people
          </p>
        </aside>

        <div className="field">
          <main className="stage">
            <canvas ref={canvasRef} className="map" tabIndex={0} />
            <canvas ref={overlayRef} className="map map--overlay" />
            {!world && <div className="loading">Loading Earth…</div>}

            <div className="zoom">
              <button
                type="button"
                onClick={() => viewRef.current?.zoomBy(1.35)}
                disabled={cam?.atMax}
              >
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
              <button
                type="button"
                className="zoom__reset"
                onClick={() => viewRef.current?.reset()}
              >
                ⤢
              </button>
            </div>
          </main>

          <footer className="statusbar">
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
                  (overlay === 'nations' && hover.forces.length
                    ? ` · ${hover.forces.map((u) => `${u.short} ${formatUnits(u.count)}`).join(' ')}`
                    : '') +
                  (overlay === 'nations' && hover.forcesUnknown ? ' · garrison not known' : '') +
                  (overlayValue(hover, overlay) ?? '')
                : `Drag to turn · scroll to zoom · click a cell · ${KM_PER_CELL} km across every cell`}
            </span>
            <span className="statusbar__zoom">{zoomLabel}</span>
            {/* The date sits in the bottom right corner of every nation's page:
                it is the one number the whole table shares. */}
            <span className="clock">
              <strong>{game ? game.date : '1 September 1939'}</strong>
              <em>day {game ? game.day : 0}</em>
            </span>
          </footer>
        </div>
      </div>

      {ledgerOpen && <WarLedger state={game} onClose={() => setLedgerOpen(false)} />}
      {session && pending.length > 0 && (
        <EventCard event={pending[0]} onDismiss={dismiss} remaining={pending.length} />
      )}
    </div>
  );
}
