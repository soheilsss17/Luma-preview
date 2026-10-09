// LUMA — Room VIL_PLAZA / festival stall, card MATH-02 (Q01 #2, plan 12 §1 row 2): «شمردن با گام».
// Encounter = Number Trail: whole groups (baskets of 2, baskets of 5, crates of 10) or single apples go on the packing
// table; TIKO hops along the stepping stones by the size of what was placed, until he stands on the golden stone.
// Counting one by one is allowed (the heap) but slower, and every round ends with a comparative observation (card v1.1).
// Practice = Basket Snap: 12 apples into 4 baskets, equal groups (card v1.0) → skip count 3, 6, 9, 12 → VIL_STALL_READY.
import { drawHudButton, PRESS_S } from '../engine/hud.js';
import { faDigits } from '../engine/strings.js';
import { TrailController, BasketController } from '../puzzles/step_count.js';
import { idealHops, hops, stepNumbers, wobbleBaskets, skipSequence, exampleBasket, share } from '../edu/step_rules.js';
import { MisconceptionEngine, HintEngine, MasteryEngine, AnalyticsQueue, SaveSlot } from '../edu/engines.js';
import { Spring, Spring2, Timeline, reduceMotion } from '../engine/motion.js';
import { RigActor } from '../engine/rig.js';

export const W = 1920, H = 1080;
// ---- world layout (1920×1080 world units; the camera pushes in for the practice stage)
const TABLE = { cx: 940, bottom: 905, s: 0.85 };               // packing table (1024 base), bbox bottom = base 984
const TOP_LINE = [[215, 588], [835, 588]];                    // batch 06 front elevation: cloth top y 515 (back) … 640 (front edge), twine at x 130–190
const FRONT_LINE = [[205, 636], [880, 636]];                  // front strip of the top: single apples (right end free: NEO stands right)
const STALL = { cx: 1640, bottom: 790, s: 0.52 };
const COUNTER = { cx: 1590, bottom: 915, s: 0.32, panel: [543, 403] };
const HEAP = { cx: 1400, bottom: 965, s: 0.2 };
const SUPPLY = [[120, 815], [262, 815], [404, 815], [150, 945], [292, 945], [434, 945]];
const CONT_S = { basket: 0.14, crate: 0.15 };
const TRAIL = { x0: 150, x1: 1790, y: 1012 };
const MAT = { x: 250, b: 840, dx: 74, dy: 62, skew: 18, size: 54 };
const PRA_T = [0.1, 0.37, 0.63, 0.9], PRA_S = 0.16;
const CAM = [{ x: W / 2, y: H / 2, z: 1 }, { x: 900, y: 610, z: 1.2 }];
const BTN = { hint: { x: 90, y: 90 }, undo: { x: 220, y: 90 }, reset: { x: 350, y: 90 } };
const BTN_R = 58;
const EXIT = { x: 1832, y: 985, r: 95 };          // after MATH-02: the way on to the garden edge (MATH-05), same place as the plaza exit
const CONFETTI = ['#f2b233', '#c8483a', '#5fb8ad', '#f6ead0', '#e98a3c'];

const lerp = (a, b, t) => a + (b - a) * t;

export class StallMath02 {
  constructor({ sprites, puzzle, audio, storage, debug, strings, onExit }) {
    Object.assign(this, { sprites, puzzle, audio, debug, strings, onExit });
    this.save = new SaveSlot(storage);
    this.mastery = new MasteryEngine(storage);
    this.analytics = new AnalyticsQueue(storage, puzzle.analytics_fields);
    this.tl = new Timeline();
    this.t = 0; this.attempt = 0; this.drag = null; this.fx = []; this.confetti = [];
    this.cam = { x: new Spring(CAM[0].x, { stiffness: 8, damping: 6 }), y: new Spring(CAM[0].y, { stiffness: 8, damping: 6 }), z: new Spring(1, { stiffness: 8, damping: 6 }) };
    this.stallMix = new Spring(0, { stiffness: 6, damping: 5 });
    this.lumi = { p: new Spring2(1500, 600, { stiffness: 30, damping: 9 }), mode: 'follow' };
    this.anim = {};                 // per-object animation state: key → {pop, wobble, snap}
    this.hopQ = []; this.hop = null; this.shown = 0;
    this.ended = false; this.bubble = null;
  }

  async load() {
    this.neo = await new RigActor({ id: 'NEO', scale: 0.17, x: 1835, groundY: 1062, face: -1 }).load();
    this.tiko = await new RigActor({ id: 'TIKO', scale: 0.095, x: TRAIL.x0, groundY: TRAIL.y + 8, face: 1 }).load();
    this.actors = [this.tiko, this.neo];
    const enc = this.save.puzzle(this.puzzle.stages[0].puzzle_id), pra = this.save.puzzle(this.puzzle.stages[1].puzzle_id);
    if (pra && pra.solved) this.startStage(1, { finished: true });
    else if (enc && enc.solved) this.startStage(1);
    else this.startStage(0, { round: enc && enc.round ? enc.round : 0 });
    if (this.save.flag(this.puzzle.world_state_on_solve)) this.stallMix.set(1);
    this.snapCamera();
    return this;
  }

  // ================================================================= flow
  startStage(idx, { finished = false, round = 0 } = {}) {
    this.stageIdx = idx; this.stage = this.puzzle.stages[idx];
    this.misc = new MisconceptionEngine(this.puzzle.misconceptions, this.puzzle.misconception_flag_threshold);
    this.stageMaxHint = 0; this.stageAssisted = false; this.pendingHint = 0;
    this.stageStart = this.t; this.attempt++;
    this.fx = []; this.anim = {}; this.bubble = null; this.ghostSlots = false; this.example = -1; this.obs = null;
    const c = CAM[idx]; this.cam.x.target = c.x; this.cam.y.target = c.y; this.cam.z.target = c.z;
    if (idx === 0) return this.startRound(round);
    this.round = null; this.trail = null;
    this.hints = new HintEngine(this.stage.hints, this.stage.answer_assist);
    this.ctrl = new BasketController(this.stage, {
      onMove: (a, from, to) => this.onBasketMove(a, from, to),
      onWrong: (rule, counts) => this.onBasketWrong(rule, counts),
      onSolved: (counts) => this.onBasketsSolved(counts),
      onBounce: (a, b) => { this.anim['b' + b] = { ...(this.anim['b' + b] || {}), wobble: 0.5 }; this.audio.flicker(); },
    });
    this.tiko.x = 600; this.tiko.groundY = 1000; this.tiko.lift = 0; this.tiko.face = 1;
    this.neo.x = 1460; this.neo.groundY = 1045;
    this.hopQ = []; this.hop = null; this.shown = 0;
    if (finished) {
      this.ctrl.baskets = this.ctrl.baskets.map((_, b) => [...Array(this.stage.fruits).keys()].filter((a) => a % this.stage.baskets === b));
      this.ctrl.mat = []; this.ctrl.solved = true; this.ctrl.lastState = 'solved';
      this.ended = true; this.shown = this.stage.fruits; this.audio.setLayers(4);
      return;
    }
    this.ended = false;
    this.audio.setLayers(2);
    this.log('puzzle_start', {});
    this.recordMastery(false);
    this.save.setPuzzle(this.stage.puzzle_id, { solved: false, entered: new Date().toISOString() });
  }

  startRound(k) {
    this.roundIdx = k; this.round = this.stage.rounds[k];
    this.hints = new HintEngine(this.stage.hints, this.stage.answer_assist);
    if (this.pendingHint) this.hints.target(this.pendingHint);
    this.trail = new TrailController(this.round, {
      onPlace: (item, a, b) => this.onPlace(item, a, b),
      onRemove: (item, a, b) => this.onRemove(item, a, b),
      onWrong: (rule) => this.onTrailWrong(rule),
      onSolved: (rule) => this.onRoundSolved(rule),
    });
    this.ctrl = null; this.obs = null; this.stepNums = false; this.hintGroup = -1; this.hintArc = false;
    this.hopQ = []; this.hop = null; this.shown = 0;
    this.tiko.x = this.trailX(0); this.tiko.groundY = TRAIL.y + 8; this.tiko.lift = 0; this.tiko.face = 1; this.tiko.play('idle');
    this.neo.x = 1835; this.neo.groundY = 1062;
    this.ended = false;
    this.audio.setLayers(k);
    this.roundStart = this.t;
    if (k === 0) { this.log('puzzle_start', {}); this.recordMastery(false); }
    this.log('round_start', {});
    this.save.setPuzzle(this.stage.puzzle_id, { solved: false, round: k, entered: new Date().toISOString() });
  }

  recordMastery(solved) {
    const lvl = this.mastery.record(this.puzzle.concept_id,
      { stage: this.stage.stage, solved, maxHint: this.stageMaxHint, assisted: this.stageAssisted }, this.puzzle.mastery);
    if (lvl !== null) this.log('mastery_updated', { level: lvl });
  }

  log(name, extra) {
    const e = this.analytics.log(name, {
      puzzle_id: this.stage.puzzle_id, attempt_id: this.attempt, duration: Math.round((this.t - this.stageStart) * 10) / 10,
      round_id: this.round ? this.round.round_id : null, count: this.trail ? this.trail.count : null,
      hint_level: this.hints ? this.hints.maxUsed : 0, ...extra,
    });
    if (this.debug) this.debug.push(e);
  }

  observe(rule) {
    const { def, newlyFlagged } = this.misc.observe(rule);
    if (newlyFlagged) {
      this.log('misconception_flagged', { misconception: def.code, error_type: def.error_type });
      this.hints.target(def.targeted_hint); this.pendingHint = def.targeted_hint;
    }
    return def;
  }

  // ---------------------------------------------------------------- encounter events
  onPlace(item, from, to) {
    this.hints.onActivity();
    this.queueHop(from, to);
    if (item.size > 1) this.audio.woodClick(); else this.audio.thump();
    this.log('object_dropped', { group_size: item.size, count: to });
  }
  onRemove(item, from, to) { this.queueHop(from, to); this.audio.pickup(); this.log('object_removed', { group_size: item.size, count: to }); }
  onTrailWrong(rule) {
    const out = this.hints.onWrong();
    const def = this.observe(rule);
    this.log('wrong_state', { error_type: def ? def.error_type : 'CountError', misconception: def ? def.code : null });
    this.wobbleOnLand = true;
    if (out === 'assist') this.tl.after(1.2, () => this.assistTrail());
  }
  assistTrail() {
    if (!this.trail || this.trail.solved) return;
    const before = this.trail.count;
    const left = this.trail.applyAssist();
    this.stageAssisted = true;
    this.queueHop(before, this.trail.count);
    this.log('puzzle_interaction', { action: 'answer_assist', groups_left: left });
  }
  onRoundSolved(rule) {
    if (rule) this.observe(rule);
    const method = this.trail.method();
    this.stageMaxHint = Math.max(this.stageMaxHint, this.hints.maxUsed);
    this.log('round_solved', { counting_method: method, assisted: this.trail.assisted, moves: this.trail.placed.length });
    this.tl.after(this.hopTimeLeft() + 0.2, () => {
      this.audio.bell(); this.tiko.play('happy', 'idle'); this.neo.play('happy', 'idle');
      this.fx.push({ kind: 'burst', x: this.trailX(this.round.target), y: TRAIL.y - 30, t: 0 });
      this.tl.after(1.2, () => this.startObservation(method));
    });
  }
  startObservation(method) {             // comparative observation (card v1.1): the child's hops vs equal steps
    const ideal = idealHops(this.round);
    this.obs = { t: 0, method, mine: hops(this.trail.sizes), ideal, lit: 0 };
    this.log('observation_shown', { counting_method: method, moves: this.obs.mine.length, steps: ideal.length });
    this.tiko.x = this.trailX(0); this.shown = 0; this.hopQ = []; this.hop = null;
    ideal.forEach(([a, b], i) => this.tl.after(0.6 + i * 0.45, () => { this.obs.lit = i + 1; this.queueHop(a, b); }));
    this.tl.after(0.6 + ideal.length * 0.45 + 1.3, () => {
      if (this.roundIdx < this.stage.rounds.length - 1) this.transition(() => this.startRound(this.roundIdx + 1));
      else this.finishEncounter();
    });
  }
  finishEncounter() {
    this.log('puzzle_solved', { assisted: this.stageAssisted });
    this.recordMastery(true);
    this.save.setPuzzle(this.stage.puzzle_id, { solved: true, hint_max: this.stageMaxHint, assisted: this.stageAssisted });
    this.audio.motif(); this.audio.setLayers(3);
    this.transition(() => this.startStage(1));
  }

  // ---------------------------------------------------------------- practice events
  onBasketMove(a, from, to) {
    this.hints.onActivity();
    if (to !== 'mat') { this.audio.woodClick(); this.anim['b' + to] = { ...(this.anim['b' + to] || {}), pop: 0.3 }; }
    else this.audio.thump();
    this.log('object_dropped', { apple: a, from: String(from), to: String(to), counts: this.ctrl.counts().join('') });
  }
  onBasketWrong(rule, counts) {
    const out = this.hints.onWrong();
    const def = this.observe(rule);
    for (const b of wobbleBaskets(counts)) this.anim['b' + b] = { ...(this.anim['b' + b] || {}), wobble: 1.0 };
    this.audio.flicker();
    this.log('wrong_state', { counts: counts.join(''), error_type: def ? def.error_type : 'ConceptError', misconception: def ? def.code : null });
    if (out === 'assist') this.tl.after(1.1, () => {
      if (this.ctrl.solved) return;
      const cap = this.ctrl.applyAssist(); this.stageAssisted = true; this.ghostSlots = true;
      this.log('puzzle_interaction', { action: 'answer_assist', cap });
    });
  }
  onBasketsSolved(counts) {
    this.stageMaxHint = Math.max(this.stageMaxHint, this.hints.maxUsed);
    this.ghostSlots = false; this.example = -1;
    this.log('puzzle_solved', { assisted: this.stageAssisted, counts: counts.join('') });
    this.recordMastery(true);
    this.save.setPuzzle(this.stage.puzzle_id, { solved: true, hint_max: this.stageMaxHint, assisted: this.stageAssisted });
    const seq = skipSequence(counts);
    this.shown = 0;
    seq.forEach((v, i) => this.tl.after(0.5 + i * 0.6, () => {           // AN_GROUP_SUCCESS: basket by basket, 3 6 9 12
      this.anim['b' + i] = { ...(this.anim['b' + i] || {}), pop: 0.45 };
      this.fx.push({ kind: 'num', v, b: i, t: 0 }); this.shown = v; this.audio.tick(i * 3); this.audio.chime();
    }));
    this.tl.after(0.5 + seq.length * 0.6 + 0.4, () => {
      this.audio.bell(); this.audio.motif(); this.audio.setLayers(4);
      this.save.setFlag(this.puzzle.world_state_on_solve);             // VIL_STALL_READY → the stall is stocked
      this.stallMix.target = 1; this.spawnConfetti();
      this.neo.play('happy', 'idle'); this.tiko.play('happy', 'idle'); this.lumi.mode = 'celebrate';
      this.tl.after(3.2, () => { this.lumi.mode = 'follow'; this.ended = true; });
    });
    this.stageAssisted = false;
  }

  transition(fn) {
    this.fade = { a: 1 };
    this.tl.tween(0.5, (k) => { this.fade.a = 1 - k; }, () => { fn(); this.tl.tween(0.6, (k) => { this.fade.a = k; }, () => { this.fade = null; }); });
  }
  replay() {
    this.log('replay_started', {});
    for (const s of this.puzzle.stages) this.save.setPuzzle(s.puzzle_id, null);
    this.transition(() => this.startStage(0));
  }

  // ================================================================= trail hops
  trailX(n) { return lerp(TRAIL.x0, TRAIL.x1, n / this.round.trail_max); }
  queueHop(from, to) {
    if (from === to) return;
    this.hopQ.push({ from, to, t: 0, dur: Math.abs(to - from) === 1 ? 0.26 : 0.34 + 0.03 * Math.abs(to - from) });
  }
  hopTimeLeft() { return this.hopQ.reduce((s, h) => s + h.dur - h.t, this.hop ? this.hop.dur - this.hop.t : 0); }
  updateHops(dt) {
    if (!this.hop && this.hopQ.length) { this.hop = this.hopQ.shift(); this.tiko.face = Math.sign(this.hop.to - this.hop.from) || 1; }
    const h = this.hop;
    if (!h) return;
    h.t += reduceMotion ? h.dur : dt;
    const k = Math.min(1, h.t / h.dur);
    this.tiko.x = lerp(this.trailX(h.from), this.trailX(h.to), k);
    this.tiko.lift = Math.sin(Math.PI * k) * Math.min(150, 36 + 9 * Math.abs(h.to - h.from));
    if (k >= 1) {
      this.hop = null; this.tiko.lift = 0; this.shown = h.to;
      this.anim['m' + h.to] = { pop: 0.4 };                              // count_pulse on the landing stone
      this.audio.tick(Math.round(h.to / Math.max(1, this.round.step)));
      if (this.trail && !this.obs) this.log('count_step', { count: h.to, group_size: Math.abs(h.to - h.from) });
      if (this.wobbleOnLand && h.to > this.round.target) { this.anim.tiko = { wobble: 0.8 }; this.audio.flicker(); this.wobbleOnLand = false; }
    }
  }

  // ================================================================= geometry
  tablePt(line, t) {
    const [a, b] = line, bx = lerp(a[0], b[0], t), by = lerp(a[1], b[1], t);
    return { x: TABLE.cx + (bx - 512) * TABLE.s, y: TABLE.bottom + (by - 984) * TABLE.s };
  }
  supplyPos(i) { return { x: SUPPLY[i][0], y: SUPPLY[i][1] }; }
  tableItemPos(k) {                        // k-th placed item on the table
    const it = this.trail.placed[k];
    if (it.size > 1) { const g = this.trail.placed.slice(0, k).filter((p) => p.size > 1).length; return this.tablePt(TOP_LINE, 0.07 + g * 0.17); }
    const s = this.trail.placed.slice(0, k).filter((p) => p.size === 1).length, r = Math.floor(s / 10), c = s % 10;
    const p = this.tablePt(FRONT_LINE, 0.04 + c * 0.1);
    return { x: p.x, y: p.y - r * 24 };                  // the next row of ten lies straight behind (front view)
  }
  basketPos(b) { return this.tablePt(TOP_LINE, PRA_T[b]); }
  matPos(a) { const r = Math.floor(a / 4), c = a % 4; return { x: MAT.x + c * MAT.dx + r * MAT.skew, y: MAT.b + r * MAT.dy }; }
  slotWorld(kind, cx, bottom, s, i) {
    const C = this.sprites.m._containers, [bx, by] = C.slots[kind][i];
    return { x: cx + (bx - 512) * s, y: bottom + (by - 984) * s, size: C.apple_scale[kind] * 1024 * s };
  }
  openingCenter(cx, bottom, s) { return { x: cx + (520 - 512) * s, y: bottom + (470 - 984) * s }; }
  toWorld(x, y) { const z = this.cam.z.value; return [(x - W / 2) / z + this.cam.x.value, (y - H / 2) / z + this.cam.y.value]; }
  snapCamera() { this.cam.x.set(this.cam.x.target); this.cam.y.set(this.cam.y.target); this.cam.z.set(this.cam.z.target); }

  // ================================================================= input
  pointerDown(sx, sy) {
    this.audio.unlock();
    if (this.leaving) return;
    if (this.ended && this.onExit && Math.hypot(sx - EXIT.x, sy - EXIT.y) < EXIT.r) return this.leave();
    if (this.hints) this.hints.onActivity();
    for (const [name, b] of Object.entries(BTN)) if (Math.hypot(sx - b.x, sy - b.y) <= BTN_R) return this.button(name);
    if (this.fade || this.obs) return;
    const [x, y] = this.toWorld(sx, sy);
    this.down = { x, y, t: this.t };
    if (this.ended) {
      if (Math.abs(x - STALL.cx) < 260 && y > STALL.bottom - 520 && y < STALL.bottom + 20) { this.audio.motif(); this.spawnConfetti(60); return; }
    } else if (this.stageIdx === 0 && !this.trail.solved) {
      for (let i = 0; i < SUPPLY.length && i < this.round.groups; i++) {
        const p = this.supplyPos(i);
        if (this.trail.supply[i] && Math.abs(x - p.x) < 72 && y > p.y - 150 && y < p.y + 14) {
          this.drag = { kind: 'group', src: i, p: new Spring2(p.x, p.y, { stiffness: 260, damping: 22 }), moved: false };
          this.audio.pickup(); this.log('object_selected', { group_size: this.round.step });
          return;
        }
      }
      if (this.trail.heap && Math.abs(x - HEAP.cx) < 100 && y > HEAP.bottom - 190 && y < HEAP.bottom + 10) {
        this.drag = { kind: 'single', src: -1, p: new Spring2(x, y, { stiffness: 260, damping: 22 }), moved: false };
        this.audio.pickup(); this.log('object_selected', { group_size: 1 });
        return;
      }
      for (let k = this.trail.placed.length - 1; k >= 0; k--) {
        const p = this.tableItemPos(k), big = this.trail.placed[k].size > 1;
        if (Math.abs(x - p.x) < (big ? 70 : 30) && y > p.y - (big ? 140 : 50) && y < p.y + 10) {
          this.drag = { kind: 'table', index: k, item: this.trail.placed[k], p: new Spring2(p.x, p.y, { stiffness: 260, damping: 22 }), moved: false };
          this.audio.pickup();
          return;
        }
      }
    } else if (this.stageIdx === 1 && !this.ctrl.solved) {
      for (const a of this.ctrl.mat) {
        const p = this.matPos(a);
        if (Math.hypot(x - p.x, y - (p.y - MAT.size / 2)) < 42) {
          this.drag = { kind: 'apple', apple: a, from: 'mat', p: new Spring2(p.x, p.y, { stiffness: 260, damping: 22 }), moved: false };
          this.audio.pickup(); return;
        }
      }
      for (let b = 0; b < this.stage.baskets; b++) {
        const p = this.basketPos(b);
        if (this.ctrl.baskets[b].length && Math.abs(x - p.x) < 78 && y > p.y - 150 && y < p.y + 10) {
          const a = this.ctrl.topOf(b), s = this.slotWorld('basket', p.x, p.y, PRA_S, this.ctrl.baskets[b].length - 1);
          this.drag = { kind: 'apple', apple: a, from: b, p: new Spring2(s.x, s.y, { stiffness: 260, damping: 22 }), moved: false };
          this.audio.pickup(); return;
        }
      }
    }
    for (const a of this.actors) if (a.hit(x, y + (a.lift || 0))) { a.play('happy', 'idle'); return; }
  }
  pointerMove(sx, sy) {
    if (!this.drag) return;
    const [x, y] = this.toWorld(sx, sy);
    if (this.down && Math.hypot(x - this.down.x, y - this.down.y) > 14) this.drag.moved = true;
    if (this.drag.moved) this.drag.p.to(x, y - 20);             // the object floats just above the finger
  }
  pointerUp(sx, sy) {
    const d = this.drag; this.drag = null;
    if (!d) return;
    const [x, y] = this.toWorld(sx, sy);
    const px = d.moved ? d.p.x.value : x, py = d.moved ? d.p.y.value : y;
    if (!d.moved && this.t - this.down.t < 0.45) {                      // a tap, not a drag
      if (d.kind === 'group') return this.countGroup(d.src);
      if (d.kind === 'single' || (d.kind === 'apple' && d.from === 'mat')) return;
    }
    if (this.stageIdx === 0) {
      const onTable = px > 540 && px < 1350 && py > 240 && py < 720;
      if (d.kind === 'group' || d.kind === 'single') {
        if (onTable) this.trail.place(d.src);
        else this.fx.push({ kind: 'return', d, x: px, y: py, t: 0 });
      } else if (d.kind === 'table' && !onTable) {
        this.trail.remove(this.trail.placed.indexOf(d.item));
      }
    } else {
      let best = -1, bestD = 120;
      for (let b = 0; b < this.stage.baskets; b++) {
        const p = this.basketPos(b), o = this.openingCenter(p.x, p.y, PRA_S), dd = Math.hypot(px - o.x, py - MAT.size / 2 - o.y);
        if (dd < bestD) { bestD = dd; best = b; }
      }
      if (best >= 0) this.ctrl.move(d.apple, best);
      else if (d.from !== 'mat') this.ctrl.move(d.apple, 'mat');
    }
  }
  countGroup(i) {                          // "tap to count a group" (card v1.1): apples pulse one by one, the size shows
    const n = this.round.step;
    for (let k = 0; k < n; k++) this.tl.after(k * 0.13, () => { this.anim[`g${i}_${k}`] = { pop: 0.3 }; this.audio.tick(k); });
    this.tl.after(n * 0.13, () => this.fx.push({ kind: 'label', v: n, x: SUPPLY[i][0], y: SUPPLY[i][1] - 175, t: 0 }));
    this.log('group_counted', { group_size: n });
  }

  button(name) {
    this.pressT = { ...(this.pressT || {}), [name]: PRESS_S };
    const busy = this.fade || this.obs;
    if (name === 'hint') {
      if (busy || this.ended || this.solvedNow()) return;
      const h = this.hints.request();
      if (!h) return;
      this.audio.hint();
      this.log(`hint_${h.level}_used`, { hint_level: h.level });
      this.showHint(h);
    } else if (name === 'undo') {
      if (busy || this.ended) return;
      const a = this.stageIdx === 0 ? this.trail.undo() : this.ctrl.undo();
      if (a) { this.audio.snap(); this.log('puzzle_interaction', { action: 'undo' }); }
    } else if (name === 'reset') {
      if (this.ended) return this.replay();
      if (busy || this.solvedNow()) return;
      if (this.stageIdx === 0) { const c = this.trail.count; this.trail.reset(); this.queueHop(c, 0); }
      else this.ctrl.reset();
      this.audio.snap(); this.log('puzzle_interaction', { action: 'reset' });
    }
  }
  solvedNow() { return this.stageIdx === 0 ? this.trail.solved : this.ctrl.solved; }

  showHint(h) {
    this.stageMaxHint = Math.max(this.stageMaxHint, h.level);
    if (h.text_key && this.strings) { this.bubble = { text: this.strings.t(h.text_key), t: 0 }; this.tl.after(5.5, () => { this.bubble = null; }); }
    const back = (s) => this.tl.after(s, () => { if (this.lumi.mode === 'hint') this.lumi.mode = 'follow'; });
    if (this.stageIdx === 0) {
      const g = this.trail.supply.findIndex(Boolean);
      if (h.level === 1 && g >= 0) {                     // H1: LUMI circles one whole basket
        const p = this.supplyPos(g); this.hintGroup = g;
        this.lumi.mode = 'hint'; this.lumi.target = { x: p.x, y: p.y - 190 }; back(4.5);
        this.tl.after(4.5, () => { if (this.hintGroup === g && !this.hintArc) this.hintGroup = -1; });
      } else if (h.level === 2) {                        // H2: one full basket glows + one step drawn on the trail
        this.hintGroup = g; this.hintArc = true;
        const p = g >= 0 ? this.supplyPos(g) : { x: 700, y: 600 };
        this.lumi.mode = 'hint'; this.lumi.target = { x: p.x + 60, y: p.y - 200 }; back(3.5);
      } else if (h.level === 3) {                        // H3: step numbers appear on the ground
        this.stepNums = true;
        this.lumi.mode = 'hint'; this.lumi.target = { x: this.trailX(this.round.step), y: TRAIL.y - 150 }; back(3.5);
      }
    } else {
      const sh = share(this.stage.fruits, this.stage.baskets);
      if (h.level === 1) {                               // H1: LUMI flies over the baskets, comparing
        this.lumi.mode = 'tour'; this.lumi.tourT = 0; this.tl.after(4.5, () => { if (this.lumi.mode === 'tour') this.lumi.mode = 'follow'; });
      } else if (h.level === 2) {                        // H2: one basket of 3 as the example
        this.example = exampleBasket(this.ctrl.counts(), sh);
        const p = this.basketPos(this.example); this.lumi.mode = 'hint'; this.lumi.target = { x: p.x, y: p.y - 220 }; back(3.5);
      } else if (h.level === 3) {                        // H3: ghost slots show every basket's share
        this.ghostSlots = true;
        const p = this.basketPos(0); this.lumi.mode = 'hint'; this.lumi.target = { x: p.x + 120, y: p.y - 230 }; back(3);
      }
    }
  }

  spawnConfetti(n = 140) {
    if (reduceMotion) n = Math.round(n / 4);
    for (let i = 0; i < n; i++) {
      this.confetti.push({ x: 200 + Math.random() * 1500, y: -40 - Math.random() * 500, vy: 90 + Math.random() * 90,
        ph: Math.random() * 6.28, sw: 20 + Math.random() * 40, r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 5,
        c: CONFETTI[i % CONFETTI.length], w: 10 + Math.random() * 8, h: 6 + Math.random() * 6 });
    }
  }

  // ================================================================= update
  update(dt) {
    if (this.pressT) for (const k in this.pressT) this.pressT[k] = Math.max(0, this.pressT[k] - dt);
    this.t += dt;
    this.tl.update(dt);
    if (this.hints && !this.ended && !this.obs) this.hints.tick(dt);
    for (const s of [this.cam.x, this.cam.y, this.cam.z, this.stallMix]) s.update(dt);
    if (reduceMotion) this.snapCamera();
    if (this.drag) this.drag.p.update(dt);
    if (this.stageIdx === 0) this.updateHops(dt);
    if (this.obs) this.obs.t += dt;
    if (this.bubble) this.bubble.t += dt;
    for (const k in this.anim) {
      const a = this.anim[k];
      if (a.pop > 0) a.pop -= dt;
      if (a.wobble > 0) a.wobble -= dt;
    }
    for (const f of this.fx) f.t += dt;
    this.fx = this.fx.filter((f) => f.t < (f.kind === 'return' ? 0.4 : f.kind === 'num' ? 6 : 1.3));
    for (const c of this.confetti) { c.y += c.vy * dt; c.ph += dt * 2; c.r += c.vr * dt; }
    this.confetti = this.confetti.filter((c) => c.y < H + 40);
    for (const a of this.actors) a.update(dt);
    if (this.stageIdx === 1 && this.tiko.clip === 'idle') this.tiko.faceTowards(this.neo.x);
    const lm = this.lumi;
    if (lm.mode === 'follow') {                                  // stage 1: above NEO so the counter board stays readable
      const h = this.neo.headPoint(), ox = this.stageIdx === 1 ? 0 : 90, oy = this.stageIdx === 1 ? -150 : -30;
      lm.p.to(h.x + ox, h.y + oy + Math.sin(this.t * 2.1) * 12);
    }
    else if (lm.mode === 'hint') lm.p.to(lm.target.x + Math.cos(this.t * 3) * 46, lm.target.y + Math.sin(this.t * 3) * 20);
    else if (lm.mode === 'tour') {
      lm.tourT += dt; const b = Math.min(3, Math.floor(lm.tourT / 1.1)), p = this.basketPos(b);
      lm.p.to(p.x, p.y - 200 + Math.sin(this.t * 4) * 12); lm.tourB = b;
    } else if (lm.mode === 'celebrate') lm.p.to(1200 + Math.cos(this.t * 1.6) * 420, 330 + Math.sin(this.t * 3.2) * 60);
    if (reduceMotion && lm.mode !== 'celebrate') lm.p.set(lm.p.x.target, lm.p.y.target);
    lm.p.update(dt);
  }

  // ================================================================= draw
  drawB(name, cx, bottom, s, alpha = 1) {        // sprite authored on a 1024 canvas, bbox bottom at base y 984
    const img = this.sprites.get(name);
    if (!img) return;
    if (alpha < 1) ctx_alpha(this._ctx, alpha);
    this._ctx.drawImage(img, cx - 512 * s, bottom - 984 * s, 1024 * s, 1024 * s);
    if (alpha < 1) ctx_alpha(this._ctx, 1);
  }
  drawApple(colour, x, yb, size, pop = 0) {
    const img = this.sprites.get(colour === 'G' ? 'apple_green' : 'apple_red', 'apple_red');
    const k = 1 + Math.max(0, Math.sin(pop / 0.3 * Math.PI)) * 0.18;
    const sz = size * k;
    this._ctx.drawImage(img, x - sz / 2, yb - sz * 984 / 1024, sz, sz);
  }
  /** Container (basket / open crate) with n apples between its back and front layers; rot = wobble angle (rad). */
  drawContainer(kind, cx, bottom, s, apples, { rot = 0, key = null, hl = 0, ghosts = 0, ghostApples = 0, alpha = 1 } = {}) {
    const ctx = this._ctx;
    ctx.save();
    if (alpha < 1) ctx.globalAlpha = alpha;
    ctx.translate(cx, bottom); ctx.rotate(rot); ctx.translate(-cx, -bottom);
    ctx.fillStyle = 'rgba(40,25,10,0.22)';
    ctx.beginPath(); ctx.ellipse(cx, bottom - 6, 420 * s, 60 * s, 0, 0, Math.PI * 2); ctx.fill();
    if (hl > 0) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const o = this.openingCenter(cx, bottom, s), g = ctx.createRadialGradient(o.x, o.y + 60 * s, 10, o.x, o.y + 60 * s, 620 * s);
      g.addColorStop(0, `rgba(255,226,150,${0.55 * hl})`); g.addColorStop(1, 'rgba(255,226,150,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(o.x, o.y + 60 * s, 620 * s, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    this.drawB(kind === 'crate' ? 'crate_open' : 'basket', cx, bottom, s);
    const slots = this.sprites.m._containers.slots[kind];
    const order = [...slots.keys()].sort((i, j) => slots[i][1] - slots[j][1]);
    for (const i of order) {
      const p = this.slotWorld(kind, cx, bottom, s, i);
      if (i < apples.length) {
        const pop = key && this.anim[`${key}_${i}`] ? this.anim[`${key}_${i}`].pop : 0;
        this.drawApple(apples[i], p.x, p.y, p.size, pop);
      } else if (i < ghostApples) {
        ctx.save(); ctx.globalAlpha *= 0.4 + 0.15 * Math.sin(this.t * 4); this.drawApple('R', p.x, p.y, p.size); ctx.restore();
      }
    }
    this.drawB(kind === 'crate' ? 'crate_front' : 'basket_front', cx, bottom, s);
    // H3 ghost slots go over the front rim, otherwise the rim hides back-row slots
    for (const i of order) {
      if (i < apples.length || i < ghostApples || i >= ghosts) continue;
      const p = this.slotWorld(kind, cx, bottom, s, i), r = p.size * 0.42, a = 0.65 + 0.25 * Math.sin(this.t * 3 + i);
      ctx.save(); ctx.fillStyle = `rgba(255,250,230,${0.55 * a})`; ctx.strokeStyle = `rgba(120,70,20,${a})`;
      ctx.lineWidth = 3.5; ctx.setLineDash([8, 7]);
      ctx.beginPath(); ctx.ellipse(p.x, p.y - r, r, r * 0.95, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore();
    }
    ctx.restore();
  }
  groupApples(k) { const c = this.round.colours, n = this.round.step; return Array.from({ length: n }, (_, i) => c[i % c.length]); }

  draw(ctx) {
    this._ctx = ctx;
    const z = this.cam.z.value;
    ctx.save();
    ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.translate(-this.cam.x.value, -this.cam.y.value);
    // world: background (zoomed plaza, lanterns lit, soft depth of field) + a warm focus veil
    ctx.drawImage(this.sprites.get('stall_bg', 'plaza_restored'), -200, -120, W + 400, H + 240);
    const veil = this.ended ? 0.05 : 0.16;
    ctx.fillStyle = `rgba(30,20,10,${veil})`; ctx.fillRect(-200, -120, W + 400, H + 240);
    const rowAlpha = this.fade ? this.fade.a : 1;
    // stall (crossfades to the stocked state on VIL_STALL_READY)
    const mix = Math.max(0, Math.min(1, this.stallMix.value));
    this.drawB('stall', STALL.cx, STALL.bottom, STALL.s);
    if (mix > 0.001) this.drawB('stall_stocked', STALL.cx, STALL.bottom, STALL.s, mix);
    // fruit counter (abacus sign): engine-drawn Persian numeral on its blank panel
    this.drawB('fruit_counter', COUNTER.cx, COUNTER.bottom, COUNTER.s);
    const pc = { x: COUNTER.cx + (COUNTER.panel[0] - 512) * COUNTER.s, y: COUNTER.bottom + (COUNTER.panel[1] - 984) * COUNTER.s };
    const shown = this.stageIdx === 0 ? this.shown : this.shown;
    ctx.save(); ctx.font = '800 92px LumaFa, Vazirmatn, Tahoma, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#4a3418'; ctx.fillText(faDigits(shown), pc.x, pc.y + 6); ctx.restore();
    // packing table
    this.drawB('packing_table', TABLE.cx, TABLE.bottom, TABLE.s);
    ctx.globalAlpha = rowAlpha;
    if (this.stageIdx === 0) this.drawEncounter(ctx); else this.drawPractice(ctx);
    ctx.globalAlpha = 1;
    // characters (TIKO wobbles when he overshoots the golden stone)
    const tw = this.anim.tiko && this.anim.tiko.wobble > 0 ? Math.sin(this.anim.tiko.wobble * 30) * 6 : 0;
    this.tiko.x += tw; for (const a of [...this.actors].sort((p, q) => p.groundY - q.groundY)) a.draw(ctx); this.tiko.x -= tw;
    this.drawDragged(ctx);
    for (const f of this.fx) this.drawFx(ctx, f);
    this.drawLumi(ctx);
    ctx.restore();
    // screen space
    for (const c of this.confetti) {
      ctx.save(); ctx.translate(c.x + Math.sin(c.ph) * c.sw, c.y); ctx.rotate(c.r); ctx.fillStyle = c.c;
      ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h * Math.abs(Math.cos(c.ph))); ctx.restore();
    }
    if (this.ended && this.onExit) this.drawExit(ctx);
    this.drawHud(ctx);
    if (this.leaving) { ctx.fillStyle = `rgba(20,12,6,${this.leaving.a})`; ctx.fillRect(0, 0, W, H); }
  }

  // wordless way on: the same warm glow + chevrons as the plaza exit, towards the garden edge (plan 12, MATH-05)
  leave() {
    this.leaving = { a: 0 }; this.audio.pickup();
    this.log('room_exit', { to: 'VIL_GARDEN_EDGE' });
    this.tl.tween(0.8, (k) => { this.leaving.a = k; }, () => this.onExit());
  }
  drawExit(ctx) {
    const k = 0.5 + 0.5 * Math.sin(this.t * 2.4), { x, y, r } = EXIT;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y, 8, x, y, r * 1.6);
    g.addColorStop(0, `rgba(255,200,100,${0.6 + 0.3 * k})`); g.addColorStop(1, 'rgba(255,214,130,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 1.6, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let i = 0; i < 3; i++) {
      const a = Math.max(0, Math.sin(this.t * 3 - i * 0.9)), cx = x - 34 + i * 30 + (reduceMotion ? 0 : 6 * k);
      const path = () => { ctx.beginPath(); ctx.moveTo(cx - 14, y - 30); ctx.lineTo(cx + 14, y); ctx.lineTo(cx - 14, y + 30); };
      ctx.lineWidth = 18; ctx.strokeStyle = `rgba(70,40,15,${0.35 + 0.35 * a})`; path(); ctx.stroke();
      ctx.lineWidth = 10; ctx.strokeStyle = `rgba(255,236,180,${0.55 + 0.45 * a})`; path(); ctx.stroke();
    }
    ctx.restore();
  }

  drawEncounter(ctx) {
    const r = this.round, T = this.trail;
    this.drawTrail(ctx);
    // single-apple heap (closed by the Answer Assist)
    if (T.heap) this.drawB('fruit_heap', HEAP.cx, HEAP.bottom, HEAP.s);
    // supply on the ground
    for (let i = 0; i < r.groups && i < SUPPLY.length; i++) {
      if (!T.supply[i] || (this.drag && this.drag.kind === 'group' && this.drag.src === i)) continue;
      const p = this.supplyPos(i), hl = this.hintGroup === i ? 0.6 + 0.4 * Math.sin(this.t * 5) : 0;
      this.drawContainer(r.container, p.x, p.y, CONT_S[r.container], this.groupApples(), { key: 'g' + i, hl });
    }
    // placed items on the table (far → near)
    const items = T.placed.map((it, k) => ({ it, k, p: this.tableItemPos(k) })).sort((a, b) => a.p.y - b.p.y);
    for (const { it, k, p } of items) {
      if (this.drag && this.drag.kind === 'table' && this.drag.item === it) continue;
      const last = k === T.placed.length - 1, over = T.state() === 'overshoot' && last;
      const rot = over ? Math.sin(this.t * 9) * 0.05 : 0;
      if (it.size > 1) this.drawContainer(r.container, p.x, p.y, CONT_S[r.container], this.groupApples(), { rot });
      else this.drawApple(r.colours[0] === 'G' ? 'G' : 'R', p.x + rot * 200, p.y, 46);
    }
  }

  drawTrail(ctx) {
    const r = this.round, n = r.trail_max, sp = (TRAIL.x1 - TRAIL.x0) / n, w = Math.min(78, sp * 0.92), h = w * 0.46;
    const img = this.sprites.get('count_marker');
    const nums = this.stepNums ? new Set(stepNumbers(r)) : new Set();
    for (let i = 0; i <= n; i++) {
      const x = this.trailX(i), a = this.anim['m' + i], pop = a && a.pop > 0 ? Math.sin(a.pop / 0.4 * Math.PI) * 0.25 : 0;
      const tgt = i === r.target, big = tgt ? 1.35 : 1, ww = w * big * (1 + pop), hh = h * big * (1 + pop);
      ctx.globalAlpha = i > r.target ? 0.55 : 1;
      ctx.fillStyle = 'rgba(40,25,10,0.25)'; ctx.beginPath(); ctx.ellipse(x, TRAIL.y + hh * 0.3, ww * 0.5, hh * 0.42, 0, 0, Math.PI * 2); ctx.fill();
      if (img) ctx.drawImage(img, x - ww / 2, TRAIL.y - hh / 2, ww, hh);
      if (i <= this.shown && i > 0 && !(this.trail.state() === 'overshoot' && i > r.target)) {
        ctx.fillStyle = 'rgba(255,205,110,0.35)'; ctx.beginPath(); ctx.ellipse(x, TRAIL.y, ww * 0.38, hh * 0.34, 0, 0, Math.PI * 2); ctx.fill();
      }
      if (i > r.target && i <= this.shown) {                          // overshoot: the stones past the target turn amber
        ctx.fillStyle = 'rgba(230,120,60,0.45)'; ctx.beginPath(); ctx.ellipse(x, TRAIL.y, ww * 0.4, hh * 0.36, 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (tgt) {                                                      // the golden stone: glow + the target number
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(x, TRAIL.y, 4, x, TRAIL.y, ww * 1.1);
        g.addColorStop(0, `rgba(255,210,110,${0.5 + 0.12 * Math.sin(this.t * 3)})`); g.addColorStop(1, 'rgba(255,210,110,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, TRAIL.y, ww * 1.1, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }
      if (i === 0 || tgt || nums.has(i) || (this.obs && this.obs.ideal.slice(0, this.obs.lit).some(([, b]) => b === i))) {
        ctx.save(); ctx.font = `800 ${Math.round(Math.min(40, Math.max(22, hh * 0.9)))}px LumaFa, Vazirmatn, Tahoma, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = tgt ? '#6b3a0c' : '#4a3418';
        ctx.fillText(faDigits(i), x, TRAIL.y + 2); ctx.restore();
      }
    }
    // H2: one step drawn as a dotted arc from the current count
    if (this.hintArc && !this.trail.solved) {                       // from the current count if the step still fits, else from 0
      const a0 = this.trail.count + r.step <= r.target ? this.trail.count : 0;
      this.drawArc(ctx, a0, a0 + r.step, 'rgba(255,236,170,0.9)', true, 1);
    }
    // comparative observation: the child's hops (pale) under the equal steps (gold, drawn one by one)
    if (this.obs) {
      const o = this.obs, k = Math.min(1, o.t / 0.5);
      if (o.method !== 'groups') for (const [a, b] of o.mine) this.drawArc(ctx, a, b, `rgba(255,250,235,${0.75 * k})`, false, 0.55);
      o.ideal.slice(0, o.lit).forEach(([a, b]) => this.drawArc(ctx, a, b, 'rgba(255,196,80,0.95)', false, 1.25));
    }
  }
  drawArc(ctx, a, b, col, dashed, hk) {
    const x0 = this.trailX(a), x1 = this.trailX(b), hgt = Math.min(170, 30 + 10 * Math.abs(b - a)) * hk, y = TRAIL.y - 24;
    ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = hk > 1 ? 7 : 4; if (dashed) ctx.setLineDash([12, 10]);
    ctx.shadowColor = 'rgba(255,200,110,0.6)'; ctx.shadowBlur = hk > 1 ? 12 : 0;
    ctx.beginPath(); ctx.moveTo(x0, y); ctx.quadraticCurveTo((x0 + x1) / 2, y - hgt * 2, x1, y); ctx.stroke(); ctx.restore();
  }

  drawPractice(ctx) {
    const C = this.ctrl, sh = share(this.stage.fruits, this.stage.baskets);
    // cloth mat with the loose apples
    ctx.fillStyle = 'rgba(214,160,72,0.92)'; ctx.strokeStyle = 'rgba(160,60,40,0.9)'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.roundRect(MAT.x - 60, MAT.b - 80, 4 * MAT.dx + 2 * MAT.skew + 70, 3 * MAT.dy + 60, 26); ctx.fill(); ctx.stroke();
    for (const a of [...C.mat].sort((p, q) => this.matPos(p).y - this.matPos(q).y)) {
      if (this.drag && this.drag.apple === a) continue;
      const p = this.matPos(a); this.drawApple(a % 3 === 2 ? 'G' : 'R', p.x, p.y, MAT.size);
    }
    // baskets on the table, far → near
    for (const b of [3, 2, 1, 0]) {
      const p = this.basketPos(b), an = this.anim['b' + b] || {};
      const rot = an.wobble > 0 ? Math.sin(an.wobble * 22) * 0.07 * an.wobble : 0;
      const pop = an.pop > 0 ? Math.sin(an.pop / 0.45 * Math.PI) * 14 : 0;
      const list = C.baskets[b].filter((a) => !(this.drag && this.drag.apple === a)).map((a) => (a % 3 === 2 ? 'G' : 'R'));
      const tour = this.lumi.mode === 'tour' && this.lumi.tourB === b;
      const hl = tour ? 0.8 : this.example === b ? 0.55 + 0.3 * Math.sin(this.t * 4) : 0;
      const ghostApples = this.example === b && list.length < sh ? sh : 0;
      this.drawContainer('basket', p.x, p.y - pop, PRA_S, list, { rot, hl, ghosts: this.ghostSlots ? sh : 0, ghostApples });
    }
  }

  drawDragged(ctx) {
    const d = this.drag;
    if (!d) return;
    const x = d.p.x.value, y = d.p.y.value;
    ctx.fillStyle = 'rgba(40,25,10,0.18)'; ctx.beginPath(); ctx.ellipse(x, y + 60, 60, 12, 0, 0, Math.PI * 2); ctx.fill();
    if (d.kind === 'group' || (d.kind === 'table' && d.item.size > 1)) {
      const r = this.round; this.drawContainer(r.container, x, y, CONT_S[r.container] * 1.06, this.groupApples(), { hl: 0.35 });
    } else if (d.kind === 'single' || d.kind === 'table') this.drawApple('R', x, y, 44);
    else if (d.kind === 'apple') this.drawApple(d.apple % 3 === 2 ? 'G' : 'R', x, y, MAT.size * 1.08);
  }

  drawFx(ctx, f) {
    if (f.kind === 'return') {                  // a dropped-outside item floats back to where it came from
      const k = f.t / 0.4, d = f.d, home = d.kind === 'group' ? this.supplyPos(d.src) : { x: HEAP.cx, y: HEAP.bottom - 120 };
      ctx.globalAlpha = 1 - k * 0.6;
      if (d.kind === 'group') this.drawContainer(this.round.container, lerp(f.x, home.x, k), lerp(f.y, home.y, k), CONT_S[this.round.container], this.groupApples());
      else this.drawApple('R', lerp(f.x, home.x, k), lerp(f.y, home.y, k), 40);
      ctx.globalAlpha = 1;
    } else if (f.kind === 'label' || f.kind === 'num') {
      const p = f.kind === 'num' ? (() => { const q = this.basketPos(f.b); return { x: q.x, y: q.y + 62 }; })() /* front strip, clear of the HUD */ : { x: f.x, y: f.y };
      const k = Math.min(1, f.t / 0.35), rise = 30 * k, fade = f.kind === 'num' ? 1 : Math.max(0, 1 - Math.max(0, f.t - 0.9) / 0.4);
      ctx.save(); ctx.globalAlpha = fade;
      ctx.fillStyle = 'rgba(250,240,215,0.95)'; ctx.strokeStyle = 'rgba(150,110,50,0.8)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(p.x, p.y - rise, 38 * (0.6 + 0.4 * k), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.font = '800 44px LumaFa, Vazirmatn, Tahoma, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#4a3418';
      ctx.fillText(faDigits(f.v), p.x, p.y - rise + 3); ctx.restore();
    } else if (f.kind === 'burst') {
      const k = f.t / 1.3, r = 40 + 200 * k;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r);
      g.addColorStop(0, `rgba(255,210,120,${0.6 * (1 - k)})`); g.addColorStop(1, 'rgba(255,210,120,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
  }

  drawLumi(ctx) {
    const lm = this.lumi, x = lm.p.x.value, y = lm.p.y.value;
    const pulse = 1 + 0.06 * Math.sin(this.t * 5) + (lm.mode === 'celebrate' ? 0.1 * Math.sin(this.t * 14) : 0);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y, 4, x, y, 90 * pulse);
    g.addColorStop(0, 'rgba(255,230,170,0.55)'); g.addColorStop(1, 'rgba(255,200,120,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 90 * pulse, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    const img = this.sprites.get('lumi_front'), s = 0.42 * pulse;
    if (img) ctx.drawImage(img, x - 128 * s, y - 128 * s, 256 * s, 256 * s);
  }

  drawHud(ctx) {
    const S = this.sprites;
    const text = this.stage.objective_fa;
    ctx.save();
    ctx.font = '700 38px LumaFa, Vazirmatn, Tahoma, sans-serif'; ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = ctx.measureText(text).width + 90;
    ctx.fillStyle = 'rgba(250,240,215,0.93)'; ctx.strokeStyle = 'rgba(150,110,50,0.8)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(W / 2 - w / 2, 34, w, 74, 20); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#4a3418'; ctx.fillText(text, W / 2, 73);
    if (this.bubble) {                                   // H1 line from the card, on a paper strip under LUMI's light
      const a = Math.min(1, this.bubble.t / 0.3); ctx.globalAlpha = a;
      ctx.font = '700 34px LumaFa, Vazirmatn, Tahoma, sans-serif';
      const bw = ctx.measureText(this.bubble.text).width + 80;
      ctx.fillStyle = 'rgba(255,248,226,0.96)'; ctx.strokeStyle = 'rgba(214,170,80,0.95)';
      ctx.beginPath(); ctx.roundRect(W / 2 - bw / 2, 160, bw, 66, 33); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#5a3e14'; ctx.fillText(this.bubble.text, W / 2, 194); ctx.globalAlpha = 1;
    }
    ctx.restore();
    const pr = this.pressT || {}, done = this.solvedNow() || !!this.obs;
    const undoable = this.stageIdx === 0 ? this.trail.undoStack.length : this.ctrl.undoStack.length;
    drawHudButton(ctx, S, 'btn_hint', BTN.hint, BTN_R, { disabled: done || this.ended, available: this.hints.available, pressed: pr.hint, t: this.t });
    drawHudButton(ctx, S, 'btn_undo', BTN.undo, BTN_R, { disabled: done || this.ended || !undoable, pressed: pr.undo, t: this.t });
    drawHudButton(ctx, S, 'btn_reset', BTN.reset, BTN_R, { disabled: done && !this.ended, available: this.ended, pressed: pr.reset, t: this.t });
    // wordless progress: three trail rounds (small) · baskets (large)
    const nR = this.puzzle.stages[0].rounds.length;
    for (let k = 0; k <= nR; k++) {
      const doneK = this.stageIdx === 1 ? (k < nR || this.ctrl.solved) : k < this.roundIdx || (k === this.roundIdx && this.trail.solved);
      const cur = this.stageIdx === 0 ? k === this.roundIdx : k === nR;
      ctx.fillStyle = doneK ? 'rgba(255,200,90,0.95)' : cur ? 'rgba(255,240,210,0.9)' : 'rgba(255,240,210,0.35)';
      ctx.beginPath(); ctx.arc(W / 2 - 42 + k * 28, 128, k === nR ? 9 : 6.5, 0, Math.PI * 2); ctx.fill();
    }
    if (this.fade) { ctx.fillStyle = `rgba(22,16,10,${(1 - this.fade.a) * 0.85})`; ctx.fillRect(0, 0, W, H); }
  }

  debugState() {
    return {
      puzzle: this.stage.puzzle_id, round: this.round ? this.round.round_id : '-',
      count: this.trail ? `${this.trail.count}/${this.round.target} (${this.trail.method()})` : this.ctrl.counts().join(' '),
      hint_level: this.hints.level, hint_available: this.hints.available, wrong: this.hints.wrong, assist: this.hints.assistActive,
      flagged: [...this.misc.flagged].join(',') || '-', mastery: this.mastery.get(this.puzzle.concept_id),
      world: Object.keys(this.save.data.world).join(',') || '-', music_layers: this.audio.layers,
    };
  }
}

function ctx_alpha(ctx, a) { ctx.globalAlpha = a; }
