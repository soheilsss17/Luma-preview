// LUMA — P-13 «درس آزاد» (VS version): the festival story board in the village square (VIL_PLAZA, area FESTIVAL_BOARD).
// Card PERSIAN-13 / plan 12 §1 row 6: «تختهٔ داستان جشن» with 6 slots — topic → idea → sentence. Open-ended but constrained:
// every coherent text is accepted (44 per topic, web/js/edu/story_rules.js); sentences without a shared topic are the
// wrong answer (FA_SEPARATE_SENTENCES_COHERENT), repeating an idea to have «more» is the second trap (WR_MORE_SENTENCES_BETTER).
//
// Flow: the square after W-01 (VIL_INTRO_BOARD_UP): the empty festival board stands over the old notice board → tap it →
//   camera move to the board close-up. Encounter: choose one of three topic word cards («نانوایی»، «فرش‌بافی»، «چای‌خانه»)
//   → its 8 sentence plaques come to the tray (6 own + 2 good sentences of other topics) → drag plaques into the five
//   sentence frames (top-down, no gaps; cards slide) → the engraving stamp «ثبت» → accepted text locks, the board lights.
//   Practice: the library (fixed topic, new sentences, no pictograms) → payoff in the square: the board in its festival
//   dressing, VIL_FESTIVAL_POSTER_UP.
// Hints: H1 LUMI circles the topic card; H2 the main sentence glows; H3 topic badges on every plaque + threads from the topic
//   card to the plaques that belong to it. Answer Assist after 3 wrong stamps: off-topic plaques leave (no mastery).
// Camera: the square face-on (plan 14 §4.1); the close-up is a strict face-on elevation (PROP_VILLAGE_BOARD camera).
import { drawHudButton, drawExitArrow, PRESS_S } from '../engine/hud.js';
import { MisconceptionEngine, HintEngine, MasteryEngine, AnalyticsQueue, SaveSlot } from '../edu/engines.js';
import { Spring, Spring2, Timeline, reduceMotion } from '../engine/motion.js';
import { RigActor } from '../engine/rig.js';
import { StoryBoardController } from '../puzzles/story_board.js';
import { cardOf, mainCard } from '../edu/story_rules.js';
import { SignsP01 } from './signs_p01.js';

export const W = 1920, H = 1080;
const FONT = 'LumaFa, Vazirmatn, Tahoma, sans-serif';
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => Math.max(0, Math.min(1, v));

// ---- square: the festival board stands exactly over the notice board painted in ENV_VIL_PLAZA (x ≈ 1440–1710, foot ≈ 864)
export const FEST_BOARD = { x: 1575, foot: 868, w: 352 };
export const NEO_X = 1090, TIKO_X = 1330, CHAR_GROUND = 1048;
// ---- close-up: PROP_VILLAGE_BOARD (1024² sprite) drawn at BOARD_S; frames measured on the final (art/prompts_used/batch_09.md)
export const BOARD_S = 1.45, BOARD_OX = 501, BOARD_OY = -140;
const bx = (px) => BOARD_OX + px * BOARD_S, by = (py) => BOARD_OY + py * BOARD_S;
export const TOPIC_FRAME = { x0: bx(202), y0: by(338), x1: bx(412), y1: by(622) };
TOPIC_FRAME.cx = (TOPIC_FRAME.x0 + TOPIC_FRAME.x1) / 2; TOPIC_FRAME.cy = (TOPIC_FRAME.y0 + TOPIC_FRAME.y1) / 2;
TOPIC_FRAME.w = TOPIC_FRAME.x1 - TOPIC_FRAME.x0; TOPIC_FRAME.h = TOPIC_FRAME.y1 - TOPIC_FRAME.y0;
const ROW_TOPS = [302, 377, 453, 529, 605], ROW_HPX = 59;
export const ROW = { x0: bx(468), x1: bx(832), h: ROW_HPX * BOARD_S };
ROW.cx = (ROW.x0 + ROW.x1) / 2; ROW.w = ROW.x1 - ROW.x0;
export const rowY = (i) => by(ROW_TOPS[i] + ROW_HPX / 2);
export const TITLE = { x: (bx(90) + bx(935)) / 2, y: by(262), w: 560, h: 50 };        // cream strip pinned on the top rail
export const BOARD_LEFT = bx(85);                                                    // left post of the board
export const STAR = { x: TOPIC_FRAME.cx, y: by(652) };                               // engraved under the topic frame
// ---- tray (W01_ASSET_04 writing board lying on the table, left) with the plaques at 0.8 of the frame size
export const TRAY = { x0: -205, y0: 73, s: 0.95, cx: 292 };
export const TRAY_K = 0.8;
export const trayY = (i) => 196 + i * 80;
export const TOPIC_CARD = { w: 172, h: 229, ys: [262, 520, 778] };                   // topic word cards in the tray (encounter)
export const STAMP = { x: 292, y: 1046, h: 222 };
export const CARD = { x: 960, y: 385, w: 1200, h: 380 };                             // Reading Card (same as P-01/W-01)
export const LISTEN = { x: CARD.x - CARD.w / 2 + 96, y: CARD.y + CARD.h / 2 - 78, r: 50 };
export const CLOSE = { x: CARD.x - CARD.w / 2 + 44, y: CARD.y - CARD.h / 2 + 44, r: 36 };
export const BTN = { hint: { x: 90, y: 90 }, undo: { x: 220, y: 90 }, reset: { x: 350, y: 90 } };
const BTN_R = 58;
const EXIT = { x: 1832, y: 985, r: 95 };
const PLQ_SRC = { x0: 31, y0: 315, x1: 735, y1: 451 };                  // w01_plaque bbox (768 px sprite), 3-slice ends
const PLQ_CAP = 0.72;
const PICTO = { BREAD: 'p13_picto_bread', CARPET: 'p13_picto_carpet', SAMOVAR: 'p13_picto_samovar', LIBRARY: 'p13_picto_library' };
const CARD_SPRITE = { BREAD: 'p13_card_bread', CARPET: 'p13_card_carpet', SAMOVAR: 'p13_card_samovar', LIBRARY: 'p13_card_library' };
// the card face's empty text band (PROP_WORD_CARD_SET final, 768×1024): x .115–.885, y .772–.922
const BAND = { x0: 0.115, x1: 0.885, y0: 0.772, y1: 0.922 };

export class StoryBoardP13 {
  constructor({ sprites, puzzle, audio, storage, debug, strings, onExit }) {
    Object.assign(this, { sprites, puzzle, audio, debug, strings, onExit });
    this.save = new SaveSlot(storage);
    this.mastery = new MasteryEngine(storage);
    this.analytics = new AnalyticsQueue(storage, puzzle.analytics_fields);
    this.tl = new Timeline();
    this.t = 0; this.attempt = 0; this.drag = null; this.fx = []; this.sparks = [];
    this.lumi = { p: new Spring2(1500, 600, { stiffness: 30, damping: 9 }), mode: 'follow' };
    this.boardGlow = new Spring(0, { stiffness: 6, damping: 5 });
    this.ended = false; this.bubble = null; this.card = null; this.view = 'plaza';
  }

  async load() {
    this.neo = await new RigActor({ id: 'NEO', scale: 0.2, x: NEO_X, groundY: CHAR_GROUND, face: 1 }).load();
    this.tiko = await new RigActor({ id: 'TIKO', scale: 0.12, x: TIKO_X, groundY: CHAR_GROUND - 20, face: 1 }).load();
    this.actors = [this.tiko, this.neo];
    const [e, p] = this.puzzle.stages.map((s) => this.save.puzzle(s.puzzle_id));
    this.encDone = e && e.solved ? e : null;
    if (p && p.solved) this.startStage(1, { finished: true });
    else if (e && e.solved) this.startStage(1, { direct: true });
    else this.startStage(0);
    if (this.save.flag(this.puzzle.world_state_on_solve)) this.boardGlow.set(1);
    return this;
  }

  // ================================================================= flow
  startStage(idx, { finished = false, direct = false } = {}) {
    this.stageIdx = idx; this.stage = this.puzzle.stages[idx];
    this.misc = new MisconceptionEngine(this.puzzle.misconceptions, this.puzzle.misconception_flag_threshold);
    this.hints = new HintEngine(this.stage.hints, this.stage.answer_assist);
    this.stageMaxHint = 0; this.stageAssisted = false; this.stageStart = this.t; this.attempt++;
    this.fx = []; this.anim = {}; this.bubble = null; this.card = null; this.drag = null; this.focus = null;
    this.hl = { main: false, pictos: false }; this.threads = null; this.warn = null; this.lumi.mode = 'follow';
    this.stamp = null; this.starT = null; this.readingStarted = false; this.readAccum = {};
    const hooks = {
      onTopic: (t) => this.onTopic(t), onPlace: (id, i) => this.onPlace(id, i), onRemove: (id, i) => this.onRemove(id, i),
      onMove: () => this.layout(), onFull: (id) => this.onFull(id), onWrong: (r) => this.onWrong(r), onSolved: (r) => this.onSolved(r),
    };
    this.ctrl = new StoryBoardController(this.puzzle, this.stage, hooks);
    this.plq = {}; this.topicPos = {};
    (this.stage.topics || []).forEach((tp, i) => { this.topicPos[tp.topic_id] = new Spring2(TRAY.cx, TOPIC_CARD.ys[i] || 520, { stiffness: 120, damping: 15 }); });
    if (this.ctrl.topic) this.initTray(true);
    if (finished) {
      const s = this.save.puzzle(this.stage.puzzle_id);
      this.ctrl.finishAll(); if (s && s.seq && s.seq.length) this.ctrl.seq = s.seq.slice();
      this.ended = true; this.view = 'plaza'; this.audio.setLayers(4); this.layout(true);
      return;
    }
    this.ended = false;
    this.view = idx === 0 ? 'plaza' : 'board';
    if (idx === 1 && this.ctrl.topic) {                // the library word card flies into the topic frame
      const tp = this.topicPos[this.ctrl.topic]; if (tp && !direct) { tp.set(TRAY.cx, -200); }
      if (tp) tp.to(TOPIC_FRAME.cx, TOPIC_FRAME.cy);
      if (!direct) this.tl.after(0.5, () => this.audio.snap());
      this.tl.after(direct ? 0 : 0.8, () => this.makeStamp());
    }
    this.audio.setLayers(idx === 0 ? 1 : 3);
    this.log('puzzle_start', {});
    this.recordMastery(false);
    this.save.setPuzzle(this.stage.puzzle_id, { solved: false, entered: new Date().toISOString() });
  }
  get phase() { return this.ctrl.phase; }
  /** Tray slots for the current tray order (compacts when Answer Assist removes the off-topic plaques). */
  traySlot(id) { return this.ctrl.tray.indexOf(id); }
  initTray(snap = false) {
    this.ctrl.tray.forEach((id, i) => {
      if (!this.plq[id]) this.plq[id] = snap ? new Spring2(TRAY.cx, trayY(i), { stiffness: 150, damping: 17 })
        : new Spring2(TRAY.cx - 720 - i * 70, trayY(i), { stiffness: 150, damping: 17 });   // slide in from the left edge, never over the buttons
      this.plq[id].to(TRAY.cx, trayY(i));
    });
  }
  /** Springs follow the controller: board plaques in their frames, the others back in the tray. */
  layout(snap = false, order = this.ctrl.seq, skip = null) {
    for (const id of this.ctrl.tray) {
      if (id === skip || !this.plq[id]) continue;
      const i = order.indexOf(id), x = i >= 0 ? ROW.cx : TRAY.cx, y = i >= 0 ? rowY(i) : trayY(this.traySlot(id));
      this.plq[id].to(x, y); if (snap) this.plq[id].set(x, y);
    }
    if (this.ctrl.topic && this.topicPos[this.ctrl.topic]) { const tp = this.topicPos[this.ctrl.topic]; tp.to(TOPIC_FRAME.cx, TOPIC_FRAME.cy); if (snap) tp.set(TOPIC_FRAME.cx, TOPIC_FRAME.cy); }
  }

  recordMastery(solved) {
    // card mastery = a short coherent text in a NEW setting → the library practice without Highlight (H2/H3) and without
    // Assist gives level 3; H1 (LUMI circles the topic) and the read-aloud are allowed.
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

  // ---------------------------------------------------------------- square → close-up
  boardHit(x, y) {
    const b = this.plazaBox(); return b && x > b.x - 20 && x < b.x + b.w + 20 && y > b.y - 20 && y < FEST_BOARD.foot + 10;
  }
  enterBoard() {
    if (this.view !== 'plaza' || this.ended || this.zoomK != null) return;
    this.audio.woodClick(); this.neo.play('happy', 'idle');
    this.log('puzzle_interaction', { action: 'board_opened' });
    this.zoomK = 0;
    this.tl.tween(0.8, (k) => { this.zoomK = k * k; }, () => {
      this.zoomK = null; this.view = 'board';
      this.fade = { a: 0 }; this.tl.tween(0.5, (k) => { this.fade.a = k; }, () => { this.fade = null; });
      this.audio.setLayers(2);
    });
  }

  // ---------------------------------------------------------------- topic
  onTopic(topic) {
    this.hints.onActivity();
    this.topicPos[topic].to(TOPIC_FRAME.cx, TOPIC_FRAME.cy);
    this.audio.snap(); this.tl.after(0.1, () => this.audio.thump());
    this.anim['topic'] = { pop: 0.35 };
    this.log('topic_chosen', { topic });
    this.tl.after(0.35, () => { this.initTray(); this.ctrl.tray.forEach((_, i) => this.tl.after(i * 0.06, () => this.audio.paper && i % 3 === 0 && this.audio.paper())); });
    this.tl.after(0.6, () => this.makeStamp());
  }
  makeStamp() { this.stamp = { y: new Spring(STAMP.y + 300, { stiffness: 90, damping: 12 }), x: STAMP.x, press: 0, busy: false }; this.stamp.y.target = STAMP.y; }
  chooseTopic(topic) { if (this.ctrl.chooseTopic(topic)) return true; const tp = this.topicPos[topic]; if (tp) this.backTopic(topic); return false; }
  backTopic(topic) { const i = this.stage.topics.findIndex((t) => t.topic_id === topic); this.topicPos[topic].to(TRAY.cx, TOPIC_CARD.ys[i]); }
  clearTopic() {
    const t = this.ctrl.topic;
    if (!this.ctrl.clearTopic()) return false;
    this.backTopic(t); this.stamp = null; this.audio.snap();
    for (const id of Object.keys(this.plq)) this.plq[id].to(TRAY.cx - 700, this.plq[id].y.target);
    this.tl.after(0.4, () => { if (this.phase === 'topic') this.plq = {}; });
    this.log('puzzle_interaction', { action: 'topic_changed', from: t });
    return true;
  }

  // ---------------------------------------------------------------- compose
  onPlace(id, i) {
    this.hints.onActivity(); this.layout();
    this.anim[id] = { pop: 0.35 };
    this.audio.snap(); this.tl.after(0.1, () => this.audio.thump());                                              // wood_snap
    this.fx.push({ kind: 'snap', x: ROW.cx, y: rowY(i), t: 0 });
    const c = cardOf(this.puzzle, id);
    this.log('sentence_created', { card_id: id, slot: i + 2, topic: this.ctrl.topic, on_topic: c.topic === this.ctrl.topic, count: this.ctrl.seq.length });
    if (this.focus === id) this.focus = null;
  }
  onRemove(id) { this.hints.onActivity(); this.layout(); this.audio.paper(); this.log('puzzle_interaction', { action: 'sentence_removed', card_id: id }); }
  onFull(id) {
    this.anim['board'] = { shake: 0.5 }; this.audio.woodClick();
    this.bubbleText(this.strings ? this.strings.t('feedback.P-13.full') : '', 3.2, true);
    this.log('puzzle_interaction', { action: 'board_full', card_id: id });
  }
  pressStamp() {
    const s = this.stamp;
    if (!s || s.busy || this.phase !== 'compose' || !this.ctrl.seq.length) { if (s && !this.ctrl.seq.length) this.anim['stamp'] = { shake: 0.4 }; return; }
    s.busy = true; this.hints.onActivity(); this.closeCard(); this.warn = null;
    this.audio.pickup();
    this.log('stamp_pressed', { seq: this.ctrl.seq.join('>'), count: this.ctrl.seq.length, revision_count: this.ctrl.revisions });
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
  onWrong(res) {
    const out = this.hints.onWrong();
    const { def, newlyFlagged } = this.misc.observe(res.rule);
    if (newlyFlagged) { this.log('misconception_flagged', { misconception: def.code, error_type: def.error_type }); this.hints.target(def.targeted_hint); }
    this.log('topic_consistency', { topic: this.ctrl.topic, topic_consistent: res.topicConsistent, rule: res.rule, cards: res.cards.join(','),
      error_type: def ? def.error_type : 'StructureError', misconception: def ? def.code : null, revision_count: this.ctrl.revisions });
    const fb = this.puzzle.feedback.find((f) => f.rule === res.rule);
    if (fb && this.strings) this.tl.after(0.3, () => this.bubbleText(this.strings.t(fb.text_key), 5.5, true));
    this.warn = { rule: res.rule, cards: res.cards.slice(), t: 0 };
    for (const id of res.cards) this.anim[id] = { shake: 0.9 };
    if (res.rule === 'main_not_first' && !res.cards.length) this.anim['row0'] = { warn: 1.8 };
    this.tl.after(0.1, () => { this.audio.woodClick(); this.audio.flicker(); });                                // soft_error
    if (out === 'assist') this.tl.after(1.4, () => {
      if (this.phase !== 'compose') return;
      const before = this.ctrl.tray.slice();
      const fromBoard = this.ctrl.enableAssist(); this.stageAssisted = true; this.audio.hint();
      const gone = before.filter((id) => !this.ctrl.tray.includes(id));
      for (const id of Object.keys(this.plq)) if (!this.ctrl.tray.includes(id)) this.fx.push({ kind: 'leave', id, x: this.plq[id].x.value, y: this.plq[id].y.value, t: 0 });
      this.layout();
      this.log('puzzle_interaction', { action: 'answer_assist', mode: this.stage.answer_assist.action, removed: gone.join(','), removed_from_board: fromBoard.join(',') });
    });
  }
  onSolved(res) {
    this.stageMaxHint = Math.max(this.stageMaxHint, this.hints.maxUsed);
    this.card = null; this.threads = null; this.warn = null; this.bubble = null; this.hl = { main: false, pictos: false };
    this.log('topic_consistency', { topic: this.ctrl.topic, topic_consistent: true, rule: 'ok', revision_count: this.ctrl.revisions });
    this.log('revision_count', { revision_count: this.ctrl.revisions, submits: this.ctrl.submits });
    this.log('puzzle_solved', { assisted: this.stageAssisted, topic: this.ctrl.topic, count: res.count, details: res.details, revision_count: this.ctrl.revisions });
    this.recordMastery(true);
    this.save.setPuzzle(this.stage.puzzle_id, { solved: true, hint_max: this.stageMaxHint, assisted: this.stageAssisted, topic: this.ctrl.topic, seq: this.ctrl.seq.slice() });
    this.starT = this.t;
    this.fx.push({ kind: 'ink', x: STAR.x, y: STAR.y, t: 0 });
    this.ctrl.seq.forEach((id, k) => this.tl.after(0.35 + k * 0.26, () => { this.anim[id] = { lock: 0.4 }; this.audio.thump(); }));
    this.tl.after(0.3 + this.ctrl.seq.length * 0.26 + 0.3, () => { this.boardGlow.target = 1; this.audio.gardenChime(4); this.audio.chime(); });
    if (this.stageIdx === 0) {
      this.encDone = { topic: this.ctrl.topic, seq: this.ctrl.seq.slice() };
      this.tl.after(2.4, () => { this.audio.motif(); this.audio.setLayers(2); this.lumi.mode = 'celebrate'; });
      this.tl.after(4.6, () => this.transition(() => { this.boardGlow.set(0); this.lumi.mode = 'follow'; this.startStage(1); }));
    } else {
      this.tl.after(3.2, () => this.transition(() => {                          // payoff in the square: VIL_FESTIVAL_POSTER_UP
        this.view = 'plaza'; this.boardGlow.set(1);
        this.save.setFlag(this.puzzle.world_state_on_solve);
        this.tl.after(0.4, () => {
          this.audio.bell(); this.audio.motif(); this.audio.setLayers(4); this.spawnSparks();
          this.neo.play('happy', 'idle'); this.tiko.play('happy', 'idle'); this.lumi.mode = 'celebrate';
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
    this.encDone = null;
    this.transition(() => { this.boardGlow.set(0); this.startStage(0); });
  }
  leave() {
    this.leaving = { a: 0 }; this.audio.pickup();
    this.log('room_exit', { to: 'next' });
    this.tl.tween(0.8, (k) => { this.leaving.a = k; }, () => this.onExit());
  }
  bubbleText(text, sec = 6, warn = false) {
    if (!text) return;
    const b = { text, t: 0, warn }; this.bubble = b; this.tl.after(sec, () => { if (this.bubble === b) this.bubble = null; });
  }

  // ================================================================= reading card
  openCard(id, source = 'tap') {
    if (this.card && this.card.id === id) return;
    this.closeCard();
    this.card = { id, t: 0 }; this.focus = id; this.audio.paper();
    if (!this.readingStarted) { this.readingStarted = true; this.log('reading_started', { card_id: id }); }
    this.log('plaque_inspected', { card_id: id, source });
  }
  closeCard() {
    if (!this.card) return;
    this.readAccum[this.card.id] = (this.readAccum[this.card.id] || 0) + this.card.t;
    this.audio.stopVoice && this.audio.stopVoice();
    this.card = null;
  }
  voiceReady() { return this.puzzle.reading.vo_status !== 'pending'; }
  listenReady() { return this.card && this.voiceReady() && this.card.t >= this.puzzle.reading.audio_unlock_s; }
  voUrl(key) { return `../unity/Assets/_Project/${this.puzzle.reading.audio_dir}/${key}.mp3`; }
  listen() {
    const c = cardOf(this.puzzle, this.card.id), card = this.card;
    card.playT = this.t; card.playDur = 5;
    const pr = this.audio.voice && this.audio.voice(this.voUrl(c.audio_key));
    if (pr && pr.then) pr.then((d) => { if (d > 0) card.playDur = d + 0.2; }).catch(() => {});
    this.log('audio_read', { card_id: c.card_id, audio_used: true, read_ms: Math.round(card.t * 1000) });
  }

  // ================================================================= hit tests
  plaqueBox(id, board) { const k = board ? 1 : TRAY_K; return { w: (ROW.w - 8) * k, h: (ROW.h - 2) * k }; }
  trayHit(x, y) {
    for (const id of this.ctrl.pending()) { const p = this.plq[id]; if (!p) continue; const b = this.plaqueBox(id, false); if (Math.abs(x - p.x.value) < b.w / 2 && Math.abs(y - p.y.value) < b.h / 2 + 4) return id; }
    return null;
  }
  boardPlaqueHit(x, y) {
    if (x < ROW.x0 - 10 || x > ROW.x1 + 10) return null;
    for (const id of this.ctrl.seq) { const p = this.plq[id]; if (p && Math.abs(y - p.y.value) < ROW.h / 2 + 4) return id; }
    return null;
  }
  /** Sentence frame under (x, y): -1 = not over the frames. */
  frameAt(x, y) {
    if (x < ROW.x0 - 90 || x > ROW.x1 + 60) return -1;
    let best = -1, bd = 1e9;
    for (let i = 0; i < 5; i++) { const d = Math.abs(y - rowY(i)); if (d < bd) { bd = d; best = i; } }
    return bd < ROW.h * 1.1 ? best : -1;
  }
  topicCardHit(x, y) {
    for (const [t, p] of Object.entries(this.topicPos)) {
      if (this.phase !== 'topic' && this.ctrl.topic !== t) continue;       // unchosen cards are gone from the tray
      const inFrame = this.ctrl.topic === t, w = inFrame ? TOPIC_FRAME.w : TOPIC_CARD.w, h = inFrame ? TOPIC_FRAME.h : TOPIC_CARD.h;
      if (Math.abs(x - p.x.value) < w / 2 && Math.abs(y - p.y.value) < h / 2) return t;
    }
    return null;
  }
  inTopicFrame(x, y) { return x > TOPIC_FRAME.x0 - 60 && x < TOPIC_FRAME.x1 + 60 && y > TOPIC_FRAME.y0 - 60 && y < TOPIC_FRAME.y1 + 60; }
  stampHit(x, y) { const s = this.stamp; return s && !s.busy && Math.abs(x - s.x) < 80 && y < s.y.value + 20 && y > s.y.value - STAMP.h - 10; }

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
      if (this.voiceReady() && Math.hypot(sx - LISTEN.x, sy - LISTEN.y) <= LISTEN.r) { if (this.listenReady()) this.listen(); return; }
      if (Math.abs(sx - CARD.x) < CARD.w / 2 && Math.abs(sy - CARD.y) < CARD.h / 2) return;
      this.closeCard();
    }
    if (this.view === 'plaza') {
      if (!this.ended && this.stageIdx === 0 && this.boardHit(sx, sy)) return this.enterBoard();
      for (const a of this.actors) if (a.hit(sx, sy + (a.lift || 0))) { a.play('happy', 'idle'); return; }
      return;
    }
    if (this.phase === 'done') { const id = this.boardPlaqueHit(sx, sy); if (id) this.openCard(id); return; }
    if (this.phase === 'topic' || (this.phase === 'compose' && !this.stage.fixed_topic && !this.ctrl.seq.length)) {
      const t = this.topicCardHit(sx, sy);
      if (t) { const p = this.topicPos[t]; this.drag = { kind: 'topic', id: t, ox: sx - p.x.value, oy: sy - p.y.value, moved: false }; return; }
    }
    if (this.phase !== 'compose') return;
    if (this.stampHit(sx, sy)) return this.pressStamp();
    if (this.stamp && this.stamp.busy) return;
    let id = this.trayHit(sx, sy), from = 'tray';
    if (!id) { id = this.boardPlaqueHit(sx, sy); from = 'board'; }
    if (id) { const p = this.plq[id]; this.drag = { kind: 'plaque', id, from, ox: sx - p.x.value, oy: sy - p.y.value, moved: false, pickT: this.t }; }
  }
  pointerMove(sx, sy) {
    const d = this.drag;
    if (!d) return;
    if (!d.moved && this.down && Math.hypot(sx - this.down.x, sy - this.down.y) > 12) {
      d.moved = true; this.closeCard();
      this.audio.paper();                                                                                          // paper_pickup
      if (d.kind === 'plaque') this.log('puzzle_interaction', { action: 'plaque_lifted', card_id: d.id, from: d.from });
    }
    if (!d.moved) return;
    if (d.kind === 'topic') { this.topicPos[d.id].set(sx - d.ox, sy - d.oy); return; }
    this.plq[d.id].set(sx - d.ox, sy - d.oy);
    const f = this.frameAt(sx, sy);                                                                                // live preview: cards make room
    if (f !== d.lastF) {
      d.lastF = f;
      const rest = this.ctrl.seq.filter((c) => c !== d.id);
      const order = f >= 0 && (rest.length < 5 || d.from === 'board') ? [...rest.slice(0, f), d.id, ...rest.slice(f)] : rest;
      this.layout(false, order, d.id);
      if (f >= 0) this.audio.tick(f);
    }
  }
  pointerUp(sx, sy) {
    const d = this.drag; this.drag = null;
    if (!d) return;
    if (d.kind === 'topic') {
      const p = this.topicPos[d.id];
      if (!d.moved) {                                               // tap: choose (or take back the chosen one while the board is empty)
        if (this.ctrl.topic === d.id) { this.clearTopic(); return; }
        if (this.phase === 'topic') this.chooseTopic(d.id);
        return;
      }
      if (this.inTopicFrame(p.x.value, p.y.value) && this.phase === 'topic') { this.chooseTopic(d.id); return; }
      if (this.ctrl.topic === d.id && !this.inTopicFrame(p.x.value, p.y.value)) { this.clearTopic(); return; }
      if (this.ctrl.topic === d.id) { this.layout(); return; }
      this.backTopic(d.id); return;
    }
    const x = sx ?? this.plq[d.id].x.value, y = sy ?? this.plq[d.id].y.value;
    if (!d.moved) { this.layout(); return this.openCard(d.id); }
    const f = this.frameAt(x, y);
    if (d.from === 'tray') {
      if (f >= 0) { const r = this.ctrl.place(d.id, f); if (r !== 'ok') this.layout(); }
      else this.layout();
    } else if (f >= 0) {
      if (!this.ctrl.move(d.id, Math.min(f, this.ctrl.seq.length - 1))) this.layout();
      else { this.audio.snap(); this.log('puzzle_interaction', { action: 'sentence_moved', card_id: d.id, to: f }); }
    } else if (x < BOARD_LEFT + 40) this.ctrl.remove(d.id);
    else this.layout();
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
      this.log('hint_used', { hint_level: h.level, phase: this.phase });
      this.showHint(h);
    } else if (name === 'undo') {
      if (busy || this.ended) return;
      if (this.ctrl.undo()) { this.layout(); this.audio.snap(); this.log('puzzle_interaction', { action: 'undo' }); }
    } else if (name === 'reset') {
      if (this.ended) return this.replay();
      if (busy) return;
      if (this.ctrl.reset()) { this.layout(); this.audio.snap(); this.log('puzzle_interaction', { action: 'reset' }); }
    }
  }
  showHint(h) {
    this.stageMaxHint = Math.max(this.stageMaxHint, h.level);
    this.closeCard();
    if (h.text_key && this.strings) this.bubbleText(this.strings.t(h.text_key), 6.5);
    if (h.audio_key && this.audio.voice && this.voiceReady()) this.audio.voice(this.voUrl(h.audio_key));
    if (h.level === 1) {                               // H1: LUMI circles the topic («درباره‌ی یک موضوع»)
      this.lumi.mode = 'circle'; this.lumi.readT = 0;
      this.tl.after(5.5, () => { if (this.lumi.mode === 'circle') this.lumi.mode = 'follow'; });
    } else if (h.level === 2) {                        // H2: the main sentence glows (where the text begins)
      this.hl.main = true; this.tl.after(8, () => { this.hl.main = false; });
    } else {                                           // H3: topic badges on every plaque + threads from the topic card
      this.hl.pictos = true; this.threads = { t: 0 };
    }
  }

  spawnSparks(n = 110) {
    if (reduceMotion) n = Math.round(n / 4);
    for (let i = 0; i < n; i++) this.sparks.push({ x: FEST_BOARD.x + (Math.random() - 0.5) * 700, y: 420 + Math.random() * 480, vy: -20 - Math.random() * 40,
      ph: Math.random() * 6.28, life: 2 + Math.random() * 3, t: 0, r: 2 + Math.random() * 3 });
  }

  // ================================================================= update
  update(dt) {
    if (this.pressT) for (const k in this.pressT) this.pressT[k] = Math.max(0, this.pressT[k] - dt);
    this.t += dt;
    this.tl.update(dt);
    if (!this.ended && !this.card && this.view === 'board' && this.phase !== 'done') this.hints.tick(dt);
    this.boardGlow.update(dt);
    const dr = this.drag && this.drag.moved ? this.drag : null;
    for (const [id, s] of Object.entries(this.plq)) if (!(dr && dr.kind === 'plaque' && dr.id === id)) s.update(dt);
    for (const [id, s] of Object.entries(this.topicPos)) if (!(dr && dr.kind === 'topic' && dr.id === id)) s.update(dt);
    if (this.stamp) this.stamp.y.update(dt);
    if (this.card) this.card.t += dt;
    if (this.bubble) this.bubble.t += dt;
    if (this.threads) this.threads.t += dt;
    if (this.warn) { this.warn.t += dt; if (this.warn.t > 3) this.warn = null; }
    for (const k in this.anim) { const a = this.anim[k]; for (const f of ['pop', 'shake', 'lock', 'warn']) if (a[f] > 0) a[f] -= dt; }
    for (const f of this.fx) f.t += dt;
    this.fx = this.fx.filter((f) => f.t < (f.kind === 'ink' ? 1.2 : f.kind === 'leave' ? 0.8 : 0.6));
    for (const s of this.sparks) { s.t += dt; s.y += s.vy * dt; s.ph += dt * 3; }
    this.sparks = this.sparks.filter((s) => s.t < s.life);
    if (this.view === 'plaza' && this.boardGlow.value > 0.8 && !reduceMotion && Math.random() < dt * 5) this.spawnSparks(1);
    for (const a of this.actors) a.update(dt);
    if (this.tiko.clip === 'idle') this.tiko.faceTowards(FEST_BOARD.x);
    if (this.neo.clip === 'idle') this.neo.faceTowards(FEST_BOARD.x);
    const lm = this.lumi;
    if (lm.mode === 'follow') {
      if (this.view === 'plaza') { const b = this.plazaBox(); if (b && !this.ended && this.stageIdx === 0) lm.p.to(b.x + b.w / 2 + Math.cos(this.t * 1.3) * 60, b.y - 50 + Math.sin(this.t * 2.1) * 16); else { const h = this.neo.headPoint(); lm.p.to(h.x + 70, h.y - 60 + Math.sin(this.t * 2.1) * 12); } }
      else if (this.card) lm.p.to(CARD.x + CARD.w / 2 + 70, CARD.y - 40 + Math.sin(this.t * 2.1) * 12);   // beside the card, never on the text
      else lm.p.to(TOPIC_FRAME.cx, TOPIC_FRAME.y0 - 70 + Math.sin(this.t * 2.1) * 12);
    } else if (lm.mode === 'circle') {                 // two slow loops around the topic card
      lm.readT += dt; const a = lm.readT * 2.3;
      lm.p.to(TOPIC_FRAME.cx + Math.cos(a) * (TOPIC_FRAME.w / 2 + 40), TOPIC_FRAME.cy + Math.sin(a) * (TOPIC_FRAME.h / 2 + 34));
    } else if (lm.mode === 'celebrate') {
      if (this.view === 'plaza') lm.p.to(FEST_BOARD.x - 120 + Math.cos(this.t * 1.6) * 330, 500 + Math.sin(this.t * 3.2) * 60);
      else lm.p.to(ROW.cx + Math.cos(this.t * 1.6) * 460, rowY(0) - 110 + Math.sin(this.t * 3.2) * 40);
    }
    if (reduceMotion && lm.mode !== 'celebrate' && lm.mode !== 'circle') lm.p.set(lm.p.x.target, lm.p.y.target);
    lm.p.update(dt);
  }

  // ================================================================= draw
  img(name) { return this.sprites.get(name); }
  meta(name) { return this.sprites.m && this.sprites.m[name]; }
  draw(ctx) {
    if (this.view === 'plaza' || this.zoomK != null) this.drawPlaza(ctx);
    else this.drawBoardView(ctx);
    this.drawSparks(ctx);
    if (this.card) this.drawCard(ctx);
    this.drawLumi(ctx);
    this.drawHud(ctx);
  }

  // ---------------------------------------------------------------- square
  plateName() { return this.img('plaza_restored') && this.save.flag('VIL_LAMPS_ON') ? 'plaza_restored' : 'plaza_plate'; }
  plazaBox() {
    const m = this.meta('p13_board'); if (!m) return { x: FEST_BOARD.x - FEST_BOARD.w / 2, y: FEST_BOARD.foot - FEST_BOARD.w, w: FEST_BOARD.w, h: FEST_BOARD.w };
    const [x0, y0, x1, y1] = m.bbox, sw = x1 - x0 + 1, sh = y1 - y0 + 1, w = FEST_BOARD.w, h = w * sh / sw;
    return { x: FEST_BOARD.x - w / 2, y: FEST_BOARD.foot - h, w, h, sx: w / sw, x0, y0 };
  }
  drawPlaza(ctx) {
    ctx.save();
    if (this.zoomK != null) {                          // camera move towards the board
      const b = this.plazaBox(), z = 1 + this.zoomK * 1.8, cx = FEST_BOARD.x, cy = b.y + b.h * 0.45;
      ctx.translate(cx, cy); ctx.scale(z, z); ctx.translate(-cx + (W / 2 - cx) * this.zoomK * 0.35, -cy + (H / 2 - cy) * this.zoomK * 0.35);
    }
    const p = this.img(this.plateName());
    if (p) ctx.drawImage(p, 0, 0, W, H); else { ctx.fillStyle = '#6b5a44'; ctx.fillRect(0, 0, W, H); }
    this.drawPlazaBoard(ctx);
    this.tiko.draw(ctx);
    this.neo.draw(ctx);
    ctx.restore();
    if (this.zoomK != null) { ctx.fillStyle = `rgba(22,16,10,${this.zoomK * 0.9})`; ctx.fillRect(0, 0, W, H); }
  }
  /** The festival board over the old notice board: empty until P-13; then the texts in miniature and, after the practice, its festival dressing. */
  drawPlazaBoard(ctx) {
    const done = this.save.flag(this.puzzle.world_state_on_solve) || this.ended;
    const im = this.img(done && this.img('p13_board_festival') ? 'p13_board_festival' : 'p13_board'), b = this.plazaBox();
    ctx.save();
    ctx.fillStyle = 'rgba(30,18,8,0.32)'; ctx.beginPath(); ctx.ellipse(FEST_BOARD.x, FEST_BOARD.foot + 2, b.w * 0.44, 12, 0, 0, Math.PI * 2); ctx.fill();
    if (im && b.sx) ctx.drawImage(im, b.x0, b.y0, b.w / b.sx, b.h / b.sx, b.x, b.y, b.w, b.h);
    else { ctx.fillStyle = '#c89048'; ctx.fillRect(b.x, b.y, b.w, b.h * 0.7); }
    if (b.sx) {                                        // miniature content in the frames (sprite px → square px)
      const q = (px, py) => [b.x + (px - b.x0) * b.sx, b.y + (py - b.y0) * b.sx];
      const text = done ? (this.stageIdx === 1 ? this.ctrl.seq : null) : (this.stageIdx === 0 ? this.ctrl.seq : this.encDone && this.encDone.seq);
      const topic = done ? (this.ctrl.topic) : (this.stageIdx === 0 ? this.ctrl.topic : this.encDone && this.encDone.topic);
      if (topic) { const [x0, y0] = q(202, 338), [x1, y1] = q(412, 622); this.drawSpriteBox(ctx, CARD_SPRITE[topic], (x0 + x1) / 2, (y0 + y1) / 2, x1 - x0, y1 - y0); }
      (text || []).forEach((_, i) => {
        const [x0, y0] = q(468, ROW_TOPS[i]), [x1, y1] = q(832, ROW_TOPS[i] + ROW_HPX);
        ctx.fillStyle = '#f3e2b8'; ctx.strokeStyle = '#8a5a26'; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(x0, y0, x1 - x0, y1 - y0, 2); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = 'rgba(74,52,24,0.55)'; ctx.lineWidth = 1.2;
        const cy = (y0 + y1) / 2; ctx.beginPath(); ctx.moveTo(x1 - 4, cy - 2); ctx.lineTo(x0 + 6, cy - 2); ctx.moveTo(x1 - 4, cy + 2.5); ctx.lineTo(x0 + (x1 - x0) * 0.4, cy + 2.5); ctx.stroke();
      });
    }
    // an invitation glint while the board waits for its text
    if (!done && this.stageIdx === 0 && this.phase === 'topic' && this.zoomK == null) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const k = 0.5 + 0.5 * Math.sin(this.t * 3), cx = b.x + b.w * 0.5, cy = b.y + b.h * 0.42;
      const gr = ctx.createRadialGradient(cx, cy, 6, cx, cy, b.w * 0.7);
      gr.addColorStop(0, `rgba(255,232,160,${0.16 + 0.14 * k})`); gr.addColorStop(1, 'rgba(255,232,160,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(cx, cy, b.w * 0.7, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    ctx.restore();
    const g = this.boardGlow.value;
    if (g > 0.01) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const cy = b.y + b.h * 0.45, R = b.w * 1.0;
      const gr = ctx.createRadialGradient(FEST_BOARD.x, cy, 10, FEST_BOARD.x, cy, R);
      gr.addColorStop(0, `rgba(255,222,150,${0.36 * g * (0.85 + 0.15 * Math.sin(this.t * 2.4))})`); gr.addColorStop(1, 'rgba(255,222,150,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(FEST_BOARD.x, cy, R, 0, Math.PI * 2); ctx.fill();
      if (done && b.sx) for (const px of [60, 964]) {                              // the two festival lanterns glow (engine light)
        const lx = b.x + (px - b.x0) * b.sx, ly = b.y + (330 - b.y0) * b.sx, r = 46 * (0.9 + 0.1 * Math.sin(this.t * 5 + px));
        const lg = ctx.createRadialGradient(lx, ly, 2, lx, ly, r); lg.addColorStop(0, `rgba(255,200,110,${0.7 * g})`); lg.addColorStop(1, 'rgba(255,200,110,0)');
        ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(lx, ly, r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
  }
  drawSpriteBox(ctx, id, cx, cy, w, h, rot = 0) {
    const im = this.img(id), m = this.meta(id);
    ctx.save(); ctx.translate(cx, cy); if (rot) ctx.rotate(rot);
    if (im && m && m.bbox) { const [x0, y0, x1, y1] = m.bbox; ctx.drawImage(im, x0, y0, x1 - x0 + 1, y1 - y0 + 1, -w / 2, -h / 2, w, h); }
    else if (im) ctx.drawImage(im, -w / 2, -h / 2, w, h);
    else { ctx.fillStyle = '#f3e2b8'; ctx.strokeStyle = '#a0702c'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 8); ctx.fill(); ctx.stroke(); }
    ctx.restore();
  }

  // ---------------------------------------------------------------- close-up
  drawBackdropBlur(ctx) {
    if (!this.bgCache) {
      const plate = this.img(this.plateName());
      let cv = null;
      try { cv = typeof document !== 'undefined' ? Object.assign(document.createElement('canvas'), { width: W / 2, height: H / 2 }) : new ctx.canvas.constructor(W / 2, H / 2); } catch (e) { cv = null; }
      if (cv && plate) {
        const c = cv.getContext('2d'), sx = (plate._im || plate).width / W, z = 2.1, cw = W / z, ch = H / z;
        const cx = Math.min(W - cw / 2, Math.max(cw / 2, FEST_BOARD.x - 120)), cy = Math.min(H - ch / 2, Math.max(ch / 2, FEST_BOARD.foot - 220));
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
    const tray = this.img('w01_tray');
    if (tray) { ctx.fillStyle = 'rgba(20,12,4,0.35)'; ctx.beginPath(); ctx.roundRect(TRAY.x0 + 205 * TRAY.s + 10, TRAY.y0 + 60 * TRAY.s + 14, 637 * TRAY.s, 960 * TRAY.s, 30); ctx.fill(); ctx.drawImage(tray, TRAY.x0, TRAY.y0, 1024 * TRAY.s, 1024 * TRAY.s); }
    this.drawBoard(ctx);
    this.drawFrames(ctx);
    this.drawStar(ctx);
    this.drawLight(ctx);
    this.drawTopicCards(ctx);
    const dr = this.drag && this.drag.moved ? this.drag : null;
    for (const id of this.ctrl.seq) if (!(dr && dr.id === id)) this.drawPlaqueAt(ctx, id, true);
    for (const id of this.ctrl.pending()) if (!(dr && dr.id === id)) this.drawPlaqueAt(ctx, id, false);
    for (const f of this.fx) this.drawFx(ctx, f);
    this.drawStamp(ctx);
    if (this.threads) this.drawThreads(ctx);
    if (dr && dr.kind === 'plaque') { const p = this.plq[dr.id]; const on = this.frameAt(p.x.value + dr.ox, p.y.value + dr.oy) >= 0; this.drawPlaque(ctx, dr.id, p.x.value, p.y.value, on ? 1 : TRAY_K, { lift: true }); }
    if (dr && dr.kind === 'topic') { const p = this.topicPos[dr.id]; this.drawTopicCard(ctx, dr.id, p.x.value, p.y.value, TOPIC_CARD.w * 1.08, TOPIC_CARD.h * 1.08, true); }
  }
  drawBoard(ctx) {
    const im = this.img('p13_board'), a = this.anim.board || {};
    const sh = a.shake > 0 ? Math.sin(a.shake * 40) * 6 * a.shake : 0;
    ctx.save(); ctx.translate(sh, 0);
    if (im) ctx.drawImage(im, BOARD_OX, BOARD_OY, 1024 * BOARD_S, 1024 * BOARD_S);
    else { ctx.fillStyle = '#c89048'; ctx.fillRect(BOARD_LEFT, by(200), bx(935) - BOARD_LEFT, by(700) - by(200)); }
    // the title strip (engine text) pinned on the top rail
    ctx.fillStyle = 'rgba(40,24,8,0.3)'; ctx.beginPath(); ctx.roundRect(TITLE.x - TITLE.w / 2 + 4, TITLE.y - TITLE.h / 2 + 5, TITLE.w, TITLE.h, 8); ctx.fill();
    ctx.fillStyle = '#f6e8c4'; ctx.strokeStyle = '#8a5a26'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(TITLE.x - TITLE.w / 2, TITLE.y - TITLE.h / 2, TITLE.w, TITLE.h, 8); ctx.fill(); ctx.stroke();
    for (const dx of [-TITLE.w / 2 + 16, TITLE.w / 2 - 16]) { ctx.fillStyle = '#c99a3c'; ctx.beginPath(); ctx.arc(TITLE.x + dx, TITLE.y, 6, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#5a3a14'; ctx.font = `800 30px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.direction = 'rtl';
    ctx.fillText(this.strings ? this.strings.t(this.stage.board_title_key) : '', TITLE.x, TITLE.y + 2);
    ctx.restore();
  }
  /** Empty frames: a dashed glow where the carried card would land (the others make room). */
  drawFrames(ctx) {
    const dr = this.drag && this.drag.moved ? this.drag : null;
    const f = dr && dr.kind === 'plaque' ? this.frameAt(this.plq[dr.id].x.value + dr.ox, this.plq[dr.id].y.value + dr.oy) : -1;
    const n = this.ctrl.seq.filter((c) => !(dr && dr.id === c)).length;
    for (let i = 0; i < 5; i++) {
      const y = rowY(i), target = f >= 0 && Math.min(f, dr.from === 'board' ? n : n) === i;
      const pulse = (this.warn && this.warn.rule === 'too_few' && i >= n) || (this.anim.row0 && this.anim.row0.warn > 0 && i === 0);
      if (target || pulse) {
        ctx.save(); ctx.strokeStyle = target ? 'rgba(220,160,50,0.95)' : `rgba(230,120,40,${0.6 + 0.3 * Math.sin(this.t * 8)})`; ctx.lineWidth = 4; ctx.setLineDash([12, 9]);
        ctx.beginPath(); ctx.roundRect(ROW.x0 + 2, y - ROW.h / 2 + 2, ROW.w - 4, ROW.h - 4, 8); ctx.stroke(); ctx.restore();
      }
    }
    if (this.phase === 'topic') {                      // the topic frame invites the word card
      const k = 0.5 + 0.5 * Math.sin(this.t * 3);
      ctx.save(); ctx.strokeStyle = `rgba(220,160,50,${0.45 + 0.4 * k})`; ctx.lineWidth = 5; ctx.setLineDash([14, 10]);
      ctx.beginPath(); ctx.roundRect(TOPIC_FRAME.x0 + 4, TOPIC_FRAME.y0 + 4, TOPIC_FRAME.w - 8, TOPIC_FRAME.h - 8, 10); ctx.stroke(); ctx.restore();
    }
  }
  drawTopicCards(ctx) {
    const dr = this.drag && this.drag.moved && this.drag.kind === 'topic' ? this.drag.id : null;
    for (const tp of this.stage.topics || []) {
      const t = tp.topic_id, p = this.topicPos[t]; if (!p || t === dr) continue;
      if (this.phase !== 'topic' && this.ctrl.topic !== t) continue;
      const inFrame = this.ctrl.topic === t && Math.abs(p.x.value - TOPIC_FRAME.cx) < 30;
      const a = this.anim.topic || {}, k = inFrame ? 1 + Math.max(0, Math.sin(Math.max(0, a.pop || 0) / 0.35 * Math.PI)) * 0.05 : 1;
      const far = clamp01(Math.abs(p.x.value - TRAY.cx) / Math.max(1, TOPIC_FRAME.cx - TRAY.cx));
      const w = lerp(TOPIC_CARD.w, TOPIC_FRAME.w - 10, this.ctrl.topic === t ? far : 0) * k, h = lerp(TOPIC_CARD.h, TOPIC_FRAME.h - 10, this.ctrl.topic === t ? far : 0) * k;
      this.drawTopicCard(ctx, t, p.x.value, p.y.value, w, h, false);
    }
  }
  drawTopicCard(ctx, t, cx, cy, w, h, lift) {
    ctx.save();
    ctx.fillStyle = `rgba(20,10,2,${lift ? 0.35 : 0.22})`; ctx.beginPath(); ctx.roundRect(cx - w / 2 + 6, cy - h / 2 + (lift ? 16 : 7), w, h, 12); ctx.fill();
    if (this.phase === 'topic' && !lift) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,226,150,${0.12 + 0.08 * Math.sin(this.t * 3 + cy)})`; ctx.beginPath(); ctx.roundRect(cx - w / 2 - 10, cy - h / 2 - 10, w + 20, h + 20, 16); ctx.fill(); ctx.restore(); }
    this.drawSpriteBox(ctx, CARD_SPRITE[t], cx, cy, w, h);
    const tp = this.stage.topics.find((x) => x.topic_id === t);
    const word = tp ? (this.strings ? this.strings.t(tp.name_key) : tp.word_fa) : '';
    const bw = w * (BAND.x1 - BAND.x0), bh = h * (BAND.y1 - BAND.y0), bcy = cy - h / 2 + h * (BAND.y0 + BAND.y1) / 2;
    let size = Math.round(bh * 0.62);
    ctx.fillStyle = '#4a2e10'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.direction = 'rtl';
    ctx.font = `800 ${size}px ${FONT}`; while (size > 12 && ctx.measureText(word).width > bw * 0.9) { size -= 2; ctx.font = `800 ${size}px ${FONT}`; }
    ctx.fillText(word, cx, bcy + 1);
    ctx.restore();
  }
  drawPlaqueAt(ctx, id, board) {
    const p = this.plq[id]; if (!p) return;
    const onBoard = board && Math.abs(p.x.value - ROW.cx) < 60;
    const k = onBoard ? 1 : board ? lerp(TRAY_K, 1, clamp01(1 - Math.abs(p.x.value - ROW.cx) / (ROW.cx - TRAY.cx))) : lerp(TRAY_K, 1, clamp01((p.x.value - TRAY.cx) / (ROW.cx - TRAY.cx)));
    this.drawPlaque(ctx, id, p.x.value, p.y.value, k, {});
  }
  /** A sentence plaque (W01_ASSET_03, 3-slice) with its sentence; H2 glow on the main sentence, H3 topic badge on its left corner. */
  drawPlaque(ctx, id, cx, cy, k, o = {}) {
    const c = cardOf(this.puzzle, id), a = this.anim[id] || {};
    const pop = 1 + Math.max(0, Math.sin(Math.max(0, a.pop || 0) / 0.35 * Math.PI)) * 0.05;
    const w = (ROW.w - 8) * k * pop, h = (ROW.h - 2) * k * pop;
    const sh = a.shake > 0 ? Math.sin(a.shake * 40) * 10 * a.shake : 0;
    const x = cx - w / 2 + sh, y = cy - h / 2 - (o.lift ? 8 : 0);
    ctx.save();
    ctx.fillStyle = `rgba(20,10,2,${o.lift ? 0.35 : 0.22})`; ctx.beginPath(); ctx.roundRect(x + 5, y + (o.lift ? 16 : 6), w, h, 10); ctx.fill();
    const main = this.hl.main && this.ctrl.topic && mainCard(this.puzzle, this.ctrl.topic).card_id === id;
    const focus = (this.card && this.card.id === id);
    if (main || focus) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,214,110,${main ? 0.5 + 0.2 * Math.sin(this.t * 5) : 0.25})`; ctx.beginPath(); ctx.roundRect(x - 10, y - 10, w + 20, h + 20, 16); ctx.fill(); ctx.restore(); }
    const im = this.img('w01_plaque');
    if (im) {
      const S = PLQ_SRC, shh = S.y1 - S.y0 + 1, cap = Math.round(shh * PLQ_CAP), dc = h * PLQ_CAP;
      ctx.drawImage(im, S.x0, S.y0, cap, shh, x, y, dc, h);
      ctx.drawImage(im, S.x0 + cap, S.y0, (S.x1 - S.x0 + 1) - 2 * cap, shh, x + dc - 0.5, y, w - 2 * dc + 1, h);
      ctx.drawImage(im, S.x1 + 1 - cap, S.y0, cap, shh, x + w - dc, y, dc, h);
    } else { ctx.fillStyle = '#f6e7c2'; ctx.strokeStyle = '#8a5a26'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(x, y, w, h, 10); ctx.fill(); ctx.stroke(); }
    const warn = this.warn && this.warn.cards.includes(id);
    if (warn) { ctx.strokeStyle = `rgba(230,120,40,${0.9 * (1 - this.warn.t / 3)})`; ctx.lineWidth = 5; ctx.beginPath(); ctx.roundRect(x - 3, y - 3, w + 6, h + 6, 12); ctx.stroke(); }
    if (a.lock > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,236,170,${a.lock})`; ctx.beginPath(); ctx.roundRect(x, y, w, h, 10); ctx.fill(); ctx.restore(); }
    const pic = this.hl.pictos || this.stage.show_pictos;
    const badge = pic ? h * 0.72 : 0;
    this.drawText(ctx, c.text_fa, x + 34 * k + badge, y + h * 0.08, w - 68 * k - badge, h * 0.84, 24 * k);
    if (pic) this.drawSpriteBox(ctx, PICTO[c.topic], x + 18 * k + badge / 2, cy, badge, badge);
    ctx.restore();
  }
  drawText(ctx, text, x, y, w, h, size0) {
    let size = size0, L = null;
    ctx.save(); ctx.textBaseline = 'middle'; ctx.direction = 'rtl'; ctx.textAlign = 'right';
    while (size >= 13) { ctx.font = `700 ${size}px ${FONT}`; L = this.layoutText(ctx, text, w); if (L.length * size * 1.28 <= h) break; size *= 0.93; }
    const lh = size * 1.28, top = y + h / 2 - ((L.length - 1) * lh) / 2, cx = x + w / 2;
    ctx.fillStyle = '#3e2c14';
    for (const wd of L.words) ctx.fillText(wd.t, cx + L.lineW[wd.line] / 2 + wd.x, top + wd.line * lh);
    ctx.restore();
    return L;
  }
  layoutText(ctx, text, maxW) {
    const words = text.split(' ').filter(Boolean).map((t) => ({ t }));
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
  drawStar(ctx) {
    if (this.starT === null && this.phase !== 'done') return;
    const k = this.starT === null ? 1 : clamp01((this.t - this.starT) / 0.4);
    ctx.save(); ctx.globalAlpha = k;
    ctx.fillStyle = '#8a5a1c'; this.starPath(ctx, STAR.x, STAR.y, 22, 9); ctx.fill();
    ctx.fillStyle = 'rgba(255,220,130,0.9)'; this.starPath(ctx, STAR.x - 1.5, STAR.y - 1.5, 17, 7); ctx.fill();
    ctx.restore();
  }
  starPath(ctx, x, y, R, r) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r : R; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    ctx.closePath();
  }
  drawLight(ctx) {
    const g = this.boardGlow.value; if (g < 0.01) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const cx = (TOPIC_FRAME.x0 + ROW.x1) / 2, cy = (rowY(0) + rowY(4)) / 2, R = 720;
    const gr = ctx.createRadialGradient(cx, cy, 20, cx, cy, R);
    gr.addColorStop(0, `rgba(255,226,150,${0.28 * g})`); gr.addColorStop(1, 'rgba(255,226,150,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  drawStamp(ctx) {
    const s = this.stamp;
    if (!s) return;
    const im = this.img('w01_stamp'), m = this.meta('w01_stamp'), a = this.anim.stamp || {};
    const fly = s.fly || 0, e = fly * fly * (3 - 2 * fly);
    const sh = a.shake > 0 ? Math.sin(a.shake * 40) * 8 * a.shake : 0;
    const x = lerp(s.x, STAR.x, e) + sh, yFoot = lerp(s.y.value, STAR.y + 26, e) - Math.sin(fly * Math.PI) * 180 + (s.press || 0) * 14;
    const h = STAMP.h * lerp(1, 0.62, e);
    ctx.save();
    if (!s.busy && this.phase === 'compose' && this.ctrl.seq.length) {    // invites the tap once a sentence is on the board
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const gr = ctx.createRadialGradient(x, yFoot - h * 0.5, 4, x, yFoot - h * 0.5, 120);
      gr.addColorStop(0, `rgba(255,226,150,${0.25 + 0.12 * Math.sin(this.t * 3)})`); gr.addColorStop(1, 'rgba(255,226,150,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, yFoot - h * 0.5, 120, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    ctx.fillStyle = 'rgba(20,10,2,0.3)'; ctx.beginPath(); ctx.ellipse(x, yFoot + 2, 46, 9, 0, 0, Math.PI * 2); ctx.fill();
    if (im && m) { const [x0, y0, x1, y1] = m.bbox, sw = x1 - x0 + 1, shh = y1 - y0 + 1, w = h * sw / shh; ctx.drawImage(im, x0, y0, sw, shh, x - w / 2, yFoot - h, w, h); }
    else { ctx.fillStyle = '#c99a3c'; ctx.fillRect(x - 30, yFoot - h, 60, h); }
    ctx.restore();
  }
  drawFx(ctx, f) {
    if (f.kind === 'snap') {
      const k = f.t / 0.6; ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(255,226,150,${0.7 * (1 - k)})`; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.roundRect(ROW.x0 - k * 14, f.y - ROW.h / 2 - k * 10, ROW.w + k * 28, ROW.h + k * 20, 12); ctx.stroke(); ctx.restore();
    } else if (f.kind === 'ink') {
      const k = f.t / 1.2; ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 10; i++) { const a = i * 0.628 + 0.3, r = 30 + k * 90; ctx.fillStyle = `rgba(255,214,120,${0.8 * (1 - k)})`; ctx.beginPath(); ctx.arc(f.x + Math.cos(a) * r, f.y + Math.sin(a) * r, 5 * (1 - k) + 1, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    } else if (f.kind === 'leave') {                  // Answer Assist: an off-topic plaque drifts away and fades
      const k = clamp01(f.t / 0.8); ctx.save(); ctx.globalAlpha = 1 - k;
      this.drawPlaque(ctx, f.id, f.x - k * 260, f.y + k * 40, TRAY_K, {}); ctx.restore();
    }
  }
  /** H3: golden threads from the topic card to the badge of every plaque of its topic (through the gap, never over the text). */
  drawThreads(ctx) {
    const a = Math.min(1, this.threads.t / 0.5);
    const x0 = TOPIC_FRAME.x1 - 6, y0 = TOPIC_FRAME.cy;
    ctx.save(); ctx.setLineDash([2, 13]); ctx.lineCap = 'round'; ctx.lineDashOffset = -this.t * 30;
    for (const id of this.ctrl.seq) {
      const c = cardOf(this.puzzle, id), p = this.plq[id]; if (!p || c.topic !== this.ctrl.topic) continue;
      const h = ROW.h - 2, x1 = p.x.value - (ROW.w - 8) / 2 + 18 + h * 0.36, y1 = p.y.value;   // the badge centre
      const mx = (x0 + ROW.x0) / 2;
      const path = () => { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.bezierCurveTo(mx, y0, mx, y1, ROW.x0 - 4, y1); ctx.lineTo(x1 - h * 0.36, y1); };
      ctx.strokeStyle = `rgba(70,40,8,${0.5 * a})`; ctx.lineWidth = 10; path(); ctx.stroke();
      ctx.strokeStyle = `rgba(255,210,100,${a})`; ctx.lineWidth = 5; path(); ctx.stroke();
    }
    ctx.restore();
  }
  drawSparks(ctx) {
    if (!this.sparks.length) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const s of this.sparks) { const a = Math.sin(Math.PI * s.t / s.life) * (0.6 + 0.4 * Math.sin(s.ph)); ctx.fillStyle = `rgba(255,226,150,${a})`; ctx.beginPath(); ctx.arc(s.x + Math.sin(s.ph) * 6, s.y, s.r, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }

  // ---------------------------------------------------------------- reading card
  drawCard(ctx) {
    const cd = this.card, c = cardOf(this.puzzle, cd.id);
    const a = Math.min(1, cd.t / 0.18), sc = 0.92 + 0.08 * a;
    ctx.save();
    ctx.fillStyle = `rgba(20,12,6,${0.32 * a})`; ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = a;
    ctx.translate(CARD.x, CARD.y); ctx.scale(sc, sc); ctx.translate(-CARD.x, -CARD.y);
    const x0 = CARD.x - CARD.w / 2, y0 = CARD.y - CARD.h / 2;
    const im = this.img('w01_plaque');
    if (im) {
      const S = PLQ_SRC, sh = S.y1 - S.y0 + 1, cap = Math.round(sh * PLQ_CAP), dc = CARD.h * 0.5;
      ctx.drawImage(im, S.x0, S.y0, cap, sh, x0, y0, dc, CARD.h);
      ctx.drawImage(im, S.x0 + cap, S.y0, (S.x1 - S.x0 + 1) - 2 * cap, sh, x0 + dc - 0.5, y0, CARD.w - 2 * dc + 1, CARD.h);
      ctx.drawImage(im, S.x1 + 1 - cap, S.y0, cap, sh, x0 + CARD.w - dc, y0, dc, CARD.h);
    } else { ctx.fillStyle = '#f6e7c2'; ctx.fillRect(x0, y0, CARD.w, CARD.h); }
    this.drawText(ctx, c.text_fa, x0 + 150, CARD.y - 150, CARD.w - 300, 250, 56);
    if (this.voiceReady()) {
      const k = clamp01(cd.t / this.puzzle.reading.audio_unlock_s), ready = k >= 1;
      ctx.globalAlpha = a * (ready ? 1 : 0.4);
      ctx.fillStyle = ready ? '#fbeec8' : '#e6d6b0'; ctx.strokeStyle = '#7a5a1c'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(LISTEN.x, LISTEN.y, LISTEN.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if (!ready) { ctx.strokeStyle = '#c9a044'; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(LISTEN.x, LISTEN.y, LISTEN.r - 8, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2); ctx.stroke(); }
      SignsP01.prototype.drawSpeaker.call(this, ctx, LISTEN.x, LISTEN.y, 22, ready && cd.playT !== undefined && this.t - cd.playT < (cd.playDur || 5));
      ctx.globalAlpha = a;
    }
    ctx.fillStyle = '#fbeec8'; ctx.strokeStyle = '#7a5a1c'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(CLOSE.x, CLOSE.y, CLOSE.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#5e3a18'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(CLOSE.x - 12, CLOSE.y - 12); ctx.lineTo(CLOSE.x + 12, CLOSE.y + 12); ctx.moveTo(CLOSE.x + 12, CLOSE.y - 12); ctx.lineTo(CLOSE.x - 12, CLOSE.y + 12); ctx.stroke();
    ctx.restore();
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
  objective() {
    const o = this.stage.objective_fa;
    if (this.phase === 'done') return o.done;
    return this.phase === 'topic' ? o.topic : o.compose;
  }
  drawHud(ctx) {
    const S = this.sprites, text = this.objective();
    ctx.save();
    ctx.font = `700 38px ${FONT}`; ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = Math.min(ctx.measureText(text).width + 90, 1240);
    ctx.fillStyle = 'rgba(250,240,215,0.93)'; ctx.strokeStyle = 'rgba(150,110,50,0.8)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(W / 2 - w / 2, 34, w, 74, 20); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#4a3418'; ctx.fillText(text, W / 2, 73);
    if (this.bubble) {
      const a = Math.min(1, this.bubble.t / 0.3); ctx.globalAlpha = a;
      ctx.font = `700 34px ${FONT}`;
      const bw = ctx.measureText(this.bubble.text).width + 80, byy = this.card ? CARD.y + CARD.h / 2 + 30 : 138;
      ctx.fillStyle = 'rgba(255,248,226,0.97)'; ctx.strokeStyle = this.bubble.warn ? 'rgba(226,140,60,0.95)' : 'rgba(214,170,80,0.95)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.roundRect(W / 2 - bw / 2, byy, bw, 66, 33); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#5a3e14'; ctx.fillText(this.bubble.text, W / 2, byy + 34); ctx.globalAlpha = 1;
    }
    ctx.restore();
    const pr = this.pressT || {}, done = this.phase === 'done';
    const canHint = this.view === 'board' && !done && !this.ended;
    drawHudButton(ctx, S, 'btn_hint', BTN.hint, BTN_R, { disabled: !canHint, available: canHint && this.hints.available, pressed: pr.hint, t: this.t });
    drawHudButton(ctx, S, 'btn_undo', BTN.undo, BTN_R, { disabled: done || this.ended || !this.ctrl.undoStack.length, pressed: pr.undo, t: this.t });
    drawHudButton(ctx, S, 'btn_reset', BTN.reset, BTN_R, { disabled: (done && !this.ended) || (!this.ended && !this.ctrl.seq.length), available: this.ended, pressed: pr.reset, t: this.t });
    if (this.ended && this.onExit && !this.fade) drawExitArrow(ctx, EXIT, this.t, reduceMotion);
    if (this.fade) { ctx.fillStyle = `rgba(22,16,10,${(1 - this.fade.a) * 0.85})`; ctx.fillRect(0, 0, W, H); }
    if (this.leaving) { ctx.fillStyle = `rgba(20,12,6,${this.leaving.a})`; ctx.fillRect(0, 0, W, H); }
  }
  debugState() {
    return {
      puzzle: this.stage.puzzle_id, view: this.view, phase: this.phase, topic: this.ctrl.topic || '-', seq: this.ctrl.seq.join('>') || '-',
      tray: this.ctrl.pending().join(',') || '-', card: this.card ? this.card.id : '-', hint: this.hints.level, available: this.hints.available,
      assist: this.ctrl.assist, submits: this.ctrl.submits, revisions: this.ctrl.revisions, flagged: [...this.misc.flagged].join(',') || '-',
      mastery: this.mastery.get(this.puzzle.concept_id), world: Object.keys(this.save.data.world).join(',') || '-', music_layers: this.audio.layers,
    };
  }
}
