// QURAN-01: respectful, timer-free preparation of a quiet reading place.
// No Qur'anic text/audio is fabricated here; the stand's pages remain blank until verified assets are supplied.
export const ITEMS = Object.freeze(['book_stand', 'lamp']);
export const SLOT_FOR = Object.freeze({ book_stand: 'reading_desk', lamp: 'lamp_table' });
export function evaluatePrepared(state) {
  const missing = [];
  if (!state.found.book_stand) missing.push('FIND_BOOK_STAND');
  if (!state.found.lamp) missing.push('FIND_LAMP');
  if (!state.placed.book_stand) missing.push('PLACE_BOOK_STAND');
  if (!state.placed.lamp) missing.push('PLACE_LAMP');
  if (!state.lampOn) missing.push('TURN_LAMP_ON');
  if (!state.curtainOpen) missing.push('OPEN_CURTAIN');
  if (!state.observed.page) missing.push('OBSERVE_PAGE_LIGHT');
  if (!state.observed.window) missing.push('OBSERVE_WINDOW_LIGHT');
  return { ok: missing.length === 0, missing };
}
