// LUMA — MATH-07 «ارزش مکانی» pure rules (book grade 3, chapter 2, pp. 31–33; card MATH-07).
// A four-digit number is built from digit tiles in four columns: thousands | hundreds | tens | ones (left → right, as
// numbers are written — also in a Persian book). A digit is worth digit × the column's value (textbook p.33:
// «۵۳۲۱ یعنی ۱ یکی، ۲ ده‌تایی، ۳ صدتایی، ۵ هزارتایی»); an empty place is written with a zero (p.31: ۷۰۵۴).
// No DOM, no timing: the scene (scenes/gear_math07.js) and the controller (puzzles/place_panel.js) call these; the C#
// port (Scripts/Puzzles/PlacePanel/) mirrors them and both pass Content/Puzzles/MATH-07.vectors.json.

export const PLACES = ['thousands', 'hundreds', 'tens', 'ones'];   // column index 0 = the leftmost column
export const PLACE_VALUE = [1000, 100, 10, 1];
export const COLS = 4;

/** The four digits of a 0…9999 number, thousands first. */
export function digitsOf(n) {
  if (!Number.isInteger(n) || n < 0 || n > 9999) throw new Error(`not a 4-digit number: ${n}`);
  return PLACE_VALUE.map((v) => Math.floor(n / v) % 10);
}

/** The number a (partly) built panel shows; an empty column (null) counts 0. */
export const valueOf = (digits) => digits.reduce((a, d, i) => a + (d ?? 0) * PLACE_VALUE[i], 0);

/** The value of each column (the card's value_expand / Value Preview, e.g. ۲۰۰۰ ۳۰۰ ۵۰ ۴); null for an empty column. */
export const expanded = (digits) => digits.map((d, i) => (d === null || d === undefined ? null : d * PLACE_VALUE[i]));

/** The unit crates a digit stands for in its column (the beam's pan): {place, count}. */
export const unitsFor = (digits) => digits.map((d, i) => ({ place: PLACES[i], count: d ?? 0 }));

/**
 * The weigh lever on a built panel (target = the number to show).
 *  incomplete      a column is still empty (card: every column takes a digit; an empty place is a zero) — ProcedureError
 *  ok              the panel shows the target
 *  reversed        the exact mirror order (PV-M02: reads the columns from the wrong side — a real risk for RTL readers)
 *  zero_misplaced  the other digits keep their order but the zero sits in another column (p.31: a zero holds a place;
 *                  PV-M01: a digit's value is taken as independent of its place)
 *  swapped         any other arrangement (PV-M01: the digit's face, not its column, is taken as its value)
 */
export function classifyBuild(target, placed) {
  if (placed.length !== COLS || placed.some((d) => d === null || d === undefined)) return 'incomplete';
  const t = digitsOf(target);
  if (t.every((d, i) => d === placed[i])) return 'ok';
  const rev = t.slice().reverse();
  if (rev.some((d, i) => d !== t[i]) && rev.every((d, i) => d === placed[i])) return 'reversed';
  const nz = (a) => a.filter((d) => d !== 0).join(',');
  if (t.includes(0) && placed.includes(0) && nz(t) === nz(placed)) return 'zero_misplaced';
  return 'swapped';
}

/** Which way the beam leans after weighing: -1 left pan (the target) heavier, 0 level, 1 right pan heavier. */
export const lean = (target, placed) => Math.sign(valueOf(placed) - target);

/**
 * «ارزش این رقم چیست؟» (card mastery / transfer): the value chosen for the digit at column `index` of `number`.
 *  ok              digit × its column's value
 *  face_value      the digit itself (PV-M01)
 *  reversed_place  the digit's value when the columns are read from the other side (PV-M02)
 *  other           anything else
 */
export function classifyDigitValue(number, index, value) {
  const d = digitsOf(number)[index];
  if (value === d * PLACE_VALUE[index]) return 'ok';
  if (value === d * PLACE_VALUE[COLS - 1 - index]) return 'reversed_place';
  if (value === d) return 'face_value';
  return 'other';
}

/** The first column (left → right) whose digit is not right yet, or -1. */
export function firstWrongColumn(target, placed) {
  const t = digitsOf(target);
  return t.findIndex((d, i) => placed[i] !== d);
}
