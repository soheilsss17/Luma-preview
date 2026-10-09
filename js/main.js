// LUMA web prototype — boot, fixed 1920×1080 logical canvas with letterboxing, game loop, input, debug overlay.
import { SpriteBank, loadJSON } from './engine/assets.js';
import { LumaAudio } from './engine/audio.js';
import { PlazaMath01, W, H } from './scenes/plaza_math01.js';
import { WorkshopTutorial } from './scenes/workshop_tutorial.js';
import { StallMath02 } from './scenes/stall_math02.js';
import { GardenMath05 } from './scenes/garden_math05.js';
import { SignsP01 } from './scenes/signs_p01.js';
import { IntroBoardW01 } from './scenes/intro_board_w01.js';
import { StoryBoardP13 } from './scenes/story_board_p13.js';
import { TimelineSOC01 } from './scenes/timeline_soc01.js';
import { PayoffQ01 } from './scenes/payoff_q01.js';
import { MachineMath03 } from './scenes/machine_math03.js';
import { StorageMath06 } from './scenes/storage_math06.js';
import { GearMath07 } from './scenes/gear_math07.js';
import { MarketMath08 } from './scenes/market_math08.js';
import { SciLabSci01 } from './scenes/sci_lab_sci01.js';
import { WorkshopMeasureSci03 } from './scenes/workshop_measure_sci03.js';
import { QuranReading01 } from './scenes/quran_reading_01.js';
import { WorldMap } from './scenes/world_map.js';
import { payoffReady, payoffSeen, mapUnlocked } from './edu/world_map_rules.js';
import { TitleMenu, loadSettings, applySettings } from './scenes/title_menu.js';
import { Strings } from './engine/strings.js';
import { SaveSlot } from './edu/engines.js';

const params = new URLSearchParams(location.search);
const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
const debugEl = document.getElementById('debug');
const events = [];
let showDebug = params.has('debug');

if (params.has('reset')) {                       // ?reset → wipe save, mastery and analytics (testing)
  for (const k of Object.keys(localStorage)) if (k.startsWith('luma.')) localStorage.removeItem(k);
}

function fit() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.round(innerWidth * dpr); cv.height = Math.round(innerHeight * dpr);
  cv.style.width = innerWidth + 'px'; cv.style.height = innerHeight + 'px';
  const s = Math.min(cv.width / W, cv.height / H);
  view.s = s; view.ox = (cv.width - W * s) / 2; view.oy = (cv.height - H * s) / 2; view.dpr = dpr;
}
const view = { s: 1, ox: 0, oy: 0, dpr: 1 };
function toLogical(ev) {
  const r = cv.getBoundingClientRect();
  const px = (ev.clientX - r.left) * view.dpr, py = (ev.clientY - r.top) * view.dpr;
  return [(px - view.ox) / view.s, (py - view.oy) / view.s];
}

// Scene flow (plan 05 act I): main menu → opening «کوک» in the workshop (first time) → VIL_PLAZA / MATH-01 → (glowing exit) VIL_PLAZA_STALL / MATH-02
// → (glowing exit) VIL_GARDEN_EDGE / MATH-05 → (glowing exit) VIL_SIGN_AREA / P-01 → (glowing exit) the intro board in the same square / W-01 → (glowing exit) the festival story board in VIL_PLAZA / P-13 → (glowing exit) Amir's house VIL_HOUSE / SOC-01 (life timeline) → Q01 payoff «the festival starts» (once; plan 05 §4.1) → NEO's world map (fast travel). ?room=menu|workshop|plaza|stall (alias math02)|garden (alias math05)|signs (alias p01)|board (alias w01)|p13|soc01|payoff|map jumps straight to a room (testing); ?skipmenu starts the next room directly.
let scene = null;
async function boot() {
  const [sprites, math01, gears, table, math02, math05, p01, w01, p13, soc01, world, math03, math06, math07, math08, sci01, sci03, quran01] = await Promise.all([
    new SpriteBank().load('assets/manifest.json'),
    loadJSON('unity/Assets/_Project/Content/Puzzles/MATH-01.puzzle.json'),
    loadJSON('unity/Assets/_Project/Content/Puzzles/GEAR_TUTORIAL.puzzle.json'),
    loadJSON('unity/Assets/_Project/Content/Localization/strings.fa.json'),
    loadJSON('unity/Assets/_Project/Content/Puzzles/MATH-02.puzzle.json'),
    loadJSON('unity/Assets/_Project/Content/Puzzles/MATH-05.puzzle.json'),
    loadJSON('unity/Assets/_Project/Content/Puzzles/P-01.puzzle.json'),
    loadJSON('unity/Assets/_Project/Content/Puzzles/W-01.puzzle.json'),
    loadJSON('unity/Assets/_Project/Content/Puzzles/P-13.puzzle.json'),
    loadJSON('unity/Assets/_Project/Content/Puzzles/SOC-01.puzzle.json'),
    loadJSON('unity/Assets/_Project/Content/World/WORLD_MAP.json'),
    loadJSON('unity/Assets/_Project/Content/Puzzles/MATH-03.puzzle.json'),
    loadJSON('unity/Assets/_Project/Content/Puzzles/MATH-06.puzzle.json'),
    loadJSON('unity/Assets/_Project/Content/Puzzles/MATH-07.puzzle.json'),
    loadJSON('unity/Assets/_Project/Content/Puzzles/MATH-08.puzzle.json'),
    loadJSON('unity/Assets/_Project/Content/Puzzles/SCI-01.puzzle.json'),
    loadJSON('unity/Assets/_Project/Content/Puzzles/SCI-03.puzzle.json'),
    loadJSON('unity/Assets/_Project/Content/Puzzles/QURAN-01.puzzle.json'),
    document.fonts ? Promise.all(['500 32px LumaFa', '700 32px LumaFa', '800 32px LumaFa'].map((f) => document.fonts.load(f))) : null,
  ]);
  const strings = new Strings(table);
  document.getElementById('loading').textContent = strings.t('game.loading');
  const audio = new LumaAudio();
  audio.maxLayers = math01.music_layers_max;
  const common = { sprites, audio, storage: localStorage, debug: events, strings };
  // where «play» continues: workshop → plaza (MATH-01) → fruit stall (MATH-02) → garden edge (MATH-05) → crossroads signs (P-01) → intro board (W-01) → festival story board (P-13) → Amir's house (SOC-01)
  const next = () => {
    const s = new SaveSlot(localStorage);
    const f = (id) => s.flag(id);
    if (!s.flag(gears.world_state_on_solve)) return 'workshop';
    if (mapUnlocked(world, f)) return 'map';                                   // after the festival: «play» opens NEO's map
    if (payoffReady(world, 'Q01', f) && !payoffSeen(world, 'Q01', f)) return 'payoff';
    if (s.flag(p13.world_state_on_solve)) return 'soc01';
    if (s.flag(w01.world_state_on_solve)) return 'p13';
    if (s.flag(p01.world_state_on_solve)) return 'board';
    if (s.flag(math05.world_state_on_solve)) return 'signs';
    if (s.flag(math02.world_state_on_solve)) return 'garden';
    return s.flag(math01.world_state_on_solve) ? 'stall' : 'plaza';
  };
  // leaving Amir's house: the festival payoff once every Q01 card is done (a replay of SOC-01 goes back to the map)
  const afterSoc01 = () => { const s = new SaveSlot(localStorage), f = (id) => s.flag(id); return payoffReady(world, 'Q01', f) && !payoffSeen(world, 'Q01', f) ? 'payoff' : mapUnlocked(world, f) ? 'map' : 'menu'; };
  // after the festival every room returns to NEO's map (fast travel replays); before it, the story chain continues
  const onward = (room) => () => { const s = new SaveSlot(localStorage); go(mapUnlocked(world, (id) => s.flag(id)) ? 'map' : room); };
  const go = async (room) => {
    audio.setCue(room === 'menu' ? 'MUS_MAIN_THEME' : (room === 'workshop' || room === 'machine' || room === 'math03' || room === 'storage' || room === 'math06' || room === 'gear' || room === 'math07' || room === 'scilab' || room === 'sci01' || room === 'wsmeasure' || room === 'sci03') ? 'MUS_ENV_WORKSHOP' : 'MUS_ENV_VILLAGE');   // plan 08: one cue per environment
    if (room === 'menu') scene = await new TitleMenu({ ...common, onPlay: () => go(next()) }).load();
    else if (room === 'workshop') scene = await new WorkshopTutorial({ ...common, puzzle: gears, onExit: onward('plaza') }).load();
    else if (room === 'stall' || room === 'math02') scene = await new StallMath02({ ...common, puzzle: math02, onExit: onward('garden') }).load();
    else if (room === 'garden' || room === 'math05') scene = await new GardenMath05({ ...common, puzzle: math05, onExit: onward('signs') }).load();
    else if (room === 'signs' || room === 'p01') scene = await new SignsP01({ ...common, puzzle: p01, onExit: onward('board') }).load();
    else if (room === 'board' || room === 'w01') scene = await new IntroBoardW01({ ...common, puzzle: w01, backdrop: p01, onExit: onward('p13') }).load();
    else if (room === 'p13' || room === 'story') scene = await new StoryBoardP13({ ...common, puzzle: p13, onExit: onward('soc01') }).load();
    else if (room === 'soc01' || room === 'house') scene = await new TimelineSOC01({ ...common, puzzle: soc01, onExit: () => go(afterSoc01()) }).load();
    else if (room === 'payoff' || room === 'festival') scene = await new PayoffQ01({ ...common, world, onExit: () => go('map') }).load();
    else if (room === 'machine' || room === 'math03') scene = await new MachineMath03({ ...common, puzzle: math03, onExit: () => go('map') }).load();   // Q02 #1, reached from NEO's map
    else if (room === 'storage' || room === 'math06') scene = await new StorageMath06({ ...common, puzzle: math06, onExit: () => go('map') }).load();   // Q02 #2, opens when the machine works
    else if (room === 'gear' || room === 'math07') scene = await new GearMath07({ ...common, puzzle: math07, onExit: () => go('map') }).load();   // Q02 #3, opens when the stock is sorted
    else if (room === 'scilab' || room === 'sci01') scene = await new SciLabSci01({ ...common, puzzle: sci01, onExit: () => go('map') }).load();   // Q02 #5, opens when the machine works (SCI-01 «راز چراغ خاموش»)
    else if (room === 'wsmeasure' || room === 'sci03') scene = await new WorkshopMeasureSci03({ ...common, puzzle: sci03, onExit: () => go('map') }).load();   // Q02 #6, opens when the lab lamp burns (SCI-03 «اندازه‌گیری مواد»)
    else if (room === 'quran01' || room === 'quran') scene = await new QuranReading01({ ...common, puzzle: quran01, onExit: () => go('map') }).load(); // QURAN-01: LIB_STUDY (direct room route; no Quran verses synthesized)
    else if (room === 'payment' || room === 'math08') scene = await new MarketMath08({ ...common, puzzle: math08, onExit: () => go('map') }).load();   // Q02 #4, opens when the number panel is fixed
    else if (room === 'map') scene = await new WorldMap({ ...common, world, onTravel: (r) => go(r), onClose: () => go('menu') }).load();
    else if (room === 'plaza' || room === 'math01') scene = await new PlazaMath01({ ...common, puzzle: math01, onExit: onward('stall') }).load();
    else scene = await new PlazaMath01({ ...common, puzzle: math01, onExit: onward('stall') }).load();   // unknown ?room → the plaza
    applySettings(loadSettings(localStorage), audio);
    window.__luma = { scene, audio, events, go, next, strings };      // for tests and the debug console
  };
  const want = params.get('room') || (params.has('skipmenu') ? next() : 'menu');
  await go(want);
  fit(); addEventListener('resize', fit);
  cv.addEventListener('pointerdown', (e) => { cv.setPointerCapture(e.pointerId); scene.pointerDown(...toLogical(e)); });
  cv.addEventListener('pointermove', (e) => scene.pointerMove(...toLogical(e)));
  cv.addEventListener('pointerup', (e) => scene.pointerUp(...toLogical(e)));
  cv.addEventListener('pointercancel', (e) => scene.pointerUp(...toLogical(e)));
  addEventListener('keydown', (e) => { if (e.key === 'd' || e.key === 'D') showDebug = !showDebug; });
  document.getElementById('loading').remove();
  let last = performance.now();
  const frame = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    scene.update(dt);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#16120d'; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.setTransform(view.s, 0, 0, view.s, view.ox, view.oy);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
    scene.draw(ctx);
    ctx.restore();
    if (showDebug) {
      const st = scene.debugState();
      debugEl.style.display = 'block';
      debugEl.textContent = Object.entries(st).map(([k, v]) => `${k}: ${v}`).join('\n') + '\n— last events —\n' +
        events.slice(-6).map((e) => `${e.event} ${e.error_type || ''} ${e.misconception || ''} h${e.hint_level}`).join('\n');
    } else debugEl.style.display = 'none';
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
boot().catch((e) => { document.getElementById('loading').textContent = 'بارگذاری ناموفق بود: ' + e.message; console.error(e); });
