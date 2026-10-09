// LUMA — Room VIL_SIGN_AREA / crossroads signs, card PERSIAN-01 + FARSI_01 (Q01 #6, plan 12 §1 row 3): «محله‌ی ما».
// The signs of the important places were moved and people cannot find their way. Encounter: four blank signs stand in
// a row at the front; each has a short ORIGINAL sentence. The child taps a sign → the Reading Card (the sign seen up
// close) shows the sentence; after 3 s the optional listen button appears (audio helps, never replaces reading). The
// child drags the sign to the place the WHOLE sentence describes (Read → Observe → Match → Place, Drag/Snap). Right:
// the sign knocks into the ground, the place reacts (school bell rings, fruit hops, pages flutter, the bucket splashes)
// and the sign flips to its picture side with the place name. Wrong: the sign wobbles and floats back; a text that
// shares one word with the chosen place is the card misconception (FA_SINGLE_WORD_MATCH); a wrong drop without reading
// is FA_PICTURE_ONLY_GUESS (FARSI_01 «wrong = choosing only from the picture»).
// Practice (mastery = NEW texts without Highlight): route markers «این راه به جایی می‌رسد که …» placed at the starts of
// the four ways. Success → VIL_SIGNS_FIXED; the square warms up and the markers glow.
// Camera: face-on to the square (plan 14 §4.1): school on the left, market stalls behind the well in the centre,
// library on the right; the child reaches every place from the front, the signs face the camera.
import { drawHudButton, drawExitArrow, PRESS_S } from '../engine/hud.js';
import { MisconceptionEngine, HintEngine, MasteryEngine, AnalyticsQueue, SaveSlot } from '../edu/engines.js';
import { Spring, Spring2, Timeline, reduceMotion } from '../engine/motion.js';
import { RigActor } from '../engine/rig.js';
import { SignPlaceController } from '../puzzles/sign_place.js';
import { highlightSegments, signOf } from '../edu/sign_rules.js';

/** TIKO waits here once the exit arrow (1832, 985) is shown, so the arrow never covers him. */
export const TIKO_ASIDE = 1640;
export const W = 1920, H = 1080;
const FONT = 'LumaFa, Vazirmatn, Tahoma, sans-serif';
// ---- world layout (1920×1080, measured on ENV_VIL_SIGN_AREA__PLATE; world = screen, the camera does not move)
export const SPOTS = [
  { school: { x: 405, y: 752 }, market: { x: 598, y: 690 }, library: { x: 1560, y: 740 }, well: { x: 1260, y: 850 } },   // signs: foot points
  { school: { x: 330, y: 880, dir: -1 }, market: { x: 560, y: 840, dir: 1 }, library: { x: 1390, y: 880, dir: 1 }, well: { x: 1030, y: 950, dir: -1 } }, // route markers
];
/** Plate areas no placed object may cover (the well's right roof post + crank: the child's interaction side, plan 14 §4.1).
 *  Found in the recorded playthrough review (round 11): the well sign at x 1180 hid the crank. */
export const KEEP_CLEAR = [{ id: 'well_post_crank', x0: 1040, y0: 560, x1: 1145, y1: 760 }];   // roof post + crank, above the rim top
/** Drawn extent of a placed object at a spot (sign sprite aspect 1.14 incl. legs; marker: plank top down to the foot). */
export const placedBox = (stage, spot) => {
  const p = SPOTS[stage][spot], s = depthAt(p.y);
  if (stage === 0) { const w = 260 * s; return { x0: p.x - w / 2, y0: p.y - w * 1.14, x1: p.x + w / 2, y1: p.y }; }
  const len = 214 * s, a = p.x - 0.459 * len * (p.dir < 0 ? -1 : 1);
  return { x0: Math.min(a, a + len * (p.dir < 0 ? -1 : 1)), y0: p.y - len * 1.07 * 0.884, x1: Math.max(a, a + len * (p.dir < 0 ? -1 : 1)), y1: p.y };
};
export const CUES = { school: { x: 453, y: 150, r: 78 }, market: { x: 698, y: 640, r: 66 }, library: { x: 1702, y: 540, r: 105 }, well: { x: 961, y: 655, r: 62 } };
export const TRAY = { y: 1070, xs: [930, 1150, 1370, 1590], s: [0.78, 0.72] };
export const CARD = { x: 960, y: 385, w: 1200, h: 380 };   // above the scene clues (bucket, baskets) so the H3 lens stays visible
export const LISTEN = { x: CARD.x - CARD.w / 2 + 96, y: CARD.y + CARD.h / 2 - 78, r: 50 };
export const CLOSE = { x: CARD.x - CARD.w / 2 + 44, y: CARD.y - CARD.h / 2 + 44, r: 36 };
export const BTN = { hint: { x: 90, y: 90 }, undo: { x: 220, y: 90 }, reset: { x: 350, y: 90 } };
const BTN_R = 58;
const EXIT = { x: 1832, y: 985, r: 95 };
const SIGN = { w: 260, h: 162, leg: 58 };                 // board + legs at scale 1 (engine-drawn PROP_VILLAGE_SIGN)
const MARK = { post: 172, len: 214, h: 66 };              // PROP_ROUTE_MARKER: post + arrow plank at scale 1
// Boxes inside the generated sprites' bboxes (x0, y0, x1, y1 as fractions), measured on the batch 07 finals
// (cream face of PROP_VILLAGE_SIGN x .08–.92 y .06–.48; medallion x .54–.89; route marker face y .16–.39, post x .459).
const FACE_BOX = [0.11, 0.085, 0.89, 0.46];               // the sentence on sign_blank
const NAME_BOX = [0.1, 0.1, 0.53, 0.44];                  // the place name left of the medallion on sign_<place>
const MARK_FACE = [0.1, 0.175, 0.78, 0.385];              // route_marker arrow face (pointing right), text / place face
const MARK_POST_FX = 0.459;                               // the post's x inside route_marker (the foot point)
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
export const depthAt = (y) => 0.62 + (y - 690) / (1070 - 690) * 0.38;

export class SignsP01 {
  constructor({ sprites, puzzle, audio, storage, debug, strings, onExit }) {
    Object.assign(this, { sprites, puzzle, audio, debug, strings, onExit });
    this.save = new SaveSlot(storage);
    this.mastery = new MasteryEngine(storage);
    this.analytics = new AnalyticsQueue(storage, puzzle.analytics_fields);
    this.tl = new Timeline();
    this.t = 0; this.attempt = 0; this.drag = null; this.fx = []; this.sparks = [];
    this.warm = new Spring(0, { stiffness: 4, damping: 5 });
    this.lumi = { p: new Spring2(420, 700, { stiffness: 30, damping: 9 }), mode: 'follow' };
    this.ended = false; this.bubble = null; this.card = null;
  }

  async load() {
    this.neo = await new RigActor({ id: 'NEO', scale: 0.19, x: 130, groundY: 1052, face: 1 }).load();
    this.tiko = await new RigActor({ id: 'TIKO', scale: 0.11, x: 1790, groundY: 1010, face: -1 }).load();
    this.actors = [this.tiko, this.neo];
    const enc = this.save.puzzle(this.puzzle.stages[0].puzzle_id), pra = this.save.puzzle(this.puzzle.stages[1].puzzle_id);
    this.signs = new SignPlaceController(this.puzzle.stages[0], this.puzzle.places);
    if (pra && pra.solved) { this.signs.finishAll(); this.startStage(1, { finished: true }); }
    else if (enc && enc.solved) { this.signs.finishAll(); this.startStage(1); }
    else this.startStage(0);
    if (this.save.flag(this.puzzle.world_state_on_solve)) this.warm.set(1);
    return this;
  }

  // ================================================================= flow
  startStage(idx, { finished = false } = {}) {
    this.stageIdx = idx; this.stage = this.puzzle.stages[idx];
    this.misc = new MisconceptionEngine(this.puzzle.misconceptions, this.puzzle.misconception_flag_threshold);
    this.hints = new HintEngine(this.stage.hints, this.stage.answer_assist);
    this.stageMaxHint = 0; this.stageAssisted = false; this.stageStart = this.t; this.attempt++;
    this.fx = []; this.anim = {}; this.flip = {}; this.bubble = null; this.card = null; this.hintShow = 0;
    this.highlight = new Set(); this.lens = null; this.readAccum = {}; this.readingStarted = false; this.audioUsed = {};
    this.focus = null; this.lumi.mode = 'follow';
    const hooks = {
      onPlace: (s, p) => this.onPlace(s, p), onWrong: (r, s, p, w) => this.onWrong(r, s, p, w), onReject: (r, s, p) => this.onReject(r, s, p),
      onUndo: (s, p) => { this.flip[s] = null; this.log('puzzle_interaction', { action: 'undo', sign_id: s, spot_id: p }); },
      onSolved: () => this.onSolved(),
    };
    const guessMs = this.puzzle.guess_read_ms;
    if (idx === 0) { this.signs = new SignPlaceController(this.stage, this.puzzle.places, { guessMs }, hooks); this.ctrl = this.signs; }
    else this.ctrl = new SignPlaceController(this.stage, this.puzzle.places, { guessMs }, hooks);
    if (finished) { this.ctrl.finishAll(); this.ended = true; this.tiko.x = TIKO_ASIDE; this.audio.setLayers(4); this.markFlipped(); return; }
    this.markFlipped();
    this.ended = false;
    this.audio.setLayers(idx === 0 ? 1 : 3);
    this.log('puzzle_start', {});
    this.recordMastery(false);
    this.save.setPuzzle(this.stage.puzzle_id, { solved: false, entered: new Date().toISOString() });
  }
  /** Signs already standing (reload / practice) show their picture side without animation. */
  markFlipped() {
    for (const c of [this.signs, this.ctrl]) for (const sid of Object.values(c.placed)) this.flip[sid] = -99;
  }

  recordMastery(solved) {
    // card: mastery = a NEW text connected WITHOUT Highlight → in practice H1 (whole sentence) does not count as help
    const hl = this.puzzle.mastery.highlight_level || 2;
    const maxHint = this.stage.stage === 'practice' && this.stageMaxHint < hl ? 0 : this.stageMaxHint;
    const lvl = this.mastery.record(this.puzzle.concept_id, { stage: this.stage.stage, solved, maxHint, assisted: this.stageAssisted }, this.puzzle.mastery);
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

  // ---------------------------------------------------------------- events
  onPlace(signId, spot) {
    this.hints.onActivity();
    const p = this.spotPt(spot);
    this.anim[signId] = { pop: 0.4 };
    this.audio.thump(); this.tl.after(0.12, () => this.audio.chime());       // wood knock + small confirm bell (card Sound)
    this.log('location_selected', { sign_id: signId, spot_id: spot, result: 'ok', read_ms: this.lastReadMs, audio_used: !!this.audioUsed[signId] });
    this.fx.push({ kind: 'dust', x: p.x, y: p.y, t: 0 });
    this.tl.after(0.18, () => { this.flip[signId] = this.t; });            // flip to the picture side (hides the art swap)
    this.tl.after(0.35, () => this.react(spot));
    if (this.focus === signId) this.focus = null;
    if (!this.ctrl.solved) this.neo.play('happy', 'idle');
  }
  /** The place answers (card Animation «the environment reacts a little»). */
  react(spot) {
    this.fx.push({ kind: 'react_' + spot, ...CUES[spot], t: 0 });
    if (spot === 'school') this.audio.bell();
    else if (spot === 'market') this.audio.rustle();
    else if (spot === 'library') this.audio.pageFlutter();
    else this.audio.splash();
  }
  onWrong(rule, signId, spot, trapWord) {
    const out = this.hints.onWrong();
    const def = this.observe(rule);
    const errorType = def ? def.error_type : 'ContextError';
    this.log('location_selected', { sign_id: signId, spot_id: spot, result: rule, read_ms: this.lastReadMs, audio_used: !!this.audioUsed[signId] });
    this.log('wrong_context', { sign_id: signId, spot_id: spot, error_type: errorType, misconception: def ? def.code : null, trap_word: trapWord, read_ms: this.lastReadMs });
    const p = this.spotPt(spot);
    this.fx.push({ kind: 'wrong', sign: signId, spot, x: p.x, y: p.y, t: 0 });
    this.audio.woodClick(); this.tl.after(0.2, () => this.audio.flicker());
    this.tiko.play(this.tiko.has('think') ? 'think' : 'happy', 'idle');
    this.focus = signId;
    if (out === 'assist') this.tl.after(1.1, () => {
      if (this.ctrl.solved) return;
      const left = this.ctrl.applyAssist(); this.stageAssisted = true;
      this.log('puzzle_interaction', { action: 'answer_assist', mode: this.stage.answer_assist.action, signs_left: left });
      this.audio.hint();
    });
  }
  onReject(rule, signId, spot) {
    const p = spot && this.spotPt(spot) ? this.spotPt(spot) : { x: this.dropX, y: this.dropY };
    this.fx.push({ kind: 'return', sign: signId, x: p.x, y: p.y, t: 0 });
    this.audio.snap();
    if (rule === 'assist_reject') this.log('puzzle_interaction', { action: 'assist_reject', sign_id: signId, spot_id: spot });
  }
  onSolved() {
    this.stageMaxHint = Math.max(this.stageMaxHint, this.hints.maxUsed);
    this.card = null; this.lens = null; this.hintShow = 0;
    this.log('puzzle_solved', { assisted: this.stageAssisted });
    this.recordMastery(true);
    this.save.setPuzzle(this.stage.puzzle_id, { solved: true, hint_max: this.stageMaxHint, assisted: this.stageAssisted });
    const order = ['school', 'market', 'well', 'library'];
    order.forEach((spot, k) => this.tl.after(0.9 + k * 0.28, () => {         // the signs light up one after another
      const sid = this.ctrl.placed[spot]; this.anim[sid] = { pop: 0.45, glow: 1.4 }; this.audio.gardenChime(k * 2);
    }));
    if (this.stageIdx === 0) {
      this.tl.after(2.3, () => { this.audio.motif(); this.neo.play('happy', 'idle'); this.tiko.play('happy', 'idle'); this.audio.setLayers(2); });
      this.tl.after(4.2, () => this.transition(() => this.startStage(1)));
    } else {
      this.tl.after(2.2, () => {                                             // payoff: VIL_SIGNS_FIXED, the square wakes up
        this.audio.bell(); this.audio.motif(); this.audio.setLayers(4);
        this.save.setFlag(this.puzzle.world_state_on_solve);
        this.warm.target = 1; this.spawnSparks();
        for (const s of Object.values(this.signs.placed)) this.tl.after(0.3 + Math.random() * 0.6, () => { this.anim[s] = { pop: 0.4, glow: 1.6 }; });
        this.neo.play('happy', 'idle'); this.tiko.play('happy', 'idle'); this.lumi.mode = 'celebrate';
        this.tl.after(1.6, () => this.tiko.walkTo(TIKO_ASIDE, () => this.tiko.play('happy', 'idle')));   // steps off the exit arrow
        this.tl.after(3.4, () => { this.lumi.mode = 'follow'; this.ended = true; });
      });
    }
    this.stageAssisted = false;
  }

  transition(fn) {
    this.fade = { a: 1 };
    this.tl.tween(0.5, (k) => { this.fade.a = 1 - k; }, () => { fn(); this.tl.tween(0.6, (k) => { this.fade.a = k; }, () => { this.fade = null; }); });
  }
  replay() {
    this.log('replay_started', {});
    for (const s of this.puzzle.stages) this.save.setPuzzle(s.puzzle_id, null);
    this.transition(() => { this.flip = {}; this.startStage(0); });
  }
  leave() {
    this.leaving = { a: 0 }; this.audio.pickup();
    this.log('room_exit', { to: 'VIL_SIGN_AREA/INTRO_BOARD' });   // W-01 follows in the same square (plan 04)
    this.tl.tween(0.8, (k) => { this.leaving.a = k; }, () => this.onExit());
  }

  // ================================================================= reading card
  openCard(signId, source = 'tap') {
    if (this.card && this.card.sign === signId) return;
    this.closeCard();
    this.card = { sign: signId, t: 0, listened: false };
    this.focus = signId;
    this.audio.woodClick();
    if (!this.readingStarted) { this.readingStarted = true; this.log('reading_started', { sign_id: signId }); }
    this.log('sign_inspected', { sign_id: signId, source });
  }
  closeCard() {
    if (!this.card) return;
    this.readAccum[this.card.sign] = (this.readAccum[this.card.sign] || 0) + this.card.t;
    this.audio.stopVoice && this.audio.stopVoice();
    if (this.lumi.mode === 'read') this.lumi.mode = 'follow';
    this.card = null;
  }
  listenReady() { return this.card && this.card.t >= this.puzzle.reading.audio_unlock_s; }
  voUrl(key) { return `unity/Assets/_Project/${this.puzzle.reading.audio_dir}/${key}.mp3`; }
  listen() {
    const g = signOf(this.stage, this.card.sign);
    this.card.listened = true; this.card.playT = this.t; this.audioUsed[g.sign_id] = true;
    const card = this.card; card.playDur = 5;                                 // until the clip is decoded
    const pr = this.audio.voice && this.audio.voice(this.voUrl(g.audio_key));
    if (pr && pr.then) pr.then((d) => { if (d > 0) card.playDur = d + 0.2; }).catch(() => {});
    this.log('audio_read', { sign_id: g.sign_id, audio_used: true, read_ms: Math.round(this.card.t * 1000) });
  }

  // ================================================================= geometry
  spotPt(spot) { return SPOTS[this.stageIdx][spot] || null; }
  traySlot(i) { return { x: TRAY.xs[i], y: TRAY.y, s: TRAY.s[this.stageIdx] }; }
  slotOf(signId) { return this.stage.signs.findIndex((g) => g.sign_id === signId); }
  /** Height of the object above its foot point at scale s (the grab zone). */
  objH(s) { return (this.stageIdx === 0 ? SIGN.h + SIGN.leg : MARK.post + MARK.h * 0.5) * s; }
  /** The nearest place spot to a foot point (within reach), else null. */
  spotAt(x, y) {
    let best = null, bd = 1e9;
    for (const [id, p] of Object.entries(SPOTS[this.stageIdx])) {
      const d = Math.hypot(x - p.x, (y - p.y) * 1.3);
      if (d < bd) { bd = d; best = id; }
    }
    return bd < 135 ? best : null;
  }
  trayHit(x, y) {
    for (const id of this.ctrl.pending()) {
      const i = this.slotOf(id), p = this.traySlot(i), hw = (this.stageIdx === 0 ? SIGN.w : MARK.len) * p.s / 2;
      if (Math.abs(x - p.x) < Math.min(hw, 105) && y < p.y + 8 && y > p.y - this.objH(p.s) - 10) return id;
    }
    return null;
  }
  placedHit(x, y) {
    for (const [spot, id] of Object.entries(this.ctrl.placed)) {
      const p = this.spotPt(spot), s = depthAt(p.y);
      if (Math.abs(x - p.x) < 90 * s + 20 && y < p.y && y > p.y - this.objH(s)) return { id, spot };
    }
    return null;
  }

  // ================================================================= input
  pointerDown(sx, sy) {
    this.audio.unlock();
    if (this.hints) this.hints.onActivity();
    for (const [name, b] of Object.entries(BTN)) if (Math.hypot(sx - b.x, sy - b.y) <= BTN_R) return this.button(name);
    if (this.fade || this.leaving) return;
    if (this.ended && this.onExit && Math.hypot(sx - EXIT.x, sy - EXIT.y) < EXIT.r) return this.leave();
    const x = sx, y = sy;
    this.down = { x, y, t: this.t };
    if (this.card) {
      if (Math.hypot(x - CLOSE.x, y - CLOSE.y) <= CLOSE.r) return this.closeCard();
      if (Math.hypot(x - LISTEN.x, y - LISTEN.y) <= LISTEN.r) { if (this.listenReady()) this.listen(); return; }
      if (Math.abs(x - CARD.x) < CARD.w / 2 && Math.abs(y - CARD.y) < CARD.h / 2) return;       // reading
    }
    if (!this.ended && !this.ctrl.solved) {
      const id = this.trayHit(x, y);
      if (id) {
        const i = this.slotOf(id), p = this.traySlot(i), grab = this.objH(p.s) * 0.55;
        this.drag = { sign: id, p: new Spring2(p.x, p.y - grab, { stiffness: 260, damping: 22 }), grab, moved: false, pickT: this.t };
        this.audio.pickup(); this.focus = id;
        return;
      }
    }
    if (this.card) return this.closeCard();
    const ph = this.placedHit(x, y);
    if (ph) { this.anim[ph.id] = { pop: 0.35 }; this.react(ph.spot); return; }
    for (const a of this.actors) if (a.hit(x, y + (a.lift || 0))) { a.play('happy', 'idle'); return; }
  }
  pointerMove(sx, sy) {
    if (!this.drag) return;
    if (this.down && Math.hypot(sx - this.down.x, sy - this.down.y) > 12 && !this.drag.moved) {
      this.drag.moved = true;
      if (this.card) this.closeCard();
      this.log('puzzle_interaction', { action: 'sign_lifted', sign_id: this.drag.sign });
    }
    if (this.drag.moved) this.drag.p.to(sx, sy);
  }
  pointerUp(sx, sy) {
    const d = this.drag; this.drag = null;
    if (!d) return;
    if (!d.moved) return this.openCard(d.sign);                              // tap = read
    const { x: fx, y: fy } = this.footOf(d);
    this.dropX = fx; this.dropY = fy;
    this.lastReadMs = Math.round(((this.t - d.pickT) + (this.readAccum[d.sign] || 0)) * 1000);
    this.ctrl.drop(d.sign, this.spotAt(fx, fy), this.lastReadMs);
  }
  /** Foot point of the carried object (the finger holds it at `grab` above the foot). */
  footOf(d, target = true) { return { x: target ? d.p.x.target : d.p.x.value, y: (target ? d.p.y.target : d.p.y.value) + d.grab }; }
  /** Scale of the carried object: the row scale near the front, the place scale further back. */
  dragScale(d) { return Math.min(TRAY.s[this.stageIdx], depthAt(this.footOf(d, false).y)); }

  button(name) {
    this.pressT = { ...(this.pressT || {}), [name]: PRESS_S };
    const busy = this.fade || this.ctrl.solved;
    if (name === 'hint') {
      if (busy || this.ended) return;
      const h = this.hints.request();
      if (!h) return;
      this.audio.hint();
      this.log(`hint_${h.level}_used`, { hint_level: h.level });
      this.log('hint_used', { hint_level: h.level, sign_id: this.hintSign() });
      this.showHint(h);
    } else if (name === 'undo') {
      if (busy || this.ended) return;
      if (this.ctrl.undo()) this.audio.snap();
    } else if (name === 'reset') {
      if (this.ended) return this.replay();
      if (busy) return;
      if (this.ctrl.reset()) { this.flip = {}; this.markFlipped(); this.audio.snap(); this.log('puzzle_interaction', { action: 'reset' }); }
    }
  }
  hintSign() {
    const pend = this.ctrl.pending();
    if (this.card && pend.includes(this.card.sign)) return this.card.sign;
    return this.focus && pend.includes(this.focus) ? this.focus : pend[0];
  }
  showHint(h) {
    this.stageMaxHint = Math.max(this.stageMaxHint, h.level);
    const sid = this.hintSign();
    this.openCard(sid, 'hint');
    this.hintShow = h.level;
    if (h.text_key && this.strings) { this.bubble = { text: this.strings.t(h.text_key), t: 0 }; this.tl.after(5.5, () => { this.bubble = null; }); }
    if (h.audio_key && this.audio.voice) this.audio.voice(this.voUrl(h.audio_key));
    if (h.level === 1) {                             // H1: LUMI glides under the whole sentence, word by word
      this.lumi.mode = 'read'; this.lumi.readT = 0;
      this.tl.after(4.8, () => { if (this.lumi.mode === 'read') this.lumi.mode = 'follow'; if (this.hintShow === 1) this.hintShow = 0; });
    } else {
      this.highlight.add(sid);                       // H2: the key words stay highlighted for this sign
      if (h.level === 3) {                           // H3: text clue + scene clue side by side (lens + dotted line)
        const ans = signOf(this.stage, sid).answer;
        this.lens = { spot: ans, t: 0 };
        this.lumi.mode = 'hint'; this.lumi.target = { x: CUES[ans].x, y: CUES[ans].y - CUES[ans].r - 40 };
        this.tl.after(6, () => { this.lens = null; if (this.lumi.mode === 'hint') this.lumi.mode = 'follow'; });
      }
    }
  }

  spawnSparks(n = 120) {
    if (reduceMotion) n = Math.round(n / 4);
    for (let i = 0; i < n; i++) this.sparks.push({ x: 100 + Math.random() * 1720, y: 200 + Math.random() * 700, vy: -20 - Math.random() * 40,
      ph: Math.random() * 6.28, life: 2 + Math.random() * 3, t: 0, r: 2 + Math.random() * 3 });
  }

  // ================================================================= update
  update(dt) {
    if (this.pressT) for (const k in this.pressT) this.pressT[k] = Math.max(0, this.pressT[k] - dt);
    this.t += dt;
    this.tl.update(dt);
    if (this.hints && !this.ended && !this.card) this.hints.tick(dt);
    this.warm.update(dt);
    if (this.drag) this.drag.p.update(dt);
    if (this.card) this.card.t += dt;
    if (this.bubble) this.bubble.t += dt;
    if (this.lens) this.lens.t += dt;
    for (const k in this.anim) { const a = this.anim[k]; if (a.pop > 0) a.pop -= dt; if (a.glow > 0) a.glow -= dt; }
    for (const f of this.fx) f.t += dt;
    this.fx = this.fx.filter((f) => f.t < (f.kind === 'wrong' ? 1.0 : f.kind === 'return' ? 0.4 : f.kind.startsWith('react') ? 1.8 : 0.9));
    for (const s of this.sparks) { s.t += dt; s.y += s.vy * dt; s.ph += dt * 3; }
    this.sparks = this.sparks.filter((s) => s.t < s.life);
    if (this.warm.value > 0.6 && !reduceMotion && Math.random() < dt * 6) this.spawnSparks(1);
    for (const a of this.actors) a.update(dt);
    if (this.tiko.clip === 'idle') this.tiko.faceTowards(960);
    if (this.neo.clip === 'idle') this.neo.faceTowards(this.drag ? this.drag.p.x.value : 960);
    const lm = this.lumi;
    if (lm.mode === 'follow') { const h = this.neo.headPoint(); lm.p.to(h.x + 70, h.y - 60 + Math.sin(this.t * 2.1) * 12); }
    else if (lm.mode === 'read') {                   // right → left along the words, 3.6 s, then rests at the end
      lm.readT += dt; const ws = this.cardWords || [];
      if (ws.length) {
        const k = Math.min(1, lm.readT / 3.6), i = Math.min(ws.length - 1, Math.floor(k * ws.length)), w = ws[i];
        lm.wordI = i; lm.p.to(w.x - w.w / 2, w.y + 44);
      }
    } else if (lm.mode === 'hint') lm.p.to(lm.target.x + Math.cos(this.t * 3) * 36, lm.target.y + Math.sin(this.t * 3) * 16);
    else if (lm.mode === 'celebrate') lm.p.to(960 + Math.cos(this.t * 1.6) * 420, 330 + Math.sin(this.t * 3.2) * 60);
    if (reduceMotion && lm.mode !== 'celebrate') lm.p.set(lm.p.x.target, lm.p.y.target);
    lm.p.update(dt);
  }

  // ================================================================= draw
  img(name) { return this.sprites.get(name); }
  draw(ctx) {
    this._ctx = ctx;
    const a = this.img('sign_plate');
    if (a) ctx.drawImage(a, 0, 0, W, H); else { ctx.fillStyle = '#6b5a44'; ctx.fillRect(0, 0, W, H); }
    this.drawRestored(ctx);
    const fadeA = this.fade ? this.fade.a : 1;
    // standing signs (always visible after the encounter), then the route markers of the practice
    this.drawSpots(ctx, 0);
    this.drawPlaced(ctx, this.signs, 0, fadeA);
    if (this.stageIdx === 1) { this.drawSpots(ctx, 1); this.drawPlaced(ctx, this.ctrl, 1, fadeA); }
    this.tiko.draw(ctx);
    this.drawTray(ctx, fadeA);
    this.neo.draw(ctx);
    for (const f of this.fx) this.drawFx(ctx, f);
    this.drawDragged(ctx);
    this.drawSparks(ctx);
    if (this.card) this.drawCard(ctx);
    if (this.lens) this.drawLens(ctx);
    this.drawLumi(ctx);
    this.drawHud(ctx);
  }

  /** Payoff without a restored plate: warm golden grade + slow light rays from the upper left (ENV_VIL_SIGN_AREA STATE pending). */
  drawRestored(ctx) {
    const mix = clamp01(this.warm.value);
    if (mix < 0.002) return;
    const b = this.img('sign_plate_on');
    if (b) { ctx.globalAlpha = mix; ctx.drawImage(b, 0, 0, W, H); ctx.globalAlpha = 1; return; }
    ctx.save(); ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = `rgba(255,190,90,${0.45 * mix})`; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(960, 520, 60, 960, 520, 1100);
    g.addColorStop(0, `rgba(255,214,140,${0.22 * mix})`); g.addColorStop(1, 'rgba(255,214,140,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 6; i++) {                    // light rays
      const an = 0.55 + i * 0.13 + Math.sin(this.t * 0.3 + i) * 0.02, len = 1700;
      ctx.fillStyle = `rgba(255,232,170,${(0.05 + 0.02 * Math.sin(this.t * 0.8 + i * 1.7)) * mix})`;
      ctx.beginPath(); ctx.moveTo(-100, -120);
      ctx.lineTo(-100 + Math.cos(an - 0.025) * len, -120 + Math.sin(an - 0.025) * len);
      ctx.lineTo(-100 + Math.cos(an + 0.025) * len, -120 + Math.sin(an + 0.025) * len); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  /** Empty places: a peg hole in the ground; while a sign is carried, the places that accept it glow. */
  drawSpots(ctx, stage) {
    if (stage !== this.stageIdx || this.ended) return;
    const carrying = this.drag && this.drag.moved ? this.drag.sign : null;
    const active = carrying ? this.ctrl.activeSpots(carrying) : this.ctrl.assist && this.focus ? this.ctrl.activeSpots(this.focus) : null;
    const near = carrying ? (() => { const f = this.footOf(this.drag); return this.spotAt(f.x, f.y); })() : null;
    for (const [id, p] of Object.entries(SPOTS[stage])) {
      if (this.ctrl.placed[id]) continue;
      const s = depthAt(p.y), on = active ? active.includes(id) : false, dim = this.ctrl.assist && active && !on;
      ctx.save(); ctx.globalAlpha = dim ? 0.35 : 1;
      if (on) {
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(p.x, p.y, 4, p.x, p.y, 90 * s);
        g.addColorStop(0, `rgba(255,220,140,${near === id ? 0.75 : 0.35 + 0.12 * Math.sin(this.t * 4)})`); g.addColorStop(1, 'rgba(255,220,140,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(p.x, p.y, 90 * s, 34 * s, 0, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.fillStyle = 'rgba(40,26,12,0.55)'; ctx.beginPath(); ctx.ellipse(p.x, p.y, 16 * s, 6 * s, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,240,205,0.6)'; ctx.lineWidth = 2.5; ctx.setLineDash([7, 6]);
      ctx.beginPath(); ctx.ellipse(p.x, p.y, 58 * s, 20 * s, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
  }
  drawPlaced(ctx, c, stage, alpha) {
    const spots = SPOTS[stage], entries = Object.entries(c.placed).sort((a, b) => spots[a[0]].y - spots[b[0]].y);
    ctx.save(); ctx.globalAlpha = stage === this.stageIdx ? alpha : 1;
    for (const [spot, sid] of entries) {
      const p = spots[spot], a = this.anim[sid] || {};
      const f0 = this.flip[sid], k = f0 === undefined || f0 === null ? 0 : clamp01((this.t - f0) / 0.5);
      const face = k >= 0.5 ? 'place' : 'text', sx = reduceMotion ? 1 : Math.max(0.04, Math.abs(Math.cos(k * Math.PI)));
      this.drawObj(ctx, stage, sid, spot, p.x, p.y, depthAt(p.y), { face, sx, pop: a.pop || 0, glow: a.glow || 0, dir: p.dir });
    }
    ctx.restore();
  }
  drawTray(ctx, alpha) {
    if (this.ended) return;
    ctx.save(); ctx.globalAlpha = alpha;
    for (const id of this.ctrl.pending()) {
      if (this.drag && this.drag.sign === id) continue;
      if (this.fx.some((f) => (f.kind === 'wrong' || f.kind === 'return') && f.sign === id)) continue;
      const i = this.slotOf(id), p = this.traySlot(i), foc = (this.card && this.card.sign === id) || (this.hintShow && this.focus === id);
      this.drawObj(ctx, this.stageIdx, id, null, p.x, p.y, p.s, { face: 'text', glow: foc ? 0.5 + 0.3 * Math.sin(this.t * 4) : 0, dir: 1 });
    }
    ctx.restore();
  }
  drawDragged(ctx) {
    const d = this.drag;
    if (!d || !d.moved) return;
    const s = this.dragScale(d), f = this.footOf(d, false), ft = this.footOf(d), near = this.spotAt(ft.x, ft.y);
    const dir = near ? SPOTS[this.stageIdx][near].dir : 1;
    this.drawObj(ctx, this.stageIdx, d.sign, null, f.x, f.y, s, { face: 'text', lifted: true, dir: dir || 1 });
  }

  /** Sign (stage 0) or route marker (stage 1) with its foot at (x, y). */
  drawObj(ctx, stage, sid, spot, x, y, s, o = {}) {
    const k = 1 + Math.max(0, Math.sin(Math.max(0, o.pop || 0) / 0.4 * Math.PI)) * 0.12;
    s *= k;
    ctx.save();
    ctx.fillStyle = 'rgba(30,18,8,0.3)'; ctx.beginPath(); ctx.ellipse(x, y + 2, 70 * s, 12 * s, 0, 0, Math.PI * 2); ctx.fill();
    if (o.lifted) ctx.translate(0, -10);
    if (o.rot) { ctx.translate(x, y); ctx.rotate(o.rot); ctx.translate(-x, -y); }
    if (o.glow > 0) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const cy = y - this.objH(s) * 0.62, R = 150 * s;
      const g = ctx.createRadialGradient(x, cy, 4, x, cy, R);
      g.addColorStop(0, `rgba(255,226,150,${0.5 * Math.min(1, o.glow)})`); g.addColorStop(1, 'rgba(255,226,150,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, cy, R, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    if (stage === 0) this.drawSign(ctx, sid, spot, x, y, s, o); else this.drawMarker(ctx, sid, spot, x, y, s, o);
    ctx.restore();
  }
  drawSign(ctx, sid, spot, x, y, s, o) {
    const g = signOf(this.puzzle.stages[0], sid), face = o.face, sx = o.sx === undefined ? 1 : o.sx;
    const place = face === 'place' ? (spot || g.answer) : null;
    const sprite = place ? 'sign_' + place : (o.lifted && this.sprites.has('sign_blank_hl') ? 'sign_blank_hl' : 'sign_blank');   // carried → highlighted state (batch 10)
    const bw = SIGN.w * s, bh = SIGN.h * s, by = y - SIGN.leg * s - bh;
    ctx.save(); ctx.translate(x, 0); ctx.scale(sx, 1); ctx.translate(-x, 0);
    if (this.sprites.has(sprite)) {                  // generated art (batch 07) when present
      const box = this.drawSprite(ctx, sprite, x, y, bw);
      if (box && !place) this.drawTextOn(ctx, g.text_fa, ...this.subBox(box, FACE_BOX), s);
      if (box && place) this.drawPlaceName(ctx, place, ...this.subBox(box, NAME_BOX), s);
    } else {
      // two thin iron legs
      ctx.fillStyle = '#4b4a4e'; ctx.strokeStyle = '#2d2b2e'; ctx.lineWidth = 1.5;
      for (const dx of [-0.3, 0.3]) { ctx.beginPath(); ctx.roundRect(x + dx * bw - 5 * s, by + bh - 6 * s, 10 * s, SIGN.leg * s + 6 * s, 3 * s); ctx.fill(); ctx.stroke(); }
      this.drawBoard(ctx, x - bw / 2, by, bw, bh, s);
      const fx = x - bw / 2 + 14 * s, fy = by + 14 * s, fw = bw - 28 * s, fh = bh - 28 * s;
      if (place) this.drawPlaceFace(ctx, place, fx, fy, fw, fh, s);
      else this.drawTextOn(ctx, g.text_fa, fx, fy, fw, fh, s);
    }
    ctx.restore();
  }
  /** Honey plank board with brass corner caps and a cream face (the LUMA workshop palette). */
  drawBoard(ctx, x, y, w, h, s, arrowDir = 0) {
    const tip = arrowDir ? h * 0.5 : 0;
    const path = () => {
      ctx.beginPath();
      if (!arrowDir) { ctx.roundRect(x, y, w, h, 10 * s); return; }
      if (arrowDir > 0) { ctx.moveTo(x, y); ctx.lineTo(x + w - tip, y); ctx.lineTo(x + w, y + h / 2); ctx.lineTo(x + w - tip, y + h); ctx.lineTo(x, y + h); }
      else { ctx.moveTo(x + w, y); ctx.lineTo(x + tip, y); ctx.lineTo(x, y + h / 2); ctx.lineTo(x + tip, y + h); ctx.lineTo(x + w, y + h); }
      ctx.closePath();
    };
    const wood = ctx.createLinearGradient(0, y, 0, y + h); wood.addColorStop(0, '#d9a45a'); wood.addColorStop(1, '#a8702f');
    ctx.fillStyle = wood; ctx.strokeStyle = '#5e3a18'; ctx.lineWidth = 3 * s + 1; path(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(110,69,32,0.45)'; ctx.lineWidth = 1.5;
    for (const f of [0.34, 0.67]) { ctx.beginPath(); ctx.moveTo(x + (arrowDir < 0 ? tip : 4 * s), y + h * f); ctx.lineTo(x + w - (arrowDir > 0 ? tip : 4 * s), y + h * f); ctx.stroke(); }
    ctx.fillStyle = '#f3e6c6'; ctx.strokeStyle = 'rgba(120,80,30,0.5)'; ctx.lineWidth = 1.5;
    const fx0 = x + (arrowDir < 0 ? tip : 0) + 12 * s, fx1 = x + w - (arrowDir > 0 ? tip : 0) - 12 * s;
    ctx.beginPath(); ctx.roundRect(fx0, y + 10 * s, fx1 - fx0, h - 20 * s, 6 * s); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#c9a044'; ctx.strokeStyle = '#7a5a1c'; ctx.lineWidth = 1;
    const caps = arrowDir ? [[arrowDir > 0 ? x : x + w, y], [arrowDir > 0 ? x : x + w, y + h]] : [[x, y], [x + w, y], [x, y + h], [x + w, y + h]];
    for (const [cx, cy] of caps) { ctx.beginPath(); ctx.arc(cx + (cx > x + w / 2 ? -7 : 7) * s, cy + (cy > y + h / 2 ? -7 : 7) * s, 6 * s, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
  }
  drawMarker(ctx, sid, spot, x, y, s, o) {
    const g = signOf(this.puzzle.stages[1], sid), dir = o.dir || 1, face = o.face, sx = o.sx === undefined ? 1 : o.sx;
    const place = face === 'place' ? (spot || g.answer) : null;
    const post = MARK.post * s, len = MARK.len * s, h = MARK.h * s, top = y - post;
    if (this.sprites.has('route_marker')) {         // generated art (batch 07); the arrow is mirrored for a left turn
      ctx.save(); ctx.translate(x, 0); ctx.scale(sx, 1); ctx.translate(-x, 0);
      const cx = x + (0.5 - MARK_POST_FX) * len * dir;                         // anchor on the post, not the bbox centre
      const box = this.drawSprite(ctx, 'route_marker', cx, y, len, dir < 0);
      if (box) {
        const f = dir < 0 ? [1 - MARK_FACE[2], MARK_FACE[1], 1 - MARK_FACE[0], MARK_FACE[3]] : MARK_FACE;
        const [fx, fy, fw, fh] = this.subBox(box, f);
        if (place) this.drawPlaceFace(ctx, place, fx, fy, fw, fh, s, true);
        else this.drawTextOn(ctx, g.text_fa, fx, fy, fw, fh, s * 0.85);
      }
      ctx.restore();
      return;
    }
    ctx.fillStyle = '#8a5a2b'; ctx.strokeStyle = '#5a3818'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(x - 9 * s, top, 18 * s, post, 4 * s); ctx.fill(); ctx.stroke();
    const bx = dir > 0 ? x - 22 * s : x - len + 22 * s;
    ctx.save(); ctx.translate(x, 0); ctx.scale(sx, 1); ctx.translate(-x, 0);
    this.drawBoard(ctx, bx, top - h * 0.35, len, h, s, dir);
    const tip = h * 0.5, fx = bx + (dir < 0 ? tip : 0) + 14 * s, fw = len - tip - 28 * s;
    if (place) this.drawPlaceFace(ctx, place, fx, top - h * 0.35 + 10 * s, fw, h - 20 * s, s, true);
    else this.drawTextOn(ctx, g.text_fa, fx, top - h * 0.35 + 10 * s, fw, h - 20 * s, s * 0.85);
    ctx.fillStyle = '#c9a044'; ctx.beginPath(); ctx.arc(x, top, 5 * s, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  /** [x, y, w, h] of a fractional box [x0, y0, x1, y1] inside a drawn sprite box. */
  subBox(box, f) { return [box.x + box.w * f[0], box.y + box.h * f[1], box.w * (f[2] - f[0]), box.h * (f[3] - f[1])]; }
  /** The place name (engine text, RTL) on the cream part of a generated picture sign. */
  drawPlaceName(ctx, place, x, y, w, h, s) {
    const name = this.strings ? this.strings.t('place.' + place) : this.puzzle.places.find((p) => p.spot_id === place).name_fa;
    let size = Math.min(h * 0.62, 40 * s);
    ctx.save(); ctx.fillStyle = '#4a3418'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.direction = 'rtl';
    ctx.font = `800 ${Math.round(size)}px ${FONT}`;
    while (size > 10 && ctx.measureText(name).width > w * 0.94) { size -= 1; ctx.font = `800 ${Math.round(size)}px ${FONT}`; }
    ctx.fillText(name, x + w / 2, y + h / 2);
    ctx.restore();
  }
  /** Draw a sprite by its bbox: width w, bottom on footY; returns the drawn box. */
  drawSprite(ctx, id, x, footY, w, mirror = false) {
    const im = this.img(id), m = this.sprites.m && this.sprites.m[id];
    if (!im) return null;
    const [x0, y0, x1, y1] = (m && m.bbox) || [0, 0, im.width - 1, im.height - 1], sw = x1 - x0 + 1, sh = y1 - y0 + 1, h = w * sh / sw;
    ctx.save();
    if (mirror) { ctx.translate(x, 0); ctx.scale(-1, 1); ctx.translate(-x, 0); }
    ctx.drawImage(im, x0, y0, sw, sh, x - w / 2, footY - h, w, h);
    ctx.restore();
    return { x: x - w / 2, y: footY - h, w, h };
  }
  /**
   * The sentence on a sign face, centred, right to left. When it would be smaller than MIN_PX it is drawn as «writing
   * lines» instead (a wordless cue to tap and read it on the Reading Card, which is the real reading surface).
   */
  drawTextOn(ctx, text, x, y, w, h, s) {
    const MIN_PX = 14;
    let size = 26 * s, L = null;
    ctx.save(); ctx.fillStyle = '#4a3418'; ctx.textBaseline = 'middle';
    while (size >= MIN_PX) {
      ctx.font = `700 ${size}px ${FONT}`;
      L = this.layout(ctx, text, [], w);
      if (L.length * size * 1.3 <= h) break;
      size *= 0.9; L = null;
    }
    if (!L) {
      ctx.strokeStyle = 'rgba(74,52,24,0.55)'; ctx.lineCap = 'round'; ctx.lineWidth = Math.max(2, 4 * s);
      const n = Math.max(2, Math.min(3, Math.floor(h / (16 * s)))), gap = h / (n + 1);
      for (let i = 1; i <= n; i++) { const lw = i === n ? w * 0.55 : w * 0.86; ctx.beginPath(); ctx.moveTo(x + w / 2 + w * 0.43, y + gap * i); ctx.lineTo(x + w / 2 + w * 0.43 - lw, y + gap * i); ctx.stroke(); }
      ctx.restore(); return;
    }
    const lh = size * 1.3, top = y + h / 2 - ((L.length - 1) * lh) / 2, cx = x + w / 2;
    ctx.textAlign = 'right'; ctx.direction = 'rtl';
    for (const wd of L.words) ctx.fillText(wd.t, cx + L.lineW[wd.line] / 2 + wd.x, top + wd.line * lh);
    ctx.restore();
  }
  /** Picture side: the place name + a sky-blue medallion with a procedural pictogram (bell, fruit, books, bucket). */
  drawPlaceFace(ctx, place, x, y, w, h, s, compact = false) {
    const R = Math.min(h * 0.42, 40 * s), mx = x + w - R - 8 * s, my = y + h / 2;
    ctx.save();
    ctx.fillStyle = '#8fc3e6'; ctx.strokeStyle = '#3f6f93'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(mx, my, R, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    this.drawPicto(ctx, place, mx, my, R * 0.72);
    const name = this.strings ? this.strings.t('place.' + place) : this.puzzle.places.find((p) => p.spot_id === place).name_fa;
    ctx.fillStyle = '#4a3418'; ctx.font = `800 ${Math.round((compact ? 26 : 34) * s)}px ${FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.direction = 'rtl';
    ctx.fillText(name, x + (w - 2 * R - 8 * s) / 2, my);
    ctx.restore();
  }
  drawPicto(ctx, place, x, y, r) {
    ctx.save(); ctx.lineWidth = Math.max(1.5, r * 0.08); ctx.lineJoin = 'round';
    if (place === 'school') {                        // bell
      ctx.fillStyle = '#e5b43c'; ctx.strokeStyle = '#7a5310';
      ctx.beginPath(); ctx.moveTo(x - r * 0.75, y + r * 0.5); ctx.quadraticCurveTo(x - r * 0.5, y + r * 0.3, x - r * 0.45, y - r * 0.2);
      ctx.quadraticCurveTo(x - r * 0.4, y - r * 0.8, x, y - r * 0.8); ctx.quadraticCurveTo(x + r * 0.4, y - r * 0.8, x + r * 0.45, y - r * 0.2);
      ctx.quadraticCurveTo(x + r * 0.5, y + r * 0.3, x + r * 0.75, y + r * 0.5); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y + r * 0.65, r * 0.16, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    } else if (place === 'market') {                 // apple
      ctx.fillStyle = '#d9483b'; ctx.strokeStyle = '#7a1f16';
      ctx.beginPath(); ctx.arc(x - r * 0.25, y + r * 0.1, r * 0.55, 0, Math.PI * 2); ctx.arc(x + r * 0.25, y + r * 0.1, r * 0.55, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#5a3a1a'; ctx.beginPath(); ctx.moveTo(x, y - r * 0.35); ctx.lineTo(x + r * 0.08, y - r * 0.8); ctx.stroke();
      ctx.fillStyle = '#6ea84a'; ctx.beginPath(); ctx.ellipse(x + r * 0.35, y - r * 0.62, r * 0.28, r * 0.13, -0.5, 0, Math.PI * 2); ctx.fill();
    } else if (place === 'library') {                // three books
      [['#c0533f', -0.55, 0], ['#3f7fa8', -0.1, 0], ['#6f9e4a', 0.35, -0.2]].forEach(([c, dx, rot]) => {
        ctx.save(); ctx.translate(x + dx * r + r * 0.18, y + r * 0.7); ctx.rotate(rot);
        ctx.fillStyle = c; ctx.strokeStyle = '#3a2410'; ctx.beginPath(); ctx.rect(-r * 0.18, -r * 1.35, r * 0.36, r * 1.35); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,240,200,0.8)'; ctx.beginPath(); ctx.moveTo(-r * 0.1, -r * 1.05); ctx.lineTo(r * 0.1, -r * 1.05); ctx.stroke(); ctx.restore();
      });
    } else {                                         // bucket + water drop
      ctx.fillStyle = '#9aa3a8'; ctx.strokeStyle = '#3d4448';
      ctx.beginPath(); ctx.moveTo(x - r * 0.6, y - r * 0.2); ctx.lineTo(x + r * 0.6, y - r * 0.2); ctx.lineTo(x + r * 0.45, y + r * 0.75); ctx.lineTo(x - r * 0.45, y + r * 0.75); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y - r * 0.2, r * 0.6, Math.PI, 0); ctx.stroke();
      ctx.fillStyle = '#4fa3d9'; ctx.beginPath(); ctx.ellipse(x, y - r * 0.2, r * 0.55, r * 0.12, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  /**
   * Right-to-left word layout: returns {words:[{t, key, x (right edge from the right margin, ≤ 0), line, w}], lineW, width, length}.
   * Words keep their ZWNJ joins; `keys` marks the H2 key words (a word is key if any of its letters is inside a key phrase).
   */
  layout(ctx, text, keys, maxW) {
    const flags = []; for (const seg of highlightSegments(text, keys)) for (const _ of seg.t) flags.push(seg.key);
    const words = []; let cur = null;
    [...text].forEach((ch, i) => {
      if (ch === ' ') { cur = null; return; }
      if (!cur) { cur = { t: '', key: false }; words.push(cur); }
      cur.t += ch; cur.key = cur.key || flags[i];
    });
    const sp = ctx.measureText(' ').width || 10, out = [], lineW = [0];
    let x = 0, line = 0;
    for (const wd of words) {
      const w = ctx.measureText(wd.t).width;
      if (x > 0 && x + w > maxW) { lineW[line] = x - sp; line++; x = 0; lineW[line] = 0; }
      out.push({ ...wd, x: -x, line, w }); x += w + sp;
    }
    lineW[line] = Math.max(0, x - sp);
    const res = { words: out, lineW, width: Math.max(...lineW), length: line + 1 };
    return res;
  }

  drawCard(ctx) {
    const c = this.card, st = this.stage, g = signOf(st, c.sign);
    const a = Math.min(1, c.t / 0.18), sc = 0.92 + 0.08 * a;
    ctx.save();
    ctx.fillStyle = `rgba(20,12,6,${0.32 * a})`; ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = a;
    ctx.translate(CARD.x, CARD.y); ctx.scale(sc, sc); ctx.translate(-CARD.x, -CARD.y);
    const x0 = CARD.x - CARD.w / 2, y0 = CARD.y - CARD.h / 2;
    this.drawBoard(ctx, x0, y0, CARD.w, CARD.h, 2.2);
    // the sentence, big, right to left; H2 marks the key words; H1 lights the word LUMI is passing
    ctx.font = `700 54px ${FONT}`; ctx.textBaseline = 'middle';
    const keys = this.highlight.has(g.sign_id) ? g.keys : [];
    const L = this.layout(ctx, g.text_fa, keys, CARD.w - 180), lh = 84;
    const top = CARD.y - 40 - ((L.length - 1) * lh) / 2;
    const words = []; this.cardWords = words;
    for (const wd of L.words) {
      const xr = CARD.x + L.lineW[wd.line] / 2 + wd.x, y = top + wd.line * lh;
      words.push({ x: xr, y, w: wd.w });
      if (wd.key) {
        ctx.fillStyle = `rgba(255,205,90,${0.55 + 0.15 * Math.sin(this.t * 3)})`;
        ctx.beginPath(); ctx.roundRect(xr - wd.w - 8, y - 36, wd.w + 16, 72, 14); ctx.fill();
      }
      const lit = this.lumi.mode === 'read' && this.lumi.wordI !== undefined && words.length - 1 <= this.lumi.wordI;
      if (lit) { ctx.fillStyle = 'rgba(255,240,190,0.55)'; ctx.beginPath(); ctx.roundRect(xr - wd.w - 6, y + 26, wd.w + 12, 8, 4); ctx.fill(); }
      ctx.fillStyle = wd.key ? '#4a2a08' : '#3e2c14'; ctx.textAlign = 'right'; ctx.direction = 'rtl';
      ctx.fillText(wd.t, xr, y);
    }
    // listen (optional read-aloud): appears after audio_unlock_s; a ring fills while it waits
    const k = clamp01(c.t / this.puzzle.reading.audio_unlock_s), ready = k >= 1;
    ctx.globalAlpha = a * (ready ? 1 : 0.4);
    ctx.fillStyle = ready ? '#fbeec8' : '#e6d6b0'; ctx.strokeStyle = '#7a5a1c'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(LISTEN.x, LISTEN.y, LISTEN.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (!ready) { ctx.strokeStyle = '#c9a044'; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(LISTEN.x, LISTEN.y, LISTEN.r - 8, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2); ctx.stroke(); }
    this.drawSpeaker(ctx, LISTEN.x, LISTEN.y, 22, ready && c.playT !== undefined && this.t - c.playT < (c.playDur || 5));
    ctx.globalAlpha = a;
    // close
    ctx.fillStyle = '#fbeec8'; ctx.strokeStyle = '#7a5a1c'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(CLOSE.x, CLOSE.y, CLOSE.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#5e3a18'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(CLOSE.x - 12, CLOSE.y - 12); ctx.lineTo(CLOSE.x + 12, CLOSE.y + 12); ctx.moveTo(CLOSE.x + 12, CLOSE.y - 12); ctx.lineTo(CLOSE.x - 12, CLOSE.y + 12); ctx.stroke();
    ctx.restore();
  }
  drawSpeaker(ctx, x, y, r, playing) {
    ctx.save(); ctx.fillStyle = '#5e3a18'; ctx.strokeStyle = '#5e3a18'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x - r, y - r * 0.4); ctx.lineTo(x - r * 0.45, y - r * 0.4); ctx.lineTo(x + r * 0.15, y - r);
    ctx.lineTo(x + r * 0.15, y + r); ctx.lineTo(x - r * 0.45, y + r * 0.4); ctx.lineTo(x - r, y + r * 0.4); ctx.closePath(); ctx.fill();
    for (let i = 1; i <= 2; i++) {
      ctx.globalAlpha = playing ? 0.5 + 0.5 * Math.sin(this.t * 8 - i) : 1;
      ctx.beginPath(); ctx.arc(x + r * 0.2, y, r * 0.45 * i, -0.8, 0.8); ctx.stroke();
    }
    ctx.restore();
  }
  /** H3: a round lens on the scene clue of the answer place + a dotted line from the card (text clue ↔ scene clue). */
  drawLens(ctx) {
    const L = this.lens, c = CUES[L.spot], a = Math.min(1, L.t / 0.3) * Math.min(1, Math.max(0, (6 - L.t) / 0.5));
    // from the nearest point of the card edge (the text clue) to the scene clue
    const from = { x: Math.max(CARD.x - CARD.w / 2 + 60, Math.min(CARD.x + CARD.w / 2 - 60, c.x)), y: c.y < CARD.y ? CARD.y - CARD.h / 2 : CARD.y + CARD.h / 2 };
    if (c.y > CARD.y - CARD.h / 2 && c.y < CARD.y + CARD.h / 2) { from.x = c.x < CARD.x ? CARD.x - CARD.w / 2 : CARD.x + CARD.w / 2; from.y = c.y; }
    ctx.save(); ctx.globalAlpha = a;
    ctx.strokeStyle = 'rgba(255,238,190,0.95)'; ctx.lineWidth = 5; ctx.setLineDash([4, 14]); ctx.lineCap = 'round';
    ctx.lineDashOffset = -this.t * 30;
    ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(c.x, c.y); ctx.stroke(); ctx.setLineDash([]);
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(c.x, c.y, c.r * 0.4, c.x, c.y, c.r * 1.3);
    g.addColorStop(0, 'rgba(255,236,180,0.35)'); g.addColorStop(1, 'rgba(255,236,180,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c.x, c.y, c.r * 1.3, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = '#c9a044'; ctx.lineWidth = 9; ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#6e4a14'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(c.x, c.y, c.r + 5, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#8a5a2b'; ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(0.8);
    ctx.beginPath(); ctx.roundRect(c.r + 4, -8, 58, 16, 6); ctx.fill(); ctx.restore();
    ctx.restore();
  }
  drawFx(ctx, f) {
    ctx.save();
    if (f.kind === 'wrong') {                        // stands on the wrong place, wobbles, floats back to the row
      const i = this.slotOf(f.sign), home = this.traySlot(i), back = Math.max(0, (f.t - 0.6) / 0.4);
      const x = lerp(f.x, home.x, back), y = lerp(f.y, home.y, back), rot = Math.sin(f.t * 22) * 0.1 * Math.max(0, 1 - f.t / 0.6);
      const dir = SPOTS[this.stageIdx][f.spot].dir;
      this.drawObj(ctx, this.stageIdx, f.sign, null, x, y, lerp(depthAt(f.y), home.s, back), { face: 'text', rot, dir: dir || 1 });
    } else if (f.kind === 'return') {
      const i = this.slotOf(f.sign), home = this.traySlot(i), k = f.t / 0.4;
      ctx.globalAlpha = 1 - k * 0.3;
      this.drawObj(ctx, this.stageIdx, f.sign, null, lerp(f.x, home.x, k), lerp(f.y, home.y, k), home.s, { face: 'text', dir: 1 });
    } else if (f.kind === 'dust') {
      const k = f.t / 0.9; ctx.fillStyle = `rgba(230,205,160,${0.5 * (1 - k)})`;
      for (let i = 0; i < 8; i++) { const an = Math.PI + (i / 7) * Math.PI; ctx.beginPath(); ctx.arc(f.x + Math.cos(an) * (20 + 60 * k), f.y + Math.sin(an) * (8 + 18 * k), 7 * (1 - k) + 2, 0, Math.PI * 2); ctx.fill(); }
    } else if (f.kind === 'react_school') {          // the bell swings: sound rings spread from the belfry
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) {
        const k = clamp01((f.t - i * 0.25) / 1.3); if (k <= 0) continue;
        ctx.strokeStyle = `rgba(255,226,150,${0.8 * (1 - k)})`; ctx.lineWidth = 6 * (1 - k) + 1;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.6 + k * 1.6), 0, Math.PI * 2); ctx.stroke();
      }
    } else if (f.kind === 'react_market') {          // fruit hop out of the baskets and crates
      const fruit = ['#d9483b', '#f0a33a', '#e8c547', '#8cbf4a'];
      for (let i = 0; i < 9; i++) {
        const bx = i % 2 ? 1224 : f.x, t = clamp01(f.t / 0.9 - i * 0.04), hop = Math.sin(t * Math.PI) * (40 + (i % 3) * 16);
        ctx.fillStyle = fruit[i % 4]; ctx.strokeStyle = 'rgba(60,30,10,0.6)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(bx - 24 + (i % 4) * 16, f.y - hop, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
    } else if (f.kind === 'react_library') {         // pages flutter out of the book window
      for (let i = 0; i < 7; i++) {
        const k = clamp01(f.t / 1.8 - i * 0.05), x = f.x - 80 + i * 26 + Math.sin(k * 9 + i) * 20, y = f.y - k * 120 + Math.cos(k * 7 + i) * 10;
        ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(k * 8 + i) * 0.8); ctx.scale(Math.cos(k * 12 + i), 1);
        ctx.globalAlpha = 1 - k; ctx.fillStyle = '#fbf3dc'; ctx.strokeStyle = '#9a8660'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.rect(-11, -8, 22, 16); ctx.fill(); ctx.stroke(); ctx.restore();
      }
    } else if (f.kind === 'react_well') {            // the bucket dips: splash + drops
      const k = f.t / 1.8;
      for (let i = 0; i < 12; i++) {
        const an = -Math.PI / 2 + (i / 11 - 0.5) * 2.2, t = clamp01(f.t / 0.9), sp = 70 + (i % 3) * 25;
        const x = f.x + Math.cos(an) * sp * t, y = f.y + Math.sin(an) * sp * t + 160 * t * t;
        ctx.fillStyle = `rgba(120,190,235,${0.9 * (1 - k)})`; ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.strokeStyle = `rgba(200,235,255,${0.8 * (1 - k)})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(f.x, f.y + 18, 30 + 50 * k, 8 + 12 * k, 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }
  drawSparks(ctx) {
    if (!this.sparks.length) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const s of this.sparks) {
      const a = Math.sin(Math.PI * s.t / s.life) * (0.6 + 0.4 * Math.sin(s.ph));
      ctx.fillStyle = `rgba(255,228,150,${a})`; ctx.beginPath(); ctx.arc(s.x + Math.sin(s.ph) * 8, s.y, s.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  drawLumi(ctx) {
    const lm = this.lumi, x = lm.p.x.value, y = lm.p.y.value;
    const pulse = 1 + 0.06 * Math.sin(this.t * 5) + (lm.mode === 'celebrate' ? 0.1 * Math.sin(this.t * 14) : 0);
    const small = lm.mode === 'read' ? 0.7 : 1;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y, 4, x, y, 90 * pulse * small);
    g.addColorStop(0, 'rgba(255,230,170,0.55)'); g.addColorStop(1, 'rgba(255,200,120,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 90 * pulse * small, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    const img = this.img('lumi_front'), s = 0.42 * pulse * small;
    if (img) ctx.drawImage(img, x - 128 * s, y - 128 * s, 256 * s, 256 * s);
  }
  drawHud(ctx) {
    const S = this.sprites, text = this.stage.objective_fa;
    ctx.save();
    ctx.font = `700 38px ${FONT}`; ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = ctx.measureText(text).width + 90;
    ctx.fillStyle = 'rgba(250,240,215,0.93)'; ctx.strokeStyle = 'rgba(150,110,50,0.8)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(W / 2 - w / 2, 34, Math.min(w, 1240), 74, 20); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#4a3418'; ctx.fillText(text, W / 2, 73);
    if (this.bubble) {
      const a = Math.min(1, this.bubble.t / 0.3); ctx.globalAlpha = a;
      ctx.font = `700 34px ${FONT}`;
      const bw = ctx.measureText(this.bubble.text).width + 80, by = this.card ? CARD.y + CARD.h / 2 + 30 : 160;
      ctx.fillStyle = 'rgba(255,248,226,0.96)'; ctx.strokeStyle = 'rgba(214,170,80,0.95)';
      ctx.beginPath(); ctx.roundRect(W / 2 - bw / 2, by, bw, 66, 33); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#5a3e14'; ctx.fillText(this.bubble.text, W / 2, by + 34); ctx.globalAlpha = 1;
    }
    ctx.restore();
    const pr = this.pressT || {}, done = this.ctrl.solved;
    drawHudButton(ctx, S, 'btn_hint', BTN.hint, BTN_R, { disabled: done || this.ended, available: this.hints.available, pressed: pr.hint, t: this.t });
    drawHudButton(ctx, S, 'btn_undo', BTN.undo, BTN_R, { disabled: done || this.ended || !this.ctrl.undoStack.length, pressed: pr.undo, t: this.t });
    drawHudButton(ctx, S, 'btn_reset', BTN.reset, BTN_R, { disabled: done && !this.ended, available: this.ended, pressed: pr.reset, t: this.t });
    // wordless progress: one dot per sign of this stage (+ a bigger dot for the stage)
    const n = this.stage.signs.length, placed = Object.keys(this.ctrl.placed).length;
    for (let k = 0; k < n; k++) {
      ctx.fillStyle = k < placed ? 'rgba(255,200,90,0.95)' : 'rgba(255,240,210,0.4)';
      ctx.beginPath(); ctx.arc(W / 2 - (n - 1) * 14 + k * 28, 128, 7, 0, Math.PI * 2); ctx.fill();
    }
    if (this.ended && this.onExit && !this.fade) drawExitArrow(ctx, EXIT, this.t, reduceMotion);
    if (this.fade) { ctx.fillStyle = `rgba(22,16,10,${(1 - this.fade.a) * 0.85})`; ctx.fillRect(0, 0, W, H); }
    if (this.leaving) { ctx.fillStyle = `rgba(20,12,6,${this.leaving.a})`; ctx.fillRect(0, 0, W, H); }
  }
  debugState() {
    return {
      puzzle: this.stage.puzzle_id, pending: this.ctrl.pending().join(' ') || '-', placed: Object.entries(this.ctrl.placed).map(([p, s]) => `${s}@${p}`).join(' ') || '-',
      card: this.card ? this.card.sign : '-', hint_level: this.hints.level, hint_available: this.hints.available, wrong: this.hints.wrong,
      assist: this.ctrl.assist, flagged: [...this.misc.flagged].join(',') || '-', mastery: this.mastery.get(this.puzzle.concept_id),
      world: Object.keys(this.save.data.world).join(',') || '-', music_layers: this.audio.layers,
    };
  }
}
