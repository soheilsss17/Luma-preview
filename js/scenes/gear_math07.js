// LUMA — WS_GEAR_ROOM / MATH-07 «ارزش مکانی» (book grade 3, chapter 2, pp. 31–33; card MATH-07).
// Quest Q02: the workshop's counting machine has shuffled the digits of an important number. The child builds it on the
// wall panel: four columns (هزارگان | صدگان | دهگان | یکان, left → right like the textbook table), a digit tile in each.
// Under every column its readout window shows what the digit is worth there (۵ in دهگان → ۵۰) and that many crates of the
// column's size drop into the right pan of the weighing machine. Pulling the lever compares the two pans: a digit in the
// wrong column makes a wildly different quantity and the beam leans (card v1 feedback: the weighing machine does not
// balance). Then «یکان ۴، دهگان ۵، صدگان صفر، هزارگان ۷» → ۷۰۵۴ (p.31) — the zero holds its place — and the transfer:
// a shipment label, «ارزش این رقم چیست؟» (p.33: ۴۰۳۰ = ۴ هزارتایی و ۳ دهتایی, so the ۳ is worth ۳۰).
// Pure rules: edu/place_value_rules.js · controller: puzzles/place_panel.js · content: Content/Puzzles/MATH-07.puzzle.json
// Geometry: every number below is measured on the batch-18 finals / the room plate (see tools notes).
import { drawHudButton, drawExitArrow, PRESS_S } from '../engine/hud.js';
import { faDigits } from '../engine/strings.js';
import { MisconceptionEngine, HintEngine, MasteryEngine, AnalyticsQueue, SaveSlot } from '../edu/engines.js';
import { Spring, Spring2, Timeline, ease, reduceMotion } from '../engine/motion.js';
import { RigActor } from '../engine/rig.js';
import { PlacePanelController } from '../puzzles/place_panel.js';
import { PLACES, PLACE_VALUE, COLS, digitsOf } from '../edu/place_value_rules.js';

export const W = 1920, H = 1080;
const TILE_SPRITE_W = 236;          // the tile's content width inside its 256 px sprite (measured bbox 10–245)
const FONT = 'LumaFa, Vazirmatn, Tahoma, sans-serif';
const AMBER = [255, 176, 50], GOLD = [255, 214, 120], INK = '#4a3418';

// ---------------------------------------------------------------- the panel over the painted bay
// ENV_WS_GEAR_ROOM: the recessed bay measured on the plate — interior x 514–930, y 290–641 (brass frame on 510/934/288/642)
export const BAY = { x0: 514, y0: 290, x1: 930, y1: 641 };
// PROP_PLACE_VALUE_PANEL 1024²: alpha bbox 42–981 × 354–982 → 939 × 628. Content is drawn 580 wide over the bay.
export const PANEL = { x: 432, y: 272, w: 580 };
export const P_S = PANEL.w / 939;                       // screen px per sprite px
export const PANEL_H = 628 * P_S;
export const px = (u) => PANEL.x + (u - 42) * P_S;
export const py = (v) => PANEL.y + (v - 354) * P_S;
// measured on the final: one lamp, one blank name plate, one socket and one readout window per column
export const COL_U = [183, 402, 620, 839];                                  // column centres, sprite u
export const COL_X = COL_U.map(px);                                         // … on screen
export const LAMP = { v: 512, r: 22 * P_S };
export const SOCKET = { v0: 585, v1: 728, w: 134 * P_S, h: 143 * P_S };     // the empty square the tile snaps into
export const READOUT = { v0: 790, v1: 846, w: 138 * P_S, h: 56 * P_S };
export const NAME = { y: py(752), h: 34, w: 112 };                          // engine-drawn name plate (H2), in the wood band
export const socketY = () => (py(SOCKET.v0) + py(SOCKET.v1)) / 2;
export const readoutY = () => (py(READOUT.v0) + py(READOUT.v1)) / 2;

// ---------------------------------------------------------------- the tile tray (engine-drawn bench) and the tiles
export const BENCH = { x0: 372, x1: 1016, y: 900, h: 58 };
export const TILE = { w: 96, slots: [470, 610, 750, 890], y: 892 };
export const TILE_W_SOCKET = 82;                        // a tile snapped into its socket (socket w ≈ 83)

// ---------------------------------------------------------------- the weighing machine (PROP_VALUE_BEAM_PARTS)
export const MACHINE = { footX: 1520, footY: 955, s: 0.72 };
const MS = MACHINE.s;
export const STAND = { w: 315 * MS, h: 748 * MS };
const standX = () => MACHINE.footX - STAND.w / 2, standY = () => MACHINE.footY - STAND.h;
export const PIVOT = { x: MACHINE.footX, y: standY() + 44.5 * MS };
export const HOOK_DX = 306.5 * MS, HOOK_DY = 182 * MS;   // beam hole → hook, from the measured pivots
export const PAN = { w: 348 * MS, h: 414 * MS, ringX: 172.5 * MS, ringY: 27.5 * MS, rim: 321 * MS, floor: 400 * MS };
/** Which way the beam leans: -1 left pan down, 0 level, 1 right pan down. */
export const LEAN_MAX = 0.155;                          // rad, ≈ 9°
export const LEVER = { x: standX() + 6, y: 878, r: 74 };
export const NEO_PULL_X = 1240;

// crates stacked in a pan (same sprites / aspect ratios as MATH-06): thousands … ones
export const CRATE = {
  thousand: { name: 'thousand_crate', w: 40, h: 40 * 939 / 855, off: 7 },
  hundred: { name: 'hundred_crate', w: 34, h: 34 * 324 / 939, off: 3 },
  ten: { name: 'crate_small', w: 13, h: 13 / 0.381, off: 6 },
  one: { name: 'counting_block', w: 10, h: 10 * 128 / 112, off: 3 },
};
export const CRATE_UNIT = ['thousand', 'hundred', 'ten', 'one'];            // PLACES (thousands … ones) → CRATE keys
export const PAN_INNER = 214, PAN_DEPTH = PAN.floor - PAN.rim;              // usable width / depth of a pan

// ---------------------------------------------------------------- transfer: the shipment label
export const LABEL = { x: 700, y: 616, w: 430, h: 176 };
export const OPTION = { y: 862, w: 168, h: 92, gap: 40 };

export const NEO_HOME = 1130, NEO_GROUND = 990, TIKO_X = 300;
export const BTN = { hint: { x: 90, y: 90 }, undo: { x: 220, y: 90 }, reset: { x: 350, y: 90 } };
const BTN_R = 58;
export const EXIT = { x: 1832, y: 985, r: 95 };

const lerp = (a, b, t) => a + (b - a) * t;
const arcY = (y0, y1, k, h) => lerp(y0, y1, k) - Math.sin(Math.PI * k) * h;

export class GearMath07 {
  constructor({ sprites, puzzle, audio, storage, debug, strings, onExit }) {
    Object.assign(this, { sprites, puzzle, audio, debug, strings, onExit });
    this.save = new SaveSlot(storage);
    this.mastery = new MasteryEngine(storage);
    this.analytics = new AnalyticsQueue(storage, puzzle.analytics_fields);
    this.tl = new Timeline();
    this.t = 0; this.attempt = 0; this.drag = null; this.fx = []; this.movers = [];
    this.aliveMix = new Spring(0, { stiffness: 4, damping: 5 });
    this.beam = new Spring(0, { stiffness: 26, damping: 5 });      // the beam's angle (rad)
    this.lever = new Spring(0, { stiffness: 90, damping: 10 });    // 0 up … 1 pulled down
    this.litMix = new Spring(0, { stiffness: 10, damping: 6 });    // the panel lamps coming on
    this.lumi = { p: new Spring2(700, 420, { stiffness: 30, damping: 9 }), mode: 'follow' };
    this.ended = false; this.bubble = null;
  }

  async load() {
    this.neo = await new RigActor({ id: 'NEO', scale: 0.28, x: NEO_HOME, groundY: NEO_GROUND, face: -1 }).load();
    this.tiko = await new RigActor({ id: 'TIKO', scale: 0.16, x: TIKO_X, groundY: 1000, face: 1 }).load();
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
    this.ctrl = new PlacePanelController(this.stage);
    this.misc = new MisconceptionEngine(this.puzzle.misconceptions, this.puzzle.misconception_flag_threshold);
    this.hints = new HintEngine(this.stage.hints, this.stage.answer_assist);
    this.stageMaxHint = 0; this.stageAssisted = false; this.stageStart = this.t; this.attempt++;
    this.fx = []; this.movers = []; this.showNames = false; this.wrongCols = []; this.emptyGlow = 0;
    this.busy = false; this.hintShow = 0; this.ended = false; this.bubble = null; this.goneOptions = [];
    this.beam.set(0); this.beam.target = 0; this.lever.set(0); this.lever.target = 0;
    this.lumi.mode = 'follow';
    if (finished) {
      const c = this.ctrl;
      if (c.state === 'build') { const t = digitsOf(c.target); for (const tile of c.tiles) c.place(tile.uid, t.indexOf(tile.digit)); c.weigh(); }
      else while (c.state !== 'solved') c.answer(c.round.answer);
      this.ended = true; this.litMix.set(1); this.litMix.target = 1; this.audio.setLayers(4);
      return;
    }
    this.audio.setLayers(idx + 1);
    this.log('puzzle_start', {});
    this.recordMastery(false);
    this.save.setPuzzle(this.stage.puzzle_id, { solved: false, entered: new Date().toISOString() });
  }

  get build() { return this.stage.kind === 'build'; }
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

  say(key, sec = 3.2) {
    if (!key || !this.strings) return;
    const b = { text: this.strings.t(key), t: 0 }; this.bubble = b;
    this.tl.after(sec, () => { if (this.bubble === b) this.bubble = null; });
  }

  // ================================================================= geometry
  /** Bottom-centre of the four panel sockets. */
  colX(i) { return COL_X[i]; }
  socketPos(i) { return { x: COL_X[i], y: socketY(), w: SOCKET.w, h: SOCKET.h }; }
  /** A tile's home: snapped into its socket, or its own slot on the tray. y = the tile's bottom edge. */
  tileHome(uid) {
    const col = this.ctrl.slotOf(uid);
    if (col >= 0) return { x: COL_X[col], y: py(SOCKET.v1) - 4, w: TILE_W_SOCKET };
    const k = this.ctrl.tiles.findIndex((t) => t.uid === uid);
    return { x: TILE.slots[k < 0 ? 0 : k], y: TILE.y, w: TILE.w };
  }
  colAt(x, y) {
    if (y < py(SOCKET.v0) - 60 || y > py(READOUT.v1) + 34) return -1;
    let best = -1, bd = 1e9;
    for (let i = 0; i < COLS; i++) { const d = Math.abs(x - COL_X[i]); if (d < bd) { bd = d; best = i; } }
    return bd <= SOCKET.w * 0.7 ? best : -1;
  }
  tileAt(x, y) {
    for (const t of this.ctrl.tiles) {
      const p = this.tileHome(t.uid), isSocket = this.ctrl.slotOf(t.uid) >= 0;
      const w = isSocket ? TILE_W_SOCKET : TILE.w, h = w;
      if (Math.abs(x - p.x) < w / 2 + 8 && Math.abs(y - (p.y - h / 2)) < h / 2 + 10) return t.uid;
    }
    return null;
  }
  onLever(x, y) { return Math.hypot(x - LEVER.x, y - LEVER.y) < LEVER.r; }
  optionPos(i) {
    const n = this.ctrl.options.length, w = OPTION.w;
    const total = n * w + (n - 1) * OPTION.gap;
    return { x: LABEL.x - total / 2 + w / 2 + i * (w + OPTION.gap), y: OPTION.y };
  }
  optionAt(x, y) {
    for (let i = 0; i < this.ctrl.options.length; i++) {
      const p = this.optionPos(i);
      if (Math.abs(x - p.x) < OPTION.w / 2 + 6 && Math.abs(y - p.y) < OPTION.h / 2 + 10) return this.ctrl.options[i];
    }
    return null;
  }
  /** Hook positions of the beam (rotated by the beam's angle): left/right. */
  hooks() {
    const a = this.beam.value, c = Math.cos(a), s = Math.sin(a), dx = HOOK_DX, dy = HOOK_DY;
    return [-1, 1].map((k) => ({ x: PIVOT.x + k * dx * c - dy * s, y: PIVOT.y + k * dx * s + dy * c }));
  }
  panPos(i) {
    const hk = this.hooks()[i];
    return { x: hk.x - PAN.ringX, y: hk.y - PAN.ringY, w: PAN.w, h: PAN.h };
  }
  /** Crates stacked in a pan for `value` (thousands … ones): each unit is a pile, piles stand side by side. */
  panLoad(value) {
    const counts = digitsOf(value);
    const groups = [];
    let total = 0;
    for (let k = 0; k < COLS; k++) {
      const n = counts[k]; if (!n) continue;
      const c = CRATE[CRATE_UNIT[k]];
      const per = Math.max(1, Math.floor((PAN_DEPTH - c.h) / c.off) + 1);
      const cols = Math.ceil(n / per);
      const w = cols * (c.w + 4) - 4;
      groups.push({ unit: CRATE_UNIT[k], place: PLACES[k], n, c, per, cols, w });
      total += w;
    }
    if (!groups.length) return [];
    total += 10 * (groups.length - 1);
    const s = total > PAN_INNER ? PAN_INNER / total : 1;
    const out = [];
    let x = -total * s / 2;
    for (const g of groups) {
      let left = g.n;
      for (let col = 0; col < g.cols; col++) {
        const n = Math.min(g.per, left); left -= n;
        for (let k = 0; k < n; k++) {
          out.push({ unit: g.unit, place: g.place, x: x + col * (g.c.w + 4) * s + g.c.w * s / 2,
            dy: -k * g.c.off * s, w: g.c.w * s, h: g.c.h * s });
        }
      }
      x += (g.w + 10) * s;
    }
    return out;
  }

  // ================================================================= actions
  /** A tile dropped on column `col` (or lifted back to the tray). */
  dropTile(uid, col) {
    if (this.busy || this.ended || !this.build || this.ctrl.state !== 'build') return null;
    const from = this.ctrl.slotOf(uid);
    if (from === col) return null;
    if (col < 0) {                                        // back to the tray
      const r = this.ctrl.remove(from);
      if (r == null) return null;
      this.hints.onActivity();
      this.audio.digitPick(); this.audio.slotClick(0);
      this.log('digit_selected', { digit: this.ctrl.tile(uid).digit, place: PLACES[from] });
      this.neo.play('pick_up', 'idle');
      if (Math.abs(this.neo.x - NEO_HOME) > 6) this.neo.walkTo(NEO_HOME, () => this.neo.faceTowards(this.colX(1)));
      this.beam.target = 0;
      return { kind: 'out', uid, col: from };
    }
    const r = this.ctrl.place(uid, col);
    if (!r) return null;                                  // locked column (H3 example / Assist)
    this.hints.onActivity();
    const digit = this.ctrl.tile(uid).digit, value = digit * PLACE_VALUE[col];
    this.audio.slotClick(COLS - 1 - col);
    this.audio.digitPick();
    this.fx.push({ kind: 'snap', col, t: 0 });
    this.fx.push({ kind: 'readout', col, t: 0 });
    this.log('digit_selected', { digit, place: PLACES[col] });
    this.log('place_selected', { place: PLACES[col], value_preview: value });
    this.neo.play('place', 'idle');
    this.beam.target = 0;                                 // the pans are being re-loaded: the beam returns to level
    this.wrongCols = [];
    if (Math.abs(this.neo.x - NEO_HOME) > 6) this.neo.walkTo(NEO_HOME, () => this.neo.faceTowards(this.colX(1)));
    return { kind: 'in', uid, col, digit, value };
  }

  /** Pull the weigh lever: NEO runs to it, pulls, and the beam answers. */
  pullLever() {
    if (this.busy || this.ended || !this.build || this.ctrl.state !== 'build') return null;
    this.busy = true;
    this.hints.onActivity();
    const at = () => {
      this.neo.faceTowards(LEVER.x + 40);
      this.neo.play('pull', 'idle');
      this.lever.target = 1;
      this.tl.after(0.25, () => { this.lever.target = 0; this.weigh(); });
    };
    if (Math.abs(this.neo.x - NEO_PULL_X) > 40) this.neo.runTo(NEO_PULL_X, at); else at();
    return true;
  }

  weigh() {
    const r = this.ctrl.weigh();
    this.audio.beamRelease();
    this.log('value_preview', { value_preview: r.value });
    if (!r.ok) {
      this.audio.beamSwing(0);
      if (r.rule === 'incomplete') {
        this.emptyGlow = 2.6;
        this.say('line.MATH-07.incomplete', 2.8);
        this.log('placement_error', { placement_error: r.rule, error_type: 'ProcedureError', empty: r.empty.join(',') });
      } else {
        const def = this.observe(r.rule);
        const wrong = digitsOf(this.stage.target)
          .map((d, i) => (this.ctrl.placed[i] === d ? -1 : i)).filter((i) => i >= 0);
        this.wrongCols = wrong;
        this.say('line.MATH-07.lean', 2.6);
        this.audio.flicker();
        this.tiko.play('concerned', 'idle');
        this.log('placement_error', { placement_error: r.rule, error_type: def ? def.error_type : 'ConceptError',
          misconception: def ? def.code : null, alias: def ? def.alias : null, value_preview: r.value });
        this.tl.after(1.4, () => this.say('line.MATH-07.wrong_columns', 2.4));
      }
      this.beam.target = r.rule === 'incomplete' ? 0 : r.lean * LEAN_MAX;
      this.tl.after(0.9, () => this.audio.beamSwing(r.lean));
      this.neo.play('think', 'idle');
      this.tl.after(1.6, () => { this.busy = false; });
      if (this.hints.onWrong() === 'assist') this.tl.after(1.4, () => this.applyAssist());
      return r;
    }
    this.beam.target = 0;
    this.litMix.target = 1;
    this.audio.beamSwing(0);
    this.tl.after(0.7, () => {
      this.audio.chime(); this.neo.play('happy', 'idle'); this.tiko.play('happy', 'idle');
      this.say(this.stage.done_line_key, 3.2);
    });
    this.log('solved_stage', { value_preview: r.value });
    this.tl.after(2.2, () => this.onSolved());
    return r;
  }

  answer(value) {
    if (this.busy || this.ended || this.build) return null;
    const r = this.ctrl.answer(value);
    if (!r) return null;
    this.hints.onActivity();
    if (r.ok) {
      this.audio.slotClick(3); this.audio.chime();
      this.fx.push({ kind: 'spark', x: LABEL.x, y: LABEL.y - 20, t: 0 });
      this.neo.play('happy', 'idle');
      this.log('value_preview', { value_preview: value });
      this.tl.after(0.9, () => {
        if (this.ctrl.state === 'solved') return this.onSolved();
        this.tl.after(0.2, () => { this.busy = false; this.goneOptions = []; });
      });
      this.busy = true;
      return r;
    }
    this.audio.flicker();
    const def = this.observe(r.rule);
    this.fx.push({ kind: 'bounce', value, t: 0 });
    this.tiko.play('concerned', 'idle'); this.neo.play('think', 'idle');
    this.log('placement_error', { placement_error: r.rule, error_type: def ? def.error_type : 'ConceptError',
      misconception: def ? def.code : null, alias: def ? def.alias : null, value_preview: value });
    if (this.hints.onWrong() === 'assist') this.tl.after(0.9, () => this.applyAssist());
    return r;
  }

  applyAssist() {
    if (this.ended || this.ctrl.state === 'solved') return;
    const a = this.ctrl.assist();
    if (!a) return;
    this.stageAssisted = true;
    this.audio.shimmer();
    if (a.kind === 'option') this.goneOptions.push({ value: a.value, t: 0 });
    else {
      for (const uid of a.returned) this.fx.push({ kind: 'toTray', uid, t: 0 });
      for (const col of a.locked) this.fx.push({ kind: 'lock', col, t: 0 });
      if (a.example) this.fx.push({ kind: 'example', col: a.example.col, t: 0 });
      this.beam.target = 0;
    }
    this.log('puzzle_interaction', { action: 'answer_assist', removed: a.kind === 'option' ? a.value : a.returned.length });
  }

  onSolved() {
    this.stageMaxHint = Math.max(this.stageMaxHint, this.hints.maxUsed);
    this.log('solved', { solved: true, assisted: this.stageAssisted });
    this.recordMastery(true);
    this.save.setPuzzle(this.stage.puzzle_id, { solved: true, hint_max: this.stageMaxHint, assisted: this.stageAssisted });
    this.audio.motif(); this.neo.play('happy', 'idle'); this.tiko.play('happy', 'idle');
    this.busy = true;
    if (this.stageIdx < this.puzzle.stages.length - 1) {
      this.lumi.mode = 'celebrate';
      this.tl.after(2.8, () => { this.lumi.mode = 'follow'; this.transition(() => this.startStage(this.stageIdx + 1)); });
      return;
    }
    // WS_NUMBER_PANEL_FIXED: the counting room wakes up — lamps on, gears turning; back to NEO's map
    this.tl.after(0.8, () => {
      this.save.setFlag(this.puzzle.world_state_on_solve);
      this.audio.bell(); this.audio.setLayers(4); this.aliveMix.target = 1; this.litMix.target = 1;
      this.say(this.stage.done_line_key, 3.4);
      this.neo.play('celebrate', 'idle'); this.tiko.play('celebrate', 'idle'); this.lumi.mode = 'celebrate';
      this.tl.after(3.4, () => { this.lumi.mode = 'follow'; this.ended = true; this.busy = false; this.neoHome(); });
    });
  }

  neoHome() { if (Math.abs(this.neo.x - NEO_HOME) > 6) this.neo.walkTo(NEO_HOME, () => this.neo.faceTowards(this.colX(1))); }

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
    this.ctrl = new PlacePanelController(this.stage);
    this.misc = keep.misc; this.hints = new HintEngine(this.stage.hints, this.stage.answer_assist);
    this.hints.maxUsed = keep.hints.maxUsed; this.hints.wrong = keep.hints.wrong; this.hints.available = keep.hints.available;
    this.stageMaxHint = keep.maxHint;                      // stageAssisted stays: a reset does not erase an Assist
    this.fx = []; this.movers = []; this.wrongCols = []; this.goneOptions = []; this.showNames = false;
    this.beam.set(0); this.beam.target = 0; this.litMix.target = this.litMix.value;
    this.neoHome();
    this.audio.snap();
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
    if (!this.busy && !this.ended) {
      if (this.build) {
        const uid = this.tileAt(x, y);
        if (uid) {
          const p = this.tileHome(uid), w = this.ctrl.slotOf(uid) >= 0 ? TILE_W_SOCKET : TILE.w;
          this.drag = { kind: 'tile', uid, off: { x: p.x - x, y: (p.y - w / 2) - y },
            p: new Spring2(p.x, p.y - w / 2, { stiffness: 260, damping: 22 }), moved: false };
          this.audio.digitPick(); return;
        }
        if (this.onLever(x, y)) return this.pullLever();
      } else {
        const v = this.optionAt(x, y);
        if (v !== null) {
          const i = this.ctrl.options.indexOf(v), p = this.optionPos(i);
          this.drag = { kind: 'option', value: v, off: { x: p.x - x, y: p.y - y },
            p: new Spring2(p.x, p.y, { stiffness: 260, damping: 22 }), moved: false };
          this.audio.digitPick(); return;
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
    if (d.kind === 'tile') {
      if (!d.moved) {                                      // tap: a tile in a column goes back to the tray
        const col = this.ctrl.slotOf(d.uid);
        if (col >= 0) this.dropTile(d.uid, -1);
        return;
      }
      const col = this.colAt(x, y);
      if (col >= 0) {
        if (col === this.ctrl.slotOf(d.uid)) return;         // dropped back on its own column: it stays put
        return this.dropTile(d.uid, col);
      }
      const sc = this.ctrl.slotOf(d.uid);
      if (sc >= 0 && y > BENCH.y - 90) return this.dropTile(d.uid, -1);
      const home = this.tileHome(d.uid), w = sc >= 0 ? TILE_W_SOCKET : TILE.w;
      this.move({ kind: 'tile', uid: d.uid, from: { x: d.p.x.value, y: d.p.y.value }, to: home, w, dur: 0.3, h: 30 });
      return;
    }
    const near = Math.hypot(x - LABEL.x, y - (LABEL.y + LABEL.h / 2 + 60)) < 220;
    if (!d.moved || near) return this.answer(d.value);
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
      if (busy || this.ended || !this.build) return;
      const u = this.ctrl.undo();
      if (u) { this.audio.snap(); this.beam.target = 0; this.wrongCols = []; this.log('puzzle_interaction', { action: 'undo' }); }
    } else if (name === 'reset') {
      if (this.ended) return this.replay();
      if (busy) return;
      this.resetStage();
    }
  }

  showHint(h) {
    this.stageMaxHint = Math.max(this.stageMaxHint, h.level);
    if (h.text_key) this.say(h.text_key, 5);
    this.hintShow = h.level; this.hintUntil = this.t + (h.level === 1 ? 5 : 10);
    if (h.level === 1) { this.lumi.mode = 'columns'; }
    else if (h.level === 2) { this.showNames = true; this.lumi.mode = 'hint'; this.lumi.target = { x: PANEL.x + PANEL.w / 2, y: NAME.y }; }
    else {
      this.lumi.mode = 'hint';
      const col = this.build ? Math.max(0, digitsOf(this.stage.target).findIndex((d, i) => this.ctrl.placed[i] !== d)) : 0;
      this.lumi.target = this.build ? { x: COL_X[col], y: socketY() } : { x: LABEL.x, y: LABEL.y };
      if (this.build) {
        const ex = this.ctrl.placeExample();
        if (ex) this.fx.push({ kind: 'example', col: ex.col, t: 0 });
      }
    }
    this.tl.after(h.level === 1 ? 4.5 : 4, () => { if (this.lumi.mode !== 'celebrate') this.lumi.mode = 'follow'; });
  }

  // ================================================================= update
  update(dt) {
    if (this.pressT) for (const k in this.pressT) this.pressT[k] = Math.max(0, this.pressT[k] - dt);
    this.t += dt;
    this.tl.update(dt);
    if (this.hints && !this.ended && !this.busy) this.hints.tick(dt);
    for (const s of [this.aliveMix, this.beam, this.lever, this.litMix]) s.update(dt);
    if (this.drag) this.drag.p.update(dt);
    if (this.bubble) this.bubble.t += dt;
    if (this.hintShow && this.t > this.hintUntil) this.hintShow = 0;
    this.emptyGlow = Math.max(0, this.emptyGlow - dt);
    for (const m of this.movers) { m.t += dt; if (m.t >= m.dur && !m.fin) { m.fin = true; if (m.done) m.done(); } }
    this.movers = this.movers.filter((m) => !m.fin);
    for (const f of this.fx) f.t += dt;
    const FXL = { snap: 0.5, readout: 1.1, spark: 0.9, bounce: 0.8, toTray: 0.6, lock: 0.8, example: 1.0 };
    this.fx = this.fx.filter((f) => f.t < (FXL[f.kind] || 1));
    for (const g of this.goneOptions) g.t += dt;
    for (const a of this.actors) a.update(dt);
    if (this.neo.clip === 'idle') this.neo.faceTowards(this.build ? this.colX(1) : LABEL.x);
    if (this.tiko.clip === 'idle') this.tiko.faceTowards(this.build ? MACHINE.footX : LABEL.x);
    const lm = this.lumi;
    if (lm.mode === 'follow') { const h = this.neo.headPoint(); lm.p.to(h.x - 70, h.y - 70 + Math.sin(this.t * 2.1) * 12); }
    else if (lm.mode === 'columns') {
      const k = Math.floor(this.t * 1.6) % COLS;
      lm.p.to(COL_X[k], py(LAMP.v) - 40 + Math.sin(this.t * 4) * 12);
    } else if (lm.mode === 'hint') lm.p.to(lm.target.x + Math.cos(this.t * 3) * 36, lm.target.y - 60 + Math.sin(this.t * 3) * 16);
    else if (lm.mode === 'celebrate') lm.p.to(700 + Math.cos(this.t * 1.6) * 380, 380 + Math.sin(this.t * 3.2) * 60);
    if (reduceMotion && lm.mode !== 'celebrate') lm.p.set(lm.p.x.target, lm.p.y.target);
    lm.p.update(dt);
  }

  // ================================================================= draw
  img(name) { return this.sprites.get(name); }

  draw(ctx) {
    const plate = this.img('gear_room'), alive = this.img('gear_room_on');
    if (plate) ctx.drawImage(plate, 0, 0, W, H);
    if (alive && this.aliveMix.value > 0.01) { ctx.globalAlpha = Math.min(1, this.aliveMix.value); ctx.drawImage(alive, 0, 0, W, H); ctx.globalAlpha = 1; }
    this.drawMachine(ctx);
    this.drawPanel(ctx);
    if (this.build) { this.drawBench(ctx); this.drawTiles(ctx); }
    else this.drawLabel(ctx);
    this.tiko.draw(ctx);
    this.neo.draw(ctx);
    for (const m of this.movers) this.drawMover(ctx, m);
    for (const f of this.fx) this.drawFx(ctx, f);
    this.drawDragged(ctx);
    this.drawLumi(ctx);
    this.drawHud(ctx);
  }

  drawPanel(ctx) {
    const off = pv_off(), lit = this.img('pv_panel_lit');
    ctx.drawImage(this.img('pv_panel'), off.x, off.y, 1024 * P_S, 1024 * P_S);
    if (lit && this.litMix.value > 0.01) {
      ctx.globalAlpha = Math.min(1, this.litMix.value);
      ctx.drawImage(lit, off.x, off.y, 1024 * P_S, 1024 * P_S);
      ctx.globalAlpha = 1;
    }
    const glow = this.emptyGlow > 0 ? 0.5 + 0.5 * Math.sin(this.t * 12) : 0;
    for (let i = 0; i < COLS; i++) {
      const x = COL_X[i], empty = this.build && this.ctrl.placed[i] === null;
      if (this.showNames) this.drawNamePlate(ctx, i);
      if (!this.build) continue;
      // the socket: a dashed outline while it waits, an amber blink when the lever stops on an empty column
      if (empty) {
        ctx.save();
        ctx.strokeStyle = `rgba(${glow ? AMBER.join(',') : '190,150,90'},${empty ? 0.55 + 0.35 * glow : 0.35})`;
        ctx.lineWidth = 3; ctx.setLineDash([9, 7]);
        ctx.strokeRect(x - SOCKET.w / 2, py(SOCKET.v0), SOCKET.w, SOCKET.h);
        ctx.restore();
      }
      if (this.wrongCols.includes(i) && Math.sin(this.t * 9) > -0.2) {
        ctx.save(); ctx.strokeStyle = `rgba(${AMBER.join(',')},0.9)`; ctx.lineWidth = 4;
        ctx.strokeRect(x - SOCKET.w / 2 - 4, py(SOCKET.v0) - 4, SOCKET.w + 8, SOCKET.h + 8);
        ctx.restore();
      }
      const d = this.ctrl.placed[i];
      if (d !== null) this.drawReadout(ctx, i, d);
    }
  }

  drawNamePlate(ctx, i) {
    const x = COL_X[i], y = NAME.y, w = NAME.w, h = NAME.h;
    ctx.save();
    const g = ctx.createLinearGradient(0, y - h / 2, 0, y + h / 2);
    g.addColorStop(0, 'rgba(226,186,104,0.97)'); g.addColorStop(1, 'rgba(180,134,58,0.97)');
    ctx.fillStyle = g; ctx.strokeStyle = 'rgba(120,84,28,0.9)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(x - w / 2, y - h / 2, w, h, 9); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#3d2a10'; ctx.font = `700 24px ${FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.direction = 'rtl';
    ctx.fillText(this.puzzle.places[i].name_fa, x, y + 1);
    ctx.restore();
  }

  drawReadout(ctx, i, digit) {
    const x = COL_X[i], y = readoutY(), v = digit * PLACE_VALUE[i];
    ctx.save();
    ctx.fillStyle = 'rgba(28,20,10,0.82)';
    ctx.beginPath(); ctx.roundRect(x - READOUT.w / 2, py(READOUT.v0), READOUT.w, READOUT.h, 5); ctx.fill();
    const f = this.fx.find((q) => q.kind === 'readout' && q.col === i);
    const k = f ? Math.min(1, f.t / 1.1) : 1;
    ctx.globalAlpha = 0.35 + 0.65 * k;
    ctx.fillStyle = digit === 0 ? 'rgba(210,190,150,0.9)' : `rgba(${GOLD.join(',')},1)`;
    ctx.font = `700 ${Math.round(26 * (0.8 + 0.2 * k))}px ${FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.direction = 'rtl';
    ctx.fillText(faDigits(v), x, y + 1);
    ctx.restore();
  }

  drawBench(ctx) {
    const b = BENCH;
    ctx.save();
    const g = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
    g.addColorStop(0, '#8d6234'); g.addColorStop(0.18, '#6f4a26'); g.addColorStop(1, '#4a3018');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.roundRect(b.x0, b.y, b.x1 - b.x0, b.h, 12); ctx.fill();
    ctx.strokeStyle = 'rgba(214,170,80,0.85)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(b.x0, b.y, b.x1 - b.x0, b.h, 12); ctx.stroke();
    ctx.fillStyle = 'rgba(255,225,170,0.18)';
    ctx.fillRect(b.x0 + 8, b.y + 3, b.x1 - b.x0 - 16, 5);
    ctx.fillStyle = 'rgba(40,26,12,0.55)';
    ctx.fillRect(b.x0 + 40, b.y + b.h, 22, 34); ctx.fillRect(b.x1 - 62, b.y + b.h, 22, 34);
    ctx.restore();
  }

  /**
   * A wooden digit tile: bottom-centre (x, y), `w` px wide, its numeral written by the engine (the art is blank).
   * The sprite is 256² with its tile at 10–245 × 11–245, so the draw box is centred on that content box.
   */
  drawTile(ctx, digit, x, y, w, { a = 1, glow = 0, ring = null, placed = false } = {}) {
    const name = placed ? 'digit_tile_placed' : ring === 'amber' ? 'digit_tile_hi' : 'digit_tile';
    const im = this.img(name) || this.img('digit_tile');
    const sc = w / TILE_SPRITE_W;
    ctx.save(); ctx.globalAlpha = a;
    if (glow > 0) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const R0 = w * 0.9;
      const g = ctx.createRadialGradient(x, y - w / 2, 4, x, y - w / 2, R0);
      g.addColorStop(0, `rgba(255,220,150,${0.45 * glow})`); g.addColorStop(1, 'rgba(255,200,120,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y - w / 2, R0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    if (im) ctx.drawImage(im, x - 128 * sc, y - 245 * sc, 256 * sc, 256 * sc);
    ctx.fillStyle = '#4a3418'; ctx.font = `700 ${Math.round(w * 0.52)}px ${FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(faDigits(digit), x, y - 118 * sc);
    ctx.restore();
  }

  drawTiles(ctx) {
    for (const t of this.ctrl.tiles) {
      const col = this.ctrl.slotOf(t.uid), p = this.tileHome(t.uid);
      const ring = this.wrongCols.includes(col) ? 'amber' : null;
      this.drawTile(ctx, t.digit, p.x, p.y, p.w, { placed: col >= 0, ring });
    }
  }

  // ------------------------------------------------------------- weighing machine
  drawMachine(ctx) {
    const stand = this.img('beam_stand'), bar = this.img('beam_bar'), pan = this.img('beam_pan');
    if (stand) ctx.drawImage(stand, standX(), standY(), STAND.w, STAND.h);
    this.drawLever(ctx);
    const hk = this.hooks();
    // the pans' contents first (behind the pan sprite), then the beam, then the pans hang from the hooks
    const built = this.build ? (this.ctrl.value || 0) : digitsOf(this.ctrl.round.number).reduce((a, d, i) => a + d * PLACE_VALUE[i], 0);
    const stock = this.build ? this.stage.target : 0;
    if (pan) {
      for (let i = 0; i < 2; i++) {
        const p = this.panPos(i);
        if (this.build) this.drawPanLoad(ctx, p, i === 0 ? stock : built);
        ctx.drawImage(pan, p.x, p.y, PAN.w, PAN.h);
      }
    }
    if (bar) {
      ctx.save(); ctx.translate(PIVOT.x, PIVOT.y); ctx.rotate(this.beam.value); ctx.translate(-PIVOT.x, -PIVOT.y);
      ctx.drawImage(bar, PIVOT.x - 319.5 * MS, PIVOT.y - 92.5 * MS, 648 * MS, 196 * MS);
      ctx.restore();
    }
    // the pointer on the hub: straight = balanced
    ctx.save();
    ctx.strokeStyle = `rgba(${Math.abs(this.beam.value) < 0.02 ? GOLD.join(',') : AMBER.join(',')},0.95)`;
    ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(PIVOT.x, PIVOT.y - 40 * MS);
    ctx.lineTo(PIVOT.x + Math.sin(this.beam.value) * 58, PIVOT.y - 40 * MS - Math.cos(this.beam.value) * 58);
    ctx.stroke(); ctx.restore();
    if (this.build) {
      ctx.save();
      ctx.fillStyle = 'rgba(250,240,215,0.9)'; ctx.font = `700 26px ${FONT}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.direction = 'rtl';
      ctx.fillText(faDigits(stock), this.panPos(0).x + PAN.w / 2, this.panPos(0).y + PAN.h + 26);
      ctx.restore();
    }
    void hk;
  }

  drawLever(ctx) {
    const x = LEVER.x, y = LEVER.y, k = this.lever.value;
    ctx.save();
    ctx.strokeStyle = 'rgba(196,150,62,0.95)'; ctx.lineWidth = 11; ctx.lineCap = 'round';
    const ang = lerp(-1.15, 0.35, k);
    ctx.beginPath(); ctx.moveTo(x, y + 40);
    ctx.lineTo(x + Math.sin(ang) * 86, y + 40 - Math.cos(ang) * 86);
    ctx.stroke();
    ctx.fillStyle = '#8a5f24';
    ctx.beginPath(); ctx.arc(x + Math.sin(ang) * 86, y + 40 - Math.cos(ang) * 86, 17, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(214,170,80,0.9)';
    ctx.beginPath(); ctx.arc(x, y + 40, 13, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  drawPanLoad(ctx, p, value) {
    const cx = p.x + PAN.w / 2, floorY = p.y + PAN.floor;
    for (const c of this.panLoad(value)) {
      const im = this.img(CRATE[c.unit].name);
      if (!im) continue;
      const y = floorY + c.dy;
      ctx.drawImage(im, cx + c.x - c.w / 2, y - c.h, c.w, c.h);
    }
  }

  // ------------------------------------------------------------- transfer: the shipment label
  drawLabel(ctx) {
    const r = this.ctrl.round, num = faDigits(r.number), lit = COLS - 1 - r.index;   // digits are drawn left → right
    ctx.save();
    ctx.translate(LABEL.x, LABEL.y);
    ctx.rotate(-0.03);
    ctx.fillStyle = 'rgba(246,236,210,0.97)'; ctx.strokeStyle = 'rgba(150,110,50,0.85)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.roundRect(-LABEL.w / 2, -LABEL.h / 2, LABEL.w, LABEL.h, 14); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(60,40,16,0.9)'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.direction = 'rtl'; ctx.fillText('بارِ کارگاه', 0, -LABEL.h / 2 + 28);
    ctx.font = `800 84px ${FONT}`;
    const step = 78, x0 = -((num.length - 1) * step) / 2;
    for (let i = 0; i < num.length; i++) {
      const x = x0 + i * step;
      if (i === lit) {
        ctx.save(); ctx.fillStyle = `rgba(${AMBER.join(',')},${0.35 + 0.2 * Math.sin(this.t * 4)})`;
        ctx.beginPath(); ctx.roundRect(x - 34, -44, 68, 88, 12); ctx.fill(); ctx.restore();
      }
      ctx.fillStyle = i === lit ? '#7a3c00' : '#4a3418';
      ctx.fillText(num[i], x, 6);
    }
    ctx.restore();
    for (let i = 0; i < this.ctrl.options.length; i++) {
      const p = this.optionPos(i), v = this.ctrl.options[i];
      const bounced = this.fx.find((f) => f.kind === 'bounce' && f.value === v);
      const k = bounced ? Math.min(1, bounced.t / 0.8) : 0;
      const dx = bounced ? Math.sin(bounced.t * 40) * 8 * (1 - k) : 0;
      this.drawPlate(ctx, faDigits(v), p.x + dx, p.y, OPTION.w, OPTION.h, bounced ? 'amber' : null);
    }
  }

  /** A brass-rimmed wooden plate with a number (the transfer's answer options). */
  drawPlate(ctx, txt, x, y, w, h, ring = null) {
    ctx.save();
    const g = ctx.createLinearGradient(0, y - h / 2, 0, y + h / 2);
    g.addColorStop(0, '#8d6234'); g.addColorStop(1, '#6a4523');
    ctx.fillStyle = g; ctx.strokeStyle = ring ? `rgba(${AMBER.join(',')},0.95)` : 'rgba(214,170,80,0.9)';
    ctx.lineWidth = ring ? 5 : 3;
    ctx.beginPath(); ctx.roundRect(x - w / 2, y - h / 2, w, h, 12); ctx.fill(); ctx.stroke();
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      ctx.beginPath(); ctx.arc(x + sx * (w / 2 - 12), y + sy * (h / 2 - 11), 4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#f6e6c2'; ctx.font = `700 40px ${FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.direction = 'rtl';
    ctx.fillText(txt, x, y + 1);
    ctx.restore();
  }

  drawMover(ctx, m) {
    const k = Math.min(1, m.t / m.dur);
    if (m.kind === 'tile') {
      const x = lerp(m.from.x, m.to.x, ease.inOutSine(k));
      const y = arcY(m.from.y, m.to.y, k, m.h || 40);
      this.drawTile(ctx, this.ctrl.tile(m.uid).digit, x, y, lerp(m.w, m.to.w, k), { glow: 0.35 });
    }
  }

  drawFx(ctx, f) {
    const k = f.t;
    if (f.kind === 'snap') {
      const x = COL_X[f.col], y = socketY();
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2, r = 12 + 60 * k;
        ctx.fillStyle = `rgba(255,225,160,${0.7 * (1 - k)})`;
        ctx.beginPath(); ctx.arc(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.6, 4 * (1 - k) + 1.5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    } else if (f.kind === 'spark') {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 + k, r = 30 + 70 * Math.min(1, k / 0.9);
        ctx.fillStyle = `rgba(255,230,160,${0.85 * (1 - Math.min(1, k / 0.9))})`;
        ctx.beginPath(); ctx.arc(f.x + Math.cos(a) * r, f.y + Math.sin(a) * r, 5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    } else if (f.kind === 'lock' || f.kind === 'example') {
      const x = COL_X[f.col], y = socketY();
      ctx.save(); ctx.strokeStyle = `rgba(${GOLD.join(',')},${0.9 * (1 - Math.min(1, k / 0.8))})`; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.roundRect(x - SOCKET.w / 2 - 6, py(SOCKET.v0) - 6, SOCKET.w + 12, SOCKET.h + 12, 10); ctx.stroke();
      ctx.restore();
    } else if (f.kind === 'toTray') {
      const t = this.ctrl.tile(f.uid), to = this.tileHome(f.uid);
      const kk = Math.min(1, k / 0.6);
      ctx.save(); ctx.globalAlpha = 1 - kk;
      this.drawTile(ctx, t.digit, to.x, to.y, TILE.w * (1 - 0.3 * kk));
      ctx.restore();
    }
  }

  drawDragged(ctx) {
    const d = this.drag;
    if (!d || !d.moved) return;
    if (d.kind === 'tile') {
      const t = this.ctrl.tile(d.uid);
      this.drawTile(ctx, t.digit, d.p.x.value, d.p.y.value + TILE.w / 2, TILE.w * 1.06, { glow: 0.4 });
      const col = this.colAt(d.p.x.value, d.p.y.value);
      if (col >= 0) {
        ctx.save(); ctx.strokeStyle = `rgba(${GOLD.join(',')},0.9)`; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.roundRect(COL_X[col] - SOCKET.w / 2, py(SOCKET.v0), SOCKET.w, SOCKET.h, 8); ctx.stroke(); ctx.restore();
      }
      return;
    }
    this.drawPlate(ctx, faDigits(d.value), d.p.x.value, d.p.y.value, OPTION.w, OPTION.h);
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
    drawHudButton(ctx, S, 'btn_undo', BTN.undo, BTN_R, { disabled: busy || this.ended || !this.build || !this.ctrl.undoStack.length, pressed: pr.undo, t: this.t });
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
      puzzle: this.stage.puzzle_id, kind: this.stage.kind, state: c.state,
      placed: this.build ? c.placed.map((d) => (d === null ? '_' : d)).join('') : '-',
      value: this.build ? c.value : '-', locked: c.locked ? c.locked.map((l) => (l ? 1 : 0)).join('') : '-',
      beam: Math.round(this.beam.value * 100) / 100, busy: this.busy,
      options: c.options ? c.options.join(' ') : '-', round: c.roundIdx ?? '-',
      hint_level: this.hints.level, hint_available: this.hints.available, wrong: this.hints.wrong, assisted: this.stageAssisted,
      flagged: [...this.misc.flagged].join(',') || '-', mastery: this.mastery.get(this.puzzle.concept_id),
      world: Object.keys(this.save.data.world).join(',') || '-', music_layers: this.audio.layers,
    };
  }
}

/** The panel sprite is 1024² with its content at 42–981 × 354–982: where its top-left goes on screen. */
export const pv_off = () => ({ x: PANEL.x - 42 * P_S, y: PANEL.y - 354 * P_S });
