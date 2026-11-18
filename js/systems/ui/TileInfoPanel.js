
import { GAME_HEIGHT, px } from "../../config.js";

/**
 * TILE INFO PANEL
 * Hiện thông tin địa hình của ô vừa chạm (góc dưới trái màn hình).
 */
export class TileInfoPanel {
  constructor(scene, terrainMap) {
    this.terrainMap = terrainMap;

    this.text = scene.add.text(
      px(8),
      GAME_HEIGHT - px(8),
      "",
      {
        fontSize: `${px(10)}px`,
        color: "#ffffff",
        backgroundColor: "#111827",
        padding: { x: px(6), y: px(4) },
        lineSpacing: px(2)
      }
    )
      .setOrigin(0, 1)
      .setDepth(1900)
      .setVisible(false);
  }

  show(x, y, moveType) {
    const terrain = this.terrainMap.terrainAt(x, y);

    if (!terrain) {
      this.hide();
      return;
    }

    const cost = this.terrainMap.moveCost(x, y, moveType);

    this.text
      .setText([
        `${terrain.name} (${x}, ${y})`,
        `Phòng thủ +${terrain.def}   Né +${terrain.avo}`,
        `Di chuyển: ${Number.isFinite(cost) ? cost : "không qua được"}`
      ])
      .setVisible(true);
  }

  hide() {
    this.text.setVisible(false);
  }
}
