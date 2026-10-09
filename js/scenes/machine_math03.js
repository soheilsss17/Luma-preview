// LUMA — WS_MACHINE_ROOM / MATH-03 «ماشین‌های ورودی ـ خروجی» (book grade 3, chapter 1, pp. 13–15; card v1.0).
// Quest Q02: the workshop's old parts machine forgot its rule and the clock tower needs parts. The memory board on the
// wall keeps two examples (in → out). The child puts one of three identical rule gears into the socket and pulls the
// lever: the machine runs the memory rows in order — a match lights the row lamp green, a mismatch makes the machine
// hiccup and stop with an amber lamp, showing its own output beside the expected one (card: soft stop / warning lamp),
// and the gear pops out. When both rows match the rule is registered; then the question row (output of a new input —
// or, in practice, the textbook p.13 reverse question) is answered with a token and confirmed with the lever.
// Pure rules: edu/io_rules.js · controller: puzzles/io_machine.js · content: Content/Puzzles/MATH-03.puzzle.json
import { drawHudButton, drawExitArrow, PRESS_S } from '../engine/hud.js';
import { faDigits } from '../engine/strings.js';
import { MisconceptionEngine, HintEngine, MasteryEngine, AnalyticsQueue, SaveSlot } from '../edu/engines.js';
import { Spring, Spring2, Timeline, ease, reduceMotion } from '../engine/motion.js';
import { RigActor } from '../engine/rig.js';
import { IoMachineController } from '../puzzles/io_machine.js';
import { plaque, dotGroups } from '../edu/io_rules.js';

export const W = 1920, H = 1080;

// machine (PROP_IO_MACHINE 1024², legs bottom at y 982) standing on the brass platform of the plate
export const MACH = { cx: 1205, bottom: 880, s: 0.53 };
export const mp = (x, y) => ({ x: MACH.cx + (x - 512) * MACH.s, y: MACH.bottom + (y - 982) * MACH.s });
export const FUNNEL = mp(62, 565), SOCKET = mp(487, 400), PORT = mp(487, 642), TRAY_OUT = mp(905, 790), CHIMNEY = mp(487, 92);
const SOCKET_R = 50, PORT_R = 118 * MACH.s;
// memory board (PROP_IO_RULE_BOARD 1024², bbox centre 511,520) on the left wall above the conveyor
export const BOARD = { cx: 735, cy: 400, s: 0.46 };   // right edge x≈951 covers the lever painted on the plate's wall
export const bp = (x, y) => ({ x: BOARD.cx + (x - 511) * BOARD.s, y: BOARD.cy + (y - 520) * BOARD.s });
export const ROW_Y = [330, 575, 820], IN_X = 232, ARROW_X = 470, OUT_X = 708, LAMP_X = 870;
// lever (PROP_LEVER_A 384², plate centre at 167,227; up and down share one crop box) on the machine's right side
export const LEVER = { x: 1400, y: 640, s: 0.55, px: 167, py: 227 };
export const LEVER_HIT = { x: 1425, y: 610, r: 105 };
export const COUNTER = { x: 1815, bottom: 850, w: 190 };        // PROP_OUTPUT_COUNTER 512² on the workbench, drums at y 305
const CONV = { x0: 190, x1: 690, y: 756 };               // token centre line on the conveyor belt of the plate
export const SLOTS = [{ x: 560, y: 990 }, { x: 720, y: 990 }, { x: 880, y: 990 }];   // floor tray in front of the platform
export const GEAR_R = 50, TOK = 84;
export const BTN = { hint: { x: 90, y: 90 }, undo: { x: 220, y: 90 }, reset: { x: 350, y: 90 } };
const BTN_R = 58;
export const EXIT = { x: 1832, y: 985, r: 95 };                // after MATH-03: back to NEO's map
const FONT = 'LumaFa, Vazirmatn, Tahoma, sans-serif';
const LAMP = { off: null, green: [120, 255, 150], amber: [255, 176, 50] };

const lerp = (a, b, t) => a + (b - a) * t;
const arc = (a, b, k, h) => ({ x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k) - Math.sin(Math.PI * k) * h });

export class MachineMath03 {
  constructor({ sprites, puzzle, audio, storage, debug, strings, onExit }) {
    Object.assign(this, { sprites, puzzle, audio, debug, strings, onExit });
    this.save = new SaveSlot(storage);
    this.mastery = new MasteryEngine(storage);
    this.analytics = new AnalyticsQueue(storage, puzzle.analytics_fields);
    this.tl = new Timeline();
    this.t = 0; this.attempt = 0; this.drag = null; this.fx = []; this.movers = []; this.steam = [];
    this.aliveMix = new Spring(0, { stiffness: 4, damping: 5 });
    this.lever = new Spring(0, { stiffness: 90, damping: 11 });            // 0 up … 1 down
    this.plaqueMix = new Spring(0, { stiffness: 12, damping: 7 });         // registered rule plaques on the arrows
    this.tokenRise = new Spring(0, { stiffness: 14, damping: 8 });         // answer tokens rise into the floor tray
    this.lumi = { p: new Spring2(1500, 420, { stiffness: 30, damping: 9 }), mode: 'follow' };
    this.ended = false; this.bubble = null;
  }

  async load() {
    this.neo = await new RigActor({ id: 'NEO', scale: 0.3, x: 1565, groundY: 1010, face: -1 }).load();
    this.tiko = await new RigActor({ id: 'TIKO', scale: 0.16, x: 330, groundY: 1018, face: 1 }).load();
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
    this.ctrl = new IoMachineController(this.stage);
    this.misc = new MisconceptionEngine(this.puzzle.misconceptions, this.puzzle.misconception_flag_threshold);
    this.hints = new HintEngine(this.stage.hints, this.stage.answer_assist);
    this.stageMaxHint = 0; this.stageAssisted = false; this.stageStart = this.t; this.attempt++;
    this.lamps = ['off', 'off', 'off']; this.fx = []; this.movers = []; this.port = null; this.counterVal = null;
    this.busy = false; this.runGear = null; this.hintShow = 0; this.hintUntil = 0; this.bubble = null; this.rowPulse = 0;
    this.socketPulse = 0; this.askPulse = 0; this.spin = 0; this.shake = 0; this.leverNudge = 0; this.gone = [];
    this.plaqueMix.set(0); this.plaqueMix.target = 0; this.tokenRise.set(0); this.tokenRise.target = 0;
    this.lumi.mode = 'follow';
    if (finished) {                                        // replaying the room after the solve: the machine works
      const right = this.stage.gears.find((g) => g.op === this.stage.rule.op && g.n === this.stage.rule.n);
      this.ctrl.install(right.id); this.ctrl.run(); this.ctrl.place(this.ctrl.answer); this.ctrl.run();
      this.lamps = ['green', 'green', 'green']; this.plaqueMix.set(1); this.plaqueMix.target = 1;
      this.ended = true; this.audio.setLayers(4); this.counterVal = this.ctrl.ask.kind === 'input' ? this.ctrl.ask.out : this.ctrl.answer;
      return;
    }
    this.ended = false;
    this.audio.setLayers(idx === 0 ? 1 : idx + 1);
    this.log('puzzle_start', {});
    this.recordMastery(false);
    this.save.setPuzzle(this.stage.puzzle_id, { solved: false, entered: new Date().toISOString() });
  }

  get phase() { return this.ctrl.phase; }
  objective() { return this.phase === 'rule' ? this.stage.objective_fa : this.stage.answer_objective_fa; }
  askRow() { return 2; }
  /** Where the question row expects the child's token: the output recess, or the input recess for the reverse question. */
  askRecess() { return this.stage.ask.kind === 'input' ? bp(IN_X, ROW_Y[2]) : bp(OUT_X, ROW_Y[2]); }
  answerKind() { return this.stage.ask.kind === 'input' ? 'in' : 'out'; }

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

  // ---------------------------------------------------------------- actions
  install(id) {
    const r = this.ctrl.install(id);
    if (!r) return null;
    this.hints.onActivity();
    this.audio.windClick(); this.tl.after(0.08, () => this.audio.gearTick());
    this.fx.push({ kind: 'seat', t: 0 });
    this.log('gear_installed', { rule_attempted: plaque(this.ctrl.gear(id)) });
    this.tiko.faceTowards(SOCKET.x);
    return r;
  }
  uninstall() {
    const id = this.ctrl.uninstall();
    if (id) { this.audio.snap(); this.log('gear_removed', { rule_attempted: plaque(this.ctrl.gear(id)) }); }
    return id;
  }

  /** The lever: runs the memory (rule phase) or the question row (answer phase). */
  pullLever() {
    if (this.busy || this.ended) return;
    if (!this.ctrl.canRun()) {                            // nothing to run yet: the lever just wiggles, the socket / recess glows
      this.leverNudge = 0.45; this.audio.snap();
      if (this.phase === 'rule') this.socketPulse = 1.4; else this.askPulse = 1.4;
      return;
    }
    const gear = this.ctrl.installedGear;
    const plan = this.ctrl.run();
    this.busy = true; this.runGear = plan.kind === 'memory' ? plan.gear : this.ctrl.installed; this.hintShow = 0;
    this.lever.target = 1; this.tl.after(0.45, () => { this.lever.target = 0; });
    this.neo.faceTowards(LEVER.x); this.neo.play('pull', 'idle');
    this.audio.machineStart(); this.shake = Math.max(this.shake, 0.25); this.puff(CHIMNEY, 6);
    this.lamps = this.lamps.map((l, i) => (plan.kind === 'memory' ? 'off' : i < 2 ? 'green' : 'off'));
    if (plan.kind === 'memory') {
      this.log('rule_attempted', { rule_attempted: plaque(gear) });
      let t = 0.5;
      plan.rows.forEach((row) => {
        this.tl.after(t, () => this.playPass({ row: row.row, input: row.in, got: row.got, ok: row.ok }));
        t += 3.35;
      });
      this.tl.after(t - 0.2, () => (plan.allOk ? this.onRegistered(plan) : this.onRunFail(plan)));
    } else {
      this.tl.after(0.5, () => this.playPass({ row: 2, input: plan.in, got: plan.out, ok: true }));
      this.tl.after(0.5 + 3.35, () => this.onSolved());
    }
  }

  /** One token through the machine (AN_MACHINE_START → PROCESS → OUTPUT): board → conveyor → funnel → porthole → tray → board. */
  playPass({ row, input, got, ok }) {
    const from = bp(IN_X, ROW_Y[row]), belt0 = { x: CONV.x0, y: CONV.y }, belt1 = { x: CONV.x1, y: CONV.y };
    const m = { kind: 'in', value: input, x: from.x, y: from.y, a: 1, s: 1, rot: 0 };
    this.movers.push(m);
    this.tl.tween(0.4, (k) => { const p = arc(from, belt0, ease.inOutSine(k), 120); m.x = p.x; m.y = p.y; });
    this.tl.after(0.4, () => { this.audio.woodClick(); this.log('input_entered', { input_entered: input }); });
    this.tl.after(0.4, () => this.tl.tween(0.6, (k) => { m.x = lerp(belt0.x, belt1.x, k); m.y = belt0.y; m.rot = k * 5; }));
    for (let i = 0; i < 4; i++) this.tl.after(0.45 + i * 0.15, () => this.audio.gearRotate(i));
    this.tl.after(1.0, () => this.tl.tween(0.4, (k) => {
      const p = arc(belt1, FUNNEL, k, 150); m.x = p.x; m.y = p.y; m.s = 1 - 0.45 * k; m.a = k < 0.75 ? 1 : 1 - (k - 0.75) / 0.25;
    }, () => { this.movers = this.movers.filter((q) => q !== m); }));
    // processing: the porthole shows what went in, the rule gear spins, steam, then what comes out
    this.tl.after(1.4, () => { this.port = { value: input, warm: false, t: 0 }; this.spin = 1; this.shake = Math.max(this.shake, 0.12); });
    for (let i = 0; i < 6; i++) this.tl.after(1.45 + i * 0.15, () => { this.audio.gearRotate(i); if (i % 2 === 0) this.puff(CHIMNEY, 2); });
    this.tl.after(1.85, () => { this.port = { value: got, warm: true, t: 0 }; });
    this.tl.after(2.3, () => {
      this.spin = 0; this.audio.outputDrop(); this.counterVal = got;
      this.log('output_observed', { output_observed: got, input_entered: input });
    });
    const out = { kind: 'out', value: got, x: TRAY_OUT.x, y: TRAY_OUT.y, a: 1, s: 0.5, rot: 0, wrong: !ok };
    this.tl.after(2.3, () => {
      this.movers.push(out);
      this.tl.tween(0.25, (k) => { out.s = 0.5 + 0.5 * ease.outCubic(k); out.y = TRAY_OUT.y - 20 * Math.sin(Math.PI * k); });
    });
    const target = bp(OUT_X, ROW_Y[row]), beside = { x: target.x - 52, y: target.y - 22 };
    this.tl.after(2.6, () => this.tl.tween(0.55, (k) => {
      const p = arc(TRAY_OUT, ok ? target : beside, ease.inOutSine(k), 170); out.x = p.x; out.y = p.y; out.rot = ok ? 0 : -0.22 * k;
    }));
    this.tl.after(3.2, () => {
      if (ok) {                                           // the produced token settles into the memory recess: green lamp
        this.lamps[row] = 'green'; this.audio.gardenChime(row + 2); this.fx.push({ kind: 'spark', x: target.x, y: target.y, t: 0 });
        this.tl.tween(0.3, (k) => { out.a = 1 - k; });
        this.tl.after(0.31, () => { this.movers = this.movers.filter((q) => q !== out); });
        this.port = null;
      } else {                                            // AN_MACHINE_FAIL_SOFT: hiccup, steam puff, amber lamp — never harsh
        this.lamps[row] = 'amber'; this.audio.machineFailSoft(); this.shake = 0.7;
        this.puff(CHIMNEY, 10); this.puff({ x: MACH.cx - 150, y: MACH.bottom - 60 }, 5); this.puff({ x: MACH.cx + 150, y: MACH.bottom - 60 }, 5);
        this.neo.play('confused', 'idle'); this.tiko.play('concerned', 'idle');
        out.hold = true;
        this.tl.after(2.4, () => this.tl.tween(0.4, (k) => { out.a = 1 - k; }, () => { this.movers = this.movers.filter((q) => q !== out); }));
        this.tl.after(0.6, () => { this.port = null; });
      }
    });
  }

  onRunFail(plan) {
    const def = this.observe(plan.rule);
    const g = this.ctrl.gear(plan.gear);
    this.log('rule_error', { rule_attempted: plaque(g), rule_error: plan.rule, error_type: def ? def.error_type : 'ConceptError',
      misconception: def ? def.code : null, output_observed: plan.rows[plan.rows.length - 1].got });
    // after a moment to compare (machine's number beside the memory's), the gear pops out and rolls back to the tray
    this.tl.after(0.9, () => { this.fx.push({ kind: 'gearHome', id: plan.gear, t: 0 }); this.audio.snap(); });
    const out = this.hints.onWrong();
    this.tl.after(1.65, () => { this.runGear = null; });
    this.tl.after(3.0, () => {
      this.busy = false; this.lamps = ['off', 'off', 'off'];
      if (out === 'assist') this.applyAssist();
    });
  }

  onRegistered() {
    this.stageMaxHint = Math.max(this.stageMaxHint, this.hints.maxUsed);
    this.log('rule_registered', { rule_attempted: plaque(this.ctrl.installedGear), hint_level: this.hints.maxUsed });
    this.audio.stamp(); this.tl.after(0.2, () => this.audio.chime());
    this.plaqueMix.target = 1; this.lamps = ['green', 'green', 'off'];
    for (const g of this.stage.gears) if (g.id !== this.ctrl.installed && !this.ctrl.removed.includes(g.id)) this.gone.push({ id: g.id, t: 0 });
    this.neo.play('happy', 'idle'); this.tiko.play('happy', 'idle');
    this.audio.setLayers(Math.min(4, this.stageIdx + 2));
    // the question row: a new hint round for the answer (stageMaxHint keeps the maximum of both phases)
    this.hints = new HintEngine(this.stage.hints, this.stage.answer_assist);
    this.tl.after(0.9, () => { this.tokenRise.target = 1; this.askPulse = 2; this.audio.pickup(); });
    this.tl.after(1.3, () => { this.busy = false; this.runGear = null; });
  }

  placeAnswer(value, from) {
    if (this.busy || this.phase !== 'answer' || this.ctrl.placed !== null) return null;
    const r = this.ctrl.place(value);
    if (!r) return null;
    this.hints.onActivity();
    const at = this.askRecess();
    if (r.ok) {
      this.audio.woodClick(); this.tl.after(0.06, () => this.audio.chime());
      this.fx.push({ kind: 'spark', x: at.x, y: at.y, t: 0 });
      this.log('answer_placed', { rule_attempted: String(value) });
      this.leverNudge = 0; this.fx.push({ kind: 'leverGlow', t: 0 });
      return r;
    }
    // the warning lamp: the token touches the recess, bounces back to its slot
    this.lamps[2] = 'amber'; this.audio.flicker(); this.tl.after(1.3, () => { if (this.lamps[2] === 'amber') this.lamps[2] = 'off'; });
    this.fx.push({ kind: 'bounce', value, from: from || this.slotOf(value), t: 0 });
    const def = this.observe(r.rule);
    this.log('rule_error', { rule_attempted: String(value), rule_error: r.rule, error_type: def ? def.error_type : 'ValueError',
      misconception: def ? def.code : null });
    this.tiko.play('concerned', 'idle');
    if (this.hints.onWrong() === 'assist') this.tl.after(1.1, () => this.applyAssist());
    return r;
  }
  unplace() {
    const v = this.ctrl.unplace();
    if (v !== null) this.audio.snap();
    return v;
  }

  applyAssist() {
    if (this.ended || this.phase === 'solved') return;
    const a = this.ctrl.assistRemove();
    if (!a) return;
    this.stageAssisted = true;
    this.gone.push({ id: a.kind === 'gear' ? a.id : 'v' + a.value, t: 0 });
    this.audio.shimmer();
    this.log('puzzle_interaction', { action: 'answer_assist', removed: a.kind === 'gear' ? a.id : a.value });
  }

  onSolved() {
    this.stageMaxHint = Math.max(this.stageMaxHint, this.hints.maxUsed);
    const transfer = this.stage.stage === 'transfer';
    this.log('solved', { solved: true, assisted: this.stageAssisted });
    this.log('puzzle_solved', { assisted: this.stageAssisted });
    if (transfer) this.log('transfer_solved', { transfer_solved: true, hint_level: this.stageMaxHint });
    this.recordMastery(true);
    this.save.setPuzzle(this.stage.puzzle_id, { solved: true, hint_max: this.stageMaxHint, assisted: this.stageAssisted });
    this.lamps[2] = 'green';
    for (const v of this.ctrl.options) this.gone.push({ id: 'v' + v, t: 0 });      // the other tokens sink away
    this.ctrl.options = [];
    this.audio.motif(); this.neo.play('happy', 'idle'); this.tiko.play('happy', 'idle');
    if (this.stageIdx < this.puzzle.stages.length - 1) {
      this.tl.after(2.4, () => this.transition(() => this.startStage(this.stageIdx + 1)));
      return;
    }
    // WS_IO_MACHINE_ON: the machine wakes for good — lamp, warm window, steam; the counter bell rings; a part for the clock
    this.tl.after(0.6, () => {
      this.save.setFlag(this.puzzle.world_state_on_solve);
      this.audio.bell(); this.audio.setLayers(4); this.aliveMix.target = 1;
      this.fx.push({ kind: 'bell', t: 0 }); this.puff(CHIMNEY, 16);
      this.neo.play('celebrate', 'idle'); this.tiko.play('celebrate', 'idle'); this.lumi.mode = 'celebrate';
      this.tl.after(3.2, () => { this.lumi.mode = 'follow'; this.ended = true; this.busy = false; });
    });
  }

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
    const keep = { misc: this.misc, hints: this.hints, maxHint: this.stageMaxHint, assisted: this.stageAssisted };
    this.ctrl = new IoMachineController(this.stage);
    this.misc = keep.misc; this.hints = new HintEngine(this.stage.hints, this.stage.answer_assist);
    this.hints.maxUsed = keep.hints.maxUsed; this.hints.wrong = keep.hints.wrong; this.hints.available = keep.hints.available;
    this.stageMaxHint = keep.maxHint; this.stageAssisted = false;
    this.lamps = ['off', 'off', 'off']; this.plaqueMix.target = 0; this.tokenRise.target = 0; this.gone = []; this.counterVal = null;
    this.audio.snap();
  }

  // ================================================================= geometry / hit tests
  slotOf(key) {                                           // gear id → its slot; answer value → its slot
    if (typeof key === 'string') return SLOTS[this.stage.gears.findIndex((g) => g.id === key)];
    return SLOTS[this.stage.answer_options.indexOf(key)];
  }
  gearAt(x, y) {
    for (const id of this.ctrl.tray) { const s = this.slotOf(id); if (Math.hypot(x - s.x, y - s.y) < GEAR_R + 16) return id; }
    return null;
  }
  tokenAt(x, y) {
    for (const v of this.ctrl.options) { const s = this.slotOf(v); if (Math.hypot(x - s.x, y - (s.y - 6)) < TOK / 2 + 14) return v; }
    return null;
  }
  onLever(x, y) { return Math.hypot(x - LEVER_HIT.x, y - LEVER_HIT.y) < LEVER_HIT.r; }

  // ================================================================= input
  pointerDown(x, y) {
    this.audio.unlock();
    if (this.hints) this.hints.onActivity();
    for (const [name, b] of Object.entries(BTN)) if (Math.hypot(x - b.x, y - b.y) <= BTN_R) return this.button(name);
    if (this.fade || this.leaving) return;
    if (this.ended && this.onExit && Math.hypot(x - EXIT.x, y - EXIT.y) < EXIT.r) return this.leave();
    this.down = { x, y };
    if (!this.busy && !this.ended) {
      if (this.phase === 'rule') {
        const id = this.gearAt(x, y);
        if (id) { const s = this.slotOf(id); this.drag = { kind: 'gear', id, from: 'tray', p: new Spring2(s.x, s.y, { stiffness: 260, damping: 22 }), moved: false }; this.audio.pickup(); return; }
        if (this.ctrl.installed && Math.hypot(x - SOCKET.x, y - SOCKET.y) < SOCKET_R + 14) {
          this.drag = { kind: 'gear', id: this.ctrl.installed, from: 'socket', p: new Spring2(SOCKET.x, SOCKET.y, { stiffness: 260, damping: 22 }), moved: false };
          this.audio.pickup(); return;
        }
      } else if (this.phase === 'answer') {
        const v = this.tokenAt(x, y);
        if (v !== null) { const s = this.slotOf(v); this.drag = { kind: 'token', value: v, p: new Spring2(s.x, s.y - 6, { stiffness: 260, damping: 22 }), moved: false }; this.audio.pickup(); return; }
        const at = this.askRecess();
        if (this.ctrl.placed !== null && Math.hypot(x - at.x, y - at.y) < TOK / 2 + 10) return this.unplace();
      }
      if (this.onLever(x, y)) return this.pullLever();
    }
    for (const a of this.actors) if (a.hit(x, y)) { a.play('happy', 'idle'); return; }
  }
  pointerMove(x, y) {
    if (!this.drag) return;
    if (this.down && Math.hypot(x - this.down.x, y - this.down.y) > 12) this.drag.moved = true;
    if (this.drag.moved) this.drag.p.to(x, y);
  }
  pointerUp(x, y) {
    const d = this.drag; this.drag = null;
    if (!d || this.busy) return;
    if (d.kind === 'gear') {
      if (!d.moved) return d.from === 'tray' ? this.install(d.id) : this.uninstall();     // tap works too
      const near = Math.hypot(x - SOCKET.x, y - SOCKET.y) < 115;
      if (d.from === 'tray' && near) return this.install(d.id);
      if (d.from === 'socket' && !near) return this.uninstall();
      this.fx.push({ kind: 'gearBack', id: d.id, x, y, to: d.from === 'tray' ? this.slotOf(d.id) : SOCKET, t: 0 });
      return;
    }
    const at = this.askRecess();
    if (!d.moved || Math.hypot(x - at.x, y - at.y) < 95) return this.placeAnswer(d.value, d.moved ? { x, y } : null);
    this.fx.push({ kind: 'tokenBack', value: d.value, x, y, t: 0 });
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
      if (busy || this.ended) return;
      if (this.ctrl.undo()) { this.audio.snap(); this.log('puzzle_interaction', { action: 'undo' }); }
    } else if (name === 'reset') {
      if (this.ended) return this.replay();
      if (busy) return;
      this.resetStage();
    }
  }

  showHint(h) {
    this.stageMaxHint = Math.max(this.stageMaxHint, h.level);
    if (h.text_key && this.strings) { this.bubble = { text: this.strings.t(h.text_key), t: 0 }; this.tl.after(5.5, () => { this.bubble = null; }); }
    this.hintShow = h.level; this.hintUntil = this.t + (h.level === 1 ? 5 : 10);
    if (h.level === 1) { this.lumi.mode = 'rows'; this.lumi.k = 0; this.rowPulse = 4.6; }
    else { this.lumi.mode = 'hint'; this.lumi.target = h.level === 2 ? { x: 470, y: 190 } : bp(ARROW_X, ROW_Y[0] - 110); }
    this.tl.after(h.level === 1 ? 4.6 : 4, () => { if (this.lumi.mode !== 'celebrate') this.lumi.mode = 'follow'; });
  }

  puff(at, n) {
    if (reduceMotion) n = Math.ceil(n / 3);
    for (let i = 0; i < n; i++) {
      this.steam.push({ x: at.x + (Math.random() - 0.5) * 30, y: at.y, vx: (Math.random() - 0.5) * 40, vy: -60 - Math.random() * 60,
        r: 14 + Math.random() * 16, t: 0, life: 1.2 + Math.random() * 0.8 });
    }
  }

  // ================================================================= update
  update(dt) {
    if (this.pressT) for (const k in this.pressT) this.pressT[k] = Math.max(0, this.pressT[k] - dt);
    this.t += dt;
    this.tl.update(dt);
    if (this.hints && !this.ended && !this.busy) this.hints.tick(dt);
    for (const s of [this.aliveMix, this.lever, this.plaqueMix, this.tokenRise]) s.update(dt);
    if (this.drag) this.drag.p.update(dt);
    if (this.bubble) this.bubble.t += dt;
    if (this.port) this.port.t += dt;
    if (this.hintShow && this.t > this.hintUntil) this.hintShow = 0;
    this.rowPulse = Math.max(0, this.rowPulse - dt); this.socketPulse = Math.max(0, this.socketPulse - dt);
    this.askPulse = Math.max(0, this.askPulse - dt); this.leverNudge = Math.max(0, this.leverNudge - dt);
    this.shake = Math.max(0, this.shake - dt);
    if (this.spin) this.gearAngle = (this.gearAngle || 0) + dt * 5;
    for (const f of this.fx) f.t += dt;
    this.fx = this.fx.filter((f) => f.t < ({ gearHome: 0.75, gearBack: 0.3, tokenBack: 0.3, bounce: 0.8, spark: 0.9, seat: 0.4, leverGlow: 30, bell: 1.6 }[f.kind] || 1));
    if (this.phase !== 'answer' || this.ctrl.placed === null || this.busy) this.fx = this.fx.filter((f) => f.kind !== 'leverGlow');
    for (const g of this.gone) g.t += dt;
    for (const p of this.steam) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.r += dt * 18; }
    this.steam = this.steam.filter((p) => p.t < p.life);
    if (this.aliveMix.value > 0.5 && !reduceMotion && Math.random() < dt * 1.2) this.puff(CHIMNEY, 1);     // AN_MACHINE_IDLE (working)
    for (const a of this.actors) a.update(dt);
    if (this.tiko.clip === 'idle') this.tiko.faceTowards(this.busy ? MACH.cx : BOARD.cx);
    if (this.neo.clip === 'idle') this.neo.faceTowards(MACH.cx);
    const lm = this.lumi;
    if (lm.mode === 'follow') { const h = this.neo.headPoint(); lm.p.to(h.x + 60, h.y - 70 + Math.sin(this.t * 2.1) * 12); }
    else if (lm.mode === 'rows') {                         // H1: between the first and the second memory row, back and forth
      lm.k += dt; const k = 0.5 - 0.5 * Math.cos(lm.k * 2.4);
      const rows = this.phase === 'answer' ? [ROW_Y[0], ROW_Y[2]] : [ROW_Y[0], ROW_Y[1]];
      const a = bp(ARROW_X, rows[0] - 40), b = bp(ARROW_X, rows[1] - 40); lm.p.to(lerp(a.x, b.x, k) + Math.sin(lm.k * 5) * 30, lerp(a.y, b.y, k));
    } else if (lm.mode === 'hint') lm.p.to(lm.target.x + Math.cos(this.t * 3) * 36, lm.target.y + Math.sin(this.t * 3) * 16);
    else if (lm.mode === 'celebrate') lm.p.to(1150 + Math.cos(this.t * 1.6) * 380, 330 + Math.sin(this.t * 3.2) * 60);
    if (reduceMotion && lm.mode !== 'celebrate') lm.p.set(lm.p.x.target, lm.p.y.target);
    lm.p.update(dt);
  }

  // ================================================================= draw
  img(name) { return this.sprites.get(name); }

  draw(ctx) {
    const plate = this.img('machine_room'), alive = this.img('machine_room_on');
    if (plate) ctx.drawImage(plate, 0, 0, W, H);
    if (alive && this.aliveMix.value > 0.01) { ctx.globalAlpha = Math.min(1, this.aliveMix.value); ctx.drawImage(alive, 0, 0, W, H); ctx.globalAlpha = 1; }
    this.drawBoard(ctx);
    this.tiko.draw(ctx);
    this.drawMachine(ctx);
    this.drawLever(ctx);
    this.drawCounter(ctx);
    this.drawTray(ctx);
    this.neo.draw(ctx);
    for (const m of this.movers) this.drawToken(ctx, m.kind, m.value, m.x, m.y, { s: m.s, a: m.a, rot: m.rot, ring: m.wrong && m.hold ? LAMP.amber : null });
    for (const f of this.fx) this.drawFx(ctx, f);
    this.drawSteam(ctx);
    if (this.hintShow >= 2) this.drawDots(ctx);
    this.drawDragged(ctx);
    this.drawLumi(ctx);
    this.drawHud(ctx);
  }

  drawToken(ctx, kind, value, x, y, { s = 1, a = 1, rot = 0, glow = 0, ring = null } = {}) {
    const im = this.img(kind === 'in' ? 'token_in' : 'token_out'), size = TOK * s;
    ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y); ctx.rotate(rot);
    if (glow > 0) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(0, 0, 4, 0, 0, size * 0.9);
      g.addColorStop(0, `rgba(255,230,160,${0.5 * glow})`); g.addColorStop(1, 'rgba(255,230,160,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, size * 0.9, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    if (im) ctx.drawImage(im, -size / 2, -size / 2, size, size);
    if (ring) { ctx.strokeStyle = `rgba(${ring.join(',')},0.95)`; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 0, size * 0.47, 0, Math.PI * 2); ctx.stroke(); }
    ctx.rotate(-rot);
    ctx.font = `800 ${Math.round(36 * s)}px ${FONT}`; ctx.direction = 'ltr'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const dark = kind !== 'in';                          // walnut output tokens: cream digits; honey input tokens: brown digits
    ctx.lineWidth = 5 * s; ctx.strokeStyle = dark ? 'rgba(40,22,8,0.85)' : 'rgba(255,244,214,0.75)'; ctx.fillStyle = dark ? '#fbeccb' : '#3a2410';
    const txt = faDigits(value); ctx.strokeText(txt, 0, 3 * s); ctx.fillText(txt, 0, 3 * s);
    ctx.restore();
  }

  drawRuleGear(ctx, gear, x, y, angle = 0, { a = 1, s = 1, glow = 0 } = {}) {
    const im = this.img('gear_large'), info = this.sprites.info ? this.sprites.info('gear_large') : null;
    const g = (info && info.gear) || { tip_r: 190, center: [192, 192] }, k = (GEAR_R / g.tip_r) * s;
    ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y);
    if (glow > 0) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const gr = ctx.createRadialGradient(0, 0, 10, 0, 0, GEAR_R * 1.6 * s);
      gr.addColorStop(0, `rgba(255,220,140,${0.45 * glow})`); gr.addColorStop(1, 'rgba(255,220,140,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, GEAR_R * 1.6 * s, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    ctx.save(); ctx.rotate(angle);
    if (im) ctx.drawImage(im, -g.center[0] * k, -g.center[1] * k, 384 * k, 384 * k);            // gear_large is 384² (manifest)
    ctx.restore();
    // identical gears (IO-M02 by design): only the enamel plaque in the hub differs
    const r = 27 * s;
    ctx.fillStyle = '#f6ecd2'; ctx.strokeStyle = '#8a6424'; ctx.lineWidth = 3 * s;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.font = `800 ${Math.round(28 * s)}px ${FONT}`; ctx.direction = 'ltr'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#3a2410'; ctx.fillText(plaque(gear, faDigits), 0, 2 * s);
    ctx.restore();
  }

  drawBoard(ctx) {
    const im = this.img('io_board'), s = BOARD.s;
    if (im) ctx.drawImage(im, BOARD.cx - 511 * s, BOARD.cy - 520 * s, 1024 * s, 1024 * s);
    const st = this.stage, ask = st.ask;
    // H1: the two rows pulse together
    if (this.rowPulse > 0) {
      const a = 0.35 + 0.25 * Math.sin(this.t * 7), rows = this.phase === 'answer' ? [0, 1, 2] : [0, 1];
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,220,140,${a * Math.min(1, this.rowPulse)})`;
      for (const r of rows) { const p = bp(130, ROW_Y[r] - 105); ctx.beginPath(); ctx.roundRect(p.x, p.y, 700 * s, 210 * s, 18); ctx.fill(); }
      ctx.restore();
    }
    st.memory.forEach((m, i) => {
      const a = bp(IN_X, ROW_Y[i]), b = bp(OUT_X, ROW_Y[i]);
      this.drawToken(ctx, 'in', m.in, a.x, a.y); this.drawToken(ctx, 'out', m.out, b.x, b.y);
    });
    // question row: the known number, and a pulsing question mark (or the child's token) in the other recess
    const qi = bp(IN_X, ROW_Y[2]), qo = bp(OUT_X, ROW_Y[2]), q = this.askRecess();
    if (ask.kind === 'input') this.drawToken(ctx, 'out', ask.out, qo.x, qo.y); else this.drawToken(ctx, 'in', ask.in, qi.x, qi.y);
    if (this.ctrl.placed !== null) this.drawToken(ctx, this.answerKind(), this.ctrl.placed, q.x, q.y);
    else {
      const pulse = this.phase === 'answer' ? 0.65 + 0.35 * Math.sin(this.t * 4) + Math.min(1, this.askPulse) * 0.4 : 0.35;
      ctx.save(); ctx.font = `800 52px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = `rgba(255,236,190,${Math.min(1, pulse)})`; ctx.fillText('؟', q.x, q.y + 4); ctx.restore();
      if (this.hintShow === 3 && this.phase === 'answer') this.drawToken(ctx, this.answerKind(), this.ctrl.answer, q.x, q.y, { a: 0.35 + 0.15 * Math.sin(this.t * 4) });
    }
    // registered rule plaques on the arrows (and the H3 ghost plaque on the first arrow)
    const pm = Math.min(1, this.plaqueMix.value);
    for (let i = 0; i < 3; i++) {
      const ghost = this.hintShow === 3 && this.phase === 'rule' && i === 0;
      const a = ghost ? 0.45 + 0.2 * Math.sin(this.t * 4) : pm;
      if (a > 0.02) this.drawPlaque(ctx, bp(ARROW_X + 10, ROW_Y[i] - 62), plaque(st.rule, faDigits), a);
    }
    // row lamps
    this.lamps.forEach((l, i) => {
      const c = LAMP[l]; if (!c) return;
      const p = bp(LAMP_X, ROW_Y[i]), k = 0.8 + 0.2 * Math.sin(this.t * 6);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, 58);
      g.addColorStop(0, `rgba(${c.join(',')},${0.8 * k})`); g.addColorStop(1, `rgba(${c.join(',')},0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, 58, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(${c.join(',')},0.9)`; ctx.beginPath(); ctx.ellipse(p.x, p.y, 9, 18, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    });
  }

  drawPlaque(ctx, p, text, a) {
    ctx.save(); ctx.globalAlpha = a;
    ctx.fillStyle = '#f6ecd2'; ctx.strokeStyle = '#8a6424'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(p.x - 38, p.y - 20, 76, 40, 10); ctx.fill(); ctx.stroke();
    ctx.font = `800 28px ${FONT}`; ctx.direction = 'ltr'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#3a2410'; ctx.fillText(text, p.x, p.y + 2);
    ctx.restore();
  }

  drawMachine(ctx) {
    const im = this.img('io_machine'), s = MACH.s;
    const sh = this.shake > 0 && !reduceMotion ? Math.sin(this.t * 60) * 6 * this.shake : 0;
    const breathe = 1 + 0.004 * Math.sin(this.t * (this.aliveMix.value > 0.5 ? 3 : 1.2));
    ctx.save(); ctx.translate(MACH.cx + sh, MACH.bottom); ctx.scale(1, breathe);
    ctx.fillStyle = 'rgba(30,18,8,0.28)'; ctx.beginPath(); ctx.ellipse(0, -4, 290, 26, 0, 0, Math.PI * 2); ctx.fill();
    if (im) ctx.drawImage(im, -512 * s, -982 * s, 1024 * s, 1024 * s);
    ctx.restore();
    // porthole: what goes in (cool) and what comes out (warm)
    const glow = this.port ? 1 : this.aliveMix.value * 0.4;
    if (glow > 0.01) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const c = this.port && !this.port.warm ? '150,200,255' : '255,200,120';
      const g = ctx.createRadialGradient(PORT.x + sh, PORT.y, 6, PORT.x + sh, PORT.y, PORT_R);
      g.addColorStop(0, `rgba(${c},${0.45 * glow})`); g.addColorStop(1, `rgba(${c},0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(PORT.x + sh, PORT.y, PORT_R, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    if (this.port) {
      const k = Math.min(1, this.port.t / 0.15);
      ctx.save(); ctx.globalAlpha = k; ctx.font = `800 ${Math.round(58 + 6 * (1 - k))}px ${FONT}`; ctx.direction = 'ltr';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = this.port.warm ? '#5a2e08' : '#1f3a5a';
      ctx.fillText(faDigits(this.port.value), PORT.x + sh, PORT.y + 4); ctx.restore();
    }
    // rule-gear socket over the gear window
    ctx.save();
    ctx.fillStyle = 'rgba(40,26,12,0.85)'; ctx.strokeStyle = '#c99a44'; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.arc(SOCKET.x + sh, SOCKET.y, SOCKET_R + 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();
    const home = this.fx.find((f) => f.kind === 'gearHome');
    const sg = this.drag && this.drag.from === 'socket' ? null : home ? null : this.busy ? this.runGear : this.ctrl.installed;
    if (sg) {
      const seat = this.fx.find((f) => f.kind === 'seat'), pop = seat ? 1 + 0.12 * Math.sin(Math.PI * seat.t / 0.4) : 1;
      this.drawRuleGear(ctx, this.ctrl.gear(sg), SOCKET.x + sh, SOCKET.y, this.gearAngle || 0, { s: pop, glow: this.spin ? 0.6 : 0 });
    } else if (this.phase === 'rule' && !this.drag) {       // empty socket breathes (stronger after a lever try without a gear)
      const a = 0.25 + 0.2 * Math.sin(this.t * 3) + Math.min(1, this.socketPulse) * 0.5;
      ctx.save(); ctx.strokeStyle = `rgba(255,220,140,${a})`; ctx.lineWidth = 4; ctx.setLineDash([10, 10]);
      ctx.beginPath(); ctx.arc(SOCKET.x, SOCKET.y, SOCKET_R - 4, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
  }

  drawLever(ctx) {
    const up = this.img('lever_up'), dn = this.img('lever_down'), s = LEVER.s, k = Math.max(0, Math.min(1, this.lever.value));
    const wig = this.leverNudge > 0 ? Math.sin(this.leverNudge * 40) * 0.04 : 0;
    ctx.save(); ctx.translate(LEVER.x, LEVER.y); ctx.rotate(wig);
    const glowF = this.fx.find((f) => f.kind === 'leverGlow');
    if (glowF) {                                           // the answer token is in place: the lever invites a pull
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const a = 0.6 + 0.3 * Math.sin(this.t * 5);
      const g = ctx.createRadialGradient(20, -50, 6, 20, -50, 130);
      g.addColorStop(0, `rgba(255,220,140,${a})`); g.addColorStop(1, 'rgba(255,220,140,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(20, -50, 130, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    const x0 = -LEVER.px * s, y0 = -LEVER.py * s, sz = 384 * s;
    if (up && k < 0.99) { ctx.globalAlpha = 1 - k; ctx.drawImage(up, x0, y0, sz, sz); }
    if (dn && k > 0.01) { ctx.globalAlpha = k; ctx.drawImage(dn, x0, y0, sz, sz); }
    ctx.restore();
  }

  drawCounter(ctx) {
    const im = this.img('io_counter'), s = COUNTER.w / 512, x0 = COUNTER.x - 256 * s, y0 = COUNTER.bottom - 491 * s;
    const bell = this.fx.find((f) => f.kind === 'bell'), wob = bell && !reduceMotion ? Math.sin(bell.t * 30) * 0.03 * (1 - bell.t / 1.6) : 0;
    ctx.save(); ctx.translate(COUNTER.x, COUNTER.bottom); ctx.rotate(wob); ctx.translate(-COUNTER.x, -COUNTER.bottom);
    if (im) ctx.drawImage(im, x0, y0, 512 * s, 512 * s);
    if (this.counterVal !== null) {                        // drums: right-aligned digits (Persian digits, left-to-right number)
      const d = faDigits(this.counterVal).split(''), drums = [252, 322, 394];
      ctx.font = `800 30px ${FONT}`; ctx.direction = 'ltr'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#3a2410';
      d.slice(-3).forEach((ch, i, arr) => { const j = drums.length - arr.length + i; ctx.fillText(ch, x0 + drums[j] * s, y0 + 308 * s); });
    }
    ctx.restore();
  }

  drawTray(ctx) {
    const lift = Math.min(1, this.tokenRise.value);
    // wooden floor tray
    ctx.save(); ctx.fillStyle = 'rgba(40,24,10,0.35)';
    ctx.beginPath(); ctx.ellipse(720, 1030, 250, 26, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    const goneA = (id) => { const g = this.gone.find((q) => q.id === id); return g ? Math.max(0, 1 - g.t / 0.6) : 1; };
    const hidden = (id) => (this.drag && this.drag.kind === 'gear' && this.drag.id === id) || this.fx.some((f) => (f.kind === 'gearHome' || f.kind === 'gearBack') && f.id === id);
    this.stage.gears.forEach((g, i) => {
      const inTray = this.ctrl.tray.includes(g.id) || (this.phase !== 'rule' && g.id !== this.ctrl.installed);
      if (!inTray || hidden(g.id)) return;
      const a = this.phase === 'rule' ? goneA(g.id) : goneA(g.id) * (1 - lift);
      if (a <= 0.01) return;
      const s = SLOTS[i], sink = (1 - a) * 40;
      this.drawRuleGear(ctx, g, s.x, s.y + sink, 0, { a });
    });
    if (lift > 0.01 && this.phase !== 'rule') {
      this.stage.answer_options.forEach((v, i) => {
        if (!this.ctrl.options.includes(v) && !this.gone.some((q) => q.id === 'v' + v)) return;
        if (this.drag && this.drag.kind === 'token' && this.drag.value === v) return;
        if (this.fx.some((f) => (f.kind === 'bounce' || f.kind === 'tokenBack') && f.value === v)) return;
        const s = SLOTS[i], a = this.ctrl.options.includes(v) ? lift : goneA('v' + v);
        if (a > 0.01) this.drawToken(ctx, this.answerKind(), v, s.x, s.y - 6 + (1 - lift) * 40, { a });
      });
    }
  }

  drawFx(ctx, f) {
    if (f.kind === 'gearHome') {                           // pops out of the socket, arcs back to its slot
      const k = Math.min(1, f.t / 0.75), s = this.slotOf(f.id), p = arc(SOCKET, s, ease.outCubic(k), 160);
      this.drawRuleGear(ctx, this.ctrl.gear(f.id), p.x, p.y, -k * 6);
    } else if (f.kind === 'gearBack') {
      const k = Math.min(1, f.t / 0.3); this.drawRuleGear(ctx, this.ctrl.gear(f.id), lerp(f.x, f.to.x, k), lerp(f.y, f.to.y, k));
    } else if (f.kind === 'tokenBack') {
      const k = Math.min(1, f.t / 0.3), s = this.slotOf(f.value); this.drawToken(ctx, this.answerKind(), f.value, lerp(f.x, s.x, k), lerp(f.y, s.y - 6, k));
    } else if (f.kind === 'bounce') {                      // touches the recess, wobbles under the amber lamp, returns
      const at = this.askRecess(), s = this.slotOf(f.value), from = f.from || { x: s.x, y: s.y - 6 };
      let p;
      if (f.t < 0.25) p = arc(from, at, f.t / 0.25, 60);
      else if (f.t < 0.45) p = { x: at.x + Math.sin((f.t - 0.25) * 60) * 7, y: at.y };
      else p = arc(at, { x: s.x, y: s.y - 6 }, (f.t - 0.45) / 0.35, 120);
      this.drawToken(ctx, this.answerKind(), f.value, p.x, p.y, { ring: f.t > 0.2 && f.t < 0.6 ? LAMP.amber : null });
    } else if (f.kind === 'spark') {
      const k = f.t / 0.9;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 8; i++) {
        const an = i / 8 * Math.PI * 2 + f.t, r = 20 + 50 * k;
        ctx.fillStyle = `rgba(255,230,160,${0.85 * (1 - k)})`;
        ctx.beginPath(); ctx.arc(f.x + Math.cos(an) * r, f.y + Math.sin(an) * r, 4 * (1 - k) + 1.5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
  }

  drawSteam(ctx) {
    for (const p of this.steam) {                         // soft wisps: radial falloff, never a hard-edged ball
      const a = 0.26 * Math.sin(Math.PI * Math.min(1, p.t / p.life)), r = p.r * 1.6;
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      g.addColorStop(0, `rgba(245,240,230,${a})`); g.addColorStop(0.55, `rgba(245,240,230,${a * 0.45})`); g.addColorStop(1, 'rgba(245,240,230,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
    }
  }

  /** H2 (card: a line linking the examples): each number as dots — the input in blue, what the machine added in amber. */
  drawDots(ctx) {
    const rows = this.stage.memory.map((m) => ({ y: bp(0, ROW_Y[this.stage.memory.indexOf(m)]).y, x: m.in, groups: dotGroups(this.stage.rule, m.in) }));
    if (this.phase === 'answer') {
      const x = this.stage.ask.kind === 'input' ? this.ctrl.answer : this.stage.ask.in;
      rows.push({ y: bp(0, ROW_Y[2]).y, x, groups: dotGroups(this.stage.rule, x), hideIn: this.stage.ask.kind === 'input' });
    }
    const top = rows[0].y - 62, bot = rows[rows.length - 1].y + 62;
    const R = 9, SP = 22, width = (r) => { const w = (n) => (Math.ceil(n / 2) - 1) * SP + 2 * R; return 20 + (r.hideIn ? 30 : w(r.x) + 14) + 40 + r.groups.reduce((a, g) => a + w(g.dots) + 12, 0) + 8; };
    const pw = Math.min(BOARD.cx - 216 - 34, Math.max(260, ...rows.map(width) ) + 20);
    ctx.save();
    ctx.fillStyle = 'rgba(250,240,215,0.94)'; ctx.strokeStyle = 'rgba(150,110,50,0.85)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(24, top, pw, bot - top, 22); ctx.fill(); ctx.stroke();
    const BLUE = '#4f86c6', AMBER = '#e39b2d';
    const cluster = (n, x, y, col) => {                     // 2 rows of dots, returns the width
      const cols = Math.ceil(n / 2);
      for (let i = 0; i < n; i++) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x + (i % cols) * SP, y + Math.floor(i / cols) * SP - SP / 2, R, 0, Math.PI * 2); ctx.fill(); }
      return (cols - 1) * SP + 2 * R;
    };
    const ambers = [];
    rows.forEach((r) => {
      let x = 44;
      if (!r.hideIn) x += cluster(r.x, x + R, r.y, BLUE) + 14;
      else { ctx.font = `800 32px ${FONT}`; ctx.fillStyle = '#6a4a20'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText('؟', x, r.y); x += 30; }
      ctx.strokeStyle = '#8a6424'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, r.y); ctx.lineTo(x + 26, r.y); ctx.lineTo(x + 18, r.y - 7); ctx.moveTo(x + 26, r.y); ctx.lineTo(x + 18, r.y + 7); ctx.stroke();
      x += 40;
      r.groups.forEach((g, gi) => {
        const w = cluster(g.dots, x + R, r.y, gi === 0 ? BLUE : AMBER);
        if (gi > 0) ambers.push({ x: x + w / 2, y: r.y, row: r.y });
        x += w + 12;
      });
    });
    // the line linking the examples: what was added in the first example ↔ in the second
    const byRow = [...new Set(ambers.map((a) => a.row))].map((y) => ambers.filter((a) => a.row === y));
    if (byRow.length >= 2) {
      const a = byRow[0], b = byRow[1];
      const ax = (a[0].x + a[a.length - 1].x) / 2, bx = (b[0].x + b[b.length - 1].x) / 2;
      ctx.strokeStyle = 'rgba(214,150,40,0.9)'; ctx.lineWidth = 3; ctx.setLineDash([8, 8]);
      ctx.beginPath(); ctx.moveTo(ax, a[0].y + 20); ctx.lineTo(bx, b[0].y - 20); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.restore();
  }

  drawDragged(ctx) {
    const d = this.drag;
    if (!d || !d.moved) return;
    if (d.kind === 'gear') this.drawRuleGear(ctx, this.ctrl.gear(d.id), d.p.x.value, d.p.y.value, 0, { s: 1.08, glow: 0.4 });
    else this.drawToken(ctx, this.answerKind(), d.value, d.p.x.value, d.p.y.value, { s: 1.08, glow: 0.4 });
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
    if (this.bubble) {
      const a = Math.min(1, this.bubble.t / 0.3); ctx.globalAlpha = a;
      ctx.font = `700 34px ${FONT}`;
      const bw = ctx.measureText(this.bubble.text).width + 80, bx = 1300;
      ctx.fillStyle = 'rgba(255,248,226,0.96)'; ctx.strokeStyle = 'rgba(214,170,80,0.95)';
      ctx.beginPath(); ctx.roundRect(bx - bw / 2, 150, bw, 66, 33); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#5a3e14'; ctx.fillText(this.bubble.text, bx, 184); ctx.globalAlpha = 1;
    }
    ctx.restore();
    const pr = this.pressT || {}, busy = this.busy;
    drawHudButton(ctx, S, 'btn_hint', BTN.hint, BTN_R, { disabled: busy || this.ended, available: this.hints.available, pressed: pr.hint, t: this.t });
    drawHudButton(ctx, S, 'btn_undo', BTN.undo, BTN_R, { disabled: busy || this.ended || !this.ctrl.undoStack.length, pressed: pr.undo, t: this.t });
    drawHudButton(ctx, S, 'btn_reset', BTN.reset, BTN_R, { disabled: busy && !this.ended, available: this.ended, pressed: pr.reset, t: this.t });
    // wordless progress: the three machine rules
    this.puzzle.stages.forEach((st, k) => {
      const done = k < this.stageIdx || (k === this.stageIdx && (this.phase === 'solved' || this.ended));
      ctx.fillStyle = done ? 'rgba(255,200,90,0.95)' : k === this.stageIdx ? 'rgba(255,240,210,0.9)' : 'rgba(255,240,210,0.35)';
      ctx.beginPath(); ctx.arc(W / 2 + 120 - 28 + k * 28, 128, 7.5, 0, Math.PI * 2); ctx.fill();
    });
    if (this.ended && this.onExit && !this.fade) drawExitArrow(ctx, EXIT, this.t, reduceMotion);
    if (this.fade) { ctx.fillStyle = `rgba(22,16,10,${(1 - this.fade.a) * 0.85})`; ctx.fillRect(0, 0, W, H); }
    if (this.leaving) { ctx.fillStyle = `rgba(20,12,6,${this.leaving.a})`; ctx.fillRect(0, 0, W, H); }
  }

  debugState() {
    return {
      puzzle: this.stage.puzzle_id, phase: this.phase, rule: plaque(this.stage.rule), installed: this.ctrl.installed || '-',
      tray: this.ctrl.tray.join(' ') || '-', placed: this.ctrl.placed ?? '-', lamps: this.lamps.join(' '), busy: this.busy,
      hint_level: this.hints.level, hint_available: this.hints.available, wrong: this.hints.wrong, assisted: this.stageAssisted,
      flagged: [...this.misc.flagged].join(',') || '-', mastery: this.mastery.get(this.puzzle.concept_id),
      world: Object.keys(this.save.data.world).join(',') || '-', music_layers: this.audio.layers,
    };
  }
}
