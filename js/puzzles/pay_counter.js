// LUMA — MATH-08 pay-counter controller: the market counter, the three token trays, the pay counter's three
// compartments and the seller's «هنوز به مقدار لازم نرسیده‌ایم.» / «یک لحظه؛ می‌توانی مقدار مناسب‌تری پیدا کنی؟».
// State only (no drawing, no timing); rules live in edu/money_rules.js. The scene animates what these calls return.
// Mirrors Scripts/Puzzles/PayCounter/PayCounterController.cs (EditMode tests use the same paths).
//
// Mastery (card §22 «ساخت مبلغ با حداقل دو ترکیب متفاوت»): a stage is solved by paying the SAME price in two DIFFERENT
// combinations. The first exact payment is accepted with «باز هم می‌توانی؟ به یک شکلِ دیگر»; paying the same combination
// twice is a nudge, never a mistake.
import {
  N, VALUES, DENOMS, totalOf, piecesOf, remaining, classifyPay, payMisconception,
  comboKey, waysToMake, greedyCombo, biggestUnitNeeded,
} from '../edu/money_rules.js';

export class PayCounterController {
  constructor(stage) {
    this.stage = stage;
    this.target = stage.target;
    this.supply = stage.supply.slice();                 // how many pieces of each denomination the tray holds
    this.counts = [0, 0, 0];                            // what is on the pay counter right now
    this.locked = [0, 0, 0];                            // pieces the assist / H3 put there and that must stay
    this.combos = [];                                   // the combinations already paid (comboKey strings)
    this.undoStack = [];
    this.state = 'pay';                                 // 'pay' → 'again' (one way paid) → 'solved'
    this.need = stage.combos_needed || 2;
  }

  // ------------------------------------------------------------------ reading the counter
  get total() { return totalOf(this.counts); }
  get pieces() { return piecesOf(this.counts); }
  get left() { return remaining(this.target, this.counts); }          // >0 short, <0 over
  get inTray() { return this.supply.map((s, i) => s - this.counts[i]); }
  get round() { return this.combos.length + 1; }                      // 1st or 2nd way of paying
  get canPay() { return this.state === 'pay' || this.state === 'again'; }

  /** A token of denomination `i` onto the pay counter → true when it moved. */
  add(i) {
    if (!this.canPay || i < 0 || i >= N) return false;
    if (this.inTray[i] <= 0) return false;
    this.undoStack.push(this.counts.slice());
    this.counts[i] += 1;
    return true;
  }

  /** Take one token of denomination `i` back off the counter (locked pieces stay). */
  remove(i) {
    if (!this.canPay || i < 0 || i >= N) return false;
    if (this.counts[i] <= this.locked[i]) return false;
    this.undoStack.push(this.counts.slice());
    this.counts[i] -= 1;
    return true;
  }

  // ------------------------------------------------------------------ paying
  /**
   * Hand the counter to the seller → {ok, rule, total, left, pieces, combo, repeat, state, solved}.
   *  rule      exact | under | over
   *  mistake   'size_trap' | 'count_trap' | null  (the card's MONEY-M02 / MONEY-M01)
   *  repeat    the price is right but this combination was already paid (a nudge towards mastery, not an error)
   */
  pay() {
    if (!this.canPay) return null;
    const rule = classifyPay(this.target, this.counts);
    const r = {
      ok: rule === 'exact', rule, total: this.total, left: this.left, pieces: this.pieces,
      mistake: payMisconception(this.target, this.counts), combo: comboKey(this.counts),
      repeat: false, state: this.state, solved: false,
    };
    if (!r.ok) return r;
    if (this.combos.includes(r.combo)) {                 // the same way twice: nudge, keep going
      r.repeat = true;
      return r;
    }
    this.combos.push(r.combo);
    this.undoStack = [];
    if (this.combos.length >= this.need) { this.state = 'solved'; r.solved = true; }
    else this.state = 'again';                           // one way down — now find a different one
    r.state = this.state;
    return r;
  }

  /** Clear the counter for the next attempt at the same price (the second combination), keeping locked pieces. */
  clear() {
    if (!this.canPay) return false;
    this.undoStack.push(this.counts.slice());
    this.counts = this.locked.slice();
    return true;
  }

  // ------------------------------------------------------------------ hints
  /** H2: which denomination to reach for next (the biggest piece the price still needs). */
  hintUnit() { return biggestUnitNeeded(this.target, this.counts, this.inTray); }

  /**
   * H3 (card §15: «یک ترکیب ممکن نمایش داده می‌شود ولی پاسخ کامل نه»): one possible combination is laid on the counter
   * — but mastery still needs a SECOND, different one, so the answer is not given away.
   * Returns {counts, from, locked} where `from` is what the child already had, or null when the tray cannot make it.
   */
  showExample() {
    if (!this.canPay) return null;
    const from = this.counts.slice();
    const want = greedyCombo(this.target, this.supply);
    if (!want) return null;
    this.undoStack.push(this.counts.slice());
    this.counts = want.slice();
    // deliberately NOT locked: mastery needs a second, different combination, so the child must be able to clear
    // the counter and build another one from scratch.
    return { counts: this.counts.slice(), from, locked: this.locked.slice() };
  }

  /**
   * Answer Assist (after 3 wrong payments): one piece of the biggest unit the price still needs is placed and locked,
   * and any piece that overshoots the price is taken back to the tray.
   */
  assist() {
    if (!this.canPay) return null;
    const from = this.counts.slice();
    const unit = biggestUnitNeeded(this.target, this.counts, this.inTray);
    if (unit >= 0) {
      this.undoStack.push(this.counts.slice());
      if (this.inTray[unit] > 0) this.counts[unit] += 1;
      this.locked[unit] = Math.max(this.locked[unit], Math.min(this.counts[unit], 1));
    }
    // nothing may sit on the counter once it is already over the price
    for (let i = 0; i < N; i++) {
      while (this.counts[i] > this.locked[i] && this.left < 0) this.counts[i] -= 1;
    }
    return { from, counts: this.counts.slice(), locked: this.locked.slice(), unit };
  }

  // ------------------------------------------------------------------ common
  undo() {
    if (!this.canPay) return null;
    const s = this.undoStack.pop();
    if (!s) return null;
    this.counts = s;
    return s;
  }

  /** Every combination the tray can still make (used by the tests and by the debug overlay). */
  solutions() { return waysToMake(this.target, this.supply); }

  snapshot() {
    return {
      state: this.state, target: this.target, counts: this.counts.join('-'), total: this.total,
      left: this.left, tray: this.inTray.join('-'), combos: this.combos.join(' '),
      locked: this.locked.join('-'),
    };
  }
}

export { DENOMS, VALUES, remaining, classifyPay, payMisconception, comboKey, waysToMake, greedyCombo };
