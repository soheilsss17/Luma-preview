// LUMA — SCI-03 «اندازه‌گیری مواد» (science grade 3; plan 04 §2 row SCI-03, plan 12): the rule behind
// MEASURE_SELECT_USE_RECORD. Three tools, three quantities, one rule each — and one misconception the card is built
// to break: SCI_ONE_TOOL_MEASURES_ALL («یک ابزار همه‌چیز را اندازه می‌گیرد»).
//
//   ترازو      → جرم    (mass)   : put the material on one pan, add unit weights until the two pans are level;
//                                  the number of weights IS the mass. Rule-based (plan 04: «جرم Rule-based»).
//   ظرف مدرج   → حجم    (volume) : pour the liquid in and read the level WITH THE EYE LEVEL WITH THE SURFACE;
//                                  the number on the glass at the surface IS the volume. Controlled («حجم کنترل‌شده»).
//   خط‌کش      → درازا  (length) : lay the zero mark against one end of the thing and read the mark at the other end.
//
// A tool never answers for a quantity it does not measure: picking the wrong tool is refused with a reason in a
// child's words (that refusal is the misconception being taught, not a punishment). Colour, size and shape of the
// material never appear in any rule — only the reading does.

export const TOOLS = {
  balance:  { id: 'balance',  fa: 'ترازو',    measures: 'mass',   unit_fa: 'وزنه' },
  cylinder: { id: 'cylinder', fa: 'ظرف مدرج', measures: 'volume', unit_fa: 'واحد' },
  ruler:    { id: 'ruler',    fa: 'خط‌کش',     measures: 'length', unit_fa: 'واحد' },
};

export const QUANTITY_FA = { mass: 'جرم', volume: 'حجم', length: 'درازا' };
export const TOOL_OF = { mass: 'balance', volume: 'cylinder', length: 'ruler' };
export const UNIT_FA = { mass: 'وزنه', volume: 'واحد', length: 'واحد' };

/** Why a reading is right or not, in the words a nine-year-old hears from LUMI. */
export const REASON_FA = {
  balanced:      'دو کفه هم‌سطح شد؛ شمارشِ وزنه‌ها جرم را نشان می‌دهد.',
  light:         'کفهٔ ماده هنوز پایین است: وزنه کم است، یکی اضافه کن.',
  heavy:         'کفهٔ وزنه‌ها پایین است: یک وزنه بردار.',
  at_level:      'سطحِ آب را هم‌سطحِ چشم خواندی؛ عددِ روی ظرف درست است.',
  low:           'آب هنوز به نشانه نرسیده است.',
  high:          'آب از نشانه بالاتر رفت؛ کمی بریز بیرون.',
  not_at_eye:    'از بالا یا پایین نگاه می‌کنی و عدد دروغ می‌گوید. هم‌سطحِ سطحِ آب نگاه کن.',
  at_zero:       'صفرِ خط‌کش سرِ جسم است؛ عددِ سرِ دیگر درست است.',
  not_at_zero:   'خط‌کش از صفر شروع نشده است؛ اول صفر را به سرِ جسم بچسبان.',
  wrong_tool:    'این ابزار این اندازه را نشان نمی‌دهد.',
  full:          'ظرف پُر شد؛ بیشتر از این جا نمی‌شود.',
};

/** The one sentence that says which tool measures which quantity — used when the child picked the wrong one. */
export function wrongToolReason(toolId, quantity) {
  const t = TOOLS[toolId], right = TOOLS[TOOL_OF[quantity]];
  if (!t) return 'اول یک ابزار بردار.';
  return `${t.fa} ${QUANTITY_FA[t.measures]} را نشان می‌دهد، ${QUANTITY_FA[quantity]} را نه. ${QUANTITY_FA[quantity]} را با ${right.fa} اندازه می‌گیریم.`;
}

/**
 * جرم — the balance. Weights sit on one pan, the material on the other. Fewer weights than the mass → the
 * material's pan stays down («کم»); more → the weights' pan goes down («زیاد»); exactly → level.
 */
export function massVerdict(weights, target) {
  const d = weights - target;
  if (d === 0) return { ok: true, state: 'balanced', tip: 'level', reading: weights, reason_fa: REASON_FA.balanced };
  if (d < 0)  return { ok: false, state: 'light', tip: 'right', reading: weights, reason_fa: REASON_FA.light };
  return        { ok: false, state: 'heavy', tip: 'left', reading: weights, reason_fa: REASON_FA.heavy };
}

/** حجم — the measuring cylinder. The reading is only true when the eye is level with the surface. */
export function volumeVerdict(level, target, eyeLevel, capacity = 8) {
  if (level > capacity) return { ok: false, state: 'full', reading: level, reason_fa: REASON_FA.full };
  if (!eyeLevel) return { ok: false, state: 'not_at_eye', reading: level, reason_fa: REASON_FA.not_at_eye };
  const d = level - target;
  if (d === 0) return { ok: true, state: 'at_level', reading: level, reason_fa: REASON_FA.at_level };
  if (d < 0)  return { ok: false, state: 'low', reading: level, reason_fa: REASON_FA.low };
  return        { ok: false, state: 'high', reading: level, reason_fa: REASON_FA.high };
}

/** درازا — the ruler. `offset` is where the ruler's zero mark lies: 0 = flush with the near end of the thing. */
export function lengthVerdict(offset, length, target) {
  const reading = offset + length;
  if (offset !== 0) return { ok: false, state: 'not_at_zero', reading, reason_fa: REASON_FA.not_at_zero };
  if (length !== target) return { ok: false, state: 'wrong', reading, reason_fa: REASON_FA.at_zero };
  return { ok: true, state: 'at_zero', reading, reason_fa: REASON_FA.at_zero };
}

/**
 * The single rule the controller asks. `job` = {quantity, target, ...}, `setup` = {tool, weights, level, eyeLevel,
 * offset}. A wrong tool is answered with a reason, never with a number: giving a number would feed the very
 * misconception the card exists to break (SCI_ONE_TOOL_MEASURES_ALL).
 */
export function evaluate(job, setup = {}) {
  const right = TOOL_OF[job.quantity];
  if (!setup.tool) return { ok: false, rule: 'no_tool', reading: null, reason_fa: 'اول یک ابزار بردار.' };
  if (setup.tool !== right) {
    return { ok: false, rule: 'wrong_tool', state: 'wrong_tool', reading: null,
             reason_fa: wrongToolReason(setup.tool, job.quantity), right_tool: right };
  }
  if (job.quantity === 'mass')   return { rule: 'mass',   ...massVerdict(setup.weights | 0, job.target) };
  if (job.quantity === 'volume') return { rule: 'volume', ...volumeVerdict(setup.level | 0, job.target, !!setup.eyeLevel, job.capacity || 8) };
  return { rule: 'length', ...lengthVerdict(setup.offset | 0, job.length | 0, job.target) };
}

/** The hypothesis step of the transfer stage: the child says which tool, before measuring. */
export function judgeGuess(toolId, job) {
  return toolId === TOOL_OF[job.quantity] ? 'right' : 'wrong';
}

/** The three things a child writes in the notebook of this card (plan 12: «چه دیدم / چه تغییر دادم / چه شد» shape). */
export const NOTEBOOK_COLS = ['چه اندازه گرفتیم', 'با چه ابزاری', 'چند شد'];
