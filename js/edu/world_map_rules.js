// LUMA — world map and quest payoff rules (pure; same logic as Unity WorldMapRules.cs, data: Content/World/WORLD_MAP.json).
// Plan 09 §1 World Map: NEO's cloth map shows only discovered rooms and allows fast travel.
// Plan 05 §4.1: Q01 result = «the festival starts and the village map opens».
// `flag` is a function (id) => boolean (SaveSlot.flag bound) or a Set of flag ids.

const has = (flag, id) => (typeof flag === 'function' ? !!flag(id) : flag.has(id));

/** A room is discovered once its unlock flag is set (the previous room's result); rooms without one are always known. */
export function roomDiscovered(room, flag) { return !room.unlock_flag || has(flag, room.unlock_flag); }
export function roomDone(room, flag) { return !!room.done_flag && has(flag, room.done_flag); }

/** [{id, area, discovered, done, route, ...}] in data order. */
export function roomStates(wm, flag) {
  return wm.rooms.map((r) => ({ ...r, discovered: roomDiscovered(r, flag), done: roomDone(r, flag) }));
}

/** Areas without fog: every area holding a discovered room (base_state_revealed is the minimum once the map exists). */
export function revealedAreas(wm, flag) {
  const out = new Set(wm.base_state_revealed || []);
  for (const r of wm.rooms) if (roomDiscovered(r, flag)) out.add(r.area);
  return out;
}

export function payoffOf(wm, quest) { return wm.payoffs.find((p) => p.quest === quest) || null; }

/** The payoff plays when every card flag of the quest is set; `seen` = its own flag is already set. */
export function payoffReady(wm, quest, flag) {
  const p = payoffOf(wm, quest);
  return !!p && p.requires_flags.every((f) => has(flag, f));
}
export function payoffSeen(wm, quest, flag) { const p = payoffOf(wm, quest); return !!p && has(flag, p.sets_flag); }
export function missingForPayoff(wm, quest, flag) {
  const p = payoffOf(wm, quest); return p ? p.requires_flags.filter((f) => !has(flag, f)) : [];
}

/** The map opens with a payoff that unlocks it (Q01). */
export function mapUnlocked(wm, flag) { return wm.payoffs.some((p) => p.unlocks_map && has(flag, p.sets_flag)); }

/** The «next adventure» badge (Q02 gear on the workshop). */
export function hookActive(wm, flag) { const h = wm.next_hook; return !!h && has(flag, h.requires_flag); }

/** Rooms of one area in data order (fast-travel chips), only discovered ones. */
export function areaRooms(wm, areaId, flag) { return roomStates(wm, flag).filter((r) => r.area === areaId && r.discovered); }

/** Hit test in normalised map space: the area whose circle contains (u, v) (nearest centre wins), or null. */
export function areaAt(wm, u, v, aspect = 4 / 3) {
  let best = null, bestD = Infinity;
  for (const a of wm.areas) {
    const dx = u - a.cx, dy = (v - a.cy) / aspect, d = Math.hypot(dx, dy);   // r is a fraction of the sheet width
    if (d <= a.r * 1.1 && d < bestD) { best = a; bestD = d; }
  }
  return best;
}

/** Structural checks shared by the web tests and the C# EditMode tests. Returns a list of problems (empty = valid). */
export function validateWorldMap(wm) {
  const bad = [];
  const areaIds = new Set(wm.areas.map((a) => a.id));
  if (areaIds.size !== wm.areas.length) bad.push('duplicate area id');
  for (const a of wm.areas) if (!(a.cx > 0 && a.cx < 1 && a.cy > 0 && a.cy < 1 && a.r > 0 && a.r < 0.3)) bad.push('area out of range ' + a.id);
  const roomIds = new Set(wm.rooms.map((r) => r.id));
  if (roomIds.size !== wm.rooms.length) bad.push('duplicate room id');
  for (const r of wm.rooms) if (!areaIds.has(r.area)) bad.push('room in unknown area ' + r.id);
  for (const b of wm.base_state_revealed || []) if (!areaIds.has(b)) bad.push('unknown base area ' + b);
  if (wm.next_hook && !areaIds.has(wm.next_hook.area)) bad.push('hook in unknown area');
  const doneFlags = new Set(wm.rooms.map((r) => r.done_flag));
  for (const p of wm.payoffs) for (const f of p.requires_flags) if (!doneFlags.has(f)) bad.push('payoff flag not produced by a room ' + f);
  return bad;
}

/**
 * Fog coverage 0..1 at a normalised sheet point (same math as tools/derive_map_fog.py, before its cloud texture and alpha):
 * 1 everywhere, a smoothstep hole of radius r×1.25 (feather ±edge×r) for each revealed area. `open` maps areaId → hole
 * scale 0..1 (animated reveal); missing ids are closed. `aspect` = sheet width / height.
 */
export function fogAt(wm, open, u, v, aspect = 4 / 3) {
  const edge = wm.fog.edge;
  let m = 1;
  for (const a of wm.areas) {
    const k = open.get ? open.get(a.id) || 0 : open[a.id] || 0;
    if (k <= 0) continue;
    const d = Math.hypot(u - a.cx, (v - a.cy) / aspect), r = a.r * k;    // distances in sheet-width units
    const inner = r * 1.25 - edge * r, outer = r * 1.25 + edge * r;
    const h = Math.min(1, Math.max(0, (d - inner) / (outer - inner)));
    m = Math.min(m, h * h * (3 - 2 * h));
  }
  return m;
}
