
import { BattleSpriteSet } from "./BattleSpriteSet.js";
import {
  manifestKey,
  validateManifest
} from "./SpriteLoader.js";

/**
 * SPRITE MANAGER
 * Cấp BattleSpriteSet theo id. Manifest đã được BootScene tải sẵn.
 */
export class SpriteManager {
  constructor(scene) {
    this.scene = scene;
    this.sets = new Map();
  }

  get(id) {
    if (!this.sets.has(id)) {
      const manifest = validateManifest(
        this.scene.cache.json.get(manifestKey(id)),
        id
      );

      this.sets.set(id, new BattleSpriteSet(id, manifest));
    }

    return this.sets.get(id);
  }
}
