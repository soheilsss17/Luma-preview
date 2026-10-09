// LUMA — GearChainController: rendering-agnostic state of one gear-board stage with an undo stack.
// Unity mirror: Scripts/Puzzles/GearChain/GearChainState.cs. The room (scene) draws it and forwards input.
import { evaluateChain, classifyPlacement, usefulTypes } from '../edu/gear_rules.js';

export class GearChainController {
  /** puzzle: whole GEAR_TUTORIAL data; stage: one entry of puzzle.stages; hooks: {onPlace(i,type,kind), onSolved, onChange} */
  constructor(puzzle, stage, hooks = {}) {
    this.puzzle = puzzle; this.stage = stage; this.hooks = hooks;
    this.placed = stage.pegs.map((s, i) => (s === 'fixed' ? puzzle.pegs[i].need : null));
    this.fromTray = stage.pegs.map(() => -1);          // which tray item sits on each peg (-1: fixed or empty)
    this.used = stage.tray.map(() => false);
    this.undoStack = []; this.solved = false; this.assist = false;
    this.result = evaluateChain(puzzle, this.placed);
  }
  isFixed(i) { return this.stage.pegs[i] === 'fixed'; }
  canDrop(i) { return !this.solved && this.stage.pegs[i] === 'empty' && !this.placed[i]; }
  canTake(i) { return !this.solved && this.stage.pegs[i] === 'empty' && !!this.placed[i]; }
  /** Tray items the child may pick up now (answer assist hides gears that fit no remaining empty peg). */
  trayAvailable(k) {
    if (this.used[k] || this.solved) return false;
    return !this.assist || usefulTypes(this.puzzle, this.stage, this.placed).has(this.stage.tray[k]);
  }
  place(i, k, { record = true } = {}) {
    if (!this.canDrop(i) || this.used[k]) return null;
    const type = this.stage.tray[k];
    this.placed[i] = type; this.fromTray[i] = k; this.used[k] = true;
    if (record) this.undoStack.push({ op: 'place', peg: i, k });
    return this._after(i, type);
  }
  take(i) {
    if (!this.canTake(i)) return null;
    const k = this.fromTray[i];
    this.placed[i] = null; this.fromTray[i] = -1; this.used[k] = false;
    this.undoStack.push({ op: 'take', peg: i, k });
    this._after(-1, null);
    return k;
  }
  undo() {
    if (this.solved || !this.undoStack.length) return null;
    const a = this.undoStack.pop();
    if (a.op === 'place') { this.placed[a.peg] = null; this.fromTray[a.peg] = -1; this.used[a.k] = false; }
    else { this.placed[a.peg] = this.stage.tray[a.k]; this.fromTray[a.peg] = a.k; this.used[a.k] = true; }
    this._after(-1, null);
    return a;
  }
  reset() {
    if (this.solved) return;
    this.placed = this.stage.pegs.map((s, i) => (s === 'fixed' ? this.puzzle.pegs[i].need : null));
    this.fromTray = this.stage.pegs.map(() => -1); this.used = this.stage.tray.map(() => false); this.undoStack = [];
    this._after(-1, null);
  }
  applyAssist() { this.assist = true; }
  /** Next empty peg that still needs its gear (for H1/H3). */
  nextToFix() {
    for (let i = 0; i < this.placed.length; i++) {
      if (this.stage.pegs[i] === 'empty' && this.placed[i] !== this.puzzle.pegs[i].need) return i;
    }
    return -1;
  }
  _after(i, type) {
    this.result = evaluateChain(this.puzzle, this.placed);
    const kind = i >= 0 ? classifyPlacement(this.puzzle, i, type) : null;
    if (i >= 0 && this.hooks.onPlace) this.hooks.onPlace(i, type, kind);
    if (this.hooks.onChange) this.hooks.onChange(this.result);
    if (this.result.outputTurning && !this.solved) { this.solved = true; this.hooks.onSolved && this.hooks.onSolved(); }
    return { kind, result: this.result };
  }
}
