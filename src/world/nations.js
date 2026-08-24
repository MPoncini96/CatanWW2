// The eight powers, plus everyone who stayed out of it.
//
// Colours follow the Axis & Allies convention where it survives contact with a
// dark map, and depart from it where it does not: Germany is properly black,
// which would vanish here, so it takes the pale steel of a feldgrau greatcoat.
// Neutrals are a receding grey so the belligerents read first.

export const NEUTRAL = 0;
/** Sentinel for water: the sea belongs to nobody and is not a neutral state. */
export const SEA = 255;

export const NATIONS = [
  { id: 'neutral', name: 'Independent', color: '#59606d', side: null },
  { id: 'usa', name: 'United States', color: '#3fa34d', side: 'allies' },
  { id: 'uk', name: 'Great Britain', color: '#d8b04a', side: 'allies' },
  { id: 'france', name: 'France', color: '#4d8fd6', side: 'allies' },
  { id: 'ussr', name: 'Russia', color: '#cf3b3b', side: 'allies' },
  { id: 'china', name: 'China', color: '#c77ec2', side: 'allies' },
  { id: 'germany', name: 'Germany', color: '#c6cad3', side: 'axis' },
  { id: 'italy', name: 'Italy', color: '#6fbfa0', side: 'axis' },
  { id: 'japan', name: 'Japan', color: '#e8913a', side: 'axis' },
];

export const NATION_INDEX = Object.fromEntries(NATIONS.map((n, i) => [n.id, i]));

/**
 * Who owns what, and the record of it changing hands.
 *
 * Ownership is meant to move: this is a mutable layer over the board, not part
 * of the generated world. Every change is logged, so a territory's history can
 * be replayed and the renderer can tell when it needs to redraw.
 */
export class Ownership {
  /** @param {Uint8Array} owner nation index per tile */
  constructor(owner) {
    this.owner = owner;
    this.version = 0;
    this.log = [];
    this.listeners = new Set();
  }

  get(index) {
    return this.owner[index];
  }

  nationAt(index) {
    const id = this.owner[index];
    return id === SEA ? null : NATIONS[id];
  }

  /**
   * Hand one tile to a nation.
   * @returns {boolean} whether anything actually changed
   */
  set(index, nation, meta = {}) {
    const to = typeof nation === 'string' ? NATION_INDEX[nation] : nation;
    if (to === undefined || to < 0 || to >= NATIONS.length) {
      throw new Error(`unknown nation: ${nation}`);
    }
    const from = this.owner[index];
    if (from === to) return false;
    this.owner[index] = to;
    this.log.push({ index, from, to, ...meta });
    this.version += 1;
    this.emit();
    return true;
  }

  /** Hand a batch of tiles over as one event — a campaign, an annexation. */
  transfer(indices, nation, meta = {}) {
    const to = typeof nation === 'string' ? NATION_INDEX[nation] : nation;
    let changed = 0;
    for (const index of indices) {
      const from = this.owner[index];
      if (from === to) continue;
      this.owner[index] = to;
      this.log.push({ index, from, to, ...meta });
      changed += 1;
    }
    if (changed) {
      this.version += 1;
      this.emit();
    }
    return changed;
  }

  /** Every recorded change to one tile, oldest first. */
  history(index) {
    return this.log.filter((entry) => entry.index === index);
  }

  /** Land tiles per nation, indexed the same way as NATIONS. Sea is excluded. */
  tally() {
    const counts = new Array(NATIONS.length).fill(0);
    for (let i = 0; i < this.owner.length; i += 1) {
      const id = this.owner[i];
      if (id !== SEA) counts[id] += 1;
    }
    return counts;
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit() {
    for (const fn of this.listeners) fn(this);
  }
}
