// LUMA — MATH-05 controller (plan 12 Q01 #5: Mirror Drag on the garden bed + the two-axis mosaic). Rendering-agnostic
// state with an undo stack; the room (scenes/garden_math05.js) draws it and forwards input.
// Unity mirror: Scripts/Puzzles/Symmetry/MirrorGridController.cs
import { basePieces, classifyDrop, phaseSolved, missing, assistSnap, ghostOf, WRONG } from '../edu/symmetry_rules.js';

export class MirrorGridController {
  /** stage: one entry of puzzle.stages; hooks: {onPlace(piece), onWrong(rule, drop, ghost), onReject(rule, drop),
   *  onUndo(piece), onPhaseSolved(phaseIndex), onSolved()} */
  constructor(stage, hooks = {}) {
    this.stage = stage; this.hooks = hooks;
    this.startPhase(0);
  }
  get phase() { return this.stage.phases[this.pi]; }
  get grid() { return this.stage; }
  get lastPhase() { return this.pi === this.stage.phases.length - 1; }

  startPhase(pi) {
    this.pi = pi;
    this.pieces = basePieces(this.stage, pi).map((p) => ({ ...p, given: true }));
    this.undoStack = []; this.phaseDone = false; this.solved = false; this.assist = false;
  }
  /** Advance after onPhaseSolved (the room plays its animation first). */
  nextPhase() { if (this.phaseDone && !this.lastPhase) this.startPhase(this.pi + 1); }
  missing() { return missing(this.stage, this.phase, this.pieces); }
  at(r, c) { return this.pieces.find((p) => p.r === r && p.c === c) || null; }

  /** The child drops a piece of `type` on cell (r, c). Returns {rule, cell} — cell is where it snapped (or null). */
  drop(type, r, c) {
    if (this.phaseDone) return null;
    let cell = { r, c, type };
    let rule = classifyDrop(this.stage, this.phase, this.pieces, cell);
    if (this.assist && rule !== 'ok') {                          // Answer Assist: only mirror cells take a piece
      const s = assistSnap(this.stage, this.phase, this.pieces, cell);
      if (s) { cell = { ...s, type }; rule = 'ok'; } else rule = WRONG.has(rule) ? 'assist_reject' : rule;
    }
    if (rule === 'ok') {
      const piece = { r: cell.r, c: cell.c, type, given: false };
      this.pieces.push(piece); this.undoStack.push(piece);
      this.hooks.onPlace && this.hooks.onPlace(piece);
      if (phaseSolved(this.stage, this.phase, this.pieces)) {
        this.phaseDone = true;
        if (this.lastPhase) this.solved = true;
        this.hooks.onPhaseSolved && this.hooks.onPhaseSolved(this.pi);
        if (this.solved) this.hooks.onSolved && this.hooks.onSolved();
      }
      return { rule, cell };
    }
    if (WRONG.has(rule)) this.hooks.onWrong && this.hooks.onWrong(rule, cell, ghostOf(this.stage, this.phase, cell));
    else this.hooks.onReject && this.hooks.onReject(rule, cell);
    return { rule, cell: null };
  }

  applyAssist() { this.assist = true; return this.missing().length; }

  /** Undo the last placement of this phase (a finished phase cannot be undone). */
  undo() {
    if (this.phaseDone) return null;
    const p = this.undoStack.pop();
    if (!p) return null;
    this.pieces.splice(this.pieces.indexOf(p), 1);
    this.hooks.onUndo && this.hooks.onUndo(p);
    return p;
  }
  /** Take back every placement of this phase. */
  reset() {
    if (this.phaseDone) return 0;
    const n = this.undoStack.length;
    this.pieces = this.pieces.filter((p) => p.given); this.undoStack = [];
    return n;
  }
  /** Restore a finished stage (reload after solving): every phase completed. */
  finishAll() {
    this.startPhase(this.stage.phases.length - 1);
    for (const t of this.missing()) this.pieces.push({ ...t, given: false });
    this.phaseDone = true; this.solved = true;
  }
}
