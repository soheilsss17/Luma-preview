// LUMA — pure rules of SOCIAL-01 «من به دنیا آمدم» (life timeline). No DOM, no time: shared by the scene, the tests and
// the C# port (Scripts/Puzzles/Timeline/TimelineRules.cs, same vectors in Content/Puzzles/SOC-01.vectors.json).
//
// The timeline runs LEFT (past) → RIGHT (today), like the textbook timelines (C307 p. 6). A row is an array of event ids
// (or null for an empty slot), slot 0 = the left end. The brass marker walks from slot 0 to the right and stops at the first
// card that happened BEFORE the card on its left: that pair is the wrong answer of the source card («قرار دادن رویداد
// جدیدتر قبل از رویداد قدیمی‌تر»). A row that is (almost) completely reversed, built in the reading direction, is its own
// misconception (timeline_reversed).

export const eventOf = (puzzle, id) => puzzle.events.find((e) => e.event_id === id) || null;
export const rankOf = (puzzle, id) => { const e = eventOf(puzzle, id); return e ? e.rank : -1; };
/** The answer of a stage: its events sorted by rank (past → today). */
export const answerOf = (puzzle, stage) => stage.events.slice().sort((a, b) => rankOf(puzzle, a) - rankOf(puzzle, b));

/** Number of pairs (i < j) whose left card happened after the right card (0 = in order, 10 = fully reversed for 5). */
export function inversions(puzzle, row) {
  let n = 0;
  for (let i = 0; i < row.length; i++) for (let j = i + 1; j < row.length; j++) {
    if (row[i] && row[j] && rankOf(puzzle, row[i]) > rankOf(puzzle, row[j])) n++;
  }
  return n;
}

/**
 * The time key was turned: check the row.
 * → { ok, rule: 'ok' | 'incomplete' | 'newer_before_older' | 'timeline_reversed',
 *     stopAt: slot index where the marker stops (-1 when ok; the first empty slot when incomplete),
 *     pair: [left id, right id] | null, inversions, walk: slots the marker passes before stopping }
 */
export function checkTimeline(puzzle, row) {
  const empty = row.findIndex((c) => !c);
  if (empty >= 0) return { ok: false, rule: 'incomplete', stopAt: empty, pair: null, inversions: inversions(puzzle, row), walk: 0 };
  const inv = inversions(puzzle, row);
  let stopAt = -1;
  for (let i = 1; i < row.length; i++) if (rankOf(puzzle, row[i]) < rankOf(puzzle, row[i - 1])) { stopAt = i; break; }
  if (stopAt < 0) return { ok: true, rule: 'ok', stopAt: -1, pair: null, inversions: 0, walk: row.length };
  const minRev = puzzle.reversed_min_inversions || 9;
  const rule = inv >= minRev ? 'timeline_reversed' : 'newer_before_older';
  return { ok: false, rule, stopAt, pair: [row[stopAt - 1], row[stopAt]], inversions: inv, walk: stopAt };
}

/**
 * Drop `id` coming from `from` ({kind:'album'} or {kind:'slot', i}) onto slot `to` (null = dropped outside → back to the
 * album). Occupied target: the occupant swaps to where the dragged card came from (the album or the other slot).
 * `locked` = slot indices that cannot change (Answer Assist). → { row, album, changed, action }
 */
export function dropCard(row, album, id, from, to, locked = []) {
  const r = row.slice(); let a = album.slice();
  if (from.kind === 'slot' && locked.includes(from.i)) return { row, album, changed: false, action: 'locked' };
  if (to === null || to === undefined) {
    if (from.kind !== 'slot') return { row, album, changed: false, action: 'none' };
    r[from.i] = null; a.push(id);
    return { row: r, album: a, changed: true, action: 'to_album' };
  }
  if (to < 0 || to >= r.length || locked.includes(to)) return { row, album, changed: false, action: 'locked' };
  if (from.kind === 'slot' && from.i === to) return { row, album, changed: false, action: 'none' };
  const occ = r[to];
  if (from.kind === 'album') {
    a = a.filter((x) => x !== id);
    if (occ) a.push(occ);
    r[to] = id;
    return { row: r, album: a, changed: true, action: occ ? 'swap_album' : 'place' };
  }
  r[from.i] = occ || null; r[to] = id;
  return { row: r, album: a, changed: true, action: occ ? 'swap' : 'move' };
}

/** Answer Assist: the earliest and the latest event go to the ends and lock; displaced cards return to the album. */
export function assistRow(puzzle, stage, row, album) {
  const ans = answerOf(puzzle, stage), first = ans[0], last = ans[ans.length - 1], n = row.length;
  let r = row.map((c) => (c === first || c === last ? null : c)), a = album.filter((c) => c !== first && c !== last);
  for (const [slot, id] of [[0, first], [n - 1, last]]) { if (r[slot]) a.push(r[slot]); r[slot] = id; }
  return { row: r, album: a, locked: [0, n - 1] };
}

/** H3 target: the first slot (from the left) that does not hold its answer card, and the card that belongs there. */
export function guideTarget(puzzle, stage, row) {
  const ans = answerOf(puzzle, stage);
  const i = ans.findIndex((id, k) => row[k] !== id);
  return i < 0 ? null : { slot: i, id: ans[i] };
}
