// LUMA — P-01 controller: place each sign (encounter) / route marker (practice) at the place its text describes.
// Rendering-agnostic state with an undo stack; mirror of unity/.../Puzzles/SignPlace/SignPlaceController.cs.
import { classifyPlacement, assistSpots, pending, solved, trapOf, signOf, WRONG } from '../edu/sign_rules.js';

export class SignPlaceController {
  /** hooks: {onPlace(signId, spotId), onWrong(rule, signId, spotId, trapWord), onReject(rule, signId, spotId), onUndo(signId, spotId), onSolved()} */
  constructor(stage, places, { guessMs = 1500 } = {}, hooks = {}) {
    Object.assign(this, { stage, places, guessMs, hooks });
    this.placed = {}; this.undoStack = []; this.solved = false; this.assist = false;
  }
  pending() { return pending(this.stage, this.placed); }
  signAt(spotId) { return this.placed[spotId] || null; }
  /** Places that accept `signId` right now (all free places; only two under Answer Assist). */
  activeSpots(signId) {
    const free = this.places.map((p) => p.spot_id).filter((id) => !this.placed[id]);
    return this.assist ? assistSpots(this.stage, this.places, this.placed, signId).filter((id) => free.includes(id)) : free;
  }

  /** The child plants `signId` on `spotId` (null = not on a place), readMs = time since the sign was picked up. */
  drop(signId, spotId, readMs = Infinity) {
    if (this.solved) return null;
    let rule = classifyPlacement(this.stage, this.places, this.placed, signId, spotId, readMs, this.guessMs);
    if (this.assist && rule !== 'ok' && WRONG.has(rule) && !this.activeSpots(signId).includes(spotId)) rule = 'assist_reject';
    if (rule === 'ok') {
      this.placed[spotId] = signId; this.undoStack.push(spotId);
      this.hooks.onPlace && this.hooks.onPlace(signId, spotId);
      if (solved(this.stage, this.placed)) { this.solved = true; this.hooks.onSolved && this.hooks.onSolved(); }
      return rule;
    }
    if (WRONG.has(rule)) {
      const t = trapOf(signOf(this.stage, signId), spotId);
      this.hooks.onWrong && this.hooks.onWrong(rule, signId, spotId, t ? t.word : null);
    } else this.hooks.onReject && this.hooks.onReject(rule, signId, spotId);
    return rule;
  }

  applyAssist() { this.assist = true; return this.pending().length; }

  /** Take the last planted sign back (not after the stage is solved). */
  undo() {
    if (this.solved || !this.undoStack.length) return null;
    const spot = this.undoStack.pop(), sign = this.placed[spot];
    delete this.placed[spot];
    this.hooks.onUndo && this.hooks.onUndo(sign, spot);
    return { sign, spot };
  }
  reset() {
    if (this.solved) return 0;
    const n = this.undoStack.length; this.placed = {}; this.undoStack = [];
    return n;
  }
  /** Restore a finished stage (reload after solving). */
  finishAll() {
    this.placed = {}; for (const s of this.stage.signs) this.placed[s.answer] = s.sign_id;
    this.undoStack = []; this.solved = true;
  }
}
