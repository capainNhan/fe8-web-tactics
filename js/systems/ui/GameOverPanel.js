
import { GAME_WIDTH, GAME_HEIGHT, px } from "../../config.js";

/**
 * GAME OVER PANEL
 * Màn kết quả khi ván kết thúc: CHIẾN THẮNG / THẤT BẠI kèm nút CHƠI LẠI.
 * Khi đang hiện, MapScene khoá mọi thao tác trên bản đồ.
 */
export class GameOverPanel {
  constructor(scene, onRestart) {
    this.scene = scene;
    this.onRestart = onRestart;
    this.visible = false;
    this.objects = [];
  }

  show(outcome) {
    if (this.visible) return;

    this.visible = true;

    const scene = this.scene;
    const won = outcome.winner === "player";
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;

    const overlay = scene.add
      .rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.7)
      .setDepth(4000)
      .setInteractive();

    const title = scene.add
      .text(cx, cy - px(40), won ? "CHIẾN THẮNG!" : "THẤT BẠI", {
        fontSize: `${px(34)}px`,
        fontStyle: "bold",
        color: won ? "#fbbf24" : "#f87171"
      })
      .setOrigin(0.5)
      .setDepth(4001);

    const reason = scene.add
      .text(cx, cy, outcome.reason, {
        fontSize: `${px(13)}px`,
        color: "#e5e7eb",
        align: "center",
        wordWrap: { width: GAME_WIDTH - px(60) }
      })
      .setOrigin(0.5)
      .setDepth(4001);

    const button = scene.add
      .text(cx, cy + px(52), "CHƠI LẠI", {
        fontSize: `${px(16)}px`,
        fontStyle: "bold",
        color: "#ffffff",
        backgroundColor: "#2563eb",
        padding: { x: px(18), y: px(9) }
      })
      .setOrigin(0.5)
      .setDepth(4001)
      .setInteractive({ useHandCursor: true });

    button.on("pointerdown", () => this.onRestart());

    this.objects = [overlay, title, reason, button];

    title.setScale(0.6).setAlpha(0);

    scene.tweens.add({
      targets: title,
      scale: 1,
      alpha: 1,
      duration: 350,
      ease: "Back.easeOut"
    });
  }

  hide() {
    this.objects.forEach(o => o.destroy());
    this.objects = [];
    this.visible = false;
  }
}
