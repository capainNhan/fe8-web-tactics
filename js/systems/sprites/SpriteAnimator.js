
import { SpriteProcessor } from "./SpriteProcessor.js";

export class SpriteAnimator {
  constructor(scene) {
    this.scene = scene;
    this.processor = new SpriteProcessor();
  }
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

const processedCanvas = this.processor.processFrame(
  source,
  frame
);

scene.textures.addCanvas(
  textureKey,
  processedCanvas
);

sprite.setTexture(textureKey);
  }
}
