// LUMA — SCI-01 controller: the bench (source / switch / lamp + wire bays), one test at a time, one variable at a
// time, every test written into the notebook. Rendering-agnostic state with an undo stack; mirror of the rules in
// edu/circuit_rules.js. The scene owns the animation; this file owns what is TRUE.
import { evaluate, diff, VAR_FA, REASON_FA, judgeGuess } from '../edu/circuit_rules.js';

export class CircuitController {
  /** hooks: {onPlace, onTake, onRun, onRefuse, onRecord, onReady, onSolved, onWrongConclusion, onGuess, log} */
  constructor(stage, hooks = {}) {
    Object.assign(this, { stage, hooks });
    this.bays = stage.bays || 2;
    this.slots = { battery: null, switch: null, lamp: null };   // part ids
    this.wires = new Array(this.bays).fill(null);                // wire part ids, one per bay
    this.closed = false;
    this.rows = [];
    this.pending = null;         // result of the last run, waiting to be written into the notebook
    this.lastRecorded = null;    // state snapshot of the last recorded row (the baseline of the next test)
    this.guess = null;
    this.solved = false;
    this.assist = false;
    this.undoStack = [];
    this.applySetup(stage.setup);
  }

  // ---------------------------------------------------------------- parts
  part(id) { return this.stage.parts.find((p) => p.id === id) || null; }
  isPlaced(id) { return this.slots.battery === id || this.slots.switch === id || this.slots.lamp === id || this.wires.includes(id); }
  /** Parts still lying in the tray (the scene draws them there). */
  trayParts() { return this.stage.parts.filter((p) => !this.isPlaced(p.id)); }

  applySetup(setup = null) {
    if (!setup) return;
    for (const k of ['battery', 'switch', 'lamp']) {
      const id = setup[k];
      if (typeof id === 'string' && id !== 'none') this.slots[k] = id;
    }
    (setup.wires || []).forEach((id, i) => { if (i < this.bays) this.wires[i] = id; });
    this.closed = !!setup.closed;
  }

  /** The four variables as the rules see them. */
  state() {
    const b = this.slots.battery ? this.part(this.slots.battery) : null;
    const l = this.slots.lamp ? this.part(this.slots.lamp) : null;
    return {
      battery: b ? (b.flat ? 'flat' : 'fresh') : 'none',
      switch: this.slots.switch ? (this.closed ? 'closed' : 'open') : 'none',
      lamp: l ? (l.kind === 'lamp' ? 'good' : 'none') : 'none',
      wires: this.wires.filter(Boolean).map((id) => ({ id, colour: (this.part(id) || {}).colour || 'red' })),
    };
  }

  /** Put a part into a holder ('battery' | 'switch' | 'lamp') or into a wire bay (0 … bays-1). */
  place(partId, where) {
    if (this.solved) return null;
    const p = this.part(partId);
    if (!p || this.isPlaced(partId)) return null;
    if (where === 'battery' || where === 'switch' || where === 'lamp') {
      if (p.kind !== where) return 'wrong_holder';
      if (this.slots[where]) return 'occupied';
      this.slots[where] = partId;
    } else {
      const i = Number(where);
      if (!(i >= 0 && i < this.bays) || p.kind !== 'wire') return 'wrong_holder';
      if (this.wires[i]) return 'occupied';
      this.wires[i] = partId;
    }
    this.undoStack.push({ op: 'place', partId, where });
    this.hooks.onPlace && this.hooks.onPlace(partId, where);
    return 'ok';
  }

  /** Take a part back out of a holder or a bay (also used by the drag that pulls a part off the bench). */
  take(where) {
    if (this.solved) return null;
    const id = (where === 'battery' || where === 'switch' || where === 'lamp') ? this.slots[where] : this.wires[Number(where)];
    if (!id) return null;
    if (where === 'battery' || where === 'switch' || where === 'lamp') this.slots[where] = null;
    else this.wires[Number(where)] = null;
    if (where === 'switch') this.closed = false;
    this.undoStack.push({ op: 'take', partId: id, where });
    this.hooks.onTake && this.hooks.onTake(id, where);
    return id;
  }

  /** The switch is the only part the child operates (tap), and it is one variable. */
  toggle() {
    if (this.solved || !this.slots.switch) return null;
    this.closed = !this.closed;
    this.undoStack.push({ op: 'toggle', from: !this.closed });
    return this.closed;
  }

  // ---------------------------------------------------------------- the method loop
  /** Say what you expect before you test (the hypothesis step; required in the transfer stage). */
  setGuess(id) {
    this.guess = id;
    this.hooks.onGuess && this.hooks.onGuess(id);
    return id;
  }

  /**
   * Run the test. Between two tests only ONE variable may change: if more than one changed since the last
   * recorded row the test is refused instead of answered (SCI_MULTIPLE_VARIABLE_CHANGE) — the child would not
   * be able to say which of the two made the lamp change.
   */
  run() {
    if (this.solved) return null;
    const now = this.state();
    if (this.lastRecorded) {
      const d = diff(this.lastRecorded, now);
      if (d.length > 1) {
        this.hooks.onRefuse && this.hooks.onRefuse('MULTIPLE_VARIABLE', d);
        this.hooks.log && this.hooks.log('experiment_refused', { changed: d });
        return { refused: 'MULTIPLE_VARIABLE', changed: d };
      }
    }
    const res = evaluate(now, this.bays);
    const changed = this.lastRecorded ? diff(this.lastRecorded, now) : [];
    this.pending = {
      snapshot: now, lit: res.lit, rule: res.rule, changed,
      changed_fa: changed.length ? changed.map((v) => VAR_FA[v]).join(' و ') : 'هیچ — آزمون نخست',
      saw_fa: res.lit ? 'چراغ روشن شد' : 'چراغ خاموش ماند',
      result_fa: REASON_FA[res.rule],
      guess: this.guess, guess_verdict: this.guess ? judgeGuess(this.guess, res) : null,
    };
    this.hooks.onRun && this.hooks.onRun(this.pending);
    this.hooks.log && this.hooks.log('experiment_run', { rule: res.rule, lit: res.lit, changed });
    return this.pending;
  }

  /** Write the pending test into the notebook: «چه دیدم / چه تغییر دادم / چه شد». */
  record() {
    if (!this.pending || this.solved) return null;
    const row = { n: this.rows.length + 1, ...this.pending };
    this.rows.push(row);
    this.lastRecorded = this.pending.snapshot;
    this.pending = null;
    this.guess = null;
    this.hooks.onRecord && this.hooks.onRecord(row);
    this.hooks.log && this.hooks.log('experiment_recorded', { row: row.n, rule: row.rule });
    if (this.rows.length >= this.stage.min_rows) this.hooks.onReady && this.hooks.onReady();
    return row;
  }

  readyToConclude() { return this.rows.length >= this.stage.min_rows; }

  /**
   * Conclude from the rows. Concluding before enough rows are written is the card's other misconception:
   * «مشاهده = نتیجه» (SCI_OBSERVATION_EQUALS_CONCLUSION) — seeing the lamp is not yet an answer.
   */
  conclude(optionId) {
    if (this.solved) return null;
    if (!this.readyToConclude()) {
      this.hooks.onRefuse && this.hooks.onRefuse('NEED_RECORDS', []);
      this.hooks.log && this.hooks.log('conclude_refused', { rows: this.rows.length, min: this.stage.min_rows });
      return { refused: 'NEED_RECORDS', have: this.rows.length, need: this.stage.min_rows };
    }
    if (optionId === this.stage.answer) {
      this.solved = true;
      this.hooks.onSolved && this.hooks.onSolved(optionId);
      return { ok: true };
    }
    this.hooks.onWrongConclusion && this.hooks.onWrongConclusion(optionId);
    return { ok: false };
  }

  // ---------------------------------------------------------------- undo
  undo() {
    if (this.solved || !this.undoStack.length) return null;
    const step = this.undoStack.pop();
    if (step.op === 'place') {
      if (step.where === 'battery' || step.where === 'switch' || step.where === 'lamp') this.slots[step.where] = null;
      else this.wires[Number(step.where)] = null;
    } else if (step.op === 'take') {
      if (step.where === 'battery' || step.where === 'switch' || step.where === 'lamp') this.slots[step.where] = step.partId;
      else this.wires[Number(step.where)] = step.partId;
    } else if (step.op === 'toggle') this.closed = step.from;
    if (step.op !== 'toggle') this.hooks.onTake && this.hooks.onTake(step.partId, step.where);
    return step;
  }

  reset() {
    if (this.solved) return 0;
    const n = this.undoStack.length;
    this.undoStack = [];
    this.slots = { battery: null, switch: null, lamp: null };
    this.wires = new Array(this.bays).fill(null);
    this.closed = false;
    this.pending = null; this.lastRecorded = null; this.guess = null;
    this.applySetup(this.stage.setup);
    return n;
  }

  /** Restore a finished stage (reload after solving): the bench shows the working circuit. */
  finishAll() {
    const setup = this.stage.solved_setup || this.stage.setup || {};
    this.applySetup(setup);
    this.closed = setup.closed !== undefined ? setup.closed : true;
    this.solved = true;
  }
}
