
export class SpriteProcessor {
  processFrame(source, frame) {
    if (!source || !frame) {
      throw new Error(
        "SpriteProcessor: Thiếu ảnh nguồn hoặc frame."
      );
    }

    const canvas = document.createElement("canvas");

    canvas.width = frame.w;
    canvas.height = frame.h;

    const context = canvas.getContext("2d", {
      willReadFrequently: true
    });

    if (!context) {
      throw new Error(
        "SpriteProcessor: Không tạo được Canvas Context."
      );
    }

    context.drawImage(
      source,
      frame.x,
      frame.y,
      frame.w,
      frame.h,
      0,
      0,
      frame.w,
      frame.h
    );

    const imageData = context.getImageData(
      0,
      0,
      frame.w,
      frame.h
    );

    const pixels = imageData.data;

    // Loại bỏ nền trắng.
    for (let i = 0; i < pixels.length; i += 4) {
      if (
        pixels[i] > 230 &&
        pixels[i + 1] > 230 &&
        pixels[i + 2] > 230
      ) {
        pixels[i + 3] = 0;
      }
    }

    // Cắt phần trong suốt bên dưới nhân vật.
    let bottom = frame.h;
    let foundFoot = false;
    let gap = 0;

    for (let y = 0; y < frame.h; y++) {
      let hasPixel = false;

      for (let x = 0; x < frame.w; x++) {
        if (pixels[(y * frame.w + x) * 4 + 3] > 0) {
          hasPixel = true;
          break;
        }
      }

      if (hasPixel) {
        foundFoot = true;
        gap = 0;
        bottom = y + 1;
      } else if (foundFoot && ++gap >= 4) {
        for (let cy = y; cy < frame.h; cy++) {
          for (let cx = 0; cx < frame.w; cx++) {
            pixels[(cy * frame.w + cx) * 4 + 3] = 0;
          }
        }

        break;
      }
    }

    context.putImageData(imageData, 0, 0);

    const finalCanvas = document.createElement("canvas");

    finalCanvas.width = frame.w;
    finalCanvas.height = Math.max(1, bottom);

    finalCanvas
      .getContext("2d")
      .drawImage(canvas, 0, 0);

    return finalCanvas;
  }
}
