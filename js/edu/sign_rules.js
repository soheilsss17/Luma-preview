// LUMA — P-01 «محله‌ی ما» rules (Read → Observe → Match → Place). Pure functions, no DOM; mirror of
// unity/.../Puzzles/SignPlace/SignRules.cs. Both are checked against Content/Puzzles/P-01.vectors.json.
// A stage has `signs` (short original texts, each with its answer place, the key words for H2 and the trap words it
// shares with another place) and the room has `places` (school, market, library, well).

/** The sign definition by id. */
export function signOf(stage, signId) { return stage.signs.find((s) => s.sign_id === signId) || null; }

/** The trap entry of `sign` for `spotId` ({spot, word}) or null: the text shares a word with that place. */
export function trapOf(sign, spotId) { return (sign.traps || []).find((t) => t.spot === spotId) || null; }

/**
 * Classify a placement of `signId` on `spotId`:
 *   'outside'        not on a place → floats back, not an error
 *   'occupied'       a sign already stands there → floats back, not an error
 *   'ok'             the place the whole sentence describes → snaps, the place reacts
 *   'guess'          wrong AND placed less than guessMs after picking the sign up (not read) → FA_PICTURE_ONLY_GUESS
 *   'trap'           wrong, and the text shares a word with that place → FA_SINGLE_WORD_MATCH
 *   'wrong_context'  any other wrong place → ContextError (analytics wrong_context)
 */
export function classifyPlacement(stage, places, placed, signId, spotId, readMs = Infinity, guessMs = 1500) {
  if (!places.some((p) => p.spot_id === spotId)) return 'outside';
  if (placed[spotId]) return 'occupied';
  const sign = signOf(stage, signId);
  if (sign.answer === spotId) return 'ok';
  if (readMs < guessMs) return 'guess';
  if (trapOf(sign, spotId)) return 'trap';
  return 'wrong_context';
}

export const WRONG = new Set(['guess', 'trap', 'wrong_context']);

/** Answer Assist «two places only»: the answer + one other free place (the trap place first, else the first free one). */
export function assistSpots(stage, places, placed, signId) {
  const sign = signOf(stage, signId);
  const free = places.map((p) => p.spot_id).filter((id) => !placed[id] && id !== sign.answer);
  const trap = (sign.traps || []).map((t) => t.spot).find((id) => free.includes(id));
  const other = trap || free[0];
  return other ? [sign.answer, other] : [sign.answer];
}

/** Signs not yet placed, in stage order. */
export function pending(stage, placed) {
  const used = new Set(Object.values(placed));
  return stage.signs.filter((s) => !used.has(s.sign_id)).map((s) => s.sign_id);
}

export const solved = (stage, placed) => stage.signs.every((s) => placed[s.answer] === s.sign_id);

/**
 * H2 highlight: split `text` into segments [{t, key}] where key = true for the key phrases. Overlapping or touching
 * ranges merge; phrases are matched left to right, first occurrence.
 */
export function highlightSegments(text, keys) {
  const ranges = [];
  for (const k of keys) { const i = text.indexOf(k); if (i >= 0) ranges.push([i, i + k.length]); }
  ranges.sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]); else merged.push([...r]);
  }
  const out = []; let at = 0;
  for (const [a, b] of merged) {
    if (a > at) out.push({ t: text.slice(at, a), key: false });
    out.push({ t: text.slice(a, b), key: true }); at = b;
  }
  if (at < text.length) out.push({ t: text.slice(at), key: false });
  return out;
}
