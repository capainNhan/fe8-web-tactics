
/**
 * TERRAIN (địa hình)
 * Bảng các loại ô trên bản đồ. Muốn thêm địa hình mới:
 *   1. thêm một mục vào TERRAIN (chọn ký hiệu `symbol` chưa dùng),
 *   2. thêm hàm vẽ cùng id trong systems/map/TerrainRenderer.js,
 *   3. dùng ký hiệu đó trong rows của bản đồ (data/maps/*.js).
 *
 * Các trường:
 *   symbol : ký tự dùng trong rows của bản đồ
 *   name   : tên hiển thị
 *   cost   : chi phí di chuyển theo loại di chuyển; null = không đi qua được
 *   def    : cộng phòng thủ cho đơn vị đứng trên ô
 *   avo    : cộng né tránh cho đơn vị đứng trên ô
 */

export const DEFAULT_MOVE_TYPE = "mounted";

export const TERRAIN = {
  plain:    { symbol: ".", name: "Đồng bằng", cost: { mounted: 1, foot: 1 },       def: 0, avo: 0 },
  road:     { symbol: "=", name: "Đường",     cost: { mounted: 1, foot: 1 },       def: 0, avo: 0 },
  forest:   { symbol: "F", name: "Rừng",      cost: { mounted: 3, foot: 2 },       def: 1, avo: 20 },
  hill:     { symbol: "H", name: "Đồi",       cost: { mounted: 2, foot: 2 },       def: 1, avo: 10 },
  mountain: { symbol: "M", name: "Núi",       cost: { mounted: null, foot: 4 },    def: 2, avo: 30 },
  water:    { symbol: "~", name: "Sông",      cost: { mounted: null, foot: null }, def: 0, avo: 0 },
  bridge:   { symbol: "B", name: "Cầu",       cost: { mounted: 1, foot: 1 },       def: 0, avo: 0 },
  wall:     { symbol: "#", name: "Tường",     cost: { mounted: null, foot: null }, def: 0, avo: 0 },
  fort:     { symbol: "T", name: "Pháo đài",  cost: { mounted: 1, foot: 1 },       def: 2, avo: 20 },
  village:  { symbol: "V", name: "Làng",      cost: { mounted: 1, foot: 1 },       def: 0, avo: 10 }
};

// Gắn id cho từng mục để các module khác tra ngược.
Object.entries(TERRAIN).forEach(([id, t]) => {
  t.id = id;
});

export const TERRAIN_BY_SYMBOL = Object.fromEntries(
  Object.values(TERRAIN).map(t => [t.symbol, t])
);

// Chi phí đi vào ô theo loại di chuyển. Infinity = không đi qua được.
export function moveCostOf(terrain, moveType = DEFAULT_MOVE_TYPE) {
  const cost = terrain?.cost?.[moveType];

  return cost == null ? Infinity : cost;
}
