// LUMA — MATH-03 pure rules: input-output machines (book grade 3, chapter 1, «ماشین‌های ورودی ـ خروجی», pp. 13–15).
// No rendering, no state: shared by the controller (puzzles/io_machine.js), the web tests and the Unity port
// (Scripts/Puzzles/IoMachine/IoRules.cs) through MATH-03.vectors.json.

/** rule = {op:'add'|'mul', n} */
export function apply(rule, x) {
  return rule.op === 'mul' ? x * rule.n : x + rule.n;
}

/** Undo the rule; null when the output cannot come from a whole-number input (e.g. 7 from ×2, or 2 from +3). */
export function inverse(rule, y) {
  if (rule.op === 'mul') return y % rule.n === 0 ? y / rule.n : null;
  return y - rule.n >= 0 ? y - rule.n : null;
}

export const sameRule = (a, b) => !!a && !!b && a.op === b.op && a.n === b.n;

/** Plaque text for a rule, operator first (Persian math is written left-to-right): '×۲', '+۳'. */
export function plaque(rule, digits = (s) => s) {
  return (rule.op === 'mul' ? '×' : '+') + digits(String(rule.n));
}

/** Which memory examples the rule explains: [true, false, …] */
export const fits = (rule, memory) => memory.map((m) => apply(rule, m.in) === m.out);

/**
 * Misconception for a rule gear tried against the memory (card v1.0):
 *   ''               explains every example (the right rule)
 *   'single_example' explains some example but not all  → IO-M01 MATH_IO_SINGLE_EXAMPLE_RULE
 *   'no_fit'         explains no example                → IO-M03 MATH_IO_NO_EXAMPLE_RELATION
 */
export function classifyGear(rule, memory) {
  const f = fits(rule, memory);
  if (f.every(Boolean)) return '';
  return f.some(Boolean) ? 'single_example' : 'no_fit';
}

/**
 * A lever run through the memory rows in order: the machine processes each input with the installed gear and stops at
 * the first row whose output differs (the card's soft stop + warning lamp). Returns the rows it processed.
 */
export function runMemory(rule, memory) {
  const out = [];
  for (let i = 0; i < memory.length; i++) {
    const m = memory[i], got = apply(rule, m.in), ok = got === m.out;
    out.push({ row: i, in: m.in, expected: m.out, got, ok });
    if (!ok) break;
  }
  return out;
}

/** The value the child must give for the question row: ask {kind:'output', in} or {kind:'input', out}. */
export function answerFor(rule, ask) {
  return ask.kind === 'input' ? inverse(rule, ask.out) : apply(rule, ask.in);
}

/**
 * Classify a proposed answer for the question row. '' = correct.
 *   'reverse_forward' the reverse question answered by applying the rule forward (10 → 13 with +3) → IO-M04
 *   'wrong_value'     any other wrong number (no misconception: a slip, logged only)
 */
export function classifyAnswer(rule, ask, value) {
  if (value === answerFor(rule, ask)) return '';
  if (ask.kind === 'input' && value === apply(rule, ask.out)) return 'reverse_forward';
  return 'wrong_value';
}

/** Rule gears the answer assist may take away: the wrong ones, single-example first so a no-fit gear stays as a foil. */
export function assistRemovable(gears, rule, removed = []) {
  return gears.filter((g) => !sameRule(g, rule) && !removed.includes(g.id));
}

/** Hint H2 picture: dot groups for one example. ×n → n copies of the input; +n → the input plus n extra dots. */
export function dotGroups(rule, x) {
  if (rule.op === 'mul') return Array.from({ length: rule.n }, () => ({ dots: x, extra: false }));
  return [{ dots: x, extra: false }, { dots: rule.n, extra: true }];
}
