// LUMA engine — cut-out rig actor (same math as tools/rig/animate.py and Unity LumaCutoutRig.cs).
// world = parentWorld · T(attach − parentPivot + d) · R(rot, CCW+); draw = world · S(scale) · T(−pivot)
import { loadImage } from './assets.js';

const RIG_BASE = 'art/rig/';

export class RigActor {
  /** cfg: {id, scale, x, groundY, face?, follow?, gap?} */
  constructor(cfg) {
    Object.assign(this, { face: 1, rate: 1, targetX: null, onArrive: null, intensity: 1, gait: 'walk' }, cfg);
    this.imgs = {}; this.clips = {};
  }
  async load() {
    try {
    const dir = RIG_BASE + this.id + '/';
    this.rig = await (await fetch(dir + this.id + '.rig.json')).json();
    await Promise.all([...this.rig.bones.map((b) => b.image), ...this.rig.swaps.map((s) => s.image)]
      .map(async (p) => { this.imgs[p] = await loadImage(dir + p); }));
    this.clipNames = this.rig.clips && this.rig.clips.length ? this.rig.clips : ['idle', 'walk', 'happy', 'think', 'point'];
    await Promise.all(this.clipNames.map(async (n) => {
      const c = await (await fetch(dir + 'clips/' + n + '.clip.json')).json();
      c.trackMap = {}; for (const t of c.tracks) c.trackMap[t.bone] = t;
      c.swapMap = {}; for (const s of c.swaps) c.swapMap[s.bone] = s.keys;
      this.clips[n] = c;
    }));
    this.bones = {}; for (const b of this.rig.bones) this.bones[b.name] = b;
    this.order = [...this.rig.bones].sort((a, b) => a.z - b.z);
    this.play('idle');
    return this;
    } catch(e) { console.warn('Rig fallback:', this.id, e.message); return this._fallbackLoad(); }
  }

  /** Simple single-bone fallback when rig files are missing. */
  async _fallbackLoad() {
    const SPRITES = { NEO: 'merchant_front', TIKO: 'kid_curly_happy' };
    const sp = SPRITES[this.id] || 'merchant_front';
    const img = await loadImage('assets/' + sp + '.png');
    this.rig = { bones: [{ name: 'body', image: sp + '.png', pivot: [img.width/2, img.height], attach: [0, 0], z: 0, rest_deg: 0, parent: null, scale: 1 }], swaps: [], height_px: img.height, foot_y: img.height };
    this.imgs = { [sp + '.png']: img };
    this.clipNames = ['idle', 'walk', 'happy'];
    this.clips = {};
    for (const n of this.clipNames) {
      this.clips[n] = { fps: 8, frames: 1, loop: n === 'idle' || n === 'walk', root: { x: [0], y: [0] }, tracks: [], swaps: [], root_motion_px_per_s: n === 'walk' ? 180 : 0 };
    }
    this.bones = {}; for (const b of this.rig.bones) this.bones[b.name] = b;
    this.order = [...this.rig.bones].sort((a, b) => a.z - b.z);
    this.play('idle');
    return this;
    } catch(e) { console.warn('Rig fallback:', this.id, e.message); return this._fallbackLoad(); }
  }

  has(clip) { return !!this.clips[clip]; }
  play(name, next = null) {
    if (!this.clips[name]) return;
    this.clip = name; this.frame = 0; this.acc = 0; this.queue = next;
  }
  /** Move to x with a locomotion clip ('walk' default, 'run' if the rig has it). Speed = that clip's
   *  root_motion_px_per_s (solved from the planted foot by tools/rig/animate.py, so feet never skate). */
  walkTo(x, onArrive = null, gait = 'walk') {
    this.targetX = x; this.onArrive = onArrive;
    this.gait = this.has(gait) ? gait : 'walk';
    if (Math.abs(x - this.x) < 4) { this.targetX = null; onArrive && onArrive(); return; }
    if (this.clip !== this.gait) this.play(this.gait);
  }
  runTo(x, onArrive = null) { this.walkTo(x, onArrive, 'run'); }
  faceTowards(x) { if (Math.abs(x - this.x) > 8) this.face = Math.sign(x - this.x); }
  get heightPx() { return this.rig.height_px * this.scale; }
  update(dt) {
    const c = this.clips[this.clip];
    this.acc += dt * c.fps * this.rate;
    while (this.acc >= 1) {
      this.acc -= 1; this.frame++;
      if (this.frame >= c.frames) { if (c.loop) this.frame = 0; else { this.play(this.queue || 'idle'); break; } }
    }
    // a one-shot clip (happy, point…) played during a walk pauses it; back at idle the walk resumes instead of freezing
    if (this.targetX != null && this.clip === 'idle') this.play(this.gait || 'walk');
    if ((this.clip === 'walk' || this.clip === this.gait) && this.targetX !== null) {
      const dir = Math.sign(this.targetX - this.x); if (dir) this.face = dir;
      const step = Math.abs(this.clips[this.clip].root_motion_px_per_s) * this.scale * dt * this.rate;
      if (Math.abs(this.targetX - this.x) <= step) {
        this.x = this.targetX; this.targetX = null; this.play('idle');
        const cb = this.onArrive; this.onArrive = null; cb && cb();
      } else this.x += dir * step;
    }
  }
  worlds(clip, f, k) {
    const W = {}, bones = this.bones;
    const val = (tr, key) => (tr && tr[key] ? tr[key][f] * k : 0);
    const w = (n) => {
      if (W[n]) return W[n];
      const b = bones[n], tr = clip.trackMap[n];
      const rot = b.rest_deg + val(tr, 'rot');
      let m;
      if (!b.parent) m = new DOMMatrix().translate(clip.root.x[f] * k + val(tr, 'x'), -clip.root.y[f] * k - val(tr, 'y'));
      else {
        // The attach point is measured in the parent's own pixels while the parent's ART is drawn scaled by
        // bones[parent].scale, so the offset has to be scaled with it — otherwise a scaled parent (MIRA's arm chain,
        // 0.5) throws its children out by 1/scale. Matches tools/rig/animate.py pose(), the preview player and Unity.
        const pp = bones[b.parent].pivot, pk = bones[b.parent].scale || 1;
        m = w(b.parent).translate((b.attach[0] - pp[0]) * pk + val(tr, 'x'), (b.attach[1] - pp[1]) * pk - val(tr, 'y'));
      }
      return (W[n] = m.rotate(-rot));
    };
    for (const n in bones) w(n);
    return W;
  }
  /** Head position in screen space (LUMI floats near it). */
  headPoint() { return { x: this.x + this.face * this.heightPx * 0.05, y: this.groundY - this.heightPx * 1.02 }; }
  hit(x, y) {
    return Math.abs(x - this.x) < this.heightPx * 0.32 && y > this.groundY - this.heightPx && y < this.groundY + 20;
  }
  draw(ctx) {
    const clip = this.clips[this.clip], f = this.frame, k = this.intensity;
    const W = this.worlds(clip, f, k);
    const lift = this.lift || 0;                            // hop height (MATH-02 trail hops); the shadow stays down
    const S = new DOMMatrix().translate(this.x, this.groundY - lift - this.rig.foot_y * this.scale).scale(this.scale * this.face, this.scale);
    ctx.save();
    const base = ctx.getTransform();                        // keeps the caller's letterbox / camera transform
    ctx.fillStyle = 'rgba(40,25,10,0.28)';                  // soft contact shadow (engine-drawn, plan 14 §2)
    const sh = 1 / (1 + lift / 120);
    ctx.beginPath(); ctx.ellipse(this.x, this.groundY + 4, this.heightPx * 0.2 * sh, Math.max(6, this.heightPx * 0.03) * sh, 0, 0, Math.PI * 2); ctx.fill();
    for (const b of this.order) {
      let path = b.image, pv = b.pivot;
      const sw = clip.swapMap[b.name];
      if (sw && sw[f]) { const d = this.rig.swaps.find((x) => x.bone === b.name && x.key === sw[f]); path = d.image; pv = d.pivot; }
      const sc = b.scale || 1;
      const m = base.multiply(S).multiply(W[b.name]).scale(sc, sc).translate(-pv[0], -pv[1]);
      ctx.setTransform(m);
      ctx.drawImage(this.imgs[path], 0, 0);
    }
    ctx.restore();
  }
}
