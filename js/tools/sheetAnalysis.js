
/**
 * SHEET ANALYSIS
 * Hàm thuần (không dùng Phaser, không dùng DOM) để phân tích spritesheet
 * xuất từ TearRing Compositor. Dùng trong char-lab.html và test bằng Node.
 *
 * Dữ liệu ảnh là RGBA phẳng: { data: Uint8ClampedArray|Uint8Array, width, height }.
 */

const ALPHA_MIN = 1;

// Ô (cell) của một frame trên ảnh sheet.
function cellOf(sheet, name) {
  const f = sheet.frames[name];
  return { x: f.x, y: f.y, w: f.w, h: f.h };
}

// Gán nhãn các cụm pixel liên thông (8 hướng) trong một ô.
function labelCell(img, cell) {
  const { width, data } = img;
  const labels = new Int32Array(cell.w * cell.h);
  const comps = [];
  const stack = [];
  let next = 0;

  const opaque = (cx, cy) =>
    data[((cell.y + cy) * width + cell.x + cx) * 4 + 3] >= ALPHA_MIN;

  for (let sy = 0; sy < cell.h; sy++) {
    for (let sx = 0; sx < cell.w; sx++) {
      if (labels[sy * cell.w + sx] || !opaque(sx, sy)) continue;

      const id = ++next;
      const comp = { id, area: 0, x0: sx, x1: sx, y0: sy, y1: sy };

      stack.push([sx, sy]);
      labels[sy * cell.w + sx] = id;

      while (stack.length) {
        const [cx, cy] = stack.pop();

        comp.area++;
        comp.x0 = Math.min(comp.x0, cx);
        comp.x1 = Math.max(comp.x1, cx);
        comp.y0 = Math.min(comp.y0, cy);
        comp.y1 = Math.max(comp.y1, cy);

        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = cx + dx;
            const ny = cy + dy;

            if (
              nx < 0 || ny < 0 || nx >= cell.w || ny >= cell.h ||
              labels[ny * cell.w + nx] || !opaque(nx, ny)
            ) continue;

            labels[ny * cell.w + nx] = id;
            stack.push([nx, ny]);
          }
        }
      }

      comps.push(comp);
    }
  }

  return { labels, comps };
}

/**
 * Tìm các cụm pixel lạc (dấu mốc của công cụ) ở sát đáy mỗi ô:
 * nhỏ (<=45 pixel, rộng <=5, cao <=8) và nằm trong 16px cuối của ô.
 */
export function findStrayMarkers(img, sheet) {
  const found = [];

  for (const name of Object.keys(sheet.frames)) {
    const cell = cellOf(sheet, name);
    const { labels, comps } = labelCell(img, cell);

    for (const c of comps) {
      const w = c.x1 - c.x0 + 1;
      const h = c.y1 - c.y0 + 1;

      if (c.area <= 45 && w <= 5 && h <= 8 && c.y1 >= cell.h - 16) {
        found.push({ frame: name, cell, labels, id: c.id, comp: c });
      }
    }
  }

  return found;
}

// Xoá các cụm lạc khỏi ảnh (sửa trực tiếp img.data). Trả về số cụm đã xoá.
export function cleanStrayMarkers(img, sheet) {
  const markers = findStrayMarkers(img, sheet);

  for (const m of markers) {
    for (let cy = 0; cy < m.cell.h; cy++) {
      for (let cx = 0; cx < m.cell.w; cx++) {
        if (m.labels[cy * m.cell.w + cx] !== m.id) continue;

        const i =
          ((m.cell.y + cy) * img.width + m.cell.x + cx) * 4;

        img.data[i + 3] = 0;
      }
    }
  }

  return markers.length;
}

// Bounding box + điểm chân (x giữa 5 hàng pixel thấp nhất) của một frame.
export function measureFrame(img, sheet, name) {
  const cell = cellOf(sheet, name);
  const { width, data } = img;

  let minX = Infinity, maxX = -1, minY = Infinity, maxY = -1;

  for (let cy = 0; cy < cell.h; cy++) {
    for (let cx = 0; cx < cell.w; cx++) {
      if (data[((cell.y + cy) * width + cell.x + cx) * 4 + 3] < ALPHA_MIN) continue;

      minX = Math.min(minX, cx);
      maxX = Math.max(maxX, cx);
      minY = Math.min(minY, cy);
      maxY = Math.max(maxY, cy);
    }
  }

  if (maxX < 0) return null;

  const feet = [];

  for (let cy = maxY - 4; cy <= maxY; cy++) {
    for (let cx = minX; cx <= maxX; cx++) {
      if (data[((cell.y + cy) * width + cell.x + cx) * 4 + 3] >= ALPHA_MIN) {
        feet.push(cx);
      }
    }
  }

  feet.sort((a, b) => a - b);

  return {
    minX, maxX, minY, maxY,
    footX: feet[Math.floor(feet.length / 2)],
    footY: maxY + 1
  };
}

const median = list => {
  const a = [...list].sort((x, y) => x - y);

  return a[Math.floor(a.length / 2)];
};

/**
 * Gợi ý anchor chân: trung vị điểm chân qua các frame của các animation
 * đánh (mặc định mọi mã bắt đầu bằng "M1_"). Cần gọi SAU khi đã xoá pixel lạc.
 */
export function suggestAnchor(img, sheet, codes) {
  const use = codes ?? Object.keys(sheet.animations)
    .filter(code => code.startsWith("M1_"));

  const xs = [];
  const ys = [];

  for (const code of use) {
    for (const step of sheet.animations[code] ?? []) {
      const m = measureFrame(img, sheet, step.frame);

      if (!m) continue;

      xs.push(m.footX);
      ys.push(m.footY);
    }
  }

  if (!xs.length) return null;

  return { x: median(xs), y: median(ys) };
}

/**
 * Gợi ý bước va chạm của một animation: bước đầu tiên có nhiều pixel
 * "xanh sáng" (vệt chém). Chỉ là gợi ý, cần xem lại bằng mắt.
 */
export function guessImpactStep(img, sheet, code, minBluePixels = 130) {
  const steps = sheet.animations[code] ?? [];

  for (let i = 0; i < steps.length; i++) {
    const cell = cellOf(sheet, steps[i].frame);
    let blue = 0;

    for (let cy = 0; cy < cell.h; cy++) {
      for (let cx = 0; cx < cell.w; cx++) {
        const p = ((cell.y + cy) * img.width + cell.x + cx) * 4;

        if (
          img.data[p + 3] >= 128 &&
          img.data[p + 2] > 150 &&
          img.data[p + 2] > img.data[p] + 40
        ) blue++;
      }
    }

    if (blue >= minBluePixels) return i;
  }

  return steps.length ? steps.length - 1 : 0;
}

/**
 * Dựng khối cấu hình để dán vào BATTLE_SPRITES (battleSprites.js).
 */
export function buildConfigSnippet(id, img, sheet) {
  const anchor = suggestAnchor(img, sheet);
  const attack = sheet.animations["M1_0"];
  const rest = attack?.[attack.length - 1]?.frame ?? "f000";

  const impact = {};

  for (const code of ["M1_0", "M1_1", "M1_8"]) {
    if (sheet.animations[code]) {
      impact[code] = guessImpactStep(img, sheet, code);
    }
  }

  const impactText = Object.entries(impact)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");

  return `  ${id}: {
    facing: "left",
    scale: 1.25,
    anchor: { x: ${anchor?.x ?? 0}, y: ${anchor?.y ?? 0} },
    rest: "${rest}",
    reach: 125,
    roles: MOUNTED_ROLES,
    impact: { ${impactText} }
  },`;
}
