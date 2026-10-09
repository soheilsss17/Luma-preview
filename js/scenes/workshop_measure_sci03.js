// LUMA — Room WS_MEASURE / card SCI-03 «اندازه‌گیری مواد» (science grade 3, lesson «اندازه‌گیری مواد», C306 ۱۴۰۵;
// plan 04 §2 row SCI-03, plan 12): the workshop's measuring room. Three materials wait on the observation tray, and
// for each one the child does what the card says — MEASURE_SELECT_USE_RECORD: SELECT a tool, USE it by its own rule,
// RECORD the reading. ترازو reads جرم (add unit weights until the pans are level — the count IS the mass,
// «جرم Rule-based»), ظرف مدرج reads حجم (pour, then read with the eye level with the surface — «حجم کنترل‌شده»),
// خط‌کش reads درازا (zero against the near end, read the far end).
//
// The card's misconception is SCI_ONE_TOOL_MEASURES_ALL: a child who reaches for the ruler to measure water. Picking
// the wrong tool is refused with a reason and never with a number — a number would feed exactly the wrong idea.
// Concluding before the rows are written is the same «مشاهده = نتیجه» the science cards share.
//
// Rules: edu/measure_rules.js · controller: puzzles/measure.js · content: Content/Puzzles/SCI-03.puzzle.json
import { drawHudButton, drawExitArrow, PRESS_S } from '../engine/hud.js';
import { MisconceptionEngine, HintEngine, MasteryEngine, AnalyticsQueue, SaveSlot } from '../edu/engines.js';
import { Spring, Spring2, Timeline } from '../engine/motion.js';
import { RigActor } from '../engine/rig.js';
import { MeasureController } from '../puzzles/measure.js';
import { TOOLS, QUANTITY_FA, UNIT_FA } from '../edu/measure_rules.js';
import { faDigits } from '../engine/strings.js';

export const W = 1920, H = 1080;
const FONT = 'LumaFa, Vazirmatn, Tahoma, sans-serif';

// ---- layout (world = screen; plan 14 §4.1: the child stands in front of the bench)
export const BENCH = { y: 806, x0: 220, x1: 1700 };              // the bench top line
export const WORK = { x: 900, footY: 806, w: 470 };              // the chosen tool stands here
export const RAIL = { y: 1014, x0: 330, gap: 208, w: 196 };      // the three tools to choose from (a low shelf)
export const TRAY = { x: 1620, footY: 1016, w: 236 };            // the observation tray with the material
export const NOTE = { x: 1548, y: 232, w: 348, h: 672 };         // the record card
export const READ_BTN = { x: 1178, y: 962, r: 62 };              // «بخوان»
export const REC_BTN = { x: 1332, y: 962, r: 62 };               // «ثبت کن»
export const CONC_BTN = { x: 1486, y: 962, r: 62 };              // «نتیجه»
export const STEP_BTN = { plus: { x: 318, y: 962, r: 54 }, minus: { x: 198, y: 962, r: 54 } };   // +وزنه / −وزنه, بریز / کم کن
export const EYE_HIT = { x: 1252, w: 190 };                      // the eye-level band handle (right of the glass)
export const STICK = { x0: 700, x1: 1120, y: 664 };              // the stick lies on the bench, above the ruler
export const UNIT_PX = 60;                                       // one unit of length in px (the stick is 7 units)
export const RULER = { footY: 792, w: 620 };
export const RAIL_STEPS = ['انتخابِ ابزار', 'اندازه‌گیری', 'ثبت', 'نتیجه'];
export const BTN = { hint: { x: 90, y: 90 }, undo: { x: 220, y: 90 }, reset: { x: 350, y: 90 } };
const BTN_R = 58;
export const EXIT = { x: 1832, y: 985, r: 95 };

// the balance sprite (art/final/WORKSHOP/PROP_BALANCE_SCALE__BASE.png, 1024²) measured with tools/slice_sheet.py's
// trick: the beam spans bands y 365–512, the two pans hang at x ≈ 0.18 / 0.82 of the canvas with their bowls at
// y ≈ 0.75. The weights and the material are placed from those numbers, so they sit on the pans and not beside them.
const PAN = { dx: 0.32, dy: 0.25 };
// the measuring cylinder (PROP_MEASURING_CONTAINER__BASE, 1024²): the glass interior is x 0.24–0.76, y 0.16–0.94.
const GLASS = { x0: 0.25, x1: 0.75, y0: 0.18, y1: 0.93 };

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const lerp = (a, b, t) => a + (b - a) * t;

export class WorkshopMeasureSci03 {
  constructor({ sprites, puzzle, audio, storage, debug, strings, onExit }) {
    Object.assign(this, { sprites, puzzle, audio, debug, strings, onExit });
    this.save = new SaveSlot(storage);
    this.mastery = new MasteryEngine(storage);
    this.analytics = new AnalyticsQueue(storage, puzzle.analytics_fields);
    this.tl = new Timeline();
    this.t = 0; this.attempt = 0; this.drag = null; this.sparks = [];
    this.alive = new Spring(0, { stiffness: 4, damping: 5 });     // the room wakes up when the card is solved
    this.tip = new Spring(0, { stiffness: 60, damping: 9 });      // the balance beam: −1 left … +1 right
    this.water = new Spring(0, { stiffness: 26, damping: 8 });    // the water column, in units
    this.eye = new Spring(0, { stiffness: 30, damping: 9 });      // the eye-level band, in units
    this.rulerX = new Spring(STICK.x0, { stiffness: 90, damping: 14 });
    this.note = new Spring(0, { stiffness: 10, damping: 8 });     // the row just written
    this.glow = new Spring(0, { stiffness: 12, damping: 7 });
    this.lumi = { p: new Spring2(300, 300, { stiffness: 26, damping: 9 }), mode: 'follow' };
    this.ended = false; this.bubble = null; this.card = null; this.shake = 0; this.fade = 0;
    this.eyeDrag = false; this.press = null; this.hintFx = null; this.step = 0;
  }

  async load() {
    this.tiko = await new RigActor({ id: 'TIKO', scale: 0.17, x: 215, groundY: 1036, face: 1 }).load();
    this.actors = [this.tiko];
    try { this.lumia = await new RigActor({ id: 'LUMI', scale: 0.2, x: 1600, groundY: 300, face: -1 }).load(); this.actors.push(this.lumia); }
    catch (e) { this.lumia = null; }
    const done = this.puzzle.stages.map((s) => { const p = this.save.puzzle(s.puzzle_id); return !!(p && p.solved); });
    if (done.every(Boolean)) this.startStage(this.puzzle.stages.length - 1, { finished: true });
    else this.startStage(done.indexOf(false));
    return this;
  }

  // ================================================================= flow
  startStage(idx, { finished = false } = {}) {
    this.stageIdx = idx; this.stage = this.puzzle.stages[idx];
    this.ctrl = new MeasureController(this.stage, {
      onTool: (id) => { this.audio.pickup(); this.step = 1; this.bubble = { text: `${TOOLS[id].fa} را برداشتی.`, until: this.t + 2.2 }; },
      onUse: (what) => { if (what === 'weight') this.audio.woodClick(); else if (what === 'pour') this.audio.ceramic(); else this.audio.tick(); },
      onRead: (r) => this.onRead(r),
      onRefuse: (rule, d) => this.onRefuse(rule, d),
      onRecord: (row) => this.onRecord(row),
      onReady: () => { this.step = 3; this.bubble = { text: 'حالا می‌توانی نتیجه بگیری', until: this.t + 3.4 }; this.audio.chime(); },
      onSolved: () => this.onSolved(),
      onWrongConclusion: () => { this.shake = 0.5; this.audio.clunk(); this.misc.observe('wrong_tool'); this.log('conclude_wrong', {}); },
      onGuess: (id) => { this.audio.tick(); this.log('guess', { tool: id }); },
      log: (n, p) => this.log(n, p),
    });
    this.misc = new MisconceptionEngine(this.puzzle.misconceptions, 2);
    this.hints = new HintEngine(this.stage.hints, this.stage.answer_assist);
    this.attempt++; this.stageAssisted = false; this.sparks = [];
    this.step = 0; this.busy = false; this.card = null; this.guessCard = null; this.concludeCard = null;
    this.bubble = { text: this.stage.objective_fa, until: this.t + 6 };
    this.tip.set(0); this.tip.target = 0; this.water.set(0); this.water.target = 0;
    this.eye.set(0); this.eye.target = 0; this.glow.set(0); this.glow.target = 0;
    this.rulerX.set(STICK.x0); this.rulerX.target = STICK.x0;
    if (finished) {
      this.ctrl.finishAll();
      this.alive.set(1); this.alive.target = 1; this.glow.set(1); this.glow.target = 1;
      this.ended = true; this.audio.setLayers(4); this.step = 3;
      return;
    }
    this.ended = false;
  }

  onRead(r) {
    this.step = 2;
    if (r.rule === 'wrong_tool') {
      this.misc.observe('wrong_tool');
      this.shake = 0.5; this.audio.clunk();
      this.bubble = { text: r.reason_fa, until: this.t + 5 };
      this.hints.target(1);
      return;
    }
    this.audio.snap();
    if (r.ok) this.audio.bell();
    else this.audio.thump();
    this.bubble = { text: (r.reading === null ? '—' : faDigits(r.reading)) + ' — ' + r.reason_fa, until: this.t + 4.2 };
  }

  onRefuse(rule, d) {
    this.shake = 0.6; this.audio.clunk();
    if (rule === 'NEED_RECORDS') {
      this.misc.observe('need_records');
      this.bubble = { text: 'اول اندازه‌ها را در دفترچه بنویس، بعد نتیجه بگیر.', until: this.t + 4.5 };
      this.hints.target(2);
    } else if (rule === 'NEED_GUESS') {
      this.bubble = { text: 'اول بگو با کدام ابزار اندازه می‌گیری.', until: this.t + 3.5 };
    } else if (rule === 'NOT_PLACED') {
      this.bubble = { text: 'اول ماده را روی ابزار بگذار.', until: this.t + 3 };
    } else if (rule === 'NOT_READY') {
      this.bubble = { text: this.ctrl.pending ? this.ctrl.pending.reason_fa : 'هنوز درست نیست.', until: this.t + 3.6 };
    }
    this.log('refused', { rule, d });
  }

  onRecord(row) {
    this.note.set(0); this.note.target = 1; this.audio.stamp();
    this.bubble = { text: `ثبت شد: ${row.material_fa} = ${faDigits(row.reading)} ${UNIT_FA[row.quantity]}`, until: this.t + 3 };
    this.step = this.ctrl.readyToConclude() ? 3 : 0;
    this.tip.target = 0; this.water.target = 0; this.eye.target = 0; this.rulerX.target = STICK.x0;
  }

  onSolved() {
    this.ended = true; this.card = null; this.concludeCard = null;
    this.audio.motif(); this.audio.setLayers(4);
    this.alive.target = 1; this.glow.target = 1;
    this.spawnSparks(200);
    this.save.setFlag(this.puzzle.world_state_on_solve);
    this.save.setPuzzle(this.stage.puzzle_id, { solved: true, hint_max: this.hints.maxUsed, assisted: this.stageAssisted });
    this.save.save();
    this.mastery.record(this.puzzle.concept_id, { stage: this.stage.stage, hints: this.hints.maxUsed, misconceptions: [...this.misc.flagged] }, this.misc.flagged);
    this.bubble = { text: this.stage.transfer_note_fa || 'آفرین! هر ابزار اندازهٔ خودش را نشان داد.', until: this.t + 6 };
    this.log('puzzle_solved', { stage: this.stage.puzzle_id, hints: this.hints.maxUsed });
    const last = this.stageIdx >= this.puzzle.stages.length - 1;
    if (!last) this.tl.after(2.6, () => this.nextStage());
    else this.tl.after(2.2, () => { this.bubble = { text: 'کارگاهِ اندازه‌گیری دوباره جان گرفت.', until: this.t + 5 }; });
  }

  nextStage() {
    if (this.stageIdx >= this.puzzle.stages.length - 1) return;
    this.fade = 1;
    this.tl.after(0.45, () => { this.startStage(this.stageIdx + 1); this.fade = 0; });
  }

  leave() { this.onExit && this.onExit(); }

  log(name, extra) {
    const e = { name, t: +this.t.toFixed(2), stage: this.stage && this.stage.puzzle_id, ...extra };
    this.analytics.log(name, e);
    if (Array.isArray(this.debug)) this.debug.push(e);
  }

  // ================================================================= geometry
  /** The three tools on the shelf (the child picks one). */
  railSlots() { return this.ctrl.tools().map((t, i) => ({ id: t.id, tool: t, x: RAIL.x0 + i * RAIL.gap, y: RAIL.y })); }
  railHit(x, y) { return this.railSlots().find((s) => Math.hypot(x - s.x, y - s.y) < 104) || null; }
  /** The pan centres of the balance, from the measured sprite (see PAN above). */
  pans() {
    const w = WORK.w, y = WORK.footY - PAN.dy * w;
    return { left: { x: WORK.x - PAN.dx * w, y }, right: { x: WORK.x + PAN.dx * w, y }, r: w * 0.115 };
  }
  /** The glass interior of the cylinder, in world px. */
  glass() {
    const top = WORK.footY - WORK.w, h = WORK.w;
    return { x0: WORK.x - WORK.w / 2 + GLASS.x0 * WORK.w, x1: WORK.x - WORK.w / 2 + GLASS.x1 * WORK.w,
             y0: top + GLASS.y0 * h, y1: top + GLASS.y1 * h };
  }
  levelY(units, cap) { const g = this.glass(); return lerp(g.y1, g.y0, clamp01(units / (cap || 8))); }
  /** The eye-level band is only «true» when it sits on the surface: the card's controlled step. */
  eyeSynced() {
    const cap = (this.ctrl.job() && this.ctrl.job().capacity) || 8;
    return Math.abs(this.eye.value - this.water.value) < 0.14;
  }
  stickUnits() { const j = this.ctrl.job(); return j && j.length ? j.length : 7; }

  // ================================================================= interaction
  pointerDown(sx, sy) {
    this.px = sx; this.py = sy;
    if (this.guessCard) { this.tapGuess(sx, sy); return; }
    if (this.concludeCard) { this.tapConclude(sx, sy); return; }
    const b = ['hint', 'undo', 'reset'].find((n) => Math.hypot(sx - BTN[n].x, sy - BTN[n].y) < BTN_R);
    if (b) { this.press = { b, t: PRESS_S }; this.doButton(b); return; }
    if (this.ended && Math.hypot(sx - EXIT.x, sy - EXIT.y) < EXIT.r) { this.leave(); return; }
    if (Math.hypot(sx - READ_BTN.x, sy - READ_BTN.y) < READ_BTN.r) { this.press = { b: 'read', t: PRESS_S }; this.doRead(); return; }
    if (Math.hypot(sx - REC_BTN.x, sy - REC_BTN.y) < REC_BTN.r) { this.press = { b: 'record', t: PRESS_S }; this.doRecord(); return; }
    if (Math.hypot(sx - CONC_BTN.x, sy - CONC_BTN.y) < CONC_BTN.r) { this.press = { b: 'conclude', t: PRESS_S }; this.doConclude(); return; }
    const q = this.ctrl.jobQ();
    // the eye-level band: drag it up and down until it sits on the water surface
    if (q === 'volume' && sx > EYE_HIT.x - 40 && sx < EYE_HIT.x + EYE_HIT.w) { this.eyeDrag = true; this.pointerMove(sx, sy); return; }
    // the ruler: drag it until its zero mark is flush with the near end of the thing
    if (q === 'length' && this.ctrl.placed && sy > RULER.footY - 150 && sy < RULER.footY + 40
        && sx > this.rulerX.value - 60 && sx < this.rulerX.value + RULER.w + 60) { this.drag = { kind: 'ruler', dx: sx - this.rulerX.value }; return; }
    if (q === 'mass' && this.ctrl.tool === 'balance') {
      if (Math.hypot(sx - STEP_BTN.plus.x, sy - STEP_BTN.plus.y) < STEP_BTN.plus.r) { this.press = { b: 'plus', t: PRESS_S }; this.ctrl.addWeight(); this.afterUse(); return; }
      if (Math.hypot(sx - STEP_BTN.minus.x, sy - STEP_BTN.minus.y) < STEP_BTN.minus.r) { this.press = { b: 'minus', t: PRESS_S }; this.ctrl.removeWeight(); this.afterUse(); return; }
    }
    if (q === 'volume' && this.ctrl.tool === 'cylinder') {
      if (Math.hypot(sx - STEP_BTN.plus.x, sy - STEP_BTN.plus.y) < STEP_BTN.plus.r) { this.press = { b: 'plus', t: PRESS_S }; this.ctrl.pour(1); this.afterUse(); return; }
      if (Math.hypot(sx - STEP_BTN.minus.x, sy - STEP_BTN.minus.y) < STEP_BTN.minus.r) { this.press = { b: 'minus', t: PRESS_S }; this.ctrl.pour(-1); this.afterUse(); return; }
    }
    if (q !== 'volume' && !this.ctrl.placed && Math.hypot(sx - TRAY.x, sy - (TRAY.footY - 130)) < 130) {
      this.ctrl.put(); this.audio.pickup(); this.step = 1;
      this.bubble = { text: `${(this.ctrl.job() || {}).material_fa} روی ابزار رفت. حالا اندازه بگیر.`, until: this.t + 3 };
      this.log('material_placed', { job: (this.ctrl.job() || {}).id });
      return;
    }
    const r = this.railHit(sx, sy);
    if (r) { this.ctrl.selectTool(r.id); this.log('tool_tapped', { tool: r.id }); return; }
  }

  pointerMove(sx, sy) {
    this.px = sx; this.py = sy;
    if (this.eyeDrag) {
      const cap = (this.ctrl.job() && this.ctrl.job().capacity) || 8;
      const g = this.glass();
      const u = clamp01((g.y1 - sy) / (g.y1 - g.y0)) * cap;
      this.eye.set(u); this.eye.target = u;
      this.ctrl.setEyeLevel(this.eyeSynced());
      return;
    }
    if (this.drag && this.drag.kind === 'ruler') {
      const lo = STICK.x0 - 4 * UNIT_PX, hi = STICK.x0;
      const x = Math.max(lo, Math.min(hi, sx - this.drag.dx));
      this.rulerX.set(x); this.rulerX.target = x;
      this.ctrl.setOffset(Math.round((STICK.x0 - x) / UNIT_PX));
    }
  }

  pointerUp() {
    if (this.eyeDrag) { this.eyeDrag = false; this.audio.tick(); return; }
    if (this.drag && this.drag.kind === 'ruler') {
      this.drag = null;
      this.audio.woodClick();
      const off = Math.round((STICK.x0 - this.rulerX.value) / UNIT_PX);
      this.ctrl.setOffset(off);
      return;
    }
  }

  afterUse() {
    const q = this.ctrl.jobQ();
    if (q === 'mass') {
      const j = this.ctrl.job();
      const d = this.ctrl.weights - j.target;
      this.tip.target = d === 0 ? 0 : (d > 0 ? 1 : -1);
    }
    if (q === 'volume') this.water.target = this.ctrl.level;
  }

  doButton(b) {
    if (b === 'hint') { this.hintNow(); return; }
    if (b === 'undo') { if (this.ctrl.undo() && !this.ended) { this.audio.woodClick(); this.afterUse(); } return; }
    if (b === 'reset') {
      this.ctrl.reset(); this.audio.woodClick(); this.step = 0;
      this.tip.target = 0; this.water.target = 0; this.eye.target = 0; this.rulerX.target = STICK.x0;
    }
  }

  doRead() {
    if (this.busy) return;
    if (this.stage.require_guess && !this.ctrl.guess && !this.ended) {
      this.guessCard = { t: 0 }; this.onRefuse('NEED_GUESS', []); return;
    }
    const r = this.ctrl.read();
    if (r && r.refused) return;
    this.step = r ? 2 : this.step;
  }

  doRecord() {
    if (!this.ctrl.pending) { this.audio.thump(); this.bubble = { text: 'اول بخوان، بعد ثبت کن.', until: this.t + 2.6 }; return; }
    this.ctrl.record();
  }

  doConclude() {
    if (!this.ctrl.readyToConclude()) { this.ctrl.conclude(null); return; }
    this.concludeCard = { t: 0 };
  }

  tapGuess(x, y) {
    const opts = this.stage.guess_options || [];
    for (let i = 0; i < opts.length; i++) {
      const r = { x: 720, y: 452 + i * 96, w: 480, h: 78 };
      if (x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h) {
        this.ctrl.setGuess(opts[i].id);
        this.ctrl.selectTool(opts[i].id);
        this.guessCard = null; this.step = 1;
        return;
      }
    }
  }

  tapConclude(x, y) {
    const opts = this.stage.conclusion_options || [];
    for (let i = 0; i < opts.length; i++) {
      const r = { x: 620, y: 372 + i * 104, w: 680, h: 86 };
      if (x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h) {
        const res = this.ctrl.conclude(opts[i].id);
        if (res && res.refused) { this.concludeCard = null; return; }
        if (res && res.ok) this.concludeCard = null;
        return;
      }
    }
  }

  hintNow() {
    const h = this.hints.request();
    if (!h) return;
    this.audio.hint();
    const key = h.text_key || '';
    const text = this.strings && this.strings.has(key) ? this.strings.t(key) : (h.animation || 'یک بار دیگر نگاه کن.');
    this.bubble = { text, until: this.t + 5.5, hint: true };
    this.hintFx = { t: 0, target: h.target || 'bench' };
    if (h.level >= 3) { this.ctrl.assist = true; this.stageAssisted = true; }
    this.log('hint_used', { level: h.level });
  }

  spawnSparks(n = 120) {
    const cx = WORK.x, cy = WORK.footY - 240;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = 60 + Math.random() * 220;
      this.sparks.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, a: 1, r: 2 + Math.random() * 4, c: [255, 214, 130] });
    }
  }

  // ================================================================= update
  update(dt) {
    this.t += dt;
    this.tl.update(dt);
    for (const s of [this.alive, this.tip, this.water, this.eye, this.rulerX, this.note, this.glow]) s.update(dt);
    this.note.target = 0;
    if (this.press) { this.press.t -= dt; if (this.press.t <= 0) this.press = null; }
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 1.6);
    if (this.bubble && this.t > this.bubble.until) this.bubble = null;
    if (this.hintFx) { this.hintFx.t += dt; if (this.hintFx.t > 3) this.hintFx = null; }
    this.hints.tick(dt);
    for (const s of this.sparks) { s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 260 * dt; s.a -= dt * 0.8; }
    this.sparks = this.sparks.filter((s) => s.a > 0);
    if (this.lumia) {
      const target = this.step >= 2 ? { x: NOTE.x - 130, y: NOTE.y + 140 } : { x: WORK.x + 260, y: WORK.footY - 380 };
      this.lumi.p.to(target.x, target.y);
      this.lumia.x = this.lumi.p.x.value; this.lumia.y = this.lumi.p.y.value;
      this.lumia.update(dt);
    }
    this.tiko.update(dt);
  }

  // ================================================================= draw
  draw(ctx) {
    ctx.save();
    if (this.shake > 0) ctx.translate(Math.sin(this.t * 60) * this.shake * 9, 0);
    const plate = this.sprites.get('ws_measure'), on = this.sprites.get('ws_measure_on');
    if (plate) ctx.drawImage(plate, 0, 0, W, H);
    if (on && this.alive.value > 0.01) { ctx.globalAlpha = clamp01(this.alive.value); ctx.drawImage(on, 0, 0, W, H); ctx.globalAlpha = 1; }
    ctx.fillStyle = `rgba(14,12,24,${0.26 - 0.22 * this.alive.value})`; ctx.fillRect(0, 0, W, H);
    this.drawBench(ctx);
    this.drawToolRail(ctx);
    this.drawWorkTool(ctx);
    this.drawMaterial(ctx);
    this.drawNotebook(ctx);
    this.drawSteps(ctx);
    this.drawButtons(ctx);
    this.drawBubble(ctx);
    for (const a of this.actors) a.draw(ctx);
    this.drawSparks(ctx);
    if (this.guessCard) this.drawGuess(ctx);
    if (this.concludeCard) this.drawConclude(ctx);
    if (this.ended) drawExitArrow(ctx, EXIT, this.t, true);
    if (this.fade > 0) { ctx.fillStyle = `rgba(8,6,16,${this.fade})`; ctx.fillRect(0, 0, W, H); }
    ctx.restore();
  }

  drawBench(ctx) {
    const g = ctx.createLinearGradient(0, BENCH.y, 0, BENCH.y + 150);
    g.addColorStop(0, 'rgba(124,90,54,0.95)'); g.addColorStop(1, 'rgba(58,40,24,0.95)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.roundRect(BENCH.x0 - 40, BENCH.y, BENCH.x1 - BENCH.x0 + 80, 150, 18); ctx.fill();
    ctx.fillStyle = 'rgba(228,196,140,0.22)'; ctx.fillRect(BENCH.x0 - 40, BENCH.y, BENCH.x1 - BENCH.x0 + 80, 10);
    // the low shelf the tools stand on
    ctx.fillStyle = 'rgba(46,32,20,0.9)';
    ctx.beginPath(); ctx.roundRect(RAIL.x0 - 130, RAIL.y + 30, RAIL.gap * 2 + 300, 26, 10); ctx.fill();
  }

  drawToolRail(ctx) {
    for (const s of this.railSlots()) {
      const chosen = this.ctrl.tool === s.id;
      ctx.save();
      ctx.globalAlpha = chosen ? 1 : 0.92;
      this.drawSprite(ctx, `tool_${s.id}`, s.x, s.y, RAIL.w);
      ctx.restore();
      ctx.fillStyle = chosen ? 'rgba(255,226,150,0.95)' : 'rgba(255,238,205,0.6)';
      ctx.font = `700 26px ${FONT}`; ctx.direction = 'rtl'; ctx.textAlign = 'center';
      ctx.fillText(s.tool.fa, s.x, s.y + 46);
      if (chosen) {
        ctx.strokeStyle = 'rgba(255,226,150,0.9)'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.roundRect(s.x - RAIL.w * 0.62, s.y - RAIL.w * 1.05, RAIL.w * 1.24, RAIL.w * 1.24, 18); ctx.stroke();
      }
    }
  }

  /** The chosen tool, drawn large on the bench with the quantity it is being used for. */
  drawWorkTool(ctx) {
    if (!this.ctrl.tool) {
      ctx.fillStyle = 'rgba(255,238,205,0.45)'; ctx.font = `600 30px ${FONT}`; ctx.direction = 'rtl'; ctx.textAlign = 'center';
      ctx.fillText('یک ابزار از قفسه بردار', WORK.x, WORK.footY - 200);
      return;
    }
    const q = this.ctrl.jobQ();
    if (this.ctrl.tool === 'balance') this.drawBalance(ctx);
    else if (this.ctrl.tool === 'cylinder') this.drawCylinder(ctx);
    else this.drawRulerTool(ctx);
    if (q) {
      ctx.fillStyle = 'rgba(255,238,205,0.7)'; ctx.font = `600 26px ${FONT}`; ctx.direction = 'rtl'; ctx.textAlign = 'center';
      ctx.fillText(`${QUANTITY_FA[q]}ِ ${(this.ctrl.job() || {}).material_fa || ''}`, WORK.x, WORK.footY - 30);
    }
  }

  drawBalance(ctx) {
    const v = this.tip.value;
    const state = v > 0.35 ? 'tool_balance_right' : (v < -0.35 ? 'tool_balance_left' : 'tool_balance');
    ctx.save();
    ctx.translate(WORK.x, WORK.footY);
    ctx.rotate(v * 0.035);
    ctx.translate(-WORK.x, -WORK.footY);
    this.drawSprite(ctx, state, WORK.x, WORK.footY, WORK.w);
    ctx.restore();
    const p = this.pans();
    // the unit weights stack on the left pan; each one is one «وزنه»
    for (let i = 0; i < this.ctrl.weights; i++) {
      this.drawSprite(ctx, 'unit_marker', p.left.x, p.left.y - i * 26 - p.r * 0.2, 54);
    }
    if (this.ctrl.placed) {
      const j = this.ctrl.job();
      this.drawSprite(ctx, j.sprite, p.right.x, p.right.y - p.r * 0.2, Math.min(150, p.r * 2.1));
    }
    ctx.fillStyle = 'rgba(255,238,205,0.85)'; ctx.font = `700 30px ${FONT}`; ctx.direction = 'rtl'; ctx.textAlign = 'center';
    ctx.fillText(`${faDigits(this.ctrl.weights)} ${UNIT_FA.mass}`, p.left.x - 10, p.left.y + 92);
  }

  drawCylinder(ctx) {
    this.drawSprite(ctx, 'tool_cylinder', WORK.x, WORK.footY, WORK.w);
    const g = this.glass();
    const cap = (this.ctrl.job() && this.ctrl.job().capacity) || 8;
    const y = this.levelY(this.water.value, cap);
    // the water is drawn by the engine: it has to rise one unit at a time, and no sprite is generated per unit
    if (this.water.value > 0.01) {
      ctx.save();
      ctx.beginPath(); ctx.roundRect(g.x0, y, g.x1 - g.x0, g.y1 - y + 2, [6, 6, 26, 26]); ctx.clip();
      const wg = ctx.createLinearGradient(0, y, 0, g.y1);
      wg.addColorStop(0, 'rgba(126,203,224,0.92)'); wg.addColorStop(1, 'rgba(52,140,180,0.95)');
      ctx.fillStyle = wg;
      ctx.fillRect(g.x0, y - 4, g.x1 - g.x0, g.y1 - y + 12);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(g.x0, y - 4, g.x1 - g.x0, 6 + Math.sin(this.t * 3) * 2);
      ctx.restore();
    }
    // the unit marks of the glass, drawn from the same unit token so the child counts what they read
    for (let i = 1; i <= cap; i++) {
      const yy = this.levelY(i, cap);
      ctx.strokeStyle = 'rgba(255,244,214,0.55)'; ctx.lineWidth = i % 2 ? 3 : 5;
      ctx.beginPath(); ctx.moveTo(g.x0 + 6, yy); ctx.lineTo(g.x0 + 34, yy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(g.x1 - 6, yy); ctx.lineTo(g.x1 - 34, yy); ctx.stroke();
    }
    // the eye-level band: only where the surface is does the number on the glass tell the truth
    const ey = this.levelY(this.eye.value, cap);
    const ok = this.eyeSynced();
    ctx.strokeStyle = ok ? 'rgba(150,235,170,0.95)' : 'rgba(255,180,120,0.85)';
    ctx.lineWidth = 5; ctx.setLineDash([16, 12]);
    ctx.beginPath(); ctx.moveTo(g.x0 - 30, ey); ctx.lineTo(g.x1 + 30, ey); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = ok ? 'rgba(150,235,170,0.95)' : 'rgba(255,180,120,0.9)';
    ctx.font = `700 26px ${FONT}`; ctx.direction = 'rtl'; ctx.textAlign = 'center';
    ctx.fillText(ok ? 'هم‌سطحِ چشم' : 'هم‌سطحِ آب کن', EYE_HIT.x + 40, ey - 18);
    ctx.fillStyle = 'rgba(255,238,205,0.85)'; ctx.font = `700 30px ${FONT}`;
    ctx.fillText(`${faDigits(Math.round(this.water.value))} ${UNIT_FA.volume}`, WORK.x, WORK.footY + 54);
  }

  drawRulerTool(ctx) {
    const j = this.ctrl.job();
    if (this.ctrl.placed && j && j.sprite) {
      this.drawSprite(ctx, j.sprite, (STICK.x0 + STICK.x1) / 2, STICK.y + 8, 420, -Math.PI / 2);
    }
    const x = this.rulerX.value;
    this.drawSprite(ctx, 'tool_ruler', x + RULER.w / 2, RULER.footY, RULER.w);
    // the zero mark and the unit marks live on the ruler the child drags
    const off = Math.round((STICK.x0 - x) / UNIT_PX);
    for (let i = 0; i <= 8; i++) {
      const mx = x + i * UNIT_PX;
      ctx.strokeStyle = i === 0 ? 'rgba(150,235,170,0.95)' : 'rgba(255,244,214,0.6)';
      ctx.lineWidth = i === 0 ? 6 : 4;
      ctx.beginPath(); ctx.moveTo(mx, RULER.footY - 84); ctx.lineTo(mx, RULER.footY - 40); ctx.stroke();
      if (i === 0) this.drawSprite(ctx, 'zero_marker', mx, RULER.footY - 30, 46);
    }
    const reading = off + this.stickUnits();
    ctx.fillStyle = off === 0 ? 'rgba(150,235,170,0.95)' : 'rgba(255,180,120,0.9)';
    ctx.font = `700 30px ${FONT}`; ctx.direction = 'rtl'; ctx.textAlign = 'center';
    ctx.fillText(off === 0 ? `${faDigits(reading)} ${UNIT_FA.length}` : 'از صفر شروع کن', x + RULER.w / 2, RULER.footY + 46);
  }

  drawMaterial(ctx) {
    const j = this.ctrl.job();
    this.drawSprite(ctx, 'observation_tray', TRAY.x, TRAY.footY, TRAY.w);
    if (!j) return;
    const placed = this.ctrl.placed || j.quantity === 'volume';
    if (!placed) this.drawSprite(ctx, j.sprite, TRAY.x, TRAY.footY - 40, 150);
    ctx.fillStyle = 'rgba(255,238,205,0.8)'; ctx.font = `700 26px ${FONT}`; ctx.direction = 'rtl'; ctx.textAlign = 'center';
    ctx.fillText(j.material_fa, TRAY.x, TRAY.footY + 52);
    ctx.font = `600 22px ${FONT}`; ctx.fillStyle = 'rgba(255,238,205,0.55)';
    ctx.fillText(`${QUANTITY_FA[j.quantity]}؟`, TRAY.x, TRAY.footY + 82);
  }

  drawNotebook(ctx) {
    const n = NOTE;
    // the card sprite is portrait (768×1024): drawn to NOTE.w it is ~464 px tall, so every line of the notebook is
    // laid out inside the box the sprite really occupies and not inside NOTE (the header would float above the card).
    const box = this.drawSprite(ctx, 'measure_card', n.x + n.w / 2, n.y + n.h, n.w)
      || { x: n.x, y: n.y + n.h - n.w, w: n.w, h: n.w };
    const cx = box.x + box.w / 2, colX = (f) => box.x + box.w * f;
    ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#4a3418'; ctx.font = `800 ${Math.round(box.h * 0.058)}px ${FONT}`;
    ctx.fillText('کارتِ ثبتِ اندازه', cx, box.y + box.h * 0.10);
    const cols = this.puzzle.notebook_columns || ['چه اندازه گرفتیم', 'با چه ابزاری', 'چند شد'];
    ctx.font = `700 ${Math.round(box.h * 0.042)}px ${FONT}`; ctx.fillStyle = 'rgba(74,52,24,0.75)';
    cols.forEach((c, i) => ctx.fillText(c, colX(0.80 - i * 0.26), box.y + box.h * 0.19));
    const rows = this.ctrl.rows, rowH = box.h * 0.135, y0 = box.y + box.h * 0.29;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i], y = y0 + i * rowH;
      const fresh = i === rows.length - 1 ? this.note.value : 0;
      ctx.fillStyle = `rgba(255,238,190,${0.22 + 0.55 * fresh})`;
      ctx.beginPath(); ctx.roundRect(box.x + 12, y - rowH * 0.42, box.w - 24, rowH * 0.84, 12); ctx.fill();
      ctx.fillStyle = 'rgba(60,42,20,0.95)';
      ctx.font = `700 ${Math.round(box.h * 0.046)}px ${FONT}`; ctx.fillText(faDigits(r.n), colX(0.92), y);
      ctx.font = `600 ${Math.round(box.h * 0.044)}px ${FONT}`; ctx.fillText(r.material_fa, colX(0.74), y);
      ctx.fillText(r.tool_fa, colX(0.46), y);
      ctx.font = `800 ${Math.round(box.h * 0.05)}px ${FONT}`; ctx.fillText(faDigits(r.reading), colX(0.18), y);
    }
    if (!rows.length) {
      ctx.fillStyle = 'rgba(74,52,24,0.5)'; ctx.font = `600 ${Math.round(box.h * 0.046)}px ${FONT}`;
      ctx.fillText('هنوز چیزی ثبت نشده', cx, y0 + rowH * 0.5);
    }
    ctx.textBaseline = 'alphabetic';
  }

  drawSteps(ctx) {
    const x0 = 470, gap = 300;
    for (let i = 0; i < RAIL_STEPS.length; i++) {
      const on = i <= Math.min(3, this.step);
      ctx.fillStyle = on ? 'rgba(255,226,150,0.92)' : 'rgba(255,238,205,0.35)';
      ctx.beginPath(); ctx.arc(x0 + i * gap, 74, 13, 0, Math.PI * 2); ctx.fill();
      ctx.font = `700 26px ${FONT}`; ctx.direction = 'rtl'; ctx.textAlign = 'center';
      ctx.fillStyle = on ? 'rgba(255,244,214,0.95)' : 'rgba(255,238,205,0.45)';
      ctx.fillText(RAIL_STEPS[i], x0 + i * gap, 124);
    }
  }

  drawButtons(ctx) {
    const q = this.ctrl.jobQ();
    if (q === 'mass' && this.ctrl.tool === 'balance') {
      this.roundBtn(ctx, STEP_BTN.plus, 'وزنه +', 'plus');
      this.roundBtn(ctx, STEP_BTN.minus, 'وزنه −', 'minus');
    } else if (q === 'volume' && this.ctrl.tool === 'cylinder') {
      this.roundBtn(ctx, STEP_BTN.plus, 'آب بریز', 'plus');
      this.roundBtn(ctx, STEP_BTN.minus, 'کم کن', 'minus');
    }
    this.roundBtn(ctx, READ_BTN, 'بخوان', 'read', !!this.ctrl.job());
    this.roundBtn(ctx, REC_BTN, 'ثبت کن', 'record', !!this.ctrl.pending);
    this.roundBtn(ctx, CONC_BTN, 'نتیجه', 'conclude', this.ctrl.readyToConclude());
    for (const k of ['hint', 'undo', 'reset']) {
      const b = BTN[k], pressed = this.press && this.press.b === k ? this.press.t : 0;
      drawHudButton(ctx, this.sprites, `btn_${k}`, b, BTN_R,
        { disabled: this.ended, available: k === 'hint' && this.hints.available, pressed, t: this.t });
    }
  }

  roundBtn(ctx, b, label, name, enabled = true) {
    const pressed = this.press && this.press.b === name;
    ctx.save();
    ctx.fillStyle = enabled ? (pressed ? 'rgba(255,226,150,0.95)' : 'rgba(58,42,22,0.92)') : 'rgba(40,30,18,0.6)';
    ctx.strokeStyle = enabled ? 'rgba(255,226,150,0.85)' : 'rgba(255,238,205,0.25)';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = enabled ? (pressed ? '#3a2a12' : 'rgba(255,244,214,0.95)') : 'rgba(255,244,214,0.35)';
    ctx.font = `700 ${b.r > 58 ? 24 : 21}px ${FONT}`; ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, b.x, b.y + 2);
    ctx.restore();
  }

  drawBubble(ctx) {
    if (!this.bubble) return;
    const x = WORK.x, y = WORK.footY - WORK.w - 60;
    ctx.font = `700 30px ${FONT}`;
    const w = Math.min(1080, ctx.measureText(this.bubble.text).width + 96);
    ctx.fillStyle = 'rgba(24,18,10,0.88)';
    ctx.strokeStyle = this.bubble.hint ? 'rgba(255,226,150,0.9)' : 'rgba(255,238,205,0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(x - w / 2, y - 46, w, 92, 26); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,248,230,0.96)'; ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(this.bubble.text, x, y + 2);
    ctx.textBaseline = 'alphabetic';
  }

  drawGuess(ctx) {
    ctx.fillStyle = 'rgba(10,8,18,0.72)'; ctx.fillRect(0, 0, W, H);
    const opts = this.stage.guess_options || [];
    ctx.fillStyle = 'rgba(255,244,214,0.96)'; ctx.font = `800 40px ${FONT}`; ctx.direction = 'rtl'; ctx.textAlign = 'center';
    ctx.fillText('کدام ابزار این اندازه را نشان می‌دهد؟', 960, 330);
    for (let i = 0; i < opts.length; i++) {
      const r = { x: 720, y: 452 + i * 96, w: 480, h: 78 };
      ctx.fillStyle = 'rgba(58,42,22,0.94)'; ctx.strokeStyle = 'rgba(255,226,150,0.8)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 18); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,244,214,0.96)'; ctx.font = `700 30px ${FONT}`;
      ctx.fillText(TOOLS[opts[i].id] ? TOOLS[opts[i].id].fa : opts[i].text_fa, r.x + r.w / 2, r.y + 52);
    }
  }

  drawConclude(ctx) {
    ctx.fillStyle = 'rgba(10,8,18,0.72)'; ctx.fillRect(0, 0, W, H);
    const opts = this.stage.conclusion_options || [];
    ctx.fillStyle = 'rgba(255,244,214,0.96)'; ctx.font = `800 38px ${FONT}`; ctx.direction = 'rtl'; ctx.textAlign = 'center';
    ctx.fillText(this.stage.conclusion_prompt_fa || 'چه نتیجه‌ای می‌گیری؟', 960, 280);
    for (let i = 0; i < opts.length; i++) {
      const r = { x: 620, y: 372 + i * 104, w: 680, h: 86 };
      ctx.fillStyle = 'rgba(58,42,22,0.94)'; ctx.strokeStyle = 'rgba(255,226,150,0.8)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 18); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,244,214,0.96)'; ctx.font = `700 26px ${FONT}`;
      ctx.fillText(opts[i].text_fa, r.x + r.w / 2, r.y + 54);
    }
  }

  drawSparks(ctx) {
    for (const s of this.sparks) {
      ctx.fillStyle = `rgba(${s.c[0]},${s.c[1]},${s.c[2]},${Math.max(0, s.a)})`;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
    }
  }

  /** One drawing path for every sprite: the bbox from the manifest keeps the transparent margin out of the layout. */
  drawSprite(ctx, id, x, footY, w, rot = 0) {
    const im = this.sprites.get(id);
    if (!im) {                                   // never silently draw nothing: a labelled stand-in keeps the layout true
      ctx.save(); ctx.fillStyle = 'rgba(70,52,30,0.9)'; ctx.strokeStyle = 'rgba(255,226,170,0.6)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.roundRect(x - w / 2, footY - w, w, w, 14); ctx.fill(); ctx.stroke(); ctx.restore();
      return null;
    }
    const m = this.sprites.m && this.sprites.m[id];
    const [x0, y0, x1, y1] = (m && m.bbox) || [0, 0, im.width - 1, im.height - 1];
    const sw = x1 - x0 + 1, sh = y1 - y0 + 1, h = w * sh / sw;
    ctx.save();
    if (rot) { ctx.translate(x, footY - h / 2); ctx.rotate(rot); ctx.translate(-x, -(footY - h / 2)); }
    ctx.drawImage(im, x0, y0, sw, sh, x - w / 2, footY - h, w, h);
    ctx.restore();
    return { x: x - w / 2, y: footY - h, w, h };
  }

  /** What the tests (and the recorder) read instead of pixels. */
  debugState() {
    return {
      stage: this.stage && this.stage.puzzle_id, step: this.step,
      tool: this.ctrl && this.ctrl.tool, weights: this.ctrl && this.ctrl.weights,
      level: this.ctrl && this.ctrl.level, eyeLevel: this.ctrl && this.ctrl.eyeLevel,
      offset: this.ctrl && this.ctrl.offset, placed: this.ctrl && this.ctrl.placed,
      job: this.ctrl && this.ctrl.job() && this.ctrl.job().id, rows: this.ctrl ? this.ctrl.rows.length : 0,
      pending: this.ctrl && this.ctrl.pending ? this.ctrl.pending.state : null,
      solved: !!(this.ctrl && this.ctrl.solved), ended: !!this.ended,
    };
  }
}
