// LUMA — MATH-08 «ارزش پول» pure rules (book grade 3, chapter 2, lesson «ارزش پول», pp. 34–36; card MATH-08).
// A price must be paid with generic market tokens of three denominations — ۱۰۰۰، ۵۰۰ and ۱۰۰ تومان. No real Iranian
// currency is ever drawn (card: "از پول واقعی ایران به‌عنوان Asset گرافیکی استفاده نمی‌شود"); the values are rendered by
// the engine, the art carries no digits.
//
// The three pieces are told apart by SHAPE, SIZE and MATERIAL, and — on purpose — the size order is NOT the value
// order: the LARGE painted-wood octagon is worth ۱۰۰ (the least), the MEDIUM brass hexagon ۱۰۰۰ (the most) and the
// SMALL copper disc ۵۰۰. That is what makes the card's misconception MONEY-M02 («تکیه به اندازه ظاهری Token») visible
// and teachable: a child who grabs the biggest pieces gets a handful worth almost nothing.
//
// No DOM, no timing: the scene (scenes/market_math08.js) and the controller (puzzles/pay_counter.js) call these; the C#
// port (Scripts/Puzzles/PayCounter/) mirrors them and both pass Content/Puzzles/MATH-08.vectors.json.

/** The denominations, most valuable first. `size` is the rack order the TRAY and the hints use. */
export const DENOMS = [
  { id: 'token_1000', value: 1000, size: 2, look: 'medium', material: 'brass hexagon', name_fa: 'سکهٔ شش‌گوش برنجی' },
  { id: 'token_500', value: 500, size: 1, look: 'small', material: 'copper disc', name_fa: 'سکهٔ گرد مسی' },
  { id: 'token_100', value: 100, size: 3, look: 'large', material: 'wooden octagon', name_fa: 'سکهٔ هشت‌گوش چوبی' },
];
export const VALUES = DENOMS.map((d) => d.value);
export const N = DENOMS.length;
export const MAX_VALUE = 1000;                                   // the biggest denomination
export const BIG_PIECE = 2;                                      // index of the largest-LOOKING token (worth 100)
export const BIG_CONFUSION = MAX_VALUE - VALUES[BIG_PIECE];      // 900: what a child "gains" per big piece by size

export const faDigits = (n) => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);

/** The amount on the counter. `counts[i]` = how many pieces of DENOMS[i] were paid. */
export const totalOf = (counts) => counts.reduce((a, c, i) => a + c * VALUES[i], 0);
/** How many pieces are on the counter. */
export const piecesOf = (counts) => counts.reduce((a, c) => a + c, 0);

/** Target − paid: positive = still short, 0 = paid exactly, negative = overpaid. */
export const remaining = (target, counts) => target - totalOf(counts);

/**
 * Paying `counts` towards `target`.
 *  exact  the counter holds exactly the price
 *  under  short (the seller: «هنوز به مقدار لازم نرسیده‌ایم.»)
 *  over   more than the price (the seller: «یک لحظه؛ می‌توانی مقدار مناسب‌تری پیدا کنی؟»)
 */
export function classifyPay(target, counts) {
  const d = remaining(target, counts);
  return d === 0 ? 'exact' : (d > 0 ? 'under' : 'over');
}

/**
 * Why a wrong payment is wrong (the card's two misconceptions):
 *  size_trap   the biggest-LOOKING piece was taken for the most valuable one: the payment is short by exactly
 *              (number of big pieces) × 900, i.e. what it would be worth if a wooden octagon were a 1000 piece.
 *  count_trap  the pieces were counted instead of added up: (number of pieces) × 1000 is exactly the price, so the
 *              child lined up "one piece per thousand" without looking at what each piece is worth (MONEY-M01).
 *              It can only fire on a price that is a multiple of 1000 (۲۰۰۰، ۳۰۰۰ …): on ۳۵۰۰ there is no whole
 *              number of "thousands" to count, so such a payment stays a plain under-payment.
 *  null        an ordinary short/over payment — a ProcedureError for the hint engine, not a misconception.
 */
export function payMisconception(target, counts) {
  const total = totalOf(counts), n = piecesOf(counts);
  if (n === 0) return null;
  if (counts[BIG_PIECE] > 0 && total + counts[BIG_PIECE] * BIG_CONFUSION === target) return 'size_trap';
  if (n * MAX_VALUE === target && total !== target) return 'count_trap';
  return null;
}

/** The signature of a combination ("2-0-1"), so a repeat payment can be told from a new one. */
export const comboKey = (counts) => counts.join('-');

/**
 * Every way to pay `target` out of `supply` (counts per denomination), most valuable pieces first.
 * Used by the content tests (a stage must have at least two ways) and by the assist / example paths.
 */
export function waysToMake(target, supply, limit = 40) {
  const out = [];
  const rec = (i, left, acc) => {
    if (out.length >= limit) return;
    if (left === 0) { out.push(acc.slice()); return; }
    if (i >= N) return;
    const v = VALUES[i], max = Math.min(supply[i], Math.floor(left / v));
    for (let k = max; k >= 0; k--) { acc[i] = k; rec(i + 1, left - k * v, acc); }
    acc[i] = 0;
  };
  rec(0, target, [0, 0, 0]);
  return out;
}

/** The greedy combination (as many of the most valuable piece as fit) — the H3 example and the assist path. */
export function greedyCombo(target, supply) {
  const acc = [0, 0, 0];
  let left = target;
  for (let i = 0; i < N; i++) {
    const k = Math.min(supply[i], Math.floor(left / VALUES[i]));
    acc[i] = k; left -= k * VALUES[i];
  }
  return left === 0 ? acc : null;
}

/** Can this combination still be paid out of what the tray has left? (the tray never goes negative) */
export const fits = (counts, supply) => counts.every((c, i) => c >= 0 && c <= supply[i]);

/**
 * The biggest piece the price still needs — H2 highlights exactly this one in the tray.
 * `trayLeft` (what the tray still holds) is honoured: pointing at a piece the child can no longer take would send
 * them back to an empty tray, so an exhausted denomination is skipped (3500 − 2000 = 1500 with no 1000 left → 500).
 */
export function biggestUnitNeeded(target, counts, trayLeft = null) {
  const left = remaining(target, counts);
  if (left <= 0) return -1;
  return VALUES.findIndex((v, i) => v <= left && (!trayLeft || trayLeft[i] > 0));
}
