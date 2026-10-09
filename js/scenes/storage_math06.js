// LUMA — WS_STORAGE / MATH-06 «معرفی عدد هزار» (book grade 3, chapter 2, pp. 28–30; card MATH-06).
// Quest Q02: the village store must record a big stock. The child packs crates on the storage floor: ten ten-crates
// into an open hundred-crate, pulls the pulley rope and the lid drops shut (۱۰۰); then that hundred-crate and nine more
// into the big thousand-crate (۱۰۰۰, «ده تا صدتایی، یک هزارتایی»). The tally board on the wall counts by the unit
// (۱۰۰، ۲۰۰ … ۱۰۰۰ — the textbook's pattern). A smaller crate slides in visibly too small, the tally breaks its pattern
// in amber and the crate pops back (card misconception: ten *objects* are not ten *groups*). Pulling the rope with an
// incomplete group: the lid bounces back and the empty slots light up (card wrong answer). Practice: a half-full
// thousand-crate to complete, then the label plate ۱۰۰ / ۱۰۰۰ / ۱۰۰۰۰.
// Pure rules: edu/thousand_rules.js · controller: puzzles/crate_pack.js · content: Content/Puzzles/MATH-06.puzzle.json
// Geometry: every number below is measured on the batch-17 finals (sprite bbox / plate / interior), see tools notes.
import { drawHudButton, drawExitArrow, PRESS_S } from '../engine/hud.js';
import { faDigits } from '../engine/strings.js';
import { MisconceptionEngine, HintEngine, MasteryEngine, AnalyticsQueue, SaveSlot } from '../edu/engines.js';
import { Spring, Spring2, Timeline, ease, reduceMotion } from '../engine/motion.js';
import { RigActor } from '../engine/rig.js';
import { CratePackController } from '../puzzles/crate_pack.js';
import { GROUP, skipCounts, unitValue } from '../edu/thousand_rules.js';

export const W = 1920, H = 1080;

// supply rack (PROP_WAREHOUSE_RACK 1024², bbox 245–777 × 43–982) in front of the painted shelving, left third
export const RACK = { cx: 300, bottom: 1010, s: 0.8 };
export const rp = (u, v) => ({ x: RACK.cx + (u - 511) * RACK.s, y: RACK.bottom + (v - 982) * RACK.s });
// shelf boards (sprite v of the standing surface / of the board above); the top board has open space above it
export const SHELVES = { top: { v: 140, ceil: 0 }, a: { v: 296, ceil: 184 }, b: { v: 506, ceil: 344 }, c: { v: 862, ceil: 540 } };
export const SHELF_X0 = rp(296, 0).x, SHELF_X1 = rp(726, 0).x;
export const FLOOR_PILE = { x: 628, y: 1004 };            // a pile of hundred-crates between the rack and the big crate
export const TOP_LIMIT = 160;                              // nothing on the rack may reach the HUD row
// the open crate on the storage floor (both crates share this spot; bbox bottom on y 985)
export const BOX = { cx: 1020, bottom: 985 };
export const HUND = { s: 760 / 939, u0: 100, u1: 925, v0: 700, v1: 925, top: 658, plate: [512, 836, 108, 52] };
export const THOU = { s: 0.66, u0: 150, u1: 875, v0: 140, v1: 880, top: 43, plate: [512, 397, 238, 116] };
export const hp = (u, v) => ({ x: BOX.cx + (u - 511.5) * HUND.s, y: BOX.bottom + (v - 982) * HUND.s });
export const tp = (u, v) => ({ x: BOX.cx + (u - 511.5) * THOU.s, y: BOX.bottom + (v - 982) * THOU.s });
// crate sprites: bbox (web px) and plate centre/size; ten-crate w/h 0.381, hundred 2.90 (measured)
const SPR = {
  ten: { name: 'crate_small', bbox: [166, 21, 345, 491], plate: [256, 155, 45, 44] },
  hundred: { name: 'hundred_crate', bbox: [42, 658, 981, 982], plate: [512, 836, 108, 52] },
  one: { name: 'counting_block', bbox: [0, 0, 112, 128], plate: null },
};
export const TEN_W = 62;                                   // a ten-crate in the hundred-crate phase (10 fit its interior)
export const K_HUNDRED = 228 / 760;                        // zoom of the thousand-crate phase (a hundred-crate 228 px wide)
// pulley: the painted hook on the back wall; the engine hangs the rope handle under it
export const HOOK = { x: 1350, y: 316 }, HANDLE = { x: 1350, y: 492, r: 80 };
// tally board on the back wall above the crate
export const TALLY = { x: 640, y: 178, w: 760, h: 100, cell: 72 };
// label plates hang on cords from the slanted pipe on the right wall
// (NEO steps aside to the counting table while they hang: NEO_ASIDE)
export const PLATES = [{ x: 1460, pipe: 455 }, { x: 1578, pipe: 436 }, { x: 1696, pipe: 417 }], PLATE_Y = 540, PLATE_W = 104, PLATE_H = 60;
export const NEO_HOME = 1650, NEO_ASIDE = 1825, TIKO_X = 1485;
export const BTN = { hint: { x: 90, y: 90 }, undo: { x: 220, y: 90 }, reset: { x: 350, y: 90 } };
const BTN_R = 58;
export const EXIT = { x: 1832, y: 985, r: 95 };
const FONT = 'LumaFa, Vazirmatn, Tahoma, sans-serif';
const AMBER = [255, 176, 50], GOLD = [255, 214, 120];

const lerp = (a, b, t) => a + (b - a) * t;
const arcY = (y0, y1, k, h) => lerp(y0, y1, k) - Math.sin(Math.PI * k) * h;

export class StorageMath06 {
  constructor({ sprites, puzzle, audio, storage, debug, strings, onExit }) {
    Object.assign(this, { sprites, puzzle, audio, debug, strings, onExit });
    this.save = new SaveSlot(storage);
    this.mastery = new MasteryEngine(storage);
    this.analytics = new AnalyticsQueue(storage, puzzle.analytics_fields);
    this.tl = new Timeline();
    this.t = 0; this.attempt = 0; this.drag = null; this.fx = []; this.movers = []; this.dust = [];
    this.aliveMix = new Spring(0, { stiffness: 4, damping: 5 });
    this.rope = new Spring(0, { stiffness: 80, damping: 9 });           // 0 hanging … 1 pulled down
    this.plateMix = new Spring(0, { stiffness: 14, damping: 6 });       // the number stamping onto the closed crate
    this.labelDrop = new Spring(0, { stiffness: 16, damping: 7 });      // label plates lowering on their cords
    this.lumi = { p: new Spring2(1500, 420, { stiffness: 30, damping: 9 }), mode: 'follow' };
    this.ended = false; this.bubble = null;
  }

  async load() {
    this.neo = await new RigActor({ id: 'NEO', scale: 0.3, x: NEO_HOME, groundY: 1010, face: -1 }).load();
    this.tiko = await new RigActor({ id: 'TIKO', scale: 0.16, x: TIKO_X, groundY: 1018, face: -1 }).load();
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
    this.ctrl = new CratePackController(this.stage, this.puzzle.units);
    this.misc = new MisconceptionEngine(this.puzzle.misconceptions, this.puzzle.misconception_flag_threshold);
    this.hints = new HintEngine(this.stage.hints, this.stage.answer_assist);
    this.stageMaxHint = 0; this.stageAssisted = false; this.stageStart = this.t; this.attempt++;
    this.fx = []; this.movers = []; this.dust = []; this.hidden = new Set(); this.wrongShow = null; this.carry = null;
    this.busy = false; this.hintShow = 0; this.hintUntil = 0; this.hintT = 0; this.bubble = null; this.shut = 0;
    this.emptyGlow = 0; this.ropeNudge = 0; this.shake = 0; this.countPulse = 0; this.boxFade = 1; this.goneLabels = [];
    this.plateText = null; this.plateMix.set(0); this.plateMix.target = 0; this.labelDrop.set(0); this.labelDrop.target = 0;
    this.lumi.mode = 'follow';
    if (finished) {                                        // replaying after the solve: the labelled thousand-crate stands closed
      const c = this.ctrl;
      while (c.phase === 'pack') {
        for (const s of c.presentSupply().filter((q) => q.unit === c.unit)) if (c.count < GROUP) c.drop(s.uid);
        c.close(); c.advance();
      }
      if (c.phase === 'label') c.placeLabel(this.stage.label.answer);
      this.shut = 1; this.plateText = faDigits(this.stage.label.answer); this.plateMix.set(1); this.plateMix.target = 1;
      this.ended = true; this.audio.setLayers(4);
      return;
    }
    this.ended = false;
    this.audio.setLayers(idx === 0 ? 1 : idx + 1);
    this.log('puzzle_start', {});
    this.recordMastery(false);
    this.save.setPuzzle(this.stage.puzzle_id, { solved: false, entered: new Date().toISOString() });
  }

  get phase() { return this.ctrl.phase; }
  /** Which crate is open: the hundred-crate (ten-crates go in) or the thousand-crate. */
  get box() { return this.ctrl.unit === 'ten' ? 'hundred' : 'thousand'; }
  get zoom() { return this.ctrl.unit === 'ten' ? 1 : K_HUNDRED; }
  objective() {
    if (this.phase === 'label' || (this.phase === 'solved' && this.stage.label.options.length)) return this.stage.label.objective_fa;
    return this.ctrl.cur.objective_fa;
  }

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

  say(key, sec = 3.2) {
    if (!key || !this.strings) return;
    const b = { text: this.strings.t(key), t: 0 }; this.bubble = b;
    this.tl.after(sec, () => { if (this.bubble === b) this.bubble = null; });
  }

  // ================================================================= geometry
  /** On-screen size of a crate of `unit` at the current zoom (width, height). */
  size(unit, k = this.zoom) {
    if (unit === 'ten') { const w = TEN_W * k; return { w, h: w / 0.381 }; }
    if (unit === 'hundred') { const w = 760 * k; return { w, h: w * 324 / 939 }; }
    const w = 30 * k; return { w, h: w * 128 / 112 };
  }
  /** Slot i of the open crate: bottom-centre and the slot's full size. */
  slot(i) {
    if (this.box === 'hundred') {
      const x0 = hp(HUND.u0, 0).x, cw = (HUND.u1 - HUND.u0) * HUND.s / GROUP;
      return { x: x0 + (i + 0.5) * cw, y: hp(0, HUND.v1).y, w: cw, h: this.size('ten').h };
    }
    const x0 = tp(THOU.u0, 0).x, cw = (THOU.u1 - THOU.u0) * THOU.s / 2, h = this.size('hundred').h;
    return { x: x0 + ((i % 2) + 0.5) * cw, y: tp(0, THOU.v1).y - Math.floor(i / 2) * h, w: cw, h };
  }
  /** Where crates can be dropped: the open interior, generously. */
  boxZone() {
    if (this.box === 'hundred') { const a = hp(HUND.u0, HUND.v0 - 60), b = hp(HUND.u1, HUND.v1); return { x0: a.x - 30, y0: a.y - 120, x1: b.x + 30, y1: b.y + 50 }; }
    const a = tp(THOU.u0, THOU.v0), b = tp(THOU.u1, THOU.v1); return { x0: a.x - 40, y0: a.y - 40, x1: b.x + 40, y1: b.y + 60 };
  }
  inBox(x, y) { const z = this.boxZone(); return x > z.x0 && x < z.x1 && y > z.y0 && y < z.y1; }

  /** Rack + floor positions (bottom-centre) of every supply crate; hundred-crates stack, smaller crates stand in a row. */
  layoutSupply() {
    const out = new Map(), shelves = {};
    for (const s of this.ctrl.supply) if (!s.removed || this.fx.some((f) => f.kind === 'sink' && f.uid === s.uid)) (shelves[s.shelf] ||= []).push(s);
    for (const [name, items] of Object.entries(shelves)) {
      const floor = name === 'floor';
      const baseY = floor ? FLOOR_PILE.y : rp(0, SHELVES[name].v).y;
      const stack = items.filter((s) => s.unit === 'hundred'), row = items.filter((s) => s.unit !== 'hundred');
      const hz = this.size('hundred'), x0 = floor ? FLOOR_PILE.x - hz.w / 2 : SHELF_X0 + 4;
      stack.filter((s) => s.present).forEach((s, i) => out.set(s.uid, { x: x0 + hz.w / 2, y: baseY - i * hz.h, w: hz.w, h: hz.h, stack: name, level: i }));
      let rx = x0 + (stack.length ? hz.w + 10 : 0);
      const gap = this.zoom === 1 ? 6 : 9;
      for (const s of row) { const z = this.size(s.unit); out.set(s.uid, { x: rx + z.w / 2, y: baseY, w: z.w, h: z.h }); rx += z.w + gap; }
    }
    return out;
  }
  /** Where a crate returning to the rack lands (a stacked crate goes on top of its pile). */
  homeOf(uid) {
    const lay = this.layoutSupply(), p = lay.get(uid);
    if (p) return p;
    const s = this.ctrl.item(uid), z = this.size(s.unit);
    return { x: SHELF_X0 + z.w / 2, y: rp(0, SHELVES.c.v).y, w: z.w, h: z.h };
  }
  supplyAt(x, y) {
    const lay = this.layoutSupply(), hits = [];
    for (const s of this.ctrl.supply) {
      if (!s.present || this.hidden.has(s.uid)) continue;
      const p = lay.get(s.uid); if (!p) continue;
      const cx = p.x, cy = p.y - p.h / 2, hw = Math.max(p.w / 2, 36), hh = Math.max(p.h / 2, 38);
      if (Math.abs(x - cx) < hw && Math.abs(y - cy) < hh) hits.push({ s, p, d: Math.hypot(x - cx, y - cy) });
    }
    if (!hits.length) return null;
    hits.sort((a, b) => a.d - b.d);
    const hit = hits[0];
    if (hit.p.stack) {                                     // only the top crate of a pile can be lifted
      let top = hit;
      for (const s of this.ctrl.supply) {
        const p = lay.get(s.uid);
        if (p && p.stack === hit.p.stack && s.present && !this.hidden.has(s.uid) && p.level > top.p.level) top = { s, p };
      }
      return top.s.uid;
    }
    return hit.s.uid;
  }
  onHandle(x, y) { const h = this.handlePos(); return Math.hypot(x - h.x, y - h.y) < HANDLE.r; }
  handlePos() { return { x: HANDLE.x, y: HANDLE.y + this.rope.value * 70 }; }
  platePos(i) { const p = PLATES[i]; return { x: p.x, y: lerp(p.pipe - 120, PLATE_Y, Math.min(1.1, this.labelDrop.value)) }; }
  crateLabelPos() { const [u, v] = THOU.plate; return tp(u, v); }
  labelAt(x, y) {
    if (this.labelDrop.value < 0.6) return null;
    for (const [i, v] of this.stage.label.options.entries()) {
      if (!this.ctrl.labelOptions.includes(v)) continue;
      const p = this.platePos(i); if (Math.abs(x - p.x) < PLATE_W / 2 + 10 && Math.abs(y - p.y) < PLATE_H / 2 + 26) return v;
    }
    return null;
  }

  // ================================================================= actions
  /** A supply crate onto the open crate (drag or tap). `from` = where it was released. */
  dropCrate(uid, from) {
    if (this.busy || this.ended || this.phase !== 'pack' || this.wrongShow) return null;
    const home = this.homeOf(uid), start = from || { x: home.x, y: home.y };
    const r = this.ctrl.drop(uid);
    if (!r) return null;
    this.hints.onActivity();
    const it = this.ctrl.item(uid), z = this.size(it.unit);
    if (r.rule === 'ok') {
      const s = this.slot(r.slot);
      this.hidden.add(uid);
      this.move({ uid, unit: it.unit, from: start, to: s, w: z.w, dur: 0.32, h: 80 }, () => {
        this.hidden.delete(uid); this.audio.crateSet(it.unit === 'hundred' ? 1 : it.unit === 'ten' ? 0.35 : 0);
        this.fx.push({ kind: 'settle', slot: r.slot, t: 0 }); this.dustAt(s.x, s.y, 3);
        if (this.ctrl.count === GROUP) { this.fx.push({ kind: 'full', t: 0 }); this.audio.chime(); this.neo.play('point', 'idle'); }
      });
      this.log('unit_grouped', { unit: it.unit, group_value: this.ctrl.tally });
      this.tiko.faceTowards(BOX.cx);
      return r;
    }
    if (r.rule === 'smaller_unit') {                        // slides in visibly too small, the tally breaks, pops back
      const s = this.slot(r.slot);
      this.hidden.add(uid); this.busy = true;
      this.move({ uid, unit: it.unit, from: start, to: s, w: z.w, dur: 0.34, h: 70 }, () => {
        this.wrongShow = { uid, unit: it.unit, slot: r.slot, t: 0 }; this.audio.crateSet(0); this.audio.flicker();
        this.tiko.play('concerned', 'idle');
      });
      const def = this.observe(r.rule);
      this.log('grouping_error', { grouping_error: r.rule, unit: it.unit, error_type: def ? def.error_type : 'ConceptError',
        misconception: def ? def.code : null });
      const out = this.hints.onWrong();
      this.tl.after(1.9, () => {
        this.wrongShow = null;
        this.move({ uid, unit: it.unit, from: s, to: this.homeOf(uid), w: z.w, dur: 0.5, h: 150 }, () => {
          this.hidden.delete(uid); this.audio.snap(); this.busy = false;
          if (out === 'assist') this.applyAssist();
        });
      });
      return r;
    }
    // full / bigger: refused — the crate bumps the rim and goes home (not an error; a full crate makes the rope glow)
    this.hidden.add(uid);
    const rim = { x: BOX.cx + (start.x < BOX.cx ? -1 : 1) * 60, y: this.boxZone().y0 + 40 };
    this.move({ uid, unit: it.unit, from: start, to: rim, w: z.w, dur: 0.22, h: 30 }, () => {
      this.audio.snap(); this.shake = 0.25;
      this.move({ uid, unit: it.unit, from: rim, to: this.homeOf(uid), w: z.w, dur: 0.45, h: 120 }, () => this.hidden.delete(uid));
    });
    if (r.rule === 'full') { this.ropeNudge = 2; this.log('puzzle_interaction', { action: 'drop_refused_full', unit: it.unit }); }
    return r;
  }

  /** Lift the top crate out of the open crate (back to the rack). */
  takeCrate(from) {
    if (this.busy || this.ended) return null;
    const uid = this.ctrl.take();
    if (!uid) return null;
    const it = this.ctrl.item(uid), z = this.size(it.unit);
    this.hidden.add(uid);
    this.move({ uid, unit: it.unit, from, to: this.homeOf(uid), w: z.w, dur: 0.4, h: 100 }, () => { this.hidden.delete(uid); this.audio.crateSet(0.2); });
    this.log('puzzle_interaction', { action: 'take_out', unit: it.unit });
    return uid;
  }

  /** The pulley rope: closes a complete group; an incomplete one bounces (card wrong answer, highlighted). */
  pullRope() {
    if (this.busy || this.ended || this.phase !== 'pack' || this.wrongShow) return null;
    const r = this.ctrl.close();
    if (!r) return null;
    this.hints.onActivity();
    this.rope.target = 1; this.tl.after(0.35, () => { this.rope.target = 0; });
    this.audio.ropePull(); this.busy = true; this.hintShow = 0;
    if (!r.ok) {
      this.tl.tween(0.32, (k) => { this.shut = 0.34 * ease.outCubic(k); });
      this.tl.after(0.32, () => { this.audio.crateSet(0.6); this.shake = 0.35; this.tl.tween(0.4, (k) => { this.shut = 0.34 * (1 - k) + Math.sin(k * Math.PI * 2) * 0.03 * (1 - k); }); });
      this.tl.after(0.5, () => { this.emptyGlow = 2.6; this.lumi.mode = 'hint'; this.lumi.target = this.slot(Math.min(GROUP - 1, this.ctrl.count)); this.say('line.MATH-06.incomplete', 2.6); });
      this.tl.after(0.75, () => { this.shut = 0; this.busy = false; });
      this.tl.after(3.2, () => { if (this.lumi.mode === 'hint') this.lumi.mode = 'follow'; });
      this.neo.play('think', 'idle');
      this.log('grouping_error', { grouping_error: r.rule, error_type: 'ProcedureError', group_value: this.ctrl.tally });
      if (this.hints.onWrong() === 'assist') this.tl.after(0.9, () => this.applyAssist());
      return r;
    }
    // crate_close → group_merge: the lid drops, dust, the brass plate writes the new unit
    this.stageMaxHint = Math.max(this.stageMaxHint, this.hints.maxUsed);
    this.tl.tween(0.5, (k) => { this.shut = k * k; });
    this.tl.after(0.5, () => {
      this.shut = 1; this.audio.lidClose(); this.shake = 0.6;
      const b = this.box === 'hundred' ? [hp(HUND.u0, 982), hp(HUND.u1, 982)] : [tp(THOU.u0, 982), tp(THOU.u1, 982)];
      for (let i = 0; i < 5; i++) this.dustAt(lerp(b[0].x, b[1].x, i / 4), b[0].y - 4, 3);
    });
    this.tl.after(0.95, () => {
      this.fx.push({ kind: 'merge', t: 0 }); this.audio.shimmer();
      if (!(this.stage.label.options.length && this.ctrl.phaseIdx === this.stage.phases.length - 1)) {
        this.plateText = faDigits(r.value); this.plateMix.set(0); this.plateMix.target = 1; this.tl.after(0.15, () => this.audio.stamp());
      }
      this.neo.play('happy', 'idle'); this.tiko.play('happy', 'idle');
      this.say(this.ctrl.cur.done_line_key, 3.4);
      this.log(r.unit === 'ten' ? 'hundred_group_created' : 'thousand_group_created', { group_value: r.value, unit: r.unit });
    });
    this.tl.after(2.6, () => this.afterClose());
    return r;
  }

  afterClose() {
    const more = this.ctrl.phaseIdx < this.stage.phases.length - 1;
    if (more) return this.carryToRack();
    const st = this.ctrl.advance();
    if (st === 'label') {                                  // practice: the plates come down on their cords
      this.labelDrop.target = 1; this.audio.pickup(); this.busy = false;
      this.neo.walkTo(NEO_ASIDE, () => this.neo.faceTowards(PLATES[0].x));
      this.hints = this.freshHints(); this.lumi.mode = 'follow';
      return;
    }
    this.onSolved();
  }
  freshHints() { const h = new HintEngine(this.stage.hints, this.stage.answer_assist); h.maxUsed = this.hints.maxUsed; return h; }

  /** ENC phase 1 → 2: the closed hundred-crate shrinks to its true size in the bigger picture and waits on the rack. */
  carryToRack() {
    const oldBox = { box: 'hundred', text: this.plateText };
    this.ctrl.advance();
    const uid = this.ctrl.madeUid, to = this.homeOf(uid);
    this.hidden.add(uid);
    this.carry = { k: 0, from: { x: BOX.cx, y: BOX.bottom, w: 760 }, to, text: oldBox.text };
    this.boxFade = 0; this.shut = 0; this.plateText = null; this.plateMix.set(0); this.plateMix.target = 0;
    this.fx.push({ kind: 'supplyIn', t: 0 });
    this.audio.pickup();
    this.tl.tween(1.3, (k) => { this.carry.k = ease.inOutSine(k); this.boxFade = Math.max(0, (k - 0.35) / 0.65); }, () => {
      this.carry = null; this.hidden.delete(uid); this.audio.crateSet(1); this.busy = false;
      this.hints = this.freshHints();
    });
  }

  placeLabel(value, from) {
    if (this.busy || this.phase !== 'label') return null;
    const r = this.ctrl.placeLabel(value);
    if (!r) return null;
    this.hints.onActivity();
    const i = this.stage.label.options.indexOf(value), at = this.crateLabelPos();
    if (r.ok) {
      this.busy = true;
      this.fx.push({ kind: 'labelFly', value, from: from || this.platePos(i), t: 0 });
      this.tl.after(0.35, () => {
        this.plateText = faDigits(value); this.plateMix.set(0.6); this.plateMix.target = 1;
        this.audio.stamp(); this.fx.push({ kind: 'merge', t: 0 }); this.fx.push({ kind: 'spark', x: at.x, y: at.y, t: 0 });
      });
      for (const v of this.ctrl.labelOptions) if (v !== value) this.goneLabels.push({ value: v, t: 0 });
      this.log('label_placed', { label_placed: value });
      this.tl.after(1.0, () => this.onSolved());
      return r;
    }
    this.fx.push({ kind: 'labelBounce', value, from: from || this.platePos(i), t: 0 });
    this.audio.flicker();
    const def = this.observe(r.rule);
    this.log('grouping_error', { grouping_error: r.rule, label_placed: value, error_type: def ? def.error_type : 'ConceptError',
      misconception: def ? def.code : null });
    this.tiko.play('concerned', 'idle');
    if (this.hints.onWrong() === 'assist') this.tl.after(1.0, () => this.applyAssist());
    return r;
  }

  applyAssist() {
    if (this.ended || this.phase === 'solved') return;
    const a = this.ctrl.assistRemove();
    if (!a) return;
    this.stageAssisted = true;
    if (a.kind === 'supply') for (const uid of a.uids) this.fx.push({ kind: 'sink', uid, t: 0 });
    else this.goneLabels.push({ value: a.value, t: 0 });
    this.audio.shimmer();
    this.log('puzzle_interaction', { action: 'answer_assist', removed: a.kind === 'supply' ? a.uids.length : a.value });
  }

  onSolved() {
    this.stageMaxHint = Math.max(this.stageMaxHint, this.hints.maxUsed);
    this.log('solved', { solved: true, assisted: this.stageAssisted });
    this.log('puzzle_solved', { assisted: this.stageAssisted });
    this.recordMastery(true);
    this.save.setPuzzle(this.stage.puzzle_id, { solved: true, hint_max: this.stageMaxHint, assisted: this.stageAssisted });
    this.audio.motif(); this.neo.play('happy', 'idle'); this.tiko.play('happy', 'idle');
    this.busy = true;
    if (this.stageIdx < this.puzzle.stages.length - 1) {
      this.lumi.mode = 'celebrate';
      this.tl.after(2.8, () => { this.lumi.mode = 'follow'; this.transition(() => this.startStage(this.stageIdx + 1)); });
      return;
    }
    // WS_STORAGE_SORTED: the storage room wakes — warm light, the stock is recorded; back to NEO's map
    this.tl.after(0.8, () => {
      this.save.setFlag(this.puzzle.world_state_on_solve);
      this.audio.bell(); this.audio.setLayers(4); this.aliveMix.target = 1;
      this.say(this.stage.label.done_line_key, 3.4);
      this.neo.play('celebrate', 'idle'); this.tiko.play('celebrate', 'idle'); this.lumi.mode = 'celebrate';
      this.tl.after(3.4, () => { this.lumi.mode = 'follow'; this.ended = true; this.busy = false; this.neoHome(); });
    });
  }

  /** NEO steps back from the counting table to his place beside the crates (after the label phase / a reset). */
  neoHome() { if (Math.abs(this.neo.x - NEO_HOME) > 4) this.neo.walkTo(NEO_HOME, () => this.neo.faceTowards(BOX.cx)); }

  leave() {
    this.leaving = { a: 0 }; this.audio.pickup();
    this.log('room_exit', { to: 'map' });
    this.tl.tween(0.8, (k) => { this.leaving.a = k; }, () => this.onExit());
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
  resetStage() {
    this.log('puzzle_interaction', { action: 'reset' });
    const keep = { misc: this.misc, hints: this.hints, maxHint: this.stageMaxHint };
    this.ctrl = new CratePackController(this.stage, this.puzzle.units);
    this.misc = keep.misc; this.hints = new HintEngine(this.stage.hints, this.stage.answer_assist);
    this.hints.maxUsed = keep.hints.maxUsed; this.hints.wrong = keep.hints.wrong; this.hints.available = keep.hints.available;
    this.stageMaxHint = keep.maxHint;                      // stageAssisted stays: a reset does not erase an Assist
    this.neoHome();
    this.hidden = new Set(); this.movers = []; this.fx = []; this.shut = 0; this.plateText = null; this.plateMix.set(0);
    this.plateMix.target = 0; this.labelDrop.set(0); this.labelDrop.target = 0; this.goneLabels = []; this.boxFade = 1;
    this.audio.snap();
  }

  move(m, done) {
    const mv = { ...m, t: 0, done };
    this.movers.push(mv);
    return mv;
  }
  dustAt(x, y, n) {
    if (reduceMotion) n = Math.ceil(n / 3);
    for (let i = 0; i < n; i++) {
      this.dust.push({ x: x + (Math.random() - 0.5) * 40, y, vx: (Math.random() - 0.5) * 70, vy: -30 - Math.random() * 40,
        r: 10 + Math.random() * 12, t: 0, life: 0.9 + Math.random() * 0.6 });
    }
  }

  // ================================================================= input
  pointerDown(x, y) {
    this.audio.unlock();
    if (this.hints) this.hints.onActivity();
    for (const [name, b] of Object.entries(BTN)) if (Math.hypot(x - b.x, y - b.y) <= BTN_R) return this.button(name);
    if (this.fade || this.leaving) return;
    if (this.ended && this.onExit && Math.hypot(x - EXIT.x, y - EXIT.y) < EXIT.r) return this.leave();
    this.down = { x, y };
    if (!this.busy && !this.ended && !this.wrongShow) {
      if (this.phase === 'pack') {
        const uid = this.supplyAt(x, y);
        if (uid) {
          const p = this.layoutSupply().get(uid);
          this.drag = { kind: 'crate', uid, off: { x: p.x - x, y: p.y - y }, p: new Spring2(p.x, p.y, { stiffness: 260, damping: 22 }), moved: false };
          this.audio.pickup(); return;
        }
        const top = this.ctrl.topRemovable();
        if (top) {
          const s = this.slot(this.ctrl.count - 1), z = this.size(this.ctrl.contents[this.ctrl.count - 1].unit);
          if (Math.abs(x - s.x) < Math.max(z.w / 2, 36) && y < s.y + 10 && y > s.y - Math.max(z.h, 60)) {
            this.drag = { kind: 'out', uid: top, off: { x: s.x - x, y: s.y - y }, p: new Spring2(s.x, s.y, { stiffness: 260, damping: 22 }), moved: false };
            this.audio.pickup(); return;
          }
        }
        if (this.onHandle(x, y)) return this.pullRope();
      } else if (this.phase === 'label') {
        const v = this.labelAt(x, y);
        if (v !== null) {
          const p = this.platePos(this.stage.label.options.indexOf(v));
          this.drag = { kind: 'label', value: v, off: { x: p.x - x, y: p.y - y }, p: new Spring2(p.x, p.y, { stiffness: 260, damping: 22 }), moved: false };
          this.audio.pickup(); return;
        }
      }
    }
    for (const a of this.actors) if (a.hit(x, y)) { a.play('happy', 'idle'); return; }
  }
  pointerMove(x, y) {
    if (!this.drag) return;
    if (this.down && Math.hypot(x - this.down.x, y - this.down.y) > 12) this.drag.moved = true;
    if (this.drag.moved) this.drag.p.to(x + this.drag.off.x, y + this.drag.off.y);
  }
  pointerUp(x, y) {
    const d = this.drag; this.drag = null;
    if (!d || this.busy) return;
    const at = { x: d.p.x.value, y: d.p.y.value };
    if (d.kind === 'crate') {
      if (!d.moved || this.inBox(x, y)) return this.dropCrate(d.uid, d.moved ? at : null);    // tap works too
      const it = this.ctrl.item(d.uid), z = this.size(it.unit);
      this.hidden.add(d.uid);
      this.move({ uid: d.uid, unit: it.unit, from: at, to: this.homeOf(d.uid), w: z.w, dur: 0.3, h: 40 }, () => this.hidden.delete(d.uid));
      return;
    }
    if (d.kind === 'out') {
      if (d.moved && !this.inBox(x, y)) return this.takeCrate(at);
      return;
    }
    const target = this.crateLabelPos();
    if (!d.moved || Math.hypot(x - target.x, y - target.y) < 150) return this.placeLabel(d.value, d.moved ? at : null);
    this.fx.push({ kind: 'labelBack', value: d.value, from: at, t: 0 });
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
      if (busy || this.ended || this.wrongShow) return;
      const u = this.ctrl.undo();
      if (u) { this.audio.snap(); this.log('puzzle_interaction', { action: 'undo' }); }
    } else if (name === 'reset') {
      if (this.ended) return this.replay();
      if (busy) return;
      this.resetStage();
    }
  }

  hintUnitKey() { return this.phase === 'label' ? 'label' : this.ctrl.unit; }
  showHint(h) {
    this.stageMaxHint = Math.max(this.stageMaxHint, h.level);
    const key = (h.text_key_by_unit && h.text_key_by_unit[this.hintUnitKey()]) || h.text_key;
    if (key) this.say(key, 5);
    this.hintShow = h.level; this.hintT = 0; this.hintUntil = this.t + (h.level === 1 ? 5 : 10);
    if (h.level === 1) { this.lumi.mode = 'count'; this.countPulse = 4.5; }
    else if (h.level === 2) { this.lumi.mode = 'hint'; this.lumi.target = this.phase === 'label' ? { x: TALLY.x + TALLY.w / 2, y: TALLY.y + 150 } : { x: SHELF_X1 + 40, y: 420 }; }
    else { this.lumi.mode = 'hint'; this.lumi.target = this.phase === 'label' ? this.crateLabelPos() : this.slot(Math.min(GROUP - 1, this.ctrl.count)); }
    this.tl.after(h.level === 1 ? 4.5 : 4, () => { if (this.lumi.mode !== 'celebrate') this.lumi.mode = 'follow'; });
  }

  // ================================================================= update
  update(dt) {
    if (this.pressT) for (const k in this.pressT) this.pressT[k] = Math.max(0, this.pressT[k] - dt);
    this.t += dt;
    this.tl.update(dt);
    if (this.hints && !this.ended && !this.busy) this.hints.tick(dt);
    for (const s of [this.aliveMix, this.rope, this.plateMix, this.labelDrop]) s.update(dt);
    if (this.drag) this.drag.p.update(dt);
    if (this.bubble) this.bubble.t += dt;
    if (this.wrongShow) this.wrongShow.t += dt;
    if (this.hintShow && this.t > this.hintUntil) this.hintShow = 0;
    this.hintT += dt;
    this.emptyGlow = Math.max(0, this.emptyGlow - dt); this.ropeNudge = Math.max(0, this.ropeNudge - dt);
    this.shake = Math.max(0, this.shake - dt); this.countPulse = Math.max(0, this.countPulse - dt);
    for (const m of this.movers) {
      m.t += dt;
      if (m.t >= m.dur && !m.fin) { m.fin = true; if (m.done) m.done(); }
    }
    this.movers = this.movers.filter((m) => !m.fin);
    for (const f of this.fx) f.t += dt;
    this.fx = this.fx.filter((f) => f.t < ({ settle: 0.35, full: 1.2, merge: 1.4, sink: 0.7, spark: 0.9, labelFly: 0.35, labelBounce: 0.9, labelBack: 0.3, supplyIn: 1.3 }[f.kind] || 1));
    for (const g of this.goneLabels) g.t += dt;
    for (const p of this.dust) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.97; p.r += dt * 14; }
    this.dust = this.dust.filter((p) => p.t < p.life);
    for (const a of this.actors) a.update(dt);
    if (this.tiko.clip === 'idle') this.tiko.faceTowards(BOX.cx);
    if (this.neo.clip === 'idle') this.neo.faceTowards(this.phase === 'label' ? PLATES[1].x - 400 : BOX.cx);
    const lm = this.lumi, bz = this.boxZone();
    if (lm.mode === 'follow') { const h = this.neo.headPoint(); lm.p.to(h.x - 70, h.y - 70 + Math.sin(this.t * 2.1) * 12); }
    else if (lm.mode === 'count') { const cx = (bz.x0 + bz.x1) / 2; lm.p.to(cx + Math.cos(this.t * 2.2) * (bz.x1 - bz.x0) * 0.42, bz.y0 - 20 + Math.sin(this.t * 4.4) * 30); }
    else if (lm.mode === 'hint') lm.p.to(lm.target.x + Math.cos(this.t * 3) * 36, lm.target.y - 60 + Math.sin(this.t * 3) * 16);
    else if (lm.mode === 'celebrate') lm.p.to(1020 + Math.cos(this.t * 1.6) * 380, 330 + Math.sin(this.t * 3.2) * 60);
    if (reduceMotion && lm.mode !== 'celebrate') lm.p.set(lm.p.x.target, lm.p.y.target);
    lm.p.update(dt);
  }

  // ================================================================= draw
  img(name) { return this.sprites.get(name); }

  draw(ctx) {
    const plate = this.img('storage_room'), alive = this.img('storage_room_on');
    if (plate) ctx.drawImage(plate, 0, 0, W, H);
    if (alive && this.aliveMix.value > 0.01) { ctx.globalAlpha = Math.min(1, this.aliveMix.value); ctx.drawImage(alive, 0, 0, W, H); ctx.globalAlpha = 1; }
    this.drawTally(ctx);
    this.drawRope(ctx);
    this.drawRack(ctx);
    this.drawSupply(ctx);
    ctx.save();
    if (this.shake > 0 && !reduceMotion) ctx.translate(Math.sin(this.t * 70) * 5 * this.shake, 0);
    this.drawBox(ctx);
    ctx.restore();
    this.drawCarry(ctx);
    this.tiko.draw(ctx);
    this.neo.draw(ctx);
    this.drawPlates(ctx);
    for (const m of this.movers) this.drawMover(ctx, m);
    for (const f of this.fx) this.drawFx(ctx, f);
    this.drawDust(ctx);
    this.drawDragged(ctx);
    this.drawLumi(ctx);
    this.drawHud(ctx);
  }

  /** A crate of `unit`, bottom-centre (x, y), `w` px wide; its brass plate shows the value (engine-written). */
  drawCrate(ctx, unit, x, y, w, { a = 1, glow = 0, ring = null, ghost = false } = {}) {
    const sp = SPR[unit], im = this.img(sp.name);
    const [bx0, by0, bx1, by1] = sp.bbox, s = w / (bx1 - bx0), h = (by1 - by0) * s;
    ctx.save(); ctx.globalAlpha = a * (ghost ? 0.32 : 1);
    if (glow > 0) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const R0 = Math.max(w, h) * 0.8;
      ctx.translate(x, y - h / 2); ctx.scale((w + 40) / (2 * R0), (h + 40) / (2 * R0));
      const g = ctx.createRadialGradient(0, 0, 4, 0, 0, R0);
      g.addColorStop(0, `rgba(255,220,140,${0.55 * glow})`); g.addColorStop(0.6, `rgba(255,220,140,${0.3 * glow})`); g.addColorStop(1, 'rgba(255,220,140,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    if (im) {
      const iw = (im.width || 512), ih = (im.height || 512), full = unit === 'one';
      const sx = full ? w / iw : s;
      ctx.drawImage(im, x - (full ? w / 2 : (bx0 + (bx1 - bx0) / 2) * s), y - (full ? ih * sx : by1 * s), iw * sx, ih * sx);
    }
    if (ring) {
      ctx.strokeStyle = `rgba(${ring.join(',')},0.95)`; ctx.lineWidth = Math.max(3, w * 0.04);
      ctx.beginPath(); ctx.roundRect(x - w / 2 - 3, y - h - 3, w + 6, h + 6, 6); ctx.stroke();
    }
    if (ghost) {
      ctx.globalAlpha = a * 0.95; ctx.strokeStyle = 'rgba(255,244,214,1)'; ctx.lineWidth = 3; ctx.setLineDash([8, 6]);
      ctx.strokeRect(x - w / 2 + 2, y - h + 2, w - 4, h - 4); ctx.setLineDash([]);
    }
    if (sp.plate && !ghost) {
      const [pu, pv, pw, ph] = sp.plate, px = x + (pu - (bx0 + bx1) / 2) * s, py = y + (pv - by1) * s;
      const f = Math.round(Math.min(ph * s * 0.7, pw * s * 0.42));
      if (pw * s >= 20) this.plateNumber(ctx, faDigits(unitValue(this.puzzle.units, unit)), px, py, Math.max(10, f));
    }
    ctx.restore();
    return h;
  }
  plateNumber(ctx, txt, x, y, size, a = 1) {
    ctx.save(); ctx.globalAlpha *= a;
    ctx.font = `800 ${size}px ${FONT}`; ctx.direction = 'ltr'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = Math.max(2, size * 0.12); ctx.strokeStyle = 'rgba(255,240,200,0.55)'; ctx.fillStyle = '#3b2410';
    ctx.strokeText(txt, x, y + size * 0.06); ctx.fillText(txt, x, y + size * 0.06);
    ctx.restore();
  }

  drawRack(ctx) {
    const im = this.img('warehouse_rack'); if (!im) return;
    const o = rp(0, 0); ctx.drawImage(im, o.x, o.y, 1024 * RACK.s, 1024 * RACK.s);
  }

  drawSupply(ctx) {
    const lay = this.layoutSupply(), fadeIn = this.fx.find((f) => f.kind === 'supplyIn');
    const h2 = this.hintShow === 2 && this.phase === 'pack';
    for (const s of this.ctrl.supply) {
      const sink = this.fx.find((f) => f.kind === 'sink' && f.uid === s.uid);
      if ((!s.present && !sink) || this.hidden.has(s.uid)) continue;
      if (this.drag && this.drag.uid === s.uid && this.drag.moved) continue;
      const p = lay.get(s.uid); if (!p) continue;
      let a = 1, dy = 0;
      if (sink) { const k = sink.t / 0.7; a = 1 - k; dy = 30 * k; }
      if (fadeIn && !s.fromPrevious) a *= Math.min(1, Math.max(0, (fadeIn.t - 0.5) / 0.7));
      const right = s.unit === this.ctrl.unit;
      this.drawCrate(ctx, s.unit, p.x, p.y + dy, p.w, { a, glow: h2 && right ? 0.6 + 0.4 * Math.sin(this.t * 5) : 0, ring: h2 && right ? GOLD : null });
    }
  }

  drawBox(ctx) {
    if (this.box === 'hundred') return this.drawHundredBox(ctx);
    const a = this.boxFade;
    if (a <= 0.01) return;
    ctx.save(); ctx.globalAlpha = a;
    const open = this.img('thousand_crate_open'), closed = this.img('thousand_crate'), s = THOU.s, o = tp(0, 0);
    if (open) ctx.drawImage(open, o.x, o.y, 1024 * s, 1024 * s);
    this.drawContents(ctx);
    if (this.shut > 0.001 && closed) {                   // the lid + front panel come down like a shutter
      const top = tp(0, THOU.top).y, bot = tp(0, 983).y, yS = top + (bot - top) * Math.min(1, this.shut);
      ctx.save(); ctx.beginPath(); ctx.rect(o.x, o.y, 1024 * s, yS - o.y); ctx.clip();
      ctx.drawImage(closed, o.x, o.y, 1024 * s, 1024 * s); ctx.restore();
      if (this.shut < 0.999) { ctx.fillStyle = 'rgba(20,10,4,0.35)'; ctx.fillRect(tp(THOU.u0 - 60, 0).x, yS, (THOU.u1 - THOU.u0 + 120) * s, 8); }
    }
    this.drawPlateText(ctx, 'thousand');
    if (this.hintShow === 3 && this.phase === 'label') {   // H3 (label): a ghost ۱۰۰۰ plate on the crate
      const at = this.crateLabelPos(), k = Math.min(1, this.hintT / 0.5);
      ctx.save(); ctx.globalAlpha = 0.5 * k; this.drawLabelPlate(ctx, this.stage.label.answer, at.x, at.y, 1.12); ctx.restore();
    }
    ctx.restore();
  }

  drawHundredBox(ctx) {
    const im = this.img('hundred_crate'), s = HUND.s, o = hp(0, 0);
    if (im) ctx.drawImage(im, o.x, o.y, 1024 * s, 1024 * s);
    const p0 = hp(HUND.u0, HUND.v0), p1 = hp(HUND.u1, HUND.v1);
    const yS = p0.y + (p1.y - p0.y) * Math.min(1, this.shut);
    if (yS < p1.y - 0.5) {                                 // open front: the dark interior with ten grooves, below the shutter
      ctx.save(); ctx.beginPath(); ctx.rect(p0.x, yS, p1.x - p0.x, p1.y - yS); ctx.clip();
      const g = ctx.createLinearGradient(0, p0.y, 0, p1.y);
      g.addColorStop(0, '#24150a'); g.addColorStop(0.75, '#3a2312'); g.addColorStop(1, '#5a3a1e');
      ctx.fillStyle = g; ctx.fillRect(p0.x, p0.y, p1.x - p0.x, p1.y - p0.y);
      const cw = (p1.x - p0.x) / GROUP;
      ctx.strokeStyle = 'rgba(110,70,34,0.55)'; ctx.lineWidth = 2;
      for (let i = 1; i < GROUP; i++) { ctx.beginPath(); ctx.moveTo(p0.x + i * cw, p0.y + 6); ctx.lineTo(p0.x + i * cw, p1.y - 4); ctx.stroke(); }
      const sh = ctx.createLinearGradient(0, p0.y, 0, p0.y + 40); sh.addColorStop(0, 'rgba(0,0,0,0.5)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = sh; ctx.fillRect(p0.x, p0.y, p1.x - p0.x, 40);
      this.drawContents(ctx);
      ctx.restore();
      if (this.shut > 0.001) {                             // shutter edge: the front panel's lower rim
        ctx.fillStyle = 'rgba(20,10,4,0.4)'; ctx.fillRect(p0.x, yS, p1.x - p0.x, 6);
      }
    }
    this.drawPlateText(ctx, 'hundred');
  }

  drawPlateText(ctx, box) {
    if (!this.plateText || this.shut < 0.99) return;
    const [u, v, pw, ph] = box === 'hundred' ? HUND.plate : THOU.plate, s = box === 'hundred' ? HUND.s : THOU.s;
    const p = box === 'hundred' ? hp(u, v) : tp(u, v), k = Math.max(0, this.plateMix.value);
    const size = Math.round(ph * s * 0.86 * (0.6 + 0.4 * Math.min(1.2, k)));
    this.plateNumber(ctx, this.plateText, p.x, p.y, size, Math.min(1, k * 1.5));
  }

  drawContents(ctx) {
    const c = this.ctrl, n = c.count;
    c.contents.forEach((it, i) => {
      if (this.hidden.has(it.uid)) return;
      const s = this.slot(i), z = this.size(it.unit);
      const settle = this.fx.find((f) => f.kind === 'settle' && f.slot === i), sq = settle ? Math.sin(Math.PI * settle.t / 0.35) * 0.06 : 0;
      const pulse = this.countPulse > 0 && Math.floor((4.5 - this.countPulse) / 0.4) % Math.max(1, n) === i ? 0.9 : 0;
      const full = this.fx.find((f) => f.kind === 'full' || f.kind === 'merge');
      const glow = Math.max(pulse, full ? 0.7 * Math.sin(Math.PI * Math.min(1, full.t / 1.2)) : 0);
      this.drawCrate(ctx, it.unit, s.x, s.y + sq * z.h * 0.3, z.w * (1 + sq * 0.4), { glow });
    });
    // the wrong-size crate sits in the next slot: its slot outline shows how much is missing
    const ws = this.wrongShow;
    if (ws) {
      const s = this.slot(ws.slot), z = this.size(ws.unit), blink = 0.6 + 0.4 * Math.sin(ws.t * 12);
      ctx.save(); ctx.strokeStyle = `rgba(${AMBER.join(',')},${blink})`; ctx.lineWidth = 4; ctx.setLineDash([10, 7]);
      const sz = this.size(this.ctrl.unit);
      ctx.strokeRect(s.x - sz.w / 2, s.y - sz.h, sz.w, sz.h); ctx.restore();
      this.drawCrate(ctx, ws.unit, s.x - (sz.w - z.w) / 2 + 4, s.y, z.w, { ring: AMBER });
    }
    // empty slots: amber after an incomplete close; dashed with their tally number for H2; ghosts for H3
    const cells = skipCounts(this.puzzle.units, this.ctrl.unit);
    for (let i = n; i < GROUP; i++) {
      if (ws && i === ws.slot) continue;
      const s = this.slot(i), sz = this.size(this.ctrl.unit);
      if (this.emptyGlow > 0) {
        const a = Math.min(1, this.emptyGlow) * (0.55 + 0.45 * Math.sin(this.t * 9));
        ctx.save(); ctx.fillStyle = `rgba(${AMBER.join(',')},${0.22 * a})`; ctx.strokeStyle = `rgba(${AMBER.join(',')},${a})`; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.roundRect(s.x - sz.w / 2 + 2, s.y - sz.h + 2, sz.w - 4, sz.h - 4, 6); ctx.fill(); ctx.stroke(); ctx.restore();
      }
      if (this.hintShow === 2 && this.phase === 'pack') {
        ctx.save(); ctx.strokeStyle = 'rgba(255,236,190,0.9)'; ctx.lineWidth = 3; ctx.setLineDash([9, 7]);
        ctx.strokeRect(s.x - sz.w / 2 + 3, s.y - sz.h + 3, sz.w - 6, sz.h - 6); ctx.restore();
        const f = this.box === 'hundred' ? 20 : 30;
        ctx.save(); ctx.font = `800 ${f}px ${FONT}`; ctx.direction = 'ltr'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(255,240,205,0.95)'; ctx.fillText(faDigits(cells[i]), s.x, s.y - sz.h / 2); ctx.restore();
      }
      if (this.hintShow === 3 && this.phase === 'pack') {
        const k = Math.min(1, Math.max(0, (this.hintT - (i - n) * 0.35) / 0.3));
        if (k > 0) this.drawCrate(ctx, this.ctrl.unit, s.x, s.y - (1 - k) * 40, sz.w, { a: k, ghost: true });
      }
    }
  }

  drawCarry(ctx) {
    const c = this.carry; if (!c) return;
    const k = c.k, w = lerp(c.from.w, c.to.w, k), x = lerp(c.from.x, c.to.x, k), y = arcY(c.from.y, c.to.y, k, 120);
    const h = this.drawCrate(ctx, 'hundred', x, y, w);
    if (c.text && k < 0.5) this.plateNumber(ctx, c.text, x, y - h * (982 - 836) / 324, Math.round(30 * (w / 760)), 1 - k * 2);
  }

  drawRope(ctx) {
    const hnd = this.handlePos(), glow = this.ctrl.canClose() && !this.busy ? 0.6 + 0.4 * Math.sin(this.t * 5) : this.ropeNudge > 0 ? 0.8 : 0;
    ctx.save();
    ctx.strokeStyle = '#8a6a3c'; ctx.lineWidth = 7; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(HOOK.x, HOOK.y); ctx.lineTo(hnd.x, hnd.y - 36); ctx.stroke();
    ctx.strokeStyle = 'rgba(60,40,18,0.5)'; ctx.lineWidth = 2; ctx.setLineDash([6, 6]);
    ctx.beginPath(); ctx.moveTo(HOOK.x - 1.5, HOOK.y); ctx.lineTo(hnd.x - 1.5, hnd.y - 36); ctx.stroke(); ctx.setLineDash([]);
    if (glow > 0 && this.phase === 'pack') {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(hnd.x, hnd.y, 6, hnd.x, hnd.y, 90);
      g.addColorStop(0, `rgba(255,220,140,${0.6 * glow})`); g.addColorStop(1, 'rgba(255,220,140,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(hnd.x, hnd.y, 90, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    // brass pull handle: a turned wooden grip in a brass ring
    const br = ctx.createLinearGradient(hnd.x - 30, 0, hnd.x + 30, 0);
    br.addColorStop(0, '#8a6a2a'); br.addColorStop(0.5, '#f0d488'); br.addColorStop(1, '#8a6a2a');
    ctx.strokeStyle = br; ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(hnd.x, hnd.y - 12, 24, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#7a4a22'; ctx.strokeStyle = '#3a220e'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(hnd.x - 52, hnd.y + 10, 104, 30, 15); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,220,160,0.35)'; ctx.fillRect(hnd.x - 42, hnd.y + 15, 84, 6);
    ctx.restore();
  }

  drawTally(ctx) {
    const T = TALLY, unit = this.ctrl.unit, cells = skipCounts(this.puzzle.units, unit);
    const filled = this.phase === 'pack' ? this.ctrl.count : GROUP;
    ctx.save();
    ctx.fillStyle = '#6b4424'; ctx.strokeStyle = '#3a220e'; ctx.lineWidth = 4;              // wooden frame
    ctx.beginPath(); ctx.roundRect(T.x - 12, T.y - 12, T.w + 24, T.h + 24, 14); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(250,240,215,0.97)'; ctx.beginPath(); ctx.roundRect(T.x, T.y, T.w, T.h, 8); ctx.fill();
    ctx.fillStyle = '#c9a25a'; [T.x + 4, T.x + T.w - 4].forEach((x) => { ctx.beginPath(); ctx.arc(x, T.y - 4, 5, 0, Math.PI * 2); ctx.fill(); });   // brass nails
    const f = unit === 'ten' ? 32 : 30, cy = T.y + T.h / 2 + 2, ws = this.wrongShow;
    const merge = this.fx.find((q) => q.kind === 'merge');
    const lh = this.hintShow === 2 && this.phase === 'label' ? Math.floor(this.hintT / 0.45) : -1;
    for (let i = 0; i < GROUP; i++) {
      const x = T.x + 20 + i * T.cell + T.cell / 2;
      const isWrong = ws && i === ws.slot;
      ctx.strokeStyle = isWrong ? `rgba(${AMBER.join(',')},1)` : 'rgba(150,110,50,0.55)'; ctx.lineWidth = isWrong ? 4 : 2;
      if (i >= filled && !isWrong) ctx.setLineDash([6, 6]);
      ctx.beginPath(); ctx.roundRect(x - T.cell / 2 + 4, T.y + 14, T.cell - 8, T.h - 28, 8); ctx.stroke(); ctx.setLineDash([]);
      let txt = null, col = '#4a3418', a = 1;
      if (i < filled) {
        txt = faDigits(cells[i]);
        if (i === filled - 1 && this.phase === 'pack') col = '#8a4a08';
        if (i === GROUP - 1 && filled === GROUP) col = '#a0600a';
        if (lh >= 0) a = i <= lh ? 1 : 0.35;
        if (this.countPulse > 0 && Math.floor((4.5 - this.countPulse) / 0.4) % filled === i) col = '#c07000';   // H1: count them
      } else if (isWrong) {
        txt = faDigits(this.ctrl.tally + unitValue(this.puzzle.units, ws.unit)); col = '#c07000';
      } else if ((this.hintShow === 2 || this.hintShow === 3) && this.phase === 'pack') {
        const k3 = this.hintShow === 3 ? Math.min(1, Math.max(0, (this.hintT - (i - filled) * 0.35) / 0.3)) : 1;
        txt = faDigits(cells[i]); col = 'rgba(122,90,48,1)'; a = 0.45 * k3;
      }
      if (txt) {
        if (merge && i < filled) { const k = Math.sin(Math.PI * Math.min(1, merge.t / 1.4)); ctx.fillStyle = `rgba(255,214,120,${0.45 * k})`; ctx.fillRect(x - T.cell / 2 + 6, T.y + 16, T.cell - 12, T.h - 32); }
        ctx.globalAlpha = a; ctx.font = `800 ${f}px ${FONT}`; ctx.direction = 'ltr'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = col; ctx.fillText(txt, x, cy); ctx.globalAlpha = 1;
      }
    }
    ctx.restore();
  }

  drawPlates(ctx) {
    const d = this.labelDrop.value;
    if (d < 0.02 || !this.stage.label.options.length) return;
    this.stage.label.options.forEach((v, i) => {
      const gone = this.goneLabels.find((g) => g.value === v);
      const flying = this.fx.some((f) => (f.kind === 'labelFly' || f.kind === 'labelBounce' || f.kind === 'labelBack') && f.value === v);
      if (flying || (this.drag && this.drag.kind === 'label' && this.drag.value === v && this.drag.moved)) return;
      if (this.ctrl.placedLabel === v) return;
      const a = gone ? Math.max(0, 1 - gone.t / 0.6) : 1; if (a <= 0.01) return;
      const p = this.platePos(i), sway = reduceMotion ? 0 : Math.sin(this.t * 1.6 + i) * 0.03;
      ctx.save(); ctx.globalAlpha = a;
      ctx.strokeStyle = '#6a4a26'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(p.x - 40, PLATES[i].pipe); ctx.lineTo(p.x - 40 + sway * 200, p.y - PLATE_H / 2); ctx.moveTo(p.x + 40, PLATES[i].pipe); ctx.lineTo(p.x + 40 + sway * 200, p.y - PLATE_H / 2); ctx.stroke();
      ctx.translate(p.x + sway * 200, p.y); ctx.rotate(sway);
      this.drawLabelPlate(ctx, v, 0, 0, 1);
      ctx.restore();
    });
  }
  drawLabelPlate(ctx, v, x, y, s = 1, ring = null) {
    const w = PLATE_W * s, h = PLATE_H * s;
    const g = ctx.createLinearGradient(x, y - h / 2, x, y + h / 2);
    g.addColorStop(0, '#f4dc98'); g.addColorStop(0.5, '#d9b262'); g.addColorStop(1, '#a8823c');
    ctx.fillStyle = g; ctx.strokeStyle = ring ? `rgba(${ring.join(',')},1)` : '#5a3e14'; ctx.lineWidth = ring ? 5 : 3;
    ctx.beginPath(); ctx.roundRect(x - w / 2, y - h / 2, w, h, 10 * s); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#6a4a1e';
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { ctx.beginPath(); ctx.arc(x + dx * (w / 2 - 9 * s), y + dy * (h / 2 - 9 * s), 3.5 * s, 0, Math.PI * 2); ctx.fill(); }
    this.plateNumber(ctx, faDigits(v), x, y, Math.round(34 * s));
  }

  drawMover(ctx, m) {
    const k = ease.inOutSine(Math.min(1, m.t / m.dur));
    this.drawCrate(ctx, m.unit, lerp(m.from.x, m.to.x, k), arcY(m.from.y, m.to.y, k, m.h), m.w);
  }

  drawFx(ctx, f) {
    if (f.kind === 'labelFly' || f.kind === 'labelBack') {
      const i = this.stage.label.options.indexOf(f.value), k = Math.min(1, f.t / (f.kind === 'labelFly' ? 0.35 : 0.3));
      const to = f.kind === 'labelFly' ? this.crateLabelPos() : this.platePos(i), s = f.kind === 'labelFly' ? lerp(1, 1.12, k) : 1;
      this.drawLabelPlate(ctx, f.value, lerp(f.from.x, to.x, ease.outCubic(k)), arcY(f.from.y, to.y, k, 60), s);
    } else if (f.kind === 'labelBounce') {
      const i = this.stage.label.options.indexOf(f.value), at = this.crateLabelPos(), home = this.platePos(i);
      let p;
      if (f.t < 0.25) p = { x: lerp(f.from.x, at.x, f.t / 0.25), y: arcY(f.from.y, at.y, f.t / 0.25, 50) };
      else if (f.t < 0.5) p = { x: at.x + Math.sin((f.t - 0.25) * 60) * 8, y: at.y };
      else { const k = (f.t - 0.5) / 0.4; p = { x: lerp(at.x, home.x, k), y: arcY(at.y, home.y, k, 90) }; }
      this.drawLabelPlate(ctx, f.value, p.x, p.y, 1, f.t > 0.2 && f.t < 0.65 ? AMBER : null);
    } else if (f.kind === 'spark') {
      const k = f.t / 0.9;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 10; i++) {
        const an = i / 10 * Math.PI * 2 + f.t, r = 30 + 70 * k;
        ctx.fillStyle = `rgba(255,230,160,${0.85 * (1 - k)})`;
        ctx.beginPath(); ctx.arc(f.x + Math.cos(an) * r, f.y + Math.sin(an) * r, 5 * (1 - k) + 1.5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    } else if (f.kind === 'merge' && this.shut > 0.99) {    // group_merge: a warm light sweeps over the closed crate
      const z = this.box === 'hundred' ? [hp(42, 658), hp(981, 982)] : [tp(84, 43), tp(939, 982)];
      const k = Math.min(1, f.t / 1.4), x = lerp(z[0].x - 80, z[1].x + 80, k);
      ctx.save(); ctx.beginPath(); ctx.rect(z[0].x, z[0].y, z[1].x - z[0].x, z[1].y - z[0].y); ctx.clip();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createLinearGradient(x - 90, 0, x + 90, 0);
      g.addColorStop(0, 'rgba(255,220,150,0)'); g.addColorStop(0.5, `rgba(255,220,150,${0.35 * Math.sin(Math.PI * k)})`); g.addColorStop(1, 'rgba(255,220,150,0)');
      ctx.fillStyle = g; ctx.fillRect(x - 90, z[0].y, 180, z[1].y - z[0].y); ctx.restore();
    }
  }

  drawDust(ctx) {
    for (const p of this.dust) {
      const a = 0.3 * Math.sin(Math.PI * Math.min(1, p.t / p.life)), r = p.r * 1.5;
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      g.addColorStop(0, `rgba(214,190,150,${a})`); g.addColorStop(1, 'rgba(214,190,150,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
    }
  }

  drawDragged(ctx) {
    const d = this.drag;
    if (!d || !d.moved) return;
    if (d.kind === 'label') { this.drawLabelPlate(ctx, d.value, d.p.x.value, d.p.y.value, 1.08); return; }
    const it = this.ctrl.item(d.uid), z = this.size(it.unit);
    this.drawCrate(ctx, it.unit, d.p.x.value, d.p.y.value, z.w * 1.06, { glow: 0.4 });
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
    ctx.font = `700 38px ${FONT}`; ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = ctx.measureText(text).width + 90;
    ctx.fillStyle = 'rgba(250,240,215,0.93)'; ctx.strokeStyle = 'rgba(150,110,50,0.8)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(W / 2 - w / 2 + 120, 34, w, 74, 20); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#4a3418'; ctx.fillText(text, W / 2 + 120, 73);
    if (this.bubble) {                                      // NEO's speech bubble, beside his head
      const a = Math.min(1, this.bubble.t / 0.3); ctx.globalAlpha = a;
      ctx.font = `700 34px ${FONT}`;
      const bw = ctx.measureText(this.bubble.text).width + 80, hd = this.neo.headPoint();
      const platesUp = this.labelDrop.value > 0.3 && this.phase === 'label';
      const bx = Math.min(W - bw / 2 - 20, Math.max(bw / 2 + 20, hd.x - 60));
      const by = platesUp ? Math.max(hd.y - 150, PLATE_Y + PLATE_H / 2 + 14) : Math.max(300, hd.y - 150);
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
    this.puzzle.stages.forEach((st, k) => {                // wordless progress: the two storage tasks
      const done = k < this.stageIdx || (k === this.stageIdx && (this.phase === 'solved' || this.ended));
      ctx.fillStyle = done ? 'rgba(255,200,90,0.95)' : k === this.stageIdx ? 'rgba(255,240,210,0.9)' : 'rgba(255,240,210,0.35)';
      ctx.beginPath(); ctx.arc(W / 2 + 120 - 14 + k * 28, 128, 7.5, 0, Math.PI * 2); ctx.fill();
    });
    if (this.ended && this.onExit && !this.fade) drawExitArrow(ctx, EXIT, this.t, reduceMotion);
    if (this.fade) { ctx.fillStyle = `rgba(22,16,10,${(1 - this.fade.a) * 0.85})`; ctx.fillRect(0, 0, W, H); }
    if (this.leaving) { ctx.fillStyle = `rgba(20,12,6,${this.leaving.a})`; ctx.fillRect(0, 0, W, H); }
  }

  debugState() {
    const c = this.ctrl;
    return {
      puzzle: this.stage.puzzle_id, phase: this.phase, phase_id: c.cur.phase_id, unit: c.unit, count: c.count, tally: c.tally,
      closed: c.closed, supply: c.presentSupply().map((s) => s.unit).join(' ') || '-', labels: c.labelOptions.join(' ') || '-',
      placed: c.placedLabel ?? '-', plate: this.plateText || '-', busy: this.busy,
      hint_level: this.hints.level, hint_available: this.hints.available, wrong: this.hints.wrong, assisted: this.stageAssisted,
      flagged: [...this.misc.flagged].join(',') || '-', mastery: this.mastery.get(this.puzzle.concept_id),
      world: Object.keys(this.save.data.world).join(',') || '-', music_layers: this.audio.layers,
    };
  }
}
