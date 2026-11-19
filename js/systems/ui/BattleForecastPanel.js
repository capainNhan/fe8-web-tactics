
import {
  TILE,
  GAME_WIDTH,
  GAME_HEIGHT,
  px
} from "../../config.js";

/**
 * BATTLE FORECAST PANEL
 * Bảng dự đoán trước khi đánh: HP, sát thương, tỉ lệ trúng, chí mạng của hai bên,
 * cùng nút TẤN CÔNG / HỦY. Số liệu lấy từ core/Forecast.js.
 */
export class BattleForecastPanel {
  constructor(scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0)
      .setDepth(1800)
      .setVisible(false);

    this.visible = false;
  }

  show(forecast, targetTileY, { onConfirm, onCancel }) {
    this.hide();

    const scene = this.scene;
    const width = px(310);
    const height = px(142);

    const x = (GAME_WIDTH - width) / 2;

    // Đặt panel ở nửa màn hình đối diện mục tiêu để không che nó.
    const y = targetTileY * TILE > GAME_HEIGHT / 2
      ? px(48)
      : GAME_HEIGHT - height - px(8);

    const background = scene.add
      .rectangle(x, y, width, height, 0x111c30, 0.97)
      .setOrigin(0);

    const border = scene.add
      .rectangle(x, y, width, height)
      .setOrigin(0)
      .setStrokeStyle(px(2), 0xc5a86a);

    this.container.add([background, border]);

    const text = (cx, cy, value, color = "#f4e5bd", size = 12) =>
      scene.add
        .text(cx, cy, value, {
          fontFamily: "Arial",
          fontSize: `${px(size)}px`,
          fontStyle: "bold",
          color
        })
        .setOrigin(0.5);

    const leftX = x + px(66);
    const midX = x + width / 2;
    const rightX = x + width - px(66);

    const a = forecast.attacker;
    const d = forecast.defender;

    const dmg = side =>
      side.times === 0
        ? "—"
        : `${side.dmg}${side.times > 1 ? " x2" : ""}`;

    const pct = (side, value) =>
      side.times === 0 ? "—" : `${value}%`;

    const rows = [
      ["HP", `${a.hp}/${a.maxHp}`, `${d.hp}/${d.maxHp}`],
      ["Sát thương", dmg(a), dmg(d)],
      ["Chính xác", pct(a, a.hit), pct(d, d.hit)],
      ["Chí mạng", pct(a, a.crit), pct(d, d.crit)]
    ];

    this.container.add([
      text(leftX, y + px(14), a.name, "#7dd3fc", 11),
      text(rightX, y + px(14), d.name, "#fca5a5", 11)
    ]);

    rows.forEach(([label, left, right], index) => {
      const rowY = y + px(36) + index * px(19);

      this.container.add([
        text(midX, rowY, label, "#9ca3af", 10),
        text(leftX, rowY, left, "#ffffff", 12),
        text(rightX, rowY, right, "#ffffff", 12)
      ]);
    });

    const makeButton = (cx, label, color, handler) => {
      const button = scene.add
        .text(cx, y + height - px(18), label, {
          fontFamily: "Arial",
          fontSize: `${px(12)}px`,
          fontStyle: "bold",
          color: "#ffffff",
          backgroundColor: color,
          padding: { x: px(14), y: px(6) }
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

      button.on("pointerdown", pointer => {
        pointer.event?.stopPropagation?.();
        handler();
      });

      this.container.add(button);
    };

    makeButton(x + width * 0.3, "TẤN CÔNG", "#b91c1c", onConfirm);
    makeButton(x + width * 0.7, "HỦY", "#4b5563", onCancel);

    this.container.setVisible(true);
    this.visible = true;
  }

  hide() {
    this.container.removeAll(true);
    this.container.setVisible(false);
    this.visible = false;
  }

  contains(x, y) {
    if (!this.visible) return false;

    return this.container.getBounds().contains(x, y);
  }
}
