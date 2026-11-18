
import { GRID } from "../../config.js";
import { getReachableTiles } from "./Pathfinding.js";

/**
 * MAP GRID
 * Các hàm thuần (không dùng Phaser) cho bàn cờ:
 * kiểm tra ô, tìm đơn vị, tầm di chuyển, mục tiêu có thể đánh.
 * Dễ test bằng Node vì không phụ thuộc giao diện.
 */

export function inBounds(x, y) {
  return x >= 0 && x < GRID && y >= 0 && y < GRID;
}

export function distance(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function unitAt(units, x, y) {
  return (
    units.find(
      u => u.hp > 0 && u.x === x && u.y === y
    ) ?? null
  );
}

/**
 * Các ô đơn vị có thể di chuyển tới.
 * Có terrainMap: tính theo chi phí địa hình và bị địch chặn đường (Pathfinding.js).
 * Không có terrainMap: dùng khoảng cách Manhattan như bản cũ.
 */
export function getMoveTiles(unit, units, terrainMap) {
  if (terrainMap) {
    return getReachableTiles(unit, units, terrainMap);
  }

  const tiles = [];

  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const d = distance(unit, { x, y });

      if (d === 0 || d > unit.mov) continue;

      if (unitAt(units, x, y)) continue;

      tiles.push({ x, y });
    }
  }

  return tiles;
}

/**
 * Các kẻ địch nằm trong tầm đánh của vũ khí.
 */
export function getAttackTargets(unit, units) {
  const range = unit.weapon?.range ?? 1;

  return units.filter(
    other =>
      other.hp > 0 &&
      other.team !== unit.team &&
      distance(unit, other) >= 1 &&
      distance(unit, other) <= range
  );
}
