// LUMA — Room VIL_SIGN_AREA / neighbourhood intro board, card WRITING-01 (Q01, plan 12 §1 row 4): «محله‌ی ما».
// Production step of P-01 in the same square (plan 04: W-n follows P-n in the same room). The intro board of the
// neighbourhood is broken and its picture cards lie scattered over the square. Encounter:
//  1. Collect (card Quest «با مشاهده محیط، نشانه‌های تصویری را جمع‌آوری کند»): the child taps the four picture cards
//     (house, school, market, park — the places walked through in Q01); each flies onto the board.
//  2. The camera moves close to the board (actors stay in the square, LUMI comes along). Sentence Assembly (Drag →
//     Snap): the sentence plaques lie on the writing board (W01_ASSET_04); the child drags each one onto the row whose
//     picture is the place the sentence is ABOUT. A sentence that only mentions a place (the market sentence «از خانه
//     که بیرون می‌آییم…» on the house row) is the trap (card wrong answer; FA_SINGLE_WORD_MATCH).
//  3. Sequence (card Physics «board pieces move on a rail and lock when the right order is chosen»): the joined rows
//     become pieces on the brass rail; the child slides them up/down (the others make room), then presses the star
//     stamp (W01_ASSET_05). Right: the pieces lock one by one, the star is stamped, the board lights up. Wrong: the
//     stamp bounces back and the first wrong piece jiggles (card misconception WR_SENTENCE_ORDER_IRRELEVANT).
// Practice / Transfer (card mastery «a coherent four-sentence description in a NEW environment»): the library board with
// four new pictures. Success → VIL_INTRO_BOARD_UP: back in the square the board stands upright and glows.
// Camera: the square face-on (plan 14 §4.1); the board close-up is a strict face-on elevation (W01_ASSET_01 camera).
import { drawHudButton, drawExitArrow, PRESS_S } from '../engine/hud.js';
import { MisconceptionEngine, HintEngine, MasteryEngine, AnalyticsQueue, SaveSlot } from '../edu/engines.js';
import { Spring, Spring2, Timeline, reduceMotion } from '../engine/motion.js';
import { RigActor } from '../engine/rig.js';
import { BoardController } from '../puzzles/sentence_board.js';
import { plaqueOf, plaqueFor, cardOf, markSegments, moveRow } from '../edu/board_rules.js';
import { SignsP01 } from './signs_p01.js';
import { SignPlaceController } from '../puzzles/sign_place.js';
import { faDigits } from '../engine/strings.js';

export const W = 1920, H = 1080;
const FONT = 'LumaFa, Vazirmatn, Tahoma, sans-serif';
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => Math.max(0, Math.min(1, v));

// ---- square (plaza view): measured on ENV_VIL_SIGN_AREA__PLATE with the P-01 signs and markers standing
export const PLAZA_BOARD = { x: 725, foot: 1004, w: 300 };             // board foot point + bbox width in the square
export const GROUND = {                                                // where the picture cards lie (encounter)
  HOUSE: { x: 1478, y: 1000, rot: 0.18 }, SCHOOL: { x: 430, y: 1036, rot: -0.2 },
  MARKET: { x: 902, y: 1034, rot: 0.12 }, PARK: { x: 1236, y: 1046, rot: -0.14 },
};
export const GROUND_CARD_W = 92;
// ---- close-up (board view): fractions measured on the finals (W01_ASSET_01 panel x .114–.858 y .230–.684, rail x .869)
export const BOARD = { x0: 790, y0: 60, w: 1127 };
const BOARD_F = { px0: 0.114, px1: 0.858, py0: 0.230, py1: 0.684, rail: 0.869, aspect: 933 / 939 };
const bh = BOARD.w * BOARD_F.aspect;
export const PANEL = { x0: BOARD.x0 + BOARD.w * BOARD_F.px0, x1: BOARD.x0 + BOARD.w * BOARD_F.px1, y0: BOARD.y0 + bh * BOARD_F.py0, y1: BOARD.y0 + bh * BOARD_F.py1 };
export const RAIL_X = BOARD.x0 + BOARD.w * BOARD_F.rail;
const TITLE_H = 54;
export const PITCH = (PANEL.y1 - 6 - (PANEL.y0 + TITLE_H + 2)) / 4;
export const slotY = (i) => PANEL.y0 + TITLE_H + 2 + PITCH * (i + 0.5);
export const CARD_W = 76, CARD_H = 104;
export const CARD_X = PANEL.x1 - 22 - CARD_W / 2;                         // keeps ≥6 px off the rail tags (KEEP_CLEAR)
export const PLQ = { w: 600, h: 96 };
export const PLQ_X = CARD_X - CARD_W / 2 - 14 - PLQ.w / 2;              // plaque centre on a row (RTL: text starts at the card)
export const TRAY = { x0: -212, y0: 140, s: 1.2, cx: 414, ys: [484, 602, 720, 838] };
/** TIKO waits here once the exit arrow (1832, 985) is shown, so the arrow never covers him. */
export const TIKO_ASIDE = 1640;
export const STAMP = { x: 414, y: 760, h: 300 };
export const STAR = { x: PANEL.x0 + 62, y: PANEL.y0 + TITLE_H / 2 + 2 };
export const CARD = { x: 960, y: 385, w: 1200, h: 380 };               // Reading Card (same as P-01)
export const LISTEN = { x: CARD.x - CARD.w / 2 + 96, y: CARD.y + CARD.h / 2 - 78, r: 50 };
export const CLOSE = { x: CARD.x - CARD.w / 2 + 44, y: CARD.y - CARD.h / 2 + 44, r: 36 };
export const BTN = { hint: { x: 90, y: 90 }, undo: { x: 220, y: 90 }, reset: { x: 350, y: 90 } };
const BTN_R = 58;
const EXIT = { x: 1832, y: 985, r: 95 };
const PLQ_SRC = { x0: 31, y0: 315, x1: 735, y1: 451 };                  // w01_plaque bbox (768 px sprite), 3-slice ends
const PLQ_CAP = 0.72;                                                   // end width / height (brass tack + rounded end)
/** Areas of the close-up that nothing may cover: the rail tags and the stamp strip (layout guard, tested). */
export const KEEP_CLEAR = [{ id: 'rail_tags', x0: RAIL_X - 28, y0: PANEL.y0 + TITLE_H, x1: RAIL_X + 28, y1: PANEL.y1 }];

export class IntroBoardW01 {
  constructor({ sprites, puzzle, audio, storage, debug, strings, onExit, backdrop }) {
    Object.assign(this, { sprites, puzzle, audio, debug, strings, onExit });
    this.save = new SaveSlot(storage);
    this.mastery = new MasteryEngine(storage);
    this.analytics = new AnalyticsQueue(storage, puzzle.analytics_fields);
    this.tl = new Timeline();
    this.t = 0; this.attempt = 0; this.drag = null; this.fx = []; this.sparks = [];
    this.lumi = { p: new Spring2(420, 700, { stiffness: 30, damping: 9 }), mode: 'follow' };
    this.boardGlow = new Spring(0, { stiffness: 6, damping: 5 });
    this.ended = false; this.bubble = null; this.card = null; this.view = 'plaza';
    this.backdrop = backdrop ? this.makeBackdrop(backdrop) : null;
  }
  /** The P-01 square as the child left it (signs + route markers standing), drawn by the P-01 scene's own code. */
  makeBackdrop(p01) {
    const b = Object.create(SignsP01.prototype);
    Object.assign(b, { sprites: this.sprites, puzzle: p01, strings: this.strings, t: 0, anim: {}, flip: {}, stageIdx: 1 });
    b.signs = new SignPlaceController(p01.stages[0], p01.places); b.signs.finishAll();
    b.ctrl = new SignPlaceController(p01.stages[1], p01.places); b.ctrl.finishAll();
    for (const c of [b.signs, b.ctrl]) for (const sid of Object.values(c.placed)) b.flip[sid] = -99;
    return b;
  }

  async load() {
    this.neo = await new RigActor({ id: 'NEO', scale: 0.19, x: 130, groundY: 1052, face: 1 }).load();
    this.tiko = await new RigActor({ id: 'TIKO', scale: 0.11, x: 1790, groundY: 1010, face: -1 }).load();
    this.actors = [this.tiko, this.neo];
    const [e, p] = this.puzzle.stages.map((s) => this.save.puzzle(s.puzzle_id));
    if (p && p.solved) this.startStage(1, { finished: true });
    else if (e && e.solved) this.startStage(1);
    else this.startStage(0);
    if (this.save.flag(this.puzzle.world_state_on_solve)) this.boardGlow.set(1);
    return this;
  }

  // ================================================================= flow
  startStage(idx, { finished = false } = {}) {
    this.stageIdx = idx; this.stage = this.puzzle.stages[idx];
    this.misc = new MisconceptionEngine(this.puzzle.misconceptions, this.puzzle.misconception_flag_threshold);
    this.hintsM = new HintEngine(this.stage.hints_match, this.stage.answer_assist);
    this.hintsS = new HintEngine(this.stage.hints_sequence, this.stage.answer_assist);
    this.stageMaxHint = 0; this.stageAssisted = false; this.stageStart = this.t; this.attempt++;
    this.fx = []; this.anim = {}; this.bubble = null; this.card = null; this.hintShow = 0; this.drag = null;
    this.hl = { subject: new Set(), links: false, intro: false }; this.threads = null; this.hintLine = null;
    this.readAccum = {}; this.readingStarted = false; this.audioUsed = {}; this.focus = null; this.lumi.mode = 'follow';
    this.stamp = null; this.starT = null; this.lockT = null;
    const hooks = {
      onCollect: (c) => this.onCollect(c), onCollected: () => this.onCollected(),
      onJoin: (pl, c, r) => this.onJoin(pl, c, r), onWrong: (r, pl, c, w) => this.onWrongMatch(r, pl, c, w),
      onReject: (r, pl, c) => this.onReject(r, pl, c), onJoinedAll: () => this.onJoinedAll(),
      onMove: () => this.layoutRows(), onOrderWrong: (res) => this.onOrderWrong(res), onSolved: () => this.onSolved(),
      onUndo: (a) => this.onUndo(a),
    };
    this.ctrl = new BoardController(this.stage, hooks);
    this.rowY = {}; this.stage.cards.forEach((c) => { this.rowY[c.card_id] = new Spring(slotY(this.ctrl.rows.indexOf(c.card_id)), { stiffness: 140, damping: 16 }); });
    this.plq = {}; this.stage.plaque_tray_order.forEach((id, i) => { this.plq[id] = new Spring2(TRAY.cx, TRAY.ys[i], { stiffness: 150, damping: 17 }); });
    if (finished) {
      this.ctrl.finishAll(); this.ended = true; this.view = 'plaza'; this.tiko.x = TIKO_ASIDE; this.audio.setLayers(4); this.layoutRows(true);
      this.encRows = this.puzzle.stages[0].answer_order.slice();
      return;
    }
    this.ended = false;
    this.view = this.stage.collect ? 'plaza' : 'board';
    this.audio.setLayers(idx === 0 ? 1 : 3);
    this.log('puzzle_start', {});
    this.recordMastery(false);
    this.save.setPuzzle(this.stage.puzzle_id, { solved: false, entered: new Date().toISOString() });
  }
  get phase() { return this.ctrl.phase; }
  get hints() { return this.phase === 'sequence' || this.phase === 'done' ? this.hintsS : this.hintsM; }
  maxHint() { return Math.max(this.hintsM.maxUsed, this.hintsS.maxUsed); }

  recordMastery(solved) {
    // card mastery = a coherent description in a NEW environment → the practice without Highlight (H2/H3) and without
    // Assist gives level 3; H1 (look at the place / follow the route) and the read-aloud are allowed.
    const hl = this.puzzle.mastery.highlight_level || 2;
    const maxHint = this.stage.stage === 'practice' && this.stageMaxHint < hl ? 0 : this.stageMaxHint;
    const lvl = this.mastery.record(this.puzzle.concept_id, { stage: this.stage.stage, solved, maxHint, assisted: this.stageAssisted }, this.puzzle.mastery);
    if (lvl !== null) this.log('mastery_updated', { level: lvl });
  }
  log(name, extra) {
    const e = this.analytics.log(name, {
      puzzle_id: this.stage.puzzle_id, attempt_id: this.attempt, duration: Math.round((this.t - this.stageStart) * 10) / 10,
      hint_level: this.hintsM ? this.maxHint() : 0, ...extra,
    });
    if (this.debug) this.debug.push(e);
  }
  observe(rule, engine) {
    const { def, newlyFlagged } = this.misc.observe(rule);
    if (newlyFlagged) {
      this.log('misconception_flagged', { misconception: def.code, error_type: def.error_type });
      engine.target(def.targeted_hint);
    }
    return def;
  }

  // ---------------------------------------------------------------- collect (square)
  onCollect(cardId) {
    const g = GROUND[cardId];
    this.fx.push({ kind: 'fly', card: cardId, x: g.x, y: g.y, rot: g.rot, t: 0 });
    this.audio.paper();
    this.tl.after(0.7, () => this.audio.snap());
    this.log('picture_collected', { card_id: cardId, collected: this.ctrl.collected.size });
    this.neo.play('happy', 'idle');
  }
  onCollected() {
    this.log('puzzle_interaction', { action: 'pictures_collected' });
    this.tl.after(1.0, () => { this.audio.woodClick(); this.boardGlow.target = 0.35; });
    this.tl.after(1.6, () => this.zoomIn());
  }
  /** The camera moves in to the board (0.8 s zoom on the square, then the close-up fades in). */
  zoomIn() {
    this.zoomK = 0;
    this.tl.tween(0.8, (k) => { this.zoomK = k * k; }, () => {
      this.zoomK = null; this.view = 'board'; this.boardGlow.target = 0;
      this.fade = { a: 0 }; this.tl.tween(0.5, (k) => { this.fade.a = k; }, () => { this.fade = null; });
      this.audio.setLayers(2);
    });
  }

  // ---------------------------------------------------------------- match
  onJoin(plaqueId, cardId, row) {
    this.hintsM.onActivity();
    this.plq[plaqueId].to(PLQ_X, slotY(row));
    this.anim[plaqueId] = { pop: 0.35 };
    this.audio.snap(); this.tl.after(0.1, () => this.audio.thump()); this.tl.after(0.22, () => this.audio.chime());   // wood_snap + soft_success
    this.log('location_sentence_match', { plaque_id: plaqueId, card_id: cardId, row, result: 'ok', read_ms: this.lastReadMs, audio_used: !!this.audioUsed[plaqueId] });
    this.fx.push({ kind: 'snap', x: PLQ_X, y: slotY(row), t: 0 });
    if (this.focus === plaqueId) this.focus = null;
    this.hl.subject.delete(plaqueId);
  }
  onWrongMatch(rule, plaqueId, cardId, word) {
    const out = this.hintsM.onWrong();
    const def = this.observe(rule, this.hintsM);
    this.log('location_sentence_match', { plaque_id: plaqueId, card_id: cardId, row: this.ctrl.rows.indexOf(cardId), result: rule, read_ms: this.lastReadMs, audio_used: !!this.audioUsed[plaqueId] });
    this.log('wrong_context', { plaque_id: plaqueId, card_id: cardId, error_type: def ? def.error_type : 'ContextError', misconception: def ? def.code : null, trap_word: word });
    this.backToTray(plaqueId);
    this.anim['card_' + cardId] = { shake: 0.6 };
    this.audio.woodClick(); this.tl.after(0.18, () => this.audio.flicker());                                          // soft_error
    this.focus = plaqueId;
    if (out === 'assist') this.tl.after(1.0, () => {
      if (this.phase !== 'match') return;
      this.ctrl.enableAssist(); this.stageAssisted = true; this.audio.hint();
      this.log('puzzle_interaction', { action: 'answer_assist', mode: this.stage.answer_assist.action_match });
    });
  }
  onReject(rule, plaqueId) {
    this.backToTray(plaqueId); this.audio.snap();
    if (rule === 'assist_block') this.log('puzzle_interaction', { action: 'assist_reject', plaque_id: plaqueId });
  }
  backToTray(plaqueId) { const i = this.stage.plaque_tray_order.indexOf(plaqueId); this.plq[plaqueId].to(TRAY.cx, TRAY.ys[i]); }
  onJoinedAll() {
    this.hintsM.onActivity(); this.closeCard(); this.hl.subject.clear(); this.hintLine = null;
    this.log('puzzle_interaction', { action: 'all_joined' });
    this.tl.after(0.6, () => {                                                  // the rows unlock onto the rail; the stamp arrives
      this.audio.woodClick(); this.lockT = null;
      this.stamp = { y: new Spring(STAMP.y - 420, { stiffness: 90, damping: 11 }), x: STAMP.x, press: 0, busy: false };
      this.stamp.y.target = STAMP.y;
      this.tl.after(0.35, () => this.audio.thump());
      this.audio.setLayers(this.stageIdx === 0 ? 2 : 3);
    });
  }
  onUndo(a) {
    this.audio.snap();
    if (a.kind === 'join') { this.backToTray(a.plaqueId); this.stamp = null; }
    else this.layoutRows();
    this.log('puzzle_interaction', { action: 'undo', kind: a.kind });
  }

  // ---------------------------------------------------------------- sequence
  /** Springs follow the controller's order (or a live preview while a row is dragged). */
  layoutRows(snap = false, order = this.ctrl.rows, skip = null) {
    order.forEach((c, i) => {
      if (c === skip) return;
      const sp = this.rowY[c]; sp.target = slotY(i); if (snap) sp.set(slotY(i));
      const pl = this.ctrl.joined[c]; if (pl) { this.plq[pl].to(PLQ_X, slotY(i)); if (snap) this.plq[pl].set(PLQ_X, slotY(i)); }
    });
  }
  pressStamp() {
    const s = this.stamp;
    if (!s || s.busy || this.phase !== 'sequence') return;
    s.busy = true; this.hintsS.onActivity(); this.closeCard();
    this.audio.pickup();
    this.log('stamp_pressed', { order: this.ctrl.rows.join('>'), reorder_attempts: this.ctrl.reorders });
    s.fly = 0;
    this.tl.tween(0.45, (k) => { s.fly = k; }, () => {
      this.tl.tween(0.14, (k) => { s.press = k; }, () => {
        this.audio.stamp();
        const res = this.ctrl.submit();
        this.tl.tween(0.18, (k) => { s.press = 1 - k; }, () => {
          if (res && res.ok) { this.stamp = null; return; }
          this.tl.tween(0.5, (k) => { s.fly = 1 - k; }, () => { s.busy = false; s.fly = 0; });
        });
      });
    });
  }
  onOrderWrong(res) {
    const out = this.hintsS.onWrong();
    const def = this.observe('order', this.hintsS);
    this.log('sentence_order_error', { order: this.ctrl.rows.join('>'), first_wrong: res.firstWrong, rule: res.rule, reorder_attempts: this.ctrl.reorders,
      error_type: def.error_type, misconception: def.code });
    const c = this.ctrl.rows[res.firstWrong];
    this.anim['row_' + c] = { shake: 0.9, warn: 1.8 };
    this.tl.after(0.1, () => { this.audio.woodClick(); this.audio.flicker(); });                                  // soft_error
    if (out === 'assist') this.tl.after(1.2, () => {
      if (this.phase !== 'sequence') return;
      this.ctrl.assistSequence(); this.stageAssisted = true; this.layoutRows(); this.audio.hint(); this.audio.thump();
      this.log('puzzle_interaction', { action: 'answer_assist', mode: this.stage.answer_assist.action_sequence });
    });
  }
  onSolved() {
    this.stageMaxHint = Math.max(this.stageMaxHint, this.maxHint());
    this.card = null; this.hintShow = 0; this.threads = null; this.hintLine = null; this.bubble = null; this.introHint = null;
    this.hl = { subject: new Set(), links: false, intro: false };
    this.log('reorder_attempts', { reorder_attempts: this.ctrl.reorders });
    this.log('puzzle_solved', { assisted: this.stageAssisted, reorder_attempts: this.ctrl.reorders });
    this.recordMastery(true);
    this.save.setPuzzle(this.stage.puzzle_id, { solved: true, hint_max: this.stageMaxHint, assisted: this.stageAssisted });
    this.starT = this.t; this.lockT = this.t;
    this.fx.push({ kind: 'ink', x: STAR.x, y: STAR.y, t: 0 });
    this.ctrl.rows.forEach((c, k) => this.tl.after(0.35 + k * 0.26, () => { this.anim['row_' + c] = { lock: 0.4 }; this.audio.thump(); }));   // lock with a clack
    this.tl.after(1.5, () => { this.boardGlow.target = 1; this.audio.gardenChime(4); this.audio.chime(); });                  // the board lights up
    if (this.stageIdx === 0) {
      this.encRows = this.ctrl.rows.slice();
      this.tl.after(2.2, () => { this.audio.motif(); this.audio.setLayers(2); this.lumi.mode = 'celebrate'; });
      this.tl.after(4.4, () => this.transition(() => { this.boardGlow.set(0); this.lumi.mode = 'follow'; this.startStage(1); }));
    } else {
      this.tl.after(3.0, () => this.transition(() => {                          // payoff in the square: VIL_INTRO_BOARD_UP
        this.view = 'plaza'; this.boardGlow.set(1);
        this.save.setFlag(this.puzzle.world_state_on_solve);
        this.tl.after(0.4, () => {
          this.audio.bell(); this.audio.motif(); this.audio.setLayers(4); this.spawnSparks();
          this.neo.play('happy', 'idle'); this.tiko.play('happy', 'idle'); this.lumi.mode = 'celebrate';
          this.tl.after(1.6, () => this.tiko.walkTo(TIKO_ASIDE, () => this.tiko.play('happy', 'idle')));   // steps off the exit arrow
          this.tl.after(3.4, () => { this.lumi.mode = 'follow'; this.ended = true; });
        });
      }));
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
    this.transition(() => { this.boardGlow.set(0); this.startStage(0); });
  }
  leave() {
    this.leaving = { a: 0 }; this.audio.pickup();
    this.log('room_exit', { to: 'next' });
    this.tl.tween(0.8, (k) => { this.leaving.a = k; }, () => this.onExit());
  }

  // ================================================================= reading card
  openCard(plaqueId, source = 'tap') {
    if (this.card && this.card.plaque === plaqueId) return;
    this.closeCard();
    this.card = { plaque: plaqueId, t: 0 };
    this.focus = plaqueId; this.audio.paper();
    if (!this.readingStarted) { this.readingStarted = true; this.log('reading_started', { plaque_id: plaqueId }); }
    this.log('plaque_inspected', { plaque_id: plaqueId, source });
  }
  closeCard() {
    if (!this.card) return;
    this.readAccum[this.card.plaque] = (this.readAccum[this.card.plaque] || 0) + this.card.t;
    this.audio.stopVoice && this.audio.stopVoice();
    if (this.lumi.mode === 'read') this.lumi.mode = 'follow';
    this.card = null;
  }
  listenReady() { return this.card && this.card.t >= this.puzzle.reading.audio_unlock_s; }
  voUrl(key) { return `unity/Assets/_Project/${this.puzzle.reading.audio_dir}/${key}.mp3`; }
  listen() {
    const p = plaqueOf(this.stage, this.card.plaque), card = this.card;
    card.playT = this.t; card.playDur = 5; this.audioUsed[p.plaque_id] = true;
    const pr = this.audio.voice && this.audio.voice(this.voUrl(p.audio_key));
    if (pr && pr.then) pr.then((d) => { if (d > 0) card.playDur = d + 0.2; }).catch(() => {});
    this.log('audio_read', { plaque_id: p.plaque_id, audio_used: true, read_ms: Math.round(card.t * 1000) });
  }

  // ================================================================= geometry + hit tests
  groundHit(x, y) {
    for (const c of this.ctrl.pendingCards()) { const g = GROUND[c]; if (Math.abs(x - g.x) < 70 && Math.abs(y - (g.y - 50)) < 80) return c; }
    return null;
  }
  trayHit(x, y) {
    for (const id of this.ctrl.pendingPlaques()) {
      const p = this.plq[id]; if (Math.abs(x - p.x.value) < PLQ.w / 2 && Math.abs(y - p.y.value) < PLQ.h / 2) return id;
    }
    return null;
  }
  rowAt(y, x = PLQ_X) {
    if (x < PANEL.x0 - 60 || x > PANEL.x1 + 20) return null;
    for (let i = 0; i < 4; i++) if (Math.abs(y - slotY(i)) < PITCH / 2) return i;
    return null;
  }
  rowHit(x, y) {
    if (x < PLQ_X - PLQ.w / 2 - 10 || x > CARD_X + CARD_W / 2 + 10) return null;
    for (const c of this.ctrl.rows) if (Math.abs(y - this.rowY[c].value) < PITCH / 2 - 2) return c;
    return null;
  }
  stampHit(x, y) { const s = this.stamp; return s && !s.busy && Math.abs(x - s.x) < 70 && y < s.y.value + 20 && y > s.y.value - STAMP.h - 10; }

  // ================================================================= input
  pointerDown(sx, sy) {
    this.audio.unlock();
    this.hints.onActivity();
    for (const [name, b] of Object.entries(BTN)) if (Math.hypot(sx - b.x, sy - b.y) <= BTN_R) return this.button(name);
    if (this.fade || this.leaving || this.zoomK != null) return;
    if (this.ended && this.onExit && Math.hypot(sx - EXIT.x, sy - EXIT.y) < EXIT.r) return this.leave();
    this.down = { x: sx, y: sy, t: this.t };
    if (this.card) {
      if (Math.hypot(sx - CLOSE.x, sy - CLOSE.y) <= CLOSE.r) return this.closeCard();
      if (Math.hypot(sx - LISTEN.x, sy - LISTEN.y) <= LISTEN.r) { if (this.listenReady()) this.listen(); return; }
      if (Math.abs(sx - CARD.x) < CARD.w / 2 && Math.abs(sy - CARD.y) < CARD.h / 2) return;
      this.closeCard();
    }
    if (this.view === 'plaza') {
      if (this.phase === 'collect') { const c = this.groundHit(sx, sy); if (c) { this.ctrl.collect(c); return; } }
      for (const a of this.actors) if (a.hit(sx, sy + (a.lift || 0))) { a.play('happy', 'idle'); return; }
      return;
    }
    if (this.phase === 'match') {
      const id = this.trayHit(sx, sy);
      if (id) { const p = this.plq[id]; this.drag = { kind: 'plaque', id, ox: sx - p.x.value, oy: sy - p.y.value, moved: false, pickT: this.t }; this.focus = id; return; }
    }
    if (this.phase === 'sequence') {
      if (this.stampHit(sx, sy)) return this.pressStamp();
      const c = this.rowHit(sx, sy);
      if (c && !(this.stamp && this.stamp.busy)) { this.drag = { kind: 'row', card: c, from: this.ctrl.rows.indexOf(c), oy: sy - this.rowY[c].value, moved: false }; return; }
    }
    if (this.phase === 'match' || this.phase === 'done') {                   // tap a joined plaque = read it again
      const c = this.rowHit(sx, sy); if (c && this.ctrl.joined[c]) return this.openCard(this.ctrl.joined[c]);
    }
  }
  pointerMove(sx, sy) {
    const d = this.drag;
    if (!d) return;
    if (!d.moved && this.down && Math.hypot(sx - this.down.x, sy - this.down.y) > 12) {
      d.moved = true; this.closeCard();
      if (d.kind === 'plaque') { this.audio.paper(); this.log('puzzle_interaction', { action: 'plaque_lifted', plaque_id: d.id }); }
      else this.audio.pickup();
    }
    if (!d.moved) return;
    if (d.kind === 'plaque') { this.plq[d.id].set(sx - d.ox, sy - d.oy); return; }
    const y = Math.max(slotY(0), Math.min(slotY(3), sy - d.oy));
    this.rowY[d.card].set(y);
    const pl = this.ctrl.joined[d.card]; if (pl) this.plq[pl].set(PLQ_X, y);
    d.to = Math.max(0, Math.min(3, Math.round((y - slotY(0)) / PITCH)));
    if (this.ctrl.seqAssist && d.to === 0) d.to = 1;
    if (d.to !== d.lastTo) { if (d.lastTo !== undefined) this.audio.tick(d.to); d.lastTo = d.to; }
    this.layoutRows(false, moveRow(this.ctrl.rows, d.from, d.to), d.card);
  }
  pointerUp() {
    const d = this.drag; this.drag = null;
    if (!d) return;
    if (d.kind === 'plaque') {
      if (!d.moved) return this.openCard(d.id);
      const p = this.plq[d.id];
      this.lastReadMs = Math.round(((this.t - d.pickT) + (this.readAccum[d.id] || 0)) * 1000);
      this.ctrl.drop(d.id, this.rowAt(p.y.value, p.x.value));
      return;
    }
    if (!d.moved) { const pl = this.ctrl.joined[d.card]; if (pl) this.openCard(pl); return; }
    const to = d.to === undefined ? d.from : d.to;
    if (to !== d.from && this.ctrl.move(d.from, to)) {
      this.audio.snap(); this.tl.after(0.08, () => this.audio.thump());                                            // wood_snap on the rail
      this.log('puzzle_interaction', { action: 'row_moved', card_id: d.card, from: d.from, to, reorder_attempts: this.ctrl.reorders });
    } else this.layoutRows();
  }

  button(name) {
    this.pressT = { ...(this.pressT || {}), [name]: PRESS_S };
    const busy = this.fade || this.zoomK != null || this.phase === 'done' || (this.stamp && this.stamp.busy);
    if (name === 'hint') {
      if (busy || this.ended || this.view !== 'board') return;
      const h = this.hints.request();
      if (!h) return;
      this.audio.hint();
      this.log(`hint_${h.level}_used`, { hint_level: h.level });
      this.log('hint_used', { hint_level: h.level, phase: this.phase, plaque_id: this.phase === 'match' ? this.hintPlaque() : null });
      this.showHint(h);
    } else if (name === 'undo') {
      if (busy || this.ended) return;
      this.ctrl.undo();
    } else if (name === 'reset') {
      if (this.ended) return this.replay();
      if (busy) return;
      if (this.ctrl.reset()) {
        this.stamp = null; this.stage.plaque_tray_order.forEach((id) => this.backToTray(id)); this.layoutRows();
        this.audio.snap(); this.log('puzzle_interaction', { action: 'reset' });
      }
    }
  }
  hintPlaque() {
    const pend = this.ctrl.pendingPlaques();
    if (this.card && pend.includes(this.card.plaque)) return this.card.plaque;
    return this.focus && pend.includes(this.focus) ? this.focus : pend[0];
  }
  showHint(h) {
    this.stageMaxHint = Math.max(this.stageMaxHint, h.level);
    this.hintShow = h.level;
    if (h.text_key && this.strings) { const b = { text: this.strings.t(h.text_key), t: 0 }; this.bubble = b; this.tl.after(6, () => { if (this.bubble === b) this.bubble = null; }); }
    if (h.audio_key && this.audio.voice) this.audio.voice(this.voUrl(h.audio_key));
    if (this.phase === 'match') {
      const pid = this.hintPlaque(), p = plaqueOf(this.stage, pid);
      if (h.level === 1) {                             // H1: which place is it about? LUMI reads the whole sentence
        this.openCard(pid, 'hint'); this.lumi.mode = 'read'; this.lumi.readT = 0;
        this.tl.after(4.8, () => { if (this.lumi.mode === 'read') this.lumi.mode = 'follow'; });
      } else if (h.level === 2) {                      // H2: the subject («درباره‌ی چه مکانی») is marked
        this.hl.subject.add(pid); this.openCard(pid, 'hint');
      } else {                                         // H3: subject marked + the right picture glows, dotted line to it
        this.hl.subject.add(pid); this.closeCard();
        this.hintLine = { plaque: pid, card: p.subject, t: 0 };
        this.lumi.mode = 'hint'; this.lumi.target = { x: PLQ_X + PLQ.w / 2 - 80, y: this.rowY[p.subject].value };   // waits in the right (empty) slot
        this.tl.after(6.5, () => { this.hintLine = null; if (this.lumi.mode === 'hint') this.lumi.mode = 'follow'; });
      }
      return;
    }
    this.closeCard();
    if (h.level === 1) {                               // H1: LUMI follows the route: row by row, top to bottom
      this.lumi.mode = 'rows'; this.lumi.readT = 0;
      this.tl.after(5.2, () => { if (this.lumi.mode === 'rows') this.lumi.mode = 'follow'; });
    } else if (h.level === 2) {                        // H2: the link words and the places they point back to
      this.hl.links = true; this.threads = { t: 0 };
      this.tl.after(7, () => { this.threads = null; });
    } else {                                           // H3: start from the sentence that introduces the neighbourhood
      this.hl.intro = true; this.hl.links = true; this.introHint = { t: 0 };
      this.tl.after(7, () => { this.introHint = null; });
    }
  }

  spawnSparks(n = 110) {
    if (reduceMotion) n = Math.round(n / 4);
    for (let i = 0; i < n; i++) this.sparks.push({ x: PLAZA_BOARD.x + (Math.random() - 0.5) * 700, y: 450 + Math.random() * 520, vy: -20 - Math.random() * 40,
      ph: Math.random() * 6.28, life: 2 + Math.random() * 3, t: 0, r: 2 + Math.random() * 3 });
  }

  // ================================================================= update
  update(dt) {
    if (this.pressT) for (const k in this.pressT) this.pressT[k] = Math.max(0, this.pressT[k] - dt);
    this.t += dt;
    if (this.backdrop) this.backdrop.t = this.t;
    this.tl.update(dt);
    if (!this.ended && !this.card && this.view === 'board' && this.phase !== 'done') this.hints.tick(dt);
    this.boardGlow.update(dt);
    for (const s of Object.values(this.rowY)) s.update(dt);
    for (const [id, s] of Object.entries(this.plq)) if (!(this.drag && this.drag.kind === 'plaque' && this.drag.id === id && this.drag.moved)) s.update(dt);
    if (this.stamp) this.stamp.y.update(dt);
    if (this.card) this.card.t += dt;
    if (this.bubble) this.bubble.t += dt;
    if (this.threads) this.threads.t += dt;
    if (this.hintLine) this.hintLine.t += dt;
    if (this.introHint) this.introHint.t += dt;
    for (const k in this.anim) { const a = this.anim[k]; for (const f of ['pop', 'shake', 'lock', 'warn']) if (a[f] > 0) a[f] -= dt; }
    for (const f of this.fx) f.t += dt;
    this.fx = this.fx.filter((f) => f.t < (f.kind === 'fly' ? 0.75 : f.kind === 'ink' ? 1.2 : 0.6));
    for (const s of this.sparks) { s.t += dt; s.y += s.vy * dt; s.ph += dt * 3; }
    this.sparks = this.sparks.filter((s) => s.t < s.life);
    if (this.view === 'plaza' && this.boardGlow.value > 0.8 && !reduceMotion && Math.random() < dt * 5) this.spawnSparks(1);
    for (const a of this.actors) a.update(dt);
    if (this.tiko.clip === 'idle') this.tiko.faceTowards(PLAZA_BOARD.x);
    if (this.neo.clip === 'idle') this.neo.faceTowards(PLAZA_BOARD.x);
    const lm = this.lumi;
    if (lm.mode === 'follow') {
      if (this.view === 'plaza') { const h = this.neo.headPoint(); lm.p.to(h.x + 70, h.y - 60 + Math.sin(this.t * 2.1) * 12); }
      else if (this.card) lm.p.to(CARD.x + CARD.w / 2 + 70, CARD.y - 40 + Math.sin(this.t * 2.1) * 12);   // beside the card, never on the text
      else lm.p.to(PANEL.x0 - 40, PANEL.y0 - 60 + Math.sin(this.t * 2.1) * 12);
    } else if (lm.mode === 'read') {
      lm.readT += dt; const ws = this.cardWords || [];
      if (ws.length) { const k = Math.min(1, lm.readT / 3.6), i = Math.min(ws.length - 1, Math.floor(k * ws.length)), w = ws[i]; lm.wordI = i; lm.p.to(w.x - w.w / 2, w.y + 44); }
    } else if (lm.mode === 'rows') {                   // 1.2 s per row, resting at the start (right end) of each sentence
      lm.readT += dt; const i = Math.min(3, Math.floor(lm.readT / 1.2)), k = (lm.readT % 1.2) / 1.2;
      lm.rowI = i; const y = slotY(i);
      lm.p.to(PLQ_X + PLQ.w / 2 - 40 - k * (PLQ.w - 120), y - PLQ.h / 2 - 18);
    } else if (lm.mode === 'hint') lm.p.to(lm.target.x + Math.cos(this.t * 3) * 30, lm.target.y + Math.sin(this.t * 3) * 14);
    else if (lm.mode === 'celebrate') {
      if (this.view === 'plaza') lm.p.to(PLAZA_BOARD.x + Math.cos(this.t * 1.6) * 360, 520 + Math.sin(this.t * 3.2) * 60);
      else lm.p.to((PANEL.x0 + PANEL.x1) / 2 + Math.cos(this.t * 1.6) * 420, PANEL.y0 - 40 + Math.sin(this.t * 3.2) * 40);
    }
    if (reduceMotion && lm.mode !== 'celebrate') lm.p.set(lm.p.x.target, lm.p.y.target);
    lm.p.update(dt);
  }

  // ================================================================= draw
  img(name) { return this.sprites.get(name); }
  draw(ctx) {
    if (this.view === 'plaza' || this.zoomK != null) this.drawPlaza(ctx);
    else this.drawBoardView(ctx);
    this.drawSparks(ctx);
    if (this.card) this.drawCard(ctx);
    this.drawLumi(ctx);
    this.drawHud(ctx);
  }

  // ---------------------------------------------------------------- square
  drawPlaza(ctx) {
    ctx.save();
    if (this.zoomK != null) {                          // camera move towards the board
      const z = 1 + this.zoomK * 1.6, cx = PLAZA_BOARD.x, cy = PLAZA_BOARD.foot - 150;
      ctx.translate(cx, cy); ctx.scale(z, z); ctx.translate(-cx + (W / 2 - cx) * this.zoomK * 0.35, -cy + (H / 2 - cy) * this.zoomK * 0.35);
    }
    const a = this.img('sign_plate'), b = this.img('sign_plate_on');
    if (a) ctx.drawImage(a, 0, 0, W, H); else { ctx.fillStyle = '#6b5a44'; ctx.fillRect(0, 0, W, H); }
    if (b && this.save.flag('VIL_SIGNS_FIXED')) ctx.drawImage(b, 0, 0, W, H);
    if (this.backdrop) { this.backdrop.drawPlaced(ctx, this.backdrop.signs, 0, 1); this.backdrop.drawPlaced(ctx, this.backdrop.ctrl, 1, 1); }
    this.tiko.draw(ctx);
    this.drawPlazaBoard(ctx);
    for (const c of this.ctrl.pendingCards ? this.ctrl.pendingCards() : []) if (this.phase === 'collect') this.drawGroundCard(ctx, c);
    this.neo.draw(ctx);
    for (const f of this.fx) if (f.kind === 'fly') this.drawFly(ctx, f);
    ctx.restore();
    if (this.zoomK != null) { ctx.fillStyle = `rgba(22,16,10,${this.zoomK * 0.9})`; ctx.fillRect(0, 0, W, H); }
  }
  /** The board standing in the square: tilted and empty while broken; upright with its four rows once rebuilt. */
  drawPlazaBoard(ctx) {
    const im = this.img('w01_board'), m = this.sprites.m && this.sprites.m.w01_board;
    const fixed = this.save.flag(this.puzzle.world_state_on_solve) || (this.stageIdx === 1) || this.phase === 'match' || this.phase === 'sequence' || this.phase === 'done';
    const { x, foot, w } = PLAZA_BOARD, rot = fixed ? 0 : -0.075;
    ctx.save();
    ctx.fillStyle = 'rgba(30,18,8,0.32)'; ctx.beginPath(); ctx.ellipse(x, foot + 2, w * 0.46, 14, 0, 0, Math.PI * 2); ctx.fill();
    ctx.translate(x, foot); ctx.rotate(rot); ctx.translate(-x, -foot);
    const g = this.boardGlow.value;
    let box = null;
    if (im && m) {
      const [x0, y0, x1, y1] = m.bbox, sw = x1 - x0 + 1, sh = y1 - y0 + 1, h = w * sh / sw;
      box = { x: x - w / 2, y: foot - h, w, h };
      ctx.drawImage(im, x0, y0, sw, sh, box.x, box.y, w, h);
    }
    if (box) {
      const px0 = box.x + box.w * BOARD_F.px0, px1 = box.x + box.w * BOARD_F.px1, py0 = box.y + box.h * BOARD_F.py0, py1 = box.y + box.h * BOARD_F.py1;
      const rows = this.encRows || (this.stageIdx === 0 && this.phase !== 'collect' ? this.ctrl.rows : this.stageIdx === 1 ? this.puzzle.stages[0].answer_order : null);
      const shown = rows || this.stage.cards.map((c) => c.card_id).filter((c) => this.ctrl.collected.has(c) && !this.fx.some((f) => f.kind === 'fly' && f.card === c));
      const pitch = (py1 - py0 - 12) / 4, done = !!this.encRows;
      shown.forEach((c, i) => {                        // miniature rows: picture + plaque (+ tiny lines)
        const cy = py0 + 12 + pitch * (i + 0.5), cw = pitch * 0.62, key = cardOf(this.puzzle.stages[0], c);
        if (key) this.drawCardSprite(ctx, key.sprite, px1 - 6 - cw / 2, cy, cw, pitch * 0.86, 0);
        if (done || this.phase === 'sequence' || this.phase === 'done') {
          ctx.fillStyle = '#f3e2b8'; ctx.strokeStyle = '#8a5a26'; ctx.lineWidth = 1.2;
          const pw = (px1 - px0) - cw - 18; ctx.beginPath(); ctx.roundRect(px0 + 4, cy - pitch * 0.34, pw, pitch * 0.68, 3); ctx.fill(); ctx.stroke();
          ctx.strokeStyle = 'rgba(74,52,24,0.55)'; ctx.lineWidth = 1.4;
          for (const dy of [-0.12, 0.12]) { ctx.beginPath(); ctx.moveTo(px0 + pw - 2, cy + dy * pitch); ctx.lineTo(px0 + 12 + (dy > 0 ? pw * 0.3 : 0), cy + dy * pitch); ctx.stroke(); }
        }
      });
      if (done) { ctx.font = `800 ${Math.round(pitch * 0.34)}px ${FONT}`; }
    }
    ctx.restore();
    if (g > 0.01 && box) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const cy = foot - box.h * 0.55, R = w * 0.95;
      const gr = ctx.createRadialGradient(x, cy, 10, x, cy, R);
      gr.addColorStop(0, `rgba(255,222,150,${0.4 * g * (0.85 + 0.15 * Math.sin(this.t * 2.4))})`); gr.addColorStop(1, 'rgba(255,222,150,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, cy, R, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
  }
  drawGroundCard(ctx, c) {
    const g = GROUND[c], key = cardOf(this.stage, c), bob = Math.sin(this.t * 2 + g.x) * 0.02;
    ctx.save();
    ctx.fillStyle = 'rgba(30,18,8,0.3)'; ctx.beginPath(); ctx.ellipse(g.x, g.y + 2, 54, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.globalCompositeOperation = 'lighter';                   // a soft glint invites the tap
    const k = 0.5 + 0.5 * Math.sin(this.t * 3 + g.x * 0.01);
    const gr = ctx.createRadialGradient(g.x, g.y - 60, 4, g.x, g.y - 60, 95);
    gr.addColorStop(0, `rgba(255,236,170,${0.18 + 0.16 * k})`); gr.addColorStop(1, 'rgba(255,236,170,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(g.x, g.y - 60, 95, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    this.drawCardSprite(ctx, key.sprite, g.x, g.y - GROUND_CARD_W * 0.69, GROUND_CARD_W, GROUND_CARD_W * 1.37, g.rot + bob);
    ctx.restore();
  }
  drawFly(ctx, f) {
    const k = clamp01(f.t / 0.7), e = 1 - Math.pow(1 - k, 3), key = cardOf(this.stage, f.card);
    const tx = PLAZA_BOARD.x + 90, ty = PLAZA_BOARD.foot - 200;
    const x = lerp(f.x, tx, e), y = lerp(f.y - 60, ty, e) - Math.sin(k * Math.PI) * 180, w = lerp(GROUND_CARD_W, 34, e);
    this.drawCardSprite(ctx, key.sprite, x, y, w, w * 1.37, f.rot * (1 - e) + k * Math.PI * 2 * (reduceMotion ? 0 : 1));
  }
  drawCardSprite(ctx, id, cx, cy, w, h, rot = 0) {
    const im = this.img(id), m = this.sprites.m && this.sprites.m[id];
    ctx.save(); ctx.translate(cx, cy); if (rot) ctx.rotate(rot);
    if (im && m) { const [x0, y0, x1, y1] = m.bbox; ctx.drawImage(im, x0, y0, x1 - x0 + 1, y1 - y0 + 1, -w / 2, -h / 2, w, h); }
    else { ctx.fillStyle = '#f3e2b8'; ctx.strokeStyle = '#a0702c'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 8); ctx.fill(); ctx.stroke(); }
    ctx.restore();
  }

  // ---------------------------------------------------------------- close-up
  /** The square behind the board: zoomed in, blurred once into a cache and darkened. */
  drawBackdropBlur(ctx) {
    if (!this.bgCache) {
      const plate = this.img(this.save.flag('VIL_SIGNS_FIXED') && this.img('sign_plate_on') ? 'sign_plate_on' : 'sign_plate');
      let cv = null;
      try { cv = typeof document !== 'undefined' ? Object.assign(document.createElement('canvas'), { width: W / 2, height: H / 2 }) : new ctx.canvas.constructor(W / 2, H / 2); } catch (e) { cv = null; }
      if (cv && plate) {
        const c = cv.getContext('2d'), sx = plate.width / W, z = 2.1, cw = W / z, ch = H / z;
        const cx = Math.min(W - cw / 2, Math.max(cw / 2, PLAZA_BOARD.x + 180)), cy = Math.min(H - ch / 2, Math.max(ch / 2, PLAZA_BOARD.foot - 260));
        c.filter = 'blur(6px)';
        c.drawImage(plate._im || plate, (cx - cw / 2) * sx, (cy - ch / 2) * sx, cw * sx, ch * sx, -12, -12, W / 2 + 24, H / 2 + 24);
        this.bgCache = cv;
      } else this.bgCache = plate || 'none';
    }
    if (this.bgCache && this.bgCache !== 'none') ctx.drawImage(this.bgCache, 0, 0, W, H);
    else { ctx.fillStyle = '#5a4630'; ctx.fillRect(0, 0, W, H); }
    ctx.fillStyle = 'rgba(28,18,8,0.42)'; ctx.fillRect(0, 0, W, H);
    const v = ctx.createRadialGradient(W * 0.6, H * 0.45, 300, W * 0.6, H * 0.45, 1250);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(12,8,4,0.55)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  }
  drawBoardView(ctx) {
    this.drawBackdropBlur(ctx);
    // writing board (sentence tray) on the left, lying on the table: runs out of the bottom edge
    const tray = this.img('w01_tray');
    if (tray) { ctx.fillStyle = 'rgba(20,12,4,0.35)'; ctx.beginPath(); ctx.roundRect(TRAY.x0 + 205 * TRAY.s, TRAY.y0 + 60 * TRAY.s, 637 * TRAY.s, 960 * TRAY.s, 30); ctx.fill(); ctx.drawImage(tray, TRAY.x0 + 10, TRAY.y0 + 14, 1024 * TRAY.s, 1024 * TRAY.s); }
    this.drawBoardSprite(ctx);
    this.drawRows(ctx);
    this.drawTags(ctx);
    this.drawStar(ctx);
    this.drawLight(ctx);
    for (const id of this.ctrl.pendingPlaques()) if (!(this.drag && this.drag.kind === 'plaque' && this.drag.id === id)) this.drawTrayPlaque(ctx, id);
    this.drawStamp(ctx);
    for (const f of this.fx) this.drawFx(ctx, f);
    if (this.hintLine) this.drawHintLine(ctx);
    if (this.threads) this.drawThreads(ctx);
    if (this.drag && this.drag.kind === 'plaque' && this.drag.moved) { const p = this.plq[this.drag.id]; this.drawPlaque(ctx, this.drag.id, p.x.value, p.y.value, { lift: true }); }
  }
  drawBoardSprite(ctx) {
    const im = this.img('w01_board'), m = this.sprites.m && this.sprites.m.w01_board;
    if (im && m) { const [x0, y0, x1, y1] = m.bbox; ctx.drawImage(im, x0, y0, x1 - x0 + 1, y1 - y0 + 1, BOARD.x0, BOARD.y0, BOARD.w, bh); }
    else { ctx.fillStyle = '#c89048'; ctx.fillRect(PANEL.x0 - 30, PANEL.y0 - 30, PANEL.x1 - PANEL.x0 + 60, PANEL.y1 - PANEL.y0 + 60); ctx.fillStyle = '#fbeec8'; ctx.fillRect(PANEL.x0, PANEL.y0, PANEL.x1 - PANEL.x0, PANEL.y1 - PANEL.y0); }
    const g = this.boardGlow.value;
    // title band (engine text) + a thin painted rule under it
    ctx.save();
    ctx.fillStyle = '#5a3a14'; ctx.font = `800 36px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.direction = 'rtl';
    ctx.fillText(this.strings ? this.strings.t(this.stage.board_title_key) : '', (PANEL.x0 + PANEL.x1) / 2, PANEL.y0 + TITLE_H / 2 + 3);
    ctx.strokeStyle = 'rgba(140,94,40,0.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(PANEL.x0 + 18, PANEL.y0 + TITLE_H); ctx.lineTo(PANEL.x1 - 18, PANEL.y0 + TITLE_H); ctx.stroke();
    for (let i = 1; i < 4; i++) {                      // engraved row grooves
      const y = slotY(i);
      ctx.strokeStyle = 'rgba(150,104,48,0.28)'; ctx.lineWidth = 2; ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(PANEL.x0 + 14, y - PITCH / 2); ctx.lineTo(PANEL.x1 - 14, y - PITCH / 2); ctx.stroke();
    }
    ctx.restore();
  }
  /** Brass order tags ۱–۴ on the rail (UI «order 1–4»), drawn above the row pieces (KEEP_CLEAR rail_tags). */
  drawTags(ctx) {
    ctx.save();
    for (let i = 0; i < 4; i++) {
      const y = slotY(i);
      const pulse = this.introHint && i === 0 ? 1 + 0.18 * Math.sin(this.introHint.t * 7) : 1, r = 22 * pulse;
      const gr = ctx.createRadialGradient(RAIL_X - 6, y - 6, 2, RAIL_X, y, r);
      gr.addColorStop(0, '#fff0b8'); gr.addColorStop(0.55, '#d9a640'); gr.addColorStop(1, '#8a5e1c');
      ctx.fillStyle = gr; ctx.strokeStyle = '#5e3e12'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(RAIL_X, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#3e2608'; ctx.font = `800 ${Math.round(26 * pulse)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(faDigits(i + 1), RAIL_X, y + 2);
      if (i === 0 && this.ctrl.seqAssist) { ctx.fillStyle = '#5e3e12'; ctx.beginPath(); ctx.roundRect(RAIL_X - 9, y - r - 16, 18, 13, 3); ctx.fill(); ctx.strokeStyle = '#5e3e12'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(RAIL_X, y - r - 16, 6, Math.PI, 0); ctx.stroke(); }
    }
    ctx.restore();
  }
  drawStar(ctx) {
    ctx.save();
    // the stamped star
    if (this.starT !== null && this.starT !== undefined) {
      const k = clamp01((this.t - this.starT) / 0.25);
      ctx.save(); ctx.translate(STAR.x, STAR.y); ctx.scale(0.6 + 0.4 * k, 0.6 + 0.4 * k); ctx.globalAlpha = k;
      ctx.fillStyle = '#b8431c'; this.starPath(ctx, 0, 0, 24, 10); ctx.fill();
      ctx.strokeStyle = 'rgba(184,67,28,0.6)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }
  drawLight(ctx) {
    const g = this.boardGlow.value;
    if (g > 0.01) {                                  // the board lights up (card Animation): warm wash + rim light + lamp-like bloom
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const cx = (PANEL.x0 + PANEL.x1) / 2, cy = (PANEL.y0 + PANEL.y1) / 2;
      const gr = ctx.createRadialGradient(cx, cy, 40, cx, cy, 700);
      gr.addColorStop(0, `rgba(255,226,150,${0.34 * g})`); gr.addColorStop(1, 'rgba(255,226,150,0)');
      ctx.fillStyle = gr; ctx.fillRect(PANEL.x0 - 200, PANEL.y0 - 200, PANEL.x1 - PANEL.x0 + 400, PANEL.y1 - PANEL.y0 + 400);
      ctx.strokeStyle = `rgba(255,214,120,${0.55 * g * (0.8 + 0.2 * Math.sin(this.t * 3))})`; ctx.lineWidth = 14;
      ctx.beginPath(); ctx.roundRect(PANEL.x0 - 6, PANEL.y0 - 6, PANEL.x1 - PANEL.x0 + 12, PANEL.y1 - PANEL.y0 + 12, 10); ctx.stroke();
      ctx.restore();
    }
  }
  starPath(ctx, x, y, R, r) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r : R; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    ctx.closePath();
  }
  drawRows(ctx) {
    const seq = this.phase === 'sequence' || this.phase === 'done';
    const carrying = this.drag && this.drag.kind === 'plaque' && this.drag.moved ? this.drag.id : null;
    const near = carrying ? this.rowAt(this.plq[carrying].y.value, this.plq[carrying].x.value) : null;
    const allowed = carrying && this.ctrl.assist ? (() => { const p = plaqueOf(this.stage, carrying); return [p.subject, p.traps.length ? p.traps[0].card : null]; })() : null;
    const order = this.ctrl.rows.slice().sort((a, b) => (this.drag && this.drag.card === a ? 1 : 0) - (this.drag && this.drag.card === b ? 1 : 0));
    for (const c of order) {
      const y = this.rowY[c].value, a = this.anim['row_' + c] || {}, ac = this.anim['card_' + c] || {};
      const sh = (a.shake > 0 ? Math.sin(a.shake * 40) * 10 * a.shake : 0) + (ac.shake > 0 ? Math.sin(ac.shake * 36) * 6 * ac.shake : 0);
      const lifted = this.drag && this.drag.kind === 'row' && this.drag.card === c && this.drag.moved;
      const dim = allowed && !allowed.includes(c);
      ctx.save(); ctx.globalAlpha = dim ? 0.4 : 1; ctx.translate(sh, lifted ? -6 : 0);
      if (seq) {                                   // the row is one piece on the rail: honey backing plank + brass runner
        const x0 = PLQ_X - PLQ.w / 2 - 12, x1 = RAIL_X - 4, top = y - PITCH / 2 + 5, h = PITCH - 10;
        if (lifted) { ctx.fillStyle = 'rgba(20,10,2,0.35)'; ctx.beginPath(); ctx.roundRect(x0 + 8, top + 14, x1 - x0, h, 12); ctx.fill(); }
        const gr = ctx.createLinearGradient(0, top, 0, top + h);
        gr.addColorStop(0, '#d9a55a'); gr.addColorStop(1, '#a8702e');
        ctx.fillStyle = gr; ctx.strokeStyle = '#6e4618'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.roundRect(x0, top, x1 - x0, h, 12); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#c99a3c'; ctx.beginPath(); ctx.roundRect(x1 - 18, y - 16, 22, 32, 6); ctx.fill(); ctx.strokeStyle = '#6e4618'; ctx.stroke();
        if (a.warn > 0) { ctx.strokeStyle = `rgba(230,120,40,${Math.min(1, a.warn) * 0.9})`; ctx.lineWidth = 6; ctx.beginPath(); ctx.roundRect(x0 - 3, top - 3, x1 - x0 + 6, h + 6, 14); ctx.stroke(); }
        if (a.lock > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,236,170,${a.lock})`; ctx.beginPath(); ctx.roundRect(x0, top, x1 - x0, h, 12); ctx.fill(); ctx.restore(); }
        if (this.hl.intro && this.introHint && this.stage.answer_order[0] === c) {
          ctx.save(); ctx.strokeStyle = `rgba(255,190,60,${0.75 + 0.25 * Math.sin(this.t * 6)})`; ctx.lineWidth = 8;
          ctx.beginPath(); ctx.roundRect(x0 - 4, top - 4, x1 - x0 + 8, h + 8, 14); ctx.stroke(); ctx.restore();
        }
      } else if (!this.ctrl.joined[c]) {           // empty plaque slot: a dashed recess; glows while a plaque is carried over it
        const on = near !== null && this.ctrl.rows[near] === c;
        ctx.fillStyle = on ? 'rgba(255,220,130,0.45)' : 'rgba(120,80,30,0.12)';
        ctx.beginPath(); ctx.roundRect(PLQ_X - PLQ.w / 2, y - PLQ.h / 2, PLQ.w, PLQ.h, 12); ctx.fill();
        ctx.strokeStyle = on ? 'rgba(200,140,40,0.95)' : 'rgba(140,96,40,0.5)'; ctx.lineWidth = on ? 4 : 2.5; ctx.setLineDash([12, 9]);
        ctx.beginPath(); ctx.roundRect(PLQ_X - PLQ.w / 2, y - PLQ.h / 2, PLQ.w, PLQ.h, 12); ctx.stroke(); ctx.setLineDash([]);
      }
      const key = cardOf(this.stage, c);
      const cg = this.hintLine && this.hintLine.card === c;
      if (cg) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const gr = ctx.createRadialGradient(CARD_X, y, 4, CARD_X, y, 110); gr.addColorStop(0, `rgba(255,226,140,${0.55 + 0.2 * Math.sin(this.t * 5)})`); gr.addColorStop(1, 'rgba(255,226,140,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(CARD_X, y, 110, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
      this.drawCardSprite(ctx, key.sprite, CARD_X, y, CARD_W, CARD_H, 0);
      const pl = this.ctrl.joined[c];
      if (pl && !(this.drag && this.drag.kind === 'plaque' && this.drag.id === pl)) { const p = this.plq[pl]; this.drawPlaque(ctx, pl, p.x.value - sh, p.y.value - (lifted ? 0 : 0)); }
      ctx.restore();
    }
  }
  drawTrayPlaque(ctx, id) {
    const p = this.plq[id], foc = (this.card && this.card.plaque === id) || (this.hintShow && this.focus === id && this.phase === 'match');
    this.drawPlaque(ctx, id, p.x.value, p.y.value, { glow: foc ? 0.5 + 0.3 * Math.sin(this.t * 4) : 0 });
  }
  /** A sentence plaque (W01_ASSET_03 3-slice) with its sentence; marks: subject (match H2/H3), link words (sequence H2), intro (H3). */
  drawPlaque(ctx, id, cx, cy, o = {}) {
    const p = plaqueOf(this.stage, id), a = this.anim[id] || {};
    const k = 1 + Math.max(0, Math.sin(Math.max(0, a.pop || 0) / 0.35 * Math.PI)) * 0.06, w = PLQ.w * k, h = PLQ.h * k;
    const x = cx - w / 2, y = cy - h / 2 - (o.lift ? 8 : 0);
    ctx.save();
    ctx.fillStyle = `rgba(20,10,2,${o.lift ? 0.35 : 0.22})`; ctx.beginPath(); ctx.roundRect(x + 5, y + (o.lift ? 16 : 6), w, h, 12); ctx.fill();
    if (o.glow > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,220,140,${0.35 * o.glow})`; ctx.beginPath(); ctx.roundRect(x - 10, y - 10, w + 20, h + 20, 18); ctx.fill(); ctx.restore(); }
    const im = this.img('w01_plaque');
    if (im) {
      const S = PLQ_SRC, sh = S.y1 - S.y0 + 1, cap = Math.round(sh * PLQ_CAP), dc = h * PLQ_CAP;
      ctx.drawImage(im, S.x0, S.y0, cap, sh, x, y, dc, h);
      ctx.drawImage(im, S.x0 + cap, S.y0, (S.x1 - S.x0 + 1) - 2 * cap, sh, x + dc - 0.5, y, w - 2 * dc + 1, h);
      ctx.drawImage(im, S.x1 + 1 - cap, S.y0, cap, sh, x + w - dc, y, dc, h);
    } else { ctx.fillStyle = '#f6e7c2'; ctx.strokeStyle = '#8a5a26'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(x, y, w, h, 12); ctx.fill(); ctx.stroke(); }
    const marks = [];
    if (this.hl.subject.has(id)) marks.push(...p.subject_words);
    if (this.hl.links && p.link) marks.push(p.link.words);
    if (this.hl.intro) marks.push(...p.intro_words);
    const rowsLit = this.lumi.mode === 'rows' && this.ctrl.rows[this.lumi.rowI] === p.subject;
    this.drawText(ctx, p.text_fa, marks, x + 46 * k, y + h * 0.1, w - 92 * k, h * 0.8, 25 * k, rowsLit);
    ctx.restore();
  }
  drawText(ctx, text, marks, x, y, w, h, size0, lit = false) {
    let size = size0, L = null;
    ctx.save(); ctx.textBaseline = 'middle'; ctx.direction = 'rtl'; ctx.textAlign = 'right';
    while (size >= 14) { ctx.font = `700 ${size}px ${FONT}`; L = this.layoutText(ctx, text, marks, w); if (L.length * size * 1.32 <= h) break; size *= 0.92; }
    const lh = size * 1.32, top = y + h / 2 - ((L.length - 1) * lh) / 2, cx = x + w / 2;
    if (lit) { ctx.fillStyle = 'rgba(255,244,200,0.6)'; ctx.beginPath(); ctx.roundRect(x - 10, y, w + 20, h, 10); ctx.fill(); }
    for (const wd of L.words) {
      const xr = cx + L.lineW[wd.line] / 2 + wd.x, yy = top + wd.line * lh;
      if (wd.key) { ctx.fillStyle = `rgba(255,200,80,${0.6 + 0.15 * Math.sin(this.t * 3)})`; ctx.beginPath(); ctx.roundRect(xr - wd.w - 5, yy - size * 0.66, wd.w + 10, size * 1.32, 8); ctx.fill(); }
      ctx.fillStyle = wd.key ? '#4a2a06' : '#3e2c14'; ctx.fillText(wd.t, xr, yy);
      wd.cx = xr - wd.w / 2; wd.cy = yy;
    }
    ctx.restore();
    return L;
  }
  layoutText(ctx, text, marks, maxW) {
    const flags = []; for (const seg of markSegments(text, marks)) for (const _ of seg.t) flags.push(seg.key);
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
    return { words: out, lineW, width: Math.max(...lineW), length: line + 1 };
  }
  drawStamp(ctx) {
    const s = this.stamp;
    if (!s) return;
    const im = this.img('w01_stamp'), m = this.sprites.m && this.sprites.m.w01_stamp;
    const fly = s.fly || 0, e = fly * fly * (3 - 2 * fly);
    const x = lerp(s.x, STAR.x, e), yFoot = lerp(s.y.value, STAR.y + 30, e) - Math.sin(fly * Math.PI) * 160 + (s.press || 0) * 14;
    const h = STAMP.h * lerp(1, 0.7, e);
    ctx.save();
    if (!s.busy && this.phase === 'sequence') {    // invites the tap
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const gr = ctx.createRadialGradient(x, yFoot - h * 0.5, 4, x, yFoot - h * 0.5, 130);
      gr.addColorStop(0, `rgba(255,226,150,${0.25 + 0.12 * Math.sin(this.t * 3)})`); gr.addColorStop(1, 'rgba(255,226,150,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, yFoot - h * 0.5, 130, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      ctx.fillStyle = 'rgba(20,10,2,0.3)'; ctx.beginPath(); ctx.ellipse(x, yFoot + 2, 50, 10, 0, 0, Math.PI * 2); ctx.fill();
    }
    if (im && m) { const [x0, y0, x1, y1] = m.bbox, sw = x1 - x0 + 1, shh = y1 - y0 + 1, w = h * sw / shh; ctx.drawImage(im, x0, y0, sw, shh, x - w / 2, yFoot - h, w, h); }
    else { ctx.fillStyle = '#c99a3c'; ctx.fillRect(x - 30, yFoot - h, 60, h); }
    ctx.restore();
  }
  drawFx(ctx, f) {
    if (f.kind === 'snap') {
      const k = f.t / 0.6; ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(255,230,160,${0.8 * (1 - k)})`; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.roundRect(f.x - PLQ.w / 2 - 12 * k * 3, f.y - PLQ.h / 2 - 12 * k * 3, PLQ.w + 72 * k, PLQ.h + 72 * k, 16); ctx.stroke(); ctx.restore();
    } else if (f.kind === 'ink') {
      const k = f.t / 1.2; ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 10; i++) { const a = i * 0.628 + 0.3, r = 30 + k * 90; ctx.fillStyle = `rgba(255,214,120,${0.8 * (1 - k)})`; ctx.beginPath(); ctx.arc(f.x + Math.cos(a) * r, f.y + Math.sin(a) * r, 5 * (1 - k) + 1, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    }
  }
  /** Match H3: dotted golden line from the plaque's subject word to the right picture. */
  drawHintLine(ctx) {
    const hlp = this.hintLine, p = this.plq[hlp.plaque]; if (!p) return;
    const x0 = p.x.value + PLQ.w / 2 - 20, y0 = p.y.value, x1 = CARD_X - CARD_W / 2 - 8, y1 = this.rowY[hlp.card].value;
    const a = Math.min(1, hlp.t / 0.4);
    ctx.save(); ctx.lineCap = 'round'; ctx.setLineDash([2, 16]); ctx.lineDashOffset = -this.t * 40;
    const path = () => { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.bezierCurveTo(x0 + 200, y0 - 160, x1 - 200, y1 - 160, x1, y1); };
    ctx.strokeStyle = `rgba(90,50,10,${0.55 * a})`; ctx.lineWidth = 13; path(); ctx.stroke();
    ctx.strokeStyle = `rgba(255,214,110,${a})`; ctx.lineWidth = 8; path(); ctx.stroke(); ctx.restore();
  }
  /** Sequence H2: from each link phrase a thread runs to the picture of the place it points back to. */
  drawThreads(ctx) {
    const a = Math.min(1, this.threads.t / 0.5) * (this.threads.t > 6 ? 7 - this.threads.t : 1);
    ctx.save(); ctx.setLineDash([2, 15]); ctx.lineCap = 'round'; ctx.lineDashOffset = -this.t * 30;
    for (const c of this.ctrl.rows) {
      const p = plaqueFor(this.stage, c); if (!p || !p.link || !p.link.refers_to) continue;
      const y0 = this.rowY[c].value, y1 = this.rowY[p.link.refers_to].value, x0 = PLQ_X + PLQ.w / 2 - 70, x1 = CARD_X;
      const ok = this.ctrl.rows.indexOf(p.link.refers_to) === this.ctrl.rows.indexOf(c) - 1;
      const bend = 90 + Math.abs(y1 - y0) * 0.25;
      const path = () => { ctx.beginPath(); ctx.moveTo(x0, y0 - 18); ctx.bezierCurveTo(x0 + bend, y0 - 18, x1 - 40 - bend * 0.3, y1 - CARD_H / 2 - 30, x1, y1 - CARD_H / 2 + 4); };
      ctx.strokeStyle = `rgba(70,40,8,${0.5 * a})`; ctx.lineWidth = 12; path(); ctx.stroke();
      ctx.strokeStyle = ok ? `rgba(110,200,90,${a})` : `rgba(240,130,40,${a})`; ctx.lineWidth = 7; path(); ctx.stroke();
    }
    ctx.restore();
  }
  drawSparks(ctx) {
    if (!this.sparks.length) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const s of this.sparks) { const a = Math.sin(Math.PI * s.t / s.life) * (0.6 + 0.4 * Math.sin(s.ph)); ctx.fillStyle = `rgba(255,226,150,${a})`; ctx.beginPath(); ctx.arc(s.x + Math.sin(s.ph) * 6, s.y, s.r, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }

  // ---------------------------------------------------------------- reading card (as P-01, plaque text)
  drawCard(ctx) {
    const c = this.card, p = plaqueOf(this.stage, c.plaque);
    const a = Math.min(1, c.t / 0.18), sc = 0.92 + 0.08 * a;
    ctx.save();
    ctx.fillStyle = `rgba(20,12,6,${0.32 * a})`; ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = a;
    ctx.translate(CARD.x, CARD.y); ctx.scale(sc, sc); ctx.translate(-CARD.x, -CARD.y);
    const x0 = CARD.x - CARD.w / 2, y0 = CARD.y - CARD.h / 2;
    const im = this.img('w01_plaque');
    if (im) {                                        // the plaque itself, seen up close (3-slice)
      const S = PLQ_SRC, sh = S.y1 - S.y0 + 1, cap = Math.round(sh * PLQ_CAP), dc = CARD.h * 0.5;
      ctx.drawImage(im, S.x0, S.y0, cap, sh, x0, y0, dc, CARD.h);
      ctx.drawImage(im, S.x0 + cap, S.y0, (S.x1 - S.x0 + 1) - 2 * cap, sh, x0 + dc - 0.5, y0, CARD.w - 2 * dc + 1, CARD.h);
      ctx.drawImage(im, S.x1 + 1 - cap, S.y0, cap, sh, x0 + CARD.w - dc, y0, dc, CARD.h);
    } else { ctx.fillStyle = '#f6e7c2'; ctx.fillRect(x0, y0, CARD.w, CARD.h); }
    const marks = [...(this.hl.subject.has(p.plaque_id) ? p.subject_words : [])];
    ctx.font = `700 54px ${FONT}`; ctx.textBaseline = 'middle';
    const L = this.layoutText(ctx, p.text_fa, marks, CARD.w - 300), lh = 84, top = CARD.y - 30 - ((L.length - 1) * lh) / 2;
    const words = []; this.cardWords = words;
    for (const wd of L.words) {
      const xr = CARD.x + L.lineW[wd.line] / 2 + wd.x, y = top + wd.line * lh;
      words.push({ x: xr, y, w: wd.w });
      if (wd.key) { ctx.fillStyle = `rgba(255,205,90,${0.55 + 0.15 * Math.sin(this.t * 3)})`; ctx.beginPath(); ctx.roundRect(xr - wd.w - 8, y - 36, wd.w + 16, 72, 14); ctx.fill(); }
      const lit = this.lumi.mode === 'read' && this.lumi.wordI !== undefined && words.length - 1 <= this.lumi.wordI;
      if (lit) { ctx.fillStyle = 'rgba(255,240,190,0.55)'; ctx.beginPath(); ctx.roundRect(xr - wd.w - 6, y + 26, wd.w + 12, 8, 4); ctx.fill(); }
      ctx.fillStyle = wd.key ? '#4a2a08' : '#3e2c14'; ctx.textAlign = 'right'; ctx.direction = 'rtl'; ctx.fillText(wd.t, xr, y);
    }
    const k = clamp01(c.t / this.puzzle.reading.audio_unlock_s), ready = k >= 1;
    ctx.globalAlpha = a * (ready ? 1 : 0.4);
    ctx.fillStyle = ready ? '#fbeec8' : '#e6d6b0'; ctx.strokeStyle = '#7a5a1c'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(LISTEN.x, LISTEN.y, LISTEN.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (!ready) { ctx.strokeStyle = '#c9a044'; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(LISTEN.x, LISTEN.y, LISTEN.r - 8, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2); ctx.stroke(); }
    SignsP01.prototype.drawSpeaker.call(this, ctx, LISTEN.x, LISTEN.y, 22, ready && c.playT !== undefined && this.t - c.playT < (c.playDur || 5));
    ctx.globalAlpha = a;
    ctx.fillStyle = '#fbeec8'; ctx.strokeStyle = '#7a5a1c'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(CLOSE.x, CLOSE.y, CLOSE.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#5e3a18'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(CLOSE.x - 12, CLOSE.y - 12); ctx.lineTo(CLOSE.x + 12, CLOSE.y + 12); ctx.moveTo(CLOSE.x + 12, CLOSE.y - 12); ctx.lineTo(CLOSE.x - 12, CLOSE.y + 12); ctx.stroke();
    ctx.restore();
  }
  drawLumi(ctx) {
    const lm = this.lumi, x = lm.p.x.value, y = lm.p.y.value;
    const pulse = 1 + 0.06 * Math.sin(this.t * 5) + (lm.mode === 'celebrate' ? 0.1 * Math.sin(this.t * 14) : 0);
    const small = lm.mode === 'read' || lm.mode === 'rows' ? 0.7 : 1;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y, 4, x, y, 90 * pulse * small);
    g.addColorStop(0, 'rgba(255,230,170,0.55)'); g.addColorStop(1, 'rgba(255,200,120,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 90 * pulse * small, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    const img = this.img('lumi_front'), s = 0.42 * pulse * small;
    if (img) ctx.drawImage(img, x - 128 * s, y - 128 * s, 256 * s, 256 * s);
  }
  objective() {
    const o = this.stage.objective_fa;
    return this.phase === 'collect' ? o.collect : this.phase === 'match' ? o.match : this.phase === 'done' ? o.done : o.sequence;
  }
  drawHud(ctx) {
    const S = this.sprites, text = this.objective();
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
    const pr = this.pressT || {}, done = this.phase === 'done';
    const canHint = this.view === 'board' && !done && !this.ended;
    drawHudButton(ctx, S, 'btn_hint', BTN.hint, BTN_R, { disabled: !canHint, available: canHint && this.hints.available, pressed: pr.hint, t: this.t });
    drawHudButton(ctx, S, 'btn_undo', BTN.undo, BTN_R, { disabled: done || this.ended || !this.ctrl.undoStack.length, pressed: pr.undo, t: this.t });
    drawHudButton(ctx, S, 'btn_reset', BTN.reset, BTN_R, { disabled: (done && !this.ended) || this.phase === 'collect', available: this.ended, pressed: pr.reset, t: this.t });
    const n = 4, filled = this.phase === 'collect' ? this.ctrl.collected.size : Object.keys(this.ctrl.joined).length;
    for (let k = 0; k < n; k++) {
      ctx.fillStyle = k < filled ? 'rgba(255,200,90,0.95)' : 'rgba(255,240,210,0.4)';
      ctx.beginPath(); ctx.arc(W / 2 - (n - 1) * 14 + k * 28, 128, 7, 0, Math.PI * 2); ctx.fill();
    }
    if (this.ended && this.onExit && !this.fade) drawExitArrow(ctx, EXIT, this.t, reduceMotion);
    if (this.fade) { ctx.fillStyle = `rgba(22,16,10,${(1 - this.fade.a) * 0.85})`; ctx.fillRect(0, 0, W, H); }
    if (this.leaving) { ctx.fillStyle = `rgba(20,12,6,${this.leaving.a})`; ctx.fillRect(0, 0, W, H); }
  }
  debugState() {
    return {
      puzzle: this.stage.puzzle_id, view: this.view, phase: this.phase, rows: this.ctrl.rows.join('>'),
      joined: Object.entries(this.ctrl.joined).map(([c, p]) => `${p}@${c}`).join(' ') || '-', collected: [...this.ctrl.collected].join(',') || '-',
      card: this.card ? this.card.plaque : '-', hint_match: this.hintsM.level, hint_seq: this.hintsS.level, available: this.hints.available,
      assist: this.ctrl.assist || this.ctrl.seqAssist, reorders: this.ctrl.reorders, flagged: [...this.misc.flagged].join(',') || '-',
      mastery: this.mastery.get(this.puzzle.concept_id), world: Object.keys(this.save.data.world).join(',') || '-', music_layers: this.audio.layers,
    };
  }
}
