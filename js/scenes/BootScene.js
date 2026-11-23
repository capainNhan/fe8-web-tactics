
import {
  BATTLE_SPRITE_IDS
} from "../data/battleSprites.js";
import {
  queueSheets,
  queueImages
} from "../systems/sprites/SpriteLoader.js";
import { TEARRING_ROOT, TEARRING_UNITS } from "../data/tearringUnits.js";
import { log } from "../systems/GameLog.js";
import { preloadMusic } from "../systems/audio/index.js";

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

    // Engine TearRing: bảng chung + gói dữ liệu từng unit (xem tools/tearring_extract.py).
    this.load.json("tr-common", TEARRING_ROOT + "common.json");
    this.load.binary("tr-rsincos", TEARRING_ROOT + "rsincos.bin");
    for (const id of Object.keys(TEARRING_UNITS)) this.load.binary("tr-" + id, TEARRING_ROOT + id + ".pak");

    // Tải ngầm nhạc để vào trận không bị trễ (không chặn boot).
    preloadMusic();
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
      20,
      20,
      "Lỗi tải sprite:\n" + error.message,
      {
        fontSize: "20px",
        color: "#fca5a5",
        wordWrap: { width: 720 }
      }
    );
  }
}
