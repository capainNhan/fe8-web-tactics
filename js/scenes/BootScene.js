import { TEARRING_ROOT, TEARRING_UNITS } from "../data/tearringUnits.js";
import { buildTokens } from "../tearring/token.js";
import { log } from "../systems/GameLog.js";
import { preloadMusic } from "../systems/audio/index.js";

/**
 * BOOT SCENE
 * Tải dữ liệu engine TearRing (bảng chung + gói từng unit), dựng token map, rồi sang MapScene.
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

    // Bảng chung + gói dữ liệu từng unit (xem tools/tearring_extract.py).
    this.load.json("tr-common", TEARRING_ROOT + "common.json");
    this.load.binary("tr-rsincos", TEARRING_ROOT + "rsincos.bin");
    for (const id of Object.keys(TEARRING_UNITS)) this.load.binary("tr-" + id, TEARRING_ROOT + id + ".pak");

    // Tải ngầm nhạc để vào trận không bị trễ (không chặn boot).
    preloadMusic();
  }

  create() {
    try {
      this.registry.set("trTokens", buildTokens(this, TEARRING_UNITS));
    } catch (error) {
      this.showError(error);
      return;
    }
    this.scene.start("MapScene");
  }

  showError(error) {
    console.error("Boot error:", error);
    log("Lỗi dựng unit: " + error.message);
    this.add.text(20, 20, "Lỗi dựng unit:\n" + error.message, {
      fontSize: "20px", color: "#fca5a5", wordWrap: { width: 720 }
    });
  }
}
