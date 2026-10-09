// LUMA — pure rules of WRITING-01 «محله‌ی ما» (sentence board). No DOM, no time: shared by the scene, the tests and
// the C# port (Scripts/Puzzles/SentenceBoard/BoardRules.cs, same vectors in Content/Puzzles/W-01.vectors.json).
//
// Two phases per stage:
//  1. Sentence Assembly (Drag → Snap): a plaque is joined to a row whose picture card is the place the sentence is ABOUT
//     (its subject). A row whose card the sentence only MENTIONS is the trap (FA_SINGLE_WORD_MATCH).
//  2. Sequence (rail): the joined rows are reordered; the stamp approves the order. The order is decided by the text:
//     sentence 1 introduces the neighbourhood, every later sentence refers back to the place before it.

export const plaqueOf = (stage, id) => stage.plaques.find((p) => p.plaque_id === id) || null;
export const plaqueFor = (stage, cardId) => stage.plaques.find((p) => p.subject === cardId) || null;
export const cardOf = (stage, id) => stage.cards.find((c) => c.card_id === id) || null;

/** Plaque dropped on the row showing `cardId` → 'ok' | 'trap' | 'wrong' (+ the trap word when it is the trap). */
export function classifyMatch(stage, plaqueId, cardId) {
  const p = plaqueOf(stage, plaqueId);
  if (!p || !cardOf(stage, cardId)) return { rule: 'outside', word: null };
  if (p.subject === cardId) return { rule: 'ok', word: null };
  const t = p.traps.find((x) => x.card === cardId);
  return t ? { rule: 'trap', word: t.word } : { rule: 'wrong', word: null };
}

/** Rows that still accept the plaque under Answer Assist: the right row and its (first) trap row. */
export function assistRows(stage, plaqueId) {
  const p = plaqueOf(stage, plaqueId);
  if (!p) return [];
  const other = p.traps.length ? p.traps[0].card : stage.cards.map((c) => c.card_id).find((c) => c !== p.subject);
  return [p.subject, other];
}

/**
 * The stamp checks an order (card ids top → bottom).
 * → { ok, firstWrong (row index or -1), rule: 'ok' | 'intro_not_first' | 'chain_broken', breaks: [{row, needs, after}] }
 * `breaks` lists every row whose sentence refers to a place that is not the row right above it (what H2 shows).
 */
export function checkOrder(stage, order) {
  const ans = stage.answer_order;
  const firstWrong = order.findIndex((c, i) => c !== ans[i]);
  const breaks = [];
  order.forEach((c, i) => {
    const p = plaqueFor(stage, c);
    if (!p) return;
    if (!p.link) { if (i !== 0) breaks.push({ row: i, needs: 'first', after: order[i - 1] }); return; }
    const need = p.link.refers_to || ans[ans.indexOf(c) - 1];          // a time word («آخرِ کار») follows the row before it in the answer
    if (i === 0 || order[i - 1] !== need) breaks.push({ row: i, needs: need, after: i ? order[i - 1] : null });
  });
  if (firstWrong < 0) return { ok: true, firstWrong: -1, rule: 'ok', breaks: [] };
  return { ok: false, firstWrong, rule: order[0] !== ans[0] ? 'intro_not_first' : 'chain_broken', breaks };
}

/** Move the row at `from` to index `to` (the others shift along the rail). Returns a new array. */
export function moveRow(order, from, to) {
  const out = order.slice();
  const [c] = out.splice(from, 1);
  out.splice(Math.max(0, Math.min(out.length, to)), 0, c);
  return out;
}

/** Assist for the sequence: the introducing row slides to slot 1 (the rest keep their relative order). */
export function assistOrder(stage, order) {
  const intro = stage.answer_order[0];
  return moveRow(order, order.indexOf(intro), 0);
}

/** Text segments for drawing: marks the given phrases (subject words, link words, intro words). */
export function markSegments(text, phrases) {
  const flags = new Array(text.length).fill(false);
  for (const ph of phrases || []) {
    if (!ph) continue;
    let i = text.indexOf(ph);
    while (i >= 0) { for (let k = i; k < i + ph.length; k++) flags[k] = true; i = text.indexOf(ph, i + ph.length); }
  }
  const segs = [];
  for (let i = 0; i < text.length; i++) {
    const last = segs[segs.length - 1];
    if (last && last.key === flags[i]) last.t += text[i]; else segs.push({ t: text[i], key: flags[i] });
  }
  return segs;
}
