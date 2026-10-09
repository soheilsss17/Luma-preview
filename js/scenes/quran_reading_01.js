// LIB_STUDY / QURAN-01 — respectful, timer-free Find → Arrange → Observe → Confirm.
// The room is drawn in-engine; the two production props come from art/meta prompts. Blank pages stay blank until
// a verified-text package is provided. No synthetic recitation is used.
import { drawExitArrow } from '../engine/hud.js';
import { Spring } from '../engine/motion.js';
import { RigActor } from '../engine/rig.js';
import { SaveSlot, MasteryEngine, AnalyticsQueue, HintEngine, MisconceptionEngine } from '../edu/engines.js';
import { QuranReadingController } from '../puzzles/quran_reading.js';
import { faDigits } from '../engine/strings.js';

export const W = 1920, H = 1080;
const FONT = 'LumaFa, Vazirmatn, Tahoma, sans-serif';
export const Q01_LAYOUT = Object.freeze({
  window: { x: 390, y: 345, w: 330, h: 310 },
  shelfStand: { x: 1430, y: 438, r: 105 }, shelfLamp: { x: 1620, y: 540, r: 92 },
  standSlot: { x: 1030, y: 687, r: 150 }, lampSlot: { x: 680, y: 720, r: 125 },
  page: { x: 1015, y: 580, r: 130 }, confirm: { x: 1570, y: 945, r: 70 },
  hint: { x: 98, y: 92, r: 52 }, undo: { x: 220, y: 92, r: 52 }, reset: { x: 342, y: 92, r: 52 },
});
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const hit = (x, y, p) => Math.hypot(x - p.x, y - p.y) <= p.r;

export class QuranReading01 {
  constructor({ sprites, puzzle, audio, storage, debug, strings, onExit }) {
    Object.assign(this, { sprites, puzzle, audio, debug, strings, onExit });
    this.save = new SaveSlot(storage); this.mastery = new MasteryEngine(storage);
    this.analytics = new AnalyticsQueue(storage, puzzle.analytics_fields);
    this.stage = puzzle.stages[0]; this.t = 0; this.startedAt = 0; this.attempt = 0;
    this.warmth = new Spring(0, { stiffness: 2.8, damping: 4.5 });
    this.lampGlow = new Spring(0, { stiffness: 8, damping: 7 });
    this.curtain = new Spring(0, { stiffness: 5, damping: 5 });
    this.windowGlow = new Spring(0, { stiffness: 3, damping: 4 });
    this.particles = []; this.bubble = null; this.press = null; this.drag = null;
    this.selected = null; this.solved = false; this.ended = false; this.hintLevel = 0; this.assisted = false;
  }
  async load() {
    try { this.neo = await new RigActor({ id: 'NEO', scale: 0.20, x: 275, groundY: 918, face: 1 }).load(); this.neo.walkTo(455, () => { if (this.neo.has('think')) this.neo.play('think'); }); }
    catch { this.neo = null; }
    const hooks = {
      onFind: (item) => { this.audio?.pickup?.(); this.say(item === 'lamp' ? 'چراغ را پیدا کردی.' : 'رحل را پیدا کردی.'); this.log('find', { item }); },
      onPlace: (item) => { this.audio?.woodClick?.(); this.burst(item === 'lamp' ? 680 : 1030, item === 'lamp' ? 720 : 687, 12); this.say(item === 'lamp' ? 'چراغ کنار میز قرار گرفت.' : 'رحل روی میز نشست.'); if(this.neo){const x=item==='lamp'?600:890;this.neo.walkTo(x,()=>{if(this.neo.has('point'))this.neo.play('point')});} this.log('arrange', { item, result: 'placed' }); },
      onWrongPlace: (item) => { this.audio?.clunk?.(); this.misc.observe('QUR_READING_IS_RUSHING'); const trigger=this.hints.onWrong(); if(trigger) this.hints.target(1); this.say('جای دیگری را امتحان کن؛ لازم نیست عجله کنی.'); this.log('arrange', { item, result: 'wrong_place', misconception: 'QUR_READING_IS_RUSHING' }); },
      onLamp: (on) => { this.audio?.switch?.(); this.lampGlow.target = on ? 1 : 0; this.warmth.target = on ? 1 : 0.18; this.say(on ? 'چراغ روشن شد؛ حالا نور صفحه را ببین.' : 'چراغ خاموش شد.'); },
      onCurtain: (open) => { this.audio?.cloth?.(); this.curtain.target = open ? 1 : 0; this.windowGlow.target = open ? 1 : 0; this.say(open ? 'پرده باز شد و نور روز آمد.' : 'پرده بسته شد.'); },
      onObserve: (target) => { this.audio?.chime?.(); this.burst(target === 'page' ? 1015 : 550, target === 'page' ? 580 : 500, 8); this.say(target === 'page' ? 'صفحه روشن است؛ با نگاه خودت بررسی کن.' : 'نور روز از پنجره می‌آید.'); if(this.neo){this.neo.faceTowards(target==='page'?1015:550);if(this.neo.has('think'))this.neo.play('think');} this.log('observe', { target, result: 'seen' }); },
      onRefuse: (missing) => { this.audio?.clunk?.(); this.misc.observe('QUR_READING_IS_RUSHING'); this.hints.onWrong(); this.say('هنوز یک قدم مانده: ' + this.missingLabel(missing[0])); this.log('confirm', { result: 'incomplete', missing }); },
      onUndo: () => { this.audio?.snap?.(); this.lampGlow.target = this.ctrl.lampOn ? 1 : 0; this.curtain.target = this.ctrl.curtainOpen ? 1 : 0; this.windowGlow.target = this.ctrl.curtainOpen ? 1 : 0; },
      onReset: () => { this.lampGlow.set(0); this.lampGlow.target = 0; this.curtain.set(0); this.curtain.target = 0; this.windowGlow.set(0); this.windowGlow.target = 0; this.warmth.target = 0; },
      onSolved: () => this.solve(),
      log: (name, data) => this.log(name, data),
    };
    this.ctrl = new QuranReadingController(hooks);
    this.hints = new HintEngine(this.stage.hints, this.stage.answer_assist);
    this.misc = new MisconceptionEngine(this.puzzle.misconceptions, 2);
    const prior = this.save.puzzle(this.stage.puzzle_id);
    if (prior?.solved) {
      this.ctrl.found = { book_stand: true, lamp: true }; this.ctrl.placed = { book_stand: true, lamp: true };
      this.ctrl.lampOn = true; this.ctrl.curtainOpen = true; this.ctrl.observed = { page: true, window: true };
      this.ctrl.solved = true; this.solved = this.ended = true;
      this.lampGlow.set(1); this.lampGlow.target = 1; this.curtain.set(1); this.curtain.target = 1; this.windowGlow.set(1); this.windowGlow.target = 1; this.warmth.set(1); this.warmth.target = 1;
    } else this.say(this.stage.objective_fa);
    this.startedAt = this.t; this.attempt++;
    this.log('puzzle_start', { card: 'QURAN-01', stage: 'encounter' });
    return this;
  }
  say(text) { this.bubble = { text, until: this.t + 4.2 }; }
  missingLabel(rule) {
    return ({ FIND_BOOK_STAND:'رحل را پیدا کن', FIND_LAMP:'چراغ را پیدا کن', PLACE_BOOK_STAND:'رحل را روی میز بگذار', PLACE_LAMP:'چراغ را کنار میز بگذار', TURN_LAMP_ON:'چراغ را روشن کن', OPEN_CURTAIN:'پرده را باز کن', OBSERVE_PAGE_LIGHT:'نور صفحه را مشاهده کن', OBSERVE_WINDOW_LIGHT:'نور پنجره را مشاهده کن' })[rule] || 'جای مطالعه را با دقت بررسی کن';
  }
  log(event, extra = {}) {
    const e = { event, room_id: 'LIB_STUDY', phase: this.phase(), duration_s: Math.round((this.t - this.startedAt) * 10) / 10, hint_level: this.hints?.maxUsed || 0, assisted: this.assisted, ...extra };
    this.debug?.push(e); this.analytics?.log(event, e); return e;
  }
  phase() {
    if (!this.ctrl) return 'find';
    if (!this.ctrl.found.book_stand || !this.ctrl.found.lamp) return 'find';
    if (!this.ctrl.placed.book_stand || !this.ctrl.placed.lamp) return 'arrange';
    if (!this.ctrl.observed.page || !this.ctrl.observed.window) return 'observe';
    return 'confirm';
  }
  replay() {
    if (!this.ended) return false;
    this.ctrl.solved = false; this.ctrl.reset(); this.solved = this.ended = false;
    this.save.setFlag(this.puzzle.world_state_on_solve, false); this.save.setPuzzle(this.stage.puzzle_id, { solved: false, hint_max: this.hints.maxUsed, assisted: false });
    this.hints.reset(); this.misc.reset(); this.hintLevel = 0; this.assisted = false; this.attempt++; this.startedAt = this.t;
    this.bubble = null; this.particles = []; this.lampGlow.set(0); this.lampGlow.target = 0; this.curtain.set(0); this.curtain.target = 0; this.windowGlow.set(0); this.windowGlow.target = 0; this.warmth.set(0); this.warmth.target = 0;
    this.say(this.stage.objective_fa); this.log('puzzle_replay', { attempt: this.attempt }); return true;
  }
  solve() {
    this.solved = this.ended = true; this.audio?.chime?.(); this.audio?.motif?.(); this.warmth.target = 1; this.lampGlow.target = 1;
    this.burst(1015, 580, 34); this.save.setFlag(this.puzzle.world_state_on_solve);
    this.save.setPuzzle(this.stage.puzzle_id, { solved: true, hint_max: this.hints.maxUsed, assisted: this.assisted }); this.save.save();
    this.mastery.record(this.puzzle.concept_id, { stage: 'encounter', solved: true, maxHint: this.hints.maxUsed, assisted: this.assisted }, this.puzzle.mastery);
    this.say('جای مطالعه آماده است. هر وقت خواستی، می‌توانی دوباره نگاه کنی.');
    if (this.neo?.has('happy')) this.neo.play('happy');
  }
  burst(x, y, n) { for (let i=0;i<n;i++) this.particles.push({ x,y, vx:(Math.random()-.5)*110, vy:-35-Math.random()*100, life:.55+Math.random()*.65, r:2+Math.random()*4 }); }
  update(dt) {
    this.t += dt; this.warmth.update(dt); this.lampGlow.update(dt); this.curtain.update(dt); this.windowGlow.update(dt);
    this.hints?.tick?.(dt); this.audio?.setLayers?.(1 + Math.round(this.lampGlow.value * 2));
    if (this.neo) this.neo.update(dt);
    for (const p of this.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 150 * dt; p.life -= dt; }
    this.particles = this.particles.filter((p) => p.life > 0);
    if (this.bubble && this.t > this.bubble.until) this.bubble = null;
  }
  pointerDown(x, y) {
    this.press = { x,y,t:this.t }; if (this.ended) { if (hit(x,y,Q01_LAYOUT.confirm)) this.onExit?.(); else if (hit(x,y,Q01_LAYOUT.reset)) this.replay(); return; }
    if (hit(x,y,Q01_LAYOUT.hint)) return this.hint();
    if (hit(x,y,Q01_LAYOUT.undo)) { if (!this.ctrl.undo()) this.say('هنوز چیزی برای برگرداندن نیست.'); return; }
    if (hit(x,y,Q01_LAYOUT.reset)) { this.ctrl.reset(); this.drag=null; this.selected=null; this.say('از نو شروع کردیم؛ با آرامش پیش برو.'); this.log('reset', {}); return; }
    if (hit(x,y,Q01_LAYOUT.confirm)) { this.ctrl.confirm(); return; }
    if (x > 300 && x < 740 && y > 340 && y < 690) {
      if (!this.ctrl.curtainOpen) { this.ctrl.toggleCurtain(); return; }
      if (this.ctrl.observe('window')) return;
    }
    if (this.ctrl.placed.lamp && Math.hypot(x-680,y-695)<145) { this.ctrl.toggleLamp(); return; }
    if (this.ctrl.placed.book_stand && hit(x,y,Q01_LAYOUT.page)) { if (!this.ctrl.observe('page')) this.say('اول چراغ را روشن کن تا صفحه را ببینی.'); return; }
    if (!this.ctrl.found.book_stand && hit(x,y,Q01_LAYOUT.shelfStand)) { this.ctrl.find('book_stand'); this.selected='book_stand'; return; }
    if (!this.ctrl.found.lamp && hit(x,y,Q01_LAYOUT.shelfLamp)) { this.ctrl.find('lamp'); this.selected='lamp'; return; }
    if (this.ctrl.found.book_stand && !this.ctrl.placed.book_stand && hit(x,y,{...Q01_LAYOUT.shelfStand,r:130})) { this.selected='book_stand'; return; }
    if (this.ctrl.found.lamp && !this.ctrl.placed.lamp && hit(x,y,{...Q01_LAYOUT.shelfLamp,r:112})) { this.selected='lamp'; return; }
    if (this.selected && (hit(x,y,Q01_LAYOUT.standSlot) || hit(x,y,Q01_LAYOUT.lampSlot))) { this.dropSelected(x,y); return; }
    if (this.ctrl.found.book_stand && !this.ctrl.placed.book_stand && Math.hypot(x-1030,y-687)<185) { this.selected='book_stand'; this.dropSelected(x,y); return; }
    if (this.ctrl.found.lamp && !this.ctrl.placed.lamp && Math.hypot(x-680,y-720)<160) { this.selected='lamp'; this.dropSelected(x,y); return; }
    if (this.ctrl.placed.lamp && this.ctrl.curtainOpen && Math.hypot(x-550,y-500)<180) this.ctrl.observe('window');
  }
  pointerMove(x,y) { if (this.selected) this.drag={x,y,item:this.selected}; }
  pointerUp(x,y) { if (!this.selected) return; const own=this.selected==='book_stand'?Q01_LAYOUT.standSlot:Q01_LAYOUT.lampSlot; const other=this.selected==='book_stand'?Q01_LAYOUT.lampSlot:Q01_LAYOUT.standSlot; if(hit(x,y,own)||hit(x,y,other)) this.dropSelected(x,y); else this.drag=null; }
  dropSelected(x,y) {
    const item=this.selected; this.selected=null; this.drag=null;
    const correctTarget=item==='book_stand'?Q01_LAYOUT.standSlot:Q01_LAYOUT.lampSlot;
    if (hit(x,y,correctTarget)) this.ctrl.place(item,item==='book_stand'?'reading_desk':'lamp_table');
    else if (hit(x,y,item==='book_stand'?Q01_LAYOUT.lampSlot:Q01_LAYOUT.standSlot)) this.ctrl.place(item,'wrong_slot');
  }
  hint() {
    const h=this.hints.request(); if(!h){this.say('فعلاً نشانهٔ تازه‌ای ندارم.');return;}
    this.hintLevel=h.level; this.misc.observe('QUR_READING_IS_RUSHING');
    this.say(h.text_fa||h.text||this.missingLabel(this.ctrl.assist()?.action)); this.log('hint_used',{level:h.level});
    if(h.level===1){this.burst(1520,480,14);} if(h.level===2){this.burst(1030,690,14);} if(h.level===3){this.burst(500,470,16);}
  }
  debugState() { return { room:'quran01', phase:this.phase(), found:{...this.ctrl.found}, placed:{...this.ctrl.placed}, lampOn:this.ctrl.lampOn, curtainOpen:this.ctrl.curtainOpen, observed:{...this.ctrl.observed}, solved:this.ctrl.solved, hintLevel:this.hintLevel, drag:this.drag?{...this.drag}:null, neo:this.neo?{x:this.neo.x,clip:this.neo.clip}:null }; }
  draw(ctx) {
    this.drawRoom(ctx); this.drawWindow(ctx); this.drawFurniture(ctx); this.drawProps(ctx); this.drawHeader(ctx); this.drawControls(ctx); this.drawParticles(ctx); this.neo?.draw(ctx); this.drawBubble(ctx);
    if(this.drag){ctx.save();ctx.globalAlpha=.82;this.drawItem(ctx,this.drag.item,this.drag.x,this.drag.y,92);ctx.restore();}
    if(this.ended) this.drawFinish(ctx);
  }
  drawRoom(ctx) {
    const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#3b2c20');g.addColorStop(.52,'#876644');g.addColorStop(1,'#38291e');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    ctx.fillStyle='#c49a62';ctx.fillRect(0,155,W,14);ctx.fillStyle='#68492c';ctx.fillRect(0,900,W,180);
    ctx.fillStyle='rgba(250,217,159,.07)';for(let i=0;i<9;i++){ctx.fillRect(i*240,166,3,714);}
    ctx.fillStyle='rgba(38,25,17,.35)';ctx.fillRect(0,882,W,22);
    // quiet hand-painted style rug and floor boards
    ctx.fillStyle='rgba(223,185,124,.18)';ctx.beginPath();ctx.ellipse(980,906,460,88,0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='rgba(236,205,156,.3)';ctx.lineWidth=4;ctx.beginPath();ctx.ellipse(980,906,420,62,0,0,Math.PI*2);ctx.stroke();
    ctx.strokeStyle='rgba(51,34,23,.34)';ctx.lineWidth=3;for(let y=934;y<1080;y+=42){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
    ctx.fillStyle='rgba(255,230,185,.15)';ctx.beginPath();ctx.ellipse(980,780,550,195,0,0,Math.PI*2);ctx.fill();
    if(this.warmth.value>.01){const warm=ctx.createRadialGradient(680,660,20,680,660,480);warm.addColorStop(0,`rgba(255,208,111,${.22*this.warmth.value})`);warm.addColorStop(1,'rgba(255,208,111,0)');ctx.fillStyle=warm;ctx.fillRect(180,230,1000,700);}
  }
  drawWindow(ctx) {
    const p=Q01_LAYOUT.window; ctx.save();
    ctx.fillStyle='#231c19';ctx.beginPath();ctx.roundRect(p.x-15,p.y-15,p.w+30,p.h+30,12);ctx.fill();
    const glow=ctx.createRadialGradient(p.x+p.w/2,p.y+p.h/2,8,p.x+p.w/2,p.y+p.h/2,380);glow.addColorStop(0,`rgba(255,233,173,${.22+this.windowGlow.value*.55})`);glow.addColorStop(1,'rgba(255,228,166,0)');ctx.fillStyle=glow;ctx.fillRect(p.x-250,p.y-170,830,650);
    ctx.fillStyle='#d5c08b';ctx.fillRect(p.x,p.y,p.w,p.h);ctx.fillStyle='#9db2a7';ctx.fillRect(p.x+14,p.y+14,p.w-28,p.h-28);
    ctx.fillStyle='#f7e7bd';ctx.beginPath();ctx.arc(p.x+95,p.y+93,35,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#607b68';for(let i=0;i<6;i++){ctx.beginPath();ctx.ellipse(p.x+50+i*47,p.y+232+(i%2)*22,34,60,0,0,Math.PI*2);ctx.fill();}
    ctx.strokeStyle='#8b663d';ctx.lineWidth=13;ctx.strokeRect(p.x,p.y,p.w,p.h);ctx.beginPath();ctx.moveTo(p.x+p.w/2,p.y);ctx.lineTo(p.x+p.w/2,p.y+p.h);ctx.moveTo(p.x,p.y+p.h*.58);ctx.lineTo(p.x+p.w,p.y+p.h*.58);ctx.stroke();
    const open=this.curtain.value;ctx.fillStyle='#8c4c3b';ctx.globalAlpha=.96;ctx.beginPath();ctx.moveTo(p.x-20-open*175,p.y-20);ctx.lineTo(p.x+p.w*.47-open*160,p.y-6);ctx.lineTo(p.x+p.w*.43-open*160,p.y+p.h+25);ctx.lineTo(p.x-15-open*175,p.y+p.h+8);ctx.closePath();ctx.fill();ctx.beginPath();ctx.moveTo(p.x+p.w+20+open*175,p.y-20);ctx.lineTo(p.x+p.w*.53+open*160,p.y-6);ctx.lineTo(p.x+p.w*.57+open*160,p.y+p.h+25);ctx.lineTo(p.x+p.w+15+open*175,p.y+p.h+8);ctx.closePath();ctx.fill();
    ctx.globalAlpha=1;ctx.fillStyle='rgba(255,241,207,.9)';ctx.font=`700 24px ${FONT}`;ctx.textAlign='center';ctx.direction='rtl';ctx.fillText(this.ctrl.curtainOpen?'پنجره و پرده':'برای بازکردن پرده لمس کن',p.x+p.w/2,p.y+p.h+54);ctx.restore();
  }
  drawFurniture(ctx) {
    // low shelf, reading desk, side table — original in-engine shapes, not image assets
    ctx.fillStyle='#57391f';ctx.beginPath();ctx.roundRect(1300,300,470,360,18);ctx.fill();ctx.fillStyle='#9a6b3c';ctx.fillRect(1315,335,440,18);ctx.fillRect(1315,520,440,18);ctx.fillRect(1315,645,440,20);
    for(let i=0;i<8;i++){ctx.fillStyle=['#6b4935','#876048','#52634d','#8b6948'][i%4];ctx.beginPath();ctx.roundRect(1332+i*49,355+(i%3)*4,28,158,5);ctx.fill();ctx.fillStyle='rgba(245,212,155,.45)';ctx.fillRect(1337+i*49,368+(i%3)*4,18,4);}
    ctx.fillStyle='#70482a';ctx.beginPath();ctx.roundRect(500,705,710,44,13);ctx.fill();ctx.fillStyle='#b17c45';ctx.fillRect(516,690,680,22);ctx.fillStyle='#5c3d24';ctx.fillRect(545,749,34,156);ctx.fillRect(1135,749,34,156);
    ctx.fillStyle='#75502f';ctx.beginPath();ctx.roundRect(520,736,230,30,10);ctx.fill();ctx.fillStyle='#5b3c24';ctx.fillRect(548,763,25,126);ctx.fillRect(705,763,25,126);
    ctx.fillStyle='rgba(250,226,183,.12)';ctx.fillRect(755,790,480,2);
  }
  drawItem(ctx,item,x,y,size) {
    const id=item==='lamp'?(this.ctrl.lampOn?'quran_lamp_on':'quran_lamp'):'quran_book_stand';const im=this.sprites?.get(id);
    if(im){ctx.drawImage(im,x-size/2,y-size/2,size,size);return;}
    ctx.save();ctx.fillStyle=item==='lamp'?'#d19a42':'#6c3c20';ctx.strokeStyle='#f0d199';ctx.lineWidth=5;
    if(item==='lamp'){ctx.beginPath();ctx.roundRect(x-size*.18,y-size*.36,size*.36,size*.66,16);ctx.fill();ctx.stroke();ctx.beginPath();ctx.ellipse(x,y-size*.35,size*.29,size*.13,0,Math.PI,Math.PI*2);ctx.fill();}
    else{ctx.beginPath();ctx.moveTo(x-size*.35,y+size*.24);ctx.lineTo(x,y-size*.18);ctx.lineTo(x+size*.35,y+size*.24);ctx.lineTo(x,y+size*.44);ctx.closePath();ctx.fill();ctx.stroke();}
    ctx.restore();
  }
  drawProps(ctx) {
    const L=Q01_LAYOUT; if(!this.ctrl.found.book_stand){this.drawItem(ctx,'book_stand',L.shelfStand.x,L.shelfStand.y,150);this.target(ctx,L.shelfStand,'رحل');}
    else if(!this.ctrl.placed.book_stand){this.drawItem(ctx,'book_stand',1465,465,150);this.target(ctx,L.shelfStand,'رحل را بکش');}
    else this.drawItem(ctx,'book_stand',L.standSlot.x,L.standSlot.y,228);
    if(!this.ctrl.found.lamp){this.drawItem(ctx,'lamp',L.shelfLamp.x,L.shelfLamp.y,136);this.target(ctx,L.shelfLamp,'چراغ');}
    else if(!this.ctrl.placed.lamp){this.drawItem(ctx,'lamp',1620,540,136);this.target(ctx,L.shelfLamp,'چراغ را بکش');}
    else this.drawItem(ctx,'lamp',L.lampSlot.x,L.lampSlot.y,160);
    if(this.ctrl.placed.lamp){const x=680,y=665;const rad=ctx.createRadialGradient(x,y-35,10,x,y-35,210);rad.addColorStop(0,`rgba(255,225,140,${.22+this.lampGlow.value*.5})`);rad.addColorStop(1,'rgba(255,225,140,0)');ctx.fillStyle=rad;ctx.beginPath();ctx.arc(x,y-35,210,0,Math.PI*2);ctx.fill();}
    if(this.ctrl.observed.page){ctx.save();ctx.strokeStyle='#fff0b4';ctx.lineWidth=7;ctx.globalAlpha=.6+.4*Math.sin(this.t*4);ctx.beginPath();ctx.ellipse(1030,630,144,72,0,0,Math.PI*2);ctx.stroke();ctx.restore();}
  }
  target(ctx,p,label){ctx.save();ctx.globalAlpha=.52+.35*Math.sin(this.t*3);ctx.strokeStyle='#ffe6a8';ctx.lineWidth=5;ctx.setLineDash([10,9]);ctx.beginPath();ctx.arc(p.x,p.y,p.r+13,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.globalAlpha=1;ctx.fillStyle='#fff1d3';ctx.font=`700 22px ${FONT}`;ctx.textAlign='center';ctx.direction='rtl';ctx.fillText(label,p.x,p.y+p.r+37);ctx.restore();}
  drawHeader(ctx){ctx.save();ctx.fillStyle='rgba(40,27,18,.72)';ctx.beginPath();ctx.roundRect(610,26,700,96,32);ctx.fill();ctx.fillStyle='#fff1d2';ctx.font=`800 35px ${FONT}`;ctx.textAlign='center';ctx.direction='rtl';ctx.fillText('کتابخانهٔ آرام — آماده‌کردن جای مطالعه',960,69);ctx.font=`500 22px ${FONT}`;ctx.fillStyle='#f1d5a2';ctx.fillText('پیدا کن  ·  بچین  ·  مشاهده کن  ·  تأیید کن',960,103);ctx.restore();}
  button(ctx,p,label,color,enabled=true){ctx.save();ctx.globalAlpha=enabled?1:.52;ctx.fillStyle=color;ctx.strokeStyle='#f6e2b6';ctx.lineWidth=4;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#3f2d1b';ctx.font=`800 23px ${FONT}`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.direction='rtl';ctx.fillText(label,p.x,p.y+1);ctx.restore();}
  drawControls(ctx){const L=Q01_LAYOUT;this.button(ctx,L.hint,'؟','#edc56f');this.button(ctx,L.undo,'↶','#d7bc8d',!!this.ctrl.undoStack.length);this.button(ctx,L.reset,'↺','#d7bc8d');this.button(ctx,L.confirm,this.ended?'بازگشت':'تأیید','#e7bd69',this.ctrl.canConfirm()||this.ended);
    const labels={find:'وسایل را پیدا کن',arrange:'وسایل را بچین',observe:'نور و پرده را مشاهده کن',confirm:'آماده‌ای؟ تأیید کن'};ctx.save();ctx.fillStyle='rgba(48,31,19,.62)';ctx.beginPath();ctx.roundRect(690,954,520,66,28);ctx.fill();ctx.fillStyle='#fff0ce';ctx.font=`700 27px ${FONT}`;ctx.textAlign='center';ctx.direction='rtl';ctx.fillText(labels[this.phase()],950,988);ctx.restore();
    if(this.ctrl.found.book_stand&&!this.ctrl.placed.book_stand){ctx.save();ctx.strokeStyle='rgba(255,221,156,.75)';ctx.lineWidth=5;ctx.setLineDash([8,7]);ctx.beginPath();ctx.arc(L.standSlot.x,L.standSlot.y,L.standSlot.r,0,Math.PI*2);ctx.stroke();ctx.restore();}
    if(this.ctrl.found.lamp&&!this.ctrl.placed.lamp){ctx.save();ctx.strokeStyle='rgba(255,221,156,.75)';ctx.lineWidth=5;ctx.setLineDash([8,7]);ctx.beginPath();ctx.arc(L.lampSlot.x,L.lampSlot.y,L.lampSlot.r,0,Math.PI*2);ctx.stroke();ctx.restore();}
  }
  drawParticles(ctx){ctx.save();for(const p of this.particles){ctx.globalAlpha=clamp(p.life,0,1);ctx.fillStyle='#ffe29a';ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();}ctx.restore();}
  drawBubble(ctx){if(!this.bubble)return;ctx.save();ctx.fillStyle='rgba(255,246,221,.97)';ctx.strokeStyle='#85613a';ctx.lineWidth=4;ctx.beginPath();ctx.roundRect(560,160,800,72,24);ctx.fill();ctx.stroke();ctx.fillStyle='#3e2b1b';ctx.font=`700 26px ${FONT}`;ctx.textAlign='center';ctx.direction='rtl';ctx.fillText(this.bubble.text,960,205);ctx.restore();}
  drawFinish(ctx){ctx.save();ctx.fillStyle='rgba(31,23,17,.42)';ctx.fillRect(0,0,W,H);ctx.fillStyle='#fff0cd';ctx.strokeStyle='#c59a5a';ctx.lineWidth=6;ctx.beginPath();ctx.roundRect(590,315,740,340,38);ctx.fill();ctx.stroke();ctx.fillStyle='#51391f';ctx.font=`800 48px ${FONT}`;ctx.textAlign='center';ctx.direction='rtl';ctx.fillText('جای مطالعه آماده است',960,400);ctx.font=`500 28px ${FONT}`;ctx.fillText('نور چراغ و پنجره را با دقت دیدی؛ هیچ عجله‌ای نبود.',960,466);ctx.font=`500 23px ${FONT}`;ctx.fillText('صفحه‌ها تا افزودن متنِ تأییدشده خالی می‌مانند.',960,520);ctx.font=`600 21px ${FONT}`;ctx.fillText('↺ تکرار از دکمهٔ بالا؛ «بازگشت» برای خروج',960,575);ctx.restore();}
}
