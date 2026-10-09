// LUMA — pure pattern-puzzle rules (no rendering). Mirrored 1:1 in Unity: Scripts/Puzzles/PatternSlot/PatternRules.cs
// Shared test vectors: unity/Assets/_Project/Content/Puzzles/MATH-01.vectors.json (run: node web/test/rules.test.js)

/** Is `placed` correct for slot `index`? */
export function isCorrect(stage, index, placed) {
  return stage.solution[index] === placed;
}

/**
 * Classify a wrong placement into a misconception rule (plan 06 §8: "each Wrong State maps to a code").
 *  - repeat_nearest     : placed == the item right before the slot (copies the neighbour; PAT_M01 surface-only)
 *  - wrong_unit_length  : placed == what a repeating unit of another length k (2..n/2) would give (PAT_M02)
 *  - ''                 : no pattern-based explanation (generic ConceptError)
 * `slots` is the current board (given + placed so far, '' for empty); the classifier only looks LEFT of the slot,
 * which is how a child reads the row.
 */
export function classifyWrong(stage, slots, index, placed) {
  if (isCorrect(stage, index, placed)) return '';
  const seq = stage.solution;
  // only what is actually on the board counts (an empty neighbour is nothing, not the solution)
  const left = (k) => (index - k >= 0 && slots[index - k] ? slots[index - k] : null);
  if (left(1) === placed) return 'repeat_nearest';
  for (let k = 2; k <= Math.floor(seq.length / 2); k++) {
    if (k !== stage.unit_length && left(k) === placed) return 'wrong_unit_length';
  }
  return '';
}

/** Solved when every slot holds its solution item. */
export function isSolved(stage, slots) {
  return stage.solution.every((v, i) => slots[i] === v);
}

/** First empty (fillable) slot index, or -1. */
export function nextEmpty(stage, slots) {
  for (let i = 0; i < slots.length; i++) if (!stage.given[i] && !slots[i]) return i;
  return -1;
}

/** First fillable slot that is empty OR holds a wrong item (what H3 should point at), or -1. */
export function nextToFix(stage, slots) {
  for (let i = 0; i < slots.length; i++) if (!stage.given[i] && slots[i] !== stage.solution[i]) return i;
  return -1;
}

/**
 * Answer Assist (plan 06 §7): remove up to `n` WRONG tray options for the slot that needs fixing,
 * never leaving fewer than one option. Returns the list of option ids that stay available.
 */
export function assistOptions(stage, slots, n) {
  const i = nextToFix(stage, slots);
  if (i < 0) return stage.tray.slice();
  const right = stage.solution[i];
  const wrong = stage.tray.filter((t) => t !== right);
  const removed = new Set(wrong.slice(0, n));
  return stage.tray.filter((t) => !removed.has(t));
}
