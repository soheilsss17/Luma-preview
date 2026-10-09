// LUMA engine — asset loading with a manifest (web/assets/manifest.json, built by tools/build_web_assets.py).
const cache = new Map();

export function loadImage(src) {
  if (cache.has(src)) return cache.get(src);
  const p = new Promise((ok, err) => {
    const i = new Image();
    i.onload = () => ok(i);
    i.onerror = () => err(new Error('image failed: ' + src));
    i.src = src + (src.includes("?") ? "&" : "?") + "_v=" + Date.now();
  });
  cache.set(src, p);
  return p;
}

export async function loadJSON(src) {
  const bust = src + (src.includes("?") ? "&" : "?") + "_v=" + Date.now();
  const r = await fetch(bust, { cache: "no-store" });
  if (!r.ok) { const body = await r.text().catch(()=>""); throw new Error("json failed: " + src + " status=" + r.status + " ct=" + (r.headers.get("content-type")||"") + " body=" + body.slice(0,120)); }
  return r.json();
}

/** Sprite bank: resolves sprite ids through the manifest; `fallback` ids cover assets not produced yet. */
export class SpriteBank {
  async load(manifestUrl) {
    this.base = manifestUrl.replace(/[^/]+$/, '');
    this.m = await loadJSON(manifestUrl);
    this.img = {};
    await Promise.all(Object.entries(this.m).filter(([k]) => !k.startsWith('_'))
      .map(async ([k, v]) => { this.img[k] = await loadImage(this.base + v.file.replace(/^assets\//, '')); }));
    return this;
  }
  has(id) { return !!this.img[id]; }
  get(id, fallback) { return this.img[id] || (fallback ? this.img[fallback] : null); }
  info(id, fallback) { return this.m[id] || (fallback ? this.m[fallback] : null); }
  /** true when `id` is served by its fallback (shown in the debug overlay as a placeholder). */
  isPlaceholder(id, fallback) { return !this.img[id] && !!fallback && !!this.img[fallback]; }
}
