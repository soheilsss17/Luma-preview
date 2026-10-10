// LUMA engine — audio. Music: rendered stems per environment cue (tools/music/compose.py, loadStems/setCue) with the
// synthesised loop below as fallback; SFX are still synthesised with Web Audio (final SFX: plan 14 §10.1 pipeline).
// Adaptive music: layers are switched on one by one ("each correct answer adds a layer", MATH-01 card).
// Scale: a gentle Mahur-like major (C D E F G A B) with a santur-like plucked timbre.

const NOTE = (m) => 440 * Math.pow(2, (m - 69) / 12);

const MUSIC_DIR = 'unity/Assets/_Project/Content/Audio/Music/';   // same files Unity imports
const STEM_LEVEL = 0.8;                                            // rendered stems vs. the old synth loop level

export class LumaAudio {
  constructor() { this.ctx = null; this.layers = 0; this.maxLayers = 4; this.enabled = true; this.musicCue = 'MUS_ENV_VILLAGE'; this.stems = null; }
  /** Must be called from a user gesture (browser autoplay rules). */
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain(); this.master.gain.value = 0.55;
    const comp = this.ctx.createDynamicsCompressor();
    this.master.connect(comp).connect(this.ctx.destination);
    this.musicBus = this.ctx.createGain(); this.musicBus.gain.value = 0.5; this.musicBus.connect(this.master);
    this.sfxBus = this.ctx.createGain(); this.sfxBus.gain.value = this.sfxOn === false ? 0 : 0.9; this.sfxBus.connect(this.master);
    if (!this.enabled) this.musicBus.gain.value = 0;
    this.startMusic();
    this.loadStems(this.musicCue);
  }
  pluck(midi, t, { vel = 0.35, bus = this.sfxBus, dur = 1.6, bright = 1 } = {}) {
    if (!this.ctx) return;
    const c = this.ctx, g = c.createGain(), f = c.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.setValueAtTime(3200 * bright, t); f.frequency.exponentialRampToValueAtTime(700, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    for (const [type, det, lvl] of [['triangle', 0, 1], ['sine', 3, 0.6], ['sine', -4, 0.5]]) {  // santur: doubled courses
      const o = c.createOscillator(), og = c.createGain();
      o.type = type; o.frequency.value = NOTE(midi); o.detune.value = det; og.gain.value = lvl;
      o.connect(og).connect(f); o.start(t); o.stop(t + dur + 0.05);
    }
    f.connect(g).connect(bus);
  }
  drum(t, { vel = 0.25, low = true } = {}) {       // soft daf-like pulse: filtered noise burst
    if (!this.ctx) return;
    const c = this.ctx, len = 0.18, buf = c.createBuffer(1, c.sampleRate * len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = buf; f.type = 'bandpass'; f.frequency.value = low ? 140 : 900; f.Q.value = 1.2; g.gain.value = vel;
    s.connect(f).connect(g).connect(this.musicBus); s.start(t);
  }
  // --- SFX (plan 12: warm village chime, 3-note ascending LUMA motif, soft flicker, snap) ---
  snap() { if (this.ctx) this.pluck(55, this.ctx.currentTime, { vel: 0.18, dur: 0.25, bright: 0.4 }); }
  chime() { if (!this.ctx) return; const t = this.ctx.currentTime; this.pluck(79, t, { vel: 0.3 }); this.pluck(84, t + 0.07, { vel: 0.22 }); }
  flicker() { if (!this.ctx) return; const t = this.ctx.currentTime; for (let i = 0; i < 3; i++) this.pluck(62 - i, t + i * 0.12, { vel: 0.08, dur: 0.18, bright: 0.3 }); }
  motif() { if (!this.ctx) return; const t = this.ctx.currentTime + 0.05; [72, 76, 79].forEach((m, i) => this.pluck(m, t + i * 0.22, { vel: 0.4, dur: 2.2 })); this.pluck(84, t + 0.66, { vel: 0.3, dur: 3 }); }
  pickup() { if (this.ctx) this.pluck(67, this.ctx.currentTime, { vel: 0.1, dur: 0.3 }); }
  hint() { if (!this.ctx) return; const t = this.ctx.currentTime; this.pluck(88, t, { vel: 0.12, dur: 1 }); this.pluck(91, t + 0.1, { vel: 0.1, dur: 1 }); }
  // MATH-02 festival stall (placeholders for SFX_FRUIT_PICK, SFX_BASKET_DROP, SFX_GROUP_SNAP, SFX_COUNT_TICK, SFX_GROUP_SUCCESS)
  tick(step = 0) { if (this.ctx) this.pluck(76 + Math.min(12, step), this.ctx.currentTime, { vel: 0.07, dur: 0.12, bright: 0.7 }); }
  thump() { if (!this.ctx) return; const t = this.ctx.currentTime; this.drum(t, { vel: 0.16 }); this.pluck(45, t, { vel: 0.06, dur: 0.15, bright: 0.2 }); }
  woodClick() { if (!this.ctx) return; const t = this.ctx.currentTime; this.drum(t, { vel: 0.1, low: false }); this.pluck(69, t, { vel: 0.09, dur: 0.1, bright: 0.5 }); }
  bell() { if (!this.ctx) return; const t = this.ctx.currentTime; [84, 91, 96].forEach((m, i) => this.pluck(m, t + i * 0.015, { vel: 0.22 - i * 0.05, dur: 2.6, bright: 1.2 })); }
  // workshop / tutorial (placeholders for SFX_GEAR_*, SFX_WIND_KEY, SFX_DOOR_OPEN in the AV register)
  windClick() { if (!this.ctx) return; const t = this.ctx.currentTime; this.drum(t, { vel: 0.12, low: false }); this.pluck(50, t, { vel: 0.08, dur: 0.12, bright: 0.25 }); }
  wake() { if (!this.ctx) return; const t = this.ctx.currentTime; [60, 64, 67, 72].forEach((m, i) => this.pluck(m, t + i * 0.09, { vel: 0.18, dur: 1.2 })); }
  clunk() { if (!this.ctx) return; const t = this.ctx.currentTime; this.drum(t, { vel: 0.35 }); this.pluck(40, t, { vel: 0.12, dur: 0.35, bright: 0.2 }); this.pluck(41, t + 0.09, { vel: 0.08, dur: 0.3, bright: 0.2 }); }
  // soft_clock_tick (SOC-01 mantel clock): a quiet wooden tick / lower tock
  clockTick(tock = false) { if (!this.ctx) return; const t = this.ctx.currentTime; this.drum(t, { vel: 0.04, low: false }); this.pluck(tock ? 79 : 86, t, { vel: 0.035, dur: 0.06, bright: 0.9 }); }
  gearTick() { if (this.ctx) this.pluck(74, this.ctx.currentTime, { vel: 0.035, dur: 0.08, bright: 0.5 }); }
  tumbler() { if (!this.ctx) return; const t = this.ctx.currentTime; this.drum(t, { vel: 0.15, low: false }); this.pluck(72, t + 0.05, { vel: 0.25, dur: 1.4 }); this.pluck(79, t + 0.12, { vel: 0.18, dur: 1.6 }); }
  door() { if (!this.ctx) return; const t = this.ctx.currentTime; for (let i = 0; i < 5; i++) this.pluck(55 + i * 2, t + i * 0.07, { vel: 0.06, dur: 0.5, bright: 0.3 }); }
  dusk() { if (!this.ctx) return; const t = this.ctx.currentTime; this.pluck(57, t, { vel: 0.14, dur: 2.5, bright: 0.4 }); this.pluck(60, t + 0.5, { vel: 0.12, dur: 2.8, bright: 0.4 }); }
  /** Settings toggles (persisted by the menu in luma.settings). */
  // MATH-05 (card v1.1 §18: «ceramic click, soft garden chime»; ghost_appear)
  ceramic() { if (!this.ctx) return; const t = this.ctx.currentTime; this.drum(t, { vel: 0.07, low: false }); this.pluck(93, t, { vel: 0.16, dur: 0.22, bright: 1.4 }); this.pluck(100, t + 0.02, { vel: 0.07, dur: 0.15, bright: 1.4 }); }
  gardenChime(step = 0) { if (!this.ctx) return; const t = this.ctx.currentTime, pent = [72, 74, 76, 79, 81, 84, 86]; const m = pent[step % pent.length]; this.pluck(m, t, { vel: 0.16, dur: 1.8 }); this.pluck(m + 12, t + 0.05, { vel: 0.06, dur: 1.4 }); }
  shimmer() { if (!this.ctx) return; const t = this.ctx.currentTime; [88, 91, 95].forEach((m, i) => this.pluck(m, t + i * 0.06, { vel: 0.05, dur: 0.9, bright: 0.6 })); }
  /** Filtered noise burst (water, paper, leaves): band centre f Hz, `len` s, envelope power `pow`. */
  noise(t, { f = 1200, q = 0.8, len = 0.3, vel = 0.1, pow = 2, type = 'bandpass', sweep = 0 } = {}) {
    if (!this.ctx) return;
    const c = this.ctx, buf = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * len)), c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, pow);
    const s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
    s.buffer = buf; fl.type = type; fl.frequency.value = f; fl.Q.value = q; g.gain.value = vel;
    if (sweep && fl.frequency.linearRampToValueAtTime) { fl.frequency.setValueAtTime(f, t); fl.frequency.linearRampToValueAtTime(f + sweep, t + len); }
    s.connect(fl).connect(g).connect(this.sfxBus); s.start(t);
  }
  /** Paper: a card or a paper-faced plaque is lifted (card sound paper_pickup: two short bright noise swishes). */
  paper() {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    this.noise(t, { f: 3000, q: 0.7, len: 0.12, vel: 0.08, sweep: 1600 }); this.noise(t + 0.07, { f: 2200, q: 0.9, len: 0.09, vel: 0.05, sweep: -600 });
  }
  /** Stamp: brass head presses onto wood (thud + spring ring). */
  stamp() {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    this.drum(t, { vel: 0.3 }); this.pluck(43, t, { vel: 0.2, dur: 0.3, bright: 0.3 }); this.pluck(91, t + 0.05, { vel: 0.05, dur: 0.5 });
  }
  /** Water: a bucket dips into the well (plop + splash tail + two drips). */
  splash() {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    this.pluck(50, t, { vel: 0.1, dur: 0.18, bright: 0.2 });
    this.noise(t + 0.02, { f: 900, q: 0.7, len: 0.45, vel: 0.16, pow: 2.5, sweep: 1400 });
    this.pluck(86, t + 0.32, { vel: 0.05, dur: 0.12, bright: 1.2 }); this.pluck(89, t + 0.5, { vel: 0.04, dur: 0.1, bright: 1.2 });
  }
  /** Pages of a book riffle (library reacts). */
  pageFlutter() {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    for (let i = 0; i < 6; i++) this.noise(t + i * 0.055, { f: 2600 + i * 180, q: 1.4, len: 0.07, vel: 0.07, pow: 1.5 });
  }
  /** Leaves / fruit in a basket rustle (market reacts). */
  rustle() {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    for (let i = 0; i < 4; i++) this.noise(t + i * 0.07, { f: 1500 + i * 300, q: 0.9, len: 0.12, vel: 0.06, pow: 2 });
    this.woodClick();
  }
  /** Q01 payoff: one santur note per lantern as it lights (Mahur scale, rising). */
  lanternNote(i = 0) {
    if (!this.ctx) return; const t = this.ctx.currentTime, sc = [72, 74, 76, 77, 79, 81, 83, 84, 86, 88];
    this.pluck(sc[i % sc.length], t, { vel: 0.16, dur: 1.4 }); this.pluck(sc[i % sc.length] - 12, t + 0.02, { vel: 0.06, dur: 1.2, bright: 0.6 });
  }
  /**
   * Q01 payoff: the santur enters (plan 12). A short festive phrase in Mahur with the santur's typical tremolo
   * (fast repeated strikes on long notes) over a soft daf. ~7.5 s; placeholder until the Suno score (plan 14 §10.1).
   */
  santurTheme() {
    if (!this.ctx) return; const t0 = this.ctx.currentTime + 0.05, beat = 60 / 104;
    const tune = [[72, 1], [74, 0.5], [76, 0.5], [79, 1], [76, 1], [77, 0.5], [76, 0.5], [74, 1], [72, 1],
      [74, 0.5], [76, 0.5], [77, 1], [79, 1], [81, 0.5], [79, 0.5], [76, 1], [72, 2]];
    let t = t0;
    for (const [m, d] of tune) {
      const dur = d * beat;
      if (d >= 1) for (let k = 0; k < Math.round(d * 4); k++) this.pluck(m, t + k * beat / 4, { vel: k ? 0.07 : 0.15, dur: 0.5 });   // tremolo
      else this.pluck(m, t, { vel: 0.13, dur: 0.9 });
      t += dur;
    }
    for (let b = 0; b < Math.round((t - t0) / beat); b++) this.drum(t0 + b * beat, { vel: b % 4 === 0 ? 0.2 : 0.08, low: b % 2 === 0 });
    for (const [m, at] of [[48, 0], [43, 4], [45, 8], [48, 12]]) this.pluck(m, t0 + at * beat, { vel: 0.1, dur: 4 * beat, bright: 0.4 });
    return t - t0;
  }
  /**
   * Optional read-aloud (Persian card contract: audio helps, never replaces reading). Fetches + decodes once, caches,
   * stops the previous clip, ducks the music while the voice speaks. Returns a promise resolving to the duration (s)
   * or 0 when audio is not available. `onEnd` fires when the clip finishes.
   */
  async voice(url, onEnd = null) {
    if (!this.ctx || !url) return 0;
    this.voCache = this.voCache || new Map();
    let buf = this.voCache.get(url);
    try {
      if (!buf) {
        const r = await fetch(url); if (!r.ok) return 0;
        buf = await this.ctx.decodeAudioData(await r.arrayBuffer()); this.voCache.set(url, buf);
      }
    } catch (e) { return 0; }
    this.stopVoice();
    if (!this.voBus) { this.voBus = this.ctx.createGain(); this.voBus.gain.value = 1; this.voBus.connect(this.master); }
    const s = this.ctx.createBufferSource(); s.buffer = buf; s.connect(this.voBus);
    if (this.musicBus && this.enabled) this.musicBus.gain.value = 0.18;               // duck
    s.onended = () => { if (this.vo === s) { this.vo = null; if (this.musicBus && this.enabled) this.musicBus.gain.value = 0.5; } if (onEnd) onEnd(); };
    s.start(); this.vo = s;
    return buf.duration || 0;
  }
  stopVoice() { if (this.vo) { const s = this.vo; this.vo = null; try { s.stop(); } catch (e) { /* already stopped */ } if (this.musicBus && this.enabled) this.musicBus.gain.value = 0.5; } }
  setMusic(on) { this.enabled = !!on; if (this.musicBus) this.musicBus.gain.value = on ? 0.5 : 0; }
  setSfx(on) { this.sfxOn = !!on; if (this.sfxBus) this.sfxBus.gain.value = on ? 0.9 : 0; }
  setLayers(n) {
    this.layers = Math.max(0, Math.min(this.maxLayers, n));
    if (this.stems && this.ctx) for (const st of this.stems) st.gain.gain.setTargetAtTime(this.layers >= st.layer ? 1 : 0, this.ctx.currentTime, 0.6);   // ~2 s fade
  }
  /** Switch the environment cue (menu / workshop / village…): old stems fade out, the new cue's stems load. */
  setCue(id) {
    if (!id || id === this.musicCue) return;
    this.musicCue = id;
    if (this.stems && this.ctx) {
      const t = this.ctx.currentTime;
      for (const st of this.stems) { st.gain.gain.setTargetAtTime(0, t, 0.3); try { st.src.stop(t + 1.6); } catch (e) { /* already stopped */ } }
    }
    this.stems = null;
    if (this.ctx) this.loadStems(id);
  }
  /**
   * Rendered music (tools/music/compose.py): <cue>.music.json + one looping OGG per stem, all started on the same
   * sample so they stay locked; each stem is audible from its game layer on (spec "adaptive": BASE at quest start,
   * RHYTHM after MATH-01, MELODY after MATH-02, FESTIVAL after the Q01 finale). Falls back to the procedural loop
   * below when the files cannot be fetched (file://, unit tests). Resolves true when the stems are playing.
   */
  async loadStems(id) {
    if (!this.ctx || !id || this.stems || this._stemsLoading || typeof fetch !== 'function') return false;
    this._stemsLoading = true;
    try {
      const r = await fetch(`${MUSIC_DIR}${id}.music.json`); if (!r.ok) return false;
      const meta = await r.json(), names = Object.keys(meta.layer_for_stem);
      const bufs = await Promise.all(names.map(async (n) => {
        const rr = await fetch(MUSIC_DIR + meta.stems[n]); if (!rr.ok) throw new Error(`stem ${n}`);
        return this.ctx.decodeAudioData(await rr.arrayBuffer());
      }));
      if (this.musicCue !== id) return false;
      if (!this.stemBus) { this.stemBus = this.ctx.createGain(); this.stemBus.gain.value = STEM_LEVEL; this.stemBus.connect(this.musicBus); }
      const t = this.ctx.currentTime + 0.05;
      this.stems = names.map((n, i) => {
        const g = this.ctx.createGain(); g.gain.value = this.layers >= meta.layer_for_stem[n] ? 1 : 0; g.connect(this.stemBus);
        const src = this.ctx.createBufferSource(); src.buffer = bufs[i]; src.loop = true;
        src.loopStart = meta.loop_start; src.loopEnd = meta.loop_end; src.connect(g); src.start(t);
        return { name: n, layer: meta.layer_for_stem[n], gain: g, src };
      });
      this.stemMeta = meta;
      return true;
    } catch (e) { this.stems = null; return false; } finally {
      this._stemsLoading = false;
      if (this.musicCue !== id && this.ctx && !this.stems) this.loadStems(this.musicCue);   // the cue changed while loading
    }
  }
  // --- adaptive music loop (look-ahead scheduler) ---
  startMusic() {
    const c = this.ctx, bpm = 84, beat = 60 / bpm;
    const bass = [48, 48, 43, 45], arp = [60, 64, 67, 72, 67, 64, 62, 67], mel = [76, 74, 72, 74, 76, 79, 76, 74];
    let next = c.currentTime + 0.1, step = 0;
    const tick = () => {
      while (next < c.currentTime + 0.25) {
        const bar = Math.floor(step / 8) % 4, s = step % 8;
        if (this.enabled && !this.stems) {
          if (s === 0) this.pluck(bass[bar] - 12, next, { vel: 0.16, bus: this.musicBus, dur: 3.2, bright: 0.35 });   // layer 0: drone
          if (this.layers >= 1 && (s === 0 || s === 5)) this.drum(next, { vel: 0.22 });                             // layer 1: pulse
          if (this.layers >= 1 && s === 3) this.drum(next, { vel: 0.08, low: false });
          if (this.layers >= 2) this.pluck(arp[s] + (bar === 2 ? -5 : bar === 3 ? -3 : 0), next, { vel: 0.07, bus: this.musicBus, dur: 1.1 }); // layer 2: santur arpeggio
          if (this.layers >= 3 && s % 2 === 0) this.pluck(mel[(s + bar * 2) % 8], next, { vel: 0.1, bus: this.musicBus, dur: 1.8 });       // layer 3: melody
          if (this.layers >= 4 && s === 4) this.pluck(84 + (bar % 2) * 2, next, { vel: 0.06, bus: this.musicBus, dur: 2.5 });              // layer 4: festival sparkle
        }
        next += beat / 2; step++;
      }
      this._timer = setTimeout(tick, 60);
    };
    tick();
  }
}
