
import { SheetSpriteSet } from "./SheetSpriteSet.js";
import {
  sheetKey,
  imageKey,
  validateSheet
} from "./SpriteLoader.js";

/**
 * SPRITE MANAGER
 * Cấp SheetSpriteSet theo id. JSON và ảnh đã được BootScene tải sẵn.
 */
export class SpriteManager {
  constructor(scene) {
    this.scene = scene;
    this.sets = new Map();
  }

  get(id) {
    if (!this.sets.has(id)) {
      const sheet = validateSheet(
        this.scene.cache.json.get(sheetKey(id)),
        id
      );

      const source = this.scene.textures
        .get(imageKey(id))
        .getSourceImage();

      const columns = Math.floor(source.width / sheet.frameSize.w);

      this.sets.set(id, new SheetSpriteSet(id, sheet, columns));
    }

    return this.sets.get(id);
  }
}
