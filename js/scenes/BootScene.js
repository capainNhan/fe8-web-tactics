
import { loadBattleAssets } from "../data/battleAssets.js";

/**
 * BOOT SCENE
 * Tải toàn bộ asset một lần, rồi chuyển sang MapScene.
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

    loadBattleAssets(this);
  }

  create() {
    this.scene.start("MapScene");
  }
}
