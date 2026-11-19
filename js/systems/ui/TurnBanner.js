
import { GAME_WIDTH, GAME_HEIGHT, px } from "../../config.js";

/**
 * TURN BANNER
 * Dải chữ ngang màn hình báo đổi lượt ("LƯỢT ĐỊCH", "LƯỢT 2 - NGƯỜI CHƠI").
 * show() trả về Promise, xong khi banner đã biến mất.
 */
export class TurnBanner {
  constructor(scene) {
    this.scene = scene;
  }

  show(text, color = 0x2563eb, holdMs = 700) {
    const scene = this.scene;

    return new Promise(resolve => {
      const y = GAME_HEIGHT / 2;

      const band = scene.add
        .rectangle(GAME_WIDTH / 2, y, GAME_WIDTH, px(56), color, 0.92)
        .setDepth(3000)
        .setAlpha(0);

      const label = scene.add
        .text(GAME_WIDTH / 2 - px(40), y, text, {
          fontSize: `${px(22)}px`,
          fontStyle: "bold",
          color: "#ffffff"
        })
        .setOrigin(0.5)
        .setDepth(3001)
        .setAlpha(0);

      // Trượt vào, giữ lại một lát, rồi mờ dần.
      scene.tweens.add({
        targets: [band, label],
        alpha: 1,
        duration: 180
      });

      scene.tweens.add({
        targets: label,
        x: GAME_WIDTH / 2,
        duration: 260,
        ease: "Cubic.easeOut"
      });

      scene.time.delayedCall(holdMs, () => {
        scene.tweens.add({
          targets: [band, label],
          alpha: 0,
          duration: 220,
          onComplete: () => {
            band.destroy();
            label.destroy();
            resolve();
          }
        });
      });
    });
  }
}
