
import { frameKey } from "./SpriteLoader.js";

const DEFAULT_SCALE = 2;
const DEFAULT_FRAME_MS = 50;

/**
 * BATTLE SPRITE SET
 * Bộ sprite trận đánh của một nhân vật, dựng từ manifest.json.
 *
 * Manifest V2:
 *   facing   : hướng nhìn của ảnh gốc ("left" | "right")
 *   scale    : phóng to khi hiển thị
 *   frames[] : { file, width, height, anchor: { x, y } }
 *              anchor = điểm chân trên ảnh, sprite luôn được đặt sao cho
 *              điểm này nằm đúng vị trí; y lớn hơn đáy ảnh nghĩa là đang bay.
 *   animations: idle, windup, attack, crit, return
 *              mỗi animation: { frames, frameDurationMs?, impactFrame? }
 */
export class BattleSpriteSet {
  constructor(id, manifest) {
    this.id = id;
    this.manifest = manifest;

    this.facing = manifest.facing === "right" ? "right" : "left";

    this.scale =
      Number(manifest.scale) > 0
        ? Number(manifest.scale)
        : DEFAULT_SCALE;

    this.defaultFrameMs =
      manifest.frameDurationMs || DEFAULT_FRAME_MS;

    this.frames = new Map(
      manifest.frames.map(frame => [frame.file, frame])
    );
  }

  hasAnimation(name) {
    return !!this.manifest.animations?.[name]?.frames?.length;
  }

  /**
   * Trả về { frames, frameDurationMs, impactFrame } hoặc null nếu không có.
   * impactFrame: số thứ tự frame mà đòn đánh chạm mục tiêu.
   */
  animation(name) {
    const raw = this.manifest.animations?.[name];

    if (!raw?.frames?.length) return null;

    const last = raw.frames.length - 1;

    // Manifest V1 không có impactFrame: dùng frame thứ 8 như trước đây.
    const impact = raw.impactFrame ?? Math.min(8, last);

    return {
      frames: raw.frames,
      frameDurationMs: raw.frameDurationMs || this.defaultFrameMs,
      impactFrame: Math.max(0, Math.min(impact, last))
    };
  }

  get idleFile() {
    return (
      this.manifest.animations?.idle?.frames?.[0] ??
      this.manifest.animations.attack.frames[0]
    );
  }

  // Điểm chân của frame; thiếu anchor thì lấy giữa đáy ảnh.
  anchorOf(file) {
    const frame = this.frames.get(file);

    if (!frame) {
      throw new Error(`${this.id}: không có frame "${file}".`);
    }

    return (
      frame.anchor ?? {
        x: frame.width / 2,
        y: frame.height
      }
    );
  }

  // Sprite bên "left" nhìn sang phải, bên "right" nhìn sang trái.
  flipFor(slot) {
    return slot === "left"
      ? this.facing === "left"
      : this.facing === "right";
  }

  /**
   * Đổi sprite sang frame này và đặt origin vào điểm chân.
   */
  applyFrame(sprite, file) {
    const frame = this.frames.get(file);
    const anchor = this.anchorOf(file);

    sprite.setTexture(frameKey(this.id, file));

    sprite.setOrigin(
      anchor.x / frame.width,
      anchor.y / frame.height
    );

    return sprite;
  }
}
