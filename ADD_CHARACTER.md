# Thêm Char mới vào game

Mỗi nhân vật là một thư mục xuất từ TearRing Compositor gồm `spritesheet.png` và
`spritesheet.json` (file `battle_sprite.js` đi kèm không cần dùng).

## Các bước

1. **Kiểm tra bằng Char Lab.** Chạy server tĩnh trong thư mục dự án
   (vd `npx serve .` hoặc `python3 -m http.server`), mở `char-lab.html`.
   Nhập tên thư mục (vd `Char8`), chọn `spritesheet.png` và `spritesheet.json`, bấm **Phân tích**.
2. **Đọc báo cáo.** Dòng đỏ là lỗi cần sửa. Xem các dải animation bên dưới: ô viền xanh là
   bước "va chạm" mà công cụ đoán. Nếu sai, tự sửa số trong `impact` ở bước 5.
3. **Tải `spritesheet.png` đã làm sạch** (nút trong Char Lab). Công cụ xoá các cụm pixel lạc ở đáy
   mỗi ô (dấu mốc của Compositor, nếu không xoá sẽ hiện thành nhiễu).
4. **Tạo thư mục** `assets/characters/Char8/` và đặt vào đó:
   - `spritesheet.png` (bản đã làm sạch)
   - `spritesheet.json` (nguyên bản, không sửa)
5. **Khai báo trong `js/data/battleSprites.js`:** dán khối Char Lab sinh ra vào `BATTLE_SPRITES`
   (cạnh `Char6`, `Char7`). Các trường:

   | Trường | Ý nghĩa | Khi nào chỉnh |
   |---|---|---|
   | `facing` | hướng nhìn của ảnh gốc, `"left"` hoặc `"right"` | ngựa/nhân vật quay đầu ngược hướng |
   | `scale` | độ phóng to trong battle | nhân vật to/nhỏ hơn Char6/7 |
   | `anchor` | điểm chân (px trong ô frame) | nhân vật bị lệch/lơ lửng so với mặt đất |
   | `rest` | frame giữ giữa các đòn | thế đứng sau đòn trông lạ |
   | `reach` | khoảng dừng cách địch khi lao tới (px, hệ 384) | đứng quá xa hoặc đè lên địch |
   | `roles` | vai trò → mã animation | sheet dùng mã khác `M0_0`, `M1_0`... |
   | `impact` | bước mà đòn chạm mục tiêu (đếm từ 0) | đòn trúng lệch nhịp so với vệt chém |

6. **Gán cho đơn vị** trong `js/data/units.js`: `battleSprite: "Char8"`.
7. **Chạy game và thử:** tấn công, bị trượt, chí mạng, đánh bồi.

## Vai trò animation

| Vai trò | Mã mặc định | Dùng khi |
|---|---|---|
| `idle` | `M0_0` | đứng chờ trước trận |
| `move` | `M0_1` | phi tới địch (lặp) |
| `dodge` | `M0_4` | bên bị đánh trượt |
| `attack` | `M1_0` | đòn mở đầu, bắt đầu từ thế đứng nghiêng |
| `attack2` | `M1_1` | đòn sau khi đã ra đòn hoặc đã né |
| `crit` | `M1_8` | đòn chí mạng |

Thiếu `attack2` hoặc `crit` thì game dùng `attack`. Thiếu `dodge` thì bên né chỉ lách nhẹ.
Thiếu `idle`, `move` hoặc `attack` thì game báo lỗi khi tải.

## Chỉnh nhanh

- Nhân vật bị lệch vị trí: đổi `anchor`.
- Quá to/nhỏ: đổi `scale`. Khoảng cách tới địch: đổi `reach`.
- Vị trí đứng hai bên và độ rộng khung: `LEFT_X`, `RIGHT_X` đầu `js/scenes/BattleScene.js`.
- Kích thước toàn bộ giao diện: `UI_SCALE` trong `js/config.js` (1 = nhỏ, 2 = mặc định, 3 = rất to).

## Lỗi thường gặp

- **Màn hình báo "Sprite CharX: ..."**: đọc tên sprite và nội dung. Thường là chưa khai báo trong
  `BATTLE_SPRITES`, hoặc `roles` trỏ tới mã animation không có trong json.
- **Frame bị cắt sai**: kích thước ảnh không chia hết cho `frameSize`. Char Lab sẽ cảnh báo.
- **Không thấy sprite, không có lỗi**: kiểm tra đường dẫn thư mục và tên file (phân biệt hoa/thường).
- **Mở bằng `file://` bị trắng trang**: game dùng ES module nên phải chạy qua server.
