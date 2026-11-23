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
- `BtlPartFx` 0x80151590: bật vệt ảnh cho motion có cờ `mask12` (ba unit trên đều không dùng).
- `BtlPartPlace` 0x80151a4c, `BtlEvt_8010adb0/adf4/aa50` (evt 0x02/0x40/0x20 của motion).
- Nạp bảng màu theo phe (UPAL), phần nạp trang `B*.DDD` cho participant 1 (`side=1`):
  engine dùng cờ `flip_ac` của game để lật bên phải thay vì `side=1`.
- Bộ điều phối trận (chọn motion nào, lúc nào, vị trí đứng): do `TearRingBattleScene` quyết định.
- Tốc độ tick: không suy ra được từ mã; mặc định 60 Hz (`PS1_TICK_MS`), chỉnh qua tuỳ chọn `tickMs`.
