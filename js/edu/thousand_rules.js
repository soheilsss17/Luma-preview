// LUMA — MATH-06 «معرفی عدد هزار» pure rules (book grade 3, chapter 2, pp. 28–30; card MATH-06).
// Ten groups of one unit close into one crate of the next unit (ten tens → a hundred, ten hundreds → a thousand).
// No DOM, no timing: the scene (scenes/storage_math06.js) and the controller (puzzles/crate_pack.js) call these; the C#
// port (Scripts/Puzzles/CratePack.cs) mirrors them and both pass Content/Puzzles/MATH-06.vectors.json.

export const GROUP = 10;

/** Value of a unit id from the puzzle's unit table (one 1, ten 10, hundred 100, thousand 1000). */
export function unitValue(units, id) {
  const u = units.find((q) => q.id === id);
  if (!u) throw new Error(`unknown unit ${id}`);
  return u.value;
}

/** The crate a phase closes into holds GROUP units: its value. */
export const containerValue = (units, unit) => unitValue(units, unit) * GROUP;

/**
 * A crate dropped on the open container.
 *  ok            the phase's unit and a free slot
 *  full          all GROUP slots taken (refused — not an error)
 *  smaller_unit  a smaller unit (card: counts ten *objects*, not ten groups) — a misconception
 *  bigger_unit   a bigger unit than the slots (refused — not an error)
 */
export function classifyDrop(units, phaseUnit, count, unit) {
  const v = unitValue(units, unit), want = unitValue(units, phaseUnit);
  if (v < want) return 'smaller_unit';
  if (v > want) return 'bigger_unit';
  return count >= GROUP ? 'full' : 'ok';
}

/** Pulling the rope: the lid only closes on a complete group (card: an incomplete group is highlighted). */
export const classifyClose = (count) => (count === GROUP ? 'ok' : 'incomplete');

/**
 * A label plate on the closed crate (answer = the crate's value).
 *  one_group_label  names the crate by one of its groups (answer / GROUP) — MATH_THOUSAND_AS_COUNT_NOT_GROUP
 *  big_number       a bigger number (longer written) — MATH_THOUSAND_JUST_BIG_NUMBER
 *  small_number     any other smaller number
 */
export function classifyLabel(value, answer) {
  if (value === answer) return 'ok';
  if (value * GROUP === answer) return 'one_group_label';
  return value > answer ? 'big_number' : 'small_number';
}

/** The tally board's counting pattern: 1×, 2× … GROUP× the unit (strategy «الگوسازی»: ۱۰۰، ۲۰۰ … ۱۰۰۰). */
export const skipCounts = (units, unit) => Array.from({ length: GROUP }, (_, i) => (i + 1) * unitValue(units, unit));

/** Sum of the units inside (what the tally reads, including a wrong-size crate for a moment). */
export const total = (units, ids) => ids.reduce((a, id) => a + unitValue(units, id), 0);

/** How many more of the unit the container needs. */
export const missing = (count) => Math.max(0, GROUP - count);
