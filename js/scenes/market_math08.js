// LUMA — MATH-08 «ارزش پول» (Math grade 3, chapter 2, pp. 34–36): the market payment counter.
//
// The shopkeeper names a price; the child pays it with three kinds of generic market token — ۱۰۰۰ (a medium brass
// hexagon), ۵۰۰ (a small copper disc) and ۱۰۰ (a LARGE painted-wood octagon). The size order is deliberately not the
// value order, so the card's MONEY-M02 («تکیه به اندازه ظاهری Token») can be walked into and then taught; H1 says it
// out loud («به ارزش هر قطعه نگاه کن، نه تعداد آن.»). No real Iranian currency art is ever used — every value in the
// room is drawn by this file, the sprites carry no digits.
//
// Mastery (card §22): a price is paid twice, in two DIFFERENT combinations; paying the same combination twice is a
// nudge («این همان ترکیب قبلی است…»), never a mistake, and nothing in the room ever punishes a wrong amount.
import { RigActor } from '../engine/rig.js';
import { Spring, Spring2, Timeline, reduceMotion, ease } from '../engine/motion.js';
import { MisconceptionEngine, HintEngine, MasteryEngine, AnalyticsQueue, SaveSlot } from '../edu/engines.js';
import { drawHudButton, drawExitArrow, PRESS_S } from '../engine/hud.js';
import { PayCounterController } from '../puzzles/pay_counter.js';
import { DENOMS, VALUES, faDigits } from '../edu/money_rules.js';

const W = 1920, H = 1080;
const FONT = 'LumaFa, Vazirmatn, Tahoma, sans-serif';
const AMBER = [255, 176, 50], GOLD = [255, 214, 120], INK = '#4a3418';

// ---------------------------------------------------------------- the pay counter (PROP_MARKET_COUNTER)
// web sprite 512², alpha bbox 21–490 × 197–491 → 469 × 294; the top surface reads as the band 49–98 below the bbox top.
export const COUNTER = { x: 960, bottom: 965, w: 470 };
export const CS = COUNTER.w / 469;
export const COUNTER_H = 294 * CS;
export const counterTop = () => COUNTER.bottom - COUNTER_H;
export const COMP_F = [0.22, 0.5, 0.78];                       // the three compartments, across the counter's width
export const SURFACE = { y0: 49 * CS, y1: 98 * CS };           // the top band, measured from the bbox top
export const compX = (i) => COUNTER.x - COUNTER.w / 2 + COMP_F[i] * COUNTER.w;
export const compY = () => counterTop() + (SURFACE.y0 + SURFACE.y1) / 2;
export const RIM = { rx: 58, ry: 24 };

// how wide each piece is drawn on the counter / in the tray: the art's own ratios, exaggerated so the biggest piece
// really does look the most valuable (the trap has to be tempting)
export const PIECE_W = { token_100: 112, token_1000: 88, token_500: 64 };
export const TOKEN_SPRITE = ['token_1000', 'token_500', 'token_100'];      // DENOMS order (1000, 500, 100)
export const STACK_DY = 17;                                                // one piece in a stack sits this much higher

// ---------------------------------------------------------------- the tray shelf (engine-drawn, on the left)
export const SHELF = { x0: 150, x1: 680, top: 905, h: 74 };
export const TRAY_X = [258, 402, 546];
export const trayY = () => SHELF.top - 6;

// ---------------------------------------------------------------- the engine-drawn plates
export const PRICE = { x: 960, y: 122, w: 660, h: 136 };        // «بها: ۲۰۰۰ تومان» + what is being bought
export const READOUT = { x: 960, y: 600, w: 620, h: 118 };      // what is on the counter + what is left
export const PAY_BTN = { x: 1408, y: 600, w: 226, h: 96 };
export const AGAIN_BTN = { x: 512, y: 600, w: 206, h: 88 };

// ---------------------------------------------------------------- cast
export const NEO_HOME = 1310, NEO_GROUND = 985, TIKO_X = 92, TIKO_GROUND = 1000;
export const SELLER = { x: 1530, ground: 990, h: 404 };
export const BTN = { hint: { x: 90, y: 90 }, undo: { x: 220, y: 90 }, reset: { x: 350, y: 90 } };
const BTN_R = 58;
export const EXIT = { x: 1800, y: 972, r: 92 };

const lerp = (a, b, t) => a + (b - a) * t;
const arcY = (y0, y1, k, h) => lerp(y0, y1, k) - Math.sin(Math.PI * k) * h;

export class MarketMath08 {
  constructor({ sprites, puzzle, audio, storage, debug, strings, onExit }) {
    Object.assign(this, { sprites, puzzle, audio, debug, strings, onExit });
    this.save = new SaveSlot(storage);
    this.mastery = new MasteryEngine(storage);
    this.analytics = new AnalyticsQueue(storage, puzzle.analytics_fields);
    this.tl = new Timeline();
    this.t = 0; this.attempt = 0; this.drag = null; this.fx = []; this.movers = [];
    this.aliveMix = new Spring(0, { stiffness: 4, damping: 5 });      // the room waking up
    this.glow = new Spring(0, { stiffness: 10, damping: 6 });         // the price board lighting up
    this.shake = 0;
    this.lumi = { p: new Spring2(960, 520, { stiffness: 30, damping: 9 }), mode: 'follow' };
    this.ended = false; this.bubble = null;
  }

  async load() {
    this.neo = await new RigActor({ id: 'NEO', scale: 0.28, x: NEO_HOME, groundY: NEO_GROUND, face: -1 }).load();
    this.tiko = await new RigActor({ id: 'TIKO', scale: 0.16, x: TIKO_X, groundY: TIKO_GROUND, face: 1 }).load();
    this.actors = [this.tiko, this.neo];
    const done = this.puzzle.stages.map((s) => { const p = this.save.puzzle(s.puzzle_id); return !!(p && p.solved); });
    if (done.every(Boolean)) this.startStage(this.puzzle.stages.length - 1, { finished: true });
    else this.startStage(done.indexOf(false));
    if (this.save.flag(this.puzzle.world_state_on_solve)) this.aliveMix.set(1);
    return this;
  }

  // ================================================================= flow
  startStage(idx, { finished = false } = {}) {
    this.stageIdx = idx; this.stage = this.puzzle.stages[idx];
    this.ctrl = new PayCounterController(this.stage);
    this.misc = new MisconceptionEngine(this.puzzle.misconceptions, this.puzzle.misconception_flag_threshold);
    this.hints = new HintEngine(this.stage.hints, this.stage.answer_assist);
    this.stageMaxHint = 0; this.stageAssisted = false; this.stageStart = this.t; this.attempt++;
    this.fx = []; this.movers = []; this.hintUnit = -1; this.busy = false; this.hintShow = 0;
    this.ended = false; this.bubble = null; this.lastLeft = null;
    if (finished) {
      this.ended = true; this.glow.set(1); this.glow.target = 1; this.audio.setLayers(4);
      return;
    }
    this.audio.setLayers(idx + 1);
    this.log('puzzle_start', {});
    this.recordMastery(false);
    this.save.setPuzzle(this.stage.puzzle_id, { solved: false, entered: new Date().toISOString() });
  }

  objective() { return this.stage.objective_fa; }

  recordMastery(solved) {
    const lvl = this.mastery.record(this.puzzle.concept_id,
      { stage: this.stage.stage, solved, maxHint: this.stageMaxHint, assisted: this.stageAssisted }, this.puzzle.mastery);
    if (lvl !== null) this.log('mastery_updated', { level: lvl });
  }

  log(name, extra) {
    const e = this.analytics.log(name, {
      puzzle_id: this.stage.puzzle_id, attempt_id: this.attempt, duration: Math.round((this.t - this.stageStart) * 10) / 10,
      hint_level: this.hints ? this.hints.maxUsed : 0, ...extra,
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

  say(key, sec = 3.4) {
    if (!key || !this.strings) return;
    const b = { text: this.strings.t(key), t: 0 }; this.bubble = b;
    this.tl.after(sec, () => { if (this.bubble === b) this.bubble = null; });
  }

  // ================================================================= geometry
  /** The three compartments on the counter's top, in DENOMS order. */
  compPos(i) { return { x: compX(i), y: compY() }; }
  /** The three tray stacks on the shelf, in DENOMS order. y = the base the pieces stand on. */
  trayPos(i) { return { x: TRAY_X[i], y: trayY() }; }

  stackAt(x, y) {
    for (let i = 0; i < 3; i++) {
      const p = this.trayPos(i), w = PIECE_W[TOKEN_SPRITE[i]];
      if (Math.abs(x - p.x) < w / 2 + 22 && y > p.y - 150 && y < p.y + 66) return i;
    }
    return -1;
  }

  compAt(x, y) {
    let best = -1, bd = 1e9;
    for (let i = 0; i < 3; i++) { const d = Math.abs(x - this.compPos(i).x); if (d < bd) { bd = d; best = i; } }
    const cy = compY();
    return (bd <= RIM.rx + 26 && Math.abs(y - cy) < 150) ? best : -1;
  }

  onBtn(b, x, y) { return Math.abs(x - b.x) < b.w / 2 && Math.abs(y - b.y) < b.h / 2; }

  // ================================================================= actions
  /** Take one piece of denomination `i` off the shelf and drop it in its compartment. */
  addPiece(i, { from = null } = {}) {
    if (!this.ctrl.canPay || this.busy || this.ended) return false;
    if (!this.ctrl.add(i)) { this.audio.flicker(); return false; }
    const a = from || this.trayPos(i), b = this.compPos(i);
    this.move({ kind: 'coin', i, from: { x: a.x, y: a.y - 30 }, to: { x: b.x, y: b.y - 10 }, dur: 0.42 }, () => this.audio.coinStack());
    this.audio.coinPick();
    this.log('currency_selected', { denom: VALUES[i], amount: this.ctrl.total, pay_rule: this.ctrl.left > 0 ? 'under' : this.ctrl.left < 0 ? 'over' : 'exact' });
    this.log('amount_changed', { amount: this.ctrl.total, denom: VALUES[i] });
    this.audio.totalUpdate(true);
    if (this.hints) this.hints.onActivity();
    return true;
  }

  /** Take one piece of denomination `i` back off the counter (locked pieces stay). */
  removePiece(i) {
    if (!this.ctrl.canPay || this.busy || this.ended) return false;
    if (!this.ctrl.remove(i)) return false;
    this.audio.coinDrop();
    this.log('amount_changed', { amount: this.ctrl.total, denom: VALUES[i] });
    this.audio.totalUpdate(false);
    if (this.hints) this.hints.onActivity();
    return true;
  }

  /** Hand the counter to the shopkeeper. */
  payNow() {
    if (this.busy || this.ended || !this.ctrl.canPay) return;
    const shrink = this.ctrl.left >= 0;
    const r = this.ctrl.pay();
    if (!r) return;
    if (r.ok && r.repeat) {
      this.audio.flicker(); this.shake = 0.4;
      this.say('line.MATH-08.repeat', 3.6);
      this.log('pay_result', { pay_rule: 'repeat', amount: r.total, combo: r.combo });
      return;
    }
    if (!r.ok) {
      this.audio.flicker(); this.shake = 0.5;
      const def = r.mistake ? this.observe(r.mistake) : null;
      this.log('pay_result', {
        pay_rule: r.rule, amount: r.total, underpay: r.rule === 'under' ? 1 : 0, overpay: r.rule === 'over' ? 1 : 0,
        mistake: r.mistake, combo: r.combo, misconception: def ? def.code : null, alias: def ? def.alias : null,
      });
      this.say(r.rule === 'under' ? 'line.MATH-08.short' : 'line.MATH-08.over', 3.6);
      this.neo.play('think', 'idle');
      if (this.hints.onWrong() === 'assist') this.tl.after(0.9, () => this.applyAssist());
      return;
    }
    // right: the price is paid
    this.audio.coinStack(); this.audio.chime();
    this.fx.push({ kind: 'spark', x: compX(0), y: compY() - 40, t: 0 });
    this.log('pay_result', { pay_rule: 'exact', amount: r.total, combo: r.combo, solved: r.solved ? 1 : 0 });
    this.neo.play('happy', 'idle'); this.tiko.play('happy', 'idle');
    if (r.solved) {
      this.busy = true;
      this.say(this.stage.done_line_key, 3.4);
      this.audio.beamSwing(0);
      this.tl.after(1.0, () => { this.busy = false; this.onSolved(); });
    } else {
      this.say('line.MATH-08.again', 4.2);
      this.tl.after(0.6, () => { if (!this.ended) this.ctrl.clear(); });
    }
  }

  /** Clear the counter and try the same price in a different way. */
  againNow() {
    if (this.busy || this.ended || this.ctrl.state !== 'again') return;
    this.ctrl.clear(); this.audio.coinDrop();
  }

  applyAssist() {
    if (this.ended || !this.ctrl.canPay) return;
    const a = this.ctrl.assist();
    if (!a) return;
    this.stageAssisted = true;
    this.log('puzzle_interaction', { action: 'answer_assist', denom: a.unit >= 0 ? VALUES[a.unit] : 0 });
    this.fx.push({ kind: 'lock', unit: a.unit, t: 0 });
    this.audio.coinStack(); this.audio.hint();
    this.say('line.MATH-08.assist', 3.6);
    this.hints.assistActive = true;
  }

  onSolved() {
    this.ended = true; this.stageMaxHint = Math.max(this.stageMaxHint, this.hints.maxUsed);
    this.glow.target = 1;
    this.recordMastery(true);
    this.log('solved', { solved: 1, assisted: this.stageAssisted ? 1 : 0 });
    this.save.setPuzzle(this.stage.puzzle_id, { solved: true, hint_max: this.stageMaxHint, assisted: this.stageAssisted });
    const last = this.stageIdx >= this.puzzle.stages.length - 1;
    if (last) {
      this.save.setFlag(this.puzzle.world_state_on_solve, true);
      this.aliveMix.target = 1; this.audio.setLayers(4);
      this.lumi.mode = 'celebrate';
      this.neo.play('happy', 'idle'); this.tiko.play('happy', 'idle');
    } else {
      this.busy = true;
      this.tl.after(1.4, () => { this.busy = false; this.startStage(this.stageIdx + 1); this.neoHome(); });
    }
  }

  neoHome() { if (Math.abs(this.neo.x - NEO_HOME) > 6) this.neo.walkTo(NEO_HOME, () => this.neo.faceTowards(COUNTER.x)); }

  leave() {
    if (this.leaving || !this.onExit) return;
    this.leaving = { a: 0 };
    this.tl.after(0.5, () => this.onExit());
  }

  replay() {
    if (this.fade) return;
    this.fade = { a: 1 };
    this.tl.after(0.5, () => {
      const keep = { maxHint: this.stageMaxHint, hints: this.hints };
      this.startStage(this.stageIdx);
      this.hints.maxUsed = keep.hints.maxUsed; this.hints.wrong = keep.hints.wrong; this.hints.available = keep.hints.available;
      this.stageMaxHint = keep.maxHint;                    // stageAssisted stays: a reset does not erase an Assist
      this.fade = null; this.neoHome(); this.audio.snap();
    });
  }

  resetStage() {
    if (this.fade || this.busy) return;
    const keep = { maxHint: this.stageMaxHint, hints: this.hints };
    this.startStage(this.stageIdx);
    this.hints.maxUsed = keep.hints.maxUsed; this.hints.wrong = keep.hints.wrong; this.hints.available = keep.hints.available;
    this.stageMaxHint = keep.maxHint;                      // stageAssisted stays: a reset does not erase an Assist
    this.neoHome(); this.audio.snap();
  }

  move(m, done) { const mv = { ...m, t: 0, done }; this.movers.push(mv); return mv; }

  // ================================================================= input
  pointerDown(x, y) {
    this.audio.unlock();
    if (this.hints) this.hints.onActivity();
    for (const [name, b] of Object.entries(BTN)) if (Math.hypot(x - b.x, y - b.y) <= BTN_R) return this.button(name);
    if (this.fade || this.leaving) return;
    if (this.ended && this.onExit && Math.hypot(x - EXIT.x, y - EXIT.y) < EXIT.r) return this.leave();
    this.down = { x, y };
    if (this.busy || this.ended) return;
    if (this.onBtn(PAY_BTN, x, y)) return this.payNow();
    if (this.onBtn(AGAIN_BTN, x, y)) return this.againNow();
    // the pieces already on the counter: take one back
    const c = this.compAt(x, y);
    if (c >= 0 && this.ctrl.counts[c] > 0) { this.removePiece(c); return; }
    const s = this.stackAt(x, y);
    if (s >= 0 && this.ctrl.inTray[s] > 0) {
      this.drag = { kind: 'coin', i: s, moved: false, from: this.trayPos(s),
        p: new Spring2(this.trayPos(s).x, this.trayPos(s).y - 40, { stiffness: 300, damping: 24 }) };
      this.audio.coinPick();
      return;
    }
    for (const a of this.actors) if (a.hit(x, y)) { a.play('happy', 'idle'); return; }
  }

  pointerMove(x, y) {
    if (!this.drag) return;
    if (this.down && Math.hypot(x - this.down.x, y - this.down.y) > 12) this.drag.moved = true;
    if (this.drag.moved) this.drag.p.to(x, y - 30);
  }

  pointerUp(x, y) {
    const d = this.drag; this.drag = null;
    if (!d || this.busy) return;
    if (!d.moved) { this.addPiece(d.i); return; }              // a tap is enough — dragging is forgiving
    const c = this.compAt(x, y);
    if (c === d.i || c < 0) this.addPiece(d.i, { from: { x: d.p.x.value, y: d.p.y.value } });
    else { this.addPiece(d.i, { from: { x: d.p.x.value, y: d.p.y.value } }); }   // a piece always goes to its own compartment
  }

  button(name) {
    this.pressT = { ...(this.pressT || {}), [name]: PRESS_S };
    const busy = this.fade || this.busy;
    if (name === 'hint') {
      if (busy || this.ended) return;
      const h = this.hints.request();
      if (!h) return;
      this.audio.hint();
      this.log(`hint_${h.level}_used`, { hint_level: h.level });
      this.showHint(h);
    } else if (name === 'undo') {
      if (busy || this.ended || !this.ctrl.undoStack.length) return;
      this.ctrl.undo(); this.audio.coinDrop(); this.audio.snap();
      this.log('puzzle_interaction', { action: 'undo' });
    } else if (name === 'reset') {
      if (busy && !this.ended) return;
      this.resetStage();
    }
  }

  showHint(h) {
    this.stageMaxHint = Math.max(this.stageMaxHint, h.level);
    this.hintShow = h.level; this.hintUntil = this.t + 6;
    this.say(h.text_key, 5.0);
    if (h.level === 1) {                     // LUMI flies along the three tray tags; each tag pulses in turn
      this.lumi.mode = 'tags';
      this.neo.play('point', 'idle');
    } else if (h.level === 2) {              // the biggest unit the price still needs is highlighted
      this.hintUnit = this.ctrl.hintUnit();
      this.lumi.mode = 'unit'; this.lumi.target = this.hintUnit >= 0 ? this.trayPos(this.hintUnit) : { x: COUNTER.x, y: compY() };
      if (this.hintUnit >= 0) this.fx.push({ kind: 'ring', unit: this.hintUnit, t: 0 });
    } else {                                 // one possible combination slides onto the counter
      const e = this.ctrl.showExample();
      if (e) {
        for (let i = 0; i < 3; i++) for (let k = e.from[i]; k < e.counts[i]; k++) {
          this.move({ kind: 'coin', i, from: { x: TRAY_X[i], y: trayY() - 30 }, to: { x: compX(i), y: compY() - 10 },
            dur: 0.5 + k * 0.06 }, k === e.counts[i] - 1 ? () => this.audio.coinStack() : null);
        }
        this.audio.coinPick();
      }
      this.lumi.mode = 'counter';
    }
  }

  // ================================================================= update
  update(dt) {
    if (this.pressT) for (const k in this.pressT) this.pressT[k] = Math.max(0, this.pressT[k] - dt);
    this.t += dt;
    this.tl.update(dt);
    if (this.hints && !this.ended && !this.busy) this.hints.tick(dt);
    for (const s of [this.aliveMix, this.glow]) s.update(dt);
    this.shake = Math.max(0, this.shake - dt * 1.6);
    if (this.drag) this.drag.p.update(dt);
    if (this.bubble) this.bubble.t += dt;
    if (this.hintShow && this.t > this.hintUntil) { this.hintShow = 0; this.lumi.mode = 'follow'; }
    for (const m of this.movers) { m.t += dt; if (m.t >= m.dur && !m.fin) { m.fin = true; if (m.done) m.done(); } }
    this.movers = this.movers.filter((m) => !m.fin);
    for (const f of this.fx) f.t += dt;
    const FXL = { spark: 0.9, lock: 0.8, ring: 1.6 };
    this.fx = this.fx.filter((f) => f.t < (FXL[f.kind] || 1));
    for (const a of this.actors) a.update(dt);
    if (this.neo.clip === 'idle') this.neo.faceTowards(COUNTER.x);
    if (this.tiko.clip === 'idle') this.tiko.faceTowards(COUNTER.x);
    // H2 keeps pointing at the piece the price still needs, but never at an empty tray
    if (this.hintShow === 2) this.hintUnit = this.ctrl.hintUnit();
    const lm = this.lumi, hp = this.neo.headPoint();
    if (lm.mode === 'follow') lm.p.to(hp.x - 70, hp.y - 70 + Math.sin(this.t * 2.1) * 12);
    else if (lm.mode === 'tags') { const k = Math.floor(this.t * 1.6) % 3; lm.p.to(TRAY_X[k], SHELF.top - 130 + Math.sin(this.t * 4) * 12); }
    else if (lm.mode === 'unit' && lm.target) lm.p.to(lm.target.x, lm.target.y - 120 + Math.sin(this.t * 4) * 14);
    else if (lm.mode === 'counter') lm.p.to(COUNTER.x - 300, compY() - 120 + Math.sin(this.t * 3) * 16);
    else if (lm.mode === 'celebrate') lm.p.to(960 + Math.cos(this.t * 1.6) * 420, 420 + Math.sin(this.t * 3.2) * 60);
    if (reduceMotion && lm.mode !== 'celebrate') lm.p.set(lm.p.x.target, lm.p.y.target);
    lm.p.update(dt);
  }

  // ================================================================= draw
  img(name) { return this.sprites.get(name); }

  draw(ctx) {
    ctx.save();
    if (this.shake > 0) ctx.translate(Math.sin(this.t * 40) * this.shake * 5, 0);
    const plate = this.img('mkt_money'), alive = this.img('mkt_money_on');
    if (plate) ctx.drawImage(plate, 0, 0, W, H);
    if (alive && this.aliveMix.value > 0.01) {
      ctx.globalAlpha = Math.min(1, this.aliveMix.value); ctx.drawImage(alive, 0, 0, W, H); ctx.globalAlpha = 1;
    }
    this.drawSeller(ctx);
    this.drawShelf(ctx);
    this.drawCounter(ctx);
    this.drawPieces(ctx);
    this.drawPrice(ctx);
    this.drawReadout(ctx);
    this.tiko.draw(ctx);
    this.neo.draw(ctx);
    for (const m of this.movers) this.drawMover(ctx, m);
    for (const f of this.fx) this.drawFx(ctx, f);
    this.drawDragged(ctx);
    this.drawLumi(ctx);
    ctx.restore();
    this.drawHud(ctx);
  }

  /** A soft contact shadow: the pipeline keys the sprites out of their art, so the engine puts the shadow back. */
  drawShadow(ctx, x, y, rx, ry, a = 0.42) {
    ctx.save();
    const g = ctx.createRadialGradient(x, y, 1, x, y, rx);
    g.addColorStop(0, `rgba(28,16,6,${a})`); g.addColorStop(0.55, `rgba(28,16,6,${a * 0.55})`);
    g.addColorStop(1, 'rgba(28,16,6,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  /** The shopkeeper behind the counter: CHAR_MERCHANT (batch 20), cut from his turnaround — no rig yet. */
  drawSeller(ctx) {
    const im = this.img('merchant_front') || this.img('vil_shop_front'); if (!im) return;
    const h = SELLER.h, w = h * (im.width / im.height);
    this.drawShadow(ctx, SELLER.x, SELLER.ground - 4, w * 0.52, 26);
    ctx.drawImage(im, SELLER.x - w / 2, SELLER.ground - h, w, h);
  }

  /** The token shelf: a wooden bench with three stacks and a brass value tag under each. */
  drawShelf(ctx) {
    const b = SHELF;
    this.drawShadow(ctx, (b.x0 + b.x1) / 2, b.top + b.h - 2, (b.x1 - b.x0) * 0.48, 22, 0.4);
    ctx.save();
    const g = ctx.createLinearGradient(0, b.top, 0, b.top + b.h);
    g.addColorStop(0, '#8d6234'); g.addColorStop(0.18, '#6f4a26'); g.addColorStop(1, '#4a3018');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.roundRect(b.x0, b.top, b.x1 - b.x0, b.h, 12); ctx.fill();
    ctx.strokeStyle = 'rgba(214,170,80,0.85)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(b.x0, b.top, b.x1 - b.x0, b.h, 12); ctx.stroke();
    ctx.fillStyle = 'rgba(255,225,170,0.18)'; ctx.fillRect(b.x0 + 8, b.top + 3, b.x1 - b.x0 - 16, 5);
    ctx.restore();
    for (let i = 0; i < 3; i++) {
      const p = this.trayPos(i), left = this.ctrl.inTray[i];
      // the stack that is left in the tray
      const n = Math.min(left, 4), w = PIECE_W[TOKEN_SPRITE[i]];
      for (let k = 0; k < n; k++) this.drawPiece(ctx, i, p.x, p.y - k * STACK_DY, w * (1 - 0.04 * k), 1);
      const tag = { x: p.x, y: b.top + b.h - 26, w: 132, h: 44 };
      const hot = this.hintShow === 2 && this.hintUnit === i;
      ctx.save();
      const tg = ctx.createLinearGradient(0, tag.y - tag.h / 2, 0, tag.y + tag.h / 2);
      tg.addColorStop(0, 'rgba(232,196,112,0.97)'); tg.addColorStop(1, 'rgba(186,140,62,0.97)');
      ctx.fillStyle = tg; ctx.strokeStyle = hot ? `rgba(${AMBER.join(',')},0.95)` : 'rgba(120,84,28,0.9)';
      ctx.lineWidth = hot ? 4 : 2;
      ctx.beginPath(); ctx.roundRect(tag.x - tag.w / 2, tag.y - tag.h / 2, tag.w, tag.h, 9); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#3d2a10'; ctx.font = `700 28px ${FONT}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.direction = 'rtl';
      ctx.fillText(faDigits(VALUES[i]), tag.x, tag.y + 1);
      ctx.restore();
      if (hot) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const gg = ctx.createRadialGradient(p.x, p.y - 40, 6, p.x, p.y - 40, 120);
        gg.addColorStop(0, `rgba(255,200,110,${0.30 + 0.18 * Math.sin(this.t * 5)})`); gg.addColorStop(1, 'rgba(255,200,110,0)');
        ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(p.x, p.y - 40, 120, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }
    }
  }

  /** The portable pay counter: the prop, its three compartments and the H2 ghost piece. */
  drawCounter(ctx) {
    const im = this.img('market_counter'); if (!im) return;
    const x = COUNTER.x - COUNTER.w / 2, y = counterTop();
    this.drawShadow(ctx, COUNTER.x, COUNTER.bottom - 6, COUNTER.w * 0.5, 30, 0.5);
    ctx.drawImage(im, x, y, COUNTER.w, COUNTER_H);
    for (let i = 0; i < 3; i++) {
      const p = this.compPos(i);
      ctx.save();
      ctx.strokeStyle = 'rgba(120,84,28,0.75)'; ctx.lineWidth = 3;
      ctx.fillStyle = 'rgba(52,32,12,0.45)';
      ctx.beginPath(); ctx.ellipse(p.x, p.y, RIM.rx, RIM.ry, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(232,196,112,0.5)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(p.x, p.y - 2, RIM.rx - 5, RIM.ry - 4, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    // H2: a ghost piece drifts from the highlighted tray towards its compartment
    if (this.hintShow === 2 && this.hintUnit >= 0) {
      const k = 0.5 + 0.5 * Math.sin(this.t * 3);
      const a = this.trayPos(this.hintUnit), b = this.compPos(this.hintUnit);
      ctx.save(); ctx.globalAlpha = 0.30 + 0.25 * k;
      this.drawPiece(ctx, this.hintUnit, lerp(a.x, b.x, k * 0.5), lerp(a.y - 40, b.y - 20, k * 0.5), PIECE_W[TOKEN_SPRITE[this.hintUnit]]);
      ctx.restore();
    }
  }

  /** What is on the counter: one stack per compartment, with the count beside it. */
  drawPieces(ctx) {
    for (let i = 0; i < 3; i++) {
      const n = this.ctrl.counts[i]; if (!n) continue;
      const p = this.compPos(i), w = PIECE_W[TOKEN_SPRITE[i]];
      for (let k = 0; k < Math.min(n, 6); k++) {
        const locked = k < this.ctrl.locked[i];
        this.drawPiece(ctx, i, p.x + (k % 2 ? 5 : -5), p.y - 8 - k * STACK_DY, w * (1 - 0.03 * k), 1, locked);
      }
      ctx.save();
      ctx.fillStyle = 'rgba(40,26,10,0.72)';
      const bw = 74, bh = 46, bx = p.x, by = p.y + 86;
      ctx.beginPath(); ctx.roundRect(bx - bw / 2, by - bh / 2, bw, bh, 10); ctx.fill();
      ctx.fillStyle = `rgba(${GOLD.join(',')},1)`; ctx.font = `700 34px ${FONT}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.direction = 'rtl';
      ctx.fillText(faDigits(n), bx, by + 1);
      ctx.restore();
    }
  }

  /** One token: the sprite, plus a warm rim when it is locked by a hint. */
  drawPiece(ctx, i, x, y, w, alpha = 1, locked = false) {
    const im = this.img(TOKEN_SPRITE[i]);
    if (!im) return;
    const h = w * (im.height / im.width);
    ctx.save(); ctx.globalAlpha = alpha;
    if (locked) {
      ctx.strokeStyle = `rgba(${GOLD.join(',')},0.9)`; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.roundRect(x - w / 2 - 4, y - h - 4, w + 8, h + 8, 10); ctx.stroke();
    }
    ctx.drawImage(im, x - w / 2, y - h, w, h);
    ctx.restore();
  }

  /** The price board: what is being bought and what it costs. */
  drawPrice(ctx) {
    const b = PRICE;
    ctx.save();
    ctx.translate(b.x, b.y);
    const g = ctx.createLinearGradient(0, -b.h / 2, 0, b.h / 2);
    g.addColorStop(0, 'rgba(238,208,128,0.96)'); g.addColorStop(1, 'rgba(196,150,66,0.96)');
    ctx.fillStyle = g; ctx.strokeStyle = 'rgba(120,84,28,0.9)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.roundRect(-b.w / 2, -b.h / 2, b.w, b.h, 16); ctx.fill(); ctx.stroke();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.direction = 'rtl';
    ctx.fillStyle = '#4a3418'; ctx.font = `700 34px ${FONT}`;
    ctx.fillText(this.stage.item_fa, 0, -b.h / 2 + 34);
    ctx.font = `800 58px ${FONT}`; ctx.fillStyle = '#3a2408';
    ctx.fillText(`بها: ${faDigits(this.stage.target)} تومان`, 0, b.h / 2 - 40);
    if (this.glow.value > 0.01) {
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5 * this.glow.value;
      const gg = ctx.createRadialGradient(0, 0, 10, 0, 0, b.w / 2);
      gg.addColorStop(0, 'rgba(255,220,140,0.8)'); gg.addColorStop(1, 'rgba(255,220,140,0)');
      ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(0, 0, b.w / 2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  /** What is on the counter and what is still left (the card's Target / Current / Remaining). */
  drawReadout(ctx) {
    const b = READOUT, left = this.ctrl.left;
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.fillStyle = 'rgba(28,20,10,0.82)'; ctx.strokeStyle = 'rgba(214,170,80,0.9)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(-b.w / 2, -b.h / 2, b.w, b.h, 14); ctx.fill(); ctx.stroke();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.direction = 'rtl';
    ctx.font = `700 36px ${FONT}`;
    ctx.fillStyle = `rgba(${GOLD.join(',')},0.98)`;
    ctx.fillText(`روی پیشخوان: ${faDigits(this.ctrl.total)} تومان`, 0, -b.h / 2 + 32);
    let txt, col;
    if (left === 0) { txt = 'درست! همین مقدار'; col = 'rgba(180,240,170,0.98)'; }
    else if (left > 0) { txt = `مانده: ${faDigits(left)} تومان`; col = `rgba(${AMBER.join(',')},0.98)`; }
    else { txt = `زیادی: ${faDigits(-left)} تومان`; col = 'rgba(255,150,130,0.98)'; }
    ctx.fillStyle = col; ctx.font = `800 42px ${FONT}`;
    ctx.fillText(txt, 0, b.h / 2 - 30);
    ctx.restore();
    // the two scene buttons
    this.drawSceneButton(ctx, PAY_BTN, 'پرداخت', !this.busy && !this.ended && this.ctrl.pieces > 0, 'rgba(214,170,80,0.95)');
    this.drawSceneButton(ctx, AGAIN_BTN, 'دوباره', !this.busy && !this.ended && this.ctrl.state === 'again', 'rgba(150,110,50,0.9)');
  }

  drawSceneButton(ctx, b, label, enabled, stroke) {
    ctx.save();
    ctx.globalAlpha = enabled ? 1 : 0.4;
    const g = ctx.createLinearGradient(0, b.y - b.h / 2, 0, b.y + b.h / 2);
    g.addColorStop(0, enabled ? '#8d6234' : '#5a4526'); g.addColorStop(1, enabled ? '#6a4523' : '#3f3119');
    ctx.fillStyle = g; ctx.strokeStyle = stroke; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h, 14); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#f6e6c2'; ctx.font = `700 38px ${FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.direction = 'rtl';
    ctx.fillText(label, b.x, b.y + 1);
    ctx.restore();
  }

  drawMover(ctx, m) {
    if (m.kind !== 'coin') return;
    const k = Math.min(1, m.t / m.dur);
    const x = lerp(m.from.x, m.to.x, ease.inOutSine(k));
    const y = arcY(m.from.y, m.to.y, k, 70);
    this.drawPiece(ctx, m.i, x, y, PIECE_W[TOKEN_SPRITE[m.i]] * lerp(1.05, 1, k));
  }

  drawFx(ctx, f) {
    const k = f.t;
    if (f.kind === 'spark') {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 + k, r = 30 + 80 * Math.min(1, k / 0.9);
        ctx.fillStyle = `rgba(255,230,160,${0.85 * (1 - Math.min(1, k / 0.9))})`;
        ctx.beginPath(); ctx.arc(f.x + Math.cos(a) * r, f.y + Math.sin(a) * r * 0.6, 5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    } else if (f.kind === 'lock' && f.unit >= 0) {
      const p = this.compPos(f.unit);
      ctx.save(); ctx.strokeStyle = `rgba(${GOLD.join(',')},${0.9 * (1 - Math.min(1, k / 0.8))})`; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.ellipse(p.x, p.y, RIM.rx + 8, RIM.ry + 8, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    } else if (f.kind === 'ring' && f.unit >= 0) {
      const p = this.trayPos(f.unit);
      ctx.save(); ctx.strokeStyle = `rgba(${AMBER.join(',')},${0.8 * (1 - k / 1.6)})`; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.ellipse(p.x, p.y - 20, RIM.rx + 20 + 40 * k, RIM.ry + 12 + 24 * k, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
  }

  drawDragged(ctx) {
    const d = this.drag;
    if (!d || !d.moved) return;
    const p = this.compAt(d.p.x.value, d.p.y.value);
    if (p >= 0) {
      const c = this.compPos(p);
      ctx.save(); ctx.strokeStyle = `rgba(${GOLD.join(',')},0.9)`; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.ellipse(c.x, c.y, RIM.rx + 6, RIM.ry + 6, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
    this.drawPiece(ctx, d.i, d.p.x.value, d.p.y.value + 30, PIECE_W[TOKEN_SPRITE[d.i]] * 1.06);
  }

  drawLumi(ctx) {
    const lm = this.lumi, x = lm.p.x.value, y = lm.p.y.value;
    const pulse = 1 + 0.06 * Math.sin(this.t * 5) + (lm.mode === 'celebrate' ? 0.1 * Math.sin(this.t * 14) : 0);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y, 4, x, y, 90 * pulse);
    g.addColorStop(0, 'rgba(255,230,170,0.55)'); g.addColorStop(1, 'rgba(255,200,120,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 90 * pulse, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    const im = this.img('lumi_front'), s = 0.42 * pulse;
    if (im) ctx.drawImage(im, x - 128 * s, y - 128 * s, 256 * s, 256 * s);
  }

  drawHud(ctx) {
    const S = this.sprites, text = this.objective();
    ctx.save();
    ctx.font = `700 38px ${FONT}`; ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = ctx.measureText(text).width + 90;
    ctx.fillStyle = 'rgba(250,240,215,0.93)'; ctx.strokeStyle = 'rgba(150,110,50,0.8)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(W / 2 - w / 2, 34, w, 74, 20); ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK; ctx.fillText(text, W / 2, 73);
    if (this.bubble) {
      const a = Math.min(1, this.bubble.t / 0.3); ctx.globalAlpha = a;
      ctx.font = `700 34px ${FONT}`;
      const bw = ctx.measureText(this.bubble.text).width + 80, hd = this.neo.headPoint();
      const bx = Math.min(W - bw / 2 - 20, Math.max(bw / 2 + 20, hd.x - 60));
      const by = Math.max(300, hd.y - 150);
      ctx.fillStyle = 'rgba(255,248,226,0.96)'; ctx.strokeStyle = 'rgba(214,170,80,0.95)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.roundRect(bx - bw / 2, by, bw, 66, 33); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(hd.x - 20, by + 64); ctx.lineTo(hd.x, by + 96); ctx.lineTo(hd.x + 12, by + 64); ctx.fill();
      ctx.fillStyle = '#5a3e14'; ctx.fillText(this.bubble.text, bx, by + 34); ctx.globalAlpha = 1;
    }
    ctx.restore();
    const pr = this.pressT || {}, busy = this.busy;
    drawHudButton(ctx, S, 'btn_hint', BTN.hint, BTN_R, { disabled: busy || this.ended, available: this.hints.available, pressed: pr.hint, t: this.t });
    drawHudButton(ctx, S, 'btn_undo', BTN.undo, BTN_R, { disabled: busy || this.ended || !this.ctrl.undoStack.length, pressed: pr.undo, t: this.t });
    drawHudButton(ctx, S, 'btn_reset', BTN.reset, BTN_R, { disabled: busy && !this.ended, available: this.ended, pressed: pr.reset, t: this.t });
    this.puzzle.stages.forEach((st, k) => {
      const done = k < this.stageIdx || (k === this.stageIdx && this.ended);
      ctx.fillStyle = done ? 'rgba(255,200,90,0.95)' : k === this.stageIdx ? 'rgba(255,240,210,0.9)' : 'rgba(255,240,210,0.35)';
      ctx.beginPath(); ctx.arc(W / 2 - 14 + k * 28, 128, 7.5, 0, Math.PI * 2); ctx.fill();
    });
    if (this.ended && this.onExit && !this.fade) drawExitArrow(ctx, EXIT, this.t, reduceMotion);
    if (this.fade) { ctx.fillStyle = `rgba(22,16,10,${(1 - this.fade.a) * 0.85})`; ctx.fillRect(0, 0, W, H); }
    if (this.leaving) { ctx.fillStyle = `rgba(20,12,6,${this.leaving.a})`; ctx.fillRect(0, 0, W, H); }
  }

  debugState() {
    const c = this.ctrl;
    return {
      puzzle: this.stage.puzzle_id, state: c.state, counts: c.counts.join('-'), total: c.total, left: c.left,
      tray: c.inTray.join('-'), combos: c.combos.join(' ') || '-', locked: c.locked.join('-'),
      hint_level: this.hints.level, hint_unit: this.hintUnit, hint_available: this.hints.available,
      wrong: this.hints.wrong, assisted: this.stageAssisted, busy: this.busy,
      flagged: [...this.misc.flagged].join(',') || '-', mastery: this.mastery.get(this.puzzle.concept_id),
      world: Object.keys(this.save.data.world).join(',') || '-', music_layers: this.audio.layers,
    };
  }
}
