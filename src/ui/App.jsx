import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GlobeView } from '../render/globeView.js';
import { loadEarth } from '../world/earth.js';
import { EARTH_RADIUS_KM, TILE_COUNT } from '../world/sphere.js';
import { TERRAIN } from '../world/terrain.js';
import { formatPopulation } from '../world/population.js';
import { RESOURCES, formatAmount } from '../world/resources.js';
import { NATIONS, NEUTRAL } from '../world/nations.js';
import { ROLES, UNITS, formatUnits } from '../world/forces.js';
import { SHIPS } from '../world/navies.js';
import { seesFleet, visibilityFor } from '../world/intel.js';
import { economyFor } from '../world/economy.js';
import { PLAYERS } from '../game/players.js';
import { WarRoom } from './WarRoom.jsx';
import { WarLedger } from './WarLedger.jsx';
import { EventCard } from './EventCard.jsx';
import { NationIndex } from './NationIndex.jsx';
import { Economy } from './Economy.jsx';
import { Totals } from './Totals.jsx';
import { Link, MASTER, isMaster, powerFromPath, useRoute } from './routes.jsx';

/** The overseer is not a power, but the page furniture wants a name and a colour. */
const MASTER_SEAT = { id: MASTER, name: 'Master', color: '#9fb2c8' };
import { Dossier } from './Dossier.jsx';
import { arrivalsAt, positionsAt } from '../game/movement.js';
import { Survey } from './Survey.jsx';
import { March } from './March.jsx';
import { Replacements } from './Replacements.jsx';
import { strengthsAt } from '../game/combat.js';
import { spentBy } from '../game/production.js';
import {
  claimSeat,
  fetchState,
  leaveSeat,
  savedSession,
  setOrders as setOrdersOnServer,
  setReady,
  watch,
} from '../game/client.js';

// Every cell is the same size now, so there is a single honest number for it.
const KM2_PER_CELL = Math.round((4 * Math.PI * EARTH_RADIUS_KM ** 2) / TILE_COUNT);
const KM_PER_CELL = Math.round(Math.sqrt(KM2_PER_CELL));

const BY_ID = Object.fromEntries(PLAYERS.map((p) => [p.id, p]));

/** Everything the hovered cell produced, for the status line. */
function overlayValue(tile, overlay) {
  if (overlay !== 'output' || !tile.resources.length) return null;
  return ` · ${tile.resources
    .map((r) => `${r.name} ${formatAmount(r.amount, r.unit)}`)
    .join(' · ')}`;
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
  // On the output layer the swatch takes the colour of whatever this cell is
  // most notable for, which is the colour the map has drawn it in.
  const chief = layer === 'output' ? tile.resources[0] : null;

  const swatch =
    layer === 'nations'
      ? (tile.country?.color ?? tile.nation?.color ?? tile.terrain.color)
      : layer === 'output'
        ? (chief?.color ?? '#2a303a')
        : tile.terrain.color;

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
                {/* Which of those men are soldiers in the line. A hex holding
                    twelve thousand recruits in a training barracks used to
                    read exactly like a hex holding a division, and that was
                    the most misleading thing on the board. */}
                {tile.forces.some((u) => u.id === 'infantry') && (
                  <p className="garrison__field">
                    {tile.fieldInfantry === 0
                      ? 'None of them are field troops.'
                      : `${formatUnits(tile.fieldInfantry)} of them are field troops.`}
                  </p>
                )}
                <ul className="garrison">
                  {tile.garrison.map((unit) => (
                    <li className="garrison__unit" key={unit.id} title={unit.source}>
                      <span className="garrison__name">{unit.name}</span>
                      <span className="garrison__role">{ROLES[unit.type]?.name ?? unit.type}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="output output--unknown">
                <h3>Garrison, 1939</h3>
                <p>Nobody is holding this ground.</p>
              </div>
            )}
          </>
        )}

        {/* ---- A fleet, if one is moored on this cell ---- */}
        {layer === 'nations' && tile.fleet && (
          <div className={`output${tile.fleetKnown ? '' : ' output--unknown'}`}>
            <h3>{tile.fleet.name}</h3>
            {tile.fleetKnown ? (
              <>
                {SHIPS.map((s) =>
                  tile.fleet.ships[s.id] > 0 ? (
                    <div className="output__row" key={s.id}>
                      <span className="output__dot" style={{ background: s.color }} />
                      <span className="output__name">{s.name}</span>
                      <strong>{tile.fleet.ships[s.id]}</strong>
                    </div>
                  ) : null,
                )}
                {tile.fleet.aircraft > 0 && (
                  <p className="panel__note">
                    {tile.fleet.aircraft} aircraft embarked in{' '}
                    {tile.fleet.ships.carriers === 1
                      ? 'the carrier'
                      : `${tile.fleet.ships.carriers} carriers`}
                  </p>
                )}
              </>
            ) : (
              <p>A fleet is based here. Its strength is not known.</p>
            )}
          </div>
        )}

        {/* ---- Output: everything this cell produced in a year ---- */}
        {layer === 'output' && (
          <div className={`output${tile.resources.length ? '' : ' output--unknown'}`}>
            <h3>Output, 1939</h3>
            {tile.resources.length ? (
              <>
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
              </>
            ) : (
              <p>Nothing is raised here.</p>
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
  // The overseer's page has no seat at the table, and a seat is exactly what
  // the fog is drawn from: hand the globe no viewer and every rule that asks
  // "may this seat see it" answers yes. One value, and nothing else has to
  // know there is a tenth page.
  const master = isMaster(power);
  const seat = master ? null : power;

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
  const [totalsOpen, setTotalsOpen] = useState(false);
  // The bottom strip starts open: it is the half of the inspector that shows
  // everything, and a reader who has never seen it cannot ask for it.
  const [dossierOpen, setDossierOpen] = useState(true);
  // Fifteen figures that are looked at rather than worked from: shut to begin
  // with, and remembered once opened.
  const [storesOpen, setStoresOpen] = useState(false);
  // The hex being marched into, and the day's orders. The orders come back
  // from the server on every frame, so this is a working copy that is replaced
  // whenever the server has something to say about them.
  const [marchTo, setMarchTo] = useState(null);
  const [rebuildAt, setRebuildAt] = useState(null);
  const [rebuilding, setRebuilding] = useState([]);
  const [orders, setOrders] = useState([]);
  const [orderError, setOrderError] = useState(null);
  const [sending, setSending] = useState(false);
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
      viewer: seat,
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
    viewRef.current?.setViewer(seat);
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

  // Put the armies where the log of marches says they are. The log only ever
  // grows, so its length and the date together are enough to know whether
  // anything has changed — the array itself is new on every frame from the
  // stream and comparing it would rebuild the board for nothing.
  const [marchVersion, setMarchVersion] = useState(0);
  const moveCount = game?.moves?.length ?? 0;
  const battleCount = game?.battles?.length ?? 0;
  const captureCount = game?.captures?.length ?? 0;
  const rebuiltCount = game?.replacements?.length ?? 0;
  useEffect(() => {
    if (!world?.march || !game) return;
    // Ground first, then the armies: a column that took a hex has to find the
    // hex already its own, or the fog would hide the men that captured it.
    for (const capture of game.captures ?? []) {
      world.ownership.set(capture.cell, capture.to, { day: capture.day, reason: 'taken' });
    }
    world.march(game.moves ?? [], game.day, game.battles ?? [], game.replacements ?? []);
    setMarchVersion((v) => v + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, moveCount, battleCount, captureCount, rebuiltCount, game?.day]);

  // Where every column stands today, and when it got there. Both are replayed
  // from the same log the server replays, so the two agree without either
  // sending the other a map.
  const positions = useMemo(
    () => (world ? positionsAt(world.garrisons.opening, game?.moves ?? [], game?.day ?? 0) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [world, moveCount, game?.day],
  );
  const arrivals = useMemo(
    () => arrivalsAt(game?.moves ?? [], game?.day ?? 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [moveCount, game?.day],
  );

  // What is left of every column, and what this seat has already spent putting
  // men back. Both replayed from the record, like everything else.
  const strengths = useMemo(
    () =>
      world
        ? strengthsAt(
            world.garrisons.opening,
            game?.battles ?? [],
            game?.day ?? 0,
            game?.replacements ?? [],
          )
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [world, battleCount, rebuiltCount, game?.day],
  );
  const spent = useMemo(
    () => (seat ? spentBy(game?.replacements ?? [], seat, game?.day ?? 0) : { stores: {}, men: 0 }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [seat, rebuiltCount, game?.day],
  );

  // What happened when the day turned, newest first, and only the fights this
  // seat has any business knowing about — its own, and anything it can see.
  const dispatches = useMemo(() => {
    if (!world || !game?.battles?.length) return [];
    const visible = visibilityFor(world, seat);
    return game.battles
      .filter((b) => !seat || b.attacker === seat || b.defender === seat || visible[b.cell])
      .slice(-40)
      .reverse();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, seat, battleCount, ownershipVersion]);

  // The server's copy of this seat's orders is the truth; a new day clears it.
  useEffect(() => {
    setOrders(game?.orders ?? []);
    setRebuilding(game?.rebuilding ?? []);
    setOrderError(null);
    setMarchTo(null);
    setRebuildAt(null);
  }, [game?.day, game?.you]);

  const toggleRebuild = useCallback((id) => {
    setOrderError(null);
    setRebuilding((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  }, []);

  const toggleColumn = useCallback((column, from) => {
    setOrderError(null);
    setOrders((current) =>
      current.some((o) => o.column === column.id)
        ? current.filter((o) => o.column !== column.id)
        : [...current, { column: column.id, from, to: marchTo }],
    );
  }, [marchTo]);

  const sendOrders = useCallback(async () => {
    if (!session?.token) return;
    setSending(true);
    setOrderError(null);
    try {
      const state = await setOrdersOnServer(session.token, orders, rebuilding);
      setOrders(state.orders ?? []);
      setRebuilding(state.rebuilding ?? []);
      setMarchTo(null);
      setRebuildAt(null);
    } catch (err) {
      setOrderError(err.message);
    } finally {
      setSending(false);
    }
  }, [session?.token, orders, rebuilding]);

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

  // Force totals for the panel, counted cell by cell rather than nation by
  // nation — because the fog is now cell by cell too. What this adds up is
  // exactly what is drawn on the map: your side, the neutrals, and whatever the
  // other side has put on the hexes your own troops are looking at.
  const forceTotals = useMemo(() => {
    if (!world?.forces) return null;
    const visible = visibilityFor(world, seat);
    const totals = UNITS.map(() => 0);
    for (let i = 0; i < TILE_COUNT; i += 1) {
      if (!visible[i]) continue;
      for (let u = 0; u < UNITS.length; u += 1) totals[u] += world.forces[u][i];
    }
    return totals;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, seat, ownershipVersion, marchVersion]);

  // Hulls this seat may count: its own and its side's wherever they are, and
  // anyone else's moored against a coast it can see.
  const navalTotals = useMemo(() => {
    if (!world?.navies) return null;
    const totals = Object.fromEntries(SHIPS.map((s) => [s.id, 0]));
    for (const station of world.navies.stations) {
      if (!seesFleet(world, seat, station)) continue;
      for (const s of SHIPS) totals[s.id] += station.ships[s.id];
    }
    return totals;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, seat, ownershipVersion]);

  // This nation's books: what it holds, what the ground pays it, and what a day
  // of standing still costs. Follows the calendar, so the stores fall as the
  // war goes on without anything having to be stored.
  const economy = useMemo(() => {
    // The overseer has no stores to spend, because the overseer is not playing.
    if (!world?.ownership || !power || master) return null;
    return economyFor(world, power, game?.day ?? 0, spent.stores);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, power, game?.day, ownershipVersion, marchVersion, spent]);

  const zoomLabel = cam ? `${cam.pixelsPerCell.toFixed(1)} px/cell` : '';
  const player = master ? MASTER_SEAT : power ? BY_ID[power] : null;

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
            <p>{master ? 'Every hex · no fog' : 'HexWW2.world · Earth on a hex globe'}</p>
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
          <button
            type="button"
            className={overlay === 'output' ? 'is-active' : ''}
            onClick={() => setOverlay(overlay === 'output' ? null : 'output')}
          >
            <i className="layers__output" />
            Output
          </button>
        </div>

        <button
          type="button"
          className={`topbar__totals${totalsOpen ? ' is-open' : ''}`}
          onClick={() => setTotalsOpen((open) => !open)}
        >
          Totals
        </button>

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
          {master ? (
            <Survey world={world} tally={tally} />
          ) : (
            <>
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
                  <Economy
                economy={economy}
                open={storesOpen}
                onToggle={setStoresOpen}
              />
            </>
          )}
          <TileInspector tile={selected} layer={overlay} />
          {overlay === 'nations' && (
            <p className="legend__note legend__note--loose">
              Colour is who holds the ground; brightness is how much is standing on it, and close
              in it becomes the units themselves. A diamond on the water is a fleet — filled and
              sized if you may count it, an outline if you may not. Canada, Australia, New Zealand,
              South Africa and Newfoundland are drawn as the United Kingdom: there are eight seats,
              and they were self-governing. Independent covers both the genuinely neutral and the
              colonies of neutral powers — the Congo is Belgian, the East Indies Dutch, Angola
              Portuguese.
            </p>
          )}
          {overlay === 'output' && world && (
            <div className="legend legend--static">
              <div className="legend__items">
                {RESOURCES.map((r, i) => (
                  <span key={r.id} className="legend__item">
                    <i style={{ background: r.color }} />
                    {r.name}
                    <em>{formatAmount(world.resourceTotals[i], r.unit)}</em>
                  </span>
                ))}
              </div>
              <p className="legend__note">
                A cell takes the colour of whatever it is most notable for, measured against the
                largest producer of that same thing — iron is raised by the hundred million tonnes
                and aluminium by the hundred thousand, so the two cannot be compared directly.
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

          {/* Everything about one hex, across every layer, along the bottom.
              The rail answers the question the map is asking; this answers all
              of them at once, and the two are meant to be read together. */}
          <Dossier
            tile={selected}
            open={dossierOpen}
            onToggle={() => setDossierOpen((v) => !v)}
            master={master}
            layer={overlay}
            power={seat}
            day={game?.day ?? 0}
            orders={orders}
            marchTo={marchTo}
            onMarch={() => setMarchTo(selected?.index ?? null)}
            onRebuild={() => setRebuildAt(selected?.index ?? null)}
            battles={dispatches}
            rebuilding={rebuilding}
            march={
              rebuildAt !== null && world ? (
                <Replacements
                  world={world}
                  power={seat}
                  day={game?.day ?? 0}
                  cell={rebuildAt}
                  strengths={strengths}
                  wanted={rebuilding}
                  economy={economy}
                  onToggle={toggleRebuild}
                  onSend={sendOrders}
                  onCancel={() => setRebuildAt(null)}
                  busy={sending}
                  error={orderError}
                />
              ) : marchTo !== null && world && positions ? (
                <March
                  world={world}
                  power={seat}
                  day={game?.day ?? 0}
                  to={marchTo}
                  positions={positions}
                  arrivals={arrivals}
                  orders={orders}
                  onToggle={toggleColumn}
                  onSend={sendOrders}
                  onCancel={() => setMarchTo(null)}
                  busy={sending}
                  error={orderError}
                />
              ) : null
            }
          />

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
                  (overlay === 'nations' && hover.forcesUnknown && !hover.fleet
                    ? ' · garrison not known'
                    : '') +
                  (hover.fleet
                    ? ` · ${hover.fleet.name}${
                        hover.fleetKnown
                          ? ` · ${hover.fleet.hulls} ${hover.fleet.hulls === 1 ? 'ship' : 'ships'}`
                          : ' · strength not known'
                      }`
                    : '') +
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

      {totalsOpen && (
        <Totals
          tally={tally}
          navalTotals={navalTotals}
          forceTotals={forceTotals}
          player={player}
          onClose={() => setTotalsOpen(false)}
        />
      )}
      {ledgerOpen && <WarLedger state={game} onClose={() => setLedgerOpen(false)} />}
      {session && pending.length > 0 && (
        <EventCard event={pending[0]} onDismiss={dismiss} remaining={pending.length} />
      )}
    </div>
  );
}
