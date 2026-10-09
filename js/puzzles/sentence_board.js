// LUMA — WRITING-01 sentence board controller (state + undo), no drawing. The scene calls it; hooks report back.
//   phase 'collect' (encounter only: picture cards gathered in the square) → 'match' → 'sequence' → 'done'
import { classifyMatch, assistRows, checkOrder, moveRow, assistOrder, plaqueFor } from '../edu/board_rules.js';

export class BoardController {
  constructor(stage, hooks = {}) {
    this.stage = stage; this.hooks = hooks;
    this.rows = stage.initial_rows.slice();          // card ids top → bottom
    this.joined = {};                                // card id → plaque id
    this.collected = new Set();
    this.phase = stage.collect ? 'collect' : 'match';
    this.assist = false; this.seqAssist = false; this.locked = false;
    this.undoStack = []; this.reorders = 0; this.submits = 0;
  }
  get solved() { return this.phase === 'done'; }
  pendingPlaques() { const used = new Set(Object.values(this.joined)); return this.stage.plaque_tray_order.filter((id) => !used.has(id)); }
  pendingCards() { return this.stage.cards.map((c) => c.card_id).filter((c) => !this.collected.has(c)); }

  collect(cardId) {
    if (this.phase !== 'collect' || this.collected.has(cardId)) return false;
    this.collected.add(cardId);
    if (this.hooks.onCollect) this.hooks.onCollect(cardId);
    if (this.collected.size === this.stage.cards.length) { this.phase = 'match'; if (this.hooks.onCollected) this.hooks.onCollected(); }
    return true;
  }

  /** Plaque dropped on row index `row` (null = dropped nowhere). → the rule string. */
  drop(plaqueId, row) {
    if (this.phase !== 'match') return 'busy';
    if (row === null || row < 0 || row >= this.rows.length) { if (this.hooks.onReject) this.hooks.onReject('outside', plaqueId, null); return 'outside'; }
    const cardId = this.rows[row];
    if (this.joined[cardId]) { if (this.hooks.onReject) this.hooks.onReject('occupied', plaqueId, cardId); return 'occupied'; }
    if (this.assist && !assistRows(this.stage, plaqueId).includes(cardId)) { if (this.hooks.onReject) this.hooks.onReject('assist_block', plaqueId, cardId); return 'assist_block'; }
    const { rule, word } = classifyMatch(this.stage, plaqueId, cardId);
    if (rule !== 'ok') { if (this.hooks.onWrong) this.hooks.onWrong(rule, plaqueId, cardId, word); return rule; }
    this.joined[cardId] = plaqueId;
    this.undoStack.push({ kind: 'join', cardId, plaqueId });
    if (this.hooks.onJoin) this.hooks.onJoin(plaqueId, cardId, row);
    if (Object.keys(this.joined).length === this.rows.length) { this.phase = 'sequence'; if (this.hooks.onJoinedAll) this.hooks.onJoinedAll(); }
    return 'ok';
  }

  /** Rail: the row at `from` slides to `to`. */
  move(from, to) {
    if (this.phase !== 'sequence' || this.locked || from === to) return false;
    if (this.seqAssist && (from === 0 || to === 0)) return false;            // the assisted intro row stays locked in slot 1
    const before = this.rows;
    this.rows = moveRow(this.rows, from, to);
    this.reorders++;
    this.undoStack.push({ kind: 'move', before });
    if (this.hooks.onMove) this.hooks.onMove(from, to, this.rows);
    return true;
  }

  /** The stamp: approve the current order. → checkOrder result. */
  submit() {
    if (this.phase !== 'sequence') return null;
    this.submits++;
    const res = checkOrder(this.stage, this.rows);
    if (res.ok) { this.phase = 'done'; this.locked = true; if (this.hooks.onSolved) this.hooks.onSolved(res); }
    else if (this.hooks.onOrderWrong) this.hooks.onOrderWrong(res);
    return res;
  }

  enableAssist() { this.assist = true; }
  /** Sequence assist: the introducing row slides to slot 1 and locks. */
  assistSequence() {
    if (this.phase !== 'sequence') return false;
    this.rows = assistOrder(this.stage, this.rows); this.seqAssist = true; this.undoStack = [];
    return true;
  }

  undo() {
    const a = this.undoStack.pop();
    if (!a || this.phase === 'done') return false;
    if (a.kind === 'join') { delete this.joined[a.cardId]; this.phase = 'match'; if (this.hooks.onUndo) this.hooks.onUndo(a); }
    else { this.rows = a.before; if (this.hooks.onUndo) this.hooks.onUndo(a); }
    return true;
  }
  reset() {
    if (this.phase === 'done' || this.phase === 'collect') return false;
    if (!Object.keys(this.joined).length && this.rows.join() === this.stage.initial_rows.join()) return false;
    this.joined = {}; this.rows = this.stage.initial_rows.slice(); this.phase = 'match'; this.undoStack = []; this.seqAssist = false;
    return true;
  }
  /** Reload after a solved stage: everything joined in the answer order. */
  finishAll() {
    for (const c of this.stage.cards) { this.collected.add(c.card_id); this.joined[c.card_id] = plaqueFor(this.stage, c.card_id).plaque_id; }
    this.rows = this.stage.answer_order.slice(); this.phase = 'done'; this.locked = true;
  }
}
