
import {
  TERRAIN_BY_SYMBOL,
  DEFAULT_MOVE_TYPE,
  moveCostOf
} from "../../data/terrain.js";

/**
 * TERRAIN MAP
 * Bọc dữ liệu một bản đồ: tra địa hình, chi phí di chuyển, cộng chỉ số.
 * Hàm thuần, không dùng Phaser, dễ test bằng Node.
 */
export class TerrainMap {
  constructor(mapData) {
    this.id = mapData.id;
    this.name = mapData.name;
    this.width = mapData.width;
    this.height = mapData.height;

    this.grid = mapData.rows.map(row =>
      [...row].map(symbol => TERRAIN_BY_SYMBOL[symbol])
    );
  }

  inBounds(x, y) {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  terrainAt(x, y) {
    return this.inBounds(x, y) ? this.grid[y][x] : null;
  }

  moveCost(x, y, moveType = DEFAULT_MOVE_TYPE) {
    const terrain = this.terrainAt(x, y);

    return terrain ? moveCostOf(terrain, moveType) : Infinity;
  }

  // Cộng phòng thủ / né tránh cho đơn vị đứng tại (x, y).
  bonusAt(x, y) {
    const terrain = this.terrainAt(x, y);

    return {
      def: terrain?.def ?? 0,
      avo: terrain?.avo ?? 0
    };
  }
}
