
import { GAME_WIDTH, px } from "../../config.js";

/**
 * TURN UI
 * Nhãn "LƯỢT n - PHE" và nút KẾT THÚC LƯỢT.
 */
export class TurnUI {
  constructor(scene, onEndTurn) {
    this.canEndTurn = false;

    this.container = scene.add.container(0, 0)
      .setDepth(2000);

    this.label = scene.add.text(
      px(8),
      px(8),
      "",
      {
        fontSize: `${px(12)}px`,
        color: "#ffffff",
        backgroundColor: "#111827",
        padding: { x: px(7), y: px(5) }
      }
    );

    this.endButton = scene.add.text(
      GAME_WIDTH - px(8),
      px(8),
      "KẾT THÚC LƯỢT",
      {
        fontSize: `${px(11)}px`,
        color: "#ffffff",
        backgroundColor: "#166534",
        padding: { x: px(8), y: px(6) }
      }
    )
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });

    this.endButton.on("pointerdown", () => {
      onEndTurn();
    });

    this.endButton.on("pointerover", () => {
      if (this.canEndTurn) {
        this.endButton.setBackgroundColor("#15803d");
      }
    });

    this.endButton.on("pointerout", () => {
      this.endButton.setBackgroundColor(
        this.canEndTurn ? "#166534" : "#4b5563"
      );
    });

    this.container.add([
      this.label,
      this.endButton
    ]);
  }

  update({ turn, phase, canEndTurn }) {
    this.canEndTurn = canEndTurn;

    const phaseText =
      phase === "player"
        ? "LƯỢT NGƯỜI CHƠI"
        : "LƯỢT ĐỊCH";

    this.label.setText(`LƯỢT ${turn} - ${phaseText}`);

    this.endButton
      .setAlpha(canEndTurn ? 1 : 0.55)
      .setBackgroundColor(
        canEndTurn ? "#166534" : "#4b5563"
      );
  }

  contains(x, y) {
    return this.endButton.getBounds().contains(x, y);
  }
}
