// LUMA — MATH-06 crate-pack controller: the storage room's open crate, the supply rack, the rope and the label plate.
// State only (no drawing, no timing); rules live in edu/thousand_rules.js. The scene animates what these calls return.
// Mirrors Scripts/Puzzles/CratePack.cs (EditMode tests use the same paths).
import { GROUP, classifyDrop, classifyClose, classifyLabel, containerValue, unitValue, total } from '../edu/thousand_rules.js';

export class CratePackController {
  constructor(stage, units) {
    this.stage = stage; this.units = units;
    this.phaseIdx = -1; this.madeUid = null;
    this.labelOptions = stage.label && stage.label.options.length ? stage.label.options.slice() : [];
    this.placedLabel = null; this.removedLabels = [];
    this.enterPhase(0);
  }

  get cur() { return this.stage.phases[this.phaseIdx]; }
  get unit() { return this.cur.unit; }
  get count() { return this.contents.length; }
  get hasLabel() { return this.labelOptions.length > 0; }
  /** 'pack' → (all phases closed) → 'label' (practice) → 'solved'. */
  get phase() { return this.state; }
  get containerValue() { return containerValue(this.units, this.unit); }
  get tally() { return total(this.units, this.contents.map((c) => c.unit)); }

  enterPhase(i) {
    this.phaseIdx = i; this.state = 'pack'; this.closed = false; this.undoStack = [];
    const ph = this.cur;
    this.contents = Array.from({ length: ph.given || 0 }, (_, k) => ({ uid: `${ph.phase_id}:given${k}`, unit: ph.unit, given: true }));
    this.supply = ph.supply.map((s, k) => ({
      uid: s.from_previous && this.madeUid ? this.madeUid : `${ph.phase_id}:${k}`,
      unit: s.unit, shelf: s.shelf, present: true, fromPrevious: !!s.from_previous,
    }));
  }

  item(uid) { return this.supply.find((s) => s.uid === uid) || null; }
  presentSupply() { return this.supply.filter((s) => s.present); }

  /** Drop a supply crate on the open container → {rule, slot}. Only 'ok' changes the state. */
  drop(uid) {
    if (this.state !== 'pack' || this.closed) return null;
    const it = this.item(uid);
    if (!it || !it.present) return null;
    const rule = classifyDrop(this.units, this.unit, this.count, it.unit);
    const slot = this.count;
    if (rule === 'ok') {
      it.present = false; this.contents.push({ uid, unit: it.unit, given: false });
      this.undoStack.push({ kind: 'drop', uid });
    }
    return { rule, slot, unit: it.unit };
  }

  /** The top crate the child put in can be lifted out again (given crates stay). */
  topRemovable() {
    const c = this.contents[this.contents.length - 1];
    return c && !c.given && this.state === 'pack' && !this.closed ? c.uid : null;
  }
  take() {
    const uid = this.topRemovable();
    if (!uid) return null;
    this.contents.pop(); this.item(uid).present = true;
    this.undoStack.push({ kind: 'take', uid });
    return uid;
  }

  /** Pull the rope → {ok, rule, missing, value}. A complete group closes (and commits: undo history is cleared). */
  close() {
    if (this.state !== 'pack' || this.closed) return null;
    const rule = classifyClose(this.count);
    if (rule !== 'ok') return { ok: false, rule, missing: GROUP - this.count };
    this.closed = true; this.undoStack = [];
    return { ok: true, rule, missing: 0, value: this.containerValue, unit: this.unit };
  }

  /** After a closed crate: the next phase (the made crate joins its supply), the label, or solved. Returns the new state. */
  advance() {
    if (!this.closed) return this.state;
    if (this.phaseIdx < this.stage.phases.length - 1) {
      this.madeUid = `made:${this.cur.phase_id}`;
      this.enterPhase(this.phaseIdx + 1);
      return this.state;
    }
    this.state = this.hasLabel ? 'label' : 'solved';
    return this.state;
  }

  /** A label plate on the closed crate → {ok, rule}. */
  placeLabel(value) {
    if (this.state !== 'label' || !this.labelOptions.includes(value)) return null;
    const rule = classifyLabel(value, this.stage.label.answer);
    if (rule === 'ok') { this.placedLabel = value; this.state = 'solved'; }
    return { ok: rule === 'ok', rule };
  }

  undo() {
    const u = this.undoStack.pop();
    if (!u) return null;
    if (u.kind === 'drop') { this.contents.pop(); this.item(u.uid).present = true; }
    else { const it = this.item(u.uid); it.present = false; this.contents.push({ uid: u.uid, unit: it.unit, given: false }); }
    return u;
  }

  /** Answer Assist (after 3 wrong): the wrong-size crates leave the rack; in the label phase one wrong plate goes. */
  assistRemove() {
    if (this.state === 'pack') {
      const want = unitValue(this.units, this.unit);
      const gone = this.supply.filter((s) => s.present && unitValue(this.units, s.unit) !== want);
      if (!gone.length) return null;
      for (const s of gone) { s.present = false; s.removed = true; }
      return { kind: 'supply', uids: gone.map((s) => s.uid) };
    }
    if (this.state === 'label') {
      const v = this.labelOptions.find((o) => o !== this.stage.label.answer);
      if (v === undefined) return null;
      this.labelOptions = this.labelOptions.filter((o) => o !== v); this.removedLabels.push(v);
      return { kind: 'label', value: v };
    }
    return null;
  }

  canClose() { return this.state === 'pack' && !this.closed && this.count === GROUP; }
  snapshot() {
    return { phase: this.state, phaseIdx: this.phaseIdx, unit: this.unit, count: this.count, closed: this.closed,
      contents: this.contents.map((c) => c.unit + (c.given ? '*' : '')).join(' '),
      supply: this.presentSupply().map((s) => s.unit).join(' '), labels: this.labelOptions.join(' '), placed: this.placedLabel };
  }
}
