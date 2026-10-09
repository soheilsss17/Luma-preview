// LUMA — Room VIL_PLAZA / card MATH-01 (Q01 "The Silent Village"): festival lamps A B A B ? ? → practice C S S C ? ?
// Everything the child sees is wordless except the one objective line (card UI rule: "only objective text").
import { drawHudButton, PRESS_S } from '../engine/hud.js';
import { PatternSlotController } from '../puzzles/pattern_slot.js';
import { MisconceptionEngine, HintEngine, MasteryEngine, AnalyticsQueue, SaveSlot } from '../edu/engines.js';
import { Spring, Spring2, Timeline, reduceMotion } from '../engine/motion.js';
import { RigActor } from '../engine/rig.js';

export const W = 1920, H = 1080;
const EXIT = { x: 1832, y: 985, r: 95 };          // after MATH-01: the way to the fruit stall (MATH-02)
const POST_GROUND = 930, CHAR_GROUND = 1048;
const POST_X = (i) => 250 + i * 232;
const POST_S = 0.92;                 // lamp_post sprite (512 px) → ~430 px tall on the 1080 canvas
const POST_FOOT = [255, 491];        // foot centre in the 512 sprite (alpha bbox bottom)
const POST_HOOK = [317, 107];        // hook tip in the 512 sprite (measured on the final, 634,214 @1024)
const LAMP_S = 0.56;                 // lamp sprites (384 px) → ~195 px tall
const LAMP_RING = [191, 18];         // ring top in the 384 sprite (510,48 @1024)
const TRAY = [{ x: 1715, y: 1066 }, { x: 1850, y: 1066 }];
const BTN = { hint: { x: 90, y: 90 }, undo: { x: 220, y: 90 }, reset: { x: 350, y: 90 } };
const BTN_R = 58;                    // 116 px buttons ≥ 48 dp on a phone-sized viewport (plan 09)

export class PlazaMath01 {
  constructor({ sprites, puzzle, audio, storage, debug, onExit }) {
    Object.assign(this, { sprites, puzzle, audio, debug, onExit });
    this.save = new SaveSlot(storage);
    this.mastery = new MasteryEngine(storage);
    this.analytics = new AnalyticsQueue(storage, puzzle.analytics_fields);
    this.tl = new Timeline();
    this.t = 0; this.attempt = 0; this.drag = null; this.fx = []; this.frames = [];
    this.bgMix = new Spring(0, { stiffness: 6, damping: 5 });
    this.lumi = { p: new Spring2(1500, 700, { stiffness: 30, damping: 9 }), mode: 'follow', glow: 0 };
    this.lampAnim = {};              // slot → {flicker:t, pop: Spring}
    this.ended = false;
  }

  async load() {
    this.neo = await new RigActor({ id: 'NEO', scale: 0.2, x: 1530, groundY: CHAR_GROUND, face: 1 }).load();
    this.tiko = await new RigActor({ id: 'TIKO', scale: 0.12, x: 1380, groundY: CHAR_GROUND, face: 1, follow: true, gap: 150 }).load();
    this.actors = [this.tiko, this.neo];
    const done = this.save.puzzle(this.puzzle.stages[0].puzzle_id);
    const doneP = this.save.puzzle(this.puzzle.stages[1].puzzle_id);
    if (doneP && doneP.solved) this.startStage(1, { finished: true });
    else this.startStage(done && done.solved ? 1 : 0);
    if (this.save.flag(this.puzzle.world_state_on_solve)) this.bgMix.set(1);
    return this;
  }

  // ---------------------------------------------------------------- stage flow
  startStage(idx, { finished = false } = {}) {
    this.stageIdx = idx;
    const stage = this.puzzle.stages[idx];
    this.stage = stage;
    this.misc = new MisconceptionEngine(this.puzzle.misconceptions, this.puzzle.misconception_flag_threshold);
    this.hints = new HintEngine(this.puzzle.hints, this.puzzle.answer_assist);
    this.ctrl = new PatternSlotController(stage, {
      onCorrect: (i, id) => this.onCorrect(i, id),
      onWrong: (i, id, rule) => this.onWrong(i, id, rule),
      onSolved: () => this.onSolved(),
      onChange: () => { this.frames = []; this.ghost = null; },
    });
    this.lampAnim = {};
    this.stageStart = this.t; this.attempt++;
    if (finished) {
      stage.solution.forEach((v, i) => { if (!stage.given[i]) this.ctrl.slots[i] = v; });
      this.ctrl.solved = true; this.ended = true;
      this.audio.setLayers(4);
      return;
    }
    this.ended = false;
    this.audio.setLayers(idx === 0 ? 0 : 2);
    this.log('puzzle_start', {});
    const lvl = this.mastery.record(this.puzzle.concept_id, { stage: stage.stage, solved: false, maxHint: 0 }, this.puzzle.mastery);
    if (lvl !== null) this.log('mastery_updated', { level: lvl });
    this.save.setPuzzle(stage.puzzle_id, { solved: false, entered: new Date().toISOString() });   // auto save: puzzle enter
  }

  log(name, extra) {
    const e = this.analytics.log(name, {
      puzzle_id: this.stage.puzzle_id, attempt_id: this.attempt,
      duration: Math.round((this.t - this.stageStart) * 10) / 10, hint_level: this.hints ? this.hints.maxUsed : 0, ...extra,
    });
    if (this.debug) this.debug.push(e);
  }

  onCorrect(i, id) {
    this.hints.onActivity();
    this.lampAnim[i] = { ...(this.lampAnim[i] || {}), pop: 0.35 };
    this.fx.push({ kind: 'flare', slot: i, t: 0 });
    this.audio.chime();
    this.audio.setLayers((this.stageIdx === 0 ? 0 : 2) + this.ctrl.litCount());   // each correct answer adds a layer
    this.log('object_dropped', { slot: i, selected_pattern_type: this.ctrl.piece(id).pattern_type, correct: true });
    this.neo.faceTowards(this.slotPos(i).x);
  }

  onWrong(i, id, rule) {
    const out = this.hints.onWrong();
    this.lampAnim[i] = { ...(this.lampAnim[i] || {}), flicker: 0.9 };
    this.audio.flicker();
    const { def, newlyFlagged } = this.misc.observe(rule);
    const error_type = def ? def.error_type : 'ConceptError';
    this.log('wrong_state', { slot: i, selected_pattern_type: this.ctrl.piece(id).pattern_type, error_type, misconception: def ? def.code : null });
    if (newlyFlagged) { this.log('misconception_flagged', { misconception: def.code, error_type }); this.hints.target(def.targeted_hint); }
    if (out === 'assist') {
      const left = this.ctrl.applyAssist(this.puzzle.answer_assist.remove_options);
      this.assisted = true;
      this.log('puzzle_interaction', { action: 'answer_assist', options_left: left.join('') });
    }
  }

  onSolved() {
    const st = this.stage;
    this.log('puzzle_solved', { assisted: !!this.assisted });
    const lvl = this.mastery.record(this.puzzle.concept_id,
      { stage: st.stage, solved: true, maxHint: this.hints.maxUsed, assisted: !!this.assisted }, this.puzzle.mastery);
    if (lvl !== null) this.log('mastery_updated', { level: lvl });
    this.save.setPuzzle(st.puzzle_id, { solved: true, hint_max: this.hints.maxUsed, assisted: !!this.assisted });  // auto save: solve
    this.audio.motif();
    this.neo.play('happy', 'idle'); this.tiko.play('happy', 'idle');
    this.lumi.mode = 'celebrate';
    for (let i = 0; i < st.solution.length; i++) this.tl.after(0.12 * i, () => this.fx.push({ kind: 'flare', slot: i, t: 0 }));
    if (this.stageIdx === 0) {
      this.save.setFlag(this.puzzle.world_state_on_solve);          // VIL_LAMPS_ON → the plaza wakes up
      this.bgMix.target = 1;
      this.audio.setLayers(3);
      this.tl.after(5.0, () => { this.lumi.mode = 'follow'; this.transition(() => this.startStage(1)); });
    } else {
      this.audio.setLayers(4);
      this.tl.after(3.0, () => { this.lumi.mode = 'follow'; this.ended = true; });
    }
    this.assisted = false;
  }

  transition(fn) {             // lamps fade out, new row fades in
    this.fade = { t: 0, dir: -1 };
    this.tl.tween(0.6, (k) => { this.fade.a = 1 - k; }, () => { fn(); this.tl.tween(0.6, (k) => { this.fade.a = k; }, () => { this.fade = null; }); });
  }

  replay() {
    this.log('replay_started', {});
    this.save.setPuzzle(this.puzzle.stages[0].puzzle_id, null); this.save.setPuzzle(this.puzzle.stages[1].puzzle_id, null);
    this.transition(() => this.startStage(0));
  }

  // ---------------------------------------------------------------- geometry
  slotPos(i) {                 // hook point where the lamp's ring attaches
    return { x: POST_X(i) + (POST_HOOK[0] - POST_FOOT[0]) * POST_S, y: POST_GROUND + (POST_HOOK[1] - POST_FOOT[1]) * POST_S };
  }
  lampCenter(i) { const p = this.slotPos(i); return { x: p.x, y: p.y + (190 - LAMP_RING[1]) * LAMP_S }; }
  pieceSprite(id, on, hl = false) {
    const p = this.ctrl.piece(id);
    if (hl && !on) { const k = p.sprite_off.replace(/_off$/, '_hl'); if (this.sprites.has(k)) return this.sprites.get(k); }   // derived highlighted state
    return this.sprites.get(on ? p.sprite_on : p.sprite_off, on ? p.fallback_on : p.fallback_off);
  }
  trayItems() {
    return this.stage.tray.map((id, k) => ({ id, ...TRAY[k], enabled: this.ctrl.available.includes(id) }));
  }

  // ---------------------------------------------------------------- input
  pointerDown(x, y) {
    this.audio.unlock();
    this.hints.onActivity();
    if (this.fade) return;
    for (const [name, b] of Object.entries(BTN)) {
      if (Math.hypot(x - b.x, y - b.y) <= BTN_R) return this.button(name);
    }
    if (this.leaving) return;
    if (this.ended && this.onExit && Math.hypot(x - EXIT.x, y - EXIT.y) < EXIT.r) return this.leave();
    if (this.ended) {                         // after the room: tapping the lamps replays the festival motif
      for (let i = 0; i < 6; i++) if (this.hitLamp(i, x, y)) { this.fx.push({ kind: 'flare', slot: i, t: 0 }); this.audio.chime(); return; }
    }
    if (!this.ctrl.solved) {
      for (const it of this.trayItems()) {
        if (it.enabled && Math.abs(x - it.x) < 70 && y > it.y - 190 && y < it.y + 10) {
          this.audio.pickup();
          this.drag = { id: it.id, from: -1, p: new Spring2(it.x, it.y - 180, { stiffness: 260, damping: 22 }), ox: 0, oy: 0 };
          this.drag.p.to(x, y - 60);
          this.log('object_selected', { selected_pattern_type: this.ctrl.piece(it.id).pattern_type });
          this.log('object_drag_started', { selected_pattern_type: this.ctrl.piece(it.id).pattern_type });
          return;
        }
      }
      for (let i = 0; i < 6; i++) {
        if (this.ctrl.canTake(i) && this.hitLamp(i, x, y)) {
          const id = this.ctrl.take(i);
          const c = this.slotPos(i);
          this.drag = { id, from: i, p: new Spring2(c.x, c.y, { stiffness: 260, damping: 22 }) };
          this.drag.p.to(x, y - 60);
          this.audio.pickup();
          this.log('object_drag_started', { slot: i, selected_pattern_type: this.ctrl.piece(id).pattern_type });
          return;
        }
      }
    }
    for (const a of this.actors) if (a.hit(x, y)) { a.play('happy', 'idle'); return; }
    if (y > 960) this.neo.walkTo(Math.max(120, Math.min(W - 120, x)));
  }
  pointerMove(x, y) { if (this.drag) this.drag.p.to(x, y - 60); }
  pointerUp(x, y) {
    if (!this.drag) return;
    const d = this.drag; this.drag = null;
    let best = -1, bestD = 110;
    for (let i = 0; i < 6; i++) {
      if (!this.ctrl.canDrop(i)) continue;
      const s = this.slotPos(i), dd = Math.hypot(d.p.x.value - s.x, d.p.y.value - s.y);
      if (dd < bestD) { bestD = dd; best = i; }
    }
    if (best >= 0) {
      this.audio.snap();
      const s = this.slotPos(best);
      this.lampAnim[best] = { snap: new Spring2(d.p.x.value - s.x, d.p.y.value - s.y, { stiffness: 220, damping: 13 }) };
      this.lampAnim[best].snap.to(0, 0);
      this.ctrl.place(best, d.id);
    } else {
      this.fx.push({ kind: 'return', id: d.id, x: d.p.x.value, y: d.p.y.value, t: 0 });   // floats back to the tray
      this.log('object_dropped', { slot: null, selected_pattern_type: this.ctrl.piece(d.id).pattern_type, correct: null });
    }
  }
  hitLamp(i, x, y) { const c = this.lampCenter(i); return Math.abs(x - c.x) < 70 && Math.abs(y - c.y) < 100; }

  button(name) {
    this.pressT = { ...(this.pressT || {}), [name]: PRESS_S };
    if (name === 'hint') {
      if (this.ctrl.solved) return;
      const h = this.hints.request();
      if (!h) return;
      this.audio.hint();
      this.log(`hint_${h.level}_used`, { hint_level: h.level });
      this.showHint(h);
    } else if (name === 'undo') {
      const a = this.ctrl.undo();
      if (a) { this.audio.snap(); this.log('puzzle_interaction', { action: 'undo', slot: a.slot }); }
    } else if (name === 'reset') {
      if (this.ended) return this.replay();
      if (this.ctrl.solved) return;
      this.ctrl.reset(); this.audio.snap();
      this.audio.setLayers(this.stageIdx === 0 ? 0 : 2);
      this.log('puzzle_interaction', { action: 'reset' });
    }
  }

  showHint(h) {
    const u = this.stage.unit_length;
    if (h.level === 1) {                     // H1 attention: LUMI flies to the first lamps and glows over them
      const a = this.lampCenter(0), b = this.lampCenter(u - 1);
      this.lumi.mode = 'hint'; this.lumi.target = { x: (a.x + b.x) / 2, y: a.y - 150 };
      this.lumi.hintItems = [...Array(u).keys()]; this.lumi.hintT = 0;
      this.tl.after(4, () => { if (this.lumi.mode === 'hint') this.lumi.mode = 'follow'; });
    } else if (h.level === 2) {              // H2 representation: a light frame around each repeating unit
      this.frames = [];
      for (let s = 0; s + u <= this.stage.solution.length; s += u) this.frames.push({ from: s, to: s + u - 1, strong: s === 0 });
      this.lumi.mode = 'hint'; const c = this.lampCenter(0); this.lumi.target = { x: c.x, y: c.y - 170 }; this.lumi.hintItems = [];
      this.tl.after(3, () => { if (this.lumi.mode === 'hint') this.lumi.mode = 'follow'; });
    } else {                                 // H3 scaffold: ghost of the next lamp; the child still places it
      const i = this.ctrl.nextToFix();
      if (i >= 0) {
        this.ghost = { slot: i, id: this.stage.solution[i] };
        const c = this.lampCenter(i); this.lumi.mode = 'hint'; this.lumi.target = { x: c.x + 90, y: c.y - 120 }; this.lumi.hintItems = [];
        this.tl.after(3, () => { if (this.lumi.mode === 'hint') this.lumi.mode = 'follow'; });
      }
    }
  }

  // ---------------------------------------------------------------- update
  update(dt) {
    if (this.pressT) for (const k in this.pressT) this.pressT[k] = Math.max(0, this.pressT[k] - dt);
    this.t += dt;
    this.tl.update(dt);
    this.hints.tick(dt);
    this.bgMix.update(dt);
    if (this.drag) this.drag.p.update(dt);
    if (!this.postOn) this.postOn = [0, 0, 0, 0, 0, 0];
    for (let i = 0; i < 6; i++) {                                   // ENVV_LAMP_POST STATE:on follows its lamp (eases ~0.4 s)
      const lit = this.ctrl.slots[i] && this.ctrl.isLit(i) && !(this.lampAnim[i] && this.lampAnim[i].flicker > 0) ? 1 : 0;
      this.postOn[i] += (lit - this.postOn[i]) * Math.min(1, dt * 6);
    }
    for (const k in this.lampAnim) {
      const a = this.lampAnim[k];
      if (a.snap) a.snap.update(dt);
      if (a.flicker > 0) a.flicker -= dt;
      if (a.pop > 0) a.pop -= dt;
    }
    for (const f of this.fx) f.t += dt;
    this.fx = this.fx.filter((f) => f.t < (f.kind === 'return' ? 0.45 : 1.2));
    // TIKO follows NEO with quicker steps instead of sliding (playbackRate, plan 17)
    const L = this.neo, T = this.tiko;
    const want = L.x - L.face * T.gap;
    const leadV = L.clips.walk.root_motion_px_per_s * L.scale, ownV = T.clips.walk.root_motion_px_per_s * T.scale;
    T.rate = T.clip === 'walk' ? Math.min(2.6, Math.max(1, (leadV / ownV) * (Math.abs(want - T.x) > 250 ? 1.15 : 1))) : 1;
    if (Math.abs(want - T.x) > 40 && (T.clip === 'idle' || T.clip === 'walk')) T.walkTo(want);
    if (T.clip === 'idle' && T.targetX === null) T.faceTowards(L.x);
    for (const a of this.actors) a.update(dt);
    // LUMI
    const lm = this.lumi;
    if (lm.mode === 'follow') { const h = this.neo.headPoint(); lm.p.to(h.x - this.neo.face * 90, h.y - 40 + Math.sin(this.t * 2.1) * 12); }
    else if (lm.mode === 'hint') { lm.hintT = (lm.hintT || 0) + dt; lm.p.to(lm.target.x + Math.cos(this.t * 3) * 40, lm.target.y + Math.sin(this.t * 3) * 18); }
    else if (lm.mode === 'celebrate') { lm.p.to(W / 2 + Math.cos(this.t * 1.6) * 520, 360 + Math.sin(this.t * 3.2) * 60); }
    if (reduceMotion && lm.mode !== 'celebrate') lm.p.set(lm.p.x.target, lm.p.y.target);
    lm.p.update(dt);
  }

  // ---------------------------------------------------------------- draw
  draw(ctx) {
    const S = this.sprites;
    ctx.drawImage(S.get('plaza_plate'), 0, 0, W, H);
    const mix = Math.max(0, Math.min(1, this.bgMix.value));
    if (mix > 0.001) { ctx.globalAlpha = mix; ctx.drawImage(S.get('plaza_restored'), 0, 0, W, H); ctx.globalAlpha = 1; }
    // focus layer (Amanita-style readability): the painted plate steps back a little while a puzzle is active so the
    // interactive lamps read first; it lifts when the room is complete.
    const focus = this.ended ? 0 : 0.24 * (1 - 0.5 * mix);
    if (focus > 0) {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, `rgba(28,20,12,${focus * 0.55})`); g.addColorStop(0.45, `rgba(28,20,12,${focus})`); g.addColorStop(1, `rgba(28,20,12,${focus * 0.8})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    const rowAlpha = this.fade ? this.fade.a ?? 1 : 1;
    // posts
    const post = S.get('lamp_post');
    const postOn = S.get('lamp_post_on');
    for (let i = 0; i < 6; i++) {
      const px = POST_X(i) - POST_FOOT[0] * POST_S, py = POST_GROUND - POST_FOOT[1] * POST_S;
      ctx.drawImage(post, px, py, post.width * POST_S, post.height * POST_S);
      const k = this.postOn ? this.postOn[i] : 0;
      if (postOn && k > 0.01) { const ga = ctx.globalAlpha; ctx.globalAlpha = ga * k; ctx.drawImage(postOn, px, py, post.width * POST_S, post.height * POST_S); ctx.globalAlpha = ga; }
    }
    // H2 frames (behind lamps)
    for (const f of this.frames) this.drawFrame(ctx, f);
    // lamps
    ctx.globalAlpha = rowAlpha;
    for (let i = 0; i < 6; i++) {
      const id = this.ctrl.slots[i];
      const s = this.slotPos(i);
      if (!id) { this.drawEmptySlot(ctx, i); continue; }
      const a = this.lampAnim[i] || {};
      let on = this.ctrl.isLit(i);
      if (a.flicker > 0) on = Math.floor(a.flicker * 10) % 2 === 0;            // wrong: blink, then stay dark
      const off = a.snap ? { x: a.snap.x.value, y: a.snap.y.value } : { x: 0, y: 0 };
      const sway = Math.sin(this.t * 1.3 + i) * (reduceMotion ? 0 : 1.6);        // lamps sway on their hooks
      const pop = a.pop > 0 ? 1 + Math.sin((0.35 - a.pop) / 0.35 * Math.PI) * 0.08 : 1;
      const hl = this.lumi.mode === 'hint' && !!this.lumi.hintItems && this.lumi.hintItems.includes(i);   // H1 target
      this.drawLamp(ctx, id, on, s.x + off.x, s.y + off.y, sway, pop, hl);
    }
    ctx.globalAlpha = 1;
    if (this.ghost) {                         // H3 ghost
      const s = this.slotPos(this.ghost.slot);
      ctx.globalAlpha = 0.28 + 0.14 * Math.sin(this.t * 4);
      this.drawLamp(ctx, this.ghost.id, false, s.x, s.y, 0, 1);
      ctx.globalAlpha = 1;
    }
    // flares (additive)
    ctx.globalCompositeOperation = 'lighter';
    for (const f of this.fx) if (f.kind === 'flare') {
      const c = this.lampCenter(f.slot), k = f.t / 1.2, r = 60 + 140 * k;
      const lit = this.ctrl.slots[f.slot] ? this.ctrl.piece(this.ctrl.slots[f.slot]).pattern_type : 'amber_round';
      const col = /turq|square/.test(lit) ? '120,230,220' : '255,190,90';
      const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, r);
      g.addColorStop(0, `rgba(${col},${0.55 * (1 - k)})`); g.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, Math.PI * 2); ctx.fill();
    }
    // steady glow on lit lamps
    for (let i = 0; i < 6; i++) if (this.ctrl.isLit(i) && !(this.lampAnim[i] && this.lampAnim[i].flicker > 0)) {
      const c = this.lampCenter(i), col = /turq|square/.test(this.ctrl.piece(this.ctrl.slots[i]).pattern_type) ? '120,230,220' : '255,190,90';
      const r = 95 + Math.sin(this.t * 2 + i) * 6, g = ctx.createRadialGradient(c.x, c.y, 10, c.x, c.y, r);
      g.addColorStop(0, `rgba(${col},${0.22 * rowAlpha})`); g.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    // tray
    if (!this.ctrl.solved) for (const it of this.trayItems()) {
      ctx.globalAlpha = it.enabled ? 1 : 0.25;
      ctx.fillStyle = 'rgba(255,240,205,0.55)';
      ctx.beginPath(); ctx.ellipse(it.x, it.y + 4, 80, 18, 0, 0, Math.PI * 2); ctx.fill();
      const bob = it.enabled && !reduceMotion ? Math.sin(this.t * 2 + it.x) * 3 : 0;
      this.drawLamp(ctx, it.id, false, it.x, it.y - 176 + bob, 0, 1);
      ctx.globalAlpha = 1;
    }
    // characters (small first)
    for (const a of [...this.actors].sort((p, q) => p.scale - q.scale)) a.draw(ctx);
    // returning lamps
    for (const f of this.fx) if (f.kind === 'return') {
      const k = f.t / 0.45, tr = TRAY[this.stage.tray.indexOf(f.id)];
      ctx.globalAlpha = 1 - k;
      this.drawLamp(ctx, f.id, false, f.x + (tr.x - f.x) * k, f.y + (tr.y - 176 - f.y) * k, 0, 1 - 0.3 * k);
      ctx.globalAlpha = 1;
    }
    // dragged lamp on top
    if (this.drag) {
      const d = this.drag, tilt = Math.max(-0.25, Math.min(0.25, -d.p.x.v * 0.0006));
      ctx.fillStyle = 'rgba(40,25,10,0.18)'; ctx.beginPath(); ctx.ellipse(d.p.x.value, d.p.y.value + 230, 55, 12, 0, 0, Math.PI * 2); ctx.fill();
      this.drawLamp(ctx, d.id, false, d.p.x.value, d.p.y.value, tilt * 57, 1.06, true);   // picked up = highlighted
    }
    this.drawLumi(ctx);
    if (this.ended && this.onExit) this.drawExit(ctx);
    this.drawHud(ctx);
    if (this.leaving) { ctx.fillStyle = `rgba(20,12,6,${this.leaving.a})`; ctx.fillRect(0, 0, W, H); }
  }

  drawLamp(ctx, id, on, x, y, swayDeg, scale, hl = false) {
    const img = this.pieceSprite(id, on, hl);
    if (!img) return;
    ctx.save();
    ctx.translate(x, y); ctx.rotate(swayDeg * Math.PI / 180); ctx.scale(LAMP_S * scale, LAMP_S * scale);
    ctx.drawImage(img, -LAMP_RING[0], -LAMP_RING[1]);
    ctx.restore();
  }

  drawEmptySlot(ctx, i) {                     // an inviting empty hook: soft pulsing ring where a lamp can hang
    const c = this.lampCenter(i);
    const hot = this.drag && Math.hypot(this.drag.p.x.value - this.slotPos(i).x, this.drag.p.y.value - this.slotPos(i).y) < 110;
    ctx.save();
    ctx.strokeStyle = hot ? 'rgba(255,236,170,0.95)' : `rgba(255,236,190,${0.35 + 0.2 * Math.sin(this.t * 3 + i)})`;
    ctx.lineWidth = hot ? 6 : 4; ctx.setLineDash([14, 12]);
    ctx.beginPath(); ctx.ellipse(c.x, c.y, 62, 88, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    const gl = this.sprites.get('interaction_glow');                // PROP_INTERACTION_GLOW: 4×4 loop on black, additive
    if (gl) {
      const f = Math.floor(this.t * 12 + i * 3) % 16, cw = gl.width / 4, sz = hot ? 250 : 210;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = hot ? 0.95 : 0.6;
      ctx.drawImage(gl, (f % 4) * cw, Math.floor(f / 4) * cw, cw, cw, c.x - sz / 2, c.y - sz * 0.62, sz, sz * 1.24);
      ctx.restore();
    }
  }

  drawFrame(ctx, f) {                         // H2: warm light frame around one repeating unit
    const a = this.lampCenter(f.from), b = this.lampCenter(f.to);
    const x0 = a.x - 95, x1 = b.x + 95, y0 = a.y - 140, y1 = a.y + 120, r = 36;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(255,220,140,${f.strong ? 0.85 : 0.35 + 0.1 * Math.sin(this.t * 3)})`;
    ctx.lineWidth = f.strong ? 7 : 4; ctx.shadowColor = 'rgba(255,210,120,0.9)'; ctx.shadowBlur = 18;
    ctx.beginPath(); ctx.roundRect(x0, y0, x1 - x0, y1 - y0, r); ctx.stroke();
    ctx.restore();
  }

  drawLumi(ctx) {
    const lm = this.lumi, x = lm.p.x.value, y = lm.p.y.value;
    const pulse = 1 + 0.06 * Math.sin(this.t * 5) + (lm.mode === 'celebrate' ? 0.1 * Math.sin(this.t * 14) : 0);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y, 4, x, y, 90 * pulse);
    g.addColorStop(0, 'rgba(255,230,170,0.55)'); g.addColorStop(1, 'rgba(255,200,120,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 90 * pulse, 0, Math.PI * 2); ctx.fill();
    if (lm.mode === 'hint' && lm.hintItems) for (const i of lm.hintItems) {       // H1: glow over the first lamps
      const c = this.lampCenter(i), k = Math.min(1, (lm.hintT || 0) / 0.6), r = 110;
      const gg = ctx.createRadialGradient(c.x, c.y, 10, c.x, c.y, r);
      gg.addColorStop(0, `rgba(255,236,180,${0.45 * k})`); gg.addColorStop(1, 'rgba(255,236,180,0)');
      ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    const img = this.sprites.get('lumi_front'), s = 0.42 * pulse;
    ctx.drawImage(img, x - 128 * s, y - 128 * s, 256 * s, 256 * s);
  }

  // wordless way on: a warm glow with chevrons at the plaza's right edge, towards the fruit stall (plan 12 row 2)
  leave() {
    this.leaving = { a: 0 }; this.audio.pickup();
    this.log('room_exit', { to: 'VIL_PLAZA_STALL' });
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

  drawHud(ctx) {
    const S = this.sprites;
    // objective (engine-rendered RTL text on a paper strip; the only words on screen)
    const text = this.puzzle.objective_fa;
    ctx.save();
    ctx.font = '700 38px LumaFa, Vazirmatn, Tahoma, sans-serif';
    ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = ctx.measureText(text).width + 90;
    ctx.fillStyle = 'rgba(250,240,215,0.93)'; ctx.strokeStyle = 'rgba(150,110,50,0.8)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(W / 2 - w / 2, 34, w, 74, 20); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#4a3418'; ctx.fillText(text, W / 2, 73);
    ctx.restore();
    // buttons: hint dim until available (pulse), undo disabled without history
    const pr = this.pressT || {}, done = this.ctrl.solved;
    drawHudButton(ctx, S, 'btn_hint', BTN.hint, BTN_R, { disabled: done, available: this.hints.available, pressed: pr.hint, t: this.t });
    drawHudButton(ctx, S, 'btn_undo', BTN.undo, BTN_R, { disabled: done || !this.ctrl.undoStack.length, pressed: pr.undo, t: this.t });
    drawHudButton(ctx, S, 'btn_reset', BTN.reset, BTN_R, { disabled: done && !this.ended, available: this.ended, pressed: pr.reset, t: this.t });
    // stage pips (wordless progress: encounter · practice)
    for (let k = 0; k < this.puzzle.stages.length; k++) {
      const done = k < this.stageIdx || (k === this.stageIdx && this.ctrl.solved);
      ctx.fillStyle = done ? 'rgba(255,200,90,0.95)' : k === this.stageIdx ? 'rgba(255,240,210,0.9)' : 'rgba(255,240,210,0.35)';
      ctx.beginPath(); ctx.arc(W / 2 - 14 + k * 28, 128, 8, 0, Math.PI * 2); ctx.fill();
    }
  }

  /** Debug overlay data (plan 07 §Debug Overlay, development only). */
  debugState() {
    const p = this.stage.pieces.filter((x) => this.sprites.isPlaceholder(x.sprite_off, x.fallback_off)).map((x) => x.sprite_off);
    return {
      puzzle: this.stage.puzzle_id, slots: this.ctrl.slots.map((s) => s || '·').join(' '),
      hint_level: this.hints.level, hint_available: this.hints.available, wrong: this.hints.wrong,
      assist: this.hints.assistActive, flagged: [...this.misc.flagged].join(',') || '-',
      mastery: this.mastery.get(this.puzzle.concept_id), world: Object.keys(this.save.data.world).join(',') || '-',
      music_layers: this.audio.layers, placeholders: p.join(',') || '-',
    };
  }
}
