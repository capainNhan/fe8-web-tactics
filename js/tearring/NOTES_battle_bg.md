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

## Bộ điều phối: các phát hiện (đọc từ mã máy; ĐÃ ÁP: thời điểm trúng đòn)
- Danh sách motion mà điều phối bắt đầu qua `BtlMotionStart(part, n, x, y)` (y = -1 nghĩa là "gọi BtlPartPlace thay vì đặt vị trí"):
  0 chờ, 1 phi tới, 2 (sau 50% quãng phi), 4 né, 7 và 10 và 8 (chưa rõ), 11/12 đòn đầu/đòn sau (11 + (bit0 của cờ lượt)),
  19 chí mạng.  Khớp với vai trò mà BattleScene đang dùng.
- **Thời điểm trúng đòn: BSET u16 +0x14 (M1_0), +0x16 (M1_1), +0x18 (M1_8)**, nạp vào bộ đếm ctx+0x21c lúc bắt đầu đòn.
  Kiểm tra bằng hình: vệt chém / chớp phép xuất hiện đúng tick đó (BU016 39, BU027 16, BU051 41, BU212 11, BU004 108);
  và với cả 27 unit trong kho giá trị đều nằm trong độ dài motion (tests/tearring.test.mjs).
  Evt 0x01 trong motion chỉ là các nhát phụ (bản kỹ năng/phép).
- Điều phối bật vệt ảnh cho đòn cận chiến: `BtlPartFx(part, 2 hoặc 3)` + `bset.flags0 |= 0x800` +
  `bset.col24 = 0x00985050` (khi ctx+0xe4 != 0) hoặc `0x00709070` (ngược lại), điều kiện: bset.flags0 & 4, loại tầm đánh 0,
  và hàm 0x80026ec8(lớp) == 0.   CHƯA áp.
- Đoạn phi tới dạng cung (0x80100c20..0x80100ee0): điểm đầu = x - dấu*(w_A + w_B + 50) (w = bset+0x0a), y = bset+0x0c + 240;
  điểm cuối = (-x_đối thủ ?, 240); đường Bezier 4 điểm (TmBezier) với tham số t chạy 0..32767, tốc độ = 32767 / (10 * bset[0x0f])
  mỗi khung; qua 50% đổi sang M0_2; qua 75% giảm tốc 409/khung tới sàn 163; xong thì đặt trạng thái 3 và vị trí cuối.
  Có nhiều nhánh phi tới khác theo loại tầm/chế độ -- mới đọc một nhánh, CHƯA áp.

## Hướng nhìn (đã chốt bằng mã máy + hình)
- `BtlLoadPages` 0x8014e034: lật trang texture khi `idx == 1`; `BtlFrameDraw` 0x800fe8e4: `side = (idx != 0)`.  Cờ lật `part+0xac`
  chỉ được khởi tạo = 0 (0x8014e254), không có chỗ nào trong vùng điều phối trận thường ghi vào nó.
- => hướng nhìn KHÔNG phụ thuộc unit.  Mọi ảnh gốc quay sang TRÁI: participant 0 đứng bên phải (x = +bset.x, không lật) nhìn trái,
  participant 1 đứng bên trái (x = -bset.x, lật trang + side 1) nhìn phải.  Vệt chém/cung chém của mọi unit trong kho đều rơi về phía trước
  mặt khi xếp theo quy ước này (đối chiếu bằng hình ghép 12 cặp).
- Bảng `facing` ghi tay trước đây SAI với BU002 và bộ binh kiếm (khiến chúng quay lưng vào địch); đã bỏ.

## 0x8010031c  máy trạng thái phi tới / ra đòn (767 lệnh; mới đọc cấu trúc, CHƯA port)
Tham số: (ctl, ctx, ?, cờ).  Hướng: `fp = (ctx.byte[0x88] != 0) ? +1 : -1` (chỉ số bên tấn công; bên 0 đứng phải nên tiến về -x).
Pha của unit = byte `part+0x0e`, nhảy theo bảng 22 mục ở 0x800f13b8:
  pha 1 -> 0x80100534   | pha 2 -> 0x80100624 (có pha con ở ctx+0x27f: 0..3) | pha 3 -> 0x80100b3c
  pha 4 -> 0x801007e4   | pha 8 -> 0x80100960 | pha 9 -> 0x80100ab8 | pha 20 -> 0x80100b94 | pha 21 -> 0x80100d0c (cung Bezier)
  các pha còn lại (0,5,6,7,10..19) -> 0x80100424 (chỉ phát âm đòn rồi cộng tiến độ).
Chuyển động nội suy bằng tiến độ t (ctx+0x27c, 0..32767) += tốc độ (ctx+0x270); vị trí = TmLerp (0x80059db8) hoặc TmBezier
(0x80059a04) giữa điểm đầu (ctx+0x274, +0x276) và điểm cuối (ctx+0x278, +0x27a).
Âm đòn (0x80035be8(id, 100, 100)): loại tầm 0 -> 39 hoặc 40 (flags_lớp & 4 -> 40); loại 1 -> 44 (+40 nếu flags & 4); loại 2 -> 41 hoặc 42 (flags & 0x80 -> 42).
Còn lại cần: bản đồ pha -> loại đòn (cận chiến/phép/cung), nơi đặt tốc độ/điểm đầu/điểm cuối của từng pha.
Hướng đi hợp lý nhất: chạy chính hàm này trong bộ giả lập MIPS (files/emu.py) với cấu trúc ctl/ctx dựng sẵn và ghi lại quỹ đạo part.x/y +
các lần gọi BtlMotionStart, thay vì đọc hết 767 lệnh bằng mắt.

## Cờ sự kiện và tint (đọc thêm; ĐÃ ÁP: tối nền khi chí mạng)
- Hai cờ do `BtlChanStep` ghi: 0x8016687c = g_BtlHitFlag (evt 0x01), 0x80166884 = g_BtlEvtDelay (evt 0x10, giá trị = delay của bản ghi).
  Điều phối đọc/xoá chúng qua 0x801517c4/0x801517d4 và 0x801517e4/0x801517f4.  Các hàm nhỏ khác ở 0x80151574 (GetPart = base + 200 + 264*i),
  0x8015179c / 0x801517b0 (lưu / khôi phục vị trí part.x,y vào +0xe8,+0xea).
- Trong dữ liệu motion, chỉ đòn chí mạng M1_8 có sự kiện: evt 0x01 + 0x40 ở tick ~2 (nền tối đi một nửa), evt 0x01 tại tick trúng thật,
  evt 0x20 ở cuối (trả nền).  Các đòn thường M1_0 / M1_1 và M0_x không có sự kiện nào (BU016, BU027, BU051).
- TintStep (0x80109a68) đưa tint hiện tại về đích 0x80166dfc (mặc định 0 trong ảnh B.BIN) với bước = BSET byte +0x10 (BU016: 1,
  BU004: 2, BU052: 6), gọi ở các pha 0x80103908 / 0x801046ac / 0x801089ac.  Chưa biết khi nào đích khác 0 -> chưa áp.

## 0x800ffeec  BtlApproachSetup + pha 1 của 0x8010031c  (ĐÃ ÁP vào stage.js: Actor.dash)
- Khoảng trống = |xA - xB| - (wA + wB)/2 (w = BSET+0x0a = 64 ở mọi unit đã đọc), kẹp 0..640.  <= 0 thì khỏi phi (trạng thái 584).
- Tốc độ: bset[0x0f] kẹp 1..20 (px/tick); px mỗi tick = khoảng trống / tốc độ (tối thiểu 1); mỗi tick tiến độ t += 32767 / (px mỗi tick);
  tràn 32767 là tới nơi (BU016: b0f = 3, khoảng trống 136 -> 46 tick).  Điểm cuối = x + hướng*khoảng trống.
- Vị trí = TmBezier(đầu, (x0+mid)/2, (x1+mid)/2, cuối) (điều khiển ở 1/4 và 3/4: hơi chậm hai đầu).  Mã gốc đặt điều khiển DỌC = 140 (hằng),
  tức có thể có nhịp nhảy ~60px; CHƯA áp (chưa rõ pha này có dùng cho cận chiến thường không).
- Có nhánh: nếu unit có M0_7 thì thay vì M0_1 chạy M0_7 với tốc độ 32767 / (5 * bset[0x0f]) cố định theo thời gian; pha 8 dùng M0_0, pha 3 dùng M0_10.
- Kiểm tra bằng hình: ở khoảng cách tâm 64 cung chém của BU016/027/002 rơi đúng vào mặt đối thủ; ở 100 thì hụt => đúng quy tắc.
- Cổng chờ: pha 1 chạy khi cờ delay (0x80166884, evt 0x10) bật HOẶC ctx+0x272 != 0 (= khoảng trống) -> cận chiến chạy ngay.
