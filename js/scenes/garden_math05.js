// LUMA — Room VIL_GARDEN_EDGE / symmetry bed, card MATH-05 (Q01 #5, plan 12 §1 row 5): «الگوهای متقارن».
// Encounter = Mirror Drag (card v1.0): half of the decorative bed is planted; the child takes flowers from the seedling
// tray and plants the other half so that every flower has its mirror image across the centre line of pebbles. The
// grid is soft (card v1.1): a drop snaps to the nearest cell. A wrong flower does not stay; a Ghost Mirror shows where
// its reflection would be, so the child sees that it does not match (card v1.1 §13).
// Practice = the two-axis mosaic (card v1.1 mastery «two axes / a different design»): garden tiles in a wooden frame
// in front of the right wall, first across the vertical axis (top half), then across the horizontal axis.
// Success: garden_bloom on the bed, success_wave on the mosaic → GDN_EDGE_BLOOM, the plate cross-fades to its
// restored state. Camera: centred on the bed's mirror axis, NEO at the LEFT end of the bed facing right, the seedling
// tray at the RIGHT front corner (tools/asset_data/camera.py, plan 14 §4.1).
import { drawHudButton, drawExitArrow, PRESS_S } from '../engine/hud.js';
import { MisconceptionEngine, HintEngine, MasteryEngine, AnalyticsQueue, SaveSlot } from '../edu/engines.js';
import { Spring, Spring2, Timeline, reduceMotion } from '../engine/motion.js';
import { RigActor } from '../engine/rig.js';
import { MirrorGridController } from '../puzzles/mirror_grid.js';
import { pathToAxis, hintPair, waveOrder, key } from '../edu/symmetry_rules.js';

export const W = 1920, H = 1080;
// ---- world layout (1920×1080 world units)
const GHOST_ORDER = [0, 1, 2, 15, 14, 3, 13, 12, 4, 5, 6, 7, 8, 9, 10, 11];   // PROP_MIRROR_GHOST frames, dim → bright (batch 10)
const BED = { cx: 960, bottom: 1045, s: 0.56 };                 // PROP_GARDEN_BED base 2048×1024, bbox bottom at base y 984
const SOIL = { bl: [360, 285], br: [1688, 285], fl: [185, 815], fr: [1863, 815] };   // soil quad in bed-base space
const FLOWER_H = 185;                                            // flower height at the front row (world px)
const TRAY = { x: 1700, y: 1000, w: 340, slots: [-112, 0, 112] }; // seedling tray at the right front corner
const TYPES = ['A', 'B', 'C'];
const FRAME = { cx: 1490, cy: 560, cell: 60, border: 16, postBottom: 772 };   // mosaic frame on two posts (practice)
const TILE_BOX = { x: 1715, y: 800 };
const CAM = [{ x: W / 2, y: H / 2, z: 1 }, { x: 1320, y: 620, z: 1.6 }];
const BTN = { hint: { x: 90, y: 90 }, undo: { x: 220, y: 90 }, reset: { x: 350, y: 90 } };
const BTN_R = 58;
const EXIT = { x: 1832, y: 985, r: 95 };          // after MATH-05: the way on to the crossroads signs (P-01)
const PETALS = ['#e2543f', '#f4c542', '#6f8fe0', '#f6ead0', '#8cc063'];

const lerp = (a, b, t) => a + (b - a) * t;

export class GardenMath05 {
  constructor({ sprites, puzzle, audio, storage, debug, strings, onExit }) {
    Object.assign(this, { sprites, puzzle, audio, debug, strings, onExit });
    this.save = new SaveSlot(storage);
    this.mastery = new MasteryEngine(storage);
    this.analytics = new AnalyticsQueue(storage, puzzle.analytics_fields);
    this.tl = new Timeline();
    this.t = 0; this.attempt = 0; this.drag = null; this.fx = []; this.confetti = [];
    this.cam = { x: new Spring(CAM[0].x, { stiffness: 8, damping: 6 }), y: new Spring(CAM[0].y, { stiffness: 8, damping: 6 }), z: new Spring(1, { stiffness: 8, damping: 6 }) };
    this.bloomMix = new Spring(0, { stiffness: 5, damping: 5 });
    this.axisRise = new Spring(0, { stiffness: 14, damping: 7 });
    this.lumi = { p: new Spring2(520, 560, { stiffness: 30, damping: 9 }), mode: 'follow' };
    this.anim = {};
    this.ended = false; this.bubble = null;
  }

  async load() {
    this.neo = await new RigActor({ id: 'NEO', scale: 0.19, x: 300, groundY: 1050, face: 1 }).load();
    this.tiko = await new RigActor({ id: 'TIKO', scale: 0.1, x: 1590, groundY: 858, face: -1 }).load();
    this.actors = [this.tiko, this.neo];
    const enc = this.save.puzzle(this.puzzle.stages[0].puzzle_id), pra = this.save.puzzle(this.puzzle.stages[1].puzzle_id);
    this.bed = new MirrorGridController(this.puzzle.stages[0]);
    if (pra && pra.solved) { this.bed.finishAll(); this.startStage(1, { finished: true }); }
    else if (enc && enc.solved) { this.bed.finishAll(); this.startStage(1); }
    else this.startStage(0);
    if (this.save.flag(this.puzzle.world_state_on_solve)) this.bloomMix.set(1);
    this.snapCamera();
    return this;
  }

  // ================================================================= flow
  startStage(idx, { finished = false } = {}) {
    this.stageIdx = idx; this.stage = this.puzzle.stages[idx];
    this.misc = new MisconceptionEngine(this.puzzle.misconceptions, this.puzzle.misconception_flag_threshold);
    this.hints = new HintEngine(this.stage.hints, this.stage.answer_assist);
    this.stageMaxHint = 0; this.stageAssisted = false; this.stageStart = this.t; this.attempt++;
    this.fx = []; this.anim = {}; this.bubble = null; this.hintShow = 0; this.axisSeen = false; this.centerGlow = 0;
    this.axisRise.set(0); this.axisRise.target = 0;
    const c = CAM[idx]; this.cam.x.target = c.x; this.cam.y.target = c.y; this.cam.z.target = c.z;
    const hooks = {
      onPlace: (p) => this.onPlace(p), onWrong: (rule, d, g) => this.onWrong(rule, d, g), onReject: (rule, d) => this.onReject(rule, d),
      onUndo: (p) => this.log('puzzle_interaction', { action: 'undo', cell: key(p) }),
      onPhaseSolved: (i) => this.onPhaseSolved(i), onSolved: () => {},
    };
    if (idx === 0) { this.bed = new MirrorGridController(this.stage, hooks); this.ctrl = this.bed; }
    else { this.ctrl = new MirrorGridController(this.stage, hooks); }
    this.neo.x = 300; this.neo.groundY = 1050; this.neo.face = 1;
    this.tiko.x = idx === 0 ? 1590 : 1790; this.tiko.groundY = idx === 0 ? 858 : 860; this.tiko.face = -1;
    if (finished) {
      this.ctrl.finishAll(); this.ended = true; this.audio.setLayers(4);
      return;
    }
    this.ended = false;
    this.audio.setLayers(idx === 0 ? 1 : 3);
    this.log('puzzle_start', {});
    this.recordMastery(false);
    this.save.setPuzzle(this.stage.puzzle_id, { solved: false, entered: new Date().toISOString() });
  }

  get phase() { return this.ctrl.phase; }
  objective() { return this.stage.phases.length > 1 ? this.phase.objective_fa : this.stage.objective_fa; }

  recordMastery(solved) {
    const lvl = this.mastery.record(this.puzzle.concept_id,
      { stage: this.stage.stage, solved, maxHint: this.stageMaxHint, assisted: this.stageAssisted }, this.puzzle.mastery);
    if (lvl !== null) this.log('mastery_updated', { level: lvl });
  }

  log(name, extra) {
    const e = this.analytics.log(name, {
      puzzle_id: this.stage.puzzle_id, attempt_id: this.attempt, duration: Math.round((this.t - this.stageStart) * 10) / 10,
      phase_id: this.phase.phase_id, axis: this.phase.axis, hint_level: this.hints ? this.hints.maxUsed : 0, ...extra,
    });
    if (this.debug) this.debug.push(e);
  }

  observe(rule) {
    const { def, newlyFlagged } = this.misc.observe(rule);
    if (newlyFlagged) {
      this.log('misconception_flagged', { misconception: def.code, error_type: def.error_type });
      this.hints.target(def.targeted_hint);
    }
    return def;
  }

  // ---------------------------------------------------------------- events
  onPlace(p) {
    this.hints.onActivity();
    this.anim['p' + key(p)] = { pop: 0.45 };
    if (this.stageIdx === 0) { this.audio.thump(); this.audio.gardenChime(this.ctrl.undoStack.length); }
    else this.audio.ceramic();                                            // tile_snap
    this.log('tile_moved', { piece_type: p.type, cell: key(p) });
    this.fx.push({ kind: 'sparkle', ...this.cellWorld(p), t: 0 });
  }
  onWrong(rule, d, ghost) {
    const out = this.hints.onWrong();
    const def = this.observe(rule);
    this.log('tile_error', { piece_type: d.type, cell: key(d), error_type: def ? def.error_type : 'ConceptError', misconception: def ? def.code : null });
    this.log('mirror_preview', { piece_type: d.type, cell: key(ghost) });
    // the flower lands, wobbles, then floats back to the tray; its reflection shows as a Ghost Mirror (ghost_appear)
    const at = this.cellWorld(d);
    this.fx.push({ kind: 'wrong', type: d.type, x: at.x, y: at.y, depth: at.depth, t: 0 });
    this.fx.push({ kind: 'ghost', type: ghost.type, r: ghost.r, c: ghost.c, t: 0 });
    this.audio.flicker(); this.tl.after(0.25, () => this.audio.shimmer());
    this.tiko.play('happy', 'idle');
    if (out === 'assist') this.tl.after(1.2, () => {
      if (this.ctrl.phaseDone) return;
      const left = this.ctrl.applyAssist(); this.stageAssisted = true;
      this.log('puzzle_interaction', { action: 'answer_assist', cells_left: left });
    });
  }
  onReject(rule, d) {
    const at = d && d.r >= 0 && rule !== 'outside' ? this.cellWorld(d) : null;
    this.fx.push({ kind: 'return', type: d ? d.type : 'A', x: at ? at.x : this.dropX, y: at ? at.y : this.dropY, t: 0 });
    this.audio.snap();
  }
  onPhaseSolved(i) {
    this.stageMaxHint = Math.max(this.stageMaxHint, this.hints.maxUsed);
    this.axisRise.target = 1; this.hintShow = 0;
    const pieces = waveOrder(this.phase.axis, this.stage, this.ctrl.pieces);
    const wave = 0.5 + pieces.length * 0.14;
    pieces.forEach((p, k) => this.tl.after(0.3 + k * 0.14, () => {        // garden_bloom / success_wave: outward from the axis
      this.anim['p' + key(p)] = { pop: 0.5, glow: 1.2 };
      if (this.stageIdx === 0) this.audio.gardenChime(k); else this.audio.ceramic();
    }));
    if (!this.ctrl.solved) {                                             // mosaic: vertical axis done → horizontal axis
      this.log('phase_solved', {});
      this.tl.after(wave + 0.6, () => { this.ctrl.nextPhase(); this.axisRise.set(0); this.axisRise.target = 0; this.hints.reset(); this.audio.hint(); });
      return;
    }
    this.log('solved', { assisted: this.stageAssisted });
    this.log('puzzle_solved', { assisted: this.stageAssisted });
    this.recordMastery(true);
    this.save.setPuzzle(this.stage.puzzle_id, { solved: true, hint_max: this.stageMaxHint, assisted: this.stageAssisted });
    if (this.stageIdx === 0) {
      this.tl.after(wave + 0.3, () => { this.audio.motif(); this.neo.play('happy', 'idle'); this.tiko.play('happy', 'idle'); this.audio.setLayers(2); });
      this.tl.after(wave + 2.2, () => this.transition(() => this.startStage(1)));
    } else {
      this.tl.after(wave + 0.4, () => {
        this.audio.bell(); this.audio.motif(); this.audio.setLayers(4);
        this.save.setFlag(this.puzzle.world_state_on_solve);             // GDN_EDGE_BLOOM → the garden edge comes alive
        this.bloomMix.target = 1; this.spawnPetals();
        const c = CAM[0]; this.cam.x.target = c.x; this.cam.y.target = c.y; this.cam.z.target = c.z;
        for (const p of this.bed.pieces) this.tl.after(0.4 + Math.random() * 0.8, () => { this.anim['b' + key(p)] = { pop: 0.5, glow: 1.4 }; });
        this.neo.play('happy', 'idle'); this.tiko.play('happy', 'idle'); this.lumi.mode = 'celebrate';
        this.tl.after(3.4, () => { this.lumi.mode = 'follow'; this.ended = true; });
      });
    }
    this.stageAssisted = false;
  }

  // wordless way on to the village crossroads (P-01 «محله‌ی ما»)
  leave() {
    this.leaving = { a: 0 }; this.audio.pickup();
    this.log('room_exit', { to: 'VIL_SIGN_AREA' });
    this.tl.tween(0.8, (k) => { this.leaving.a = k; }, () => this.onExit());
  }
  transition(fn) {
    this.fade = { a: 1 };
    this.tl.tween(0.5, (k) => { this.fade.a = 1 - k; }, () => { fn(); this.tl.tween(0.6, (k) => { this.fade.a = k; }, () => { this.fade = null; }); });
  }
  replay() {
    this.log('replay_started', {});
    for (const s of this.puzzle.stages) this.save.setPuzzle(s.puzzle_id, null);
    this.transition(() => { this.bed = null; this.startStage(0); });
  }

  // ================================================================= geometry
  bedPt(bx, by) { return { x: BED.cx + (bx - 1024) * BED.s, y: BED.bottom + (by - 984) * BED.s }; }
  /** Soil point for grid coordinates (u across 0..1, v back→front 0..1), with the depth scale of that row. */
  soilPt(u, v) {
    const l = lerp(SOIL.bl[0], SOIL.fl[0], v), r = lerp(SOIL.br[0], SOIL.fr[0], v), y = lerp(SOIL.bl[1], SOIL.fl[1], v);
    const p = this.bedPt(lerp(l, r, u), y);
    return { ...p, depth: (r - l) / (SOIL.fr[0] - SOIL.fl[0]) };
  }
  frameOrigin() { const n = this.stage.cols * FRAME.cell; return { x: FRAME.cx - n / 2, y: FRAME.cy - n / 2, n }; }
  /** World point of a cell: the bed plants at the cell centre (a bit to the front); the mosaic cell centre. */
  cellWorld(cell) {
    if (this.stageIdx === 0 || cell.onBed) {
      const g = this.puzzle.stages[0];
      return this.soilPt((cell.c + 0.5) / g.cols, (cell.r + 0.62) / g.rows);
    }
    const o = this.frameOrigin();
    return { x: o.x + (cell.c + 0.5) * FRAME.cell, y: o.y + (cell.r + 0.5) * FRAME.cell, depth: 1 };
  }
  /** Soft grid (card v1.1): the cell under a world point; up to ⅓ of a cell outside still snaps to the edge cell. */
  cellAt(x, y) {
    const g = this.stage;
    if (this.stageIdx === 0) {
      const top = this.bedPt(0, SOIL.bl[1]).y, bot = this.bedPt(0, SOIL.fl[1]).y;
      const v = (y - top) / (bot - top);
      const l = this.bedPt(lerp(SOIL.bl[0], SOIL.fl[0], v), 0).x, r = this.bedPt(lerp(SOIL.br[0], SOIL.fr[0], v), 0).x;
      const u = (x - l) / (r - l);
      return this.softCell(u * g.cols, v * g.rows, g);
    }
    const o = this.frameOrigin();
    return this.softCell((x - o.x) / FRAME.cell, (y - o.y) / FRAME.cell, g);
  }
  softCell(fc, fr, g) {
    const tol = 0.34;
    if (fc < -tol || fr < -tol || fc > g.cols + tol || fr > g.rows + tol) return { r: -1, c: -1 };
    return { r: Math.max(0, Math.min(g.rows - 1, Math.floor(fr))), c: Math.max(0, Math.min(g.cols - 1, Math.floor(fc))) };
  }
  traySlot(i) { return { x: TRAY.x + TRAY.slots[i], y: TRAY.y - 18 }; }
  toWorld(x, y) { const z = this.cam.z.value; return [(x - W / 2) / z + this.cam.x.value, (y - H / 2) / z + this.cam.y.value]; }
  snapCamera() { this.cam.x.set(this.cam.x.target); this.cam.y.set(this.cam.y.target); this.cam.z.set(this.cam.z.target); }
  axisX() { return this.stageIdx === 0 ? BED.cx : FRAME.cx; }
  onAxis(x, y) {
    if (this.stageIdx === 0) {
      const top = this.bedPt(0, SOIL.bl[1]).y - 30, bot = this.bedPt(0, SOIL.fl[1]).y + 10;
      return Math.abs(x - BED.cx) < 30 && y > top && y < bot;
    }
    const o = this.frameOrigin();
    if (this.phase.axis === 'v') return Math.abs(x - FRAME.cx) < 22 && y > o.y - 10 && y < o.y + o.n + 10;
    return Math.abs(y - FRAME.cy) < 22 && x > o.x - 10 && x < o.x + o.n + 10;
  }

  // ================================================================= input
  pointerDown(sx, sy) {
    this.audio.unlock();
    if (this.hints) this.hints.onActivity();
    for (const [name, b] of Object.entries(BTN)) if (Math.hypot(sx - b.x, sy - b.y) <= BTN_R) return this.button(name);
    if (this.fade || this.leaving) return;
    if (this.ended && this.onExit && Math.hypot(sx - EXIT.x, sy - EXIT.y) < EXIT.r) return this.leave();
    const [x, y] = this.toWorld(sx, sy);
    this.down = { x, y, t: this.t };
    if (this.ended) {
      if (this.stageIdx === 1 && Math.abs(x - BED.cx) < 560 && y > 600 && y < 1040) { this.audio.gardenChime(Math.floor(Math.random() * 7)); this.spawnPetals(40); return; }
    } else if (!this.ctrl.phaseDone) {
      if (this.stageIdx === 0) {
        for (let i = 0; i < TYPES.length; i++) {
          const p = this.traySlot(i);
          if (Math.abs(x - p.x) < 58 && y > p.y - FLOWER_H - 10 && y < p.y + 30) {
            this.drag = { type: TYPES[i], src: i, p: new Spring2(p.x, p.y, { stiffness: 260, damping: 22 }), moved: false };
            this.audio.pickup(); this.log('object_selected', { piece_type: TYPES[i] });
            this.centerGlow = Math.max(this.centerGlow, 0.5);             // «observe the axis» (card v1.1 §12)
            return;
          }
        }
      } else if (Math.abs(x - TILE_BOX.x) < 80 && y > TILE_BOX.y - 90 && y < TILE_BOX.y + 20) {
        this.drag = { type: 'T', src: 0, p: new Spring2(TILE_BOX.x, TILE_BOX.y - 50, { stiffness: 260, damping: 22 }), moved: false };
        this.audio.pickup(); this.log('object_selected', { piece_type: 'T' }); this.centerGlow = Math.max(this.centerGlow, 0.5);
        return;
      }
      if (this.onAxis(x, y)) return this.axisTapped();
    }
    for (const a of this.actors) if (a.hit(x, y + (a.lift || 0))) { a.play('happy', 'idle'); return; }
  }
  pointerMove(sx, sy) {
    if (!this.drag) return;
    const [x, y] = this.toWorld(sx, sy);
    if (this.down && Math.hypot(x - this.down.x, y - this.down.y) > 12) this.drag.moved = true;
    if (this.drag.moved) this.drag.p.to(x, y - 16);                      // the flower floats just above the finger
  }
  pointerUp(sx, sy) {
    const d = this.drag; this.drag = null;
    if (!d || !d.moved) return;
    const x = d.p.x.target, y = d.p.y.target + 16;
    this.dropX = x; this.dropY = y;
    const cell = this.cellAt(x, y);
    this.ctrl.drop(d.type, cell.r, cell.c);
  }
  axisTapped() {                                    // analytics axis_identified (card v1.1 §21)
    this.centerGlow = 1.4; this.audio.chime();
    if (!this.axisSeen) { this.axisSeen = true; this.log('axis_identified', { source: 'tap' }); }
  }

  button(name) {
    this.pressT = { ...(this.pressT || {}), [name]: PRESS_S };
    const busy = this.fade || this.ctrl.phaseDone;
    if (name === 'hint') {
      if (busy || this.ended) return;
      const h = this.hints.request();
      if (!h) return;
      this.audio.hint();
      this.log(`hint_${h.level}_used`, { hint_level: h.level });
      this.showHint(h);
    } else if (name === 'undo') {
      if (busy || this.ended) return;
      if (this.ctrl.undo()) this.audio.snap();
    } else if (name === 'reset') {
      if (this.ended) return this.replay();
      if (busy) return;
      if (this.ctrl.reset()) { this.audio.snap(); this.log('puzzle_interaction', { action: 'reset' }); }
    }
  }

  showHint(h) {
    this.stageMaxHint = Math.max(this.stageMaxHint, h.level);
    if (h.text_key && this.strings) { this.bubble = { text: this.strings.t(h.text_key), t: 0 }; this.tl.after(5.5, () => { this.bubble = null; }); }
    this.hintShow = h.level;
    if (h.level === 1) {                             // H1: LUMI flies along the axis; the pebbles twinkle
      this.lumi.mode = 'axis'; this.lumi.axisT = 0; this.centerGlow = 1.6;
      this.tl.after(4.6, () => { if (this.lumi.mode === 'axis') this.lumi.mode = 'follow'; if (this.hintShow === 1) this.hintShow = 0; });
      if (!this.axisSeen) { this.axisSeen = true; this.log('axis_identified', { source: 'hint' }); }
    } else {                                         // H2: axis + distance of one piece · H3: + mirrored distance + ghost
      this.axisRise.target = 1;
      const hp = hintPair(this.stage, this.phase, this.ctrl.pieces);
      if (hp) { const p = this.cellWorld(hp.source); this.lumi.mode = 'hint'; this.lumi.target = { x: p.x, y: p.y - 150 }; }
      this.tl.after(4, () => { if (this.lumi.mode === 'hint') this.lumi.mode = 'follow'; });
      if (h.level === 3 && hp) this.log('mirror_preview', { piece_type: hp.target.type, cell: key(hp.target), source: 'hint' });
    }
  }

  spawnPetals(n = 150) {
    if (reduceMotion) n = Math.round(n / 4);
    for (let i = 0; i < n; i++) {
      this.confetti.push({ x: 200 + Math.random() * 1500, y: -40 - Math.random() * 500, vy: 70 + Math.random() * 70,
        ph: Math.random() * 6.28, sw: 25 + Math.random() * 45, r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 4,
        c: PETALS[i % PETALS.length], w: 12 + Math.random() * 8, h: 8 + Math.random() * 5 });
    }
  }

  // ================================================================= update
  update(dt) {
    if (this.pressT) for (const k in this.pressT) this.pressT[k] = Math.max(0, this.pressT[k] - dt);
    this.t += dt;
    this.tl.update(dt);
    if (this.hints && !this.ended) this.hints.tick(dt);
    for (const s of [this.cam.x, this.cam.y, this.cam.z, this.bloomMix, this.axisRise]) s.update(dt);
    if (reduceMotion) this.snapCamera();
    if (this.drag) this.drag.p.update(dt);
    if (this.bubble) this.bubble.t += dt;
    this.centerGlow = Math.max(0, this.centerGlow - dt * 0.5);
    for (const k in this.anim) { const a = this.anim[k]; if (a.pop > 0) a.pop -= dt; if (a.glow > 0) a.glow -= dt; }
    for (const f of this.fx) f.t += dt;
    this.fx = this.fx.filter((f) => f.t < (f.kind === 'ghost' ? 1.8 : f.kind === 'wrong' ? 1.0 : f.kind === 'return' ? 0.4 : 0.9));
    for (const c of this.confetti) { c.y += c.vy * dt; c.ph += dt * 2; c.r += c.vr * dt; }
    this.confetti = this.confetti.filter((c) => c.y < H + 40);
    for (const a of this.actors) a.update(dt);
    if (this.tiko.clip === 'idle') this.tiko.faceTowards(this.stageIdx === 0 ? BED.cx : FRAME.cx);
    const lm = this.lumi;
    if (lm.mode === 'follow') { const h = this.neo.headPoint(); lm.p.to(h.x + 70, h.y - 60 + Math.sin(this.t * 2.1) * 12); }
    else if (lm.mode === 'hint') lm.p.to(lm.target.x + Math.cos(this.t * 3) * 40, lm.target.y + Math.sin(this.t * 3) * 18);
    else if (lm.mode === 'axis') {                   // back → front along the axis, twice
      lm.axisT += dt; const k = (lm.axisT / 2.2) % 1;
      if (this.stageIdx === 0) { const p = this.soilPt(0.5, k); lm.p.to(p.x, p.y - 70); }
      else { const o = this.frameOrigin(); if (this.phase.axis === 'v') lm.p.to(FRAME.cx, o.y + k * o.n - 40); else lm.p.to(o.x + k * o.n, FRAME.cy - 40); }
    } else if (lm.mode === 'celebrate') lm.p.to(960 + Math.cos(this.t * 1.6) * 420, 360 + Math.sin(this.t * 3.2) * 60);
    if (reduceMotion && lm.mode !== 'celebrate') lm.p.set(lm.p.x.target, lm.p.y.target);
    lm.p.update(dt);
  }

  // ================================================================= draw
  img(name) { return this.sprites.get(name); }
  drawPlate(ctx) {
    const a = this.img('garden_plate'), b = this.img('garden_plate_on'), mix = Math.max(0, Math.min(1, this.bloomMix.value));
    if (a) ctx.drawImage(a, -40, -24, W + 80, H + 48);
    if (b && mix > 0.001) { ctx.globalAlpha = mix; ctx.drawImage(b, -40, -24, W + 80, H + 48); ctx.globalAlpha = 1; }
  }
  /** Flower sprite (1024 base, stem base at y 984) standing on world point (x, y); h = height in world px. */
  drawFlower(ctx, type, x, y, h, { pop = 0, glow = 0, alpha = 1, rot = 0 } = {}) {
    const im = this.img('flower_' + type.toLowerCase());
    if (!im) return;
    const k = 1 + Math.max(0, Math.sin(Math.max(0, pop) / 0.5 * Math.PI)) * 0.16, s = h * k / 942;
    ctx.save(); ctx.globalAlpha *= alpha;
    ctx.fillStyle = 'rgba(30,18,8,0.28)'; ctx.beginPath(); ctx.ellipse(x, y, 150 * s, 30 * s, 0, 0, Math.PI * 2); ctx.fill();
    if (glow > 0) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(x, y - h * 0.6, 4, x, y - h * 0.6, h * 0.8);
      g.addColorStop(0, `rgba(255,230,160,${0.45 * Math.min(1, glow)})`); g.addColorStop(1, 'rgba(255,230,160,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y - h * 0.6, h * 0.8, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    ctx.translate(x, y); ctx.rotate(rot);
    ctx.drawImage(im, -512 * s, -984 * s, 1024 * s, 1024 * s);
    ctx.restore();
  }
  drawTile(ctx, x, y, size, { pop = 0, glow = 0, alpha = 1, ghost = false } = {}) {
    const im = this.img('garden_tile');
    const k = 1 + Math.max(0, Math.sin(Math.max(0, pop) / 0.5 * Math.PI)) * 0.14, s = size * k;
    ctx.save(); ctx.globalAlpha *= alpha;
    if (im) ctx.drawImage(im, x - s / 2, y - s / 2, s, s);
    else { ctx.fillStyle = '#f1e2c2'; ctx.fillRect(x - s / 2, y - s / 2, s, s); }
    if (ghost) { ctx.strokeStyle = 'rgba(255,248,220,0.95)'; ctx.lineWidth = 3; ctx.setLineDash([7, 6]); ctx.strokeRect(x - s / 2, y - s / 2, s, s); }
    if (glow > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,220,150,${0.35 * Math.min(1, glow)})`; ctx.fillRect(x - s / 2, y - s / 2, s, s); }
    ctx.restore();
  }

  draw(ctx) {
    this._ctx = ctx;
    const z = this.cam.z.value;
    ctx.save();
    ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.translate(-this.cam.x.value, -this.cam.y.value);
    this.drawPlate(ctx);
    const rowAlpha = this.fade ? this.fade.a : 1;
    this.drawMosaic(ctx, rowAlpha);
    // the tiko stands behind the bed; NEO in front of its left end
    this.tiko.draw(ctx);
    this.drawBed(ctx, rowAlpha);
    this.drawTray(ctx);
    this.neo.draw(ctx);
    for (const f of this.fx) this.drawFx(ctx, f);
    this.drawDragged(ctx);
    this.drawLumi(ctx);
    ctx.restore();
    for (const c of this.confetti) {                 // petals (screen space)
      ctx.save(); ctx.translate(c.x + Math.sin(c.ph) * c.sw, c.y); ctx.rotate(c.r); ctx.fillStyle = c.c;
      ctx.beginPath(); ctx.ellipse(0, 0, c.w / 2, (c.h / 2) * Math.abs(Math.cos(c.ph)) + 1, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    this.drawHud(ctx);
  }

  drawBed(ctx, alpha) {
    const im = this.img('garden_bed'), g = this.puzzle.stages[0];
    if (im) ctx.drawImage(im, BED.cx - 1024 * BED.s, BED.bottom - 984 * BED.s, 2048 * BED.s, 1024 * BED.s);
    // centre line of pebbles, laid into the perspective slice by slice (PROP_CENTER_LINE is an orthographic strip)
    const cl = this.img('center_line'), mcl = this.sprites.m.center_line;
    const top = this.soilPt(0.5, 0), bot = this.soilPt(0.5, 1);
    if (cl && mcl) {
      const [x0, y0, x1, y1] = mcl.bbox, n = 16, sw = x1 - x0 + 1, sh = y1 - y0 + 1;
      for (let i = 0; i < n; i++) {
        const v0 = i / n, v1 = (i + 1) / n, d = lerp(top.depth, bot.depth, (v0 + v1) / 2), w = 34 * d;
        const ya = lerp(top.y - 6, bot.y + 6, v0), yb = lerp(top.y - 6, bot.y + 6, v1);
        ctx.drawImage(cl, x0, y0 + sh * v0, sw, sh / n + 0.5, BED.cx - w / 2, ya, w, yb - ya + 0.5);
      }
      const clg = this.img('center_line_glow'), k = Math.min(1, this.centerGlow);   // PROP_CENTER_LINE STATE:glowing (same canvas + bbox)
      if (clg && k > 0.01) {
        ctx.save(); ctx.globalAlpha = k;
        for (let i = 0; i < n; i++) {
          const v0 = i / n, v1 = (i + 1) / n, d = lerp(top.depth, bot.depth, (v0 + v1) / 2), w = 34 * d;
          const ya = lerp(top.y - 6, bot.y + 6, v0), yb = lerp(top.y - 6, bot.y + 6, v1);
          ctx.drawImage(clg, x0, y0 + sh * v0, sw, sh / n + 0.5, BED.cx - w / 2, ya, w, yb - ya + 0.5);
        }
        ctx.restore();
      }
    }
    const glow = Math.min(1, this.centerGlow);
    if (glow > 0) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const tw = this.hintShow === 1 ? 0.5 + 0.5 * Math.sin(this.t * 8) : 1;
      ctx.strokeStyle = `rgba(255,226,150,${0.5 * glow * tw})`; ctx.lineWidth = 26; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(BED.cx, top.y); ctx.lineTo(BED.cx, bot.y); ctx.stroke(); ctx.restore();
    }
    // symmetry stone: the marker at the back end of the centre line (card v1.0 prompt: «central stone symmetry marker»)
    const st = this.img('symmetry_stone');
    if (st) { const w = 118 * top.depth; ctx.drawImage(st, BED.cx - w / 2, top.y - w * 0.62, w, w); }
    // H2/H3 on the bed (stage 0 only; the mosaic draws its own)
    if (this.stageIdx === 0 && !this.ended) this.drawAxisRod(ctx, 'v', BED.cx, top.y - 70, bot.y + 12);
    // flowers, back row first
    const pcs = [...this.bed.pieces].sort((a, b) => a.r - b.r);
    ctx.save(); ctx.globalAlpha = this.stageIdx === 0 ? alpha : 1;
    for (let r = 0; r < g.rows; r++) {
      if (this.stageIdx === 0 && this.ctrl.assist && !this.ctrl.phaseDone) {
        for (const m of this.ctrl.missing()) if (m.r === r) {           // Answer Assist: soft outlines on the mirror cells
          const p = this.cellWorld({ ...m, onBed: true });
          ctx.save(); ctx.strokeStyle = `rgba(255,244,210,${0.6 + 0.25 * Math.sin(this.t * 3)})`; ctx.lineWidth = 3; ctx.setLineDash([8, 7]);
          ctx.beginPath(); ctx.ellipse(p.x, p.y, 48 * p.depth, 18 * p.depth, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
        }
      }
      for (const p of pcs) {
        if (p.r !== r) continue;
        const w = this.cellWorld({ ...p, onBed: true }), a = this.anim[(this.stageIdx === 0 ? 'p' : 'b') + key(p)] || this.anim['b' + key(p)] || {};
        const sway = reduceMotion ? 0 : Math.sin(this.t * 1.3 + p.c * 0.9 + p.r) * 0.025 * (this.bloomMix.value > 0.5 ? 1.6 : 1);
        this.drawFlower(ctx, p.type, w.x, w.y, FLOWER_H * w.depth, { pop: a.pop || 0, glow: a.glow || 0, rot: sway });
      }
    }
    if (this.stageIdx === 0 && !this.ended) this.drawHintOverlay(ctx);   // over the flowers, so the steps stay visible
    ctx.restore();
  }

  drawAxisRod(ctx, axis, cx, a, b) {          // PROP_SYMMETRY_AXIS rises on the axis (H2, and on every solved phase)
    const k = Math.max(0, Math.min(1.05, this.axisRise.value));
    if (k < 0.01) return;
    const im = this.img('symmetry_axis'), m = this.sprites.m.symmetry_axis;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const len = Math.abs(b - a) * k;
    ctx.strokeStyle = `rgba(255,220,140,${0.35 * k})`; ctx.lineWidth = 22; ctx.lineCap = 'round';
    ctx.beginPath();
    if (axis === 'v') { ctx.moveTo(cx, b); ctx.lineTo(cx, b - len); } else { ctx.moveTo(a, cx); ctx.lineTo(a + len, cx); }
    ctx.stroke(); ctx.restore();
    if (!im || !m) return;
    const [x0, y0, x1, y1] = m.bbox, sw = x1 - x0 + 1, sh = y1 - y0 + 1, thick = 14;
    ctx.save();
    if (axis === 'v') ctx.drawImage(im, x0, y0, sw, sh, cx - thick / 2, b - len, thick, len);
    else { ctx.translate(a, cx); ctx.rotate(-Math.PI / 2); ctx.drawImage(im, x0, y0, sw, sh, -thick / 2, 0, thick, len); }
    ctx.restore();
  }

  /** H2: glowing step dots from one source piece to the axis; H3: the same number of dots on the other side + ghost. */
  drawHintOverlay(ctx) {
    if (this.hintShow < 2 || this.ctrl.phaseDone) return;
    const hp = hintPair(this.stage, this.phase, this.ctrl.pieces);
    if (!hp) return;
    const dots = (cell, k0) => pathToAxis(this.phase.axis, this.stage, cell).forEach((c, i) => {
      const p = this.cellWorld(c), a = 0.65 + 0.35 * Math.sin(this.t * 4 - (i + k0) * 0.8), r = 17 * p.depth;
      ctx.save(); ctx.fillStyle = `rgba(255,236,170,${a})`; ctx.strokeStyle = 'rgba(120,70,20,0.8)'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(p.x, p.y + (this.stageIdx === 0 ? 4 : 0), r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore();
    });
    dots(hp.source, 0);
    if (this.hintShow >= 3) {
      dots(hp.target, 3);
      const p = this.cellWorld(hp.target), a = 0.45 + 0.15 * Math.sin(this.t * 4);
      if (this.stageIdx === 0) this.drawFlower(ctx, hp.target.type, p.x, p.y, FLOWER_H * p.depth, { alpha: a, glow: 0.5 });
      if (this.stageIdx === 0) this.drawMirrorGhost(ctx, p, 0.8, 5);
      else this.drawTile(ctx, p.x, p.y, FRAME.cell - 4, { alpha: a, ghost: true });
    }
  }

  drawTray(ctx) {                            // seedling tray (engine-drawn wood, the LUMA table palette)
    if (this.stageIdx !== 0 || this.ended) return;
    const { x, y, w } = TRAY;
    ctx.save();
    ctx.fillStyle = 'rgba(30,18,8,0.3)'; ctx.beginPath(); ctx.ellipse(x, y + 16, w * 0.55, 20, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#5b3a1d'; ctx.beginPath(); ctx.roundRect(x - w / 2, y - 26, w, 26, 8); ctx.fill();          // soil top
    const gr = ctx.createLinearGradient(0, y - 4, 0, y + 28); gr.addColorStop(0, '#d9a45a'); gr.addColorStop(1, '#a8702f');
    ctx.fillStyle = gr; ctx.strokeStyle = '#6e4520'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(x - w / 2 - 8, y - 6, w + 16, 34, 7); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(110,69,32,0.55)'; ctx.lineWidth = 2;
    for (const dx of [-56, 56]) { ctx.beginPath(); ctx.moveTo(x + dx, y - 2); ctx.lineTo(x + dx, y + 24); ctx.stroke(); }
    ctx.restore();
    TYPES.forEach((t, i) => {
      if (this.drag && this.drag.src === i) return;
      const p = this.traySlot(i), hl = this.hintShow >= 3 && (() => { const hp = hintPair(this.stage, this.phase, this.ctrl.pieces); return hp && hp.target.type === t; })();
      this.drawFlower(ctx, t, p.x, p.y, FLOWER_H * 0.92, { glow: hl ? 0.6 + 0.4 * Math.sin(this.t * 4) : 0 });
    });
  }

  drawMosaic(ctx, alpha) {
    if (this.stageIdx !== 1) return;
    const o = this.frameOrigin(), B = FRAME.border, g = this.stage;
    ctx.save(); ctx.globalAlpha = alpha;
    // two posts to the ground, then the frame (face-on, parallel to the wall — plan 14 §4.1 rule 5)
    ctx.fillStyle = '#8a5a2b'; ctx.strokeStyle = '#5a3818'; ctx.lineWidth = 3;
    for (const px of [o.x + 14, o.x + o.n - 28]) { ctx.beginPath(); ctx.roundRect(px, o.y + o.n, 14, FRAME.postBottom - o.y - o.n, 4); ctx.fill(); ctx.stroke(); }
    ctx.fillStyle = 'rgba(30,18,8,0.3)'; ctx.beginPath(); ctx.ellipse(FRAME.cx, FRAME.postBottom, o.n * 0.55, 10, 0, 0, Math.PI * 2); ctx.fill();
    const wood = ctx.createLinearGradient(0, o.y - B, 0, o.y + o.n + B); wood.addColorStop(0, '#c98f4a'); wood.addColorStop(1, '#9a6430');
    ctx.fillStyle = wood; ctx.beginPath(); ctx.roundRect(o.x - B, o.y - B, o.n + 2 * B, o.n + 2 * B, 10); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#e9dcc0'; ctx.fillRect(o.x, o.y, o.n, o.n);                                  // lime mortar bed
    ctx.strokeStyle = 'rgba(150,120,80,0.45)'; ctx.lineWidth = 1.5;
    for (let i = 1; i < g.cols; i++) { ctx.beginPath(); ctx.moveTo(o.x + i * FRAME.cell, o.y); ctx.lineTo(o.x + i * FRAME.cell, o.y + o.n); ctx.stroke(); }
    for (let i = 1; i < g.rows; i++) { ctx.beginPath(); ctx.moveTo(o.x, o.y + i * FRAME.cell); ctx.lineTo(o.x + o.n, o.y + i * FRAME.cell); ctx.stroke(); }
    // rows not used in this phase wait under a soft veil
    if (!this.ended && this.phase.row_to < g.rows - 1) {
      ctx.fillStyle = 'rgba(60,40,20,0.28)'; ctx.fillRect(o.x, o.y + (this.phase.row_to + 1) * FRAME.cell, o.n, (g.rows - 1 - this.phase.row_to) * FRAME.cell);
    }
    // axis: a thin brass line for the active axis (the rod rises for H2 / a solved phase)
    const ax = this.ended ? null : this.phase.axis, glow = Math.min(1, this.centerGlow);
    ctx.strokeStyle = `rgba(176,128,48,${0.7 + 0.3 * glow})`; ctx.lineWidth = 3 + 4 * glow;
    if (ax === 'v') { ctx.beginPath(); ctx.moveTo(FRAME.cx, o.y - 8); ctx.lineTo(FRAME.cx, o.y + (this.phase.row_to + 1) * FRAME.cell + 8); ctx.stroke(); }
    if (ax === 'h') { ctx.beginPath(); ctx.moveTo(o.x - 8, FRAME.cy); ctx.lineTo(o.x + o.n + 8, FRAME.cy); ctx.stroke(); }
    if (ax) this.drawAxisRod(ctx, ax, ax === 'v' ? FRAME.cx : FRAME.cy, ax === 'v' ? o.y - 10 : o.x - 10, ax === 'v' ? o.y + (this.phase.row_to + 1) * FRAME.cell + 10 : o.x + o.n + 10);
    // tiles
    if (this.ctrl.assist && !this.ctrl.phaseDone) for (const m of this.ctrl.missing()) {
      const p = this.cellWorld(m); ctx.save(); ctx.strokeStyle = `rgba(255,244,210,${0.6 + 0.25 * Math.sin(this.t * 3)})`; ctx.lineWidth = 3;
      ctx.setLineDash([6, 5]); ctx.strokeRect(p.x - FRAME.cell / 2 + 4, p.y - FRAME.cell / 2 + 4, FRAME.cell - 8, FRAME.cell - 8); ctx.restore();
    }
    for (const p of this.ctrl.pieces) {
      const w = this.cellWorld(p), a = this.anim['p' + key(p)] || {};
      this.drawTile(ctx, w.x, w.y, FRAME.cell - 4, { pop: a.pop || 0, glow: a.glow || 0 });
    }
    if (!this.ended) this.drawHintOverlay(ctx);
    // tile box on the ground by the gate
    if (!this.ended) {
      const { x, y } = TILE_BOX;
      ctx.fillStyle = 'rgba(30,18,8,0.3)'; ctx.beginPath(); ctx.ellipse(x, y + 4, 80, 12, 0, 0, Math.PI * 2); ctx.fill();
      for (let i = 0; i < 3; i++) this.drawTile(ctx, x - 10 + i * 8, y - 36 - i * 7, FRAME.cell - 6);
      ctx.fillStyle = '#a8702f'; ctx.strokeStyle = '#6e4520'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.roundRect(x - 62, y - 30, 124, 34, 6); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }

  drawDragged(ctx) {
    const d = this.drag;
    if (!d) return;
    const x = d.p.x.value, y = d.p.y.value;
    if (this.stageIdx === 0) {
      const c = this.cellAt(x, y + 16);                              // soft-grid preview: the cell under the flower
      if (c.r >= 0) {
        const p = this.cellWorld({ ...c, onBed: true });
        ctx.save(); ctx.fillStyle = 'rgba(255,240,200,0.22)'; ctx.beginPath(); ctx.ellipse(p.x, p.y, 50 * p.depth, 18 * p.depth, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        this.drawFlower(ctx, d.type, x, y + 16, FLOWER_H * p.depth * 1.05);
      } else this.drawFlower(ctx, d.type, x, y + 16, FLOWER_H * 1.05);
    } else {
      const c = this.cellAt(x, y + 16);
      if (c.r >= 0) { const p = this.cellWorld(c); ctx.save(); ctx.fillStyle = 'rgba(255,240,200,0.3)'; ctx.fillRect(p.x - FRAME.cell / 2, p.y - FRAME.cell / 2, FRAME.cell, FRAME.cell); ctx.restore(); }
      this.drawTile(ctx, x, y, FRAME.cell * 1.08);
    }
  }

  /** PROP_MIRROR_GHOST: the 4×4 breathing ghost-flower loop (black bg, additive) over a flower cell. */
  drawMirrorGhost(ctx, p, alpha, phase = 0) {
    const gh = this.img('mirror_ghost'); if (!gh || alpha <= 0.01) return;
    // The generated sheet is one flower at 16 brightness levels, not in playing order (11 → 12 and 15 → 0 jump).
    // Play the frames sorted by measured brightness as a ping-pong: a smooth breathing pulse with no jump.
    const k = Math.floor(this.t * 10 + phase) % 30, f = GHOST_ORDER[k < 16 ? k : 30 - k];
    const cw = gh.width / 4, sz = FLOWER_H * 1.35 * p.depth;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, alpha);
    ctx.drawImage(gh, (f % 4) * cw, Math.floor(f / 4) * cw, cw, cw, p.x - sz / 2, p.y - sz * 0.82, sz, sz);
    ctx.restore();
  }
  drawFx(ctx, f) {
    if (f.kind === 'wrong') {                   // the flower stands for a moment, wobbles, and floats back to the tray
      const home = this.stageIdx === 0 ? this.traySlot(TYPES.indexOf(f.type)) : { x: TILE_BOX.x, y: TILE_BOX.y - 40 };
      const back = Math.max(0, (f.t - 0.6) / 0.4), x = lerp(f.x, home.x, back), y = lerp(f.y, home.y, back);
      const rot = Math.sin(f.t * 24) * 0.12 * Math.max(0, 1 - f.t / 0.6);
      if (this.stageIdx === 0) this.drawFlower(ctx, f.type, x, y, FLOWER_H * lerp(f.depth, 0.92, back), { rot, alpha: 1 - back * 0.3 });
      else this.drawTile(ctx, x, y, FRAME.cell - 4, { alpha: 1 - back * 0.3 });
    } else if (f.kind === 'ghost') {            // Ghost Mirror: glow + faded flower + the PROP_MIRROR_GHOST loop (batch 10)
      const p = this.cellWorld(f), a = Math.min(1, f.t / 0.25) * Math.max(0, 1 - Math.max(0, f.t - 1.2) / 0.6);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(p.x, p.y - 50 * p.depth, 4, p.x, p.y - 50 * p.depth, 90 * p.depth);
      g.addColorStop(0, `rgba(190,220,255,${0.45 * a})`); g.addColorStop(1, 'rgba(190,220,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y - 50 * p.depth, 90 * p.depth, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      if (this.stageIdx === 0) this.drawFlower(ctx, f.type, p.x, p.y, FLOWER_H * p.depth, { alpha: 0.5 * a });
      if (this.stageIdx === 0) this.drawMirrorGhost(ctx, p, a);
      else this.drawTile(ctx, p.x, p.y, FRAME.cell - 4, { alpha: 0.5 * a, ghost: true });
    } else if (f.kind === 'return') {
      const home = this.stageIdx === 0 ? this.traySlot(Math.max(0, TYPES.indexOf(f.type))) : { x: TILE_BOX.x, y: TILE_BOX.y - 40 }, k = f.t / 0.4;
      ctx.globalAlpha = 1 - k * 0.5;
      if (this.stageIdx === 0) this.drawFlower(ctx, f.type, lerp(f.x, home.x, k), lerp(f.y, home.y, k), FLOWER_H * 0.95);
      else this.drawTile(ctx, lerp(f.x, home.x, k), lerp(f.y, home.y, k), FRAME.cell - 4);
      ctx.globalAlpha = 1;
    } else if (f.kind === 'sparkle') {
      const k = f.t / 0.9;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 7; i++) {
        const an = i / 7 * Math.PI * 2 + f.t, r = 20 + 60 * k * f.depth;
        ctx.fillStyle = `rgba(255,230,160,${0.8 * (1 - k)})`;
        ctx.beginPath(); ctx.arc(f.x + Math.cos(an) * r, f.y - 40 * f.depth + Math.sin(an) * r * 0.5, 4 * (1 - k) + 1.5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
  }

  drawLumi(ctx) {
    const lm = this.lumi, x = lm.p.x.value, y = lm.p.y.value;
    const pulse = 1 + 0.06 * Math.sin(this.t * 5) + (lm.mode === 'celebrate' ? 0.1 * Math.sin(this.t * 14) : 0);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y, 4, x, y, 90 * pulse);
    g.addColorStop(0, 'rgba(255,230,170,0.55)'); g.addColorStop(1, 'rgba(255,200,120,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 90 * pulse, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    const img = this.img('lumi_front'), s = 0.42 * pulse;
    if (img) ctx.drawImage(img, x - 128 * s, y - 128 * s, 256 * s, 256 * s);
  }

  drawHud(ctx) {
    const S = this.sprites, text = this.objective();
    ctx.save();
    ctx.font = '700 38px LumaFa, Vazirmatn, Tahoma, sans-serif'; ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = ctx.measureText(text).width + 90;
    ctx.fillStyle = 'rgba(250,240,215,0.93)'; ctx.strokeStyle = 'rgba(150,110,50,0.8)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(W / 2 - w / 2, 34, w, 74, 20); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#4a3418'; ctx.fillText(text, W / 2, 73);
    if (this.bubble) {
      const a = Math.min(1, this.bubble.t / 0.3); ctx.globalAlpha = a;
      ctx.font = '700 34px LumaFa, Vazirmatn, Tahoma, sans-serif';
      const bw = ctx.measureText(this.bubble.text).width + 80;
      ctx.fillStyle = 'rgba(255,248,226,0.96)'; ctx.strokeStyle = 'rgba(214,170,80,0.95)';
      ctx.beginPath(); ctx.roundRect(W / 2 - bw / 2, 160, bw, 66, 33); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#5a3e14'; ctx.fillText(this.bubble.text, W / 2, 194); ctx.globalAlpha = 1;
    }
    ctx.restore();
    const pr = this.pressT || {}, done = this.ctrl.phaseDone;
    drawHudButton(ctx, S, 'btn_hint', BTN.hint, BTN_R, { disabled: done || this.ended, available: this.hints.available, pressed: pr.hint, t: this.t });
    drawHudButton(ctx, S, 'btn_undo', BTN.undo, BTN_R, { disabled: done || this.ended || !this.ctrl.undoStack.length, pressed: pr.undo, t: this.t });
    drawHudButton(ctx, S, 'btn_reset', BTN.reset, BTN_R, { disabled: done && !this.ended, available: this.ended, pressed: pr.reset, t: this.t });
    // wordless progress: bed · vertical axis · horizontal axis
    const steps = [this.stageIdx > 0 || this.bed.solved, this.stageIdx === 1 && (this.ctrl.pi > 0 || this.ctrl.phaseDone), this.stageIdx === 1 && this.ctrl.solved];
    const cur = this.stageIdx === 0 ? 0 : 1 + this.ctrl.pi;
    steps.forEach((d, k) => {
      ctx.fillStyle = d ? 'rgba(255,200,90,0.95)' : k === cur ? 'rgba(255,240,210,0.9)' : 'rgba(255,240,210,0.35)';
      ctx.beginPath(); ctx.arc(W / 2 - 28 + k * 28, 128, k === 0 ? 9 : 6.5, 0, Math.PI * 2); ctx.fill();
    });
    if (this.ended && this.onExit && !this.fade) drawExitArrow(ctx, EXIT, this.t, reduceMotion);
    if (this.fade) { ctx.fillStyle = `rgba(22,16,10,${(1 - this.fade.a) * 0.85})`; ctx.fillRect(0, 0, W, H); }
    if (this.leaving) { ctx.fillStyle = `rgba(20,12,6,${this.leaving.a})`; ctx.fillRect(0, 0, W, H); }
  }

  debugState() {
    return {
      puzzle: this.stage.puzzle_id, phase: `${this.phase.phase_id} (${this.phase.axis})`,
      missing: this.ctrl.missing().map(key).join(' ') || '-', placed: this.ctrl.undoStack.length,
      hint_level: this.hints.level, hint_available: this.hints.available, wrong: this.hints.wrong, assist: this.ctrl.assist,
      flagged: [...this.misc.flagged].join(',') || '-', mastery: this.mastery.get(this.puzzle.concept_id),
      world: Object.keys(this.save.data.world).join(',') || '-', music_layers: this.audio.layers,
    };
  }
}
