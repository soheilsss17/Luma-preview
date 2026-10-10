// LUMA — SCI-01 «راز چراغ خاموش» — pure rules of the rule-based circuit (no rendering, no state, no I/O).
// Source: plan 04 §2 (SCI-01: SCIENTIFIC_METHOD_LOOP، «مدار Rule-based؛ هر بار یک متغیر؛ سیم‌ها مستقل از رنگ‌اند»)
// and plan 12 §3 row SCI-01 (Observe ← Question ← Hypothesis ← Test ← Record ← Conclude; battery safety card).
//
// The circuit is not simulated: it is a rule table over four variables. That is deliberate — a 9-year-old must be
// able to name the one thing that made the lamp change, so every reason names exactly one missing link of the loop.
// The colour of a wire appears in NO rule (the card's «سیم‌ها مستقل از رنگ‌اند»): swapping a red wire for a blue one
// is a change of the variable «رنگ سیم» and can never change whether the lamp lights.

/** The four things the child can change. One test may change at most one of them. */
export const VARS = ['battery', 'switch', 'lamp', 'wire_count'];

export const VAR_FA = {
  battery: 'باتری',
  switch: 'کلید',
  lamp: 'چراغ',
  wire_count: 'شمار سیم‌ها',
  wire_colour: 'رنگ سیم',
};

export const REASON_FA = {
  NO_SOURCE: 'باتری در مدار نیست.',
  NO_SWITCH: 'کلید در مدار نیست؛ راه باز است.',
  NO_LAMP: 'چراغ در مدار نیست.',
  BROKEN_PATH: 'یکی از سیم‌ها نیست؛ راه بریده است.',
  FLAT_SOURCE: 'باتری تمام شده است.',
  SWITCH_OPEN: 'کلید باز است؛ راه بسته نیست.',
  CLOSED: 'راه بسته است و برق می‌گردد.',
};

export const emptyState = () => ({ battery: 'none', switch: 'none', lamp: 'none', wires: [] });

/** Sorted colour multiset — the only place colour is looked at, and only to say "this changed". */
export const wireColours = (s) => s.wires.map((w) => w.colour).join(',');

/**
 * The verdict of one test. The order of the checks is the order the child learns to look:
 * is there a source, is there a lamp, is there a switch, does the path run all the way round,
 * is the source alive, is the switch closed.
 */
export function evaluate(s, bays = 2) {
  if (s.battery === 'none') return { lit: false, rule: 'NO_SOURCE' };
  if (s.switch === 'none') return { lit: false, rule: 'NO_SWITCH' };
  if (s.lamp === 'none') return { lit: false, rule: 'NO_LAMP' };
  if (s.wires.length < bays) return { lit: false, rule: 'BROKEN_PATH' };
  if (s.battery === 'flat') return { lit: false, rule: 'FLAT_SOURCE' };
  if (s.switch === 'open') return { lit: false, rule: 'SWITCH_OPEN' };
  return { lit: true, rule: 'CLOSED' };
}

/**
 * Which variables differ between two tests. A change of wire colour only counts when the number of wires is
 * unchanged — replacing the only wire by another colour is «شمار سیم‌ها» + «رنگ سیم» at once, which is two
 * variables for a child, and the engine must say so.
 */
export function diff(a, b) {
  const d = [];
  if (a.battery !== b.battery) d.push('battery');
  if (a.switch !== b.switch) d.push('switch');
  if (a.lamp !== b.lamp) d.push('lamp');
  if (a.wires.length !== b.wires.length) d.push('wire_count');
  if (!d.length && wireColours(a) !== wireColours(b)) d.push('wire_colour');
  return d;
}

/** The card's colour beat: same lamp state, only the wire colours differ. */
export const sameExceptColour = (a, b) => diff(a, b).join() === 'wire_colour'
  && evaluate(a).lit === evaluate(b).lit;

/** Hypothesis → verdict (used by the guess step of the transfer stage). */
export const HYPOTHESES = {
  switch_open: { fa: 'کلید باز است.', test: (r) => r.rule === 'SWITCH_OPEN' },
  wire_missing: { fa: 'یکی از سیم‌ها نیست.', test: (r) => r.rule === 'BROKEN_PATH' },
  battery_flat: { fa: 'باتری تمام شده است.', test: (r) => r.rule === 'FLAT_SOURCE' || r.rule === 'NO_SOURCE' },
  path_closed: { fa: 'راه بسته است.', test: (r) => r.rule === 'CLOSED' },
};

export function judgeGuess(guess, result) {
  const h = HYPOTHESES[guess];
  if (!h) return 'no_guess';
  return h.test(result) ? 'ok' : 'wrong';
}
