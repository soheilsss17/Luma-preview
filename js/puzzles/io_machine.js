// LUMA — MATH-03 controller (plan 12 Q02 #1: the workshop parts machine that forgot its rule). Rendering-agnostic state
// with an undo stack; the room (scenes/machine_math03.js) animates the returned plans and forwards input.
// Unity mirror: Scripts/Puzzles/IoMachine/IoMachineController.cs
import { runMemory, classifyGear, classifyAnswer, answerFor, sameRule } from '../edu/io_rules.js';

export class IoMachineController {
  /** stage: one entry of MATH-03.puzzle.json stages */
  constructor(stage) {
    this.stage = stage;
    this.rule = stage.rule;
    this.memory = stage.memory;
    this.ask = stage.ask;
    this.gears = stage.gears;
    this.tray = stage.gears.map((g) => g.id);        // gear ids waiting in the tray (tray order = slot order)
    this.installed = null;                            // gear id in the machine's rule socket
    this.phase = 'rule';                              // 'rule' → 'answer' (rule registered) → 'solved'
    this.options = stage.answer_options.slice();      // numbers on the answer tokens still in the crate
    this.placed = null;                               // answer token value sitting in the question recess
    this.removed = [];                                // taken away by the answer assist (gear ids / option values)
    this.tried = [];                                  // gear ids already run against the memory
    this.undoStack = [];
  }
  gear(id) { return this.gears.find((g) => g.id === id) || null; }
  get installedGear() { return this.gear(this.installed); }
  get answer() { return answerFor(this.rule, this.ask); }
  canRun() { return (this.phase === 'rule' && !!this.installed) || (this.phase === 'answer' && this.placed !== null); }

  /** Put a gear from the tray into the socket; a gear already there goes back to the tray. */
  install(id, { record = true } = {}) {
    if (this.phase !== 'rule' || !this.tray.includes(id)) return null;
    const prev = this.installed;
    this.tray = this.tray.filter((t) => t !== id);
    if (prev) this.tray.push(prev);
    this.installed = id;
    if (record) this.undoStack.push({ op: 'install', id, prev });
    return { id, prev };
  }

  /** Take the gear out of the socket (back to the tray). */
  uninstall({ record = true } = {}) {
    if (this.phase !== 'rule' || !this.installed) return null;
    const id = this.installed;
    this.installed = null; this.tray.push(id);
    if (record) this.undoStack.push({ op: 'uninstall', id });
    return id;
  }

  /** Drop an answer token into the question recess. A wrong number bounces back (never placed). */
  place(value, { record = true } = {}) {
    if (this.phase !== 'answer' || this.placed !== null || !this.options.includes(value)) return null;
    const rule = classifyAnswer(this.rule, this.ask, value);
    if (rule) return { ok: false, rule, value };
    this.placed = value;
    this.options = this.options.filter((v) => v !== value);
    if (record) this.undoStack.push({ op: 'place', value });
    return { ok: true, rule: '', value };
  }

  unplace({ record = true } = {}) {
    if (this.phase !== 'answer' || this.placed === null) return null;
    const value = this.placed;
    this.placed = null; this.options.push(value);
    if (record) this.undoStack.push({ op: 'unplace', value });
    return value;
  }

  /**
   * Pull the lever. Rule phase: the memory rows run in order and stop at the first mismatch (the gear then pops out);
   * all rows matching registers the rule. Answer phase: the placed token goes through and the stage is solved.
   * The state changes at once; the scene plays the returned plan.
   */
  run() {
    if (!this.canRun()) return null;
    this.undoStack = [];                                 // a lever run is a commitment point
    if (this.phase === 'rule') {
      const g = this.installedGear, rows = runMemory(g, this.memory), rule = classifyGear(g, this.memory);
      if (!this.tried.includes(g.id)) this.tried.push(g.id);
      const allOk = rule === '';
      if (allOk) this.phase = 'answer';
      else { this.installed = null; this.tray.push(g.id); }
      return { kind: 'memory', gear: g.id, rows, rule, allOk };
    }
    const v = this.placed, isInput = this.ask.kind === 'input';
    this.phase = 'solved';
    return { kind: 'answer', in: isInput ? v : this.ask.in, out: isInput ? this.ask.out : v, ok: true };
  }

  /** Answer assist (after N wrong): take one wrong gear / wrong answer token away. Returns what was removed or null. */
  assistRemove() {
    if (this.phase === 'rule') {
      const wrong = this.gears.filter((g) => !sameRule(g, this.rule) && !this.removed.includes(g.id));
      const pick = wrong.find((g) => this.tray.includes(g.id)) || wrong.find((g) => g.id === this.installed);
      if (!pick) return null;
      if (this.installed === pick.id) this.installed = null;
      this.tray = this.tray.filter((t) => t !== pick.id);
      this.removed.push(pick.id); this.undoStack = [];
      return { kind: 'gear', id: pick.id };
    }
    if (this.phase === 'answer') {
      const v = this.options.find((o) => o !== this.answer);
      if (v === undefined) return null;
      this.options = this.options.filter((o) => o !== v);
      this.removed.push(v); this.undoStack = [];
      return { kind: 'option', value: v };
    }
    return null;
  }

  undo() {
    const a = this.undoStack.pop();
    if (!a) return null;
    if (a.op === 'install') {
      this.installed = a.prev;
      this.tray = this.tray.filter((t) => t !== a.prev);
      this.tray.push(a.id);
    } else if (a.op === 'uninstall') {
      this.tray = this.tray.filter((t) => t !== a.id); this.installed = a.id;
    } else if (a.op === 'place') {
      this.placed = null; this.options.push(a.value);
    } else if (a.op === 'unplace') {
      this.options = this.options.filter((v) => v !== a.value); this.placed = a.value;
    }
    return a;
  }
}
