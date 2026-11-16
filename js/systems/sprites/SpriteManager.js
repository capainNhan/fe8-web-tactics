
import { SpriteLoader } from "./SpriteLoader.js";
import { SpriteAnimator } from "./SpriteAnimator.js";
import {
  autoSlice,
  getIdleFrame
} from "../spriteSheet.js";

export class SpriteManager {
  constructor(scene, config) {
    this.scene = scene;
    this.frameFiles = config.frameFiles;
    this.getTextureKey = config.getTextureKey;

    this.loader = new SpriteLoader(
      scene,
      this.frameFiles,
      this.getTextureKey
    );

    this.animator = new SpriteAnimator(scene);

    this.manifest = null;
    this.frameTextures = new Map();

    this.animations = {
      player: null,
      enemy: null
    };

    this.ready = false;
  }

  async prepare(attackerSprite, defenderSprite) {
    const scene = this.scene;

    this.ready = false;

    await Promise.all([
      this.loader.loadTextureReady("char1"),
      this.loader.loadTextureReady("char2"),
      this.loader.loadTextureReady("char5Manifest"),
      ...this.frameFiles.map(file =>
        this.loader.loadTextureReady(
          this.getTextureKey(file)
        )
      )
    ]);

    const manifest = scene.cache.json.get(
      "char5Manifest"
    );

    this.loader.validateManifest(manifest);

    this.manifest = manifest;
    this.frameTextures.clear();

    const usedFrames = new Set([
      ...manifest.animations.attack.frames,
      ...manifest.animations.return.frames
    ]);

    for (const file of usedFrames) {
      const key = this.getTextureKey(file);

      if (!scene.textures.exists(key)) {
        throw new Error(
          "Không tìm thấy texture Char4: " + file
        );
      }

      this.frameTextures.set(file, key);
    }

    this.animations.player = {
      type: "manifest",
      attack: manifest.animations.attack.frames,
      return: manifest.animations.return.frames,
      frameDurationMs: manifest.frameDurationMs || 50
    };

    this.animations.enemy = autoSlice(
      scene.textures.get("char2").getSourceImage()
    );

    const idleFile =
      manifest.animations.attack.frames[0];

    if (!this.setCharacterFrame(
      attackerSprite,
      idleFile
    )) {
      throw new Error(
        "Không thể gán frame Char4 vào attackerSprite."
      );
    }

    this.setFrame(
      defenderSprite,
      getIdleFrame(this.animations.enemy),
      attackerSprite
    );

    this.ready = true;

    return {
      idle: idleFile,
      attack: this.animations.player.attack,
      return: this.animations.player.return
    };
  }

  setCharacterFrame(sprite, file) {
    return this.animator.setCharacterFrame(
      sprite,
      file,
      this.frameTextures
    );
  }

  setFrame(sprite, frame, attackerSprite) {
    return this.animator.setFrame(
      sprite,
      frame,
      this.frameTextures,
      attackerSprite
    );
  }
}
