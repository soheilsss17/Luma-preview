// LUMA — SOCIAL-01 timeline controller (state + undo), no drawing. The scene calls it; hooks report back.
//   phase 'closed' (the album is still shut / the pot not yet looked at) → 'place' → 'checking' (marker walking) → 'done'
import { checkTimeline, dropCard, assistRow, answerOf } from '../edu/timeline_rules.js';

export class TimelineController {
  constructor(puzzle, stage, hooks = {}) {
    this.puzzle = puzzle; this.stage = stage; this.hooks = hooks;
    this.n = puzzle.slots || 5;
    this.row = new Array(this.n).fill(null);
    this.album = stage.album_order.slice();
    this.locked = []; this.phase = 'closed';
    this.undoStack = []; this.reorders = 0; this.placements = 0; this.checks = 0; this.errors = 0;
    this.lastPair = null; this.assist = false;
  }
  get solved() { return this.phase === 'done'; }
  get full() { return this.row.every((c) => c); }
  slotOf(id) { return this.row.indexOf(id); }

  open() {
    if (this.phase !== 'closed') return false;
    this.phase = 'place'; if (this.hooks.onOpen) this.hooks.onOpen();
    return true;
  }

  /** Drag ended: `id` from {kind:'album'} | {kind:'slot', i} onto slot `to` (null = outside / back to the album). */
  drop(id, from, to) {
    if (this.phase !== 'place') return 'busy';
    const res = dropCard(this.row, this.album, id, from, to, this.locked);
    if (!res.changed) { if (this.hooks.onReject) this.hooks.onReject(res.action, id, to); return res.action; }
    this.undoStack.push({ row: this.row, album: this.album });
    this.row = res.row; this.album = res.album;
    if (from.kind === 'slot') this.reorders++; else this.placements++;
    if (this.hooks.onDrop) this.hooks.onDrop(id, from, to, res.action);
    if (this.full && this.hooks.onFull) this.hooks.onFull();
    return res.action;
  }

  /** The time key: → checkTimeline result (the scene animates the marker, then calls finishCheck). */
  turnKey() {
    if (this.phase !== 'place') return null;
    const res = checkTimeline(this.puzzle, this.row);
    if (res.rule === 'incomplete') { if (this.hooks.onIncomplete) this.hooks.onIncomplete(res); return res; }
    this.checks++; this.phase = 'checking'; this.pending = res;
    if (this.hooks.onCheck) this.hooks.onCheck(res);
    return res;
  }
  /** The marker reached its stop (or the end). */
  finishCheck() {
    if (this.phase !== 'checking') return null;
    const res = this.pending; this.pending = null;
    if (res.ok) { this.phase = 'done'; this.undoStack = []; if (this.hooks.onSolved) this.hooks.onSolved(res); }
    else { this.phase = 'place'; this.errors++; this.lastPair = res.pair; if (this.hooks.onWrong) this.hooks.onWrong(res); }
    return res;
  }

  /** Answer Assist: first and last event lock at the ends. */
  enableAssist() {
    if (this.phase !== 'place' || this.assist) return false;
    const r = assistRow(this.puzzle, this.stage, this.row, this.album);
    this.row = r.row; this.album = r.album; this.locked = r.locked; this.assist = true; this.undoStack = [];
    return true;
  }

  undo() {
    if (this.phase !== 'place') return false;
    const a = this.undoStack.pop(); if (!a) return false;
    this.row = a.row; this.album = a.album;
    if (this.hooks.onUndo) this.hooks.onUndo();
    return true;
  }
  reset() {
    if (this.phase !== 'place') return false;
    const keep = this.locked.map((i) => [i, this.row[i]]);
    const fresh = new Array(this.n).fill(null); keep.forEach(([i, id]) => { fresh[i] = id; });
    if (fresh.join() === this.row.join()) return false;
    const kept = new Set(keep.map(([, id]) => id));
    this.row = fresh; this.album = this.stage.album_order.filter((id) => !kept.has(id)); this.undoStack = [];
    return true;
  }
  /** Reload after a solved stage: the answer on the rail. */
  finishAll() { this.row = answerOf(this.puzzle, this.stage); this.album = []; this.phase = 'done'; this.locked = []; }
}
