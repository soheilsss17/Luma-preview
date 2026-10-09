// LUMA — SOC-01 «من به دنیا آمدم» (VS row 7): Amir's house (VIL_HOUSE, area LIVING_TIMELINE).
// Source SOCIAL-01 (L11806–11830): the village time archive stopped and the pictures of a child's growth are mixed up →
// Drag → Timeline Snap; the cards move on the time rail; album, photo, timeline, clock, memory box; wrong = a newer event
// before an older one; H1 «کدام اتفاق زودتر رخ داده؟» H2 «به سن و مرحله زندگی دقت کن.» H3 «از تولد شروع کن و به امروز برس.»
// Textbook C307: lesson 1 (birth: the inked footprint, the name band, the birth certificate), lesson 2 p. 6 (Amir, 9, grade 3;
// the timeline runs LEFT = past → RIGHT = future, labels گذشته · حال · آینده).
//
// Flow: the living room after P-13. Encounter: tap the album on the low table → it opens, five picture cards rise → drag them
//   into the five slots of the wall timeline (a drop on an occupied slot swaps) → when the rail is full the brass time key
//   at its left end glows → turn it: the marker walks from birth towards today, one soft tick per card, and stops at the
//   first card that happened before its left neighbour (the pair wobbles). Right row → the mantel clock ticks again, the
//   memory box opens (the ink footprint of the day Amir was born) — VIL_HOUSE_CLOCK_TICKING.
//   Practice (the card's mastery: a NEW event set): more keepsakes from the memory box. Transfer: the plant on the window sill.
// Hints: H1 the pair where the marker stopped pulses (LUMI hovers between); H2 age tags on every card; H3 the card that
//   belongs to the first wrong slot from the left glows with a trail to its slot. Assist after 3 wrong checks: birth and
//   today lock at the ends (no mastery).
// Camera: the room face-on (plan 14 §4.1); the timeline is a face-on wall board (SOC01_ASSET_03 camera).
// Art: batch 11 (art/prompts_used/batch_11_soc01.md). Every sprite lookup falls back to an engine-drawn stand-in, so the
// room plays before the art exists and swaps automatically when build_web_assets.py adds the sprites.
import { drawHudButton, drawExitArrow, PRESS_S } from '../engine/hud.js';
import { MisconceptionEngine, HintEngine, MasteryEngine, AnalyticsQueue, SaveSlot } from '../edu/engines.js';
import { Spring, Spring2, Timeline, reduceMotion } from '../engine/motion.js';
import { RigActor } from '../engine/rig.js';
import { TimelineController } from '../puzzles/timeline.js';
import { eventOf, guideTarget } from '../edu/timeline_rules.js';
import { StoryBoardP13 } from './story_board_p13.js';
import { SignsP01 } from './signs_p01.js';

export const W = 1920, H = 1080;
const FONT = 'LumaFa, Vazirmatn, Tahoma, sans-serif';
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const ease = (k) => k * k * (3 - 2 * k);

// ---- the wall timeline (SOC01_ASSET_03): LEFT = past → RIGHT = the arrow head (future)
// Screen space = the ENV_VIL_HOUSE plate seen through the camera crop world x 384–1920, y 72–936 (zoom 1.25; see
// tools/build_web_assets.py CROPS): screen = ((x − 384)·1.25, (y − 72)·1.25). Anchors below are measured on the finals.
export const BOARD = { x0: 185, x1: 1255, y0: 190, y1: 464 };  // SOC01_ASSET_03 bbox (2355×603) scaled ×0.4544
export const SLOT_X = [374, 536, 698, 858, 1018], SLOT_Y = 320; // the painted slot centres (measured on the final)
export const CARD_W = 138, CARD_H = 184;                      // 3:4 card (SOC01_ASSET_02), covers the painted slot
export const RAIL_Y = 431, ARROW_TIP = 1255;
export const KEY = { x: 128, y: RAIL_Y, r: 42 };               // wind key beside the board's left end (stem into the board)
export const RAIL_X0 = 300, RAIL_X1 = 1089;                     // the painted brass rail (0.107–0.845 of the board bbox)
export const LABEL_Y = 500;
// ---- the room props (painted furniture in the plate: low table left, sideboard right, window over it)
export const TABLE = { x0: 90, x1: 470, y: 960 };              // stand-in only (no plate)
export const ALBUM = { x: 240, y: 945, w: 230 };               // bottom-centre on the painted low table (top front edge y≈951); both states foreshortened in build_web_assets.album_on_table
export const TRAY_Y = 640, TRAY_X = [110, 255, 400, 545, 690], TRAY_K = 0.9;
export const SHELF = { x0: 1308, x1: 1905, y: 790 };          // the painted sideboard (top y 700–840)
export const CLOCK = { x: 1370, y: 725, h: 185 };             // clock top 540 stays clear of the «آینده» label (≤530)
export const BOX = { x: 1760, y: 790, w: 170 };
export const WINDOW = { x0: 1445, x1: 1845, y0: 150, y1: 632 };
export const POT = { x: 1630, y: 632, h: 140 };               // bottom on the painted sill
export const NEO_X = 1150, TIKO_X = 1000, CHAR_GROUND = 1040;
export const CARD = { x: 960, y: 430, w: 1240, h: 420 };        // Reading Card
export const LISTEN = { x: CARD.x - CARD.w / 2 + 96, y: CARD.y + CARD.h / 2 - 78, r: 50 };
export const CLOSE = { x: CARD.x - CARD.w / 2 + 44, y: CARD.y - CARD.h / 2 + 44, r: 36 };
export const BTN = { hint: { x: 90, y: 90 }, undo: { x: 220, y: 90 }, reset: { x: 350, y: 90 } };
const BTN_R = 58;
export const EXIT = { x: 1832, y: 985, r: 95 };
// sprite windows on the card face (normalised; re-measured on the SOC01_ASSET_02 final)
const WIN = { x0: 0.103, x1: 0.89, y0: 0.089, y1: 0.722 }, BAND = { x0: 0.103, x1: 0.89, y0: 0.814, y1: 0.913 };
const SHEET = { soc01_life: { cols: 4, rows: 3 }, soc01_plant: { cols: 3, rows: 2 } };
const SOURCE = { album: () => ({ x: ALBUM.x, y: ALBUM.y - 40 }), memory_box: () => ({ x: BOX.x, y: BOX.y - 60 }), window_pot: () => ({ x: POT.x, y: POT.y - 60 }) };

export class TimelineSOC01 {
  constructor({ sprites, puzzle, audio, storage, debug, strings, onExit }) {
    Object.assign(this, { sprites, puzzle, audio, debug, strings, onExit });
    this.save = new SaveSlot(storage);
    this.mastery = new MasteryEngine(storage);
    this.analytics = new AnalyticsQueue(storage, puzzle.analytics_fields);
    this.tl = new Timeline();
    this.t = 0; this.attempt = 0; this.drag = null; this.fx = []; this.sparks = [];
    this.lumi = { p: new Spring2(1500, 600, { stiffness: 30, damping: 9 }), mode: 'follow' };
    this.albumOpen = new Spring(0, { stiffness: 40, damping: 9 });
    this.boxOpen = new Spring(0, { stiffness: 30, damping: 8 });
    this.bloom = new Spring(0, { stiffness: 12, damping: 6 });
    this.roomGlow = new Spring(0, { stiffness: 6, damping: 5 });
    this.clockRun = false; this.clockSec = 0; this.lastTick = 0;
    this.ended = false; this.bubble = null; this.card = null;
  }

  async load() {
    this.neo = await new RigActor({ id: 'NEO', scale: 0.2, x: NEO_X, groundY: CHAR_GROUND, face: -1 }).load();
    this.tiko = await new RigActor({ id: 'TIKO', scale: 0.12, x: TIKO_X, groundY: CHAR_GROUND - 20, face: -1 }).load();
    this.actors = [this.tiko, this.neo];
    const [e, p, t] = this.puzzle.stages.map((s) => this.save.puzzle(s.puzzle_id));
    if (e && e.solved) { this.clockRun = true; this.boxOpen.set(1); }
    if (t && t.solved) this.startStage(2, { finished: true });
    else if (p && p.solved) this.startStage(2, { direct: true });
    else if (e && e.solved) this.startStage(1, { direct: true });
    else { this.startStage(0); this.tl.after(0.8, () => this.bubbleText(this.str(this.puzzle.story.intro_key), 6)); }
    return this;
  }
  str(key) { return this.strings ? this.strings.t(key) : ''; }

  // ================================================================= flow
  startStage(idx, { finished = false, direct = false } = {}) {
    this.stageIdx = idx; this.stage = this.puzzle.stages[idx];
    this.misc = new MisconceptionEngine(this.puzzle.misconceptions, this.puzzle.misconception_flag_threshold);
    this.hints = new HintEngine(this.stage.hints, this.stage.answer_assist);
    this.stageMaxHint = 0; this.stageAssisted = false; this.stageStart = this.t; this.attempt++;
    this.fx = []; this.anim = {}; this.bubble = null; this.card = null; this.drag = null; this.warn = null; this.hover = -1;
    this.hl = { pair: null, ages: !!this.stage.show_age_tags, guide: false }; this.lumi.mode = 'follow';
    this.marker = { x: RAIL_X0, a: 0 }; this.keyRot = 0; this.readingStarted = false;
    const hooks = {
      onOpen: () => this.onOpen(), onDrop: (id, f, to, a) => this.onDrop(id, f, to, a), onFull: () => this.onFull(),
      onCheck: (r) => this.onCheck(r), onWrong: (r) => this.onWrong(r), onSolved: (r) => this.onSolved(r),
      onIncomplete: (r) => this.onIncomplete(r), onReject: (a, id) => this.onReject(a, id),
    };
    this.ctrl = new TimelineController(this.puzzle, this.stage, hooks);
    const src = SOURCE[this.stage.source_prop]();
    this.pos = {}; this.sc = {};
    for (const id of this.stage.events) { this.pos[id] = new Spring2(src.x, src.y, { stiffness: 120, damping: 15 }); this.sc[id] = new Spring(0.2, { stiffness: 120, damping: 14 }); }
    this.albumOpen.set(idx === 0 && (finished || direct) ? 1 : (idx === 0 ? 0 : 1));
    if (idx === 2) this.bloom.set(finished ? 1 : 0);
    if (finished) {
      this.ctrl.finishAll(); this.ended = true; this.clockRun = true; this.boxOpen.set(1); this.bloom.set(1);
      this.audio.setLayers(4); this.layout(true);
      return;
    }
    this.ended = false;
    if (direct) { this.ctrl.open(); this.layout(true); }
    this.audio.setLayers(idx === 0 ? 1 : idx === 1 ? 2 : 3);
    this.log('puzzle_start', {});
    this.recordMastery(false);
    this.save.setPuzzle(this.stage.puzzle_id, { solved: false, entered: new Date().toISOString() });
  }
  get phase() { return this.ctrl.phase; }
  slotPos(i) { return { x: SLOT_X[i], y: SLOT_Y }; }
  trayPos(i) { return { x: TRAY_X[i] ?? TRAY_X[TRAY_X.length - 1], y: TRAY_Y }; }
  /** Springs follow the controller: rail cards in their slots, the others in the tray over the album. */
  layout(snap = false, skip = null) {
    if (this.phase === 'closed') return;
    for (const id of this.stage.events) {
      if (id === skip) continue;
      const s = this.ctrl.slotOf(id), a = this.ctrl.album.indexOf(id);
      const p = s >= 0 ? this.slotPos(s) : this.trayPos(Math.max(0, a)), k = s >= 0 ? 1 : TRAY_K;
      this.pos[id].to(p.x, p.y); this.sc[id].target = k;
      if (snap) { this.pos[id].set(p.x, p.y); this.sc[id].set(k); }
    }
  }
  recordMastery(solved) {
    // card mastery = a timeline for a NEW event set → the practice without Highlight (H2/H3) and without Assist gives 3; H1 is allowed.
    const hl = this.puzzle.mastery.highlight_level || 2;
    const allowH1 = this.stage.stage !== 'encounter' && this.stageMaxHint < hl;
    const maxHint = allowH1 ? 0 : this.stageMaxHint;
    const lvl = this.mastery.record(this.puzzle.concept_id, { stage: this.stage.stage, solved, maxHint, assisted: this.stageAssisted }, this.puzzle.mastery);
    if (lvl !== null) this.log('mastery_updated', { level: lvl });
  }
  log(name, extra) {
    const e = this.analytics.log(name, {
      puzzle_id: this.stage.puzzle_id, attempt_id: this.attempt, duration: Math.round((this.t - this.stageStart) * 10) / 10,
      hint_level: this.hints ? this.hints.maxUsed : 0, reorder_count: this.ctrl ? this.ctrl.reorders : 0, ...extra,
    });
    if (this.debug) this.debug.push(e);
  }

  // ---------------------------------------------------------------- source prop → cards
  openSource() {
    if (this.phase !== 'closed' || this.ended || this.fade) return false;
    return this.ctrl.open();
  }
  onOpen() {
    this.hints.onActivity();
    const prop = this.stage.source_prop;
    this.log('puzzle_interaction', { action: 'source_opened', prop });
    if (prop === 'album') { this.audio.paper(); this.albumOpen.target = 1; this.tl.after(0.25, () => this.audio.pageFlutter && this.audio.pageFlutter()); }   // paper_flip
    else if (prop === 'memory_box') { this.audio.woodClick(); this.anim.box = { pop: 0.4 }; }
    else { this.audio.rustle ? this.audio.rustle() : this.audio.paper(); this.anim.pot = { pop: 0.4 }; }
    this.ctrl.album.forEach((id, i) => this.tl.after(0.25 + i * 0.12, () => {
      const p = this.trayPos(i); this.pos[id].to(p.x, p.y); this.sc[id].target = TRAY_K; if (i % 2 === 0) this.audio.paper();
    }));
    this.neo.play('happy', 'idle');
  }

  // ---------------------------------------------------------------- placing
  onDrop(id, from, to, action) {
    this.hints.onActivity(); this.layout(); this.warn = null;
    const ev = eventOf(this.puzzle, id);
    if (action === 'to_album') { this.audio.paper(); this.log('card_returned', { event_id: id, from_slot: from.i }); return; }
    this.anim[id] = { pop: 0.35 };
    this.audio.snap(); this.tl.after(0.1, () => this.audio.thump());                                                // wood_snap
    this.fx.push({ kind: 'snap', x: SLOT_X[to], y: SLOT_Y, t: 0 });
    if (from.kind === 'slot') this.log('card_moved', { event_id: id, from_slot: from.i, slot: to, swap: action === 'swap', reorder_count: this.ctrl.reorders });
    else this.log('card_placed', { event_id: id, slot: to, rank: ev.rank, swap: action === 'swap_album' });
  }
  onReject(action, id) {
    if (action === 'locked') { this.anim['lock' + (this.ctrl.slotOf(id) >= 0 ? this.ctrl.slotOf(id) : 0)] = { shake: 0.5 }; this.audio.woodClick(); }
    this.layout();
  }
  onFull() { this.anim.key = { pop: 0.6 }; this.audio.chime && this.tl.after(0.3, () => this.audio.tick(7)); }
  onIncomplete(res) {
    this.anim.key = { shake: 0.5 }; this.audio.woodClick();
    this.bubbleText(this.str('feedback.SOC-01.incomplete'), 3.4, true);
    this.row().forEach((c, i) => { if (!c) this.anim['empty' + i] = { warn: 1.6 }; });
    this.log('puzzle_interaction', { action: 'key_incomplete', empty: this.row().filter((c) => !c).length });
  }
  row() { return this.ctrl.row; }

  // ---------------------------------------------------------------- the time key and the marker
  keyHit(x, y) { return Math.hypot(x - KEY.x, y - KEY.y) <= KEY.r + 14; }
  turnKey() {
    if (this.phase !== 'place' || this.drag) return;
    this.hints.onActivity(); this.closeCard(); this.warn = null;
    this.ctrl.turnKey();
  }
  onCheck(res) {
    this.audio.windClick();
    this.log('timeline_checked', { order: this.row().join('>'), ok: res.ok, rule: res.rule, stop_slot: res.stopAt, inversions: res.inversions, checks: this.ctrl.checks });
    this.tl.tween(0.35, (k) => { this.keyRot = ease(k) * Math.PI / 2; });
    const step = reduceMotion ? 0.2 : 0.42;
    const walk = (k) => {                                     // k = the slot the marker walks to next
      const stop = !res.ok && k === res.stopAt;
      const tx = stop ? (SLOT_X[k - 1] + SLOT_X[k]) / 2 : (k < SLOT_X.length ? SLOT_X[k] : RAIL_X1 - 14);
      const x0 = this.marker.x;
      this.tl.tween(step, (q) => { this.marker.x = lerp(x0, tx, ease(q)); }, () => {
        if (stop) {                                           // time gets stuck between the swapped pair
          this.anim.marker = { shake: 0.7 }; this.audio.flicker();
          this.tl.after(0.5, () => this.ctrl.finishCheck());
          return;
        }
        if (k < SLOT_X.length) {
          this.audio.clockTick ? this.audio.clockTick(k % 2 === 1) : this.audio.tick(k);                          // soft_clock_tick
          this.anim[this.row()[k]] = { lock: 0.45 };
          walk(k + 1);
        } else this.tl.after(0.2, () => this.ctrl.finishCheck());
      });
    };
    walk(0);
  }
  onWrong(res) {
    const out = this.hints.onWrong();
    const { def, newlyFlagged } = this.misc.observe(res.rule);
    if (newlyFlagged) { this.log('misconception_flagged', { misconception: def.code, error_type: def.error_type }); this.hints.target(def.targeted_hint); }
    this.log('timeline_error', { rule: res.rule, pair: res.pair.join('>'), stop_slot: res.stopAt, inversions: res.inversions, order: this.row().join('>'),
      error_type: def ? def.error_type : 'SequenceError', misconception: def ? def.code : null, timeline_error: this.ctrl.errors });
    const fb = this.puzzle.feedback.find((f) => f.rule === res.rule);
    if (fb) this.tl.after(0.2, () => this.bubbleText(this.str(fb.text_key), 5.5, true));
    this.warn = { pair: res.pair.slice(), t: 0, rule: res.rule };
    for (const id of res.pair) this.anim[id] = { shake: 0.9 };
    if (this.hl.pair) this.hl.pair = res.pair.slice();
    this.tl.after(0.1, () => this.audio.woodClick());                                                               // soft_error
    this.tl.after(0.9, () => {                                // the marker slides home, the key turns back
      const x0 = this.marker.x; this.tl.tween(0.5, (k) => { this.marker.x = lerp(x0, RAIL_X0, ease(k)); this.keyRot = (1 - ease(k)) * Math.PI / 2; });
    });
    if (out === 'assist') this.tl.after(1.6, () => {
      if (this.phase !== 'place') return;
      if (!this.ctrl.enableAssist()) return;
      this.stageAssisted = true; this.audio.hint(); this.layout();
      this.anim.lock0 = { pop: 0.6 }; this.anim.lock4 = { pop: 0.6 };
      this.log('puzzle_interaction', { action: 'answer_assist', mode: this.stage.answer_assist.action });
    });
  }
  onSolved(res) {
    this.stageMaxHint = Math.max(this.stageMaxHint, this.hints.maxUsed);
    this.card = null; this.warn = null; this.bubble = null; this.hl = { pair: null, ages: this.hl.ages, guide: false };
    this.log('reorder_count', { reorder_count: this.ctrl.reorders, checks: this.ctrl.checks, placements: this.ctrl.placements });
    this.log('puzzle_solved', { assisted: this.stageAssisted, order: this.row().join('>'), checks: this.ctrl.checks, timeline_error: this.ctrl.errors });
    this.recordMastery(true);
    this.save.setPuzzle(this.stage.puzzle_id, { solved: true, hint_max: this.stageMaxHint, assisted: this.stageAssisted, checks: this.ctrl.checks });
    this.row().forEach((id, k) => this.tl.after(0.1 + k * 0.18, () => { this.anim[id] = { lock: 0.6 }; this.audio.tick(4 + k); }));
    this.tl.after(1.1, () => { this.roomGlow.target = 1; this.audio.chime(); this.audio.gardenChime && this.audio.gardenChime(4); });
    if (this.stageIdx === 0) {
      this.tl.after(1.6, () => {                              // the house clock ticks again; the memory box opens
        this.clockRun = true; this.boxOpen.target = 1; this.audio.bell(); this.audio.motif(); this.audio.setLayers(2);
        this.save.setFlag(this.puzzle.world_state_on_solve);
        this.spawnSparks(60, BOX.x, BOX.y - 80, 260);
        this.bubbleText(this.str(this.puzzle.story.payoff_key), 6.5);
        this.neo.play('happy', 'idle'); this.tiko.play('happy', 'idle'); this.lumi.mode = 'celebrate';
      });
      this.tl.after(8.4, () => this.transition(() => { this.roomGlow.set(0); this.lumi.mode = 'follow'; this.startStage(1); }));
    } else if (this.stageIdx === 1) {
      this.tl.after(1.6, () => { this.audio.motif(); this.lumi.mode = 'celebrate'; this.bubbleText(this.str(this.puzzle.story.practice_done_key) || this.stage.objective_fa.done, 4.2); });
      this.tl.after(5.0, () => this.transition(() => {
        this.roomGlow.set(0); this.lumi.mode = 'follow'; this.startStage(2);
        this.tl.after(0.6, () => this.bubbleText(this.str(this.puzzle.story.transfer_key), 5));
      }));
    } else {
      this.tl.after(1.6, () => {                              // the window plant blooms; the room is complete
        this.bloom.target = 1; this.audio.motif(); this.audio.setLayers(4);
        this.spawnSparks(90, POT.x, POT.y - 90, 300);
        this.bubbleText(this.str(this.puzzle.story.finale_key) || this.stage.objective_fa.done, 4.5);   // the header already shows objective_fa.done
        this.neo.play('happy', 'idle'); this.tiko.play('happy', 'idle'); this.lumi.mode = 'celebrate';
        this.tl.after(3.6, () => { this.lumi.mode = 'follow'; this.ended = true; });
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
    this.transition(() => { this.roomGlow.set(0); this.clockRun = false; this.boxOpen.set(0); this.bloom.set(0); this.startStage(0); });
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
    this.card = { id, t: 0 }; this.audio.paper();
    if (!this.readingStarted) { this.readingStarted = true; this.log('reading_started', { event_id: id }); }
    this.log('card_inspected', { event_id: id, source });
  }
  closeCard() { if (!this.card) return; this.audio.stopVoice && this.audio.stopVoice(); this.card = null; }
  /** VO per clip: 'ready' = every clip, 'partial' = only the keys in reading.vo_ready (10 clips per production turn), 'pending' = none. */
  voiceReady(key) {
    const r = this.puzzle.reading;
    if (r.vo_status === 'ready') return true;
    if (r.vo_status !== 'partial' || !key) return false;
    return (r.vo_ready || []).includes(key);
  }
  cardVoiceKey() { const e = this.card && eventOf(this.puzzle, this.card.id); return e ? e.audio_key : null; }
  listenReady() { return this.card && this.voiceReady(this.cardVoiceKey()) && this.card.t >= this.puzzle.reading.audio_unlock_s; }
  voUrl(key) { return `unity/Assets/_Project/${this.puzzle.reading.audio_dir}/${key}.mp3`; }
  listen() {
    const e = eventOf(this.puzzle, this.card.id), card = this.card;
    card.playT = this.t; card.playDur = 5;
    const pr = this.audio.voice && this.audio.voice(this.voUrl(e.audio_key));
    if (pr && pr.then) pr.then((d) => { if (d > 0) card.playDur = d + 0.2; }).catch(() => {});
    this.log('audio_read', { event_id: e.event_id, audio_used: true, read_ms: Math.round(card.t * 1000) });
  }

  // ================================================================= hit tests
  cardHit(x, y) {
    if (this.phase === 'closed') return null;
    const ids = [...this.ctrl.album.slice().reverse(), ...this.row().filter(Boolean)];
    for (const id of ids) {
      const p = this.pos[id], k = this.sc[id].value;
      if (Math.abs(x - p.x.value) < CARD_W * k / 2 + 4 && Math.abs(y - p.y.value) < CARD_H * k / 2 + 4) return id;
    }
    return null;
  }
  /** Slot under a dragged card: -1 = not over the rail. */
  slotAt(x, y) {
    if (y < BOARD.y0 - 60 || y > RAIL_Y + 70 || x < SLOT_X[0] - CARD_W * 0.8 || x > SLOT_X[4] + CARD_W * 0.8) return -1;
    let best = -1, bd = 1e9;
    SLOT_X.forEach((sx, i) => { const d = Math.abs(x - sx); if (d < bd) { bd = d; best = i; } });
    return bd < CARD_W * 0.75 ? best : -1;
  }
  sourceHit(x, y) {
    const p = this.stage.source_prop;
    if (p === 'album') return Math.abs(x - ALBUM.x) < ALBUM.w / 2 + 20 && y > ALBUM.y - 150 && y < ALBUM.y + 20;
    if (p === 'memory_box') return Math.abs(x - BOX.x) < BOX.w / 2 + 25 && y > BOX.y - 190 && y < BOX.y + 15;
    return Math.abs(x - POT.x) < 90 && y > POT.y - 200 && y < POT.y + 20;
  }

  // ================================================================= input
  pointerDown(sx, sy) {
    this.audio.unlock();
    this.hints.onActivity();
    for (const [name, b] of Object.entries(BTN)) if (Math.hypot(sx - b.x, sy - b.y) <= BTN_R) return this.button(name);
    if (this.fade || this.leaving) return;
    if (this.ended && this.onExit && Math.hypot(sx - EXIT.x, sy - EXIT.y) < EXIT.r) return this.leave();
    this.down = { x: sx, y: sy, t: this.t };
    if (this.card) {
      if (Math.hypot(sx - CLOSE.x, sy - CLOSE.y) <= CLOSE.r) return this.closeCard();
      if (this.voiceReady(this.cardVoiceKey()) && Math.hypot(sx - LISTEN.x, sy - LISTEN.y) <= LISTEN.r) { if (this.listenReady()) this.listen(); return; }
      if (Math.abs(sx - CARD.x) < CARD.w / 2 && Math.abs(sy - CARD.y) < CARD.h / 2) return;
      this.closeCard();
    }
    if (this.phase === 'closed') { if (this.sourceHit(sx, sy)) return this.openSource(); }
    if (this.phase === 'place' && this.keyHit(sx, sy)) return this.turnKey();
    const id = this.cardHit(sx, sy);
    if (id) {
      if (this.phase !== 'place') { if (this.phase === 'done') this.openCard(id); return; }
      const s = this.ctrl.slotOf(id), p = this.pos[id];
      this.drag = { id, from: s >= 0 ? { kind: 'slot', i: s } : { kind: 'album' }, ox: sx - p.x.value, oy: sy - p.y.value, moved: false, lastS: -2 };
      return;
    }
    for (const a of this.actors) if (a.hit(sx, sy + (a.lift || 0))) { a.play('happy', 'idle'); return; }
  }
  pointerMove(sx, sy) {
    const d = this.drag;
    if (!d) return;
    if (!d.moved && this.down && Math.hypot(sx - this.down.x, sy - this.down.y) > 12) {
      if (d.from.kind === 'slot' && this.ctrl.locked.includes(d.from.i)) { this.drag = null; this.onReject('locked', d.id); return; }
      d.moved = true; this.closeCard(); this.audio.paper();                                                          // paper_pickup
      this.sc[d.id].target = 1.04;
    }
    if (!d.moved) return;
    this.pos[d.id].set(sx - d.ox, sy - d.oy);
    const s = this.slotAt(sx - d.ox, sy - d.oy);
    if (s !== d.lastS) { d.lastS = s; this.hover = s; if (s >= 0) this.audio.tick(s); }
  }
  pointerUp(sx, sy) {
    const d = this.drag; this.drag = null; this.hover = -1;
    if (!d) return;
    if (!d.moved) { this.layout(); return this.openCard(d.id); }
    const p = this.pos[d.id], s = this.slotAt(p.x.value, p.y.value);
    const r = this.ctrl.drop(d.id, d.from, s >= 0 ? s : (d.from.kind === 'slot' && p.y.value > RAIL_Y + 60 ? null : (d.from.kind === 'slot' ? d.from.i : null)));
    if (r === 'none' || r === 'locked' || r === 'busy') this.layout();
  }

  button(name) {
    this.pressT = { ...(this.pressT || {}), [name]: PRESS_S };
    const busy = this.fade || this.phase === 'checking' || this.phase === 'done';
    if (name === 'hint') {
      if (busy || this.ended || this.phase === 'closed') return;
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
      if (this.ctrl.reset()) { this.layout(); this.audio.paper(); this.log('puzzle_interaction', { action: 'reset' }); }
    }
  }
  showHint(h) {
    this.stageMaxHint = Math.max(this.stageMaxHint, h.level);
    this.closeCard();
    if (h.text_key) this.bubbleText(this.str(h.text_key), 6.5);
    if (h.audio_key && this.audio.voice && this.voiceReady(h.audio_key)) this.audio.voice(this.voUrl(h.audio_key));
    if (h.level === 1) {                               // H1: which happened first? — the stuck pair (or the start of time)
      this.hl.pair = this.ctrl.lastPair ? this.ctrl.lastPair.slice() : null;
      this.lumi.mode = this.hl.pair ? 'pair' : 'circle'; this.lumi.readT = 0;
      this.tl.after(6, () => { this.hl.pair = null; if (this.lumi.mode === 'pair' || this.lumi.mode === 'circle') this.lumi.mode = 'follow'; });
    } else if (h.level === 2) this.hl.ages = true;       // H2: age / stage tags on every card (stay for the stage)
    else this.hl.guide = true;                          // H3: start from birth — the card of the first wrong slot glows with a trail
  }
  spawnSparks(n, x, y, spread) {
    if (reduceMotion) n = Math.round(n / 4);
    for (let i = 0; i < n; i++) this.sparks.push({ x: x + (Math.random() - 0.5) * spread, y: y + (Math.random() - 0.5) * spread * 0.6, vy: -20 - Math.random() * 40,
      ph: Math.random() * 6.28, life: 1.6 + Math.random() * 2.4, t: 0, r: 2 + Math.random() * 3 });
  }

  // ================================================================= update
  update(dt) {
    if (this.pressT) for (const k in this.pressT) this.pressT[k] = Math.max(0, this.pressT[k] - dt);
    this.t += dt;
    this.tl.update(dt);
    if (!this.ended && !this.card && this.phase === 'place') this.hints.tick(dt);
    for (const s of [this.albumOpen, this.boxOpen, this.bloom, this.roomGlow]) s.update(dt);
    const dr = this.drag && this.drag.moved ? this.drag.id : null;
    for (const id of Object.keys(this.pos)) { if (id !== dr) this.pos[id].update(dt); this.sc[id].update(dt); }
    if (this.card) this.card.t += dt;
    if (this.bubble) this.bubble.t += dt;
    if (this.warn) { this.warn.t += dt; if (this.warn.t > 3.2) this.warn = null; }
    for (const k in this.anim) { const a = this.anim[k]; for (const f of ['pop', 'shake', 'lock', 'warn']) if (a[f] > 0) a[f] -= dt; }
    for (const f of this.fx) f.t += dt;
    this.fx = this.fx.filter((f) => f.t < 0.6);
    for (const s of this.sparks) { s.t += dt; s.y += s.vy * dt; s.ph += dt * 3; }
    this.sparks = this.sparks.filter((s) => s.t < s.life);
    if (this.clockRun) {                                // the mantel clock: one soft tick per second
      this.clockSec += dt;
      if (Math.floor(this.clockSec) !== this.lastTick) { this.lastTick = Math.floor(this.clockSec); if (this.audio.clockTick && !this.card) this.audio.clockTick(this.lastTick % 2 === 1); }
    }
    for (const a of this.actors) a.update(dt);
    const lookX = this.phase === 'closed' ? SOURCE[this.stage.source_prop]().x : 900;
    if (this.tiko.clip === 'idle') this.tiko.faceTowards(lookX);
    if (this.neo.clip === 'idle') this.neo.faceTowards(lookX);
    const lm = this.lumi;
    if (lm.mode === 'follow') {
      if (this.card) lm.p.to(CARD.x + CARD.w / 2 + 70, CARD.y - 40 + Math.sin(this.t * 2.1) * 12);
      else if (this.phase === 'closed' && !this.ended) { const s = SOURCE[this.stage.source_prop](); lm.p.to(s.x + Math.cos(this.t * 1.3) * 70, s.y - 120 + Math.sin(this.t * 2.1) * 16); }
      else if (this.phase === 'place' && this.ctrl.full) lm.p.to(KEY.x - 10, KEY.y - 120 + Math.sin(this.t * 2.4) * 12);   // beside the key, off the board
      else { const h = this.neo.headPoint(); lm.p.to(h.x - 80, h.y - 60 + Math.sin(this.t * 2.1) * 12); }
    } else if (lm.mode === 'circle') {                 // around the first slot: «where does time begin?»
      lm.readT += dt; const a = lm.readT * 2.3;
      lm.p.to(SLOT_X[0] + Math.cos(a) * (CARD_W / 2 + 40), SLOT_Y + Math.sin(a) * (CARD_H / 2 + 30));
    } else if (lm.mode === 'pair') {                   // hovers between the two cards that are swapped
      const [a, b] = this.hl.pair || []; const pa = a && this.pos[a], pb = b && this.pos[b];
      if (pa && pb) lm.p.to((pa.x.value + pb.x.value) / 2, SLOT_Y - CARD_H / 2 - 50 + Math.sin(this.t * 4) * 10);
    } else if (lm.mode === 'celebrate') lm.p.to(760 + Math.cos(this.t * 1.6) * 480, 590 + Math.sin(this.t * 3.2) * 36);   // the free wall band under the labels (never over the cards)
    if (reduceMotion && lm.mode !== 'celebrate' && lm.mode !== 'circle') lm.p.set(lm.p.x.target, lm.p.y.target);
    lm.p.update(dt);
  }

  // ================================================================= draw
  img(name) { return this.sprites.get(name); }
  meta(name) { return this.sprites.m && this.sprites.m[name]; }
  draw(ctx) {
    this.drawRoom(ctx);
    this.drawTimeline(ctx);
    this.drawShelf(ctx);
    this.drawPot(ctx);
    this.drawTable(ctx);
    this.tiko.draw(ctx);
    this.neo.draw(ctx);
    this.drawCards(ctx);
    this.drawSparks(ctx);
    if (this.card) this.drawReading(ctx);
    this.drawLumi(ctx);
    this.drawHud(ctx);
  }
  /** Sprite by its alpha bbox, bottom-centre at (cx, by), width w. → drawn box or null (stand-in needed). */
  sprite(ctx, name, cx, by, w) {
    const im = this.img(name); if (!im) return null;
    const m = this.meta(name), bb = m && m.bbox ? m.bbox : [0, 0, (im._im || im).width - 1, (im._im || im).height - 1];
    const sw = bb[2] - bb[0] + 1, sh = bb[3] - bb[1] + 1, h = w * sh / sw;
    ctx.drawImage(im, bb[0], bb[1], sw, sh, cx - w / 2, by - h, w, h);
    return { x: cx - w / 2, y: by - h, w, h };
  }

  // ---------------------------------------------------------------- the room (ENV_VIL_HOUSE; stand-in until batch 11)
  drawRoom(ctx) {
    const plate = this.img('house_plate');
    if (plate) { ctx.drawImage(plate, 0, 0, W, H); }
    else {
      let g = ctx.createLinearGradient(0, 0, 0, 660); g.addColorStop(0, '#e6c893'); g.addColorStop(1, '#d4a86c');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, 660);
      ctx.fillStyle = 'rgba(120,70,30,0.10)'; for (let i = 0; i < 26; i++) ctx.fillRect((i * 173) % W, (i * 97) % 600, 60 + (i % 5) * 20, 3);   // plaster strokes
      ctx.fillStyle = '#b98a52'; ctx.fillRect(0, 610, W, 50);                                  // wainscot
      ctx.fillStyle = '#3f9a9a'; for (let x = 0; x < W; x += 60) { ctx.fillRect(x + 8, 626, 44, 18); }   // turquoise tiles
      g = ctx.createLinearGradient(0, 660, 0, H); g.addColorStop(0, '#8c5e34'); g.addColorStop(1, '#6f4724');
      ctx.fillStyle = g; ctx.fillRect(0, 660, W, H - 660);
      ctx.fillStyle = '#9d3b2c'; ctx.beginPath(); ctx.moveTo(300, 720); ctx.lineTo(1620, 720); ctx.lineTo(1780, 1080); ctx.lineTo(140, 1080); ctx.fill();   // carpet
      ctx.strokeStyle = '#d99a3a'; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(330, 740); ctx.lineTo(1590, 740); ctx.lineTo(1735, 1080); ctx.moveTo(330, 740); ctx.lineTo(185, 1080); ctx.stroke();
      ctx.fillStyle = '#c47a3a'; for (let i = 0; i < 7; i++) ctx.fillRect(560 + i * 120, 640, 90, 60);   // floor cushions
      ctx.fillStyle = '#5b3a1e'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(120, 0); ctx.lineTo(120, 700); ctx.lineTo(0, 700); ctx.fill();   // kitchen arch edge
      ctx.fillStyle = '#4a2f18'; ctx.beginPath(); ctx.arc(60, 330, 50, Math.PI, 0); ctx.lineTo(110, 700); ctx.lineTo(10, 700); ctx.fill();
      const w = WINDOW; g = ctx.createLinearGradient(0, w.y0, 0, w.y1); g.addColorStop(0, '#9fd3ee'); g.addColorStop(1, '#e3f1e6');
      ctx.fillStyle = '#6b4322'; ctx.fillRect(w.x0 - 14, w.y0 - 14, w.x1 - w.x0 + 28, w.y1 - w.y0 + 14);
      ctx.fillStyle = g; ctx.fillRect(w.x0, w.y0, w.x1 - w.x0, w.y1 - w.y0);
      ctx.strokeStyle = '#6b4322'; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo((w.x0 + w.x1) / 2, w.y0); ctx.lineTo((w.x0 + w.x1) / 2, w.y1); ctx.moveTo(w.x0, (w.y0 + w.y1) / 2); ctx.lineTo(w.x1, (w.y0 + w.y1) / 2); ctx.stroke();
      ctx.fillStyle = '#8a5a2e'; ctx.fillRect(w.x0 - 30, w.y1, w.x1 - w.x0 + 60, 22);          // sill
    }
    const g = this.roomGlow.value;
    if (g > 0.01) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const gr = ctx.createRadialGradient(W / 2, SLOT_Y, 40, W / 2, SLOT_Y, 900);
      gr.addColorStop(0, `rgba(255,226,160,${0.22 * g})`); gr.addColorStop(1, 'rgba(255,226,160,0)');
      ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H); ctx.restore();
    }
  }
  drawTable(ctx) {
    if (!this.img('house_plate')) {                     // the low table (painted in the plate)
      ctx.fillStyle = 'rgba(30,16,6,0.35)'; ctx.beginPath(); ctx.ellipse((TABLE.x0 + TABLE.x1) / 2, TABLE.y + 110, 300, 26, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#a4703c'; ctx.beginPath(); ctx.roundRect(TABLE.x0, TABLE.y - 14, TABLE.x1 - TABLE.x0, 30, 8); ctx.fill();
      ctx.fillStyle = '#7d5128'; ctx.fillRect(TABLE.x0 + 30, TABLE.y + 14, 26, 90); ctx.fillRect(TABLE.x1 - 56, TABLE.y + 14, 26, 90);
    }
    this.drawAlbum(ctx);
  }
  drawAlbum(ctx) {
    const o = this.albumOpen.value, invite = this.phase === 'closed' && this.stage.source_prop === 'album' && !this.ended;
    if (invite) this.drawInvite(ctx, ALBUM.x, ALBUM.y - 50, 190);
    const name = o > 0.5 ? 'soc01_album_open' : 'soc01_album';
    const w = ALBUM.w * (o > 0.5 ? 1.35 : 1);
    if (this.sprite(ctx, name, ALBUM.x, ALBUM.y + 6, w)) return;
    ctx.save(); ctx.translate(ALBUM.x, ALBUM.y);
    ctx.fillStyle = 'rgba(20,10,4,0.3)'; ctx.beginPath(); ctx.ellipse(0, 4, w * 0.52, 14, 0, 0, Math.PI * 2); ctx.fill();
    if (o <= 0.5) {
      ctx.fillStyle = '#f2e3c2'; ctx.fillRect(-w / 2 + 6, -26, w - 12, 20);                                 // page edges
      ctx.fillStyle = '#4f86b8'; ctx.beginPath(); ctx.roundRect(-w / 2, -70, w, 50, 8); ctx.fill();         // cloth cover
      ctx.strokeStyle = '#f2e3c2'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, -46, 14, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#b07a3a'; for (const sx of [-1, 1]) ctx.fillRect(sx * (w / 2 - 22) - 10, -70, 20, 50); // wooden corners
      ctx.fillStyle = '#d9a640'; ctx.fillRect(w / 2 - 36, -40, 22, 14);                                      // brass clasp (front-right)
    } else {
      ctx.fillStyle = '#4f86b8'; ctx.beginPath(); ctx.roundRect(-w / 2, -64, w, 60, 8); ctx.fill();
      ctx.fillStyle = '#f6ead0'; ctx.fillRect(-w / 2 + 12, -60, w / 2 - 16, 50); ctx.fillRect(4, -60, w / 2 - 16, 50);
      ctx.strokeStyle = 'rgba(120,80,30,0.4)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -62); ctx.lineTo(0, -8); ctx.stroke();
    }
    ctx.restore();
  }
  drawInvite(ctx, x, y, r) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const gl = this.img('interaction_glow');
    if (gl) { const f = Math.floor(this.t * 12) % 16, cw = (gl._im || gl).width / 4; ctx.globalAlpha = 0.75; ctx.drawImage(gl, (f % 4) * cw, Math.floor(f / 4) * cw, cw, cw, x - r, y - r, r * 2, r * 2); }
    else { const k = 0.5 + 0.5 * Math.sin(this.t * 3), gr = ctx.createRadialGradient(x, y, 6, x, y, r); gr.addColorStop(0, `rgba(255,232,160,${0.2 + 0.2 * k})`); gr.addColorStop(1, 'rgba(255,232,160,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }

  // ---------------------------------------------------------------- the wall timeline (SOC01_ASSET_03)
  drawTimeline(ctx) {
    const b = BOARD;
    ctx.save();
    ctx.save(); ctx.shadowColor = 'rgba(40,22,8,0.38)'; ctx.shadowBlur = 22; ctx.shadowOffsetX = 8; ctx.shadowOffsetY = 14;   // wall shadow follows the board shape
    const drawn = this.sprite(ctx, 'soc01_timeline', (b.x0 + b.x1) / 2, b.y1, b.x1 - b.x0);
    ctx.restore();
    if (!drawn) { ctx.fillStyle = 'rgba(40,22,8,0.28)'; ctx.beginPath(); ctx.roundRect(b.x0 + 10, b.y0 + 16, b.x1 - b.x0, b.y1 - b.y0, 20); ctx.fill(); }
    if (!drawn) {
      const g = ctx.createLinearGradient(0, b.y0, 0, b.y1); g.addColorStop(0, '#c98f4a'); g.addColorStop(1, '#a86f34');
      ctx.fillStyle = g; ctx.strokeStyle = '#6e4520'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(b.x0 + 20, b.y0); ctx.lineTo(b.x1 - 140, b.y0); ctx.lineTo(b.x1 - 140, b.y0 - 30); ctx.lineTo(b.x1, (b.y0 + b.y1) / 2);
      ctx.lineTo(b.x1 - 140, b.y1 + 30); ctx.lineTo(b.x1 - 140, b.y1); ctx.lineTo(b.x0 + 20, b.y1); ctx.quadraticCurveTo(b.x0, b.y1, b.x0, b.y1 - 20);
      ctx.lineTo(b.x0, b.y0 + 20); ctx.quadraticCurveTo(b.x0, b.y0, b.x0 + 20, b.y0); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#3f9a9a'; for (let i = 0; i < 3; i++) ctx.fillRect(b.x0 + 26, b.y0 + 60 + i * 70, 34, 40);   // tile inlays (left end)
      for (let i = 0; i < 5; i++) {                                            // recessed slots
        ctx.fillStyle = '#7a4a22'; ctx.beginPath(); ctx.roundRect(SLOT_X[i] - CARD_W / 2 - 10, SLOT_Y - CARD_H / 2 - 10, CARD_W + 20, CARD_H + 20, 12); ctx.fill();
        ctx.fillStyle = '#efdcb4'; ctx.beginPath(); ctx.roundRect(SLOT_X[i] - CARD_W / 2, SLOT_Y - CARD_H / 2, CARD_W, CARD_H, 8); ctx.fill();
      }
      ctx.strokeStyle = '#8a6420'; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(b.x0 + 30, RAIL_Y); ctx.lineTo(b.x1 - 80, RAIL_Y); ctx.stroke();   // brass rail
      ctx.strokeStyle = '#e8c060'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(b.x0 + 30, RAIL_Y - 2); ctx.lineTo(b.x1 - 80, RAIL_Y - 2); ctx.stroke();
      ctx.fillStyle = '#d9a640'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc((SLOT_X[i] + SLOT_X[i + 1]) / 2, SLOT_Y, 10, 0, Math.PI * 2); ctx.fill(); }
    }
    // slot highlights: hover target, empty-slot warning, assist pins, H3 guide
    for (let i = 0; i < 5; i++) {
      const a = this.anim['empty' + i], hov = this.hover === i && this.drag;
      if (hov || (a && a.warn > 0)) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(255,220,140,${hov ? 0.9 : 0.5 + 0.4 * Math.sin(this.t * 10)})`; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.roundRect(SLOT_X[i] - CARD_W / 2 - 8, SLOT_Y - CARD_H / 2 - 8, CARD_W + 16, CARD_H + 16, 12); ctx.stroke(); ctx.restore();
      }
    }
    this.drawGuideSlot(ctx);
    // textbook labels: گذشته under the first slot · حال under the last · آینده on the arrow head
    ctx.font = `700 34px ${FONT}`; ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const labels = [[SLOT_X[0], this.puzzle.labels.past_key], [SLOT_X[4], this.puzzle.labels.present_key], [ARROW_TIP - 70, this.puzzle.labels.future_key]];
    for (const [x, k] of labels) {
      const t = this.str(k); if (!t) continue;
      const w = ctx.measureText(t).width + 36;
      ctx.fillStyle = 'rgba(250,238,208,0.92)'; ctx.strokeStyle = 'rgba(140,96,40,0.85)'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.roundRect(x - w / 2, LABEL_Y - 24, w, 48, 14); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#4a3418'; ctx.fillText(t, x, LABEL_Y + 1);
    }
    // the arrow of time from past to present (textbook): a thin line with a head under the labels
    ctx.strokeStyle = 'rgba(110,70,26,0.7)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(SLOT_X[0] + 90, LABEL_Y); ctx.lineTo(SLOT_X[4] - 70, LABEL_Y); ctx.stroke();
    ctx.fillStyle = 'rgba(110,70,26,0.7)'; ctx.beginPath(); ctx.moveTo(SLOT_X[4] - 56, LABEL_Y); ctx.lineTo(SLOT_X[4] - 76, LABEL_Y - 10); ctx.lineTo(SLOT_X[4] - 76, LABEL_Y + 10); ctx.fill();
    this.drawKey(ctx);
    this.drawMarker(ctx);
    for (const i of this.ctrl.locked) this.drawPin(ctx, i);
    ctx.restore();
  }
  drawKey(ctx) {
    const a = this.anim.key || {}, ready = this.phase === 'place' && this.ctrl.full;
    const sh = a.shake > 0 ? Math.sin(a.shake * 40) * 6 * a.shake : 0, pop = a.pop > 0 ? 1 + 0.25 * Math.sin((1 - a.pop / 0.6) * Math.PI) : 1;
    if (ready) this.drawInvite(ctx, KEY.x, KEY.y, 110);
    // a brass wind key seen from the side: the stem goes right into the board end; turning it = the bow flips round
    // its horizontal axis (keyRot 0 → π/2 is one half-turn: the bow narrows edge-on and opens again)
    ctx.save(); ctx.translate(KEY.x + sh, KEY.y); ctx.scale(pop, pop);
    const stemL = BOARD.x0 + 12 - KEY.x;
    let g = ctx.createLinearGradient(0, -7, 0, 7); g.addColorStop(0, '#f4d98a'); g.addColorStop(0.5, '#c8962e'); g.addColorStop(1, '#7a5418');
    ctx.fillStyle = g; ctx.strokeStyle = '#5e3e10'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.roundRect(8, -6, stemL - 8, 12, 4); ctx.fill(); ctx.stroke();                                   // stem
    ctx.beginPath(); ctx.roundRect(stemL - 30, -10, 14, 20, 3); ctx.fill(); ctx.stroke();                              // collar
    const flip = Math.cos(this.keyRot * 2), sy = Math.max(0.14, Math.abs(flip));
    ctx.scale(1, sy);
    g = ctx.createLinearGradient(-30, -44, 20, 44); g.addColorStop(0, ready ? '#fff0b0' : '#f6dc8e'); g.addColorStop(0.45, ready ? '#f0c85a' : '#d4a640'); g.addColorStop(1, '#8a5e1c');
    ctx.fillStyle = g; ctx.strokeStyle = '#5e3e10'; ctx.lineWidth = 3.5 / sy > 12 ? 12 : 3.5;
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(-4, s * 22, 20, 21, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }   // two-lobed bow
    ctx.beginPath(); ctx.arc(8, 0, 11, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(94,62,16,0.8)'; for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(-6, s * 22, 6, 0, Math.PI * 2); ctx.fill(); }   // lobe holes
    ctx.fillStyle = 'rgba(255,248,220,0.55)'; ctx.beginPath(); ctx.ellipse(-12, -30, 7, 4, -0.5, 0, Math.PI * 2); ctx.fill();         // shine
    ctx.restore();
  }
  drawMarker(ctx) {
    const a = this.anim.marker || {}, sh = a.shake > 0 ? Math.sin(a.shake * 50) * 7 : 0;
    const x = this.marker.x + sh, y = RAIL_Y;
    ctx.save();
    ctx.fillStyle = 'rgba(30,16,4,0.3)'; ctx.beginPath(); ctx.ellipse(x + 3, y + 22, 22, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e6b84c'; ctx.strokeStyle = '#6e4a14'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x, y - 34); ctx.lineTo(x + 18, y - 6); ctx.lineTo(x - 18, y - 6); ctx.closePath(); ctx.fill(); ctx.stroke();   // pointer up at the cards
    ctx.beginPath(); ctx.roundRect(x - 22, y - 10, 44, 22, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff4c8'; ctx.beginPath(); ctx.arc(x, y + 1, 5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  drawPin(ctx, i) {
    const a = this.anim['lock' + i] || {}, pop = a.pop > 0 ? 1 + 0.4 * a.pop : 1, sh = a.shake > 0 ? Math.sin(a.shake * 40) * 5 : 0;
    ctx.save(); ctx.translate(SLOT_X[i] + sh, SLOT_Y - CARD_H / 2 - 4); ctx.scale(pop, pop);
    ctx.fillStyle = '#e6b84c'; ctx.strokeStyle = '#6e4a14'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff4c8'; ctx.beginPath(); ctx.arc(-3, -3, 4, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  guide() { return this.hl.guide && this.phase === 'place' ? guideTarget(this.puzzle, this.stage, this.row()) : null; }
  drawGuideSlot(ctx) {
    const g = this.guide(); if (!g) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(255,214,110,${0.55 + 0.35 * Math.sin(this.t * 4)})`; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.roundRect(SLOT_X[g.slot] - CARD_W / 2 - 10, SLOT_Y - CARD_H / 2 - 10, CARD_W + 20, CARD_H + 20, 14); ctx.stroke(); ctx.restore();
  }

  // ---------------------------------------------------------------- shelf: clock + memory box; window pot
  drawShelf(ctx) {
    if (!this.img('house_plate')) {
      ctx.fillStyle = '#8a5a2e'; ctx.fillRect(SHELF.x0, SHELF.y, SHELF.x1 - SHELF.x0, 18);
      ctx.fillStyle = '#6e4520'; ctx.fillRect(SHELF.x0 + 20, SHELF.y + 18, 14, 60); ctx.fillRect(SHELF.x1 - 40, SHELF.y + 18, 14, 60);
    }
    this.drawClock(ctx);
    this.drawBox(ctx);
  }
  drawClock(ctx) {
    const c = CLOCK, box = this.sprite(ctx, 'soc01_clock', c.x, c.y, c.h * 0.89);   // SOC01_ASSET_05 bbox aspect 0.89
    // cream dial measured on the final: centre (0.503, 0.51) of the bbox, radius 0.212·w
    const dial = box ? { x: box.x + box.w * 0.503, y: box.y + box.h * 0.51, r: box.w * 0.212 } : { x: c.x, y: c.y - c.h * 0.52, r: c.h * 0.24 };
    if (!box) {
      ctx.fillStyle = '#9c6632'; ctx.strokeStyle = '#5e3a18'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(c.x - 60, c.y); ctx.lineTo(c.x - 60, c.y - c.h * 0.7); ctx.quadraticCurveTo(c.x, c.y - c.h * 1.02, c.x + 60, c.y - c.h * 0.7); ctx.lineTo(c.x + 60, c.y); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#d9a640'; ctx.beginPath(); ctx.arc(dial.x, dial.y, dial.r + 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f7ecd2'; ctx.beginPath(); ctx.arc(dial.x, dial.y, dial.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#a07a30'; for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; ctx.beginPath(); ctx.arc(dial.x + Math.cos(a) * dial.r * 0.82, dial.y + Math.sin(a) * dial.r * 0.82, 2.5, 0, Math.PI * 2); ctx.fill(); }
    }
    // engine hands: stopped at ten past ten until the timeline is right, then they run (one tick per second)
    const sec = this.clockRun ? Math.floor(this.clockSec) : 0;
    const minA = (this.clockRun ? (10 + sec / 60) : 10) / 60 * Math.PI * 2 - Math.PI / 2, hrA = (10 + (this.clockRun ? sec / 3600 : 0) + 10 / 60) / 12 * Math.PI * 2 - Math.PI / 2;
    ctx.save(); ctx.strokeStyle = '#3e2a12'; ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(3, dial.r * 0.13); ctx.beginPath(); ctx.moveTo(dial.x, dial.y); ctx.lineTo(dial.x + Math.cos(hrA) * dial.r * 0.5, dial.y + Math.sin(hrA) * dial.r * 0.5); ctx.stroke();
    ctx.lineWidth = Math.max(2.5, dial.r * 0.09); ctx.beginPath(); ctx.moveTo(dial.x, dial.y); ctx.lineTo(dial.x + Math.cos(minA) * dial.r * 0.78, dial.y + Math.sin(minA) * dial.r * 0.78); ctx.stroke();
    if (this.clockRun) { const sA = sec / 60 * Math.PI * 2 - Math.PI / 2; ctx.strokeStyle = '#b0442c'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(dial.x, dial.y); ctx.lineTo(dial.x + Math.cos(sA) * dial.r * 0.85, dial.y + Math.sin(sA) * dial.r * 0.85); ctx.stroke(); }
    ctx.fillStyle = '#d9a640'; ctx.beginPath(); ctx.arc(dial.x, dial.y, 5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  drawBox(ctx) {
    const o = this.boxOpen.value, invite = this.phase === 'closed' && this.stage.source_prop === 'memory_box' && !this.ended;
    if (invite) this.drawInvite(ctx, BOX.x, BOX.y - 60, 150);
    const a = this.anim.box || {}, pop = a.pop > 0 ? 1 + 0.12 * Math.sin((1 - a.pop / 0.4) * Math.PI) : 1;
    ctx.save(); ctx.translate(BOX.x, BOX.y); ctx.scale(pop, pop); ctx.translate(-BOX.x, -BOX.y);
    if (!this.sprite(ctx, o > 0.5 ? 'soc01_box_open' : 'soc01_box', BOX.x, BOX.y + (o > 0.5 && this.img('soc01_box_open') ? 0.058 * BOX.w : 0), BOX.w)) {   // open final: the lock plate hangs below the body
      const w = BOX.w, h = 80;
      ctx.fillStyle = '#a4703c'; ctx.strokeStyle = '#5e3a18'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.roundRect(BOX.x - w / 2, BOX.y - h, w, h, 6); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#3f9a9a'; ctx.fillRect(BOX.x - w / 2 + 4, BOX.y - h + 30, w - 8, 8);
      if (o > 0.05) {                                   // lid swings up; the footprint paper + name band inside
        ctx.save(); ctx.translate(BOX.x, BOX.y - h); ctx.scale(1, 1 - 1.6 * o);
        ctx.fillStyle = '#b98246'; ctx.beginPath(); ctx.roundRect(-w / 2 - 4, -26, w + 8, 26, 10); ctx.fill(); ctx.stroke(); ctx.restore();
        ctx.fillStyle = '#fbf3e0'; ctx.fillRect(BOX.x - 40, BOX.y - h - 18 * o, 50, 30 * o);
        ctx.fillStyle = '#3b68a8'; ctx.beginPath(); ctx.ellipse(BOX.x - 15, BOX.y - h - 4 * o, 7, 11 * o, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.fillRect(BOX.x + 16, BOX.y - h - 10 * o, 26, 7);
      } else {
        ctx.fillStyle = '#b98246'; ctx.beginPath(); ctx.roundRect(BOX.x - w / 2 - 4, BOX.y - h - 26, w + 8, 30, 10); ctx.fill(); ctx.stroke();
      }
      ctx.fillStyle = '#d9a640'; ctx.fillRect(BOX.x - 9, BOX.y - h + 6, 18, 20);
    }
    ctx.restore();
    if (o > 0.3) {                                      // warm light from inside
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const gr = ctx.createRadialGradient(BOX.x, BOX.y - 90, 4, BOX.x, BOX.y - 90, 120); gr.addColorStop(0, `rgba(255,214,130,${0.35 * o})`); gr.addColorStop(1, 'rgba(255,214,130,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(BOX.x, BOX.y - 90, 120, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
  }
  drawPot(ctx) {
    const invite = this.phase === 'closed' && this.stage.source_prop === 'window_pot' && !this.ended;
    if (invite) this.drawInvite(ctx, POT.x, POT.y - 70, 140);
    const a = this.anim.pot || {}, pop = a.pop > 0 ? 1 + 0.12 * Math.sin((1 - a.pop / 0.4) * Math.PI) : 1;
    const stage = this.stageIdx === 2 && this.bloom.value > 0.5 ? 4 : (this.save.puzzle('SOC-01_TRA') || {}).solved ? 4 : 2;   // young plant until the transfer, then in bloom
    ctx.save(); ctx.translate(POT.x, POT.y); ctx.scale(pop, pop);
    this.drawPicto(ctx, { sheet: 'soc01_plant', cell: stage }, 0, 0, POT.h, ['SEED', 'SPROUT', 'LEAVES', 'BUD', 'FLOWER'][stage], true);   // pot bottom on the sill
    ctx.restore();
  }

  // ---------------------------------------------------------------- cards (SOC01_ASSET_02 + pictograms)
  drawCards(ctx) {
    if (this.phase === 'closed' && !this.ended) return;
    const dr = this.drag && this.drag.moved ? this.drag.id : null;
    const order = [...this.row().filter(Boolean), ...this.ctrl.album];
    for (const id of order) if (id !== dr) this.drawEventCardAt(ctx, id);
    const g = this.guide();
    if (g && this.pos[g.id]) this.drawTrail(ctx, this.pos[g.id], this.slotPos(g.slot));
    for (const f of this.fx) this.drawFx(ctx, f);
    if (dr) this.drawEventCardAt(ctx, dr);
    if (this.warn && this.warn.t < 3) {                // «؟» between the swapped pair
      const [a, b] = this.warn.pair, pa = this.pos[a], pb = this.pos[b];
      if (pa && pb) {
        const x = (pa.x.value + pb.x.value) / 2, y = SLOT_Y, k = Math.min(1, this.warn.t / 0.25);
        ctx.save(); ctx.globalAlpha = k * (this.warn.t > 2.5 ? (3 - this.warn.t) * 2 : 1);
        ctx.fillStyle = '#fff4d6'; ctx.strokeStyle = '#d98a3a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y, 30, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#8a4a14'; ctx.font = `800 40px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('؟', x, y + 2);
        ctx.restore();
      }
    }
  }
  drawEventCardAt(ctx, id) {
    const p = this.pos[id], a = this.anim[id] || {}, k = this.sc[id].value;
    let x = p.x.value, y = p.y.value, rot = 0, s = k;
    if (a.shake > 0) { x += Math.sin(a.shake * 38) * 9 * a.shake; rot = Math.sin(a.shake * 30) * 0.05 * a.shake; }
    if (a.pop > 0) s *= 1 + 0.08 * Math.sin((1 - a.pop / 0.35) * Math.PI);
    const pulse = this.hl.pair && this.hl.pair.includes(id) ? 0.5 + 0.5 * Math.sin(this.t * 6) : 0;
    const guide = this.guide(), gl = guide && guide.id === id ? 0.6 + 0.4 * Math.sin(this.t * 4) : 0;
    const lock = a.lock > 0 ? a.lock / 0.6 : 0, dragging = this.drag && this.drag.moved && this.drag.id === id;
    this.drawEventCard(ctx, id, x, y, s, { rot, glow: Math.max(pulse, gl, lock), lift: dragging });
  }
  drawEventCard(ctx, id, x, y, s, { rot = 0, glow = 0, lift = false, ages = this.hl.ages } = {}) {
    const ev = eventOf(this.puzzle, id), w = CARD_W * s, h = CARD_H * s;
    ctx.save(); ctx.translate(x, y); if (rot) ctx.rotate(rot);
    ctx.fillStyle = `rgba(30,16,4,${lift ? 0.35 : 0.22})`; ctx.beginPath(); ctx.roundRect(-w / 2 + (lift ? 10 : 4), -h / 2 + (lift ? 16 : 6), w, h, 12 * s); ctx.fill();
    if (glow > 0.01) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const gr = ctx.createRadialGradient(0, 0, w * 0.3, 0, 0, w * 0.95); gr.addColorStop(0, `rgba(255,220,140,${0.55 * glow})`); gr.addColorStop(1, 'rgba(255,220,140,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, w * 0.95, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    const im = this.img('soc01_card');
    if (im) { const m = this.meta('soc01_card'), bb = m && m.bbox; if (bb) ctx.drawImage(im, bb[0], bb[1], bb[2] - bb[0] + 1, bb[3] - bb[1] + 1, -w / 2, -h / 2, w, h); else ctx.drawImage(im, -w / 2, -h / 2, w, h); }
    else {
      ctx.fillStyle = '#b57b3e'; ctx.strokeStyle = '#6e4520'; ctx.lineWidth = 3 * s; ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 12 * s); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#3f9a9a'; ctx.lineWidth = 2 * s; ctx.beginPath(); ctx.roundRect(-w / 2 + 6 * s, -h / 2 + 6 * s, w - 12 * s, h - 12 * s, 9 * s); ctx.stroke();
      ctx.fillStyle = '#f6ead0';
      ctx.beginPath(); ctx.roundRect(-w / 2 + WIN.x0 * w, -h / 2 + WIN.y0 * h, (WIN.x1 - WIN.x0) * w, (WIN.y1 - WIN.y0) * h, 6 * s); ctx.fill();
      ctx.beginPath(); ctx.roundRect(-w / 2 + BAND.x0 * w, -h / 2 + BAND.y0 * h, (BAND.x1 - BAND.x0) * w, (BAND.y1 - BAND.y0) * h, 5 * s); ctx.fill();
      ctx.fillStyle = '#d9a640'; for (const [cx, cy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { ctx.beginPath(); ctx.arc(cx * (w / 2 - 7 * s), cy * (h / 2 - 7 * s), 4 * s, 0, Math.PI * 2); ctx.fill(); }
    }
    const wx = -w / 2 + ((WIN.x0 + WIN.x1) / 2) * w, wy = -h / 2 + ((WIN.y0 + WIN.y1) / 2) * h, ws = Math.min((WIN.x1 - WIN.x0) * w, (WIN.y1 - WIN.y0) * h) * 0.92;
    this.drawPicto(ctx, ev.picto, wx, wy, ws, id);
    ctx.font = `800 ${Math.round(23 * s)}px ${FONT}`; ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#3e2c14'; ctx.fillText(ev.caption_fa, 0, -h / 2 + ((BAND.y0 + BAND.y1) / 2) * h + 1, (BAND.x1 - BAND.x0) * w - 8);
    if (ages) {                                         // H2: the age / stage tag hangs on the card top
      ctx.font = `700 ${Math.round(21 * s)}px ${FONT}`;
      const t = ev.age_fa, tw = ctx.measureText(t).width + 24 * s, ty = -h / 2 - 18 * s;
      ctx.fillStyle = '#f0c85a'; ctx.strokeStyle = '#6e4a14'; ctx.lineWidth = 2.5 * s;
      ctx.beginPath(); ctx.roundRect(-tw / 2, ty - 17 * s, tw, 34 * s, 10 * s); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#3e2a10'; ctx.fillText(t, 0, ty + 1);
    }
    ctx.restore();
  }
  /** Pictogram from the batch-11 sheets; engine-drawn stand-ins until they exist. */
  drawPicto(ctx, picto, cx, cy, size, id, bottom = false) {
    const one = this.img(`${picto.sheet}_${picto.cell}`);          // gap-sliced sprite (tools/build_web_assets.py GAP_SHEETS)
    if (one) {
      const iw = (one._im || one).width, ih = (one._im || one).height, sc = size / Math.max(iw, ih);
      ctx.drawImage(one, cx - iw * sc / 2, bottom ? cy - ih * sc : cy - ih * sc / 2, iw * sc, ih * sc);
      return;
    }
    if (bottom) { cy -= size * 0.62; size *= 1.25; }
    const im = this.img(picto.sheet), g = SHEET[picto.sheet];
    if (im && g) {
      const iw = (im._im || im).width, ih = (im._im || im).height, cw = iw / g.cols, ch = ih / g.rows;
      const c = picto.cell % g.cols, r = Math.floor(picto.cell / g.cols), sc = size / Math.max(cw, ch);
      ctx.drawImage(im, c * cw, r * ch, cw, ch, cx - cw * sc / 2, cy - ch * sc / 2, cw * sc, ch * sc);
      return;
    }
    ctx.save(); ctx.translate(cx, cy); const u = size / 100; ctx.scale(u, u); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const OUT = '#5a3a1a'; ctx.strokeStyle = OUT; ctx.lineWidth = 3;
    const tooth = (x, y, k) => { ctx.save(); ctx.translate(x, y); ctx.scale(k, k); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(-12, -10); ctx.quadraticCurveTo(0, -18, 12, -10); ctx.quadraticCurveTo(15, 4, 8, 16); ctx.lineTo(4, 6); ctx.lineTo(-4, 6); ctx.lineTo(-8, 16); ctx.quadraticCurveTo(-15, 4, -12, -10); ctx.fill(); ctx.stroke(); ctx.restore(); };
    const pot = () => { ctx.fillStyle = '#c0643a'; ctx.beginPath(); ctx.moveTo(-26, 12); ctx.lineTo(26, 12); ctx.lineTo(20, 46); ctx.lineTo(-20, 46); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#3f9a9a'; ctx.fillRect(-29, 6, 58, 10); ctx.strokeRect(-29, 6, 58, 10); ctx.fillStyle = '#4a2e18'; ctx.fillRect(-24, 4, 48, 4); };
    const leaf = (x, y, a, l) => { ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.fillStyle = '#6aa84f'; ctx.beginPath(); ctx.ellipse(l / 2, 0, l / 2, l / 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore(); };
    const stem = (h) => { ctx.strokeStyle = '#4f8a3a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, 5); ctx.lineTo(0, 5 - h); ctx.stroke(); ctx.strokeStyle = OUT; ctx.lineWidth = 3; };
    const flower = (x, y, r) => { ctx.fillStyle = '#f2c230'; for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; ctx.beginPath(); ctx.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, r * 0.7, 0, Math.PI * 2); ctx.fill(); } ctx.fillStyle = '#d9722c'; ctx.beginPath(); ctx.arc(x, y, r * 0.6, 0, Math.PI * 2); ctx.fill(); };
    switch (id) {
      case 'BIRTH': ctx.fillStyle = '#fbf6ea'; ctx.save(); ctx.rotate(-0.08); ctx.fillRect(-34, -40, 60, 78); ctx.strokeRect(-34, -40, 60, 78); ctx.restore();
        ctx.fillStyle = '#3b68a8'; ctx.beginPath(); ctx.ellipse(-4, 4, 12, 20, 0.1, 0, Math.PI * 2); ctx.fill(); [[-14, -22, 5], [-6, -26, 4.5], [2, -27, 4], [9, -25, 3.5], [14, -21, 3]].forEach(([x, y, r]) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); });
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.roundRect(20, 20, 26, 9, 4); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#7bb1e0'; ctx.beginPath(); ctx.arc(33, 24.5, 2.5, 0, Math.PI * 2); ctx.fill(); break;
      case 'CRADLE': ctx.fillStyle = '#b57b3e'; ctx.beginPath(); ctx.moveTo(-40, -8); ctx.quadraticCurveTo(0, 50, 40, -8); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#7bb1e0'; ctx.beginPath(); ctx.ellipse(0, -8, 38, 9, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = '#6e4520'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, -20, 58, 0.55 * Math.PI, 0.45 * Math.PI, true); ctx.stroke(); break;
      case 'STEPS': for (const sx of [-20, 18]) { ctx.save(); ctx.translate(sx, 8); ctx.rotate(sx < 0 ? -0.15 : 0.12); ctx.fillStyle = '#f1dfb8'; ctx.beginPath(); ctx.ellipse(0, 0, 15, 26, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#7bb1e0'; ctx.beginPath(); ctx.ellipse(0, -8, 9, 11, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); } break;
      case 'SCHOOL': ctx.fillStyle = '#4f86b8'; ctx.beginPath(); ctx.roundRect(-30, -30, 60, 72, 14); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#3d6f9c'; ctx.beginPath(); ctx.roundRect(-30, -30, 60, 30, [14, 14, 6, 6]); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#d9a640'; ctx.fillRect(-6, -4, 12, 10); ctx.strokeStyle = '#3d6f9c'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, -32, 14, Math.PI, 0); ctx.stroke(); break;
      case 'TODAY': ctx.fillStyle = '#f6e3bd'; ctx.beginPath(); ctx.roundRect(-40, 0, 80, 34, 6); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#fbf1dc'; ctx.beginPath(); ctx.roundRect(-30, -22, 60, 24, 6); ctx.fill(); ctx.stroke();
        for (let i = 0; i < 9; i++) { const x = -26 + i * 6.5; ctx.fillStyle = '#7bb1e0'; ctx.fillRect(x - 1.5, -36, 3, 14); ctx.fillStyle = '#f2a830'; ctx.beginPath(); ctx.ellipse(x, -40, 2.2, 4, 0, 0, Math.PI * 2); ctx.fill(); } break;
      case 'CERT': ctx.fillStyle = '#4f8a5a'; ctx.beginPath(); ctx.roundRect(-28, -38, 56, 76, 6); ctx.fill(); ctx.stroke(); ctx.strokeStyle = '#e8d49a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, -6, 13, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-14, 20); ctx.lineTo(14, 20); ctx.stroke(); break;
      case 'TOOTH': ctx.strokeStyle = '#f2a830'; ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(-10, 4, 24, 0, Math.PI * 2); ctx.stroke(); ctx.strokeStyle = OUT; ctx.lineWidth = 3; tooth(28, -18, 1); break;
      case 'TRIKE': ctx.fillStyle = '#ffffff'; for (const [x, y, r] of [[-30, 22, 14], [30, 22, 14], [0, 18, 20]]) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke(); }
        ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-30, 22); ctx.lineTo(0, 0); ctx.lineTo(30, 22); ctx.moveTo(0, 0); ctx.lineTo(4, -26); ctx.lineTo(18, -26); ctx.moveTo(-12, -8); ctx.lineTo(-26, -8); ctx.stroke(); break;
      case 'LOST_TOOTH': ctx.fillStyle = '#7bb1e0'; ctx.beginPath(); ctx.ellipse(0, 18, 40, 16, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); tooth(0, -2, 1.3); break;
      case 'READ': ctx.fillStyle = '#fbf3e0'; ctx.beginPath(); ctx.moveTo(0, -18); ctx.quadraticCurveTo(-24, -28, -44, -20); ctx.lineTo(-44, 26); ctx.quadraticCurveTo(-24, 18, 0, 28); ctx.quadraticCurveTo(24, 18, 44, 26); ctx.lineTo(44, -20); ctx.quadraticCurveTo(24, -28, 0, -18); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, -18); ctx.lineTo(0, 28); ctx.stroke(); ctx.fillStyle = '#c0392b'; ctx.fillRect(10, -22, 6, 40); ctx.fillStyle = '#9cc7e6'; ctx.fillRect(-36, -8, 26, 18); ctx.fillStyle = '#a8d08d'; ctx.beginPath(); ctx.arc(28, 4, 9, 0, Math.PI * 2); ctx.fill(); break;
      case 'SEED': pot(); ctx.fillStyle = '#8a5a2e'; ctx.beginPath(); ctx.ellipse(0, 2, 7, 4.5, 0.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); break;
      case 'SPROUT': pot(); stem(14); leaf(0, -9, -2.6, 13); leaf(0, -9, -0.5, 13); break;
      case 'LEAVES': pot(); stem(30); leaf(0, -10, -2.7, 18); leaf(0, -10, -0.45, 18); leaf(0, -22, -2.5, 16); leaf(0, -22, -0.6, 16); break;
      case 'BUD': pot(); stem(46); leaf(0, -10, -2.7, 20); leaf(0, -12, -0.45, 20); leaf(0, -26, -2.5, 18); leaf(0, -28, -0.6, 18);
        ctx.fillStyle = '#b8c95a'; ctx.beginPath(); ctx.ellipse(0, -46, 7, 11, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); break;
      case 'FLOWER': pot(); stem(46); ctx.strokeStyle = '#4f8a3a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(16, -34); ctx.stroke(); ctx.strokeStyle = OUT; ctx.lineWidth = 3;
        leaf(0, -10, -2.7, 20); leaf(0, -12, -0.45, 20); leaf(0, -26, -2.5, 18); flower(0, -48, 7); flower(18, -36, 6); break;
      default: ctx.fillStyle = '#e8d5a8'; ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  drawTrail(ctx, from, to) {
    ctx.save(); ctx.setLineDash([3, 16]); ctx.lineCap = 'round'; ctx.lineDashOffset = -this.t * 40;
    const x0 = from.x.value, y0 = from.y.value - 40, x1 = to.x, y1 = to.y + CARD_H / 2 + 10, mx = (x0 + x1) / 2, my = Math.min(y0, y1) - 30;
    const path = () => { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(mx, my + 120, x1, y1); };
    ctx.strokeStyle = 'rgba(70,40,8,0.5)'; ctx.lineWidth = 10; path(); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,210,100,0.95)'; ctx.lineWidth = 5; path(); ctx.stroke();
    ctx.restore();
  }
  drawFx(ctx, f) {
    if (f.kind !== 'snap') return;
    const k = f.t / 0.6; ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(255,226,150,${0.7 * (1 - k)})`; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.roundRect(f.x - CARD_W / 2 - k * 14, f.y - CARD_H / 2 - k * 14, CARD_W + k * 28, CARD_H + k * 28, 14); ctx.stroke(); ctx.restore();
  }
  drawSparks(ctx) {
    if (!this.sparks.length) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const s of this.sparks) { const a = Math.sin(Math.PI * s.t / s.life) * (0.6 + 0.4 * Math.sin(s.ph)); ctx.fillStyle = `rgba(255,226,150,${a})`; ctx.beginPath(); ctx.arc(s.x + Math.sin(s.ph) * 6, s.y, s.r, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }

  // ---------------------------------------------------------------- reading card: the picture on the left, the sentence on the right (RTL)
  drawReading(ctx) {
    const cd = this.card, ev = eventOf(this.puzzle, cd.id);
    const a = Math.min(1, cd.t / 0.18), sc = 0.92 + 0.08 * a;
    ctx.save();
    ctx.fillStyle = `rgba(20,12,6,${0.36 * a})`; ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = a; ctx.translate(CARD.x, CARD.y); ctx.scale(sc, sc); ctx.translate(-CARD.x, -CARD.y);
    const x0 = CARD.x - CARD.w / 2, y0 = CARD.y - CARD.h / 2;
    ctx.fillStyle = '#f6e7c2'; ctx.strokeStyle = '#8a5a26'; ctx.lineWidth = 6; ctx.beginPath(); ctx.roundRect(x0, y0, CARD.w, CARD.h, 30); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#3f9a9a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(x0 + 14, y0 + 14, CARD.w - 28, CARD.h - 28, 22); ctx.stroke();
    this.drawEventCard(ctx, cd.id, x0 + 250, CARD.y, 1.3, { ages: this.hl.ages });
    StoryBoardP13.prototype.drawText.call(this, ctx, ev.text_fa, x0 + 440, CARD.y - 150, CARD.w - 560, 300, 54);
    if (this.voiceReady(ev.audio_key)) {
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
  layoutText(ctx, text, maxW) { return StoryBoardP13.prototype.layoutText.call(this, ctx, text, maxW); }
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
  objective() { const o = this.stage.objective_fa; return this.phase === 'done' || this.ended ? o.done : o.place; }
  drawHud(ctx) {
    const S = this.sprites, text = this.objective();
    ctx.save();
    ctx.font = `700 38px ${FONT}`; ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const tw = Math.min(ctx.measureText(text).width + 90, 1240);
    ctx.fillStyle = 'rgba(250,240,215,0.93)'; ctx.strokeStyle = 'rgba(150,110,50,0.8)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(W / 2 - tw / 2, 34, tw, 74, 20); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#4a3418'; ctx.fillText(text, W / 2, 73, 1200);
    if (this.bubble) {
      const a = Math.min(1, this.bubble.t / 0.3); ctx.globalAlpha = a;
      ctx.font = `700 34px ${FONT}`;
      const bw = Math.min(ctx.measureText(this.bubble.text).width + 80, 1700), byy = this.card ? Math.max(CARD.y + CARD.h / 2 + 30, TRAY_Y + CARD_H * TRAY_K / 2 + 60) : 128;   // below the Reading Card and the tray row
      ctx.fillStyle = 'rgba(255,248,226,0.97)'; ctx.strokeStyle = this.bubble.warn ? 'rgba(226,140,60,0.95)' : 'rgba(214,170,80,0.95)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.roundRect(W / 2 - bw / 2, byy, bw, 66, 33); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#5a3e14'; ctx.fillText(this.bubble.text, W / 2, byy + 34, 1640); ctx.globalAlpha = 1;
    }
    ctx.restore();
    const pr = this.pressT || {}, done = this.phase === 'done';
    const canHint = this.phase === 'place' && !this.ended;
    drawHudButton(ctx, S, 'btn_hint', BTN.hint, BTN_R, { disabled: !canHint, available: canHint && this.hints.available, pressed: pr.hint, t: this.t });
    drawHudButton(ctx, S, 'btn_undo', BTN.undo, BTN_R, { disabled: done || this.ended || this.phase !== 'place' || !this.ctrl.undoStack.length, pressed: pr.undo, t: this.t });
    const hasCards = this.row().some((c, i) => c && !this.ctrl.locked.includes(i));
    drawHudButton(ctx, S, 'btn_reset', BTN.reset, BTN_R, { disabled: (done && !this.ended) || (!this.ended && !hasCards), available: this.ended, pressed: pr.reset, t: this.t });
    if (this.ended && this.onExit && !this.fade) drawExitArrow(ctx, EXIT, this.t, reduceMotion);
    if (this.fade) { ctx.fillStyle = `rgba(22,16,10,${(1 - this.fade.a) * 0.85})`; ctx.fillRect(0, 0, W, H); }
    if (this.leaving) { ctx.fillStyle = `rgba(20,12,6,${this.leaving.a})`; ctx.fillRect(0, 0, W, H); }
  }
  debugState() {
    return {
      puzzle: this.stage.puzzle_id, phase: this.phase, row: this.row().map((c) => c || '_').join('>'), album: this.ctrl.album.join(',') || '-',
      card: this.card ? this.card.id : '-', hint: this.hints.level, available: this.hints.available, assist: this.ctrl.assist,
      checks: this.ctrl.checks, errors: this.ctrl.errors, reorders: this.ctrl.reorders, flagged: [...this.misc.flagged].join(',') || '-',
      mastery: this.mastery.get(this.puzzle.concept_id), clock: this.clockRun, box: Math.round(this.boxOpen.value * 100) / 100,
      bloom: Math.round(this.bloom.value * 100) / 100, world: Object.keys(this.save.data.world).join(',') || '-', music_layers: this.audio.layers, ended: this.ended,
    };
  }
}
