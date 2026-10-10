import { ITEMS, SLOT_FOR, evaluatePrepared } from '../edu/quran_reading_rules.js';

export class QuranReadingController {
  constructor(hooks = {}) {
    this.hooks = hooks; this.found = { book_stand: false, lamp: false };
    this.placed = { book_stand: false, lamp: false }; this.lampOn = false; this.curtainOpen = false;
    this.observed = { page: false, window: false }; this.solved = false; this.errors = 0; this.undoStack = [];
  }
  find(item) {
    if (this.solved || !ITEMS.includes(item) || this.found[item]) return false;
    this.found[item] = true; this.hooks.onFind?.(item); this.hooks.log?.('object_found', { item }); return true;
  }
  place(item, slot) {
    if (this.solved || !this.found[item] || this.placed[item] || SLOT_FOR[item] !== slot) {
      this.errors++; this.hooks.onWrongPlace?.(item, slot); this.hooks.log?.('arrangement_error', { item, slot, misconception: 'QUR_READING_IS_RUSHING' });
      return { ok: false, rule: 'WRONG_PLACE' };
    }
    this.undoStack.push({ type: 'place', item }); this.placed[item] = true; this.hooks.onPlace?.(item, slot);
    this.hooks.log?.('object_placed', { item, slot }); return { ok: true };
  }
  toggleLamp() {
    if (this.solved || !this.placed.lamp) return false;
    this.undoStack.push({ type: 'lamp', value: this.lampOn }); this.lampOn = !this.lampOn;
    this.observed.page = false; this.hooks.onLamp?.(this.lampOn); this.hooks.log?.('lamp_toggled', { on: this.lampOn }); return this.lampOn;
  }
  toggleCurtain() {
    if (this.solved) return false;
    this.undoStack.push({ type: 'curtain', value: this.curtainOpen }); this.curtainOpen = !this.curtainOpen;
    this.observed.window = false; this.hooks.onCurtain?.(this.curtainOpen); this.hooks.log?.('curtain_toggled', { open: this.curtainOpen }); return this.curtainOpen;
  }
  observe(target) {
    if (this.solved || !['page', 'window'].includes(target)) return false;
    if (target === 'page' && (!this.placed.book_stand || !this.lampOn)) return false;
    if (target === 'window' && !this.curtainOpen) return false;
    this.observed[target] = true; this.hooks.onObserve?.(target); this.hooks.log?.('light_observed', { target }); return true;
  }
  undo() {
    if (this.solved) return false; const a = this.undoStack.pop(); if (!a) return false;
    if (a.type === 'place') this.placed[a.item] = false;
    if (a.type === 'lamp') this.lampOn = a.value;
    if (a.type === 'curtain') this.curtainOpen = a.value;
    this.observed = { page: false, window: false }; this.hooks.onUndo?.(a); this.hooks.log?.('puzzle_interaction', { action: 'undo', type: a.type }); return true;
  }
  reset() {
    if (this.solved) return false;
    this.found = { book_stand: false, lamp: false }; this.placed = { book_stand: false, lamp: false };
    this.lampOn = false; this.curtainOpen = false; this.observed = { page: false, window: false }; this.undoStack = [];
    this.hooks.onReset?.(); this.hooks.log?.('puzzle_interaction', { action: 'reset' }); return true;
  }
  canConfirm() { return evaluatePrepared(this).ok; }
  confirm() {
    if (this.solved) return { ok: true, missing: [] };
    const verdict = evaluatePrepared(this);
    if (!verdict.ok) { this.errors++; this.hooks.onRefuse?.(verdict.missing); this.hooks.log?.('confirm_refused', { missing: verdict.missing }); return verdict; }
    this.solved = true; this.hooks.onSolved?.(); this.hooks.log?.('puzzle_solved', { misconception: 'QUR_READING_IS_RUSHING' }); return { ok: true, missing: [] };
  }
  assist() {
    if (this.solved) return null;
    const next = evaluatePrepared(this).missing[0] || null;
    return next ? { action: next, records_mastery: false } : null;
  }
}
