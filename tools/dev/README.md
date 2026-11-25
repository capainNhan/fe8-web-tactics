# tools/dev - script khảo sát / kiểm tra bằng hình (đã dùng khi chọn unit và kiểm chứng giả thuyết)

Đều chạy bằng node 22 từ thư mục gốc dự án.  Các script cần thư mục `TR_ALL` chứa mọi gói unit:
`python3 tools/tearring_extract.py --bin tearingsaga.bin --all --out /tmp/trall` rồi `TR_ALL=/tmp/trall node tools/dev/<x>.mjs ...`.

| Script | Việc | Ra |
|---|---|---|
| `survey.mjs` | dựng thế đứng chờ của MỌI unit trong TR_ALL | `/tmp/survey.bin` (crop RGBA) + `/tmp/survey_meta.json` (motion, cờ, x, y, độ dài) |
| `atk.mjs <số BU...>` | dựng khung đòn M1_0 tại tick trúng (hoặc 40%) | `/tmp/atk.bin` |
| `hitcheck.mjs` | khung quanh tick trúng của BSET (-10,-5,0,+5,+12) | `/tmp/hit.rgba` |
| `pairs.mjs` | 6 cặp unit trên stage thật (đứng chờ + giữa đòn) | `/tmp/pairs.rgba` (ghép PNG bằng PIL, 320x160 mỗi khung) |
| `evd.mjs <BUnnn...>` | liệt kê sự kiện (hit/delay/e02/e20/e40) từng motion và tick | stdout |
| `facing.mjs`, `pathx.mjs` | đo tầm với của đòn / đường đi kênh 0 của motion | stdout |

Ghép ảnh: các file `.bin/.rgba` là dữ liệu thô, dùng PIL (`Image.frombytes('RGBA', (w,h), ...)`), xem mẫu trong HANDOFF.md mục 9.
