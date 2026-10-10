// LUMA — Room WS_MAIN_FLOOR / opening «کوک» (plan 12 §2): MIRA winds NEO → LUMI pops out → the window shows the dark
// village → gear tutorial (1 gear → 2 gears, alternating direction → 3 gears of the right sizes) → the hatch opens,
// NEO takes the key and walks out of the workshop door towards the plaza (Q01).
// Teaches: tap-to-walk, drag, snap, undo (and reset / hint ladder), without words. No mastery is recorded.
import { drawHudButton, PRESS_S } from '../engine/hud.js';
import { GearChainController } from '../puzzles/gear_chain.js';
import { HintEngine, AnalyticsQueue, SaveSlot } from '../edu/engines.js';
import { Spring, Spring2, Timeline, ease, reduceMotion } from '../engine/motion.js';
import { RigActor } from '../engine/rig.js';

export const W = 1920, H = 1080;
const GROUND = 1010;                                  // character feet on the workshop floor
const BS = 0.95, BOX = 650, BOY = -270.75;            // board sprite (1024 px) → canvas: x = BOX + bx·BS, y = BOY + by·BS
const B = (bx, by) => ({ x: BOX + bx * BS, y: BOY + by * BS });
const BOARD_CX = B(512, 0).x;
const workX = (pz) => B(pz.walk_gate.work_spot_board_x, 0).x;   // left edge of the board: NEO never hides the pegs
const TRAY = [1260, 1400, 1540, 1680].map((x) => ({ x, y: 912 }));
const TRAY_S = 0.8;                                   // gears lie a little smaller on the floor (perspective)
const BTN = { hint: { x: 90, y: 90 }, undo: { x: 220, y: 90 }, reset: { x: 350, y: 90 } };
const BTN_R = 58;
const WINDOW = { x: 1335, y: 132, r: 150 };
const LAMP = { x: 962, y: 212 };                      // hanging lantern LUMI pops out of
const DOOR = { x0: 1745, x1: 1900, y0: 262, y1: 1000 };
const STATION = { x: 176, y: 742 };                   // MIRA's winding stand (key on the stool)

export class WorkshopTutorial {
  constructor({ sprites, puzzle, audio, storage, debug, onExit }) {
    Object.assign(this, { sprites, puzzle, audio, debug, onExit });
    this.save = new SaveSlot(storage);
    this.analytics = new AnalyticsQueue(storage, puzzle.analytics_fields);
    this.tl = new Timeline();
    this.t = 0; this.attempt = 0; this.drag = null; this.fx = []; this.angle = {}; this.jamT = 0;
    this.lumi = { p: new Spring2(LAMP.x, LAMP.y, { stiffness: 26, damping: 8 }), mode: 'hidden', target: null };
    this.fade = { a: 0 };                           // 0 = black, 1 = visible
    this.hatch = new Spring(0, { stiffness: 40, damping: 9 });   // 0 closed … 1 open
    this.tumblers = [0, 0, 0];
    this.phase = 'intro';
  }

  async load() {
    this.neo = await new RigActor({ id: 'NEO', scale: 0.36, x: 400, groundY: GROUND, face: 1 }).load();
    this.tiko = await new RigActor({ id: 'TIKO', scale: 0.2, x: 560, groundY: GROUND, face: -1, follow: true, gap: 190 }).load();
    this.actors = [this.tiko, this.neo];
    this.mira = { x: 205, lean: new Spring(0, { stiffness: 60, damping: 8 }), hop: 0 };
    // resume: first unsolved stage; the intro plays only the first time
    const first = this.puzzle.stages.findIndex((s) => !(this.save.puzzle(s.puzzle_id) || {}).solved);
    const stage = first < 0 ? this.puzzle.stages.length - 1 : first;
    this.stages = this.puzzle.stages;
    for (let k = 0; k < stage; k++) this.tumblers[k] = 1;
    this.startStage(stage);
    if (this.save.flag('WS_INTRO_SEEN') || stage > 0) this.skipIntro(true); else this.playIntro();
    return this;
  }

  // ---------------------------------------------------------------- intro (skippable by tapping)
  playIntro() {
    this.phase = 'intro'; this.neo.rate = 0; this.neoAsleep = true; this.windT = -1;
    this.tl.tween(1.2, (k) => { this.fade.a = k; });
    this.tl.after(0.9, () => { this.windT = 0; });                       // MIRA turns the key three times
    for (let i = 0; i < 3; i++) this.tl.after(1.0 + i * 0.75, () => { this.audio.windClick(); this.mira.lean.target = 0.07; this.tl.after(0.3, () => { this.mira.lean.target = 0; }); });
    this.tl.after(3.4, () => {                                           // NEO wakes up
      this.windT = -1; this.neoAsleep = false; this.wakeGlow = 1; this.neo.rate = 1; this.neo.play('happy', 'idle'); this.audio.wake();
      this.mira.hop = 0.5; this.tiko.play('happy', 'idle');
    });
    this.tl.after(4.4, () => {                                           // LUMI pops out of the hanging lantern
      this.lumi.mode = 'free'; this.lumi.p.set(LAMP.x, LAMP.y + 30); this.fx.push({ kind: 'pop', x: LAMP.x, y: LAMP.y + 30, t: 0 });
      this.audio.hint(); this.lumi.path = [[700, 520], [470, 640], [860, 420]]; this.lumi.pathT = 0;
    });
    this.tl.after(6.4, () => { this.lumi.path = null; this.lumi.target = { x: WINDOW.x - 60, y: WINDOW.y + 40 }; this.lumi.mode = 'free'; });
    this.tl.after(7.0, () => { this.spot = { x: WINDOW.x, y: WINDOW.y, a: 0 }; this.audio.dusk(); this.neo.walkTo(520); });
    this.tl.after(7.0, () => this.tl.tween(0.7, (k) => { if (this.spot) this.spot.a = k; }));
    this.tl.after(9.4, () => this.tl.tween(0.7, (k) => { if (this.spot) this.spot.a = 1 - k; }, () => { this.spot = null; }));
    this.tl.after(9.8, () => this.beginPlay());
  }
  skipIntro(silent = false) {
    this.tl.clear(); this.spot = null; this.windT = -1; this.neoAsleep = false; this.neo.rate = 1; this.fade.a = 1;
    this.lumi.mode = 'free'; this.lumi.path = null;
    if (!silent) this.log('intro_skipped', {});
    this.beginPlay();
  }
  beginPlay() {
    this.save.setFlag('WS_INTRO_SEEN');
    this.phase = 'play';
    this.guideLumi();
    if (!this.nearBoard()) this.floorMark = { x: workX(this.puzzle), t: 0 };   // glowing footprint invites tap-to-walk
  }

  // ---------------------------------------------------------------- stage flow
  startStage(idx) {
    this.stageIdx = idx; this.stage = this.stages[idx];
    this.hints = new HintEngine(this.puzzle.hints, this.puzzle.answer_assist);
    this.ctrl = new GearChainController(this.puzzle, this.stage, {
      onPlace: (i, type, kind) => this.onPlace(i, type, kind),
      onSolved: () => this.onSolved(),
      onChange: () => { this.ghost = null; this.rings = null; },
    });
    this.pegAnim = {}; this.stageStart = this.t; this.attempt++; this.assisted = false;
    this.audio.setLayers(idx);
    this.log('puzzle_start', {});
    this.save.setPuzzle(this.stage.puzzle_id, { solved: false, entered: new Date().toISOString() });
    if (this.phase === 'play') this.guideLumi();
  }
  log(name, extra) {
    const e = this.analytics.log(name, {
      puzzle_id: this.stage ? this.stage.puzzle_id : 'TUT', attempt_id: this.attempt,
      duration: Math.round((this.t - (this.stageStart || 0)) * 10) / 10, hint_level: this.hints ? this.hints.maxUsed : 0, ...extra,
    });
    if (this.debug) this.debug.push(e);
  }
  onPlace(i, type, kind) {
    this.hints.onActivity();
    this.log('object_dropped', { peg: i, gear_type: type, correct: kind === 'fits' });
    if (kind === 'fits') { this.audio.snap(); this.fx.push({ kind: 'spark', peg: i, t: 0 }); this.guideLumi(); return; }
    // wrong: a visible, comic consequence in the world — never a buzzer or a red cross (plan 06 §6)
    const out = this.hints.onWrong();
    if (kind === 'too_big') { this.jamT = 0.7; this.audio.clunk(); } else { this.pegAnim[i] = { wobble: 0.8 }; this.audio.flicker(); }
    this.log('wrong_state', { peg: i, gear_type: type, error_type: 'SizeMismatch', wrong_kind: kind });
    if (out === 'assist') { this.ctrl.applyAssist(); this.assisted = true; this.log('puzzle_interaction', { action: 'answer_assist' }); }
  }
  onSolved() {
    const idx = this.stageIdx;
    this.log('puzzle_solved', { assisted: this.assisted });
    this.save.setPuzzle(this.stage.puzzle_id, { solved: true, hint_max: this.hints.maxUsed, assisted: this.assisted });
    this.tl.after(0.5, () => { this.tumblers[idx] = 1; this.audio.tumbler(); this.fx.push({ kind: 'tumbler', k: idx, t: 0 }); });
    this.audio.setLayers(idx + 1);
    this.neo.faceTowards(BOARD_CX); this.tl.after(0.4, () => this.neo.play('happy', 'idle'));
    this.lumi.mode = 'free'; this.lumi.target = { x: B(695, 700).x, y: B(695, 700).y - 40 };
    if (idx < this.stages.length - 1) {
      this.tl.after(2.6, () => this.swapStage(() => this.startStage(idx + 1)));
    } else {
      this.tl.after(1.8, () => this.payoff());
    }
  }
  swapStage(fn) {                                   // gears lift off and the next set slides in (0.5 s + 0.5 s)
    this.gearFade = 1;
    this.tl.tween(0.5, (k) => { this.gearFade = 1 - k; }, () => { fn(); this.tl.tween(0.5, (k) => { this.gearFade = k; }, () => { this.gearFade = null; }); });
  }

  // ---------------------------------------------------------------- payoff: hatch → key → door → plaza
  payoff() {
    this.phase = 'payoff';
    this.save.setFlag(this.puzzle.world_state_on_solve);
    this.hatch.target = 1; this.audio.door(); this.audio.motif(); this.audio.setLayers(4);
    this.lumi.mode = 'celebrate';
    this.mira.hop = 0.6;
    const keyAt = B(856, 819);
    this.tl.after(1.2, () => this.neo.walkTo(keyAt.x - 40, () => {
      this.neo.faceTowards(keyAt.x); this.neo.play('point', 'idle');
      this.key = { from: keyAt, t: 0 }; this.audio.chime();
    }));
  }
  keyTaken() {
    this.key = null; this.hasKey = true; this.neo.play('happy', 'idle'); this.lumi.mode = 'free';
    this.tl.after(1.0, () => this.neo.walkTo(DOOR.x0 + 30, () => {
      this.audio.door(); this.doorOpen = 0; this.tl.tween(1.2, (k) => { this.doorOpen = ease.outCubic(k); });
      this.lumi.target = { x: DOOR.x0 + 70, y: 520 };
      this.tl.after(1.3, () => this.neo.walkTo(W + 160));
      this.tl.after(2.4, () => this.tl.tween(0.9, (k) => { this.fade.a = 1 - k; }, () => { this.phase = 'done'; this.log('room_exit', { to: 'VIL_PLAZA' }); this.onExit && this.onExit(); }));
    }));
  }

  // ---------------------------------------------------------------- geometry helpers
  nearBoard() { return Math.abs(this.neo.x - workX(this.puzzle)) <= this.puzzle.walk_gate.near_px; }
  pegPos(i) { const p = this.puzzle.pegs[i]; return B(p.x, p.y); }
  type(id) { return this.puzzle.gear_types.find((g) => g.id === id); }
  trayItems() {
    return this.stage.tray.map((id, k) => ({ id, k, ...TRAY[k], enabled: this.ctrl.trayAvailable(k) }));
  }
  guideLumi() {                                   // LUMI hovers near the next empty peg (never on the answer)
    const i = this.ctrl.nextToFix();
    const p = i >= 0 ? this.pegPos(i) : B(512, 720);
    this.lumi.mode = 'free'; this.lumi.target = { x: p.x + 40, y: p.y - 150 };
  }

  // ---------------------------------------------------------------- input
  pointerDown(x, y) {
    this.audio.unlock();
    if (this.hints) this.hints.onActivity();
    if (this.phase === 'intro') return this.skipIntro();
    if (this.phase !== 'play' || this.gearFade != null) return;
    for (const [name, b] of Object.entries(BTN)) if (Math.hypot(x - b.x, y - b.y) <= BTN_R) return this.button(name);
    if (!this.ctrl.solved) {
      for (const it of this.trayItems()) {
        const r = this.type(it.id).pitch_r * BS * TRAY_S + 14;
        if (it.enabled && Math.hypot(x - it.x, y - it.y) < Math.max(r, 48)) {
          if (!this.nearBoard()) {                    // walk gate: NEO walks to the board first (teaches tap-to-walk)
            this.neo.walkTo(workX(this.puzzle)); this.floorMark = null;
            this.pegAnim['tray' + it.k] = { wobble: 0.5 }; this.log('puzzle_interaction', { action: 'walk_gate' });
            return;
          }
          this.audio.pickup();
          this.drag = { id: it.id, k: it.k, from: -1, p: new Spring2(it.x, it.y, { stiffness: 260, damping: 22 }) };
          this.drag.p.to(x, y);
          this.log('object_drag_started', { gear_type: it.id });
          return;
        }
      }
      for (let i = 0; i < this.puzzle.pegs.length; i++) {
        const p = this.pegPos(i);
        if (this.ctrl.canTake(i) && Math.hypot(x - p.x, y - p.y) < this.type(this.ctrl.placed[i]).pitch_r * BS + 10) {
          const id = this.ctrl.placed[i], k = this.ctrl.take(i);
          this.drag = { id, k, from: i, p: new Spring2(p.x, p.y, { stiffness: 260, damping: 22 }) };
          this.drag.p.to(x, y); this.audio.pickup();
          this.log('object_drag_started', { peg: i, gear_type: id });
          return;
        }
      }
    }
    for (const a of this.actors) if (a.hit(x, y)) { a.play('happy', 'idle'); return; }
    if (Math.abs(x - this.mira.x) < 70 && y > GROUND - 300 && y < GROUND) { this.mira.hop = 0.45; return; }
    if (y > 820) { this.neo.walkTo(Math.max(300, Math.min(DOOR.x0 - 40, x))); this.floorMark = null; }
  }
  pointerMove(x, y) { if (this.drag) this.drag.p.to(x, y); }
  pointerUp() {
    if (!this.drag) return;
    const d = this.drag; this.drag = null;
    let best = -1, bestD = 95;
    for (let i = 0; i < this.puzzle.pegs.length; i++) {
      if (!this.ctrl.canDrop(i)) continue;
      const p = this.pegPos(i), dd = Math.hypot(d.p.x.value - p.x, d.p.y.value - p.y);
      if (dd < bestD) { bestD = dd; best = i; }
    }
    if (best >= 0) {
      const p = this.pegPos(best);
      this.pegAnim[best] = { snap: new Spring2(d.p.x.value - p.x, d.p.y.value - p.y, { stiffness: 240, damping: 14 }) };
      this.pegAnim[best].snap.to(0, 0);
      this.angle[best] = 0;
      this.ctrl.place(best, d.k);
    } else {
      this.fx.push({ kind: 'return', id: d.id, k: d.k, x: d.p.x.value, y: d.p.y.value, t: 0 });
      this.log('object_dropped', { peg: null, gear_type: d.id, correct: null });
    }
  }
  button(name) {
    this.pressT = { ...(this.pressT || {}), [name]: PRESS_S };
    if (name === 'hint') {
      if (this.ctrl.solved) return;
      const h = this.hints.request(); if (!h) return;
      this.audio.hint(); this.log(`hint_${h.level}_used`, { hint_level: h.level }); this.showHint(h);
    } else if (name === 'undo') {
      const a = this.ctrl.undo(); if (a) { this.audio.snap(); this.log('puzzle_interaction', { action: 'undo', peg: a.peg }); }
    } else if (name === 'reset') {
      if (this.ctrl.solved) return;
      this.ctrl.reset(); this.audio.snap(); this.log('puzzle_interaction', { action: 'reset' });
    }
  }
  showHint(h) {
    const i = this.ctrl.nextToFix(); if (i < 0) return;
    const p = this.pegPos(i);
    if (h.level === 1) { this.lumi.target = { x: p.x, y: p.y - 110 }; this.lumi.glowPeg = i; this.lumi.glowT = 0; this.tl.after(4, () => { this.lumi.glowPeg = null; }); }
    else if (h.level === 2) { this.rings = this.puzzle.pegs.map((pg, k) => (this.stage.pegs[k] === 'empty' && this.ctrl.placed[k] !== pg.need ? k : -1)).filter((k) => k >= 0); }
    else { this.ghost = { peg: i, id: this.puzzle.pegs[i].need }; this.lumi.target = { x: p.x + 80, y: p.y - 120 }; }
  }

  // ---------------------------------------------------------------- update
  update(dt) {
    if (this.pressT) for (const k in this.pressT) this.pressT[k] = Math.max(0, this.pressT[k] - dt);
    if (this.wakeGlow > 0) this.wakeGlow = Math.max(0, this.wakeGlow - dt * 0.8);
    this.objA = Math.max(0, Math.min(1, (this.objA ?? 1) + (this.phase === 'play' ? 2 : -2) * dt));   // objective fades out for the payoff
    this.t += dt; this.tl.update(dt); if (this.hints && this.phase === 'play') this.hints.tick(dt);
    this.hatch.update(dt); this.mira.lean.update(dt);
    if (this.mira.hop > 0) this.mira.hop = Math.max(0, this.mira.hop - dt);
    if (this.windT >= 0) this.windT += dt;
    if (this.jamT > 0) this.jamT -= dt;
    if (this.drag) this.drag.p.update(dt);
    for (const k in this.pegAnim) { const a = this.pegAnim[k]; if (a.snap) a.snap.update(dt); if (a.wobble > 0) a.wobble -= dt; }
    for (const f of this.fx) f.t += dt;
    this.fx = this.fx.filter((f) => f.t < (f.kind === 'return' ? 0.45 : 1.2));
    if (this.floorMark) { this.floorMark.t += dt; if (this.nearBoard()) this.floorMark = null; }
    // gears turn with the rule result (ω integrated per node); the tick sound follows the drive gear
    const res = this.ctrl.result;
    for (const n of res.nodes) this.angle[n.key] = (this.angle[n.key] || 0) + n.omega * dt * (reduceMotion ? 0.5 : 1);
    this.tickAcc = (this.tickAcc || 0) + (res.nodes[0].state === 'turning' ? dt : 0);
    if (this.tickAcc > 0.6) { this.tickAcc = 0; if (this.phase === 'play') this.audio.gearTick(); }
    if (this.key) { this.key.t += dt; if (this.key.t >= 0.9) this.keyTaken(); }
    // TIKO follows NEO with quicker steps (playbackRate, plan 17)
    const L = this.neo, T = this.tiko, want = L.x - L.face * T.gap;
    const leadV = L.clips.walk.root_motion_px_per_s * L.scale, ownV = T.clips.walk.root_motion_px_per_s * T.scale;
    T.rate = T.clip === 'walk' ? Math.min(2.6, Math.max(1, (leadV / ownV) * (Math.abs(want - T.x) > 250 ? 1.15 : 1))) : 1;
    if (!this.neoAsleep && Math.abs(want - T.x) > 40 && (T.clip === 'idle' || T.clip === 'walk')) T.walkTo(Math.min(want, W + 120));
    if (T.clip === 'idle' && T.targetX === null) T.faceTowards(L.x);
    for (const a of this.actors) a.update(dt);
    // LUMI
    const lm = this.lumi;
    if (lm.path) {
      lm.pathT += dt * 0.9; const seg = Math.min(lm.path.length - 1, Math.floor(lm.pathT));
      lm.p.to(lm.path[seg][0] + Math.cos(this.t * 4) * 30, lm.path[seg][1] + Math.sin(this.t * 5) * 24);
    } else if (lm.mode === 'free' && lm.target) lm.p.to(lm.target.x + Math.cos(this.t * 2.2) * 26, lm.target.y + Math.sin(this.t * 2.9) * 16);
    else if (lm.mode === 'celebrate') lm.p.to(B(700, 0).x + Math.cos(this.t * 1.7) * 380, 330 + Math.sin(this.t * 3.4) * 70);
    if (lm.glowPeg != null) lm.glowT += dt;
    lm.p.update(dt);
  }

  // ---------------------------------------------------------------- draw
  draw(ctx) {
    const S = this.sprites;
    ctx.drawImage(S.get('ws_plate'), 0, 0, W, H);
    // the workshop warms up as the stages are solved (plate is "silent and broken" by default)
    const warm = this.tumblers.reduce((a, b) => a + b, 0) / 3 * 0.5 + this.hatch.value * 0.5;
    if (warm > 0) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const l of [[680, 190], [962, 212], [1590, 170], [1745, 170]]) {
        const g = ctx.createRadialGradient(l[0], l[1], 5, l[0], l[1], 260);
        g.addColorStop(0, `rgba(255,190,100,${0.28 * warm})`); g.addColorStop(1, 'rgba(255,190,100,0)');
        ctx.fillStyle = g; ctx.fillRect(l[0] - 260, l[1] - 260, 520, 520);
      }
      ctx.restore();
    }
    this.drawDoor(ctx);
    this.drawBoard(ctx);
    this.drawTray(ctx);
    if (this.floorMark) {                           // glowing footprints: "walk here"
      const a = 0.35 + 0.25 * Math.sin(this.floorMark.t * 4);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,225,150,${a})`;
      for (const [dx, dy] of [[-22, 0], [18, -10]]) { ctx.beginPath(); ctx.ellipse(this.floorMark.x + dx, GROUND - 6 + dy, 16, 8, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    }
    this.drawMira(ctx);
    for (const a of [...this.actors].sort((p, q) => p.scale - q.scale)) {
      if (a === this.neo && this.neoAsleep) { ctx.save(); ctx.filter = 'brightness(0.55) saturate(0.45)'; a.draw(ctx); ctx.restore(); }   // wound down = powered off
      else a.draw(ctx);
    }
    if (this.wakeGlow > 0) drawWakeGlow(ctx, this.neo, this.wakeGlow);
    if (this.windT >= 0) this.drawWindKey(ctx);
    if (this.hasKey && this.phase !== 'done') {     // the brass key rides on NEO's satchel
      const h = this.neo.headPoint(); this.drawKey(ctx, h.x - this.neo.face * 18, h.y + this.neo.heightPx * 0.42, 0.5, 0.3);
    }
    if (this.key) {                                 // key floats from the niche to NEO
      const k = ease.outCubic(Math.min(1, this.key.t / 0.9)), h = this.neo.headPoint();
      const x = this.key.from.x + (h.x - this.key.from.x) * k, y = this.key.from.y + (h.y + 60 - this.key.from.y) * k - Math.sin(k * Math.PI) * 120;
      this.drawKey(ctx, x, y, 0.9 - 0.4 * k, k * 6);
    }
    for (const f of this.fx) if (f.kind === 'return') {
      const k = f.t / 0.45, tr = TRAY[f.k];
      ctx.globalAlpha = 1 - k * 0.3;
      this.drawGear(ctx, f.id, f.x + (tr.x - f.x) * k, f.y + (tr.y - f.y) * k, 0, 1 - (1 - TRAY_S) * k);
      ctx.globalAlpha = 1;
    }
    if (this.drag) {
      const d = this.drag;
      ctx.fillStyle = 'rgba(40,25,10,0.2)'; ctx.beginPath(); ctx.ellipse(d.p.x.value + 14, d.p.y.value + 18, this.type(d.id).pitch_r * BS, this.type(d.id).pitch_r * BS * 0.9, 0, 0, Math.PI * 2); ctx.fill();
      this.drawGear(ctx, d.id, d.p.x.value, d.p.y.value, this.t * 0.4, 1.05);
    }
    this.drawFx(ctx);
    if (this.spot) {                                // attention on the window: the dark village waits
      const g = ctx.createRadialGradient(this.spot.x, this.spot.y, 120, this.spot.x, this.spot.y, 900);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(10,6,3,${0.62 * this.spot.a})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    this.drawLumi(ctx);
    if (this.phase === 'play' || this.phase === 'payoff') this.drawHud(ctx);
    if (this.fade.a < 1) { ctx.fillStyle = `rgba(12,8,5,${1 - this.fade.a})`; ctx.fillRect(0, 0, W, H); }
  }

  drawBoard(ctx) {
    const S = this.sprites, board = S.get('gear_board_niche') || S.get('gear_board');
    ctx.drawImage(board, BOX, BOY, 1024 * BS, 1024 * BS);
    if (this.hasKey || (this.key && this.key.t > 0.05)) {   // key lifted out: the painted key gives way to an empty brass recess
      const c = B(856, 819), rx = 90 * BS * 0.93, ry = 97 * BS * 0.93;
      const g = ctx.createRadialGradient(c.x - rx * 0.25, c.y - ry * 0.3, 4, c.x, c.y, ry);
      g.addColorStop(0, '#6a4a26'); g.addColorStop(0.7, '#4a3118'); g.addColorStop(1, '#2c1c0c');
      ctx.save(); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(c.x, c.y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,215,140,0.25)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(c.x, c.y, rx - 3, ry - 3, 0, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();
      ctx.fillStyle = 'rgba(255,220,150,0.12)'; ctx.beginPath(); ctx.ellipse(c.x - 18, c.y + 10, 30, 42, -0.4, 0, Math.PI * 2); ctx.fill();   // key-shaped dust ghost
      ctx.restore();
    }
    // hatch door: swings on its left hinge (scaleX = cos θ), shading darkens as it turns away
    const hd = S.get('hatch_door'), info = S.info('hatch_door');
    if (hd && info) {
      const th = Math.max(0, Math.min(1, this.hatch.value)) * Math.PI * 0.46, c = Math.cos(th);
      const px = BOX + info.pivot_board[0] * BS, py = BOY + info.pivot_board[1] * BS;
      ctx.save(); ctx.translate(px + info.hinge_x_local * BS, py); ctx.scale(c, 1 + 0.05 * Math.sin(th));
      ctx.drawImage(hd, -info.hinge_x_local * BS, 0, hd.width * BS, hd.height * BS);
      if (th > 0.01) { ctx.fillStyle = `rgba(30,18,8,${0.45 * Math.sin(th)})`; ctx.fillRect(-info.hinge_x_local * BS, 0, hd.width * BS, hd.height * BS); }
      ctx.restore();
    }
    // tumbler bulbs (wordless stage progress) under the board
    for (let k = 0; k < 3; k++) {
      const x = BOARD_CX - 56 + k * 56, y = BOY + 1000 * BS, on = this.tumblers[k];
      ctx.fillStyle = '#6b4a22'; ctx.beginPath(); ctx.arc(x, y, 17, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = on ? '#ffd27a' : '#3b2a18'; ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI * 2); ctx.fill();
      if (on) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(x, y, 2, x, y, 46); g.addColorStop(0, 'rgba(255,200,110,0.6)'); g.addColorStop(1, 'rgba(255,200,110,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 46, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
    }
    const fade = this.gearFade == null ? 1 : this.gearFade;
    const res = this.ctrl.result, shake = this.jamT > 0 ? Math.sin(this.t * 60) * 0.06 * (this.jamT / 0.7) : 0;
    const jammed = (key) => res.nodes.some((n) => n.key === key && n.state === 'jam');
    // pegs (empty ones pulse softly while a gear is being dragged)
    const peg = S.get('axle_peg');
    for (let i = 0; i < this.puzzle.pegs.length; i++) {
      if (this.ctrl.placed[i]) continue;
      const p = this.pegPos(i), hot = this.drag && this.ctrl.canDrop(i) && Math.hypot(this.drag.p.x.value - p.x, this.drag.p.y.value - p.y) < 95;
      if (this.drag && this.ctrl.canDrop(i)) {
        ctx.save(); ctx.strokeStyle = hot ? 'rgba(255,236,170,0.95)' : `rgba(255,236,190,${0.35 + 0.2 * Math.sin(this.t * 4 + i)})`;
        ctx.lineWidth = hot ? 5 : 3; ctx.setLineDash([10, 9]); ctx.beginPath(); ctx.arc(p.x, p.y, 38, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      }
      if (peg) ctx.drawImage(peg, p.x - 17, p.y - 17, 34, 34);
    }
    if (this.rings) for (const k of this.rings) {   // H2: light ring of the size this peg needs
      const p = this.pegPos(k), r = this.type(this.puzzle.pegs[k].need).pitch_r * BS;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(255,220,140,${0.55 + 0.25 * Math.sin(this.t * 3)})`;
      ctx.lineWidth = 5; ctx.shadowColor = 'rgba(255,210,120,0.9)'; ctx.shadowBlur = 14; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
    ctx.globalAlpha = fade;
    // drive + output gears, then placed gears
    const d = B(this.puzzle.drive.x, this.puzzle.drive.y), o = B(this.puzzle.output.x, this.puzzle.output.y);
    this.drawGear(ctx, this.puzzle.drive.type, d.x, d.y, (this.angle.drive || 0) + (jammed('drive') ? shake : 0), 1);
    ctx.globalAlpha = 1;
    this.drawGear(ctx, this.puzzle.output.type, o.x, o.y, (this.angle.output || 0) + (jammed('output') ? shake : 0), 1);
    ctx.globalAlpha = fade;
    for (let i = 0; i < this.puzzle.pegs.length; i++) {
      const id = this.ctrl.placed[i]; if (!id) continue;
      const p = this.pegPos(i), a = this.pegAnim[i] || {};
      const off = a.snap ? { x: a.snap.x.value, y: a.snap.y.value } : { x: 0, y: 0 };
      const wob = a.wobble > 0 ? Math.sin(this.t * 30) * 0.08 * a.wobble : 0;
      this.drawGear(ctx, id, p.x + off.x, p.y + off.y, (this.angle[i] || 0) + wob + (jammed(i) ? shake : 0), 1);
      if (this.ctrl.isFixed(i)) { ctx.fillStyle = '#8a6a2e'; ctx.beginPath(); ctx.arc(p.x, p.y, 9, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
    if (this.ghost) {
      const p = this.pegPos(this.ghost.peg); ctx.globalAlpha = 0.3 + 0.14 * Math.sin(this.t * 4);
      this.drawGear(ctx, this.ghost.id, p.x, p.y, 0, 1); ctx.globalAlpha = 1;
    }
    // direction arrows while stage 2 is running: meshed gears turn in opposite directions (the idea of the stage)
    if (this.stage.stage === 'two_gears' || this.ctrl.solved) for (const n of res.nodes) {
      if (n.state !== 'turning' || n.key === 'output') continue;
      const p = n.key === 'drive' ? d : this.pegPos(n.key), r = n.r * BS + 16, dir = Math.sign(n.omega);
      ctx.save(); ctx.strokeStyle = 'rgba(255,236,190,0.55)'; ctx.lineWidth = 4; ctx.beginPath();
      const a0 = -Math.PI / 2 - 0.5, a1 = -Math.PI / 2 + 0.5; ctx.arc(p.x, p.y, r, a0, a1); ctx.stroke();
      const ea = dir > 0 ? a1 : a0, ex = p.x + Math.cos(ea) * r, ey = p.y + Math.sin(ea) * r;
      ctx.fillStyle = 'rgba(255,236,190,0.7)'; ctx.beginPath(); ctx.arc(ex, ey, 7, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
  }

  drawGear(ctx, typeId, x, y, angle, scale) {
    const t = this.type(typeId), info = this.sprites.info(t.sprite), img = this.sprites.get(t.sprite);
    if (!img || !info || !info.gear) return;
    const s = (t.pitch_r * BS / info.gear.pitch_r) * scale;
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.scale(s, s);
    ctx.drawImage(img, -info.gear.center[0], -info.gear.center[1]);
    ctx.restore();
  }

  drawTray(ctx) {
    if (this.ctrl.solved || this.phase !== 'play') return;
    const fade = this.gearFade == null ? 1 : this.gearFade;
    for (const it of this.trayItems()) {
      if (this.ctrl.used[it.k] || (this.drag && this.drag.k === it.k) || this.fx.some((f) => f.kind === 'return' && f.k === it.k)) continue;
      const a = this.pegAnim['tray' + it.k], wob = a && a.wobble > 0 ? Math.sin(this.t * 30) * 0.12 * a.wobble : 0;
      ctx.globalAlpha = (it.enabled ? 1 : 0.25) * fade;
      const r = this.type(it.id).pitch_r * BS * TRAY_S;
      ctx.fillStyle = 'rgba(30,18,8,0.28)'; ctx.beginPath(); ctx.ellipse(it.x + 8, it.y + r * 0.95, r * 1.05, 12, 0, 0, Math.PI * 2); ctx.fill();
      const bob = it.enabled && !reduceMotion && this.nearBoard() ? Math.sin(this.t * 2 + it.x) * 3 : 0;
      this.drawGear(ctx, it.id, it.x, it.y + bob, wob, TRAY_S);
      ctx.globalAlpha = 1;
    }
  }

  drawDoor(ctx) {                                   // the painted door dissolves into warm daylight when opened
    if (!this.doorOpen) return;
    const k = Math.min(1, this.doorOpen), dw = DOOR.x1 - DOOR.x0, dh = DOOR.y1 - DOOR.y0, ow = dw * (0.15 + 0.85 * k);
    // 1) the leaf swings inward: a widening slit of morning light, brightest at its core, soft at the edges
    ctx.save(); ctx.shadowColor = `rgba(255,220,150,${0.9 * k})`; ctx.shadowBlur = 40;
    const g = ctx.createLinearGradient(DOOR.x0, 0, DOOR.x0 + ow, 0);
    g.addColorStop(0, `rgba(255,214,140,${0.75 * k})`); g.addColorStop(0.5, `rgba(255,250,228,${0.97 * k})`); g.addColorStop(1, `rgba(255,226,160,${0.8 * k})`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(DOOR.x0, DOOR.y0, ow, dh, [18, 18, 0, 0]); ctx.fill(); ctx.restore();
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    // 2) light spills across the floorboards towards the room
    const fg = ctx.createLinearGradient(DOOR.x0, DOOR.y1, DOOR.x0 - 620, DOOR.y1 + 60);
    fg.addColorStop(0, `rgba(255,220,150,${0.45 * k})`); fg.addColorStop(1, 'rgba(255,220,150,0)');
    ctx.fillStyle = fg; ctx.beginPath(); ctx.moveTo(DOOR.x0, DOOR.y1 - 8); ctx.lineTo(DOOR.x0 + ow, DOOR.y1 - 8);
    ctx.lineTo(DOOR.x0 - 420, H); ctx.lineTo(DOOR.x0 - 900, H); ctx.closePath(); ctx.fill();
    // 3) slow drifting rays with dust
    for (let i = 0; i < 4; i++) {
      const a = (0.10 + 0.05 * Math.sin(this.t * 0.9 + i * 1.7)) * k, x = DOOR.x0 + (i + 0.5) * ow / 4;
      ctx.fillStyle = `rgba(255,236,190,${a})`; ctx.beginPath(); ctx.moveTo(x - 14, DOOR.y0 + 30); ctx.lineTo(x + 14, DOOR.y0 + 30);
      ctx.lineTo(x - 260 - i * 60, DOOR.y1 + 40); ctx.lineTo(x - 330 - i * 60, DOOR.y1 + 40); ctx.closePath(); ctx.fill();
    }
    const gg = ctx.createRadialGradient(DOOR.x0, 700, 20, DOOR.x0, 700, 520);
    gg.addColorStop(0, `rgba(255,210,140,${0.35 * k})`); gg.addColorStop(1, 'rgba(255,210,140,0)');
    ctx.fillStyle = gg; ctx.fillRect(DOOR.x0 - 520, 180, 1040, 900); ctx.restore();
  }

  drawMira(ctx) {                                   // static 3/4 pose until her rig is built (plan 17), procedural life
    const img = this.sprites.get('mira_34'), info = this.sprites.info('mira_34'); if (!img || !info) return;
    const s = (this.neo.heightPx * 1.05) / img.height, breath = 1 + 0.012 * Math.sin(this.t * 2.2);
    const hop = this.mira.hop > 0 ? Math.sin((this.mira.hop / 0.5) * Math.PI) * 26 : 0;
    ctx.save(); ctx.translate(this.mira.x, GROUND - hop); ctx.rotate(this.mira.lean.value); ctx.scale(s, s * breath);
    ctx.fillStyle = 'rgba(30,18,8,0.25)'; ctx.beginPath(); ctx.ellipse(0, -4, 90, 16, 0, 0, Math.PI * 2); ctx.fill();
    ctx.drawImage(img, -info.foot[0], -info.foot[1]); ctx.restore();
  }

  drawWindKey(ctx) {                                // the brass winding key on NEO's back turns (3 turns)
    const h = this.neo.headPoint(), x = this.neo.x - this.neo.face * this.neo.heightPx * 0.2, y = h.y + this.neo.heightPx * 0.45;
    const turn = Math.min(3, this.windT / 0.75) * Math.PI * 2;
    ctx.save(); ctx.translate(x, y); ctx.scale(Math.cos(turn), 1);
    ctx.fillStyle = '#c99a45'; ctx.strokeStyle = '#6b4a1c'; ctx.lineWidth = 3;
    for (const sgn of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sgn * 22, 0, 18, 13, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    ctx.fillRect(-6, -5, 12, 10); ctx.restore();
  }

  drawKey(ctx, x, y, s, rot) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 70); g.addColorStop(0, 'rgba(255,215,120,0.5)'); g.addColorStop(1, 'rgba(255,215,120,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 70, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    ctx.fillStyle = '#e0b35a'; ctx.strokeStyle = '#7a5520'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(-26, 0, 18, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillRect(-10, -5, 52, 10); ctx.strokeRect(-10, -5, 52, 10); ctx.fillRect(30, 5, 8, 12); ctx.fillRect(18, 5, 7, 9);
    ctx.restore();
  }

  drawFx(ctx) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const f of this.fx) {
      let x, y, r, a;
      if (f.kind === 'spark') { const p = this.pegPos(f.peg); x = p.x; y = p.y; r = 40 + 110 * f.t; a = 0.5 * (1 - f.t / 1.2); }
      else if (f.kind === 'pop') { x = f.x; y = f.y; r = 30 + 160 * f.t; a = 0.7 * (1 - f.t / 1.2); }
      else if (f.kind === 'tumbler') { x = BOARD_CX - 56 + f.k * 56; y = BOY + 1000 * BS; r = 20 + 90 * f.t; a = 0.6 * (1 - f.t / 1.2); }
      else continue;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(255,215,130,${a})`); g.addColorStop(1, 'rgba(255,215,130,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  drawLumi(ctx) {
    const lm = this.lumi; if (lm.mode === 'hidden') return;
    const x = lm.p.x.value, y = lm.p.y.value, pulse = 1 + 0.06 * Math.sin(this.t * 5) + (lm.mode === 'celebrate' ? 0.1 * Math.sin(this.t * 14) : 0);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y, 4, x, y, 100 * pulse); g.addColorStop(0, 'rgba(255,230,170,0.55)'); g.addColorStop(1, 'rgba(255,200,120,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 100 * pulse, 0, Math.PI * 2); ctx.fill();
    if (lm.glowPeg != null) {                       // H1: LUMI lights up the peg that needs attention
      const p = this.pegPos(lm.glowPeg), k = Math.min(1, lm.glowT / 0.6), gg = ctx.createRadialGradient(p.x, p.y, 8, p.x, p.y, 120);
      gg.addColorStop(0, `rgba(255,236,180,${0.5 * k})`); gg.addColorStop(1, 'rgba(255,236,180,0)'); ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(p.x, p.y, 120, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    const img = this.sprites.get('lumi_front'), s = 0.5 * pulse;
    if (img) ctx.drawImage(img, x - 128 * s, y - 128 * s, 256 * s, 256 * s);
  }

  drawHud(ctx) {
    const S = this.sprites;
    const text = this.puzzle.objective_fa;
    ctx.save(); ctx.globalAlpha = this.objA ?? 1; ctx.font = '700 36px LumaFa, Vazirmatn, Tahoma, sans-serif'; ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = ctx.measureText(text).width + 90;
    ctx.fillStyle = 'rgba(250,240,215,0.93)'; ctx.strokeStyle = 'rgba(150,110,50,0.8)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(W / 2 - w / 2, 34, w, 72, 20); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#4a3418'; ctx.fillText(text, W / 2, 72); ctx.restore();
    const solved = this.ctrl.solved || this.phase !== 'play', pr = this.pressT || {};
    drawHudButton(ctx, S, 'btn_hint', BTN.hint, BTN_R, { disabled: solved, available: this.hints.available, pressed: pr.hint, t: this.t });
    drawHudButton(ctx, S, 'btn_undo', BTN.undo, BTN_R, { disabled: solved || !this.ctrl.undoStack.length, pressed: pr.undo, t: this.t });
    drawHudButton(ctx, S, 'btn_reset', BTN.reset, BTN_R, { disabled: solved, pressed: pr.reset, t: this.t });
  }

  debugState() {
    const r = this.ctrl.result;
    return {
      room: 'WS_MAIN_FLOOR (opening)', phase: this.phase, puzzle: this.stage.puzzle_id,
      pegs: this.ctrl.placed.map((p, i) => (p || '·') + (this.ctrl.isFixed(i) ? '*' : '')).join(' '),
      chain: r.jam ? 'JAM' : r.outputTurning ? 'output turning' : 'stopped', near_board: this.nearBoard(),
      hint_level: this.hints.level, hint_available: this.hints.available, wrong: this.hints.wrong, assist: this.ctrl.assist,
      tumblers: this.tumblers.join(''), world: Object.keys(this.save.data.world).join(',') || '-', music_layers: this.audio.layers,
    };
  }
}

/** A soft burst of warm light from NEO's chest as the spring catches (shared with the main menu). */
export function drawWakeGlow(ctx, actor, k) {
  const h = actor.headPoint(), y = h.y + actor.heightPx * 0.35, r = 80 + (1 - k) * 260;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(actor.x, y, 6, actor.x, y, r);
  g.addColorStop(0, `rgba(255,225,150,${0.7 * k})`); g.addColorStop(1, 'rgba(255,225,150,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(actor.x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
}
