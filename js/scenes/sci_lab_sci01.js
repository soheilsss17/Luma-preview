// LUMA — Room WS_SCI_LAB / card SCI-01 «راز چراغ خاموش» (science grade 3, lesson 1 «زنگ علوم», C306 ۱۴۰۵; plan 12 §3
// row 3). The workshop's science lab is dark: the lamp on the bench will not light. The child does what a scientist
// does — مشاهده، سؤال، فرضیه، آزمون، ثبت، نتیجه — with a rule-based circuit: a battery, a switch, a lamp and two wire
// bays over a bench whose return strip is painted in. ONE variable may change between two tests; if two change the
// test is refused («SCI_MULTIPLE_VARIABLE_CHANGE»), because then no row could say which of them did it. Every test is
// written into the notebook: «چه دیدم / چه تغییر دادم / چه شد». Concluding before enough rows are written is «مشاهده =
// نتیجه» (SCI_OBSERVATION_EQUALS_CONCLUSION). The colour of a wire never appears in a rule (plan 04: «سیم‌ها مستقل از
// رنگ‌اند»): the practice and transfer stages prove it by swapping colours and getting the same verdict. The battery
// safety card of plan 12 §3 is read once, at the start of the encounter, before anything is touched.
// Rules: edu/circuit_rules.js · controller: puzzles/circuit.js · content: Content/Puzzles/SCI-01.puzzle.json
import { drawHudButton, drawExitArrow, PRESS_S } from '../engine/hud.js';
import { MisconceptionEngine, HintEngine, MasteryEngine, AnalyticsQueue, SaveSlot } from '../edu/engines.js';
import { Spring, Spring2, Timeline, reduceMotion } from '../engine/motion.js';
import { RigActor } from '../engine/rig.js';
import { CircuitController } from '../puzzles/circuit.js';
import { faDigits } from '../engine/strings.js';

export const W = 1920, H = 1080;
const FONT = 'LumaFa, Vazirmatn, Tahoma, sans-serif';

// ---- bench layout (world = screen, the camera does not move; plan 14 §4.1: the child reaches the bench from the front)
export const BENCH = { y: 742, x0: 300, x1: 1620 };            // the bench top line (the sprites stand on it)
export const HOLD = { battery: { x: 560, y: 742 }, switch: { x: 960, y: 742 }, lamp: { x: 1360, y: 742 } };
export const BAYS = [{ x: 760, y: 636 }, { x: 1160, y: 636 }];  // the two wire bays, between the holders
export const PART_W = { battery: 168, switch: 150, lamp: 150, wire: 132 };
export const TRAY = { y: 1016, x0: 372, gap: 176 };
export const RUN_BTN = { x: 760, y: 906, r: 66 };               // «آزمایش کن»
export const REC_BTN = { x: 960, y: 906, r: 66 };               // «ثبت کن»
export const CONC_BTN = { x: 1160, y: 906, r: 66 };             // «نتیجه»
export const SWITCH_HIT = { x: 960, y: 660, r: 92 };
export const NOTE = { x: 1580, y: 372, w: 320, h: 556 };        // the open experiment notebook on the right
export const RAIL = { y: 74, x0: 470, gap: 196 };               // the six steps of the method
export const STEPS = ['مشاهده', 'سؤال', 'فرضیه', 'آزمون', 'ثبت', 'نتیجه'];
export const BTN = { hint: { x: 90, y: 90 }, undo: { x: 220, y: 90 }, reset: { x: 350, y: 90 } };
const BTN_R = 58;
export const EXIT = { x: 1832, y: 985, r: 95 };
const WIRE_RGB = { red: [208, 68, 58], blue: [59, 111, 212], green: [63, 160, 90], yellow: [224, 181, 49], brass: [186, 142, 74] };
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rgb = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const shade = (c, k) => [Math.round(c[0] * k), Math.round(c[1] * k), Math.round(c[2] * k)];

/** Quadratic bezier through the bay's control point (a wire hangs in a shallow arc). */
function bayCurve(bay) {
  const a = { x: bay.x - 96, y: bay.y + 96 }, b = { x: bay.x + 96, y: bay.y + 96 }, c = { x: bay.x, y: bay.y - 8 };
  return { a, b, c, at: (t) => ({ x: (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * c.x + t * t * b.x,
    y: (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * c.y + t * t * b.y }) };
}

export class SciLabSci01 {
  constructor({ sprites, puzzle, audio, storage, debug, strings, onExit }) {
    Object.assign(this, { sprites, puzzle, audio, debug, strings, onExit });
    this.save = new SaveSlot(storage);
    this.mastery = new MasteryEngine(storage);
    this.analytics = new AnalyticsQueue(storage, puzzle.analytics_fields);
    this.tl = new Timeline();
    this.t = 0; this.attempt = 0; this.drag = null; this.fx = []; this.sparks = [];
    this.alive = new Spring(0, { stiffness: 4, damping: 5 });
    this.flow = new Spring(0, { stiffness: 9, damping: 6 });     // current running through the wires
    this.glow = new Spring(0, { stiffness: 12, damping: 7 });    // lamp bloom
    this.lever = new Spring(0, { stiffness: 120, damping: 14 }); // switch: 0 open … 1 closed
    this.flick = new Spring(0, { stiffness: 20, damping: 6 });   // flat battery: the lamp flickers
    this.note = new Spring(0, { stiffness: 10, damping: 8 });    // the notebook row just written
    this.lumi = { p: new Spring2(300, 300, { stiffness: 26, damping: 9 }), mode: 'follow' };
    this.ended = false; this.bubble = null; this.card = null; this.shake = 0; this.fade = 0;
  }

  async load() {
    this.tiko = await new RigActor({ id: 'TIKO', scale: 0.17, x: 205, groundY: 1030, face: 1 }).load();
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
    this.ctrl = new CircuitController(this.stage, {
      onPlace: (id, where) => { this.audio.pickup(); this.log('part_placed', { id, where }); this.step = 2; this.bubble = { text: 'حالا آزمایش کن', until: this.t + 2.2 }; },
      onTake: (id) => { this.audio.woodClick(); this.log('part_taken', { id }); },
      onRun: (r) => this.onRun(r),
      onRefuse: (rule, d) => this.onRefuse(rule, d),
      onRecord: (row) => this.onRecord(row),
      onReady: () => { this.step = 5; this.bubble = { text: 'حالا می‌توانی نتیجه بگیری', until: this.t + 3.4 }; this.audio.chime(); },
      onSolved: () => this.onSolved(),
      onWrongConclusion: () => { this.shake = 0.5; this.audio.clunk(); this.misc.observe('colour_matters'); this.log('conclude_wrong', {}); },
      onGuess: (id) => { this.audio.tick(); this.log('guess', { id }); },
      log: (n, p) => this.log(n, p),
    });
    this.misc = new MisconceptionEngine(this.puzzle.misconceptions, 2);
    this.hints = new HintEngine(this.stage.hints, this.stage.answer_assist);
    this.attempt++; this.stageAssisted = false; this.fx = []; this.sparks = [];
    this.step = 0; this.busy = false; this.card = null; this.guessCard = null; this.concludeCard = null;
    this.bubble = { text: this.stage.objective_fa, until: this.t + 6 };
    this.flow.set(0); this.flow.target = 0; this.glow.set(0); this.glow.target = 0; this.flick.set(0); this.flick.target = 0;
    this.lever.set(this.ctrl.closed ? 1 : 0); this.lever.target = this.ctrl.closed ? 1 : 0;
    // the battery safety card of the card (plan 12 §3): read once, at the first stage, before anything is touched
    this.safety = (!finished && this.puzzle.safety && this.puzzle.safety.show_on === this.stage.stage) ? { t: 0 } : null;
    if (finished) {
      this.ctrl.finishAll();
      this.lever.set(1); this.lever.target = 1; this.flow.set(1); this.flow.target = 1;
      this.glow.set(1); this.glow.target = 1; this.alive.set(1); this.alive.target = 1;
      this.ended = true; this.audio.setLayers(4);
      this.step = 5;
      return;
    }
    this.ended = false;
  }

  onRun(r) {
    this.step = 3;
    this.audio.snap();
    if (r.lit) { this.audio.bell(); this.flow.target = 1; this.glow.target = 1; this.spawnSparks(90); }
    else {
      this.flow.target = 0; this.glow.target = 0;
      if (r.rule === 'FLAT_SOURCE') this.audio.flicker();
      else this.audio.thump();
    }
    this.flick.target = r.rule === 'FLAT_SOURCE' ? 1 : 0;
    this.bubble = { text: r.saw_fa + ' — ' + r.result_fa, until: this.t + 4.2 };
    this.step = 4;                                  // the controller already logged this run (no duplicate analytics)
  }

  onRefuse(rule, d) {
    this.shake = 0.6; this.audio.clunk();
    if (rule === 'MULTIPLE_VARIABLE') {
      this.misc.observe('multiple_variable');
      this.bubble = { text: 'هر بار فقط یک چیز را عوض کن! (' + faDigits(d.length) + ' تا را عوض کردی)', until: this.t + 4.5 };
      this.hints.target(1);
    } else if (rule === 'NEED_RECORDS') {
      this.misc.observe('need_records');
      this.bubble = { text: 'اول آزمون‌هایت را در دفترچه بنویس، بعد نتیجه بگیر.', until: this.t + 4.5 };
      this.hints.target(2);
    } else if (rule === 'NEED_GUESS') {
      this.bubble = { text: 'اول حدس بزن: چه می‌شود؟', until: this.t + 3.5 };
    }
    this.log('refused', { rule, d });
  }

  onRecord(row) {
    this.note.set(0); this.note.target = 1; this.audio.stamp();
    this.bubble = { text: 'ثبت شد: ' + faDigits(row.n) + ' — ' + row.saw_fa, until: this.t + 3 };
    this.step = this.ctrl.readyToConclude() ? 5 : 2;   // the controller logged the row
  }

  onSolved() {
    this.ended = true; this.card = null;
    this.audio.motif(); this.audio.setLayers(4);
    this.alive.target = 1; this.flow.target = 1; this.glow.target = 1;
    this.spawnSparks(220);
    this.save.setFlag(this.puzzle.world_state_on_solve);
    this.save.setPuzzle(this.stage.puzzle_id, { solved: true, hint_max: this.hints.maxUsed, assisted: this.stageAssisted });
    this.save.save();
    this.mastery.record(this.puzzle.concept_id, { stage: this.stage.stage, hints: this.hints.maxUsed, misconceptions: [...this.misc.flagged] }, this.misc.flagged);
    this.bubble = { text: this.stage.transfer_note_fa || 'آفرین! راه بسته شد.', until: this.t + 6 };
    this.log('puzzle_solved', { stage: this.stage.puzzle_id, hints: this.hints.maxUsed });
    const last = this.stageIdx >= this.puzzle.stages.length - 1;
    if (!last) this.tl.after(2.6, () => this.nextStage());
    else this.tl.after(2.2, () => { this.bubble = { text: 'اتاق آزمایشگاه دوباره جان گرفت.', until: this.t + 5 }; });
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

  // ================================================================= interaction
  traySlots() { return this.ctrl.trayParts().map((p, i) => ({ id: p.id, part: p, x: TRAY.x0 + i * TRAY.gap, y: TRAY.y })); }
  trayHit(x, y) { return this.traySlots().find((s) => Math.hypot(x - s.x, y - s.y) < 80) || null; }
  holdHit(x, y) {
    for (const k of ['battery', 'switch', 'lamp']) {
      const h = HOLD[k], w = PART_W[k];
      if (Math.abs(x - h.x) < w * 0.62 && y > h.y - w * 1.25 && y < h.y + 40) return { kind: 'hold', where: k };
    }
    for (let i = 0; i < this.ctrl.bays; i++) {
      const b = BAYS[i];
      if (Math.hypot(x - b.x, y - b.y) < 96) return { kind: 'bay', where: String(i) };
    }
    return null;
  }

  pointerDown(sx, sy) {
    this.px = sx; this.py = sy;
    if (this.safety) { this.safety = null; this.audio.paper(); this.log('safety_card_read', {}); return; }
    if (this.guessCard) { this.tapGuess(sx, sy); return; }
    if (this.concludeCard) { this.tapConclude(sx, sy); return; }
    const b = ['hint', 'undo', 'reset'].find((n) => Math.hypot(sx - BTN[n].x, sy - BTN[n].y) < BTN_R);
    if (b) { this.press = { b, t: PRESS_S }; this.doButton(b); return; }
    if (this.ended && Math.hypot(sx - EXIT.x, sy - EXIT.y) < EXIT.r) { this.leave(); return; }
    if (Math.hypot(sx - RUN_BTN.x, sy - RUN_BTN.y) < RUN_BTN.r) { this.press = { b: 'run', t: PRESS_S }; this.doRun(); return; }
    if (Math.hypot(sx - REC_BTN.x, sy - REC_BTN.y) < REC_BTN.r) { this.press = { b: 'record', t: PRESS_S }; this.doRecord(); return; }
    if (Math.hypot(sx - CONC_BTN.x, sy - CONC_BTN.y) < CONC_BTN.r) { this.press = { b: 'conclude', t: PRESS_S }; this.doConclude(); return; }
    if (this.ctrl.slots.switch && Math.hypot(sx - SWITCH_HIT.x, sy - SWITCH_HIT.y) < SWITCH_HIT.r) { this.doToggle(); return; }
    const t = this.trayHit(sx, sy);
    if (t) { this.drag = { id: t.id, part: t.part, p: new Spring2(t.x, t.y, { stiffness: 220, damping: 22 }), from: 'tray' }; this.audio.pickup(); return; }
    const h = this.holdHit(sx, sy);
    if (h) {
      const id = h.kind === 'hold' ? this.ctrl.slots[h.where] : this.ctrl.wires[Number(h.where)];
      if (id) {
        const took = this.ctrl.take(h.where);
        if (took) { this.drag = { id: took, part: this.ctrl.part(took), p: new Spring2(sx, sy, { stiffness: 220, damping: 22 }), from: 'bench' }; this.audio.woodClick(); }
      }
    }
  }

  pointerMove(sx, sy) {
    this.px = sx; this.py = sy;
    if (this.drag) { this.drag.p.to(sx, sy); this.drag.p.set(sx, sy); }
  }

  pointerUp(sx, sy) {
    this.px = sx; this.py = sy;
    if (!this.drag) return;
    const d = this.drag; this.drag = null;
    const h = this.holdHit(sx, sy);
    const r = h ? this.ctrl.place(d.id, h.where) : null;
    if (r === 'ok' && !this.ended) { this.flow.target = 0; this.glow.target = 0; }
    else if (r) { this.audio.clunk(); this.bubble = { text: r === 'occupied' ? 'این‌جا پر است.' : 'این قطعه این‌جا جا نمی‌شود.', until: this.t + 2.4 }; }
  }

  doButton(b) {
    if (b === 'hint') { this.hintNow(); return; }
    if (b === 'undo') { if (this.ctrl.undo() && !this.ended) { this.audio.woodClick(); this.flow.target = 0; this.glow.target = 0; this.flick.target = 0; } return; }
    if (b === 'reset') { this.ctrl.reset(); this.audio.woodClick(); this.flow.target = 0; this.glow.target = 0; this.flick.target = 0; this.step = 0; }
  }

  doToggle() {
    const v = this.ctrl.toggle();
    if (v === null) { this.audio.thump(); return; }
    this.lever.target = v ? 1 : 0;
    this.audio.snap();
    if (!this.ended) { this.flow.target = 0; this.glow.target = 0; }
    this.log('switch_toggled', { closed: !!v });
  }

  doRun() {
    if (this.busy) return;
    if (this.stage.require_guess && !this.ctrl.guess && !this.ended) {
      this.guessCard = { t: 0 }; this.onRefuse('NEED_GUESS', []); return;
    }
    const r = this.ctrl.run();
    if (r && r.refused) return;
    this.step = r ? 4 : this.step;
  }

  doRecord() {
    if (!this.ctrl.pending) { this.audio.thump(); this.bubble = { text: 'اول آزمایش کن، بعد ثبت کن.', until: this.t + 2.6 }; return; }
    this.ctrl.record();
  }

  doConclude() {
    if (!this.ctrl.readyToConclude()) { this.ctrl.conclude(null); return; }
    this.concludeCard = { t: 0 };
  }

  tapGuess(x, y) {
    const opts = this.stage.guess_options || [];
    for (let i = 0; i < opts.length; i++) {
      const r = { x: 660, y: 470 + i * 90, w: 600, h: 74 };
      if (x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h) {
        this.ctrl.setGuess(opts[i].id); this.guessCard = null; this.step = 3;
        return;
      }
    }
  }

  tapConclude(x, y) {
    const opts = this.stage.conclusion_options || [];
    for (let i = 0; i < opts.length; i++) {
      const r = { x: 640, y: 400 + i * 96, w: 640, h: 80 };
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
    const cx = HOLD.lamp.x, cy = HOLD.lamp.y - 190;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = 60 + Math.random() * 220;
      this.sparks.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, a: 1, r: 2 + Math.random() * 4, c: [255, 214, 130] });
    }
  }

  // ================================================================= update
  update(dt) {
    this.t += dt;
    this.tl.update(dt);
    for (const s of [this.alive, this.flow, this.glow, this.lever, this.flick, this.note]) s.update(dt);
    this.note.target = 0;
    if (this.drag) this.drag.p.update(dt);
    this.lumi.p.update(dt);
    if (this.press) { this.press.t -= dt; if (this.press.t <= 0) this.press = null; }
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 1.6);
    if (this.bubble && this.t > this.bubble.until) this.bubble = null;
    if (this.hintFx) { this.hintFx.t += dt; if (this.hintFx.t > 3) this.hintFx = null; }
    if (this.safety) this.safety.t += dt;
    this.hints.tick(dt);
    // the flat battery makes the lamp flicker even while it is (barely) on
    if (this.ctrl && this.ctrl.state().battery === 'flat' && this.flick.target > 0) {
      this.flick.value = 0.5 + 0.5 * Math.sin(this.t * 13) * (0.6 + 0.4 * Math.sin(this.t * 5.3));
    }
    for (const f of this.fx) f.t += dt;
    this.fx = this.fx.filter((f) => f.t < 1.2);
    for (const s of this.sparks) { s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 260 * dt; s.a -= dt * 0.8; }
    this.sparks = this.sparks.filter((s) => s.a > 0);
    // LUMI hovers near what the moment is about: the notebook while recording, the bench otherwise
    if (this.lumia) {
      const target = this.step === 4 || this.step === 5 ? { x: NOTE.x - 120, y: NOTE.y + 120 }
        : { x: HOLD.lamp.x - 40, y: HOLD.lamp.y - 300 };
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
    const plate = this.sprites.get('sci_lab'), on = this.sprites.get('sci_lab_on');
    if (plate) ctx.drawImage(plate, 0, 0, W, H);
    if (on && this.alive.value > 0.01) { ctx.globalAlpha = clamp01(this.alive.value); ctx.drawImage(on, 0, 0, W, H); ctx.globalAlpha = 1; }
    ctx.fillStyle = `rgba(12,10,22,${0.30 - 0.24 * this.alive.value})`; ctx.fillRect(0, 0, W, H);   // the room is dark until it wakes
    this.drawBench(ctx);
    this.drawReturnStrip(ctx);
    this.drawWires(ctx);
    this.drawHolders(ctx);
    this.drawTray(ctx);
    this.drawNotebook(ctx);
    this.drawRail(ctx);
    this.drawButtons(ctx);
    this.drawBubble(ctx);
    for (const a of this.actors) a.draw(ctx);
    this.drawSparks(ctx);
    if (this.drag) this.drawDragged(ctx);
    if (this.safety) this.drawSafety(ctx);
    if (this.guessCard) this.drawGuess(ctx);
    if (this.concludeCard) this.drawConclude(ctx);
    if (this.ended) drawExitArrow(ctx, EXIT, this.t, true);
    if (this.fade > 0) { ctx.fillStyle = `rgba(8,6,16,${this.fade})`; ctx.fillRect(0, 0, W, H); }
    ctx.restore();
  }

  drawBench(ctx) {
    const g = ctx.createLinearGradient(0, BENCH.y, 0, BENCH.y + 150);
    g.addColorStop(0, 'rgba(120,86,50,0.95)'); g.addColorStop(1, 'rgba(58,40,24,0.95)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.roundRect(BENCH.x0 - 40, BENCH.y, BENCH.x1 - BENCH.x0 + 80, 150, 18); ctx.fill();
    ctx.fillStyle = 'rgba(228,196,140,0.22)'; ctx.fillRect(BENCH.x0 - 40, BENCH.y, BENCH.x1 - BENCH.x0 + 80, 10);
    for (const k of ['battery', 'switch', 'lamp']) {
      const h = HOLD[k], w = PART_W[k] * 1.25;
      ctx.fillStyle = 'rgba(30,22,14,0.5)';
      ctx.beginPath(); ctx.ellipse(h.x, h.y + 6, w * 0.6, 20, 0, 0, Math.PI * 2); ctx.fill();
    }
  }

  drawReturnStrip(ctx) {
    // the return path is part of the bench (a brass strip): the loop the child closes with the two wires
    const y = BENCH.y + 96;
    ctx.save();
    ctx.strokeStyle = rgb(WIRE_RGB.brass, 0.9); ctx.lineWidth = 22; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(HOLD.lamp.x, y); ctx.lineTo(HOLD.battery.x, y); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,236,190,0.35)'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(HOLD.lamp.x, y - 5); ctx.lineTo(HOLD.battery.x, y - 5); ctx.stroke();
    if (this.flow.value > 0.05) {
      for (let i = 0; i < 5; i++) {
        const t = ((this.t * 0.5 + i / 5) % 1);
        const x = lerp(HOLD.lamp.x, HOLD.battery.x, t);
        ctx.fillStyle = `rgba(255,226,150,${0.8 * this.flow.value})`;
        ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.fillStyle = 'rgba(255,238,205,0.75)'; ctx.font = `600 20px ${FONT}`; ctx.direction = 'rtl'; ctx.textAlign = 'center';
    ctx.fillText('مسیر برگشت روی میز', (HOLD.lamp.x + HOLD.battery.x) / 2, y + 40);
    ctx.restore();
  }

  drawWires(ctx) {
    for (let i = 0; i < this.ctrl.bays; i++) {
      const id = this.ctrl.wires[i], b = BAYS[i], cv = bayCurve(b);
      ctx.save();
      if (!id) {                       // an empty bay: a dotted trace so the child sees where a wire belongs
        ctx.setLineDash([14, 14]); ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(255,226,170,0.35)';
        ctx.beginPath(); ctx.moveTo(cv.a.x, cv.a.y); ctx.quadraticCurveTo(cv.c.x, cv.c.y, cv.b.x, cv.b.y); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(255,226,170,0.5)'; ctx.font = `700 26px ${FONT}`; ctx.direction = 'rtl'; ctx.textAlign = 'center';
        ctx.fillText('جای سیم', b.x, b.y);
        ctx.restore(); continue;
      }
      const c = WIRE_RGB[(this.ctrl.part(id) || {}).colour] || WIRE_RGB.red;
      ctx.lineCap = 'round';
      ctx.strokeStyle = rgb(shade(c, 0.55)); ctx.lineWidth = 24;
      ctx.beginPath(); ctx.moveTo(cv.a.x, cv.a.y); ctx.quadraticCurveTo(cv.c.x, cv.c.y, cv.b.x, cv.b.y); ctx.stroke();
      ctx.strokeStyle = rgb(c); ctx.lineWidth = 14;
      ctx.beginPath(); ctx.moveTo(cv.a.x, cv.a.y); ctx.quadraticCurveTo(cv.c.x, cv.c.y, cv.b.x, cv.b.y); ctx.stroke();
      ctx.strokeStyle = rgb(shade(c, 1.45), 0.5); ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(cv.a.x, cv.a.y - 4); ctx.quadraticCurveTo(cv.c.x, cv.c.y - 4, cv.b.x, cv.b.y - 4); ctx.stroke();
      if (this.flow.value > 0.05) {                     // the current running round the loop
        for (let k = 0; k < 6; k++) {
          const t = ((this.t * 0.55 + k / 6) % 1), p = cv.at(t);
          ctx.fillStyle = `rgba(255,236,170,${0.9 * this.flow.value})`;
          ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.restore();
    }
  }

  drawHolders(ctx) {
    for (const k of ['battery', 'switch', 'lamp']) {
      const id = this.ctrl.slots[k], h = HOLD[k], w = PART_W[k];
      if (!id) { this.drawEmptyHolder(ctx, k, h, w); continue; }
      if (k === 'lamp') this.drawLamp(ctx, h, w);
      else if (k === 'switch') this.drawSwitch(ctx, h, w);
      else this.drawPart(ctx, id, h.x, h.y, w);
    }
  }

  drawEmptyHolder(ctx, k, h, w) {
    ctx.save();
    ctx.setLineDash([12, 12]); ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(255,226,170,0.45)';
    ctx.beginPath(); ctx.roundRect(h.x - w / 2, h.y - w * 1.05, w, w * 1.05, 16); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,238,205,0.7)'; ctx.font = `700 26px ${FONT}`; ctx.direction = 'rtl'; ctx.textAlign = 'center';
    ctx.fillText({ battery: 'باتری', switch: 'کلید', lamp: 'چراغ' }[k], h.x, h.y - w * 0.5);
    ctx.restore();
  }

  drawLamp(ctx, h, w) {
    const lit = clamp01(this.glow.value) * (1 - 0.75 * clamp01(this.flick.value));
    if (lit > 0.02 && !reduceMotion) {
      const g = ctx.createRadialGradient(h.x, h.y - w * 1.15, 4, h.x, h.y - w * 1.15, 420);
      g.addColorStop(0, `rgba(255,226,150,${0.55 * lit})`); g.addColorStop(1, 'rgba(255,226,150,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(h.x, h.y - w * 1.15, 420, 0, Math.PI * 2); ctx.fill();
    }
    this.drawPart(ctx, this.ctrl.slots.lamp, h.x, h.y, w);
    if (lit > 0.5) {
      ctx.save(); ctx.globalAlpha = clamp01((lit - 0.5) * 2);
      this.drawPart(ctx, 'lamp_unit_on', h.x, h.y, w);
      ctx.restore();
    }
    if (this.flick.value > 0.05 && this.ctrl.state().battery === 'flat') {
      ctx.save(); ctx.globalAlpha = 0.5 + 0.5 * Math.sin(this.t * 17);
      this.drawPart(ctx, 'lamp_unit_flicker', h.x, h.y, w);
      ctx.restore();
    }
  }

  drawSwitch(ctx, h, w) {
    this.drawPart(ctx, this.ctrl.closed ? 'switch_unit_on' : 'switch_unit', h.x, h.y, w);
    // the lever: engine-drawn so the tap always reads as movement (the sprite's two states are the extremes)
    const a = lerp(-0.5, 0.5, this.lever.value);
    ctx.save();
    ctx.translate(h.x + w * 0.30, h.y - w * 0.62); ctx.rotate(a);
    ctx.fillStyle = this.ctrl.closed ? '#ffd98a' : '#cbb894'; ctx.strokeStyle = '#4a3418'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.roundRect(-8, -46, 16, 66, 8); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#7a5a2c'; ctx.beginPath(); ctx.arc(0, 24, 11, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.fillStyle = 'rgba(255,238,205,0.85)'; ctx.font = `700 24px ${FONT}`; ctx.direction = 'rtl'; ctx.textAlign = 'center';
    ctx.fillText(this.ctrl.closed ? 'بسته' : 'باز', h.x, h.y + 34);
  }

  drawTray(ctx) {
    const im = this.sprites.get('observation_tray');
    const slots = this.traySlots();
    if (!slots.length) return;
    const x0 = slots[0].x - 92, x1 = slots[slots.length - 1].x + 92;
    ctx.save();
    if (im) ctx.drawImage(im, x0 - 30, TRAY.y - 66, x1 - x0 + 60, 150);
    else { ctx.fillStyle = 'rgba(92,64,36,0.75)'; ctx.beginPath(); ctx.roundRect(x0 - 30, TRAY.y - 56, x1 - x0 + 60, 116, 22); ctx.fill(); }
    ctx.restore();
    for (const s of slots) {
      if (this.drag && this.drag.id === s.id) continue;
      if (s.part.kind === 'wire') this.drawWireCoil(ctx, s.x, s.y, (WIRE_RGB[s.part.colour] || WIRE_RGB.red), 46);
      else this.drawPart(ctx, s.id, s.x, s.y, s.part.kind === 'battery' ? 96 : 92);
      ctx.fillStyle = 'rgba(255,240,214,0.9)'; ctx.font = `600 20px ${FONT}`; ctx.direction = 'rtl'; ctx.textAlign = 'center';
      ctx.fillText(s.part.label_fa, s.x, s.y + 58);
    }
  }

  drawWireCoil(ctx, x, y, c, r) {
    ctx.save();
    ctx.strokeStyle = rgb(shade(c, 0.55)); ctx.lineWidth = 16; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(x, y - 18, r, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = rgb(c); ctx.lineWidth = 10;
    ctx.beginPath(); ctx.arc(x, y - 18, r, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = rgb(shade(c, 1.4), 0.6); ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x, y - 22, r, 0.6, 2.4); ctx.stroke();
    ctx.restore();
  }

  drawDragged(ctx) {
    const d = this.drag, p = d.p;
    ctx.save(); ctx.globalAlpha = 0.94;
    if (d.part.kind === 'wire') this.drawWireCoil(ctx, p.x.value, p.y.value, WIRE_RGB[d.part.colour] || WIRE_RGB.red, 46);
    else this.drawPart(ctx, d.id, p.x.value, p.y.value, d.part.kind === 'battery' ? 108 : 104);
    ctx.restore();
  }

  /** Draw a manifest sprite by its bbox, so its foot lands on (x, footY) and it is w wide. */
  drawSprite(ctx, id, x, footY, w) {
    const im = this.sprites.get(id);
    if (!im) {                                   // never silently draw nothing: a labelled stand-in keeps the layout true
      ctx.save(); ctx.fillStyle = 'rgba(70,52,30,0.9)'; ctx.strokeStyle = 'rgba(255,226,170,0.6)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.roundRect(x - w / 2, footY - w, w, w, 14); ctx.fill(); ctx.stroke(); ctx.restore();
      return null;
    }
    const m = this.sprites.m && this.sprites.m[id];
    const [x0, y0, x1, y1] = (m && m.bbox) || [0, 0, im.width - 1, im.height - 1];
    const sw = x1 - x0 + 1, sh = y1 - y0 + 1, h = w * sh / sw;
    ctx.drawImage(im, x0, y0, sw, sh, x - w / 2, footY - h, w, h);
    return { x: x - w / 2, y: footY - h, w, h };
  }

  drawPart(ctx, id, x, footY, w) { return this.drawSprite(ctx, id, x, footY, w); }

  drawNotebook(ctx) {
    const n = NOTE;
    ctx.save();
    const im = this.ctrl.rows.length ? (this.sprites.get('notebook_drawn') || this.sprites.get('notebook_blank'))
      : this.sprites.get('notebook_blank') || this.sprites.get('notebook');
    if (im) { ctx.globalAlpha = 0.96; ctx.drawImage(im, n.x - n.w / 2 - 26, n.y - 40, n.w + 52, n.h + 96); ctx.globalAlpha = 1; }
    else {
      ctx.fillStyle = 'rgba(246,236,214,0.96)'; ctx.strokeStyle = '#6b4f2a'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.roundRect(n.x - n.w / 2, n.y, n.w, n.h, 18); ctx.fill(); ctx.stroke();
    }
    ctx.fillStyle = '#4a3418'; ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `800 30px ${FONT}`; ctx.fillText('دفترچهٔ آزمایش', n.x, n.y + 44);
    ctx.font = `600 20px ${FONT}`; ctx.fillStyle = 'rgba(74,52,24,0.7)';
    ctx.fillText('چه دیدم · چه تغییر دادم · چه شد', n.x, n.y + 80);
    const rows = this.ctrl.rows.slice(-4);
    rows.forEach((r, i) => {
      const y = n.y + 128 + i * 100, last = i === rows.length - 1;
      const pulse = last ? clamp01(this.note.value) : 0;
      ctx.fillStyle = r.lit ? `rgba(120,255,150,${0.10 + 0.16 * pulse})` : `rgba(255,176,90,${0.10 + 0.16 * pulse})`;
      ctx.beginPath(); ctx.roundRect(n.x - n.w / 2 + 16, y - 34, n.w - 32, 88, 12); ctx.fill();
      ctx.textAlign = 'right'; ctx.fillStyle = '#4a3418'; ctx.font = `800 24px ${FONT}`;
      ctx.fillText(faDigits(r.n) + '. ' + (r.lit ? 'روشن' : 'خاموش'), n.x + n.w / 2 - 28, y - 12);
      ctx.font = `600 19px ${FONT}`; ctx.fillStyle = 'rgba(74,52,24,0.85)';
      ctx.fillText('تغییر: ' + r.changed_fa, n.x + n.w / 2 - 28, y + 14);
      ctx.fillText('شد: ' + r.result_fa, n.x + n.w / 2 - 28, y + 38);
    });
    if (!rows.length) {
      ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(74,52,24,0.55)'; ctx.font = `600 22px ${FONT}`;
      ctx.fillText('هنوز آزمونی ثبت نشده است.', n.x, n.y + n.h / 2);
    }
    ctx.restore();
  }

  drawRail(ctx) {
    ctx.save();
    for (let i = 0; i < STEPS.length; i++) {
      const x = RAIL.x0 + i * RAIL.gap, on = i === this.step, done = i < this.step;
      ctx.fillStyle = on ? 'rgba(255,205,120,0.95)' : done ? 'rgba(255,226,170,0.45)' : 'rgba(255,255,255,0.13)';
      ctx.beginPath(); ctx.roundRect(x - 78, RAIL.y - 26, 156, 52, 26); ctx.fill();
      if (on) { ctx.strokeStyle = '#fff3d0'; ctx.lineWidth = 4; ctx.stroke(); }
      ctx.fillStyle = on ? '#3a2a10' : 'rgba(255,240,214,0.85)';
      ctx.font = `800 ${on ? 26 : 24}px ${FONT}`; ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(STEPS[i], x, RAIL.y + 1);
    }
    ctx.restore();
  }

  drawButtons(ctx) {
    const ids = { hint: 'btn_hint', undo: 'btn_undo', reset: 'btn_reset' };
    const press = { hint: 'btn_hint_pressed', undo: this.ctrl.undoStack.length ? 'btn_undo_pressed' : 'btn_undo_disabled', reset: 'btn_reset_pressed' };
    for (const n of ['hint', 'undo', 'reset']) {
      const b = BTN[n], down = this.press && this.press.b === n;
      let id = down ? press[n] : ids[n];
      if (n === 'hint' && this.hints.available && !down) id = 'btn_hint_pulse';
      drawHudButton(ctx, this.sprites, id, b, BTN_R, {});
    }
    // the three actions of the method loop, on the bench apron
    this.roundBtn(ctx, RUN_BTN, '#ffd98a', '#4a3418', 'آزمایش کن', this.ctrl.pending ? 0.5 : 1);
    this.roundBtn(ctx, REC_BTN, this.ctrl.pending ? '#cdeec9' : '#8b8676', '#3a2a10', 'ثبت کن', this.ctrl.pending ? 1 : 0.45);
    this.roundBtn(ctx, CONC_BTN, this.ctrl.readyToConclude() ? '#ffe6a8' : '#8b8676', '#3a2a10', 'نتیجه', this.ctrl.readyToConclude() ? 1 : 0.45);
    if (this.ctrl.readyToConclude() && !this.ended) {
      ctx.save(); ctx.globalAlpha = 0.5 + 0.5 * Math.sin(this.t * 4);
      ctx.strokeStyle = '#ffe6a8'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(CONC_BTN.x, CONC_BTN.y, CONC_BTN.r + 10, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
  }

  roundBtn(ctx, b, fill, ink, label, alpha) {
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.fillStyle = fill; ctx.strokeStyle = 'rgba(40,28,14,0.7)'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = ink; ctx.font = `800 26px ${FONT}`; ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, b.x, b.y + 2);
    ctx.restore();
  }

  drawBubble(ctx) {
    if (!this.bubble) return;
    const text = this.bubble.text, x = 960, y = 176;
    ctx.save();
    ctx.font = `700 30px ${FONT}`; ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = Math.min(1300, ctx.measureText(text).width + 90);
    const a = clamp01((this.bubble.until - this.t) / 0.4);
    ctx.globalAlpha = a;
    ctx.fillStyle = this.bubble.hint ? 'rgba(255,246,214,0.97)' : 'rgba(252,244,226,0.97)';
    ctx.strokeStyle = this.bubble.hint ? '#e0a63c' : '#6b4f2a'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.roundRect(x - w / 2, y - 46, w, 92, 26); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#4a3418'; ctx.fillText(text, x, y + 2);
    ctx.restore();
  }

  /** The battery safety card (plan 12 §3): read once before the first experiment, then never again. */
  drawSafety(ctx) {
    const w = 620, h = 470, x = 960 - w / 2, y = 300, a = clamp01(this.safety.t / 0.35);
    ctx.save();
    ctx.globalAlpha = 0.75 * a;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(250,240,220,0.99)'; ctx.strokeStyle = '#8a5a2a'; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 26); ctx.fill(); ctx.stroke();
    const im = this.sprites.get(this.puzzle.safety.card_sprite);
    if (im) ctx.drawImage(im, x + w / 2 - 150, y + 34, 300, 300);
    ctx.fillStyle = '#5a3a18'; ctx.font = `800 30px ${FONT}`; ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('پیش از آزمایش', x + w / 2, y + 350);
    ctx.font = `700 24px ${FONT}`; ctx.fillStyle = '#4a3418';
    ctx.fillText(this.puzzle.safety.text_fa, x + w / 2, y + 396);
    ctx.font = `600 20px ${FONT}`; ctx.fillStyle = 'rgba(74,52,24,0.7)';
    ctx.fillText('(برای ادامه لمس کن)', x + w / 2, y + 436);
    ctx.restore();
  }

  drawGuess(ctx) {
    const opts = this.stage.guess_options || [];
    this.panel(ctx, 660, 380, 600, 90 * opts.length + 120, 'حدس بزن: چه می‌شود؟');
    ctx.save(); ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    opts.forEach((o, i) => {
      const r = { x: 660, y: 470 + i * 90, w: 600, h: 74 };
      ctx.fillStyle = 'rgba(255,226,170,0.35)'; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 16); ctx.fill();
      ctx.strokeStyle = '#6b4f2a'; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = '#4a3418'; ctx.font = `700 28px ${FONT}`; ctx.fillText(o.text_fa, r.x + r.w / 2, r.y + r.h / 2);
    });
    ctx.restore();
  }

  drawConclude(ctx) {
    const opts = this.stage.conclusion_options || [];
    const h = 96 * opts.length + 190;
    this.panel(ctx, 600, 250, 720, h, this.stage.conclusion_prompt_fa || 'نتیجهٔ تو چیست؟');
    ctx.save(); ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    opts.forEach((o, i) => {
      const r = { x: 640, y: 400 + i * 96, w: 640, h: 80 };
      ctx.fillStyle = 'rgba(255,226,170,0.35)'; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 16); ctx.fill();
      ctx.strokeStyle = '#6b4f2a'; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = '#4a3418'; ctx.font = `700 26px ${FONT}`; ctx.fillText(o.text_fa, r.x + r.w / 2, r.y + r.h / 2);
    });
    ctx.restore();
  }

  panel(ctx, x, y, w, h, title) {
    ctx.save();
    ctx.fillStyle = 'rgba(252,244,226,0.98)'; ctx.strokeStyle = '#6b4f2a'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 26); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#4a3418'; ctx.font = `800 32px ${FONT}`; ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(title, x + w / 2, y + 62);
    ctx.restore();
  }

  drawSparks(ctx) {
    for (const s of this.sparks) {
      ctx.fillStyle = `rgba(${s.c[0]},${s.c[1]},${s.c[2]},${clamp01(s.a)})`;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
    }
  }

  debugState() {
    return {
      stage: this.stage.puzzle_id, step: this.step, rows: this.ctrl.rows.length, pending: !!this.ctrl.pending,
      state: this.ctrl.state(), closed: this.ctrl.closed, lit: this.flow.target > 0, ended: this.ended,
      parts: this.ctrl.trayParts().map((p) => p.id), flagged: [...(this.misc ? this.misc.flagged : [])],
    };
  }
}
