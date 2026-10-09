// LUMA — P-13 story board controller (state + undo), no drawing. phase 'topic' → 'compose' → 'done'.
import { evaluate, trayFor, assistTray } from '../edu/story_rules.js';

export class StoryBoardController {
  constructor(puzzle, stage, hooks = {}) {
    this.puzzle = puzzle; this.stage = stage; this.hooks = hooks;
    this.max = (puzzle.slots && puzzle.slots.sentences) || 5;
    this.topic = stage.fixed_topic || null;
    this.phase = this.topic ? 'compose' : 'topic';
    this.tray = this.topic ? trayFor(stage, this.topic) : [];
    this.seq = [];                                   // card ids on the board, slot 2.. top-down, no gaps
    this.assist = false; this.submits = 0; this.revisions = 0; this.undoStack = [];
  }
  get solved() { return this.phase === 'done'; }
  pending() { return this.tray.filter((id) => !this.seq.includes(id)); }

  chooseTopic(topic) {
    if (this.phase !== 'topic' || !this.stage.topics.some((t) => t.topic_id === topic)) return false;
    this.topic = topic; this.tray = trayFor(this.stage, topic); this.phase = 'compose';
    if (this.hooks.onTopic) this.hooks.onTopic(topic);
    return true;
  }
  /** Change the topic (only while the board has no sentences — the child can still rethink). */
  clearTopic() {
    if (this.phase !== 'compose' || this.stage.fixed_topic || this.seq.length) return false;
    this.topic = null; this.tray = []; this.phase = 'topic'; this.assist = false; return true;
  }

  /** Put card `id` into slot index `at` (0-based among sentence slots; clamped to the end, the others shift down). */
  place(id, at = this.seq.length) {
    if (this.phase !== 'compose' || !this.tray.includes(id) || this.seq.includes(id)) return 'busy';
    if (this.seq.length >= this.max) { if (this.hooks.onFull) this.hooks.onFull(id); return 'full'; }
    const i = Math.max(0, Math.min(this.seq.length, at));
    this.seq.splice(i, 0, id);
    this.undoStack.push({ kind: 'place', id });
    if (this.submits > 0) this.revisions++;
    if (this.hooks.onPlace) this.hooks.onPlace(id, i);
    return 'ok';
  }
  /** Take card `id` back to the tray (the ones below slide up). */
  remove(id) {
    const i = this.seq.indexOf(id);
    if (this.phase !== 'compose' || i < 0) return false;
    this.seq.splice(i, 1); this.undoStack.push({ kind: 'remove', id, at: i });
    if (this.submits > 0) this.revisions++;
    if (this.hooks.onRemove) this.hooks.onRemove(id, i);
    return true;
  }
  /** Reorder on the board. */
  move(id, to) {
    const i = this.seq.indexOf(id);
    if (this.phase !== 'compose' || i < 0) return false;
    const j = Math.max(0, Math.min(this.seq.length - 1, to));
    if (i === j) return false;
    const before = this.seq.slice();
    this.seq.splice(i, 1); this.seq.splice(j, 0, id);
    this.undoStack.push({ kind: 'move', before });
    if (this.submits > 0) this.revisions++;
    if (this.hooks.onMove) this.hooks.onMove(id, i, j);
    return true;
  }
  /** «ثبت»: the engraving stamp. → evaluate result. */
  submit() {
    if (this.phase !== 'compose' || !this.seq.length) return null;
    this.submits++;
    const r = evaluate(this.puzzle, this.topic, this.seq);
    if (r.ok) { this.phase = 'done'; if (this.hooks.onSolved) this.hooks.onSolved(r); }
    else if (this.hooks.onWrong) this.hooks.onWrong(r);
    return r;
  }
  /** Answer Assist: off-topic cards leave the board and the tray. */
  enableAssist() {
    if (this.phase !== 'compose') return false;
    this.assist = true;
    const keep = assistTray(this.puzzle, this.stage, this.topic);
    const gone = this.seq.filter((id) => !keep.includes(id));
    this.tray = keep; this.seq = this.seq.filter((id) => keep.includes(id)); this.undoStack = [];
    return gone;
  }
  undo() {
    const a = this.undoStack.pop();
    if (!a || this.phase !== 'compose') return false;
    if (a.kind === 'place') this.seq.splice(this.seq.indexOf(a.id), 1);
    else if (a.kind === 'remove') this.seq.splice(a.at, 0, a.id);
    else this.seq = a.before;
    return true;
  }
  reset() {
    if (this.phase !== 'compose' || !this.seq.length) return false;
    this.seq = []; this.undoStack = []; return true;
  }
  /** Reload after a solved stage: a canonical accepted text (main, all detail ideas once, closing). */
  finishAll(topic = this.topic || this.stage.topics[0].topic_id) {
    this.topic = topic; this.tray = trayFor(this.stage, topic);
    const cs = this.tray.map((id) => this.puzzle.cards.find((c) => c.card_id === id)).filter((c) => c.topic === topic);
    const ideas = new Set(), det = [];
    for (const c of cs) if (c.role === 'detail' && !ideas.has(c.idea)) { ideas.add(c.idea); det.push(c.card_id); }
    this.seq = [cs.find((c) => c.role === 'main').card_id, ...det, cs.find((c) => c.role === 'closing').card_id];
    this.phase = 'done';
  }
}
