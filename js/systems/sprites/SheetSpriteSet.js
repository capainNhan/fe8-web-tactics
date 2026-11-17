
import { BATTLE_SPRITES } from "../../data/battleSprites.js";
import { imageKey } from "./SpriteLoader.js";

/**
 * SHEET SPRITE SET
 * Bộ sprite trận đánh của một nhân vật, dựng từ spritesheet.json
 * (TearRing Compositor) và cấu hình trong battleSprites.js.
 *
 * Giao diện dùng bởi BattleScene:
 *   animation(role) -> { steps: [{ index, ms }], totalMs, impactMs } | null
 *   applyFrame(sprite, index)
 *   flipFor(slot), scale, idleFrame, restFrame, reach
 */
export class SheetSpriteSet {
  constructor(id, sheet, columns) {
    const config = BATTLE_SPRITES[id];

    this.id = id;
    this.sheet = sheet;
    this.config = config;
    this.columns = columns;

    this.facing = config.facing === "right" ? "right" : "left";
    this.scale = config.scale > 0 ? config.scale : 1;
    this.reach = config.reach ?? 100;
    this.anchor = config.anchor;

    this.cellW = sheet.frameSize.w;
    this.cellH = sheet.frameSize.h;
  }

  get textureKey() {
    return imageKey(this.id);
  }

  // "f017" -> số thứ tự ô trên lưới (theo hàng, từ trái sang phải).
  frameIndex(name) {
    const frame = this.sheet.frames[name];

    if (!frame) {
      throw new Error(`${this.id}: không có frame "${name}".`);
    }

    return (
      (frame.y / this.cellH) * this.columns +
      frame.x / this.cellW
    );
  }

  hasAnimation(role) {
    return !!this.animation(role);
  }

  animation(role) {
    const code = this.config.roles[role];
    const raw = code && this.sheet.animations[code];

    if (!raw?.length) return null;

    const steps = raw.map(step => ({
      index: this.frameIndex(step.frame),
      ms: step.ms
    }));

    const totalMs = steps.reduce((sum, s) => sum + s.ms, 0);

    // Thời điểm đòn chạm mục tiêu = tổng ms của các bước đứng trước.
    const impactStep = Math.min(
      this.config.impact?.[code] ?? steps.length - 1,
      steps.length - 1
    );

    const impactMs = steps
      .slice(0, impactStep)
      .reduce((sum, s) => sum + s.ms, 0);

    return { steps, totalMs, impactMs };
  }

  get idleFrame() {
    return this.animation("idle").steps[0].index;
  }

  // Frame giữ giữa các đòn, sau khi bên này đã ra đòn.
  get restFrame() {
    return this.frameIndex(this.config.rest);
  }

  // Sprite bên "left" nhìn sang phải, bên "right" nhìn sang trái.
  flipFor(slot) {
    return slot === "left"
      ? this.facing === "left"
      : this.facing === "right";
  }

  // Đổi frame và đặt origin vào điểm chân chung của sheet.
  applyFrame(sprite, index) {
    sprite.setTexture(this.textureKey, index);

    sprite.setOrigin(
      this.anchor.x / this.cellW,
      this.anchor.y / this.cellH
    );

    return sprite;
  }
}
