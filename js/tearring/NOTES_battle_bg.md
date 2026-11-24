# Ghi chú decomp: nền trận và khung hình trận (đọc từ mã máy B.BIN, CHƯA port, CHƯA fuzz)

## Đĩa: /BBG (936 tệp)
- `BG<nn>P1..P6.AR`, `BG<nn>SP1.AR`, `BG<nn>SP2.AR` với 99 giá trị nn; `BG<nn>EP1.AR`, `EP2.AR` với 24 giá trị.
- Có thêm họ `BH<nn>P1..P6 / SP1 / SP2` (nn = 00..11, chưa biết dùng làm gì).

## 0x80109ba4  BtlBgLoad(bg, bg2, mode2, mode)   (tên tạm)
Ghi: 0x80166de8 = bg, 0x80166dec = bg2, 0x80166df0 = mode2, 0x80166de4 = mode; đặt 0x80163df8 = 0, 0x80166e44 = 0x80166e48 = 1, 0x80163e04 = 0;
0x80166df4 = (mode2 != 1) ("chế độ hai archive").
- mode2 == 1: một archive.  `\BBG\BG%02dP%d.AR` với chữ số = {mode 0 -> 1, mode 1 -> 3, mode 2 -> 5, khác -> 0}.
  Nạp vào slot 0x80166d88 (và 0x800a4d60 cho bản đệm 0x80166e08).
- mode2 != 1: hai archive.  `\BBG\BG%02dSP1.AR` (bg) vào 0x80166d88 và `\BBG\BG%02dSP2.AR` (bg2 nếu khác bg, ngược lại bg)
  vào 0x80166db8.  0x80163e08 = số bg đang dùng.
- 0x8010aa74 nạp `\BBG\BG%02dEP1.AR` + `EP2.AR` (vào cùng hai slot), 0x8010ab78 giải phóng, 0x80163e04 = trạng thái nạp EP.

## 0x80109a68  TintStep(step)  (tên tạm)
Đưa tint hiện tại (0x80166df8..dfa) về tint đích (0x80166dfc..dfe) mỗi kênh tối đa `step`, không vượt đích.
Trả 1 khi đã bằng đích, ngược lại 0.  Cùng cặp (hiện tại, đích) mà evt 0x20/0x40 của motion ghi vào.

## Đích kế tiếp
`0x80109e0c` (dài 0x990 byte, 612 lệnh): hàm đọc tint + cờ 0x80163e00 -- nhiều khả năng là khung hình trận/bộ điều phối.

## 0x800fe8e4  BtlFrameDraw(ctl)  (tên tạm; gọi BtlBgDraw và BtlDrawUnit)
1. Mỗi participant (2) có máy trạng thái biến mất (state s16 @ctl+0x74ac, mức sáng @+0x74b0, đếm @+0x74b2):
   1 -> đặt đếm 20, state 2 | 2 -> đếm lùi, hết thì mức = 255, state 3, phát âm 38 (vol 100,100) |
   3 -> part.f_a8 = f_b8 = blend_bc = 1, part.col_c0 = (mức,mức,mức), mức -= 4, mức < 8 thì state 4, bỏ con trỏ vẽ
   (+ nếu bset.flags0 & 0x200 gọi 0x8010adc0(idx, 0)).   => ĐÃ PORT: stage.js `Actor.die()` (82 tick tổng cộng).
2. BtlBgDraw (0x80109e0c) gọi hai lần: a2 = 0 và a2 = 1 (hai lớp nền), trước khi vẽ unit.
3. BtlDrawUnit lần lượt cho hai participant; participant thứ hai dùng side != 0.
4. Khối thứ hai (khi cờ ctl+0x50 == 0): vẽ hiệu ứng phép của từng participant (mảng con trỏ @ctl+0x6bf4):
   0x800314ec, 0x8013984c, 0x8013a434, 0x8004f1a8, 0x80050aec, 0x80142dc4.  CHƯA đọc.
5. Khi không có trận (ctl+0xa4 == 0, nhánh L_800fed4c): xoá hai nửa vùng (0,0,256,160) và (256,0,64,160) của khung.

## 0x80109e0c  BtlBgDraw(ctx, ot, layer, base)
Cuộn nền với cuộn (0x80166e3c, 0x80166e3e) cộng bước ±1 mỗi khung có dạng rung theo bộ đếm 0x80166e4c
(chu kỳ |v| - 29), điều biến màu bằng tint (0x80166df8..).  Chưa đọc hết (648 lệnh).

## Bản đồ bộ điều phối (hàm gọi BtlMotionStart/Tick/UnitInit/StartM7/PartFx)
0x800fc168, 0x800ff4d4 (BtlUnitInit), 0x800ff9d4 (BtlUnitInit + Tick), 0x800ffeec, 0x8010031c, 0x8010108c,
0x801013b0 (StartM7 + PartFx), 0x801020c0 (StartM7), 0x80103088 (PartFx), 0x801037e0, 0x801045bc, 0x80104fc4,
0x801052bc, 0x801065b8.   Khoảng 0xa500 byte (~10 nghìn lệnh) -- đây là phần "trận diễn ra thế nào".
Nạp nền gọi từ 0x8013b360 và 0x8013fcd4.

## 0x800ff4d4  BtlBattleInit(ctl, params)  (tên tạm; đọc từ mã máy, CHƯA port)
Thứ tự: BtlUnitInit(ctl,1,0) -> BtlUnitInit(ctl,1,1) -> BtlLoadUpal(0, 507) -> cấp 0x8800 byte x2 cho OT (params+0x240/0x244)
-> 0x800ff398 cho từng participant (đọc tài nguyên theo bảng ctl+0x6bf0) -> đặt vị trí đầu:
- participant 0:  x = bset.x(+6) + params.s16[0x2ec],   y = bset.y(+8) + params.s16[0x2f4]
- participant 1:  x = -bset.x(+6) - params.s16[0x2f0],  y = bset.y(+8) + params.s16[0x2f8]
  (đối xứng qua gốc: hai bên cách nhau 2*(bset.x + offset); bset.x = 100 ở mọi unit đã đọc: BU002/004/016/030/052;
   bset.y khác nhau từng unit: 38..58)
- nếu bset.flags0 & 0x200 (unit bay?): gọi 0x8010acb0(idx, bset.u8[0x11]), x tính lại theo nửa độ rộng bset.w(+0xa) và shadow_b0 = 0.
- điều kiện đặc biệt theo lớp unit (byte part.bset-> +0x5e của đối tượng unit: 55, 56, 28) và 0x80026ec8(...) quyết định cờ s0.
- sau đó 0x8015179c(part) cho cả hai, đặt các hằng của params: +0x3a = 480, +0x3c = 570, +0x3e = -320, +0x40 = -230
  (giới hạn camera?), params+0x14 = 530, cờ +0xa4 = +0x8c = +0x44 = +0x48 = +0x98 = 1, +0xfc = 0.
- cuối cùng nạp "1.seq" (nhạc/âm thanh trận) qua 0x800363c4/0x800355ac.
Chưa biết: params+0x2ec..0x2f8 do đâu đặt (có vẻ là khoảng cách/tầm đánh), và giá trị cam_x/cam_y ban đầu
=> chưa suy ra được bên nào đứng trái/phải trên màn hình.

## 0x800fee48  BtlSetupLayout(ctl, ctx)  (tên tạm; đọc từ mã máy, ĐÃ ÁP một phần vào stage.js)
ctx = ctl + 0x73b8 (chính là ctx của BtlDrawUnit): +0xac = cam_x, +0xae = cam_y, +0x2ec/0x2f0 = lệch x của participant 0/1,
+0x2f4/0x2f8 = lệch y, +0x27e = chế độ (copy từ ctl+0x6bf0+0x18).  s2 = ctl[0x6bf0+0x1c] = chỉ số participant TẤN CÔNG;
loại tầm đánh = (record_lớp.word[0x1c] >> 27) & 3 với record lấy từ 0x8002f89c(lớp unit, byte +0x5e).
Bảng cấu hình (chế độ == 1, a0 = ctx.word[0]):
| điều kiện | lệch x (0x2ec/0x2f0) | cam_x | cam_y |
|---|---|---|---|
| chế độ != 1 | 90 và 90 | +160 nếu tấn công = participant 0, ngược lại -160 | 160 |
| tầm == 1 và a0 not in {1,2} | 120 cho participant tấn công | +120 / -120 (như trên) | 160 |
| tầm == 1 và a0 == 1 | -35 và -35 | 0 | 160 |
| tầm == 1 và a0 == 2, hoặc tầm 0 và a0 != 1 (cận chiến mặc định) | 0 | 0 | 160 |
| tầm 0 và a0 == 1 | -35 và -35 | 0 | 160 |
| tầm == 2 và a0 == 1 | -35 và -35 | 0 | 160 |
| tầm == 2 và (a0 == 2 hoặc lớp in {126,131,134}) | 0 | 0 | 160 |
| tầm == 2 khác (cung/phép tầm xa) | lệch x 64 và lệch y 88 cho participant tấn công | +160 / -160 | 240 |
Sau đó đăng ký 0x801099a4 vào tác vụ ưu tiên 15 (0x800367ac), đặt tint = g_BtlEvtArg (128,128,128), ctx+0x14 = 516.
Màn hình: sx = x - (cam_x - 160),  sy = cam_y - y.  Cận chiến mặc định: x = ±bset.x = ±100, cam (0,160), y = bset.y.
Kiểm tra chéo: bóng đổ vẽ ở sy = cam_y - 10 = 150 và móng ngựa render ra gần y 140-148 => cam_y = 160 hợp lý.
Còn nhập nhằng: participant 0 có x = +100 (bên PHẢI màn hình) còn participant 1 bên trái; tức ảnh gốc thường quay sang TRÁI
(BU052 đúng, BU004 quay phải) -- cờ flip_ac của part (+0xac) chắc do bộ điều phối đặt theo unit.
Bộ điều phối chưa dịch chuyển unit trong motion (đường đi kênh 0 của M0_x/M1_x đều bằng 0): đoạn "phi tới" nằm trong code điều phối.
