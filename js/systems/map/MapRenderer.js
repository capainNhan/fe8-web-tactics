
import { TILE, GRID, px } from "../../config.js";
import { TerrainRenderer } from "./TerrainRenderer.js";
import { SpriteManager } from "../sprites/SpriteManager.js";
import { getBattleSpriteId } from "../../data/battleSprites.js";

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
    this.sprites = new SpriteManager(scene);

    // unit.id -> { container, hpBar }
    this.tokens = new Map();
  }

  drawGrid(highlightTiles = []) {
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

    this.tokens.set(unit.id, { container, hpBar });
  }

  /**
   * Đo vùng có hình của một frame trong sheet: tâm ngang và đáy chân (px trong ô).
   */
  measureFrame(set, index) {
    const image = this.scene.textures
      .get(set.textureKey)
      .getSourceImage();

    const col = index % set.columns;
    const row = Math.floor(index / set.columns);

    const canvas = document.createElement("canvas");
    canvas.width = set.cellW;
    canvas.height = set.cellH;

    const context = canvas.getContext("2d", { willReadFrequently: true });

    context.drawImage(
      image,
      col * set.cellW, row * set.cellH, set.cellW, set.cellH,
      0, 0, set.cellW, set.cellH
    );

    const data = context.getImageData(0, 0, set.cellW, set.cellH).data;

    let minX = set.cellW, maxX = -1, bottom = -1;

    for (let y = 0; y < set.cellH; y++) {
      for (let x = 0; x < set.cellW; x++) {
        if (data[(y * set.cellW + x) * 4 + 3] > 40) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          bottom = y;
        }
      }
    }

    if (maxX < 0) {
      return { centerX: set.cellW / 2, bottom: set.cellH };
    }

    return { centerX: (minX + maxX + 1) / 2, bottom: bottom + 1 };
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

      const flip = set.flipFor(slot);

      const sprite = scene.add.sprite(0, footY, set.textureKey, set.idleFrame);

      // Phaser không lật origin khi flipX, nên không dùng anchor của màn đánh
      // (dễ làm token lệch ô). Thay vào đó đo ngay hình idle: đặt origin ở
      // giữa thân ngang và chạm đáy chân, rồi lật theo hướng nhìn.
      const box = this.measureFrame(set, set.idleFrame);

      const ox = box.centerX / set.cellW;

      sprite
        .setOrigin(flip ? 1 - ox : ox, box.bottom / set.cellH)
        .setScale((TILE * 0.95) / box.bottom)
        .setFlipX(flip);

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
      u(32) * (unit.hp / unit.maxHp)
    );
  }

  syncAll(units) {
    units.forEach(unit => this.syncUnit(unit));
  }
}
