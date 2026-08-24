import { formatGeo, grid } from '../world/sphere.js';
import { TERRAIN } from '../world/terrain.js';
import { RESOURCES } from '../world/resources.js';
import { UNITS } from '../world/forces.js';
import { NATION_INDEX, SEA } from '../world/nations.js';
import { canSeeForces } from '../world/intel.js';
import { Globe } from './globe.js';
import { GlobeCamera, MAX_DISTANCE, MIN_DISTANCE } from './globeCamera.js';
import { drawCountryLabels } from './labels.js';
import { drawCityMarkers } from './cities.js';
import { drawFleetMarkers } from './fleets.js';

// Input, the frame loop, and the writing on top of it.
//
// Two canvases sit on each other: the globe on WebGL underneath, and a plain 2D
// canvas above it for city dots and country names. Text is the one thing that is
// genuinely easier in 2D, and it costs nothing here because both are drawn from
// the same camera.

const SPIN_FRICTION = 0.9;
const SPIN_FLOOR = 0.00004;

export class GlobeView {
  constructor(canvas, overlay, world, handlers = {}) {
    this.canvas = canvas;
    this.overlay = overlay;
    this.ctx = overlay.getContext('2d');
    this.world = world;
    this.sphere = world.sphere ?? grid();
    this.handlers = handlers;

    this.globe = new Globe(canvas, world);
    this.camera = new GlobeCamera(this.sphere);

    this.showCities = true;
    this.showLabels = true;
    // The seat this board is being drawn for, set by the page. Null means
    // nobody is sitting here and nothing is hidden.
    //
    // It is handed straight to the globe rather than waiting for the page to
    // call setViewer, which would find the value already stored here and
    // return without telling anybody — and the map would draw the whole world
    // unfogged while the panel, reading this same field, censored one cell at
    // a time. Two places holding the same fact, and only one of them told.
    this.viewer = handlers.viewer ?? null;
    this.globe.setViewer(this.viewer);
    this.pointers = new Map();
    this.dragging = false;
    this.moved = 0;
    this.selected = -1;
    this.hovered = -1;
    this.needsDraw = true;
    this.pinch = 0;

    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);
    this.onWheel = this.onWheel.bind(this);
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onLeave = this.onLeave.bind(this);
    this.frame = this.frame.bind(this);

    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerUp);
    canvas.addEventListener('pointerleave', this.onLeave);
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
    canvas.addEventListener('keydown', this.onKeyDown);

    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas.parentElement ?? canvas);

    this.unsubscribe = world.ownership?.onChange(() => {
      this.globe.refresh();
      this.needsDraw = true;
    });

    this.resize();
    this.raf = requestAnimationFrame(this.frame);
    this.emitCamera();
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.observer.disconnect();
    this.unsubscribe?.();
    const c = this.canvas;
    c.removeEventListener('pointerdown', this.onPointerDown);
    c.removeEventListener('pointermove', this.onPointerMove);
    c.removeEventListener('pointerup', this.onPointerUp);
    c.removeEventListener('pointercancel', this.onPointerUp);
    c.removeEventListener('pointerleave', this.onLeave);
    c.removeEventListener('wheel', this.onWheel);
    c.removeEventListener('keydown', this.onKeyDown);
    this.globe.destroy();
  }

  resize() {
    const box = this.canvas.parentElement ?? this.canvas;
    const width = box.clientWidth;
    const height = box.clientHeight;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.width = width;
    this.height = height;
    this.dpr = dpr;
    this.globe.resize(width, height, dpr);
    this.overlay.width = Math.round(width * dpr);
    this.overlay.height = Math.round(height * dpr);
    this.needsDraw = true;
  }

  localPoint(event) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  cellAtScreen(x, y) {
    return this.globe.pick(x, y, this.camera);
  }

  describe(index) {
    if (index < 0) return null;
    const cityIndex = this.world.cityAt ? this.world.cityAt[index] : -1;
    // The garrison is the one thing on a cell that is somebody's secret. It is
    // dropped here rather than hidden in the panel, so that there is no path by
    // which a component can render a number this seat should not have.
    const owner = this.world.ownership ? this.world.ownership.get(index) : null;
    // The sea has no garrison to keep from anybody: not knowing and there being
    // nothing to know are different, and water is the second one.
    const known = owner === null || owner === SEA || canSeeForces(this.viewer, owner);
    return {
      index,
      terrain: TERRAIN[this.world.biome[index]],
      elevation: this.world.elevation[index],
      temperature: this.world.temperature[index],
      moisture: this.world.moisture[index],
      population: this.world.population ? this.world.population[index] : 0,
      city: cityIndex >= 0 ? this.world.cities[cityIndex] : null,
      resources: this.world.resources
        ? RESOURCES.map((r, n) => ({ ...r, amount: this.world.resources[n][index] })).filter(
            (r) => r.amount > 0.05,
          )
        : [],
      sites: this.world.sitesByTile?.get(index) ?? [],
      forces:
        this.world.forces && known
          ? UNITS.map((u, n) => ({ ...u, count: this.world.forces[n][index] })).filter(
              (u) => u.count > 0,
            )
          : [],
      // Told apart from "nobody is there", which is a different fact.
      forcesUnknown: !known,
      // A fleet is at a station rather than spread over the water, so it is
      // looked up by cell rather than read off a per-cell array. What may be
      // known about it turns on whose fleet it is — not on who owns the water,
      // which is nobody.
      ...this.fleetAt(index),
      nation: this.world.ownership ? this.world.ownership.nationAt(index) : null,
      territory: this.world.territoryName?.[index] ?? null,
      country:
        this.world.countryOf && this.world.countryOf[index] >= 0
          ? this.world.countries[this.world.countryOf[index]]
          : null,
      label: formatGeo(this.sphere, index),
    };
  }

  /**
   * The fleet moored on a cell, and whether this seat may count it.
   *
   * A station is a place and places are public: everyone knew the Home Fleet
   * lay at Scapa. A raider at sea is not a place, and is not shown at all to
   * anyone who may not count it — which was the whole point of sending it.
   */
  fleetAt(index) {
    const fleet = this.world.navies?.byCell.get(index) ?? null;
    if (!fleet) return { fleet: null, fleetKnown: false };
    const known = canSeeForces(this.viewer, NATION_INDEX[fleet.power]);
    if (fleet.secret && !known) return { fleet: null, fleetKnown: false };
    return { fleet, fleetKnown: known };
  }

  // ---------------------------------------------------------------- input

  onPointerDown(event) {
    this.canvas.focus({ preventScroll: true });
    this.canvas.setPointerCapture(event.pointerId);
    this.pointers.set(event.pointerId, this.localPoint(event));
    this.camera.spin.lat = 0;
    this.camera.spin.lon = 0;
    this.moved = 0;
    if (this.pointers.size === 1) this.dragging = true;
    if (this.pointers.size === 2) this.pinch = this.pointerDistance();
  }

  pointerDistance() {
    const [a, b] = [...this.pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  onPointerMove(event) {
    const point = this.localPoint(event);
    if (!this.pointers.has(event.pointerId)) {
      this.updateHover(point);
      return;
    }
    const previous = this.pointers.get(event.pointerId);
    this.pointers.set(event.pointerId, point);

    if (this.pointers.size === 2) {
      const distance = this.pointerDistance();
      if (this.pinch > 0) this.camera.zoomBy(distance / this.pinch);
      this.pinch = distance;
      this.needsDraw = true;
      this.emitCamera();
      return;
    }

    if (!this.dragging) return;
    const dx = (point.x - previous.x) / this.width;
    const dy = (point.y - previous.y) / this.height;
    this.moved += Math.abs(point.x - previous.x) + Math.abs(point.y - previous.y);
    this.camera.rotateBy(dx, dy);
    // Carry the last of the movement into the flywheel.
    this.camera.spin.lon = dx;
    this.camera.spin.lat = dy;
    this.needsDraw = true;
    this.emitCamera();
  }

  onPointerUp(event) {
    this.pointers.delete(event.pointerId);
    if (this.pointers.size < 2) this.pinch = 0;
    if (this.pointers.size === 0) {
      this.dragging = false;
      // A click, not a drag: select what is under it. Empty space clears.
      if (this.moved < 5) {
        const point = this.localPoint(event);
        const cell = this.cellAtScreen(point.x, point.y);
        this.selected = cell;
        this.handlers.onSelect?.(this.describe(cell));
        this.camera.spin.lat = 0;
        this.camera.spin.lon = 0;
        this.needsDraw = true;
      }
    }
  }

  onLeave() {
    this.hovered = -1;
    this.handlers.onHover?.(null);
  }

  updateHover(point) {
    const cell = this.cellAtScreen(point.x, point.y);
    if (cell === this.hovered) return;
    this.hovered = cell;
    this.handlers.onHover?.(this.describe(cell));
  }

  onWheel(event) {
    event.preventDefault();
    this.camera.zoomBy(Math.exp(-event.deltaY * 0.0016));
    this.needsDraw = true;
    this.emitCamera();
  }

  onKeyDown(event) {
    const step = event.shiftKey ? 12 : 4;
    let handled = true;
    switch (event.key) {
      case 'ArrowLeft': this.camera.rotateBy(step / 240, 0); break;
      case 'ArrowRight': this.camera.rotateBy(-step / 240, 0); break;
      case 'ArrowUp': this.camera.rotateBy(0, step / 240); break;
      case 'ArrowDown': this.camera.rotateBy(0, -step / 240); break;
      case '+': case '=': this.camera.zoomBy(1.3); break;
      case '-': case '_': this.camera.zoomBy(1 / 1.3); break;
      case '0': this.reset(); break;
      default: handled = false;
    }
    if (handled) {
      event.preventDefault();
      this.needsDraw = true;
      this.emitCamera();
    }
  }

  // ---------------------------------------------------------------- control

  setShowCities(show) {
    this.showCities = show;
    this.needsDraw = true;
  }

  setShowLabels(show) {
    this.showLabels = show;
    this.needsDraw = true;
  }

  setOverlay(layer) {
    this.globe.setLayer(layer);
    this.needsDraw = true;
  }

  /** Whose seat is looking at the board. */
  setViewer(viewer) {
    if (this.viewer === viewer) return;
    this.viewer = viewer;
    this.globe.setViewer(viewer);
    this.needsDraw = true;
  }

  zoomBy(factor) {
    this.camera.zoomBy(factor);
    this.needsDraw = true;
    this.emitCamera();
  }

  reset() {
    this.camera.lat = 25;
    this.camera.lon = 10;
    this.camera.distance = 3.2;
    this.camera.spin.lat = 0;
    this.camera.spin.lon = 0;
    this.needsDraw = true;
    this.emitCamera();
  }

  centerOn(lat, lon) {
    this.camera.centerOn(lat, lon);
    this.camera.spin.lat = 0;
    this.camera.spin.lon = 0;
    this.needsDraw = true;
    this.emitCamera();
  }

  emitCamera() {
    this.handlers.onCamera?.({
      lat: this.camera.lat,
      lon: this.camera.lon,
      distance: this.camera.distance,
      pixelsPerCell: this.camera.pixelsPerCell(this.width ?? 1200, this.height ?? 800),
      atMax: this.camera.distance <= MIN_DISTANCE + 1e-6,
      atMin: this.camera.distance >= MAX_DISTANCE - 1e-6,
    });
  }

  // ----------------------------------------------------------------- frame

  frame() {
    this.raf = requestAnimationFrame(this.frame);

    // Let go mid-turn and the globe keeps going, slowing to a stop.
    const spin = this.camera.spin;
    if (!this.dragging && (Math.abs(spin.lon) > SPIN_FLOOR || Math.abs(spin.lat) > SPIN_FLOOR)) {
      this.camera.rotateBy(spin.lon, spin.lat);
      spin.lon *= SPIN_FRICTION;
      spin.lat *= SPIN_FRICTION;
      this.needsDraw = true;
      this.emitCamera();
    }

    if (!this.needsDraw) return;
    this.needsDraw = false;

    this.globe.draw(this.camera);

    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);
    const taken = this.showLabels
      ? drawCountryLabels(ctx, this.world, this.camera, this.width, this.height)
      : [];
    if (this.showCities) {
      drawCityMarkers(ctx, this.world, this.camera, this.width, this.height, taken);
    }
    // Fleets last, so a battle fleet is never hidden under a city dot.
    drawFleetMarkers(ctx, this.world, this.camera, this.width, this.height, this.viewer, taken);
  }
}
