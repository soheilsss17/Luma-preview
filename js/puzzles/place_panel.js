// LUMA — MATH-07 place-panel controller: the gear room's four-column number panel, the digit tiles on the tray bench,
// the weigh lever of the value beam, and the shipment-label question of the transfer.
// State only (no drawing, no timing); rules live in edu/place_value_rules.js. The scene animates what these calls return.
// Mirrors Scripts/Puzzles/PlacePanel/PlacePanelController.cs (EditMode tests use the same paths).
import { COLS, digitsOf, valueOf, classifyBuild, classifyDigitValue, lean, firstWrongColumn } from '../edu/place_value_rules.js';

export class PlacePanelController {
  constructor(stage) {
    this.stage = stage;
    this.undoStack = []; this.locked = [false, false, false, false];
    if (stage.kind === 'build') {
      this.target = stage.target;
      this.tiles = stage.tiles.map((d, k) => ({ uid: `t${k}`, digit: d }));
      this.slots = [null, null, null, null];
      this.state = 'build';
    } else {
      this.rounds = stage.rounds; this.roundIdx = 0;
      this.options = this.rounds[0].options.slice(); this.removed = [];
      this.state = 'ask';
    }
  }

  // ------------------------------------------------------------ build
  tile(uid) { return this.tiles.find((t) => t.uid === uid) || null; }
  slotOf(uid) { return this.slots.indexOf(uid); }
  trayTiles() { return this.tiles.filter((t) => this.slotOf(t.uid) < 0); }
  get placed() { return this.slots.map((u) => (u ? this.tile(u).digit : null)); }
  get value() { return valueOf(this.placed); }
  get full() { return this.slots.every(Boolean); }
  canWeigh() { return this.state === 'build'; }

  /**
   * A tile onto column `col` → {col, from, displaced, displacedTo}. A tile already in the column is swapped into the
   * dragged tile's old column (or goes back to the tray). Locked columns (Assist / H3 example) never change.
   */
  place(uid, col) {
    if (this.state !== 'build' || col < 0 || col >= COLS || this.locked[col]) return null;
    const t = this.tile(uid);
    if (!t || this.slots[col] === uid) return null;
    const from = this.slotOf(uid);
    if (from >= 0 && this.locked[from]) return null;
    this.undoStack.push(this.slots.slice());
    const displaced = this.slots[col];
    this.slots[col] = uid;
    if (from >= 0) this.slots[from] = displaced;
    return { col, from, displaced, displacedTo: displaced ? (from >= 0 ? from : 'tray') : null, digit: t.digit };
  }

  /** Lift a tile out of its column back to the tray → its uid. */
  remove(col) {
    if (this.state !== 'build' || this.locked[col] || !this.slots[col]) return null;
    this.undoStack.push(this.slots.slice());
    const uid = this.slots[col]; this.slots[col] = null;
    return uid;
  }

  /** Pull the weigh lever → {ok, rule, value, lean, empty}. The right build solves (and commits). */
  weigh() {
    if (this.state !== 'build') return null;
    const placed = this.placed, rule = classifyBuild(this.target, placed);
    const empty = placed.map((d, i) => (d === null ? i : -1)).filter((i) => i >= 0);
    const r = { ok: rule === 'ok', rule, value: valueOf(placed), lean: lean(this.target, placed), empty };
    if (r.ok) { this.state = 'solved'; this.undoStack = []; }
    return r;
  }

  /** H3 (card v1+v2): one tile moves to its right column as an example and locks there → the place() result + uid. */
  placeExample() {
    if (this.state !== 'build') return null;
    const col = firstWrongColumn(this.target, this.placed);
    if (col < 0) return null;
    const want = digitsOf(this.target)[col];
    const free = (t) => t.digit === want && !(this.slotOf(t.uid) >= 0 && this.locked[this.slotOf(t.uid)]);
    const ok = (t) => { const s = this.slotOf(t.uid); return s >= 0 && this.placed[s] === digitsOf(this.target)[s]; };
    const pick = this.tiles.find((t) => free(t) && this.slotOf(t.uid) < 0) || this.tiles.find((t) => free(t) && !ok(t))
      || this.tiles.find(free);
    if (!pick) return null;
    const r = this.place(pick.uid, col);
    this.locked[col] = true; this.undoStack = [];
    return { ...r, uid: pick.uid };
  }

  /**
   * Answer Assist (after 3 wrong weighs): the tiles in wrong columns go back to the tray and the right ones lock; with
   * nothing right yet, one example tile is placed and locked (as H3) → {kind, returned, locked, example} or null.
   */
  assist() {
    if (this.state === 'ask') {
      const v = this.options.find((o) => o !== this.round.answer);
      if (v === undefined) return null;
      this.options = this.options.filter((o) => o !== v); this.removed.push(v);
      return { kind: 'option', value: v };
    }
    if (this.state !== 'build') return null;
    const t = digitsOf(this.target), returned = [], locked = [];
    this.slots.forEach((u, i) => {
      if (!u || this.locked[i]) return;
      if (this.tile(u).digit === t[i]) { this.locked[i] = true; locked.push(i); } else { this.slots[i] = null; returned.push(u); }
    });
    let example = null;
    if (!locked.length && !this.locked.some(Boolean)) example = this.placeExample();
    this.undoStack = [];
    if (!returned.length && !locked.length && !example) return null;
    return { kind: 'lock', returned, locked, example };
  }

  // ------------------------------------------------------------ digit value (transfer)
  get round() { return this.rounds[this.roundIdx]; }
  /** The value chosen for the marked digit → {ok, rule, state}. A right answer moves to the next shipment (or solves). */
  answer(value) {
    if (this.state !== 'ask' || !this.options.includes(value)) return null;
    const r = this.round, rule = classifyDigitValue(r.number, r.index, value);
    if (rule === 'ok') {
      if (this.roundIdx < this.rounds.length - 1) {
        this.roundIdx++; this.options = this.round.options.slice(); this.removed = [];
      } else this.state = 'solved';
    }
    return { ok: rule === 'ok', rule, state: this.state };
  }

  // ------------------------------------------------------------ common
  undo() {
    if (this.state !== 'build') return null;
    const s = this.undoStack.pop();
    if (!s) return null;
    this.slots = s;
    return s;
  }

  snapshot() {
    if (this.stage.kind !== 'build') return { state: this.state, round: this.roundIdx, options: this.options.join(' ') };
    return { state: this.state, placed: this.placed.map((d) => (d === null ? '_' : d)).join(''), value: this.value,
      locked: this.locked.map((l) => (l ? 1 : 0)).join(''), tray: this.trayTiles().map((t) => t.digit).join('') };
  }
}
