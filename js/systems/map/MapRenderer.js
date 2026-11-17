
import { TILE, GRID, px } from "../../config.js";
import { SpriteManager } from "../sprites/SpriteManager.js";
import { getBattleSpriteId } from "../../data/battleSprites.js";

/**
 * MAP RENDERER
 * Vẽ bàn cờ, ô sáng và token của đơn vị trên map.
 * Chỉ lo phần hiển thị, không chứa luật chơi.
 */
export class MapRenderer {
  constructor(scene) {
    this.scene = scene;
    this.graphics = scene.add.graphics();
    this.sprites = new SpriteManager(scene);

    // unit.id -> { container, hpBar }
    this.tokens = new Map();
  }

  drawGrid(highlightTiles = []) {
    const g = this.graphics;

    g.clear();

    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        g.fillStyle(
          (x + y) % 2 === 0
            ? 0x22223b
            : 0x2a2a4a
        );

        g.fillRect(
          x * TILE,
          y * TILE,
          TILE,
          TILE
        );

        g.lineStyle(px(1), 0x44445a);

        g.strokeRect(
          x * TILE,
          y * TILE,
          TILE,
          TILE
        );
      }
    }

    highlightTiles.forEach(t => {
      g.fillStyle(0x2ecc71, 0.4);

      g.fillRect(
        t.x * TILE,
        t.y * TILE,
        TILE,
        TILE
      );
    });
  }

  createUnitTokens(units) {
    units.forEach(unit => this.createToken(unit));
  }

  createToken(unit) {
    const scene = this.scene;
    const teamColor = unit.team === "player" ? 0x3498db : 0xe74c3c;

    const container = scene.add.container(
      unit.x * TILE + TILE / 2,
      unit.y * TILE + TILE / 2
    );

    // Chân nhân vật đứng thấp hơn tâm ô một chút, chừa chỗ cho thanh HP.
    const footY = px(16);

    // Bóng dưới chân mang màu phe, để phân biệt khi hai bên dùng chung sprite.
    const shadow = scene.add.ellipse(
      0, footY, px(34), px(11), teamColor, 0.85
    );

    container.add(shadow);

    const body = this.createBody(unit, footY, teamColor);

    container.add(body);

    const hpBackground = scene.add.rectangle(
      0, px(21), px(32), px(5), 0x000000
    );

    const hpBar = scene.add.rectangle(
      px(-16), px(21), px(32), px(5), 0x22c55e
    ).setOrigin(0, 0.5);

    container.add([hpBackground, hpBar]);

    this.tokens.set(unit.id, { container, hpBar });
  }

  /**
   * Hình đại diện trên map: frame đứng chờ (idle) của sprite trận đánh.
   * Nếu sprite lỗi thì quay về hình tròn có chữ P/E như bản cũ.
   */
  createBody(unit, footY, teamColor) {
    const scene = this.scene;

    try {
      const set = this.sprites.get(getBattleSpriteId(unit));

      // Quy ước: phe người chơi đứng bên trái màn đánh (nhìn sang phải),
      // phe địch đứng bên phải (nhìn sang trái).
      const slot = unit.team === "player" ? "left" : "right";

      const sprite = scene.add.sprite(0, footY, set.textureKey, set.idleFrame);

      set.applyFrame(sprite, set.idleFrame);

      sprite
        .setScale((TILE * 0.95) / set.anchor.y)
        .setFlipX(set.flipFor(slot));

      return sprite;

    } catch (error) {
      console.warn("Map token dùng hình dự phòng:", error.message);

      const fallback = scene.add.container(0, 0);

      fallback.add([
        scene.add.circle(0, 0, px(18), teamColor),
        scene.add.text(
          px(-7),
          px(-9),
          unit.team === "player" ? "P" : "E",
          { fontSize: `${px(15)}px`, color: "#fff" }
        )
      ]);

      return fallback;
    }
  }

  /**
   * Di chuyển token tới vị trí (x, y) hiện tại của unit.
   */
  moveToken(unit, onComplete) {
    const token = this.tokens.get(unit.id);

    if (!token) {
      onComplete?.();
      return;
    }

    this.scene.tweens.add({
      targets: token.container,
      x: unit.x * TILE + TILE / 2,
      y: unit.y * TILE + TILE / 2,
      duration: 200,
      ease: "Power2",
      onComplete: () => onComplete?.()
    });
  }

  /**
   * Cập nhật token theo dữ liệu đơn vị (HP, còn sống hay không).
   */
  syncUnit(unit) {
    const token = this.tokens.get(unit.id);

    if (!token) return;

    token.container.setVisible(unit.hp > 0);

    token.hpBar.width = Math.max(
      0,
      px(32) * (unit.hp / unit.maxHp)
    );
  }

  syncAll(units) {
    units.forEach(unit => this.syncUnit(unit));
  }
}
