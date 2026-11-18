
import { TERRAIN_BY_SYMBOL } from "../terrain.js";
import { VALLEY } from "./valley.js";

/**
 * DANH SÁCH BẢN ĐỒ
 * Thêm bản đồ mới: tạo file trong data/maps/, import và đưa vào MAPS,
 * rồi đổi ACTIVE_MAP_ID. Xem ADD_MAP.md.
 *
 * Lưu ý: bản đồ phải vuông, kích thước nên chia hết 768 (8, 12, 16...)
 * để ô vuông đẹp. TILE tự co theo kích thước bản đồ (xem config.js).
 */

export const MAPS = {
  [VALLEY.id]: VALLEY
};

export const ACTIVE_MAP_ID = "valley";

function describe(map) {
  const height = map.rows.length;
  const width = map.rows[0]?.length ?? 0;

  return { ...map, width, height };
}

// Kiểm tra dữ liệu bản đồ, báo lỗi rõ ràng bằng tiếng Việt.
export function validateMap(map) {
  const fail = message => {
    throw new Error(`Bản đồ "${map.id}": ${message}`);
  };

  if (!map.rows?.length) fail("thiếu rows.");

  const { width, height } = describe(map);

  if (width !== height) {
    fail(`phải là bản đồ vuông (đang ${width}x${height}).`);
  }

  map.rows.forEach((row, y) => {
    if (row.length !== width) {
      fail(`hàng ${y} dài ${row.length}, cần ${width}.`);
    }

    [...row].forEach((symbol, x) => {
      if (!TERRAIN_BY_SYMBOL[symbol]) {
        fail(`ký hiệu "${symbol}" tại (${x},${y}) chưa có trong terrain.js.`);
      }
    });
  });

  Object.entries(map.spawns ?? {}).forEach(([id, p]) => {
    const terrain = TERRAIN_BY_SYMBOL[map.rows[p.y]?.[p.x]];

    if (!terrain) {
      fail(`điểm xuất phát của ${id} nằm ngoài bản đồ.`);
    }
  });

  return describe(map);
}

if (!MAPS[ACTIVE_MAP_ID]) {
  throw new Error(`Không có bản đồ "${ACTIVE_MAP_ID}" trong MAPS.`);
}

export const ACTIVE_MAP = validateMap(MAPS[ACTIVE_MAP_ID]);
