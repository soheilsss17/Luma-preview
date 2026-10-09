// LUMA engine — in-world HUD buttons with art states (BASE / available pulse / pressed / disabled; plan 09).
// Sprites: <id>, <id>_pulse, <id>_pressed, <id>_disabled (derived from BASE by tools/derive_states.py, pixel-aligned).
export const PRESS_S = 0.18;

/** state: {disabled, available, pressed(seconds left), t(scene time)}; falls back to alpha when a state sprite is missing. */
export function drawHudButton(ctx, sprites, id, b, r, state) {
  const pick = (suffix) => sprites.get(id + suffix);
  let img = sprites.get(id), alpha = 1, sc = 1;
  if (state.disabled) { const d = pick('_disabled'); if (d) { img = d; alpha = 0.9; } else alpha = 0.35; }
  else if (state.pressed > 0) { img = pick('_pressed') || img; }
  else if (state.available) { img = pick('_pulse') || img; sc = 1 + 0.07 * Math.sin(state.t * 6); }
  if (!img) return;
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.drawImage(img, b.x - r * 1.1 * sc, b.y - r * 1.1 * sc, r * 2.2 * sc, r * 2.2 * sc);
  ctx.restore();
}

/** Wordless «way on»: warm glow + three chevrons pointing right (same look as the plaza/stall exits). */
export function drawExitArrow(ctx, { x, y, r }, t, still = false) {
  const k = 0.5 + 0.5 * Math.sin(t * 2.4);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y, 8, x, y, r * 1.6);
  g.addColorStop(0, `rgba(255,200,100,${0.6 + 0.3 * k})`); g.addColorStop(1, 'rgba(255,214,130,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 1.6, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let i = 0; i < 3; i++) {
    const a = Math.max(0, Math.sin(t * 3 - i * 0.9)), cx = x - 34 + i * 30 + (still ? 0 : 6 * k);
    const path = () => { ctx.beginPath(); ctx.moveTo(cx - 14, y - 30); ctx.lineTo(cx + 14, y); ctx.lineTo(cx - 14, y + 30); };
    ctx.lineWidth = 18; ctx.strokeStyle = `rgba(70,40,15,${0.35 + 0.35 * a})`; path(); ctx.stroke();
    ctx.lineWidth = 10; ctx.strokeStyle = `rgba(255,236,180,${0.55 + 0.45 * a})`; path(); ctx.stroke();
  }
  ctx.restore();
}
