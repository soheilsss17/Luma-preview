# LUMA — نمونهٔ قابل‌بازی در مرورگر (Reference Runtime)

این پوشه **پیاده‌سازی مرجع** منطق بازی است. همان داده‌ها و همان قواعدی را اجرا می‌کند که نسخهٔ Unity اجرا می‌کند. بازی نهایی همچنان Unity 6 است (`07`). این نسخه برای سه کار است:
1. **بازی و تست فوری** هر Room، بدون Unity و روی هر مرورگر یا گوشی.
2. **مرجع رفتار:** اگر رفتار Unity با این نسخه فرق کند، باگ است. هر دو، تست‌های مشترک (`*.vectors.json`) را اجرا می‌کنند.
3. **آزمون سریع طراحی** (Playtest) با کودک پیش از پیاده‌سازی نهایی.

## اجرا
```bash
python3 tools/rig/preview/serve.py 8080      # از ریشهٔ مخزن
# مرورگر: http://localhost:8080/web/          (?debug برای Overlay، ?reset برای پاک کردن Save)
# پرش مستقیم برای تست: ?room=menu | ?room=workshop | ?room=plaza | ?room=stall (یا math02) | ?room=garden (یا math05) | ?room=signs (یا p01)
```
**جریان بازی:** منوی اصلی ← افتتاحیهٔ «کوک» (فقط بار اول؛ با `WS_TUTORIAL_DONE` رد می‌شود) ← میدان و MATH-01 ← (درخشش خروجی میدان) غرفهٔ جشن و MATH-02 ← (درخشش خروجی غرفه) لبهٔ باغ و MATH-05 ← (درخشش خروجی باغ) چهارراه تابلوها و P-01 ← (درخشش خروجی چهارراه) تابلوی معرفی محله و W-01 در همان میدان ← (درخشش خروجی تابلو) تابلوی جشن و P-13 در همان میدان ← (درخشش خروجی تابلو) خانهٔ امیر و SOC-01 (خط زمان زندگی) ← (یک بار) Payoff بی‌کلام Q01 «جشن شروع می‌شود» ← نقشهٔ پارچه‌ای NEO. «ادامه» از اولین Room حل‌نشده شروع می‌کند؛ پس از جشن، نقشه را باز می‌کند، و خروج هر Room هم به نقشه برمی‌گردد. اولین لمس صدا را هم فعال می‌کند.

## منوی اصلی (`09` §۱؛ `js/scenes/title_menu.js`)
- **صحنه:** میز کار MIRA در کارگاه. NEO خوابیده و کم‌نور است و با لمس بیدار می‌شود.
- **دکمه‌ها:** «ادامه» (فقط وقتی Save وجود دارد)، «شروع» یا «بازی تازه» (با لمس دوم پیشرفت پاک می‌شود و تنظیمات می‌ماند) و «تنظیمات» (موسیقی، صداها، حرکت کمتر؛ ذخیره در `luma.settings`).
- **بخش والدین:** پشت Parent Gate (سه ثانیه نگه داشتن). «درخت نور» مفاهیم و سطح رشد را با برگ‌های نور نشان می‌دهد، بدون عدد، نمره، رتبه یا واژهٔ «ضعیف» (`10` §۵)، همراه یک پیشنهاد فعالیت بیرون از صفحه.

## Room: WS_MAIN_FLOOR / افتتاحیهٔ «کوک» (`12` §۲)
شرح کامل در `docs/plan/12`. خلاصه: افتتاحیه (کوک، LUMI، پنجره)، راه رفتن با تپ، ۳ مرحلهٔ چرخ‌دنده (۱، ۲ و ۳ جای خالی؛ اندازه مهم است)، بازخورد گیر کردن یا نرسیدن، H1 تا H3 و Assist، و در پایان دریچه، کلید و در نور.
داده: `unity/Assets/_Project/Content/Puzzles/GEAR_TUTORIAL.puzzle.json`. قواعد: `js/edu/gear_rules.js` و `js/puzzles/gear_chain.js`.
کلید `D` پنل Debug را باز و بسته می‌کند. این پنل حالت پازل، سطح Hint، Misconceptionهای Flagشده، Mastery، World State، لایه‌های موسیقی و Assetهای Placeholder را نشان می‌دهد.

## Room فعلی: VIL_PLAZA / MATH-01 (Q01، `12` §۲)
| مرحله | پازل | رفتار (کارت `13` §۵) |
|---|---|---|
| Encounter | ۶ فانوس: A B A B ؟ ؟ | فانوس را از سینی بکش و به قلاب بیاویز. پاسخ درست روشن می‌شود و یک لایه به موسیقی اضافه می‌کند. پاسخ غلط چشمک می‌زند و خاموش می‌ماند؛ تنبیهی ندارد و می‌شود آن را برداشت |
| Practice | دایره، مربع، مربع (C S S C ؟ ؟) | واحد تکرار ۳تایی با فانوس‌های واقعی گرد و مربع (Batch 04) |
| Payoff | فانوس‌ها روشن می‌شوند | موتیف ۳ نتی صعودی. میدان به حالت «آباد و زنده» Cross-fade می‌شود. `VIL_LAMPS_ON` ذخیره می‌شود. NEO و TIKO شادی می‌کنند و LUMI دور میدان می‌چرخد |

**Hint:**
- **H1:** LUMI روی فانوس‌های واحد اول نور می‌دهد.
- **H2:** قاب نور دور هر واحد تکرار کشیده می‌شود.
- **H3:** شبح فانوس بعدی دیده می‌شود؛ قرار دادن فانوس با خود کودک است.
- **فعال شدن:** دکمه پس از ۲ خطا یا ۴۵ ثانیه بی‌کاری پالس می‌زند. Misconception Flagشده مستقیم Hint مخصوص خودش را هدف می‌گیرد.

**Answer Assist:** پس از ۳ خطا گزینه‌های غلط برای Slot بعدی حذف می‌شوند و Mastery ثبت نمی‌شود. Assist همیشه Slot بعدی را هدف می‌گیرد، پس هیچ‌وقت گزینه‌ای را که Slot بعدی لازم دارد پنهان نمی‌کند (No Soft Lock).

**Misconception:**
- `repeat_nearest` ← PAT_M01 (تکرار همسایه).
- `wrong_unit_length` ← PAT_M02 (واحد با طول غلط).
- Flag شدن: از بار دوم.

**Mastery:** دیدن ← ۱؛ حل با H1 یا H2 ← ۲؛ Practice مستقل ← ۳. سطح هرگز پایین نمی‌آید. سطوح ۴ و ۵ به Transfer کارگاه (Q02) نیاز دارند.

**Analytics:** صف آفلاین در `localStorage` با ۶ فیلد کارت در هر رویداد (puzzle_id، attempt_id، duration، selected_pattern_type، error_type، hint_level).

## Room: VIL_PLAZA_STALL / MATH-02 (Q01، `12` §۲ ردیف ۲)
شرح کامل در `docs/plan/12`.
- **Number Trail:** گام‌های ۲، ۵ و ۱۰ روی مسیر. گروه‌ها یا سیب تکی روی میز، TIKO روی سنگ‌ها می‌پرد و پس از هر دور مشاهدهٔ مقایسه‌ای پخش می‌شود.
- **Basket Snap:** ۱۲ سیب در ۴ سبد، با شمارش ۳، ۶، ۹، ۱۲ در پایان و ثبت `VIL_STALL_READY`.

داده: `unity/Assets/_Project/Content/Puzzles/MATH-02.puzzle.json`. قواعد: `js/edu/step_rules.js`؛ State: `js/puzzles/step_count.js`.

## Room: VIL_GARDEN_EDGE / MATH-05 (Q01، `12` §۲ ردیف ۵)
شرح کامل در `docs/plan/12`.
- **Mirror Drag:** باغچهٔ ۶×۳ با خط وسط؛ کودک ۴ گل آینه‌ای را در نیمهٔ راست می‌کارد. گل اشتباه با Ghost Mirror برمی‌گردد.
- **Mirror Mosaic:** قاب کاشی ۴×۴، اول محور عمودی و بعد محور افقی. در پایان `GDN_EDGE_BLOOM` ثبت می‌شود و باغ زنده می‌شود.

داده: `unity/Assets/_Project/Content/Puzzles/MATH-05.puzzle.json`. قواعد: `js/edu/symmetry_rules.js`؛ State: `js/puzzles/mirror_grid.js`.

## Room: VIL_SIGN_AREA / P-01 (Q01، `12` §۲ ردیف ۳)
شرح کامل در `docs/plan/12`.
- **Sign Place:** ۴ تابلو با جمله‌های کوتاه. لمس تابلو Reading Card را باز می‌کند و «بشنو» پس از ۳ ثانیه فعال می‌شود. کودک تابلو را جلوی مکانی می‌گذارد که کل جمله توصیفش می‌کند. مکان واکنش نشان می‌دهد و تابلو به روی تصویری‌اش می‌چرخد.
- **Route Marker:** ۴ نشانهٔ مسیر با متن‌های تازه. در پایان `VIL_SIGNS_FIXED` ثبت می‌شود و میدان گرم می‌شود.

داده: `unity/Assets/_Project/Content/Puzzles/P-01.puzzle.json`، صدا: `unity/Assets/_Project/Content/Audio/VO/`. قواعد: `js/edu/sign_rules.js`؛ State: `js/puzzles/sign_place.js`.

## Room: VIL_SIGN_AREA / W-01 تابلوی معرفی محله (`12` §۲ ردیف ۴)
- **Collect ← Match ← Sequence:** ۴ کارت تصویری از میدان جمع می‌شوند و روی تابلو می‌نشینند. کودک پلاک هر جمله را کنار تصویرِ **فاعلش** می‌گذارد. بعد ردیف‌ها را روی ریل مرتب می‌کند و مهر می‌زند. در پایان ستاره مهر می‌شود و تابلو روشن می‌شود.
- **Practice:** تابلوی کتابخانه با ۴ تصویر تازه. در پایان `VIL_INTRO_BOARD_UP` ثبت می‌شود و تابلو در میدان می‌ایستد.

داده: `unity/Assets/_Project/Content/Puzzles/W-01.puzzle.json`. قواعد: `js/edu/board_rules.js`؛ State: `js/puzzles/sentence_board.js`. پرش مستقیم: `?room=board` (یا `w01`).

## Room: VIL_PLAZA / P-13 تابلوی جشن (`12` §۲ ردیف ۶)
- **موضوع ← جمله ← مهر:** کودک یک کارت موضوع (نانوایی، فرش‌بافی یا سماور و چای) را در قاب می‌گذارد، از ۸ پلاک یک متن کوتاه در ۵ قاب می‌چیند و مهر می‌زند. هر ترکیب معتبر پذیرفته می‌شود: جملهٔ اصلی اول، دست‌کم ۲ جزئیات، بدون جملهٔ موضوع دیگر، بدون ایدهٔ تکراری، و جملهٔ پایانی آخر.
- **Practice:** کتابخانهٔ محله با موضوع ثابت. در پایان `VIL_FESTIVAL_POSTER_UP` ثبت می‌شود و تابلوی جشن در میدان روشن می‌شود.

داده: `unity/Assets/_Project/Content/Puzzles/P-13.puzzle.json`. قواعد: `js/edu/story_rules.js`؛ State: `js/puzzles/story_board.js`. پرش مستقیم: `?room=p13` (یا `story`).

**متن صوتی (TTS):** اعراب **سبک**، نه کامل (تصمیم کاربر در دور ۱۳). `tts_fa` برابر `text_fa` است، به‌علاوهٔ کسرهٔ اضافهٔ نانوشته، «ـهٔ»، سکون پایانی فقط در جای خطر، و «پُر» و «گُل». حداکثر ۴ علامت در هر خط. بررسی آن در `js/edu/tts_light.js` است.

## Room: VIL_HOUSE / SOC-01 خط زمان زندگی (`12` §۲ ردیف ۷)
- **آلبوم ← کارت‌ها ← کلید زمان:** کودک آلبوم را باز می‌کند و ۵ عکس زندگی امیر را از چپ (گذشته) به راست (امروز) روی خط زمان دیواری می‌چیند، مثل خط زمان کتاب (صفحهٔ ۶). با کلید زمان نشانگر برنجی راه می‌افتد و روی اولین جفت جابه‌جا می‌ایستد.
- **Practice:** خاطره‌های جعبه. **Transfer:** رشد گیاه کنار پنجره. پس از Encounter، `VIL_HOUSE_CLOCK_TICKING` ثبت می‌شود و ساعت خانه تیک‌تاک می‌کند.

داده: `unity/Assets/_Project/Content/Puzzles/SOC-01.puzzle.json`. قواعد: `js/edu/timeline_rules.js`؛ State: `js/puzzles/timeline.js`. پرش مستقیم: `?room=soc01` (یا `house`). هنر نهایی Batch 11 و 12 در بازی است (پلیت خانه، خط زمان، کارت، دو برگهٔ تصویر، آلبوم بسته و باز که با `album_on_table()` روی سطح میز خوابانده شده‌اند، جعبه، ساعت). صدا: هر ۲۰ کلیپ آماده است (۱۵ کارت و ۵ راهنما، `vo_status: ready`). سازوکار هر کلیپ جدا (`reading.vo_ready` در حالت `partial`) برای Roomهای بعدی باقی مانده تا هیچ دکمهٔ «گوش بده» بی‌صدایی دیده نشود.

## ساختار
| مسیر | نقش | معادل Unity |
|---|---|---|
| `js/engine/rig.js` | بازیگر Cut-out Rig (NEO و TIKO) با playbackRate | `Animation/LumaCutoutRig.cs` |
| `js/engine/motion.js` | Spring، Timeline، Reduce Motion | `Interaction/DraggableItem2D.cs` (Spring) |
| `js/engine/audio.js` | صدای موقت Web Audio: لایه‌های موسیقی تطبیقی، زنگ، موتیف، آب، کاغذ و پخش صدای خوانش (`voice`، با پایین آوردن موسیقی) | AudioManager (موسیقی نهایی با Suno، `14` §۱۰.۱) |
| `js/engine/assets.js` | SpriteBank با Manifest و Fallback | Addressables |
| `js/edu/pattern_rules.js` | قواعد خالص الگو | `Puzzles/PatternSlot/PatternRules.cs` |
| `js/edu/engines.js` | Misconception، Hint، Mastery، Analytics و Save | `Education/EducationEngines.cs`، `Managers/AnalyticsQueue.cs` |
| `js/puzzles/pattern_slot.js` | وضعیت پازل و Undo | `PatternSlot/PatternSlotState.cs` |
| `js/scenes/plaza_math01.js` | Room: چیدمان، ورودی، نمایش Hint و Payoff | `PatternSlot/PatternSlotController.cs` |
| `js/scenes/workshop_tutorial.js` | Room افتتاحیه: کوک، چرخ‌دنده‌ها، دریچه و در | (Controller بعدی) + `GearChain/GearChainState.cs` |
| `js/scenes/stall_math02.js` | Room غرفهٔ جشن: Number Trail، مشاهده، Basket Snap و Payoff | `StepCount/TrailController.cs`، `BasketController.cs` |
| `js/edu/step_rules.js`، `js/puzzles/step_count.js` | قواعد و State شمارش با گام | `StepCount/StepCountRules.cs` |
| `js/scenes/garden_math05.js` | Room لبهٔ باغ: Mirror Drag، Mirror Mosaic، Hint و Payoff | `Symmetry/MirrorGridController.cs` |
| `js/edu/symmetry_rules.js`، `js/puzzles/mirror_grid.js` | قواعد و State تقارن | `Symmetry/SymmetryRules.cs`، `MirrorGridController.cs` |
| `js/scenes/signs_p01.js` | Room چهارراه: Reading Card، Sign/Route Marker Place، واکنش مکان‌ها، Hint و Payoff | `SignPlace/SignPlaceController.cs` |
| `js/edu/sign_rules.js`، `js/puzzles/sign_place.js` | قواعد و State جای‌گذاری تابلو (تله، حدس، دو مکانِ Assist، Highlight) | `SignPlace/SignRules.cs`، `SignPlaceController.cs` |
| `js/scenes/title_menu.js` | منوی اصلی، تنظیمات، Parent Gate و درخت نور | UI Scene |
| `js/edu/gear_rules.js`، `js/puzzles/gear_chain.js` | قواعد و State چرخ‌دنده | `GearChain/GearChainRules.cs`، `GearChainState.cs` |
| `js/engine/strings.js` | جدول رشته‌ها و ارقام فارسی | Unity Localization (همان JSON) |
| `js/engine/hud.js` | دکمه‌های درون‌جهانی با حالت‌های pulse، pressed و disabled | UI Prefab |
| `fonts/` | Vazirmatn Round-Dots (OFL) با نام `LumaFa` | `Art/Fonts/Vazirmatn` + RTLTMPro |
| `assets/` | Spriteهای Runtime ساخته‌شده از `art/final` | در Unity همان Finalها Import می‌شوند |

**دادهٔ پازل (منبع واحد):** `unity/Assets/_Project/Content/Puzzles/MATH-01.puzzle.json`. هم این نسخه و هم Unity (TextAsset) آن را می‌خوانند.

## تست‌ها (بدون مرورگر)
```bash
node web/test/rules.test.js          # قواعد + موتورها در برابر بردارهای مشترک (44 مورد، شامل Solver Bot)
node web/test/scene.test.js          # کل Room به‌صورت Headless بازی می‌شود، همهٔ مسیرهای کارت (30 مورد)
node web/test/gears.test.js          # قواعد چرخ‌دنده در برابر بردارهای مشترک + Solver Bot (31 مورد)
node web/test/workshop.test.js       # افتتاحیه و منوی اصلی Headless (44 مورد)
node web/test/math02.test.js         # قواعد و Controllerهای MATH-02 در برابر بردارهای مشترک (126 مورد)
node web/test/math02_scene.test.js   # غرفهٔ جشن Headless، همهٔ مسیرهای کارت (46 مورد)
node web/test/math05.test.js         # قواعد و Controller تقارن MATH-05 در برابر بردارهای مشترک (106 مورد)
node web/test/math05_scene.test.js   # لبهٔ باغ Headless، همهٔ مسیرهای کارت (58 مورد)
node web/test/p01.test.js            # قواعد و Controller تابلوهای P-01 در برابر بردارهای مشترک (104 مورد)
node web/test/p01_scene.test.js      # چهارراه تابلوها Headless، همهٔ مسیرهای کارت (56 مورد)
node web/test/w01.test.js            # قواعد، Controller و متن‌های W-01 (اعراب سبک) در برابر بردارهای مشترک (272 مورد)
node web/test/w01_scene.test.js      # تابلوی معرفی Headless، همهٔ مسیرهای کارت + نگهبان چیدمان (75 مورد)
node web/test/p13.test.js            # قواعد و Controller تابلوی جشن P-13 در برابر بردارهای مشترک؛ ۴۴ ترکیب معتبر برای هر موضوع (205 مورد)
node web/test/p13_scene.test.js      # تابلوی جشن Headless، همهٔ مسیرها + نگهبان چیدمان (81 مورد)
node web/test/soc01.test.js          # قواعد و Controller خط زمان SOC-01 در برابر بردارهای مشترک (234 مورد)
node web/test/soc01_scene.test.js    # خانهٔ امیر Headless: آلبوم، کشیدن، کلید، خطاها، H1–H3، Assist، Practice، Transfer، ذخیره، صدای هر کلیپ (105 مورد)
node web/test/world_map.test.js      # داده و قواعد نقشه (JS = C#)، بردارهای مشترک، ریاضی مه = derive_map_fog.py (734 مورد)
node web/test/payoff_scene.test.js   # Payoff Q01 و نقشه Headless: زمان‌بندی، جمعیت، رد کردن، مه، سفر سریع، چیدمان (216 مورد)
node web/test/flow.test.js           # بوت main.js با DOM ساختگی: منو ← افتتاحیه ← میدان ← غرفه ← باغ ← تابلوها ← تابلوی معرفی ← تابلوی جشن (143 مورد)
# فریم واقعی غرفه: node web/test/render_stall.mjs   (خروجی: art/review/web_frames_math02/)
# فریم واقعی باغ: node web/test/render_garden.mjs   (خروجی: art/review/web_frames_math05/)
# فریم واقعی تابلوها: node web/test/render_signs.mjs   (خروجی: art/review/web_frames_p01/)
# ویدیوی بازی SOC-01 (۱۵۸ ثانیه با صدا، کودکی که اشتباه می‌کند): LD_LIBRARY_PATH=~/.cache/canvas/lib FFMPEG=… node web/test/record_soc01.mjs   (خروجی: art/review/soc01_playthrough.mp4 و .log.json)
# فریم واقعی تابلوی معرفی: node web/test/render_w01.mjs /tmp/w01f   (۲۵ فریم؛ PNGها commit نمی‌شوند)
# فریم واقعی تابلوی جشن: node web/test/render_p13.mjs /tmp/p13f   (۲۷ فریم)
# فریم واقعی خانهٔ امیر: node web/test/render_soc01.mjs /tmp/soc01f   (۲۵ فریم)
# ویدیوی Payoff Q01 و نقشه (۴۶ ثانیه با صدا): LD_LIBRARY_PATH=~/.cache/canvas/lib FFMPEG=… node web/test/record_payoff.mjs   (خروجی: art/review/payoff_q01_map.mp4)
# فریم واقعی Payoff و نقشه: node web/test/render_payoff.mjs /tmp/payoff_frames   (۱۹ فریم)
# همه با هم: (cd web && npm test)
# فریم واقعی افتتاحیه و منو: node web/test/render_workshop.mjs   (خروجی: art/review/ws_frames/)
node tools/rig/preview/test/smoke.js # پیش‌نمایش Rig
# فریم واقعی (اختیاری): (cd ~/.cache/canvas && npm i @napi-rs/canvas) && node web/test/render_frames.mjs
# سینتکس C#: (cd ~/.cache/canvas && npm i web-tree-sitter@0.25 tree-sitter-c-sharp) && node tools/ci/cs_syntax_check.cjs unity/Assets
```
**بازسازی Spriteها پس از تولید Asset جدید:** `python3 tools/build_web_assets.py`

### P-01 recorded playthrough (round 11)
`LD_LIBRARY_PATH=~/.cache/canvas/lib FFMPEG=<ffmpeg> node web/test/record_p01.mjs [out.mp4]` plays the real room with
scripted touches (both classic mistakes, H1, reading with and without audio, practice, payoff, exit) and records
`art/review/p01_playthrough.mp4` (720p30, the game's own audio engine rendered offline) + `.log.json` (events, audio
calls, exceptions; exit code 1 on any exception). Needs `node-web-audio-api` and `libasound.so.2` (from the pygame
manylinux wheel) in `~/.cache/canvas`. Layout guard: `KEEP_CLEAR` / `placedBox` in `signs_p01.js`.

### W-01 recorded playthrough (round 12)
`LD_LIBRARY_PATH=~/.cache/canvas/lib FFMPEG=<ffmpeg> node web/test/record_w01.mjs [out.mp4]` plays the intro board:
collect in the square, both traps (→ targeted H2), the H3-free match, a wrong stamp + sequence H1 (VO), a broken
chain, the fix, the library practice (clean → mastery L3), payoff and exit. It writes `art/review/w01_playthrough.mp4`
(163.7 s, 0 errors) + `.log.json`. The intermediate `.wav` is deleted after muxing (and ignored in git).

### P-13 recorded playthrough (round 13)
`LD_LIBRARY_PATH=~/.cache/canvas/lib FFMPEG=<ffmpeg> node web/test/record_p13.mjs [out.mp4]` plays the festival board:
square → close-up, a topic changed once, off-topic sentence (→ misconception, H1), duplicate idea (H2), main sentence
moved down (→ Answer Assist), H3 badges + threads, the fix, the library practice (clean → mastery L3), payoff and exit.
It writes `art/review/p13_playthrough.mp4` + `.log.json` (0 errors). P-13 VO is still pending, so the track is music + SFX.
