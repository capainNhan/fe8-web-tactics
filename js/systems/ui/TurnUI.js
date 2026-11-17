
import { GAME_WIDTH } from "../../config.js";

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
      8,
      8,
      "",
      {
        fontSize: "12px",
        color: "#ffffff",
        backgroundColor: "#111827",
        padding: { x: 7, y: 5 }
      }
    );

    this.endButton = scene.add.text(
      GAME_WIDTH - 8,
      8,
      "KẾT THÚC LƯỢT",
      {
        fontSize: "11px",
        color: "#ffffff",
        backgroundColor: "#166534",
        padding: { x: 8, y: 6 }
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
