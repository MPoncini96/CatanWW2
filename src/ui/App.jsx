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
import { EndDay } from './EndDay.jsx';
import { EventCard } from './EventCard.jsx';
import { NationIndex } from './NationIndex.jsx';
import { Forces, Stores } from './Economy.jsx';
import { Drawers } from './Drawer.jsx';
import { Totals } from './Totals.jsx';
import { Link, MASTER, isMaster, powerFromPath, useRoute } from './routes.jsx';

/** The overseer is not a power, but the page furniture wants a name and a colour. */
const MASTER_SEAT = { id: MASTER, name: 'Master', color: '#9fb2c8' };
import { Dossier } from './Dossier.jsx';
import { arrivalsAt, positionsAt } from '../game/movement.js';
import { Survey } from './Survey.jsx';
import { March } from './March.jsx';
import { DayReport } from './DayReport.jsx';
import { reportFor } from '../game/report.js';
import { Replacements } from './Replacements.jsx';
import { Raid } from './Raid.jsx';
import { Sail } from './Sail.jsx';
import { Amphibious } from './Amphibious.jsx';
import { Raise } from './Raise.jsx';
import { Strike } from './Strike.jsx';
import { Standings } from './Standings.jsx';
import { strengthsAt } from '../game/combat.js';
import { fleetsAt } from '../game/naval.js';
import { cargoAt } from '../game/amphibious.js';
import { manpowerFor } from '../game/manpower.js';
import { buildingOn, placementFor, readyBy } from '../game/raising.js';
import { advanceOrders } from '../game/frontward.js';
import { capacityFor, spentBy } from '../game/production.js';
import {
  claimSeat,
  fetchState,
  leaveSeat,
  savedSession,
  setOrders as setOrdersOnServer,
  setReady,
  setStanding as setStandingOnServer,
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
  const [totalsOpen, setTotalsOpen] = useState(false);
  // The bottom strip starts open: it is the half of the inspector that shows
  // everything, and a reader who has never seen it cannot ask for it.
  const [dossierOpen, setDossierOpen] = useState(true);
  // Fifteen figures that are looked at rather than worked from: shut to begin
  // with, and remembered once opened.
  // Which drawer of the rail is open, if any. One at a time.
  const [drawer, setDrawer] = useState(null);
  // The day's returns. Opened on its own when the day turns and there is
  // something to say, and re-openable from the top bar afterwards, because the
  // first thing you want after reading it is the map back and the second is to
  // read it again.
  const [reportOpen, setReportOpen] = useState(false);
  const [reportSeen, setReportSeen] = useState(0);
  // The hex being marched into, and the day's orders. The orders come back
  // from the server on every frame, so this is a working copy that is replaced
  // whenever the server has something to say about them.
  const [marchTo, setMarchTo] = useState(null);
  const [rebuildAt, setRebuildAt] = useState(null);
  const [rebuilding, setRebuilding] = useState([]);
  const [bombAt, setBombAt] = useState(null);
  const [raiding, setRaiding] = useState([]);
  const [sailAt, setSailAt] = useState(null);
  const [sailing, setSailing] = useState([]);
  const [strikeAt, setStrikeAt] = useState(null);
  const [striking, setStriking] = useState([]);
  const [raiseAt, setRaiseAt] = useState(null);
  const [raising, setRaising] = useState([]);
  const [shoreAt, setShoreAt] = useState(null);
  const [shoreMode, setShoreMode] = useState('embark');
  const [embarking, setEmbarking] = useState([]);
  const [landing, setLanding] = useState([]);
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

  const declareStanding = useCallback(
    async (advance) => {
      setBusy(true);
      setSeatError(null);
      try {
        setGame({
          ...(await setStandingOnServer(session.token, advance)),
          forToken: session.token,
        });
      } catch (err) {
        setSeatError(err.message);
      } finally {
        setBusy(false);
      }
    },
    [session?.token],
  );

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

  // The date, on its own, because it changes without the seat changing — and
  // the supply shading is drawn from it. It used to ride along with the viewer
  // and so never moved once a game was under way.
  useEffect(() => {
    viewRef.current?.setDay(game?.day ?? 0);
  }, [game?.day, world]);


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
    world.ownership.replay(game.captures ?? []);
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
  // Who is presently riding a ship. This is what makes a column at sea findable
  // at all, since its position is the fleet's rather than any hex of ground.
  const aboard = useMemo(
    () => cargoAt(game?.embarks ?? [], game?.landings ?? [], game?.day ?? 0),
    [game?.embarks, game?.landings, game?.day],
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
    setRaiding(game?.raiding ?? []);
    setSailing(game?.sailing ?? []);
    setEmbarking(game?.embarking ?? []);
    setLanding(game?.landing ?? []);
    setRaising(game?.raising ?? []);
    setStriking(game?.striking ?? []);
    setStrikeAt(null);
    setShoreAt(null);
    setRaiseAt(null);
    setOrderError(null);
    setMarchTo(null);
    setRebuildAt(null);
    setBombAt(null);
    setSailAt(null);
  }, [game?.day, game?.you]);

  const toggleStrike = useCallback((id, target) => {
    setOrderError(null);
    setStriking((current) =>
      current.some((s) => s.column === id)
        ? current.filter((s) => s.column !== id)
        : [...current, { column: id, target }],
    );
  }, []);

  const toggleRaise = useCallback((template, cell) => {
    setOrderError(null);
    setRaising((current) =>
      current.some((r) => r.template === template && r.cell === cell)
        ? current.filter((r) => !(r.template === template && r.cell === cell))
        : [...current, { template, cell }],
    );
  }, []);

  const toggleEmbark = useCallback((column, fleet, from) => {
    setOrderError(null);
    setEmbarking((current) =>
      current.some((e) => e.column === column)
        ? current.filter((e) => e.column !== column)
        : [...current, { column, fleet, from }],
    );
  }, []);

  const toggleLanding = useCallback((fleet, to) => {
    setOrderError(null);
    setLanding((current) =>
      current.some((l) => l.fleet === fleet)
        ? current.filter((l) => l.fleet !== fleet)
        : [...current, { fleet, to }],
    );
  }, []);

  const toggleSail = useCallback((id, to) => {
    setOrderError(null);
    setSailing((current) =>
      current.some((s) => s.fleet === id)
        ? current.filter((s) => s.fleet !== id)
        : [...current, { fleet: id, to }],
    );
  }, []);

  const toggleRaid = useCallback((id, target) => {
    setOrderError(null);
    setRaiding((current) =>
      current.some((r) => r.column === id)
        ? current.filter((r) => r.column !== id)
        : [...current, { column: id, target }],
    );
  }, []);

  /**
   * Every air mission this seat has ordered, as a line on the map.
   *
   * Raids on works and strikes on troops are one thing to look at: both are
   * aircraft leaving an airfield tonight and coming back to it, and which of
   * the two it is shows in the panel that ordered it.
   */
  const missions = useMemo(() => {
    const out = [];
    for (const m of [...(raiding ?? []), ...(striking ?? [])]) {
      const from = positions?.get(m.column);
      if (from === undefined || m.target === undefined) continue;
      out.push({ from, to: m.target });
    }
    return out;
  }, [raiding, striking, positions]);

  /**
   * And the marches nobody ordered.
   *
   * Worked out here from the same function the server runs at the end of the
   * day, on the same inputs, so what is drawn is what will happen — not a
   * guess at it. A column the player gives an order to drops out of this on
   * the next render, which is the whole of how the standing order is
   * overridden and needs no second mechanism to show it.
   */
  const advances = useMemo(() => {
    if (!world || !seat || !positions) return [];
    if (game?.standing === false) return [];
    try {
      return advanceOrders({
        world,
        power: seat,
        day: game?.day ?? 0,
        positions,
        arrivals,
        taken: (orders ?? []).map((o) => o.column),
        aboard,
      });
    } catch {
      // A drawing is never worth a blank page.
      return [];
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, seat, game?.day, game?.standing, ownershipVersion, positions, arrivals, orders, aboard]);

  // And the orders, which change when a player ticks a box. Kept apart from
  // the two above so that ticking one does not throw away the selected hex.
  useEffect(() => {
    viewRef.current?.setOrders(orders, rebuilding, positions, missions, advances);
  }, [orders, rebuilding, positions, missions, advances, world]);

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

  /**
   * Give up on a panel.
   *
   * The button here used to say Done and did neither thing its name promised:
   * it shut the panel and left every box that had been ticked still ticked, so
   * a panel opened by mistake put orders on the map behind it. Cancel puts back
   * what the server last confirmed and then shuts.
   *
   * The server's copy is the only truth about what has been ordered, which is
   * why it is what gets restored rather than some snapshot taken on opening.
   */
  const giveUp = useCallback(
    (shut, ...restore) =>
      () => {
        for (const [put, was] of restore) put(was ?? []);
        setOrderError(null);
        shut(null);
        // And let go of the hex, exactly as saving does. Either way you have
        // finished with that ground for now, and a panel that shuts while the
        // hex stays ringed in gold with its dossier open reads as though
        // something is still in progress.
        viewRef.current?.clearSelection();
      },
    [],
  );

  const sendOrders = useCallback(async () => {
    if (!session?.token) return;
    setSending(true);
    setOrderError(null);
    try {
      const state = await setOrdersOnServer(
        session.token,
        orders,
        rebuilding,
        raiding,
        sailing,
        embarking,
        landing,
        raising,
        striking,
      );
      setOrders(state.orders ?? []);
      setRebuilding(state.rebuilding ?? []);
      setRaiding(state.raiding ?? []);
      setSailing(state.sailing ?? []);
      setEmbarking(state.embarking ?? []);
      setLanding(state.landing ?? []);
      setRaising(state.raising ?? []);
      setStriking(state.striking ?? []);
      setStrikeAt(null);
      setShoreAt(null);
      setRaiseAt(null);
      setMarchTo(null);
      setRebuildAt(null);
      setBombAt(null);
      setSailAt(null);
      // And let go of the hex. Saving is the end of what you were doing with
      // it, so leaving it ringed in gold with its dossier open says the
      // opposite. Cancel does the same, from the other direction.
      viewRef.current?.clearSelection();
    } catch (err) {
      setOrderError(err.message);
    } finally {
      setSending(false);
    }
  }, [
    session?.token,
    orders,
    rebuilding,
    raiding,
    sailing,
    embarking,
    landing,
    raising,
    striking,
  ]);

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

  // Every fleet as it stands this morning — where it is, what is left of it,
  // and whether it is still there at all. Replayed from the record like the
  // armies are, so a fleet that sailed on Tuesday is not still drawn at Scapa.
  const fleets = useMemo(() => {
    if (!world?.navies) return [];
    return fleetsAt(world, game ?? {}, game?.day ?? 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, game?.day, game?.sailings, game?.seaBattles, game?.sinkings]);

  // Hulls this seat may count: its own and its side's wherever they are, and
  // anyone else's moored against a coast it can see.
  const navalTotals = useMemo(() => {
    if (!fleets.length) return null;
    const totals = Object.fromEntries(SHIPS.map((s) => [s.id, 0]));
    for (const fleet of fleets) {
      if (fleet.cargo || !fleet.afloat) continue;
      if (!seesFleet(world, seat, fleet)) continue;
      for (const s of SHIPS) totals[s.id] += Math.round(fleet.ships[s.id] ?? 0);
    }
    return totals;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, seat, fleets, ownershipVersion]);

  // The formations the war has produced, put on the board as the record says
  // they were finished. Idempotent, so replaying the whole list every time the
  // record changes raises nobody twice.
  const raisedCount = game?.raisings?.length ?? 0;
  useEffect(() => {
    if (!world?.garrisons?.raise) return;
    let added = 0;
    for (const entry of readyBy(game?.raisings ?? [], game?.day ?? 0)) {
      if (world.garrisons.raise(placementFor(entry))) added += 1;
    }
    if (added) setMarchVersion((v) => v + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, raisedCount, game?.day]);

  // What the depots have, which is the shortage that decides everything else.
  const manpower = useMemo(() => {
    if (!world?.ownership || !seat) return null;
    return manpowerFor(world, seat, game?.day ?? 0, game?.replacements ?? [], game?.raisings ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, seat, game?.day, game?.replacements, game?.raisings, ownershipVersion]);

  // Hand the globe the fleets. Deliberately down here, below where `fleets` is
  // worked out: an effect placed with the other view setters would read the
  // list before the line that declares it and take the whole page down with a
  // dead-zone error that builds perfectly cleanly. That has happened twice.
  useEffect(() => {
    viewRef.current?.setFleets(fleets);
  }, [fleets]);

  // This nation's books: what it holds, what the ground pays it, and what a day
  // of standing still costs. Follows the calendar, so the stores fall as the
  // war goes on without anything having to be stored.
  const economy = useMemo(() => {
    // The overseer has no stores to spend, because the overseer is not playing.
    if (!world?.ownership || !power || master) return null;
    return economyFor(world, power, game?.day ?? 0, spent.stores, game?.sinkings ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, power, game?.day, ownershipVersion, marchVersion, spent]);

  const zoomLabel = cam ? `${cam.pixelsPerCell.toFixed(1)} px/cell` : '';
  // What this nation's factories can turn out today, and how much of it is
  // down. Follows the ground, because a works you have lost makes nothing for
  // you and a works you have taken makes it for you tomorrow.
  const capacity = useMemo(() => {
    if (!world?.works || !economy || master) return null;
    const raids = game?.raids ?? [];
    const built = capacityFor(world, power, game?.day ?? 0, raids, economy.people);
    const down = raids.filter((r) => r.until > (game?.day ?? 0)).length;
    return { ...built, down };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, power, master, economy, game?.day, game?.raids?.length, ownershipVersion]);

  // What happened to this seat on the day just resolved. Worked out from the
  // record rather than stored: ask again tomorrow and it works tomorrow out.
  const report = useMemo(() => {
    if (!world || !game || master || !seat || game.day === 0) return null;
    return reportFor({ world, game, seat, day: game.day });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, game?.day, seat, master, battleCount, captureCount, rebuiltCount]);

  // Show it once a day, unasked, and only when it has something in it.
  useEffect(() => {
    if (!report || report.quiet) return;
    if (reportSeen >= report.day) return;
    setReportSeen(report.day);
    setReportOpen(true);
  }, [report, reportSeen]);

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
      {game?.over && (
        <div className={`verdict is-${game.over.side}`}>
          <strong>
            {game.over.side === 'allies' ? 'The Allies have won' : 'The Axis has won'}
          </strong>
          <span>
            {game.over.why} — {game.date}
          </span>
        </div>
      )}
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

        {!master && game?.day > 0 && (
          <button
            type="button"
            className={`topbar__totals${report && !report.quiet ? ' is-live' : ''}`}
            onClick={() => setReportOpen(true)}
          >
            The day
          </button>
        )}

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
        {/* Reference above, scrolling; the one action below, pinned. */}
        <aside className="rail">
          <div className="rail__body">
          {master ? (
            <Survey world={world} tally={tally} />
          ) : (
            <WarRoom
              power={power}
              state={game}
              onClaim={takeSeat}
              onLeave={logOut}
              onStanding={declareStanding}
              busy={busy}
              error={seatError}
            />
          )}

          {/* Everything that is reference rather than working state, behind a
              row of names with one open at a time. The rail had grown to seven
              stacked blocks in a column three hundred pixels wide — I wrote the
              industry panel and then had to scroll to find it. */}
          <Drawers
            open={drawer}
            onOpen={setDrawer}
            drawers={[
              ...(master
                ? []
                : [
                    {
                      id: 'stores',
                      name: 'Stores',
                      note: "what it earns · what it burns · the day's net",
                      body: <Stores economy={economy} />,
                    },
                    {
                      id: 'forces',
                      name: 'Forces',
                      note: 'the men, and the plant that puts them back',
                      body: (
                        <Forces
                          economy={economy}
                          capacity={capacity}
                          manpower={manpower}
                          building={buildingOn(game?.raisings ?? [], seat, game?.day ?? 0)}
                        />
                      ),
                    },
                  ]),
              {
                id: 'war',
                name: 'The war',
                note: 'how it ends, and how close it is',
                body: <Standings standings={game?.standings} over={game?.over} />,
              },
              {
                id: 'key',
                name: 'Map key',
                body: (
                  <>
                    {overlay === 'nations' && (
                      <p className="legend__note legend__note--loose">
                        Colour is who holds the ground; brightness is how much is standing on it,
                        and close in it becomes the units themselves. Ground of yours that nothing
                        can reach is drained towards a dead grey. A diamond on the water is a fleet
                        — filled and sized if you may count it, an outline if you may not. Canada,
                        Australia, New Zealand, South Africa and Newfoundland are drawn as the
                        United Kingdom: there are seven seats, and they were self-governing.
                        Independent covers both the genuinely neutral and the colonies of neutral
                        powers — the Congo is Belgian, the East Indies Dutch, Angola Portuguese.
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
                          A cell takes the colour of whatever it is most notable for, measured
                          against the largest producer of that same thing — iron is raised by the
                          hundred million tonnes and aluminium by the hundred thousand, so the two
                          cannot be compared directly.
                        </p>
                      </div>
                    )}
                    <div className="legend__items">
                      {present.map((t) => (
                        <span key={t.id} className="legend__item">
                          <i style={{ background: t.color }} />
                          {t.name}
                        </span>
                      ))}
                    </div>
                    <p className="rail__stats">
                      {TILE_COUNT.toLocaleString()} cells · {KM2_PER_CELL.toLocaleString()} km²
                      each · {world ? formatPopulation(world.totalPopulation) : '—'} people
                    </p>
                  </>
                ),
              },
            ]}
          />
          </div>

          {/* Never scrolled away from, never covered by a panel. */}
          {!master && (
            <EndDay power={power} state={game} onReady={declareReady} busy={busy} />
          )}
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
            onBomb={() => setBombAt(selected?.index ?? null)}
            onSail={() => setSailAt(selected?.index ?? null)}
            onEmbark={() => {
              setShoreMode('embark');
              setShoreAt(selected?.index ?? null);
            }}
            onLanding={() => {
              setShoreMode('land');
              setShoreAt(selected?.index ?? null);
            }}
            onRaise={() => setRaiseAt(selected?.index ?? null)}
            onStrike={() => setStrikeAt(selected?.index ?? null)}
            raising={raising}
            striking={striking}
            raiding={raiding}
            sailing={sailing}
            embarking={embarking}
            landing={landing}
            battles={dispatches}
            rebuilding={rebuilding}
            march={
              strikeAt !== null && world ? (
                <Strike
                  world={world}
                  power={seat}
                  day={game?.day ?? 0}
                  cell={strikeAt}
                  positions={positions}
                  strengths={strengths}
                  raids={game?.raids ?? []}
                  striking={striking}
                  onToggle={toggleStrike}
                  onSend={sendOrders}
                  onCancel={giveUp(setStrikeAt, [setStriking, game?.striking])}
                  busy={sending}
                  error={orderError}
                />
              ) : raiseAt !== null && world ? (
                <Raise
                  world={world}
                  power={seat}
                  day={game?.day ?? 0}
                  cell={raiseAt}
                  manpower={manpower}
                  economy={economy}
                  capacity={capacity}
                  replacements={game?.replacements ?? []}
                  raisings={game?.raisings ?? []}
                  raising={raising}
                  onToggle={toggleRaise}
                  onSend={sendOrders}
                  onCancel={giveUp(setRaiseAt, [setRaising, game?.raising])}
                  busy={sending}
                  error={orderError}
                />
              ) : shoreAt !== null && world ? (
                <Amphibious
                  world={world}
                  power={seat}
                  day={game?.day ?? 0}
                  cell={shoreAt}
                  mode={shoreMode}
                  fleets={fleets}
                  positions={positions}
                  strengths={strengths}
                  arrivals={arrivals}
                  aboard={aboard}
                  embarking={embarking}
                  landing={landing}
                  onToggleEmbark={toggleEmbark}
                  onToggleLanding={toggleLanding}
                  onSend={sendOrders}
                  onCancel={giveUp(setShoreAt, [setEmbarking, game?.embarking], [setLanding, game?.landing])}
                  busy={sending}
                  error={orderError}
                />
              ) : sailAt !== null && world ? (
                <Sail
                  world={world}
                  power={seat}
                  day={game?.day ?? 0}
                  cell={sailAt}
                  fleets={fleets}
                  sailing={sailing}
                  onToggle={toggleSail}
                  onSend={sendOrders}
                  onCancel={giveUp(setSailAt, [setSailing, game?.sailing])}
                  busy={sending}
                  error={orderError}
                />
              ) : bombAt !== null && world ? (
                <Raid
                  world={world}
                  power={seat}
                  day={game?.day ?? 0}
                  cell={bombAt}
                  positions={positions}
                  strengths={strengths}
                  raids={game?.raids ?? []}
                  raiding={raiding}
                  onToggle={toggleRaid}
                  onSend={sendOrders}
                  onCancel={giveUp(setBombAt, [setRaiding, game?.raiding])}
                  busy={sending}
                  error={orderError}
                />
              ) : rebuildAt !== null && world ? (
                <Replacements
                  world={world}
                  power={seat}
                  day={game?.day ?? 0}
                  cell={rebuildAt}
                  strengths={strengths}
                  wanted={rebuilding}
                  economy={economy}
                  capacity={capacity}
                  onToggle={toggleRebuild}
                  onSend={sendOrders}
                  onCancel={giveUp(setRebuildAt, [setRebuilding, game?.rebuilding])}
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
                  onCancel={giveUp(setMarchTo, [setOrders, game?.orders])}
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

      {reportOpen && report && (
        <DayReport report={report} date={game?.date} onClose={() => setReportOpen(false)} />
      )}

      {totalsOpen && (
        <Totals
          tally={tally}
          navalTotals={navalTotals}
          forceTotals={forceTotals}
          player={player}
          onClose={() => setTotalsOpen(false)}
        />
      )}
      {session && pending.length > 0 && (
        <EventCard event={pending[0]} onDismiss={dismiss} remaining={pending.length} />
      )}
    </div>
  );
}
