// LUMA — education engines: Misconception, Hint, Mastery, Analytics, Save (plan 06 §7–§9, §11; plan 10).
// Pure logic + a storage adapter so the same code runs in the browser (localStorage) and in Node tests (memory).
// Unity mirrors: Scripts/Education/{MisconceptionEngine,HintEngine,MasteryEngine}.cs, Scripts/Managers/AnalyticsQueue.cs

export class MemoryStorage {
  constructor() { this.m = {}; }
  getItem(k) { return k in this.m ? this.m[k] : null; }
  setItem(k, v) { this.m[k] = String(v); }
  removeItem(k) { delete this.m[k]; }
}

/** Flags a misconception when it is seen >= threshold times in the same puzzle (plan 06 §8). */
export class MisconceptionEngine {
  constructor(defs, threshold = 2) {
    this.defs = defs; this.threshold = threshold; this.counts = {}; this.flagged = new Set();
  }
  byRule(rule) { return this.defs.find((d) => d.rule === rule) || null; }
  /** Record a classified rule; returns {def, newlyFlagged}. */
  observe(rule) {
    const def = this.byRule(rule);
    if (!def) return { def: null, newlyFlagged: false };
    this.counts[def.code] = (this.counts[def.code] || 0) + 1;
    const newly = this.counts[def.code] >= this.threshold && !this.flagged.has(def.code);
    if (newly) this.flagged.add(def.code);
    return { def, newlyFlagged: newly };
  }
  reset() { this.counts = {}; this.flagged.clear(); }
}

/**
 * Hint ladder H1 → H2 → H3 (+ Answer Assist). The button is always visible (dim); it "pulses" when a trigger fires.
 * A flagged misconception targets its hint level directly (error-specific hints, plan 06 §7).
 */
export class HintEngine {
  constructor(hints, assist) {
    this.hints = hints; this.assist = assist; this.level = 0; this.wrong = 0; this.idle = 0;
    this.available = false; this.assistActive = false; this.maxUsed = 0;
  }
  onWrong() {
    this.wrong++; this.idle = 0;
    const h1 = this.hints.find((h) => h.level === 1);
    if (h1 && this.wrong >= h1.trigger_wrong) this.available = true;
    if (this.assist && this.wrong >= this.assist.after_wrong && !this.assistActive) { this.assistActive = true; return 'assist'; }
    return null;
  }
  onActivity() { this.idle = 0; }
  tick(dt) {
    this.idle += dt;
    const h1 = this.hints.find((h) => h.level === 1);
    if (h1 && h1.trigger_idle_s && this.idle >= h1.trigger_idle_s) this.available = true;
  }
  /** Misconception flagged: next hint jumps to its targeted level (never goes down). */
  target(level) { this.targetLevel = Math.max(this.targetLevel || 0, level); this.available = true; }
  /** Child pressed the hint button → returns the hint def to show. */
  request() {
    let next = Math.min(3, this.level + 1);
    if (this.targetLevel && this.targetLevel > this.level) next = this.targetLevel;
    this.level = next; this.maxUsed = Math.max(this.maxUsed, next); this.available = false; this.idle = 0;
    return this.hints.find((h) => h.level === next) || null;
  }
  reset() { this.level = 0; this.wrong = 0; this.idle = 0; this.available = false; this.assistActive = false; this.maxUsed = 0; this.targetLevel = 0; }
}

/** Mastery 0–5 per concept (plan 06 §9). Levels never go down. Assisted solves record nothing. */
export class MasteryEngine {
  constructor(store) { this.store = store; this.key = 'luma.mastery'; this.data = JSON.parse(store.getItem(this.key) || '{}'); }
  get(concept) { return this.data[concept] ? this.data[concept].level : 0; }
  /** evidence: {stage:'encounter'|'practice'|'transfer', solved, maxHint, assisted}; rules = puzzle.mastery. Returns new level or null. */
  record(concept, evidence, rules) {
    const cur = this.get(concept);
    let lvl = cur;
    if (evidence.assisted) return null;                                        // Answer Assist: no mastery (06 §7)
    if (evidence.stage === 'encounter') {
      lvl = Math.max(lvl, rules.encounter_seen);
      if (evidence.solved && evidence.maxHint >= 1 && evidence.maxHint <= 2) lvl = Math.max(lvl, rules.solved_with_h1_or_h2);
      if (evidence.solved && evidence.maxHint === 0) lvl = Math.max(lvl, rules.solved_with_h1_or_h2);
    }
    if (evidence.stage === 'practice' && evidence.solved && evidence.maxHint === 0) lvl = Math.max(lvl, rules.practice_solved_independently);
    // transfer in the same room (new objects/context; plan 06 §9 L4 Proficient) — only on top of an independent practice
    if (evidence.stage === 'transfer' && evidence.solved && evidence.maxHint === 0 && rules.transfer_solved_independently
        && lvl >= rules.practice_solved_independently) lvl = Math.max(lvl, rules.transfer_solved_independently);
    // MATH-03 card: «a new rule without H3» — the transfer counts with H1/H2, never with the H3 scaffold
    if (evidence.stage === 'transfer' && evidence.solved && evidence.maxHint <= 2 && rules.transfer_without_h3
        && lvl >= rules.practice_solved_independently) lvl = Math.max(lvl, rules.transfer_without_h3);
    if (lvl === cur) return null;
    this.data[concept] = { level: lvl, updated: new Date().toISOString() };
    this.store.setItem(this.key, JSON.stringify(this.data));
    return lvl;
  }
}

/** Offline analytics queue (plan 10): events are appended locally and flushed when a consent-approved sink exists. */
export class AnalyticsQueue {
  constructor(store, fields) { this.store = store; this.fields = fields; this.key = 'luma.analytics.queue'; }
  all() { return JSON.parse(this.store.getItem(this.key) || '[]'); }
  log(name, payload) {
    const e = { event: name, t: new Date().toISOString() };
    for (const f of this.fields) e[f] = payload[f] ?? null;
    Object.assign(e, payload);
    const q = this.all(); q.push(e); if (q.length > 2000) q.splice(0, q.length - 2000);
    this.store.setItem(this.key, JSON.stringify(q));
    return e;
  }
  clear() { this.store.removeItem(this.key); }
}

/** Save slot (plan 06 §11): world state + puzzle progress; auto-saved on puzzle enter / solve. */
export class SaveSlot {
  constructor(store, slot = 1) { this.store = store; this.key = `luma.save.slot${slot}`; this.data = JSON.parse(store.getItem(this.key) || '{"world":{},"puzzles":{}}'); }
  flag(name) { return !!this.data.world[name]; }
  setFlag(name, v = true) { this.data.world[name] = v; this.save(); }
  puzzle(id) { return this.data.puzzles[id] || null; }
  setPuzzle(id, state) { this.data.puzzles[id] = state; this.save(); }
  save() { this.data.saved = new Date().toISOString(); this.store.setItem(this.key, JSON.stringify(this.data)); }
  wipe() { this.data = { world: {}, puzzles: {} }; this.store.removeItem(this.key); }
}
