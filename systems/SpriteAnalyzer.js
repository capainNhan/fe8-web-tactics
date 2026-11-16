
/**
 * SpriteAnalyzer.js
 * Phân tích cấu trúc sprite sheet, không chỉnh sửa ảnh gốc.
 */

export class SpriteAnalyzer {
  constructor(options = {}) {
    this.options = {
      alphaThreshold: 20,
      backgroundTolerance: 18,
      gapTolerance: 2,
      minPixelsPerLine: 1,
      ...options
    };
  }

  analyze(image, customOptions = {}) {
    if (!image) {
      throw new Error("SpriteAnalyzer: Không tìm thấy ảnh đầu vào.");
    }

    const options = {
      ...this.options,
      ...customOptions
    };

    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;

    if (!width || !height) {
      throw new Error("SpriteAnalyzer: Ảnh chưa được tải hoặc không hợp lệ.");
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d", {
      willReadFrequently: true
    });

    if (!ctx) {
      throw new Error("SpriteAnalyzer: Không thể tạo Canvas Context.");
    }

    ctx.drawImage(image, 0, 0);

    const imageData = ctx.getImageData(0, 0, width, height);
    const pixels = imageData.data;

    // 1. Kiểm tra nền ảnh từ bốn góc.
    const background = this.detectBackground(
      pixels,
      width,
      height,
      options
    );

    // 2. Quét pixel và tạo projection theo hàng/cột.
    const rows = new Array(height).fill(0);
    const columns = new Array(width).fill(0);

    let transparentPixels = 0;
    let foregroundPixels = 0;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4;

        const r = pixels[index];
        const g = pixels[index + 1];
        const b = pixels[index + 2];
        const a = pixels[index + 3];

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

        rows[y]++;
        columns[x]++;
        foregroundPixels++;
      }
    }

    // 3. Tìm các dải pixel có nội dung.
    const rowBands = this.findBands(
      rows,
      options.minPixelsPerLine,
      options.gapTolerance
    );

    const columnBands = this.findBands(
      columns,
      options.minPixelsPerLine,
      options.gapTolerance
    );

    // 4. Thống kê.
    const totalPixels = width * height;

    const result = {
      width,
      height,

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

      warnings: []
    };

    // 5. Đưa ra cảnh báo khi cấu trúc chưa rõ.
    if (!background && transparentPixels === 0) {
      result.warnings.push(
        "Không xác định được nền đơn sắc. Có thể cần cấu hình nền thủ công."
      );
    }

    if (rowBands.length === 0 || columnBands.length === 0) {
      result.warnings.push(
        "Không tìm thấy vùng sprite rõ ràng."
      );
    }

    if (rowBands.length === 1 && columnBands.length === 1) {
      result.warnings.push(
        "Ảnh có thể là một sprite đơn thay vì sprite sheet."
      );
    }

    return result;
  }

  detectBackground(pixels, width, height, options) {
    const points = [
      [0, 0],
      [width - 1, 0],
      [0, height - 1],
      [width - 1, height - 1]
    ];

    const colors = points.map(([x, y]) => {
      const index = (y * width + x) * 4;

      return {
        r: pixels[index],
        g: pixels[index + 1],
        b: pixels[index + 2],
        a: pixels[index + 3]
      };
    });

    // Nếu các góc trong suốt, ưu tiên xử lý bằng alpha.
    if (
      colors.some(color => color.a < options.alphaThreshold)
    ) {
      return null;
    }

    const first = colors[0];

    // Chỉ nhận nền khi bốn góc có màu tương đối giống nhau.
    const cornersMatch = colors.every(color =>
      this.colorDistance(
        color.r,
        color.g,
        color.b,
        first
      ) <= options.backgroundTolerance
    );

    return cornersMatch ? first : null;
  }

  colorDistance(r, g, b, color) {
    return Math.sqrt(
      (r - color.r) ** 2 +
      (g - color.g) ** 2 +
      (b - color.b) ** 2
    );
  }

  findBands(projection, minPixels = 1, gapTolerance = 2) {
    const bands = [];

    let start = -1;
    let lastActive = -1;

    for (let i = 0; i < projection.length; i++) {
      if (projection[i] >= minPixels) {
        if (start === -1) {
          start = i;
        }

        lastActive = i;
        continue;
      }

      if (
        start !== -1 &&
        i - lastActive > gapTolerance
      ) {
        bands.push({
          start,
          end: lastActive,
          size: lastActive - start + 1
        });

        start = -1;
        lastActive = -1;
      }
    }

    if (start !== -1) {
      bands.push({
        start,
        end: lastActive,
        size: lastActive - start + 1
      });
    }

    return bands;
  }
}
