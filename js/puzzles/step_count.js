// LUMA — MATH-02 controllers (plan 12 Q01 #2: Step Counter + Basket Snap). Rendering-agnostic state with undo stacks;
// the room (scenes/stall_math02.js) draws them and forwards input. Unity mirror: Scripts/Puzzles/StepCount/*.cs
import { countOf, trailState, placeRule, solveRule, countingMethod, assistGroupsLeft, basketState } from '../edu/step_rules.js';

/** Number Trail round: whole groups from the supply or single apples from the heap go on the packing table. */
export class TrailController {
  /** round: one entry of stage.rounds; hooks: {onPlace(item, from, to), onRemove(item, from, to), onWrong(rule), onSolved(rule)} */
  constructor(round, hooks = {}) {
    this.round = round; this.hooks = hooks;
    this.supply = Array(round.groups).fill(true);        // true = the group still waits on the ground
    this.placed = [];                                    // [{size, src}] in placing order; src = supply index or -1 (heap)
    this.heap = true; this.assisted = false; this.solved = false; this.undoStack = [];
  }
  get count() { return countOf(this.placed.map((p) => p.size)); }
  get sizes() { return this.placed.map((p) => p.size); }
  state() { return trailState(this.round, this.sizes); }
  method() { return countingMethod(this.round, this.sizes); }
  canPlaceGroup(i) { return !this.solved && !!this.supply[i]; }
  canPlaceSingle() { return !this.solved && this.heap; }

  /** src: supply index for a group, -1 for a single apple from the heap. Returns {rule, state}. */
  place(src, { record = true } = {}) {
    if (this.solved) return null;
    if (src >= 0 && !this.supply[src]) return null;
    if (src < 0 && !this.heap) return null;
    const size = src >= 0 ? this.round.step : 1;
    const before = this.count, rule = placeRule(this.round, this.sizes, size);
    if (src >= 0) this.supply[src] = false;
    const item = { size, src };
    this.placed.push(item);
    if (record) this.undoStack.push({ op: 'place', item, index: this.placed.length - 1 });
    this.hooks.onPlace && this.hooks.onPlace(item, before, this.count);
    if (rule) this.hooks.onWrong && this.hooks.onWrong(rule);
    const st = this.state();
    if (st === 'solved') { this.solved = true; this.hooks.onSolved && this.hooks.onSolved(solveRule(this.round, this.sizes)); }
    return { rule, state: st };
  }

  /** Take item `index` off the table (it goes back to the supply / heap). */
  remove(index, { record = true } = {}) {
    if (this.solved || index < 0 || index >= this.placed.length) return null;
    const before = this.count;
    const [item] = this.placed.splice(index, 1);
    if (item.src >= 0) this.supply[item.src] = true;
    if (record) this.undoStack.push({ op: 'remove', item, index });
    this.hooks.onRemove && this.hooks.onRemove(item, before, this.count);
    this.checkSolvedAfterTakeBack();
    return item;
  }

  /** Taking back the extra item after an overshoot can land exactly on the target: that also solves the round. */
  checkSolvedAfterTakeBack() {
    if (this.placed.length && this.state() === 'solved') {
      this.solved = true; this.hooks.onSolved && this.hooks.onSolved(solveRule(this.round, this.sizes));
    }
  }

  undo() {
    if (this.solved) return null;
    const a = this.undoStack.pop();
    if (!a) return null;
    if (a.op === 'place') {
      const i = this.placed.indexOf(a.item);
      const before = this.count;
      this.placed.splice(i, 1);
      if (a.item.src >= 0) this.supply[a.item.src] = true;
      this.hooks.onRemove && this.hooks.onRemove(a.item, before, this.count);
      this.checkSolvedAfterTakeBack();
    } else {
      const before = this.count;
      if (a.item.src >= 0) this.supply[a.item.src] = false;
      this.placed.splice(a.index, 0, a.item);
      this.hooks.onPlace && this.hooks.onPlace(a.item, before, this.count);
    }
    return a;
  }

  reset() {
    if (this.solved) return;
    this.supply = this.supply.map(() => true);
    this.placed = []; this.undoStack = [];
    if (this.assisted) this.applyAssist();
  }

  /** Answer Assist: singles leave the table, the heap closes and only the groups still needed stay in the supply. */
  applyAssist() {
    this.assisted = true; this.heap = false;
    this.placed = this.placed.filter((p) => p.size === this.round.step);
    let keep = assistGroupsLeft(this.round, this.sizes);
    this.supply = this.supply.map((v) => { if (v && keep > 0) { keep--; return true; } return false; });
    for (const p of this.placed) if (p.src >= 0) this.supply[p.src] = false;
    this.undoStack = [];
    const left = this.supply.filter(Boolean).length;
    this.checkSolvedAfterTakeBack();          // e.g. 9 + 2 = 11 → the single leaves → exactly 10
    return left;
  }
}

/** Basket Snap: `fruits` apples on the mat, `baskets` baskets on the table; the check runs when the mat is empty. */
export class BasketController {
  /** stage: puzzle.stages[1]; hooks: {onMove(apple, from, to), onWrong(rule, counts), onSolved(counts), onBounce(apple, basket)} */
  constructor(stage, hooks = {}) {
    this.stage = stage; this.hooks = hooks;
    this.baskets = Array.from({ length: stage.baskets }, () => []);
    this.mat = [...Array(stage.fruits).keys()];          // apple ids still on the mat
    this.cap = stage.basket_capacity; this.solved = false; this.undoStack = []; this.assisted = false;
    this.lastState = 'incomplete';
  }
  counts() { return this.baskets.map((b) => b.length); }
  where(apple) { if (this.mat.includes(apple)) return 'mat'; return this.baskets.findIndex((b) => b.includes(apple)); }
  canPut(b) { return !this.solved && this.baskets[b].length < this.cap; }
  topOf(b) { const x = this.baskets[b]; return x.length ? x[x.length - 1] : -1; }

  /** Move `apple` to basket b (or 'mat'). Returns the resulting state or null (full basket → onBounce). */
  move(apple, to, { record = true } = {}) {
    if (this.solved) return null;
    const from = this.where(apple);
    if (from === to) return this.lastState;
    if (to !== 'mat' && !this.canPut(to)) { this.hooks.onBounce && this.hooks.onBounce(apple, to); return null; }
    this._detach(apple, from);
    if (to === 'mat') this.mat.push(apple); else this.baskets[to].push(apple);
    if (record) this.undoStack.push({ apple, from, to });
    this.hooks.onMove && this.hooks.onMove(apple, from, to);
    return this.evaluate();
  }
  _detach(apple, from) {
    if (from === 'mat') this.mat.splice(this.mat.indexOf(apple), 1);
    else this.baskets[from].splice(this.baskets[from].indexOf(apple), 1);
  }
  evaluate() {
    const counts = this.counts(), st = basketState(counts, this.mat.length);
    const was = this.lastState; this.lastState = st;
    if (st === 'solved') { this.solved = true; this.hooks.onSolved && this.hooks.onSolved(counts); }
    else if (st !== 'incomplete' && st !== was) this.hooks.onWrong && this.hooks.onWrong(st, counts);
    return st;
  }
  undo() {
    if (this.solved) return null;
    const a = this.undoStack.pop();
    if (!a) return null;
    this._detach(a.apple, a.to);
    if (a.from === 'mat') this.mat.push(a.apple); else this.baskets[a.from].push(a.apple);
    this.hooks.onMove && this.hooks.onMove(a.apple, a.to, a.from);
    this.lastState = basketState(this.counts(), this.mat.length);
    return a;
  }
  reset() {
    if (this.solved) return;
    this.baskets = this.baskets.map(() => []);
    this.mat = [...Array(this.stage.fruits).keys()];
    this.undoStack = []; this.lastState = 'incomplete';
  }
  /** Answer Assist: every basket takes at most its share (extra apples go back to the mat). */
  applyAssist() {
    this.assisted = true;
    this.cap = this.stage.fruits / this.stage.baskets;
    for (const b of this.baskets) while (b.length > this.cap) this.mat.push(b.pop());
    this.undoStack = []; this.lastState = basketState(this.counts(), this.mat.length);
    return this.cap;
  }
}
