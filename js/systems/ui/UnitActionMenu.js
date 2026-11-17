import {
  TILE,
  GAME_WIDTH,
  GAME_HEIGHT
} from "../../config.js";

export class UnitActionMenu {
  constructor(scene, onSelect) {
    this.scene = scene;
    this.onSelect = onSelect;
    this.container = scene.add.container(0, 0)
      .setDepth(1500)
      .setVisible(false);

    this.background = scene.add.rectangle(
      0, 0, 112, 86, 0x18263b, 0.98
    ).setOrigin(0);

    this.border = scene.add.rectangle(
      0, 0, 112, 86
    )
      .setOrigin(0)
      .setStrokeStyle(2, 0xc5a86a);

    this.container.add([
      this.background,
      this.border
    ]);

    this.buttons = [];
    this.visible = false;
  }

  show(unit, actions) {
    this.hide();

    const scene = this.scene;
    const width = 112;
    const rowHeight = 25;
    const height = actions.length * rowHeight + 12;

    const x = Math.min(
      Math.max(4, unit.x * TILE + TILE),
      GAME_WIDTH - width - 4
    );

    const y = Math.min(
      Math.max(4, unit.y * TILE),
      GAME_HEIGHT - height - 4
    );

    this.container.setPosition(x, y);
    this.background.setSize(width, height);
    this.border.setSize(width, height);

    actions.forEach((action, index) => {
      const label = scene.add.text(
        10,
        7 + index * rowHeight,
        action.label,
        {
          fontFamily: "Arial",
          fontSize: "13px",
          color: action.enabled ? "#f4e5bd" : "#777777",
          fontStyle: "bold"
        }
      ).setInteractive({
        useHandCursor: true
      });

      label.on("pointerdown", pointer => {
        if (!action.enabled) return;

        pointer.event?.stopPropagation?.();
        this.onSelect(action.id);
      });

      label.on("pointerover", () => {
        if (action.enabled) {
          label.setColor("#ffffff");
        }
      });

      label.on("pointerout", () => {
        label.setColor(
          action.enabled ? "#f4e5bd" : "#777777"
        );
      });

      this.container.add(label);
      this.buttons.push(label);
    });

    this.container.setVisible(true);
    this.visible = true;
  }

  hide() {
    this.buttons.forEach(button => button.destroy());
    this.buttons = [];

    this.container.setVisible(false);
    this.visible = false;
  }

  contains(x, y) {
    if (!this.visible) return false;

    return this.container.getBounds().contains(x, y);
  }

  destroy() {
    this.hide();
    this.container.destroy();
  }
}

