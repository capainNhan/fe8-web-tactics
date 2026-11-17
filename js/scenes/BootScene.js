
import {
  BATTLE_SPRITE_IDS
} from "../data/battleSprites.js";
import {
  queueSheets,
  queueImages
} from "../systems/sprites/SpriteLoader.js";
import { log } from "../systems/GameLog.js";

/**
 * BOOT SCENE
 * Tải asset rồi chuyển sang MapScene.
 * Hai pha: manifest trước, sau đó chỉ tải những frame manifest dùng.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  preload() {
    this.load.on(
      Phaser.Loader.Events.LOAD_ERROR,
      file => console.error("Lỗi tải asset:", file.key, file.src)
    );

    queueSheets(this, BATTLE_SPRITE_IDS);
  }

  create() {
    try {
      queueImages(this, BATTLE_SPRITE_IDS);

    } catch (error) {
      this.showError(error);
      return;
    }

    this.load.once(
      Phaser.Loader.Events.COMPLETE,
      () => this.scene.start("MapScene")
    );

    this.load.start();
  }

  showError(error) {
    console.error("Boot error:", error);

    log("Lỗi tải sprite: " + error.message);

    this.add.text(
      12,
      12,
      "Lỗi tải sprite:\n" + error.message,
      {
        fontSize: "12px",
        color: "#fca5a5",
        wordWrap: { width: 360 }
      }
    );
  }
}
