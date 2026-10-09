// LUMA — SCI-03 controller: MEASURE_SELECT_USE_RECORD. For every material the child SELECTS a tool, USES it by its
// own rule and RECORDs the reading in the notebook. Rendering-agnostic state with an undo stack; mirror of the rules
// in edu/measure_rules.js. The scene owns the animation; this file owns what is TRUE.
import { evaluate, judgeGuess, TOOL_OF, TOOLS, QUANTITY_FA, UNIT_FA } from '../edu/measure_rules.js';

export class MeasureController {
  /** hooks: {onTool, onUse, onRead, onRefuse, onRecord, onReady, onSolved, onWrongConclusion, onGuess, log} */
  constructor(stage, hooks = {}) {
    Object.assign(this, { stage, hooks });
    this.jobs = stage.jobs || [];
    this.jobIdx = 0;
    this.rows = [];
    this.pending = null;
    this.guess = null;
    this.solved = false;
    this.assist = false;
    this.undoStack = [];
    this.resetSetup();
  }

  // ---------------------------------------------------------------- jobs & tools
  job() { return this.jobs[this.jobIdx] || null; }
  get jobCount() { return this.jobs.length; }
  minRows() { return this.stage.min_rows || this.jobs.length; }
  tools() { return (this.stage.tools || ['balance', 'cylinder', 'ruler']).map((id) => TOOLS[id]).filter(Boolean); }
  /** The tool the rules say this job needs — never shown to the child before they chose (that is the hypothesis). */
  rightTool() { const j = this.job(); return j ? TOOL_OF[j.quantity] : null; }

  resetSetup() {
    this.tool = null;
    this.weights = 0;
    this.level = 0;
    this.eyeLevel = false;
    this.offset = 0;
    this.placed = false;
    this.pending = null;
  }

  // ---------------------------------------------------------------- using the tools
  selectTool(id) {
    if (this.solved || !TOOLS[id]) return null;
    const prev = this.tool;
    this.tool = id;
    this.pending = null;
    this.undoStack.push({ op: 'tool', from: prev });
    this.hooks.onTool && this.hooks.onTool(id);
    this.hooks.log && this.hooks.log('tool_selected', { tool: id, job: (this.job() || {}).id });
    return id;
  }

  /** Put the material where the tool can work on it: on the pan, under the ruler… (the cylinder is filled by pouring). */
  put() {
    if (this.solved || this.placed || !this.job()) return null;
    if (this.job().quantity === 'volume') return null;      // liquids are poured, not placed
    this.placed = true;
    this.undoStack.push({ op: 'put' });
    this.hooks.onUse && this.hooks.onUse('put');
    return true;
  }

  addWeight() {
    if (this.solved || this.jobQ() !== 'mass' || !this.placed) return null;
    this.weights += 1;
    this.pending = null;
    this.undoStack.push({ op: 'weight', step: 1 });
    this.hooks.onUse && this.hooks.onUse('weight', this.weights);
    return this.weights;
  }

  removeWeight() {
    if (this.solved || this.jobQ() !== 'mass' || this.weights <= 0) return null;
    this.weights -= 1;
    this.pending = null;
    this.undoStack.push({ op: 'weight', step: -1 });
    this.hooks.onUse && this.hooks.onUse('weight', this.weights);
    return this.weights;
  }

  /** Pour one unit into the measuring cylinder (and back out again with a negative n). */
  pour(n = 1) {
    if (this.solved || this.jobQ() !== 'volume') return null;
    const cap = (this.job() && this.job().capacity) || 8;
    const next = Math.max(0, Math.min(cap, this.level + n));
    const step = next - this.level;
    if (step === 0) return null;
    this.level = next;
    this.pending = null;
    this.undoStack.push({ op: 'pour', step });
    this.hooks.onUse && this.hooks.onUse('pour', this.level);
    return this.level;
  }

  /** The reading of a liquid is only true when the eye is level with the surface (the card's controlled step). */
  setEyeLevel(v) {
    if (this.solved || this.jobQ() !== 'volume') return null;
    this.eyeLevel = !!v;
    this.pending = null;
    this.hooks.onUse && this.hooks.onUse('eye', this.eyeLevel);
    return this.eyeLevel;
  }

  /** Lay the ruler: offset = where its zero mark sits (0 = flush with the near end of the thing). */
  setOffset(o) {
    if (this.solved || this.jobQ() !== 'length' || !this.placed) return null;
    this.offset = Math.max(0, Math.min(4, Math.round(o)));
    this.pending = null;
    this.hooks.onUse && this.hooks.onUse('offset', this.offset);
    return this.offset;
  }

  jobQ() { const j = this.job(); return j ? j.quantity : null; }

  /** The setup as the rules see it. */
  setup() {
    return { tool: this.tool, weights: this.weights, level: this.level, eyeLevel: this.eyeLevel, offset: this.offset };
  }

  // ---------------------------------------------------------------- reading & recording
  setGuess(id) {
    this.guess = id;
    this.hooks.onGuess && this.hooks.onGuess(id);
    this.hooks.log && this.hooks.log('guess', { tool: id, job: (this.job() || {}).id });
    return id;
  }

  /**
   * Read the tool. A wrong tool is refused with a reason and recorded as the card's misconception
   * (SCI_ONE_TOOL_MEASURES_ALL); a right tool answers with a reading that may still be «not yet» (the pans are
   * not level, the eye is not level, the ruler does not start at zero).
   */
  read() {
    if (this.solved || !this.job()) return null;
    const j = this.job();
    if (this.stage.require_guess && !this.guess) {
      this.hooks.onRefuse && this.hooks.onRefuse('NEED_GUESS', []);
      this.hooks.log && this.hooks.log('measure_refused', { rule: 'need_guess', job: j.id });
      return { refused: 'NEED_GUESS' };
    }
    if (j.quantity !== 'volume' && !this.placed) {
      this.hooks.onRefuse && this.hooks.onRefuse('NOT_PLACED', []);
      this.hooks.log && this.hooks.log('measure_refused', { rule: 'not_placed', job: j.id });
      return { refused: 'NOT_PLACED' };
    }
    const v = evaluate(j, this.setup());
    const value_fa = v.reading === null ? '—' : `${v.reading} ${UNIT_FA[j.quantity]}`;
    this.pending = {
      job: j.id, material_fa: j.material_fa, quantity: j.quantity, quantity_fa: QUANTITY_FA[j.quantity],
      tool: this.tool, tool_fa: this.tool ? TOOLS[this.tool].fa : '—',
      reading: v.reading, value_fa, ok: v.ok, rule: v.rule, state: v.state, reason_fa: v.reason_fa,
      right_tool: v.right_tool || null,
      guess: this.guess, guess_verdict: this.guess ? judgeGuess(this.guess, j) : null,
    };
    this.hooks.onRead && this.hooks.onRead(this.pending);
    this.hooks.log && this.hooks.log('measure_run', { job: j.id, tool: this.tool, rule: v.rule, reading: v.reading, ok: v.ok });
    return this.pending;
  }

  /** Write the reading into the notebook. Only a true reading is written — a «not yet» is a reason to keep trying. */
  record() {
    if (!this.pending || this.solved) return null;
    if (!this.pending.ok) {
      this.hooks.onRefuse && this.hooks.onRefuse('NOT_READY', [this.pending.state]);
      this.hooks.log && this.hooks.log('record_refused', { job: this.pending.job, state: this.pending.state });
      return { refused: 'NOT_READY', state: this.pending.state };
    }
    const row = { n: this.rows.length + 1, ...this.pending };
    this.rows.push(row);
    this.pending = null;
    this.guess = null;
    this.hooks.onRecord && this.hooks.onRecord(row);
    this.hooks.log && this.hooks.log('measure_recorded', { job: row.job, reading: row.reading });
    // next material: the bench is cleared, the tool choice is made again for the new job
    this.jobIdx = Math.min(this.jobs.length - 1, this.jobIdx + 1);
    this.resetSetup();
    if (this.rows.length >= this.minRows()) this.hooks.onReady && this.hooks.onReady();
    return row;
  }

  readyToConclude() { return this.rows.length >= this.minRows(); }

  conclude(optionId) {
    if (this.solved) return null;
    if (!this.readyToConclude()) {
      this.hooks.onRefuse && this.hooks.onRefuse('NEED_RECORDS', []);
      this.hooks.log && this.hooks.log('conclude_refused', { rows: this.rows.length, min: this.minRows() });
      return { refused: 'NEED_RECORDS', have: this.rows.length, need: this.minRows() };
    }
    if (optionId === this.stage.answer) {
      this.solved = true;
      this.hooks.onSolved && this.hooks.onSolved(optionId);
      return { ok: true };
    }
    this.hooks.onWrongConclusion && this.hooks.onWrongConclusion(optionId);
    this.hooks.log && this.hooks.log('conclude_wrong', { option: optionId });
    return { ok: false };
  }

  // ---------------------------------------------------------------- undo
  undo() {
    if (this.solved || !this.undoStack.length) return null;
    const s = this.undoStack.pop();
    if (s.op === 'tool') this.tool = null;
    else if (s.op === 'put') this.placed = false;
    else if (s.op === 'weight') this.weights = Math.max(0, this.weights - s.step);
    else if (s.op === 'pour') this.level = Math.max(0, this.level - s.step);
    this.pending = null;
    return s;
  }

  reset() {
    if (this.solved) return 0;
    const n = this.undoStack.length;
    this.undoStack = [];
    this.resetSetup();
    return n;
  }

  /** Restore a finished stage (reload after solving): the notebook shows every row and the last tool stays out. */
  finishAll() {
    for (const j of this.jobs) {
      if (j.quantity === 'mass') this.weights = j.target;
      if (j.quantity === 'volume') { this.level = j.target; this.eyeLevel = true; }
      if (j.quantity === 'length') this.offset = 0;
      this.rows.push({ n: this.rows.length + 1, job: j.id, material_fa: j.material_fa, quantity: j.quantity,
        quantity_fa: QUANTITY_FA[j.quantity], tool: TOOL_OF[j.quantity], tool_fa: TOOLS[TOOL_OF[j.quantity]].fa,
        reading: j.target, value_fa: `${j.target} ${UNIT_FA[j.quantity]}`, ok: true });
    }
    this.tool = this.jobs.length ? TOOL_OF[this.jobs[this.jobs.length - 1].quantity] : null;
    this.placed = true;
    this.jobIdx = this.jobs.length - 1;
    this.solved = true;
  }
}
