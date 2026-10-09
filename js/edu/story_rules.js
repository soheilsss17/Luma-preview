// LUMA — pure rules of PERSIAN-13 «درس آزاد» (festival story board, open-ended but constrained). No DOM, no time: shared
// by the scene, the tests and the C# port (Scripts/Puzzles/StoryBoard/StoryRules.cs, same vectors in P-13.vectors.json).
//
// Slot 1 holds the topic (a word card). Slots 2–6 hold sentence cards top-down WITHOUT gaps. ANY composition is accepted
// when (checked in this order, so the card misconception is named first):
//   1. off_topic       — every sentence is about the chosen topic            (FA_SEPARATE_SENTENCES_COHERENT)
//   2. duplicate_idea  — no idea is said twice                               (WR_MORE_SENTENCES_BETTER)
//   3. main_not_first  — the topic's main sentence opens the text
//   4. closing_not_last— a closing sentence (optional) is the last one
//   5. too_few         — at least `min_details` detail sentences
export const RULES = ['off_topic', 'duplicate_idea', 'main_not_first', 'closing_not_last', 'too_few'];

export const cardOf = (puzzle, id) => puzzle.cards.find((c) => c.card_id === id) || null;
export const trayFor = (stage, topic) => { const t = stage.trays.find((x) => x.topic === topic); return t ? t.cards.slice() : []; };

/**
 * Evaluate a composition. `seq` = card ids in slot order (no gaps).
 * → { ok, rule, cards (ids that break the rule), topicConsistent, details, count }
 */
export function evaluate(puzzle, topic, seq) {
  const cards = seq.map((id) => cardOf(puzzle, id));
  const minDetails = (puzzle.slots && puzzle.slots.min_details) || 2;
  const off = cards.filter((c) => c.topic !== topic).map((c) => c.card_id);
  const topicConsistent = off.length === 0;
  const details = cards.filter((c) => c.topic === topic && c.role === 'detail').length;
  const base = { topicConsistent, details, count: seq.length };
  if (!topic) return { ok: false, rule: 'no_topic', cards: [], ...base };
  if (off.length) return { ok: false, rule: 'off_topic', cards: off, ...base };
  const seen = new Map(), dup = [];
  for (const c of cards) { if (seen.has(c.idea)) dup.push(seen.get(c.idea), c.card_id); else seen.set(c.idea, c.card_id); }
  if (dup.length) return { ok: false, rule: 'duplicate_idea', cards: [...new Set(dup)], ...base };
  const main = cards.findIndex((c) => c.role === 'main');
  if (main !== 0) return { ok: false, rule: 'main_not_first', cards: main > 0 ? [cards[main].card_id] : [], ...base };
  const close = cards.findIndex((c) => c.role === 'closing');
  if (close >= 0 && close !== cards.length - 1) return { ok: false, rule: 'closing_not_last', cards: [cards[close].card_id], ...base };
  if (details < minDetails) return { ok: false, rule: 'too_few', cards: [], ...base };
  return { ok: true, rule: 'ok', cards: [], ...base };
}

/** The topic's main sentence (what H2 marks). */
export const mainCard = (puzzle, topic) => puzzle.cards.find((c) => c.topic === topic && c.role === 'main') || null;

/** Every accepted composition that can be built from a tray (brute force; used by tests + the design note «44 per topic»). */
export function validCompositions(puzzle, stage, topic, maxLen = 5) {
  const pool = trayFor(stage, topic), out = [];
  const rec = (seq, used) => {
    if (seq.length && evaluate(puzzle, topic, seq).ok) out.push(seq.slice());
    if (seq.length === maxLen) return;
    for (const id of pool) if (!used.has(id)) { used.add(id); seq.push(id); rec(seq, used); seq.pop(); used.delete(id); }
  };
  rec([], new Set());
  return out;
}

/** Answer Assist: the cards that stay available (off-topic ones leave). */
export const assistTray = (puzzle, stage, topic) => trayFor(stage, topic).filter((id) => cardOf(puzzle, id).topic === topic);
