# js/tearring - engine animation trận đấu của TearRing Saga (port từ bản decomp)

| file | port của | ghi chú |
|---|---|---|
| `psx.js` | `libgte_min.c`, `tm_matrix.c` | int32 quấn vòng, GTE (MVMVA), ngăn xếp ma trận |
| `path.js` | `tm_spline.c`, `btl_anim_path.c` | Lerp / Bezier / Spline, `BtlPathEval` |
| `motion.js` | `btl_anim_step.c` | `BtlChanStep`, `BtlChanPathStep`, `BtlMotionTick`, `BtlMotionStart`, `...StartM7` |
| `draw.js` | `btl_draw_chan.c`, `btl_draw_trail.c`, `btl_draw_unit.c` | dựng gói, OT, bóng, vệt ảnh |
| `gpu.js` | (không phải mã game) | VRAM + rasterizer SPRT_8 / POLY_FT4 / POLY_F3 + 4 kiểu trộn PS1 |
| `unit.js` | loader (đọc từ mã máy) | dựng một participant từ `BU<nnn>.pak` |
| `stage.js` | (không phải mã game) | ghép hai participant, chạy tick, vẽ ra canvas Phaser 320x160 |

## Kiểm chứng
`tools/verify_tearring.mjs` chạy engine này, `tools/compare_tearring.py` so từng byte với
`export_anim.py` (chạy mã máy MIPS gốc của B.BIN). Kết quả hiện tại: **toàn bộ motion của BU004,
BU030, BU052 (31 lượt, hàng nghìn tick) khớp 100% từng byte**, kể cả đường vẽ bóng đổ.

## Chưa có (không nằm trong phần đã decomp) -> đều có hook trong `unit.js`
- `BtlPartPlace` 0x80151a4c (đã đọc: `BtlPathEval` kênh 0 rồi x ±= path.x, y += path.y; chưa port) và 0x801515e4.
- Nơi TIÊU THỤ kết quả sự kiện: `0x801099a4` và `0x80109e0c` (đọc `tint` và cờ 0x80163e00). Chưa decomp.
- Xem `NOTES_battle_bg.md`: nạp nền `BtlBgLoad` 0x80109ba4, `TintStep` 0x80109a68. `0x8010aa74` nạp `\BBG\BG%02dEP1.AR` + `EP2.AR` (hai archive nền), `0x8010ab78` giải phóng.
- Palette theo phe: `BtlLoadUpal` 0x8014dda8 nạp `\SB\UPAL%03d.TIM` (208 màu đầu của hàng CLUT) và 16 màu
  phe (`PalKeyToVram` 0x801430c0: x = 256 + 16*(i&3), y = 491 + (i>>2), bảng khoảng khoá 1-46,48-62,64-78,113).
  Chưa biết VRAM vùng (256..319, 491..) được nạp từ tệp nào, nên chưa có màu phe.
- Bộ nạp thứ hai của `BtlUnitInit` (part+0x9c tpage2 / +0x9e CLUT y=509+idx): chưa thấy chỗ dùng.

## Sự kiện của motion (đã đọc từ mã máy)
evt 0x01 -> `g_BtlHitFlag = 1` | evt 0x02 -> cờ 0x80163e00 = 1 | evt 0x20 -> tint = {128,128,128} |
evt 0x40 -> tint >>= 1 (mỗi kênh) | evt 0x10 -> `g_BtlEvtDelay = delay`.  tint 128 = màu nền nguyên bản.
Motion của BU004/BU030/BU052 không dùng 0x02/0x20/0x40 (chỉ unit phép/đặc biệt khác mới có).

## Đã đọc từ mã máy (chưa fuzz với C)
- `BtlUnitInit` 0x8014e208: CLUT.TIM nạp ở (0, 507+idx), motion/BSET/POS trỏ thẳng vào vùng AR.
- `BtlLoadPages` 0x8014e034: trang B1..B6 -> (nhóm = (n-1)/2, nửa trên/dưới); participant 1 gọi 0x80151aec
  (đảo 8 byte mỗi nhóm 8 = lật từng ô) trước khi nạp. Đường vẽ `side=1` đã đối chiếu từng byte với mã máy.
- `BtlPartFx` 0x80151590.
- Bộ điều phối trận (chọn motion nào, lúc nào, vị trí đứng): do `BattleScene` quyết định.
- Tốc độ tick: không suy ra được từ mã; mặc định 60 Hz (`PS1_TICK_MS`), chỉnh qua tuỳ chọn `tickMs`.
