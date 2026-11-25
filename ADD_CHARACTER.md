# Thêm unit từ game gốc (TearRing Saga)

Mọi unit (trận đánh và token trên map) chạy bằng engine port từ bản decomp trong `js/tearring/`.
Dữ liệu gốc không sửa, chỉ trích từ đĩa game ra `assets/tearring/BU<nnn>.pak`.

## Các bước

1. **Trích unit từ ảnh đĩa** (cần file `.bin` của game, không có trong repo):

   ```
   python3 tools/tearring_extract.py --bin tearingsaga.bin --units 16 38 51
   ```

   Mỗi số là một mục `BU<nnn>`.  Mỗi số BU = một nhân vật x một kiểu vũ khí.  Bản thường (vd 016) có đòn
   đánh trơn, bản kế tiếp (vd 017) là đòn kỹ năng có hào quang xanh.  Dùng `--all` để trích cả 600+ unit.
2. **Khai báo trong `js/data/tearringUnits.js`:** thêm một dòng vào `TEARRING_UNITS` với
   `shadow`, `kind`, `weapon`, `note`.  Hướng nhìn không cần khai báo: game gốc quay mọi ảnh sang trái
   cho participant 0 và dùng trang texture lật sẵn cho participant 1 (xem `js/tearring/stage.js`).
3. **Gán cho đơn vị** trong `js/data/units.js`: `trUnit: "BU016"`.
4. **Chạy game và thử:** tấn công, bị trượt, chí mạng, đánh bồi, bị hạ gục.

## Vai trò motion (số = nhóm * 11 + khe, `MOTION` trong tearringUnits.js)

| Vai trò | Motion | Dùng khi |
|---|---|---|
| idle | `M0_0` | đứng chờ |
| move | `M0_1` | phi tới địch (lặp) |
| dodge | `M0_4` | bên bị đánh trượt |
| attack | `M1_0` | đòn mở đầu |
| attack2 | `M1_1` | đòn kế tiếp |
| crit | `M1_8` | chí mạng |

Unit thiếu motion nào thì `BattleScene` bỏ qua phần đó (không né thì dùng tween thay thế).
Xem `js/tearring/README.md` để biết phần nào của engine đã được kiểm chứng.
