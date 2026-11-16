export class SpriteLoader {
  constructor(scene, frameFiles, getTextureKey) {
    this.scene = scene;
    this.frameFiles = frameFiles;
    this.getTextureKey = getTextureKey;
  }

  validateManifest(manifest) {
    const scene = this.scene;

    if (
      !manifest ||
      manifest.format !== "FE8_SPRITE_ANIMATION_V1"
    ) {
      throw new Error("Manifest Char5 không đúng định dạng.");
    }

    if (
      !Array.isArray(manifest.frames) ||
      !manifest.animations ||
      !Array.isArray(manifest.animations.attack?.frames) ||
      !Array.isArray(manifest.animations.return?.frames)
    ) {
      throw new Error("Manifest Char5 thiếu dữ liệu animation.");
    }

    const available = new Set(
      manifest.frames.map(frame => frame.file)
    );

    const usedFrames = [
      ...manifest.animations.attack.frames,
      ...manifest.animations.return.frames
    ];

    for (const file of usedFrames) {
      if (!available.has(file)) {
        throw new Error(
          "Frame không có trong manifest: " + file
        );
      }

      if (!this.frameFiles.includes(file)) {
        throw new Error(
          "Frame chưa được khai báo tải: " + file
        );
      }

      if (!scene.textures.exists(this.getTextureKey(file))) {
        throw new Error(
          "Thiếu file ảnh đang được sử dụng: " + file
        );
      }
    }
  }

  loadTextureReady(key) {
    const scene = this.scene;

    if (
      scene.textures.exists(key) ||
      scene.cache.json.exists(key)
    ) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const onComplete = file => {
        if (file.key === key) {
          cleanup();
          resolve();
        }
      };

      const onError = file => {
        if (file.key === key) {
          cleanup();
          reject(new Error("Lỗi tải: " + key));
        }
      };

      const cleanup = () => {
        scene.load.off(
          Phaser.Loader.Events.FILE_COMPLETE,
          onComplete
        );

        scene.load.off(
          Phaser.Loader.Events.LOAD_ERROR,
          onError
        );
      };

      scene.load.on(
        Phaser.Loader.Events.FILE_COMPLETE,
        onComplete
      );

      scene.load.on(
        Phaser.Loader.Events.LOAD_ERROR,
        onError
      );

      scene.load.start();
    });
  }
}
