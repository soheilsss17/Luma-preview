// LUMA — Q01 «The Silent Village» payoff: «the festival starts» (plan 05 §4.1 result, plan 12 §1 step 9, plan 09 §1 world map).
// Wordless ~26 s cutscene on the festival plate of VIL_PLAZA: the lanterns light one by one (a santur note each), the windows
// wake, the villagers, the baker and the children come out to the fountain, the santur plays; then the camera leans to the
// clock tower — one clock stutters, a gear-shaped gap glows (Q02 hook) and a trail of light runs west toward the workshop.
// NEO receives the cloth map (btn_map); VIL_FESTIVAL_STARTED is set and the cloth unrolls into the world map.
// A tap shows a small «skip» button (top-right, 3 s) — skipping still gives the map (the reward is never lost).
import { SaveSlot, AnalyticsQueue } from '../edu/engines.js';
import { Spring, Spring2, Timeline, ease, reduceMotion } from '../engine/motion.js';
import { RigActor } from '../engine/rig.js';
import { payoffOf } from '../edu/world_map_rules.js';
import { CLOTH } from './world_map.js';

export const W = 1920, H = 1080;
// measured on web/assets/plaza_festival.jpg (1920×1080)
export const LANTERNS = [[658, 420], [732, 405], [891, 435], [1015, 450], [1120, 460], [1272, 437], [1398, 423], [1485, 420], [1567, 395], [1661, 385]];
const LANTERN_RGB = ['150,200,255', '255,200,110', '255,196,100', '170,255,150', '255,190,110', '150,190,255', '160,255,170', '255,220,150', '255,196,110', '255,150,220'];
export const DOORS = { left: [160, 745], west: [640, 745], tower: [1047, 727], east: [1240, 707] };
const WINDOWS = [[153, 187], [1031, 357], [1140, 353], [1573, 267], [1653, 247], [1807, 383], [1447, 697], [1160, 620], [1333, 647], [820, 707]];
export const CLOCK = { x: 1029, y: 213, r: 29 };          // the front clock face that stutters (Q02: the tower needs a gear)
export const GAP = { x: 1029, y: 213, r: 40 };            // gear-shaped gap drawn over it
export const TOWER_FOCUS = { x: 1083, y: 300 };
export const NEO_X = 1540, TIKO_X = 1700, CHAR_GROUND = 1045;
export const SKIP = { x: 1830, y: 90, r: 52 };
export const BTN_END = { x: 1800, y: 962, r: 84 };
const T = { light0: 1.0, lightStep: 0.32, theme: 4.2, dance: 11.6, zoom: 14.4, stutter: 16.2, gap: 16.8, trail: 18.0, back: 20.8, map: 22.4, unroll: 24.2, end: 25.6 };
export const TIMES = T;

// the crowd: from a door (or a screen edge) to a place around the fountain; side sprites face right (flipped when walking left)
export const CROWD = [
  { id: 'baker', walk: 'baker_walk', stand: 'baker_happy', from: DOORS.west, to: [690, 905], t0: 4.6, dur: 2.6, k: 1.05 },
  { id: 'shop', walk: 'vil_shop_side', stand: 'vil_shop_front', from: DOORS.left, to: [540, 850], t0: 5.0, dur: 3.2 },
  { id: 'tailor', walk: 'vil_tailor_side', stand: 'vil_tailor_front', from: DOORS.west, to: [800, 815], t0: 6.0, dur: 2.2 },
  { id: 'basket', walk: 'vil_basket_side', stand: 'vil_basket_front', from: DOORS.tower, to: [915, 800], t0: 5.6, dur: 2.0 },
  { id: 'book', walk: 'vil_book_side', stand: 'vil_book_front', from: DOORS.east, to: [1175, 858], t0: 6.6, dur: 2.2 },
  { id: 'elder', walk: 'vil_elder_side', stand: 'vil_elder_front', from: DOORS.tower, to: [1262, 808], t0: 7.2, dur: 3.4 },
  { id: 'kite', walk: 'vil_kite_side', stand: 'vil_kite_front', from: DOORS.east, to: [1345, 880], t0: 7.8, dur: 2.2 },
  { id: 'kid_tall', walk: 'kid_tall_run', stand: 'kid_tall_happy', from: [-90, 955], to: [860, 948], t0: 8.4, dur: 2.4, kid: true, run: true },
  { id: 'kid_small', walk: 'kid_small_run', stand: 'kid_small_happy', from: [-90, 985], to: [990, 975], t0: 8.9, dur: 2.6, kid: true, run: true },
  { id: 'kid_curly', walk: 'kid_curly_run', stand: 'kid_curly_happy', from: [2010, 970], to: [1180, 958], t0: 9.0, dur: 2.3, kid: true, run: true },
  { id: 'kid_thin', walk: 'kid_thin_happy', stand: 'kid_thin_happy', from: [2010, 1000], to: [1300, 990], t0: 9.4, dur: 2.0, kid: true, run: true, skip: true },
];
/** figure height on the plaza floor: ~150 px at the back steps (y 740) → ~300 px at the front edge (y 1000). */
export const heightAt = (y, c = {}) => (150 + (y - 740) * 150 / 260) * (c.kid ? 0.7 : 1) * (c.k || 1);
const TRAIL_N = 26;
const trailPoint = (u) => {               // quadratic curve from the gap, over the roofs, out of the left edge (west = workshop)
  const p0 = [GAP.x, GAP.y], p1 = [560, 70], p2 = [-60, 360], v = 1 - u;
  return [v * v * p0[0] + 2 * v * u * p1[0] + u * u * p2[0], v * v * p0[1] + 2 * v * u * p1[1] + u * u * p2[1]];
};

export class PayoffQ01 {
  constructor({ sprites, world, audio, storage, debug, onExit }) {
    Object.assign(this, { sprites, world, audio, storage, debugEvents: debug, onExit });
    this.payoff = payoffOf(world, 'Q01');
    this.save = new SaveSlot(storage);
    this.analytics = new AnalyticsQueue(storage, ['quest_id']);
  }

  async load() {
    this.t = 0; this.tl = new Timeline(); this.lit = new Array(LANTERNS.length).fill(-1); this.dark = new Spring(0.62, { stiffness: 6, damping: 5 });
    this.winOn = new Array(WINDOWS.length).fill(-1); this.cam = 0; this.gapK = 0; this.trailT = -1; this.btn = null; this.unroll = -1;
    this.skipShown = 0; this.done = false; this.skipped = false; this.leaving = null; this.phase = 'lanterns'; this.fade = 1;
    this.confetti = []; this.clockWobble = 0;
    this.neo = await new RigActor({ id: 'NEO', scale: 0.2, x: NEO_X, groundY: CHAR_GROUND, face: -1 }).load();
    this.tiko = await new RigActor({ id: 'TIKO', scale: 0.12, x: TIKO_X, groundY: CHAR_GROUND - 15, face: -1 }).load();
    this.lumi = { p: new Spring2(1380, 560, { stiffness: 22, damping: 8 }) };
    this.crowd = CROWD.map((c) => ({ ...c, x: c.from[0], y: c.from[1], visible: false, arrived: false, face: c.to[0] >= c.from[0] ? 1 : -1 }));
    this.analytics.log('quest_payoff_start', { quest_id: 'Q01' }); this.debugEvents.push({ event: 'quest_payoff_start' });
    this.script();
    return this;
  }

  script() {
    const tl = this.tl, lumiTo = (x, y) => { this.lumi.p.to(x, y); };
    tl.after(0.9, () => { this.fade = 0; });
    LANTERNS.forEach(([x, y], i) => tl.after(T.light0 + i * T.lightStep, () => {
      this.lit[i] = this.t; this.audio.lanternNote && this.audio.lanternNote(i); lumiTo(x, y + 40);
      this.dark.target = 0.62 - 0.052 * (i + 1);
    }));
    tl.after(T.theme, () => {
      this.phase = 'crowd'; this.audio.setLayers(4); this.audio.santurTheme && this.audio.santurTheme(); lumiTo(1080, 560);
      this.neo.play('happy', 'idle'); this.tiko.play('happy', 'idle');
    });
    WINDOWS.forEach((_, i) => tl.after(T.theme + 0.2 + i * 0.22, () => { this.winOn[i] = this.t; }));
    tl.after(T.dance, () => {
      this.phase = 'dance'; this.audio.santurTheme && this.audio.santurTheme(); this.neo.play('happy', 'idle'); this.tiko.play('happy', 'idle');
      for (let i = 0; i < (reduceMotion ? 24 : 90); i++) this.confetti.push(this.makeConfetti(i));
    });
    tl.after(T.zoom, () => { this.phase = 'tower'; lumiTo(CLOCK.x - 95, CLOCK.y - 70); });
    tl.after(T.zoom, () => tl.tween(2.0, (k) => { this.cam = ease.inOutSine(k) * (reduceMotion ? 0.3 : 1); }));
    tl.after(T.stutter, () => { this.audio.clockTick && this.audio.clockTick(); this.clockWobble = 1; });
    tl.after(T.stutter + 0.45, () => { this.audio.clockTick && this.audio.clockTick(); this.clockWobble = 1; });
    tl.after(T.gap, () => { this.audio.thump && this.audio.thump(); tl.tween(0.6, (k) => { this.gapK = ease.outCubic(k); }); });
    tl.after(T.trail, () => { this.trailT = 0; this.audio.shimmer && this.audio.shimmer(); lumiTo(640, 150); });
    tl.after(T.trail + 1.4, () => lumiTo(CLOCK.x - 95, CLOCK.y - 70));
    tl.after(T.back, () => {
      tl.tween(1.6, (k) => { this.cam = (1 - ease.inOutSine(k)) * (reduceMotion ? 0.3 : 1); });
      this.neo.faceTowards(0); this.neo.play('point', 'idle'); lumiTo(NEO_X - 120, 700);
    });
    tl.after(T.map, () => this.giveMap());
    tl.after(T.unroll, () => this.startUnroll());
  }

  makeConfetti(i) {
    const r = (n) => { const s = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453; return s - Math.floor(s); };
    const cols = ['#e05a5a', '#f2b33d', '#5ab0e0', '#6cc070', '#d774c8', '#f5e6a8'];
    return { x: 250 + r(1) * 1500, y: -40 - r(2) * 500, vy: 70 + r(3) * 70, sw: 1 + r(4) * 2, ph: r(5) * 6.28, s: 9 + r(6) * 8, c: cols[i % cols.length] };
  }

  /** NEO gets the cloth map: the button pops at NEO's hand, then flies to the corner; the quest result is saved here. */
  giveMap() {
    if (this.btn) return;
    this.phase = 'map';
    const hp = this.neo.headPoint();
    this.btn = { p: new Spring2(hp.x - 60, hp.y + 40, { stiffness: 16, damping: 7 }), s: new Spring(0, { stiffness: 60, damping: 7 }), t: 0 };
    this.btn.s.target = 1;
    this.tl.after(0.6, () => this.btn.p.to(BTN_END.x, BTN_END.y));
    this.audio.chime && this.audio.chime(); this.audio.motif && this.audio.motif();
    this.finishFlag();
  }

  finishFlag() {
    if (this.done) return;
    this.done = true;
    this.save.setFlag(this.payoff.sets_flag);
    this.analytics.log(this.skipped ? 'quest_payoff_skipped' : 'quest_payoff_complete', { quest_id: 'Q01', t: +this.t.toFixed(2) });
    this.debugEvents.push({ event: this.skipped ? 'quest_payoff_skipped' : 'quest_payoff_complete' });
  }

  startUnroll() {
    if (this.unroll >= 0) return;
    this.phase = 'unroll'; this.unroll = 0; this.audio.paper && this.audio.paper();
    this.tl.after(1.4, () => this.exit());
  }

  exit() { if (this.leaving) return; this.leaving = true; this.phase = 'exit'; if (this.onExit) this.onExit('map'); }

  skip() {
    if (this.done && this.unroll >= 0) return;
    this.skipped = !this.done; this.tl.clear(); this.skipShown = 0;
    this.lit = this.lit.map((v) => (v < 0 ? this.t - 1 : v)); this.winOn = this.winOn.map((v) => (v < 0 ? this.t - 1 : v));
    this.dark.set(0.1); this.cam = 0; this.fade = 0;
    for (const c of this.crowd) { c.x = c.to[0]; c.y = c.to[1]; c.visible = true; c.arrived = true; }
    this.finishFlag();
    this.startUnroll();
  }

  // ---------------------------------------------------------------- input
  pointerDown(x, y) {
    this.audio.unlock && this.audio.unlock();
    if (this.leaving) return;
    if (this.btn && Math.hypot(x - this.btn.p.x.value, y - this.btn.p.y.value) < BTN_END.r * 1.2) { this.startUnroll(); return; }
    if (this.skipShown > 0 && Math.hypot(x - SKIP.x, y - SKIP.y) < SKIP.r * 1.3) { this.skip(); return; }
    if (this.unroll < 0) this.skipShown = 3;
  }
  pointerMove() {}
  pointerUp() {}

  // ---------------------------------------------------------------- update
  update(dt) {
    this.t += dt; this.tl.update(dt); this.dark.update(dt); this.lumi.p.update(dt);
    this.neo.update(dt); this.tiko.update(dt);
    this.skipShown = Math.max(0, this.skipShown - dt); this.clockWobble = Math.max(0, this.clockWobble - dt * 2.2);
    if (this.trailT >= 0) this.trailT += dt;
    if (this.unroll >= 0) this.unroll = Math.min(1, this.unroll + dt / 1.1);
    if (this.btn) { this.btn.p.update(dt); this.btn.s.update(dt); this.btn.t += dt; }
    for (const c of this.crowd) {
      if (c.arrived) continue;
      const k = (this.t - c.t0) / c.dur;
      if (k < 0) continue;
      c.visible = true;
      const e = Math.min(1, k);
      c.x = c.from[0] + (c.to[0] - c.from[0]) * e; c.y = c.from[1] + (c.to[1] - c.from[1]) * e;
      if (k >= 1) { c.arrived = true; c.arriveT = this.t; }
    }
    for (const p of this.confetti) { p.y += p.vy * dt; p.ph += dt * p.sw; p.x += Math.sin(p.ph) * 30 * dt; }
    this.confetti = this.confetti.filter((p) => p.y < H + 30);
  }

  // ---------------------------------------------------------------- draw
  camTransform(ctx) {
    const k = this.cam; if (k <= 0) return;
    const s = 1 + 0.75 * k, fx = W / 2 + (TOWER_FOCUS.x - W / 2) * k, fy = H / 2 + (TOWER_FOCUS.y - H / 2) * k;
    ctx.translate(W / 2, H / 2 + (H * 0.5 - H / 2) * k); ctx.scale(s, s); ctx.translate(-fx, -fy);
  }

  draw(ctx) {
    ctx.save(); this.camTransform(ctx);
    const plate = this.sprites.get('plaza_festival', 'plaza_restored');
    if (plate) ctx.drawImage(plate, 0, 0, W, H);
    this.drawUnlitLanterns(ctx);
    const actors = [...this.crowd.filter((c) => c.visible).map((c) => ({ y: c.y, f: () => this.drawFigure(ctx, c) })),
      { y: CHAR_GROUND - 15, f: () => this.tiko.draw(ctx) }, { y: CHAR_GROUND, f: () => this.neo.draw(ctx) }];
    actors.sort((a, b) => a.y - b.y).forEach((a) => a.f());
    const d = this.dark.value;
    ctx.fillStyle = `rgba(8,12,38,${Math.max(0, d).toFixed(3)})`; ctx.fillRect(-10, -10, W + 20, H + 20);
    this.drawGlows(ctx);
    this.drawClock(ctx);
    this.drawTrail(ctx);
    this.drawLumi(ctx);
    this.drawConfetti(ctx);
    ctx.restore();
    this.drawMapButton(ctx);
    this.drawSkip(ctx);
    this.drawUnroll(ctx);
    if (this.fade > 0 || this.t < 0.9) { ctx.fillStyle = `rgba(0,0,0,${Math.max(0, 1 - this.t / 0.9).toFixed(3)})`; ctx.fillRect(0, 0, W, H); }
  }

  drawUnlitLanterns(ctx) {                   // the plate paints them lit: cover each one until its turn
    LANTERNS.forEach(([x, y], i) => {
      const k = this.lit[i] < 0 ? 0 : Math.min(1, (this.t - this.lit[i]) / 0.35);
      if (k >= 1) return;
      ctx.fillStyle = `rgba(14,16,34,${(0.72 * (1 - k)).toFixed(3)})`;
      ctx.beginPath(); ctx.ellipse(x, y, 30, 42, 0, 0, Math.PI * 2); ctx.fill();
    });
  }

  drawFigure(ctx, c) {
    const moving = !c.arrived, img = this.sprites.get(moving ? c.walk : c.stand, c.stand);
    const info = this.sprites.info(moving ? c.walk : c.stand, c.stand);
    if (!img || !info) return;
    const h = heightAt(c.y, c), s = h / info.size[1], foot = info.foot || [info.size[0] / 2, info.size[1]];
    let bob = 0, tilt = 0, sq = 1, alpha = 1;
    const doorway = !c.kid && this.t - c.t0 < 0.4;                         // stepping out of the doorway
    if (doorway) alpha = Math.max(0, (this.t - c.t0) / 0.4);
    if (moving) {
      const f = c.run ? 9 : 6, ph = (this.t - c.t0) * f;
      bob = Math.abs(Math.sin(ph)) * h * (c.skip ? 0.1 : c.run ? 0.05 : 0.025); tilt = Math.sin(ph) * (c.run ? 0.05 : 0.035);
    } else if (this.t > T.dance - 0.2 || c.kid) {                           // celebrating around the fountain
      const i = CROWD.indexOf(CROWD.find((q) => q.id === c.id)), ph = this.t * (c.kid ? 7 : 4.5) + i * 1.3;
      const hop = Math.max(0, Math.sin(ph)); bob = hop * h * (c.kid ? 0.08 : 0.03); sq = 1 - (1 - hop) * 0.03; tilt = Math.sin(ph * 0.5) * 0.03;
    } else { sq = 1 + 0.01 * Math.sin(this.t * 2 + c.x); }
    const face = moving ? c.face : 1;
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(30,20,10,0.28)'; ctx.beginPath(); ctx.ellipse(c.x, c.y + 3, h * 0.2, h * 0.035, 0, 0, Math.PI * 2); ctx.fill();
    ctx.translate(c.x, c.y - bob); ctx.rotate(tilt); ctx.scale(s * face / sq ** 0.5, s * sq);
    ctx.drawImage(img, -foot[0], -foot[1]);
    ctx.restore();
  }

  drawGlows(ctx) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    LANTERNS.forEach(([x, y], i) => {
      if (this.lit[i] < 0) return;
      const a = this.t - this.lit[i], pop = a < 0.5 ? 1 + 0.5 * Math.sin(Math.min(1, a / 0.5) * Math.PI) : 1;
      const fl = 0.9 + 0.1 * Math.sin(this.t * 7 + i * 2.1), r = 95 * pop * fl, al = Math.min(1, a / 0.3) * 0.5;
      const g = ctx.createRadialGradient(x, y, 4, x, y, r);
      g.addColorStop(0, `rgba(${LANTERN_RGB[i]},${al.toFixed(3)})`); g.addColorStop(1, `rgba(${LANTERN_RGB[i]},0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    });
    WINDOWS.forEach(([x, y], i) => {
      if (this.winOn[i] < 0) return;
      const al = Math.min(1, (this.t - this.winOn[i]) / 0.5) * 0.4;
      const g = ctx.createRadialGradient(x, y, 2, x, y, 55);
      g.addColorStop(0, `rgba(255,214,140,${al.toFixed(3)})`); g.addColorStop(1, 'rgba(255,214,140,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 55, 0, Math.PI * 2); ctx.fill();
    });
    for (const c of this.crowd) {                                      // warm light spilling from the door as someone steps out
      if (c.kid) continue;
      const a = this.t - c.t0; if (a < -0.6 || a > 1.4) continue;
      const k = Math.max(0, 1 - Math.abs(a - 0.2) / 1.2) * 0.45, [dx, dy] = c.from;
      const g = ctx.createRadialGradient(dx, dy - 60, 4, dx, dy - 60, 120);
      g.addColorStop(0, `rgba(255,200,120,${k.toFixed(3)})`); g.addColorStop(1, 'rgba(255,200,120,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(dx, dy - 60, 120, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  /** gear outline from the gear_large metrics (12 teeth), centred at 0,0 with tip radius r. */
  gearPath(ctx, r) {
    const g = (this.sprites.info('gear_large') || {}).gear || { teeth: 12, tip_r: 190, root_r: 161 };
    const n = g.teeth, rr = r * g.root_r / g.tip_r;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2, st = Math.PI * 2 / n;
      const pts = [[rr, a0], [r, a0 + st * 0.18], [r, a0 + st * 0.5], [rr, a0 + st * 0.68]];
      pts.forEach(([rad, a], j) => { const px = Math.cos(a) * rad, py = Math.sin(a) * rad; if (i === 0 && j === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); });
    }
    ctx.closePath();
    ctx.moveTo(r * 0.3, 0); ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2, true);
  }

  drawClock(ctx) {
    if (this.clockWobble > 0) {                           // the stuck hand tries to move and falls back
      ctx.save(); ctx.translate(CLOCK.x, CLOCK.y); ctx.rotate(Math.sin(this.t * 40) * 0.25 * this.clockWobble);
      ctx.strokeStyle = 'rgba(40,28,16,0.9)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -CLOCK.r * 0.8); ctx.stroke(); ctx.restore();
    }
    if (this.gapK <= 0) return;
    const pulse = 0.5 + 0.5 * Math.sin(this.t * 4), r = GAP.r * (0.6 + 0.4 * this.gapK);
    ctx.save(); ctx.translate(GAP.x, GAP.y); ctx.rotate(this.t * 0.05);
    ctx.globalAlpha = this.gapK;
    this.gearPath(ctx, r); ctx.fillStyle = 'rgba(28,20,14,0.88)'; ctx.fill('evenodd');
    ctx.globalCompositeOperation = 'lighter';
    this.gearPath(ctx, r * 1.02); ctx.strokeStyle = `rgba(255,${190 + 40 * pulse | 0},110,${(0.55 + 0.4 * pulse).toFixed(3)})`; ctx.lineWidth = 4; ctx.stroke();
    const g = ctx.createRadialGradient(0, 0, r * 0.6, 0, 0, r * 2.2);
    g.addColorStop(0, `rgba(255,200,110,${(0.25 * pulse * this.gapK).toFixed(3)})`); g.addColorStop(1, 'rgba(255,200,110,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r * 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  drawTrail(ctx) {
    if (this.trailT < 0) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < TRAIL_N; i++) {
      const born = i * 0.07, a = this.trailT - born; if (a < 0) break;
      const [x, y] = trailPoint((i + 1) / TRAIL_N), fadeAll = Math.max(0, 1 - Math.max(0, this.trailT - 4.5) / 1.5);
      const al = Math.min(1, a / 0.25) * (0.6 + 0.4 * Math.sin(this.t * 6 - i * 0.7)) * fadeAll, r = 7 + (a < 0.3 ? 8 * (1 - a / 0.3) : 0);
      const g = ctx.createRadialGradient(x, y, 1, x, y, r * 3);
      g.addColorStop(0, `rgba(255,236,170,${al.toFixed(3)})`); g.addColorStop(1, 'rgba(255,220,140,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  drawLumi(ctx) {
    const x = this.lumi.p.x.value, y = this.lumi.p.y.value, pulse = 1 + 0.06 * Math.sin(this.t * 5) + (this.phase === 'dance' ? 0.1 * Math.sin(this.t * 14) : 0);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y, 4, x, y, 90 * pulse);
    g.addColorStop(0, 'rgba(255,230,170,0.55)'); g.addColorStop(1, 'rgba(255,200,120,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 90 * pulse, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    const img = this.sprites.get('lumi_front');
    if (img) { const s = 0.42 * pulse; ctx.drawImage(img, x - 128 * s, y - 128 * s, 256 * s, 256 * s); }
  }

  drawConfetti(ctx) {
    for (const p of this.confetti) {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.ph); ctx.scale(1, Math.cos(p.ph * 2));
      ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 3, p.s, p.s * 0.66); ctx.restore();
    }
  }

  drawMapButton(ctx) {
    if (!this.btn) return;
    const x = this.btn.p.x.value, y = this.btn.p.y.value, s = Math.max(0, this.btn.s.value), pulse = 0.5 + 0.5 * Math.sin(this.btn.t * 5);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const r = BTN_END.r * 1.9 * s, g = ctx.createRadialGradient(x, y, 6, x, y, r);
    g.addColorStop(0, `rgba(255,220,140,${(0.35 + 0.3 * pulse).toFixed(3)})`); g.addColorStop(1, 'rgba(255,210,120,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    const img = this.sprites.get('btn_map_new', 'btn_map'), sz = BTN_END.r * 2.2 * s * (1 + 0.05 * pulse);
    if (img) ctx.drawImage(img, x - sz / 2, y - sz / 2, sz, sz);
  }

  drawSkip(ctx) {                                        // wordless: ▶▶ in a soft disc
    if (this.skipShown <= 0 || this.unroll >= 0) return;
    const a = Math.min(1, this.skipShown / 0.4);
    ctx.save(); ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(250,240,215,0.9)'; ctx.strokeStyle = 'rgba(150,110,50,0.9)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(SKIP.x, SKIP.y, SKIP.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#6b4a1e';
    for (const dx of [-16, 10]) { ctx.beginPath(); ctx.moveTo(SKIP.x + dx - 12, SKIP.y - 20); ctx.lineTo(SKIP.x + dx + 14, SKIP.y); ctx.lineTo(SKIP.x + dx - 12, SKIP.y + 20); ctx.closePath(); ctx.fill(); }
    ctx.restore();
  }

  /** the blank cloth unrolls from the map button to the exact CLOTH rect of the world map scene, which then inks the map in. */
  drawUnroll(ctx) {
    if (this.unroll < 0) return;
    const k = ease.outCubic(this.unroll), bx = this.btn ? this.btn.p.x.value : BTN_END.x, by = this.btn ? this.btn.p.y.value : BTN_END.y;
    ctx.fillStyle = `rgba(20,14,8,${(0.55 * k).toFixed(3)})`; ctx.fillRect(0, 0, W, H);
    const cloth = this.sprites.get('map_cloth');
    const cx = bx + (CLOTH.x + CLOTH.w / 2 - bx) * k, cy = by + (CLOTH.y + CLOTH.h / 2 - by) * k;
    const sx = Math.max(0.02, k), sy = Math.min(1, 0.08 + k * 1.2);           // unrolls sideways first, then drops open
    ctx.save(); ctx.translate(cx, cy); ctx.scale(sx, sy); ctx.translate(-(CLOTH.x + CLOTH.w / 2), -(CLOTH.y + CLOTH.h / 2));
    if (cloth) ctx.drawImage(cloth, CLOTH.x, CLOTH.y, CLOTH.w, CLOTH.h);
    ctx.restore();
  }

  debugState() {
    return { scene: 'payoff_q01', t: this.t.toFixed(1), phase: this.phase, lit: this.lit.filter((v) => v >= 0).length,
      arrived: this.crowd.filter((c) => c.arrived).length + '/' + this.crowd.length, flag: this.save.flag(this.payoff.sets_flag), skipped: this.skipped };
  }
}
