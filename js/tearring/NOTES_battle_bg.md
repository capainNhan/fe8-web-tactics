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
