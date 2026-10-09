// LUMA — MATH-05 rules (line symmetry: complete the other half across an axis). Pure functions, no rendering.
// The Unity mirror is Scripts/Puzzles/Symmetry/SymmetryRules.cs. Both are checked against
// Content/Puzzles/MATH-05.vectors.json.
//
// Grid: `cols` × `rows` cells; cell = {r, c}; piece = {r, c, type}. The axis is 'v' (vertical: between the columns
// cols/2-1 and cols/2) or 'h' (horizontal: between the rows rows/2-1 and rows/2). The source side is the left half
// ('v') or the top half ('h'). A phase only uses the rows row_from..row_to; the practice mosaic uses the top half
// first (vertical axis), then the whole frame (horizontal axis).

export const key = (p) => `${p.r},${p.c}`;
const half = (axis, g) => (axis === 'v' ? g.cols / 2 : g.rows / 2);

/** Reflection of a cell across the axis. */
export function mirrorCell(axis, g, cell) {
  return axis === 'v' ? { r: cell.r, c: g.cols - 1 - cell.c } : { r: g.rows - 1 - cell.r, c: cell.c };
}

/** The cell a «slide across» copy would use (the same shape moved by half the grid, not reflected). */
export function translateCell(axis, g, cell) {
  return axis === 'v' ? { r: cell.r, c: cell.c + g.cols / 2 } : { r: cell.r + g.rows / 2, c: cell.c };
}

export const inGrid = (g, cell) => cell.r >= 0 && cell.c >= 0 && cell.r < g.rows && cell.c < g.cols;
export const inRows = (phase, cell) => cell.r >= phase.row_from && cell.r <= phase.row_to;
export function isSourceSide(axis, g, cell) { return axis === 'v' ? cell.c < half(axis, g) : cell.r < half(axis, g); }

/** Distance to the axis in steps (cells): the cells next to the axis are 1 step away. */
export function stepsToAxis(axis, g, cell) {
  const h = half(axis, g), i = axis === 'v' ? cell.c : cell.r;
  return i < h ? h - i : i - h + 1;
}

/** H2/H3: the cells between a cell and the axis (the cell itself first), one per step. */
export function pathToAxis(axis, g, cell) {
  const out = [], n = stepsToAxis(axis, g, cell), h = half(axis, g), i = axis === 'v' ? cell.c : cell.r;
  const dir = i < h ? 1 : -1;
  for (let k = 0; k < n; k++) out.push(axis === 'v' ? { r: cell.r, c: cell.c + dir * k } : { r: cell.r + dir * k, c: cell.c });
  return out;
}

/** Pieces that exist when phase `pi` starts: the givens of every phase up to pi + the solution of the earlier phases. */
export function basePieces(stage, pi) {
  let pieces = [];
  for (let k = 0; k <= pi; k++) {
    pieces = pieces.concat(stage.phases[k].given.map((p) => ({ ...p })));
    if (k < pi) pieces = pieces.concat(targets(stage, stage.phases[k], pieces));
  }
  return pieces;
}

/** Mirror images of every piece on the source side (within the phase rows): what the child has to build. */
export function targets(g, phase, pieces) {
  return pieces
    .filter((p) => inRows(phase, p) && isSourceSide(phase.axis, g, p))
    .map((p) => ({ ...mirrorCell(phase.axis, g, p), type: p.type }))
    .filter((t) => inRows(phase, t));
}

/** Targets that are still empty (or hold a different piece). */
export function missing(g, phase, pieces) {
  const at = new Map(pieces.map((p) => [key(p), p.type]));
  return targets(g, phase, pieces).filter((t) => at.get(key(t)) !== t.type);
}

export const phaseSolved = (g, phase, pieces) => missing(g, phase, pieces).length === 0;

/**
 * Classify a drop of `type` on `cell`:
 *   'ok'           an empty target cell with the right piece → it snaps
 *   'outside'      not on the grid → it floats back, not an error
 *   'inactive'     rows not used by this phase (the lower half of the mosaic during the vertical phase) → back, not an error
 *   'source_side'  the half that is already built → back, not an error
 *   'occupied'     a piece is already there → back, not an error
 *   'translated'   the «slide across» copy of a source piece (same shape, not reflected)       → MATH_SYMMETRY_TRANSLATE_NOT_REFLECT
 *   'distance'     same row (v) / column (h) and the same piece as a source piece, wrong distance → SYM-M02
 *   'count_only'   any other place on the empty half: only the number is matched               → SYM-M01
 */
export function classifyDrop(g, phase, pieces, drop) {
  if (!inGrid(g, drop)) return 'outside';
  if (!inRows(phase, drop)) return 'inactive';
  if (isSourceSide(phase.axis, g, drop)) return 'source_side';
  if (pieces.some((p) => p.r === drop.r && p.c === drop.c)) return 'occupied';
  if (missing(g, phase, pieces).some((t) => t.r === drop.r && t.c === drop.c && t.type === drop.type)) return 'ok';
  const src = pieces.filter((p) => inRows(phase, p) && isSourceSide(phase.axis, g, p) && p.type === drop.type);
  if (src.some((p) => key(translateCell(phase.axis, g, p)) === key(drop))) return 'translated';
  if (src.some((p) => (phase.axis === 'v' ? p.r === drop.r : p.c === drop.c))) return 'distance';
  return 'count_only';
}

export const WRONG = new Set(['translated', 'distance', 'count_only']);

/** Ghost Mirror (card v1.1): where the dropped piece's reflection lands on the built half. */
export function ghostOf(g, phase, drop) { return { ...mirrorCell(phase.axis, g, drop), type: drop.type }; }

/** Hint target: the first missing target (reading order) and the source piece it mirrors. */
export function hintPair(g, phase, pieces) {
  const m = missing(g, phase, pieces).sort((a, b) => a.r - b.r || a.c - b.c)[0];
  if (!m) return null;
  return { target: m, source: { ...mirrorCell(phase.axis, g, m), type: m.type } };
}

/** Answer Assist («mirror cells only»): a drop within one cell of a missing target of the same type snaps to it. */
export function assistSnap(g, phase, pieces, drop) {
  let best = null, bestD = 2;
  for (const t of missing(g, phase, pieces)) {
    if (t.type !== drop.type || pieces.some((p) => p.r === t.r && p.c === t.c)) continue;
    const d = Math.max(Math.abs(t.r - drop.r), Math.abs(t.c - drop.c));
    if (d < bestD) { bestD = d; best = t; }
  }
  return best ? { r: best.r, c: best.c } : null;
}

/** Order of the success wave: pieces sorted by their distance to the axis (near → far), then reading order. */
export function waveOrder(axis, g, pieces) {
  return [...pieces].sort((a, b) => stepsToAxis(axis, g, a) - stepsToAxis(axis, g, b) || a.r - b.r || a.c - b.c);
}
