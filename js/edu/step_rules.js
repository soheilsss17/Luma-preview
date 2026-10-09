// LUMA — MATH-02 rules (skip counting with equal groups). Pure functions, no rendering; the Unity mirror is
// Scripts/Puzzles/StepCount/StepCountRules.cs and both are checked against Content/Puzzles/MATH-02.vectors.json.

// ------------------------------------------------------------------ Number Trail (encounter)
/** Sum of the placed items (each item = its size: a group of `step` apples or a single apple). */
export const countOf = (placed) => placed.reduce((s, v) => s + v, 0);

/** 'under' | 'solved' | 'overshoot' */
export function trailState(round, placed) {
  const c = countOf(placed);
  return c === round.target ? 'solved' : c > round.target ? 'overshoot' : 'under';
}

/** How the child counted this round: 'groups' (only whole groups), 'ones' (only singles), 'mixed', or 'none'. */
export function countingMethod(round, placed) {
  if (!placed.length) return 'none';
  const g = placed.filter((v) => v === round.step).length, o = placed.filter((v) => v === 1).length;
  return o === 0 ? 'groups' : g === 0 ? 'ones' : 'mixed';
}

/** Misconception rule observed when the round is solved (card v1.1: counting one by one is allowed but is the focus). */
export function solveRule(round, placed) { return countingMethod(round, placed) === 'ones' ? 'ones_only' : ''; }

/** Rule for a placement that changes the state: '' (fine) or 'overshoot'. */
export function placeRule(round, placedBefore, size) {
  return countOf(placedBefore) + size > round.target ? 'overshoot' : '';
}

/** Hops of the counter along the trail, one per placed item: [[from, to], ...]. */
export function hops(placed) {
  const out = []; let c = 0;
  for (const v of placed) { out.push([c, c + v]); c += v; }
  return out;
}

/** The comparison row of the observation: equal steps from 0 to the target. */
export function idealHops(round) {
  const out = [];
  for (let c = 0; c < round.target; c += round.step) out.push([c, Math.min(round.target, c + round.step)]);
  return out;
}

/** H3: the numbers that appear on the ground (multiples of the step up to the target). */
export function stepNumbers(round) {
  const out = [];
  for (let c = round.step; c <= round.target; c += round.step) out.push(c);
  return out;
}

/** Answer Assist: how many whole groups stay in the supply (exactly the ones still needed; the heap is removed). */
export function assistGroupsLeft(round, placed) {
  const need = Math.max(0, round.target - countOf(placed.filter((v) => v === round.step)));
  return Math.floor(need / round.step);
}

// ------------------------------------------------------------------ Basket Snap (practice)
/** counts: apples per basket; loose: apples not yet in a basket. Returns 'incomplete' | 'solved' | 'not_grouped' | 'unequal'. */
export function basketState(counts, loose) {
  if (loose > 0) return 'incomplete';
  if (counts.every((c) => c === counts[0])) return 'solved';
  if (counts.some((c) => c === 0)) return 'not_grouped';
  return 'unequal';
}

/** The fair share per basket (12 / 4 = 3). */
export const share = (fruits, baskets) => fruits / baskets;

/** Which baskets wobble on a wrong state: the fullest and the emptiest ones (card v1.0 wrong state). */
export function wobbleBaskets(counts) {
  const mx = Math.max(...counts), mn = Math.min(...counts);
  if (mx === mn) return [];
  return counts.map((c, i) => (c === mx || c === mn ? i : -1)).filter((i) => i >= 0);
}

/** Success sequence: skip counting by the share, basket by basket (3, 6, 9, 12). */
export function skipSequence(counts) {
  const out = []; let s = 0;
  for (const c of counts) { s += c; out.push(s); }
  return out;
}

/** H2: the example basket — the first one that already holds exactly the share, else the first basket (index 0). */
export function exampleBasket(counts, sh) {
  const i = counts.indexOf(sh);
  return i >= 0 ? i : 0;
}
