
/**
 * SPRITE SHEET SYSTEM
 * Tự động nhận diện các hàng animation và từng frame.
 *
 * Frame trả về:
 * { x, y, w, h, bottomY, groundY }
 */

export function autoSlice(image, options = {}) {
  const {
    alphaThreshold = 50,
    colorThreshold = 245,
    rowGap = 5,
    columnGap = 5,
    minFrameWidth = 10,
    minFrameHeight = 15
  } = options;

  if (!image) {
    throw new Error("autoSlice: Không tìm thấy ảnh đầu vào.");
  }

  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;

  if (!width || !height) {
    throw new Error("autoSlice: Ảnh chưa được tải hoặc kích thước không hợp lệ.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d", {
    willReadFrequently: true
  });

  ctx.drawImage(image, 0, 0);

  const pixels = ctx.getImageData(
    0, 0, width, height
  ).data;

  function isInk(x, y) {
    const i = (y * width + x) * 4;

    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const a = pixels[i + 3];

    return (
      a > alphaThreshold &&
      (r < colorThreshold ||
       g < colorThreshold ||
       b < colorThreshold)
    );
  }

  // Tìm các hàng có pixel nhân vật.
  const rowHasInk = [];

  for (let y = 0; y < height; y++) {
    let found = false;

    for (let x = 0; x < width; x++) {
      if (isInk(x, y)) {
        found = true;
        break;
      }
    }

    rowHasInk.push(found);
  }

  function findBands(values, maxGap) {
    const bands = [];

    let start = -1;
    let last = -1;

    for (let i = 0; i < values.length; i++) {
      if (values[i]) {
        if (start === -1) start = i;
        last = i;
      } else if (
        start !== -1 &&
        i - last > maxGap
      ) {
        bands.push({
          start,
          end: last
        });

        start = -1;
        last = -1;
      }
    }

    if (start !== -1) {
      bands.push({
        start,
        end: last
      });
    }

    return bands;
  }

  const rowBands = findBands(rowHasInk, rowGap);
  const rows = [];

  for (const rowBand of rowBands) {
    const top = rowBand.start;
    const bottom = rowBand.end;

    // Tìm các cột có pixel trong hàng hiện tại.
    const columnHasInk = [];

    for (let x = 0; x < width; x++) {
      let found = false;

      for (let y = top; y <= bottom; y++) {
        if (isInk(x, y)) {
          found = true;
          break;
        }
      }

      columnHasInk.push(found);
    }

    const columnBands = findBands(
      columnHasInk,
      columnGap
    );

    const frames = [];

    for (const columnBand of columnBands) {
      const left = columnBand.start;
      const right = columnBand.end;

      let minY = height;
      let maxY = -1;

      // Tìm biên trên và dưới thật của frame.
      for (let y = top; y <= bottom; y++) {
        for (let x = left; x <= right; x++) {
          if (isInk(x, y)) {
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
          }
        }
      }

      if (maxY < minY) continue;

      const frameWidth = right - left + 1;
      const frameHeight = maxY - minY + 1;

      if (
        frameWidth < minFrameWidth ||
        frameHeight < minFrameHeight
      ) {
        continue;
      }

      // Chừa một ít khoảng trống quanh nhân vật.
      const padding = 2;

      const x = Math.max(0, left - padding);
      const y = Math.max(0, minY - padding);

      const frameRight = Math.min(
        width,
        right + padding + 1
      );

      const frameBottom = Math.min(
        height,
        maxY + padding + 1
      );

      frames.push({
        x,
        y,
        w: frameRight - x,
        h: frameBottom - y,
        bottomY: maxY,
        groundY: maxY
      });
    }

    if (frames.length > 0) {
      const groundY = Math.max(
        ...frames.map(frame => frame.groundY)
      );

      frames.forEach(frame => {
        frame.groundY = groundY;
      });

      rows.push({
        y: top,
        height: bottom - top + 1,
        groundY,
        frames
      });
    }
  }

  console.log("AutoSlice result:", rows);

  return rows;
}

/**
 * Chuyển một hàng animation thành danh sách frame.
 */
export function getAnimationFrames(rows, rowIndex = 0) {
  if (!rows || !rows[rowIndex]) {
    return [];
  }

  return rows[rowIndex].frames;
}

/**
 * Lấy frame đầu tiên làm trạng thái đứng yên.
 */
export function getIdleFrame(rows, rowIndex = 0) {
  return getAnimationFrames(rows, rowIndex)[0] || null;
}
