
/**
 * SPRITE MANAGER
 * Centralized image and animation processing system.
 *
 * Sprite sheet contract:
 * Row 0: Idle / Windup
 * Row 1: Attack
 * Row 2: Critical
 * Row 3: Dodge
 */

import {
  autoSlice,
  getAnimationFrames,
  getIdleFrame
} from "./spriteSheet.js";

export const ANIMATION_ROWS = Object.freeze({
  IDLE: 0,
  ATTACK: 1,
  CRITICAL: 2,
  DODGE: 3
});

export class SpriteManager {
  constructor(scene, options = {}) {
    if (!scene) {
      throw new Error("SpriteManager: Missing Phaser scene.");
    }

    this.scene = scene;

    this.options = {
      whiteThreshold: 230,
      removeWhiteBackground: true,
      trailingGap: 4,
      ...options
    };

    this.sheets = new Map();
    this.frameCache = new Map();
  }

  /**
   * Register and analyze a sprite sheet.
   */
  register(key, image, sliceOptions = {}) {
    if (!key || !image) {
      throw new Error("SpriteManager: Invalid image.");
    }

    const detected = autoSlice(image, sliceOptions);

    // Preserve exactly four animation rows.
    const rows = Array.from({ length: 4 }, (_, index) => {
      return detected[index] || {
        y: 0,
        height: 0,
        groundY: 0,
        frames: []
      };
    });

    this.sheets.set(key, {
      key,
      image,
      rows,
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height
    });

    return rows;
  }

  /**
   * Get registered sprite sheet.
   */
  getSheet(key) {
    return this.sheets.get(key) || null;
  }

  /**
   * Get animation frames by row.
   */
  getAnimation(key, rowIndex) {
    const sheet = this.getSheet(key);

    if (!sheet || rowIndex < 0 || rowIndex > 3) {
      return [];
    }

    return getAnimationFrames(sheet.rows, rowIndex);
  }

  /**
   * Get idle frame.
   */
  getIdle(key) {
    const sheet = this.getSheet(key);

    if (!sheet) return null;

    return getIdleFrame(sheet.rows, 0);
  }

  /**
   * Get animation frame count.
   */
  getFrameCount(key, rowIndex) {
    return this.getAnimation(key, rowIndex).length;
  }

  /**
   * Generate unique texture key.
   */
  getTextureKey(key, frame) {
    return [
      "sprite",
      key,
      frame.x,
      frame.y,
      frame.w,
      frame.h
    ].join("_");
  }

  /**
   * Extract and clean an individual frame.
   */
  extractFrame(image, frame) {
    const canvas = document.createElement("canvas");

    canvas.width = frame.w;
    canvas.height = frame.h;

    const ctx = canvas.getContext("2d", {
      willReadFrequently: true
    });

    if (!ctx) {
      throw new Error("SpriteManager: Canvas unavailable.");
    }

    ctx.drawImage(
      image,
      frame.x,
      frame.y,
      frame.w,
      frame.h,
      0,
      0,
      frame.w,
      frame.h
    );

    const imageData = ctx.getImageData(
      0,
      0,
      frame.w,
      frame.h
    );

    const pixels = imageData.data;

    // Remove white background.
    if (this.options.removeWhiteBackground) {
      const threshold = this.options.whiteThreshold;

      for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];

        if (
          r >= threshold &&
          g >= threshold &&
          b >= threshold
        ) {
          pixels[i + 3] = 0;
        }
      }
    }

    // Remove detached pixels below the character.
    let lastInkY = -1;
    let emptyRows = 0;

    for (let y = 0; y < frame.h; y++) {
      let hasInk = false;

      for (let x = 0; x < frame.w; x++) {
        const index = (y * frame.w + x) * 4;

        if (pixels[index + 3] > 0) {
          hasInk = true;
          break;
        }
      }

      if (hasInk) {
        lastInkY = y;
        emptyRows = 0;
      } else if (lastInkY >= 0) {
        emptyRows++;

        if (emptyRows >= this.options.trailingGap) {
          const cutFrom = y - emptyRows + 1;

          for (let cy = cutFrom; cy < frame.h; cy++) {
            for (let cx = 0; cx < frame.w; cx++) {
              const index = (cy * frame.w + cx) * 4;
              pixels[index + 3] = 0;
            }
          }

          break;
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);

    const outputHeight = Math.max(1, lastInkY + 1);

    if (outputHeight === frame.h) {
      return canvas;
    }

    const trimmed = document.createElement("canvas");

    trimmed.width = frame.w;
    trimmed.height = outputHeight;

    trimmed.getContext("2d").drawImage(
      canvas,
      0,
      0,
      frame.w,
      outputHeight
    );

    return trimmed;
  }

  /**
   * Create or reuse an extracted Phaser texture.
   */
  createFrameTexture(key, frame) {
    const sheet = this.getSheet(key);

    if (!sheet) {
      throw new Error(
        "SpriteManager: Sheet not registered: " + key
      );
    }

    const textureKey = this.getTextureKey(key, frame);

    if (this.scene.textures.exists(textureKey)) {
      return textureKey;
    }

    const canvas = this.extractFrame(
      sheet.image,
      frame
    );

    this.scene.textures.addCanvas(
      textureKey,
      canvas
    );

    this.frameCache.set(textureKey, true);

    return textureKey;
  }

  /**
   * Apply frame to Phaser Image.
   */
  setFrame(sprite, key, frame) {
    if (!sprite || !frame) return false;

    const textureKey = this.createFrameTexture(
      key,
      frame
    );

    sprite.setTexture(textureKey);

    return true;
  }

  /**
   * Apply idle animation.
   */
  setIdle(sprite, key) {
    const frame = this.getIdle(key);

    if (!frame) return false;

    return this.setFrame(sprite, key, frame);
  }

  /**
   * Destroy cached textures.
   */
  destroy() {
    for (const textureKey of this.frameCache.keys()) {
      if (this.scene.textures.exists(textureKey)) {
        this.scene.textures.remove(textureKey);
      }
    }

    this.frameCache.clear();
    this.sheets.clear();
  }
}
