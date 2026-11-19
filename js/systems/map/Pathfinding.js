
import { DEFAULT_MOVE_TYPE } from "../../data/terrain.js";

const DIRECTIONS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1]
];

/**
 * PATHFINDING
 * Tìm các ô đơn vị có thể tới, tính theo chi phí địa hình (Dijkstra).
 *  - Không đi xuyên qua đơn vị phe khác; đi xuyên đồng minh được.
 *  - Không được dừng trên ô đã có đơn vị.
 */

// Duyệt toàn bộ vùng đi tới được, nhớ cả đường đi (prev) để dựng lại lối đi.
export function exploreReach(unit, units, terrainMap) {
  const moveType = unit.moveType ?? DEFAULT_MOVE_TYPE;
  const width = terrainMap.width;
  const key = (x, y) => y * width + x;

  const alive = units.filter(u => u.hp > 0);

  const isBlocked = (x, y) =>
    alive.some(u => u.team !== unit.team && u.x === x && u.y === y);

  const startKey = key(unit.x, unit.y);
  const best = new Map([[startKey, 0]]);
  const prev = new Map();
  const open = [{ x: unit.x, y: unit.y, cost: 0 }];

  while (open.length) {
    open.sort((a, b) => a.cost - b.cost);

    const current = open.shift();

    if (current.cost > best.get(key(current.x, current.y))) continue;

    for (const [dx, dy] of DIRECTIONS) {
      const nx = current.x + dx;
      const ny = current.y + dy;

      if (!terrainMap.inBounds(nx, ny)) continue;
      if (isBlocked(nx, ny)) continue;

      const step = terrainMap.moveCost(nx, ny, moveType);

      if (!Number.isFinite(step)) continue;

      const total = current.cost + step;

      if (total > unit.mov) continue;

      const nk = key(nx, ny);

      if (total < (best.get(nk) ?? Infinity)) {
        best.set(nk, total);
        prev.set(nk, key(current.x, current.y));
        open.push({ x: nx, y: ny, cost: total });
      }
    }
  }

  return { best, prev, startKey, width, alive };
}

/**
 * Các ô có thể dừng lại: [{ x, y, cost }] (không gồm ô đang đứng và ô có người).
 */
export function getReachableTiles(unit, units, terrainMap) {
  const info = exploreReach(unit, units, terrainMap);
  const { best, startKey, width, alive } = info;

  const isOccupied = (x, y) =>
    alive.some(u => u.x === x && u.y === y);

  const tiles = [];

  for (const [k, cost] of best) {
    if (k === startKey) continue;

    const x = k % width;
    const y = Math.floor(k / width);

    if (isOccupied(x, y)) continue;

    tiles.push({ x, y, cost });
  }

  return tiles;
}

/**
 * Lối đi từng ô từ chỗ đang đứng tới (x, y): [{ x, y }, ...] (không gồm ô xuất phát).
 * Trả mảng rỗng nếu không tới được.
 */
export function buildPath(info, x, y) {
  const { prev, startKey, width } = info;

  let k = y * width + x;

  if (!info.best.has(k) || k === startKey) return [];

  const path = [];

  while (k !== startKey) {
    path.push({ x: k % width, y: Math.floor(k / width) });
    k = prev.get(k);
  }

  return path.reverse();
}
