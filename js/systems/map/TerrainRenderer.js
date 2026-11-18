
import { TILE } from "../../config.js";

/**
 * TERRAIN RENDERER
 * Vẽ địa hình của cả bản đồ MỘT LẦN bằng đồ họa vector (không cần ảnh).
 * Mỗi loại địa hình có một hàm vẽ cùng id với data/terrain.js.
 * Thêm địa hình mới: viết thêm một hàm vào DRAWERS.
 *
 * Chỉ dùng các lệnh đồ họa cơ bản: fillStyle, fillRect, fillCircle,
 * fillEllipse, fillTriangle, lineStyle, lineBetween, strokeRect.
 */

// Mọi kích thước thiết kế theo ô 96px, tự co theo TILE thật.
const K = TILE / 96;
const s = n => n * K;
const line = () => Math.max(1, Math.round(s(2)));

// Số ngẫu nhiên cố định theo (x, y, n) để mỗi ô trông khác nhau nhưng ổn định.
function rand(x, y, n) {
  let h = Math.imul(x + 1, 374761393) ^ Math.imul(y + 1, 668265263) ^ Math.imul(n + 1, 2246822519);

  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;

  return (h >>> 0) / 4294967295;
}

function grassBase(g, ox, oy, x, y) {
  g.fillStyle((x + y) % 2 === 0 ? 0x6fae52 : 0x69a84c, 1);
  g.fillRect(ox, oy, TILE, TILE);
}

function grassTufts(g, ox, oy, x, y, count = 4) {
  g.lineStyle(line(), 0x4f8d3a, 1);

  for (let i = 0; i < count; i++) {
    const gx = ox + s(10) + rand(x, y, i) * s(76);
    const gy = oy + s(18) + rand(x, y, i + 9) * s(70);

    g.lineBetween(gx, gy, gx - s(3), gy - s(7));
    g.lineBetween(gx, gy, gx + s(3), gy - s(6));
  }
}

function waterBase(g, ox, oy, x, y) {
  g.fillStyle((x + y) % 2 === 0 ? 0x3a7bd5 : 0x4084dc, 1);
  g.fillRect(ox, oy, TILE, TILE);
}

function waves(g, ox, oy, x, y) {
  g.lineStyle(line(), 0x9ccaff, 1);

  for (let i = 0; i < 4; i++) {
    const wx = ox + s(8) + rand(x, y, i + 20) * s(60);
    const wy = oy + s(12) + (i * s(22)) + rand(x, y, i + 30) * s(8);

    g.lineBetween(wx, wy, wx + s(8), wy - s(3));
    g.lineBetween(wx + s(8), wy - s(3), wx + s(16), wy);
    g.lineBetween(wx + s(16), wy, wx + s(24), wy - s(3));
  }
}

function tree(g, cx, baseY) {
  g.fillStyle(0x5a3b22, 1);
  g.fillRect(cx - s(3), baseY - s(14), s(6), s(14));

  g.fillStyle(0x2d6a32, 1);
  g.fillCircle(cx, baseY - s(26), s(17));

  g.fillStyle(0x3f8a3d, 1);
  g.fillCircle(cx - s(5), baseY - s(30), s(10));
}

const DRAWERS = {
  plain(g, ox, oy, x, y) {
    grassBase(g, ox, oy, x, y);
    grassTufts(g, ox, oy, x, y);
  },

  road(g, ox, oy, x, y) {
    g.fillStyle((x + y) % 2 === 0 ? 0xcaa56a : 0xc4a064, 1);
    g.fillRect(ox, oy, TILE, TILE);

    g.fillStyle(0xa8864f, 1);

    for (let i = 0; i < 6; i++) {
      g.fillRect(
        ox + s(6) + rand(x, y, i + 40) * s(78),
        oy + s(6) + rand(x, y, i + 50) * s(78),
        s(5),
        s(4)
      );
    }
  },

  forest(g, ox, oy, x, y) {
    grassBase(g, ox, oy, x, y);

    // Vẽ cây phía sau trước, cây phía trước sau để che đúng chiều sâu.
    const spots = [
      [26, 54],
      [70, 52],
      [48, 86]
    ];

    spots.forEach(([tx, ty], i) => {
      tree(
        g,
        ox + s(tx) + (rand(x, y, i + 60) - 0.5) * s(8),
        oy + s(ty)
      );
    });
  },

  hill(g, ox, oy, x, y) {
    grassBase(g, ox, oy, x, y);

    g.fillStyle(0x5a8f43, 1);
    g.fillEllipse(ox + s(48), oy + s(70), s(84), s(40));

    g.fillStyle(0x8fbf6b, 1);
    g.fillEllipse(ox + s(48), oy + s(60), s(78), s(44));

    g.fillStyle(0xa9d083, 1);
    g.fillEllipse(ox + s(40), oy + s(52), s(40), s(20));
  },

  mountain(g, ox, oy, x, y) {
    g.fillStyle(0x7f8b6a, 1);
    g.fillRect(ox, oy, TILE, TILE);

    // Đỉnh sau.
    g.fillStyle(0x6c6c78, 1);
    g.fillTriangle(
      ox + s(52), oy + s(14),
      ox + s(94), oy + s(84),
      ox + s(14), oy + s(84)
    );

    g.fillStyle(0x4f4f5c, 1);
    g.fillTriangle(
      ox + s(52), oy + s(14),
      ox + s(94), oy + s(84),
      ox + s(56), oy + s(84)
    );

    g.fillStyle(0xf2f2f8, 1);
    g.fillTriangle(
      ox + s(52), oy + s(14),
      ox + s(63), oy + s(34),
      ox + s(41), oy + s(34)
    );

    // Đỉnh trước.
    g.fillStyle(0x8b8b98, 1);
    g.fillTriangle(
      ox + s(30), oy + s(40),
      ox + s(62), oy + s(88),
      ox + s(4), oy + s(88)
    );

    g.fillStyle(0x62626e, 1);
    g.fillTriangle(
      ox + s(30), oy + s(40),
      ox + s(62), oy + s(88),
      ox + s(34), oy + s(88)
    );
  },

  water(g, ox, oy, x, y) {
    waterBase(g, ox, oy, x, y);
    waves(g, ox, oy, x, y);
  },

  bridge(g, ox, oy, x, y) {
    waterBase(g, ox, oy, x, y);

    // Mặt cầu chạy ngang (đông - tây).
    g.fillStyle(0x9b6a3a, 1);
    g.fillRect(ox, oy + s(14), TILE, TILE - s(28));

    g.lineStyle(line(), 0x6b4423, 1);

    for (let i = 1; i < 8; i++) {
      g.lineBetween(
        ox + i * s(12), oy + s(14),
        ox + i * s(12), oy + TILE - s(14)
      );
    }

    // Lan can.
    g.fillStyle(0x5a3a1e, 1);
    g.fillRect(ox, oy + s(10), TILE, s(6));
    g.fillRect(ox, oy + TILE - s(16), TILE, s(6));
  },

  wall(g, ox, oy) {
    g.fillStyle(0x6b6b75, 1);
    g.fillRect(ox, oy, TILE, TILE);

    g.lineStyle(line(), 0x4a4a52, 1);

    for (let row = 1; row < 4; row++) {
      g.lineBetween(ox, oy + row * s(24), ox + TILE, oy + row * s(24));
    }

    for (let row = 0; row < 4; row++) {
      const shift = row % 2 === 0 ? s(24) : s(48);

      for (let c = 0; c < 2; c++) {
        const bx = ox + shift + c * s(48) - (shift > s(40) ? s(48) : 0);

        if (bx > ox && bx < ox + TILE) {
          g.lineBetween(bx, oy + row * s(24), bx, oy + (row + 1) * s(24));
        }
      }
    }

    g.fillStyle(0x8e8e99, 1);
    g.fillRect(ox, oy, TILE, s(7));
  },

  fort(g, ox, oy, x, y) {
    g.fillStyle((x + y) % 2 === 0 ? 0xb8b4a6 : 0xb0ac9e, 1);
    g.fillRect(ox, oy, TILE, TILE);

    g.lineStyle(line(), 0x8a8678, 1);
    g.strokeRect(ox + s(3), oy + s(3), TILE - s(6), TILE - s(6));
  },

  village(g, ox, oy, x, y) {
    grassBase(g, ox, oy, x, y);

    // Nhà lớn.
    g.fillStyle(0xe8d9b5, 1);
    g.fillRect(ox + s(14), oy + s(46), s(40), s(32));

    g.fillStyle(0xb5483a, 1);
    g.fillTriangle(
      ox + s(8), oy + s(48),
      ox + s(60), oy + s(48),
      ox + s(34), oy + s(24)
    );

    g.fillStyle(0x5a3b22, 1);
    g.fillRect(ox + s(29), oy + s(60), s(10), s(18));

    // Nhà nhỏ.
    g.fillStyle(0xdccba0, 1);
    g.fillRect(ox + s(58), oy + s(58), s(28), s(22));

    g.fillStyle(0xa23d31, 1);
    g.fillTriangle(
      ox + s(54), oy + s(60),
      ox + s(90), oy + s(60),
      ox + s(72), oy + s(42)
    );
  }
};

export class TerrainRenderer {
  constructor(scene, terrainMap) {
    this.terrainMap = terrainMap;
    this.graphics = scene.add.graphics();
  }

  draw() {
    const g = this.graphics;
    const map = this.terrainMap;

    g.clear();

    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const terrain = map.terrainAt(x, y);
        const drawer = DRAWERS[terrain.id] ?? DRAWERS.plain;

        drawer(g, x * TILE, y * TILE, x, y);
      }
    }
  }
}
