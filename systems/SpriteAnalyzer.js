
/**
 * SpriteAnalyzer V2
 *
 * - Phát hiện pixel thuộc sprite.
 * - Tìm các vùng pixel liên thông bằng Flood Fill.
 * - Tạo bounding box cho từng vùng.
 * - Thống kê hàng/cột.
 *
 * Không chỉnh sửa ảnh gốc.
 */

export class SpriteAnalyzer {
  constructor(options = {}) {
    this.options = {
      alphaThreshold: 20,
      backgroundTolerance: 18,

      // Loại bỏ các vùng nhiễu quá nhỏ.
      minComponentPixels: 2,
      minComponentWidth: 1,
      minComponentHeight: 1,

      // 8 hướng liên thông.
      connectivity: 8,

      ...options
    };
  }

  analyze(image, customOptions = {}) {
    if (!image) {
      throw new Error("SpriteAnalyzer: Missing input image.");
    }

    const options = {
      ...this.options,
      ...customOptions
    };

    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;

    if (!width || !height) {
      throw new Error("SpriteAnalyzer: Invalid image dimensions.");
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d", {
      willReadFrequently: true
    });

    if (!ctx) {
      throw new Error("SpriteAnalyzer: Canvas unavailable.");
    }

    ctx.drawImage(image, 0, 0);

    const imageData = ctx.getImageData(
      0, 0, width, height
    );

    const pixels = imageData.data;
    const totalPixels = width * height;

    // 1. Nhận diện nền.
    const background = this.detectBackground(
      pixels,
      width,
      height,
      options
    );

    // 2. Tạo mask pixel.
    const mask = new Uint8Array(totalPixels);

    const rowProjection = new Uint32Array(height);
    const columnProjection = new Uint32Array(width);

    let transparentPixels = 0;
    let foregroundPixels = 0;

    for (let i = 0; i < totalPixels; i++) {
      const p = i * 4;

      const r = pixels[p];
      const g = pixels[p + 1];
      const b = pixels[p + 2];
      const a = pixels[p + 3];

      if (a < options.alphaThreshold) {
        transparentPixels++;
        continue;
      }

      if (
        background &&
        this.colorDistance(r, g, b, background) <=
          options.backgroundTolerance
      ) {
        continue;
      }

      mask[i] = 1;
      foregroundPixels++;

      const x = i % width;
      const y = Math.floor(i / width);

      rowProjection[y]++;
      columnProjection[x]++;
    }

    // 3. Tìm connected components.
    const components = this.findComponents(
      mask,
      width,
      height,
      options
    );

    // 4. Tìm các dải nội dung.
    const rowBands = this.findBands(rowProjection);
    const columnBands = this.findBands(columnProjection);

    // 5. Tạo báo cáo.
    const report = {
      version: 2,

      image: {
        width,
        height,
        totalPixels
      },

      transparency: {
        hasTransparency: transparentPixels > 0,
        transparentPixels,
        ratio: transparentPixels / totalPixels
      },

      background: {
        detected: !!background,
        color: background
          ? {
              r: background.r,
              g: background.g,
              b: background.b
            }
          : null
      },

      content: {
        foregroundPixels,
        ratio: foregroundPixels / totalPixels
      },

      layout: {
        rowBands,
        columnBands,
        estimatedRows: rowBands.length,
        estimatedColumns: columnBands.length
      },

      components: {
        count: components.length,
        items: components
      },

      warnings: []
    };

    if (components.length === 0) {
      report.warnings.push(
        "Không tìm thấy vùng pixel phù hợp."
      );
    }

    if (!background && transparentPixels === 0) {
      report.warnings.push(
        "Không xác định được nền. Cần kiểm tra hoặc cấu hình thủ công."
      );
    }

    if (components.length > 500) {
      report.warnings.push(
        "Có rất nhiều vùng pixel nhỏ. Có thể cần tăng minComponentPixels."
      );
    }

    return report;
  }

  detectBackground(pixels, width, height, options) {
    const corners = [
      [0, 0],
      [width - 1, 0],
      [0, height - 1],
      [width - 1, height - 1]
    ];

    const colors = corners.map(([x, y]) => {
      const i = (y * width + x) * 4;

      return {
        r: pixels[i],
        g: pixels[i + 1],
        b: pixels[i + 2],
        a: pixels[i + 3]
      };
    });

    // Nếu có góc trong suốt, không đoán nền màu.
    if (
      colors.some(c => c.a < options.alphaThreshold)
    ) {
      return null;
    }

    const reference = colors[0];

    const sameBackground = colors.every(color =>
      this.colorDistance(
        color.r,
        color.g,
        color.b,
        reference
      ) <= options.backgroundTolerance
    );

    return sameBackground ? reference : null;
  }

  colorDistance(r, g, b, color) {
    return Math.sqrt(
      (r - color.r) ** 2 +
      (g - color.g) ** 2 +
      (b - color.b) ** 2
    );
  }

  findComponents(mask, width, height, options) {
    const total = width * height;

    // Mỗi pixel chỉ được đưa vào stack tối đa một lần.
    const stack = new Int32Array(total);
    const components = [];

    const directions = options.connectivity === 4
      ? [
          [-1, 0],
          [1, 0],
          [0, -1],
          [0, 1]
        ]
      : [
          [-1, -1],
          [0, -1],
          [1, -1],
          [-1, 0],
          [1, 0],
          [-1, 1],
          [0, 1],
          [1, 1]
        ];

    for (let start = 0; start < total; start++) {
      if (mask[start] === 0) continue;

      let top = 0;
      let pixelCount = 0;

      let minX = width;
      let minY = height;
      let maxX = -1;
      let maxY = -1;

      // Đánh dấu ngay khi đưa vào stack.
      mask[start] = 0;
      stack[top++] = start;

      while (top > 0) {
        const index = stack[--top];

        const x = index % width;
        const y = Math.floor(index / width);

        pixelCount++;

        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;

        for (const [dx, dy] of directions) {
          const nx = x + dx;
          const ny = y + dy;

          if (
            nx < 0 ||
            nx >= width ||
            ny < 0 ||
            ny >= height
          ) {
            continue;
          }

          const nextIndex = ny * width + nx;

          if (mask[nextIndex] === 0) continue;

          mask[nextIndex] = 0;
          stack[top++] = nextIndex;
        }
      }

      const componentWidth = maxX - minX + 1;
      const componentHeight = maxY - minY + 1;

      if (
        pixelCount < options.minComponentPixels ||
        componentWidth < options.minComponentWidth ||
        componentHeight < options.minComponentHeight
      ) {
        continue;
      }

      components.push({
        x: minX,
        y: minY,
        width: componentWidth,
        height: componentHeight,
        pixelCount,

        centerX: (minX + maxX) / 2,
        centerY: (minY + maxY) / 2
      });
    }

    // Sắp xếp từ trên xuống dưới, trái sang phải.
    components.sort((a, b) => {
      if (a.y !== b.y) return a.y - b.y;
      return a.x - b.x;
    });

    return components;
  }

  findBands(projection) {
    const bands = [];
    let start = -1;

    for (let i = 0; i < projection.length; i++) {
      if (projection[i] > 0) {
        if (start === -1) start = i;
      } else if (start !== -1) {
        bands.push({
          start,
          end: i - 1,
          size: i - start
        });

        start = -1;
      }
    }

    if (start !== -1) {
      bands.push({
        start,
        end: projection.length - 1,
        size: projection.length - start
      });
    }

    return bands;
  }
            }
