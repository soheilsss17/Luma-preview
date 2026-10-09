// LUMA — NEO's cloth world map (plan 09 §1 World Map; plan 05 §4.1: opens with the Q01 payoff «the festival starts»).
// Only discovered places are clear; everything else sleeps under one cream fog wash with soft holes (WORLD_MAP.json fog, the same
// math as tools/derive_map_fog.py). A pin on each revealed area opens a strip of room cards (thumbnails) for fast travel.
// The Q02 hook: a pulsing gear badge on the workshop; LUMI says the tower clock is missing a gear (Q02 is not built yet).
// Wordless except the area titles, the room names on the cards and LUMI's one hook line.
import { SaveSlot, AnalyticsQueue } from '../edu/engines.js';
import { Spring, Spring2, Timeline, ease, reduceMotion } from '../engine/motion.js';
import * as R from '../edu/world_map_rules.js';

export const W = 1920, H = 1080;
const FONT = 'LumaFa, Vazirmatn, Tahoma, sans-serif';
// map_world is 1400×1050 (4:3, the sheet the area fractions refer to); its own cloth border sits at bbox 54..1346 × 60..991.
export const MAP = { x: 295, y: 41, w: 1330, h: 997.5 };
// map_cloth (1024², opaque 41..983 × 172..851) scaled so its cloth lies exactly under the map's border (same 1.388 ratio).
export const CLOTH = { x: 292.6, y: -126.2, w: 1334.9, h: 1334.9 };
export const CLOSE = { x: 1830, y: 90, r: 52 };
export const PANEL = { y: 716, h: 330, chipW: 300, chipH: 232, gap: 26 };   // title row (pr.y + 40) above the cards (pr.y + 84 …)
const FOG_W = 350, FOG_H = 262;                  // fog mask resolution (upscaled smoothly; the edges are soft anyway)
const SEEN_KEY = 'luma.map.seen';

export const areaXY = (a) => ({ x: MAP.x + a.cx * MAP.w, y: MAP.y + a.cy * MAP.h });
export const pinXY = (a) => { const p = areaXY(a); return { x: p.x, y: p.y - a.r * MAP.w * 0.28 }; };
export const badgeXY = (a) => { const p = pinXY(a); return { x: p.x + 82, y: p.y - 30 }; };

function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  if (typeof document !== 'undefined' && document.createElement) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  return null;
}
/** smooth value noise (seeded 24×18 grid, like the derive script's cloud texture) in 0..1 */
function cloudAt(u, v) {
  const gx = u * 23, gy = v * 17, x0 = Math.floor(gx), y0 = Math.floor(gy), fx = gx - x0, fy = gy - y0;
  const r = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7 + 7) * 43758.5453; return s - Math.floor(s); };
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = r(x0, y0) + (r(x0 + 1, y0) - r(x0, y0)) * sx, b = r(x0, y0 + 1) + (r(x0 + 1, y0 + 1) - r(x0, y0 + 1)) * sx;
  return a + (b - a) * sy;
}

export class WorldMap {
  constructor({ sprites, world, audio, storage, debug, strings, onTravel, onClose }) {
    Object.assign(this, { sprites, world, audio, storage, debugEvents: debug, strings, onTravel, onClose });
    this.save = new SaveSlot(storage);
    this.analytics = new AnalyticsQueue(storage, ['area_id', 'room_id']);
  }
  str(k) { return this.strings ? this.strings.t(k) : k; }
  flag = (id) => this.save.flag(id);

  async load() {
    this.t = 0; this.tl = new Timeline(); this.ink = 0; this.sel = null; this.panel = new Spring(0, { stiffness: 70, damping: 12 });
    this.bubble = null; this.puffs = []; this.leaving = null; this.pressed = null;
    const seen = JSON.parse(this.storage.getItem(SEEN_KEY) || '{"areas":[],"hook":false}');
    this.revealed = R.revealedAreas(this.world, this.flag);
    this.newAreas = [...this.revealed].filter((a) => !seen.areas.includes(a) && !(this.world.base_state_revealed || []).includes(a));
    this.open = new Map([...this.revealed].map((a) => [a, this.newAreas.includes(a) ? 0 : 1]));
    this.hook = R.hookActive(this.world, this.flag);
    this.hookNew = this.hook && !seen.hook;
    this.lumi = { p: new Spring2(MAP.x + MAP.w * 0.5, MAP.y + MAP.h * 0.35, { stiffness: 20, damping: 7 }) };
    this.fogDirty = true; this.fogCanvas = makeCanvas(FOG_W, FOG_H); this.comp = makeCanvas(1400, 1050);
    this.tl.tween(0.9, (k) => { this.ink = ease.outCubic(k); });                 // the ink soaks into the cloth
    this.newAreas.forEach((id, i) => this.tl.after(1.0 + i * 0.5, () => {        // a fresh area: the fog draws back
      this.audio.shimmer && this.audio.shimmer();
      this.tl.tween(1.3, (k) => { this.open.set(id, ease.outCubic(k)); this.fogDirty = true; });
    }));
    const hookAt = 1.2 + this.newAreas.length * 0.5 + (this.newAreas.length ? 1.2 : 0);
    if (this.hookNew) this.tl.after(hookAt, () => this.showHook());
    this.storage.setItem(SEEN_KEY, JSON.stringify({ areas: [...this.revealed], hook: seen.hook || this.hook }));
    this.analytics.log('map_open', { revealed: [...this.revealed].join(','), hook: this.hook });
    this.debugEvents.push({ event: 'map_open' });
    return this;
  }

  // ---------------------------------------------------------------- model helpers
  areasWithPins() { return this.world.areas.filter((a) => this.open.has(a.id) && (R.areaRooms(this.world, a.id, this.flag).length || (this.hook && this.world.next_hook.area === a.id))); }
  chips() {
    if (!this.sel) return [];
    const rooms = R.areaRooms(this.world, this.sel, this.flag), n = rooms.length;
    const total = n * PANEL.chipW + (n - 1) * PANEL.gap, x0 = W / 2 + total / 2;                // RTL: the first room on the right
    return rooms.map((r, i) => ({ room: r, x: x0 - PANEL.chipW / 2 - i * (PANEL.chipW + PANEL.gap), y: PANEL.y + 84 + PANEL.chipH / 2 }));
  }
  panelRect() {
    const n = Math.max(1, this.chips().length), w = Math.max(560, n * PANEL.chipW + (n - 1) * PANEL.gap + 90);
    return { x: W / 2 - w / 2, y: PANEL.y, w, h: PANEL.h };
  }

  showHook() {
    const a = this.world.areas.find((q) => q.id === this.world.next_hook.area), b = badgeXY(a);
    this.lumi.p.to(b.x + 90, b.y - 40);
    this.say(this.str('map.hook'), 6.5);
    this.audio.bell && this.audio.bell();
    this.analytics.log('map_hook_shown', { quest_id: this.world.next_hook.quest });
  }
  say(text, sec) { const b = { text, t: 0 }; this.bubble = b; this.tl.after(sec, () => { if (this.bubble === b) this.bubble = null; }); }

  select(id) {
    if (this.sel === id) { this.sel = null; this.panel.target = 0; return; }
    this.sel = id; this.panel.set(0); this.panel.target = 1;
    const a = this.world.areas.find((q) => q.id === id), p = pinXY(a);
    this.lumi.p.to(p.x - 90, p.y - 60);                                          // left of the pin: never over the gear badge
    this.audio.pickup && this.audio.pickup();
    this.analytics.log('map_area_open', { area_id: id });
  }

  travel(room) {
    if (this.leaving) return;
    this.leaving = { a: 0, route: room.route };
    this.audio.paper && this.audio.paper();
    this.analytics.log('map_travel', { area_id: room.area, room_id: room.room_id || room.id });
    this.debugEvents.push({ event: 'map_travel', room: room.id });
    this.tl.tween(0.45, (k) => { this.leaving.a = k; }, () => this.onTravel && this.onTravel(room.route));
  }

  // ---------------------------------------------------------------- input
  pointerDown(x, y) {
    this.audio.unlock && this.audio.unlock();
    if (this.leaving || this.ink < 0.5) return;
    if (Math.hypot(x - CLOSE.x, y - CLOSE.y) < CLOSE.r * 1.25) { this.pressed = 'close'; this.leaving = { a: 0 }; this.tl.tween(0.35, (k) => { this.leaving.a = k; }, () => this.onClose && this.onClose()); return; }
    if (this.sel && this.panel.value > 0.6) {
      for (const c of this.chips()) if (Math.abs(x - c.x) < PANEL.chipW / 2 && Math.abs(y - c.y) < PANEL.chipH / 2) { this.travel(c.room); return; }
      const pr = this.panelRect();
      if (x > pr.x && x < pr.x + pr.w && y > pr.y) return;                            // inside the strip, not on a card
    }
    if (this.hook) {
      const a = this.world.areas.find((q) => q.id === this.world.next_hook.area), b = badgeXY(a);
      if (Math.hypot(x - b.x, y - b.y) < 62) { this.showHook(); return; }
    }
    for (const a of this.areasWithPins()) { const p = pinXY(a); if (Math.hypot(x - p.x, y - p.y) < 70) { this.select(a.id); return; } }
    const u = (x - MAP.x) / MAP.w, v = (y - MAP.y) / MAP.h, a = R.areaAt(this.world, u, v);
    if (a && this.open.has(a.id)) { if (this.areasWithPins().includes(a)) this.select(a.id); return; }
    if (a) {                                                                        // a sleeping area: a puff of fog, LUMI shrugs
      this.puffs.push({ x, y, t: 0 }); this.audio.rustle && this.audio.rustle();
      this.say(this.str('map.fog'), 2.6);
      this.analytics.log('map_fog_tap', { area_id: a.id });
      return;
    }
    if (this.sel) { this.sel = null; this.panel.target = 0; }
  }
  pointerMove() {}
  pointerUp() { this.pressed = null; }

  update(dt) {
    this.t += dt; this.tl.update(dt); this.panel.update(dt); this.lumi.p.update(dt);
    if (this.bubble) this.bubble.t += dt;
    for (const p of this.puffs) p.t += dt;
    this.puffs = this.puffs.filter((p) => p.t < 1.2);
  }

  // ---------------------------------------------------------------- fog
  rebuildFog() {
    this.fogDirty = false;
    const fc = this.fogCanvas, cc = this.comp, map = this.sprites.get('map_world');
    if (!fc || !cc || !map) return;
    const f = fc.getContext('2d'), img = f.createImageData(FOG_W, FOG_H), d = img.data, fog = this.world.fog;
    const col = [1, 3, 5].map((i) => parseInt(fog.colour.slice(i, i + 2), 16));
    for (let y = 0; y < FOG_H; y++) for (let x = 0; x < FOG_W; x++) {
      const u = (x + 0.5) / FOG_W, v = (y + 0.5) / FOG_H, m = R.fogAt(this.world, this.open, u, v) * (0.86 + 0.14 * cloudAt(u, v)) * fog.alpha;
      const o = (y * FOG_W + x) * 4; d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = Math.round(m * 255);
    }
    f.putImageData(img, 0, 0);
    const c = cc.getContext('2d');
    c.globalCompositeOperation = 'source-over'; c.clearRect(0, 0, 1400, 1050);
    c.drawImage(map._im || map, 0, 0, 1400, 1050);
    c.globalCompositeOperation = 'source-atop';                 // the fog lies only on the cloth (the sheet's alpha is kept)
    c.imageSmoothingEnabled = true; c.drawImage(fc, 0, 0, 1400, 1050);
    c.globalCompositeOperation = 'source-over';
  }

  // ---------------------------------------------------------------- draw
  draw(ctx) {
    const back = this.sprites.get('plaza_festival', 'plaza_restored');
    if (back) ctx.drawImage(back, 0, 0, W, H);
    ctx.fillStyle = 'rgba(20,14,8,0.55)'; ctx.fillRect(0, 0, W, H);
    const cloth = this.sprites.get('map_cloth');
    if (cloth) ctx.drawImage(cloth, CLOTH.x, CLOTH.y, CLOTH.w, CLOTH.h);
    if (this.fogDirty) this.rebuildFog();
    ctx.save(); ctx.globalAlpha = this.ink;
    if (this.comp) ctx.drawImage(this.comp, MAP.x, MAP.y, MAP.w, MAP.h);
    else { const m = this.sprites.get('map_world'); if (m) ctx.drawImage(m, MAP.x, MAP.y, MAP.w, MAP.h); }
    ctx.restore();
    if (this.ink > 0.6) { this.drawPins(ctx); this.drawHookBadge(ctx); this.drawPuffs(ctx); this.drawLumi(ctx); }
    this.drawClose(ctx);
    this.drawPanel(ctx);
    this.drawBubble(ctx);
    if (this.leaving) { ctx.fillStyle = `rgba(20,12,6,${this.leaving.a.toFixed(3)})`; ctx.fillRect(0, 0, W, H); }
  }

  drawPins(ctx) {
    const pin = this.sprites.get('map_pin');
    for (const a of this.areasWithPins()) {
      const p = pinXY(a), sel = this.sel === a.id, bob = sel ? 6 * Math.sin(this.t * 5) : 2 * Math.sin(this.t * 2 + a.cx * 9);
      const k = this.open.get(a.id) || 0; if (k < 0.5) continue;
      const s = (sel ? 1.12 : 1) * Math.min(1, (k - 0.5) * 2), sz = 118 * s;
      ctx.fillStyle = 'rgba(40,26,12,0.3)'; ctx.beginPath(); ctx.ellipse(p.x, p.y + 4, 22 * s, 7 * s, 0, 0, Math.PI * 2); ctx.fill();
      if (pin) ctx.drawImage(pin, p.x - sz / 2, p.y - sz * 0.95 - bob, sz, sz);           // the pin's tip sits on the area
      const label = this.str(a.name_key);
      ctx.font = `800 30px ${FONT}`; ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const tw = ctx.measureText(label).width + 36, ly = p.y + 36;
      ctx.fillStyle = sel ? 'rgba(255,244,214,0.97)' : 'rgba(250,238,208,0.9)'; ctx.strokeStyle = 'rgba(140,100,45,0.85)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.roundRect(p.x - tw / 2, ly - 22, tw, 44, 14); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#4a3418'; ctx.fillText(label, p.x, ly + 1);
    }
  }

  drawHookBadge(ctx) {
    if (!this.hook) return;
    const a = this.world.areas.find((q) => q.id === this.world.next_hook.area);
    if ((this.open.get(a.id) || 0) < 0.5) return;
    const b = badgeXY(a), pulse = 0.5 + 0.5 * Math.sin(this.t * 4), gear = this.sprites.get(this.world.next_hook.icon_sprite || 'gear_large');
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(b.x, b.y, 4, b.x, b.y, 80);
    g.addColorStop(0, `rgba(255,210,120,${(0.35 + 0.35 * pulse).toFixed(3)})`); g.addColorStop(1, 'rgba(255,210,120,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(b.x, b.y, 80, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    ctx.fillStyle = 'rgba(255,248,226,0.95)'; ctx.strokeStyle = 'rgba(170,120,50,0.95)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(b.x, b.y, 44, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (gear) { ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(this.t * 0.6); const s = 70 * (1 + 0.06 * pulse); ctx.drawImage(gear, -s / 2, -s / 2, s, s); ctx.restore(); }
  }

  drawPuffs(ctx) {
    for (const p of this.puffs) {
      const k = p.t / 1.2;
      ctx.fillStyle = `rgba(239,227,200,${(0.8 * (1 - k)).toFixed(3)})`;
      for (let i = 0; i < 5; i++) { const a = i * 1.256 + 0.4; ctx.beginPath(); ctx.arc(p.x + Math.cos(a) * 50 * k, p.y + Math.sin(a) * 30 * k, 22 + 18 * k, 0, Math.PI * 2); ctx.fill(); }
    }
  }

  drawLumi(ctx) {
    const x = this.lumi.p.x.value, y = this.lumi.p.y.value + 6 * Math.sin(this.t * 3), pulse = 1 + 0.06 * Math.sin(this.t * 5);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y, 4, x, y, 75 * pulse);
    g.addColorStop(0, 'rgba(255,230,170,0.55)'); g.addColorStop(1, 'rgba(255,200,120,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 75 * pulse, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    const img = this.sprites.get('lumi_front');
    if (img) { const s = 0.36 * pulse; ctx.drawImage(img, x - 128 * s, y - 128 * s, 256 * s, 256 * s); }
  }

  drawClose(ctx) {                                      // wordless close: ✕ in a cloth disc (same look as the Reading Card close)
    const s = this.pressed === 'close' ? 0.92 : 1;
    ctx.save(); ctx.translate(CLOSE.x, CLOSE.y); ctx.scale(s, s);
    ctx.fillStyle = 'rgba(250,240,215,0.95)'; ctx.strokeStyle = 'rgba(150,110,50,0.9)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(0, 0, CLOSE.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#6b4a1e'; ctx.lineWidth = 9; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-17, -17); ctx.lineTo(17, 17); ctx.moveTo(17, -17); ctx.lineTo(-17, 17); ctx.stroke();
    ctx.restore();
  }

  drawPanel(ctx) {
    const k = this.panel.value;
    if (!this.sel || k < 0.02) return;
    const pr = this.panelRect(), dy = (1 - Math.min(1, k)) * 380;
    ctx.fillStyle = `rgba(20,14,8,${(0.4 * Math.min(1, k)).toFixed(3)})`; ctx.fillRect(0, 0, W, H);   // the map steps back behind the strip
    ctx.save(); ctx.translate(0, dy);
    ctx.fillStyle = 'rgba(92,62,32,0.95)'; ctx.beginPath(); ctx.roundRect(pr.x, pr.y, pr.w, pr.h + 40, 26); ctx.fill();
    ctx.fillStyle = 'rgba(247,234,203,0.98)'; ctx.beginPath(); ctx.roundRect(pr.x + 10, pr.y + 10, pr.w - 20, pr.h + 20, 20); ctx.fill();
    const a = this.world.areas.find((q) => q.id === this.sel);
    ctx.font = `800 32px ${FONT}`; ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#5a3e14'; ctx.fillText(this.str(a.name_key), W / 2, pr.y + 44);
    for (const c of this.chips()) this.drawChip(ctx, c);
    ctx.restore();
  }

  drawChip(ctx, c) {
    const w = PANEL.chipW, h = PANEL.chipH, x = c.x - w / 2, y = c.y - h / 2, th = this.sprites.get(c.room.thumb);
    ctx.fillStyle = 'rgba(255,250,236,1)'; ctx.strokeStyle = c.room.done ? 'rgba(96,150,70,0.95)' : 'rgba(170,125,60,0.9)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 18); ctx.fill(); ctx.stroke();
    const tw = w - 24, tH = tw * 9 / 16;
    if (th) { ctx.save(); ctx.beginPath(); ctx.roundRect(x + 12, y + 12, tw, tH, 12); ctx.clip(); ctx.drawImage(th, x + 12, y + 12, tw, tH); ctx.restore(); }
    ctx.font = `700 26px ${FONT}`; ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#4a3418'; ctx.fillText(this.str(c.room.name_key), c.x, y + 12 + tH + 30, w - 20);
    if (c.room.done) {                                                         // a small green seal: this place is fixed
      const bx = x + w - 26, by = y + 26;
      ctx.fillStyle = 'rgba(96,160,70,0.97)'; ctx.beginPath(); ctx.arc(bx, by, 22, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(bx - 10, by); ctx.lineTo(bx - 3, by + 8); ctx.lineTo(bx + 11, by - 8); ctx.stroke();
    }
  }

  drawBubble(ctx) {
    if (!this.bubble) return;
    ctx.save(); ctx.globalAlpha = Math.min(1, this.bubble.t / 0.3);
    ctx.font = `700 34px ${FONT}`; ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const bw = Math.min(ctx.measureText(this.bubble.text).width + 80, 1500), by = 30;
    ctx.fillStyle = 'rgba(255,248,226,0.97)'; ctx.strokeStyle = 'rgba(214,170,80,0.95)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(W / 2 - bw / 2, by, bw, 66, 33); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#5a3e14'; ctx.fillText(this.bubble.text, W / 2, by + 34, 1440);
    ctx.restore();
  }

  debugState() {
    return { scene: 'world_map', t: this.t.toFixed(1), revealed: [...this.revealed].join(','), new: this.newAreas.join(','), sel: this.sel || '-', hook: this.hook };
  }
}
