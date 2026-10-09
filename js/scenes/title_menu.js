// LUMA — diegetic main menu (plan 09 §1): MIRA's workshop, NEO asleep; a tap wakes him. Continue / Start (New game),
// Settings (music, sounds, reduce motion) and the parent area behind a 3-second hold Parent Gate (plan 07 §9) with the
// "Tree of Light" dashboard (plan 10 §5: no scores, no ranking, no "weak", local only).
import { RigActor } from '../engine/rig.js';
import { faDigits } from '../engine/strings.js';
import { setReduceMotion, reduceMotion } from '../engine/motion.js';
import { MasteryEngine, AnalyticsQueue } from '../edu/engines.js';
import { drawWakeGlow } from './workshop_tutorial.js';

export const W = 1920, H = 1080;
const FONT = 'LumaFa, Vazirmatn, Tahoma, sans-serif';
const SETTINGS_KEY = 'luma.settings';

export function loadSettings(storage) {
  return { music: true, sfx: true, reduceMotion, ...JSON.parse(storage.getItem(SETTINGS_KEY) || '{}') };
}
export function applySettings(s, audio) { audio.setMusic(s.music); audio.setSfx(s.sfx); setReduceMotion(s.reduceMotion); }

export class TitleMenu {
  constructor({ sprites, strings, audio, storage, onPlay }) {
    Object.assign(this, { sprites, strings, audio, storage, onPlay });
    this.t = 0; this.sheet = null; this.hold = null; this.confirmNew = 0; this.buttons = [];
    this.settings = loadSettings(storage);
    applySettings(this.settings, audio);
  }
  async load() {
    this.neo = await new RigActor({ id: 'NEO', scale: 0.4, x: 560, groundY: 1010, face: 1 }).load();
    this.neo.rate = 0; this.asleep = true;
    return this;
  }
  get hasSave() { return !!this.storage.getItem('luma.save.slot1'); }
  T(k) { return this.strings.t(k); }

  layout() {                                        // paper tabs on the right, readable at phone size (≥ 48 dp)
    const b = [];
    const x = 1390, w = 440, h = 104;
    let y = 400;
    if (this.hasSave) { b.push({ id: 'continue', label: this.T('menu.continue'), x, y, w, h, primary: true }); y += 130; }
    b.push({ id: this.hasSave ? 'new' : 'start', label: this.confirmNew > 0 ? this.T('menu.new_game_confirm') : this.T(this.hasSave ? 'menu.new_game' : 'menu.start'), x, y, w, h, primary: !this.hasSave, small: this.confirmNew > 0 });
    y += 130;
    b.push({ id: 'settings', label: this.T('menu.settings'), x, y, w, h: 88 }); y += 112;
    b.push({ id: 'parents', label: this.T('menu.parents'), x, y, w, h: 80, quiet: true });
    this.buttons = b;
  }

  pointerDown(x, y) {
    this.audio.unlock();
    if (this.sheet) return this.sheetDown(x, y);
    this.layout();
    for (const b of this.buttons) if (x > b.x - b.w / 2 && x < b.x + b.w / 2 && y > b.y - b.h / 2 && y < b.y + b.h / 2) return this.press(b.id);
    if (this.neo.hit(x, y) || (Math.abs(x - this.neo.x) < 120 && y > 700)) this.wake();
  }
  pointerMove() {}
  pointerUp() { if (this.hold && this.hold.t < 3) this.hold = null; }
  wake() {
    if (!this.asleep) { this.neo.play('happy', 'idle'); return; }
    this.asleep = false; this.wakeGlow = 1; this.neo.rate = 1; this.neo.play('happy', 'idle'); this.audio.wake();
  }
  press(id) {
    this.audio.snap();
    if (id === 'continue' || id === 'start') { this.wake(); this.leaving = 0; this.next = id; }
    else if (id === 'new') {
      if (this.confirmNew > 0) {
        const keys = this.storage.m ? Object.keys(this.storage.m) : Object.keys(this.storage);   // MemoryStorage | localStorage
        for (const k of keys) if (k.startsWith('luma.') && k !== SETTINGS_KEY) this.storage.removeItem(k);
        this.confirmNew = 0; this.wake(); this.leaving = 0; this.next = 'start';
      } else this.confirmNew = 4;
    } else if (id === 'settings') this.sheet = { kind: 'settings' };
    else if (id === 'parents') this.hold = { t: 0 };
  }

  sheetDown(x, y) {
    const s = this.sheet;
    if (Math.hypot(x - 960, y - 900) < 90 || x < 360 || x > 1560) { this.sheet = null; this.audio.snap(); return; }   // back
    if (s.kind === 'settings') {
      const rows = ['music', 'sfx', 'reduceMotion'];
      rows.forEach((k, i) => {
        const ry = 380 + i * 150;
        if (y > ry - 60 && y < ry + 60) {
          this.settings[k] = !this.settings[k];
          this.storage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
          applySettings(this.settings, this.audio); this.audio.snap();
        }
      });
    }
  }

  update(dt) {
    this.t += dt; this.neo.update(dt);
    if (this.wakeGlow > 0) this.wakeGlow = Math.max(0, this.wakeGlow - dt * 0.8);
    if (this.confirmNew > 0) this.confirmNew = Math.max(0, this.confirmNew - dt);
    if (this.hold) { this.hold.t += dt; if (this.hold.t >= 3) { this.hold = null; this.sheet = { kind: 'parents' }; this.audio.chime(); } }
    if (this.leaving != null) { this.leaving += dt; if (this.leaving >= 1.1 && !this.left) { this.left = true; this.onPlay && this.onPlay(this.next); } }
  }

  draw(ctx) {
    const S = this.sprites;
    ctx.drawImage(S.get('ws_plate'), 0, 0, W, H);
    const g = ctx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, 'rgba(15,10,6,0.25)'); g.addColorStop(0.6, 'rgba(15,10,6,0.45)'); g.addColorStop(1, 'rgba(15,10,6,0.7)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // NEO asleep on the floor by MIRA's bench; tiny "z" light motes rise while he sleeps
    if (this.asleep) { ctx.save(); ctx.filter = 'brightness(0.55) saturate(0.45)'; this.neo.draw(ctx); ctx.restore(); } else this.neo.draw(ctx);
    if (this.wakeGlow > 0) drawWakeGlow(ctx, this.neo, this.wakeGlow);
    if (this.asleep) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) {
        const k = ((this.t * 0.35 + i / 3) % 1), x = this.neo.x + 40 + k * 60, y = 740 - k * 160;
        ctx.fillStyle = `rgba(255,220,150,${0.5 * (1 - k)})`; ctx.beginPath(); ctx.arc(x, y, 6 + 8 * k, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
    // title
    ctx.save(); ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `800 170px ${FONT}`; ctx.shadowColor = 'rgba(255,190,90,0.85)'; ctx.shadowBlur = 38 + 8 * Math.sin(this.t * 1.6);
    ctx.fillStyle = '#ffe7b0'; ctx.fillText(this.T('game.title'), 1390, 210); ctx.restore();
    // menu tabs
    this.layout();
    for (const b of this.buttons) this.drawTab(ctx, b);
    if (this.hold) {                                // Parent Gate progress ring around the parents tab
      const b = this.buttons.find((q) => q.id === 'parents');
      ctx.save(); ctx.strokeStyle = 'rgba(255,220,150,0.95)'; ctx.lineWidth = 8; ctx.beginPath();
      ctx.arc(b.x - b.w / 2 - 50, b.y, 30, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, this.hold.t / 3)); ctx.stroke(); ctx.restore();
      this.text(ctx, this.T('gate.hold'), 1390, b.y + 80, 30, '#f7e6c4', 500);
    }
    if (this.sheet) this.drawSheet(ctx);
    if (this.leaving != null) { ctx.fillStyle = `rgba(12,8,5,${Math.min(1, this.leaving / 1.1)})`; ctx.fillRect(0, 0, W, H); }
  }

  text(ctx, s, x, y, size, color, weight = 700, align = 'center') {
    ctx.save(); ctx.direction = 'rtl'; ctx.textAlign = align; ctx.textBaseline = 'middle';
    ctx.font = `${weight} ${size}px ${FONT}`; ctx.fillStyle = color; ctx.fillText(s, x, y); ctx.restore();
  }
  drawTab(ctx, b) {
    ctx.save();
    ctx.fillStyle = b.quiet ? 'rgba(250,240,215,0.55)' : b.primary ? 'rgba(255,236,196,0.97)' : 'rgba(250,240,215,0.9)';
    ctx.strokeStyle = b.primary ? 'rgba(190,130,50,0.95)' : 'rgba(150,110,50,0.8)'; ctx.lineWidth = b.primary ? 5 : 3;
    ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 6;
    ctx.beginPath(); ctx.roundRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h, 26); ctx.fill(); ctx.shadowColor = 'transparent'; ctx.stroke();
    ctx.restore();
    this.text(ctx, b.label, b.x, b.y + 2, b.small ? 26 : b.quiet ? 32 : b.primary ? 50 : 42, '#4a3418', b.primary ? 800 : 700);
  }
  drawSheet(ctx) {
    ctx.fillStyle = 'rgba(10,6,3,0.55)'; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.fillStyle = 'rgba(250,242,222,0.98)'; ctx.strokeStyle = 'rgba(150,110,50,0.9)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.roundRect(360, 110, 1200, 860, 34); ctx.fill(); ctx.stroke(); ctx.restore();
    const s = this.sheet;
    if (s.kind === 'settings') {
      this.text(ctx, this.T('settings.title'), 960, 210, 60, '#4a3418', 800);
      ['music', 'sfx', 'reduceMotion'].forEach((k, i) => {
        const y = 380 + i * 150, on = this.settings[k];
        this.text(ctx, this.T(k === 'reduceMotion' ? 'settings.reduce_motion' : 'settings.' + k), 1440, y, 46, '#4a3418', 700, 'right');
        ctx.save(); ctx.fillStyle = on ? '#e7b75a' : '#cbbfa6'; ctx.beginPath(); ctx.roundRect(520, y - 42, 220, 84, 42); ctx.fill();
        ctx.fillStyle = '#fffaf0'; ctx.beginPath(); ctx.arc(on ? 698 : 562, y, 34, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        this.text(ctx, this.T(on ? 'settings.on' : 'settings.off'), 850, y, 36, '#6b5230', 500);
      });
    } else {
      const m = new MasteryEngine(this.storage), a = new AnalyticsQueue(this.storage, []);
      this.text(ctx, this.T('parents.title'), 960, 190, 60, '#4a3418', 800);
      const concepts = Object.keys(m.data);
      if (!concepts.length) this.text(ctx, this.T('parents.none'), 960, 330, 34, '#6b5230', 500);
      else this.text(ctx, this.T('parents.intro'), 1480, 290, 32, '#6b5230', 500, 'right');
      concepts.forEach((c, i) => {
        const y = 380 + i * 120, lvl = m.get(c);
        this.text(ctx, this.strings.has('concept.' + c) ? this.T('concept.' + c) : c, 1480, y, 38, '#4a3418', 700, 'right');
        this.text(ctx, this.T('mastery.' + lvl), 1480, y + 46, 32, '#8a6a2e', 500, 'right');
        for (let k = 0; k < 5; k++) {                // five leaves of light, lit up to the level (no numbers, no score)
          ctx.fillStyle = k < lvl ? '#f0c060' : '#ddd2b8'; ctx.beginPath(); ctx.ellipse(470 + k * 52, y + 20, 18, 11, -0.6, 0, Math.PI * 2); ctx.fill();
        }
        if (this.strings.has('activity.' + c)) {
          this.text(ctx, this.T('parents.activity_title'), 1480, 640, 32, '#4a3418', 700, 'right');
          this.wrap(ctx, this.T('activity.' + c), 1480, 690, 1060, 30, '#6b5230');
        }
      });
      this.text(ctx, this.T('parents.no_ranking'), 960, 790, 28, '#8a7a5a', 500);
      this.text(ctx, this.T('parents.privacy') + faDigits(a.all().length), 960, 830, 26, '#8a7a5a', 500);
    }
    ctx.save(); ctx.fillStyle = '#e7b75a'; ctx.beginPath(); ctx.arc(960, 900, 56, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    this.text(ctx, this.T('ui.back'), 960, 902, 30, '#4a3418', 800);
  }
  wrap(ctx, s, xRight, y, maxW, size, color) {
    ctx.save(); ctx.font = `500 ${size}px ${FONT}`; ctx.direction = 'rtl';
    const words = s.split(' '); let line = '', yy = y;
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && line) { this.text(ctx, line, xRight, yy, size, color, 500, 'right'); line = w; yy += size * 1.5; } else line = test;
    }
    if (line) this.text(ctx, line, xRight, yy, size, color, 500, 'right');
    ctx.restore();
  }
  debugState() { return { room: 'MAIN_MENU', asleep: this.asleep, sheet: this.sheet ? this.sheet.kind : '-', has_save: this.hasSave }; }
}
