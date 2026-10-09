// LUMA — PatternSlotController (plan 07 Puzzles/PatternSlot; plan 12 Q01 #1). Rendering-agnostic puzzle state with an
// undo stack; the room (scene) draws it and forwards input. Unity mirror: Scripts/Puzzles/PatternSlot/PatternSlotController.cs
import { isCorrect, classifyWrong, isSolved, nextToFix, assistOptions } from '../edu/pattern_rules.js';

export class PatternSlotController {
  /** stage: one entry of puzzle.stages; hooks: {onCorrect, onWrong(rule), onSolved, onChange} */
  constructor(stage, hooks = {}) {
    this.stage = stage; this.hooks = hooks;
    this.slots = stage.given.map((g) => g || '');
    this.undoStack = []; this.solved = false; this.available = stage.tray.slice();
  }
  isGiven(i) { return !!this.stage.given[i]; }
  isLit(i) { return !!this.slots[i] && isCorrect(this.stage, i, this.slots[i]); }
  canTake(i) { return !this.solved && !this.isGiven(i) && !!this.slots[i]; }
  canDrop(i) { return !this.solved && !this.isGiven(i); }
  piece(id) { return this.stage.pieces.find((p) => p.id === id); }

  /** Place `id` in slot i (replacing a wrong one). Returns {correct, rule}. */
  place(i, id, { record = true } = {}) {
    if (!this.canDrop(i)) return null;
    const prev = this.slots[i];
    const rule = classifyWrong(this.stage, this.slots, i, id);
    this.slots[i] = id;
    if (record) this.undoStack.push({ slot: i, prev, next: id });
    const correct = isCorrect(this.stage, i, id);
    if (correct) this.hooks.onCorrect && this.hooks.onCorrect(i, id);
    else this.hooks.onWrong && this.hooks.onWrong(i, id, rule);
    this.refreshAssist(); this.hooks.onChange && this.hooks.onChange();
    if (correct && isSolved(this.stage, this.slots)) { this.solved = true; this.hooks.onSolved && this.hooks.onSolved(); }
    return { correct, rule };
  }
  /** Take a placed (non-given) lamp off its hook. */
  take(i) {
    if (!this.canTake(i)) return null;
    const prev = this.slots[i];
    this.slots[i] = '';
    this.undoStack.push({ slot: i, prev, next: '' });
    this.refreshAssist(); this.hooks.onChange && this.hooks.onChange();
    return prev;
  }
  undo() {
    if (this.solved || !this.undoStack.length) return null;
    const a = this.undoStack.pop();
    this.slots[a.slot] = a.prev;
    this.refreshAssist(); this.hooks.onChange && this.hooks.onChange();
    return a;
  }
  reset() {
    if (this.solved) return;
    this.slots = this.stage.given.map((g) => g || '');
    this.undoStack = [];
    this.refreshAssist(); this.hooks.onChange && this.hooks.onChange();
  }
  /** Answer Assist stays active for the rest of the stage and always targets the slot that needs fixing next, so it can
   *  never hide an option a later slot needs (no soft lock, plan 12 §3). */
  applyAssist(n) { this.assistN = n; return this.refreshAssist(); }
  refreshAssist() { if (this.assistN) this.available = assistOptions(this.stage, this.slots, this.assistN); return this.available; }
  nextToFix() { return nextToFix(this.stage, this.slots); }
  litCount() { return this.slots.filter((_, i) => !this.isGiven(i) && this.isLit(i)).length; }
}
