
import { TILE, GRID, px } from "../../config.js";
import { TerrainRenderer } from "./TerrainRenderer.js";

/**
 * MAP RENDERER
 * Vẽ bàn cờ, ô sáng và token của đơn vị trên map.
 * Chỉ lo phần hiển thị, không chứa luật chơi.
 */
// Token thiết kế theo ô 96px; co theo TILE thật của bản đồ.
const FIT = TILE / px(48);
const u = n => px(n) * FIT;

export class MapRenderer {
  constructor(scene, terrainMap) {
    this.scene = scene;

    // Địa hình vẽ một lần, nằm dưới lưới và ô sáng.
    this.terrain = new TerrainRenderer(scene, terrainMap);
    this.terrain.draw();

    this.graphics = scene.add.graphics();

    // unit.id -> { container, hpBar }
    this.tokens = new Map();
  }

  drawGrid(highlightTiles = [], attackTiles = []) {
    const g = this.graphics;

    g.clear();

    // Đường lưới mờ phủ lên địa hình.
    g.lineStyle(px(1), 0x000000, 0.22);

    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        g.strokeRect(x * TILE, y * TILE, TILE, TILE);
      }
    }

    // Ô có thể di chuyển tới.
    highlightTiles.forEach(t => {
      g.fillStyle(0x38bdf8, 0.45);
      g.fillRect(t.x * TILE, t.y * TILE, TILE, TILE);

      g.lineStyle(px(1), 0xe0f2fe, 0.8);
      g.strokeRect(t.x * TILE, t.y * TILE, TILE, TILE);
    });

    // Ô có kẻ địch trong tầm đánh.
    attackTiles.forEach(t => {
      g.fillStyle(0xef4444, 0.5);
      g.fillRect(t.x * TILE, t.y * TILE, TILE, TILE);

      g.lineStyle(px(2), 0xfecaca, 0.95);
      g.strokeRect(t.x * TILE, t.y * TILE, TILE, TILE);
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
    const footY = u(16);

    // Bóng dưới chân mang màu phe, để phân biệt khi hai bên dùng chung sprite.
    const shadow = scene.add.ellipse(
      0, footY, u(34), u(11), teamColor, 0.85
    );

    container.add(shadow);

    const body = this.createBody(unit, footY, teamColor);

    container.add(body);

    const hpBackground = scene.add.rectangle(
      0, u(21), u(32), u(5), 0x000000
    );

    const hpBar = scene.add.rectangle(
      u(-16), u(21), u(32), u(5), 0x22c55e
    ).setOrigin(0, 0.5);

    container.add([hpBackground, hpBar]);

    this.tokens.set(unit.id, {
      container,
      hpBar,
      body,
      footY,
      dying: false
    });

    this.syncUnit(unit);
  }

  /**
   * Hình đại diện trên map: thế đứng chờ (M0_0) do engine TearRing dựng (js/tearring/token.js).
   * Nếu sprite lỗi thì quay về hình tròn có chữ P/E như bản cũ.
   */
  createBody(unit, footY, teamColor) {
    const scene = this.scene;

    try {
      const set = scene.registry.get("trTokens")?.get(unit.trUnit);
      if (!set) throw new Error("chưa có token cho " + unit.trUnit);

      // Quy ước: phe người chơi đứng bên trái màn đánh (nhìn sang phải),
      // phe địch đứng bên phải (nhìn sang trái).
      const slot = unit.team === "player" ? "left" : "right";
      const flip = set.flipFor(slot);

      // Token là ảnh đã cắt sát hình: gốc ở giữa thân, chạm đáy chân.
      const sprite = scene.add.sprite(0, footY, set.textureKey)
        .setOrigin(0.5, 1)
        .setScale(Math.min((TILE * 0.95) / set.h, (TILE * 1.15) / set.w))
        .setFlipX(flip);

      // Để lật hướng khi đi bộ (faceToward/faceDefault).
      sprite.setData("face", { ox: 0.5, oy: 1, baseFlip: flip });
      sprite.setData("set", set);

      return sprite;

    } catch (error) {
      console.warn("Map token dùng hình dự phòng:", error.message);

      const fallback = scene.add.container(0, 0);

      fallback.add([
        scene.add.circle(0, 0, u(18), teamColor),
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

  // Quay đầu sprite theo hướng đi (dx > 0: sang phải, dx < 0: sang trái).
  faceToward(token, dx) {
    const body = token.body;
    const face = body.getData?.("face");
    const set = body.getData?.("set");

    if (!face || dx === 0) return;

    const flip = dx > 0 ? set.flipFor("left") : set.flipFor("right");

    body
      .setOrigin(flip ? 1 - face.ox : face.ox, face.oy)
      .setFlipX(flip);
  }

  faceDefault(token) {
    const face = token.body.getData?.("face");

    if (!face) return;

    token.body
      .setOrigin(face.baseFlip ? 1 - face.ox : face.ox, face.oy)
      .setFlipX(face.baseFlip);
  }

  /**
   * Cho token đi bộ từng ô theo `path` (mảng { x, y }) tới vị trí hiện tại của unit.
   * Không có path thì đi thẳng một bước.
   */
  moveToken(unit, path, onComplete) {
    const token = this.tokens.get(unit.id);

    if (!token) {
      onComplete?.();
      return;
    }

    const steps = path?.length ? path : [{ x: unit.x, y: unit.y }];
    const canBob = token.body.type === "Sprite";

    const walk = index => {
      if (index >= steps.length) {
        this.faceDefault(token);
        onComplete?.();
        return;
      }

      const target = steps[index];
      const x = target.x * TILE + TILE / 2;
      const y = target.y * TILE + TILE / 2;

      this.faceToward(token, x - token.container.x);

      // Nhấp nhô nhẹ mỗi bước cho có cảm giác phi nước kiệu.
      if (canBob) {
        this.scene.tweens.add({
          targets: token.body,
          y: token.footY - u(5),
          duration: 65,
          yoyo: true
        });
      }

      this.scene.tweens.add({
        targets: token.container,
        x,
        y,
        duration: 130,
        ease: "Linear",
        onComplete: () => walk(index + 1)
      });
    };

    walk(0);
  }

  /**
   * Cập nhật token theo dữ liệu đơn vị: thanh HP, xám đi khi đã xong lượt,
   * mờ dần khi gục ngã.
   */
  syncUnit(unit) {
    const token = this.tokens.get(unit.id);

    if (!token) return;

    const ratio = Math.max(0, unit.hp / unit.maxHp);

    token.hpBar.width = u(32) * ratio;
    token.hpBar.setFillStyle(
      ratio > 0.5 ? 0x22c55e : ratio > 0.25 ? 0xeab308 : 0xef4444
    );

    if (token.body.setTint) {
      if (unit.hp > 0 && unit.hasActed) {
        token.body.setTint(0x808080);
      } else {
        token.body.clearTint();
      }
    }

    if (unit.hp <= 0) {
      if (!token.dying && token.container.visible) {
        token.dying = true;

        this.scene.tweens.add({
          targets: token.container,
          alpha: 0,
          duration: 600,
          onComplete: () => token.container.setVisible(false)
        });
      } else if (!token.container.visible) {
        token.container.setAlpha(0);
      }

      return;
    }

    token.dying = false;
    token.container.setVisible(true).setAlpha(1);
  }

  syncAll(units) {
    units.forEach(unit => this.syncUnit(unit));
  }
}
