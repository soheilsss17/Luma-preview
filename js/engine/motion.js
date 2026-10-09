// LUMA engine — motion helpers: spring interpolation (plan 12: "Spring Interpolation"), tweens, easing.
export let reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
/** Settings → "حرکت کمتر" (plan 09). ES module live binding: every importer sees the new value. */
export function setReduceMotion(v) { reduceMotion = !!v; }

/** Damped spring toward a target (semi-implicit Euler). Reduce Motion → critically damped, no overshoot. */
export class Spring {
  constructor(value = 0, { stiffness = 170, damping = 16 } = {}) {
    this.value = value; this.target = value; this.v = 0; this.k = stiffness;
    this.c = reduceMotion ? 2 * Math.sqrt(stiffness) : damping;
  }
  set(v) { this.value = this.target = v; this.v = 0; }
  update(dt) {
    const steps = Math.ceil(dt / (1 / 120));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) { this.v += (-this.k * (this.value - this.target) - this.c * this.v) * h; this.value += this.v * h; }
    return this.value;
  }
  get settled() { return Math.abs(this.value - this.target) < 0.5 && Math.abs(this.v) < 2; }
}

export class Spring2 {
  constructor(x, y, opts) { this.x = new Spring(x, opts); this.y = new Spring(y, opts); }
  to(x, y) { this.x.target = x; this.y.target = y; }
  set(x, y) { this.x.set(x); this.y.set(y); }
  update(dt) { this.x.update(dt); this.y.update(dt); }
  get settled() { return this.x.settled && this.y.settled; }
}

export const ease = {
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
};

/** Tiny timeline of timed callbacks/tweens driven by the game loop. */
export class Timeline {
  constructor() { this.items = []; }
  after(sec, fn) { this.items.push({ t: 0, end: sec, fn, done: false }); }
  tween(sec, fn, onEnd) { this.items.push({ t: 0, end: sec, tw: fn, fn: onEnd, done: false }); }
  update(dt) {
    for (const it of this.items) {
      it.t += dt;
      if (it.tw) it.tw(Math.min(1, it.t / it.end));
      if (it.t >= it.end && !it.done) { it.done = true; it.fn && it.fn(); }
    }
    this.items = this.items.filter((i) => !i.done);
  }
  clear() { this.items = []; }
}
