# HANDOFF / CHECKPOINT: dựng lại battle animation TearRing Saga bằng JS

Tài liệu này đủ để người (hoặc phiên làm việc) tiếp theo làm tiếp mà không cần đọc lại cuộc trò chuyện.
Ngôn ngữ làm việc với người dùng: **tiếng Việt**.  Mọi chỗ ghi "suy đoán" là chưa kiểm chứng.

---------------------------------------------------------------------------------------------------
## 1. Mục tiêu và các quyết định của người dùng (nguyên văn ý)

- Người dùng đã **decomp** phần battle animation của *Yutona Eiyuu Senki - TearRing Saga* (bản Nhật, PS1) và muốn
  **đập đi xây lại** battle animation của dự án web `fe8-web-tactics` (Phaser) cho **giống game gốc hoàn toàn**, viết bằng JavaScript.
  KHÔNG phải phát lại frame render sẵn (lượt đầu mình hiểu sai và làm kiểu đó; đã xoá).
- Thứ tự công việc đã chốt: (1) hoàn tất battle animation (kể cả phép), (2) background trận, (3) map, (4) sprite nhân vật đi ngoài map.
  "Cứ decomp hết cho chuẩn chỉnh rồi mới tiếp".  Người dùng nói "cứ tiếp tục cho đến khi hoàn thiện".
- **Màu phe (palette theo phe) không ảnh hưởng trong trận** (người dùng xác nhận) -> bỏ khỏi danh sách việc.
- **Thay toàn bộ unit cũ** bằng unit mới lấy từ game gốc, lấy thêm vài unit, **xoá hết cái cũ không dùng** (đã làm).
- Người dùng **sẽ tự test sau** ("mình test sau cũng được"); chưa có phản hồi từ lần test nào sau khi dựng bản hiện tại.
  Người dùng đã gửi 1 video quay game (`Recording_2026-11-15_212553.mp4`, 712x718, 32,6 s) ở giai đoạn đầu; các lỗi trong video đã xử lý (mục 9).
- Câu hỏi người dùng đã được giải đáp: "game gốc phải điều khiển animation bằng cơ chế chung, không chỉnh tay từng unit đúng không?"
  -> Đúng: code chung + dữ liệu từng unit (BSET + file motion).  Chi tiết mục 7.
- Người dùng ưu tiên tiến độ liên tục, ít hỏi lại; có lúc yêu cầu "khoan sửa gì, chỉ nói còn thiếu gì" (đã tôn trọng).

---------------------------------------------------------------------------------------------------
## 2. Trạng thái tóm tắt (checkpoint)

| Hạng mục | Trạng thái |
|---|---|
| Engine animation (step, đường đi, ma trận/GTE, dựng gói, rasterizer PS1) | **Xong, khớp từng byte với mã máy gốc** trên 3 unit x mọi motion (mục 6) |
| Nạp tài nguyên unit (trang texture, CLUT, pose, motion) | Xong; đọc từ mã máy (`BtlUnitInit`, `BtlLoadPages`), chưa fuzz với emulator |
| Hướng nhìn / lật bên | **Xong** theo cơ chế game (mục 7.4) |
| Thời điểm trúng đòn, biến mất khi chết, tối nền khi chí mạng, phi tới sát | Đã áp, đọc từ mã máy; **chưa** đối chiếu bằng emulator, đã kiểm bằng hình + test |
| Bộ điều phối trận (choreography đầy đủ) | **Dang dở**: đã có bản đồ trạng thái (mục 7.5) + đọc xong bộ điều phối pha `0x8010031c` và `BtlApproachSetup`; còn ~4 nghìn lệnh (0x801013b0, 0x801020c0, 0x80103088, 0x801037e0, 0x801045bc, 0x80104fc4, 0x801052bc, 0x80100f18) chưa đọc |
| Hiệu ứng phép (khối vẽ riêng trong BtlFrameDraw) | **Chưa đọc** |
| Background trận (/BBG) | Mới biết tên tệp + hàm nạp; **chưa** biết định dạng, nền hiện là 2 mảng màu giả |
| Map, sprite đi map | **Chưa làm**; token map tạm = thế đứng chờ của engine |
| Kho unit | 27 unit trong `assets/tearring`, 6 unit đang dùng |
| Chạy trên trình duyệt thật | **CHƯA** (môi trường làm việc không có trình duyệt); chỉ có test node + Phaser giả + ảnh render |

Tests: `for f in tests/*.mjs; do node $f; done` -> 8 + 9 + 10 + 7 + 4 + 7 test đạt (cuối cùng là `tests/tearring.test.mjs` = 7 test).

---------------------------------------------------------------------------------------------------
## 3. Tệp nguồn và môi trường

### 3.1 Tệp người dùng đã upload (nằm ngoài dự án)
| Tệp | Nội dung |
|---|---|
| `fe8-web-tactics-main.zip` | dự án web gốc (Phaser 3, ES modules, không bundler) |
| `files.zip` | bộ decomp của người dùng: `README.md`, C đã decomp (`btl_anim_types.h`, `btl_anim_step.c`, `btl_anim_path.c`, `btl_draw_chan.c`, `btl_draw_trail.c`, `btl_draw_unit.c`, `btl_res_load.c` (dở), `tm_spline.c`, `tm_matrix.c`, `libgte_min.c`), công cụ (`export_anim.py`, `isoread.py`, `emu.py`, `vm.py`, `mips.py`, `dasm.py`, `xref.py`, `runner32.c`, `build_runner.sh`, `gte_model.py`, `btl_anim_syms.ld`, cùng các script verify khác), kết quả `out/BU004|BU030|BU052/{animations.json,sprite_sheet.png}`, và **`files/tearingsaga.bin` (594.054.048 byte, ảnh đĩa MODE2/2352)** |
| `Yutona_Eiyuu_Senki_-_TearRingSaga__Japan_.zip` | bản đĩa (bin/cue) |
| `Recording_2026-11-15_212553.mp4` | video chơi thử bản đầu (đã phân tích) |

Lấy ảnh đĩa: `unzip -p files.zip files/tearingsaga.bin > tearingsaga.bin`  (hoặc giải nén `Yutona_Eiyuu_Senki_-_TearRingSaga__Japan_.zip`, đổi tên `.bin`; phiên 2 người dùng upload `files__1_.zip` = bộ decomp không kèm ảnh đĩa).
Chạy `export_anim.py` (mã máy gốc) cần tạo liên kết `ln -s . files/verify` (script tìm `HERE/verify`):
`python3 export_anim.py --bin tearingsaga.bin --unit N [--only M1_0.D] [--shadow] [--side 1] --out DIR --engine auto`.
Mỗi lần chạy với cùng unit và `--out` ghi đè `animations.json` của lần trước (đã vấp: chạy lần lượt các motion cho cùng unit thì chỉ còn motion cuối).

### 3.2 Môi trường làm việc (không bền vững, dựng lại khi cần)
Node 22 (tự nhận ES module, `node --check` chạy được), Python 3 + Pillow + numpy, gcc; **không có trình duyệt, không có mạng**.
Thư mục tạm đã dùng: `/tmp/tr.bin` (đĩa), `/tmp/trall` (mọi gói unit), `/tmp/ref*` (bản đối chiếu từ mã máy), `/home/claude/work/extracted` (overlay).
Tất cả dựng lại bằng công cụ trong dự án:
```
python3 tools/tearring_extract.py --bin tearingsaga.bin --all --out /tmp/trall      # 621 gói BU (unit có đủ BSET/POS/CLUT)
python3 tools/decomp/extract_overlays.py --bin tearingsaga.bin                      # exe + overlay vào tools/decomp/extracted
python3 tools/decomp/scan.py funcs 800fc000 80108000                                # danh sách hàm
python3 tools/decomp/scan.py callers 0x8014e728                                     # ai gọi BtlMotionStart
python3 tools/decomp/scan.py field 0x2ec                                            # ai đọc/ghi trường lệch 0x2ec
python3 tools/decomp/scan.py global 0x80166884                                      # ai đọc/ghi biến toàn cục
python3 tools/decomp/scan.py dis 0x800ff4d4 320                                     # mã dịch ngược
```
(Đặt `TR_EXTRACT=<thư mục>` nếu overlay ở chỗ khác.)  **Lưu ý:** `tools/decomp/extracted` và gói unit mới (ngoài 27 unit trong `assets/tearring`) KHÔNG nằm trong zip; cần ảnh đĩa để dựng lại.

---------------------------------------------------------------------------------------------------
## 4. Bản đồ mã trong dự án

```
HANDOFF.md                         (file này)
ADD_CHARACTER.md                   cách thêm unit từ đĩa
js/tearring/                       ENGINE (không phụ thuộc DOM ở phần lõi)
  psx.js        số học int32, GTE (MVMVA), ngăn xếp ma trận (BtlMat*, RotMatrix, MulMatrix, ScaleMatrix, RotTransSV)
  path.js       TmLerp, TmBezier, TmSpline, BtlPathEval
  archive.js    parseAR (container AR của game)
  motion.js     Chan/Motion (nhìn qua DataView), chanPathStep, chanStep, motionTick, motionStart, motionStartM7
  draw.js       Frame (OT), drawChan, drawTrail, drawUnit (+ bóng đổ, vệt ảnh, fade palette)
  gpu.js        Vram 1024x512, Gpu (SPRT_8, POLY_FT4, POLY_F3, 4 kiểu trộn; chế độ "layer" và "backdrop")
  unit.js       createGlobals, createPart (dựng participant từ BU<nnn>.pak), mirrorPage, Bset
  stage.js      TearRingStage + Actor (loop/play/die/dash/flash), canvas Phaser 320x160, nền, tint
  token.js      buildTokens: hình đại diện unit trên map (thế đứng chờ do engine vẽ)
  README.md     bảng port + phần chưa có
  NOTES_battle_bg.md   ghi chú decomp (địa chỉ, công thức) - ĐỌC kỹ khi tiếp tục
js/data/tearringUnits.js           TEARRING_UNITS (kho unit + metadata), MOTION (vai trò motion), TEARRING_ROOT
js/data/units.js                   mỗi unit có trUnit: "BU..."
js/scenes/BootScene.js             nạp json/binary, dựng token (registry "trTokens"), sang MapScene
js/scenes/BattleScene.js           màn giao chiến (đã thay bản cũ hoàn toàn); API dữ liệu giữ nguyên: {attacker, defender, strikes, before, onComplete}
js/systems/map/MapRenderer.js      token map dùng set.flipFor / texture token
assets/tearring/                   common.json, rsincos.bin, 27 gói BU<nnn>.pak (4,1 MB)
tools/tearring_extract.py          trích gói unit + bảng chung từ đĩa
tools/verify_tearring.mjs          chạy engine, ghi crop từng tick (arg: unit motion out.bin [shadow] [side])
tools/compare_tearring.py          so crop với bản export mã máy (animations.json + sprite_sheet.png)
tools/decomp/                      mips.py, dasm.py, scan.py, extract_overlays.py (công cụ đọc mã máy)
tools/dev/                         script khảo sát/hình (xem tools/dev/README.md)
tests/tearring.test.mjs            7 test engine/stage/token/hit/chí mạng/dash
```
Đã **xoá**: `assets/characters/`, `js/systems/sprites/`, `js/systems/spriteSheet.js`, `js/data/battleSprites.js`, `js/data/battleAssets.js`,
`js/tools/sheetAnalysis.js`, thư mục `systems/` ở gốc, `char-lab.html`, `sprite-lab.html`, `BattleScene` cũ (và scene trung gian `TearRingBattleScene`, đã đổi tên thành `BattleScene`).

### Roster hiện tại (js/data/units.js)
| Đơn vị | trUnit | Ghi chú |
|---|---|---|
| p1 Kỵ Sĩ | BU016 | ngựa trắng, tóc xanh |
| p2 Kỵ Sĩ Thanh Long | BU038 | tóc xanh lục, ngựa trắng yên xanh |
| p3 Kỵ Sĩ Hắc Phong | BU002 | ngựa nâu áo tím (tên "Hắc Phong" không khớp ngoại hình; chưa đổi) |
| e1 Kỵ Binh Địch | BU051 | ngựa xám ô-liu |
| e2 Kỵ Binh Địch Nhị | BU061 | ngựa trắng yên xanh |
| e3 Kỵ Binh Địch Tam | BU081 | ngựa trắng yên vàng |
Mọi đơn vị hiện đều **kiếm, cận chiến, trên ngựa**.  Kho dự phòng (đã khai báo trong TEARRING_UNITS): bộ binh kiếm BU027/048/058/188/198/201/204/207/224/230/233,
giáo BU212/218 (đi bộ), BU171/172 (kỵ binh), cung BU185/190/196, và BU004/BU030/BU052 (dùng kiểm chứng; BU004 = phép, BU052 = bản kỹ năng của BU051).

### Quy ước BU (đã quan sát, chưa có tài liệu)
Mỗi số BU = một nhân vật x kiểu vũ khí.  Bản thường (vd 016) = đòn đánh trơn; số kế tiếp (017) thường là **đòn kỹ năng có hào quang xanh** và có sự kiện trúng đòn.
BU050/060/070/080/163/170 là kỵ sĩ **xuống ngựa** (biến thể).  Trên đĩa: BU001..BU624; 621 unit có đủ M0_0, M0_1, M0_4, M1_0 (BU000 thiếu BSET).

---------------------------------------------------------------------------------------------------
## 5. Kiến trúc engine (cách nó chạy)

1. `createGlobals(common, rsincos)`: MatStack (ma trận hiện tại/gốc, GTE), bảng bóng/VRAM, `evtFlag`, `tint = [128,128,128,0]`.
2. `createPart(pak, G, vram, {slot, side, mirrorPages, shadow})`: đọc BSET, pose (POS.BAS + POS.EXT), nạp trang `B1..B6.DDD` vào VRAM tại `common.vramTable[slot*3+g]`
   (trang n -> nhóm g=(n-1)>>1, nửa trên/dưới = (n-1)&1, mỗi trang 128x128 halfword), CLUT.TIM (256 màu) tại **(0, 507+slot)**, tpage[g] theo công thức
   `((y&0x100)>>4)|((x&0x3ff)>>6)|0x80|((y&0x200)<<2)`, motion `M<g>_<k>.D` (1192 byte, chỉ nhận đúng kích thước) vào `part.motion[g*11+k]`.
   `mirrorPages` = lật mỗi nhóm 8 byte của trang (= lật ngang từng ô 8 pixel 8bpp, `mirrorPage`, hàm gốc 0x80151aec).
3. Mỗi **tick** (60 Hz giả định): `part.step()` = `BtlMotionTick` (kênh 0..3 của motion + motion liên kết link[4] ở +0x4a4, rồi tăng `tick`).
   Trạng thái chạy (rec_cur, key_cur, key_t, bộ đếm lặp) ghi **ngay trong bộ đệm 1192 byte** như game.
4. Mỗi **khung**: `Frame` (OT) -> `part.draw(F)` = `BtlDrawUnit` cho từng participant (chung một OT) -> `Gpu.run(F)`:
   slot OT = 157 + z (slot 156 = bóng + gói draw-area); chèn đầu danh sách (gói chèn sau chạy trước); `prim` đếm byte 24/40/20/8; `primEnd` mặc định 0xff00.
5. `Gpu`: texel 8bpp qua CLUT, texel 0 trong suốt, bit 15 = bán trong suốt; tpage bit 5-6 = ABR (0: B/2+F/2, 1: B+F, 2: B-F, 3: B+F/4).
   Chế độ `"layer"` (nền trong suốt, xấp xỉ alpha, dùng để so với exporter/token) và `"backdrop"` (trộn chuẩn PS1 lên nền cấp sẵn; stage dùng chế độ này).
6. `TearRingStage` (Phaser): hai `Actor` (left, right), canvas 320x160 hiển thị phóng 1,2 (BattleScene đặt ở y=118 trong khung 384x384).
   Mỗi `update(dt)` tích luỹ theo `tickMs` (mặc định 1000/60), tối đa 6 tick/khung; mỗi tick: tick từng actor (dash, die, motion) rồi `render`.
   `Actor.loop(id)` lặp; `Actor.play(id)` trả `{hit, done, onHit}`; `Actor.die()` biến mất; `Actor.dash(target)` phi tới; `Actor.flash(ms)` nháy.
   `G.tint` điều biến nền (sự kiện motion), `Actor.shift` = bù tâm hình (mục 8, chỉnh hiển thị của mình).
7. `BattleScene`: giữ giao diện (tên, HP, thanh, thông điệp, log, nhạc/sfx); phát lại `strikes` do luật chơi tính sẵn (KHÔNG tung xúc xắc).
   Mỗi đòn: (lần đầu) `await A.dash(D)` -> `A.play(M1_0|M1_1|M1_8)` -> `await h.hit` (tick BSET) -> trừ HP, rung camera, hit-stop (`freeze`), `hitReaction`
   (nháy + giật lùi tween; hạ gục -> `D.die()`), trượt -> `dodge` (M0_4 hoặc tween) -> `await h.done`.  Bên tấn công đứng trái (participant 1).
8. Token map: `buildTokens` dựng M0_0 tick 0 bằng engine (chế độ layer), cắt sát hình, tạo texture canvas `tr-token-<id>`; `TokenSet.flipFor(slot)`:
   slot "left" (phe người chơi) lật, "right" (địch) không lật.  `MapRenderer.createBody` dùng `registry.get("trTokens")`; thiếu thì rơi về hình tròn.

---------------------------------------------------------------------------------------------------
## 6. Kiểm chứng đã làm (kết quả đo thật)

Phương pháp: chạy engine JS và chạy **mã máy MIPS gốc của B.BIN** (`export_anim.py --engine auto`) cùng đầu vào, so từng pixel RGBA của mọi tick
(`tools/verify_tearring.mjs` + `tools/compare_tearring.py`; khung trống = ô trong suốt 1x1 ở exporter, đã xử lý).
- BU004: M0_0 M0_1 M0_4 M0_7 M1_0 M1_1 M1_8 M2_0 M2_1 M2_2 (M2_3 trống) - **khớp 100% từng byte**.
- BU030, BU052: mọi motion đã export - **khớp 100%**.  Tổng 31 lượt motion, hàng nghìn tick.
- Đường vẽ **bóng đổ** (`--shadow`): BU004 M1_0, BU052 M0_4, BU030 M0_0 - khớp 100%.
- Đường vẽ **side=1**: BU004 M1_0, BU052 M0_4 (trang chưa lật, đúng cách exporter) - khớp 100%.
- Sau khi đổi CLUT sang (0,507+slot): hồi quy BU004/030/052 vẫn khớp; hai CLUT đều khớp CLUT.TIM 256/256 màu sau khi nạp cả hai bên (trước đó bị ghi đè 128/256).
**Chưa kiểm bằng emulator** (chỉ đọc mã + hình + test): `BtlUnitInit`, `BtlLoadPages`, `BtlPartFx`, máy trạng thái biến mất, công thức phi tới, thời điểm trúng đòn,
tối nền chí mạng, bố cục `BtlSetupLayout`.
Kiểm chứng gián tiếp bằng hình: bóng đổ nằm ở `cam_y - 10 = 150` và móng ngựa render ra gần đó (xác nhận cam_y=160, y=bset.y);
cung chém rơi đúng mặt đối thủ khi tâm cách nhau 64 (xác nhận công thức phi tới); vệt chém xuất hiện đúng tick BSET (xác nhận tick trúng).

---------------------------------------------------------------------------------------------------
## 7. Kiến thức decomp (địa chỉ B.BIN, nạp tại 0x800f1008; exe tại 0x80010000+)

### 7.1 Đã port + khớp mã máy (từ bộ decomp của người dùng)
BtlChanPathStep 0x8014eb2c, BtlChanStep 0x8014ebfc, BtlMotionTick 0x8014ed9c, BtlMotionStart 0x8014e728, BtlMotionStartM7 0x8014e9c0,
BtlPathEval 0x8014eeb8, TmLerp 0x80059db8, TmBezier 0x80059a04, TmSpline 0x80059b64, BtlDrawChan 0x8014f22c, BtlDrawTrail 0x80150164,
BtlDrawUnit 0x80150870, RotMatrix 0x800a0930, MulMatrix 0x800a04a0, ScaleMatrix 0x800a05e0, RotTransSV 0x800a0e50,
BtlMatApplyTrans 0x80037fc8, BtlMatInitBase 0x8003829c, BtlMatLoadBase 0x80038234, BtlMatRotate 0x800382e8, BtlMatScale 0x80038314, BtlMatSetGte 0x800383cc, txArFind 0x800365c0.

### 7.2 Đọc từ mã máy trong dự án này (ĐÃ áp vào engine)
- **BtlUnitInit 0x8014e208** (ctl, alloc, idx): part = ctl + 200 + 264*idx; motion/BSET/POS trỏ thẳng vào vùng archive; CLUT.TIM nạp bằng 0x80057d38 với y = 507+idx (x lấy từ header TIM = 0);
  `part+0x9a = (507+idx)<<6`; `part+0xa0 = idx`; tpage theo công thức mục 5; `part+0x9c` = tpage thứ hai từ bảng 0x8016686c + 8*idx và `part+0x9e = (509+idx)<<6` (chưa thấy chỗ dùng);
  bảng pose `part+0xec` cấp n_pose*8; `part+0xf4` cấp 344 byte (trail); `part+0xb0 = 1` (bóng).
- **BtlLoadPages 0x8014e034**: số trang = (BSET u16 +0x1c >> 9) + 1 (tối đa 6); bảng nhảy 0x800f3d60 -> (nhóm, nửa); **`if (idx == 1)` gọi 0x80151aec (lật ô) trước khi LoadImage**.
- **0x80151aec**: với mỗi hàng (128) x 32 nhóm 8 byte: đảo 8 byte (bswap từng word + đổi chỗ hai word).
- **BtlFrameDraw 0x800fe8e4**: `side = (idx != 0)`; máy trạng thái biến mất mỗi participant (state s16 @ctl+0x74ac, mức @+0x74b0, đếm @+0x74b2):
  1 -> đếm 20, 2 -> đếm lùi rồi mức=255 + âm 38 (100,100), 3 -> `f_a8=f_b8=blend_bc=1`, `col_c0=(mức,mức,mức)`, mức -= 4, <8 thì state 4 + bỏ vẽ
  (nếu bset.flags0 & 0x200 gọi 0x8010adc0(idx,0)).  Thứ tự vẽ: nền (BtlBgDraw hai lần: lớp 0 rồi 1) -> unit -> khối hiệu ứng phép (cờ ctl+0x50 == 0, mảng @ctl+0x6bf4) -> (không có trận) xoá (0,0,256,160) và (256,0,64,160).
- **BtlPartFx 0x80151590**: `anim_a4=1; trail.period=n; timer[0..3]=n; wp[0..3]=rp[0..3]=0`.
- **BtlPartPlace 0x80151a4c** (đã đọc, CHƯA port; hook `partPlace` null): `BtlPathEval` kênh 0 rồi `if (part.f_d4 != 0) x -= path.x; else x += path.x;` rồi `y += path.y`; hàm anh em 0x801515e4(part, trục) lấy vị trí có cộng đường đi (dùng trong tính khoảng cách).
- **Sự kiện motion** (BtlChanStep): evt 0x01 = `g_BtlHitFlag` (0x8016687c); 0x02 = cờ 0x80163e00 = 1 (BtlEvt_8010adb0); 0x04 = khối lặp; 0x10 = `g_BtlEvtDelay` (0x80166884) = delay bản ghi; 0x20 = tint = g_BtlEvtArg (0x800cc41c = `80 80 80 00 | 5a 5a 5a 00`) (BtlEvt_8010aa50); 0x40 = tint >>= 1 mỗi kênh (BtlEvt_8010adf4).
  tint hiện tại 0x80166df8..dfa, đích 0x80166dfc..dfe (ảnh B.BIN = 0).  TintStep 0x80109a68: tiến tint về đích với bước = BSET byte +0x10 (BU016:1, BU004:2, BU052:6), gọi ở 0x80103908/0x801046ac/0x801089ac (CHƯA áp).
  Quét 622 unit: 0x02 xuất hiện ~1155 bản ghi, 0x20 ~421, 0x40 ~398; **với BU016/027/051 chỉ M1_8 (chí mạng) có sự kiện** (tick ~2: hit+0x40 tối nền; tick trúng thật; tick cuối: 0x20 trả nền); M1_0/M1_1/M0_x không có.
- **BtlSetupLayout 0x800fee48** (ctx = ctl+0x73b8): ghi cam_x (+0xac), cam_y (+0xae) và độ lệch +0x2ec/+0x2f0 (x), +0x2f4/+0x2f8 (y).
  s2 = ctl[0x6bf0+0x1c] = chỉ số bên TẤN CÔNG; loại tầm = `(record_lớp.word[0x1c] >> 27) & 3` (record từ 0x8002f89c(lớp, byte +0x5e của unit)).  Bảng (chế độ ctl[0x6bf0+0x18] == 1):

  | điều kiện (a0 = ctx.word[0]) | lệch x | cam_x | cam_y |
  |---|---|---|---|
  | chế độ != 1 | 90 và 90 | +160 nếu bên tấn công = 0, ngược lại -160 | 160 |
  | tầm 1 và a0 not in {1,2} | 120 cho bên tấn công | +120 / -120 | 160 |
  | tầm 1 và a0 == 1; tầm 0 và a0 == 1; tầm 2 và a0 == 1 | -35 và -35 | 0 | 160 |
  | tầm 1 và a0 == 2; tầm 0 và a0 != 1 (CẬN CHIẾN MẶC ĐỊNH); tầm 2 và (a0 == 2 hoặc lớp in {126,131,134}) | 0 | 0 | 160 |
  | tầm 2 khác (cung/phép tầm xa) | x 64, y 88 cho bên tấn công | +160 / -160 | 240 |
  Sau đó đăng ký 0x801099a4 (task ưu tiên 15), tint = (128,128,128), ctx+0x14 = 516.  **Stage hiện chỉ dùng hàng "cận chiến mặc định"** (cam (0,160), lệch 0) cho mọi trận.
- **BtlBattleInit 0x800ff4d4**: BtlUnitInit(ctl,1,0), (ctl,1,1) -> `BtlLoadUpal(0,507)` (0x8014dda8) -> cấp 2 vùng 0x8800 cho OT -> 0x800ff398 mỗi participant -> vị trí đầu:
  participant 0: `x = +bset.x + off[0x2ec]`, `y = bset.y + off[0x2f4]`; participant 1: `x = -bset.x - off[0x2f0]`, `y = bset.y + off[0x2f8]`; cờ bset 0x200 -> xử lý riêng (tắt bóng);
  hằng ctx: +0x3a=480, +0x3c=570, +0x3e=-320, +0x40=-230 (giới hạn camera?), +0x14=530; cuối cùng nạp "1.seq".
  **Màn hình: `sx = x - (cam_x - 160)`, `sy = cam_y - y`**.  Cận chiến mặc định: cam_x=0 => participant 0 (x=+100) ở sx=260 (PHẢI), participant 1 (x=-100) ở sx=60 (TRÁI).
- **Hướng nhìn**: chỉ quyết định bởi chỉ số participant (lật trang idx==1 và `side=idx!=0`); cờ `flip_ac` (part+0xac) chỉ khởi tạo = 0 trong trận thường
  (ghi ở 0x8014e254; các chỗ ghi khác nằm ở hàm 0x8011a894, 0x8012179c, 0x80121adc, 0x80123dd4 - ngoài vùng điều phối, có thể là cảnh sự kiện).
  => **mọi ảnh gốc quay TRÁI**; bên trái màn hình là ảnh lật.  (Bảng `facing` ghi tay trước đó sai và đã bỏ.)
- **Thời điểm trúng đòn**: BSET u16 `+0x14` (M1_0), `+0x16` (M1_1), `+0x18` (M1_8) -> bộ đếm ctx+0x21c lúc bắt đầu đòn (vùng 0x801014a0..0x80101d98).
- **Phi tới (BtlApproachSetup 0x800ffeec + pha 1 của 0x8010031c, 0x80100534)**: khoảng trống = `|xA-xB| - (wA+wB)/2` (w = BSET+0x0a, kẹp 0..640); tốc độ = BSET byte +0x0f kẹp 1..20 px/tick;
  `px/tick = khoảng trống / tốc độ` (tối thiểu 1); mỗi tick `t += 32767 / px/tick`, tràn 32767 là xong.
  **Đường đi phụ thuộc BSET+0x0e ("loại đòn", mục 7.5): loại 0 = `TmLerp` TUYẾN TÍNH (0x80100500 -> 0x80100944); Bézier chỉ ở loại 1 (0x80100534).**  Bản trước dùng Bézier cho mọi unit là SAI với loại 0 -> đã sửa (stage.js `_dashStep`, test mới).
  Điều khiển DỌC = 140 (hằng) thuộc nhánh loại 1 (Bézier) -> KHÔNG áp cho loại 0 (mọi unit hiện có).  Cổng chờ: cờ delay (0x80166884) bật HOẶC ctx+0x272 (= khoảng trống) != 0.
  Nhánh khác: có M0_7 thì chạy M0_7 với tốc độ 32767/(5*bset[0x0f]) (thời gian cố định); pha 8 dùng M0_0; pha 3 dùng M0_10; mặc định M0_1.
  Kiểm chứng gián tiếp bằng hình (mục 6).

### 7.3 Đã đọc cấu trúc, CHƯA port
- **0x8010031c** (767 lệnh): máy trạng thái 22 pha ở `part+0x0e`, bảng nhảy 0x800f13b8: pha 1 -> 0x80100534, 2 -> 0x80100624 (pha con ctx+0x27f 0..3), 3 -> 0x80100b3c, 4 -> 0x801007e4,
  8 -> 0x80100960, 9 -> 0x80100ab8, 20 -> 0x80100b94, 21 -> 0x80100d0c (cung Bezier: điểm đầu `x - dấu*(wA+wB+50)`, `y = bset+0x0c + 240`, tốc độ 32767/(10*b0f), qua 50% đổi M0_2, qua 75% giảm tốc 409/khung tới sàn 163);
  còn lại -> 0x80100424 (chỉ phát âm).  Hướng: `fp = (ctx.byte[0x88] != 0) ? +1 : -1`.  Biến nội suy: ctx+0x270 tốc độ, +0x272 khoảng trống, +0x274/+0x276 điểm đầu (x,y), +0x278/+0x27a điểm cuối, +0x27c tiến độ.
  Chưa biết: bản đồ pha -> loại đòn; nơi nào về chỗ cũ/lùi sau đòn (nghi pha 2, 3, 4); bộ đếm +0x60 = 10 đặt lúc bắt đầu.
- **Âm thanh đòn** (0x80035be8(id,100,100)): loại tầm 0 -> 39 (40 nếu flags_lớp & 4); loại 1 -> 44 (+40 nếu & 4); loại 2 -> 41 (42 nếu flags & 0x80).  Chết = 38.
- **Vệt ảnh khi cận chiến**: điều phối gọi `BtlPartFx(part, 2 hoặc 3)` + `bset.flags0 |= 0x800` + `bset.col24 = 0x00985050` (khi ctx+0xe4 != 0) hoặc `0x00709070`;
  điều kiện: `bset.flags0 & 4`, loại tầm 0, và 0x80026ec8(lớp) == 0 (hàm chưa đọc).  Cơ chế vẽ vệt đã port + khớp (BtlDrawTrail); chỉ thiếu phần kích hoạt.
- **0x800ff9d4** (326 lệnh): thực chất là bước cập nhật mỗi khung: tick motion hai bên, phát âm đòn, và máy trạng thái chuẩn bị (ctx+0xfc, bảng nhảy 0x800f1340) nạp nền/unit.
- Danh sách hàm điều phối (gọi BtlMotionStart/Tick): 0x800fc168 (812), 0x800ff4d4 (320), 0x800ff9d4 (326), 0x800ffeec (268), 0x8010031c (767), 0x8010108c (201),
  0x801013b0 (666, nạp timer đòn + M0_7 + PartFx), 0x801020c0 (1010, đếm timer +0x21c), 0x80103088 (470), 0x801037e0 (887), 0x801045bc (432), 0x80104fc4 (190), 0x801052bc (431), 0x801065b8 (1682).
  Số motion điều phối bắt đầu: 0 chờ, 1 phi tới, 2, 4 né, 7, 8, 10, 11/12 (11 + bit0 lượt), 19 chí mạng.  `BtlMotionStart(part, n, x, y=-1)`: y<0 nghĩa gọi BtlPartPlace.
- **Nền**: 0x80109ba4 `BtlBgLoad(bg, bg2, mode2, mode)`: ghi 0x80166de8/dec/df0/de4; mode2==1 -> `\BBG\BG%02dP%d.AR` với chữ số {mode0->1, mode1->3, mode2->5, khác->0} vào slot 0x80166d88;
  mode2!=1 -> `\BBG\BG%02dSP1.AR` (slot 0x80166d88) và `...SP2.AR` (slot 0x80166db8, dùng bg2 nếu khác bg); 0x8010aa74 nạp `BG%02dEP1.AR`/`EP2.AR`; 0x8010ab78 giải phóng.
  Gọi từ 0x8013b360 và 0x8013fcd4.  **0x80109e0c BtlBgDraw** (648 lệnh, đọc dở): cuộn (0x80166e3c, 0x80166e3e) có rung theo bộ đếm 0x80166e4c, điều biến bằng tint.  0x801099a4: task ánh xạ trạng thái (không phải tint).
- **Palette**: `BtlLoadUpal 0x8014dda8` nạp `\SB\UPAL%03d.TIM` (khoá = s16 @0x80167ba8[i], cache 15 ô @0x80167c34 ở VRAM (896, 292+4*ô)) vào 208 màu đầu hàng CLUT (0,507+i);
  `PalKeyToVram 0x801430c0`: khoá -> chỉ số tuyến tính qua 4 khoảng (bảng 0x80164688, byte 1-46, 48-62, 64-78, 113...), vị trí (256 + 16*(i&3), 491 + (i>>2)); 16 màu phe chép vào (208, 507+idx).
  Người dùng nói màu phe không ảnh hưởng trong trận -> bỏ qua.  **Lưu ý:** nếu key unit != 0 thì 208 màu đầu của CLUT.TIM bị thay bằng UPAL; chưa kiểm tra có unit nào dùng.
- Hàm nhỏ: GetPart 0x80151574 (= base + 200 + 264*i; ctl+0x79fc là gốc dùng trong BtlFrameDraw), HasUnit 0x80151788, SavePos 0x8015179c / RestorePos 0x801517b0 (part x,y <-> +0xe8,+0xea),
  ReadHitFlag 0x801517c4 / Clear 0x801517d4, ReadDelayFlag 0x801517e4 / Clear 0x801517f4, 0x80026ec8 (chưa đọc), 0x8002f89c (record lớp, trong exe).

### 7.5 Bộ điều phối trận (đọc từ mã máy phiên 2; CHƯA kiểm bằng emulator)
**Máy trạng thái chính** `0x801065b8(ctl, a1, a2, a3)`: trạng thái ở `ctx+0x14` (ctx = ctl+0x73b8; ctl+0x79fc = gốc bảng participant), bảng nhảy `0x800f1490` (597 mục), đuôi chung `0x80109000`.
Các trạng thái của một trận (số -> hàm):
`512` BtlSetupLayout 0x800fee48 | `515` khởi tạo vùng vẽ -> 528 | `528` -> 529 | `529` BtlBattleInit 0x800ff4d4 | `530` 0x800ff9d4 (chuẩn bị mỗi khung) |
`531` tick hai motion, nếu `ctx+0x4c==0` thì `ctx+0x9c=-1`, `ctx+0x8a=0`, -> **16** (0x800fa588, chọn hành động/đòn kế) | `560` BtlApproachSetup 0x800ffeec |
`576` **bộ điều phối pha 0x8010031c** | `584` 0x801013b0 (nạp timer đòn, M0_7, PartFx) | `585` 0x801037e0 (xử lý trúng đòn: tint, hiệu ứng, camera) | `586` 0x801045bc |
`587` tick hai motion + máy trạng thái `ctx+0x234` (1/2/3) dùng TintStep 0x80109a68 | `592` (`ctx+0x70==13` -> motion lấy từ bảng byte 0x80163de8, âm 42; `==14` -> M0_11, âm 291/44) -> 593 |
`593` 0x80104fc4 | `595` chép x của participant 1 sang 0 -> 596 | `596` 0x801052bc | `80` 0x80104c7c | `4` 0x800fe8e4 (BtlFrameDraw) | các trạng thái 64..205, 238..255, 385..511 = cảnh sự kiện/menu (chưa đọc, không thuộc trận thường).
Hàm trợ giúp: `0x80151574` GetPart(base, i) | `0x801515e4(part, trục)` vị trí có cộng đường đi | `0x8010aa04(ctx, &out, x, y)`: `sx = x - (cam_x - 160)`, `sy = cam_y - y` | `0x80111ce8()` đọc cờ toàn cục `0x80163e38` (đặt bởi 0x80111bbc; chỉ quyết định có kẹp camera hay không).

**BtlApproachSetup 0x800ffeec** (idx = ctx.byte[0x88] = bên TẤN CÔNG; `rec = *(part+0)` = con trỏ BSET):
`ctx.word[0]==1 -> 584 (không phi, ctx+0xb8=1)`; `==4 -> 592`; `==2 -> 595`; ngược lại: cờ bset 0x200 (bay) hoặc `ctl[0x6bf0+0x18] < 2` hoặc loại đòn 6 -> 584 (không phi).
Còn lại tính khoảng trống như mục 7.2 (<=0 -> 584).  Nếu `ctx+0x214 + ctx+0x218 != 0` thì **ghi đè BSET+0x0e**: 3 hoặc 9 -> 8; 4 giữ; khác -> 0.
Rồi: loại 1 + có M0_7 -> BtlMotionStart(7), tốc độ = 32767/(5*spd), `ctx+0x272=0`; loại 8 -> M0_0; loại 3 -> M0_10 (nếu có); còn lại **M0_1**.  Cuối: `ctx+0x27c=0` (t), `+0x27f=0` (pha con), `+0x60=10`, scale (part+0xc4/0xc6)=4096,
`+0x274/+0x276` = (x,y) đầu, `+0x278/+0x27a` = (x + dấu*khoảng trống, y) với dấu = -1 nếu attacker idx==0 (đứng PHẢI màn hình), +1 nếu idx==1; loại 3: `+0x27a = bset+0x08`; `ctx+0x308=1`; trạng thái 576.
(Hàm 0x80109350 gọi ở đây chưa đọc hết: nó là chỗ kích hoạt **vệt ảnh**, mục 7.3.)

**BSET+0x0e = "loại đòn"** (dữ liệu tĩnh trong BSET, không phải trạng thái runtime).  Kho hiện có: 0 = mọi bộ binh/kỵ binh/cung (BU002, 016, 027, 038, 048, 051, 052, 058, 061, 081, 171, 172, 185, 188, 190, 196, 198, 207, 212, 218, 224, 230, 233), 4 = BU201, BU204, 6 = BU004, BU030 (phép).
Bảng nhảy 22 mục `0x800f13b8` của 0x8010031c: loại 0, 5-7, 10-19 -> 0x80100424; 1 -> 0x80100534; 2 -> 0x80100624; 3 -> 0x80100b3c; 4 -> 0x801007e4; 8 -> 0x80100960; 9 -> 0x80100ab8; 20 -> 0x80100b94; 21 -> 0x80100d0c.
Đuôi chung (0x80100e74): ghi (x,y) mới vào part+0x8c/0x8e; nếu cờ `sp+60 == 0` gọi `0x801091d4(ctx, bên bị đánh, dx, dy)` (camera đi theo, xem dưới); nếu xong (`s7`) -> đặt x,y = `ctx+0x278/0x27a`, **trạng thái 584**, `ctx+0xf0=0`.
- **Loại 0 (mặc định)**: tick đầu, nếu `part+0xf8 != 0` (do `ctx+0x308` chép sang) phát âm theo loại tầm (39/40, 44(+40), 41/42; mục 7.3) rồi xoá cờ; mọi tick: `t += ctx+0x270` (kẹp 32767, đặt cờ xong), `TmLerp(pos, ctx+0x274, ctx+0x278, t)`.
- Loại 1 (0x80100534): như trên nhưng có cổng chờ cờ delay/`ctx+0x272`, đường **Bézier**.
- Loại 2 (0x80100624, pha con `ctx+0x27f`): 0 = ép dẹt (`scale_x += 409`, `scale_y -= 409`, `part+0xb4=1`, 10 tick) -> 1 = vươn (`scale_x -= 1024` kẹp 1..8192, `scale_y += 1365` kẹp 1..12288, 10 tick) -> 2 = TmLerp về `ctx+0x278` -> 3 = trả scale (`+1024/-1365`, 10 tick, rồi `part+0xb4=0`).  Chưa unit nào dùng.
- Loại 4 (0x801007e4): chờ cờ delay (evt 0x10); khi bật: âm theo loại tầm, `ctx+0x27f=1`, rồi mỗi tick đếm lùi + một bước `TmLerp` (tiến từng nhát, đòn bồi nhiều nhịp).  BU201/BU204.
- Loại 3 (0x80100b3c): phát âm **52** khi `part+0xf8`, khi motion kết thúc -> loại 20.  Loại 20 (0x80100b94): camera bám bên bị đánh (`ctx+0xac = clamp(x đối thủ, ±160)`, `ctx+0xae = 160`), bắt đầu M0_1 tại (x kẻ địch, y), đặt điểm đầu/cuối.  Loại 8 (0x80100960)/9 (0x80100ab8): kéo camera dọc `ctx+0xae` 160 <-> 240 (±2/tick) cùng nội suy.  Loại 21 (0x80100d0c): cung Bézier (mục 7.3).  (3/8/9/20/21 = tầm xa/phép; chưa có unit nào trong kho dùng.)

**Camera đi theo khi phi tới: `0x801091d4(ctx, other = bên bị đánh, dx, dy)`** (ĐÃ ĐỌC và ĐÃ ÁP):
`w = other.bset+0x0a + 40`, `h = other.bset+0x0c / 2`; `(sx, sy)` = vị trí màn hình của `other` (0x8010aa04).  Nếu `sx < w` hoặc `sx > 320 - w`: `cam_x += dx` (dx = x mới - x cũ của bên ĐANG PHI), nếu cờ 0x80163e38 == 0 thì kẹp ±160.  Nếu `sy < h` hoặc `sy > 160 - h`: `cam_y += dy`, kẹp 160..240.
Bố cục cận chiến mặc định: bên bị đánh ở sx = 260 hoặc 60 nên camera bám ngay từ đầu, NHƯNG chỉ cho tới khi bên bị đánh trượt vào vùng giữa (sx <= 216 hoặc >= 104); sau đó camera dừng và bên phi chạy tiếp trên màn hình.  Với khoảng trống 136: camera đi khoảng 44 px, hai bên kết thúc cách nhau 64.  Hết phi camera ở nguyên chỗ (người dùng xác nhận: đánh xong KHÔNG quay về, đứng tại chỗ).  **ĐÃ ÁP** trong stage.js (`followCamera`, test).
Camera còn bị đổi trong 0x80100f18 (cùng kiểu 0x801091d4), 0x801020c0, 0x80103088, 0x801037e0 (bám theo khi ai đó sát mép; lưu camera ở `ctx+0xb0/0xb2`, `ctx+0x9c`).  Camera chỉ còn các lần bám theo trong 0x80100f18/0x801020c0/0x80103088/0x801037e0 (hit/đòn bồi/phản công) chưa đọc; không có bước "quay về" vì sau đòn hai bên đứng yên (người dùng xác nhận).

**Trạng thái 584 `0x801013b0` (đã đọc 0x801013b0..0x80101930; còn phần sau)** - attacker part = GetPart(ctx.byte[0x88]), defender = GetPart(1 - idx), `rec` = ctl[0x6bf0 + 4*idx + 4] (bản ghi unit; byte +0x5e = lớp; `rec + 0x20 + 4*n` = từ vũ khí, n = ctl[0x6bf0 + 4*idx + 0x24]).
- Mở đầu: gọi 0x80100f18 (nếu trả 0 -> nhảy thẳng 0x80101de8, bỏ qua); đặt `ctx+0xbc=+0xd0=+0x220=+0x30c=0`, `+0x100=-1`, `+0x234=+0x238=0`; `ctx.word[0] != 0` (đòn đặc biệt) -> 0x80101ad8.
- Đòn thường: bset.flags0 & 4 = KHÔNG (cận chiến mọi unit trong kho): `0x8010108c(...)` (nếu trả != 0 thì bỏ qua motion), rồi **bit0 của `ctx+0x214+4*idx` == 0 -> M0_11 với đếm `ctx+0x21c = bset+0x14`; == 1 -> M0_12 với đếm `bset+0x16`** (khớp phần đã port: M1_0 / M1_1).  `ctx+0x304 = 0`.
- Đọc lệnh kịch bản: `0x801118b4(ctl+0x6bf0)` = lệnh đang xử lý; **lệnh 1** (+ bset flag 4 hoặc chế độ ctl[0x18]==... và `fp == 0`) -> attacker chạy **M0_19 (= M1_8, chí mạng)** (0x80101868).  Phần sau 0x80101930 chưa đọc (còn chí mạng/né/đòn bồi).
- **Vệt ảnh KHÔNG áp cho đòn thường**: `BtlPartFx(attacker, 3 nếu ctx+0xe4 else 2)` + `flags0 |= 0x800` + `col24 = 0x985050 (e4) / 0x709070 (e8)` chỉ chạy khi `ctx+0xe4 != 0 || ctx+0xe8 != 0` (và 0x80026ec8(từ vũ khí)==0, tầm 0).  `ctx+0xd4/0xd8/0xdc/0xe0/0xe4/0xe8` được 0x80104c7c (trạng thái 80 = bộ đọc kịch bản trận) bật theo mã lệnh: `0 -> d4`, `3 -> d8`, `4 -> e0`, `10 -> dc`, `1 -> e4`, `9 -> e8` (126 = kết thúc, 127 = xoá hết; mã > 10 bị kẹp 10; phát âm 28 (100,100) khi nhận lệnh).  => vệt ảnh chỉ có với **lệnh 1 và 9** (kỹ năng/đòn đặc biệt), bản web chưa có khái niệm này.
**Trạng thái 585 `0x801037e0`** (đã đọc đầu): có máy trạng thái con ở `ctx+0x234` (1/2/3...) dùng `TintStep(bset.byte+0x10)` (0x80109a68) để dần tối/sáng nền; camera bám lại bằng `ctx+0xb0/0xb2`; rất nhiều lệnh phát âm 0x80035be8 (8 chỗ) và hiệu ứng 0x8010ac34/0x8010ac7c/0x8014c570 (chưa đọc).  Cần đọc nốt để biết: phản ứng bên bị đánh (motion/lùi/rung), nháy trắng, âm trúng đòn.

### 7.4 Cấu trúc dữ liệu (đã xác nhận bằng dữ liệu thật)
- **BSET.DDD**: +0x00 u32 flags0 (0x200 = bay? tắt bóng; 0x800 = vệt bán trong suốt; 0x1000 = vệt chỉ 1 kênh; 0x4/…); +0x06 s16 x (=100 ở mọi unit đã đọc); +0x08 s16 y (38..58 tuỳ unit: mounted 56-58, bộ binh 42, BU171/172 = 57);
  +0x0a s16 độ rộng (=64); +0x0c u16 (dùng trong cung Bezier); +0x0f u8 tốc độ phi (BU016:3, BU027:5, BU051:3, BU004:0, BU052:3); +0x10 u8 bước tint; +0x11 u8; +0x12 u8 mask12 (cờ vệt theo motion; BU004 = 0);
  +0x14/+0x16/+0x18 u16 tick trúng (M1_0/M1_1/M1_8; ví dụ BU016 39/19/34, BU027 16/..., BU051 41, BU212 11, BU004 108, BU052 70/29/64); +0x1a u16 n_bas; +0x1c u16 art_info; +0x1e u16 n_pose; +0x20 u16 (xoá lúc init); +0x24 u32 col24 (màu vệt).
- **Motion .D (1192 byte)**: u16 length @0; 4 kênh x 0x128 từ +4: `active u32 @0`, `off_x s8 @4`, `off_y s8 @5`, `z u16 @6`, 12 bản ghi x 10 byte @8
  {flags, next, delay, repeat, back s8, counter, pose, evt, extra s16}, 20 khoá x 8 byte @0x80 {a s16, b s16, c s16 (góc), dur s16}, `loop_path @0x120`, `mode @0x121` (0 Bezier, 1 spline, 2 tuyến tính, >=3 giữ),
  `nkeys @0x122`, `delay_cnt @0x123`, `key_cur @0x124`, `rec_cur @0x125`, `key_t s16 @0x126`; link[4] @0x4a4 (số motion nhóm 2: slot 22 + n-1).
  Cờ bản ghi: bit0 vẽ, bit1 lặp `repeat` bản sao, bit2 bán trong suốt, bit3 co giãn `extra`, bits4-5 ABR (<<1), 0x40 xoay Y 180, 0x80 xoay X 180 + đảo mirror.
- **Pose**: u16 n; n x {u16 tile (bit 0-9 chỉ số ô, bit 10-15 nhóm trang), u8 x, u8 y} (đơn vị ô 8 px).
- **AR (container)**: u32 count; {u32 offset, u32 size, char name[16]}[count]; dữ liệu.  Gói `BU<nnn>.pak` của dự án = AR gộp BU1/.ARS + BU2/.AR + BU3/.ART của unit (chỉ giữ BSET, POS.BAS/EXT, CLUT.TIM, B*.DDD, M*.D).
- **Bảng chung (common.json, trích từ B.BIN/exe)**: `vramTable` 6 mục (x,y) tại 0x80166854: `[[640,0],[768,0],[896,0],[448,256],[768,256],[896,256]]`; `shadowPts` 13 điểm tại 0x80166890; `motionTbl` 8 byte tại 0x80166888; `rsincos.bin` = 4096 u32 tại exe 0x800c491c.
- **Đĩa** (ISO9660, thư mục gốc): `B.BIN` (overlay trận, 486.465 byte, tới 0x80167c49), `E.BIN` 18 KB, `G.BIN` 171 KB, `H.BIN` 65 KB, `J.BIN` 467 KB, `T.BIN` 33 KB (có chuỗi "MAP %d/%d"), `SLPS_031.77` (exe), `CDBOOT38.BIN`, `EMBLEM.FAT`...
  Thư mục: `/BU1` (.ARS) `/BU2` (.AR) `/BU3` (.ART) = unit trận; `/BBG` (936 AR ~45 MB: BG<nn>P1..P6, SP1, SP2 cho 99 nền; EP1/EP2 cho 24; thêm họ BH00..BH11), `/EBG` (146), `/BM1`, `/U1` (1490 AR ~17 MB, nghi sprite unit ngoài map), `/GU` (223 .DAT), `/SG` (.ARI), `/MB1`,`/MG1` (.MES văn bản), `/MOV`, `/S` (~202 MB âm thanh), `\SB\UPAL%03d.TIM` (đường dẫn thấy trong mã BtlLoadUpal; chưa liệt kê thư mục /SB trên đĩa).  Chức năng `/BM1`, `/U1`, `/GU`, `/EBG` mới là suy đoán từ tên/kích thước.

---------------------------------------------------------------------------------------------------
## 8. Phần do MÌNH TỰ DỰNG (không phải game) - cần thay khi decomp xong

| Phần | Hiện tại | Sẽ thay bằng |
|---|---|---|
| Nền sân khấu | 2 mảng màu (trời 0x263b55, vạch 0x8c9a9e, đất 0x182337, chân trời y=128) | BtlBgDraw + dữ liệu /BBG |
| Bù tâm hình (`Actor.shift`, `_idleCenter`) | đo thế đứng chờ rồi dịch để tâm hình rơi đúng ±100 (ảnh gốc lệch tâm tới ~20 px; BU002 từng bị cắt mép) | bỏ nếu game không bù (game dùng gốc ảnh) |
| Bên tấn công đứng trái (participant 1) | cố định | theo `ctl[0x6bf0+0x1c]` |
| Bố cục | luôn "cận chiến mặc định" | bảng BtlSetupLayout theo loại tầm/chế độ (cần record lớp: 0x8002f89c) |
| Phản ứng trúng đòn | nháy sáng + giật lùi bằng tween (9/14 px) | motion/logic của game (chưa tìm) |
| Né | motion M0_4 nếu có, ngược lại tween | logic game |
| Hit-stop, rung camera | `freeze` 45/65 ms, `cameras.main.shake` | (chưa rõ game có không) |
| Tốc độ tick | 60 Hz (`PS1_TICK_MS`) | chưa biết từ mã; sheet cũ của dự án dùng tickMs 20 (50 Hz) |
| Âm thanh | `playStrikeSfx(result)` kiểu cũ; death SE 38 chỉ có hook `onSound` | SE 38..44 theo bảng mục 7.3 |
| HUD (tên, HP, thông điệp) | khung riêng của dự án | HUD game gốc (chưa nghiên cứu) |
| Phi tới | trục ngang, TmLerp tuyến tính (đúng loại đòn 0) + camera đi theo (mục 7.5) | camera bám trong lúc trúng đòn/đòn bồi (chưa đọc) |
| Quay về / đứng sau đòn | đứng nguyên tại chỗ sau đòn (không lùi về) | pha 2/3/4 của 0x8010031c |

---------------------------------------------------------------------------------------------------
## 9. Lỗi đã gặp và đã sửa (để không lặp lại)

1. **CLUT đè VRAM** (video): mình đặt CLUT ở (640, 300/301) -> trùng vùng trang texture của participant 1 (x 768..895, y 256..383) -> bên trái mất 128/256 màu (ngựa xanh lơ, mất mảng).
   Sửa: CLUT ở (0, 507+slot) đúng game.
2. **Ô HP đảo bên khi phản công**: `strike()` gọi `updateHP(người đánh, người bị đánh)`; sửa bằng `this.sides = [atk, def]` cố định theo trận.
3. **Bảng `facing` ghi bằng mắt sai** (BU002, bộ binh kiếm quay lưng vào địch).  Sửa: dùng cơ chế game (mục 7.2 Hướng nhìn).
4. **Hai bên đè nhau**: do khoảng áp sát tự chọn (105 -> 130).  Sửa: công thức thật (tâm cách 64).
5. **Trận trộn engine** (video, trận 3 dùng sheet cũ): sửa bằng việc thay toàn bộ unit.
6. Mốc ban đầu "thời điểm trúng đòn" là ước lượng 40% độ dài; thay bằng BSET.
7. Cách làm sai ở lượt đầu: sinh sheet frame render sẵn (`import_decomp.py`) - đã xoá.
8. Kết quả không chạy được trên trình duyệt thật; test dùng Phaser giả (`fakeScene` trong tests/tearring.test.mjs) - **không thay thế thử thật**.
Mẹo kỹ thuật: shell không có `time`; `node --check` OK với ES module (Node 22); `export_anim.py` ghi đè `animations.json` theo unit; `ImageData` cần `Uint8ClampedArray`; Phaser canvas texture 1 frame nên frame 0 hợp lệ.

---------------------------------------------------------------------------------------------------
## 10. Việc còn lại (thứ tự ưu tiên đề xuất)

0. (Người dùng đã tự test bản trước, không báo lỗi.)  **Người dùng test trên trình duyệt** các luồng: đánh thường, đánh bồi, chí mạng, trượt (né), hạ gục, phản công, nhiều trận liên tiếp, token map (hướng, kích thước), và báo lỗi/ảnh.
1. (ĐÃ xong các pha của 0x8010031c, mục 7.5.)  Đọc nốt `0x801013b0` (584), `0x801020c0` (timer +0x21c, chuỗi đòn/đòn bồi/phản công), `0x80103088`, `0x801037e0` (585), `0x801045bc`, `0x80104fc4`, `0x801052bc`, `0x80100f18`, `0x80109350` (vệt ảnh):
   mục tiêu = (a) camera sau đòn/quay về, (b) [xong: người dùng xác nhận đánh xong KHÔNG quay về, đứng tại chỗ] (c) vệt ảnh (BtlPartFx 2/3 + màu 0x985050/0x709070), (d) âm 39-44.  Cách nhanh hơn đọc tay: **chạy 0x801065b8 trong emulator** (`files/emu.py`; part dựng như `export_anim.py: build_case`) rồi ghi quỹ đạo; cần dựng ctl/ctx (ctl+0x6bf0 mảng con trỏ bản ghi unit, ctx+0x70/0x214/0x218/0x234...).
2. **Bản ghi lớp (0x8002f89c)**: trích bảng từ exe, ánh xạ vũ khí của dự án -> loại tầm; áp bảng BtlSetupLayout (cung/phép: cam ±160/y 240, lệch 64/88...).
3. **Hiệu ứng phép**: khối vẽ riêng của BtlFrameDraw (0x800314ec, 0x8013984c, 0x8013a434, 0x8004f1a8, 0x80050aec, 0x80142dc4) và tài nguyên /E /G (E.BIN, G.BIN?); sự kiện 0x02 (cờ 0x80163e00) và TintStep.
4. Tìm nơi game chọn bên tấn công (ctl[0x6bf0+0x1c]); xử lý đòn bồi/phản công đúng thứ tự game.
5. **Background**: đọc 0x80109e0c (BtlBgDraw) + định dạng /BBG (AR chứa TIM/lớp?), hai lớp, cuộn/rung; chọn nền theo địa hình (hàm gọi 0x8013b360/0x8013fcd4).
6. **Map** (T.BIN? J.BIN? "MAP %d/%d"), /BM1, và **sprite đi trên map** (/U1, /GU); thay token tĩnh bằng animation đi bộ.
7. HUD trận gốc; âm thanh (/S).  Xác định tick rate thật (so với video chơi game gốc).
8. (Tuỳ chọn) Dựng **harness emulator MIPS** (`files/emu.py`, `vm.py`): chạy 0x8010031c với ctl/ctx dựng sẵn và ghi quỹ đạo.  Đã cân nhắc nhưng hoãn vì cần biết hết trường ctx;
   sau khi đọc 0x800ffeec/0x8010031c đã biết nhiều trường: +0x88 hướng, +0x14 trạng thái, +0x21c timer, +0x270..0x27f nội suy, +0xe4 phe/màu vệt.
9. Fuzz các hàm đọc từ mã máy bằng emulator (như README của bộ decomp đã làm) để nâng từ "đọc" lên "đã kiểm chứng".

### Cách ghép ảnh từ dump thô (mẫu)
```python
from PIL import Image
raw = open('/tmp/pairs.rgba','rb').read(); w,h = 320,160
n = len(raw)//(w*h*4); im = Image.new('RGB',(w*4,h*((n+3)//4)))
for i in range(n): im.paste(Image.frombytes('RGBA',(w,h),raw[i*w*h*4:(i+1)*w*h*4]).convert('RGB'),((i%4)*w,(i//4)*h))
im.save('/tmp/out.png')
```

---------------------------------------------------------------------------------------------------
## 11. Lệnh hay dùng

```
for f in tests/*.mjs; do node $f; done                                 # toàn bộ test
node tests/tearring.test.mjs                                            # test engine/stage
find js -name "*.js" | xargs -n1 node --check                           # cú pháp
node tools/verify_tearring.mjs 16 M1_0 /tmp/js.bin [shadow] [side]      # chạy engine, dump crop
python3 tools/compare_tearring.py /tmp/ref/BU016 /tmp/js.bin M1_0       # so với bản mã máy (ref từ export_anim.py)
python3 tools/tearring_extract.py --bin tearingsaga.bin --units 16 38   # thêm unit vào assets/tearring
node tools/dev/evd.mjs BU016                                            # sự kiện từng motion
```
Thêm unit mới: xem `ADD_CHARACTER.md` (trích -> khai báo `TEARRING_UNITS` -> gán `trUnit` trong `data/units.js`).

---------------------------------------------------------------------------------------------------
## 12. Lịch sử thay đổi (theo thứ tự thời gian)

1. Hiểu sai ý: sinh sheet frame render sẵn từ `files/out/BU*` + `import_decomp.py` (sau đó xoá).
2. Đọc bộ decomp; port toàn bộ engine sang JS (`psx/path/archive/motion/draw/gpu/unit`), trích dữ liệu đĩa (`tearring_extract.py`), `verify_tearring.mjs` + `compare_tearring.py`.
   Khớp từng byte BU004/030/052; dựng `stage.js` + `TearRingBattleScene`; nối BootScene/BattleScene (đường rẽ nhánh khi cả hai bên có `trUnit`).
3. Phân tích video: phát hiện lỗi CLUT, HP đảo, đè nhau, trộn engine.  Người dùng yêu cầu chỉ liệt kê, rồi đồng ý lộ trình decomp.
4. Decomp: BtlPartFx, BtlPartPlace (đọc), BtlUnitInit, BtlLoadPages, 0x80151aec, BtlLoadUpal, PalKeyToVram; sửa CLUT (0,507+slot), lật trang participant 1, hook partFx.
5. BtlEvt_* (sự kiện motion), TintStep, BtlBgLoad (chỉ ghi chú), BtlFrameDraw (đã port máy trạng thái biến mất), BtlBattleInit + BtlSetupLayout (vị trí/camera thật).
6. Người dùng yêu cầu thay toàn bộ unit: khảo sát 621 unit, chọn roster, trích 27 gói, token map bằng engine, xoá hệ cũ, đổi scene thành `BattleScene`, test mới.
7. Tick trúng đòn từ BSET; bỏ bảng `facing` (cơ chế game); tối nền chí mạng (evt 0x40/0x20); phi tới theo công thức game (`Actor.dash`).
8. Checkpoint này: `HANDOFF.md`, `tools/decomp`, `tools/dev`.
9. Phiên 2: người dùng tự test, không lỗi.  Dựng lại `tools/decomp/extracted` từ đĩa.  Đọc bản đồ trạng thái 0x801065b8, BtlApproachSetup, toàn bộ pha của 0x8010031c, camera đi theo 0x801091d4; phát hiện BSET+0x0e = loại đòn.
   Sửa đường phi tới: Bézier -> TmLerp tuyến tính cho loại đòn 0 (stage.js) + test.  Camera đi theo ĐÃ áp (chỉ bám khi bên bị đánh sát mép).  Người dùng xác nhận: sau đòn KHÔNG quay về chỗ cũ.
