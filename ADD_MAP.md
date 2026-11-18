# Thêm / sửa bản đồ

Mỗi phần của hệ thống bản đồ nằm trong một module riêng:

| Việc cần làm | File |
|---|---|
| Thêm / sửa loại địa hình (chi phí đi, +phòng thủ, +né) | `js/data/terrain.js` |
| Vẽ hình cho một loại địa hình | `js/systems/map/TerrainRenderer.js` (hàm trong `DRAWERS`, cùng id) |
| Vẽ bản đồ mới (ASCII) và vị trí xuất phát | `js/data/maps/<ten>.js` |
| Chọn bản đồ đang chơi | `js/data/maps/index.js` (`MAPS`, `ACTIVE_MAP_ID`) |
| Luật di chuyển theo địa hình | `js/systems/map/Pathfinding.js` |
| Tra địa hình / chi phí / cộng chỉ số | `js/systems/map/TerrainMap.js` |
| Bảng thông tin ô khi chạm | `js/systems/ui/TileInfoPanel.js` |

## Tạo bản đồ mới
1. Copy `js/data/maps/valley.js` thành file mới, đổi `id`, `name`, `rows`, `spawns`.
2. Trong `js/data/maps/index.js`: import file mới, thêm vào `MAPS`, đổi `ACTIVE_MAP_ID`.

Quy tắc: bản đồ phải **vuông**, cạnh nên là 8, 12 hoặc 16 (chia hết 768).
Bản đồ 8x8 cho ô 96px, 12x12 cho ô 64px, 16x16 cho ô 48px. Game báo lỗi tiếng Việt
nếu hàng sai độ dài hoặc có ký hiệu lạ.

## Ký hiệu
`.` đồng bằng  `=` đường  `F` rừng  `H` đồi  `M` núi  `~` sông  `B` cầu  `#` tường  `T` pháo đài  `V` làng

## Thêm loại địa hình mới
1. Thêm mục vào `TERRAIN` (chọn ký hiệu chưa dùng).
2. Thêm hàm vẽ cùng id vào `DRAWERS` trong `TerrainRenderer.js`.
3. Dùng ký hiệu đó trong `rows`.

## Loại di chuyển
Đơn vị có thể khai báo `moveType: "foot"` trong `units.js` (mặc định `"mounted"`).
Kỵ binh không đi qua núi; bộ binh đi được nhưng tốn 4 điểm.
