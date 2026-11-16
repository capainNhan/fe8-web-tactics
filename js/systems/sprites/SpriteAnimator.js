
export class SpriteAnimator {
  constructor(scene) {
    this.scene = scene;
  }

  setCharacterFrame(sprite, file, frameTextures) {
    if (!sprite || !file) return false;

    const scene = this.scene;
    const textureKey = frameTextures.get(file);

    if (!textureKey || !scene.textures.exists(textureKey)) {
      console.warn("Sprite frame không tồn tại:", file);
      return false;
    }

    sprite.setTexture(textureKey);
    return true;
  }

  setFrame(sprite, frame, frameTextures, attackerSprite) {
    if (!frame || !sprite) return;

    const scene = this.scene;

    // Frame PNG riêng của nhân vật.
    if (frame.file && frameTextures.has(frame.file)) {
      this.setCharacterFrame(sprite, frame.file, frameTextures);
      return;
    }

    const key = sprite === attackerSprite ? "char1" : "char2";

    const textureKey = [
      "clean",
      key,
      frame.x,
      frame.y,
      frame.w,
      frame.h
    ].join("_");

    if (scene.textures.exists(textureKey)) {
      sprite.setTexture(textureKey);
      return;
    }

    const source = scene.textures
      .get(key)
      .getSourceImage();

    const canvas = document.createElement("canvas");

    canvas.width = frame.w;
    canvas.height = frame.h;

    const context = canvas.getContext("2d");

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

    finalCanvas.getContext("2d").drawImage(canvas, 0, 0);

    scene.textures.addCanvas(textureKey, finalCanvas);

    sprite.setTexture(textureKey);
  }
}
